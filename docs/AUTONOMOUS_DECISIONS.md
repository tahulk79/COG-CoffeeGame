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
| G1 | A region has two separate areas: the **farm** (60 × 48 m walkable map with fields, build lots and the World Gate) and the **café** (its own plaza with the café block, the C2 expansion lot and the street customers walk in on). The player switches between them with the HUD **Café / Farm** button (short fade, no loading: both areas live in one scene, only the current one is shown). Same layout template for every region, tinted per country. Customers keep coming while you are on the farm (badge on the Café button). | Founder: "the farm must be ONLY the farm"; a clear menu button to enter the café. One scene = no loading between them. |
| G2 | Crops: Robusta (L1, 15 s), Arabica (L3, 40 s), Liberica (Round 2, L6, 90 s). Loop EMPTY→PLANT→GROW→READY→HARVEST→EMPTY, plant disappears, no water/fertiliser. Growth runs on real time (also offline). | Matches the brief; clear early rewards. |
| G3 | Single resource "beans" (account-wide storage). Storage capacity = Kho (silo) level; one harvest may overflow the cap, the next is refused with "Storage full → upgrade". | One number to understand; upgrade has an obvious purpose. |
| G4 | Café = Order Counter + Brewing Counter only. Flow: customer queues → tap Order Counter (take order) → tap Brewing Counter (brew, uses beans) → tap again when ready (serve, coins+XP). Drinks: Espresso (L1), Milk coffee (L2 + Roaster), Latte (L5 + Roaster Lv2). Customers leave after 45 s of waiting. | Brief: only two counters; roaster lives in the café block and gates drinks/raises prices. |
| G5 | Buildings: Kho, Order Counter, Brewing Counter (free starters, fixed spots), Roaster, Drying yard, Tables (≤4), Kiosk (Round 2), Pastry case (Round 3), decorations. Level cap per Round: 3 / 5 / 8. Placement with live green/red preview; nothing can be built on roads, customer lanes or the gate plaza. | Township-style growth with Round as the gate for higher upgrades. |
| G6 | Land: 8 farm parcels (6 plots each) + 5 build/shop parcels; starter parcels free. Some parcels need a road opened first ("Mở đường"). Buying land is a contextual one-tap action (no modal). | Brief items "mua đất / mở đường / mở rộng". |
| G7 | Staff: Farmhand (+15% grow speed), Barista (+25% brew speed), Sprout-bot (+25% yield), Brew-bot (+15% price). One-time hire, owned forever, max 3 active per farm and 3 per café. **Updated 2026-11-06 (founder: “the robots and workers don't work”): staff now automate work** — farm units harvest + replant (selected seed, only when affordable and storage has room), the barista serves ready cups / takes orders / brews, the Brew-bot takes orders / brews faster; passive bonuses kept. Actions are pre-checked and dispatched directly to the store (no error toasts); claims prevent races; they work in the hidden area too and pause outside play. | Visible, useful staff; never spends coins the player cannot afford. |
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

## Founder corrections — 2026-11-06 (Vietnamese feedback, translated)

> “On the world map it is NOT split by Rounds. You can open any place, but it costs money. More money → open more.”
> “In the farm also no Rounds: empty land is opened with money, and the farm is ONLY a farm for growing.”
> “The café is a separate menu, with a map shown the same way as the farm. Scenery: a Vietnamese city, simple and easy to play. After ordering, customers go sit on chairs. Each screen has its own fitting menu.”
> “Any object that has an interaction or an upgrade must show a notice AT that object (e.g. the brewing counter shows an arrow or a + sign).”

These override G1, G5, G6, G8 (land/region parts), G9 (“rests until Round 2”) and T3 above.

| # | Decision | Why |
|---|---|---|
| F1 | Regions are bought with coins (`world/unlockRegion`), any country, any region. Price = country base × tier (1 / 1.6 / 2.5). Country unlock and every Round/country gate on the map are removed. | Founder: no Rounds on the map, more money → more places. |
| F2 | The **first region of the game is free**, and after the Level-10 expiration the **next new region is free once** (`world.freeUnlocks`). | A new player can never be stuck on the map, and the expiry can never softlock (coins may be low right after it). |
| F3 | Farm = 14 fields only (F1 free, F2–F14 for coins) + the fixed storehouse + the World Gate. Build lots B1–B5 and closed roads are removed; every road is open. | Founder: the farm is only for growing, land is opened with money. |
| F4 | The **Drying yard is retired** (not in the build menu, `build/place` refuses it); old saves keep rendering an existing one. | It was the only farm-side building; its +yield is not needed for the loop. |
| F5 | **Migration (layout v3) refunds** everything that no longer fits: bought build lots (their price) and every farm-side building (cost + upgrades paid); starter buildings snap to their new fixed spots; regions visited before the change count as owned. | Nobody loses value from a design change. |
| F6 | **Rounds are kept only** for: Liberica, Kiosk (R2), Pastry case (R3), the two robots (R2) and building level caps 3 → 5 → 8. Never for land, regions or countries. | Keeps a long-term goal without gating space. |
| F7 | Café = its own map styled as a small **Vietnamese city street** (tube houses, balconies with plants, shop signs, awnings, red lanterns, asphalt street + alley, zebra crossing, trees, lamps, power poles, parked scooters, plastic stools). Static scenery is merged into ~4 meshes (vertex colors + one sign-text atlas) to keep draw calls low. Café lots S (starter) / C2 500¢ / C3 1,400¢. | Founder: Vietnamese city, simple and easy to read; mobile performance. |
| F8 | **Seats**: 4 terrace seats + 2 per Tables building. Taking an order needs a free seat (`noSeat` otherwise: “Hết ghế — xây thêm bàn”). After ordering the customer walks to the seat and sits; when served the cup appears on the table and the customer leaves. | Founder: customers sit after ordering; seats make Tables meaningful. |
| F9 | **Per-screen toolbars**: farm = Seeds, Storage, [☕ Café], Staff (farm), World, Progress; café = Build, Menu (drinks), [🌱 Farm], Staff (café), Progress. Storage opens the storehouse card (fill + upgrade). | Founder: each screen has its own fitting menu. |
| F10 | **Object notices** in the world: ▲ (upgrade available, affordable, within the Round cap), “!” / no-seat on the Order Counter, “+” / “☕” on the Brewing Counter, sickle over a ripe field, “+” on an affordable for-sale sign. Constant screen size, on top, bouncing, tap = tap the object; an interaction pin with an available upgrade gets a small ▲. Hidden in the other area, during placement and cinematics. A screen-reader live region lists them. | Founder: notice AT the object. |
| F11 | The tutorial roaster spot moved to (2, 111): the old (2, 110) overlapped the customer lane (the roaster is 4 × 4 m), so the tutorial's suggested placement was invalid. Covered by a test. | Bug found while verifying the build step. |
| F12 | Seated customers have a patience of 60 s from taking the order; when it runs out they leave **angry** (swear bubble, toast), the cup is lost. Staff and auto actions serve the most urgent customer first. | Founder: waiting too long after sitting should make customers leave and curse. |
| F13 | One shared **grid pathfinder** (0.5 m cells, A* 8-neighbour, no corner cutting, line-of-sight smoothing, capped search, nearest-free fallback, stuck → repath → nudge) for the player, staff and customers; obstacle grid rebuilt only when buildings change. | Founder: serving staff got blocked by obstacles. |
| F14 | Orders can only be taken from a customer who has reached the queue in front of the Order Counter (counter tap, pad, staff, auto) — before, a pad / barista took the order while the customer was still in the street, so they went straight to a seat. Queue lane, counter lane and streets are forced walkable in the nav grid; a Node test checks spawn → every queue slot and queue → seat → exit. | Founder: “customers must walk to the order counter”. |
| F15 | Staff breaks: workers roll a slack chance per minute of actual work (phone), robots run out of battery after N minutes of work; resume = pay a small fee via a tappable coin bubble or the Staff sheet. Stopped units release their claims and give no bonus. | Founder request; a light coin sink that keeps staff visible. |
| F16 | Auto play is a guided demo, not an idle farm: one free 180 s run, the real avatar does the real actions one by one with captions; only seeds are spent; the player can only look around. | Founder: “the player watches how it's done as a guide”. |
| F17 | Customers show no drink until they have ordered (“💬” + patience bar); the drink pops into the bubble when the order is taken. | Founder request. |


### Founder correction — Level-10 incident is a full restart
- The incident now wipes **everything** (coins → start coins, XP/level → 1, Round → 1, beans → 0, staff removed, all regions and land titles cleared, owned regions cleared). Kept: character, story progress, rebirth credits/blessings, auto runs, tutorial done.
- The player must pick a different region (the expired one is refused in `chooseRegion`); it is free (first-region rule) and starts with exactly **1 empty field (F1)** and an **empty café** (free starter counters, storehouse and terrace at Lv 1).
- A full copy of the save is kept in `godbean-v3-pre-expiry` before the wipe. The incident still happens only once per save (`story.level10Done`).
| F18 | The farm gets a Build menu again (dryer un-retired + decorations) on free grass only (`onField` error on fields); the World map moves from the toolbar to the Progress sheet to keep exactly 4 menus per screen. | Founder: “the farm must have Build too”. |
| F19 | Auto runs can be bought with in-game coins (150¢ + 50¢ per previous purchase, capped at 600¢), confirm card + idempotent txId. | Founder request; a coin sink that never needs real money. |
| F20 | Tutorial targets are re-framed when near an edge (not only when fully off-screen); world badges slide inside the viewport margins; an unaffordable upgrade step tells how many coins are missing and sends the player to the café. | Founder screenshot: storehouse ▲ cut at the screen edge. |
| F21 | Placement shows the ghost immediately at the nearest valid spot with a hint under it — no tap needed to see where it will be built. | Founder: “there must be a faint ghost so you know where it will be built”. |

