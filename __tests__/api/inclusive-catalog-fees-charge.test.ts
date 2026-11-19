/**
 * @jest-environment node
 *
 * Entered catalog prices include 25% VAT. That rate is the worked example:
 * without prices_include_vat, 500 would be stored and charged as 625.
 * The participant pays 500, 400 and 300 on the registration, the proforma
 * and in the confirmation. The public form reads the same price_gross.
 */
import { NextRequest } from 'next/server'
import { POST as createFee } from '@/app/api/admin/conferences/[id]/registration-fees/route'
import { POST as register } from '@/app/api/register/route'
import { getAvailableFeesForForm } from '@/lib/custom-registration-fees'
import { buildProformaPdfForRegistration } from '@/lib/registration-proforma-data'
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
  sendRegistrationConfirmation: jest.fn(async () => 'sent'),
  sendConferenceTeamNotification: jest.fn(async () => undefined),
}))

jest.mock('@/lib/api-auth', () => ({
  requireCanEditConference: jest.fn(async () => ({ userId: 'admin-1' })),
}))

jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))

const createAdminClientMock = createAdminClient as jest.Mock
const sendRegistrationConfirmationMock = sendRegistrationConfirmation as jest.Mock

const conferenceId = '11111111-1111-4111-8111-111111111111'
const asOf = new Date('2026-11-19T12:00:00Z')
const VAT = 25

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}

const catalog = [
  { name: 'Participant', amount: 500, net: 400 },
  { name: 'Student', amount: 400, net: 320 },
  { name: 'Accompanying person', amount: 300, net: 240 },
] as const

function resetTables() {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.conferences = [
    {
      id: conferenceId,
      name: 'IST 2027',
      slug: 'ist-2027',
      settings: {},
      email_settings: null,
      pricing: { vat_percentage: VAT, currency: 'EUR' },
      start_date: '2027-07-19',
      owner_id: 'owner-1',
      published: true,
      active: true,
    },
  ]
  tables.user_profiles = [
    {
      id: 'owner-1',
      bank_account_number: 'HR6524840081100145534',
      bank_account_holder: 'e-Tours d.o.o.',
      bank_name: 'Test Bank',
      swift_bic: 'TESTHR2X',
      organization: 'e-Tours d.o.o.',
      full_name: 'Mirela Gaspar',
      address: 'Ulica grada Vukovara 5/1',
      city: 'Zagreb',
      country: 'Croatia',
    },
  ]
  tables.custom_registration_fees = []
  tables.registrations = []
}

function rowsOf(table: string): Row[] {
  if (!tables[table]) tables[table] = []
  return tables[table]
}

function adminClient() {
  return {
    from(table: string) {
      let action: 'select' | 'insert' | 'update' = 'select'
      let payload: Row | null = null
      const filters: Array<(row: Row) => boolean> = []
      let limitN: number | null = null
      let orderCol: string | null = null
      let orderAsc = true

      const matching = () => {
        let list = rowsOf(table).filter((row) => filters.every((filter) => filter(row)))
        if (orderCol) {
          const column = orderCol
          list = [...list].sort((a, b) => {
            const av = Number(a[column])
            const bv = Number(b[column])
            if (Number.isFinite(av) && Number.isFinite(bv)) {
              return orderAsc ? av - bv : bv - av
            }
            return orderAsc
              ? String(a[column]).localeCompare(String(b[column]))
              : String(b[column]).localeCompare(String(a[column]))
          })
        }
        if (limitN != null) list = list.slice(0, limitN)
        return list
      }

      const applyWrite = () => {
        if (action === 'insert' && payload) {
          const row: Row = {
            ...payload,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          if (table === 'registrations') {
            row.registration_number = `MF-${String(rowsOf(table).length + 1).padStart(3, '0')}`
          }
          rowsOf(table).push(row)
          return row
        }
        if (action === 'update' && payload) {
          const list = matching()
          for (const row of list) Object.assign(row, payload)
          return list[0] ?? null
        }
        return null
      }

      const one = (allowEmpty: boolean) => {
        const data = action === 'select' ? (matching()[0] ?? null) : applyWrite()
        return { data, error: !data && !allowEmpty ? { message: 'not found' } : null }
      }

      const builder: Record<string, unknown> = {}
      const chain = () => builder
      Object.assign(builder, {
        select: chain,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value)
          return builder
        },
        neq: (column: string, value: unknown) => {
          filters.push((row) => row[column] !== value)
          return builder
        },
        not: chain,
        in: chain,
        like: chain,
        gt: chain,
        order: (column: string, options?: { ascending?: boolean }) => {
          orderCol = column
          orderAsc = options?.ascending !== false
          return builder
        },
        limit: (count: number) => {
          limitN = count
          return builder
        },
        insert: (value: Row) => {
          action = 'insert'
          payload = value
          return builder
        },
        update: (value: Row) => {
          action = 'update'
          payload = value
          return builder
        },
        maybeSingle: () => Promise.resolve(one(true)),
        single: () => Promise.resolve(one(false)),
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => {
          const data = action === 'select' ? matching() : applyWrite()
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
        },
      })
      return builder
    },
  }
}

describe('inclusive catalog fees are charged as entered', () => {
  beforeEach(() => {
    resetTables()
    jest.clearAllMocks()
    createAdminClientMock.mockImplementation(adminClient)
    sendRegistrationConfirmationMock.mockResolvedValue('sent')
  })

  it('charges 500, 400 and 300 euros on the registration, the proforma and the confirmation', async () => {
    for (const [index, item] of catalog.entries()) {
      const response = await createFee(
        new NextRequest(`http://localhost/api/admin/conferences/${conferenceId}/registration-fees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            valid_from: '2026-09-15',
            valid_to: '2027-03-31',
            is_active: true,
            price_gross: item.amount,
            prices_include_vat: true,
            vat_percentage: VAT,
            capacity: null,
            currency: 'EUR',
            display_order: index,
          }),
        }),
        { params: { id: conferenceId } }
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.fee).toMatchObject({
        name: item.name,
        price_gross: item.amount,
        price_net: item.net,
        currency: 'EUR',
      })
    }

    const options = await getAvailableFeesForForm(createAdminClient(), conferenceId, asOf)
    expect(options.map((option) => [option.name, option.price_gross, option.currency])).toEqual(
      catalog.map((item) => [item.name, item.amount, 'EUR'])
    )

    for (const item of catalog) {
      const fee = options.find((option) => option.name === item.name)
      const response = await register(
        new NextRequest('http://localhost/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conference_id: conferenceId,
            registration_fee_id: fee?.id,
            participants: [
              {
                customFields: {
                  email: `${item.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                  first_name: 'Ada',
                  last_name: 'Lovelace',
                },
              },
            ],
          }),
        })
      )
      expect(response.status).toBe(201)
      const registrationBody = await response.json()
      expect(registrationBody.bank_instructions).toMatchObject({
        amount: item.amount,
        currency: 'EUR',
      })

      const summary = sendRegistrationConfirmationMock.mock.calls.at(-1)?.[6] as string
      expect(summary).toContain(`Amount: ${item.amount.toFixed(2)} EUR`)
      expect(summary).not.toContain('625.00')

      const registration = rowsOf('registrations').find((row) => row.registration_fee_id === fee?.id)
      const pdf = await buildProformaPdfForRegistration(
        createAdminClient() as never,
        registration as Record<string, unknown>,
        rowsOf('conferences')[0]
      )
      expect(pdf).not.toBeNull()
      const text = Buffer.from(pdf as Buffer).toString('latin1')
      expect(text).toContain(`${item.amount.toFixed(2)} EUR`)
      expect(text).not.toContain('625.00')
      if (item.amount === 500) expect(text).not.toContain('400.00')
    }

    expect(sendRegistrationConfirmationMock).toHaveBeenCalledTimes(catalog.length)
  })
})
