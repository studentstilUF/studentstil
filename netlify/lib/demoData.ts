/**
 * Påhittade ordrar för demokontot (t.ex. för att visa systemet på UF-mässor).
 * Datan skapas i koden och har ingen koppling till databasen, så inga riktiga
 * kunduppgifter kan synas när man är inloggad som demo.
 */
import type { Order, OrderItem } from '../../src/shared/apiTypes.ts';
import { KUNGSBACKA_SCHOOLS, SHIPPING_FEE_SEK } from '../../src/shared/delivery.ts';
import type { OrderStatus } from '../../src/shared/orderStatus.ts';

const FIRST_NAMES = [
  'Alva',
  'Elsa',
  'Maja',
  'Wilma',
  'Ebba',
  'Liam',
  'Noah',
  'Hugo',
  'Elias',
  'Oscar',
  'Saga',
  'Lucas',
  'Vera',
  'Alvin',
  'Nora',
];
const LAST_NAMES = ['Exempelsson', 'Testberg', 'Demoström', 'Påhittad', 'Provlund', 'Låtsasdal'];
const CLASSES = ['TE3A', 'TE3B', 'NA3A', 'EK3A', 'SA3B', 'ES3A'];
const CITIES = ['Exempelstad', 'Teststad', 'Demoby'];
const SOURCES = ['webb', 'webb', 'webb', 'qr', 'qr-skolan', 'qr-massa'];
const PRODUCTS = [
  {
    id: 'studentoverall',
    name: 'Studentoverall',
    price: 299,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    id: 'sprayfarg',
    name: 'Sprayfärg',
    price: 79,
    sizes: ['Gul', 'Grön', 'Orange', 'Rosa', 'Blå', 'Röd', 'Svart', 'Guld'],
  },
  {
    id: 'spritpenna',
    name: 'Spritpennor 8-pack',
    price: 139,
    sizes: ['8 färger'],
  },
] as const;
const STATUSES: readonly OrderStatus[] = [
  'vantar_betalning',
  'betald',
  'betald',
  'packad',
  'skickad',
  'levererad',
  'levererad',
  'avbruten',
];

/** Enkel slumpgenerator med frö, så att demodatan blir likadan varje gång. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Tom lista');
  return item;
}

/** En typisk varukorg: oftast en overall, ofta med sprayfärg och pennor. */
function demoItems(random: () => number): OrderItem[] {
  const items: OrderItem[] = [];
  for (const product of PRODUCTS) {
    const chance = product.id === 'studentoverall' ? 0.8 : 0.55;
    if (random() >= chance && !(items.length === 0 && product === PRODUCTS.at(-1))) continue;
    const quantity = product.id === 'studentoverall' ? 1 : 1 + Math.floor(random() * 3);
    items.push({
      productId: product.id,
      productName: product.name,
      size: pick(product.sizes, random),
      quantity,
      unitPriceSek: product.price,
      lineTotalSek: product.price * quantity,
    });
  }
  return items;
}

export function demoOrders(count = 48): Order[] {
  const random = seededRandom(2026);
  const start = Date.UTC(2026, 3, 1); // 1 april
  const orders: Order[] = [];
  for (let i = 1; i <= count; i++) {
    const first = pick(FIRST_NAMES, random);
    const last = pick(LAST_NAMES, random);
    const items = demoItems(random);
    const status = pick(STATUSES, random);
    const createdAt = new Date(
      start + i * 26 * 60 * 60 * 1000 + Math.floor(random() * 3_600_000),
    ).toISOString();
    const paid = status !== 'vantar_betalning' && status !== 'avbruten';
    // Ungefär hälften hämtar på en skola i Kungsbacka (gratis), resten får det hemskickat.
    const atSchool = random() < 0.5;
    const shippingSek = atSchool ? 0 : SHIPPING_FEE_SEK;
    // Kampanj: de 5 första beställningarna med en overall fick en overall gratis.
    const overall = items.find((item) => item.productId === 'studentoverall');
    const discountSek = i <= 5 && overall !== undefined ? overall.unitPriceSek : 0;
    orders.push({
      orderNumber: `SS-2026-${String(i).padStart(4, '0')}`,
      createdAt,
      status,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last
        .toLowerCase()
        .replace(/[åä]/gu, 'a')
        .replace(/ö/gu, 'o')}@example.com`,
      schoolClass: pick(CLASSES, random),
      street: `Exempelgatan ${String(1 + Math.floor(random() * 80))}`,
      postalCode: atSchool ? '43430' : `1${String(Math.floor(random() * 9000) + 1000)}`,
      city: atSchool ? 'Kungsbacka' : pick(CITIES, random),
      phone: random() < 0.5 ? null : `070000${String(Math.floor(random() * 9000) + 1000)}`,
      comment: random() < 0.15 ? 'Demo: detta är en påhittad kommentar.' : null,
      kind: 'privat',
      school: atSchool ? pick(KUNGSBACKA_SCHOOLS, random) : null,
      delivery: atSchool ? 'skola' : 'hem',
      shippingSek,
      discountSek,
      campaign: discountSek > 0 ? 'gratis-overall' : null,
      items,
      totalSek: items.reduce((sum, item) => sum + item.lineTotalSek, 0) + shippingSek,
      source: pick(SOURCES, random),
      paidAt: paid ? createdAt : null,
      shippedAt: status === 'skickad' || status === 'levererad' ? createdAt : null,
    });
  }
  orders.push(
    demoClassOrder(count + 1, '2026-05-02T09:15:00Z', 'NA3B', 'betald', [4, 7, 9, 6, 3], 6, 4),
    demoClassOrder(
      count + 2,
      '2026-05-24T13:40:00Z',
      'EK3A',
      'vantar_betalning',
      [2, 5, 6, 4, 1],
      3,
      2,
    ),
  );
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Påhittad klassbeställning. Med minst 25 overaller gäller klasspriset. */
function demoClassOrder(
  number: number,
  createdAt: string,
  schoolClass: string,
  status: OrderStatus,
  overallsPerSize: readonly number[],
  sprays: number,
  penSets: number,
): Order {
  const overallCount = overallsPerSize.reduce((sum, n) => sum + n, 0);
  const bulk = overallCount >= 25;
  const line = (
    productId: string,
    productName: string,
    size: string,
    quantity: number,
    price: number,
  ): OrderItem => ({
    productId,
    productName,
    size,
    quantity,
    unitPriceSek: price,
    lineTotalSek: price * quantity,
  });
  const items: OrderItem[] = [
    ...['XS', 'S', 'M', 'L', 'XL'].flatMap((size, i) => {
      const quantity = overallsPerSize[i] ?? 0;
      return quantity > 0
        ? [line('studentoverall', 'Studentoverall', size, quantity, bulk ? 269 : 299)]
        : [];
    }),
    line('sprayfarg', 'Sprayfärg', 'Röd', sprays, bulk ? 69 : 79),
    line('spritpenna', 'Spritpennor 8-pack', '8 färger', penSets, bulk ? 125 : 139),
  ];
  const paid = status !== 'vantar_betalning' && status !== 'avbruten';
  return {
    orderNumber: `SS-2026-${String(number).padStart(4, '0')}`,
    createdAt,
    status,
    name: 'Kim Klassrepresentant',
    email: 'klassrepresentant@example.com',
    schoolClass,
    street: 'Skolvägen 1',
    postalCode: '43430',
    city: 'Kungsbacka',
    phone: '0700001234',
    comment: 'Demo: påhittad klassbeställning.',
    kind: 'klass',
    school: 'Exempelgymnasiet',
    delivery: 'skola',
    shippingSek: 0,
    discountSek: 0,
    // Den första klassbeställningen i demon fick kampanjen.
    campaign: number % 2 === 1 ? 'flak-celsius' : null,
    items,
    totalSek: items.reduce((sum, item) => sum + item.lineTotalSek, 0),
    source: 'webb',
    paidAt: paid ? createdAt : null,
    shippedAt: null,
  };
}
