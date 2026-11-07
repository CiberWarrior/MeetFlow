export type MobilePhoneIssue = 'missing_country' | 'invalid'

/** One leading + and 7–15 digits. The first digit cannot be 0. */
const NORMALIZED_PHONE = /^\+[1-9]\d{6,14}$/

/**
 * Removes spaces, hyphens, and parentheses.
 * Does not add a country code.
 */
export function normalizeMobilePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, '')
}

/**
 * Empty input is allowed. A filled value must already include + and a country code.
 * This checks shape only. It does not confirm the number exists.
 */
export function getMobilePhoneIssue(value: string): MobilePhoneIssue | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const plusCount = (trimmed.match(/\+/g) || []).length
  const hasOnlyAllowedCharacters = /^\+?[\d\s()-]+$/.test(trimmed)

  if (!hasOnlyAllowedCharacters || plusCount > 1 || (plusCount === 1 && !trimmed.startsWith('+'))) {
    return 'invalid'
  }
  if (plusCount === 0) return 'missing_country'
  if (!NORMALIZED_PHONE.test(normalizeMobilePhone(trimmed))) return 'invalid'

  return null
}
