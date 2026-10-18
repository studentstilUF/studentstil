/**
 * Försäljningskälla. Läses från länkens ?kalla=… (t.ex. ?kalla=qr-skolan) så att
 * vi ser vilken kanal som säljer bäst. Utan parameter blir källan "webb".
 */
export const DEFAULT_SOURCE = 'webb';

export function normalizeSource(raw: string | null | undefined): string {
  if (raw == null) return DEFAULT_SOURCE;
  const cleaned = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // ta bort accenter: "mässa" → "massa"
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/gu, '-')
    .replace(/[^a-z0-9-]/gu, '')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 40);
  return cleaned === '' ? DEFAULT_SOURCE : cleaned;
}

export type Channel = 'QR' | 'Webb';

/** Grov kanal: allt som börjar med "qr" räknas som QR, resten som Webb. */
export function sourceChannel(source: string): Channel {
  return source.startsWith('qr') ? 'QR' : 'Webb';
}
