# DNS-poster för studentstil.se hos Loopia

Loopia Kundzon → **studentstil.se → DNS-editor**. Lägg till posterna nedan och ta bort
gamla A- och CNAME-poster på `@` och `www` som pekar på Loopias parkeringssida.
Det kan ta från några minuter upp till ett dygn innan ändringarna syns överallt.

## 1. Webbsidan (Netlify)

| Värdnamn | Typ | Värde |
|---|---|---|
| `@` | A | `75.2.60.5` |
| `www` | CNAME | `hilarious-fudge-b24cee.netlify.app` |

Kontroll: Netlify → projektet → **Domain management**. "Pending DNS verification" ska
försvinna, och HTTPS-certifikatet (Let's Encrypt) skapas automatiskt efteråt.

## 2. E-post (Resend), steg 1: bevisa att ni äger domänen

Domänen var tidigare kopplad till ett annat Resend-konto. Den här posten flyttar den
till kontot studentstilkungsbacka.

| Värdnamn | Typ | Värde |
|---|---|---|
| `@` | TXT | `resend-domain-verification=5739afca63146c458d09961cd306961b` |

Tryck sedan **I've added the records** i Resend.

## 3. E-post (Resend), steg 2: avsändarposter

Resend visar dessa först när steg 2 är verifierat. DKIM-nyckeln (`resend._domainkey`)
är unik för kontot. Kopiera den exakt från Resend → Domains → studentstil.se.

| Värdnamn | Typ | Värde |
|---|---|---|
| `resend._domainkey` | TXT | *(lång nyckel från Resend)* |
| `send` | MX | *(från Resend, t.ex. `feedback-smtp.eu-west-1.amazonses.com`, prioritet 10)* |
| `send` | TXT | *(från Resend, börjar med `v=spf1`)* |
| `_dmarc` | TXT | `v=DMARC1; p=none;` |

Om Resend visar andra värden än här är det Resends som gäller.

## 4. Efter att DNS fungerar

- Netlify → Environment variables: byt `SITE_URL` och `VITE_SITE_URL` till
  `https://studentstil.se` och publicera om.
- Resend → API Keys: skapa en nyckel med **Sending access** och lägg in den som
  `RESEND_API_KEY` i Netlify (aldrig i chatten eller i koden).
