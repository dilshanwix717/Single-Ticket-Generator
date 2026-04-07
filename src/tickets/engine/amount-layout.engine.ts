import type { AmountTier } from '../types/win-tier';
import { shuffleInPlace, randomIntInclusive } from '../utils/random.utils';

const DEBUG_TICKETS = process.env['DEBUG_TICKETS'] === '1';

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

function inferTierForAmount(value: number): AmountTier {
  if (LOW_POOL.includes(value)) return 'Low';
  if (MED_POOL.includes(value)) return 'Medium';
  if (HIGH_POOL.includes(value)) return 'High';
  if (JACKPOT_POOL.includes(value)) return 'Jackpot';
  throw new Error(`Unsupported amount: ${value}`);
}

// ─────────────────────────────────────────────────────────────
// RANDOM TIER CELLS
// ─────────────────────────────────────────────────────────────

function buildRandomTierCells(tier: AmountTier, pool: number[], cells: number): AmountTaggedCell[] {
  if (cells <= 0) return [];

  const copy = [...pool];
  shuffleInPlace(copy);

  const maxDistinct = Math.min(pool.length, cells, tier === 'Jackpot' ? 2 : 4);
  const minDistinct = Math.min(2, maxDistinct);
  const distinctCount = randomIntInclusive(minDistinct, maxDistinct);
  const denoms = copy.slice(0, distinctCount);

  const out: AmountTaggedCell[] = [];
  const denomsShuffled = [...denoms];
  shuffleInPlace(denomsShuffled);
  for (const d of denomsShuffled) {
    out.push({ value: d, tier });
  }
  for (let i = distinctCount; i < cells; i++) {
    out.push({ value: denoms[randomIntInclusive(0, denoms.length - 1)]!, tier });
  }
  shuffleInPlace(out);
  return out;
}

// ─────────────────────────────────────────────────────────────
// NEAR-MISS PRIORITY PLACEMENT
// ─────────────────────────────────────────────────────────────

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

  if (DEBUG_TICKETS) {
    console.log(`[AmountLayout] ========== buildAmountLayout START ==========`);
    console.log(`[AmountLayout] step 0 — input`, {
      hitPositions: [...hitPositions].sort((a, b) => a - b),
      hitAmounts: [...hitAmounts],
      nearMissPositions: [...nearMissPositions].sort((a, b) => a - b),
    });
  }

  if (hitPositions.length !== hitAmounts.length) {
    throw new Error('hitPositions and hitAmounts must have the same length');
  }

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

  if (DEBUG_TICKETS) {
    console.log(`[AmountLayout] step 1 — hits by tier`, {
      Low: hitByTier.Low.map((c) => c.value),
      Medium: hitByTier.Medium.map((c) => c.value),
      High: hitByTier.High.map((c) => c.value),
      Jackpot: hitByTier.Jackpot.map((c) => c.value),
    });
  }

  const tierSpecs = [
    { tier: 'Low' as const, pool: LOW_POOL, total: 4 },
    { tier: 'Medium' as const, pool: MED_POOL, total: 4 },
    { tier: 'High' as const, pool: HIGH_POOL, total: 6 },
    { tier: 'Jackpot' as const, pool: JACKPOT_POOL, total: 6 },
  ];

  const remaining: AmountTaggedCell[] = [];
  for (const spec of tierSpecs) {
    const hitsInTier = hitByTier[spec.tier].length;
    if (hitsInTier > spec.total) {
      throw new Error(`Too many hit amounts for tier ${spec.tier}`);
    }
    const randomCells = spec.total - hitsInTier;
    if (DEBUG_TICKETS) {
      console.log(`[AmountLayout] step 2 — tier "${spec.tier}": hits=${hitsInTier}/${spec.total}, generating ${randomCells} random cell(s)`);
    }
    const built = buildRandomTierCells(spec.tier, spec.pool, randomCells);
    remaining.push(...built);
  }

  const grid = new Array<AmountTaggedCell | null>(20).fill(null);

  const orderedHitPositions = [...hitPositions].sort((a, b) => a - b);
  for (let i = 0; i < orderedHitPositions.length; i++) {
    const amt = hitAmounts[i]!;
    const cellIdx = orderedHitPositions[i]!;
    const tier = inferTierForAmount(amt);
    grid[cellIdx] = { value: amt, tier };
    if (DEBUG_TICKETS) {
      console.log(`[AmountLayout] step 3 — hit ${i + 1}/${orderedHitPositions.length}: cell ${cellIdx} ← $${amt} (${tier})`);
    }
  }

  const priority: AmountTier[] = ['Jackpot', 'High', 'Medium', 'Low'];
  const nmOrder = [...nearMissPositions];
  shuffleInPlace(nmOrder);

  let nmCursor = 0;
  for (const tier of priority) {
    for (let k = 0; k < 2 && nmCursor < nmOrder.length; k++) {
      const cell = takeFirstOfTier(remaining, tier);
      if (!cell) continue;
      const pos = nmOrder[nmCursor++]!;
      grid[pos] = cell;
      if (DEBUG_TICKETS) {
        console.log(`[AmountLayout] step 4 — near-miss slot ${nmCursor}: cell ${pos} ← $${cell.value} (${tier})`);
      }
    }
  }

  const emptyPositions: number[] = [];
  for (let i = 0; i < 20; i++) {
    if (grid[i] === null) emptyPositions.push(i);
  }

  shuffleInPlace(emptyPositions);
  for (let i = 0; i < emptyPositions.length; i++) {
    const pos = emptyPositions[i]!;
    const cell = remaining[i]!;
    grid[pos] = cell;
    if (DEBUG_TICKETS) {
      console.log(`[AmountLayout] step 5 — fill ${i + 1}/${emptyPositions.length}: cell ${pos} ← $${cell.value} (${cell.tier})`);
    }
  }

  const amounts = grid.map((c) => c!.value);
  const tiers = grid.map((c) => c!.tier) as AmountTier[];

  if (DEBUG_TICKETS) {
    console.log(`[AmountLayout] step 6 — final amounts`, amounts);
    console.log(`[AmountLayout] step 6 — final tiers`, tiers);
    console.log(`[AmountLayout] ========== buildAmountLayout END ==========\n`);
  }

  return { amounts, tiers };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION  (dev/CI safety net — skipped in production)
// ─────────────────────────────────────────────────────────────

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

export function assertAmountLayoutValid(amounts: number[], tiers: AmountTier[], hitCount = 0): void {
  if (amounts.length !== 20 || tiers.length !== 20) throw new Error('amount layout must be length 20');

  for (let i = 0; i < 20; i++) {
    if (amounts[i] === undefined || amounts[i] === null) throw new Error(`amount at index ${i} is missing`);
  }

  if (hitCount === 0) {
    const count = (t: AmountTier) => tiers.filter((x) => x === t).length;
    if (count('Low') !== 4 || count('Medium') !== 4 || count('High') !== 6 || count('Jackpot') !== 6)
      throw new Error('tier cell distribution invalid');

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
}
