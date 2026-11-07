# Building System 2.0

Status: implemented 2026-11-07 (uncommitted). Data: `src/core/config/economy.js` (`BUILDINGS`, `FIELD`, `RECIPES`),
rules: `src/core/derive.js` (§ placeables, counts/limits/prices, production), actions: `src/core/game.js`
(`build/place`, `build/move`, `build/remove`, `build/upgrade`, `prod/start`, `prod/collect`). Tests:
`tests/core/farm-world.test.mjs`.

## 1. Data-driven definition
Every type in `BUILDINGS` (and `FIELD` for crop fields) declares:

| Key | Meaning |
|---|---|
| `id`, `icon`, `model` | identity and 3D model (`null` = procedural model in `realm/buildings.js`) |
| `category` | catalogue tab: `farming`, `processing`, `storage`, `infrastructure`, `decoration`, `cafe` |
| `zone` | area: `farm`, `shop` (café) or `any` (decor) |
| `use` | what the land must allow (`field`, `building`, `decor`, see `TERRAIN_USES`) |
| `size` | footprint in 2 m cells (field: 1.5 × 1.5 = 3 m) |
| `cost`, `costGrowth` | price of the first copy; the k-th copy costs `cost × costGrowth^(k−1)`, rounded to 5 |
| `level`, `round` | unlock (every Farm World unlock is ≤ Lv9, before the Level-10 incident; Round 1 only) |
| `limit` | max count: a number or `[[playerLevel, count], …]` (highest row reached applies) |
| `upgrade` | upgrade prices (level i → i+1) |
| `effect` | per-level stats (storage `capacity`, processing `speed` + `batch`, well `grow` + `radius`, café stats) |
| `recipe` | processing recipe id (`RECIPES`) |
| `refund` | share of coins spent returned by `build/remove` (0 = not removable) |
| `starter`, `fixed`, `walkable` | granted free / cannot move or be removed / does not block walking |

There is **no universal building limit** any more (the old `MAX_INSTANCES` default of 1 is gone).

## 2. Catalogue (farm)

| Type | Category | Size | Unlock | Price (1st → 2nd → 3rd) | Max by level | What it does |
|---|---|---|---|---|---|---|
| Field | Farming | 3 × 3 m | Lv1 | free inside allowance; extras 60 → 80 → 100 … (×1.3) | allowance + 2/level (max +40) | grows coffee |
| Drying yard | Processing | 3 × 3 m | Lv2 | 120 → 190 → 305 | 1 (Lv2), 2 (Lv4), 3 (Lv7), 4 (Lv12), 5 (Lv18) | 12 beans → 12 dried beans · 30 s |
| Barn | Storage | 3 × 3 m | Lv3 | 150 → 225 → 340 | 1 (Lv3), 2 (Lv5), 3 (Lv7), 4 (Lv9), 6 (Lv13) | +30 → +270 storage (adds to the storehouse) |
| Well | Infrastructure | 2 × 2 m | Lv3 | 200 → 300 → 450 | 1 (Lv3), 2 (Lv5), 3 (Lv7), 4 (Lv9) | fields within 6–10 m grow 15–30 % faster (best well counts) |
| Roastery | Processing | 3 × 3 m | Lv4 | 300 → 480 → 770 | 1 (Lv4), 2 (Lv6), 3 (Lv9), 4 (Lv14) | 12 dried → 9 roasted · 45 s · fuel 3 |
| Packing shed | Processing | 3 × 3 m | Lv6 | 700 → 1 190 | 1 (Lv6), 2 (Lv9), 3 (Lv16) | 9 roasted → 3 bags · 40 s · fuel 2 |
| Storehouse | Storage | 4 × 4 m | starter | free | 1 (fixed) | 40 → 520 storage, sells goods |
| Flowers / lantern / potted plant | Decoration | 2 × 2 m | Lv2–3 | 25 / 40 / 30 (flat) | 12 each | +3–4 XP, looks |

Café catalogue (unchanged rules): Roaster, Kiosk, Pastry case — 1 each; Tables — 4; counters and terrace — fixed starters.
Why café stays single: its buildings are passive multipliers tied to fixed counters, pads and staff posts; a second
roaster only makes sense with a café production model (GDD §8, decision 2).

## 3. Upgrades: one stat per level
Processing buildings alternate: even levels raise **speed** (×1 → ×1.25 → ×1.5 → ×1.75 → ×2), odd levels raise
**batch** (×1 → ×2 → ×3 → ×4: inputs, outputs and fuel scale together). The well alternates **reach** and **growth**.
Storage buildings raise capacity every level. A batch's duration and output are fixed when it starts, so an upgrade
never changes a running batch. Upgrades are reached through the ▲ badge (approved rule); the ▲ of the selected building
shows at any distance.

## 4. Placement rules (shared by preview and reducer)
`derive.placementError(state, type, x, z, rot, ignoreId)` — first failure wins:
`unknown` → `onRoad` / `blocked` / `edge` / `outside` (not fully inside one lot) → `wrongZone` → `notOwned` →
`terrain_<t>` → `blocked` (reserved lane) → `onField` → `overlap` → `noAccess`.
- Footprints snap to the 0.5 m lattice every lot edge sits on (`SNAP`), so a starter yard (8 × 8 m) holds four
  workshops (it held two drying yards with the old 1 m snap).
- **One slot = one field or one workshop.** Farm workshops and barns are 3 × 3 m, exactly a field's footprint, so clearing
  a single field always frees room for one building (a 4 × 4 m workshop needed 2–4 cleared fields — found in review).
- `onField`: a building never covers a field; moving or clearing the field is an explicit action.
- `noAccess`: a local flood fill (lot + 1 m) refuses a building that would leave a field or another non-decor building
  with no walkable neighbour connected to the road.
- Rotation: integer 0–3 (sanitised on load and on every action). Fields do not rotate.

## 5. Move, remove, refund
- `build/move { uid, x, z, rot }` moves a building or a field (a growing field keeps its crop). Fixed starters refuse.
- `build/remove { uid }` (building uid or field id):
  - never starters / fixed (`fixed`), never while a batch runs or waits (`jobBusy`), never a barn whose room is in use
    (`storageFull`), never a growing field (`fieldBusy`);
  - refund = `floor(def.refund × coins spent)`; coins spent = price paid (`b.spent`, recorded on place and upgrade; older
    buildings use the price table) + upgrades bought. Refund is not income (no XP, no loan cut).
  - Fields: refund = 50 % of the last extra field's price, 0 inside the allowance (you can put it back for free).
- XP for building is earned **once per copy slot** (`region.peak`): build → remove → build never farms XP or money
  (tested: `exploits` persona, `remove:` test).

## 6. Rendering notes
- Fields render as one instanced bed mesh + instanced coffee trees (`realm/plots.js`); buildings as one prefab clone each.
- Barn and packing shed are procedural (merged boxes, shared vertex-colour material) in the stylised house style;
  the well and roastery reuse existing GLBs (`farm/well-tier-1.glb`, `farm/roaster-tier-1.glb`).
- A running batch shows a light working animation; a finished batch shows the good's icon badge (tap = collect).
