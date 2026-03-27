import type { AmountTier } from '../types/win-tier';
import { shuffleInPlace, randomIntInclusive } from '../utils/random.utils';

/**
 * Amount layout (20 prize cells)
 * ------------------------------
 * We first build the correct *multiset* of amounts per band (Low/Medium/High/Jackpot),
 * respecting how many distinct denominations each band may use. Jackpot always uses both
 * pool values across its six cells. Then we place amounts onto the 20 positions: near-miss
 * indices (only on losing tickets) receive the high-priority bands first (Jackpot, High,
 * Medium, Low), two slots each when available. Remaining positions consume the leftover
 * multiset in random order. The final `amounts` array is the persisted playfield order.
 */

const LOW_POOL = [1.5, 2, 2.5, 3, 4];
const MED_POOL = [5, 6, 8, 10, 12, 15];
const HIGH_POOL = [20, 25, 30, 40, 50];
const JACKPOT_POOL = [200, 800];

export interface AmountTaggedCell {
  value: number;
  tier: AmountTier;
}

function pickDistinctFromPool(pool: number[], count: number): number[] {
  if (count > pool.length) {
    throw new Error('pool too small for distinct pick');
  }
  const copy = [...pool];
  shuffleInPlace(copy);
  return copy.slice(0, count);
}

/**
 * Low / Medium / High: pick 2–4 distinct denominations from the pool, then fill the
 * required number of cells using those denominations (duplicates allowed).
 */
function buildTierMultiset(
  tier: AmountTier,
  pool: number[],
  cells: number,
  minDistinct: number,
  maxDistinct: number,
): AmountTaggedCell[] {
  const d = randomIntInclusive(minDistinct, maxDistinct);
  const denoms = pickDistinctFromPool(pool, d);
  const out: AmountTaggedCell[] = [];
  for (let i = 0; i < cells; i++) {
    const v = denoms[randomIntInclusive(0, denoms.length - 1)]!;
    out.push({ value: v, tier });
  }
  return out;
}

/**
 * Jackpot tier always uses exactly the two pool values across six cells (duplicates OK).
 */
function buildJackpotMultiset(): AmountTaggedCell[] {
  const out: AmountTaggedCell[] = [];
  for (let i = 0; i < 6; i++) {
    const v = JACKPOT_POOL[randomIntInclusive(0, JACKPOT_POOL.length - 1)]!;
    out.push({ value: v, tier: 'Jackpot' });
  }
  return out;
}

function removeFirstOfTier(
  remaining: AmountTaggedCell[],
  tier: AmountTier,
): AmountTaggedCell | undefined {
  const idx = remaining.findIndex((c) => c.tier === tier);
  if (idx === -1) return undefined;
  const [cell] = remaining.splice(idx, 1);
  return cell;
}

/**
 * Merges tier multisets, then places values on the grid. Near-miss indices are filled
 * first using the priority ladder (two Jackpot slots, two High, …) when possible.
 */
export function buildAmountLayout(nmPositions: number[]): {
  amounts: number[];
  tiers: AmountTier[];
} {
  const low = buildTierMultiset('Low', LOW_POOL, 4, 2, 4);
  const med = buildTierMultiset('Medium', MED_POOL, 4, 2, 4);
  const high = buildTierMultiset('High', HIGH_POOL, 6, 2, 4);
  const jack = buildJackpotMultiset();
  const all: AmountTaggedCell[] = [...low, ...med, ...high, ...jack];
  if (all.length !== 20) {
    throw new Error('internal: amount multiset must be length 20');
  }

  const remaining = [...all];
  shuffleInPlace(remaining);

  const grid: (AmountTaggedCell | null)[] = Array(20).fill(null);

  const priority: AmountTier[] = ['Jackpot', 'High', 'Medium', 'Low'];
  const nmOrder = [...nmPositions];
  shuffleInPlace(nmOrder);

  let nmCursor = 0;
  for (const tier of priority) {
    for (let k = 0; k < 2 && nmCursor < nmOrder.length; k++) {
      const cell = removeFirstOfTier(remaining, tier);
      if (!cell) {
        continue;
      }
      const pos = nmOrder[nmCursor++]!;
      grid[pos] = cell;
    }
  }

  const empty: number[] = [];
  for (let i = 0; i < 20; i++) {
    if (grid[i] == null) {
      empty.push(i);
    }
  }
  shuffleInPlace(empty);
  shuffleInPlace(remaining);
  for (const i of empty) {
    const cell = remaining.pop();
    if (!cell) {
      throw new Error('internal: amount assignment underflow');
    }
    grid[i] = cell;
  }

  const amounts = grid.map((c) => c!.value);
  const tiers = grid.map((c) => c!.tier);
  return { amounts, tiers };
}

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
  if (vals.length !== cellCount) {
    throw new Error(`${tier} tier cell count invalid`);
  }
  const distinct = new Set(vals).size;
  if (distinct < minDistinct || distinct > maxDistinct) {
    throw new Error(`${tier} distinct denomination count invalid`);
  }
  for (const v of vals) {
    if (!pool.includes(v)) {
      throw new Error(`${tier} value outside pool`);
    }
  }
}

/** Verifies pool quotas, jackpot two-denom rule, and per-tier distinct counts. */
export function assertAmountLayoutValid(amounts: number[], tiers: AmountTier[]): void {
  if (amounts.length !== 20 || tiers.length !== 20) {
    throw new Error('amount layout must be length 20');
  }
  const count = (t: AmountTier) => tiers.filter((x) => x === t).length;
  if (count('Low') !== 4 || count('Medium') !== 4 || count('High') !== 6 || count('Jackpot') !== 6) {
    throw new Error('tier cell distribution invalid');
  }

  const jackpotVals = amounts.filter((_, i) => tiers[i] === 'Jackpot');
  if (new Set(jackpotVals).size !== 2) {
    throw new Error('Jackpot tier must contain exactly two distinct denominations');
  }
  for (const v of jackpotVals) {
    if (!JACKPOT_POOL.includes(v)) {
      throw new Error('Jackpot value not from pool');
    }
  }

  assertTierBand(amounts, tiers, 'Low', LOW_POOL, 4, 2, 4);
  assertTierBand(amounts, tiers, 'Medium', MED_POOL, 4, 2, 4);
  assertTierBand(amounts, tiers, 'High', HIGH_POOL, 6, 2, 4);
}
