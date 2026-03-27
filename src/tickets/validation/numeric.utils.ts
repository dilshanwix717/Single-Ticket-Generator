const EPS = 1e-9;

export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

export function roundMoney(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function sumCombination(combo: number[]): number {
  return combo.reduce((s, x) => s + x, 0);
}

/** Multiset fingerprint for combination matching (order-independent). */
export function comboFingerprint(values: number[]): string {
  const sorted = [...values].map(roundMoney).sort((a, b) => a - b);
  return sorted.join('|');
}
