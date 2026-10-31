import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { HttpError, errorResponse, getIdentity, getScope } from '../../../lib/scope';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../../../lib/password';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_COLUMNS = 'id,email,name,role,active,created_at'; // never the password hash

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid request');
  }
}

// List the logins of one company. Company owners see their own company; the platform admin passes ?company=<id>.
export async function GET(req: Request) {
  try {
    const who = await getIdentity(req);
    if (who.role === 'viewer') throw new HttpError(403, 'Only owners can manage logins');
    const scope = await getScope(req, { requestedCompany: new URL(req.url).searchParams.get('company') });
    const { data, error } = await getSupabase().from('dashboard_users').select(SAFE_COLUMNS).eq('company_id', scope.companyId).order('created_at');
    if (error) throw new HttpError(500, error.message);
    return NextResponse.json({ users: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

// Add a login to the company: { email, name?, role: 'owner' | 'viewer', password }
export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const who = await getIdentity(req);
    if (who.role === 'viewer') throw new HttpError(403, 'Only owners can manage logins');
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = body?.role === 'viewer' ? 'viewer' : 'owner';
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address');
    if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

    const db = getSupabase();
    const exists = await db.from('dashboard_users').select('id').ilike('email', email.replace(/[%_]/g, (c: string) => `\\${c}`)).maybeSingle();
    if (exists.data) throw new HttpError(409, 'That email already has a login');

    const { data, error } = await db
      .from('dashboard_users')
      .insert({ company_id: scope.companyId, email, name: name || null, role, password_hash: hashPassword(password) })
      .select(SAFE_COLUMNS)
      .single();
    if (error) throw new HttpError(500, error.message);
    return NextResponse.json({ user: data });
  } catch (e) {
    return errorResponse(e);
  }
}

// Switch a login on/off or reset its password: { id, active?, password?, role? }
export async function PATCH(req: Request) {
  try {
    const body = await readBody(req);
    const who = await getIdentity(req);
    if (who.role === 'viewer') throw new HttpError(403, 'Only owners can manage logins');
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) throw new HttpError(400, 'A user id is required');

    const update: Record<string, unknown> = {};
    if (typeof body?.active === 'boolean') update.active = body.active;
    if (body?.role === 'owner' || body?.role === 'viewer') update.role = body.role;
    if (typeof body?.password === 'string' && body.password !== '') {
      if (body.password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      update.password_hash = hashPassword(body.password);
    }
    if (Object.keys(update).length === 0) throw new HttpError(400, 'Nothing to change');
    if (id === who.uid && (update.active === false || update.role === 'viewer')) {
      throw new HttpError(400, 'You cannot lock yourself out');
    }

    // company_id in the filter stops one company from editing another company's logins
    const { data, error } = await getSupabase()
      .from('dashboard_users')
      .update(update)
      .eq('id', id)
      .eq('company_id', scope.companyId)
      .select(SAFE_COLUMNS);
    if (error) throw new HttpError(500, error.message);
    if (!data || data.length === 0) throw new HttpError(404, 'User not found');
    return NextResponse.json({ user: data[0] });
  } catch (e) {
    return errorResponse(e);
  }
}
