/** GET /api/products – produkter med tillgängliga storlekar. */
import type { Config } from '@netlify/functions';

import type { ProductsResponse } from '../../src/shared/apiTypes.ts';
import { handle, json, requireMethod } from '../lib/http.ts';
import { listProducts } from '../lib/orders.ts';

export default handle(async (req) => {
  requireMethod(req, 'GET');
  const response: ProductsResponse = { products: await listProducts() };
  return json(response, {
    headers: {
      // Netlifys CDN får spara svaret i 30 sekunder så att sidan laddar snabbt även
      // när många skannar QR-koden samtidigt. Lagret kontrolleras ändå vid beställning.
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=30, stale-while-revalidate=120',
    },
  });
});

export const config: Config = { path: '/api/products' };
