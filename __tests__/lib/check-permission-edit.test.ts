/**
 * @jest-environment node
 */
import { checkPermission } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase'

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {},
  createServerClient: jest.fn(),
}))

const createServerClientMock = createServerClient as jest.Mock

const CONFERENCE_ID = '8c0a5da3-0420-4286-8b76-6aad5be18724'

function mockSession(profile: { id: string; role: string; active: boolean }, permission: Record<string, unknown> | null) {
  createServerClientMock.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: profile.id } }, error: null }),
    },
    from: (table: string) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: profile, error: null }),
            }),
          }),
        }
      }
      if (table === 'conference_permissions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: permission,
                  error: permission ? null : { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })
}

describe('checkPermission edit and delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows conference edit only when the assigned row grants it', async () => {
    mockSession(
      { id: 'admin-1', role: 'conference_admin', active: true },
      { can_edit_conference: true, can_delete_data: true }
    )

    await expect(checkPermission(CONFERENCE_ID, 'can_edit_conference')).resolves.toBe(true)
  })

  it('keeps delete false for a conference admin', async () => {
    mockSession(
      { id: 'admin-1', role: 'conference_admin', active: true },
      { can_edit_conference: true, can_delete_data: true }
    )

    await expect(checkPermission(CONFERENCE_ID, 'can_delete_data')).resolves.toBe(false)
  })

  it('lets a super admin delete', async () => {
    mockSession(
      { id: 'super-1', role: 'super_admin', active: true },
      null
    )

    await expect(checkPermission(CONFERENCE_ID, 'can_delete_data')).resolves.toBe(true)
  })
})
