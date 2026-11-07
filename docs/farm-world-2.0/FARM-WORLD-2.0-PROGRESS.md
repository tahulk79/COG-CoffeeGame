# Farm World 2.0 — Progress & Handoff

Durable checkpoint so work can resume safely. Nothing is committed (founder rule: commit only when asked). Branch:
`feat/staff-phase1`, which also carries large uncommitted staff / café-street / tending work from other sessions —
several sessions edit this working tree at the same time, so always re-read a file before editing it.

## Phase status (2026-11-07)
| Phase | Status | Where |
|---|---|---|
| 0 Audit | done — 9 parallel auditors + synthesis | FARM-WORLD-2.0-AUDIT.md |
| 1 Architecture | done | FARM-WORLD-2.0-ARCHITECTURE.md |
| 2 Core world (unified land, fields, tiles, placement) | done, tested | `src/core/{derive,game,state}.js`, `config/layout.js` |
| 3 Construction (multi-building, limits, cost growth, move, remove/refund, upgrades) | done, tested | BUILDING-SYSTEM-2.0.md |
| 4 Economy (goods, recipes, storage sum, wells, sell, mode gate) | done, sim-tuned (first pass) | FARM-ECONOMY-BALANCE.md |
| 5 UX/UI (catalogue tabs, contextual cards, modes) | implemented by the integration workflow | FARM-UX-UI-REDESIGN.md |
| 6 Visual polish (unified ground, barn/shed models, production animation, instanced trees) | implemented | realm files |
| 7 Progression compatibility (world map, Rounds, Lv10, rebirth, staff) | verified headless (personas) | FARM-WORLD-2.0-QA.md |
| 8 QA & optimisation | headless (130 tests, 55 persona checks), browser smoke at 375 × 812, 3-lens code review (15/17 fixed) | FARM-WORLD-2.0-QA.md |
| 9 Documentation | this folder + `docs/design/farm-world-2.0.md` (Vietnamese founder summary) | |

## Files owned by this update
Core: `src/core/config/economy.js` (BUILDINGS fields, FIELD, GOODS, RECIPES, CATEGORY_ORDER), `config/layout.js`
(terrain block), `derive.js` (Farm World sections), `game.js` (build/*, prod/*, farm/sell*, mode gate, pre-tilled
fields), `state.js` (layout 5, normalisers, softlock fix), `store.js` (pre-layout backup).
Realm/HUD: plots, world, placement, buildings, badges, index, camera, markers, staff (adapters only), HUD sheets,
action bar, effects, toolbar, top bar, feedback, tutorial (targets only), placement bar, v3.css.
New: `src/i18n/locales/farm-world.js`, `tests/core/farm-world.test.mjs`, `scripts/qa-personas.mjs`, economy test
additions, rewritten `scripts/economy-sim.mjs`, this docs folder.

## How to verify
```
npm test                                  # unit + sim guards
node scripts/qa-personas.mjs              # 15 player personas, 55 checks
node scripts/economy-sim.mjs 45 farm 1    # farm-only with processing (… farm 0 = raw, … cafe, … both)
npx vite build --outDir /tmp/fw2-dist     # bundle check without touching dist/
```
Browser: `npm run dev`, then `http://localhost:5173/?profile=test&coins=50000&level=6` (the test profile uses its own
save keys `@test`, never the real save).

## Open items from review
- Build-grid lines vs the 0.5 m snap (look decision); red tint on fields under a ghost; price labels small at the
  expansion overview zoom; expansion chip text truncated at 375 px.
- Real-device measurements (fps / draw calls before-after tree instancing, first-placement hitch).

## Next steps (proposed)
1. Founder decisions in `docs/design/farm-world-2.0.md` §6.
2. Phone playtest (QA doc §4 checklist) — touch feel, card auto-hide, overview zoom, badge density.
3. Staff run workshops (farmhand collects finished batches; robot "carry goods" task).
4. Café production model (Roast → Grind → Brew) before allowing 2+ café roasters.
5. Loan ceiling, market demand / truck orders (Round 2).
