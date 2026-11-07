# MeetFlow — orijentacijski plan do pilota

Datum: 7. studenog 2026.

Ovo nije obećani rok. Tjedan 1 ne počinje dok agencija ne odgovori na MUST pitanja u `FIRST_CLIENT_QUESTIONS.md`. Ako kartica mora raditi, plan staje i otvara se poseban zadatak. Ako IBAN nije račun agencije, plan staje.

Nijedan tjedan ne uključuje `supabase db push`, `migration repair`, ponovni SQL `064` ili `066`, deploy, pravi Stripe charge ili masovni e-mail.

## Tjedan 0 — odmah

Cilj: zapisati odluku i ne dirati produkciju.

- Nacrti stoje u `docs/launch-readiness/`.
- Agenciji poslati pitanja. Ne popunjavati odgovore umjesto njih.
- Odluka na papiru: pilot je virman, ili se staje.

Prijelaz: postoji pisani odgovor na kartica / IBAN / račun / otkazivanje. Ako ga nema, ostaje tjedan 0.

## Tjedan 1 — vidjeti produkciju, ne mijenjati je

Cilj: tri ručne provjere i, samo uz zasebno odobrenje, read-only politike.

- Jedna kontakt poruka s međunarodnim brojem.
- Sljedeći poziv organizatora: aktivacijski link, bez lozinke.
- Jedan dopušteni privitak, ako testna registracija postoji.
- Imena env varijabli na Vercelu provjeriti bez otvaranja vrijednosti: Supabase, Stripe, Resend, Upstash, `CRON_SECRET`.
- Ako odobriš čitanje: politika kontakta i storage bucketi iz `LAUNCH_BACKLOG.md`.

Sigurnosna kontrola: nema SQL-a koji mijenja, nema ispisa ključeva, nema produkcijskog webhooka.

Prijelaz: tri provjere imaju zapis prolaz ili točan razlog zaustavljanja. UNKNOWN se ne pretvara u prolaz.

## Tjedan 2 — sintetička izolacija

Cilj: dvije testne konferencije i male prijave.

- Super admin kreira obje.
- Besplatna prijava, virman, dupli e-mail, manage link na krivi slug, admin tuđe konferencije.
- Jedan CSV na sintetičkim redovima.
- Ručna potvrda jednog virmana. Provjera da ta radnja sama ne šalje e-mail.

Prijelaz: unakrsni pokušaj je odbijen i zapisan. Ako admin A vidi prijavu B, pilot s pravim ljudima staje.

## Tjedan 3 — agencija na pozivu

Cilj: netko tko nije developer prođe formu.

- Agencija na mobitelu pošalje sintetičku prijavu.
- Tekstovi na jezicima koje su odabrali.
- Rečenica o plaćanju i dokumentu koju je računovođa prihvatio.
- Ime osobe koja gasi registraciju ako forma padne.
- Cron podsjetnici ostaju izvan igre dok se posebno ne uključe.

Prijelaz: agencija je sama pronašla prijavu i izvezla CSV, uz tebe na pozivu. Ako ne može, opseg se sužava, ne širi.

## Tjedan 4 — pravi ljudi samo ako 1–3 imaju zapis

Cilj: mali broj pravih prijava, i dalje virman, i dalje ti kao super admin.

Ulazni uvjeti, svi moraju biti da:

- kartica nije uvjet;
- IBAN je potvrđen;
- račun i otkazivanje imaju vlasnika izvan koda;
- tjedan 1 i 2 imaju zapis, ne usmenu procjenu;
- backup rizik je i dalje napisan. Obnova i dalje nije uvjet koji se smije prešutjeti. Ako obnova nije rađena, pravi volumen ostaje mali.

Ako bilo koji uvjet fali, tjedan 4 ostaje na sintetičkim podacima.

## Što ovaj plan ne radi

Ne popravlja dashboard testove, ne uvodi Sentry, ne spaja povijest migracija i ne uključuje karticu. To su zasebni zadaci nakon pilota ili uz posebnu reviziju.
