/**
 * Studentpaketet: 1 studentoverall + 2 sprayfärger + 1 förpackning spritpennor.
 * För varje komplett paket i en vanlig beställning dras 5 % av paketets pris.
 * Storlek och färger får man välja fritt.
 *
 * Samma regel finns i create_order i supabase/schema.sql (det riktiga priset).
 * Ändra på båda ställena.
 */

export const BUNDLE_DISCOUNT_PERCENT = 5;

/** Vad som ingår i ett paket: produkt → antal. */
export const BUNDLE_CONTENTS = [
  { productId: 'studentoverall', quantity: 1 },
  { productId: 'sprayfarg', quantity: 2 },
  { productId: 'spritpenna', quantity: 1 },
] as const;

type Line = { productId: string; quantity: number };
type PricedProduct = { id: string; priceSek: number };

/** Hur många kompletta paket varukorgen innehåller. */
export function bundleCount(lines: readonly Line[]): number {
  return Math.min(
    ...BUNDLE_CONTENTS.map(({ productId, quantity }) => {
      const total = lines
        .filter((l) => l.productId === productId)
        .reduce((sum, l) => sum + l.quantity, 0);
      return Math.floor(total / quantity);
    }),
  );
}

/** Ordinarie pris för ett paket. */
export function bundlePrice(products: readonly PricedProduct[]): number {
  return BUNDLE_CONTENTS.reduce(
    (sum, { productId, quantity }) =>
      sum + (products.find((p) => p.id === productId)?.priceSek ?? 0) * quantity,
    0,
  );
}

/** Paketrabatten i hela kronor för en varukorg. */
export function bundleDiscount(lines: readonly Line[], products: readonly PricedProduct[]): number {
  return Math.round((bundleCount(lines) * bundlePrice(products) * BUNDLE_DISCOUNT_PERCENT) / 100);
}
