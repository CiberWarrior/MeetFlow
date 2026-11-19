/**
 * Custom Registration Fee – clean model (no tiers).
 * One fee = one price + one validity period + one optional capacity.
 */

/** Database/API row: fee as stored (e.g. Supabase). */
export interface CustomRegistrationFee {
  id: string
  conference_id: string
  name: string
  valid_from: string // ISO date, inclusive
  valid_to: string // ISO date, inclusive
  is_active: boolean
  price_net: number
  price_gross: number
  capacity: number | null // null = unlimited
  currency: string
  display_order: number // for admin/form ordering
  created_at: string
  updated_at: string
}

/** Input when admin creates/updates a fee. The fee form sends the VAT-inclusive amount with prices_include_vat. */
export interface CustomRegistrationFeeInput {
  name: string
  valid_from: string
  valid_to: string
  is_active: boolean
  /** Net amount (bez PDV). When present with vat_percentage, gross is computed. */
  price_net?: number
  price_gross?: number
  /** If true, the provided price is gross; otherwise net. Legacy / when vat_percentage not sent. */
  prices_include_vat?: boolean
  /** VAT % for this fee (e.g. 25 Croatia, 19 Germany). Overrides conference VAT when provided. */
  vat_percentage?: number | null
  capacity?: number | null
  currency: string
  display_order?: number
}

/** Reason a fee is not selectable (for admin/API clarity). */
export type FeeUnavailableReason =
  | 'sold_out'
  | 'not_available_yet'
  | 'expired'
  | 'inactive'

/**
 * Fee as returned to the public registration form: only gross price; availability and reason.
 * API: GET /api/conferences/[slug]/registration-fees → { fees: RegistrationFeeOption[], currency: string }
 */
export interface RegistrationFeeOption {
  id: string
  name: string
  price_gross: number
  currency: string
  /** If true, user can select this fee. */
  is_available: boolean
  /** Set when !is_available: e.g. "Sold out", "Not available yet", "Expired", "Inactive". */
  disabled_reason?: FeeUnavailableReason
  /** For display only (e.g. "12 / 50"). Optional. */
  sold_count?: number
  capacity?: number | null
}

/** Fee as returned to the admin dashboard: net + gross, sold_count, is_sold_out. */
export interface CustomRegistrationFeeAdmin extends CustomRegistrationFee {
  sold_count: number
  is_sold_out: boolean
}
