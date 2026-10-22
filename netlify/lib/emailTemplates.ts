/** Texter för alla mejl. Ändra formuleringarna här. */
import { itemCount, type Order } from '../../src/shared/apiTypes.ts';
import { campaignLabel } from '../../src/shared/campaign.ts';
import { deliveryLabel, shippingLabel, trackingUrl } from '../../src/shared/delivery.ts';
import { formatPostalCode, formatSek, formatSwishNumber } from '../../src/shared/format.ts';
import type { Email } from './email.ts';
import { siteUrl } from './env.ts';

/** Gör text säker att stoppa in i HTML (skydd mot att kunddata tolkas som kod). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111111;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
<p style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 32px;"><img src="${escapeHtml(siteUrl())}/logo/krona-mejl.png" alt="" width="49" height="32" style="vertical-align:middle;margin-right:10px;border:0;"><span style="vertical-align:middle;">Studentstil</span></p>
<h1 style="font-size:22px;font-weight:600;margin:0 0 16px;">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:40px 0 0;font-size:13px;color:#6b6b6b;">Studentstil · Frågor? Svara på det här mejlet.</p>
</div></body></html>`;
}

function summaryHtml(order: Order): string {
  const rows: [string, string][] = [
    ['Ordernummer', order.orderNumber],
    ...order.items.map((item): [string, string] => [
      `${String(item.quantity)} st`,
      `${item.productName}, ${item.size} – ${formatSek(item.lineTotalSek)}`,
    ]),
    ['Leverans', deliveryLabel(order)],
    ['Frakt', shippingLabel(order.shippingSek)],
    ...(order.discountSek > 0
      ? [['Återbetalning', formatSek(order.discountSek)] as [string, string]]
      : []),
    ...(order.campaign === null
      ? []
      : [['Kampanj', campaignLabel(order.campaign)] as [string, string]]),
    ['Att betala', formatSek(order.totalSek)],
    [
      'Adress',
      `${order.name}, ${order.street}, ${formatPostalCode(order.postalCode)} ${order.city}`,
    ],
  ];
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b6b6b;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;font-size:15px;margin:0 0 24px;">${cells}</table>`;
}

function summaryText(order: Order): string {
  return [
    `Ordernummer: ${order.orderNumber}`,
    ...order.items.map(
      (item) =>
        `${String(item.quantity)} st ${item.productName}, ${item.size} – ${formatSek(item.lineTotalSek)}`,
    ),
    `Leverans: ${deliveryLabel(order)}`,
    `Frakt: ${shippingLabel(order.shippingSek)}`,
    ...(order.discountSek > 0 ? [`Återbetalning: ${formatSek(order.discountSek)}`] : []),
    ...(order.campaign === null ? [] : [`Kampanj: ${campaignLabel(order.campaign)}`]),
    `Att betala: ${formatSek(order.totalSek)}`,
    `Adress: ${order.name}, ${order.street}, ${formatPostalCode(order.postalCode)} ${order.city}`,
  ].join('\n');
}

function button(url: string, label: string): string {
  return `<p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

/** Läge A: hur kunden betalar manuellt, om de inte redan gjort det via knappen. */
export type ManualPaymentInfo = { payee: string } | null;

export function orderConfirmationEmail(
  order: Order,
  orderUrl: string,
  manual: ManualPaymentInfo,
): Email {
  // Skickas direkt när ordern skapas, alltså FÖRE betalning – därför inget "tack" här.
  // Tacket kommer i paidEmail när betalningen är registrerad.
  const payHtml =
    manual === null
      ? '<p>Betala med Swish via knappen nedan.</p>'
      : `<p>Har du inte betalat än? Tryck på knappen nedan, eller swisha <strong>${escapeHtml(formatSek(order.totalSek))}</strong> till <strong>${escapeHtml(formatSwishNumber(manual.payee))}</strong> och skriv <strong>${escapeHtml(order.orderNumber)}</strong> som meddelande. Har du redan betalat behöver du inte göra något – vi mejlar dig när betalningen är registrerad.</p>`;
  const payText =
    manual === null
      ? 'Betala med Swish via länken nedan.'
      : `Har du inte betalat än? Swisha ${formatSek(order.totalSek)} till ${formatSwishNumber(manual.payee)} och skriv ${order.orderNumber} som meddelande. Har du redan betalat behöver du inte göra något – vi mejlar dig när betalningen är registrerad.`;

  const intro =
    'Vi har tagit emot din beställning. Din order behandlas först när vi har bekräftat att betalningen har kommit in till oss. Vi stämmer av inkomna Swish-betalningar manuellt, oftast inom ett dygn, och meddelar dig via e-post så snart betalningen är registrerad.';
  const trackInfo =
    'Under "Följ din order" ser du hela tiden om vi har registrerat din betalning och när ordern packas och skickas. Sidan uppdateras automatiskt.';

  return {
    to: order.email,
    subject: `Orderbekräftelse ${order.orderNumber} – väntar på betalning`,
    html: layout(
      'Orderbekräftelse',
      `<p>${escapeHtml(intro)}</p>
${summaryHtml(order)}
${payHtml}
${button(orderUrl, 'Betala med Swish')}
<p>${escapeHtml(trackInfo)}</p>
${button(orderUrl, 'Följ din order')}`,
    ),
    text: `Orderbekräftelse\n\n${intro}\n\n${summaryText(order)}\n\n${payText}\n\nBetala med Swish: ${orderUrl}\n\n${trackInfo}\nFölj din order: ${orderUrl}\n\nStudentstil`,
  };
}

export function paidEmail(order: Order): Email {
  return {
    to: order.email,
    subject: `Tack för din beställning – ${order.orderNumber}`,
    html: layout(
      `Tack för din beställning, ${order.name.split(' ')[0] ?? order.name}!`,
      `<p>Vi har tagit emot din betalning och börjar packa din beställning.</p>${summaryHtml(order)}`,
    ),
    text: `Tack för din beställning!\n\nVi har tagit emot din betalning och börjar packa din beställning.\n\n${summaryText(order)}\n\nStudentstil`,
  };
}

export function shippedEmail(order: Order): Email {
  if (order.delivery === 'skola') {
    const place = order.school ?? 'skolan';
    return {
      to: order.email,
      subject: `Klar att hämta – ${order.orderNumber}`,
      html: layout(
        'Din beställning är klar att hämta',
        `<p>Din beställning är packad och klar att hämta på <strong>${escapeHtml(place)}</strong>. Ta med ordernumret <strong>${escapeHtml(order.orderNumber)}</strong>.</p>${summaryHtml(order)}`,
      ),
      text: `Din beställning är klar att hämta på ${place}. Ta med ordernumret ${order.orderNumber}.\n\n${summaryText(order)}\n\nStudentstil`,
    };
  }
  const tracking = order.trackingNumber === null ? null : trackingUrl(order.trackingNumber);
  return {
    to: order.email,
    subject: `Din beställning är på väg – ${order.orderNumber}`,
    html: layout(
      'Din beställning är på väg',
      `<p>Nu har vi skickat din beställning med PostNord. Grattis till studenten!</p>${tracking === null ? '' : button(tracking, 'Spåra paketet hos PostNord')}${summaryHtml(order)}`,
    ),
    text: `Din beställning är på väg med PostNord. Grattis till studenten!${tracking === null ? '' : `\n\nSpåra paketet: ${tracking}`}\n\n${summaryText(order)}\n\nStudentstil`,
  };
}

export function shopNotificationEmail(order: Order, to: string): Email {
  const isClass = order.kind === 'klass';
  const extra: [string, string][] = [
    ['Typ', isClass ? 'Klassbeställning' : 'Privat'],
    ...(isClass ? [['Skola', order.school ?? '–'] as [string, string]] : []),
    ['Klass', order.schoolClass],
    ['E-post', order.email],
    ['Mobil', order.phone ?? '–'],
    ['Källa', order.source],
    ['Kommentar', order.comment ?? '–'],
  ];
  const title = `${isClass ? 'Ny klassbeställning' : 'Ny order'} ${order.orderNumber}`;
  return {
    to,
    replyTo: order.email,
    subject: `${title} – ${String(itemCount(order))} st (${formatSek(order.totalSek)})`,
    html: layout(
      title,
      `${summaryHtml(order)}<p>${extra.map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(value)}`).join('<br>')}</p>`,
    ),
    text: `Ny order\n\n${summaryText(order)}\n${extra.map(([label, value]) => `${label}: ${value}`).join('\n')}`,
  };
}
