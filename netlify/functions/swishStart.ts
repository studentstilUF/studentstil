/** POST /api/swish/start – körs när kunden klickar på "Betala med Swish". */
import type { Config } from '@netlify/functions';
import * as v from 'valibot';

import { DeviceSchema, type SwishStart } from '../../src/shared/apiTypes.ts';
import { siteUrl } from '../lib/env.ts';
import {
  HttpError,
  handle,
  json,
  readJson,
  requireMethod,
  requireSameOrigin,
} from '../lib/http.ts';
import { getPublicOrder } from '../lib/orders.ts';
import { enforceRateLimit } from '../lib/rateLimit.ts';
import { swishProvider } from '../lib/swish/provider.ts';

const BodySchema = v.object({
  orderNumber: v.pipe(v.string(), v.regex(/^SS-\d{4}-\d{4,}$/u)),
  token: v.pipe(v.string(), v.regex(/^[\w-]{20,64}$/u)),
  device: DeviceSchema,
});

export default handle(async (req, context) => {
  requireMethod(req, 'POST');
  requireSameOrigin(req);
  const body = v.safeParse(BodySchema, await readJson(req));
  if (!body.success) throw new HttpError(400, 'Ogiltig förfrågan.');
  const { orderNumber, token, device } = body.output;

  await enforceRateLimit('swish', context.ip);
  const order = await getPublicOrder(orderNumber, token);
  if (order === null) throw new HttpError(404, 'Vi hittar inte beställningen.');
  if (order.status !== 'vantar_betalning') {
    throw new HttpError(409, 'Den här beställningen är redan betald eller avbruten.');
  }

  const returnUrl = `${siteUrl()}/order/?nr=${encodeURIComponent(orderNumber)}&t=${encodeURIComponent(token)}`;
  const start: SwishStart = await swishProvider().start(order, device, returnUrl);
  return json(start);
});

export const config: Config = { path: '/api/swish/start' };
