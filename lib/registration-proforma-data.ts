import type { SupabaseClient } from '@supabase/supabase-js'
import { extractRegistrationContact } from '@/lib/registration-contact'
import {
  generateProformaInvoicePdf,
  type ProformaInvoiceInput,
} from '@/lib/registration-proforma-pdf'

interface BuildProformaOptions {
  locale?: 'hr' | 'en'
}

export async function buildProformaPdfForRegistration(
  supabase: SupabaseClient,
  registration: Record<string, any>,
  conference: Record<string, any>,
  options: BuildProformaOptions = {}
): Promise<Buffer | null> {
  if (registration.payment_method !== 'bank_transfer') return null
  if (!registration.payment_amount || Number(registration.payment_amount) <= 0) return null

  const locale = options.locale === 'hr' ? 'hr' : 'en'
  const settings = (conference.settings || {}) as Record<string, any>
  const pricing = (conference.pricing || {}) as Record<string, any>
  const paymentSettings = settings.payment_settings || {}
  const deadlineDays = Number(paymentSettings.bank_transfer_deadline_days || 7)

  let issuerName = conference.name
  let iban = ''
  let bankName: string | null = null
  let swiftBic: string | null = null
  // user_profiles has no address columns yet, so the issuer address stays empty.
  const issuerAddress: string | null = null

  if (conference.owner_id) {
    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select(
        'bank_account_number, bank_account_holder, bank_name, swift_bic, organization, full_name'
      )
      .eq('id', conference.owner_id)
      .maybeSingle()

    if (ownerProfile?.bank_account_number) {
      iban = ownerProfile.bank_account_number
      issuerName =
        ownerProfile.bank_account_holder ||
        ownerProfile.organization ||
        ownerProfile.full_name ||
        conference.name
      bankName = ownerProfile.bank_name || null
      swiftBic = ownerProfile.swift_bic || null
    }
  }

  if (!iban) return null

  const lineItems: ProformaInvoiceInput['lineItems'] = []

  if (registration.registration_fee_id) {
    const { data: feeRow } = await supabase
      .from('custom_registration_fees')
      .select('name, price_gross')
      .eq('id', registration.registration_fee_id)
      .maybeSingle()
    if (feeRow) {
      lineItems.push({
        description: feeRow.name || 'Registration fee',
        amount: Number(feeRow.price_gross || 0),
      })
    }
  }

  const addons = (registration.selected_addons || []) as Array<{
    label?: string
    line_total?: number
  }>
  for (const addon of addons) {
    if (!addon.line_total) continue
    lineItems.push({
      description: addon.label || 'Add-on',
      amount: Number(addon.line_total),
    })
  }

  if (lineItems.length === 0) {
    lineItems.push({
      description: locale === 'hr' ? 'Kotizacija' : 'Conference registration',
      amount: Number(registration.payment_amount),
    })
  }

  const contact = extractRegistrationContact(registration)
  const customData = registration.custom_data || {}
  const payerType = customData.payer_type || 'person'
  const company = customData.company_details || null

  let billToName = `${contact.firstName} ${contact.lastName}`.trim() || contact.email
  let billToVat: string | null = null
  let billToAddress: string | null = null

  if (payerType === 'company' && company) {
    billToName = company.company_name || billToName
    billToVat = company.no_vat ? null : company.vat_number || null
    billToAddress = [company.address, company.postal_code, company.city, company.country]
      .filter(Boolean)
      .join(', ') || null
  }

  const issueDate = new Date(registration.created_at || Date.now())
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + deadlineDays)

  const input: ProformaInvoiceInput = {
    locale,
    conferenceName: conference.name,
    registrationNumber: registration.registration_number || registration.id.slice(0, 8).toUpperCase(),
    issueDate,
    dueDate,
    billToName,
    billToEmail: contact.email || registration.email || null,
    billToVat,
    billToAddress,
    issuerName,
    issuerAddress,
    iban,
    bankName,
    swiftBic,
    currency: registration.payment_currency || 'EUR',
    paymentReference: registration.payment_reference || null,
    lineItems,
    vatPercentage: pricing.vat_percentage ?? null,
  }

  return generateProformaInvoicePdf(input)
}
