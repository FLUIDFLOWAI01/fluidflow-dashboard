import { NextResponse } from 'next/server';
import { callBackend } from '../../../../lib/backend';

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

  const result = await callBackend('/api/stations/request-scan', { station_id: stationId });
  return NextResponse.json(result.data, { status: result.status });
}
