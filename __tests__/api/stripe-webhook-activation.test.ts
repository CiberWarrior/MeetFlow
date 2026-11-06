/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe-webhook/route'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendOrganizerActivationEmail } from '@/lib/email'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/stripe', () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}))
jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))
jest.mock('@/lib/email', () => ({
  sendOrganizerActivationEmail: jest.fn(async () => undefined),
  sendPaymentConfirmation: jest.fn(async () => undefined),
}))

const constructEvent = stripe!.webhooks.constructEvent as jest.Mock
const createAdminClientMock = createAdminClient as jest.Mock
const sendEmailMock = sendOrganizerActivationEmail as jest.Mock
const TOKEN = '0123456789abcdef0123456789abcdef'

function database(options: { orderStatus?: string; profileId?: string | null; confirmed?: boolean }) {
  const writes: Array<{ table: string; action: string; payload: unknown }> = []
  const admin = {
    generateLink: jest.fn(async (params: { type: string }) => ({
      data: {
        user: {
          id: params.type === 'invite' ? 'user-new' : options.profileId || 'user-existing',
          email_confirmed_at: options.confirmed ? '2026-01-01T00:00:00Z' : null,
          last_sign_in_at: options.confirmed ? '2026-01-02T00:00:00Z' : null,
        },
        properties: { hashed_token: TOKEN },
      },
      error: null,
    })),
    getUserById: jest.fn(async () => ({
      data: {
        user: {
          id: options.profileId || 'user-existing',
          email_confirmed_at: options.confirmed ? '2026-01-01T00:00:00Z' : null,
          last_sign_in_at: options.confirmed ? '2026-01-02T00:00:00Z' : null,
        },
      },
      error: null,
    })),
    deleteUser: jest.fn(),
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
        maybeSingle: async () => {
          if (table === 'user_profiles') {
            return { data: options.profileId ? { id: options.profileId } : null, error: null }
          }
          return { data: null, error: null }
        },
        single: async () => {
          if (table === 'subscription_orders') {
            return {
              data: { id: 'order-1', status: options.orderStatus || 'pending' },
              error: null,
            }
          }
          if (table === 'contact_inquiries') return { data: { id: 'inquiry-1' }, error: null }
          if (table === 'subscriptions' && action === 'insert') {
            return { data: { id: 'sub-1', user_id: 'user-new' }, error: null }
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
  return { client, admin, writes }
}

function webhook(metadata: Record<string, string>) {
  constructEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test',
        metadata,
        amount_total: 12000,
        currency: 'eur',
        customer: 'cus_test',
        payment_intent: 'pi_test',
        subscription: 'sub_stripe',
        invoice: 'in_test',
      },
    },
  })
  return new NextRequest('http://localhost:3000/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test' },
    body: '{}',
  })
}

describe('stripe organizer activation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('provisions a self-service subscription with an activation link and no password', async () => {
    const db = database({})
    createAdminClientMock.mockReturnValue(db.client)

    const response = await POST(
      webhook({
        order_id: 'order-1',
        plan_id: 'plan-1',
        billing_cycle: 'yearly',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer Organizer',
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.activation_email_sent).toBe(true)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
    expect(db.admin.createUser).not.toHaveBeenCalled()
    expect(JSON.stringify(db.admin.generateLink.mock.calls)).not.toContain('password')
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(json)).not.toContain(TOKEN)
  })

  it('does not create a duplicate account for an existing confirmed organizer', async () => {
    const db = database({ profileId: 'user-existing', confirmed: true })
    createAdminClientMock.mockReturnValue(db.client)

    const response = await POST(
      webhook({
        order_id: 'order-1',
        plan_id: 'plan-1',
        billing_cycle: 'monthly',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer Organizer',
      })
    )

    expect(response.status).toBe(200)
    expect(db.writes.filter((write) => write.table === 'user_profiles')).toHaveLength(0)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
    expect(db.admin.generateLink).not.toHaveBeenCalled()
    expect(db.admin.updateUserById).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('keeps the paid subscription when activation email delivery fails', async () => {
    const db = database({})
    sendEmailMock.mockRejectedValueOnce(new Error('provider down'))
    createAdminClientMock.mockReturnValue(db.client)

    const response = await POST(
      webhook({
        order_id: 'order-1',
        plan_id: 'plan-1',
        billing_cycle: 'yearly',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer Organizer',
      })
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toContain('activation email')
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
    expect(db.writes.find((write) => write.table === 'subscription_orders')?.payload).toMatchObject({
      status: 'paid',
    })
    expect(JSON.stringify(json)).not.toContain(TOKEN)
  })

  it('does not create a second subscription when a paid order is retried', async () => {
    const db = database({ orderStatus: 'paid', profileId: 'user-existing', confirmed: false })
    createAdminClientMock.mockReturnValue(db.client)

    const response = await POST(
      webhook({
        order_id: 'order-1',
        plan_id: 'plan-1',
        billing_cycle: 'yearly',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer Organizer',
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.alreadyPaid).toBe(true)
    expect(json.activation_email_sent).toBe(true)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(0)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('uses the same activation flow for an inquiry payment link', async () => {
    const db = database({})
    createAdminClientMock.mockReturnValue(db.client)

    const response = await POST(
      webhook({
        inquiry_id: 'inquiry-1',
        plan_id: 'plan-1',
        billing_cycle: 'yearly',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer Organizer',
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.subscriptionId).toBe('sub-1')
    expect(db.admin.createUser).not.toHaveBeenCalled()
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(db.writes.filter((write) => write.table === 'subscriptions')).toHaveLength(1)
  })
})
