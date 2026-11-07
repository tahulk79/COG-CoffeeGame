# Farm World 2.0 — Audit

> Audit of the working tree on branch `feat/staff-phase1` (2026-11-07). Read-only. Nothing was edited, committed or run in a browser.
> It merges 9 audits: map, buildings, economy, progression, HUD, staff, rendering, tests, design docs.
> Line numbers are a snapshot. Another session edited `game.js`, `state.js`, `derive.js`, `economy.js`, `staff-upgrades.md` and added `qa-personas.mjs` and `farm-world.js` during the audit. Re-check every line before editing.

Tags: **PRESERVE** = keep as is · **IMPROVE** = keep the idea, fix the code · **REPLACE** = new model · **PROPOSE** = new feature, needs founder OK.
Priority: **P0** = blocks Farm World 2.0 or loses saves · **P1** = core of the update · **P2** = quality · **P3** = cleanup.

---

## 1. Summary

1. **Two land systems exist because plots are config, not objects.** A plot is a static 3×2 slot of a lot with kind `farm` (`plotsOf`, `ALL_PLOTS`, `plotById`, layout.js:108-123). The save only stores crop state (`region.plots[id]`). Nothing can place, move or remove a plot.
2. **The lot kind decides use.** `LOT_KINDS` (layout.js:104) plus single-lot containment in `placementError` (derive.js:149-165) makes fields reject buildings (`onField`) and other lots reject fields. The same assumption is copied into the migration, placement tints, materials, fences, staff `canStand`, badges and tests.
3. **There is no global grid.** Buildings snap to a 1 m lattice while sizes come in 2 m cells. Lot z-edges sit on .5 m. Odd road widths (5 m, 3 m) split the 34 farm lots into two 2 m parity groups (17/17). Result: Y0 fits 2 dryers, not the documented 4.
4. **Singletons are a workaround, not a rule.** `MAX_INSTANCES[type] || 1` (derive.js:167) exists because `effect()` reads only the max-level instance (`buildingLevel`, derive.js:16, 20). A 2nd roaster/dryer/kiosk/pastry would add zero. Only tables stack, linearly and without limit apart from the cap of 4.
5. **The economy is passive multipliers.** One resource (`inventory.beans`). Dryer = +yield, roaster/pastry/tables = +price, kiosk = +arrivals, staff = linear uncapped %. No inputs, outputs, recipes or batch times. Real capacity exists only in the café (brew slots, queue, seats).
6. **The sim does not test the real game.** It plays farm and café in one region (never calls `play/chooseGame`), never builds a dryer (all farm spots are on fields), never sells beans, never uses loans, gifts, venues or staff labour.
7. **Real money leaks already exist.** Loans stack with no ceiling (400 × 5,000 = 2,000,060 coins in phase `gate`). Reload forgives debt above 1e9. The reducer does not enforce one game per region. Removing caps today would make tables an infinite price multiplier, and a demolish refund would farm XP.
8. **The UI is a web panel, not a game HUD.** A detached bottom card with title, × and prose; a flat build grid with `2×2` text and `+25%`; developer ids (`Field F2`); empty owned land has no tap action; upgrade only through a ▲ shown within 9 m; open sheets rebuild their DOM on every dispatch.
9. **The camera has no overview.** Farm zoom max 1.9 shows ~16 m × 43 m of a ~119 m-wide projected map. The clamp is axis-aligned while the view is rotated 45°. HUD insets are guessed with fixed fractions.
10. **Hidden blockers for the migration.** `staff.js:51` reads `PARCELS.F1.rect` at import. A reload during `chooseRegion` after the Lv10 incident softlocks the player (reproduced). New FARM_STEPS would re-open the tutorial for veterans. `migrateFarmLots` reads the live `LOT_KINDS`, so changing it silently changes v3→v4 migration.

---

## 2. Per system

### 2.1 Farm map & land

**Existing behaviour**
- `BOUNDS` 64 × 104 m, x −32..32, z −76..28 (layout.js:27). 22 axis-aligned `ROADS`, 4 open from the start (33-56).
- `PARCELS` (60-100): 34 farm-area lots + café S/C2/C3. Kinds: 18 `farm` (F1-F18, 10×6 m), 6 `build` (Y0, W1-W5), 3 `decor` (D1, G1, H1), 4 `pasture`, 1 `pond`, 2 `orchard`, 3 `shop`. Starters F1, Y0, S.
- Land is coins only, any order; no level or road gate (`parcelError` derive.js:193-201).
- `roadOpen` is derived from owned lots (`opensRoads` or touch, derive.js:54-60). `region.roads` is saved (game.js:59, 73) but never read. `land/openRoad` (game.js:363-371) can never succeed; `roadError` (derive.js:202-207) never returns null.
- `frontierParcels` returns every unowned farm lot (derive.js:63-67). `farmViewBounds` (69-77) equals the full `BOUNDS` from Lv1. 32 for-sale signs show at start. Pinned by core.test.mjs:627-646.
- Silo footprint [8,13,10,15] sits on grass outside every lot.

**Problems and root causes**

| Problem | Root cause | Evidence |
|---|---|---|
| Crop land and building land are exclusive zones | `LOT_KINDS` + single-parcel containment | layout.js:104; derive.js:147-165 |
| No single 2 m grid; Y0/W1 fit 2 dryers not 4 | 1 m corner snap; .5 m lot edges; odd road widths | derive.js:139-145; layout.js:34-94; farm-map.md §3 |
| Frontier and dynamic bounds do nothing | No road filter (founder chose coins-only, any order) | derive.js:62-77; world.js:1-6 header is stale |
| Dead road state | Leftover from paid roads | game.js:59, 73, 353, 363-371; derive.js:202-207; action-bar.js:171 |
| Doc drift | gatePlaza in code [-4,20,4,26] vs doc [-4,17.5,4,26]; no `START_BOUNDS`, no silo in `RESERVED`; v3-architecture says dryer refused | layout.js:126-127, 216-220; farm-map.md §3/§8/§11 |
| Fence gap always east | Hard-coded on x1 | world.js:397-404 |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| New pure module `src/core/grid.js`: CELL 2 m, origin (−32,−76), 32 × 52 = 1,664 cells. `gridOf(s)` derives typed arrays memoised per region object (WeakMap): terrain, chunk + owned, unlock cost, occupant, allowed-use bitmask, nav cost, road connectivity (flood fill from the gate). Nothing per tile is saved. API: `cellAt`, `cellRect`, `canPlace(s, defId, c, r, rot, ignoreId) → {error, cost, reasonCell}`, `nearestValid`. | REPLACE | P0 |
| Re-quantise the map in layout v5 (Option A): round every lot and road edge to the nearest even metre. Verified: no overlaps, lot sizes kept, lots move ≤ 0.5 m, roads become 4 m. Widen nRing_W/E, wLane3, eLane3 (become 2 m). D1, P1, W2, O1, P3, O2 newly touch the spine: re-check `opensRoads`. Option B (if exact F1-F14 rects are required): 1 m tiles with +0.5 m z offset; no single 2 m overlay. | IMPROVE | P0 |
| Lots become **chunks**: same ids, cost, starter, `opensRoads`. `kind` becomes a terrain preset (soil, gravel, grass, water, orchard trees), not a use restriction. | REPLACE | P0 |
| Keep coins-only, any order, all for sale, roads open with land, glide to new land. Rename `frontierParcels` → `buyableChunks`; add `frontierChunks` only to pool signs. | PRESERVE | P0 |
| Delete `region.roads`, `land/openRoad`, `roadError`, `{road}` fail data, `hud.parcel.noRoad`. Fix farm-map.md and v3-architecture.md. | IMPROVE | P2 |
| Player-placed path tiles (Infrastructure) stored as `region.paths` cell indices; optional "needs road" for production. | PROPOSE | P2 |

**Systems affected:** layout.js, derive.js, game.js land/*, state.js, world.js, placement.js, nav.js, index.js, staff.js, HUD, tests, sim.
**Risks:** medium. Visual shift ≤ 0.5 m. Café stays on rect rules until a café grid exists.
**Migration:** v5 step; see §2.9.

### 2.2 Plots / crops

**Existing behaviour**
- Plot ids `F<n>-<k>`, 108 static frozen objects; positions x0 + 10(c+.5)/3, z0 + 1.5 or 4.5 (72 of 108 non-integer x).
- `ownedPlots = region.parcels.flatMap(plotsOf)` allocates each call (derive.js:78). `plotById` is a linear find (layout.js:123).
- `farm/plant` checks `r.parcels.includes(plot.parcel)` (game.js:126-131). `farm/harvest` only checks `r.plots[id]` (game.js:145-148).
- `normalizeRegion` keeps `region.plots` unvalidated (state.js:235). An unknown crop id throws in `growMs` (derive.js:33, 36, 84).
- Crops: robusta Lv1 (2¢, 15 s, 2 beans), arabica Lv3 (6¢, 40 s, 4 beans), liberica legacy only (economy.js:18-24). 3★ when harvested within 10 s of ripening.

**Problems**

| Problem | Root cause | Evidence |
|---|---|---|
| Plots cannot be placed, moved or removed; dynamic ids fail with `unknown` | Static config keyed by lot | layout.js:108-123; game.js:128-130; staff.js:628; action-bar.js:56-60 |
| Orphan crop ids survive, count in `graceActive`, can be harvested | No validation | state.js:235; derive.js:94; game.js:147 |
| Unknown crop crashes | No crop check on load | derive.js:33, 36, 84 |
| Hot-path allocation | `plotsOf` computed per call, 4×/s in badges, per staff think | layout.js:110-121; index.js:591, 876, 1106; staff.js:429, 456, 587 |
| Robusta beats arabica per plot-minute at every dryer level; dryer L2-L4 add 0 robusta beans | `Math.round` on % of tiny integers | derive.js:37, 246; economy.js:60-62, 145 |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| `region.beds = [{id, c, r}]` separate from `region.buildings`. Crop state stays in `region.plots[id]`. Selectors `D.plotOf(s,id)`, `D.ownedPlots(s)` (memoised Map, same `{id,x,z}` shape). Actions `farm/placeBed`, `farm/moveBed` (crop moves with id), `farm/removeBed` (empty only). New ids from `uid(s,'p')`, never the `F<n>-<k>` pattern. | REPLACE | P0 |
| Keep ids F1-1..F18-6 for legacy beds (cols 0/2/4 × rows 0/2 of each field, ≤ 1.2 m from old spot). | PRESERVE | P0 |
| Bed price curve and/or level cap, so decoupling land from plots cannot multiply output for free (today F2 ≈ 13¢/plot, F18 ≈ 3,083¢/plot). | PROPOSE | P1 |
| Normalise beds (unknown/duplicate/overlap dropped); validate plots (crop ∈ CROPS, finite `plantedAt`); never drop a planted crop on an existing bed. | IMPROVE | P0 |
| Integer quality bonus (+0/+1/+2 beans) instead of ×1.25/×1.5 rounding. | IMPROVE | P1 |

**Risks:** high if half-done: every `plotById` caller must move together.
**Migration:** count-preserving (6 beds per owned field), crops kept by id.

### 2.3 Buildings & placement

**Existing behaviour**
- `BUILDINGS` (economy.js:42-76): id, zone (`farm`|`shop`|`any`), size in cells, cost, starter, fixed, walkable, level, decor, xp, `upgrade[]` (7 prices → max L8), model, icon, `effect{key:[8]}`. No category, maxCount, I/O, workers, storage type or rules.
- Farm menu `dryer, flowers, lamp, plant` (economy.js:78). Café menu roaster, tables, kiosk (Lv7), pastry (Lv8), decor.
- `buildError` (derive.js:168-177): unknown → round → level → `limit` → coins. `MAX_INSTANCES = {tables:4, flowers:12, plant:12, lamp:12}`, default 1.
- `placementError` order: one containing parcel / `onField` / `outside`; farm lot `onField`; kind `wrongZone`; `notOwned`; RESERVED `blocked`; `overlap`. No game-mode, nav or road check.
- Actions: `build/place`, `build/move` (free, refuses `fixed`), `build/upgrade` (instant). **No demolish.** Refund only in migrations (`builtValue`, state.js:143).
- `rot` not validated: 1.5 is stored and renders at 135° (verified).
- Starters (silo, orderCounter, brewCounter, terrace) exist in every region whatever its game (game.js:59-74; state.js:82-85).
- Ghost preview: translucent clone, ≤ 16 footprint tiles all one colour, lot tint per matching owned lot (new geometry per start), no cost shown, ✓ charges at once (placement.js:20-141; hud/placement.js:43-58).
- Tests pin it: core.test.mjs:104-133, edge.test.mjs:76-121, 255-263, nav.test.mjs:42.

**Problems**

| Problem | Root cause | Evidence | Sev |
|---|---|---|---|
| Unjustified singletons | Limits in a selector with default 1; exists only because effects ignore duplicates | derive.js:167, 173-174; AUTONOMOUS G5 (autonomous, not founder) | high |
| Duplicates useless | `buildingLevel = max`, `effect` = value at max | derive.js:16, 20, 32-49 | high |
| Tables unbounded once uncapped | `effectSum` linear; seats = count × 2 | derive.js:21, 38, 42, 322 | high |
| No demolish/refund | No action | game.js:312-347 | med |
| Core accepts café buildings in a farm-mode region | No `region.mode` check | derive.js:149-177; UI-only guard index.js:219, 1201 | med |
| Type-only lookups break with duplicates | `find`/`byType` | action-bar.js:47; index.js:356; buildings.js:330; hud/tutorial.js:109-111; sheets.js:102; toolbar.js:36; hud/index.js:70 | med |
| Café stations are hard-wired | FIXED pads, posts, seats | index.js:64, 71-74; staff.js:56; layout.js:126-160; seats.js:35 | med |
| Build XP on every placement → demolish loop farms XP | No first-time guard | game.js:324; economy.js:73-75, 219 | med |
| Dead `roundCap` path; upgrades never change the model | Caps all 8; sync updates badge only | economy.js:36; derive.js:186-188; buildings.js:262-266 | low |
| Café build tutorial completes on any build | `stats.built > 0` | core/tutorial.js:20 | low |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| Data-driven definitions: category (Production/Processing/Storage/Infrastructure/Decoration), footprint, cost + `costGrowth`, unlock level, `maxCount(level)`, upgrades[], production {inputs, outputs, seconds, batch}, storage {good, capacity}, workers, terrain mask, needsRoad, refund ratio, visual tiers. Delete `MAX_INSTANCES`. | REPLACE | P0 |
| Ship uncapping **together with** the new aggregator (§2.4). With one instance per type the new formulas must return today's numbers. | REPLACE | P0 |
| Keep orderCounter, brewCounter, terrace, silo at maxCount 1, fixed, not removable, until multi-station logic exists. | PRESERVE | P0 |
| `canPlace` per tile (§2.1) returning per-tile `{valid, reason}` + cost. Ghost paints each tile (`setColorAt`); bar shows cost and reason. | REPLACE | P0 |
| Validate `rot` integer 0..3; sanitize uid, level, x/z on load. | IMPROVE | P2 |
| `build/demolish {uid}`: refuse starters/fixed, running jobs, stored goods, seated tables, storage that would overflow. Refund `floor(ratio × paid)`; decor 0. Record `b.paid`. Build XP once per slot (`r.builtMax[type]`). Confirm modal. | PROPOSE | P1 |
| Gate `build/*` by `region.mode` in core (mode null keeps today's behaviour). | IMPROVE | P1 |
| Resolve buildings by uid everywhere. | IMPROVE | P0 (before duplicates) |
| Remove `roundCap`, or replace with per-upgrade level gates. | IMPROVE | P3 |

**Risks:** balance shifts in every selector; tests and the Lv10 window must be re-tuned.
**Migration:** existing counts ≤ new caps. Set `b.paid = def.cost` (plus upgrades) on v5. No refund needed for buildings that still fit.

### 2.4 Economy & production

**Existing behaviour**
- Chain today: harvest → global `beans` → (farm) sell 2¢ at the storehouse / (café) buy 4¢ → brew (1/2/3 beans) → serve 10/22/36¢.
- `priceMultiplier = 1 + roaster + pastry + Σ tables.tip + Σ staff + blessing` (derive.js:38). Ceiling before staff ≈ 4.04×.
- `yieldOf` adds dryer + Σ staff (derive.js:37). Staff sums linear, uncapped, `hireLimit = level`.
- New during audit: `TEND` (economy.js:148), `staff/tend`, `farm/water` (game.js:436-455). Payback-negative (≈ 4.8¢ of plot time per 15¢).
- Venues: lemon 400¢, tea 1,200¢, bar 2,200¢; no inputs; ~86/153/240¢/min at 4★; rate trusted from realm (street.js:234, 468-504).

**Measured — `npm run sim -- 60` (combined farm + café, current tree)**

| Metric | Value |
|---|---|
| Lv10 (vn-1) | 16 m 46 s; expiry 16 m 47 s; br-1 entered |
| 2nd Lv10 / Lv14 | 32 m 23 s / 55 m 28 s |
| End state | L14, 896¢, served 494, harvested 305, 15 parcels |
| Earned/min per 5-min block | 192, 327, 440, 295 (reset), 289, 494, 534, 555, 638, 659, 637, 675 |
| Income sources | serve +28,674 (100%); sold 0; bought 0 |
| Spend | upgrades −14,610, land −7,420, hire −3,450 (14 farmhands), seeds −2,032, build −380 |
| Built | silo L5, orderCounter L4, brewCounter L4, terrace L5, roaster L4, tables ×3. Never: dryer, kiosk, pastry |
| Refusals | `farm/harvest:storageFull` 42,846 (café is bottleneck); `build/place` onField 4,080 / outside 2,146 / overlap 4,442 / notOwned 930 (40-min run) |
| End rates | robusta 4,839 ms (+210% from 14 farmhands), priceMul 1.85, espresso 1,875 ms, 2 slots, queue 8, arrival 6.5 s, 18 seats |
| 70-min run (tests audit) | Lv10 16.8 min, 2nd Lv10 32.4 min, Lv15 62.9 min |

**Measured — split-mode probe (inline node, not committed, 40 min)**

| Mode | Lv10 (no gifts / gifts) | Income |
|---|---|---|
| Farm-only (br → co) | 15.3 / 14.7 min | ~290-430¢/min, all from selling 6,281 beans; tap-bound; 4 parcels, 0 hires |
| Café-only (it → jp) | 20.0 / 16.4 min | 309-1,004¢/min; 694 beans bought (≈15% of revenue) |

The comment at economy.js:279 ("farm-only ≈ 20, café-only ≈ 22-30") cannot be reproduced; no split sim exists.

**Per-plot economics** (robusta 3★, 2¢/bean): 16 / 32 / 56 ¢ per plot-minute at dryer L0 / L1 / L8. Dryer L1 ≈ +100¢/min for 120¢ → ~1.2 min payback.

**Problems**

| Problem | Root cause | Evidence | Sev |
|---|---|---|---|
| Unlimited loans | `loanError` checks pack only; `loan/` not in the notPlaying gate | derive.js:291-294; game.js:529-538, 697-698 | high |
| Reload forgives debt > 1e9 | owed clamp 1e9 vs coins 1e15 | state.js:57 vs :119 | med |
| No throughput buildings | Per-type multipliers; single resource | economy.js:56-71; derive.js:16-21, 37-38 | high |
| Staff value counted twice (work + uncapped %) | Linear Σ | derive.js:29, 33, 37-40 | med |
| Dead upgrade levels | Rounding | derive.js:37, 246 | med |
| Mode not enforced in core | `apply()` gates phase/pause only | game.js:693-711 | med |
| Sim invalid for the shipping game | Predates split, v4 lots, gifts, loans, venues | economy-sim.mjs:41, 46-54, 63, 84 | high |
| Farm-only is labour-bound | 2 taps per cycle; land adds nothing without staff | split probe | med |
| Venue income has no inputs, beats a Lv1 café | Realm-trusted rate | game.js:286-295 | med |
| Grace cycling | No cooldown, no mode check | derive.js:90-95, 113-114, 129 | low |
| Gift coins skip auto-repay and `stats.earned`; gift beans skip the cap | `grantItems` writes directly | game.js:40-48 | low |

**Recommended changes and formulas**

| Change | Tag | Prio |
|---|---|---|
| **Production model.** `GOODS` + `RECIPES`. Farm chain: field → `beans` → drying yard (beans→dried) → roastery (dried→roasted) → packing shed (10 roasted→1 bag) → storehouse sell. `b.job = {recipe, at, ms, n}`, `prod/start` consumes inputs and fixes `ms` at start, `prod/collect` adds outputs (refused `storageFull`). | REPLACE | P0 |
| Formulas: `n(L) = batch × (1 + floor((L−1)/2))`; `speed(L) = 1 + 0.12(L−1)`; `rate = 60·n·speed / seconds` per min. Starting values: dry 8→8 / 24 s / 1 XP; roast 8→8 / 32 s / 1 XP; pack 10→1 bag / 40 s / 2 XP. Sell: beans 2, dried 3, roasted 4.5, bag 55. Dryer L1 payback ≈ 6 min. Calibrate in the sim. | REPLACE | P0 |
| **Duplicates.** k-th copy cost `round5(cost × 1.6^(k−1))`. `C_type = Σ rate_i × eff_i` (`eff_i = max(0.5, 1 − 0.15(i−1))`, default 1 in v1). `Q = min(H, C_dry, C_roast, C_pack, S_sell)`; `H = min(plot supply, labour supply × yield)`. A copy of a non-bottleneck stage adds 0. HUD names the bottleneck. | REPLACE | P0 |
| Remaining bonus keys: diminishing `B·(1 − Π(1 − b_i/B))` (B = 0.6 grow/yield, 0.5 price). Cap `priceMultiplier ≤ 2.5`. | IMPROVE | P1 |
| **Storage.** `stored(s) = Σ goods × space`; `capacity = silo[L] + Σ warehouse[L_i]` (warehouse e.g. 250¢, [50,80,120,170,230,300,380,470]). Soft cap kept. Every `beans ≥ cap` check becomes `stored ≥ cap`. | IMPROVE | P0 |
| **Loan ceiling** `maxDebt = 2000 + 1000 × level`, phase `play` only, fix owed clamp. Keep stacking, fee, auto-repay, carry-over. | IMPROVE | P0 (founder OK) |
| **Mode-gate** `farm/*` sell/plant/harvest (mode farm or null) and `shop/buyBeans`, grace, café prod (mode café). Invariant: buy ≥ 1.5 × sell per good. | IMPROVE | P0 |
| Café roaster as capacity: beans → roasted (e.g. 6 per 20 s), brew consumes roasted, keep drink gates (milk ≥1, latte ≥2), drop `priceBonus`. Grant `min(beans, 20)` roasted on migration. | PROPOSE | P1 |
| Transport/market stage (truck, +20% on bags, capacity per trip); keep instant sale as fallback. | PROPOSE | P2 |
| Grace: mode-gated, `stored === 0`, 60 s cooldown. | IMPROVE | P2 |
| Venues into the sim; cap share (e.g. ≤ 35% of café income at Lv9). | PROPOSE | P2 |
| Keep real café capacity, quality stars, bean prices 2/4, gifts, `hireLimit = level`, café pause, deterministic reducer. | PRESERVE | P0 |
| Write `FARM-ECONOMY-BALANCE.md` with these formulas and sim outputs. | IMPROVE | P1 |

**Risks:** removing dryer yield cuts tap-bound farm income ~40% until processors exist; processing adds taps; without staff jobs processors idle.
**Migration:** additive `inventory.items` (no SCHEMA bump); dryers keep uid/level/position, `job:null`, `paid`.

### 2.5 Inventory & storage

- **Existing:** `inventory = {beans}` global; capacity = this region's max-level silo, [40…520] (economy.js:43-45, derive.js:32). Soft cap: one harvest may overflow (game.js:150-157). Gifts and dev grants skip the cap. Arriving over cap in another region blocks harvest and buy (beans link).
- **Problems:** one counter, no warehouse, duplicate silo adds nothing, silo is `unknown` to `buildError` (starter). Autoplay walks to hard-coded `FIXED.silo` (index.js:655). HUD/tutorial take the first silo by type.
- **Changes:** GOODS + `stored()` + warehouses (IMPROVE, P0). Starter silo = storage instance #1 (PRESERVE). Pooled capacity first; real per-building inventories + transport only if the founder wants it (PROPOSE, P2). Gift goods respect storage or allow one overflow (IMPROVE, P2). Expiry wipes `inventory.items` and jobs.
- **Systems:** derive capacity/quotes, game.js harvest/collect/buy/grantItems/expiry, staff.js 431/457/585/616, index.js autoplay, top-bar.js:57, toolbar.js:36, sheets.js:86-108, action-bar.js:68, 144-150.
- **Risk:** storage deadlock with intermediate goods → every good is sellable.
- **Migration:** stored = beans for old saves.

### 2.6 Staff & automation

**Existing behaviour**
- Each idle unit thinks every 0.35 s; `farmJob` scans `ownedPlots`; harvest first (needs room), plant next; nearest by straight line, Lv2 oldest ready (staff.js:428-450). Stand spot `z + 1.25` (426). Lv5 second plot within 3.5 m (583-596).
- Idle spots anchored to `PARCELS.F1.rect` **at module load** (staff.js:51-57).
- Robots: one task or Auto (re-picked every 30 s, staff-brain.js:44-48).
- No delivery: harvest adds to global beans.
- `hireLimit = level`, global, no per-zone cap (economy.js:85; derive.js:219, 276-277). Pinned core.test.mjs:176-205, edge.test.mjs:136.
- Nav: 0.5 m grid per area, farm 136 × 216 = 29,376 cells, café 224 × 84 = 18,816. A* 8-neighbour, MAX_ITER 40,000, string-pull (nav.js:38-184). Rebuild ~0.1 ms for 60 rects; worst A* ~2.2 ms (desktop node). `NAV_CLEAR` forces every farm road walkable, open or closed (nav.js:16). Plots and locked land walkable.
- Every staff action = structuredClone of the save + 2 localStorage writes + full `syncAll`.

**Problems**

| Problem | Evidence | Sev |
|---|---|---|
| Plots are not first-class; dynamic ids invisible to staff | layout.js:110-123; staff.js:429, 456, 584, 587, 628 | high |
| Realm crashes on import if F1 changes | staff.js:51-57, 230-231, 780 | high |
| Arrival = path end; work done at a distance; autoplay acts after 12 s anywhere ("harvest through walls") | nav.js:129, 165; staff.js:333-335, 612-629; index.js:698-699 | high |
| One implicit storehouse | game.js:145-173; derive.js:32; index.js:655 | high |
| No replan on nav rebuild; job x/z captured at start; claims not released on move/demolish | staff.js:329-357, 426, 539-540 | med |
| Euclidean nearest ignores reachability | staff.js:402-407; index.js:631 | med |
| `canStand` loops all PARCELS/ROADS per probe, uses lot kinds | index.js:589-597 | med |
| No jobs at processing buildings | staff.js:428-445; staff-brain.js | med |
| Dispatch cost at scale; O(n²) separation; unbudgeted A* | game.js:684; store.js:45-66; staff.js:378-399 | low-med |
| Autoplay ignores staff plot claims | index.js:641-651; staff.js:944 | low |
| hire/recruit/assign ignore `canPlay` | game.js:383, 396, 453-461 | low |
| Stale docs say "max 3 per farm/café" | v3-gdd.md:50; AUTONOMOUS G7 | low |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| Keep 1 hire per level, global, no per-zone cap; fix stale docs. | PRESERVE | P0 |
| Plot registry (same as §2.2) used by staff, autoplay, reducer, renderer, HUD, tutorial, sim. | REPLACE | P0 |
| Idle/spawn spots from a real object (gate, storehouse instance) via grid query. | REPLACE | P0 |
| Guards: act only within ~0.6 m of the access tile; unreachable → drop + release claim; replan on `nav.version`; release claims on move/demolish; autoplay drops the step on timeout and respects plot claims. | IMPROVE | P0 |
| Pure `farm-brain.js` job board (plots + building input/output slots + storage docks), claim key `<kind>:<uid>[:slot]`, rank by path/grid distance, unit-tested. New steps = new `ROBOT_TASKS`, not new robot types. | IMPROVE | P1 |
| Nav from grid metadata + connected-component labels (O(N) flood fill) for O(1) reachability. Keep café `NAV_CLEAR` lanes identical. | IMPROVE | P1 |
| Rebuild key = core world revision; drop `ownedLots`. | IMPROVE | P2 |
| Throttle persistence or batch staff commits; per-frame A* budget; spatial hash > 8 units. | PROPOSE | P2 |
| Sim models staff labour (jobs/min by level, motor, battery, breaks). | PROPOSE | P2 |
| Founder decides whether staff passive bonuses stay. | PROPOSE | P1 |
| Keep claims, breaks, robot one task, smart rules, mistakes, ★. | PRESERVE | P0 |

### 2.7 Café link

- **Existing:** one game per region, picked once from the country's games (world.js:5-14; game.js:637-645). `bothGames() = false` (derive.js:125). Shared coins/XP/level/beans. Farm sells 2¢, café buys 4¢. Café pauses away unless staffed (game.js:186-199, 684-686). Café uses the silo capacity of its region (sheets.js:101-109). Venues need no beans.
- **Problems:** core does not enforce the mode (sim exploits it). Starters for both games exist in every region. memory `farm-cafe-split.md` (firstGame, Round 2 opens the other game) is stale; `normalizeSave` deletes `firstGame` (state.js:107-115).
- **Changes:** PRESERVE the split and pause. IMPROVE: core mode gates. PROPOSE: café roaster capacity (§2.4) and carrying processed goods one way between regions. Keep café lots S/C2/C3, FIXED counters, CAFE_QUEUE, RESERVED, TUTORIAL_BUILD untouched by the farm grid (P0).
- **Risk:** café tutorial and café-only pacing change if roasting is added. Defer until founder decides.

### 2.8 Progression: world map, Rounds, Lv10, rebirth, gifts, loans

**Existing behaviour**
- 8 countries, 1 region each (world.js:6-17); price `baseCost × tier`, 300–1,500. First region free; first region after the incident free (derive.js:300-305).
- Rounds: only R1 playable; R2/R3 locked mystery cards, no unlock (economy.js:253-257; rounds.js:14-47); `round = 1` forced on load (state.js:59). Production `main` still has paid Rounds (1,800 / 7,000) and layout 3.
- XP: Lv10 at 920; MAX_LEVEL 100 (economy.js:203-216).
- Lv10 incident (game.js:16-26, 552-578): full restart; coins → 60, XP 0, beans 0, staff gone, gifts reset, all regions cleared. Kept: character, story, rebirth, auto runs, tutorial, stats, loan. Fires once per save. `-pre-expiry` backup.
- Gifts: 40 × level; tickets Lv2/8; auto runs Lv4/7; chests Lv5/10/15 (economy.js:221-244).
- Loans: 1,000/2,000/5,000, 10% fee, 20% auto-repay, stack, survive the incident.
- Rebirth: core only. No credits granted (`START.rebirthCredits = 0`), no HUD. Needs Lv ≥ 5.

**Problems**

| Problem | Root cause | Evidence | Sev |
|---|---|---|---|
| **Softlock**: reload during `chooseRegion` → next region costs 300–1,500 with 60 coins | Every-load union of `world.regions` into `ownedRegions` includes the expired record | state.js:88-89; derive.js:300-305; reproduced with createStore | high |
| Layout changes drop data silently or crash | `hasOwn` filters after migration; field whitelist; plots unvalidated | state.js:224-240 | high |
| SCHEMA bump = total progress loss | `normalizeSave` returns null on schema ≠ 3 | state.js:6, 49; store.js:32-42 | high |
| No pre-migration backup; older build drops v5 data | Only `-prev`, `-pre-expiry`, `-backup` | store.js:45-82 | med |
| Migration refunds are silent (doc says a toast exists; it does not) | No event or flag | state.js:81; farm-map.md:85 | med |
| Refunds use live prices | `builtValue` reads current `BUILDINGS` | state.js:143 | med |
| Value already lost: paid Rounds, dropped vn-2/vn-3 regions, no refund | Unversioned normalizations | state.js:59, 73-78 | med |
| Incident repeat undecided | `level10Done` + `story.expiry` never cleared | game.js:21, 571-573 | med |
| Rebirth dormant | Credits and UI removed | economy.js:12; game.js:88-92 | low |
| Migrations not crash-safe | No try/catch | store.js:24, 32 | low |
| `normalizeRegion({})` grants Y0 | `migrateFarmLots` always pushes Y0 | state.js:182 | low |
| Loans work in gate/chooseRegion; atlas has no loan button | Gate regex | game.js:697-699 | low |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| Fix softlock: skip `status: 'expired'` regions in the union, or run it once behind a flag. Test: incident → reload → next region free. | IMPROVE | P0 |
| Keep every progression rule as is (§3). | PRESERVE | P0 |
| Add every new action prefix (`prod/`, `build/demolish`, `farm/placeBed`, …) to `PAUSABLE` and the play gate; every coin action takes a txId. | IMPROVE | P0 |
| Gate all Round-1 Farm World content by level ≤ 9 and coins, never by round. | PROPOSE | P1 |
| Expiry wipes new per-region state automatically; new top-level state needs an explicit keep/wipe rule. Cancel build/plant/expand modes and hide the grid in `runExpiry`. | IMPROVE | P0 |
| Ask founder: incident repeats? one trained worker survives? Farm World buildings survive? | PROPOSE | P1 |
| Ask founder about refunds for paid Rounds and dropped regions. | PROPOSE | P2 |
| Decide rebirth: restore credits+UI or mark dormant. | PROPOSE | P3 |

### 2.9 Save & migration

**Existing:** key `godbean-v3` (+`@test`/`@max` in dev), SCHEMA 3, `-prev` on each write, `-corrupt` + fallback, `-pre-expiry`, `-backup` on reset, txId log (64). Per-region `layout` stamp, `LAYOUT_VERSION = 4` (state.js:139); chain v1→v2→v3→v4 (state.js:144-222). A normalized save is written only on the next dispatch.

**Layout v5 contract (P0)**

| # | Rule |
|---|---|
| 1 | Keep SCHEMA 3. `LAYOUT_VERSION = 5`. One `if (out.layout < 5)` step after v4, so layout-3 (production) and layout-4 (dev) saves both chain. |
| 2 | Freeze `LOT_KINDS_V4` and the v4 helpers inside state.js **before** changing layout.js. |
| 3 | Quantise to the 2 m lattice (Option A). |
| 4 | For every owned farm lot create 6 beds with ids `F#-1..6` at `LEGACY_BEDS` cells. Keep `region.plots` entries whose id is a bed (crop, plantedAt, fast, slow). Drop orphans only. Never drop a planted crop on an owned field. |
| 5 | Every building keeps uid, type, level; re-snap with `canPlace`; else relocate with the v4 `spot()` scan (production before decor); else refund at **frozen legacy `builtValue`**. Starters snap to FIXED. Set `b.paid`. |
| 6 | Map renamed/removed types and parcel ids **before** the `hasOwn` filters. |
| 7 | Drop `region.roads`. Café area (S/C2/C3, z ≥ 82, `shop`, `street`) untouched. |
| 8 | No-op on empty or expired regions. Never throws. Deterministic (no `Date.now`, no `Math.random`, sorted ids; uids like `m5-<regionId>-<n>` or done in `normalizeSave`). |
| 9 | `freshRegion` and `ensureStarters` create F1-1..F1-6 explicitly (freshRegion sets parcels **after** `normalizeRegion`, game.js:56-61). |
| 10 | Record `story.seen['layout5'] = {moved, refunded, coins}` for a one-time HUD notice. |
| 11 | `store.load`: write `<key>-pre-layout5` once before migrating; wrap `normalizeSave` in try/catch; `region.layout > LAYOUT_VERSION` → `setReadOnly(true)`. |
| 12 | Tutorial: set `tutorial.farmDone = true` when all legacy FARM_STEPS are met, before adding steps. |
| 13 | Property test: coins + Σ legacy builtValue + Σ owned lot cost is the same before and after. `normalize(normalize(x)) === normalize(x)`. |

**Risk:** high if violated (save loss). **Priority:** P0.

### 2.10 HUD / UX / onboarding

**Existing behaviour**
- Top-left: level hex + name + XP; coin pill; bean pill (`/cap`, Storage/Full!). Top-right: Rounds, gear, loan, Auto (top-bar.js:24-69; hud/index.js:115-150).
- Toolbar: exactly 4 menus + middle beans button. Farm: Seeds, Build, [Sell], Staff, Progress. Café: Build, Menu, [Buy], Staff, Progress (toolbar.js:15-23, 79-88). Hidden storage/world buttons stay in DOM.
- Taps (index.js:707-761): placement → pick → plot (plant/harvest at once) / building (card) / counters act / field sickle / parcel / gate → else walk. **Owned empty land has no action.**
- Action card (action-bar.js): plot, building (level, effect, Sell, Upgrade only via ▲, Move), parcel ("Field F2", Buy), gate. Refresh 4×/s.
- Build sheet: flat grid, no categories, disabled when unaffordable (sheets.js:12-37).
- Tutorial: FARM plant → harvest → sell → upgrade → buyLand F2; CAFE takeOrder → brew → serve → build. Derived from save; only Skip persists `farmDone` (core/tutorial.js:9-40; game.js:604-611). HUD re-implements targets per step (hud/tutorial.js:114-206).

**Problems**

| Problem | Evidence | Sev |
|---|---|---|
| No contextual action on empty owned land | index.js:741-760; action-bar.js:51-89 | high |
| Two-zone copy everywhere ("Can't build on a field", "buy a workshop lot") | derive.js:149-165; v3-realm.js:12; v3-hud.js:395, 461 | high |
| New FARM_STEPS re-open tutorial for veterans | core/tutorial.js:27, 34-40 | high |
| Building card lacks inspect/produce/demolish/rotate; ▲ only within 9 m | action-bar.js:138-162; index.js:547, 855-866 | med |
| First-of-type fallbacks | action-bar.js:45-48 etc. | med |
| Flat, text-heavy catalog | sheets.js:12-37; effects.js:14-26 | med |
| Web-like prose cards, dev ids | action-bar.js:36-39, 118-175; v3-hud.js:160-175 | med |
| Card + toolbar can cover the target; hard-coded insets | index.js:410; camera.js:144-155; hud/tutorial.js:234, 253; badges.js:118 | med |
| Open sheet rebuilt on every dispatch (buttons replaced under finger) | hud/index.js:237-249; sheet.js:34-39 | med |
| Expansion invisible from afar | index.js:880-885 | med |
| Ghost tiles capped at 16 | placement.js:22, 70-71 | low |
| Dead paths (notOwned, road, switch, hidden hint sprite) | action-bar.js:121, 172; hud/index.js:200-216; placement.js:31-33 | low |
| Sell tip says "Tap the Storehouse" while hand points at toolbar | hud/tutorial.js:134-138; v3-hud.js:50 | low |
| Build red dot = "some type has count 0" | toolbar.js:32 | low |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| Keep one-tap plant/harvest, swipe, sickle, tap-to-walk, 4 menus, top HUD, tip + hand + 3D arrow, placement buttons following the ghost. | PRESERVE | P0 |
| Realm mode `play \| build \| plant \| expand \| move` (`realm.mode`, `onModeChange`, `#hud-root[data-mode]`). Grid only in non-play modes. Entered from Build, Seeds, for-sale sign. Cancel on atlas, expiry, view switch. No new toolbar buttons. | PROPOSE | P0 |
| `tile` target for owned empty land: chips Plant bed / Build / Decorate in modes; outside modes walk + small chip or long-press (founder). Unowned → Expand card. | PROPOSE | P0 |
| Context ring on second tap / long-press / growing plot (inspect, move, remove, change crop). | PROPOSE | P1 |
| Object-anchored compact icon ring replacing the bottom card (reuse hud/placement.js:29-41 anchoring). Keep `data-hud-id` buy/upgrade/sellBeans. | REPLACE | P1 |
| Categorised catalog as tabs inside the Build sheet; compact cards (icon, cost, n/max, one throughput line); unaffordable still previewable; auto-select the tutorial tab. | IMPROVE | P1 |
| Persist tutorial completion, then add one-mechanic steps (place bed → build processor → produce → collect → expand); move targeting into step data. | IMPROVE | P0 |
| `realm.setSafeInsets()` measured by the HUD; used by camera, badges, tutorial. | IMPROVE | P1 |
| Signature-gated sheet rerender. | IMPROVE | P2 |
| Expand mode shows all buyable chunks with price, ignores the 9 m filter. | IMPROVE | P1 |
| Placement bar: cost/refund chip, n/max, demolish confirm, next item without cancel. | IMPROVE | P1 |
| Icon/number chips over prose; remove `Field F2`, `2×2`. | IMPROVE | P2 |
| Remove dead paths; fix docs. | IMPROVE | P3 |

### 2.11 Camera

**Existing:** perspective FOV 38, pitch 52°, YAW −45° (camera.js:16-18). baseDist ≈ 26 m on a 390 × 844 phone; farm zoom .45–1.9 (café 2.5). Hay Day rules: no jump on tap, glide only off-screen (`ensureVisible(.12)`), momentum pan, anchored pinch. `clampTarget` axis-aligned on the target only, 4/4/4/2 m margins (59-64). Visible ground at zoom 1 ≈ 8 m × 23 m; at 1.9 ≈ 16 m × 43 m. Projected farm width ≈ 119 m.

| Problem | Evidence | Sev |
|---|---|---|
| No overview | camera.js:19-21, 56, 93-96; index.js:78, 1008 | high |
| Axis-aligned clamp vs 45° view; invisible walls; frustum ignored | camera.js:59-64, 177, 217, 259, 265 | med |
| UI covers targets; fixed margins | camera.js:137-156; index.js:410, 976, 1178 | med |

| Change | Tag | Prio |
|---|---|---|
| Farm `zoomMax` ≈ 3.5–4 with pitch lift toward ~62° past zoom 2; adjust far plane, fog, shadow box; "whole farm" button = `focusRect` on owned land. | IMPROVE | P1 |
| Clamp in rotated basis `u = (x−z)/√2, v = (x+z)/√2`, inset by visible half-extents at current zoom. | IMPROVE | P1 |
| `focusRect` fits projected depth; `setSafeInsets`; `focusOn` centres in the safe rect. Tap-to-focus = small zoom-keeping glide only when the card would cover the target. | IMPROVE | P1 |
| Keep Hay Day rules, 45° yaw, glide after purchase, cinematic API (`beginCinematic`, `endCinematic`, `restPose`, `cur`). | PRESERVE | P0 |

**Risk:** overview past ~60 m needs LOD and shadow bounds checks.

### 2.12 Rendering & performance

**Existing:** WebGL, MSAA off only when coarse pointer **and** dpr ≥ 2 (app/game.js:421). Quality table low/medium/high (vfx/index.js:4-8); default `high` everywhere (progress.js:91). Shadow map 2048² for every quality (index.js:98). Auto-lower session-only. `?fps` shows fps, draws, quality. Farm and café are two groups of one scene. Instancing already for beds, scatter, border forest, orchards, cobbles. Typed-array A*; pooled VFX.

**Measured / estimated**

| Item | Value |
|---|---|
| Bundle (vite 7.3.7, 108 modules) | three 695.43 kB (180.12 kB gz); entry/i18n 244.71 kB (83.19 gz); realm 207.90 kB (81.17 gz); HUD 66.82 kB (23.10 gz); atlas 21.96 kB; scenes 7.8–16 kB; CSS 37.35 + 43.19 + 5.82 + 1.95 kB. Total JS ≈ 1.28 MB / ≈ 400 kB gz |
| GLBs | 44 files, 20.65 MB; realm upfront 4.25 MB (farm-only subset 1.65 MB); NPC lazy 2.09 MB; unused 4.18 MB; avatar 1.7–1.9 MB, 2048² |
| VRAM if all realm types render | ≈ 130 MB (+ ≈ 90 MB retained bitmaps) |
| Coffee tree | tree 2,128 tris + 2 × 960 fruit; one GLB clone per planted plot, all cast shadows |
| Worst-case farm draws (84 planted, 20 buildings, zoomed out) | ≈ 540 (trees ≈ 60%); default portrait zoom ≈ 150–250. Land alone ≈ 110+ (34 overlays + 32 signs + 32 labels + ~15 instanced) |
| Café street, 40 NPCs | ≈ 120 draws, ≈ 800k skinned verts (main + shadow) |
| Store per dispatch (desktop node) | save 11.3 kB; structuredClone 0.15 ms; stringify 0.06 ms; apply 0.19 ms |
| Nav | rebuild ~0.1 ms; worst A* ~2.2 ms |
| QA desktop | 58–60 fps, 105–134 draws (QA_REPORT.md:22); no real phone measured |

**Problems (top)**

| Problem | Evidence | Sev |
|---|---|---|
| Per-plot tree clones dominate draws/tris | plots.js:39-47, 85-99 | high |
| Removing a farm worker frees shared GLB GPU data → re-upload + recompile hitch | npc.js:23; staff.js:291; dispose-scene.js:22-49 | high |
| Texture memory far above mobile budget | optimize-models.mjs:32-38; index.js:113-118 | high |
| NPCs never frustum-culled, all cast shadows, IK every frame | load-player.js:22-26; npc.js:27-75; street.js:39 | high |
| Weak phones start at `high` | vfx/index.js:4-9; progress.js:91; app/game.js:421 | med |
| 37 per-lot overlays + signs + canvas labels | world.js:355-371 | med |
| Sync on every dispatch, full sheet rebuild | index.js:241-318; hud/index.js:236-249 | med |
| First-use hitches (NPC, build, ghost) | npc.js:22-27; app/game.js:305-308 | med |
| Per-building label, pick box, forever roaster emitter | buildings.js:213-249, 305-325 | med |
| Brute-force placement search (~2,400 `placementError` calls) and per-move raycasts | placement.js:86-115; index.js:421-444 | med |
| Bed capacity fixed at 108 | plots.js:21 | med |
| Gate = 17 draws | world.js:702-716 | low |
| GC churn in camera, pick, badges, selectors | camera.js:209, 214, 264; index.js:426-442 | low |
| 4.2 MB unused GLBs; `/models` un-hashed | vite.config.js:6-11 | low |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| Instance coffee trees (3 InstancedMeshes), fruit no shadow, simplify tree to ~1k tris. | IMPROVE | P0 |
| `keepOnGPU` for every NPC source; staff.remove disposes only per-unit resources. | IMPROVE | P0 |
| Texture pass: 512² buildings/NPC, 1024² avatar, strip normals/tangents; later KTX2. Target ≈ 30–35 MB VRAM, ≈ 1.5 MB realm download. Founder reviews screenshots. | IMPROVE | P0 |
| NPC culling with fixed bounding sphere, no shadow (blob disc), skip IK far, MAX_LIVE per quality. | IMPROVE | P0 |
| Device-aware quality: shadow map size per tier, MSAA off on coarse pointer, `medium` default on phones (founder OK). | IMPROVE | P0 |
| Ground overlay with one cell `DataTexture` (terrain/owned/mode/validity), built-in material, no custom GLSL; grid lines as repeating CanvasTexture; sign pool (~6). | REPLACE | P1 |
| Cached occupancy grid for picking, placement BFS, nav. Keep raycast for sprites, NPCs, tall buildings. | PROPOSE | P1 |
| Coalesce `syncAll` and HUD render to once per frame; signature-gated sheets. | IMPROVE | P1 |
| Load only the region game's assets; prewarm NPC/ghost programs; cache `loadPlayer`. | IMPROVE | P1 |
| Trim per-building overhead (labels near/selected only, shared pick box, emitters while working), merge gate (17 → ~5), then instance idle duplicates. | IMPROVE | P1 |
| Shadow trims; scratch vectors; extended `?fps`; optional persist debounce; Lambert A/B; remove unused GLBs. | IMPROVE / PROPOSE | P2–P3 |
| Keep nav, pooled VFX, merged café, instanced scenery, texel-snapped shadows, compileAsync, view switch, auto-lower. | PRESERVE | P3 |

### 2.13 Tests & QA

**Existing:** `node --test 'tests/**/*.test.mjs'`, 8 files. Counts moved during the audit: 84 (83 pass, i18n missing 26 keys) → 85/85 pass → one run 82 tests, 70 pass, 12 fail (`LOT_KINDS is not defined` at derive.js:228, import removed by parallel edits). The "tending" test was flaky once. Suite ≈ 10 s, ≈ 9.6 s of it the 70-min sim. Harness: `harness`, `act`, `must`, `tick`, `go`, `playing()` (never chooses a game). States built by direct mutation. Junk-payload sweep over `ACTIONS` (edge:34). `scripts/qa-personas.mjs` (untracked, 15 personas) fails at import (`GOODS` missing), outside the test glob. Dev profile `?profile=test` → `godbean-v3@test` (dev builds only); QA params `?coins=&beans=&level=`. `DEV_START_COINS` unused.

**Problems**

| Problem | Evidence | Sev |
|---|---|---|
| Sim never builds farm buildings; plays both games | economy-sim.mjs:41-77 | high |
| Placement tests are literal coordinates + today's codes | core.test.mjs:104-131 | high |
| v4 migration reads live `LOT_KINDS` | state.js:4, 191, 206 | high |
| No golden old-save fixtures | core:514-544, 648-682; edge:185-227 | high |
| No exploit tests (tables tip, demolish XP loop profitable up to ~Lv8 at 50% refund, decor XP) | derive.js:21, 39, 167; game.js:323 | high |
| Literal layout 4 | core:532, 657 | med |
| Harness builds unreachable states (`rich()` round 3) | edge:13-18 | med |
| i18n test merges all packs; `farm-world.js` not loaded at runtime; err codes parsed from doc prose | i18n.test.mjs:15-20, 78-84; i18n/index.js:3-21 | med |
| No HUD/realm import test (removing a core export breaks the build silently) | sheets.js:4, 19; placement.js:7; plots.js:5; index.js:25 | med |
| No touch/camera/contextual/grid tests | camera.js, input.js, placement.js, action-bar.js | med |
| Stale QA docs; missing `test-links.md` and `FARM-WORLD-2.0-QA.md` | docs/QA_REPORT.md; qa-personas.mjs:4 | low |

**Recommended changes**

| Change | Tag | Prio |
|---|---|---|
| Keep the pure-reducer harness, memory storage, junk sweep. | PRESERVE | P0 |
| `scenario({...})` builder through reducer actions + `normalizeSave`; `playing({game})`; shared `spot(type)`. | IMPROVE | P0 |
| `farm-world.test.mjs` for grid metadata, cache invalidation, perf guard. | PROPOSE | P0 |
| Table-driven placement tests from layout data; ghost and `build/place` agree. | REPLACE | P0 |
| Multi-building aggregation tests (storage sum, 2nd roaster no price gain, parallel processors, k-th copy ≤ (k−1)-th, maxCount). | PROPOSE | P0 |
| Exploit tests + seeded random-action fuzzer (5,000 actions × 20 seeds). | PROPOSE | P0 |
| v4→v5 suite with golden fixtures in `tests/fixtures/saves/`. Use `LAYOUT_VERSION`. | PROPOSE | P0 |
| Sim rewrite `runSim({minutes, game, strategy, seed})`, per-mode assertions, ROI, duplicate sweep, zero own-placement errors. | REPLACE | P0 |
| Personas into `npm test` (todo until APIs land); keep suite < ~30 s. | IMPROVE | P1 |
| i18n test reads runtime pack list and exported `ERROR_CODES`. | IMPROVE | P1 |
| Import-integrity test for `src/features/**` → `src/core/**`. | PROPOSE | P1 |
| Pure seams: `clampToBounds`, `focusFor`, `tileColor`, `actionsFor`, gesture classifier. | PROPOSE | P1 |
| QA tooling: `?scenario=`, `?game=`, `?region=`, `?skipTutorial=1`, `?grid=1`, `?tiles=1`; dev panel additions; `docs/test-links.md`. | IMPROVE | P1 |
| Device checklist; cleanup (`toLevel10` dup, unused import, shared PLAYTEST setup). | PROPOSE / IMPROVE | P2 |

---

## 3. Approved rules that must be preserved

| # | Rule | Source |
|---|---|---|
| R1 | Code is the source of truth; all numbers in `src/core/config/*.js`. Change config → run `npm test` + `npm run sim` → update GDD in the same change. | docs/README.md:3, 31-34 |
| R2 | Pure deterministic reducer; time from `ctx.now`, randomness from payloads; txId idempotency; input never mutated. | game.js:1-3; AUTONOMOUS S3 |
| R3 | Buildings only on land the player has bought. | farm-map.md:3-4 (founder 2026-11-06) |
| R4 | Land: coins only, no level gate, any order, every lot for sale from the start; roads never bought, open with adjacent land. | farm-map.md:3-5; derive.js:54-67, 193-207; core.test.mjs:156-173, 627-646 |
| R5 | YAW −45°; after buying land the camera glides to it, zoom kept. | camera.js:18; index.js:308-312 |
| R6 | Hay Day camera: player owns it; taps never jump it; glide only off-screen; zoom kept; deselect never moves; momentum; anchored pinch. | camera.js:1-11; index.js:398-411 |
| R7 | Tap rules: empty plot plants, ready plot harvests, drag across plots, sickle harvests the field, ground tap walks, counters act. | v3-architecture.md:82-85 |
| R8 | Upgrades through the ▲ badge at the object; any interactive object shows its notice at the object. | badges.js:1-9; AUTONOMOUS F10 |
| R9 | Placement buttons ✓ ↻ ✕ follow the ghost. | hud/placement.js:2-3 |
| R10 | Exactly 4 toolbar menus per screen + middle beans button. World map in Progress sheet. | toolbar.js:1-8; AUTONOMOUS F18 |
| R11 | Farm and café are separate games; one game per region, picked on first entry from the country's games; shared coins/XP/level/beans; café pauses away unless staffed. | world.js:5-15; game.js:637-645; memory farm-cafe-split |
| R12 | 1 region per country; first region free; next region after incident free; expired region refused in chooseRegion. | world.js:17; derive.js:300-320; AUTONOMOUS F1-F2 |
| R13 | Rounds: only R1 playable; R2/R3 locked, no unlock, no price; Rounds never gate land, regions, countries; all buildings reach L8 in R1. | economy.js:34-36, 253-257; state.js:59; core.test.mjs:606-612 |
| R14 | Lv10 incident: full restart (coins 60, XP 0, beans 0, staff, gifts, regions wiped), loan kept, once per save, reload-safe, `-pre-expiry` backup, new region = 1 empty field + empty café. | game.js:16-26, 552-578; core.test.mjs:546-604 |
| R15 | Rebirth independent of Rounds, kept through the incident (core only today). | game.js:581-597; core.test.mjs:297-318 |
| R16 | Level gifts 40 × level; tickets Lv2/8; auto Lv4/7; chests Lv5/10/15; re-earned after incident. MAX_LEVEL 100. | economy.js:204-244 |
| R17 | Loans 1,000/2,000/5,000, 10% fee, 20% auto-repay, stack, survive the incident. | economy.js:246-251; level-progression.md:114 |
| R18 | Staff: 1 hire per level, global, no per-zone cap; workers Lv1, robots Lv4; old extra staff kept. | economy.js:82-91; derive.js:219, 277; level-progression.md §6 |
| R19 | Robots: one task or Auto, never learn, 1★, hardware upgrades only, all shown as "Robot". New steps = new tasks, not new types. | staff-upgrades.md §4 |
| R20 | Worker levels, smart rules, mistakes, breaks, ★ quality (player 3★). | staff-upgrades.md §2-3; economy.js:122-201 |
| R21 | Kiosk Lv7, Pastry Lv8; nothing unlocks at Lv10; Round-1 milestones Lv1–9. | level-progression.md:110; farm-map.md:59 |
| R22 | Starters free, fixed, re-added after reset/damage (no softlock). | economy.js:39-40; game.js:59-74; AUTONOMOUS G9 |
| R23 | Seats = terrace + 2 per Tables; order needs a free seat. Café counters are two fixed stations. | AUTONOMOUS F8, G4 |
| R24 | Save: SCHEMA 3, key `godbean-v3`, backups, per-region versioned layout migrations; never silently lose value (relocate, else refund builtValue). Plot ids F1-1..F14-6 and crops survive. | state.js:6, 133-222; store.js; AUTONOMOUS F5; farm-map.md §7 |
| R25 | Tutorial: one action at a time, derived from save, per-track skip, never yanks the camera. | core/tutorial.js:1-6; hud/tutorial.js:1-4, 25-27 |
| R26 | Mobile-first portrait; FarmVille-3 patterns only, never its assets; EN + VI for every key. | memory; i18n.test.mjs:34 |
| R27 | Performance: merged static scenery, instancing, no new GLSL ShaderMaterial. | AUTONOMOUS F7; farm-map.md §9; memory mobile-first |
| R28 | PLAYTEST coins off; test profile isolated keys in dev only. | economy.js:5-8; storage-keys.js:3-9 |
| R29 | Pacing: farm-only Lv10 ≈ 20 min, café-only 22–30 (test window 10–35); first harvest within 30–60 s. | economy.js:279; economy.test.mjs:13-18 |
| R30 | Process: agent never commits or runs a browser; founder tests. Staff system is WIP for founder review. | memory no-commit-no-test, staff-system-wip |

### Conflicts

Default resolution for every row: **preserve the approved rule until the founder decides.**

| Topic | Approved | Requested | Resolution |
|---|---|---|---|
| Exact F1-F14 rects vs 2 m grid | v4 kept fields at exact rects (farm-map §1, Q1) | One unified 2 m grid | Recommend v5 re-quantisation (lots move 0.5 m, ids and crops kept). Option B if rects must stay exact. Founder picks. |
| Lot-kind restrictions | Farm buildings on build lots only; nothing on fields (`onField`/`wrongZone`), pinned core.test:109-121 | Any owned land holds plots, buildings, decor, roads | Keep "owned land only". Replace kinds with terrain masks (water blocks). Explicit conversion when a field occupies a cell. Founder confirms; pasture-for-animals open (farm-map Q5). |
| Player-placed roads | Roads open with land, never bought | Owned land can hold roads | No gating roads. Optional cosmetic path tiles. |
| Singleton limits | MAX_INSTANCES (G5 autonomous); counters/terrace fixed | Data-driven maxCount, duplicates | Uncap production/storage with costGrowth + bottleneck/diminishing returns. Starters/fixed stay 1. Tables keep 4 until café model decided. |
| Passive bonuses vs throughput | Dryer +yield (F18), roaster +price + drink gate (G4), staff passive % kept (G7) | Real throughput; 2nd roaster = capacity | Farm dryer → processor (founder OK). Café roaster/kiosk/pastry/tables and staff bonuses unchanged until founder decides. Keep drink gate. |
| Single resource vs chain | One `beans`, soft cap (G3); no water/fertiliser (G2) | Grow → Process → Roast → Package → Transport → Sell | Allowed by handoff vision; needs approval. Use GOODS/`stored()`; sell stays one tap. |
| Café chain / Transport | One game per region; R2 not designed | Café Roast → Grind → Brew; Transport | Transport = storehouse/market sale in R1. Café chain deferred or limited to the roaster-capacity proposal. |
| Loans vs no infinite money | Stack with no cap | No infinite-money exploits | Add `maxDebt(level)`, play phase only, fix clamp. Founder OK needed. |
| Demolish refund | No V3 rule; archived GDD says no refund + confirm | Demolish with refund | Partial (e.g. 50% of paid, decor 0), confirm modal, XP once. Founder picks ratio. |
| Upgrade entry | Only via ▲ | Building tap: inspect/produce/upgrade/move | ▲ stays; ring adds Produce/Collect/Move/Demolish; Upgrade in ring only if founder relaxes. |
| Plot tap | Instant plant/harvest, no modal | Plant/harvest/inspect menu | Keep instant; ring on second tap / long-press / growing plot. |
| Empty land tap | Tap ground = walk | Plant/build/decorate/expand | Walk outside modes (+ small chip or long-press); place/paint inside modes. |
| Catalog vs toolbar | 4 menus | 5-category catalog | Tabs inside Build sheet; no new button. |
| Camera focus/overview | No jump; zoom kept; tutorial never yanks | Overview, tap-to-focus, no UI cover | Zoom-keeping glide only when covered; explicit overview zoom/button; screen-space clamp. |
| Camera bounds / frontier | Whole map viewable and for sale from Lv1 | Bounds; doc had START_BOUNDS | Keep decision; frontier only for sign pooling. |
| Walking on locked land | "Locked land is scenery, never a wall" (index.js:259) | Per-tile nav connectivity | Player walks anywhere (default); staff/customers on owned + open-road cells. Founder confirms. |
| Land = plot capacity | Field = exactly 6 plots, prices tuned on it | Placeable plots | Count-preserving migration; bed price curve/level cap balanced in sim. |
| Grid size/visibility | 2 m grid while placing; draft says 1 m | Grid in construction/planting/expansion | One logical 2 m cell; overlay in all three modes; planting mode = highlight while Seeds open. |
| Staff slot cap | 1 per level, no per-zone cap | Master prompt "max 3 per farm/café unless superseded" | Later founder decision supersedes; keep; fix stale docs. Workstation capacity only as derived limit. |
| Robot roster | One robot type per game, one task | Chain suggests more robots | New `ROBOT_TASKS`, not new types; founder OK. |
| Lv10 incident vs persistent world | Full wipe at ~20 min, once per save; repeat until R2 unresolved | Big investment layer | Keep semantics; wipe all new per-region state. Founder: content depth before Lv10, repeat or not. |
| Rounds | Locked roadmap only | "Preserve Rounds"; data-driven unlocks | Gate content by level ≤ 9 and coins, never round. |
| Rebirth | Docs: 3 credits; code: none, no UI | Preserve rebirth | Keep core + state; do not restore UI/credits without founder. FW 2.0 GDD §8 claim is wrong. |
| Save compat vs value already lost | F5 "nobody loses value"; but paid Rounds and vn-2/vn-3 dropped without refund | Never lose crops/buildings | Apply strictly to v5; raise old losses as a separate founder decision. |
| Docs/memory vs code | memory farm-cafe-split (firstGame, Round 2 switch); v3-gdd stale | Preserve approved rules | Code + latest founder docs win; refresh memory and docs. |

---

## 4. Touchpoint index (by file)

### src/core/config/layout.js
- 4–9: header/ASCII map, stale "only when it touches an OPEN road" → rewrite for chunks + terrain.
- 27: BOUNDS/PLAYER_SPAWN/GATE → add `FARM_GRID {cell, origin (−32,−76), cols 32, rows 52}`.
- 33–56: ROADS (odd widths, .5 edges) → cell coordinates; keep ids and open rule; widen nRing/wLane3/eLane3.
- 60–100: PARCELS → CHUNKS (same ids/cost/starter/opensRoads), even-metre rects, `kind` = terrain preset.
- 101: PARCEL_ORDER → keep; re-check spine adjacency (D1, P1, W2, O1, P3, O2).
- 104: LOT_KINDS → remove for farm; per-definition rules; keep `shop` for café; frozen copy for v4.
- 108–123: PLOT_SIZE, plotsOf, ALL_PLOTS, plotById → `LEGACY_BEDS` table for migration only; runtime selectors.
- 126–131: FIXED → tile coords; migration seed; keep counter/terrace anchors.
- 211: parcelAt → `grid.cellAt`; keep for café.
- 216–220: RESERVED → rasterise; add silo/gate cells.

### src/core/config/economy.js
- 7, 12: PLAYTEST, START.rebirthCredits → keep; record rebirth decision.
- 18–24: CROPS → `product`, integer `amount`, keep `beans` alias.
- 27–32: DRINKS → `input` field; keep roaster gate.
- 34–36: ROUND_LEVEL_CAP → remove or per-upgrade gates.
- 38–41: schema comment, CELL → document new definition schema.
- 42–76: BUILDINGS → category, maxCount, costGrowth, recipe, storage, workers, terrain mask, refund ratio; dryer 59–62 recipe; roaster 56–58 capacity (founder); pastry 69–71; new warehouse/packer/plot/path; counters maxCount 1.
- 77–80: BUILD_MENU_* → derive from category per game.
- 82–91: hireLimit/STAFF effects → keep limit; diminishing or removed bonuses (founder).
- 145: QUALITY.yield → integer bonuses.
- 148: TEND → include in sim, keep payback-negative.
- 165/168: ROBOT_TASKS → new chain tasks (founder).
- 203–219: XP/LEVEL_XP → XP per collect; build XP once.
- 221–244: gifts/CHEST_PRIZES → beans as good id, storage-aware.
- 249–253: LOAN → `maxDebt`; fix stale comment (incident does not wipe debt).
- 279: BEANS → GOODS table, alias; fix split-sim comment.
- 296–310: VENUES → in sim; optional inputs.

### src/core/config/world.js
- 6–23: countries, regions, tiers → no change (preserve).

### src/core/grid.js (new)
- `FARM_GRID`, `gridOf` (WeakMap memo), `cellAt`, `cellRect`, `canPlace`, `nearestValid`, connectivity, component labels.

### src/core/derive.js
- 15–21: buildingsOf, buildingLevel, effect, effectSum → per-key aggregators; `buildingLevel` only for gates.
- 29: staffBonus → diminishing aggregate.
- 32: capacity → silo + Σ warehouses; add `stored()`.
- 33–44: growMs, yieldOf, priceMultiplier (cap), brewMs, brewSlots, queueCap, arrivalMs → new aggregator.
- 49: drinkUnlocked → "has café roaster ≥ L".
- 52–60: ownsParcel, roadOpen → keep rule on chunks; `cellOwned`.
- 62–77: frontierParcels, farmViewBounds → `buyableChunks`, `frontierChunks`, grid bounds + screen-space extents.
- 78: ownedPlots → beds, memoised.
- 80–95: plotState, graceActive → bed existence; count only existing beds; mode gate, cooldown.
- 98–116: bean quotes → `sellQuote/buyQuote(good)`, room = cap − stored, mode gated.
- 118–127: canPlay, bothGames, cafeStaffed → keep.
- 131–145: footprint, snapPosition → cell snap, integer rot, tile list.
- 147–165: placementError → `canPlace` per tile; codes outside/notOwned/blocked/overlap + terrain/road/noAccess/wrongGame; keep café rect path.
- 167–177: MAX_INSTANCES, buildError → `def.maxCount(level)`, `buildCost`, mode check, count/max data.
- 178–191: upgradeCost/upgradeError → data table; drop roundCap; marginal gain.
- 193–207: parcelError, roadError → chunkError; delete roadError.
- 219, 276–277: hiresLeft, freeSlots → keep.
- 228: currently references `LOT_KINDS` without import (12 tests failing in one run) → fix import.
- 291–294: loanError → `debtCap`, phase play.
- 300–320: regionUnlockCost/regionAccess → keep.
- 322: seatCount → keep, per-instance data later.
- (new) removeError, refundValue, processRate, typeCapacity, plotOf.

### src/core/game.js
- 10–12: tx log, PAUSABLE → add `prod/`, `build/demolish`, `farm/*Bed`, `loan/`.
- 16–26: grantXp incident trigger → unchanged unless founder makes it repeat.
- 29–48: earn, grantItems → goods, storage-aware; decide gift auto-repay.
- 56–74: freshRegion, starterBuildings, ensureStarters → explicit F1-1..F1-6 beds; drop `r.roads`; starters per game (optional).
- 97–122: world/unlockRegion, enterRegion → keep.
- 126–163: farm/plant, farm/harvest → bed existence; `stored ≥ cap`; integer star bonus; mode gate.
- 136–139: crop state record → unchanged.
- 165–183: farm/sellBeans, shop/buyBeans → `farm/sell {good}` + alias; mode gates.
- 237–271: shop/brew/serve → consume `DRINKS[].input`.
- 275–295: venues → keep; sim.
- 313–347: build/place, move, upgrade → canPlace, rot validation, `b.paid`, XP once, costGrowth; move refuses running job; per-instance upgrade.
- 347+: new `build/demolish`, `farm/placeBed`, `farm/moveBed`, `farm/removeBed`, `prod/start`, `prod/collect`.
- 350–362: land/buyParcel → chunk purchase; remove `{road}`.
- 363–371: land/openRoad → delete or repurpose as `build/placeRoad`.
- 374–396: staff/hire, recruit → assign only if `canPlay`.
- 436–455: staff/tend, farm/water → include in sim/budget.
- 453–461: staff/assign → canPlay.
- 515–526: level/claim → storage-aware grant.
- 529–548: loan/take/repay → ceiling, phase play.
- 552–579: expiry/execute → also wipe items/jobs/new region state; empty region must not invent content.
- 581–597: rebirth → keep.
- 604–611: tutorial/set → keep; migration sets farmDone.
- 637–645: play/chooseGame → keep.
- 655–680: dev/* → add dev/scenario, dev/skipTime, dev/trigger.
- 684–711: apply, CAFE_LOOP, notPlaying gate → add new prefixes, mode gate.

### src/core/state.js
- 6, 49: SCHEMA 3 → keep.
- 19, 69–70: inventory → `items`, clamp loop.
- 57, 119: loan clamp → match coins / maxDebt.
- 59: round = 1 → keep; founder refund decision.
- 73–78: dropped regions → founder refund decision.
- 79–89: per-region loop, refund apply, starter backfill, ownedRegions union → fix softlock; record `story.seen['layout5']`.
- 91–100: staff normalize → new unit field defaults.
- 107–117: firstGame removal, rewards → keep.
- 133–139: migration comment, LAYOUT_VERSION → document 3→4, add 5.
- 143: builtValue → frozen legacy price table; use `b.paid`.
- 144–169: migrateLayout → add v5 step.
- 175: fpOf → shared footprint.
- 180–222: migrateFarmLots → frozen LOT_KINDS_V4; no-op on empty input (182).
- 224–240: normalizeRegion → beds, items, jobs, `paid`; validate plots, buildings (uid, level, rot, x/z); map ids before `hasOwn`.

### src/core/store.js
- 24–42: load → try/catch, `-pre-layout5` backup, read-only for newer layout.
- 45–66: persist → optional debounce.
- 58–60: `-pre-expiry` → keep.

### src/core/tutorial.js
- 9–21: FARM_STEPS/CAFE_STEPS → keep targets; add one-mechanic steps after persisting farmDone; F2 stays chunk id.
- 12–13: silo target → uid.
- 20: café build step → check roaster exists.
- 34–40: currentStep → keep.

### src/core/migrate.js
- 1: v1 migration → set `tutorial.farmDone`; bed conversion hooks if done here.

### src/features/realm/world.js
- 1–6: header → rewrite.
- 24: PARCEL_IDS → chunk ids for scenery.
- 125–146, 276–279: ground plane → DataTexture overlay.
- 182: parcelSignPoint → nearest edge cell to owned land.
- 196: isFreeGrass → grid terrain.
- 207–226, 470: dynamicInstances → per chunk; `visible = count > 0`; clear on occupied owned cells.
- 253: MeshStandardMaterial → Lambert A/B.
- 299–348: cobbles, roads, trails → road cells.
- 355–371: per-lot overlay/sign/label → single overlay + sign pool (~6).
- 373–410: fences → owned-perimeter edges; gap at road.
- 507: border stones → from road-cell edges.
- 683–700: orchard trees → pre-placed decor or blocking scenery.
- 702–730: gate → merge by material.
- 740–772: sync → write DataTexture once per change.

### src/features/realm/plots.js
- 5: imports → selectors.
- 19–26: bed InstancedMesh capacity 108 → growable.
- 30–32, 63–71: per-plot pickers → cell lookup.
- 39–47: makeTree clones → instanced parts.
- 49–99: sync → loop beds with Map; only changed instances.
- 128–158: update → instance matrices.

### src/features/realm/index.js
- 25: imports → grid/plot selectors.
- 64, 71–74: PADS → keep (counters maxCount 1).
- 78: café zoomMax → per-area zoomMax.
- 95–110, 98: lights, shadow mapSize → per quality.
- 113–121: load all models → load per game; prewarm.
- 138–148: navs, createStaff wiring → grid-based nav; tile queries.
- 172–175: tintMaterials → include grid materials.
- 216–232: syncArea → memoised selectors.
- 241–276: syncAll → once per frame; nav key = world revision (259–270).
- 282: harvested reward position → `plotOf(prevState)`.
- 300–318: event hooks → add `demolished`.
- 308–312: parcelBought glide → keep; reveal VFX.
- 356–396: buildingOf/resolvePlot/areaOf/frameRect/targetPoint → uid only; tile/bed/bedGroup targets.
- 398–413: setSelection → safe insets.
- 416–447: pick → cell lookup for beds/land; raycast for badges/staff/buildings; scratch arrays.
- 459–471: tapPlot/tapBuilding → keep fast path; context flag.
- 547: BADGE_NEAR → ignore in modes.
- 589–597: canStand → grid flags, no allocation.
- 610–699: autoplay → registry, access tiles, claims, storage instance, drop on timeout.
- 707–767: onTap/ground tap → modes, tile card, expand card.
- 822–829: harvestField → connected bed group.
- 834–902: refreshBadges → bed groups, sign pool, production badges.
- 900–971: drag plant/harvest/ghost → cell lookup along segment; mode painting.
- 984–1008: setView/swapView → grid bounds, screen clamp, overview zoomMax, cancel modes.
- 1068–1145: frame update → grid overlay only on change.
- 1096–1105: tutorial arrow, selected plot timer → plot selector.
- 1164–1213: select, startPlacement API → mode API, entity defs, cost/refund.

### src/features/realm/placement.js
- 7: LOT_KINDS import → remove.
- 20–27: tile InstancedMesh cap 16 → max footprint, per-tile colour.
- 31–33, 80: hidden hint sprite → remove.
- 39–56: ghost material clones → prewarm.
- 58–82: refresh → canPlace per tile.
- 86–115: nearestValid/initialPosition → grid BFS, all rotations; no lot list; new noRoom copy.
- 121–141: lot tint planes → grid mode overlay.
- 147–157: rotate/confirm → keep.

### src/features/realm/camera.js
- 1–11: rules header → keep.
- 16–21: FOV/pitch/YAW/zoom → per-area zoomMax ≥ 3.5, pitch lift.
- 56: baseDist → keep.
- 59–64: clampTarget → rotated basis, frustum inset.
- 118–134: focusRect → depth fit + safe rect.
- 137–156: glideTo/sees/ensureVisible → `setSafeInsets`, `focusOn`.
- 209, 214, 264: allocations → scratch vectors.

### src/features/realm/nav.js
- 16: NAV_CLEAR → grid-derived; keep café lanes.
- 22–31: navObstacles → from occupancy.
- 33, 144: MAX_ITER → per-call cap + frame budget.
- 56–69: rebuild → `rebuildFromGrid`, version counter, component labels, optional cost array.

### src/features/realm/staff.js
- 14–16: stale header → fix.
- 40: imports → registry.
- 51–57: IDLE.farm from F1 → grid query.
- 56: café posts → keep.
- 110: THINK → keep.
- 181: claims → `<kind>:<uid>[:slot]`, release on move/demolish.
- 291: disposeScene on remove → per-unit only.
- 329–357: moveTo/plan → replan on nav.version, unreachable detection.
- 378–399: separate → spatial hash.
- 402–407: near → reachable + path distance.
- 416–466: cropFor, plotSpot, farmJob, taskCounts → access tile, registry, job board.
- 539–550: startJob/dispatch → claim keys; batched commits.
- 563–572: restock → café input good.
- 583–596: secondPlot → neighbour cells.
- 612–629: finish → distance + version check; bed existence.
- 763–782: wander, dead `spot:` claim → grid; remove claim.
- 865, 901–958: update loop → keep pause rule.
- 944: isClaimed → add isPlotClaimed.

### src/features/realm/staff-brain.js
- 1: café-only pure module → add `farm-brain.js` sibling.

### src/features/realm/buildings.js
- 67–70: terrace seats → keep.
- 192–235: create → shared pick box, labels near/selected, instanced idle duplicates.
- 243: rotation → integer rot.
- 245–249: roaster emitter → only while working, shown area.
- 253–269, 295–301: sync → tier swap per level.
- 278–286: remove → demolish VFX.
- 305–325: update → animating set.
- 330: byType → nearest/all, uid callers.

### src/features/realm/markers.js
- 38–51, 58–69, 96–113: arrow, frame, timer → reuse unit geometry; grid cursor.

### src/features/realm/badges.js
- 64: harvest sickle → bed group.
- 118: EDGE_TOP → shared safe insets.
- 144: signature → no toFixed churn.

### src/features/realm/avatar.js
- 16: loadPlayer → cached.
- 37–59, 78–84, 110: clamp/blockers → walkable grid cells.

### src/features/realm/seats.js
- 33–35: seatSpots → per-instance; stable order on demolish.

### src/features/realm/cafe.js / street.js
- cafe.js:140–169, street.js:39, 115–123: NPC tint/shadow, MAX_LIVE → no NPC shadows, cap per quality.
- cafe.js:182, 194; street.js:161, 234, 468–504: navigate, venue dispatch → keep; sim venues.

### src/features/realm/cinematics.js
- 7, 53, 82–105: cinematic API, dead round/country branches → keep API; remove dead code.

### src/characters/*
- npc.js:22–27, 42–75: lazy load, keepOnGPU, IK → keep all sources on GPU, prewarm, skip IK far.
- load-player.js:7–8, 22–26: no cache, frustumCulled false → cache; culling for NPC clones.
- player.js:3–12: placeholder geometry per person → shared.

### src/features/hud/*
- index.js:25: PURCHASE/AUTO_OK → add build/place, demolish, prod/*, placeBed, farm/sell.
- index.js:30–103, 64–77, 87: composition, onTool → `ctx.setMode`, `data-mode`, storage by uid.
- index.js:112: dev panel gate → keep.
- index.js:152–198: game pick, gifts → keep.
- index.js:200–216: switch button → remove while bothGames false.
- index.js:236–249: renderAll → once per frame.
- action-bar.js:36–39, 45–48: layout, building() → uid only.
- action-bar.js:51–105: model per kind → tile, bed, building ring, expand.
- action-bar.js:118–136, 121: plotCard, dead notOwned.
- action-bar.js:138–162, 151–159: buildingCard → Produce/Collect/Demolish/Rotate; ▲ rule.
- action-bar.js:164–175, 171–172: parcelCard, dead road branch → expand card.
- action-bar.js:212–219: refresh → keep signature.
- sheets.js:4, 12–37: MAX_INSTANCES import, buildSheet → category tabs, maxCount, buildCost.
- sheets.js:40–59: seedsSheet → plant-mode entry.
- sheets.js:86–109: beans sheet, storageRow → goods list, total capacity.
- sheets.js:115–163, 135–140: staff sheet, 1 s rerender → live fields only.
- sheets.js:294–301: levelUnlocks → data catalog.
- sheets.js:303–345: loan sheet → remaining credit.
- sheet.js:34–39: rerender → signature gate.
- placement.js:2–3, 15, 28–58: bar → cost/refund, n/max, mode label, demolish confirm, next item.
- toolbar.js:10, 15–23, 29–46, 32, 36: imports, TOOLS, dots → "new unlock unseen" dot; storage instances.
- top-bar.js:57, 66–69: beans pill → stored/cap.
- effects.js:5, 14–26: effect text → rates, all keys, marginal gain.
- tutorial.js:47–61, 109–112, 114–206, 215–219, 229–260: targeting, insets → uid targets, step-data resolvers, safe insets, new steps.
- feedback.js:104–131: event toasts → demolished, migration notice.
- modal.js:34: confirm → demolish refund.
- rounds.js:14–47: roadmap → keep.
- dev-panel.js:7–17: buttons → grid toggle, tile inspector, Lv10 trigger, fast-forward, buy all, fill storage, reset.

### src/features/atlas/index.js
- 134–247: statuses, confirm, enter → keep; softlock fix is in state.js.

### src/app/game.js
- 41, 49: dev store, analytics → keep.
- 68–84: ?fps, frame monitor → extend metrics.
- 121–135: router → keep.
- 184, 216: loadPlayer → cache.
- 248, 294–301, 319–332: atlas, hooks, runExpiry → `onModeChange`, cancel modes, hide grid.
- 305–308: compileAsync → prewarm NPC/ghost.
- 350–381, 421–443, 482–486: loop, renderer, context loss → MSAA by quality, device tier default.
- 507–519: QA params → scenario/game/region/skipTutorial/grid/tiles.

### src/shared/*
- vfx/index.js:4–9, 21–32, 164–186, 197–200: quality table, outline, emitters → shadowMapSize, msaa, npc caps; pause hidden emitters.
- three/models.js:7–32: loader cache → KTX2 if adopted.
- three/dispose-scene.js:22–49 → used carefully with shared GLBs.

### src/state/*
- progress.js:91: default quality → device-aware.
- storage-keys.js:5–19: profileSuffix, DEV_START_COINS → test; wire or delete.

### src/i18n/*
- index.js:3–21: runtime pack list → move to `packs.js`, register `farm-world.js`.
- locales/v3-hud.js:50, 109–126, 142, 153–175, 188–198, 257–278, 380–397, 461 (also 881, 947): parcel/plot copy, tut.*, err.onField/wrongZone → chunk, terrain, mode, category, demolish keys; retire two-zone copy; EN + VI.
- locales/v3-realm.js:10–12: place hints, noRoomFarm → reword.
- locales/v3-story.js:38–41: expiry lines → decide "no coins" vs 60 coins.

### scripts/
- economy-sim.mjs:13, 41–58, 50, 53–77, 70, 82–84, 90: setup, tryBuild, candidate spots, combined play, ownedPlots, land/openRoad, staff, metrics → per-mode runs, `spot()`, sell, prod, ROI, staff labour, exploit probes, per-stage metrics.
- qa-personas.mjs:1–4, 9, 35–46, 108, 254: personas → into npm test (todo), fix literal 4, dead t0, richPlayer check.
- optimize-models.mjs:32–38 → texture pass, simplify.

### tests/
- helpers.mjs:6, 11–42 → scenario builder, playing({game}), shared PLAYTEST setup.
- core.test.mjs:14–27 (starter list), 59–61 (F2-1 notOwned → unknown), 104–133 (placement codes, limit, upgrades), 135–148 (layout sanity), 156–173 (land), 176–205 (staff), 237–269 (loans + debtCap), 271 (toLevel10 dup), 278–295 (reload; add softlock case), 376–413 (tutorial), 449–476 (beans trade + mode gates), 514–544 (migration, literal 4 at 532), 546–604 (incident; 581–582 field check), 627–646 (open map → buyableChunks), 648–682 (v4 tests, literal 4 at 657, Y0 at 682), 702 (funny farmhand), 829 (tending, flaky).
- edge.test.mjs:13–25 (rich, toLevel10), 27–65 (JUNK, prototype ids), 76–103 (rotation, fixed), 105–121 (silo, decor), 124, 136, 286 (staff bonus/slots), 150 (dev forbidden), 185–227 (schema, repair, F1/Y0 at 210), 229, 255–263 (tutorial roaster spot).
- economy.test.mjs:6, 8–9, 13–56 → per-mode targets, invariants.
- i18n.test.mjs:15–20, 34–35, 65, 78–89 → runtime packs, ERROR_CODES.
- nav.test.mjs:1, 42 → add farm/grid tests; re-point TUTORIAL_BUILD.
- staff-ai.test.mjs:1 → add farm job-board tests.
- new: farm-world.test.mjs, personas.test.mjs, imports.test.mjs, fixtures/saves/*.json.

### docs/
- README.md:5–33 → index all design docs and this folder.
- design/v3-gdd.md:13, 19, 30, 44–59, 64, 76–79 → update to code + FW 2.0.
- design/v3-architecture.md:25–42, 70–95 → actions, errors, targets, tap rules, grid modes.
- design/farm-map.md:3–9, 32–58, 85, §8, §11 → mark superseded parts; no toast claim.
- AUTONOMOUS_DECISIONS.md:24–40, 82 → new decision batch; mark G5–G11, T2/T3, S2/S4 superseded; add rebirth/per-region/Rounds decisions.
- screens/02-teacher.md:3, 03-atlas.md:3–11, 04-realm.md:5–21, 05-hud.md:6–10 → update.
- QA_REPORT.md → rewrite; create test-links.md, FARM-WORLD-2.0-QA.md, FARM-ECONOMY-BALANCE.md.
- farm-world-2.0/FARM-WORLD-2.0-ARCHITECTURE.md:3–4, §8 and FARM-WORLD-2.0-GDD.md:45, 61, 97–112 → fix dangling links, rebirth claim, café roast question; add VI founder summary.
- Memory: farm-cafe-split.md stale (firstGame, Round 2 switch).

---

## 5. Prioritised implementation order

Each step lands with its tests and doc updates. Founder decisions in **bold** block the steps that follow them.

**Phase 0 — Safety net (no gameplay change)**
1. Fix the `LOT_KINDS` import at derive.js:228 if still broken. Fix the post-incident reload softlock (state.js:88-89) + test.
2. Freeze `LOT_KINDS_V4` and legacy prices in state.js. Replace literal `4` with `LAYOUT_VERSION` in tests.
3. store.js: try/catch, `-pre-layout5` backup, read-only guard for newer layouts.
4. Loan ceiling, play-phase gate, owed clamp (**founder OK on ceiling**). Core mode gates for farm/* and shop/* trade.
5. Tests harness: `scenario()`, `playing({game})`, golden save fixtures, import-integrity test, i18n runtime packs + `ERROR_CODES`.
6. Rewrite the sim per mode (`play/chooseGame`, sell, `spot()`), re-baseline pacing (farm 15.3 / café 20.0 measured ad hoc) before any rebalance.

**Phase 1 — Founder decisions** (send in Vietnamese with defaults)
- **Grid quantisation Option A vs B.** **Retire lot-kind restrictions.** **Locked land walkable.** **Dryer → processor; farm chain goods and prices.** **Café roaster as capacity or deferred.** **Demolish refund ratio.** **Staff passive bonuses.** **Upgrade in context ring.** **Empty-land tap behaviour.** **Incident repeat / survivor / content before Lv10.** **Rebirth status.** **Phone default quality and texture pass.**

**Phase 2 — Core model (P0)**
7. `src/core/grid.js` + `gridOf` memo + `canPlace` + `nearestValid`; café keeps rect path.
8. Chunks + terrain presets in layout.js; `buyableChunks`; delete dead road code.
9. `region.beds` + plot selectors; migrate every `plotById/plotsOf/ALL_PLOTS` caller in one change (reducer, staff, autoplay, plots.js, HUD, tutorial, sim). Fix `staff.js:51` at the same time.
10. Layout v5 migration (§2.9 contract) + `freshRegion`/`ensureStarters` beds + tutorial `farmDone` persistence + property tests.
11. Data-driven BUILDINGS + aggregator (identical numbers for one instance) + maxCount/costGrowth + uid-only resolution. Then uncap.
12. GOODS, `stored()`, warehouses, `prod/start`/`prod/collect`, PAUSABLE/gates, expiry wipes. Calibrate with the sim; add exploit tests and the fuzzer.

**Phase 3 — Interaction (P1)**
13. Realm modes + grid overlay (DataTexture, validity texture) + per-tile ghost + placement bar cost/reason.
14. Bed placement/move/remove, demolish with confirm and XP-once, bed price curve.
15. Contextual ring / tile and expand cards; categorised catalog tabs; one-mechanic onboarding steps.
16. Camera: safe insets, rotated clamp, overview zoom + pitch lift, focus-on-cover.
17. Nav from grid + component labels; staff guards (distance, replan, claims); farm job board with processing jobs; storage targets.

**Phase 4 — Performance & polish (P1–P2)**
18. Instanced coffee trees and growable beds; cell picking; NPC GPU disposal fix; NPC culling/no shadow.
19. Device-aware quality; texture pass (founder review); asset loading per game + prewarm.
20. Coalesced sync/render, signature-gated sheets, per-building overhead trims, gate merge, sign pool.
21. Lightweight VFX (grid reveal on purchase, demolish dust, production puffs) in `src/shared/vfx`, no new GLSL.

**Phase 5 — Optional (P2–P3)**
22. Path tiles; transport/market stage; venue budget; grace hardening; persist debounce; Lambert A/B.
23. Docs cleanup (v3-gdd, architecture, screens, AUTONOMOUS, README, memory), unused GLBs, dead code (switch, roundCap, cinematics branches), QA report + device checklist + test links.
