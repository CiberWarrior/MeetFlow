/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from '@/app/auth/callback/route'

const verifyOtp = jest.fn()
const exchangeCodeForSession = jest.fn()
const getUser = jest.fn()
const profileSingle = jest.fn()

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
  }),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { verifyOtp, exchangeCodeForSession, getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: profileSingle,
        }),
      }),
    }),
  }),
}))

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

function callback(query: string) {
  return GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`))
}

describe('auth callback activation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('consumes a valid invite token and drops it from the redirect', async () => {
    verifyOtp.mockResolvedValue({ error: null })

    const response = await callback(
      'token_hash=0123456789abcdef0123456789abcdef&type=invite&next=https://evil.example'
    )

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'invite',
      token_hash: '0123456789abcdef0123456789abcdef',
    })
    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/reset-password')
    expect(response.headers.get('location')).not.toContain('token_hash')
    expect(response.headers.get('location')).not.toContain('evil.example')
  })

  it('rejects an expired, reused, or invalid token without a session redirect', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })

    const response = await callback('token_hash=expired-token-value&type=recovery')

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/reset-password?error=invalid'
    )
    expect(response.headers.get('location')).not.toContain('/admin/dashboard')
    expect(response.headers.get('location')).not.toContain('expired-token-value')
  })

  it('does not verify a manipulated verification type', async () => {
    const response = await callback('token_hash=0123456789abcdef0123456789abcdef&type=magiclink')

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toContain('/auth/admin-login')
  })

  it('exchanges a recovery code once and does not forward it', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await callback('code=recovery-code&type=recovery')

    expect(exchangeCodeForSession).toHaveBeenCalledWith('recovery-code')
    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/reset-password')
  })

  it('rejects a recovery code that Supabase will not exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'code already used' } })

    const response = await callback('code=used-code&type=invite')

    expect(response.headers.get('location')).toContain('error=invalid')
    expect(response.headers.get('location')).not.toContain('used-code')
  })

  it('still sends an active admin through the normal code exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    profileSingle.mockResolvedValue({
      data: { role: 'conference_admin', active: true },
      error: null,
    })

    const response = await callback('code=login-code')

    expect(response.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })
})
