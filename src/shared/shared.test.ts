import { describe, expect, it } from 'vitest';

import { toCsv } from './csv.ts';
import { formatPostalCode, formatSwishNumber } from './format.ts';
import { normalizeSource, sourceChannel } from './source.ts';

describe('normalizeSource', () => {
  it.each([
    [null, 'webb'],
    ['', 'webb'],
    ['qr', 'qr'],
    ['QR-Skolan', 'qr-skolan'],
    ['qr mässa', 'qr-massa'],
    ['qr-<script>', 'qr-script'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSource(input)).toBe(expected);
  });

  it('delar in i kanaler', () => {
    expect(sourceChannel('qr-skolan')).toBe('QR');
    expect(sourceChannel('webb')).toBe('Webb');
  });
});

describe('format', () => {
  it('formaterar Swish-nummer och postnummer', () => {
    expect(formatSwishNumber('1234567890')).toBe('123 456 78 90');
    expect(formatPostalCode('12345')).toBe('123 45');
  });
});

describe('toCsv', () => {
  it('använder semikolon, BOM och citattecken', () => {
    expect(
      toCsv([
        ['Namn', 'Belopp'],
        ['Alva "A"', 449],
      ]),
    ).toBe('﻿"Namn";"Belopp"\r\n"Alva ""A""";449\r\n');
  });

  it('skyddar mot formler i Excel', () => {
    expect(toCsv([['=HYPERLINK("x")']])).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
