import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendGenericEmail } from '@/lib/email'
import { getMobilePhoneIssue, normalizeMobilePhone } from '@/lib/mobile-phone'
import { log } from '@/lib/logger'
import {
  contactRateLimit,
  getClientIP,
  checkRateLimit,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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
      organization,
      phone,
      conferenceType,
      expectedAttendees,
      serviceType,
      message,
    } = body

    // Validate required fields
    if (!name || !email || !organization || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    const rawPhone = typeof phone === 'string' ? phone : ''
    const phoneIssue = getMobilePhoneIssue(rawPhone)
    if (phoneIssue === 'missing_country') {
      return NextResponse.json(
        {
          error: 'Mobile number is missing + and the country calling code',
          code: 'missing_country',
        },
        { status: 400 }
      )
    }
    if (phoneIssue) {
      return NextResponse.json(
        { error: 'Invalid mobile number', code: 'invalid_mobile' },
        { status: 400 }
      )
    }
    const normalizedPhone = normalizeMobilePhone(rawPhone)

    // Get client IP and user agent for tracking
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Public/anonymous endpoint - contact_inquiries SELECT is super_admin-only
    // (migration 056), so insert().select() needs the service role client to
    // read back the inserted row.
    const supabase = createAdminClient()

    // Save to database
    const { data: inquiry, error: dbError } = await supabase
      .from('contact_inquiries')
      .insert({
        name,
        email,
        organization,
        phone: normalizedPhone || null,
        conference_type: conferenceType || null,
        expected_attendees: expectedAttendees || null,
        service_type: serviceType || null,
        message,
        status: 'new',
        priority: determinePriority(expectedAttendees, conferenceType),
        source: 'website',
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (dbError) {
      log.error('Database error saving contact inquiry', dbError instanceof Error ? dbError : undefined, {
        email,
        organization,
        action: 'contact_inquiry_save',
      })
      return NextResponse.json(
        { error: 'Failed to save inquiry' },
        { status: 500 }
      )
    }

    // Send notification email to admin
    try {
      const notification = await sendInquiryNotificationEmail(inquiry)
      log.info('Contact inquiry notification email sent', {
        inquiryId: inquiry.id,
        email,
        messageId: notification.id,
        action: 'contact_inquiry_notification',
      })
    } catch (emailError) {
      log.error('Failed to send notification email', emailError instanceof Error ? emailError : undefined, {
        inquiryId: inquiry.id,
        action: 'contact_inquiry_notification',
      })
      // Don't fail the request if email fails
    }

    // Send confirmation email to customer
    try {
      const confirmation = await sendCustomerConfirmationEmail(inquiry)
      log.info('Contact inquiry confirmation email sent', {
        inquiryId: inquiry.id,
        email,
        messageId: confirmation.id,
        action: 'contact_inquiry_confirmation',
      })
    } catch (emailError) {
      log.error('Failed to send confirmation email', emailError instanceof Error ? emailError : undefined, {
        inquiryId: inquiry.id,
        action: 'contact_inquiry_confirmation',
      })
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for your inquiry! We will contact you within 24 hours.',
        inquiryId: inquiry.id,
      },
      { status: 201 }
    )
  } catch (error) {
    log.error('Contact form error', error instanceof Error ? error : undefined, {
      action: 'contact_inquiry_error',
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// Determine priority based on inquiry details
function determinePriority(expectedAttendees: string, conferenceType: string): string {
  // Large conferences get higher priority
  if (expectedAttendees === '500+' || expectedAttendees === '251-500') {
    return 'high'
  }
  
  // Hybrid conferences are complex, medium-high priority
  if (conferenceType === 'hybrid') {
    return 'high'
  }

  // Medium conferences
  if (expectedAttendees === '101-250') {
    return 'medium'
  }

  // Small conferences
  return 'medium'
}

// Escape HTML to prevent XSS in email templates
function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Escape text for plain text emails (remove HTML tags)
function escapeText(text: string | null | undefined): string {
  if (!text) return ''
  return String(text).replace(/<[^>]*>/g, '')
}

// Type for contact inquiry
interface ContactInquiry {
  id: string
  name: string
  email: string
  organization: string
  phone?: string | null
  conference_type?: string | null
  expected_attendees?: string | null
  service_type?: string | null
  message: string
  priority: string
  created_at?: string
}

// Send notification email to admin team
async function sendInquiryNotificationEmail(inquiry: ContactInquiry): Promise<{ id: string }> {
  const subject = `🔔 New Inquiry: ${escapeText(inquiry.organization)} - ${escapeText(inquiry.expected_attendees || 'Size not specified')}`
  
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
          .priority { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .priority-high { background: #fee2e2; color: #dc2626; }
          .priority-medium { background: #fef3c7; color: #d97706; }
          .priority-low { background: #dbeafe; color: #2563eb; }
          .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🎯 New Lead Inquiry</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">A potential client has submitted a contact inquiry</p>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Priority:</span>
              <span class="priority priority-${escapeHtml(inquiry.priority || 'medium')}">${escapeHtml((inquiry.priority || 'medium').toUpperCase())}</span>
            </div>

            <div class="field">
              <span class="label">Contact Person:</span>
              <div class="value">${escapeHtml(inquiry.name)}</div>
            </div>

            <div class="field">
              <span class="label">Email:</span>
              <div class="value"><a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a></div>
            </div>

            <div class="field">
              <span class="label">Organization:</span>
              <div class="value">${escapeHtml(inquiry.organization)}</div>
            </div>

            ${inquiry.phone ? `
              <div class="field">
                <span class="label">Phone:</span>
                <div class="value">${escapeHtml(inquiry.phone)}</div>
              </div>
            ` : ''}

            ${inquiry.conference_type ? `
              <div class="field">
                <span class="label">Conference Type:</span>
                <div class="value">${escapeHtml(formatConferenceType(inquiry.conference_type))}</div>
              </div>
            ` : ''}

            ${inquiry.expected_attendees ? `
              <div class="field">
                <span class="label">Expected Attendees:</span>
                <div class="value">${escapeHtml(inquiry.expected_attendees)}</div>
              </div>
            ` : ''}

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
            <p>Please respond to this inquiry within 24 hours</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
New Inquiry Received

Priority: ${(inquiry.priority || 'medium').toUpperCase()}
Name: ${escapeText(inquiry.name)}
Email: ${escapeText(inquiry.email)}
Organization: ${escapeText(inquiry.organization)}
${inquiry.phone ? `Phone: ${escapeText(inquiry.phone)}` : ''}
${inquiry.conference_type ? `Conference Type: ${escapeText(formatConferenceType(inquiry.conference_type))}` : ''}
${inquiry.expected_attendees ? `Expected Attendees: ${escapeText(inquiry.expected_attendees)}` : ''}

Message:
${escapeText(inquiry.message)}

Submitted: ${inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : 'N/A'}

View in admin panel: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/inquiries
  `

  // Send to admin email (you should configure this in your environment variables)
  const adminEmail = process.env.ADMIN_EMAIL || 'screatives.info@gmail.com'
  
  return sendGenericEmail({
    to: adminEmail,
    subject,
    html,
    text,
  })
}

// Send confirmation email to customer
async function sendCustomerConfirmationEmail(inquiry: ContactInquiry): Promise<{ id: string }> {
  const subject = `Thank you for contacting MeetFlow`
  
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
            <h1 style="margin: 0; font-size: 32px;">✅ We Received Your Inquiry</h1>
            <p style="margin: 15px 0 0 0; opacity: 0.95; font-size: 16px;">Thank you for your interest in MeetFlow</p>
          </div>
          <div class="content">
            <p>Dear ${escapeHtml(inquiry.name)},</p>
            
            <p>Thank you for reaching out to us! We have received your inquiry about our conference management platform.</p>

            <div class="highlight">
              <p style="margin: 0; font-weight: bold;">⏱️ What happens next?</p>
              <p style="margin: 10px 0 0 0;">Our team will review your requirements and get back to you <strong>within 24 hours</strong> (usually much sooner!).</p>
            </div>

            <p><strong>Your inquiry details:</strong></p>
            <ul>
              <li>Organization: ${escapeHtml(inquiry.organization)}</li>
              ${inquiry.conference_type ? `<li>Conference Type: ${escapeHtml(formatConferenceType(inquiry.conference_type))}</li>` : ''}
              ${inquiry.expected_attendees ? `<li>Expected Attendees: ${escapeHtml(inquiry.expected_attendees)}</li>` : ''}
            </ul>

            <p>In the meantime, feel free to explore our <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}">platform features</a> or check out our <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}#features">documentation</a>.</p>

            <p>If you have any urgent questions, you can reply directly to this email.</p>

            <p style="margin-top: 30px;">Best regards,<br><strong>The MeetFlow Team</strong></p>
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
Dear ${escapeText(inquiry.name)},

Thank you for reaching out to us! We have received your inquiry about our conference management platform.

What happens next?
Our team will review your requirements and get back to you within 24 hours (usually much sooner!).

Your inquiry details:
- Organization: ${escapeText(inquiry.organization)}
${inquiry.conference_type ? `- Conference Type: ${escapeText(formatConferenceType(inquiry.conference_type))}` : ''}
${inquiry.expected_attendees ? `- Expected Attendees: ${escapeText(inquiry.expected_attendees)}` : ''}

If you have any urgent questions, you can reply directly to this email.

Best regards,
The MeetFlow Team

---
MeetFlow - Modern Conference Management Platform
  `

  return sendGenericEmail({
    to: inquiry.email,
    subject,
    html,
    text,
  })
}

function formatConferenceType(type: string): string {
  const types: Record<string, string> = {
    'virtual': 'Virtual Conference',
    'hybrid': 'Hybrid Conference',
    'onsite': 'On-site Conference',
    'other': 'Other',
  }
  return types[type] || type
}


