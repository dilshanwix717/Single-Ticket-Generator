import { generateBatchToCsv } from '../engine/batch-generator';

function arg(name: string, fallback?: string): string {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i === -1 || i === process.argv.length - 1) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required arg ${flag}`);
  }
  return process.argv[i + 1]!;
}

async function main(): Promise<void> {
  const bet = Number(arg('bet'));
  const batchId = Number(arg('batch-id'));
  const seed = Number(arg('seed'));
  const size = Number(arg('size', '10000'));
  const outPath = arg('out');

  console.log('[generate-batch] starting', { bet, batchId, seed, size, outPath });

  const { rows, durationMs } = await generateBatchToCsv({
    bet,
    batchId,
    seed,
    batchSize: size,
    outPath,
  });

  const seconds = (durationMs / 1000).toFixed(2);
  const rate = (rows / (durationMs / 1000)).toFixed(0);
  console.log(`[generate-batch] done: ${rows} rows in ${seconds}s (${rate} rows/s)`);
  console.log(`[generate-batch] file: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
