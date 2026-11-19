# MeetFlow — sažetak spremnosti za prvu konferenciju

Datum analize: 7. studenog 2026.
Ovo je nacrt analize. Kod, baza i produkcija nisu mijenjani. Lokalni kod nije dokaz onoga što je sad na produkciji.

Oznake: VERIFIED IN CODE, VERIFIED BY EXECUTED TEST, DOCUMENTED ONLY, UNKNOWN, NOT APPLICABLE.
Git naredbe su izvršene lokalno. Testovi, lint i build u ovoj analizi nisu pokretani.

## Što aplikacija radi

MeetFlow je jedna Next.js aplikacija za više konferencija. Svaka konferencija živi na `/conferences/[slug]`. Super admin vidi platformu. Konferencijski admin vidi samo konferencije koje su mu dodijeljene. Sudionik se za registraciju i sažetak ne mora otvarati račun.

U kodu postoje registracija, virman, sažetak, recenzija preko tokena, program, QR check-in, bedževi, certifikati, CMS, izvoz i pretplata organizatora. Datoteka ne dokazuje da produkcijski tok radi.

## Preporuka

**NO-GO** za javnu konferenciju s pravim sudionicima, karticom i automatskim računom.

**CONDITIONAL GO** samo za mali, ručno vođeni pilot: jedna konferencija, virman, ti kao super admin, agencija samo na dodijeljenim poslovima, 20–50 sintetičkih prijava prije pravih ljudi.

## Što je nepotvrđeno

- Je li Vercel deployao `ff324ab` ili samo stariji `9f00274`. DOCUMENTED ONLY za `9f00274`. Deploy `ff324ab`: UNKNOWN.
- Je li produkcijska baza jednaka migracijama `001`–`066`. UNKNOWN.
- Migracija `066`: ti si javila da je SQL prošao. Politike nakon toga nisu ponovno pročitane. DOCUMENTED ONLY.
- Rade li Upstash, Resend, cron i Stripe webhook na produkciji. UNKNOWN.
- Može li se backup vratiti. DOCUMENTED ONLY da obnova nije testirana.
- Tko je prodavatelj i tko izdaje porezni račun. UNKNOWN.

## Najveći rizici

1. Povijest migracija nije usklađena. `supabase db push` se ne smije pokretati.
2. Nova registracija ne može platiti karticom. VERIFIED IN CODE: `app/api/register/route.ts` odbija `pay_now_card`.
3. IBAN za uplatu čita se iz profila vlasnika konferencije, ne iz zasebnog računa agencije. VERIFIED IN CODE.
4. Javni upload logotipa još je u migraciji `011` i nijedna kasnija datoteka tu politiku ne briše. Produkcija: UNKNOWN.
5. Nema CI-a. Sentry nije ovisnost. Dashboard testovi su 19. 11. lokalno prošli: 163 prolaza, 0 padova.

## Sljedeći najmanji korak

Ne dirati kod ni bazu. Na produkciji poslati jednu kontakt poruku s međunarodnim brojem, provjeriti da sljedeći poziv organizatora ima aktivacijski link bez lozinke, i — ako postoji testna registracija — učitati jedan dopušteni privitak. `supabase db push` i dalje ne smije ići.
