import { resolveConferenceBankDetails } from '@/lib/conference-bank-details'

describe('resolveConferenceBankDetails', () => {
  it('prefers conference payment_settings.bank_details over the owner profile', async () => {
    const from = jest.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              bank_account_number: 'HR0000000000000000000',
              bank_account_holder: 'Profile Holder',
              bank_name: 'Old Bank',
              swift_bic: null,
              organization: null,
              full_name: null,
            },
            error: null,
          }),
        }),
      }),
    }))

    const bank = await resolveConferenceBankDetails({ from } as never, {
      owner_id: 'owner-1',
      name: 'IST 2027',
      settings: {
        payment_settings: {
          bank_details: {
            account_holder: 'e-Tours d.o.o.',
            iban: 'HR6524840081100145534',
            bank_name: 'Raiffeisenbank Austria d.d.',
            swift_bic: null,
            address: 'Ulica grada Vukovara 5/1, 10000 Zagreb',
          },
        },
      },
    })

    expect(bank).toEqual({
      account_holder: 'e-Tours d.o.o.',
      iban: 'HR6524840081100145534',
      bank_name: 'Raiffeisenbank Austria d.d.',
      swift_bic: null,
      address: 'Ulica grada Vukovara 5/1, 10000 Zagreb',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('parses stringified conference settings before reading bank_details', async () => {
    const from = jest.fn()

    const bank = await resolveConferenceBankDetails({ from } as never, {
      owner_id: 'owner-1',
      name: 'IST 2027',
      settings: JSON.stringify({
        payment_settings: {
          bank_details: {
            account_holder: 'e-Tours d.o.o.',
            iban: 'HR6524840081100145534',
            bank_name: 'Raiffeisenbank Austria d.d.',
            swift_bic: null,
            address: 'Ulica grada Vukovara 5/1, 10000 Zagreb',
          },
        },
      }),
    })

    expect(bank?.iban).toBe('HR6524840081100145534')
    expect(bank?.account_holder).toBe('e-Tours d.o.o.')
    expect(from).not.toHaveBeenCalled()
  })

  it('falls back to the owner profile when conference bank_details are empty', async () => {
    const from = jest.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              bank_account_number: 'HR6524840081100145534',
              bank_account_holder: 'e-Tours d.o.o.',
              bank_name: 'Raiffeisenbank Austria d.d.',
              swift_bic: null,
              organization: null,
              full_name: 'Renata',
            },
            error: null,
          }),
        }),
      }),
    }))

    const bank = await resolveConferenceBankDetails({ from } as never, {
      owner_id: 'owner-1',
      name: 'IST 2027',
      settings: { payment_settings: {} },
    })

    expect(bank?.iban).toBe('HR6524840081100145534')
    expect(bank?.account_holder).toBe('e-Tours d.o.o.')
    expect(from).toHaveBeenCalledWith('user_profiles')
  })
})
