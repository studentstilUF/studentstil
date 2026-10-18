/** Fliken "QR-koder": skapa affischer för olika platser/event. */
import { byId, downloadBlob } from '../dom.ts';
import { jpegToPdf, type PageFormat } from './pdf.ts';
import { drawPoster, posterTarget } from './poster.ts';

const form = byId('poster-form', HTMLFormElement);
const place = byId('poster-place', HTMLInputElement);
const title = byId('poster-title', HTMLInputElement);
const subtitle = byId('poster-subtitle', HTMLInputElement);
const format = byId('poster-format', HTMLSelectElement);
const urlOutput = byId('poster-url', HTMLElement);
const canvas = byId('poster-canvas', HTMLCanvasElement);

let logo: HTMLImageElement | null = null;

/** Laddar kronan som ritas överst på affischen. */
function loadLogo(): void {
  const image = new Image();
  image.addEventListener('load', () => {
    logo = image;
    redraw();
  });
  image.src = '/logo/krona-stor.png';
}

function selectedFormat(): PageFormat {
  return format.value === 'A5' ? 'A5' : 'A4';
}

function redraw(): void {
  const target = posterTarget(place.value);
  urlOutput.textContent = target.url;
  drawPoster(canvas, {
    url: target.url,
    title: title.value,
    subtitle: subtitle.value,
    format: selectedFormat(),
    logo,
  });
}

function filename(extension: string): string {
  return `studentstil-${posterTarget(place.value).source}-${selectedFormat()}.${extension}`;
}

function canvasBlob(type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(new Error('Kunde inte skapa bilden.'));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function downloadPng(): Promise<void> {
  downloadBlob(await canvasBlob('image/png'), filename('png'));
}

async function downloadPdf(): Promise<void> {
  const jpeg = new Uint8Array(await (await canvasBlob('image/jpeg', 0.95)).arrayBuffer());
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, selectedFormat());
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), filename('pdf'));
}

export function initPosterView(): void {
  form.addEventListener('input', redraw);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });
  byId('poster-png', HTMLButtonElement).addEventListener('click', () => {
    void downloadPng();
  });
  byId('poster-pdf', HTMLButtonElement).addEventListener('click', () => {
    void downloadPdf();
  });
  redraw();
  loadLogo();
}
