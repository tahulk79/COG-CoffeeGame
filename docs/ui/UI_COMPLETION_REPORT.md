# UI Completion Report — UI-P3 / UI-P4 / UI-P5 (2026-10-27)

## Completed features
**UI-P3 – gameplay feedback**
- Customer order bubble (cup icon, status colour), pulsing ring under a customer you can act on, order cards updated from the real OrderSystem.
- Glow outlines for the next brewing station, the counter, the seat of the customer your drink is for, and farm plots that are ready / thirsty / ready for seeds.
- Brewing panel: recipe, ingredients with shortage (✗ thiếu), step progress bar, per-step accuracy %, disabled bean/addition buttons when out of stock, completion text. World float on finish / cancel.
- Rating popup from `cafe:rated` + `cafe:paid` + `cafe:reputationChanged`: stars revealed one by one, comments, coins + tip, EXP, reputation before → after.
- Floating rewards (`+xu`, `+EXP`, upgrade, quest done, hire) from the real transactions; toasts for level-up (with what unlocks), quest ready/claimed, achievements, upgrades, branches, hires.

**UI-P4 – management**
- `ModalManager` (one panel at a time, Esc closes) and a responsive `GameModal` (safe areas, open/close animation, stops taking clicks the instant it closes).
- Inventory (category tabs, paged item grid, details, sell actions that explain "go to the market"), Recipes (price, EXP, ingredients vs stock, unlock level), Staff (cards with portrait, role, status, workplace, wage, skills; hire / dismiss with reasons), Decoration (category tabs, cards with price / owned / bonus, rotate, **confirm**, cancel, store, done, live placement check), equipment upgrade info (current vs next stats, cost, why disabled), collapsible farm drawer, station panel only when relevant.
- Not applicable: employee levels / upgrades and "assign tasks" do not exist in the game (roles pick their own work), so no fake buttons were added.

**UI-P5 – responsive, animation, performance**
- Desktop / tablet / phone layouts; phones get a close-up camera that follows the player and fills the screen (about 6.5–7 tiles across), icon-only toolbar, collapsible order list, bottom-anchored panels.
- Animations: button press, modal in/out, tab / page fade, bubble pop, star reveal, floating rewards, quest and EXP pulses, toasts. All go through `dur()` (reduced motion = instant).
- Performance work driven by measurement (below).

## Changed files (main)
New: `src/ui/components/{Panel,ItemCard,TabBar,PagedListModal,GameModal(rewritten)}.ts`, `src/ui/hud/{ToastHub,RatingPopup,OrderQueuePanel,...}.ts`, `src/ui/panels/{InventoryModal,RecipesModal,EmployeeModal}.ts`, `src/ui/layout/ModalManager.ts`, `src/ui/theme/{bake,anim}.ts`, `src/components/presenters/{GlowPresenter,RewardPresenter}.ts`.
Rewritten: `src/scenes/HudScene.ts`, `src/ui/DecorHud.ts`, `src/ui/CafeHud.ts`, `src/ui/StationHud.ts`, `src/components/render/PlaceholderRenderer.ts` (actor view, pooled floats, glows, label culling, close-up camera). `EmployeeHud` removed (replaced by the staff modal).
Gameplay-side additions (no rule changes): `GameSimulation.enableTestMode()`, `FurnitureService.confirmAtHover()`, furniture `category` and employee `duty` data.

## Tests and results
| Check | Result |
|---|---|
| `tsc --noEmit`, `vite build` | pass |
| Unit tests | 185–186 / 186; the A* "< 2 ms" timing test fails only when the machine is busy and passes alone (3/3) |
| E2E (Playwright with system Chrome, 27 tests: movement, farm, processing + market, café, brewing, rating, decorate, save/reload) | 27 / 27 before and after the Graphics→texture refactor |
| Headless fuzz, 5 seeds × café (6 staff, random clicks, decorate buy / place / rotate / store) + 5 seeds × farm (2 workers, random clicks, selling) + 8 save/load rounds, 25 simulated minutes each | 0 exceptions; slowest simulation tick 1.6 ms |
| Café analysis, 30 simulated minutes with 6 staff | 120 served, 25 timeouts, all after the test-mode stock of beans ran out (no waste: bean use = drinks made) |

## Performance findings (measured, embedded Chromium, software WebGL, 1440×900 @ DPR 2)
- Simulation: `snapshot()` 0.03 ms, HUD update 0.01 ms, world update 0.05 ms.
- Full Phaser frame (CPU side of update + render submission), median: **24.9 ms → 7.5 ms**.
  - 56 world name labels (each a separate text texture) cost ~10 ms → now drawn only near the player, under the pointer, or on glowing objects.
  - 33 HUD `Graphics` objects cost ~13 ms (Phaser re-tessellates a Graphics every frame) → panels, buttons, cards, bars are nine-slice quads from baked textures and icons are baked once per size (`ui/theme/bake.ts`).
- Modal open/close, 600 cycles after warm-up: GameObjects 906 → 906, textures 386 → 386, tweens back to baseline (no leak).
- Scene transitions farm ⇄ café ×6: object and texture counts identical after every cycle (183/826/344 farm, 205/877/370 café for world/HUD/textures).
- **Not demonstrated:** a steady 60 fps on real hardware. This environment renders in software, cannot show a real GPU, and `requestAnimationFrame` does not run while the pane is hidden. Re-measure on your devices with F3 (debug overlay shows fps, frame ms, object counts, heap).

## Screenshots (docs/screenshots, reviewed by eye; no approved concept art was available to compare)
`ui2-01 … ui2-12` (café + level-up toast, ordering, brewing, rating popup, inventory, staff, decoration, farm, phone portrait farm / inventory, phone landscape inventory / café). Taken before the final performance refactor; the layout did not change, and one later check of the café after the refactor looked identical.

## Missing production assets
Per-item / per-furniture / per-recipe icons, employee and customer portraits, nine-slice button / panel art, rating faces, world sprites for characters and furniture, sounds. See UI_ASSET_MANIFEST.md.

## Remaining issues
- No 60 fps proof on real devices (see above).
- On the farm map the seed shop, plot panel and market remain the older text panels (restyled and collapsible, not rebuilt as modals).
- World-map and Sổ tay panels use their own layouts (managed by the same ModalManager but not built on `GameModal`).
- Test mode (`?cheat=1`, Settings → "Mở khoá tất cả") exists only in development builds.
