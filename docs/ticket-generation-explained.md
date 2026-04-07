# Ticket Generation — How It Works

This document explains exactly what happens when a single scratch ticket is generated, step by step, for both a **losing** and a **winning** ticket. It also covers the internal mechanics: how random shuffling works, how numbers are selected, and how amounts are assigned.

---

## The Two Inputs

Every ticket starts with one piece of information from the caller:

```
combination: number[]
```

- **Losing ticket**: `combination = []` → multiplier derives to `0`
- **Winning ticket**: `combination = [1.5, 2.5]` → multiplier derives to `4.0` (sum)

The service derives the multiplier (`sum(combination)`), looks it up in the weight table to confirm it is a valid combination, then decides how many Y cells need to match a W number (`hitCount = combination.length`).

---

## Background: How Fisher-Yates Shuffle Works

Both scenarios rely heavily on random shuffling. The algorithm used is **Fisher-Yates** (also called Knuth shuffle).

**Concept:** Walk the array from the last element backwards. At each position `i`, swap the element there with a randomly chosen element from position `0` to `i` (inclusive).

```
Array: [A, B, C, D, E]

i=4: swap position 4 with random position 0..4 → e.g. swap(4,1) → [A, E, C, D, B]
i=3: swap position 3 with random position 0..3 → e.g. swap(3,0) → [D, E, C, A, B]
i=2: swap position 2 with random position 0..2 → e.g. swap(2,2) → [D, E, C, A, B]  (no change)
i=1: swap position 1 with random position 0..1 → e.g. swap(1,0) → [E, D, C, A, B]
Done.
```

Every possible ordering is equally likely. An array of N elements has N! possible orderings, and Fisher-Yates visits each with equal probability.

**Partial Fisher-Yates** (used in this codebase for performance): if you only need the first `K` elements, stop after `K` swaps. You get `K` random distinct values without touching the rest of the array. For example, picking 4 near-miss positions from 20 only requires 4 swaps instead of 19.

---

## Phase 1 — Draw W Numbers (shared by both scenarios)

W is the set of **5 winning numbers**, each a zero-padded string from `"00"` to `"99"`.

### Why W numbers need a minimum spread of 2

Near-miss cells must show values that are exactly ±1 from a W number (e.g. W=`"35"` → near-miss candidates are `"34"` and `"36"`). If two W numbers were adjacent (e.g. `"35"` and `"36"`), then `"35"` would be ±1 from `"36"` — meaning a near-miss candidate is itself a W number. That is illegal. The spread-of-2 rule eliminates this problem entirely.

### The algorithm (reservoir sampling with exclusion)

```
Start: available = [0, 1, 2, ..., 99]  (all 100 numbers)

Round 1:
  Count available slots (100)
  Pick a random index within that count, e.g. lands on 42
  chosen = 42
  Remove 41, 42, 43 from available  ← guarantees ≥2 gap

Round 2:
  Count available slots (97 remaining)
  Pick random → chosen = 17
  Remove 16, 17, 18

...repeat until 5 W numbers are chosen.
```

Each round is O(100) — scan the array twice (once to count, once to find). With only 5 picks, total cost is O(500) fixed operations.

**Result example:** `W = ["17", "42", "63", "78", "95"]`

---

## Scenario A — Losing Ticket

### Step 1 — Draw W (see Phase 1 above)

### Step 2 — Build near-miss candidates

Near-miss cells are Y cells that show a value very close to a W number — the player "almost won". The PRD requires 4–8 near-miss cells per losing ticket.

**2a. Select 3 or 4 W numbers as sources (random)**

Not all 5 W numbers are used as sources. A random count (3 or 4) is chosen, and the W array is partially shuffled to pick them. Using partial Fisher-Yates on the 5-element W array.

```
W = ["17", "42", "63", "78", "95"]
Randomly pick 3 sources → e.g. ["42", "78", "17"]  (after partial shuffle)
```

**2b. Collect ±1 candidates for each source**

```
"42" → candidates: "41", "43"
"78" → candidates: "77", "79"
"17" → candidates: "16", "18"
Raw pool: ["41", "43", "77", "79", "16", "18"]
```

Edge cases: `"00"` only produces `"01"` (no `-1`), `"99"` only produces `"98"`.

**2c. Remove any candidate that is itself a W number, then deduplicate**

This is a safety check. Because of the spread-of-2 guarantee, no candidate will ever equal a W number, but the check exists for correctness. After dedup the pool has 4–8+ unique values.

**2d. Pick the target near-miss count (4–8) and shuffle the pool**

```
nmTarget = random(4, 8) = e.g. 6
Shuffle pool → e.g. ["18", "41", "77", "79", "43", "16", ...]
Take first 6 → nmValues = ["18", "41", "77", "79", "43", "16"]
```

**2e. Assign near-miss values to random grid positions**

Partial Fisher-Yates on `[0..19]`, stopping after 6 swaps, gives 6 distinct random positions. These are the near-miss cell indices.

```
nmPositions = [2, 5, 9, 11, 14, 17]  (sorted for readability)
grid[2]  = "18"
grid[5]  = "41"
grid[9]  = "77"
grid[11] = "79"
grid[14] = "43"
grid[17] = "16"
```

### Step 3 — Fill the remaining 14 Y cells

The remaining 14 cells (20 − 6 near-miss) must be filled with values that:
- Are not W numbers
- Are not the near-miss values already placed
- Are globally unique across the full 20-cell Y grid

**Build a forbidden map:** a 100-slot boolean array. Mark all 5 W numbers and all 6 near-miss values as forbidden (11 slots total).

**Partial Fisher-Yates on the allowed pool (89 values):** Instead of shuffling all 89 values, only 14 swaps are performed to select 14 random values. O(14) instead of O(89).

```
allowed = [00, 01, 03, 04, ..., 99]  minus forbidden values
After 14 partial swaps → take first 14 → e.g. [55, 03, 88, 22, ...]
```

These 14 values are placed into the 14 remaining empty grid positions in order.

**Final Y grid (20 cells):** 6 near-miss values + 14 filler values, all unique, none equal to any W.

---

## Scenario B — Winning Ticket

### Step 1 — Draw W (see Phase 1 above)

### Step 2 — Choose which W values become "hits"

The combination determines `hitCount`. Example: `combination = [1.5, 2.5]` → `hitCount = 2`.

The W array (5 values) is partially shuffled and the first `hitCount` values are taken as the hit values. These are the W numbers that will appear in the Y grid.

```
W = ["17", "42", "63", "78", "95"]
Partial shuffle → ["63", "17", "42", "78", "95"]
Take first 2 → hitValues = ["63", "17"]
```

### Step 3 — Choose which grid positions the hits occupy

Partial Fisher-Yates on `[0..19]`, stopping after `hitCount` swaps. For `hitCount=2`, 2 swaps are performed.

```
hitPositions = [4, 12]  (2 random distinct positions)
```

### Step 4 — Place hit values in the grid

The hit positions are sorted so that `hitPositions[0]` pairs with `hitAmounts[0]` in a stable, deterministic order.

```
sorted hitPositions = [4, 12]
grid[4]  = "63"   ← W number, will match
grid[12] = "17"   ← W number, will match
```

### Step 5 — Fill the remaining 18 Y cells

Forbidden map: mark all 5 W numbers as forbidden (including the 2 hits, which are already placed).

Partial Fisher-Yates on the ~95 allowed values, taking only 18. The 18 values are placed into the 18 empty positions.

**No near-miss cells exist on a winning ticket** — the PRD forbids it.

**Final Y grid (20 cells):** exactly `hitCount` values that match a W number, rest are filler.

---

## Phase 3 — Amount Layout (both scenarios)

After the Y grid is built, each of the 20 cells gets a dollar amount and a tier label.

### The fixed tier budget

| Tier    | Cells | Dollar values          |
|---------|-------|------------------------|
| Low     | 4     | $1.50, $2, $2.50, $3, $4 |
| Medium  | 4     | $5, $6, $8, $10, $12, $15 |
| High    | 6     | $20, $25, $30, $40, $50 |
| Jackpot | 6     | $200, $800              |

Total: 20 cells.

### How denomination variety is generated per tier

For each tier, a pool of dollar values exists (e.g. Low pool: 5 values). The engine picks 2–4 distinct denominations to use in that tier's cells, then fills:

1. Shuffle the tier pool to randomise selection order.
2. Choose how many distinct denominations (2–4, or exactly 2 for Jackpot).
3. Take the first N values from the shuffled pool — these are the "palette" for this tier.
4. Place one of each palette value first (guarantees every chosen denomination appears at least once).
5. Fill remaining slots randomly from the same palette.
6. Shuffle the output cells so the guaranteed placements don't always appear first.

**Example for Low tier (4 cells, palette=[2.5, 4]):**
```
Guaranteed: [2.50, 4.00]
Random fill: [4.00, 2.50]   (2 more slots filled randomly from palette)
Shuffle output: [4.00, 2.50, 2.50, 4.00]
```

Jackpot always uses both $200 and $800 (palette is always the full pool of 2).

### Winning ticket — hit cells get combination amounts first

Before random fills, the combination amounts are placed on the hit positions:

```
hitPositions = [4, 12]  (sorted)
hitAmounts   = [1.5, 2.5]

grid[4]  = $1.50  (Low tier)
grid[12] = $2.50  (Low tier)
```

The random Low cell budget then drops from 4 to 2 (4 total − 2 occupied by hits).

### Losing ticket — near-miss cells get higher-tier amounts first

Near-miss cells are filled before all other empty cells, pulling from the highest tiers first (Jackpot → High → Medium → Low), up to 2 cells per tier wave. This means a player who nearly wins sees larger amounts next to their near-miss numbers — reinforcing the "almost won" feeling.

```
Near-miss positions = [2, 5, 9, 11, 14, 17]  (shuffled for unpredictability)

Wave 1 (Jackpot, up to 2): cells 2 ← $800, cell 5 ← $200
Wave 2 (High, up to 2):    cells 9 ← $50,  cell 11 ← $40
Wave 3 (Medium, up to 2):  cells 14 ← $12, cell 17 ← $8
Wave 4 (Low, up to 2):     all near-miss slots filled, nothing left to assign
```

### Remaining cells — random fill

All grid positions that are still empty (neither hit nor near-miss) receive the leftover amount cells. The empty positions are shuffled before pairing with the remaining pool, so placement is random.

---

## Phase 4 — Ticket Number Generation

The ticket number has the format:

```
NO.YYYYMMDD-XXXXXXXXXXXXXX-YYY
   ^^^^^^^^  ^^^^^^^^^^^^^^  ^^^
   date      14-digit code   3-digit check
```

**Example:** `NO.20260406-47291836501847-312`

### 14-digit code generation

14 random digits, each independently chosen from 0–9. No sequence or batch information is embedded.

```
code = "47291836501847"
```

### 3-digit checksum (Mod 997-10)

Based on the same concept as IBAN checksum (ISO 7064), but using modulus 997 instead of 97, giving a 3-digit check value in the range 002–998.

Steps:
1. Build the payload string: `NO.20260406-47291836501847`
2. Expand: strip `.` and `-`, convert letters to numbers (N=23, O=24) → pure digit string
3. Append `000` placeholder
4. Compute: `remainder = expandedString % 997`
5. Check value: `998 − remainder` (range 002–998)
6. Pad to 3 digits

The check value lets the system detect transcription errors or tampered ticket numbers.

---

## Summary: Full Generation Flow

```
Input: combination (e.g. [] for loss, [1.5, 2.5] for win)
         │
         ▼
Derive multiplier = sum(combination)
Validate against weight table → get hitCount, winTier
         │
         ▼
Phase 1: drawSpreadWNumbers()
  → 5 spread W numbers, gap ≥ 2
         │
    ┌────┴────┐
  LOSS      WIN
    │          │
    ▼          ▼
buildLosingY   buildWinningY
  - 3–4 W sources        - choose hitCount W values
  - collect ±1 candidates - choose hitCount positions
  - pick 4–8 near-miss    - place W values at positions
  - fill rest (forbidden  - fill rest (forbidden = all W)
    = W ∪ near-miss)
    │          │
    └────┬─────┘
         │
         ▼
Phase 3: buildAmountLayout()
  LOSS: near-miss cells → high tier first, then random fill
  WIN:  hit cells → combination amounts, then random fill for rest
         │
         ▼
Phase 4: formatTicketNumber()
  → NO.YYYYMMDD-14digits-3digitCheck
         │
         ▼
Return: ticket_no, w_numbers, y_numbers, amount_layout, win_tier
```
