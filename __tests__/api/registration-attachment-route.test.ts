/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/registrations/[id]/attachment/route'
import { requireActiveAuth, requireConferencePermission } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-error'
import { createAdminClient } from '@/lib/supabase-admin'
import { createScopedSignedUrl } from '@/lib/abstract-storage'

jest.mock('server-only', () => ({}))

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/api-auth', () => ({
  requireActiveAuth: jest.fn(),
  requireConferencePermission: jest.fn(),
}))

jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/abstract-storage', () => ({
  createScopedSignedUrl: jest.fn(),
}))

const requireActiveAuthMock = requireActiveAuth as jest.Mock
const requireConferencePermissionMock = requireConferencePermission as jest.Mock
const createAdminClientMock = createAdminClient as jest.Mock
const createScopedSignedUrlMock = createScopedSignedUrl as jest.Mock

const conferenceId = '11111111-1111-4111-8111-111111111111'
const registrationId = '22222222-2222-4222-8222-222222222222'
const filePath = `${conferenceId}/1710000000000_proof.pdf`
const publicUrl = `https://example.supabase.co/storage/v1/object/public/registration-attachments/${filePath}`

function mockRegistration(row: Record<string, unknown> | null) {
  createAdminClientMock.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  })
}

function request(ref?: string) {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  return new NextRequest(
    `http://localhost:3000/api/admin/registrations/${registrationId}/attachment${query}`
  )
}

describe('GET /api/admin/registrations/[id]/attachment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requireActiveAuthMock.mockResolvedValue({ user: { id: 'admin-1' } })
    requireConferencePermissionMock.mockResolvedValue({ user: { id: 'admin-1' } })
    createScopedSignedUrlMock.mockResolvedValue('https://signed.example/proof')
    mockRegistration({
      id: registrationId,
      conference_id: conferenceId,
      bank_transfer_proof_url: publicUrl,
      custom_data: null,
      participants: null,
    })
  })

  it('rejects an anonymous caller before issuing a URL', async () => {
    requireActiveAuthMock.mockRejectedValue(ApiError.unauthorized())
    const response = await GET(request(publicUrl), { params: { id: registrationId } })
    expect(response.status).toBe(401)
    expect(createScopedSignedUrlMock).not.toHaveBeenCalled()
  })

  it('rejects an organizer without access to this registration conference', async () => {
    requireConferencePermissionMock.mockRejectedValue(ApiError.forbidden())
    const response = await GET(request(publicUrl), { params: { id: registrationId } })
    expect(response.status).toBe(403)
    expect(requireConferencePermissionMock).toHaveBeenCalledWith(
      conferenceId,
      'can_view_registrations'
    )
    expect(createScopedSignedUrlMock).not.toHaveBeenCalled()
  })

  it('signs the legacy public URL stored on the registration', async () => {
    const response = await GET(request(publicUrl), { params: { id: registrationId } })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ url: 'https://signed.example/proof' })
    expect(createScopedSignedUrlMock).toHaveBeenCalledWith({
      bucket: 'registration-attachments',
      filePath,
      conferenceId,
    })
  })

  it('does not sign a path that is not stored on the registration', async () => {
    const response = await GET(request(`${conferenceId}/1710000000000_other.pdf`), {
      params: { id: registrationId },
    })
    expect(response.status).toBe(403)
    expect(createScopedSignedUrlMock).not.toHaveBeenCalled()
  })
})
