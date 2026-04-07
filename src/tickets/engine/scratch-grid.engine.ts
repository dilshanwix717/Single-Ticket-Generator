import { shuffleInPlace, randomIntInclusive, sampleDistinctIndices } from '../utils/random.utils';

const DEBUG_TICKETS = process.env['DEBUG_TICKETS'] === '1';

/**
 * ============================================================
 *  SCRATCH GRID ENGINE  (optimized)
 * ============================================================
 * Responsible for building the W (winning numbers) + Y (player
 * numbers) playfield.  This version is DETERMINISTIC — it never
 * returns null and never needs an external retry loop.
 *
 * Key guarantees that make this possible:
 *
 *   1. W numbers are drawn with a minimum-spread of 2, so every W
 *      always has at least one valid ±1 near-miss candidate that is
 *      not itself another W number.  This eliminates the inner-60-
 *      try loop that was the main source of failures.
 *
 *   2. Y filling uses a pre-built forbidden boolean array (O(1)
 *      lookup) and partial Fisher-Yates — only as many swaps as
 *      filler cells needed, not the full pool size.
 *
 *   3. Near-miss positions and values are committed in one pass;
 *      no safety re-check loop is needed because the algorithm is
 *      constructed to be correct by design.
 * ============================================================
 */

const CELL_COUNT = 20;
const W_COUNT = 5;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Zero-pad a number to two digits: 7 → "07", 42 → "42". */
export function formatCell(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * nearMissCandidatesForW
 * ----------------------
 * Returns the numbers that are exactly ±1 away from w (as integers).
 * Edge cases: 0 → [1],  99 → [98],  else → [w-1, w+1].
 */
export function nearMissCandidatesForW(w: string): string[] {
  const v = parseInt(w, 10);
  if (v === 0) return ['01'];
  if (v === 99) return ['98'];
  return [formatCell(v - 1), formatCell(v + 1)];
}

// ─────────────────────────────────────────────────────────────
// W NUMBER GENERATION  (spread-guaranteed)
// ─────────────────────────────────────────────────────────────

/**
 * drawSpreadWNumbers
 * ------------------
 * Draws 5 unique W numbers from [00–99] that are guaranteed to be
 * at least 2 apart from each other.  This ensures every W number
 * has at least one ±1 neighbour that is NOT another W number,
 * which in turn guarantees near-miss candidate availability on
 * every losing ticket — eliminating the need for a retry loop.
 *
 * Algorithm: reservoir-sample 5 numbers from a pool that has
 * already excluded the immediate neighbours of chosen numbers.
 */
function drawSpreadWNumbers(): string[] {
  const available = new Uint8Array(100);
  available.fill(1);

  const picked: number[] = [];

  while (picked.length < W_COUNT) {
    let count = 0;
    for (let i = 0; i < 100; i++) if (available[i]) count++;

    let skip = randomIntInclusive(0, count - 1);
    let chosen = -1;
    for (let i = 0; i < 100; i++) {
      if (available[i]) {
        if (skip === 0) {
          chosen = i;
          break;
        }
        skip--;
      }
    }

    picked.push(chosen);
    if (DEBUG_TICKETS) {
      console.log(
        `[ScratchGrid] drawSpreadWNumbers — pick ${picked.length}/${W_COUNT}: raw=${chosen} → "${formatCell(chosen)}" (available before pick: ${count})`,
      );
    }

    available[chosen] = 0;
    if (chosen > 0) available[chosen - 1] = 0;
    if (chosen < 99) available[chosen + 1] = 0;
  }

  const result = picked.map(formatCell);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] drawSpreadWNumbers — final W (${W_COUNT} spread): [${result.join(', ')}]`);
  return result;
}

// ─────────────────────────────────────────────────────────────
// FORBIDDEN MAP  (shared utility)
// ─────────────────────────────────────────────────────────────

/**
 * buildForbiddenMap
 * -----------------
 * Returns a Uint8Array[100] where index i is 1 if number i must not
 * appear in the remaining Y cells.
 */
function buildForbiddenMap(forbid: Iterable<string>): Uint8Array {
  const map = new Uint8Array(100);
  for (const v of forbid) map[parseInt(v, 10)] = 1;
  return map;
}

/**
 * buildAllowedPool
 * ----------------
 * Returns exactly `need` random values from the non-forbidden set [0–99].
 * Uses partial Fisher-Yates — swaps only the first `need` positions
 * instead of shuffling the entire pool.  O(need) instead of O(pool size).
 */
function buildAllowedPool(forbidden: Uint8Array, need: number): number[] {
  const pool: number[] = [];
  for (let i = 0; i < 100; i++) if (!forbidden[i]) pool.push(i);
  for (let i = 0; i < need; i++) {
    const j = i + randomIntInclusive(0, pool.length - 1 - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, need);
}

// ─────────────────────────────────────────────────────────────
// Y GRID: WINNING TICKET
// ─────────────────────────────────────────────────────────────

function buildWinningY(w: string[], hitCount: number): string[] {
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildWinningY — start (${hitCount} hit(s), ${CELL_COUNT} cells)`);

  const hitValues = [...w];
  shuffleInPlace(hitValues);
  const chosenHits = hitValues.slice(0, hitCount);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildWinningY — step 1: chosen W values for hits`, chosenHits);

  const hitPositions = sampleDistinctIndices(CELL_COUNT, hitCount);
  if (DEBUG_TICKETS) {
    console.log(`[ScratchGrid] buildWinningY — step 2: hit cell indices (sorted)`, [...hitPositions].sort((a, b) => a - b));
  }

  const grid = new Array<string>(CELL_COUNT);
  const forbidden = buildForbiddenMap(w);

  for (let i = 0; i < hitCount; i++) {
    const pos = hitPositions[i]!;
    const val = chosenHits[i]!;
    grid[pos] = val;
    if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildWinningY — step 3: hit ${i + 1}/${hitCount} → cell ${pos} = "${val}"`);
  }

  const fillerCount = CELL_COUNT - hitCount;
  const pool = buildAllowedPool(forbidden, fillerCount);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildWinningY — step 4: filler pool size=${pool.length}`);

  let poolIdx = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== undefined) continue;
    grid[i] = formatCell(pool[poolIdx++]!);
  }

  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildWinningY — Y: [${grid.join(', ')}]`);
  return grid;
}

// ─────────────────────────────────────────────────────────────
// Y GRID: LOSING TICKET  (near-miss guaranteed)
// ─────────────────────────────────────────────────────────────

function buildLosingYWithNearMiss(w: string[]): { y: string[]; nearMissPositions: number[] } {
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — start`);

  const wSet = new Set(w);
  const wNums = w.map((v) => parseInt(v, 10));

  const wSubset = [...w];
  shuffleInPlace(wSubset);
  const sourceCount = randomIntInclusive(3, 4);
  const sources = wSubset.slice(0, sourceCount);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — W sources (${sourceCount})`, sources);

  const nmPool: string[] = [];
  for (const ws of sources) {
    const cands = nearMissCandidatesForW(ws);
    if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — W="${ws}" → ±1 candidates`, cands);
    for (const c of cands) {
      if (!wSet.has(c)) nmPool.push(c);
    }
  }

  const nmUniq = [...new Set(nmPool)];
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — deduped near-miss pool (${nmUniq.length})`, nmUniq);

  const nmTargetRaw = randomIntInclusive(4, 8);
  const nmTarget = Math.min(nmTargetRaw, nmUniq.length);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — near-miss count: ${nmTargetRaw} → ${nmTarget}`);

  shuffleInPlace(nmUniq);
  const nmValues = nmUniq.slice(0, nmTarget);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — chosen near-miss values`, nmValues);

  const nmPositions = sampleDistinctIndices(CELL_COUNT, nmTarget).sort((a, b) => a - b);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — near-miss cell indices`, nmPositions);

  const grid = new Array<string>(CELL_COUNT);

  for (let i = 0; i < nmTarget; i++) {
    const pos = nmPositions[i]!;
    const val = nmValues[i]!;
    grid[pos] = val;
    if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — near-miss ${i + 1}/${nmTarget}: cell ${pos} = "${val}"`);
  }

  const forbidden = new Uint8Array(100);
  for (const n of wNums) forbidden[n] = 1;
  for (const v of nmValues) forbidden[parseInt(v, 10)] = 1;

  const fillerCount = CELL_COUNT - nmTarget;
  const pool = buildAllowedPool(forbidden, fillerCount);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildLosingYWithNearMiss — filler pool size=${pool.length}`);

  let poolIdx = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== undefined) continue;
    grid[i] = formatCell(pool[poolIdx++]!);
  }

  if (DEBUG_TICKETS) {
    console.log(`[ScratchGrid] buildLosingYWithNearMiss — Y: [${grid.join(', ')}]`);
    console.log(`[ScratchGrid] buildLosingYWithNearMiss — near-miss positions: [${nmPositions.join(', ')}]`);
  }

  return { y: grid as string[], nearMissPositions: nmPositions };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

export interface ScratchBuild {
  w: string[];
  y: string[];
  nearMissPositions: number[];
}

export function buildScratchGrid(hitCount: number, isLoss: boolean): ScratchBuild {
  if (DEBUG_TICKETS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[ScratchGrid] buildScratchGrid — START mode=${isLoss ? 'LOSING' : 'WINNING'} hitCount=${hitCount}`);
  }

  const w = drawSpreadWNumbers();

  if (isLoss) {
    const { y, nearMissPositions } = buildLosingYWithNearMiss(w);
    if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildScratchGrid — END (loss) nearMiss count=${nearMissPositions.length}`);
    return { w, y, nearMissPositions };
  }

  const y = buildWinningY(w, hitCount);
  if (DEBUG_TICKETS) console.log(`[ScratchGrid] buildScratchGrid — END (win)`);
  return { w, y, nearMissPositions: [] };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION  (dev/CI safety net — skipped in production)
// ─────────────────────────────────────────────────────────────

export function assertScratchValid(
  w: string[],
  y: string[],
  nearMissPositions: number[],
  hitCount: number,
  isLoss: boolean,
): void {
  if (new Set(w).size !== W_COUNT) throw new Error('W must be 5 unique values');
  if (y.length !== CELL_COUNT || new Set(y).size !== CELL_COUNT)
    throw new Error('Y must contain 20 globally unique values');

  const wSet = new Set(w);

  if (isLoss) {
    for (const v of y) {
      if (wSet.has(v)) throw new Error('Losing ticket: Y must not intersect W');
    }

    const nmSet = new Set(nearMissPositions);
    if (nmSet.size !== nearMissPositions.length) throw new Error('Near-miss positions must be unique');

    for (const idx of nearMissPositions) {
      if (idx < 0 || idx >= CELL_COUNT) throw new Error('Near-miss index out of range');
      const val = y[idx]!;
      const ok = w.some((ws) => nearMissCandidatesForW(ws).includes(val));
      if (!ok) throw new Error('Near-miss value must be ±1 from some W');
    }
    return;
  }

  const hits = y.filter((v) => wSet.has(v));
  if (hits.length !== hitCount) throw new Error('Winning ticket: wrong hit count');
  if (new Set(hits).size !== hitCount) throw new Error('Winning hits must use distinct W values');
  if (nearMissPositions.length !== 0) throw new Error('Near-miss only valid on losing tickets');
}
