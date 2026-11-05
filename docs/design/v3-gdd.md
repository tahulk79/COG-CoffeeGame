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
| `gate` | World Map: choose a starting country + region | Enter |
| `play` | Farm + café loop in the region | Level 10 the first time |
| `expiry` | Gameplay paused; cinematic; Teacher: "this land has expired"; region reset | Reset done |
| `chooseRegion` | World Map, must pick a new region | Enter → `play` |

Every phase resumes after reload. Round 2/3 and country unlocks happen inside `play` (confirmation + cinematic).

## 3. Core loop
Grow → Harvest → Brew → Sell → Earn → Build → Upgrade → Expand.
- **Farm**: tap empty soil to plant the active crop (seed cost), drag across beds to plant/harvest many; trees grow on real time; tap/drag ready trees to harvest beans. No water, no fertiliser; the tree disappears after harvest.
- **Café**: the café is its own area of the region, entered with the big **Café** button in the toolbar (the **Farm** button brings you back; region entry and reload start on the farm). The farm shows only the farm. Customers keep arriving while you farm — the Café button shows how many are waiting. In the café, customers walk in from the café street to the **Order Counter**; tap it to take the order; tap the **Brewing Counter** to brew (uses beans), tap again when the cup is ready to serve → coins + XP. Waiting customers leave after 45 s.
- **Build**: Build menu → live preview on the map (green valid / red invalid) → ✓. Tap a building → action bar → Upgrade (cost shown, Round caps the level).
- **Expand**: tap a for-sale sign → Buy (one tap). Some parcels need a road opened first.

## 4. Content (Round 1 values; see config for all)
- Crops: Robusta 2¢ / 15 s / 2 beans · Arabica 6¢ / 40 s / 4 beans (L3) · Liberica 16¢ / 90 s / 8 beans (R2, L6).
- Drinks: Espresso 1 bean → 10¢ · Milk coffee 2 → 22¢ (L2, Roaster) · Latte 3 → 36¢ (L5, Roaster Lv 2). Price bonuses: Roaster, Tables, Pastry case, Brew-bot, Price blessing.
- Buildings: Kho (storage), Order Counter (queue/arrivals), Brewing Counter (speed/slots) — free starters; Roaster 40¢, Drying yard 120¢ (+yield), Tables 60¢ (tips, +queue), Kiosk 900¢ (R2, arrivals), Pastry case 3,000¢ (R3, price), decorations. Level caps by Round: 3 / 5 / 8.
- Land: 8 farm parcels × 6 plots, build parcels B1–B5, build lot B3 (R2); café area: café block S (+ expansion lot C2 in R2). Roads: south-west (R2, 300¢), north (R3, 900¢).
- Staff (max 3 per farm, 3 per café): Farmhand 150¢ (+15% grow), Barista 200¢ (+25% brew), Sprout-bot 1,200¢ (R2, +25% yield), Brew-bot 1,500¢ (R2, +15% price). Owned forever.

## 5. Progression
- XP: harvest 1/3/6, serve 2/4/6, build 10, upgrade 8, land 6, road 4, hire 5. Level 10 = 920 XP.
- **Rounds** (exactly 3): R2 1,800¢ (L10), R3 7,000¢ (L13), charged once (idempotent transaction). If short, the UI shows the exact missing amount.
- **Level 10 Region Expiration** (once): resets buildings + levels, crops, café orders, staff assignments of that region only. Keeps coins, level, XP, round, credits, beans, land titles, unlocked countries/regions, staff ownership, story. Starter buildings return free at Lv 1; free robusta when broke → never softlocked. Expired region rests until Round 2.
- **Rebirth** (3 free credits, independent from Rounds): at Level ≥ 5 spend 1 credit (confirmation) for a permanent +10% blessing (grow / price / XP, max ×3 each). Nothing is lost. Paid credits: architecture only.

## 6. Economy simulation (`npm run sim -- 120`)
Typical scripted player (1.2 s per action): Level 10 at ~19 min, ~140–240 ¢/min before the reset, ~66 ¢/min right after it, recovering to ~300 ¢/min within 15 min; Round 2 at ~48 min, ~400–800 ¢/min in Round 2. Re-run after changing any number.

## 7. Camera
One CameraController: Exploration (follow player, isometric), Area Focus (tap an area → tween/zoom to it, keeping it above the action bar), Interaction (stable while acting), World Map, Cinematic (expiry, round, country, rebirth, arrival). Clamped to map bounds, damped, handles resize/orientation and touch.

## 8. UI/UX
Minimal HUD: top-left level badge + XP, coin pill, beans/capacity, Round + credits; top-right settings. Bottom toolbar: Build, Seeds, Staff, World, Progress. Contextual action bar for the selected object. Toasts and world-space feedback. Modals only for Round/Country unlock, Rebirth confirmation and settings. Tutorial: one action at a time — speech-bubble tip, bouncing 3D arrow, tap-hand pointer, camera focus; derived from the save so it never gets stuck.

## 9. Save
Key `godbean-v3` (schema 3): character, story (phase, expiry + snapshot), player (coins, xp, round), rebirth, inventory, world (current region, countries, regions → parcels, roads, buildings, plots, café orders), staff, tutorial, stats, tx log. Backups: `-prev`, `-corrupt`, `-pre-expiry`, `-backup` (on restart). Migration from v1 (old keys untouched).

## 10. Tests
`npm test` — reducer, farm loop, café, build placement, land, staff, Rounds (exactly-once), Level-10 reset rules/idempotency/reload recovery, rebirth, world access, store persistence/corruption recovery, migration, tutorial.
