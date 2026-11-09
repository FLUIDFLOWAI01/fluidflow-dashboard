import { NextResponse } from 'next/server';
import { callBackend } from '../../../../lib/backend';
import { HttpError, errorResponse, getScope } from '../../../../lib/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Only these actions exist. Anything else is refused before it reaches the backend.
const ACTIONS = new Set([
  'add_contact',
  'update_contact',
  'delete_contact',
  'test_message',
  'save_settings',
  'decide_proposal',
  'run_now',
  'send_summary_now',
]);

// { company_id? (platform admin only), action, ...fields }. Read-only logins are refused by getScope (write: true).
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid request');
    }
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!ACTIONS.has(action)) throw new HttpError(400, 'Unknown action');
    const scope = await getScope(req, { requestedCompany: body?.company_id, write: true });

    const result = await callBackend('/api/agent/manage', {
      company_id: scope.companyId,
      action,
      id: typeof body?.id === 'string' ? body.id : undefined,
      name: typeof body?.name === 'string' ? body.name : undefined,
      phone: typeof body?.phone === 'string' ? body.phone : undefined,
      active: typeof body?.active === 'boolean' ? body.active : undefined,
      daily_summary: typeof body?.daily_summary === 'boolean' ? body.daily_summary : undefined,
      alerts: typeof body?.alerts === 'boolean' ? body.alerts : undefined,
      approve: typeof body?.approve === 'boolean' ? body.approve : undefined,
      settings: body?.settings && typeof body.settings === 'object' ? body.settings : undefined,
      decided_by: `dashboard:${scope.email}`,
    });
    return NextResponse.json(result.data, { status: result.status });
  } catch (e) {
    return errorResponse(e);
  }
}
