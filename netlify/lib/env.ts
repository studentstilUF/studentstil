/**
 * Läser miljövariabler. Alla hemligheter (nycklar, lösenordshashar, certifikat)
 * läggs in i Netlify under Site configuration → Environment variables – aldrig i koden.
 * Lokalt läser `netlify dev` dem från filen .env (se .env.example).
 */
export function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (value === undefined) {
    throw new Error(`Miljövariabeln ${name} saknas. Se README, avsnittet "Miljövariabler".`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/** Sajtens adress utan avslutande snedstreck, t.ex. https://studentstil.se */
export function siteUrl(): string {
  const url = optionalEnv('SITE_URL') ?? optionalEnv('URL') ?? 'http://localhost:8888';
  return url.replace(/\/+$/u, '');
}
