import { BadRequestException } from '@nestjs/common';
import { loadWeightTable } from './weight-table';
import {
  comboFingerprint,
  nearlyEqual,
  sumCombination,
} from './numeric.utils';
import type { WinTier } from '../types/win-tier';

/**
 * Ticket validation (request + reference table)
 * ---------------------------------------------
 * The API trusts `combination` from the client, but we still prove it is
 * internally consistent and matches one canonical row in `weight-table.json`.
 */

/**
 * Validates request-level numeric rules (multiplier derived from combination).
 */
export function assertBasicCombinationRules(
  multiplier: number,
  combination: number[],
): void {
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
 * Maps multiplier to the win tier labels from the product spec.
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
