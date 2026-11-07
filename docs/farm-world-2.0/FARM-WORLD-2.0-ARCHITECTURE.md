# Farm World 2.0 — Architecture

Status: Phase 1 design, written 2026-11-07 before implementation. Updated as code lands (see FARM-WORLD-2.0-PROGRESS.md).
Related: [GDD](FARM-WORLD-2.0-GDD.md) · [Buildings](BUILDING-SYSTEM-2.0.md) · [Economy](FARM-ECONOMY-BALANCE.md) · [UX/UI](FARM-UX-UI-REDESIGN.md) · [Save migration](SAVE-MIGRATION-PLAN.md) · [Audit](FARM-WORLD-2.0-AUDIT.md).

## 1. Principles
- **Extend, don't rewrite.** The pure reducer (`src/core/game.js`), selectors (`derive.js`), data (`config/*.js`) and the realm/HUD split stay. Every rule lives in core and is unit-tested; scenes only draw what core says.
- **Land stays lots.** Lots (`PARCELS`) remain the unit you buy (prices, `opensRoads`, frontier and the north-spine map are approved and unchanged). What changes is what you may put on owned land.
- **One placement system for everything.** Fields (crop beds), buildings and decor are all *placeables*: same footprint math, same validity check, same ghost preview, same move/remove flow.
- **Tiles are derived, never stored.** The save keeps objects (fields, buildings) with positions. Tile metadata is computed from layout + save on demand and cached per region object.
- **Save-safe.** Layout version 4 → 5 migration is additive. Old plot ids (`F1-1` … `F18-6`) keep working as field ids, so growing crops, staff jobs and tutorial targets survive.

## 2. Unified land model

### 2.1 Terrain and allowed uses
Each lot kind maps to a terrain; each terrain lists what may stand on it. Roads, the gate plaza and reserved lanes are never buildable.

| Lot kind (data id) | Terrain | Fields | Buildings | Decor | Why |
|---|---|---|---|---|---|
| `farm` (F1–F18) | meadow (pre-tilled) | ✓ | ✓ | ✓ | unified farmland; comes with 6 tilled fields |
| `build` (Y0, W1–W5) | meadow | ✓ | ✓ | ✓ | unified farmland |
| `decor` (D1, G1) | garden | ✓ | ✓ | ✓ | small lots, same rules |
| `decor` H1 (override) | hill | — | — | ✓ | windmill hill, slope |
| `pasture` (P1–P4) | pasture | — | ✓ | ✓ | kept for animals (produce-system.md) |
| `orchard` (O1, O2) | orchard | ✓ | — | ✓ | orchard soil keeps its trees |
| `pond` (PD1) | pond | — | — | ✓ | water |
| `shop` (S, C2, C3) | café floor | — | café only | ✓ | café rules unchanged |

Data: `layout.js` `LOT_TERRAIN`, `TERRAIN_OVERRIDE`, `TERRAIN_USES`. A placeable's `use` is `'field' | 'building' | 'decor'`; its `zone` (`farm` / `shop` / `any`) still decides the area.

### 2.2 Tiles (derived metadata)
`derive.farmTiles(s)` rasterises the farm area into **1 m tiles** aligned to integer coordinates (the placement snap grid). A tile belongs to a lot only when the whole square lies inside the lot rect (same rule as footprints today). Built once per region object (WeakMap cache) — the reducer clones the region on every action, so the cache invalidates itself.

`derive.tileAt(s, x, z)` → `{ id: 'gx,gz', gx, gz, x, z, elevation, terrain, lot, owned, unlock, occupant, uses, restriction, walkable }`
- `terrain`: `road | plaza | meadow | garden | pasture | orchard | pond | hill | wild` (wild = outside every lot/road).
- `unlock`: `owned | forSale | none`.
- `occupant`: `{ kind: 'field' | 'building', id, type } | null`.
- `uses`: allowed uses (empty when not owned / road).
- `restriction`: why nothing can go here (`road`, `notOwned`, `outside`, `blocked`, …) or null.
- `walkable`: roads, plaza, fields (low beds) and free tiles; building footprints are not.
- `elevation`: 0 except the hill lot (cosmetic, 0.6).

Cost: the farm area is 64 × 104 m = 6 656 tiles, rasterised from rects (sum of rect areas, no per-tile search). Only taps, placement checks and tests call it; no per-frame use.

### 2.3 Fields (crop beds) are placeables
- Save: `region.fields = [{ id, x, z }]`. Crop state stays in `region.plots[id]` (unchanged shape).
- Ids: migrated / pre-tilled fields keep the old plot ids (`F3-4`); new fields get `fd<uid>`.
- Footprint 3 × 3 m (`FIELD.size = [1.5, 1.5]` cells of 2 m). The bed mesh stays 2.4 m. Old plots on a 10 × 6 m lot (3.33 × 3 m spacing) fit without overlap, so migrated fields keep their exact old positions.
- **Pre-tilled land:** buying a `farm`-kind lot places its 6 fields automatically (exactly today's behaviour and economy). Each owned farm lot adds 6 to the **field allowance**.
- Placing a field: free while `fields < allowance`; beyond it each extra field costs `FIELD.extraCost(k)` (k = extras already placed) up to `FIELD.extraCap(level)` extras. Removing a field needs it empty (no crop); refund = 50 % of what that extra cost (0 inside the allowance — you can re-place it for free).
- Move: a field can move with its crop (the crop is keyed by field id).
- `derive.ownedPlots(s)` now returns the region's fields (`{ id, x, z, parcel }`, parcel = lot that contains it) so staff, autoplay, the sim and the tutorial keep their API. `derive.plotOf(s, id)` replaces the static `layout.plotById` everywhere a region is known.

### 2.4 Placement validity (`derive.placementError`)
Order of checks (first failure wins; every code has an `err.*` string):
1. `unknown` — bad type / no region.
2. `onRoad` — footprint touches a road or the gate plaza.
3. `outside` / `edge` — not fully inside one lot (`edge` when it straddles two lots).
4. `notOwned` — lot not bought.
5. `wrongZone` — café thing on the farm or the reverse.
6. `terrain_<t>` — terrain does not allow this use (`terrain_pond`, `terrain_pasture`, `terrain_orchard`, `terrain_hill`).
7. `blocked` — reserved lane (café counter lane, queue lane, gate plaza).
8. `onField` — overlaps a field (explicit conversion: move or clear the field first).
9. `overlap` — overlaps a building.
10. `noAccess` — would leave a field or production building with no walkable neighbour connected to a road (BFS over the 1 m tile grid; farm only).

`build/place`, `build/move` and the ghost preview all use it, so the preview and the reducer always agree.

## 3. Building system 2.0
Full table and rules: [BUILDING-SYSTEM-2.0.md](BUILDING-SYSTEM-2.0.md).
- `BUILDINGS[type]` gains: `category` (`farming | processing | storage | infrastructure | decoration | cafe`), `use`, `limit` (level → max count table), `costGrowth` (price × growth^(owned count)), `recipe` (processing buildings), `refund` (demolish ratio).
- `derive.maxCount(s, type)` reads `limit`; `derive.buildCost(s, type)` applies `costGrowth`. No universal limit (`MAX_INSTANCES` removed).
- Effects aggregate per instance: storage **sums** (silo + every warehouse), wells **cover** (a field gets the best well in range; two wells over one field do not stack), processors run **in parallel** (one batch each). Café effects keep "best instance" because café counts stay 1 (decision in GDD §8).
- Demolish: `build/remove { uid }` — not for starters/fixed, not while a batch runs or waits; refund = `floor(refund × value)` where value = price paid (`b.paid`, else `def.cost`) + upgrades bought.

## 4. Production economy
Full formulas and sim: [FARM-ECONOMY-BALANCE.md](FARM-ECONOMY-BALANCE.md).
- Items: `beans` (harvest, unchanged key `inventory.beans`), `dried`, `roasted`, `bag` in `inventory.items`. Storage = `beans + Σ items` against `capacity(s)`.
- Chain: **Field → Harvest (beans) → Drying yard (dried) → Roastery (roasted) → Packing shed (bag) → Storehouse sells**. Each step is a building with a recipe: inputs, outputs, seconds, fuel fee, XP.
- One batch per building at a time: `b.job = { recipe, at, ms, n }` (n = batch multiplier from the building level). `prod/start` consumes inputs + fee; `prod/collect` adds outputs when storage has room.
- Duplicates add parallel batches (real throughput); revenue only rises if beans and storage keep up. Every duplicate costs `costGrowth` × more.
- Café is preserved: it still brews from `beans`. The farm's processed goods are sold at the storehouse (`farm/sell { item, amount }`; `farm/sellBeans` stays as an alias).

## 5. Save & migration
Details: [SAVE-MIGRATION-PLAN.md](SAVE-MIGRATION-PLAN.md). `LAYOUT_VERSION` 4 → 5 per region:
- `fields` = the 6 plot positions of every owned `farm` lot, ids unchanged; `plots` entries without a field are dropped (cannot happen for valid saves).
- `inventory.items` defaults to `{ dried: 0, roasted: 0, bag: 0 }`.
- Dryers lose the passive yield bonus and become processors (no refund needed: the building stays and gains a job).
- Idempotent (`layout >= 5` skips), never removes a building, never refunds less than before.
- Rollback: the v4 build ignores `fields`/`items` and rebuilds plots from parcels, so a rollback keeps crops on the 6 classic positions; new fields and processed items are invisible to v4 (documented loss on rollback only).

## 6. Realm (3D) contracts
- `plots.js`: beds/pickers come from `derive.ownedPlots(state)` (fields), not from parcels. Instanced beds (one draw call) unchanged.
- `world.js`: owned lots draw as natural ground of their terrain; no fences around farm lots, no permanent grid. Fences/edging only where a lot meets wild land.
- `placement.js`: supports `type: 'field'` (soil-bed ghost), tints owned lots by allowed use (green allowed / faint red not allowed), draws a 1 m grid over owned land only while placing, shows cost + reason.
- `buildings.js`: production state (working animation while a batch runs, ready bubble), field type skipped.
- `index.js`: taps → `field` (plant / harvest as today, select shows Move / Clear), `building` (inspect / produce / collect / upgrade / move / remove), `land` (empty owned tile: Field / Build / Decor), `parcel` (buy). Expansion mode tints for-sale lots.
- Staff / autoplay use `derive.ownedPlots` + `derive.plotOf` (dynamic fields).

## 7. HUD contracts
- Construction catalog: tabs Farming · Processing · Storage · Infrastructure · Decor (+ Land); compact cards (icon, name, cost, level lock, one-line benefit, `count/max`).
- Contextual action bar per selection kind (field / building / land / parcel).
- Storage sheet: every item, amount, unit price, Sell / Sell all, capacity bar.
- All strings in `src/i18n/locales/farm-world.js` (en + vi).

## 8. Performance rules
- No per-tile or per-building work per frame: tiles are cached per region object; placement BFS runs only when the ghost moves to a new snapped cell.
- Fields stay instanced (one draw call for all beds); new procedural buildings merge their parts into one geometry with the shared vertex-colour material.
- Production progress is computed from `job.at/ms` (no timers, no per-frame derive calls).

## 9. Tests
New: `tests/core/farm-world.test.mjs` (tiles, terrain uses, placement codes, fields allowance/cost/remove/move, multi-building limits and growing cost, storage sum, well coverage, production start/collect/storage, demolish refund, migration v4 → v5 idempotent with crops kept), economy sim assertions (farm-only pacing, no money loop), persona journeys in `scripts/qa-personas.mjs`.
