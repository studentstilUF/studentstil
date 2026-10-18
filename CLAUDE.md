# Studentstil — webbshop

Webbshop för Studentstil (UF-företag, studentkläder/-accessoarer). Hostas på Netlify,
domänen ligger hos Loopia. Backend är Netlify Functions, och alla hemligheter ligger i Netlifys miljövariabler.
Kod och kommentarer skrivs på svenska. Användaren är student, så förklara steg pedagogiskt.

## Utvecklingsriktlinjer (SI)

Följ SI:s riktlinjer i `C:\code\knowledgebase\*.md`:

- `frontend.md` — strikt tsconfig (TS7), oxlint, oxfmt, filnamnskonvention, Vitest + RTL
- `security.md` — supply-chain-härdning (särskilt avsnittet om pnpm: `minimumReleaseAge: 10080`,
  `allowBuilds`, `--frozen-lockfile`, exakta versioner) och CVE-scanning
- `containers.md`, `go.md`, `dotnet.md` — gäller bara om projektet får Docker, Go eller .NET

Prioritetsordning: projektets egen kod/CLAUDE.md > snävare KB-sektion > generell KB > egna vanor.
KB-kopian är en ögonblicksbild från 2026-10-18, och https://knowledge.dev.wearesi.se är källan till sanning.
Kontrollera mot den när du har nät och en detalj spelar roll.

Kontrollera ändringen mot de sidor som gäller innan du säger att den är klar. Minst:
`tsc --noEmit && oxlint --type-aware && oxfmt --check` och testerna.

Anpassning till detta projekt:
- TypeScript överallt, både frontend och Netlify Functions, med pnpm som pakethanterare.
- Versioner som anges i config eller docs måste ha klarat 7 dagars cooldown.
- Validera extern data (formulär, Swish-callback, databassvar) vid körning, t.ex. med zod/valibot,
  i stället för att använda typ-casts.

## Projektet

- Stack: Vite (flera sidor, ren TS utan ramverk), Netlify Functions (`netlify/functions/`), Supabase via REST
  och databasfunktioner (`supabase/schema.sql`), valibot för validering, Resend för e-post.
- Design: vit och minimalistisk (inte marinblått och guld). Tokens ligger i `src/styles/main.css` `:root`.
- Logotyp: bara kronan i sprayfärg (`public/logo/`, beskuren från `C:\code\pictures\studentstil_centered_logo.png`).
  Ordet STUDENTSTIL och "EST. 2026" i originalbilden ingår inte i logotypen och ska inte visas. Namnet skrivs som text.
- Produkter: studentoverall (storlek), sprayfärg och spritpenna (färg). Kolumnen `variant_label` styr etiketten.
  Overallens bilder (fram/bak/sidor) ligger i `public/bilder/overall/` och visas via kolumnen `gallery`.
- Varukorg: flera varor per order (`order_items`) och en Swish-betalning per order. Varukorgen sparas i localStorage.
- Swish läge A: "Betala med Swish" ska vara en riktig `swish://`-länk som är färdig när sidan laddats, så att den
  öppnar appen på första trycket. Använd aldrig navigering efter ett await, eftersom iOS Safari blockerar den.
- Swish: `SWISH_MODE=manual` (läge A) eller `commerce` (läge B). All Swish-kod finns i `netlify/lib/swish/`.
- Kommandon: `pnpm run check`, `pnpm test`, `pnpm run build` och `netlify dev` för lokal körning.
- README.md (guide för studenter) och TESTLISTA.md ska hållas uppdaterade när funktioner ändras.

## Miljö

- Windows 11 och PowerShell 5.1.
- Node.js, pnpm och Git saknades på datorn 2026-10-18 och måste installeras innan lokal körning.
