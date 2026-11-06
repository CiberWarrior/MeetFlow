'use client'

import { useTranslations, useLocale } from 'next-intl'
import { X, Copy, QrCode, ExternalLink, Bed, CreditCard, User, Users, Package } from 'lucide-react'
import type { Registration } from '@/types/registration'
import type { CustomRegistrationField, HotelOption, RegistrationAddon } from '@/types/conference'
import PaymentMethodBadge from '@/components/admin/PaymentMethodBadge'
import PaymentStatusBadge from '@/components/admin/PaymentStatusBadge'
import StatusBadge from '@/components/admin/StatusBadge'
import {
  formatAdminDate,
  getAccommodationDisplay,
  getCustomFieldEntries,
  resolveAddonLabels,
} from '@/lib/registration-admin-display'
import {
  openRegistrationAttachment,
  parseRegistrationAttachmentPath,
} from '@/lib/registration-attachment'
import { showError } from '@/utils/toast'

interface RegistrationDetailDrawerProps {
  registration: Registration | null
  open: boolean
  onClose: () => void
  hotelOptions?: HotelOption[]
  registrationAddons?: RegistrationAddon[]
  customFieldDefs?: CustomRegistrationField[]
  onShowQr?: (reg: Registration) => void
  onCopyId?: (id: string) => void
  onCopyRegNumber?: (regNumber: string) => void
  onConfirmBankPayment?: (reg: Registration, confirm: boolean) => void
  confirmingPaymentId?: string | null
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="font-medium text-gray-900 text-right break-words">{value || '—'}</dd>
    </div>
  )
}

export default function RegistrationDetailDrawer({
  registration,
  open,
  onClose,
  hotelOptions,
  registrationAddons,
  customFieldDefs = [],
  onShowQr,
  onCopyId,
  onCopyRegNumber,
  onConfirmBankPayment,
  confirmingPaymentId,
}: RegistrationDetailDrawerProps) {
  const t = useTranslations('admin.registrations')
  const locale = useLocale()

  if (!open || !registration) return null

  const acc = getAccommodationDisplay(registration, hotelOptions)
  const addonLabels = resolveAddonLabels(registration.selectedAddons, registrationAddons)
  const customEntries = getCustomFieldEntries(registration, customFieldDefs)
  const payerType = (registration.customFields?.payer_type as string) || 'person'
  const companyDetails = registration.customFields?.company_details as {
    company_name?: string
    vat_number?: string | null
    no_vat?: boolean
    country?: string
    city?: string
    postal_code?: string
    address?: string
    phone?: string | null
  } | null

  const paymentLabels = {
    card: t('methodCard'),
    bankTransfer: t('methodBankTransfer'),
    cash: t('methodCash'),
    other: t('methodOther'),
    unknown: t('methodUnknown'),
  }

  const statusLabels = {
    paid: t('paid'),
    pending: t('pendingPayment'),
    notRequired: t('notRequired'),
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-detail-title"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
              {registration.registration_number || t('detailsNoRegNumber')}
            </p>
            <h2 id="registration-detail-title" className="text-lg font-bold text-gray-900 truncate">
              {[registration.firstName, registration.lastName].filter(Boolean).join(' ') || t('detailsUnnamed')}
            </h2>
            <p className="text-sm text-gray-500 truncate">{registration.email || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Section title={t('detailsContact')} icon={<User className="w-4 h-4" />}>
            <Row label={t('email')} value={registration.email} />
            <Row label={t('phone')} value={registration.phone} />
            <Row label={t('country')} value={registration.country} />
            <Row label={t('institution')} value={registration.institution} />
          </Section>

          <Section title={t('detailsRegistration')} icon={<Package className="w-4 h-4" />}>
            <Row label={t('exportRegistrationFeeType')} value={registration.registrationFeeType} />
            <Row
              label={t('exportCreatedAt')}
              value={new Date(registration.createdAt).toLocaleString(locale === 'hr' ? 'hr-HR' : 'en-US')}
            />
            <Row label={t('registrationId')} value={<span className="font-mono text-xs">{registration.id}</span>} />
          </Section>

          <Section title={t('detailsAccommodation')} icon={<Bed className="w-4 h-4" />}>
            {acc.hasHotelSelection ? (
              <>
                <Row label={t('hotel')} value={acc.hotelName} />
                <Row label={t('arrival')} value={formatAdminDate(acc.arrivalDate, locale)} />
                <Row label={t('departure')} value={formatAdminDate(acc.departureDate, locale)} />
                {acc.numberOfNights != null && (
                  <Row label={t('detailsNights')} value={`${acc.numberOfNights} ${t('nights')}`} />
                )}
              </>
            ) : acc.arrivalDate || acc.departureDate ? (
              <>
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  {acc.datesFromFormOnly ? t('detailsDatesFromForm') : t('detailsDatesNoHotel')}
                </p>
                <Row label={t('arrival')} value={formatAdminDate(acc.arrivalDate, locale)} />
                <Row label={t('departure')} value={formatAdminDate(acc.departureDate, locale)} />
              </>
            ) : (
              <p className="text-sm text-gray-500">{t('detailsNoAccommodation')}</p>
            )}
          </Section>

          {addonLabels.length > 0 && (
            <Section title={t('detailsAddons')} icon={<Package className="w-4 h-4" />}>
              <ul className="text-sm text-gray-900 space-y-1">
                {addonLabels.map((label) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t('detailsPayment')} icon={<CreditCard className="w-4 h-4" />}>
            <div className="flex justify-between items-center gap-4 text-sm">
              <span className="text-gray-500">{t('status')}</span>
              <PaymentStatusBadge status={registration.paymentStatus || 'pending'} labels={statusLabels} />
            </div>
            <div className="flex justify-between items-center gap-4 text-sm">
              <span className="text-gray-500">{t('paymentMethod')}</span>
              <PaymentMethodBadge method={registration.paymentMethod} labels={paymentLabels} />
            </div>
            <Row label={t('payment')} value={registration.paymentRequired ? t('yes') : t('no')} />
            <Row
              label={t('exportPayerType')}
              value={payerType === 'company' ? t('detailsPayerCompany') : t('detailsPayerPerson')}
            />
            {payerType === 'company' && companyDetails && (
              <>
                <Row label={t('exportCompanyName')} value={companyDetails.company_name} />
                {!companyDetails.no_vat && companyDetails.vat_number && (
                  <Row label={t('detailsVat')} value={companyDetails.vat_number} />
                )}
                <Row
                  label={t('detailsAddress')}
                  value={[companyDetails.address, companyDetails.postal_code, companyDetails.city, companyDetails.country]
                    .filter(Boolean)
                    .join(', ')}
                />
              </>
            )}
            {registration.bank_transfer_proof_url && (
              <button
                type="button"
                onClick={() => {
                  void openRegistrationAttachment(
                    registration.id,
                    registration.bank_transfer_proof_url!
                  ).catch((error: unknown) => {
                    showError(error instanceof Error ? error.message : t('viewProof'))
                  })
                }}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4" />
                {t('viewProof')}
              </button>
            )}
            {registration.paymentMethod === 'bank_transfer' && registration.paymentStatus === 'pending' && onConfirmBankPayment && (
              <button
                type="button"
                onClick={() => onConfirmBankPayment(registration, true)}
                disabled={confirmingPaymentId === registration.id}
                className="text-sm font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
              >
                {t('confirmBankPayment')}
              </button>
            )}
          </Section>

          <Section title={t('checkIn')} icon={<QrCode className="w-4 h-4" />}>
            <div className="flex justify-between items-center gap-4 text-sm">
              <span className="text-gray-500">{t('checkIn')}</span>
              <StatusBadge tone={registration.checkedIn ? 'success' : 'neutral'}>
                {registration.checkedIn ? t('checkedIn') : t('notCheckedIn')}
              </StatusBadge>
            </div>
            {registration.checkedInAt && (
              <Row
                label={t('detailsCheckedInAt')}
                value={new Date(registration.checkedInAt).toLocaleString(locale === 'hr' ? 'hr-HR' : 'en-US')}
              />
            )}
          </Section>

          {(registration.participants?.length || 0) > 1 && (
            <Section title={t('detailsParticipants')} icon={<Users className="w-4 h-4" />}>
              <p className="text-sm text-gray-600">
                {t('detailsParticipantCount', { count: registration.participants?.length || 0 })}
              </p>
            </Section>
          )}

          {customEntries.length > 0 && (
            <Section title={t('detailsFormFields')} icon={<User className="w-4 h-4" />}>
              {customEntries.map(({ label, value }) => (
                <Row
                  key={label}
                  label={label}
                  value={
                    parseRegistrationAttachmentPath(value) ? (
                      <button
                        type="button"
                        onClick={() => {
                          void openRegistrationAttachment(registration.id, value).catch((error: unknown) => {
                            showError(error instanceof Error ? error.message : t('viewProof'))
                          })
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {t('viewProof')}
                      </button>
                    ) : (
                      value
                    )
                  }
                />
              ))}
            </Section>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2">
          {onCopyRegNumber && registration.registration_number && (
            <button
              type="button"
              onClick={() => onCopyRegNumber(registration.registration_number!)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Copy className="w-4 h-4" />
              {t('copyRegNumber')}
            </button>
          )}
          {onCopyId && (
            <button
              type="button"
              onClick={() => onCopyId(registration.id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              title={t('copyIdHint')}
            >
              <Copy className="w-4 h-4" />
              {t('copyId')}
            </button>
          )}
          {onShowQr && (
            <button
              type="button"
              onClick={() => onShowQr(registration)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <QrCode className="w-4 h-4" />
              {t('viewQrCode')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 ml-auto"
          >
            {t('close')}
          </button>
        </div>
      </aside>
    </>
  )
}
