import { getMobilePhoneIssue, normalizeMobilePhone } from '@/lib/mobile-phone'

describe('international phone input', () => {
  it('accepts an empty value', () => {
    expect(getMobilePhoneIssue('')).toBeNull()
    expect(getMobilePhoneIssue('   ')).toBeNull()
    expect(normalizeMobilePhone('   ')).toBe('')
  })

  it('accepts international numbers and stores digits with a single leading +', () => {
    expect(getMobilePhoneIssue('+385 91 234 5678')).toBeNull()
    expect(normalizeMobilePhone('+385 91 234 5678')).toBe('+385912345678')
    expect(getMobilePhoneIssue('+44 7700 900123')).toBeNull()
    expect(normalizeMobilePhone('+44 7700 900123')).toBe('+447700900123')
    expect(getMobilePhoneIssue('+385 (91) 234-5678')).toBeNull()
    expect(normalizeMobilePhone('+385 (91) 234-5678')).toBe('+385912345678')
  })

  it('rejects a local number without adding +385', () => {
    expect(getMobilePhoneIssue('091 234 5678')).toBe('missing_country')
    expect(normalizeMobilePhone('091 234 5678')).toBe('0912345678')
  })

  it('rejects a repeated plus and a country code that starts with 0', () => {
    expect(getMobilePhoneIssue('++385912345678')).toBe('invalid')
    expect(getMobilePhoneIssue('+012345678')).toBe('invalid')
    expect(getMobilePhoneIssue('nije broj')).toBe('invalid')
    expect(getMobilePhoneIssue('+123456')).toBe('invalid')
    expect(getMobilePhoneIssue('+1234567890123456')).toBe('invalid')
  })
})
