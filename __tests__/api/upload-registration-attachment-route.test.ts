/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/conferences/[slug]/upload-registration-attachment/route'
import { createAdminClient } from '@/lib/supabase-admin'

jest.mock('server-only', () => ({}))

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/rate-limit', () => ({
  registrationAttachmentRateLimit: null,
  getClientIP: () => '203.0.113.10',
  checkRateLimit: jest.fn(async () => ({ success: true, limit: 5, remaining: 4, reset: 0 })),
  createRateLimitHeaders: () => ({}),
}))

jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))

const createAdminClientMock = createAdminClient as jest.Mock
const conferenceId = '11111111-1111-4111-8111-111111111111'

let upload: jest.Mock

function mockConference(settings: unknown) {
  upload = jest.fn(async () => ({ data: {}, error: null }))
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: { id: conferenceId, settings }, error: null }),
  }
  createAdminClientMock.mockReturnValue({
    from: () => query,
    storage: { from: () => ({ upload }) },
  })
}

function request(file: File, extra: Record<string, string> = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  return new NextRequest('http://localhost/api/conferences/demo/upload-registration-attachment', {
    method: 'POST',
    body: form,
  })
}

const params = { params: { slug: 'demo' } }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/conferences/[slug]/upload-registration-attachment', () => {
  it('stores an allowed PDF with a content type derived from the extension', async () => {
    mockConference({})
    const file = new File(['%PDF-1.4'], 'proof.pdf', { type: 'text/html' })

    const response = await POST(request(file), params)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.url).toMatch(new RegExp(`^${conferenceId}/\\d+_proof\\.pdf$`))
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/proof\.pdf$/),
      expect.anything(),
      expect.objectContaining({ contentType: 'application/pdf', upsert: false })
    )
  })

  it('rejects a type the browser tries to allow on its own', async () => {
    mockConference({})
    const file = new File(['<script></script>'], 'page.html', { type: 'application/pdf' })

    const response = await POST(
      request(file, { allowedExtensions: JSON.stringify(['.html']) }),
      params
    )

    expect(response.status).toBe(400)
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a file larger than the conference allows, even if the browser asks for more', async () => {
    mockConference({})
    const file = new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    })

    const response = await POST(request(file, { maxFileSizeMb: '500' }), params)

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('File size too large')
    expect(upload).not.toHaveBeenCalled()
  })

  it('accepts a type configured on a registration file field', async () => {
    mockConference({ custom_registration_fields: [{ type: 'file', fileTypes: ['.docx'] }] })
    const file = new File(['doc'], 'cv.docx')

    const response = await POST(request(file), params)

    expect(response.status).toBe(200)
    expect(upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    )
  })
})
