/**
 * TILLFÄLLIGT: "GRATTIS STELLA" som pulserar över hela sajten, med ballonger
 * som flyger uppåt. Allt (även stilen) ligger i den här filen.
 * Ta bort: radera filen och raden med celebration.ts i src/partials/header.html.
 */

const COLORS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#ff6fb5', '#9b5de5'];
const BALLOONS = 26;

const css = `
.celebration {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
  overflow: hidden;
}
.celebration-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  font-weight: 900;
  font-size: clamp(2rem, 8vw, 7rem);
  padding: 0 4vw;
  line-height: 1;
  letter-spacing: 0.03em;
  color: #ff2d87;
  text-shadow: 0 4px 0 #fff, 0 8px 24px rgb(0 0 0 / 0.25);
  animation: celebration-pulse 1.1s ease-in-out infinite;
}
.celebration-balloon {
  position: absolute;
  bottom: -160px;
  width: var(--size);
  height: calc(var(--size) * 1.2);
  border-radius: 50% 50% 48% 52% / 55% 55% 45% 45%;
  background: radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.65) 0 10%, transparent 11%), var(--color);
  box-shadow: inset -6px -8px 0 rgb(0 0 0 / 0.12);
  animation:
    celebration-rise var(--duration) linear var(--delay) infinite,
    celebration-sway 3s ease-in-out var(--delay) infinite alternate;
}
.celebration-balloon::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  width: 1px;
  height: 70px;
  background: rgb(0 0 0 / 0.35);
}
@keyframes celebration-pulse {
  0%, 100% { transform: scale(0.85); }
  50% { transform: scale(1.15); }
}
@keyframes celebration-rise {
  to { transform: translateY(calc(-100vh - 260px)); }
}
@keyframes celebration-sway {
  from { margin-left: -18px; }
  to { margin-left: 18px; }
}
`;

function start(): void {
  // Konstruerad stilmall: fungerar även med sajtens säkerhetsregler (CSP),
  // som inte tillåter <style>-taggar inne i sidan.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  const root = document.createElement('div');
  root.className = 'celebration';
  root.setAttribute('aria-hidden', 'true');

  const text = document.createElement('div');
  text.className = 'celebration-text';
  text.textContent = 'GRATTIS STELLA';
  root.append(text);

  for (let i = 0; i < BALLOONS; i++) {
    const balloon = document.createElement('span');
    balloon.className = 'celebration-balloon';
    balloon.style.left = `${String(Math.random() * 96)}%`;
    balloon.style.setProperty('--size', `${String(40 + Math.random() * 40)}px`);
    balloon.style.setProperty('--color', COLORS[i % COLORS.length] ?? '#e63946');
    balloon.style.setProperty('--duration', `${String(7 + Math.random() * 7)}s`);
    balloon.style.setProperty('--delay', `${String(-Math.random() * 14)}s`);
    root.append(balloon);
  }

  document.body.append(root);
}

start();
