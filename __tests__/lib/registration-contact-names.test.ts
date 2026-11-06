import {
  extractParticipantNames,
  participantNameRole,
} from '@/lib/registration-contact'

describe('participant name fields', () => {
  it('recognizes stable English and Croatian field names', () => {
    expect(participantNameRole('first_name')).toBe('first')
    expect(participantNameRole('Last Name')).toBe('last')
    expect(participantNameRole('Ime')).toBe('first')
    expect(participantNameRole('Prezime')).toBe('last')
    expect(participantNameRole('surname')).toBe('last')
    expect(participantNameRole('notes')).toBeNull()
  })

  it('reads Croatian and English names from submitted field names', () => {
    expect(
      extractParticipantNames([
        { Ime: 'Ana', Prezime: 'Horvat', email: 'ana@example.com' },
      ])
    ).toEqual({ firstName: 'Ana', lastName: 'Horvat' })

    expect(
      extractParticipantNames([
        { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
      ])
    ).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('uses the field name from the form schema and ignores a translated label', () => {
    const definitions = [
      { name: 'notes', label: 'Prezime' },
      { name: 'Ime', label: 'Given name' },
      { name: 'prezime', label: 'Family name' },
    ]

    expect(
      extractParticipantNames(
        [{ notes: 'Not a surname', Ime: 'Ana', prezime: 'Horvat' }],
        definitions
      )
    ).toEqual({ firstName: 'Ana', lastName: 'Horvat' })
  })
})
