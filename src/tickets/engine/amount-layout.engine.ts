import type { AmountTier } from '../types/win-tier';
import { shuffleInPlace, randomIntInclusive } from '../utils/random.utils';

/**
 * ============================================================
 *  AMOUNT LAYOUT ENGINE  (optimized)
 * ============================================================
 * Assigns prize dollar amounts to all 20 Y cells.
 *
 * Tier allocations:
 *   Low     4 cells  •  Medium  4 cells
 *   High    6 cells  •  Jackpot 6 cells  =  20 total
 *
 * For winning tickets, hit positions are pre-pinned to the exact
 * combination values before the random pool fills remaining cells.
 * ============================================================
 */

const LOW_POOL = [1.5, 2, 2.5, 3, 4];
const MED_POOL = [5, 6, 8, 10, 12, 15];
const HIGH_POOL = [20, 25, 30, 40, 50];
const JACKPOT_POOL = [200, 800];

export interface AmountTaggedCell {
  value: number;
  tier: AmountTier;
}

// ─────────────────────────────────────────────────────────────
// TIER CLASSIFIER
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// POOL BUILDERS
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// NEAR-MISS PRIORITY PLACEMENT
// ─────────────────────────────────────────────────────────────

function inferTierForAmount(value: number): AmountTier {
  if (LOW_POOL.includes(value)) return 'Low';
  if (MED_POOL.includes(value)) return 'Medium';
  if (HIGH_POOL.includes(value)) return 'High';
  if (JACKPOT_POOL.includes(value)) return 'Jackpot';
  throw new Error(`Unsupported amount: ${value}`);
}

function buildRandomTierCells(tier: AmountTier, pool: number[], cells: number): AmountTaggedCell[] {
  if (cells <= 0) return [];

  const copy = [...pool];
  shuffleInPlace(copy);

  const maxDistinct = Math.min(pool.length, cells, tier === 'Jackpot' ? 2 : 4);
  const minDistinct = Math.min(2, maxDistinct);
  const distinctCount = randomIntInclusive(minDistinct, maxDistinct);
  const denoms = copy.slice(0, distinctCount);

  const out: AmountTaggedCell[] = new Array(cells);
  for (let i = 0; i < cells; i++) {
    out[i] = { value: denoms[randomIntInclusive(0, denoms.length - 1)]!, tier };
  }
  return out;
}

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

  const tierSpecs = [
    { tier: 'Low' as const, pool: LOW_POOL, total: 4 },
    { tier: 'Medium' as const, pool: MED_POOL, total: 4 },
    { tier: 'High' as const, pool: HIGH_POOL, total: 6 },
    { tier: 'Jackpot' as const, pool: JACKPOT_POOL, total: 6 },
  ];

  // Build the non-hit cells, keeping the same total tier distribution.
  const remaining: AmountTaggedCell[] = [];
  for (const spec of tierSpecs) {
    const hitCount = hitByTier[spec.tier].length;
    if (hitCount > spec.total) {
      throw new Error(`Too many hit amounts for tier ${spec.tier}`);
    }
    remaining.push(...buildRandomTierCells(spec.tier, spec.pool, spec.total - hitCount));
  }

  const grid = new Array<AmountTaggedCell | null>(20).fill(null);

  // Put the actual payout amounts on the hit positions.
  const orderedHitPositions = [...hitPositions].sort((a, b) => a - b);
  for (let i = 0; i < orderedHitPositions.length; i++) {
    const amt = hitAmounts[i]!;
    grid[orderedHitPositions[i]!] = { value: amt, tier: inferTierForAmount(amt) };
  }

  // Near-miss positions should get the best remaining values first.
  const priority: AmountTier[] = ['Jackpot', 'High', 'Medium', 'Low'];
  const nmOrder = [...nearMissPositions];
  shuffleInPlace(nmOrder);

  let nmCursor = 0;
  for (const tier of priority) {
    for (let k = 0; k < 2 && nmCursor < nmOrder.length; k++) {
      const cell = takeFirstOfTier(remaining, tier);
      if (!cell) continue;
      grid[nmOrder[nmCursor++]!] = cell;
    }
  }

  // Fill everything else.
  const emptyPositions: number[] = [];
  for (let i = 0; i < 20; i++) {
    if (grid[i] === null) emptyPositions.push(i);
  }

  shuffleInPlace(emptyPositions);
  for (let i = 0; i < emptyPositions.length; i++) {
    grid[emptyPositions[i]!] = remaining[i]!;
  }

  return {
    amounts: grid.map((c) => c!.value),
    tiers: grid.map((c) => c!.tier) as AmountTier[],
  };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION
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

  // Every slot must be populated regardless of ticket type
  for (let i = 0; i < 20; i++) {
    if (amounts[i] === undefined || amounts[i] === null) throw new Error(`amount at index ${i} is missing`);
  }

  if (hitCount === 0) {
    // Losing ticket — enforce strict tier distribution
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
  // Winning ticket: combination values occupy hit slots; tier counts will
  // differ from the losing-ticket distribution — no strict check needed.
}
