import type { Recipe, WinTier } from './recipe-table.types';

/**
 * Total tickets per batch per bet (PRD §6.1).
 */
export const BATCH_SIZE = 10_000_000;

/**
 * Per-10M recipe table — direct transcription of the PRD appendix
 * "Multiplier weight table / win-tier mapping". Sum of `count` across
 * all rows must equal BATCH_SIZE.
 *
 * Note on the 8X row: the PRD percentages for 8X (0.8577%) imply 85,770
 * tickets, but the per-row counts in the appendix sum to 85,771. To keep
 * the grand total at exactly 10,000,000, the solo "[8]" bucket is set to
 * 42,884 (PRD lists 42,885). All other rows match the appendix verbatim.
 */
export const RECIPES: Recipe[] = [
  // 0X — NO WIN
  { multiplier: 0, combination: [], win_tier: 'NO_WIN', count: 7_065_750 },

  // 1.5X
  { multiplier: 1.5, combination: [1.5], win_tier: 'WIN', count: 1_143_530 },

  // 2X
  { multiplier: 2, combination: [2], win_tier: 'WIN', count: 428_830 },

  // 2.5X
  { multiplier: 2.5, combination: [2.5], win_tier: 'WIN', count: 285_890 },

  // 3X
  { multiplier: 3, combination: [1.5, 1.5], win_tier: 'WIN', count: 57_178 },
  { multiplier: 3, combination: [3], win_tier: 'WIN', count: 228_712 },

  // 4X
  { multiplier: 4, combination: [1.5, 2.5], win_tier: 'BIG_WIN', count: 25_714 },
  { multiplier: 4, combination: [2, 2], win_tier: 'BIG_WIN', count: 51_428 },
  { multiplier: 4, combination: [4], win_tier: 'BIG_WIN', count: 179_998 },

  // 5X
  { multiplier: 5, combination: [1.5, 1.5, 2], win_tier: 'BIG_WIN', count: 20_012 },
  { multiplier: 5, combination: [2.5, 2.5], win_tier: 'BIG_WIN', count: 20_012 },
  { multiplier: 5, combination: [2, 3], win_tier: 'BIG_WIN', count: 40_024 },
  { multiplier: 5, combination: [5], win_tier: 'BIG_WIN', count: 120_072 },

  // 6X
  { multiplier: 6, combination: [2, 1.5, 2.5], win_tier: 'BIG_WIN', count: 14_310 },
  { multiplier: 6, combination: [2, 2, 2], win_tier: 'BIG_WIN', count: 14_310 },
  { multiplier: 6, combination: [4, 2], win_tier: 'BIG_WIN', count: 14_310 },
  { multiplier: 6, combination: [3, 3], win_tier: 'BIG_WIN', count: 28_620 },
  { multiplier: 6, combination: [6], win_tier: 'BIG_WIN', count: 71_550 },

  // 8X — solo bucket nudged -1 (see file header note)
  { multiplier: 8, combination: [4, 2.5, 1.5], win_tier: 'BIG_WIN', count: 8_577 },
  { multiplier: 8, combination: [5, 3], win_tier: 'BIG_WIN', count: 8_577 },
  { multiplier: 8, combination: [6, 2], win_tier: 'BIG_WIN', count: 12_866 },
  { multiplier: 8, combination: [4, 4], win_tier: 'BIG_WIN', count: 12_866 },
  { multiplier: 8, combination: [8], win_tier: 'BIG_WIN', count: 42_884 },

  // 10X
  { multiplier: 10, combination: [6, 2.5, 1.5], win_tier: 'BIG_WIN', count: 1_906 },
  { multiplier: 10, combination: [4, 3, 3], win_tier: 'BIG_WIN', count: 1_906 },
  { multiplier: 10, combination: [6, 4], win_tier: 'BIG_WIN', count: 3_812 },
  { multiplier: 10, combination: [8, 2], win_tier: 'BIG_WIN', count: 3_812 },
  { multiplier: 10, combination: [5, 5], win_tier: 'BIG_WIN', count: 5_718 },
  { multiplier: 10, combination: [10], win_tier: 'BIG_WIN', count: 20_966 },

  // 12X
  { multiplier: 12, combination: [6, 4, 2], win_tier: 'BIG_WIN', count: 953 },
  { multiplier: 12, combination: [5, 4, 3], win_tier: 'BIG_WIN', count: 953 },
  { multiplier: 12, combination: [10, 2], win_tier: 'BIG_WIN', count: 953 },
  { multiplier: 12, combination: [8, 4], win_tier: 'BIG_WIN', count: 1_906 },
  { multiplier: 12, combination: [6, 6], win_tier: 'BIG_WIN', count: 2_859 },
  { multiplier: 12, combination: [12], win_tier: 'BIG_WIN', count: 11_436 },

  // 15X
  { multiplier: 15, combination: [4, 4, 4, 3], win_tier: 'SUPER_WIN', count: 715 },
  { multiplier: 15, combination: [8, 4, 3], win_tier: 'SUPER_WIN', count: 715 },
  { multiplier: 15, combination: [12, 3], win_tier: 'SUPER_WIN', count: 1_430 },
  { multiplier: 15, combination: [10, 5], win_tier: 'SUPER_WIN', count: 2_145 },
  { multiplier: 15, combination: [15], win_tier: 'SUPER_WIN', count: 9_295 },

  // 20X
  { multiplier: 20, combination: [10, 6, 4], win_tier: 'SUPER_WIN', count: 229 },
  { multiplier: 20, combination: [8, 6, 6], win_tier: 'SUPER_WIN', count: 343 },
  { multiplier: 20, combination: [12, 8], win_tier: 'SUPER_WIN', count: 801 },
  { multiplier: 20, combination: [15, 5], win_tier: 'SUPER_WIN', count: 915 },
  { multiplier: 20, combination: [10, 10], win_tier: 'SUPER_WIN', count: 1_144 },
  { multiplier: 20, combination: [20], win_tier: 'SUPER_WIN', count: 8_008 },

  // 25X
  { multiplier: 25, combination: [10, 5, 5, 5], win_tier: 'SUPER_WIN', count: 228 },
  { multiplier: 25, combination: [12, 8, 5], win_tier: 'SUPER_WIN', count: 305 },
  { multiplier: 25, combination: [15, 10], win_tier: 'SUPER_WIN', count: 610 },
  { multiplier: 25, combination: [20, 5], win_tier: 'SUPER_WIN', count: 762 },
  { multiplier: 25, combination: [25], win_tier: 'SUPER_WIN', count: 5_715 },

  // 30X
  { multiplier: 30, combination: [10, 10, 5, 5], win_tier: 'SUPER_WIN', count: 114 },
  { multiplier: 30, combination: [12, 10, 8], win_tier: 'SUPER_WIN', count: 172 },
  { multiplier: 30, combination: [15, 15], win_tier: 'SUPER_WIN', count: 400 },
  { multiplier: 30, combination: [20, 10], win_tier: 'SUPER_WIN', count: 572 },
  { multiplier: 30, combination: [30], win_tier: 'SUPER_WIN', count: 4_462 },

  // 40X
  { multiplier: 40, combination: [12, 8, 10, 10], win_tier: 'MEGA_WIN', count: 76 },
  { multiplier: 40, combination: [25, 15], win_tier: 'MEGA_WIN', count: 114 },
  { multiplier: 40, combination: [30, 10], win_tier: 'MEGA_WIN', count: 191 },
  { multiplier: 40, combination: [20, 20], win_tier: 'MEGA_WIN', count: 305 },
  { multiplier: 40, combination: [40], win_tier: 'MEGA_WIN', count: 3_124 },

  // 50X
  { multiplier: 50, combination: [20, 12, 10, 8], win_tier: 'MEGA_WIN', count: 28 },
  { multiplier: 50, combination: [20, 15, 15], win_tier: 'MEGA_WIN', count: 29 },
  { multiplier: 50, combination: [25, 25], win_tier: 'MEGA_WIN', count: 86 },
  { multiplier: 50, combination: [40, 10], win_tier: 'MEGA_WIN', count: 114 },
  { multiplier: 50, combination: [30, 20], win_tier: 'MEGA_WIN', count: 172 },
  { multiplier: 50, combination: [50], win_tier: 'MEGA_WIN', count: 2_431 },

  // 200X
  { multiplier: 200, combination: [50, 50, 50, 50], win_tier: 'MEGA_WIN', count: 48 },
  { multiplier: 200, combination: [200], win_tier: 'MEGA_WIN', count: 902 },

  // 800X
  { multiplier: 800, combination: [200, 200, 200, 200], win_tier: 'JACKPOT', count: 5 },
  { multiplier: 800, combination: [800], win_tier: 'JACKPOT', count: 95 },
];

export function totalRecipeCount(): number {
  let total = 0;
  for (const r of RECIPES) total += r.count;
  return total;
}

export function countsByWinTier(): Record<WinTier, number> {
  const out: Record<WinTier, number> = {
    NO_WIN: 0,
    WIN: 0,
    BIG_WIN: 0,
    SUPER_WIN: 0,
    MEGA_WIN: 0,
    JACKPOT: 0,
  };
  for (const r of RECIPES) out[r.win_tier] += r.count;
  return out;
}

export function assertRecipeTotals(): void {
  const total = totalRecipeCount();
  if (total !== BATCH_SIZE) {
    throw new Error(
      `Recipe table count mismatch: sum=${total}, expected=${BATCH_SIZE} (diff=${total - BATCH_SIZE})`,
    );
  }
  for (const r of RECIPES) {
    if (!Number.isInteger(r.count) || r.count <= 0) {
      throw new Error(`Recipe has invalid count: ${JSON.stringify(r)}`);
    }
    if (r.combination.length > 4) {
      throw new Error(`Recipe combination too long (>4 hits): ${JSON.stringify(r)}`);
    }
    const comboSum = r.combination.reduce((a, b) => a + b, 0);
    if (r.combination.length > 0 && Math.abs(comboSum - r.multiplier) > 1e-9) {
      throw new Error(
        `Recipe combination sum (${comboSum}) does not equal multiplier (${r.multiplier}): ${JSON.stringify(r)}`,
      );
    }
  }
}
