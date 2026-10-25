# The Coffee Six Sense

## Product planning — current baseline v0.12.0

For product-planning handoffs, start with these documents. They distinguish shipped behavior from proposals awaiting implementation approval:

- [ChatGPT–Codex coordination](docs/WORK_SYNC.md) — read-only connector workflow, shared status and task handoff template.
- [Strategic handoff](docs/STRATEGIC_HANDOFF.md) — confirmed direction, conflicts and proposed AGENTS instructions.
- [Current state](docs/CURRENT_STATE.md) — inspected systems and KEEP/REFINE/EXTEND/DEPRECATE classifications.
- [Gap analysis](docs/GAP_ANALYSIS.md) — missing capabilities, reuse and architectural risks.
- [Roadmap based on v0.12](docs/ROADMAP_V012.md) — minimal proposed mystery/discovery pilot and acceptance criteria.

The application release baseline is v0.12.0; these planning documents do not imply that proposed features are implemented. [ROADMAP_V011.md](docs/ROADMAP_V011.md) is a compatibility pointer from the older handoff. Historical version sections below remain release history. Current hosting remains GitHub Pages; no VPS migration is part of this documentation update.

**Brew → Taste → Compare → Discover → Improve**

A web-first specialty coffee learning game where players practice brewing, evaluate sensory qualities, compare past sessions, and record personal discoveries. **Discover Your Sixth Taste · From Coffee to Consciousness.** “Sixth Taste” is a metaphor for personal discovery, not a scientifically established sixth basic taste. The six sensory attributes are separate descriptors.

## One café screen — v0.12.0

The fourteen-visit story and tasting workbench share one viewport. Short, paginated dialogue replaces the scrolling main page; full passages, object facts, recipes, cabinet and older tools remain in explicit notebooks. Pour controls keep their position across stages. Optional rest questions open separately and pause the cup while reading. Existing local notebooks and recipe targets remain unchanged. See [play-screen notes](docs/PLAY-SCREEN.md).

## Daily café discoveries — v0.5.1

**What’s at the café today?** rotates a bean, tool or recipe introduction each
local day, with original owner dialogue, one fact and a connected practice action.
The first edition has 12 entries and explicitly repeats after the cycle. Browse
all entries anytime and save favorites in the local café notebook; no streaks,
penalties, accounts or backend.

Four new bean profiles are illustrative and have **no invented benchmark score**.
Tool/recipe trials preserve the selected bean, and active cups or unsaved notes
are protected before switching. [Content, limits and verification](docs/DAILY-DISCOVERY.md).

## v0.5 — Your First Shift

Choose **The First Pour · v0.5 → Play your first shift**. Mai guides a short
session: save a 180 ml-water brew with a deliberate pause, try B with one grind
step changed, then read back the A/B recipes. Complete the three goals to receive
a game keepsake. Free brewing and all v0.4 features remain available.

Progress follows saved actions, not flavor scores. Optional enjoyment/return
feedback stays local and can be exported; no analytics or backend. Old memories
stay readable. [Scope, compatibility and next engagement review](docs/V0.5.md).

## v0.4 — One Change, One Discovery

From a saved Coffee Memory, **Try one change** to brew B against baseline A.
Choose grind, temperature, ratio or recipe time; other fields stay fixed. Save
B, open its linked comparison and record what you noticed. **Brew this recipe**
restores any saved recipe for free practice. A last-saved-cup shortcut and
accent-insensitive history search make returning easier.

Six-axis SVG sensory maps use only your optional intensity ratings; missing
values stay missing and enjoyment is separate. Different feedback contexts are
flagged. v0.3 memories load without migration, and export/delete/recovery remain
available. No scientific model claims or backend changes.

See [v0.4 scope, compatibility and validation](docs/V0.4.md).

## Brew station — introduced in v0.3

Open **The First Pour · three stages** at the counter. Configure a fictional
Ethiopia Washed, Colombia Honey or Brazil Natural lot, dose, ratio, grind,
temperature and recipe time. Hold, use keyboard Space/Enter, or tap the pour
toggle through bloom → main pour → final pour. Each stage stops at its water
limit and waits for an explicit transition. Water streams and coffee droplets
animate independently: releasing the kettle lets coffee continue dripping into
the cup, and the result waits for the visual last-drop tail. Restart keeps the
recipe. The drawdown is an illustration, not a measured extraction model.

Save the resulting game recipe, optional six-axis subjective intensities,
enjoyment, notes and next change in a separate Coffee Memory store. Compare two
entries, export JSON and delete individual records with confirmation. Game
scores, reflections, self-reported real tastings and the existing actual-brew
measurement collector remain distinct. Data is local to this browser and may
be lost when browser data is cleared; export backups. No accounts, VPS or new
network service.

[Integration report and acceptance evidence](docs/V0.3-INTEGRATION.md) ·
[Supplied handoff](docs/design/v0.3/C6S_CODEX_HANDOFF_v0.3.md) ·
[Master GDD](docs/design/v0.3/TheCoffeeSixSense_Game_Design_Master_GDD.md).

## MVP gameplay
1. **Brew:** choose one of three starter beans and adjust dose, grind, water, temperature and pouring technique.
2. **Taste:** record aroma, acidity, sweetness, bitterness, body, aftertaste and personal impressions. Clearly distinguish simulated feedback from real-world sensory ratings.
3. **Compare:** review previous brews side by side, including settings and scores.
4. **Discover:** write hypotheses about what made a cup better or worse, preserving them in a personal Coffee Memory journal.
5. **Improve:** retry a brew using learned insights and earn progression rewards.

## MVP requirements
- Responsive web experience for desktop, iPad and mobile.
- Vietnamese and English localization.
- Local-first persistent session history and exportable journal data.
- Simple onboarding and replayable pour-over loop.
- Basic event tracking architecture, without launching advertising.

## Delivery plan
- **Phase 0:** audit and import existing prototype v0.1 code.
- **Phase 1:** complete end-to-end brewing and tasting loop.
- **Phase 2:** session history, comparisons, discoveries and progression.
- **Phase 3:** accessibility, mobile QA, analytics instrumentation and MVP release.
- **After MVP:** consider backend sync, domain, social accounts and marketing test.

## Constraints
- AI-assisted development; target AI/tool budget around USD 300.
- Web MVP first; native apps later.
- Initial marketing test budget USD 3,000, deferred until MVP is ready.
- No game-specific domain, social/advertising accounts or campaigns before MVP.

## Brew quests

The coffee journey includes four quests: save all three starter beans, record three discoveries, change exactly one setting between consecutive brews of the same bean and record the result, then save three brews of one bean with a simulated balance of at least 90. Quests unlock in order; existing saved history counts. Simulation goals are game mechanics, not objective taste measurements.

After changing frontend modules or styles, regenerate the GitHub Pages artifact and its local OCR assets with `npm run build:pages`. Run `npm test` and `npm run build`; tests reject a stale `docs/index.html`. Pages publishes this self-contained artifact through the manual Pages workflow.

## Personal beans (Phase 1 extension)

Players can photograph packaging and beans, review label details, fill missing fields and brew with their own coffee. Personal beans have no assumed target score. Profiles/photos stay in IndexedDB and can be exported. Packaging text is read locally on the player’s device using a bundled English/Vietnamese OCR engine; explicit label fields become reviewable suggestions. No VPS, API key or external AI service is needed. See [BEAN-AI.md](docs/BEAN-AI.md) for limits and reproducible builds.

## Status
The repository contains a playable Vite frontend with brew simulation, personal tasting reviews, local session history, comparison, discoveries and JSON export. Phase 1 provides a Vietnamese/English observation-and-choice pour-over game: quick start, three changing situations, immediate cause/effect feedback, optional tasting notes, save confirmation, and a one-change replay goal. History, comparison, four quests, XP and badges are available. The standalone Pages application is generated into `docs/index.html`. See [Phase 1 acceptance and validation](docs/PHASE1.md).

The active game is deployed on **GitHub Pages**. Legacy optional VPS preparation targets **https://cf.ta79.com** on Ubuntu/Nginx and is not required for the game. See [the deployment runbook](docs/DEPLOYMENT.md) for local verification, DNS, HTTPS bootstrap, restricted SSH deployment, approval gates and rollback. Production has not been provisioned or deployed by this change.

## Seven café days · v0.6.0

An optional seven-visit story chapter introduces returning guests, branching conversations, a code-drawn photo corner and invitations to the brew station. Continue at your own pace, skip any activity and revisit mementos on the café board. Progress is local to this browser; the finite chapter has an explicit ending. [Story, storage limits and checks](docs/SEVEN-CAFE-DAYS.md).

The v0.6.1 cast revision gives Linh Nguyễn (Vietnam / Asia), Luca Rossi (Italy / Europe) and Camila Santos (Brazil / South America) individual interests, coffee memories and optional bilingual profiles, while preserving existing chapter progress.

## Today at the café · v0.7.0

The main route now follows local calendar days: meet a different guest, hear a personal coffee story, discover the owner's bean/tool/recipe and optionally accept a randomly selected mini game. Match table cards, classify a sample label, compose a café picture, try brewing, or just listen. Same-day visits retain their state; no sequential chapter unlock or daily attendance penalty. Seven authored guests/stories and twelve owner introductions rotate and repeat. Earlier chapter progress remains available in an optional section. [Scope, limits and verification](docs/CAFE-DAY.md).

## Play the café story · v0.8.0

The home screen now opens on an illustrated, staged conversation rather than a dashboard: an incident, guest dialogue, your reply, a physical owner discovery, a contextual optional activity and an authored ending. Legacy practice is folded away. Scene position and inspection are saved compatibly with v0.7 days. [Scenes, captures, limits and checks](docs/CAFE-SCENES.md).

## Recipe provenance · v0.8.1

James Hoffmann’s Ultimate V60 example (30 g coffee / 500 g input water) now has a reference notebook with creator, original-video link, pinned corroborating transcriptions, steps and explicit practice adaptations. Reference practice uses cumulative 60/300/500 targets, retains the player’s unsourced game settings and has no invented taste score. Four preexisting recipe examples remain game-authored. The catalog now has thirteen entries; older visit discoveries are preserved. [Sources, verification limits and checks](docs/RECIPE-PROVENANCE.md).

### v0.8.2 · three attributed recipe guides

The source notebook includes Ultimate V60, A Better 1 Cup V60 and Kasuya 4:6,
with user-supplied verification summaries explicitly distinguished from direct
video review. Each has a real-time cue timer. Five-pour methods are guides rather
than forced adaptations of the three-stage practice station. See
[provenance and timing ambiguity](docs/RECIPE-PROVENANCE.md).

### v0.9.0 · the owner's fourteen-drawer cabinet

The primary café now has fourteen authored bilingual visits. The owner tells how
he collected eight coffees, three tools and three attributed recipes, with a
new guest, concrete discovery and optional contextual game each visit. Stories
advance by visits, not calendar dates; listening alone keeps the episode card.
The cabinet preserves completed stories and ends honestly after fourteen.
Previous notebooks and practice remain accessible. See
[season content, factual scope and validation](docs/CAFE-SEASON.md).

### v0.9.1 · digital brew scale

The practice station now has a code-drawn scale under the brewer, with cumulative
water and a brew clock that continues while waiting. Active pour time stays
separate. The g* display is explicitly a game-unit convention; recipes, graphics,
scores and existing memories retain their previous meaning. See
[digital-scale behavior and validation](docs/BREW-SCALE.md).

### v0.10.0 · brew with the owner

Every story now offers brewing its exact find, watching the owner demonstrate,
or listening only. Preparation and rest-time questions are part of the brew;
wrong answers never block progress. ORIGAMI and AeroPress have distinct drawings
and interactions; both five-pour recipes retain all five water targets. Completed
players can practice from their cabinet without resetting or changing old cards.
See [experience, factual limits and validation](docs/CAFE-TASTING.md).

### v0.11.0 · a cup of your own

Fresh visitors encounter Mocha discovery, AeroPress and separate Ethiopian samples
in their first three visits. Existing notebooks keep their order. Try an object
and brew early, choose flow/scale/quiet instead of a repeated preparation quiz,
and receive a personal cup with an owner response grounded in the recorded visit.
Music is reachable at the door and remains opt-in. See
[curiosity-loop changes, compatibility and validation](docs/CURIOSITY-LOOP.md).
