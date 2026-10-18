/**
 * Inloggning till adminpanelen.
 *   POST /api/admin/login   { username, password }
 *   POST /api/admin/logout
 *   GET  /api/admin/me      → { role } om inloggad, annars 401
 *
 * Två konton: "admin" (riktiga ordrar) och "demo" (bara påhittad data).
 * Lösenorden finns bara som hashar i miljövariablerna ADMIN_PASSWORD_HASH och DEMO_PASSWORD_HASH.
 */
import type { Config } from '@netlify/functions';
import * as v from 'valibot';

import type { Role } from '../../src/shared/apiTypes.ts';
import { optionalEnv } from '../lib/env.ts';
import {
  HttpError,
  handle,
  json,
  readJson,
  requireMethod,
  requireSameOrigin,
} from '../lib/http.ts';
import { DUMMY_HASH, verifyPassword } from '../lib/password.ts';
import { enforceRateLimit } from '../lib/rateLimit.ts';
import { clearSessionCookie, requireSession, sessionCookie } from '../lib/session.ts';

const LoginSchema = v.object({
  username: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.maxLength(50)),
  password: v.pipe(v.string(), v.maxLength(200)),
});

function hashFor(username: string): { role: Role; hash: string } | null {
  if (username === 'admin') {
    const hash = optionalEnv('ADMIN_PASSWORD_HASH');
    return hash === undefined ? null : { role: 'admin', hash };
  }
  if (username === 'demo') {
    const hash = optionalEnv('DEMO_PASSWORD_HASH');
    return hash === undefined ? null : { role: 'demo', hash };
  }
  return null;
}

export default handle(async (req, context) => {
  const path = new URL(req.url).pathname;

  if (path === '/api/admin/me') {
    requireMethod(req, 'GET');
    return json({ role: requireSession(req) });
  }

  requireMethod(req, 'POST');
  requireSameOrigin(req);

  if (path === '/api/admin/logout') {
    return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(req) } });
  }

  await enforceRateLimit('login', context.ip);
  const body = v.safeParse(LoginSchema, await readJson(req));
  if (!body.success) throw new HttpError(400, 'Fyll i användarnamn och lösenord.');

  const account = hashFor(body.output.username);
  // Vi räknar alltid ut en hash, även för okända användare, så att svarstiden inte avslöjar något.
  const valid = await verifyPassword(body.output.password, account?.hash ?? DUMMY_HASH);
  if (account === null || !valid) {
    throw new HttpError(401, 'Fel användarnamn eller lösenord.');
  }
  return json(
    { role: account.role },
    { headers: { 'Set-Cookie': sessionCookie(req, account.role) } },
  );
});

export const config: Config = { path: ['/api/admin/login', '/api/admin/logout', '/api/admin/me'] };
