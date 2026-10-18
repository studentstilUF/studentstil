/**
 * Läge A – Swish Företag med förifylld betalning.
 *
 * Mobil:  en swish://payment-länk öppnar Swish-appen med mottagare, belopp och
 *         meddelande (ordernumret) ifyllda och låsta.
 * Dator:  samma uppgifter som QR-kod som kunden skannar med Swish-appen.
 *
 * Swish talar INTE om för oss när kunden betalat i det här läget. Därför
 * kontrollerar ni inbetalningen i Swish-appen och markerar ordern som betald
 * i adminpanelen. Ordernumret i meddelandet gör det lätt att para ihop.
 */
import type { SwishStart } from '../../../src/shared/apiTypes.ts';
import { type SwishProvider, swishPayee } from './types.ts';

export function manualPayment(
  payee: string,
  amountSek: number,
  message: string,
  returnUrl: string,
): Extract<SwishStart, { mode: 'manual' }> {
  const data = {
    version: 1,
    payee: { value: payee },
    amount: { value: amountSek, editable: false },
    message: { value: message, editable: false },
  };
  const appUrl =
    `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}` +
    `&callbackurl=${encodeURIComponent(returnUrl)}&callbackresultparameter=swish`;

  // Swish QR-format för förifylld betalning: C<nummer>;<belopp>;<meddelande>;<redigerbart>
  // Sista fältet 0 = inget av fälten går att ändra i appen.
  const qrData = `C${payee};${String(amountSek)};${message};0`;

  return { mode: 'manual', payee, amountSek, message, appUrl, qrData };
}

export const manualProvider: SwishProvider = {
  mode: 'manual',
  start: (order, _device, returnUrl) =>
    Promise.resolve(manualPayment(swishPayee(), order.totalSek, order.orderNumber, returnUrl)),
};
