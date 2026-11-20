# Test konferencija — odgovori agencije

Datum: 19. studenog 2026.

Izvor je upitnik koji je Renata poslala u chat. `FIRST_CLIENT_QUESTIONS.md` i dalje nema ove odgovore. Ovdje je za svaki odgovor zapisano postoji li to u MeetFlowu, što fali i koliko je posla.

Skala: **postava** znači postojeći admin, bez novog koda. **Malo** je oko jednog dana. **Srednje** je nekoliko dana. **Veliko** je izvan ovog pilota.

Pilot je [trichoptera.biol.pmf.hr](https://trichoptera.biol.pmf.hr). Javna stranica, pročitana 19. 11. 2026., kaže 19. International Symposium on Trichoptera, 19.–23. srpnja 2027., Sheraton Zagreb. Datum 2023. u upitniku je zastario. Primjer [register.empl.io/ICD2027](https://register.empl.io/ICD2027?locale=en) ostaje tuđi obrazac, ne ovaj događaj.

Kartica nije uvjet. Pilot ostaje na virmanu.

## 1. Informacije o konferenciji

| Odgovor | Već postoji | Što nedostaje | Posao |
| --- | --- | --- | --- |
| Naziv i datum: IST 2027, 19.–23. 7. 2027., Sheraton Zagreb. Do 31. 3. 2027. cijene su 500, 400 i 300 eura. Od 1. 4. 2027. cijene su 600, 500 i 400 eura | Naziv, slug, datumi, mjesto i dvorana. Šest kotizacija s datumom od–do, isto kao u tablici 2 | Ništa za same iznose i rokove. Postotak PDV-a i dalje nije dan | Postava datuma, mjesta i šest kotizacija |
| Prijave su otvorene od 15. 9. 2026. na njihovoj stranici | MeetFlow ima vlastitu formu `/conferences/[slug]/register` | Stare prijave se same ne prebacuju | Nova forma: postava. Uvoz već pristiglih prijava: srednje |
| Oko 50 sudionika | Kapacitet se može staviti na kotizaciju | Nema zasebnog „očekujemo 50” osim tog kapaciteta | Postava |
| Uživo | Mjesto i dvorana postoje. Nema obveznog online prijenosa | Ništa za hibrid, jer ga ne traže | Postava |
| Samo engleski | Jezici su `en` i `hr`. Forma i potvrda primaju `en` | Hrvatski tekstovi nisu potrebni. Treći jezik nije tražen | Postava, javni jezik engleski |

## 2. Registracije i kotizacije

| Odgovor | Već postoji | Što nedostaje | Posao |
| --- | --- | --- | --- |
| Kategorije: sudionik, student, osoba u pratnji | Kotizacija je slobodan naziv. Osoba u pratnji može biti vezana uz sudionika | Cijene nisu upisane ni u jednu konferenciju u ovom prolazu | Postava triju kotizacija |
| Iznosi su s PDV-om. Do 31. 3. 2027.: sudionik 500, student 400, pratnja 300. Od 1. 4. 2027.: 600, 500 i 400 eura | Šest kotizacija s datumom od–do. Obrazac kotizacije šalje upisani iznos kao bruto, s `prices_include_vat`. API iz toga izračuna neto | Postotak PDV-a unutar cijene i dalje nije dan, pa se neto za stvarni račun još ne zna. U testu je stopa 25% samo primjer: neto bi tada bio 400, 320 i 240, a sudionik i dalje plaća 500, 400 i 300 | Šest redaka s datumima: postava. Obrazac je već promijenjen |
| Što kotizacija uključuje. Sudionik: znanstveni program, otvaranje u ponedjeljak, simpozijsku večeru u srijedu, pauze za kavu, cjelodnevni izlet s ručkom u petak i PDV. Pratnja: otvaranje, večeru i izlet s ručkom. Pratnja nema materijale, pauze ni pristup predavanjima | Tekst može stajati uz kotizaciju na javnoj formi, kao opis kategorije | MeetFlow nema zasebno polje „što je uključeno”. Koktel dobrodošlice ovaj opis ne spominje | Opis uz kotizaciju: postava, čim se odluči gdje stoji. Koktel, ako ostane zasebna stavka: postava kad stigne cijena |
| Polja: titula, ime, prezime, e-mail, država, institucija, dolazak na večeru i izlet, napomena o prehrani | Ime, prezime i e-mail su jezgra. Ostalo su vlastita polja. Večera i izlet su u cijeni, pa polje može biti dolazak, bez doplate | Nema popisa titula. Koktel dobrodošlice nije u opisu uključenog | Polja: postava |
| Grupne prijave i prijenos dokumentacije: da | Više osoba na jednoj prijavi postoji. Polje za datoteku postoji | „Prijenos dokumentacije” može značiti uvoz iz empl.io. Taj uvoz ne postoji | Grupa i datoteka na formi: postava. Uvoz njihovih lista: srednje |
| Kartica nije uvjet. Ostaje virman | Virman postoji. Kartica za kotizaciju i dalje se odbija i ne ulazi u pilot | Ništa za karticu | Postava virmana |
| Primatelj i logistika: e-Tours d.o.o., Ulica grada Vukovara 5/1, 10000 Zagreb, OIB 11578972258. Kontakt Mirela Gašpar, mice@etours.hr, +385 1 5508 2393. Transakcijski račun HR6524840081100145534 | Profil vlasnika ima organizaciju, adresu, telefon, IBAN i naziv vlasnika računa. Predračun čita ta polja | Naziv banke i SWIFT nisu dani. OIB nema vlastito polje. Predračun nije porezni račun. Račun nije upisan; ovo je samo zapis | Postava imena, adrese, telefona i IBAN-a. OIB na predračunu: malo |

## 3. Znanstveni i stručni program

| Odgovor | Već postoji | Što nedostaje | Posao |
| --- | --- | --- | --- |
| Sažetci: da | Predaja sažetka, tekstom ili datotekom | Njihova pravila nisu priložena | Postava |
| Rokovi: na stranici su otvaranje prijava 15. 9. 2026., rana prijava 31. 3. 2027., rok sažetka 1. 5. 2027., obavijest o prihvaćanju 20. 5. 2027. | Rok predaje sažetka postoji | PDF [ist2027-terms.pdf](https://trichoptera.biol.pmf.hr/ist2027-terms.pdf) su opći uvjeti putovanja e-Toursa, ne pravila sažetka. Nema simpozijskog roka povrata ni teksta otkazivanja | Rok 1. 5. 2027.: postava. Tekst otkazivanja simpozija i dalje fali |
| Recenzija: da | Recenzent dobiva token, recenzija se sprema | Koga imenuju recenzentima | Postava |
| Program, biografije, knjiga sažetaka: da | Javni program i knjiga sažetaka postoje. Biografija nije zaseban modul | Biografije mogu biti CMS stranica. Nema strukturiranog popisa predavača | Program i knjiga: postava. Biografije kao stranice: postava. Zaseban imenik predavača: malo do srednje |

## 4. Tijekom događaja

| Odgovor | Već postoji | Što nedostaje | Posao |
| --- | --- | --- | --- |
| QR evidencija dolazaka: ne | Check-in postoji i ne mora se uključiti | Ništa | Ne uključivati |
| Bedž i potvrda: traže potvrdu o sudjelovanju | Generiranje potvrde postoji. Bedž također, ali ga nisu tražili | Njihov predložak potvrde. Bedž ostaje isključen dok ga izričito ne zatraže | Postava predloška. Ako predložak mora izgledati kao njihov: malo |
| Dva člana tima u adminu: Mirela.Gaspar@bcdme.com.hr i mice@etours.hr | Conference admin se poziva po konferenciji | Računi još nisu otvoreni. Ovo je dopuna dokumenta, ne pozivnica | Postava dva računa, kad se pilot smije pisati u bazu |
| Svakodnevni izvoz: smještaj i uplate. Smještaj ide u istu prijavu | Hotel, dolazak i odlazak su na formi. CSV ima hotel i status plaćanja | Nema popisa hotela ni cijena noćenja | Postava čim stigne cjenik smještaja |

## 5. Operativa

| Odgovor | Već postoji | Što nedostaje | Posao |
| --- | --- | --- | --- |
| Na pitanja odgovara Mirela Gašpar, mice@etours.hr | `reply_to` ide na potvrdu | Adresa je dana. Nije upisana u konferenciju | Postava |
| E-mail predlošci, sada empl.io | MeetFlow ima vlastite predloške potvrde, predračuna i sažetka | Njihovi predlošci nisu preneseni. empl.io se ne uvozi sam | Prilagodba teksta potvrde: malo. Pun prijenos empl.io sustava: veliko |
| Vlastita domena i adresa za potvrde: ne | Potvrda može otići sa zadanog MeetFlow pošiljatelja. Odgovor ide na mice@etours.hr | Domena agencije nije uvjet | Postava reply-to, bez nove domene |
| Privatnost: [politika e-Toursa](https://www.etours.hr/hr/politika-privatnosti/) | Stranica konferencije može držati poveznicu. Obavezna kućica privole može biti vlastito polje. Admin može ručno obrisati prijavu. Manage link dopušta ispravak dijela podataka | Politika je za putničku agenciju: čuva podatke najviše dvije godine nakon ugovora, prava ostvaruju obrascem u poslovnici, službenik je osobni.podaci@etours.hr. MeetFlow nema automatsko brisanje nakon dvije godine ni zahtjev ispitanika. Kartice se u ovom pilotu ne prikupljaju. WSPay iz njihove izjave ovdje ne vrijedi | Poveznica i kućica: postava. Automatski rok od dvije godine i zahtjev za brisanje: srednje |
| Završnu testnu verziju odobrava Mirela Gašpar | Nema polja za taj potpis | Ništa u kodu | Nije posao u kodu |

## Što ovo znači za pilot

Virman, šest kotizacija u dva datuma, engleski, vlastita polja, opis onoga što je u cijeni, smještaj na istoj prijavi, sažetak s rokom 1. 5. 2027., recenzija, program, knjiga sažetaka, dva admina i CSV smještaja i uplata stanu u postojeći admin.

Upisani iznos na obrascu kotizacije je bruto. Uz primjer stope 25% sudionik i dalje vidi i plaća 500, 400 i 300 eura, na formi, na predračunu i u potvrdi. Kartica ostaje isključena. IBAN je zapisan, ali nije upisan u profil. Predračun nije porezni račun. QR se ne uključuje. Politika privatnosti e-Toursa može stajati kao poveznica; automatsko brisanje nakon dvije godine nije u aplikaciji. Večera u srijedu i izlet u petak ulaze u kotizaciju.

Dio detalja ne treba zaključati sada. Renata je 19. 11. 2026. rekla da će se s agencijom dogovoriti kasnije, jer ovisi od konferencije do konferencije. To su cijene doplata, hoteli, postotak PDV-a, pravila otkazivanja, način prijenosa dokumentacije te naziv banke i SWIFT. Sposobnost aplikacije za virman, kotizacije, polja, sažetak i admine time se ne mijenja.

## Lokalni prolaz (19. 11. 2026.)

Lokalno, 19. 11. 2026.: Jest 24 skupa, 166 prolaza, 0 padova. Lint i build su prošli (Next.js 14.2.33). SQL i Supabase CLI nisu pokretani. Dva testa drže cijene 500, 400 i 300 eura na formi, predračunu i u potvrdi. Treći test drži datum: 31. 3. 2027. → 500/400/300, od 1. 4. 2027. → 600/500/400. Sve na lažnoj bazi u memoriji.

## Stanje pilota — 20. 11. 2026. (za handoff agentu)

Workspace: `/Users/renchi/Documents/Cursor/MeetFlow`. Produkcija: https://meetflow-conference.vercel.app. Vercel projekt: `meetflow` (`prj_76eZrWypmY3928bgIO6ZFjOOhzeY`). Repo: `CiberWarrior/MeetFlow`, `main`. Pravila: bez SQL-a, bez `supabase db push` / migration repair; bez commit/push/deploy i bez produkcijskih izmjena bez izričitog odobrenja; migracija 066 već ručno primijenjena.

### Commiti na `main` (deploy preko Vercela)

| Hash | Opis |
| --- | --- |
| `d78fe26` | Kotizacije na obrascu kao bruto (`prices_include_vat`); testovi 500/400/300 |
| `38ae44a` | Test datuma: 31. 3. → 500/400/300; od 1. 4. → 600/500/400 |
| `06307ee` | Predračun više ne selektira nepostojeće stupce `address`, `city`, `country` na `user_profiles` |
| `8286bf8` | Ugrađen Noto Sans u predračun radi hrvatskih slova (č/ć/š/ž/đ) |
| `d091d42` | Bankovni podaci po konferenciji (`payment_settings.bank_details`); popravak `inquiryId=test` |
| `b8263d0` / `20fae19` | Predračun učitava konferenciju po `id` (kao register) i parsira string `settings`; PDF s e-Tours IBAN |

Lokalno nakon bank/PDF fixa: bank-details + inclusive-catalog + proforma PDF testovi prošli.

### Testna konferencija u produkciji

- Naziv: **IST 2027**
- ID: `8c0a5da3-0420-4286-8b76-6aad5be18724`
- Slug: `ist-2027`
- Stanje: **nacrt** (`published=false`); javni API vraća 404. Privremeno se objavljivala samo za test prijave, pa vraćena u nacrt.
- Šest kotizacija u `custom_registration_fees` (rane 500/400/300 do 31. 3. 2027., kasne 600/500/400 od 1. 4. 2027.).
- Polja prijave (ažurirano 20. 11. 2026.): title, first_name, last_name, email, country, institution, symposium_dinner, friday_excursion, dietary_notes. `registration_info_text` objašnjava što kotizacija uključuje. `email_settings.reply_to` = `mice@etours.hr`.

### Provedene prijave (sintetički podaci)

1. `REG-001-b8cc` — Test Participant, `ist-2027-test@example.com`, 500.00 EUR, virman, Pending Payment.
2. `REG-001-5fdd` — Test Proforma, `ist-2027-proforma@example.com`, 500.00 EUR, virman. Predračun HTTP 200 nakon `06307ee`; iznos 500.00 EUR potvrđen na formi, potvrdi i u PDF-u.
3. Dodatne sintetičke prijave 20. 11. 2026. radi provjere bankovnih podataka (`ist-2027-bankverify*@example.com`).

Primatelj uplate za IST 2027: u `settings.payment_settings.bank_details` stoji **e-Tours d.o.o.**, IBAN `HR6524840081100145534`, banka Raiffeisenbank Austria d.d., adresa Ulica grada Vukovara 5/1, Zagreb. Potvrđeno 20. 11. 2026. na produkciji: `bank_instructions` i predračun PDF (Recipient e-Tours, IBAN …5534, Raiffeisenbank).

### E-mail (blokirano — čeka Resend)

- Potvrda prijave ne ide. Vercel logovi: `Registration confirmation email was rejected`, status **404**.
- App zove Supabase Edge Function `{SUPABASE_URL}/functions/v1/send-confirmation-email` (`lib/email.ts` → `sendRegistrationConfirmation`).
- Funkcija **je deployana** kroz Supabase dashboard (kod iz `supabase/functions/send-confirmation-email/index.ts`).
- U Edge Function Secrets **nema** `RESEND_API_KEY` (custom secrets prazni).
- Renata se nije mogla ulogirati u Resend (MFA one-time code na `@screatives.info` ne stiže). Čeka se pristup Resendu / API ključ.
- Default pošiljatelj u funkciji: `MeetFlow <noreply@renatahorvat.com>`.
- Testne adrese su `@example.com` — za pravi test treba stvarna adresa.

### Vercel env (samo imena; vrijednosti nisu čitane)

Postoje: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.  
`NEXT_PUBLIC_APP_URL` = `https://meetflow-conference.vercel.app` (production/preview/development), redeploy READY.  
Nema `RESEND_API_KEY` / `EMAIL_FROM` na Vercelu (za potvrdu prijave ključ ide u Supabase secrets funkcije).

### Otvoreno (prioritet)

1. Resend: API Key → Supabase Edge Functions → Secrets → `RESEND_API_KEY` (Renata čeka MFA odobrenje). Zatim testna prijava na stvarnu adresu.
2. PDV % od agencije; SWIFT e-Toursa (opcionalno).
3. Opcionalno: očistiti testne prijave (samo uz odobrenje).

### Preporučeni idući korak

Kad Resend MFA prođe: upisati `RESEND_API_KEY` u Edge Function Secrets, privremeno objaviti IST 2027, jedna prijava na stvarnu adresu, pa vratiti u nacrt.

## Kasnije, po konferenciji

Ovo se ne rješava u kodu prije dogovora s agencijom. Svaka konferencija može imati drugačiji odgovor. Za IST 2027 popis ostaje otvoren dok ga ne daju:

1. Koji je postotak PDV-a unutar tih iznosa? Bez njega se 500 eura ne može rastaviti na neto i porez.
2. Je li koktel dobrodošlice i dalje zasebna stavka, i koja mu je cijena? Večera i petkom izlet su u kotizaciji.
3. Koji hoteli i koje cijene noćenja idu u prijavu?
4. Što znači prijenos dokumentacije: datoteka uz prijavu, ili uvoz postojećih prijava?
5. Koja su pravila otkazivanja simpozija? Priloženi PDF su opći uvjeti putovanja.
6. Koji su naziv banke i SWIFT uz IBAN HR6524840081100145534?
