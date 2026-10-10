import { NextResponse } from 'next/server';
import { callBackend } from '../../../lib/backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Creates a station, its pumps and links the manager's WhatsApp number (all done by the backend).
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const deadstock = Number(body?.base_deadstock);
  const dispensers: any[] = Array.isArray(body?.dispensers) ? body.dispensers : [];

  if (!text(body?.station_name) || !text(body?.station_number)) {
    return NextResponse.json({ error: 'Station name and station number are required' }, { status: 400 });
  }
  if (!text(body?.manager_phone)) {
    return NextResponse.json({ error: "The manager's WhatsApp number is required" }, { status: 400 });
  }
  if (!Number.isFinite(deadstock) || deadstock < 0) {
    return NextResponse.json({ error: 'Base deadstock must be 0 or more' }, { status: 400 });
  }
  if (dispensers.length === 0 || dispensers.length > 60) {
    return NextResponse.json({ error: 'Add between 1 and 60 dispensers' }, { status: 400 });
  }

  const result = await callBackend('/api/stations/provision', {
    station_name: text(body.station_name),
    station_number: text(body.station_number),
    manager_phone: text(body.manager_phone),
    base_deadstock: deadstock,
    dispensers: dispensers.map((d) => ({
      id: Number(d?.id),
      type: text(d?.type),
      n1Fuel: text(d?.n1Fuel),
      n1Label: text(d?.n1Label),
      n2Fuel: text(d?.n2Fuel) || null,
      n2Label: text(d?.n2Label) || null,
    })),
  });
  return NextResponse.json(result.data, { status: result.status });
}
