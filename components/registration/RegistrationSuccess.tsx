'use client'

import { useTranslations } from 'next-intl'
import { Building2 } from 'lucide-react'

export interface BankInstructions {
  recipient: string | null
  iban: string
  bank_name: string | null
  swift_bic: string | null
  amount: number
  currency: string
  reference: string | null
}

export type ConfirmationEmailStatus = 'sent' | 'failed' | 'unknown'

interface RegistrationSuccessProps {
  bankInstructions?: BankInstructions | null
  proformaDownloadUrl?: string | null
  confirmationEmail?: ConfirmationEmailStatus
}

function confirmationMessageKey(status: ConfirmationEmailStatus): string {
  if (status === 'failed') return 'registrationEmailFailed'
  if (status === 'unknown') return 'registrationEmailUnknown'
  return 'registrationSuccessMessage'
}

export default function RegistrationSuccess({
  bankInstructions,
  proformaDownloadUrl,
  confirmationEmail = 'unknown',
}: RegistrationSuccessProps) {
  const t = useTranslations('registrationForm')

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6 animate-fade-in">
      <div className="p-8 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl shadow-xl">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-3">{t('registrationSuccess')}</h2>
          <p className={confirmationEmail === 'sent' ? 'text-green-700 text-lg' : 'text-gray-800 text-lg'}>
            {t(confirmationMessageKey(confirmationEmail))}
          </p>
        </div>
      </div>

      {proformaDownloadUrl && (
        <div className="p-6 bg-white border-2 border-indigo-200 rounded-xl shadow-lg text-center">
          <h3 className="font-semibold text-gray-900 mb-2">{t('proformaTitle')}</h3>
          <p className="text-sm text-gray-600 mb-4">{t('proformaSubtitle')}</p>
          <a
            href={proformaDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            {t('downloadProforma')}
          </a>
        </div>
      )}

      {bankInstructions && (
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('bankInstructionsTitle')}</h3>
              <p className="text-sm text-gray-600">{t('bankInstructionsSubtitle')}</p>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            {bankInstructions.recipient && (
              <div className="flex justify-between gap-4 p-2 bg-white rounded-lg border border-blue-100">
                <dt className="text-gray-600">{t('bankRecipient')}</dt>
                <dd className="font-medium text-gray-900 text-right">{bankInstructions.recipient}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 p-2 bg-white rounded-lg border border-blue-100">
              <dt className="text-gray-600">IBAN</dt>
              <dd className="font-mono font-medium text-gray-900 text-right break-all">{bankInstructions.iban}</dd>
            </div>
            {bankInstructions.bank_name && (
              <div className="flex justify-between gap-4 p-2 bg-white rounded-lg border border-blue-100">
                <dt className="text-gray-600">{t('bankName')}</dt>
                <dd className="font-medium text-gray-900 text-right">{bankInstructions.bank_name}</dd>
              </div>
            )}
            {bankInstructions.swift_bic && (
              <div className="flex justify-between gap-4 p-2 bg-white rounded-lg border border-blue-100">
                <dt className="text-gray-600">SWIFT/BIC</dt>
                <dd className="font-mono font-medium text-gray-900 text-right">{bankInstructions.swift_bic}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 p-2 bg-white rounded-lg border border-blue-100">
              <dt className="text-gray-600">{t('bankAmount')}</dt>
              <dd className="font-semibold text-gray-900 text-right">
                {bankInstructions.amount.toFixed(2)} {bankInstructions.currency}
              </dd>
            </div>
            {bankInstructions.reference && (
              <div className="flex justify-between gap-4 p-2 bg-white rounded-lg border border-blue-100">
                <dt className="text-gray-600">{t('bankReference')}</dt>
                <dd className="font-mono font-medium text-gray-900 text-right">{bankInstructions.reference}</dd>
              </div>
            )}
          </dl>
          {confirmationEmail === 'sent' && (
            <p className="mt-4 text-xs text-gray-600">{t('bankInstructionsEmailNote')}</p>
          )}
        </div>
      )}
    </div>
  )
}
