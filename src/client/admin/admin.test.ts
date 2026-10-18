import { describe, expect, it } from 'vitest';

import type { Order, OrderItem } from '../../shared/apiTypes.ts';
import { jpegToPdf } from './pdf.ts';
import { posterTarget } from './poster.ts';
import { summarize } from './summary.ts';

function item(
  productName: string,
  size: string,
  quantity: number,
  unitPriceSek: number,
): OrderItem {
  return {
    productId: productName.toLowerCase(),
    productName,
    size,
    quantity,
    unitPriceSek,
    lineTotalSek: quantity * unitPriceSek,
  };
}

function order(overrides: Partial<Order>): Order {
  const items = overrides.items ?? [item('Studentoverall', 'M', 1, 599)];
  return {
    orderNumber: 'SS-2026-0001',
    createdAt: '2026-05-01T10:00:00Z',
    status: 'betald',
    name: 'Test Testsson',
    email: 'test@example.com',
    schoolClass: 'TE3A',
    street: 'Gatan 1',
    postalCode: '12345',
    city: 'Stad',
    phone: null,
    comment: null,
    kind: 'privat',
    school: null,
    source: 'webb',
    paidAt: null,
    shippedAt: null,
    ...overrides,
    items,
    totalSek: items.reduce((sum, i) => sum + i.lineTotalSek, 0),
  };
}

describe('summarize', () => {
  it('räknar betalt, obetalt och hoppar över avbrutna', () => {
    const summary = summarize([
      order({ orderNumber: 'SS-2026-0001' }),
      order({
        orderNumber: 'SS-2026-0002',
        status: 'vantar_betalning',
        source: 'qr-skolan',
        items: [item('Studentoverall', 'L', 1, 599), item('Sprayfärg', 'Gul', 2, 89)],
      }),
      order({
        orderNumber: 'SS-2026-0003',
        status: 'avbruten',
        items: [item('Studentoverall', 'S', 2, 599)],
      }),
      order({
        orderNumber: 'SS-2026-0004',
        status: 'skickad',
        schoolClass: 'NA3B',
        items: [item('Studentoverall', 'M', 1, 599), item('Spritpenna', 'Röd', 3, 29)],
      }),
    ]);
    expect(summary.orderCount).toBe(3);
    expect(summary.itemCount).toBe(1 + 3 + 4);
    expect(summary.paidAmount).toBe(599 + 599 + 87);
    expect(summary.unpaidAmount).toBe(599 + 178);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.byProduct).toEqual([
      // Lika många sålda → bokstavsordning
      { key: 'Spritpenna', items: 3, orders: 1, amount: 87 },
      { key: 'Studentoverall', items: 3, orders: 3, amount: 1797 },
      { key: 'Sprayfärg', items: 2, orders: 1, amount: 178 },
    ]);
    expect(summary.bySize.find((r) => r.key === 'M')).toEqual({
      key: 'M',
      items: 2,
      orders: 2,
      amount: 1198,
    });
    expect(summary.byChannel.map((r) => r.key)).toEqual(['Webb', 'QR']);
  });
});

describe('posterTarget', () => {
  it('bygger länk och källa för en plats', () => {
    expect(posterTarget('Mässa')).toEqual({
      source: 'qr-massa',
      url: 'https://studentstil.se/bestall/?kalla=qr-massa',
    });
    expect(posterTarget('').source).toBe('qr');
  });
});

describe('jpegToPdf', () => {
  it('skapar en giltig PDF-struktur med korrekt xref', () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = new TextDecoder('latin1').decode(jpegToPdf(fakeJpeg, 10, 20, 'A4'));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/u.exec(pdf)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    // Varje objekt ska ligga exakt där xref-tabellen säger.
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n\r$/gmu)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, index) => {
      expect(pdf.slice(offset).startsWith(`${String(index + 1)} 0 obj`)).toBe(true);
    });
  });
});
