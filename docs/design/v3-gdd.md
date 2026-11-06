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
- **Café = its own map** (same presentation as the farm), entered with the big **☕ Quán** button (the **🌱 Nông trại** button brings you back; region entry and reload start on the farm). Scenery: a simple, readable **Vietnamese city street** — rows of colourful tube houses (nhà ống) with balconies, plants, shop signs, awnings and red lanterns, an asphalt street + alley with a zebra crossing, sidewalks with trees, lamp posts, power poles and parked scooters. Café lots (wider café): S 16 × 14 m (starter, the two counters), C2 500¢ (east), C3 1,400¢ (west); the street runs in front of the terrace.
- **Walk-up action pads** (like other games): a glowing rounded pad in the counter lane in front of the Order counter and of the Brewing counter. Standing on / walking across a pad does that counter's job when it will succeed (take an order; pick up a ready cup / brew the next order); the pad pops with a radial fill. Reaching the customer you carry a cup for serves it. Tapping a counter still acts immediately **and** walks you to its pad (one shared cooldown, no double action). Pads glow brighter while their action is available.
- **Terrace seats (Ghế ngoài trời)**: a fixed, walkable, upgradable starter building in front of the café — plastic stools around low tables in 2 rows. Level 1 = 4 seats, each upgrade +2 up to 18 (8 levels; ▲ badge, card “Seats 4 → 6”). Dim discs show where the next level's stools go. Seats = terrace seats + 2 per Tables building.
- **Café loop (simple, tap-to-act)**: customers walk in from the alley and queue at the **Order Counter**; tapping the counter body **takes the order** (no card; “No customer yet” / “Hết ghế — xây thêm bàn” toasts otherwise) → the customer **walks to a free seat and sits** (terrace stools — the first N terrace positions by terrace level — then 2 chairs per Tables building). Tapping the **Brewing Counter** body: if a cup is ready the player **picks it up** (cup on a tray in hand) and **walks it to that seated customer automatically** — on arrival the cup lands on the table, coins fly up and the customer leaves; otherwise it **brews** the next taken order (“Out of beans — go to the Farm” if short); while carrying, the counter brews the next order or resumes the delivery. An interrupted walk keeps the cup in hand: tap the customer (☕ pin over them) or the counter to resume — an order is never lost. Tapping a seated customer whose cup is ready also brings it over.
- **Customer bubbles, no numbers**: walking-in / queueing customers show “💬” (no drink yet) + a horizontal **patience bar**; the drink appears in the bubble only once the order is taken (small pop) (green → yellow → red, blinking and shaking in the last 20 %). Seated customers show a **brew bar** that fills up (then a big ☕ when ready) and, under it, their **seat patience bar** (60 s from taking the order, same colours, blinks in the last 20 %). A taken order needs a free seat.
- **Queue first**: customers always walk from the street to the queue in front of the Order Counter and wait there facing it; an order can only be taken from a customer standing in the queue (counter tap, pad, staff, auto). Queue lane, counter lane and streets are always walkable for pathfinding.
- **Angry leave**: a seated customer whose drink is not served in time stands up, swears (red “💢 #@!%” bubble, shake, angry sound, red puff) and stomps off; the cup is lost (no refund) and a warning toast says “A customer stormed off — too slow!”. Staff and the player's auto actions brew / serve the customer closest to running out first.
- **Build** (café only): Build menu → live preview on the café map (green valid / red invalid) → ✓.
- **Upgrade only via ▲**: every building with an upgrade left (within the Round cap) shows a ▲ pin above it — bright green and bouncing when affordable, grey and still when not. Tapping the ▲ opens the upgrade card (Upgrade button or “need X more”). Counters' bodies only act; other buildings' bodies open an info card (“Tap the ▲ above it to upgrade”); the farm's Storage button opens the storehouse upgrade card too.
- **Expand**: tap a for-sale sign (field or café lot) → Buy (one tap, coins only).
- **Object notices** (founder: every object with an interaction or upgrade shows a notice AT the object): bouncing world-space pins, constant screen size, drawn on top, tap = tap the object. ▲ = an upgrade exists (green bouncing when affordable, grey when not; tap = upgrade card); Order Counter “!” (customer waiting, seat free) or “no seat”; Brewing Counter “+” (an order can be brewed, beans enough) / “☕” (cup ready to pick up); “☕” over the customer while carrying their cup; sickle over a field with ripe plots (tap = harvest the field); “+” on an affordable for-sale sign. Interaction + upgrade → interaction pin on the object with a small tappable ▲ beside it. Hidden in the other area, during placement and cinematics.
- **Per-screen menus**: farm toolbar = Hạt giống / Seeds, Kho / Storage (storehouse card: fill + upgrade), [☕ Quán], Nhân viên / Staff (farm staff), Thế giới / World, Tiến trình / Progress. Café toolbar = Xây / Build, Thực đơn / Menu (drinks: price incl. bonuses, beans per cup, lock reason), [🌱 Nông trại], Nhân viên / Staff (café staff), Tiến trình / Progress.

## 4. Content (Round 1 values; see config for all)
- Crops: Robusta 2¢ / 15 s / 2 beans · Arabica 6¢ / 40 s / 4 beans (L3) · Liberica 16¢ / 90 s / 8 beans (R2, L6).
- Drinks: Espresso 1 bean → 10¢ · Milk coffee 2 → 22¢ (L2, Roaster) · Latte 3 → 36¢ (L5, Roaster Lv 2). Price bonuses: Roaster, Tables, Pastry case, Brew-bot, Price blessing.
- Buildings: Kho (storage, farm, fixed), Order Counter (queue/arrivals), Brewing Counter (speed/slots) — free starters; café buildings: Roaster 40¢, Tables 60¢ (tips, +queue, +2 seats), Kiosk 900¢ (R2, arrivals), Pastry case 3,000¢ (R3, price), decorations. The Drying yard is retired (kept only so old saves load). Level caps by Round: 3 / 5 / 8.
- Land: 14 fields × 6 plots (F1 free, F2–F14 for coins); café: block S (starter, 4 terrace seats) + lots C2 500¢ / C3 1,400¢. All roads are open.
- **Rounds gate only**: Liberica, Kiosk (R2), Pastry case (R3), the robots (R2) and building level caps (3 → 5 → 8). Never land, regions or countries.
- Staff (max 3 per farm, 3 per café): Farmhand 150¢ (+15% grow), Barista 200¢ (+25% brew), Sprout-bot 1,200¢ (R2, +25% yield), Brew-bot 1,500¢ (R2, +15% price). Owned forever.
- **Staff really work** (plus their passive bonus): farmhand / Sprout-bot harvest ripe plots and replant them with your selected seed (or the best affordable one; never when the storehouse is full or seeds are unaffordable), else plant empty plots, else stroll by the fields. Barista: carries ready cups to seated customers, takes orders, brews. Brew-bot: takes orders and brews, faster. A small icon above each unit shows its job (🌾 🌱 ☕ 🧾 🚶); the Staff sheet says what each one is doing. They keep working in the area you are not looking at, pause outside normal play, never toast errors and never race each other or you for the same plot / cup.
- **Staff breaks**: a working worker sometimes slacks on the phone (≈30 % chance per minute of work; 📱/😂/💤), a robot's battery runs out after 3 minutes of work (slumps, red eye, blinking 🔋). A stopped unit does nothing and gives no bonus; a big “🪙 fee” bubble over its head (tap it or the unit, or the button in the Staff sheet) pays the fee and it goes back to work (robot: ⚡ recharge). The Staff button gets a red dot while anyone is stopped.
- **Pathfinding**: the player's tap-to-walk and cup delivery, staff and customers all walk on a 0.5 m grid path (A*, smoothed) around buildings, counters, houses and street props; stuck → re-plan, then a small nudge, so nobody stays stuck.

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

## Farm building, placement and menus (2026-11-06, later)
- **The farm can build too**: farm Build menu = Drying yard (+yield, back in the game) + decorations, placed on **free grass** inside the farm (never on a field — “Không xây trên ruộng” —, a road or the gate plaza). Café Build menu = Roaster, Tables, Kiosk, Pastry case + decorations on owned café lots. Farm buildings get the ▲ upgrade badge like café ones.
- **Toolbars** (4 menus + centre switch): farm = Hạt giống · Xây · [☕ Quán] · Nhân viên · Tiến trình; café = Xây · Thực đơn · [🌱 Nông trại] · Nhân viên · Tiến trình. The World map is a button at the top of the Progress sheet (the World Gate on the farm also opens it). The storehouse opens from the 🫘 bean pill.
- **Placement ghost**: picking a building closes the sheet, frames the spot and immediately shows a translucent pulsing ghost of the real model at the nearest valid spot (spiral search from the player; farm = free grass, café = owned lot), green / red footprint tiles, a soft tint over the allowed area and a hint under the ghost (“Kéo để di chuyển · bấm ✓ để xây” or the reason, e.g. “Hết chỗ trống — mua thêm lô quán”). Tap the ground or drag to move, ↻ rotates, ✓ builds, ✕ cancels.
- **Tutorial camera**: every tutorial target is framed when its step starts and again whenever it drifts near a screen edge; world badges are kept inside the viewport margins. The upgrade step explains a grey ▲: “Cần thêm {n} xu để nâng cấp Kho — bán cà phê ở Quán” (hand on the Café button).

## Auto play (lượt auto)
One free **auto run** (180 s) is granted when the Teacher opens the gate (old saves that met the Teacher get one too). **▶ Auto ×N** (top-right, under the gear) starts it at once, no modal. The game then plays **right where you are**, from the first frame, using the real avatar, the normal pathfinding and walking speed, with a ~0.35 s beat between actions: café → take the queued order, brew, pick up and carry the cup to the customer (else stand ready at the order pad); farm → harvest ripe plots, replant (affordable seeds only). You may switch Farm ⇄ Café during the run and the autopilot follows; it switches area by itself only after > 3 s with nothing to do there (announced). The caption says exactly what it does now (“🌾 Thu hoạch ô F1-3”, “🌱 Trồng Robusta”, “🧾 Nhận order”, “☕ Đang pha Espresso”, “🚶 Mang cốc cho khách”, “🪙 +12 xu”); “Chờ khách tới…” only after 2 s idle. A compact chip “🤖 AUTO · 2:31” + **⏹ Dừng** replaces the Auto button. During the run the player can pan / zoom, open info sheets and switch view, but actions (taps, drags, buy / build / upgrade, World) are blocked with a hint; the tutorial pauses. It never buys land, buildings or upgrades. Time out / Stop → control back (toast); reload resumes an unfinished run or ends an expired one.
- **Buying auto runs**: with no runs left the Auto chip reads “🛒 Mua Auto 🪙150”; a small confirm card (“Mua 1 lượt Auto?” — “Game tự chơi 3 phút để hướng dẫn bạn”, price) buys one run (price 150 + 50 per previous purchase, max 600; one transaction id per confirm). The Progress sheet has an Auto panel: runs left, Start, Buy with price, short explanation.

