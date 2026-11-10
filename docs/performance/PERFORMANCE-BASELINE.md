# Performance baseline

Measured 2026-11-09 on the working tree of branch `feat/auto-farm` (HEAD `1d55bd1` plus uncommitted work). No game code was changed to take these numbers.

## 1. What these numbers can and cannot tell you

| Measured here | Not measured |
|---|---|
| Frame intervals, main-thread rAF time, update vs render-submit split | **Any real phone or tablet** |
| GPU time from `EXT_disjoint_timer_query_webgl2` on Apple M1 | **Safari** (macOS or iOS) and Android Chrome |
| Draw calls, triangles, `renderer.info`, scene census | **Device temperature, power, battery** |
| JS heap (`performance.memory`), long tasks, CPU trace by function | True GPU memory (only estimated from texture and buffer sizes) |
| Region-switch and atlas memory behaviour, 15-minute soak | A real player session with human input for 15 to 30 minutes |
| Viewport emulation at phone pixel count, 4x CPU throttle | A production build (all runs used the unminified Vite dev server) |
| | Draw calls for the selection, intro and teacher scenes (atlas: 218 to 230 draws observed) |
| | The café scene, disabled by `CAFE_ENABLED` |

Read these results as follows.

- **The test machine is one Apple M1 at 1440x668, 75 Hz.** It is much faster than the phones the game targets. A number here does not predict a phone's frame rate.
- **4x CPU throttle only slows the main thread.** It does not slow the GPU, so the phone-viewport results show CPU behaviour at phone resolution, not phone GPU behaviour.
- **Timer-query GPU time is a relative measure.** On tile-based GPUs it can undercount or shift work between frames. Use it to compare variants, not as absolute GPU load.
- **The machine was not idle.** A second chat was editing this repository, another dev server was running, and analysis jobs ran during some captures. GPU time for the same scene varied from about 10 ms to 32 ms between runs. Only the alternating A/B in section 5 cancels this drift, and those are the numbers used for ranking.
- **The profiler and tracing add overhead.** CPU traces were also taken without the profiler loaded where it mattered.

## 2. Setup

| Item | Value |
|---|---|
| Browser | Chrome 156, ANGLE Metal, renderer string `ANGLE Metal Renderer: Apple M1` |
| CPU cores / reported memory | 8 / 16 GB |
| Viewport | 1440x668 at DPR 1 unless noted; phone emulation 390x844 at DPR 3 |
| Quality | `high` (game default) unless noted; 4x MSAA reported by `gl.SAMPLES` |
| Save | Isolated `?profile=max` save in the test browser. The real save was not touched. |
| Live reload | Blocked in the test page so another chat's edits could not reload it mid-capture |

Two saves were used.

| Save | Contents |
|---|---|
| **Starter** | Level 9, starter land, no fields planted, no staff |
| **Late game** | Level 40, all 35 lots, 200 planted fields (mixed robusta, arabica, liberica), 29 added buildings, 40 staff (27 workers, 13 robots), save JSON about 81 KB |

Tools: `src/dev/perf-profiler.js` (new, dev-only, not imported by the game), `scripts/perf-trace-summary.mjs` (new), Chrome Performance traces, and an in-page A/B harness that toggled state in memory only. Spector.js was not needed because `renderer.info` and timer queries answered the draw-call questions.

## 3. Scenario results

Times in ms. `CB` is the whole rAF callback. `Update` runs from rAF start to `Scene.onBeforeRender`: game logic, HUD and scene matrix updates. `Submit` is the rest of `renderer.render`, including the shadow pass and the character mixers driven from `onBeforeRender`. `GPU` is timer-query time, which excludes the MSAA resolve at presentation.

### 3.1 Starter farm (M1, 1440x668)

| Scenario | FPS avg | 1% low | p95 | p99 | CB | Update | Submit | GPU | Draws | Triangles |
|---|---|---|---|---|---|---|---|---|---|---|
| Camera idle (12 s) | 74.5 | 44.4 | 14.3 | 14.4 | 6.06 | 1.83 | 4.14 | 4.79 | 142 | 1,598,085 |
| Camera pan and zoom (12 s) | 62.1 | 8.7 | 26.7 | 40.0 | 9.76 | 2.48 | 7.19 | 6.35 | 222 | 1,678,410 |

The pan run had 2 long tasks totalling 674 ms, the largest 597 ms, while `programs` went from 78 to 79. A first-seen shader compile is the likely cause, but this was not isolated.

An almost empty farm already submits 1.6 million triangles per frame.

### 3.2 Late game (M1, 1440x668, cleanest captures)

| Scenario | FPS avg | 1% low | p95 | p99 | CB | Update | Submit | GPU | Draws | Triangles |
|---|---|---|---|---|---|---|---|---|---|---|
| Camera idle, crops, staff working | 75.0 | 69.9 | 14.0 | 14.2 | 4.71 | 1.50 | 3.17 | 12.6 | 545 | 4,696,949 |
| Camera pan and zoom | 73.0 | 37.4 | 14.3 | 26.7 | 5.09 | 1.57 | 3.48 | 19.4 | 619 | 4,801,298 |
| All fields ripe, staff harvesting | 75.0 | 69.4 | 14.3 | 14.4 | 4.64 | 1.41 | 3.20 | 13.05 | 542 | 4,683,489 |

The display refreshes at 75 Hz, so 75 FPS is the ceiling here. `renderer.render` ran exactly once per rAF in every capture, so there is **no duplicated render loop**.

A separate capture of the same idle scene during heavier machine load gave 61.4 FPS, 23.4 1% low, CB 14.27, Submit 9.35, GPU 9.39, 559 draws and 5.48M triangles. The triangle count differs because the camera and crew positions differed.

Per-frame sub-costs in the idle capture:

| Item | Value |
|---|---|
| All `AnimationMixer.update` calls | 0.12 ms per frame |
| Scene `updateMatrixWorld` | 0.59 ms per frame |
| `Skeleton.update` calls | about 1,780 per second (24 skeletons at 75 Hz) |
| Object raycasts while idle or panning | 0 |
| `store.dispatch` | 3.9 per second, 1.2 ms each (range across captures 0.2 to 4.1 per second, 1.0 to 7.3 ms each) |
| `localStorage.setItem` | 0.8 per second, 0.14 ms each, about 63 KB/s written |
| Buffer uploads (`bufferSubData`, later check with the same save at 60 Hz) | about 7.4 MB/s, consistent with instance-buffer rewrites |
| Shadow pass CPU time (same later check) | 0.87 ms per pass, 60 passes per second |

### 3.3 Building placement (taken in the slow machine state, compare only with its own row)

| Scenario | FPS avg | 1% low | CB | Draws | Dispatch |
|---|---|---|---|---|---|
| Idle, same page, just before | 47.5 | 12.4 | 17.1 | 516 | 3.6 ms |
| Placing 4 buildings | 43.0 | 11.6 | 18.99 | 554 | 5.0 ms |

Each `build/place` dispatch took 16 to 23 ms synchronously, and `programs` went from 79 to 82, meaning new shaders were compiled during play. There were 2 long tasks, the largest 105 ms.

### 3.4 Phone-size viewport (390x844 at DPR 3, 4x CPU throttle, Mac GPU, late game)

The game renders 780x1688 at quality `high` because DPR is capped at 2. Shadow map size is 1024 because the emulated pointer is coarse.

| Quality | FPS avg | 1% low | p95 | p99 | CB | Update | Submit | GPU | Draws | Triangles |
|---|---|---|---|---|---|---|---|---|---|---|
| high, idle | 42.7 | 24.7 | 27.6 | 40.0 | 19.94 | 8.07 | 11.73 | 10.78 | 424 | 4,648,207 |
| high, panning | 43.6 | 25.0 | 27.6 | 40.0 | 19.41 | 7.70 | 11.58 | 10.75 | 413 | 4,634,391 |
| medium, idle | 45.5 | 28.7 | 27.6 | 27.7 | 18.78 | 7.61 | 11.02 | 10.18 | 437 | 3,710,294 |
| low, idle | 59.9 | 29.6 | 27.1 | 27.6 | 13.59 | 6.46 | 6.98 | 8.29 | 195 | 3,327,377 |

rAF callbacks took 81 to 85% of each second (style, layout and paint not included), so this configuration is CPU-limited. **Auto-quality did not step down at 42.7 FPS**, confirming the blind spot in `watchFrame` (bottleneck 5).

Quality `low` keeps almost all triangles (3.3M). It removes draws and shadows but not the geometry load.

### 3.5 Loading (dev server on localhost, so no real download time)

| Case | Ready at | Long tasks | Total long-task time | Largest |
|---|---|---|---|---|
| Late game, M1 | 4,687 ms | 8 | 2,059 ms | 677 ms |
| Late game, M1, repeat | 4,165 ms | 9 | 1,846 ms | 833 ms |
| Late game, 4x CPU and phone viewport | 7,389 ms | 9 | 3,451 ms | 1,078 ms |

Late game loaded 94 GLB requests, 21.4 MB decoded body size, 240 resources in total, and used about 112 MB of JS heap once ready.

### 3.6 Coverage of the 10 scenarios

| # | Scenario | Status |
|---|---|---|
| 1 | Initial loading | Measured on the dev server only, no real download |
| 2 | Farm with 4 terrain levels | Census at default zoom only. Other zoom levels not captured |
| 3 | Camera idle | Measured |
| 4 | Camera movement and zoom | Measured |
| 5 | Crops growing | Not separated. Measured only together with staff working |
| 6 | Workers and robots | Measured within the idle capture, 40 staff |
| 7 | Building construction | Measured in the slow machine state, compare only with its own row |
| 8 | Harvesting and production | Harvest measured. Production buildings running not measured |
| 9 | Scene switching | Atlas and region switching measured. Café not testable |
| 10 | Continuous gameplay | 15-minute soak without player input. Human play not measured |

## 4. Scene census

| Metric | Starter | Late game |
|---|---|---|
| Scene nodes | 1,195 | 3,216 |
| Meshes (visible) | 796 (325) | 1,899 (563) |
| InstancedMesh / instances | 108 / 12,517 | 106 / 13,155 |
| SkinnedMesh / bones | 1 / 24 | 54 / 935 |
| Sprites | 46 | 138 |
| Transparent visible meshes | 22 | 28 |
| Visible shadow casters / caster triangles | 253 / 385,704 | 414 / 1,651,987 |
| Unique geometries / materials / textures | 516 / 344 / 138 | 689 / 636 / 188 |
| Textures with a side of 1024 px or more | 25 | 25 |
| **Estimated** GPU textures (w x h x 4 x 1.33) | 190.8 MB | 224.8 MB |
| **Estimated** GPU buffers | 18.4 MB | 21.8 MB |
| `renderer.info` geometries / textures / programs | 219 / 128 / 78 | 319 / 232 / 79 |

Lighting: one shadow-casting directional light (2048 map on desktop, 1024 on coarse pointers, `autoUpdate` true) and one hemisphere light.

Largest late-game triangle sources in the main pass:

| Source | Triangles submitted | Of which casting shadows |
|---|---|---|
| Coffee trees (`realm-plots`, 21 InstancedMeshes) | 1,914,000 | 947,200 |
| Cordia (bark + foliage) | 483,728 | 0 |
| Albizia (bark + foliage) | 337,860 | 0 |
| Retaining walls (stone mesh; 75,888 with all parts) | 73,728 | 73,728 |
| Stone steps (stone mesh; 63,744 with all parts) | 40,704 | 40,704 |
| Cliff clones (basalt) | 65,952 | 54,960 |

### 4.1 Static estimates used elsewhere

These are computed from code and GLB data, not measured at runtime.

| Figure | Method and scope | Source |
|---|---|---|
| 139,632 shadow triangles, 7 shadow draws for walls and steps | 36 walls x 2,108 + 6 flights x 10,624 | TERRAIN-04 |
| 144 MB boot texture set | 51 GLB textures reached by `warmUpGPU` at RGBA8 with mips, before late-game additions | TEX-04 |
| 24 to 36 MB with KTX2 | Same set as ETC1S plus UASTC normals, or all ASTC 4x4 | TEX-04 |
| 2.58 MB, 40 MB bitmaps for café | 7 GLBs: register, pickup, pastry, kiosk, espresso, table, roaster | TEX-05 |
| 27 to 29 MB for hidden buildings | Warm-up upload set with and without hidden groups | TEX-06 |
| 47 MB GPU, 35 MB canvas for labels | 60 units x 384 x 384 x 4, with mips for GPU | ACE-4 |
| 37 to 213 KB per frame for ripe bob | Instance capacity x 64 B x drawn parts | CPU-9 |
| 186 KB farm tile grid | 26,624 cells across three typed arrays | CPU-5 |
| 36,838 ground triangles | Grid dimensions in `world.js` | Terrain audit |
| 0.5 to 3% crew throughput risk | Job overshoot if logic is decimated | CPU-16 |

### 4.2 Heaviest GLBs requested by the farm

65 unique files, 16.4 MB on disk, 330,511 triangles in one copy each. Decoded size assumes RGBA8 with mips per file, before runtime dedupe. Across those files 80 of 192 materials have normal maps, 1 has a metallic-roughness map and none has an occlusion map, so roughness and occlusion maps are not a cost here.

The largest models on disk (`coffea-*-mature-lod0/1/2`, up to 280,757 triangles) are dev-tool assets and are not loaded by the game.

| File | KB | Tris | Prims | Textures | Max px | Decoded MB (est.) | Format | Normal maps | ORM maps |
|---|---|---|---|---|---|---|---|---|---|
| `gedeo/cordia-africana-lod0.glb` | 955 | 42,745 | 2 | 2 | 1024 | 6.7 | webp | 0/2 | 0/2 |
| `gedeo/albizia-schimperiana-lod0.glb` | 583 | 22,916 | 2 | 2 | 1024 | 4 | webp | 0/2 | 0/2 |
| `gedeo/cliff-face.glb` | 777 | 14,660 | 4 | 6 | 1024 | 18.7 | webp | 2/4 | 0/4 |
| `gedeo/farm-truck.glb` | 258 | 14,346 | 9 | 5 | 512 | 4.7 | webp | 2/9 | 0/9 |
| `gedeo/power-tiller-cart.glb` | 244 | 13,408 | 7 | 5 | 512 | 4.7 | webp | 2/7 | 0/7 |
| `gedeo/motorbike-sacks.glb` | 232 | 12,532 | 8 | 5 | 512 | 4.7 | webp | 2/8 | 0/8 |
| `farm/roaster-tier-1.glb` | 644 | 11,795 | 1 | 2 | 1024 | 10.7 | jpg | 1/1 | 0/1 |
| `gedeo/stone-steps.glb` | 955 | 10,624 | 4 | 7 | 1024 | 22.7 | webp | 3/4 | 0/4 |
| `girl.glb` | 1900 | 10,341 | 1 | 2 | 2048 | 26.7 | jpg | 0/1 | 1/1 |
| `gedeo/stream.glb` | 900 | 10,266 | 8 | 11 | 1024 | 25.3 | webp | 5/8 | 0/8 |
| `gedeo/cordia-africana-lod1.glb` | 267 | 10,007 | 2 | 2 | 1024 | 6.7 | webp | 0/2 | 0/2 |
| `gedeo/stone-pond.glb` | 324 | 9,058 | 6 | 9 | 512 | 7.3 | webp | 4/6 | 0/6 |
| `gedeo/pulper-machine.glb` | 204 | 8,204 | 8 | 5 | 512 | 4.7 | webp | 2/8 | 0/8 |
| `gedeo/wooden-bridge.glb` | 312 | 7,755 | 5 | 9 | 512 | 7.3 | webp | 4/5 | 0/5 |
| `gedeo/ensete-ventricosum-lod0.glb` | 136 | 7,590 | 3 | 2 | 1024 | 4 | webp | 0/3 | 0/3 |
| `gedeo/cow.glb` | 161 | 6,700 | 1 | 1 | 512 | 1.3 | webp | 0/1 | 0/1 |
| `gedeo/goat.glb` | 156 | 6,636 | 1 | 1 | 512 | 1.3 | webp | 0/1 | 0/1 |
| `gedeo/dog.glb` | 144 | 6,488 | 1 | 1 | 512 | 1.3 | webp | 0/1 | 0/1 |
| `farm/coffee-tree-liberica.glb` | 114 | 6,393 | 4 | 2 | 1024 | 4 | webp | 0/3 | 0/3 |
| `gedeo/terrain-north.glb` | 301 | 6,392 | 1 | 1 | 1024 | 5.3 | webp | 0/1 | 0/1 |
| `cafe/pickup-counter.glb` | 209 | 5,997 | 1 | 1 | 1024 | 5.3 | jpg | 0/1 | 0/1 |
| `cafe/register-counter.glb` | 417 | 5,962 | 1 | 1 | 1024 | 5.3 | jpg | 0/1 | 0/1 |
| `cafe/espresso-machine.glb` | 556 | 4,889 | 2 | 2 | 1024 | 10.7 | jpg | 1/1 | 0/1 |
| `cafe/pastry-case.glb` | 378 | 4,802 | 1 | 1 | 1024 | 5.3 | jpg | 0/1 | 0/1 |

## 5. A/B experiments (the numbers used for ranking)

Late game, M1, 1440x668. Each variant was alternated with its own baseline, 3 rounds of 4 s, median reported. All changes were made in memory only and reverted. FPS stayed at the 75 Hz ceiling in every case, so frame time is what changed.

| Variant | GPU base → test (ms) | Submit base → test (ms) | CB base → test (ms) | Triangles base → test | Draws base → test |
|---|---|---|---|---|---|
| **Hide coffee trees** | 13.63 → **7.48** | 3.51 → 2.66 | 5.14 → 4.25 | 4.70M → 2.37M | 537 → 527 |
| **Freeze shadow map** | 13.44 → **10.79** | 3.12 → 2.44 | 4.72 → 4.12 | 4.70M → 3.41M | 531 → **330** |
| Quality `low` | 10.03 → 7.95 | 3.20 → 2.12 | 4.90 → 3.57 | 4.70M → 3.41M | 539 → 329 |
| Quality `medium` | 11.98 → 12.31 | 3.66 → 3.47 | 5.28 → 4.97 | 4.70M → 3.75M | 538 → 535 |
| **Hide forest and scenery trees** | 11.23 → 11.73 | 3.26 → 3.28 | 4.74 → 5.25 | 4.70M → 3.69M | 537 → 517 |

- Coffee trees are the largest GPU cost: **about 45% of GPU time** comes from them and their shadows.
- Freezing shadows removes **38% of draw calls** and about 20% of GPU time.
- Hiding one million forest triangles made **no measurable difference on this GPU**. Those trees are almost entirely off-screen, and the vertex work to reject them is cheap on an M1. Static review had ranked this P0, and the measurement does not support that here. A phone GPU may behave differently, so it stays on the list for re-testing on a device.
- `medium` matches `high` at DPR 1 because its main saving, the 1.5 pixel-ratio cap, does nothing on a DPR 1 display.

## 6. CPU attribution

Self time from Chrome traces, as a percentage of the main thread over the capture window.

| Bucket | Trace A: late idle, no profiler (12.6 s) | Trace B: late idle, no profiler (10.4 s) |
|---|---|---|
| Total in rAF | 84.5% | 82.0% |
| three.js code | 47.7% | 37.6% |
| Native (WebGL and browser calls) | 17.1% | 35.2% |
| `core/derive.js` | **11.5%** | 2.9% |
| `realm/index.js` | **4.0%** | 0.4% |
| `realm/staff.js` | 2.5% | 0.9% |
| `realm/buildings.js` (includes production update) | under 0.1% | 0.2% |
| `realm/nav.js` (pathfinding) | under 0.1% | under 0.1% |
| `realm/staff-brain.js` | under 0.1% | under 0.1% |
| Style, layout, paint, compositing | about 6% | about 6% |
| Minor GC | 0.1% | 0.1% |

- In trace A, `canStand` (`realm/index.js:799`), `roadOpen` (`derive.js:183`) and `farmViewBounds` were among the top functions. They were not hot in trace B or in a third trace. The cost is state-dependent and consistent with many idle units looking for a place to stand, but that cause was not confirmed.
- Pathfinding and crew decision logic are negligible in these captures, so moving them to a Web Worker is not justified.
- Native labels such as `requestAnimationFrame` and `set hidden` carried implausibly large self time when the profiler was attached and were much smaller without it. They appear to be sampling artefacts around native calls. Treat native time as one bucket.

## 7. Memory

### 7.1 Atlas open and close, 12 cycles: clean

`renderer.info` returned to the same numbers after every cycle (319 geometries, 232 textures, 79 programs). Heap moved between 119 and 163 MB in a normal garbage-collection sawtooth. DOM node count was constant at 745. Atlas open took 377 to 484 ms.

### 7.2 Region switch, 12 switches: confirmed leak

| After switch | Region | JS heap (MB) | Geometries | Textures |
|---|---|---|---|---|
| 0 | vn-4 | 212 | 401 | 157 |
| 1 | vn-1 | 257 | 399 | 240 |
| 3 | vn-1 | 359 | 419 | 257 |
| 5 | vn-1 | 414 | 439 | 280 |
| 7 | vn-1 | 516 | 459 | 297 |
| 9 | vn-1 | 627 | 479 | 316 |
| 11 | vn-1 | 714 | 499 | 335 |
| 12 | vn-3 | 752 | 476 | 269 |

Comparing the same region, each round trip adds about **20 geometries, 19 textures and roughly 90 to 100 MB of JS heap**. Heap grew from 212 MB to 752 MB without returning. Scene switching between farm and café could not be tested because `CAFE_ENABLED` is false. Region switching is the equivalent full teardown.

The root cause identified by code reading (bottleneck 3) has not been confirmed with a heap retainer trace.

### 7.3 Soak: 15 minutes in one region, no steady-state leak

30 windows of 30 s with the crew running and no player input.

| Metric | Start | End |
|---|---|---|
| JS heap, after the first GC settled | 118 MB | 118 MB (range 109 to 144, no trend) |
| Geometries / textures / programs | 321 / 234 / 79 | 323 / 235 / 79 |
| Save JSON | 81,055 B | 81,984 B |

Frame results did change. CB rose from about 4.5 ms to about 13.7 ms and FPS fell from 75 to about 59, starting around minute 7. After a full page reload CB was still about 17 ms, so this followed the state of the machine rather than the game's running time. It may come from thermal throttling or competing work on the Mac. It has not been explained, and a controlled soak on an otherwise idle machine is needed before drawing a conclusion. It also means this soak does not establish sustained frame rate.

## 8. Confirmed versus hypothesis

| Claim | Status |
|---|---|
| Coffee trees are the largest GPU cost on M1 | **Confirmed by A/B** |
| Shadow pass re-renders every frame and costs 38% of draw calls | **Confirmed by A/B** |
| Region switch leaks | **Confirmed** by repeated measurement |
| Leak is caused by `plots.js:593` | Code reading, verified by a second reviewer, not retainer-traced |
| Render loop runs at full rate when nothing changes | **Confirmed** by capture and code |
| No duplicate render loops | **Confirmed** (1.0 render per rAF) |
| Auto-quality misses steady 42 FPS | **Confirmed** in phone-viewport run |
| Pathfinding and crew AI are minor CPU costs | **Confirmed** by trace on M1 with 40 staff |
| Off-screen forest wastes significant GPU time | **Not supported on M1**, unknown on phones |
| DPR 2 with MSAA is the main phone GPU cost | Hypothesis, needs a real phone |
| Lower resolution would reduce phone heat | Hypothesis, needs device measurement |
| A 30 FPS idle rate reduces battery use | Hypothesis, needs power measurement |
| KTX2 would cut GPU memory by about 100 MB | Estimate from texture sizes |
| The 15-minute frame-time rise is thermal | Unexplained |
