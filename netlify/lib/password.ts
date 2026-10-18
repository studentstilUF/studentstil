/**
 * Lösenordshashning med scrypt (inbyggt i Node). Lösenordet sparas aldrig i
 * klartext – bara hashen ligger i miljövariabeln ADMIN_PASSWORD_HASH.
 * Skapa en hash med: pnpm run hash-password
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COST = 32768; // N: hur "dyr" beräkningen är (gör gissningsattacker långsamma)
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

function scryptAsync(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelism, maxmem: MAX_MEMORY },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

/** Ger en sträng på formen scrypt:N:r:p:salt:hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, COST, BLOCK_SIZE, PARALLELISM);
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join(':');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  const [algorithm, costText, blockText, parallelText, saltText, hashText] = parts;
  if (
    parts.length !== 6 ||
    algorithm !== 'scrypt' ||
    costText === undefined ||
    blockText === undefined ||
    parallelText === undefined ||
    saltText === undefined ||
    hashText === undefined
  ) {
    return false;
  }
  const cost = Number.parseInt(costText, 10);
  const blockSize = Number.parseInt(blockText, 10);
  const parallelism = Number.parseInt(parallelText, 10);
  // Rimlighetskontroll så att en felaktig miljövariabel inte kan låsa funktionen.
  if (
    !(
      cost >= 1024 &&
      cost <= 1_048_576 &&
      blockSize >= 1 &&
      blockSize <= 32 &&
      parallelism >= 1 &&
      parallelism <= 4
    )
  ) {
    return false;
  }
  const expected = Buffer.from(hashText, 'base64url');
  const actual = await scryptAsync(
    password,
    Buffer.from(saltText, 'base64url'),
    cost,
    blockSize,
    parallelism,
  );
  // timingSafeEqual: jämförelsen tar lika lång tid oavsett hur mycket som stämmer.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Används när användarnamnet inte finns, så att svaret tar lika lång tid ändå. */
export const DUMMY_HASH = `scrypt:${String(COST)}:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
