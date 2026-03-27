import { ulid } from 'ulid';
import { assertAmountLayoutValid, buildAmountLayout } from './amount-layout.engine';
import {
  assertScratchValid,
  tryBuildScratchGrid,
} from './scratch-grid.engine';
import { buildTicketNo } from './ticket-checksum';

export const MAX_GENERATION_ATTEMPTS = 10;

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

/**
 * Orchestrates W/Y (plus optional near-miss) and the amount grid with bounded retries.
 * Any rule violation triggers a full regeneration attempt (new W draw, etc.).
 */
export function generateTicketLayout(
  hitCount: number,
  isLoss: boolean,
): GeneratedTicketLayout {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const scratch = tryBuildScratchGrid(hitCount, isLoss);
    if (!scratch) {
      lastErr = new Error('scratch grid could not be built for this attempt');
      continue;
    }
    try {
      const { amounts, tiers } = buildAmountLayout(scratch.nearMissPositions);
      assertScratchValid(
        scratch.w,
        scratch.y,
        scratch.nearMissPositions,
        hitCount,
        isLoss,
      );
      assertAmountLayoutValid(amounts, tiers);
      return {
        w_numbers: scratch.w,
        y_numbers: scratch.y,
        near_miss_positions: scratch.nearMissPositions,
        amount_layout: { amounts, tiers },
      };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error('ticket generation exhausted retries');
}

export function newTicketId(): string {
  return ulid();
}

/** Public ticket number: NO.YYYYMMDD-{ULID}-{mod97} (UTC date). */
export function formatTicketNumber(ulidStr: string): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return buildTicketNo(ymd, ulidStr);
}
