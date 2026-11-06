'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useConference } from '@/contexts/ConferenceContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Registration } from '@/types/registration'
import * as XLSX from 'xlsx'
import { QRCodeSVG } from 'qrcode.react'
import { showSuccess, showError, showInfo } from '@/utils/toast'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import PaymentMethodBadge from '@/components/admin/PaymentMethodBadge'
import PaymentStatusBadge from '@/components/admin/PaymentStatusBadge'
import StatusBadge from '@/components/admin/StatusBadge'
import RegistrationDetailDrawer from '@/components/admin/RegistrationDetailDrawer'
import {
  getAccommodationDisplay,
  matchesAccommodationFilter,
  resolveAddonLabels,
  type AccommodationFilter,
} from '@/lib/registration-admin-display'
import {
  ATTACHMENT_REFERENCE_LABEL,
  openRegistrationAttachment,
  parseRegistrationAttachmentPath,
} from '@/lib/registration-attachment'
import type { HotelOption, RegistrationAddon, CustomRegistrationField } from '@/types/conference'

// Force dynamic rendering for this page (uses searchParams)
export const dynamic = 'force-dynamic'

function RegistrationsPageContent() {
  const searchParams = useSearchParams()
  const t = useTranslations('admin.registrations')
  const c = useTranslations('admin.common')
  const tDashboard = useTranslations('admin.dashboard')
  const tConferences = useTranslations('admin.conferences')
  const { currentConference, conferences, setCurrentConference, loading: conferenceLoading } = useConference()
  const { isSuperAdmin } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterAccommodation, setFilterAccommodation] = useState<AccommodationFilter>('all')
  const [detailRegistration, setDetailRegistration] = useState<Registration | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionMenuOpen, setBulkActionMenuOpen] = useState(false)
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false)
  const [bulkEmailType, setBulkEmailType] = useState<'payment_reminder' | 'pre_conference_reminder' | 'event_details'>('payment_reminder')
  const [bulkEmailData, setBulkEmailData] = useState({
    customMessage: '',
    conferenceDate: '',
    conferenceLocation: '',
    conferenceProgram: '',
  })
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [selectedQRRegistration, setSelectedQRRegistration] = useState<Registration | null>(null)
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null)
  // B3: Pagination – avoid loading all registrations at once
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)

  // Handle conference query parameter - set conference from URL if provided
  useEffect(() => {
    const conferenceId = searchParams?.get('conference')
    if (conferenceId && conferences.length > 0) {
      const conference = conferences.find((c) => c.id === conferenceId)
      if (conference && conference.id !== currentConference?.id) {
        setCurrentConference(conference)
        setPage(1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, conferences])

  useEffect(() => {
    if (conferenceLoading) return
    if (currentConference) {
      loadRegistrations(page)
    } else {
      // No conference selected - stop the spinner and show the empty state below.
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConference, page, conferenceLoading])

  const loadRegistrations = async (pageNum: number) => {
    if (!currentConference) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const from = (pageNum - 1) * pageSize
      const to = from + pageSize - 1

      // Get total count (single query, lightweight)
      const { count: countResult, error: countError } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('conference_id', currentConference.id)

      if (countError) throw countError
      setTotalCount(countResult ?? 0)

      // Prefer join for profile enrichment; fall back if relation/schema cache fails
      let data: any[] | null = null
      let fetchError: { message?: string } | null = null

      const withJoins = await supabase
        .from('registrations')
        .select(
          `
          *,
          participant_profiles (
            phone,
            country,
            institution
          ),
          custom_registration_fees (
            name
          )
        `
        )
        .eq('conference_id', currentConference.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (withJoins.error) {
        const fallback = await supabase
          .from('registrations')
          .select('*')
          .eq('conference_id', currentConference.id)
          .order('created_at', { ascending: false })
          .range(from, to)
        data = fallback.data
        fetchError = fallback.error
      } else {
        data = withJoins.data
      }

      if (fetchError) throw fetchError

      setRegistrations(
        (data || []).map((r: any) => {
          // Helper: Extract data from participants[0].customFields if available
          const firstParticipant = r.participants?.[0]?.customFields || {}
          const customData = r.custom_data || {}
          // participant_profiles is returned as object, not array
          const participantProfile = r.participant_profiles || null
          
          // Helper: find field value by exact names or by key pattern (e.g. key contains 'email')
          const findField = (
            possibleNames: string[],
            profileField?: string,
            keyPattern?: (k: string) => boolean
          ) => {
            if (profileField && participantProfile && participantProfile[profileField]) {
              return participantProfile[profileField]
            }
            for (const name of possibleNames) {
              if (firstParticipant[name]) return firstParticipant[name]
              if (customData[name]) return customData[name]
            }
            // Fallback: iterate all keys and match by pattern (catches "Ime", "Prezime", "E-mail", etc.)
            if (keyPattern) {
              for (const [k, v] of Object.entries(firstParticipant)) {
                if (keyPattern(k.toLowerCase()) && v != null && String(v).trim()) return String(v)
              }
              for (const [k, v] of Object.entries(customData)) {
                if (keyPattern(k.toLowerCase()) && v != null && String(v).trim()) return String(v)
              }
            }
            return ''
          }

          return {
            id: r.id,
            registration_number: r.registration_number || undefined,
            firstName: r.first_name || findField(['First Name', 'FirstName', 'first_name', 'ime', 'given_name', 'Name'], undefined, (k) => (k.includes('first') && k.includes('name')) || k === 'ime' || k === 'givenname'),
            lastName: r.last_name || findField(['Last Name', 'LastName', 'last_name', 'prezime', 'surname', 'SURNAME'], undefined, (k) => (k.includes('last') && k.includes('name')) || k.includes('surname') || k === 'prezime'),
            email: r.email || findField(['EMAIL', 'Email', 'email', 'E-mail', 'e_mail'], undefined, (k) => k.includes('email') || k.includes('e-mail')),
            phone: r.phone || findField(['Phone Number', 'Phone', 'phone', 'Telephone', 'Mobile', 'Contact Number', 'Tel'], 'phone', (k) => k.includes('phone') || k.includes('tel') || k.includes('mobile')),
            country: r.country || findField(['Country', 'country'], 'country', (k) => k.includes('country')),
            institution: r.institution || findField(['Institution', 'institution', 'Organization', 'Company'], 'institution', (k) => k.includes('institution') || k.includes('organization') || k.includes('company')),
            arrivalDate: r.arrival_date || r.accommodation?.arrival_date || findField(['Arrival Date', 'arrival_date', 'Check In', 'check_in'], undefined, (k) => k.includes('arrival') || (k.includes('check') && k.includes('in'))),
            departureDate: r.departure_date || r.accommodation?.departure_date || findField(['Departure Date', 'departure_date', 'Check Out', 'check_out'], undefined, (k) => k.includes('departure') || (k.includes('check') && k.includes('out'))),
            accommodation: r.accommodation || null, // Store accommodation data
            // New fee system (custom_registration_fees via registration_fee_id) takes priority;
            // fall back to the legacy registration_fee_type column for older registrations
            registrationFeeType: r.custom_registration_fees?.name ?? r.registration_fee_type ?? null,
            paymentMethod: r.payment_method ?? null,
            bank_transfer_proof_url: r.bank_transfer_proof_url ?? null,
            bank_transfer_verified: r.bank_transfer_verified ?? false,
            paymentRequired: r.payment_required,
            paymentByCard: r.payment_by_card || false,
            accompanyingPersons: r.accompanying_persons || false,
            accompanyingPersonsData: r.accompanying_persons_data || [],
            galaDinner: r.gala_dinner || false,
            presentationType: r.presentation_type || false,
            abstractSubmission: r.abstract_submission || false,
            paymentStatus: r.payment_status,
            createdAt: r.created_at,
            checkedIn: r.checked_in || false,
            checkedInAt: r.checked_in_at || null,
            customFields: customData,
            participants: r.participants || [],
            selectedAddons: r.selected_addons || [],
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Filter registrations based on search and status
  const filteredRegistrations = registrations.filter((reg) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      (reg.firstName || '').toLowerCase().includes(searchLower) ||
      (reg.lastName || '').toLowerCase().includes(searchLower) ||
      (reg.email || '').toLowerCase().includes(searchLower) ||
      (reg.registration_number || '').toLowerCase().includes(searchLower) ||
      (reg.country && reg.country.toLowerCase().includes(searchLower)) ||
      (reg.institution && reg.institution.toLowerCase().includes(searchLower))

    const matchesFilter =
      filterStatus === 'all' || reg.paymentStatus === filterStatus

    const matchesAccommodation = matchesAccommodationFilter(reg, filterAccommodation)

    return matchesSearch && matchesFilter && matchesAccommodation
  })

  const hotelOptions = (currentConference?.settings?.hotel_options || []) as HotelOption[]
  const registrationAddons = (currentConference?.settings?.registration_addons || []) as RegistrationAddon[]
  const customFieldDefs = (currentConference?.settings?.custom_registration_fields || []) as CustomRegistrationField[]

  // Helper function to prepare data for export
  const prepareExportData = () => {
    // Get custom field definitions from current conference
    const participantSettings = currentConference?.settings?.participant_settings
    
    // Standard headers (translated)
    const standardHeaders = [
      t('exportConference'),
      t('exportFirstName'),
      t('exportLastName'),
      t('exportEmail'),
      t('exportPhone'),
      t('exportCountry'),
      t('exportInstitution'),
      t('exportArrivalDate'),
      t('exportDepartureDate'),
      t('exportHotel'),
      t('exportNights'),
      t('exportAddons'),
      t('exportRegistrationFeeType'),
      t('exportPaymentMethod'),
      t('exportPayerType'),
      t('exportCompanyName'),
      t('exportPaymentRequired'),
      t('exportPaymentByCard'),
      t('exportPaymentStatus'),
      t('exportCheckedIn'),
      t('exportCreatedAt'),
    ]
    
    // Add custom field headers
    const customHeaders = customFieldDefs.map(field => field.label)
    
    // Add participant count header if multiple participants are enabled
    const participantHeaders = participantSettings?.enabled
      ? [t('exportNumberOfParticipants'), t('exportParticipantNames'), t('exportParticipantEmails')]
      : []
    
    const headers = [...standardHeaders, ...customHeaders, ...participantHeaders]
    
    const rows = filteredRegistrations.map((r) => {
      const acc = getAccommodationDisplay(r, hotelOptions)
      const standardData = [
        currentConference?.name || 'N/A',
        r.firstName,
        r.lastName,
        r.email,
        r.phone,
        r.country || '',
        r.institution || '',
        r.arrivalDate || '',
        r.departureDate || '',
        (() => {
          const display = getAccommodationDisplay(r, hotelOptions)
          if (display.hotelName) return display.hotelName
          if (display.datesFromFormOnly) return t('hotelFormDates')
          if (display.arrivalDate || display.departureDate) return t('hotelDatesOnly')
          return ''
        })(),
        acc.numberOfNights ?? '',
        resolveAddonLabels(r.selectedAddons, registrationAddons).join('; '),
        r.registrationFeeType ?? '',
        r.paymentMethod === 'card' ? 'Card' : r.paymentMethod === 'bank_transfer' ? 'Bank transfer' : '',
        (r.customFields?.payer_type as string) || '',
        (r.customFields?.company_details as { company_name?: string } | null)?.company_name ?? '',
        r.paymentRequired ? 'Yes' : 'No',
        r.paymentByCard ? 'Yes' : 'No',
        r.paymentStatus,
        r.checkedIn ? 'Yes' : 'No',
        new Date(r.createdAt).toLocaleString(),
      ]
      
      // Add custom field values (from first participant's form data, then custom_data e.g. payer/company)
      const customData = customFieldDefs.map(field => {
        const value =
          r.participants?.[0]?.customFields?.[field.name] ?? r.customFields?.[field.name]
        if (value === undefined || value === null) return ''
        if (typeof value === 'boolean') return value ? t('yes') : t('no')
        if (Array.isArray(value)) return value.join(', ')
        if (typeof value === 'object') return JSON.stringify(value)
        const text = String(value)
        return parseRegistrationAttachmentPath(text) ? ATTACHMENT_REFERENCE_LABEL : text
      })
      
      // Add participant data if enabled
      const participantData = participantSettings?.enabled 
        ? [
            (r.participants?.length || 0).toString(),
            r.participants?.map(p => {
              const firstName = p.customFields?.['firstName'] || p.customFields?.['First Name'] || ''
              const lastName = p.customFields?.['lastName'] || p.customFields?.['Last Name'] || ''
              return `${firstName} ${lastName}`.trim()
            }).join('; ') || '',
            r.participants?.map(p => p.customFields?.['email'] || p.customFields?.['Email'] || '').join('; ') || '',
          ]
        : []
      
      return [...standardData, ...customData, ...participantData]
    })
    
    return { headers, rows }
  }

  // Quick export - only basic contact info (First Name, Last Name, Email, Phone)
  const exportBasicContactsCSV = () => {
    const headers = [t('exportFirstName'), t('exportLastName'), t('exportEmail'), t('exportPhone')]
    const rows = filteredRegistrations.map((r) => [
      r.firstName,
      r.lastName,
      r.email,
      r.phone || '',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${currentConference?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
    showSuccess(t('exportContactsSuccess', { count: filteredRegistrations.length }))
  }

  const exportBasicContactsExcel = () => {
    const headers = [t('exportFirstName'), t('exportLastName'), t('exportEmail'), t('exportPhone')]
    const rows = filteredRegistrations.map((r) => [
      r.firstName,
      r.lastName,
      r.email,
      r.phone || '',
    ])

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // First Name
      { wch: 20 }, // Last Name
      { wch: 30 }, // Email
      { wch: 20 }, // Phone
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, t('worksheetContacts'))

    // Generate Excel file
    const fileName = `contacts-${currentConference?.name || 'export'}-${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    setExportMenuOpen(false)
    showSuccess(t('exportContactsSuccess', { count: filteredRegistrations.length }))
  }

  const exportToCSV = () => {
    const { headers, rows } = prepareExportData()
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
  }

  const exportToExcel = () => {
    const { headers, rows } = prepareExportData()
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    
    // Set column widths
    const colWidths = headers.map(() => ({ wch: 20 }))
    ws['!cols'] = colWidths
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations')
    
    // Generate Excel file
    const fileName = `registrations-${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    setExportMenuOpen(false)
  }

  const exportToGoogleSheets = () => {
    const { headers, rows } = prepareExportData()
    
    // Create CSV content optimized for Google Sheets
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    // Show instructions
    showInfo(t('googleSheetsImportInfo'))
    setExportMenuOpen(false)
  }

  // Bulk operations
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRegistrations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredRegistrations.map((r) => r.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkUpdateStatus = async (newStatus: 'paid' | 'pending' | 'not_required') => {
    if (selectedIds.size === 0) return

    try {
      setBulkProcessing(true)
      const response = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          registrationIds: Array.from(selectedIds),
          newStatus,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('updateFailed'))
      }

      showSuccess(t('updateSuccess', { count: result.updated }))
      setSelectedIds(new Set())
      setBulkActionMenuOpen(false)
      loadRegistrations(page)
    } catch (error) {
      showError('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const confirmMessage = `Are you sure you want to delete ${selectedIds.size} registration(s)? This action cannot be undone.`
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setBulkProcessing(true)
      const response = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          registrationIds: Array.from(selectedIds),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('deleteFailed'))
      }

      showSuccess(t('deleteSuccess', { count: result.deleted }))
      setSelectedIds(new Set())
      setBulkActionMenuOpen(false)
      loadRegistrations(page)
    } catch (error) {
      showError(t('errorPrefix') + (error instanceof Error ? error.message : t('unknownError')))
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleConfirmBankPayment = async (reg: Registration, verified: boolean) => {
    const name = `${reg.firstName} ${reg.lastName}`.trim()
    const confirmMessage = verified
      ? t('confirmBankPaymentPrompt', { name })
      : t('undoBankPaymentConfirmationPrompt', { name })

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setConfirmingPaymentId(reg.id)
      const response = await fetch(`/api/admin/registrations/${reg.id}/confirm-bank-payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      })

      const result = await response.json()

      if (!response.ok) {
        const message =
          typeof result?.error === 'string' ? result.error : result?.error?.message
        throw new Error(message || t('bankPaymentUpdateFailed'))
      }

      showSuccess(verified ? t('bankPaymentConfirmed') : t('bankPaymentUndone'))
      loadRegistrations(page)
    } catch (error) {
      showError(error instanceof Error ? error.message : t('bankPaymentUpdateFailed'))
    } finally {
      setConfirmingPaymentId(null)
    }
  }

  const handleBulkSendEmail = async () => {
    if (selectedIds.size === 0) return

    try {
      setBulkProcessing(true)
      const response = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          registrationIds: Array.from(selectedIds),
          emailType: bulkEmailType,
          emailData: bulkEmailData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send emails')
      }

      showSuccess(`Sent ${result.sent} email(s), ${result.failed} failed`)
      if (result.errors && result.errors.length > 0) {
        console.error('Email errors:', result.errors)
      }
      setSelectedIds(new Set())
      setBulkEmailModalOpen(false)
      setBulkActionMenuOpen(false)
    } catch (error) {
      showError(t('errorPrefix') + (error instanceof Error ? error.message : t('unknownError')))
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkExport = () => {
    const selectedRegistrations = filteredRegistrations.filter((r) => selectedIds.has(r.id))
    if (selectedRegistrations.length === 0) return

    const headers = [
      t('exportFirstName'),
      t('exportLastName'),
      t('exportEmail'),
      t('exportPhone'),
      t('exportCountry'),
      t('exportInstitution'),
      t('exportArrivalDate'),
      t('exportDepartureDate'),
      t('exportPaymentRequired'),
      t('exportPaymentByCard'),
      t('exportPaymentStatus'),
      t('exportCreatedAt'),
    ]
    const rows = selectedRegistrations.map((r) => [
      r.firstName,
      r.lastName,
      r.email,
      r.phone,
      r.country || '',
      r.institution || '',
      r.arrivalDate || '',
      r.departureDate || '',
      r.paymentRequired ? t('yes') : t('no'),
      r.paymentByCard ? t('yes') : t('no'),
      r.paymentStatus,
      new Date(r.createdAt).toLocaleString(),
    ])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(wb, ws, t('worksheetSelectedRegistrations'))
    XLSX.writeFile(wb, `selected-registrations-${new Date().toISOString().split('T')[0]}.xlsx`)

    setSelectedIds(new Set())
    setBulkActionMenuOpen(false)
  }

  if (!currentConference && !conferenceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{tDashboard('noConferenceSelected')}</h2>
          <p className="text-gray-600 mb-6">{t('noConference')}</p>
          <Link
            href="/admin/conferences"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            {tConferences('title')}
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{t('title')}</h2>
          <p className="mt-2 text-gray-600">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('export')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {exportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    {/* Quick Export Section - Basic Contacts Only */}
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      {t('quickExportBasic')}
                    </div>
                    <button
                      onClick={exportBasicContactsCSV}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                      <div>
                        <div className="font-medium text-gray-900">{t('contactsCsv')}</div>
                        <div className="text-xs text-gray-500">{t('contactsCsvDesc')}</div>
                      </div>
                    </button>
                    <button
                      onClick={exportBasicContactsExcel}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <div className="font-medium text-gray-900">{t('contactsExcel')}</div>
                        <div className="text-xs text-gray-500">{t('contactsCsvDesc')}</div>
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="my-1 border-t border-gray-200"></div>

                    {/* Full Export Section - All Data */}
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      {t('fullExportAll')}
                    </div>
                    <button
                      onClick={exportToCSV}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t('exportAsCsv')}
                    </button>
                    <button
                      onClick={exportToExcel}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t('exportAsExcel')}
                    </button>
                    <button
                      onClick={exportToGoogleSheets}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t('exportGoogleSheets')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {isSuperAdmin && (
            <a
              href="/api/admin/backup?format=csv"
              download
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('fullBackup')}
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg
                  className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{t('allStatuses')}</option>
              <option value="pending">{t('pendingPayment')}</option>
              <option value="paid">{t('paid')}</option>
              <option value="not_required">{t('notRequired')}</option>
            </select>
            <select
              value={filterAccommodation}
              onChange={(e) => setFilterAccommodation(e.target.value as AccommodationFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{t('filterAccommodationAll')}</option>
              <option value="with_hotel">{t('filterAccommodationWithHotel')}</option>
              <option value="with_dates">{t('filterAccommodationWithDates')}</option>
              <option value="none">{t('filterAccommodationNone')}</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {t('selectedCount', { count: selectedIds.size })}
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t('clearSelection')}
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <button
                  onClick={() => setBulkActionMenuOpen(!bulkActionMenuOpen)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                  disabled={bulkProcessing}
                >
                  {t('bulkActions')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {bulkActionMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setBulkActionMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setBulkEmailModalOpen(true)
                            setBulkActionMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {t('sendEmail')}
                        </button>
                        <div className="border-t border-gray-200 my-1" />
                        <button
                          onClick={() => handleBulkUpdateStatus('paid')}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          disabled={bulkProcessing}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t('markAsPaid')}
                        </button>
                        <button
                          onClick={() => handleBulkUpdateStatus('pending')}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          disabled={bulkProcessing}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t('markAsPending')}
                        </button>
                        <button
                          onClick={() => handleBulkUpdateStatus('not_required')}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          disabled={bulkProcessing}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {t('markAsNotRequired')}
                        </button>
                        <div className="border-t border-gray-200 my-1" />
                        <button
                          onClick={handleBulkExport}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {t('exportSelected')}
                        </button>
                        <div className="border-t border-red-200 my-1" />
                        <button
                          onClick={handleBulkDelete}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          disabled={bulkProcessing}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t('deleteSelected')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredRegistrations.length && filteredRegistrations.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('regNumber')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('details')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('country')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('institution')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('arrival')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('departure')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('hotel')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('payment')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('paymentMethod')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('checkIn')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('qrCode')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-gray-500">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="mt-4 text-sm">{t('noRegistrationsFound')}</p>
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(reg.id)}
                        onChange={() => toggleSelect(reg.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {reg.registration_number || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailRegistration(reg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        title={t('viewDetails')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {t('details')}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {reg.firstName || ''} {reg.lastName || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{reg.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{reg.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{reg.country || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-xs truncate" title={reg.institution || ''}>
                        {reg.institution || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {reg.arrivalDate ? new Date(reg.arrivalDate).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {reg.departureDate ? new Date(reg.departureDate).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const acc = getAccommodationDisplay(reg, hotelOptions)
                        if (acc.hasHotelSelection && acc.hotelName) {
                          return (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{acc.hotelName}</div>
                              {acc.numberOfNights != null && (
                                <div className="text-xs text-gray-500">
                                  {acc.numberOfNights} {t('nights')}
                                </div>
                              )}
                            </div>
                          )
                        }
                        if (acc.arrivalDate || acc.departureDate) {
                          return (
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                              {acc.datesFromFormOnly ? t('hotelFormDates') : t('hotelDatesOnly')}
                            </span>
                          )
                        }
                        return <span className="text-gray-400 text-sm">-</span>
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {reg.paymentRequired ? (
                        <span className="text-blue-600 text-sm">{t('yes')}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">{t('no')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PaymentMethodBadge
                        method={reg.paymentMethod}
                        labels={{
                          card: t('methodCard'),
                          bankTransfer: t('methodBankTransfer'),
                          cash: t('methodCash'),
                          other: t('methodOther'),
                          unknown: t('methodUnknown'),
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PaymentStatusBadge
                        status={reg.paymentStatus || 'pending'}
                        labels={{
                          paid: t('paid'),
                          pending: t('pendingPayment'),
                          notRequired: t('notRequired'),
                        }}
                      />
                      {reg.paymentMethod === 'bank_transfer' && (
                        <div className="mt-1 flex flex-col items-start gap-1">
                          {reg.bank_transfer_proof_url && (
                            <button
                              type="button"
                              onClick={() => {
                                void openRegistrationAttachment(reg.id, reg.bank_transfer_proof_url!).catch((error: unknown) => {
                                  showError(error instanceof Error ? error.message : t('viewProof'))
                                })
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              {t('viewProof')}
                            </button>
                          )}
                          {reg.paymentStatus === 'pending' && (
                            <button
                              onClick={() => handleConfirmBankPayment(reg, true)}
                              disabled={confirmingPaymentId === reg.id}
                              className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
                            >
                              {t('confirmBankPayment')}
                            </button>
                          )}
                          {reg.paymentStatus === 'paid' && reg.bank_transfer_verified && (
                            <button
                              onClick={() => handleConfirmBankPayment(reg, false)}
                              disabled={confirmingPaymentId === reg.id}
                              className="text-xs font-medium text-gray-500 hover:text-red-700 disabled:opacity-50"
                            >
                              {t('undoBankPaymentConfirmation')}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge tone={reg.checkedIn ? 'success' : 'neutral'}>
                        {reg.checkedIn ? t('checkedIn') : t('notCheckedIn')}
                      </StatusBadge>
                      {reg.checkedInAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(reg.checkedInAt).toLocaleString()}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedQRRegistration(reg)
                          setQrModalOpen(true)
                        }}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        title={t('viewQrCode')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        {t('qr')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm text-gray-600">
            {t('showingCount', {
              filtered: filteredRegistrations.length,
              total: totalCount,
            })}
          </p>
          {totalCount > pageSize && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {c('previous')}
              </button>
              <span className="text-sm text-gray-600">
                {c('page')} {page} / {Math.ceil(totalCount / pageSize)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                disabled={page >= Math.ceil(totalCount / pageSize)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {c('next')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Email Modal */}
      {bulkEmailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('sendEmailToCount', { count: selectedIds.size })}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('emailType')}
                </label>
                <select
                  value={bulkEmailType}
                  onChange={(e) =>
                    setBulkEmailType(
                      e.target.value as 'payment_reminder' | 'pre_conference_reminder' | 'event_details'
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="payment_reminder">{t('paymentReminder')}</option>
                  <option value="pre_conference_reminder">{t('preConferenceReminder')}</option>
                  <option value="event_details">{t('eventDetails')}</option>
                </select>
              </div>

              {(bulkEmailType === 'pre_conference_reminder' || bulkEmailType === 'event_details') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('conferenceDate')}
                    </label>
                    <input
                      type="text"
                      value={bulkEmailData.conferenceDate}
                      onChange={(e) =>
                        setBulkEmailData({ ...bulkEmailData, conferenceDate: e.target.value })
                      }
                      placeholder={t('conferenceDatePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('conferenceLocation')}
                    </label>
                    <input
                      type="text"
                      value={bulkEmailData.conferenceLocation}
                      onChange={(e) =>
                        setBulkEmailData({ ...bulkEmailData, conferenceLocation: e.target.value })
                      }
                      placeholder={t('conferenceLocationPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('conferenceProgram')}
                    </label>
                    <textarea
                      value={bulkEmailData.conferenceProgram}
                      onChange={(e) =>
                        setBulkEmailData({ ...bulkEmailData, conferenceProgram: e.target.value })
                      }
                      placeholder={t('conferenceProgramPlaceholder')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('customMessageOptional')}
                </label>
                <textarea
                  value={bulkEmailData.customMessage}
                  onChange={(e) =>
                    setBulkEmailData({ ...bulkEmailData, customMessage: e.target.value })
                  }
                  placeholder={t('customMessagePlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setBulkEmailModalOpen(false)
                  setBulkEmailData({
                    customMessage: '',
                    conferenceDate: '',
                    conferenceLocation: '',
                    conferenceProgram: '',
                  })
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={bulkProcessing}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleBulkSendEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                disabled={bulkProcessing}
              >
                {bulkProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {t('sendEmail')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <RegistrationDetailDrawer
        registration={detailRegistration}
        open={Boolean(detailRegistration)}
        onClose={() => setDetailRegistration(null)}
        hotelOptions={hotelOptions}
        registrationAddons={registrationAddons}
        customFieldDefs={customFieldDefs}
        onShowQr={(reg) => {
          setDetailRegistration(null)
          setSelectedQRRegistration(reg)
          setQrModalOpen(true)
        }}
        onCopyRegNumber={(regNumber) => {
          navigator.clipboard.writeText(regNumber)
          showSuccess(t('regNumberCopied'))
        }}
        onCopyId={(id) => {
          navigator.clipboard.writeText(id)
          showSuccess(t('idCopied'))
        }}
        onConfirmBankPayment={handleConfirmBankPayment}
        confirmingPaymentId={confirmingPaymentId}
      />

      {/* QR Code Modal */}
      {qrModalOpen && selectedQRRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">QR Code</h3>
              <button
                onClick={() => {
                  setQrModalOpen(false)
                  setSelectedQRRegistration(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6 text-center">
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-900">
                  {selectedQRRegistration.firstName} {selectedQRRegistration.lastName}
                </p>
                <p className="text-sm text-gray-500">{selectedQRRegistration.email}</p>
              </div>
              <div className="flex justify-center mb-4 p-4 bg-gray-50 rounded-lg">
                <QRCodeSVG
                  value={selectedQRRegistration.id}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {t('registrationId')} {selectedQRRegistration.id}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedQRRegistration.id)
                    showSuccess(t('idCopied'))
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  {t('copyId')}
                </button>
                <button
                  onClick={() => {
                    setQrModalOpen(false)
                    setSelectedQRRegistration(null)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Wrapper with Suspense boundary (keep fallback short — h-screen inside flex layout
// can crush the admin Header and look like a blank page)
export default function RegistrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <RegistrationsPageContent />
    </Suspense>
  )
}