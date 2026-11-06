/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/admin/subscription-orders/[id]/confirm-bank-payment/route'
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

function database(order: Record<string, unknown>) {
  const writes: Array<{ table: string; action: string; payload: unknown }> = []
  const state = {
    profile: null as { id: string } | null,
    confirmed: false,
  }
  const admin = {
    generateLink: jest.fn(async (params: { type: string }) => ({
      data: {
        user: {
          id: params.type === 'invite' ? 'user-new' : 'user-existing',
          email_confirmed_at: state.confirmed ? '2026-01-01T00:00:00Z' : null,
          last_sign_in_at: state.confirmed ? '2026-01-02T00:00:00Z' : null,
        },
        properties: { hashed_token: TOKEN },
      },
      error: params.type === 'invite' && state.profile ? { code: 'email_exists', message: 'already been registered' } : null,
    })),
    getUserById: jest.fn(async () => ({
      data: {
        user: {
          id: 'user-existing',
          email_confirmed_at: state.confirmed ? '2026-01-01T00:00:00Z' : null,
          last_sign_in_at: state.confirmed ? '2026-01-02T00:00:00Z' : null,
        },
      },
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
          writes.push({ table, action, payload })
          return api
        },
        update: (payload: unknown) => {
          action = 'update'
          writes.push({ table, action, payload })
          return api
        },
        eq: () => api,
        ilike: () => api,
        maybeSingle: async () => ({ data: table === 'user_profiles' ? state.profile : null, error: null }),
        single: async () => {
          if (table === 'subscription_orders') return { data: order, error: null }
          if (table === 'subscriptions' && action === 'insert') {
            return { data: { id: 'sub-1' }, error: null }
          }
          return { data: null, error: null }
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      }
      return api
    },
    auth: { admin },
  }
  return { client, admin, writes, state }
}

function request(body: unknown = { verified: true }) {
  return new NextRequest('http://localhost:3000/api/admin/subscription-orders/order-1/confirm-bank-payment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const pendingOrder = {
  id: 'order-1',
  email: 'buyer@example.com',
  full_name: 'Buyer Organizer',
  organization: 'Pilot Org',
  payment_method: 'bank_transfer',
  status: 'pending',
  billing_cycle: 'yearly',
  plan_id: 'plan-1',
  price: 120,
  currency: 'EUR',
}

describe('bank subscription activation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    requireSuperAdminMock.mockResolvedValue({ user: { id: 'super-1' } })
  })

  it('creates one subscription and emails an activation link for a new organizer', async () => {
    const db = database(pendingOrder)
    createAdminClientMock.mockReturnValue(db.client)

    const response = await PATCH(request(), { params: { id: 'order-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.activation_email_sent).toBe(true)
    expect(json.subscriptionId).toBe('sub-1')
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
    expect(db.admin.createUser).not.toHaveBeenCalled()
    expect(db.admin.updateUserById).not.toHaveBeenCalled()
    expect(JSON.stringify(db.admin.generateLink.mock.calls)).not.toContain('password')
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('activates a subscription for an existing account without changing its password', async () => {
    const db = database(pendingOrder)
    db.state.profile = { id: 'user-existing' }
    db.state.confirmed = true
    createAdminClientMock.mockReturnValue(db.client)

    const response = await PATCH(request(), { params: { id: 'order-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.userId).toBe('user-existing')
    expect(json.activation_email_sent).toBeNull()
    expect(db.writes.filter((write) => write.table === 'user_profiles')).toHaveLength(0)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
    expect(db.admin.generateLink).not.toHaveBeenCalled()
    expect(db.admin.updateUserById).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('records the payment once when the activation email fails', async () => {
    const db = database(pendingOrder)
    sendEmailMock.mockRejectedValueOnce(new Error('mailbox unavailable'))
    createAdminClientMock.mockReturnValue(db.client)

    const response = await PATCH(request(), { params: { id: 'order-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('paid')
    expect(json.activation_email_sent).toBe(false)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
    expect(db.writes.find((write) => write.table === 'subscription_orders')?.payload).toMatchObject({
      status: 'paid',
    })
    expect(JSON.stringify(json)).not.toContain(TOKEN)
  })

  it('resends activation for a paid order without a second subscription', async () => {
    const db = database({ ...pendingOrder, status: 'paid' })
    db.state.profile = { id: 'user-existing' }
    db.state.confirmed = false
    createAdminClientMock.mockReturnValue(db.client)

    const response = await PATCH(request(), { params: { id: 'order-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.alreadyPaid).toBe(true)
    expect(json.activation_email_sent).toBe(true)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(0)
    expect(db.admin.generateLink).toHaveBeenCalledTimes(1)
    expect(db.admin.generateLink.mock.calls[0][0].type).toBe('recovery')
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })
})
