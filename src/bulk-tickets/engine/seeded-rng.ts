/**
 * mulberry32 — small, fast, deterministic 32-bit PRNG.
 * Returns a function that yields a uint32 on each call.
 * Good enough for shuffling a 10M-element bag (period ~2^32).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/**
 * Returns an integer in [0, max) using rejection sampling on a uint32 source
 * to avoid modulo bias.
 */
export function makeBoundedIntFn(rngU32: () => number): (max: number) => number {
  return function nextBoundedInt(max: number): number {
    if (max <= 0) throw new Error('max must be > 0');
    // Largest multiple of `max` that fits in uint32 range.
    const limit = Math.floor(0x100000000 / max) * max;
    let x: number;
    do {
      x = rngU32();
    } while (x >= limit);
    return x % max;
  };
}
