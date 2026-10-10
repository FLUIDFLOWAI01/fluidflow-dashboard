// Builds the live dashboard snapshot from Supabase (server-side only).
//
// Everything is computed from the same tables the WhatsApp bot writes to:
//   stations, pumps, shifts, shift_pump_readings, bank_deposits, waybills,
//   reorder_requests, dipstick_delivery, fuel_prices.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { gradeLabel, isTwin, normGrade, nozzleFuel, toNumber } from './fuel';
import type { Row } from './fuel';
import type {
  BankingState,
  DipView,
  InventoryView,
  ReorderView,
  Snapshot,
  StationView,
  StockLevel,
  WaybillView,
} from './types';

const DAY_MS = 86_400_000;
const PAGE = 1000;
const ID_CHUNK = 100;

// ---------- small query helpers ----------
async function rows(query: PromiseLike<any>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function fetchAll(db: SupabaseClient, table: string, columns: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const chunk = await rows(db.from(table).select(columns).order('id', { ascending: true }).range(from, from + PAGE - 1));
    all.push(...chunk);
    if (chunk.length < PAGE) return all;
  }
}

async function fetchByIds(db: SupabaseClient, table: string, column: string, ids: Array<string | number>): Promise<Row[]> {
  const all: Row[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    all.push(...(await rows(db.from(table).select('*').in(column, ids.slice(i, i + ID_CHUNK)))));
  }
  return all;
}

async function safe<T>(fn: () => Promise<T>, label: string, warnings: string[], fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : 'could not be read'}`);
    return fallback;
  }
}

const byFifo = (a: Row, b: Row): number =>
  String(a.delivery_date ?? '').localeCompare(String(b.delivery_date ?? '')) ||
  String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) ||
  String(a.id).localeCompare(String(b.id));

const shortId = (id: unknown): string => {
  const text = String(id ?? '');
  return text.length > 8 ? text.slice(0, 8).toUpperCase() : text;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- main ----------
export async function buildSnapshot(): Promise<Snapshot> {
  const db = getSupabase();
  const warnings: string[] = [];

  const nowDate = new Date();
  const todayStart = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const yesterdayStart = todayStart - DAY_MS;

  // Stations are essential: if this fails the whole request fails with a clear message.
  const stationsRaw = await fetchAll(db, 'stations', '*');

  const [pumpsRaw, priceRows, waybillRows, openShifts, recentShifts, reorderRows, dipRows, deposits] = await Promise.all([
    safe(() => fetchAll(db, 'pumps', '*'), 'pumps', warnings, [] as Row[]),
    safe(() => fetchAll(db, 'fuel_prices', 'station_id,fuel_grade,price'), 'fuel_prices (run the SQL to create it)', warnings, [] as Row[]),
    safe(() => fetchAll(db, 'waybills', '*'), 'waybills', warnings, [] as Row[]),
    safe(() => rows(db.from('shifts').select('*').eq('status', 'OPEN')), 'shifts (open)', warnings, [] as Row[]),
    safe(
      // one extra day back so a shift opened the day before yesterday but closed today is still counted
      () => rows(db.from('shifts').select('*').gte('created_at', new Date(yesterdayStart - DAY_MS).toISOString())),
      'shifts (recent)',
      warnings,
      [] as Row[],
    ),
    safe(
      async () => {
        try {
          return await rows(db.from('reorder_requests').select('*').order('created_at', { ascending: false }).limit(100));
        } catch {
          return await rows(db.from('reorder_requests').select('*').limit(100));
        }
      },
      'reorder_requests',
      warnings,
      [] as Row[],
    ),
    safe(
      async () => {
        try {
          return await rows(db.from('dipstick_delivery').select('*').order('created_at', { ascending: false }).limit(500));
        } catch {
          return await rows(db.from('dipstick_delivery').select('*').limit(500));
        }
      },
      'dipstick_delivery',
      warnings,
      [] as Row[],
    ),
    loadDeposits(db, warnings),
  ]);

  // ----- index pumps, prices, shifts -----
  const pumpsById = new Map<string, Row>();
  const pumpsByStation = new Map<string, Row[]>();
  for (const pump of pumpsRaw) {
    pumpsById.set(String(pump.id), pump);
    const key = String(pump.station_id);
    pumpsByStation.set(key, [...(pumpsByStation.get(key) ?? []), pump]);
  }

  const prices: Record<string, Record<string, number>> = {};
  for (const row of priceRows) {
    const price = toNumber(row.price);
    if (price === null || price <= 0) continue;
    const key = String(row.station_id);
    (prices[key] ??= {})[normGrade(row.fuel_grade)] = price;
  }

  const stationRowsById = new Map<string, Row>(stationsRaw.map((s) => [String(s.id), s]));
  const priceFor = (stationId: string, grade: string): number | null =>
    prices[stationId]?.[grade] ?? (toNumber(stationRowsById.get(stationId)?.current_price) || null);

  const allShifts = new Map<string, Row>();
  for (const shift of [...openShifts, ...recentShifts]) allShifts.set(String(shift.id), shift);

  const readings = await safe(
    () => fetchByIds(db, 'shift_pump_readings', 'shift_id', Array.from(allShifts.keys())),
    'shift_pump_readings',
    warnings,
    [] as Row[],
  );
  const readingsByShift = new Map<string, Row[]>();
  for (const r of readings) {
    const key = String(r.shift_id);
    readingsByShift.set(key, [...(readingsByShift.get(key) ?? []), r]);
  }

  // ----- sales per station (today / yesterday), from meter openings and closings -----
  const sales = new Map<string, { volToday: number; volYesterday: number; expToday: number }>();
  const openShiftByStation = new Map<string, Row>();
  for (const shift of openShifts) {
    const key = String(shift.station_id);
    const current = openShiftByStation.get(key);
    if (!current || String(shift.created_at ?? '') > String(current.created_at ?? '')) openShiftByStation.set(key, shift);
  }

  for (const shift of allShifts.values()) {
    // A shift counts on the day it was closed (or the day it opened while it is still running).
    const stamp = Date.parse(String(shift.closed_at ?? shift.created_at ?? ''));
    if (!Number.isFinite(stamp) || stamp < yesterdayStart) continue;
    const isToday = stamp >= todayStart;
    const stationId = String(shift.station_id);
    const agg = sales.get(stationId) ?? { volToday: 0, volYesterday: 0, expToday: 0 };

    // Closed shifts store their exact totals (locked prices) when the setup SQL has been run.
    const savedVolume = toNumber(shift.total_volume);
    const savedSales = toNumber(shift.total_sales);
    if (String(shift.status ?? '').toUpperCase() === 'CLOSED' && savedVolume !== null && savedSales !== null) {
      if (isToday) {
        agg.volToday += savedVolume;
        agg.expToday += savedSales;
      } else {
        agg.volYesterday += savedVolume;
      }
      sales.set(stationId, agg);
      continue;
    }

    // Open shifts, and shifts closed before the totals existed: work it out from the meter readings.
    for (const r of readingsByShift.get(String(shift.id)) ?? []) {
      const pump = pumpsById.get(String(r.pump_id));
      const grade = normGrade(nozzleFuel(pump, r.nozzle_label));
      for (const side of ['front', 'back'] as const) {
        const opening = toNumber(r[`opening_${side}`]) ?? 0;
        const closing = toNumber(r[`closing_${side}`]) ?? 0;
        if (opening <= 0 || closing <= 0 || closing < opening) continue;
        const litres = closing - opening;
        if (isToday) {
          agg.volToday += litres;
          agg.expToday += litres * (priceFor(stationId, grade) ?? 0);
        } else {
          agg.volYesterday += litres;
        }
      }
    }
    sales.set(stationId, agg);
  }

  // ----- bank deposits -----
  const depositTotal = new Map<string, number>();
  const depositToday = new Map<string, number>();
  for (const d of deposits.rows) {
    const amount = toNumber(d.amount) ?? 0;
    const key = String(d.station_id);
    depositTotal.set(key, (depositTotal.get(key) ?? 0) + amount);
    if (deposits.hasDates) {
      const when = Date.parse(String(d.created_at ?? ''));
      if (Number.isFinite(when) && when >= todayStart) depositToday.set(key, (depositToday.get(key) ?? 0) + amount);
    }
  }

  // ----- reorder alerts -----
  const stationName = (id: string): string => String(stationRowsById.get(id)?.name ?? 'Unknown station');
  const reorders: ReorderView[] = reorderRows
    .map((r) => ({
      id: r.id as string | number,
      stationId: String(r.station_id),
      stationName: stationName(String(r.station_id)),
      product: String(r.requested_product ?? 'Unknown Fuel'),
      notes: String(r.manager_notes ?? ''),
      status: String(r.status ?? 'Pending Verification'),
      createdAt: r.created_at ? String(r.created_at) : null,
      imageId: r.image_id ? String(r.image_id) : null,
    }))
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  const pendingByStation = new Map<string, number>();
  for (const r of reorders) {
    if (r.status.toLowerCase().startsWith('pending')) pendingByStation.set(r.stationId, (pendingByStation.get(r.stationId) ?? 0) + 1);
  }

  // ----- waybills: FIFO queue, depletion and perpetual realisation -----
  const waybillsByStationRaw = new Map<string, Row[]>();
  for (const w of waybillRows) {
    const key = String(w.station_id);
    waybillsByStationRaw.set(key, [...(waybillsByStationRaw.get(key) ?? []), w]);
  }

  const waybills: Record<string, WaybillView[]> = {};
  const inventory: Record<string, InventoryView[]> = {};

  for (const station of stationsRaw) {
    const stationId = String(station.id);
    const deadstock = toNumber(station.deadstock_limit) ?? 0;
    const list = (waybillsByStationRaw.get(stationId) ?? []).slice().sort(byFifo);

    // oldest-first allocation of verified deposits across the loads
    let pool = depositTotal.get(stationId) ?? 0;
    const fifoCounter: Record<string, number> = {};
    const views: WaybillView[] = [];

    for (const w of list) {
      const volume = toNumber(w.volume) ?? 0;
      const remaining = Math.max(0, toNumber(w.remaining_volume) ?? volume);
      const grade = normGrade(w.fuel_type);
      const isActive = String(w.status ?? '').toLowerCase().startsWith('active');
      const sold = Math.max(0, volume - remaining);
      const price = priceFor(stationId, grade) ?? 0;
      const expectedRev = round2(sold * price);
      const bankedRev = round2(Math.min(expectedRev, pool));
      pool = Math.max(0, pool - bankedRev);

      let fifoPosition: number | null = null;
      if (isActive && remaining > 0) {
        fifoCounter[grade] = (fifoCounter[grade] ?? 0) + 1;
        fifoPosition = fifoCounter[grade];
      }

      views.push({
        id: String(w.id),
        shortId: shortId(w.id),
        stationId,
        fuel: String(w.fuel_type ?? 'Unknown'),
        grade,
        volume,
        remaining,
        date: String(w.delivery_date ?? ''),
        driver: String(w.driver_name ?? 'Unknown'),
        truckReg: String(w.truck_reg ?? 'Unknown'),
        status: String(w.status ?? 'Active'),
        fifoPosition,
        expectedRev,
        bankedRev,
        momoRev: 0, // MoMo settlements are not attributed to loads yet (see README)
      });
    }
    waybills[stationId] = views;

    // ----- inventory (book stock per fuel from active loads) -----
    const grades = new Set<string>();
    for (const v of views) if (v.grade) grades.add(v.grade);
    for (const pump of pumpsByStation.get(stationId) ?? []) {
      grades.add(normGrade(nozzleFuel(pump, 'left')));
      if (isTwin(pump.dispenser_type)) grades.add(normGrade(nozzleFuel(pump, 'right')));
    }
    grades.delete('');
    grades.delete('unknown');

    inventory[stationId] = Array.from(grades)
      .sort()
      .map((grade): InventoryView => {
        const active = views.filter((v) => v.grade === grade && v.status.toLowerCase().startsWith('active'));
        const bookStock = round2(active.reduce((sum, v) => sum + v.remaining, 0));
        const activeLoadVolume = active.reduce((sum, v) => sum + v.volume, 0);
        let level: StockLevel = 'ok';
        if (bookStock <= 0) level = 'empty';
        else if (bookStock <= deadstock) level = 'critical';
        else if (bookStock <= deadstock * 2 || (activeLoadVolume > 0 && bookStock / activeLoadVolume <= 0.2)) level = 'low';
        return { grade, label: gradeLabel(grade), bookStock, activeLoadVolume, activeLoads: active.length, deadstock, level };
      });
  }

  // ----- latest dipstick reading per tank -----
  const dips: Record<string, DipView[]> = {};
  const seenTanks = new Set<string>();
  for (const d of dipRows) {
    const stationId = String(d.station_id);
    const tank = String(d.tank_id ?? '?');
    const key = `${stationId}|${tank}`;
    if (seenTanks.has(key)) continue;
    seenTanks.add(key);
    const reading = toNumber(d.dip_reading);
    if (reading === null) continue;
    (dips[stationId] ??= []).push({ tank, reading, at: d.created_at ? String(d.created_at) : null });
  }
  for (const list of Object.values(dips)) list.sort((a, b) => a.tank.localeCompare(b.tank, undefined, { numeric: true }));

  // ----- station cards -----
  const stations: StationView[] = stationsRaw
    .map((s): StationView => {
      const id = String(s.id);
      const pumps = pumpsByStation.get(id) ?? [];
      const twins = pumps.filter((p) => isTwin(p.dispenser_type)).length;
      const agg = sales.get(id) ?? { volToday: 0, volYesterday: 0, expToday: 0 };
      const unbanked = round2(toNumber(s.unbanked_cash_balance) ?? 0);
      const openShift = openShiftByStation.get(id);
      const bankingState: BankingState = unbanked < -0.5 ? 'overbanked' : unbanked > 0.5 ? 'pending' : 'balanced';

      const attention: string[] = [];
      if (bankingState === 'overbanked') attention.push(`Deposits exceed recorded sales by GHS ${Math.abs(unbanked).toLocaleString('en-GB')}`);
      const pending = pendingByStation.get(id) ?? 0;
      if (pending > 0) attention.push(`${pending} reorder alert${pending === 1 ? '' : 's'} waiting`);
      for (const inv of inventory[id] ?? []) {
        if (inv.level === 'empty') attention.push(`${inv.label}: no stock left on recorded deliveries`);
        else if (inv.level === 'critical') attention.push(`${inv.label} at or below deadstock`);
      }
      const missingPrices = Array.from(
        new Set(pumps.flatMap((p) => [normGrade(nozzleFuel(p, 'left')), ...(isTwin(p.dispenser_type) ? [normGrade(nozzleFuel(p, 'right'))] : [])])),
      ).filter((g) => g && g !== 'unknown' && priceFor(id, g) === null);
      for (const g of missingPrices) attention.push(`No selling price set for ${gradeLabel(g)}`);

      return {
        id,
        number: String(s.station_number ?? ''),
        name: String(s.name ?? 'Unnamed station'),
        managerPhone: String(s.manager_phone ?? ''),
        pumpSummary: `${pumps.length} Pump${pumps.length === 1 ? '' : 's'}${twins > 0 ? ` (${twins} Twin)` : ''}`,
        pumpCount: pumps.length,
        status: openShift ? `OPEN (Shift #${shortId(openShift.id)})` : unbanked > 0.5 ? 'PENDING BANKING' : 'CLOSED',
        shiftOpen: Boolean(openShift),
        volumeToday: round2(agg.volToday),
        volumeYesterday: round2(agg.volYesterday),
        expectedToday: round2(agg.expToday),
        bankedToday: deposits.hasDates ? round2(depositToday.get(id) ?? 0) : null,
        unbanked,
        bankingState,
        deadstock: toNumber(s.deadstock_limit) ?? 0,
        attention,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: nowDate.toISOString(),
    stations,
    waybills,
    inventory,
    dips,
    prices,
    reorders,
    momoConnected: false,
    warnings,
  };
}

async function loadDeposits(db: SupabaseClient, warnings: string[]): Promise<{ rows: Row[]; hasDates: boolean }> {
  try {
    return { rows: await fetchAll(db, 'bank_deposits', 'id,station_id,amount,created_at'), hasDates: true };
  } catch {
    try {
      const plain = await fetchAll(db, 'bank_deposits', 'id,station_id,amount');
      warnings.push('bank_deposits has no created_at column, so "banked today" is not available.');
      return { rows: plain, hasDates: false };
    } catch (e) {
      warnings.push(`bank_deposits: ${e instanceof Error ? e.message : 'could not be read'}`);
      return { rows: [], hasDates: false };
    }
  }
}
