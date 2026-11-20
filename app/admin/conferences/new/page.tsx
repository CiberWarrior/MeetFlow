'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useConference } from '@/contexts/ConferenceContext'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Calendar, MapPin, Globe, DollarSign, Save, Building2, Users, Settings, Upload, Plus, X, GripVertical } from 'lucide-react'
import Link from 'next/link'
import { showSuccess, showError } from '@/utils/toast'
import type { AbstractSubmissionMethod, CustomPricingField, HotelOption, CustomRegistrationField, PaymentSettings, RoomType } from '@/types/conference'
import type { ParticipantSettings } from '@/types/conference'
import { DEFAULT_PARTICIPANT_SETTINGS } from '@/types/participant'
import { DEFAULT_PAYMENT_SETTINGS } from '@/constants/defaultPaymentSettings'
import { formatPriceWithoutZeros } from '@/utils/pricing'
import CollapsibleFieldEditor from '@/components/admin/CollapsibleFieldEditor'

export default function NewConferencePage() {
  const t = useTranslations('admin.conferences')
  const router = useRouter()
  const { refreshConferences } = useConference()
  const { isSuperAdmin, loading: authLoading, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [useDefaultVAT, setUseDefaultVAT] = useState(true)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [participantSettings, setParticipantSettings] = useState<ParticipantSettings>(DEFAULT_PARTICIPANT_SETTINGS)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS)
  const [registrationInfoText, setRegistrationInfoText] = useState<string>('')
  const [abstractInfoText, setAbstractInfoText] = useState<string>('')
  const [showParticipantSettings, setShowParticipantSettings] = useState(false)
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null)
  const [expandedAbstractFieldId, setExpandedAbstractFieldId] = useState<string | null>(null)
  const [draggedAbstractFieldIndex, setDraggedAbstractFieldIndex] = useState<number | null>(null)
  const [hotelOptions, setHotelOptions] = useState<HotelOption[]>([])
  const [draggedHotelIndex, setDraggedHotelIndex] = useState<number | null>(null)
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    conference_code: '',
    event_type: 'conference' as 'conference' | 'workshop' | 'seminar' | 'webinar' | 'training' | 'other',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    venue: '',
    website_url: '',
    logo_url: '' as string | undefined,
    primary_color: '#3B82F6',
    // Pricing
    currency: 'EUR',
    early_bird_amount: 150,
    early_bird_deadline: '',
    regular_amount: 200,
    late_amount: 250,
    student_discount: 50,
    accompanying_person_price: 140,
    vat_percentage: '' as string | number, // PDV postotak (npr. 25 za 25%)
    prices_include_vat: false, // If true, entered prices are VAT-inclusive (sa PDV-om)
    custom_pricing_fields: [] as CustomPricingField[],
    // Settings
    registration_enabled: true,
    abstract_submission_enabled: true,
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
  })

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
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Don't render form if not Super Admin (will redirect)
  if (!isSuperAdmin) {
    return null
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  // Custom Pricing Fields Management
  const addCustomPricingField = () => {
    const newField: CustomPricingField = {
      id: `custom_${Date.now()}`,
      name: '',
      value: 0,
      description: '',
    }
    setFormData((prev) => ({
      ...prev,
      custom_pricing_fields: [...prev.custom_pricing_fields, newField],
    }))
  }

  const removeCustomPricingField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      custom_pricing_fields: prev.custom_pricing_fields.filter((field) => field.id !== id),
    }))
  }

  const updateCustomPricingField = (id: string, field: Partial<CustomPricingField>) => {
    setFormData((prev) => ({
      ...prev,
      custom_pricing_fields: prev.custom_pricing_fields.map((f) =>
        f.id === id ? { ...f, ...field } : f
      ),
    }))
  }

  const ROOM_TYPE_LABELS: Record<RoomType, string> = {
    single: 'Single',
    double: 'Double',
    twin: 'Twin',
    suite: 'Suite',
    other: 'Other',
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
      type: 'text',
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

  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    
    if (draggedFieldIndex === null || draggedFieldIndex === index) return

    const fields = [...formData.custom_registration_fields]
    const draggedField = fields[draggedFieldIndex]
    
    fields.splice(draggedFieldIndex, 1)
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
      name: '',
      type: 'separator',
      label: 'New Section',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/admin/conferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          conference_code: formData.conference_code || undefined,
          event_type: formData.event_type,
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
            vat_percentage: useDefaultVAT 
              ? null  // Use organization default
              : formData.vat_percentage 
                ? parseFloat(formData.vat_percentage.toString()) 
                : null,
            prices_include_vat: false, // cijene uvijek neto; opcija bruto uklonjena
            early_bird: {
              amount: formData.early_bird_amount,
              deadline: formData.early_bird_deadline || undefined,
            },
            regular: {
              amount: formData.regular_amount,
            },
            late: {
              amount: formData.late_amount,
            },
            student_discount: formData.student_discount,
            accompanying_person_price: formData.accompanying_person_price || undefined,
            custom_fields: formData.custom_pricing_fields.length > 0 ? formData.custom_pricing_fields : undefined,
          },
          settings: {
            registration_enabled: formData.registration_enabled,
            abstract_submission_enabled: formData.abstract_submission_enabled,
            abstract_submission_method: formData.abstract_submission_method,
            payment_required: formData.payment_required,
            max_registrations: formData.max_registrations ? parseInt(formData.max_registrations) : null,
            timezone: formData.timezone,
            custom_registration_fields: formData.custom_registration_fields,
            custom_abstract_fields: formData.custom_abstract_fields,
            participant_settings: participantSettings,
            payment_settings: {
              ...paymentSettings,
              allow_card: false,
              allow_bank_transfer: true,
              default_preference: 'pay_now_bank',
            },
            registration_info_text: registrationInfoText || undefined,
            abstract_info_text: abstractInfoText || undefined,
            hotel_options: hotelOptions.length > 0 ? hotelOptions : undefined,
          },
          email_settings: {
            from_email: formData.from_email || undefined,
            from_name: formData.from_name || undefined,
            reply_to: formData.reply_to || undefined,
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        await refreshConferences()
        showSuccess('Conference created successfully!')
        router.push('/admin/conferences')
      } else {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Unknown error'
        showError(`${t('failedToCreateConference')}: ${errorMsg}`)
        console.error('Conference creation error:', data)
      }
    } catch (error: any) {
      console.error('Error creating conference:', error)
      const errorMessage = error?.message || error?.details || t('errorCreatingConference')
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative py-8 md:py-12 bg-gradient-to-br from-blue-800 via-blue-900 to-blue-950 text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid-new" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-new)" />
            </svg>
          </div>
          
          <div className="absolute top-1/4 left-[5%] w-64 h-64 bg-blue-500/10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-[5%] w-80 h-80 bg-blue-600/10 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
          <div className="mb-6">
            <Link
              href="/admin/conferences"
              className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('backToConferences')}
            </Link>
          </div>
          
          <div className="text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 leading-tight text-white">
              {t('createNewConferenceTitle')}
            </h1>
            <p className="text-lg md:text-xl mb-6 text-blue-100 leading-relaxed">
              {t('setUpNewConferenceDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="relative py-16 bg-gradient-to-b from-white via-gray-50/50 to-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
            {/* Basic Information Card */}
            <div className="group relative bg-white rounded-3xl p-8 md:p-10 border-2 border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-blue-50/0 to-transparent group-hover:from-blue-50/50 group-hover:via-blue-50/30 transition-all duration-500"></div>
              
              <div className="relative z-10">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2">{t('basicInformation')}</h2>
                  <p className="text-gray-600">{t('enterBasicDetails')}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                      {formData.event_type === 'conference'
                        ? t('conferenceNameStar')
                        : formData.event_type === 'workshop'
                        ? t('workshopNameStar')
                        : formData.event_type === 'seminar'
                        ? t('seminarNameStar')
                        : formData.event_type === 'webinar'
                        ? t('webinarNameStar')
                        : formData.event_type === 'training'
                        ? t('trainingNameStar')
                        : t('eventNameStar')}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder={
                        formData.event_type === 'conference'
                          ? t('placeholderConferenceName')
                          : formData.event_type === 'workshop'
                          ? t('placeholderWorkshopName')
                          : formData.event_type === 'seminar'
                          ? t('placeholderSeminarName')
                          : formData.event_type === 'webinar'
                          ? t('placeholderWebinarName')
                          : formData.event_type === 'training'
                          ? t('placeholderTrainingName')
                          : t('placeholderEventName')
                      }
                    />
                  </div>

                  {/* Conference Code */}
                  <div>
                    <label htmlFor="conference_code" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('conferenceCodeStar')}
                      <span className="text-xs text-gray-500 font-normal ml-2">
                        {t('usedInRegistrationNumbers')}
                      </span>
                    </label>
                    <input
                      type="text"
                      id="conference_code"
                      name="conference_code"
                      value={formData.conference_code}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
                        setFormData({ ...formData, conference_code: code })
                      }}
                      required
                      maxLength={20}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase"
                      placeholder={t('placeholderConferenceCode')}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {t('registrationNumbersFormat')}{' '}
                      <strong className="text-blue-600 ml-1 font-mono">
                        {formData.conference_code || 'CODE'}-001, {formData.conference_code || 'CODE'}-002
                      </strong>
                      , etc.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="event_type" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('eventTypeStar')}
                    </label>
                    <select
                      id="event_type"
                      name="event_type"
                      value={formData.event_type}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    >
                      <option value="conference">Conference</option>
                      <option value="workshop">Workshop</option>
                      <option value="seminar">Seminar</option>
                      <option value="webinar">Webinar</option>
                      <option value="training">Training Course</option>
                      <option value="other">Other</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('selectEventType')}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('descriptionLabel')}
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder={t('placeholderDescription')}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="website_url" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('websiteUrlLabel')}
                      </label>
                      <input
                        type="url"
                        id="website_url"
                        name="website_url"
                        value={formData.website_url}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder={t('placeholderWebsiteUrl')}
                      />
                    </div>

                    <div>
                      <label htmlFor="primary_color" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('brandColorLabel')}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          id="primary_color"
                          name="primary_color"
                          value={formData.primary_color}
                          onChange={handleChange}
                          className="w-16 h-12 border-2 border-gray-200 rounded-xl cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.primary_color}
                          onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('logoUrlLabel')}
                    </label>
                    <input
                      type="url"
                      placeholder={t('enterLogoUrl')}
                      value={formData.logo_url || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {t('logoUrlHint')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Details Card */}
            <div className="group relative bg-white rounded-3xl p-8 md:p-10 border-2 border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 via-purple-50/0 to-transparent group-hover:from-purple-50/50 group-hover:via-purple-50/30 transition-all duration-500"></div>
              
              <div className="relative z-10">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2">{t('eventDetails')}</h2>
                  <p className="text-gray-600">{t('eventDetailsDesc')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('startDate')}
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="end_date" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('endDate')}
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="location" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('locationCityCountry')}
                    </label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder={t('placeholderLocation')}
                    />
                  </div>

                  <div>
                    <label htmlFor="venue" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('venueLabel')}
                    </label>
                    <input
                      type="text"
                      id="venue"
                      name="venue"
                      value={formData.venue}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder={t('placeholderVenue')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Information Text */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Information</h2>
                <p className="text-sm text-gray-600">
                  Add introductory text or instructions that will appear at the top of the registration form.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Information Text
                </label>
                <textarea
                  value={registrationInfoText}
                  onChange={(e) => setRegistrationInfoText(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter information text that will be displayed to users when they register..."
                />
              </div>
            </div>

            {/* Conference Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Conference Settings</h2>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="registration_enabled"
                    checked={formData.registration_enabled}
                    onChange={handleChange}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Enable Registration</p>
                    <p className="text-sm text-gray-600">Allow participants to register for the conference</p>
                  </div>
                </label>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 mb-1">Abstract Submission</p>
                      <p className="text-sm text-gray-600 mb-3">
                        Abstract submission is handled by a separate application. When enabled, a link to the abstract submission platform will be displayed on the conference page.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="abstract_submission_enabled"
                          checked={formData.abstract_submission_enabled}
                          onChange={handleChange}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Show abstract submission link on conference page</span>
                      </label>
                      {formData.abstract_submission_enabled && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Abstract submission method
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name="abstract_submission_method"
                                value="online_form"
                                checked={formData.abstract_submission_method === 'online_form'}
                                onChange={() =>
                                  setFormData((prev) => ({ ...prev, abstract_submission_method: 'online_form' as const }))
                                }
                                className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500 size-4"
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">Online form</span>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Authors enter the abstract directly in MeetFlow.
                                </p>
                              </div>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name="abstract_submission_method"
                                value="document_upload"
                                checked={formData.abstract_submission_method === 'document_upload'}
                                onChange={() =>
                                  setFormData((prev) => ({ ...prev, abstract_submission_method: 'document_upload' as const }))
                                }
                                className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500 size-4"
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">Document upload</span>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Authors upload the abstract as a document.
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="payment_required"
                    checked={formData.payment_required}
                    onChange={handleChange}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Require Payment</p>
                    <p className="text-sm text-gray-600">Participants must pay registration fee</p>
                  </div>
                </label>

                <div>
                  <label htmlFor="max_registrations" className="block text-sm font-semibold text-gray-700 mb-2">
                    Maximum Registrations (optional)
                  </label>
                  <input
                    type="number"
                    id="max_registrations"
                    name="max_registrations"
                    value={formData.max_registrations}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>
            </div>

            {/* Payment Options */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Options</h2>
                <p className="text-sm text-gray-600">
                  Configure which payment methods are available for this conference
                </p>
              </div>

              <div className="space-y-6">
                {/* Enable Payment System Toggle */}
                <div className="flex items-start justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Payment System</h3>
                    <p className="text-sm text-gray-600">
                      Enable payment processing for this conference
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
                      <h3 className="font-semibold text-gray-900 mb-1">Conference payment</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Participants pay by bank transfer. A proforma invoice is generated after registration.
                      </p>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="font-semibold text-gray-900">🏦 Bank transfer</p>
                        {!profile?.bank_account_number && (
                          <p className="text-xs text-amber-600 mt-2 font-medium">
                            ⚠️ Bank account not configured. Go to Account Settings to add bank details.
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Card payments are available for MeetFlow platform billing only, not for conference registration.
                      </p>
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
                          <p className="font-semibold text-gray-900">Require Payment Preference at Registration</p>
                          <p className="text-sm text-gray-600 mt-1">
                            If enabled, participants must select a payment method during registration
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Deadlines */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Bank Transfer Deadline (days)
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
                          Days after registration to complete bank transfer
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          General Payment Deadline (days)
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
                          Days after registration to complete payment
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
                          <p className="text-sm font-semibold text-gray-900 mb-1">Payment Reminders</p>
                          <p className="text-sm text-gray-600">
                            Automatic payment reminders will be sent 3 days after registration for pending payments.
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
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Multiple Participants</h2>
                  <p className="text-sm text-gray-600">
                    Enable this feature to allow registrations with multiple participants.
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Participant Label
                    </label>
                    <input
                      type="text"
                      value={participantSettings.participantLabel || 'Participant'}
                      onChange={(e) => {
                        setParticipantSettings({
                          ...participantSettings,
                          participantLabel: e.target.value,
                        })
                      }}
                      placeholder="e.g., Participant, Attendee, Delegate"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Minimum Participants
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
                        Maximum Participants
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
                    </div>
                  </div>

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
                      <span className="font-semibold">Require unique email addresses</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Each participant must have a unique email address
                      </p>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Registration Fields – all labels use t() for i18n */}
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
                <button
                  type="button"
                  onClick={addCustomRegistrationField}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  {t('addField')}
                </button>
              </div>

              {formData.custom_registration_fields.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">{t('noCustomRegistrationFields')}</p>
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
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Registration Fee</h2>
                  <p className="text-sm text-gray-600">
                    Set registration fees for different pricing tiers.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="currency" className="block text-sm font-semibold text-gray-700 mb-2">
                    Currency
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
                    <option value="HRK">HRK (kn) - Croatian Kuna</option>
                  </select>
                </div>

                {/* VAT Settings - same as Conference Settings */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    PDV / VAT Settings
                  </label>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300 hover:bg-blue-50/50" style={{
                      borderColor: useDefaultVAT ? '#3B82F6' : '#E5E7EB',
                      backgroundColor: useDefaultVAT ? '#EFF6FF' : 'white'
                    }}>
                      <input
                        type="radio"
                        checked={useDefaultVAT}
                        onChange={() => setUseDefaultVAT(true)}
                        className="mt-1 w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          Use organization default
                          {profile?.default_vat_percentage && (
                            <span className="ml-2 text-blue-600">
                              ({profile.default_vat_percentage}%)
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {profile?.default_vat_percentage 
                            ? 'Recommended: Use the default VAT setting from your organization.'
                            : 'No default VAT set. Go to Account Settings to set one.'}
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-purple-300 hover:bg-purple-50/50" style={{
                      borderColor: !useDefaultVAT ? '#9333EA' : '#E5E7EB',
                      backgroundColor: !useDefaultVAT ? '#FAF5FF' : 'white'
                    }}>
                      <input
                        type="radio"
                        checked={!useDefaultVAT}
                        onChange={() => setUseDefaultVAT(false)}
                        className="mt-1 w-4 h-4 text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          Set custom VAT for this conference
                        </div>
                        <p className="text-sm text-gray-600 mt-1 mb-3">
                          Override the organization default
                        </p>
                        
                        <input
                          type="number"
                          value={formData.vat_percentage}
                          onChange={(e) => setFormData(prev => ({ ...prev, vat_percentage: e.target.value }))}
                          disabled={useDefaultVAT}
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="e.g. 19 for 19%"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </label>
                  </div>

                  {/* Cijene se uvijek unose bez PDV-a (neto); opcija bruto uklonjena */}
                </div>

                <div>
                  <label htmlFor="early_bird_amount" className="block text-sm font-semibold text-gray-700 mb-2">
                    Early Bird Price
                  </label>
                  <input
                    type="number"
                    id="early_bird_amount"
                    name="early_bird_amount"
                    value={formData.early_bird_amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="early_bird_deadline" className="block text-sm font-semibold text-gray-700 mb-2">
                    Early Bird Deadline
                  </label>
                  <input
                    type="date"
                    id="early_bird_deadline"
                    name="early_bird_deadline"
                    value={formData.early_bird_deadline}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="regular_amount" className="block text-sm font-semibold text-gray-700 mb-2">
                    Regular Price
                  </label>
                  <input
                    type="number"
                    id="regular_amount"
                    name="regular_amount"
                    value={formData.regular_amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="late_amount" className="block text-sm font-semibold text-gray-700 mb-2">
                    Late Registration Price
                  </label>
                  <input
                    type="number"
                    id="late_amount"
                    name="late_amount"
                    value={formData.late_amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="student_discount" className="block text-sm font-semibold text-gray-700 mb-2">
                    Student Discount
                  </label>
                  <input
                    type="number"
                    id="student_discount"
                    name="student_discount"
                    value={formData.student_discount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="accompanying_person_price" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('accompanyingPersonPriceLabel')}
                  </label>
                  <input
                    type="number"
                    id="accompanying_person_price"
                    name="accompanying_person_price"
                    value={formData.accompanying_person_price}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('accompanyingPersonPriceDesc')}</p>
                  <p className="text-sm text-gray-500 mt-1">{t('accompanyingPersonHelpText')}</p>
                </div>
              </div>

              {/* Custom Pricing Fields – all labels use t() for i18n */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t('customPricingFields')}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('customPricingFieldsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomPricingField}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-md hover:shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                    {t('addField')}
                  </button>
                </div>

                {formData.custom_pricing_fields.length === 0 ? (
                  <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-white rounded-xl border-2 border-dashed border-blue-200">
                    <p className="text-gray-700 font-semibold text-sm mb-1">{t('noCustomPricingFields')}</p>
                    <p className="text-gray-500 text-xs">{t('addPricingFieldHint')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.custom_pricing_fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="text-sm font-semibold text-gray-700">
                            {t('customFieldNumber', { number: index + 1 })}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeCustomPricingField(field.id)}
                            className="text-red-600 hover:text-red-700 transition-colors"
                            title={t('removeField')}
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('fieldNameStar')}
                            </label>
                            <input
                              type="text"
                              value={field.name}
                              onChange={(e) =>
                                updateCustomPricingField(field.id, { name: e.target.value })
                              }
                              placeholder={t('customPricingFieldPlaceholder')}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {t('valuePriceStar')}
                            </label>
                            <input
                              type="number"
                              value={field.value}
                              onChange={(e) =>
                                updateCustomPricingField(field.id, {
                                  value: parseFloat(e.target.value) || 0,
                                })
                              }
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('descriptionStar')}
                          </label>
                          <textarea
                            value={field.description}
                            onChange={(e) =>
                              updateCustomPricingField(field.id, { description: e.target.value })
                            }
                            placeholder={t('describePricingField')}
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hotel Options */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Hotel Options</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Add available hotels and room types for accommodation booking
                </p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {hotelOptions.length} hotel option(s) configured
                </div>
                <button
                  type="button"
                  onClick={addHotelOption}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Hotel
                </button>
              </div>

              {hotelOptions.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">No hotel options yet</p>
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
                        <div
                          onClick={() => setExpandedHotelId(isExpanded ? null : hotel.id)}
                          className="p-4 cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div 
                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
                              title="Drag to reorder"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {hotel.name || `Hotel #${index + 1}`}
                              </h4>
                              {hotel.name && (
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span>{hotel.occupancy}</span>
                                  <span>•</span>
                                  <span>{formatPriceWithoutZeros(hotel.pricePerNight)} {formData.currency}/night</span>
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

                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Hotel / room name *
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
                                Room type
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
                                <option value="">— Not selected —</option>
                                {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
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
                                  Price Per Night ({formData.currency}) *
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
                                placeholder="Additional information"
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Abstract Information Text */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Abstract Information</h2>
                <p className="text-sm text-gray-600">
                  Add introductory text or instructions that will appear at the top of the abstract submission form.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Information Text
                </label>
                <textarea
                  value={abstractInfoText}
                  onChange={(e) => setAbstractInfoText(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Enter information text that will be displayed to users when they submit abstracts..."
                />
              </div>
            </div>

            {/* Custom Abstract Submission Fields – all labels use t() for i18n */}
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
              </div>

              <div className="flex items-center justify-between mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-purple-900">
                    {t('fieldsConfigured', { count: formData.custom_abstract_fields.length })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                  <p className="text-gray-700 font-semibold text-sm mb-1">{t('noAbstractFields')}</p>
                  <p className="text-gray-500 text-xs">{t('addAbstractFieldHint')}</p>
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
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Email Settings</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="from_email" className="block text-sm font-semibold text-gray-700 mb-2">
                    From Email
                  </label>
                  <input
                    type="email"
                    id="from_email"
                    name="from_email"
                    value={formData.from_email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="conference@yourorganization.com"
                  />
                </div>

                <div>
                  <label htmlFor="from_name" className="block text-sm font-semibold text-gray-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    id="from_name"
                    name="from_name"
                    value={formData.from_name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Conference Team"
                  />
                </div>

                <div>
                  <label htmlFor="reply_to" className="block text-sm font-semibold text-gray-700 mb-2">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    id="reply_to"
                    name="reply_to"
                    value={formData.reply_to}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="support@yourorganization.com"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-8">
              <Link
                href="/admin/conferences"
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Create Conference
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  )
}
