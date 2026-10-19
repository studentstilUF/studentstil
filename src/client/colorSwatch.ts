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
  // Guld: metallisk grundton. Glittret (korn som blinkar) läggs på med klassen swatch-glitter.
  Guld: 'linear-gradient(135deg, #f7e08a, #d4a929 45%, #a77d14 70%, #f0cf5f)',
  Vit: '#ffffff',
};

/** En prick i varianten färg, eller null om färgen är okänd (t.ex. en storlek). */
export function colorSwatch(name: string): HTMLSpanElement | null {
  const color = COLORS[name];
  if (color === undefined) return null;
  const swatch = h('span', { class: 'swatch', 'aria-hidden': 'true' });
  swatch.style.setProperty('--swatch', color);
  if (name === 'Guld') swatch.classList.add('swatch-glitter');
  return swatch;
}
