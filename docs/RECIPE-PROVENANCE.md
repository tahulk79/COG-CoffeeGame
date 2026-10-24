# Recipe provenance · v0.8.1

Add an attributed reference recipe rather than assigning a famous name to the
existing four game-authored examples. The first reference is **James Hoffmann,
The Ultimate V60 Technique**, the 30 g coffee / 500 g input-water example.

## What was verified

The original video link is https://www.youtube.com/watch?v=AI4ynXzkSQo . The
execution environment blocked direct primary-source requests. This release does
**not** claim to have watched or directly reviewed that video. It cross-checks two
independently published community transcriptions pinned to exact Git revisions:

- [Coffee Coach](https://github.com/edjw/Coffee-Coach/blob/5205fb1a29b6148763f15ae2f6b51df28598d499/src/routes/v60-by-james-hoffman/index.svelte)
- [Hoffmann calculator](https://github.com/mascent/james-hoffmann-calculator/blob/244ef16d3f7c64b6919d29e6f110a5539798b370/_recipes/V60_old.html)

Both point to the same video and support the 30/500 example, cumulative 60/300/500
water targets and 0:45/1:15/1:45 milestones. Coffee Coach gives a 2–3× dose bloom
range; the notebook chooses 2× (60 g), and says so. The calculator mixes ml/g
labels; reference water mass follows Coffee Coach's grams, without treating those
units as physically identical. See [structured evidence](evidence/recipe-provenance-v1.json).

The bilingual recipe text is newly written from those facts, not copied code or
an unreviewed video transcript. Temperature, numerical grind, final drawdown time,
flavor, TDS and extraction yield are not invented from these sources. A practical
recipe attribution is not scientific validation of the game or creator endorsement.

## Player experience

- A **Recipe provenance notebook · James Hoffmann** disclosure is available just
  below the story, plus a reference book in the free station's setup screen.
- Show creator, method, brewer, original link, reference dose/water, cumulative
  targets, timing, preparation/stir/swirl notes, pinned corroborating sources,
  verification status/date and explicit game adaptations.
- The full reference and a compact current-practice status are separate. Loading
  the reference keeps the chosen bean and existing game temperature, grind and
  model time. Those retained settings are visibly identified as game settings.
- Use exact 500/30 internally: an HTML decimal step must not block the form or
  round the target to 501. Editing amounts immediately marks a variation.
- A new stable `recipe-hoffmann-ultimate-v60` catalog entry is appended. All twelve
  previous IDs remain available; the catalog now has thirteen entries, including
  a fifth recipe. The first twelve retain their order; the extension can place
  two recipe introductions together rather than promising strict category alternation.
- Existing recipe cards/defaults/counter examples remain explicitly game-authored.
  Their numbers are not relabelled as Hoffmann's recipe.

## Practice and data rules

The station's original three-stage game remains accelerated. A versioned
`recipe.referenceId` selects cumulative targets **2× dose → 60% total → total**.
For the reference example this gives 60 → 300 → 500 nominal ml, rather than the
legacy game's 100 → 350 → 500. It does not reproduce real 45/75/105-second timing,
flow, stirring, swirling, extraction or water-density conversion. The real recipe
uses input mass; game ml is explicitly nominal and not actual beverage yield.

Reference-tagged practices receive `score: null`, including when using an existing
scored bean. Legacy recipes keep their original targets and scores. Source identity
survives setup capture, language, save/reload, rebrew and A/B. Switching protocol
is an explicit comparison difference. Memory cards/search identify the creator;
JSON exports include the used reference definitions, original links and limitations.
Unknown reference IDs are rejected rather than silently treated as game recipes.

Reference IDs are versioned; changing numerical method facts requires a new ID.
Older builds do not understand reference-tagged memories and may expose their
original-data recovery view; returning to this build reads them without migration.

The catalog extension also pins `discoveryId` on new/updated calendar-visit records.
Pre-v0.8.1 visits without that field retain their previous twelve-entry owner
rotation; extending the shelf does not retroactively change their owner item.
Original day, chapter, cup, actual-brew and bookmark keys are retained.

## Verification

- 101 automated checks; Pages and Vite builds.
- Four-width Chromium matrix (320/390/820/1440): source disclosure, exact 500 and
  native amount input validity, retained unsourced settings, changed-amount label,
  60/300/500 stops, stable control position/artwork nodes, active-cup keep/replace,
  null-score save/reload/rebrew, VI/EN, catalog entry and clearing attribution on
  resetting to a game preset. No external source/media request occurs automatically.
- Additional 390 px A/B, creator search and export including pinned reference data.
- Final 320 px check: adaptation warning/current variation are visibly outside the
  detailed source disclosure; old-day owner discovery versus a new calendar day
  retains the correct pre-extension identity.
- Legacy eight-case pour layout/scroll/focus/DOM-identity matrix and thirteen-entry
  catalog trials with midnight/dirty-note/storage recovery remain covered.

[Phone notebook](review/recipe-provenance/320-book.png) ·
[Desktop notebook](review/recipe-provenance/1440-book.png).
Captures and checks are synthetic. Direct primary-video review, actual Safari/mobile
hardware and measured educational outcomes remain outstanding.

## v0.8.2 · user-supplied verification summary

On 2026-10-24 the user supplied a source-verification summary of all three
videos. Registry status now distinguishes this from direct primary review by
this implementation team. No transcript or video file was received. Preserve the
original pinned secondary links as additional evidence for Ultimate V60.

Add Hoffmann's A Better 1 Cup V60 Technique (15/250, five 50 g pours) and
Kasuya's 4:6 Method (20/300, five 60 g pours), with author, original video,
user-reported equipment/grind/temperature, cumulative water targets and timing.
Drawdown times are approximate reference points, never taste scores. Kasuya's
40/60 guidance is attributed to that method, not treated as universal chemistry.

The 1 Cup summary contains a timing ambiguity: starting four 10-second pours
with 10-second waits at 0:45 ends the final pour at 1:55, while the summary says
all water by 2:00. Display the arithmetic schedule and explicitly disclose the
ambiguity pending an original transcript. Do not silently stretch a pour.
Kasuya's 45-second intervals are start-to-start; individual pour durations are
not established by the summary.

All three cards have a real-time guide clock with start, pause/resume, reset
and current-step cues. Monotonic elapsed time avoids background interval drift.
State survives language rerenders within this page; a page reload resets it.
The clock measures elapsed time only: a separate scale is required, and it cannot
confirm a pour or measure water mass, extraction or sensory outcomes.

The two five-pour references remain reading/timer guides and are explicitly
blocked from the legacy three-stage practice model. Only Ultimate V60 retains
the existing accelerated three-stage amount practice. No old memory protocol,
score, catalog rotation, daily story or animation is changed. This is an additive
reference feature, not a claim that five-pour graphics or recipes have been
physically validated.

Validation: 103 automated tests, Pages/Vite builds; Chromium timer checks at
320/390/820/1440 cover cues, pause/resume/reset, language continuity, safety and
horizontal overflow. Existing attributed-practice smoke checks remain applicable.
