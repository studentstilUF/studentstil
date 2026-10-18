/**
 * Kommer kunden via en QR-kod (?kalla=qr-skolan) sparas källan för besöket,
 * så att den följer med till kassan även om kunden klickar runt först.
 */
import { DEFAULT_SOURCE, normalizeSource } from '../shared/source.ts';

const STORAGE_KEY = 'studentstil-kalla';

export function captureSource(): void {
  const fromUrl = new URLSearchParams(window.location.search).get('kalla');
  if (fromUrl === null) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, normalizeSource(fromUrl));
  } catch {
    // Privat läge kan blockera sessionStorage. Då gäller källan bara på den här sidan.
  }
}

export function currentSource(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('kalla');
  if (fromUrl !== null) return normalizeSource(fromUrl);
  try {
    return normalizeSource(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SOURCE;
  }
}
