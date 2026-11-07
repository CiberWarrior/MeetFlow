# MeetFlow — registar rizika

Datum: 7. studenog 2026.

P0 = sigurnosni ili operativni blocker za stvarne podatke ili novac.
P1 = nužno za dogovoreni pilot.
P2 = korisno kasnije.

„Blokira launch?” znači javni launch ili pilot s pravim ljudima, ne blokadu pisanja dokumentacije.

| Rizik | P | Vjerojatnost | Utjecaj | Dokaz | Predložena mitigacija | Blokira launch? |
| --- | --- | --- | --- | --- | --- | --- |
| `supabase db push` ili `migration repair` na neusklađenoj povijesti | P0 | srednja ako netko pokrene naredbu | stara migracija može se izvršiti na produkciji | DOCUMENTED ONLY: handoff. VERIFIED IN CODE: `supabase/config.toml` i dalje ima placeholder project id | Ne pokretati. Baseline tek uz zasebno odobrenje i read-only popis | da, za svaku novu migraciju |
| Backup nije vraćen probom | P0 | nepoznato | nema povratka nakon greške | DOCUMENTED ONLY: handoff kaže da obnova nije testirana | Jedna proba na prazan projekt, ne na produkciju | da, prije pravih podataka |
| Javni upload u bucket logotipa | P0 ako politika još živi u produkciji | UNKNOWN | tuđi fajlovi u storage | VERIFIED IN CODE: `supabase/migrations/011_create_conference_logos_bucket.sql` reci 15–19. Nema kasnijeg DROP-a te politike. Produkcija UNKNOWN | Read-only popis storage politika | da, prije pravih datoteka, dok se produkcija ne vidi |
| Kartica za kotizaciju je ugašena, a stari Stripe kod ostaje | P1 za virman-pilot; P0 ako agencija traži karticu | visoka ako se kartica obeća | krivi opseg ili naplata na krivi račun | VERIFIED IN CODE: `app/api/register/route.ts` 369–376; `components/RegistrationForm.tsx` 109 | Pilot samo na virman. Karticu ne uključivati bez posebnog zadatka | da, ako agencija traži karticu |
| IBAN dolazi iz profila vlasnika | P0 poslovno | visoka ako je na profilu krivi račun | novac ide na krivi IBAN | VERIFIED IN CODE: `app/api/register/route.ts` oko 491–498 | Prije pilota provjeriti čiji je račun na tom profilu. Ne ispisivati IBAN u chat | da, prije stvarnog novca |
| PDF nije dokaz poreznog računa | P0 poslovno | visoka | krivi dokument prema sudioniku | VERIFIED IN CODE: postoji proforma (`lib/registration-proforma-pdf.ts`). Pravna valjanost UNKNOWN | Računovođa prije naplate | da, prije stvarnog novca |
| Dupla prijava u utrci | P1 | niska | dva reda i dva virmana | VERIFIED IN CODE: provjera pa insert, `app/api/register/route.ts` 213–243. Unique `(conference_id, email)` je na `abstract_reviewers`, `060` redak 33, ne na `registrations`. Index u `001` nije unique | Ručni pregled prije događaja | ne, uz mali pilot |
| RLS je grublji od API ovlasti | P1 | srednja ako admin ima JWT | conference admin s bilo kojim redom u `conference_permissions` smije SELECT/ALL nad registracijama te konferencije | VERIFIED IN CODE: `056_tighten_rls_policies.sql` 43–57. Je li `056` na produkciji: UNKNOWN | Ne davati admin račun ljudima koji smiju samo gledati | djelomično |
| Bilo koji conference admin čita sve profile sudionika | P1 | srednja ako se portal koristi | podaci tuđe konferencije | VERIFIED IN CODE: `056` 113–128. Produkcija UNKNOWN | Portal isključiti iz pilota | ne, ako se portal ne koristi |
| Skupni certifikati nemaju vlastitu provjeru uloge | P1 | niska ako RLS `056` drži | ruta se oslanja samo na RLS; greška u odgovoru može sadržavati e-mail | VERIFIED IN CODE: `app/api/admin/certificates/bulk/route.ts` 57–64, nema `getUser` | Ne koristiti tu rutu u pilotu | ne, ako se ruta ne koristi |
| Rate limit se gasi bez Upstasha | P1 | UNKNOWN na produkciji | spam kontakta i registracije | VERIFIED IN CODE: `lib/rate-limit.ts` 1–8 | Provjeriti da imena varijabli postoje na Vercelu, bez ispisa vrijednosti | djelomično |
| Recenzentski token je u bazi čitljiv | P1 | niska | tko vidi bazu, otvara recenzije | VERIFIED IN CODE: `app/api/review/[token]/route.ts` redak 49. Manage token se hashira: `lib/registration-manage-token.ts` 4–6 | Recenziju ostaviti iza pilota | ne za virman-pilot |
| Nema CI-a ni Sentryja | P1 | visoka | greška se vidi kasno | VERIFIED IN CODE: nema `.github/workflows`, nema `@sentry` u `package.json` | Tijekom pilota ručno gledati Vercel logove | ne, uz ručni nadzor |
| Četiri dashboard testa padaju na mocku | P2 | već viđeno 6. 11. | lažni osjećaj da admin UI ima test | DOCUMENTED ONLY: handoff, 63 prolazna i 4 neuspješna zbog `useSearchParams`. VERIFIED BY EXECUTED TEST: ne u ovoj analizi | Popraviti mock kasnije, izvan launch bloka | ne |
| Conference admin ne može spremiti izmjenu konferencije kroz središnji helper | P1 za samostalnu agenciju | visoka | agencija ovisi o super adminu | VERIFIED IN CODE: `lib/api-auth.ts` 146–149 uvijek brani `can_edit_conference` ako uloga nije super admin | U pilotu postavke radi super admin | ne, ako ti vodiš postavke |
| CMS stranice imaju drugačiju provjeru od središnjeg helpera | P2 | niska | conference admin može uređivati stranice ako je zastavica u bazi true | VERIFIED IN CODE: `app/api/admin/conferences/[id]/pages/route.ts` 35–48 | Znati da dva puta nisu ista pravila | ne |
| Cron podsjetnici šalju prave e-mailove | P2 | UNKNOWN jesu li uključeni | sudionici dobiju podsjetnik prije dogovora | VERIFIED IN CODE: `app/api/cron/payment-reminders/route.ts` 15–18 traži tajnu. Vercel env UNKNOWN | Ne oslanjati se na cron u prvom pilotu | ne |
| Dokumentacija sadrži stvarne admin e-mail adrese | P2 | visoka | osobni podatak u repou | VERIFIED IN CODE: `docs/00_ACTIVE/PROJECT_CONTEXT.md` i `README.md`. Adrese se ovdje ne prepisuju | Kasnije zamijeniti opisom uloge | ne |

## RLS i service role

RLS vrijedi za anonimni ključ i za prijavljenog korisnika. Service-role ključ politike preskače. Javne rute zato same moraju provjeriti konferenciju, iznos i token. Ako ta provjera fali, RLS ih ne spašava.

Obrnuto: i kad API provjeri granuliranu ovlast, korisnik s vlastitim JWT-om i dalje može pogoditi tablicu izravno ako je RLS širi. Oba sloja moraju držati. Produkcijski RLS u ovoj analizi nije čitan. UNKNOWN.

## Što admin konferencije A može prema kodu

Ako produkcija ima politike iz `056`, admin s redom za konferenciju A vidi registracije A i ne vidi registracije B kroz tu politiku. Ne vidi granulirano „samo check-in”: politika je FOR ALL čim red dozvole postoji. VERIFIED IN CODE. Produkcija UNKNOWN.

Manage link provjerava da slug pripada istoj konferenciji kao registracija. VERIFIED IN CODE: `app/api/conferences/[slug]/manage/route.ts` 35–36.

Signed URL za sažetak traje 300 sekundi i putanja mora počinjati s `conferenceId/`. VERIFIED IN CODE: `lib/abstract-storage.ts` 17 i 130. Tko smije tražiti URL i dalje ovisi o ruti koja ga zove.
