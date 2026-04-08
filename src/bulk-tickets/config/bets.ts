/**
 * Single source of truth for the 13 PRD bet tiers.
 * Any code that needs to validate, iterate, or index bets must import from here.
 */
export const PRD_BETS = [1, 2, 4, 8, 10, 20, 40, 80, 100, 200, 400, 800, 1000] as const;

export type PrdBet = (typeof PRD_BETS)[number];

export function isPrdBet(bet: number): bet is PrdBet {
  return (PRD_BETS as readonly number[]).includes(bet);
}

export function prdBetIndex(bet: number): number {
  const i = (PRD_BETS as readonly number[]).indexOf(bet);
  if (i === -1) {
    throw new Error(`Invalid bet ${bet}; must be one of ${PRD_BETS.join(',')}`);
  }
  return i;
}
