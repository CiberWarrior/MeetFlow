/**
 * Centralized Authentication & Authorization Helpers for API Routes
 * 
 * These helpers provide consistent auth/permission checks across all API routes.
 * They throw ApiError if checks fail, so routes can simply call them and continue.
 * 
 * Usage:
 *   const { user, profile } = await requireAuth()
 *   const { user, profile } = await requireSuperAdmin()
 *   await requireConferencePermission(conferenceId, 'can_edit_conference')
 */

import { createServerClient } from './supabase'
import { ApiError } from './api-error'
import type { UserProfile } from './auth-utils'
import { log } from './logger'

export interface AuthContext {
  user: {
    id: string
    email?: string
    [key: string]: unknown
  }
  profile: UserProfile
  supabase: Awaited<ReturnType<typeof createServerClient>>
}

/**
 * Require user to be authenticated
 * Returns user and profile, throws ApiError if not authenticated
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createServerClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw ApiError.unauthorized('Authentication required')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw ApiError.forbidden('User profile not found')
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as UserProfile,
    supabase,
  }
}

/**
 * Require user to be authenticated and account to be active
 */
export async function requireActiveAuth(): Promise<AuthContext> {
  const auth = await requireAuth()
  
  if (!auth.profile.active) {
    throw ApiError.forbidden('Your account is deactivated')
  }

  return auth
}

/**
 * Require user to have a specific role
 * @param role - 'super_admin' or 'conference_admin'
 */
export async function requireRole(
  role: 'super_admin' | 'conference_admin'
): Promise<AuthContext> {
  const auth = await requireActiveAuth()
  
  if (auth.profile.role !== role) {
    throw ApiError.forbidden(`Only ${role === 'super_admin' ? 'super admins' : 'conference admins'} can access this resource`)
  }

  return auth
}

/**
 * Require user to be super admin
 * Shorthand for requireRole('super_admin')
 */
export async function requireSuperAdmin(): Promise<AuthContext> {
  return requireRole('super_admin')
}

/**
 * Require user to have permission for a specific conference
 * 
 * @param conferenceId - Conference ID to check permission for
 * @param permission - Optional specific permission to check (e.g., 'can_edit_conference')
 *                     If not provided, just checks if user has access to conference
 * @param allowSuperAdmin - If true (default), super admins bypass permission checks
 */
export async function requireConferencePermission(
  conferenceId: string,
  permission?: keyof Pick<
    import('./auth-utils').ConferencePermission,
    | 'can_view_registrations'
    | 'can_export_data'
    | 'can_manage_payments'
    | 'can_manage_abstracts'
    | 'can_check_in'
    | 'can_generate_certificates'
    | 'can_edit_conference'
    | 'can_delete_data'
    | 'can_manage_registration_form'
    | 'can_view_all_registrations'
    | 'can_view_analytics'
  >,
  allowSuperAdmin: boolean = true
): Promise<AuthContext> {
  const auth = await requireActiveAuth()
  
  // Super admins bypass permission checks (unless explicitly disabled)
  if (allowSuperAdmin && auth.profile.role === 'super_admin') {
    return auth
  }

  // Check if user has permission for this conference
  const { data: permissionData, error: permError } = await auth.supabase
    .from('conference_permissions')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('conference_id', conferenceId)
    .single()

  if (permError || !permissionData) {
    throw ApiError.forbidden('You do not have access to this conference')
  }

  // If specific permission is requested, check it
  if (permission) {
    // Deleting participant data stays super-admin-only, even when the column is true.
    // Editing follows the permission row for the assigned conference.
    if (permission === 'can_delete_data' && auth.profile.role !== 'super_admin') {
      throw ApiError.forbidden(
        'You do not have permission to delete data for this conference'
      )
    }

    // Check the actual permission column. Operational permissions default to
    // true when access is granted, so this only blocks users whose permission
    // was explicitly revoked by a super admin.
    if (permissionData[permission] !== true) {
      throw ApiError.forbidden(`You do not have permission to ${permission.replace('can_', '').replace(/_/g, ' ')} for this conference`)
    }
  }

  return auth
}

/**
 * Require user to be able to edit a specific conference
 * Shorthand for requireConferencePermission(conferenceId, 'can_edit_conference')
 */
export async function requireCanEditConference(
  conferenceId: string
): Promise<AuthContext> {
  return requireConferencePermission(conferenceId, 'can_edit_conference')
}

/**
 * Check if user can impersonate another user
 * Only super admins can impersonate, and only conference_admin users
 * 
 * @param targetUserId - User ID to impersonate
 * @returns Auth context for the impersonating user
 */
export async function requireCanImpersonate(
  targetUserId: string
): Promise<AuthContext> {
  const auth = await requireSuperAdmin()
  
  // Get the target user
  const { data: targetUser, error: targetError } = await auth.supabase
    .from('user_profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (targetError || !targetUser) {
    throw ApiError.notFound('User', 'User not found')
  }

  // Only allow impersonating conference_admin users
  if (targetUser.role !== 'conference_admin') {
    throw ApiError.forbidden('Can only impersonate conference admin users')
  }

  // Only allow impersonating active users
  if (!targetUser.active) {
    throw ApiError.forbidden('Cannot impersonate deactivated users')
  }

  return auth
}

/**
 * Get optional auth context (doesn't throw if not authenticated)
 * Useful for public endpoints that have optional auth
 * 
 * @returns Auth context if authenticated, null otherwise
 */
export async function getOptionalAuth(): Promise<AuthContext | null> {
  try {
    return await requireAuth()
  } catch {
    return null
  }
}
