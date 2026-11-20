import type { SupabaseClient } from '@supabase/supabase-js'
import { log } from '@/lib/logger'

export interface ConferenceBankDetails {
  account_holder: string | null
  iban: string
  bank_name: string | null
  swift_bic: string | null
  address: string | null
}

type ConferenceLike = {
  owner_id?: string | null
  name?: string | null
  settings?: Record<string, unknown> | null
}

/**
 * Prefer bank details stored on the conference (payment_settings.bank_details).
 * Fall back to the conference owner's profile so existing conferences keep working.
 */
function asSettingsObject(
  raw: ConferenceLike['settings']
): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {}
    } catch {
      return {}
    }
  }
  return raw as Record<string, any>
}

export async function resolveConferenceBankDetails(
  supabase: SupabaseClient,
  conference: ConferenceLike
): Promise<ConferenceBankDetails | null> {
  const settings = asSettingsObject(conference.settings)
  const fromSettings = settings.payment_settings?.bank_details as
    | Partial<ConferenceBankDetails>
    | null
    | undefined

  const settingsIban =
    typeof fromSettings?.iban === 'string' ? fromSettings.iban.trim() : ''
  if (settingsIban) {
    return {
      iban: settingsIban,
      account_holder:
        (typeof fromSettings?.account_holder === 'string' &&
          fromSettings.account_holder.trim()) ||
        null,
      bank_name:
        (typeof fromSettings?.bank_name === 'string' && fromSettings.bank_name.trim()) ||
        null,
      swift_bic:
        (typeof fromSettings?.swift_bic === 'string' && fromSettings.swift_bic.trim()) ||
        null,
      address:
        (typeof fromSettings?.address === 'string' && fromSettings.address.trim()) ||
        null,
    }
  }

  if (!conference.owner_id) return null

  const { data: ownerProfile, error } = await supabase
    .from('user_profiles')
    .select(
      'bank_account_number, bank_account_holder, bank_name, swift_bic, organization, full_name'
    )
    .eq('id', conference.owner_id)
    .maybeSingle()

  if (error) {
    log.error('Failed to load organizer bank details for conference', error, {
      ownerId: conference.owner_id,
      function: 'resolveConferenceBankDetails',
    })
    return null
  }

  if (!ownerProfile) return null

  const iban =
    typeof ownerProfile.bank_account_number === 'string'
      ? ownerProfile.bank_account_number.trim()
      : ''
  if (!iban) return null

  return {
    iban,
    account_holder:
      ownerProfile.bank_account_holder ||
      ownerProfile.organization ||
      ownerProfile.full_name ||
      conference.name ||
      null,
    bank_name: ownerProfile.bank_name || null,
    swift_bic: ownerProfile.swift_bic || null,
    // user_profiles has no address columns yet
    address: null,
  }
}
