/** Startsidan: visar utvalda produkter. */
import { byId } from '../dom.ts';
import { renderProductGrid } from '../products.ts';
import { captureSource } from '../source.ts';

captureSource();
void renderProductGrid(byId('featured', HTMLDivElement), (product) => product.featured);
