import {
  PAYMENT_REFERENCE_MODEL,
  buildBankTransferReference,
  resolveBankTransferReference,
} from '@/lib/payment-reference'

describe('buildBankTransferReference', () => {
  it('prefixes the sequence with conference code digits (2027-001)', () => {
    expect(
      buildBankTransferReference('IST2027-001', { conferenceCode: 'IST2027' })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '2027-001',
      description: 'IST2027-001',
    })
  })

  it('keeps uniqueness when the registration mark has a hex suffix', () => {
    // b8cc hex → 47308 decimal; still digits + at most two hyphens
    expect(
      buildBankTransferReference('REG-001-b8cc', { conferenceCode: 'IST2027' })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '2027-001-47308',
      description: 'REG-001-b8cc',
    })
  })

  it('falls back to an explicit conference year when the code has no digits', () => {
    expect(
      buildBankTransferReference('REG-042', {
        conferenceCode: 'SUMMER',
        conferenceYear: 2027,
      })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '2027-042',
      description: 'REG-042',
    })
  })
})

describe('resolveBankTransferReference', () => {
  it('uses a stored poziv that already has digits and hyphens', () => {
    expect(
      resolveBankTransferReference({
        paymentReference: '2027-001',
        registrationNumber: 'IST2027-001',
      })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '2027-001',
      description: 'IST2027-001',
    })
  })

  it('derives a scoped poziv when an older alphanumeric payment_reference was stored', () => {
    expect(
      resolveBankTransferReference({
        paymentReference: 'REG-001-5fdd',
        registrationNumber: 'REG-001-5fdd',
        conferenceCode: 'IST2027',
      })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '2027-001-24541',
      description: 'REG-001-5fdd',
    })
  })
})
