/** Små färgprickar för färgvarianter (t.ex. sprayfärgen), så att man ser färgen direkt. */
import { h } from './dom.ts';

/** Färgnamn i databasen (product_sizes.size) → färgen som visas. Lägg till nya färger här. */
const COLORS: Readonly<Record<string, string>> = {
  // Starka, tydliga färger.
  Gul: '#f5c400',
  Grön: '#2e9e4f',
  Orange: '#f07a1a',
  Rosa: '#ee6fa8',
  Blå: '#1f5fd1',
  Röd: '#d62b2b',
  Svart: '#111111',
  // Guld med glitter: små ljusa prickar ovanpå en metallisk gradient.
  Guld: [
    'radial-gradient(circle at 25% 30%, rgb(255 255 255 / 0.95) 0 1px, transparent 1.5px)',
    'radial-gradient(circle at 70% 25%, rgb(255 255 255 / 0.8) 0 0.8px, transparent 1.3px)',
    'radial-gradient(circle at 55% 65%, rgb(255 250 220 / 0.9) 0 1px, transparent 1.5px)',
    'radial-gradient(circle at 30% 75%, rgb(255 255 255 / 0.7) 0 0.7px, transparent 1.2px)',
    'radial-gradient(circle at 80% 70%, rgb(255 245 200 / 0.85) 0 0.8px, transparent 1.3px)',
    'linear-gradient(135deg, #f1e2a6, #cfae55 45%, #a8862f 70%, #e6cf86)',
  ].join(', '),
  Vit: '#ffffff',
};

/** En prick i varianten färg, eller null om färgen är okänd (t.ex. en storlek). */
export function colorSwatch(name: string): HTMLSpanElement | null {
  const color = COLORS[name];
  if (color === undefined) return null;
  const swatch = h('span', { class: 'swatch', 'aria-hidden': 'true' });
  swatch.style.setProperty('--swatch', color);
  return swatch;
}
