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
  const scratch = buildScratchGrid(hitCount, isLoss);

  assertScratchValid(scratch.w, scratch.y, scratch.nearMissPositions, hitCount, isLoss);

  const wSet = new Set(scratch.w);
  const hitPositions: number[] = [];
  for (let i = 0; i < scratch.y.length; i++) {
    if (wSet.has(scratch.y[i]!)) hitPositions.push(i);
  }

  const { amounts, tiers } = buildAmountLayout({
    hitPositions,
    hitAmounts,
    nearMissPositions: scratch.nearMissPositions,
  });

  assertAmountLayoutValid(amounts, tiers);

  return {
    w_numbers: scratch.w,
    y_numbers: scratch.y,
    near_miss_positions: scratch.nearMissPositions,
    amount_layout: { amounts, tiers },
  };
}

export function newTicketId(): string {
  return ulid();
}

export function formatTicketNumber(ulidStr: string): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return buildTicketNo(ymd, ulidStr);
}
