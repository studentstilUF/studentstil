/** POST /api/orders – skapar en order med status "Väntar på betalning". */
import type { Config } from '@netlify/functions';

import type { CreateOrderResponse } from '../../src/shared/apiTypes.ts';
import { validateOrderInput } from '../../src/shared/orderInput.ts';
import { siteUrl } from '../lib/env.ts';
import {
  HttpError,
  handle,
  json,
  readJson,
  requireMethod,
  requireSameOrigin,
} from '../lib/http.ts';
import { notifyOrderCreated } from '../lib/notifications.ts';
import { createOrder } from '../lib/orders.ts';
import { enforceRateLimit } from '../lib/rateLimit.ts';

export default handle(async (req, context) => {
  requireMethod(req, 'POST');
  requireSameOrigin(req);

  // 1. Validera och sanera all indata på servern (webbläsarens kontroll går att kringgå).
  const result = validateOrderInput(await readJson(req));
  if (!result.ok) {
    throw new HttpError(400, 'Kontrollera de markerade fälten.', result.errors);
  }
  // 2. Honeypot ifyllt = robot.
  if (result.data.website !== '') {
    throw new HttpError(400, 'Beställningen kunde inte skickas.');
  }
  // 3. Max antal beställningar per IP-adress och tidsperiod.
  await enforceRateLimit('order', context.ip);

  // 4. Spara ordern (lagret minskas i samma transaktion).
  const { order, token } = await createOrder(result.data);

  // 5. Mejl skickas i bakgrunden så att kunden inte behöver vänta på dem.
  const orderUrl = `${siteUrl()}/order/?nr=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(token)}`;
  context.waitUntil(notifyOrderCreated(order, orderUrl));

  const response: CreateOrderResponse = { orderNumber: order.orderNumber, token };
  return json(response, { status: 201 });
});

export const config: Config = { path: '/api/orders' };
