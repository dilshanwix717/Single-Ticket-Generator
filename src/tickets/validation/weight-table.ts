import * as path from 'path';
import * as fs from 'fs';
import type { WinTier } from '../types/win-tier';

export interface WeightRow {
  multiplier: number;
  combination: number[];
  win_tier: WinTier;
}

let cached: WeightRow[] | null = null;

/**
 * Loads the canonical reference table from disk once.
 * In Docker/production the JSON is copied next to compiled JS under dist/tickets/data.
 */
export function loadWeightTable(): WeightRow[] {
  if (cached) {
    return cached;
  }
  const candidates = [
    path.join(__dirname, '../data/weight-table.json'),
    path.join(process.cwd(), 'src/tickets/data/weight-table.json'),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    throw new Error('weight-table.json not found');
  }
  const raw = fs.readFileSync(file, 'utf-8');
  cached = JSON.parse(raw) as WeightRow[];
  return cached;
}
