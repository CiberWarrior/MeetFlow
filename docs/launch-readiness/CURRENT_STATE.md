# MeetFlow — trenutno stanje

Datum: 7. studenog 2026. Analiza je samo čitanje. Produkcijski dashboardi nisu otvarani.

Oznake: VERIFIED IN CODE, VERIFIED BY EXECUTED TEST, DOCUMENTED ONLY, UNKNOWN, NOT APPLICABLE.

## Arhitektura

Jedna Next.js 14 App Router aplikacija (TypeScript, Tailwind) na Vercelu. Baza je Supabase Postgres. VERIFIED IN CODE: `package.json`, `vercel.json`, `lib/supabase-admin.ts`.

Zaključane verzije u `package-lock.json`, pročitane lokalno: Next.js 14.2.33, React 18.3.1, TypeScript 5.9.3, Supabase JS 2.84.0, Supabase SSR 0.8.0, Jest 30.2.0, Stripe 14.25.0. To nisu verzije produkcijskog deploya. Produkcijski deploy: UNKNOWN.

Preglednik koristi anonimni Supabase klijent. Pisanje registracija, sažetaka i kontakata ide kroz `lib/supabase-admin.ts` (reci 1–27). Modul je `server-only` i koristi service-role ključ. Taj ključ zaobilazi RLS.

Middleware (`middleware.ts`, reci 149–153) štiti stranice `/admin` i `/participant/dashboard`. API rute su izuzete. Svaka API ruta mora se štititi sama.

## Inventar, prebrojan 7. 11. 2026.

| Stavka | Broj | Oznaka |
| --- | --- | --- |
| Stranice `app/**/page.tsx` | 45 | VERIFIED IN CODE |
| API rute `app/api/**/route.ts` | 76 | VERIFIED IN CODE |
| Testne datoteke `__tests__` | 22 | VERIFIED IN CODE |
| Migracijske datoteke | 62 | VERIFIED IN CODE |

Numeracija migracija ide do `066`. Nema datoteka `034`, `047`, `048` i `049`.

U `package.json` nema GitHub Actions mape `.github/workflows` i nema `@sentry`. VERIFIED IN CODE. Produkcijski Vercel logovi mogu postojati, ali nisu pregledani. UNKNOWN.

## Uloge i tokovi

| Tko | Prijava | Što radi | Oznaka |
| --- | --- | --- | --- |
| Super admin | `/auth/admin-login` | cijela platforma, kreiranje konferencije | VERIFIED IN CODE |
| Conference admin | isti login | samo dodijeljene konferencije | VERIFIED IN CODE |
| Sudionik | ne, za osnovni tijek | registracija, sažetak, e-mail | VERIFIED IN CODE |
| Portal `/participant` | da | opcioni sloj, nije jezgra | VERIFIED IN CODE |

Kreiranje konferencije traži super admina: `app/api/admin/conferences/route.ts`, redak 104. VERIFIED IN CODE.

Ako je iznos kotizacije i dodataka 0 ili manji, status plaćanja je `not_required`. VERIFIED IN CODE: `app/api/register/route.ts`, reci 332–367.

## Glavne tablice

Iz migracija i handoffa, ne iz produkcijskog popisa: `conferences`, `registrations`, `custom_registration_fees`, `abstracts`, `user_profiles`, `conference_permissions`, `contact_inquiries`, `payment_history`, `conference_pages`, `subscriptions` / `subscription_orders`, `platform_settings`, `registration_manage_tokens`, `abstract_reviewers`, `abstract_reviews`.

Odnos koji drži tenant: većina poslovnih redova ima `conference_id`. Dozvole admina su u `conference_permissions`. Produkcijski popis tablica: UNKNOWN.

## Novac, dva toka

1. Kotizacija sudionika. API odbija `pay_now_card` i upisuje `bank_transfer` / `pending`. VERIFIED IN CODE: `app/api/register/route.ts`, reci 369–376. Sučelje drži samo virman: `components/RegistrationForm.tsx`, redak 109. IBAN se čita iz profila vlasnika (`bank_account_number`), oko redaka 491–498.
2. Pretplata organizatora. Stripe Checkout i webhook. VERIFIED IN CODE: `app/api/stripe-webhook/route.ts`.

`create-payment-intent` i `confirm-payment` i dalje postoje. Nova registracija do njih ne dolazi jer je kartica odbijena ranije. Stripe način (test ili live) na produkciji: UNKNOWN.

Ručna potvrda virmana ne šalje e-mail sudioniku. VERIFIED IN CODE: `app/api/admin/registrations/[id]/confirm-bank-payment/route.ts`, reci 10–13.

## Vanjski servisi

Imena varijabli, bez vrijednosti: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`.

Jesu li postavljene na Vercelu: UNKNOWN.

`vercel.json` definira cron `GET /api/cron/payment-reminders` u `0 9 * * *`, regija `iad1`. Ruta traži `Authorization: Bearer CRON_SECRET`. VERIFIED IN CODE.

Rate limit se gasi ako Upstash nije konfiguriran (fail-open). VERIFIED IN CODE: `lib/rate-limit.ts`, reci 1–8.

## Git

Lokalno provjereno 7. 11. 2026. oko 12:49:

- `HEAD` i `origin/main`: `ff324ab0657fdbdaf2788d6c95a4b7a66baa5d26`
- poruka: `docs: add the 7 November product and git status snapshot`
- datum: 2026-11-07 12:43:47 +0100
- grana nije ispred ni iza `origin/main`
- remote: `git@github.com:CiberWarrior/MeetFlow.git`

Sedam commitova koji su ranije bili samo lokalni (`068e433` do `9f00274`) sad su na `origin/main`. Iznad njih je dokumentacijski `ff324ab`.

Nije commitano: izmjene u `docs/00_ACTIVE/MEETFLOW_PREGLED_2026-11-07.md` i `docs/AI_HANDOFF.md`, plus `supabase/.temp/`. Te izmjene bilježe prijavu da je migracija `066` prošla. `supabase/.temp/` ne ide u commit.

## Baza i deploy

`supabase/config.toml` ima `id = "your-project-id"` i Postgres 15. VERIFIED IN CODE. CLI nije dokazano povezan. DOCUMENTED ONLY u handoffu.

`064` je commitana i prema handoffu ručno primijenjena. Ne pokretati ponovno. DOCUMENTED ONLY za produkcijski učinak, uz raniju provjeru opisanu u handoffu od 6. 11.

`065` je u commitu `1c6c87d`. Handoff kaže da je bucket `registration-attachments` u produkciji privatan. DOCUMENTED ONLY u ovom prolazu; ova sesija to nije ponovno čitala.

`066` briše politiku `Anyone can insert contact inquiries` bez `IF EXISTS`. VERIFIED IN CODE. Izvršenje: DOCUMENTED ONLY (tvoja prijava 7. 11.). Politike nisu ponovno pročitane.

Shema `supabase_migrations` postoji, tablica `schema_migrations` ne. DOCUMENTED ONLY. Zato se `supabase db push` i `migration repair` ne smiju pokretati.

Produkcijski URL iz dokumentacije: https://meetflow-conference.vercel.app. Je li na njemu `ff324ab`: UNKNOWN.

## Što ova analiza nije radila

Nisu pokretani testovi, lint, build, e-mail, webhook, SQL ni deploy. `.env` datoteke nisu otvarane. Preglednik nije korišten.
