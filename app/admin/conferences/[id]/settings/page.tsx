'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useConference } from '@/contexts/ConferenceContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Plus, X, GripVertical, Ticket, ChevronDown, ChevronRight, Trash2, Eye, EyeOff, Globe, Upload } from 'lucide-react'
import type {
  HotelOption,
  PaymentSettings,
  RoomType,
  RegistrationAddon,
} from '@/types/conference'
import Link from 'next/link'
import Image from 'next/image'
import type {
  AbstractSubmissionMethod,
  AbstractTemplate,
  Conference,
  CustomRegistrationField,
} from '@/types/conference'
import { showSuccess, showError, showWarning } from '@/utils/toast'
import { ABSTRACT_TEMPLATE_ACCEPT, validateAbstractTemplateFile } from '@/lib/abstract-file'
import {
  getCoveredAbstractCustomFields,
  removeCoveredAbstractCustomFields,
} from '@/lib/abstract-custom-fields'
import CollapsibleFieldEditor from '@/components/admin/CollapsibleFieldEditor'
import RegistrationAddonsSection from '@/components/admin/RegistrationAddonsSection'
import type { ParticipantSettings } from '@/types/conference'
import { DEFAULT_PARTICIPANT_SETTINGS } from '@/types/participant'
import { DEFAULT_PAYMENT_SETTINGS } from '@/constants/defaultPaymentSettings'
import { formatPriceWithoutZeros } from '@/utils/pricing'
import {
  BasicInfoSection,
  BrandingSection,
  CustomRegistrationFeesSection,
  PaymentSettingsSection,
  EmailSettingsSection,
  PublishingSection,
  GeneralSettingsSection,
  InfoTextSection,
  type ConferenceFormData,
  type OnFormDataChange,
} from './_components'

export default function ConferenceSettingsPage() {
  const t = useTranslations('admin.conferences')
  const tCommon = useTranslations('admin.common')
  const router = useRouter()
  const params = useParams()
  const { refreshConferences } = useConference()
  const { isSuperAdmin, isImpersonating, profile } = useAuth()
  const conferenceId = params.id as string
  const fullConferenceAccess = isSuperAdmin && !isImpersonating
  const [adminScope, setAdminScope] = useState<{ edit: boolean; abstracts: boolean } | null>(null)

  const [conference, setConference] = useState<Conference | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [participantSettings, setParticipantSettings] = useState<ParticipantSettings>(DEFAULT_PARTICIPANT_SETTINGS)
  const [registrationInfoText, setRegistrationInfoText] = useState<string>('')
  const [abstractInfoText, setAbstractInfoText] = useState<string>('')
  const [abstractTemplate, setAbstractTemplate] = useState<AbstractTemplate | null>(null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [showParticipantSettings, setShowParticipantSettings] = useState(false)
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null)
  const [expandedAbstractFieldId, setExpandedAbstractFieldId] = useState<string | null>(null)
  const [draggedAbstractFieldIndex, setDraggedAbstractFieldIndex] = useState<number | null>(null)
  const [hotelOptions, setHotelOptions] = useState<HotelOption[]>([])
  const [registrationAddons, setRegistrationAddons] = useState<RegistrationAddon[]>([])
  const [draggedHotelIndex, setDraggedHotelIndex] = useState<number | null>(null)
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS)
  const [conferenceTickets, setConferenceTickets] = useState<{ id: string; subject: string; status: string; description?: string | null }[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [hotelUsage, setHotelUsage] = useState<Record<string, number>>({})
  const [loadingHotelUsage, setLoadingHotelUsage] = useState(false)
  const [creatingTicketForHotel, setCreatingTicketForHotel] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    venue: '',
    website_url: '',
    logo_url: '' as string | undefined,
    primary_color: '#3B82F6',
    // Pricing (currency + VAT only; fees are in custom_registration_fees table)
    currency: 'EUR',
    vat_percentage: '' as string | number,
    prices_include_vat: false,
    // Settings
    registration_enabled: true,
    abstract_submission_enabled: true,
    abstract_submission_deadline: '',
    abstract_submission_method: 'online_form' as AbstractSubmissionMethod,
    payment_required: true,
    max_registrations: '',
    timezone: 'Europe/Zagreb',
    custom_registration_fields: [] as CustomRegistrationField[],
    custom_abstract_fields: [] as CustomRegistrationField[],
    // Email
    from_email: '',
    from_name: '',
    reply_to: '',
    // Status
    published: false,
    active: true,
  })

  useEffect(() => {
    loadConference()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenceId])

  const loadConferenceTickets = useCallback(async () => {
    if (!conferenceId) return
    setLoadingTickets(true)
    try {
      const res = await fetch(`/api/admin/tickets?conference_id=${conferenceId}`)
      const data = await res.json()
      if (res.ok && data.tickets) {
        setConferenceTickets(
          data.tickets.map((t: { id: string; subject: string; status: string; description?: string | null }) => ({
            id: t.id,
            subject: t.subject,
            status: t.status,
            description: t.description ?? null,
          }))
        )
      } else {
        setConferenceTickets([])
      }
    } catch {
      setConferenceTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }, [conferenceId])

  const loadHotelUsage = useCallback(async () => {
    if (!conferenceId) return
    setLoadingHotelUsage(true)
    try {
      const res = await fetch(`/api/admin/conferences/${conferenceId}/hotel-usage`)
      const data = await res.json()
      if (res.ok && data.usage) {
        setHotelUsage(data.usage)
      } else {
        setHotelUsage({})
      }
    } catch {
      setHotelUsage({})
    } finally {
      setLoadingHotelUsage(false)
    }
  }, [conferenceId])

  useEffect(() => {
    loadConferenceTickets()
  }, [loadConferenceTickets])

  useEffect(() => {
    loadHotelUsage()
  }, [loadHotelUsage])

  const hasTicketForHotel = (hotelId: string) =>
    conferenceTickets.some(
      (t) => t.description && t.description.includes(`Hotel ID: ${hotelId}`)
    )

  const handleCreateTicketForHotel = async (hotelId: string, hotelName: string) => {
    if (!conferenceId) return
    setCreatingTicketForHotel(hotelId)
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create_for_hotel_full: true,
          conference_id: conferenceId,
          hotel_id: hotelId,
          hotel_name: hotelName,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ticket) {
        setConferenceTickets((prev) => [
          ...prev,
          {
            id: data.ticket.id,
            subject: data.ticket.subject,
            status: data.ticket.status,
            description: data.ticket.description ?? null,
          },
        ])
        showSuccess(data.created ? t('ticketCreated') : t('ticketAlreadyExists'))
      } else {
        showError(data.error || t('errorCreatingTicket'))
      }
    } catch {
      showError(t('errorCreatingTicket'))
    } finally {
      setCreatingTicketForHotel(null)
    }
  }

  const canEditConference = fullConferenceAccess || adminScope?.edit === true
  const canManageAbstracts = fullConferenceAccess || adminScope?.abstracts === true

  useEffect(() => {
    if (fullConferenceAccess) {
      setAdminScope({ edit: true, abstracts: true })
      return
    }
    if (!profile?.id || !conferenceId) return

    let cancelled = false
    supabase
      .from('conference_permissions')
      .select('can_edit_conference, can_manage_abstracts')
      .eq('user_id', profile.id)
      .eq('conference_id', conferenceId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setAdminScope({
          edit: !error && data?.can_edit_conference === true,
          abstracts: !error && data?.can_manage_abstracts === true,
        })
      })

    return () => {
      cancelled = true
    }
  }, [fullConferenceAccess, profile?.id, conferenceId])

  const loadConference = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/conferences/${conferenceId}`)
      const data = await response.json()

      if (response.ok && data.conference) {
        const conf = data.conference
        setConference(conf)
        
        setFormData({
          name: conf.name || '',
          description: conf.description || '',
          start_date: conf.start_date || '',
          end_date: conf.end_date || '',
          location: conf.location || '',
          venue: conf.venue || '',
          website_url: conf.website_url || '',
          logo_url: conf.logo_url || '',
          primary_color: conf.primary_color || '#3B82F6',
          // Pricing (currency + single PDV %; default 25 e.g. Croatia)
          currency: conf.pricing?.currency || 'EUR',
          vat_percentage:
            conf.pricing?.vat_percentage != null && conf.pricing?.vat_percentage !== ''
              ? conf.pricing.vat_percentage
              : (profile?.default_vat_percentage ?? 25),
          prices_include_vat: !!conf.pricing?.prices_include_vat,
          // Settings
          registration_enabled: conf.settings?.registration_enabled ?? true,
          abstract_submission_enabled: conf.settings?.abstract_submission_enabled ?? true,
          abstract_submission_deadline:
            conf.settings?.abstract_submission_deadline?.slice(0, 10) || '',
          abstract_submission_method: conf.settings?.abstract_submission_method ?? 'online_form',
          payment_required: conf.settings?.payment_required ?? true,
          max_registrations: conf.settings?.max_registrations?.toString() || '',
          timezone: conf.settings?.timezone || 'Europe/Zagreb',
          custom_registration_fields: conf.settings?.custom_registration_fields || [],
          custom_abstract_fields: conf.settings?.custom_abstract_fields || [],
          // Email
          from_email: conf.email_settings?.from_email || '',
          from_name: conf.email_settings?.from_name || '',
          reply_to: conf.email_settings?.reply_to || '',
          // Status
          published: conf.published || false,
          active: conf.active ?? true,
        })
        
        // Load participant settings, payment settings, custom fee types, and info texts
        setParticipantSettings(conf.settings?.participant_settings || DEFAULT_PARTICIPANT_SETTINGS)
        setPaymentSettings({
          ...(conf.settings?.payment_settings || DEFAULT_PAYMENT_SETTINGS),
          allow_card: false,
          allow_bank_transfer: true,
          default_preference: 'pay_now_bank',
        })
        setRegistrationInfoText(conf.settings?.registration_info_text || '')
        setAbstractTemplate(conf.settings?.abstract_template ?? null)
        setAbstractInfoText(conf.settings?.abstract_info_text || `Guidelines:

The abstract should be written in English
The abstract should not exceed 2000 characters
Indicate the topic and type of your presentation
The abstract should include the title, names of all contributors (without titles), department, institution, city, and country.
Names of author and co-authors have to be submitted in the following way: First and Last name (example:  John Smith)
Contact author (presenter) should submit his/her phone number and Email address
The submitted abstract should cover the following: the goal, material and methods, results, and conclusion
Abstract should be submitted as one paragraph
Do NOT include references in the abstract text. Tables and graphics are not allowed.
Corrections - Withdrawal and Editing an abstract already submitted

Changes, withdrawals, and editing can be made until March 22, 2026, 24.00 hrs CET, by sending the new summary by mail.
The Abstract has to be related to one of the conference topics.

Important: Authors who submit abstracts for presentation are not automatically registered for the meeting.`)
        setShowParticipantSettings(conf.settings?.participant_settings?.enabled || false)
        setHotelOptions(conf.settings?.hotel_options || [])
        setRegistrationAddons(conf.settings?.registration_addons || [])
      }
    } catch (error) {
      console.error('Failed to load conference:', error)
    } finally {
      setLoading(false)
    }
  }

  // Callback for components to update formData
  const handleFormDataChange: OnFormDataChange = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  // Room type – oznake za UI (prevedeno)
  const ROOM_TYPE_LABELS: Record<RoomType, string> = {
    single: t('roomTypeSingle'),
    double: t('roomTypeDouble'),
    twin: t('roomTypeTwin'),
    suite: t('roomTypeSuite'),
    other: t('roomTypeOther'),
  }

  // Hotel Options Management
  const addHotelOption = () => {
    const newHotel: HotelOption = {
      id: `hotel_${Date.now()}`,
      name: '',
      occupancy: '1 person',
      pricePerNight: 0,
      description: '',
      order: hotelOptions.length,
      room_type: undefined,
    }
    setHotelOptions([...hotelOptions, newHotel])
  }

  const removeHotelOption = (id: string) => {
    setHotelOptions(hotelOptions.filter((hotel) => hotel.id !== id))
  }

  const updateHotelOption = (id: string, updates: Partial<HotelOption>) => {
    setHotelOptions(hotelOptions.map((hotel) =>
      hotel.id === id ? { ...hotel, ...updates } : hotel
    ))
  }

  const handleHotelDragStart = (index: number) => {
    setDraggedHotelIndex(index)
  }

  const handleHotelDrop = (targetIndex: number) => {
    if (draggedHotelIndex === null) return

    const newHotels = [...hotelOptions]
    const draggedHotel = newHotels[draggedHotelIndex]
    newHotels.splice(draggedHotelIndex, 1)
    newHotels.splice(targetIndex, 0, draggedHotel)

    // Update order numbers
    const updatedHotels = newHotels.map((hotel, idx) => ({
      ...hotel,
      order: idx,
    }))

    setHotelOptions(updatedHotels)
    setDraggedHotelIndex(null)
  }

  // Custom Registration Fields Management
  const addCustomRegistrationField = () => {
    const newField: CustomRegistrationField = {
      id: `reg_field_${Date.now()}`,
      name: '',
      type: 'text', // Default to text field
      label: '',
      placeholder: '',
      description: '',
      required: false,
      options: undefined,
    }
    setFormData((prev) => ({
      ...prev,
      custom_registration_fields: [...prev.custom_registration_fields, newField],
    }))
    // Automatically expand the newly added field
    setExpandedFieldId(newField.id)
  }

  const removeCustomRegistrationField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      custom_registration_fields: prev.custom_registration_fields.filter((field) => field.id !== id),
    }))
  }

  const updateCustomRegistrationField = (id: string, field: Partial<CustomRegistrationField>) => {
    setFormData((prev) => ({
      ...prev,
      custom_registration_fields: prev.custom_registration_fields.map((f) =>
        f.id === id ? { ...f, ...field } : f
      ),
    }))
  }

  // Drag and Drop handlers for reordering fields
  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    
    if (draggedFieldIndex === null || draggedFieldIndex === index) return

    const fields = [...formData.custom_registration_fields]
    const draggedField = fields[draggedFieldIndex]
    
    // Remove from old position
    fields.splice(draggedFieldIndex, 1)
    // Insert at new position
    fields.splice(index, 0, draggedField)
    
    setFormData((prev) => ({
      ...prev,
      custom_registration_fields: fields,
    }))
    
    setDraggedFieldIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedFieldIndex(null)
  }

  // Custom Abstract Fields Management
  const addCustomAbstractField = () => {
    const newField: CustomRegistrationField = {
      id: `abstract_field_${Date.now()}`,
      name: '',
      type: 'text',
      label: '',
      placeholder: '',
      description: '',
      required: false,
      options: undefined,
    }
    setFormData((prev) => ({
      ...prev,
      custom_abstract_fields: [...prev.custom_abstract_fields, newField],
    }))
    setExpandedAbstractFieldId(newField.id)
  }

  const addCustomAbstractSeparator = () => {
    const newField: CustomRegistrationField = {
      id: `abstract_separator_${Date.now()}`,
      name: '', // Separators don't need a name field
      type: 'separator',
      label: t('newSection'),
      placeholder: '',
      description: '',
      required: false,
      options: undefined,
    }
    setFormData((prev) => ({
      ...prev,
      custom_abstract_fields: [...prev.custom_abstract_fields, newField],
    }))
    setExpandedAbstractFieldId(newField.id)
  }

  const removeCustomAbstractField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      custom_abstract_fields: prev.custom_abstract_fields.filter((field) => field.id !== id),
    }))
  }

  const updateCustomAbstractField = (id: string, field: Partial<CustomRegistrationField>) => {
    setFormData((prev) => ({
      ...prev,
      custom_abstract_fields: prev.custom_abstract_fields.map((f) =>
        f.id === id ? { ...f, ...field } : f
      ),
    }))
  }

  // Drag and Drop handlers for abstract fields
  const handleAbstractDragStart = (index: number) => {
    setDraggedAbstractFieldIndex(index)
  }

  const handleAbstractDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    
    if (draggedAbstractFieldIndex === null || draggedAbstractFieldIndex === index) return

    const fields = [...formData.custom_abstract_fields]
    const draggedField = fields[draggedAbstractFieldIndex]
    
    fields.splice(draggedAbstractFieldIndex, 1)
    fields.splice(index, 0, draggedField)
    
    setFormData((prev) => ({
      ...prev,
      custom_abstract_fields: fields,
    }))
    
    setDraggedAbstractFieldIndex(index)
  }

  const handleAbstractDragEnd = () => {
    setDraggedAbstractFieldIndex(null)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError(t('pleaseUploadImageFile'))
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      showError(t('fileSizeMustBeLessThan2MB'))
      return
    }

    setUploadingLogo(true)
    try {
      // Upload to Supabase Storage
      const formData = new FormData()
      formData.append('file', file)
      formData.append('conferenceId', conferenceId)

      const response = await fetch('/api/admin/conferences/upload-logo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.url) {
        // Save logo URL to database immediately
        const saveResponse = await fetch(`/api/admin/conferences/${conferenceId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({ logo_url: data.url }),
        })

        if (saveResponse.ok) {
          await saveResponse.json()
          setFormData((prev) => ({ ...prev, logo_url: data.url }))
          // Reload conference to show updated logo without full page refresh
          await loadConference()
          showSuccess(t('logoUploadedSuccess'))
        } else {
          const saveData = await saveResponse.json()
          showError(`${t('logoUploadedButFailedToSave')}: ${saveData.error || t('unknownError')}`)
          console.error('Save error:', saveData)
        }
      } else {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}${data.hint ? `\n\nHint: ${data.hint}` : ''}`
          : data.error || t('failedToUploadLogoError')
        showError(errorMsg)
        console.error('Upload error:', data)
      }
    } catch (error) {
      console.error('Logo upload error:', error)
      showError(t('failedToUploadLogo'))
    } finally {
      setUploadingLogo(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateAbstractTemplateFile(file)
    if (!validation.ok) {
      showError(validation.details ? `${validation.error}. ${validation.details}` : validation.error)
      e.target.value = ''
      return
    }

    setTemplateBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(`/api/admin/conferences/${conferenceId}/abstract-template`, {
        method: 'POST',
        body,
      })
      const data = await response.json()
      if (!response.ok || !data?.template) {
        showError(data?.error?.message || data?.error || t('abstractTemplateUploadFailed'))
        return
      }
      setAbstractTemplate(data.template)
      showSuccess(t('abstractTemplateUploaded'))
    } catch (error) {
      console.error('Template upload error:', error)
      showError(t('abstractTemplateUploadFailed'))
    } finally {
      setTemplateBusy(false)
      e.target.value = ''
    }
  }

  const handleTemplateRemove = async () => {
    if (!confirm(t('abstractTemplateRemoveConfirm'))) return
    setTemplateBusy(true)
    try {
      const response = await fetch(`/api/admin/conferences/${conferenceId}/abstract-template`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) {
        showError(data?.error?.message || data?.error || t('abstractTemplateRemoveFailed'))
        return
      }
      setAbstractTemplate(null)
      showSuccess(t('abstractTemplateRemoved'))
    } catch (error) {
      console.error('Template remove error:', error)
      showError(t('abstractTemplateRemoveFailed'))
    } finally {
      setTemplateBusy(false)
    }
  }

  const saveConference = async () => {
    setSaving(true)
    try {
      const settings: Record<string, unknown> = {}
      const payload: Record<string, unknown> = {}

      if (canEditConference) {
        Object.assign(payload, {
          name: formData.name,
          description: formData.description,
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined,
          location: formData.location || undefined,
          venue: formData.venue || undefined,
          website_url: formData.website_url || undefined,
          logo_url: formData.logo_url || undefined,
          primary_color: formData.primary_color,
          pricing: {
            currency: formData.currency,
            vat_percentage:
              formData.vat_percentage !== '' && formData.vat_percentage != null
                ? parseFloat(formData.vat_percentage.toString())
                : null,
            prices_include_vat: formData.prices_include_vat,
          },
          email_settings: {
            from_email: formData.from_email || undefined,
            from_name: formData.from_name || undefined,
            reply_to: formData.reply_to || undefined,
          },
          published: formData.published,
          active: formData.active,
        })
        Object.assign(settings, {
          registration_enabled: formData.registration_enabled,
          payment_required: formData.payment_required,
          max_registrations: formData.max_registrations ? parseInt(formData.max_registrations) : null,
          timezone: formData.timezone,
          custom_registration_fields: formData.custom_registration_fields,
          participant_settings: participantSettings,
          payment_settings: {
            ...paymentSettings,
            allow_card: false,
            allow_bank_transfer: true,
            default_preference: 'pay_now_bank',
          },
          registration_info_text: registrationInfoText || undefined,
          hotel_options: hotelOptions.length > 0 ? hotelOptions : undefined,
          registration_addons:
            registrationAddons.length > 0 ? registrationAddons : undefined,
        })
      }

      if (canManageAbstracts) {
        Object.assign(settings, {
          abstract_submission_enabled: formData.abstract_submission_enabled,
          abstract_submission_deadline: formData.abstract_submission_deadline || undefined,
          abstract_submission_method: formData.abstract_submission_method,
          custom_abstract_fields: formData.custom_abstract_fields,
          abstract_info_text: abstractInfoText || undefined,
        })
      }

      if (Object.keys(settings).length > 0) payload.settings = settings

      const response = await fetch(`/api/admin/conferences/${conferenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        await refreshConferences()
        // Reload conference data to ensure we have the latest from database
        await loadConference()
        showSuccess(t('settingsSavedSuccess'))
      } else {
        console.error('API Error:', data)
        showError(`${t('failedToSave')}: ${data.error}`)
      }
    } catch (error) {
      showError(t('errorSaving'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveConference()
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${conference?.name}"? This will permanently delete all registrations, abstracts, and related data. This action cannot be undone!`)) {
      return
    }

    if (!confirm('This is your last chance! Type DELETE to confirm:') || prompt('Type DELETE to confirm:') !== 'DELETE') {
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/conferences/${conferenceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await refreshConferences()
        showSuccess(t('conferenceDeletedSuccess'))
        router.push('/admin/conferences')
      } else {
        const data = await response.json()
        showError(`${t('failedToDelete')}: ${data.error}`)
      }
    } catch (error) {
      showError(t('errorDeleting'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !adminScope) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingSettings')}</p>
        </div>
      </div>
    )
  }

  if (!conference) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">{t('conferenceNotFound')}</p>
          <Link
            href="/admin/conferences"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            {t('backToConferences')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/conferences"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToConferences')}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('settingsPageTitle')}</h1>
            <p className="text-gray-600 mt-2">{conference.name}</p>
            {conference.slug && (
              <Link
                href={`/conferences/${conference.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
              >
                <Globe className="w-3 h-3" />
                {t('viewConferencePage')}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Custom Pages (Phase 1) */}
            {canEditConference && (
            <Link
              href={`/admin/conferences/${conferenceId}/pages`}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
            >
              {t('pages')}
            </Link>
            )}
            {/* Preview Button */}
            {conference.slug && (
              <Link
                href={`/conferences/${conference.slug}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                <Eye className="w-4 h-4" />
                {t('preview')}
              </Link>
            )}
            {/* Publish Toggle */}
            {canEditConference && (
            <button
              onClick={() => setFormData(prev => ({ ...prev, published: !prev.published }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                formData.published
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {formData.published ? (
                <>
                  <Eye className="w-4 h-4" />
                  {t('published')}
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  {t('draft')}
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {canEditConference && (
        <>
        {/* Basic Information - Refactored component */}
        <BasicInfoSection formData={formData} onChange={handleFormDataChange} />

        {/* Branding - Refactored component */}
        <BrandingSection
          conferenceId={conferenceId as string}
          formData={formData}
          currentLogoUrl={conference.logo_url}
          onChange={handleFormDataChange}
        />

        {/* Registration Information Text - Refactored component */}
        <InfoTextSection
          title={t('registrationInformation')}
          description={t('registrationInfoDesc')}
          value={registrationInfoText}
          onChange={setRegistrationInfoText}
          placeholder={t('informationTextPlaceholder')}
          hint={t('informationTextHint')}
          rows={6}
        />

        {/* Conference Settings - Refactored component */}
        <GeneralSettingsSection section="registration" formData={formData} onChange={handleFormDataChange} />

        {/* Payment Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('paymentOptions')}</h2>
            <p className="text-sm text-gray-600">
              {t('paymentOptionsDesc')}
            </p>
          </div>

          <div className="space-y-6">
            {/* Enable Payment System Toggle */}
            <div className="flex items-start justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{t('paymentSystem')}</h3>
                <p className="text-sm text-gray-600">
                  {t('paymentSystemDesc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentSettings({
                    ...paymentSettings,
                    enabled: !paymentSettings.enabled,
                  })
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  paymentSettings.enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    paymentSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {paymentSettings.enabled && (
              <>
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{t('conferencePaymentMethod')}</h3>
                  <p className="text-sm text-gray-600 mb-3">{t('conferencePaymentMethodDesc')}</p>

                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">🏦 {t('bankTransfer')}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        {t('oneTwoDays')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{t('bankTransferDesc')}</p>
                    {!profile?.bank_account_number && (
                      <p className="text-xs text-amber-600 mt-2 font-medium">
                        ⚠️ {t('bankAccountNotConfigured')}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">{t('cardPaymentPlatformOnly')}</p>
                </div>

                {/* Payment Requirements */}
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentSettings.required_at_registration}
                      onChange={(e) => {
                        setPaymentSettings({
                          ...paymentSettings,
                          required_at_registration: e.target.checked,
                        })
                      }}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{t('requirePaymentPreference')}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {t('requirePaymentPreferenceDesc')}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Deadlines */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('bankTransferDeadline')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={paymentSettings.bank_transfer_deadline_days}
                      onChange={(e) => {
                        setPaymentSettings({
                          ...paymentSettings,
                          bank_transfer_deadline_days: parseInt(e.target.value) || 7,
                        })
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('bankTransferDeadlineHint')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('generalPaymentDeadline')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={paymentSettings.payment_deadline_days}
                      onChange={(e) => {
                        setPaymentSettings({
                          ...paymentSettings,
                          payment_deadline_days: parseInt(e.target.value) || 30,
                        })
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('generalPaymentDeadlineHint')}
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex gap-3">
                    <div className="text-purple-600 mt-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">{t('paymentReminders')}</p>
                      <p className="text-sm text-gray-600">
                        {t('paymentRemindersDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Multiple Participants Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('multipleParticipants')}</h2>
              <p className="text-sm text-gray-600">
                {t('multipleParticipantsDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setParticipantSettings({
                  ...participantSettings,
                  enabled: !participantSettings.enabled,
                })
                setShowParticipantSettings(!showParticipantSettings)
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                participantSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  participantSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {showParticipantSettings && (
            <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
              {/* Participant Label */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('participantLabel')}
                </label>
                <input
                  type="text"
                  value={participantSettings.participantLabel || t('participantDefault')}
                  onChange={(e) => {
                    setParticipantSettings({
                      ...participantSettings,
                      participantLabel: e.target.value,
                    })
                  }}
                  placeholder={t('participantLabelPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('participantLabelHint')}
                </p>
              </div>

              {/* Min/Max Participants */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('minParticipants')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={participantSettings.maxParticipants}
                    value={participantSettings.minParticipants}
                    onChange={(e) => {
                      setParticipantSettings({
                        ...participantSettings,
                        minParticipants: parseInt(e.target.value) || 1,
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('maxParticipants')}
                  </label>
                  <input
                    type="number"
                    min={participantSettings.minParticipants}
                    value={participantSettings.maxParticipants}
                    onChange={(e) => {
                      setParticipantSettings({
                        ...participantSettings,
                        maxParticipants: parseInt(e.target.value) || 5,
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('maxParticipantsHint')}</p>
                </div>
              </div>

              {/* Require Unique Emails */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="requireUniqueEmails"
                  checked={participantSettings.requireUniqueEmails}
                  onChange={(e) => {
                    setParticipantSettings({
                      ...participantSettings,
                      requireUniqueEmails: e.target.checked,
                    })
                  }}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="requireUniqueEmails" className="text-sm text-gray-700">
                  <span className="font-semibold">{t('requireUniqueEmails')}</span>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('requireUniqueEmailsDesc')}
                  </p>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Custom Registration Fields */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('customRegistrationFields')}</h2>
            <p className="text-sm text-gray-600">
              {t('customRegistrationFieldsDesc')}
            </p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {t('fieldsConfigured', { count: formData.custom_registration_fields.length })}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveConference}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? `${tCommon('loading') || 'Loading'}…` : tCommon('save')}
              </button>
              <button
                type="button"
                onClick={addCustomRegistrationField}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                {t('addField')}
              </button>
            </div>
          </div>

          {formData.custom_registration_fields.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-sm">{t('noCustomRegistrationFields')}</p>
              <p className="text-gray-400 text-xs mt-1">{t('addFieldHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formData.custom_registration_fields.map((field, index) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`transition-all duration-200 ${
                    draggedFieldIndex === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                  }`}
                >
                  <CollapsibleFieldEditor
                    field={field}
                    index={index}
                    onUpdate={updateCustomRegistrationField}
                    onRemove={removeCustomRegistrationField}
                    isExpanded={expandedFieldId === field.id}
                    onToggleExpand={() => setExpandedFieldId(expandedFieldId === field.id ? null : field.id)}
                    allFields={formData.custom_registration_fields}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registration Fee */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-blue-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('registrationFee')}</h2>
              <p className="text-sm text-gray-600">
                {t('registrationFeeDesc')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="currency" className="block text-sm font-semibold text-gray-700 mb-2">
                {t('currency')}
              </label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EUR">EUR (€) - Euro</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="CHF">CHF (Fr) - Swiss Franc</option>
                <option value="JPY">JPY (¥) - Japanese Yen</option>
                <option value="CAD">CAD ($) - Canadian Dollar</option>
                <option value="AUD">AUD ($) - Australian Dollar</option>
                <option value="NZD">NZD ($) - New Zealand Dollar</option>
                <option value="SEK">SEK (kr) - Swedish Krona</option>
                <option value="NOK">NOK (kr) - Norwegian Krone</option>
                <option value="DKK">DKK (kr) - Danish Krone</option>
                <option value="PLN">PLN (zł) - Polish Zloty</option>
                <option value="CZK">CZK (Kč) - Czech Koruna</option>
                <option value="HUF">HUF (Ft) - Hungarian Forint</option>
                <option value="RON">RON (lei) - Romanian Leu</option>
                <option value="BGN">BGN (лв) - Bulgarian Lev</option>
                <option value="RSD">RSD (дин) - Serbian Dinar</option>
                <option value="BAM">BAM (КМ) - Bosnia and Herzegovina Convertible Mark</option>
                <option value="MKD">MKD (ден) - Macedonian Denar</option>
                <option value="CNY">CNY (¥) - Chinese Yuan</option>
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="BRL">BRL (R$) - Brazilian Real</option>
                <option value="MXN">MXN ($) - Mexican Peso</option>
                <option value="ZAR">ZAR (R) - South African Rand</option>
                <option value="KRW">KRW (₩) - South Korean Won</option>
                <option value="SGD">SGD ($) - Singapore Dollar</option>
                <option value="HKD">HKD ($) - Hong Kong Dollar</option>
                <option value="AED">AED (د.إ) - UAE Dirham</option>
                <option value="SAR">SAR (﷼) - Saudi Riyal</option>
                <option value="ILS">ILS (₪) - Israeli Shekel</option>
                <option value="TRY">TRY (₺) - Turkish Lira</option>
                <option value="RUB">RUB (₽) - Russian Ruble</option>
              </select>
            </div>

            {/* Custom Registration Fees – PDV se postavlja unutar svakog fee-a */}
            <div className="md:col-span-2 mt-4">
              <CustomRegistrationFeesSection
                conferenceId={conferenceId}
                currency={formData.currency}
                vatPercentage={
                  typeof formData.vat_percentage === 'string'
                    ? Number(formData.vat_percentage) || (profile?.default_vat_percentage ?? 25)
                    : (formData.vat_percentage as number) || (profile?.default_vat_percentage ?? 25)
                }
              />
            </div>
          </div>
        </div>

        <RegistrationAddonsSection
          addons={registrationAddons}
          onChange={setRegistrationAddons}
          currency={formData.currency || 'EUR'}
        />

        {/* Hotel Options for Accommodation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('hotelOptions')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('hotelOptionsDesc')}
            </p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {t('fieldsConfigured', { count: hotelOptions.length })}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveConference}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? `${tCommon('loading') || 'Loading'}…` : tCommon('save')}
              </button>
              <button
                type="button"
                onClick={addHotelOption}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                {t('addField')} Hotel
              </button>
            </div>
          </div>

          {hotelOptions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-sm">{t('noHotels')}</p>
              <p className="text-gray-400 text-xs mt-1">{t('addHotelHint')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hotelOptions.map((hotel, index) => {
                const isExpanded = expandedHotelId === hotel.id
                return (
                  <div
                    key={hotel.id}
                    draggable
                    onDragStart={() => handleHotelDragStart(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleHotelDrop(index)}
                    className={`bg-white rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing ${
                      draggedHotelIndex === index 
                        ? 'opacity-50 border-green-300 shadow-xl scale-105' 
                        : isExpanded
                          ? 'border-green-500 shadow-lg'
                          : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                    }`}
                  >
                    {/* Header - Always Visible */}
                    <div
                      onClick={() => setExpandedHotelId(isExpanded ? null : hotel.id)}
                      className="p-4 cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div 
                          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
                          title={t('dragToReorder')}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {hotel.name || `Hotel #${index + 1}`}
                          </h4>
                          {hotel.name && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                              {hotel.room_type && (
                                <>
                                  <span>{ROOM_TYPE_LABELS[hotel.room_type]}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{hotel.occupancy}</span>
                              <span>•</span>
                              <span>{formatPriceWithoutZeros(hotel.pricePerNight)} {formData.currency}{t('perNight')}</span>
                              {typeof hotel.max_rooms === 'number' && hotel.max_rooms > 0 && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {t('reserved')} {loadingHotelUsage ? '…' : (hotelUsage[hotel.id] ?? 0)} / {hotel.max_rooms} {t('rooms')}
                                    {(hotelUsage[hotel.id] ?? 0) >= hotel.max_rooms && (
                                      <span className="ml-1 font-semibold text-amber-600">{t('full')}</span>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeHotelOption(hotel.id)
                          }}
                          className="text-red-600 hover:text-red-700 transition-colors p-1"
                          title={t('removeHotel')}
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                          {isExpanded ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('hotelRoomNameStar')}
                          </label>
                          <input
                            type="text"
                            value={hotel.name}
                            onChange={(e) =>
                              updateHotelOption(hotel.id, { name: e.target.value })
                            }
                            placeholder="e.g. Hotel Vis – Standard room"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('roomType')}
                          </label>
                          <select
                            value={hotel.room_type ?? ''}
                            onChange={(e) =>
                              updateHotelOption(hotel.id, {
                                room_type: (e.target.value || undefined) as RoomType | undefined,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">— {t('notSelected')} —</option>
                            {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Single, double, twin, suite – for overview and reports
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Occupancy *
                            </label>
                            <select
                              value={hotel.occupancy}
                              onChange={(e) =>
                                updateHotelOption(hotel.id, { occupancy: e.target.value })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              required
                            >
                              <option value="1 person">1 person</option>
                              <option value="2 people">2 people</option>
                              <option value="3 people">3 people</option>
                              <option value="4 people">4 people</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('pricePerNight')} ({formData.currency}) *
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-gray-500 font-medium">
                                {formData.currency}
                              </span>
                              <input
                                type="number"
                                value={hotel.pricePerNight || ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                  // Remove leading zeros and parse
                                  const numValue = value === '' ? 0 : parseFloat(value.replace(/^0+/, '')) || 0
                                  updateHotelOption(hotel.id, {
                                    pricePerNight: numValue,
                                  })
                                }}
                                onFocus={(e) => e.target.select()}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Description (Optional)
                          </label>
                          <textarea
                            value={hotel.description || ''}
                            onChange={(e) =>
                              updateHotelOption(hotel.id, { description: e.target.value })
                            }
                            placeholder={t('additionalInformation')}
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>

                        {/* Availability Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('availableFromOptional')}
                            </label>
                            <input
                              type="date"
                              value={hotel.available_from || ''}
                              onChange={(e) =>
                                updateHotelOption(hotel.id, { available_from: e.target.value || undefined })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder={t('startDatePlaceholder')}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('availableFromHint')}
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('availableUntilOptional')}
                            </label>
                            <input
                              type="date"
                              value={hotel.available_until || ''}
                              onChange={(e) =>
                                updateHotelOption(hotel.id, { available_until: e.target.value || undefined })
                              }
                              min={hotel.available_from || undefined}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder={t('endDatePlaceholder')}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {t('availableFromHint')}
                            </p>
                          </div>
                        </div>

                        {/* Max Rooms (Optional) – manual room capacity */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('maxRoomsOptional')}
                          </label>
                          <input
                            type="number"
                            value={hotel.max_rooms ?? ''}
                            onChange={(e) =>
                              updateHotelOption(hotel.id, {
                                max_rooms: e.target.value ? parseInt(e.target.value, 10) : undefined,
                              })
                            }
                            min="1"
                            placeholder={t('maxRoomsPlaceholder')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">{t('maxRoomsHint')}</p>
                        </div>

                        {/* Reserved X / Y rooms + Full + Create ticket */}
                        {typeof hotel.max_rooms === 'number' && hotel.max_rooms > 0 && (
                          <div className="pt-2 border-t border-gray-200">
                            {loadingHotelUsage ? (
                              <p className="text-sm text-gray-500">{t('loadingReservationCount')}</p>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Reserved:{' '}
                                  <span className="font-semibold text-gray-900">
                                    {hotelUsage[hotel.id] ?? 0} / {hotel.max_rooms} rooms
                                  </span>
                                </p>
                                {(hotelUsage[hotel.id] ?? 0) >= hotel.max_rooms && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                      Full
                                    </span>
                                    {hasTicketForHotel(hotel.id) ? (
                                      <span className="text-sm text-green-600 font-medium">
                                        Ticket created
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={creatingTicketForHotel === hotel.id}
                                        onClick={() =>
                                          handleCreateTicketForHotel(hotel.id, hotel.name || `Hotel #${index + 1}`)
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium disabled:opacity-50"
                                      >
                                        <Ticket className="w-4 h-4" />
                                        {creatingTicketForHotel === hotel.id ? t('creatingTicket') : t('createTicket')}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Preview */}
                        {hotel.name && hotel.pricePerNight > 0 && (
                          <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                            <p className="text-xs text-gray-500 mb-1">{t('previewLabel')}</p>
                            <p className="text-sm font-semibold text-gray-900">🏨 {hotel.name}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 flex-wrap">
                              {hotel.room_type && (
                                <span>🛏 {ROOM_TYPE_LABELS[hotel.room_type]}</span>
                              )}
                              <span>👤 {hotel.occupancy}</span>
                              <span>💶 {hotel.pricePerNight.toFixed(2)} {formData.currency}{t('perNight')}</span>
                            </div>
                            {hotel.description && (
                              <p className="text-xs text-gray-600 mt-1">{hotel.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </>
        )}

        {canManageAbstracts && (
        <>
        <GeneralSettingsSection section="abstracts" formData={formData} onChange={handleFormDataChange} />

        {/* Abstract Information Text - Refactored component */}
        <InfoTextSection
          title={t('abstractInformation')}
          description={t('abstractInfoSectionDesc')}
          value={abstractInfoText}
          onChange={setAbstractInfoText}
          placeholder={t('abstractInfoPlaceholder')}
          hint={t('abstractInfoFormHint')}
          rows={12}
        />

        {/* Abstract Submission Method */}
        {formData.abstract_submission_enabled && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('abstractSubmissionMethod')}
            </h2>
            <div className="space-y-3">
              {(['online_form', 'document_upload'] as const).map((method) => (
                <label key={method} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="abstract_submission_method"
                    value={method}
                    checked={formData.abstract_submission_method === method}
                    onChange={() =>
                      handleFormDataChange({
                        abstract_submission_method: method as AbstractSubmissionMethod,
                      })
                    }
                    className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                      {t(`abstractSubmissionMethodOption_${method}`)}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t(`abstractSubmissionMethodHint_${method}`)}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {formData.abstract_submission_method === 'document_upload' && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{t('abstractTemplate')}</h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">{t('abstractTemplateDesc')}</p>

                {abstractTemplate ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {abstractTemplate.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {abstractTemplate.file_size
                          ? `${(abstractTemplate.file_size / 1024 / 1024).toFixed(2)} MB · `
                          : ''}
                        {new Date(abstractTemplate.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {templateBusy ? t('abstractTemplateUploading') : t('abstractTemplateReplace')}
                        <input
                          type="file"
                          accept={ABSTRACT_TEMPLATE_ACCEPT}
                          className="hidden"
                          disabled={templateBusy}
                          onChange={handleTemplateUpload}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleTemplateRemove}
                        disabled={templateBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('abstractTemplateRemove')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {templateBusy ? t('abstractTemplateUploading') : t('abstractTemplateUpload')}
                    <input
                      type="file"
                      accept={ABSTRACT_TEMPLATE_ACCEPT}
                      className="hidden"
                      disabled={templateBusy}
                      onChange={handleTemplateUpload}
                    />
                  </label>
                )}
                <p className="text-xs text-gray-400 mt-2">{t('abstractTemplateHint')}</p>
              </div>
            )}
          </div>
        )}

        {/* Custom Abstract Submission Fields */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-purple-100 p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('customAbstractFields')}</h2>
            </div>
            <p className="text-sm text-gray-600 ml-13">
              {t('customAbstractFieldsDesc')}
            </p>
            {getCoveredAbstractCustomFields(formData.custom_abstract_fields).length > 0 && (
              <div className="mt-3 ml-13 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
                {t('legacyAbstractFieldsWarning', {
                  count: getCoveredAbstractCustomFields(formData.custom_abstract_fields).length,
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-purple-900">
                {t('fieldsConfigured', { count: formData.custom_abstract_fields.length })}
              </span>
              {formData.custom_abstract_fields.length > 0 && (
                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  {t('active')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getCoveredAbstractCustomFields(formData.custom_abstract_fields).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const removed = getCoveredAbstractCustomFields(
                      formData.custom_abstract_fields
                    ).length
                    setFormData((prev) => ({
                      ...prev,
                      custom_abstract_fields: removeCoveredAbstractCustomFields(
                        prev.custom_abstract_fields
                      ),
                    }))
                    showSuccess(t('legacyAbstractFieldsRemoved', { count: removed }))
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors font-medium text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('removeLegacyAbstractFields')}
                </button>
              )}
              <button
                type="button"
                onClick={saveConference}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                <Save className="w-4 h-4" />
                {saving ? `${tCommon('loading') || 'Loading'}…` : tCommon('save')}
              </button>
              <button
                type="button"
                onClick={addCustomAbstractSeparator}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                title={t('addSectionSeparator')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
                {t('addSeparator')}
              </button>
              <button
                type="button"
                onClick={addCustomAbstractField}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all font-medium shadow-md hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                {t('addField')}
              </button>
            </div>
          </div>

          {formData.custom_abstract_fields.length === 0 ? (
            <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-white rounded-xl border-2 border-dashed border-purple-200">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">{t('noCustomAbstractFieldsYet')}</p>
              <p className="text-gray-500 text-xs">{t('addAbstractFieldClickHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formData.custom_abstract_fields.map((field, index) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => handleAbstractDragStart(index)}
                  onDragOver={(e) => handleAbstractDragOver(e, index)}
                  onDragEnd={handleAbstractDragEnd}
                  className={`transition-all duration-200 ${
                    draggedAbstractFieldIndex === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                  }`}
                >
                  <CollapsibleFieldEditor
                    field={field}
                    index={index}
                    onUpdate={updateCustomAbstractField}
                    onRemove={removeCustomAbstractField}
                    isExpanded={expandedAbstractFieldId === field.id}
                    onToggleExpand={() => setExpandedAbstractFieldId(expandedAbstractFieldId === field.id ? null : field.id)}
                    allFields={formData.custom_abstract_fields}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {canEditConference && (
        <>
        {/* Tickets for this conference – e.g. when hotel rooms are full */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('ticketsForConference')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('ticketsDesc')}
          </p>
          {loadingTickets ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              {t('loading')}
            </div>
          ) : (
            <>
              {conferenceTickets.length === 0 ? (
                <p className="text-sm text-gray-500 mb-4">{t('noTickets')}</p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {conferenceTickets.map((ticket) => (
                    <li key={ticket.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-medium text-gray-900 truncate pr-2">{ticket.subject}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          ticket.status === 'open'
                            ? 'bg-amber-100 text-amber-800'
                            : ticket.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ticket.status === 'open' ? t('ticketStatusOpen') : ticket.status === 'in_progress' ? t('ticketStatusInProgress') : ticket.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/admin/tickets?conference_id=${conferenceId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium text-sm transition-colors"
              >
                <Ticket className="w-4 h-4" />
                {t('newTicketRoomsFull')}
              </Link>
              {conferenceTickets.length > 0 && (
                <Link
                  href={`/admin/tickets?conference_id=${conferenceId}`}
                  className="ml-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('openAllTickets')}
                </Link>
              )}
            </>
          )}
        </div>

        {/* Email Settings - Refactored component */}
        <EmailSettingsSection
          formData={formData}
          onChange={handleFormDataChange}
        />
        </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-5 h-5" />
              {deleting ? t('deleting') : t('deleteConference')}
            </button>
          )}

          <div className={`flex items-center gap-4 ${!isSuperAdmin ? 'ml-auto' : ''}`}>
            <Link
              href="/admin/conferences"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              {t('back')}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {t('save')}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

