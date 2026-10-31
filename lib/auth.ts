// Signed session cookie for the dashboard. It says WHO signed in and WHICH company they belong to.
// Uses only the Web Crypto API so it works both in middleware (edge) and in route handlers (node).

export const SESSION_COOKIE = 'ff_session';
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours

export type Role = 'platform_admin' | 'owner' | 'viewer';

export interface SessionPayload {
  uid: string; // dashboard_users.id, or 'platform-admin'
  cid: string | null; // company id (null for the platform admin)
  role: Role;
  exp: number; // expiry, ms since epoch
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(text: string): string {
  const bytes = encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return decoder.decode(bytes);
  } catch {
    return null;
  }
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

export async function createSessionToken(input: { uid: string; cid: string | null; role: Role }): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const payload: SessionPayload = { ...input, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${await hmacHex(secret, body)}`;
}

/** Returns the signed-in person's details, or null when the cookie is missing, forged or expired. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  if (!equalHex(await hmacHex(secret, body), token.slice(dot + 1))) return null;
  const json = fromBase64Url(body);
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    if (typeof p?.uid !== 'string' || typeof p?.exp !== 'number' || p.exp < Date.now()) return null;
    if (p.role !== 'platform_admin' && p.role !== 'owner' && p.role !== 'viewer') return null;
    if (p.role !== 'platform_admin' && (typeof p.cid !== 'string' || !p.cid)) return null;
    return { uid: p.uid, cid: typeof p.cid === 'string' ? p.cid : null, role: p.role, exp: p.exp };
  } catch {
    return null;
  }
}
