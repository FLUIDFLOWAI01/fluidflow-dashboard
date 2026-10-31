import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { HttpError, errorResponse, getScope } from '../../../lib/scope';
import { buildSnapshot } from '../../../lib/snapshot';
import { normGrade } from '../../../lib/fuel';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// "Treat today's gap between the tank and the books as normal." The server works the gap out itself from the latest
// valid dip, so the browser cannot invent a number. { station_id, fuel_grade }
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid request');
    }
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const stationId = typeof body?.station_id === 'string' ? body.station_id : '';
    const grade = normGrade(body?.fuel_grade);
    if (!stationId || !grade) throw new HttpError(400, 'Choose a station and fuel');

    const snap = await buildSnapshot(scope.companyId);
    const check = snap.stockChecks.find((c) => c.stationId === stationId && c.grade === grade);
    if (!check) throw new HttpError(404, 'No tank check found for that fuel');
    if (check.difference === null || check.status === 'waiting' || check.status === 'no_dip' || check.status === 'out_of_chart') {
      throw new HttpError(409, 'There is no valid dip to compare yet. ' + check.message);
    }

    const { error } = await getSupabase()
      .from('stock_baselines')
      .upsert(
        { station_id: stationId, fuel_grade: grade, offset_litres: check.difference, set_at: new Date().toISOString() },
        { onConflict: 'station_id,fuel_grade' },
      );
    if (error) throw new HttpError(500, error.message);
    return NextResponse.json({ ok: true, offset: check.difference });
  } catch (e) {
    return errorResponse(e);
  }
}
