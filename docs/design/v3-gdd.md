# Godbean V3 — Farm & Café 3D (GDD)

Supersedes the gameplay sections (§5–§10) of [godbean-gdd.md](godbean-gdd.md). Architecture and module contracts: [v3-architecture.md](v3-architecture.md). Decisions taken autonomously: [../AUTONOMOUS_DECISIONS.md](../AUTONOMOUS_DECISIONS.md). All numbers: `src/core/config/economy.js`, `layout.js`, `world.js`.

## 1. Vision
A casual 3D world you walk around: grow coffee (Hay Day), build and upgrade (Township), expand across countries (4X-lite), run a café (coffee-shop sim), framed by a rebirth story. A new player plays correctly in the first 30–60 seconds without reading.

## 2. Story flow (state machine `story.phase`)
| Phase | What happens | Exit |
|---|---|---|
| `select` | Pick male/female character | Enter game |
| `intro` | Street accident, the hero faints (skippable cinematic) | End / Skip |
| `teacher` | Scene 2 (heaven): the **Deity** (Vị thần) asks the hero's greatest dream; the hero answers (strong and wealthy to do good for the world, and to discover the greater things of the universe); the Deity gives the **God Bean** (“hạt của Chúa”) and warns “nothing lasts forever”; the hero sniffs the bean, it dissolves into their mind → **God Bean splash** → world map. One free Auto run is granted | Last line / Skip (skip still shows a short splash) |
| `gate` | World Map: open a starting region (the first one is **free**) | Open → enter |
| `play` | Farm + café loop in the region | Level 10 the first time |
| `expiry` | Gameplay paused; cinematic; Teacher: "this land has expired"; region reset | Reset done |
| `chooseRegion` | World Map, must pick another region (the next new one is **free once**; the expired one cannot be entered now) | Go / Open → `play` |

Scene 2 script (founder note 2026-11-07, from the novel *Vị thứ 6*): the Deity speaks “ta – ngươi” (also in the Level 10 expiry
lines); the hero's line is fixed (no choice yet). The World Gate behind the hero stays closed: the map opens “in the mind”,
not through the gate. The splash (`src/ui/splash.js`) shows once, at the end of scene 2 only (reload at `gate` goes straight
to the map). Brand name shown to players: **God Bean** (save keys keep `godbean-*`). Code: `src/features/teacher/`.

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

## Auto = quản lý theo giờ — 2026-11-09 (founder's decisions; replaces hiring a manager on the farm)
- **Powers**: for the length of a run, Auto makes the decisions of a manager on default settings (`gm/think`): hires, cares for, upgrades and places the crew, builds, buys land when it pays. Field work stays `auto/tick` (60 jobs/min, never uproots), sells at 80% full, works the quest list. It **never borrows** (`gmLoanFor` is null) and files nothing for signature (land sales are skipped). Bonuses as a 1-star manager: none on sales or incident fees (`AUTO.managerStars`).
- **How**: `autoManagerOn` puts a stand-in in `s.gm.unit` (`isAuto: true`, name Auto); `autoManagerOff` removes it and drops unstarted orders. No salary, rival, stat growth or away pay. Not drawn in the world: the farmer does the walking.
- **Hiring**: `gm/hire` fails on the farm (`useAuto`); the café keeps it. A manager found on a farm (old save, or a café manager entering a farm region) leaves with 100% of his hire fee back and his wage arrears wiped (`auto/retireHired`, HUD tells the player once).
- **Time and price** (unchanged): 1 free run, 10 played minutes each, 300 coins +100 per purchase, cap 1,500. Time only runs while playing; leaving the game keeps it and pays nothing on return.
- **Pause** keeps the time and the run's numbers (`autoplay.saved`, `tally`), no run spent. Changing region pauses too. **Time up**: stops, reports jobs / sales / spending (`autoplay.last`), charges nothing by itself; what it bought stays.
- **UI**: rail button `AUTO ×N` / `⏸ 7:12` / gold price / green with time left and a ring that empties. It opens the Auto sheet (`autoPanel`), also shown in the farm's Auto staff tab.
- State: `autoplay = { runs, granted, bought, saved, active: { leftMs } | null, tally, last, retired }`.

## Balance & QA pass — 2026-11-09
- **Level-10 incident back on** (`EXPIRY_ENABLED = true`): reaching Lv10 restarts in a new region (one follower comes). A running Auto run is paused with its time kept (`autoplay.saved`). The ⚡ chip sits under the left tool column; the Quản lý tab warns when ≤ 2 levels are left (the manager does not come along).
- **Fields**: the tilled rows (`fieldAllowance`, 6 per estate bought + 6 per level-up) stay free; a bed beyond them is new ground to clear: `FIELD.extraBase 20 × extraGrowth 1.08^k` (20, 20, 25 … 45 at the 11th, 95 at the 21st). No count cap (founder rule) — the price is the brake. The planting label shows sapling + clearing price.
- **Land**: buying an estate / lot asks first (confirm card, one txId).
- **Staff**: a stamina step costs half (`SKILL.staminaCostMul 0.5`) — its payback was 60–177 min vs ≤ 40 for the other stats; 1→2 now pays back in 8–35 min. Waterers / water robots show "Cần xây Giếng nước trước" on the hire card when no well stands; a unit stuck on something the player must fix reads amber.
- **Manager**: his own hands count in the farm's labour share (a fresh manager no longer reads "mới hái được 25 %").
- **Manager never borrows near the incident** (`FARM_MANAGER.incidentLoanLevels 5`, `incidentNear`): loans survive the Lv10 incident, the land they buy does not. Log reason "Tạm giữ: không vay khi sắp tới biến cố Lv10". This was what made the delegate 17 % faster than main (a 1000 loan at Lv6).
- **Waterer training / gear at half price** (`SKILL.tradeCostMul.waterer 0.5`): watering only speeds growth 15 %, so speed / boots paid back in 47–60 min at full price. Every stamina step is a "late" (≤ 90 min) step, like a robot's cooler (reliability).
- **Cleared beds refund half** (`fieldRefund = FIELD.refund × f.spent`; `f.spent` saved on a priced bed). Free rows refund 0.
- **Sim gates**: café gates run only while `CAFE_ENABLED` (off on main); net worth counts the current region only, land at the price really paid, buildings at `spentOn`, cleared beds; a vacuous cost row and a neglect window with no fineable task are SKIP, not FAIL.
- Sim (seed 1, farm, vs adb37a1 baseline 16:58 / 20:02): Lv10 tapper 17:39 (+4 %), delegate 18:18 (−9 %); coins never < 0 in every persona; every measured upgrade inside its payback gate.

## HUD look: Roastery — 2026-11-09
Founder sent reference screenshots of another farm game. Only genre patterns are used; no art, characters, names or layouts of that game. Tokens in `src/ui/styles/game-ui.css`, applied in `hud-skin.css`: flat roasted-brown title bars, crema paper, green raised buttons, a red close corner, floating cream tiles along the bottom. Founder asked for neat and easy to play: few materials, no ornament, the right rail holds only settings, rotate, Auto and what is waiting (the world map is in Manage). The guide is the God Bean (`features/hud/mascot.js`, original vector art) in tips and dialogues.
