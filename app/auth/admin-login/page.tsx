'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Building2, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const t = useTranslations('auth.adminLogin')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('message') === 'password_reset_success') {
      setError('')
      setSuccess(true)
      setTimeout(() => {
        router.replace('/auth/admin-login')
        setSuccess(false)
      }, 5000)
    }
    if (params.get('error') === 'access_denied') {
      setError(t('errorAccessDenied'))
    }
  }, [router, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 503) {
          setError(t('errorServiceUnavailable'))
        } else {
          setError(data.error || t('errorInvalidCredentials'))
        }
        setLoading(false)
        return
      }

      setSuccess(true)
      setError('')
      setLoading(false)

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      window.location.href = '/admin/dashboard'
    } catch (error) {
      console.error('Login error:', error)
      setError(t('errorGeneric'))
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
        <div className="absolute top-1/4 left-[10%] h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-[10%] h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
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
          <p className="text-sm text-slate-400">{t('title')}</p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h1 className="mb-2 text-3xl font-black text-white">{t('welcomeBack')}</h1>
            <p className="text-sm text-slate-400">{t('signInToDashboard')}</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="mb-3 flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-400">{t('loginSuccess')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/admin/dashboard'
                }}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                {t('clickToRedirect')}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-300">
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('placeholderEmail')}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-300">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('placeholderPassword')}
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

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:from-blue-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>{t('signingIn')}</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>{t('signIn')}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3 border-t border-slate-700/50 pt-6">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  setError(t('pleaseEnterEmail'))
                  return
                }
                try {
                  setError('')
                  setResetEmailSent(false)
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
                  })
                  if (error) throw error
                  setResetEmailSent(true)
                } catch (error: any) {
                  setError(error.message || t('resetEmailFailed'))
                  setResetEmailSent(false)
                }
              }}
              className="w-full text-sm text-slate-400 transition-colors hover:text-white"
            >
              {t('forgotPassword')}
            </button>
            {resetEmailSent && (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                <p className="text-center text-sm text-green-400">{t('resetEmailSent')}</p>
              </div>
            )}
            <Link
              href="/"
              className="block text-center text-sm text-slate-400 transition-colors hover:text-white"
            >
              {t('backToHomepage')}
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">{t('betaNote')}</p>
        </div>
      </div>
    </div>
  )
}
