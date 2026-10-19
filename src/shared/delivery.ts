/**
 * Leverans för vanliga beställningar:
 *  - "skola": kunden hämtar paketet på en gymnasieskola i Kungsbacka – gratis.
 *    Går bara att välja med en adress i Kungsbacka kommun.
 *  - "hem":   vi skickar paketet till kundens adress – fraktkostnad tillkommer.
 *
 * Fraktpriset finns även i create_order i supabase/schema.sql (det riktiga
 * priset). Ändra på båda ställena.
 */
import * as v from 'valibot';

/** Fraktkostnad i kronor när paketet skickas hem. */
export const SHIPPING_FEE_SEK = 49;

/** Gymnasieskolor i Kungsbacka där man kan hämta sitt paket. Ändra listan här. */
export const KUNGSBACKA_SCHOOLS = [
  'Aranäsgymnasiet',
  'Elof Lindälvs gymnasium',
  'Beda Hallbergs gymnasium',
  'Drottning Blankas gymnasieskola Kungsbacka',
  'Ljud & Bildskolan Kungsbacka',
  'Praktiska gymnasiet Kungsbacka',
  'Sveriges Ridgymnasium Kungsbacka',
] as const;

export const DeliverySchema = v.picklist(['skola', 'hem'], 'Välj hur du vill få din beställning.');
export type Delivery = v.InferOutput<typeof DeliverySchema>;

/**
 * Ligger postnumret i Kungsbacka kommun? Kungsbacka, Onsala, Fjärås, Frillesås
 * och Åsa har 434 xx och 439 xx, Särö och Kullavik 429 3x–429 4x.
 */
export function isKungsbackaPostalCode(postalCode: string): boolean {
  const digits = postalCode.replace(/\s/gu, '');
  return /^(434|439)\d{2}$/u.test(digits) || /^429[34]\d$/u.test(digits);
}

/** Fraktkostnaden för ett leveranssätt. */
export function shippingFee(delivery: Delivery): number {
  return delivery === 'hem' ? SHIPPING_FEE_SEK : 0;
}

/** "Hämtas på Aranäsgymnasiet", "Hemleverans" eller "Levereras till skolan" (klassbeställning). */
export function deliveryLabel(order: {
  kind: 'privat' | 'klass';
  delivery: Delivery;
  school: string | null;
}): string {
  if (order.kind === 'klass') return `Levereras till ${order.school ?? 'skolan'}`;
  return order.delivery === 'skola' ? `Hämtas på ${order.school ?? 'skolan'}` : 'Hemleverans';
}

/** "Gratis" eller t.ex. "49 kr". */
export function shippingLabel(shippingSek: number): string {
  return shippingSek === 0 ? 'Gratis' : `${String(shippingSek)} kr`;
}
