import { BadRequestException } from '@nestjs/common';
import { loadWeightTable } from './weight-table';
import {
  comboFingerprint,
  nearlyEqual,
  roundMoney,
  sumCombination,
} from './numeric.utils';
import type { WinTier } from '../types/win-tier';

/**
 * Ticket validation (request + reference table)
 * ---------------------------------------------
 * The API trusts `multiplier` and `combination` from the client, but we still prove they
 * are internally consistent (sum, emptiness rules) and that they match one canonical
 * row in `weight-table.json`. That stops "invented" payouts that are not in the product
 * definition, even if someone tampers with the JSON body.
 */

/**
 * Validates request-level numeric rules (multiplier, bet, combination emptiness, sum).
 */
export function assertBasicCombinationRules(
  multiplier: number,
  betAmount: number,
  combination: number[],
): void {
  if (betAmount <= 0) {
    throw new BadRequestException('bet_amount must be > 0');
  }
  if (multiplier < 0) {
    throw new BadRequestException('multiplier must be >= 0');
  }
  if (multiplier === 0 && combination.length !== 0) {
    throw new BadRequestException(
      'combination must be empty when multiplier is 0',
    );
  }
  if (multiplier > 0 && combination.length === 0) {
    throw new BadRequestException(
      'combination must be non-empty when multiplier > 0',
    );
  }
  if (!nearlyEqual(sumCombination(combination), multiplier)) {
    throw new BadRequestException(
      'sum(combination) must equal multiplier within tolerance',
    );
  }
}

/**
 * Maps multiplier to the win tier labels from the product spec (tiers outside the
 * reference table are still classified this way for display).
 */
export function deriveWinTier(multiplier: number): WinTier {
  if (multiplier === 0) return 'NO_WIN';
  if (multiplier <= 3) return 'WIN';
  if (multiplier <= 12) return 'BIG_WIN';
  if (multiplier <= 30) return 'SUPER_WIN';
  if (multiplier <= 100) return 'MEGA_WIN';
  return 'JACKPOT';
}

/**
 * Ensures multiplier + combination appear exactly as one row in the canonical table
 * and that the declared tier matches that row (prevents invented payouts).
 */
export function assertReferenceRow(
  multiplier: number,
  combination: number[],
): { winTier: WinTier; hitCount: number } {
  const table = loadWeightTable();
  const want = comboFingerprint(combination);
  const row = table.find(
    (r) =>
      nearlyEqual(r.multiplier, multiplier) &&
      comboFingerprint(r.combination) === want,
  );
  if (!row) {
    throw new BadRequestException(
      'multiplier and combination are not a valid pair in the reference weight table',
    );
  }
  const expectedTier = deriveWinTier(multiplier);
  if (row.win_tier !== expectedTier) {
    throw new BadRequestException(
      'reference row win_tier mismatch for multiplier',
    );
  }
  return {
    winTier: row.win_tier,
    hitCount: combination.length,
  };
}

export function assertPayout(multiplier: number, betAmount: number): number {
  const payout = roundMoney(multiplier * betAmount);
  if (!Number.isFinite(payout)) {
    throw new BadRequestException('invalid payout');
  }
  return payout;
}
