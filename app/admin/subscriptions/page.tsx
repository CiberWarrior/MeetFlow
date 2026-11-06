'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import {
  TrendingUp,
  Repeat,
  Users,
  CreditCard,
  BarChart3,
  Landmark,
  Save,
  Loader2,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PlanBreakdown {
  plan: string
  count: number
  mrr: number
}

interface SubscriptionRow {
  id: string
  status: string
  billingCycle: 'monthly' | 'yearly'
  price: number
  currency: string
  planName: string | null
  organization: string | null
  fullName: string | null
  email: string | null
  startsAt: string | null
  expiresAt: string | null
}

interface PendingOrder {
  id: string
  planName: string | null
  billingCycle: 'monthly' | 'yearly'
  price: number
  currency: string
  fullName: string
  email: string
  organization: string | null
  paymentReference: string | null
  createdAt: string
}

interface RevenueData {
  currency: string
  mrr: number
  arr: number
  activeCount: number
  totalCount: number
  paidOffersCount: number
  paidOffersTotal: number
  byPlan: PlanBreakdown[]
  subscriptions: SubscriptionRow[]
  pendingOrders?: PendingOrder[]
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-amber-100 text-amber-800',
  canceled: 'bg-gray-100 text-gray-700',
  expired: 'bg-red-100 text-red-800',
}

interface PlatformSettings {
  bank_account_number: string
  bank_account_holder: string
  bank_name: string
  swift_bic: string
  bank_address: string
  bank_currency: string
  bank_transfer_enabled: boolean
  payment_note: string
}

const emptySettings: PlatformSettings = {
  bank_account_number: '',
  bank_account_holder: '',
  bank_name: '',
  swift_bic: '',
  bank_address: '',
  bank_currency: 'EUR',
  bank_transfer_enabled: false,
  payment_note: '',
}

export default function SubscriptionsPage() {
  const t = useTranslations('admin.subscriptions')
  const router = useRouter()
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<PlatformSettings>(emptySettings)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null)
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin/dashboard')
    } else if (isSuperAdmin) {
      loadRevenue()
      loadSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, authLoading])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/platform-settings')
      const json = await response.json()
      if (response.ok && json.settings) {
        setSettings({
          bank_account_number: json.settings.bank_account_number || '',
          bank_account_holder: json.settings.bank_account_holder || '',
          bank_name: json.settings.bank_name || '',
          swift_bic: json.settings.swift_bic || '',
          bank_address: json.settings.bank_address || '',
          bank_currency: json.settings.bank_currency || 'EUR',
          bank_transfer_enabled: !!json.settings.bank_transfer_enabled,
          payment_note: json.settings.payment_note || '',
        })
      }
    } catch (error) {
      console.error('Failed to load platform settings:', error)
    }
  }

  const saveSettings = async () => {
    try {
      setSavingSettings(true)
      setSettingsMessage(null)
      const response = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_account_number: settings.bank_account_number || null,
          bank_account_holder: settings.bank_account_holder || null,
          bank_name: settings.bank_name || null,
          swift_bic: settings.swift_bic || null,
          bank_address: settings.bank_address || null,
          bank_currency: settings.bank_currency || 'EUR',
          bank_transfer_enabled: settings.bank_transfer_enabled,
          payment_note: settings.payment_note || null,
        }),
      })
      if (!response.ok) throw new Error('save failed')
      setSettingsMessage({ type: 'success', text: t('platformPaymentSaved') })
    } catch (error) {
      setSettingsMessage({ type: 'error', text: t('platformPaymentSaveError') })
    } finally {
      setSavingSettings(false)
    }
  }

  const loadRevenue = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/platform-revenue')
      const json = await response.json()
      if (response.ok) {
        setData(json)
      }
    } catch (error) {
      console.error('Failed to load platform revenue:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(amount)

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString('hr-HR') : '—'

  const confirmBankOrder = async (orderId: string) => {
    if (!window.confirm(t('confirmBankOrderPrompt'))) return
    try {
      setConfirmingOrderId(orderId)
      const res = await fetch(
        `/api/admin/subscription-orders/${orderId}/confirm-bank-payment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error || t('confirmBankOrderError'))
      }
      await loadRevenue()
      if (json?.activation_email_sent === false) {
        alert(t('activationEmailFailed'))
      } else if (json?.alreadyPaid && json?.activation_email_sent === true) {
        alert(t('activationEmailResent'))
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('confirmBankOrderError')
      alert(message)
    } finally {
      setConfirmingOrderId(null)
    }
  }

  if (authLoading || (loading && !data)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  const currency = data?.currency || 'EUR'

  const kpis = [
    {
      label: t('mrr'),
      value: formatCurrency(data?.mrr || 0, currency),
      hint: t('mrrHint'),
      icon: <Repeat className="w-5 h-5" />,
      accent: 'from-indigo-500 to-indigo-600',
    },
    {
      label: t('arr'),
      value: formatCurrency(data?.arr || 0, currency),
      hint: t('arrHint'),
      icon: <TrendingUp className="w-5 h-5" />,
      accent: 'from-emerald-500 to-emerald-600',
    },
    {
      label: t('activeSubscriptions'),
      value: String(data?.activeCount || 0),
      hint: t('activeSubscriptionsHint', { total: data?.totalCount || 0 }),
      icon: <Users className="w-5 h-5" />,
      accent: 'from-sky-500 to-sky-600',
    },
    {
      label: t('paidOffers'),
      value: formatCurrency(data?.paidOffersTotal || 0, currency),
      hint: t('paidOffersHint', { count: data?.paidOffersCount || 0 }),
      icon: <CreditCard className="w-5 h-5" />,
      accent: 'from-fuchsia-500 to-fuchsia-600',
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Platform payment details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {t('platformPaymentTitle')}
            </h2>
            <p className="text-xs text-gray-500">{t('platformPaymentSubtitle')}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.bank_transfer_enabled}
              onChange={(e) =>
                setSettings({ ...settings, bank_transfer_enabled: e.target.checked })
              }
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-gray-700">
              {t('platformPaymentBankTransferEnabled')}
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentIban')}
              </label>
              <input
                type="text"
                value={settings.bank_account_number}
                onChange={(e) =>
                  setSettings({ ...settings, bank_account_number: e.target.value })
                }
                maxLength={34}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                placeholder="HR12 3456 7890 1234 5678 9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentHolder')}
              </label>
              <input
                type="text"
                value={settings.bank_account_holder}
                onChange={(e) =>
                  setSettings({ ...settings, bank_account_holder: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentBankName')}
              </label>
              <input
                type="text"
                value={settings.bank_name}
                onChange={(e) =>
                  setSettings({ ...settings, bank_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentSwift')}
              </label>
              <input
                type="text"
                value={settings.swift_bic}
                onChange={(e) =>
                  setSettings({ ...settings, swift_bic: e.target.value })
                }
                maxLength={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentCurrency')}
              </label>
              <input
                type="text"
                value={settings.bank_currency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bank_currency: e.target.value.toUpperCase().slice(0, 3),
                  })
                }
                maxLength={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 uppercase placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentAddress')}
              </label>
              <input
                type="text"
                value={settings.bank_address}
                onChange={(e) =>
                  setSettings({ ...settings, bank_address: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('platformPaymentNote')}
              </label>
              <textarea
                value={settings.payment_note}
                onChange={(e) =>
                  setSettings({ ...settings, payment_note: e.target.value })
                }
                rows={2}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                placeholder={t('platformPaymentNotePlaceholder')}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('platformPaymentSave')}
            </button>
            {settingsMessage && (
              <span
                className={`text-sm ${
                  settingsMessage.type === 'success'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {settingsMessage.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending bank-transfer subscription orders */}
      {data?.pendingOrders && data.pendingOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
            <h2 className="text-base font-semibold text-amber-900">
              {t('pendingBankOrdersTitle')}
            </h2>
            <p className="text-xs text-amber-800 mt-1">
              {t('pendingBankOrdersSubtitle')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colOrganizer')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colPlan')}
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">
                    {t('colPrice')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colReference')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colStart')}
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">
                    {t('colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.pendingOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">
                        {o.organization || o.fullName}
                      </div>
                      <div className="text-xs text-gray-400">{o.email}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {o.planName || '—'} (
                      {o.billingCycle === 'yearly' ? t('yearly') : t('monthly')})
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(o.price, o.currency)}
                    </td>
                    <td className="px-5 py-3 font-mono text-indigo-700">
                      {o.paymentReference || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => confirmBankOrder(o.id)}
                        disabled={confirmingOrderId === o.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60"
                      >
                        {confirmingOrderId === o.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : null}
                        {t('confirmBankOrder')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
              <span
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-white bg-gradient-to-br ${kpi.accent}`}
              >
                {kpi.icon}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-gray-400">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* Breakdown by plan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {t('byPlanTitle')}
          </h2>
        </div>
        {data && data.byPlan.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {data.byPlan.map((p) => {
              const share = data.mrr > 0 ? (p.mrr / data.mrr) * 100 : 0
              return (
                <div key={p.plan} className="px-5 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{p.plan}</span>
                    <span className="text-gray-500">
                      {t('subscriptionsCount', { count: p.count })} ·{' '}
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(p.mrr, currency)}
                      </span>{' '}
                      {t('perMonthShort')}
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            {t('noData')}
          </p>
        )}
      </div>

      {/* Subscriptions table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t('subscribersTitle')}
          </h2>
        </div>
        {data && data.subscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colOrganizer')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colPlan')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colCycle')}
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">
                    {t('colPrice')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colStatus')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    {t('colStart')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.subscriptions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">
                        {s.organization || s.fullName || '—'}
                      </div>
                      {s.email && (
                        <div className="text-xs text-gray-400">{s.email}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {s.planName || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {s.billingCycle === 'yearly'
                        ? t('yearly')
                        : t('monthly')}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(s.price, s.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusStyles[s.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {t(`status.${s.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {formatDate(s.startsAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            {t('noSubscribers')}
          </p>
        )}
      </div>
    </div>
  )
}
