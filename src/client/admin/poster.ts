/** QR-affischer för fysisk försäljning (PNG och PDF i A4/A5). */
import { normalizeSource } from '../../shared/source.ts';
import { drawQr } from '../qr.ts';
import { PAGE_SIZES, type PageFormat } from './pdf.ts';

/** Sajtens publika adress. Sätt VITE_SITE_URL om domänen ändras. */
const configuredSiteUrl: unknown = import.meta.env['VITE_SITE_URL'];
export const PUBLIC_SITE_URL: string =
  typeof configuredSiteUrl === 'string' && configuredSiteUrl !== ''
    ? configuredSiteUrl.replace(/\/+$/u, '')
    : 'https://studentstil.se';

/** "skolan" → { source: "qr-skolan", url: "https://studentstil.se/bestall/?kalla=qr-skolan" } */
export function posterTarget(place: string): { source: string; url: string } {
  const trimmed = place.trim();
  const source = trimmed === '' ? 'qr' : normalizeSource(`qr-${trimmed}`);
  return { source, url: `${PUBLIC_SITE_URL}/bestall/?kalla=${source}` };
}

export type PosterOptions = {
  url: string;
  title: string;
  subtitle: string;
  format: PageFormat;
  /** Kronan (/logo/krona-stor.png). Null tills bilden laddats. */
  logo: HTMLImageElement | null;
};

/** 200 punkter per tum räcker gott för en skarp utskrift. */
const DPI = 200;

export function posterPixelSize(format: PageFormat): { width: number; height: number } {
  const page = PAGE_SIZES[format];
  return {
    width: Math.round((page.width / 72) * DPI),
    height: Math.round((page.height / 72) * DPI),
  };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u).filter((w) => w !== '')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(candidate).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions): void {
  const { width, height } = posterPixelSize(options.format);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const margin = width * 0.1;
  const textWidth = width - margin * 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Logotyp (kronan) och namnet som text under
  const crownHeight = width * 0.12;
  if (options.logo !== null && options.logo.naturalHeight > 0) {
    const crownWidth = (options.logo.naturalWidth / options.logo.naturalHeight) * crownHeight;
    ctx.drawImage(options.logo, (width - crownWidth) / 2, margin * 0.6, crownWidth, crownHeight);
  }
  ctx.font = `700 ${String(Math.round(width * 0.04))}px ${FONT}`;
  ctx.fillText('Studentstil', width / 2, margin * 0.6 + crownHeight + width * 0.06);

  // Rubrik
  const titleSize = Math.round(width * 0.075);
  ctx.font = `650 ${String(titleSize)}px ${FONT}`;
  let y = margin * 0.6 + crownHeight + width * 0.18;
  for (const line of wrapLines(ctx, options.title, textWidth)) {
    ctx.fillText(line, width / 2, y);
    y += titleSize * 1.15;
  }

  // Underrubrik
  const subtitleSize = Math.round(width * 0.034);
  ctx.font = `400 ${String(subtitleSize)}px ${FONT}`;
  ctx.fillStyle = '#555555';
  y += subtitleSize * 0.4;
  for (const line of wrapLines(ctx, options.subtitle, textWidth)) {
    ctx.fillText(line, width / 2, y);
    y += subtitleSize * 1.4;
  }

  // QR-kod
  const qrSize = Math.min(width * 0.62, height - y - width * 0.35);
  const qrY = y + width * 0.04;
  drawQr(ctx, options.url, (width - qrSize) / 2, qrY, qrSize);

  // Instruktion och adress
  ctx.fillStyle = '#111111';
  ctx.font = `600 ${String(Math.round(width * 0.036))}px ${FONT}`;
  ctx.fillText('Skanna med mobilkameran', width / 2, qrY + qrSize + width * 0.08);
  ctx.fillStyle = '#555555';
  ctx.font = `400 ${String(Math.round(width * 0.026))}px ${FONT}`;
  ctx.fillText(options.url.replace(/^https?:\/\//u, ''), width / 2, qrY + qrSize + width * 0.13);
  ctx.fillText('Betala enkelt med Swish', width / 2, height - margin * 0.7);
}
