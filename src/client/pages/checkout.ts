/** Kassan (/kassa/): varukorgen och beställningsformuläret. */
import { CreateOrderResponseSchema, type Product } from '../../shared/apiTypes.ts';
import {
  type Delivery,
  isKungsbackaPostalCode,
  KUNGSBACKA_SCHOOLS,
  SHIPPING_FEE_SEK,
  shippingFee,
} from '../../shared/delivery.ts';
import { formatSek } from '../../shared/format.ts';
import { type CartLine, MAX_QUANTITY, validateOrderInput } from '../../shared/orderInput.ts';
import { ApiError, apiPost } from '../api.ts';
import { clearCart, getCart, onCartChange, removeFromCart, setQuantity } from '../cart.ts';
import { colorSwatch } from '../colorSwatch.ts';
import { byId, h } from '../dom.ts';
import { fetchProducts, hasVariantChoice } from '../products.ts';
import { currentSource } from '../source.ts';

const FIELDS = [
  'items',
  'name',
  'email',
  'schoolClass',
  'street',
  'postalCode',
  'city',
  'delivery',
  'school',
  'phone',
  'comment',
  'acceptTerms',
] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  items: 'Varukorg',
  name: 'Namn',
  email: 'E-post',
  schoolClass: 'Klass',
  street: 'Gatuadress',
  postalCode: 'Postnummer',
  city: 'Ort',
  delivery: 'Leverans',
  school: 'Skola',
  phone: 'Mobilnummer',
  comment: 'Kommentar',
  acceptTerms: 'Godkännande',
};

const form = byId('order-form', HTMLFormElement);
const cartList = byId('cart-lines', HTMLUListElement);
const cartEmpty = byId('cart-empty', HTMLDivElement);
const summary = byId('summary', HTMLDivElement);
const errorBox = byId('form-errors', HTMLDivElement);
const submitButton = byId('submit', HTMLButtonElement);
const loading = byId('checkout-loading', HTMLParagraphElement);
const postalInput = byId('postalCode', HTMLInputElement);
const schoolPicker = byId('school-picker', HTMLDivElement);
const schoolSelect = byId('school', HTMLSelectElement);
const schoolHint = byId('delivery-school-hint', HTMLSpanElement);
const shippingPrice = byId('shipping-price', HTMLSpanElement);

let products: Product[] = [];
let submitting = false;
const touched = new Set<Field>();

function isField(name: string): name is Field {
  return (FIELDS as readonly string[]).includes(name);
}

function productFor(line: CartLine): Product | undefined {
  return products.find((p) => p.id === line.productId);
}

/** Finns raden fortfarande att köpa (produkten aktiv och varianten i lager)? */
function isAvailable(line: CartLine): boolean {
  return productFor(line)?.sizes.some((s) => s.size === line.size && s.available) ?? false;
}

function cartTotal(): number {
  return getCart().reduce(
    (sum, line) => sum + (productFor(line)?.priceSek ?? 0) * line.quantity,
    0,
  );
}

function stepper(line: CartLine, name: string): HTMLElement {
  const minus = h('button', { type: 'button', 'aria-label': `Minska antal ${name}` }, '−');
  const plus = h(
    'button',
    { type: 'button', 'aria-label': `Öka antal ${name}`, disabled: line.quantity >= MAX_QUANTITY },
    '+',
  );
  minus.addEventListener('click', () => {
    setQuantity(line.productId, line.size, line.quantity - 1);
  });
  plus.addEventListener('click', () => {
    setQuantity(line.productId, line.size, line.quantity + 1);
  });
  return h(
    'div',
    { class: 'stepper' },
    minus,
    h('output', { 'aria-label': `Antal ${name}` }, String(line.quantity)),
    plus,
  );
}

function cartLine(line: CartLine): HTMLLIElement {
  const product = productFor(line);
  const available = isAvailable(line);
  const name = `${product?.name ?? 'Okänd produkt'}, ${line.size}`;
  const remove = h('button', { type: 'button', class: 'link-button small' }, 'Ta bort');
  remove.addEventListener('click', () => {
    removeFromCart(line.productId, line.size);
  });
  return h(
    'li',
    { class: 'cart-line', 'data-unavailable': String(!available) },
    h('img', { src: product?.image ?? '/bilder/placeholder.svg', alt: '', width: 64, height: 64 }),
    h(
      'div',
      {},
      h('strong', {}, product?.name ?? 'Okänd produkt'),
      h('br'),
      ...(product !== undefined && !hasVariantChoice(product)
        ? []
        : [
            h(
              'span',
              { class: 'muted small' },
              colorSwatch(line.size),
              `${product?.variantLabel ?? 'Variant'}: ${line.size}`,
            ),
            h('br'),
          ]),
      available
        ? h('span', { class: 'small' }, formatSek((product?.priceSek ?? 0) * line.quantity))
        : h('span', { class: 'small field-error' }, 'Slut i lager – ta bort raden'),
    ),
    h('div', { class: 'cart-line-actions' }, stepper(line, name), remove),
  );
}

function renderCart(): void {
  const lines = getCart();
  const empty = lines.length === 0 && !submitting;
  cartEmpty.hidden = !empty;
  form.hidden = empty;
  cartList.replaceChildren(...lines.map(cartLine));
  const delivery = selectedDelivery();
  const shipping = delivery === null ? 0 : shippingFee(delivery);
  summary.replaceChildren(
    h('p', { class: 'order-line' }, h('span', {}, 'Varor'), h('span', {}, formatSek(cartTotal()))),
    h(
      'p',
      { class: 'order-line' },
      h('span', {}, 'Frakt'),
      h(
        'span',
        {},
        delivery === null ? 'Välj leverans' : shipping === 0 ? 'Gratis' : formatSek(shipping),
      ),
    ),
    h(
      'p',
      { class: 'order-total' },
      h('span', {}, 'Att betala'),
      h('span', {}, formatSek(cartTotal() + shipping)),
    ),
    h('p', { class: 'muted small' }, 'Priset är inklusive moms.'),
  );
  if (touched.has('items')) validateLive();
}

function formValues(): Record<string, unknown> {
  const data = new FormData(form);
  const text = (name: string): string => {
    const value = data.get(name);
    return typeof value === 'string' ? value : '';
  };
  return {
    items: getCart(),
    name: text('name'),
    email: text('email'),
    schoolClass: text('schoolClass'),
    street: text('street'),
    postalCode: text('postalCode'),
    city: text('city'),
    delivery: text('delivery'),
    school: text('school'),
    phone: text('phone'),
    comment: text('comment'),
    acceptTerms: data.get('acceptTerms') === 'on',
    source: currentSource(),
    website: text('website'),
  };
}

/** Kontroller som bara kan göras här: att allt i varukorgen fortfarande finns. */
function cartErrors(): Partial<Record<string, string>> {
  const unavailable = getCart().filter((line) => !isAvailable(line));
  return unavailable.length === 0
    ? {}
    : { items: 'Något i varukorgen är slut i lager. Ta bort det för att kunna beställa.' };
}

function showFieldError(field: Field, message: string | undefined): void {
  const errorEl = document.getElementById(`${field}-error`);
  if (errorEl === null) return;
  errorEl.textContent = message ?? '';
  errorEl.hidden = message === undefined;
  const input = field === 'items' ? null : document.getElementById(field);
  if (input === null) return;
  if (message === undefined) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
}

function showErrors(errors: Partial<Record<string, string>>, onlyTouched: boolean): void {
  for (const field of FIELDS) {
    if (!onlyTouched || touched.has(field)) showFieldError(field, errors[field]);
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

function hideErrorSummary(): void {
  errorBox.hidden = true;
  errorBox.replaceChildren();
}

function allErrors(): Partial<Record<string, string>> {
  const result = validateOrderInput(formValues());
  return { ...(result.ok ? {} : result.errors), ...cartErrors() };
}

function validateLive(): void {
  showErrors(allErrors(), true);
}

async function submit(): Promise<void> {
  for (const field of FIELDS) touched.add(field);
  const errors = allErrors();
  if (Object.keys(errors).length > 0) {
    showErrors(errors, false);
    showErrorSummary(errors, 'Kontrollera de markerade fälten.');
    return;
  }

  showErrors({}, false);
  hideErrorSummary();
  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Skickar beställningen …';
  try {
    const created = await apiPost('/api/orders', formValues(), CreateOrderResponseSchema);
    clearCart();
    window.location.assign(
      `/order/?nr=${encodeURIComponent(created.orderNumber)}&t=${encodeURIComponent(created.token)}`,
    );
  } catch (error) {
    submitting = false;
    const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
    showErrors(fieldErrors, false);
    showErrorSummary(
      fieldErrors,
      error instanceof Error ? error.message : 'Något gick fel. Försök igen.',
    );
    if (error instanceof ApiError && error.status === 409) {
      // Något tog slut under tiden: hämta nytt lager så att raden markeras.
      products = await fetchProducts().catch(() => products);
      renderCart();
    }
    submitButton.disabled = false;
    submitButton.textContent = 'Skicka beställning';
  }
}

function deliveryInput(value: Delivery): HTMLInputElement {
  const input = form.querySelector<HTMLInputElement>(`input[name="delivery"][value="${value}"]`);
  if (input === null) throw new Error(`Saknar leveransval ${value}`);
  return input;
}

function selectedDelivery(): Delivery | null {
  const value = form.querySelector<HTMLInputElement>('input[name="delivery"]:checked')?.value;
  return value === 'skola' || value === 'hem' ? value : null;
}

/** Fyller rullistan med gymnasieskolorna i Kungsbacka. */
function renderSchools(): void {
  schoolSelect.append(...KUNGSBACKA_SCHOOLS.map((school) => h('option', { value: school }, school)));
}

/**
 * Skolhämtning går bara att välja med en adress i Kungsbacka. Rullistan med
 * skolor visas först när kunden klickar i skolhämtning.
 */
function updateDelivery(): void {
  const skola = deliveryInput('skola');
  const hem = deliveryInput('hem');
  const inKungsbacka = isKungsbackaPostalCode(postalInput.value);
  skola.disabled = !inKungsbacka;
  if (!inKungsbacka && skola.checked) hem.checked = true;
  schoolHint.textContent = inKungsbacka
    ? 'Hämta gratis på din gymnasieskola.'
    : 'Fyll i ett postnummer i Kungsbacka för att välja skola.';
  schoolPicker.hidden = !skola.checked;
  renderCart();
}

function onFieldEvent(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const name = target.getAttribute('name') ?? '';
  if (!isField(name)) return;
  if (event.type === 'focusout' || event.type === 'change') touched.add(name);
  validateLive();
}

async function init(): Promise<void> {
  try {
    products = await fetchProducts();
  } catch (error) {
    loading.textContent = error instanceof Error ? error.message : 'Kunde inte hämta produkterna.';
    loading.className = 'notice notice-error';
    return;
  }
  loading.hidden = true;
  renderCart();
  onCartChange(renderCart);

  renderSchools();
  shippingPrice.textContent = formatSek(SHIPPING_FEE_SEK);
  updateDelivery();
  postalInput.addEventListener('input', updateDelivery);
  form.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === 'delivery') {
      updateDelivery();
      if (event.target.value === 'skola') schoolSelect.focus();
    }
  });
  form.addEventListener('focusout', onFieldEvent);
  form.addEventListener('change', onFieldEvent);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });
}

void init();
