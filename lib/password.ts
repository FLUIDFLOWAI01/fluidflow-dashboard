// Password hashing with scrypt (built into Node, no extra package). Server-side only (not for middleware).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const expected = Buffer.from(parts[2], 'hex');
    const actual = scryptSync(password, parts[1], KEYLEN);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
