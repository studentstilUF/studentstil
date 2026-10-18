import { createHmac } from 'node:crypto';

import { requireEnv } from './env.ts';

/**
 * Tar fram en separat nyckel för ett visst ändamål ur SESSION_SECRET, så att vi
 * bara behöver en hemlig miljövariabel men ändå olika nycklar för olika saker.
 */
export function deriveSecret(purpose: string): Buffer {
  return createHmac('sha256', requireEnv('SESSION_SECRET')).update(purpose).digest();
}
