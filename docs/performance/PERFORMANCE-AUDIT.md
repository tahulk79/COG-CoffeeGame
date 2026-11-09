# Performance audit

Repository audit of the Three.js farm and coffee game, 2026-11-09, branch `feat/auto-farm`. Measurements are in [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md). The ranked problems are in [PERFORMANCE-BOTTLENECKS.md](PERFORMANCE-BOTTLENECKS.md).

Seven subsystem reviews read the code, and two adversarial reviews tried to refute every finding. Priorities below combine those verdicts with the measurements. Line numbers are from the audit snapshot; another session was editing the HUD at the time, so some may have moved.

## 1. Performance architecture today

**Stack.** Vanilla JavaScript, three.js 0.185, Vite. One bundle chunk for three, dynamic imports per screen. No React. No postprocessing.

**Renderer** (`src/app/game.js:497`). One `WebGLRenderer` with `antialias: true`, `powerPreference: 'high-performance'`, three's defaults for the other context attributes (`preserveDrawingBuffer` false), context-loss handling, PCF shadows, sRGB output, and ACES tone mapping at exposure 0.95 compiled inline. `high-performance` selects the fast GPU on dual-GPU machines. Its energy effect was not measured. Default quality is `high`. Pixel ratio is capped at 1, 1.5 or 2 by quality (`src/shared/vfx/index.js:5-7`).

**Loop** (`game.js:412-443`). One `setAnimationLoop`. In `play` it runs `realm.update`, `hud.update`, `watchFrame`, then `renderer.render`, on every display refresh with no cap. It stops when the tab is hidden (`game.js:90, 560`). While the atlas is open, the realm is neither updated nor rendered.

**Extra GL contexts.** The model-icon renderer (`hud/model-icons.js:10`, permanent) and the tree viewer (`hud/tree-viewer.js:59`, created per open, disposed on close).

**World.** One draped ground grid (36,838 tris), instanced whole-map vegetation and walls, cloned cliffs and stream tiles, and placed buildings. The farm is one continuous scene. There is no chunking and no distance LOD in use.

**Coffee** (`realm/plots.js:383-405`). 13 InstancedMesh parts, each sized to the full slot count with `frustumCulled = false`. Parts a tree does not show are written as zero-scale instances, which still cost vertex work.

**Characters.** Each dressed unit owns a mixer driven from `onBeforeRender`, so off-screen units do not animate. A 0.5 s LOD pass gives the 8 nearest shadows and draws at most 22 farm units (`realm/staff.js:1350-1361`).

**Simulation.** Variable step, `dt` clamped to 0.1 s (`game.js:413`). Crew jobs dispatch store actions. Each dispatch runs `structuredClone` on the whole save (`core/game.js:2872`, `core/state.js:789`), then a synchronous realm `syncAll` for non-quiet actions and a HUD repaint.

**Persistence.** Debounced JSON save at most every 1.5 s (`core/store.js`).

**Assets.** 156 GLBs on disk, about 45 MB, meshopt geometry and WebP or JPEG textures. A late-game farm requests 94 GLBs and holds 188 scene textures. There is no KTX2. Textures are deduplicated at runtime by image name after the bytes have already been decoded.

## 2. What already works

Keep these. Do not spend time redoing them.

- No postprocessing passes, and one light rig with a single shadow light.
- The render loop stops on hidden tabs.
- Forest, shrubs and scatter already use instancing, far LODs, and no shadows.
- Staff animation LOD and shadow LOD exist, and off-screen units skip their mixers.
- Particles are pooled GPU points with per-quality budgets. Empty kinds submit nothing.
- Object raycasts happen on tap only. The profiler counted 0 per second while idle and panning.
- Atlas open and close is leak-free (measured).
- HUD writes are guarded, and most timers are gated at 0.2 to 0.5 s.
- Water is a UV scroll with no reflection pass, and camera `far` and fog are not real costs.

## 3. Findings by area

### Rendering

Coverage: renderer settings, pixel ratio, MSAA, shadows, tone mapping, render targets, render loop, hidden and covered states.

The dominant costs are the shadow pass, which re-renders every frame with no invalidation, and the fact that an idle farm is drawn at full rate. Fully on-demand rendering is not feasible without visible loss: wind, water, particles, badges and character idle poses all change each frame. A lower idle rate is feasible. Shadows are nearly static because wind does not reach the depth pass.

Tone mapping is inline and cheap. Color management is standard. No render targets are used in play except the shadow map and the one-time PMREM environment.

### Geometry and instancing

Coffee trees dominate. 200 fields submit 1.9M triangles in the main pass and 0.95M of them again in the shadow pass, and no distance LOD exists for them. Vegetation sets are culled as one bounding sphere per set, so they are effectively always submitted.

Forest triangles turned out not to matter on the M1 (baseline section 5). They remain worth re-testing on phones because they are simple to reduce.

### Textures

Estimated GPU texture memory is about 190 to 225 MB at the farm, based on image dimensions. The largest waste is decoding the same embedded image many times before name-based dedupe discards the copies, retaining an `ImageBitmap` after upload, café models loaded while the café is disabled, and hidden buildings that are loaded and uploaded.

KTX2 is feasible and is the largest available GPU memory reduction, but it needs an art check and a new encoder in the pipeline.

Filtering: GLB textures keep default mipmaps and anisotropy 1, ground textures use anisotropy 8 at every tier (TEX-15, no real cost found), and the smoke flipbook disables mipmaps correctly. Foliage is opaque or alpha-test and `tuneMaterials` keeps it out of the blended pass (`gedeo-vegetation.js:87`), so overdraw comes from a small group: 28 transparent meshes late game, mainly field halos, mulch rings, roads and water. Normal maps are on 80 of the 192 materials in farm GLBs, metallic-roughness maps on 1 and occlusion on none. Normal maps on small props are candidates for removal only after an art check.

**Bug found:** name-only texture dedupe makes tier walls render the warehouse flagstone instead of their own rock (`shared/three/gedeo-vegetation.js:68-78`, TEX-02). Fixing it changes how the walls look, so it needs an explicit decision.

### Animation and characters

Animation is not a meaningful frame cost on M1 (`AnimationMixer` 0.12 ms per frame with 40 staff). The costs that matter are draw calls and uploads: two skinned meshes per worker, 6 to 10 parts per robot, and a 384x384 canvas per unit for a 54-px label.

### Gameplay simulation and UI

Crew decisions and pathfinding are negligible in the captures. There is no frame-driven dispatch. Dispatches are infrequent but heavy. Each one deep-clones the save, can trigger a whole-realm sync and a full HUD repaint, and discards region memos such as the 186 KB farm tile grid.

In one trace `derive.js` and `realm/index.js` together took 15.5% of the main thread, with `canStand` and `roadOpen` among the top functions. They were 3.3% at file level in a second trace and not hot in a third, so this is state-dependent. Browser style, layout and paint work is modest at about 6% of main-thread time.

Verdict for each remaining system. "Per frame" means it runs every rendered frame.

| System | How it runs | Verdict |
|---|---|---|
| Crop growth | Timestamp-based (`plotGrowMs`), visuals in `plots.update` per frame | Growth logic is independent of frame rate. Cost is covered by bottleneck 1 and P1-2 |
| Economy tick | `clock/tick` every 5 s, accumulated from `dt` | Minor |
| Building production | `buildings.update` and `updateProd` per frame | 0.2% of main thread or less in traces, not run with active production |
| Water and irrigation | Watering is a crew job and `dripCovers` uses a region memo. No fluid simulation exists | Its memo is lost per dispatch and is covered by P1-3 |
| Crew decisions and pathfinding | On-demand, per job | Under 0.1% in traces |
| Listeners | Scoped by AbortController or removed on dispose in the realm, HUD and atlas | Only the quality listener in F-01 leaks |
| Interval timers | Staff modal repaint, one audio drop timer, analytics flush | Minor. The modal repaint is covered by CPU-3 |

### Camera and input

The camera is a custom rig (`realm/camera.js`), not OrbitControls. `update(dt)` eases position and zoom every frame, and shadow and fog follow it. Pointer and wheel listeners are on the canvas (`realm/input.js`) and are removed through one AbortController. Pointer moves do plane math rather than raycasts. No separate camera cost appeared in traces. Camera motion must wake the idle frame gate (P0-2).

### Memory and lifecycle

The region-switch leak is real and measured. The likely cause is a quality listener at `realm/plots.js:593` that is never removed and keeps each previous realm reachable. Related issues are the player GLB (never disposed), the PMREM environment target, and instanced meshes that are not disposed. Input listeners are released by an AbortController (`input.js`), and character mixers are stopped and uncached (`characters/motion.js`). `animals.js` has no dispose. Its mixers are reachable only through the realm, so they should be freed once F-01 is fixed. The repeat of the leak test will confirm that.

### 4-level terrain

The ground is one draped grid, and walls, cliffs and stream are the main terrain costs. Walls and steps put 139,632 triangles into the shadow pass for an almost invisible shadow. Chunking is not recommended. Draw calls are not the terrain problem, and instance compaction would keep the single-draw structure while culling what is off-screen.

## 4. Full finding catalogue

Final priority combines the reviewer verdict with measurement. `none` means advisory only.

97 findings: 6 P0, 30 P1, 58 P2, 3 none.

### Rendering

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| RA-1 | P0 | confirmed with corrections | CPU+GPU | M | Shadow map re-renders every frame with no invalidation, including every farm tree | `src/app/game.js:498` | '0 passes when nothing moves' is not reachable under the stated rule. The avatar idle mixer always animates a caster, and ripe bob changes the tree casters, so… |
| RA-2 | P0 | confirmed with corrections | BATTERY | S | Render loop is uncapped and has no idle rate; true on-demand is infeasible but reduced idle is | `src/app/game.js:90` | Raised: idle load measured, low effort |
| RA-3 | P1 | confirmed with corrections | GPU+MEMORY | S | Phones default to DPR 2 with 4x-class MSAA, the first-order fragment cost | `src/shared/vfx/index.js:7` | Lowered: needs a real phone |
| RA-4 | P1 | confirmed | ALL | S | Auto quality never reacts to a steady 26-59 fps and has no resolution-only rung | `src/app/game.js:79-87` |  |
| RA-5 | P2 | overstated | GPU+MEMORY | S | Antialias cannot be lowered: the 'low' tier still pays MSAA | `src/app/game.js:496-497` | game.js:497 and QUALITY have no antialias field, so the fact is true. settings.js:151 keeps auto step-down session-only and context-loss low is also session-only… |
| RA-6 | P0 | confirmed | CPU+GPU | S | World renders at full rate behind covering modals and alongside the tree viewer's second loop | `src/app/game.js:436-441` |  |
| RA-7 | P1 | confirmed with corrections | GPU | S | Every species' tree and fruit mesh draws all slots via zero-scale instances | `src/features/realm/plots.js:394-400` | Risk is not 'none': per-species counts must include dying trees (plots.js:627-633) and hidden fields. A single liberica (unlocked at level 5, economy.js:127) re-enables… |
| RA-8 | P1 | confirmed with corrections | MEMORY | S | Icon renderer keeps a second WebGL context and its uploaded textures forever | `src/features/hud/model-icons.js:8-16` | The 202.2 MB ceiling ignores name dedupe. Icons use the same deduped Texture objects from the models.js cache, so the upper bound is about 82 MB for farm cards (TEX-07… |
| RA-9 | P1 | confirmed | CPU+GPU | S | Staff list portraits run up to 22 full scene + shadow renders in one task every 30 s | `src/features/realm/index.js:1712-1744` |  |
| RA-10 | P2 | overstated | CPU+GPU | S | One ripe tree re-uploads all 13 instance buffers every frame | `src/features/realm/plots.js:607` | One ripe tree dirties about 1 in 6 frames at 60 fps, not 'every frame' or 'most frames'. Hidden parts are not uploaded because WebGLObjects.update runs only for… |
| RA-11 | P2 | confirmed | GPU | M | Ground fragment shader evaluates 16 sin hashes and 4 colour fetches per pixel | `src/shared/three/farm-textures.js:46-66` |  |
| RA-12 | P2 | confirmed | CPU | S | Static world still recomputes matrices every frame | `node_modules/three/src/core/Object3D.js:1167` |  |
| RA-13 | P2 | overstated | GPU+MEMORY | S | GPU warm-up shades the whole map at full resolution and includes the disabled café | `src/app/game.js:353-365` | It does not shade 'the whole map': culling off adds vertex work, but fragments are limited to the one viewport, so setViewport(1,1) saves about one normal frame behind… |
| RA-14 | P2 | confirmed | MEMORY | S | PMREM environment texture leaks on each realm rebuild | `src/features/realm/index.js:127-128` |  |

### Geometry and instancing

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| G1 | P2 | confirmed | GPU | S | 688 slope trees (517k tris) are almost never inside the camera frustum yet are drawn every frame | `src/features/realm/world.js:982-997` | Lowered: no measured GPU gain on M1, re-test on phone |
| G2 | P2 | confirmed with corrections | GPU | M | Whole-map vegetation sets are culled as single objects: about 4% of submitted scatter/forest tris are in view at mid zoom | `src/shared/three/gedeo-vegetation.js:157-181` | Lowered: no measured GPU gain on M1, re-test on phone |
| G3 | P0 | overstated | GPU | M | Coffee: every slot draws all 13 part meshes including the other species, so 65% of vertex work is zero-scale | `src/features/realm/plots.js:369-379` | Raised: largest measured GPU cost |
| G4 | P1 | confirmed | GPU | M | No LOD for coffee trees: 2048-leaf-tri crown stays full detail down to sub-pixel triangles at far zoom | `src/features/realm/index.js:64-66` |  |
| G5 | P2 | confirmed with corrections | CPU+GPU | S | Ripe-tree bob re-uploads every part's full instance capacity almost every frame | `src/features/realm/plots.js:607` | The CPU cost is 13 multiplies per tree per write (about 10 Hz), not per frame. Six ripe trees dirty about 63% of frames (1-e^-1), not 'nearly every'. Hidden parts are… |
| G6 | P1 | confirmed with corrections | GPU | M | Shadow pass redraws all coffee slots of both species and all walls every frame, while the shadow box covers a fraction of the farm | `src/features/realm/plots.js:398-400` | Box coverage figures are lattice estimates. A sun-tilted box has about 1.2x the ground footprint of its cross-section, so treat 14/21/60% as approximate. |
| G7 | P2 | overstated | CPU+GPU | S | Stream is 13 cloned 8-primitive tiles (104 draw calls); cliffs and signs are also cloned | `src/features/realm/mountain-dressing.js:22` | The proposal as written (one instance set) submits all 133k stream tris in every view, which worsens the common case by losing tile culling. Instancing needs segments,… |
| G8 | P2 | overstated | GPU | S | Player-placed shade trees are cloned LOD1 meshes with shadows and no LOD or instancing | `src/features/realm/buildings.js:219-221` | Clones are frustum-culled per mesh, so '10 cordia = 100k main tris' applies only if all are in view. Limit 99 is effectively unreachable with costGrowth 1.2 from 110… |
| G9 | P2 | confirmed with corrections | GPU | S | Each field spends 1,066 tris on ground beneath the tree | `src/features/realm/index.js:67` | Vertex-only saving of about 225k tris at N=250, a small share next to G1-G3. Fragment overdraw of ring and halo is the larger issue (see TERRAIN-09). |
| G10 | P2 | confirmed with corrections | GPU | S | Halo decals use a stale bounding sphere: instanced decals can vanish or never cull correctly | `src/features/realm/plots.js:174-183` | Worse than stated on a save with 0 fields at first frame: the sphere is empty (radius -1), so halos draw only while the world origin is inside the frustum. One-line fix. |
| G11 | P2 | confirmed | GPU | S | Quality step-down does not reduce vegetation already built | `src/features/realm/world.js:869-870` |  |
| G12 | P2 | confirmed | CPU+MEMORY | S | Unused LOD files, hidden homestead and a second parse cache add load and heap cost | `src/shared/three/gedeo-vegetation.js:129-132` |  |
| G13 | none | overstated | CPU | S | About 23 permanently empty InstancedMeshes still enter render and shadow lists | `src/features/realm/plots.js:206-238` | The 7 procedural fallbacks are set visible=false once the Gedeo set loads (plots.js:40), so they never enter the lists. The rest have an empty sphere (radius -1), which… |
| G14 | P2 | confirmed | CPU+GPU | S | Map and tier fence gates are 13 separate meshes each | `src/features/realm/map-fence.js:28-46` |  |
| G15 | P2 | confirmed with corrections | CPU | S | Field pickers are separate scene nodes with per-frame matrix composition | `src/features/realm/plots.js:484-494` | With matrixAutoUpdate=false, the existing pick.updateMatrixWorld(true) at plots.js:493 will no longer recompose the local matrix on a move. The move path must call… |

### 4-level terrain

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| TERRAIN-01 | P2 | confirmed | GPU | M | 933k tris of background forest are drawn every frame though 90-100% is off-screen | `src/features/realm/world.js:1004` | Lowered: no measured GPU gain on M1, re-test on phone |
| TERRAIN-02 | P2 | overstated | GPU | S | Ground fragment shader runs 16 sin hashes and 5 material lookups on nearly every pixel | `src/shared/three/farm-textures.js:46` | Moving macro noise to vertices samples a 3.7 m noise cell at 1.25 m spacing, which is only about 3 samples per cell and may show visible faceting. |
| TERRAIN-03 | P2 | overstated | GPU | S | Ground is shaded before the Gedeo geometry that later covers it | `src/features/realm/world.js:359` | The claim that ground has a lower material id than coffee is wrong. index.js:150-156 awaits wave 1 before createWorld (index.js:175), so coffee tree and building GLB… |
| TERRAIN-04 | P1 | confirmed | GPU | S | Walls and steps add 139,632 tris to the shadow pass for almost no visible shadow | `src/features/realm/world.js:975` |  |
| TERRAIN-05 | P2 | confirmed with corrections | GPU | S | Stream casts shadows and costs up to 104 draws as 13 separate clones | `src/features/realm/mountain-dressing.js:48` | At spawn this is about 24 shadow draws and 31k tris; 0 tiles are in the colour pass at default turn. Cheap fix, but not P1. |
| TERRAIN-06 | P1 | confirmed with corrections | GPU | M | About 330k tris of wild-land decor and shrubs are drawn map-wide | `src/features/realm/world.js:662` | The counts add every group's capacity, not game start. Rocks around 600 include road border stones hidden until the road opens (world.js decor.farm.rocks.show), and… |
| TERRAIN-07 | P2 | confirmed | GPU+MEMORY | M | Cliff, stair and stream models have no distance LOD | `src/features/realm/mountain-dressing.js:103` |  |
| TERRAIN-08 | P2 | confirmed | GPU | S | LOD3 tree triangles are mostly bark that is not readable at distance | `src/features/realm/world.js:872` |  |
| TERRAIN-09 | P1 | confirmed with corrections | GPU | S | Field halos are stacked transparent PBR decals with normal maps | `src/features/realm/plots.js:169` | Understated. The 1.91 layers uses the retired 3x2 pre-tilled layout. autoTill is retired (game.js:844) and fields are placed freely with a 1 m footprint (FIELD size .5… |
| TERRAIN-10 | P2 | confirmed | CPU+GPU | S | Each fence gate costs 13 draws and is not merged | `src/features/realm/map-fence.js:28` |  |
| TERRAIN-11 | P2 | confirmed | GPU | S | Ground apron uses play-area resolution outside the map | `src/features/realm/world.js:182` |  |
| TERRAIN-12 | P2 | confirmed | GPU | S | Environment density ignores runtime quality changes | `src/features/realm/world.js:868` |  |
| TERRAIN-13 | P2 | confirmed with corrections | MEMORY | S | Invisible farm lot sign textures are uploaded during warm-up | `src/features/realm/world.js:508` | makeLabel('') sets the canvas to 96x96 (util.js set, w=max(96,...)), not 300x96. Only estate seed lots and frontier lots get real text, so the total is about 2-3 MB… |

### Textures and loading

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| TEX-01 | P1 | overstated | CPU+MEMORY | M | Duplicate embedded textures are fully fetched and decoded before being thrown away: 150 extra decodes, about 213 MB of transient bitmaps | `src/shared/three/gedeo-vegetation.js:70-78` | The -70 MB is only a wave-1 snapshot. Name dedupe still ends at about 155 MB retained, and the true session peak is at warm-up (retained bitmaps + GPU upload), after… |
| TEX-02 | P1 | confirmed with corrections | GPU+MEMORY | S | Name-only dedupe merges different images: tier walls render the warehouse flagstone instead of their own rock | `src/shared/three/gedeo-vegetation.js:73-76` | N_stone also collides (21,618 vs 23,038 bytes). T_ww_lawn is 248,636 in stone-steps/stream/cliff versus 17,362 in stone-pond, so that winner depends on load order. |
| TEX-03 | P1 | confirmed | MEMORY | L | Every decoded ImageBitmap is retained after GPU upload: about 155 MB of CPU RAM doubling the textures | `src/shared/three/dispose-scene.js:15-20` |  |
| TEX-04 | P1 | confirmed | GPU+MEMORY | L | KTX2 is feasible and is the largest single VRAM win available: 144 MB drops to about 24-36 MB | `src/shared/three/models.js:7` |  |
| TEX-05 | P1 | confirmed | CPU+MEMORY | S | Boot awaits café-only models while the café is disabled: 2.58 MB download and 40 MB of bitmaps | `src/features/realm/index.js:149-152` |  |
| TEX-06 | P1 | confirmed | GPU+MEMORY | S | Hidden homestead and outbuildings are loaded and uploaded though never shown | `src/features/realm/scenery.js:133-147` |  |
| TEX-07 | P1 | confirmed | GPU+MEMORY | S | Model icons keep a second WebGL context alive holding its own full copies of every icon's textures | `src/features/hud/model-icons.js:8-16` |  |
| TEX-08 | P2 | confirmed with corrections | CPU+MEMORY | S | loadPlant fetches every LOD although each caller uses one: LOD0 of three species is never displayed | `src/shared/three/gedeo-vegetation.js:129-132` | A one-time 10% download and decode saving is P2, the same severity G12 gives it. |
| TEX-09 | P1 | confirmed with corrections | GPU+MEMORY | S | Player textures are 2048px for a character 150-340 px tall on the farm | `src/characters/load-player.js:5-8` | Camera numbers are wrong. baseDist omits FARM_SCALE 1.55 and the lens ratio: default is 32.9 m, not 26 m (about 60 px/m, character about 120 px). Normal closest is zoom… |
| TEX-10 | P2 | overstated | CPU+GPU | S | warmUpGPU uploads everything in one synchronous task | `src/app/game.js:353-365` | game.js:353-365 is synchronous, but it happens behind the loading screen, so the effect is a frozen progress animation only. No gameplay hitch, and no memory change by… |
| TEX-11 | P2 | confirmed with corrections | CPU+MEMORY | M | The same image bytes ship in many GLBs: 4.65 MB of the realm download is duplicate texture data | `scripts/shrink-textures.mjs:19-23` | First-load bytes only, needs M work, overlaps 2.2 MB with other removals and depends on unknown HTTP/2 hosting. P1 is not justified. |
| TEX-12 | P2 | confirmed | CPU+MEMORY | M | Same URLs are parsed twice through separate caches | `src/shared/three/models.js:9,26` |  |
| TEX-13 | P2 | confirmed | CPU | M | Load order is a three-stage waterfall with nothing prioritised | `src/features/realm/index.js:150-152` |  |
| TEX-14 | P2 | confirmed with corrections | GPU+MEMORY | S | Not-yet-processed props: cafe/roaster use 1024 JPEG base and normal; farm/landscape-parts bypass dedupe | `scripts/shrink-textures.mjs:20-21` | The landscape-parts materials are never rendered: partGeo (plots.js:140) takes only geometry and uses farmMaterial. There is no GPU copy, so -6.6 MB GPU is wrong. All 4… |
| TEX-15 | none | overstated | GPU | S | Ground textures use anisotropy 8 at every quality tier | `src/shared/three/farm-textures.js:16` | farm-textures.js:16. The auditor's own 2.8:1 maximum anisotropy means a cap of 4 changes nothing and a cap of 2 saves at most about one probe at the top of the screen,… |

### Animation and characters

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| ACE-1 | P1 | confirmed with corrections | CPU+GPU | S | Each Gedeo worker is 2 SkinnedMeshes with 2 cloned Skeletons, though both share one material and one skin | `src/characters/gedeo-worker.js:13-14` | Saving applies only to workers actually drawn. 22 is the LOD ceiling, and frustum-culled workers already pay nothing. No KHR_mesh_quantization in the file, so that… |
| ACE-2 | P1 | confirmed with corrections | CPU+GPU | M | Robots are 6-10 separately drawn rigid parts, the largest character draw-call source | `src/characters/gedeo-worker.js:84-89` | The +2 tier parts appear only when battery tier > 0 (pack) and motor tier > 0 (ring), staff.js:412-413; a stock robot adds 0. The tag draws only when ICON[shown] is set… |
| ACE-3 | P2 | confirmed with corrections | CPU+GPU | S | Animal mixers run every frame on or off screen, with no LOD and all animals casting shadows | `src/features/realm/animals.js:37-44` | All figures are for the absolute limit: 45 animals of every species, plus barns to house them. Cost scales with animals owned, which is usually far fewer. |
| ACE-4 | P1 | confirmed with corrections | GPU+MEMORY | S | A 384x384 canvas and texture per unit for a 54-px status pill, re-uploaded on every status change | `src/features/realm/staff.js:279` | The auditor's open question resolves to yes: createRealm ends with syncAll (index.js:1793) before warmUpGPU (game.js:357-360), so every hired unit's label, hidden or… |
| ACE-5 | P2 | overstated | CPU | S | Scene-graph matrix recomposition continues for undrawn staff, hidden stand-in blocks, and bones | `src/features/realm/staff.js:1359` | 1860 of 2520 applies only at 60 hires (Lv60+). At the 30 cap it is 600 of 1260, and the summary's -560 is inconsistent with its own 600. Hidden stand-ins exist only on… |
| ACE-6 | P2 | confirmed with corrections | CPU | S | About 65% of animation tracks evaluated are constant translation and scale channels | `src/characters/gedeo-worker.js:13-19` | Decoding confirms: across all 9 picker clips T is constant on 16/17 joints and S on 17/17, leaving 18/51 tracks. Cow leaves 20/57, chicken 13/36. The 2877 total needs… |
| ACE-7 | P2 | confirmed | CPU+GPU | S | animEvery throttles the mixer but not Skeleton.update or bone-texture upload | `src/characters/gedeo-worker.js:71` |  |
| ACE-8 | P2 | confirmed | ALL | M | dressPerson rigs are never culled, never LOD'd, and run per-frame arm IK (latent: café disabled today) | `src/characters/load-player.js:25` |  |
| ACE-9 | P2 | overstated | CPU | S | Animals and dressPerson bypass dressQueue, and undressed stand-ins draw 11-13 calls each while queued | `src/features/realm/animals.js:33-45` | The burst and the 60-rAF dress-in happen at the first syncAll, during enterPlay's loading screen (game.js:320-331: whenLoaded, compileAsync, warmUpGPU), while the… |
| ACE-10 | P2 | confirmed with corrections | GPU | S | VFX: 6 separate dynamic attributes per active kind, and large flipbook point sprites at DPR 2 | `src/shared/vfx/index.js:128-129` | Upload half is negligible: 12 tiny ranged bufferSubData per frame (addUpdateRange, vfx/index.js:258). Portrait base distance is about 26 m (camera.js:77), so minimum… |
| ACE-11 | P2 | confirmed with corrections | CPU | S | LOD ranks count bench units and ignore the frustum, wasting draw slots | `src/features/realm/staff.js:1353-1356` | Slots are wasted only when total farm units exceed 22. Below that every unit is drawn regardless of rank. |
| ACE-12 | P2 | confirmed with corrections | MEMORY | S | Player rig carries 2048 px textures, about 89 times a staff worker's texture memory | `src/characters/load-player.js:5-9` | Textures are 2048 + 1024, not two at 2048. 26.7 MiB = (2048^2 + 1024^2) x 4 x 4/3; two at 2048 would be 42.7. One-step downscale gives 6.7 MiB, so -20 MiB stands. |

### Simulation and UI

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| CPU-1 | P1 | confirmed with corrections | CPU+MEMORY | M | Every dispatch deep-clones the whole save with structuredClone | `src/core/game.js:2863` | Lowered: 1 to 7 ms per dispatch at 4/s or less on M1 |
| CPU-2 | P1 | confirmed with corrections | CPU+GPU | M | Non-quiet dispatches re-sync the whole realm, and plots.sync rewrites and re-uploads instance buffers each time | `src/features/realm/index.js:409-412` | Count-0 mesh uploads (269 KB) occur only if the empty bounding sphere (centre 0,0,0, radius -1) passes the frustum, i.e. the world origin is at least 1 m inside it.… |
| CPU-3 | P1 | confirmed | CPU+MEMORY | S | HUD repaints everything on every dispatch; an open staff modal rebuilds its full DOM tree each time | `src/features/hud/index.js:288-302` |  |
| CPU-4 | P2 | confirmed | CPU | M | Each save does stringify plus getItem plus two full setItem calls on the main thread, every 1.5 s during play | `src/core/store.js:53-62` | Lowered: setItem about 0.14 ms in the idle capture; stringify untimed |
| CPU-5 | P1 | confirmed with corrections | CPU+MEMORY | S | farmTiles grid and other region memos are rebuilt after each dispatch; tileAt allocates per call on per-frame paths | `src/core/derive.js:213-225` | 1.7-2.6 MB/s is a ceiling that pairs a fully busy crew's dispatch rate with idle wandering units; those two are partly exclusive. Rebuild needs a tileAt after each… |
| CPU-6 | P2 | overstated | CPU | M | A* has no effective cap on the farm grid, no cache, and an O(cells squared) string-pull | `src/features/realm/nav.js:33` | Pathfinding under 0.1% in traces |
| CPU-7 | P1 | confirmed with corrections | GPU+MEMORY | M | Every job transition redraws a 384x384 canvas tag and re-uploads it | `src/features/realm/staff.js:279` | Duplicate of ACE-4; report once. 786 KB with mips, not 784. A clear redraw is uploaded only if the sprite is drawn again, and sprite.visible goes false, so about one… |
| CPU-8 | P2 | overstated | CPU | M | Crew job search scales as thinkers x plots x busy units with string keys per plot | `src/features/realm/staff.js:381` | Each worker has one trade, so one claim-keyed filter runs per think (rarely two). That is about 5,800 keyed visits/s at 30 idle units on 240 plots, not 17-24k. near()'s… |
| CPU-9 | P1 | confirmed with corrections | CPU+GPU | M | Ripe-tree bob dirties and re-uploads every tree instance buffer almost every frame | `src/features/realm/plots.js:607` | SCALE_MAX is .65, so bob is about 5.2 quantized steps each way and about 10 changes/s per ripe tree, not 8 and 15; roughly 6+ ripe trees make most frames dirty. Upload… |
| CPU-10 | P2 | confirmed | CPU | S | collectAlerts computes rings and clusters whose results are thrown away | `src/features/realm/index.js:1233-1239` |  |
| CPU-11 | P2 | confirmed with corrections | CPU | S | Per-frame HUD: forced layout in field-pop, unconditional strings, and layout polling | `src/features/hud/field-pop.js:109-117` | offsetWidth forces layout only if layout is dirty. Transform and opacity writes do not dirty layout, so most frames are a cheap read; real forced layouts follow… |
| CPU-12 | P2 | confirmed with corrections | CPU | S | Per-frame costs on LOD-culled units and small per-unit allocations | `src/features/realm/staff.js:526-534` | cafeStaffed in syncArea is unreachable in normal play today, because leaveCafe sends café regions back to the map while CAFE_ENABLED is false. |
| CPU-13 | P2 | confirmed with corrections | CPU | S | A reward chip and DOM rect read for every crew harvest, including off-screen ones | `src/features/realm/index.js:424` | Once the chip cap is reached the aggregate path returns before the rect read and DOM creation, so sustained cost is bounded by cap/0.85 s (about 9 chips/s on high). |
| CPU-14 | P2 | confirmed with corrections | CPU | S | gm/think does a full planning pass inside one dispatch, including regenerating static candidate grids | `src/core/game.js:2274-2297` | Conditional. gm/think exits early with no GM, on strike, in advisor mode or with auto off. gmFieldSpots returns before building the grid on buildError, an overloaded… |
| CPU-15 | P2 | confirmed | BATTERY | S | The 3D world renders at full rate behind the staff modal on phones | `src/app/game.js:436-440` |  |
| CPU-16 | none | confirmed with corrections | CPU | S | Throttle and fixed-step map: what is safe and what would change the economy | `src/app/game.js:413` | Advisory, not a cost. Listing syncAll as identical-result is too strong: staff.sync updates e.u and applyState (bench, stop, job release), so deferral lags gameplay… |

### Memory and lifecycle

| ID | Final | Reviewer | Resource | Effort | Finding | Location | Note |
|---|---|---|---|---|---|---|---|
| F-01 | P0 | confirmed with corrections | ALL | S | Unremoved quality listener keeps every previous realm alive after a region change | `src/features/realm/plots.js:593` | Raised: leak measured |
| F-02 | P0 | confirmed with corrections | GPU+MEMORY | S | Player GLB is detached before disposeScene, so its textures, geometry and bitmaps are never freed | `src/features/realm/avatar.js:135` | Raised: leak measured |
| F-03 | P1 | confirmed with corrections | GPU+MEMORY | S | Model-icon context is permanent and holds a second copy of catalog textures | `src/features/hud/model-icons.js:7-16` | 110 MiB needs café models requested while CAFE_ENABLED is false. 77 MiB is a ceiling reached only if every Build tab and model is opened; only requested icons upload. |
| F-04 | P1 | confirmed with corrections | CPU+MEMORY | M | Every building model, including disabled café models, is decoded and retained at realm start | `src/features/realm/index.js:149-154` | Excluding all cafe/* also removes cafe/props.glb#cup (EXTRA_MODELS, index.js:69), used by staff makeCup; it has a fallback but the risk note omits it. MiB figures not… |
| F-05 | P1 | confirmed with corrections | GPU+MEMORY | S | Permanently hidden homestead and outbuildings still load and upload textures | `src/features/realm/scenery.js:135-136` | The saving is VRAM only while building templates still load the same named textures; bitmaps largely remain until F-04 step 2. |
| F-06 | P2 | confirmed with corrections | GPU+MEMORY | S | Scene PMREM environment render target is never disposed | `src/features/realm/index.js:127` | Size is right but it is a fixed 6 MiB per region change. |
| F-07 | P2 | overstated | MEMORY | L | All uploaded textures remain as full CPU ImageBitmaps too | `src/shared/three/models.js:9` | 157/118 MiB double-counts what F-04 and F-05 remove. Whether bitmaps count against the tab is unknown, and the fix is L with context-loss regression risk. |
| F-08 | P2 | confirmed | GPU+MEMORY | S | Most world InstancedMeshes never call dispose and leak VAOs and instance arrays | `src/shared/three/dispose-scene.js:27-35` |  |
| F-09 | P2 | confirmed | GPU+MEMORY | M | Final disposeScene no longer sees module groups, leaving per-realm resources undisposed | `src/features/realm/index.js:1785` |  |
| F-10 | P2 | confirmed | CPU+MEMORY | M | Tree viewer creates a new context each open and leaves dead renderer listeners | `src/features/hud/tree-viewer.js:21` |  |
| F-11 | P2 | confirmed | MEMORY | S | Heaven intro and teacher GLBs stay cached after the story ends | `src/app/game.js:25` |  |
| F-12 | P2 | confirmed with corrections | CPU+MEMORY | S | loadPlant parses every LOD even when callers use only one | `src/shared/three/gedeo-vegetation.js:129-132` | Index estimate uses 12 B per triangle (32-bit). Each LOD0 is under 65k verts, so with 16-bit indices it is about 0.44 MB; total about 2.8 MB. |

### Issues the reviewers added

- src/features/realm/index.js:411-444 with plots.js:476-500 and :174-183: every non-QUIET store action runs syncAll. For the farm that recomposes all bed matrices and colours, re-uploads beds, runs beds.computeBoundingSphere over all fields, copies and re-uploads halos, and re-runs layRows with no dirty check. With an active crew or auto-farm this scales with N times the action rate; the rate needs live measurement.
- src/features/realm/plots.js:365: the mulch ring is a transparent, depthWrite-false, normal-mapped MeshStandard drawn for every slot and never hidden. Combined with halos (plots.js:169-182) at the real 1 m free-planting pitch, this stacks blended PBR plus shadow layers over shaded ground. It is likely a larger fragment cost on dense farms than the G9 vertex saving.
- src/features/realm/index.js:66 and src/features/realm/plots.js:140: farm/landscape-parts.glb decodes and retains 4 textures (about 7.5 MB bitmaps, never uploaded) only to reuse its geometry. Its materials are discarded, so the textures should be stripped from the GLB.
- src/app/game.js:332-333 with src/features/realm/index.js:268 and src/features/realm/world.js:503: while CAFE_ENABLED is false, compileAsync still compiles café materials because both areas are visible until the first update, and buildCity runs unconditionally at boot. This adds to startup CPU for content the player cannot enter; duration needs a live trace.
- plots.js:532 calls plotGrowMs for every planted plot on every non-quiet syncAll; speedOf runs staffBonus = assignedUnits(s).filter(unitWorking).reduce(...) per call (derive.js:37, :50, :148-150). That is O(plots x units) with two array allocations per plot at 6-11 syncs/s, not mentioned in CPU-2. One region-wide staffBonus per sync would remove it.
- plots.js:420 sets part.mesh.count = slotHigh on every tree part with frustumCulled=false (plots.js:400), so non-matching species and stages draw as zero-scale instances. With both species present in the part list, 240 slots submit about 240 x (4763 + 6393) = 2.68M triangles of vertex work per pass, before hidden fruit kinds are removed, regardless of how many of each species exist.
- plots.js:25-31 (gedeoInst flush) rewrites and flags instanceMatrix and recomputes bounds on all gedeoInst meshes at each commit(0); layRows calls commit on 4 sets every non-quiet sync, at plots.js:515 and :517. Same dead work as CPU-2's layRows but not counted.
- index.js:216 with animals.js:87: each walking animal calls isWalkable each frame, which recomputes farmViewBounds(store.state) (derive.js:205-211). Up to 45 region-wide bounds computations per frame, with allocation, at the animal limit.
- gedeo-worker.js:89-91: the robot's mixer hangs on the first mesh only (harvest_bot_light, a tiny part). If that part alone is frustum-culled at the screen edge, the rest of the robot stays drawn with animation frozen. A correctness side effect of the cited optimisation, and ACE-2's merge should preserve a body-level sphere.

