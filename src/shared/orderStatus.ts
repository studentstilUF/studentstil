/** Orderstatusar. Samma värden som typen order_status i supabase/schema.sql. */
export const ORDER_STATUSES = [
  'vantar_betalning',
  'betald',
  'packad',
  'skickad',
  'levererad',
  'avbruten',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Statusar som går att välja i admin. "Packad" och "Levererad" används inte
 * längre men finns kvar i databasen så att gamla ordrar fortfarande kan läsas.
 */
export const SELECTABLE_STATUSES = [
  'vantar_betalning',
  'betald',
  'skickad',
  'avbruten',
] as const satisfies readonly OrderStatus[];

export const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  vantar_betalning: 'Väntar på betalning',
  betald: 'Betald',
  packad: 'Packad',
  skickad: 'Skickad',
  levererad: 'Levererad',
  avbruten: 'Avbruten',
};

/** Statusar där kunden har betalat (räknas som försäljning). */
export const PAID_STATUSES: readonly OrderStatus[] = ['betald', 'packad', 'skickad', 'levererad'];

export function isPaid(status: OrderStatus): boolean {
  return PAID_STATUSES.includes(status);
}
