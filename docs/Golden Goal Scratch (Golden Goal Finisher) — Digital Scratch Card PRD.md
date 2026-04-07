# Golden Goal Scratch (Golden Goal Finisher) — Digital Scratch Card PRD

Reference competitor (for UI/UX & gameplay flow benchmarking): [https://www.gaming-panda.com/game/labubu-for-sugar](https://www.gaming-panda.com/game/labubu-for-sugar)

# 1\. Overview

Goal: Define what the game is, what it looks like, and how a user plays one round.

     •     Game Type: Digital Scratch Card / Instant Lottery

     •     Platform: Web, Mobile (HTML5), supports Casino API integration

     •     Target Users: 18+; low learning cost, instant results; for India/Bangladesh/SEA and similar markets

     •     UI Layout：

           •     W Area: Winning Numbers

           •     Y Area: Your Numbers, 20 cells (each cell contains: Number \+ Amount)

     •     Win Rule Overview: A hit occurs when a Y-area number matches a W-area number; multiple hits can stack.

     •     Core Loop: Select Bet → Debit success → Issue a Ticket (no duplicate issuance) → Scratch / Reveal All → Instant settlement → Play again

     •     Design Goals: Simple and intuitive \+ instant feedback \+ emotional excitement; pre-generated ticket inventory ensures RTP/risk control; reskinning supports multi-themes and multi-regions.

⸻

#

# 2\. Core Gameplay & Flow

2.1 Round Definition

Goal: Clarify when results are determined and what is generated at runtime.

     •     Each round is independent; no levels or progression system.

     •     The round outcome is pre-determined when the ticket inventory is generated:Win/Lose (whether HitCount is 0)、Multiplier M、HitCount、Hit cell positions and hit amount distribution、Printed amounts (20-cell amount layout, fixed)、ticket number、near-miss（number、amount、position）——Revised at 10:40 AM on March 24, 2026

     •     Runtime RNG is only used for:Randomly drawing one available ticket from the ticket inventory of the selected bet.

    Once the same Ticket is issued, the round result is fixed; scratching is for display only.

2.2 Bet Tiers

     •     13 tiers: 1, 2, 4, 8, 10, 20, 40, 80, 100, 200, 400, 800, 1000\.

     •     Default bet: 10 (adjustable)

2.3 Start Round

Goal: Ensure debit, ticket issuing, repeated clicks, and failure paths do not deviate.

     1\.     Debit the bet immediately when the user clicks Start/Buy.

     2\.     Draw/issue a ticket only after the debit succeeds.

     3\.     Must guarantee: the same ticket is never issued twice.

     4\.     Must guarantee: for repeated clicks/requests, debit at most once and issue at most one ticket.

     5\.     After ticket issuance succeeds, generate a new scratch card and enter the scratching flow.

Failure Paths:

     •     If debit fails: show the reason (e.g., insufficient balance), do not draw a ticket.

     •     If debit succeeds but ticket issuance fails: show “system busy” and perform a make-good issuance.

     •      If inventory is insufficient: temporarily stop selling this bet tier and show maintenance notice; user cannot purchase.

2.4 Scratching

     •     Manual scratch: mouse drag on web; finger swipe on mobile.

     •     Reveals hidden content immediately while scratching.

     •     No time limit.

2.5 Reveal All

     •     Provide a button; clicking reveals full results (with a scratching animation).

     •     Intended for high-frequency users.

2.6 Settlement (Win / Loss)

     •     Win: payout \= sum of amounts in hit cells.

     •     Lose: payout \= 0\.

     •     Profit \= payout \- bet

     •     Show the win popup immediately after a win.

     •     Support “Play Again” after settlement.

     •     Amount display/settlement precision: keep 1 decimal place (if any); if no decimals, display integers only.

⸻

#

# 3\. Numeric Targets & Configuration (RTP / Win Rate / Volatility)

3.1 RTP

     •     Default RTP: 96.9999%

     •     Adjustable via back-office (0.0001% granularity), effective only for newly generated batches.

3.2 Win Rate

     •     Default win rate: 29.343%

     •     Adjustable via back-office (0.0001% granularity), effective only for newly generated batches.

3.3 Volatility

     •     Medium/High volatility: low win rate but includes high-multiplier big wins.

3.4 Multiplier Weight Table

     •     For each bet, pre-generate 10,000,000 tickets per batch.

     •     When available inventory ≤ 1,000,000 (10%), replenish \+10,000,000.

     •     Issue older batches first (FIFO).

Multiplier table includes:

     •     Multiplier set / weight / ticket count, corresponding HitCount, hit-cell patterns, and win-tier mapping.

⸻

# 4\. Y-Area Amount Design (Printed Amounts, 20 Cells)

Example rounds.

The top section is the W area (Winning Numbers), and the bottom section is the Y area (Your Numbers).

![][image1]

4.1 Amount Pools (Factors)

     •     Low: 1.5, 2, 2.5, 3, 4

     •     Medium: 5, 6, 8, 10, 12, 15

     •     High: 20,  25, 30, 40, 50

     •     Jackpot: 200, 800

4.2 Printed Amount Generation (Fixed 20 Cells, Hard Rules)

Goal: Every ticket must generate 20 amount cells with a consistent structure.

     •     Each ticket has 20 amount cells in the Y area.

     •     Generated from four pools with fixed allocations:Low 4 \+ Medium 4 \+ High 6 \+ Jackpot 6 \= 20 cells

Rules per pool:

     •     Low pool: randomly select 2–4 distinct denominations, fill into 4 cells (duplicates allowed in filling).

     •     Medium pool: randomly select 2–4 distinct denominations, fill into 4 cells (duplicates allowed).

     •     High pool: randomly select 2–4 distinct denominations, fill into 6 cells (duplicates allowed).

     •     Jackpot pool: always select 2 distinct denominations, fill into 6 cells (duplicates allowed).

4.3 Position Rules (Shuffle / Fixed)

     •     After generation, shuffle the 20 amount cells into the 20 Y-area positions.

     •     Shuffling must be done during ticket generation and written into the Ticket.

     •     At runtime, only read and display; reshuffling/reordering is forbidden.

4.4 Relationship Between Display and Payout

     •     Printed amounts are for display/atmosphere only.

     •     Actual payout is determined by the Ticket’s hit cells and has no direct causal relation to how many jackpot amounts appear on the printed layout.

⸻

# 5\. Number Rules (W Area / Y Area)

5.1 Number Pool

     •     Range: 00–99 (100 numbers).

     •     UI format: always 2 digits, pad with 0 if needed.

     •     Numbers only determine hits/near-miss display; amounts are determined by amount cells.

5.2 W-Area Generation (Winning Numbers)

Goal: W area must be 5 unique numbers and must support downstream constraints.

     •     Each round randomly draws 5 distinct numbers from \[00–99\] (uniform by default).

     •     If this is a winning round (HitCount\>0), W must allow Y to satisfy hit and uniqueness constraints; otherwise redraw W.

     •     Configurable: number of W numbers (default 5).

5.3 Y-Area Generation (Your Numbers) — Hard Constraints for 20 Numbers

Goal: All 20 Y numbers must be globally unique; in losing rounds, none may equal any W number.

5.3.1 Hard Constraints (Must Satisfy)

     1\.     Y area has 20 cells; all 20 numbers are pairwise unique.

     2\.     Losing round (HitCount=0): none of the 20 Y numbers may equal any W number.

     3\.     Near-miss and normal non-winning numbers must not duplicate any already-used numbers (including hit-cell numbers).

5.3.2 Generation Order (Fixed)

     1\.     Select hit positions: randomly choose HitCount positions among 20 as hit cells.

     2\.     Write hit numbers: randomly choose HitCount distinct numbers from the 5 W numbers and write into hit cells.

     3\.     Near-miss (only for losing rounds): generate candidates per 5.5, pick N (4–8) and place into near-miss positions.

     •     Near-miss positions must not overlap with hit positions.

     •     If HitCount\>0: skip the near-miss step.

     4\.     Fill remaining cells: randomly draw the remaining required count from 00–99, with requirements:

     •     Must not equal any W number.

     •     Must not be in the near-miss number set.

     •     Must not duplicate any already placed Y numbers.

     •     Continue until all 20 cells are filled.

5.4 Losing Round (NO WIN)

     •     W area still generates 5 numbers normally.

     •     Force HitCount=0.

     •     Must satisfy: none of the 20 Y numbers equals any W number.

     •     Near-miss is enabled.

5.5 Near-Miss (Number Near Miss) — Losing Rounds Only

5.5.1 Activation Condition (Hard Rule)

     •     Generate near-miss only when HitCount=0.

     •     Near-miss is forbidden in winning rounds (HitCount\>0).

5.5.2 Count & Selection

     •     Select 3 or 4 numbers from the W area.

     •     Set 4–8 near-miss cells in the Y area (default target).

5.5.3 Near-miss Number Definition

     •     Apply ±1 to selected W numbers: w=00 → only 01, w=99 → only 98;

     •     Otherwise → use w-1 and w+1.

     •     Generated near-miss numbers must: not equal any W number, and be globally unique within the Y area.

5.5.4 Amount Placement Priority (Display Only)

     •     Near-miss cell amount priority: Jackpot 2 \> High 2 \> Medium 2 \> Low 2\.

     •     If near-miss count \< 8: fill according to priority order from left to right.

5.5.5 Boundaries, Deduplication, and Conflict Handling (Mandatory Priority)

Top priority is always: all 20 Y numbers are globally unique (must not be sacrificed).

Conflict handling order:

     1\.     If near-miss candidates conflict with already used numbers (hit cells / chosen near-miss / normal cells), replace candidates first.

     2\.     If still insufficient: reduce near-miss count (minimum guaranteed 4).

     3\.     If still cannot keep minimum 4 while maintaining uniqueness and “no W numbers in losing rounds”: redraw W numbers and regenerate near-miss.

     4\.     Under no circumstances may you sacrifice: Y-number uniqueness, and “no Y equals W in losing rounds.”

⸻

#

# 6\. Ticket Inventory

6.1 Definitions

     •     Ticket: a pre-generated issuable outcome object, including Multiplier M, HitCount, hit-cell info, fixed 20-cell printed amount layout, etc.

     •     Batch: 10,000,000 tickets per batch.

6.2 Bet Isolation & Global Issuance

     •     13 bets \= 13 separate ticket inventories.

     •     All sites share the same inventory (global issuance).

6.3 Inventory & Replenishment

     •     Initial: 10,000,000 per bet.

     •     If available \< 1,000,000, replenish 10,000,000 (new batch).

     •     Issue older batches first.

6.4 Ticket Issuance Rules (Acceptance Criteria)

     •     Ticket issuance happens after debit succeeds.

     •     Must guarantee “one ticket is issued only once.”

     •     After issuance, the round result is fixed; scratching is display only.

⸻

#

# 7\. Ticket Number (Ticket No.) Business Rules

7.1 Format

     •     NO.YYYYMMDD-XXXXXXXXXXXXXX-YYY

     •     YYYYMMDD: issue date (date issued to the user), not the ticket generation date.

     •     X: 14-digit numeric code (does not expose sequence, bet value, or batch, but is traceable in back-office).

     •     YYY: 3-digit check code.

7.2 Traceability Requirement

     •     The database must support: input full ticket\_no → uniquely retrieve the corresponding Ticket record (including bet, batch, sequence, issue time, and outcome info).

⸻

#

# 8\. Fairness & Records

     •     Each round’s result is determined by the issued Ticket.

     •     Scratching does not affect the result.

     •     History must display at minimum: Round ID/time, Bet, ticket\_no, Win/Lose, payout, Profit.

⸻

#

# 9\. Art & Audio

9.1 Art Style

Goal: Reduce gambling pressure, enhance “winning excitement,” and support multi-theme reskins.

     •     Style: 2D cartoon / bright colors / light atmosphere; this version can use a “Football Theme Skin (Tournament Season)” and avoid using the term “World Cup.”

     •     Visual focus: wins should feel “obviously exciting” (strong animations \+ strong contrast \+ big numbers/amounts); losses should be “light feedback” (subtle animation \+ quick wrap-up to reduce frustration).

     •     Skin mechanism: same gameplay can switch themes (sports/myth/local mascots, etc.); only art assets and copy change, not numbers or rules.

9.2 UI Components

Goal: Ensure the dev team knows required modules/states without missing screens.

     1\.     Main Scene

     •     Top bar: current Bet (adjustable), Balance, basic entries (History / Sound / Help).

     •     W Area (Winning Numbers): display 5 winning numbers (2-digit format with zero-padding).

     •     Y Area (Your Numbers): 20 cells, each includes number (2-digit), amount (printed amount), and cell state (covered/revealed/hit-highlight/near-miss marker).

     •     Bottom controls: Start/Buy, Reveal All, Bet \+ / Bet \-.

     2\.     Result Popup

     •     Lose: show “No Win / Play Again.”

     •     Win: show payout amount \+ tier copy \+ animations.

     •     Buttons: Play Again, Close.

     3\.     History

     •     Display at minimum: Round ID / time / Bet / ticket\_no / Win-Lose / payout / Profit.

     •     After each settlement, the round must be available in history, and ticket\_no must support back-office tracing (see Sections 8/7).

9.3 Scratch Presentation Rules

Goal: Ensure consistent scratching experience and no conflict with outcomes.

     •     Default: all 20 Y cells are covered by a scratch mask.

     •     Manual scratch: erase mask by mouse drag (web) / finger swipe (mobile).

     •     Display rule: when a cell is scratched, it immediately reveals number \+ amount; scratching does not affect the result.

     •     Reveal All: auto-complete scratching with a short animation; reveal all 20 cells and trigger the result popup.

9.4 Visual States & Highlight

Goal: Make hit / non-hit / near-miss instantly distinguishable.

Y cells must have at least 4 visual states:

     1\.     Covered: mask overlay (consistent material).

     2\.     Revealed \- normal: show number \+ amount in normal style.

     3\.     Revealed \- hit:

     •     Number highlight (glow/outline/one-time bounce).

     •     Amount highlight (brighter/larger/one-time sparkle).

     •     Optionally emphasize multiple hits (more hits \= more excitement).

     4\.     Revealed \- near-miss (only possible in losing rounds):

     •     A “so close” cue (e.g., subtle yellow border / small hint icon).

     •     Note: near-miss must not look like a real win (avoid misleading).

W-area highlight:

     •     After settlement (or when hits appear), matched W numbers may highlight once (optional).

9.5 Win Tiers Visual

Goal: Define popups/animations/copy per tier.

     •     Tiers: WIN / BIG WIN / SUPER WIN / MEGA WIN / JACKPOT

     •     Differences: progressively larger typography, stronger effects (more particles, flashes, shake, etc.), distinct theme colors/background decorations (art-defined), and clearly different popup copy/animations across tiers.

9.6 Sound Effects (SFX)

Goal: Define triggers without missing items, without technical implementation details.

     1\.     Bet/Start SFX

     •     Trigger: when user clicks Start and debit succeeds.

     •     Purpose: confirm “money has been placed.”

     2\.     Scratch SFX

     •     Trigger: continuous during manual scratching.

     •     Rule: stops immediately when scratching stops.

     •     Experience: may vary with scratching speed (denser/sparser).

     3\.     Scratch Complete SFX

     •     Trigger: when all 20 cells are revealed (manual completion or Reveal All finishes).

     •     Purpose: provide completion feedback.

     4\.     Win SFX

     •     Trigger: when the win popup appears.

     •     Rule: different tiers use different SFX (more dramatic for higher tiers).

     •     Reference: coin burst \+ cheers/applause.

     5\.     Lose SFX

     •     Trigger: when the lose popup appears.

     •     Purpose: light ending to reduce frustration.

     6\.     Payout-to-Balance SFX

     •     Trigger: when settlement popup ends / payout is credited.

     •     Purpose: confirm “money into wallet.”

9.7 Background Music (BGM)

     •     Style: upbeat, not harsh, suitable for high-frequency looping.

     •     On by default.

     •     Can slightly intensify on wins (e.g., more festive segment).

     •     Must not overpower SFX (SFX has higher priority).

9.8 Audio Settings

     •     Separate toggles for SFX and BGM.

     •     On by default.

     •     No volume sliders (toggle only).

9.9 Multi-theme Skin Asset List

Goal: Ensure dev/art teams know what to replace when reskinning.

Each skin must include at minimum:

     •     Main background

     •     Card frame

     •     Scratch mask texture

     •     W-area number style

     •    Y-area cell style

     •     Win popup background \+ 5-tier decorations (can share but recommended to differentiate)

     •     Icons: buttons, sound, history, etc.

     •     VFX assets: coin particles, flashes, fireworks, etc. (reuse/enhance by tier)

Switching skins does not change rules; only visuals and copy change.

⸻

#

# 10\. Compliance

     •     18+ only.

     •     Comply with gambling regulations in target markets.

⸻

# Appendix:

     •     Multiplier weight table / win-tier mapping: 18 multipliers, including ticket count/weight/HitCount/hit-cell patterns for each multiplier.

     •     Glossary and field mapping.

⸻

Multiplier weight table / win-tier mapping

| No. | Multiplier (M) | Probability (%) | Win Tier  | Y-Area Hit Amount Combination | Count (per 10,000,000 tickets) |
| :-: | :------------: | :-------------: | :-------: | :---------------------------: | :----------------------------: |
|  1  |       0X       |     70.6575     |  NO WIN   |               /               |           7,065,750            |
|  2  |      1.5X      |     11.4353     |    WIN    |             1.5X              |           1,143,530            |
|  3  |       2X       |     4.2883      |    WIN    |              2X               |            428,830             |
|  4  |      2.5X      |     2.8589      |    WIN    |             2.5X              |            285,890             |
|  5  |       3X       |     2.8589      |    WIN    |           1.5X+1.5X           |             57,178             |
|     |                |                 |           |              3X               |            228,712             |
|  6  |       4X       |     2.5714      |  BIG WIN  |           1.5X+2.5X           |             25,714             |
|     |                |                 |           |             2X+2X             |             51,428             |
|     |                |                 |           |              4X               |            179,998             |
|  7  |       5X       |     2.0012      |  BIG WIN  |         1.5X+1.5X+2X          |             20,012             |
|     |                |                 |           |           2.5X+2.5X           |             20,012             |
|     |                |                 |           |             2X+3X             |             40,024             |
|     |                |                 |           |              5X               |            120,072             |
|  8  |       6X       |      1.431      |  BIG WIN  |         2X+1.5X+2.5X          |             14,310             |
|     |                |                 |           |           2X+2X+2X            |             14,310             |
|     |                |                 |           |             4X+2X             |             14,310             |
|     |                |                 |           |             3X+3X             |             28,620             |
|     |                |                 |           |              6X               |             71,550             |
|  9  |       8X       |     0.8577      |  BIG WIN  |         4X+2.5X+1.5X          |             8,577              |
|     |                |                 |           |             5X+3X             |             8,577              |
|     |                |                 |           |             6X+2X             |             12,866             |
|     |                |                 |           |             4X+4X             |             12,866             |
|     |                |                 |           |              8X               |             42,885             |
| 10  |      10X       |     0.3812      |  BIG WIN  |         6X+2.5X+1.5X          |              1906              |
|     |                |                 |           |           4X+3X+3X            |              1906              |
|     |                |                 |           |             6X+4X             |              3812              |
|     |                |                 |           |             8X+2X             |             3,812              |
|     |                |                 |           |             5X+5X             |             5,718              |
|     |                |                 |           |              10X              |             20966              |
| 11  |      12X       |     0.1906      |  BIG WIN  |           6X+4X+2X            |              953               |
|     |                |                 |           |           5X+4X+3X            |              953               |
|     |                |                 |           |            10X+2X             |              953               |
|     |                |                 |           |             8X+4X             |             1,906              |
|     |                |                 |           |             6X+6X             |             2,859              |
|     |                |                 |           |              12X              |             11,436             |
| 12  |      15X       |      0.143      | SUPER WIN |          4X+4X+4X+3X          |              715               |
|     |                |                 |           |           8X+4X+3X            |              715               |
|     |                |                 |           |            12X+3X             |             1,430              |
|     |                |                 |           |            10X+5X             |             2,145              |
|     |                |                 |           |              15X              |             9,295              |
| 13  |      20X       |     0.1144      | SUPER WIN |           10X+6X+4X           |              229               |
|     |                |                 |           |           8X+6X+6X            |              343               |
|     |                |                 |           |            12X+8X             |              801               |
|     |                |                 |           |            15X+5X             |              915               |
|     |                |                 |           |            10X+10X            |             1,144              |
|     |                |                 |           |              20X              |             8,008              |
| 14  |      25X       |     0.0762      | SUPER WIN |         10X+5X+5X+5X          |              228               |
|     |                |                 |           |           12X+8X+5X           |              305               |
|     |                |                 |           |            15X+10X            |              610               |
|     |                |                 |           |            20X+5X             |              762               |
|     |                |                 |           |              25X              |             5,715              |
| 15  |      30X       |     0.0572      | SUPER WIN |         10X+10X+5X+5X         |              114               |
|     |                |                 |           |          12X+10X+8X           |              172               |
|     |                |                 |           |            15X+15X            |              400               |
|     |                |                 |           |            20X+10X            |              572               |
|     |                |                 |           |              30X              |             4,462              |
| 16  |      40X       |     0.0381      | MEGA WIN  |        12X+8X+10X+10X         |               76               |
|     |                |                 |           |            25X+15X            |              114               |
|     |                |                 |           |            30X+10X            |              191               |
|     |                |                 |           |            20X+20X            |              305               |
|     |                |                 |           |              40X              |             3,124              |
| 17  |      50X       |     0.0286      | MEGA WIN  |        20X+12X+10X+8X         |               28               |
|     |                |                 |           |          20X+15X+15X          |               29               |
|     |                |                 |           |            25X+25X            |               86               |
|     |                |                 |           |            40X+10X            |              114               |
|     |                |                 |           |            30X+20X            |              172               |
|     |                |                 |           |              50X              |             2,431              |
| 18  |      200X      |     0.0095      | MEGA WIN  |        50X+50X+50X+50X        |               48               |
|     |                |                 |           |             200X              |              902               |
| 19  |      800X      |      0.001      |  Jackpot  |      200X+200X+200X+200X      |               5                |
|     |                |                 |           |             800X              |               95               |

Glossary and field mapping.

| No. |      Field      |                                    Definition / Glossary                                     |
| :-: | :-------------: | :------------------------------------------------------------------------------------------: |
|  1  |       Bet       |                          Bet Amount (stake deducted for this round)                          |
|  2  |     Ticket      |           Ticket (a pre-generated outcome ticket that determines the round result)           |
|  3  |    HitCount     |                         HitCount in Y Area (0 \= no win; \>0 \= win)                         |
|  4  | M（Multiplier） |                   Multiplier (used to map Win Tier / configuration table)                    |
|  5  | Printed Amount  |           Displayed amount per Y-Area cell (20 cells; fixed at ticket generation)            |
|  6  |     Payout      |                    Sum of hit-cell amounts for this round (actual payout)                    |
|  7  |     Profit      |                                       \=payout \- bet                                        |
|  8  |    Near-miss    | Near-miss numbers (used only in no-win rounds to show “almost”; does not affect the outcome) |
