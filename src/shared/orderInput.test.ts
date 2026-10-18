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
