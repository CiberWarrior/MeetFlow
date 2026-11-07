'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Footer from '@/components/Footer'
import { showSuccess, showError } from '@/utils/toast'
import { getMobilePhoneIssue, normalizeMobilePhone } from '@/lib/mobile-phone'
import './quote-form.css'
import {
  ArrowRight,
  Upload,
  Users,
  Calendar,
  TrendingUp,
  Zap,
  FileText,
  BarChart3,
  Sparkles,
  CheckCircle,
  Info,
  Clock,
  Globe,
  GitMerge,
  MapPin,
  Mail,
  Phone,
  Send,
  Monitor,
  Code,
} from 'lucide-react'

function ContactForm() {
  const t = useTranslations('home.contact')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    phone: '',
    conferenceType: '',
    expectedAttendees: '',
    serviceType: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const phoneMessage = (value: string) => {
    const issue = getMobilePhoneIssue(value)
    if (issue === 'missing_country') return t('phoneMissingCountry')
    if (issue) return t('phoneInvalid')
    return null
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    if (e.target.name === 'phone') setPhoneError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    const mobileError = phoneMessage(formData.phone)
    if (mobileError) {
      setPhoneError(mobileError)
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          phone: normalizeMobilePhone(formData.phone),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'missing_country' || data.code === 'invalid_mobile') {
          throw new Error(data.code)
        }
        throw new Error(data.error || t('error'))
      }

      setSubmitStatus('success')
      showSuccess(t('success'))
      setFormData({ 
        name: '', 
        email: '', 
        organization: '', 
        phone: '',
        conferenceType: '',
        expectedAttendees: '',
        serviceType: '',
        message: '' 
      })
    } catch (error) {
      console.error('Contact form error:', error)
      const phoneErrorText =
        error instanceof Error && error.message === 'missing_country'
          ? t('phoneMissingCountry')
          : error instanceof Error && error.message === 'invalid_mobile'
            ? t('phoneInvalid')
            : null
      const errorMessage = phoneErrorText ?? (error instanceof Error ? error.message : t('errorOccurred'))
      if (phoneErrorText) setPhoneError(phoneErrorText)
      setSubmitStatus('error')
      showError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldClassName =
    'quote-field w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white transition-colors'

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 md:p-10 shadow-2xl border-2 border-gray-200">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('requestQuote')}</h3>
        <p className="text-gray-600">{t('fillForm')}</p>
      </div>
      <form onSubmit={handleSubmit} className="quote-form space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('fullName')}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className={fieldClassName}
              placeholder={t('placeholderName')}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('email')}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className={fieldClassName}
              placeholder={t('placeholderEmail')}
            />
          </div>
        </div>

        <div>
            <label
              htmlFor="organization"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('organization')}
            </label>
            <input
              type="text"
              id="organization"
              name="organization"
              required
              value={formData.organization}
              onChange={handleChange}
              className={fieldClassName}
              placeholder={t('placeholderOrg')}
            />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('phone')}
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              value={formData.phone}
              onChange={handleChange}
              onBlur={() => setPhoneError(phoneMessage(formData.phone))}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? 'phone-error' : 'phone-hint'}
              className={fieldClassName}
              placeholder={t('placeholderPhone')}
            />
            {phoneError ? (
              <p id="phone-error" className="mt-2 text-sm text-red-700">
                {phoneError}
              </p>
            ) : (
              <p id="phone-hint" className="mt-2 text-sm text-gray-500">
                {t('phoneHint')}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="conferenceType"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('conferenceType')}
            </label>
            <select
              id="conferenceType"
              name="conferenceType"
              value={formData.conferenceType}
              onChange={handleChange}
              className={fieldClassName}
            >
              <option value="">{t('selectType')}</option>
              <option value="virtual">{t('typeVirtual')}</option>
              <option value="hybrid">{t('typeHybrid')}</option>
              <option value="onsite">{t('typeOnsite')}</option>
            </select>
          </div>
        </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
            <label
              htmlFor="expectedAttendees"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('expectedAttendees')}
            </label>
            <select
              id="expectedAttendees"
              name="expectedAttendees"
              value={formData.expectedAttendees}
              onChange={handleChange}
              className={fieldClassName}
            >
              <option value="">{t('selectRange')}</option>
                <option value="1-50">1-50</option>
                <option value="51-100">51-100</option>
                <option value="101-250">101-250</option>
                <option value="251-500">251-500</option>
                <option value="501-1000">501-1,000</option>
                <option value="1000+">1,000+</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="serviceType"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                {t('serviceNeeded')}
              </label>
              <select
                id="serviceType"
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className={fieldClassName}
              >
                <option value="">{t('selectService')}</option>
                <option value="platform">{t('serviceOptionPlatform')}</option>
                <option value="website">{t('serviceOptionWebsite')}</option>
                <option value="both">{t('serviceOptionBoth')}</option>
                <option value="other">{t('serviceOptionOther')}</option>
              </select>
            </div>
          </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            {t('message')}
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={6}
            value={formData.message}
            onChange={handleChange}
            className={`${fieldClassName} resize-none`}
            placeholder={t('placeholderMessage')}
          />
        </div>

        {submitStatus === 'success' && (
          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-green-800 font-medium">
                {t('successTitle')}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {t('successSub')}
              </p>
            </div>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-center gap-3">
            <Info className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-medium">
              {t('errorOccurred')}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>{t('sending')}</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{t('send')}</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

interface PublicPlan {
  id: string
  name: string
  slug: string
  description: string | null
  price_monthly: number
  price_yearly: number
  currency: string
  max_conferences: number
  max_registrations_per_conference: number | null
  max_storage_gb: number | null
  features: string[]
}

function PricingSection() {
  const t = useTranslations('home.pricing')
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    let cancelled = false
    fetch('/api/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.plans)) {
          setPlans(data.plans)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const formatPrice = (amount: number, currency: string) =>
    new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(amount)

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-white to-gray-50 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('subtitle')}</p>

          {/* Billing cycle toggle */}
          <div className="mt-8 inline-flex items-center gap-1 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                cycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('monthly')}
            </button>
            <button
              onClick={() => setCycle('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                cycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('yearly')}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400">{t('loading')}</p>
        ) : plans.length === 0 ? (
          <p className="text-center text-gray-400">{t('noPlans')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {plans.map((plan, index) => {
              const highlighted = index === 1
              const price =
                cycle === 'monthly' ? plan.price_monthly : plan.price_yearly
              const unlimitedConf = plan.max_conferences >= 999
              const unlimitedReg =
                plan.max_registrations_per_conference == null ||
                plan.max_registrations_per_conference >= 999999
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm ${
                    highlighted
                      ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-lg'
                      : 'border-gray-200'
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold">
                      {t('mostPopular')}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  {plan.description && (
                    <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                  )}
                  <div className="mt-6">
                    <span className="text-4xl font-black text-gray-900">
                      {formatPrice(price, plan.currency)}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {cycle === 'monthly' ? t('perMonth') : t('perYear')}
                    </span>
                  </div>
                  {cycle === 'yearly' && (
                    <p className="mt-1 text-xs text-gray-400">{t('billedYearly')}</p>
                  )}

                  <ul className="mt-6 space-y-3 flex-1">
                    <li className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>
                        {unlimitedConf
                          ? t('conferencesUnlimited')
                          : `${plan.max_conferences} ${t('conferences')}`}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>
                        {unlimitedReg
                          ? t('registrationsUnlimited')
                          : `${plan.max_registrations_per_conference} ${t('registrationsPerConference')}`}
                      </span>
                    </li>
                    {plan.max_storage_gb != null && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>{t('storage', { gb: plan.max_storage_gb })}</span>
                      </li>
                    )}
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/subscribe?plan=${plan.slug}&cycle=${cycle}`}
                    className={`mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors ${
                      highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {t('choosePlan')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default function Home() {
  const tHero = useTranslations('home.hero')
  const tFeatures = useTranslations('home.features')
  const tFormats = useTranslations('home.formats')
  const tContact = useTranslations('home.contact')
  const tFaq = useTranslations('home.faq')
  const tCta = useTranslations('home.cta')

  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center bg-gradient-to-br from-slate-800 via-blue-900 to-purple-900 text-white overflow-hidden">
        {/* Geometric pattern background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          {/* Decorative icons/shapes */}
          <div className="absolute top-20 left-[10%] w-16 h-16 text-blue-400/20">
            <Calendar className="w-full h-full" />
          </div>
          <div className="absolute top-40 right-[15%] w-20 h-20 text-purple-400/20">
            <Users className="w-full h-full" />
          </div>
          <div className="absolute bottom-32 left-[20%] w-14 h-14 text-cyan-400/20">
            <FileText className="w-full h-full" />
          </div>
          <div className="absolute bottom-40 right-[25%] w-12 h-12 text-violet-400/20">
            <TrendingUp className="w-full h-full" />
          </div>
          
          {/* Gradient orbs */}
          <div className="absolute top-1/4 left-[5%] w-64 h-64 bg-blue-500/10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-[5%] w-80 h-80 bg-purple-500/10 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 w-full">
          <div className="max-w-4xl mx-auto">
            {/* Content - Centered */}
            <div className="text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-blue-500/10 backdrop-blur-sm rounded-full border border-blue-400/20">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-blue-200">{tHero('badge')}</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-[1.1]">
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
                  {tHero('titleLine1')}
                </span>
                <span className="block text-white">
                  {tHero('titleLine2')}
                </span>
              </h1>

              {/* Subheading */}
              <p className="text-lg md:text-xl mb-12 text-slate-300 leading-relaxed max-w-2xl mx-auto">
                {tHero('subtitle')}
              </p>

              {/* Features list - 5 columns on larger screens */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-slate-800/40 border-2 border-white/20 shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-green-500/30 flex items-center justify-center border-2 border-green-400/50">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <span className="text-white font-semibold text-base text-center">{tHero('easyRegistration')}</span>
                </div>
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-slate-800/40 border-2 border-white/20 shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center border-2 border-blue-400/50">
                    <Zap className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-white font-semibold text-base text-center">{tHero('securePayments')}</span>
                </div>
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-slate-800/40 border-2 border-white/20 shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-violet-500/30 flex items-center justify-center border-2 border-violet-400/50">
                    <FileText className="w-6 h-6 text-violet-400" />
                  </div>
                  <span className="text-white font-semibold text-base text-center">{tHero('abstractHub')}</span>
                </div>
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-slate-800/40 border-2 border-white/20 shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-purple-500/30 flex items-center justify-center border-2 border-purple-400/50">
                    <BarChart3 className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-white font-semibold text-base text-center">{tHero('realTimeAnalytics')}</span>
                </div>
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-slate-800/40 border-2 border-white/20 shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/30 flex items-center justify-center border-2 border-indigo-400/50">
                    <Monitor className="w-6 h-6 text-indigo-400" />
                  </div>
                  <span className="text-white font-semibold text-base text-center">{tHero('customWebsites')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <div className="inline-block mb-4 px-6 py-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
              <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {tFeatures('powerfulFeatures')}
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6">
              {tFeatures('everythingYouNeed')}
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {tFeatures('allInOnePlace')}
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              {tFeatures('streamlineDesc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Registration + Payment */}
            <div className="group relative p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-blue-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full -mr-20 -mt-20 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFeatures('smartRegistration')}</h3>
                <p className="text-gray-600 leading-relaxed mb-6 text-base">
                  {tFeatures('smartRegistrationDesc')}
                </p>
                <Link href="/features#smart-registration" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 transition-all text-sm">
                  {tFeatures('learnMore')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Abstract Management */}
            <div className="group relative p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-purple-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full -mr-20 -mt-20 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFeatures('abstractHub')}</h3>
                <p className="text-gray-600 leading-relaxed mb-6 text-base">
                  {tFeatures('abstractHubDesc')}
                </p>
                <Link href="/features#abstract-hub" className="inline-flex items-center gap-2 text-purple-600 font-bold hover:text-purple-700 transition-all text-sm">
                  {tFeatures('learnMore')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Event Management */}
            <div className="group relative p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-green-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-500 to-green-600 rounded-full -mr-20 -mt-20 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 via-green-600 to-teal-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <BarChart3 className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFeatures('organizerDashboard')}</h3>
                <p className="text-gray-600 leading-relaxed mb-6 text-base">
                  {tFeatures('organizerDashboardDesc')}
                </p>
                <Link href="/features#organizer-dashboard" className="inline-flex items-center gap-2 text-green-600 font-bold hover:text-green-700 transition-all text-sm">
                  {tFeatures('learnMore')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Conference Websites */}
            <div className="group relative p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-indigo-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full -mr-20 -mt-20 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <Monitor className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFeatures('conferenceWebsites')}</h3>
                <p className="text-gray-600 leading-relaxed mb-6 text-base">
                  {tFeatures('conferenceWebsitesDesc')}
                </p>
                <Link href="/features#conference-websites" className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-all text-sm">
                  {tFeatures('learnMore')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* Contact Us Section */}
      <section id="contact" className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Project Discussion Section */}
          <div className="relative rounded-2xl p-8 md:p-12 mb-12 shadow-2xl overflow-hidden">
            {/* Gradient Background like Hero Section */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.3),transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.3),transparent_50%)]"></div>
            
            <div className="relative text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {tContact('talkAboutProject')}
              </h2>
              <p className="text-lg text-slate-300 max-w-2xl mx-auto">
                {tContact('talkAboutProjectIntro')}
              </p>
            </div>
          </div>

          {/* Contact Us Box with Title and Form */}
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-2xl border-2 border-blue-200/50">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left Side - Contact Us Title and Description */}
              <div>
                <h1 className="text-4xl md:text-5xl font-black mb-6">
                  <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
                    {tContact('contactUs')}
                  </span>
                </h1>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  {tContact('contactIntro')}
                </p>
                <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{tContact('getQuote')}</h2>
                  <p className="text-gray-700">
                    {tContact('getQuoteIntro')}
                  </p>
                </div>
              </div>

              {/* Right Side - Contact Form */}
              <div>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conference Types Section */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-6 py-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full">
              <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {tFormats('flexibleFormats')}
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6">
              {tFormats('supportAnyPrefix')}
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {tFormats('supportAnyFormat')}
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              {tFormats('fromVirtualToInPerson')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Virtual Conference */}
            <div className="group relative p-8 rounded-3xl bg-white border-2 border-gray-100 hover:border-indigo-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full -mr-16 -mt-16 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFormats('virtualConference')}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {tFormats('virtualDesc')}
                </p>
              </div>
            </div>

            {/* Hybrid Conference */}
            <div className="group relative p-8 rounded-3xl bg-white border-2 border-gray-100 hover:border-blue-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full -mr-16 -mt-16 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <GitMerge className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFormats('hybridConference')}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {tFormats('hybridDesc')}
                </p>
              </div>
            </div>

            {/* On-site Conference */}
            <div className="group relative p-8 rounded-3xl bg-white border-2 border-gray-100 hover:border-green-300 hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full -mr-16 -mt-16 opacity-10 blur-2xl"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{tFormats('onsiteConference')}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {tFormats('onsiteDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-6 py-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
              <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {tFaq('faqTitle')}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
              {tFaq('gotQuestions')}
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {tFaq('weGotAnswers')}
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'q1', a: 'a1' },
              { q: 'q2', a: 'a2' },
              { q: 'q3', a: 'a3' },
              { q: 'q4', a: 'a4' },
              { q: 'q5', a: 'a5' },
              { q: 'q6', a: 'a6' },
            ].map((faq, index) => (
              <details
                key={index}
                className="group bg-white border-2 border-gray-100 rounded-xl p-6 hover:border-blue-300 transition-all duration-300"
              >
                <summary className="cursor-pointer font-bold text-gray-900 text-lg flex items-center justify-between">
                  <span>{tFaq(faq.q)}</span>
                  <span className="text-blue-600 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-gray-600 leading-relaxed">{tFaq(faq.a)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative py-24 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 text-white overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
          <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-500/20 rounded-full filter blur-3xl"></div>
          <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple-500/20 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            <span className="text-sm font-semibold text-blue-200">{tCta('readyToGetStarted')}</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            {tCta('startManaging')}
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {tCta('conferenceToday')}
            </span>
          </h2>
          
          <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            {tCta('joinOrganizers')}
          </p>

          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl transition-all"
          >
            {tCta('welcome')}
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      <Footer />
    </main>
  )
}
