/**
 * Rate limiting: begränsar hur många gånger samma IP-adress får göra något
 * under en viss tid. Skyddar mot spam och mot att någon gissar lösenord.
 * IP-adressen sparas aldrig – bara en hash av den, som raderas efter ett dygn.
 */
import { createHmac } from 'node:crypto';

import { rpc } from './db.ts';
import { HttpError } from './http.ts';
import { deriveSecret } from './secrets.ts';

const LIMITS = {
  order: { max: 5, windowSeconds: 10 * 60 }, // 5 beställningar per 10 min
  login: { max: 10, windowSeconds: 15 * 60 }, // 10 inloggningsförsök per 15 min
  swish: { max: 20, windowSeconds: 10 * 60 }, // 20 Swish-starter per 10 min
} as const;

export type LimitKind = keyof typeof LIMITS;

export async function enforceRateLimit(kind: LimitKind, ip: string): Promise<void> {
  const limit = LIMITS[kind];
  const ipHash = createHmac('sha256', deriveSecret('ip-hash'))
    .update(ip)
    .digest('hex')
    .slice(0, 32);
  const allowed = await rpc('rate_limit_hit', {
    p_key: `${kind}:${ipHash}`,
    p_max: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (allowed !== true) {
    throw new HttpError(429, 'För många försök på kort tid. Vänta några minuter och försök igen.');
  }
}
