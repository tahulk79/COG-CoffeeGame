# Rebirth · Hanoi — three-shift pilot, v0.17

The owner approved prototyping one city, one café and the first three shifts before expanding the seven-day reincarnation concept. This is an additive game mode, not a replacement of the existing fourteen visits, science, creator recipes, real-brew notebook or user records.

## Playable scope

A new player sees one of three brief, non-graphic absurd accidents, then a bureaucratic reassignment to employee **Hà Nội**. A fictional C6S café in a small Hanoi lane provides the setting. Street-front art, low stools and a delivery rider's helmet/raincoat are code drawn; these portray this fictional shop and its guests, not universal habits or costumes of everyone in Hanoi. Its pilot brew is V60, not a claimed phin simulation. The owner is Bảy. The seven-day deadline is story time, never an attendance requirement.

| Story day / shift | What the player does | Evidence for the game skill stamp |
| --- | --- | --- |
| 1 · Set up the counter | Match scale, pouring kettle and V60 to three functional requests | All three correct without mismatching. Wrong choices give recoverable feedback. |
| 2 · Duy's first order | Ask what the guest wants, distinguish hot unsweetened filter from milk/iced choices, then actually pour a complete cup | Correct order without wrong selections, completed self-brew, and at least one deliberate mid-pour stop. Automatic target stops do not qualify. |
| 3 · Busy counter | Dispatch three tickets: a ready takeaway, plain water and a fresh filter order using two bean portions | All delivered with no duplicate/premature work or recovery. Multiple sensible service orders work; this is turn based, not real café throughput. |

Day/shift transitions have explicit context and recurring guests. A short debrief connects setup, asking, observation and ticket reading. The seven-day return decision, shifts 4–7, other cities, supplier campaign and full professional simulation are **not implemented**. The end screen says so. These are fictional game stamps, not professional brewing qualifications.

Two dispatch mistakes lead to a temporary comic alpaca branch during the trial. Ringing for Bảy's help replenishes the trial station and resumes shift 3 while retaining prior receipts/XP. Trying to grip a kettle with hooves gives a gag and recovery hint. This is a recoverable pilot branch, not a final day-7 judgment or lost account. Recovery attempts do not earn an excellent stamp; replay can improve it later.

## Progression and feedback

The first completion of each shift earns 40/60/80 XP, at most 180. Levels 1–4 correspond to setup, first-order brewing, queue dispatch and the debrief/replay options. Replay can upgrade best skill evidence but cannot farm XP or downgrade an existing stamp. The criterion is visible before each task. Completed evidence is validated on load, including the actual finished model cup and reconstructed queue actions/resources; no security against users editing their own local files is claimed.

## Reuse and scientific boundary

`newTasting`, `tastingAct`, `tickTasting` and `validTasting` are reused unchanged for the existing illustrative 15 g / 240 g* V60 setup. The rendered kettle, V60, server, stream/drips and 600 ml visual-capacity mapping are reused with distinct DOM IDs. Water, active pouring and game time update on the scale. Input targets stay cumulative. Timing is accelerated, retention is simplified, and no real flavor, TDS, extraction yield or pressure is predicted. Choosing a milk/iced menu item in the wrong-order path does not simulate those drinks.

The old tasting/season/real-brew/bean models and original recipe/source registry remain unchanged. The campaign owns its own UI and separate `c6s.rebirth.hanoi.v1` profile; classic journals are not migrated or reset. No dependencies, backend, telemetry, premium economy, schema migration or external messages are introduced.

## Entry, persistence and coexistence

- Fresh players without existing café visits default to the new pilot. Existing players keep their current café view, and enter via **Book → Rebirth · Hanoi · first 3 shifts**, now at the top of the book.
- “Classic café” returns to the existing mode. An explicit `c6s.rebirth.mode` preference remembers the chosen mode. Campaign and classic DOM remain separately mounted; entering another mode pauses the active cup.
- Cup checkpoints save periodically and on control/pause/language/visibility actions. Reload resumes the cup paused. Cozy/AFK uses the existing pause/checkpoint events and preserves campaign position.
- Invalid/future campaign data is protected, with original export and session-only play. Quota failures retain the previous raw checkpoint and expose retry/export; an earned in-session receipt is not described as durably saved until a write succeeds.
- Normal task panels scroll internally on short screens; outer-page layout stays in one viewport. The compact brew controls keep their position between pour stages, with a landscape arrangement. Full coach/model notes are optional disclosures.

## Validation

155 unit/model checks pass, including seven new model checks for evidence-gated progression, multiple queue orders, resource conservation, real finished-cup proof, deliberate stops, recoverable failure, replay idempotence, malformed data and checkpoint round trips. Standalone Pages and Vite builds pass.

`smoke-rebirth.mjs` plays the three shifts in Chromium at 320×568 VI, 390×844 EN, 844×390 VI and 1280×800 VI. It checks visible controls/outer viewport, fixed pour-control positions, no rig/status overlap, actual water/time progression, capped XP, reload, replay and classic exit/return. Edge paths cover alpaca/recovery, cozy and automatic AFK pause, language/reload, quota/retry, corrupt-original protection and byte-identical classic mid-brew data after playing the new mode.

Existing cozy/listening, notebook/save-retry/source and legacy discovery-trail edge regressions pass. Legacy smoke fixtures explicitly select classic mode so their existing behavior remains testable alongside the new default opening. Evidence captures are in `review/rebirth-hanoi/`. These are scripted/browser and model checks, not human enjoyment or retention measurements, physical-device/Safari testing or proof of professional skill. Public release evidence belongs in SYNC_STATUS.md.
