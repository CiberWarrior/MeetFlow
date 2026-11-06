import { getTranslatedFieldLabelKey } from '@/lib/registration-field-labels'

export type ParticipantNameRole = 'first' | 'last'

/**
 * Classify a stored registration field name. `name` is the stable identifier
 * the form saves; display labels are not used.
 * English names come from the existing field-label map. Croatian and other
 * identifiers already used in this project are listed explicitly.
 */
export function participantNameRole(
  fieldName: string | null | undefined
): ParticipantNameRole | null {
  if (!fieldName?.trim()) return null
  const labelKey = getTranslatedFieldLabelKey(fieldName.trim(), undefined)
  if (labelKey === 'fieldLabelFirstName') return 'first'
  if (labelKey === 'fieldLabelLastName') return 'last'

  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
  if (normalized === 'ime' || normalized === 'given name') return 'first'
  if (
    normalized === 'prezime' ||
    normalized === 'surname' ||
    normalized === 'family name'
  ) {
    return 'last'
  }
  return null
}

function nonEmptyText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

/**
 * Read the participant's first and last name from submitted field values.
 * When field definitions are present, only their `name` identifiers qualify.
 * A display label such as "Prezime" does not qualify a differently named field.
 */
export function extractParticipantNames(
  sources: Array<Record<string, unknown> | null | undefined>,
  fieldDefinitions?: Array<{ name?: string | null }> | null
): { firstName: string; lastName: string } {
  const presentSources = sources.filter(
    (source): source is Record<string, unknown> =>
      !!source && typeof source === 'object'
  )
  let firstName = ''
  let lastName = ''

  const assign = (role: ParticipantNameRole, value: unknown) => {
    const text = nonEmptyText(value)
    if (!text) return
    if (role === 'first' && !firstName) firstName = text
    if (role === 'last' && !lastName) lastName = text
  }

  const readExact = (key: string): unknown => {
    for (const source of presentSources) {
      if (Object.prototype.hasOwnProperty.call(source, key)) return source[key]
    }
    return undefined
  }

  if (fieldDefinitions?.length) {
    for (const field of fieldDefinitions) {
      const role = participantNameRole(field.name)
      if (!role || !field.name) continue
      assign(role, readExact(field.name))
    }
  }

  if (!firstName || !lastName) {
    for (const source of presentSources) {
      for (const [key, value] of Object.entries(source)) {
        const role = participantNameRole(key)
        if (!role) continue
        assign(role, value)
      }
    }
  }

  return { firstName, lastName }
}

/**
 * Extract contact details from a registration across legacy columns,
 * custom_data, and participants[0].customFields.
 */
export function extractRegistrationContact(reg: Record<string, any>): {
  email: string
  firstName: string
  lastName: string
} {
  const customData = reg.custom_data || {}
  const firstParticipant =
    Array.isArray(reg.participants) && reg.participants.length > 0
      ? reg.participants[0]?.customFields ?? {}
      : {}

  const pick = (keys: string[]): string => {
    for (const source of [reg, customData, firstParticipant]) {
      for (const key of keys) {
        const value = source?.[key]
        if (value != null && String(value).trim()) return String(value).trim()
      }
    }
    return ''
  }

  return {
    email: pick(['email', 'Email', 'E-mail', 'e_mail', 'EMAIL']),
    firstName: pick(['first_name', 'firstName', 'First Name', 'ime', 'Ime']),
    lastName: pick([
      'last_name',
      'lastName',
      'Last Name',
      'prezime',
      'Prezime',
      'surname',
    ]),
  }
}

export function registrationDisplayName(reg: Record<string, any>): string {
  const { firstName, lastName, email } = extractRegistrationContact(reg)
  const name = `${firstName} ${lastName}`.trim()
  return name || email || 'Participant'
}
