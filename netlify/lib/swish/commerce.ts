/**
 * Läge B – Swish Handel (Swish Commerce API v2).
 *
 * Kräver avtal om Swish Handel med er bank och ett klientcertifikat från
 * Swish Certificate Management. Certifikatet läggs i miljövariabler i Netlify:
 *   SWISH_CERT_PEM        klientcertifikatet (PEM-text)
 *   SWISH_KEY_PEM         den privata nyckeln (PEM-text)
 *   SWISH_KEY_PASSPHRASE  lösenord till nyckeln, om den har ett
 *   SWISH_CA_PEM          Swish rotcertifikat (valfritt)
 *   SWISH_API_BASE        https://cpc.getswish.net/swish-cpcapi  (test: https://mss.cpc.getswish.net/swish-cpcapi)
 *
 * Flöde: vi skapar en betalförfrågan → kunden godkänner i Swish-appen → Swish
 * anropar vår callback (/api/swish/callback) → vi hämtar betalningen direkt från
 * Swish för att verifiera den (vi litar aldrig blint på callbackens innehåll)
 * → ordern blir "Betald" och kunden får mejl.
 *
 * OBS: Det här läget är skrivet enligt Swish dokumentation men behöver testas
 * mot Swish testmiljö (MSS) innan det används skarpt. Se README.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';

import * as v from 'valibot';

import type { Order } from '../../../src/shared/apiTypes.ts';
import { optionalEnv, requireEnv, siteUrl } from '../env.ts';
import { setSwishPaymentId } from '../orders.ts';
import { type SwishProvider, swishPayee } from './types.ts';

/** PEM-text i miljövariabler skrivs ibland med \n i stället för riktiga radbrytningar. */
function pemEnv(name: string): string {
  return requireEnv(name).replace(/\\n/gu, '\n');
}

function apiBase(): string {
  return (optionalEnv('SWISH_API_BASE') ?? 'https://cpc.getswish.net/swish-cpcapi').replace(
    /\/+$/u,
    '',
  );
}

function qrApiBase(): string {
  return (optionalEnv('SWISH_QR_API_BASE') ?? 'https://mpc.getswish.net/qrg-swish').replace(
    /\/+$/u,
    '',
  );
}

type RawResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer };

/** HTTPS-anrop med klientcertifikat (mTLS), som Swish kräver. */
function swishRequest(method: 'GET' | 'PUT', url: string, body?: unknown): Promise<RawResponse> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const ca = optionalEnv('SWISH_CA_PEM');
  const passphrase = optionalEnv('SWISH_KEY_PASSPHRASE');
  const options = {
    method,
    cert: pemEnv('SWISH_CERT_PEM'),
    key: pemEnv('SWISH_KEY_PEM'),
    ...(ca === undefined ? {} : { ca: ca.replace(/\\n/gu, '\n') }),
    ...(passphrase === undefined ? {} : { passphrase }),
    timeout: 10_000,
    headers:
      payload === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  };
  return new Promise((resolve, reject) => {
    const req = request(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy(new Error('Swish svarade inte i tid.'));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/** Skapar en betalförfrågan och returnerar dess id och token. */
async function createPaymentRequest(order: Order): Promise<{ id: string; token: string }> {
  const id = randomUUID().replace(/-/gu, '').toUpperCase();
  const res = await swishRequest('PUT', `${apiBase()}/api/v2/paymentrequests/${id}`, {
    payeePaymentReference: order.orderNumber,
    callbackUrl: `${siteUrl()}/api/swish/callback`,
    payeeAlias: swishPayee(),
    currency: 'SEK',
    amount: order.totalSek.toFixed(2),
    message: order.orderNumber,
  });
  const token = res.headers['paymentrequesttoken'];
  if (res.status !== 201 || typeof token !== 'string') {
    throw new Error(
      `Swish kunde inte skapa betalningen (${String(res.status)}): ${res.body.toString('utf8')}`,
    );
  }
  return { id, token };
}

const PaymentRequestSchema = v.object({
  id: v.string(),
  payeePaymentReference: v.nullish(v.string()),
  status: v.string(), // CREATED, PAID, DECLINED, ERROR, CANCELLED
  amount: v.pipe(v.union([v.number(), v.string()]), v.transform(Number)),
});
export type PaymentRequest = v.InferOutput<typeof PaymentRequestSchema>;

/** Hämtar betalningens aktuella status direkt från Swish. */
export async function fetchPaymentRequest(id: string): Promise<PaymentRequest> {
  if (!/^[0-9A-F]{32}$/u.test(id)) throw new Error('Ogiltigt Swish-id.');
  const res = await swishRequest('GET', `${apiBase()}/api/v1/paymentrequests/${id}`);
  if (res.status !== 200) {
    throw new Error(`Swish svarade ${String(res.status)} vid hämtning av betalning.`);
  }
  const data: unknown = JSON.parse(res.body.toString('utf8'));
  return v.parse(PaymentRequestSchema, data);
}

/** QR-kod (PNG som data-URL) för att betala på dator. Null om tjänsten inte svarar. */
async function qrImageForToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${qrApiBase()}/api/v1/commerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, format: 'png', size: 300, border: 0, transparent: false }),
    });
    if (!res.ok) return null;
    const png = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (error) {
    console.error('Kunde inte hämta Swish QR-kod:', error);
    return null;
  }
}

export const commerceProvider: SwishProvider = {
  mode: 'commerce',
  async start(order, device, returnUrl) {
    const { id, token } = await createPaymentRequest(order);
    await setSwishPaymentId(order.orderNumber, id);
    return {
      mode: 'commerce',
      appUrl: `swish://paymentrequest?token=${encodeURIComponent(token)}&callbackurl=${encodeURIComponent(returnUrl)}`,
      qrImage: device === 'desktop' ? await qrImageForToken(token) : null,
    };
  },
};
