import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });
  return `scrypt$${SCRYPT_COST}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedValue: string): { valid: boolean; needsRehash: boolean } {
  if (!storedValue.startsWith("scrypt$")) {
    return { valid: password === storedValue, needsRehash: password === storedValue };
  }

  const [, costText, saltHex, keyHex] = storedValue.split("$");
  const cost = Number(costText);
  if (cost !== SCRYPT_COST || !saltHex || !keyHex) return { valid: false, needsRehash: false };

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expectedKey = Buffer.from(keyHex, "hex");
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return { valid: false, needsRehash: false };
    const actualKey = scryptSync(password, salt, KEY_LENGTH, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
    });
    return { valid: timingSafeEqual(actualKey, expectedKey), needsRehash: false };
  } catch {
    return { valid: false, needsRehash: false };
  }
}