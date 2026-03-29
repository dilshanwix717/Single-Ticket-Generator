import { shuffleInPlace, randomIntInclusive, sampleDistinctIndices } from '../utils/random.utils';

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
 *      lookup) and a single shuffle — no per-cell iteration.
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
 *
 * Worst-case spread of 5 values in [0..99] with gap ≥ 2:
 *   e.g. 0, 2, 4, 6, 8 → 9 numbers consumed, 91 still free.
 * This is always satisfiable, so no loop guard is needed.
 */
function drawSpreadWNumbers(): string[] {
  // Build a pool of all 100 numbers, then iteratively pick one and
  // remove its ±1 neighbours from the pool.
  const available = new Uint8Array(100); // 1 = available
  available.fill(1);

  const picked: number[] = [];

  while (picked.length < W_COUNT) {
    // Count available slots
    let count = 0;
    for (let i = 0; i < 100; i++) if (available[i]) count++;

    // Pick a random index within the available set
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

    // Mark chosen and its immediate neighbours as unavailable
    available[chosen] = 0;
    if (chosen > 0) available[chosen - 1] = 0;
    if (chosen < 99) available[chosen + 1] = 0;
  }

  const result = picked.map(formatCell);
  console.log(`[W Numbers] Drew ${W_COUNT} spread winning numbers: [${result.join(', ')}]`);
  return result;
}

// ─────────────────────────────────────────────────────────────
// FORBIDDEN MAP  (shared utility)
// ─────────────────────────────────────────────────────────────

/**
 * buildForbiddenMap
 * -----------------
 * Returns a Uint8Array[100] where index i is 1 if number i must not
 * appear in the remaining Y cells.  Accepts a list of string values
 * to forbid (W numbers + already-placed Y values).
 */
function buildForbiddenMap(forbid: Iterable<string>): Uint8Array {
  const map = new Uint8Array(100);
  for (const v of forbid) map[parseInt(v, 10)] = 1;
  return map;
}

/**
 * buildAllowedPool
 * ----------------
 * Converts a forbidden map into a shuffled array of allowed numeric
 * values.  One shuffle here is all we need — callers just pop/slice.
 */
function buildAllowedPool(forbidden: Uint8Array): number[] {
  const pool: number[] = [];
  for (let i = 0; i < 100; i++) if (!forbidden[i]) pool.push(i);
  shuffleInPlace(pool);
  return pool;
}

// ─────────────────────────────────────────────────────────────
// Y GRID: WINNING TICKET
// ─────────────────────────────────────────────────────────────

/**
 * buildWinningY
 * -------------
 * Builds a 20-cell Y grid for a winning ticket.
 *
 * Guarantees (by construction, validated downstream):
 *   • Exactly `hitCount` cells equal a W number.
 *   • Each matching cell uses a distinct W value.
 *   • All 20 values are globally unique.
 *   • No non-hit cell equals any W number.
 *
 * This function is always called with hitCount ≤ 5, so it can
 * never fail.  No return-null path exists.
 */
function buildWinningY(w: string[], hitCount: number): string[] {
  console.log(`\n[Winning Y] Building Y grid — ${hitCount} hit(s)`);

  // 1. Choose which W values become hits (shuffle W, take first hitCount)
  const hitValues = [...w];
  shuffleInPlace(hitValues);
  const chosenHits = hitValues.slice(0, hitCount);

  // 2. Choose which grid positions the hits occupy
  const hitPositions = sampleDistinctIndices(CELL_COUNT, hitCount);

  // 3. Place hits
  const grid = new Array<string>(CELL_COUNT);
  const forbidden = buildForbiddenMap(w); // forbid ALL W numbers for fillers

  for (let i = 0; i < hitCount; i++) {
    const pos = hitPositions[i]!;
    const val = chosenHits[i]!;
    grid[pos] = val;
    // hit values are W numbers; already in forbidden map — no extra work needed
  }

  // 4. Build allowed pool (excludes all W numbers + already-placed hits)
  //    Hits are W numbers so they're already forbidden; nothing extra needed.
  const pool = buildAllowedPool(forbidden);

  // 5. Fill remaining cells
  let poolIdx = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== undefined) continue;
    grid[i] = formatCell(pool[poolIdx++]!);
  }

  console.log(`[Winning Y] Y: [${grid.join(', ')}]`);
  return grid;
}

// ─────────────────────────────────────────────────────────────
// Y GRID: LOSING TICKET  (near-miss guaranteed)
// ─────────────────────────────────────────────────────────────

/**
 * buildLosingYWithNearMiss
 * ------------------------
 * Builds a 20-cell Y grid for a losing ticket with guaranteed
 * near-miss cells.
 *
 * Because W numbers were drawn with a minimum spread of 2, every
 * W number has at least one ±1 neighbour that is NOT another W
 * number.  With 5 spread W numbers we always have ≥ 5 (and
 * typically 8–10) valid near-miss candidates — well above the
 * minimum of 4 required by the spec.
 *
 * Therefore this function is deterministic and never fails.
 *
 * Algorithm:
 *   1. Collect all ±1 candidates for 3–4 W numbers; deduplicate;
 *      remove any that happen to equal a W number.
 *   2. Pick nmTarget (4–8) values from that pool.
 *   3. Assign them to random positions.
 *   4. Fill the remaining 20 − nmTarget cells from the allowed pool.
 */
function buildLosingYWithNearMiss(w: string[]): { y: string[]; nearMissPositions: number[] } {
  console.log(`\n[Losing Y] Building losing Y grid`);

  const wSet = new Set(w);
  const wNums = w.map((v) => parseInt(v, 10));

  // 1. Build near-miss candidate pool from 3–4 W numbers
  const wSubset = [...w];
  shuffleInPlace(wSubset);
  const sources = wSubset.slice(0, 4); // always use 4 sources per spec §5.5.2

  const nmPool: string[] = [];
  for (const ws of sources) {
    for (const c of nearMissCandidatesForW(ws)) {
      if (!wSet.has(c)) nmPool.push(c);
    }
  }

  // Deduplicate
  const nmUniq = [...new Set(nmPool)];
  console.log(`[Losing Y] Near-miss pool (${nmUniq.length}): [${nmUniq.join(', ')}]`);

  // nmUniq.length is always ≥ 4 because spread-W guarantees it.
  // Clamp target to available pool (spec says 4–8).
  const nmTarget = Math.min(randomIntInclusive(4, 8), nmUniq.length);
  shuffleInPlace(nmUniq);
  const nmValues = nmUniq.slice(0, nmTarget);

  // 2. Pick nmTarget random grid positions for near-miss cells
  const nmPositions = sampleDistinctIndices(CELL_COUNT, nmTarget).sort((a, b) => a - b);

  // 3. Build grid
  const grid = new Array<string>(CELL_COUNT);

  for (let i = 0; i < nmTarget; i++) {
    grid[nmPositions[i]!] = nmValues[i]!;
  }

  // 4. Forbidden: all W numbers + all placed near-miss values
  const forbidden = new Uint8Array(100);
  for (const n of wNums) forbidden[n] = 1;
  for (const v of nmValues) forbidden[parseInt(v, 10)] = 1;

  const pool = buildAllowedPool(forbidden);
  let poolIdx = 0;

  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== undefined) continue;
    grid[i] = formatCell(pool[poolIdx++]!);
  }

  console.log(`[Losing Y] Y: [${grid.join(', ')}]`);
  console.log(`[Losing Y] Near-miss positions: [${nmPositions.join(', ')}]`);

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

/**
 * buildScratchGrid
 * ----------------
 * Builds one complete scratch grid.  Always succeeds — no null
 * return, no external retry loop required.
 *
 * @param hitCount - Y cells that must match a W number (0 = loss)
 * @param isLoss   - true = losing ticket
 */
export function buildScratchGrid(hitCount: number, isLoss: boolean): ScratchBuild {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Scratch Grid] mode=${isLoss ? 'LOSING' : 'WINNING'} hitCount=${hitCount}`);

  const w = drawSpreadWNumbers();

  if (isLoss) {
    const { y, nearMissPositions } = buildLosingYWithNearMiss(w);
    return { w, y, nearMissPositions };
  }

  const y = buildWinningY(w, hitCount);
  return { w, y, nearMissPositions: [] };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION  (dev/test safety net — should never throw in prod)
// ─────────────────────────────────────────────────────────────

/**
 * assertScratchValid
 * ------------------
 * Validates a finished scratch grid against all spec rules.
 * In production, this should never throw — it exists as a
 * correctness guard during development and CI.
 */
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
