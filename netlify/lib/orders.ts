/** Allt som rör produkter och ordrar i databasen. */
import { randomBytes } from 'node:crypto';

import * as v from 'valibot';

import { type Order, OrderSchema, type Product, StatusSchema } from '../../src/shared/apiTypes.ts';
import type { OrderInput } from '../../src/shared/orderInput.ts';
import type { OrderStatus } from '../../src/shared/orderStatus.ts';
import { DbError, rpc } from './db.ts';
import { HttpError } from './http.ts';

/** Så här många kvar räknas som "Få kvar" i butiken. */
const FEW_LEFT_THRESHOLD = 3;

const DbProductSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  priceSek: v.number(),
  bulkPriceSek: v.nullable(v.number()),
  image: v.string(),
  images: v.array(v.string()),
  featured: v.boolean(),
  variantLabel: v.string(),
  sizes: v.array(v.object({ size: v.string(), stock: v.number() })),
});

/** Produkter för butiken. Exakt lagersaldo visas inte för kunderna, bara om det finns. */
export async function listProducts(): Promise<Product[]> {
  const rows = v.parse(v.array(DbProductSchema), await rpc('list_products'));
  return rows.map((row) => ({
    ...row,
    sizes: row.sizes.map((s) => ({
      size: s.size,
      available: s.stock > 0,
      fewLeft: s.stock > 0 && s.stock <= FEW_LEFT_THRESHOLD,
    })),
  }));
}

export type CreatedOrder = { order: Order; token: string };

export async function createOrder(input: OrderInput): Promise<CreatedOrder> {
  // Slumpad, ogissningsbar nyckel som ger kunden tillgång till sin orderbekräftelse.
  const token = randomBytes(24).toString('base64url');
  const { website: _honeypot, acceptTerms: _accepted, ...fields } = input;
  try {
    const result = await rpc('create_order', { p: { ...fields, publicToken: token } });
    return { order: v.parse(OrderSchema, result), token };
  } catch (error) {
    if (error instanceof DbError && error.code === 'OUT_OF_STOCK') {
      throw new HttpError(409, `Tyvärr hann ${error.detail || 'en vara'} ta slut i lager.`, {
        items: `${error.detail || 'En vara'} är slut. Ta bort den eller välj en annan storlek/färg.`,
      });
    }
    if (error instanceof DbError && error.code === 'PRODUCT_NOT_FOUND') {
      throw new HttpError(409, 'En produkt i varukorgen finns inte längre.', {
        items: 'Ta bort produkten som inte längre finns och försök igen.',
      });
    }
    if (error instanceof DbError && error.code === 'TOO_MANY') {
      throw new HttpError(
        400,
        'Högst 10 st av samma vara. Gör en klassbeställning för större antal.',
        {
          items: 'Högst 10 st av samma vara.',
        },
      );
    }
    if (error instanceof DbError && error.code === 'EMPTY_CART') {
      throw new HttpError(400, 'Varukorgen är tom.', { items: 'Varukorgen är tom.' });
    }
    throw error;
  }
}

export async function getPublicOrder(orderNumber: string, token: string): Promise<Order | null> {
  const result = await rpc('get_public_order', { p_order_number: orderNumber, p_token: token });
  return result === null ? null : v.parse(OrderSchema, result);
}

export async function listOrders(): Promise<Order[]> {
  return v.parse(v.array(OrderSchema), await rpc('admin_list_orders'));
}

const StatusChangeSchema = v.object({ order: OrderSchema, previousStatus: StatusSchema });
export type StatusChange = v.InferOutput<typeof StatusChangeSchema>;

export async function setOrderStatus(
  orderNumber: string,
  status: OrderStatus,
  actor: 'admin' | 'swish',
): Promise<StatusChange> {
  try {
    const result = await rpc('set_order_status', {
      p_order_number: orderNumber,
      p_status: status,
      p_actor: actor,
    });
    return v.parse(StatusChangeSchema, result);
  } catch (error) {
    if (error instanceof DbError && error.code === 'ORDER_NOT_FOUND') {
      throw new HttpError(404, 'Ordern finns inte.');
    }
    if (error instanceof DbError && error.code === 'OUT_OF_STOCK') {
      throw new HttpError(409, 'Ordern kan inte återaktiveras eftersom varan är slut i lager.');
    }
    throw error;
  }
}

/** Sparar PostNords kollinummer på ordern ('' tar bort det). */
export async function setTrackingNumber(
  orderNumber: string,
  trackingNumber: string,
): Promise<Order> {
  try {
    return v.parse(
      OrderSchema,
      await rpc('set_tracking_number', { p_order_number: orderNumber, p_tracking: trackingNumber }),
    );
  } catch (error) {
    if (error instanceof DbError && error.code === 'ORDER_NOT_FOUND') {
      throw new HttpError(404, 'Ordern finns inte.');
    }
    throw error;
  }
}

/** Läge B: kopplar Swish betalförfrågan till ordern. */
export async function setSwishPaymentId(orderNumber: string, paymentId: string): Promise<void> {
  await rpc('set_swish_payment_id', { p_order_number: orderNumber, p_payment_id: paymentId });
}

/** Läge B: markerar ordern som betald efter att Swish bekräftat. Null = okänd betalning. */
export async function markPaidBySwish(
  paymentId: string,
  amount: number,
  reference: string,
): Promise<StatusChange | null> {
  const result = await rpc('mark_paid_by_swish', {
    p_payment_id: paymentId,
    p_amount: amount,
    p_reference: reference,
  });
  return result === null ? null : v.parse(StatusChangeSchema, result);
}
