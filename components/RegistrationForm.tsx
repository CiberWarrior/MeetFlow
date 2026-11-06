'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import LoadingSpinner from './LoadingSpinner'
import { showSuccess, showError } from '@/utils/toast'
import { formatPriceWithoutZeros } from '@/utils/pricing'
import type { CustomRegistrationField, ParticipantSettings, HotelOption, PaymentSettings, RegistrationAddon } from '@/types/conference'
import type { RegistrationFeeOption } from '@/types/custom-registration-fee'
import type { Participant } from '@/types/participant'
import { validateParticipantsInput } from '@/lib/registration-participant-validation'
import ParticipantManager from '@/components/admin/ParticipantManager'
import { AlertCircle, Euro, UserPlus, Bed, Upload } from 'lucide-react'
import Link from 'next/link'
import {
  FeeTypeSelector,
  RegistrationSuccess,
  RegistrationInfoBanner,
  PaymentSection,
  AccommodationTab,
  OrderSummary,
} from '@/components/registration'
import type {
  BankInstructions,
  ConfirmationEmailStatus,
} from '@/components/registration/RegistrationSuccess'

interface RegistrationFormProps {
  conferenceId?: string
  conferenceSlug?: string // Conference slug for navigation
  customFields?: CustomRegistrationField[] // Custom registration fields from conference settings
  participantSettings?: ParticipantSettings // Settings for multiple participants
  registrationInfoText?: string // Informational text to display at the top of the form
  hotelOptions?: HotelOption[] // Available hotels for accommodation
  currency?: string // Currency symbol (EUR, USD, etc.)
  conferenceStartDate?: string // Conference start date (ISO string) – used for accommodation
  conferenceEndDate?: string // Conference end date (ISO string)
  abstractSubmissionEnabled?: boolean // Whether abstract submission is enabled
  paymentSettings?: PaymentSettings // Payment options and preferences (admin-controlled)
  hasBankAccount?: boolean // Whether organizer has configured bank account
  conferenceName?: string
  conferenceDate?: string
  conferenceLocation?: string
  /** Custom registration fees from GET /api/conferences/[slug]/registration-fees (custom_registration_fees) */
  registrationFees?: RegistrationFeeOption[] | null
  registrationAddons?: RegistrationAddon[]
}

export default function RegistrationForm({
  conferenceId,
  conferenceSlug,
  customFields = [],
  participantSettings,
  registrationInfoText,
  hotelOptions = [],
  currency = 'EUR',
  conferenceStartDate,
  conferenceEndDate,
  abstractSubmissionEnabled = false,
  paymentSettings,
  hasBankAccount = false,
  conferenceName,
  conferenceDate,
  conferenceLocation,
  registrationFees,
  registrationAddons = [],
}: RegistrationFormProps) {
  const t = useTranslations('registrationForm')
  const locale = useLocale()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedFee, setSelectedFee] = useState<string>('') // Selected fee: custom_registration_fees.id (UUID)
  const [feeConfirmed, setFeeConfirmed] = useState(false)
  const [activeTab, setActiveTab] = useState<'registration' | 'accommodation'>('registration')
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])

  const activeAddons = (registrationAddons || []).filter((a) => a.active !== false)
  const addonsTotal = activeAddons
    .filter((a) => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + Number(a.price || 0), 0)

  const hasFees = !!(registrationFees && registrationFees.length > 0)

  // Auto-select first fee when list loads
  useEffect(() => {
    if (!hasFees || !registrationFees) return
    const firstAvailable = registrationFees.find((f) => f.is_available) ?? registrationFees[0]
    const valid = registrationFees.some((f) => f.id === selectedFee)
    if (!selectedFee || !valid) {
      setSelectedFee(firstAvailable.id)
      setFeeConfirmed(false)
    }
  }, [hasFees, registrationFees, selectedFee])

  // Reset fee confirmation when tab changes
  useEffect(() => {
    if (activeTab === 'accommodation') {
      setFeeConfirmed(false)
    }
  }, [activeTab])
  
  // Conference registration: bank transfer only (card is MeetFlow platform billing only).
  const availablePaymentOptions = {
    card: false,
    bank: (paymentSettings?.allow_bank_transfer ?? true) && hasBankAccount,
    later: false,
  }

  const [paymentPreference, setPaymentPreference] = useState<'pay_now_bank' | ''>('')
  const [bankTransferProofUrl, setBankTransferProofUrl] = useState<string | null>(null)
  const [bankInstructions, setBankInstructions] = useState<BankInstructions | null>(null)
  const [proformaDownloadUrl, setProformaDownloadUrl] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<ConfirmationEmailStatus>('unknown')

  const availableOptionsCount = Object.values(availablePaymentOptions).filter(Boolean).length

  // Iznos odabrane kotizacije (iz custom_registration_fees)
  const selectedFeeAmount = ((): number => {
    if (!selectedFee || !registrationFees) return 0
    const opt = registrationFees.find((f) => f.id === selectedFee)
    return opt ? opt.price_gross : 0
  })()
  const chargeTotal = selectedFeeAmount + addonsTotal
  const paymentRequired = chargeTotal > 0
  const multiParticipantEnabled = participantSettings?.enabled === true
  const effectiveMinParticipants = multiParticipantEnabled
    ? Math.max(1, participantSettings?.minParticipants ?? 1)
    : 1
  const effectiveMaxParticipants = multiParticipantEnabled
    ? Math.max(effectiveMinParticipants, participantSettings?.maxParticipants ?? 5)
    : 1

  useEffect(() => {
    if (paymentRequired && availablePaymentOptions.bank && !paymentPreference) {
      setPaymentPreference('pay_now_bank')
    }
  }, [paymentRequired, availablePaymentOptions.bank, paymentPreference])
  
  // Accommodation state
  const [arrivalDate, setArrivalDate] = useState<string>('')
  const [departureDate, setDepartureDate] = useState<string>('')
  const [numberOfNights, setNumberOfNights] = useState<number>(0)
  const [selectedHotel, setSelectedHotel] = useState<string>('') // Selected hotel ID

  // Payer type: Person vs Company (for invoicing / billing) - NO default, user must select
  const [payerType, setPayerType] = useState<'person' | 'company' | ''>('')
  const [companyNoVat, setCompanyNoVat] = useState(false)
  const [companyVatNumber, setCompanyVatNumber] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyCountry, setCompanyCountry] = useState('')
  const [companyCity, setCompanyCity] = useState('')
  const [companyPostalCode, setCompanyPostalCode] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  
  // Multiple participants state
  const [participants, setParticipants] = useState<Participant[]>([
    {
      customFields: {},
    },
  ])

  // Calculate number of nights when dates change
  const calculateNights = (arrival: string, departure: string) => {
    if (arrival && departure) {
      const arrivalTime = new Date(arrival).getTime()
      const departureTime = new Date(departure).getTime()
      const nights = Math.round((departureTime - arrivalTime) / (1000 * 60 * 60 * 24))
      setNumberOfNights(nights > 0 ? nights : 0)
    } else {
      setNumberOfNights(0)
    }
  }

  const handleArrivalDateChange = (date: string) => {
    setArrivalDate(date)
    calculateNights(date, departureDate)
  }

  const handleDepartureDateChange = (date: string) => {
    setDepartureDate(date)
    calculateNights(arrivalDate, date)
  }

  // Filter hotels based on availability dates
  const getAvailableHotels = () => {
    if (!arrivalDate || !departureDate) return []

    const arrival = new Date(arrivalDate)
    const departure = new Date(departureDate)
    const conferenceStart = conferenceStartDate ? new Date(conferenceStartDate) : null
    const conferenceEnd = conferenceEndDate ? new Date(conferenceEndDate) : null

    return hotelOptions.filter((hotel) => {
      // Check if hotel has availability dates set
      const hotelAvailableFrom = hotel.available_from ? new Date(hotel.available_from) : conferenceStart
      const hotelAvailableUntil = hotel.available_until ? new Date(hotel.available_until) : conferenceEnd

      // If no dates are set and no conference dates, make hotel available
      if (!hotelAvailableFrom && !hotelAvailableUntil) return true

      // Check if selected dates fall within hotel availability
      const isAvailable = (!hotelAvailableFrom || arrival >= hotelAvailableFrom) &&
                          (!hotelAvailableUntil || departure <= hotelAvailableUntil)

      return isAvailable
    })
  }

  // Validate required fields before submission
  const validateForm = (): boolean => {
    // Check if there's at least one participant
    if (participants.length === 0) {
      showError(t('atLeastOneParticipant'))
      return false
    }

    if (hasFees && !selectedFee) {
      showError(t('pleaseSelectFee'))
      return false
    }

    // Check if payment method is selected when payment is required
    if (paymentRequired && !paymentPreference) {
      showError(t('pleaseSelectPaymentMethod'))
      return false
    }

    // Check if payer type is selected when payment is required
    if (paymentRequired && !payerType) {
      showError(t('pleaseSelectPayerType'))
      return false
    }

    // If paying as company, validate company fields (all required except phone and VAT when "I don't have VAT")
    if (hasFees && paymentSettings?.enabled && payerType === 'company') {
      if (!companyName?.trim()) {
        showError(t('companyNameRequired'))
        return false
      }
      if (!companyCountry?.trim()) {
        showError(t('companyCountryRequired'))
        return false
      }
      if (!companyCity?.trim()) {
        showError(t('companyCityRequired'))
        return false
      }
      if (!companyPostalCode?.trim()) {
        showError(t('companyPostalCodeRequired'))
        return false
      }
      if (!companyAddress?.trim()) {
        showError(t('companyAddressRequired'))
        return false
      }
      if (!companyNoVat && !companyVatNumber?.trim()) {
        showError(t('companyVatRequired'))
        return false
      }
    }

    const participantError = validateParticipantsInput(
      participants,
      customFields,
      {
        minParticipants: effectiveMinParticipants,
        maxParticipants: effectiveMaxParticipants,
        requireUniqueEmails: participantSettings?.requireUniqueEmails,
      }
    )
    if (participantError) {
      switch (participantError.code) {
        case 'min_participants':
          showError(t('minParticipantsRequired', { min: participantError.min ?? 1 }))
          break
        case 'max_participants':
          showError(t('maxParticipantsAllowed', { max: participantError.max ?? 5 }))
          break
        case 'duplicate_email':
          showError(t('duplicateParticipantEmail', { email: participantError.email ?? '' }))
          break
        case 'accompanying_target_required':
          showError(t('accompanyingTargetRequired', { num: (participantError.participantIndex ?? 0) + 1 }))
          break
        case 'accompanying_invalid_target':
          showError(t('accompanyingInvalidTarget', { num: (participantError.participantIndex ?? 0) + 1 }))
          break
        default:
          showError(
            t('participantFieldRequired', {
              num: (participantError.participantIndex ?? 0) + 1,
              label: participantError.fieldLabel ?? '',
            })
          )
      }
      return false
    }

    return true
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        conference_id: conferenceId,
        custom_data: {},
        participants: participants,
        registration_fee_id: selectedFee || null,
        selected_addons: selectedAddonIds.map((id) => ({ id, quantity: 1 })),
        // Empty string when fee is free (payment section not shown) – send undefined so the API default applies
        payment_preference: paymentPreference || undefined,
        locale: locale === 'hr' ? 'hr' : 'en', // Za e-mail potvrde (HR/EN)
        accommodation: arrivalDate && departureDate ? {
          arrival_date: arrivalDate,
          departure_date: departureDate,
          number_of_nights: numberOfNights,
          hotel_id: selectedHotel || null, // Include selected hotel
        } : null,
        // Payer type and company details (for invoicing / billing)
        // Empty string when fee is free (payer type not shown) – send undefined so the API default applies
        payer_type: payerType || undefined,
        company_details:
          payerType === 'company'
            ? {
                vat_number: companyNoVat ? null : companyVatNumber?.trim() || null,
                no_vat: companyNoVat,
                company_name: companyName?.trim() || '',
                country: companyCountry?.trim() || '',
                city: companyCity?.trim() || '',
                postal_code: companyPostalCode?.trim() || '',
                address: companyAddress?.trim() || '',
                phone: companyPhone?.trim() || null,
              }
                : null,
        bank_transfer_proof_url: paymentPreference === 'pay_now_bank' ? bankTransferProofUrl : null,
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('registrationFailed'))
      }

      const data = await response.json()

      if (data.bank_instructions) {
        setBankInstructions(data.bank_instructions as BankInstructions)
      }
      if (data.proforma_download_url) {
        setProformaDownloadUrl(data.proforma_download_url)
      }
      const emailStatus = data.confirmation_email
      setConfirmationEmail(
        emailStatus === 'sent' || emailStatus === 'failed' || emailStatus === 'unknown'
          ? emailStatus
          : 'unknown'
      )
      setSubmitSuccess(true)
      showSuccess(t('registrationSuccess'))
    } catch (error: any) {
      showError(error.message || t('submitFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitSuccess) {
    return (
      <RegistrationSuccess
        bankInstructions={bankInstructions}
        proformaDownloadUrl={proformaDownloadUrl}
        confirmationEmail={confirmationEmail}
      />
    )
  }

  return (
    <div className="contents">
      <form onSubmit={onSubmit} className="max-w-7xl mx-auto animate-fade-in space-y-8">
        {/* Registration Info Banner - Refactored component */}
        {registrationInfoText && <RegistrationInfoBanner infoText={registrationInfoText} />}

        {/* Fee Type Selection – only custom_registration_fees (GET /registration-fees) */}
        {hasFees && activeTab === 'registration' && !feeConfirmed && (
          <div className="space-y-6">
            <FeeTypeSelector
              registrationFees={registrationFees!}
              currency={currency}
              selectedFee={selectedFee}
              onSelectFee={setSelectedFee}
              showWarning={true}
            />
            {selectedFee && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setFeeConfirmed(true)}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-3 text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('confirmFeeSelection')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* No fees configured – show when registration tab but no custom_registration_fees */}
        {!hasFees && activeTab === 'registration' && !feeConfirmed && (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">{t('noFeesConfigured')}</p>
            <p className="text-sm text-gray-500">{t('contactAdministrator')}</p>
          </div>
        )}


      {/* Tab Navigation */}
      <div className="mb-10">
        <nav className="flex flex-wrap gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('registration')}
              className={`flex items-center gap-3 px-6 py-3.5 text-base font-semibold rounded-xl transition-all duration-200 ${
                activeTab === 'registration'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 border border-gray-200'
              }`}
            >
              <UserPlus className={`w-5 h-5 ${activeTab === 'registration' ? 'text-white' : 'text-gray-500'}`} />
              <span>{t('tabRegistration')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accommodation')}
              className={`flex items-center gap-3 px-6 py-3.5 text-base font-semibold rounded-xl transition-all duration-200 ${
                activeTab === 'accommodation'
                  ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                  : 'text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 border border-gray-200'
              }`}
            >
              <Bed className={`w-5 h-5 ${activeTab === 'accommodation' ? 'text-white' : 'text-gray-500'}`} />
              <span>{t('tabAccommodation')}</span>
            </button>
            
            {abstractSubmissionEnabled && conferenceSlug && (
              <Link
                href={`/conferences/${conferenceSlug}/submit-abstract`}
                className="flex items-center gap-3 px-6 py-3.5 text-base font-semibold rounded-xl transition-all duration-200 text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 border border-gray-200"
              >
                <Upload className="w-5 h-5 text-gray-500" />
                <span>{t('tabAbstractSubmission')}</span>
              </Link>
            )}
        </nav>
      </div>

      {/* Registration Tab Content - After fee confirmed, or when no fees configured */}
      {activeTab === 'registration' && (feeConfirmed || !hasFees) && (
        <div className="space-y-8">
          {/* Show selected fee with option to change */}
          {hasFees && selectedFee && registrationFees && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('selectedFeeType')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {registrationFees.find((f) => f.id === selectedFee)?.name ?? selectedFee}
                    {' - '}
                    {selectedFeeAmount === 0
                      ? t('free')
                      : `${formatPriceWithoutZeros(selectedFeeAmount)} ${currency}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeeConfirmed(false)}
                  className="px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm border-2 border-blue-300"
                >
                  {t('changeFeeType')}
                </button>
              </div>
            </div>
          )}

          {/* Kartica: Podaci o sudionicima (polja obrasca) */}
          {customFields.length > 0 && (
            <div className="rounded-xl border-2 border-blue-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t('formTitle')}</h2>
                  <p className="text-sm text-gray-600">{t('formSubtitle')}</p>
                </div>
              </div>
              <div className="animate-slide-in">
                <ParticipantManager
                  participants={participants}
                  onChange={setParticipants}
                  minParticipants={effectiveMinParticipants}
                  maxParticipants={effectiveMaxParticipants}
                  allowMultiple={multiParticipantEnabled}
                  participantFields={participantSettings?.participantFields || []}
                  customFields={customFields}
                  participantLabel={participantSettings?.participantLabel || t('participantLabel')}
                  customFieldsPerParticipant={true}
                  conferenceSlug={conferenceSlug}
                />
              </div>
            </div>
          )}

          {activeAddons.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-3">{t('optionalAddons')}</h2>
              <ul className="space-y-2">
                {activeAddons.map((addon) => (
                  <li key={addon.id}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedAddonIds.includes(addon.id)}
                        onChange={(e) => {
                          setSelectedAddonIds((prev) =>
                            e.target.checked
                              ? [...prev, addon.id]
                              : prev.filter((id) => id !== addon.id)
                          )
                        }}
                      />
                      <span className="flex-1">
                        <span className="font-medium text-gray-900">{addon.label}</span>
                        {addon.description && (
                          <span className="block text-sm text-gray-500">{addon.description}</span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">
                        {formatPriceWithoutZeros(Number(addon.price || 0))}{' '}
                        {addon.currency || currency}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {addonsTotal > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  {t('addonsSubtotal', {
                    amount: formatPriceWithoutZeros(addonsTotal),
                    currency,
                  })}
                </p>
              )}
            </div>
          )}

          {/* Empty state when no fields */}
          {customFields.length === 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">{t('noFieldsConfigured')}</p>
              <p className="text-sm text-gray-500">
                {t('contactAdministrator')}
              </p>
            </div>
          )}

          <OrderSummary
            currency={currency}
            registrationFees={registrationFees}
            selectedFeeId={selectedFee}
            selectedFeeAmount={selectedFeeAmount}
            addons={activeAddons}
            selectedAddonIds={selectedAddonIds}
            addonsTotal={addonsTotal}
            chargeTotal={chargeTotal}
            participants={participants}
            participantLabel={participantSettings?.participantLabel || t('participantLabel')}
            hotelOptions={hotelOptions}
            arrivalDate={arrivalDate}
            departureDate={departureDate}
            numberOfNights={numberOfNights}
            selectedHotelId={selectedHotel}
          />

          {/* When selected fee is free, show message and skip payment block */}
          {((hasFees && selectedFee && selectedFeeAmount === 0) || (!hasFees && !paymentRequired)) && addonsTotal === 0 && (
            <div className="pt-6 border-t-2 border-gray-100">
              <p className="text-sm font-medium text-green-700">{t('noPaymentRequired')}</p>
            </div>
          )}

          {/* Payment Section – refactored component */}
          {paymentRequired && (
            <PaymentSection
              paymentSettings={paymentSettings}
              availablePaymentOptions={availablePaymentOptions}
              availableOptionsCount={availableOptionsCount}
              paymentPreference={paymentPreference}
              onPaymentPreferenceChange={setPaymentPreference}
              payerType={payerType}
              onPayerTypeChange={setPayerType}
              companyVatNumber={companyVatNumber}
              onCompanyVatNumberChange={setCompanyVatNumber}
              companyNoVat={companyNoVat}
              onCompanyNoVatChange={setCompanyNoVat}
              companyName={companyName}
              onCompanyNameChange={setCompanyName}
              companyCountry={companyCountry}
              onCompanyCountryChange={setCompanyCountry}
              companyCity={companyCity}
              onCompanyCityChange={setCompanyCity}
              companyPostalCode={companyPostalCode}
              onCompanyPostalCodeChange={setCompanyPostalCode}
              companyAddress={companyAddress}
              onCompanyAddressChange={setCompanyAddress}
              companyPhone={companyPhone}
              onCompanyPhoneChange={setCompanyPhone}
              conferenceSlug={conferenceSlug}
              bankTransferProofUrl={bankTransferProofUrl}
              onBankTransferProofUrlChange={setBankTransferProofUrl}
            />
          )}

          {/* Submit Button */}
          {customFields.length > 0 && (
            <div className="flex justify-end mt-10 pt-8 border-t-2 border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 flex items-center gap-3 text-base"
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>{t('submitting')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t('submitRegistration')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Accommodation Tab Content */}
      {activeTab === 'accommodation' && (
        <AccommodationTab
          arrivalDate={arrivalDate}
          departureDate={departureDate}
          numberOfNights={numberOfNights}
          onArrivalDateChange={handleArrivalDateChange}
          onDepartureDateChange={handleDepartureDateChange}
          selectedHotel={selectedHotel}
          onSelectedHotelChange={setSelectedHotel}
          hotelOptions={hotelOptions}
          getAvailableHotels={getAvailableHotels}
          currency={currency}
          isSubmitting={isSubmitting}
        />
      )}
    </form>
    </div>
  )
}
