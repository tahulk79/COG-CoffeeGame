# Autonomous decisions — Farm & Café V3 rebuild

Decisions made during the overnight rebuild without the founder in the loop. Each can be reverted; numbers live in
`src/core/config/*.js`. Safety checkpoint: git tag `checkpoint/pre-v3` (commit `c6ec751`), work on branch `feat/v3-rebuild`. Nothing pushed, merged or deployed.

## Safety & data

| # | Decision | Why |
|---|---|---|
| S1 | V3 save lives under a **new key** `godbean-v3` (`@test` suffix in the dev test profile). The v1 keys (`godbean-progress`, `godbean-player`, `godbean-memory`) are only read for a one-time migration and never written or deleted by V3. | Zero risk of destroying a production save; rolling back to the old build finds the old save intact. |
| S2 | Every write first copies the previous save to `godbean-v3-prev`; unreadable saves are copied once to `-corrupt` and the `-prev` copy is loaded. A snapshot of the full save goes to `godbean-v3-pre-expiry` right before the Level-10 reset, and the region snapshot is also stored inside `story.expiry.snapshot`. | Recovery path for crashes, corrupt writes and the destructive reset. |
| S3 | All state changes go through one pure reducer (`src/core/game.js`); actions with a `txId` are idempotent (last 64 kept). Round unlock and rebirth use a txId generated once per confirmation dialog. | "Trừ tiền đúng một lần" even on double tap or replay. |
| S4 | Migration from v1: keeps character, coins (capped at 50,000 to neutralise old dev saves), level (mapped, capped at 9 so nobody is reset by surprise), starting country; players who finished the old heaven skip intro/Teacher and get the 3 credits. Old farm buildings/plots are not carried over (incompatible systems). | No coin/level loss, no surprise Level-10 reset on first load. |
| S5 | Dev QA profile `?profile=test` (dev builds only) isolates every key and unlocks `dev/*` actions (+coins, +XP, +beans, ripen). Production builds ignore it. | Test Rounds/Level 10 fast without touching real data. |

## Gameplay

| # | Decision | Why |
|---|---|---|
| G1 | One walkable 3D region map (60 × 48 m) holds farm, café block, build lots and the World Gate. Same layout template for every region, tinted per country. | Simple to learn; one scene = no loading between farm and café. |
| G2 | Crops: Robusta (L1, 15 s), Arabica (L3, 40 s), Liberica (Round 2, L6, 90 s). Loop EMPTY→PLANT→GROW→READY→HARVEST→EMPTY, plant disappears, no water/fertiliser. Growth runs on real time (also offline). | Matches the brief; clear early rewards. |
| G3 | Single resource "beans" (account-wide storage). Storage capacity = Kho (silo) level; one harvest may overflow the cap, the next is refused with "Storage full → upgrade". | One number to understand; upgrade has an obvious purpose. |
| G4 | Café = Order Counter + Brewing Counter only. Flow: customer queues → tap Order Counter (take order) → tap Brewing Counter (brew, uses beans) → tap again when ready (serve, coins+XP). Drinks: Espresso (L1), Milk coffee (L2 + Roaster), Latte (L5 + Roaster Lv2). Customers leave after 45 s of waiting. | Brief: only two counters; roaster lives in the café block and gates drinks/raises prices. |
| G5 | Buildings: Kho, Order Counter, Brewing Counter (free starters, fixed spots), Roaster, Drying yard, Tables (≤4), Kiosk (Round 2), Pastry case (Round 3), decorations. Level cap per Round: 3 / 5 / 8. Placement with live green/red preview; nothing can be built on roads, customer lanes or the gate plaza. | Township-style growth with Round as the gate for higher upgrades. |
| G6 | Land: 8 farm parcels (6 plots each) + 5 build/shop parcels; starter parcels free. Some parcels need a road opened first ("Mở đường"). Buying land is a contextual one-tap action (no modal). | Brief items "mua đất / mở đường / mở rộng". |
| G7 | Staff: Farmhand (+15% grow speed), Barista (+25% brew speed), Sprout-bot (+25% yield, Round 2), Brew-bot (+15% price, Round 2). One-time hire, owned forever, max 3 active per farm and 3 per café. No automation yet. | Brief: 2 workers + 2 robots, max 3, no auto plant/harvest. |
| G8 | Rounds: R1 free; **R2 = 1,800 coins, needs Level 10**; **R3 = 7,000 coins, needs Level 13**. No Round 4. R2: region #3 of every country, Liberica, Kiosk, Sprout/Brew-bots, south-west road + parcels, expired regions reopen, building cap 5. R3: other countries (4,000–10,000 each), north road + parcels, Pastry case, cap 8. Changing Round never spends rebirth credits and never resets a region. | Economy sim: R2 ≈ 48 min, R3 ≈ 2 h for a typical player. |
| G9 | Level 10 (first time only): gameplay paused → cinematic → Teacher explains → reset that region (buildings & levels, crops, café orders, staff assignments) → World Map, must pick another region. Kept: coins, level, XP, round, credits, beans, land titles, unlocked countries/regions, staff ownership, story. Starter buildings come back free at Lv 1 (also in the new region) and robusta planting is free when completely broke → **no softlock, no free coins**. Expired region is "resting" until Round 2. | Brief §5 + softlock guarantee. |
| G10 | Rebirth: 3 free credits granted by the Teacher. Spending one (Level ≥ 5, confirmation) gives a permanent +10% blessing of your choice (grow speed / café price / XP), max 3 per type. Loses nothing. Purchasing credits is stubbed (`rebirth/addCredits` requires a verified receipt; no store wired). | Independent from Rounds; architecture ready for paid credits without real payments. |
| G11 | Tutorial = 8 single-action steps derived from the save (plant → harvest → take order → brew → serve → build roaster → upgrade Kho → buy land). Current step = first unmet goal, so reload never leaves it stuck; skippable. | Brief §14. |
| G12 | XP curve: L10 at 920 XP (≈19 min in the sim), then +260 +40/level. Start coins 60. | 30–60 s to first harvest, ~20 min to the first expiry. |

## Story

| # | Decision | Why |
|---|---|---|
| T1 | Kept the existing character select and accident/faint intro cinematic (polished, skippable). Old heaven quiz, Council, Awakening, Coffee Memory, Auto mode, watering/fertiliser care, shifts and complex bar stations are removed from the live game. | Reuse the strong parts; remove what conflicts. |
| T2 | New Teacher ("Thầy") scene: short cinematic dialogue, grants 3 credits, opens the World Gate. Teacher also narrates the Level-10 event. | Brief §3. |
| T3 | 8 countries from the old world map. Round 1: Việt Nam, Brazil, Colombia (3 regions each; regions #1–2 open, #3 needs Round 2). Round 3 unlocks Kenya, Indonesia, Italy, Japan, USA with coins. | Uses existing map data. |

## Reference

The founder sent casual-farm screenshots as a simple visual reference. Only patterns were used (bright isometric look, compact HUD, speech-bubble tips, bouncing arrow + tap hand, drag-to-harvest); no assets, text or UI art were copied.
