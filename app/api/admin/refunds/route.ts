import { NextRequest, NextResponse } from 'next/server'
import { requireConferencePermission } from '@/lib/api-auth'
import { handleApiError, ApiError } from '@/lib/api-error'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface RefundRequestBody {
  registrationId: string
  amount?: number
  reason?: string
  processRefund?: boolean
}

/**
 * Extract name/email from a registration row, falling back to custom_data /
 * participants when the legacy first_name/last_name/email columns are null
 * (new registrations only populate custom_data + participants).
 */
function extractContact(registration: Record<string, any>): {
  email: string
  firstName: string
  lastName: string
} {
  const customData = registration.custom_data || {}
  const firstParticipantFields =
    Array.isArray(registration.participants) && registration.participants.length > 0
      ? registration.participants[0]?.customFields ?? {}
      : {}

  const email = registration.email || customData.email || firstParticipantFields.email || ''
  const firstName =
    registration.first_name ||
    customData.first_name ||
    customData.firstName ||
    firstParticipantFields.first_name ||
    firstParticipantFields.firstName ||
    ''
  const lastName =
    registration.last_name ||
    customData.last_name ||
    customData.lastName ||
    firstParticipantFields.last_name ||
    firstParticipantFields.lastName ||
    ''

  return { email, firstName, lastName }
}

/**
 * POST /api/admin/refunds
 * Process a refund request
 */
export async function POST(request: NextRequest) {
  let body: RefundRequestBody | null = null
  
  try {
    body = await request.json()
    
    if (!body) {
      throw ApiError.validationError('Request body is required')
    }
    
    const { registrationId, amount, reason, processRefund = false } = body

    if (!registrationId) {
      throw ApiError.validationError('Registration ID is required')
    }

    // First, get registration to check conference_id
    const tempSupabase = await (await import('@/lib/supabase')).createServerClient()
    const { data: registration } = await tempSupabase
      .from('registrations')
      .select('conference_id')
      .eq('id', registrationId)
      .single()

    if (!registration) {
      throw ApiError.notFound('Registration')
    }

    // ✅ Use centralized auth helper (checks can_manage_payments permission)
    const { supabase } = await requireConferencePermission(
      registration.conference_id,
      'can_manage_payments'
    )

    // Get full registration details
    const { data: fullRegistration, error: fullRegError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single()

    if (fullRegError || !fullRegistration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Check if payment was made
    if (fullRegistration.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Registration is not paid, cannot process refund' },
        { status: 400 }
      )
    }

    // If just requesting refund (not processing)
    if (!processRefund) {
      const refundAmount = amount || 0 // You may want to calculate this from payment history

      const { data: updated, error: updateError } = await supabase
        .from('registrations')
        .update({
          refund_requested: true,
          refund_amount: refundAmount,
          refund_reason: reason || '',
          refund_status: 'requested',
          refund_requested_at: new Date().toISOString(),
        })
        .eq('id', registrationId)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to request refund' },
          { status: 500 }
        )
      }

      // Create payment history entry
      await createAdminClient().from('payment_history').insert({
        registration_id: registrationId,
        transaction_type: 'refund',
        amount: -refundAmount,
        status: 'pending',
        description: `Refund requested: ${reason || 'No reason provided'}`,
        metadata: { reason },
      })

      return NextResponse.json({
        success: true,
        message: 'Refund requested successfully',
        refund: updated,
      })
    }

    // Process refund through Stripe
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    if (!fullRegistration.payment_intent_id) {
      return NextResponse.json(
        { error: 'No payment intent found for this registration' },
        { status: 400 }
      )
    }

    const refundAmount = amount || undefined // If not specified, full refund

    try {
      // Create refund in Stripe
      const refund = await stripe.refunds.create({
        payment_intent: fullRegistration.payment_intent_id,
        amount: refundAmount ? Math.round(refundAmount * 100) : undefined, // Convert to cents
        reason: reason ? (reason.toLowerCase().includes('fraud') ? 'fraudulent' : 'requested_by_customer') : undefined,
      })

      // Update registration
      const { data: updated, error: updateError } = await supabase
        .from('registrations')
        .update({
          refund_status: 'processed',
          refund_processed_at: new Date().toISOString(),
          payment_status: refundAmount && refundAmount < (fullRegistration.refund_amount || 0) ? 'paid' : 'pending', // Partial refund keeps as paid
        })
        .eq('id', registrationId)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update registration after refund' },
          { status: 500 }
        )
      }

      // Create payment history entry
      await createAdminClient().from('payment_history').insert({
        registration_id: registrationId,
        transaction_type: 'refund',
        amount: -refund.amount / 100, // Convert from cents
        status: 'completed',
        stripe_refund_id: refund.id,
        description: `Refund processed: ${reason || 'No reason provided'}`,
        metadata: { reason, stripe_refund_id: refund.id },
      })

      return NextResponse.json({
        success: true,
        message: 'Refund processed successfully',
        refund: {
          ...updated,
          stripeRefundId: refund.id,
          refundAmount: refund.amount / 100,
        },
      })
    } catch (stripeError: any) {
      return NextResponse.json(
        { error: `Stripe error: ${stripeError.message}` },
        { status: 500 }
      )
    }
  } catch (error) {
    return handleApiError(error, { action: 'process_refund', registrationId: body?.registrationId })
  }
}

/**
 * GET /api/admin/refunds
 * Get refund requests
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const conferenceId = searchParams.get('conference_id')

    if (!conferenceId) {
      throw ApiError.validationError('Conference ID is required')
    }

    // ✅ Use centralized auth helper (checks can_manage_payments permission)
    const { supabase } = await requireConferencePermission(
      conferenceId,
      'can_manage_payments'
    )

    let query = supabase
      .from('registrations')
      .select('*')
      .eq('refund_requested', true)
      .eq('conference_id', conferenceId)

    if (status) {
      query = query.eq('refund_status', status)
    }

    const { data: refunds, error } = await query.order('refund_requested_at', {
      ascending: false,
    })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch refunds' },
        { status: 500 }
      )
    }

    const enrichedRefunds = (refunds || []).map((r) => {
      const contact = extractContact(r)
      return {
        ...r,
        first_name: r.first_name || contact.firstName,
        last_name: r.last_name || contact.lastName,
        email: r.email || contact.email,
        currency: r.payment_currency || 'EUR',
      }
    })

    return NextResponse.json({
      refunds: enrichedRefunds,
      total: enrichedRefunds.length,
    })
  } catch (error) {
    return handleApiError(error, { action: 'get_refunds' })
  }
}

interface RefundStatusUpdateBody {
  registrationId: string
  status: 'approved' | 'rejected'
  reason?: string
}

/**
 * PATCH /api/admin/refunds
 * Update refund status (approve/reject)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body: RefundStatusUpdateBody = await request.json()
    const { registrationId, status, reason } = body

    if (!registrationId || !status) {
      throw ApiError.validationError('Registration ID and status are required')
    }

    if (!['approved', 'rejected'].includes(status)) {
      throw ApiError.validationError('Status must be "approved" or "rejected"')
    }

    // Get registration to check conference_id
    const tempSupabase = await (await import('@/lib/supabase')).createServerClient()
    const { data: registration } = await tempSupabase
      .from('registrations')
      .select('conference_id')
      .eq('id', registrationId)
      .single()

    if (!registration) {
      throw ApiError.notFound('Registration')
    }

    // ✅ Use centralized auth helper (checks can_manage_payments permission)
    const { supabase } = await requireConferencePermission(
      registration.conference_id,
      'can_manage_payments'
    )

    const { data: updated, error } = await supabase
      .from('registrations')
      .update({
        refund_status: status,
        refund_reason: reason || undefined,
      })
      .eq('id', registrationId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update refund status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Refund ${status} successfully`,
      refund: updated,
    })
  } catch (error) {
    return handleApiError(error, { action: 'update_refund' })
  }
}

