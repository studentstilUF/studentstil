# Studentstil – webbshop

Webbshop för UF-företaget Studentstil. Kunderna beställer på mobilen, eller via en QR-kod på skolan eller en mässa, och betalar med Swish. Ni hanterar ordrarna i en inloggningsskyddad adminpanel.

Guiden är skriven för dig som inte har gjort så här förut. Följ stegen i ordning.

---

## Innehåll

1. [Översikt – hur allt hänger ihop](#1-översikt--hur-allt-hänger-ihop)
2. [Teknikval och varför](#2-teknikval-och-varför)
3. [Mappstruktur](#3-mappstruktur)
4. [Installera verktygen](#4-installera-verktygen)
5. [Sätt upp databasen (Supabase)](#5-sätt-upp-databasen-supabase)
6. [Kör sajten lokalt](#6-kör-sajten-lokalt)
7. [Driftsättning: GitHub + Netlify](#7-driftsättning-github--netlify)
8. [Miljövariabler](#8-miljövariabler)
9. [Koppla domänen från Loopia](#9-koppla-domänen-från-loopia)
10. [SSL (HTTPS)](#10-ssl-https)
11. [E-post med Resend](#11-e-post-med-resend)
12. [Swish: läge A och läge B](#12-swish-läge-a-och-läge-b)
13. [QR-koder för fysisk försäljning](#13-qr-koder-för-fysisk-försäljning)
14. [Adminpanelen](#14-adminpanelen)
15. [Underhåll](#15-underhåll)
16. [Säkerhet – vad som skyddar sajten](#16-säkerhet--vad-som-skyddar-sajten)
17. [Felsökning](#17-felsökning)

Innan lansering: gå igenom [TESTLISTA.md](TESTLISTA.md).

---

## 1. Översikt – hur allt hänger ihop

```
  Kundens mobil/dator
          │  https://studentstil.se
          ▼
  ┌──────────────────────────────┐
  │ Netlify                      │
  │  • Sidorna (HTML/CSS/JS)     │
  │  • Netlify Functions (/api)  │──── e-post ───▶ Resend ──▶ kundens inkorg
  └──────────────┬───────────────┘
                 │ hemlig nyckel (bara på servern)
                 ▼
        Supabase (databas i EU)
        produkter, lager, ordrar

  Swish: läge A = kunden betalar till ert Swish-nummer (ni bekräftar i adminpanelen)
         läge B = Swish Handel-API, betalningen bekräftas automatiskt
```

**Köpflödet:**

1. Kunden väljer storlek eller färg på `/bestall/` och trycker **Lägg till**. Hen kan lägga flera produkter i varukorgen, t.ex. overall, sprayfärg och pennor. Varukorgen sparas i webbläsaren.
2. I `/kassa/` ändrar kunden antal, fyller i sina uppgifter och skickar beställningen.
3. Servern kontrollerar uppgifterna, minskar lagret för **alla** varor i samma transaktion och skapar **en** order med status **Väntar på betalning** och ordernummer, t.ex. `SS-2026-0001`. Har en vara hunnit ta slut skapas ingen order, och kunden får veta vilken vara det gäller.
4. Kunden får ett bekräftelsemejl och kommer till `/order/`, där hen trycker **Betala med Swish**. Det är **en** betalning för hela varukorgen:
   - **Mobil:** knappen är en direktlänk till Swish-appen. Ett tryck öppnar appen med belopp, ert nummer och ordernumret ifyllt.
   - **Dator:** en QR-kod visas som kunden skannar med Swish-appen.
5. Ni ser betalningen i Swish-appen och sätter ordern till **Betald** i adminpanelen. Kunden får då ett mejl. Med Swish Handel (läge B) sker det här steget automatiskt.
6. Ni packar och skickar: **Packad**, sedan **Skickad** (kunden får mejl), sedan **Levererad**.

---

## 2. Teknikval och varför

| Del | Val | Varför |
|---|---|---|
| Frontend | HTML, CSS och TypeScript, byggt med **Vite** | Inget ramverk att lära sig. Sidorna är vanlig HTML som laddar snabbt på mobilen. TypeScript hittar fel innan de når kunderna. |
| Backend | **Netlify Functions** (mappen `netlify/functions/`) | Körs bara när någon anropar dem. Gratis upp till 125 000 anrop per månad. Ingen server att sköta. |
| Databas | **Supabase** (Postgres) | Riktig databas med transaktioner, så att två kunder inte kan köpa samma sista vara. Ni kan redigera produkter och lager i ett tabellverktyg i webbläsaren. Data lagras i EU (välj Stockholm). Gratisnivån räcker gott. |
| E-post | **Resend** | Gratis upp till 3 000 mejl per månad och enkelt API. |
| Kodkvalitet | strikt TypeScript, oxlint, oxfmt, Vitest | Enligt SI:s riktlinjer (se `CLAUDE.md`). Körs automatiskt före varje publicering. |

**Varför inte Netlify Blobs?** Blobs är enklare (inget extra konto), men det är en nyckel-värde-lagring utan transaktioner och sökfrågor. Lagerhantering ("finns det minst 1 kvar? minska i så fall med 1") och sammanställningar per klass och storlek blir mycket säkrare och enklare i en riktig databas.

**Nackdel med Supabase gratis:** projekt pausas efter en veckas inaktivitet. Funktionen `dailyMaintenance` anropar databasen varje natt, så det händer inte.

---

## 3. Mappstruktur

```
studentstil.se/
├── index.html                 Startsida
├── bestall/index.html         Produkter (hit leder QR-koderna)
├── produkt/index.html         Egen sida per produkt: /produkt/?id=studentoverall
├── kassa/index.html           Beställningsformulär
├── order/index.html           Orderbekräftelse + Swish-betalning
├── om-oss/  vanliga-fragor/  kopvillkor/  integritetspolicy/
├── admin/index.html           Adminpanel (dold, inloggning krävs)
├── 404.html                   "Sidan finns inte"
├── public/                    Filer som kopieras som de är (bilder, favicon, robots.txt)
│   └── bilder/                Produktbilder – byt mot riktiga foton
├── src/
│   ├── partials/              Sidhuvud och sidfot (gemensamma för alla sidor)
│   ├── styles/                main.css (design) och admin.css
│   ├── shared/                Kod som används både i webbläsaren och på servern
│   │   ├── orderInput.ts      Validering av formuläret (svenska felmeddelanden)
│   │   ├── apiTypes.ts        Formen på all data mellan webbläsare och server
│   │   └── …                  format, CSV, källa (webb/QR), statusar
│   └── client/                Kod som körs i webbläsaren
│       ├── pages/             En fil per sida (home, shop, checkout, confirmation)
│       └── admin/             Adminpanelen (ordrar, sammanställning, QR-affischer)
├── netlify/
│   ├── functions/             API:t – en fil per adress under /api/…
│   └── lib/                   Hjälpkod för servern (databas, e-post, Swish, inloggning)
│       └── swish/             manual.ts = läge A, commerce.ts = läge B
├── supabase/
│   ├── schema.sql             Tabeller, databasfunktioner och behörigheter
│   └── seed.sql               Exempelprodukter
├── scripts/hashPassword.ts    Skapar lösenordshash till adminkontot
├── netlify.toml               Netlify-inställningar (bygg, säkerhetsrubriker)
├── .env.example               Mall för miljövariabler
├── README.md                  Den här guiden
└── TESTLISTA.md               Checklista före lansering
```

---

## 4. Installera verktygen

Gör detta en gång på din dator.

1. **Node.js 24 (LTS):** ladda ner "LTS" från <https://nodejs.org> och installera. Kontrollera i en terminal:
   ```bash
   node --version
   ```
   Det ska stå `v24.…`.
2. **pnpm** (pakethanteraren, en säkrare variant av npm). Projektet anger själv vilken version som ska användas:
   ```bash
   corepack enable
   ```
3. **Git:** <https://git-scm.com/downloads>.
4. **Netlify CLI** (kör sajten och funktionerna lokalt):
   ```bash
   npm install -g netlify-cli
   ```
5. Installera projektets beroenden. Kör kommandot i projektmappen:
   ```bash
   pnpm install
   ```

> **Varför installeras bara paket som är minst 7 dagar gamla?** Det står i `pnpm-workspace.yaml` (`minimumReleaseAge`). Skadliga paketversioner upptäcks oftast inom några dagar, och väntetiden skyddar er mot dem. Om `pnpm install` klagar på att en version är "för ny", vänta några dagar eller välj en äldre version.

---

## 5. Sätt upp databasen (Supabase)

1. Skapa ett konto på <https://supabase.com> och klicka **New project**.
   - **Region:** *North EU (Stockholm)*. Då ligger kunddatan i Sverige.
   - Spara databaslösenordet i en lösenordshanterare. Det behövs sällan.
2. Öppna **SQL Editor → New query**. Klistra in hela `supabase/schema.sql` och klicka **Run**.
3. Gör likadant med `supabase/seed.sql` för att få in exempelprodukterna.
4. Öppna **Project Settings → API Keys** och kopiera:
   - **Project URL**, som blir `SUPABASE_URL`
   - **secret key** (`sb_secret_…`), eller i äldre projekt **service_role**, som blir `SUPABASE_SERVICE_ROLE_KEY`

   ⚠️ Den hemliga nyckeln ger full åtkomst till databasen. Lägg den bara i Netlify (och i lokala `.env`), aldrig i koden, på GitHub eller i en chatt.

**Ändra produkter, priser och lager:** öppna **Table Editor**. Tabellen `products` innehåller namn, beskrivning, pris (hela kronor inkl. moms), bild och `featured` (visas på startsidan). Kolumnen `gallery` innehåller fler bilder som visas efter huvudbilden (`image`). Kunden byter bild med miniatyrerna under bilden. Overallen har till exempel framsida, baksida och två sidovyer från `public/bilder/overall/`. Kolumnen `variant_label` bestämmer vad varianterna heter i butiken: `Storlek` (overallen) eller `Färg` (sprayfärg och spritpennor). Tabellen `product_sizes` innehåller varianterna (storlekar eller färger) och lagersaldo (`stock`). En variant med 0 i lager visas inte i rullistan.

---

## 6. Kör sajten lokalt

1. Kopiera `.env.example` till `.env` och fyll i värdena (se [Miljövariabler](#8-miljövariabler)). Lokalt ska `SITE_URL=http://localhost:8888`.
2. Skapa lösenordshashar:
   ```bash
   pnpm run hash-password
   ```
   Klistra in raden som börjar med `scrypt:` som `ADMIN_PASSWORD_HASH`. Kör kommandot igen med ett annat lösenord till `DEMO_PASSWORD_HASH`.
3. Starta:
   ```bash
   netlify dev
   ```
   Öppna <http://localhost:8888>. Ändringar i koden syns direkt.
   Utan `RESEND_API_KEY` skrivs mejlen ut i terminalen i stället för att skickas.

**Kontrollera koden** (görs automatiskt vid publicering, men kör gärna själv innan du pushar):

```bash
pnpm run check
```

```bash
pnpm test
```

`pnpm run format` formaterar koden automatiskt.

---

## 7. Driftsättning: GitHub + Netlify

### 7.1 Lägg koden på GitHub

1. Skapa ett konto på <https://github.com> och ett nytt **privat** repo, t.ex. `studentstil`. Kryssa inte i "Add README".
2. Kör i projektmappen:
   ```bash
   git init
   ```
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Första versionen av Studentstil"
   ```
   ```bash
   git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/DITT-KONTO/studentstil.git
   ```
   ```bash
   git push -u origin main
   ```
3. Kontrollera på GitHub att filen `.env` **inte** finns där. Den ska inte göra det, eftersom den står i `.gitignore`.

### 7.2 Koppla repot till Netlify

1. Logga in på <https://app.netlify.com> med ditt GitHub-konto.
2. Klicka **Add new site → Import an existing project → GitHub** och välj repot.
3. Netlify läser inställningarna från `netlify.toml`, så du behöver inte ändra något. Byggkommandot är `pnpm run check && pnpm test && pnpm run build` och publiceringsmappen är `dist`.
4. Lägg in miljövariablerna (nästa avsnitt) **innan** första bygget, eller kör **Deploys → Trigger deploy** efteråt.
5. Klart! Varje gång du kör `git push` bygger och publicerar Netlify automatiskt. Om typkontrollen, linten eller testerna fallerar publiceras **inte** den nya versionen, och den gamla ligger kvar.

**Tips:** gör ändringar i en egen gren (`git checkout -b ny-funktion`) och öppna en pull request. Netlify skapar då en förhandsvisning (deploy preview) med egen adress som du kan testa innan du slår ihop.

---

## 8. Miljövariabler

Lägg in dem i Netlify: **Site configuration → Environment variables → Add a variable**. Markera hemliga värden som **Contains secret values**.

| Variabel | Exempel / hur du får den | Hemlig? |
|---|---|---|
| `SITE_URL` | `https://studentstil.se` | Nej |
| `SUPABASE_URL` | Supabase → Project Settings → API | Nej |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → secret | **Ja** |
| `SESSION_SECRET` | Slumpad sträng, se `.env.example` | **Ja** |
| `ADMIN_PASSWORD_HASH` | `pnpm run hash-password` | **Ja** |
| `DEMO_PASSWORD_HASH` | `pnpm run hash-password` (valfri) | **Ja** |
| `SWISH_MODE` | `manual` (läge A) eller `commerce` (läge B) | Nej |
| `SWISH_PAYEE` | Ert Swish-nummer: `1237051824` | Nej |
| `RESEND_API_KEY` | Resend → API Keys | **Ja** |
| `EMAIL_FROM` | `Studentstil <order@studentstil.se>` | Nej |
| `SHOP_EMAIL` | `studentstilkungsbacka@gmail.com` – hit kommer notiser om nya ordrar och kundernas svar | Nej |
| `DATA_RETENTION_MONTHS` | `6` | Nej |
| `VITE_SITE_URL` | `https://studentstil.se` (QR-affischernas adress) | Nej |
| `SWISH_CERT_PEM`, `SWISH_KEY_PEM`, `SWISH_KEY_PASSPHRASE`, `SWISH_CA_PEM`, `SWISH_API_BASE` | Bara läge B, se avsnitt 12 | **Ja** |

Efter att du ändrat en variabel: **Deploys → Trigger deploy → Deploy site**.

**Byta adminlösenord:** skapa en ny hash med `pnpm run hash-password`, byt `ADMIN_PASSWORD_HASH` och publicera om. **Logga ut alla:** byt `SESSION_SECRET`.

---

## 9. Koppla domänen från Loopia

Först i Netlify: **Domain management → Add a domain → `studentstil.se`**. Netlify visar då exakt vilka DNS-poster som behövs. **Använd alltid värdena Netlify visar.** De kan ändras, och värdena nedan är bara exempel.

Det finns två sätt att göra kopplingen:

### Alternativ 1: Behåll DNS hos Loopia och peka om posterna (rekommenderas om ni har e-post hos Loopia)

I Loopia Kundzon → **Domäner → studentstil.se → DNS-editor**:

| Namn (värd) | Typ | Värde | Kommentar |
|---|---|---|---|
| `@` (studentstil.se) | **A** | `75.2.60.5` | Netlifys lastbalanserare. Kontrollera värdet i Netlify. |
| `www` | **CNAME** | `ditt-sajtnamn.netlify.app.` | Ditt sajtnamn hos Netlify |

Ta bort gamla A-, AAAA- och CNAME-poster för `@` och `www` som pekar på Loopias webbhotell. **Rör inte MX-posterna**, för de styr e-posten.

- ✅ E-post och andra poster hos Loopia fortsätter fungera som vanligt.
- ✅ Ni har kvar allt på ett ställe hos Loopia.
- ❌ Loopia stödjer inte ALIAS/ANAME för huvuddomänen, så apex-domänen pekar på en fast IP-adress. Det fungerar bra men är lite mindre flexibelt än Netlify DNS.
- ❌ Nya poster (t.ex. för Resend) läggs in manuellt hos Loopia.

### Alternativ 2: Byt namnservrar till Netlify DNS

I Netlify: **Domain management → studentstil.se → Set up Netlify DNS**. Netlify ger fyra namnservrar (t.ex. `dns1.p0X.nsone.net`). I Loopia Kundzon → **Domäner → studentstil.se → Namnservrar**: välj *Egna namnservrar* och fyll i Netlifys fyra.

- ✅ Netlify sköter allt automatiskt: apex, www, SSL och förhandsvisningar.
- ✅ Snabbast och minst att göra rätt.
- ❌ **All DNS flyttar till Netlify.** Har ni e-post hos Loopia måste MX-, SPF- och andra poster läggas in igen hos Netlify, annars slutar e-posten fungera.
- ❌ Det kan ta upp till 24–48 timmar innan ändringen slagit igenom överallt.

**Rekommendation:** har ni e-post via Loopia, välj alternativ 1. Annars är alternativ 2 enklast.

Ställ till sist in `studentstil.se` som **Primary domain** i Netlify. Då skickas `www.studentstil.se` vidare automatiskt.

---

## 10. SSL (HTTPS)

Netlify skaffar ett gratis certifikat från Let's Encrypt automatiskt när DNS pekar rätt.

1. **Domain management → HTTPS → Verify DNS configuration → Provision certificate.**
2. Vänta några minuter. Står det att DNS inte är verifierat, vänta en stund (ibland upp till ett dygn) och försök igen.
3. HTTP skickas automatiskt vidare till HTTPS. `netlify.toml` sätter dessutom HSTS, så att webbläsare alltid använder HTTPS för sajten.

---

## 11. E-post med Resend

1. Skapa konto på <https://resend.com> → **Domains → Add domain → `studentstil.se`** (region EU).
2. Resend visar några DNS-poster (TXT för SPF/DKIM, ev. MX för en underdomän). Lägg in dem där er DNS ligger: hos Loopia (alternativ 1) eller i Netlify DNS (alternativ 2). Det skyddar mot att mejlen hamnar i skräpposten.
3. När domänen är **Verified**: **API Keys → Create API Key** (behörighet *Sending access*) → lägg in som `RESEND_API_KEY` i Netlify.
4. `EMAIL_FROM` måste vara en adress på den verifierade domänen, t.ex. `Studentstil <order@studentstil.se>`. Den adressen behöver inte ha någon inkorg. Svarar en kund på ett mejl hamnar svaret hos `SHOP_EMAIL` (studentstilkungsbacka@gmail.com). En Gmail-adress kan **inte** vara avsändare via Resend, eftersom Resend bara skickar från domäner ni själva äger.

Mejl som skickas:
- **"Orderbekräftelse … – väntar på betalning"** direkt när ordern skapas, med sammanfattning, Swish-länk och knappen **Följ din order**. Det står inget tack än, eftersom kunden inte har betalat. Orderbekräftelsesidan visar stegen Beställning mottagen → Betalning bekräftad → Packad → Skickad → Levererad och uppdateras automatiskt när ni ändrar status i admin.
- notis till `SHOP_EMAIL` om den nya ordern
- **"Tack för din beställning"** när ordern blir **Betald**
- **"På väg"** när ordern blir **Skickad** Texterna finns i `netlify/lib/emailTemplates.ts`.

---

## 12. Swish: läge A och läge B

All Swish-kod finns i `netlify/lib/swish/`. Resten av koden pratar bara med `swishProvider()`, så **byte av läge = byt miljövariabeln `SWISH_MODE`**.

### Läge A – Swish Företag (det här kör Studentstil)

> **Beslut 2026-10-22:** banken erbjuder inte Swish Handel till Studentstil, så sajten kör läge A med manuell avstämning. Koden för läge B ligger kvar men används inte så länge `SWISH_MODE` inte är `commerce`.

**Daglig avstämning (5 min):**
1. Öppna Swish Företag-appen och gå igenom dagens inbetalningar.
2. I adminpanelen: filtrera på **Väntar på betalning**.
3. För varje inbetalning: hitta ordern med samma ordernummer (Swish-meddelandet) och kontrollera att beloppet stämmer.
4. Sätt ordern till **Betald**. Kunden får mejlet "Tack för din beställning" och sidan Följ din order uppdateras.
5. Har någon betalat fel belopp eller glömt ordernumret: kontakta kunden innan ni markerar ordern.

`SWISH_MODE=manual`. Kräver bara ett Swish Företag-nummer från er bank. Många banker har paket för UF-företag.

- Mobil: knappen **Betala med Swish** är en vanlig länk, `swish://payment?data=…`, som är färdig redan när sidan laddats. Därför öppnas Swish-appen på första trycket, även i Safari på iPhone, med nummer, belopp och meddelande (ordernumret) ifyllda och låsta.
- Dator: QR-kod med samma uppgifter (Swish-formatet `C<nummer>;<belopp>;<meddelande>;0`).
- **Swish meddelar inte webbshoppen när någon betalat.** Kontrollera därför inbetalningarna i Swish Företag-appen. Meddelandet är ordernumret. Sätt sedan ordern till **Betald** i adminpanelen. Kunden får ett mejl automatiskt.

### Läge B – Swish Handel (automatiskt)

`SWISH_MODE=commerce`. Kräver avtal om **Swish Handel** med banken (inte alla banker erbjuder det till UF-företag, så fråga) och ett klientcertifikat.

Så fungerar det: när kunden trycker **Betala** skapar `netlify/functions/swishStart.ts` en betalförfrågan via Swish API med ert certifikat. Swish-appen öppnas (mobil) eller en QR-kod visas (dator). När kunden betalat anropar Swish `https://studentstil.se/api/swish/callback`. Funktionen hämtar då betalningen direkt från Swish för att kontrollera den, jämför belopp och ordernummer och sätter ordern till **Betald**. Orderbekräftelsen uppdateras av sig själv.

**Byta till läge B:**

1. Teckna Swish Handel hos banken. Ni får ett Swish-nummer för Handel.
2. Logga in i **Swish Certificate Management** (via bankens instruktioner) och skapa ett klientcertifikat. Spara certifikat och privat nyckel som PEM-text. Lägg aldrig filerna i projektmappen.
3. **Testa först i Swish testmiljö (MSS)** med Swish testcertifikat från <https://developer.swish.nu>:
   ```
   SWISH_MODE=commerce
   SWISH_API_BASE=https://mss.cpc.getswish.net/swish-cpcapi
   SWISH_CERT_PEM=…   SWISH_KEY_PEM=…   SWISH_KEY_PASSPHRASE=…
   ```
   Gör det i en deploy preview eller på en separat testsajt, inte på den skarpa sajten.
4. När allt fungerar: byt till de skarpa värdena (`SWISH_API_BASE=https://cpc.getswish.net/swish-cpcapi`, skarpt certifikat, Handel-numret i `SWISH_PAYEE`) och publicera om.

**Om certifikat i miljövariabler:** klistra in PEM-texten med radbrytningar i Netlifys fält, eller skriv `\n` där radbrytningarna ska vara. Funktionerna på Netlify har en gräns på cirka **4 KB för alla miljövariabler tillsammans**. Blir certifikaten för stora, se till att nyckeln inte innehåller onödiga certifikatkedjor, eller kontakta Netlify support.

> ⚠️ Läge B är skrivet enligt Swish dokumentation och testat med enhetstester, men **inte** körts mot Swish riktiga API. Gör hela testlistan för läge B i MSS innan ni går live.

---

## 13. QR-koder för fysisk försäljning

Adminpanelen → fliken **QR-koder**:

1. Skriv plats/event, t.ex. `skolan`. Koden leder då till `https://studentstil.se/bestall/?kalla=qr-skolan`. Lämna tomt för en allmän kod (`?kalla=qr`).
2. Ändra rubrik och underrubrik, och välj **A4** (affisch) eller **A5** (bordsskylt).
3. **Ladda ner PNG** (för sociala medier och digitala skärmar) eller **Ladda ner PDF** (för utskrift).

Alla ordrar märks med sin källa. Ordrar via sajten får `webb` och ordrar via QR-koder `qr`, `qr-skolan`, `qr-massa` osv. Under **Sammanställning → Per kanal / Per källa** ser ni vilken kanal och vilken plats som säljer bäst. Källan följer med även om kunden klickar runt på sajten innan hen beställer.

**Testa alltid en utskriven QR-kod med en mobil innan ni sätter upp den.**

---

## 13b. Klassbeställning

`/klassbestallning/` är till för klassrepresentanter. De fyller i antal overaller per storlek, antal sprayburkar per färg och antal pennset, plus kontaktuppgifter, skola, klass och leveransadress. Allt blir **en order**, som betalas med en Swish-betalning.

- **Klasspris:** med minst **25 overaller** i beställningen gäller klasspris på alla varor som har ett sådant. Klasspriset står i kolumnen `bulk_price_sek` i `products` (Supabase → Table Editor). Tomt betyder ingen rabatt på den varan.
- **Gränsen 25** står på två ställen, som måste ändras tillsammans: i `create_order` i `supabase/schema.sql` (det riktiga priset) och i `src/shared/classOrder.ts` (det som visas på sidan).
- En klassbeställning får ha upp till 500 st av samma vara. En vanlig varukorg får ha högst 10.
- Klassbeställningar märks **Klassbeställning** i adminpanelen. Välj "Klassbeställningar" under **Typ / källa** för att se bara dem.
- Kontrollera att lagret räcker innan stora klasser beställer. Om en storlek inte räcker skapas ingen order, och klassrepresentanten får veta vilken vara det gäller.

## 13d. Kampanj för de första kunderna

- De **5 första vanliga beställningarna** som innehåller en overall får **en återbetalning för en overall** (en per order). Alla betalar fullt pris. Ordern märks "Återbetala en overall" i admin med beloppet, och ni gör återbetalningen när betalningen är registrerad.
- De **5 första klassbeställningarna** får **ett flak Celsius**. Det syns som en gul etikett "Flak Celsius" i admin och på packsedeln, så glöm inte att packa med det.
- Avbrutna ordrar räknas inte, så platsen går vidare till nästa kund. Räkningen sker i `create_order` i `supabase/schema.sql`, och texten på startsidan står i `index.html`. Ta bort rutan där när kampanjen är slut.

## 13c. Leverans

Kunden väljer leverans i kassan:

- **Hämta på en skola i Kungsbacka (gratis).** Valet blir klickbart när kunden skriver ett postnummer i Kungsbacka kommun (434 xx, 439 xx, 429 3x–4x). Då visas en lista med gymnasieskolorna, och kunden klickar i sin skola. Skolan syns i admin (blå etikett under adressen) och i CSV-kolumnen Leverans. Listan ändras i `src/shared/delivery.ts`.
- **Hemleverans (49 kr, klassbeställningar 25 kr per overall men minst 49 kr).** Fraktpriserna står på två ställen som måste ändras tillsammans: `SHIPPING_FEE_SEK` i `src/shared/delivery.ts` och `create_order` i `supabase/schema.sql` (det riktiga priset).

Kunden fyller i sin adress i kassan. Produkterna köps in från olika leverantörer, så ni samlar ihop varorna och packar och skickar varje order själva. Använd CSV-exporten i adminpanelen som packlista. Sätt ordern till **Skickad** i admin när paketet lämnats in, så får kunden mejlet "På väg".

## 14. Adminpanelen

Gå till `https://studentstil.se/admin/`. Sidan länkas inte från sajten och indexeras inte av Google.

- **Användarnamn `admin`** + ert lösenord: riktiga ordrar.
- **Användarnamn `demo`** + demolösenordet: **bara påhittad data** (skapas i `netlify/lib/demoData.ts`). Inga riktiga kunduppgifter kan visas, och ändringar sparas inte. Använd det på UF-mässor.

**Ordrar:** varje order visar alla sina varor i kolumnen **Varor**, t.ex. "1 × Studentoverall, **M**" och "2 × Sprayfärg, **Gul**". Sök på namn, e-post, ordernummer, adress eller produkt. Filtrera på status, klass, vara (produkt + storlek/färg) och källa. Klicka på en kolumnrubrik för att sortera. Ändra status direkt i rullistan. Om en order avbryts läggs alla dess varor tillbaka i lager.

**Exportera CSV (Excel):** exporterar ordrarna som visas just nu, med de filter du valt. Filen har **en rad per vara**, med orderns uppgifter på varje rad, vilket gör den bra som packlista. Kolumnen *Ordertotal* finns med för bokföringen. Filen öppnas direkt i Excel med svenska tecken.

**Sammanställning:** betald försäljning, obetalt belopp, antal sålda per produkt, per storlek/färg, per klass, per produkt+storlek/färg (bra för inköp) och per kanal/källa.

Inloggningen gäller i 8 timmar. Efter 10 felaktiga försök från samma IP-adress spärras inloggningen i 15 minuter.

---

## 15. Underhåll

- **Produkter och lager:** Supabase → Table Editor (se avsnitt 5). Nya produktbilder läggs i `public/bilder/`, sedan uppdaterar du `image` i tabellen, t.ex. `/bilder/min-bild.jpg`. Använd kvadratiska bilder, gärna under 200 KB.
- **Produktsidornas fakta och storleksguide:** finns i `src/client/productInfo.ts`, en post per produkt-id. Namn, pris, beskrivning, bilder och lager kommer från Supabase.
- **Texter på sidorna:** redigera HTML-filerna (`index.html`, `om-oss/index.html` …). Allt markerat med `[…]` / gul bakgrund måste fyllas i före lansering.
- **Design:** färger och mått finns överst i `src/styles/main.css` under `:root`.
- **GDPR-rensning:** sker automatiskt varje natt (`netlify/functions/dailyMaintenance.ts`). Kunduppgifter anonymiseras `DATA_RETENTION_MONTHS` månader efter att ordern skickats eller avbrutits. Ordernummer, produkt och belopp sparas för bokföringen. Vill en kund bli raderad tidigare: ändra uppgifterna i Supabase → Table Editor → `orders`.
- **Uppdatera beroenden** (ungefär en gång i månaden): kör `pnpm outdated`, sedan `pnpm update --latest`, därefter `pnpm run check` och `pnpm test`. Läs ändringarna innan du pushar.
- **Säkerhetskopior:** Supabase gratisnivå har begränsade backuper. Exportera ordrarna som CSV från adminpanelen med jämna mellanrum, och efter säsongen.
- **Loggar:** Netlify → **Logs → Functions** visar fel från servern.

---

## 16. Säkerhet – vad som skyddar sajten

| Skydd | Var |
|---|---|
| Alla hemligheter i miljövariabler, aldrig i koden | `netlify/lib/env.ts`, `.gitignore` |
| Databasen nås bara med hemlig nyckel från servern. RLS på alla tabeller. | `supabase/schema.sql` |
| Validering och sanering av all indata, både i webbläsaren och på servern | `src/shared/orderInput.ts` |
| Honeypot-fält mot spamrobotar | `kassa/index.html`, `netlify/functions/orders.ts` |
| Rate limiting: 5 beställningar per 10 min och 10 inloggningar per 15 min per IP (IP sparas bara som hash) | `netlify/lib/rateLimit.ts` |
| Lösenord hashade med scrypt, svarstid som inte avslöjar användarnamn | `netlify/lib/password.ts` |
| Inloggningscookie: signerad, HttpOnly, Secure, SameSite=Strict, 8 timmar | `netlify/lib/session.ts` |
| CSRF-skydd (Origin-kontroll) på alla anrop som ändrar data | `netlify/lib/http.ts` |
| Ingen `innerHTML` med data, all text escapas i mejl (skydd mot XSS) | `src/client/dom.ts`, `emailTemplates.ts` |
| Content-Security-Policy, HSTS, X-Frame-Options m.m. | `netlify.toml` |
| Swish-callback verifieras genom att hämta betalningen från Swish | `netlify/functions/swishCallback.ts` |
| Lager minskas atomiskt, så det blir ingen överförsäljning | `create_order` i `schema.sql` |
| Paket installeras först när de är minst 7 dagar gamla. Inga installationsskript körs. | `pnpm-workspace.yaml` |

---

## 17. Felsökning

| Problem | Lösning |
|---|---|
| "Miljövariabeln X saknas" i loggen | Lägg in variabeln i Netlify och publicera om. |
| Produkterna laddas inte | Kontrollera `SUPABASE_URL` och nyckeln, och att `schema.sql` och `seed.sql` körts. Se Netlify → Logs → Functions. |
| Mejl kommer inte fram | Är domänen verifierad i Resend? Matchar `EMAIL_FROM` domänen? Titta i skräpposten och i Resend → Logs. |
| Bygget misslyckas på Netlify | Öppna deployen och läs loggen. Oftast har `pnpm run check` eller `pnpm test` hittat ett fel. Kör samma kommando lokalt. |
| Swish-appen öppnas inte på mobilen | Är Swish installerat? Testa QR-koden i stället (knappen "Visa QR-kod i stället"). |
| "För många försök" | Rate limiting. Vänta 10–15 minuter. |
| Domänen fungerar inte | DNS kan ta upp till 48 h. Kontrollera posterna mot det Netlify visar under Domain management. |
