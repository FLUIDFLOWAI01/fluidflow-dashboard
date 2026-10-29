// Fuel helpers. These mirror the rules in the Python backend (main.py) so both sides agree.

export type Row = Record<string, any>;

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const SUPER_WORDS = ['super', 'petrol', 'gasoline', 'premium'];

/**
 * Gives the same fuel the same key whatever it is called:
 *   'Diesel', 'AGO' -> 'diesel';  'Super', 'Super (PMS)', 'Petrol', 'PMS' -> 'super';
 *   'RON 95', 'Ron95', 'ron-95' -> 'ron 95';  'Kerosene', 'DPK' -> 'kerosene';  'LPG' -> 'lpg'.
 * Any other fuel name is just lower-cased, so ANY fuel can be priced and tracked.
 */
export function normGrade(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.includes('diesel') || /\bago\b/.test(text)) return 'diesel';
  const isSuper = SUPER_WORDS.some((k) => text.includes(k)) || /\b(pms|unleaded)\b/.test(text);
  if (!isSuper) {
    const ron = text.match(/\bron\s*-?\s*(\d{2,3})\b/);
    if (ron) return `ron ${ron[1]}`;
    if (text.includes('kerosene') || /\b(dpk|paraffin)\b/.test(text)) return 'kerosene';
    if (/\blpg\b/.test(text)) return 'lpg';
  }
  if (isSuper) return 'super';
  return text;
}

const UPPER_WORDS = new Set(['ron', 'lpg', 'ago', 'pms', 'dpk']);

/** 'diesel' -> 'Diesel', 'ron 95' -> 'RON 95', 'lpg' -> 'LPG'. */
export function gradeLabel(grade: string): string {
  if (!grade) return 'Unknown';
  return grade
    .split(' ')
    .map((w) => (UPPER_WORDS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function isTwin(type: unknown): boolean {
  return /twin|dual/i.test(String(type ?? ''));
}

export const MAX_DISPLAYS = 12;

/** Names of a dispenser's meter displays (one display = one pair of nozzles), left to right. Same as main.py. */
export function displayLabels(count: number): string[] {
  const n = Math.max(1, Math.min(Math.floor(count) || 1, MAX_DISPLAYS));
  if (n === 1) return ['single'];
  if (n === 2) return ['left', 'right'];
  if (n === 3) return ['left', 'middle', 'right'];
  return Array.from({ length: n }, (_, i) => `d${i + 1}`);
}

function pairFuelList(pump: Row | undefined): Array<{ label?: string; fuel: string }> {
  let raw: unknown = pump?.pair_fuels;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is { label?: string; fuel: string } => Boolean(item) && typeof item === 'object' && String((item as Row).fuel ?? '').trim() !== '');
}

/** How many meter displays a pump has. Old pumps (before the pairs update): single = 1, twin/dual = 2. */
export function pumpDisplayCount(pump: Row | undefined): number {
  const stored = Math.floor(toNumber(pump?.display_count) ?? 0);
  if (stored > 0) return Math.min(stored, MAX_DISPLAYS);
  const listed = pairFuelList(pump).length;
  if (listed > 0) return Math.min(listed, MAX_DISPLAYS);
  return isTwin(pump?.dispenser_type) ? 2 : 1;
}

/** Which fuel a display (nozzle pair) sells. Falls back to the old n1/n2 columns, then the pump's fuel_type. */
export function nozzleFuel(pump: Row | undefined, nozzleLabel: unknown): string {
  const label = String(nozzleLabel ?? '').trim().toLowerCase();
  const p = pump ?? {};
  for (const item of pairFuelList(p)) {
    if (String(item.label ?? '').trim().toLowerCase() === label) return String(item.fuel).trim();
  }
  const candidate = label === 'right' ? p.n2_fuel : p.n1_fuel;
  return String(candidate || p.fuel_type || 'Unknown');
}

/** Every distinct normalised fuel a pump sells (all of its displays). */
export function pumpGrades(pump: Row | undefined): string[] {
  const seen: string[] = [];
  for (const label of displayLabels(pumpDisplayCount(pump))) {
    const grade = normGrade(nozzleFuel(pump, label));
    if (grade && grade !== 'unknown' && !seen.includes(grade)) seen.push(grade);
  }
  return seen;
}
