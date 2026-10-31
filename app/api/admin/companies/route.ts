import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { HttpError, errorResponse, requireAdmin } from '../../../../lib/scope';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../../../../lib/password';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid request');
  }
}

async function counts(table: string, column: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabase().from(table).select(`id,${column}`).order('id').range(from, from + 999);
    if (error) throw new HttpError(500, error.message);
    for (const r of (data ?? []) as any[]) out.set(String(r[column]), (out.get(String(r[column])) ?? 0) + 1);
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { data, error } = await getSupabase().from('companies').select('id,name,status,created_at').order('name');
    if (error) throw new HttpError(500, error.message);
    const stations = await counts('stations', 'company_id');
    const users = await counts('dashboard_users', 'company_id');
    const companies = (data ?? []).map((c: any) => ({
      id: String(c.id),
      name: String(c.name),
      status: String(c.status),
      createdAt: c.created_at ? String(c.created_at) : null,
      stations: stations.get(String(c.id)) ?? 0,
      users: users.get(String(c.id)) ?? 0,
    }));
    return NextResponse.json({ companies }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

// Create an OMC with its first owner login: { name, email, ownerName?, password }
export async function POST(req: Request) {
  let companyId: string | null = null;
  try {
    await requireAdmin(req);
    const body = await readBody(req);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim().slice(0, 80) : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!name) throw new HttpError(400, 'Enter the company name');
    if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email for the first owner');
    if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

    const db = getSupabase();
    const taken = await db.from('dashboard_users').select('id').ilike('email', email.replace(/[%_]/g, (c: string) => `\\${c}`)).maybeSingle();
    if (taken.data) throw new HttpError(409, 'That email already has a login');

    const company = await db.from('companies').insert({ name }).select('id,name,status').single();
    if (company.error) {
      const dup = /duplicate|unique/i.test(company.error.message);
      throw new HttpError(dup ? 409 : 500, dup ? 'A company with that name already exists' : company.error.message);
    }
    companyId = String(company.data.id);

    const user = await db
      .from('dashboard_users')
      .insert({ company_id: companyId, email, name: ownerName || null, role: 'owner', password_hash: hashPassword(password) });
    if (user.error) {
      await db.from('companies').delete().eq('id', companyId); // do not leave an empty company behind
      throw new HttpError(500, user.error.message);
    }
    return NextResponse.json({ company: { id: companyId, name, status: 'active' } });
  } catch (e) {
    return errorResponse(e);
  }
}

// Suspend or re-activate a company (suspended companies cannot sign in): { id, status: 'active' | 'suspended' }  or rename: { id, name }
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);
    const body = await readBody(req);
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) throw new HttpError(400, 'A company id is required');
    const update: Record<string, unknown> = {};
    if (body?.status === 'active' || body?.status === 'suspended') update.status = body.status;
    if (typeof body?.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 120);
    if (Object.keys(update).length === 0) throw new HttpError(400, 'Nothing to change');
    const { data, error } = await getSupabase().from('companies').update(update).eq('id', id).select('id');
    if (error) throw new HttpError(500, error.message);
    if (!data || data.length === 0) throw new HttpError(404, 'Company not found');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
