import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { errorResponse, getScope, stationInCompany, HttpError } from '../../../lib/scope';

export const dynamic = 'force-dynamic';

// The backend creates alerts as "Pending Verification". The executive can verify or dismiss them here.
const ALLOWED_STATUSES = ['Verified', 'Dismissed', 'Pending Verification'];

export async function PATCH(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const id = body?.id;
  const status = body?.status;
  if ((typeof id !== 'string' && typeof id !== 'number') || id === '') {
    return NextResponse.json({ error: 'A reorder id is required' }, { status: 400 });
  }
  if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
  }

  try {
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const db = getSupabase();

    // The alert must belong to one of THIS company's stations.
    const found = await db.from('reorder_requests').select('id,station_id').eq('id', id).maybeSingle();
    if (found.error) throw new HttpError(500, found.error.message);
    if (!found.data || !(await stationInCompany(found.data.station_id, scope.companyId))) {
      return NextResponse.json({ error: 'Reorder alert not found' }, { status: 404 });
    }

    const { error } = await db.from('reorder_requests').update({ status }).eq('id', id);
    if (error) throw new HttpError(500, error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
