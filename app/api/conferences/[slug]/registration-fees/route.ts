import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/logger'
import { getAvailableFeesForForm } from '@/lib/custom-registration-fees'
import type { RegistrationFeeOption } from '@/types/custom-registration-fee'

export const dynamic = 'force-dynamic'

/**
 * GET /api/conferences/[slug]/registration-fees
 *
 * Public: returns custom registration fees for the registration form.
 * Uses admin client so authenticated visitors (participants / unrelated admins)
 * are not blocked by scoped conferences RLS (migration 067).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    let adminClient
    try {
      adminClient = createAdminClient()
    } catch {
      log.error('Registration fees: admin client not available')
      return NextResponse.json(
        { error: 'Failed to load registration fees' },
        { status: 503 }
      )
    }

    const { data: conf, error: confError } = await adminClient
      .from('conferences')
      .select('id')
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (confError || !conf) {
      return NextResponse.json(
        { error: 'Conference not found' },
        { status: 404 }
      )
    }

    const fees: RegistrationFeeOption[] = await getAvailableFeesForForm(
      adminClient,
      conf.id
    )

    return NextResponse.json({
      fees,
      currency: fees[0]?.currency ?? 'EUR',
    })
  } catch (e) {
    log.error('Registration fees fetch error', e)
    return NextResponse.json(
      { error: 'Failed to load registration fees' },
      { status: 500 }
    )
  }
}
