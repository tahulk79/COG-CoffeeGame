# Webtoon cold open — original v0.19.0 design

**Superseded pacing in v0.21:** the owner rejected the abrupt early-pour approach. The current flow establishes C6S and Bảy, adds playful curiosity and offers Try / Watch / Sit longer before any new cup. See [WELCOME_PACING.md](WELCOME_PACING.md). The original artwork, model limits and preservation principles below remain relevant; the three-interaction target is historical.


The owner approved the opening review's recommendations and requested actual webtoon illustrations. This release adds a short visual prologue before the existing seven-shift Hanoi campaign. It does not rebuild the campaign, migrate profiles or replace the pouring model.

## Player flow

1. One of three illustrated absurd accidents: slipper, hanging sign or goose. Choose left/right; both lead to a bloodless cartoon bonk, with different comic copy. The opening is deliberately a fixed story premise, not a survivable dodge challenge.
2. Two webtoon panels show the bonk and the ghost's bureaucratic reassignment. One short exchange and one Continue button.
3. Bảy hands over the kettle. The third intentional interaction can already pour: hold/release or toggle, with a real updating scale, timer, stream and drips. No tool quiz or order-selection menu blocks this first interaction.
4. Help with the **first 30 g pulse only** of the existing illustrative 15 g / 240 g V60 model. The target auto-limits. Releasing pauses input while existing liquid continues draining. Bảy explicitly finishes the remaining pulses in the story; the player is not awarded a complete cup, game XP, skill stamp, measured flavor or professional qualification for the opening.
5. Duy thanks the café. Bảy's response differs if the player deliberately stopped to observe. Only now does the system explain seven shifts, five excellent stamps and the recoverable capybara assignment. The player accepts the apron and enters the original tool challenge.

The tool challenge now shows each correctly selected tool placed on a counter, with short context-dependent coaching instead of repeating the whole owner introduction. Original receipts, XP caps, week progression and scientific boundaries remain intact. After the prologue, the HUD consistently displays the whole seven-shift / 600 XP campaign rather than changing its denominator midway. The rest of the seven-shift campaign remains a mixture of pouring and decision/resource puzzles; this release does not claim to illustrate all later conversations.

## Art and presentation

`public/art/rebirth-webtoon.png` is one original AI-generated nine-panel atlas, generated for C6S using the image generation tool. It contains no baked-in dialogue. Three accident panels, the cartoon bonk, ghost office, café arrival, owner coaching, guest service and animal gag share a recurring protagonist/owner and a warm green/amber Hanoi setting. `webtoonPanel()` displays the individual cells through SVG viewBoxes without cropping or altering the source file. All VI/EN dialogue stays accessible HTML. Descriptions remain available when art cannot load.

The source sheet is about 3.2 MiB. Browsers reuse the same URL for the nine views. Vite copies `public/art`; the standalone Pages builder copies it to `docs/art`. Both artifacts require that asset alongside HTML; the PNG is not embedded as a large base64 script. Constrained-bandwidth loading is not benchmarked. Short CSS movement provides a bonk/placement effect; reduced-motion preference disables it. There are no video cutscenes, added libraries, paid assets or hidden YouTube players.

## Persistence and entry

- Fresh/uncompleted intro profiles get the webtoon opening automatically. Existing players already beyond the intro retain their current campaign.
- `Book → Webtoon opening · preview, keep progress` or `?mode=rebirth&opening=preview` opens a session-only preview. It preserves campaign, continuation and actual opening records. Completing preview removes the URL override and restores the existing campaign screen.
- A separate `c6s.webtoon.opening.v1` profile records the selected dodge, scene and actual partial model cup. No migration of `c6s.rebirth.hanoi.v1`, `c6s.rebirth.week.v1` or classic journals occurs.
- Flow saves periodically and on explicit actions/pause. Reload restores the scene with pouring paused. Cozy, blur, hidden-tab and language changes pause/checkpoint. A pulse paused during final drainage exposes an explicit Resume drips button.
- Invalid/future originals are not overwritten; export includes both session and protected original. Quota failure retains the prior checkpoint, shows retry/export and does not claim a durable save.

## Verification

168 unit/model checks and standalone/Vite builds pass. New checks cover scene gating, partial-cup proof, input/drain conservation, released input, checkpoint validity, protected originals and asset parity. `smoke-webtoon-opening.mjs` loads the actual art and plays the new flow at 320×568 VI, 390×844 EN, 844×390 VI and 1280×800 VI, checking visible actions, no outer overflow, actual stream/drips, delayed mission, reload and tool handoff. Additional paths cover old-player preview byte preservation, language/cozy/reload pause, corrupt data, quota retry and paused-drain recovery.

The original three-shift browser smoke deliberately seeds a completed opening to continue exercising persisted legacy intro, actual full-cup pouring, classic preservation and cozy/AFK paths independently. The four-size week continuation regression passes. These are scripted checks and visual review, not measured human enjoyment, 20-second onboarding, retention, physical-device or Safari evidence. Deployment proof is recorded separately in SYNC_STATUS.md.
