/**
 * Skapar en lösenordshash till ADMIN_PASSWORD_HASH eller DEMO_PASSWORD_HASH.
 *
 *   pnpm run hash-password
 *
 * Skriv lösenordet när du blir ombedd. Kopiera raden som börjar med "scrypt:"
 * och klistra in den som värde på miljövariabeln i Netlify. Själva lösenordet
 * sparas aldrig någonstans.
 */
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { hashPassword } from '../netlify/lib/password.ts';

const rl = createInterface({ input: stdin, output: stdout });
const password = await rl.question('Lösenord (minst 12 tecken): ');
rl.close();

if (password.length < 12) {
  console.error('Lösenordet är för kort. Använd minst 12 tecken, gärna en mening med flera ord.');
  process.exitCode = 1;
} else {
  console.info('\nKopiera hela raden nedan till miljövariabeln:\n');
  console.info(await hashPassword(password));
}
