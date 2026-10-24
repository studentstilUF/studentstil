import { describe, expect, it } from 'vitest';

import { validateOrderInput } from './orderInput.ts';

const valid = {
  items: [
    { productId: 'studentoverall', size: 'M', quantity: 1 },
    { productId: 'sprayfarg', size: 'Gul', quantity: '2' },
  ],
  name: '  Alva   Exempelsson ',
  email: 'Alva@Example.com',
  schoolClass: 'te3a',
  street: 'Storgatan 1',
  postalCode: '123 45',
  city: 'Exempelstad',
  phone: '070-123 45 67',
  comment: '',
  acceptTerms: true,
  source: 'QR-Mässa',
  website: '',
  delivery: 'hem',
};

describe('validateOrderInput', () => {
  it('godkänner och städar en korrekt beställning', () => {
    const result = validateOrderInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      name: 'Alva Exempelsson',
      email: 'alva@example.com',
      schoolClass: 'TE3A',
      postalCode: '12345',
      phone: '0701234567',
      items: [
        { productId: 'studentoverall', size: 'M', quantity: 1 },
        { productId: 'sprayfarg', size: 'Gul', quantity: 2 },
      ],
      source: 'qr-massa',
    });
  });

  it('slår ihop samma vara som lagts till flera gånger', () => {
    const result = validateOrderInput({
      ...valid,
      items: [
        { productId: 'spritpenna', size: 'Röd', quantity: 2 },
        { productId: 'spritpenna', size: 'Röd', quantity: 3 },
      ],
    });
    expect(result.ok && result.data.items).toEqual([
      { productId: 'spritpenna', size: 'Röd', quantity: 5 },
    ]);
  });

  it('kräver minst en vara och rimliga antal', () => {
    const empty = validateOrderInput({ ...valid, items: [] });
    expect(!empty.ok && empty.errors['items']).toMatch(/Varukorgen är tom/u);
    const tooMany = validateOrderInput({
      ...valid,
      items: [{ productId: 'sprayfarg', size: 'Gul', quantity: 11 }],
    });
    expect(!tooMany.ok && tooMany.errors['items']).toMatch(/Högst 10/u);
  });

  it('kräver alla obligatoriska fält och ger svenska felmeddelanden', () => {
    const result = validateOrderInput({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['name']).toBe('Fyll i ditt namn.');
    expect(result.errors['email']).toBe('Fyll i din e-postadress.');
    expect(result.errors['acceptTerms']).toMatch(/godkänna köpvillkoren/u);
  });

  it.each([
    ['email', 'inte-en-adress', /ser inte rätt ut/u],
    ['postalCode', '1234', /5 siffror/u],
    ['name', 'Alva', /för- och efternamn/u],
    ['phone', '12345', /svenskt mobilnummer/u],
    ['schoolClass', 'TE3A<script>', /bara innehålla/u],
  ])('avvisar felaktigt %s', (field, value, message) => {
    const result = validateOrderInput({ ...valid, [field]: value });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[field]).toMatch(message);
  });

  it('hämtning på skola i en vanlig beställning sker alltid på Elof', () => {
    // Även med en annan skola och en adress utanför Kungsbacka.
    const result = validateOrderInput({ ...valid, delivery: 'skola', school: 'Aranäsgymnasiet' });
    expect(result.ok && result.data).toMatchObject({
      delivery: 'skola',
      school: 'Elof Lindälvs gymnasium',
    });
  });

  it('sparar ingen skola vid hemleverans i en vanlig beställning', () => {
    const result = validateOrderInput({
      ...valid,
      delivery: 'hem',
      school: 'Elof Lindälvs gymnasium',
    });
    expect(result.ok && result.data.school).toBe('');
  });

  it('skickar hem när leverans saknas', () => {
    const result = validateOrderInput({ ...valid, delivery: undefined });
    expect(result.ok && result.data.delivery).toBe('hem');
  });

  it('kräver att kryssrutan är ikryssad', () => {
    const result = validateOrderInput({ ...valid, acceptTerms: false });
    expect(result.ok).toBe(false);
  });

  it('tillåter tomt mobilnummer och kommentar', () => {
    const result = validateOrderInput({ ...valid, phone: '', comment: undefined });
    expect(result.ok).toBe(true);
  });

  it('tar bort styrtecken men behåller radbrytningar i kommentaren', () => {
    const result = validateOrderInput({ ...valid, comment: 'Rad 1\u0007\r\nRad 2' });
    expect(result.ok && result.data.comment).toBe('Rad 1\nRad 2');
  });
});

describe('kryphål: manipulerade beställningar', () => {
  it.each([-1, 0, 1.5, 'abc', '1e3', Number.NaN])('avvisar antal %s', (quantity) => {
    const result = validateOrderInput({
      ...valid,
      items: [{ productId: 'studentoverall', size: 'M', quantity }],
    });
    expect(result.ok).toBe(false);
  });

  it('ger aldrig fler än 10 av samma vara, även om raden delas upp', () => {
    const result = validateOrderInput({
      ...valid,
      items: [
        { productId: 'studentoverall', size: 'M', quantity: 10 },
        { productId: 'studentoverall', size: 'M', quantity: 10 },
      ],
    });
    // Raderna slås ihop och tak sätts på 10 – kunden kan aldrig få fler än 10.
    expect(result.ok && result.data.items[0]?.quantity).toBe(10);
  });

  it('avvisar fler än 20 olika rader', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      productId: 'sprayfarg',
      size: `Färg ${String(i)}`,
      quantity: 1,
    }));
    expect(validateOrderInput({ ...valid, items }).ok).toBe(false);
  });

  it('släpper inte igenom egna priser, rabatter eller frakt från webbläsaren', () => {
    const result = validateOrderInput({
      ...valid,
      totalSek: 1,
      shippingSek: 0,
      discountSek: 9999,
      campaign: 'gratis-overall',
      items: [{ productId: 'studentoverall', size: 'M', quantity: 1, unitPriceSek: 1 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty('totalSek');
    expect(result.data).not.toHaveProperty('shippingSek');
    expect(result.data).not.toHaveProperty('discountSek');
    expect(result.data).not.toHaveProperty('campaign');
    expect(result.data.items[0]).not.toHaveProperty('unitPriceSek');
  });

  it('avvisar okänt leveranssätt', () => {
    expect(validateOrderInput({ ...valid, delivery: 'gratis' }).ok).toBe(false);
  });

  it('sparar ingen skola i en vanlig beställning', () => {
    const result = validateOrderInput({ ...valid, delivery: 'hem', school: 'Aranäsgymnasiet' });
    expect(result.ok && result.data.school).toBe('');
  });
});
