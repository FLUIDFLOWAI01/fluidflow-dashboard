import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { HttpError, errorResponse, getScope, stationInCompany } from '../../../lib/scope';
import { normGrade } from '../../../lib/fuel';
import { parseChart } from '../../../lib/tanks';

export const dynamic = 'force-dynamic';

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid request');
  }
}

const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

// Add a tank, or replace it if that tank number already exists at the station.
// { station_id, tank_number, fuel, capacity?, tolerance?, chart: "125, 4300\n130, 4650\n..." }
export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const stationId = typeof body?.station_id === 'string' ? body.station_id : '';
    if (!stationId || !(await stationInCompany(stationId, scope.companyId))) throw new HttpError(404, 'Station not found');

    const tankNumber = typeof body?.tank_number === 'string' || typeof body?.tank_number === 'number' ? String(body.tank_number).trim() : '';
    if (!tankNumber || tankNumber.length > 20) throw new HttpError(400, 'Enter the tank number');
    const fuel = typeof body?.fuel === 'string' ? body.fuel.trim() : '';
    const grade = normGrade(fuel);
    if (!fuel || !grade || fuel.length > 40) throw new HttpError(400, 'Choose the fuel this tank holds');
    const capacity = num(body?.capacity);
    const tolerance = num(body?.tolerance);
    if (Number.isNaN(capacity) || Number.isNaN(tolerance)) throw new HttpError(400, 'Capacity and tolerance must be numbers of 0 or more');

    const chart = parseChart(typeof body?.chart === 'string' ? body.chart : '');
    if (chart.error) throw new HttpError(400, chart.error);

    const { data, error } = await getSupabase()
      .from('tanks')
      .upsert(
        { station_id: stationId, tank_number: tankNumber, fuel_grade: grade, capacity_litres: capacity, tolerance_litres: tolerance, chart: chart.points },
        { onConflict: 'station_id,tank_number' },
      )
      .select('id');
    if (error) {
      const missing = /does not exist|schema cache/i.test(error.message);
      throw new HttpError(500, missing ? 'The tanks table is missing. Run agent_stage1.sql in Supabase first.' : error.message);
    }
    return NextResponse.json({ ok: true, id: data?.[0]?.id ?? null, points: chart.points.length });
  } catch (e) {
    return errorResponse(e);
  }
}

// Remove a tank: { id }
export async function DELETE(req: Request) {
  try {
    const body = await readBody(req);
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) throw new HttpError(400, 'A tank id is required');
    const db = getSupabase();
    const found = await db.from('tanks').select('id,station_id').eq('id', id).maybeSingle();
    if (found.error) throw new HttpError(500, found.error.message);
    if (!found.data || !(await stationInCompany(found.data.station_id, scope.companyId))) throw new HttpError(404, 'Tank not found');
    const { error } = await db.from('tanks').delete().eq('id', id);
    if (error) throw new HttpError(500, error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
