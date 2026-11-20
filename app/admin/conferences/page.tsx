'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useConference } from '@/contexts/ConferenceContext'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Calendar, MapPin, Settings, Trash2, Eye, CheckCircle, XCircle, Globe } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Conference } from '@/types/conference'

export default function ConferencesPage() {
  const router = useRouter()
  const t = useTranslations('admin.conferences')
  const c = useTranslations('admin.common')
  const { conferences, loading, refreshConferences, setCurrentConference } = useConference()
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [deleting, setDeleting] = useState<string | null>(null)

  // Redirect if not Super Admin
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin')
    }
  }, [isSuperAdmin, authLoading, router])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{c('loading')}</p>
        </div>
      </div>
    )
  }

  // Don't render if not Super Admin (will redirect)
  if (!isSuperAdmin) {
    return null
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('deleteConfirm', { name }))) {
      return
    }

    setDeleting(id)

    try {
      const response = await fetch(`/api/admin/conferences/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await refreshConferences()
      } else {
        const data = await response.json()
        alert(`${t('deleteFailed')}: ${data.error}`)
      }
    } catch (error) {
      alert(t('deleteError'))
    } finally {
      setDeleting(null)
    }
  }

  const handleSelectConference = (conference: Conference) => {
    try {
      // Set the current conference first (this also saves to localStorage)
      setCurrentConference(conference)
      // Navigate to dashboard
      router.push('/admin/dashboard')
    } catch (error) {
      console.error('Error selecting conference:', error)
      // Fallback: use window.location if router fails
      window.location.href = '/admin/dashboard'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingConferences')}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-2">{t('subtitle')}</p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/admin/conferences/new"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            {t('createNew')}
          </Link>
        )}
      </div>

      {/* Empty State */}
      {conferences.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('noConferencesYet')}</h2>
            <p className="text-gray-600 mb-6">
              {isSuperAdmin ? t('getStartedSuper') : t('noAssigned')}
            </p>
            {isSuperAdmin && (
              <Link
                href="/admin/conferences/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                {t('createFirst')}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Conferences Grid */}
      {conferences.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {conferences.map((conference) => (
            <div
              key={conference.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Conference Header/Logo */}
              <div
                className="h-32 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
                style={conference.primary_color ? { background: conference.primary_color } : {}}
              >
                {conference.logo_url ? (
                  <Image
                    src={conference.logo_url}
                    alt={conference.name}
                    width={200}
                    height={128}
                    className="max-h-full max-w-full object-contain p-4"
                    unoptimized
                  />
                ) : (
                  <h3 className="text-2xl font-bold text-white px-4 text-center">
                    {conference.name}
                  </h3>
                )}
              </div>

              {/* Conference Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{conference.name}</h3>
                  <div className="flex items-center gap-2">
                    {conference.published ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                        <CheckCircle className="w-3 h-3" />
                        {t('published')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <XCircle className="w-3 h-3" />
                        {t('draft')}
                      </span>
                    )}
                  </div>
                </div>

                {conference.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{conference.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  {conference.start_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(conference.start_date).toLocaleDateString()}
                        {conference.end_date && ` - ${new Date(conference.end_date).toLocaleDateString()}`}
                      </span>
                    </div>
                  )}
                  {conference.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{conference.location}</span>
                    </div>
                  )}
                  {conference.published && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Globe className="w-4 h-4" />
                      <Link
                        href={`/conferences/${conference.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        {t('viewPublicPage')}
                      </Link>
                      <span className="text-gray-400 text-xs">({conference.slug})</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleSelectConference(conference)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {t('open')}
                  </button>
                  <Link
                    href={`/admin/conferences/${conference.id}/settings`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDelete(conference.id, conference.name)}
                      disabled={deleting === conference.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
