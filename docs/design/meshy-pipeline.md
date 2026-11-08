# Meshy: regenerate the farm's 3D assets (2026-11-09)

Status: **pipeline written, not run.** No Meshy credit has been spent and no model has been replaced. Needs `MESHY_API_KEY`.

## What it does
`scripts/meshy/manifest.mjs` lists 49 static assets (buildings, machines and vehicles, tools and props, nature and trees, map pieces) with a prompt each.
`scripts/meshy/generate.mjs` runs the steps. API: Meshy Text to 3D v2 (`POST /openapi/v2/text-to-3d`, preview then refine with PBR).

| Step | Command | Cost |
|---|---|---|
| Estimate, list what is done | `node scripts/meshy/generate.mjs plan` | none |
| Create, texture, download | `node scripts/meshy/generate.mjs run --max-credits 1400` | credits |
| Fit and install | `node scripts/meshy/generate.mjs apply` | none |
| Undo | `node scripts/meshy/generate.mjs restore` | none |

- `run` refuses to start without `--max-credits`. It resumes after a stop and never pays twice for one task (`scripts/meshy/state.json`).
- Start small: `run --max-credits 200 --limit 6`, look at the result, then the rest. `--group buildings|machines|nature` and `--only a,b` also work.
- `apply` backs the old model up to `art-backup/gedeo-originals/` (these models are not in git), scales the new one to the old one's size, puts the origin at the middle of the base, decimates to the triangle budget, shrinks textures to 1024, exports WebP GLB, then compresses with `scripts/optimize-models.mjs`. The new file keeps the old name, so the game needs no code change.
- Models with LODs (tukul, albizia, cordia, ensete) get their lower levels by decimating the new model.

## Key
Never paste it in chat or commit it. `export MESHY_API_KEY=...` in the terminal that runs the script, or `MESHY_API_KEY=...` in `.env.local` (git-ignored).

## Not included on purpose
People, robots and animals (skeleton + clips), coffee growth stages and drying beds (named parts the game switches), terrain, ground pieces, terrace and tier walls, fences and gates (modular lengths), `farm-props` (named nodes), stone steps, bridge. Meshy makes one static mesh; these need structure the game relies on. Rigged characters would need Meshy's rigging plus retargeting to the 9 worker clips: a separate job.

## Open
- The credit numbers (20 + 10 per asset, about 1,470 for all 49) are an estimate; confirm on Meshy's pricing page.
- Meshy trees are solid crowns, not alpha cards; check they look right at the far LODs and on a phone.
- Licence depends on the Meshy plan (free plans usually require attribution).
- First fit of a real result may need `fit` tuned per asset (`height`, `footprint`, `box` in the manifest).
