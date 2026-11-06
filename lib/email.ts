/**
 * Email helper functions for sending different types of emails
 * Uses Supabase Edge Function: send-confirmation-email
 */

import { log } from './logger'
import { EmailSettings } from '@/types/conference'

type EmailType =
  | 'registration_confirmation'
  | 'payment_confirmation'
  | 'payment_reminder'
  | 'pre_conference_reminder'
  | 'event_details'
  | 'certificate'
  | 'subscription_welcome'
  | 'payment_offer'
  | 'abstract_submission_confirmation'

interface SendEmailParams {
  emailType: EmailType
  registrationId?: string
  email: string
  firstName?: string
  lastName?: string
  paymentUrl?: string
  invoiceUrl?: string
  certificateUrl?: string
  conferenceDate?: string
  conferenceLocation?: string
  conferenceProgram?: string
  customMessage?: string
  /** Sažetak prijave za e-mail potvrde (HTML ili plain text) – sudionik vidi što je ispunio */
  registrationSummary?: string
  /** Jezik e-maila: 'hr' ili 'en' (za potvrdu prijave) */
  locale?: 'hr' | 'en'
  // Subscription-related
  loginUrl?: string
  planName?: string
  paymentLinkUrl?: string
  // Abstract
  abstractId?: string
  fileName?: string
  conferenceName?: string
  // Conference email settings (optional - falls back to default if not provided)
  emailSettings?: EmailSettings
}

/**
 * Send email using Supabase Edge Function
 * This function should be called from server-side code (API routes)
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    log.error('Supabase URL or Service Role Key not configured', undefined, {
      function: 'sendEmail',
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceRoleKey,
    })
    return
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-confirmation-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(params),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      log.error('Failed to send email', new Error(error), {
        emailType: params.emailType,
        email: params.email,
        function: 'sendEmail',
      })
      throw new Error(`Failed to send email: ${error}`)
    }

    const result = await response.json()
    log.info('Email sent successfully', {
      emailType: params.emailType,
      email: params.email,
      messageId: result.messageId,
    })
  } catch (error) {
    log.error('Error sending email', error, {
      emailType: params.emailType,
      email: params.email,
      function: 'sendEmail',
    })
    throw error
  }
}

/**
 * Send generic email (for contact forms, notifications, etc.)
 */
export async function sendGenericEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    log.warn('RESEND_API_KEY not configured - email will not be sent', {
      to: params.to,
      subject: params.subject,
      function: 'sendGenericEmail',
    })
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'MeetFlow <noreply@meetflow.app>',
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      log.error('Failed to send generic email', new Error(error), {
        to: params.to,
        subject: params.subject,
        function: 'sendGenericEmail',
        status: response.status,
      })
      throw new Error(`Failed to send email: ${error}`)
    }

    const result = await response.json()
    log.info('Generic email sent successfully', {
      to: params.to,
      subject: params.subject,
      messageId: result.id,
      function: 'sendGenericEmail',
    })
  } catch (error) {
    log.error('Error sending generic email', error, {
      to: params.to,
      subject: params.subject,
      function: 'sendGenericEmail',
    })
    throw error
  }
}

/**
 * sent: the email provider accepted the message and returned an id.
 * That is not proof the message reached an inbox.
 * failed: the application knows the message was not accepted.
 * unknown: the outcome could not be confirmed. Do not send again.
 */
export type EmailDeliveryStatus = 'sent' | 'failed' | 'unknown'

function messageIdFromResult(result: unknown): string {
  if (!result || typeof result !== 'object' || !('messageId' in result)) return ''
  const messageId = (result as { messageId?: unknown }).messageId
  return typeof messageId === 'string' ? messageId.trim() : ''
}

/**
 * Send one registration confirmation. Returns the delivery outcome and does not retry.
 */
export async function sendRegistrationConfirmation(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  paymentUrl?: string,
  emailSettings?: EmailSettings,
  registrationSummary?: string,
  locale?: 'hr' | 'en'
): Promise<EmailDeliveryStatus> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    log.error(
      'Registration confirmation email was not sent because email delivery is not configured',
      undefined,
      {
        function: 'sendRegistrationConfirmation',
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
      }
    )
    return 'failed'
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        emailType: 'registration_confirmation',
        registrationId,
        email,
        firstName,
        lastName,
        paymentUrl,
        emailSettings,
        registrationSummary,
        locale,
      }),
    })

    if (!response.ok) {
      log.error('Registration confirmation email was rejected', undefined, {
        function: 'sendRegistrationConfirmation',
        status: response.status,
      })
      return 'failed'
    }

    let messageId = ''
    try {
      messageId = messageIdFromResult(await response.json())
    } catch (error) {
      log.warn('Registration confirmation response could not be read', {
        function: 'sendRegistrationConfirmation',
        error,
      })
      return 'unknown'
    }

    if (!messageId) {
      log.warn('Registration confirmation response did not include a message id', {
        function: 'sendRegistrationConfirmation',
      })
      return 'unknown'
    }

    log.info('Registration confirmation accepted by the email provider', {
      function: 'sendRegistrationConfirmation',
      messageId,
    })
    return 'sent'
  } catch (error) {
    log.error('Registration confirmation email outcome is unknown', error, {
      function: 'sendRegistrationConfirmation',
    })
    return 'unknown'
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmation(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  invoiceUrl?: string,
  emailSettings?: EmailSettings
): Promise<void> {
  return sendEmail({
    emailType: 'payment_confirmation',
    registrationId,
    email,
    firstName,
    lastName,
    invoiceUrl,
    emailSettings,
  })
}

/**
 * Send payment reminder email
 */
export async function sendPaymentReminder(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  paymentUrl?: string,
  customMessage?: string,
  emailSettings?: EmailSettings
): Promise<void> {
  return sendEmail({
    emailType: 'payment_reminder',
    registrationId,
    email,
    firstName,
    lastName,
    paymentUrl,
    customMessage,
    emailSettings,
  })
}

/**
 * Send pre-conference reminder email
 */
export async function sendPreConferenceReminder(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  conferenceDate?: string,
  conferenceLocation?: string,
  conferenceProgram?: string,
  customMessage?: string,
  emailSettings?: EmailSettings
): Promise<void> {
  return sendEmail({
    emailType: 'pre_conference_reminder',
    registrationId,
    email,
    firstName,
    lastName,
    conferenceDate,
    conferenceLocation,
    conferenceProgram,
    customMessage,
    emailSettings,
  })
}

/**
 * Send event details email
 */
export async function sendEventDetails(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  conferenceDate?: string,
  conferenceLocation?: string,
  conferenceProgram?: string,
  customMessage?: string,
  emailSettings?: EmailSettings
): Promise<void> {
  return sendEmail({
    emailType: 'event_details',
    registrationId,
    email,
    firstName,
    lastName,
    conferenceDate,
    conferenceLocation,
    conferenceProgram,
    customMessage,
    emailSettings,
  })
}

/**
 * Send certificate email
 */
export async function sendCertificate(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  certificateUrl: string,
  customMessage?: string,
  emailSettings?: EmailSettings
): Promise<void> {
  return sendEmail({
    emailType: 'certificate',
    registrationId,
    email,
    firstName,
    lastName,
    certificateUrl,
    customMessage,
    emailSettings,
  })
}

/**
 * Confirm abstract submission to the author
 */
export async function sendAbstractSubmissionConfirmation(params: {
  email: string
  abstractId: string
  fileName?: string
  conferenceName: string
  emailSettings?: EmailSettings
  customMessage?: string
}): Promise<void> {
  return sendEmail({
    emailType: 'abstract_submission_confirmation',
    email: params.email,
    abstractId: params.abstractId,
    fileName: params.fileName,
    conferenceName: params.conferenceName,
    emailSettings: params.emailSettings,
    customMessage: params.customMessage,
  })
}

const ABSTRACT_DECISION_COPY = {
  accepted: {
    accent: '#059669',
    heading: 'Abstract Accepted',
    subject: (conference: string) => `Abstract accepted — ${conference}`,
    body: 'We are pleased to inform you that your abstract has been accepted.',
  },
  rejected: {
    accent: '#4b5563',
    heading: 'Abstract Decision',
    subject: (conference: string) => `Abstract decision — ${conference}`,
    body: 'Thank you for your submission. After review, we are unable to accept your abstract for this conference.',
  },
  revise: {
    accent: '#d97706',
    heading: 'Revision Requested',
    subject: (conference: string) => `Revision requested — ${conference}`,
    body: 'The reviewers ask for a revision of your abstract before a final decision can be made. Please review the notes below and send an updated version.',
  },
} as const

/**
 * Notify author of abstract accept / reject / revise decision
 */
export async function sendAbstractDecisionEmail(params: {
  email: string
  conferenceName: string
  status: 'accepted' | 'rejected' | 'revise'
  fileName?: string
  title?: string
  notes?: string
  /** One-time link to upload a corrected file (revise status only). */
  reviseUrl?: string
  emailSettings?: EmailSettings
}): Promise<void> {
  const copy = ABSTRACT_DECISION_COPY[params.status]

  const notesHtml = params.notes
    ? `<p style="font-size:16px;margin:20px 0;"><strong>Note from organizers:</strong> ${params.notes}</p>`
    : ''

  const reviseHtml =
    params.status === 'revise' && params.reviseUrl
      ? `<p style="font-size:16px;margin:20px 0;">Please update your abstract text using the secure link below. This link is private — do not share it.</p>
         <p style="margin:24px 0 0;"><a href="${params.reviseUrl}" style="display:inline-block;padding:12px 24px;background:${copy.accent};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Submit revised abstract</a></p>
         <p style="font-size:13px;color:#6b7280;margin:12px 0 0;">${params.reviseUrl}</p>`
      : ''

  await sendGenericEmail({
    to: params.email,
    subject: copy.subject(params.conferenceName),
    html: `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:${copy.accent};padding:24px;text-align:center;border-radius:10px 10px 0 0;">
          <h1 style="color:white;margin:0;font-size:24px;">${copy.heading}</h1>
        </div>
        <div style="background:white;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
          <p style="font-size:16px;">${copy.body}</p>
          <p style="font-size:16px;"><strong>Conference:</strong> ${params.conferenceName}</p>
          ${params.title ? `<p style="font-size:16px;"><strong>Abstract:</strong> ${params.title}</p>` : ''}
          ${params.fileName ? `<p style="font-size:16px;"><strong>File:</strong> ${params.fileName}</p>` : ''}
          ${notesHtml}
          ${reviseHtml}
        </div>
      </body></html>
    `,
    text: `${copy.heading}\n\n${copy.body}\nConference: ${params.conferenceName}\n${params.title ? `Abstract: ${params.title}\n` : ''}${params.fileName ? `File: ${params.fileName}\n` : ''}${params.notes ? `\nNotes: ${params.notes}\n` : ''}${params.status === 'revise' && params.reviseUrl ? `\nSubmit your revision: ${params.reviseUrl}` : ''}`,
  })
}

/**
 * Remind a reviewer about abstracts still awaiting their review
 */
export async function sendReviewerReminderEmail(params: {
  email: string
  reviewerName?: string | null
  conferenceName: string
  pendingCount: number
  reviewUrl: string
}): Promise<void> {
  const greeting = params.reviewerName ? `Dear ${params.reviewerName},` : 'Hello,'

  await sendGenericEmail({
    to: params.email,
    subject: `Reminder: ${params.pendingCount} abstract(s) awaiting your review — ${params.conferenceName}`,
    html: `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#1e293b;padding:24px;text-align:center;border-radius:10px 10px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Review Reminder</h1>
        </div>
        <div style="background:white;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
          <p style="font-size:16px;">${greeting}</p>
          <p style="font-size:16px;">You have <strong>${params.pendingCount}</strong> abstract(s) awaiting your review for <strong>${params.conferenceName}</strong>.</p>
          <p style="margin:24px 0 0;"><a href="${params.reviewUrl}" style="display:inline-block;padding:12px 24px;background:#1e293b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Open reviewer portal</a></p>
        </div>
      </body></html>
    `,
    text: `${greeting}\n\nYou have ${params.pendingCount} abstract(s) awaiting your review for ${params.conferenceName}.\n\nOpen reviewer portal: ${params.reviewUrl}`,
  })
}


function escapeEmailText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sends a single-use organizer activation link. The message never includes a password.
 */
export async function sendOrganizerActivationEmail(params: {
  email: string
  fullName: string
  activationUrl: string
}): Promise<void> {
  const name = escapeEmailText(params.fullName.trim() || 'there')
  const activationUrl = escapeEmailText(params.activationUrl)

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Set your MeetFlow password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e293b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Set your MeetFlow password</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Hello ${name},</p>
          <p style="font-size: 16px;">
            An organizer account is ready for ${escapeEmailText(params.email)}. Use the link below to choose your own password.
          </p>
          <p style="margin: 28px 0; text-align: center;">
            <a href="${activationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e293b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Set password
            </a>
          </p>
          <p style="font-size: 14px; color: #4b5563;">
            This link can be used once and expires. If it expires, ask a super admin to send a new one.
          </p>
          <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${activationUrl}</p>
        </div>
      </body>
    </html>
  `

  const emailText = `Hello ${params.fullName.trim() || 'there'},

An organizer account is ready for ${params.email}. Choose your own password with this single-use link:

${params.activationUrl}

This link can be used once and expires. If it expires, ask a super admin to send a new one.
`

  await sendGenericEmail({
    to: params.email,
    subject: 'Set your MeetFlow organizer password',
    html: emailHtml,
    text: emailText,
  })
}

/**
 * Send payment offer email with Stripe Payment Link
 */
export async function sendPaymentOfferEmail(
  email: string,
  fullName: string,
  organization: string,
  planName: string,
  billingCycle: 'monthly' | 'yearly',
  price: number,
  currency: string,
  paymentLinkUrl: string
): Promise<void> {
  return sendEmail({
    emailType: 'payment_offer',
    email,
    firstName: fullName,
    planName,
    paymentLinkUrl,
    customMessage: `${planName} Plan - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} billing: ${price} ${currency}`,
  })
}

/**
 * Send notification email to conference team
 * Uses reply_to email from conference email settings
 */
export async function sendConferenceTeamNotification(params: {
  to: string // reply_to email from conference settings
  subject: string
  html: string
  text: string
  conferenceName?: string
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    log.warn('RESEND_API_KEY not configured - notification email will not be sent', {
      to: params.to,
      subject: params.subject,
      function: 'sendConferenceTeamNotification',
    })
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'MeetFlow <noreply@meetflow.app>',
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      log.error('Failed to send conference team notification', new Error(error), {
        to: params.to,
        subject: params.subject,
        function: 'sendConferenceTeamNotification',
        status: response.status,
      })
      throw new Error(`Failed to send notification: ${error}`)
    }

    const result = await response.json()
    log.info('Conference team notification sent successfully', {
      to: params.to,
      subject: params.subject,
      messageId: result.id,
      function: 'sendConferenceTeamNotification',
    })
  } catch (error) {
    log.error('Error sending conference team notification', error, {
      to: params.to,
      subject: params.subject,
      function: 'sendConferenceTeamNotification',
    })
    throw error
  }
}
