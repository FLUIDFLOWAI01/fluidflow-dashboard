'use client';

// AI Agent Control Centre: everything the agent sees and does, on one page.
// Open it at /agent (platform admin: /agent?company=<company id>).

import { useCallback, useEffect, useState } from 'react';

// ---------- shapes returned by the server ----------
interface Forecast {
  station_id: string;
  station_name: string;
  label: string;
  stock_litres: number;
  stock_source: string | null;
  rate_per_day: number;
  days_left: number;
  runout_on: string;
  level: 'critical' | 'soon' | 'ok';
  confidence: 'high' | 'medium' | 'low';
  history_days: number;
  suggest_litres: number | null;
  reorder_pending: boolean;
}
interface Banking {
  station_id: string;
  station_name: string;
  unbanked: number;
  hours_since_close: number | null;
  stage: number;
  overbanked: boolean;
}
interface Lead {
  key: string;
  severity: 'high' | 'watch' | 'info';
  station_name: string;
  title: string;
  detail: string;
  at: string | null;
}
interface BenchRow {
  rank: number;
  station_id: string;
  station_name: string;
  litres_per_day: number;
  vs_median_pct: number | null;
  sales_per_day: number;
  shifts_7d: number;
  avg_hours_to_bank: number | null;
  gaps_30d: number;
  min_days_left: number | null;
  unbanked: number;
}
interface Proposal {
  id: string;
  code: string;
  title: string;
  detail: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  decided_by?: string | null;
  result?: string | null;
}
interface Contact {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  daily_summary: boolean;
  alerts: boolean;
}
interface Settings {
  summary_hour: number;
  banking_chase_hours: number;
  banking_min_amount: number;
  lead_time_days: number;
  cover_days: number;
  auto_verify: boolean;
  agent_enabled: boolean;
}
interface Insights {
  generated_at: string;
  settings: Settings;
  contacts: Contact[];
  forecasts: Forecast[];
  banking: Banking[];
  leads: Lead[];
  benchmark: { stations: BenchRow[]; highlights: string[]; median_litres_per_day: number; total_litres_7d: number; total_sales_7d: number };
  proposals: { pending: Proposal[]; recent: Proposal[] };
  notifications: { id: string; kind: string; title: string | null; to: string; status: string; via: string | null; error: string | null; at: string }[];
  events: { level: string; source: string; message: string; at: string }[];
  health: {
    scheduler_last_run: string | null;
    scheduler_minutes_ago: number | null;
    scheduler_ok: boolean | null;
    failed_messages_24h: number;
    waiting_for_reply: number;
    template_configured: boolean;
    cron_configured: boolean;
    openai_configured: boolean;
  };
  access: { role: string; canEdit: boolean; isAdmin: boolean };
}
interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix: string;
}
interface Health {
  generated_at: string;
  checks: HealthCheck[];
  recent_errors: { at: string; source: string; message: string; detail?: unknown }[];
  failed_messages: { at: string; kind: string; to: string; error: string }[];
  summary: { fail: number; warn: number };
  isAdmin: boolean;
}

// ---------- small helpers ----------
const n0 = (v: number | null | undefined): string => (v === null || v === undefined ? '-' : Math.round(v).toLocaleString('en-GB'));
const n1 = (v: number | null | undefined): string => (v === null || v === undefined ? '-' : v.toLocaleString('en-GB', { maximumFractionDigits: 1 }));
const money = (v: number | null | undefined): string => (v === null || v === undefined ? '-' : `GHS ${Math.round(v).toLocaleString('en-GB')}`);
const when = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
};

function companyParam(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('company') ?? '';
}

async function api(path: string, method: 'GET' | 'POST', body?: unknown): Promise<any> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Please sign in again');
  }
  if (!res.ok) throw new Error(data?.error || data?.detail || `Something went wrong (${res.status})`);
  return data ?? {};
}

const card = 'bg-slate-900 border border-slate-800 rounded-xl p-5';
const th = 'text-left text-xs uppercase tracking-wide text-slate-500 font-medium py-2 pr-4';
const td = 'py-2 pr-4 text-sm text-slate-300 align-top';
const btn = 'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20`;
const btnNeutral = `${btn} bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700`;
const btnDanger = `${btn} bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20`;
const input = 'bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 w-full focus:outline-none focus:border-emerald-500';

function Badge(props: { tone: 'red' | 'amber' | 'green' | 'slate' | 'blue'; children: any }) {
  const tones: Record<string, string> = {
    red: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    blue: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${tones[props.tone]}`}>{props.children}</span>;
}

function Section(props: { title: string; hint?: string; right?: any; children: any }) {
  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{props.title}</h2>
          {props.hint && <p className="text-sm text-slate-400 mt-1">{props.hint}</p>}
        </div>
        {props.right}
      </div>
      {props.children}
    </section>
  );
}

export default function AgentPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string>('');
  const [flash, setFlash] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [form, setForm] = useState<Settings | null>(null);

  const company = companyParam();
  const q = company ? `?company=${encodeURIComponent(company)}` : '';

  const load = useCallback(async () => {
    try {
      const d: Insights = await api(`/api/agent/insights${q}`, 'GET');
      setData(d);
      setForm((prev: Settings | null) => prev ?? d.settings);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [q]);

  const loadHealth = useCallback(async () => {
    setBusy('health');
    try {
      setHealth(await api(`/api/health${q}`, 'GET'));
      setHealthError('');
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : 'Could not run the checks');
    } finally {
      setBusy('');
    }
  }, [q]);

  useEffect(() => {
    load();
    loadHealth();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load, loadHealth]);

  const act = async (key: string, action: string, extra: Record<string, unknown> = {}, okText?: string) => {
    setBusy(key);
    setFlash(null);
    try {
      const res = await api('/api/agent/manage', 'POST', { company_id: company || undefined, action, ...extra });
      const text = okText ?? (typeof res?.result === 'string' ? res.result : 'Done');
      setFlash({ tone: res?.status === 'failed' || res?.delivered === false ? 'bad' : 'ok', text: res?.detail && action === 'test_message' ? `${text}: ${res.detail}` : text });
      await load();
    } catch (e) {
      setFlash({ tone: 'bad', text: e instanceof Error ? e.message : 'That did not work' });
    } finally {
      setBusy('');
    }
  };

  const canEdit = Boolean(data?.access.canEdit);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
        <p className="text-slate-400">{error ? `Could not load the AI Agent: ${error}` : 'Loading the AI Agent...'}</p>
        {error && (
          <button className={`${btnNeutral} mt-4`} onClick={load}>
            Try again
          </button>
        )}
        <p className="mt-6"><a className="text-emerald-400 underline" href="/">Back to the dashboard</a></p>
      </div>
    );
  }

  const urgent = data.forecasts.filter((f: Forecast) => f.level !== 'ok');
  const failedChecks = health ? health.summary.fail : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Agent Control Centre</h1>
          <p className="text-sm text-slate-400">Updated {when(data.generated_at)}. Refreshes every minute.</p>
        </div>
        <div className="flex gap-2">
          <a className={btnNeutral} href="/">Back to dashboard</a>
          <button className={btnNeutral} onClick={() => { load(); loadHealth(); }}>Refresh</button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {error && <div role="alert" className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm rounded-xl px-4 py-3">Could not refresh: {error}. Showing the last data received.</div>}
        {flash && (
          <div role="status" className={`text-sm rounded-xl px-4 py-3 border ${flash.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
            {flash.text}
          </div>
        )}
        {failedChecks > 0 && (
          <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl px-4 py-3">
            {failedChecks} system check{failedChecks === 1 ? '' : 's'} failing. See System health at the bottom of this page for what to do.
          </div>
        )}

        {/* ---------- waiting for the owner ---------- */}
        <Section title="Waiting for your OK" hint="The agent never acts on money or stock by itself. It suggests, you decide. You can also answer on WhatsApp: APPROVE or REJECT followed by the code.">
          {data.proposals.pending.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing is waiting for you.</p>
          ) : (
            <ul className="space-y-3">
              {data.proposals.pending.map((p: Proposal) => (
                <li key={p.id} className="border border-slate-800 rounded-lg p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-2xl">
                    <p className="text-white font-medium">{p.title} <Badge tone="blue">Code {p.code}</Badge></p>
                    {p.detail && <p className="text-sm text-slate-400 mt-1">{p.detail}</p>}
                    <p className="text-xs text-slate-500 mt-1">Suggested {when(p.created_at)}{p.expires_at ? `, expires ${when(p.expires_at)}` : ''}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button className={btnPrimary} disabled={busy !== ''} onClick={() => act(`p-${p.id}`, 'decide_proposal', { id: p.id, approve: true })}>Approve</button>
                      <button className={btnDanger} disabled={busy !== ''} onClick={() => act(`p-${p.id}`, 'decide_proposal', { id: p.id, approve: false })}>Reject</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.proposals.recent.length > 0 && (
            <details className="mt-4 text-sm text-slate-400">
              <summary className="cursor-pointer text-slate-300">Recent decisions</summary>
              <ul className="mt-2 space-y-1">
                {data.proposals.recent.map((p: Proposal) => (
                  <li key={p.id}>
                    <Badge tone={p.status === 'executed' ? 'green' : p.status === 'failed' ? 'red' : 'slate'}>{p.status}</Badge> {p.title}
                    {p.result ? <span className="text-slate-500"> - {p.result}</span> : null}
                    {p.decided_by ? <span className="text-slate-600"> ({p.decided_by})</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>

        {/* ---------- fuel forecast ---------- */}
        <Section title="Fuel forecast and reorders" hint="How long each fuel will last at the recent selling rate, and how much to order. Based on the tank dip when there is one, otherwise on recorded deliveries.">
          {data.forecasts.length === 0 ? (
            <p className="text-sm text-slate-400">No forecast yet. It appears once a station has closed a few shifts and has deliveries or dips recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr><th className={th}>Station</th><th className={th}>Fuel</th><th className={th}>Stock now</th><th className={th}>Sells per day</th><th className={th}>Lasts</th><th className={th}>Suggested order</th><th className={th}>Confidence</th></tr>
                </thead>
                <tbody>
                  {data.forecasts.map((f: Forecast) => (
                    <tr key={`${f.station_id}-${f.label}`} className="border-t border-slate-800">
                      <td className={td}>{f.station_name}</td>
                      <td className={td}>{f.label}</td>
                      <td className={td}>{n0(f.stock_litres)} L<div className="text-xs text-slate-500">{f.stock_source}</div></td>
                      <td className={td}>{n0(f.rate_per_day)} L</td>
                      <td className={td}>
                        <Badge tone={f.level === 'critical' ? 'red' : f.level === 'soon' ? 'amber' : 'green'}>{n1(f.days_left)} days</Badge>
                        <div className="text-xs text-slate-500 mt-1">around {f.runout_on}</div>
                      </td>
                      <td className={td}>{f.reorder_pending ? <Badge tone="blue">Reorder alert already raised</Badge> : f.suggest_litres ? `${n0(f.suggest_litres)} L` : '-'}</td>
                      <td className={td}><Badge tone={f.confidence === 'high' ? 'green' : f.confidence === 'medium' ? 'amber' : 'slate'}>{f.confidence}</Badge><div className="text-xs text-slate-500 mt-1">{n0(f.history_days)} days of sales</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {urgent.length > 0 && <p className="text-xs text-slate-500 mt-3">Suggested orders cover the delivery time plus a safety day plus the cover days from the settings below, and never more than the tank can hold.</p>}
        </Section>

        {/* ---------- banking ---------- */}
        <Section title="Banking" hint="Cash from closed shifts that has not been banked. The station manager is reminded first; you are told if it drags on.">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Station</th><th className={th}>Unbanked</th><th className={th}>Since last shift closed</th><th className={th}>Status</th></tr></thead>
              <tbody>
                {data.banking.map((b: Banking) => (
                  <tr key={b.station_id} className="border-t border-slate-800">
                    <td className={td}>{b.station_name}</td>
                    <td className={td}>{money(b.unbanked)}</td>
                    <td className={td}>{b.hours_since_close === null ? '-' : `${n0(b.hours_since_close)} hours`}</td>
                    <td className={td}>
                      {b.overbanked ? <Badge tone="amber">Deposits exceed sales</Badge> : b.stage === 2 ? <Badge tone="red">Overdue - owner alerted</Badge> : b.stage === 1 ? <Badge tone="amber">Manager reminded</Badge> : <Badge tone="green">On track</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---------- loss detective ---------- */}
        <Section title="Leads to look into" hint="Patterns the agent noticed. These are leads, not conclusions: a quiet hour, a broken pump or a late delivery can look the same in the numbers. A stock gap only counts as a real problem when the station manager confirms it.">
          {data.leads.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing unusual found. The detective needs a few weeks of shifts to learn what normal looks like for each station.</p>
          ) : (
            <ul className="space-y-3">
              {data.leads.slice(0, 15).map((l: Lead) => (
                <li key={l.key} className="border border-slate-800 rounded-lg p-4">
                  <p className="text-white font-medium">
                    <Badge tone={l.severity === 'high' ? 'red' : l.severity === 'watch' ? 'amber' : 'slate'}>{l.severity === 'high' ? 'Look soon' : l.severity === 'watch' ? 'Keep an eye on' : 'For information'}</Badge>{' '}
                    {l.station_name}: {l.title}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">{l.detail}</p>
                  <p className="text-xs text-slate-500 mt-1">{when(l.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ---------- head office ---------- */}
        <Section title="Head office: how the stations compare" hint="Last 7 days. Ranked by litres sold per day.">
          {data.benchmark.stations.length === 0 ? (
            <p className="text-sm text-slate-400">No stations yet.</p>
          ) : (
            <>
              <p className="text-sm text-slate-300 mb-3">
                Company total: <strong className="text-white">{n0(data.benchmark.total_litres_7d)} L</strong> and <strong className="text-white">{money(data.benchmark.total_sales_7d)}</strong> in 7 days.
              </p>
              {data.benchmark.highlights.length > 0 && (
                <ul className="mb-3 text-sm text-slate-300 list-disc pl-5 space-y-1">
                  {data.benchmark.highlights.map((h: string) => <li key={h}>{h}</li>)}
                </ul>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className={th}>#</th><th className={th}>Station</th><th className={th}>Litres per day</th><th className={th}>Against the middle</th><th className={th}>Sales per day</th><th className={th}>Hours to bank</th><th className={th}>Stock gaps (30 days)</th><th className={th}>Fuel lasts</th></tr></thead>
                  <tbody>
                    {data.benchmark.stations.map((r: BenchRow) => (
                      <tr key={r.station_id} className="border-t border-slate-800">
                        <td className={td}>{r.rank}</td>
                        <td className={td}>{r.station_name}</td>
                        <td className={td}>{n0(r.litres_per_day)}</td>
                        <td className={td}>{r.vs_median_pct === null ? '-' : <span className={r.vs_median_pct >= 0 ? 'text-emerald-400' : 'text-amber-400'}>{r.vs_median_pct >= 0 ? '+' : ''}{r.vs_median_pct}%</span>}</td>
                        <td className={td}>{money(r.sales_per_day)}</td>
                        <td className={td}>{r.avg_hours_to_bank === null ? '-' : n0(r.avg_hours_to_bank)}</td>
                        <td className={td}>{r.gaps_30d}</td>
                        <td className={td}>{r.min_days_left === null ? '-' : `${n1(r.min_days_left)} days`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>

        {/* ---------- WhatsApp contacts and settings ---------- */}
        <Section title="WhatsApp alerts" hint="Owners listed here get the daily summary, alerts and approval requests on WhatsApp, and can ask the AI questions by messaging the bot. Use a number that is NOT a station manager's.">
          {data.contacts.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No owner numbers yet. Add one to start receiving messages.</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full">
                <thead><tr><th className={th}>Name</th><th className={th}>WhatsApp</th><th className={th}>Daily summary</th><th className={th}>Alerts</th><th className={th}>Active</th><th className={th}></th></tr></thead>
                <tbody>
                  {data.contacts.map((c: Contact) => (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className={td}>{c.name}</td>
                      <td className={td}>{c.phone}</td>
                      {(['daily_summary', 'alerts', 'active'] as const).map((field) => (
                        <td key={field} className={td}>
                          <input type="checkbox" checked={c[field]} disabled={!canEdit || busy !== ''} onChange={() => act(`c-${c.id}`, 'update_contact', { id: c.id, [field]: !c[field] }, 'Saved')} />
                        </td>
                      ))}
                      <td className={td}>
                        {canEdit && (
                          <div className="flex gap-2">
                            <button className={btnNeutral} disabled={busy !== ''} onClick={() => act(`t-${c.id}`, 'test_message', { id: c.id })}>Send test</button>
                            <button className={btnDanger} disabled={busy !== ''} onClick={() => { if (window.confirm(`Remove ${c.name}?`)) act(`d-${c.id}`, 'delete_contact', { id: c.id }, 'Removed'); }}>Remove</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canEdit && (
            <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (newName.trim() && newPhone.trim()) { act('add', 'add_contact', { name: newName, phone: newPhone }, 'Owner number added. Press "Send test" to check it works.'); setNewName(''); setNewPhone(''); } }}>
              <label className="text-sm text-slate-400">Name<input className={`${input} mt-1`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ama Mensah" /></label>
              <label className="text-sm text-slate-400">WhatsApp number<input className={`${input} mt-1`} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="024 123 4567" /></label>
              <button className={btnPrimary} type="submit" disabled={busy !== ''}>Add owner number</button>
            </form>
          )}

          {form && (
            <div className="mt-6 border-t border-slate-800 pt-5">
              <h3 className="text-white font-medium mb-3">Agent settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  ['summary_hour', 'Daily summary at (hour, Ghana time, 0-23)'],
                  ['banking_chase_hours', 'Remind about banking after (hours)'],
                  ['banking_min_amount', 'Ignore unbanked cash below (GHS)'],
                  ['lead_time_days', 'A fuel order takes (days)'],
                  ['cover_days', 'A new order should cover (days of sales)'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="text-sm text-slate-400">{label}
                    <input className={`${input} mt-1`} type="number" step="any" disabled={!canEdit} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value === '' ? 0 : Number(e.target.value) })} />
                  </label>
                ))}
                <label className="text-sm text-slate-400 flex items-center gap-2 mt-6">
                  <input type="checkbox" disabled={!canEdit} checked={form.auto_verify} onChange={(e) => setForm({ ...form, auto_verify: e.target.checked })} />
                  Ask the station manager to verify a stock gap automatically
                </label>
                <label className="text-sm text-slate-400 flex items-center gap-2 mt-6">
                  <input type="checkbox" disabled={!canEdit} checked={form.agent_enabled} onChange={(e) => setForm({ ...form, agent_enabled: e.target.checked })} />
                  Agent switched on (turn off to stop all scheduled messages)
                </label>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button className={btnPrimary} disabled={busy !== ''} onClick={() => act('settings', 'save_settings', { settings: form }, 'Settings saved')}>Save settings</button>
                  <button className={btnNeutral} disabled={busy !== ''} onClick={() => act('summary', 'send_summary_now', {}, 'Summary sent. Check WhatsApp.')}>Send me today&apos;s summary now</button>
                  <button className={btnNeutral} disabled={busy !== ''} onClick={() => act('run', 'run_now', {}, 'The agent ran. Check the activity log below.')}>Run the agent now</button>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ---------- activity ---------- */}
        <Section title="Recent messages and activity" hint="Every WhatsApp message the agent sent, and what happened to it.">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Messages</h3>
              {data.notifications.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {data.notifications.map((n) => (
                    <li key={n.id} className="border-t border-slate-800 pt-2">
                      <Badge tone={n.status === 'sent' || n.status === 'flushed' ? 'green' : n.status === 'awaiting_reply' ? 'blue' : n.status === 'queued' ? 'amber' : 'red'}>{n.status === 'awaiting_reply' ? 'waiting for their reply' : n.status}</Badge>{' '}
                      <span className="text-slate-300">{n.title || n.kind}</span> <span className="text-slate-500">to {n.to} - {when(n.at)}</span>
                      {n.error && <div className="text-xs text-rose-300 mt-1">{n.error}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Agent log</h3>
              {data.events.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {data.events.map((e, i) => (
                    <li key={`${e.at}-${i}`} className="border-t border-slate-800 pt-2">
                      <Badge tone={e.level === 'error' ? 'red' : e.level === 'warn' ? 'amber' : 'slate'}>{e.level}</Badge>{' '}
                      <span className="text-slate-300">{e.message}</span> <span className="text-slate-500">{when(e.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>

        {/* ---------- system health ---------- */}
        <Section
          title="System health"
          hint="If something is not working, this page says what, and what to do about it."
          right={<button className={btnNeutral} disabled={busy === 'health'} onClick={loadHealth}>{busy === 'health' ? 'Checking...' : 'Run checks'}</button>}
        >
          {healthError && <p className="text-sm text-rose-300 mb-3">{healthError}</p>}
          {health && (
            <>
              <p className="text-sm text-slate-300 mb-3">
                {health.summary.fail === 0 && health.summary.warn === 0 ? 'Everything is working.' : `${health.summary.fail} failing, ${health.summary.warn} to look at.`} <span className="text-slate-500">Checked {when(health.generated_at)}</span>
              </p>
              <ul className="space-y-2">
                {health.checks.map((c: HealthCheck) => (
                  <li key={c.name} className="border-t border-slate-800 pt-2 text-sm">
                    <Badge tone={c.status === 'ok' ? 'green' : c.status === 'warn' ? 'amber' : 'red'}>{c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'Check' : 'Fix'}</Badge>{' '}
                    <span className="text-white">{c.name}</span> <span className="text-slate-400">- {c.detail}</span>
                    {c.fix && <div className="text-xs text-amber-300 mt-1">What to do: {c.fix}</div>}
                  </li>
                ))}
              </ul>
              {health.recent_errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Recent errors</h3>
                  <ul className="space-y-1 text-sm">
                    {health.recent_errors.map((e, i) => (
                      <li key={`${e.at}-${i}`} className="text-rose-300">{when(e.at)} [{e.source}] {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {health.failed_messages.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Messages that could not be delivered</h3>
                  <ul className="space-y-1 text-sm">
                    {health.failed_messages.map((m, i) => (
                      <li key={`${m.at}-${i}`} className="text-amber-300">{when(m.at)} {m.kind} to {m.to}: {m.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Section>
      </main>
    </div>
  );
}
