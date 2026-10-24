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

Ägarbeviset i steg 2 är klart (2026-10-24). Lägg nu in de här posterna. DKIM-nyckeln
(`resend._domainkey`) är unik för kontot och måste kopieras exakt, på en rad.

| Värdnamn | Typ | Värde |
|---|---|---|
| `resend._domainkey` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC5HuokyfI9YWD7CKPYNHAeKN6nz20QBHLR+pQcN7TjTUKui5ePs75ssp3ixEgVQ/N0joEknqoRGf+PYZIXG31gMD4hPLr/FWuA46EJNDkU+WsJRpxv1H7kTVhTUT17VVt8xheI/5JaCXr3kU7YQcPkxkbHK9hcKhSABql1yp7cOQIDAQAB` |
| `rsend` | CNAME | `rsend-euw1.forge.rmta.net` |
| `send` | CNAME | `send.forge.rmta.net` |
| `_dmarc` | TXT | `v=DMARC1; p=none;` |

Tryck sedan **I've added the records** i Resend → Domains → studentstil.se.

Om Resend visar andra värden än här är det Resends som gäller.

## 4. Efter att DNS fungerar

- Netlify → Environment variables: byt `SITE_URL` och `VITE_SITE_URL` till
  `https://studentstil.se` och publicera om.
- Resend → API Keys: skapa en nyckel med **Sending access** och lägg in den som
  `RESEND_API_KEY` i Netlify (aldrig i chatten eller i koden).
