import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/participant/registrations/[id]
 * Get specific registration details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { data: registration, error: registrationError } = await admin
      .from('participant_registrations')
      .select(
        `
        *,
        conference:conferences (
          id,
          name,
          slug,
          event_type,
          description,
          start_date,
          end_date,
          location,
          venue,
          logo_url,
          primary_color,
          website_url
        ),
        certificate:certificates (
          id,
          certificate_url,
          certificate_type,
          issued_at
        ),
        abstract:abstracts (
          id,
          title,
          status
        )
      `
      )
      .eq('id', params.id)
      .eq('participant_id', profile.id)
      .single()

    if (registrationError || !registration) {
      log.warn('Registration not found or unauthorized', {
        registrationId: params.id,
        participantId: profile.id,
      })
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      registration,
    })
  } catch (error) {
    log.error('Get registration details error', error as Error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
