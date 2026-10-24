# v0.10.0 · Brew with the café owner

After each of the fourteen stories, the primary invitation now names the same
bean, tool or method just introduced. Choose **I’d like to brew**, **Please brew;
I’ll watch**, or **Just the story today**. Side games remain in a separate optional
disclosure, preserving prior in-progress games. Story completion and keepsakes
never depend on a cup, question answer or game win.

## One continuous visit

The experience lives inside the current story rather than navigating to an
unrelated default Ethiopian cup at the legacy station. The exact episode ID and
item remain visible. Before brewing, the owner offers the episode’s contextual
knowledge question. A second question appears at the first rest: cumulative
water arithmetic, or water conservation during AeroPress plunging. There are no
question choices while a self-brewing player is pouring or pressing. Wrong answers
receive explanations and never lock the next action; asking for help or continuing
without an answer is allowed.

The owner demonstration is automatic after an explicit Start. It keeps user
answers null and explains the choices instead; its feedback says **watched**, not
**brewed yourself**. Pause/resume is available. In both roles, the recap describes
observed actions, input water and game time, never predicted taste, TDS, extraction
yield or a quality score. Early exit is described as partial participation.

## Actual methods represented

| Episode find | Water targets | Interaction |
| --- | --- | --- |
| Eight bean introductions | 30 → 150 → 240 g* with 15 g | Illustrative C6S V60 setup, not a validated lot recipe |
| HARIO V60 | 30 → 150 → 240 g* with 15 g | Cone, paper and pouring |
| ORIGAMI | 30 → 150 → 240 g* with 15 g | Separate folded-rib cone drawing and setup context |
| AeroPress | 225 g* with 15 g | One fill → illustrative steep → held/toggled plunge |
| Hoffmann Ultimate V60 | 60 → 300 → 500 g* with 30 g | Three cumulative water stages |
| Hoffmann A Better 1 Cup V60 | 50 → 100 → 150 → 200 → 250 g* with 15 g | Five pours |
| Kasuya 4:6 | 60 → 120 → 180 → 240 → 300 g* with 20 g | Five pours |

The Ethiopia episode offers **Washed** or **Natural** as separate samples; they
are not mixed. Sample selection locks once brewing starts and appears in the
recap. Other bean introductions retain their own episode identity instead of
quietly loading a different origin. Tools use an illustrative C6S coffee setup.

This is an accelerated interactive illustration, not a physical protocol
validation. Native author water targets are retained; real waits, flow rates,
stir/swirl, temperatures and extraction chemistry are not reproduced. In
particular, AeroPress’s three-game-second steep and four-game-second plunge are
illustrative pacing, not manufacturer brewing advice. The full creator/source
notebooks and real-time guides remain available, including the unresolved 1 Cup
1:55 / near-2:00 summary discrepancy.

## Graphics, scale and controls

Original code-drawn V60/server, distinct ORIGAMI cone and upright AeroPress are
used. AeroPress has a parked plunger while filling, a water stream, a steep and
an inserted moving plunger during pressing, followed by coffee in a cup. It is
never silently rendered as V60. No graphic engine, external media or new backend
is required. Original café music remains opt-in.

The digital scale follows the existing explicit convention **1 model ml = 1 g***,
not a real density conversion. Tare includes the setup and grounds; moving water
within the setup leaves cumulative input unchanged. The illustrations do not
measure pressure, retained water or real beverage yield. Brew time includes rests;
active pour time remains separate. Hold, keyboard hold and auto controls stop at
each target. Art, scale and control nodes stay mounted during all stage changes;
coaching changes in its own panel without interrupting a held pour.

Starting/resuming either café experience or a standalone practice cup pauses the
other. Direct controls as well as navigation can resume a paused legacy cup.
This prevents simultaneous hidden pours or a legacy-counter completion rerender
from interrupting the story. Recipes, volumes, artwork and saved legacy memories
are preserved.

## Progress and existing players

`c6s.cafe-season.v1` remains the season key. New visits optionally gain an
`experience` object (version 1, protocol ID, exact episode, role, sample, phase,
water, drawdown/plunge, timers and knowledge answers/help). Legacy records without
this field still load. Snapshot validation rejects unknown protocols, impossible
methods/amounts and malformed progress without overwriting original storage.
Game checkpoints save at phase boundaries, user actions, about once per game
second, and on page hide. Reload/language change resumes in a held state, awaiting
explicit input. Up to one checkpoint interval may be lost on abrupt termination.

An already completed season does not need resetting. Open a collected drawer and
choose **Try brewing this cabinet find**, or use **Try this find again** at goodbye.
These review practices are session-only: they do not rewrite completed records
or award duplicate cards. Main-visit recaps remain in the story archive. Notebook
exports now include the tasting profile registry alongside episode/source data.

All previous notebook, photo/OCR, journal, recipe, counter and First Pour memory
keys/schemas are unchanged. Older builds may expose recovery-only mode for new
completed experience records, preserving the raw data rather than interpreting
new completion metadata incorrectly.

## Validation

120 automated tests and Pages/Vite builds. Tests cover all fourteen profiles in
both self and owner roles, three/five-pour targets, AeroPress fill/steep/plunge,
question timing, optional wrong answers/help, waiting versus active time, sample
selection, versioned snapshots, legacy records and malformed recovery.

`scripts/smoke-cafe-tasting.mjs` plays the full fourteen-visit season in both roles
and representative AeroPress/ORIGAMI/five-pour routes at 320/820/1440 in VI/EN.
It checks exact item identity, no question choices during self pouring, mounted
art/scale/controls, saved roles, bilingual/reload checkpoints, optional early exit,
finite finale and non-destructive practice from a previously completed season.
Additional targeted checks cover independent legacy-cup water/art preservation,
mutual pause/direct-control resume, quota/corrupt session play and pointer/keyboard
hold/release. The old eight-case pouring-layout regression passes. A separate new-workbench
check at 320/390/1440 verifies control geometry and page scroll through pouring,
the first question and the next stage (`scripts/smoke-cafe-tasting-layout.mjs`).

Use `C6S_TASTING_FOCUS=1` for persistence/isolation checks only;
`C6S_TASTING_CAPTURE=1` refreshes selected method captures. Review images are under
`docs/review/cafe-tasting/`. These are synthetic Chromium checks, not human
retention evidence, physical device tests or measured educational validation.
