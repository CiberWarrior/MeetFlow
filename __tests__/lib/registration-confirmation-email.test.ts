/**
 * @jest-environment node
 */
import { sendRegistrationConfirmation } from '@/lib/email'

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function restoreEnv() {
  if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
  if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey
}

describe('sendRegistrationConfirmation delivery status', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
    global.fetch = jest.fn()
  })

  afterAll(() => {
    restoreEnv()
  })

  it('returns sent only when the provider response includes a message id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: 'msg_123' }),
    })

    await expect(
      sendRegistrationConfirmation('reg-1', 'ada@example.com', 'Ada', 'Lovelace')
    ).resolves.toBe('sent')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns failed when the provider rejects the message', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'First name and last name are required' }),
    })

    await expect(
      sendRegistrationConfirmation('reg-1', 'ada@example.com', 'Ada', '')
    ).resolves.toBe('failed')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns unknown when a successful response has no message id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })

    await expect(
      sendRegistrationConfirmation('reg-1', 'ada@example.com', 'Ada', 'Lovelace')
    ).resolves.toBe('unknown')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns unknown when the request fails without a response', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network down'))

    await expect(
      sendRegistrationConfirmation('reg-1', 'ada@example.com', 'Ada', 'Lovelace')
    ).resolves.toBe('unknown')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns failed without calling the provider when delivery is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    await expect(
      sendRegistrationConfirmation('reg-1', 'ada@example.com', 'Ada', 'Lovelace')
    ).resolves.toBe('failed')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
