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
