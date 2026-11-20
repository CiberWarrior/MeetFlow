'use client'

import { useTranslations } from 'next-intl'
import type { ConferenceFormData, OnFormDataChange } from './types'

interface GeneralSettingsSectionProps {
  formData: ConferenceFormData
  onChange: OnFormDataChange
  section: 'registration' | 'abstracts'
}

export default function GeneralSettingsSection({ formData, onChange, section }: GeneralSettingsSectionProps) {
  const t = useTranslations('admin.conferences')

  if (section === 'abstracts') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('abstractSubmissionEnabled')}</h2>
        <div className="space-y-5">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.abstract_submission_enabled}
              onChange={(e) => onChange({ abstract_submission_enabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 size-4"
            />
            <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
              {t('abstractSubmissionEnabled')}
            </span>
          </label>
          {formData.abstract_submission_enabled && (
            <div className="pl-7 space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-gray-800 mb-1.5"
                  htmlFor="abstract-submission-deadline"
                >
                  {t('abstractSubmissionDeadline')}
                </label>
                <input
                  id="abstract-submission-deadline"
                  type="date"
                  value={formData.abstract_submission_deadline}
                  onChange={(e) => onChange({ abstract_submission_deadline: e.target.value })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  {t('abstractSubmissionDeadlineHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('conferenceSettings')}</h2>
      <div className="space-y-5">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={formData.registration_enabled}
            onChange={(e) => onChange({ registration_enabled: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 size-4"
          />
          <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
            {t('registrationEnabled')}
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={formData.payment_required}
            onChange={(e) => onChange({ payment_required: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 size-4"
          />
          <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
            {t('paymentRequired')}
          </span>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5" htmlFor="max-registrations">
            {t('maxRegistrations')}
          </label>
          <input
            id="max-registrations"
            type="text"
            inputMode="numeric"
            value={formData.max_registrations}
            onChange={(e) => onChange({ max_registrations: e.target.value })}
            placeholder={t('maxRegistrationsPlaceholder')}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5" htmlFor="timezone">
            {t('timezone')}
          </label>
          <input
            id="timezone"
            type="text"
            value={formData.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            placeholder="Europe/Zagreb"
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
          />
        </div>
      </div>
    </div>
  )
}
