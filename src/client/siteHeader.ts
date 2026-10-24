/**
 * Körs på alla sidor (laddas från sidhuvudet): visar antal varor i varukorgen
 * och en fast "Till kassan"-rad längst ner på mobilen när varukorgen inte är tom.
 */
import { cartCount, onCartChange } from './cart.ts';
import { captureSource } from './source.ts';

function render(): void {
  const count = cartCount();
  const link = document.getElementById('cart-link');
  const badge = document.getElementById('cart-count');
  if (link !== null && badge !== null) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
    link.setAttribute(
      'aria-label',
      count === 0 ? 'Varukorg, tom' : `Varukorg, ${String(count)} varor`,
    );
  }
  const bar = document.getElementById('cart-bar');
  const barText = document.getElementById('cart-bar-text');
  if (bar !== null && barText !== null) {
    // Visas inte i kassan – där syns varukorgen redan.
    bar.hidden = count === 0 || window.location.pathname.startsWith('/kassa');
    barText.textContent = `${String(count)} ${count === 1 ? 'vara' : 'varor'} i varukorgen`;
  }
}

/**
 * Klick på loggan (sidhuvud och sidfot) glider mjukt upp till toppen av sidan.
 * Står man redan högst upp på en annan sida än startsidan går loggan till
 * startsidan, så att den fortfarande fungerar som "Hem".
 */
function setupScrollToTop(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-scroll-top]')) {
    link.addEventListener('click', (event) => {
      const atTop = window.scrollY < 8;
      const onHome = window.location.pathname === '/';
      if (atTop && !onHome && link.getAttribute('href') === '/') return; // vanlig länk till startsidan

      event.preventDefault();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // Flytta tangentbordsfokus till sidans början, så att Tab fortsätter därifrån.
      const main = document.getElementById('main');
      if (main !== null) {
        main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
    });
  }
}

const ANNOUNCEMENT_KEY = 'studentstil-erbjudande-stangt';

/** Krysset på erbjudanderaden döljer den, och valet minns i webbläsaren. */
function setupAnnouncement(): void {
  const bar = document.getElementById('announcement');
  const close = document.getElementById('announcement-close');
  if (bar === null || close === null) return;
  try {
    if (localStorage.getItem(ANNOUNCEMENT_KEY) === '1') bar.hidden = true;
  } catch {
    // Privat läge kan blockera localStorage – då visas raden som vanligt.
  }
  close.addEventListener('click', () => {
    bar.hidden = true;
    try {
      localStorage.setItem(ANNOUNCEMENT_KEY, '1');
    } catch {
      // Inte sparat – raden visas igen på nästa sida.
    }
  });
}

setupAnnouncement();
captureSource();
render();
onCartChange(render);
setupScrollToTop();
