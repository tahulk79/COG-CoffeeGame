# v0.9.1 · code-drawn digital brew scale

The First Pour station now places a digital scale beneath the illustrated V60
setup. It shows large fixed-width timer and cumulative-water digits, a stage
target, auto-tare label and pouring/draining/waiting indicator. The illustration
is original HTML/CSS; no image, external font, device API or graphics engine is
added. The existing kettle, stream, dripping coffee and bounded 600 ml server
remain mounted across stage changes, as do the controls and scale itself.

## Units and meaning

The underlying model still tracks nominal water volume in game ml. The screen
uses **g\***, a clearly disclosed game mass unit with the rule 1 game ml = 1 g*.
This is a UI convention, **not a physical conversion using water density** or a
real measurement. The whole brewer/stand/server and grounds are conceptually
tared before first water; the displayed number is cumulative water delivered,
including water still in the filter. Draining from filter to server does not
reduce the displayed mass. Beverage yield is a separate quantity.

The small g* notice is visible below the scale; full unit/clock explanations are
in Controls & simulation limits. Auto tare is a state label, not a fake button.
There is no mid-brew zero control that might hide the cumulative water targets.
Recipe amounts, nominal-ml targets, physics, scores, flow rates, drawdown graphics,
source attribution and all saved data formats remain unchanged.

## Two timers

- The large brew clock starts with first water, then includes waiting and visual
  drawdown until the result. It is a UI-only game timer, not a real brew-time
  recommendation, and the station still uses its shortened pouring mechanics.
- The smaller pour-time display retains the previous active-water-delivery timer.
  Releasing the pour button freezes water and active pour time; brew time keeps
  advancing. Reaching a stage target also does not stop the brew clock.

Both displays follow the existing bounded animation timestep and suspend with
hidden tabs, leaving the station or a keep/replace modal. They do not catch up
with wall-clock time. Language rerenders and keeping the current cup preserve
the in-session elapsed time; a new cup or restart zeros it. An unsaved in-progress
cup is not made reload-persistent by this release. Saved playSeconds continues
to mean active pour time; UI brew time is not inserted into old memories.

Numeric displays are readable accessibility content outside the illustration's
aria-hidden subtrees, without announcing every animation frame. Tabular digits
and fixed-height indicators prevent layout changes when numbers or stages change.

## Verification

111 existing automated tests and both builds pass. The new
`scripts/smoke-brew-scale.mjs` exercises 320×700, 390×844, 820×1024 and 1440×900 in
Vietnamese and English: zero before first water, auto start, wait/pour separation,
hidden-tab suspension, stage targets, cumulative water while draining, unchanged
scale/art nodes, legacy memory save/rebrew and reset. The 390px Vietnamese case
also verifies language continuity and modal suspension/keep-resume.

The existing eight-case pour-layout regression checks all three controls, scroll,
focus and artwork identity through every stage and completion. Screenshots in
`review/brew-scale/` show the device at the final water target while coffee drains.
These are Chromium emulations, not tests on actual Bluetooth scales or phones.
