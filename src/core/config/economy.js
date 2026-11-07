// Farm & Café V3 — economy data. Single source of truth for every price, timer and reward.
// UI and scenes must read numbers from here (never hardcode). Tuned with `node scripts/economy-sim.mjs`.
// See docs/design/v3-gdd.md §Economy and docs/AUTONOMOUS_DECISIONS.md.

// Founder playtest (2026-11-06): every game starts with PLAYTEST.coins, and an existing save is raised to it once
// (story.seen.playtestCoins = that amount; raising PLAYTEST.coins tops up again). Set coins to 0 to go back to the balanced START.coins. Tests run with it off.
export const PLAYTEST = { coins: 0 }; // off: rewards, hire prices and loans are tested with real coins
export const startCoins = () => (PLAYTEST.coins > 0 ? PLAYTEST.coins : START.coins);

export const START = {
  coins: 60,          // balanced start: enough for the first seeds + first building during the tutorial
  rebirthCredits: 0,  // no free rebirth credits: the Teacher no longer hands them out (blessings were dropped)
};
// Farm tutorial: seeds planted before the first harvest ripen in a few seconds, so a new player is never left waiting.
export const TUTORIAL = { firstGrowSeconds: 4 };

// Crops: EMPTY → PLANT → GROW → READY → HARVEST → EMPTY. No water, no fertilizer, plant disappears after harvest.
export const CROPS = {
  robusta: { id: 'robusta', seedCost: 2, growSeconds: 15, beans: 2, xp: 1, level: 1, round: 1, icon: '🌱', color: 0x9a5b34 },
  arabica: { id: 'arabica', seedCost: 6, growSeconds: 40, beans: 4, xp: 3, level: 3, round: 1, icon: '🌿', color: 0xb5452f },
  // liberica: kept only so old saves with it planted still harvest; not offered (it was the Round 2 crop).
  liberica: { id: 'liberica', seedCost: 16, growSeconds: 90, beans: 8, xp: 6, level: 6, round: 2, icon: '🌳', color: 0x7d2f2a },
};
export const CROP_ORDER = ['robusta', 'arabica'];

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

// Buildings. zone: 'farm' (farm land) or 'shop' (café block) or 'any' (decor, both). size in grid cells (CELL meters).
// starter: granted free at level 1 in every region (also after a region reset) so a player can never softlock.
// fixed: position decided by the layout (not movable). upgrade[i] = price to go from level i+1 to i+2.
// Farm World 2.0 (docs/farm-world-2.0/BUILDING-SYSTEM-2.0.md), every type is data-driven:
//  · category: catalogue tab (farming | processing | storage | infrastructure | decoration | cafe)
//  · use: what the land must allow (layout TERRAIN_USES): 'building' | 'decor' (fields: FIELD.use = 'field')
//  · limit: max count — a number, or [[playerLevel, count], …] (the highest row reached applies). No universal cap.
//  · costGrowth: the k-th copy costs cost × costGrowth^(k−1) (rounded to 5) — duplicates are a real decision.
//  · recipe: processing buildings run one batch of RECIPES[recipe] at a time; effect.speed / effect.batch by level
//    (each upgrade improves ONE of them, alternating).
//  · refund: share of the coins spent (build + upgrades) given back by build/remove (0 = cannot be removed).
// Farm workshops and barns are 3 × 3 m like a field: ONE cleared field = ONE building slot (explicit conversion works
// with a single tap), and an 8 × 8 m yard still holds four of them.
export const CELL = 2;
export const BUILDINGS = {
  silo: { id: 'silo', zone: 'farm', use: 'building', category: 'storage', limit: 1, refund: 0, size: [2, 2], cost: 0, starter: true, fixed: true, round: 1, level: 1,
    upgrade: [60, 220, 600, 1400, 3000, 6000, 12000], model: 'farm/market-tier-1.glb', icon: '📦',
    effect: { capacity: [40, 70, 110, 160, 220, 300, 400, 520] } },
  orderCounter: { id: 'orderCounter', zone: 'shop', use: 'building', category: 'cafe', limit: 1, refund: 0, size: [2, 1], cost: 0, starter: true, fixed: true, round: 1, level: 1,
    upgrade: [100, 260, 700, 1600, 3200, 6400, 12800], model: 'cafe/register-counter.glb#register_counter', icon: '🧾',
    effect: { queue: [2, 3, 3, 4, 4, 5, 5, 6], arrivalSeconds: [9, 8, 7, 6.5, 6, 5.5, 5, 4.5] } },
  brewCounter: { id: 'brewCounter', zone: 'shop', use: 'building', category: 'cafe', limit: 1, refund: 0, size: [2, 1], cost: 0, starter: true, fixed: true, round: 1, level: 1,
    upgrade: [100, 260, 700, 1600, 3200, 6400, 12800], model: 'cafe/pickup-counter.glb#pickup_counter', icon: '☕',
    effect: { brewSpeed: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5], slots: [1, 1, 2, 2, 2, 3, 3, 3] } },
  // Outdoor seating in front of the café: starter, fixed, walkable; each level adds stools (see layout CAFE_SEATS).
  terrace: { id: 'terrace', zone: 'shop', use: 'building', category: 'cafe', limit: 1, refund: 0, size: [7, 2], cost: 0, starter: true, fixed: true, walkable: true, round: 1, level: 1,
    upgrade: [80, 200, 450, 900, 1800, 3500, 7000], model: null, icon: '🪑',
    effect: { seats: [4, 6, 8, 10, 12, 14, 16, 18] } },
  // Café buildings keep ONE copy each (limit 1): a 2nd roaster needs a café production model first (GDD §8, decision 2).
  roaster: { id: 'roaster', zone: 'shop', use: 'building', category: 'cafe', limit: 1, refund: 0.5, size: [2, 2], cost: 40, round: 1, level: 1,
    upgrade: [150, 400, 900, 2000, 4000, 8000, 16000], model: 'farm/roaster-tier-1.glb', icon: '🔥',
    effect: { priceBonus: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] } },
  // Farm processing (Farm World 2.0): beans → dried beans. Was a passive "+% beans per harvest" bonus before layout 5.
  dryer: { id: 'dryer', zone: 'farm', use: 'building', category: 'processing', recipe: 'dry', limit: [[2, 1], [4, 2], [7, 3], [12, 4], [18, 5]], costGrowth: 1.6, refund: 0.5,
    size: [1.5, 1.5], cost: 120, round: 1, level: 2,
    upgrade: [200, 500, 1100, 2400, 4800, 9600, 19200], model: 'farm/dryer-tier-1.glb', icon: '🟫',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  roastery: { id: 'roastery', zone: 'farm', use: 'building', category: 'processing', recipe: 'roast', limit: [[4, 1], [6, 2], [9, 3], [14, 4]], costGrowth: 1.6, refund: 0.5,
    size: [1.5, 1.5], cost: 300, round: 1, level: 4,
    upgrade: [400, 900, 2000, 4000, 8000, 16000, 30000], model: 'farm/roaster-tier-1.glb', icon: '🔥',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  packer: { id: 'packer', zone: 'farm', use: 'building', category: 'processing', recipe: 'pack', limit: [[6, 1], [9, 2], [16, 3]], costGrowth: 1.7, refund: 0.5,
    size: [1.5, 1.5], cost: 700, round: 1, level: 6,
    upgrade: [800, 1800, 3600, 7000, 13000, 24000, 40000], model: null, icon: '🛍️',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  // Extra storage: every barn adds its capacity to the storehouse's (sum, not max).
  warehouse: { id: 'warehouse', zone: 'farm', use: 'building', category: 'storage', limit: [[3, 1], [5, 2], [7, 3], [9, 4], [13, 6]], costGrowth: 1.5, refund: 0.5,
    size: [1.5, 1.5], cost: 150, round: 1, level: 3,
    upgrade: [150, 350, 800, 1600, 3200, 6400, 12000], model: null, icon: '🏚️',
    effect: { capacity: [30, 45, 65, 90, 120, 160, 210, 270] } },
  // Infrastructure: fields whose centre is within `radius` m grow `grow` faster. Coverage, not stacking: a field gets
  // the best well in reach, so a 2nd well only helps fields the 1st one does not reach.
  well: { id: 'well', zone: 'farm', use: 'building', category: 'infrastructure', limit: [[3, 1], [5, 2], [7, 3], [9, 4]], costGrowth: 1.5, refund: 0.5,
    size: [1, 1], cost: 200, round: 1, level: 3,
    upgrade: [250, 600, 1400, 3000, 6000, 12000, 24000], model: 'farm/well-tier-1.glb', icon: '💧',
    effect: { grow: [0.15, 0.15, 0.2, 0.2, 0.25, 0.25, 0.3, 0.3], radius: [6, 7, 7, 8, 8, 9, 9, 10] } },
  tables: { id: 'tables', zone: 'shop', use: 'building', category: 'cafe', limit: 4, refund: 0.5, size: [1, 1], cost: 60, round: 1, level: 2,
    upgrade: [120, 300, 700, 1500, 3000, 6000, 12000], model: 'cafe/table.glb#table', icon: '🪑',
    effect: { tip: [0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26], queue: [1, 1, 1, 1, 2, 2, 2, 2] } },
  kiosk: { id: 'kiosk', zone: 'shop', use: 'building', category: 'cafe', limit: 1, refund: 0.5, size: [2, 2], cost: 900, round: 1, level: 7, // Lv10 is the incident: opened earlier
    upgrade: [1200, 2500, 5000, 9000, 15000, 24000, 36000], model: 'cafe/kiosk.glb#kiosk_unit', icon: '🛖',
    effect: { arrivalBonus: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] } },
  pastry: { id: 'pastry', zone: 'shop', use: 'building', category: 'cafe', limit: 1, refund: 0.5, size: [2, 1], cost: 3000, round: 1, level: 8,
    upgrade: [4000, 7000, 11000, 16000, 24000, 34000, 48000], model: 'cafe/pastry-case.glb#pastry_case', icon: '🥐',
    effect: { priceBonus: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] } },
  // Decorations: cheap, give a little XP, purely visual otherwise.
  flowers: { id: 'flowers', zone: 'any', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 25, round: 1, level: 2, decor: true, upgrade: [], model: 'farm/decor.glb#decor_flowers', icon: '🌼', xp: 3 },
  lamp: { id: 'lamp', zone: 'any', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 40, round: 1, level: 3, decor: true, upgrade: [], model: 'farm/decor.glb#decor_lamp', icon: '🏮', xp: 4 },
  plant: { id: 'plant', zone: 'any', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 30, round: 1, level: 2, decor: true, upgrade: [], model: 'cafe/plant.glb#cafe_plant', icon: '🪴', xp: 3 },
};
// Crop field (one bed): a placeable like a building, saved in region.fields (crop state stays in region.plots by id).
// Every owned field lot (kind 'farm') comes with 6 fields and adds 6 to the free allowance; extra fields cost
// fieldExtraCost(k) (k = extras already placed) up to fieldExtraCap(level) extras. Removing refunds `refund` × the
// last extra's price (0 inside the allowance: you can put it back for free). 3 × 3 m footprint, bed mesh 2.4 m.
export const FIELD = { id: 'field', zone: 'farm', use: 'field', category: 'farming', size: [1.5, 1.5], cost: 0, round: 1, level: 1,
  upgrade: [], icon: '🟫', xp: 2, refund: 0.5, extraBase: 60, extraGrowth: 1.3, extraPerLevel: 2, extraMax: 40 };
export const fieldExtraCost = k => Math.round(FIELD.extraBase * FIELD.extraGrowth ** Math.max(0, k | 0) / 5) * 5;
export const fieldExtraCap = level => Math.min(FIELD.extraMax, FIELD.extraPerLevel * Math.max(1, level | 0));
// Catalogue tabs per screen (HUD construction catalogue) and the build menu per screen.
export const CATEGORY_ORDER = { farm: ['farming', 'processing', 'storage', 'infrastructure', 'decoration'], cafe: ['cafe', 'decoration'] };
export const BUILD_MENU_FARM = ['field', 'dryer', 'roastery', 'packer', 'warehouse', 'well', 'flowers', 'lamp', 'plant'];
export const BUILD_MENU_CAFE = ['roaster', 'tables', 'kiosk', 'pastry', 'flowers', 'plant', 'lamp'];
export const BUILD_MENU = [...new Set([...BUILD_MENU_CAFE, ...BUILD_MENU_FARM])];

// Staff: 2 worker types + 2 robot types, assigned to a zone of the current region (docs/design/staff-manager.md).
// Hiring cap: a zone's team is at most the player level (derive hireCap, err hireLimit); working slots = player level,
// counted per game zone (farm / shop), so every hire works. The bench is for resting units (and costs upkeep).
// Workers open at Lv1; robots at Lv4 (dearer, no phone breaks: a later milestone to wait for).
export const hireLimit = level => Math.max(0, level | 0); // = working slots per zone (name kept for older imports)
export const STAFF_CAP = { perZone: 30 };
export const STAFF = {
  farmhand: { id: 'farmhand', kind: 'worker', zone: 'farm', cost: 150, level: 1, round: 1, icon: '👩‍🌾', effect: { growSpeed: 0.15 }, model: 'farm/worker.glb' },
  barista: { id: 'barista', kind: 'worker', zone: 'shop', cost: 200, level: 1, round: 1, icon: '🧑‍🍳', effect: { brewSpeed: 0.25 }, model: 'cafe/staff.glb' },
  sproutBot: { id: 'sproutBot', kind: 'robot', zone: 'farm', cost: 1200, level: 4, round: 1, icon: '🤖', effect: { yieldBonus: 0.25 }, model: null },
  brewBot: { id: 'brewBot', kind: 'robot', zone: 'shop', cost: 1500, level: 4, round: 1, icon: '🦾', effect: { priceBonus: 0.15 }, model: null },
};
export const STAFF_ORDER = ['farmhand', 'barista', 'sproutBot', 'brewBot'];
// Bench upkeep (§2): only benched WORKERS cost coins (working staff and robots are free). Charged by staff/upkeep for
// the time since the last charge (at most maxCatchUpMinutes: no offline bill). Unpaid → the worker's morale drops.
export const UPKEEP = { benchRatio: 0.1, perMinutes: 10, unpaidMorale: 10, maxCatchUpMinutes: 10 };
// "Đổi ca" (staff/swapShift): who goes to the bench and who is rested enough to come back.
export const SHIFT = { tiredBelow: 40, restedFrom: 70 };
// Worker vitals (§3): ≈ 10 min of work from full energy to empty, ≈ 8 min of work to hungry. Values 0..100 (energy
// max grows with stamina). `start` = a new hire. hungryMul / tiredMul = the realm's speed while hungry / tired.
export const VITALS = { energyDrainPerMin: 10, energyRestPerMin: 20, benchRestMul: 2, hungerPerMin: 12.5, moraleOverworkPerMin: 3,
  funnyMoraleRegenPerMin: 2, tiredBelow: 25, hungryBelow: 20, sulkBelow: 20, staminaEnergyStep: 20, staminaHungerFrom: 4,
  staminaHungerMul: 0.5, maxBatchSeconds: 120, hungryMul: 0.7, tiredMul: 0.6, start: { energy: 100, fullness: 100, morale: 80 } };
// Care actions (§3, staff/care): coin prices and effects. serviceRatio × the robot's price restores its wear.
export const CARE = { nagChance: 0.6, nagMorale: 5, coffee: 20, coffeeEnergy: 60, food: 15, lunchSeconds: 60, bonus: 50, bonusMorale: 40,
  cool: 10, repair: 20, serviceRatio: 0.1 };
// Recruitment (docs/design/staff-robot-gameplay.md §6): each game has its own board of 3 applicants for its worker
// type (farm → farmhand, café → barista). Robots stay a fixed catalogue (staff/hire). The board refreshes for free every
// refreshMinutes, right after a hire, or at once for refreshCost coins. A trait changes the hire price, how often the
// worker slacks (STAFF_BREAKS), its starting / capped stats (§5) and the funny one adds a small bonus where they work.
export const RECRUIT = { size: 3, refreshMinutes: 10, refreshCost: 20, worker: { farm: 'farmhand', shop: 'barista' } };
export const TRAITS = {
  diligent: { icon: '😀', costMul: 1.3, slackMul: 0.4, xpMul: 1.25, bonus: null, start: { stamina: 2 } },
  lazy: { icon: '🥱', costMul: 0.6, slackMul: 2, xpMul: 0.75, bonus: null, cap: { stamina: 3 } },
  funny: { icon: '😄', costMul: 1, slackMul: 1, xpMul: 1, bonus: { farm: { yieldBonus: 0.05 }, shop: { priceBonus: 0.05 } } },
};
export const TRAIT_ORDER = ['diligent', 'lazy', 'funny'];
// Rare applicants (§7): a perk, a dearer price. goldHands: always ≥ 2★; swift: speed starts at 3; tireless: energy
// drains ×tirelessDrain; charming: +charmingBonus coins on the cups it serves.
export const RARE = { chance: 0.1, costMul: 2, perks: ['goldHands', 'swift', 'tireless', 'charming'], swiftSpeed: 3, tirelessDrain: 0.5, charmingBonus: 0.1 };
export const RECRUIT_NAMES = ['Tí', 'Tèo', 'Hoa', 'Lan', 'Minh', 'Nam', 'Mai', 'Bảo', 'Linh', 'Khoa', 'Vy', 'Hùng', 'Thảo', 'Phúc', 'Ngân', 'Đạt'];
export const RECRUIT_INTROS = 3; // staff.intro.<trait>.<1..N>
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** The board for `zone` drawn from `seed` (pure): RECRUIT.size applicants, never two with the same trait and name. */
export function applicantsFor(zone, seed) {
  const type = RECRUIT.worker[zone];
  if (!type) return [];
  const r = rng(seed | 0);
  const traits = [...TRAIT_ORDER].sort(() => r() - .5);
  const names = [...RECRUIT_NAMES];
  const out = [];
  for (let i = 0; i < RECRUIT.size; i++) {
    const trait = traits[i % traits.length];
    const name = names.splice(Math.floor(r() * names.length), 1)[0];
    out.push({ type, trait, name, gender: r() < .5 ? 'male' : 'female', intro: 1 + Math.floor(r() * RECRUIT_INTROS),
      cost: Math.round(STAFF[type].cost * TRAITS[trait].costMul / 5) * 5 });
  }
  // Rarity is drawn AFTER the board above, so a seed keeps the same names / traits it always had.
  for (const a of out) {
    if (r() < RARE.chance) { a.perk = RARE.perks[Math.floor(r() * RARE.perks.length)]; a.cost = Math.round(a.cost * RARE.costMul / 5) * 5; }
    a.stats = startStats(a.trait, a.perk);
  }
  return out;
}
// Per-stat upgrades (§5): every finished job gives the worker XP (× trait xpMul); every xpPerPoint XP = 1 skill point.
// Stat n → n+1 costs n points + coinPerLevel × n coins. Stats 1..maxStat. Unit level (display) = sum of stats − 3.
export const SKILL = { xpPerPoint: 20, coinPerLevel: 100, maxStat: 5 };
export const STAT_ORDER = ['speed', 'smart', 'accuracy', 'stamina'];
export const MAX_STAFF_LEVEL = STAT_ORDER.length * SKILL.maxStat - (STAT_ORDER.length - 1); // 17
export const statCost = n => ({ points: Math.max(1, n | 0), coins: SKILL.coinPerLevel * Math.max(1, n | 0) });
/** Starting stats of a new worker: all 1, diligent stamina 2, swift speed 3. */
export function startStats(trait, perk) {
  const st = Object.fromEntries(STAT_ORDER.map(k => [k, 1]));
  for (const [k, v] of Object.entries(TRAITS[trait]?.start || {})) st[k] = Math.max(st[k], v);
  if (perk === 'swift') st.speed = Math.max(st.speed, RARE.swiftSpeed);
  return st;
}
/** Highest value a trait allows for a stat (lazy: stamina 3). */
export const statCap = (u, stat) => TRAITS[u?.trait]?.cap?.[stat] ?? SKILL.maxStat;
// Deprecated: the old single-level training table. Kept only so older imports keep loading; nothing reads it now.
export const STAFF_LEVELS = [
  { need: 30, fee: 150, minLevel: 3 }, { need: 80, fee: 400, minLevel: 5 }, { need: 160, fee: 900, minLevel: 8 }, { need: 300, fee: 2000, minLevel: 12 },
];
export const LEVEL_STEP = { speed: 0.08, slack: 0.15 }; // per speed step: +8% speed/effect; per stamina step: −15% slack
// Smart rules a worker uses from this SMART stat up (lower = a bit "slow-witted").
//  café: urgent = serve the customer closest to leaving first + hurry; twoCups = carry 2 cups; chain = brew then carry;
//        restock = buys a bean pack when the next cup lacks beans.
//  farm: ripeFirst = harvest the plot ready the longest first (else the nearest); playerCrop = replant the crop the
//        player picked (else the best affordable one); quick = look for the next job at once after one ends;
//        twoPlots = harvests a second ready plot next to the first in the same trip.
export const SMART_RULES = { urgent: 2, twoCups: 3, chain: 4, restock: 5, ripeFirst: 2, playerCrop: 3, quick: 4, twoPlots: 5 };
// Worker tasks (§6): empty = auto. `base` tasks, `more` tasks from smart `moreFromSmart`.
export const WORKER_TASKS = { farm: ['harvest', 'plant', 'water'], shop: ['order', 'brew', 'deliver'] };
export const TASK_LIMIT = { base: 1, more: 2, moreFromSmart: 3 };
// Quality ★ (docs/design/staff-upgrades.md §2.3): who made it sets the stars. Café cup: the player 3★, a worker 2★ from
// ACCURACY workerTwoStar (else 1★), a robot 1★; price × price[stars]. Hard drinks: only the player and accuracy-hardLevel
// workers brew them (robots never). Farm harvest: the player 3★ when picked within freshSeconds of ripening (else 1★),
// workers / robots as in the café; beans × yield[stars] (rounded). Index = stars.
export const QUALITY = { price: [1, 1, 1.2, 1.5], yield: [1, 1, 1.25, 1.5], freshSeconds: 10, workerTwoStar: 3, hardLevel: 5, hardDrinks: ['latte'] };
// Tending (farm): a worker with nothing to do (every field growing) shows a 🪙 bubble; paying `fee` sends it to water
// up to `plots` growing plots, each ripening `speedup` × its grow time sooner. Workers only (robots do one task).
export const TEND = { fee: 15, plots: 4, speedup: 0.3 };
export const isHardDrink = drink => QUALITY.hardDrinks.includes(drink);

// Small staff mistakes (docs/design/staff-upgrades.md §2.2): chance per job by worker ACCURACY 1..5 (index 0..4), ×
// trait mistakeMul. Robots never make mistakes. Only slow things down or cost a little; never lose a customer or a worker.
//  spill: the cup drops on the way → the order goes back to "taken" (rebrew, the beans of one cup are lost);
//  wrongTable: walks to the wrong table first; unripe: picked too early → 1 bean less; crooked: grows ×crookedSlow.
export const MISTAKES = {
  rates: { spill: [.06, .045, .03, .015, 0], wrongTable: [.08, .06, .04, .02, 0], unripe: [.06, .045, .03, .015, 0], crooked: [.05, .04, .025, .01, 0] },
  traitMul: { lazy: 1.5, diligent: 0.7, funny: 1 },
  crookedSlow: 1.1,
};
const isWorker = u => STAFF[u?.type]?.kind === 'worker';
/** One stat of a worker (1..maxStat). Units without `stats` (old saves, hand-made objects) read their old `level`. */
export const statOf = (u, stat) => (isWorker(u) ? Math.min(SKILL.maxStat, Math.max(1, (u.stats?.[stat] ?? u.level) | 0 || 1)) : 1);
export const mistakeChance = (u, kind) => (isWorker(u) ? (MISTAKES.rates[kind]?.[statOf(u, 'accuracy') - 1] || 0) * (MISTAKES.traitMul[u.trait] ?? 1) : 0);
/** Display level: speed + smart + accuracy + stamina − 3 (1..17); robots 1. */
export const unitLevel = u => (isWorker(u) ? STAT_ORDER.reduce((n, k) => n + statOf(u, k), 0) - (STAT_ORDER.length - 1) : 1);
export const hasRule = (u, rule) => statOf(u, 'smart') >= (SMART_RULES[rule] ?? 99);
/** Worker speed factor from the SPEED stat (+8% a step). Its effect bonus scales with it too. */
export const levelSpeed = u => 1 + LEVEL_STEP.speed * (statOf(u, 'speed') - 1);
/** How many tasks a worker may be given (staff/setTasks). */
export const taskLimit = u => (statOf(u, 'smart') >= TASK_LIMIT.moreFromSmart ? TASK_LIMIT.more : TASK_LIMIT.base);
/** Energy max: 100 + 20 per stamina step above 1. */
export const energyMax = u => 100 + VITALS.staminaEnergyStep * (statOf(u, 'stamina') - 1);

// Robots (docs/design/staff-upgrades.md §4, staff-manager.md §4): "a robot is just a robot" — it never learns, does
// exactly ONE task that the player sets (or 'auto': the robot picks the task with the most work waiting, re-checked
// every autoSeconds), and only its hardware is upgraded with coins. Tier prices = costRatio × the robot's price; tier 3
// needs player level 8. The old charger is merged into the battery (cheaper recharge per tier).
export const ROBOT_TASKS = { sproutBot: ['plant', 'harvest'], brewBot: ['order', 'brew', 'deliver'] };
export const ROBOT_AUTO = { autoSeconds: 30 };
export const ROBOT_PARTS = {
  battery: { icon: '🔋', minutes: [3, 4, 6, 9], feeMul: [1, 0.8, 0.6, 0.4] }, // work minutes per charge, recharge fee
  motor: { icon: '⚙️', speed: [1, 1.1, 1.2, 1.35], heatMul: [1, 1.15, 1.3, 1.5] }, // faster, but hotter
  cooler: { icon: '❄️', heatMul: [1, 0.67, 0.5, 0] },                               // tier 3 never overheats
  frame: { icon: '🛡️', jamMul: [1, 0.67, 0.44, 0.3], wearMul: [1, 0.67, 0.44, 0.3] }, // fewer jams, slower wear
};
export const PART_ORDER = ['battery', 'motor', 'cooler', 'frame'];
export const PART_COST = { costRatio: [0.3, 0.6, 1], maxTier: 3, tier3Level: 8 };
// Robot heat / jam / wear (§4). heat 0..100 (100 = overheat for overheatSeconds); wear 100 = new → 0. Jam chance per job.
export const ROBOT_WEAR = { heatPerMin: 25, coolPerMin: 40, overheatSeconds: 30, jamChance: 0.02, wearPerJob: 0.2, lowWear: 30, lowWearJamMul: 2 };
export const partTier = (u, part) => Math.min(PART_COST.maxTier, Math.max(0, (u?.parts?.[part] | 0)));
export const partCost = (type, tier) => Math.round((STAFF[type]?.cost || 0) * (PART_COST.costRatio[tier] ?? 0) / 5) * 5;
export const robotTask = u => (ROBOT_TASKS[u?.type]?.includes(u.task) ? u.task : 'auto');
/** Work / walk speed factor of a unit: worker speed stat or robot motor. */
export const unitSpeed = u => (STAFF[u?.type]?.kind === 'robot' ? ROBOT_PARTS.motor.speed[partTier(u, 'motor')] : levelSpeed(u));
export const batteryMinutes = u => ROBOT_PARTS.battery.minutes[partTier(u, 'battery')];
/** Heat a working robot gains per minute (motor makes it hotter, the cooler cancels it). */
export const heatPerMin = u => ROBOT_WEAR.heatPerMin * ROBOT_PARTS.motor.heatMul[partTier(u, 'motor')] * ROBOT_PARTS.cooler.heatMul[partTier(u, 'cooler')];
/** Chance one finished job jams the robot (the realm rolls it and sends staff/jam). */
export const jamChance = u => (STAFF[u?.type]?.kind === 'robot'
  ? ROBOT_WEAR.jamChance * ROBOT_PARTS.frame.jamMul[partTier(u, 'frame')] * ((u.wear ?? 100) < ROBOT_WEAR.lowWear ? ROBOT_WEAR.lowWearJamMul : 1) : 0);
/** Slack chance multiplier of a worker: trait × stamina. */
export const slackMul = u => (TRAITS[u?.trait]?.slackMul ?? 1) * Math.max(0.2, 1 - LEVEL_STEP.slack * (statOf(u, 'stamina') - 1));

// Rivals (§7): every everyMinutes a rival owner may try to poach a low-morale (or rare) worker; the player has
// keepSeconds to pay keepFeePerLevel × unit level (+keepMorale morale) or let them go (letGoRefund × hire price back).
export const RIVAL = { everyMinutes: 8, chance: 0.5, keepSeconds: 60, keepFeePerLevel: 50, keepMorale: 20, refuseMorale: 70, targetMorale: 50,
  letGoRefund: 0.3, names: { farm: 'Bà Tư', shop: 'Anh Ba' } };
// Fire / sell (§8): refund ratio of what was paid at hire (robots also get back part of their hardware).
export const FIRE = { worker: 0.3, robot: 0.5, robotParts: 0.5 };
// Books (§8): team ledger per game minute (last ledgerKeep kept), journal (newest first, journalKeep), MVP every
// mvpMinutes (+mvpMorale to every worker).
export const BOOKS = { ledgerKeep: 30, journalKeep: 30, mvpMinutes: 10, mvpMorale: 10 };

/** Extra effect a unit's trait adds in its zone (e.g. funny barista: +5% drink price). */
export const traitEffect = (unit, key) => TRAITS[unit?.trait]?.bonus?.[STAFF[unit.type]?.zone]?.[key] || 0;
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
// A unit's break fee: a robot's battery upgrade makes the recharge cheaper (the old charger part is merged into it).
export const unitFee = u => Math.round(staffFee(u?.type) * (STAFF[u?.type]?.kind === 'robot' ? ROBOT_PARTS.battery.feeMul[partTier(u, 'battery')] : 1));

// XP needed to REACH each level (cumulative). Index = level. Level 10 is the Region Expiration event.
export const LEVEL_XP = [0, 0, 20, 50, 95, 160, 250, 370, 520, 700, 920];
export const MAX_LEVEL = 100; // levels past 10 follow the formula in xpForLevel (farm map runs to Lv100)
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

// Level gifts: every level-up gives one gift, claimed from a gift box (HUD). Levels in CHEST_LEVELS give a surprise
// chest instead (one random prize from CHEST_PRIZES, drawn with a roll from the action payload so it stays
// deterministic). Gifts are earned again after the Level-10 incident (level goes back to 1).
export const CHEST_LEVELS = [5, 10, 15];
export function levelGift(level) {
  const items = [{ kind: 'coins', amount: 40 * level }];
  if (level === 2 || level === 8) items.push({ kind: 'hireTicket', amount: 1 }); // a free hire
  if (level === 4 || level === 7) items.push({ kind: 'autoRun', amount: 1 });
  return items;
}
// Surprise prizes (weight = how often). New crops / animals (potato, carrot, chicken, pig) join this list once the
// produce system exists (see docs/design/level-progression.md).
export const CHEST_PRIZES = [
  { id: 'jackpot', weight: 3, items: level => [{ kind: 'coins', amount: 150 * level }] },
  { id: 'helpers', weight: 2, items: level => [{ kind: 'hireTicket', amount: 2 }, { kind: 'coins', amount: 40 * level }] },
  { id: 'beans', weight: 2, items: level => [{ kind: 'beans', amount: 30 }, { kind: 'coins', amount: 60 * level }] },
  { id: 'auto', weight: 1, items: level => [{ kind: 'autoRun', amount: 2 }, { kind: 'coins', amount: 60 * level }] },
];
export function chestPrize(roll) {
  const total = CHEST_PRIZES.reduce((n, p) => n + p.weight, 0);
  let x = Math.min(0.999999, Math.max(0, Number(roll) || 0)) * total;
  for (const p of CHEST_PRIZES) { if (x < p.weight) return p; x -= p.weight; }
  return CHEST_PRIZES[0];
}

// Loans (HUD 💰 under the gear): borrow a pack of coins now, owe it back plus a fee. Playtest: loans stack (borrow
// again any time; the amount and the debt add up).
// While a loan is open, autoRepay of every coin income goes to the debt; the rest can be paid any time.
// The Level-10 incident wipes everything, the debt too.
export const LOAN = { packs: [1000, 2000, 5000], fee: 0.1, autoRepay: 0.2 };
export const loanOwed = amount => Math.round(amount * (1 + LOAN.fee));

// Rounds: three, shown as a roadmap (HUD 🚂). Only Round 1 is playable for now: pick farm OR café, earn, upgrade;
// Level 10 = the incident (lose everything, choose a new place). Rounds 2 (farm + café) and 3 are shown locked;
// how they open is not designed yet, so there is no unlock action.
export const ROUND_IDS = [1, 2, 3];
export const MAX_ROUND = 3;

// Rebirth: spend 1 credit for a permanent +10% blessing (stackable, max 3 total per type). No coins/progress lost.
export const REBIRTH = {
  minLevel: 5,
  blessings: { grow: 0.1, price: 0.1, xp: 0.1 },
  maxStacks: 3,
  // Future: credits can be bought. No real payment is wired — see src/core/systems/rebirth.js `purchaseCredits`.
  shopPacks: [{ id: 'credit1', credits: 1, price: null }],
};

// Two games, farm and café. Each region is played as ONE game, picked when entering it for the first time; some
// countries offer only one of the two (config/world.js COUNTRIES[].games).
export const GAMES = ['farm', 'cafe'];

// Beans trade, so the farm and the café can each be played on their own (founder: "2 game riêng").
//  · Farm: sell beans at the storehouse for coins (cheaper than turning them into drinks).
//  · Café: buy beans from the supplier when the store is empty (dearer than growing them: home-grown beans stay best).
//  · grace: café softlock guard: no coins for one bean, no beans, nothing being brewed → a few free beans.
export const BEANS = { sellPrice: 2, buyPrice: 4, buyPack: 10, grace: 3 }; // split sim: farm-only ≈ L10 at 20 min, café-only ≈ 22–30 min

// ---------- Farm World 2.0: farm goods and processing (docs/farm-world-2.0/FARM-ECONOMY-BALANCE.md) ----------
// Goods share the storehouse space (1 each; a bag holds 3 roasted beans, so packing also frees room).
// 'beans' stays saved as inventory.beans (the café brews from it); the others live in inventory.items.
// Price ladder per raw bean: sold raw 2 → dried 3 → roasted ≈ 5 net → bagged ≈ 6.6 net (fees included); per batch
// (2 taps: start + collect) a stage adds +12 / +24 / +19 coins at level 1 — more per tap than harvesting (~5), so the
// workshop pays for the taps it costs; batch upgrades (×2, ×3, ×4) widen the gap. Tuned with scripts/economy-sim.mjs.
export const GOODS = {
  beans: { id: 'beans', icon: '🫘', price: BEANS.sellPrice },
  dried: { id: 'dried', icon: '🟤', price: 4 },
  roasted: { id: 'roasted', icon: '☕', price: 9 },
  bag: { id: 'bag', icon: '🛍️', price: 33 },
};
export const GOOD_ORDER = ['beans', 'dried', 'roasted', 'bag'];
export const ITEM_GOODS = ['dried', 'roasted', 'bag']; // stored in inventory.items
// Recipes: one batch = `in` → `out` in `seconds` (÷ effect.speed of the building level, × effect.batch for in/out/fee),
// `fee` coins of fuel per batch, `xp` per batch collected. The job's duration is fixed when it starts.
export const RECIPES = {
  dry: { id: 'dry', building: 'dryer', in: { beans: 12 }, out: { dried: 12 }, seconds: 30, fee: 0, xp: 1 },
  roast: { id: 'roast', building: 'roastery', in: { dried: 12 }, out: { roasted: 9 }, seconds: 45, fee: 3, xp: 2 },
  pack: { id: 'pack', building: 'packer', in: { roasted: 9 }, out: { bag: 3 }, seconds: 40, fee: 2, xp: 2 },
};

// Shop. Customers arrive while the region is active and the queue has room.
// baseSeats: terrace seats (layout CAFE_SEATS); each Tables building adds seatsPerTable. A taken order needs a free seat.
// seatPatienceSeconds: a seated customer whose drink has not been SERVED within this time leaves angry.
export const SHOP = { seatPatienceSeconds: 60, patienceSeconds: 45, maxPendingTips: 0, baseSeats: 4, seatsPerTable: 2 }; // baseSeats = fallback when no terrace

// Safety net: if the player cannot afford the cheapest seed and has nothing growing, no beans and no pending café income,
// planting robusta is free (the Teacher's grace). Never grants coins.
export const GRACE = { freeCrop: 'robusta' };

// ---------- Café street: 4 shops (docs/design/cafe-street.md) ----------
// Street shops ("venues"). 'cafe' is the existing café (always open, sells DRINKS with beans). The others are unlocked
// with coins (`shop/openVenue`, level gates stay below the Level-10 incident) and sell their own items without beans.
// Venue customers are simulated by the realm (transient, not saved); core keeps unlocks, sales and ratings only.
//  arrivalSeconds: one walk-in every N s at 4★ (rating changes it, see RATING) · serveSeconds: vendor time per cup
//  stay: [min, max] s sitting on a stool · patienceSeconds: queue patience before leaving
export const VENUES = {
  cafe: { id: 'cafe', icon: '☕', cost: 0, level: 1 },
  lemon: { id: 'lemon', icon: '🍋', cost: 400, level: 3, items: ['lemonTea', 'kumquatTea'], arrivalSeconds: 7, serveSeconds: 3, stay: [6, 10], patienceSeconds: 40 },
  tea: { id: 'tea', icon: '🍵', cost: 1200, level: 6, items: ['matcha', 'mooncake'], arrivalSeconds: 9, serveSeconds: 4.5, stay: [9, 14], patienceSeconds: 55 },
  bar: { id: 'bar', icon: '🍺', cost: 2200, level: 8, items: ['beer', 'cocktail'], arrivalSeconds: 8, serveSeconds: 3.5, stay: [10, 16], patienceSeconds: 45 },
};
export const VENUE_ORDER = ['lemon', 'tea', 'bar'];          // unlock order (cheapest first)
export const VENUE_ITEMS = {
  lemonTea: { id: 'lemonTea', venue: 'lemon', price: 8, xp: 1, icon: '🍋' },
  kumquatTea: { id: 'kumquatTea', venue: 'lemon', price: 12, xp: 1, icon: '🧋' },
  matcha: { id: 'matcha', venue: 'tea', price: 20, xp: 2, icon: '🍵' },
  mooncake: { id: 'mooncake', venue: 'tea', price: 26, xp: 2, icon: '🥮' },
  beer: { id: 'beer', venue: 'bar', price: 24, xp: 2, icon: '🍺' },
  cocktail: { id: 'cocktail', venue: 'bar', price: 40, xp: 3, icon: '🍸' },
};
// Ratings: per shop, exponential moving average of 1–5★ reviews (weight max(minWeight, 1/(n+1)), so the first reviews
// count fully and later ones by at least minWeight). start 4★ = neutral: arrival factor 1 (pacing unchanged).
// Arrival factor = clamp(1 + (avg − start) × arrivalPerStar, minFactor, maxFactor); arrival time is divided by it.
export const RATING = { start: 4, minWeight: .08, arrivalPerStar: .12, minFactor: .6, maxFactor: 1.12 };
export const REVIEW_REASONS = ['served', 'slow', 'patience', 'crowd', 'fight', 'cut', 'closed', 'switch', 'bar', 'venue'];
export const LEAVE_REASONS = ['patience', 'crowd', 'fight', 'switch', 'closed', 'bar'];
// Crowd incidents (realm director, realm/incidents.js; numbers only here). Chances are per eligible moment.
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
// Speech situations → number of variants in the locale pack (realm.say.<situation>.<1..n>, v3-realm.js).
// realm/speech.js `sayKey(situation, roll)` picks 1 + floor(roll × n). Keep in sync with the locale keys (tested).
export const SAY_VARIANTS = {
  crowd: 3, toLemon: 3, toTea: 2, toBar: 3, closed: 3, cut: 3, cutSorry: 2, fight: 3, happy: 3,
  slow: 2, patience: 3, noSeat: 2, drunk: 3, tea: 2, lemon: 3, bar: 2, vendorIdle: 3,
};
