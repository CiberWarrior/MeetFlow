# MeetFlow — P0 production RLS hardening: deployment runbook

**Target:** Supabase project `eceiqrhvtxieoqjyvntf` (MeetFlow).  
**Branch:** `security/production-rls-hardening-2026-11`.  
**State:** REVIEW ONLY. No SQL has been executed against production as part of this branch.  
**Candidate SQL:** `docs/sql/MEETFLOW_P0_SECURITY_PATCH_REVIEW.sql`.

## Confirmed production findings (2026-11-06)

- Five `public` tables have RLS disabled with anon/authenticated table grants: `conference_permissions`, `conference_pages`, `payment_history`, `payment_reminders`, `supported_currencies`.
- Two participant SELECT policies are not conference-scoped.
- `registrations.email` has a global UNIQUE constraint, contrary to cross-conference registration behavior.
- `user_profiles` permits users to insert/update their own row, with sensitive `role` and `active` columns in that table. Privilege escalation is possible when broad column grants remain.
- Participant-owned profiles/registrations have broad UPDATE permissions that include loyalty, payment and attendance fields.
- Two SECURITY DEFINER views and four anonymously executable SECURITY DEFINER RPCs were identified by Supabase Security Advisor.
- The `registration-attachments` bucket is already **private**; do not reapply the old public bucket migration.
- Supabase migration history reported empty; reconcile existing schema with local migration files before making this a deployable migration.
- The dashboard showed **no backups** on the Free project. This blocks production deployment until a tested recoverable backup exists.

## Preconditions — mandatory

1. Obtain a complete, encrypted database backup including schema and data using supported Supabase/pg_dump tools, **outside this repo**. Verify that it can be restored to a separate database. Include relevant Storage objects in a separate backup plan; a database dump alone does not copy object contents. Do not commit credentials, exports or personal data to Git.
2. Confirm the exact application commit and deployment target. Stop or serialize writes if necessary for consistent backup/deployment.
3. Reproduce production schema on an isolated staging database. Do not use a new blank branch created solely from the currently empty migration history.
4. Run SQL candidate on staging in one transaction and execute the role matrix below.
5. Run `npm run lint`, `npm test -- --runInBand`, `npm run build` from a locally checked-out branch, plus end-to-end tests. No tests have been run yet from this connector session.
6. Confirm banking/Stripe webhook, bank confirmation and refund paths, participant registration/cancellation, admin invitation, CMS publishing, self-service profile updates, and organizer permissions on staging.

## Authorization test matrix

| Persona | Expected |
|---|---|
| anonymous | No SELECT/INSERT/UPDATE on `conference_permissions`, `payment_history`, `payment_reminders`; only published active `conference_pages`; `supported_currencies` read-only |
| participant | Read own participant profile/registrations; update only safe contact/profile fields; cannot edit payment, loyalty, attendance, or other participant/conference rows |
| conference organizer A | Read only conference A participant registrations; shared participant profile only if registered in A; no access to B-only participant profiles or registrations |
| organizer A without payment permission | Cannot access financial history; cannot grant own conference permissions |
| organizer A with payment permission | Read conference A financial history; ledger writes require authorized application server |
| super_admin | Read/manage authorized admin resources without relying on unscoped public grants |
| service_role server process | Existing webhook, registration, bank confirmation, refund and onboarding flows still work |
| logged-in non-admin | Cannot change own `user_profiles.role`, `active`, or insert an elevated profile |
| public CMS visitor | Can read published content for a published active conference; draft pages not visible |
| same email, two conferences | Registration allowed when in different conferences; duplicate in same conference rejected |

## Useful SQL checks after staging deployment (SELECT only)

```sql
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('conference_pages','conference_permissions',
                    'payment_history','payment_reminders','supported_currencies')
ORDER BY c.relname;

SELECT has_table_privilege('anon', 'public.conference_permissions', 'SELECT') AS anon_permissions_select,
       has_table_privilege('anon', 'public.payment_history', 'SELECT') AS anon_history_select,
       has_table_privilege('authenticated', 'public.payment_history', 'UPDATE') AS user_history_update,
       has_column_privilege('authenticated', 'public.user_profiles', 'role', 'UPDATE') AS user_can_change_role,
       has_column_privilege('authenticated', 'public.participant_registrations', 'amount_paid', 'UPDATE') AS participant_can_change_amount;

SELECT tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('participant_profiles','participant_registrations',
                    'user_profiles','conference_permissions')
ORDER BY tablename, policyname;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid='public.registrations'::regclass AND contype='u';

SELECT indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='registrations'
  AND indexname='mf_registrations_conference_email_unique';
```

**Important:** PostgreSQL table/column rights and RLS must both be tested; checking a table's RLS flag alone is insufficient. Real role tests should use controlled test identities, not production customer accounts.

## Deployment and recovery

- First deploy application changes and the database change as a coordinated, tested release; the new policy and service-role routes depend on one another.
- The candidate SQL is in `docs/sql`, not in active `supabase/migrations` intentionally. Reconcile migration baseline, then generate a proper dated migration using the Supabase CLI.
- Run Supabase Security Advisor again after migration; expect remaining findings to be assessed rather than silently ignored.
- Monitor auth failures, registration inserts, payment history writes, Stripe webhook failures, admin page editing, and participant cancellation.
- If regressions occur, **do not automatically disable RLS** to restore the old insecure state. Prefer a corrective forward migration. A database restore is a last-resort decision coordinated with data consistency and live payment events.
- Separately schedule remediation of password-in-email onboarding, idempotent payment transitions, broad `registrations`/`abstracts` mutation policies and additional function `search_path` warnings. These are **not fixed** by this patch.

## No-production-write statement

No SQL patch was applied to the production database during preparation. Neither the release nor the full end-to-end test matrix is complete.
