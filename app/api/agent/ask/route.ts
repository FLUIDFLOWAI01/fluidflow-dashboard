import { NextResponse } from 'next/server';
import { callBackend } from '../../../../lib/backend';
import { HttpError, errorResponse, getScope } from '../../../../lib/scope';
import { buildSnapshot } from '../../../../lib/snapshot';
import type { Snapshot } from '../../../../lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Turns the company's own snapshot into compact text for the model. Only this company's data is ever in `snap`.
function toContext(snap: Snapshot): string {
  const stations = snap.stations.map((s) => ({
    station: `${s.name} (${s.number})`,
    status: s.status,
    litresSoldToday: s.volumeToday,
    litresSoldYesterday: s.volumeYesterday,
    expectedSalesTodayGHS: s.expectedToday,
    bankedTodayGHS: s.bankedToday,
    unbankedCashGHS: s.unbanked,
    bankingState: s.bankingState,
    deadstockLimitLitres: s.deadstock,
    needsAttention: s.attention,
    stockByFuel: (snap.inventory[s.id] ?? []).map((i) => ({ fuel: i.label, bookStockLitres: i.bookStock, level: i.level })),
    pricesGHS: Object.fromEntries(Object.entries(snap.prices[s.id] ?? {}).map(([g, p]) => [g, p])),
    activeDeliveries: (snap.waybills[s.id] ?? [])
      .filter((w) => w.status.toLowerCase().startsWith('active'))
      .slice(0, 20)
      .map((w) => ({ fuel: w.fuel, deliveredLitres: w.volume, remainingLitres: w.remaining, date: w.date, expectedRevenueGHS: w.expectedRev, bankedGHS: w.bankedRev })),
    tanks: (snap.tanks[s.id] ?? []).map((t) => ({ tank: t.number, fuel: t.label, capacityLitres: t.capacity })),
    latestDipReadings: snap.dips[s.id] ?? [],
  }));
  const reorders = snap.reorders.slice(0, 30).map((r) => ({ station: r.stationName, fuel: r.product, status: r.status, at: r.createdAt, note: r.notes }));
  const checks = snap.stockChecks.map((c) => ({
    station: c.stationName,
    fuel: c.label,
    result: c.status,
    explanation: c.message,
    tankLitres: c.dipLitres,
    bookLitres: c.bookLitres,
    gapAfterBaselineLitres: c.adjusted,
    allowedGapLitres: c.tolerance,
  }));
  const incidents = snap.incidents.slice(0, 40).map((i) => ({
    station: i.stationName,
    fuel: i.label,
    stage: i.stage, // waiting = manager asked, unconfirmed = no reply for 12h, confirmed = manager says it is real, explained = manager gave a reason
    gapLitresWhenOpened: i.gap,
    gapLitresAfterFreshDip: i.redipGap,
    managerReason: i.managerReason,
    managerNote: i.managerNote,
    ownerNote: i.ownerNote,
    openedAt: i.openedAt,
  }));
  return JSON.stringify({ generatedAt: snap.generatedAt, stations, reorderAlerts: reorders, tankVsBookStockChecks: checks, stockIncidents: incidents }, null, 1);
}

// { question, history?: [{role:'user'|'assistant', text}] }
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid request');
    }
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) throw new HttpError(400, 'Type a question');
    if (question.length > 600) throw new HttpError(400, 'Please keep the question under 600 characters');
    // Asking questions only reads data, so read-only logins may use it.
    const scope = await getScope(req, { requestedCompany: body?.company_id });

    const history = Array.isArray(body?.history)
      ? body.history
          .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string')
          .slice(-6)
          .map((h: any) => ({ role: h.role, text: h.text.slice(0, 1500) }))
      : [];

    const snap = await buildSnapshot(scope.companyId);
    const result = await callBackend('/api/agent/ask', { company_id: scope.companyId, question, context: toContext(snap), history });
    return NextResponse.json(result.data, { status: result.status });
  } catch (e) {
    return errorResponse(e);
  }
}
