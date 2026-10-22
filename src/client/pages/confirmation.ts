/** Orderbekräftelsen (/order/?nr=…&t=…): sammanfattning, betalstatus och Swish-knappen. */
import {
  type PublicOrder,
  PublicOrderSchema,
  type SwishStart,
  SwishStartSchema,
} from '../../shared/apiTypes.ts';
import { campaignLabel } from '../../shared/campaign.ts';
import { deliveryLabel, shippingLabel, statusLabel, trackingUrl } from '../../shared/delivery.ts';
import {
  formatDateTime,
  formatPostalCode,
  formatSek,
  formatSwishNumber,
} from '../../shared/format.ts';
import type { OrderStatus } from '../../shared/orderStatus.ts';
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
    'Din order behandlas först när vi har bekräftat att betalningen har kommit in till oss. Vi stämmer av inkomna Swish-betalningar manuellt, oftast inom ett dygn, och den här sidan uppdateras automatiskt när betalningen är registrerad. Du får även en bekräftelse via e-post.',
  betald: 'Tack! Vi har tagit emot din betalning och börjar packa din beställning.',
  packad: 'Din beställning är packad och skickas inom kort.',
  skickad: 'Din beställning är skickad med PostNord. Grattis till studenten!',
  levererad: 'Din beställning är levererad. Grattis till studenten!',
  avbruten: 'Beställningen är avbruten. Kontakta oss om du har frågor.',
};

/** Statustexten, anpassad efter skolhämtning eller hemleverans. */
function statusText(order: PublicOrder): string {
  if (order.delivery === 'skola' && order.status === 'skickad') {
    return `Din beställning är klar att hämta på ${order.school ?? 'skolan'}. Ta med ordernumret.`;
  }
  if (order.delivery === 'skola' && order.status === 'levererad') {
    return 'Du har hämtat din beställning. Grattis till studenten!';
  }
  return STATUS_TEXT[order.status];
}

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
      'Adress',
      `${order.name}, ${order.street}, ${formatPostalCode(order.postalCode)} ${order.city}`,
    ],
    ['E-post', order.email],
    ['Leverans', deliveryLabel(order)],
    ['Frakt', shippingLabel(order.shippingSek)],
    ...(order.bundleDiscountSek > 0
      ? [['Paketrabatt 5 %', `−${formatSek(order.bundleDiscountSek)}`] as [string, string]]
      : []),
    ...(order.discountSek > 0
      ? [['Återbetalning', formatSek(order.discountSek)] as [string, string]]
      : []),
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
    schedulePoll('vantar_betalning', start.mode === 'commerce' ? 3000 : 20_000);
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
      schedulePoll('vantar_betalning', 20_000);
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
    schedulePoll('vantar_betalning', 20_000);
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

/**
 * Stegen i "Följ din order". Skolhämtning slutar med "Hämtad" (ni lämnar ut
 * paketet själva). Hemleverans slutar med "Skickad" – därefter visar
 * PostNords spårning var paketet är.
 */
function trackSteps(order: PublicOrder): { status: OrderStatus; label: string }[] {
  const steps: { status: OrderStatus; label: string }[] = [
    { status: 'vantar_betalning', label: 'Beställning mottagen' },
    { status: 'betald', label: 'Betalning bekräftad' },
    { status: 'packad', label: 'Packad' },
    { status: 'skickad', label: statusLabel('skickad', order.delivery) },
  ];
  if (order.delivery === 'skola') steps.push({ status: 'levererad', label: 'Hämtad' });
  return steps;
}

/** "Följ din order": vilka steg som är klara och vilket som är aktuellt. */
function tracker(order: PublicOrder): HTMLElement | null {
  if (order.status === 'avbruten') return null;
  const steps = trackSteps(order);
  const found = steps.findIndex((step) => step.status === order.status);
  // "Levererad" vid hemleverans finns inte som steg: då är alla steg klara.
  const current = found === -1 ? steps.length : found;
  return h(
    'section',
    { class: 'section', 'aria-labelledby': 'track-heading' },
    h('h2', { id: 'track-heading' }, 'Följ din order'),
    h(
      'ol',
      { class: 'order-track' },
      ...steps.map((step, i) =>
        h(
          'li',
          {
            'data-state': i < current ? 'done' : i === current ? 'current' : 'todo',
            'aria-current': i === current ? 'step' : false,
          },
          step.label,
        ),
      ),
    ),
    order.trackingNumber === null
      ? null
      : h(
          'p',
          {},
          h(
            'a',
            {
              class: 'button button-secondary',
              href: trackingUrl(order.trackingNumber),
              target: '_blank',
              rel: 'noopener',
            },
            'Spåra paketet hos PostNord',
          ),
        ),
    h(
      'p',
      { class: 'muted small' },
      'Sidan uppdateras automatiskt när statusen ändras. Du kan också öppna den igen via länken i ditt bekräftelsemejl.',
    ),
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
          statusLabel(order.status, order.delivery),
        ),
      ),
      h('p', { 'aria-live': 'polite' }, statusText(order)),
      order.campaign === null
        ? null
        : h('p', { class: 'notice notice-ok campaign-notice' }, campaignLabel(order.campaign)),
      order.status === 'vantar_betalning' ? paymentSection(order) : null,
      tracker(order),
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

function schedulePoll(currentStatus: OrderStatus, delayMs: number): void {
  window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(() => {
    void poll(currentStatus, delayMs);
  }, delayMs);
}

/** Ordern är klar och ändras inte mer – då behöver sidan inte fråga igen. */
function isFinal(status: OrderStatus): boolean {
  return status === 'levererad' || status === 'avbruten';
}

/** Hur ofta sidan frågar om ny status. Swish Handel bekräftar på sekunder. */
function pollDelay(order: PublicOrder): number {
  return order.status === 'vantar_betalning' && order.paymentMode === 'commerce' ? 3000 : 20_000;
}

/**
 * "Live"-uppdatering: frågar med jämna mellanrum efter orderns status och ritar
 * om sidan när den ändrats (t.ex. när vi registrerat betalningen). Slutar efter
 * ungefär en timme, eller när ordern är levererad/avbruten.
 */
async function poll(currentStatus: OrderStatus, delayMs: number): Promise<void> {
  pollCount++;
  if (pollCount > 180) return;
  if (document.hidden) {
    schedulePoll(currentStatus, delayMs);
    return;
  }
  try {
    const order = await apiGet(orderStatusUrl(), PublicOrderSchema);
    if (order.status !== currentStatus) {
      render(order);
      if (!isFinal(order.status)) schedulePoll(order.status, pollDelay(order));
      return;
    }
  } catch {
    // Tillfälligt fel: försök igen vid nästa intervall.
  }
  schedulePoll(currentStatus, delayMs);
}

async function init(): Promise<void> {
  try {
    const order = await apiGet(orderStatusUrl(), PublicOrderSchema);
    render(order);
    if (!isFinal(order.status)) schedulePoll(order.status, pollDelay(order));
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
