/**
 * @jest-environment node
 */
import {
  buildOrganizerActivationUrl,
  deliverOrganizerActivation,
  normalizeOrganizerEmail,
  resolveOrganizerAccount,
} from '@/lib/organizer-activation'
import { sendOrganizerActivationEmail } from '@/lib/email'
import { log } from '@/lib/logger'

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/email', () => ({
  sendOrganizerActivationEmail: jest.fn(async () => undefined),
}))

const sendEmailMock = sendOrganizerActivationEmail as jest.Mock
const TOKEN = '0123456789abcdef0123456789abcdef'

function authAdmin() {
  return {
    generateLink: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUserById: jest.fn(),
    deleteUser: jest.fn(),
  }
}

function profiles(result: { data: { id: string } | null; error: { message: string } | null }) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        ilike: jest.fn(() => ({
          maybeSingle: jest.fn(async () => result),
        })),
      })),
    })),
  }
}

function inviteResult(user: Record<string, unknown> = {}) {
  return {
    data: {
      user: {
        id: 'user-new',
        email_confirmed_at: null,
        last_sign_in_at: null,
        ...user,
      },
      properties: { hashed_token: TOKEN },
    },
    error: null,
  }
}

describe('organizer activation links', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('creates a new account with an invite link and no password', async () => {
    const admin = authAdmin()
    admin.generateLink.mockResolvedValue(inviteResult())

    const result = await resolveOrganizerAccount({
      authAdmin: admin,
      profiles: profiles({ data: null, error: null }),
      email: 'New.Organizer@Example.com',
      fullName: 'New Organizer',
      organization: 'Pilot Org',
    })

    expect(result).toMatchObject({
      ok: true,
      userId: 'user-new',
      created: true,
      profileExists: false,
    })
    expect(result.ok && result.activationUrl).toContain('token_hash=')
    expect(result.ok && result.activationUrl).toContain('type=invite')
    expect(result.ok && result.activationUrl).toContain('next=%2Fauth%2Freset-password')
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'new.organizer@example.com',
      options: {
        data: { full_name: 'New Organizer', organization: 'Pilot Org' },
        redirectTo: 'http://localhost:3000/auth/callback',
      },
    })
    expect(JSON.stringify(admin.generateLink.mock.calls)).not.toContain('password')
    expect(admin.createUser).not.toHaveBeenCalled()
    expect(admin.updateUserById).not.toHaveBeenCalled()
    expect(JSON.stringify((log.info as jest.Mock).mock.calls)).not.toContain(TOKEN)
    expect(JSON.stringify((log.error as jest.Mock).mock.calls)).not.toContain(TOKEN)
  })

  it('does not overwrite or email a confirmed existing account', async () => {
    const admin = authAdmin()
    admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'user-existing',
          email_confirmed_at: '2026-01-01T00:00:00Z',
          last_sign_in_at: '2026-02-01T00:00:00Z',
        },
      },
      error: null,
    })

    const result = await resolveOrganizerAccount({
      authAdmin: admin,
      profiles: profiles({ data: { id: 'user-existing' }, error: null }),
      email: 'existing@example.com',
      fullName: 'Existing Organizer',
    })

    expect(result).toEqual({
      ok: true,
      userId: 'user-existing',
      created: false,
      profileExists: true,
      activationUrl: null,
    })
    expect(admin.generateLink).not.toHaveBeenCalled()
    expect(admin.updateUserById).not.toHaveBeenCalled()
  })

  it('sends a recovery link for an existing account that has not been activated', async () => {
    const admin = authAdmin()
    admin.getUserById.mockResolvedValue({
      data: { user: { id: 'user-pending', email_confirmed_at: null, last_sign_in_at: null } },
      error: null,
    })
    admin.generateLink.mockResolvedValue(
      inviteResult({ id: 'user-pending', email_confirmed_at: null, last_sign_in_at: null })
    )

    const result = await resolveOrganizerAccount({
      authAdmin: admin,
      profiles: profiles({ data: { id: 'user-pending' }, error: null }),
      email: 'pending@example.com',
      fullName: 'Pending Organizer',
    })

    expect(admin.generateLink).toHaveBeenCalledTimes(1)
    expect(admin.generateLink.mock.calls[0][0].type).toBe('recovery')
    expect(admin.generateLink.mock.calls[0][0].options.password).toBeUndefined()
    expect(result.ok && result.created).toBe(false)
    expect(result.ok && result.activationUrl).toContain('type=recovery')
    expect(admin.updateUserById).not.toHaveBeenCalled()
  })

  it('reuses an auth user that has no profile and does not reset a confirmed password', async () => {
    const admin = authAdmin()
    admin.generateLink
      .mockResolvedValueOnce({
        data: { user: null, properties: null },
        error: { code: 'email_exists', message: 'A user with this email address has already been registered', status: 422 },
      })
      .mockResolvedValueOnce(
        inviteResult({
          id: 'user-auth-only',
          email_confirmed_at: '2026-03-01T00:00:00Z',
          last_sign_in_at: null,
        })
      )

    const result = await resolveOrganizerAccount({
      authAdmin: admin,
      profiles: profiles({ data: null, error: null }),
      email: 'auth-only@example.com',
      fullName: 'Auth Only',
    })

    expect(result).toMatchObject({
      ok: true,
      userId: 'user-auth-only',
      created: false,
      profileExists: false,
      activationUrl: null,
    })
    expect(admin.generateLink.mock.calls.map((call) => call[0].type)).toEqual(['invite', 'recovery'])
    expect(admin.updateUserById).not.toHaveBeenCalled()
  })

  it('reports an activation delivery failure without exposing the link', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error(`mailbox rejected ${TOKEN}`))
    const url = buildOrganizerActivationUrl(TOKEN, 'invite')

    const sent = await deliverOrganizerActivation({
      email: 'new@example.com',
      fullName: 'New Organizer',
      activationUrl: url,
    })

    expect(sent).toBe(false)
    const logged = JSON.stringify((log.error as jest.Mock).mock.calls)
    expect(logged).not.toContain(TOKEN)
    expect(logged).not.toContain('token_hash')
  })

  it('rejects an activation url that was rewritten', async () => {
    const sent = await deliverOrganizerActivation({
      email: 'new@example.com',
      fullName: 'New Organizer',
      activationUrl: `https://evil.example/auth/callback?token_hash=${TOKEN}&type=invite&next=/auth/reset-password`,
    })

    expect(sent).toBe(false)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('rejects malformed organizer emails', () => {
    expect(normalizeOrganizerEmail('not-an-email')).toBeNull()
    expect(normalizeOrganizerEmail('user%@example.com')).toBeNull()
  })
})
