/**
 * Validering av beställningsformulären. Samma kod körs i webbläsaren (för snabba
 * felmeddelanden) och i Netlify-funktionen (som är den som faktiskt bestämmer –
 * webbläsarens kontroller går alltid att kringgå).
 *
 * Det finns två sorters beställningar:
 *  - "privat": vanlig varukorg, högst 10 st av samma vara.
 *  - "klass":  klassbeställning från klassrepresentanten (/klassbestallning/),
 *              upp till 500 st av samma vara, skola och mobilnummer krävs.
 */
import * as v from 'valibot';

import { normalizeSource } from './source.ts';

/** Tar bort osynliga styrtecken och onödiga mellanslag. */
function cleanLine(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Som cleanLine, men behåller radbrytningar (för kommentarsfältet). */
function cleanMultiline(value: string): string {
  return value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map(cleanLine)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** "070-123 45 67" / "+46701234567" → "0701234567" */
export function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/gu, '').replace(/^\+46/u, '0');
}

function requiredText(
  missing: string,
  max: number,
  tooLong: string,
): v.GenericSchema<unknown, string> {
  return v.pipe(
    v.string(missing),
    v.transform(cleanLine),
    v.minLength(1, missing),
    v.maxLength(max, tooLong),
  );
}

/** Högst så här många av samma vara per rad (privat/klass), och så här många olika rader. */
export const MAX_QUANTITY = 10;
export const MAX_CLASS_QUANTITY = 500;
export const MAX_LINES = 20;

/**
 * En rad: vilken produkt, vilken storlek/färg och hur många. Högsta antalet
 * per rad kontrolleras separat för privat- och klassbeställningar nedan.
 */
export const CartLineSchema = v.object({
  productId: requiredText('Okänd produkt.', 60, 'Okänd produkt.'),
  size: requiredText('Välj storlek eller färg.', 20, 'Okänd storlek eller färg.'),
  quantity: v.pipe(
    v.union([v.number(), v.string()], 'Ogiltigt antal.'),
    v.transform(Number),
    v.integer('Antal måste vara ett heltal.'),
    v.minValue(1, 'Minst 1 st.'),
    v.maxValue(MAX_CLASS_QUANTITY, `Högst ${String(MAX_CLASS_QUANTITY)} st av samma vara.`),
  ),
});
export type CartLine = v.InferOutput<typeof CartLineSchema>;

/** Slår ihop rader med samma produkt och storlek/färg (t.ex. om kunden lagt till två gånger). */
export function mergeLines(lines: readonly CartLine[], max = MAX_QUANTITY): CartLine[] {
  const merged = new Map<string, CartLine>();
  for (const line of lines) {
    const key = `${line.productId}\u0000${line.size}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...line,
      quantity: Math.min(max, (existing?.quantity ?? 0) + line.quantity),
    });
  }
  return [...merged.values()];
}

const privateItems = v.pipe(
  v.array(CartLineSchema, 'Varukorgen är tom.'),
  v.minLength(1, 'Varukorgen är tom. Lägg till minst en produkt.'),
  v.check(
    (lines) => lines.every((line) => line.quantity <= MAX_QUANTITY),
    `Högst ${String(MAX_QUANTITY)} st av samma vara. Gör en klassbeställning för större antal.`,
  ),
  v.transform((lines: CartLine[]) => mergeLines(lines, MAX_QUANTITY)),
  v.maxLength(MAX_LINES, `Högst ${String(MAX_LINES)} olika varor per beställning.`),
);

const classItems = v.pipe(
  v.array(CartLineSchema, 'Fyll i antal för minst en vara.'),
  v.minLength(1, 'Fyll i antal för minst en vara.'),
  v.transform((lines: CartLine[]) => mergeLines(lines, MAX_CLASS_QUANTITY)),
  v.maxLength(MAX_LINES, `Högst ${String(MAX_LINES)} olika varor per beställning.`),
);

const optionalPhone = v.pipe(
  v.optional(v.string(), ''),
  v.transform(normalizePhone),
  v.check(
    (s) => s === '' || /^07\d{8}$/u.test(s),
    'Ange ett svenskt mobilnummer, t.ex. 070-123 45 67, eller lämna fältet tomt.',
  ),
);

const requiredPhone = v.pipe(
  v.optional(v.string(), ''),
  v.transform(normalizePhone),
  v.check((s) => s !== '', 'Fyll i ditt mobilnummer, så att vi kan nå dig om beställningen.'),
  v.check((s) => /^07\d{8}$/u.test(s), 'Ange ett svenskt mobilnummer, t.ex. 070-123 45 67.'),
);

/** Fält som är lika för båda sorternas beställningar. */
const commonFields = {
  name: v.pipe(
    requiredText('Fyll i ditt namn.', 100, 'Namnet får vara högst 100 tecken.'),
    v.check((s) => s.includes(' '), 'Skriv både för- och efternamn.'),
  ),
  email: v.pipe(
    v.string('Fyll i din e-postadress.'),
    v.transform((s) => cleanLine(s).toLowerCase()),
    v.minLength(1, 'Fyll i din e-postadress.'),
    v.maxLength(254, 'E-postadressen är för lång.'),
    v.email('E-postadressen ser inte rätt ut. Kontrollera att den har formen namn@exempel.se.'),
  ),
  schoolClass: v.pipe(
    v.string('Fyll i klass, t.ex. TE3A.'),
    v.transform((s) => cleanLine(s).toUpperCase()),
    v.minLength(1, 'Fyll i klass, t.ex. TE3A.'),
    v.maxLength(20, 'Klassen får vara högst 20 tecken.'),
    v.regex(
      /^[\p{L}\p{N} .-]+$/u,
      'Klassen får bara innehålla bokstäver, siffror, mellanslag, punkt och bindestreck.',
    ),
  ),
  street: v.pipe(
    requiredText('Fyll i gatuadress.', 120, 'Adressen får vara högst 120 tecken.'),
    v.minLength(3, 'Adressen ser för kort ut.'),
  ),
  postalCode: v.pipe(
    v.string('Fyll i postnummer.'),
    v.transform((s) => s.replace(/\s/gu, '')),
    v.minLength(1, 'Fyll i postnummer.'),
    v.regex(/^\d{5}$/u, 'Postnumret ska vara 5 siffror, t.ex. 123 45.'),
  ),
  city: requiredText('Fyll i ort.', 60, 'Orten får vara högst 60 tecken.'),
  comment: v.pipe(
    v.optional(v.string(), ''),
    v.transform(cleanMultiline),
    v.maxLength(500, 'Kommentaren får vara högst 500 tecken.'),
  ),
  acceptTerms: v.literal(
    true,
    'Du måste godkänna köpvillkoren och integritetspolicyn för att kunna beställa.',
  ),
  source: v.pipe(
    v.optional(v.string(), ''),
    v.transform((s: string) => normalizeSource(s)),
  ),
  // Honeypot: ett dolt fält som människor inte ser. Robotar fyller i allt,
  // så om det här fältet har ett värde avvisar servern beställningen.
  website: v.optional(v.string(), ''),
};

/** Vanlig beställning från varukorgen. */
export const OrderInputSchema = v.object({
  kind: v.optional(v.literal('privat'), 'privat'),
  items: privateItems,
  phone: optionalPhone,
  ...commonFields,
});

/** Klassbeställning från klassrepresentanten. */
export const ClassOrderInputSchema = v.object({
  kind: v.literal('klass'),
  items: classItems,
  school: requiredText('Fyll i skolans namn.', 100, 'Skolans namn får vara högst 100 tecken.'),
  phone: requiredPhone,
  ...commonFields,
});

export type PrivateOrderInput = v.InferOutput<typeof OrderInputSchema>;
export type ClassOrderInput = v.InferOutput<typeof ClassOrderInputSchema>;
export type OrderInput = PrivateOrderInput | ClassOrderInput;

export type ValidationResult =
  | { ok: true; data: OrderInput }
  | { ok: false; errors: Partial<Record<string, string>> };

/** Saknade fält behandlas som tomma, så att felmeddelandet blir det svenska ("Fyll i …"). */
const EMPTY_FORM = {
  items: [],
  name: '',
  email: '',
  schoolClass: '',
  street: '',
  postalCode: '',
  city: '',
  acceptTerms: false,
};

function isClassOrder(input: object): boolean {
  return 'kind' in input && input.kind === 'klass';
}

export function validateOrderInput(input: unknown): ValidationResult {
  const base = typeof input === 'object' && input !== null ? input : {};
  const withDefaults = isClassOrder(base)
    ? { ...EMPTY_FORM, school: '', ...base }
    : { ...EMPTY_FORM, ...base };
  const result = isClassOrder(base)
    ? v.safeParse(ClassOrderInputSchema, withDefaults)
    : v.safeParse(OrderInputSchema, withDefaults);
  if (result.success) return { ok: true, data: result.output };

  const errors: Partial<Record<string, string>> = {};
  for (const issue of result.issues) {
    // Fel i varorna ("items.0.quantity") samlas under "items".
    const path = v.getDotPath(issue) ?? 'form';
    const key = path.startsWith('items') ? 'items' : path;
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
