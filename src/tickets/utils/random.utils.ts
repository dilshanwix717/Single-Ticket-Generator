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

export function sampleDistinctIndices(total: number, count: number): number[] {
  const idx = Array.from({ length: total }, (_, i) => i);
  shuffleInPlace(idx);
  return idx.slice(0, count).sort((a, b) => a - b);
}
