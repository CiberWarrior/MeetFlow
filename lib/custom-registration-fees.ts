/**
 * Custom registration fee backend logic (no tiers).
 * Fetch fees, compute sold_count, determine availability for form and admin.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CustomRegistrationFee,
  CustomRegistrationFeeAdmin,
  FeeUnavailableReason,
  RegistrationFeeOption,
} from '@/types/custom-registration-fee'

/** Row from DB (decimal as string from Postgres). */
interface CustomRegistrationFeeRow {
  id: string
  conference_id: string
  name: string
  valid_from: string
  valid_to: string
  is_active: boolean
  price_net: number
  price_gross: number
  capacity: number | null
  currency: string
  display_order: number
  created_at: string
  updated_at: string
}

function rowToFee(row: CustomRegistrationFeeRow): CustomRegistrationFee {
  return {
    id: row.id,
    conference_id: row.conference_id,
    name: row.name,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    is_active: row.is_active,
    price_net: Number(row.price_net),
    price_gross: Number(row.price_gross),
    capacity: row.capacity,
    currency: row.currency,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Fetch all custom registration fees for a conference (ordered by display_order).
 */
export async function getCustomRegistrationFees(
  supabase: SupabaseClient,
  conferenceId: string
): Promise<CustomRegistrationFee[]> {
  const { data, error } = await supabase
    .from('custom_registration_fees')
    .select('*')
    .eq('conference_id', conferenceId)
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data || []).map((row) => rowToFee(row as CustomRegistrationFeeRow))
}

/**
 * Count registrations per fee id for a conference.
 * Only counts rows where registration_fee_id = ? AND status IN ('confirmed', 'paid').
 * If registrations.status column does not exist (migration 052 not run), falls back to counting all with registration_fee_id.
 */
export async function getSoldCountsByFeeId(
  supabase: SupabaseClient,
  conferenceId: string
): Promise<Record<string, number>> {
  const buildCounts = (rows: { registration_fee_id: string }[] | null): Record<string, number> => {
    const counts: Record<string, number> = {}
    for (const row of rows || []) {
      const id = row.registration_fee_id as string
      if (id) counts[id] = (counts[id] || 0) + 1
    }
    return counts
  }

  const { data, error } = await supabase
    .from('registrations')
    .select('registration_fee_id')
    .eq('conference_id', conferenceId)
    .not('registration_fee_id', 'is', null)
    .in('status', ['confirmed', 'paid'])

  if (error) {
    const msg = error.message || ''
    const missingColumn = msg.includes('status') || msg.includes('column') || error.code === '42703'
    if (missingColumn) {
      const fallback = await supabase
        .from('registrations')
        .select('registration_fee_id')
        .eq('conference_id', conferenceId)
        .not('registration_fee_id', 'is', null)
      if (fallback.error) throw fallback.error
      return buildCounts(fallback.data)
    }
    throw error
  }

  return buildCounts(data)
}

/**
 * Whether a fee is sold out: capacity is set and sold_count >= capacity.
 */
export function isFeeSoldOut(
  capacity: number | null,
  soldCount: number
): boolean {
  if (capacity == null || capacity <= 0) return false
  return soldCount >= capacity
}

/**
 * Whether the current date is within [valid_from, valid_to] (inclusive), in local date terms.
 */
export function isFeeInValidityWindow(
  validFrom: string,
  validTo: string,
  asOf: Date = new Date()
): boolean {
  const d = asOf.toISOString().slice(0, 10)
  return d >= validFrom && d <= validTo
}

/**
 * Compute disabled_reason for a fee that is not selectable.
 */
export function getFeeUnavailableReason(
  fee: CustomRegistrationFee,
  soldCount: number,
  asOf: Date = new Date()
): FeeUnavailableReason {
  if (!fee.is_active) return 'inactive'
  const d = asOf.toISOString().slice(0, 10)
  if (d < fee.valid_from) return 'not_available_yet'
  if (d > fee.valid_to) return 'expired'
  if (isFeeSoldOut(fee.capacity, soldCount)) return 'sold_out'
  return 'inactive' // fallback
}

export const REGISTRATION_FEE_REQUIRED_ERROR = 'A registration fee is required'
export const REGISTRATION_FEE_INVALID_ERROR = 'Invalid registration fee'
export const REGISTRATION_FEE_UNAVAILABLE_ERROR = 'This registration fee is not available'

export interface SelectedRegistrationFee {
  id: string
  name: string
  priceGross: number
  currency: string
}

export type RegistrationFeeSelection =
  | { ok: true; fee: SelectedRegistrationFee | null }
  | { ok: false; error: string }

/**
 * Decide whether a submitted fee id may be used for this conference.
 * Prices come only from the supplied server-side fee options.
 * A missing id is a free registration only when every configured fee has a
 * gross price of zero, or the conference has no fees. A paid fee that is
 * inactive, expired, sold out, or not yet valid is still a configured paid fee.
 */
export function selectRegistrationFee(
  fees: RegistrationFeeOption[],
  registrationFeeId: string | null | undefined
): RegistrationFeeSelection {
  const feeId = registrationFeeId?.trim() || null
  const hasConfiguredPaidFee = fees.some((fee) => Number(fee.price_gross) > 0)

  if (!feeId) {
    if (hasConfiguredPaidFee) {
      return { ok: false, error: REGISTRATION_FEE_REQUIRED_ERROR }
    }
    return { ok: true, fee: null }
  }

  const match = fees.find((fee) => fee.id === feeId)
  if (!match) {
    return { ok: false, error: REGISTRATION_FEE_INVALID_ERROR }
  }
  const priceGross = Number(match.price_gross)
  if (!match.is_available || !Number.isFinite(priceGross) || priceGross < 0) {
    return { ok: false, error: REGISTRATION_FEE_UNAVAILABLE_ERROR }
  }

  return {
    ok: true,
    fee: {
      id: match.id,
      name: match.name,
      priceGross,
      currency: match.currency || 'EUR',
    },
  }
}

/**
 * Build the list of fee options for the public registration form.
 * Returns all fees for the conference; invalid ones have is_available: false and disabled_reason set.
 * Do NOT hide the form if no fee is available — return them as disabled with reason.
 */
export async function getAvailableFeesForForm(
  supabase: SupabaseClient,
  conferenceId: string,
  asOf: Date = new Date()
): Promise<RegistrationFeeOption[]> {
  const [fees, counts] = await Promise.all([
    getCustomRegistrationFees(supabase, conferenceId),
    getSoldCountsByFeeId(supabase, conferenceId),
  ])

  return fees.map((fee) => {
    const soldCount = counts[fee.id] ?? 0
    const soldOut = isFeeSoldOut(fee.capacity, soldCount)
    const inWindow = isFeeInValidityWindow(fee.valid_from, fee.valid_to, asOf)
    const available =
      fee.is_active && inWindow && !soldOut
    let disabledReason: FeeUnavailableReason | undefined
    if (!available) {
      disabledReason = getFeeUnavailableReason(fee, soldCount, asOf)
    }

    const option: RegistrationFeeOption = {
      id: fee.id,
      name: fee.name,
      price_gross: fee.price_gross,
      currency: fee.currency,
      is_available: available,
      ...(disabledReason && { disabled_reason: disabledReason }),
      sold_count: soldCount,
      capacity: fee.capacity,
    }
    return option
  })
}

/**
 * Build the list of fees for the admin dashboard: net + gross, sold_count, is_sold_out.
 * If getSoldCountsByFeeId fails (e.g. missing registrations.status), returns fees with sold_count: 0.
 */
export async function getFeesForAdmin(
  supabase: SupabaseClient,
  conferenceId: string
): Promise<CustomRegistrationFeeAdmin[]> {
  const fees = await getCustomRegistrationFees(supabase, conferenceId)
  let counts: Record<string, number> = {}
  try {
    counts = await getSoldCountsByFeeId(supabase, conferenceId)
  } catch {
    // e.g. registrations.status column missing (migration 052 not run) and fallback failed
  }
  return fees.map((fee) => {
    const soldCount = counts[fee.id] ?? 0
    return {
      ...fee,
      sold_count: soldCount,
      is_sold_out: isFeeSoldOut(fee.capacity, soldCount),
    }
  })
}
