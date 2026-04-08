import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { once } from 'events';

import { randomInt } from 'crypto';

import { generateTicketLayout } from '../../tickets/engine/ticket-generator';
import { RECIPES } from '../lookup/recipe-table';
import { buildShuffledBag } from './bag-builder';
import { buildNumericCode } from './numeric-code';

export interface GenerateBatchOptions {
  bet: number;
  batchId: number;
  /** Defaults to 10,000,000 (full PRD batch). Lower for testing. */
  batchSize?: number;
  outPath: string;
  /** Emit a CSV header row. Defaults to true. */
  header?: boolean;
}

const COLUMNS = [
  'batch_id',
  'seq',
  'multiplier',
  'win_tier',
  'hit_count',
  'numeric_code',
  'w_numbers',
  'y_numbers',
  'hit_positions',
  'near_miss_positions',
  'amounts',
  'combination',
] as const;

/**
 * Escape a value for CSV. We always quote JSON-encoded array fields and
 * any string that might contain a comma/quote/newline. Numbers/booleans
 * are emitted bare.
 */
function csvEscape(v: string): string {
  if (v.includes('"') || v.includes(',') || v.includes('\n') || v.includes('\r')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function jsonCell(v: unknown): string {
  return csvEscape(JSON.stringify(v));
}

export async function generateBatchToCsv(opts: GenerateBatchOptions): Promise<{
  rows: number;
  durationMs: number;
}> {
  const { bet, batchId, batchSize, outPath, header = true } = opts;

  // Fresh non-deterministic seed for the bag shuffle on every run.
  const seed = randomInt(0, 0x100000000);

  const start = Date.now();

  await mkdir(dirname(outPath), { recursive: true });
  const out = createWriteStream(outPath, { encoding: 'utf8' });

  // Stream backpressure helper.
  async function write(line: string): Promise<void> {
    if (!out.write(line)) {
      await once(out, 'drain');
    }
  }

  if (header) {
    await write(COLUMNS.join(',') + '\n');
  }

  const bag = buildShuffledBag(seed);
  const limit = batchSize ?? bag.length;
  if (limit > bag.length) {
    throw new Error(`batchSize ${limit} > bag length ${bag.length}`);
  }

  // Ticket content uses the engine's own Math.random — non-deterministic
  // by design so two runs produce different tickets.

  const wSetBuf: Set<string> = new Set();

  for (let seq = 0; seq < limit; seq++) {
    const recipeIdx = bag[seq]!;
    const recipe = RECIPES[recipeIdx]!;
    const hitCount = recipe.combination.length;
    const isLoss = hitCount === 0;

    const layout = generateTicketLayout(hitCount, isLoss, recipe.combination);

    // Recompute hit positions (cells where y matches any w).
    wSetBuf.clear();
    for (const w of layout.w_numbers) wSetBuf.add(w);
    const hitPositions: number[] = [];
    for (let i = 0; i < layout.y_numbers.length; i++) {
      if (wSetBuf.has(layout.y_numbers[i]!)) hitPositions.push(i);
    }

    const numericCode = buildNumericCode(bet, batchId, seq);

    const row =
      batchId +
      ',' +
      seq +
      ',' +
      recipe.multiplier +
      ',' +
      recipe.win_tier +
      ',' +
      hitCount +
      ',' +
      numericCode +
      ',' +
      jsonCell(layout.w_numbers) +
      ',' +
      jsonCell(layout.y_numbers) +
      ',' +
      jsonCell(hitPositions) +
      ',' +
      jsonCell(layout.near_miss_positions) +
      ',' +
      jsonCell(layout.amount_layout.amounts.map((m: number) => m * bet)) +
      ',' +
      jsonCell(recipe.combination.map((m: number) => m * bet)) +
      '\n';

    await write(row);

    if ((seq + 1) % 100_000 === 0) {
      const elapsedSec = (Date.now() - start) / 1000;
      const rate = Math.round((seq + 1) / elapsedSec);
      const pct = (((seq + 1) / limit) * 100).toFixed(1);
      const etaSec = Math.round((limit - (seq + 1)) / rate);
      // eslint-disable-next-line no-console
      console.log(`[generate-batch] ${seq + 1}/${limit} (${pct}%) — ${rate}/s — eta ${etaSec}s`);
    }
  }

  out.end();
  await once(out, 'finish');

  return { rows: limit, durationMs: Date.now() - start };
}
