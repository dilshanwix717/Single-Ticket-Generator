import { shuffleInPlace, randomIntInclusive, sampleDistinctIndices } from '../utils/random.utils';

/**
 * Scratch grid (W area + Y area + near-miss)
 * -----------------------------------------
 * - W: five *unique* two-digit labels (uniform in 00–99).
 * - Y: twenty *globally unique* labels.
 * - Winning: exactly `hitCount` Y cells must match *distinct* W values; other Y cells must
 *   avoid W entirely so we never create accidental extra hits.
 * - Losing (NO_WIN): Y is disjoint from W. Several Y cells are "near-miss": values that are
 *   ±1 of a chosen subset of W (with 00→01 and 99→98 rules). If we cannot place enough
 *   unique near-miss values, this attempt fails and the outer generator retries with new W.
 */

const CELL_COUNT = 20;
const W_COUNT = 5;

export function formatCell(n: number): string {
  return n.toString().padStart(2, '0');
}

function drawDistinctWNumbers(): string[] {
  const picked = new Set<number>();
  while (picked.size < W_COUNT) {
    picked.add(randomIntInclusive(0, 99));
  }
  return [...picked].map(formatCell);
}

/**
 * Pick a uniform unused label in 00–99 excluding the forbidden set.
 * Returns null only if the grid is over-constrained (should not happen here).
 */
function pickUnused(forbidden: Set<string>): string | null {
  const candidates: number[] = [];
  for (let n = 0; n < 100; n++) {
    const s = formatCell(n);
    if (!forbidden.has(s)) {
      candidates.push(n);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const n = candidates[randomIntInclusive(0, candidates.length - 1)]!;
  return formatCell(n);
}

/**
 * For a W cell value, return valid near-miss candidates (never equal to W).
 * Rules: 00 → 01 only; 99 → 98 only; else W−1 and W+1 as two-digit strings.
 */
export function nearMissCandidatesForW(w: string): string[] {
  const v = parseInt(w, 10);
  if (v === 0) return ['01'];
  if (v === 99) return ['98'];
  return [formatCell(v - 1), formatCell(v + 1)];
}

/**
 * Winning tickets: exactly `hitCount` positions match distinct W values; all other
 * Y cells must stay off W so we do not create accidental extra hits.
 */
function tryBuildWinningY(w: string[], hitCount: number): string[] | null {
  if (hitCount > w.length) {
    return null;
  }
  const wSet = new Set(w);
  const hitValues = [...w];
  shuffleInPlace(hitValues);
  const chosenHits = hitValues.slice(0, hitCount);
  const hitPositions = sampleDistinctIndices(CELL_COUNT, hitCount);
  shuffleInPlace(hitPositions);

  const grid: (string | undefined)[] = Array(CELL_COUNT).fill(undefined);
  const used = new Set<string>();
  for (let i = 0; i < hitCount; i++) {
    const pos = hitPositions[i]!;
    const val = chosenHits[i]!;
    grid[pos] = val;
    used.add(val);
  }
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i]) continue;
    const forbidden = new Set<string>([...wSet, ...used]);
    const pick = pickUnused(forbidden);
    if (!pick) return null;
    grid[i] = pick;
    used.add(pick);
  }
  return grid as string[];
}

/**
 * Losing tickets: 20 globally unique Y values, disjoint from W, plus near-miss cells
 * that are ±1 of selected W numbers (never equal to any W, never duplicated in Y).
 */
function tryBuildLosingYWithNearMiss(
  w: string[],
): { y: string[]; nearMissPositions: number[] } | null {
  const wSet = new Set(w);
  const INNER_TRIES = 60;

  for (let t = 0; t < INNER_TRIES; t++) {
    let nmTarget = randomIntInclusive(4, 8);
    const wPickCount = randomIntInclusive(3, 4);
    const wSubset = [...w];
    shuffleInPlace(wSubset);
    const sources = wSubset.slice(0, wPickCount);

    const pool: string[] = [];
    for (const ws of sources) {
      for (const c of nearMissCandidatesForW(ws)) {
        if (!wSet.has(c)) {
          pool.push(c);
        }
      }
    }
    const uniq = [...new Set(pool)];
    if (uniq.length < 4) {
      continue;
    }

    if (nmTarget > uniq.length) {
      nmTarget = uniq.length;
    }
    if (nmTarget < 4) {
      continue;
    }

    shuffleInPlace(uniq);
    const nmValues = uniq.slice(0, nmTarget);
    const nmPositions = sampleDistinctIndices(CELL_COUNT, nmTarget);
    shuffleInPlace(nmPositions);

    const grid: (string | undefined)[] = Array(CELL_COUNT).fill(undefined);
    const used = new Set<string>();

    for (let i = 0; i < nmTarget; i++) {
      grid[nmPositions[i]!] = nmValues[i]!;
      used.add(nmValues[i]!);
    }

    let failed = false;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (grid[i]) continue;
      const forbidden = new Set<string>([...wSet, ...used]);
      const pick = pickUnused(forbidden);
      if (!pick) {
        failed = true;
        break;
      }
      grid[i] = pick;
      used.add(pick);
    }
    if (failed) continue;

    if (grid.some((v) => wSet.has(v!))) {
      continue;
    }

    return {
      y: grid as string[],
      nearMissPositions: [...nmPositions].sort((a, b) => a - b),
    };
  }
  return null;
}

export interface ScratchBuild {
  w: string[];
  y: string[];
  nearMissPositions: number[];
}

/**
 * Top-level attempt for one W draw: builds W and Y according to win/loss mode.
 * Returns null if this W could not be completed (caller may regenerate W).
 */
export function tryBuildScratchGrid(hitCount: number, isLoss: boolean): ScratchBuild | null {
  const w = drawDistinctWNumbers();
  if (isLoss) {
    const built = tryBuildLosingYWithNearMiss(w);
    if (!built) return null;
    return { w, y: built.y, nearMissPositions: built.nearMissPositions };
  }
  const y = tryBuildWinningY(w, hitCount);
  if (!y) return null;
  return { w, y, nearMissPositions: [] };
}

/** Validates the scratch grid against the hard rules (cheap, deterministic). */
export function assertScratchValid(
  w: string[],
  y: string[],
  nearMissPositions: number[],
  hitCount: number,
  isLoss: boolean,
): void {
  if (new Set(w).size !== W_COUNT) {
    throw new Error('W numbers must be 5 unique values');
  }
  if (y.length !== CELL_COUNT || new Set(y).size !== CELL_COUNT) {
    throw new Error('Y must contain 20 globally unique values');
  }
  const wSet = new Set(w);
  if (isLoss) {
    for (const v of y) {
      if (wSet.has(v)) {
        throw new Error('Losing ticket: Y must not intersect W');
      }
    }
    const nmSet = new Set(nearMissPositions);
    if (nmSet.size !== nearMissPositions.length) {
      throw new Error('near-miss positions must be unique indices');
    }
    for (const idx of nearMissPositions) {
      if (idx < 0 || idx >= CELL_COUNT) {
        throw new Error('near-miss index out of range');
      }
      const val = y[idx]!;
      let ok = false;
      for (const ws of w) {
        const cand = new Set(nearMissCandidatesForW(ws));
        if (cand.has(val)) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        throw new Error('near-miss value must be adjacent to some W');
      }
    }
    return;
  }

  const hits = y.filter((v) => wSet.has(v));
  if (hits.length !== hitCount) {
    throw new Error('winning ticket must have exactly hitCount W matches');
  }
  if (new Set(hits).size !== hitCount) {
    throw new Error('winning hits must use distinct W values');
  }
  if (nearMissPositions.length !== 0) {
    throw new Error('near-miss is only for NO_WIN');
  }
}
