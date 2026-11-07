# MeetFlow — kritični korisnički tokovi

Datum: 7. studenog 2026.

Nijedan tok nije prošao ručni preglednik ni produkcijski klik u ovoj analizi. „Test postoji” znači da u `__tests__` ima datoteka koja pokriva dio logike, ne da je tok danas izvršen.

Oznake: VERIFIED IN CODE, DOCUMENTED ONLY, UNKNOWN.

## 1. Kreiranje konferencije i dodjela prava

Koraci: super admin otvori `/admin/conferences/new`, spremi konferenciju, na korisniku uključi dozvole za taj `conference_id`.

Očekivano: conference admin vidi samo tu konferenciju.

Dokaz: POST traži super admina, `app/api/admin/conferences/route.ts` redak 104. VERIFIED IN CODE.

Test: nema E2E. Ručno: dvije konferencije, admin A ne otvara podatke B. Prioritet P1.

Failure: agencija sama ne može kreirati konferenciju.

## 2. Aktivacija organizatora

Koraci: super admin pozove organizatora. E-mail treba imati jednokratni link, ne lozinku.

Očekivano: neuspjela pozivnica može se ponoviti bez duplog računa.

Dokaz: commit `068e433` je na `origin/main`. VERIFIED IN CODE preko git povijesti. Sadržaj produkcijskog e-maila: UNKNOWN.

Test: postoje `__tests__/lib/organizer-activation.test.ts`, `__tests__/api/admin-users-activation.test.ts` i srodne datoteke. Nisu pokretane u ovoj analizi.

Ručno: sljedeći poziv, provjera da u poruci nema lozinke. Prioritet P1.

## 3. Konfiguracija registracijske forme

Koraci: super admin u postavkama konferencije doda polja i kotizacije.

Očekivano: javna forma na `/conferences/[slug]/register` pokaže ta polja.

Dokaz: forma je dinamička. VERIFIED IN CODE kroz postavke i `RegistrationForm`. Conference admin kroz `requireCanEditConference` ne može spremiti izmjenu konferencije: `lib/api-auth.ts` 146–149. VERIFIED IN CODE.

Test: nema E2E forme. Ručno: ti složiš formu. Prioritet P1.

## 4. Besplatna registracija

Koraci: kotizacija 0, bez dodataka s cijenom, submit.

Očekivano: `payment_status = not_required`, nema virmana.

Dokaz: `app/api/register/route.ts` 332–367. VERIFIED IN CODE. Pravilo projekta: iznos 0 znači besplatno.

Test: `__tests__/api/register-route.test.ts` pokriva dio fee pravila. Nije pokretan danas.

Ručno: jedna prijava s cijenom 0. Prioritet P1.

Failure: strani ili nepostojeći `registration_fee_id` ne smije postati besplatna prijava. Kod to odbija. VERIFIED IN CODE, reci 298–327.

## 5. Plaćena registracija karticom

Koraci: sudionik bira karticu i plaća.

Očekivano u trenutnom kodu: zahtjev bude odbijen.

Dokaz: `payment_preference === 'pay_now_card'` vraća „Card payment is not available for conference registration”. `app/api/register/route.ts` 369–376. Sučelje nema taj izbor: `components/RegistrationForm.tsx` 109. Uvedeno u `d6d9c25`. VERIFIED IN CODE.

Test: register test očekuje `bank_transfer`. Nije pokretan danas.

Ručno: ne obećavati karticu. Prioritet P0 ako je agencija traži, inače NOT APPLICABLE za pilot.

Failure: netko uključi karticu „jer Stripe rute postoje” i novac ode na platformski Stripe račun, ne na IBAN agencije.

## 6. Registracija uz virman

Koraci: sudionik pošalje prijavu, vidi IBAN, admin kasnije označi uplatu.

Očekivano: `payment_method = bank_transfer`, `payment_status = pending`, IBAN iz profila vlasnika.

Dokaz: `app/api/register/route.ts` 369–376 i 491–498. VERIFIED IN CODE.

Test: register test ima sintetički IBAN. Nije pokretan danas.

Ručno: jedna sintetička prijava i ručna potvrda. Prioritet P0 prije pravog novca.

Failure: na profilu vlasnika stoji krivi IBAN.

## 7. E-mail potvrda i ponovni pokušaj

Koraci: nakon prijave ode potvrda. Ako Resend nije podešen, slanje javno padne.

Dokaz: `lib/email.ts` 114–118, `sendGenericEmail` baci grešku ako nema `RESEND_API_KEY`. VERIFIED IN CODE. Produkcijski ključ: UNKNOWN, vrijednost se ne smije ispisivati.

Test: `__tests__/lib/registration-confirmation-email.test.ts`, `__tests__/lib/send-generic-email.test.ts`. Nisu pokretani danas.

Ručno: jedna poruka na testni sandučić. Prioritet P1.

## 8. Duple registracije i ponovljeni zahtjev

Koraci: isti e-mail dvaput, ili dva brza klika.

Očekivano: drugi put poruka da je e-mail već prijavljen.

Dokaz: dvije provjere pa insert, `app/api/register/route.ts` 213–243. Nema unique ograničenja na `registrations` za `(conference_id, email)`. VERIFIED IN CODE. `060` unique je za recenzente.

Test: nije viđen concurrency test.

Ručno: dva klika i drugi pokušaj nakon uspjeha. Prioritet P1.

Failure: dva istovremena zahtjeva mogu oba proći.

## 9. Self-service upravljanje prijavom

Koraci: sudionik otvori link iz e-maila, vidi status, promijeni dopuštena polja.

Očekivano: token vrijedi samo za tu konferenciju. Trajanje 180 dana. U bazi je hash, ne sirovi token.

Dokaz: `lib/registration-manage-token.ts` 4–17 i 40–48. Slug se uspoređuje s `conference_id`: `manage/route.ts` 35–36. `update_custom_data` spaja polja bez strogog popisa. VERIFIED IN CODE.

Test: nije viđen E2E.

Ručno: link konferencije A zalijepiti na URL konferencije B i očekivati odbijanje. Prioritet P1.

## 10. Predaja, uređivanje i preuzimanje sažetka

Koraci: sudionik preda online ili dokument, organizator preuzme, autor dobije signed URL.

Očekivano: datoteka nije na javnom URL-u. Link traje 300 s i putanja mora biti pod tom konferencijom.

Dokaz: `lib/abstract-storage.ts` 17 i 124–131. Migracija `063` briše stare javne politike bucketa `abstracts`. VERIFIED IN CODE. Je li `063` na produkciji: UNKNOWN.

Test: nema izdvojenog E2E u popisu koji pokriva cijeli upload.

Ručno: jedan upload i jedno preuzimanje, plus stari javni URL ne smije vratiti datoteku. Prioritet P1 samo ako agencija traži sažetke.

## 11. Peer review token

Koraci: recenzent otvori `/review/[token]`, vidi dodijeljene sažetke, upiše odluku.

Očekivano u kodu: e-mail autora se ne vraća. Ime autora ostaje. Token u tablici je čitljiv.

Dokaz: `app/api/review/[token]/route.ts` 46–73. VERIFIED IN CODE.

Test: nije viđen E2E. Prioritet P2 za prvi pilot.

## 12. Program, check-in, bedževi i certifikati

Koraci: admin složi program, skenira QR, generira bedž ili certifikat.

Dokaz: admin rute za program, check-in, bedževe i pojedinačni certifikat zovu `requireConferencePermission`. VERIFIED IN CODE preko importa u tim rutama. Skupni certifikat ne zove `getUser`: `certificates/bulk/route.ts` 57–64.

Test: nema E2E. Ručno: ne u prvom vikendu. Prioritet P2.

Failure: skupna ruta ovisi o tome je li RLS stvarno uključen u produkciji. UNKNOWN.

## 13. Izvoz

Koraci: admin traži Excel, CSV ili JSON.

Očekivano: samo korisnik s ovlašću za tu konferenciju.

Dokaz: dio admin ruta traži `can_export_data` ili drugu dozvolu. Točan skup svih export gumba nije u ovoj analizi klikom provjeren. VERIFIED IN CODE da izvoz kao značajka postoji u admin stranicama. Produkcijski klik: UNKNOWN.

Ručno: jedan CSV na sintetičkim redovima. Prioritet P1. Izvoz je osobni podatak.

## 14. Povrati, storno i ručna potvrda

Koraci virmana: admin označi `verified: true`.

Očekivano: status uplate se promijeni. Sudionik ne dobije automatsku poruku.

Dokaz: `confirm-bank-payment/route.ts` 10–13 i 40. VERIFIED IN CODE.

Stripe povrat traži `payment_intent_id` i `can_manage_payments`. VERIFIED IN CODE: `app/api/admin/refunds/route.ts` 84–86 i 160–164. Za nove virman prijave kartičnog povrata nema. NOT APPLICABLE u virman-pilotu.

Nakon djelomičnog Stripe povrata kod uspoređuje iznos s `refund_amount`, ne s uplaćenim iznosom. `refunds/route.ts` redak 183. VERIFIED IN CODE. Nije izvršeno na Stripeu.

Ručno: jedna sintetička ručna potvrda. Prioritet P1.

## 15. Podsjetnici, cron i vanjski servisi

Koraci: Vercel jednom dnevno zove `/api/cron/payment-reminders`.

Očekivano: bez ispravnog `Bearer CRON_SECRET` ruta vrati 401. S tajnom šalje e-mail za `pending` uplate starije od 3 dana, najviše 3 puta, limit 200. VERIFIED IN CODE: `payment-reminders/route.ts` 15–49.

Test: ne pokretati. Može poslati pravi e-mail.

Ručno: cron isključiti iz prvog pilota dok agencija ne zatraži podsjetnik i dok se ne zna da je Resend na testnom primatelju. Prioritet P2.

## Ručni zapisnik za kasnije

Kad se tok prođe, u bilješku upisati datum, konferencijski slug testne konferencije, rezultat i tko je gledao. Ne upisivati tuđe osobne podatke, ključeve ni pune IBAN-ove.
