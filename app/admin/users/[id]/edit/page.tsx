'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import {
  UserPlus,
  Mail,
  User,
  Phone,
  Building2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface Conference {
  id: string
  name: string
}

interface UserProfile {
  id: string
  email: string
  full_name: string
  phone: string | null
  organization: string | null
  role: string
  active: boolean
  conference_permissions: Array<{
    conference_id: string
    can_view_registrations: boolean
    can_export_data: boolean
    can_manage_payments: boolean
    can_manage_abstracts: boolean
    can_check_in: boolean
    can_generate_certificates: boolean
    can_edit_conference: boolean
    can_delete_data: boolean
  }>
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string
  const t = useTranslations('admin.users')
  const c = useTranslations('admin.common')
  const { isSuperAdmin, loading: authLoading } = useAuth()
  
  // Form state
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [organization, setOrganization] = useState('')
  const [active, setActive] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  
  // Conferences and permissions
  const [conferences, setConferences] = useState<Conference[]>([])
  const [selectedConferences, setSelectedConferences] = useState<string[]>([])
  const [permissions, setPermissions] = useState({
    can_view_registrations: true,
    can_export_data: true,
    can_manage_payments: true,
    can_manage_abstracts: true,
    can_check_in: true,
    can_generate_certificates: true,
    can_edit_conference: false,
    can_delete_data: false
  })
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingConferences, setLoadingConferences] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin')
    } else if (isSuperAdmin) {
      loadUser()
      loadConferences()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, authLoading, router, userId])

  const loadUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      const data = await response.json()

      if (response.ok && data.user) {
        const user: UserProfile = data.user
        setEmail(user.email)
        setFullName(user.full_name)
        setPhone(user.phone || '')
        setOrganization(user.organization || '')
        setActive(user.active)

        // Load assigned conferences
        const assignedConferences = user.conference_permissions?.map(p => p.conference_id) || []
        setSelectedConferences(assignedConferences)

        // Load permissions (use first permission set if multiple conferences)
        if (user.conference_permissions && user.conference_permissions.length > 0) {
          const firstPerm = user.conference_permissions[0]
          setPermissions({
            can_view_registrations: firstPerm.can_view_registrations,
            can_export_data: firstPerm.can_export_data,
            can_manage_payments: firstPerm.can_manage_payments,
            can_manage_abstracts: firstPerm.can_manage_abstracts,
            can_check_in: firstPerm.can_check_in,
            can_generate_certificates: firstPerm.can_generate_certificates,
            can_edit_conference: firstPerm.can_edit_conference,
            can_delete_data: firstPerm.can_delete_data
          })
        }
      } else {
        setError(t('userNotFound'))
      }
    } catch (error) {
      console.error('Error loading user:', error)
      setError(t('loadUserFailed'))
    } finally {
      setLoadingUser(false)
    }
  }

  const loadConferences = async () => {
    try {
      const response = await fetch('/api/admin/conferences')
      const data = await response.json()

      if (response.ok) {
        setConferences(data.conferences || [])
      }
    } catch (error) {
      console.error('Error loading conferences:', error)
    } finally {
      setLoadingConferences(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (!fullName) {
      setError(t('validationFullNameRequired'))
      setLoading(false)
      return
    }

    if (selectedConferences.length === 0) {
      setError(t('validationSelectConference'))
      setLoading(false)
      return
    }

    // Validate password if provided
    if (newPassword && newPassword.length < 8) {
      setError(t('validationPasswordLength'))
      setLoading(false)
      return
    }

    try {
      const updateData: any = {
        full_name: fullName,
        phone: phone || undefined,
        organization: organization || undefined,
        active,
        conference_ids: selectedConferences,
        permissions
      }

      if (newPassword) {
        updateData.password = newPassword
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/admin/users')
        }, 2000)
      } else {
        setError(data.error || t('updateFailed'))
        setLoading(false)
      }
    } catch (error) {
      setError(t('errorGeneric'))
      setLoading(false)
    }
  }

  const toggleConference = (conferenceId: string) => {
    setSelectedConferences(prev =>
      prev.includes(conferenceId)
        ? prev.filter(id => id !== conferenceId)
        : [...prev, conferenceId]
    )
  }

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (authLoading || loadingUser || loadingConferences) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return null
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('userUpdatedSuccess')}</h2>
          <p className="text-gray-600 mb-6">
            {t('userUpdatedMessage')}
          </p>
          <p className="text-sm text-gray-500">{t('redirectingToUsers')}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToUsers')}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <UserPlus className="w-8 h-8 text-blue-600" />
          {t('editPageTitle')}
        </h1>
        <p className="text-gray-600 mt-2">{t('editPageSubtitle')}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{t('errorLabel')}</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('basicInformation')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('email')} <span className="text-gray-400">{t('emailCannotChange')}</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('newPasswordLabel')} <span className="text-gray-400">{t('newPasswordLeaveBlank')}</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('passwordPlaceholder')}
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('fullName')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('fullNamePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('phone')}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('phonePlaceholder')}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organization')}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('organizationPlaceholder')}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('activeUserCanLogin')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Assign Conferences */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {t('assignConferences')} <span className="text-red-500">*</span>
          </h2>
          <p className="text-sm text-gray-600 mb-4">{t('assignConferencesHint')}</p>
          
          <div className="space-y-2">
            {conferences.map((conference) => (
              <label
                key={conference.id}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedConferences.includes(conference.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedConferences.includes(conference.id)}
                  onChange={() => toggleConference(conference.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900">{conference.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('permissions')}</h2>
          <p className="text-sm text-gray-600 mb-4">{t('permissionsHint')}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PermissionCheckbox
              checked={permissions.can_view_registrations}
              onChange={() => togglePermission('can_view_registrations')}
              label={t('permViewRegistrations')}
              description={t('permViewRegistrationsDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_export_data}
              onChange={() => togglePermission('can_export_data')}
              label={t('permExportData')}
              description={t('permExportDataDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_manage_payments}
              onChange={() => togglePermission('can_manage_payments')}
              label={t('permManagePayments')}
              description={t('permManagePaymentsDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_manage_abstracts}
              onChange={() => togglePermission('can_manage_abstracts')}
              label={t('permManageAbstracts')}
              description={t('permManageAbstractsDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_check_in}
              onChange={() => togglePermission('can_check_in')}
              label={t('permCheckIn')}
              description={t('permCheckInDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_generate_certificates}
              onChange={() => togglePermission('can_generate_certificates')}
              label={t('permGenerateCertificates')}
              description={t('permGenerateCertificatesDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_edit_conference}
              onChange={() => togglePermission('can_edit_conference')}
              label={t('permEditConference')}
              description={t('permEditConferenceDesc')}
            />
            <PermissionCheckbox
              checked={permissions.can_delete_data}
              onChange={() => togglePermission('can_delete_data')}
              label={t('permDeleteData')}
              description={t('permDeleteDataDesc')}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/users"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            {c('cancel')}
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('updating')}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                {t('updateUserButton')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// Permission Checkbox Component
function PermissionCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description: string
}) {
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
        checked
          ? 'border-green-500 bg-green-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
      />
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      </div>
    </label>
  )
}

