'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { showSuccess, showError } from '@/utils/toast'
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  Users,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  Search,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Star,
  Info,
  Send,
  DollarSign,
  CreditCard,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { SubscriptionPlan } from '@/types/subscription'

interface ContactInquiry {
  id: string
  name: string
  email: string
  organization: string
  phone: string | null
  conference_type: string | null
  expected_attendees: string | null
  message: string
  status: string
  priority: string
  assigned_to: string | null
  notes: string | null
  follow_up_date: string | null
  converted: boolean
  converted_to_conference_id: string | null
  source: string
  created_at: string
  updated_at: string
  contacted_at: string | null
  converted_at: string | null
}

interface InquiryStats {
  total_inquiries: number
  new_inquiries: number
  contacted_inquiries: number
  qualified_inquiries: number
  converted_inquiries: number
  inquiries_last_7_days: number
  inquiries_last_30_days: number
  virtual_conference_requests: number
  hybrid_conference_requests: number
  onsite_conference_requests: number
  avg_response_time_hours: number
  conversion_rate_percent: number
}

export default function InquiriesPage() {
  const t = useTranslations('admin.inquiries')
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([])
  const [stats, setStats] = useState<InquiryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateData, setUpdateData] = useState({
    status: '',
    priority: '',
    notes: '',
    follow_up_date: '',
  })
  const [processing, setProcessing] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  
  // Payment offer state
  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [offerData, setOfferData] = useState({
    planId: '',
    billingCycle: 'yearly' as 'monthly' | 'yearly',
    customPrice: '',
    discountPercent: 0,
  })
  const [sendingOffer, setSendingOffer] = useState(false)
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    loadInquiries()
    loadStats()
    loadSubscriptionPlans()
    checkStripeConfiguration()
  }, [])

  const checkStripeConfiguration = async () => {
    // Check if Stripe is configured by trying to fetch subscription plans
    // If Stripe is not configured, the API will return an error
    try {
      const response = await fetch('/api/admin/payment-offers?inquiryId=test', {
        method: 'GET',
      })
      // If we get a 503, Stripe is not configured
      setStripeConfigured(response.status !== 503)
    } catch (error) {
      // Assume not configured if check fails
      setStripeConfigured(false)
    }
  }

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.export-dropdown')) {
        setExportMenuOpen(false)
      }
    }
    
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [exportMenuOpen])

  const loadInquiries = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contact_inquiries')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInquiries(data || [])
    } catch (error) {
      console.error('Error loading inquiries:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_inquiry_stats')
        .select('*')
        .single()

      if (error) throw error
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadSubscriptionPlans = async () => {
    try {
      const response = await fetch('/api/admin/subscription-plans')
      const data = await response.json()

      if (response.ok) {
        setSubscriptionPlans(data.plans || [])
      }
    } catch (error) {
      console.error('Error loading subscription plans:', error)
    }
  }

  const handleOpenDetails = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry)
    setDetailsModalOpen(true)
  }

  const handleOpenOffer = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry)
    setOfferData({
      planId: subscriptionPlans[0]?.id || '',
      billingCycle: 'yearly',
      customPrice: '',
      discountPercent: 0,
    })
    setOfferModalOpen(true)
  }

  const handleSendOffer = async () => {
    if (!selectedInquiry || !offerData.planId) {
      showError(t('selectSubscriptionPlan'))
      return
    }

    setSendingOffer(true)

    try {
      const response = await fetch('/api/admin/payment-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: selectedInquiry.id,
          planId: offerData.planId,
          billingCycle: offerData.billingCycle,
          customPrice: offerData.customPrice ? parseFloat(offerData.customPrice) : undefined,
          discountPercent: offerData.discountPercent,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess(t('paymentOfferSentSuccess'))
        setOfferModalOpen(false)
        await loadInquiries()

        // Copy payment link to clipboard
        if (data.paymentLinkUrl) {
          navigator.clipboard.writeText(data.paymentLinkUrl)
          showSuccess(t('paymentLinkCopied'))
        }
      } else {
        const errorMsg = data.error || t('failedToSendOffer')
        showError(errorMsg)
        
        // If Stripe is not configured, update state
        if (response.status === 503 && errorMsg.includes('not yet configured')) {
          setStripeConfigured(false)
        }
      }
    } catch (error) {
      console.error('Error sending payment offer:', error)
      showError('An error occurred while sending the payment offer')
    } finally {
      setSendingOffer(false)
    }
  }

  const handleOpenUpdate = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry)
    setUpdateData({
      status: inquiry.status,
      priority: inquiry.priority,
      notes: inquiry.notes || '',
      follow_up_date: inquiry.follow_up_date?.split('T')[0] || '',
    })
    setUpdateModalOpen(true)
  }

  const handleUpdateInquiry = async () => {
    if (!selectedInquiry) return

    try {
      setProcessing(true)
      const updates: any = {
        status: updateData.status,
        priority: updateData.priority,
        notes: updateData.notes || null,
        follow_up_date: updateData.follow_up_date || null,
      }

      // If status changed to 'contacted', set contacted_at
      if (updateData.status === 'contacted' && selectedInquiry.status !== 'contacted') {
        updates.contacted_at = new Date().toISOString()
      }

      // If status changed to 'converted', set converted flags
      if (updateData.status === 'converted' && !selectedInquiry.converted) {
        updates.converted = true
        updates.converted_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('contact_inquiries')
        .update(updates)
        .eq('id', selectedInquiry.id)

      if (error) throw error

      await loadInquiries()
      await loadStats()
      setUpdateModalOpen(false)
      setSelectedInquiry(null)
    } catch (error) {
      console.error('Error updating inquiry:', error)
      showError(t('failedToUpdateInquiry'))
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteInquiry = async (inquiry: ContactInquiry) => {
    if (!confirm(t('deleteConfirm', { name: inquiry.name }))) return

    try {
      setProcessing(true)

      // Deleting an inquiry cascades to its payment offers. Keep those records.
      const { count: offerCount, error: offerError } = await supabase
        .from('payment_offers')
        .select('id', { count: 'exact', head: true })
        .eq('inquiry_id', inquiry.id)

      if (offerError) throw offerError
      if ((offerCount ?? 0) > 0) {
        showError(t('cannotDeleteInquiryWithOffers'))
        return
      }

      const { data: deleted, error } = await supabase
        .from('contact_inquiries')
        .delete()
        .eq('id', inquiry.id)
        .select('id')

      if (error) throw error
      // RLS can silently match zero rows; do not report success then.
      if (!deleted || deleted.length === 0) {
        throw new Error('Inquiry was not deleted')
      }

      if (selectedInquiry?.id === inquiry.id) {
        setDetailsModalOpen(false)
        setUpdateModalOpen(false)
        setOfferModalOpen(false)
        setSelectedInquiry(null)
      }

      await loadInquiries()
      await loadStats()
      showSuccess(t('inquiryDeleted'))
    } catch (error) {
      console.error('Error deleting inquiry:', error)
      showError(t('failedToDeleteInquiry'))
    } finally {
      setProcessing(false)
    }
  }

  const prepareExportData = () => {
    return filteredInquiries.map((inquiry) => ({
      'Date': new Date(inquiry.created_at).toLocaleDateString(),
      'Time': new Date(inquiry.created_at).toLocaleTimeString(),
      'Name': inquiry.name,
      'Email': inquiry.email,
      'Organization': inquiry.organization,
      'Phone': inquiry.phone || '',
      'Conference Type': formatConferenceType(inquiry.conference_type),
      'Expected Attendees': inquiry.expected_attendees || '',
      'Message': inquiry.message,
      'Status': inquiry.status.replace('_', ' ').toUpperCase(),
      'Priority': inquiry.priority.toUpperCase(),
      'Converted': inquiry.converted ? 'Yes' : 'No',
      'Notes': inquiry.notes || '',
    }))
  }

  const exportToExcel = () => {
    const exportData = prepareExportData()
    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // Set column widths
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 25 }, // Organization
      { wch: 15 }, // Phone
      { wch: 18 }, // Conference Type
      { wch: 18 }, // Expected Attendees
      { wch: 40 }, // Message
      { wch: 15 }, // Status
      { wch: 10 }, // Priority
      { wch: 10 }, // Converted
      { wch: 30 }, // Notes
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiries')
    XLSX.writeFile(wb, `inquiries_${new Date().toISOString().split('T')[0]}.xlsx`)
    setExportMenuOpen(false)
  }

  const exportToCSV = () => {
    const exportData = prepareExportData()
    const ws = XLSX.utils.json_to_sheet(exportData)
    const csv = XLSX.utils.sheet_to_csv(ws)
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `inquiries_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setExportMenuOpen(false)
  }

  const exportToJSON = () => {
    const exportData = filteredInquiries.map((inquiry) => ({
      id: inquiry.id,
      date: inquiry.created_at,
      name: inquiry.name,
      email: inquiry.email,
      organization: inquiry.organization,
      phone: inquiry.phone,
      conferenceType: inquiry.conference_type,
      expectedAttendees: inquiry.expected_attendees,
      message: inquiry.message,
      status: inquiry.status,
      priority: inquiry.priority,
      converted: inquiry.converted,
      notes: inquiry.notes,
      followUpDate: inquiry.follow_up_date,
      contactedAt: inquiry.contacted_at,
      convertedAt: inquiry.converted_at,
    }))

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `inquiries_${new Date().toISOString().split('T')[0]}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setExportMenuOpen(false)
  }

  const copyToClipboard = async () => {
    const exportData = prepareExportData()
    
    // Create tab-separated values for easy paste into spreadsheets
    const headers = Object.keys(exportData[0]).join('\t')
    const rows = exportData.map(row => Object.values(row).join('\t')).join('\n')
    const tsvData = `${headers}\n${rows}`

    try {
      await navigator.clipboard.writeText(tsvData)
        showSuccess('✅ Data copied to clipboard! You can now paste it into Google Sheets or Excel.')
      setExportMenuOpen(false)
    } catch (error) {
      console.error('Failed to copy:', error)
        showSuccess('❌ Failed to copy to clipboard. Please try another export method.')
    }
  }

  const filteredInquiries = inquiries.filter((inquiry) => {
    const matchesSearch =
      searchTerm === '' ||
      inquiry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.organization.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === 'all' || inquiry.status === filterStatus
    const matchesPriority = filterPriority === 'all' || inquiry.priority === filterPriority

    return matchesSearch && matchesStatus && matchesPriority
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Clock className="w-4 h-4" />
      case 'contacted':
        return <Mail className="w-4 h-4" />
      case 'qualified':
        return <CheckCircle className="w-4 h-4" />
      case 'converted':
        return <Star className="w-4 h-4" />
      case 'rejected':
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'qualified':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'converted':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    const key = status === 'proposal_sent' ? 'proposalSent' : status === 'negotiating' ? 'negotiating' : status
    const keys = ['new', 'contacted', 'qualified', 'proposalSent', 'negotiating', 'converted', 'rejected']
    return keys.includes(key) ? t(key as 'new' | 'contacted' | 'qualified' | 'proposalSent' | 'negotiating' | 'converted' | 'rejected') : status
  }

  const getPriorityLabel = (priority: string) => {
    const keys = ['urgent', 'high', 'medium', 'low']
    return keys.includes(priority) ? t(priority as 'urgent' | 'high' | 'medium' | 'low') : priority
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
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">{t('title')}</h2>
        <p className="mt-2 text-gray-600">{t('subtitle')}</p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Inquiries</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_inquiries}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              {stats.inquiries_last_7_days} in last 7 days
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Inquiries</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.new_inquiries}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Awaiting response</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {stats.conversion_rate_percent || 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              {stats.converted_inquiries} converted
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {stats.avg_response_time_hours?.toFixed(1) || 0}h
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Average response</p>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('allStatus')}</option>
            <option value="new">{t('new')}</option>
            <option value="contacted">{t('contacted')}</option>
            <option value="qualified">{t('qualified')}</option>
            <option value="proposal_sent">{t('proposalSent')}</option>
            <option value="negotiating">{t('negotiating')}</option>
            <option value="converted">{t('converted')}</option>
            <option value="rejected">{t('rejected')}</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('allPriority')}</option>
            <option value="urgent">{t('urgent')}</option>
            <option value="high">{t('high')}</option>
            <option value="medium">{t('medium')}</option>
            <option value="low">{t('low')}</option>
          </select>

          {/* Export Dropdown */}
          <div className="relative export-dropdown">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {t('export')}
              <ChevronDown className="w-4 h-4" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                <button
                  onClick={exportToExcel}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t('exportExcel')}</p>
                    <p className="text-xs text-gray-500">{t('exportExcelDesc')}</p>
                  </div>
                </button>

                <button
                  onClick={exportToCSV}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t('exportCsv')}</p>
                    <p className="text-xs text-gray-500">{t('exportCsvDesc')}</p>
                  </div>
                </button>

                <button
                  onClick={exportToJSON}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t('exportJson')}</p>
                    <p className="text-xs text-gray-500">{t('exportJsonDesc')}</p>
                  </div>
                </button>

                <button
                  onClick={copyToClipboard}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t('copyToClipboard')}</p>
                    <p className="text-xs text-gray-500">{t('copyToClipboardDesc')}</p>
                  </div>
                </button>

                <div className="border-t border-gray-200 mt-2 pt-2 px-4 py-2">
                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    <Info className="w-3 h-3" />
                    {t('exportCount', { count: filteredInquiries.length })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('contact')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('organization')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('details')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('priority')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {t('noInquiriesFound')}
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{inquiry.name}</p>
                        <p className="text-sm text-gray-500">{inquiry.email}</p>
                        {inquiry.phone && (
                          <p className="text-sm text-gray-500">{inquiry.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{inquiry.organization}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {inquiry.conference_type && (
                          <p>{formatConferenceType(inquiry.conference_type)}</p>
                        )}
                        {inquiry.expected_attendees && (
                          <p>{inquiry.expected_attendees}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          inquiry.status
                        )}`}
                      >
                        {getStatusIcon(inquiry.status)}
                        {getStatusLabel(inquiry.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(
                          inquiry.priority
                        )}`}
                      >
                        {getPriorityLabel(inquiry.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenDetails(inquiry)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          {t('view')}
                        </button>
                        <button
                          onClick={() => handleOpenUpdate(inquiry)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          {t('update')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInquiry(inquiry)}
                          disabled={processing}
                          className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {detailsModalOpen && selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">{t('inquiryDetails')}</h3>
                <button
                  onClick={() => setDetailsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('name')}</label>
                <p className="text-gray-900">{selectedInquiry.name}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('email')}</label>
                <a
                  href={`mailto:${selectedInquiry.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {selectedInquiry.email}
                </a>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('organization')}
                </label>
                <p className="text-gray-900">{selectedInquiry.organization}</p>
              </div>
              {selectedInquiry.phone && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('phone')}</label>
                  <a
                    href={`tel:${selectedInquiry.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {selectedInquiry.phone}
                  </a>
                </div>
              )}
              {selectedInquiry.conference_type && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {t('conferenceType')}
                  </label>
                  <p className="text-gray-900">
                    {formatConferenceType(selectedInquiry.conference_type)}
                  </p>
                </div>
              )}
              {selectedInquiry.expected_attendees && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {t('expectedAttendees')}
                  </label>
                  <p className="text-gray-900">{selectedInquiry.expected_attendees}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('message')}</label>
                <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                  {selectedInquiry.message}
                </p>
              </div>
              {selectedInquiry.notes && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {t('internalNotes')}
                  </label>
                  <p className="text-gray-900 whitespace-pre-wrap bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    {selectedInquiry.notes}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                      selectedInquiry.status
                    )}`}
                  >
                    {getStatusIcon(selectedInquiry.status)}
                    {getStatusLabel(selectedInquiry.status)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Priority
                  </label>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(
                      selectedInquiry.priority
                    )}`}
                  >
                    {getPriorityLabel(selectedInquiry.priority)}
                  </span>
                </div>
              </div>
              <div>
<label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('submitted')}
                </label>
                <p className="text-gray-900">
                  {new Date(selectedInquiry.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-between gap-3">
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('close')}
              </button>
              <div className="flex gap-3">
                {selectedInquiry.status !== 'converted' && stripeConfigured !== false && (
                  <button
                    onClick={() => {
                      setDetailsModalOpen(false)
                      handleOpenOffer(selectedInquiry)
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-medium"
                    title={stripeConfigured === null ? 'Checking Stripe configuration...' : undefined}
                    disabled={stripeConfigured === null}
                  >
                    <CreditCard className="w-4 h-4" />
                    {t('sendPaymentOffer')}
                  </button>
                )}
                {selectedInquiry.status !== 'converted' && stripeConfigured === false && (
                  <div className="inline-flex items-center gap-2 px-6 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed font-medium" title="Stripe payment processing is not yet configured">
                    <CreditCard className="w-4 h-4" />
                    {t('sendPaymentOffer')}
                    <span className="text-xs">(Stripe not configured)</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setDetailsModalOpen(false)
                    handleOpenUpdate(selectedInquiry)
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {t('updateStatus')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {updateModalOpen && selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Update Inquiry</h3>
                <button
                  onClick={() => setUpdateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('status')}</label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">{t('new')}</option>
                  <option value="contacted">{t('contacted')}</option>
                  <option value="qualified">{t('qualified')}</option>
                  <option value="proposal_sent">{t('proposalSent')}</option>
                  <option value="negotiating">{t('negotiating')}</option>
                  <option value="converted">{t('converted')}</option>
                  <option value="rejected">{t('rejected')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('priority')}</label>
                <select
                  value={updateData.priority}
                  onChange={(e) => setUpdateData({ ...updateData, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">{t('low')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="high">{t('high')}</option>
                  <option value="urgent">{t('urgent')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('followUpDate')}
                </label>
                <input
                  type="date"
                  value={updateData.follow_up_date}
                  onChange={(e) =>
                    setUpdateData({ ...updateData, follow_up_date: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Internal Notes
                </label>
                <textarea
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('internalNotesPlaceholder')}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setUpdateModalOpen(false)}
                disabled={processing}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateInquiry}
                disabled={processing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Update Inquiry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Offer Modal */}
      {offerModalOpen && selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{t('sendPaymentOffer')}</h3>
                  <p className="text-gray-600 mt-1">
                    Create and send a payment link to {selectedInquiry.name}
                  </p>
                </div>
                <button
                  onClick={() => setOfferModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold">{selectedInquiry.organization}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">{selectedInquiry.email}</span>
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subscription Plan *
                </label>
                <select
                  value={offerData.planId}
                  onChange={(e) => setOfferData({ ...offerData, planId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a plan...</option>
                  {subscriptionPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - €{offerData.billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly}
                      {offerData.billingCycle === 'monthly' ? '/month' : '/year'}
                    </option>
                  ))}
                </select>
                {offerData.planId && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg">
                    {(() => {
                      const selectedPlan = subscriptionPlans.find(p => p.id === offerData.planId)
                      return selectedPlan ? (
                        <>
                          <h4 className="font-semibold text-gray-900 mb-2">{selectedPlan.name} Features:</h4>
                          <ul className="space-y-1 text-sm text-gray-700">
                            {selectedPlan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null
                    })()}
                  </div>
                )}
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Billing Cycle *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setOfferData({ ...offerData, billingCycle: 'monthly' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      offerData.billingCycle === 'monthly'
                        ? 'border-green-600 bg-green-50 text-green-900'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold">Monthly</div>
                    <div className="text-sm text-gray-600 mt-1">Billed every month</div>
                  </button>
                  <button
                    onClick={() => setOfferData({ ...offerData, billingCycle: 'yearly' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      offerData.billingCycle === 'yearly'
                        ? 'border-green-600 bg-green-50 text-green-900'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold">Yearly</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Save up to 17%
                      <span className="ml-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                        Best Value
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom Price (optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Custom Price (Optional)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={offerData.customPrice}
                    onChange={(e) => setOfferData({ ...offerData, customPrice: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder={`Default: ${subscriptionPlans.find(p => p.id === offerData.planId)?.[offerData.billingCycle === 'monthly' ? 'price_monthly' : 'price_yearly'] || 0}`}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Leave empty to use the default plan price
                </p>
              </div>

              {/* Discount Percentage */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discount % (Optional)
                </label>
                <input
                  type="number"
                  value={offerData.discountPercent}
                  onChange={(e) => setOfferData({ ...offerData, discountPercent: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Applied on top of custom price if set
                </p>
              </div>

              {/* Price Summary */}
              {offerData.planId && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Price Summary</h4>
                  {(() => {
                    const selectedPlan = subscriptionPlans.find(p => p.id === offerData.planId)
                    if (!selectedPlan) return null
                    const basePrice = offerData.billingCycle === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly
                    const price = parseFloat(offerData.customPrice) || basePrice
                    const discount = (price * offerData.discountPercent) / 100
                    const finalPrice = price - discount
                    return (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Base Price:</span>
                          <span className={offerData.customPrice ? 'line-through text-gray-500' : 'font-semibold'}>
                            €{basePrice.toFixed(2)}
                          </span>
                        </div>
                        {offerData.customPrice && (
                          <div className="flex justify-between">
                            <span>Custom Price:</span>
                            <span className="font-semibold">€{price.toFixed(2)}</span>
                          </div>
                        )}
                        {offerData.discountPercent > 0 && (
                          <div className="flex justify-between text-green-700">
                            <span>Discount ({offerData.discountPercent}%):</span>
                            <span>-€{discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold text-green-800 pt-2 border-t border-green-200">
                          <span>Final Price:</span>
                          <span>€{finalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setOfferModalOpen(false)}
                disabled={sendingOffer}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendOffer}
                disabled={sendingOffer || !offerData.planId}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {sendingOffer ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Generating Link...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Generate & Send Offer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatConferenceType(type: string | null): string {
  if (!type) return ''
  const types: Record<string, string> = {
    virtual: 'Virtual Conference',
    hybrid: 'Hybrid Conference',
    onsite: 'On-site Conference',
    other: 'Other',
  }
  return types[type] || type
}

