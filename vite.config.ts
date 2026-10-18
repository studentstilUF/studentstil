import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

/** Alla sidor på sajten. Lägg till nya sidor här. */
const PAGES = [
  'index.html',
  'om-oss/index.html',
  'bestall/index.html',
  'produkt/index.html',
  'klassbestallning/index.html',
  'kassa/index.html',
  'order/index.html',
  'vanliga-fragor/index.html',
  'kopvillkor/index.html',
  'integritetspolicy/index.html',
  'admin/index.html',
  '404.html',
];

function readPartial(name: string): string {
  return readFileSync(new URL(`./src/partials/${name}.html`, import.meta.url), 'utf8');
}

/**
 * Sidhuvud och sidfot finns på ett ställe (src/partials/) och klistras in där
 * sidorna har <!-- @header --> och <!-- @footer -->. Sidan man står på markeras i menyn.
 */
function partials(): Plugin {
  return {
    name: 'studentstil-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const current = ctx.path.replace(/index\.html$/u, '');
        const header = readPartial('header').replace(
          `href="${current}"`,
          `href="${current}" aria-current="page"`,
        );
        return html
          .replace('<!-- @header -->', header)
          .replace('<!-- @footer -->', readPartial('footer'));
      },
    },
  };
}

export default defineConfig({
  plugins: [partials()],
  build: {
    rolldownOptions: {
      input: Object.fromEntries(
        PAGES.map((page) => [
          page.replace(/(\/index)?\.html$/u, '').replaceAll('/', '-') || 'index',
          fileURLToPath(new URL(page, import.meta.url)),
        ]),
      ),
    },
  },
});
