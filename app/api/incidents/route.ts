import { NextResponse } from 'next/server';
import { callBackend } from '../../../lib/backend';
import { getSupabase } from '../../../lib/supabase';
import { HttpError, errorResponse, getScope, stationInCompany } from '../../../lib/scope';
import { buildSnapshot } from '../../../lib/snapshot';
import { normGrade } from '../../../lib/fuel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid request');
  }
}

// Ask the station manager (on WhatsApp) to verify a flagged tank mismatch: { station_id, fuel_grade }
// The numbers are worked out here on the server from the current stock check, never taken from the browser.
// This only asks questions. It does not change stock, cash or prices.
export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const stationId = typeof body?.station_id === 'string' ? body.station_id : '';
    const grade = normGrade(body?.fuel_grade);
    if (!stationId || !grade) throw new HttpError(400, 'Choose a station and fuel');

    const snap = await buildSnapshot(scope.companyId);
    const check = snap.stockChecks.find((c) => c.stationId === stationId && c.grade === grade);
    if (!check) throw new HttpError(404, 'No tank check found for that fuel');
    if (check.status !== 'flag') throw new HttpError(409, 'That fuel has no mismatch right now. ' + check.message);

    const result = await callBackend('/api/incidents/open', {
      company_id: scope.companyId,
      station_id: stationId,
      fuel_grade: grade,
      gap_litres: check.adjusted,
      tank_litres: check.dipLitres,
      book_litres: check.bookLitres,
      opened_by: scope.email,
    });
    return NextResponse.json(result.data, { status: result.status });
  } catch (e) {
    return errorResponse(e);
  }
}

// The owner closes an incident with a note: { id, note? }. Closing records the owner's decision only.
export async function PATCH(req: Request) {
  try {
    const body = await readBody(req);
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) throw new HttpError(400, 'An incident id is required');
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '';

    const db = getSupabase();
    const found = await db.from('incidents').select('id,station_id,status').eq('id', id).maybeSingle();
    if (found.error) throw new HttpError(500, found.error.message);
    if (!found.data || !(await stationInCompany(found.data.station_id, scope.companyId))) throw new HttpError(404, 'Incident not found');
    if (found.data.status === 'closed') throw new HttpError(409, 'This incident is already closed');

    const now = new Date().toISOString();
    const { error } = await db
      .from('incidents')
      .update({ status: 'closed', owner_note: note || null, resolved_at: now, updated_at: now, awaiting_note: false })
      .eq('id', id);
    if (error) throw new HttpError(500, error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
