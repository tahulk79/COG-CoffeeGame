# Farm World 2.0 — QA Report

Date: 2026-11-07. Only results of checks that were actually run are reported as passed. Saves: personas and tests run
on in-memory states; browser checks use `?profile=test` (separate `@test` save keys) — the real save is never touched.

## 1. Automated checks
| Check | Command | Result |
|---|---|---|
| Farm World core unit tests (21) | `node --test tests/core/farm-world.test.mjs` | pass (21/21) |
| Economy sim guards (7, incl. 3 new farm-only) | `node --test tests/core/economy.test.mjs` | pass (7/7) |
| Player personas (15 personas, 55 checks) | `node scripts/qa-personas.mjs` | pass (55/55) |
| Full suite | `npm test` | 129/130 — the 1 failure is a missing string from another session's staff work (§1.1) |
| Bundle | `npx vite build --outDir <scratch>` | builds (2.5 s) |

### 1.1 Full suite and other sessions
While this update was being made, two other sessions were editing the same working tree (staff vitals/shifts in
`derive.js`/`economy.js`, and world-map regions by city in `config/world.js`). At 07:40 the full suite showed 8
failures, all in those areas (staff hire/recruit/levels, world regions, old-save region drop, i18n country/region keys);
every Farm World test passed. At the end of this update the suite was 129/130: the only failure is
`i18n: every literal key … exists` for `realm.staff.rivalRefused`, a string the staff session uses but has not added
yet. Re-run `npm test` once those sessions finish.

## 2. Personas (headless, real reducer — `scripts/qa-personas.mjs`)
| # | Persona | What is checked | Result |
|---|---|---|---|
| 1 | New player, zero knowledge | starts with 6 fields (classic ids), plants with start coins, tutorial seeds ripen fast, sells, never stuck | pass |
| 2 | Limited money | broke → free robusta (grace), grace never gives coins, can't buy buildings | pass |
| 3 | Abundant money | every farm building up to its level limit and not past it; each duplicate costs more (120 < 190 < 305) | pass |
| 4 | Many crop plots | 18 field lots → 108 fields; extra fields stop at the level cap; every planted field harvests | pass |
| 5 | Many buildings | decor fills each limit; building over a field = `onField`; road = `onRoad`; pond = decor only | pass |
| 6 | Duplicate buildings | 3 drying yards run 3 batches at once; a 2nd yard without beans = `noInput`; all 3 collect | pass |
| 7 | Expanding land | field lot adds 6 fields, yard lot none, allowance follows lots, roads open with land | pass |
| 8 | Upgrading buildings | every dryer level improves exactly one stat (speed/batch alternate); max level 8 | pass |
| 9 | Production bottleneck | collect waits when storage is full; selling frees it; 1st and 2nd barn both add room | pass |
| 10 | Region transition | new region 6 fields; beans shared; old region keeps its fields | pass |
| 11 | Level-10 incident | triggers at Lv10; goods wiped; new region = 6 fields + starters only | pass |
| 12 | Round 2 | still locked, no unlock action (approved) | pass |
| 13 | Rebirth | works at Lv5 with a credit; keeps coins and fields | pass |
| 14 | Old save | v4 → v5: 12 fields with old ids, every crop survives, buildings + levels survive, idempotent | pass |
| 15 | Exploits | build → remove loses coins; field place → remove never earns; no café buy → farm sell loop | pass |
| — | Mobile touch | needs a device — see §4 | not run |

## 3. Performance
Measured without a device (audit, `vite build` to the scratchpad): three 695 kB (180 kB gz), entry 245 kB, realm
208 kB, HUD 67 kB; GLBs 20.65 MB in `public/models`, 4.25 MB loaded up front by the realm; reducer `apply` ≈ 0.19 ms,
save ≈ 11 kB. Changes in this update with expected impact (not yet measured on a phone):
- Coffee trees instanced: was one GLB clone (2–3 meshes + shadow pass each) per planted field — e.g. 84 planted fields
  ≈ 250 draw calls + 250 shadow draws; now one draw (+ one shadow) per tree part (≈ 3–6 total).
- Owned meadow lots no longer draw a tilled overlay + fence each.
- Open sheets repaint only when what they show changes (they rebuilt on every store dispatch before).
- Placement checks: the access flood fill is local to one lot (≤ ~800 cells); tiles are memoised per region object.
- Staff removal no longer frees the shared worker GLB (removed a texture re-upload + shader recompile hitch).
Needs a real device: fps and draw calls on a full farm before/after, first-placement hitch, café street with many NPCs.

## 3b. Browser smoke (built-in browser, 375 × 812 portrait emulation, `?profile=test`)
Story fast-forwarded through the dev store hook on the test save (`@test` keys), then played with real taps.
Other sessions were editing `src/` at the same time, so Vite reloaded the page several times; each step was re-done
after a reload. No console errors at any point.

| Step | Result |
|---|---|
| Farm loads; F1's 6 beds sit on plain meadow (no field fence), for-sale lots show signs | pass |
| Build → catalogue tabs (Farming / Processing / Storage …); Field card `6/18 · 60`; Processing: yard 0/2 · 120, roastery 0/2 · 300, packing shed 0/1 · 700 | pass |
| Drying yard ghost: translucent model, green lot tint, green 1 m footprint tiles, bar with cost, ✕ ↻ ✓ | pass |
| ✓ builds it ("Drying yard built", −120 coins); middle toolbar button turns into 📦 Storehouse | pass |
| Tap the yard → card: Lv 1/8, `12 🫘 → 12 🟤 · 30s`, Start, next-upgrade stat, "You have 1 of 2", Move, Remove +60 | pass |
| Start → beans 30 → 18; after 30 s a collect badge (dried-bean icon) over the yard | pass |
| One tap on the yard collects (12 dried, storage 30/40), card offers Start again | pass |
| Storehouse card: capacity bar, per-good Sell rows, Sell all → "Sold for 84 coins", storage 0 | pass |
| Tap empty yard grass → avatar walks, land card "Meadow: Field · 60 / Build / Decor" | pass |
| Land card → Field when no 3 × 3 m spot fits nearby → ghost jumped to F1 in red, "No free space…" | **issue → fixed** (§5): ghost now stays at the tapped spot |
| After the fix: remove the centred yard (+60 refund), new yard packs into the yard corner (13.5, 18), barn beside it (16.5, 18), a field still fits (13.5, 15); procedural barn renders | pass |
| Tap empty field → plants (one tap); card "Robusta — ready in 0:13", Move, Clear disabled "Harvest it first" | pass |
| Move a field → bed hidden, green field ghost, bar "Field · Move" | pass |
| Expansion mode → overview zoom, for-sale lots tinted + signs, "Tap a sign to buy… ✓ Done" chip | pass (labels small, chip text cut) |

## 5. Review findings (3 independent reviewers: runtime, player journeys, perf/visual)
17 findings → 15 fixed, 1 partly fixed, 1 deferred, plus follow-ups made after the review:
- Fixed (selection): tile/bed bounding spheres not recomputed (instances could be culled); growing trees rewritten every
  frame; HUD safe insets never set (cards could cover the target); tutorial hand under the action card; Clear field
  with one tap (now two-tap); land card Build/Decor lost the tapped spot; tabs cut off at 375 px; orchard scenery
  trees through fields; progress bar under the ▲ badge; bed size 2.1 vs 2.4 m; missing screen-reader notice strings;
  chimney smoke left at a moving building's old spot; autoplay stuck when storage is full of processed goods.
- Partly fixed: building over fields now says how many fields are under it (red-tinting the blocking beds: not done).
- Deferred: the 1 m build grid lines do not always line up with the 0.5 m snap (look decision).
- Overruled: the reviewer wanted the camera to stop gliding to newly bought land; that glide is an approved founder
  rule (farm-map.md), so it was restored.
- Design gap found in review and fixed in core: 4 × 4 m workshops never fit in ONE cleared field → farm workshops and
  barns are now 3 × 3 m (one field = one building slot), tested.
- Found in the browser and fixed: placement start packs into the lot corner nearest the player (no more workshop in the
  middle of the yard) and stays at the tapped spot when nothing fits.

## 4. Device checklist (founder playtest)
Open `http://<dev-host>:5173/?profile=test&coins=50000&level=6` on a portrait phone.
1. Plant / harvest by tap and by drag on F1; the card shows Move / Clear.
2. Build → Processing → Drying yard → place it in the yard → Start → wait → tap the yard (one-tap collect).
3. Clear two fields, build a Roastery where they were, place a new field in the yard ("Free (n left)").
4. Tap empty grass → land card → Field here.
5. Build → Land → Show land for sale → buy a field lot → 6 fields appear; Done.
6. Build a 2nd drying yard; both show their own progress.
7. Fill storage, try to collect → "Storehouse full"; sell all; collect works.
8. Remove a building (two taps) → refund toast.
9. Storehouse card: sell each good, sell all.
10. Reload the page: everything is where it was.
