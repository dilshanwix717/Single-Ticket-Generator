# Implementation Plan — Bulk Ticket Generation (10M / bet)

Five phases. Each ends with a **manual verification step you run**, before I touch the next phase. I will not advance phases on my own.

**Global rules**
- All new code under [src/bulk-tickets/](src/bulk-tickets/). No edits to existing `src/tickets/` engines except read-only imports.
- DB stores **only** ticket tables (and optionally batch metadata). No recipe/weight/combination tables — recipes live in source as a TS module.
- **One table per bet**: 13 dedicated tables `tickets_bet_<bet>` (e.g. `tickets_bet_1`, `tickets_bet_10`, …, `tickets_bet_1000`). The `bet` column is dropped from the schema — implied by table name. PK = `(batch_id, seq)`.
- Weight table will be migrated from [src/tickets/data/weight-table.json](src/tickets/data/weight-table.json) into a typed TS file with the per-10M `count` column added (derived from PRD appendix). The JSON stays untouched so the existing single-ticket flow keeps working.

---

## Phase 1 — Recipe table + assertion

**Goal:** a single source of truth listing every `(multiplier, combination, win_tier, count)` row, summing to exactly 10,000,000.

**Files**
- [src/bulk-tickets/lookup/recipe-table.ts](src/bulk-tickets/lookup/recipe-table.ts) — exports `RECIPES: Recipe[]` and `BATCH_SIZE = 10_000_000`. Hard-coded from PRD appendix (61 rows). Includes a top-level `assertRecipeTotals()` that throws if `sum(count) !== BATCH_SIZE`.
- [src/bulk-tickets/lookup/recipe-table.types.ts](src/bulk-tickets/lookup/recipe-table.types.ts) — `Recipe` interface.

**Your verification**
1. Run a one-off script (I'll give you the command) that imports `RECIPES`, calls `assertRecipeTotals()`, and prints: total rows, total count, count grouped by `win_tier`, count of NO_WIN rows.
2. Eyeball: NO_WIN = 7,065,750; total = 10,000,000; row count = 61.
3. If you want amount changes, you edit the file directly and re-run — assertion will catch any mismatch.

**Exit criteria:** assertion passes, totals match PRD.

---

## Phase 2 — Bag builder + unit test

**Goal:** produce a `Uint32Array(10_000_000)` where value at index `k` = recipe row index for the ticket at sequence `k`, shuffled with a seeded RNG.

**Files**
- [src/bulk-tickets/engine/seeded-rng.ts](src/bulk-tickets/engine/seeded-rng.ts) — small mulberry32 or xoshiro PRNG, deterministic from a numeric seed.
- [src/bulk-tickets/engine/bag-builder.ts](src/bulk-tickets/engine/bag-builder.ts) — `buildShuffledBag(seed: number): Uint32Array`. Fills bag by recipe counts, then in-place Fisher–Yates with the seeded RNG.
- [src/bulk-tickets/engine/bag-builder.spec.ts](src/bulk-tickets/engine/bag-builder.spec.ts) — tests:
  - length = 10,000,000
  - per-recipe-index frequency exactly matches `RECIPES[i].count`
  - same seed → identical bag (determinism)
  - different seeds → different bags (sanity)

**Your verification**
1. Run the spec file (`npm test` or `vitest run`/`jest` — I'll match what's in repo).
2. All four assertions green.
3. Optional: time it. Should be ~1–3 s on your machine.

**Exit criteria:** all tests pass; build is deterministic per seed.

---

## Phase 3 — CSV streaming generator (small N)

**Goal:** produce a CSV file for a tiny batch (configurable N, default 10,000) so you can eyeball rows. Reuses [generateTicketLayout()](src/tickets/engine/ticket-generator.ts) unchanged.

**Files**
- [src/bulk-tickets/engine/batch-generator.ts](src/bulk-tickets/engine/batch-generator.ts) — `generateBatchToCsv({ bet, batchId, seed, batchSize, outPath })`. Streams via `fs.createWriteStream` with backpressure. Columns: `batch_id, seq, multiplier, win_tier, hit_count, numeric_code, w_numbers, y_numbers, hit_positions, near_miss_positions, amounts, tiers`. Array columns serialized as JSON strings, CSV-escaped. (`bet` is **not** a column — implied by target table.)
- [src/bulk-tickets/engine/numeric-code.ts](src/bulk-tickets/engine/numeric-code.ts) — deterministic 14-digit code from `(bet, batch_id, seq)` so uniqueness is guaranteed by construction across all bets, no in-memory Set needed.
- [src/bulk-tickets/cli/generate-batch.ts](src/bulk-tickets/cli/generate-batch.ts) — CLI: `ts-node … --bet 10 --batch-id 1 --seed 42 --size 10000 --out ./batches/bet10-batch1.csv`.

**Your verification**
1. Run: `ts-node src/bulk-tickets/cli/generate-batch.ts --bet 10 --batch-id 1 --seed 42 --size 10000 --out ./batches/bet10-batch1.csv`
2. `wc -l` → 10,000 rows (+ optional header).
3. Open the CSV. Spot-check 5–10 rows: 20 amounts, valid W/Y, hits match the recipe combination, near-miss only when hit_count=0.
4. Quick stats script (I'll provide) — group by `win_tier`, verify proportions roughly match PRD percentages × 10,000.
5. Re-run with same seed → byte-identical file (determinism check).

**Exit criteria:** CSV looks right, deterministic, no crashes, no memory growth (RSS stays flat — eyeball with Task Manager).

---

## Phase 4 — Schema + COPY loader (one table per bet)

**Goal:** load Phase-3 CSV into the correct per-bet Postgres table via `COPY FROM STDIN`, end-to-end on the small batch.

**Files**
- [src/bulk-tickets/db/schema.sql](src/bulk-tickets/db/schema.sql) — SQL **template** plus a small TS helper that emits the 13 `CREATE TABLE` + index statements by substituting `<bet>`.

  Per-bet shape:
  ```sql
  CREATE TABLE tickets_bet_<bet> (
    batch_id    bigint     NOT NULL,
    seq         int        NOT NULL,
    multiplier  numeric    NOT NULL,
    win_tier    text       NOT NULL,
    hit_count   smallint   NOT NULL,
    numeric_code char(14)  NOT NULL,
    w_numbers   jsonb      NOT NULL,
    y_numbers   jsonb      NOT NULL,
    hit_positions jsonb    NOT NULL,
    near_miss_positions jsonb NOT NULL,
    amounts     jsonb      NOT NULL,
    tiers       jsonb      NOT NULL,
    status      text       NOT NULL DEFAULT 'AVAILABLE',
    issued_at   timestamptz,
    PRIMARY KEY (batch_id, seq)
  );
  CREATE INDEX tickets_bet_<bet>_available_idx
    ON tickets_bet_<bet> (batch_id, seq)
    WHERE status = 'AVAILABLE';
  ```
- Optional `batches_bet_<bet>` tables, same pattern (default: per-bet to stay consistent).
- [src/bulk-tickets/db/client.ts](src/bulk-tickets/db/client.ts) — minimal `pg.Pool` from env vars (`PG_HOST`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`).
- [src/bulk-tickets/db/copy-loader.ts](src/bulk-tickets/db/copy-loader.ts) — `loadCsvIntoTickets({ csvPath, bet, batchId, seed })` using `pg-copy-streams`, wrapped in a transaction. Picks table name from `bet`, validates `bet` is one of the 13 PRD tiers before building the identifier (prevents SQL injection via the only dynamic part). On success, inserts the corresponding `batches_bet_<bet>` row.
- [src/bulk-tickets/cli/load-batch.ts](src/bulk-tickets/cli/load-batch.ts) — CLI: `--csv ./batches/bet10-batch1.csv --bet 10 --batch-id 1 --seed 42`.

**Dependencies added:** `pg`, `pg-copy-streams` (+ types). I'll list them before installing so you can approve.

**Your verification**
1. Apply schema: `psql … -f src/bulk-tickets/db/schema.sql` (or run the TS emitter).
2. Generate fresh 10k CSV (Phase 3), then run `load-batch` CLI.
3. `SELECT count(*) FROM tickets_bet_10 WHERE batch_id=1;` → 10,000.
4. `SELECT win_tier, count(*) FROM tickets_bet_10 WHERE batch_id=1 GROUP BY 1;` → matches CSV.
5. `SELECT * FROM tickets_bet_10 WHERE batch_id=1 ORDER BY seq LIMIT 3;` → eyeball jsonb columns are well-formed.
6. Row in `batches_bet_10`.
7. Re-run loader with same `(batch_id)` → fails cleanly on PK conflict (no partial insert).

**Exit criteria:** end-to-end CSV → Postgres works on 10k rows; counts and structure verified.

---

## Phase 5 — Scale to 10M (one bet, then all 13)

**Goal:** run the full pipeline at production scale.

**Steps**
1. Run `generate-batch` with `--size 10000000` for `--bet 10`. Watch RSS — should stay well under 200 MB (40 MB bag + streaming buffers). Time it.
2. If generation is too slow (> ~30 min), I'll add a `worker_threads` mode that splits the bag into N CPU-count slices, each worker writing its own CSV chunk. Otherwise skip — premature.
3. `load-batch` the CSV into `tickets_bet_10`. Time the COPY. Verify counts.
4. Once the single-bet pipeline is solid, add a thin `generate-all-bets` CLI that loops over the 13 PRD bets `[1,2,4,8,10,20,40,80,100,200,400,800,1000]`, each with its own seed, writing to its own table.

**Your verification**
1. `SELECT count(*) FROM tickets_bet_10 WHERE batch_id = 1;` → 10,000,000. Repeat per bet table.
2. RTP sanity: `SELECT sum(multiplier)/count(*) FROM tickets_bet_10;` → ~0.969999 (pure function of recipe counts; should be exact across 10M). Repeat per bet.
3. Issuance query plan check: `EXPLAIN SELECT … FROM tickets_bet_10 WHERE status='AVAILABLE' ORDER BY batch_id, seq LIMIT 1 FOR UPDATE SKIP LOCKED;` → uses the partial index.

**Exit criteria:** all 13 per-bet tables loaded, RTP matches, FIFO query is fast.

---

## Trade-offs of one-table-per-bet
- **Pros**: smaller per-table footprint, smaller indexes, faster issuance scans, trivial per-bet maintenance (truncate/drop one bet without touching others), matches PRD's "13 separate inventories" wording (§6.2) literally.
- **Cons**: 13 tables to migrate when schema changes — mitigated by the SQL-template generator. Cross-bet analytics need `UNION ALL` or a view (easy to add later if needed; not required by PRD).

---

## How we'll work
- I implement **one phase at a time**, then stop and report.
- You run the verification commands and tell me pass/fail.
- On pass: say "phase N" and I start the next one.
- On fail: paste output, I fix in place — I won't move on.
- If you want to change amount denominations, you do it in the recipe-table TS file directly between any phases; the assertion will catch mistakes.

Ready when you are — say **"phase 1"** to start.
