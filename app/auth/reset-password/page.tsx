'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Building2, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
      <div className="absolute top-1/4 left-[10%] h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-[10%] h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
    </div>
  )
}

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <Link href="/" className="mb-4 inline-flex items-center justify-center gap-3 group">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 opacity-75 blur transition-opacity group-hover:opacity-100" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
            <Building2 className="h-7 w-7 text-white" />
          </div>
        </div>
        <span className="text-2xl font-black text-white">MeetFlow</span>
      </Link>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  )
}

function ResetPasswordContent() {
  const t = useTranslations('auth.resetPassword')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    const verifySession = async () => {
      const url = new URL(window.location.href)
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const linkFailed = url.searchParams.get('error') === 'invalid'

      url.hash = ''
      url.searchParams.delete('token')
      url.searchParams.delete('token_hash')
      url.searchParams.delete('code')
      url.searchParams.delete('access_token')
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)

      if (linkFailed) {
        if (!cancelled) {
          setIsValidToken(false)
          setError(t('errorInvalidLink'))
        }
        return
      }

      if (accessToken || refreshToken) {
        if (!accessToken || !refreshToken) {
          if (!cancelled) {
            setIsValidToken(false)
            setError(t('errorInvalidLink'))
          }
          return
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          if (!cancelled) {
            setIsValidToken(false)
            setError(t('errorInvalidLink'))
          }
          return
        }
      }

      const { data, error: userError } = await supabase.auth.getUser()
      if (cancelled) return
      if (userError || !data.user) {
        setIsValidToken(false)
        setError(t('errorInvalidLink'))
        return
      }

      setIsValidToken(true)
    }

    verifySession()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('errorPasswordsMismatch'))
      return
    }

    if (password.length < 8) {
      setError(t('errorPasswordTooShort'))
      return
    }

    setLoading(true)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setIsValidToken(false)
      setError(t('errorInvalidLink'))
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(t('errorResetFailed'))
      setLoading(false)
      return
    }

    try {
      await supabase.auth.signOut()
    } catch {
      // The new password is already saved. The login page replaces this session.
    }
    setSuccess(true)
    setError('')

    setTimeout(() => {
      router.push('/auth/admin-login?message=password_reset_success')
    }, 2000)
  }

  if (isValidToken === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-4">
        <AuthBackground />
        <div className="relative text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-slate-400">{t('verifyingLink')}</p>
        </div>
      </div>
    )
  }

  if (isValidToken === false) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-4">
        <AuthBackground />
        <div className="relative w-full max-w-md">
          <BrandHeader subtitle={t('title')} />
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <h1 className="mb-2 text-2xl font-black text-white">{t('invalidLinkTitle')}</h1>
              <p className="text-sm text-slate-400">{t('invalidLinkMessage')}</p>
            </div>

            <div className="space-y-3">
              <Link
                href="/auth/admin-login"
                className="block w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-center font-bold text-white transition-all hover:from-blue-700 hover:to-purple-700"
              >
                {t('backToLogin')}
              </Link>
              <button
                type="button"
                onClick={async () => {
                  const email = prompt(t('promptEmail'))
                  if (!email) return
                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
                  })
                  alert(resetError ? t('errorResetFailed') : t('alertResetSent'))
                }}
                className="block w-full rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-white transition-all hover:bg-slate-600"
              >
                {t('requestNewLink')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-4">
      <AuthBackground />

      <div className="relative w-full max-w-md">
        <BrandHeader subtitle={t('title')} />

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl">
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/15 ring-1 ring-green-500/30">
                <CheckCircle className="h-7 w-7 text-green-400" />
              </div>
              <h2 className="mb-2 text-2xl font-black text-white">{t('successTitle')}</h2>
              <p className="text-sm text-slate-400">{t('successMessage')}</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="mb-2 text-3xl font-black text-white">{t('title')}</h1>
                <p className="text-sm text-slate-400">{t('enterNewPassword')}</p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-300">
                    {t('newPassword')}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('placeholderNew')}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-white"
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-300">
                    {t('confirmPassword')}
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('placeholderConfirm')}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-white"
                      aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:from-blue-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>{t('resetting')}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5" />
                      <span>{t('resetButton')}</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 border-t border-slate-700/50 pt-6">
            <Link
              href="/auth/admin-login"
              className="flex items-center justify-center text-sm text-slate-400 transition-colors hover:text-white"
            >
              {t('linkBackToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordFallback() {
  const t = useTranslations('auth.resetPassword')
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-4">
      <AuthBackground />
      <div className="relative text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <p className="text-slate-400">{t('loadingFallback')}</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
