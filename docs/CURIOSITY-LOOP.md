# v0.11.0 · a more inviting first three visits

The v0.10 audit found an inviting owner/café but repetitive early actions, quiz
questions repeating the story, generic completion receipts and a hidden music
control. This release changes the early loop and the feeling of finishing a cup.
It does not claim measured retention improvement or new validated taste physics.

## Fresh visitors and saved seasons

A genuinely fresh browser gets `route: curiosity-v1`: Yemen/Mocha → AeroPress →
Ethiopia samples, then the remaining eleven stories. The old V60 episode moves
to slot six. The canonical fourteen episode IDs and original array remain intact.
Every existing notebook (including an empty classic notebook), active cup and
completed story keeps its original order. No migration rewrites visited records.
Route-aware validation, cabinet labels, next-item teasers and exports use the
appropriate order. Unknown routes preserve the original bytes for recovery.

The first arrival offers picking up the Mocha sketch, alongside sitting down to
listen. The owner lets the player inspect a map sketch, seed/cherry or bag label.
At the first story beat, Try first opens the hands-on cup. Minimum primary actions
before first water fall from eight to four on this optional path: touch map →
try → start → pour. This is an interaction count, not a claim about human completion
time. The rest of the owner’s actual story remains in an optional fold during the
brew and in the collected archive; the ordinary full-listening route still works.

## Choose how to spend the cup

New tastings add optional `ritualVersion: 2`, `focus` and `manualPauses` fields to
the existing version-1 tasting snapshot. Choices are:

- **Flow:** choose a rest; the card acknowledges actual deliberate pauses. The
  first-rest prompt is about observing water within the setup, not repeating the
  chapter’s vocabulary question.
- **Scale:** remaining input to the current/next target is visible on the device;
  the rest-time question relates to the actual water target or AeroPress mass.
- **Quiet:** no mid-cup quiz, just the existing brewing/plunging and observation.

The preparation panel is a preference/action choice with no right answer, rather
than immediately asking the story’s answered question again. At most one rest
question is offered in a new cup, none during self pouring/pressing. Correct
answers remain optional. Goals lock when brewing starts. Changing a goal does not
change physical recipe quantities or invent an optimum for a coffee lot.

Old v0.10 tastings without ritual metadata retain their original question and
answer interpretation. Unknown/incomplete ritual metadata is rejected safely.
New pause counts only increment for an explicit user release/toggle after actual
water or plunger progress. Automatic target stops, blur, session pause and owner
demonstrations do not manufacture a self-brewing achievement.

## A cup to keep, and an owner who remembers

Completion now presents an original SVG cup/saucer/steam illustration, a short
owner line specific to the episode, selected Ethiopian sample where relevant,
and a takeaway based on the chosen goal and actual action. Decorative ceramic
colors vary with the goal; they are not predicted coffee color or flavor. Water
input and game time remain available under Look back at the actions. Watching is
identified as watching, partial play as partial play; neither becomes a claim of
real brewing skill or taste quality.

At the next arrival the owner refers to the previous recorded visit: watching,
a quiet cup, exploring the scale or choosing rests. This uses saved actions, not
an inferred enduring preference or fabricated personal history. Listen-only
visitors are welcomed too. Story cards still require no game win or streak, and
read-only cabinet practice does not rewrite old records or duplicate rewards.

## Sound and less interface narration

A header music toggle is reachable from the door and controls the existing
original synth loop. There is still no autoplay; only volume is persisted. A
short original synthesized cup-placement cue can play on completion only when
music was explicitly enabled, the context is running, the page visible and volume
nonzero. Muting disables it. No new recording, external font or media request.

The landing footer now speaks as a café invitation rather than describing authored
database content. Detailed simulation cautions sit in a disclosure; visible g*
and shortened-time notices remain. Scientific limits, creator provenance and
lack of real flavor/TDS/pressure prediction are preserved.

## Verification

- 127 automated checks; Pages and Vite builds. New checks cover the fresh route,
  all fourteen classic/fresh records, unknown routes, early discovery, early brew,
  goals/locking, v0.10 snapshots, genuine pause counts, exact item/sample/role on
  cups and fact-based owner memory.
- `scripts/smoke-cafe-curiosity.mjs`: fresh first three visits at 320/390/820/1440,
  Vietnamese/English; early water, map, AeroPress second, Natural sample third,
  flow/quiet/scale distinctions, cup feedback, greetings and reload. Additional
  old completed-season and v0.10 active-tasting compatibility checks.
- Full fourteen-visit tasting browser paths in self and watch roles, representative
  narrow phone/tablet/desktop routes, persistence and independent-cup safeguards.
- New-workbench control/scroll checks and prior legacy pouring-layout checks.
- Audio contract check: no oscillator before explicit enable, header context
  control, completion cue when enabled and silence when muted. This is not a
  subjective audio-quality or physical-device test.

Captures are in `docs/review/curiosity-v011/`. These are synthetic checks. A small
observed test with actual coffee-curious people is still needed to assess voluntary
return, novelty and learning recall. No D1/D7 figures or human-test results exist
for this release.
