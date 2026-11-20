/** Croatian unstructured payment model for bank transfers. */
export const PAYMENT_REFERENCE_MODEL = 'HR00' as const

/** Poziv na broj: digits and at most two hyphens (no letters). */
export const PAYMENT_REFERENCE_PATTERN = /^\d+(-\d+){0,2}$/

export type BankTransferReference = {
  model: typeof PAYMENT_REFERENCE_MODEL
  /** Digits and up to two hyphens — goes in "poziv na broj". */
  reference: string
  /** Registration mark — goes in payment description / svrha. */
  description: string
}

export type BankTransferReferenceContext = {
  conferenceCode?: string | null
  /** Full year, e.g. 2027 — used when conference code has no digits. */
  conferenceYear?: number | string | null
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Conference scope for the poziv: digits from conference_code (IST2027 → 2027),
 * else an explicit year, else digits embedded in the registration mark.
 */
export function paymentReferencePrefix(
  registrationNumber: string,
  context: BankTransferReferenceContext = {}
): string {
  const fromCode = digitsOnly((context.conferenceCode || '').trim())
  if (fromCode) return fromCode

  const yearRaw = context.conferenceYear
  if (yearRaw !== null && yearRaw !== undefined && String(yearRaw).trim() !== '') {
    const yearDigits = digitsOnly(String(yearRaw))
    if (yearDigits) return yearDigits
  }

  const fromMark = registrationNumber.match(/(\d{4})/)
  return fromMark?.[1] || ''
}

/**
 * Build HR00 payment fields from a MeetFlow registration number
 * (e.g. REG-001, REG-001-b8cc, IST2027-042).
 *
 * Poziv uses conference year/code digits + sequence, e.g. 2027-001.
 * Optional hex suffix from the DB trigger becomes a third numeric segment
 * (still ≤ 2 hyphens): 2027-001-47308.
 */
export function buildBankTransferReference(
  registrationNumber: string | null | undefined,
  context: BankTransferReferenceContext = {}
): BankTransferReference {
  const description = (registrationNumber || '').trim() || 'UNKNOWN'
  const prefix = paymentReferencePrefix(description, context)

  const withSuffix = description.match(/^.*?-(\d+)-([a-f0-9]{4})$/i)
  const sequenced = description.match(/^.*?-(\d+)$/)
  const sequence =
    withSuffix?.[1] || sequenced?.[1] || digitsOnly(description) || '0'
  const suffixDecimal = withSuffix
    ? String(parseInt(withSuffix[2], 16))
    : null

  const parts = [prefix, sequence, suffixDecimal].filter(
    (part): part is string => !!part
  )
  const reference = parts.join('-') || '0'

  return {
    model: PAYMENT_REFERENCE_MODEL,
    reference,
    description,
  }
}

/**
 * Prefer a stored poziv that already matches the allowed pattern; otherwise
 * derive from the registration mark (and optional conference context).
 */
export function resolveBankTransferReference(input: {
  paymentReference?: string | null
  registrationNumber?: string | null
  conferenceCode?: string | null
  conferenceYear?: number | string | null
}): BankTransferReference {
  const stored = (input.paymentReference || '').trim()
  if (PAYMENT_REFERENCE_PATTERN.test(stored)) {
    const description =
      (input.registrationNumber || '').trim() || stored
    return {
      model: PAYMENT_REFERENCE_MODEL,
      reference: stored,
      description,
    }
  }

  return buildBankTransferReference(input.registrationNumber || input.paymentReference, {
    conferenceCode: input.conferenceCode,
    conferenceYear: input.conferenceYear,
  })
}
