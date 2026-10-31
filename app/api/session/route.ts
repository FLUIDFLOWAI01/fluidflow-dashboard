import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { errorResponse, getIdentity } from '../../../lib/scope';

export const dynamic = 'force-dynamic';

// Who is signed in, and (for company logins) which company they belong to.
export async function GET(req: Request) {
  try {
    const who = await getIdentity(req);
    let companyName: string | null = null;
    if (who.ownCompanyId) {
      const { data } = await getSupabase().from('companies').select('name').eq('id', who.ownCompanyId).maybeSingle();
      companyName = data?.name ? String(data.name) : null;
    }
    return NextResponse.json(
      { role: who.role, email: who.email, name: who.name, companyId: who.ownCompanyId, companyName },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
