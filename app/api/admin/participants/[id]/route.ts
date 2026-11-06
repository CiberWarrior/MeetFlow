import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { handleApiError, ApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/participants/[id]
 * Get participant details with full registration history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Use centralized auth helper (Super Admin only)
    const { supabase } = await requireSuperAdmin()

    // Get participant profile
    const { data: participant, error: profileError } = await supabase
      .from('participant_profiles')
      .select('*')
      .eq('id', params.id)
      .single()

    if (profileError || !participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      )
    }

    // Get all registrations
    const { data: registrations, error: regsError } = await supabase
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
          location
        )
      `
      )
      .eq('participant_id', params.id)
      .order('registered_at', { ascending: false })

    if (regsError) {
      log.error('Failed to fetch participant registrations', regsError)
    }

    // Get loyalty discounts
    const { data: discounts } = await supabase
      .from('participant_loyalty_discounts')
      .select('*')
      .eq('participant_id', params.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      participant,
      registrations: registrations || [],
      discounts: discounts || [],
    })
  } catch (error) {
    return handleApiError(error, { action: 'get_participant', participantId: params.id })
  }
}

/**
 * PATCH /api/admin/participants/[id]
 * Update participant basic information
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Use centralized auth helper (Super Admin only)
    const { supabase } = await requireSuperAdmin()

    // Get request body
    const body = await request.json()
    const { first_name, last_name, phone, country, institution } = body

    // Update participant profile
    const { data: updatedParticipant, error: updateError } = await createAdminClient()
      .from('participant_profiles')
      .update({
        first_name,
        last_name,
        phone: phone || null,
        country: country || null,
        institution: institution || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError || !updatedParticipant) {
      log.error('Failed to update participant', updateError)
      return NextResponse.json(
        { error: 'Failed to update participant' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      participant: updatedParticipant,
    })
  } catch (error) {
    return handleApiError(error, { action: 'update_participant', participantId: params.id })
  }
}
