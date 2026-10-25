# Three-clue postcard trail — v0.14.0

Task: `C6S-POSTCARD-TRAIL-01`. Workspace implementation on canonical main `d6b0936faed60bac65baef9ec36a40b16e47cf10`, following the owner’s request to address the pure-gamer review. The owner approved publication, merge and GitHub Pages deployment as v0.14.0, followed by a review for players who do not yet like coffee. Actual release evidence belongs in SYNC_STATUS.md.

## Player-facing change

A short optional owner-led goal now connects the first three **fresh-route** visits: help send a forgotten postcard with the right coffee parcel. The main green invitation offers this activity immediately, without requiring the preceding lore pages. Normal storytelling, ordinary self/watch brewing, quiet play and listen-only keepsakes remain.

| Clue | Play | Consequence |
| --- | --- | --- |
| Yemen · 1/3 | Predict, stop input, compare actual internal water-transfer traces | Existing inspection lens unlock; original first-discovery receipt retained. |
| AeroPress · 2/3 | Use the lens on a paused partial plunge; try whole-setup versus cup-only scale placement on a virtual diagram, then choose the reading for the contents of the cup | A postcard/address fragment and a next clue that is actually playable in the Ethiopia visit. |
| Ethiopia · 3/3 | Inspect two illustrated bags, compare their labels with ETHIOPIA · WASHED, correct a mismatched choice and select the matching sample | The matching sample is selected on the actual workbench. A full postcard becomes a persistent decoration pinned in the café window and a journal keepsake. |

This adds two bounded follow-up games, not ten nominal levels or a new engine. No fourth postcard quest is advertised as implemented. The fourteen authored visits and their classic/fresh ordering remain unchanged.

The primary investigated path reaches the first water with four actions: help the owner → predict → start → pour. This is an interaction count on a scripted route, not organic discovery/completion data or a timing estimate for human reading.

## Specific review findings addressed

- The first green action now leads into play rather than a long chain of story-next buttons; the owner states a goal that does not require a prior interest in coffee.
- “Pick up the map” now opens the actual map in its notebook and scrolls that object into view. Other object choices live in that notebook to avoid pushing the main actions below a 320×568 screen.
- The lens has a distinct next job and leads to a second interaction type, not just additional numbers.
- Live/current-cup inspection is separated from archived Yemen evidence. Unrelated methods show the old trace inside an explicitly labeled saved-Yemen disclosure rather than presenting it as a current measurement.
- The reward is visible in the café, with an owner response and a three-part journal. Replay never duplicates first rewards.
- Existing players with the v0.13 lens can open the next already-visited clue from the discovery journal. Route-aware archive lookup uses episode IDs; it does not reorder or reset an older season.
- Main clue invitations prioritize the new owner line; the original passage and earlier welcome remain in the notebook. The underlying story registry is retained.

## Science and fiction

The postcard/customer thread and its reveals are authored fiction. They do not change the coffee equations.

The AeroPress comparison uses actual `water`, `collected` and `elapsed` values from the existing model, captured at a partial plunge with fixed 225 g* input. Whole-setup and cup-only readings are derived from the same held instant. Cup-only weighing is explicitly hypothetical with the brewer separately supported, tare applied and no hand force on the scale. The actual bench scale continues to show whole-setup input; its placement/physics is not secretly changed by the diagram. Current game timing, retention omissions and lack of pressure/TDS/flavor prediction remain disclosed.

The bag task uses authored labels for the two samples already represented by the Ethiopia episode. Matching WASHED selects that existing sample; it does not infer taste, quality or provenance from appearance, or create an invented flavor difference between the two samples. The label illustration does not populate a real personal-bean profile.

## Persistence and compatibility

- Existing season/tasting/First Pour/counter/photo/real-brew schemas and records are preserved. No database or dependency migration occurs.
- `c6s.discovery-lab.v1` gains an optional `trail` object, version 1, with one active follow-up and first receipts for the two new clues. Old v0.13 records load without inserting that field or changing their first-discovery receipt.
- New receipt writes are atomic within the discovery store. Their roles, conditions, snapshots/label choices and completion dates are distinct from real-brew observations. The export remains `game_discovery_not_real_brew` and includes the optional trail.
- Unknown/malformed trail data is protected with the original raw value. Existing retry/session-backup behavior is reused; no upload, analytics, currency or new XP is introduced.
- A single active attempt is retained. Starting another investigation replaces that active attempt, while first-completion receipts remain. Archive rehearsal keeps the existing session-only tasting behavior and never rewrites a completed season.
- Reload at a held AeroPress observation restores a visible clue action. The case can be completed or abandoned; native dialogs support Escape and focus return. Main art, scale and brewing controls stay mounted.
- The discovery journal refreshes when opened, so archive links follow current visited/saved episodes rather than a stale earlier render.

## Verification

142 unit/model tests pass, including seven new tests for v0.13 round-trip compatibility, prerequisite ordering, actual self/watch AeroPress traces, both-position inspection, recoverable wrong choices, matched-label selection, idempotent first receipts and protected unknown data.

The main three-clue browser path passes at 320×568, 390×844, 820×1024 and 844×390 in VI/EN. These are Chromium viewport simulations, not physical-device tests. Checks include all three clues, wrong/correct placement and bag choices, fixed main controls, the workbench's selected sample, persistent window decoration and journal count after reload.

Additional checks pass for:

- Immediate map display and safe return to a fitted main screen.
- An old v0.13 lens receipt, classic completed fourteen-visit book, direct journal-to-next-clue navigation, watch-mode investigation/resume and byte-identical original season data.
- Reload at the partially pressed observation with a visible next action.
- The earlier scale pilot's checkpoint/language, opt-out, quota/retry/corrupt storage, completed-book and next-method cases.
- The six-size bilingual single-screen/control-layout regression and the save-retry/source/draft notebook regression, updated to explicitly close the now-visible map.
- Standalone Pages generation and Vite build.

All tests use isolated/fixture browser storage. No actual user data was reset, and no human enjoyment/retention study has been performed. The structural changes support the design hypothesis; they do not establish D1/D7 retention or MVP appeal.

## Review captures

[First invitation](review/postcard-trail/entry.png) · [Scale placement](review/postcard-trail/scale-position.png) · [Bag labels](review/postcard-trail/bag-labels.png) · [Postcard reward](review/postcard-trail/reward.png) · [Pinned in the window](review/postcard-trail/pinned.png).

## Reproduce

```sh
npm run build:pages
npm test
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-discovery-trail.mjs
C6S_TRAIL_SKIP_MATRIX=1 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-discovery-trail.mjs
C6S_SCREEN_SKIP_VISITS=1 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-cafe-screen.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-cafe-screen-notebooks.mjs
```

Publication is approved. See SYNC_STATUS.md for actual merge, deployment and public-artifact verification.
