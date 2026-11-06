import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ACTIVATION_NEXT = '/auth/reset-password'

function activationRedirect(requestUrl: string, failed: boolean) {
  const target = new URL(ACTIVATION_NEXT, requestUrl)
  if (failed) {
    target.searchParams.set('error', 'invalid')
  }
  return NextResponse.redirect(target)
}

async function createCallbackClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Cookie writes can fail when the response has already started.
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Cookie removal can fail when the response has already started.
          }
        },
      },
    }
  )
}

/**
 * GET /auth/callback
 * Verifies Supabase invite and recovery links, then continues other auth codes.
 * The token hash is consumed here and is not forwarded to the next page.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const activationType = type === 'invite' || type === 'recovery'

  if (tokenHash && activationType) {
    const supabase = await createCallbackClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (error) {
      log.error('Activation link verification failed', undefined, {
        action: 'auth_callback',
        type,
      })
      return activationRedirect(request.url, true)
    }

    return activationRedirect(request.url, false)
  }

  if (code && activationType) {
    const supabase = await createCallbackClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      log.error('Activation code exchange failed', undefined, {
        action: 'auth_callback',
        type,
      })
      return activationRedirect(request.url, true)
    }

    return activationRedirect(request.url, false)
  }

  if (activationType) {
    return activationRedirect(request.url, true)
  }

  if (code) {
    const supabase = await createCallbackClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      log.error('Auth callback error', undefined, {
        action: 'auth_callback',
        type,
      })
      return NextResponse.redirect(new URL('/auth/admin-login?error=auth_failed', request.url))
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, active')
        .eq('id', user.id)
        .single()

      if (
        profile &&
        profile.active &&
        (profile.role === 'super_admin' || profile.role === 'conference_admin')
      ) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
    }
  }

  return NextResponse.redirect(new URL('/auth/admin-login?message=login_disabled', request.url))
}
