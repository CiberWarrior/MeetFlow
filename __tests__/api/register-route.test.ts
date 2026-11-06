/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/register/route'
import { getAvailableFeesForForm } from '@/lib/custom-registration-fees'
import { sendRegistrationConfirmation } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase-admin'

jest.mock('server-only', () => ({}))

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/rate-limit', () => ({
  registrationRateLimit: null,
  getClientIP: () => '127.0.0.1',
  checkRateLimit: jest.fn(async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60000,
  })),
  createRateLimitHeaders: () => ({}),
}))

jest.mock('@/lib/email', () => ({
  sendRegistrationConfirmation: jest.fn(async () => undefined),
  sendConferenceTeamNotification: jest.fn(async () => undefined),
}))

jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/custom-registration-fees', () => {
  const actual = jest.requireActual('@/lib/custom-registration-fees')
  return {
    ...actual,
    getAvailableFeesForForm: jest.fn(),
  }
})

const getAvailableFeesForFormMock = getAvailableFeesForForm as jest.Mock
const sendRegistrationConfirmationMock = sendRegistrationConfirmation as jest.Mock
const createAdminClientMock = createAdminClient as jest.Mock

const conferenceId = '11111111-1111-4111-8111-111111111111'
const paidFeeId = '22222222-2222-4222-8222-222222222222'
const freeFeeId = '33333333-3333-4333-8333-333333333333'
const otherFeeId = '44444444-4444-4444-8444-444444444444'
const missingFeeId = '55555555-5555-4555-8555-555555555555'

type Write = { table: string; action: 'insert' | 'update'; payload: unknown }

const writes: Write[] = []

function fee(overrides: Record<string, unknown>) {
  return {
    name: 'Fee',
    price_gross: 80,
    currency: 'EUR',
    is_available: true,
    ...overrides,
  }
}

function adminClient() {
  return {
    from(table: string) {
      let action: 'select' | 'insert' | 'update' = 'select'
      let payload: unknown = null
      const finish = () => {
        if (action === 'insert' || action === 'update') {
          writes.push({ table, action, payload })
        }
        if (action === 'insert') {
          return {
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              registration_number: 'MF-001',
              ...(payload && typeof payload === 'object' ? payload : {}),
            },
            error: null,
          }
        }
        if (action === 'update') return { data: null, error: null }
        if (table === 'conferences') {
          return {
            data: {
              id: conferenceId,
              name: 'Pilot Conference',
              slug: 'pilot',
              settings: {},
              email_settings: null,
              pricing: null,
              start_date: '2026-12-01',
              owner_id: 'owner-1',
            },
            error: null,
          }
        }
        if (table === 'user_profiles') {
          return {
            data: {
              bank_account_number: 'HR1210010051863000160',
              bank_account_holder: 'Pilot Org',
              bank_name: 'Test Bank',
              swift_bic: 'TESTHR2X',
            },
            error: null,
          }
        }
        return { data: null, error: null }
      }
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      Object.assign(builder, {
        select: chain,
        eq: chain,
        not: chain,
        in: chain,
        order: chain,
        like: chain,
        limit: chain,
        insert: (value: unknown) => {
          action = 'insert'
          payload = value
          return builder
        },
        update: (value: unknown) => {
          action = 'update'
          payload = value
          return builder
        },
        maybeSingle: () => Promise.resolve(finish()),
        single: () => Promise.resolve(finish()),
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve(finish()).then(onFulfilled, onRejected),
      })
      return builder
    },
  }
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conference_id: conferenceId,
      participants: [{ customFields: { email: 'ada@example.com', first_name: 'Ada' } }],
      ...body,
    }),
  })
}

describe('POST /api/register fee validation', () => {
  beforeEach(() => {
    writes.length = 0
    jest.clearAllMocks()
    createAdminClientMock.mockImplementation(adminClient)
    getAvailableFeesForFormMock.mockResolvedValue([
      fee({ id: paidFeeId, name: 'Full', price_gross: 80 }),
    ])
  })

  it('rejects a missing fee id when an available paid fee exists', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'A registration fee is required',
    })
    expect(writes).toEqual([])
    expect(sendRegistrationConfirmationMock).not.toHaveBeenCalled()
  })

  it('rejects a fee id that does not exist for the conference', async () => {
    const response = await POST(request({ registration_fee_id: missingFeeId }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid registration fee',
    })
    expect(writes).toEqual([])
    expect(sendRegistrationConfirmationMock).not.toHaveBeenCalled()
  })

  it('rejects a fee id from another conference', async () => {
    const response = await POST(request({ registration_fee_id: otherFeeId }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid registration fee',
    })
    expect(getAvailableFeesForFormMock).toHaveBeenCalledWith(
      expect.anything(),
      conferenceId
    )
    expect(writes).toEqual([])
    expect(sendRegistrationConfirmationMock).not.toHaveBeenCalled()
  })

  it.each(['inactive', 'sold_out', 'expired', 'not_available_yet'])(
    'rejects an unavailable fee (%s)',
    async (reason) => {
      getAvailableFeesForFormMock.mockResolvedValue([
        fee({
          id: paidFeeId,
          is_available: false,
          disabled_reason: reason,
        }),
      ])
      const response = await POST(request({ registration_fee_id: paidFeeId }))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'This registration fee is not available',
      })
      expect(writes).toEqual([])
      expect(sendRegistrationConfirmationMock).not.toHaveBeenCalled()
    }
  )

  it('accepts a legitimate zero-price fee without payment', async () => {
    getAvailableFeesForFormMock.mockResolvedValue([
      fee({ id: freeFeeId, name: 'Complimentary', price_gross: 0 }),
    ])
    const response = await POST(request({ registration_fee_id: freeFeeId }))
    expect(response.status).toBe(201)
    const registrationInsert = writes.find(
      (write) => write.table === 'registrations' && write.action === 'insert'
    )
    expect(registrationInsert?.payload).toMatchObject({
      registration_fee_id: freeFeeId,
      payment_method: null,
      payment_status: 'not_required',
      payment_required: false,
    })
    expect(
      writes.some(
        (write) =>
          write.action === 'update' &&
          write.payload !== null &&
          typeof write.payload === 'object' &&
          'payment_amount' in write.payload
      )
    ).toBe(false)
  })

  it('stores a valid paid fee as a pending bank transfer using the server price', async () => {
    const response = await POST(
      request({
        registration_fee_id: paidFeeId,
        payment_status: 'paid',
        amount: 1,
        payment_preference: 'pay_now_bank',
      })
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.bank_instructions).toMatchObject({
      amount: 80,
      currency: 'EUR',
      iban: 'HR1210010051863000160',
    })
    const registrationInsert = writes.find(
      (write) => write.table === 'registrations' && write.action === 'insert'
    )
    expect(registrationInsert?.payload).toMatchObject({
      registration_fee_id: paidFeeId,
      payment_method: 'bank_transfer',
      payment_status: 'pending',
      payment_required: true,
      payment_by_card: false,
    })
    const paymentUpdate = writes.find(
      (write) =>
        write.table === 'registrations' &&
        write.action === 'update' &&
        write.payload !== null &&
        typeof write.payload === 'object' &&
        'payment_amount' in write.payload
    )
    expect(paymentUpdate?.payload).toMatchObject({
      payment_amount: 80,
      payment_currency: 'EUR',
    })
  })

  it('rejects a free registration when every configured paid fee is unavailable', async () => {
    getAvailableFeesForFormMock.mockResolvedValue([
      fee({
        id: paidFeeId,
        price_gross: 80,
        is_available: false,
        disabled_reason: 'inactive',
      }),
      fee({
        id: otherFeeId,
        price_gross: 120,
        is_available: false,
        disabled_reason: 'expired',
      }),
      fee({
        id: missingFeeId,
        price_gross: 40,
        is_available: false,
        disabled_reason: 'sold_out',
      }),
      fee({
        id: '66666666-6666-4666-8666-666666666666',
        price_gross: 50,
        is_available: false,
        disabled_reason: 'not_available_yet',
      }),
    ])

    const response = await POST(request({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'A registration fee is required',
    })
    expect(writes).toEqual([])
    expect(sendRegistrationConfirmationMock).not.toHaveBeenCalled()
  })

  it('accepts an available zero-price fee while every paid fee is unavailable', async () => {
    getAvailableFeesForFormMock.mockResolvedValue([
      fee({
        id: paidFeeId,
        price_gross: 80,
        is_available: false,
        disabled_reason: 'sold_out',
      }),
      fee({ id: freeFeeId, name: 'Complimentary', price_gross: 0 }),
    ])

    const response = await POST(request({ registration_fee_id: freeFeeId }))

    expect(response.status).toBe(201)
    const registrationInsert = writes.find(
      (write) => write.table === 'registrations' && write.action === 'insert'
    )
    expect(registrationInsert?.payload).toMatchObject({
      registration_fee_id: freeFeeId,
      payment_status: 'not_required',
      payment_required: false,
    })
  })

  it('allows a conference configured with only a zero-price fee to register without a fee id', async () => {
    getAvailableFeesForFormMock.mockResolvedValue([
      fee({ id: freeFeeId, name: 'Complimentary', price_gross: 0 }),
    ])
    const response = await POST(request({}))
    expect(response.status).toBe(201)
    const registrationInsert = writes.find(
      (write) => write.table === 'registrations' && write.action === 'insert'
    )
    expect(registrationInsert?.payload).toMatchObject({
      registration_fee_id: null,
      payment_status: 'not_required',
      payment_required: false,
    })
  })
})
