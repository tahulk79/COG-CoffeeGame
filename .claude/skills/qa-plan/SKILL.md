---
name: qa-plan
description: "QA test plan for a Godbean feature (F-xx) or screen: classifies checks as Logic/Integration/Visual/UI, maps existing node tests, lists manual cases for mobile and desktop, defines smoke scope."
argument-hint: "[F-xx | screen-name | path-to-doc]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
model: sonnet
---

# /qa-plan (Godbean adaptation of CCGS `qa-plan`)

Godbean has no sprints/stories: the unit of work is a GDD feature row (F-xx) or a screen.

1. Resolve the target: F-xx row in `docs/design/godbean-gdd.md` §0.3, or `docs/screens/<NN>/` docs. Read its rules.
2. Inventory tests: `tests/*.test.js` (runner: `node --test tests/`). Map which rules each test covers (grep the imported functions).
3. Classify each rule:
   - **Logic**: pure functions in `src/features/*/rules.js|model.js|content.js` → must have a node test.
   - **Integration**: save/load (`src/state/`), screen transitions (`docs/game-flow.md`) → node test where possible, else manual.
   - **Visual**: 3D scene, VFX, assets → manual screenshot check.
   - **UI**: HUD, modals, touch, overflow → manual at 375×812 and desktop.
4. Output a plan (in chat; write to a file only if the user asks, never commit test results):
   - table: rule → type → existing test (file) or "MISSING" → manual steps
   - smoke list (≤10 steps) covering: farm, café, shop, world map, tutorial, hire/auto, progression, save/load, mobile + desktop viewport, console errors
   - gaps ranked by risk.
5. Browser automation: none installed. If the plan needs it, propose Playwright as a separate decision. Do not install.
