import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendGenericEmail } from '@/lib/email'
import { log } from '@/lib/logger'
import {
  contactRateLimit,
  getClientIP,
  checkRateLimit,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/conferences/[slug]/contact
 * Handle contact form submissions for a specific conference
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const clientIp = getClientIP(request)
    const rateLimitResult = await checkRateLimit(contactRateLimit, clientIp)
    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.', code: 'rate_limited' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    const body = await request.json()
    const {
      name,
      email,
      subject,
      message,
      conference_id,
      conference_slug,
      conference_name,
    } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, subject, and message are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Verify conference exists and is active
    const supabase = createAdminClient()
    const { data: conference, error: confError } = await supabase
      .from('conferences')
      .select('id, name, slug, published, active')
      .eq('slug', params.slug)
      .single()

    if (confError || !conference) {
      log.error('Conference not found for contact form', confError, {
        slug: params.slug,
        action: 'conference_contact_form',
      })
      return NextResponse.json(
        { error: 'Conference not found' },
        { status: 404 }
      )
    }

    if (!conference.published || !conference.active) {
      return NextResponse.json(
        { error: 'Conference is not available' },
        { status: 403 }
      )
    }

    // Get client IP and user agent for tracking
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Save to database (using contact_inquiries table)
    const { data: inquiry, error: dbError } = await supabase
      .from('contact_inquiries')
      .insert({
        name,
        email,
        organization: conference_name || conference.name || null,
        phone: null,
        conference_type: null,
        expected_attendees: null,
        service_type: null,
        message: `Subject: ${subject}\n\n${message}`,
        status: 'new',
        priority: 'medium',
        source: 'conference_page',
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (dbError) {
      log.error('Database error saving conference contact inquiry', dbError, {
        email,
        conferenceId: conference.id,
        action: 'conference_contact_form_save',
      })
      return NextResponse.json(
        { error: 'Failed to save inquiry' },
        { status: 500 }
      )
    }

    // Send notification email to admin
    try {
      await sendConferenceContactNotificationEmail({
        inquiry,
        conference: {
          name: conference_name || conference.name,
          slug: conference_slug || conference.slug,
        },
        subject,
      })
      log.info('Conference contact notification email sent', {
        inquiryId: inquiry.id,
        email,
        conferenceId: conference.id,
        action: 'conference_contact_notification',
      })
    } catch (emailError) {
      log.error('Failed to send notification email', emailError instanceof Error ? emailError : undefined, {
        inquiryId: inquiry.id,
        action: 'conference_contact_notification',
      })
      // Don't fail the request if email fails
    }

    // Send confirmation email to customer
    try {
      await sendConferenceContactConfirmationEmail({
        name,
        email,
        conferenceName: conference_name || conference.name,
        subject,
      })
      log.info('Conference contact confirmation email sent', {
        inquiryId: inquiry.id,
        email,
        action: 'conference_contact_confirmation',
      })
    } catch (emailError) {
      log.error('Failed to send confirmation email', emailError instanceof Error ? emailError : undefined, {
        inquiryId: inquiry.id,
        action: 'conference_contact_confirmation',
      })
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for your message! We will get back to you soon.',
      },
      { status: 201 }
    )
  } catch (error) {
    log.error('Conference contact form error', error instanceof Error ? error : undefined, {
      slug: params.slug,
      action: 'conference_contact_form_error',
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// Helper function to escape HTML
function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Helper function to escape text for plain text emails
function escapeText(text: string | null | undefined): string {
  if (!text) return ''
  return String(text).replace(/<[^>]*>/g, '')
}

// Send notification email to admin team
async function sendConferenceContactNotificationEmail({
  inquiry,
  conference,
  subject,
}: {
  inquiry: any
  conference: { name: string; slug: string }
  subject: string
}) {
  const emailSubject = `📧 New Contact: ${escapeText(conference.name)} - ${escapeText(subject)}`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .field { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; display: block; margin-bottom: 5px; }
          .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📧 New Conference Contact</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Someone contacted you through a conference page</p>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Conference:</span>
              <div class="value">${escapeHtml(conference.name)}</div>
            </div>

            <div class="field">
              <span class="label">Subject:</span>
              <div class="value">${escapeHtml(subject)}</div>
            </div>

            <div class="field">
              <span class="label">From:</span>
              <div class="value">${escapeHtml(inquiry.name)}</div>
            </div>

            <div class="field">
              <span class="label">Email:</span>
              <div class="value"><a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a></div>
            </div>

            <div class="field">
              <span class="label">Message:</span>
              <div class="value" style="white-space: pre-wrap;">${escapeHtml(inquiry.message)}</div>
            </div>

            <div class="field">
              <span class="label">Submitted:</span>
              <div class="value">${inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : 'N/A'}</div>
            </div>

            <div style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/inquiries" class="button">
                View in Admin Panel →
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from MeetFlow</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
New Conference Contact Received

Conference: ${escapeText(conference.name)}
Subject: ${escapeText(subject)}
From: ${escapeText(inquiry.name)}
Email: ${escapeText(inquiry.email)}

Message:
${escapeText(inquiry.message)}

Submitted: ${inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : 'N/A'}

View in admin panel: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/inquiries
  `

  const adminEmail = process.env.ADMIN_EMAIL || 'screatives.info@gmail.com'
  
  await sendGenericEmail({
    to: adminEmail,
    subject: emailSubject,
    html,
    text,
  })
}

// Send confirmation email to customer
async function sendConferenceContactConfirmationEmail({
  name,
  email,
  conferenceName,
  subject,
}: {
  name: string
  email: string
  conferenceName: string
  subject: string
}) {
  const emailSubject = `Thank you for contacting ${conferenceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .highlight { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 32px;">✅ Message Received</h1>
            <p style="margin: 15px 0 0 0; opacity: 0.95; font-size: 16px;">Thank you for contacting us</p>
          </div>
          <div class="content">
            <p>Dear ${escapeHtml(name)},</p>
            
            <p>Thank you for reaching out regarding <strong>${escapeHtml(conferenceName)}</strong>!</p>

            <div class="highlight">
              <p style="margin: 0; font-weight: bold;">⏱️ What happens next?</p>
              <p style="margin: 10px 0 0 0;">We have received your message about "<strong>${escapeHtml(subject)}</strong>" and will get back to you as soon as possible.</p>
            </div>

            <p>If you have any urgent questions, feel free to reply to this email.</p>

            <p style="margin-top: 30px;">Best regards,<br><strong>The ${escapeHtml(conferenceName)} Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated confirmation email</p>
            <p>MeetFlow - Modern Conference Management Platform</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Dear ${escapeText(name)},

Thank you for reaching out regarding ${escapeText(conferenceName)}!

What happens next?
We have received your message about "${escapeText(subject)}" and will get back to you as soon as possible.

If you have any urgent questions, feel free to reply to this email.

Best regards,
The ${escapeText(conferenceName)} Team

---
MeetFlow - Modern Conference Management Platform
  `

  await sendGenericEmail({
    to: email,
    subject: emailSubject,
    html,
    text,
  })
}
