import type { Order, OrderItem } from '../../shared/apiTypes.ts';
/** Orderlistan i adminpanelen: sök, filter, sortering, statusändring och CSV-export. */
import { campaignShortLabel } from '../../shared/campaign.ts';
import { toCsv } from '../../shared/csv.ts';
import { deliveryLabel, statusLabel } from '../../shared/delivery.ts';
import { formatDateTime, formatPostalCode, formatSek } from '../../shared/format.ts';
import { ORDER_STATUSES, type OrderStatus, STATUS_LABELS } from '../../shared/orderStatus.ts';
import { sourceChannel } from '../../shared/source.ts';
import { byId, downloadBlob, h } from '../dom.ts';
import { printOrders } from './printOrders.ts';

type SortKey =
  | 'orderNumber'
  | 'createdAt'
  | 'name'
  | 'schoolClass'
  | 'totalSek'
  | 'source'
  | 'status';

const SORT_KEYS: readonly SortKey[] = [
  'orderNumber',
  'createdAt',
  'name',
  'schoolClass',
  'totalSek',
  'source',
  'status',
];

/** Filtervärde för en vara: produkt + storlek/färg. */
function itemKey(item: OrderItem): string {
  return `${item.productId}|${item.size}`;
}

export type StatusChangeHandler = (order: Order, status: OrderStatus) => Promise<void>;

const search = byId('filter-search', HTMLInputElement);
const statusFilter = byId('filter-status', HTMLSelectElement);
const classFilter = byId('filter-class', HTMLSelectElement);
const sizeFilter = byId('filter-size', HTMLSelectElement);
const sourceFilter = byId('filter-source', HTMLSelectElement);
const body = byId('orders-body', HTMLTableSectionElement);
const count = byId('order-count', HTMLParagraphElement);
const table = byId('orders-table', HTMLTableElement);

let orders: Order[] = [];
let sortKey: SortKey = 'createdAt';
let sortDirection: 1 | -1 = -1;
let onStatusChange: StatusChangeHandler = () => Promise.resolve();
type TrackingHandler = (order: Order, trackingNumber: string) => Promise<void>;
let onTrackingChange: TrackingHandler = () => Promise.resolve();

/** Hemleverans: fält för PostNords kollinummer, så att kunden kan spåra paketet. */
function trackingForm(order: Order): HTMLFormElement | null {
  if (order.delivery !== 'hem') return null;
  const input = h('input', {
    type: 'text',
    value: order.trackingNumber ?? '',
    placeholder: 'Kollinummer',
    'aria-label': `PostNords kollinummer för ${order.orderNumber}`,
    maxlength: 40,
    class: 'tracking-input',
  });
  const save = h('button', { type: 'submit', class: 'link-button small' }, 'Spara');
  const form = h('form', { class: 'tracking-form' }, input, save);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save.disabled = true;
    onTrackingChange(order, input.value)
      .catch((error: unknown) => {
        window.alert(error instanceof Error ? error.message : 'Kunde inte spara kollinumret.');
      })
      .finally(() => {
        save.disabled = false;
      });
  });
  return form;
}

function sourceLabel(source: string): string {
  const channel = sourceChannel(source);
  if (source === 'webb' || source === 'qr') return channel;
  return `${channel} (${source.replace(/^qr-/u, '')})`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((v) => v !== ''))].sort((a, b) =>
    a.localeCompare(b, 'sv', { numeric: true }),
  );
}

function fillSelect(
  select: HTMLSelectElement,
  allLabel: string,
  options: readonly (readonly [string, string])[],
): void {
  const current = select.value;
  select.replaceChildren(
    h('option', { value: '' }, allLabel),
    ...options.map(([value, label]) => h('option', { value }, label)),
  );
  select.value = options.some(([value]) => value === current) ? current : '';
}

function fillFilters(): void {
  fillSelect(
    statusFilter,
    'Alla statusar',
    ORDER_STATUSES.map((s) => [s, STATUS_LABELS[s]] as const),
  );
  fillSelect(
    classFilter,
    'Alla klasser',
    uniqueSorted(orders.map((o) => o.schoolClass)).map((c) => [c, c] as const),
  );
  const itemOptions = new Map<string, string>();
  for (const item of orders.flatMap((o) => o.items)) {
    itemOptions.set(itemKey(item), `${item.productName} – ${item.size}`);
  }
  fillSelect(
    sizeFilter,
    'Alla varor',
    [...itemOptions.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sv', { numeric: true })),
  );
  fillSelect(sourceFilter, 'Alla källor', [
    ['typ:klass', 'Klassbeställningar'],
    ['typ:privat', 'Privata beställningar'],
    ['kanal:Webb', 'Webb (alla)'],
    ['kanal:QR', 'QR (alla)'],
    ...uniqueSorted(orders.map((o) => o.source)).map((s) => [s, sourceLabel(s)] as const),
  ]);
}

function matchesSource(order: Order, filter: string): boolean {
  if (filter === '') return true;
  if (filter.startsWith('typ:')) return order.kind === filter.slice(4);
  if (filter.startsWith('kanal:')) return sourceChannel(order.source) === filter.slice(6);
  return order.source === filter;
}

export function visibleOrders(): Order[] {
  const query = search.value.trim().toLowerCase();
  const compare = (a: Order, b: Order): number => {
    const x = a[sortKey];
    const y = b[sortKey];
    const result =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'sv', { numeric: true });
    return result * sortDirection;
  };
  return orders
    .filter(
      (o) =>
        (statusFilter.value === '' || o.status === statusFilter.value) &&
        (classFilter.value === '' || o.schoolClass === classFilter.value) &&
        (sizeFilter.value === '' || o.items.some((item) => itemKey(item) === sizeFilter.value)) &&
        matchesSource(o, sourceFilter.value) &&
        (query === '' ||
          [
            o.orderNumber,
            o.name,
            o.email,
            o.schoolClass,
            o.school ?? '',
            o.street,
            o.city,
            o.postalCode,
            ...o.items.map((item) => `${item.productName} ${item.size}`),
            o.phone ?? '',
            o.comment ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)),
    )
    .sort(compare);
}

function statusSelect(order: Order): HTMLSelectElement {
  const select = h(
    'select',
    {
      'aria-label': `Status för ${order.orderNumber}`,
      'data-status': order.status,
      class: 'status-select',
    },
    ...ORDER_STATUSES.map((s) =>
      h('option', { value: s, selected: s === order.status }, statusLabel(s, order.delivery)),
    ),
  );
  select.addEventListener('change', () => {
    const next = ORDER_STATUSES.find((s) => s === select.value);
    if (next === undefined) return;
    if (
      next === 'avbruten' &&
      !window.confirm(
        `Avbryta ${order.orderNumber}? Var ordern betald läggs varan tillbaka i lager.`,
      )
    ) {
      select.value = order.status;
      return;
    }
    select.disabled = true;
    onStatusChange(order, next)
      .catch((error: unknown) => {
        window.alert(error instanceof Error ? error.message : 'Kunde inte ändra status.');
        select.value = order.status;
      })
      .finally(() => {
        select.disabled = false;
      });
  });
  return select;
}

function row(order: Order): HTMLTableRowElement {
  const address = `${order.street}, ${formatPostalCode(order.postalCode)} ${order.city}`;
  return h(
    'tr',
    {},
    h('td', { class: 'nowrap' }, h('strong', {}, order.orderNumber)),
    h('td', { class: 'nowrap' }, formatDateTime(order.createdAt)),
    h(
      'td',
      {},
      order.kind === 'klass' ? h('span', { class: 'kind-badge' }, 'Klassbeställning') : null,
      order.name,
      order.phone === null ? null : h('div', { class: 'muted small' }, order.phone),
    ),
    h(
      'td',
      {},
      order.schoolClass,
      order.school === null ? null : h('div', { class: 'muted small' }, order.school),
    ),
    h(
      'td',
      { class: 'items' },
      h(
        'ul',
        { class: 'item-list' },
        ...order.items.map((item) =>
          h(
            'li',
            {},
            `${String(item.quantity)} × ${item.productName}, `,
            h('strong', {}, item.size),
          ),
        ),
      ),
      order.comment === null
        ? null
        : h('div', { class: 'muted small comment' }, `”${order.comment}”`),
    ),
    h(
      'td',
      { class: 'address' },
      address,
      h(
        'div',
        { class: order.delivery === 'skola' ? 'delivery-tag delivery-tag-school' : 'delivery-tag' },
        deliveryLabel(order),
      ),
      order.campaign === null
        ? null
        : h(
            'div',
            { class: 'campaign-tag' },
            order.discountSek > 0
              ? `${campaignShortLabel(order.campaign)}: ${formatSek(order.discountSek)}`
              : campaignShortLabel(order.campaign),
          ),
    ),
    h('td', {}, h('a', { href: `mailto:${order.email}` }, order.email)),
    h('td', { class: 'nowrap number' }, formatSek(order.totalSek)),
    h('td', { class: 'nowrap' }, sourceLabel(order.source)),
    h('td', {}, statusSelect(order), trackingForm(order)),
  );
}

export function renderOrders(): void {
  const visible = visibleOrders();
  body.replaceChildren(
    ...(visible.length > 0
      ? visible.map(row)
      : [
          h(
            'tr',
            {},
            h('td', { colspan: 10, class: 'muted empty' }, 'Inga ordrar matchar filtren.'),
          ),
        ]),
  );
  count.textContent = `Visar ${String(visible.length)} av ${String(orders.length)} ordrar`;
  for (const button of table.querySelectorAll<HTMLButtonElement>('button[data-sort]')) {
    const active = button.dataset['sort'] === sortKey;
    button
      .closest('th')
      ?.setAttribute(
        'aria-sort',
        active ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none',
      );
  }
}

export function setOrders(next: Order[]): void {
  orders = next;
  fillFilters();
  renderOrders();
}

export function replaceOrder(updated: Order): void {
  orders = orders.map((o) => (o.orderNumber === updated.orderNumber ? updated : o));
  renderOrders();
}

/** En rad per vara (bra som packlista), med orderns uppgifter upprepade på varje rad. */
export function exportCsv(): void {
  const header = [
    'Ordernummer',
    'Datum',
    'Status',
    'Typ',
    'Namn',
    'Skola',
    'Klass',
    'Produkt',
    'Storlek/färg',
    'Antal',
    'Radbelopp (kr)',
    'Ordertotal (kr)',
    'Gatuadress',
    'Postnummer',
    'Ort',
    'Leverans',
    'Frakt (kr)',
    'Paketrabatt (kr)',
    'Att återbetala (kr)',
    'Kampanj',
    'Kollinummer',
    'E-post',
    'Mobil',
    'Kommentar',
    'Källa',
    'Kanal',
    'Betald',
    'Skickad',
  ];
  const rows = visibleOrders().flatMap((o) =>
    o.items.map((item) => [
      o.orderNumber,
      formatDateTime(o.createdAt),
      statusLabel(o.status, o.delivery),
      o.kind === 'klass' ? 'Klassbeställning' : 'Privat',
      o.name,
      o.school ?? '',
      o.schoolClass,
      item.productName,
      item.size,
      item.quantity,
      item.lineTotalSek,
      o.totalSek,
      o.street,
      formatPostalCode(o.postalCode),
      o.city,
      deliveryLabel(o),
      o.shippingSek,
      o.bundleDiscountSek,
      o.discountSek,
      o.campaign === null ? '' : campaignShortLabel(o.campaign),
      o.trackingNumber ?? '',
      o.email,
      o.phone ?? '',
      o.comment ?? '',
      o.source,
      sourceChannel(o.source),
      o.paidAt === null ? '' : formatDateTime(o.paidAt),
      o.shippedAt === null ? '' : formatDateTime(o.shippedAt),
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([toCsv([header, ...rows])], { type: 'text/csv;charset=utf-8' }),
    `studentstil-ordrar-${date}.csv`,
  );
}

/** Klick på en kolumnrubrik: sortera på den, eller vänd ordningen om den redan är vald. */
function sortBy(column: string | undefined): void {
  const key = SORT_KEYS.find((k) => k === column);
  if (key === undefined) return;
  sortDirection = key === sortKey ? (sortDirection === 1 ? -1 : 1) : 1;
  sortKey = key;
  renderOrders();
}

export function initOrdersView(handler: StatusChangeHandler, tracking: TrackingHandler): void {
  onStatusChange = handler;
  onTrackingChange = tracking;
  for (const element of [search, statusFilter, classFilter, sizeFilter, sourceFilter]) {
    element.addEventListener('input', renderOrders);
  }
  for (const button of table.querySelectorAll<HTMLButtonElement>('button[data-sort]')) {
    button.addEventListener('click', () => {
      sortBy(button.dataset['sort']);
    });
  }
  byId('export-csv', HTMLButtonElement).addEventListener('click', exportCsv);
  byId('print-orders', HTMLButtonElement).addEventListener('click', () => {
    printOrders(visibleOrders());
  });
}
