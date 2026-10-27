# UI Design System

Code: `src/ui/theme/tokens.ts` (single source), `src/ui/components/*`, `src/ui/hud/*`.

## Tokens
| Token | Value | Use |
|---|---|---|
| `coffeeBrown` | `#5B3523` | borders, progress tracks, highlighted card fill |
| `espresso` | `#291B17` | panel fill |
| `caramel` | `#C88D47` | primary buttons, panel borders |
| `cream` | `#FFF1D8` | text, icons |
| `leaf` | `#6FA86C` | success, EXP, healthy patience |
| `gold` | `#F5C451` | coins, highlights, mission title |
| `error` | `#D96B5F` | errors, danger button, low patience |
| derived | `espressoSoft`, `woodLight`, `creamDim`, `disabled` | secondary surfaces / text |

Other tokens: `FONT` (friendly sans stack, sizes xs–xl), `RADIUS` (sm 6, md 10, lg 16), `SPACING`, `DEPTH` (hud 1000 … debug 2000), `MOTION` (110/190/320 ms). Components import these; there are no colour literals in new components. The older panels import `CSS`/`TEXT` from `ui/theme/textStyles.ts`, which are derived from the tokens.

## Components
- **GameButton** (`Button` alias): rounded, variants `primary | secondary | danger | ghost`, optional icon, icon-only mode, press scale, disabled/selected states. Hidden-parent safe.
- **GameProgressBar**: rounded, smoothed (skipped for reduced motion).
- **drawPanel / panelBg**: shared panel look (shadow, fill, caramel border); `panelBg` also swallows clicks.
- **GameModal**: dim backdrop, centred panel, close button, open animation. `SettingsModal` is built on it.
- **setShown(container, on)**: always use this instead of `setVisible` for panels that contain interactive objects.
- **HUD parts:** PlayerProfileHUD, CurrencyHUD, QuestTracker, OrderQueuePanel, BottomToolbar, DebugOverlay (all in `src/ui/hud`).

## Rules
1. Text never shows internal state names; those exist only in DebugOverlay.
2. HUD reads the simulation snapshot / events; it never keeps a second copy of gameplay state.
3. Icons come from the asset registry by logical key; no emoji.
4. Motion respects `prefers-reduced-motion` and the in-game setting (`dur()` returns 0).
5. Layout comes from `HudLayout` (`wide` / `compact`, safe areas); world coordinates never enter HUD code.


## Added in UI-P3 / P4 / P5
**Components:** `ItemCard` (icon, name, quantity badge, selection ring) · `TabBar` (wrapping tabs) · `GameModal` (responsive size, safe areas, open/close animation, stops taking clicks the moment it closes) · `PagedListModal` (cards + pager; recipes and staff are built on it) · `ToastHub` (3 pooled slots, queued) · `RatingPopup` · `ModalManager` (one panel at a time, Escape closes) · `HudLayout` + `worldViewInsets` (responsive frame).

**World-space:** order bubble (cup icon, status colour: neutral / ready / urgent), pulsing ring under a customer you can act on, pulsing outlines (`setGlows`) for the next station, the order counter, the customer's seat, and farm plots that are ready / thirsty / ready for seeds, pooled floating reward text (`showFeedback`, max 24 objects). None of these objects are interactive, so they never intercept movement clicks.

**Typography / spacing / icons:** one font stack (`FONT.family`), sizes xs 11 · sm 13 · md 15 · lg 18 · xl 22; spacing xs 4 · sm 8 · md 12 · lg 16; icon sizes 11 (stars) · 24 (default) · 28–36 (cards); button height ≈ 2.1 × font size (26–34 px, 40 px touch buttons on phones).

**Reward / rating styles:** coins use `gold` with a dark stroke, EXP `leaf`, unlocks `caramel`; ratings use `star` / `starEmpty` icons revealed one by one (110 ms apart).

**Animation:** `anim.ts` (`fadeIn`, `pulse`) plus modal / toast / bubble / star / button-press tweens. Durations 110 / 190 / 320 ms, `Quad` / `Back.easeOut`. Everything goes through `dur()`, which returns 0 when reduced motion is on.
