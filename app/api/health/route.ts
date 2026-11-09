import { NextResponse } from 'next/server';
import { callBackend } from '../../../lib/backend';
import { getIdentity, getScope, errorResponse } from '../../../lib/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Checks shown to company owners. The platform admin sees every check (server settings, tokens, tables).
const OWNER_CHECKS = ['Owner WhatsApp numbers', 'Station manager numbers', 'Scheduler', 'Recent errors', 'Messages that could not be delivered', 'WhatsApp message template'];

// System health: what is working, what is not, and what to do about it. Secret values are never included.
export async function GET(req: Request) {
  try {
    const who = await getIdentity(req);
    const url = new URL(req.url);
    const isAdmin = who.role === 'platform_admin';
    const asked = url.searchParams.get('company');

    let companyId: string | null = null;
    if (isAdmin) {
      if (asked) companyId = (await getScope(req, { requestedCompany: asked })).companyId; // validates it exists
    } else {
      companyId = who.ownCompanyId;
    }

    const result = await callBackend('/api/diagnostics', { company_id: companyId, live: isAdmin });
    if (result.status >= 400) return NextResponse.json(result.data, { status: result.status });
    if (isAdmin) return NextResponse.json({ ...result.data, isAdmin: true });

    const data = result.data ?? {};
    const checks = (Array.isArray(data.checks) ? data.checks : []).filter((c: any) => OWNER_CHECKS.some((name) => String(c?.name ?? '').startsWith(name)));
    return NextResponse.json({
      generated_at: data.generated_at,
      checks,
      recent_errors: (Array.isArray(data.recent_errors) ? data.recent_errors : []).map((e: any) => ({ at: e.at, source: e.source, message: e.message })),
      failed_messages: data.failed_messages ?? [],
      summary: { fail: checks.filter((c: any) => c.status === 'fail').length, warn: checks.filter((c: any) => c.status === 'warn').length },
      isAdmin: false,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
