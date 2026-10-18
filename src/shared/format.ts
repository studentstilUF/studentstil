const sekFormatter = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Stockholm',
});

/** 449 → "449 kr" */
export function formatSek(amount: number): string {
  return sekFormatter.format(amount);
}

/** "12345" → "123 45" */
export function formatPostalCode(postalCode: string): string {
  return /^\d{5}$/u.test(postalCode)
    ? `${postalCode.slice(0, 3)} ${postalCode.slice(3)}`
    : postalCode;
}

/** ISO-datum → "2026-10-18 14:05" (svensk tid) */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormatter.format(date);
}

/** "1234567890" → "123 456 78 90" (så skrivs Swish-nummer) */
export function formatSwishNumber(digits: string): string {
  const match = /^(\d{3})(\d{3})(\d{2})(\d{2})$/u.exec(digits);
  return match === null ? digits : match.slice(1).join(' ');
}
