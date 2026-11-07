# Save Migration Plan (Farm World 2.0)

Status: implemented 2026-11-07 (uncommitted). Code: `src/core/state.js` (`LAYOUT_VERSION = 5`, `migrateLayout`,
`normalizeRegion`, `normalizeFields`, `normalizeBuilding`, `normalizeSave`). Tests: `tests/core/farm-world.test.mjs`
(`layout v5 migration`, `save:`), `tests/core/core.test.mjs` (layout 1→3, v4), persona `oldSave`.

## 1. What is versioned
- `SCHEMA` stays **3** (bumping it would make every existing save look corrupt — `normalizeSave` returns null on a
  different schema and the store falls back to `-prev` / a fresh save).
- Per region `layout`: 1 → 2 (café split) → 3 (fields only) → 4 (farm lots) → **5 (Farm World 2.0)**. Steps run in order,
  so a production save (layout 3) and a dev playtest save (layout 4) go through the same chain.

## 2. Step 4 → 5 (additive, nothing moves, nothing refunded)
| Data | Before (v4) | After (v5) |
|---|---|---|
| Crop beds | implied: 6 per owned `farm` lot (static `plotsOf`) | `region.fields = [{ id, x, z }]` — the same 6 positions per owned field lot, **same ids** (`F1-1` … `F18-6`) |
| Crops | `region.plots[id]` | unchanged (keys are field ids); entries without a field are dropped (cannot exist in a valid save) |
| Buildings | as saved | kept; level clamped to its upgrade list, rotation sanitised to 0–3, invalid `job` dropped |
| Dryer | +% beans per harvest | same building, same spot and level; now a processor (old saves had no job, so nothing to convert) |
| Goods | `inventory.beans` | unchanged + `inventory.items = { dried: 0, roasted: 0, bag: 0 }` |
| XP guard | — | `region.peak` = current copies per type (build XP once per copy slot) |

Because the ids are unchanged, growing crops (with their `fast` tutorial flag, `slow` staff mistake flag and `watered`
tending flag), staff claims (`plot:<id>`), tutorial targets and the tending feature keep working with no remap.

## 3. Invariants (tested)
- Idempotent: `normalizeRegion(normalizeRegion(x))` keeps the same fields, plots and layout.
- Empty input (`normalizeRegion({})`, used by fresh regions and the expired-region record) produces no fields and no
  stray `Y0` lot (fixed in this update).
- Junk-safe: non-array fields, duplicate ids, non-string ids, NaN positions, unknown recipes, `toString` keys.
- The Level-10 incident wipes goods and batches with the region (full restart rule) and snapshots `items`.
- Fixed in passing: an expired region is no longer counted as owned again on reload (it made the "free region after
  the incident" cost coins after a reload — a softlock with 60 coins).

## 4. Backups and rollback
- The store already keeps `<key>-prev` (last write) and `<key>-pre-expiry`. A v5 save written by this build:
  - **Rolling back to the previous build** (v4 code) still loads: v4 ignores `fields`, `items`, `peak`, `job`, `spent`
    (its `normalizeRegion` drops them on the next write) and draws the 6 classic plots of every owned field lot again.
    Lost on rollback only: fields moved or added in v5 (a crop on a new `fd…` id becomes invisible; classic ids show on
    their classic spots), processed goods and running batches. A building placed on a field lot in v5 stays where it is
    and overlaps the classic beds v4 draws (no crash, no refund).
  - Upgrading again after a rollback re-runs 4 → 5 from the owned lots: the classic 6 fields per field lot come back.
  - Recommended before shipping: copy the raw save to `<key>-pre-layout5` once, on the first load that migrates any
    region (one line in `store.load`; not done yet because the store is shared with the uncommitted staff work).
- No coins are refunded by v5, so prices changed in this update cannot create or destroy value through migration.

## 5. Manual check list (old save)
1. Load a mid-game save with crops on F1–F14, a dryer Lv3, decor in D1, staff assigned → all crops still growing on
   the same beds, dryer in place and idle, decor untouched, staff keep working.
2. Plant/harvest a classic field; move it; clear it; place a new field → no errors.
3. Reload → nothing changes (idempotent).
