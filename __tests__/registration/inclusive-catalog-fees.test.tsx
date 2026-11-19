/**
 * The fee form sends the typed amount as gross. The public form shows that
 * gross price and does not add VAT again. Charging, the proforma and the
 * confirmation are covered in inclusive-catalog-fees-charge.test.ts.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import en from '@/messages/en.json'
import CustomRegistrationFeesSection from '@/app/admin/conferences/[id]/settings/_components/CustomRegistrationFeesSection'
import FeeTypeSelector from '@/components/registration/FeeTypeSelector'
import type { RegistrationFeeOption } from '@/types/custom-registration-fee'

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const dict = namespace.split('.').reduce<unknown>((node, part) => {
      if (!node || typeof node !== 'object') return undefined
      return (node as Record<string, unknown>)[part]
    }, en)
    return (key: string, values?: Record<string, string | number>) => {
      const raw =
        dict && typeof dict === 'object'
          ? (dict as Record<string, unknown>)[key]
          : undefined
      if (typeof raw !== 'string') return key
      if (!values) return raw
      return raw.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''))
    }
  },
}))

jest.mock('@/utils/toast', () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
}))

const conferenceId = '11111111-1111-4111-8111-111111111111'
const VAT = 25

const catalog = [
  { name: 'Participant', amount: 500 },
  { name: 'Student', amount: 400 },
  { name: 'Accompanying person', amount: 300 },
] as const

type StoredFee = RegistrationFeeOption & {
  valid_from: string
  valid_to: string
  is_active: boolean
  price_net: number
  display_order: number
  sold_count: number
  is_sold_out: boolean
}

describe('inclusive catalog fees on the forms', () => {
  const stored: StoredFee[] = []

  beforeEach(() => {
    stored.length = 0
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          name: string
          valid_from: string
          valid_to: string
          price_gross: number
          display_order: number
        }
        const fee: StoredFee = {
          id: `fee-${stored.length + 1}`,
          name: body.name,
          valid_from: body.valid_from,
          valid_to: body.valid_to,
          is_active: true,
          price_net: body.price_gross / (1 + VAT / 100),
          price_gross: body.price_gross,
          currency: 'EUR',
          is_available: true,
          display_order: body.display_order,
          sold_count: 0,
          is_sold_out: false,
          capacity: null,
        }
        stored.push(fee)
        return { ok: true, status: 200, json: async () => ({ fee }) }
      }
      return { ok: true, status: 200, json: async () => ({ fees: stored }) }
    }) as jest.Mock
  })

  it('keeps 500, 400 and 300 as the amount entered and the amount shown to the participant', async () => {
    const admin = render(
      <CustomRegistrationFeesSection
        conferenceId={conferenceId}
        currency="EUR"
        vatPercentage={VAT}
      />
    )
    await screen.findByText('No registration fees yet')

    for (const item of catalog) {
      fireEvent.click(screen.getByRole('button', { name: /Add registration fee/i }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Participant, Student'), {
        target: { value: item.name },
      })
      const dates = document.querySelectorAll('input[type="date"]')
      fireEvent.change(dates[0], { target: { value: '2026-09-15' } })
      fireEvent.change(dates[1], { target: { value: '2027-03-31' } })
      fireEvent.change(screen.getByLabelText('Gross amount (EUR)'), {
        target: { value: String(item.amount) },
      })
      expect(screen.getByLabelText('Gross amount (EUR)')).toHaveValue(item.amount)
      expect(screen.queryByText(/625/)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText(item.name)
    }

    const requests = (global.fetch as jest.Mock).mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init.body)) as Record<string, unknown>)

    expect(requests).toEqual(
      catalog.map((item, index) =>
        expect.objectContaining({
          name: item.name,
          price_gross: item.amount,
          prices_include_vat: true,
          vat_percentage: VAT,
          currency: 'EUR',
          display_order: index,
        })
      )
    )
    expect(requests.every((body) => !('price_net' in body))).toBe(true)

    for (const item of catalog) {
      const row = screen.getByText(item.name).parentElement?.parentElement
      expect(row).toHaveTextContent(`${item.amount} EUR`)
      expect(row).not.toHaveTextContent('625')
    }

    admin.unmount()

    const options: RegistrationFeeOption[] = catalog.map((item, index) => ({
      id: `fee-${index + 1}`,
      name: item.name,
      price_gross: item.amount,
      currency: 'EUR',
      is_available: true,
    }))
    render(
      <FeeTypeSelector
        registrationFees={options}
        currency="EUR"
        selectedFee=""
        onSelectFee={() => undefined}
      />
    )

    for (const item of catalog) {
      const card = screen.getByRole('button', { name: new RegExp(item.name) })
      expect(card).toHaveTextContent(String(item.amount))
      expect(card).toHaveTextContent('EUR')
      expect(card).not.toHaveTextContent('625')
    }
    expect(screen.getByRole('button', { name: /Participant/ })).not.toHaveTextContent('400')
  })
})
