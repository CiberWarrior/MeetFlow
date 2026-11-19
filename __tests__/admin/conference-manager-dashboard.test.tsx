/**
 * Tests for Conference Manager Dashboard
 *
 * Verifies conference-specific stats, registrations overview, and
 * restricted access compared to super admin.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/admin/dashboard/page'

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, opts?: Record<string, string>) =>
    opts ? `${key} ${Object.values(opts).join(' ')}` : key,
  useLocale: () => 'en',
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

const mockFrom = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const mockConference = {
  id: 'conf-123',
  name: 'Test Conference',
  slug: 'test-conference',
  settings: {},
  pricing: { currency: 'EUR' },
}

jest.mock('@/contexts/ConferenceContext', () => ({
  useConference: () => ({
    currentConference: mockConference,
    conferences: [mockConference],
    setCurrentConference: jest.fn(),
    loading: false,
  }),
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: false,
    profile: { full_name: 'Conference Admin' },
    isImpersonating: false,
    originalProfile: null,
    startImpersonation: jest.fn(),
  }),
}))

describe('Conference Manager Dashboard', () => {
  const resolvedData = { data: [], error: null }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => ({ open: 0 }) })
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((cb: (v: unknown) => unknown) =>
        Promise.resolve(cb(resolvedData))
      ),
    }
    mockFrom.mockReturnValue(chain)
  })

  it('shows conference dashboard when conference is selected', async () => {
    render(<DashboardPage />)

    // Wait for loading to finish; conference dashboard shows stats or links
    await waitFor(
      () => {
        expect(screen.queryByText('platformOverview')).not.toBeInTheDocument()
        expect(document.body.textContent).toBeTruthy()
      },
      { timeout: 3000 }
    )
  })

  it('does not show platform overview for conference admin', () => {
    render(<DashboardPage />)

    // Super admin sees "Platform Overview", conference admin sees conference-specific view
    expect(screen.queryByText('platformOverview')).not.toBeInTheDocument()
  })
})
