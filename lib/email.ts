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
  tempPassword?: string
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


/**
 * Send welcome email with login credentials (for new Conference Admin users)
 * Used for subscription payments (auto-created accounts)
 */
export async function sendWelcomeEmail(
  email: string,
  fullName: string,
  tempPassword: string,
  planName: string
): Promise<void> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/admin-login`
  
  return sendEmail({
    emailType: 'subscription_welcome',
    email,
    firstName: fullName,
    tempPassword,
    planName,
    loginUrl,
  })
}

/**
 * Send admin welcome email with login credentials (for manually created Conference Admin accounts)
 * This uses sendGenericEmail directly (Resend API) for better control and simpler implementation
 */
export async function sendAdminWelcomeEmail(
  email: string,
  fullName: string,
  password: string
): Promise<void> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/admin-login`
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MeetFlow</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to MeetFlow! 🎉</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${fullName},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">
            Your Conference Admin account has been successfully created! You can now access the MeetFlow dashboard to manage your conferences.
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Your Login Credentials:</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Access Dashboard
            </a>
          </div>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⚠️ Security Note:</strong> Please change your password after your first login for security purposes.
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 30px;">
            If you have any questions or need assistance, please don't hesitate to contact us.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #6b7280; margin: 0;">
            Best regards,<br>
            MeetFlow Team
          </p>
        </div>
      </body>
    </html>
  `
  
  const emailText = `
Welcome to MeetFlow!

Dear ${fullName},

Your Conference Admin account has been successfully created! You can now access the MeetFlow dashboard to manage your conferences.

Your Login Credentials:
Email: ${email}
Password: ${password}

Access Dashboard: ${loginUrl}

⚠️ Security Note: Please change your password after your first login for security purposes.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
MeetFlow Team
  `
  
  return sendGenericEmail({
    to: email,
    subject: 'Welcome to MeetFlow - Your Conference Admin Account is Ready',
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
