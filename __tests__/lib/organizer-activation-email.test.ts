/**
 * @jest-environment node
 */
import { sendOrganizerActivationEmail } from '@/lib/email'

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe('organizer activation email', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'MeetFlow <noreply@example.com>'
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'email-1' }),
    })) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends the activation link and no password', async () => {
    const activationUrl =
      'http://localhost:3000/auth/callback?token_hash=0123456789abcdef0123456789abcdef&type=invite&next=%2Fauth%2Freset-password'

    await sendOrganizerActivationEmail({
      email: 'organizer@example.com',
      fullName: 'Ada <script>',
      activationUrl,
    })

    const body = JSON.parse(
      (globalThis.fetch as jest.Mock).mock.calls[0][1].body as string
    )
    expect(body.subject).toBe('Set your MeetFlow organizer password')
    expect(body.html).toContain(activationUrl.replace(/&/g, '&amp;'))
    expect(body.text).toContain(activationUrl)
    expect(body.html).toContain('Ada &lt;script&gt;')
    expect(body.html).not.toContain('<script>')
    expect(`${body.html}\n${body.text}`).not.toMatch(/password\s*:/i)
    expect(body.tempPassword).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('TemporarySecret123')
  })
})
