import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveConferenceBankDetails,
  type ConferenceBankDetails,
} from '@/lib/conference-bank-details'
import { extractRegistrationContact } from '@/lib/registration-contact'
import {
  generateProformaInvoicePdf,
  type ProformaInvoiceInput,
} from '@/lib/registration-proforma-pdf'

interface BuildProformaOptions {
  locale?: 'hr' | 'en'
  /** When set (e.g. by the proforma route), skip a second bank lookup. */
  bank?: ConferenceBankDetails | null
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

  const bank =
    options.bank ?? (await resolveConferenceBankDetails(supabase, conference))
  if (!bank) return null

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
    issuerName: bank.account_holder || conference.name,
    issuerAddress: bank.address,
    iban: bank.iban,
    bankName: bank.bank_name,
    swiftBic: bank.swift_bic,
    currency: registration.payment_currency || 'EUR',
    paymentReference: registration.payment_reference || null,
    lineItems,
    vatPercentage: pricing.vat_percentage ?? null,
  }

  return generateProformaInvoicePdf(input)
}
