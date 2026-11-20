export const ABSTRACT_SETTING_KEYS = [
  'abstract_submission_enabled',
  'abstract_submission_deadline',
  'abstract_submission_method',
  'abstract_template',
  'abstract_info_text',
  'custom_abstract_fields',
] as const

const REGISTRATION_SETTING_KEYS = [
  'registration_enabled',
  'payment_required',
  'max_registrations',
  'timezone',
  'registration_info_text',
  'custom_registration_fields',
  'participant_settings',
  'hotel_options',
  'payment_settings',
  'registration_addons',
] as const

export type ConferenceAdminAccess = {
  isSuperAdmin: boolean
  can_edit_conference: boolean
  can_manage_abstracts: boolean
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function partitionConferenceUpdate(body: JsonRecord): {
  conferenceBody: JsonRecord
  abstractSettings: JsonRecord
} {
  const conferenceBody: JsonRecord = {}
  const abstractSettings: JsonRecord = {}

  for (const [key, value] of Object.entries(body)) {
    if (key === 'id') continue
    if (key !== 'settings') {
      conferenceBody[key] = value
      continue
    }
    if (!isRecord(value)) {
      conferenceBody.settings = value
      continue
    }
    const conferenceSettings: JsonRecord = {}
    for (const [settingKey, settingValue] of Object.entries(value)) {
      if ((ABSTRACT_SETTING_KEYS as readonly string[]).includes(settingKey)) {
        abstractSettings[settingKey] = settingValue
      } else {
        conferenceSettings[settingKey] = settingValue
      }
    }
    if (Object.keys(conferenceSettings).length > 0) {
      conferenceBody.settings = conferenceSettings
    }
  }

  return { conferenceBody, abstractSettings }
}

export function conferenceUpdateAllowed(
  body: JsonRecord,
  access: ConferenceAdminAccess
):
  | { ok: true; conferenceBody: JsonRecord; abstractSettings: JsonRecord }
  | { ok: false; reason: 'empty' | 'forbidden' } {
  const parts = partitionConferenceUpdate(body)
  const needsConference = Object.keys(parts.conferenceBody).length > 0
  const needsAbstract = Object.keys(parts.abstractSettings).length > 0
  if (!needsConference && !needsAbstract) return { ok: false, reason: 'empty' }
  if (access.isSuperAdmin) return { ok: true, ...parts }
  if (needsConference && !access.can_edit_conference) return { ok: false, reason: 'forbidden' }
  if (needsAbstract && !access.can_manage_abstracts) return { ok: false, reason: 'forbidden' }
  return { ok: true, ...parts }
}

export function conferenceVisibleToAdmin<T extends { settings?: unknown; pricing?: unknown; email_settings?: unknown }>(
  conference: T,
  access: ConferenceAdminAccess
): T {
  if (access.isSuperAdmin) return conference
  const settings = isRecord(conference.settings) ? { ...conference.settings } : {}
  if (!access.can_edit_conference) {
    for (const key of REGISTRATION_SETTING_KEYS) delete settings[key]
  }
  if (!access.can_manage_abstracts) {
    for (const key of ABSTRACT_SETTING_KEYS) delete settings[key]
  }
  const next: T = { ...conference, settings }
  if (!access.can_edit_conference) {
    delete next.pricing
    delete next.email_settings
  }
  return next
}
