import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { handleApiError, ApiError } from '@/lib/api-error'
import { resolveManageToken } from '@/lib/registration-manage-token'
import { resolveConferenceBankDetails } from '@/lib/conference-bank-details'
import { buildProformaPdfForRegistration } from '@/lib/registration-proforma-data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/conferences/[slug]/proforma?token=
 * Download proforma invoice PDF for a bank-transfer registration (manage token).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const token = request.nextUrl.searchParams.get('token')
    if (!token) throw ApiError.validationError('token is required')

    const row = await resolveManageToken(token)
    if (!row?.registration) throw ApiError.notFound('Invalid or expired link')

    const supabase = createAdminClient()
    // Load by conference_id (same as /api/register) so settings match the registration path.
    const { data: conference } = await supabase
      .from('conferences')
      .select('id, name, slug, settings, pricing, owner_id')
      .eq('id', row.registration.conference_id)
      .single()

    if (!conference || conference.slug !== slug) {
      throw ApiError.notFound('Registration not found for this conference')
    }

    // Supabase usually returns jsonb as an object; parse if a string slips through
    // (same guard as the public conference route) so bank_details resolve correctly.
    const conferenceForPdf = conference as Record<string, unknown>
    if (typeof conferenceForPdf.settings === 'string') {
      try {
        conferenceForPdf.settings = JSON.parse(conferenceForPdf.settings)
      } catch {
        // keep original; resolveConferenceBankDetails will fall back to owner profile
      }
    }

    const localeParam = request.nextUrl.searchParams.get('locale')
    const locale = localeParam === 'hr' ? 'hr' : 'en'

    // Resolve bank here so the PDF path cannot silently diverge from /api/register.
    const bank = await resolveConferenceBankDetails(supabase, conferenceForPdf)
    if (!bank) {
      throw ApiError.notFound('Proforma invoice is not available for this registration')
    }

    const pdf = await buildProformaPdfForRegistration(
      supabase,
      row.registration,
      conferenceForPdf,
      { locale, bank }
    )

    if (!pdf) {
      throw ApiError.notFound('Proforma invoice is not available for this registration')
    }

    const ref =
      row.registration.registration_number ||
      row.registration.id.substring(0, 8).toUpperCase()

    const settingsObj =
      conferenceForPdf.settings && typeof conferenceForPdf.settings === 'object'
        ? (conferenceForPdf.settings as Record<string, any>)
        : {}
    const settingsIban = settingsObj.payment_settings?.bank_details?.iban
    const fromSettings = typeof settingsIban === 'string' && !!settingsIban.trim()

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proforma-${ref}.pdf"`,
        // Temporary pilot diagnostics (no full IBAN): confirm which bank source was used.
        'X-Bank-Source': fromSettings ? 'conference' : 'profile',
        'X-Bank-Iban-Last4': bank.iban.slice(-4),
        'X-Settings-Type': typeof conferenceForPdf.settings,
        'X-Has-Payment-Settings': settingsObj.payment_settings ? '1' : '0',
        'X-Has-Bank-Details': settingsObj.payment_settings?.bank_details ? '1' : '0',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
