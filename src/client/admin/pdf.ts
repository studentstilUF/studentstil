/**
 * Skapar en PDF med en enda sida som visar en JPEG-bild över hela sidan.
 * Används för QR-affischerna. PDF-formatet är enkelt nog att skriva för hand,
 * så vi slipper ett stort PDF-bibliotek.
 */

/** Sidstorlekar i punkter (1 pt = 1/72 tum). */
export const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
} as const;

export type PageFormat = keyof typeof PAGE_SIZES;

const encoder = new TextEncoder();

export function jpegToPdf(
  jpeg: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  format: PageFormat,
): Uint8Array<ArrayBuffer> {
  const page = PAGE_SIZES[format];
  const w = page.width.toFixed(2);
  const ht = page.height.toFixed(2);
  const content = `q ${w} 0 0 ${ht} 0 0 cm /Im0 Do Q`;

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string): void => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: string): void => {
    offsets.push(length);
    push(`${String(offsets.length)} 0 obj\n${body}\nendobj\n`);
  };

  push('%PDF-1.4\n');
  object('<< /Type /Catalog /Pages 2 0 R >>');
  object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${ht}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets.push(length);
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${String(imageWidth)} /Height ${String(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${String(jpeg.length)} >>\nstream\n`,
  );
  push(jpeg);
  push('\nendstream\nendobj\n');
  object(`<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`);

  const xrefOffset = length;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n\r\n`)
    .join('');
  push(`xref\n0 ${String(offsets.length + 1)}\n0000000000 65535 f\r\n${entries}`);
  push(
    `trailer\n<< /Size ${String(offsets.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`,
  );

  const out = new Uint8Array(length);
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}
