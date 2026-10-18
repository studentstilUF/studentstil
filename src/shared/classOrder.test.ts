import { describe, expect, it } from 'vitest';

import { CLASS_DISCOUNT_MIN_OVERALLS, priceClassOrder } from './classOrder.ts';
import { validateOrderInput } from './orderInput.ts';

const products = [
  { id: 'studentoverall', name: 'Studentoverall', priceSek: 599, bulkPriceSek: 499 },
  { id: 'sprayfarg', name: 'Sprayfärg', priceSek: 89, bulkPriceSek: 75 },
  { id: 'spritpenna', name: 'Spritpennor 8-pack', priceSek: 149, bulkPriceSek: null },
];

describe('priceClassOrder', () => {
  it('ger ordinarie pris under 25 overaller', () => {
    const price = priceClassOrder(products, [
      { productId: 'studentoverall', size: 'M', quantity: 24 },
      { productId: 'sprayfarg', size: 'Röd', quantity: 2 },
    ]);
    expect(price.discount).toBe(false);
    expect(price.overallsMissing).toBe(1);
    expect(price.totalSek).toBe(24 * 599 + 2 * 89);
    expect(price.savingsSek).toBe(0);
  });

  it(`ger klasspris på allt från ${String(CLASS_DISCOUNT_MIN_OVERALLS)} overaller`, () => {
    const price = priceClassOrder(products, [
      { productId: 'studentoverall', size: 'S', quantity: 10 },
      { productId: 'studentoverall', size: 'M', quantity: 15 },
      { productId: 'sprayfarg', size: 'Gul', quantity: 4 },
      { productId: 'spritpenna', size: '8 färger', quantity: 2 },
    ]);
    expect(price.discount).toBe(true);
    expect(price.overalls).toBe(25);
    expect(price.overallsMissing).toBe(0);
    // Pennorna saknar klasspris och kostar ordinarie pris.
    expect(price.totalSek).toBe(25 * 499 + 4 * 75 + 2 * 149);
    expect(price.savingsSek).toBe(25 * 100 + 4 * 14);
  });

  it('räknar inte sprayfärg och pennor mot gränsen', () => {
    const price = priceClassOrder(products, [
      { productId: 'studentoverall', size: 'M', quantity: 20 },
      { productId: 'sprayfarg', size: 'Röd', quantity: 30 },
    ]);
    expect(price.discount).toBe(false);
  });
});

describe('validateOrderInput för klassbeställning', () => {
  const valid = {
    kind: 'klass',
    items: [{ productId: 'studentoverall', size: 'M', quantity: 30 }],
    name: 'Kim Klassrepresentant',
    email: 'kerstin@example.com',
    phone: '070-123 45 67',
    school: 'Exempelgymnasiet',
    schoolClass: 'na3b',
    street: 'Skolvägen 1',
    postalCode: '434 30',
    city: 'Kungsbacka',
    acceptTerms: true,
  };

  it('godkänner stora antal i en klassbeställning', () => {
    const result = validateOrderInput(valid);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.kind).toBe('klass');
  });

  it('kräver skola och mobilnummer', () => {
    const result = validateOrderInput({ ...valid, school: '', phone: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['school']).toMatch(/skolans namn/u);
    expect(result.errors['phone']).toMatch(/mobilnummer/u);
  });

  it('tillåter inte mer än 10 st av samma vara i en vanlig beställning', () => {
    const result = validateOrderInput({ ...valid, kind: 'privat' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['items']).toMatch(/klassbeställning/u);
  });
});
