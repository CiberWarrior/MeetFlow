'use client'

import { useTranslations, useLocale } from 'next-intl'
import { AlertCircle, Bed } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatPriceWithoutZeros } from '@/utils/pricing'
import type { HotelOption } from '@/types/conference'

interface AccommodationTabProps {
  arrivalDate: string
  departureDate: string
  numberOfNights: number
  onArrivalDateChange: (date: string) => void
  onDepartureDateChange: (date: string) => void
  selectedHotel: string
  onSelectedHotelChange: (hotelId: string) => void
  hotelOptions: HotelOption[]
  getAvailableHotels: () => HotelOption[]
  currency: string
  isSubmitting: boolean
}

export default function AccommodationTab({
  arrivalDate,
  departureDate,
  numberOfNights,
  onArrivalDateChange,
  onDepartureDateChange,
  selectedHotel,
  onSelectedHotelChange,
  hotelOptions,
  getAvailableHotels,
  currency,
  isSubmitting,
}: AccommodationTabProps) {
  const t = useTranslations('registrationForm')
  const locale = useLocale()

  return (
    <div className="space-y-10">
      {/* Date Selection Card */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center shadow-lg">
            <Bed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('accommodationDates')}</h2>
            <p className="text-sm text-gray-600">{t('selectArrivalDeparture')}</p>
          </div>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('checkIn')}
            </label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => onArrivalDateChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('checkOut')}
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => onDepartureDateChange(e.target.value)}
              min={arrivalDate}
              className="w-full px-4 py-3 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          {arrivalDate && departureDate && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mt-8 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{t('checkIn')}:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {arrivalDate ? new Date(arrivalDate).toLocaleDateString(locale === 'hr' ? 'hr-HR' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : t('notSelected')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{t('checkOut')}:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {departureDate ? new Date(departureDate).toLocaleDateString(locale === 'hr' ? 'hr-HR' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : t('notSelected')}
                  </span>
                </div>
                <div className="border-t-2 border-green-300 mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-gray-900">{t('numberOfNightsLabel')}</span>
                    <span className="text-3xl font-bold text-green-600">{numberOfNights}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!arrivalDate && !departureDate && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 font-medium">{t('noDatesSelected')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('selectArrivalDeparture')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Hotel Selection - Only show when dates are selected */}
      {arrivalDate && departureDate && numberOfNights > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center">
              <Bed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('selectHotel')}</h3>
              <p className="text-sm text-gray-500">{t('chooseAccommodation')}</p>
            </div>
          </div>

          {(() => {
            const availableHotels = getAvailableHotels()

            if (availableHotels.length === 0) {
              return (
                <div className="text-center py-12 bg-amber-50 border-2 border-amber-200 rounded-xl">
                  <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-base font-semibold text-amber-900 mb-2">{t('noHotelsForDates')}</p>
                  <p className="text-sm text-amber-700">
                    {t('tryDifferentDatesOrContact')}
                  </p>
                </div>
              )
            }

            return (
              <div className="space-y-4">
                {availableHotels
                  .sort((a, b) => a.order - b.order)
                  .map((hotel) => {
                    const totalPrice = hotel.pricePerNight * numberOfNights
                    return (
                      <label
                        key={hotel.id}
                        className={`block p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedHotel === hotel.id
                            ? 'border-green-500 bg-green-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="radio"
                            name="hotel"
                            value={hotel.id}
                            checked={selectedHotel === hotel.id}
                            onChange={(e) => onSelectedHotelChange(e.target.value)}
                            className="mt-1 w-5 h-5 text-green-600 focus:ring-2 focus:ring-green-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                  🏨 {hotel.name}
                                </h4>
                                {hotel.description && (
                                  <p className="text-sm text-gray-600 mb-3">{hotel.description}</p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-2xl font-bold text-green-600">
                                  {formatPriceWithoutZeros(totalPrice)} {currency}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{t('total')}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="font-medium">{hotel.occupancy}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>
                                  {new Date(arrivalDate).toLocaleDateString(locale === 'hr' ? 'hr-HR' : 'en-US', { month: 'short', day: 'numeric' })} - {new Date(departureDate).toLocaleDateString(locale === 'hr' ? 'hr-HR' : 'en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                </svg>
                                <span className="font-medium">{numberOfNights} {numberOfNights === 1 ? t('night') : t('nights')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{formatPriceWithoutZeros(hotel.pricePerNight)} {currency}{t('perNight')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    )
                  })}
              </div>
            )
          })()}

          {!selectedHotel && getAvailableHotels().length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-800">{t('selectHotelToContinue')}</p>
            </div>
          )}
        </div>
      )}

      {/* Submit Button for Accommodation Tab */}
      {arrivalDate && departureDate && (
        <div className="flex justify-end mt-10 pt-8 border-t-2 border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting || (hotelOptions.length > 0 && !selectedHotel)}
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
                <span>{t('completeRegistration')}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
