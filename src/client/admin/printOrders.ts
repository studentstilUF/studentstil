/**
 * Utskrift av ordrar: en tydlig packsedel per order, med kryssrutor för varje
 * vara. Skriver ut de ordrar som syns i listan just nu, så filtrera först
 * (t.ex. status "Betald" eller en viss skola) och tryck sedan "Skriv ut".
 */
import type { Order } from '../../shared/apiTypes.ts';
import { campaignShortLabel } from '../../shared/campaign.ts';
import { deliveryLabel, shippingLabel } from '../../shared/delivery.ts';
import { formatDateTime, formatPostalCode, formatSek } from '../../shared/format.ts';
import { STATUS_LABELS } from '../../shared/orderStatus.ts';
import { h, nodes } from '../dom.ts';

function row(label: string, value: string): HTMLElement {
  return h('div', { class: 'print-row' }, h('dt', {}, label), h('dd', {}, value));
}

function packingSlip(order: Order): HTMLElement {
  const isClass = order.kind === 'klass';
  return h(
    'article',
    { class: 'print-order' },
    h(
      'header',
      { class: 'print-order-head' },
      h('h2', {}, order.orderNumber),
      h('span', { class: 'print-status' }, STATUS_LABELS[order.status]),
    ),
    h(
      'p',
      { class: 'print-delivery' },
      deliveryLabel(order),
      isClass ? ` · Klassbeställning ${order.schoolClass}` : '',
    ),
    order.campaign === null
      ? null
      : h('p', { class: 'print-campaign' }, `KAMPANJ: ${campaignShortLabel(order.campaign)}`),
    h(
      'dl',
      { class: 'print-details' },
      ...nodes(
        row('Namn', order.name),
        isClass ? null : row('Klass', order.schoolClass),
        order.delivery === 'hem'
          ? row('Adress', `${order.street}, ${formatPostalCode(order.postalCode)} ${order.city}`)
          : null,
        row('Telefon', order.phone ?? '–'),
        row('E-post', order.email),
        row('Beställd', formatDateTime(order.createdAt)),
      ),
    ),
    h(
      'table',
      { class: 'print-items' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col', class: 'print-check' }, 'Packad'),
          h('th', { scope: 'col' }, 'Antal'),
          h('th', { scope: 'col' }, 'Vara'),
          h('th', { scope: 'col', class: 'number' }, 'Belopp'),
        ),
      ),
      h(
        'tbody',
        {},
        ...order.items.map((item) =>
          h(
            'tr',
            {},
            h('td', { class: 'print-check' }, '☐'),
            h('td', {}, `${String(item.quantity)} st`),
            h('td', {}, `${item.productName}, `, h('strong', {}, item.size)),
            h('td', { class: 'number' }, formatSek(item.lineTotalSek)),
          ),
        ),
      ),
      h(
        'tfoot',
        {},
        h(
          'tr',
          {},
          h('td', { colspan: 3 }, 'Frakt'),
          h('td', { class: 'number' }, shippingLabel(order.shippingSek)),
        ),
        ...(order.discountSek > 0
          ? [
              h(
                'tr',
                {},
                h('td', { colspan: 3 }, 'Att återbetala (kampanj)'),
                h('td', { class: 'number' }, formatSek(order.discountSek)),
              ),
            ]
          : []),
        h(
          'tr',
          { class: 'print-total' },
          h('td', { colspan: 3 }, 'Totalt'),
          h('td', { class: 'number' }, formatSek(order.totalSek)),
        ),
      ),
    ),
    order.comment === null
      ? null
      : h('p', { class: 'print-comment' }, `Kommentar: ${order.comment}`),
  );
}

/** Ritar packsedlarna och öppnar webbläsarens utskriftsfönster. */
export function printOrders(orders: readonly Order[]): void {
  if (orders.length === 0) {
    window.alert('Inga ordrar att skriva ut. Ändra filtren så att ordrarna syns i listan.');
    return;
  }
  document.getElementById('print-view')?.remove();
  const view = h(
    'div',
    { id: 'print-view' },
    h(
      'p',
      { class: 'print-meta' },
      `Studentstil · ${String(orders.length)} ordrar · utskrivet ${formatDateTime(new Date().toISOString())}`,
    ),
    ...orders.map(packingSlip),
  );
  document.body.append(view);
  window.addEventListener(
    'afterprint',
    () => {
      view.remove();
    },
    { once: true },
  );
  window.print();
}
