// Works out WHO is calling and WHICH company they may touch. Every API route starts here.
// The company is decided on the server from the signed cookie; a company id sent by the browser is ignored
// unless the caller is the platform admin.

import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './auth';
import type { Role } from './auth';
import { getSupabase } from './supabase';

export interface Scope {
  uid: string;
  role: Role;
  /** The company this request works on. */
  companyId: string;
  /** The signed-in person's own company (null for the platform admin). */
  ownCompanyId: string | null;
  email: string;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export interface Identity {
  uid: string;
  role: Role;
  ownCompanyId: string | null;
  email: string;
  name: string;
}

/** Verifies the cookie AND checks the database, so a deactivated login or suspended company is cut off at once. */
export async function getIdentity(req: Request): Promise<Identity> {
  const session = await verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (!session) throw new HttpError(401, 'Not signed in');

  if (session.role === 'platform_admin') {
    return { uid: session.uid, role: 'platform_admin', ownCompanyId: null, email: process.env.PLATFORM_ADMIN_EMAIL ?? 'admin', name: 'Platform admin' };
  }

  const db = getSupabase();
  const { data: user, error } = await db
    .from('dashboard_users')
    .select('id,company_id,email,name,role,active')
    .eq('id', session.uid)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!user || !user.active || user.company_id !== session.cid) throw new HttpError(401, 'Not signed in');

  const { data: company, error: companyError } = await db.from('companies').select('id,status').eq('id', user.company_id).maybeSingle();
  if (companyError) throw new HttpError(500, companyError.message);
  if (!company || company.status !== 'active') throw new HttpError(403, 'This company is suspended');

  const role: Role = user.role === 'viewer' ? 'viewer' : 'owner';
  return { uid: String(user.id), role, ownCompanyId: String(user.company_id), email: String(user.email), name: String(user.name ?? '') };
}

/**
 * @param requestedCompany company id asked for by the browser (query string or body). Honoured ONLY for the platform admin.
 * @param write true for anything that changes data: viewers are refused.
 */
export async function getScope(req: Request, opts: { requestedCompany?: unknown; write?: boolean } = {}): Promise<Scope> {
  const who = await getIdentity(req);
  if (opts.write && who.role === 'viewer') throw new HttpError(403, 'Your login is read-only');

  let companyId: string | null = who.ownCompanyId;
  if (who.role === 'platform_admin') {
    const asked = typeof opts.requestedCompany === 'string' ? opts.requestedCompany.trim() : '';
    if (!asked) throw new HttpError(400, 'Choose a company first');
    const { data, error } = await getSupabase().from('companies').select('id').eq('id', asked).maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, 'Company not found');
    companyId = asked;
  }
  if (!companyId) throw new HttpError(401, 'Not signed in');
  return { uid: who.uid, role: who.role, companyId, ownCompanyId: who.ownCompanyId, email: who.email };
}

export async function requireAdmin(req: Request): Promise<Identity> {
  const who = await getIdentity(req);
  if (who.role !== 'platform_admin') throw new HttpError(403, 'Only the platform admin can do this');
  return who;
}

/** Turns anything thrown inside a route into a JSON error response. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 });
}

/** True when the station belongs to the company. Use before touching any station-linked record. */
export async function stationInCompany(stationId: unknown, companyId: string): Promise<boolean> {
  if (typeof stationId !== 'string' && typeof stationId !== 'number') return false;
  const { data, error } = await getSupabase().from('stations').select('id').eq('id', stationId).eq('company_id', companyId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return Boolean(data);
}
