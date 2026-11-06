import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPaymentConfirmation } from '@/lib/email'
import {
  deliverOrganizerActivation,
  resolveOrganizerAccount,
} from '@/lib/organizer-activation'
import Stripe from 'stripe'
import { log } from '@/lib/logger'

// Vercel serverless function configuration
export const runtime = 'nodejs'
export const maxDuration = 30 // seconds
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Missing STRIPE_WEBHOOK_SECRET' },
      { status: 500 }
    )
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    log.error('Stripe webhook signature verification failed', err, {
      action: 'webhook_verification',
    })
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Webhook is server-to-server from Stripe - there is never a user session.
  // registrations/contact_inquiries RLS is admin-scoped (migration 056), so
  // this must always use the service role client.
  const supabase = createAdminClient()

  // Handle checkout session completed (for redirect-based payments)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    
    // Self-service platform subscription checkout
    if (session.metadata?.order_id) {
      return await handleSelfServiceOrderPayment(session, supabase)
    }

    // Admin-sent Payment Link from CRM inquiries
    if (session.metadata?.inquiry_id) {
      return await handleSubscriptionPayment(session, supabase)
    }
    
    // Otherwise, it's a conference registration payment
    const registrationId = session.metadata?.registrationId

    if (registrationId) {
      // Get registration details for email (including conference_id)
      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .select('*, conference_id')
        .eq('id', registrationId)
        .single()

      if (regError) {
        log.error('Failed to fetch registration for webhook', regError, {
          registrationId,
          eventType: 'checkout.session.completed',
        })
      }

      // Update payment status to paid
      const { error } = await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          payment_method: 'card',
          payment_amount: (session.amount_total || 0) / 100,
          payment_currency: (session.currency || 'EUR').toUpperCase(),
        })
        .eq('id', registrationId)

      if (error) {
        log.error('Failed to update payment status', error, {
          registrationId,
          eventType: 'checkout.session.completed',
        })
        return NextResponse.json(
          { error: 'Failed to update payment status' },
          { status: 500 }
        )
      }

      // Create payment history entry
      await supabase.from('payment_history').insert({
        registration_id: registrationId,
        transaction_type: 'payment',
        amount: (session.amount_total || 0) / 100, // Convert from cents
        currency: session.currency || 'usd',
        status: 'completed',
        stripe_payment_intent_id: session.payment_intent as string,
        description: 'Payment completed via Stripe Checkout',
        metadata: { session_id: session.id },
      })

      // Get conference email settings for this registration
      let emailSettings = undefined
      let conferenceName = undefined
      if (registration?.conference_id) {
        const { data: conference } = await supabase
          .from('conferences')
          .select('email_settings, name')
          .eq('id', registration.conference_id)
          .single()
        
        if (conference?.email_settings) {
          emailSettings = conference.email_settings
        }
        if (conference?.name) {
          conferenceName = conference.name
        }
      }

      // Send payment confirmation email
      if (registration) {
        const contact = extractRegistrationContact(registration)

        sendPaymentConfirmation(
          registration.id,
          contact.email,
          contact.firstName,
          contact.lastName,
          registration.invoice_url || undefined,
          emailSettings
        ).catch((err) => {
          log.error('Failed to send payment confirmation email', err instanceof Error ? err : undefined, {
            registrationId,
            email: contact.email,
            action: 'payment_confirmation_email',
          })
        })

        // Send notification to conference team (if reply_to email is configured)
        if (emailSettings?.reply_to) {
          try {
            const { sendConferenceTeamNotification } = await import('@/lib/email')
            const amount = (session.amount_total || 0) / 100
            const currency = session.currency?.toUpperCase() || 'EUR'
            
            await sendConferenceTeamNotification({
              to: emailSettings.reply_to,
              subject: `✅ Payment Received: ${conferenceName || 'Conference'}`,
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                      .field { margin-bottom: 15px; }
                      .label { font-weight: bold; color: #4b5563; display: block; margin-bottom: 5px; }
                      .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
                      .amount { font-size: 24px; font-weight: bold; color: #10b981; }
                      .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1 style="margin: 0;">✅ Payment Received</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">A payment has been successfully processed</p>
                      </div>
                      <div class="content">
                        <div class="field">
                          <span class="label">Conference:</span>
                          <div class="value">${conferenceName || 'N/A'}</div>
                        </div>
                        <div class="field">
                          <span class="label">Participant:</span>
                          <div class="value">${contact.fullName}</div>
                        </div>
                        <div class="field">
                          <span class="label">Email:</span>
                          <div class="value">${contact.email}</div>
                        </div>
                        <div class="field">
                          <span class="label">Registration ID:</span>
                          <div class="value">${registration.id}</div>
                        </div>
                        <div class="field">
                          <span class="label">Amount:</span>
                          <div class="value amount">${amount} ${currency}</div>
                        </div>
                        <div style="text-align: center; margin-top: 20px;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/registrations" class="button">
                            View Registration →
                          </a>
                        </div>
                      </div>
                    </div>
                  </body>
                </html>
              `,
              text: `
Payment Received

Conference: ${conferenceName || 'N/A'}
Participant: ${contact.fullName}
Email: ${contact.email}
Registration ID: ${registration.id}
Amount: ${amount} ${currency}

View in admin panel: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/registrations
              `,
              conferenceName: conferenceName,
            })
            log.info('Conference team notification sent for payment', {
              registrationId,
              conferenceId: registration.conference_id,
              notificationEmail: emailSettings.reply_to,
              amount,
              currency,
            })
          } catch (notificationError) {
            log.error('Failed to send conference team notification for payment', notificationError instanceof Error ? notificationError : undefined, {
              registrationId,
              conferenceId: registration.conference_id,
              action: 'team_notification_payment',
            })
            // Don't fail payment processing if notification fails
          }
        }
      }
    }
  }

  // Handle payment intent succeeded (for direct payments)
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const registrationId = paymentIntent.metadata?.registrationId

    if (registrationId) {
      try {
        // Get registration details (including conference_id)
        const { data: registration, error: regError } = await supabase
          .from('registrations')
          .select('*, conference_id')
          .eq('id', registrationId)
          .single()

        if (regError || !registration) {
          log.error('Registration not found for payment intent', regError, {
            registrationId,
            paymentIntentId: paymentIntent.id,
            eventType: 'payment_intent.succeeded',
          })
          return NextResponse.json(
            { error: 'Registration not found' },
            { status: 404 }
          )
        }

        // Idempotency guard: the client-side /api/confirm-payment call may already
        // have processed this payment (created the invoice, updated the status)
        // before this webhook arrives. Avoid creating a second Stripe invoice /
        // duplicate payment_history entry / duplicate confirmation email.
        if (registration.payment_status === 'paid' && registration.invoice_id) {
          log.info('Payment already confirmed (likely by client), skipping duplicate invoice', {
            registrationId,
            paymentIntentId: paymentIntent.id,
            action: 'webhook_payment_intent_idempotent',
          })
          return NextResponse.json({ received: true })
        }

        const contact = extractRegistrationContact(registration)

        // Create or retrieve customer
        const customers = await stripe.customers.list({
          email: contact.email,
          limit: 1,
        })

        let customerId: string
        if (customers.data.length > 0) {
          customerId = customers.data[0].id
        } else {
          const customer = await stripe.customers.create({
            email: contact.email,
            name: contact.fullName,
            metadata: {
              registrationId,
            },
          })
          customerId = customer.id
        }

        // Create invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: 'charge_automatically',
          auto_advance: false,
          metadata: {
            registrationId,
            paymentIntentId: paymentIntent.id,
          },
        })

        // Add invoice item
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          description: 'Conference Registration Fee',
        })

        // Finalize invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(
          invoice.id
        )

        const invoiceId = finalizedInvoice.id
        const invoiceUrl =
          finalizedInvoice.hosted_invoice_url ||
          finalizedInvoice.invoice_pdf ||
          null

        // Update registration with payment status and invoice info
        const { error: updateError } = await supabase
          .from('registrations')
          .update({
            payment_status: 'paid',
            payment_method: 'card',
            payment_amount: paymentIntent.amount / 100,
            payment_currency: paymentIntent.currency.toUpperCase(),
            invoice_id: invoiceId,
            invoice_url: invoiceUrl,
          })
          .eq('id', registrationId)

        if (updateError) {
          log.error('Failed to update registration', updateError, {
            registrationId,
            paymentIntentId: paymentIntent.id,
            eventType: 'payment_intent.succeeded',
          })
          return NextResponse.json(
            { error: 'Failed to update registration' },
            { status: 500 }
          )
        }

        // Create payment history entry
        await supabase.from('payment_history').insert({
          registration_id: registrationId,
          transaction_type: 'payment',
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency,
          status: 'completed',
          stripe_payment_intent_id: paymentIntent.id,
          description: `Payment completed - Invoice ${finalizedInvoice.number || invoiceId}`,
          metadata: { invoice_id: invoiceId, payment_intent_id: paymentIntent.id },
        })

        // Get conference email settings for this registration
        let emailSettings = undefined
        let conferenceName = undefined
        if (registration?.conference_id) {
          const { data: conference } = await supabase
            .from('conferences')
            .select('email_settings, name')
            .eq('id', registration.conference_id)
            .single()
          
          if (conference?.email_settings) {
            emailSettings = conference.email_settings
          }
          if (conference?.name) {
            conferenceName = conference.name
          }
        }

        // Send payment confirmation email
        sendPaymentConfirmation(
          registration.id,
          contact.email,
          contact.firstName,
          contact.lastName,
          invoiceUrl || undefined,
          emailSettings
        ).catch((err) => {
          log.error('Failed to send payment confirmation email', err, {
            registrationId,
            email: contact.email,
            eventType: 'payment_intent.succeeded',
          })
        })

        // Send notification to conference team (if reply_to email is configured)
        if (emailSettings?.reply_to) {
          try {
            const { sendConferenceTeamNotification } = await import('@/lib/email')
            const amount = paymentIntent.amount / 100
            const currency = paymentIntent.currency?.toUpperCase() || 'EUR'
            
            await sendConferenceTeamNotification({
              to: emailSettings.reply_to,
              subject: `✅ Payment Received: ${conferenceName || 'Conference'}`,
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                      .field { margin-bottom: 15px; }
                      .label { font-weight: bold; color: #4b5563; display: block; margin-bottom: 5px; }
                      .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
                      .amount { font-size: 24px; font-weight: bold; color: #10b981; }
                      .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1 style="margin: 0;">✅ Payment Received</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">A payment has been successfully processed</p>
                      </div>
                      <div class="content">
                        <div class="field">
                          <span class="label">Conference:</span>
                          <div class="value">${conferenceName || 'N/A'}</div>
                        </div>
                        <div class="field">
                          <span class="label">Participant:</span>
                          <div class="value">${contact.fullName}</div>
                        </div>
                        <div class="field">
                          <span class="label">Email:</span>
                          <div class="value">${contact.email}</div>
                        </div>
                        <div class="field">
                          <span class="label">Registration ID:</span>
                          <div class="value">${registration.id}</div>
                        </div>
                        <div class="field">
                          <span class="label">Amount:</span>
                          <div class="value amount">${amount} ${currency}</div>
                        </div>
                        ${invoiceUrl ? `
                        <div class="field">
                          <span class="label">Invoice:</span>
                          <div class="value"><a href="${invoiceUrl}" target="_blank">View Invoice</a></div>
                        </div>
                        ` : ''}
                        <div style="text-align: center; margin-top: 20px;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/registrations" class="button">
                            View Registration →
                          </a>
                        </div>
                      </div>
                    </div>
                  </body>
                </html>
              `,
              text: `
Payment Received

Conference: ${conferenceName || 'N/A'}
Participant: ${contact.fullName}
Email: ${contact.email}
Registration ID: ${registration.id}
Amount: ${amount} ${currency}
${invoiceUrl ? `Invoice: ${invoiceUrl}` : ''}

View in admin panel: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/registrations
              `,
              conferenceName: conferenceName,
            })
            log.info('Conference team notification sent for payment', {
              registrationId,
              conferenceId: registration.conference_id,
              notificationEmail: emailSettings.reply_to,
              amount,
              currency,
            })
          } catch (notificationError) {
            log.error('Failed to send conference team notification for payment', notificationError instanceof Error ? notificationError : undefined, {
              registrationId,
              conferenceId: registration.conference_id,
              action: 'team_notification_payment',
            })
            // Don't fail payment processing if notification fails
          }
        }
      } catch (invoiceError) {
        log.error('Error creating invoice', invoiceError, {
          registrationId,
          paymentIntentId: paymentIntent.id,
          eventType: 'payment_intent.succeeded',
        })
        // Still update payment status even if invoice creation fails
        await supabase
          .from('registrations')
          .update({
            payment_status: 'paid',
            payment_method: 'card',
            payment_amount: paymentIntent.amount / 100,
            payment_currency: paymentIntent.currency.toUpperCase(),
          })
          .eq('id', registrationId)
      }
    }
  }

  return NextResponse.json({ received: true })
}

/**
 * Handle self-service subscription checkout (from /subscribe → Stripe Checkout).
 */
async function handleSelfServiceOrderPayment(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createAdminClient>
) {
  try {
    const orderId = session.metadata!.order_id
    const planId = session.metadata!.plan_id
    const billingCycle = session.metadata!.billing_cycle as 'monthly' | 'yearly'
    const customerEmail = session.metadata!.customer_email
    const customerName = session.metadata!.customer_name
    const organization = session.metadata!.organization || null

    const { data: order, error: orderError } = await supabase
      .from('subscription_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      log.error('Subscription order not found', orderError, { orderId })
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'paid') {
      const existingAccount = await resolveOrganizerAccount({
        authAdmin: supabase.auth.admin,
        profiles: supabase,
        email: customerEmail,
        fullName: customerName,
        organization,
      })
      const activationEmailSent = existingAccount.ok
        ? await deliverOrganizerActivation({
            email: customerEmail,
            fullName: customerName,
            activationUrl: existingAccount.activationUrl,
          })
        : false

      if (activationEmailSent === false) {
        return NextResponse.json(
          {
            error: 'Subscription is already paid, but the activation email could not be sent',
            alreadyPaid: true,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        received: true,
        alreadyPaid: true,
        activation_email_sent: activationEmailSent,
      })
    }

    const provisioned = await provisionConferenceAdmin({
      supabase,
      email: customerEmail,
      fullName: customerName,
      organization,
      planId,
      billingCycle,
      price: (session.amount_total || 0) / 100,
      currency: session.currency?.toUpperCase() || 'EUR',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
      inquiryId: null,
    })

    if (!provisioned.ok) {
      return NextResponse.json({ error: provisioned.error }, { status: 500 })
    }

    await supabase
      .from('subscription_orders')
      .update({
        status: 'paid',
        user_id: provisioned.userId,
        subscription_id: provisioned.subscriptionId,
      })
      .eq('id', orderId)

    log.info('Self-service subscription order paid', {
      orderId,
      userId: provisioned.userId,
      subscriptionId: provisioned.subscriptionId,
    })

    if (provisioned.activationEmailSent === false) {
      log.error('Self-service subscription saved but activation email failed', undefined, {
        orderId,
        userId: provisioned.userId,
        action: 'organizer_activation_email',
      })
      return NextResponse.json(
        { error: 'Subscription saved, but the activation email could not be sent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      received: true,
      subscriptionId: provisioned.subscriptionId,
      activation_email_sent: provisioned.activationEmailSent,
    })
  } catch (error) {
    log.error('Error handling self-service order payment', error, {
      sessionId: session.id,
    })
    return NextResponse.json(
      { error: 'Failed to process subscription payment' },
      { status: 500 }
    )
  }
}

async function findExistingSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    stripePaymentIntentId?: string | null
    stripeInvoiceId?: string | null
  }
): Promise<{ id: string; user_id: string } | null> {
  const lookups: Array<['stripe_payment_intent_id' | 'stripe_invoice_id', string]> = []
  if (params.stripePaymentIntentId) {
    lookups.push(['stripe_payment_intent_id', params.stripePaymentIntentId])
  }
  if (params.stripeInvoiceId) {
    lookups.push(['stripe_invoice_id', params.stripeInvoiceId])
  }

  for (const [column, value] of lookups) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, user_id')
      .eq(column, value)
      .maybeSingle()
    if (data?.id && data.user_id) {
      return { id: data.id, user_id: data.user_id }
    }
  }

  return null
}

async function provisionConferenceAdmin(params: {
  supabase: ReturnType<typeof createAdminClient>
  email: string
  fullName: string
  organization: string | null
  planId: string
  billingCycle: 'monthly' | 'yearly'
  price: number
  currency: string
  stripeCustomerId?: string | null
  stripePaymentIntentId?: string | null
  stripeSubscriptionId?: string | null
  stripeInvoiceId?: string | null
  inquiryId?: string | null
}): Promise<
  | {
      ok: true
      userId: string
      subscriptionId: string
      activationEmailSent: boolean | null
    }
  | { ok: false; error: string }
> {
  const {
    supabase,
    email,
    fullName,
    organization,
    planId,
    billingCycle,
    price,
    currency,
    stripeCustomerId,
    stripePaymentIntentId,
    stripeSubscriptionId,
    stripeInvoiceId,
    inquiryId,
  } = params

  const account = await resolveOrganizerAccount({
    authAdmin: supabase.auth.admin,
    profiles: supabase,
    email,
    fullName,
    organization,
  })

  if (!account.ok) {
    log.error('Failed to prepare organizer account', undefined, { email })
    return { ok: false, error: account.error }
  }

  if (!account.profileExists) {
    const { error: profileError } = await supabase.from('user_profiles').insert({
      id: account.userId,
      email,
      full_name: fullName,
      role: 'conference_admin',
      active: true,
      organization,
    })

    if (profileError) {
      log.error('Failed to create user profile', profileError, {
        userId: account.userId,
        email,
      })
      if (account.created) {
        await supabase.auth.admin.deleteUser(account.userId)
      }
      return { ok: false, error: 'Failed to create user profile' }
    }
  }

  const existingSubscription = await findExistingSubscription(supabase, {
    stripePaymentIntentId,
    stripeInvoiceId,
  })

  let subscriptionId = existingSubscription?.id
  const userId = existingSubscription?.user_id || account.userId

  if (!subscriptionId) {
    const startsAt = new Date()
    const expiresAt = new Date()
    if (billingCycle === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        inquiry_id: inquiryId || null,
        status: 'active',
        billing_cycle: billingCycle,
        price,
        currency,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        stripe_payment_intent_id: stripePaymentIntentId || null,
        stripe_invoice_id: stripeInvoiceId || null,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (subError || !subscription) {
      log.error('Failed to create subscription', subError, { userId, planId })
      return { ok: false, error: 'Failed to create subscription' }
    }

    if (!subscription.id) {
      return { ok: false, error: 'Failed to create subscription' }
    }
    subscriptionId = subscription.id
  }

  if (!subscriptionId) {
    return { ok: false, error: 'Failed to create subscription' }
  }

  const activationEmailSent = await deliverOrganizerActivation({
    email,
    fullName,
    activationUrl: account.activationUrl,
  })

  return {
    ok: true,
    userId,
    subscriptionId,
    activationEmailSent,
  }
}

/**
 * Handle subscription payment from Payment Link
 * Auto-creates Conference Admin user and sends credentials
 */
async function handleSubscriptionPayment(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createAdminClient>
) {
  try {
    const inquiryId = session.metadata!.inquiry_id
    const planId = session.metadata!.plan_id
    const billingCycle = session.metadata!.billing_cycle as 'monthly' | 'yearly'
    const customerEmail = session.metadata!.customer_email
    const customerName = session.metadata!.customer_name
    const organization = session.metadata!.organization

    log.info('Processing subscription payment', {
      inquiryId,
      planId,
      customerEmail,
      sessionId: session.id,
    })

    // Get inquiry details
    const { data: inquiry, error: inquiryError } = await supabase
      .from('contact_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single()

    if (inquiryError || !inquiry) {
      log.error('Inquiry not found for subscription payment', inquiryError, {
        inquiryId,
        sessionId: session.id,
      })
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    }

    const provisioned = await provisionConferenceAdmin({
      supabase,
      email: customerEmail,
      fullName: customerName,
      organization: organization || null,
      planId,
      billingCycle,
      price: (session.amount_total || 0) / 100,
      currency: session.currency?.toUpperCase() || 'EUR',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : null,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripeInvoiceId: typeof session.invoice === 'string' ? session.invoice : null,
      inquiryId,
    })

    if (!provisioned.ok) {
      return NextResponse.json({ error: provisioned.error }, { status: 500 })
    }

    const userId = provisioned.userId
    const subscription = { id: provisioned.subscriptionId }

    // Update payment offer status
    await supabase
      .from('payment_offers')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('inquiry_id', inquiryId)
      .eq('status', 'sent')

    // Mark inquiry as converted
    await supabase
      .from('contact_inquiries')
      .update({
        status: 'converted',
        converted: true,
        converted_at: new Date().toISOString(),
      })
      .eq('id', inquiryId)

    log.info('Subscription created successfully', {
      subscriptionId: subscription.id,
      userId,
      inquiryId,
      planId,
    })

    if (provisioned.activationEmailSent === false) {
      return NextResponse.json(
        { error: 'Subscription saved, but the activation email could not be sent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      received: true,
      subscriptionId: subscription.id,
      activation_email_sent: provisioned.activationEmailSent,
    })
  } catch (error) {
    log.error('Error handling subscription payment', error, {
      sessionId: session.id,
    })
    return NextResponse.json({ error: 'Failed to process subscription payment' }, { status: 500 })
  }
}

/**
 * Extract name/email from a registration row, falling back to custom_data
 * when the legacy first_name/last_name/email columns are null.
 */
function extractRegistrationContact(registration: Record<string, any>): {
  email: string
  firstName: string
  lastName: string
  fullName: string
} {
  const customData = registration.custom_data || {}
  const firstParticipantFields =
    Array.isArray(registration.participants) && registration.participants.length > 0
      ? (registration.participants[0]?.customFields ?? {})
      : {}

  const email =
    registration.email ||
    customData.email ||
    firstParticipantFields.email ||
    ''

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

  const fullName = `${firstName} ${lastName}`.trim() || email

  return { email, firstName, lastName, fullName }
}
