# Farm UX / UI Redesign (Farm World 2.0)

Status: implemented 2026-11-07 (uncommitted), portrait phone first (375–430 px wide). Code: `src/features/hud/*`,
`src/features/realm/{index,placement,plots,world,badges,buildings,camera}.js`, strings `src/i18n/locales/farm-world.js`.

## 1. Principles
Game-like, icon-first, few words; one primary action per card; the thumb zone (bottom third) holds every action;
nothing permanent on screen except what the player always needs; no new toolbar buttons (approved: 4 menus + the
middle Sell/Buy button).

## 2. Always on screen (farm)
Top-left: level badge with XP ring + coin pill. Storage pill shows `stored / capacity` for all goods (it is also the
fly-to target for harvested and produced goods). Top-right: gear (+ loan / auto chips, unchanged). Bottom toolbar:
Seeds · Build · **[Sell]** · Staff · Progress. The tutorial bubble when a step is active. Everything else is
contextual.

## 3. Contextual interaction model
| Tap on | What happens at once | Card (bottom, above the toolbar) |
|---|---|---|
| Empty field | plants the active seed (approved one-tap) | crop name, Change seed, Move, Clear |
| Ripe field | harvests (drag across beds harvests many) | — |
| Growing field | — | countdown, well bonus line, Move, Clear (disabled: "Harvest it first") |
| Workshop with a finished batch | collects it (one tap, like the café counters) | recipe line, Start next |
| Workshop idle / working | — | recipe `12 🫘 → 12 🟤 · 30 s`, big Start / progress bar / Collect, count n/max, Move, Remove (+refund, 2-tap confirm) |
| Storehouse | — | goods list with Sell per good, Sell all, capacity bar |
| ▲ over a building | — | upgrade card (approved: upgrades only via ▲; the selected building's ▲ shows at any distance) |
| Empty owned grass | the avatar walks there (approved) | small land card: Field (Free / price) · Build · Decor, disabled where the terrain forbids; hides after ~6 s |
| Sign on land for sale | — | buy card (price, Buy) |

Object notices (world-space pins): ▲ upgrade, sickle over a lot with ripe fields, **good icon over a finished batch**
(always visible), **+ over an idle workshop that can start** (when near), + on affordable land signs.

## 4. Construction catalogue (the Build sheet)
Tabs (farm): Farming · Processing · Storage · Infrastructure · Decor · Land. Café: Café · Decor.
Cards in a grid: big icon, name, price (or "Free"), one benefit line, `n/max` chip. States: available · can't afford
(price red, tap explains how many coins are missing) · locked (🔒 Lv N) · maxed ("More at Lv N" / "Max built").
Tap → the sheet closes and the placement ghost appears near the player. The Land tab lists lots for sale (cheapest
first) with Buy, plus **Show land for sale** (expansion mode).

## 5. Modes (the grid is never permanent)
- **Build / move mode** (placement): owned land of the current area is tinted green where the item is allowed and faint
  red where it is not; a light 1 m grid is drawn over owned farm land; the ghost's footprint tiles are green or red; the
  bar under the ghost shows the item, its **cost**, and the **reason** when invalid ("A field is here — move or clear
  it first", "Not on the road", "Pasture: no fields here", "This would block the way to a field or building" …);
  ✓ / ↻ / ✕ follow the ghost.
- **Planting highlight:** while the Seeds sheet is open, empty fields pulse softly.
- **Expansion mode** ("Show land for sale"): every lot for sale is tinted and shows its price sign; the camera zooms out
  to an overview; a Done chip exits. Any view switch, the world map or the Level-10 cinematic leaves every mode.

## 6. Camera
Hay Day rule kept: no jumps on taps, the player's zoom is kept, the view slides only when a target is off-screen or
would sit under the bottom card (HUD-aware safe insets). Expansion mode raises the zoom-out limit for an overview and
restores the zoom afterwards. 45° yaw unchanged.

## 7. Onboarding
The approved farm tutorial (plant → harvest → sell → upgrade storehouse → buy land) is unchanged; its targets resolve
through the fields, so moved or cleared fields never break it. The middle toolbar button keeps its one-tap "Sell beans"
until the player owns processed goods or a workshop, so the tutorial's sell step still works. New mechanics are taught
by object notices and one-line cards, one at a time (no new steps — adding steps would re-open the tutorial for
players who finished it).

## 8. Known gaps (need a phone)
Touch feel of the land card auto-hide, the grid opacity on small screens, the expansion overview zoom on very tall
phones and the badge density on a full farm were reasoned from code only (no device test in this pass, see QA doc).
