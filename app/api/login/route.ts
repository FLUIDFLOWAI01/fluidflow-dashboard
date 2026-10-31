import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, safeEqual } from '../../../lib/auth';
import type { Role } from '../../../lib/auth';
import { hashPassword, verifyPassword } from '../../../lib/password';
import { getSupabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// Best-effort brake on password guessing (per server instance). The delay on a wrong password also slows guessing.
const failures = new Map<string, number[]>();
const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60 * 1000;
const DUMMY_HASH = hashPassword('not-a-real-password');

function clientKey(req: Request, email: string): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  return `${ip}|${email}`;
}

export async function POST(req: Request) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Server is missing SESSION_SECRET' }, { status: 500 });
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

  const key = clientKey(req, email);
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  if (recent.length >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Too many wrong attempts. Try again in 10 minutes.' }, { status: 429 });
  }

  const fail = async () => {
    failures.set(key, [...(failures.get(key) ?? []), Date.now()]);
    await new Promise((resolve) => setTimeout(resolve, 800));
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
    let user: any = null;
    try {
      const { data, error } = await getSupabase()
        .from('dashboard_users')
        .select('id,company_id,password_hash,role,active')
        .ilike('email', email.replace(/[%_]/g, (c: string) => `\\${c}`))
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      user = data;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Sign in failed' }, { status: 500 });
    }
    const ok = verifyPassword(password, user?.password_hash ?? DUMMY_HASH) && Boolean(user);
    if (!ok || !user.active) return fail();

    const { data: company } = await getSupabase().from('companies').select('status').eq('id', user.company_id).maybeSingle();
    if (!company || company.status !== 'active') {
      return NextResponse.json({ error: 'This company is suspended. Contact support.' }, { status: 403 });
    }
    session = { uid: String(user.id), cid: String(user.company_id), role: user.role === 'viewer' ? 'viewer' : 'owner' };
  }

  failures.delete(key);
  const token = await createSessionToken(session);
  if (!token) return NextResponse.json({ error: 'Could not create a session' }, { status: 500 });

  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
