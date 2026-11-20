import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { UpdateConferenceInput } from '@/types/conference'
import { requireActiveAuth, requireConferencePermission, requireSuperAdmin } from '@/lib/api-auth'
import { conferenceUpdateAllowed, conferenceVisibleToAdmin } from '@/lib/conference-settings-scope'
import { handleApiError, ApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'
import { invalidateConferenceCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/conferences/[id]
 * Get a single conference by ID.
 * Super admins: any conference. Conference admins: only assigned conferences.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, profile, supabase } = await requireConferencePermission(params.id)

    const { data: conference, error } = await supabase
      .from('conferences')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !conference) {
      throw ApiError.notFound('Conference')
    }

    let visibleConference = conference
    if (profile.role !== 'super_admin') {
      const { data: permission } = await supabase
        .from('conference_permissions')
        .select('can_edit_conference, can_manage_abstracts')
        .eq('user_id', user.id)
        .eq('conference_id', params.id)
        .maybeSingle()

      visibleConference = conferenceVisibleToAdmin(conference, {
        isSuperAdmin: false,
        can_edit_conference: permission?.can_edit_conference === true,
        can_manage_abstracts: permission?.can_manage_abstracts === true,
      })
    }

    // Return with no-cache headers to prevent caching issues
    return NextResponse.json(
      { conference: visibleConference },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    return handleApiError(error, { action: 'get_conference', conferenceId: params.id })
  }
}

/**
 * PATCH /api/admin/conferences/[id]
 * Update a conference
 * Requires authentication and authorization
 * Super admins can update any conference
 * Conference admins can only update conferences they have permission for
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireActiveAuth()
    const rawBody = await request.json()
    const isSuperAdmin = auth.profile.role === 'super_admin'
    let canEditConference = false
    let canManageAbstracts = false

    if (!isSuperAdmin) {
      const { data: permission, error: permissionError } = await auth.supabase
        .from('conference_permissions')
        .select('can_edit_conference, can_manage_abstracts')
        .eq('user_id', auth.user.id)
        .eq('conference_id', params.id)
        .maybeSingle()

      if (permissionError || !permission) {
        throw ApiError.forbidden('You do not have access to this conference')
      }
      canEditConference = permission.can_edit_conference === true
      canManageAbstracts = permission.can_manage_abstracts === true
    }

    const decision = conferenceUpdateAllowed(rawBody, {
      isSuperAdmin,
      can_edit_conference: canEditConference,
      can_manage_abstracts: canManageAbstracts,
    })
    if (!decision.ok) {
      throw decision.reason === 'empty'
        ? ApiError.validationError('No conference changes were provided')
        : ApiError.forbidden('You do not have permission to edit this part of the conference')
    }

    const allowedSettings = {
      ...(decision.conferenceBody.settings && typeof decision.conferenceBody.settings === 'object'
        ? decision.conferenceBody.settings
        : {}),
      ...decision.abstractSettings,
    }
    const body: Partial<UpdateConferenceInput> = {
      ...decision.conferenceBody,
    }
    if (Object.keys(allowedSettings).length > 0) {
      body.settings = allowedSettings as UpdateConferenceInput['settings']
    }

    const { user, profile } = auth

    // Now safe to use admin client to bypass RLS policies for updates
    const supabase = createAdminClient()

    log.info('Updating conference', {
      conferenceId: params.id,
      userId: user.id,
      userRole: profile.role,
    })
    log.debug('Update data', { data: body })

    // Debug: Log custom_abstract_fields before update
    log.debug('Received settings in request', {
      conferenceId: params.id,
      hasSettings: !!body.settings,
      hasCustomAbstractFields: !!body.settings?.custom_abstract_fields,
      customAbstractFieldsType: Array.isArray(body.settings?.custom_abstract_fields) ? 'array' : typeof body.settings?.custom_abstract_fields,
      customAbstractFieldsLength: Array.isArray(body.settings?.custom_abstract_fields) ? body.settings.custom_abstract_fields.length : 'N/A',
      customAbstractFields: body.settings?.custom_abstract_fields ? JSON.stringify(body.settings.custom_abstract_fields, null, 2) : 'none',
    })
    
    if (body.settings?.custom_abstract_fields && Array.isArray(body.settings.custom_abstract_fields)) {
      log.debug('Updating custom_abstract_fields', {
        conferenceId: params.id,
        fields: body.settings.custom_abstract_fields.map((f: any) => ({
          id: f.id,
          name: f.name,
          label: f.label,
          type: f.type,
          hasOptions: !!f.options,
          optionsLength: f.options?.length,
          options: f.options,
        })),
      })
    }

    // If settings are being updated, we need to merge with existing settings
    // to avoid overwriting other settings fields
    if (body.settings) {
      // Fetch current settings first
      const { data: currentConference } = await supabase
        .from('conferences')
        .select('settings')
        .eq('id', params.id)
        .single()

      if (currentConference?.settings) {
        // Deep merge settings to preserve nested objects
        // Important: If custom_abstract_fields or custom_registration_fields are explicitly provided,
        // they should replace the existing ones (not merge)
        const mergedSettings = {
          ...currentConference.settings,
          ...body.settings,
        }
        
        // Explicitly handle custom fields - if they're provided (even as empty array), use them
        // If they're undefined, keep the existing ones
        if ('custom_abstract_fields' in body.settings) {
          mergedSettings.custom_abstract_fields = body.settings.custom_abstract_fields
        }
        if ('custom_registration_fields' in body.settings) {
          mergedSettings.custom_registration_fields = body.settings.custom_registration_fields
        }
        
        body.settings = mergedSettings
        
        log.debug('Merged settings', {
          conferenceId: params.id,
          hasCustomAbstractFields: 'custom_abstract_fields' in mergedSettings,
          customAbstractFieldsCount: mergedSettings.custom_abstract_fields?.length || 0,
          customAbstractFields: mergedSettings.custom_abstract_fields ? JSON.stringify(mergedSettings.custom_abstract_fields, null, 2) : 'none',
        })
      }
    }

    // Debug: Log what we're about to save
    log.debug('About to save to database', {
      conferenceId: params.id,
      settingsKeys: Object.keys(body.settings || {}),
      customAbstractFieldsCount: body.settings?.custom_abstract_fields?.length || 0,
      customAbstractFields: body.settings?.custom_abstract_fields ? JSON.stringify(body.settings.custom_abstract_fields, null, 2) : 'none',
    })

    // Update conference
    const { data: conference, error } = await supabase
      .from('conferences')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      log.error('Conference update failed', error, {
        conferenceId: params.id,
        userId: user.id,
        action: 'update',
        errorDetails: error.message,
        errorCode: error.code,
        errorHint: error.hint,
      })
      return NextResponse.json({ 
        error: 'Failed to update conference',
        details: error.message 
      }, { status: 500 })
    }

    // Debug: Verify what was actually saved
    log.debug('Successfully saved to database', {
      conferenceId: params.id,
      slug: conference.slug,
      savedCustomAbstractFieldsCount: conference.settings?.custom_abstract_fields?.length || 0,
      savedCustomAbstractFields: conference.settings?.custom_abstract_fields ? JSON.stringify(conference.settings.custom_abstract_fields, null, 2) : 'none',
    })

    // Debug: Log custom_abstract_fields after update
    if (conference.settings?.custom_abstract_fields) {
      log.debug('Custom_abstract_fields after update', {
        conferenceId: params.id,
        slug: conference.slug,
        fields: conference.settings.custom_abstract_fields.map((f: any) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          hasOptions: !!f.options,
          optionsLength: f.options?.length,
        })),
      })
    }

    log.info('Conference updated successfully', {
      conferenceId: params.id,
      userId: user.id,
    })

    // Invalidate cache for this conference
    if (conference.slug) {
      await invalidateConferenceCache(conference.slug).catch((err) => {
        log.warn('Failed to invalidate conference cache', { slug: conference.slug, error: err })
      })
      log.debug('Cache invalidated for conference', { slug: conference.slug })
    }

    // Return with no-cache headers to prevent caching issues
    return NextResponse.json(
      { conference },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    log.error('Conference update error', error, {
      conferenceId: params.id,
      action: 'update',
    })
    return NextResponse.json({ 
      error: 'Failed to update conference',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/conferences/[id]
 * Delete a conference
 * WARNING: This will cascade delete all related data (registrations, abstracts, etc.)
 * Only super admins can delete conferences
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Conference deletion cascades registrations and abstracts. Super admin only.
    const { user, supabase } = await requireSuperAdmin()

    // Check if conference exists
    const { data: conference, error: fetchError } = await supabase
      .from('conferences')
      .select('id, name')
      .eq('id', params.id)
      .single()

    if (fetchError || !conference) {
      throw ApiError.notFound('Conference')
    }

    // Use admin client to delete (bypasses RLS)
    const adminSupabase = createAdminClient()
    
    // Delete conference (will cascade delete all related data)
    const { error: deleteError } = await adminSupabase
      .from('conferences')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      log.error('Conference delete failed', deleteError, {
        conferenceId: params.id,
        userId: user.id,
        action: 'delete',
      })
      return NextResponse.json({ error: 'Failed to delete conference' }, { status: 500 })
    }

    log.info('Conference deleted successfully', {
      conferenceId: params.id,
      conferenceName: conference.name,
      userId: user.id,
      action: 'delete',
    })

    return NextResponse.json({
      success: true,
      message: `Conference "${conference.name}" and all related data deleted successfully`,
    })
  } catch (error) {
    return handleApiError(error, { action: 'delete_conference', conferenceId: params.id })
  }
}

