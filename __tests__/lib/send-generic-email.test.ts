import { sendGenericEmail } from '@/lib/email'

jest.mock('@/lib/logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const savedKey = process.env.RESEND_API_KEY
const savedFrom = process.env.EMAIL_FROM

function restoreEnv() {
  if (savedKey === undefined) {
    delete process.env.RESEND_API_KEY
  } else {
    process.env.RESEND_API_KEY = savedKey
  }
  if (savedFrom === undefined) {
    delete process.env.EMAIL_FROM
  } else {
    process.env.EMAIL_FROM = savedFrom
  }
}

describe('sendGenericEmail', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY
    process.env.EMAIL_FROM = 'MeetFlow <quotes@example.com>'
    global.fetch = jest.fn(() => {
      throw new Error('fetch must not run unless a test stubs it')
    }) as jest.Mock
  })

  afterAll(() => {
    restoreEnv()
  })

  it('throws when RESEND_API_KEY is missing and does not call Resend', async () => {
    await expect(
      sendGenericEmail({
        to: 'person@example.com',
        subject: 'Quote',
        html: '<p>Hello</p>',
        text: 'Hello',
      })
    ).rejects.toThrow('RESEND_API_KEY is not configured')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns the Resend message id when the API accepts the email', async () => {
    process.env.RESEND_API_KEY = 're_test_not_a_real_key'
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email_123' }),
    })

    const result = await sendGenericEmail({
      to: 'person@example.com',
      subject: 'Quote',
      html: '<p>Hello</p>',
      text: 'Hello',
    })

    expect(result).toEqual({ id: 'email_123' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_test_not_a_real_key')
    expect(JSON.parse(init.body).from).toBe('MeetFlow <quotes@example.com>')
  })

  it('throws when Resend rejects the email', async () => {
    process.env.RESEND_API_KEY = 're_test_not_a_real_key'
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'domain not verified',
    })

    await expect(
      sendGenericEmail({
        to: 'person@example.com',
        subject: 'Quote',
        html: '<p>Hello</p>',
        text: 'Hello',
      })
    ).rejects.toThrow('Failed to send email: domain not verified')
  })

  it('throws when Resend does not return a message id', async () => {
    process.env.RESEND_API_KEY = 're_test_not_a_real_key'
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    await expect(
      sendGenericEmail({
        to: 'person@example.com',
        subject: 'Quote',
        html: '<p>Hello</p>',
        text: 'Hello',
      })
    ).rejects.toThrow('Resend did not return a message id')
  })
})
