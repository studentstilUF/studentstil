/**
 * GET  /api/admin/orders         – alla ordrar (kräver inloggning)
 * POST /api/admin/orders/status  – ändra status { orderNumber, status }
 *
 * Demokontot får påhittade ordrar och dess ändringar sparas aldrig.
 */
import type { Config } from '@netlify/functions';
import * as v from 'valibot';

import { type AdminOrdersResponse, StatusSchema } from '../../src/shared/apiTypes.ts';
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
import { listOrders, setOrderStatus } from '../lib/orders.ts';
import { requireSession } from '../lib/session.ts';

const StatusBodySchema = v.object({
  orderNumber: v.pipe(v.string(), v.regex(/^SS-\d{4}-\d{4,}$/u)),
  status: StatusSchema,
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

export const config: Config = { path: ['/api/admin/orders', '/api/admin/orders/status'] };
