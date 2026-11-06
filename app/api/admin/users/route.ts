import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireSuperAdmin } from '@/lib/api-auth'
import { handleApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'
import {
  deliverOrganizerActivation,
  normalizeOrganizerEmail,
  resolveOrganizerAccount,
} from '@/lib/organizer-activation'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users
 * Get all users (Super Admin only)
 */
export async function GET() {
  try {
    // ✅ Use centralized auth helper
    const { user, profile, supabase } = await requireSuperAdmin()

    log.info('Fetching all users for super admin', {
      userId: user.id,
      email: profile.email,
    })

    // Get all user profiles with their conference assignments
    // Use explicit relationship to avoid ambiguity (user_id foreign key, not granted_by)
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        conference_permissions!conference_permissions_user_id_fkey (
          conference_id,
          conferences (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      log.error('Get users error', error, {
        action: 'get_users',
      })
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Transform data to include conference count and names
    const usersWithConferences = users?.map(user => ({
      ...user,
      assigned_conferences_count: user.conference_permissions?.length || 0,
      assigned_conferences: user.conference_permissions?.map((cp: any) => ({
        id: cp.conference_id,
        name: cp.conferences?.name || 'Unknown'
      })) || []
    })) || []

    log.info('Users fetched successfully', {
      count: usersWithConferences.length,
      action: 'get_users',
    })
    
    return NextResponse.json({ users: usersWithConferences })
  } catch (error) {
    return handleApiError(error, { action: 'get_users' })
  }
}

/**
 * POST /api/admin/users
 * Create a new Conference Admin user (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ Use centralized auth helper
    const { user, profile, supabase } = await requireSuperAdmin()

    const body = await request.json()
    const {
      email: rawEmail,
      full_name,
      phone,
      organization,
      role = 'conference_admin',
      conference_ids = [],
      permissions = {},
    } = body

    log.info('Creating new user', {
      email: rawEmail,
      role,
      conferenceCount: Array.isArray(conference_ids) ? conference_ids.length : 0,
      createdBy: user.id,
    })

    const email = typeof rawEmail === 'string' ? normalizeOrganizerEmail(rawEmail) : null
    const fullName = typeof full_name === 'string' ? full_name.trim() : ''
    if (!email || !fullName) {
      return NextResponse.json(
        { error: 'Email and full name are required' },
        { status: 400 }
      )
    }

    if (role !== 'conference_admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (!Array.isArray(conference_ids)) {
      return NextResponse.json({ error: 'Invalid conference selection' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const account = await resolveOrganizerAccount({
      authAdmin: adminClient.auth.admin,
      profiles: supabase,
      email,
      fullName,
      organization: organization || null,
    })

    if (!account.ok) {
      const status = account.error === 'Invalid email format' ? 400 : 500
      return NextResponse.json({ error: account.error }, { status })
    }

    if (account.profileExists) {
      const activationEmailSent = await deliverOrganizerActivation({
        email,
        fullName,
        activationUrl: account.activationUrl,
      })

      log.info('Existing organizer account left unchanged', {
        userId: account.userId,
        email,
        activationEmailSent,
      })

      return NextResponse.json({
        success: true,
        already_exists: true,
        resent: Boolean(account.activationUrl),
        activation_email_sent: activationEmailSent === true,
        user: {
          id: account.userId,
          email,
          full_name: fullName,
          role,
        },
      })
    }

    const { error: createProfileError } = await supabase.from('user_profiles').insert({
      id: account.userId,
      email,
      full_name: fullName,
      role,
      phone: phone || null,
      organization: organization || null,
      active: true,
    })

    if (createProfileError) {
      log.error('User profile creation failed', createProfileError, {
        userId: account.userId,
        email,
        action: 'create_user_profile',
      })

      if (account.created) {
        await adminClient.auth.admin.deleteUser(account.userId)
      }

      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    if (role === 'conference_admin' && conference_ids.length > 0) {
      const conferencePermissions = conference_ids.map((conferenceId: string) => ({
        user_id: account.userId,
        conference_id: conferenceId,
        can_view_registrations: permissions.can_view_registrations ?? true,
        can_export_data: permissions.can_export_data ?? true,
        can_manage_payments: permissions.can_manage_payments ?? true,
        can_manage_abstracts: permissions.can_manage_abstracts ?? true,
        can_check_in: permissions.can_check_in ?? true,
        can_generate_certificates: permissions.can_generate_certificates ?? true,
        can_edit_conference: permissions.can_edit_conference ?? false,
        can_delete_data: permissions.can_delete_data ?? false,
        granted_by: profile.id,
      }))

      const { error: permError } = await supabase
        .from('conference_permissions')
        .insert(conferencePermissions)

      if (permError) {
        log.error('Conference permissions assignment failed', permError, {
          userId: account.userId,
          email,
          conferenceIds: conference_ids,
          action: 'assign_permissions',
        })
      } else {
        log.info('Conference permissions assigned', {
          userId: account.userId,
          email,
          conferenceCount: conference_ids.length,
        })
      }
    }

    const activationEmailSent = await deliverOrganizerActivation({
      email,
      fullName,
      activationUrl: account.activationUrl,
    })

    return NextResponse.json(
      {
        success: true,
        activation_email_sent: activationEmailSent === true,
        user: {
          id: account.userId,
          email,
          full_name: fullName,
          role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error, { action: 'create_user' })
  }
}

