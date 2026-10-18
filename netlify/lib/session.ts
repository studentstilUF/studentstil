/**
 * Inloggningssession för adminpanelen. Efter inloggning får webbläsaren en
 * signerad cookie (HttpOnly, går inte att läsa med JavaScript) som gäller i 8 timmar.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import * as v from 'valibot';

import { type Role, RoleSchema } from '../../src/shared/apiTypes.ts';
import { HttpError } from './http.ts';
import { deriveSecret } from './secrets.ts';

const COOKIE_NAME = 'ss_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const PayloadSchema = v.object({ role: RoleSchema, exp: v.number() });

function sign(payload: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function createSessionToken(role: Role, secret: Buffer, nowMs: number): string {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({ role, exp })).toString('base64url');
  return `${payload}.${sign(payload, secret).toString('base64url')}`;
}

export function verifySessionToken(token: string, secret: Buffer, nowMs: number): Role | null {
  const [payload, signature, ...rest] = token.split('.');
  if (payload === undefined || signature === undefined || rest.length > 0) return null;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const parsed = v.safeParse(PayloadSchema, data);
  if (!parsed.success || parsed.output.exp * 1000 < nowMs) return null;
  return parsed.output.role;
}

function sessionSecret(): Buffer {
  return deriveSecret('admin-session');
}

function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === 'https:';
}

export function sessionCookie(req: Request, role: Role): string {
  const token = createSessionToken(role, sessionSecret(), Date.now());
  const secure = isHttps(req) ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${String(SESSION_MAX_AGE_SECONDS)}${secure}`;
}

export function clearSessionCookie(req: Request): string {
  const secure = isHttps(req) ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

/** Kastar 401 om besökaren inte är inloggad. Returnerar annars rollen. */
export function requireSession(req: Request): Role {
  const token = readCookie(req, COOKIE_NAME);
  const role = token === null ? null : verifySessionToken(token, sessionSecret(), Date.now());
  if (role === null) throw new HttpError(401, 'Du behöver logga in.');
  return role;
}
