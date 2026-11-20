# Test konferencija — odgovori agencije

Datum: 19. studenog 2026. Ažurirano: 20. studenog 2026.

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
| Primatelj i logistika: e-Tours d.o.o., Ulica grada Vukovara 5/1, 10000 Zagreb, OIB 11578972258. Kontakt Mirela Gašpar, mice@etours.hr, +385 1 5508 2393. Transakcijski račun HR6524840081100145534 | IBAN, primatelj, adresa i banka (Raiffeisenbank Austria d.d.) upisani u `settings.payment_settings.bank_details` na IST 2027; predračun i registracija to čitaju. Profil vlasnika ima ista bankovna polja kao rezervu | SWIFT još nije dan. OIB nema vlastito polje. Predračun nije porezni račun | SWIFT: postava kad stigne. OIB na predračunu: malo |

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
| Na pitanja odgovara Mirela Gašpar, mice@etours.hr | `reply_to` ide na potvrdu | Adresa je dana i upisana | Gotovo |
| E-mail predlošci, sada empl.io | MeetFlow ima vlastite predloške potvrde, predračuna i sažetka | Njihovi predlošci nisu preneseni. empl.io se ne uvozi sam | Prilagodba teksta potvrde: malo. Pun prijenos empl.io sustava: veliko |
| Vlastita domena i adresa za potvrde: ne | Potvrda može otići sa zadanog MeetFlow pošiljatelja. Odgovor ide na mice@etours.hr | Domena agencije nije uvjet | Postava reply-to, bez nove domene |
| Privatnost: [politika e-Toursa](https://www.etours.hr/hr/politika-privatnosti/) | Stranica konferencije može držati poveznicu. Obavezna kućica privole može biti vlastito polje. Admin može ručno obrisati prijavu. Manage link dopušta ispravak dijela podataka | Politika je za putničku agenciju: čuva podatke najviše dvije godine nakon ugovora, prava ostvaruju obrascem u poslovnici, službenik je osobni.podaci@etours.hr. MeetFlow nema automatsko brisanje nakon dvije godine ni zahtjev ispitanika. Kartice se u ovom pilotu ne prikupljaju. WSPay iz njihove izjave ovdje ne vrijedi | Poveznica i kućica: postava. Automatski rok od dvije godine i zahtjev za brisanje: srednje |
| Završnu testnu verziju odobrava Mirela Gašpar | Nema polja za taj potpis | Ništa u kodu | Nije posao u kodu |

## Što ovo znači za pilot

Virman, šest kotizacija u dva datuma, engleski, vlastita polja, opis onoga što je u cijeni, smještaj na istoj prijavi, sažetak s rokom 1. 5. 2027., recenzija, program, knjiga sažetaka, dva admina i CSV smještaja i uplata stanu u postojeći admin.

Upisani iznos na obrascu kotizacije je bruto. Uz primjer stope 25% sudionik i dalje vidi i plaća 500, 400 i 300 eura, na formi, na predračunu i u potvrdi. Kartica ostaje isključena. Za IST 2027 IBAN i naziv banke su upisani (e-Tours, Raiffeisenbank Austria d.d.); SWIFT još fali. Predračun nije porezni račun. QR se ne uključuje. Politika privatnosti e-Toursa može stajati kao poveznica; automatsko brisanje nakon dvije godine nije u aplikaciji. Večera u srijedu i izlet u petak ulaze u kotizaciju.

Virman na predračunu: model **HR00**, poziv na broj samo znamenke, oznaka prijave u opisu plaćanja.

Dio detalja ne treba zaključati sada. Renata je 19. 11. 2026. rekla da će se s agencijom dogovoriti kasnije, jer ovisi od konferencije do konferencije. To su cijene doplata, hoteli, postotak PDV-a, pravila otkazivanja, način prijenosa dokumentacije te SWIFT. Sposobnost aplikacije za virman, kotizacije, polja, sažetak i admine time se ne mijenja.

## Priprema za klijentsko testiranje — 20. 11. 2026.

Workspace: `/Users/renchi/Documents/Cursor/MeetFlow`. Produkcija: https://meetflow-conference.vercel.app.

### IST 2027 (spremno za klijenta)

| Stavka | Vrijednost |
| --- | --- |
| ID | `8c0a5da3-0420-4286-8b76-6aad5be18724` |
| Slug | `ist-2027` |
| `conference_code` | `IST2027` (nove prijave: `IST2027-001`, …) |
| Stanje | **nacrt** (`published=false`) dok ne krene klijentski prolaz |
| Kotizacije | 6 (rane 500/400/300 do 31. 3. 2027.; kasne 600/500/400 od 1. 4. 2027.) |
| Polja | title, first_name, last_name, email, country, institution, symposium_dinner, friday_excursion, dietary_notes |
| Info tekst | što kotizacija uključuje |
| `reply_to` | `mice@etours.hr` |
| Primatelj | e-Tours d.o.o., IBAN `HR6524840081100145534`, Raiffeisenbank Austria d.d., Ulica grada Vukovara 5/1, Zagreb |
| Virman na PDF-u | Model HR00 · brojčani poziv · oznaka prijave u opisu |

Interni `@example.com` testni zapisi i lokalni sample PDF uklonjeni / za brisanje prije klijentskog prolaza. Ne držati stari `REG-001-…` predračun kao referencu za klijenta.

### E-mail

Blokirano dok Renata ne dobije Resend MFA / `RESEND_API_KEY` u Supabase Edge Function Secrets (`send-confirmation-email`). Pošiljatelj u funkciji: `MeetFlow <noreply@renatahorvat.com>`. Za klijentski test treba stvarna adresa.

### Otvoreno prije / tijekom klijentskog testa

1. Resend ključ → potvrda e-mailom.
2. Privremeno objaviti IST 2027, jedna prava prijava, predračun, pa po dogovoru vratiti u nacrt ili ostaviti objavljeno.
3. SWIFT (opcionalno); PDV % od agencije.
4. Obrisati preostale sintetičke prijave u adminu (Registrations → odaberi → Delete), ako još postoje.

### Preporučeni idući korak

Commit/push HR00 izmjene + redeploy, očistiti stare prijave u adminu, zatim klijentski prolaz (uz Resend kad bude spreman).

## Kasnije, po konferenciji

1. Koji je postotak PDV-a unutar tih iznosa?
2. Je li koktel dobrodošlice i dalje zasebna stavka, i koja mu je cijena?
3. Koji hoteli i koje cijene noćenja idu u prijavu?
4. Što znači prijenos dokumentacije: datoteka uz prijavu, ili uvoz postojećih prijava?
5. Koja su pravila otkazivanja simpozija?
6. Koji je SWIFT/BIC uz IBAN HR6524840081100145534 (Raiffeisenbank Austria d.d. već upisan)?
