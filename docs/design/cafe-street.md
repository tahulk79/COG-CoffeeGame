# Café street — 4 shops, smarter staff, crowd incidents, ratings (spec)

Founder request (2026-11-06, vi): the café screen becomes a Vietnamese street of 4 shops in one row:
**1 bánh + trà đạo (tea house) · 2 café (the existing one) · 3 trà chanh (lemon tea) · 4 bar.**
Only the café is open at start; the others are unlocked with coins. Tapping a shop zooms the camera to it (operate);
otherwise the player watches the street. Staff must be smarter; the queue forms 2 lines when there is room. Once
several shops are open the crowd behaves like real life: people give up when it is too crowded, fight over a place
(dust-cloud icon, both walk off), cut in line, switch shops ("too slow, I'm going for trà chanh"), curse at a shop
that is not open yet, or go sit in the bar instead. Every unhappy/happy moment feeds a **rating**.

This file is the contract between modules. Numbers live in `src/core/config/*`; UI never hardcodes them.

---------------------------------------------------------------------------------------------------------------------

## 0. Ground rules

* Do **not** bump `SCHEMA` (state.js). Do **not** touch parcels S / C2 / C3, FIXED café counters, CUSTOMER.spawn/exit,
  `RESERVED`, `TUTORIAL_BUILD` — tests and old saves pin them. The café keeps working exactly as before.
* The café "shop" in the founder's numbering = the existing café block **with its expansions** (C3 · alley · S · C2).
  The 3 new shops ("venues") get their own lots further west / east on the same street:

  ```
  x: -40 … -27 | -22 … -11 | alley | -6 … 10 | 12 … 24 | 29 … 41 | 44 … 57
       TEA (1)     C3          ↕      S café     C2        LEMON (3)  BAR (4)
                 └──────────── CAFÉ (2) ────────────┘
  ```
* Randomness in core comes from payloads (`roll`), time from `ctx.now`. Venue customers are **realm-only, transient**
  (not saved); only unlocks, sales and ratings are core state.
* Venue income does not use beans (separate supply). The economy sim never opens venues → pacing tests unchanged.
* New high-frequency actions are added to `QUIET_ACTIONS` (app/game.js) and to `CAFE_LOOP` (refused while the café is
  paused — the whole street pauses with it).
* Mobile perf: venue scenery merged like city.js (vertex colors, few meshes). Speech bubbles are canvas sprites, pooled.

---------------------------------------------------------------------------------------------------------------------

## 1. Config (core)

### 1.1 `config/layout.js`

```js
// widened café area: the street now holds 4 shops (see docs/design/cafe-street.md)
export const CAFE_BOUNDS = { minX: -46, maxX: 62, minZ: 92, maxZ: 130 };
CAFE_ROADS.cafeFront.rect = [-46, 118.5, 62, 121.5];   // street follows the bounds (cafeStreet alley unchanged)

// Café queue: head at the order counter, then 2 lines behind it (founder: "nếu chỗ trống thì xếp 2 hàng").
export const CAFE_QUEUE = { head: { x: -3, z: 107.3 }, cols: [-3.75, -2.25], z0: 108.45, dz: 1.05 };
export function cafeQueueSlot(i) {               // i = index among waiting orders (0 = at the counter)
  if (i <= 0) return { ...CAFE_QUEUE.head };
  const k = i - 1;
  return { x: CAFE_QUEUE.cols[k % 2], z: CAFE_QUEUE.z0 + Math.floor(k / 2) * CAFE_QUEUE.dz };
}
// (CUSTOMER.queue stays for back-compat; cafe.js uses cafeQueueSlot.)

// Street entry points for walk-in customers: the alley (CUSTOMER.spawn) plus both street ends.
export const STREET_ENDS = { west: { x: -45, z: 120 }, east: { x: 61, z: 120 } };

// Venue lots (NOT parcels: unlocked by shop/openVenue, never bought as land, never buildable).
// counter = the shop counter centre (2.6 × 1 m, faces south); vendor stands behind it; queue head in front, then
// 2 lines; seats = low plastic stools on the sidewalk in front of the shop (2 rows like the café terrace).
const venueLot = (id, x0, x1) => {
  const cx = (x0 + x1) / 2;
  return {
    id, rect: [x0, 100, x1, 114], cx,
    counter: { x: cx, z: 106 }, vendor: { x: cx, z: 104.7 },
    queue: { head: { x: cx, z: 107.4 }, cols: [cx - .75, cx + .75], z0: 108.5, dz: 1.05, max: 9 },
    seats: [0, 1].flatMap(row => [-2.4, -.8, .8, 2.4].map(dx => ({ x: cx + dx, z: row ? 117.2 : 115.2, row }))),
    sign: { x: cx, y: 4.2, z: 100.2 },
  };
};
export const VENUE_LOTS = { tea: venueLot('tea', -40, -27), lemon: venueLot('lemon', 29, 41), bar: venueLot('bar', 44, 57) };
export function venueQueueSlot(id, i) { /* same shape as cafeQueueSlot with VENUE_LOTS[id].queue */ }
// Rect of each founder shop for camera framing / taps. 'cafe' = C3 … C2 block incl. terrace.
export const SHOP_FRAMES = {
  tea:   [-41, 99, -26, 118],
  cafe:  [-23, 99, 25, 118],
  lemon: [28, 99, 42, 118],
  bar:   [43, 99, 58, 118],
};
export const STREET_FRAME = [-44, 96, 60, 124];   // overview of the whole street
export const SHOP_ORDER = ['tea', 'cafe', 'lemon', 'bar'];  // founder numbering 1..4 (left → right)
export const shopAt = (x, z) => SHOP_ORDER.find(id => inRect(x, z, SHOP_FRAMES[id])) || null;
```

### 1.2 `config/economy.js`

```js
// Street shops ("venues"). cafe is the existing café (always open). Others: unlocked with coins (+ level gate < 10).
export const VENUES = {
  cafe:  { id: 'cafe',  icon: '☕', cost: 0,    level: 1 },
  lemon: { id: 'lemon', icon: '🍋', cost: 400,  level: 3, items: ['lemonTea', 'kumquatTea'], arrivalSeconds: 7,   serveSeconds: 3,   stay: [6, 10], patienceSeconds: 40 },
  tea:   { id: 'tea',   icon: '🍵', cost: 1200, level: 6, items: ['matcha', 'mooncake'],     arrivalSeconds: 9,   serveSeconds: 4.5, stay: [9, 14], patienceSeconds: 55 },
  bar:   { id: 'bar',   icon: '🍺', cost: 2200, level: 8, items: ['beer', 'cocktail'],       arrivalSeconds: 8,   serveSeconds: 3.5, stay: [10, 16], patienceSeconds: 45 },
};
export const VENUE_ORDER = ['lemon', 'tea', 'bar'];          // unlock order (cheapest first)
export const VENUE_ITEMS = {
  lemonTea:   { id: 'lemonTea',   venue: 'lemon', price: 8,  xp: 1, icon: '🍋' },
  kumquatTea: { id: 'kumquatTea', venue: 'lemon', price: 12, xp: 1, icon: '🧋' },
  matcha:     { id: 'matcha',     venue: 'tea',   price: 20, xp: 2, icon: '🍵' },
  mooncake:   { id: 'mooncake',   venue: 'tea',   price: 26, xp: 2, icon: '🥮' },
  beer:       { id: 'beer',       venue: 'bar',   price: 24, xp: 2, icon: '🍺' },
  cocktail:   { id: 'cocktail',   venue: 'bar',   price: 40, xp: 3, icon: '🍸' },
};
// Ratings: per shop, exponential moving average of 1–5★ reviews. Default 4★ = neutral (arrival factor 1).
export const RATING = { start: 4, minWeight: .08, arrivalPerStar: .12, minFactor: .6, maxFactor: 1.12 };
// Crowd incidents (realm director; numbers only here). Chances are per eligible moment.
export const INCIDENTS = {
  lineGapSeconds: 3.5,      // at most one speech line on screen every N s (street-wide), actionable lines first
  balkChance: .7,           // queue full when someone arrives → they come, look, complain (else: no walker)
  balkReviewChance: .35,    // …and leave a 2★ review
  switchAt: .3,             // queue patience left ≤ 30 % → may switch shop
  switchChance: .45,
  closedCurseChance: .5,    // wanted to switch to a LOCKED lemon/tea shop → walks there, curses, leaves (1★… hint)
  barChance: .35,           // bar open: bored customers go to the bar instead ("đếch mua cafe nữa")
  cutChance: .12,           // new arrival with ≥ 3 waiting cuts in line
  cutFightChance: .4,       // the cut escalates into a fight
  fightChance: .1,          // 2 arrivals within 1.5 s while the queue is ≥ 70 % full
  fightCooldown: 40,        // s between fights street-wide
  fightSeconds: 2.6,
  happyLineChance: .3,      // served happy → says something nice (rate-limited)
  drunkChance: .5,          // bar guests leave wobbling
};
```

`SHOP.patienceSeconds` etc. unchanged.

### 1.3 i18n keys (added by the core step; both `en` and `vi`, `vi` is primary — street-Vietnamese, funny, no slurs)

`v3-hud.js`:
- `venue.tea` "Tea house" / "Bánh & Trà đạo"; `venue.cafe` "Café" / "Cà phê"; `venue.lemon` "Lemon tea" / "Trà chanh"; `venue.bar` "Bar" / "Quán bar"
- `item.lemonTea` "Lemon tea"/"Trà chanh", `item.kumquatTea` "Kumquat tea"/"Trà tắc", `item.matcha` "Matcha"/"Trà đạo",
  `item.mooncake` "Mooncake"/"Bánh trung thu", `item.beer` "Beer"/"Bia", `item.cocktail` "Cocktail"/"Cocktail"
- `hud.street.overview` "Street"/"Cả phố"; `hud.street.focus` p=>`Go to ${p.name}` / `Tới ${p.name}`
- `hud.venue.locked` "Closed"/"Chưa mở"; `hud.venue.open` p=>`Open ${p.name}` / `Mở ${p.name}`;
  `hud.venue.needLevel` "Reach level {level}"/"Cần cấp {level}"; `hud.venue.cost` "{cost} coins"/"{cost} xu";
  `hud.venue.desc.tea|lemon|bar` one-line pitch each; `hud.venue.opened` p=>`${p.name} is open!` / `${p.name} khai trương!`
- `hud.rating.title` "Rating"/"Đánh giá"; `hud.rating.aria` p=>`${p.name}: ${p.avg} stars` / `${p.name}: ${p.avg} sao`
- `hud.toast.review` p=>…(name + stars + quote); `hud.toast.fight` "Two customers fought and left!"/"Hai khách đánh nhau rồi bỏ về!";
  `hud.toast.crowd` "Too crowded — a customer left"/"Đông quá — khách bỏ về"; `hud.toast.switch` p=>`A customer went to ${p.name}` / `Khách bỏ sang ${p.name}`;
  `hud.toast.closed` p=>`Customers want ${p.name}! Open it` / `Khách đòi ${p.name}! Mở quán đi`; `hud.toast.venueSale` p=>`+${p.coins}`

`v3-realm.js` — speech lines (`realm.say.<situation>.<n>`, 3 variants each, short ≤ 22 chars in vi):
`crowd` (Đông quá! 😩 / Xếp hàng tới mai à? / Thôi, về!), `toLemon` (Chờ lâu quá, đi trà chanh! / Qua trà chanh cho nhanh),
`toTea` (Sang uống trà đạo cho thanh tịnh), `toBar` (Chán! Vào bar, đếch mua cafe nữa 🍺 / Thôi làm cốc bia cho xong),
`closed` (Chưa mở à?! 💢 / Đóng cửa?! #@!% / Quán gì không có người bán!), `cut` (Ê! Xếp hàng đi! 😤 / Chen ngang à?),
`cutSorry` (Hì, xin lỗi 😅 / Tưởng không ai thấy), `fight` (Chỗ tao! / Tao đến trước!), `happy` (Ngon! ⭐⭐⭐⭐⭐ / Quán xịn! / Sẽ quay lại 😍),
`slow` (Chờ mãi! ⭐ / Lần sau không tới!), `patience` (Lâu quá, về! / Bán hay ngủ vậy?), `noSeat` (Hết ghế à?),
`drunk` (Hic! 🥴 / Dzô! 🍻 / Một hai ba dzô!), `tea` (🙇 Trà ngon / Thanh tịnh quá), `lemon` (🌻 Tám chuyện tí / Cắn hạt hướng dương),
`vendorIdle` (Mời vào! / Trà chanh đây!).
Lookup: `t('realm.say.crowd.1')` etc. Expose a helper `sayKey(situation, roll)` in speech.js that picks 1..N.

---------------------------------------------------------------------------------------------------------------------

## 2. Core state / derive / actions

### 2.1 State (`state.js` `normalizeRegion`)
```js
street: {
  open: [...new Set((v.street?.open || []).filter(id => id !== 'cafe' && Object.hasOwn(VENUES, id)))],
  rating: Object.fromEntries(Object.keys(VENUES).map(id => [id, {
    avg: num(v.street?.rating?.[id]?.avg, RATING.start, 1, 5), n: num(v.street?.rating?.[id]?.n, 0, 0) }])),
}
```
`freshRegion` gets the same default (`open: []`, every rating `{avg: RATING.start, n: 0}`). `createSave.stats` gains
`venueSold: 0, reviews: 0, fights: 0`. Expiry wipe resets it (fresh normalizeRegion).

### 2.2 derive.js
```js
export const venueOpen = (s, id) => id === 'cafe' || !!region(s)?.street?.open.includes(id);
export function venueError(s, id) { // null = can open
  const def = own(VENUES, id); if (!def || id === 'cafe' || !region(s)) return 'unknown';
  if (venueOpen(s, id)) return 'owned';            // handler turns this into {noop:true}
  if (level(s) < def.level) return 'level';
  if (s.player.coins < def.cost) return 'coins';
  return null;
}
export const venueRating = (s, id) => region(s)?.street?.rating?.[id]?.avg ?? RATING.start;
export const ratingFactor = (s, id = 'cafe') => clamp(1 + (venueRating(s, id) - RATING.start) * RATING.arrivalPerStar, RATING.minFactor, RATING.maxFactor);
export const venueItems = id => (own(VENUES, id)?.items || []);
export const venueArrivalMs = (s, id) => Math.round(VENUES[id].arrivalSeconds * 1000 / ratingFactor(s, id));
export const openVenues = s => ['cafe', ...VENUE_ORDER.filter(id => venueOpen(s, id))];
```
`arrivalMs(s)` (café) is divided by `ratingFactor(s, 'cafe')` (default 1 → sim unchanged).

### 2.3 Actions (`game.js`, all under `shop/` so PAUSABLE / notPlaying checks apply)
* `shop/openVenue {venue}` → `venueError`; `'owned'` → `{noop:true}`; else fail(err, coins ? {missing} : level ? {level} : undefined).
  spend(cost), push id, grantXp(XP.build), ev `venueOpened {venue, cost}`. NOT in CAFE_LOOP.
* `shop/venueSale {venue, item}` → venue must be a non-cafe open venue (`unknown`/`locked`), item must be in
  `VENUES[venue].items` (`unknown`). earn(price), stats.venueSold++, grantXp(item.xp), ev `venueSale {venue, item, coins, xp}`. In CAFE_LOOP.
* `shop/review {venue, stars, reason}` → venue known & open (`unknown`/`locked`); stars = clamp(round(num), 1, 5) (non-finite → fail 'unknown');
  `w = max(RATING.minWeight, 1/(n+1))`, `avg += (stars - avg) * w`, round to 0.01, n++; stats.reviews++;
  reason: one of `served|slow|patience|crowd|fight|cut|closed|switch|bar|venue` else 'venue'. ev `reviewed {venue, stars, avg, reason}`. In CAFE_LOOP.
* `shop/customerLeft {orderId, reason}` — unchanged rules; `reason` whitelisted (`patience|crowd|fight|switch|closed|bar`,
  default `patience`) and copied to the event; `fight` → stats.fights++ (once per order). Existing toasts keep working.
* Junk-payload safe; add new id-taking actions to the prototype-key test. No new error codes (reuse `unknown`,
  `locked`, `level`, `coins`).

### 2.4 Tests (node:test)
openVenue (level gate, coins, success + xp + event, noop when open, cafe → unknown, `__proto__` → unknown),
venueSale (locked → locked, wrong item → unknown, success earns), review EMA math and clamping, normalize keeps/filters
street, arrivalMs unchanged at default rating, customerLeft reason passthrough, i18n keys for venue/item ids.

---------------------------------------------------------------------------------------------------------------------

## 3. Realm modules

### 3.1 `realm/speech.js` (new) — talk bubbles, review stars, fight cloud
```js
export function createSpeech({ scene, camera }) → {
  say(obj3d, text, { ms = 2600, tone = 'normal'|'angry'|'happy'|'review', priority = 0, y = 2.9 } = {}) → bool,
      // street-wide gate: one line every INCIDENTS.lineGapSeconds unless priority ≥ 2 (actionable). false = skipped.
  review(obj3d, stars, text) // ⭐ row + short quote, gold border (priority 1)
  fightCloud(x, z, { seconds = INCIDENTS.fightSeconds }) // spinning dust cloud sprite with 💥⭐💢 popping, little
      // fists/legs flicking out; hides the two fighters (caller hides them) and moves slightly; returns { done: Promise }
  update(dt, time), clear(), dispose()
}
export const sayKey = (situation, roll) => `realm.say.${situation}.${1 + Math.floor(roll * N[situation])}`;
```
Bubbles: rounded cream panel, tail, Vietnamese text (FONT from util.js), angry tone red, happy green, constant-ish size
(sizeAttenuation on, scaled for readability at overview zoom), pooled canvases (max ~8 live), follow the object.

### 3.2 `realm/cafe.js` — 2-line queue + incident API
* queue slots from `cafeQueueSlot(i)`; walkers re-path smoothly when slots shift; face the counter (north).
* `queuedOrder` unchanged semantics (head at slot 0).
* Incident API (called by incidents.js; each method is safe if the order/walker vanished):
  - `info()` → `{ waiting: [{ id, walker, slot, patience (0..1), arrivedAt }], cap, seated: n }`
  - `balk(look, then)` — spawn a **transient** walker (no order) at an entry, walk to the queue tail, stop, `then(walker)`
    callback (director makes it speak and decides where it goes), then `sendAway(walker, target)`.
  - `divert(orderId, target, { mood, speed })` — the walker of a waiting order leaves NOT to the exit but to `target`
    `{x,z}` then calls `onArrive(walker)` (director hands it to street.adopt or makes it curse). Must be called right
    after the core removed the order (so sync does not re-leave it): the director first calls `cafe.claimLeave(orderId)`
    (marks the walker as directed), then dispatches `shop/customerLeft`, and sync then routes it via the claimed plan.
  - `cut(orderId)` — moves that waiting walker to stand beside the head (visual only: offset slot between head and
    line); `uncut(orderId)` returns it to its normal slot.
  - `fight(idA, idB, onDone)` — both walk to the midpoint, cloud (speech.fightCloud), then both are hidden during the
    cloud, reappear dizzy (💫) and leave (director dispatches customerLeft reason 'fight' for both).
  - `walkerById`, `entryFor(x)` (nearest entry), `exitTo(walker, point)`.
* Leave moods: crowd 😩, switch 🙄, closed 💢 (with swear label), fight 💫, bar 🍺.

### 3.3 `realm/street.js` (new) — the 3 venue shops, simulated
```js
createStreet({ scene, vfx, dispatch, navigate, speech, templates }) → {
  sync(state), update(dt, time, state, now, playing),
  adopt(walkerLike | {x, z, look}, venueId, { mood }) → bool   // customer from the café joins this venue's queue
  info(venueId) → { waiting, cap, seated, open }
  serveTap(target) → bool        // player tapped a waiting venue customer: instant serve
  *pickers()                     // pick boxes of waiting venue customers → target { kind: 'venueCustomer', venue, cid }
  vendor(venueId) → Object3D, clear(), dispose()
}
```
Per open venue: a built-in vendor NPC behind the counter (createPerson + dressPerson 'cafe/staff.glb', tinted per
venue), spawns walk-ins every `venueArrivalMs` (× 0.6 – 1.4 jitter) from the nearest STREET_END/alley, queue head + 2
lines (`venueQueueSlot`), vendor serves head every `serveSeconds` (small work anim + steam/sparkle) → dispatch
`shop/venueSale {venue, item}` (item = weighted roll of the venue items), customer walks to a free stool, sits `stay`
seconds with flavor (tea: bow 🙇 + 🍵; lemon: 🌻 seeds + chat; bar: 🍺 clink, karaoke 🎤), leaves; bar guests may
wobble (drunk zig-zag path + "Hic!"). Queue patience `patienceSeconds` → leave grumbling (2★ review 40 %). Seats full →
waits longer. Happy guests review 4–5★ (30 %, rate-limited). Locked venue: no vendor, rolled-down shutter (scene), no
spawns. When the café is paused, the street is paused too. Max ~10 walkers per venue.

### 3.4 `realm/venues-scene.js` (new) + `city.js` / `world.js`
* city.js: street extended to the new bounds (STREET_X ≈ [-70, 80]); house rows skip the venue lots
  (`VENUE_LOTS[*].rect`) and keep filling the gaps; café house unchanged.
* venues-scene.js `createVenueScene({ scene, templates })` → `{ sync(state), pickers(), lockAnchor(id) → {x,y,z}, dispose() }`
  Each venue lot: a 2-floor tube-house shopfront with a big sign (tea: "BÁNH & TRÀ ĐẠO" wood/red, lemon: "TRÀ CHANH"
  yellow/green, bar: "BAR" neon purple/blue + string lights), counter (2.6 m), small menu board, sidewalk stools +
  low tables at `VENUE_LOTS[id].seats` (tea: low wooden tables + cushions; lemon: tiny plastic stools; bar: high stools
  + barrels). Locked: metal shutter down + "CHƯA MỞ" board + dim. Open: shutter up, warm light. Blockers for nav:
  house footprint behind the counter line (z ≤ 105.4) and the counter itself. Pick box per lot →
  target `{ kind: 'venue', venue: id }`. Merged geometry per venue state.

### 3.5 `realm/staff.js` — smarter café staff (see §4)

### 3.6 `realm/incidents.js` (new) — the director
`createIncidents({ cafe, street, speech, dispatch, getState, rng = Math.random })` → `{ update(dt, time, state, now, playing), onCafeSpawnBlocked(look), onCustomerArrived(orderId), onServed(orderId, waitedRatio), onLeft(orderId, angry, reason), clear() }`
Rules (all chances from `INCIDENTS`, all tied to real state):
1. **Crowd balk** — café spawn blocked by `queueCap`: (balkChance) a transient walker comes, stares at the line,
   says `crowd`; then: lemon open & short queue → "toLemon", `street.adopt`; else bar open & roll < barChance → "toBar";
   else lemon locked & roll < closedCurseChance → walks to the locked lemon shutter, swears `closed` (angry tone + 💢
   label), leaves; review 1–2★ `crowd` (balkReviewChance), toast `hud.toast.crowd` (rate-limited 20 s).
2. **Switch** — a waiting café customer with patience ≤ switchAt (once per order, switchChance): target = open lemon
   (or tea) with room → "toLemon"/"toTea", dispatch customerLeft reason 'switch', adopt; bar open (barChance) → "toBar";
   locked lemon/tea → walk there, `closed` curse, leave (reason 'closed', review 1★ 'closed', toast `hud.toast.closed`
   once per 60 s: a hint to unlock). Venue queues are checked the same way (lemon/tea → the bar or the other tea shop; bar customers stay).
3. **Line cutting** — new arrival with ≥ 3 waiting (cutChance): `cafe.cut(id)`; victim (the head-1) says `cut`;
   after 1.6 s: cutFightChance → fight between cutter and victim; else cutter says `cutSorry` and `uncut`s.
4. **Fight** — two arrivals within 1.5 s while waiting ≥ 70 % of cap (fightChance, fightCooldown): both say `fight`,
   cloud, both leave (customerLeft reason 'fight' each, review 2★ 'fight' once), toast `hud.toast.fight`.
5. **Slow seat / patience** — existing angry seated leave → review 1★ `slow` + line; queue timeout → 2★ `patience` (50 %).
6. **Happy** — served: stars = 5 if waited < 40 % of seat patience, 4 if < 75 %, else 3; dispatch review every
   serve (quiet), say `happy` (happyLineChance, rate-limited).
All reviews dispatch `shop/review` (venue, stars, reason) and pop `speech.review` over the customer (rate-limited).

### 3.7 Camera + taps (`realm/index.js`, `camera.js`)
* `realm.focusShop(id | null)` — `id` ∈ SHOP_ORDER → `cam.focusRect(SHOP_FRAMES[id], { key: 'shop:' + id, force: true })`;
  null → `cam.focusRect(STREET_FRAME, { key: 'street', force: true })`. `realm.focusedShop` getter;
  `hooks.onShopFocus?.(id)`. Entering the café view focuses 'cafe' (as today).
* Tap resolution (café view): existing pickers first (badges, staff, seated customers, buildings); then venue customer
  pickers (`street.serveTap`); then a tap on a venue lot or the café frame while it is NOT the focused shop → zoom to
  that shop (consumed, no walk). A tap on a **locked** venue → zoom + `hooks.onSelect({ kind: 'venue', venue })`
  (HUD unlock card). Tutorial running → never intercept café taps.
* World badges over locked venues: 🔒 + price chip (constant screen size, `badges`), "!" when affordable.
* Pinch-out past the street → `focusedShop = null` (overview); the HUD reflects it.

### 3.8 HUD
* Café view: a compact **shop strip** under the top bar: `[🏙 Cả phố] [🍵] [☕] [🍋] [🍺]` (founder order 1-4), the
  focused one highlighted, locked ones dimmed with 🔒; each shows the shop's ⭐ avg (one decimal). Tap → realm.focusShop.
* Venue card (sheet) for `{kind:'venue'}`: icon, name, description, items with prices, level gate / cost, Open button →
  `shop/openVenue`; when open: rating, sold count this session, "Đi tới" (focus).
* Feedback toasts: `venueOpened` (celebrate + confetti VFX via realm), `customerLeft` by reason (fight/crowd/switch/
  closed/bar; existing patience/angry kept), `reviewed` only for ≤ 2★ or 5★ (rate-limited 8 s), `venueSale` none
  (coins fly from the vendor instead).
* `QUIET_ACTIONS` += `shop/venueSale`, `shop/review`.

---------------------------------------------------------------------------------------------------------------------

## 4. Smarter café staff (staff.js)

Problems today: every unit re-searches jobs alone, walks pad ↔ pad, wanders far away when idle and walks back; two
units race to stations; single unit never chains steps; one cup per trip; pushing can shove units into counters.

1. **Posts** (computed each sync from the shop units, stable order by uid):
   1 unit → `all-rounder`; 2 → `cashier` (order) + `barista` (brew + deliver); 3+ → `cashier`, `barista`, rest `runner`
   (deliver). brewBot prefers brew. A unit does its post's jobs first, then any other job (nobody idles while work waits).
2. **Stay at post when idle**: stand on/near the post pad facing the counter (cashier at order pad, barista at brew pad,
   runners near the pickup side); micro-idle (look around, wipe counter) instead of roaming; only after 12 s without
   work take a short stroll (≤ 2.5 m) and come back.
3. **Chaining**: all-rounder after taking an order immediately brews it if a brew slot is free (it's 5 m away);
   after starting a brew whose remaining time ≤ 2.5 s, waits at the pad and delivers it; deliver → go back via the
   order pad if someone is queued.
4. **Two cups**: a worker carrying one cup takes a second ready cup if its seat is within 4 m of the first (deliver
   nearest-first); robots carry 1.
5. **Urgency**: picks the most urgent order (lowest seat patience) — already — plus walks 25 % faster when the target
   customer has ≤ 30 % patience; takes orders only if a seat is free AND (beans ≥ 1 left after the taken orders / the
   player can buy beans) — otherwise shows ☕❌ status once ("Hết hạt!") and waits.
6. **No racing**: per-station claims kept; a unit standing at a pad also "reserves" it so others path to the other side.
7. **Separation never pushes into blocked cells** (check `canStand`/nav before applying a push); while two units face
   each other in a lane, the lower-uid steps aside 0.6 m.
8. Player first: if the player starts the same job (carry / at pad), the unit drops it silently (existing for carry).
Public API unchanged (+ `postOf(uid)` for the HUD staff sheet, optional).

---------------------------------------------------------------------------------------------------------------------

## 5. Out of scope / follow-ups
Hired staff working in venues, venue upgrades (more seats, faster vendor), venue menus by level, night mode for the bar,
quality stars per cup. Venue income is not in the economy sim yet.
