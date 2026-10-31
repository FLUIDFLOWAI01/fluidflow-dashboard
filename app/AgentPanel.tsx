'use client';

import React, { useState } from 'react';
import { Droplets, Check, AlertTriangle, X } from 'lucide-react';
import type { IncidentView, Snapshot, StockCheckView } from '../lib/types';

const litresFmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

// Platform admin opens a company with /?company=<id>; company logins never need it.
function adminCompanyId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('company');
}

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  const company = adminCompanyId();
  const payload = company && body && typeof body === 'object' ? { ...(body as object), company_id: company } : body;
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (res.status === 401) window.location.href = '/login';
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

type Msg = { kind: 'ok' | 'err'; text: string };
type Turn = { role: 'user' | 'assistant'; text: string };

const STATUS_STYLE: Record<StockCheckView['status'], { label: string; cls: string }> = {
  ok: { label: 'Matches', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  flag: { label: 'MISMATCH', cls: 'bg-rose-500/10 border-rose-500/40 text-rose-400' },
  needs_baseline: { label: 'Set starting point', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  waiting: { label: 'Waiting for a new dip', cls: 'bg-slate-700/40 border-slate-600 text-slate-300' },
  no_dip: { label: 'No dip yet', cls: 'bg-slate-700/40 border-slate-600 text-slate-300' },
  out_of_chart: { label: 'Dip outside chart', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
};

const STAGE_STYLE: Record<IncidentView['stage'], { label: string; cls: string }> = {
  waiting: { label: 'Waiting for the manager', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  unconfirmed: { label: 'NOT confirmed (no reply)', cls: 'bg-slate-700/40 border-slate-600 text-slate-300' },
  confirmed: { label: 'CONFIRMED by the manager', cls: 'bg-rose-500/10 border-rose-500/40 text-rose-400' },
  explained: { label: 'Explained by the manager', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  closed: { label: 'Closed', cls: 'bg-slate-700/40 border-slate-600 text-slate-300' },
};

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${litresFmt(Math.abs(n))}`;
const when = (v: string | null) => (v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const SUGGESTIONS = [
  'Which stations need attention right now?',
  'How much unbanked cash is there across my stations?',
  'Which fuel is running lowest and where?',
  'Are there any tank mismatches I should worry about?',
];

export default function AgentPanel({ snapshot, reload }: { snapshot: Snapshot; reload: () => void }) {
  const stations = snapshot.stations;
  const checks = snapshot.stockChecks ?? [];
  const tanks = snapshot.tanks ?? {};

  // ----- ask the agent -----
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    const history = turns;
    setTurns([...history, { role: 'user', text: q }]);
    setQuestion('');
    try {
      const res = await send('/api/agent/ask', 'POST', { question: q, history });
      if (!res.ok) throw new Error(res.data?.error || 'The agent could not answer');
      setTurns((t) => [...t, { role: 'assistant', text: String(res.data?.answer ?? '') }]);
    } catch (e) {
      setAskError(errText(e));
    } finally {
      setAsking(false);
    }
  };

  // ----- baseline -----
  const [baselineBusy, setBaselineBusy] = useState<string | null>(null);
  const [checkMsg, setCheckMsg] = useState<Msg | null>(null);

  const acceptBaseline = async (c: StockCheckView) => {
    if (c.status === 'flag' && !window.confirm('This will treat the current gap as normal and clear the mismatch. Only do this if you are sure it is not a loss.')) return;
    const key = `${c.stationId}|${c.grade}`;
    setBaselineBusy(key);
    setCheckMsg(null);
    const res = await send('/api/baselines', 'POST', { station_id: c.stationId, fuel_grade: c.grade });
    setBaselineBusy(null);
    setCheckMsg(res.ok ? { kind: 'ok', text: `Saved the starting point for ${c.label} at ${c.stationName}.` } : { kind: 'err', text: res.data?.error || 'Could not save' });
    if (res.ok) reload();
  };

  // ----- incidents (the station manager verifies a flagged gap before anyone acts on it) -----
  const incidents = snapshot.incidents ?? [];
  const [incidentBusy, setIncidentBusy] = useState<string | null>(null);
  const activeFor = (c: StockCheckView) =>
    incidents.find((i) => i.stationId === c.stationId && i.grade === c.grade && (i.stage === 'waiting' || i.stage === 'unconfirmed' || i.stage === 'confirmed'));

  const askManager = async (c: StockCheckView) => {
    const key = `${c.stationId}|${c.grade}`;
    setIncidentBusy(key);
    setCheckMsg(null);
    const res = await send('/api/incidents', 'POST', { station_id: c.stationId, fuel_grade: c.grade });
    setIncidentBusy(null);
    setCheckMsg(res.ok
      ? { kind: 'ok', text: `The station manager at ${c.stationName} was asked on WhatsApp to take a fresh ${c.label} dip. Nothing will change until they answer.` }
      : { kind: 'err', text: res.data?.error || 'Could not contact the manager' });
    if (res.ok) reload();
  };

  const closeIncident = async (i: IncidentView) => {
    const note = window.prompt(`Close this ${i.label} incident at ${i.stationName}? Add a note for your records (optional):`, '');
    if (note === null) return;
    setIncidentBusy(i.id);
    const res = await send('/api/incidents', 'PATCH', { id: i.id, note });
    setIncidentBusy(null);
    setCheckMsg(res.ok ? { kind: 'ok', text: 'Incident closed.' } : { kind: 'err', text: res.data?.error || 'Could not close the incident' });
    if (res.ok) reload();
  };

  // ----- tank setup -----
  const [tankStation, setTankStation] = useState('');
  const [tankNumber, setTankNumber] = useState('');
  const [tankFuel, setTankFuel] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [tankTolerance, setTankTolerance] = useState('');
  const [tankChart, setTankChart] = useState('');
  const [tankBusy, setTankBusy] = useState(false);
  const [tankMsg, setTankMsg] = useState<Msg | null>(null);

  const saveTank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tankBusy) return;
    setTankBusy(true);
    setTankMsg(null);
    const res = await send('/api/tanks', 'POST', {
      station_id: tankStation || stations[0]?.id,
      tank_number: tankNumber,
      fuel: tankFuel,
      capacity: tankCapacity,
      tolerance: tankTolerance,
      chart: tankChart,
    });
    setTankBusy(false);
    if (!res.ok) {
      setTankMsg({ kind: 'err', text: res.data?.error || 'Could not save the tank' });
      return;
    }
    setTankMsg({ kind: 'ok', text: res.data?.points ? `Tank ${tankNumber} saved with ${res.data.points} chart lines.` : `Tank ${tankNumber} saved. Its dipstick reading will be read as litres.` });
    setTankNumber('');
    setTankChart('');
    reload();
  };

  const removeTank = async (id: string, label: string) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    const res = await send('/api/tanks', 'DELETE', { id });
    setTankMsg(res.ok ? { kind: 'ok', text: `${label} removed.` } : { kind: 'err', text: res.data?.error || 'Could not remove' });
    if (res.ok) reload();
  };

  const input = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400';
  const label = 'block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5';
  const allTanks = stations.flatMap((s) => (tanks[s.id] ?? []).map((t) => ({ ...t, stationName: s.name })));

  return (
    <div className="space-y-6">
      {/* ---- tank vs book stock ---- */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-bold text-white flex items-center gap-2">
            <Droplets className="w-4 h-4 text-emerald-400" /> Tank vs book stock check
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            After a shift closes, the attendant sends the dipstick photo. The agent reads the dip as litres (or converts it with the tank's chart, if you added one) and compares it
            with the stock the delivery records say should be there. A big gap can mean a leak, theft, or sales or deliveries that were not recorded.
          </p>
        </div>
        {checkMsg && <p className={checkMsg.kind === 'ok' ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'} role="alert">{checkMsg.text}</p>}
        {checks.length === 0 ? (
          <p className="text-slate-400 text-sm">No tanks set up yet. Add each tank below with the fuel it holds.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {checks.map((c) => {
              const st = STATUS_STYLE[c.status];
              const key = `${c.stationId}|${c.grade}`;
              return (
                <li key={key} className="py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm">
                      {c.stationName} · {c.label} <span className="text-slate-400 font-normal">(tank {c.tanks.join(', ')})</span>
                    </p>
                    <p className="text-slate-300 text-sm mt-0.5">{c.message}</p>
                    {c.dipLitres !== null && (
                      <p className="text-slate-500 text-xs mt-1">
                        Tank {litresFmt(c.dipLitres)} L · Books {litresFmt(c.bookLitres)} L
                        {c.baseline !== null ? ` · Starting gap ${litresFmt(c.baseline)} L` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>
                      {c.status === 'flag' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                      {st.label}
                    </span>
                    {c.status === 'flag' && !activeFor(c) && (
                      <button
                        onClick={() => askManager(c)}
                        disabled={incidentBusy === key}
                        className="text-xs bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        {incidentBusy === key ? 'Sending…' : 'Ask the manager to verify'}
                      </button>
                    )}
                    {(c.status === 'needs_baseline' || c.status === 'flag') && c.difference !== null && (
                      <button
                        onClick={() => acceptBaseline(c)}
                        disabled={baselineBusy === key}
                        className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        {c.status === 'flag' ? 'Treat gap as normal' : 'Accept as starting point'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- incidents ---- */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Stock incidents
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            A mismatch is only a flag: underground problems, a wrong dip or an unrecorded delivery can all cause one. The station manager is asked to dip
            again and then to confirm on WhatsApp whether it is a real problem. Treat a gap as a loss only when it says CONFIRMED.
          </p>
        </div>
        {incidents.length === 0 ? (
          <p className="text-slate-400 text-sm">No incidents. When a tank check shows a mismatch, use "Ask the manager to verify" above.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {incidents.map((i) => {
              const st = STAGE_STYLE[i.stage];
              const open = i.stage === 'waiting' || i.stage === 'unconfirmed' || i.stage === 'confirmed';
              return (
                <li key={i.id} className="py-3 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-white font-semibold text-sm">
                      {i.stationName} · {i.label}
                      <span className="text-slate-400 font-normal"> · opened {when(i.openedAt)}{i.openedBy ? ` by ${i.openedBy}` : ''}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                      {open && (
                        <button onClick={() => closeIncident(i)} disabled={incidentBusy === i.id} className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 disabled:opacity-50">
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs">
                    {i.gap !== null ? `Gap when flagged: ${signed(i.gap)} L` : ''}
                    {i.redipGap !== null ? ` · After the manager's fresh dip: ${signed(i.redipGap)} L (tank ${litresFmt(i.redipTankLitres ?? 0)} L, books ${litresFmt(i.redipBookLitres ?? 0)} L)` : ''}
                  </p>
                  {i.stage === 'waiting' && <p className="text-slate-300 text-sm">The manager has been asked to dip again and confirm. Do not act yet.</p>}
                  {i.stage === 'unconfirmed' && <p className="text-slate-300 text-sm">The manager has not answered for 12 hours, so this is still unverified. Phone them before acting.</p>}
                  {i.managerReason && <p className="text-slate-300 text-sm">Manager's explanation: {i.managerReason}</p>}
                  {i.managerNote && <p className="text-slate-300 text-sm">Manager's note: {i.managerNote}</p>}
                  {i.ownerNote && <p className="text-slate-400 text-xs">Your note: {i.ownerNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- ask ---- */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-bold text-white">Ask FluidFlow AI</h2>
          <p className="text-slate-400 text-xs mt-1">
            Ask about your own stations in plain English. It only reads your data, never changes anything, and says so when the data does not answer a question.
          </p>
        </div>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={asking} className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1.5 disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <p className={`max-w-[85%] whitespace-pre-wrap text-sm rounded-2xl px-4 py-2.5 ${t.role === 'user' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-slate-800 text-slate-100'}`}>{t.text}</p>
            </div>
          ))}
          {asking && <p className="text-slate-400 text-sm">Thinking…</p>}
          {askError && <p className="text-rose-400 text-sm" role="alert">{askError}</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={600}
            placeholder="e.g. Which station sold the most diesel today?"
            className={input}
          />
          <button type="submit" disabled={asking || !question.trim()} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 rounded-xl">
            Ask
          </button>
          {turns.length > 0 && (
            <button type="button" onClick={() => { setTurns([]); setAskError(null); }} className="text-xs border border-slate-700 rounded-xl px-3 hover:bg-slate-800" title="Start a new conversation">
              New
            </button>
          )}
        </form>
      </section>

      {/* ---- tank setup ---- */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-bold text-white">Tanks</h2>
          <p className="text-slate-400 text-xs mt-1">
            Give each tank the number attendants type with the dipstick photo, and the fuel it holds. If the dipstick shows litres, leave the chart empty.
            Only add a calibration chart (one line per reading: dip, a comma, litres) if the dipstick shows a length instead of litres. Saving a tank number that already exists replaces it.
          </p>
        </div>
        {stations.length === 0 ? (
          <p className="text-slate-400 text-sm">Add a station first.</p>
        ) : (
          <form onSubmit={saveTank} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="t-station">Station</label>
              <select id="t-station" className={input} value={tankStation || stations[0].id} onChange={(e) => setTankStation(e.target.value)}>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="t-number">Tank number (as attendants type it)</label>
              <input id="t-number" className={input} value={tankNumber} onChange={(e) => setTankNumber(e.target.value)} placeholder="1" />
            </div>
            <div>
              <label className={label} htmlFor="t-fuel">Fuel in this tank</label>
              <input id="t-fuel" list="agent-fuels" className={input} value={tankFuel} onChange={(e) => setTankFuel(e.target.value)} placeholder="Diesel" />
              <datalist id="agent-fuels">
                {snapshot.fuels.map((f) => <option key={f.grade} value={f.label} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="t-cap">Capacity (L)</label>
                <input id="t-cap" inputMode="decimal" className={input} value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)} placeholder="30000" />
              </div>
              <div>
                <label className={label} htmlFor="t-tol">Allowed gap (L)</label>
                <input id="t-tol" inputMode="decimal" className={input} value={tankTolerance} onChange={(e) => setTankTolerance(e.target.value)} placeholder="auto" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="t-chart">Calibration chart (optional, dip, litres)</label>
              <textarea
                id="t-chart"
                rows={7}
                className={input + ' font-mono'}
                value={tankChart}
                onChange={(e) => setTankChart(e.target.value)}
                placeholder={'10, 450\n20, 1210\n30, 2300\n40, 3650'}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-4">
              <button type="submit" disabled={tankBusy || !tankNumber.trim() || !tankFuel.trim()} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl">
                {tankBusy ? 'Saving…' : 'Save tank'}
              </button>
              {tankMsg && <p className={tankMsg.kind === 'ok' ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'} role="alert">{tankMsg.text}</p>}
            </div>
          </form>
        )}
        {allTanks.length > 0 && (
          <ul className="divide-y divide-slate-800 border-t border-slate-800">
            {allTanks.map((t) => (
              <li key={t.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-200">
                  {t.stationName} · Tank {t.number} · {t.label}
                  <span className="text-slate-500"> · {t.chartPoints > 0 ? `${t.chartPoints} chart lines` : 'reads litres directly'}{t.capacity ? ` · ${litresFmt(t.capacity)} L` : ''}</span>
                </span>
                <button onClick={() => removeTank(t.id, `Tank ${t.number} at ${t.stationName}`)} className="text-slate-400 hover:text-rose-400" aria-label="Remove tank">
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
