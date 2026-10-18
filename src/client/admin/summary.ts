/** Räknar ut sammanställningen i adminpanelen. Ren logik utan DOM, så att den kan testas. */
import { itemCount, type Order, type OrderItem } from '../../shared/apiTypes.ts';
import { isPaid } from '../../shared/orderStatus.ts';
import { sourceChannel } from '../../shared/source.ts';

/** items = sålda varor, orders = antal ordrar, amount = belopp i kronor. */
export type SummaryRow = { key: string; items: number; orders: number; amount: number };

export type Summary = {
  orderCount: number;
  itemCount: number;
  paidAmount: number;
  unpaidAmount: number;
  cancelledCount: number;
  bySize: SummaryRow[];
  byProduct: SummaryRow[];
  byProductSize: SummaryRow[];
  byClass: SummaryRow[];
  byChannel: SummaryRow[];
  bySource: SummaryRow[];
};

function sortRows(rows: Iterable<SummaryRow>): SummaryRow[] {
  return [...rows].sort((a, b) => b.items - a.items || a.key.localeCompare(b.key, 'sv'));
}

/** Gruppera hela ordrar, t.ex. per klass eller källa. */
function groupOrders(orders: readonly Order[], keyOf: (order: Order) => string): SummaryRow[] {
  const rows = new Map<string, SummaryRow>();
  for (const order of orders) {
    const key = keyOf(order);
    const row = rows.get(key) ?? { key, items: 0, orders: 0, amount: 0 };
    row.items += itemCount(order);
    row.orders += 1;
    row.amount += order.totalSek;
    rows.set(key, row);
  }
  return sortRows(rows.values());
}

/** Gruppera enskilda varor, t.ex. per storlek. "orders" = hur många ordrar varan finns i. */
function groupItems(orders: readonly Order[], keyOf: (item: OrderItem) => string): SummaryRow[] {
  const rows = new Map<string, SummaryRow & { seen: Set<string> }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = keyOf(item);
      const row = rows.get(key) ?? { key, items: 0, orders: 0, amount: 0, seen: new Set<string>() };
      row.items += item.quantity;
      row.amount += item.lineTotalSek;
      row.seen.add(order.orderNumber);
      row.orders = row.seen.size;
      rows.set(key, row);
    }
  }
  return sortRows([...rows.values()].map(({ seen: _seen, ...row }) => row));
}

/** Avbrutna ordrar räknas inte som sålda. */
export function summarize(orders: readonly Order[]): Summary {
  const active = orders.filter((o) => o.status !== 'avbruten');
  const sum = (list: readonly Order[]): number => list.reduce((total, o) => total + o.totalSek, 0);
  return {
    orderCount: active.length,
    itemCount: active.reduce((total, o) => total + itemCount(o), 0),
    paidAmount: sum(active.filter((o) => isPaid(o.status))),
    unpaidAmount: sum(active.filter((o) => o.status === 'vantar_betalning')),
    cancelledCount: orders.length - active.length,
    bySize: groupItems(active, (item) => item.size),
    byProduct: groupItems(active, (item) => item.productName),
    byProductSize: groupItems(active, (item) => `${item.productName} – ${item.size}`),
    byClass: groupOrders(active, (o) => (o.schoolClass === '' ? '(raderad)' : o.schoolClass)),
    byChannel: groupOrders(active, (o) => sourceChannel(o.source)),
    bySource: groupOrders(active, (o) => o.source),
  };
}
