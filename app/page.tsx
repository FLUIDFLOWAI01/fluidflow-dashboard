'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Building2, Sliders, AlertTriangle, CheckCircle, TrendingUp, Database, Fuel,
  ArrowLeft, Smartphone, Bell, Droplets, RefreshCw, LogOut, Check, X,
} from 'lucide-react';
import type {
  DispenserForm, InventoryView, ReorderView, Snapshot, StationView, StockLevel, WaybillView,
} from '../lib/types';

// ---------- formatting helpers ----------
const money = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const litres = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
const isPending = (status: string) => status.toLowerCase().startsWith('pending');
const isActiveStatus = (status: string) => status.toLowerCase().startsWith('active');
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Time unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string): string {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Msg = { kind: 'ok' | 'err'; text: string };

async function postJson(url: string, method: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 401) {
    window.location.href = '/login';
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---------- live data hook (polls the server every 10 seconds) ----------
const POLL_MS = 10_000;

function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw new Error(body?.error || `Server error ${res.status}`);
      setSnapshot(body as Snapshot);
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { snapshot, error, refreshing, reload: load };
}

// ---------- small presentational pieces ----------
const LEVEL_STYLES: Record<StockLevel, { badge: string; bar: string; text: string }> = {
  ok: { badge: 'bg-emerald-500/10 text-emerald-400', bar: 'bg-emerald-500', text: 'Healthy' },
  low: { badge: 'bg-amber-500/10 text-amber-400', bar: 'bg-amber-500', text: 'Running low' },
  critical: { badge: 'bg-rose-500/10 text-rose-400', bar: 'bg-rose-500', text: 'At/below deadstock' },
  empty: { badge: 'bg-rose-500/10 text-rose-400', bar: 'bg-rose-500', text: 'No recorded stock' },
};

function FlashMessage({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  return (
    <p
      role={msg.kind === 'err' ? 'alert' : 'status'}
      className={`text-sm rounded-lg px-3 py-2 border ${msg.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}
    >
      {msg.text}
    </p>
  );
}

function KpiCard(props: { label: string; value: React.ReactNode; valueClass?: string; footer: React.ReactNode }) {
  return (
    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{props.label}</p>
      <p className={`text-3xl font-extrabold mt-2 ${props.valueClass ?? 'text-white'}`}>{props.value}</p>
      <div className="mt-2 text-xs text-slate-400">{props.footer}</div>
    </div>
  );
}

// ---------- live reorder alerts ----------
function ReorderPanel(props: { reorders: ReorderView[]; showStation: boolean; onResolve: (id: string | number, status: 'Verified' | 'Dismissed') => Promise<void>; busyId: string | number | null }) {
  const pending = props.reorders.filter((r) => isPending(r.status));
  const resolved = props.reorders.filter((r) => !isPending(r.status)).slice(0, 5);
  if (pending.length === 0 && resolved.length === 0) return null;

  return (
    <div className={`rounded-2xl border p-6 shadow-lg ${pending.length > 0 ? 'bg-rose-500/5 border-rose-500/30' : 'bg-slate-900 border-slate-800'}`}>
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <Bell className={`w-5 h-5 ${pending.length > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
        Live Reorder Alerts
        {pending.length > 0 && <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length} waiting</span>}
      </h3>

      {pending.length === 0 && <p className="text-slate-400 text-sm">No alerts waiting. Recent ones are listed below.</p>}

      <ul className="space-y-3">
        {pending.map((r) => (
          <li key={String(r.id)} className="bg-slate-900 border border-rose-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="text-white font-semibold">
                {r.product} needed{props.showStation ? ` at ${r.stationName}` : ''}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {formatDateTime(r.createdAt)}
                {r.notes ? ` · “${r.notes}”` : ''}
                {r.imageId ? ' · photo sent on WhatsApp' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={props.busyId === r.id}
                onClick={() => props.onResolve(r.id, 'Verified')}
                className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
              >
                <Check className="w-3.5 h-3.5" /> Verify
              </button>
              <button
                disabled={props.busyId === r.id}
                onClick={() => props.onResolve(r.id, 'Dismissed')}
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-2 rounded-lg"
              >
                <X className="w-3.5 h-3.5" /> Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>

      {resolved.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Recently handled</p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            {resolved.map((r) => (
              <li key={String(r.id)} className="flex justify-between gap-4">
                <span>{r.product}{props.showStation ? ` · ${r.stationName}` : ''}</span>
                <span className="text-xs">{r.status} · {formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- dynamic station inventory ----------
function InventoryPanel(props: { stations: StationView[]; snapshot: Snapshot }) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Droplets className="w-5 h-5 text-blue-400" /> Station Inventory Levels
      </h3>
      <p className="text-slate-400 text-xs mt-1 mb-5">
        Book stock = litres still left on active delivery waybills (reduced automatically as shifts close). Dip readings are the latest tank sticks sent on WhatsApp.
      </p>

      {props.stations.length === 0 && <p className="text-slate-400 text-sm">No stations to show.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {props.stations.map((station) => {
          const inventory: InventoryView[] = props.snapshot.inventory[station.id] ?? [];
          const dips = props.snapshot.dips[station.id] ?? [];
          return (
            <div key={station.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-white font-semibold">{station.name}</p>
                <span className="text-xs text-slate-400">Deadstock: {litres(station.deadstock)} L</span>
              </div>

              {inventory.length === 0 && <p className="text-slate-400 text-sm">No fuel or deliveries recorded yet.</p>}

              <div className="space-y-4">
                {inventory.map((inv) => {
                  const style = LEVEL_STYLES[inv.level];
                  const pct = inv.activeLoadVolume > 0 ? Math.min(100, (inv.bookStock / inv.activeLoadVolume) * 100) : 0;
                  return (
                    <div key={inv.grade}>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-200 font-medium">{inv.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-white font-bold">{litres(inv.bookStock)} L</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${style.badge}`}>{style.text}</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-2.5 rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {inv.activeLoads} active load{inv.activeLoads === 1 ? '' : 's'} · {litres(inv.activeLoadVolume)} L delivered
                      </p>
                    </div>
                  );
                })}
              </div>

              {dips.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/60">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Latest tank dips</p>
                  <ul className="text-sm text-slate-300 grid grid-cols-2 gap-x-4 gap-y-1">
                    {dips.map((d) => (
                      <li key={d.tank} className="flex justify-between">
                        <span>Tank {d.tank}</span>
                        <span className="text-white font-medium">{d.reading.toLocaleString('en-GB')} <span className="text-slate-500 text-xs">{formatDateTime(d.at)}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- perpetual FIFO waybill tracker ----------
function WaybillCard({ waybill, momoConnected }: { waybill: WaybillView; momoConnected: boolean }) {
  const active = isActiveStatus(waybill.status);
  const depleted = waybill.remaining <= 0;
  const sold = Math.max(0, waybill.volume - waybill.remaining);
  const pctSold = waybill.volume > 0 ? Math.min(100, (sold / waybill.volume) * 100) : 0;
  const outstanding = Math.max(0, waybill.expectedRev - waybill.bankedRev - waybill.momoRev);

  let lifecycle = 'ACTIVE';
  let lifecycleClass = 'bg-blue-500/20 text-blue-400';
  if (!active || depleted) {
    if (outstanding <= 0.5) {
      lifecycle = 'COMPLETED (FULLY REALIZED)';
      lifecycleClass = 'bg-emerald-500/20 text-emerald-400';
    } else {
      lifecycle = 'DEPLETED (AWAITING BANKING)';
      lifecycleClass = 'bg-amber-500/20 text-amber-400';
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="bg-slate-800/60 px-6 py-5 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${lifecycleClass}`}>{lifecycle}</span>
          {waybill.fifoPosition !== null && (
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${waybill.fifoPosition === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-300'}`}>
              {waybill.fifoPosition === 1 ? 'SELLING NOW (FIFO #1)' : `QUEUED (FIFO #${waybill.fifoPosition})`}
            </span>
          )}
          <span className="text-white font-semibold text-lg">Waybill #{waybill.shortId}</span>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Date</p>
            <p className="text-white font-medium">{formatDate(waybill.date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Driver Name</p>
            <p className="text-white font-medium">{waybill.driver}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Car No.</p>
            <p className="text-white font-medium">{waybill.truckReg}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Fuel / Amount</p>
            <p className="text-emerald-400 font-bold">{litres(waybill.volume)} L <span className="text-slate-300 font-normal">({waybill.fuel})</span></p>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Inventory Depletion (FIFO)</h4>
          <div className="flex justify-between text-sm mb-1 items-center">
            <span className="text-slate-300">Total Received: <span className="text-white font-bold">{litres(waybill.volume)} L</span></span>
            {depleted ? (
              <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Fully Depleted
              </span>
            ) : (
              <span className="text-blue-400 font-bold">{litres(waybill.remaining)} L Remaining</span>
            )}
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
            <div className={`h-3 rounded-full transition-all duration-700 ${depleted ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${pctSold}%` }} />
          </div>
          <div className="flex justify-between items-center text-sm p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 mt-6">
            <span className="text-slate-300">Volume Sold (Depleted)</span>
            <span className="text-white font-semibold">{litres(sold)} L</span>
          </div>
        </div>

        <div>
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Financial Realization Audit</h4>
          <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
            <div className="flex justify-between mb-4 border-b border-slate-700 pb-4">
              <span className="text-slate-400">Dynamic Expected Revenue</span>
              <span className="text-white font-bold text-lg">GHS {money(waybill.expectedRev)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-emerald-400">Verified Bank Deposits</span>
              <span className="text-emerald-400 font-bold">GHS {money(waybill.bankedRev)}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-emerald-400">MoMo Settlements{momoConnected ? '' : ' (not connected yet)'}</span>
              <span className="text-emerald-400 font-bold">GHS {money(waybill.momoRev)}</span>
            </div>
            <div className="flex justify-between pt-4 border-t border-slate-700 items-center">
              <span className="text-slate-300 font-medium">Unrealized / Outstanding</span>
              <span className="text-amber-400 font-extrabold text-xl">GHS {money(outstanding)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Deposits are applied to the oldest loads first.</p>
        </div>
      </div>
    </div>
  );
}

// ---------- onboarding helpers ----------
const makeDispenser = (n: number): DispenserForm => ({
  id: n, type: 'Twin', n1Fuel: 'Super', n1Label: `Super ${n}`, n2Fuel: 'Diesel', n2Label: `Diesel ${n}`,
});

const MAX_DISPENSERS = 40;

// ======================================================================
export default function ExecutiveDashboard() {
  const { snapshot, error, refreshing, reload } = useSnapshot();

  const [selectedStationRaw, setSelectedStation] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'onboarding'>('overview');

  // reorder actions
  const [busyReorder, setBusyReorder] = useState<string | number | null>(null);
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
  const [scanBusy, setScanBusy] = useState(false);

  // Admin onboarding form
  const [newStationName, setNewStationName] = useState('');
  const [stationNumber, setStationNumber] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [pumpCountText, setPumpCountText] = useState('2');
  const [deadstockLimit, setDeadstockLimit] = useState('');
  const [dispensers, setDispensers] = useState<DispenserForm[]>([makeDispenser(1), makeDispenser(2)]);
  const [onboardBusy, setOnboardBusy] = useState(false);
  const [onboardMsg, setOnboardMsg] = useState<Msg | null>(null);

  // Price management form
  const [targetFuel, setTargetFuel] = useState('Diesel');
  const [newPrice, setNewPrice] = useState('');
  const [targetScope, setTargetScope] = useState<'global' | 'specific'>('global');
  const [selectedTargetStations, setSelectedTargetStations] = useState<string[]>([]);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState<Msg | null>(null);

  const stations = snapshot?.stations ?? [];

  // If the chosen station disappears (or never existed) fall back to "all".
  const selectedStation = selectedStationRaw !== 'all' && stations.some((s) => s.id === selectedStationRaw) ? selectedStationRaw : 'all';

  const filteredStations = useMemo(
    () => (selectedStation === 'all' ? stations : stations.filter((s) => s.id === selectedStation)),
    [stations, selectedStation],
  );

  const totals = useMemo(() => {
    const acc = { volume: 0, volumeYesterday: 0, expected: 0, banked: 0, bankedKnown: true, unbanked: 0, attention: 0 };
    for (const s of filteredStations) {
      acc.volume += s.volumeToday;
      acc.volumeYesterday += s.volumeYesterday;
      acc.expected += s.expectedToday;
      if (s.bankedToday === null) acc.bankedKnown = false;
      else acc.banked += s.bankedToday;
      acc.unbanked += s.unbanked;
      if (s.attention.length > 0) acc.attention += 1;
    }
    return acc;
  }, [filteredStations]);

  const visibleReorders = useMemo(
    () => (snapshot?.reorders ?? []).filter((r) => selectedStation === 'all' || r.stationId === selectedStation),
    [snapshot, selectedStation],
  );

  const stationWaybills = selectedStation !== 'all' && snapshot ? snapshot.waybills[selectedStation] ?? [] : [];
  const selectedStationView = stations.find((s) => s.id === selectedStation);

  const volumeDelta = totals.volumeYesterday > 0 ? ((totals.volume - totals.volumeYesterday) / totals.volumeYesterday) * 100 : null;

  // price matrix columns
  const priceGrades = useMemo(() => {
    const grades = new Set<string>(['diesel', 'super']);
    if (snapshot) for (const p of Object.values(snapshot.prices)) for (const g of Object.keys(p)) grades.add(g);
    return Array.from(grades);
  }, [snapshot]);
  const gradeTitle = (g: string) => (g === 'diesel' ? 'Diesel' : g === 'super' ? 'Super' : g.charAt(0).toUpperCase() + g.slice(1));

  // ---------- actions ----------
  const resolveReorder = async (id: string | number, status: 'Verified' | 'Dismissed') => {
    setBusyReorder(id);
    setActionMsg(null);
    try {
      const res = await postJson('/api/reorders', 'PATCH', { id, status });
      if (!res.ok) throw new Error(res.data?.error || 'Could not update the alert');
      await reload();
    } catch (e) {
      setActionMsg({ kind: 'err', text: errText(e) });
    } finally {
      setBusyReorder(null);
    }
  };

  const requestScan = async () => {
    if (!selectedStationView) return;
    setScanBusy(true);
    setActionMsg(null);
    try {
      const res = await postJson('/api/stations/scan', 'POST', { station_id: selectedStationView.id });
      if (!res.ok) throw new Error(res.data?.error || 'Could not send the scan request');
      setActionMsg({ kind: 'ok', text: `Scan request sent to the manager of ${selectedStationView.name} on WhatsApp. The new load appears here once they send the photo and reply YES.` });
    } catch (e) {
      setActionMsg({ kind: 'err', text: errText(e) });
    } finally {
      setScanBusy(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/login', { method: 'DELETE' });
    } finally {
      window.location.href = '/login';
    }
  };

  const handlePumpCountChange = (text: string) => {
    setPumpCountText(text);
    const count = parseInt(text, 10);
    if (!Number.isFinite(count) || count < 1 || count > MAX_DISPENSERS) return;
    setDispensers((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      const extra: DispenserForm[] = [];
      for (let i = prev.length; i < count; i++) extra.push(makeDispenser(i + 1));
      return [...prev, ...extra];
    });
  };

  const updateDispenser = (index: number, patch: Partial<DispenserForm>) => {
    setDispensers((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const submitStation = async () => {
    setOnboardMsg(null);
    const deadstock = Number(deadstockLimit);
    if (!newStationName.trim() || !stationNumber.trim()) return setOnboardMsg({ kind: 'err', text: 'Enter the station name and station number.' });
    if (!managerPhone.trim()) return setOnboardMsg({ kind: 'err', text: "Enter the manager's WhatsApp number." });
    if (deadstockLimit.trim() === '' || !Number.isFinite(deadstock) || deadstock < 0) return setOnboardMsg({ kind: 'err', text: 'Enter the base deadstock in litres (0 or more).' });
    if (dispensers.length === 0) return setOnboardMsg({ kind: 'err', text: 'Add at least one dispenser.' });

    setOnboardBusy(true);
    try {
      const res = await postJson('/api/stations', 'POST', {
        station_name: newStationName,
        station_number: stationNumber,
        manager_phone: managerPhone,
        base_deadstock: deadstock,
        dispensers: dispensers.map((d) => ({
          id: d.id,
          type: d.type,
          n1Fuel: d.n1Fuel,
          n1Label: d.n1Label.trim() || `${d.n1Fuel} ${d.id}`,
          n2Fuel: d.type === 'Twin' ? d.n2Fuel : null,
          n2Label: d.type === 'Twin' ? d.n2Label.trim() || `${d.n2Fuel} ${d.id}` : null,
        })),
      });
      if (!res.ok) throw new Error(res.data?.error || 'Provisioning failed');
      const linked = res.data?.manager_linked
        ? `The manager (${res.data.manager_phone}) can now message the WhatsApp bot.`
        : `The manager's number could not be linked automatically, so add it to the attendants table before they use WhatsApp.`;
      setOnboardMsg({ kind: 'ok', text: `Station "${newStationName.trim()}" created with ${res.data?.pumps_created ?? dispensers.length} dispenser(s). ${linked} Set its fuel prices in the Price Management tab.` });
      setNewStationName('');
      setStationNumber('');
      setManagerPhone('');
      setDeadstockLimit('');
      setPumpCountText('2');
      setDispensers([makeDispenser(1), makeDispenser(2)]);
      await reload();
    } catch (e) {
      setOnboardMsg({ kind: 'err', text: errText(e) });
    } finally {
      setOnboardBusy(false);
    }
  };

  const deployPrice = async () => {
    setPriceMsg(null);
    const price = Number(newPrice);
    if (newPrice.trim() === '' || !Number.isFinite(price) || price <= 0) return setPriceMsg({ kind: 'err', text: 'Enter a price per litre greater than 0.' });
    const chosen = stations.filter((s) => selectedTargetStations.includes(s.id));
    if (targetScope === 'specific' && chosen.length === 0) return setPriceMsg({ kind: 'err', text: 'Select at least one station before deploying.' });
    const numbers = chosen.map((s) => s.number).filter(Boolean);
    if (targetScope === 'specific' && numbers.length !== chosen.length) return setPriceMsg({ kind: 'err', text: 'A selected station has no station number, so it cannot be targeted.' });

    const scopeText = targetScope === 'global' ? 'ALL stations' : `${chosen.length} selected station(s)`;
    if (!window.confirm(`Set ${targetFuel} to GHS ${price.toFixed(2)} per litre for ${scopeText}? Attendants' shift sales will use this price immediately.`)) return;

    setPriceBusy(true);
    try {
      const res = await postJson('/api/prices', 'POST', {
        fuel_grade: targetFuel,
        new_price: price,
        target_scope: targetScope,
        target_stations: targetScope === 'specific' ? numbers : [],
      });
      if (!res.ok) throw new Error(res.data?.error || 'Price update failed');
      const warning = res.data?.warning ? ` Note: ${res.data.warning}` : '';
      setPriceMsg({ kind: 'ok', text: `${targetFuel} set to GHS ${price.toFixed(2)} at ${res.data?.updated_count ?? 0} station(s).${warning}` });
      setNewPrice('');
      await reload();
    } catch (e) {
      setPriceMsg({ kind: 'err', text: errText(e) });
    } finally {
      setPriceBusy(false);
    }
  };

  // ---------- sync indicator ----------
  const syncOk = snapshot !== null && error === null;
  const lastSync = snapshot ? new Date(snapshot.generatedAt).toLocaleTimeString('en-GB') : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/30">
            <Fuel className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">FluidFlow AI <span className="text-emerald-400 text-sm font-normal">Executive Center</span></h1>
            <p className="text-slate-400 text-xs">Real-time multi-station audit, wetstock tracking, and pricing engine</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <label htmlFor="station-select" className="text-xs text-slate-400">View Station:</label>
            <select
              id="station-select"
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">🏢 All Stations (Consolidated)</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">📍 {s.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => reload()}
            title="Refresh now"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${syncOk ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}
          >
            <span className={`w-2 h-2 rounded-full ${syncOk ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {snapshot === null && error === null ? 'Connecting…' : syncOk ? `Live Sync Active · ${lastSync}` : 'Sync problem · retrying'}
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={logout} className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-6 overflow-x-auto">
        {([
          ['overview', 'Overview & Live Fleet', LayoutDashboard],
          ['pricing', 'Price Management Matrix', TrendingUp],
          ['onboarding', 'Admin Station Onboarding', Sliders],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === key ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="p-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
        {error && (
          <div role="alert" className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm rounded-xl px-4 py-3">
            Could not refresh live data: {error}. {snapshot ? 'Showing the last data received.' : ''}
          </div>
        )}
        {snapshot && snapshot.warnings.length > 0 && (
          <details className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300">
            <summary className="cursor-pointer text-amber-400 font-medium">{snapshot.warnings.length} data source warning(s)</summary>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-400">
              {snapshot.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}

        {!snapshot && !error && <p className="text-slate-400">Loading live data…</p>}

        {/* TAB 1: OVERVIEW */}
        {snapshot && activeTab === 'overview' && (
          <div className="space-y-8">
            <ReorderPanel reorders={visibleReorders} showStation={selectedStation === 'all'} onResolve={resolveReorder} busyId={busyReorder} />
            {actionMsg && <FlashMessage msg={actionMsg} />}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KpiCard
                label={`Volume Sold Today ${selectedStation !== 'all' ? '(Branch)' : '(Total)'}`}
                value={<>{litres(totals.volume)} <span className="text-base font-normal text-slate-400">L</span></>}
                footer={
                  volumeDelta === null ? 'No sales yesterday to compare'
                    : <span className={volumeDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>{volumeDelta >= 0 ? '↑' : '↓'} {Math.abs(volumeDelta).toFixed(0)}% vs yesterday</span>
                }
              />
              <KpiCard
                label="Expected Revenue Today"
                value={`GHS ${money(totals.expected)}`}
                valueClass="text-emerald-400"
                footer={`Calculated via pump meter deltas${totals.bankedKnown ? ` · banked today GHS ${money(totals.banked)}` : ''}`}
              />
              <KpiCard
                label="Unbanked Balance"
                value={`GHS ${money(totals.unbanked)}`}
                valueClass={totals.unbanked < 0 ? 'text-rose-400' : 'text-amber-400'}
                footer="Gross sales from closed shifts minus verified deposits"
              />
              <KpiCard
                label="Stations Needing Attention"
                value={`${totals.attention} ${totals.attention === 1 ? 'Station' : 'Stations'}`}
                valueClass={totals.attention > 0 ? 'text-rose-500' : 'text-emerald-400'}
                footer={totals.attention > 0 ? <span className="text-rose-400 font-medium">⚠️ Action Required</span> : 'All Clear'}
              />
            </div>

            {/* Station Status Health Grid */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  {selectedStation === 'all' ? 'Live Station Health & Reconciliation Grid' : 'Branch Health Overview'}
                </h3>
                {selectedStation !== 'all' && (
                  <button onClick={() => setSelectedStation('all')} className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                    <ArrowLeft className="w-3 h-3" /> Back to All Stations
                  </button>
                )}
              </div>

              {stations.length === 0 ? (
                <p className="text-slate-400 text-sm">No stations yet. Create one in the Admin Station Onboarding tab.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Station Name</th>
                        <th className="pb-3 font-semibold">Active Pumps</th>
                        <th className="pb-3 font-semibold">Shift Status</th>
                        <th className="pb-3 font-semibold">Expected Sales Today</th>
                        <th className="pb-3 font-semibold">Banked Today</th>
                        <th className="pb-3 font-semibold">Unbanked Balance</th>
                        <th className="pb-3 font-semibold">Banking / Alerts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {filteredStations.map((station) => (
                        <tr key={station.id} onClick={() => setSelectedStation(station.id)} className="hover:bg-slate-800/60 transition-colors cursor-pointer group">
                          <td className="py-4 font-medium text-white group-hover:text-emerald-400 transition-colors">{station.name}</td>
                          <td className="py-4 text-slate-300">{station.pumpSummary}</td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${station.status.includes('OPEN') ? 'bg-emerald-500/10 text-emerald-400' : station.status.includes('PENDING') ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>
                              {station.status}
                            </span>
                          </td>
                          <td className="py-4 font-semibold">GHS {money(station.expectedToday)}</td>
                          <td className="py-4 text-slate-300">{station.bankedToday === null ? '—' : `GHS ${money(station.bankedToday)}`}</td>
                          <td className={`py-4 font-semibold ${station.unbanked < 0 ? 'text-rose-400' : 'text-amber-400'}`}>GHS {money(station.unbanked)}</td>
                          <td className="py-4">
                            {station.attention.length > 0 ? (
                              <ul className="space-y-1">
                                {station.attention.map((a, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-rose-400 font-medium text-xs">
                                    <AlertTriangle className="w-4 h-4 shrink-0" /> {a}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs">
                                <CheckCircle className="w-4 h-4" /> {station.bankingState === 'pending' ? 'Cash awaiting banking' : 'Balanced'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <InventoryPanel stations={filteredStations} snapshot={snapshot} />

            {/* PERPETUAL WAYBILL TRACKER */}
            {selectedStation === 'all' && stations.length > 0 && (
              <p className="text-slate-400 text-sm text-center">Select a station (above or by clicking a row) to see its perpetual waybill tracker.</p>
            )}

            {selectedStationView && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-400" /> Perpetual Load Lifecycle Tracker
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Tracks overlapping FIFO deliveries and remote WhatsApp waybill scans for {selectedStationView.name}.</p>
                  </div>
                  <button
                    onClick={requestScan}
                    disabled={scanBusy}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" /> {scanBusy ? 'Sending…' : 'Request Mobile Scan (WhatsApp)'}
                  </button>
                </div>

                {stationWaybills.length === 0 && (
                  <p className="text-slate-400 text-sm">No delivery waybills recorded for this station yet.</p>
                )}
                {stationWaybills.map((waybill) => (
                  <WaybillCard key={waybill.id} waybill={waybill} momoConnected={snapshot.momoConnected} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRICE MANAGEMENT MATRIX */}
        {snapshot && activeTab === 'pricing' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" /> Multi-Station Fuel Price Update Matrix
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                Update pump prices globally or target specific stations. Manager shift calculations are strictly locked to these rates to prevent margin manipulation.
              </p>

              <div className="space-y-5">
                <div>
                  <label htmlFor="fuel-grade" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Select Fuel Grade</label>
                  <select
                    id="fuel-grade"
                    value={targetFuel}
                    onChange={(e) => setTargetFuel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                  >
                    <option value="Diesel">Diesel (AGO)</option>
                    <option value="Super">Super PMS (Gasoline)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="new-price" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">New Price per Liter (GHS)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-medium">GHS</span>
                    <input
                      id="new-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="15.50"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-14 pr-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <p className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Target Scope</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      ['global', 'All Stations (Global)', 'Apply instantly across entire network'],
                      ['specific', 'Selected Stations Only', 'Pick specific branches'],
                    ] as const).map(([value, title, hint]) => (
                      <label key={value} className={`flex items-center gap-3 bg-slate-800/60 p-4 rounded-xl border cursor-pointer transition-colors ${targetScope === value ? 'border-emerald-400' : 'border-slate-700 hover:border-slate-600'}`}>
                        <input type="radio" name="scope" checked={targetScope === value} onChange={() => setTargetScope(value)} className="accent-emerald-400 w-4 h-4" />
                        <div>
                          <p className="text-sm font-semibold text-white">{title}</p>
                          <p className="text-xs text-slate-400">{hint}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {targetScope === 'specific' && (
                    <div className="mt-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
                      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Select Target Branches</p>
                      {stations.length === 0 && <p className="text-slate-400 text-sm">No stations yet.</p>}
                      {stations.map((station) => (
                        <label key={station.id} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedTargetStations.includes(station.id)}
                            onChange={(e) =>
                              setSelectedTargetStations((prev) => (e.target.checked ? [...prev, station.id] : prev.filter((id) => id !== station.id)))
                            }
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-emerald-400 cursor-pointer"
                          />
                          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{station.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <FlashMessage msg={priceMsg} />

                <button
                  onClick={deployPrice}
                  disabled={priceBusy}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-2"
                >
                  {priceBusy ? 'Deploying…' : 'Deploy Price Update to Stations 🚀'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Current Prices in Force (GHS per litre)</h4>
              {stations.length === 0 ? (
                <p className="text-slate-400 text-sm">No stations yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Station</th>
                        {priceGrades.map((g) => <th key={g} className="pb-3 font-semibold">{gradeTitle(g)}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {stations.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 text-white font-medium">{s.name}</td>
                          {priceGrades.map((g) => {
                            const price = snapshot.prices[s.id]?.[g];
                            return (
                              <td key={g} className={`py-3 font-semibold ${price === undefined ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {price === undefined ? 'Not set' : money(price)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN ONBOARDING PORTAL */}
        {snapshot && activeTab === 'onboarding' && (
          <div className="max-w-4xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" /> Automated Station Provisioning Portal
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Instantly provision a new filling station, map dispenser topologies, calibrate deadstock thresholds, and link manager WhatsApp numbers.
            </p>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="station-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Station Name & Location</label>
                  <input id="station-name" type="text" placeholder="e.g., Kumasi Central Express" value={newStationName} onChange={(e) => setNewStationName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label htmlFor="station-number" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Station Number / ID</label>
                  <input id="station-number" type="text" placeholder="e.g., ST-4099" value={stationNumber} onChange={(e) => setStationNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="manager-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Manager WhatsApp Phone Number</label>
                  <input id="manager-phone" type="text" placeholder="e.g., +233241234567" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label htmlFor="deadstock" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Base Deadstock (Liters)</label>
                  <div className="relative">
                    <input id="deadstock" type="number" min="0" placeholder="e.g., 1500" value={deadstockLimit} onChange={(e) => setDeadstockLimit(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-emerald-400" />
                    <span className="absolute right-4 top-3.5 text-slate-400 font-medium text-sm">L</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Dispenser & Nozzle Topology</h4>
                    <p className="text-xs text-slate-400 mt-1">Configure physical hardware layout for accurate AI tank depletion tracking. On a twin pump, Nozzle 1 is the LEFT display and Nozzle 2 the RIGHT display.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label htmlFor="pump-count" className="text-xs font-semibold uppercase tracking-wider text-slate-300">Total Usable Dispensers:</label>
                    <input id="pump-count" type="number" min="1" max={MAX_DISPENSERS} value={pumpCountText} onChange={(e) => handlePumpCountChange(e.target.value)}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>

                <div className="space-y-4">
                  {dispensers.map((disp, index) => (
                    <div key={disp.id} className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 shadow-inner">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-3">
                        <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                          <Database className="w-4 h-4" /> Physical Dispenser {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 uppercase font-semibold">Hardware Type:</span>
                          <select
                            value={disp.type}
                            onChange={(e) => updateDispenser(index, { type: e.target.value === 'Single' ? 'Single' : 'Twin' })}
                            className="bg-slate-900 border border-slate-600 rounded-md text-xs text-white px-3 py-1.5 focus:outline-none focus:border-emerald-400"
                          >
                            <option value="Single">Single Pump (1 Nozzle)</option>
                            <option value="Twin">Twin Pump (2 Nozzles)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Nozzle 1 Configuration</label>
                          <div className="flex gap-2">
                            <select value={disp.n1Fuel} onChange={(e) => updateDispenser(index, { n1Fuel: e.target.value })}
                              className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-1/3">
                              <option value="Super">Super</option>
                              <option value="Diesel">Diesel</option>
                            </select>
                            <input type="text" value={disp.n1Label} onChange={(e) => updateDispenser(index, { n1Label: e.target.value })}
                              className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-2/3" placeholder="System Label (e.g., Super 1)" />
                          </div>
                        </div>

                        {disp.type === 'Twin' && (
                          <div className="space-y-2">
                            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Nozzle 2 Configuration</label>
                            <div className="flex gap-2">
                              <select value={disp.n2Fuel} onChange={(e) => updateDispenser(index, { n2Fuel: e.target.value })}
                                className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-1/3">
                                <option value="Super">Super</option>
                                <option value="Diesel">Diesel</option>
                              </select>
                              <input type="text" value={disp.n2Label} onChange={(e) => updateDispenser(index, { n2Label: e.target.value })}
                                className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-2/3" placeholder="System Label (e.g., Diesel 1)" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <FlashMessage msg={onboardMsg} />

              <button
                onClick={submitStation}
                disabled={onboardBusy}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-2"
              >
                {onboardBusy ? 'Provisioning…' : 'Provision Station Database & Hardware Map ⚡'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
