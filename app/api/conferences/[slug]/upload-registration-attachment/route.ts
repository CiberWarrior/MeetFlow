import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'
import {
  registrationAttachmentRateLimit,
  getClientIP,
  checkRateLimit,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import {
  resolveRegistrationUploadRules,
  uploadContentType,
  uploadExtension,
} from '@/lib/registration-attachment'

export const dynamic = 'force-dynamic'

/**
 * POST /api/conferences/[slug]/upload-registration-attachment
 * Generic upload used both for bank transfer proof and 'file' type custom
 * registration fields. Returns a bucket-relative path, not a public URL.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIP(request)
    const rateLimitResult = await checkRateLimit(registrationAttachmentRateLimit, ip)

    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again in a minute.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const maxFileSizeMbRaw = formData.get('maxFileSizeMb') as string | null
    const allowedExtensionsRaw = formData.get('allowedExtensions') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: conference, error: conferenceError } = await supabase
      .from('conferences')
      .select('id, settings')
      .eq('slug', params.slug)
      .eq('published', true)
      .eq('active', true)
      .single()

    if (conferenceError || !conference) {
      log.warn('Conference not found for registration attachment upload', {
        slug: params.slug,
        action: 'upload_registration_attachment',
      })
      return NextResponse.json({ error: 'Conference not found' }, { status: 404 })
    }

    // The browser may only narrow the conference's own rules (one field's limits).
    let requestedExtensions: unknown
    if (allowedExtensionsRaw) {
      try {
        requestedExtensions = JSON.parse(allowedExtensionsRaw)
      } catch {
        requestedExtensions = undefined
      }
    }
    const rules = resolveRegistrationUploadRules(conference.settings, {
      allowedExtensions: requestedExtensions,
      maxFileSizeMb: maxFileSizeMbRaw,
    })

    const fileExtension = uploadExtension(file.name)
    if (!rules.allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          details: `Allowed file types: ${rules.allowedExtensions.join(', ')}`,
        },
        { status: 400 }
      )
    }

    if (file.size > rules.maxSizeMb * 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'File size too large',
          details: `File size must be less than ${rules.maxSizeMb}MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 400 }
      )
    }

    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${conference.id}/${timestamp}_${sanitizedFileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const bucketName = 'registration-attachments'
    const uploadResult = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: uploadContentType(fileExtension),
        upsert: false,
      })

    if (uploadResult.error) {
      log.error('Storage upload error', uploadResult.error, {
        conferenceId: conference.id,
        bucketName,
        filePath,
        action: 'upload_registration_attachment',
      })

      const errorMessage = uploadResult.error.message || ''
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('Bucket') ||
        errorMessage.includes('does not exist')
      ) {
        return NextResponse.json(
          {
            error: 'Storage bucket not configured',
            details: 'The "registration-attachments" bucket does not exist. Please contact the administrator.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to upload file', details: errorMessage || 'Unknown error' },
        { status: 500 }
      )
    }

    log.info('Registration attachment uploaded successfully', {
      conferenceId: conference.id,
      filePath,
      action: 'upload_registration_attachment',
    })

    return NextResponse.json({
      success: true,
      url: filePath,
      fileName: file.name,
    })
  } catch (error) {
    log.error('Registration attachment upload error', error, {
      action: 'upload_registration_attachment',
    })
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
