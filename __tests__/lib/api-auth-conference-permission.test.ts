/**
 * @jest-environment node
 */
import { ApiError } from '@/lib/api-error'
import {
  requireCanEditConference,
  requireConferencePermission,
  requireSuperAdmin,
} from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

jest.mock('@/lib/logger', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/supabase', () => ({
  createServerClient: jest.fn(),
}))

const createServerClientMock = createServerClient as jest.Mock

const CONFERENCE_ID = '8c0a5da3-0420-4286-8b76-6aad5be18724'
const OTHER_CONFERENCE_ID = '22222222-2222-2222-2222-222222222222'

type Profile = {
  id: string
  role: 'super_admin' | 'conference_admin'
  active: boolean
  email: string
}

function mockAuth(options: {
  user?: { id: string; email: string } | null
  profile?: Profile | null
  permission?: Record<string, unknown> | null
  permissionError?: { message: string } | null
}) {
  const from = jest.fn((table: string) => {
    if (table === 'user_profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: options.profile ?? null,
              error: options.profile ? null : { message: 'missing profile' },
            }),
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
                data: options.permission ?? null,
                error:
                  options.permissionError ??
                  (options.permission ? null : { message: 'no permission row' }),
              }),
            }),
          }),
        }),
      }
    }

    throw new Error(`unexpected table ${table}`)
  })

  createServerClientMock.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: options.user ? null : { message: 'no session' },
      }),
    },
    from,
  })

  return { from }
}

const conferenceAdmin: Profile = {
  id: 'admin-1',
  role: 'conference_admin',
  active: true,
  email: 'organizer@example.com',
}

const editRow = {
  user_id: 'admin-1',
  conference_id: CONFERENCE_ID,
  can_edit_conference: true,
  can_delete_data: true,
  can_view_registrations: true,
}

describe('conference permission gates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lets an assigned conference admin edit when can_edit_conference is true', async () => {
    mockAuth({
      user: { id: 'admin-1', email: 'organizer@example.com' },
      profile: conferenceAdmin,
      permission: editRow,
    })

    const auth = await requireCanEditConference(CONFERENCE_ID)

    expect(auth.user.id).toBe('admin-1')
    expect(auth.profile.role).toBe('conference_admin')
  })

  it('rejects conference edit when the permission row is false', async () => {
    mockAuth({
      user: { id: 'admin-1', email: 'organizer@example.com' },
      profile: conferenceAdmin,
      permission: { ...editRow, can_edit_conference: false },
    })

    await expect(requireCanEditConference(CONFERENCE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('rejects conference edit when the admin is not assigned to that conference', async () => {
    mockAuth({
      user: { id: 'admin-1', email: 'organizer@example.com' },
      profile: conferenceAdmin,
      permission: null,
    })

    await expect(requireCanEditConference(OTHER_CONFERENCE_ID)).rejects.toBeInstanceOf(ApiError)
    await expect(requireCanEditConference(OTHER_CONFERENCE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('keeps delete blocked for conference admin even when can_delete_data is true', async () => {
    mockAuth({
      user: { id: 'admin-1', email: 'organizer@example.com' },
      profile: conferenceAdmin,
      permission: editRow,
    })

    await expect(
      requireConferencePermission(CONFERENCE_ID, 'can_delete_data')
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('still lets a super admin edit and delete without a permission row', async () => {
    const { from } = mockAuth({
      user: { id: 'super-1', email: 'owner@example.com' },
      profile: {
        id: 'super-1',
        role: 'super_admin',
        active: true,
        email: 'owner@example.com',
      },
    })

    await expect(requireCanEditConference(CONFERENCE_ID)).resolves.toMatchObject({
      profile: { role: 'super_admin' },
    })
    await expect(
      requireConferencePermission(CONFERENCE_ID, 'can_delete_data')
    ).resolves.toMatchObject({
      profile: { role: 'super_admin' },
    })
    expect(from).not.toHaveBeenCalledWith('conference_permissions')
  })

  it('rejects platform access for a conference admin', async () => {
    mockAuth({
      user: { id: 'admin-1', email: 'organizer@example.com' },
      profile: conferenceAdmin,
    })

    await expect(requireSuperAdmin()).rejects.toMatchObject({ statusCode: 403 })
  })
})
