import { ulid } from 'ulid';
import { assertAmountLayoutValid, buildAmountLayout } from './amount-layout.engine';
import { assertScratchValid, buildScratchGrid } from './scratch-grid.engine';
import { buildTicketNo } from './ticket-checksum';

export interface StoredAmountLayout {
  amounts: number[];
  tiers: string[];
}

export interface GeneratedTicketLayout {
  w_numbers: string[];
  y_numbers: string[];
  near_miss_positions: number[];
  amount_layout: StoredAmountLayout;
}

// /** Returns the indices in `y` that match any value in `w`. */
// function findHitPositions(w: string[], y: string[]): number[] {
//   const wSet = new Set(w);
//   const positions: number[] = [];
//   for (let i = 0; i < y.length; i++) {
//     if (wSet.has(y[i]!)) positions.push(i);
//   }
//   return positions;
// }

/**
 * generateTicketLayout
 * --------------------
 * Generates one complete, fully validated scratch ticket layout.
 *
 * @param hitCount    - How many Y cells match a W number (0 = loss)
 * @param isLoss      - true = losing ticket
 * @param combination - Winning combination amounts (e.g. [1.5, 1.5, 2]).
 *                      Must have exactly hitCount elements for winning tickets.
 *                      Pass [] for losing tickets.
 */
export function generateTicketLayout(
  hitCount: number,
  isLoss: boolean,
  hitAmounts: number[] = [],
): GeneratedTicketLayout {
  console.log('\n[TicketGen] ========== generateTicketLayout START ==========');
  console.log('[TicketGen] Step 0 — inputs', {
    hitCount,
    isLoss,
    hitAmounts: [...hitAmounts],
    hitAmountsLength: hitAmounts.length,
  });

  console.log('[TicketGen] Step 1 — buildScratchGrid(hitCount, isLoss)');
  const scratch = buildScratchGrid(hitCount, isLoss);
  console.log('[TicketGen] Step 1 — scratch result', {
    w: scratch.w,
    yLength: scratch.y.length,
    nearMissPositions: scratch.nearMissPositions,
  });

  console.log('[TicketGen] Step 2 — assertScratchValid(...)');
  assertScratchValid(scratch.w, scratch.y, scratch.nearMissPositions, hitCount, isLoss);
  console.log('[TicketGen] Step 2 — scratch validation passed');

  console.log('[TicketGen] Step 3 — derive hitPositions (Y indices where value ∈ W)');
  const wSet = new Set(scratch.w);
  const hitPositions: number[] = [];
  for (let i = 0; i < scratch.y.length; i++) {
    if (wSet.has(scratch.y[i]!)) hitPositions.push(i);
  }
  console.log('[TicketGen] Step 3 — hitPositions (sorted for display)', [...hitPositions].sort((a, b) => a - b));
  console.log('[TicketGen] Step 3 — hit count check', {
    expectedHits: isLoss ? 0 : hitCount,
    actualHits: hitPositions.length,
  });

  console.log('[TicketGen] Step 4 — buildAmountLayout({ hitPositions, hitAmounts, nearMissPositions })');
  const { amounts, tiers } = buildAmountLayout({
    hitPositions,
    hitAmounts,
    nearMissPositions: scratch.nearMissPositions,
  });
  console.log('[TicketGen] Step 4 — amount layout built (20 cells)');

  console.log('[TicketGen] Step 5 — assertAmountLayoutValid(amounts, tiers)');
  assertAmountLayoutValid(amounts, tiers);
  console.log('[TicketGen] Step 5 — amount layout validation passed');

  const layout: GeneratedTicketLayout = {
    w_numbers: scratch.w,
    y_numbers: scratch.y,
    near_miss_positions: scratch.nearMissPositions,
    amount_layout: { amounts, tiers },
  };
  console.log('[TicketGen] Step 6 — DONE summary', {
    w_numbers: layout.w_numbers,
    y_numbers: layout.y_numbers,
    near_miss_positions: layout.near_miss_positions,
    amount_sample: layout.amount_layout.amounts.slice(0, 5),
    tiers_summary: {
      Low: tiers.filter((t) => t === 'Low').length,
      Medium: tiers.filter((t) => t === 'Medium').length,
      High: tiers.filter((t) => t === 'High').length,
      Jackpot: tiers.filter((t) => t === 'Jackpot').length,
    },
  });
  console.log('[TicketGen] ========== generateTicketLayout END ==========\n');

  return layout;
}

export function newTicketId(): string {
  return ulid();
}

export function formatTicketNumber(ulidStr: string): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return buildTicketNo(ymd, ulidStr);
}
