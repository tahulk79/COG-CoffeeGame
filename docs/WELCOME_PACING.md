# Welcoming the player before the coffee — v0.21.0

The owner found the v0.19/v0.20 opening too abrupt and serious: a player was handling a kettle before understanding the café or meeting the owner. This release supersedes the earlier target of reaching water flow in three interactions. The priority is context, a playful welcome and a voluntary first interaction. It does not set a required onboarding duration or claim measured retention gains.

## Revised opening

1. **Absurd accident and limbo.** The familiar left/right comic dodge stays. The system now directs the player to C6S rather than immediately assigning a brewing action.
2. **Meet Bảy.** A brief passage establishes C6S, the Hanoi café, the player's reincarnation and their apprentice role. Optional questions about going home, salary and the assigned name get different replies. No question is required or marked correct.
3. **Settle into the café.** Tap the bell, apron or low stool for small original gags. These props are illustrated UI story interactions, not a free-roaming 3D system. Choices persist in the real opening profile. The player can stay, use existing music/cozy rest, or approach Bảy when curious.
4. **A genuine invitation.** Duy arrives for a takeaway. Bảy offers three choices: try a small pour, watch him demonstrate, or sit a little longer. Declining returns to the café without starting a cup or losing progress. There is no countdown or XP penalty.
5. **Try or watch.** Self mode retains hold/release/toggle and the existing first-30-g pulse. Watch mode uses the existing model's watch role and offers pause/resume or return to the seat. Leaving cancels animation/flow; it cannot keep pouring in the background. Completed narrative explicitly credits Bảy for a watched brew.
6. **Discover the mission.** After the guest interaction, the player can inspect the transfer form and learn the seven-shift / five-stamp return objective. Bảy's reply stays reassuring. The existing campaign starts only when the player accepts the first shift.

## What is preserved

The existing webtoon sheet and cozy counter art are reused. Framing favors the owner's face on wide screens. No dependencies, new backend, generated asset downloads or real-brew/science changes are required. The 30 g pulse is still an accelerated illustrative first pulse of the same 15 g / 240 g model, not a completed cup or a professional qualification. The opening awards no XP/stamp; watching does not create self-brewing evidence for the seven-shift campaign.

The separate opening key remains `c6s.webtoon.opening.v1`. Optional `chat`, `look` and `invitation` fields and new scene values extend the existing format. Old self-pour and completed checkpoints without these fields remain readable without rewriting or resetting them. A watch checkpoint requires an explicit watch invitation. Corrupt/future originals remain protected. Existing mid-pour players resume their checkpoint; the Book/`opening=preview` link lets returning players see the revised beginning without altering their real opening or campaign records. Preview remains session-only; reloading it starts the preview again.

## Verification

172 unit/model checks pass, including welcome/consent gates, harmless conversation/prop branches, decline/reentry, distinct watch evidence and legacy checkpoint compatibility. Standalone/Vite builds pass. The updated four-size Chromium opening smoke checks actual artwork, visible controls, greeting and curiosity before any pour, decline/reentry, VI/EN/reload, optional self pouring, watch pause/resume/exit, no hidden continued flow, preview profile preservation, quota/corrupt protection and drain recovery. Existing full-cup/legacy-profile, cozy counter and seven-shift regressions also pass.

These checks establish behavior and layout in the tested browser. They do not measure whether real players find the jokes funny, how long they read, retention, Safari or physical iPad behavior. Release evidence is recorded separately in SYNC_STATUS.md.
