# Current state — source audit, 25 October 2026

## Audited baseline

The application release baseline is `0ae226764d6248501ec576b343e14c369cba9eec`, **v0.12.0**, not the v0.10 named in the incoming handoff. GitHub API confirmed the repository/default branch, PR #32 merge and successful validation/Pages workflow for this SHA. Forty-one local source/build-metadata files matched the remote Git blobs. Existing workspace modifications and untracked files predate this analysis; none were cleaned up or committed.

The audit read application models/UI, package/build/workflow files, test definitions, historical GDD/handoff, scientific evidence notes and feature/review documents. `node --test tests/*.test.mjs` was run with existing dependencies: **129 passed, 0 failed**. No install, application build, browser re-run, provisioning or deployment was performed during this audit. Browser matrices and 14×2 playthroughs reported in [PLAY-SCREEN.md](PLAY-SCREEN.md) are release evidence from prior work, not new human testing or newly executed browser checks here.

Documentation-publication update: the owner authorized synchronizing and publishing these planning files against v0.12. Documentation commits may therefore follow the release-baseline SHA above without changing the application version. The current proposal is [ROADMAP_V012.md](ROADMAP_V012.md); implementation still requires approval.

## Architecture and active experience

The app is client-side JavaScript ES modules with Vite, HTML/CSS/SVG and WebAudio. `src/main.js` mounts the older Coffee Desk/journal, then `src/cafe-ui.js` makes the café the initial experience and keeps older tools accessible. There is no installed application server, account service, cloud database, multiplayer service, payment integration or analytics client in the inspected source/package/workflows.

`scripts/build-standalone.mjs` also combines modules and CSS into `docs/index.html` for Pages; it strips the current single-line import/export syntax. Vite produces `dist/` separately. OCR preparation copies pinned local runtime assets. These are two delivery paths to preserve, not permission to regenerate them in an analysis task.

Current main loop:

1. Arrive as a café visitor. The owner introduces a collected bean, tool or famous method and tells an authored story with a guest vignette.
2. Inspect details or use an early hands-on invitation. Choose self-brew, demonstration, listen-only or an optional mini game.
3. Brew to fixed cumulative targets with tactile water/drip/scale feedback; choose flow, scale or quiet. Knowledge prompts are optional.
4. Receive an episode-specific cup response and keep a story card after goodbye. The next visit is available without a date gate.
5. Revisit the cabinet or open the separate practice/journal tools.

There are **14 authored episodes: eight bean introductions, three tools and three creator-method introductions**. There is no fifteenth episode or live season service. Fresh browsers use `curiosity-v1`, starting Yemen → AeroPress → Ethiopia samples; existing classic books retain their original order. Review practice does not rewrite completed cards. The one-screen UI paginates dialogue and puts longer content in explicit notebooks; older practice/journal screens retain their own layouts.

## System inventory and disposition

Classification is a recommendation for future work, not a change made by this audit. KEEP preserves current behavior; REFINE adjusts an existing system; EXTEND adds capability around it; DEPRECATE retires a future use/claim while preserving history; REPLACE would require a demonstrated need. Missing systems are listed separately rather than classified as existing implementations.

| Existing system | Implementation/evidence | Status against new direction | Disposition and smallest next action |
| --- | --- | --- | --- |
| Client bootstrap/module structure | `src/main.js`, `src/cafe-ui.js`, `package.json` | Implemented | **KEEP** — add a bounded feature module rather than change framework. |
| Single-screen café | `src/cafe-screen.js`, `src/style.css`, `tests/cafe-screen.test.mjs` | Implemented v0.12 | **KEEP** — preserve fixed controls, dialogue pages, notebooks and focus behavior. |
| Owner stories and international guest vignettes | `src/cafe-season-data.js`, `src/cafe-season-ui.js` | Implemented 14-visit narrative; mystery-like titles but largely explained by owner | **REFINE** — introduce one observable unresolved situation before explaining it; retain authored stories and IDs. |
| Visit sequence, checkpoints and cabinet | `src/cafe-season.js`, `tests/cafe-season.test.mjs` | Implemented finite story progression/collectibles, not a world or skill tree | **EXTEND** — optional case progress alongside existing books; no route reset. |
| Fresh-route novelty/early interaction | `src/cafe-curiosity.js`, `src/cafe-season.js` | Implemented v0.11 | **KEEP** — do not recreate the same onboarding changes. |
| Café tasting workbench | `src/cafe-tasting.js`, `src/cafe-tasting-ui.js` | Implemented self/watch, method-specific phases, goals, optional prompt; limited experimental outcomes | **REFINE** — expose a meaningful evidence comparison using recorded state; do not claim taste simulation. |
| V60/ORIGAMI/AeroPress apparatus, streams and scale | `src/brew-equipment.js`, `src/cafe-tasting-ui.js` | Implemented tactile/presentation foundation | **KEEP** — preserve whole-rig proportions, server fill bounds, clocks and persistent control nodes. |
| Cozy scene and music | `src/cafe-atmosphere.js`, `src/cafe-scene.js` | Implemented original drawing/synthesis, explicit audio enable | **KEEP** — fantasy can extend presentation; retain opt-in audio and reduced-motion support. |
| Optional memory/clue/order/postcard/brew invitations | `src/cafe-season.js`, `src/cafe-season-ui.js` | Implemented and persisted; several are recall/composition games rather than causal coffee experiments | **REFINE** — connect one activity to an observation; retain existing optional modes. |
| Local daily shelf and favorites | `src/daily-discovery.js`, `src/daily-discovery-ui.js` | Implemented 13-entry calendar rotation, browsing/favorites; not live daily content | **REFINE** — present as a finite shelf alongside visit progression; avoid attendance pressure or duplicate entry points. |
| Earlier seven-visit/day chapters | `src/seven-visits*.js`, `src/cafe-day*.js` | Implemented optional legacy story/activity systems | **KEEP** — retain saves and access. Do not build another competing onboarding route by default. |
| First Pour recipe/practice station | `src/first-pour-model.js`, `src/first-pour-ui.js` | Implemented three-stage pouring, recipe configuration, history/rebrew | **EXTEND** — reuse its experiment helpers; avoid silently replacing the active café with this older entry point. |
| First Shift guided A/B exercise | `src/first-shift.js`, `src/first-shift-ui.js` | Implemented saved A/B cups and changed-grind identification, optional fun/return-intent response | **REFINE** — make evidence/reasoning more playful; a one-unit grind change currently does not create validated taste/flow differences. |
| Free counter and three-discovery path | `src/cafe-model.js`, `src/counter-progress.js`, `src/cafe-ui.js` | Implemented overflow/control, same-bean/temperature comparison and fictional guest preference | **REFINE** — reuse observed mass/overflow decisions; keep fictional preference separate from measured learning. |
| Coffee Desk recipe/three-decision game | `src/game.js`, `src/pour-game.js`, `src/main.js` | Implemented setup, cues, action consequences and deterministic game score | **REFINE** — reusable cue/action rules, but hidden recipe targets are not scientific mastery. |
| Legacy numerical scores as a future mastery/unlock authority | `brewScore`, `gameplayScore`, `firstPourScore` | Existing deterministic target-distance game scores; not validated quality | **DEPRECATE** that future use — preserve old functions/results and labels; do not base Discovery Rank on these scores. No deletion now. |
| XP/player level | `src/progression.js`, `src/counter-progress.js` | Implemented for legacy journal/counter, not integrated café discovery progression | **REFINE** — preserve earned progress and add first-discovery rules only after an approved mapping. |
| Missions | `src/missions.js`, counter lesson proof | Implemented exploration, notes, controlled change and repeated score goals | **REFINE** — move future rewards toward distinct problem solving; do not require repeating high scores for new discovery. |
| Badges and keepsakes | `src/progression.js`, season cabinet | Implemented four basic badges and story cards, not broad achievement/customization systems | **EXTEND** — add one useful discovery reward, not an economy. |
| Personal journal/history/comparison | `src/main.js`, `src/first-pour-ui.js`, `src/discovery.js` | Implemented across separate tools: notes, next change, saved pairs, search, radar, rebrew, exports/deletion | **EXTEND** — a unified read-only discovery view can link existing records without merging their meanings. |
| Six-axis personal sensory reflection | `src/discovery.js`, First Pour feedback; legacy taste form | Implemented optional self-report with context labels | **KEEP** — preserve missing values and separate intensity/enjoyment; never auto-fill a predicted taste. |
| Real-brew observations/calculation | `src/real-brew-model.js`, `src/real-brew-ui.js` | Implemented units/provenance, attestation, milestones, sensory-before-analysis and conditional apparent EY | **KEEP** — optional empirical journal lane; no game reward for claiming a real measurement. |
| Personal bean profiles/photos | `src/bean-library.js`, `src/bean-model.js` | Implemented IndexedDB library, manual review, photos, metadata snapshots and export | **KEEP** — useful personal depth; no prerequisite for mystery play. |
| Packaging text extraction | `src/label-ocr.js`, `scripts/prepare-ocr.mjs`, `docs/BEAN-AI.md` | Implemented local Tesseract OCR and conservative label parsing, not cloud vision/LLM | **KEEP** — unknown fields remain manual; bean photos do not establish origin/quality. |
| Creator recipe provenance and guides | `src/recipe-references.js`, `src/recipe-reference-ui.js` | Three attributed methods; supplied summaries, guide timers and limitations | **REFINE** — obtain primary transcripts to resolve remaining exact-timing uncertainty; retain attribution and method limits. |
| Science register/pilot protocol | `src/science.js`, `docs/SCIENCE.md`, evidence review, `docs/REAL-BREW-PROTOCOL.md` | Reviewed documents and collection workflow; no validated extraction/flavor model | **KEEP** — use supported observations first; add no universal sensory coefficients. |
| Local persistence and recovery | Store loaders/validators across models, IndexedDB bean store | Implemented separate versioned stores, protected corrupt data, exports; no cloud sync | **KEEP** — add adapters/checkpoints carefully; preserve original bytes and old result versions. |
| VI/EN and accessible interaction | `src/i18n.js`, paired story text, UI controls | Implemented bilingual/touch/keyboard/reduced-motion paths | **KEEP** — require coverage for any new case. Real-device coverage remains a separate question. |
| Automated validation/browser harnesses | `tests/`, `scripts/smoke-*.mjs`, `.github/workflows/validate.yml` | Implemented; some older scripts assume older visible selectors/layout | **EXTEND** — maintain targeted active-screen tests; functional passes do not prove fun. |
| Pages and static/Vite build paths | `.github/workflows/pages.yml`, standalone builder | Implemented current release path | **KEEP** — no hosting change required for a local pilot. |
| Optional production deployment tooling | `.github/workflows/production.yml`, `deploy/release.sh`, Nginx templates | Implemented deployment code; live VPS readiness unverified | **KEEP** as dormant tooling — do not dispatch/provision it. |
| Historical first-VPS feature inventory | `docs/DEPLOYMENT.md` opening description | Stale relative to source | **DEPRECATE** as current-state authority; retain history and propose a later status annotation. |

No existing system warrants **REPLACE** on current evidence. A game engine, new frontend, backend migration or rewritten simulator would expand risk before validating the proposed loop.

## Important implemented mechanics and limits

- `progression()` gives 10 XP per saved legacy session, 5 per written discovery, plus counter XP; level is `floor(XP / 50) + 1`, with no defined content unlock at each level. Counter XP adds 10 per saved round, 5 per note and 15 for each first completed lesson. Café story/tasting records are not inputs to that calculation.
- `missionProgress()` includes a meaningful one-variable comparison, but also three score ≥90 brews of the same starter bean. This is a repetition goal against a game target, not proof of barista skill.
- Café tasting profiles use native three/five-pour totals for the three attributed recipes. Eight bean episodes plus V60 use the same illustrative 15 g/240 g* three-stage setup; ORIGAMI has its own drawing but the same generic totals. AeroPress uses 15/225, an illustrative steep and plunge.
- `tickTasting()` pours every recipe's total in 12 active game seconds, applies simplified collection, and ultimately collects the input total. Washed/Natural changes the selected sample/recap, not extraction chemistry. Goals and pause counts affect coaching/identity, not flavor. These are deliberate presentation limits, not a calibrated physical brewer.
- The separate counter conserves its game water/material bookkeeping and models retention/overflow. Its dissolution constants and strength thresholds are uncalibrated; acidity/bitterness are fixed fictional lot attributes. This is not interchangeable with the café workbench's simplified accounting.
- Creator guides retain attribution and real-time reading timers. First Pour supports the three-stage Hoffmann reference; it rejects unsupported five-pour references rather than silently compressing them. The café workbench supports those five-pour stage counts with shortened game time. The 1 Cup summary's 1:55/near-2:00 discrepancy is disclosed.
- Apparent extraction percent is `beverage_g × TDS_percent / dry_dose_g` when inputs exist. It is neither a sensory score nor evidence of model calibration.

## Persistence map to preserve

| Store | Meaning and boundary |
| --- | --- |
| `c6s.cafe-season.v1` | Fourteen-visit books, route marker, active tasting snapshots, cards; completed records protected during review practice. |
| `c6s.first-pour.v03` | First Pour game memories, recipe/model version, reflection or self-reported tasting, optional A/B links. |
| `c6s.first-shift.v1` | Guided-shift state, answer and voluntary fun/return-intent feedback. Not population analytics. |
| `c6s.counter.v1` | Atomic counter rounds/setup/favorite and proof-derived lesson progress. |
| `c6s.cafe.v1` | Older counter data retained as import source, not overwritten/deleted. |
| `c6s.sessions.v1` | Older Coffee Desk session journal, game scores and contextual personal ratings. |
| `c6s.real-brews.v1` | Self-reported actual pour-over observations; distinct protocol/provenance and export. Never substitute game data. |
| `c6s.daily-discovery.v1` | Finite shelf favorites. |
| `c6s.seven-visits.v1`, `c6s.cafe-day.v1` | Earlier story chapter/day progress. |
| IndexedDB `coffee-beans-v1` / `profiles` | Personal bean metadata, recognized text and local packaging/bean photos. |
| `c6s.language`, `c6s.music.volume` | Preferences; audio activation itself remains explicit. |

Persistence is browser/origin-bound. JSON export exists in multiple tools; there is no general import/cloud-sync layer or unified discovery ledger. Unsaved forms/checkpoints have differing recovery limits. Moving to a custom domain or VPS does not automatically move localStorage or IndexedDB data.

## Not present as complete systems

No integrated mystery/case engine with hypothesis/evidence resolution; Discovery Rank; skill tree; meaningful world/chapter unlock graph; 10/60-level content plan; persistent spendable cosmetics inventory; currency/economy; weekly expeditions/live seasons; unified Personal Discovery Journal; playable friend challenge/referral tracking; cooperative rooms/guilds; accounts/cloud sync; central analytics/retention cohorts; payments/commerce/creator marketplace; or empirical calibration/ML pipeline was found in the inspected app/package/workflows. Related reusable pieces above do exist and should not be mistaken for absence of all progression, all experiments or all journaling.
