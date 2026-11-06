import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireSuperAdmin } from '@/lib/api-auth'
import { handleApiError, ApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/[id]
 * Get single user details with permissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Use centralized auth helper
    const { supabase } = await requireSuperAdmin()
    const { id } = params

    // Get user profile with permissions
    // Use explicit relationship to avoid ambiguity (user_id foreign key, not granted_by)
    const { data: userData, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        conference_permissions!conference_permissions_user_id_fkey (
          *,
          conferences (
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      throw ApiError.notFound('User', 'User not found')
    }

    return NextResponse.json({ user: userData })
  } catch (error) {
    return handleApiError(error, { action: 'get_user', userId: params.id })
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user details and permissions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Use centralized auth helper
    const { user, profile, supabase } = await requireSuperAdmin()
    const { id } = params

    const body = await request.json()
    const { 
      full_name, 
      phone, 
      organization,
      active,
      password,
      conference_ids,
      permissions
    } = body

    log.info('Updating user', {
      userId: id,
      updatedBy: user.id,
      action: 'update_user',
    })

    // Update user profile
    const profileUpdates: any = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined) profileUpdates.full_name = full_name
    if (phone !== undefined) profileUpdates.phone = phone
    if (organization !== undefined) profileUpdates.organization = organization
    if (active !== undefined) profileUpdates.active = active

    const { error: updateProfileError } = await createAdminClient()
      .from('user_profiles')
      .update(profileUpdates)
      .eq('id', id)

    if (updateProfileError) {
      log.error('Profile update error', updateProfileError, {
        userId: id,
        updatedBy: user.id,
        action: 'update_user_profile',
      })
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      )
    }

    log.info('User profile updated', {
      userId: id,
      updatedBy: user.id,
    })

    // Update password if provided (requires Admin Client)
    if (password && password.length >= 8) {
      const adminClient = createAdminClient()
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(
        id,
        { password }
      )

      if (passwordError) {
        log.error('Password update error', passwordError, {
          userId: id,
          updatedBy: user.id,
          action: 'update_password',
        })
        log.warn('Profile updated but password update failed', {
          userId: id,
        })
      } else {
        log.info('Password updated', {
          userId: id,
          updatedBy: user.id,
        })
      }
    }

    // Update conference permissions if provided
    if (conference_ids !== undefined && Array.isArray(conference_ids)) {
      // Delete existing permissions
      await supabase
        .from('conference_permissions')
        .delete()
        .eq('user_id', id)

      // Insert new permissions
      if (conference_ids.length > 0) {
        const conferencePermissions = conference_ids.map((conferenceId: string) => ({
          user_id: id,
          conference_id: conferenceId,
          can_view_registrations: permissions?.can_view_registrations ?? true,
          can_export_data: permissions?.can_export_data ?? true,
          can_manage_payments: permissions?.can_manage_payments ?? true,
          can_manage_abstracts: permissions?.can_manage_abstracts ?? true,
          can_check_in: permissions?.can_check_in ?? true,
          can_generate_certificates: permissions?.can_generate_certificates ?? true,
          can_edit_conference: permissions?.can_edit_conference ?? false,
          can_delete_data: permissions?.can_delete_data ?? false,
          granted_by: profile.id
        }))

        const { error: permError } = await supabase
          .from('conference_permissions')
          .insert(conferencePermissions)

        if (permError) {
          log.error('Permissions update error', permError, {
            userId: id,
            updatedBy: user.id,
            conferenceIds: conference_ids,
            action: 'update_permissions',
          })
          log.warn('Profile updated but permissions update failed', {
            userId: id,
          })
        } else {
          log.info('Updated permissions for conferences', {
            userId: id,
            updatedBy: user.id,
            conferenceCount: conference_ids.length,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully'
    })
  } catch (error) {
    return handleApiError(error, { action: 'update_user', userId: params.id })
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user (deactivate instead of hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Use centralized auth helper
    const { user, profile, supabase } = await requireSuperAdmin()
    const { id } = params

    // Prevent deleting yourself
    if (id === profile.id) {
      throw ApiError.validationError('Cannot delete your own account')
    }

    log.info('Deactivating user', {
      userId: id,
      deactivatedBy: user.id,
      action: 'deactivate_user',
    })

    // Soft delete - deactivate instead of hard delete
    const { error } = await createAdminClient()
      .from('user_profiles')
      .update({ 
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      log.error('Deactivation error', error, {
        userId: id,
        deactivatedBy: user.id,
        action: 'deactivate_user',
      })
      return NextResponse.json(
        { error: 'Failed to deactivate user' },
        { status: 500 }
      )
    }

    log.info('User deactivated successfully', {
      userId: id,
      deactivatedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully'
    })
  } catch (error) {
    return handleApiError(error, { action: 'deactivate_user', userId: params.id })
  }
}

