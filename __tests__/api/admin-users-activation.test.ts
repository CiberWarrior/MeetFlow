/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/users/route'
import { requireSuperAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendOrganizerActivationEmail } from '@/lib/email'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/api-auth', () => ({
  requireSuperAdmin: jest.fn(),
}))
jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))
jest.mock('@/lib/email', () => ({
  sendOrganizerActivationEmail: jest.fn(async () => undefined),
}))

const requireSuperAdminMock = requireSuperAdmin as jest.Mock
const createAdminClientMock = createAdminClient as jest.Mock
const sendEmailMock = sendOrganizerActivationEmail as jest.Mock
const TOKEN = '0123456789abcdef0123456789abcdef'

function database() {
  const writes: Array<{ table: string; payload: unknown }> = []
  const state = {
    profile: { data: null as { id: string } | null, error: null as { message: string } | null },
    profileInsert: { error: null as { message: string } | null },
    permissionInsert: { error: null as { message: string } | null },
  }
  const admin = {
    generateLink: jest.fn(async (params: { type: string }) => {
      if (params.type === 'invite') {
        return {
          data: {
            user: { id: 'user-new', email_confirmed_at: null, last_sign_in_at: null },
            properties: { hashed_token: TOKEN },
          },
          error: null,
        }
      }
      return {
        data: {
          user: { id: 'user-existing', email_confirmed_at: null, last_sign_in_at: null },
          properties: { hashed_token: TOKEN },
        },
        error: null,
      }
    }),
    getUserById: jest.fn(async () => ({
      data: { user: { id: 'user-existing', email_confirmed_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-01-02T00:00:00Z' } },
      error: null,
    })),
    deleteUser: jest.fn(async () => ({ error: null })),
    createUser: jest.fn(),
    updateUserById: jest.fn(),
  }
  const client = {
    from(table: string) {
      let action = 'select'
      const api = {
        select: () => api,
        insert: (payload: unknown) => {
          action = 'insert'
          writes.push({ table, payload })
          return api
        },
        ilike: () => api,
        eq: () => api,
        maybeSingle: async () => state.profile,
        then: (resolve: (value: unknown) => unknown) => {
          const result =
            table === 'conference_permissions' ? state.permissionInsert : state.profileInsert
          return Promise.resolve(action === 'insert' ? result : { error: null }).then(resolve)
        },
      }
      return api
    },
    auth: { admin },
  }
  return { client, admin, writes, state }
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  email: 'organizer@example.com',
  full_name: 'Organizer One',
  role: 'conference_admin',
  conference_ids: ['conference-1'],
  permissions: { can_edit_conference: true },
  password: 'ShouldNotBeUsed123',
}

describe('POST /api/admin/users activation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('creates an organizer without a password and assigns the conference', async () => {
    const db = database()
    createAdminClientMock.mockReturnValue(db.client)
    requireSuperAdminMock.mockResolvedValue({
      user: { id: 'super-1' },
      profile: { id: 'super-1' },
      supabase: db.client,
    })

    const response = await POST(request(validBody))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.activation_email_sent).toBe(true)
    expect(json.user.id).toBe('user-new')
    expect(db.admin.createUser).not.toHaveBeenCalled()
    expect(db.admin.updateUserById).not.toHaveBeenCalled()
    expect(JSON.stringify(db.admin.generateLink.mock.calls)).not.toContain('ShouldNotBeUsed123')
    expect(db.writes.map((write) => write.table)).toEqual([
      'user_profiles',
      'conference_permissions',
    ])
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(json)).not.toContain(TOKEN)
  })

  it('does not duplicate a confirmed account or change its password', async () => {
    const db = database()
    db.state.profile = { data: { id: 'user-existing' }, error: null }
    createAdminClientMock.mockReturnValue(db.client)
    requireSuperAdminMock.mockResolvedValue({
      user: { id: 'super-1' },
      profile: { id: 'super-1' },
      supabase: db.client,
    })

    const response = await POST(request(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.already_exists).toBe(true)
    expect(json.activation_email_sent).toBe(false)
    expect(db.writes).toHaveLength(0)
    expect(db.admin.generateLink).not.toHaveBeenCalled()
    expect(db.admin.updateUserById).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('keeps the account when activation email delivery fails', async () => {
    const db = database()
    sendEmailMock.mockRejectedValueOnce(new Error('provider down'))
    createAdminClientMock.mockReturnValue(db.client)
    requireSuperAdminMock.mockResolvedValue({
      user: { id: 'super-1' },
      profile: { id: 'super-1' },
      supabase: db.client,
    })

    const response = await POST(request(validBody))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.activation_email_sent).toBe(false)
    expect(db.writes.filter((write) => write.table === 'user_profiles')).toHaveLength(1)
    expect(db.admin.deleteUser).not.toHaveBeenCalled()
    expect(JSON.stringify(json)).not.toContain('provider down')
  })

  it('removes a newly created auth user when the profile cannot be saved', async () => {
    const db = database()
    db.state.profileInsert = { error: { message: 'profile failed' } }
    createAdminClientMock.mockReturnValue(db.client)
    requireSuperAdminMock.mockResolvedValue({
      user: { id: 'super-1' },
      profile: { id: 'super-1' },
      supabase: db.client,
    })

    const response = await POST(request(validBody))

    expect(response.status).toBe(500)
    expect(db.admin.deleteUser).toHaveBeenCalledWith('user-new')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
