import type { Device, Order, PaymentMode, SwishStart } from '../../../src/shared/apiTypes.ts';
import { requireEnv } from '../env.ts';

export type SwishProvider = {
  readonly mode: PaymentMode;
  /** Startar betalningen. returnUrl = dit Swish-appen skickar kunden efteråt. */
  start(order: Order, device: Device, returnUrl: string): Promise<SwishStart>;
};

/** Ert Swish-nummer, 10 siffror (123 XXX XX XX). */
export function swishPayee(): string {
  const payee = requireEnv('SWISH_PAYEE').replace(/\D/gu, '');
  if (!/^\d{10}$/u.test(payee)) {
    throw new Error('SWISH_PAYEE måste vara ett Swish-nummer med 10 siffror, t.ex. 1231234567.');
  }
  return payee;
}
