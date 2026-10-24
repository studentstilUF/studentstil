/**
 * GET  /api/admin/orders         – alla ordrar (kräver inloggning)
 * POST /api/admin/orders/status  – ändra status { orderNumber, status }
 * POST /api/admin/orders/tracking – spara kollinummer { orderNumber, trackingNumber }
 *
 * Demokontot får påhittade ordrar och dess ändringar sparas aldrig.
 */
import type { Config } from '@netlify/functions';
import * as v from 'valibot';

import { type AdminOrdersResponse, SelectableStatusSchema } from '../../src/shared/apiTypes.ts';
import { demoOrders } from '../lib/demoData.ts';
import {
  HttpError,
  handle,
  json,
  readJson,
  requireMethod,
  requireSameOrigin,
} from '../lib/http.ts';
import { notifyStatusChange } from '../lib/notifications.ts';
import { listOrders, setOrderStatus, setTrackingNumber } from '../lib/orders.ts';
import { requireSession } from '../lib/session.ts';

const StatusBodySchema = v.object({
  orderNumber: v.pipe(v.string(), v.regex(/^SS-\d{4}-\d{4,}$/u)),
  status: SelectableStatusSchema,
});

const TrackingBodySchema = v.object({
  orderNumber: v.pipe(v.string(), v.regex(/^SS-\d{4}-\d{4,}$/u)),
  trackingNumber: v.pipe(
    v.string(),
    v.transform((s) => s.replace(/\s/gu, '').toUpperCase()),
    v.regex(/^(|[A-Z0-9]{6,40})$/u, 'Kollinumret ska vara 6–40 bokstäver och siffror.'),
  ),
});

export default handle(async (req, context) => {
  const role = requireSession(req);
  const path = new URL(req.url).pathname;

  if (path === '/api/admin/orders') {
    requireMethod(req, 'GET');
    const response: AdminOrdersResponse = {
      role,
      orders: role === 'demo' ? demoOrders() : await listOrders(),
    };
    return json(response);
  }

  requireMethod(req, 'POST');
  requireSameOrigin(req);

  if (path === '/api/admin/orders/tracking') {
    const tracking = v.safeParse(TrackingBodySchema, await readJson(req));
    if (!tracking.success) {
      throw new HttpError(400, tracking.issues[0].message);
    }
    const { orderNumber, trackingNumber } = tracking.output;
    if (role === 'demo') {
      const order = demoOrders().find((o) => o.orderNumber === orderNumber);
      if (order === undefined) throw new HttpError(404, 'Ordern finns inte.');
      return json({
        order: { ...order, trackingNumber: trackingNumber === '' ? null : trackingNumber },
      });
    }
    return json({ order: await setTrackingNumber(orderNumber, trackingNumber) });
  }

  const body = v.safeParse(StatusBodySchema, await readJson(req));
  if (!body.success) throw new HttpError(400, 'Ogiltig status.');

  if (role === 'demo') {
    const order = demoOrders().find((o) => o.orderNumber === body.output.orderNumber);
    if (order === undefined) throw new HttpError(404, 'Ordern finns inte.');
    return json({ order: { ...order, status: body.output.status } });
  }

  const change = await setOrderStatus(body.output.orderNumber, body.output.status, 'admin');
  context.waitUntil(notifyStatusChange(change.order, change.previousStatus));
  return json({ order: change.order });
});

export const config: Config = {
  path: ['/api/admin/orders', '/api/admin/orders/status', '/api/admin/orders/tracking'],
};
