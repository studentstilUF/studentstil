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

import { type OrderStatus, STATUS_LABELS } from './orderStatus.ts';

/** Fraktkostnad i kronor när paketet skickas hem. */
export const SHIPPING_FEE_SEK = 49;

/**
 * Klassbeställningar med hemleverans: frakt per overall (stora paket är dyra
 * att skicka), men aldrig lägre än SHIPPING_FEE_SEK.
 */
export const CLASS_SHIPPING_PER_OVERALL_SEK = 25;

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

/** Fraktkostnaden för ett leveranssätt. För klassbeställningar räknas den per overall. */
export function shippingFee(
  delivery: Delivery,
  kind: 'privat' | 'klass' = 'privat',
  overalls = 0,
): number {
  if (delivery === 'skola') return 0;
  if (kind === 'privat') return SHIPPING_FEE_SEK;
  return Math.max(SHIPPING_FEE_SEK, CLASS_SHIPPING_PER_OVERALL_SEK * overalls);
}

/** "Hämtas på Aranäsgymnasiet", "Hemleverans" eller "Levereras till skolan" (klassbeställning). */
export function deliveryLabel(order: {
  kind: 'privat' | 'klass';
  delivery: Delivery;
  school: string | null;
}): string {
  if (order.delivery === 'hem') return 'Hemleverans';
  const school = order.school ?? 'skolan';
  return order.kind === 'klass' ? `Levereras till ${school}` : `Hämtas på ${school}`;
}

/** "Gratis" eller t.ex. "49 kr". */
export function shippingLabel(shippingSek: number): string {
  return shippingSek === 0 ? 'Gratis' : `${String(shippingSek)} kr`;
}

/** Statusnamn som passar leveranssättet: skolhämtning blir "Klar att hämta" och "Hämtad". */
export function statusLabel(status: OrderStatus, delivery: Delivery): string {
  if (delivery === 'skola' && status === 'skickad') return 'Klar att hämta';
  if (delivery === 'skola' && status === 'levererad') return 'Hämtad';
  return STATUS_LABELS[status];
}

/** Länk till PostNords spårning för ett kollinummer. */
export function trackingUrl(trackingNumber: string): string {
  return `https://tracking.postnord.com/se/?id=${encodeURIComponent(trackingNumber)}`;
}
