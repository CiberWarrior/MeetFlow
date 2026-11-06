import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ResetPasswordPage from '@/app/auth/reset-password/page'
import en from '@/messages/en.json'
import { supabase } from '@/lib/supabase'

const push = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const copy = en.auth.resetPassword as Record<string, string>
    const value = copy[key]
    if (!value) throw new Error(`Missing translation: ${key}`)
    return value
  },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      setSession: jest.fn(),
      updateUser: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}))

const auth = supabase.auth as unknown as {
  getUser: jest.Mock
  setSession: jest.Mock
  updateUser: jest.Mock
  signOut: jest.Mock
}

describe('password activation page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.history.replaceState({}, '', '/auth/reset-password')
  })

  it('rejects a manipulated query token when no session exists', async () => {
    window.history.replaceState({}, '', '/auth/reset-password?token=forged-token&type=recovery')
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'forged-token' } })

    render(<ResetPasswordPage />)

    expect(await screen.findByText(en.auth.resetPassword.invalidLinkTitle)).toBeInTheDocument()
    expect(screen.queryByLabelText(en.auth.resetPassword.newPassword)).not.toBeInTheDocument()
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(window.location.href).not.toContain('forged-token')
  })

  it('rejects an expired hash token instead of trusting its presence', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/reset-password#access_token=expired-access-token&refresh_token=expired-refresh-token'
    )
    auth.setSession.mockResolvedValue({ error: { message: 'expired-access-token' } })

    render(<ResetPasswordPage />)

    expect(await screen.findByText(en.auth.resetPassword.invalidLinkMessage)).toBeInTheDocument()
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(window.location.href).not.toContain('expired-access-token')
    expect(screen.queryByText('expired-access-token')).not.toBeInTheDocument()
  })

  it('shows the password form only after the session is verified', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    render(<ResetPasswordPage />)

    expect(await screen.findByLabelText(en.auth.resetPassword.newPassword)).toBeInTheDocument()
  })

  it('shows a generic failure when the saved password cannot be updated', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    auth.updateUser.mockResolvedValue({
      error: { message: 'leaked-reset-token-should-not-render' },
    })

    render(<ResetPasswordPage />)
    fireEvent.change(await screen.findByLabelText(en.auth.resetPassword.newPassword), {
      target: { value: 'new-password-1' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.resetPassword.confirmPassword), {
      target: { value: 'new-password-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.auth.resetPassword.resetButton }))

    expect(await screen.findByText(en.auth.resetPassword.errorResetFailed)).toBeInTheDocument()
    expect(screen.queryByText('leaked-reset-token-should-not-render')).not.toBeInTheDocument()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('signs out after a password is saved', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    auth.updateUser.mockResolvedValue({ error: null })
    auth.signOut.mockResolvedValue({ error: null })

    render(<ResetPasswordPage />)
    fireEvent.change(await screen.findByLabelText(en.auth.resetPassword.newPassword), {
      target: { value: 'new-password-1' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.resetPassword.confirmPassword), {
      target: { value: 'new-password-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.auth.resetPassword.resetButton }))

    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(en.auth.resetPassword.successTitle)).toBeInTheDocument()
  })
})
