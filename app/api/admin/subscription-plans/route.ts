import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/api-auth'
import { handleApiError } from '@/lib/api-error'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/subscription-plans
 * Super Admin only. Use ?all=true to include inactive plans.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireSuperAdmin()

    const includeAll = request.nextUrl.searchParams.get('all') === 'true'

    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('display_order', { ascending: true })

    if (!includeAll) {
      query = query.eq('active', true)
    }

    const { data: plans, error } = await query

    if (error) {
      log.error('Failed to fetch subscription plans', error, {
        userId: user.id,
      })
      return NextResponse.json({
        error: 'Failed to fetch subscription plans',
      }, { status: 500 })
    }

    return NextResponse.json({ plans })
  } catch (error) {
    return handleApiError(error, { action: 'get_subscription_plans' })
  }
}

const planUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  price_monthly: z.number().min(0).optional(),
  price_yearly: z.number().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  max_conferences: z.number().int().min(0).optional(),
  max_registrations_per_conference: z.number().int().min(0).optional().nullable(),
  max_storage_gb: z.number().int().min(0).optional().nullable(),
  features: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  display_order: z.number().int().optional(),
})

/**
 * PATCH /api/admin/subscription-plans
 * Update a subscription plan (name, prices, limits, features). Super Admin only.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { supabase } = await requireSuperAdmin()

    const body = await request.json()
    const parsed = planUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ plan: data })
  } catch (error) {
    return handleApiError(error, { action: 'update_subscription_plan' })
  }
}
