import { NextResponse } from 'next/server';
import { callBackend } from '../../../lib/backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const fuelGrade = typeof body?.fuel_grade === 'string' ? body.fuel_grade.trim() : '';
  const price = Number(body?.new_price);
  const scope = body?.target_scope === 'global' ? 'global' : body?.target_scope === 'specific' ? 'specific' : '';
  const targets: string[] = Array.isArray(body?.target_stations)
    ? body.target_stations.filter((s: unknown): s is string => typeof s === 'string' && s.trim() !== '')
    : [];

  if (!fuelGrade || fuelGrade.length > 40) return NextResponse.json({ error: 'Choose a fuel grade' }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0 || price > 10000) {
    return NextResponse.json({ error: 'Enter a price greater than 0' }, { status: 400 });
  }
  if (!scope) return NextResponse.json({ error: 'Choose a target scope' }, { status: 400 });
  if (scope === 'specific' && targets.length === 0) {
    return NextResponse.json({ error: 'Select at least one station' }, { status: 400 });
  }

  const result = await callBackend('/api/prices/update', {
    fuel_grade: fuelGrade,
    new_price: Math.round(price * 100) / 100,
    target_scope: scope,
    target_stations: scope === 'specific' ? targets : [],
  });
  return NextResponse.json(result.data, { status: result.status });
}
