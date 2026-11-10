# Performance optimization plan

**Status 2026-11-09:** All of P0 is implemented, uncommitted. P1 and P2 are not. P0-2 changed from a time-based 60 FPS cap to drawing every Nth display refresh, because the time-based cap paced frames unevenly on 75 Hz (p95 27.6 ms, now 14.3 ms; 75 Hz runs at 75 FPS, 37.5 idle). P0-3 skips the world only where the staff modal fills the width (up to 460 px); 0 renders while covered, one repaint after a portrait or resize. Forest and scatter compaction (P2) is also done, at the founder's request and ahead of the phone A/B: `realm/instance-cull.js`. At a 390x844 view triangles per frame fell from about 2.6M to 1.57M (home pose, shadow pass included) and draw calls from about 440 to 180 to 230. A frame with and without culling differs by 0 pixels at six camera poses once animated characters are hidden. GPU benefit on phones is not measured. The shadow box now moves in steps of 1/8 of its half width (texel aligned): shadow passes while panning fell from 74 to 15 to 19 per second, and one step changes 0 pixels in a static scene. The box is 1/16 wider than before, so shadow resolution is about 6% lower. P1-3 is done except scoped clones: plain clone (0.6 → 0.12 ms on a 64 KB save, output byte-identical), `staff/workDone` joins the background actions for the realm and the HUD (2.45 → 0.47 ms), the staff bonus is computed once per world sync (`readOnlyPass`), and beds, pick boxes and rows are redone only when the field layout changes. Scoped clones are skipped: the remaining gain is about 0.1 ms and the per-region memos rely on a fresh region object. `npm test` and `npm run sim` were not run. Stream tiles and cliffs are instanced per material (`placeCopies` in `realm/mountain-dressing.js`): world draw calls 130 → 90 and 142 → 96 along the stream, at most one pixel different at four poses. Buildings were not merged: 30 models hold 99 meshes and 97 materials, so merging inside a model saves about 2%; a real reduction needs instancing across identical buildings or a shared texture atlas. P1-1 was tried and rejected: wall and step shadows cost no measurable GPU time now (8.79 vs 8.85 ms) and removing them visibly changes about 4% of the frame. P1-2 was done as a 12 Hz stepped bob instead of a shader: uploads with ripe trees fell from 9.9 to 2.1 MB/s. Measured on one Apple M1 in Chrome only, on the late-game save, dev build: GPU per frame 12.6 → 7.6 ms at 60 FPS (different sessions, so indicative), triangles 4.7M → 2.7M, hiding all coffee now saves 1.08 ms (was 6.15 ms), on-demand shadows 10.94 vs 12.29 ms per-frame at the 30 FPS idle rate, heap flat across 12 region switches (116–120 MB in one region, 180–193 MB in the other, was 212 → 752 MB). A residual of about one texture per round trip is unexplained. Phones, Safari, temperature, battery, and crew throughput at the idle rate are not measured.

**Added 2026-11-09 (founder: phones run hot, Low too):** Low draws at 30 FPS at all times and draws at most 12 crew with reduced animation; Low stops the HUD's endless CSS animations; Auto's walking farmer no longer forces 60 FPS; a first run on a phone starts at Medium. Low also draws thinner coffee trees and no mulch basin. Measured results and causes: [HEAT-REPORT.md](HEAT-REPORT.md). Not measured on a phone: no temperature or battery claim yet.

This is the proposal for review. Evidence is in [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md) and [PERFORMANCE-BOTTLENECKS.md](PERFORMANCE-BOTTLENECKS.md). All expected benefits are estimates unless marked measured.

## 1. Guardrails

These apply to every task.

- Each task is one small change that can be reverted on its own.
- Gameplay results must not change. Rendering may skip frames, but simulation time must keep accumulating.
- Do not decimate crew work or walking logic, change the `dt` clamp, or reduce the crew thinking rate without explicit sign-off. Those change crew throughput by an estimated 0.5 to 3% (CPU-16).
- Any speed-up on very slow phones slightly raises crew output relative to crop growth, because `dt` is clamped at 0.1 s today. This is an existing property of the game, and balance QA should be aware of it.
- Do not replace art with primitives. Do not remove features.
- New dependencies need a justification. Only KTX2 encoding proposes one.
- Compare before and after with the alternating A/B method, not single captures.
- No claim of a temperature or battery improvement without a device measurement.

## 2. Technique review

### A. Render-on-demand and adaptive FPS

| Technique | Decision | Reason |
|---|---|---|
| Pause when page is hidden | Already done | `game.js:90, 560` |
| Cap at 60 FPS on high-refresh displays | **Do** | Loop is uncapped today |
| 30 FPS idle rate | **Do**, then measure power | Idle farm pays full cost |
| Fully on-demand rendering | Do not do | Wind, water, particles and idle poses change every frame, so it would visibly freeze the world |
| Skip render when a modal covers the world | **Do** | Simulation continues, GPU work stops |
| 60 FPS performance mode | **Do** | This is the default cap in P0-2 |
| 30 FPS battery mode (user setting, caps active play too) | Decide after a device power test | Same frame gate as P0-2, so it is a small setting once that exists. No battery benefit measured yet |

### B. GPU

| Technique | Decision | Reason |
|---|---|---|
| Dense lists and frustum compaction for coffee | **Do** | Largest measured GPU cost |
| Shadow invalidation | **Do** | 38% of draw calls (measured) |
| Shadow distance and resolution | Keep as is | Box already follows the camera, with a 1024 map on phones |
| Coffee LOD for far zoom | Do after art check | No usable LOD exists today |
| Compaction for forest and scatter | Only if a phone A/B shows a gain | No measured gain on M1 |
| Spatial chunking | Do not do | Would add draw calls. Compaction keeps one draw per set |
| BatchedMesh | Do not do yet | Dense instancing covers the need with less risk |
| Merge stream, gates, fences | **Do**, later | Draw-call reduction for CPU-limited phones |
| Material sharing | Not assessed | 636 unique materials late game, duplicates not counted |
| Shader complexity (ground has 16 sin hashes) | Phone A/B first | RA-11, TERRAIN-02. Whether fragment cost matters is unknown |
| Overdraw (field halos, mulch ring) | **Do**, P1-13 | TERRAIN-09, stacked blended PBR decals |
| More InstancedMesh (stream, cliffs, shade trees) | Merge stream by segment, leave the rest | G7, G8. One whole-map set would lose per-tile culling |
| Frustum culling | Covered by compaction | Mesh-level culling already works for clones |
| Distance LOD | Coffee only, P1-10 | Forest already uses far LODs |
| Pixel ratio ladder | **Do**, after phone test | Must be validated on a real device |
| Postprocessing removal | Not applicable | None exists |
| KTX2 | Pilot | Largest memory saving, needs art review and encoder |

### C. CPU

| Technique | Decision | Reason |
|---|---|---|
| Event-driven, dirty-state updates | **Do** for `syncAll`, HUD | Dispatch path is the CPU spike |
| Plain clone, then scoped clones | **Do** | `structuredClone` of the whole save per action |
| Allocation removal on the walk-check path | **Do** | `derive.js` and `realm/index.js` reached 15.5% in one trace |
| Static matrix updates off | **Do** | Scene graph has 3,216 nodes |
| Fixed-timestep simulation | Do not do | Changes crew throughput unless overshoot is carried, and no measured need |
| Lower-frequency AI, pathfinding cache or throttle | Do not do | Under 0.1% of main thread |
| Spatial partitioning for crew job search and proximity | Do not do | `staff-brain.js` and `nav.js` under 0.1% of main thread (CPU-8 is P2) |
| Web Workers | Do not do | No suitable measured cost |
| Raycast reduction | Not needed | Already only on tap |
| Object pooling | Mostly done | Particles, badges, bubbles |

### D. 4-level farm

| Area | Decision |
|---|---|
| Terrain mesh | Leave. One grid, one draw, 36,838 tris, cheap. Optionally coarsen the apron outside the map (P2). |
| Cliffs | Leave for now. Off-screen clones are already culled per mesh. |
| Roads | Leave. Already one merged mesh. |
| Plots and coffee | Bottleneck 1, highest priority. |
| Walls and steps | Stop shadow casting, a computed saving of 139,632 shadow triangles (36 walls x 2,108 + 6 stair flights x 10,624). |
| Irrigation | No irrigation network is placed by the world. Decor channels are filtered out by `WILD_START`. Player-built drip lines (limit 6) are ordinary placed buildings. `dripCovers` falls under P1-3 memo handling. |
| Water | Leave. UV scroll only. The 13 stream clones can be merged and stop casting. |
| Buildings | Hidden buildings stop loading. Otherwise leave. |
| Workers and robots | Bottleneck 7. |
| Props | Compaction only if a phone A/B shows a gain. |
| Plants (forest, shrubs, scatter) | Already instanced with far LODs. Compaction only if a phone A/B shows a gain. |
| Chunking and LOD | No chunking, because it adds draws. LOD for coffee only (P1-10). Cliff LOD (TERRAIN-07) deferred. |

Nothing that remains visible or interactable is unloaded. Picking uses separate invisible proxies, so instance compaction does not affect it.

### E. Adaptive quality

Design below extends the existing `low`, `medium`, `high` tiers.

| Preset | Pixel ratio | Shadows | Trees casting | Effects | Target FPS |
|---|---|---|---|---|---|
| LOW | 1 | Off | None | Emitters off, reduced particles | 30 |
| MEDIUM | 1.5 | On, invalidated | Reduced | Half | 30 idle, 60 active |
| HIGH | 2 | On, invalidated | All | Full | 30 idle, 60 active |
| AUTO | Starts at MEDIUM on coarse pointers, HIGH on desktop | Follows ladder | Follows ladder | Follows ladder | Same as tier |

AUTO behaviour:

1. Judge a smoothed frame time during active play only, excluding capped idle frames and frames over 250 ms.
2. Try resolution steps first (2, 1.75, 1.5, 1.25, 1), then feature steps.
3. Require about 4 s over budget before stepping down, and about 60 s with headroom before stepping up one level.
4. After a step-up that fails, block further step-ups for several minutes.
5. A manual choice always wins and disables AUTO.

FPS alone does not indicate device temperature, and browsers have no reliable thermal signal, so AUTO does not attempt to detect heat.

## 3. Backlog

Risk is the regression risk to gameplay or visuals. Regression checks are manual unless noted. Tests are only added or run when requested.

### P0

#### P0-1 Fix the region-switch leak
- **Files:** `src/features/realm/plots.js`, `src/features/realm/avatar.js`, `src/features/realm/index.js`, `src/features/realm/world.js`
- **Root cause:** Unremoved quality listener, undisposed player GLB, PMREM target and world InstancedMeshes (F-01, F-02, F-06, F-08, F-09, RA-14).
- **Implementation:** Keep and call the `onQuality` unsubscribe. Dispose the character and PMREM target. Dispose per-realm instanced meshes. Leave cached shared GLBs alone.
- **Benefit:** Stops measured growth of about 90 to 100 MB of heap per region round trip.
- **Dependencies:** None.
- **Risk:** Low.
- **Acceptance:** Over 12 switches, same-region geometries and textures do not rise, and heap stays in a stable band. Heap snapshot shows one realm retained.
- **Regression:** Switch regions, change quality, return to the atlas, reload a save.

#### P0-2 Frame gate and idle rate
- **Files:** `src/app/game.js`, `src/features/realm/index.js`
- **Root cause:** No cap, no idle concept (RA-2).
- **Implementation:** Drift-corrected accumulator gate at the top of `frame()`, 60 FPS target, 30 FPS after 3 to 5 s without input or motion. Do not write `previous` on skipped frames. `watchFrame` ignores capped frames.
- **Benefit:** About 50% fewer frames at 120 Hz, and 50% fewer idle frames at 60 Hz. Battery effect to be measured.
- **Dependencies:** None.
- **Risk:** Low. First input must wake the loop immediately.
- **Acceptance:** Measured frame rate per state on 60, 75 and 120 Hz displays. Crop timers, crew throughput and `npm run sim` output unchanged.
- **Regression:** Pan, zoom, drag placement, cinematics, atlas, intro.

#### P0-3 Skip render when the world is covered
- **Files:** `src/app/game.js`, `src/features/hud/index.js`, `src/features/hud/staff-modal.js`, `src/features/hud/tree-viewer.js`
- **Root cause:** No modal awareness in the loop (RA-6, CPU-15).
- **Implementation:** Expose `hud.worldCovered`. Keep `realm.update`, skip `renderer.render`, and draw once after resize or portrait. Limit to when the panel really covers the world.
- **Benefit:** All world GPU work removed while the staff modal is open.
- **Dependencies:** P0-2.
- **Risk:** Low to medium. `preserveDrawingBuffer` is false, so a portrait draw needs a following full frame.
- **Acceptance:** Zero main renders per second while covered. No blank frame on close.
- **Regression:** Open and close the modal, portraits, tree viewer, desktop width.

#### P0-4 Shadow invalidation
- **Files:** `src/features/realm/index.js`, `src/app/game.js`, `src/features/realm/staff.js`
- **Root cause:** `autoUpdate` always on (RA-1, G6).
- **Implementation:** Set `autoUpdate = false` in play. Request updates on box move, layout change, quality change, moving casters in the box (throttled), and at a slow periodic rate for growth. Ignore idle poses and ripe bob.
- **Benefit:** Up to the measured 38% of draw calls and 20% of GPU time in quiet moments.
- **Dependencies:** None.
- **Risk:** Medium. Slight stepping in character shadows.
- **Acceptance:** Shadow passes per second near zero when nothing moves. Visual comparison matches during pan, build, plant.
- **Regression:** Screenshot comparison at three zoom levels.

#### P0-5 Coffee dense lists
- **Files:** `src/features/realm/plots.js`
- **Root cause:** Zero-scale slots and no culling (G3, RA-7).
- **Implementation:** First per-species hiding (stage and fruit meshes are already hidden when unused), then dense per-part lists with swap-remove, then camera-bucketed frustum compaction.
- **Benefit:** Part of the 6.15 ms hide-all saving on M1 with 200 fields. Target at least 3.7 ms.
- **Dependencies:** None.
- **Risk:** Medium. Index coherence for colour, growth and removal.
- **Acceptance:** Coffee A/B shows at least 60% of the hide-all saving. Identical visuals at each zoom.
- **Regression:** Plant, grow, ripen, harvest, uproot, tint, trial fields, picking.

### P1

#### P1-1 Stop walls and steps casting shadows
- **Files:** `src/features/realm/world.js`
- **Root cause:** Default shadows on these sets (TERRAIN-04).
- **Implementation:** `shadows: false` for tier walls and stone steps.
- **Benefit:** 139,632 fewer shadow triangles, 7 fewer shadow draws.
- **Dependencies:** None. **Risk:** Low, a small cutting shadow is lost. Needs art approval.
- **Acceptance:** Draw-call drop, visual approved.
- **Regression:** Ramp and stair views.

#### P1-2 Ripe bob without buffer upload
- **Files:** `src/features/realm/plots.js`
- **Root cause:** Bob dirties every instance buffer (CPU-9).
- **Implementation:** Vertex-shader bob with an instance phase, also applied to depth if casters use it.
- **Benefit:** Removes up to 37 to 213 KB of uploads per frame.
- **Dependencies:** P0-5. **Risk:** Low to medium.
- **Acceptance:** Same motion, no `bufferSubData` per frame when only ripe bob changes.
- **Regression:** Ripe tree visuals.

#### P1-3 Dispatch path
- **Files:** `src/core/game.js`, `src/core/state.js`, `src/features/realm/index.js`, `src/features/realm/plots.js`, `src/features/hud/index.js`, `src/core/derive.js`
- **Root cause:** Whole-save clone and full resync per action (CPU-1, CPU-2, CPU-3, CPU-5).
- **Implementation:** Staged. First add `staff/workDone` to quiet, then coalesce `syncAll` and HUD per frame, then a plain clone, then scoped clones with a dev deep freeze.
- **Benefit:** Shorter main-thread spikes.
- **Dependencies:** None. **Risk:** Medium. Economy results must be unchanged.
- **Acceptance:** Identical reducer output against the existing clone. Dispatch p95 drops.
- **Regression:** `npm test` and `npm run sim` when requested, QA personas, placement, hire.

#### P1-4 Walk-check allocation
- **Files:** `src/core/derive.js`, `src/features/realm/index.js`, `src/features/realm/staff.js`
- **Root cause:** `tileAt`, `farmViewBounds` and `roadOpen` recomputed from state per probe (CPU-5, CPU-12).
- **Implementation:** Reuse layout-pure memos and add an allocation-free `occupantAt`. First reproduce the state that causes the 15% cost.
- **Benefit:** At most the 15.5% those two files took in that trace. Function-level share unknown.
- **Dependencies:** Helps P1-3. **Risk:** Low.
- **Acceptance:** Same walk results and lower cost in the reproduced state.
- **Regression:** Idle wandering, road opening, land purchase.

#### P1-5 Crew rendering
- **Files:** `src/characters/gedeo-worker.js`, `src/features/realm/staff.js`, `src/features/realm/util.js`, `scripts/blender/gedeo_robots.py`
- **Root cause (ACE-1, ACE-2, ACE-4, CPU-7):** Duplicate skeletons, multi-part robots, per-unit canvases.
- **Implementation:** Share the worker skeleton. Add a label pool. Stop casting from tiny robot parts as an interim step. Export rigid-skinned robots later.
- **Benefit:** About 22 fewer draws at the drawn limit for workers, and tens of MB less label memory.
- **Dependencies:** None. **Risk:** Low to medium.
- **Acceptance:** Draws drop and labels look identical.
- **Regression:** All worker and robot types, language switch.

#### P1-6 Stop loading what is never shown
- **Files:** `src/features/realm/index.js`, `src/features/realm/scenery.js`, `src/app/game.js`
- **Root cause:** Café models and hidden groups load (TEX-05, TEX-06, F-04). Lazy templates for other buildings are out of scope here.
- **Implementation:** Filter café-only models while `CAFE_ENABLED` is false and skip hidden groups.
- **Benefit:** About 2.58 MB download, 40 MB bitmaps, 27 to 29 MB GPU.
- **Dependencies:** None. **Risk:** Low. Must be reversed when the café returns.
- **Acceptance:** Those GLBs no longer requested, farm unchanged.
- **Regression:** Saves that reference shop-zone buildings.

#### P1-7 Icon context lifetime
- **Files:** `src/features/hud/model-icons.js`
- **Root cause:** Permanent second GL context (RA-8, TEX-07).
- **Implementation:** Dispose after the queue drains, as the tree viewer does.
- **Benefit:** Frees the second context's copies, tens of MB.
- **Dependencies:** None. **Risk:** Low. Do not call `texture.dispose()`, because textures are shared.
- **Acceptance:** Context released, icons still appear.
- **Regression:** Build menu, staff portraits.

#### P1-8 Resolution ladder and auto-quality
- **Files:** `src/shared/vfx/index.js`, `src/app/game.js`, `src/ui/settings.js`
- **Root cause:** Blind judge and no resolution steps (RA-3, RA-4).
- **Implementation:** See section 2E. Validate on real phones first.
- **Benefit:** Unknown until measured on phones.
- **Dependencies:** P0-2. **Risk:** Medium.
- **Acceptance:** No oscillation over 10 minutes. Manual override holds.
- **Regression:** Settings, context-loss recovery.

#### P1-9 KTX2 pilot
- **Files:** `src/shared/three/models.js`, `scripts/optimize-models.mjs`, `public/` for transcoder files
- **Root cause:** RGBA8 textures everywhere (TEX-04).
- **Implementation:** Pilot terrain and 2 to 3 heavy shared textures. The encoder dependency is justified by the estimated saving.
- **Benefit:** Estimated 108 to 120 MB less GPU memory if rolled out fully. The pilot alone is smaller and will be measured.
- **Dependencies:** P1-7. **Risk:** Medium, art review required.
- **Acceptance:** Art sign-off and measured memory saving.
- **Regression:** All materials that use piloted textures.

#### P1-10 Coffee far-zoom LOD
- **Files:** `scripts/blender/gedeo_heroes.py`, `src/features/realm/plots.js`, `public/models/farm/`
- **Root cause:** One detail level at every zoom (G4).
- **Implementation:** One reduced tree per species, swapped per zoom bucket.
- **Benefit:** Far-zoom triangle reduction, unquantified until an approved mesh exists.
- **Dependencies:** P0-5. **Risk:** Medium, art review.
- **Acceptance:** Art approved and far-zoom triangle drop.
- **Regression:** Zoom transitions.

#### P1-11 Warm-up and first-seen hitches
- **Files:** `src/app/game.js`, `src/features/realm/index.js`
- **Root cause:** Shaders compiled on first use, synchronous warm-up (TEX-10, RA-13).
- **Implementation:** Warm up placeable building variants and split uploads across frames.
- **Benefit:** Removes first-placement compile stalls if the `programs` correlation is causal.
- **Dependencies:** P1-6. **Risk:** Low.
- **Acceptance:** No long task over 100 ms on first placement of each building type.
- **Regression:** Load flow, context-loss recovery.

#### P1-12 Staff portrait renders
- **Files:** `src/features/hud/staff-modal.js`, `src/features/hud/model-icons.js`
- **Root cause:** Up to 22 full scene and shadow renders in one task every 30 s (RA-9).
- **Implementation:** Render portraits one per frame, skip the shadow pass and reuse results while the unit's look is unchanged.
- **Benefit:** Removes a periodic long task while the staff list is open.
- **Dependencies:** P0-3. **Risk:** Low.
- **Acceptance:** No long task from portraits with the modal open.
- **Regression:** Portrait freshness after gear changes.

#### P1-13 Field halos and mulch rings
- **Files:** `src/features/realm/plots.js`
- **Root cause:** Stacked transparent, normal-mapped PBR decals at the 1 m planting pitch (TERRAIN-09).
- **Implementation:** Use a cheaper unlit or Lambert decal material and hide rings at far zoom, after a phone A/B.
- **Benefit:** Less blended fill. Size unknown until tested on a phone.
- **Dependencies:** None. **Risk:** Medium, visual.
- **Acceptance:** Art approved and a measured gain.
- **Regression:** Field selection and highlighting.

### P2

TEX-01, TEX-03 and TEX-09 are P1 in the audit but scheduled here because the memory saving is an estimate and each carries art or context-loss risk. Catalogue P2 IDs not listed below are not scheduled.

Regression for every P2 row: the matching area in test plan section 6.

| Task | Files | Root cause | Implementation | Benefit (estimate) | Depends on | Risk | Acceptance |
|---|---|---|---|---|---|---|---|
| Forest and scatter compaction, gated on a phone A/B | `shared/three/gedeo-vegetation.js`, `realm/world.js`, `realm/scenery.js` | One bounding sphere per set (TERRAIN-01, TERRAIN-06, G1, G2) | Camera-bucketed compaction | None measured on M1, phone unknown | Phone A/B | Low to medium | Measured phone gain |
| Merge stream, gates, fences | `realm/mountain-dressing.js`, `realm/map-fence.js` | Clone draws (G7, G14, TERRAIN-05, TERRAIN-10) | Merge per material, stop stream casting | Up to 104 stream draws, most of 13 per gate | None | Low | Draw-call drop |
| Static matrices off | `realm/world.js`, `realm/mountain-dressing.js` | Recomputed matrices (RA-12, ACE-5, G15) | `matrixAutoUpdate = false`, refresh on layout | Part of 0.6 ms per frame on M1 | None | Low | `matrixWorld` time drops |
| Ground shader cost | `shared/three/farm-textures.js` | 16 sin hashes per pixel (RA-11, TERRAIN-02) | Precompute or reduce noise taps, phone test first | Unknown until tested on a phone | Phone A/B | Medium, visual | Measured phone gain, art approved |
| Animal mixer LOD | `realm/animals.js` | Always-on mixers (ACE-3) | Use the `onBeforeRender` pattern | Small on M1 | None | Low | Off-screen animals skip work |
| Retained bitmaps | `shared/three/models.js` | Bitmap kept after upload (TEX-03, F-07) | Close after upload where re-upload is not needed. Context-loss path must be handled. | About 155 MB CPU memory | None | Medium | Heap drop on phone |
| Duplicate texture decode | `shared/three/models.js`, `scripts/optimize-models.mjs` | Same bytes in many GLBs (TEX-01, TEX-11) | External shared textures | 4.65 MB download, fewer transient bitmaps | Dedupe fix decision (TEX-02) | Medium | Download and decode drop |
| Character texture size | `public/models/`, art pipeline | 2048 for a small character (TEX-09, ACE-12) | 1024 versions after art check | Up to about 20 MB GPU per character | None | Low | Art approval |
| Save write | `core/store.js` | Full stringify and double write (CPU-4) | Time stringify first, then split domains if needed | Small on M1 | None | Low | Measured need |

### Decision needed, separate from performance

Tier walls appear to render the warehouse flagstone because texture dedupe matches names only (TEX-02). Fixing this changes the look of the walls, so it should be an explicit art decision.

## 4. Expected improvements and trade-offs (estimates)

| Batch | Likely gain | Trade-off |
|---|---|---|
| P0 | Stable memory across region changes. Up to about 30 to 47% less GPU time on a late-game farm on M1 at the P0-5 acceptance floor, before overlap. About half the frames while idle or on 120 Hz. | Slight stepping of character shadows. Lower motion smoothness while idle. |
| P1 | Fewer stutters, fewer draws for big crews, tens to over 100 MB less memory | More engineering. Art review for KTX2 and LOD. |
| P2 | Incremental, phone-dependent | Most need a phone A/B first. |

The A/B gains overlap because coffee trees are also shadow casters, so they cannot be added together. None of this predicts FPS or temperature on a specific phone.

## 5. Recommended first batch

Do these in order, each as its own reviewable change.

1. **P0-1 region leak.** No visual change, low risk, and it removes the only confirmed stability problem.
2. **P0-2 frame gate.** Small and reversible, addressing continuous load.
3. **P0-4 shadow invalidation.** Biggest draw-call win with moderate risk.
4. **P0-5 step 1, coffee hide by species**, followed by the dense-list step as its own change.

Before starting P1, measure the current build on at least one real iPhone and one mid-range Android device using the test plan. Those results decide whether the resolution ladder and forest compaction are worthwhile.
