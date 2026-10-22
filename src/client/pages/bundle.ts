/**
 * Studentpaketet (/paket/): välj overallens storlek och två sprayfärger, så
 * läggs overall, sprayfärger och spritpennor i varukorgen. Paketrabatten (10 %)
 * räknas sedan automatiskt i kassan och i databasen.
 */
import type { Product } from '../../shared/apiTypes.ts';
import { BUNDLE_DISCOUNT_PERCENT, bundlePrice } from '../../shared/bundle.ts';
import { formatSek } from '../../shared/format.ts';
import { addToCart } from '../cart.ts';
import { colorSwatch } from '../colorSwatch.ts';
import { byId, h } from '../dom.ts';
import { fetchProducts } from '../products.ts';

const form = byId('bundle-form', HTMLFormElement);
const loading = byId('bundle-loading', HTMLParagraphElement);

function picker(product: Product, name: string, legend: string): HTMLFieldSetElement {
  return h(
    'fieldset',
    { class: 'variant-picker' },
    h('legend', {}, legend),
    h(
      'div',
      { class: 'variant-options' },
      ...product.sizes.map((size) =>
        h(
          'label',
          { class: 'variant-option', 'data-disabled': String(!size.available) },
          h('input', { type: 'radio', name, value: size.size, disabled: !size.available }),
          colorSwatch(size.size),
          h('span', {}, size.size),
        ),
      ),
    ),
  );
}

function render(products: Product[]): void {
  const overall = products.find((p) => p.id === 'studentoverall');
  const spray = products.find((p) => p.id === 'sprayfarg');
  const pens = products.find((p) => p.id === 'spritpenna');
  const penSize = pens?.sizes.find((s) => s.available)?.size;
  if (overall === undefined || spray === undefined || pens === undefined || penSize === undefined) {
    loading.textContent = 'Paketet går inte att beställa just nu – någon vara är slut.';
    return;
  }

  const full = bundlePrice(products);
  const discount = Math.round((full * BUNDLE_DISCOUNT_PERCENT) / 100);
  const status = h('p', { class: 'add-status', 'aria-live': 'polite' });

  form.replaceChildren(
    h(
      'div',
      { class: 'bundle-price' },
      h('span', { class: 'bundle-now' }, formatSek(full - discount)),
      h('s', { class: 'muted' }, formatSek(full)),
      h('span', { class: 'campaign-pill' }, `Du sparar ${formatSek(discount)}`),
    ),
    h(
      'ul',
      { class: 'bundle-contents' },
      h('li', {}, `1 × ${overall.name} (${formatSek(overall.priceSek)})`),
      h('li', {}, `2 × ${spray.name} (${formatSek(spray.priceSek)}/st)`),
      h('li', {}, `1 × ${pens.name} (${formatSek(pens.priceSek)})`),
    ),
    picker(overall, 'size', 'Storlek på overallen'),
    picker(spray, 'color1', 'Sprayfärg 1'),
    picker(spray, 'color2', 'Sprayfärg 2'),
    h('button', { type: 'submit', class: 'button button-large' }, 'Lägg paketet i varukorgen'),
    status,
  );
  loading.hidden = true;
  form.hidden = false;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (name: string): string =>
      form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';
    const size = value('size');
    const color1 = value('color1');
    const color2 = value('color2');
    if (size === '' || color1 === '' || color2 === '') {
      status.className = 'add-status field-error';
      status.textContent = 'Välj storlek och två sprayfärger först.';
      return;
    }
    addToCart(overall.id, size, 1);
    addToCart(spray.id, color1, 1);
    addToCart(spray.id, color2, 1);
    addToCart(pens.id, penSize, 1);
    status.className = 'add-status';
    status.replaceChildren(
      `Studentpaketet ligger i varukorgen (${size}, ${color1} och ${color2}). `,
      h('a', { href: '/kassa/' }, 'Till kassan'),
    );
  });
}

async function init(): Promise<void> {
  try {
    render(await fetchProducts());
  } catch (error) {
    loading.textContent = error instanceof Error ? error.message : 'Kunde inte hämta produkterna.';
    loading.className = 'notice notice-error';
  }
}

void init();
