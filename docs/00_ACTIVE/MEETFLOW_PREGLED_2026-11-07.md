# MeetFlow — pregled aplikacije

Datum: 7. studenog 2026.
Namjena: podijeliti s kolegom što aplikacija radi, kako je složena i do kuda je rad došao.

MeetFlow je multi-tenant platforma za znanstvene i stručne konferencije. Jedna aplikacija pokriva javne stranice konferencije, registraciju i sažetke bez prijave sudionika, te admin za organizatore. Produkcijski URL iz zadnjeg provjerenog zapisa je https://meetflow-conference.vercel.app.

`main` i `origin/main` su na `9f00274` (7. 11. 2026., 11:12). Tih 7 commitova je pushano 7. 11. oko 12:37, i Vercel je taj commit označio kao dovršen deploy. Migracija `066` tim deployem nije izvršena.

## Koncept

MeetFlow nije stranica jedne konferencije. To je platforma na kojoj svaka konferencija živi kao zaseban tenant (`/conferences/[slug]`), s vlastitim formama, kotizacijama, stranicama, sažetcima i uplatama.

Dvije su razine korisnika:

| Tko | Prijava | Što radi |
| --- | --- | --- |
| Super admin | da, `/auth/admin-login` | cijela platforma, korisnici, planovi, upiti, sve konferencije |
| Conference admin | da, isti login | samo konferencije na koje ima ovlasti |
| Sudionik | ne, za osnovni tijek | registracija, sažetak, e-mail potvrda |
| Potencijalni organizator | ne | kontakt / ponuda na naslovnici, pa pretplata |

Sudionik se prepoznaje po e-mailu, ne po korisničkom računu. Isti e-mail veže registraciju i sažetak. Ako je kotizacija 0, tijek plaćanja se preskače.

Postoji i opcioni portal sudionika (`/participant/...`) te pretplatnički model za organizatore (planovi, Stripe, aktivacija računa). Javni tijek konferencije ne ovisi o tome.

Poslovni model platforme: upit na naslovnici, super admin šalje ponudu, organizator plati plan, dobije aktivacijski link i ulazi u admin svoje konferencije. Lozinke se više ne šalju e-mailom.

## Što aplikacija danas radi

### Javno

- Naslovnica s kontaktom / ponudom i dvojezičnim sučeljem (EN / HR).
- Stranica konferencije, CMS stranice (`/p/[pageSlug]`), program.
- Dinamička registracija: polja, kotizacije, smještaj, grupni sudionici, prilozi (npr. dokaz uplate).
- Plaćanje karticom (Stripe) ili virmanom; potvrde i podsjetnici.
- Predaja sažetka (online ili dokument), revizija, „moj sažetak”, predložak.
- Javni program i tokenizirani peer review (`/review/[token]`), bez admin računa recenzenta.
- Self-service link za sudionika (`/conferences/[slug]/manage`).

### Admin

- Dashboard, konferencije i postavke, CMS (TipTap, SEO, hero, vlastiti CSS).
- Registracije, sudionici, uplate, povijest plaćanja, povrati, potvrda virmana, računi.
- Sažeci: status, recenzije, knjiga sažetaka, preuzimanje datoteka.
- Program, QR check-in, bedževi, certifikati (pojedinačno i skupno).
- Korisnici i ovlasti po konferenciji, pretplate i planovi, prihod platforme.
- Upiti (leadovi) i brisanje upita, support ticketi.
- Izvoz (Excel, CSV, JSON).

### Još u kodu, ali nije jezgra proizvoda

Portal sudionika (prijava, profil, događaji, certifikati, loyalty) postoji u kodu. Arhitektura ga tretira kao opcioni sloj. Osnovni sudionik i dalje prolazi bez računa.

## Tehnika

Jedna Next.js 14 App Router aplikacija (TypeScript, Tailwind), deploy na Vercel, baza na Supabaseu.

Zaključane verzije iz `package-lock.json`, prema handoffu od 6. 11.: Next.js 14.2.33, React 18.3.1, TypeScript 5.9.3, Supabase JS 2.84.0, Supabase SSR 0.8.0, Jest 30.2.0. U `package.json` su rasponi, npr. `next: ^14.2.33`.

| Sloj | Izbor |
| --- | --- |
| UI | Next.js App Router, Tailwind, next-intl, React Hook Form, Zod, TipTap, Recharts |
| Podaci i auth | Supabase Postgres, Auth, Storage, RLS |
| Plaćanja | Stripe (Payment Intent, webhook, pretplate) |
| E-mail | Resend |
| Ograničenje prometa | Upstash Redis |
| Datoteke | jsPDF, docx, xlsx, QR |
| Deploy | Vercel, cron za podsjetnike plaćanja |

U kodu je otprilike **45 stranica**, **76 API ruta**, **35 React komponenti**, **22 testne datoteke** i **62 migracije** (numeracija ide do `066`; nema datoteka `034`, `047`, `048`, `049`).

Pristup podacima:

- Preglednik koristi anonimni Supabase klijent.
- Pisanje registracija, sažetaka i kontakata ide kroz server-only service-role klijent (`lib/supabase-admin.ts`). Taj ključ nije u pregledniku.
- Middleware čuva admin stranice. API rute middleware ne pokriva; svaka ruta ima vlastitu provjeru, a RLS ostaje uključen.
- Javni `INSERT` na `registrations` i `abstracts` je uklonjen u produkciji (Security Fix 01). Anonimni korisnik više ne može sam pisati u te tablice.

Glavne tablice: `conferences`, `registrations`, `registration_fees`, `abstracts`, `user_profiles`, `conference_permissions`, `contact_inquiries`, `payment_history`, `conference_pages`, `subscriptions` / `subscription_orders`, `platform_settings`.

## Do kuda smo došli

Rad od srpnja do rujna složio je proizvod. Rad od 6. i 7. studenog zatvara sigurnost, e-mail i aktivaciju organizatora. Nove velike funkcije u tim danima nisu dodane.

### Što je provjereno u produkciji

Handoff od 6. 11., commit `1c6c87d`:

- Javne INSERT politike na registracijama i sažetcima više ne postoje. Anonimni upis je odbijen.
- Bucket `registration-attachments` je privatan. Stari javni URL ne vraća dokument. Autorizirano preuzimanje i dalje radi.
- Ta provjera ne pokriva novije commitove.

### Što je već bilo na GitHubu prije ovog pusha

`origin/main` je prije pusha bio na `4ce069e`. Taj deploy nije bio zasebno potvrđen ručnim prolazom:

- `eb16c58` — kotizacija se provjerava prije registracije.
- `4ce069e` — pouzdaniji e-mail potvrde.

Oba su sada dio commita `9f00274`, koji je Vercel označio kao dovršen deploy.

### Što je ušlo s pushem 7. 11.

Ovih sedam commitova više nije samo lokalno:

1. `068e433` — organizator više ne dobiva lozinku e-mailom. Dobiva jednokratni aktivacijski link. Neuspjela pozivnica može se ponoviti bez duplog računa, pretplate ili plaćanja.
2. `c807500` — telefon na kontakt formi mora biti međunarodni (`+` i pozivni broj). Brisanje upita odbija se ako postoje ponude za plaćanje, da se ne obrišu kaskadno. Brisanje nula redaka više se ne prikazuje kao uspjeh. `sendGenericEmail` javno padne ako Resend nije podešen.
3. `ca48df8` — migracija `064` zapisana u repou. SQL je već ručno izvršen. Ne smije se ponovno pokretati.
4. `b21abfc` — iznimke design-linta za postojeći e-mail markup i admin naglaske.
5. `d85ecd5` — `AGENTS.md` i `docs/AI_HANDOFF.md`.
6. `6e0d1c2` — prilozi registracije provjeravaju se na serveru prema postavkama konferencije (tip i veličina, strop 50 MB). Tip datoteke se izvodi iz ekstenzije, ne iz onoga što preglednik pošalje. Oba kontakt formulara: najviše 5 poruka na sat po IP-u, kad je Upstash uključen.
7. `9f00274` — migracija `066`: uklanja javni INSERT na `contact_inquiries`. Pripremljena je za ručni SQL Editor. Nije potvrđeno da je izvršena. `supabase db push` se ne smije koristiti.

Izvan tih commitova lokalno su ostali necommitani `docs/00_ACTIVE/MEETFLOW_PREGLED_2026-11-07.md`, izmjena u `docs/README.md` i nepraćeni `supabase/.temp/` (lokalni Supabase cache; ne ide u commit).

## Što još nije zatvoreno

- **Povijest migracija.** Shema `supabase_migrations` postoji, tablica `schema_migrations` ne. CLI nije povezan. Lokalne datoteke `001`–`066` nisu dokazano usklađene s produkcijom. `supabase db push` i `migration repair` ne smiju se pokretati dok se ne napravi provjerena baseline.
- **Migracija `066`** čeka ručno izvršavanje i zasebnu provjeru, ako već nije odrađena izvan ovog zapisa.
- **Deploy** commita `9f00274` Vercel je označio kao dovršen. To ne dokazuje ručni prolaz kroz registraciju, aktivaciju organizatora ni kontakt formu. Migracija `066` i dalje nije potvrđeno izvršena.
- **Backup** je prijavljen, ali obnova nije testirana.
- Prije pusha, 7. 11., prošlo je 12 testnih datoteka vezanih uz ove commitove: 58 testova, svi prolaze. Stariji dashboard testovi iz handoffa (6. 11.: 4 pala zbog mocka `useSearchParams`) nisu ponovno pokretani.

## Kako ovo čitati kao stanje projekta

Proizvod je funkcionalno širok: konferencija, registracija, kotizacije, sažeci, recenzije, program, check-in, certifikati, CMS, plaćanja i pretplate organizatora. Zadnja dva tjedna rada nisu širila opseg. Zatvarala su rupe: javni upisi u bazu, javni prilozi, lozinke u e-mailu, validacija datoteka i kontakt formi, te pouzdanost potvrde registracije.

Sljedeći smisleni korak nije nova funkcija. To je ručno i provjereno stanje migracije `066`, odvojeno od bilo kakvog `db push`, te kratki prolaz kroz registraciju s privitkom, aktivaciju organizatora i kontakt formu na produkciji.
