import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { handleApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'
import {
  deliverOrganizerActivation,
  resolveOrganizerAccount,
} from '@/lib/organizer-activation'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  verified: z.boolean(),
})

/**
 * PATCH /api/admin/subscription-orders/[id]/confirm-bank-payment
 * Super admin marks a bank-transfer subscription order as paid (or undoes it).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireSuperAdmin()
    const supabase = createAdminClient()
    const orderId = params.id

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const { verified } = parsed.data

    const { data: order, error: orderError } = await supabase
      .from('subscription_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.payment_method !== 'bank_transfer') {
      return NextResponse.json(
        { error: 'Only bank transfer orders can be confirmed here' },
        { status: 400 }
      )
    }

    if (!verified) {
      // Undo: mark pending again (do not delete user/subscription for safety)
      await supabase
        .from('subscription_orders')
        .update({
          status: 'pending',
          bank_transfer_verified: false,
          bank_transfer_verified_at: null,
          bank_transfer_verified_by: null,
        })
        .eq('id', orderId)

      return NextResponse.json({ ok: true, status: 'pending' })
    }

    const email = order.email
    const fullName = order.full_name
    const organization = order.organization

    if (order.status === 'paid') {
      const existingAccount = await resolveOrganizerAccount({
        authAdmin: supabase.auth.admin,
        profiles: supabase,
        email,
        fullName,
        organization,
      })
      const activationEmailSent = existingAccount.ok
        ? await deliverOrganizerActivation({
            email,
            fullName,
            activationUrl: existingAccount.activationUrl,
          })
        : false

      return NextResponse.json({
        ok: true,
        status: 'paid',
        alreadyPaid: true,
        activation_email_sent: activationEmailSent,
      })
    }

    const account = await resolveOrganizerAccount({
      authAdmin: supabase.auth.admin,
      profiles: supabase,
      email,
      fullName,
      organization,
    })

    if (!account.ok) {
      log.error('Failed to prepare organizer for bank order', undefined, {
        orderId,
        email,
      })
      return NextResponse.json({ error: account.error }, { status: 500 })
    }

    const userId = account.userId

    if (!account.profileExists) {
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: userId,
        email,
        full_name: fullName,
        role: 'conference_admin',
        active: true,
        organization,
      })

      if (profileError) {
        log.error('Failed to create user profile', profileError, { orderId, userId })
        if (account.created) {
          await supabase.auth.admin.deleteUser(userId)
        }
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
    }

    const startsAt = new Date()
    const expiresAt = new Date()
    if (order.billing_cycle === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: order.plan_id,
        status: 'active',
        billing_cycle: order.billing_cycle,
        price: order.price,
        currency: order.currency,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (subError || !subscription) {
      log.error('Failed to create subscription for bank order', subError, {
        orderId,
      })
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      )
    }

    await supabase
      .from('subscription_orders')
      .update({
        status: 'paid',
        bank_transfer_verified: true,
        bank_transfer_verified_at: new Date().toISOString(),
        bank_transfer_verified_by: user.id,
        user_id: userId,
        subscription_id: subscription.id,
      })
      .eq('id', orderId)

    const activationEmailSent = await deliverOrganizerActivation({
      email,
      fullName,
      activationUrl: account.activationUrl,
    })

    return NextResponse.json({
      ok: true,
      status: 'paid',
      subscriptionId: subscription.id,
      userId,
      activation_email_sent: activationEmailSent,
    })
  } catch (error) {
    return handleApiError(error, { action: 'confirm_subscription_bank_payment' })
  }
}
