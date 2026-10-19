/**
 * Formen på data som skickas mellan webbläsaren och våra Netlify Functions.
 * Scheman (valibot) används för att kontrollera svaren när de tas emot, så att
 * typerna i koden alltid stämmer med verkligheten.
 */
import * as v from 'valibot';

import { DeliverySchema } from './delivery.ts';
import { ORDER_STATUSES } from './orderStatus.ts';

export const StatusSchema = v.picklist(ORDER_STATUSES);

export const OrderKindSchema = v.picklist(['privat', 'klass']);
export type OrderKind = v.InferOutput<typeof OrderKindSchema>;

/** En rad i en order: en produkt i en viss storlek/färg. */
export const OrderItemSchema = v.object({
  productId: v.string(),
  productName: v.string(),
  size: v.string(),
  quantity: v.number(),
  unitPriceSek: v.number(),
  lineTotalSek: v.number(),
});
export type OrderItem = v.InferOutput<typeof OrderItemSchema>;

export const OrderSchema = v.object({
  orderNumber: v.string(),
  createdAt: v.string(),
  status: StatusSchema,
  name: v.string(),
  email: v.string(),
  schoolClass: v.string(),
  street: v.string(),
  postalCode: v.string(),
  city: v.string(),
  phone: v.nullable(v.string()),
  comment: v.nullable(v.string()),
  /** "privat" = vanlig varukorg, "klass" = klassbeställning från klassrepresentanten. */
  kind: OrderKindSchema,
  school: v.nullable(v.string()),
  /** "skola" = hämtas på skolan i school (gratis), "hem" = skickas hem. */
  delivery: DeliverySchema,
  shippingSek: v.number(),
  items: v.array(OrderItemSchema),
  totalSek: v.number(),
  source: v.string(),
  paidAt: v.nullable(v.string()),
  shippedAt: v.nullable(v.string()),
});
export type Order = v.InferOutput<typeof OrderSchema>;

/** Antal varor totalt i en order. */
export function itemCount(order: { items: readonly { quantity: number }[] }): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export const ProductSizeSchema = v.object({
  size: v.string(),
  available: v.boolean(),
  fewLeft: v.boolean(),
});

export const ProductSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  priceSek: v.number(),
  /** Klasspris (klassbeställning med minst 25 overaller). Null = ingen rabatt. */
  bulkPriceSek: v.nullable(v.number()),
  /** Huvudbilden. */
  image: v.string(),
  /** Alla bilder i ordning: huvudbilden först, sedan t.ex. baksida och sidor. */
  images: v.array(v.string()),
  featured: v.boolean(),
  /** Vad varianterna kallas: "Storlek" (kläder) eller "Färg" (sprayfärg, pennor). */
  variantLabel: v.string(),
  sizes: v.array(ProductSizeSchema),
});
export type Product = v.InferOutput<typeof ProductSchema>;

export const ProductsResponseSchema = v.object({ products: v.array(ProductSchema) });
export type ProductsResponse = v.InferOutput<typeof ProductsResponseSchema>;

export const CreateOrderResponseSchema = v.object({ orderNumber: v.string(), token: v.string() });
export type CreateOrderResponse = v.InferOutput<typeof CreateOrderResponseSchema>;

export const PaymentModeSchema = v.picklist(['manual', 'commerce']);
export type PaymentMode = v.InferOutput<typeof PaymentModeSchema>;

/** Det kunden ser på orderbekräftelsen. */
export const PublicOrderSchema = v.object({
  orderNumber: v.string(),
  createdAt: v.string(),
  status: StatusSchema,
  name: v.string(),
  email: v.string(),
  street: v.string(),
  postalCode: v.string(),
  city: v.string(),
  kind: OrderKindSchema,
  school: v.nullable(v.string()),
  delivery: DeliverySchema,
  shippingSek: v.number(),
  items: v.array(OrderItemSchema),
  totalSek: v.number(),
  paymentMode: PaymentModeSchema,
  /** Läge A: färdig Swish-länk och QR-data, så att knappen kan öppna Swish direkt. Null annars. */
  swish: v.nullable(
    v.object({ payee: v.string(), message: v.string(), appUrl: v.string(), qrData: v.string() }),
  ),
});
export type PublicOrder = v.InferOutput<typeof PublicOrderSchema>;

export const DeviceSchema = v.picklist(['mobile', 'desktop']);
export type Device = v.InferOutput<typeof DeviceSchema>;

/** Svar när kunden klickar på "Betala med Swish". */
export const SwishStartSchema = v.variant('mode', [
  // Läge A: förifylld betalning till vårt Swish Företag-nummer.
  v.object({
    mode: v.literal('manual'),
    payee: v.string(),
    amountSek: v.number(),
    message: v.string(),
    appUrl: v.string(),
    qrData: v.string(),
  }),
  // Läge B: betalförfrågan via Swish Handel-API:t.
  v.object({
    mode: v.literal('commerce'),
    appUrl: v.string(),
    qrImage: v.nullable(v.string()),
  }),
]);
export type SwishStart = v.InferOutput<typeof SwishStartSchema>;

export const RoleSchema = v.picklist(['admin', 'demo']);
export type Role = v.InferOutput<typeof RoleSchema>;

export const SessionResponseSchema = v.object({ role: RoleSchema });
export const OkResponseSchema = v.object({ ok: v.boolean() });
export const AdminOrdersResponseSchema = v.object({
  role: RoleSchema,
  orders: v.array(OrderSchema),
});
export type AdminOrdersResponse = v.InferOutput<typeof AdminOrdersResponseSchema>;
export const StatusUpdateResponseSchema = v.object({ order: OrderSchema });

export const ApiErrorSchema = v.object({
  error: v.string(),
  fieldErrors: v.optional(v.record(v.string(), v.string())),
});
