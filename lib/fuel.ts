// Fuel helpers. These mirror the rules in the Python backend (main.py) so both sides agree.

export type Row = Record<string, any>;

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** 'Diesel', 'AGO' -> 'diesel'; 'Super', 'Super (PMS)', 'Petrol' -> 'super'; anything else just lower-cased. */
export function normGrade(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.includes('diesel') || /\bago\b/.test(text)) return 'diesel';
  if (['super', 'petrol', 'gasoline', 'premium'].some((k) => text.includes(k)) || /\bpms\b/.test(text)) return 'super';
  return text;
}

export function gradeLabel(grade: string): string {
  if (grade === 'diesel') return 'Diesel';
  if (grade === 'super') return 'Super';
  return grade ? grade.charAt(0).toUpperCase() + grade.slice(1) : 'Unknown';
}

export function isTwin(type: unknown): boolean {
  return /twin|dual/i.test(String(type ?? ''));
}

/** Which fuel a nozzle sells: left/single = nozzle 1, right = nozzle 2; falls back to the pump's fuel_type. */
export function nozzleFuel(pump: Row | undefined, nozzleLabel: unknown): string {
  const label = String(nozzleLabel ?? '').trim().toLowerCase();
  const p = pump ?? {};
  const candidate = label === 'right' ? p.n2_fuel : p.n1_fuel;
  return String(candidate || p.fuel_type || 'Unknown');
}
