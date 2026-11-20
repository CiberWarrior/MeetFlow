'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function AdminParticipantsPage() {
  const t = useTranslations('admin.participants')
  const router = useRouter()
  const { user, profile, loading: authLoading, isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<any[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  })
  const [filters, setFilters] = useState({
    search: '',
    hasAccount: 'all',
    loyaltyTier: 'all',
  })

  const fetchParticipants = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (filters.search) params.append('search', filters.search)
      if (filters.hasAccount !== 'all')
        params.append('has_account', filters.hasAccount)
      if (filters.loyaltyTier !== 'all')
        params.append('loyalty_tier', filters.loyaltyTier)

      const response = await fetch(`/api/admin/participants?${params}`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data.participants)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.search, filters.hasAccount, filters.loyaltyTier])

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin')
      return
    }
    if (!authLoading && user && isSuperAdmin) {
      fetchParticipants()
    }
  }, [authLoading, user, isSuperAdmin, router, fetchParticipants])

  const getLoyaltyColor = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return 'bg-purple-100 text-purple-800'
      case 'gold':
        return 'bg-yellow-100 text-yellow-800'
      case 'silver':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-orange-100 text-orange-800'
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('totalParticipants')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {pagination.total}
              </p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('withAccounts')}</p>
              <p className="text-2xl font-bold text-blue-600">
                {participants.filter((p) => p.has_account).length}
              </p>
            </div>
            <div className="text-4xl">🔐</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('guestParticipants')}</p>
              <p className="text-2xl font-bold text-gray-600">
                {participants.filter((p) => !p.has_account).length}
              </p>
            </div>
            <div className="text-4xl">👤</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('platinumMembers')}</p>
              <p className="text-2xl font-bold text-purple-600">
                {participants.filter((p) => p.loyalty_tier === 'platinum').length}
              </p>
            </div>
            <div className="text-4xl">⭐</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('search')}
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder={t('searchPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('accountStatus')}
            </label>
            <select
              value={filters.hasAccount}
              onChange={(e) =>
                setFilters({ ...filters, hasAccount: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('all')}</option>
              <option value="true">{t('withAccount')}</option>
              <option value="false">{t('guestOnly')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('loyaltyTier')}
            </label>
            <select
              value={filters.loyaltyTier}
              onChange={(e) =>
                setFilters({ ...filters, loyaltyTier: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('allTiers')}</option>
              <option value="platinum">{t('platinum')}</option>
              <option value="gold">{t('gold')}</option>
              <option value="silver">{t('silver')}</option>
              <option value="bronze">{t('bronze')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Participants Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('participantHeader')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('contact')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('loyalty')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('events')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participants.map((participant) => (
                <tr key={participant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {participant.first_name} {participant.last_name}
                      </div>
                      {participant.institution && (
                        <div className="text-sm text-gray-500">
                          {participant.institution}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {participant.email}
                    </div>
                    {participant.phone && (
                      <div className="text-sm text-gray-500">
                        {participant.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getLoyaltyColor(participant.loyalty_tier)}`}
                    >
                      {['platinum', 'gold', 'silver', 'bronze'].includes(participant.loyalty_tier)
                        ? t(participant.loyalty_tier as 'platinum' | 'gold' | 'silver' | 'bronze')
                        : participant.loyalty_tier}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {participant.loyalty_points} pts
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{participant.stats.total_registrations} {t('total')}</div>
                    <div className="text-xs text-gray-500">
                      {participant.stats.attended_events} {t('attended')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {participant.has_account ? (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {t('hasAccount')}
                      </span>
                    ) : (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {t('guest')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/admin/participants/${participant.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {t('viewDetails')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              {t('showingPage', { page: pagination.page, pages: pagination.pages })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page - 1 })
                }
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                {t('previous')}
              </button>
              <button
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page + 1 })
                }
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
