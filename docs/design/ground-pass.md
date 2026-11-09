# Ground pass: terrain, walls, paths, water (2026-11-09)

Done with Blender, photo-scanned CC0 textures and Three.js, no Meshy. Direction since 2026-11-09: as real as the phone allows.

Script: `scripts/blender/gedeo_ground_pass.py` (reuses the older builders, overrides textures and stone shapes).

```
Blender -b --factory-startup -P scripts/blender/gedeo_ground_pass.py -- --export <dir> --tex <png dir> [--only a,b]
```
Then copy the GLBs in, convert the PNGs to JPG with the same names, and run `node scripts/optimize-models.mjs <files>`.

Replaced, same names, node names and footprints:
- Textures in `public/assets/farm/env`: grass, soil, road, stone and their normal maps.
- Models: tier-wall, terrace-wall, stone-steps, gate-plaza, dirt-path, dirt-ramp, stream, irrigation-channel, drip-line, cliff-face, fence, fence-gate, tier-sign, terrain-north/east/west/south, farm/landscape-parts.
- Terrain heights are checked against `terrain-meta.json`; the script refuses to export if they move.
- Removed the 2.3x colour lift on tier walls in `world.js` (stones are light now). The stream tile is exactly 6 m (scale 1).

Unchanged: mist-bank (already soft and light), `terrain-meta.json`.
Originals: `art-backup/ground-originals/{gedeo,farm,env}` (git-ignored). Copy back to undo, and restore the wall lift in `world.js`.

## Photo textures (2026-11-09)
`scripts/blender/photo_textures.py` evens out and recolours CC0 sets from Poly Haven (polyhaven.com, CC0, no attribution required): leafy_grass, brown_mud_02, dirt, rock_face_03. Sources in `art-backup/polyhaven-source`. Run it first: the ground pass reads the installed JPGs.

## Lighting, effects, construction
- Lighting (`realm/index.js`): warmer sun, weaker hemisphere, a built-in sky environment map at 0.55.
- Particles (`shared/vfx`): volumetric smoke sprites with rotation and wind; new kinds smoke, spark, chip, splash, mist, mote, fallLeaf.
- `realm/ambient-vfx.js`: pollen, falling leaves, stream flow, a shower every 7 to 12 minutes (scenery only).
- Watering shows splash and mist for player and staff (`watered` event).
- Construction (`realm/buildings.js`): 8 to 24 s, soil pad, scaffold, clipping-plane reveal, sparks. Looks only: the building works from the first second.

Not done: bloom and other post-processing, a builder walking to the site, hammer sound, a real build time that blocks production. Houses, machines, trees, coffee and characters still use their old models and textures.
