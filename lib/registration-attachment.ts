export const REGISTRATION_ATTACHMENTS_BUCKET = 'registration-attachments'

/** Non-link label for exports and emails. Never a Storage URL or object path. */
export const ATTACHMENT_REFERENCE_LABEL = 'On file'

const OBJECT_PATH = /^[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]+$/

/**
 * Accept a stored public object URL or a bucket-relative path.
 * Rejects other buckets, signed-url query tricks, traversal, and absolute paths.
 */
export function parseRegistrationAttachmentPath(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return null
  }

  let path = trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const marker = `/${REGISTRATION_ATTACHMENTS_BUCKET}/`
    const index = url.pathname.indexOf(marker)
    if (index === -1) return null
    try {
      path = decodeURIComponent(url.pathname.slice(index + marker.length))
    } catch {
      return null
    }
  } else if (trimmed.startsWith('/')) {
    return null
  }

  path = path.replace(/^\/+/, '')
  const segments = path.split('/')
  if (segments.length !== 2 || segments[1] === '.' || segments[1] === '..') return null
  if (!OBJECT_PATH.test(path)) return null
  return path
}

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === 'string') {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out))
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, out))
  }
}

export type RegistrationAttachmentRecord = {
  bank_transfer_proof_url?: string | null
  custom_data?: unknown
  participants?: unknown
  customFields?: unknown
}

/**
 * Return the storage path only when the requested reference is already stored
 * on this registration and belongs to its conference folder.
 */
export function findStoredAttachmentPath(
  registration: RegistrationAttachmentRecord,
  requested: string,
  conferenceId: string
): string | null {
  const requestedPath = parseRegistrationAttachmentPath(requested)
  if (!requestedPath || !requestedPath.startsWith(`${conferenceId}/`)) return null

  const stored: string[] = []
  collectStrings(registration.bank_transfer_proof_url, stored)
  collectStrings(registration.custom_data, stored)
  collectStrings(registration.participants, stored)
  collectStrings(registration.customFields, stored)

  for (const value of stored) {
    if (parseRegistrationAttachmentPath(value) === requestedPath) return requestedPath
  }
  return null
}

export async function openRegistrationAttachment(registrationId: string, ref: string): Promise<void> {
  const params = new URLSearchParams({ ref })
  const response = await fetch(
    `/api/admin/registrations/${encodeURIComponent(registrationId)}/attachment?${params}`
  )
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: { message?: string } | string }
  if (!response.ok || !data.url) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || 'Failed to open attachment'
    throw new Error(message)
  }
  window.open(data.url, '_blank', 'noopener,noreferrer')
}

/** File types an organizer can pick for a 'file' registration field, plus .jpeg. */
const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

/** Bank transfer proof has no field settings; it uses these. */
export const BANK_PROOF_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
export const DEFAULT_UPLOAD_MAX_MB = 10
/** Same ceiling the field editor offers. */
export const UPLOAD_MAX_MB_CEILING = 50

export type RegistrationUploadRules = {
  allowedExtensions: string[]
  maxSizeMb: number
}

function normalizeExtension(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  const ext = trimmed.startsWith('.') ? trimmed : `.${trimmed}`
  return ext in UPLOAD_CONTENT_TYPES ? ext : null
}

function boundedMb(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(Math.floor(parsed), UPLOAD_MAX_MB_CEILING)
}

/**
 * Upload rules come from the conference settings, never from the browser.
 * The union covers bank proof and every 'file' registration field. A browser
 * hint (one field's own limits) may only narrow these rules.
 */
export function resolveRegistrationUploadRules(
  settings: unknown,
  hint?: { allowedExtensions?: unknown; maxFileSizeMb?: unknown }
): RegistrationUploadRules {
  const allowed = new Set<string>(BANK_PROOF_EXTENSIONS)
  let maxSizeMb = DEFAULT_UPLOAD_MAX_MB

  const fields =
    settings && typeof settings === 'object'
      ? (settings as { custom_registration_fields?: unknown }).custom_registration_fields
      : undefined

  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!field || typeof field !== 'object') continue
      const f = field as { type?: unknown; fileTypes?: unknown; maxFileSize?: unknown }
      if (f.type !== 'file') continue
      const types = Array.isArray(f.fileTypes) && f.fileTypes.length > 0
        ? f.fileTypes
        : ['.pdf', '.doc', '.docx']
      for (const type of types) {
        const ext = normalizeExtension(type)
        if (ext) allowed.add(ext)
        if (ext === '.jpg') allowed.add('.jpeg')
      }
      maxSizeMb = Math.max(maxSizeMb, boundedMb(f.maxFileSize) ?? DEFAULT_UPLOAD_MAX_MB)
    }
  }

  let allowedExtensions = Array.from(allowed)

  if (Array.isArray(hint?.allowedExtensions) && hint.allowedExtensions.length > 0) {
    const requested = new Set(
      hint.allowedExtensions
        .map(normalizeExtension)
        .filter((ext): ext is string => ext !== null)
    )
    if (requested.has('.jpg')) requested.add('.jpeg')
    const narrowed = allowedExtensions.filter((ext) => requested.has(ext))
    if (narrowed.length > 0) allowedExtensions = narrowed
  }

  const hintedMb = boundedMb(hint?.maxFileSizeMb)
  if (hintedMb !== null) maxSizeMb = Math.min(maxSizeMb, hintedMb)

  return { allowedExtensions, maxSizeMb }
}

/** Lowercase extension including the dot, or '' when the name has none. */
export function uploadExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index > 0 ? fileName.slice(index).toLowerCase() : ''
}

/** Stored content type is derived from the checked extension, not the browser. */
export function uploadContentType(extension: string): string {
  return UPLOAD_CONTENT_TYPES[extension] || 'application/octet-stream'
}
