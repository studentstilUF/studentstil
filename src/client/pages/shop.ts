/** Produktsidan (/bestall/): alla produkter. Hit leder QR-koderna. */
import { byId } from '../dom.ts';
import { renderProductGrid } from '../products.ts';
import { captureSource } from '../source.ts';

captureSource();
void renderProductGrid(byId('products', HTMLDivElement), () => true);
