/**
 * Klassbeställning: klasspris när klassen köper minst 25 studentoveraller.
 *
 * Den här uträkningen används för att visa priset på sidan /klassbestallning/.
 * Det riktiga priset räknas alltid ut av databasen (create_order i
 * supabase/schema.sql) – ändrar du gränsen här måste du ändra den där också.
 */

/** Så många overaller krävs för klasspris. */
export const CLASS_DISCOUNT_MIN_OVERALLS = 25;

/** Produkten som räknas mot gränsen. */
export const OVERALL_PRODUCT_ID = 'studentoverall';

export type PricedProduct = {
  id: string;
  name: string;
  priceSek: number;
  bulkPriceSek: number | null;
};

export type ClassLine = { productId: string; size: string; quantity: number };

export type PricedLine = ClassLine & {
  productName: string;
  unitPriceSek: number;
  lineTotalSek: number;
};

export type ClassOrderPrice = {
  lines: PricedLine[];
  overalls: number;
  /** Hur många overaller som saknas för klasspris (0 om klasspriset gäller). */
  overallsMissing: number;
  discount: boolean;
  /** Summa med ordinarie priser. */
  fullPriceSek: number;
  totalSek: number;
  savingsSek: number;
};

export function priceClassOrder(
  products: readonly PricedProduct[],
  lines: readonly ClassLine[],
): ClassOrderPrice {
  const active = lines.filter((line) => line.quantity > 0);
  const overalls = active
    .filter((line) => line.productId === OVERALL_PRODUCT_ID)
    .reduce((sum, line) => sum + line.quantity, 0);
  const discount = overalls >= CLASS_DISCOUNT_MIN_OVERALLS;

  let fullPriceSek = 0;
  const priced = active.flatMap((line): PricedLine[] => {
    const product = products.find((p) => p.id === line.productId);
    if (product === undefined) return [];
    const unitPriceSek = discount ? (product.bulkPriceSek ?? product.priceSek) : product.priceSek;
    fullPriceSek += product.priceSek * line.quantity;
    return [
      {
        ...line,
        productName: product.name,
        unitPriceSek,
        lineTotalSek: unitPriceSek * line.quantity,
      },
    ];
  });
  const totalSek = priced.reduce((sum, line) => sum + line.lineTotalSek, 0);

  return {
    lines: priced,
    overalls,
    overallsMissing: Math.max(0, CLASS_DISCOUNT_MIN_OVERALLS - overalls),
    discount,
    fullPriceSek,
    totalSek,
    savingsSek: fullPriceSek - totalSek,
  };
}
