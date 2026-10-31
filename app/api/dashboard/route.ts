import { NextResponse } from 'next/server';
import { buildSnapshot } from '../../../lib/snapshot';
import { errorResponse, getScope } from '../../../lib/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = await getScope(req, { requestedCompany: url.searchParams.get('company') });
    const snapshot = await buildSnapshot(scope.companyId);
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const res = errorResponse(e);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}
