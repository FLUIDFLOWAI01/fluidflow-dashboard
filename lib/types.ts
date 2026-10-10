// Shapes shared by the server routes (which build them) and app/page.tsx (which shows them).

export type BankingState = 'balanced' | 'pending' | 'overbanked';
export type StockLevel = 'ok' | 'low' | 'critical' | 'empty';

export interface StationView {
  id: string;
  number: string;
  name: string;
  managerPhone: string;
  pumpSummary: string;
  pumpCount: number;
  status: string;
  shiftOpen: boolean;
  volumeToday: number;
  volumeYesterday: number;
  expectedToday: number;
  bankedToday: number | null; // null when bank_deposits has no created_at column
  unbanked: number;
  bankingState: BankingState;
  deadstock: number;
  attention: string[];
}

export interface WaybillView {
  id: string;
  shortId: string;
  stationId: string;
  fuel: string;
  grade: string;
  volume: number;
  remaining: number;
  date: string;
  driver: string;
  truckReg: string;
  status: string; // raw status from the database, e.g. "Active" or "Completed"
  fifoPosition: number | null; // 1 = next load to be depleted for that fuel (active loads only)
  expectedRev: number;
  bankedRev: number;
  momoRev: number;
}

export interface InventoryView {
  grade: string;
  label: string;
  bookStock: number; // litres still left on active waybills (perpetual FIFO book stock)
  activeLoadVolume: number; // litres originally delivered on those active waybills
  activeLoads: number;
  deadstock: number;
  level: StockLevel;
}

export interface DipView {
  tank: string;
  reading: number;
  at: string | null;
}

export interface ReorderView {
  id: string | number;
  stationId: string;
  stationName: string;
  product: string;
  notes: string;
  status: string;
  createdAt: string | null;
  imageId: string | null;
}

export interface Snapshot {
  generatedAt: string;
  stations: StationView[];
  waybills: Record<string, WaybillView[]>;
  inventory: Record<string, InventoryView[]>;
  dips: Record<string, DipView[]>;
  prices: Record<string, Record<string, number>>; // stationId -> grade -> price
  reorders: ReorderView[];
  momoConnected: boolean;
  warnings: string[];
}

export interface DispenserForm {
  id: number;
  type: 'Single' | 'Twin';
  n1Fuel: string;
  n1Label: string;
  n2Fuel: string;
  n2Label: string;
}
