'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Users, FileCheck, Loader2 } from 'lucide-react'
import type { Participant } from '@/types/participant'
import type { CustomRegistrationField } from '@/types/conference'
import { getTranslatedFieldLabelKey } from '@/lib/registration-field-labels'
import { isFieldVisible } from '@/lib/form-visibility'
import {
  getParticipantDisplayName,
} from '@/lib/registration-participant-validation'
import { showError } from '@/utils/toast'

interface ParticipantManagerProps {
  participants: Participant[]
  onChange: (participants: Participant[]) => void
  minParticipants?: number
  maxParticipants: number
  allowMultiple?: boolean
  participantFields: string[]
  customFields?: CustomRegistrationField[]
  participantLabel?: string
  customFieldsPerParticipant?: boolean
  /** Conference slug – required to upload 'file' type custom fields */
  conferenceSlug?: string
}

export default function ParticipantManager({
  participants,
  onChange,
  minParticipants = 1,
  maxParticipants,
  allowMultiple = true,
  participantFields,
  customFields = [],
  participantLabel,
  customFieldsPerParticipant = true,
  conferenceSlug,
}: ParticipantManagerProps) {
  const t = useTranslations('registrationForm')
  const tFieldLabels = useTranslations('admin.conferences')
  const displayLabel = participantLabel ?? t('participantLabel')
  const [expandedParticipant, setExpandedParticipant] = useState<number>(0)
  // Upload state keyed by `${participantIndex}-${fieldName}`
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({})
  const [uploadedFileNames, setUploadedFileNames] = useState<Record<string, string>>({})

  const reindexAccompanyingLinks = (
    list: Participant[],
    removedIndex: number
  ): Participant[] =>
    list.map((p) => {
      if (!p.isAccompanying || p.accompanyingForIndex == null) return p
      if (p.accompanyingForIndex === removedIndex) {
        return { ...p, isAccompanying: false, accompanyingForIndex: null }
      }
      if (p.accompanyingForIndex > removedIndex) {
        return { ...p, accompanyingForIndex: p.accompanyingForIndex - 1 }
      }
      return p
    })

  const addParticipant = (asAccompanying = false, linkToIndex = 0) => {
    if (participants.length >= maxParticipants) {
      alert(t('maxParticipantsAllowed', { max: maxParticipants }))
      return
    }

    const newParticipant: Participant = {
      customFields: {},
      isAccompanying: asAccompanying,
      accompanyingForIndex: asAccompanying ? linkToIndex : null,
    }

    onChange([...participants, newParticipant])
    setExpandedParticipant(participants.length)
  }

  const removeParticipant = (index: number) => {
    if (participants.length <= minParticipants) {
      alert(t('minParticipantsRequired', { min: minParticipants }))
      return
    }

    const filtered = participants.filter((_, i) => i !== index)
    onChange(reindexAccompanyingLinks(filtered, index))
    if (expandedParticipant === index) {
      setExpandedParticipant(0)
    }
  }

  const updateParticipant = (index: number, fieldName: string, value: any) => {
    const updated = [...participants]
    updated[index] = {
      ...updated[index],
      customFields: {
        ...updated[index].customFields,
        [fieldName]: value,
      },
    }
    onChange(updated)
  }

  const updateParticipantMeta = (
    index: number,
    patch: Partial<Pick<Participant, 'isAccompanying' | 'accompanyingForIndex'>>
  ) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], ...patch }
    onChange(updated)
  }

  // Helper function to parse markdown links in checkbox labels
  const parseMarkdownToHtml = (text: string): string => {
    return text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>'
    )
  }

  const handleFileUpload = async (
    index: number,
    field: CustomRegistrationField,
    file: File
  ) => {
    if (!conferenceSlug) {
      showError(t('fileUploadUnavailable'))
      return
    }

    const key = `${index}-${field.name}`
    setUploadingKeys((prev) => ({ ...prev, [key]: true }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (field.maxFileSize) {
        formData.append('maxFileSizeMb', String(field.maxFileSize))
      }
      if (field.fileTypes && field.fileTypes.length > 0) {
        formData.append('allowedExtensions', JSON.stringify(field.fileTypes))
      }

      const response = await fetch(
        `/api/conferences/${conferenceSlug}/upload-registration-attachment`,
        { method: 'POST', body: formData }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('fileUploadFailed'))
      }

      updateParticipant(index, field.name, data.url)
      setUploadedFileNames((prev) => ({ ...prev, [key]: data.fileName || file.name }))
    } catch (error: any) {
      showError(error.message || t('fileUploadFailed'))
    } finally {
      setUploadingKeys((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('participantsSectionTitle')} ({participants.length}/{maxParticipants})
          </h3>
        </div>
        {allowMultiple && participants.length < maxParticipants && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addParticipant(false)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('addParticipant', { label: displayLabel })}
            </button>
            {participants.some((p) => !p.isAccompanying) && (
              <button
                type="button"
                onClick={() => {
                  const mainIndex = participants.findIndex((p) => !p.isAccompanying)
                  addParticipant(true, mainIndex >= 0 ? mainIndex : 0)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {t('addAccompanyingPerson')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="space-y-3">
        {participants.map((participant, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white"
          >
            {/* Participant Header */}
            <div
              className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() =>
                setExpandedParticipant(expandedParticipant === index ? -1 : index)
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {getParticipantDisplayName(
                      participant,
                      `${displayLabel} ${index + 1}`
                    )}
                    {participant.isAccompanying && (
                      <span className="ml-2 text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                        {t('accompanyingPersonBadge')}
                      </span>
                    )}
                  </p>
                  {participant.isAccompanying &&
                    participant.accompanyingForIndex != null &&
                    participants[participant.accompanyingForIndex] && (
                      <p className="text-xs text-violet-600 mt-0.5">
                        {t('accompanyingPersonFor', {
                          name: getParticipantDisplayName(
                            participants[participant.accompanyingForIndex],
                            `${displayLabel} ${participant.accompanyingForIndex + 1}`
                          ),
                        })}
                      </p>
                    )}
                  {(() => {
                    const email = participant.customFields?.['email'] || participant.customFields?.['Email'] || ''
                    return email ? <p className="text-sm text-gray-500">{email}</p> : null
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {participants.length > minParticipants && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeParticipant(index)
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('removeParticipant')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedParticipant === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Participant Fields (Expanded) */}
            {expandedParticipant === index && (
              <div className="p-4 space-y-4">
                {allowMultiple && participants.length > 1 && (
                  <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(participant.isAccompanying)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          if (checked) {
                            const firstMain = participants.findIndex(
                              (p, i) => i !== index && !p.isAccompanying
                            )
                            updateParticipantMeta(index, {
                              isAccompanying: true,
                              accompanyingForIndex:
                                firstMain >= 0 ? firstMain : null,
                            })
                          } else {
                            updateParticipantMeta(index, {
                              isAccompanying: false,
                              accompanyingForIndex: null,
                            })
                          }
                        }}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {t('accompanyingPersonLabel')}
                        </span>
                        <span className="block text-xs text-gray-600 mt-0.5">
                          {t('accompanyingPersonHelp')}
                        </span>
                      </span>
                    </label>

                    {participant.isAccompanying && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t('accompanyingPersonForLabel')}
                        </label>
                        <select
                          value={
                            participant.accompanyingForIndex != null
                              ? String(participant.accompanyingForIndex)
                              : ''
                          }
                          onChange={(e) =>
                            updateParticipantMeta(index, {
                              accompanyingForIndex:
                                e.target.value === ''
                                  ? null
                                  : parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                          required
                        >
                          <option value="">{t('selectMainParticipant')}</option>
                          {participants.map((p, i) => {
                            if (i === index || p.isAccompanying) return null
                            return (
                              <option key={i} value={String(i)}>
                                {getParticipantDisplayName(
                                  p,
                                  `${displayLabel} ${i + 1}`
                                )}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* All Custom Fields */}
                {customFields.length > 0 ? (
                  <div className="space-y-4">
                    {customFields.map((field) => {
                      const fieldValue = participant.customFields?.[field.name] || ''
                      if (!isFieldVisible(field, participant.customFields || {})) {
                        return null
                      }
                      const labelKey = getTranslatedFieldLabelKey(field.name, field.label)
                      const displayLabel = labelKey ? tFieldLabels(labelKey) : (field.label || '')

                      // Section separator: heading only, no input, never required
                      if (field.type === 'separator') {
                        return (
                          <div key={field.id} className="pt-2 pb-1 border-t border-gray-200 first:border-t-0 first:pt-0">
                            <h4 className="text-base font-bold text-gray-900">{displayLabel}</h4>
                            {field.description && (
                              <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                            )}
                          </div>
                        )
                      }

                      const uploadKey = `${index}-${field.name}`
                      const isUploading = uploadingKeys[uploadKey]
                      const uploadedFileName = uploadedFileNames[uploadKey]

                      return (
                        <div key={field.id}>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {displayLabel}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.description && (
                            <p className="text-xs text-gray-500 mb-2">{field.description}</p>
                          )}

                          {/* Text Input */}
                          {field.type === 'text' && (
                            <input
                              type="text"
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              placeholder={field.placeholder}
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          )}

                          {/* Textarea */}
                          {field.type === 'textarea' && (
                            <textarea
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              placeholder={field.placeholder}
                              rows={4}
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          )}

                          {/* Email */}
                          {field.type === 'email' && (
                            <input
                              type="email"
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              placeholder={field.placeholder}
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          )}

                          {/* Phone */}
                          {field.type === 'tel' && (
                            <input
                              type="tel"
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              placeholder={field.placeholder}
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          )}

                          {/* Number */}
                          {field.type === 'number' && (
                            <input
                              type="number"
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              placeholder={field.placeholder}
                              min={field.validation?.min}
                              max={field.validation?.max}
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          )}

                          {/* Date */}
                          {field.type === 'date' && (
                            <input
                              type="date"
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          )}

                          {/* Select Dropdown */}
                          {field.type === 'select' && field.options && (
                            <select
                              required={field.required}
                              value={fieldValue}
                              onChange={(e) =>
                                updateParticipant(index, field.name, e.target.value)
                              }
                              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">{t('selectPlaceholder')}</option>
                              {field.options.map((option) => {
                                const trimmed = option.trim()
                                return (
                                  <option key={trimmed} value={trimmed}>
                                    {trimmed}
                                  </option>
                                )
                              })}
                            </select>
                          )}

                          {/* Radio Buttons */}
                          {field.type === 'radio' && field.options && (
                            <div className="space-y-2">
                              {field.options.map((option) => {
                                const trimmed = option.trim()
                                return (
                                  <div key={trimmed} className="flex items-center">
                                    <input
                                      type="radio"
                                      id={`${field.name}-${index}-${trimmed}`}
                                      name={`${field.name}-${index}`}
                                      value={trimmed}
                                      checked={fieldValue === trimmed}
                                      onChange={(e) =>
                                        updateParticipant(index, field.name, e.target.value)
                                      }
                                      required={field.required}
                                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <label
                                      htmlFor={`${field.name}-${index}-${trimmed}`}
                                      className="ml-2 text-sm text-gray-700"
                                    >
                                      {trimmed}
                                    </label>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Checkbox */}
                          {field.type === 'checkbox' && (
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                id={`${field.name}-${index}`}
                                checked={fieldValue === true || fieldValue === 'true'}
                                onChange={(e) =>
                                  updateParticipant(index, field.name, e.target.checked)
                                }
                                required={field.required}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                              />
                              <label 
                                htmlFor={`${field.name}-${index}`}
                                className="text-sm text-gray-700 cursor-pointer"
                                dangerouslySetInnerHTML={{ 
                                  __html: parseMarkdownToHtml(field.placeholder || displayLabel)
                                }}
                              />
                            </div>
                          )}

                          {/* Long Text (paste-friendly textarea with character counter) */}
                          {field.type === 'longtext' && (
                            <div>
                              <textarea
                                required={field.required}
                                value={fieldValue}
                                onChange={(e) =>
                                  updateParticipant(index, field.name, e.target.value)
                                }
                                placeholder={field.placeholder}
                                rows={8}
                                maxLength={field.validation?.maxLength}
                                className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              {field.validation?.maxLength && (
                                <p className="text-xs text-gray-500 mt-1 text-right">
                                  {String(fieldValue).length} / {field.validation.maxLength}
                                </p>
                              )}
                            </div>
                          )}

                          {/* File Upload */}
                          {field.type === 'file' && (
                            <div>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept={field.fileTypes?.join(',')}
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(index, field, file)
                                  }}
                                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                              {field.fileTypes && field.fileTypes.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {t('allowedFileTypesHint', { types: field.fileTypes.join(', ') })}
                                </p>
                              )}
                              {isUploading && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>{t('uploading')}</span>
                                </div>
                              )}
                              {!isUploading && fieldValue && (
                                <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                                  <FileCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {uploadedFileName || t('fileUploaded')}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>{t('noFieldsConfiguredParticipant')}</p>
                    <p className="text-sm mt-1">{t('addCustomFieldsInSettings')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
