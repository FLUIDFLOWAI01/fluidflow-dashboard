// Dipstick-vs-book-stock check. Pure functions (no database), so they are easy to test.
//
// How it works:
//   * a tank's dip reading is taken as litres, unless the tank has a calibration chart (dip reading -> litres), which is interpolated
//   * book stock = litres still on the station's active waybills for that fuel (perpetual FIFO)
//   * difference = tank litres - book litres. A starting "baseline" is accepted once by the owner, because the books
//     only know about deliveries recorded since the system started
//   * a flag is raised only when the difference moves away from the baseline by more than the tolerance
//   * the check only runs when the numbers are comparable: no open shift, and the dip was taken after the last
//     shift closed and after the last delivery was recorded

export interface ChartPoint {
  dip: number;
  litres: number;
}

export interface ChartResult {
  points: ChartPoint[];
  error: string | null;
}

/** Reads a pasted chart: one "dip, litres" pair per line (comma, tab, colon or space between them). */
export function parseChart(text: string): ChartResult {
  const points: ChartPoint[] = [];
  const lines = String(text ?? '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/[\s,;:\t]+/).filter(Boolean);
    if (points.length === 0 && parts.length === 2 && /[a-z]/i.test(line)) continue; // skip a header row like "dip,litres"
    if (parts.length !== 2) {
      return { points: [], error: `Line ${i + 1}: write two numbers like "125, 4300"` };
    }
    const dip = Number(parts[0].replace(/,/g, ''));
    const litres = Number(parts[1].replace(/,/g, ''));
    if (!Number.isFinite(dip) || !Number.isFinite(litres) || dip < 0 || litres < 0) {
      return { points: [], error: `Line ${i + 1}: "${line}" is not two positive numbers` };
    }
    points.push({ dip, litres });
  }
  if (points.length === 0) return { points: [], error: null }; // no chart: the dipstick reading is already litres
  if (points.length < 2) return { points: [], error: 'A chart needs at least 2 lines (dip and litres). Leave it empty if the dipstick already shows litres.' };
  if (points.length > 2000) return { points: [], error: 'Too many lines (maximum 2000)' };
  points.sort((a, b) => a.dip - b.dip);
  for (let i = 1; i < points.length; i++) {
    if (points[i].dip === points[i - 1].dip) return { points: [], error: `The dip reading ${points[i].dip} appears twice` };
    if (points[i].litres < points[i - 1].litres) {
      return { points: [], error: `Litres go DOWN between dip ${points[i - 1].dip} and ${points[i].dip}. Check the chart.` };
    }
  }
  return { points, error: null };
}

/** Litres for a dip reading, by straight-line interpolation between the two nearest chart lines. null if outside the chart. */
export function dipToLitres(points: ChartPoint[], dip: number): number | null {
  if (points.length < 2 || !Number.isFinite(dip)) return null;
  if (dip < points[0].dip || dip > points[points.length - 1].dip) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].dip <= dip) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  if (b.dip === a.dip) return a.litres;
  return a.litres + ((dip - a.dip) / (b.dip - a.dip)) * (b.litres - a.litres);
}

export type StockCheckStatus = 'ok' | 'flag' | 'needs_baseline' | 'waiting' | 'no_dip' | 'out_of_chart';

export interface StockCheckTankInput {
  number: string;
  points: ChartPoint[];
  capacity: number | null;
  tolerance: number | null;
  dip: { reading: number; at: number } | null; // time in ms
}

export interface StockCheckInput {
  tanks: StockCheckTankInput[];
  bookLitres: number;
  baseline: number | null;
  openShift: boolean;
  lastCloseAt: number; // ms, 0 if unknown
  lastDeliveryAt: number; // ms, 0 if unknown
}

export interface StockCheckResult {
  status: StockCheckStatus;
  message: string;
  dipLitres: number | null;
  bookLitres: number;
  rawDifference: number | null; // tank litres - book litres
  adjustedDifference: number | null; // rawDifference - baseline
  tolerance: number;
  dipAt: number | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const fmt = (n: number): string => Math.abs(Math.round(n)).toLocaleString('en-GB');

export function defaultTolerance(t: { tolerance: number | null; capacity: number | null }): number {
  if (t.tolerance !== null && t.tolerance >= 0) return t.tolerance;
  return Math.max(50, t.capacity ? t.capacity * 0.01 : 100);
}

export function evaluateStock(input: StockCheckInput): StockCheckResult {
  const tolerance = input.tanks.reduce((sum, t) => sum + defaultTolerance(t), 0);
  const base = { dipLitres: null, bookLitres: input.bookLitres, rawDifference: null, adjustedDifference: null, tolerance, dipAt: null };

  const missing = input.tanks.filter((t) => !t.dip);
  if (missing.length > 0) {
    return { ...base, status: 'no_dip', message: `Waiting for a dipstick photo for tank ${missing.map((t) => t.number).join(', ')}.` };
  }

  let total = 0;
  let oldest = Infinity;
  for (const t of input.tanks) {
    // A tank without a chart: the dipstick reading is taken as litres directly.
    const litres = t.points.length === 0 ? t.dip!.reading : dipToLitres(t.points, t.dip!.reading);
    if (litres === null) {
      return { ...base, status: 'out_of_chart', message: `Tank ${t.number}: the dip ${t.dip!.reading} is outside its chart. Re-check the reading or the chart.` };
    }
    total += litres;
    oldest = Math.min(oldest, t.dip!.at);
  }
  total = round1(total);
  const withDip = { ...base, dipLitres: total, dipAt: oldest };

  if (input.openShift) {
    return { ...withDip, status: 'waiting', message: 'A shift is still open, so book stock is not up to date. Take a dip after the shift is closed.' };
  }
  if (oldest < input.lastCloseAt) {
    return { ...withDip, status: 'waiting', message: 'The last dip was taken before the latest shift closed. Take a new dip now.' };
  }
  if (oldest < input.lastDeliveryAt) {
    return { ...withDip, status: 'waiting', message: 'A delivery was recorded after the last dip. Take a new dip now.' };
  }

  const raw = round1(total - input.bookLitres);
  if (input.baseline === null) {
    return {
      ...withDip,
      rawDifference: raw,
      status: 'needs_baseline',
      message: `Tank holds ${fmt(total)} L and the books say ${fmt(input.bookLitres)} L. If this gap is normal for the station, accept it as the starting point.`,
    };
  }
  const adjusted = round1(raw - input.baseline);
  if (adjusted < -tolerance) {
    return {
      ...withDip,
      rawDifference: raw,
      adjustedDifference: adjusted,
      status: 'flag',
      message: `Tank has ${fmt(adjusted)} L LESS than the books say (allowed gap ${fmt(tolerance)} L). Possible leak, theft, or sales not recorded.`,
    };
  }
  if (adjusted > tolerance) {
    return {
      ...withDip,
      rawDifference: raw,
      adjustedDifference: adjusted,
      status: 'flag',
      message: `Tank has ${fmt(adjusted)} L MORE than the books say (allowed gap ${fmt(tolerance)} L). A delivery may be missing from the records, or a reading is wrong.`,
    };
  }
  return {
    ...withDip,
    rawDifference: raw,
    adjustedDifference: adjusted,
    status: 'ok',
    message: `Tank and books agree within ${fmt(tolerance)} L (difference ${adjusted >= 0 ? '+' : '-'}${fmt(adjusted)} L).`,
  };
}
