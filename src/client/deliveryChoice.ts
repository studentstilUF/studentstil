/**
 * Leveransvalet i kassan och klassbeställningen:
 *  - "Hämta på en skola i Kungsbacka" (gratis) syns bara när postnumret ligger
 *    i Kungsbacka. Rullistan med gymnasieskolor visas först när det valet klickas i.
 *  - "Hemleverans" (frakt) går alltid att välja.
 * Byts postnumret till en annan ort försvinner skolvalet igen.
 */
import {
  type Delivery,
  isKungsbackaPostalCode,
  KUNGSBACKA_SCHOOLS,
  SHIPPING_FEE_SEK,
} from '../shared/delivery.ts';
import { formatSek } from '../shared/format.ts';
import { h } from './dom.ts';

export type DeliveryChoice = {
  /** Valt leveranssätt, eller null om kunden inte valt än. */
  selected: () => Delivery | null;
  /** Skolan: vald i rullistan vid skolhämtning, annars fritext (klassbeställning) eller ''. */
  school: () => string;
};

type Options = {
  /** Platsen i formuläret där valet ska ritas upp. */
  container: HTMLElement;
  postalInput: HTMLInputElement;
  /** Text under "Hemleverans". */
  homeText: string;
  /** Pris som visas för hemleverans (standard: den fasta frakten). */
  homePrice?: string;
  /**
   * Klassbeställning: fråga efter skolans namn även vid hemleverans (fritext),
   * eftersom ordern alltid hör till en skola.
   */
  askSchoolForHome?: boolean;
  /** Anropas när leveransen eller skolan ändras (t.ex. för att räkna om totalen). */
  onChange: () => void;
};

function option(value: Delivery, title: string, text: string, price: string): HTMLLabelElement {
  return h(
    'label',
    { class: 'delivery-option' },
    h('input', { type: 'radio', name: 'delivery', value }),
    h('span', {}, h('strong', {}, title), h('span', { class: 'muted small' }, text)),
    h('span', { class: 'delivery-price' }, price),
  );
}

function radioIn(label: HTMLLabelElement): HTMLInputElement {
  const input = label.querySelector('input');
  if (input === null) throw new Error('Leveransvalet saknar radioknapp.');
  return input;
}

export function deliveryChoice({
  container,
  postalInput,
  homeText,
  homePrice = formatSek(SHIPPING_FEE_SEK),
  askSchoolForHome = false,
  onChange,
}: Options): DeliveryChoice {
  const schoolOption = option(
    'skola',
    'Hämta på en skola i Kungsbacka',
    'Gratis för dig med adress i Kungsbacka.',
    'Gratis',
  );
  const homeOption = option('hem', 'Hemleverans', homeText, homePrice);
  const select = h(
    'select',
    { id: 'school', name: 'school', 'aria-describedby': 'school-error' },
    h('option', { value: '' }, 'Välj skola …'),
    ...KUNGSBACKA_SCHOOLS.map((school) => h('option', { value: school }, school)),
  );
  const picker = h(
    'div',
    { class: 'field school-picker' },
    h('label', { for: 'school' }, 'Välj skola'),
    select,
  );
  const schoolText = h('input', {
    id: 'school-name',
    name: 'school',
    type: 'text',
    autocomplete: 'organization',
    maxlength: 100,
    'aria-describedby': 'school-error',
  });
  const homeSchool = h(
    'div',
    { class: 'field', hidden: true },
    h('label', { for: 'school-name' }, 'Skolans namn'),
    schoolText,
  );
  container.replaceChildren(
    h(
      'fieldset',
      { class: 'field delivery-choice', id: 'delivery', 'aria-describedby': 'delivery-error' },
      h('legend', { class: 'field-label' }, 'Leverans'),
      schoolOption,
      homeOption,
      h('p', { id: 'delivery-error', class: 'field-error', hidden: true }),
    ),
    picker,
    homeSchool,
    h('p', { id: 'school-error', class: 'field-error', hidden: true }),
  );

  const schoolRadio = radioIn(schoolOption);
  const homeRadio = radioIn(homeOption);

  function update(): void {
    const inKungsbacka = isKungsbackaPostalCode(postalInput.value);
    schoolOption.hidden = !inKungsbacka;
    schoolRadio.disabled = !inKungsbacka;
    if (!inKungsbacka) schoolRadio.checked = false;
    picker.hidden = !(inKungsbacka && schoolRadio.checked);
    homeSchool.hidden = !(askSchoolForHome && homeRadio.checked);
    onChange();
  }

  postalInput.addEventListener('input', update);
  container.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === 'delivery') {
      update();
      if (event.target.value === 'skola') select.focus();
    } else {
      onChange();
    }
  });
  update();

  return {
    selected: () => {
      const value = container.querySelector<HTMLInputElement>(
        'input[name="delivery"]:checked',
      )?.value;
      return value === 'skola' || value === 'hem' ? value : null;
    },
    school: () => (schoolRadio.checked ? select.value : schoolText.value),
  };
}
