import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { CreateConferenceInput } from '@/types/conference'
import { requireAuth, requireSuperAdmin } from '@/lib/api-auth'
import { handleApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/conferences
 * Get all conferences for the current admin
 * RLS policies automatically filter based on user role and permissions
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ Use centralized auth helper
    const { user, profile, supabase } = await requireAuth()

    log.debug('Fetching conferences for user', {
      userId: user.id,
      action: 'get_conferences',
    })

    // Check if impersonating (from query param)
    const requestUrl = new URL(request.url)
    const impersonateUserId = requestUrl.searchParams.get('impersonate_user_id')
    
    let targetUserId = user.id
    let isImpersonating = false

    if (impersonateUserId && profile.role === 'super_admin') {
      // Verify the user to impersonate exists and is conference_admin
      const { data: targetUser } = await supabase
        .from('user_profiles')
        .select('role, active')
        .eq('id', impersonateUserId)
        .single()

      if (targetUser && targetUser.role === 'conference_admin' && targetUser.active) {
        targetUserId = impersonateUserId
        isImpersonating = true
        log.info('Impersonation active for conferences', {
          superAdminId: user.id,
          impersonatedUserId: targetUserId,
        })
      }
    }

    // Super admins see all (unless impersonating a conference admin).
    // Conference admins and impersonation: filter by conference_permissions.
    // App-layer filter is required even with RLS — published-conference SELECT
    // policies must not leak other events into the admin list.
    const mustScopeToAssignments =
      isImpersonating || profile.role !== 'super_admin'

    let conferenceIds: string[] | null = null

    if (mustScopeToAssignments) {
      const { data: permissions } = await supabase
        .from('conference_permissions')
        .select('conference_id')
        .eq('user_id', targetUserId)

      conferenceIds = permissions?.map(p => p.conference_id) || []

      if (conferenceIds.length === 0) {
        return NextResponse.json({ conferences: [] })
      }
    }

    let conferencesQuery = supabase.from('conferences').select('*')
    if (conferenceIds) {
      conferencesQuery = conferencesQuery.in('id', conferenceIds)
    }

    const { data: conferences, error } = await conferencesQuery
      .order('created_at', { ascending: false })

    if (error) {
      log.error('Get conferences error', error, {
        userId: user.id,
        action: 'get_conferences',
      })
      return NextResponse.json({ error: 'Failed to fetch conferences' }, { status: 500 })
    }

    log.info('Conferences fetched successfully', {
      userId: user.id,
      count: conferences?.length || 0,
      action: 'get_conferences',
    })
    return NextResponse.json({ conferences })
  } catch (error) {
    return handleApiError(error, { action: 'get_conferences' })
  }
}

/**
 * POST /api/admin/conferences
 * Create a new conference (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ Use centralized auth helper (only super admins can create conferences)
    const { profile } = await requireSuperAdmin()

    const body: CreateConferenceInput = await request.json()

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Conference name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if slug already exists (use admin client for bypass RLS on read)
    const adminSupabase = createAdminClient()
    const { data: existing, error: slugCheckError } = await adminSupabase
      .from('conferences')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    // If slug exists, generate a unique one
    let finalSlug = slug
    if (existing && !slugCheckError) {
      // Add random suffix to make it unique
      const randomSuffix = Math.random().toString(36).substring(2, 6)
      finalSlug = `${slug}-${randomSuffix}`
    }

    // Create conference with generated slug using admin client to bypass RLS
    const { data: conference, error } = await adminSupabase
      .from('conferences')
      .insert({
        name: body.name,
        slug: finalSlug,
        event_type: body.event_type || 'conference', // Default to 'conference' for backward compatibility
        description: body.description,
        start_date: body.start_date,
        end_date: body.end_date,
        location: body.location,
        venue: body.venue,
        website_url: body.website_url,
        logo_url: (body as any).logo_url || undefined,
        primary_color: (body as any).primary_color || undefined,
        pricing: body.pricing || undefined,
        settings: body.settings || undefined,
        email_settings: (body as any).email_settings || undefined,
        owner_id: profile.id, // Set super admin as owner
      })
      .select()
      .single()

    if (error) {
      log.error('Create conference error', error, {
        userId: profile.id,
        conferenceName: body.name,
        slug: finalSlug,
        errorMessage: error.message,
        errorCode: error.code,
        action: 'create_conference',
      })
      return NextResponse.json(
        { 
          error: 'Failed to create conference',
          details: error.message || 'Unknown error occurred'
        },
        { status: 500 }
      )
    }

    // Auto-create permission for the creator (super admin) using admin client
    const { error: permError } = await adminSupabase
      .from('conference_permissions')
      .insert({
        user_id: profile.id,
        conference_id: conference.id,
        can_view_registrations: true,
        can_export_data: true,
        can_manage_payments: true,
        can_manage_abstracts: true,
        can_check_in: true,
        can_generate_certificates: true,
        can_edit_conference: true,
        can_delete_data: true,
        granted_by: profile.id,
      })

    if (permError) {
      log.error('Error creating permission', permError, {
        userId: profile.id,
        conferenceId: conference.id,
        action: 'create_conference_permission',
      })
      // Don't fail the request, just log the error
    }

    log.info('Conference created successfully', {
      userId: profile.id,
      conferenceId: conference.id,
      conferenceName: conference.name,
      action: 'create_conference',
    })
    return NextResponse.json({ conference }, { status: 201 })
  } catch (error) {
    return handleApiError(error, { action: 'create_conference' })
  }
}

