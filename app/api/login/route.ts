import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, safeEqual } from '../../../lib/auth';
import type { Role } from '../../../lib/auth';
import { hashPassword, verifyPassword } from '../../../lib/password';
import { getSupabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Brake on password guessing. Kept in memory per server instance (best effort).
// Three counters: same IP + same email, whole IP, and whole email (stops attackers
// who rotate IPs against one account).
// ---------------------------------------------------------------------------
const failures = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT_IP_EMAIL = 8;
const LIMIT_IP = 30;
const LIMIT_EMAIL = 20;
const MAX_TRACKED_KEYS = 5000; // stops the map growing forever under attack
const FAIL_DELAY_MS = 800;
const MAX_BODY_BYTES = 2048;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 200; // stops huge passwords being used to slow the server

const DUMMY_HASH = hashPassword('not-a-real-password');

function recentCount(key: string, now: number): number {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list.length;
}

function recordFailure(key: string): void {
  if (failures.size >= MAX_TRACKED_KEYS && !failures.has(key)) {
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
  failures.set(key, [...(failures.get(key) ?? []), Date.now()]);
}

function clientIp(req: Request): string {
  const real = (req.headers.get('x-real-ip') ?? '').trim();
  if (real) return real;
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
}

function genericError(status = 500) {
  return NextResponse.json({ error: 'Sign in failed' }, { status });
}

type DashboardUser = {
  id: string | number;
  company_id: string | number;
  password_hash: string | null;
  role: string | null;
  active: boolean | null;
};

export async function POST(req: Request) {
  if (!process.env.SESSION_SECRET) {
    console.error('Login: SESSION_SECRET is not set');
    return genericError();
  }

  // Only accept requests that come from our own site (extra protection on top of SameSite=strict).
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: 'Invalid request' }, { status: 403 });
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 403 });
    }
  }

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 413 });
  }

  let email = '';
  let password = '';
  try {
    const body = await req.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!email || !password) return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 });
  if (email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
  }

  // Check the limits BEFORE doing any database or hashing work.
  const ip = clientIp(req);
  const keyIpEmail = `ip-email|${ip}|${email}`;
  const keyIp = `ip|${ip}`;
  const keyEmail = `email|${email}`;
  const now = Date.now();
  if (
    recentCount(keyIpEmail, now) >= LIMIT_IP_EMAIL ||
    recentCount(keyIp, now) >= LIMIT_IP ||
    recentCount(keyEmail, now) >= LIMIT_EMAIL
  ) {
    return NextResponse.json({ error: 'Too many wrong attempts. Try again in 10 minutes.' }, { status: 429 });
  }

  const fail = async () => {
    recordFailure(keyIpEmail);
    recordFailure(keyIp);
    recordFailure(keyEmail);
    await new Promise((resolve) => setTimeout(resolve, FAIL_DELAY_MS));
    return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
  };

  let session: { uid: string; cid: string | null; role: Role } | null = null;

  // 1) The platform admin (you): PLATFORM_ADMIN_EMAIL + DASHBOARD_PASSWORD from the environment.
  const adminEmail = (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = process.env.DASHBOARD_PASSWORD ?? '';
  if (adminEmail && adminPassword && email === adminEmail) {
    if (!(await safeEqual(password, adminPassword))) return fail();
    session = { uid: 'platform-admin', cid: null, role: 'platform_admin' };
  } else {
    // 2) A company login from the database.
    let user: DashboardUser | null = null;
    try {
      const { data, error } = await getSupabase()
        .from('dashboard_users')
        .select('id,company_id,password_hash,role,active')
        .ilike('email', email.replace(/[\\%_]/g, (c: string) => `\\${c}`))
        .maybeSingle();
      if (error) {
        console.error('Login: user lookup failed', error);
        return genericError();
      }
      user = (data as DashboardUser | null) ?? null;
    } catch (e) {
      console.error('Login: user lookup crashed', e);
      return genericError();
    }

    // Always run the password check (against a dummy hash if the user is unknown) so timing does not reveal which emails exist.
    const passwordOk = verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !passwordOk || !user.active) return fail();

    try {
      const { data: company, error: companyError } = await getSupabase()
        .from('companies')
        .select('status')
        .eq('id', user.company_id)
        .maybeSingle();
      if (companyError) {
        console.error('Login: company lookup failed', companyError);
        return genericError();
      }
      if (!company || company.status !== 'active') {
        return NextResponse.json({ error: 'This company is suspended. Contact support.' }, { status: 403 });
      }
    } catch (e) {
      console.error('Login: company lookup crashed', e);
      return genericError();
    }
    session = { uid: String(user.id), cid: String(user.company_id), role: user.role === 'viewer' ? 'viewer' : 'owner' };
  }

  // Successful login: clear the counters for this IP + email only.
  failures.delete(keyIpEmail);

  const token = await createSessionToken(session);
  if (!token) {
    console.error('Login: could not create session token');
    return genericError();
  }

  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
