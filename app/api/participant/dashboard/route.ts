import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'
import {
  getNextTier,
  getEventsUntilNextTier,
  LOYALTY_TIERS,
  type LoyaltyTier,
} from '@/types/participant-account'

export const dynamic = 'force-dynamic'

/**
 * GET /api/participant/dashboard
 * Get complete dashboard data for participant
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get participant profile
    const { data: profile, error: profileError } = await supabase
      .from('participant_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Ownership already verified via session profile. Load conference embed with
    // admin client — participants have no conference_permissions (RLS 067).
    const admin = createAdminClient()
    const { data: registrations, error: registrationsError } = await admin
      .from('participant_registrations')
      .select(
        `
        *,
        conference:conferences (
          id,
          name,
          slug,
          event_type,
          start_date,
          end_date,
          location,
          logo_url,
          primary_color
        ),
        certificate:certificates (
          id,
          certificate_url,
          issued_at
        )
      `
      )
      .eq('participant_id', profile.id)
      .order('registered_at', { ascending: false })

    if (registrationsError) {
      log.error('Failed to fetch registrations', registrationsError)
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      )
    }

    // Split into upcoming and past events
    const now = new Date().toISOString()
    const upcoming = registrations.filter(
      (reg: any) =>
        reg.status !== 'cancelled' &&
        reg.conference?.end_date &&
        reg.conference.end_date >= now
    )
    const past = registrations.filter(
      (reg: any) =>
        reg.status !== 'cancelled' &&
        reg.conference?.end_date &&
        reg.conference.end_date < now
    )

    // Get available discounts
    const { data: discounts, error: discountsError } = await supabase
      .from('participant_loyalty_discounts')
      .select('*')
      .eq('participant_id', profile.id)
      .eq('applied', false)
      .gte('valid_until', now)

    if (discountsError) {
      log.error('Failed to fetch discounts', discountsError)
      // Don't fail the request, just log
    }

    // Calculate loyalty info
    // Ensure loyalty_tier is a valid LoyaltyTier type
    const loyaltyTier = (profile.loyalty_tier || 'bronze') as LoyaltyTier
    const nextTier = getNextTier(loyaltyTier)
    const eventsUntilNextTier = getEventsUntilNextTier(
      profile.total_events_attended,
      loyaltyTier
    )

    const loyaltyInfo = {
      tier: loyaltyTier,
      points: profile.loyalty_points,
      events_attended: profile.total_events_attended,
      next_tier: nextTier,
      events_until_next_tier: eventsUntilNextTier,
      current_tier_benefits: LOYALTY_TIERS[loyaltyTier].benefits,
      discount_percentage: LOYALTY_TIERS[loyaltyTier].discount_percentage,
    }

    // Get stats
    const stats = {
      total_registrations: registrations.length,
      upcoming_events: upcoming.length,
      past_events: past.length,
      cancelled_registrations: registrations.filter(
        (r: any) => r.status === 'cancelled'
      ).length,
      certificates_earned: registrations.filter((r: any) => r.certificate_id)
        .length,
    }

    return NextResponse.json({
      success: true,
      profile,
      registrations,
      upcoming_events: upcoming,
      past_events: past,
      available_discounts: discounts || [],
      loyalty_info: loyaltyInfo,
      stats,
    })
  } catch (error) {
    log.error('Get dashboard data error', error as Error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
