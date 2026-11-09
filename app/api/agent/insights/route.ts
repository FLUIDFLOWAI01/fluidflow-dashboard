import { NextResponse } from 'next/server';
import { callBackend } from '../../../../lib/backend';
import { errorResponse, getScope } from '../../../../lib/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Everything the AI Agent Control Centre shows: forecasts, banking, leads, ranking, suggestions, contacts, settings, recent messages.
// The company is decided here on the server (the signed cookie); the platform admin may pick one with ?company=<id>.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = await getScope(req, { requestedCompany: url.searchParams.get('company') });
    const result = await callBackend('/api/agent/insights', { company_id: scope.companyId });
    if (result.status >= 400) return NextResponse.json(result.data, { status: result.status });
    return NextResponse.json({
      ...result.data,
      access: { role: scope.role, canEdit: scope.role !== 'viewer', isAdmin: scope.ownCompanyId === null },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
