/**
 * Databasåtkomst. Vi anropar Supabase REST-API direkt med fetch i stället för
 * att installera Supabase-biblioteket: färre beroenden = mindre att uppdatera
 * och mindre risk. All logik ligger i databasfunktioner i supabase/schema.sql.
 */
import * as v from 'valibot';

import { requireEnv } from './env.ts';

const PostgrestErrorSchema = v.object({ message: v.string(), details: v.nullish(v.string()) });

export class DbError extends Error {
  /** Felkoden vi själva skickar med "raise exception", t.ex. OUT_OF_STOCK. */
  readonly code: string;
  /** Extra information från "using detail = …", t.ex. "Sprayfärg (Gul)". */
  readonly detail: string;

  constructor(code: string, detail = '') {
    super(`Databasfel: ${code}${detail === '' ? '' : ` – ${detail}`}`);
    this.name = 'DbError';
    this.code = code;
    this.detail = detail;
  }
}

function authHeaders(): Record<string, string> {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  // Nya Supabase-nycklar (sb_secret_…) skickas bara som apikey.
  // Äldre service_role-nycklar (JWT) skickas även som Bearer-token.
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

/** Anropar en databasfunktion, t.ex. rpc('create_order', { p: {...} }). */
export async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const base = requireEnv('SUPABASE_URL').replace(/\/+$/u, '');
  const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body: unknown = text === '' ? null : JSON.parse(text);
  if (!res.ok) {
    const parsed = v.safeParse(PostgrestErrorSchema, body);
    if (!parsed.success) throw new DbError(`HTTP_${String(res.status)}`);
    throw new DbError(parsed.output.message, parsed.output.details ?? '');
  }
  return body;
}
