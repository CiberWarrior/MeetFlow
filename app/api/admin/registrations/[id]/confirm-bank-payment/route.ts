import { NextRequest, NextResponse } from 'next/server'
import { requireConferencePermission } from '@/lib/api-auth'
import { handleApiError, ApiError } from '@/lib/api-error'
import { createServerClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/registrations/[id]/confirm-bank-payment
 * Manually confirm (or undo) a bank transfer payment after the admin has
 * verified it with their bank. Admin-only bookkeeping action – does not
 * notify the participant.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const registrationId = params.id
    const body = await request.json().catch(() => null)
    const verified = body?.verified

    if (typeof verified !== 'boolean') {
      throw ApiError.validationError('`verified` (boolean) is required')
    }

    // Look up conference_id (and validate payment method) before checking permissions
    const tempSupabase = await createServerClient()
    const { data: registration } = await tempSupabase
      .from('registrations')
      .select('conference_id, payment_method, payment_amount, payment_currency, payment_reference')
      .eq('id', registrationId)
      .single()

    if (!registration) {
      throw ApiError.notFound('Registration')
    }

    if (registration.payment_method !== 'bank_transfer') {
      throw ApiError.validationError('Only bank transfer registrations can be confirmed this way')
    }

    // ✅ Use centralized auth helper (checks can_manage_payments permission)
    const { user, supabase } = await requireConferencePermission(
      registration.conference_id,
      'can_manage_payments'
    )

    const { data: updated, error } = await supabase
      .from('registrations')
      .update({
        payment_status: verified ? 'paid' : 'pending',
        bank_transfer_verified: verified,
        bank_transfer_verified_at: verified ? new Date().toISOString() : null,
        bank_transfer_verified_by: verified ? user.id : null,
      })
      .eq('id', registrationId)
      .select('id, payment_status, bank_transfer_verified, bank_transfer_verified_at')
      .single()

    if (error) {
      log.error('Failed to update bank transfer verification', error, {
        registrationId,
        action: 'confirm_bank_payment',
      })
      return NextResponse.json(
        { error: 'Failed to update payment status' },
        { status: 500 }
      )
    }

    // Record the manual confirmation in the payment ledger so it shows up in
    // /admin/payments → History. A confirmation is a 'payment'; undoing it is an
    // 'adjustment' that reverses the amount. Non-fatal if it fails.
    const amount = Number(registration.payment_amount ?? 0)
    const currency = (registration.payment_currency as string) || 'EUR'
    const { error: historyError } = await createAdminClient().from('payment_history').insert({
      registration_id: registrationId,
      transaction_type: verified ? 'payment' : 'adjustment',
      amount: verified ? amount : -amount,
      currency,
      status: 'completed',
      payment_method: 'bank_transfer',
      payment_reference: registration.payment_reference ?? null,
      description: verified
        ? 'Bank transfer confirmed by admin'
        : 'Bank transfer confirmation reversed by admin',
      metadata: { verified, admin_user_id: user.id },
    })

    if (historyError) {
      log.error('Failed to write bank payment to payment_history', historyError, {
        registrationId,
        action: 'confirm_bank_payment_history',
      })
    }

    log.info('Bank transfer payment verification updated', {
      registrationId,
      verified,
      adminUserId: user.id,
      action: 'confirm_bank_payment',
    })

    return NextResponse.json({ success: true, registration: updated })
  } catch (error) {
    return handleApiError(error, { action: 'confirm_bank_payment' })
  }
}
