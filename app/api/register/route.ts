import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ZodError } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'
import {
  ATTACHMENT_REFERENCE_LABEL,
  parseRegistrationAttachmentPath,
} from '@/lib/registration-attachment'
import {
  registrationRateLimit,
  getClientIP,
  checkRateLimit,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}


// Payer type and company details (for invoicing / billing)
const companyDetailsSchema = z
  .object({
    vat_number: z.string().nullable().optional(),
    no_vat: z.boolean().optional().default(false),
    company_name: z.string().min(1),
    country: z.string().min(1),
    city: z.string().min(1),
    postal_code: z.string().min(1),
    address: z.string().min(1),
    phone: z.string().nullable().optional(),
  })
  .optional()
  .nullable()

// Simplified registration schema - all fields are custom and defined by admin
const registrationSchema = z.object({
  conference_id: z.string().uuid(),
  custom_data: z.record(z.any()).optional(), // Custom fields defined by admin
  registration_fee_type: z.string().optional().nullable(),
  registration_fee_id: z.string().uuid().optional().nullable(), // New: custom_registration_fees.id when using new fee system
  selected_addons: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().int().min(1).max(20).default(1),
      })
    )
    .optional()
    .default([]),
  // Pay Later removed from product; keep only immediate options
  payment_preference: z.enum(['pay_now_card', 'pay_now_bank']).optional().default('pay_now_bank'),
  participants: z
    .array(
      z.object({
        customFields: z.record(z.any()),
        isAccompanying: z.boolean().optional(),
        accompanyingForIndex: z.number().int().nullable().optional(),
      })
    )
    .optional(),
  accommodation: z
    .object({
      arrival_date: z.string(),
      departure_date: z.string(),
      number_of_nights: z.number(),
      hotel_id: z.string().nullable().optional(), // Selected hotel ID
    })
    .optional()
    .nullable(), // Accommodation details (arrival, departure, nights, hotel)
  // Payer type: person or company; company_details required when payer_type === 'company'
  payer_type: z.enum(['person', 'company']).optional().default('person'),
  company_details: companyDetailsSchema,
  // Bank transfer proof. New uploads store a bucket path; older rows store a public URL.
  bank_transfer_proof_url: z
    .string()
    .optional()
    .nullable()
    .refine((value) => value == null || value === '' || parseRegistrationAttachmentPath(value) !== null, {
      message: 'Invalid registration attachment',
    }),
  // Jezik e-maila potvrde: 'hr' ili 'en'
  locale: z.enum(['hr', 'en']).optional().default('en'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = getClientIP(request)
    const rateLimitResult = await checkRateLimit(registrationRateLimit, ip)

    if (rateLimitResult && !rateLimitResult.success) {
      const retryAfter = Math.ceil(
        (rateLimitResult.reset - Date.now()) / 1000
      )
      log.warn('Rate limit exceeded for registration', {
        ip,
        retryAfter,
        action: 'registration_rate_limit',
      })
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
          retryAfter,
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      )
    }

    const body = await request.json()
    log.info('Registration request received', {
      conferenceId: body.conference_id,
      hasCustomData: !!body.custom_data,
      participantsCount: body.participants?.length || 0,
      action: 'registration_attempt',
    })

    const validatedData = registrationSchema.parse(body)
    // Registration is a public/anonymous endpoint. RLS on registrations,
    // custom_registration_fees and participant_* tables is scoped to admins
    // (migration 056), so this route must use the service role client
    // throughout rather than a session-based client.
    const supabase = createAdminClient()

    // Verify conference exists and is active
      const { data: conference, error: confError } = await supabase
        .from('conferences')
      .select('id, name, slug, settings, email_settings, pricing, start_date, owner_id')
      .eq('id', validatedData.conference_id)
        .eq('published', true)
        .eq('active', true)
        .single()

      if (confError || !conference) {
      log.warn('Conference not found for registration', {
        conferenceId: validatedData.conference_id,
        action: 'registration_validation',
      })
        return NextResponse.json(
          { error: 'Conference not found or not available' },
          { status: 404 }
        )
      }

      // Check if registration is enabled for this conference
      const settings = conference.settings || {}
      if (settings.registration_enabled === false) {
      log.warn('Registration not enabled for conference', {
        conferenceId: validatedData.conference_id,
        conferenceName: conference.name,
        action: 'registration_validation',
      })
        return NextResponse.json(
          { error: 'Registration is not enabled for this conference' },
          { status: 403 }
        )
      }

    // Extract a "primary" email from custom_data or first participant for duplicate check
    let primaryEmail: string | null = null
    
    // Try to get email from custom_data first
    if (validatedData.custom_data) {
      for (const [key, value] of Object.entries(validatedData.custom_data)) {
        if (key.toLowerCase().includes('email') && typeof value === 'string' && value.includes('@')) {
          primaryEmail = value
          break
        }
      }
    }

    // If no email in custom_data, try first participant's customFields
    if (!primaryEmail && validatedData.participants && validatedData.participants.length > 0) {
      const firstParticipant = validatedData.participants[0]
      if (firstParticipant.customFields) {
        for (const [key, value] of Object.entries(firstParticipant.customFields)) {
          if (key.toLowerCase().includes('email') && typeof value === 'string' && value.includes('@')) {
            primaryEmail = value
            break
          }
        }
      }
    }

    // A1: Require at least one contact email for confirmation and notifications
    if (!primaryEmail || !primaryEmail.includes('@')) {
      log.warn('Registration without valid email rejected', {
        conferenceId: validatedData.conference_id,
        action: 'registration_validation',
      })
      return NextResponse.json(
        { error: 'A valid email address is required for registration' },
        { status: 400 }
      )
    }

    // Check for duplicate registration if we have a primary email.
    // We run two separate queries to avoid string interpolation in .or() filters
    // (which can break on special characters and is not safe).
    if (primaryEmail) {
      const { data: existingByEmail } = await supabase
        .from('registrations')
        .select('id')
        .eq('conference_id', validatedData.conference_id)
        .eq('email', primaryEmail)
        .maybeSingle()

      const { data: existingByCustomData } = existingByEmail
        ? { data: null }
        : await supabase
            .from('registrations')
            .select('id')
            .eq('conference_id', validatedData.conference_id)
            .eq('custom_data->>email', primaryEmail)
            .maybeSingle()

      if (existingByEmail || existingByCustomData) {
        log.warn('Duplicate registration attempt', {
          conferenceId: validatedData.conference_id,
          email: primaryEmail,
          action: 'registration_validation',
        })
        return NextResponse.json(
          { error: 'This email is already registered for this conference' },
          { status: 400 }
        )
      }
    }

    const customRegistrationFields =
      ((settings as Record<string, unknown>).custom_registration_fields as Array<{
        id: string
        name: string
        label?: string
        type: string
        required?: boolean
        showIf?: { fieldName: string; operator?: string; value: string }
      }>) || []
    const participantSettingsRaw = (settings as Record<string, unknown>)
      .participant_settings as Record<string, unknown> | undefined
    const multiParticipantEnabled = participantSettingsRaw?.enabled === true
    const participantSettingsForValidation = multiParticipantEnabled
      ? participantSettingsRaw
      : {
          ...participantSettingsRaw,
          minParticipants: 1,
          maxParticipants: 1,
          requireUniqueEmails: participantSettingsRaw?.requireUniqueEmails,
        }

    const participantsList = validatedData.participants?.length
      ? validatedData.participants
      : [{ customFields: validatedData.custom_data || {} }]

    const { validateParticipantsInput } = await import(
      '@/lib/registration-participant-validation'
    )
    const participantValidationError = validateParticipantsInput(
      participantsList,
      customRegistrationFields as any,
      participantSettingsForValidation as any
    )
    if (participantValidationError) {
      const err = participantValidationError
      let message = 'Invalid participant data'
      if (err.code === 'min_participants') {
        message = `At least ${err.min} participant(s) are required`
      } else if (err.code === 'max_participants') {
        message = `Maximum ${err.max} participants allowed`
      } else if (err.code === 'duplicate_email') {
        message = `Email ${err.email} is already used by another participant in this registration`
      } else if (err.code === 'field_required') {
        message = `Participant ${(err.participantIndex ?? 0) + 1}: ${err.fieldLabel} is required`
      } else if (err.code === 'accompanying_target_required') {
        message = `Participant ${(err.participantIndex ?? 0) + 1}: select who this accompanying person is with`
      } else if (err.code === 'accompanying_invalid_target') {
        message = `Participant ${(err.participantIndex ?? 0) + 1}: invalid accompanying person link`
      }
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Determine payment method and status (A7: free fee -> not_required)
    let paymentMethod: string | null = null
    let paymentStatus: string = 'not_required'
    let feeAmount = 0
    let feeCurrency = 'EUR'
    if (validatedData.registration_fee_id) {
      const { data: feeRow } = await supabase
        .from('custom_registration_fees')
        .select('price_gross, currency')
        .eq('id', validatedData.registration_fee_id)
        .eq('conference_id', validatedData.conference_id)
        .single()
      feeAmount = feeRow ? Number(feeRow.price_gross ?? 0) : 0
      feeCurrency = (feeRow?.currency as string) || 'EUR'
    }

    // Resolve selected add-ons against conference settings
    const addonCatalog =
      ((conference.settings as any)?.registration_addons as Array<{
        id: string
        label?: string
        name?: string
        price?: number
        active?: boolean
      }>) || []
    const selectedAddonsPayload = (validatedData.selected_addons || [])
      .map((sel) => {
        const catalog = addonCatalog.find((a) => a.id === sel.id && a.active !== false)
        if (!catalog) return null
        const qty = sel.quantity || 1
        const unit = Number(catalog.price || 0)
        return {
          id: catalog.id,
          label: catalog.label || catalog.name || catalog.id,
          quantity: qty,
          unit_price: unit,
          line_total: unit * qty,
        }
      })
      .filter(Boolean) as Array<{
      id: string
      label: string
      quantity: number
      unit_price: number
      line_total: number
    }>
    const addonsTotal = selectedAddonsPayload.reduce((s, a) => s + a.line_total, 0)
    const chargeable = feeAmount + addonsTotal
    const effectivelyFree = chargeable <= 0

    if (!effectivelyFree) {
      // Conference registration: bank transfer only (card is platform billing only).
      if (validatedData.payment_preference === 'pay_now_card') {
        return NextResponse.json(
          { error: 'Card payment is not available for conference registration' },
          { status: 400 }
        )
      }
      paymentMethod = 'bank_transfer'
      paymentStatus = 'pending'
    }

    // Merge payer_type and company_details into custom_data for storage and admin display
    const customDataWithPayer = {
      ...(validatedData.custom_data || {}),
      payer_type: validatedData.payer_type ?? 'person',
      company_details: validatedData.company_details ?? null,
    }

    // Insert registration with simplified data structure
    const { data: registration, error: insertError } = await supabase
      .from('registrations')
      .insert({
        conference_id: validatedData.conference_id,
        custom_data: customDataWithPayer,
        participants: validatedData.participants || [],
        registration_fee_type: null, // Legacy column; new flow uses registration_fee_id only
        registration_fee_id: validatedData.registration_fee_id ?? null,
        selected_addons: selectedAddonsPayload,
        payment_method: paymentMethod,
        payment_status: paymentStatus, // Payment status based on preference
        bank_transfer_proof_url:
          paymentMethod === 'bank_transfer' ? validatedData.bank_transfer_proof_url ?? null : null,
        accommodation: validatedData.accommodation || null, // Store accommodation in registrations table as well
        // Legacy fields set to null/false for compatibility
        first_name: null,
        last_name: null,
        email: primaryEmail || null,
        phone: null,
        country: null,
        institution: null,
        arrival_date: null,
        departure_date: null,
        // Non-free fee => a payment is required (drives the admin "Payment required"
        // column and the pending-payments counter / reminders in /admin/payments)
        payment_required: !effectivelyFree,
        payment_by_card: false,
        accompanying_persons: false,
        accompanying_persons_data: [],
        gala_dinner: false,
        presentation_type: false,
        abstract_submission: false,
      })
      .select()
      .single()

    if (insertError) {
      log.error('Registration database error', insertError, {
        conferenceId: validatedData.conference_id,
        action: 'create_registration',
        errorDetails: insertError.message,
      })
      return NextResponse.json(
        { 
          error: 'Failed to save registration',
          details: insertError.message || 'Database error occurred',
        },
        { status: 500 }
      )
    }

    log.info('Registration created successfully', {
          registrationId: registration.id,
      conferenceId: validatedData.conference_id,
      conferenceName: conference.name,
      participantsCount: validatedData.participants?.length || 0,
      action: 'registration_success',
        })

    // ============================================
    // BANK TRANSFER: payment reference + instructions
    // ============================================
    // For bank transfers, store the payment reference (poziv na broj) and amount,
    // and prepare the organizer's bank details for the success screen and email.
    let bankInstructions: {
      recipient: string | null
      iban: string
      bank_name: string | null
      swift_bic: string | null
      amount: number
      currency: string
      reference: string | null
    } | null = null

    let registrationManageToken: string | null = null

    if (paymentMethod === 'bank_transfer' && chargeable > 0) {
      // Registration number (e.g. ICD11-001) is auto-generated by a DB trigger and
      // is unique, so it doubles as the payment reference.
      const paymentReference: string | null = registration.registration_number ?? null

      const { error: refUpdateError } = await supabase
        .from('registrations')
        .update({
          payment_reference: paymentReference,
          payment_amount: chargeable,
          payment_currency: feeCurrency,
        })
        .eq('id', registration.id)

      if (refUpdateError) {
        log.error('Failed to store payment reference', refUpdateError, {
          registrationId: registration.id,
          action: 'store_payment_reference',
        })
        // Not fatal – instructions are still shown/emailed; admin matches by proof/email
      }

      if (conference.owner_id) {
        // Bank details are intentionally shared with the payer for bank transfer.
        const { data: ownerProfile } = await supabase
          .from('user_profiles')
          .select('bank_account_number, bank_account_holder, bank_name, swift_bic')
          .eq('id', conference.owner_id)
          .maybeSingle()

        if (ownerProfile?.bank_account_number) {
          bankInstructions = {
            recipient: ownerProfile.bank_account_holder || null,
            iban: ownerProfile.bank_account_number,
            bank_name: ownerProfile.bank_name || null,
            swift_bic: ownerProfile.swift_bic || null,
            amount: chargeable,
            currency: feeCurrency,
            reference: paymentReference,
          }
        } else {
          return NextResponse.json(
            {
              error:
                'Bank transfer is not available for this conference yet. Please contact the organizer.',
            },
            { status: 503 }
          )
        }
      } else {
        return NextResponse.json(
          {
            error:
              'Bank transfer is not available for this conference yet. Please contact the organizer.',
          },
          { status: 503 }
        )
      }

      try {
        const { createRegistrationManageToken } = await import(
          '@/lib/registration-manage-token'
        )
        registrationManageToken = await createRegistrationManageToken(registration.id)
      } catch (tokenErr) {
        log.warn('Failed to create registration manage token', tokenErr)
      }
    }

    // ============================================
    // AUTO-CREATE TICKET WHEN HOTEL REACHES CAPACITY
    // ============================================
    const hotelId = validatedData.accommodation?.hotel_id
    if (hotelId && conference.settings?.hotel_options) {
      const hotelOptions = conference.settings.hotel_options as Array<{ id: string; name?: string; max_rooms?: number }>
      const hotel = hotelOptions.find((h) => h.id === hotelId)
      const maxRooms = hotel?.max_rooms
      if (typeof maxRooms === 'number' && maxRooms > 0) {
        const { data: allRegs } = await supabase
          .from('registrations')
          .select('id, accommodation')
          .eq('conference_id', validatedData.conference_id)
          .not('accommodation', 'is', null)
        const count = allRegs?.filter((r) => (r.accommodation as { hotel_id?: string })?.hotel_id === hotelId).length ?? 0
        if (count >= maxRooms) {
          try {
            const marker = `Hotel ID: ${hotelId}`
            const { data: existing } = await supabase
              .from('support_tickets')
              .select('id')
              .eq('conference_id', validatedData.conference_id)
              .eq('category', 'accommodation_full')
              .like('description', `%${marker}%`)
              .limit(1)
              .maybeSingle()
            if (!existing) {
              await supabase.from('support_tickets').insert({
                subject: `Smještaj popunjen: ${String(hotel?.name || hotelId).slice(0, 200)}`,
                description: `${marker}. Sve rezervirane sobe su popunjene.`,
                status: 'open',
                priority: 'high',
                category: 'accommodation_full',
                conference_id: validatedData.conference_id,
                created_by_user_id: null,
                created_by_email: null,
              })
              log.info('Auto-created support ticket for full hotel', {
                conferenceId: validatedData.conference_id,
                hotelId,
                count,
                maxRooms,
                action: 'ticket_auto_create',
              })
            }
          } catch (ticketErr) {
            log.error('Auto-create ticket for full hotel failed', ticketErr, {
              conferenceId: validatedData.conference_id,
              hotelId,
              action: 'ticket_auto_create',
            })
          }
        }
      }
    }

    // ============================================
    // PARTICIPANT PROFILE SYSTEM INTEGRATION
    // ============================================
    // Create or link participant profile for the registrant
    if (primaryEmail) {
      try {
        const participantDb = supabase

        // Extract participant info from custom_data or first participant
        let participantInfo = {
          email: primaryEmail,
          first_name: '',
          last_name: '',
          phone: null as string | null,
          country: null as string | null,
          institution: null as string | null,
        }

        // Try to extract from custom_data
        if (validatedData.custom_data) {
          for (const [key, value] of Object.entries(validatedData.custom_data)) {
            const lowerKey = key.toLowerCase().trim() // Trim whitespace from field names!
            if (lowerKey.includes('first') && lowerKey.includes('name')) {
              participantInfo.first_name = String(value || '')
            } else if (lowerKey.includes('last') && lowerKey.includes('name')) {
              participantInfo.last_name = String(value || '')
            } else if (lowerKey.includes('phone')) {
              participantInfo.phone = String(value || '')
            } else if (lowerKey.includes('country')) {
              participantInfo.country = String(value || '')
            } else if (lowerKey.includes('institution') || lowerKey.includes('organization')) {
              participantInfo.institution = String(value || '')
            }
          }
        }

        // If still no name, try first participant
        if ((!participantInfo.first_name || !participantInfo.last_name) && validatedData.participants && validatedData.participants.length > 0) {
          const firstParticipant = validatedData.participants[0].customFields
          
          for (const [key, value] of Object.entries(firstParticipant)) {
            const lowerKey = key.toLowerCase().trim() // Trim whitespace from field names!
            if (!participantInfo.first_name && lowerKey.includes('first') && lowerKey.includes('name')) {
              participantInfo.first_name = String(value || '')
            } else if (!participantInfo.last_name && lowerKey.includes('last') && lowerKey.includes('name')) {
              participantInfo.last_name = String(value || '')
            } else if (!participantInfo.phone && lowerKey.includes('phone')) {
              participantInfo.phone = String(value || '')
            } else if (!participantInfo.country && lowerKey.includes('country')) {
              participantInfo.country = String(value || '')
            } else if (!participantInfo.institution && (lowerKey.includes('institution') || lowerKey.includes('organization'))) {
              participantInfo.institution = String(value || '')
            }
          }
        }

        // Check if participant profile already exists
        const { data: existingProfile } = await participantDb
          .from('participant_profiles')
          .select('id')
          .eq('email', primaryEmail)
          .single()

        let participantProfileId: string | null = null

        if (existingProfile) {
          // Use existing profile
          participantProfileId = existingProfile.id
          log.info('Using existing participant profile', {
            participantProfileId,
            email: primaryEmail,
          })
        } else {
          // Create new participant profile
          const { data: newProfile, error: profileError } = await participantDb
            .from('participant_profiles')
            .insert({
              email: participantInfo.email,
              first_name: participantInfo.first_name || 'Guest',
              last_name: participantInfo.last_name || 'Participant',
              phone: participantInfo.phone,
              country: participantInfo.country,
              institution: participantInfo.institution,
              has_account: false, // Guest participant (no login yet)
              email_notifications: true,
              marketing_consent: false,
            })
            .select('id')
            .single()

          if (profileError) {
            log.error('Failed to create participant profile', profileError, {
              email: primaryEmail,
            })
            // Don't fail the registration, just log the error
          } else {
            participantProfileId = newProfile.id
            log.info('Created new participant profile', {
              participantProfileId,
              email: primaryEmail,
            })
          }
        }

        // Ensure registration is linked for both existing and newly created participant profiles.
        if (participantProfileId) {
          const { error: updateError } = await participantDb
            .from('registrations')
            .update({ participant_profile_id: participantProfileId })
            .eq('id', registration.id)

          if (updateError) {
            log.error('Failed to update registration with participant_profile_id', updateError)
          } else {
            log.info('Successfully linked registration to participant profile', {
              registrationId: registration.id,
              participantProfileId,
            })
          }

          const { data: existingLink } = await participantDb
            .from('participant_registrations')
            .select('id')
            .eq('participant_id', participantProfileId)
            .eq('conference_id', validatedData.conference_id)
            .neq('status', 'cancelled')
            .maybeSingle()

          if (existingLink?.id) {
            const { error: linkUpdateError } = await participantDb
              .from('participant_registrations')
              .update({
                registration_id: registration.id,
                status: 'confirmed',
                custom_data: validatedData.custom_data || {},
                registration_fee_type: null,
                payment_status: paymentStatus,
                accommodation_data: validatedData.accommodation,
              })
              .eq('id', existingLink.id)

            if (linkUpdateError) {
              log.error('Failed to update participant registration link', linkUpdateError)
            } else {
              log.info('Participant registration link updated', {
                participantProfileId,
                conferenceId: validatedData.conference_id,
                registrationId: registration.id,
              })
            }
          } else {
            const { error: linkInsertError } = await participantDb
              .from('participant_registrations')
              .insert({
                participant_id: participantProfileId,
                conference_id: validatedData.conference_id,
                registration_id: registration.id,
                status: 'confirmed',
                custom_data: validatedData.custom_data || {},
                registration_fee_type: null,
                payment_status: paymentStatus,
                accommodation_data: validatedData.accommodation,
              })

            if (linkInsertError) {
              log.error('Failed to create participant registration link', linkInsertError)
            } else {
              log.info('Participant registration link created', {
                participantProfileId,
                conferenceId: validatedData.conference_id,
                registrationId: registration.id,
              })
            }
          }
        }
      } catch (profileError) {
        log.error('Error in participant profile integration', profileError as Error)
        // Don't fail the registration, continue
      }
    }
    // ============================================
    // END PARTICIPANT PROFILE INTEGRATION
    // ============================================

    // Send confirmation email to participant (with summary of what they filled in)
    if (primaryEmail) {
      try {
        const { sendRegistrationConfirmation } = await import('@/lib/email')

        let confirmFirstName = 'Participant'
        let confirmLastName = ''
        if (validatedData.participants && validatedData.participants.length > 0) {
          const first = validatedData.participants[0].customFields
          for (const [key, value] of Object.entries(first)) {
            const k = (key as string).toLowerCase()
            if (k.includes('first') && k.includes('name')) confirmFirstName = String(value ?? 'Participant')
            if (k.includes('last') && k.includes('name')) confirmLastName = String(value ?? '')
          }
        }

        // Build registration summary (HTML) for confirmation email – sve što je ispunio na obrascu
        const summaryParts: string[] = []
        if (validatedData.participants && validatedData.participants.length > 0) {
          validatedData.participants.forEach((p, i) => {
            const num = validatedData.participants!.length > 1 ? ` ${i + 1}` : ''
            summaryParts.push(`<p style="margin: 0 0 8px 0;"><strong>Participant${num}</strong></p>`)
            Object.entries(p.customFields || {}).forEach(([label, value]) => {
              if (value == null || value === '') return
              const raw = String(value)
              const shown = parseRegistrationAttachmentPath(raw) ? ATTACHMENT_REFERENCE_LABEL : raw
              summaryParts.push(`<p style="margin: 0 0 4px 0; padding-left: 12px;">${escapeHtml(label)}: ${escapeHtml(shown)}</p>`)
            })
          })
        }
        if (validatedData.registration_fee_id) {
          const { data: feeRow } = await supabase
            .from('custom_registration_fees')
            .select('name')
            .eq('id', validatedData.registration_fee_id)
            .eq('conference_id', validatedData.conference_id)
            .single()
          const feeLabel = feeRow?.name ?? 'Registration fee'
          summaryParts.push(`<p style="margin: 10px 0 4px 0;"><strong>Registration fee</strong>: ${escapeHtml(feeLabel)}</p>`)
        }
        if (paymentMethod) {
          const payLabel = paymentMethod === 'card' ? 'Credit/Debit card' : 'Bank transfer'
          summaryParts.push(`<p style="margin: 0 0 4px 0;"><strong>Payment</strong>: ${escapeHtml(payLabel)}</p>`)
        }
        if (bankInstructions) {
          const isHr = validatedData.locale === 'hr'
          summaryParts.push(
            `<p style="margin: 10px 0 4px 0;"><strong>${isHr ? 'Podaci za plaćanje' : 'Payment instructions'}</strong></p>`,
            bankInstructions.recipient
              ? `<p style="margin: 0 0 4px 0; padding-left: 12px;">${isHr ? 'Primatelj' : 'Recipient'}: ${escapeHtml(bankInstructions.recipient)}</p>`
              : '',
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">IBAN: ${escapeHtml(bankInstructions.iban)}</p>`,
            bankInstructions.bank_name
              ? `<p style="margin: 0 0 4px 0; padding-left: 12px;">${isHr ? 'Banka' : 'Bank'}: ${escapeHtml(bankInstructions.bank_name)}</p>`
              : '',
            bankInstructions.swift_bic
              ? `<p style="margin: 0 0 4px 0; padding-left: 12px;">SWIFT/BIC: ${escapeHtml(bankInstructions.swift_bic)}</p>`
              : '',
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">${isHr ? 'Iznos' : 'Amount'}: ${bankInstructions.amount.toFixed(2)} ${escapeHtml(bankInstructions.currency)}</p>`,
            bankInstructions.reference
              ? `<p style="margin: 0 0 4px 0; padding-left: 12px;">${isHr ? 'Poziv na broj' : 'Payment reference'}: ${escapeHtml(bankInstructions.reference)}</p>`
              : ''
          )
        }
        if (validatedData.accommodation) {
          const acc = validatedData.accommodation
          let hotelName = ''
          if (acc.hotel_id && conference.settings?.hotel_options) {
            const opts = (conference.settings.hotel_options as { id: string; name?: string }[]) || []
            hotelName = opts.find((h) => h.id === acc.hotel_id)?.name || acc.hotel_id
          }
          summaryParts.push(
            '<p style="margin: 10px 0 4px 0;"><strong>Accommodation</strong></p>',
            hotelName ? `<p style="margin: 0 0 4px 0; padding-left: 12px;">Hotel: ${escapeHtml(hotelName)}</p>` : '',
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">Check-in: ${escapeHtml(new Date(acc.arrival_date).toLocaleDateString())}</p>`,
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">Check-out: ${escapeHtml(new Date(acc.departure_date).toLocaleDateString())}</p>`,
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">Nights: ${acc.number_of_nights}</p>`
          )
        }
        if (validatedData.payer_type === 'company' && validatedData.company_details) {
          const c = validatedData.company_details
          summaryParts.push(
            '<p style="margin: 10px 0 4px 0;"><strong>Billing (company)</strong></p>',
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">${escapeHtml(c.company_name)}</p>`,
            c.vat_number ? `<p style="margin: 0 0 4px 0; padding-left: 12px;">VAT: ${escapeHtml(c.vat_number)}</p>` : '',
            `<p style="margin: 0 0 4px 0; padding-left: 12px;">${escapeHtml([c.address, c.postal_code, c.city, c.country].filter(Boolean).join(', '))}</p>`
          )
        }
        const registrationSummary = summaryParts.filter(Boolean).join('')

        let manageLinkHtml = ''
        if (registrationManageToken) {
          const { buildManageUrl } = await import('@/lib/registration-manage-token')
          const manageUrl = buildManageUrl(conference.slug, registrationManageToken)
          const manageLabel =
            validatedData.locale === 'hr'
              ? 'Upravljanje prijavom'
              : 'Manage your registration'
          manageLinkHtml = `<p style="margin:16px 0 0 0;"><a href="${manageUrl}">${manageLabel}</a></p>`

          if (paymentMethod === 'bank_transfer') {
            const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            const localeQs = validatedData.locale === 'hr' ? '&locale=hr' : '&locale=en'
            const proformaUrl = `${base}/api/conferences/${conference.slug}/proforma?token=${registrationManageToken}${localeQs}`
            const proformaLabel =
              validatedData.locale === 'hr' ? 'Preuzmi predračun (PDF)' : 'Download proforma invoice (PDF)'
            manageLinkHtml += `<p style="margin:8px 0 0 0;"><a href="${proformaUrl}">${proformaLabel}</a></p>`
          }
        }

          const emailSummary =
            ((registrationSummary || '') + manageLinkHtml).trim() || undefined

        await sendRegistrationConfirmation(
          registration.id,
          primaryEmail,
          confirmFirstName,
          confirmLastName,
          undefined, // paymentUrl – nije generiran u ovom koraku; korisnik dobiva link kasnije ako treba plaćanje
          conference.email_settings,
          emailSummary,
          validatedData.locale === 'hr' ? 'hr' : 'en'
        )
        log.info('Registration confirmation email sent to participant', {
          registrationId: registration.id,
          email: primaryEmail,
          action: 'confirmation_email',
        })
      } catch (emailError) {
        log.error('Failed to send registration confirmation email', emailError as Error, {
          registrationId: registration.id,
          email: primaryEmail,
          action: 'confirmation_email',
        })
        // Don't fail registration if confirmation email fails
      }
    }

    // Send notification to conference team (if reply_to email is configured)
    if (conference.email_settings?.reply_to) {
      try {
        const { sendConferenceTeamNotification } = await import('@/lib/email')
        
        // Extract participant info for notification
        let participantInfo = 'Guest Participant'
        if (validatedData.participants && validatedData.participants.length > 0) {
          const firstParticipant = validatedData.participants[0].customFields
          const firstName = Object.entries(firstParticipant).find(([key]) => 
            key.toLowerCase().includes('first') && key.toLowerCase().includes('name')
          )?.[1] || ''
          const lastName = Object.entries(firstParticipant).find(([key]) => 
            key.toLowerCase().includes('last') && key.toLowerCase().includes('name')
          )?.[1] || ''
          participantInfo = `${firstName} ${lastName}`.trim() || primaryEmail || 'Guest Participant'
        } else if (primaryEmail) {
          participantInfo = primaryEmail
        }

        // Get hotel name if accommodation is selected
        let hotelName = null
        if (validatedData.accommodation?.hotel_id && conference.settings?.hotel_options) {
          const hotelOptions = conference.settings.hotel_options as any[]
          const selectedHotel = hotelOptions.find((h: any) => h.id === validatedData.accommodation?.hotel_id)
          hotelName = selectedHotel?.name || null
        }

        await sendConferenceTeamNotification({
          to: conference.email_settings.reply_to,
          subject: `🎉 New Registration: ${conference.name}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                  .field { margin-bottom: 15px; }
                  .label { font-weight: bold; color: #4b5563; display: block; margin-bottom: 5px; }
                  .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
                  .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">🎉 New Registration</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Someone has registered for your conference</p>
                  </div>
                  <div class="content">
                    <div class="field">
                      <span class="label">Conference:</span>
                      <div class="value">${conference.name}</div>
                    </div>
                    <div class="field">
                      <span class="label">Participant:</span>
                      <div class="value">${participantInfo}</div>
                    </div>
                    <div class="field">
                      <span class="label">Registration ID:</span>
                      <div class="value">${registration.id}</div>
                    </div>
                    <div class="field">
                      <span class="label">Email:</span>
                      <div class="value">${primaryEmail || 'N/A'}</div>
                    </div>
                    <div class="field">
                      <span class="label">Participants Count:</span>
                      <div class="value">${validatedData.participants?.length || 1}</div>
                    </div>
                    ${validatedData.accommodation ? `
                    <div class="field">
                      <span class="label">Accommodation:</span>
                      <div class="value">
                        ${hotelName ? `<strong>${hotelName}</strong><br/>` : ''}
                        ${validatedData.accommodation?.arrival_date ? `Check-in: ${new Date(validatedData.accommodation.arrival_date).toLocaleDateString()}` : ''}
                        ${validatedData.accommodation?.departure_date ? ` | Check-out: ${new Date(validatedData.accommodation.departure_date).toLocaleDateString()}` : ''}
                        ${validatedData.accommodation?.number_of_nights ? ` | ${validatedData.accommodation.number_of_nights} nights` : ''}
                      </div>
                    </div>
                    ` : ''}
                    <div style="text-align: center; margin-top: 20px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/registrations" class="button">
                        View Registration →
                      </a>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `,
          text: `
New Registration

Conference: ${conference.name}
Participant: ${participantInfo}
Registration ID: ${registration.id}
Email: ${primaryEmail || 'N/A'}
Participants Count: ${validatedData.participants?.length || 1}
${validatedData.accommodation ? `
Accommodation:
${hotelName ? `Hotel: ${hotelName}` : ''}
${validatedData.accommodation?.arrival_date ? `Check-in: ${new Date(validatedData.accommodation.arrival_date).toLocaleDateString()}` : ''}
${validatedData.accommodation?.departure_date ? `Check-out: ${new Date(validatedData.accommodation.departure_date).toLocaleDateString()}` : ''}
${validatedData.accommodation?.number_of_nights ? `Nights: ${validatedData.accommodation.number_of_nights}` : ''}
` : ''}

View in admin panel: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/registrations
          `,
          conferenceName: conference.name,
        })
        log.info('Conference team notification sent for new registration', {
          registrationId: registration.id,
          conferenceId: validatedData.conference_id,
          notificationEmail: conference.email_settings.reply_to,
        })
      } catch (notificationError) {
        log.error('Failed to send conference team notification', notificationError instanceof Error ? notificationError : undefined, {
          registrationId: registration.id,
          conferenceId: validatedData.conference_id,
          action: 'team_notification',
        })
        // Don't fail registration if notification fails
      }
    }

    const proformaDownloadUrl =
      registrationManageToken && paymentMethod === 'bank_transfer'
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/conferences/${conference.slug}/proforma?token=${registrationManageToken}${validatedData.locale === 'hr' ? '&locale=hr' : '&locale=en'}`
        : null

    return NextResponse.json(
      {
        success: true,
        message: 'Registration submitted successfully',
        registrationId: registration.id,
        ...(bankInstructions ? { bank_instructions: bankInstructions } : {}),
        ...(proformaDownloadUrl ? { proforma_download_url: proformaDownloadUrl } : {}),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      log.warn('Registration validation error', {
        errors: error.errors,
        action: 'registration_validation',
      })
      return NextResponse.json(
        {
          error: 'Invalid registration data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Please try again later'
    log.error('Registration error', error instanceof Error ? error : undefined, {
      action: 'registration_error',
      errorMessage,
    })

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
