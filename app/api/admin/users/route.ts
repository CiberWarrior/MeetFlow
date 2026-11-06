import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireSuperAdmin } from '@/lib/api-auth'
import { handleApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'

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
      email, 
      password, 
      full_name, 
      phone, 
      organization,
      role = 'conference_admin',
      conference_ids = [],
      permissions = {}
    } = body

    log.info('Creating new user', {
      email,
      role,
      conferenceCount: conference_ids.length,
      createdBy: user.id,
    })

    // Validate required fields
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth using Admin Client (requires SERVICE_ROLE_KEY)
    const adminClient = createAdminClient()
    const { data: authData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name
      }
    })

    if (createAuthError) {
      log.error('Auth user creation failed', createAuthError, {
        email,
        action: 'create_auth_user',
      })
      return NextResponse.json(
        { error: createAuthError.message || 'Failed to create user in authentication system' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      log.error('Auth user creation returned no user', undefined, {
        email,
        action: 'create_auth_user',
      })
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    log.info('User created in Auth', {
      userId: authData.user.id,
      email,
    })

    // Create user profile
    const { error: createProfileError } = await adminClient
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role,
        phone: phone || null,
        organization: organization || null,
        active: true
      })

    if (createProfileError) {
      log.error('User profile creation failed', createProfileError, {
        userId: authData.user.id,
        email,
        action: 'create_user_profile',
      })
      
      // Rollback: Delete the auth user using Admin Client
      await adminClient.auth.admin.deleteUser(authData.user.id)
      
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    log.info('User profile created', {
      userId: authData.user.id,
      email,
      role,
    })

    // Send welcome email with login credentials (for Conference Admin)
    if (role === 'conference_admin') {
      try {
        const { sendAdminWelcomeEmail } = await import('@/lib/email')
        await sendAdminWelcomeEmail(
          email,
          full_name,
          password // Send the password that was set
        )
        log.info('Welcome email sent successfully', {
          userId: authData.user.id,
          email,
        })
      } catch (emailError) {
        log.error('Failed to send welcome email', emailError, {
          userId: authData.user.id,
          email,
          action: 'send_welcome_email',
        })
        // Don't fail user creation if email fails
      }
    }

    // If Conference Admin, assign conferences with permissions
    if (role === 'conference_admin' && conference_ids.length > 0) {
      const conferencePermissions = conference_ids.map((conferenceId: string) => ({
        user_id: authData.user.id,
        conference_id: conferenceId,
        can_view_registrations: permissions.can_view_registrations ?? true,
        can_export_data: permissions.can_export_data ?? true,
        can_manage_payments: permissions.can_manage_payments ?? true,
        can_manage_abstracts: permissions.can_manage_abstracts ?? true,
        can_check_in: permissions.can_check_in ?? true,
        can_generate_certificates: permissions.can_generate_certificates ?? true,
        can_edit_conference: permissions.can_edit_conference ?? false,
        can_delete_data: permissions.can_delete_data ?? false,
        granted_by: profile.id
      }))

      const { error: permError } = await supabase
        .from('conference_permissions')
        .insert(conferencePermissions)

      if (permError) {
        log.error('Conference permissions assignment failed', permError, {
          userId: authData.user.id,
          email,
          conferenceIds: conference_ids,
          action: 'assign_permissions',
        })
        log.warn('User created but permissions assignment failed', {
          userId: authData.user.id,
          email,
        })
      } else {
        log.info('Conference permissions assigned', {
          userId: authData.user.id,
          email,
          conferenceCount: conference_ids.length,
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully',
        user: {
          id: authData.user.id,
          email,
          full_name,
          role
        }
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error, { action: 'create_user' })
  }
}

