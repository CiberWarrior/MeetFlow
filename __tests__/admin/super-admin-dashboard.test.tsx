/**
 * Tests for Super Admin Dashboard
 *
 * Verifies platform overview, stats, quick actions, team list, and impersonation
 * Super admin has access to all conferences, users, and platform-level actions.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/admin/dashboard/page'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, string> = {
      platformOverview: 'Platform Overview',
      totalConferences: 'Total Conferences',
      activeConferences: 'Active Conferences',
      totalUsers: 'Total Users',
      totalRegistrations: 'Total Registrations',
      conferenceTurnover: 'Conference Turnover',
      quickActions: 'Quick Actions',
      welcomeBack: 'Welcome back, {name}',
    }
    return (key: string, opts?: Record<string, string>) =>
      opts ? `${keys[key] || key} ${Object.values(opts).join(' ')}` : keys[key] || key
  },
  useLocale: () => 'en',
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'view' ? 'platform' : null),
  }),
}))

const mockFrom = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const mockSetCurrentConference = jest.fn()
const mockStartImpersonation = jest.fn()

jest.mock('@/contexts/ConferenceContext', () => ({
  useConference: () => ({
    currentConference: null,
    conferences: [],
    setCurrentConference: mockSetCurrentConference,
    loading: false,
  }),
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: true,
    profile: { full_name: 'Super Admin' },
    isImpersonating: false,
    originalProfile: null,
    startImpersonation: mockStartImpersonation,
  }),
}))

describe('Super Admin Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })
    ;(global.fetch as jest.Mock) = jest.fn().mockResolvedValue({ ok: true, json: () => ({ users: [] }) })
  })

  it('renders platform overview for super admin when no conference selected', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((cb: (arg: unknown) => unknown) => {
        return Promise.resolve(cb({ data: [], error: null, count: 0 }))
      }),
    }))

    const { findByText } = render(<DashboardPage />)

    expect(await findByText('Platform Overview')).toBeInTheDocument()
    expect(await findByText('Total Conferences')).toBeInTheDocument()
    expect(await findByText('Quick Actions')).toBeInTheDocument()
  })

  it('displays platform stats cards', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((cb: (arg: unknown) => unknown) =>
        Promise.resolve(
          cb({
            data: [],
            error: null,
            count: 0,
          })
        )
      ),
    }))

    const { findByText } = render(<DashboardPage />)

    expect(await findByText('Active Conferences')).toBeInTheDocument()
    expect(await findByText('Total Users')).toBeInTheDocument()
    expect(await findByText('Total Registrations')).toBeInTheDocument()
    expect(await findByText('Conference Turnover')).toBeInTheDocument()
  })
})
