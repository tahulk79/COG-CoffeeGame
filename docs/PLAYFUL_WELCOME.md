# Playful welcome — v0.15 implementation

Owner direction: make the first encounter playful and a little absurd before introducing serious or reflective stories. Preserve existing mechanics, journals and progress. This increment is not a new divine-owner campaign or a rewrite of the fourteen episodes.

## Implemented

- Fourteen authored situations introduce the fourteen visits without repeating within that route: cup inspection, bell holiday, spoon compass, napkin exhibition, queue ticket, introverted sign, part-time clock, plant career advice, bag property negotiation, idle scale, indoor umbrella, forgetful notebook, sugar-jar directions and an unassigned key. Each has its own bilingual opening, three responses, labels and code-drawn object. The partner is a cat or owner, depending on the situation.
- Objects and partners are keyboard-accessible buttons, with situation-specific actions and visible pose changes. No drink is fed to the cat.
- “Help with a pour” starts the existing first self-brew without a story/quiz gate. The scripted route to first water is help → start → pour; optional interactions do not create a visit or award progress. The stream, scale, timing and targets are the existing model.
- “Enter café” retains the owner story and optional scale/postcard trail. Early mystery invitations are lighter; the first three fresh-route departure lines have a comic callback. Original ending passages remain in the notebook. Later episodes and source/science notes remain available.
- Existing players can use the Book → “Try the playful welcome · keep progress”. Return resumes the current view; trying a pour uses isolated cabinet practice when a visit already exists. Preview does not reset or overwrite the saved visit. Interrupted real brews are paused before entering preview.
- A bounded c6s.welcome-seen.v1 store remembers dismissed visit contexts without changing the season schema. Corrupt originals are not overwritten; storage failure falls back to session-only dismissal. No reset, season migration, dependency, backend, payment or analytics is introduced. The separately requested YouTube radio is included in this approved release; see CAFE-RADIO.md.

## Verification

- 145 unit/model checks, standalone build and Vite build pass.
- `scripts/smoke-cafe-welcome.mjs`: 320×568, 390×844 and 844×390, VI/EN; distinct cup/cat responses, reachable 44px targets, one-screen fit, language changes, first water, reload, old-player preview return and isolated practice preserving the stored season. Optional story-to-mystery entry passes.
- Existing notebook checks pass for mid-brew save failure/retry, checkpoint, optional questions, drafts/language, original recipe source and archived-card preservation.
- Discovery trail edges pass for map notebook, old v0.13 first receipt, classic completed books, watch-mode follow-up and paused AeroPress reload.
- Screenshots: review/playful-welcome/. No real-player fun score or retention result is claimed.

## Remaining limits

This is a small tactile/comic cold open, not a branching puzzle. It does not implement timing-dependent jokes, many alternate dialogue branches, a divine-owner reveal, therapy or a psychological narrative system. The original brewing workbench still follows the opening; its entertainment value and the transition into longer stories need human playtesting. Choice poses can reset on reload; the situation for that visit stays stable. Once dismissed, a greeting does not reopen during that visit. The preview advances through the finite repertoire, then cycles; no endless generated content is claimed. Existing brewing progress is retained.

Status: the owner approved v0.15 merge and Pages deployment. Exact publication and downloaded-artifact evidence belongs in SYNC_STATUS.md.

Additional verification: scripts/smoke-welcome-rotation.mjs traverses all fourteen visits at 320×568 VI, 390×844 EN and 844×390 VI, checks all greeting reactions fit, reload stability, persisted dismissal, optional story traversal, distinct preview rotation and byte-preserved completed books. Three unit checks cover the complete bilingual catalog and protected dismissal storage.
