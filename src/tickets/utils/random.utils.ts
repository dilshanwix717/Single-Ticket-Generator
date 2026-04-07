/** Small crypto-safe / uniform helpers used by the ticket engine (bounded, O(1) memory). */

export function randomIntInclusive(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntInclusive(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * sampleDistinctIndices
 * ---------------------
 * Returns `count` distinct random indices from [0, total).
 * Uses partial Fisher-Yates — stops after `count` swaps instead of
 * shuffling all `total` elements.  O(count) instead of O(total).
 */
export function sampleDistinctIndices(total: number, count: number): number[] {
  const idx = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + randomIntInclusive(0, total - 1 - i);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, count).sort((a, b) => a - b);
}
