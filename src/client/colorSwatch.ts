/** Små färgprickar för färgvarianter (t.ex. sprayfärgen), så att man ser färgen direkt. */
import { h } from './dom.ts';

/** Färgnamn i databasen (product_sizes.size) → färgen som visas. Lägg till nya färger här. */
const COLORS: Readonly<Record<string, string>> = {
  Gul: '#f5c400',
  Grön: '#2e9e4f',
  Orange: '#f07a1a',
  Rosa: '#ee6fa8',
  Blå: '#1f5fd1',
  Röd: '#d62b2b',
  Svart: '#111111',
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
