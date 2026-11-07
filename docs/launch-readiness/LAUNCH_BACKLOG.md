# MeetFlow — backlog do kontroliranog pilota

Datum: 7. studenog 2026.

Status svih stavki: otvoreno, osim gdje piše drugačije. Nijedna stavka ne odobrava SQL, deploy ni produkcijski pristup.

Složenost: S = sati, M = dan-dva, L = poseban zadatak s revizijom.

## Blokira svaku novu migraciju

### Ne pokretati povijest migracija

Problem: `schema_migrations` prema handoffu ne postoji. Lokalne datoteke `001`–`066` nisu dokazano jednake produkciji.

Prioritet: P0. Složenost: L. Dokaz: DOCUMENTED ONLY u `docs/AI_HANDOFF.md`. VERIFIED IN CODE: `supabase/config.toml` placeholder.

Acceptance: nitko ne pokreće `supabase db push`, `migration repair`, `db reset`, ni ponovni SQL `064` ili `066`.

Test: nema naredbe. Status: pravilo, ne zadatak za kod.

Ovisi o: ničemu. Sve migracijske stavke ovise o ovome.

## Prije pravih podataka i novca

### Read-only potvrda politike 066

Problem: prijava kaže da je DROP prošao. Popis politika nije ponovno čitan. SQL nema `IF EXISTS`, pa se ne smije ponavljati.

Prioritet: P0. Složenost: S. Dokaz: VERIFIED IN CODE `066_drop_public_insert_contact_inquiries.sql`. Izvršenje DOCUMENTED ONLY.

Acceptance: u bilješci piše postoji li politika `Anyone can insert contact inquiries`. Bez ispisa redova kontakata.

Test: read-only upit koji odobriš zasebno. Status: čeka odobrenje.

### Popis storage politika

Problem: migracija `011` i dalje stvara javni upload logotipa. `063` i `065` zatvaraju sažetke i privitke, ali produkcija tih datoteka nije u ovoj analizi ponovno viđena.

Prioritet: P0. Složenost: S. Dokaz: VERIFIED IN CODE u tim migracijama. Produkcija UNKNOWN.

Acceptance: za buckete `conference-logos`, `page-images`, `abstracts`, `registration-attachments` i `conference-templates` zapisano je je li bucket javan i koje INSERT/SELECT politike postoje.

Test: read-only, uz odobrenje. Status: nije rađeno.

### Čiji je IBAN

Problem: registracija čita `bank_account_number` s profila vlasnika konferencije.

Prioritet: P0. Složenost: S za provjeru, M ako treba promjena koda. Dokaz: `app/api/register/route.ts` oko 491–498. VERIFIED IN CODE.

Acceptance: agencija potvrdi da je račun na tom profilu njihov. Ako nije, pilot staje dok se račun ne uredi ili kod ne dobije poseban zadatak.

Test: jedna sintetička prijava na testnoj konferenciji, IBAN se ne lijepi u chat. Status: otvoreno.

### Pisani dogovor

Problem: uloga voditelja obrade, DPA, cijene, PDV i otkazivanje nisu u kodu.

Prioritet: P0. Složenost: S. Dokaz: NOT APPLICABLE za kod. Pravno UNKNOWN.

Acceptance: odgovori iz `FIRST_CLIENT_QUESTIONS.md` za MUST i BEFORE LAUNCH upisani su u bilješku. Status: nije započeto.

Ovisi o: pitanjima agenciji.

### Proba obnove backupa

Problem: backup je prijavljen, obnova nije testirana.

Prioritet: P0. Složenost: M. Dokaz: DOCUMENTED ONLY.

Acceptance: obnova na odvojen projekt, ne preko produkcije, s zapisom što je vraćeno (shema, podaci, storage) i što nije. Status: nije rađeno.

Ovisi o: posebnom odobrenju i alatu za backup. Ne raditi usput.

## Nučno za dogovoreni pilot

### Ručni dim na produkciji

Problem: deploy `9f00274` je u pregledu označen dovršenim, ali ručni prolaz kontakt forme, aktivacije i privitka nije dokaz ove analize. Deploy `ff324ab`: UNKNOWN.

Prioritet: P1. Složenost: S. Dokaz: DOCUMENTED ONLY.

Acceptance: jedna kontakt poruka s međunarodnim brojem stiže; sljedeći poziv organizatora ima aktivacijski link i nema lozinku; jedan dopušteni privitak se spremi ako je privitak u opsegu.

Test: ručno, sintetički podaci. Status: predloženo u handoffu.

Ovisi o: tome da se ne šalje na prave sudionike.

### Dvije konferencije, izolacija

Problem: tenant izolacija nije izvršena testom u ovoj analizi.

Prioritet: P1. Složenost: S. Dokaz: politike u `056` VERIFIED IN CODE; produkcija UNKNOWN.

Acceptance: admin A dobije odbijanje ili prazan rezultat za prijavu B. Manage token A na slug B bude odbijen.

Test: ručno, dvije testne konferencije. Status: nije rađeno.

Ovisi o: super admin kreira obje.

### Sintetička generalna

Problem: nema zapisa o 20–50 prijava s namjernim greškama.

Prioritet: P1. Složenost: M.

Acceptance: lista iz `FIRST_CLIENT_MVP.md` (besplatna, virman, dupli e-mail, krivi privitak, manage link, tuđi admin) ima prolaz ili upisanu grešku. Status: nije rađeno.

Ovisi o: dimu i dvije konferencije.

### Kartica ostaje izvan pilota

Problem: API je namjerno gasi od `d6d9c25`.

Prioritet: P1. Složenost: nije kod, nego odluka. Dokaz: VERIFIED IN CODE.

Acceptance: u dogovoru s agencijom piše da prva konferencija nema karticu, ili je pilot zaustavljen. Status: čeka odgovor.

## Kasnije

### Dashboard testovi

Problem: 6. 11. četiri testa padaju jer mock ima `useRouter`, a stranica zove `useSearchParams` (`app/admin/dashboard/page.tsx` 157 prema handoffu).

Prioritet: P2. Složenost: S. Dokaz: DOCUMENTED ONLY. Danas nije ponovno pokretano.

Acceptance: ta četiri testa prolaze bez promjene produkcijskog ponašanja. Status: otvoreno, ne blokira pilot.

Ovisi o: posebnom odobrenju da se testovi pokrenu u izolaciji. `.env.local` pokazuje na udaljeni Supabase. DOCUMENTED ONLY. Zato se Jest ne pokreće usput.

## Redoslijed

1. Pravilo o migracijama ostaje na snazi.
2. Odgovori agencije, posebno kartica i IBAN.
3. Read-only politike, uz odobrenje.
4. Ručni dim.
5. Dvije konferencije i sintetička generalna.
6. Tek onda pravi sudionici, i dalje bez kartice i bez novog SQL-a.
