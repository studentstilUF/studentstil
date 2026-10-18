/** Orderbekräftelsen (/order/?nr=…&t=…): sammanfattning, betalstatus och Swish-knappen. */
import {
  type PublicOrder,
  PublicOrderSchema,
  type SwishStart,
  SwishStartSchema,
} from '../../shared/apiTypes.ts';
import {
  formatDateTime,
  formatPostalCode,
  formatSek,
  formatSwishNumber,
} from '../../shared/format.ts';
import { type OrderStatus, STATUS_LABELS } from '../../shared/orderStatus.ts';
import { apiGet, apiPost } from '../api.ts';
import { byId, h, isMobileDevice, nodes } from '../dom.ts';
import { qrCanvas } from '../qr.ts';

const container = byId('order', HTMLDivElement);
const params = new URLSearchParams(window.location.search);
const orderNumber = params.get('nr') ?? '';
const token = params.get('t') ?? '';
const returnedFromSwish = params.has('swish');

const STATUS_TEXT: Record<OrderStatus, string> = {
  vantar_betalning:
    'Varorna är reserverade åt dig. Betala med Swish för att slutföra beställningen.',
  betald: 'Tack! Vi har tagit emot din betalning och börjar packa din beställning.',
  packad: 'Din beställning är packad och skickas inom kort.',
  skickad: 'Din beställning är skickad. Grattis till studenten!',
  levererad: 'Din beställning är levererad. Grattis till studenten!',
  avbruten: 'Beställningen är avbruten. Kontakta oss om du har frågor.',
};

let pollTimer: number | undefined;
let pollCount = 0;

function orderStatusUrl(): string {
  return `/api/order-status?nr=${encodeURIComponent(orderNumber)}&t=${encodeURIComponent(token)}`;
}

function details(order: PublicOrder): HTMLElement {
  const isClass = order.kind === 'klass';
  const rows: [string, string][] = [
    ['Ordernummer', order.orderNumber],
    ['Beställd', formatDateTime(order.createdAt)],
    ...(isClass
      ? [['Klassbeställning', `${order.school ?? ''}`.trim() || 'Ja'] as [string, string]]
      : []),
    ...order.items.map((item): [string, string] => [
      `${String(item.quantity)} st`,
      isClass
        ? `${item.productName}, ${item.size} – ${formatSek(item.unitPriceSek)}/st = ${formatSek(item.lineTotalSek)}`
        : `${item.productName}, ${item.size} – ${formatSek(item.lineTotalSek)}`,
    ]),
    [
      'Leverans till',
      `${order.name}, ${order.street}, ${formatPostalCode(order.postalCode)} ${order.city}`,
    ],
    ['E-post', order.email],
    ['Att betala', formatSek(order.totalSek)],
  ];
  return h(
    'dl',
    { class: 'details-list' },
    ...rows.flatMap(([label, value]) => [h('dt', {}, label), h('dd', {}, value)]),
  );
}

/**
 * Innehållet i "Betala med Swish"-knappen: texten och Swish officiella logotyp
 * (från swish.nu/marknadsmaterial/logotyp, liggande variant för ljus bakgrund).
 * Enligt Swish riktlinjer får loggan inte redigeras och ska ligga mot vit bakgrund
 * med luft runt sig – därför är knappen vit (se .button-swish i main.css).
 */
function swishLabel(): (HTMLElement | string)[] {
  return [
    h('span', {}, 'Betala med'),
    h('img', {
      class: 'swish-logo',
      src: '/logo/swish.png',
      alt: 'Swish',
      width: 400,
      height: 122,
    }),
  ];
}

/** Läge A: uppgifterna som behövs för att visa QR-kod och manuell info. */
type ManualSwish = { payee: string; amountSek: number; message: string; qrData: string };

function manualDetails(swish: ManualSwish): HTMLElement {
  return h(
    'dl',
    { class: 'swish-details' },
    h('dt', {}, 'Swish-nummer'),
    h('dd', {}, formatSwishNumber(swish.payee)),
    h('dt', {}, 'Belopp'),
    h('dd', {}, formatSek(swish.amountSek)),
    h('dt', {}, 'Meddelande'),
    h('dd', {}, swish.message),
  );
}

function qrInstructions(): HTMLElement {
  return h(
    'p',
    {},
    'Öppna Swish-appen på mobilen, tryck på ',
    h('strong', {}, 'Skanna'),
    ' och rikta kameran mot koden.',
  );
}

function showManualQr(target: HTMLElement, swish: ManualSwish): void {
  target.replaceChildren(
    h(
      'div',
      { class: 'qr-box' },
      qrCanvas(swish.qrData, 240, 'QR-kod för Swish-betalning'),
      qrInstructions(),
      manualDetails(swish),
    ),
    h(
      'p',
      { class: 'muted small' },
      'Uppgifterna är ifyllda i förväg. Vi bekräftar betalningen så snart vi sett den, oftast inom ett dygn, och mejlar dig.',
    ),
  );
}

function showQr(target: HTMLElement, start: SwishStart): void {
  const instructions = qrInstructions();
  if (start.mode === 'manual') {
    showManualQr(target, start);
  } else if (start.qrImage === null) {
    target.replaceChildren(
      h(
        'p',
        { class: 'notice' },
        'QR-koden kunde inte visas. Öppna den här sidan på mobilen och tryck på knappen igen.',
      ),
    );
  } else {
    target.replaceChildren(
      h(
        'div',
        { class: 'qr-box' },
        h('img', {
          src: start.qrImage,
          alt: 'QR-kod för Swish-betalning',
          width: 240,
          height: 240,
        }),
        instructions,
      ),
      h('p', { class: 'muted small' }, 'Sidan uppdateras automatiskt när betalningen är klar.'),
    );
  }
}

async function startPayment(button: HTMLButtonElement, result: HTMLElement): Promise<void> {
  const device = isMobileDevice() ? 'mobile' : 'desktop';
  button.disabled = true;
  try {
    const start = await apiPost(
      '/api/swish/start',
      { orderNumber, token, device },
      SwishStartSchema,
    );
    if (device === 'mobile') {
      // Öppnar Swish-appen. Visar även uppgifterna ifall appen inte öppnas.
      window.location.href = start.appUrl;
      result.replaceChildren(
        ...nodes(
          h(
            'p',
            {},
            'Swish öppnas … Kommer du tillbaka hit utan att ha betalat? Tryck på knappen igen.',
          ),
          start.mode === 'manual' ? manualDetails(start) : null,
          h('button', { type: 'button', class: 'link-button small' }, 'Visa QR-kod i stället'),
        ),
      );
      result.querySelector('button')?.addEventListener('click', () => {
        showQr(result, start);
      });
    } else {
      showQr(result, start);
    }
    schedulePoll(start.mode === 'commerce' ? 3000 : 20_000);
  } catch (error) {
    result.replaceChildren(
      h(
        'p',
        { class: 'notice notice-error', role: 'alert' },
        error instanceof Error ? error.message : 'Kunde inte starta Swish.',
      ),
    );
  } finally {
    button.disabled = false;
  }
}

/**
 * Läge A: knappen är en vanlig länk till Swish-appen, färdig när sidan laddats.
 * Ett tryck på mobilen öppnar Swish direkt med belopp, nummer och ordernummer ifyllt.
 * På dator finns ingen Swish-app, så där visar knappen QR-koden i stället.
 */
function manualPayButton(
  swish: ManualSwish & { appUrl: string },
  result: HTMLElement,
): HTMLElement {
  if (isMobileDevice()) {
    const link = h(
      'a',
      { class: 'button button-large button-swish', id: 'pay', href: swish.appUrl },
      ...swishLabel(),
    );
    link.addEventListener('click', () => {
      schedulePoll(20_000);
      const showQrButton = h(
        'button',
        { type: 'button', class: 'link-button small' },
        'Visa QR-kod i stället',
      );
      showQrButton.addEventListener('click', () => {
        showManualQr(result, swish);
      });
      result.replaceChildren(
        h(
          'p',
          {},
          'Swish öppnas … Kommer du tillbaka hit utan att ha betalat? Tryck på knappen igen.',
        ),
        manualDetails(swish),
        showQrButton,
      );
    });
    return link;
  }
  const button = h(
    'button',
    { type: 'button', class: 'button button-large button-swish', id: 'pay' },
    ...swishLabel(),
  );
  button.addEventListener('click', () => {
    showManualQr(result, swish);
    schedulePoll(20_000);
  });
  return button;
}

function paymentSection(order: PublicOrder): HTMLElement {
  const result = h('div', { 'aria-live': 'polite' });
  let button: HTMLElement;
  if (order.swish === null) {
    // Läge B (Swish Handel): betalförfrågan skapas när kunden trycker.
    const startButton = h(
      'button',
      { type: 'button', class: 'button button-large button-swish', id: 'pay' },
      ...swishLabel(),
    );
    startButton.addEventListener('click', () => {
      void startPayment(startButton, result);
    });
    button = startButton;
  } else {
    button = manualPayButton({ ...order.swish, amountSek: order.totalSek }, result);
  }
  return h(
    'section',
    { class: 'pay-box', 'aria-labelledby': 'pay-heading' },
    h('h2', { id: 'pay-heading' }, `Betala ${formatSek(order.totalSek)}`),
    returnedFromSwish && order.paymentMode === 'manual'
      ? h(
          'p',
          { class: 'notice notice-ok' },
          'Har du redan betalat? Då behöver du inte göra något mer. Vi kontrollerar betalningen och mejlar dig när den är registrerad. Betala inte igen.',
        )
      : h(
          'p',
          { class: 'muted' },
          isMobileDevice()
            ? 'Swish-appen öppnas med allt ifyllt.'
            : 'En QR-kod visas som du skannar med Swish-appen.',
        ),
    button,
    result,
  );
}

/** Rubriken: tack först när betalningen är gjord, inte innan. */
function heading(order: PublicOrder): string {
  if (order.status === 'vantar_betalning') return 'Slutför din beställning';
  if (order.status === 'avbruten') return 'Beställningen är avbruten';
  return 'Tack för din beställning!';
}

function render(order: PublicOrder): void {
  const unpaid = order.status === 'vantar_betalning';
  document.title = `${unpaid ? 'Betala' : 'Order'} ${order.orderNumber} – Studentstil`;
  container.replaceChildren(
    ...nodes(
      h(
        'p',
        { class: 'eyebrow' },
        `${order.kind === 'klass' ? 'Klassbeställning' : 'Order'} ${order.orderNumber}`,
      ),
      h('h1', {}, heading(order)),
      h(
        'p',
        {},
        h(
          'span',
          { class: 'status-badge', 'data-status': order.status },
          STATUS_LABELS[order.status],
        ),
      ),
      h('p', { 'aria-live': 'polite' }, STATUS_TEXT[order.status]),
      order.status === 'vantar_betalning' ? paymentSection(order) : null,
      h(
        'section',
        { class: 'section', 'aria-labelledby': 'summary-heading' },
        h('h2', { id: 'summary-heading' }, 'Sammanfattning'),
        details(order),
      ),
      h(
        'p',
        { class: 'muted small' },
        unpaid
          ? 'Vi har mejlat dig en länk till den här sidan, så att du kan betala senare om du vill.'
          : 'Spara mejlet från oss – länken i det leder hit om du vill se din beställning igen.',
      ),
    ),
  );
}

function schedulePoll(delayMs: number): void {
  window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(() => {
    void poll(delayMs);
  }, delayMs);
}

/** Kontrollerar med jämna mellanrum om ordern blivit betald (slutar efter ett tag). */
async function poll(delayMs: number): Promise<void> {
  pollCount++;
  if (pollCount > 100 || document.hidden) {
    if (document.hidden) schedulePoll(delayMs);
    return;
  }
  try {
    const order = await apiGet(orderStatusUrl(), PublicOrderSchema);
    if (order.status !== 'vantar_betalning') {
      render(order);
      return;
    }
  } catch {
    // Tillfälligt fel: försök igen vid nästa intervall.
  }
  schedulePoll(delayMs);
}

async function init(): Promise<void> {
  try {
    const order = await apiGet(orderStatusUrl(), PublicOrderSchema);
    render(order);
    if (order.status === 'vantar_betalning' && returnedFromSwish)
      schedulePoll(order.paymentMode === 'commerce' ? 3000 : 20_000);
  } catch (error) {
    container.replaceChildren(
      h('h1', {}, 'Beställningen hittades inte'),
      h(
        'p',
        { class: 'notice notice-error', role: 'alert' },
        error instanceof Error ? error.message : 'Något gick fel.',
      ),
      h('p', {}, h('a', { href: '/bestall/' }, 'Till produkterna')),
    );
  }
}

void init();
