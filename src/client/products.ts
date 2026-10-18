/** Hämtar och visar produktkort. Används på startsidan och produktsidan. */
import { type Product, ProductsResponseSchema } from '../shared/apiTypes.ts';
import { formatSek } from '../shared/format.ts';
import { apiGet } from './api.ts';
import { addToCart } from './cart.ts';
import { h } from './dom.ts';
import { productGallery } from './gallery.ts';

export async function fetchProducts(): Promise<Product[]> {
  const response = await apiGet('/api/products', ProductsResponseSchema);
  return response.products;
}

/** Adressen till produktens egen sida. */
export function productUrl(product: Product): string {
  return `/produkt/?id=${encodeURIComponent(product.id)}`;
}

export function availableSizes(product: Product): string[] {
  return product.sizes.filter((s) => s.available).map((s) => s.size);
}

/**
 * Har produkten något att välja mellan? Spritpennorna säljs som ett paket med
 * en enda variant, så där visas inget val av färg eller storlek.
 */
export function hasVariantChoice(product: Product): boolean {
  return product.sizes.length > 1;
}

/** "Storlekar XS–XL" för kläder, "5 färger" för sprayfärg och pennor. */
function variantSummary(product: Product): string {
  const sizes = availableSizes(product);
  const first = sizes[0];
  const last = sizes.at(-1);
  if (first === undefined || last === undefined) return 'Slut i lager';
  if (!hasVariantChoice(product)) return 'Säljs som paket';
  if (product.variantLabel !== 'Storlek') {
    return sizes.length === 1
      ? first
      : `${String(sizes.length)} ${product.variantLabel.toLowerCase()}er`;
  }
  if (sizes.length === 1) return first === 'En storlek' ? 'En storlek' : `Storlek ${first}`;
  return `Storlekar ${first}–${last}`;
}

/**
 * Rullista med storlek/färg (bara det som finns i lager) och knappen "Lägg till".
 * Produkter utan val (paket) får bara knappen.
 */
function addToCartForm(product: Product): HTMLElement {
  const selectId = `variant-${product.id}`;
  const sizes = product.sizes.filter((s) => s.available);
  const choice = hasVariantChoice(product);
  const select = h(
    'select',
    { id: selectId, 'aria-describedby': `${selectId}-status`, hidden: !choice },
    ...(sizes.length === 1
      ? []
      : [h('option', { value: '' }, `Välj ${product.variantLabel.toLowerCase()}`)]),
    ...sizes.map((s) => h('option', { value: s.size }, s.fewLeft ? `${s.size} (få kvar)` : s.size)),
  );
  const status = h('p', {
    id: `${selectId}-status`,
    class: 'add-status small',
    'aria-live': 'polite',
  });
  const button = h(
    'button',
    { type: 'submit', class: 'button', 'aria-label': `Lägg ${product.name} i varukorgen` },
    'Lägg till',
  );
  const form = h(
    'form',
    { class: 'add-form', novalidate: true },
    h(
      'label',
      { for: selectId, class: 'visually-hidden' },
      `${product.variantLabel} för ${product.name}`,
    ),
    select,
    button,
    status,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (select.value === '') {
      status.className = 'add-status small field-error';
      status.textContent = `Välj ${product.variantLabel.toLowerCase()} först.`;
      select.focus();
      return;
    }
    addToCart(product.id, select.value);
    status.className = 'add-status small';
    status.replaceChildren(
      choice ? `Tillagd: ${product.name}, ${select.value}. ` : `Tillagd: ${product.name}. `,
      h('a', { href: '/kassa/' }, 'Till kassan'),
    );
  });
  return form;
}

export function productCard(product: Product): HTMLElement {
  const inStock = availableSizes(product).length > 0;
  return h(
    'article',
    { class: 'product-card' },
    productGallery(product, { href: productUrl(product) }),
    h(
      'div',
      { class: 'product-card-body' },
      h('h3', {}, h('a', { href: productUrl(product), class: 'product-link' }, product.name)),
      h('p', {}, product.description),
      h(
        'div',
        { class: 'product-meta' },
        h('span', { class: 'price' }, formatSek(product.priceSek)),
        h('span', { class: 'muted small' }, variantSummary(product)),
      ),
      inStock
        ? addToCartForm(product)
        : h('span', { class: 'button button-secondary', 'aria-disabled': 'true' }, 'Slut i lager'),
    ),
  );
}

export function renderSkeletons(container: HTMLElement, count: number): void {
  container.replaceChildren(
    ...Array.from({ length: count }, () => h('div', { class: 'skeleton', 'aria-hidden': 'true' })),
  );
}

/** Fyller en container med produktkort (eller ett felmeddelande). */
export async function renderProductGrid(
  container: HTMLElement,
  filter: (p: Product) => boolean,
): Promise<void> {
  renderSkeletons(container, 3);
  container.setAttribute('aria-busy', 'true');
  try {
    const products = (await fetchProducts()).filter(filter);
    container.replaceChildren(
      ...(products.length > 0
        ? products.map(productCard)
        : [h('p', { class: 'muted' }, 'Inga produkter just nu – kom tillbaka snart!')]),
    );
  } catch (error) {
    container.replaceChildren(
      h(
        'p',
        { class: 'notice notice-error', role: 'alert' },
        error instanceof Error ? error.message : 'Kunde inte hämta produkterna.',
      ),
    );
  } finally {
    container.removeAttribute('aria-busy');
  }
}
