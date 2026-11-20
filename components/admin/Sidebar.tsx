'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useAuth } from '@/contexts/AuthContext'
import { useConference } from '@/contexts/ConferenceContext'
import { supabase } from '@/lib/supabase'

interface NavItem {
  name: string
  sidebarKey: string
  href: string
  icon: React.ReactNode
  superAdminOnly?: boolean
  requiresPermission?: string
  requiresAnyPermission?: string[]
}

interface NavSection {
  titleKey?: string
  items: NavItem[]
  superAdminOnly?: boolean
}

// Two logical groups only:
// 1. "Platform" – super admin's own business (all conferences, users, billing of the platform itself)
// 2. "This Conference" – tools scoped to whichever conference is currently selected
const navigationSections: NavSection[] = [
  {
    items: [
      {
        name: 'Dashboard',
        sidebarKey: 'dashboard',
        href: '/admin/dashboard', // overridden per role in render
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  {
    titleKey: 'platformSection',
    superAdminOnly: true,
    items: [
      {
        name: 'All Conferences',
        sidebarKey: 'allConferencesManage',
        href: '/admin/conferences',
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        name: 'Users',
        sidebarKey: 'users',
        href: '/admin/users',
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        name: 'Participants',
        sidebarKey: 'participants',
        href: '/admin/participants',
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        name: 'Inquiries',
        sidebarKey: 'inquiries',
        href: '/admin/inquiries',
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        name: 'Platform Subscriptions',
        sidebarKey: 'subscriptions',
        href: '/admin/subscriptions',
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" />
          </svg>
        ),
      },
      {
        name: 'Plans & Pricing',
        sidebarKey: 'plans',
        href: '/admin/plans',
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
      },
    ],
  },
  {
    titleKey: 'conferenceSection',
    items: [
      {
        name: 'Conference Overview',
        sidebarKey: 'conferenceOverview',
        href: '/admin/dashboard?view=single',
        superAdminOnly: true, // conference admins already have "Dashboard" above pointing here
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        name: 'Registrations',
        sidebarKey: 'registrations',
        href: '/admin/registrations',
        requiresPermission: 'can_view_registrations',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        name: 'Abstract Submission',
        sidebarKey: 'abstractSubmission',
        href: '/admin/abstracts',
        requiresPermission: 'can_manage_abstracts',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        ),
      },
      {
        name: 'Program',
        sidebarKey: 'program',
        href: '/admin/program',
        requiresPermission: 'can_edit_conference',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        name: 'Registration Payments',
        sidebarKey: 'payments',
        href: '/admin/payments',
        requiresPermission: 'can_manage_payments',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        name: 'Check-In',
        sidebarKey: 'checkIn',
        href: '/admin/checkin',
        requiresPermission: 'can_check_in',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        name: 'Certificates',
        sidebarKey: 'certificates',
        href: '/admin/certificates',
        requiresPermission: 'can_generate_certificates',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        ),
      },
      {
        name: 'Tickets',
        sidebarKey: 'tickets',
        href: '/admin/tickets',
        requiresAnyPermission: ['can_view_registrations', 'can_manage_abstracts'],
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        ),
      },
      {
        name: 'Conference Settings',
        sidebarKey: 'conferenceSettings',
        href: '/admin/conferences', // overridden with conference id in render
        requiresAnyPermission: ['can_edit_conference', 'can_manage_abstracts'],
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const t = useTranslations('admin.sidebar')
  const [mounted, setMounted] = useState(false)
  const { isSuperAdmin, isImpersonating, role, loading: authLoading, profile } = useAuth()
  const { currentConference } = useConference()
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({})
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

  // While impersonating, the sidebar should behave exactly like the impersonated
  // conference admin sees it – not like the underlying super admin account.
  const effectiveSuperAdmin = isSuperAdmin && !isImpersonating

  useEffect(() => {
    setMounted(true)
    if (!profile || profile.role !== 'conference_admin' || !currentConference?.id) {
      setUserPermissions({})
      setPermissionsLoaded(profile?.role !== 'conference_admin')
      return
    }

    let cancelled = false
    setPermissionsLoaded(false)
    supabase
      .from('conference_permissions')
      .select('can_view_registrations, can_export_data, can_manage_payments, can_manage_abstracts, can_check_in, can_generate_certificates, can_edit_conference, can_manage_registration_form, can_view_analytics')
      .eq('user_id', profile.id)
      .eq('conference_id', currentConference.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setUserPermissions((data || {}) as Record<string, boolean>)
        setPermissionsLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [profile, currentConference?.id])

  // Different sidebar colors based on role
  const sidebarBgColor = isSuperAdmin 
    ? 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900' 
    : 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900'
  const sidebarBorderColor = isSuperAdmin 
    ? 'border-gray-700' 
    : 'border-slate-700'

  // Prevent hydration mismatch by not rendering active state until mounted
  const getIsActive = (href: string, sidebarKey?: string) => {
    if (!mounted || !pathname) return false
    if (sidebarKey === 'dashboard' && pathname === '/admin/dashboard') return true
    return pathname === href || (href !== '/admin' && href !== '/admin/dashboard' && pathname.startsWith(href))
  }

  // Resolve dynamic hrefs / labels that depend on role or the currently selected conference
  const resolveHref = (item: NavItem): string => {
    if (item.sidebarKey === 'dashboard') {
      return effectiveSuperAdmin ? '/admin/dashboard?view=platform' : '/admin/dashboard'
    }
    if (item.sidebarKey === 'conferenceSettings' && currentConference) {
      return `/admin/conferences/${currentConference.id}/settings`
    }
    return item.href
  }

  // Filter sections based on user role and whether a conference is currently in scope
  const getFilteredSections = () => {
    if (authLoading) return []

    return navigationSections
      .filter((section) => {
        if (section.superAdminOnly && !effectiveSuperAdmin) return false
        // "This Conference" tools only make sense once a conference is in scope.
        // Conference admins are always scoped to a conference; super admins need to pick one first.
        if (section.titleKey === 'conferenceSection' && effectiveSuperAdmin && !currentConference) {
          return false
        }
        return true
      })
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.superAdminOnly && !effectiveSuperAdmin) return false
          if (item.sidebarKey === 'conferenceSettings' && !currentConference) return false
          if (item.requiresPermission || item.requiresAnyPermission) {
            if (effectiveSuperAdmin) return true
            if (!permissionsLoaded) return false
            if (item.requiresAnyPermission) {
              return item.requiresAnyPermission.some((key) => userPermissions[key] === true)
            }
            return userPermissions[item.requiresPermission || ''] === true
          }
          return true
        }),
      }))
      .filter((section) => section.items.length > 0)
  }

  const navContent = (
    <>
          <div className="flex items-center flex-shrink-0 px-4 mb-8 justify-between">
            <Link href="/admin/dashboard" className="flex items-center" onClick={onClose}>
              <div className={`w-8 h-8 ${isSuperAdmin ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'} rounded-lg flex items-center justify-center mr-3 shadow-lg`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">MeetFlow</span>
            </Link>
            {onClose && (
              <button
                type="button"
                className="md:hidden text-gray-300 hover:text-white p-2"
                onClick={onClose}
                aria-label={t('closeMenu')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex-1 flex flex-col">
            {authLoading ? (
              <div className="flex-1 px-2 py-4 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
              </div>
            ) : (
            <nav className="flex-1 px-2 space-y-3">
              {getFilteredSections().map((section, sectionIdx) => (
                <div key={sectionIdx}>
                  {section.titleKey && (
                    <div className="px-3 mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t(section.titleKey)}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const href = resolveHref(item)
                      const isActive = getIsActive(href, item.sidebarKey)
                      const activeBgColor = isSuperAdmin
                        ? 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                        : 'bg-gradient-to-r from-slate-700 to-slate-600'
                      const hoverBgColor = isSuperAdmin
                        ? 'hover:bg-gray-800'
                        : 'hover:bg-slate-800'
                      return (
                        <Link
                          key={item.sidebarKey}
                          href={href}
                          onClick={onClose}
                          className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                            isActive
                              ? `${activeBgColor} text-white shadow-lg`
                              : `text-gray-300 ${hoverBgColor} hover:text-white`
                          }`}
                        >
                          <span className={`mr-3 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                            {item.icon}
                          </span>
                          {t(item.sidebarKey)}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
            )}
            
            {!authLoading && role && (
              <div className={`px-4 py-3 border-t ${isSuperAdmin ? 'border-gray-700' : 'border-slate-700'}`}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  isSuperAdmin 
                    ? 'bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 border border-yellow-500/30' 
                    : 'bg-gradient-to-r from-slate-700/30 to-slate-600/30 border border-slate-500/40'
                }`}>
                  <div className={`w-3 h-3 rounded-full ${
                    role === 'super_admin' ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : 'bg-slate-400 shadow-lg shadow-slate-400/50'
                  }`}></div>
                  <span className={`text-xs font-bold ${
                    role === 'super_admin' ? 'text-yellow-300' : 'text-slate-300'
                  }`}>
                    {role === 'super_admin' ? t('superAdmin') : t('conferenceAdmin')}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col gap-3 border-t border-gray-800 p-4">
            <div className="flex justify-center">
              <LanguageSwitcher />
            </div>
            <Link
              href="/"
              target="_blank"
              className="flex-shrink-0 w-full group block"
            >
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                    {t('homepage')}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </Link>
          </div>
    </>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className={`dark-sidebar flex flex-col flex-grow pt-5 pb-4 overflow-y-auto h-full ${sidebarBgColor} border-r ${sidebarBorderColor}`}>
            {navContent}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t('closeMenu')}
            onClick={onClose}
          />
          <div className={`relative z-10 flex flex-col w-72 max-w-[85vw] h-full pt-5 pb-4 overflow-y-auto ${sidebarBgColor} border-r ${sidebarBorderColor} shadow-xl`}>
            {navContent}
          </div>
        </div>
      )}
    </>
  )
}
