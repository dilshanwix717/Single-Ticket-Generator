import { BATCH_SIZE, RECIPES, assertRecipeTotals } from '../lookup/recipe-table';
import { makeBoundedIntFn, mulberry32 } from './seeded-rng';

/**
 * Build a shuffled "bag" of recipe indices.
 *
 * Each element is an index into RECIPES. RECIPES[i] appears exactly
 * RECIPES[i].count times. The bag length is BATCH_SIZE (10,000,000).
 *
 * Memory: a single Uint32Array of 10M entries (~40 MB). Fits comfortably
 * in RAM. Fisher–Yates is in-place so no temporary copy is needed.
 */
export function buildShuffledBag(seed: number): Uint32Array {
  assertRecipeTotals();

  const bag = new Uint32Array(BATCH_SIZE);

  let cursor = 0;
  for (let i = 0; i < RECIPES.length; i++) {
    const c = RECIPES[i]!.count;
    bag.fill(i, cursor, cursor + c);
    cursor += c;
  }
  if (cursor !== BATCH_SIZE) {
    throw new Error(`bag fill cursor ${cursor} != BATCH_SIZE ${BATCH_SIZE}`);
  }

  // Fisher–Yates shuffle, in place, with a seeded uniform-int RNG.
  const nextU32 = mulberry32(seed);
  const nextInt = makeBoundedIntFn(nextU32);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = nextInt(i + 1);
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }

  return bag;
}
