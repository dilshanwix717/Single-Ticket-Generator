import { BATCH_SIZE, RECIPES } from '../lookup/recipe-table';
import { buildShuffledBag } from './bag-builder';

describe('buildShuffledBag', () => {
  // Building a 10M Uint32Array + Fisher-Yates takes a few seconds.
  jest.setTimeout(60_000);

  let bag: Uint32Array;
  beforeAll(() => {
    bag = buildShuffledBag(42);
  });

  it('has length BATCH_SIZE', () => {
    expect(bag.length).toBe(BATCH_SIZE);
  });

  it('per-recipe frequency exactly matches RECIPES[i].count', () => {
    const freq = new Uint32Array(RECIPES.length);
    for (let k = 0; k < bag.length; k++) freq[bag[k]!]!++;
    for (let i = 0; i < RECIPES.length; i++) {
      expect(freq[i]).toBe(RECIPES[i]!.count);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildShuffledBag(123);
    const b = buildShuffledBag(123);
    expect(a.length).toBe(b.length);
    // Compare via Buffer for speed instead of element-by-element.
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });

  it('produces a different ordering for different seeds', () => {
    const a = buildShuffledBag(1);
    const b = buildShuffledBag(2);
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(false);
  });

  it('is actually shuffled (not still in fill order)', () => {
    // First N elements should not all be recipe 0 (NO_WIN), which would
    // be the case if Fisher–Yates was skipped. Probability of failure is
    // astronomically small.
    let allZero = true;
    for (let k = 0; k < 100; k++) {
      if (bag[k] !== 0) {
        allZero = false;
        break;
      }
    }
    expect(allZero).toBe(false);
  });
});
