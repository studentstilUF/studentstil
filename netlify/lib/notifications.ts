/** Vilka mejl som skickas när något händer med en order. */
import type { Order } from '../../src/shared/apiTypes.ts';
import type { OrderStatus } from '../../src/shared/orderStatus.ts';
import { sendEmail, shopEmail } from './email.ts';
import {
  orderConfirmationEmail,
  paidEmail,
  shippedEmail,
  shopNotificationEmail,
} from './emailTemplates.ts';
import { paymentMode, swishPayee } from './swish/provider.ts';

/** Ny order: bekräftelse till kunden och notis till Studentstil. */
export async function notifyOrderCreated(order: Order, orderUrl: string): Promise<void> {
  const manual = paymentMode() === 'manual' ? { payee: swishPayee() } : null;
  const shop = shopEmail();
  await Promise.all([
    sendEmail(orderConfirmationEmail(order, orderUrl, manual)),
    shop === undefined ? Promise.resolve() : sendEmail(shopNotificationEmail(order, shop)),
  ]);
}

/** Statusändring: mejl till kunden när ordern blir betald eller skickad. */
export async function notifyStatusChange(order: Order, previous: OrderStatus): Promise<void> {
  if (order.status === previous) return;
  if (order.status === 'betald' && previous === 'vantar_betalning') {
    await sendEmail(paidEmail(order));
  } else if (order.status === 'skickad') {
    await sendEmail(shippedEmail(order));
  }
}
