import { describe, expect, it } from 'vitest';

import { bundleCount, bundleDiscount, bundlePrice } from './bundle.ts';

const products = [
  { id: 'studentoverall', priceSek: 299 },
  { id: 'sprayfarg', priceSek: 79 },
  { id: 'spritpenna', priceSek: 139 },
];

describe('studentpaketet', () => {
  it('räknar ordinarie paketpris', () => {
    expect(bundlePrice(products)).toBe(299 + 2 * 79 + 139);
  });

  it('ger 5 % på ett komplett paket, oavsett storlek och färger', () => {
    const lines = [
      { productId: 'studentoverall', quantity: 1 },
      { productId: 'sprayfarg', quantity: 1 },
      { productId: 'sprayfarg', quantity: 1 },
      { productId: 'spritpenna', quantity: 1 },
    ];
    expect(bundleCount(lines)).toBe(1);
    expect(bundleDiscount(lines, products)).toBe(Math.round(596 * 0.05));
  });

  it('ger ingen rabatt när något saknas', () => {
    const lines = [
      { productId: 'studentoverall', quantity: 3 },
      { productId: 'sprayfarg', quantity: 1 },
      { productId: 'spritpenna', quantity: 3 },
    ];
    expect(bundleDiscount(lines, products)).toBe(0);
  });

  it('räknar flera paket och bara kompletta', () => {
    const lines = [
      { productId: 'studentoverall', quantity: 2 },
      { productId: 'sprayfarg', quantity: 5 },
      { productId: 'spritpenna', quantity: 3 },
    ];
    expect(bundleCount(lines)).toBe(2);
    expect(bundleDiscount(lines, products)).toBe(Math.round(2 * 596 * 0.05));
  });
});
