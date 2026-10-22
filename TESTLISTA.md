# Testlista före lansering

Gå igenom hela listan på den publicerade sajten (eller en deploy preview) **både på mobil och dator**. Bocka av med `[x]`. Testa med en riktig mobil, inte bara datorns mobilläge.

## Förberedelser

- [ ] Alla `[platshållare]` (gul bakgrund) i Om oss, Frågor & svar, Köpvillkor och Integritetspolicy är ifyllda.
- [ ] Rätt Swish-nummer i `SWISH_PAYEE` och i texten på Om oss.
- [ ] Produkter, priser, bilder och lagersaldon stämmer i Supabase.
- [ ] Alla miljövariabler finns i Netlify (se README avsnitt 8). `SITE_URL` är `https://studentstil.se`.
- [ ] Köpvillkoren har lästs igenom av er UF-rådgivare. Det är beslutat om moms tillkommer eller inte.
- [ ] `pnpm run check` och `pnpm test` går igenom lokalt.

## Domän och säkerhet

- [ ] `https://studentstil.se` visar sajten med hänglås (giltigt certifikat).
- [ ] `http://studentstil.se` och `https://www.studentstil.se` skickas vidare till `https://studentstil.se`.
- [ ] `https://studentstil.se/finns-inte` visar 404-sidan.
- [ ] `https://studentstil.se/api/admin/orders` utan inloggning ger "Du behöver logga in" (401), alltså ingen orderdata.
- [ ] Kontrollera säkerhetsrubrikerna på <https://securityheaders.com>. Betyget ska vara A eller bättre.
- [ ] GitHub-repot är privat och innehåller ingen `.env`-fil eller några nycklar.

## Butiken

- [ ] Startsidan visar utvalda produkter. Knappen **Beställ nu** leder till produkterna.
- [ ] Produktsidan visar alla aktiva produkter med pris och storlekar.
- [ ] En produkt där alla storlekar har lager 0 visar **Slut i lager** och går inte att beställa.
- [ ] Sidorna fungerar i både stående och liggande läge på mobilen, utan sidledsscroll.
- [ ] Menyn, sidfotens länkar och FAQ-sektionerna fungerar.

## Produktsidor

- [ ] Klick på produktens namn eller bild (på startsidan och produktsidan) öppnar `/produkt/?id=…`.
- [ ] Produktsidan visar stora bilder, pris, beskrivning, storlek/färg som knappar (slut i lager överstruket), antal och **Lägg i varukorgen**.
- [ ] **Lägg i varukorgen** utan vald storlek/färg ger "Välj … först". Med val läggs rätt antal till och siffran i sidhuvudet ökar.
- [ ] "Om produkten" och storleksguiden (overallen) stämmer. Fyll i material och tvättråd i `src/client/productInfo.ts`.
- [ ] "Passar bra ihop med" visar de andra produkterna.
- [ ] En felaktig länk (`/produkt/?id=finns-inte`) visar "Produkten hittades inte".
- [ ] På dator ligger bilderna till vänster och köpdelen till höger. På mobil ligger de under varandra.

## Klassbeställning

- [ ] `/klassbestallning/` nås från menyn, startsidan och sidfoten.
- [ ] Varje storlek och färg i lager har en rad med − / + och ett sifferfält. Det går att skriva t.ex. 12 direkt.
- [ ] Under 25 overaller visar sammanfattningen "X av 25 overaller" och ordinarie priser.
- [ ] Vid 25 overaller eller fler visas "Klasspris!", besparingen och det överstrukna ordinarie priset. Totalen stämmer med klasspriserna i Supabase.
- [ ] Skola och mobilnummer krävs. Utan någon vara visas "Fyll i antal för minst en vara".
- [ ] En klassbeställning med t.ex. 30 overaller skapar **en** order. Orderbekräftelsen visar "Klassbeställning", skolan och styckpris per rad, och Swish-beloppet är hela summan.
- [ ] Priserna i ordern (Supabase → `order_items`) är klasspris när det gäller och ordinarie pris annars. Det är databasen som bestämmer.
- [ ] I admin syns märket **Klassbeställning**, filtret "Klassbeställningar" fungerar och CSV:n har kolumnerna Typ och Skola.
- [ ] Notisen till `SHOP_EMAIL` har ämnet "Ny klassbeställning …".

## Varukorg

- [ ] Overallen visar fyra bilder (fram, bak, två sidor). Pilarna på bildens sidor glider mjukt till nästa och föregående bild, och efter sista bilden börjar den om. Miniatyrerna och piltangenterna fungerar också.
- [ ] På mobilen går det att svepa mellan bilderna, och sidan scrollar fortfarande uppåt och nedåt som vanligt.
- [ ] Rullistan på varje produkt visar bara storlekar/färger som finns i lager. **Lägg till** utan val ger "Välj … först".
- [ ] Att lägga till overall, sprayfärg och pennor ökar siffran på **Varukorg** i sidhuvudet. På mobilen syns raden "Till kassan" längst ner.
- [ ] Varukorgen finns kvar efter omladdning av sidan och i en ny flik.
- [ ] I kassan fungerar + / − och **Ta bort**, och totalen räknas om. En tom varukorg visar "Varukorgen är tom".
- [ ] Sätt lagret för en vara i varukorgen till 0 i Supabase och skicka: ingen order skapas, och meddelandet säger vilken vara som tagit slut.
- [ ] Efter en lyckad beställning är varukorgen tom.

## Kassan och validering

- [ ] Postnummer utanför Kungsbacka: "Hämta på en skola" går inte att välja, och frakten 49 kr läggs till i totalen.
- [ ] Postnummer 434 30: skolhämtning väljs, listan med gymnasieskolor visas och frakten blir Gratis. Utan vald skola visas "Välj vilken skola …".
- [ ] Skolan och frakten syns i orderbekräftelsen, mejlet, admin och CSV:n, och Swish-beloppet är varor + frakt.
- [ ] Att skicka ett tomt formulär ger svenska felmeddelanden vid varje fält och en sammanfattning högst upp.
- [ ] Felaktig e-post (`test@`), postnummer med 4 siffror, namn utan efternamn och felaktigt mobilnummer ger tydliga fel.
- [ ] Det går inte att beställa utan att kryssa i godkännandet av köpvillkoren.
- [ ] Mobilnummer och kommentar går att lämna tomma.
- [ ] Med tangentbordet (Tab) går det att nå alla fält, och fokus syns tydligt.

## Beställning och e-post

- [ ] Orderbekräftelsesidan visar **Följ din order**. Sätt ordern till Betald i admin: inom ca 20 sekunder byts steget till "Betalning bekräftad" utan att sidan laddas om.

- [ ] En testbeställning ger ordernummer `SS-2026-0001` (sedan 0002 …) och leder till orderbekräftelsen.
- [ ] Lagret i Supabase ändras **inte** när en order skapas. När ordern sätts till Betald minskar lagret med rätt antal. Tabellen `order_items` har en rad per vara.
- [ ] Kunden får ett bekräftelsemejl (inte i skräpposten) med ordernummer, sammanfattning och Swish-instruktioner.
- [ ] Studentstil får en notis till `SHOP_EMAIL`.
- [ ] Länken i mejlet öppnar orderbekräftelsen.
- [ ] En ändrad länk (fel token) ger "Vi hittar inte beställningen".

## Swish läge A

- [ ] **Mobil (iPhone och Android):** ett tryck på **Betala med Swish** öppnar Swish-appen direkt med rätt nummer, **hela varukorgens belopp** och ordernumret som meddelande. Fälten går inte att ändra.
- [ ] **Dator:** en QR-kod visas. Skanna den med Swish-appen och kontrollera samma uppgifter.
- [ ] Gör en riktig betalning på 1 kr (tillfällig testprodukt) och kontrollera att den syns i Swish Företag-appen med ordernumret.
- [ ] Efter betalning i appen kommer kunden tillbaka till orderbekräftelsen.
- [ ] Sätt ordern till **Betald** i admin. Kunden får mejlet "Betalning mottagen" och orderbekräftelsen visar Betald.
- [ ] Sätt ordern till **Skickad**. Kunden får mejlet "På väg".
- [ ] Ta bort testprodukten och testordrarna efteråt.

## Swish läge B (bara om ni byter till Swish Handel)

- [ ] Hela flödet testat i Swish testmiljö (MSS) med testcertifikat.
- [ ] Mobil: appen öppnas via betalförfrågan. Efter betalning blir ordern **Betald** automatiskt och kunden får mejl.
- [ ] Dator: QR-koden visas och orderbekräftelsen uppdateras av sig själv efter betalning.
- [ ] En avbruten betalning lämnar ordern som **Väntar på betalning**, och kunden kan försöka igen.
- [ ] Skarpt certifikat och `SWISH_API_BASE` för produktion är inlagda. En skarp betalning på 1 kr är testad.

## QR-koder

- [ ] Skapa en QR-affisch för t.ex. `skolan` och ladda ner både PNG och PDF.
- [ ] PDF:en skrivs ut skarpt i A4 och A5.
- [ ] Den utskrivna koden skannad med iPhone och Android leder till `/bestall/?kalla=qr-skolan`, och sidan laddar snabbt på mobildata.
- [ ] En beställning via QR-koden får källan `qr-skolan` i admin, även om man först klickar runt på sajten.
- [ ] En beställning direkt via sajten får källan `webb`.

## Admin

- [ ] Fel lösenord ger "Fel användarnamn eller lösenord". Efter för många försök kommer meddelandet om att vänta.
- [ ] Inloggning som `admin` visar riktiga ordrar.
- [ ] Inloggning som `demo` visar bannern **Demoläge** och bara påhittade namn (`@example.com`). Statusändringar sparas inte.
- [ ] Sök, alla filter (status, klass, storlek, källa) och sortering på kolumnrubriker fungerar.
- [ ] **Avbruten** frågar om bekräftelse. Var ordern betald läggs varan tillbaka i lager.
- [ ] Sammanställningen visar rätt antal per storlek, klass och källa och rätt totalsumma.
- [ ] CSV-exporten öppnas i Excel med å, ä, ö och rätt kolumner.
- [ ] Filtrera på "Betald" och tryck **Skriv ut ordrar**: en packsedel per order (ordernummer, leverans/skola, varor med kryssrutor, totalt), och ingen sedel delas mellan två sidor.
- [ ] **Logga ut** fungerar. Att sedan gå tillbaka till `/admin/` kräver ny inloggning.

## Efter lansering

- [ ] Netlify → Logs → Functions visar inga fel efter de första beställningarna.
- [ ] Nästa dag: loggen för `dailyMaintenance` visar "Underhåll klart".
