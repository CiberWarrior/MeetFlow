# MeetFlow AI handoff

Snapshot: 2026-11-06 (Europe/Zagreb).
Repository: `/Users/renchi/Documents/Cursor/MeetFlow`.
Latest update: close-out of Security Fix 01 and Security Fix 02. Documentation only. No production connection, SQL, migration command, commit, push, or deployment in this update.

## Verified locally

- `package-lock.json` records Next.js 14.2.33, React 18.3.1, TypeScript 5.9.3, Supabase JS 2.84.0, Supabase SSR 0.8.0, and Jest 30.2.0. These are locked versions, not a claim about the production deployment.
- Next.js App Router hosts public conference pages, a custom admin dashboard, participant pages, and API routes in one application. Tailwind, next-intl, Zod, React Hook Form, Stripe, and Upstash are declared dependencies. `vercel.json` defines deployment configuration and a payment-reminder cron.
- `lib/supabase.ts` provides browser and cookie-based server clients. `lib/supabase-admin.ts` is guarded by `server-only` and creates a service-role client. Middleware guards page access but excludes API routes; API authorization and RLS remain separate responsibilities.
- `app/api/register/route.ts` inserts into `registrations` using `createAdminClient()`. `app/api/conferences/[slug]/submit-abstract/route.ts` uses the same client type for `abstracts`, covering online and document submissions.
- `supabase/migrations/064_drop_public_insert_policies.sql` exists only as an untracked local file. Its transaction drops `Allow public insert` on `public.registrations` and `Allow public insert abstracts` on `public.abstracts`, without `IF EXISTS`. It is not on `origin/main` and must be committed separately.
- `supabase/migrations/065_private_registration_attachments.sql` is committed in `1c6c87d024acf58249ba9315c45e6db13f4d2fbd`. It sets bucket `registration-attachments` to private and drops only `Allow public upload registration attachments` and `Allow public read registration attachments`.
- Existing agent guidance is in `.cursor/rules/project-rules.mdc`; the new root `AGENTS.md` preserves its architecture and behavior constraints and adds explicit approval and evidence rules.

## Git working tree

Local branch: `main`, aligned with `origin/main` at `1c6c87d024acf58249ba9315c45e6db13f4d2fbd` (`fix(security): protect registration attachments`). That commit is the deployed Security Fix 02 code. It does not include migration `064`.

Pre-existing modified tracked files:

```text
app/admin/inquiries/page.tsx
app/api/contact/route.ts
app/page.tsx
lib/email.ts
messages/en.json
messages/hr.json
```

Pre-existing untracked files:

```text
__tests__/api/contact-route.test.ts
__tests__/lib/mobile-phone.test.ts
__tests__/lib/send-generic-email.test.ts
app/quote-form.css
lib/mobile-phone.ts
supabase/.temp/
supabase/migrations/064_drop_public_insert_policies.sql
```

`AGENTS.md` and `docs/AI_HANDOFF.md` remain untracked. Preserve the unrelated contact, email, and phone work. Do not commit `supabase/.temp/` or migration `064` as part of that work. Migration `065` is already in the commit above.

## Current security work and completed changes

Security Fix 01 and Security Fix 02 are closed. Their production security effects were verified. Migration-history reconciliation is a separate blocker and is not complete.

**Security Fix 01, completed.** The public INSERT policies were removed manually in the Supabase SQL Editor, and their absence was verified. Anonymous inserts into `registrations` and `abstracts` were denied. The matching file, migration `064`, remains untracked and must be committed separately. Do not run its SQL again.

**Security Fix 02, completed.** Commit `1c6c87d024acf58249ba9315c45e6db13f4d2fbd` is deployed to production at https://meetflow-conference.vercel.app. Migration `065` was then executed manually in the SQL Editor. Verified production results:

- Bucket `registration-attachments` has `public = false`.
- The two public Storage policies are gone. `Allow service role all registration attachments` remains.
- An authorized download of the existing ICD11-003 attachment succeeded after the bucket was made private.
- An unauthenticated request to the old public object URL returned HTTP 400 and did not return the document.

**Migration history, blocked.** The `supabase_migrations` schema exists, but `supabase_migrations.schema_migrations` does not. The Supabase CLI is not linked. `supabase/config.toml` still has a placeholder project id and Postgres major version 15. Local migration files run from `001` through `065`, with no files for `034`, `047`, `048`, or `049`. Those files are not yet proven to match every change already applied in production. Do not run `supabase db push`, `supabase migration repair`, or another remote migration command until a verified baseline is explicitly approved. Recording only `064` and `065` would leave the earlier files pending, so a later push could execute them.

## Pending validation and known risks

- The closed security fixes do not authorize migration-history repair. A future baseline must identify which local versions are already applied before any history row is inserted.
- Migration `064` must be its own commit. It is not part of `1c6c87d`.
- **User-reported backups:** a public-schema backup and a local source backup exist. Their contents and completeness were not inspected, and complete restoration has not been tested. They are not a verified full disaster-recovery backup.

## Focused local verification — 2026-11-06

**Confirmed locally:**

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: PASS (exit 0); no emitted files or incremental build information.
- `node node_modules/eslint/bin/eslint.js --no-cache app/api/register/route.ts 'app/api/conferences/[slug]/submit-abstract/route.ts' lib/supabase-admin.ts components/RegistrationForm.tsx 'app/conferences/[slug]/submit-abstract/page.tsx'`: PASS (exit 0).
- Existing Jest tests ran with `--runInBand --no-cache --watchman=false --runTestsByPath` for `__tests__/lib/auth-utils.test.ts`, `__tests__/utils/pricing.test.ts`, `__tests__/admin/super-admin-dashboard.test.tsx`, and `__tests__/admin/conference-manager-dashboard.test.tsx`. The process used a clean test environment with dummy values, an OS sandbox denying all network access and repository writes, and temporary cache storage outside the repository.
- Jest result: **63 passed, 4 failed; 2 suites passed, 2 failed; exit 1**. Pricing and auth-helper suites passed. Both dashboard suites failed because their `next/navigation` mocks provide `useRouter` but not `useSearchParams`, which `app/admin/dashboard/page.tsx:157` calls. Tests were not changed or patched at runtime.
- The existing conference-admin dashboard test uses a mock conference (`test-conference`); it does not access the user's real test conference. Auth-helper tests mostly check fixture values/local expressions and do not prove enforcement by actual authorization helpers or RLS.
- Rechecked the two submission routes: both still insert using the server-only service-role client. Migration 064 still contains only the two policy drops in a transaction. This is static evidence, not a successful API submission.

**Environment and blockers:**

- `.env.local` points to a remote Supabase target; no values or credentials were printed. Running the app on localhost would not isolate it from that database.
- No listener was found on the configured local Supabase API/database ports (54321/54322). A usable isolated database was not established, and none was created or migrated.
- Older local documentation mentions `test-conference-2026`, but this is not verified as the user's current test conference. Its URL/slug has been requested; no remote lookup was performed.
- No existing test for direct RLS INSERT denial or the registration/abstract submission API routes was found under `__tests__`. No new test files were created. No production build was run because it would generate working files and could invoke data fetching.

This pass predates the production close-out above. Anonymous INSERT denial was later confirmed. It did not establish migration history.

## Static recheck — 2026-11-06, later pass

No application code, tests, or migration files were changed. Production was not contacted. Migrations were not executed. TypeScript, ESLint, Jest, and the production build were not rerun.

This pass also predates the close-out. Migration `065` now exists and is committed. Migration `064` is still the untracked two-policy drop. Both security fixes have since been verified in production.

## Exactly one recommended next task

Prepare a verified production migration baseline before any future migration. Confirm which local migration versions, from `001` through `065` except the absent `034`, `047`, `048`, and `049`, are already applied. Commit migration `064` separately when that commit is requested. Do not run `supabase db push`, `supabase migration repair`, or another remote migration command, and do not insert history rows, until that baseline is explicitly approved. Security Fix 01 and Security Fix 02 stay closed while this history work remains blocked.
