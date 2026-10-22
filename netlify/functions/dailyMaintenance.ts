/**
 * Schemalagd funktion som körs varje natt:
 *  - avbryter obetalda ordrar äldre än 7 dagar (varorna går tillbaka i lager)
 *  - anonymiserar kunduppgifter på gamla ordrar (GDPR, se integritetspolicyn)
 *  - rensar gamla rate limit-rader
 *  - håller Supabase-projektet aktivt (gratisprojekt pausas efter en veckas inaktivitet)
 */
import type { Config } from '@netlify/functions';

import { rpc } from '../lib/db.ts';
import { optionalEnv } from '../lib/env.ts';

export default async (): Promise<Response> => {
  const months = Number.parseInt(optionalEnv('DATA_RETENTION_MONTHS') ?? '6', 10);
  const cancelled = await rpc('cancel_unpaid_orders', { p_days: 7 });
  const anonymized = await rpc('anonymize_old_orders', { p_months: months });
  console.info(
    `Underhåll klart. Avbrutna obetalda ordrar: ${JSON.stringify(cancelled)}. Anonymiserade ordrar: ${JSON.stringify(anonymized)}`,
  );
  return new Response('ok');
};

export const config: Config = { schedule: '@daily' };
