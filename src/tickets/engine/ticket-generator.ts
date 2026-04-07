import { ulid } from 'ulid';
import { assertAmountLayoutValid, buildAmountLayout } from './amount-layout.engine';
import { assertScratchValid, buildScratchGrid } from './scratch-grid.engine';
import { buildTicketNo, generateNumericCode } from './ticket-checksum';

const DEBUG_TICKETS = process.env['DEBUG_TICKETS'] === '1';

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

export function generateTicketLayout(
  hitCount: number,
  isLoss: boolean,
  hitAmounts: number[] = [],
): GeneratedTicketLayout {
  if (DEBUG_TICKETS) console.log('\n[TicketGen] ========== generateTicketLayout START ==========', { hitCount, isLoss, hitAmounts });

  const scratch = buildScratchGrid(hitCount, isLoss);

  if (process.env['NODE_ENV'] !== 'production') {
    assertScratchValid(scratch.w, scratch.y, scratch.nearMissPositions, hitCount, isLoss);
  }

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

  if (process.env['NODE_ENV'] !== 'production') {
    assertAmountLayoutValid(amounts, tiers, hitCount);
  }

  if (DEBUG_TICKETS) console.log('[TicketGen] ========== generateTicketLayout END ==========\n');

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

/**
 * formatTicketNumber
 * ------------------
 * Generates a ticket number in PRD §7.1 format:
 *   NO.YYYYMMDD-XXXXXXXXXXXXXX-YYY
 * where X is a 14-digit random numeric code and YYY is a 3-digit Mod 997 check.
 */
export function formatTicketNumber(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const numericCode = generateNumericCode();
  return buildTicketNo(ymd, numericCode);
}
