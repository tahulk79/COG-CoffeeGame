# Rebirth · Hanoi — seven-shift campaign

**v0.19 opening update:** fresh players first encounter an illustrated, interactive webtoon prologue. They help with the first 30 g pulse before hearing the seven-shift mission, then enter the original tool challenge. Existing players have a progress-preserving Book preview. See [WEBTOON_OPENING.md](WEBTOON_OPENING.md) for current entry, art, persistence and validation. The HUD now uses seven shifts / 600 XP from the beginning, superseding the v0.18 early 180 XP display described below. The other v0.18 campaign details and original v0.17 history remain applicable.


The owner asked to continue after the deployed v0.17.1 entry fix. The original three-shift pilot below remains as historical implementation detail. v0.18 adds a bounded four-shift continuation and both day-seven story outcomes, preserving the original campaign, classic café, animations, cozy listening and journals. One fictional Hanoi café remains the only city; this is not a professional simulator or barista credential.

## New playable continuation

| Shift | Player interaction | Stamp requirement |
| --- | --- | --- |
| 4 · Particular request | Confirm that Mai accepts decaf's residual caffeine; inspect the DECAF bag before selecting it | Ask, read and select correctly without mistakes |
| 5 · Supply shortage | Toggle a supply cart containing bean portions, papers and a tempting cat poster; meet two-order needs within five fictional tokens | Confirm an adequate cart within budget on the first attempt |
| 6 · Untared scale | Measure empty server (120 g) and server plus water (360 g), then infer the 240 g difference | Inspect both readings and select the supported inference, without taring the loaded server or discarding it |
| 7 · Final counter | Route four tickets using one regular and one decaf portion and a single reusable server | Deliver the ready tray, water, confirmed decaf and regular cup without duplicate or mistaken actions |

There are multiple valid inspection/service orders. Each challenge provides recoverable feedback. Resetting a station preserves prior XP but disqualifies that attempt's stamp. Replays retain the best proof and cannot downgrade existing stamps. New rewards are 90/100/110/120 XP, capped at 420; combined campaign cap is 600 XP and eight game levels. The early three-shift view retains its original local 180 XP scale until the continuation starts; the combined scale then displays all seven shifts.

Complete all seven shifts with **at least five excellent stamps out of seven** for the return ending and a fictional C6S spoon keepsake in the ending narrative. Otherwise become a temporary **capybara stool tester**; replay missing stamps to return. Review/replay of the first three shifts stays available from the ending. There is no real-world deadline, account deletion, XP loss, payment, permanent failure or second city. No separate collectible inventory or equipment shop is claimed.

## Scientific and gameplay limits

Decaf is not guaranteed caffeine-free. The guest explicitly accepts that distinction; the game does not advise that decaf is medically suitable for everyone avoiding caffeine. Roast color is not treated as a caffeine measurement. The scale puzzle weighs water separately without grounds; it does not equate real collected beverage mass with water input, or infer extraction/flavor. Supply tokens and single-click counter brewing are abstract game actions, not a new calibrated brewing simulation. Actual interactive pouring and stream/drip animation remain in shift 2 and the original practice mode. The other shifts are compact decision/resource puzzles, not four new pouring minigames.

## Additive persistence and verification

`src/rebirth-week.js` owns separate `c6s.rebirth.week.v1` storage. It validates bounded action histories, reconstructs resource/evidence states and rejects invented or skipped-day completion. No migration or writes to `c6s.rebirth.hanoi.v1` occur from continuation actions. Corrupt/future originals remain protected with export; quota failure keeps the previous checkpoint and offers retry/session export. Stored completion is local convenience, not anti-cheat.

162 unit/model tests and standalone/Vite builds pass. `scripts/smoke-rebirth-week.mjs` covers four viewport sizes (320×568, 390×844, 844×390, 1280×800), full continuation, reload, language change, both endings, replay improvement, XP cap, classic return, byte-identical original campaign, corrupt data and quota/retry. Earlier three-shift and entry regressions remain applicable. These checks do not measure human enjoyment, D1 retention, actual professional skill or physical-device/Safari behavior. Release publication evidence belongs in SYNC_STATUS.md.

---

## Historical v0.17 three-shift pilot


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

- Fresh players without existing café visits default to the new pilot. Existing players keep their current café view, with a prominent main-screen **Play Rebirth · Hanoi** button and **Book → Rebirth · Hanoi · first 3 shifts**. `?mode=rebirth` explicitly opens the existing campaign even when classic mode was previously chosen; no profile is reset. Choosing Classic café removes that query override and remembers the choice.
- “Classic café” returns to the existing mode. An explicit `c6s.rebirth.mode` preference remembers the chosen mode. Campaign and classic DOM remain separately mounted; entering another mode pauses the active cup.
- Cup checkpoints save periodically and on control/pause/language/visibility actions. Reload resumes the cup paused. Cozy/AFK uses the existing pause/checkpoint events and preserves campaign position.
- Invalid/future campaign data is protected, with original export and session-only play. Quota failures retain the previous raw checkpoint and expose retry/export; an earned in-session receipt is not described as durably saved until a write succeeds.
- Normal task panels scroll internally on short screens; outer-page layout stays in one viewport. The compact brew controls keep their position between pour stages, with a landscape arrangement. Full coach/model notes are optional disclosures.

## Validation

155 unit/model checks pass, including seven new model checks for evidence-gated progression, multiple queue orders, resource conservation, real finished-cup proof, deliberate stops, recoverable failure, replay idempotence, malformed data and checkpoint round trips. Standalone Pages and Vite builds pass.

`smoke-rebirth.mjs` plays the three shifts in Chromium at 320×568 VI, 390×844 EN, 844×390 VI and 1280×800 VI. It checks visible controls/outer viewport, fixed pour-control positions, no rig/status overlap, actual water/time progression, capped XP, reload, replay and classic exit/return. Edge paths cover alpaca/recovery, cozy and automatic AFK pause, language/reload, quota/retry, corrupt-original protection and byte-identical classic mid-brew data after playing the new mode.

Existing cozy/listening, notebook/save-retry/source and legacy discovery-trail edge regressions pass. Legacy smoke fixtures explicitly select classic mode so their existing behavior remains testable alongside the new default opening. Evidence captures are in `review/rebirth-hanoi/`. These are scripted/browser and model checks, not human enjoyment or retention measurements, physical-device/Safari testing or proof of professional skill. Public release evidence belongs in SYNC_STATUS.md. The v0.17.1 entry smoke covers visible main-screen entry, forced deep links, preserved profiles and explicit classic return across four screen sizes.
