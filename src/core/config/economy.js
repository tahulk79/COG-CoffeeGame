// Farm & Café V3 — economy data. Single source of truth for every price, timer and reward.
// UI and scenes must read numbers from here (never hardcode). Tuned with `node scripts/economy-sim.mjs`.
// See docs/design/v3-gdd.md §Economy and docs/AUTONOMOUS_DECISIONS.md.

// Founder playtest (2026-11-06): every game starts with PLAYTEST.coins, and an existing save is raised to it once
// (story.seen.playtestCoins = that amount; raising PLAYTEST.coins tops up again). Set coins to 0 to go back to the balanced START.coins. Tests run with it off.
export const PLAYTEST = { coins: 9_999_999 };
export const startCoins = () => (PLAYTEST.coins > 0 ? PLAYTEST.coins : START.coins);

export const START = {
  coins: 60,          // balanced start: enough for the first seeds + first building during the tutorial
  rebirthCredits: 3,  // free rebirths (independent from Rounds)
};

// Crops: EMPTY → PLANT → GROW → READY → HARVEST → EMPTY. No water, no fertilizer, plant disappears after harvest.
export const CROPS = {
  robusta: { id: 'robusta', seedCost: 2, growSeconds: 15, beans: 2, xp: 1, level: 1, round: 1, icon: '🌱', color: 0x9a5b34 },
  arabica: { id: 'arabica', seedCost: 6, growSeconds: 40, beans: 4, xp: 3, level: 3, round: 1, icon: '🌿', color: 0xb5452f },
  liberica: { id: 'liberica', seedCost: 16, growSeconds: 90, beans: 8, xp: 6, level: 6, round: 2, icon: '🌳', color: 0x7d2f2a },
};
export const CROP_ORDER = ['robusta', 'arabica', 'liberica'];

// Drinks sold in the café. beans = beans consumed per cup.
export const DRINKS = {
  espresso: { id: 'espresso', beans: 1, price: 10, xp: 2, brewSeconds: 3, level: 1, roaster: 0, icon: '☕' },
  milk: { id: 'milk', beans: 2, price: 22, xp: 4, brewSeconds: 4, level: 2, roaster: 1, icon: '🥛' },
  latte: { id: 'latte', beans: 3, price: 36, xp: 6, brewSeconds: 5, level: 5, roaster: 2, icon: '🍮' },
};
export const DRINK_ORDER = ['espresso', 'milk', 'latte'];

// Max building level reachable in each Round.
// Founder: everything can be upgraded to the max already in Round 1 (no Round caps).
export const ROUND_LEVEL_CAP = { 1: 8, 2: 8, 3: 8 };

// Buildings. zone: 'farm' (build parcels near the fields) or 'shop' (café block). size in grid cells (CELL meters).
// starter: granted free at level 1 in every region (also after a region reset) so a player can never softlock.
// fixed: position decided by the layout (not movable). upgrade[i] = price to go from level i+1 to i+2.
export const CELL = 2;
export const BUILDINGS = {
  silo: { id: 'silo', zone: 'farm', size: [2, 2], cost: 0, starter: true, fixed: true, round: 1, level: 1,
    upgrade: [60, 220, 600, 1400, 3000, 6000, 12000], model: 'farm/market-tier-1.glb', icon: '📦',
    effect: { capacity: [40, 70, 110, 160, 220, 300, 400, 520] } },
  orderCounter: { id: 'orderCounter', zone: 'shop', size: [2, 1], cost: 0, starter: true, fixed: true, round: 1, level: 1,
    upgrade: [100, 260, 700, 1600, 3200, 6400, 12800], model: 'cafe/register-counter.glb#register_counter', icon: '🧾',
    effect: { queue: [2, 3, 3, 4, 4, 5, 5, 6], arrivalSeconds: [9, 8, 7, 6.5, 6, 5.5, 5, 4.5] } },
  brewCounter: { id: 'brewCounter', zone: 'shop', size: [2, 1], cost: 0, starter: true, fixed: true, round: 1, level: 1,
    upgrade: [100, 260, 700, 1600, 3200, 6400, 12800], model: 'cafe/pickup-counter.glb#pickup_counter', icon: '☕',
    effect: { brewSpeed: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5], slots: [1, 1, 2, 2, 2, 3, 3, 3] } },
  // Outdoor seating in front of the café: starter, fixed, walkable; each level adds stools (see layout CAFE_SEATS).
  terrace: { id: 'terrace', zone: 'shop', size: [7, 2], cost: 0, starter: true, fixed: true, walkable: true, round: 1, level: 1,
    upgrade: [80, 200, 450, 900, 1800, 3500, 7000], model: null, icon: '🪑',
    effect: { seats: [4, 6, 8, 10, 12, 14, 16, 18] } },
  roaster: { id: 'roaster', zone: 'shop', size: [2, 2], cost: 40, round: 1, level: 1,
    upgrade: [150, 400, 900, 2000, 4000, 8000, 16000], model: 'farm/roaster-tier-1.glb', icon: '🔥',
    effect: { priceBonus: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] } },
  // Farm building: built on free grass of the farm (not on fields/roads). Boosts beans per harvest.
  dryer: { id: 'dryer', zone: 'farm', size: [2, 2], cost: 120, round: 1, level: 2,
    upgrade: [200, 500, 1100, 2400, 4800, 9600, 19200], model: 'farm/dryer-tier-1.glb', icon: '🟫',
    effect: { yieldBonus: [0.25, 0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3] } },
  tables: { id: 'tables', zone: 'shop', size: [1, 1], cost: 60, round: 1, level: 2,
    upgrade: [120, 300, 700, 1500, 3000, 6000, 12000], model: 'cafe/table.glb#table', icon: '🪑',
    effect: { tip: [0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26], queue: [1, 1, 1, 1, 2, 2, 2, 2] } },
  kiosk: { id: 'kiosk', zone: 'shop', size: [2, 2], cost: 900, round: 1, level: 10,
    upgrade: [1200, 2500, 5000, 9000, 15000, 24000, 36000], model: 'cafe/kiosk.glb#kiosk_unit', icon: '🛖',
    effect: { arrivalBonus: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] } },
  pastry: { id: 'pastry', zone: 'shop', size: [2, 1], cost: 3000, round: 1, level: 12,
    upgrade: [4000, 7000, 11000, 16000, 24000, 34000, 48000], model: 'cafe/pastry-case.glb#pastry_case', icon: '🥐',
    effect: { priceBonus: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] } },
  // Decorations: cheap, give a little XP, purely visual otherwise.
  flowers: { id: 'flowers', zone: 'any', size: [1, 1], cost: 25, round: 1, level: 2, decor: true, upgrade: [], model: 'farm/decor.glb#decor_flowers', icon: '🌼', xp: 3 },
  lamp: { id: 'lamp', zone: 'any', size: [1, 1], cost: 40, round: 1, level: 3, decor: true, upgrade: [], model: 'farm/decor.glb#decor_lamp', icon: '🏮', xp: 4 },
  plant: { id: 'plant', zone: 'any', size: [1, 1], cost: 30, round: 1, level: 2, decor: true, upgrade: [], model: 'cafe/plant.glb#cafe_plant', icon: '🪴', xp: 3 },
};
// Build menu per screen (founder: the farm needs building too). Farm buildings go on free grass, café ones on café lots.
export const BUILD_MENU_FARM = ['dryer', 'flowers', 'lamp', 'plant'];
export const BUILD_MENU_CAFE = ['roaster', 'tables', 'kiosk', 'pastry', 'flowers', 'plant', 'lamp'];
export const BUILD_MENU = [...new Set([...BUILD_MENU_CAFE, ...BUILD_MENU_FARM])];

// Staff: 2 worker types + 2 robot types. Hired once (owned forever), assigned to a zone of the current region.
// Max 3 active units per farm and 3 per shop. Passive bonuses only (no auto plant/harvest yet).
export const STAFF_SLOTS = { farm: 3, shop: 3 };
export const STAFF = {
  farmhand: { id: 'farmhand', kind: 'worker', zone: 'farm', cost: 150, level: 1, round: 1, icon: '👩‍🌾', effect: { growSpeed: 0.15 }, model: 'farm/worker.glb' },
  barista: { id: 'barista', kind: 'worker', zone: 'shop', cost: 200, level: 1, round: 1, icon: '🧑‍🍳', effect: { brewSpeed: 0.25 }, model: 'cafe/staff.glb' },
  sproutBot: { id: 'sproutBot', kind: 'robot', zone: 'farm', cost: 1200, level: 1, round: 1, icon: '🤖', effect: { yieldBonus: 0.25 }, model: null },
  brewBot: { id: 'brewBot', kind: 'robot', zone: 'shop', cost: 1500, level: 1, round: 1, icon: '🦾', effect: { priceBonus: 0.15 }, model: null },
};
export const STAFF_ORDER = ['farmhand', 'barista', 'sproutBot', 'brewBot'];
// Auto play ("lượt auto"): the game plays itself as a live demo while the player watches (camera only, no actions).
// One free run is granted when the Teacher sends you through the gate. A run lasts runSeconds or until stopped.
// More runs can be bought with in-game coins (never real money): price grows a little with each purchase.
export const AUTO = { freeRuns: 1, runSeconds: 180, price: 150, priceStep: 50, maxPrice: 600 };
export const autoPrice = bought => Math.min(AUTO.maxPrice, AUTO.price + AUTO.priceStep * (bought | 0));

// Breaks: workers sometimes slack off (stand still on their phone); robots run out of battery after a while of work.
// A stopped unit does no work and gives no bonus until the player taps the coin bubble over its head and pays `fee`.
// slackChancePerMinute: chance per minute of work that a worker slacks; batteryMinutes: work time per full charge.
export const STAFF_BREAKS = {
  worker: { kind: 'phone', slackChancePerMinute: 0.3, feeRatio: 0.1, minFee: 10 },
  robot: { kind: 'battery', batteryMinutes: 3, feeRatio: 0.06, minFee: 25 },
};
export const staffFee = type => { const def = STAFF[type]; const r = def && STAFF_BREAKS[def.kind]; return r ? Math.max(r.minFee, Math.round(def.cost * r.feeRatio)) : 0; };

// XP needed to REACH each level (cumulative). Index = level. Level 10 is the Region Expiration event.
export const LEVEL_XP = [0, 0, 20, 50, 95, 160, 250, 370, 520, 700, 920];
export const MAX_LEVEL = 30;
export function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level < LEVEL_XP.length) return LEVEL_XP[level];
  let xp = LEVEL_XP[LEVEL_XP.length - 1];
  for (let l = LEVEL_XP.length; l <= level; l++) xp += 260 + 40 * (l - 10);
  return xp;
}
export function levelForXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}
export const EXPIRY_LEVEL = 10;

export const XP = { build: 10, upgrade: 8, buyLand: 6, openRoad: 4, hire: 5 };

// Rounds: exactly three. Round 1 is free. Rounds 2 and 3 cost coins, charged exactly once (idempotent tx).
export const ROUNDS = {
  1: { id: 1, cost: 0, minLevel: 1 },
  2: { id: 2, cost: 1800, minLevel: 10 },
  3: { id: 3, cost: 7000, minLevel: 13 },
};
export const MAX_ROUND = 3;

// Rebirth: spend 1 credit for a permanent +10% blessing (stackable, max 3 total per type). No coins/progress lost.
export const REBIRTH = {
  minLevel: 5,
  blessings: { grow: 0.1, price: 0.1, xp: 0.1 },
  maxStacks: 3,
  // Future: credits can be bought. No real payment is wired — see src/core/systems/rebirth.js `purchaseCredits`.
  shopPacks: [{ id: 'credit1', credits: 1, price: null }],
};

// Two games, farm and café. The player picks ONE when first playing (both can be picked); Round 2 opens the other one
// (founder: "lúc đầu chọn 1 là chơi farm hay cafe … lên vòng 2 thì mở game còn lại").
export const OTHER_GAME_ROUND = 2;
export const GAMES = ['farm', 'cafe'];

// Beans trade, so the farm and the café can each be played on their own (founder: "2 game riêng").
//  · Farm: sell beans at the storehouse for coins (cheaper than turning them into drinks).
//  · Café: buy beans from the supplier when the store is empty (dearer than growing them: home-grown beans stay best).
//  · grace: café softlock guard: no coins for one bean, no beans, nothing being brewed → a few free beans.
export const BEANS = { sellPrice: 2, buyPrice: 4, buyPack: 10, grace: 3 }; // split sim: farm-only ≈ L10 at 20 min, café-only ≈ 22–30 min

// Shop. Customers arrive while the region is active and the queue has room.
// baseSeats: terrace seats (layout CAFE_SEATS); each Tables building adds seatsPerTable. A taken order needs a free seat.
// seatPatienceSeconds: a seated customer whose drink has not been SERVED within this time leaves angry.
export const SHOP = { seatPatienceSeconds: 60, patienceSeconds: 45, maxPendingTips: 0, baseSeats: 4, seatsPerTable: 2 }; // baseSeats = fallback when no terrace

// Safety net: if the player cannot afford the cheapest seed and has nothing growing, no beans and no pending café income,
// planting robusta is free (the Teacher's grace). Never grants coins.
export const GRACE = { freeCrop: 'robusta' };
