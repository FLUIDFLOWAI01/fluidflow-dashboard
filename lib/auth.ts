// Minimal password gate for the executive dashboard.
// Uses only the Web Crypto API so it works both in middleware (edge) and in route handlers (node).

export const SESSION_COOKIE = 'ff_session';
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(data)));
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Constant-time comparison of two secrets (hashes them first so the length can't leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  return equalHex(await sha256Hex(a), await sha256Hex(b));
}

export async function createSessionToken(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return `${expires}.${await hmacHex(secret, String(expires))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expires = Number(token.slice(0, dot));
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  return equalHex(await hmacHex(secret, String(expires)), token.slice(dot + 1));
}
