import { describe, expect, it } from 'vitest';

import { escapeHtml } from './emailTemplates.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { createSessionToken, readCookie, verifySessionToken } from './session.ts';
import { manualPayment } from './swish/manual.ts';

describe('lösenord', () => {
  it('verifierar rätt lösenord och avvisar fel', async () => {
    const hash = await hashPassword('ett långt testlösenord');
    expect(hash.startsWith('scrypt:32768:8:1:')).toBe(true);
    expect(await verifyPassword('ett långt testlösenord', hash)).toBe(true);
    expect(await verifyPassword('fel lösenord', hash)).toBe(false);
    expect(await verifyPassword('x', 'skräp')).toBe(false);
  });
});

describe('session', () => {
  const secret = Buffer.from('test-secret-test-secret-test-secret');
  const now = Date.UTC(2026, 4, 1);

  it('godkänner en giltig token och returnerar rollen', () => {
    const token = createSessionToken('demo', secret, now);
    expect(verifySessionToken(token, secret, now + 1000)).toBe('demo');
  });

  it('avvisar ändrade, utgångna och felsignerade tokens', () => {
    const token = createSessionToken('demo', secret, now);
    const [payload, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ role: 'admin', exp: 9e9 })).toString('base64url')}.${signature ?? ''}`;
    expect(verifySessionToken(forged, secret, now)).toBeNull();
    expect(verifySessionToken(token, secret, now + 9 * 60 * 60 * 1000)).toBeNull();
    expect(verifySessionToken(token, Buffer.from('annan-nyckel'), now)).toBeNull();
    expect(verifySessionToken(`${payload ?? ''}`, secret, now)).toBeNull();
  });

  it('läser cookies', () => {
    const req = new Request('https://studentstil.se/api/admin/me', {
      headers: { cookie: 'a=1; ss_session=abc.def' },
    });
    expect(readCookie(req, 'ss_session')).toBe('abc.def');
    expect(readCookie(req, 'saknas')).toBeNull();
  });
});

describe('Swish läge A', () => {
  it('bygger förifylld app-länk och QR-data', () => {
    const start = manualPayment(
      '1234567890',
      449,
      'SS-2026-0001',
      'https://studentstil.se/order/?nr=SS-2026-0001&t=x',
    );
    expect(start.qrData).toBe('C1234567890;449;SS-2026-0001;0');
    const url = new URL(start.appUrl);
    expect(url.protocol).toBe('swish:');
    const data: unknown = JSON.parse(url.searchParams.get('data') ?? '');
    expect(data).toEqual({
      version: 1,
      payee: { value: '1234567890' },
      amount: { value: 449, editable: false },
      message: { value: 'SS-2026-0001', editable: false },
    });
    expect(url.searchParams.get('callbackurl')).toBe(
      'https://studentstil.se/order/?nr=SS-2026-0001&t=x',
    );
  });
});

describe('escapeHtml', () => {
  it('neutraliserar HTML i kunddata', () => {
    expect(escapeHtml('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;');
  });
});
