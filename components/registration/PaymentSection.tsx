'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, User, Upload, FileCheck, Loader2 } from 'lucide-react'
import { showError } from '@/utils/toast'
import type { PaymentSettings as PaymentSettingsType } from '@/types/conference'

interface PaymentSectionProps {
  paymentSettings?: PaymentSettingsType | null
  availablePaymentOptions: { card: boolean; bank: boolean; later: boolean }
  availableOptionsCount: number
  paymentPreference: 'pay_now_bank' | ''
  onPaymentPreferenceChange: (v: 'pay_now_bank') => void
  payerType: 'person' | 'company' | ''
  onPayerTypeChange: (v: 'person' | 'company') => void
  companyVatNumber: string
  onCompanyVatNumberChange: (v: string) => void
  companyNoVat: boolean
  onCompanyNoVatChange: (v: boolean) => void
  companyName: string
  onCompanyNameChange: (v: string) => void
  companyCountry: string
  onCompanyCountryChange: (v: string) => void
  companyCity: string
  onCompanyCityChange: (v: string) => void
  companyPostalCode: string
  onCompanyPostalCodeChange: (v: string) => void
  companyAddress: string
  onCompanyAddressChange: (v: string) => void
  companyPhone: string
  onCompanyPhoneChange: (v: string) => void
  /** Conference slug – required to upload the bank transfer proof */
  conferenceSlug?: string
  bankTransferProofUrl: string | null
  onBankTransferProofUrlChange: (v: string | null) => void
}

export default function PaymentSection({
  availablePaymentOptions,
  availableOptionsCount,
  paymentPreference,
  onPaymentPreferenceChange,
  payerType,
  onPayerTypeChange,
  companyVatNumber,
  onCompanyVatNumberChange,
  companyNoVat,
  onCompanyNoVatChange,
  companyName,
  onCompanyNameChange,
  companyCountry,
  onCompanyCountryChange,
  companyCity,
  onCompanyCityChange,
  companyPostalCode,
  onCompanyPostalCodeChange,
  companyAddress,
  onCompanyAddressChange,
  companyPhone,
  onCompanyPhoneChange,
  conferenceSlug,
  bankTransferProofUrl,
  onBankTransferProofUrlChange,
}: PaymentSectionProps) {
  const t = useTranslations('registrationForm')
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [proofFileName, setProofFileName] = useState<string | null>(null)

  const handleProofFileChange = async (file: File | null) => {
    if (!file) return

    if (!conferenceSlug) {
      showError(t('fileUploadUnavailable'))
      return
    }

    setIsUploadingProof(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `/api/conferences/${conferenceSlug}/upload-registration-attachment`,
        { method: 'POST', body: formData }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('fileUploadFailed'))
      }

      onBankTransferProofUrlChange(data.url)
      setProofFileName(data.fileName || file.name)
    } catch (error: any) {
      showError(error.message || t('fileUploadFailed'))
    } finally {
      setIsUploadingProof(false)
    }
  }

  return (
    <div className="pt-6 border-t-2 border-gray-100 space-y-8">
      {availablePaymentOptions.bank && (
        <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('bankTransfer')}</h3>
              <p className="text-sm text-gray-600 mt-1">{t('bankTransferIntro')}</p>
              <p className="text-sm text-gray-600 mt-2">{t('proformaAfterSubmit')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Payer Type Selection - Card Style */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{t('whoIsPaying')}</h3>
          {!payerType && (
            <span className="text-sm font-medium text-red-600">*</span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onPayerTypeChange('person')}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              payerType === 'person'
                ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                : payerType === ''
                ? 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                : 'border-gray-200 bg-gray-50 opacity-60 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  payerType === 'person' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{t('privatePerson')}</h4>
                <p className="text-sm text-gray-600">{t('privatePersonDescription')}</p>
              </div>
              {payerType === 'person' && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPayerTypeChange('company')}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              payerType === 'company'
                ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                : payerType === ''
                ? 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                : 'border-gray-200 bg-gray-50 opacity-60 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  payerType === 'company' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{t('company')}</h4>
                <p className="text-sm text-gray-600">{t('companyDescription')}</p>
              </div>
              {payerType === 'company' && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Company Details Form */}
      {payerType === 'company' && (
        <div className="bg-gray-50 rounded-xl p-6 space-y-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900">{t('companyDetails')}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('companyName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => onCompanyNameChange(e.target.value)}
                placeholder={t('companyNamePlaceholder') || 'Company Name Ltd.'}
                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('companyCountry')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyCountry}
                onChange={(e) => onCompanyCountryChange(e.target.value)}
                placeholder={t('companyCountryPlaceholder') || 'Croatia'}
                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('companyCity')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyCity}
                onChange={(e) => onCompanyCityChange(e.target.value)}
                placeholder={t('companyCityPlaceholder') || 'Zagreb'}
                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('companyPostalCode')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyPostalCode}
                onChange={(e) => onCompanyPostalCodeChange(e.target.value)}
                placeholder={t('companyPostalCodePlaceholder') || '10000'}
                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('companyPhone')}
              </label>
              <input
                type="tel"
                value={companyPhone}
                onChange={(e) => onCompanyPhoneChange(e.target.value)}
                placeholder={t('companyPhonePlaceholder') || '+385 1 234 5678'}
                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('companyAddress')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => onCompanyAddressChange(e.target.value)}
                placeholder={t('companyAddressPlaceholder') || 'Street Name 123'}
                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={companyNoVat}
                  onChange={(e) => onCompanyNoVatChange(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('companyNoVat')}</span>
              </label>

              {!companyNoVat && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyVat')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyVatNumber}
                    onChange={(e) => onCompanyVatNumberChange(e.target.value)}
                    placeholder={t('companyVatPlaceholder') || 'HR12345678901'}
                    className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    required={!companyNoVat}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bank Transfer Proof Upload - Shown for both person and company if bank transfer is selected */}
      {paymentPreference === 'pay_now_bank' && (
        <div className="bg-amber-50 rounded-xl p-6 border-2 border-amber-200">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{t('bankTransferProof')}</h4>
              <p className="text-sm text-gray-600">{t('bankTransferProofDescription')}</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={isUploadingProof}
              onChange={(e) => handleProofFileChange(e.target.files?.[0] ?? null)}
              className="w-full px-4 py-3 border-2 border-dashed border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {isUploadingProof && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('uploading')}</span>
              </div>
            )}
            {!isUploadingProof && bankTransferProofUrl && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200 flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900">{proofFileName || t('fileUploaded')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
