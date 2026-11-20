import { NextRequest, NextResponse } from 'next/server'
import { requireConferencePermission } from '@/lib/api-auth'
import { handleApiError, ApiError } from '@/lib/api-error'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  AbstractFileError,
  removeStorageObject,
  TEMPLATES_BUCKET,
  uploadAbstractTemplate,
} from '@/lib/abstract-storage'
import { invalidateConferenceCache } from '@/lib/cache'
import { log } from '@/lib/logger'
import type { AbstractTemplate, ConferenceSettings } from '@/types/conference'

export const dynamic = 'force-dynamic'

async function loadConference(conferenceId: string) {
  const supabase = createAdminClient()
  const { data: conference, error } = await supabase
    .from('conferences')
    .select('id, slug, settings')
    .eq('id', conferenceId)
    .maybeSingle()

  if (error || !conference) throw ApiError.notFound('Conference not found')
  return { supabase, conference }
}

async function saveTemplateSetting(
  supabase: ReturnType<typeof createAdminClient>,
  conference: { id: string; slug: string; settings: unknown },
  template: AbstractTemplate | null
) {
  const settings = ((conference.settings || {}) as Partial<ConferenceSettings>)
  const nextSettings = { ...settings, abstract_template: template }

  const { error } = await supabase
    .from('conferences')
    .update({ settings: nextSettings })
    .eq('id', conference.id)

  if (error) throw ApiError.internal('Failed to update conference settings')

  await invalidateConferenceCache(conference.slug).catch((err) => {
    log.warn('Failed to invalidate conference cache after template change', { err })
  })
}

/**
 * POST /api/admin/conferences/[id]/abstract-template
 * Upload (or replace) the DOCX abstract template. multipart/form-data with `file`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireConferencePermission(params.id, 'can_manage_abstracts')

    const formData = await request.formData()
    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      throw ApiError.validationError('No file provided')
    }

    const { supabase, conference } = await loadConference(params.id)
    const previous = (conference.settings as Partial<ConferenceSettings> | null)?.abstract_template

    let stored
    try {
      stored = await uploadAbstractTemplate({ conferenceId: conference.id, file: fileEntry })
    } catch (err) {
      if (err instanceof AbstractFileError) {
        throw ApiError.validationError(err.message, err.details)
      }
      throw ApiError.internal('Failed to store template')
    }

    const template: AbstractTemplate = {
      file_name: stored.file_name,
      file_path: stored.file_path,
      file_size: stored.file_size,
      uploaded_at: new Date().toISOString(),
    }

    try {
      await saveTemplateSetting(supabase, conference, template)
    } catch (err) {
      await removeStorageObject(TEMPLATES_BUCKET, stored.file_path)
      throw err
    }

    // Replace: previous object is no longer referenced, remove it (best effort)
    if (previous?.file_path && previous.file_path !== stored.file_path) {
      await removeStorageObject(TEMPLATES_BUCKET, previous.file_path)
    }

    log.info('Abstract template uploaded', { conferenceId: conference.id, filePath: stored.file_path })
    return NextResponse.json({ success: true, template })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/admin/conferences/[id]/abstract-template
 * Remove the template from settings and Storage.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireConferencePermission(params.id, 'can_manage_abstracts')

    const { supabase, conference } = await loadConference(params.id)
    const previous = (conference.settings as Partial<ConferenceSettings> | null)?.abstract_template

    await saveTemplateSetting(supabase, conference, null)

    if (previous?.file_path) {
      await removeStorageObject(TEMPLATES_BUCKET, previous.file_path)
    }

    log.info('Abstract template removed', { conferenceId: conference.id })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
