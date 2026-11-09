# Farm world replacement — before / after report (2026-11-08)

Scope: the brief "GODBEAN — COMPLETE BLENDER 3D FARM WORLD REPLACEMENT" plus the primitive audit. Every model below is built
by script in Blender 5.2 (`scripts/blender/`), with no generators, no downloaded or unlicensed assets, and no AI meshes.
Gameplay, saves and the 4-estate land system are unchanged. Nothing is committed, pushed or deployed.

## 1. Primitive audit (visible Three.js primitive meshes in the farm scene, test profile, Lv10 save)

| Primitive | Before | After | Replaced by |
|---|---|---|---|
| RingGeometry: mulch rings round each bush | 380 | 0 | `landscape-parts.glb` › `mulchBasin` |
| CylinderGeometry: plaza cobbles | 264 | 0 | `gedeo/gate-plaza.glb` (flagstones + kerb stones) |
| BoxGeometry: beds, strips, edges, benches | 81 | 0 | `landscape-parts.glb` › `plantingRow`, `wallUnit`, `bankUnit` (laid in modules) |
| IcosahedronGeometry: mountain ring (backdrop) | 50 | 0 | `gedeo/terrain-{north,east,west,south}.glb` |
| SphereGeometry: coffee hills | 19 | 0 | the same terrain chunks + slope forest (albizia / cordia LOD3 at `terrain-meta.json` spots) |
| CircleGeometry: plaza disc | 1 | 0 | `gate-plaza.glb` |
| CircleGeometry: robot blob shadow | 1 | 0 | hidden once the Gedeo robot model is on (it casts a real shadow) |
| PlaneGeometry: ground play surface | 1 | 1 | **kept**: a flat textured surface (grass/red-soil blend, Blender-baked textures). The play grid needs it flat for placement and saves. |
| PlaneGeometry: parcel overlays / sale decals | 4 | 4 | **kept**: flat texture decals for the next estate's sign and highlight, not world objects |
| **Total** | **801** | **5** | |

No tree, house, character or robot in the production farm map is a primitive. Trees, coffee, enset, buildings, workers and
robots were already Blender GLBs before this turn (see `gedeo-asset-manifest.md`). The audit script counts visible meshes
whose geometry type is a Three.js built-in.

Kept on purpose (not counted as crude map art):
- **Gate portal**: a story object from the God Bean scene, not farm scenery.
- **Player avatar**: the shared character from the café game.
- **Fallback code paths**: `plots.js` and `world.js` still build the old shapes *only* if a GLB fails to load.

## 2. New or changed this turn

| Asset | File | Where it shows |
|---|---|---|
| Coffee seedling, young bush | `farm/coffee-stages-gedeo.glb` (`seedling`, `young`) | the first crop: seedling to 30% growth, young bush to 62%, then the mature tree |
| Planting row, mulch basin, wall unit, terrace bank | `farm/landscape-parts.glb` | beds, rings, terrace walls and banks in every field |
| Gate plaza | `gedeo/gate-plaza.glb` | the entrance square |
| Hill country (4 chunks, 360 × 390 m) | `gedeo/terrain-*.glb` + `terrain-meta.json` | rising hills past a 30 m apron round the farm, north ridge |
| Slope forest | albizia + cordia LOD3, instanced at the 354 meta spots | clumps on the hills (high 2 per spot, medium 1, low none) |

Runtime changes: `world.js` (`loadHills`, `slopeTrees`, plaza swap, ground plane bounds±30), `plots.js` (growth stages,
modular ground parts, stage/fruit meshes hidden when unused, bush shadows only on high quality), `staff.js` (robot blob
shadow), `gedeo-vegetation.js` (new model keys), dev hooks `__realmCam` / `__realmRenderer` (dev build only).

## 3. Visual QA (built-in browser, Vite dev server, test profile)

Screenshots: `docs/design/qa/world-replacement/`.

| Size | Checked | Result |
|---|---|---|
| 390 × 844 | gate, plaza, workers, robot, water tank, HUD | OK (`390x844-gate.jpg`) |
| 430 × 932 | gate; mature flowering coffee on planting rows; seedling to young growth | OK (`430x932-*.jpg`, `stage-seedling.png`, `stage-young.png`) |
| 1080 × 1920 CSS px | layout | renders; the HUD is small because 1080 CSS px is a desktop width. Real 1080×1920 phones are about 360–412 CSS px, which the two rows above cover. |
| Desktop / wide shot | hill country with and without fog | hills and slope forest join the farm with no visible seam (`hills-overview-*.jpg`) |

Fix found during QA: seedlings started near zero size and were invisible specks. `STAGE_SIZE` is raised (seedling 2.6,
young 1.4).

## 4. Performance (`renderer.info` after a frame, 390 × 844, pixel ratio 1.5, shadow map 1024)

| | Triangles / frame (incl. shadow pass) | Draw calls | GPU textures |
|---|---|---|---|
| First wiring of the hills, high | 6.21 M | 211 | 55 |
| After trimming, **high** | **4.48 M** | 207 | 55 |
| After trimming, **medium** | **3.68 M** | 206 | 55 |
| Low (no shadows), measured before the slope-forest trim | 3.57 M | 127 | 55 |

The trimming:
- cherries and trunks no longer cast shadows;
- seedling, young, green-fruit and ripe-fruit meshes skip drawing when no bush shows them;
- bushes cast shadows only on high quality;
- slope forest density follows quality.

The Mac emulator holds 100 fps. **No real phone has been measured.**

## 5. Remaining work and blockers (honest list)

1. **Coffee bushes are not frustum-culled.** About 390 bushes × 4 parts are drawn as whole-farm instanced meshes, so a phone draws the entire farm even when zoomed in. Fix: split the instances into chunks per estate or row, each with its own bounds. This is the largest remaining performance item.
2. **KTX2 / Basis textures:** not done. Textures are WebP/JPG at most 1024 px.
3. **Real-device measurement:** not done (the in-app browser only emulates).
4. **Care visuals:** watering, pruning and planting use the worker/robot clips and the existing wet-soil tint. There are no separate Blender props such as a watering-can splash or prune clippings.
5. **Ground play surface** stays a textured plane (see §1); gameplay places objects on a flat grid.
6. **The economy sim script** still never buys estates (from the land change; unrelated to visuals).
