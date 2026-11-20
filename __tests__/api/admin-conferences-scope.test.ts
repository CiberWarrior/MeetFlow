/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET as listConferences } from '@/app/api/admin/conferences/route'
import { DELETE as deleteConference, GET as getConference } from '@/app/api/admin/conferences/[id]/route'
import { GET as getPlans } from '@/app/api/admin/subscription-plans/route'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  requireAuth,
  requireCanEditConference,
  requireSuperAdmin,
  requireConferencePermission,
} from '@/lib/api-auth'
import { ApiError } from '@/lib/api-error'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/api-auth', () => ({
  requireAuth: jest.fn(),
  requireSuperAdmin: jest.fn(),
  requireConferencePermission: jest.fn(),
  requireCanEditConference: jest.fn(),
}))
jest.mock('@/lib/supabase-admin', () => ({
  createAdminClient: jest.fn(),
}))

const requireAuthMock = requireAuth as jest.Mock
const requireSuperAdminMock = requireSuperAdmin as jest.Mock
const requireCanEditConferenceMock = requireCanEditConference as jest.Mock
const requireConferencePermissionMock = requireConferencePermission as jest.Mock
const createAdminClientMock = createAdminClient as jest.Mock

const OWNED_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'

describe('admin conference scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET /api/admin/conferences filters conference_admin to assigned ids', async () => {
    const conferencesIn = jest.fn(() => ({
      order: jest.fn(async () => ({
        data: [{ id: OWNED_ID, name: 'Owned' }],
        error: null,
      })),
    }))

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'conference_permissions') {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ conference_id: OWNED_ID }],
                error: null,
              }),
            }),
          }
        }
        return {
          select: () => ({
            in: conferencesIn,
          }),
        }
      }),
    }

    requireAuthMock.mockResolvedValue({
      user: { id: 'admin-1' },
      profile: { id: 'admin-1', role: 'conference_admin', active: true },
      supabase,
    })

    const res = await listConferences(
      new NextRequest('http://localhost:3000/api/admin/conferences')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(conferencesIn).toHaveBeenCalledWith('id', [OWNED_ID])
    expect(body.conferences).toEqual([{ id: OWNED_ID, name: 'Owned' }])
  })

  it('GET /api/admin/conferences returns empty when conference_admin has no assignments', async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'conference_permissions') {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    requireAuthMock.mockResolvedValue({
      user: { id: 'admin-1' },
      profile: { id: 'admin-1', role: 'conference_admin', active: true },
      supabase,
    })

    const res = await listConferences(
      new NextRequest('http://localhost:3000/api/admin/conferences')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.conferences).toEqual([])
  })

  it('GET /api/admin/conferences/[id] denies conference without permission', async () => {
    requireConferencePermissionMock.mockRejectedValue(
      ApiError.forbidden('You do not have access to this conference')
    )

    const res = await getConference(
      new NextRequest(`http://localhost:3000/api/admin/conferences/${OTHER_ID}`),
      { params: { id: OTHER_ID } }
    )

    expect(requireConferencePermissionMock).toHaveBeenCalledWith(OTHER_ID)
    expect(res.status).toBe(403)
  })

  it('DELETE /api/admin/conferences/[id] stays super-admin only', async () => {
    requireSuperAdminMock.mockRejectedValue(
      ApiError.forbidden('Only super admins can access this resource')
    )

    const res = await deleteConference(
      new NextRequest(`http://localhost:3000/api/admin/conferences/${OWNED_ID}`, {
        method: 'DELETE',
      }),
      { params: { id: OWNED_ID } }
    )

    expect(requireSuperAdminMock).toHaveBeenCalled()
    expect(requireCanEditConferenceMock).not.toHaveBeenCalled()
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
  })

  it('GET /api/admin/subscription-plans requires super admin', async () => {
    requireSuperAdminMock.mockRejectedValue(
      ApiError.forbidden('Only super admins can access this resource')
    )

    const res = await getPlans(
      new NextRequest('http://localhost:3000/api/admin/subscription-plans')
    )

    expect(requireSuperAdminMock).toHaveBeenCalled()
    expect(res.status).toBe(403)
  })
})
