/** Croatian unstructured payment model for bank transfers. */
export const PAYMENT_REFERENCE_MODEL = 'HR00' as const

export type BankTransferReference = {
  model: typeof PAYMENT_REFERENCE_MODEL
  /** Digits only — goes in "poziv na broj". */
  reference: string
  /** Registration mark — goes in payment description / svrha. */
  description: string
}

/**
 * Build HR00 payment fields from a MeetFlow registration number
 * (e.g. REG-001, REG-001-b8cc, IST2027-042).
 *
 * Digits only for the bank "poziv na broj". When the DB trigger added a
 * random hex suffix (REG-001-b8cc), append its decimal value so two
 * registrations do not share the same poziv.
 */
export function buildBankTransferReference(
  registrationNumber: string | null | undefined
): BankTransferReference {
  const description = (registrationNumber || '').trim() || 'UNKNOWN'
  const withSuffix = description.match(/^.*?-(\d+)-([a-f0-9]{4})$/i)
  if (withSuffix) {
    return {
      model: PAYMENT_REFERENCE_MODEL,
      reference: `${withSuffix[1]}${parseInt(withSuffix[2], 16)}`,
      description,
    }
  }

  const sequenced = description.match(/^.*?-(\d+)$/)
  const reference = sequenced?.[1] || description.replace(/\D/g, '') || '0'

  return {
    model: PAYMENT_REFERENCE_MODEL,
    reference,
    description,
  }
}

/**
 * Prefer a stored numeric payment_reference; otherwise derive from the
 * registration mark (covers older rows that stored REG-… as the reference).
 */
export function resolveBankTransferReference(input: {
  paymentReference?: string | null
  registrationNumber?: string | null
}): BankTransferReference {
  const stored = (input.paymentReference || '').trim()
  if (/^\d+$/.test(stored)) {
    const description =
      (input.registrationNumber || '').trim() || stored
    return {
      model: PAYMENT_REFERENCE_MODEL,
      reference: stored,
      description,
    }
  }

  return buildBankTransferReference(
    input.registrationNumber || input.paymentReference
  )
}
