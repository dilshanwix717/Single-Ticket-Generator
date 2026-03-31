import type { AmountTier } from '../types/win-tier';
import { shuffleInPlace, randomIntInclusive } from '../utils/random.utils';

/**
 * ============================================================
 *  AMOUNT LAYOUT ENGINE
 * ============================================================
 * Purpose: assign a dollar amount (and its prize tier) to each of the
 * 20 scratch cells that already have Y numbers from the scratch grid.
 *
 * Tier budget (losing tickets, and the baseline before wins eat slots):
 *   Low      4 cells   ($1.50–$4)
 *   Medium   4 cells   ($5–$15)
 *   High     6 cells   ($20–$50)
 *   Jackpot  6 cells   ($200 / $800)
 *                         —— total 20 cells
 *
 * Winning tickets: some cells are "hits" — they must show the exact prize
 * amounts from the winning combination. Those are placed first; the rest
 * of the tier counts are filled with random draws from the official pools.
 *
 * Losing tickets: near-miss cells get higher-tier amounts first (better
 * optics), then remaining cells are filled from what's left.
 * ============================================================
 */

/** Legal dollar values for Low tier cells (must match game rules). */
const LOW_POOL = [1.5, 2, 2.5, 3, 4];
/** Legal dollar values for Medium tier cells. */
const MED_POOL = [5, 6, 8, 10, 12, 15];
/** Legal dollar values for High tier cells. */
const HIGH_POOL = [20, 25, 30, 40, 50];
/** Legal dollar values for Jackpot tier cells (only two denominations). */
const JACKPOT_POOL = [200, 800];

/**
 * One cell's prize: the numeric amount shown and which band it belongs to
 * for validation and display rules.
 */
export interface AmountTaggedCell {
  value: number;
  tier: AmountTier;
}

// ─────────────────────────────────────────────────────────────
// TIER CLASSIFIER
// ─────────────────────────────────────────────────────────────

/**
 * Figures out which tier a dollar amount belongs to by looking it up in
 * the official pools. Throws if the value is not in any pool — that means
 * the caller passed an invalid combination amount.
 */
function inferTierForAmount(value: number): AmountTier {
  if (LOW_POOL.includes(value)) return 'Low';
  if (MED_POOL.includes(value)) return 'Medium';
  if (HIGH_POOL.includes(value)) return 'High';
  if (JACKPOT_POOL.includes(value)) return 'Jackpot';
  throw new Error(`Unsupported amount: ${value}`);
}

// ─────────────────────────────────────────────────────────────
// RANDOM TIER CELLS (fills "remaining" slots for a tier)
// ─────────────────────────────────────────────────────────────

/**
 * Builds `cells` random prize cells for one tier, using only values from
 * `pool`. Steps:
 * 1. Copy and shuffle the pool so we pick denominations in random order.
 * 2. Choose how many *distinct* denominations will appear (rules vary by
 *    tier; Jackpot is capped at 2 distinct values).
 * 3. Take the first `distinctCount` entries from the shuffled copy as the
 *    set of denominations we may repeat.
 * 4. For each output cell, pick one of those denominations at random
 *    (uniform index) — so repeats are allowed, but only among that set.
 */
function buildRandomTierCells(tier: AmountTier, pool: number[], cells: number): AmountTaggedCell[] {
  if (cells <= 0) return [];

  const copy = [...pool];
  shuffleInPlace(copy);

  // How many different dollar values may appear in this tier's random batch.
  const maxDistinct = Math.min(pool.length, cells, tier === 'Jackpot' ? 2 : 4);
  const minDistinct = Math.min(2, maxDistinct);
  const distinctCount = randomIntInclusive(minDistinct, maxDistinct);
  // First N shuffled pool values = the only denominations used in this batch.
  const denoms = copy.slice(0, distinctCount);

  const out: AmountTaggedCell[] = new Array(cells);
  for (let i = 0; i < cells; i++) {
    // Pick any of the chosen denominations at random for this cell.
    out[i] = { value: denoms[randomIntInclusive(0, denoms.length - 1)]!, tier };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// NEAR-MISS PRIORITY PLACEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Removes and returns the first cell in `pool` that matches `tier`.
 * `splice` mutates `pool` so that cell is no longer available — important
 * so we never assign the same physical cell object twice.
 * Returns undefined if no cell of that tier is left.
 */
function takeFirstOfTier(pool: AmountTaggedCell[], tier: AmountTier): AmountTaggedCell | undefined {
  const idx = pool.findIndex((c) => c.tier === tier);
  if (idx === -1) return undefined;
  return pool.splice(idx, 1)[0];
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

export function buildAmountLayout(input: {
  hitPositions: number[];
  hitAmounts: number[];
  nearMissPositions: number[];
}): {
  amounts: number[];
  tiers: AmountTier[];
} {
  const { hitPositions, hitAmounts, nearMissPositions } = input;

  console.log(`[AmountLayout] ========== buildAmountLayout START ==========`);
  console.log(`[AmountLayout] step 0 — input`, {
    hitPositions: [...hitPositions].sort((a, b) => a - b),
    hitAmounts: [...hitAmounts],
    nearMissPositions: [...nearMissPositions].sort((a, b) => a - b),
    nearMissCount: nearMissPositions.length,
  });

  // hitPositions[i] must correspond to hitAmounts[i] — same index, same prize.
  if (hitPositions.length !== hitAmounts.length) {
    throw new Error('hitPositions and hitAmounts must have the same length');
  }

  // Count how many winning amounts fall in each tier (those slots won't need
  // a random draw for that tier — we subtract them from the tier budget).
  const hitByTier: Record<AmountTier, AmountTaggedCell[]> = {
    Low: [],
    Medium: [],
    High: [],
    Jackpot: [],
  };

  for (const amt of hitAmounts) {
    const tier = inferTierForAmount(amt);
    hitByTier[tier].push({ value: amt, tier });
  }
  console.log(`[AmountLayout] step 1 — hits grouped by tier (from hitAmounts)`, {
    Low: hitByTier.Low.map((c) => c.value),
    Medium: hitByTier.Medium.map((c) => c.value),
    High: hitByTier.High.map((c) => c.value),
    Jackpot: hitByTier.Jackpot.map((c) => c.value),
  });

  // Fixed layout: each tier owns a fixed number of cells across the whole ticket.
  const tierSpecs = [
    { tier: 'Low' as const, pool: LOW_POOL, total: 4 },
    { tier: 'Medium' as const, pool: MED_POOL, total: 4 },
    { tier: 'High' as const, pool: HIGH_POOL, total: 6 },
    { tier: 'Jackpot' as const, pool: JACKPOT_POOL, total: 6 },
  ];

  // `remaining`: all prize cells that are NOT yet pinned to a hit — we will
  // place them on non-hit, non-near-miss slots later, after near-miss picks.
  const remaining: AmountTaggedCell[] = [];
  for (const spec of tierSpecs) {
    const hitsInTier = hitByTier[spec.tier].length;
    if (hitsInTier > spec.total) {
      throw new Error(`Too many hit amounts for tier ${spec.tier}`);
    }
    // Example: 4 Low slots total, 1 hit is Low → build 3 random Low cells.
    const randomCells = spec.total - hitsInTier;
    console.log(
      `[AmountLayout] step 2 — tier "${spec.tier}": hits=${hitsInTier}/${spec.total}, generating ${randomCells} random cell(s) from pool`,
    );
    const built = buildRandomTierCells(spec.tier, spec.pool, randomCells);
    remaining.push(...built);
  }
  console.log(`[AmountLayout] step 2 — remaining pool (pre-placement) total cells=${remaining.length}`, {
    byTier: {
      Low: remaining.filter((c) => c.tier === 'Low').length,
      Medium: remaining.filter((c) => c.tier === 'Medium').length,
      High: remaining.filter((c) => c.tier === 'High').length,
      Jackpot: remaining.filter((c) => c.tier === 'Jackpot').length,
    },
  });

  // One entry per scratch cell index 0..19; null = not filled yet.
  const grid = new Array<AmountTaggedCell | null>(20).fill(null);

  // Place winning combination amounts on hit cells. Sort positions so
  // "first hit cell index" pairs with hitAmounts[0] in a stable order.
  const orderedHitPositions = [...hitPositions].sort((a, b) => a - b);
  console.log(`[AmountLayout] step 3 — place winning amounts on hit cells (sorted by cell index)`);
  for (let i = 0; i < orderedHitPositions.length; i++) {
    const amt = hitAmounts[i]!;
    const cellIdx = orderedHitPositions[i]!;
    const tier = inferTierForAmount(amt);
    grid[cellIdx] = { value: amt, tier };
    console.log(
      `[AmountLayout] step 3 — hit ${i + 1}/${orderedHitPositions.length}: cell ${cellIdx} ← $${amt} (${tier}) [pairing: sorted hit index i=${i}]`,
    );
  }

  // Near-miss: pull the best tiers still available in `remaining` first
  // (Jackpot → High → Medium → Low), up to 2 slots per tier wave, until
  // every near-miss index has a value or we run out of matching tier cells.
  const priority: AmountTier[] = ['Jackpot', 'High', 'Medium', 'Low'];
  const nmOrder = [...nearMissPositions];
  shuffleInPlace(nmOrder);
  console.log(`[AmountLayout] step 4 — near-miss priority fill (tier order ${priority.join(' → ')})`);
  console.log(`[AmountLayout] step 4 — near-miss cell order (shuffled)`, nmOrder);

  let nmCursor = 0;
  for (const tier of priority) {
    for (let k = 0; k < 2 && nmCursor < nmOrder.length; k++) {
      const cell = takeFirstOfTier(remaining, tier);
      if (!cell) continue;
      const pos = nmOrder[nmCursor++]!;
      grid[pos] = cell;
      console.log(
        `[AmountLayout] step 4 — near-miss slot ${nmCursor}/${nmOrder.length}: cell ${pos} ← $${cell.value} (${tier}) [round ${k + 1} in tier wave]`,
      );
    }
  }
  console.log(`[AmountLayout] step 4 — after near-miss, remaining count=${remaining.length}`);

  // Every index still null gets the next leftover from `remaining` in random order.
  const emptyPositions: number[] = [];
  for (let i = 0; i < 20; i++) {
    if (grid[i] === null) emptyPositions.push(i);
  }

  shuffleInPlace(emptyPositions);
  console.log(
    `[AmountLayout] step 5 — fill ${emptyPositions.length} empty cells from remaining (shuffled positions)`,
  );
  for (let i = 0; i < emptyPositions.length; i++) {
    const pos = emptyPositions[i]!;
    const cell = remaining[i]!;
    grid[pos] = cell;
    console.log(
      `[AmountLayout] step 5 — fill ${i + 1}/${emptyPositions.length}: cell ${pos} ← $${cell.value} (${cell.tier})`,
    );
  }

  // Parallel arrays: same index = same cell (easy to serialize / validate).
  const amounts = grid.map((c) => c!.value);
  const tiers = grid.map((c) => c!.tier) as AmountTier[];
  console.log(`[AmountLayout] step 6 — final amounts (20 cells)`, amounts);
  console.log(`[AmountLayout] step 6 — final tiers (20 cells)`, tiers);
  console.log(`[AmountLayout] ========== buildAmountLayout END ==========\n`);

  return { amounts, tiers };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────

/**
 * Checks one tier band: exact cell count, allowed pool values, and that
 * the number of *distinct* denominations in that tier is within [min, max].
 */
function assertTierBand(
  amounts: number[],
  tiers: AmountTier[],
  tier: AmountTier,
  pool: number[],
  cellCount: number,
  minDistinct: number,
  maxDistinct: number,
): void {
  const vals = amounts.filter((_, i) => tiers[i] === tier);
  if (vals.length !== cellCount) throw new Error(`${tier} cell count invalid`);
  const distinct = new Set(vals).size;
  if (distinct < minDistinct || distinct > maxDistinct)
    throw new Error(`${tier} distinct denomination count invalid`);
  for (const v of vals) {
    if (!pool.includes(v)) throw new Error(`${tier} value outside pool`);
  }
}

/**
 * assertAmountLayoutValid
 * -----------------------
 * For losing tickets (hitCount === 0) the full tier distribution is
 * validated strictly (4 Low, 4 Medium, 6 High, 6 Jackpot).
 *
 * For winning tickets the hit cells carry combination values that
 * displace pool entries, so strict tier counts no longer apply —
 * only overall length and slot completeness are checked.
 */
export function assertAmountLayoutValid(amounts: number[], tiers: AmountTier[], hitCount = 0): void {
  if (amounts.length !== 20 || tiers.length !== 20) throw new Error('amount layout must be length 20');

  for (let i = 0; i < 20; i++) {
    if (amounts[i] === undefined || amounts[i] === null) throw new Error(`amount at index ${i} is missing`);
  }

  if (hitCount === 0) {
    // Full 4/4/6/6 tier grid — exact counts per tier label.
    const count = (t: AmountTier) => tiers.filter((x) => x === t).length;
    if (count('Low') !== 4 || count('Medium') !== 4 || count('High') !== 6 || count('Jackpot') !== 6)
      throw new Error('tier cell distribution invalid');

    // Jackpot row must show both $200 and $800 somewhere in the six cells.
    const jackpotVals = amounts.filter((_, i) => tiers[i] === 'Jackpot');
    if (new Set(jackpotVals).size !== 2)
      throw new Error('Jackpot must contain exactly two distinct denominations');
    for (const v of jackpotVals) {
      if (!JACKPOT_POOL.includes(v)) throw new Error('Jackpot value not from pool');
    }

    assertTierBand(amounts, tiers, 'Low', LOW_POOL, 4, 2, 4);
    assertTierBand(amounts, tiers, 'Medium', MED_POOL, 4, 2, 4);
    assertTierBand(amounts, tiers, 'High', HIGH_POOL, 6, 2, 4);
  }
  // Winning ticket: combination values occupy hit slots; tier counts will
  // differ from the losing-ticket distribution — no strict check needed.
}
