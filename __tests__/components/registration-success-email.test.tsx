import { render, screen } from '@testing-library/react'
import RegistrationSuccess from '@/components/registration/RegistrationSuccess'
import en from '@/messages/en.json'
import hr from '@/messages/hr.json'

const mockCopy: { current: Record<string, string> } = {
  current: en.registrationForm as unknown as Record<string, string>,
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const value = mockCopy.current[key]
    if (typeof value !== 'string') throw new Error(`Missing translation: ${key}`)
    return value
  },
}))

const bankInstructions = {
  recipient: 'Pilot Org',
  iban: 'HR0000000000000000000',
  bank_name: 'Test Bank',
  swift_bic: 'TESTHR2X',
  amount: 0,
  currency: 'EUR',
  reference: 'ICD11-006',
}

function renderStatus(copy: Record<string, string>, status: 'sent' | 'failed' | 'unknown') {
  mockCopy.current = copy
  return render(
    <RegistrationSuccess confirmationEmail={status} bankInstructions={bankInstructions} />
  )
}

describe('registration confirmation feedback', () => {
  it.each([
    ['en', en.registrationForm],
    ['hr', hr.registrationForm],
  ] as const)('keeps %s copy free of internal delivery errors', (_locale, copy) => {
    expect(copy.registrationSuccessMessage).not.toEqual(copy.registrationEmailFailed)
    expect(copy.registrationSuccessMessage).not.toEqual(copy.registrationEmailUnknown)
    for (const text of [copy.registrationEmailFailed, copy.registrationEmailUnknown]) {
      expect(text.toLowerCase()).not.toContain('messageid')
      expect(text.toLowerCase()).not.toContain('resend')
      expect(text.toLowerCase()).not.toContain('smtp')
    }
  })

  it('shows the sent message in English only after a provider acceptance', () => {
    renderStatus(en.registrationForm as unknown as Record<string, string>, 'sent')
    expect(screen.getByText(en.registrationForm.registrationSuccessMessage)).toBeInTheDocument()
    expect(screen.getByText(en.registrationForm.bankInstructionsEmailNote)).toBeInTheDocument()
  })

  it('does not claim an email was sent in Croatian when delivery failed', () => {
    renderStatus(hr.registrationForm as unknown as Record<string, string>, 'failed')
    expect(screen.getByText(hr.registrationForm.registrationEmailFailed)).toBeInTheDocument()
    expect(screen.queryByText(hr.registrationForm.registrationSuccessMessage)).not.toBeInTheDocument()
    expect(screen.queryByText(hr.registrationForm.bankInstructionsEmailNote)).not.toBeInTheDocument()
  })

  it('does not claim an email was sent in English when delivery is unknown', () => {
    renderStatus(en.registrationForm as unknown as Record<string, string>, 'unknown')
    expect(screen.getByText(en.registrationForm.registrationEmailUnknown)).toBeInTheDocument()
    expect(screen.queryByText(en.registrationForm.registrationSuccessMessage)).not.toBeInTheDocument()
    expect(screen.queryByText(en.registrationForm.bankInstructionsEmailNote)).not.toBeInTheDocument()
  })
})
