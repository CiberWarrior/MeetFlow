import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema
const cancelSchema = z.object({
  reason: z.string().optional(),
  request_refund: z.boolean().default(false),
})

/**
 * POST /api/participant/registrations/[id]/cancel
 * Cancel a registration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validatedData = cancelSchema.parse(body)

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

    // Get current registration
    const { data: registration, error: getError } = await supabase
      .from('participant_registrations')
      .select('*, conference:conferences(start_date)')
      .eq('id', params.id)
      .eq('participant_id', profile.id)
      .single()

    if (getError || !registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Check if already cancelled
    if (registration.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Registration is already cancelled' },
        { status: 400 }
      )
    }

    // Check if event already started (optional - you can allow cancellation anytime)
    const now = new Date()
    const eventStart = new Date(registration.conference.start_date)
    if (eventStart < now) {
      return NextResponse.json(
        {
          error:
            'Cannot cancel registration after event has started. Please contact support.',
        },
        { status: 400 }
      )
    }

    // Update registration status
    const { error: updateError } = await createAdminClient()
      .from('participant_registrations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: validatedData.reason || null,
      })
      .eq('id', params.id)

    if (updateError) {
      log.error('Failed to cancel registration', updateError, {
        registrationId: params.id,
        participantId: profile.id,
      })
      return NextResponse.json(
        { error: 'Failed to cancel registration' },
        { status: 500 }
      )
    }

    // TODO: Handle refund logic here if request_refund is true
    // This would involve:
    // 1. Creating a refund request in payment_history
    // 2. Processing through Stripe (if paid by card)
    // 3. Notifying admin

    if (validatedData.request_refund && registration.payment_status === 'paid') {
      log.info('Refund requested for cancelled registration', {
        registrationId: params.id,
        participantId: profile.id,
        amount: registration.amount_paid,
      })
      // TODO: Implement refund logic
    }

    log.info('Registration cancelled', {
      registrationId: params.id,
      participantId: profile.id,
      reason: validatedData.reason,
    })

    return NextResponse.json({
      success: true,
      message: 'Registration cancelled successfully',
      refund_requested: validatedData.request_refund,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    log.error('Cancel registration error', error as Error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
