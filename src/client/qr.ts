/** Ritar QR-koder på en canvas med biblioteket qrcode-generator (inga externa tjänster). */
import createQrCode from 'qrcode-generator';

/**
 * Ritar en QR-kod i en kvadrat på (x, y) med sidan `size` pixlar.
 * `quietModules` = vit marginal runt koden, mätt i QR-rutor (minst 4 rekommenderas).
 */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  quietModules = 4,
): void {
  const qr = createQrCode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / (count + quietModules * 2);
  const offset = quietModules * cell;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#111111';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        // Avrundning + 0.5 px överlapp så att det inte blir tunna vita streck mellan rutorna.
        ctx.fillRect(
          Math.floor(x + offset + col * cell),
          Math.floor(y + offset + row * cell),
          Math.ceil(cell + 0.5),
          Math.ceil(cell + 0.5),
        );
      }
    }
  }
}

/** Skapar en canvas med en QR-kod (t.ex. för Swish-betalning på dator). */
export function qrCanvas(text: string, sizePx: number, label: string): HTMLCanvasElement {
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sizePx * ratio);
  canvas.height = Math.round(sizePx * ratio);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  const ctx = canvas.getContext('2d');
  if (ctx !== null) drawQr(ctx, text, 0, 0, canvas.width);
  return canvas;
}
