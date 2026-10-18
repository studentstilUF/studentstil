/**
 * Bildkarusell på produktkorten. Har produkten flera bilder (t.ex. overallens
 * fram-, bak- och sidovyer) visas pilar på bildens sidor och miniatyrer under.
 * Bilderna ligger på rad i ett "spår" som glider i sidled, så att bytet blir en
 * mjuk övergång. På mobilen går det även att svepa. Användare som har valt
 * "minska rörelse" i sitt system får byten utan animation (se main.css).
 */
import type { Product } from '../shared/apiTypes.ts';
import { h } from './dom.ts';

/** Så långt (i pixlar) man måste svepa för att byta bild. */
const SWIPE_THRESHOLD = 40;

function slideLabel(product: Product, index: number, total: number): string {
  return `${product.name}, bild ${String(index + 1)} av ${String(total)}`;
}

export type GalleryOptions = {
  /** Stor variant för produktsidan: första bilden laddas direkt och miniatyrerna är större. */
  large?: boolean;
  /** Om satt blir bilden en länk (används på produktkorten → produktsidan). */
  href?: string;
};

/**
 * Lägger bilden/spåret i en länk. Länken är dold för skärmläsare och tangentbord
 * eftersom produktnamnet bredvid redan är en länk till samma sida.
 */
function wrapInLink(content: HTMLElement, href: string | undefined): HTMLElement {
  if (href === undefined) return content;
  return h('a', { href, class: 'gallery-link', tabindex: '-1', 'aria-hidden': 'true' }, content);
}

export function productGallery(product: Product, options: GalleryOptions = {}): HTMLElement {
  const large = options.large ?? false;
  const images = product.images.length > 0 ? product.images : [product.image];
  const total = images.length;
  const galleryClass = large ? 'gallery gallery-large' : 'gallery';
  const imageSize = large ? 800 : 400;

  if (total <= 1) {
    return h(
      'div',
      { class: galleryClass },
      wrapInLink(
        h('img', {
          class: 'gallery-main',
          src: images[0] ?? product.image,
          alt: product.name,
          width: imageSize,
          height: imageSize,
          loading: large ? 'eager' : 'lazy',
          decoding: 'async',
        }),
        options.href,
      ),
    );
  }

  const slides = images.map((src, index) =>
    h('img', {
      class: 'gallery-slide',
      src,
      alt: slideLabel(product, index, total),
      width: imageSize,
      height: imageSize,
      loading: large && index === 0 ? 'eager' : 'lazy',
      decoding: 'async',
      'aria-hidden': index === 0 ? undefined : 'true',
    }),
  );
  // När första bilden har laddats hämtas resten direkt, så att nästa bild
  // redan finns när kunden trycker på pilen (annars blir det tomt en stund).
  slides[0]?.addEventListener(
    'load',
    () => {
      for (const slide of slides.slice(1)) slide.loading = 'eager';
    },
    { once: true },
  );

  const track = h('div', { class: 'gallery-track' }, ...slides);
  const prev = h('button', {
    type: 'button',
    class: 'gallery-arrow gallery-prev',
    'aria-label': 'Föregående bild',
  });
  const next = h('button', {
    type: 'button',
    class: 'gallery-arrow gallery-next',
    'aria-label': 'Nästa bild',
  });
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const viewport = h(
    'div',
    {
      class: 'gallery-viewport',
      role: 'region',
      'aria-roledescription': 'bildspel',
      'aria-label': `Bilder på ${product.name}`,
    },
    wrapInLink(track, options.href),
    prev,
    next,
    status,
  );

  const thumbs = images.map((src, index) =>
    h(
      'button',
      {
        type: 'button',
        class: 'gallery-thumb',
        'aria-label': `Visa bild ${String(index + 1)} av ${String(total)}`,
        'aria-pressed': String(index === 0),
      },
      h('img', { src, alt: '', width: 56, height: 56, loading: 'lazy', decoding: 'async' }),
    ),
  );

  let current = 0;

  /** Visar bild nummer `index`. Efter sista bilden börjar den om från första. */
  function goTo(index: number): void {
    current = (index + total) % total;
    track.style.transform = `translateX(-${String(current * 100)}%)`;
    slides.forEach((slide, i) => {
      if (i === current) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
    });
    thumbs.forEach((thumb, i) => {
      thumb.setAttribute('aria-pressed', String(i === current));
    });
    status.textContent = slideLabel(product, current, total);
  }

  prev.addEventListener('click', () => {
    goTo(current - 1);
  });
  next.addEventListener('click', () => {
    goTo(current + 1);
  });
  thumbs.forEach((thumb, index) => {
    thumb.addEventListener('click', () => {
      goTo(index);
    });
  });

  // Piltangenterna fungerar när fokus är i bildspelet.
  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') goTo(current - 1);
    else if (event.key === 'ArrowRight') goTo(current + 1);
  });

  // Svep åt vänster/höger med fingret.
  let startX: number | null = null;
  let swiped = false;
  viewport.addEventListener('pointerdown', (event) => {
    swiped = false;
    if (event.pointerType !== 'mouse') startX = event.clientX;
  });
  viewport.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const delta = event.clientX - startX;
    startX = null;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      swiped = true;
      goTo(current + (delta < 0 ? 1 : -1));
    }
  });
  viewport.addEventListener('pointercancel', () => {
    startX = null;
  });
  // Ett svep ska byta bild, inte öppna produktsidan via bildlänken.
  viewport.addEventListener(
    'click',
    (event) => {
      if (swiped) {
        event.preventDefault();
        swiped = false;
      }
    },
    true,
  );

  return h(
    'div',
    { class: galleryClass },
    viewport,
    h('div', { class: 'gallery-thumbs' }, ...thumbs),
  );
}
