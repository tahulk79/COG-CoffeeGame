# Farm World 2.0 — Game Design

Status: design for the Farm World 2.0 big update (2026-11-07). Extends [v3-gdd.md](../design/v3-gdd.md) (still the
reference for the café, story, staff and world map) and [farm-map.md](../design/farm-map.md) (land layout, prices).
Numbers live in `src/core/config/economy.js` and `layout.js`; this file explains the rules and why.

## 1. What changes for the player, in one minute
- **One farm, not two kinds of land.** Every piece of land you own is farmland. Fields, workshops, storage and decorations
  can stand on it side by side. You no longer need "a field lot" for crops and "a yard lot" for buildings.
- **Fields are objects.** A field (one crop bed) can be moved or cleared like a building. Field lots you buy still come
  ready-tilled with 6 fields, so nothing changes if you don't want it to.
- **Buildings make goods, not magic bonuses.** Beans go through a real chain: **Field → Drying yard → Roastery →
  Packing shed → Storehouse (sell)**. Each step pays more per bean, and each workshop works one batch at a time.
- **Build more than one.** A second Drying yard dries a second batch at the same time. It only earns more if your fields
  give it beans. Each extra copy costs more than the last.
- **Tap anything to see what you can do.** Field: plant / harvest / move / clear. Building: produce / collect / upgrade /
  move / remove. Empty land: field / build / decor. Land for sale: buy.

## 2. Core loop
Short loop (seconds): plant → harvest → (process) → sell.
Mid loop (minutes): choose what to process, collect batches, sell the best goods, buy land, build a second workshop.
Long loop (levels): unlock the next workshop, upgrade, lay out the farm, reach the Level-10 incident, start again
elsewhere (approved Round 1 story).

## 3. Unified land
Rules and data: [ARCHITECTURE §2](FARM-WORLD-2.0-ARCHITECTURE.md#2-unified-land-model).
- Owned land is meadow: fields, buildings and decor all fit. Special land keeps a meaning the player can read:
  pasture (buildings, decor — animals later), orchard (fields, decor), pond and hill (decor only).
- Roads, the gate plaza and the café lanes are never built on. Nothing may cut off a field or workshop from the road.
- Building over a field is refused with "A field is here — move or clear it first": converting land is always an
  explicit action, never an accident. Workshops and barns take exactly one field's space (3 × 3 m), so one cleared
  field = one building slot.
- The grid is invisible while you play. It shows only in **build mode** (placing / moving), where owned land is tinted
  (green = allowed, red = not for this item), the ghost's tiles turn green or red, and the cost and the reason are shown.
  **Planting** highlights empty fields when the seed sheet is open. **Land for sale** shows every price sign at once.

### Fields
- Field lots (F1–F18) arrive with 6 tilled fields: the same count and price per lot as before (approved economy kept).
- Each owned field lot gives a **field allowance** of 6. Placing a field inside the allowance is free — clear a field to
  make room, put it back elsewhere for nothing.
- **Extra fields** beyond the allowance cost coins (price grows with each extra) and are capped by level, so land stays
  the main way to grow the farm early on.
- A field can move with its crop. A growing field cannot be cleared (harvest first).

## 4. Buildings
Full catalogue, limits, upgrade steps: [BUILDING-SYSTEM-2.0.md](BUILDING-SYSTEM-2.0.md).

| Category | Buildings | Why the player cares |
|---|---|---|
| Farming | Field | more crops |
| Processing | Drying yard, Roastery, Packing shed | each step multiplies the value of a bean |
| Storage | Storehouse (starter), Barn | room to keep goods while workshops run |
| Infrastructure | Well | fields within its reach grow faster — layout matters |
| Decoration | Flowers, lantern, potted plant | a pretty farm, a little XP |

- No universal limit. Each type has its own **max count by level** (e.g. Drying yard 1 at Lv2, 2 at Lv4, 3 at Lv7).
- Duplicates cost more each time (`costGrowth`), so the 3rd yard is a real decision.
- Upgrades improve **one stat per level**, alternating (workshops: speed, then batch size; well: reach, then growth).
- Remove: half the coins you spent come back. Starters (storehouse, café counters, terrace) cannot be removed.

## 5. Production economy
Formulas and simulation: [FARM-ECONOMY-BALANCE.md](FARM-ECONOMY-BALANCE.md).
- Goods: coffee beans → dried beans → roasted beans → coffee bags. All share the storehouse space (barns add room).
  Packing compresses: 6 roasted beans become 2 bags.
- A workshop runs one batch at a time: tap → Start (uses the inputs and a small fuel fee) → it works → a bubble pops →
  tap to collect. Collecting gives a little XP.
- More workshops = more batches at once. Real output is limited by beans from the fields, storage space and your taps.
  A workshop with nothing to process earns nothing.
- Selling happens at the storehouse: each good has its price; "Sell all" for one-tap selling.
- The café is unchanged: it still brews from beans and keeps its own rules (preserved, see §8).

### Why each mechanic (the six questions)
| Mechanic | Why care | Decision | Reward | Economy link | Easy? | Still fun later? |
|---|---|---|---|---|---|---|
| Free fields | shape your farm | where crops vs. workshops go | prettier, tighter farm | none (allowance) | drag like a building | yes, as the farm grows |
| Extra fields | more crops | coins on fields vs. land vs. workshops | more beans | rising price + level cap | one button | yes, price rises |
| Drying yard | +50 % per bean | sell raw now or dry first | more coins per bean | input = beans | tap, wait, tap | chains into roasting |
| Roastery | biggest step up | feed it dried beans or sell them | best coins per minute | fuel fee, 4→3 weight loss | same pattern | upgrades + duplicates |
| Packing shed | bags sell best and take little space | when storage is tight | compresses storage | fee, 3→1 | same pattern | storage pressure |
| Barn | room to keep goods | storage vs. production | fewer full-storage stops | rising price | passive | needed as output grows |
| Well | faster fields nearby | where to put it, which fields to cluster | shorter waits | coverage (no stacking) | place it near fields | layout puzzle |
| Duplicates | more throughput | when the 2nd copy pays off | parallel batches | rising price, needs beans | same as first | bottleneck hunting |

## 6. Progression and unlock pacing (Round 1, Lv1–9)
- Lv1: fields, storehouse, decor. Lv2: Drying yard. Lv3: Barn, Well. Lv4: Roastery, 2nd yard. Lv5: 2nd barn, 2nd well.
  Lv6: Packing shed, 2nd roastery. Lv7: 3rd yard, 3rd barn, 3rd well. Lv9: 3rd roastery, 2nd packing shed, 4th barn.
- One new building idea at a time; the catalogue shows locked cards with "Lv N" so players see what comes next.
- Everything opens before the Level-10 incident (approved: nothing lands on Lv10). After the incident levels continue
  (limits keep growing on the same tables).

## 7. Onboarding
- The approved farm tutorial stays (plant → harvest → sell → upgrade storehouse …); its targets now resolve through the
  fields, so it works with movable fields.
- New mechanics are taught by **object notices**, one at a time: a bouncing "+" over an idle workshop that has beans to
  process, the good's icon over a finished batch, a "Lv N" lock on catalogue cards. No full-screen tutorials.
- First Drying yard: the building card explains the recipe in one line ("6 🫘 → 6 dried · 30 s") with one Start button.

## 8. Preserved rules and decisions needing approval
Preserved (approved, unchanged): world map with paid regions (first free), one game per region chosen on entry, Round 1
only (Rounds 2–3 shown locked, no unlock action), Level-10 incident = full restart with one free region (fires once per
save — founder wants it repeated until Round 2: still open), rebirth independent of Rounds (the core action and
blessings are kept and untouched, but the current build grants no credits and shows no rebirth UI — its status is a
founder question, Farm World 2.0 does not depend on it), one hire per level (no
per-zone cap — this supersedes the older "3 per farm / 3 per café"), level gifts, loans, land prices and the north-spine
map, café gameplay and its buildings.

Decisions for the founder — **founder approved all defaults on 2026-11-07** (loan ceiling and a repeating Lv10
incident stay open; current behaviour kept):
1. **Dryer role changed** from "+% beans per harvest" to a processing workshop (the master brief asks for production
   value instead of passive bonuses). Old dryers keep their spot and level. Reversible in config.
2. **Café buildings stay single** (Roaster, Kiosk, Pastry case): multiple café roasters need a café production model
   (Roast → Grind → Brew). Proposed for later, not built, because the café and staff rules are under review.
3. **Extra field price / cap** and all production numbers are first-pass values tuned with the simulator; please playtest.
4. **Market demand** is not modelled (prices are fixed). Throughput is limited by beans, storage and taps. A demand /
   truck-order system is proposed for Round 2.
5. **Staff and production:** workers do not run workshops yet (proposed next: farmhand collects finished batches).
