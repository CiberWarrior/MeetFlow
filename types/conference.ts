// Event types supported by the platform
export type EventType = 'conference' | 'workshop' | 'seminar' | 'webinar' | 'training' | 'other'

export interface Conference {
  id: string
  name: string
  slug: string
  conference_code?: string // Short abbreviation (e.g., ICD11, ISMB2025) - used in registration numbers
  event_type?: EventType // Type of event (defaults to 'conference' for backward compatibility)
  description?: string

  // Event Details
  start_date?: string
  end_date?: string
  location?: string
  venue?: string

  // Branding
  logo_url?: string
  website_url?: string
  primary_color?: string

  // Pricing
  pricing: ConferencePricing

  // Settings
  settings: ConferenceSettings

  // Email Configuration
  email_settings: EmailSettings

  // Ownership
  owner_id: string

  // Status
  active: boolean
  published: boolean

  // Timestamps
  created_at: string
  updated_at: string

  // Multi-currency support
  supported_currencies?: string[] // Array of supported currency codes
  default_currency?: string // Default currency for this conference
}

export interface CustomPricingField {
  id: string
  name: string // Naziv polja (npr. "VIP Price", "Group Discount")
  value: number // Vrijednost/cijena
  description: string // Opis polja
}

/** Standardni tipovi kotizacija – fiksni ključevi u sistemu */
export type StandardFeeTypeKey =
  | 'early_bird'
  | 'regular'
  | 'late'
  | 'student'
  | 'accompanying_person'

/** Explicit pricing mode for custom fee types. Default (when missing) is derived from amount. */
export type CustomFeeTypePricingMode = 'tiered' | 'fixed' | 'free'

/**
 * Custom tip kotizacije – admin definiše po konferenciji (npr. VIP, Senior, Prateća osoba).
 * slug: interni identifikator (lowercase, underscores); name: prikazni naziv u formi.
 */
export interface CustomFeeType {
  id: string
  slug?: string // Interni ključ (npr. "vip_member") – opcionalno; ako nije set, koristi se id
  name: string // Prikazni naziv (npr. "Participant (early)", "Exhibitor")
  /** Ako false, tip se ne prikazuje na obrascu za registraciju (admin ga može isključiti bez brisanja) */
  enabled?: boolean
  description?: string // Opcioni opis
  /** Explicit mode: tiered (Early/Regular/Late by calendar), fixed (single amount), free (0). Default tiered. */
  pricing_mode?: CustomFeeTypePricingMode
  /** Jedna cijena za cijelo razdoblje – koristi se kad je pricing_mode === 'fixed' */
  amount?: number
  early_bird: number // Koristi se kad je pricing_mode === 'tiered' (early bird period)
  regular: number // Koristi se kad je pricing_mode === 'tiered'
  late: number // Koristi se kad je pricing_mode === 'tiered'
  /** Od kada vrijedi kotizacija (ISO date) – opcionalno */
  valid_from?: string
  /** Do kada vrijedi kotizacija (ISO date) – opcionalno */
  valid_to?: string
  /** Maksimalni broj prijava za ovaj tip; kad se dosegne, primjenjuje se price_after_capacity_full */
  capacity?: number
  /** Cijena kad je kapacitet popunjen (opcionalno; ako nije setirana, koristi se late cijena) */
  price_after_capacity_full?: number
}

/** Tip sobe za smještaj – za filtriranje i izvještaje */
export type RoomType = 'single' | 'double' | 'twin' | 'suite' | 'other'

export interface HotelOption {
  id: string
  name: string // Naziv hotela i tip sobe (npr. "HOTEL VIS / KOMODOR 3 - Double SINGLE USE room standard park view")
  occupancy: string // "1 person", "2 people", etc.
  pricePerNight: number // Cijena po noći
  description?: string // Dodatne informacije
  order: number // Redoslijed prikazivanja
  room_type?: RoomType // Tip sobe: jednokrevetna, dvokrevetna, twin, suite, ostalo
  available_from?: string // ISO date string - od kada je hotel dostupan za rezervacije
  available_until?: string // ISO date string - do kada je hotel dostupan za rezervacije
  max_rooms?: number // Maksimalni broj soba dostupan za rezervaciju (opcionalno)
}

export interface ConferencePricing {
  currency: string // Default currency
  vat_percentage?: number // PDV postotak (npr. 25 za 25% PDV-a) - opcionalno, ako nije postavljen, ne prikazuje se PDV
  prices_include_vat?: boolean // If true, entered prices are VAT-inclusive (sa PDV-om). Default: false (prices are bez PDV-a).
  currencies?: string[] // Supported currencies (e.g., ['EUR', 'USD', 'GBP'])
  
  // Standard participant pricing
  early_bird: {
    amount: number | Record<string, number> // Single amount or multi-currency: { EUR: 150, USD: 170 }
    deadline?: string // ISO date string – do kada vrijedi (valid to)
    start_date?: string // ISO date string – od kada vrijedi (valid from), opcionalno
  }
  regular: {
    amount: number | Record<string, number> // Single amount or multi-currency
    start_date?: string // ISO date string – od kada vrijedi (valid from)
    end_date?: string // ISO date string – do kada vrijedi (valid to), opcionalno
  }
  late: {
    amount: number | Record<string, number> // Single amount or multi-currency
    start_date?: string // ISO date string – od kada vrijedi (valid from)
    end_date?: string // ISO date string – do kada vrijedi (valid to), opcionalno
  }
  
  // Student pricing (fixed prices per tier)
  student?: {
    early_bird: number
    regular: number
    late: number
  }
  
  // Legacy field - kept for backward compatibility (will migrate to student pricing)
  student_discount?: number | Record<string, number> // Single discount or multi-currency
  
  // Custom fee types (VIP, Senior, etc.) – admin unosi vrste kotizacija po konferenciji
  custom_fee_types?: CustomFeeType[]

  /** Prikazni nazivi za standardne tipove – po konferenciji (npr. "Prva rata" umesto "Early Bird") */
  fee_type_labels?: Partial<Record<StandardFeeTypeKey, string>>

  accompanying_person_price?: number | Record<string, number> // Price for accompanying persons (early bird)
  custom_fields?: CustomPricingField[] // Custom pricing polja koja korisnik definira
}

export interface CustomRegistrationField {
  id: string
  name: string // Naziv polja (npr. "Dietary Requirements", "Special Needs")
  type: 'text' | 'textarea' | 'longtext' | 'number' | 'email' | 'tel' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'separator' // Tip polja
  label: string // Label koji se prikazuje u formi (za separator, ovo je naslov sekcije)
  placeholder?: string // Placeholder tekst
  description?: string // Opis polja (help text)
  required: boolean // Je li polje obavezno (separator nikad nije required)
  options?: string[] // Opcije za select tip (razdvojene zarezom ili array)
  fileTypes?: string[] // Dozvoljeni file tipovi za 'file' tip polja (npr. ['.pdf', '.doc', '.docx'])
  maxFileSize?: number // Maksimalna veličina fajla u MB (za 'file' tip)
  validation?: {
    min?: number // Minimalna vrijednost za number
    max?: number // Maksimalna vrijednost za number
    minLength?: number // Minimalna duljina za text/textarea/longtext
    maxLength?: number // Maksimalna duljina za text/textarea/longtext (max 5000 za longtext)
    pattern?: string // Regex pattern za validaciju
  }
  /** Show this field only when another field matches (conditional logic) */
  showIf?: {
    fieldName: string
    operator?: 'equals' | 'not_equals' | 'contains'
    value: string
  }
}

/** Optional paid extras (workshops, dinners) configured per conference */
export interface RegistrationAddon {
  id: string
  name: string
  label: string
  description?: string
  price: number
  currency?: string
  maxQuantity?: number
  active?: boolean
}

export interface ParticipantSettings {
  enabled: boolean
  minParticipants: number
  maxParticipants: number
  requireUniqueEmails: boolean
  participantFields: string[]
  customFieldsPerParticipant: boolean
  participantLabel?: string
}

/** Optional per-conference bank recipient for registration fees (virman). */
export interface ConferenceBankDetailsSettings {
  account_holder?: string | null
  iban?: string | null
  bank_name?: string | null
  swift_bic?: string | null
  address?: string | null
}

export interface PaymentSettings {
  enabled: boolean // Enable/disable payment for this conference
  allow_card: boolean // Legacy flag — conference registration uses bank transfer only; card is platform billing
  allow_bank_transfer: boolean // Show "Pay Now - Bank Transfer" option
  allow_pay_later: boolean // Show "Pay Later" option
  default_preference: 'pay_now_card' | 'pay_now_bank' | 'pay_later' // Default payment preference selection
  required_at_registration: boolean // Force payment preference selection (cannot be optional)
  bank_transfer_deadline_days: number // Days to complete bank transfer (default: 7)
  payment_deadline_days: number // Days before conference for "pay later" (default: 30)
  /** When set, overrides the organizer profile bank account for this conference only. */
  bank_details?: ConferenceBankDetailsSettings | null
}

/** How authors submit abstracts for a conference */
export type AbstractSubmissionMethod = 'online_form' | 'document_upload'

/** Stored in conferences.settings; file lives in the private `conference-templates` bucket. */
export interface AbstractTemplate {
  file_name: string
  file_path: string
  file_size?: number
  uploaded_at: string
}

export interface ConferenceSettings {
  registration_enabled: boolean
  abstract_submission_enabled: boolean
  abstract_submission_deadline?: string // ISO date (YYYY-MM-DD); submissions blocked after end of this day
  abstract_submission_method?: AbstractSubmissionMethod // Default: 'online_form'
  abstract_template?: AbstractTemplate | null // Optional DOCX template for document_upload conferences
  payment_required: boolean
  max_registrations?: number
  timezone: string
  registration_info_text?: string // Informativni tekst koji se prikazuje na vrhu registration forme
  abstract_info_text?: string // Informativni tekst koji se prikazuje na vrhu abstract submission forme
  custom_registration_fields?: CustomRegistrationField[] // Custom polja za registracijski obrazac
  custom_abstract_fields?: CustomRegistrationField[] // Custom polja za abstract submission obrazac
  participant_settings?: ParticipantSettings // Settings for multiple participants
  hotel_options?: HotelOption[] // Dostupni hoteli za accommodation
  payment_settings?: PaymentSettings // Payment options and preferences
  registration_addons?: RegistrationAddon[] // Optional paid extras at registration
}

export interface EmailSettings {
  from_email?: string
  from_name?: string
  reply_to?: string
}

export interface CreateConferenceInput {
  name: string
  conference_code?: string // Short abbreviation (e.g., ICD11) - used in registration numbers
  event_type?: EventType // Type of event (defaults to 'conference')
  description?: string
  start_date?: string
  end_date?: string
  location?: string
  venue?: string
  website_url?: string
  logo_url?: string
  primary_color?: string
  pricing?: Partial<ConferencePricing>
  settings?: Partial<ConferenceSettings>
  email_settings?: Partial<EmailSettings>
}

export interface UpdateConferenceInput extends Partial<CreateConferenceInput> {
  id: string
  logo_url?: string
  primary_color?: string
  email_settings?: Partial<EmailSettings>
  published?: boolean
  active?: boolean
}

