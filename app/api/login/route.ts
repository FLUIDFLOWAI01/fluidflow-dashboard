import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, safeEqual } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Server is missing DASHBOARD_PASSWORD or SESSION_SECRET' }, { status: 500 });
  }

  let password = '';
  try {
    const body = await req.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await safeEqual(password, expected))) {
    // A short delay makes password guessing slow without needing a database.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const token = await createSessionToken();
  if (!token) return NextResponse.json({ error: 'Could not create a session' }, { status: 500 });

  const res = NextResponse.json({ ok: true });
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
