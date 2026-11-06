# V3 QA report — overnight rebuild (2026-11-06)

Branch `feat/v3-rebuild` (safety tag `checkpoint/pre-v3`). Nothing pushed, merged or deployed.

## Automated
- `npm test`: **42 / 42 pass** — reducer, farm loop, café, building placement, land, staff, Rounds (charged exactly once, tx idempotent), Level-10 reset rules + idempotency + reload recovery, rebirth, world access, store persistence/corrupt recovery, v1 migration, tutorial, i18n completeness (en+vi), economy sim (L10 at ~19 min, no softlock after reset, Round 2 at ~48 min), edge cases (prototype-name ids, junk payloads, tx log).
- `npx vite build`: passes, no warnings. App JS 170 kB (59 kB gzip) + three 695 kB; realm 66 kB, HUD 34 kB, atlas 21 kB lazy-loaded.

## Browser E2E (Claude in-app browser, dev server, `?profile=test` isolated save)
Played by real taps/drags at 375×812 portrait, plus 1280×800 desktop and 844×390 landscape layout checks.

| Flow | Result |
|---|---|
| Character select → intro (skip) → Teacher (dialogue + claim 3 credits; also Skip path grants credits) → atlas | PASS |
| Atlas: country → region sheet (New / Needs Round 2 / Expired–resting) → enter region | PASS |
| Tutorial: plant (tap + drag multi-plant) → harvest (drag sickle) → take order → brew → serve (+coins) → build roaster with green preview → upgrade storehouse → buy field F2 | PASS (camera focuses each target; refocuses if target leaves the screen) |
| Level 10 → pause + cinematic + Teacher dialogue → **reload mid-event resumes** → reset → atlas "choose a new place" | PASS; verified save: coins/XP/round/credits/beans kept, land F2 kept, buildings back to starter Lv1, crops cleared, `-pre-expiry` backup written, old region "Expired – resting" |
| New region → Round 2 unlock with confirm, double-tap on confirm | PASS — charged 1,800 exactly once, credits unchanged |
| Rebirth (confirm) | PASS — 1 credit spent, +grow blessing, coins unchanged |
| Staff: hire Farmhand + Sprout-bot, auto-assigned, robot visible | PASS |
| Console errors during all flows | none |
| Performance (`?fps`, desktop GPU, high quality) | 58–60 fps, 105–126 draw calls (134 when fully zoomed out) |

## Not verified / known gaps
- Not tested on a real phone (only emulated viewport); real-device fps unknown. Quality auto-drop logic from the old app is kept.
- Round 3 / country unlock tested only by unit tests, not clicked through in the browser.
- No new 3D models were generated (Blender/Meshy not used): existing GLBs + procedural props. Teacher uses `heaven/clerk.glb` (figure with a desk).
- LOD/frustum-culling work beyond Three.js defaults was not done; instancing/merging is used for scenery, fences, beds, decor.
- Customers walk straight lines (no crowd avoidance); sign labels draw on top of buildings.
- Workers/robots give passive bonuses only (no automation), as specified.
