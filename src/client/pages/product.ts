/** Produktsidan (/produkt/?id=…): stora bilder, val av storlek/färg, antal och "Lägg i varukorgen". */
import type { Product } from '../../shared/apiTypes.ts';
import { formatSek } from '../../shared/format.ts';
import { MAX_QUANTITY } from '../../shared/orderInput.ts';
import { addToCart } from '../cart.ts';
import { colorSwatch } from '../colorSwatch.ts';
import { byId, h, nodes } from '../dom.ts';
import { productGallery } from '../gallery.ts';
import { type SizeGuide, productInfo } from '../productInfo.ts';
import { fetchProducts, hasVariantChoice, productCard } from '../products.ts';

const container = byId('product', HTMLDivElement);
const breadcrumb = byId('breadcrumb-current', HTMLSpanElement);
const related = byId('related', HTMLElement);
const relatedGrid = byId('related-grid', HTMLDivElement);
const productId = new URLSearchParams(window.location.search).get('id') ?? '';

function setMetaDescription(text: string): void {
  document.querySelector('meta[name="description"]')?.setAttribute('content', text);
}

/** Storlekar/färger som knappar (radioknappar). Slut i lager visas överstruket. */
function variantPicker(product: Product, onChange: () => void): HTMLFieldSetElement {
  const available = product.sizes.filter((s) => s.available);
  const options = product.sizes.map((size) => {
    const input = h('input', {
      type: 'radio',
      name: 'variant',
      value: size.size,
      disabled: !size.available,
      checked: available.length === 1 && size.available,
    });
    input.addEventListener('change', onChange);
    return h(
      'label',
      { class: 'variant-option', 'data-disabled': String(!size.available) },
      input,
      colorSwatch(size.size),
      h('span', {}, size.size),
      size.fewLeft ? h('small', {}, 'få kvar') : null,
      size.available ? null : h('span', { class: 'visually-hidden' }, ' (slut i lager)'),
    );
  });
  // Paket (bara en variant): valet görs automatiskt och visas inte.
  return h(
    'fieldset',
    { class: 'variant-picker', hidden: !hasVariantChoice(product) },
    h('legend', {}, product.variantLabel),
    h('div', { class: 'variant-options' }, ...options),
  );
}

function sizeTable(table: NonNullable<SizeGuide['table']>): HTMLTableElement {
  return h(
    'table',
    {},
    h('thead', {}, h('tr', {}, ...table.columns.map((c) => h('th', { scope: 'col' }, c)))),
    h(
      'tbody',
      {},
      ...table.rows.map((row) =>
        h(
          'tr',
          {},
          ...row.map((cell, i) => (i === 0 ? h('th', { scope: 'row' }, cell) : h('td', {}, cell))),
        ),
      ),
    ),
  );
}

function sizeGuideSection(guide: SizeGuide): HTMLElement {
  return h(
    'details',
    { class: 'product-details' },
    h('summary', {}, 'Storleksguide'),
    h(
      'div',
      { class: 'prose' },
      ...nodes(
        h('p', {}, guide.note),
        guide.table === undefined
          ? null
          : h('div', { class: 'table-wrap' }, sizeTable(guide.table)),
      ),
    ),
  );
}

function renderProduct(product: Product): void {
  document.title = `${product.name} – Studentstil`;
  breadcrumb.textContent = product.name;
  setMetaDescription(product.description);

  const info = productInfo(product.id);
  const inStock = product.sizes.some((s) => s.available);
  let quantity = 1;

  const status = h('p', { class: 'add-status', 'aria-live': 'polite' });
  const picker = variantPicker(product, () => {
    status.textContent = '';
    status.className = 'add-status';
  });

  const quantityOutput = h('output', { 'aria-label': 'Antal' }, '1');
  const minus = h('button', { type: 'button', 'aria-label': 'Minska antal', disabled: true }, '−');
  const plus = h('button', { type: 'button', 'aria-label': 'Öka antal' }, '+');
  const updateQuantity = (next: number): void => {
    quantity = Math.max(1, Math.min(MAX_QUANTITY, next));
    quantityOutput.textContent = String(quantity);
    minus.disabled = quantity <= 1;
    plus.disabled = quantity >= MAX_QUANTITY;
  };
  minus.addEventListener('click', () => {
    updateQuantity(quantity - 1);
  });
  plus.addEventListener('click', () => {
    updateQuantity(quantity + 1);
  });

  const addButton = h(
    'button',
    { type: 'submit', class: 'button button-large' },
    'Lägg i varukorgen',
  );
  const form = h(
    'form',
    { class: 'product-buy', novalidate: true },
    picker,
    h(
      'div',
      { class: 'product-quantity' },
      h('span', { class: 'product-quantity-label' }, 'Antal'),
      h('div', { class: 'stepper' }, minus, quantityOutput, plus),
    ),
    addButton,
    status,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = form.querySelector<HTMLInputElement>('input[name="variant"]:checked');
    if (selected === null) {
      status.className = 'add-status field-error';
      status.textContent = `Välj ${product.variantLabel.toLowerCase()} först.`;
      form.querySelector<HTMLInputElement>('input[name="variant"]:not(:disabled)')?.focus();
      return;
    }
    addToCart(product.id, selected.value, quantity);
    status.className = 'add-status';
    status.replaceChildren(
      hasVariantChoice(product)
        ? `Tillagd: ${String(quantity)} × ${product.name}, ${selected.value}. `
        : `Tillagd: ${String(quantity)} × ${product.name}. `,
      h('a', { href: '/kassa/' }, 'Till kassan'),
    );
    // Tillbaka till 1 st så att nästa tryck inte råkar lägga till många.
    updateQuantity(1);
  });

  container.replaceChildren(
    h(
      'div',
      { class: 'product-page' },
      productGallery(product, { large: true }),
      h(
        'div',
        { class: 'product-summary' },
        h('h1', {}, product.name),
        h('p', { class: 'product-price' }, formatSek(product.priceSek)),
        h('p', { class: 'product-description' }, product.description),
        inStock ? form : h('p', { class: 'notice' }, 'Slut i lager just nu. Kom tillbaka snart!'),
        h(
          'ul',
          { class: 'product-perks' },
          h('li', {}, 'Betala enkelt med Swish'),
          h('li', {}, 'Gratis hämtning på skolor i Kungsbacka'),
          h('li', {}, '14 dagars ångerrätt'),
        ),
        ...nodes(
          info.facts.length > 0
            ? h(
                'details',
                { class: 'product-details', open: true },
                h('summary', {}, 'Om produkten'),
                h('ul', {}, ...info.facts.map((fact) => h('li', {}, fact))),
              )
            : null,
          info.sizeGuide === undefined ? null : sizeGuideSection(info.sizeGuide),
        ),
      ),
    ),
  );
}

function renderRelated(products: readonly Product[], current: Product): void {
  const others = products.filter((p) => p.id !== current.id);
  if (others.length === 0) return;
  relatedGrid.replaceChildren(...others.map(productCard));
  related.hidden = false;
}

function renderNotFound(message: string): void {
  breadcrumb.textContent = 'Hittades inte';
  container.replaceChildren(
    h('h1', {}, 'Produkten hittades inte'),
    h('p', { class: 'notice notice-error', role: 'alert' }, message),
    h('p', {}, h('a', { class: 'button', href: '/bestall/' }, 'Till alla produkter')),
  );
}

async function init(): Promise<void> {
  try {
    const products = await fetchProducts();
    const product = products.find((p) => p.id === productId);
    if (product === undefined) {
      renderNotFound('Länken kan vara gammal, eller så säljer vi inte produkten längre.');
      return;
    }
    renderProduct(product);
    renderRelated(products, product);
  } catch (error) {
    renderNotFound(error instanceof Error ? error.message : 'Kunde inte hämta produkten.');
  }
}

void init();
