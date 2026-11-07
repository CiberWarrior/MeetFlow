# MeetFlow – Documentation Index

**Stack:** Next.js 14 (App Router) · TypeScript · Supabase (PostgreSQL + Auth) · Stripe · Vercel

---

## 00_ACTIVE — Start here for day-to-day work

| File | Purpose |
|------|---------|
| [PROJECT_CONTEXT.md](00_ACTIVE/PROJECT_CONTEXT.md) | Canonical project rules, domain terms, non-negotiable decisions |
| [MEETFLOW_PREGLED_2026-11-07.md](00_ACTIVE/MEETFLOW_PREGLED_2026-11-07.md) | Status snapshot for sharing: product, architecture, and recent git |
| [DEPLOYMENT_CHECKLIST.md](00_ACTIVE/DEPLOYMENT_CHECKLIST.md) | Production deploy checklist (Vercel + Supabase + Stripe + env vars) |
| [FINISH_AND_TEST_CHECKLIST.md](00_ACTIVE/FINISH_AND_TEST_CHECKLIST.md) | Pre-release checklist: lint, tests, manual flows |
| [LOCALHOST_TESTING_CHECKLIST.md](00_ACTIVE/LOCALHOST_TESTING_CHECKLIST.md) | Local dev testing scenarios |

---

## 01_REFERENCE — Feature guides and system docs

### Authentication & Users
| File | Purpose |
|------|---------|
| [ADMIN_ACCESS.md](01_REFERENCE/ADMIN_ACCESS.md) | How to access `/admin`, login URLs |
| [USER_MANAGEMENT_GUIDE.md](01_REFERENCE/USER_MANAGEMENT_GUIDE.md) | Super admin vs conference admin, adding users |
| [GDE_NACI_SUPABASE_KLJUCEVE.md](01_REFERENCE/GDE_NACI_SUPABASE_KLJUCEVE.md) | Where to find Supabase Project URL and API keys |

### Registration & Payments
| File | Purpose |
|------|---------|
| [CUSTOM_REGISTRATION_FEE_DESIGN.md](01_REFERENCE/CUSTOM_REGISTRATION_FEE_DESIGN.md) | `custom_registration_fees` table, APIs, pricing model |
| [REGISTRATION_FORM_FIELDS_GUIDE.md](01_REFERENCE/REGISTRATION_FORM_FIELDS_GUIDE.md) | Form builder field types |
| [PAYMENT_OPTIONS_GUIDE.md](01_REFERENCE/PAYMENT_OPTIONS_GUIDE.md) | Pay now vs pay later, Stripe vs bank transfer |
| [PAYMENT_OPTIONS_VISUALIZATION.md](01_REFERENCE/PAYMENT_OPTIONS_VISUALIZATION.md) | Visual reference for payment UX options |
| [PAYMENT_SETTINGS_IMPLEMENTATION.md](01_REFERENCE/PAYMENT_SETTINGS_IMPLEMENTATION.md) | Conference-level `PaymentSettings` type |
| [PAYMENT_AND_TERMS_FIELDS_GUIDE.md](01_REFERENCE/PAYMENT_AND_TERMS_FIELDS_GUIDE.md) | Payer type and legal checkbox fields in form builder |
| [PAYMENT_TERMS_QUICK_SETUP.md](01_REFERENCE/PAYMENT_TERMS_QUICK_SETUP.md) | Quick copy-paste for payment/terms fields |
| [MULTI_CURRENCY_AND_BANK_TRANSFER_GUIDE.md](01_REFERENCE/MULTI_CURRENCY_AND_BANK_TRANSFER_GUIDE.md) | International payments and bank transfer handling |
| [MULTIPLE_PARTICIPANTS_FEATURE.md](01_REFERENCE/MULTIPLE_PARTICIPANTS_FEATURE.md) | Multi-attendee registration (migration 026) |
| [MULTIPLE_PARTICIPANTS_SUMMARY.md](01_REFERENCE/MULTIPLE_PARTICIPANTS_SUMMARY.md) | Short summary of multi-attendee feature |

### Participant System
| File | Purpose |
|------|---------|
| [PARTICIPANT_ACCOUNT_SYSTEM.md](01_REFERENCE/PARTICIPANT_ACCOUNT_SYSTEM.md) | Schema and flows for participant profiles/loyalty |
| [PARTICIPANT_SYSTEM_QUICK_START.md](01_REFERENCE/PARTICIPANT_SYSTEM_QUICK_START.md) | Migration 035 steps for participant system |
| [EMAIL_BASED_LINKING.md](01_REFERENCE/EMAIL_BASED_LINKING.md) | Email-as-identifier pattern for linking participants |
| [ABSTRACT_REGISTRATION_LINKING.md](01_REFERENCE/ABSTRACT_REGISTRATION_LINKING.md) | Linking abstracts to registrations via corresponding author email |
| [ENHANCED_REGISTRATION_UX.md](01_REFERENCE/ENHANCED_REGISTRATION_UX.md) | `ParticipantAuthModal`, guest vs account flows |

### Abstract Submissions
| File | Purpose |
|------|---------|
| [ABSTRACT_FORM_FIELDS.md](01_REFERENCE/ABSTRACT_FORM_FIELDS.md) | Abstract form sections: type, title, content |
| [ABSTRACT_AUTHORS_AND_CUSTOM_FIELDS.md](01_REFERENCE/ABSTRACT_AUTHORS_AND_CUSTOM_FIELDS.md) | Authors array, `AuthorManager`, custom fields |

### Conference Pages & CMS
| File | Purpose |
|------|---------|
| [CUSTOM_PAGES_FEATURES.md](01_REFERENCE/CUSTOM_PAGES_FEATURES.md) | CMS pages: SEO, Tiptap editor, contact, hero |
| [SYMPOSIUM_TRACK_REMOVAL.md](01_REFERENCE/SYMPOSIUM_TRACK_REMOVAL.md) | Migration from hardcoded symposium/track to custom fields |

### Infrastructure & Deployment
| File | Purpose |
|------|---------|
| [VERCEL_DEPLOY.md](01_REFERENCE/VERCEL_DEPLOY.md) | Step-by-step Vercel deploy guide |
| [QUICK_START.md](01_REFERENCE/QUICK_START.md) | Install, env, Supabase, dev server – new developer onboarding |
| [SETUP_INSTRUCTIONS.md](01_REFERENCE/SETUP_INSTRUCTIONS.md) | Contact/inquiry system setup |
| [SUPABASE_EXAMPLE_COM_SETUP.md](01_REFERENCE/SUPABASE_EXAMPLE_COM_SETUP.md) | Supabase SMTP and blocked `example.com` emails |
| [HOSTING_OPTIONS.md](01_REFERENCE/HOSTING_OPTIONS.md) | Upstash vs self-hosted Redis choice |
| [QUICK_SETUP_GUIDE.md](01_REFERENCE/QUICK_SETUP_GUIDE.md) | Upstash + env + rate limiting quick setup |
| [UPSTASH_SETUP.md](01_REFERENCE/UPSTASH_SETUP.md) | Upstash account and Redis env vars |
| [RATE_LIMITING_AND_PERFORMANCE_EXPLAINED.md](01_REFERENCE/RATE_LIMITING_AND_PERFORMANCE_EXPLAINED.md) | Rate limiting and performance concepts |
| [SYSTEM_ARCHITECTURE_SUMMARY.md](01_REFERENCE/SYSTEM_ARCHITECTURE_SUMMARY.md) | End-to-end architecture: admin, participant, tables |

### Stripe & Subscriptions
| File | Purpose |
|------|---------|
| [SUBSCRIPTION_SYSTEM.md](01_REFERENCE/SUBSCRIPTION_SYSTEM.md) | MeetFlow subscription automation, Stripe Payment Links, webhooks |
| [STRIPE_SETUP_LATER.md](01_REFERENCE/STRIPE_SETUP_LATER.md) | Stripe products, env, subscription SQL setup |

### Logging
| File | Purpose |
|------|---------|
| [LOGGING.md](01_REFERENCE/LOGGING.md) | How to use `lib/logger`, masking, environments |
| [LOGGING_BEST_PRACTICES.md](01_REFERENCE/LOGGING_BEST_PRACTICES.md) | Winston migration status and logging patterns |

### QA & Testing
| File | Purpose |
|------|---------|
| [QA_TESTING_CHECKLIST.md](01_REFERENCE/QA_TESTING_CHECKLIST.md) | Full QA matrix pre-production |

---

## sql — Database scripts (dev/staging only)

> **Warning:** These scripts contain hardcoded UUIDs and emails. Never run in production without reviewing first.

| File | Purpose |
|------|---------|
| [CREATE_TEST_USER.sql](sql/CREATE_TEST_USER.sql) | Create a Super Admin test user profile |
| [CREATE_TEST_CONFERENCE_ADMIN.sql](sql/CREATE_TEST_CONFERENCE_ADMIN.sql) | Create a Conference Admin with permissions |
| [SUPABASE_CLEANUP_USER.sql](sql/SUPABASE_CLEANUP_USER.sql) | Clean up FK constraints before deleting a user |
| [SUPABASE_ENSURE_TESTER1_ADMIN.sql](sql/SUPABASE_ENSURE_TESTER1_ADMIN.sql) | Ensure TESTER1 has admin role (hardcoded UUID – dev only) |

---

## 99_ARCHIVE — Historical / superseded (reference only)

These files reflect decisions or states that no longer match the current codebase. Do not rely on them for implementation.

| File | Why archived |
|------|-------------|
| `ABSTRACT_FORM_STYLING.md` | Historical before/after styling notes |
| `ABSTRACT_SUBMISSION_UPGRADE.md` | Planning doc, superseded by current custom fields code |
| `CODE_REVIEW_SUMMARY.md` | Point-in-time PR review (migrations 044/045 era) |
| `DEPLOYMENT_STEPS_DETAILED.md` | Long participant migration walkthrough, superseded by QUICK_START |
| `DEVELOPER_REVIEW_AND_ROADMAP.md` | December 2025 milestone review snapshot |
| `EVENT_ARCHITECTURE_PROPOSAL.md` | Unimplemented proposal: conferences → events (STI) |
| `SYMPOSIUM_TRACK_CONFIGURATION.md` | Superseded by SYMPOSIUM_TRACK_REMOVAL |
| `TESTING_GUIDE.md` | Older testing checklist, superseded by QA_TESTING_CHECKLIST |
| `TROUBLESHOOTING_BUILD_ERRORS.md` | Dev-time Tiptap/module resolution troubleshooting |
| `WEBPACK_CACHE_WARNING.md` | Dev-only webpack cache fix |
