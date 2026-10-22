/**
 * Klassbeställning (/klassbestallning/): klassrepresentanten fyller i antal per
 * storlek/färg för hela klassen. Från 25 overaller gäller klasspris.
 */
import { CreateOrderResponseSchema, type Product } from '../../shared/apiTypes.ts';
import {
  CLASS_DISCOUNT_MIN_OVERALLS,
  type ClassLine,
  OVERALL_PRODUCT_ID,
  priceClassOrder,
} from '../../shared/classOrder.ts';
import { CLASS_SHIPPING_PER_OVERALL_SEK, shippingFee } from '../../shared/delivery.ts';
import { formatSek } from '../../shared/format.ts';
import { MAX_CLASS_QUANTITY, validateOrderInput } from '../../shared/orderInput.ts';
import { ApiError, apiPost } from '../api.ts';
import { colorSwatch } from '../colorSwatch.ts';
import { type DeliveryChoice, deliveryChoice } from '../deliveryChoice.ts';
import { byId, h, nodes } from '../dom.ts';
import { fetchProducts, hasVariantChoice } from '../products.ts';
import { currentSource } from '../source.ts';

const FIELDS = [
  'items',
  'name',
  'email',
  'phone',
  'schoolClass',
  'street',
  'postalCode',
  'city',
  'delivery',
  'school',
  'comment',
  'acceptTerms',
] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  items: 'Antal',
  name: 'Namn',
  email: 'E-post',
  phone: 'Mobilnummer',
  school: 'Skola',
  schoolClass: 'Klass',
  street: 'Gatuadress',
  postalCode: 'Postnummer',
  city: 'Ort',
  delivery: 'Leverans',
  comment: 'Kommentar',
  acceptTerms: 'Godkännande',
};

const form = byId('class-form', HTMLFormElement);
const productsRoot = byId('class-products', HTMLDivElement);
const progress = byId('class-progress', HTMLDivElement);
const totals = byId('class-totals', HTMLDivElement);
const errorBox = byId('form-errors', HTMLDivElement);
const submitButton = byId('submit', HTMLButtonElement);
const loading = byId('class-loading', HTMLParagraphElement);
const postalInput = byId('postalCode', HTMLInputElement);
const deliveryContainer = byId('delivery-choice', HTMLDivElement);
let delivery: DeliveryChoice | null = null;

let products: Product[] = [];
/** Ett sifferfält per produkt och storlek/färg. */
const quantityInputs: { productId: string; size: string; input: HTMLInputElement }[] = [];
let submitted = false;

function parseQuantity(input: HTMLInputElement): number {
  const value = Number.parseInt(input.value, 10);
  return Number.isNaN(value) ? 0 : Math.max(0, Math.min(MAX_CLASS_QUANTITY, value));
}

function currentLines(): ClassLine[] {
  return quantityInputs
    .map(({ productId, size, input }) => ({ productId, size, quantity: parseQuantity(input) }))
    .filter((line) => line.quantity > 0);
}

/** En rad: storlek/färg, minus-knapp, sifferfält och plus-knapp. */
function quantityRow(product: Product, size: string): HTMLElement {
  const id = `q-${product.id}-${size}`.replace(/[^\w-]/gu, '_');
  const input = h('input', {
    id,
    type: 'number',
    inputmode: 'numeric',
    min: 0,
    max: MAX_CLASS_QUANTITY,
    step: 1,
    value: 0,
    class: 'qty-input',
  });
  const minus = h(
    'button',
    { type: 'button', 'aria-label': `Minska ${product.name} ${size}` },
    '−',
  );
  const plus = h('button', { type: 'button', 'aria-label': `Öka ${product.name} ${size}` }, '+');
  const change = (delta: number): void => {
    input.value = String(Math.max(0, Math.min(MAX_CLASS_QUANTITY, parseQuantity(input) + delta)));
    update();
  };
  minus.addEventListener('click', () => {
    change(-1);
  });
  plus.addEventListener('click', () => {
    change(1);
  });
  input.addEventListener('input', update);
  input.addEventListener('focus', () => {
    input.select();
  });
  quantityInputs.push({ productId: product.id, size, input });
  return h(
    'div',
    { class: 'qty-row' },
    h(
      'label',
      { for: id },
      hasVariantChoice(product) ? colorSwatch(size) : null,
      hasVariantChoice(product) ? size : 'Antal paket',
    ),
    h('div', { class: 'stepper' }, minus, input, plus),
  );
}

function productSection(product: Product): HTMLElement {
  const sizes = product.sizes.filter((s) => s.available);
  const priceText =
    product.bulkPriceSek === null
      ? `${formatSek(product.priceSek)}/st`
      : `${formatSek(product.priceSek)}/st · klasspris ${formatSek(product.bulkPriceSek)}`;
  return h(
    'section',
    { class: 'class-product' },
    h(
      'div',
      { class: 'class-product-head' },
      h('img', { src: product.image, alt: '', width: 64, height: 64 }),
      h(
        'div',
        {},
        h('h3', {}, product.name),
        h('p', { class: 'muted small' }, priceText),
        product.id === OVERALL_PRODUCT_ID
          ? h(
              'a',
              {
                class: 'small',
                href: '/vanliga-fragor/#storleksguide',
                target: '_blank',
                rel: 'noopener',
              },
              'Storleksguide',
            )
          : null,
      ),
    ),
    sizes.length === 0
      ? h('p', { class: 'muted small' }, 'Slut i lager just nu.')
      : h('div', { class: 'qty-grid' }, ...sizes.map((s) => quantityRow(product, s.size))),
  );
}

function renderSummary(): void {
  const price = priceClassOrder(products, currentLines());
  const percent = Math.min(100, Math.round((price.overalls / CLASS_DISCOUNT_MIN_OVERALLS) * 100));
  const bar = h('span', { class: 'progress-bar' });
  bar.style.setProperty('--share', `${String(percent)}%`);

  progress.replaceChildren(
    h(
      'p',
      { class: price.discount ? 'notice notice-ok' : 'notice' },
      price.discount
        ? `Klasspris! ${String(price.overalls)} overaller – ni sparar ${formatSek(price.savingsSek)}.`
        : `${String(price.overalls)} av ${String(CLASS_DISCOUNT_MIN_OVERALLS)} overaller. Lägg till ${String(price.overallsMissing)} till för klasspris.`,
    ),
    h('div', { class: 'progress', role: 'presentation' }, bar),
  );

  const chosen = delivery?.selected() ?? null;
  const shipping =
    chosen === null || price.lines.length === 0 ? 0 : shippingFee(chosen, 'klass', price.overalls);
  const shippingText =
    chosen === null ? 'Välj leverans' : shipping === 0 ? 'Gratis' : formatSek(shipping);
  totals.replaceChildren(
    ...nodes(
      price.lines.length === 0
        ? h('p', { class: 'muted small' }, 'Inga varor valda än.')
        : h(
            'ul',
            { class: 'class-lines' },
            ...price.lines.map((line) =>
              h(
                'li',
                {},
                h('span', {}, `${String(line.quantity)} × ${line.productName}, ${line.size}`),
                h('span', {}, formatSek(line.lineTotalSek)),
              ),
            ),
          ),
      price.discount && price.savingsSek > 0
        ? h(
            'p',
            { class: 'class-saving' },
            h('span', {}, 'Ordinarie pris'),
            h('s', {}, formatSek(price.fullPriceSek)),
          )
        : null,
      h('p', { class: 'order-line' }, h('span', {}, 'Frakt'), h('span', {}, shippingText)),
      h(
        'p',
        { class: 'order-total' },
        h('span', {}, 'Att betala'),
        h('span', {}, formatSek(price.totalSek + shipping)),
      ),
      h(
        'p',
        { class: 'muted small' },
        'Moms tillkommer inte – Studentstil UF är inte momsregistrerat.',
      ),
      h(
        'p',
        { class: 'campaign-hint' },
        h('strong', {}, 'Kampanj: '),
        'är ni en av de 5 första klasserna som beställer får ni ett flak Celsius på köpet.',
      ),
    ),
  );
}

function update(): void {
  renderSummary();
  if (submitted) showErrors(allErrors());
}

function formValues(): Record<string, unknown> {
  const data = new FormData(form);
  const text = (name: string): string => {
    const value = data.get(name);
    return typeof value === 'string' ? value : '';
  };
  return {
    kind: 'klass',
    items: currentLines(),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    school: delivery?.school() ?? '',
    delivery: delivery?.selected() ?? '',
    schoolClass: text('schoolClass'),
    street: text('street'),
    postalCode: text('postalCode'),
    city: text('city'),
    comment: text('comment'),
    acceptTerms: data.get('acceptTerms') === 'on',
    source: currentSource(),
    website: text('website'),
  };
}

function allErrors(): Partial<Record<string, string>> {
  const result = validateOrderInput(formValues());
  const errors = result.ok ? {} : { ...result.errors };
  if (currentLines().length === 0) errors['items'] = 'Fyll i antal för minst en vara.';
  return errors;
}

function showErrors(errors: Partial<Record<string, string>>): void {
  for (const field of FIELDS) {
    const message = errors[field];
    const errorEl = document.getElementById(`${field}-error`);
    if (errorEl !== null) {
      errorEl.textContent = message ?? '';
      errorEl.hidden = message === undefined;
    }
    const input = field === 'items' ? null : document.getElementById(field);
    if (input !== null) {
      if (message === undefined) input.removeAttribute('aria-invalid');
      else input.setAttribute('aria-invalid', 'true');
    }
  }
}

function showErrorSummary(errors: Partial<Record<string, string>>, message: string): void {
  const items = FIELDS.flatMap((field) => {
    const error = errors[field];
    return error === undefined
      ? []
      : [h('li', {}, h('a', { href: `#${field}` }, `${FIELD_LABELS[field]}: ${error}`))];
  });
  errorBox.replaceChildren(
    h('strong', {}, message),
    ...(items.length > 0 ? [h('ul', {}, ...items)] : []),
  );
  errorBox.hidden = false;
  errorBox.focus();
}

async function submit(): Promise<void> {
  submitted = true;
  const errors = allErrors();
  showErrors(errors);
  if (Object.keys(errors).length > 0) {
    showErrorSummary(errors, 'Kontrollera de markerade fälten.');
    return;
  }
  errorBox.hidden = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Skickar klassbeställningen …';
  try {
    const created = await apiPost('/api/orders', formValues(), CreateOrderResponseSchema);
    window.location.assign(
      `/order/?nr=${encodeURIComponent(created.orderNumber)}&t=${encodeURIComponent(created.token)}`,
    );
  } catch (error) {
    const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
    showErrors(fieldErrors);
    showErrorSummary(
      fieldErrors,
      error instanceof Error ? error.message : 'Något gick fel. Försök igen.',
    );
    submitButton.disabled = false;
    submitButton.textContent = 'Skicka klassbeställning';
  }
}

async function init(): Promise<void> {
  try {
    products = await fetchProducts();
  } catch (error) {
    loading.textContent = error instanceof Error ? error.message : 'Kunde inte hämta produkterna.';
    loading.className = 'notice notice-error';
    return;
  }
  productsRoot.replaceChildren(...products.map(productSection));
  delivery = deliveryChoice({
    container: deliveryContainer,
    postalInput,
    homeText: 'Vi skickar beställningen till adressen ovan.',
    homePrice: `${String(CLASS_SHIPPING_PER_OVERALL_SEK)} kr/overall`,
    askSchoolForHome: true,
    onChange: update,
  });
  renderSummary();
  loading.hidden = true;
  form.hidden = false;

  form.addEventListener('change', () => {
    if (submitted) showErrors(allErrors());
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });
}

void init();
