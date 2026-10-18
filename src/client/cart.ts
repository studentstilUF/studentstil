/**
 * Varukorgen sparas i webbläsarens localStorage, så att den finns kvar om kunden
 * byter sida eller stänger fliken. Den skickas till servern först när kunden
 * beställer – servern bestämmer alltid priser och lager.
 */
import * as v from 'valibot';

import {
  type CartLine,
  CartLineSchema,
  MAX_LINES,
  MAX_QUANTITY,
  mergeLines,
} from '../shared/orderInput.ts';

const STORAGE_KEY = 'studentstil-varukorg';
export const CART_CHANGED = 'studentstil:varukorg';

let memoryCart: CartLine[] = [];

export function getCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return memoryCart;
    const parsed = v.safeParse(v.array(CartLineSchema), JSON.parse(raw));
    return parsed.success ? parsed.output : [];
  } catch {
    // Privat läge kan blockera localStorage. Då gäller varukorgen bara den här sidan.
    return memoryCart;
  }
}

function saveCart(lines: readonly CartLine[]): void {
  memoryCart = mergeLines(lines).slice(0, MAX_LINES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCart));
  } catch {
    // Se kommentaren i getCart.
  }
  window.dispatchEvent(new CustomEvent(CART_CHANGED));
}

export function addToCart(productId: string, size: string, quantity = 1): void {
  saveCart([...getCart(), { productId, size, quantity }]);
}

export function setQuantity(productId: string, size: string, quantity: number): void {
  const lines = getCart();
  saveCart(
    quantity <= 0
      ? lines.filter((l) => !(l.productId === productId && l.size === size))
      : lines.map((l) =>
          l.productId === productId && l.size === size
            ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) }
            : l,
        ),
  );
}

export function removeFromCart(productId: string, size: string): void {
  setQuantity(productId, size, 0);
}

export function clearCart(): void {
  saveCart([]);
}

export function cartCount(): number {
  return getCart().reduce((sum, line) => sum + line.quantity, 0);
}

export function onCartChange(callback: () => void): void {
  window.addEventListener(CART_CHANGED, callback);
  // Uppdatera även om varukorgen ändras i en annan flik.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) callback();
  });
}
