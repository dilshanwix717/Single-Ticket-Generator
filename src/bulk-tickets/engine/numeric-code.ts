/**
 * Deterministic 14-digit ticket numeric code (PRD §7.1, the X portion).
 *
 * Built from (bet, batchId, seq) so it is globally unique by construction
 * across all bets and batches — no in-memory dedup set required.
 *
 * Uniqueness proof:
 *   1. We pack (betIndex, batchId, seq) into a 14-digit positional integer:
 *        2 digits betIndex (00..12)  +  4 digits batchId (0000..9999)  +
 *        8 digits seq      (00000000..99999999)
 *      Each (bet, batchId, seq) maps to a unique integer in [0, 10^14).
 *   2. We then apply a bijection in Z/10^14:  y = (a*x + b) mod 10^14
 *      with gcd(a, 10^14) = 1, so it is also unique.
 *   3. Bijection of a bijection ⇒ codes are unique.
 *
 * The bijection mildly obfuscates the underlying sequence so consecutive
 * tickets do not produce visually consecutive codes (PRD §7.1: must not
 * "expose sequence, bet value, or batch"). It is NOT cryptographically
 * secure — back-office tracing is still possible by inverting the map.
 */

const PRD_BETS = [1, 2, 4, 8, 10, 20, 40, 80, 100, 200, 400, 800, 1000] as const;

const MOD = 100_000_000_000_000n; // 10^14
// Coprime with 10^14 (odd, not divisible by 5).
const A = 982_451_653n;
const B = 12345678901n;

function betIndex(bet: number): number {
  const i = PRD_BETS.indexOf(bet as (typeof PRD_BETS)[number]);
  if (i === -1) throw new Error(`Invalid bet ${bet}; must be one of ${PRD_BETS.join(',')}`);
  return i;
}

export function buildNumericCode(bet: number, batchId: number, seq: number): string {
  if (!Number.isInteger(batchId) || batchId < 0 || batchId > 9999) {
    throw new Error(`batchId out of range [0,9999]: ${batchId}`);
  }
  if (!Number.isInteger(seq) || seq < 0 || seq > 99_999_999) {
    throw new Error(`seq out of range [0,99999999]: ${seq}`);
  }
  const idx = betIndex(bet);
  // 2 + 4 + 8 = 14 digits, packed left-to-right.
  const packed =
    BigInt(idx) * 1_000_000_000_000n +
    BigInt(batchId) * 100_000_000n +
    BigInt(seq);

  const mixed = (A * packed + B) % MOD;
  return mixed.toString().padStart(14, '0');
}
