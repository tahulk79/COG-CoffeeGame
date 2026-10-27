# UI Audit (before UI-P1/P2)

> Date: 2026-10-27 · Scope: the Phaser HUD (`src/ui`, `src/scenes/HudScene.ts`) and world-space labels. Gameplay (M1–M12) is untouched.
> References: no approved concept images or screenshots were provided with the brief, so nothing here was compared against them. This audit is based on the code and on screenshots of the running game (docs/screenshots/ui-*.png).

## Architecture found
- **Scenes:** `WorldScene` (isometric world, input, camera) and `HudScene` (un-zoomed overlay, launched on top). Gameplay lives in the headless `GameSimulation`; the UI reads `sim.snapshot()` every frame and issues commands. Events go through the `EventBus`.
- **Café screen:** the café map (`cafe`) with `CafeHud` (right panel), `DecorHud`, `EmployeeHud`, `MetaHud`, `WorldMapHud`, `StoryHud`, and a `DebugPanel` at top left.
- **Camera:** `PlaceholderRenderer.frame()` fitted the map left of a fixed 346 px right panel. No top/bottom insets, no compact layout.
- **Assets:** none. Everything is Phaser shapes and text (`placeholderStyles.ts`); no atlas pipeline yet.

## Problems
| # | Area | Problem | Severity |
|---|---|---|---|
| 1 | Hierarchy | `CafeHud` was a 704 px tall right column mixing coins, queue, orders, brewing, supplies, ratings and stock as monospace text. The world was a small area left of it. | High |
| 2 | Debug | `DebugPanel` (coordinates, state names, event log) was always on at top left. World actors showed raw FSM state names (IDLE, MOVING, WORKING) under every character. | High |
| 3 | Style | Monospace type, flat `#1d1612` rectangles and text-box buttons in 9 files with colours hardcoded in each. No tokens, no rounded corners, no icons. | High |
| 4 | Navigation | "Trang trí quán", "Sổ tay", "Bản đồ" were separate floating buttons at different screen positions; the staff panel was permanently open at bottom left. | Medium |
| 5 | Feedback | No XP bar or level at a glance; no objective on screen outside the story; orders only as text lines. | Medium |
| 6 | Interaction | Hidden panels still captured clicks (Phaser keeps hit-testing children of an invisible container). Found while testing: a closed full-screen modal swallowed every click. Fixed with `setShown()`. | High (bug) |
| 7 | Responsive | Fixed pixel layout; on a 390 px wide screen panels overlapped each other and the world. Safe areas ignored. | High |
| 8 | Missing feedback | Rating/reward popups are small monospace text (`FeedbackPresenter`); no reaction animation; no interaction indicators or world-space drink bubbles beyond a text bubble. | Medium (UI-P3) |
| 9 | Panels | Farm, Station (processing/market), Decor and Employee panels are text-heavy forms. | Medium (UI-P4) |

## Behaviour recorded before refactoring
186 unit tests pass (`npx vitest run`); the E2E suite (27 tests) is the regression baseline for click-to-move, farming, processing, café, brewing, rating, decorate and save/load. The HUD button names used by E2E (`brew.*`, `supply.*`, `seed.*`, `plot.*`, `sell.*`, `equip.*`, `decor.*`) are kept.
