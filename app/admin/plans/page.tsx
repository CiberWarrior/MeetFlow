'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { Save, Loader2, Tag } from 'lucide-react'
import type { SubscriptionPlan } from '@/types/subscription'

export const dynamic = 'force-dynamic'

interface EditablePlan {
  id: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  currency: string
  max_conferences: number
  max_registrations_per_conference: number | null
  max_storage_gb: number | null
  features: string[]
  active: boolean
  display_order: number
}

const toEditable = (p: SubscriptionPlan): EditablePlan => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  price_monthly: Number(p.price_monthly) || 0,
  price_yearly: Number(p.price_yearly) || 0,
  currency: p.currency || 'EUR',
  max_conferences: Number(p.max_conferences) || 0,
  max_registrations_per_conference:
    p.max_registrations_per_conference == null
      ? null
      : Number(p.max_registrations_per_conference),
  max_storage_gb: p.max_storage_gb == null ? null : Number(p.max_storage_gb),
  features: Array.isArray(p.features) ? p.features : [],
  active: !!p.active,
  display_order: Number(p.display_order) || 0,
})

export default function PlansPage() {
  const t = useTranslations('admin.plans')
  const router = useRouter()
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [plans, setPlans] = useState<EditablePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<
    { id: string; type: 'success' | 'error'; text: string } | null
  >(null)

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin')
    } else if (isSuperAdmin) {
      loadPlans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, authLoading])

  const loadPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/subscription-plans?all=true')
      const json = await response.json()
      if (response.ok && Array.isArray(json.plans)) {
        setPlans(json.plans.map(toEditable))
      }
    } catch (error) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateField = <K extends keyof EditablePlan>(
    id: string,
    field: K,
    value: EditablePlan[K]
  ) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const savePlan = async (plan: EditablePlan) => {
    try {
      setSavingId(plan.id)
      setMessage(null)
      const response = await fetch('/api/admin/subscription-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plan.id,
          name: plan.name,
          description: plan.description || null,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          currency: plan.currency || 'EUR',
          max_conferences: plan.max_conferences,
          max_registrations_per_conference: plan.max_registrations_per_conference,
          max_storage_gb: plan.max_storage_gb,
          features: plan.features,
          active: plan.active,
          display_order: plan.display_order,
        }),
      })
      if (!response.ok) {
        const errJson = await response.json().catch(() => null)
        const detail =
          errJson?.error ||
          (errJson?.details ? JSON.stringify(errJson.details) : '') ||
          `HTTP ${response.status}`
        throw new Error(detail)
      }
      setMessage({ id: plan.id, type: 'success', text: t('saved') })
    } catch (error) {
      const detail = error instanceof Error ? error.message : ''
      setMessage({
        id: plan.id,
        type: 'error',
        text: detail ? `${t('saveError')} (${detail})` : t('saveError'),
      })
    } finally {
      setSavingId(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-gray-400">{t('noPlans')}</p>
      ) : (
        <div className="space-y-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm"
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-gray-400" />
                <h2 className="text-base font-semibold text-gray-900">
                  {plan.name}
                </h2>
                {!plan.active && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {t('active')}: —
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('planName')}
                    </label>
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(e) => updateField(plan.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('description')}
                    </label>
                    <input
                      type="text"
                      value={plan.description}
                      onChange={(e) =>
                        updateField(plan.id, 'description', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('priceMonthly')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={plan.price_monthly}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'price_monthly',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('priceYearly')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={plan.price_yearly}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'price_yearly',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('currency')}
                    </label>
                    <input
                      type="text"
                      value={plan.currency}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'currency',
                          e.target.value.toUpperCase().slice(0, 3)
                        )
                      }
                      maxLength={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 uppercase placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('displayOrder')}
                    </label>
                    <input
                      type="number"
                      value={plan.display_order}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'display_order',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('maxConferences')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={plan.max_conferences}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'max_conferences',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {t('unlimitedHint')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('maxRegistrations')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={plan.max_registrations_per_conference ?? ''}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'max_registrations_per_conference',
                          e.target.value === ''
                            ? null
                            : parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('maxStorage')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={plan.max_storage_gb ?? ''}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'max_storage_gb',
                          e.target.value === ''
                            ? null
                            : parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t('features')}
                    </label>
                    <textarea
                      value={plan.features.join('\n')}
                      onChange={(e) =>
                        updateField(
                          plan.id,
                          'features',
                          e.target.value.split('\n').map((f) => f.trim()).filter(Boolean)
                        )
                      }
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <label className="flex items-center gap-3 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={plan.active}
                      onChange={(e) =>
                        updateField(plan.id, 'active', e.target.checked)
                      }
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-gray-700">{t('active')}</span>
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => savePlan(plan)}
                    disabled={savingId === plan.id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {savingId === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('save')}
                  </button>
                  {message && message.id === plan.id && (
                    <span
                      className={`text-sm ${
                        message.type === 'success'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {message.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
