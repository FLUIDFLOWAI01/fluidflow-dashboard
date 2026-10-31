import { NextResponse } from 'next/server';
import { callBackend } from '../../../../lib/backend';
import { errorResponse, getScope, stationInCompany } from '../../../../lib/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Asks the station manager (on WhatsApp) to photograph a new delivery waybill.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const stationId = typeof body?.station_id === 'string' ? body.station_id.trim() : '';
  if (!stationId) return NextResponse.json({ error: 'A station id is required' }, { status: 400 });

  try {
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    if (!(await stationInCompany(stationId, scope.companyId))) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }
    const result = await callBackend('/api/stations/request-scan', { company_id: scope.companyId, station_id: stationId });
    return NextResponse.json(result.data, { status: result.status });
  } catch (e) {
    return errorResponse(e);
  }
}
