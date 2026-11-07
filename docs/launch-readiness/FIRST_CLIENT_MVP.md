# MeetFlow — najmanji opseg prve konferencije

Datum: 7. studenog 2026.

Ovo je prijedlog opsega, ne obećanje da produkcija već tako radi. Kartica za kotizaciju je u kodu ugašena. VERIFIED IN CODE.

## MUST HAVE

- Super admin (ti) kreira konferenciju i dodjeljuje agenciji samo potrebne ovlasti.
- Jedna javna stranica konferencije i jedna registracijska forma.
- Kotizacije, uključujući cijenu 0 ako agencija ima besplatnu kategoriju.
- Prijava bez korisničkog računa.
- Potvrda e-mailom i jasan status „čeka uplatu” ili „plaćanje nije potrebno”.
- Virman. IBAN koji sudionik vidi mora biti račun koji je agencija odobrila.
- Ručna potvrda virmana u adminu.
- Lista prijava s pretragom i jedan CSV izvoz.
- Dvije konferencije u testu, da se vidi da admin A ne vidi prijavu B.

## ONLY IF REQUIRED BY AGENCY

- Predaja sažetka i preuzimanje datoteke.
- Smještaj, više sudionika na jednoj prijavi, prilog dokaza uplate.
- Javni program i QR check-in.
- Hrvatski i engleski tekstovi koje napiše agencija, ne developer.

## AFTER PILOT

- Kartica za sudionike. To je promjena proizvoda. Stare Stripe rute nisu prekidač koji se smije samo upaliti.
- Automatski porezni račun.
- Peer review, knjiga sažetaka, skupni certifikati.
- Portal sudionika i loyalty.
- Samoposlužna pretplata organizatora kao način da agencija sama otvori konferenciju.
- Popravak povijesti migracija. Tek uz poseban plan i odobrenje.

## Tko što radi u pilotu

Ti držiš super admina: konferencija, forma, kotizacije, IBAN profil, poziv organizatora.

Agencija, ako dobije conference admina, radi s prijavama, ručnom potvrdom uplate i izvozom. Ne kreira konferenciju i kroz središnji helper ne mijenja postavke konferencije. VERIFIED IN CODE: `lib/api-auth.ts` 146–149.

## Acceptance kriteriji

Pilot smije primiti prave ljude tek kad je zapisano sve ovo:

1. Agencija je rekla da kartica nije uvjet.
2. IBAN na profilu vlasnika je onaj koji smije primiti novac.
3. Računovođa je rekao koji dokument sudionik dobiva. PDF u aplikaciji sam to ne rješava.
4. Kontakt forma, aktivacijski e-mail i jedan privitak prošli su na produkciji, ili je zapisano zašto privitak nije u opsegu.
5. 20–50 sintetičkih prijava prošlo je na dvije testne konferencije.
6. U toj vježbi bilo je: besplatna prijava, virman, dupli e-mail, krivi privitak ako je privitak u opsegu, manage link konferencije A na URL-u konferencije B, admin A ne vidi prijavu B.
7. Nijedan sintetički red nije na konferenciji koja ide u javnost.
8. Poznata je osoba koja gasi registraciju ako forma padne.
9. Backup i dalje nije vraćen: to ostaje upisani rizik, ne skriveni.

## Što se u pilotu ne uključuje

Portal sudionika, recenzija, skupni certifikati, cron podsjetnici, brisanje produkcijskih prijava, novi deploy i bilo koji SQL.
