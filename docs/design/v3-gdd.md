# Godbean V3 — Farm & Café 3D (GDD)

Supersedes the gameplay sections (§5–§10) of [godbean-gdd.md](godbean-gdd.md). Architecture and module contracts: [v3-architecture.md](v3-architecture.md). Decisions taken autonomously: [../AUTONOMOUS_DECISIONS.md](../AUTONOMOUS_DECISIONS.md). All numbers: `src/core/config/economy.js`, `layout.js`, `world.js`.

## 1. Vision
A casual 3D world you walk around: grow coffee (Hay Day), build and upgrade (Township), expand across countries (4X-lite), run a café (coffee-shop sim), framed by a rebirth story. A new player plays correctly in the first 30–60 seconds without reading.

## 2. Story flow (state machine `story.phase`)
| Phase | What happens | Exit |
|---|---|---|
| `select` | Pick male/female character | Enter game |
| `intro` | Street accident, the hero faints (skippable cinematic) | End / Skip |
| `teacher` | Meets the Teacher (Thầy): rebirth explained, receives **3 free rebirth credits**, World Gate opens | Claim / Skip (credits still granted) |
| `gate` | World Map: open a starting region (the first one is **free**) | Open → enter |
| `play` | Farm + café loop in the region | Level 10 the first time |
| `expiry` | Gameplay paused; cinematic; Teacher: "this land has expired"; region reset | Reset done |
| `chooseRegion` | World Map, must pick another region (the next new one is **free once**; the expired one cannot be entered now) | Go / Open → `play` |

Every phase resumes after reload. Round 2/3 unlocks happen inside `play` (confirmation + cinematic).

**World map — no Rounds** (founder correction 2026-11-06): every country can be tapped and every region opened with coins
(“more coins → open more”). Price = country base × tier (×1 / ×1.6 / ×2.5 for regions #1–#3, e.g. Việt Nam 300 / 480 / 750¢,
USA 1,500 / 2,400 / 3,750¢). The region sheet shows: owned → **Đi / Go** (current → “Bạn đang ở đây”); not owned → price chip +
**Mở / Open** (free → “Miễn phí”; can't pay → disabled, “Cần thêm X xu”). Paid openings ask a small confirm card (name + price),
then the region is bought and entered. Country pins show “owned/3” or a lock with the cheapest region price.

## 3. Core loop
Grow → Harvest → Brew → Sell → Earn → Build → Upgrade → Expand.
- **Farm**: tap empty soil to plant the active crop (seed cost), drag across beds to plant/harvest many; trees grow on real time; tap/drag ready trees to harvest beans. No water, no fertiliser; the tree disappears after harvest.
- **Farm = only a farm**: 14 fields (F1 free; F2–F14 bought with coins, 80 → 9,000¢), the storehouse (Kho) and the World Gate. No build lots, no roads to open, no Rounds on land.
- **Café = its own map** (same presentation as the farm), entered with the big **☕ Quán** button (the **🌱 Nông trại** button brings you back; region entry and reload start on the farm). Scenery: a simple, readable **Vietnamese city street** — rows of colourful tube houses (nhà ống) with balconies, plants, shop signs, awnings and red lanterns, an asphalt street + alley with a zebra crossing, sidewalks with trees, lamp posts, power poles and parked scooters. Café lots: S (starter), C2 500¢, C3 1,400¢.
- **Café loop**: customers walk in from the alley and queue at the **Order Counter**; tap it to take the order → the customer **walks to a free seat and sits** (terrace plastic stools + 2 chairs per Tables building); a bubble over the seated customer shows the drink and its state (⏳ being made / ☕ ready). Tap the **Brewing Counter** to brew (uses beans), tap again when ready to serve → the cup appears on the customer's table, coins fly up, the customer stands up and leaves. A taken order needs a free seat: when all seats are used the Order Counter shows a “no seat” notice and taking an order says “Hết ghế — xây thêm bàn”. Waiting customers leave after 45 s.
- **Build** (café only): Build menu → live preview on the café map (green valid / red invalid) → ✓. Tap a building → action bar → Upgrade (cost shown, Round caps the level).
- **Expand**: tap a for-sale sign (field or café lot) → Buy (one tap, coins only).
- **Object notices** (founder: every object with an interaction or upgrade shows a notice AT the object): bouncing world-space pins, constant screen size, drawn on top, tap = tap the object. Green ▲ = upgrade available and affordable now (within the Round cap); Order Counter “!” (customer waiting, seat free) or “no seat”; Brewing Counter “+” (an order can be brewed, beans enough) / “☕” (cup ready); sickle over a field with ripe plots (tap = harvest the field); “+” on an affordable for-sale sign. Interaction + upgrade → interaction pin with a small ▲. Hidden in the other area, during placement and cinematics.
- **Per-screen menus**: farm toolbar = Hạt giống / Seeds, Kho / Storage (storehouse card: fill + upgrade), [☕ Quán], Nhân viên / Staff (farm staff), Thế giới / World, Tiến trình / Progress. Café toolbar = Xây / Build, Thực đơn / Menu (drinks: price incl. bonuses, beans per cup, lock reason), [🌱 Nông trại], Nhân viên / Staff (café staff), Tiến trình / Progress.

## 4. Content (Round 1 values; see config for all)
- Crops: Robusta 2¢ / 15 s / 2 beans · Arabica 6¢ / 40 s / 4 beans (L3) · Liberica 16¢ / 90 s / 8 beans (R2, L6).
- Drinks: Espresso 1 bean → 10¢ · Milk coffee 2 → 22¢ (L2, Roaster) · Latte 3 → 36¢ (L5, Roaster Lv 2). Price bonuses: Roaster, Tables, Pastry case, Brew-bot, Price blessing.
- Buildings: Kho (storage, farm, fixed), Order Counter (queue/arrivals), Brewing Counter (speed/slots) — free starters; café buildings: Roaster 40¢, Tables 60¢ (tips, +queue, +2 seats), Kiosk 900¢ (R2, arrivals), Pastry case 3,000¢ (R3, price), decorations. The Drying yard is retired (kept only so old saves load). Level caps by Round: 3 / 5 / 8.
- Land: 14 fields × 6 plots (F1 free, F2–F14 for coins); café: block S (starter, 4 terrace seats) + lots C2 500¢ / C3 1,400¢. All roads are open.
- **Rounds gate only**: Liberica, Kiosk (R2), Pastry case (R3), the robots (R2) and building level caps (3 → 5 → 8). Never land, regions or countries.
- Staff (max 3 per farm, 3 per café): Farmhand 150¢ (+15% grow), Barista 200¢ (+25% brew), Sprout-bot 1,200¢ (R2, +25% yield), Brew-bot 1,500¢ (R2, +15% price). Owned forever.

## 5. Progression
- XP: harvest 1/3/6, serve 2/4/6, build 10, upgrade 8, land 6, road 4, hire 5. Level 10 = 920 XP.
- **Rounds** (exactly 3): R2 1,800¢ (L10), R3 7,000¢ (L13), charged once (idempotent transaction). If short, the UI shows the exact missing amount.
- **Level 10 Region Expiration** (once): resets buildings + levels, crops, café orders, staff assignments of that region only. Keeps coins, level, XP, round, credits, beans, land titles, unlocked countries/regions, staff ownership, story. Starter buildings return free at Lv 1; free robusta when broke → never softlocked. The next new region is free once (no softlock); the expired region cannot be re-entered from the choose-region map but can be visited again later.
- **Rebirth** (3 free credits, independent from Rounds): at Level ≥ 5 spend 1 credit (confirmation) for a permanent +10% blessing (grow / price / XP, max ×3 each). Nothing is lost. Paid credits: architecture only.

## 6. Economy simulation (`npm run sim -- 120`)
Typical scripted player (1.2 s per action): Level 10 at ~19 min, ~140–240 ¢/min before the reset, ~66 ¢/min right after it, recovering to ~300 ¢/min within 15 min; Round 2 at ~48 min, ~400–800 ¢/min in Round 2. Re-run after changing any number.

## 7. Camera
One CameraController: Exploration (follow player, isometric), Area Focus (tap an area → tween/zoom to it, keeping it above the action bar), Interaction (stable while acting), World Map, Cinematic (expiry, round, country, rebirth, arrival). Clamped to map bounds, damped, handles resize/orientation and touch.

## 8. UI/UX
Minimal HUD: top-left level badge + XP, coin pill, beans/capacity, Round + credits; top-right settings. Bottom toolbar per screen (see §3 Per-screen menus). Contextual action bar for the selected object. Toasts and world-space feedback. Modals only for Round unlock, Rebirth confirmation and settings (region opening uses a small inline confirm card on the map). Tutorial: one action at a time — speech-bubble tip, bouncing 3D arrow, tap-hand pointer, camera focus; derived from the save so it never gets stuck.

## 9. Save
Key `godbean-v3` (schema 3): character, story (phase, expiry + snapshot), player (coins, xp, round), rebirth, inventory, world (current region, ownedRegions, freeUnlocks, regions → layout version, parcels, buildings, plots, café orders), staff, tutorial, stats, tx log. Backups: `-prev`, `-corrupt`, `-pre-expiry`, `-backup` (on restart). Migration from v1 (old keys untouched).

## 10. Tests
`npm test` — reducer, farm loop, café, build placement, land, staff, Rounds (exactly-once), Level-10 reset rules/idempotency/reload recovery, rebirth, world access, store persistence/corruption recovery, migration, tutorial.
