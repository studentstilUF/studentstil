/** GET /api/order-status?nr=…&t=… – orderbekräftelsen för kunden. */
import type { Config } from '@netlify/functions';

import type { PublicOrder } from '../../src/shared/apiTypes.ts';
import { siteUrl } from '../lib/env.ts';
import { HttpError, handle, json, requireMethod } from '../lib/http.ts';
import { getPublicOrder } from '../lib/orders.ts';
import { manualPayment } from '../lib/swish/manual.ts';
import { paymentMode, swishPayee } from '../lib/swish/provider.ts';

export default handle(async (req) => {
  requireMethod(req, 'GET');
  const url = new URL(req.url);
  const orderNumber = url.searchParams.get('nr') ?? '';
  const token = url.searchParams.get('t') ?? '';
  if (!/^SS-\d{4}-\d{4,}$/u.test(orderNumber) || !/^[\w-]{20,64}$/u.test(token)) {
    throw new HttpError(
      404,
      'Vi hittar inte beställningen. Kontrollera länken i ditt bekräftelsemejl.',
    );
  }

  const order = await getPublicOrder(orderNumber, token);
  if (order === null) {
    throw new HttpError(
      404,
      'Vi hittar inte beställningen. Kontrollera länken i ditt bekräftelsemejl.',
    );
  }

  // Läge A: Swish-länken byggs direkt, så att knappen "Betala med Swish" är en
  // vanlig länk som öppnar Swish-appen på första trycket (även i Safari på iPhone).
  const mode = paymentMode();
  const returnUrl = `${siteUrl()}/order/?nr=${encodeURIComponent(orderNumber)}&t=${encodeURIComponent(token)}`;
  const swish =
    mode === 'manual' && order.status === 'vantar_betalning'
      ? manualPayment(swishPayee(), order.totalSek, order.orderNumber, returnUrl)
      : null;

  const response: PublicOrder = {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    name: order.name,
    email: order.email,
    street: order.street,
    postalCode: order.postalCode,
    city: order.city,
    kind: order.kind,
    school: order.school,
    items: order.items,
    totalSek: order.totalSek,
    paymentMode: mode,
    swish:
      swish === null
        ? null
        : {
            payee: swish.payee,
            message: swish.message,
            appUrl: swish.appUrl,
            qrData: swish.qrData,
          },
  };
  return json(response);
});

export const config: Config = { path: '/api/order-status' };
