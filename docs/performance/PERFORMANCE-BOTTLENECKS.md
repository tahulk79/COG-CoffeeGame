# Performance bottlenecks

Ranked from measurements in [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md) and verified code findings in [PERFORMANCE-AUDIT.md](PERFORMANCE-AUDIT.md). IDs in brackets refer to the audit catalogue. Benefits are estimates unless marked measured.

## Ranking

Impact scale: High, Med, Low, none. FPS is the expected change on devices limited by that resource. The Battery and heat column is a prediction from CPU and GPU load. No power or temperature was measured.

| # | Bottleneck | Sev | CPU | GPU | Memory | Battery and heat | Expected FPS gain | Effort | Visual risk | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Coffee trees: all slots of each shown part, no culling, no LOD | P0 | Low | **High** | Low | High | High in late game | M | Low to Med | A/B |
| 2 | Shadow map re-rendered every frame | P0 | Med | High | none | High | Med | M | Low | A/B |
| 3 | Region switch leaks the previous farm | P0 | Low | Low | **High** | Low | Stability | S | none | Repeated capture |
| 4 | Full-rate rendering when idle or covered | P0 | High | High | none | **High** | none (energy effect unmeasured) | S | Low | Capture, code |
| 5 | Phone resolution default and blind auto-quality | P1 | none | Unknown | Med | Unknown | Unknown until tested on a phone | S | Med | Partly measured |
| 6 | Each dispatch clones the save and resyncs the world | P1 | Med | Low | Med | Low | Fewer hitches | M | none | Capture, code |
| 7 | Crew draw calls and label canvases | P1 | Med | Med | Med | Med | Med with big crews | M | Low | Census, code |
| 8 | Texture memory and wasted loading | P1 | Med | Low | High | Low | none (load and stability) | M to L | Med for KTX2 | Estimates |
| 9 | Render submission volume on the main thread | P1 | High | Low | none | Med | Med on CPU-limited phones | M | Low | Capture |
| 10 | Load spikes and first-seen hitches | P1 | Med | Low | Low | Low | Removes stutters | M | none | Capture |

## 1. Coffee trees are drawn at full cost for every slot

**Location.** `src/features/realm/plots.js:369-405`, `:446-449`, `:637-638`; shadow admission in `node_modules/three/src/renderers/webgl/WebGLShadowMap.js:515`. [G3, G4, RA-7, CPU-9]

**Current implementation.** 13 InstancedMeshes, one per tree part, each with `count = slotHigh` and `frustumCulled = false`. A tree that does not show a part writes a zero-scale matrix. Stage and fruit meshes are already hidden when no tree shows them (`plots.js:637-638`), but bark, leaves and ring always draw, for both species, including on farms that have none of one species. There is no distance LOD. Ripe trees bob, marking the instance buffers dirty on most frames.

**Why it is expensive.** The GPU runs the vertex shader for every slot of every visible mesh, for trees on the far side of the map, in the main pass and again in the shadow pass.

**Evidence.** Measured at 200 fields: 1.914M submitted triangles across the 21 InstancedMeshes in `realm-plots` (13 are tree parts, the rest are field ground), 0.947M of them also casting. Hiding them cut GPU time from 13.63 ms to 7.48 ms (A/B median), the largest single gain measured.

**Proposed solution.**
1. Per-species counts, hiding a species' bark, leaf and fruit meshes when it has no shown instances.
2. Dense per-part lists with swap-remove, so `count` equals trees showing that part, then camera-bucketed frustum compaction.
3. One reduced tree per species for the far zoom levels, swapped per zoom bucket.
4. Move ripe bob into the vertex shader or use range uploads.

**Expected benefit (estimate).** Step 1 helps only farms missing a species and is lost once one liberica exists. Step 2 removes zero-scale and off-screen slots but not visible trees, so it saves only part of the 6.15 ms hide-all figure. The target is at least 60%, about 3.7 ms on an M1. Step 3 reduces far-zoom cost further, and benefit depends on art approval.

**Risks.** `instanceColor`, `growTrees`, `freeSlot` and `setHidden` must stay coherent with the dense indices. A poor decimation looks sparse. A robusta export was already rejected for that reason (`plots.js:372`).

**Verify.** Repeat the coffee A/B. Check picking, growth stages, tint, ripe bob and harvest on near and far zoom. Screenshot comparison at all zoom levels.

## 2. The shadow map re-renders every frame

**Location.** `src/app/game.js:498`; `src/features/realm/index.js:131-139`, `:1428-1442`; `src/features/realm/world.js:975-977`. [RA-1, G6, TERRAIN-04, TERRAIN-05]

**Current implementation.** `renderer.shadowMap.autoUpdate` stays true. The depth pass repeats each frame even though the only real shadow changes are moving characters and rare layout edits. Wind is applied in `onBeforeCompile` and does not reach the depth material, so identical geometry is being redrawn.

**Why it is expensive.** It adds about 61% more draw calls (330 to 531) and over a million triangles of depth work per frame in late game.

**Evidence.** Measured A/B: freezing it removed 201 of 531 draw calls (38%), 1.28M triangles and 2.65 ms of GPU time (20%), and saved 0.7 ms of render-submit time.

**Proposed solution.** Set `autoUpdate = false` in play and request an update when the camera box moves, layout or quality changes, or a moving caster is inside the box, throttled to every 2nd or 3rd frame. Idle-pose changes and ripe bob must be ignored or the saving disappears. Also stop tier walls and stone steps from casting (139,632 shadow triangles for a wall lip about 0.10 m high, whose shadow is about 0.07 m long).

**Expected benefit (estimate).** Most of the measured 20% GPU saving in quiet moments, less when a crew is walking inside the shadow box. Walls and steps are a further fixed reduction.

**Risks.** Character shadows update at 20 to 30 Hz, and a slight step may be visible. `renderer.shadowMap` is global across scenes, so restore it when leaving play. Growth scale changes need a slow periodic refresh. Removing wall casting loses a small shadow in the ramp and stair cuttings.

**Verify.** Count shadow renders per second idle and with a crew. Screenshot comparison while panning, placing a building and planting.

## 3. Region switching leaks the previous farm

**Location.** `src/features/realm/plots.js:593` (listener), `:707-716` (dispose); `src/features/realm/avatar.js:135`; `src/features/realm/index.js:1762-1785`. [F-01, F-02, F-06, F-08, F-09, RA-14]

**Current implementation.** `onQuality(...)` at `plots.js:593` discards its unsubscribe function, so a module-level Set keeps each realm alive through the closure. The player GLB is detached before `disposeScene` runs and is never freed. The PMREM environment target and most world InstancedMeshes are not disposed.

**Why it is expensive.** Every region change permanently adds a full realm's JS graph plus GPU resources. On a phone this is expected to end in a WebGL context loss or a tab kill (not measured).

**Evidence.** Measured over 12 switches: heap 212 MB to 752 MB with no recovery. Each round trip adds about 20 geometries, 19 textures and 90 to 100 MB of heap. Atlas open and close is clean. The cause comes from code reading and was verified by a second reviewer, but no heap retainer trace was taken.

**Proposed solution.** Keep the unsubscribe and call it in `plots.dispose`. Dispose the character in `avatar.dispose`. Dispose the PMREM target and per-realm instanced meshes. Do not dispose cached shared GLBs, which are correctly kept to avoid re-uploads.

**Expected benefit (estimate).** Heap and `renderer.info` return to a stable band across switches.

**Risks.** Low. The disposal must not free textures shared through the model cache.

**Verify.** Repeat the 12-switch test and require the same-region values to stop rising. A heap snapshot should show one realm scene retained.

## 4. Full-rate rendering when nothing needs it

**Location.** `src/app/game.js:90`, `:412-443`; `src/features/hud/staff-modal.js` (`covering`); `src/features/hud/tree-viewer.js:59-62, 83`. [RA-2, RA-6, CPU-15]

**Current implementation.** `frame()` runs simulation, HUD and a full render on every display refresh in every mode. The world still renders behind the full-screen staff modal, and alongside the tree viewer's second loop.

**Why it is expensive.** A farming game spends much of its time waiting. The idle farm pays the same as active play. Measured idle and active captures have the same draw and triangle counts. On a 120 Hz display the work doubles for no gameplay gain.

**Evidence.** Measured: 530 to 545 draws and 4.7M triangles in an idle farm, one render per rAF. rAF callbacks take about 35 to 37% of each second in the cleanest captures at 73 to 75 FPS, and 82 to 84.5% in the two traces (Baseline section 6). The code has no gate or idle concept. Fully on-demand rendering is not viable because wind, water, particles and idle animation change each frame.

**Proposed solution.** Add a frame gate with a drift-corrected accumulator (`lastDrawn += target`), target 60 FPS, dropping to 30 FPS after 3 to 5 s without input, player or camera motion. Skip `renderer.render` but keep `realm.update` while a modal fully covers the world. Keep accumulating `dt` so game timing is unchanged.

**Expected benefit (estimate).** 50% fewer frames on 120 Hz at all times, and 50% fewer while idle on 60 Hz. Actual power and heat must be measured on a device.

**Risks.** Wind and particles are less smooth at 30 FPS when idle. A naive gate draws at 45 FPS on 90 Hz and 48 FPS on 144 Hz, which is why the accumulator matters. `watchFrame` must ignore capped frames. The first input must wake the loop immediately.

**Verify.** Check frame rate per state and that `plantedAt`-based growth, crew throughput and the economy sim are unchanged. Power comparison per the test plan.

## 5. Phone resolution default and blind auto-quality

**Location.** `src/shared/vfx/index.js:7, 23`; `src/state/progress.js:91`; `src/app/game.js:79-87`; `src/ui/settings.js:145-153`. [RA-3, RA-4, RA-5]

**Current implementation.** Phones default to `high`, DPR 2, MSAA (`antialias: true`, 4 samples on M1, unmeasured on phones). Auto-quality counts only frames over 40 ms, so a steady 26 to 59 FPS never triggers it. It only steps down and has no resolution-only step.

**Why it is expensive.** Fragment work scales with pixel count, and a 390x844 phone at DPR 2 shades 1.32 MP versus 0.74 MP at 1.5.

**Evidence.** Measured: auto-quality stayed on `high` at 42.7 FPS under phone emulation. Not measured: real phone fill cost. No A/B varied resolution on the M1. The 1.32 MP and 0.96 MP captures differ in shadow-map size and machine state, and timer-query GPU time excludes the MSAA resolve, so whether even the M1 is fill-limited is unknown.

**Proposed solution.** Add a dynamic resolution ladder (2, 1.75, 1.5, 1.25, 1) before any feature loss, and a smoothed frame-time judge with hysteresis and a cautious step-up.

**Expected benefit (estimate).** Up to 44% fewer shaded pixels at DPR 1.5. Whether that helps depends on whether the phone is fill-limited.

**Risks.** Softer leaves and sprites. Frequent buffer reallocation if the judge oscillates.

**Verify.** A/B on real iPhone and Android devices at each DPR, with thermal behaviour over at least 10 minutes.

## 6. Each dispatch clones the save and resyncs the world

**Location.** `src/core/game.js:2863`; `src/core/state.js:789`; `src/features/realm/index.js:409-441`; `src/features/realm/plots.js:465-543, 532`; `src/features/hud/index.js:288-302`; `src/core/derive.js:213-225, 675-696`. [CPU-1, CPU-2, CPU-3, CPU-5, CPU-4]

**Current implementation.** `structuredClone` of the whole save per action, which also discards region memos. Non-quiet actions then run `syncAll`, including `plotGrowMs` per plot and a full bed rewrite. The HUD repaints with no quiet filter.

**Why it is expensive.** Each dispatch is one synchronous spike. It scales with save size, plot count and staff count.

**Evidence.** Measured: 1.0 to 7.3 ms per dispatch at 0.2 to 4.1 per second in the late game, and 16 to 23 ms for `build/place`. At 4x slowdown these spikes would be proportionally longer. In one of three traces `derive.js` and `realm/index.js` together took 15.5% of the main thread, with `canStand`, `roadOpen` and `farmViewBounds` among the top functions. Their own share was not recorded.

**Proposed solution.** Add `staff/workDone` to the quiet list. Coalesce `syncAll` and HUD repaint once per frame (HUD at 100 to 200 ms). Replace `structuredClone` with a plain recursive clone first, then scope clones per action. Add an allocation-free `occupantAt` and memoize layout-pure lookups.

**Expected benefit (estimate).** Fewer and shorter main-thread spikes, largest with big crews.

**Risks.** Handlers writing into shared subtrees. Deferred sync can lag gameplay state by a frame, and `plots.onPlanted` depends on the sync having run, so those events must flush immediately. Economy results must be identical.

**Verify.** Reducer output comparison against the current clone with a dev-only deep freeze. Run `npm run sim` and compare results. Compare dispatch timing via the profiler.

## 7. Crew draw calls and label canvases

**Location.** `src/characters/gedeo-worker.js:62, 84-89`; `src/features/realm/staff.js:279, 390-406`; `src/features/realm/util.js:123-137`; `src/features/realm/animals.js`. [ACE-1, ACE-2, ACE-3, ACE-4, CPU-7]

**Current implementation.** Workers are 2 SkinnedMeshes with 2 cloned skeletons sharing one material. Robots are 6 to 10 separately drawn parts. Every unit has a 384x384 canvas sprite for a 54 px label, redrawn and re-uploaded on status change.

**Why it is expensive.** Each drawn worker costs two draws and two skeleton uploads for one visible body, each robot costs 6 to 10 draws, and every status change re-uploads a 384x384 texture (about 786 KB with mips) for a 54 px label.

**Evidence.** Measured: 54 skinned meshes, 935 bones, 138 sprites with 40 staff. Static estimate: 47 MB of GPU memory and 35 MB of canvas at 60 units.

**Proposed solution.** Merge or share the worker skeleton. Export robots as rigid-skinned meshes per material. Cache labels by text, tone and fee in a shared pool.

**Expected benefit (estimate).** Up to 22 fewer main draws and 22 fewer skeleton uploads at the drawn limit for workers. Label memory falls from tens of MB to a few MB.

**Risks.** Attribute mismatch on merge. Shared label textures must not be disposed per unit. The i18n language switch must flush the cache.

**Verify.** Draw-call count at 22 drawn workers and robots. Visual check of labels and tools.

## 8. Texture memory and wasted loading

**Location.** `src/shared/three/models.js:7`; `src/shared/three/gedeo-vegetation.js:68-78`; `src/features/realm/index.js:69, 149-152`; `src/features/realm/scenery.js:133-157`; `src/app/game.js:357-359`; `src/features/hud/model-icons.js:8-35`. [TEX-01, TEX-03, TEX-04, TEX-05, TEX-06, TEX-09, RA-8]

**Current implementation.** Same images are embedded in many GLBs and decoded before dedupe. ImageBitmaps are retained after upload. Café models load although `CAFE_ENABLED` is false. Hidden homestead and outbuildings are loaded and uploaded. The icon renderer keeps a second GL context.

**Why it is expensive.** Images are fetched and decoded and then discarded by dedupe, decoded bitmaps stay in CPU RAM beside their GPU copies, and every texture is uncompressed RGBA8 on the GPU.

**Evidence (estimates, Baseline section 4.1).** About 225 MB scene textures late game. About 2.58 MB of café downloads and 40 MB of bitmaps. About 27 to 29 MB GPU for hidden buildings. KTX2 would reduce the 144 MB boot texture set to about 24 to 36 MB.

**Proposed solution.** Filter café models while the café is off. Skip hidden groups. Dispose the icon context after its queue drains. Then pilot KTX2 on terrain and a few heavy shared textures.

**Expected benefit (estimate).** About 2.58 MB less download, 40 MB fewer bitmaps and 27 to 29 MB less GPU memory from the filters. The KTX2 pilot is unquantified until built. No FPS gain expected.

**Risks.** KTX2 needs an art review for foliage and gradients, and adds an encoder to the pipeline. The café filter must be removed when the café returns.

**Verify.** `renderer.info`, resource list and download size. Art review of a KTX2 pilot.

## 9. Render submission volume on the main thread

**Location.** `src/features/realm/mountain-dressing.js:93-107`; `src/features/realm/map-fence.js`; `src/features/realm/plots.js:400`; three.js `projectObject` and `renderObject`. [G7, G14, TERRAIN-05, TERRAIN-10, RA-12, ACE-5]

**Current implementation.** 3,216 scene nodes and 636 materials. Stream tiles (13 clones, 8 draws each), fence gates (13 draws each), and per-frame world matrix updates for static objects.

**Why it is expensive.** Every node is traversed and frustum-tested and every draw issues state changes and a WebGL call on the main thread, so the cost scales with node and draw count and not with GPU speed.

**Evidence.** Measured: three.js code is 38 to 48% of the main thread, render submit is about 3 to 9.4 ms per frame on M1, and 11.7 ms at 4x CPU, which is the largest piece of the frame in phone emulation.

**Proposed solution.** Reduce draws through bottlenecks 1, 2 and 7 first. Then merge stream, fence and gate clones, and set `matrixAutoUpdate = false` on static groups.

**Expected benefit (estimate).** Most of the reduction comes from bottlenecks 1, 2 and 7. Freezing shadows cut Submit by 0.7 ms on M1 (measured). The merges remove up to 104 stream draws and most of the 13 draws per gate. Phone gain is unknown.

**Risks.** Merging can affect frustum culling on large groups. Static matrices must be refreshed on layout change.

**Verify.** Render-submit time for merges, and `perFrameMs.matrixWorld` plus `mainThreadMs.update` for static matrices, under 4x CPU throttle, plus draw-call counts.

## 10. Load spikes and first-seen hitches

**Location.** `src/app/game.js:330-333, 353-365`; `src/features/realm/index.js:149-152`. [TEX-10, TEX-13, RA-13, TERRAIN-13]

**Current implementation.** `compileAsync` and `warmUpGPU` run once behind the loading screen for what is in the scene at boot, in one synchronous task. Buildings not yet placed are not warmed, and models load in a three-stage waterfall.

**Why it is expensive.** Shader compilation and first upload block the main thread, so any first-seen variant stalls a frame during play.

**Evidence.** Measured: 8 to 9 long tasks during load totalling 1.8 to 2.1 s, up to 833 ms; 1,078 ms under 4x CPU. A 597 ms long task appeared while panning a starter farm as `programs` rose by one, and placing buildings raised `programs` by 3. Causation is likely but not proven.

**Proposed solution.** Warm up the shader variants used by placeable buildings. Split warm-up uploads across frames behind the loading screen. Fix load order so café and hidden content does not delay the farm.

**Expected benefit (estimate).** Removes first-placement compile hitches if the `programs` correlation is causal. The load-time change is not quantified.

**Risks.** A longer loading screen if warm-up is overdone.

**Verify.** Long-task count during load and on first placement of each building.

## Findings not in the top 10, and why

| Finding | Why it is not top 10 |
|---|---|
| Off-screen forest and scatter (TERRAIN-01, G1, G2) | Review rated P0, but a measured A/B on M1 showed no GPU saving. Re-test on phones, where it is a cheap fix if it helps. |
| Pathfinding (CPU-6, CPU-8) | Under 0.1% of main thread in traces. |
| Animation mixers (ACE-3, ACE-5, ACE-6) | 0.12 ms per frame on M1 in the idle capture. |
| Saving to localStorage (CPU-4) | 0.14 ms per `setItem` at 0.8 per second, and at most one save every 1.5 s. Stringify cost was not timed separately. |
| Web Workers | Nothing measured justifies the complexity. |
