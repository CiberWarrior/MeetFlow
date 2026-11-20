import {
  PAYMENT_REFERENCE_MODEL,
  buildBankTransferReference,
  resolveBankTransferReference,
} from '@/lib/payment-reference'

describe('buildBankTransferReference', () => {
  it('extracts a numeric poziv and keeps REG-… as the payment description', () => {
    // b8cc hex → 47308 decimal, appended so REG-001-* variants stay unique
    expect(buildBankTransferReference('REG-001-b8cc')).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '00147308',
      description: 'REG-001-b8cc',
    })
  })

  it('supports a clean sequence without a random suffix', () => {
    expect(buildBankTransferReference('IST2027-042')).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '042',
      description: 'IST2027-042',
    })
  })
})

describe('resolveBankTransferReference', () => {
  it('uses a stored numeric payment_reference as the poziv', () => {
    expect(
      resolveBankTransferReference({
        paymentReference: '001',
        registrationNumber: 'REG-001-b8cc',
      })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '001',
      description: 'REG-001-b8cc',
    })
  })

  it('derives digits when an older alphanumeric payment_reference was stored', () => {
    // 5fdd hex → 24541 decimal
    expect(
      resolveBankTransferReference({
        paymentReference: 'REG-001-5fdd',
        registrationNumber: 'REG-001-5fdd',
      })
    ).toEqual({
      model: PAYMENT_REFERENCE_MODEL,
      reference: '00124541',
      description: 'REG-001-5fdd',
    })
  })
})
