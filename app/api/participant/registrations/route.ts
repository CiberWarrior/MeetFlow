import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/participant/registrations
 * Get all registrations for current participant
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
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Ownership verified; conference embed needs admin client (RLS 067).
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
      log.error(
        'Failed to fetch participant registrations',
        registrationsError,
        {
          participantId: profile.id,
        }
      )
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

    return NextResponse.json({
      success: true,
      registrations,
      upcoming,
      past,
      total: registrations.length,
    })
  } catch (error) {
    log.error('Get participant registrations error', error as Error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
