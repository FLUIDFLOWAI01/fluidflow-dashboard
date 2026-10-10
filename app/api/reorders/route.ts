import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';

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
    const { data, error } = await getSupabase().from('reorder_requests').update({ status }).eq('id', id).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: 'Reorder alert not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 500 });
  }
}
