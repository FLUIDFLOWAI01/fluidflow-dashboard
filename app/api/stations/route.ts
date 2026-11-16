import { NextResponse } from 'next/server';
import { callBackend } from '../../../lib/backend';
import { errorResponse, getScope } from '../../../lib/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_DISPLAYS = 12;

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

  const cleaned: Array<{ id: number; displays: Array<{ fuel: string; label: string | null }>; backMeter: boolean }> = [];
  for (const d of dispensers) {
    const id = Number(d?.id);
    const displays: any[] = Array.isArray(d?.displays) ? d.displays : [];
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Each dispenser needs a number' }, { status: 400 });
    }
    if (displays.length < 1 || displays.length > MAX_DISPLAYS) {
      return NextResponse.json({ error: `Dispenser ${id}: use between 1 and ${MAX_DISPLAYS} nozzle pairs (displays)` }, { status: 400 });
    }
    const items = displays.map((x) => ({ fuel: text(x?.fuel), label: text(x?.label) || null }));
    if (items.some((x) => !x.fuel || x.fuel.length > 40)) {
      return NextResponse.json({ error: `Dispenser ${id}: choose or type a fuel for every nozzle pair` }, { status: 400 });
    }
    cleaned.push({ id, displays: items, backMeter: d?.backMeter !== false });
  }

  try {
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });
    const result = await callBackend('/api/stations/provision', {
      company_id: scope.companyId,
      station_name: text(body.station_name),
      station_number: text(body.station_number),
      manager_phone: text(body.manager_phone),
      base_deadstock: deadstock,
      dispensers: cleaned,
    });
    return NextResponse.json(result.data, { status: result.status });
  } catch (e) {
    return errorResponse(e);
  }
}
