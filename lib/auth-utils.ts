import { supabase } from './supabase'
import { log } from './logger'

/**
 * Get appropriate Supabase client based on context
 * - Server context: uses createServerClient (reads from cookies)
 * - Client context: uses client-side supabase
 * 
 * Note: In client components, this will always use client-side supabase.
 * In server components/API routes, this will use createServerClient.
 */
async function getSupabaseClient() {
  // Client context - always use client-side supabase
  // This prevents issues with dynamic imports in client components
  if (typeof window !== 'undefined') {
    return supabase
  }
  
  // Server context - use createServerClient
  // Dynamic import to avoid bundling createServerClient in client bundle
  try {
    const { createServerClient } = await import('./supabase')
    return await createServerClient()
  } catch (error) {
    // If dynamic import fails, log error and throw
    // This should not happen in normal server context
    log.error('Failed to create server client', error, {
      function: 'getSupabaseClient',
    })
    throw new Error('Failed to create Supabase server client. This function should only be called from server context.')
  }
}

export type UserRole = 'super_admin' | 'conference_admin'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  active: boolean
  phone: string | null
  organization: string | null
  last_login: string | null
  created_at: string
  updated_at: string
  default_vat_percentage?: number | null // Organization default VAT %
  vat_label?: string | null // Optional VAT label (e.g., "Croatia PDV")
  
  // Bank Account settings (for receiving bank transfers)
  bank_account_number?: string | null // IBAN
  bank_account_holder?: string | null
  bank_name?: string | null
  swift_bic?: string | null
  bank_address?: string | null
  bank_account_currency?: string | null
}

export interface ConferencePermission {
  id: string
  user_id: string
  conference_id: string
  can_view_registrations: boolean
  can_export_data: boolean
  can_manage_payments: boolean
  can_manage_abstracts: boolean
  can_check_in: boolean
  can_generate_certificates: boolean
  can_edit_conference: boolean
  can_delete_data: boolean
  can_manage_registration_form: boolean
  can_view_all_registrations: boolean
  can_view_analytics: boolean
  granted_by: string | null
  granted_at: string
  notes: string | null
}

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const client = await getSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    
    if (!user) return null

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      log.error('Error fetching user profile', error, {
        userId: user.id,
        function: 'getCurrentUserProfile',
      })
      return null
    }

    return data as UserProfile
  } catch (error) {
    log.error('Error getting current user profile', error, {
      function: 'getCurrentUserProfile',
    })
    return null
  }
}

/**
 * Check if current user is super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const profile = await getCurrentUserProfile()
    return profile?.role === 'super_admin' && profile?.active === true
  } catch (error) {
    log.error('Error checking super admin status', error, {
      function: 'isSuperAdmin',
    })
    return false
  }
}

/**
 * Check if user has permission for specific conference
 */
export async function hasConferencePermission(
  conferenceId: string,
  userId?: string
): Promise<boolean> {
  try {
    // If super admin, has access to everything
    if (await isSuperAdmin()) {
      return true
    }

    const client = await getSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    const checkUserId = userId || user?.id
    
    if (!checkUserId) return false

    const { data, error } = await client
      .from('conference_permissions')
      .select('id')
      .eq('user_id', checkUserId)
      .eq('conference_id', conferenceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return false // No rows found
      log.error('Error checking conference permission', error, {
        conferenceId,
        userId: checkUserId,
        function: 'hasConferencePermission',
      })
      return false
    }

    return !!data
  } catch (error) {
    log.error('Error checking conference permission', error, {
      conferenceId,
      function: 'hasConferencePermission',
    })
    return false
  }
}

/**
 * Get user's conference permissions
 */
export async function getUserConferencePermissions(
  conferenceId: string,
  userId?: string
): Promise<ConferencePermission | null> {
  try {
    const client = await getSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    const checkUserId = userId || user?.id
    
    if (!checkUserId) return null

    const { data, error } = await client
      .from('conference_permissions')
      .select('*')
      .eq('user_id', checkUserId)
      .eq('conference_id', conferenceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      log.error('Error fetching conference permissions', error, {
        conferenceId,
        userId: checkUserId,
        function: 'getUserConferencePermissions',
      })
      return null
    }

    return data as ConferencePermission
  } catch (error) {
    log.error('Error getting conference permissions', error, {
      conferenceId,
      function: 'getUserConferencePermissions',
    })
    return null
  }
}

/**
 * Get all accessible conferences for current user
 */
export async function getAccessibleConferences() {
  try {
    const profile = await getCurrentUserProfile()
    
    if (!profile) return []

    const client = await getSupabaseClient()
    
    // Super admin gets all conferences
    if (profile.role === 'super_admin') {
      const { data, error } = await client
        .from('conferences')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        log.error('Error fetching conferences', error, {
          function: 'getAccessibleConferences',
          role: 'super_admin',
        })
        return []
      }

      return data || []
    }

    // Conference admin gets only assigned conferences
    const { data, error } = await client
      .from('conferences')
      .select(`
        *,
        conference_permissions!inner(user_id)
      `)
      .eq('conference_permissions.user_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      log.error('Error fetching accessible conferences', error, {
        userId: profile.id,
        function: 'getAccessibleConferences',
        role: 'conference_admin',
      })
      return []
    }

    return data || []
  } catch (error) {
    log.error('Error getting accessible conferences', error, {
      function: 'getAccessibleConferences',
    })
    return []
  }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  try {
    const client = await getSupabaseClient()
    await client
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId)
  } catch (error) {
    log.error('Error updating last login', error, {
      userId,
      function: 'updateLastLogin',
    })
  }
}

/**
 * Log admin action to audit trail
 */
export async function logAdminAction(
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const client = await getSupabaseClient()
    await client.rpc('log_admin_action', {
      p_action: action,
      p_resource_type: resourceType || null,
      p_resource_id: resourceId || null,
      p_details: details ? JSON.stringify(details) : null,
    })
  } catch (error) {
    log.error('Error logging admin action', error, {
      action,
      resourceType,
      resourceId,
      function: 'logAdminAction',
    })
  }
}

/**
 * Check a conference permission for the current user.
 * Super admins pass. Delete stays super-admin-only.
 * Edit requires can_edit_conference on that conference.
 * Other operational flags pass when the user is assigned to the conference.
 */
export async function checkPermission(
  conferenceId: string,
  permission: keyof Pick<
    ConferencePermission,
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
  >
): Promise<boolean> {
  try {
    // Super admin has all permissions
    if (await isSuperAdmin()) {
      return true
    }

    // Deleting participant data stays super-admin-only.
    if (permission === 'can_delete_data') {
      return false
    }

    // Editing follows the permission row on the assigned conference.
    if (permission === 'can_edit_conference') {
      const row = await getUserConferencePermissions(conferenceId)
      return row?.can_edit_conference === true
    }

    // For operational permissions, conference access is enough.
    return await hasConferencePermission(conferenceId)
  } catch (error) {
    log.error('Error checking permission', error, {
      conferenceId,
      permission,
      function: 'checkPermission',
    })
    return false
  }
}


