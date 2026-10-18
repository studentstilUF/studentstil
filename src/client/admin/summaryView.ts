/** Fliken "Sammanställning": nyckeltal och tabeller per storlek, klass och källa. */
import type { Order } from '../../shared/apiTypes.ts';
import { formatSek } from '../../shared/format.ts';
import { byId, h } from '../dom.ts';
import { summarize, type SummaryRow } from './summary.ts';

const root = byId('summary-root', HTMLDivElement);

function stat(label: string, value: string, note?: string): HTMLElement {
  return h(
    'div',
    { class: 'stat' },
    h('p', { class: 'stat-label' }, label),
    h('p', { class: 'stat-value' }, value),
    note === undefined ? null : h('p', { class: 'muted small' }, note),
  );
}

function table(title: string, keyLabel: string, rows: readonly SummaryRow[]): HTMLElement {
  const max = Math.max(1, ...rows.map((r) => r.items));
  const bodyRows = rows.map((r) => {
    const bar = h('span', { class: 'bar' });
    bar.style.setProperty('--share', `${String(Math.round((r.items / max) * 100))}%`);
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, r.key),
      h('td', { class: 'number' }, String(r.items)),
      h('td', { class: 'bar-cell' }, bar),
      h('td', { class: 'number' }, String(r.orders)),
      h('td', { class: 'number nowrap' }, formatSek(r.amount)),
    );
  });
  return h(
    'section',
    { class: 'summary-table' },
    h('h3', {}, title),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'data-table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, keyLabel),
            h('th', { scope: 'col', class: 'number' }, 'Sålda st'),
            h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Andel')),
            h('th', { scope: 'col', class: 'number' }, 'Ordrar'),
            h('th', { scope: 'col', class: 'number' }, 'Belopp'),
          ),
        ),
        h(
          'tbody',
          {},
          ...(bodyRows.length > 0
            ? bodyRows
            : [h('tr', {}, h('td', { colspan: 5, class: 'muted' }, 'Inga ordrar än.'))]),
        ),
      ),
    ),
  );
}

export function renderSummary(orders: readonly Order[]): void {
  const s = summarize(orders);
  root.replaceChildren(
    h(
      'div',
      { class: 'stats' },
      stat('Betald försäljning', formatSek(s.paidAmount), 'Betald, packad, skickad och levererad'),
      stat('Väntar på betalning', formatSek(s.unpaidAmount)),
      stat(
        'Ordrar',
        String(s.orderCount),
        s.cancelledCount > 0 ? `+ ${String(s.cancelledCount)} avbrutna (räknas inte)` : undefined,
      ),
      stat('Sålda varor', `${String(s.itemCount)} st`),
    ),
    h(
      'div',
      { class: 'summary-grid' },
      table('Per produkt', 'Produkt', s.byProduct),
      table('Per kanal', 'Kanal', s.byChannel),
      table('Per storlek / färg', 'Storlek/färg', s.bySize),
      table('Per klass', 'Klass', s.byClass),
      table('Per källa / QR-kod', 'Källa', s.bySource),
    ),
    table(
      'Per produkt och storlek/färg (inköp och packning)',
      'Produkt – storlek/färg',
      s.byProductSize,
    ),
  );
}
