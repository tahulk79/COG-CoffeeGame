# Research lab (Phòng nghiên cứu): engineering spec

Founder approved the proposal "theo đề xuất" on 2026-11-07 (`docs/design/research-proposal.html`,
https://claude.ai/artifact/V2X8wmgeoQHYiGRPSDoJBJ). Answers: guessing game with hints; the recipes are the local menu
items already in the game; supplier contracts and buyer prices run on real days; 1 trial field (2 from Lv8); drink
recipes first. Research is growth: only the player does it — the general manager suggests, never runs it.

Steps: **1 drink recipes** · **2 suppliers + buyers** · **3 crop methods** · **4 manager + report wiring** — all done.

## Step 1: drink recipes (done)

Config `src/core/config/research.js`:
- `INGREDIENTS` (8): condensed 🥫 2, milk 🥛 2, sugar 🍯 1, ice 🧊 1, salt 🧂 1 (Lv2), egg 🥚 3 (Lv2), coconut 🥥 4 (Lv4),
  cacao 🍫 4 (Lv6) — coins per test, taste tag for hints.
- `countryRecipes(cc)`: every local menu item (config/menus.js) = base drink + 0–3 ingredients, unique per base in a
  country. Vietnam is hand-written (đen đá = ice + sugar, nâu đá = condensed + ice, bạc xỉu = condensed + milk,
  cà phê trứng = egg + condensed + sugar, cà phê muối = salt + condensed + milk, cold brew = ice; espresso and
  pour-over are plain). Other countries are generated from the item's icon (🧊 ice, 🥚 egg, 🧂 salt, 🥥 coconut,
  🍫 cacao, 🍯/🍬/🌼/🍓 sugar, 🍦/✨ milk…), a milk for milk / latte bases (condensed in VN / ID / MY / TW) and seeded
  fillers. The first plain item of each base (icon = the base's icon) has no ingredients and is known from the start.
- `RESEARCH`: 3 ingredients max, 20 s per test, found recipe price ×1.35, ordered ×2, 8 tests kept, 10 XP when found.

Core:
- `research/test { base, ings }` (café game, base drink unlocked, ingredients unlocked, bench free, beans + coins):
  pays the ingredients and the base's beans, bench busy 20 s, `D.judgeTest`: found → `s.research.known[cc]` (+XP,
  event `recipeFound`); known; allKnown; or hints against the closest unknown recipe of that base: right count, other
  (in another unknown recipe of the country), wrong, missing count + the taste tag of one missing ingredient, extra.
- `shop/spawnCustomer`: found recipes weigh ×2 when the customer picks this country's item.
- `shop/serve`: an order whose item is a found recipe sells for ×1.35.
- State `s.research = { known: { cc: [index] }, tests: { cc: [...] }, busyUntil }` (`normalizeResearch`). Kept through
  the Level-10 incident (it is the player's know-how, like the character).
- General manager: plan item `research` (advice only) "N local drinks not found yet" with a button to the Menu sheet.

UI: the café Menu sheet («Thực đơn»): each base drink lists its local items — ✨ found (own price), ❔ not found, plain
items known — and the «🧪 Bàn thử món» below: base chips, 8 ingredient tiles (price / level lock), «Pha thử» (cost,
busy countdown), the last 5 tests with hint dots (green right · yellow in another recipe · grey unused) and text
("Đúng 2. Thiếu 1 (vị ngọt).", "✨ Tìm ra: cà phê muối!").

## Step 2: suppliers and buyers (done)

Config `SUPPLY`, `supplierOf(regionId, group, i)`, `buyerOf(regionId, i, dayKey)` in research.js.
- Café groups: beans (shop/buyBeans price), milk (condensed, milk), pantry (sugar, ice, salt, egg, coconut, cacao).
  Market by default (price ×1, ★1, late 15%). Per region 3 suppliers per group, found by `supply/scout` (🪙40, 5 real
  minutes, one scout at a time). A supplier: priceMul 0.85–1.45 by quality (cheaper = worse), quality ★1–3, late 2–30%.
  `supply/sign { group, i, days }`: 1 day 🪙30, 7 days 🪙150, real days; expired → market again.
- Effects: beans price × priceMul; a late beans delivery (roll < late) arrives 45 s later (`s.supply.pending`,
  settled on the next buy / brew); every cup +5% / +10% for ★2 / ★3 beans; a found-recipe cup pays half the bench
  ingredient cost (× its groups' priceMul), gets the worst group's quality bonus, and runs out (sold as the base drink,
  toast) when a late supplier fails it; the test bench costs × priceMul too.
- Farm buyers: storehouse (×1) + 3 buyers found by `supply/scout { group: 'buyers' }`. Each buyer's price per good
  swings ×0.85–1.3 every real day. `supply/setBuyer { i }` sells there today; `supply/lockBuyer { i, days: 1–3 }`
  (🪙50 / day) keeps today's prices. `D.sellQuote` uses `D.buyerNow`.
- State `s.supply = { found: { rid: { group: n } }, contracts: { rid: { group: { i, until, days } } }, buyer: { rid:
  { i, lockedUntil?, mul? } }, scout, pending }` (`normalizeSupply`).
- Manager: advice only — contract ending in < 2 h / no contract with suppliers known (café), a buyer paying ≥ 10%
  more for beans today (farm); its own buying and selling goes through what you set up.
- UI: sheet «🚚 Nguồn hàng» (from «Nhập hạt» in the café and «Tiến trình» in both games): café groups with the
  current supplier, found suppliers + sign 1 / 7 days, scout; farm buyers with today's prices (green / red vs the
  storehouse), sell here today, lock 3 days, scout.

## Step 3: crop methods (done)

Config `FARMLAB`, `bestMethod(regionId, crop)`, `methodEffect(regionId, crop, method)`, `methodKey` in research.js.
- A way = [shade, spacing, fertilizer], each 0..2 (27 ways). Trade-offs: spacing sparse ×0.85 / dense ×1.15 beans;
  fertilizer organic ×1.05 beans, ×1.1 time / chemical ×1.1 beans, ×0.9 time; shade none ×0.9 / thick ×1.15 time;
  quality (chance of +1 star at harvest) up with shade, sparse spacing, organic. Each region hides a best way per crop:
  every matching factor +5% beans and +8% quality. Example vn-1 robusta best = no shade · dense · chemical: beans
  ×1.45, time ×0.81.
- The default way (some shade · medium · none) is the old neutral farming: plots get no method, nothing changes until
  you adopt something else (the economy sim stays as it was).
- `farmlab/trial { crop, method }`: not the default way, a free trial slot (1, 2 from Lv8), an empty field (the first),
  🪙30 + seeds; plants it marked `trial`. Its harvest (yours or a worker's) records { beans, ms, up } under the way.
- `farmlab/adopt { crop, method }`: a tested way (or the default) for that crop here; `farm/plant` then stores it on
  every new plot (players, workers, robots). `plotGrowMs` × timeMul; harvest beans × yieldMul and +1 star on luck <
  quality (deterministic per plot).
- State `s.farmLab = { methods, trials, results }` per region (`normalizeFarmLab`).
- UI: Seeds sheet «🌱 Ruộng thử»: crop chips, 3 factor pickers, «Gieo thử» (cost, which field, busy / no field),
  running trials with time left, «Các cách đã thử» with beans / time / ⭐+1 % of each way, «Áp dụng».

## Step 4: manager and report (done)
- Manager advice (never runs them): local recipes not found; contract ending / missing; a buyer paying ≥ 10% more;
  a crop with no trial yet; a tried way giving ≥ 10% more beans than the one in use — each with a «Việc của bạn»
  button to the right sheet (Menu / Supply / Seeds).
- Ledger category `research` (tests, scouting, contracts, buyer locks, trial fees) — the report's «Chi phí đi đâu»
  shows «Nghiên cứu, nguồn hàng»; a «🧪 Nghiên cứu (việc của bạn)» section lists recipes found, contracts, crops grown
  your way, trials running and the buyer in use.
