import { NextRequest, NextResponse } from 'next/server'
import { requireActiveAuth, requireConferencePermission } from '@/lib/api-auth'
import { handleApiError, ApiError } from '@/lib/api-error'
import { createAdminClient } from '@/lib/supabase-admin'
import { createScopedSignedUrl } from '@/lib/abstract-storage'
import {
  REGISTRATION_ATTACHMENTS_BUCKET,
  findStoredAttachmentPath,
} from '@/lib/registration-attachment'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/registrations/[id]/attachment?ref=
 * Short-lived signed URL for one attachment already stored on this registration.
 * Authorization: active user with can_view_registrations for that conference.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireActiveAuth()

    const admin = createAdminClient()
    const { data: registration, error } = await admin
      .from('registrations')
      .select('id, conference_id, bank_transfer_proof_url, custom_data, participants')
      .eq('id', params.id)
      .maybeSingle()

    if (error || !registration || !registration.conference_id) {
      throw ApiError.notFound('Registration')
    }

    await requireConferencePermission(registration.conference_id, 'can_view_registrations')

    const requested = request.nextUrl.searchParams.get('ref') || registration.bank_transfer_proof_url
    if (!requested) {
      throw ApiError.notFound('Attachment', 'This registration has no attachment')
    }

    const filePath = findStoredAttachmentPath(
      registration,
      requested,
      registration.conference_id
    )
    if (!filePath) {
      throw ApiError.forbidden('Attachment is not stored on this registration')
    }

    const url = await createScopedSignedUrl({
      bucket: REGISTRATION_ATTACHMENTS_BUCKET,
      filePath,
      conferenceId: registration.conference_id,
    })

    log.info('Admin registration attachment download issued', {
      registrationId: registration.id,
      conferenceId: registration.conference_id,
    })

    return NextResponse.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
