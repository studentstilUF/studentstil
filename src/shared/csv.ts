export type CsvCell = string | number;

/**
 * Skapar CSV som Excel med svenska inställningar öppnar direkt:
 * semikolon som avgränsare, BOM så att å/ä/ö visas rätt och CRLF-radbrytningar.
 */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  const lines = rows.map((row) => row.map(csvCell).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

function csvCell(value: CsvCell): string {
  if (typeof value === 'number') return String(value);
  // Skydd mot "CSV-injektion": en cell som börjar med = + - @ kan tolkas som
  // en formel i Excel. Vi sätter en apostrof först så att den visas som text.
  const safe = /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/gu, '""')}"`;
}
