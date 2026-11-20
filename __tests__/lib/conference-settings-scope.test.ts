import {
  conferenceUpdateAllowed,
  conferenceVisibleToAdmin,
} from '@/lib/conference-settings-scope'

const conference = {
  name: 'IST 2027',
  pricing: { currency: 'EUR' },
  email_settings: { reply_to: 'mice@etours.hr' },
  settings: {
    registration_enabled: true,
    payment_settings: { bank_details: { iban: 'HR00' } },
    abstract_submission_enabled: true,
    abstract_info_text: 'Guidelines',
    custom_abstract_fields: [{ id: 'topic' }],
  },
}

describe('conference settings scope', () => {
  it('lets an abstract admin change abstract settings only', () => {
    const result = conferenceUpdateAllowed(
      {
        name: 'Renamed',
        settings: {
          abstract_submission_deadline: '2027-05-01',
          payment_settings: { bank_details: { iban: 'CHANGED' } },
        },
      },
      { isSuperAdmin: false, can_edit_conference: false, can_manage_abstracts: true }
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('forbidden')
  })

  it('allows an abstract-only patch for the abstract admin', () => {
    const result = conferenceUpdateAllowed(
      { settings: { abstract_info_text: 'New guidelines', custom_abstract_fields: [] } },
      { isSuperAdmin: false, can_edit_conference: false, can_manage_abstracts: true }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.abstractSettings.abstract_info_text).toBe('New guidelines')
      expect(result.conferenceBody).toEqual({})
    }
  })

  it('rejects abstract fields from a registration admin', () => {
    const result = conferenceUpdateAllowed(
      { settings: { registration_enabled: false, abstract_submission_enabled: false } },
      { isSuperAdmin: false, can_edit_conference: true, can_manage_abstracts: false }
    )

    expect(result.ok).toBe(false)
  })

  it('lets a super admin send both parts', () => {
    const result = conferenceUpdateAllowed(
      { published: true, settings: { abstract_submission_enabled: true, registration_enabled: true } },
      { isSuperAdmin: true, can_edit_conference: false, can_manage_abstracts: false }
    )

    expect(result.ok).toBe(true)
  })

  it('hides bank details and abstract text from the other admin', () => {
    const forAbstractAdmin = conferenceVisibleToAdmin(conference, {
      isSuperAdmin: false,
      can_edit_conference: false,
      can_manage_abstracts: true,
    })
    expect(forAbstractAdmin.settings).toEqual({
      abstract_submission_enabled: true,
      abstract_info_text: 'Guidelines',
      custom_abstract_fields: [{ id: 'topic' }],
    })
    expect(forAbstractAdmin.pricing).toBeUndefined()
    expect(forAbstractAdmin.email_settings).toBeUndefined()

    const forRegistrationAdmin = conferenceVisibleToAdmin(conference, {
      isSuperAdmin: false,
      can_edit_conference: true,
      can_manage_abstracts: false,
    })
    expect(forRegistrationAdmin.settings).toEqual({
      registration_enabled: true,
      payment_settings: { bank_details: { iban: 'HR00' } },
    })
    expect(forRegistrationAdmin.email_settings).toEqual({ reply_to: 'mice@etours.hr' })
  })
})
