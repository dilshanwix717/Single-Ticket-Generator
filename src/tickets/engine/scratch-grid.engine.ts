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
    console.log(
      `[ScratchGrid] drawSpreadWNumbers — pick ${picked.length}/${W_COUNT}: raw=${chosen} → "${formatCell(chosen)}" (available before pick: ${count})`,
    );

    // Mark chosen and its immediate neighbours as unavailable
    available[chosen] = 0;
    if (chosen > 0) available[chosen - 1] = 0;
    if (chosen < 99) available[chosen + 1] = 0;
  }

  const result = picked.map(formatCell);
  console.log(`[ScratchGrid] drawSpreadWNumbers — final W (${W_COUNT} spread): [${result.join(', ')}]`);
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
  console.log(`[ScratchGrid] buildWinningY — start (${hitCount} hit(s), ${CELL_COUNT} cells)`);

  // 1. Choose which W values become hits (shuffle W, take first hitCount)
  const hitValues = [...w];
  shuffleInPlace(hitValues);
  const chosenHits = hitValues.slice(0, hitCount);
  console.log(`[ScratchGrid] buildWinningY — step 1: chosen W values for hits (order = placement order)`, chosenHits);

  // 2. Choose which grid positions the hits occupy
  const hitPositions = sampleDistinctIndices(CELL_COUNT, hitCount);
  const hitPositionsSorted = [...hitPositions].sort((a, b) => a - b);
  console.log(`[ScratchGrid] buildWinningY — step 2: hit cell indices (unsorted)`, hitPositions);
  console.log(`[ScratchGrid] buildWinningY — step 2: hit cell indices (sorted)`, hitPositionsSorted);

  // 3. Place hits
  const grid = new Array<string>(CELL_COUNT);
  const forbidden = buildForbiddenMap(w); // forbid ALL W numbers for fillers

  for (let i = 0; i < hitCount; i++) {
    const pos = hitPositions[i]!;
    const val = chosenHits[i]!;
    grid[pos] = val;
    console.log(`[ScratchGrid] buildWinningY — step 3: place hit ${i + 1}/${hitCount} → cell ${pos} = "${val}"`);
  }

  // 4. Build allowed pool (excludes all W numbers + already-placed hits)
  //    Hits are W numbers so they're already forbidden; nothing extra needed.
  const pool = buildAllowedPool(forbidden);
  console.log(
    `[ScratchGrid] buildWinningY — step 4: filler pool size=${pool.length} (excludes all ${W_COUNT} W numbers)`,
  );

  // 5. Fill remaining cells
  let poolIdx = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== undefined) continue;
    grid[i] = formatCell(pool[poolIdx++]!);
  }

  console.log(`[ScratchGrid] buildWinningY — step 5: Y grid complete`);
  console.log(`[ScratchGrid] buildWinningY — Y: [${grid.join(', ')}]`);
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
  console.log(`[ScratchGrid] buildLosingYWithNearMiss — start (${CELL_COUNT} cells, no Y=W)`);

  const wSet = new Set(w);
  const wNums = w.map((v) => parseInt(v, 10));

  // 1. Build near-miss candidate pool from 3–4 W numbers
  const wSubset = [...w];
  shuffleInPlace(wSubset);
  const sources = wSubset.slice(0, 4); // always use 4 sources per spec §5.5.2
  console.log(`[ScratchGrid] buildLosingYWithNearMiss — step 1: W sources for ±1 near-miss candidates`, sources);

  const nmPool: string[] = [];
  for (const ws of sources) {
    const cands = nearMissCandidatesForW(ws);
    console.log(`[ScratchGrid] buildLosingYWithNearMiss — step 1: W="${ws}" → ±1 candidates`, cands);
    for (const c of cands) {
      if (!wSet.has(c)) nmPool.push(c);
    }
  }

  // Deduplicate
  const nmUniq = [...new Set(nmPool)];
  console.log(
    `[ScratchGrid] buildLosingYWithNearMiss — step 2: deduped near-miss pool (${nmUniq.length} values)`,
    nmUniq,
  );

  // nmUniq.length is always ≥ 4 because spread-W guarantees it.
  // Clamp target to available pool (spec says 4–8).
  const nmTargetRaw = randomIntInclusive(4, 8);
  const nmTarget = Math.min(nmTargetRaw, nmUniq.length);
  console.log(
    `[ScratchGrid] buildLosingYWithNearMiss — step 3: target near-miss count: random ${nmTargetRaw} → applied ${nmTarget} (capped by pool)`,
  );
  shuffleInPlace(nmUniq);
  const nmValues = nmUniq.slice(0, nmTarget);
  console.log(`[ScratchGrid] buildLosingYWithNearMiss — step 3: chosen near-miss values (${nmValues.length})`, nmValues);

  // 2. Pick nmTarget random grid positions for near-miss cells
  const nmPositions = sampleDistinctIndices(CELL_COUNT, nmTarget).sort((a, b) => a - b);
  console.log(`[ScratchGrid] buildLosingYWithNearMiss — step 4: near-miss cell indices (sorted)`, nmPositions);

  // 3. Build grid
  const grid = new Array<string>(CELL_COUNT);

  for (let i = 0; i < nmTarget; i++) {
    const pos = nmPositions[i]!;
    const val = nmValues[i]!;
    grid[pos] = val;
    console.log(`[ScratchGrid] buildLosingYWithNearMiss — step 5: place near-miss ${i + 1}/${nmTarget} → cell ${pos} = "${val}"`);
  }

  // 4. Forbidden: all W numbers + all placed near-miss values
  const forbidden = new Uint8Array(100);
  for (const n of wNums) forbidden[n] = 1;
  for (const v of nmValues) forbidden[parseInt(v, 10)] = 1;

  const pool = buildAllowedPool(forbidden);
  console.log(
    `[ScratchGrid] buildLosingYWithNearMiss — step 6: filler pool size=${pool.length} (forbid W ∪ near-miss values)`,
  );
  let poolIdx = 0;

  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== undefined) continue;
    grid[i] = formatCell(pool[poolIdx++]!);
  }

  console.log(`[ScratchGrid] buildLosingYWithNearMiss — step 7: Y grid complete`);
  console.log(`[ScratchGrid] buildLosingYWithNearMiss — Y: [${grid.join(', ')}]`);
  console.log(`[ScratchGrid] buildLosingYWithNearMiss — near-miss positions: [${nmPositions.join(', ')}]`);

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
  console.log(`[ScratchGrid] buildScratchGrid — START mode=${isLoss ? 'LOSING' : 'WINNING'} hitCount=${hitCount}`);

  console.log(`[ScratchGrid] phase A — drawSpreadWNumbers()`);
  const w = drawSpreadWNumbers();

  if (isLoss) {
    console.log(`[ScratchGrid] phase B — buildLosingYWithNearMiss(w)`);
    const { y, nearMissPositions } = buildLosingYWithNearMiss(w);
    console.log(`[ScratchGrid] buildScratchGrid — END (loss) nearMiss count=${nearMissPositions.length}`);
    return { w, y, nearMissPositions };
  }

  console.log(`[ScratchGrid] phase B — buildWinningY(w, ${hitCount})`);
  const y = buildWinningY(w, hitCount);
  console.log(`[ScratchGrid] buildScratchGrid — END (win) nearMissPositions=[]`);
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
  console.log(`[ScratchGrid] assertScratchValid — checking (isLoss=${isLoss}, hitCount=${hitCount})`);
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
    console.log(`[ScratchGrid] assertScratchValid — loss rules OK (Y∩W=∅, ${nearMissPositions.length} near-misses)`);
    return;
  }

  const hits = y.filter((v) => wSet.has(v));
  if (hits.length !== hitCount) throw new Error('Winning ticket: wrong hit count');
  if (new Set(hits).size !== hitCount) throw new Error('Winning hits must use distinct W values');
  if (nearMissPositions.length !== 0) throw new Error('Near-miss only valid on losing tickets');
  console.log(`[ScratchGrid] assertScratchValid — win rules OK (${hitCount} distinct hits, no near-miss rows)`);
}
