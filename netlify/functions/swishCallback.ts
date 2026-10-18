/**
 * POST /api/swish/callback – Swish anropar denna när en betalning ändrar status
 * (bara i läge B, Swish Handel). Vi litar inte på innehållet i anropet utan hämtar
 * betalningen direkt från Swish med vårt certifikat och kontrollerar belopp och ordernummer.
 */
import type { Config } from '@netlify/functions';
import * as v from 'valibot';

import { HttpError, handle, json, readJson, requireMethod } from '../lib/http.ts';
import { notifyStatusChange } from '../lib/notifications.ts';
import { markPaidBySwish } from '../lib/orders.ts';
import { fetchPaymentRequest } from '../lib/swish/commerce.ts';
import { paymentMode } from '../lib/swish/provider.ts';

const CallbackSchema = v.object({ id: v.pipe(v.string(), v.regex(/^[0-9A-F]{32}$/u)) });

export default handle(async (req, context) => {
  requireMethod(req, 'POST');
  if (paymentMode() !== 'commerce') throw new HttpError(404, 'Swish Handel är inte aktiverat.');

  const body = v.safeParse(CallbackSchema, await readJson(req));
  if (!body.success) throw new HttpError(400, 'Ogiltig callback.');

  const payment = await fetchPaymentRequest(body.output.id);
  if (payment.status === 'PAID') {
    const change = await markPaidBySwish(
      payment.id,
      payment.amount,
      payment.payeePaymentReference ?? '',
    );
    if (change !== null) {
      context.waitUntil(notifyStatusChange(change.order, change.previousStatus));
    } else {
      console.warn(`Swish-betalning ${payment.id} hör inte till någon order.`);
    }
  }
  // DECLINED / CANCELLED / ERROR: ordern ligger kvar som "Väntar på betalning" så att kunden kan försöka igen.
  return json({ ok: true });
});

export const config: Config = { path: '/api/swish/callback' };
