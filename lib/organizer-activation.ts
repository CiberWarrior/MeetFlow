import type { GenerateLinkParams } from '@supabase/supabase-js'
import { sendOrganizerActivationEmail } from '@/lib/email'
import { log } from '@/lib/logger'

const ACTIVATION_PATH = '/auth/reset-password'
const CALLBACK_PATH = '/auth/callback'

type AuthLinkError = {
  message?: string
  code?: string
  status?: number
} | null

type ActivationUser = {
  id: string
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
}

type GenerateLinkClient = {
  generateLink: (params: GenerateLinkParams) => Promise<{
    data: {
      user: ActivationUser | null
      properties: { hashed_token?: string | null } | null
    } | null
    error: AuthLinkError
  }>
  getUserById: (uid: string) => Promise<{
    data: { user: ActivationUser | null }
    error: AuthLinkError
  }>
}

type ProfileLookup = {
  from: (table: string) => {
    select: (columns: string) => {
      ilike: (
        column: string,
        value: string
      ) => {
        maybeSingle: () => PromiseLike<{
          data: { id: string } | null
          error: { message?: string } | null
        }>
      }
    }
  }
}

export type OrganizerAccount =
  | {
      ok: true
      userId: string
      created: boolean
      profileExists: boolean
      activationUrl: string | null
    }
  | { ok: false; error: string }

/**
 * Public app origin used in activation links.
 * Supabase Auth must allow `{origin}/auth/callback` as a redirect URL.
 */
export function organizerAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const url = new URL(configured)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'http://localhost:3000'
    }
    return url.origin
  } catch {
    return 'http://localhost:3000'
  }
}

export function organizerActivationCallbackUrl(): string {
  return `${organizerAppBaseUrl()}${CALLBACK_PATH}`
}

export function normalizeOrganizerEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  if (/[%_\\]/.test(normalized)) return null
  return normalized
}

export function buildOrganizerActivationUrl(
  tokenHash: string,
  type: 'invite' | 'recovery'
): string | null {
  if (!tokenHash || tokenHash.length < 16) return null
  const url = new URL(CALLBACK_PATH, organizerAppBaseUrl())
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', type)
  url.searchParams.set('next', ACTIVATION_PATH)
  return url.toString()
}

function hasEstablishedAccess(user: ActivationUser): boolean {
  return Boolean(user.email_confirmed_at || user.last_sign_in_at)
}

function isExistingAuthUserError(error: AuthLinkError): boolean {
  if (!error) return false
  const code = (error.code || '').toLowerCase()
  const message = (error.message || '').toLowerCase()
  return (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    message.includes('already been registered') ||
    message.includes('already registered') ||
    message.includes('already exists')
  )
}

function linkMetadata(fullName: string, organization?: string | null) {
  return {
    full_name: fullName,
    ...(organization ? { organization } : {}),
  }
}

async function generateActivationLink(
  authAdmin: GenerateLinkClient,
  params: {
    type: 'invite' | 'recovery'
    email: string
    fullName: string
    organization?: string | null
  }
): Promise<
  | {
      ok: true
      userId: string
      activationUrl: string
      confirmed: boolean
    }
  | { ok: false; existing: boolean; error: string }
> {
  const options =
    params.type === 'invite'
      ? {
          data: linkMetadata(params.fullName, params.organization),
          redirectTo: organizerActivationCallbackUrl(),
        }
      : { redirectTo: organizerActivationCallbackUrl() }

  const { data, error } = await authAdmin.generateLink({
    type: params.type,
    email: params.email,
    options,
  })

  if (error || !data?.user?.id) {
    log.error('Organizer activation link was not created', undefined, {
      action: 'organizer_activation',
      type: params.type,
      code: error?.code,
      status: error?.status,
    })
    return {
      ok: false,
      existing: isExistingAuthUserError(error),
      error: 'Failed to prepare organizer activation',
    }
  }

  const activationUrl = buildOrganizerActivationUrl(
    data.properties?.hashed_token || '',
    params.type
  )
  if (!activationUrl) {
    log.error('Organizer activation link was incomplete', undefined, {
      action: 'organizer_activation',
      type: params.type,
    })
    return {
      ok: false,
      existing: false,
      error: 'Failed to prepare organizer activation',
    }
  }

  return {
    ok: true,
    userId: data.user.id,
    activationUrl,
    confirmed: hasEstablishedAccess(data.user),
  }
}

/**
 * Creates a Supabase Auth invite for a new organizer, or resolves an existing
 * account without changing its password. The activation URL is a single-use
 * token hash verified by `/auth/callback`. Confirmed accounts do not receive
 * a new link.
 */
export async function resolveOrganizerAccount(args: {
  authAdmin: GenerateLinkClient
  profiles: ProfileLookup
  email: string
  fullName: string
  organization?: string | null
}): Promise<OrganizerAccount> {
  const email = normalizeOrganizerEmail(args.email)
  if (!email) {
    return { ok: false, error: 'Invalid email format' }
  }

  const { data: profile, error: profileError } = await args.profiles
    .from('user_profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (profileError) {
    log.error('Organizer profile lookup failed', undefined, {
      action: 'organizer_activation',
    })
    return { ok: false, error: 'Failed to look up organizer account' }
  }

  if (profile?.id) {
    const { data, error } = await args.authAdmin.getUserById(profile.id)
    if (error || !data.user) {
      log.error('Organizer auth lookup failed', undefined, {
        action: 'organizer_activation',
        code: error?.code,
        status: error?.status,
      })
      return { ok: false, error: 'Failed to look up organizer account' }
    }

    if (hasEstablishedAccess(data.user)) {
      return {
        ok: true,
        userId: profile.id,
        created: false,
        profileExists: true,
        activationUrl: null,
      }
    }

    const recovery = await generateActivationLink(args.authAdmin, {
      type: 'recovery',
      email,
      fullName: args.fullName,
      organization: args.organization,
    })
    if (!recovery.ok) {
      return { ok: false, error: recovery.error }
    }

    return {
      ok: true,
      userId: profile.id,
      created: false,
      profileExists: true,
      activationUrl: recovery.activationUrl,
    }
  }

  const invite = await generateActivationLink(args.authAdmin, {
    type: 'invite',
    email,
    fullName: args.fullName,
    organization: args.organization,
  })
  if (invite.ok) {
    return {
      ok: true,
      userId: invite.userId,
      created: true,
      profileExists: false,
      activationUrl: invite.activationUrl,
    }
  }
  if (!invite.existing) {
    return { ok: false, error: invite.error }
  }

  const recovery = await generateActivationLink(args.authAdmin, {
    type: 'recovery',
    email,
    fullName: args.fullName,
    organization: args.organization,
  })
  if (!recovery.ok) {
    return { ok: false, error: recovery.error }
  }

  return {
    ok: true,
    userId: recovery.userId,
    created: false,
    profileExists: false,
    activationUrl: recovery.confirmed ? null : recovery.activationUrl,
  }
}

export async function deliverOrganizerActivation(input: {
  email: string
  fullName: string
  activationUrl: string | null
}): Promise<boolean | null> {
  if (!input.activationUrl) return null

  let parsed: URL
  try {
    parsed = new URL(input.activationUrl)
  } catch {
    log.error('Organizer activation link was rejected', undefined, {
      action: 'organizer_activation_email',
    })
    return false
  }

  const expected = new URL(organizerActivationCallbackUrl())
  const type = parsed.searchParams.get('type')
  const tokenHash = parsed.searchParams.get('token_hash')
  if (
    parsed.origin !== expected.origin ||
    parsed.pathname !== CALLBACK_PATH ||
    parsed.searchParams.get('next') !== ACTIVATION_PATH ||
    (type !== 'invite' && type !== 'recovery') ||
    !tokenHash
  ) {
    log.error('Organizer activation link was rejected', undefined, {
      action: 'organizer_activation_email',
    })
    return false
  }

  try {
    await sendOrganizerActivationEmail({
      email: input.email,
      fullName: input.fullName,
      activationUrl: parsed.toString(),
    })
    log.info('Organizer activation email accepted by provider', {
      email: input.email,
      action: 'organizer_activation_email',
    })
    return true
  } catch (error) {
    log.error('Organizer activation email failed', error, {
      email: input.email,
      action: 'organizer_activation_email',
    })
    return false
  }
}
