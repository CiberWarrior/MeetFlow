/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/contact/route'
import { sendGenericEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

jest.mock('server-only', () => ({}))

jest.mock('@/lib/logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/email', () => ({
  sendGenericEmail: jest.fn(),
}))

jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  contactRateLimit: null,
  getClientIP: () => '203.0.113.10',
  checkRateLimit: jest.fn(),
  createRateLimitHeaders: () => ({}),
}))

const checkRateLimitMock = checkRateLimit as jest.Mock

const sendGenericEmailMock = sendGenericEmail as jest.Mock
const createAdminClientMock = createAdminClient as jest.Mock

function mockSavedInquiry() {
  createAdminClientMock.mockReturnValue({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: 'inquiry-1',
              name: 'Ana',
              email: 'ana@example.com',
              organization: 'Lab',
              phone: null,
              conference_type: 'virtual',
              expected_attendees: '1-50',
              service_type: 'platform',
              message: 'Need a quote',
              priority: 'medium',
              created_at: '2026-10-07T18:00:00.000Z',
            },
            error: null,
          }),
        }),
      }),
    }),
  })
}

function quoteRequest() {
  return new NextRequest('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ana',
      email: 'ana@example.com',
      organization: 'Lab',
      message: 'Need a quote',
    }),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    checkRateLimitMock.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
    mockSavedInquiry()
  })

  it('keeps the saved inquiry and does not report email success when sending fails', async () => {
    sendGenericEmailMock.mockRejectedValue(new Error('RESEND_API_KEY is not configured'))

    const response = await POST(quoteRequest())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.inquiryId).toBe('inquiry-1')
    expect(log.info).not.toHaveBeenCalled()
    expect(log.error).toHaveBeenCalledWith(
      'Failed to send notification email',
      expect.any(Error),
      expect.objectContaining({ action: 'contact_inquiry_notification' })
    )
    expect(log.error).toHaveBeenCalledWith(
      'Failed to send confirmation email',
      expect.any(Error),
      expect.objectContaining({ action: 'contact_inquiry_confirmation' })
    )
  })

  it('rejects a local number before saving the inquiry', async () => {
    const request = new NextRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana',
        email: 'ana@example.com',
        organization: 'Lab',
        phone: '091 234 5678',
        message: 'Need a quote',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('missing_country')
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(sendGenericEmailMock).not.toHaveBeenCalled()
  })

  it('rejects a phone number with letters before saving the inquiry', async () => {
    const request = new NextRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana',
        email: 'ana@example.com',
        organization: 'Lab',
        phone: 'nije broj',
        message: 'Need a quote',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('invalid_mobile')
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(sendGenericEmailMock).not.toHaveBeenCalled()
  })

  it('keeps diacritics for save and escapes them safely in the email HTML', async () => {
    let inserted: Record<string, unknown> | null = null
    createAdminClientMock.mockReturnValue({
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          inserted = row
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: 'inquiry-1',
                  priority: 'medium',
                  created_at: '2026-10-07T18:00:00.000Z',
                  ...row,
                },
                error: null,
              }),
            }),
          }
        },
      }),
    })
    sendGenericEmailMock.mockResolvedValue({ id: 'email_1' })

    const response = await POST(
      new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: "Željka Čačić",
          email: 'zeljka@example.com',
          organization: 'Sveučilište u Zagrebu',
          phone: '+385 91 234 5678',
          message: "Suradnja s Ana-Marija O'Brien. Tema: č ć ž š đ i <tema>.",
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(inserted).toMatchObject({
      name: "Željka Čačić",
      organization: 'Sveučilište u Zagrebu',
      phone: '+385912345678',
      message: "Suradnja s Ana-Marija O'Brien. Tema: č ć ž š đ i <tema>.",
    })

    const html = sendGenericEmailMock.mock.calls.map((call) => call[0].html).join('\n')
    const text = sendGenericEmailMock.mock.calls.map((call) => call[0].text).join('\n')
    expect(html).toContain('Željka Čačić')
    expect(html).toContain('Sveučilište u Zagrebu')
    expect(html).toContain('č ć ž š đ')
    expect(html).toContain('O&#039;Brien')
    expect(html).toContain('&lt;tema&gt;')
    expect(html).not.toContain('<tema>')
    expect(text).toContain('Željka Čačić')
    expect(text).toContain("O'Brien")
    expect(text).toContain('č ć ž š đ')
  })

  it('logs email success only with the Resend message id', async () => {
    sendGenericEmailMock
      .mockResolvedValueOnce({ id: 'email_admin' })
      .mockResolvedValueOnce({ id: 'email_customer' })

    const response = await POST(quoteRequest())

    expect(response.status).toBe(201)
    expect(log.info).toHaveBeenCalledWith(
      'Contact inquiry notification email sent',
      expect.objectContaining({ messageId: 'email_admin', inquiryId: 'inquiry-1' })
    )
    expect(log.info).toHaveBeenCalledWith(
      'Contact inquiry confirmation email sent',
      expect.objectContaining({ messageId: 'email_customer', inquiryId: 'inquiry-1' })
    )
  })

  it('returns 429 before saving when the contact rate limit is exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 0 })

    const response = await POST(quoteRequest())

    expect(response.status).toBe(429)
    expect((await response.json()).code).toBe('rate_limited')
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(sendGenericEmailMock).not.toHaveBeenCalled()
  })
})
