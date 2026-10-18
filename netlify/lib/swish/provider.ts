/**
 * Swish-betalning, byggd för två lägen. Resten av koden pratar bara med
 * gränssnittet SwishProvider, så att byta läge = ändra miljövariabeln SWISH_MODE.
 *
 *   SWISH_MODE=manual    Läge A (Swish Företag): förifylld Swish-länk och QR-kod.
 *                        Ni kontrollerar betalningen i Swish-appen och markerar
 *                        ordern som "Betald" i adminpanelen.
 *   SWISH_MODE=commerce  Läge B (Swish Handel): betalförfrågan via Swish API.
 *                        Statusen uppdateras automatiskt via callback.
 */
import type { PaymentMode } from '../../../src/shared/apiTypes.ts';
import { optionalEnv } from '../env.ts';
import { commerceProvider } from './commerce.ts';
import { manualProvider } from './manual.ts';
import type { SwishProvider } from './types.ts';

export { swishPayee } from './types.ts';

export function paymentMode(): PaymentMode {
  return optionalEnv('SWISH_MODE') === 'commerce' ? 'commerce' : 'manual';
}

export function swishProvider(): SwishProvider {
  return paymentMode() === 'commerce' ? commerceProvider : manualProvider;
}
