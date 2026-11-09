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

// Reference income I(L) per game (docs/design/management-rules.md §2.0): coins per PLAYED minute a region of that game
// earns at player level L (whole farm / café: your own taps + staff), interpolated between the keys (flat past the
// last key). Every management price is k minutes of I, every running cost a % of I, every penalty a % of I30. A region
// plays ONE game, so each game has its own curve; another game ships its own row. INCOME_FLOOR: the measured 10 / 30
// minute income (s.income) never counts below this share of the reference (a new save starts at the floor).
export const INCOME_REF = {
  farm: { 1: 80, 3: 150, 6: 250, 10: 310, 15: 440, 20: 550, 30: 750 },
  cafe: { 1: 80, 3: 200, 6: 440, 10: 620, 15: 1050, 20: 1300, 30: 1800 },
};
export const INCOME_FLOOR = 0.3;
/** I(L): reference coins per played minute for `game` ('farm' | 'cafe'; anything else → farm) at `level`. */
export function incomeRef(game, level) {
  const row = INCOME_REF[game] || INCOME_REF.farm;
  const keys = Object.keys(row).map(Number).sort((a, b) => a - b);
  const L = Math.max(keys[0], Number(level) || keys[0]);
  if (L >= keys[keys.length - 1]) return row[keys[keys.length - 1]];
  let i = 0;
  while (keys[i + 1] < L) i++;
  const a = keys[i], b = keys[i + 1];
  return row[a] + (row[b] - row[a]) * (L - a) / (b - a);
}
// Income series (s.income, management-rules §2.0): one row per PLAYED minute { m, earned, spent, by: { player, g1,
// staff } (net coins per actor) }, the last keepMinutes kept. Written by every coin income and every coin spend.
// I10 / I30 = the sums over the last shortMin / longMin played minutes (floored, see INCOME_FLOOR).
// 'penalty': coin fines of expired tasks (management-rules §4.3), booked as spending of their own; 'system': timers
// (the played clock, rivals, loan checks).
export const INCOME = { keepMinutes: 60, shortMin: 10, longMin: 30, actors: ['player', 'g1', 'staff', 'penalty', 'system'] };
// Played clock (s.clock.played, ms): advanced only by clock/tick from the realm while the game runs in front (it stops
// when the app is closed or the game is paused). Career tenure, loan terms and the income series run on it. One tick
// carries at most maxTickMs (a stalled tab never jumps the clock).
// loanTickSeconds: how often (seconds of play) the realm sends loan/tick (late check, §4.5).
export const CLOCK = { tickSeconds: 5, maxTickMs: 30000, loanTickSeconds: 60 };

// Inbox — Việc cần duyệt (management-rules §1.2 / §4): ONE list (s.tasks.open ≤ cap, s.tasks.done ≤ doneKeep) of
// everything the player must answer: the manager's requests and the rivals' visits. Every time is in PLAYED minutes.
//  life: minutes a task of that kind stays open; remindHalf: a reminder at that share of its life; remindLastMin: one
//  more that many minutes before it ends (kinds without one: none); graceMin: back after ≥ returnAwayMin minutes
//  away → every open task gets at least graceMin more; lateMin: an expired manager task may still be approved late
//  within lateMin; maxFiledPerThink: requests the manager files in one think; systemKinds: never penalised;
//  laterEveryMin: a full inbox («Để sau») is logged / announced at most once per that many played minutes.
//  kindOf: action type → task kind (anything else the manager files = staffGrowth); groupOf: kind → licence group.
export const TASKS = {
  cap: 8, doneKeep: 50,
  life: { care: 5, trade: 10, staffGrowth: 30, land: 60, loan: 30, poach: 1, gmPoach: 180, topUp: 60 },
  remindHalf: 0.5, remindLastMin: { care: 1, trade: 1, staffGrowth: 2, land: 5, loan: 2 },
  graceMin: 2, returnAwayMin: 5, lateMin: 5, maxFiledPerThink: 2, laterEveryMin: 10,
  systemKinds: ['poach', 'gmPoach'], noPenaltyKinds: ['topUp', 'trade', 'poach', 'gmPoach'],
  kindOf: { 'staff/care': 'care', 'staff/keep': 'care', 'staff/swapShift': 'care', 'staff/setActive': 'care', 'farm/sellAll': 'trade', 'farm/sell': 'trade',
    'shop/buyBeans': 'trade', 'loan/take': 'loan', 'loan/repay': 'loan', 'land/buyParcel': 'land', 'land/sell': 'land', 'build/place': 'land', 'build/upgrade': 'land', 'gm/topUpSeen': 'topUp' },
  groupOf: { care: 'hr', staffGrowth: 'hr', poach: 'hr', gmPoach: 'hr', trade: 'beans', land: 'land', loan: 'credit', topUp: 'topUp' },
};
// Penalties of an ignored manager task (management-rules §2.8 / §4.3), in this order: loyalty → throttle → coins, and
// the zone's morale. perTask × I30 per task, the fines of the last windowMin played minutes ≤ cap30OfI10 × I10, never
// below 0 coins. loyalty per task (≤ loyaltyDay a day), morale per unit of the task's zone (≤ moraleZoneDay per zone a
// day, the strike's moralePerMin drain counted in it). backlog: +1 per expired task; waitAt → Chờ lệnh for waitMin
// (safe + care only, 1 action per think, no filing), poachAt → the next rival visit always lures him, strikeAt →
// Đình công (he stops; ends on gm/apologise or an empty inbox); −decay per decayEveryMin played minutes (emptyDecay
// while the inbox has none of his tasks). apologise: apologiseSalaries × salary → backlog 0, +apologiseLoyalty, strike
// over. lateLoyalty: a late approval's loyalty (+approveLoyalty for one in time). returnLoyaltyCap: the loyalty lost
// on one return (the away drop + the expiries of the grace minutes) is at most this. cooldownMin: a key denied /
// expired / done / failed waits that long before the manager files or does it again.
export const PENALTY = {
  perTask: 0.03, cap30OfI10: 0.25, windowMin: 30,
  loyalty: 3, loyaltyDay: 15, morale: 3, moraleZoneDay: 30, strikeMoralePerMin: 1,
  backlog: { waitAt: Infinity, poachAt: Infinity, strikeAt: Infinity, // no sit-ins: the manager always keeps working (founder 2026-11-08)
     waitMin: 10, decayEveryMin: 10, decay: 1, emptyDecay: 2 },
  apologiseSalaries: 2, apologiseLoyalty: 10, lateLoyalty: 1, returnLoyaltyCap: 40,
  cooldownMin: { denied: 5, expired: 3, done: 1, failed: 1 }, // 15 / 10 → 5 / 3 (founder 2026-11-08: a phone session is short)
};
// Nhật ký — the unified history (management-rules §1.3 / §5). rows: shared ring; perUnit: each unit's own ring
// (u.recent, the manager's s.gm.unit.recent); days: per-day rows per actor (distinct days kept); tombstones: units
// that left (names stay readable); workBatchSec: job completions of a unit fold into one row per that many played
// seconds; keepGroupsOnWipe: rows the Level-10 incident never drops, keepOthersOnWipe: newest other rows it keeps;
// page: rows per page on the screen; profileRows: shared rows on a unit's Lịch sử. groups: row type → group (anything else: 'event').
export const HISTORY = {
  rows: 400, perUnit: 30, days: 30, tombstones: 50, workBatchSec: 60, keepGroupsOnWipe: ['plan', 'approval'], keepOthersOnWipe: 50, page: 50, profileRows: 20,
  groupOrder: ['work', 'care', 'hr', 'money', 'plan', 'approval', 'event'],
  groups: {
    work: 'work', craft: 'work', mvp: 'work', did: 'work', away: 'work', idle: 'work', absent: 'work',
    overheat: 'care', jam: 'care', managerCare: 'care', autoCare: 'care', nagged: 'care', cared: 'care', nudged: 'care', slacked: 'care', warranty: 'care', calmed: 'care',
    hired: 'hr', left: 'hr', activated: 'hr', benched: 'hr', promoted: 'hr', steppedDown: 'hr', poachRefused: 'hr', poachStarted: 'hr', kept: 'hr',
    followed: 'hr', refused: 'hr', poached: 'hr', upgraded: 'hr', part: 'hr', gear: 'hr', software: 'hr',
    unpaid: 'money', licence: 'money', landSold: 'money', trainStart: 'hr', trained: 'hr', topUpSeen: 'approval', loanLate: 'money', loanTaken: 'money', loanRepaid: 'money', loanPaid: 'money', fine: 'money',
    setTasks: 'plan', robotTask: 'plan', dayPlan: 'plan',
    asked: 'approval', approved: 'approval', denied: 'approval', expired: 'approval', failed: 'approval', taskFiled: 'approval', taskApproved: 'approval',
    taskDenied: 'approval', taskExpired: 'approval', taskLate: 'approval', taskFailed: 'approval', later: 'approval', apologised: 'approval',
  },
};

// Crops are perennial trees (docs/design/coffee-varieties.md §2b): EMPTY → PLANT (a sapling, paid once) → ESTABLISH
// (growSeconds, the first crop) → READY → HARVEST → the tree stays → next season (cycleSeconds) → READY → …
// After `life` harvests the tree is old (PERENNIAL.oldYield of its beans): cut it back (farm/prune, cưa đốn phục hồi)
// or uproot it (farm/uproot) and plant again.
// Three real varieties (docs/design/coffee-varieties.md):
//  · price: coins per raw bean at the storehouse (beans are stored per variety in inventory.beanMix).
//  · freshSeconds: ripe window that still counts as a fresh (3★) pick by the player (QUALITY.freshSeconds otherwise).
//  · rawOnly (optional): never fed to the processing chain. Unused: a dearer bean keeps its value through the chain via
//    RECIPES.dry.premium (specialty batch) instead.
//  · drop: Arabica cherries fall when ripe: after `after` s past ripe, one bean is lost every `every` s (never below 1).
//  · pollinate (optional): self-sterile variety: a plant with no other of its kind within `radius` m loses `loss` beans.
//  · waves: Liberica ripens unevenly: the first pick gives `first` of the beans, the rest ripen `regrowSeconds` later.
//  · info: the variety card (founder table 2026-11-08): difficulty 1 easy · 2 medium · 3 hard, yield / price 1 low … 3 high,
//    strength n/5; altitude / temperature / aroma / tree shape are i18n texts (crop.<id>.alt…).
// Robusta: easy (no pollination penalty any more), heavy yield, cheap. Arabica: hard (cherries drop, short fresh window),
// low yield, best cup, dear. Liberica: medium (slow, ripens in two waves), good yield, strongest cup, middle price.
export const CROPS = {
  robusta: { id: 'robusta', seedCost: 15, growSeconds: 60, cycleSeconds: 36, life: 6, beans: 3, xp: 2, level: 1, round: 1, icon: '🌱', color: 0x9a5b34,
    price: 2, freshSeconds: 30, info: { difficulty: 1, yield: 3, price: 1, strength: 4 } },
  arabica: { id: 'arabica', seedCost: 35, growSeconds: 120, cycleSeconds: 80, life: 6, beans: 2, xp: 4, level: 3, round: 1, icon: '🌿', color: 0xb5452f,
    price: 7, freshSeconds: 10, drop: { after: 30, every: 20 }, info: { difficulty: 3, yield: 1, price: 3, strength: 2 } },
  liberica: { id: 'liberica', seedCost: 30, growSeconds: 240, cycleSeconds: 150, life: 8, beans: 4, xp: 6, level: 5, round: 1, icon: '🌳', color: 0x7d2f2a,
    price: 3, freshSeconds: 600, waves: { first: 0.6, regrowSeconds: 45 }, info: { difficulty: 2, yield: 2, price: 2, strength: 5 } },
};
export const CROP_ORDER = ['robusta', 'arabica', 'liberica'];
// Perennial trees: an old tree (harvests ≥ life) gives oldYield of its beans. Cutting it back (cưa đốn) costs
// pruneCost × the sapling price and the tree re-grows for pruneGrow × its first-crop time, then is young again.
export const PERENNIAL = { oldYield: 0.5, pruneCost: 0.6, pruneGrow: 0.6 };
// Garden layers (docs/design/farm-ui-bigupdate.md §6, coffee agroforestry): the country's way of growing coffee.
// forest = garden-forest under tall native shade trees (Ethiopia & East/West Africa), shade = banana / shade trees between
// rows (Vietnam, India, Indonesia… the default), sun = open sun plantation (Brazil). Real-world trade-off: shade slows the
// cherries (denser beans, better cup, ripe cherries keep longer on the tree) but each tree bears a little less; full sun
// ripens fast and bears more, with a narrower window before the cherries spoil.
//  timeMul × grow time · yieldMul × beans · freshMul × the 3★ "fresh" pick window · quality = chance of +1★ per harvest.
export const GARDEN = {
  forest: { timeMul: 1.2, yieldMul: 0.9, freshMul: 1.5, quality: 0.35 },
  shade: { timeMul: 1.08, yieldMul: 1, freshMul: 1.2, quality: 0.15 },
  sun: { timeMul: 0.9, yieldMul: 1.15, freshMul: 0.8, quality: 0 },
};
export const GARDEN_FOREST = ['et', 'ke', 'ug', 'tz', 'rw', 'bi', 'ci', 'za'];
export const GARDEN_SUN = ['br'];
/** Garden style of a country id ('forest' | 'shade' | 'sun'). */
export const gardenStyleOf = countryId => (GARDEN_FOREST.includes(countryId) ? 'forest' : GARDEN_SUN.includes(countryId) ? 'sun' : 'shade');
// Growing zones (vùng trồng) of a lot, by altitude: the farm climbs north (layout CLIMATE_OF). Effects per crop and zone:
// timeMul × grow time, stars ± on the harvest (1..3). No zone forbids a crop (no softlock).
// Tiers (founder table): 1 hot plain → Liberica, Robusta · 2 low hills → Robusta · 3 terraced slope → Arabica or Robusta ·
// 4 cool shaded plateau → Arabica.
export const CLIMATE_ORDER = ['lowland', 'upland', 'slope', 'highland'];
export const CLIMATE_EFFECT = {
  arabica: { lowland: { timeMul: 1.35, stars: -1 }, upland: { timeMul: 1.15 }, highland: { timeMul: .9, stars: 1 } },
  robusta: { upland: { timeMul: .9 }, highland: { timeMul: 1.3, stars: -1 } },
  liberica: { lowland: { timeMul: .9, stars: 1 }, slope: { timeMul: 1.2 }, highland: { timeMul: 1.4, stars: -1 } },
};
// How the manager / robots / autoplay pick a crop per field (derive.bestCropFor): an XP point is worth `xpCoins` coins,
// and a player farming alone does about `soloJobsPerMin` farm jobs a minute (walk + tap).
export const CLIMATE_PICK = { xpCoins: 6, soloJobsPerMin: 30, switchMul: 1.5 };

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
// Footprints follow each model's real aspect (2026-11-08): dryer rack 3 × 1 m, wet mill 4 × 2 m, sheds / barn 3 × 2.5 m.
// (older note) Farm workshops and barns are 3 × 3 m like a field: ONE cleared field = ONE building slot (explicit conversion works
// with a single tap), and an 8 × 8 m yard still holds four of them.
export const CELL = 2;
export const BUILDINGS = {
  // Trees, plants and flowers (shadeTree, cordia, enset, flowers, plant) are walkable: people and robots pass straight through them (founder 2026-11-09).
  // The ONE storage building (founder 2026-11-08): nothing is given at the start; build as many Storehouses as you like,
  // each adds its capacity (on top of STORAGE_BASE), upgrade or remove them (50 % back).
  silo: { id: 'silo', zone: 'farm', use: 'building', category: 'storage', limit: 99, costGrowth: 1.35, refund: 0.5, size: [1.9, 1.6], cost: 100, round: 1, level: 1,
    upgrade: [60, 220, 600, 1400, 3000, 6000, 12000], model: 'gedeo/coffee-warehouse-lod0.glb', icon: '🏚️',
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
  dryer: { id: 'dryer', zone: 'farm', use: 'building', category: 'processing', recipe: 'dry', limit: [[1, 1], [4, 2], [7, 3], [12, 4], [18, 5]], costGrowth: 1.6, refund: 0.5,
    size: [1.5, .5], cost: 120, round: 1, level: 1,
    upgrade: [200, 500, 1100, 2400, 4800, 9600, 19200], model: 'gedeo/drying-bed-lod0.glb', icon: '🟫',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  roastery: { id: 'roastery', retired: true, zone: 'farm', use: 'building', category: 'processing', recipe: 'roast', limit: [[4, 1], [6, 2], [9, 3], [14, 4]], costGrowth: 1.6, refund: 0.5,
    size: [1.5, 1.5], cost: 300, round: 1, level: 4,
    upgrade: [400, 900, 2000, 4000, 8000, 16000, 30000], model: 'gedeo/roastery-shed.glb', icon: '🔥',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  packer: { id: 'packer', retired: true, zone: 'farm', use: 'building', category: 'processing', recipe: 'pack', limit: [[6, 1], [9, 2], [16, 3]], costGrowth: 1.7, refund: 0.5,
    size: [1.5, 1.25], cost: 700, round: 1, level: 6,
    upgrade: [800, 1800, 3600, 7000, 13000, 24000, 40000], model: 'gedeo/packing-shed.glb', icon: '🛍️',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  // Wet mill (sơ chế ướt, docs/design/gedeo-full-chain.md §2): pulp → ferment → wash. The other way to make parchment
  // next to the drying yard (natural process): faster, costs water + fuel per batch, and washed specialty lots pay a
  // bigger premium per dearer bean (washed Yirgacheffe / Sidamo is what buyers pay most for).
  wetMill: { id: 'wetMill', zone: 'farm', use: 'building', category: 'processing', recipe: 'wash', limit: [[1, 1], [6, 2], [10, 3]], costGrowth: 1.6, refund: 0.5,
    size: [2, 1], cost: 220, round: 1, level: 1,
    upgrade: [300, 700, 1500, 3200, 6400, 12800, 25600], model: 'gedeo/wet-mill.glb', icon: '🌊',
    effect: { speed: [1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2], batch: [1, 1, 2, 2, 3, 3, 4, 4] } },
  // Farm machines (docs/design/farm-crew.md §3): bought and placed, each makes one trade's work faster and costs a small
  // running fee. Drip line / pulper work by reach (radius); a hauler uses the one vehicle that carries the most.
  dripLine: { id: 'dripLine', zone: 'farm', use: 'building', category: 'processing', limit: 6, costGrowth: 1.5, refund: 0.5,
    size: [3, 1], cost: 180, round: 1, level: 1, trueScale: 1, upgrade: [120, 300, 700, 1500], model: 'gedeo/drip-line.glb', icon: '🚿', xp: 5, effect: { radius: [12, 14, 16, 18, 20], fee: 1 } },
  pulper: { id: 'pulper', zone: 'farm', use: 'building', category: 'processing', limit: 2, costGrowth: 1.5, refund: 0.5,
    size: [1.4, 1.4], cost: 350, round: 1, level: 1, trueScale: 1, upgrade: [250, 600, 1300, 2800], model: 'gedeo/pulper-machine.glb', icon: '⚙️', xp: 5, effect: { timeCut: [0.3, 0.35, 0.4, 0.45, 0.5], radius: [12, 12, 14, 14, 16], fee: 1 } },
  motorbike: { id: 'motorbike', zone: 'farm', use: 'building', category: 'processing', limit: 1, costGrowth: 1.5, refund: 0.5,
    size: [1.8, .8], cost: 120, round: 1, level: 1, trueScale: 1, upgrade: [100, 250, 600, 1200], model: 'gedeo/motorbike-sacks.glb', icon: '🛵', xp: 5, effect: { load: [6, 8, 10, 12, 14], tripFee: 1 } },
  tillerCart: { id: 'tillerCart', zone: 'farm', use: 'building', category: 'processing', limit: 1, costGrowth: 1.5, refund: 0.5,
    size: [3.4, 1.5], cost: 450, round: 1, level: 1, trueScale: 1, upgrade: [350, 800, 1800, 3600], model: 'gedeo/power-tiller-cart.glb', icon: '🚜', xp: 5, effect: { load: [14, 18, 22, 26, 30], tripFee: 2 } },
  farmTruck: { id: 'farmTruck', zone: 'farm', use: 'building', category: 'processing', limit: 1, costGrowth: 1.5, refund: 0.5,
    size: [2.2, 5], cost: 1500, round: 1, level: 1, trueScale: 1, upgrade: [1000, 2200, 4500, 9000], model: 'gedeo/farm-truck.glb', icon: '🚚', xp: 5, effect: { load: [30, 38, 46, 54, 64], tripFee: 6 } },
  // Extra storage: every barn adds its capacity to the storehouse's (sum, not max).
  // Retired 2026-11-08: same job and model as the Storehouse (silo) — one storage building now. Old saves keep theirs.
  warehouse: { id: 'warehouse', retired: true, zone: 'farm', use: 'building', category: 'storage', limit: [[3, 1], [5, 2], [7, 3], [9, 4], [13, 6]], costGrowth: 1.5, refund: 0.5,
    size: [1.9, 1.6], cost: 150, round: 1, level: 3,
    upgrade: [150, 350, 800, 1600, 3200, 6400, 12000], model: 'gedeo/coffee-warehouse-lod0.glb', icon: '🏚️',
    effect: { capacity: [30, 45, 65, 90, 120, 160, 210, 270] } },
  // Infrastructure: fields whose centre is within `radius` m grow `grow` faster. Coverage, not stacking: a field gets
  // the best well in reach, so a 2nd well only helps fields the 1st one does not reach.
  well: { id: 'well', zone: 'farm', use: 'building', category: 'infrastructure', limit: [[1, 1], [5, 2], [7, 3], [9, 4]], costGrowth: 1.5, refund: 0.5,
    size: [1, 1], cost: 200, round: 1, level: 1,
    upgrade: [250, 600, 1400, 3000, 6000, 12000, 24000], model: 'gedeo/water-tank-lod0.glb', icon: '💧',
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
  flowers: { id: 'flowers', walkable: true, zone: 'any', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 25, round: 1, level: 2, decor: true, trueScale: 1.1, upgrade: [], model: 'gedeo/daisy-clump.glb', icon: '🌼', xp: 3 },
  lamp: { id: 'lamp', zone: 'any', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 40, round: 1, level: 3, decor: true, trueScale: 1, upgrade: [], model: 'gedeo/lamp-post.glb', icon: '🏮', xp: 4 },
  plant: { id: 'plant', walkable: true, zone: 'any', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 30, round: 1, level: 2, decor: true, upgrade: [], model: 'cafe/plant.glb#cafe_plant', icon: '🪴', xp: 3 },
  // Shade tree (cây che bóng, Albizia schimperiana): metres × trueScale (≈ 8 m, game-camera size), not shrunk to its 2 m footprint. Arabica fields
  // whose centre is within effect.radius m ripen +effect.stars★ (shade-grown arabica: slower ripening, denser beans).
  shadeTree: { id: 'shadeTree', walkable: true, zone: 'farm', use: 'decor', category: 'infrastructure', limit: [[2, 2], [4, 4], [6, 6], [9, 9]], costGrowth: 1.25, refund: 0.5,
    size: [1, 1], cost: 90, round: 1, level: 2, decor: true, trueScale: .55, upgrade: [], model: 'gedeo/albizia-schimperiana-lod1.glb', icon: '🌳', xp: 4,
    effect: { radius: 7, stars: 1, crops: ['arabica'] } },
  // The tier signboard as a placeable stand-in: only used to drag a signboard to a new spot (never built, never in a menu)
  tierSign: { id: 'tierSign', retired: true, zone: 'farm', use: 'decor', category: 'decoration', limit: 0, size: [1, 1], cost: 0, round: 1, level: 1, decor: true, trueScale: 1.6, upgrade: [], model: 'gedeo/tier-sign.glb', icon: '🪧', xp: 0 },
  // Cordia africana — the round, white-flowering native shade tree of the Gedeo coffee gardens. Real size (~7 m crown).
  cordia: { id: 'cordia', walkable: true, zone: 'farm', use: 'decor', category: 'infrastructure', limit: 99, costGrowth: 1.2, refund: 0.5,
    size: [1, 1], cost: 110, round: 1, level: 1, decor: true, trueScale: .5, upgrade: [], model: 'gedeo/cordia-africana-lod1.glb', icon: '🌳', xp: 4,
    effect: { radius: 6, stars: 1, crops: ['arabica'] } },
  // Livestock (chăn nuôi): the animals of a Gedeo homestead, real-size models. Placeable anywhere on owned farm land, like any decor.
  barn: { id: 'barn', zone: 'farm', use: 'decor', category: 'livestock', limit: 6, costGrowth: 1.15, refund: 0.5, size: [2, 2], cost: 180, round: 1, level: 1, trueScale: 0.55, upgrade: [200, 450, 900, 1800], model: 'gedeo/worker-shelter-lod0.glb', icon: '🛖', xp: 6, effect: { housing: [8, 10, 12, 15, 18] } },
  chickenCoop: { id: 'chickenCoop', zone: 'farm', use: 'decor', category: 'livestock', limit: 12, costGrowth: 1.15, refund: 0.5, size: [.6, .6], cost: 60, round: 1, level: 1, animal: true, trueScale: 2.2, upgrade: [40, 90, 180, 360], model: 'gedeo/chicken.glb', icon: '🐔', xp: 3, effect: { size: [1, 1.1, 1.2, 1.3, 1.4] } },
  rooster: { id: 'rooster', zone: 'farm', use: 'decor', category: 'livestock', limit: 12, costGrowth: 1.15, refund: 0.5, size: [.6, .6], cost: 70, round: 1, level: 1, animal: true, trueScale: 2, upgrade: [40, 90, 180, 360], model: 'gedeo/chicken-rooster.glb', icon: '🐓', xp: 3, effect: { size: [1, 1.1, 1.2, 1.3, 1.4] } },
  cow: { id: 'cow', zone: 'farm', use: 'decor', category: 'livestock', limit: 8, costGrowth: 1.15, refund: 0.5, size: [1.2, 1.2], cost: 240, round: 1, level: 1, animal: true, trueScale: 1.4, upgrade: [180, 400, 800, 1600], model: 'gedeo/cow.glb', icon: '🐄', xp: 6, effect: { size: [1, 1.1, 1.2, 1.3, 1.4] } },
  goat: { id: 'goat', zone: 'farm', use: 'decor', category: 'livestock', limit: 10, costGrowth: 1.15, refund: 0.5, size: [.9, .9], cost: 150, round: 1, level: 1, animal: true, trueScale: 1.8, upgrade: [100, 220, 450, 900], model: 'gedeo/goat.glb', icon: '🐐', xp: 5, effect: { size: [1, 1.1, 1.2, 1.3, 1.4] } },
  farmDog: { id: 'farmDog', zone: 'farm', use: 'decor', category: 'livestock', limit: 3, costGrowth: 1.15, refund: 0.5, size: [.8, .8], cost: 90, round: 1, level: 1, animal: true, trueScale: 1.8, upgrade: [70, 160, 320, 640], model: 'gedeo/dog.glb', icon: '🐕', xp: 3, effect: { size: [1, 1.1, 1.2, 1.3, 1.4] } },
  // Enset (chuối giả) — the Gedeo companion plant of coffee gardens. Decor, real size.
  enset: { id: 'enset', walkable: true, zone: 'farm', use: 'decor', category: 'decoration', limit: 12, refund: 0.5, size: [1, 1], cost: 35, round: 1, level: 2, decor: true, trueScale: .6,
    upgrade: [], model: 'gedeo/ensete-ventricosum-lod1.glb', icon: '🌴', xp: 3 },
};
// Crop field (one bed): a placeable like a building, saved in region.fields (crop state stays in region.plots by id).
// Every owned field lot (kind 'farm') comes with 6 fields and adds 6 to the free allowance; extra fields cost
// fieldExtraCost(k) (k = extras already placed) up to fieldExtraCap(level) extras. Removing refunds `refund` × the
// last extra's price (0 inside the allowance: you can put it back for free). 3 × 3 m footprint, bed mesh 2.4 m.
// Fields (balance 2026-11-09): a tilled row (fieldAllowance) is free; a bed beyond them is new ground to clear and costs
// extraBase × extraGrowth^k (k = extras already placed): 20, 20, 25 … 45 at the 11th, 95 at the 21st, then at most 300 — every level-up tills 6 more free rows.
export const FIELD = { id: 'field', zone: 'farm', use: 'field', category: 'farming', size: [.5, .5], cost: 0, round: 1, level: 1,
  upgrade: [], icon: '🟫', xp: 2, refund: 0.5, extraBase: 20, extraGrowth: 1.08, extraMaxCost: 300, extraPerLevel: 2, extraMax: 40 };
export const fieldExtraCost = k => Math.min(FIELD.extraMaxCost, Math.round(FIELD.extraBase * FIELD.extraGrowth ** Math.max(0, k | 0) / 5) * 5); // clearing one bed never costs more than extraMaxCost
export const fieldExtraCap = level => Math.min(FIELD.extraMax, FIELD.extraPerLevel * Math.max(1, level | 0));
// Catalogue tabs per screen (HUD construction catalogue) and the build menu per screen.
export const CATEGORY_ORDER = { farm: ['farming', 'processing', 'storage', 'infrastructure', 'decoration'], cafe: ['cafe', 'decoration'] };
export const STORAGE_BASE = 30; // room on the bare ground before any Storehouse is built
/** Animals are not built from the menu: tap a barn → buy them there (they roam around the barn). Each barn houses ANIMALS_PER_BARN. */
export const BARN_ANIMALS = ['chickenCoop', 'rooster', 'goat', 'cow', 'farmDog'];
export const ANIMALS_PER_BARN = 8;
export const BUILD_MENU_FARM = ['wetMill', 'dryer', 'pulper', 'dripLine', 'motorbike', 'tillerCart', 'farmTruck', 'silo', 'well', 'shadeTree', 'cordia', 'enset', 'flowers', 'plant', 'lamp', 'barn'];
export const BUILD_MENU_CAFE = ['roaster', 'tables', 'kiosk', 'pastry', 'flowers', 'plant', 'lamp'];
export const BUILD_MENU = [...new Set([...BUILD_MENU_CAFE, ...BUILD_MENU_FARM])];

// Staff: 2 worker types + 2 robot types, assigned to a zone of the current region (docs/design/staff-manager.md).
// Hiring cap: a zone's team is at most STAFF_CAP.perZone (derive hireCap, err hireLimit), every hire gets a working slot,
// counted per game zone (farm / shop), so every hire works. The bench is for resting units (and costs upkeep).
// Workers open at Lv1; robots at Lv4 (dearer, no phone breaks: a later milestone to wait for).
// Founder 2026-11-08: no limit by level, money decides. STAFF_CAP.perZone is only the ceiling a phone can draw.
export const hireLimit = () => STAFF_CAP.perZone; // = working slots per zone (name kept for older imports)
// robotShare (docs/design/management-rules.md §2.1): robots in a zone ≤ ceil(slots × robotShare), so a robot never
// displaces the last worker. There is no bench overflow (team per zone = level, founder rule 2026-11-07, §8 Q7).
export const STAFF_CAP = { perZone: 30, robotShare: 0.5 };
/** Most robots a zone may hold at this hire cap (management-rules §2.1: ceil(slots / 2)). */
export const robotCap = slots => Math.ceil(Math.max(0, slots | 0) * STAFF_CAP.robotShare);
export const STAFF = {
  // Farm crew (docs/design/farm-crew.md): one trade per Gedeo asset. jobs = the only job types a worker takes; looks = model per gender.
  picker: { id: 'picker', kind: 'worker', zone: 'farm', cost: 150, level: 1, round: 1, icon: '🧺', jobs: ['harvest'], looks: { female: 'worker-picker-f', male: 'worker-picker-m' }, effect: { growSpeed: 0.15 }, model: null },
  planter: { id: 'planter', kind: 'worker', zone: 'farm', cost: 130, level: 1, round: 1, icon: '🌱', jobs: ['plant', 'openField'], looks: { female: 'worker-planter-f' }, effect: { growSpeed: 0.15 }, model: null },
  waterer: { id: 'waterer', kind: 'worker', zone: 'farm', cost: 120, level: 1, round: 1, icon: '💧', jobs: ['water'], looks: { male: 'worker-waterer-m' }, effect: { growSpeed: 0.15 }, model: null },
  processor: { id: 'processor', kind: 'worker', zone: 'farm', cost: 170, level: 1, round: 1, icon: '🫘', jobs: ['process'], looks: { female: 'worker-processor-f' }, effect: { growSpeed: 0.05 }, model: null },
  hauler: { id: 'hauler', kind: 'worker', zone: 'farm', cost: 140, level: 1, round: 1, icon: '📦', jobs: ['haul'], looks: { male: 'worker-hauler-m' }, effect: { growSpeed: 0.05 }, model: null },
  pruner: { id: 'pruner', kind: 'worker', zone: 'farm', cost: 160, level: 1, round: 1, icon: '✂️', jobs: ['prune'], looks: { male: 'worker-pruner-m' }, effect: { growSpeed: 0.1 }, model: null },
  barista: { id: 'barista', kind: 'worker', zone: 'shop', cost: 200, level: 1, round: 1, icon: '🧑‍🍳', effect: { brewSpeed: 0.25 }, model: 'cafe/staff.glb' },
  surveyor: { id: 'surveyor', kind: 'worker', zone: 'farm', cost: 200, level: 1, round: 1, icon: '🗺️', jobs: ['expand'], looks: { male: 'worker-supervisor-m' }, effect: { growSpeed: 0.05 }, model: null },
  builder: { id: 'builder', kind: 'worker', zone: 'farm', cost: 180, level: 1, round: 1, icon: '🔨', jobs: ['build'], looks: { male: 'worker-pruner-m', female: 'worker-processor-f' }, effect: { growSpeed: 0.05 }, model: null },
  herder: { id: 'herder', kind: 'worker', zone: 'farm', cost: 160, level: 1, round: 1, icon: '🐄', jobs: ['livestock'], looks: { female: 'villager-elder-f', male: 'villager-elder-m' }, effect: { growSpeed: 0.05 }, model: null },
  harvestBot: { id: 'harvestBot', kind: 'robot', zone: 'farm', cost: 1200, level: 1, round: 1, icon: '🤖', file: 'robot-harvest', effect: { yieldBonus: 0.25 }, model: null },
  plantBot: { id: 'plantBot', kind: 'robot', zone: 'farm', cost: 1200, level: 1, round: 1, icon: '🤖', file: 'robot-plant', effect: { yieldBonus: 0.25 }, model: null },
  waterBot: { id: 'waterBot', kind: 'robot', zone: 'farm', cost: 1000, level: 1, round: 1, icon: '🤖', file: 'robot-water', effect: { growSpeed: 0.2 }, model: null },
  haulBot: { id: 'haulBot', kind: 'robot', zone: 'farm', cost: 1400, level: 1, round: 1, icon: '🤖', file: 'robot-haul', effect: { yieldBonus: 0.05 }, model: null },
  pruneBot: { id: 'pruneBot', kind: 'robot', zone: 'farm', cost: 1300, level: 1, round: 1, icon: '🤖', file: 'robot-prune', effect: { yieldBonus: 0.1 }, model: null },
  droneBot: { id: 'droneBot', kind: 'robot', zone: 'farm', cost: 1600, level: 1, round: 1, icon: '🛸', file: 'robot-drone', effect: { yieldBonus: 0.15 }, model: null },
  brewBot: { id: 'brewBot', kind: 'robot', zone: 'shop', cost: 1500, level: 1, round: 1, icon: '🦾', effect: { priceBonus: 0.15 }, model: null },
};
export const STAFF_ORDER = ['picker', 'planter', 'waterer', 'processor', 'hauler', 'pruner', 'surveyor', 'builder', 'herder', 'barista', 'harvestBot', 'plantBot', 'waterBot', 'haulBot', 'pruneBot', 'droneBot', 'brewBot'];
// Crew numbers (farm-crew.md §6). The four worker stats mean the same in every trade:
//  speed: work + walk faster (LEVEL_STEP) · stamina: energy + what one trip carries (perStamina)
//  accuracy: the trade's quality (mistakes, or accuracy.*) · smart: the trade's habits (rules, levels in SMART_RULES)
// A robot has no stats: motor = speed, battery = what one trip carries (perBattery), frame = fewer jams.
// haulChainM: a hauler with room left picks up another pile this close before walking to the storehouse.
export const CREW = {
  trimBeans: 1, sprayBeans: 1, sprayFee: 1, haulBase: 6, haulChainM: 8, robotBucket: 8,
  // A trade starts weak: speed by stat step 1..5, a farm robot's speed by motor tier 0..3, its jams × robotJamMul.
  speedCurve: [0.65, 0.73, 0.82, 0.91, 1, 1.09, 1.18, 1.27, 1.36, 1.45], robotSpeed: [0.7, 0.82, 0.94, 1.06, 1.18, 1.3, 1.42, 1.54, 1.66, 1.8], robotJamMul: 3,
  robotCooler: [1, 0.85, 0.7, 0.58, 0.46, 0.36, 0.26, 0.16, 0.08, 0],
  perStamina: { haul: 2, water: 1 }, perBattery: { haul: 2, water: 2 },
  accuracy: { waterStep: 0.03, premiumStep: 0.05, trimTwoFrom: 4 },
  rules: { picker: ['ripeFirst', 'quick', 'twoPlots'], planter: ['playerCrop', 'quick'], waterer: ['driestFirst', 'quick'], processor: ['quick'], hauler: ['biggestFirst', 'chainPiles', 'quick'], pruner: ['quick'] },
};
/** Save migration: the trade of a retired unit. n = how many farmhands came before it (they alternate picker / planter). */
export function crewTypeOf(u, n = 0) {
  if (u.type === 'sproutBot') return u.task === 'plant' ? 'plantBot' : 'harvestBot';
  if (u.type !== 'farmhand') return u.type;
  const task = Array.isArray(u.tasks) ? u.tasks[0] : null;
  return task === 'water' ? 'waterer' : task === 'plant' ? 'planter' : task === 'harvest' ? 'picker' : n % 2 ? 'planter' : 'picker';
}
// Bench upkeep (§2): only benched WORKERS cost coins (working staff and robots are free). Charged by staff/upkeep for
// the time since the last charge (at most maxCatchUpMinutes: no offline bill). Unpaid → the worker's morale drops.
// robotStandbyRatio (management-rules §2.2): a robot NOT on shift (benched / unassigned) costs that share of its price
// per perMinutes, so a robot parked forever is no longer free. A robot on shift costs nothing here.
export const UPKEEP = { benchRatio: 0.1, robotStandbyRatio: 0.03, perMinutes: 10, unpaidMorale: 10, maxCatchUpMinutes: 10 };
// "Đổi ca" (staff/swapShift): who goes to the bench and who is rested enough to come back.
export const SHIFT = { tiredBelow: 40, restedFrom: 70 };
// Worker vitals (§3): ≈ 10 min of work from full energy to empty, ≈ 8 min of work to hungry. Values 0..100 (energy
// max grows with stamina). `start` = a new hire. hungryMul / tiredMul = the realm's speed while hungry / tired.
export const VITALS = { energyDrainPerMin: 10, energyRestPerMin: 20, benchRestMul: 2, hungerPerMin: 12.5, moraleOverworkPerMin: 3,
  funnyMoraleRegenPerMin: 2, tiredBelow: 25, hungryBelow: 20, sulkBelow: 20, staminaEnergyStep: 20, staminaHungerFrom: 4,
  staminaHungerMul: 0.5, maxBatchSeconds: 120, hungryMul: 0.7, tiredMul: 0.6, start: { energy: 100, fullness: 100, morale: 80 },
  warnBelow: 50 }; // warnBelow: the HUD bars (energy, fullness) turn amber under it
// Care actions (§3, staff/care): coin prices and effects. serviceRatio × the robot's price restores its wear.
export const CARE = { nagChance: 0.6, nagMorale: 5, coffee: 20, coffeeEnergy: 60, food: 15, lunchSeconds: 60, bonus: 50, bonusMorale: 40,
  cool: 10, repair: 20, serviceRatio: 0.1 };
// Recruitment (docs/design/staff-robot-gameplay.md §6): each game has its own board of 3 applicants for its worker
// trade (farm: RECRUIT.trades, café: barista). Robots stay a fixed catalogue (staff/hire). The board refreshes for free every
// refreshMinutes, right after a hire, or at once for refreshCost coins. A trait changes the hire price, how often the
// worker slacks (STAFF_BREAKS), its starting / capped stats (§5) and the funny one adds a small bonus where they work.
export const RECRUIT = { size: 3, refreshMinutes: 10, refreshCost: 20, worker: { farm: 'picker', shop: 'barista' },
  // trades: most needed first (nothing grows without a planter); worker = a zone's stand-in type (price checks)
  trades: { farm: ['planter', 'picker', 'waterer', 'processor', 'hauler', 'pruner', 'builder', 'surveyor', 'herder'], shop: ['barista'] } };
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
// trades: the trades that can apply now, most needed first (D.applicants); the first applicant always has the first one.
export function applicantsFor(zone, seed, trades = RECRUIT.trades[zone]) {
  if (!RECRUIT.worker[zone] || !trades?.length) return [];
  const r = rng(seed | 0);
  const traits = [...TRAIT_ORDER].sort(() => r() - .5);
  const names = [...RECRUIT_NAMES];
  const jobs = trades.length > 1 ? [trades[0], ...trades.slice(1).sort(() => r() - .5)] : trades;
  const out = [];
  for (let i = 0; i < RECRUIT.size; i++) {
    const trait = traits[i % traits.length], type = jobs[i % jobs.length], looks = STAFF[type].looks;
    const name = names.splice(Math.floor(r() * names.length), 1)[0];
    const drawn = r() < .5 ? 'male' : 'female', gender = !looks || looks[drawn] ? drawn : Object.keys(looks)[0]; // a trade with one model keeps its model's gender
    out.push({ type, trait, name, gender, intro: 1 + Math.floor(r() * RECRUIT_INTROS),
      cost: Math.round(STAFF[type].cost * TRAITS[trait].costMul / 5) * 5 });
  }
  // Rarity is drawn AFTER the board above, so a seed keeps the same names / traits it always had.
  for (const a of out) {
    if (r() < RARE.chance) { a.perk = RARE.perks[Math.floor(r() * RARE.perks.length)]; a.cost = Math.round(a.cost * RARE.costMul / 5) * 5; }
    a.stats = startStats(a.trait, a.perk);
  }
  // Profile (age, hometown) is drawn last, so a seed keeps the board it always had.
  for (const a of out) Object.assign(a, profileFrom(r));
  return out;
}
// Personnel file (docs/design/staff-profile.md): who a worker is, per-day numbers, a personal timeline and a grade.
//  daysKeep: per-unit day rows kept (u.days); logKeep: per-unit timeline rows (u.log);
//  grade: score 0..100 against the zone's team average of the same day (par = the team average's score per part);
//  mistakeScale: quality score = 100 − mistakes / jobs × mistakeScale; minShiftSeconds: less time on shift = no grade.
export const PROFILE = {
  daysKeep: 7, logKeep: 20, teamDaysKeep: 30, age: [18, 45],
  homes: ['Buôn Ma Thuột', 'Đà Lạt', 'Bảo Lộc', 'Di Linh', 'Pleiku', 'Kon Tum', 'Gia Nghĩa', 'Đắk Mil', 'Cầu Đất', 'Khe Sanh', 'Sơn La', 'Điện Biên'],
  serial: { harvestBot: 'HB', plantBot: 'PB', waterBot: 'WB', haulBot: 'LB', pruneBot: 'TB', droneBot: 'DB', brewBot: 'BB' },
  model: { harvestBot: 'HarvestBot H-1', plantBot: 'SeedBot P-1', waterBot: 'RainBot W-1', haulBot: 'CargoBot L-1', pruneBot: 'TrimBot T-1', droneBot: 'SkyDrone D-1', brewBot: 'BrewBot B-1' }, // model line on a robot's ID card (robots stay "Robot" by name)
  grade: {
    weights: { worker: { prod: 0.3, qual: 0.25, att: 0.25, profit: 0.2 }, robot: { prod: 0.4, att: 0.4, profit: 0.2 } },
    par: 70, mistakeScale: 500, minShiftSeconds: 60,
    cuts: [['A', 85], ['B+', 78], ['B', 70], ['C', 50], ['D', 0]],
  },
};
// Career (docs/design/staff-profile.md step 3): a worker's rank. "staff" comes by level alone; the others need level +
// tenure + the player's "Thăng chức" tap. Tenure is counted in SHIFT-DAYS of played time (management-rules §2.5, §8 Q5):
// 1 shift-day (sd) = shiftDayMin played minutes on the team (u.tenurePlayedMin, advanced by clock/tick). lead / manager: one each per game zone, paid an allowance
// (coins per UPKEEP.perMinutes while on shift, charged by staff/upkeep as category 'wage'). A worker who could be
// workers regain morale and a phone slacker goes back after nudgeSeconds; a manager also buys coffee / food
// (from your coins) for tired / hungry workers.
export const CAREER = { shiftDayMin: 5 }; // played minutes in one shift-day (the manager's training time). Workers have no ranks: their stats are what counts.
// Craft skills (step 3): each job type a worker does grows its own skill by practice (count of that job). Steps at
// `steps` jobs: Mới → Quen → Thạo → Chuyên gia. Each step: that job speedPerStep faster, its mistakes × (1 − mistakeCutPerStep).
export const CRAFT = {
  tasks: { farm: ['harvest', 'plant', 'water', 'process', 'haul', 'prune', 'openField', 'expand', 'build', 'livestock'], shop: ['order', 'brew', 'deliver'] },
  steps: [50, 200, 600], speedPerStep: 0.05, mistakeCutPerStep: 0.25,
  mistakeTask: { drop: 'haul', unripe: 'harvest', crooked: 'plant', spill: 'deliver', wrongTable: 'deliver' },
};
/** Craft step 0..3 of a worker for a job type. */
export const craftLevel = (u, task) => { const n = u?.craft?.[task] || 0; return CRAFT.steps.filter(x => n >= x).length; };
/** Speed factor of a job from its craft step (robots / unknown jobs: 1). */
export const craftSpeed = (u, task) => (STAFF[u?.type]?.kind === 'worker' ? 1 + CRAFT.speedPerStep * craftLevel(u, task) : 1);
// Worker gear (step 4): bought with coins, goes with the person (half back when they leave). Tier 0..3; buying tier n+1
// costs cost[n]. Farm: boots (walk faster), hat (energy drains slower), shears (fewer unripe picks), watering can
// (tending waters more plots). Café: shoes (walk), apron (energy), tray (fewer spills), kettle (brews faster).
// Prices sit next to stat upgrades (100–400 + points): a tier is a smaller, surer step.
export const GEAR = {
  zone: { farm: ['boots', 'hat', 'shears', 'can'], shop: ['shoes', 'apron', 'tray', 'kettle'] },
  cost: [80, 160, 320], maxTier: 3, refund: 0.5, stockKeep: 24, // stockKeep: gear left behind by fired workers, kept in the store
  items: {
    boots: { icon: '👢', walk: [1, 1.05, 1.1, 1.15] },
    hat: { icon: '👒', drain: [1, 0.85, 0.72, 0.6] },
    shears: { icon: '✂️', unripe: [1, 0.8, 0.65, 0.5] },
    can: { icon: '🪣', plots: [0, 1, 2, 3] },
    shoes: { icon: '👟', walk: [1, 1.05, 1.1, 1.15] },
    apron: { icon: '🎽', drain: [1, 0.85, 0.72, 0.6] },
    tray: { icon: '🍽️', spill: [1, 0.8, 0.65, 0.5] },
    kettle: { icon: '🫖', brew: [1, 1.08, 1.16, 1.25] },
  },
};
export const gearTier = (u, item) => Math.max(0, Math.min(GEAR.maxTier, u?.gear?.[item] | 0));
/** Walk speed factor from boots / shoes (robots / none: 1). */
export const gearWalk = u => GEAR.items.boots.walk[gearTier(u, 'boots')] * GEAR.items.shoes.walk[gearTier(u, 'shoes')];
/** Energy drain factor from the straw hat / apron. */
export const gearDrain = u => GEAR.items.hat.drain[gearTier(u, 'hat')] * GEAR.items.apron.drain[gearTier(u, 'apron')];
/** Speed factor of one job type from gear (kettle: brewing). */
export const gearJob = (u, task) => (task === 'brew' ? GEAR.items.kettle.brew[gearTier(u, 'kettle')] : 1);
// Robots (step 4): warranty = the first `repairs` jam repairs are free; resale = (resale × price + parts + software) ×
// wear / 100; software packs are bought (a robot still never learns and keeps its one task): autoCharge pays the
// recharge by itself when the battery is empty, autoUnjam knocks itself free after `seconds`.
export const WARRANTY = { repairs: 3 };
// precision (management-rules §2.5): from player level `level`, the robot's work is 2★ (QUALITY) — robots are no
// longer strictly worse late in the game.
export const SOFTWARE = {
  order: ['autoCharge', 'autoUnjam', 'precision'], refund: 0.5,
  packs: { autoCharge: { icon: '🔌', ratio: 1 / 3 }, autoUnjam: { icon: '🧩', ratio: 1 / 4, seconds: 10 }, precision: { icon: '🎯', ratio: 1 / 3, stars: 2 } },
};
export const softwarePrice = (u, pack) => Math.round((STAFF[u?.type]?.cost || 0) * (SOFTWARE.packs[pack]?.ratio || 0) / 10) * 10;
export const hasSoftware = (u, pack) => Array.isArray(u?.software) && u.software.includes(pack);
// General manager (docs/design/general-manager.md): ONE person above every team (farm and café share the coins). Hired
// from a headhunter board; runs the team of the game on screen. Powers: advisor (suggests only), operator (does safe
// jobs, small costs within a 10-minute budget, asks you for big ones), full (does almost everything, costs double +
// a bigger profit share). Real-money purchases are never delegated. Poached GM → the team falls into chaos until you
// pay a calming meeting or hire a new GM (a Manager-rank worker halves the chaos).
export const GM = {
  unlockLevel: 1, // no level gate: hire the manager once you can pay
  board: { size: 3, refreshMinutes: 30, refreshCost: 100 },
  hireFeePerSkill: 250, // 400 → 250 (2026-11-08, sim: skill 2 at 800 ≈ 6 min of a delegate's Lv6 income, so the GM came at Lv8–9)
  salaryPerSkill: 20, payMinutes: 10, // base salary per payMinutes = salaryPerSkill × skill × mode.mul × (1 + raiseStep × raises)
  // share = part of the profit of the jobs the GM ITSELF ran (s.income rows by 'g1', management-rules §2.6); full mode
  // is paid through mul, not a bigger cut (§8 Q3).
  // One rule (founder 2026-11-08): he runs everything like you would; only alwaysApprove waits for your signature.
  modes: { full: { mul: 1, share: 0.05, budgetMul: 1 } },
  modeOrder: ['full'],
  budgets: [50, 100, 200, 500, 1000], bigLimits: [100, 300, 600, 1000, 3000],
  // Fallbacks; a new GM starts from limits computed from the reference income I(L) (limitDefaults, D.gmDefaultLimits):
  //  autoLimit = round(autoMul × I(L) / autoStep) × autoStep, bigLimit = round(bigMul × I(L) / bigStep) × bigStep,
  //  each snapped to the nearest listed option (ties snap down). highValueMul × I(L) = a sale that needs approval (P3).
  defaults: { mode: 'full', budget: 100, bigLimit: 300 },
  limitDefaults: { autoMul: 0.3, autoStep: 50, bigMul: 1, bigStep: 100, highValueMul: 20 },
  windowMinutes: 10,
  thinkSeconds: [8, 6, 5, 4, 3], // was [20, 15, 10, 7, 5] (founder 2026-11-08: the manager must react within a phone session)
  actionsPerThink: [1, 1, 2, 2, 3], // by skill 1..5
  // requestMinutes / requestsKeep / poach.keepSeconds: superseded by TASKS.life / TASKS.cap (requests and rival offers are
  // inbox tasks now; kept for older callers). logKeep: rows of the manager's log view (D.gmLog).
  requestMinutes: 5, requestsKeep: 6, logKeep: 30, daysKeep: 7,
  styles: {
    careful: { budgetMul: 0.5, loyalty: [75, 95] },
    balanced: { budgetMul: 1, loyalty: [55, 75] },
    bold: { budgetMul: 1, loyalty: [45, 60] },
  },
  styleOrder: ['careful', 'balanced', 'bold'],
  // unpaidPerMin: loyalty lost per minute of salary left unpaid (the shortfall becomes wage arrears, s.debt.wages.gm);
  // quitArrearsSalaries: arrears ≥ that many salaries → the GM quits (no chaos, re-hire at the board), §2.6 / §8 Q12.
  loyalty: { refuse: 70, paidPer10: 1, unpaidPerMin: 1, start: 60 },
  quitArrearsSalaries: 10,
  raiseStep: 0.2, raiseLoyalty: 25, keepBonusSalaries: 6, keepLoyalty: 15,
  // The manager's four numbers 1..10 (farm-crew.md §10). smart also grows by itself: +1 every smartEveryJobs jobs he does.
  stats: ['speed', 'smart', 'accuracy', 'stamina'], maxStat: 10, statCost: 300, smartEveryJobs: 40,
  // Investing (farm-crew.md §16): per windowMinutes he may spend budgetIncome of what the farm earned plus budgetBank of the bank;
  // an upgrade must pay back within upgradePaybackMin, a new tier within landPaybackMin (counted on landFields fields).
  growth: { budgetMin: 150, budgetIncome: 0.6, budgetBank: 0.03, upgradePaybackMin: 30, landPaybackMin: 120, landFields: 30, replaceEveryMin: 3 },
  poach: { everyMinutes: 45, chance: 0.25, keepSeconds: 180, rival: 'Bà Tư' },
  // Mood (founder feedback 2026-11-07): a manager wants to be used, and wants the boss around.
  //  idle: no job for idleGraceMin (you do everything yourself) → −idlePerMin loyalty / min;
  //  absent: no touch for absentGraceMin while the game runs → −absentPerMin / min and the rival comes twice as often
  //  (idle and absent never stack: the bigger one counts — an AFK player is the manager's whole point, so ~1 h AFK ≈ −40);
  //  away: the game closed longer than awayGraceHours → −awayPerHour per hour (≤ awayMax) when you return, and if that
  //  leaves it below the refuse line the rival is already there (poach starts at once).
  //  Jobs (+jobLoyalty each), your approvals (+approveLoyalty) and denials (denyLoyalty) move it too.
  mood: { idleGraceMin: 3, idlePerMin: 1, absentGraceMin: 20, absentPerMin: 1, absentPoachMul: 2, awayGraceHours: 2, awayPerHour: 10, awayMax: 40,
    jobLoyalty: 0.3, approveLoyalty: 2, denyLoyalty: -1, seenEverySeconds: 60 },
  // While the game is closed (idle / AFK play): a manager in operator / full keeps the team going. On return it pays
  // out `share` of the team's running profit rate (staff ledger, the last rateWindowMin minutes played) for the time
  // away beyond minMinutes, at most capMinutes, minus its base pay for that time. No manager or advisor: nothing.
  away: { minMinutes: 5, capMinutes: 120, rateWindowMin: 30, share: { full: 0.7 } },
  chaos: { slackMul: 2, moralePerMin: 1, managerHalves: 0.5, calmBase: 300, calmPerUnit: 50, calmMorale: 10 },
  // Thresholds of today's planner (D.gmPlan), moved out of the code (management-rules §7.1; the P3 planner turns them
  // into GM_RULES rows): storage share that means "sell", morale under which a nag becomes a small bonus, seconds
  // between two nags of a worker, ripe plots / waiting customers that ask for a hire, repeats today that ask for
  // software / a part, hours before a contract ends, and how much better a buyer / crop method must be (×).
  // Care wallet (management-rules §2.3): per careWallet.windowMin played minutes the manager may spend on care / ops
  // (coffee, food, bonuses, recharges, cooling, repairs) max(min, rosterMul × Σ per unit) — workerPer10 per worker, a
  // robot's recharge fee + robotExtra — never from the growth budget, never as a request.
  careWallet: { min: 50, rosterMul: 1.5, workerPer10: 35, robotExtra: 20, windowMin: 10 },
  // Licences (Giấy phép, §2.5): the player's, kept by the Level-10 incident. Used by the P3 planner.
  licences: { groups: ['hr', 'assign', 'beans', 'land', 'credit'], prices: { hr: 0, assign: 0, beans: 300, land: 1000, credit: 1500 }, unlockLevel: 1 },
  planRules: { storageFull: 0.5, phoneMoraleBelow: 40, nagEverySeconds: 60, hirePiling: 3, plotsPerWorker: 3, softRepeats: 2, hotRepeats: 1, contractWarnHours: 2, betterMul: 1.1 },
  // ---- Planner v2 (management-rules §3.3–§3.7); the rules themselves are the GM_RULES rows below ----
  // plan: the day plan (Kế hoạch ngày) every everyMin played minutes and on hire; target = round10(I10 × 2 × targetMul);
  //  offscreenEvery: the zone not on screen is thought about every n-th think (care + trade + plan rows only);
  //  statOf: the worker stat that fits a job (fit = fitBase + fitPerStat × stat); thinkSlowMul: backlog ≥
  //  PENALTY.backlog.waitAt → cadence × this and one action per think.
  plan: { lockWorkers: { farm: true, shop: false }, everyMin: 10, targetMul: 1.1, targetRound: 10, offscreenEvery: 2, fitBase: 0.5, fitPerStat: 0.1, thinkSlowMul: 2,
    statOf: { harvest: 'accuracy', deliver: 'speed', plant: 'stamina', water: 'stamina', order: 'smart', brew: 'smart' } },
  // score = urgency band × (value + 1) / (cost / I10 + costFloor) × styleMul[style][styleGroup]
  urgency: { blocking: 5, storage: 5, orders: 4, idlePlots: 3, morale: 3, growth: 2, cosmetic: 1 },
  costFloor: 0.05,
  styleMul: { careful: { capital: 0.5, care: 1.2, trade: 1 }, balanced: { capital: 1, care: 1, trade: 1 }, bold: { capital: 1.5, care: 0.8, trade: 1.2 } },
  styleGroupOf: { capital: 'capital', care: 'care', ops: 'care', trade: 'trade' },
  // The only things that need your signature: real-money top-ups and selling beans.
  alwaysApprove: ['gm/topUpSeen', 'farm/sell', 'farm/sellAll', 'farm/sellVariety', 'farm/sellBeans'],
  // Training (Đào tạo, §2.5): skill + 1 for basePerSkill × (skill + 1) coins, done after shiftDays shift-days of play.
  training: { basePerSkill: 400, shiftDays: 1 },
  // How the planner values things (coins per played minute; management-rules §2.5 / §3.5). jobsPerMin: reference jobs
  // a unit of that type finishes per played minute at speed ×1 (walking included); jobsPerDrink: café jobs per cup
  // (order, brew, deliver); reactionMin: R, the player's own reaction to a blocked unit; staminaDowntime: share of a
  // worker's time lost to low energy per stamina step; gearThroughput: value of a walk / brew gear tier × contrib.
  // load (balance pass 2026-11-08): the manager samples each zone's jobs a free worker could start now
  // (D.actionableJobs) every think into an EMA (s.gm.load[zone]); a throughput upgrade is worth
  // clamp((load / working units − free) / span, 0, 1) of its value. Sim: a café team of 4 sees ≈ 3 such jobs (no
  // shortage), a team of 2 ≈ 4.6; the old arrival-based demand model bought speed and gear nobody needed (the café
  // earned 110–140 coins/min LESS with the manager than without).
  load: { ema: 0.2, free: 1, span: 1 },
  value: { jobsPerMin: { surveyor: 1, builder: 2, herder: 2, picker: 8, planter: 8, waterer: 8, processor: 6, hauler: 6, pruner: 6, barista: 8, harvestBot: 11, plantBot: 11, waterBot: 11, haulBot: 8, pruneBot: 8, droneBot: 11, brewBot: 10 }, jobsPerDrink: 3, reactionMin: 1, speedStep: 0.08, slackStep: 0.15,
    staminaDowntime: 0.025, motorStep: 0.1, gearThroughput: 0.05, precision: 0.25, qualityMistakes: 3 },
  // Land (§3.6): buy when payback ≤ buyPaybackMin, the zone ≥ busyPct busy and coins ≥ coinsMul × price (or a loan
  // fits); sell when a parcel is < sellUtil used for windowMin and its refund beats LAND.sellPaybackMin of its income;
  // at most one land proposal (coolActs: buying / selling a lot, not building upgrades) per everyMin, counted from its
  // filing and again from its approval; a lot needs windowMin samples of its own before it can be sold. Utilisation is
  // sampled once per played minute (windowMin kept).
  // boundEveryMin: a land-bound farm (D.landBound: more hands than plots) asks for land this often
  land: { buyPaybackMin: 90, busyPct: 0.6, coinsMul: 1.2, sellUtil: 0.2, windowMin: 30, everyMin: 10, boundEveryMin: 2, coolActs: ['land/buyParcel', 'land/sell'] },
  // Buildings (§3.7): upgrade one when its production queue was full ≥ fullMin played minutes and it pays back ≤ paybackMin.
  building: { fullMin: 10, paybackMin: 45 },
  // Loans (§3.7): a capital job the coins cannot pay may file a loan task when its payback < term × paybackTermShare;
  // one loan task per everyMin. Repay alone when coins ≥ owed + care wallet + autoLimit (up to autoLimit).
  loanRule: { everyMin: 10, paybackTermShare: 0.5 },
  // Real-money top-up (§3.7, §8 Q2): only a proposal, after afterDenied denied loan tasks today and I10 <
  // incomeShare × plan.target, at most perDay a day, never penalised. No real-money store exists yet: approving it only
  // logs the answer.
  topUp: { afterDenied: 2, incomeShare: 0.5, perDay: 1 },
  // Self-upgrade (§3.7): suggest a licence after a rule of its group fired licenceFires times today (counted at most
  // once per played minute); propose training after trainThinks thinks in a row with more candidates than actions,
  // when the extra actions pay the fee back in ≤ trainPaybackMin (each extra action worth actionValueMin × its value).
  selfUpgrade: { licenceFires: 3, trainThinks: 3, trainPaybackMin: 40, actionValueMin: 0.25 },
  // The manager in the world (management-rules §6, P4; realm/manager.js): colour (his only), body height ×heightMul,
  // walk speed (m/s) to the unit / field he acts on, point time (s) there, then back to his desk; red ring under his
  // feet while any task has < ringLifeShare of its life left (the HUD card turns amber under urgentShare, red under it); 😒 while loyalty < sadLoyalty; a yawn every yawnEverySec
  // in Chờ lệnh; facepalm / thumbs-up / point emote seconds; at most one spoken line per lineGapSec (actionable lines
  // — a request, an expiry — always speak); walks only to targets ≤ maxWalkM from the desk (else he points from there).
  look: { color: '#7c4dbd', heightMul: 1.05, walkSpeed: 2.8, pointSec: 0.8, ringLifeShare: 0.1, urgentShare: 0.2, sadLoyalty: 0,
    yawnEverySec: 6, emoteSec: { facepalm: 1.6, thumbsUp: 1.4, yawn: 1.8 }, lineGapSec: 8, lineMs: 3600, requestMs: 4800, maxWalkM: 40 },
  names: [['Hằng', 'female'], ['Khải', 'male'], ['Sáu', 'male'], ['Ngọc', 'female'], ['Tuấn', 'male'], ['Thu', 'female'], ['Bảy', 'male'], ['Quân', 'male'], ['Mai', 'female']],
};
// Farm Manager V2 (docs/design/farm-manager-v2.md). Every number here is a PROPOSAL from the V2 brief, not yet balanced by
// the sim. reserveMul: × the operating reserve; maxPayback: played minutes an investment may take to pay back;
// landPayback: the same for a new terrace (Balanced keeps farm-crew.md §15's 120 min); horizon: minutes used for expected net profit and ROI; landUse: planted share the land must reach before buying more;
// loan: he may borrow for a capital job; ask: capital jobs wait for your signature (Manual Approval).
export const FARM_MANAGER = {
  modeOrder: ['balanced', 'profit', 'expansion', 'conservative', 'manual'],
  modes: {
    balanced: { reserveMul: 1, maxPayback: 60, landPayback: 120, horizon: 90, landUse: 0.7, loan: true },
    profit: { reserveMul: 1, maxPayback: 40, landPayback: 90, horizon: 60, landUse: 0.85, loan: true },
    expansion: { reserveMul: 0.8, maxPayback: 120, landPayback: 180, horizon: 180, landUse: 0.55, loan: true },
    conservative: { reserveMul: 2, maxPayback: 30, landPayback: 60, horizon: 45, landUse: 0.85, loan: false },
    manual: { reserveMul: 1, maxPayback: 60, landPayback: 120, horizon: 90, landUse: 0.7, loan: false, ask: true },
  },
  reservePicks: [0, 200, 500, 1000, 2000, 5000, 10000], // 0 = automatic only
  limitPicks: [0, 200, 500, 1000, 3000, 10000], // per GM.windowMinutes; 0 = no extra limit
  planEverySec: 20, logKeep: 40, logRepeatMin: 5, seedFields: 6,
  savingMin: 10, // he saves up for the best option when it is at most this many minutes of income away
  recovery: { coinsMul: 1.5, minutes: 30 },
  calib: { ema: 0.15, min: 0.3, max: 1.2 },
  // Share of one harvest's value that one job of this kind creates (a model assumption, see the doc §5).
  jobValue: { harvest: 1, plant: 0.6, water: 0.25, process: 0.3, haul: 0.25, prune: 0.15, spray: 0.15, openField: 0.2, expand: 0.1, build: 0.1, livestock: 0.05 },
  water: { extraUncovered: 0.5, extraMinFields: 6, walkMps: 2.2, tripWorkM: 12 },
  // The manager's own hands (he taps like you do): everySec between rounds, perMin jobs at ⚡1, +perSpeed per ⚡ step, harvestShare of a round goes to picking first.
  // incidentLoanLevels: no borrowing this many levels (or fewer) before the first region's Lv10 incident (farm-manager incidentNear).
  incidentLoanLevels: 5,
  hands: { everySec: 2, perMin: 60, perSpeed: 0.2, harvestShare: 0.7, sellAt: 0.5, jobsPerPicker: 8 },
  // Big teams: only the units nearest the camera get shadows, full-rate animation, or are drawn at all (the rest keep working).
  lod: { everySec: 0.5, shadows: 8, fullAnim: 10, halfAnim: 18, drawn: 22 }, idleThink: 1,
  // Staffing from the counters (ripe, thirsty, old trees, storage): clear the backlog in clearMin and keep up with what comes in.
  // share: most of the 30-unit crew one trade may take. No new fields while ripe > picks × stopBacklogMin or more ripens than can be picked.
  staffing: { clearMin: 5, stopBacklogMin: 2, holdAutoMin: 1, holdManualMin: 10, share: { harvest: 0.5, water: 0.2, prune: 0.1, haul: 0.15 } },
  stuckSeconds: 15, avoidSeconds: 12, ageCapM: 30,
};
/** Field jobs the manager does by himself per minute. */
export const gmHandsPerMin = gm => FARM_MANAGER.hands.perMin * (1 + FARM_MANAGER.hands.perSpeed * (gmStatOf(gm, 'speed') - 1));
/** Field jobs in one of his rounds. */
export const gmHandsPerRound = gm => Math.max(1, Math.round(gmHandsPerMin(gm) * FARM_MANAGER.hands.everySec / 60));
/** One of the manager's four numbers (old managers read their skill). */
export const gmStatOf = (gm, k) => Math.min(GM.maxStat, Math.max(1, (gm?.stats?.[k] ?? gm?.skill ?? 1) | 0));
/** Seconds between two rounds of decisions. */
export const gmThinkOf = gm => Math.max(2, 5 - 0.35 * (gmStatOf(gm, 'speed') - 1));
/** Jobs he handles per round. */
export const gmActionsOf = gm => 1 + Math.floor((gmStatOf(gm, 'accuracy') - 1) / 3);
/** Sale price factor on the beans you sign for. */
export const gmMoneyMul = gm => 1 + 0.03 * (gmStatOf(gm, 'smart') - 1);
/** Incident fee factor: he haggles. */
export const gmHaggleMul = gm => (gm ? 1 - 0.05 * (gmStatOf(gm, 'smart') - 1) : 1);
/** Incident chance factor of the whole team while he is around. */
export const gmCalmMul = gm => (gm ? 1 - 0.06 * (gmStatOf(gm, 'stamina') - 1) : 1);
/** The headhunter board for a seed (pure): GM.board.size candidates — skill 1..5, style, loyalty, fee. */
export function gmCandidatesFor(seed) {
  const r = rng(seed | 0);
  const names = [...GM.names];
  return Array.from({ length: GM.board.size }, () => {
    const [name, gender] = names.splice(Math.floor(r() * names.length), 1)[0];
    const skill = 1 + Math.min(4, Math.floor(r() * r() * 5 + r() * 2)); // mostly 1–3, sometimes 4–5
    const style = GM.styleOrder[Math.floor(r() * GM.styleOrder.length)];
    const [lo, hi] = GM.styles[style].loyalty;
    return { name, gender, skill, style, loyalty: Math.round(lo + r() * (hi - lo)), fee: GM.hireFeePerSkill * skill };
  });
}
/** Base salary of a GM per GM.payMinutes in a power mode. */
export const gmSalary = (gm, mode) => Math.round(GM.salaryPerSkill * (gm?.skill || 1) * (GM.modes[mode]?.mul ?? 1) * (1 + GM.raiseStep * (gm?.raises || 0)));
/** Age + hometown drawn from an rng (applicants) — or from a uid hash (old saves, see profileOfUid). */
function profileFrom(r) {
  const [lo, hi] = PROFILE.age;
  return { age: lo + Math.floor(r() * (hi - lo + 1)), home: PROFILE.homes[Math.floor(r() * PROFILE.homes.length)] };
}
/** A stable profile for a unit hired before profiles existed (same uid → same age / hometown). */
export const profileOfUid = uid => profileFrom(rng((parseInt(String(uid).replace(/\D+/g, ''), 10) || 0) * 7919 + 17));
/** Robot serial number "SB-0427" from its type and uid (stable). */
export const robotSerial = (type, uid) => `${PROFILE.serial[type] || 'RB'}-${String(((parseInt(String(uid).replace(/\D+/g, ''), 10) || 0) * 389 + 101) % 10000).padStart(4, '0')}`;
// Per-stat upgrades (§5): every finished job gives the worker XP (× trait xpMul); every xpPerPoint XP = 1 skill point.
// Stat n → n+1 costs n points + coinPerLevel × n coins. Stats 1..maxStat. Unit level (display) = sum of stats − 3.
export const SKILL = { xpPerPoint: 20, coinPerLevel: 100, maxStat: 5, staminaCostMul: 0.5,
  // tradeCostMul: training and gear for an unskilled trade cost this share (QA 2026-11-09: a waterer only speeds growth by
  // 15 %, so speed / boots at full price paid back in 47–60 min, past the 40-min gate; carrying buckets needs little training).
  tradeCostMul: { waterer: 0.5 } };
export const STAT_ORDER = ['speed', 'smart', 'accuracy', 'stamina'];
export const MAX_STAFF_LEVEL = STAT_ORDER.length * SKILL.maxStat - (STAT_ORDER.length - 1); // 17
/** Price of the next step for this unit: on the farm coins only (founder: money decides), the café keeps its skill points. */
// Stamina (energy + less slack) is worth about half a speed step, so it costs half (balance 2026-11-09: its payback
// was 60–177 played minutes against ≤ 40 for the other stats). `stat` optional: without it, the full price.
/** Price share of a unit's training / gear (SKILL.tradeCostMul; 1 for the other trades). */
export const tradeCostMul = u => SKILL.tradeCostMul[u?.type] ?? 1;
export const statCostOf = (u, n, stat) => {
  const c = STAFF[u?.type]?.zone === 'farm' ? { points: 0, coins: statCost(n).coins } : statCost(n);
  const mul = (stat === 'stamina' ? SKILL.staminaCostMul : 1) * tradeCostMul(u);
  return mul !== 1 ? { ...c, coins: Math.max(5, Math.round(c.coins * mul / 5) * 5) } : c;
};
export const statCost = n => ({ points: Math.max(1, n | 0), coins: SKILL.coinPerLevel * Math.max(1, n | 0) });
/** Starting stats of a new worker: all 1, diligent stamina 2, swift speed 3. */
export function startStats(trait, perk) {
  const st = Object.fromEntries(STAT_ORDER.map(k => [k, 1]));
  for (const [k, v] of Object.entries(TRAITS[trait]?.start || {})) st[k] = Math.max(st[k], v);
  if (perk === 'swift') st.speed = Math.max(st.speed, RARE.swiftSpeed);
  return st;
}
/** Highest value a trait allows for a stat (lazy: stamina 3). */
/** Top of a worker's stats: 10 on the farm, the café keeps its 5. */
export const maxStatOf = u => (STAFF[u?.type]?.zone === 'farm' ? 10 : SKILL.maxStat);
/** Top part tier of a robot: 9 (= level 10) on the farm, the café keeps 3. */
export const maxTierOf = u => (STAFF[u?.type]?.zone === 'farm' ? 9 : PART_COST.maxTier);
export const statCap = (u, stat) => (STAFF[u?.type]?.zone === 'farm' ? 10 : TRAITS[u?.trait]?.cap?.[stat] ?? SKILL.maxStat);
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
export const SMART_RULES = { chainPiles: 3, driestFirst: 2, biggestFirst: 2, urgent: 2, twoCups: 3, chain: 4, restock: 5, ripeFirst: 2, playerCrop: 3, quick: 4, twoPlots: 5 };
// Worker tasks (§6): empty = auto. `base` tasks, `more` tasks from smart `moreFromSmart`.
export const WORKER_TASKS = { farm: ['harvest', 'plant', 'water'], shop: ['order', 'brew', 'deliver'] };
export const TASK_LIMIT = { base: 1, more: 2, moreFromSmart: 3 };
// Quality ★ (docs/design/staff-upgrades.md §2.3): who made it sets the stars. Café cup: the player 3★, a worker 2★ from
// ACCURACY workerTwoStar (else 1★), a robot 1★; price × price[stars]. Hard drinks: only the player and accuracy-hardLevel
// workers brew them (robots never). Farm harvest: the player 3★ when picked within freshSeconds of ripening (else 1★),
// workers / robots as in the café; beans × yield[stars] (rounded). Index = stars.
export const QUALITY = { price: [1, 1, 1.2, 1.5], yield: [1, 1, 1.25, 1.5], freshSeconds: 10, workerTwoStar: 3, hardLevel: 5, hardDrinks: ['latte'] };
// Watering (farm-crew.md): a watered plot ripens `speedup` × its grow time sooner. A waterer fills a bucket at the farm
// well (layout FARM_WELL) and waters bucketPlots plants per trip (+ its watering can).
export const TEND = { speedup: 0.3, bucketPlots: 4 };
export const isHardDrink = drink => QUALITY.hardDrinks.includes(drink);

// Small staff mistakes (docs/design/staff-upgrades.md §2.2): chance per job by worker ACCURACY 1..5 (index 0..4), ×
// trait mistakeMul. Robots never make mistakes. Only slow things down or cost a little; never lose a customer or a worker.
//  spill: the cup drops on the way → the order goes back to "taken" (rebrew, the beans of one cup are lost);
//  wrongTable: walks to the wrong table first; unripe: picked too early → 1 bean less; crooked: grows ×crookedSlow.
export const MISTAKES = {
  rates: { spill: [.06, .045, .03, .015, 0], wrongTable: [.08, .06, .04, .02, 0], unripe: [.25, .2, .16, .12, .09, .07, .05, .03, .015, 0], crooked: [.2, .16, .13, .1, .08, .06, .04, .025, .01, 0], drop: [.2, .16, .13, .1, .08, .06, .04, .025, .01, 0] },
  traitMul: { lazy: 1.5, diligent: 0.7, funny: 1 },
  crookedSlow: 1.1,
};
const isWorker = u => STAFF[u?.type]?.kind === 'worker';
/** One stat of a worker (1..maxStat). Units without `stats` (old saves, hand-made objects) read their old `level`. */
export const statOf = (u, stat) => (isWorker(u) ? Math.min(maxStatOf(u), Math.max(1, (u.stats?.[stat] ?? u.level) | 0 || 1)) : 1);
export const mistakeChance = (u, kind) => (isWorker(u) ? (MISTAKES.rates[kind]?.[statOf(u, 'accuracy') - 1] || 0) * (MISTAKES.traitMul[u.trait] ?? 1)
  * (1 - CRAFT.mistakeCutPerStep * craftLevel(u, CRAFT.mistakeTask[kind])) * (kind === 'unripe' ? GEAR.items.shears.unripe[gearTier(u, 'shears')] : kind === 'spill' ? GEAR.items.tray.spill[gearTier(u, 'tray')] : 1) : 0); // practice (craft step) and shears / tray cut mistakes
/** Display level: speed + smart + accuracy + stamina − 3 (1..17); robots 1. */
export const unitLevel = u => (isWorker(u) ? STAT_ORDER.reduce((n, k) => n + statOf(u, k), 0) - (STAT_ORDER.length - 1) : 1);
export const hasRule = (u, rule) => statOf(u, 'smart') >= (SMART_RULES[rule] ?? 99);
/** Worker speed factor from the SPEED stat (+8% a step). Its effect bonus scales with it too. */
export const levelSpeed = u => (STAFF[u?.type]?.jobs ? CREW.speedCurve[statOf(u, 'speed') - 1] : 1 + LEVEL_STEP.speed * (statOf(u, 'speed') - 1));
/** How many tasks a worker may be given (staff/setTasks). */
export const taskLimit = u => (statOf(u, 'smart') >= TASK_LIMIT.moreFromSmart ? TASK_LIMIT.more : TASK_LIMIT.base);
/** Energy max: 100 + 20 per stamina step above 1. */
export const energyMax = u => 100 + VITALS.staminaEnergyStep * (statOf(u, 'stamina') - 1);

// Robots (docs/design/staff-upgrades.md §4, staff-manager.md §4): "a robot is just a robot" — it never learns, does
// exactly ONE task that the player sets (or 'auto': the robot picks the task with the most work waiting, re-checked
// every autoSeconds), and only its hardware is upgraded with coins. Tier prices = costRatio × the robot's price; tier 3
// needs player level 8. The old charger is merged into the battery (cheaper recharge per tier).
export const ROBOT_TASKS = { harvestBot: ['harvest'], plantBot: ['plant'], waterBot: ['water'], haulBot: ['haul'], pruneBot: ['prune'], droneBot: ['spray'], brewBot: ['order', 'brew', 'deliver'] };
/** The job types a worker can be given: its trade's job, else every job of its zone. */
export const workerJobs = u => STAFF[u?.type]?.jobs || WORKER_TASKS[STAFF[u?.type]?.zone] || [];
/** Can this unit do this job at all (its trade, or its robot function)? */
// The standard metrics (farm-crew.md §6): every number a trade's stats change, in one place.
const steps = (u, stat) => statOf(u, stat) - 1, isBot = u => STAFF[u?.type]?.kind === 'robot';
/** Units one haul trip carries: on foot + vehicle + stamina step (robot: battery tier). */
export const haulLoadOf = (u, vehicle = 0) => CREW.haulBase + vehicle + (isBot(u) ? CREW.perBattery.haul * partTier(u, 'battery') : CREW.perStamina.haul * steps(u, 'stamina'));
/** Plants watered per trip to the water point: bucket + watering can + stamina (robot: tank + battery tier). */
export const bucketOf = u => (isBot(u) ? CREW.robotBucket + CREW.perBattery.water * partTier(u, 'battery')
  : TEND.bucketPlots + GEAR.items.can.plots[gearTier(u, 'can')] + CREW.perStamina.water * steps(u, 'stamina'));
/** Share of the grow time one watering saves. */
export const waterSpeedupOf = u => TEND.speedup + (u && !isBot(u) ? CREW.accuracy.waterStep * steps(u, 'accuracy') : 0);
/** Beans a light pruning adds. */
export const trimBeansOf = u => CREW.trimBeans + (!isBot(u) && statOf(u, 'accuracy') >= CREW.accuracy.trimTwoFrom ? 1 : 0);
/** Multiplier on a batch's specialty premium when this processor starts it. */
export const premiumMulOf = u => 1 + (u && !isBot(u) ? CREW.accuracy.premiumStep * steps(u, 'accuracy') : 0);
// Low stats misbehave (farm-crew.md §7): chance each time the unit starts a job. Worker: stamina 1..5 → goes off to
// play, smart 1..5 → walks to the wrong place. Robot: frame 0..3 → loses its way, battery 0..3 → drives back to its dock.
export const GOOF = {
  play: [0.3, 0.24, 0.19, 0.15, 0.11, 0.08, 0.05, 0.03, 0.015, 0.005], lost: [0.25, 0.2, 0.16, 0.12, 0.09, 0.07, 0.05, 0.03, 0.015, 0.005], traitMul: { lazy: 1.5, diligent: 0.6, funny: 1 },
  robotLost: [0.2, 0.16, 0.13, 0.1, 0.07, 0.05, 0.03, 0.02, 0.01, 0.003], robotDock: [0.14, 0.11, 0.09, 0.07, 0.05, 0.035, 0.02, 0.012, 0.006, 0.002],
  hold: { play: [14, 13, 12, 11, 10, 9, 8, 6, 5, 4], lost: 3, dock: 6 },
};
// Funny incidents (farm-crew.md §10): when a unit starts a job it may instead get up to something, tied to one of its four
// numbers. Its level = 11 − that number (a level-1 unit makes level-10 trouble). It stops work until someone pays or fires it.
export const FUNNY = {
  worker: [['phone', 'stamina'], ['flirt', 'smart'], ['nap', 'stamina'], ['gossip', 'smart'], ['refuse', 'accuracy'], ['karaoke', 'speed'], ['snack', 'speed'], ['bet', 'accuracy']],
  robot: [['dance', 'motor'], ['sing', 'cooler'], ['broken', 'frame'], ['virus', 'frame'], ['drunk', 'battery'], ['crush', 'battery']],
  chance: [0.06, 0.05, 0.04, 0.03, 0.022, 0.016, 0.01, 0.006, 0.003, 0.001], // by that number 1..10
  fee: { worker: [2, 1], robot: [3, 2] }, // sized to bean prices: one incident is a few beans, not a whole harvest // base + per level
  paybackMin: 8, fireAfterToday: 3, // the manager pays while the fee is ≤ paybackMin of what the unit earns a minute; else fires a repeat offender
};
const funnyList = u => FUNNY[STAFF[u?.type]?.kind === 'robot' ? 'robot' : 'worker'];
const funnyNumber = (u, stat) => (STAFF[u.type].kind === 'robot' ? partTier(u, stat) + 1 : statOf(u, stat));
/** pick, hit in 0..1 (mul: the manager's calming effect) → { id, level } or null. */
export function funnyRoll(u, pick, hit, mul = 1) {
  const list = funnyList(u), [id, stat] = list[Math.min(list.length - 1, Math.floor(pick * list.length))], n = funnyNumber(u, stat);
  return hit < FUNNY.chance[n - 1] * mul ? { id, level: 11 - n } : null;
}
/** Level of incident `id` for this unit, null when it is not one of its kind. */
export function funnyLevel(u, id) { const f = funnyList(u).find(x => x[0] === id); return f ? 11 - funnyNumber(u, f[1]) : null; }
export const funnyFee = (u, level) => { const [base, per] = FUNNY.fee[STAFF[u.type].kind]; return base + per * level; };
const goofChance = (u, kind) => (STAFF[u?.type]?.kind === 'robot' ? (kind === 'lost' ? GOOF.robotLost[partTier(u, 'frame')] : kind === 'dock' ? GOOF.robotDock[partTier(u, 'battery')] : 0)
  : STAFF[u?.type]?.jobs && kind !== 'dock' ? GOOF[kind][statOf(u, kind === 'play' ? 'stamina' : 'smart') - 1] * (GOOF.traitMul[u.trait] ?? 1) : 0);
/** r in 0..1 → 'play' | 'lost' | 'dock' | null. */
export function goofRoll(u, r) {
  let sum = 0;
  for (const kind of ['play', 'lost', 'dock']) { sum += goofChance(u, kind); if (r < sum) return kind; }
  return null;
}
/** Coins to call a wandering unit straight back to work (the less disciplined, the dearer; the manager haggles). */
export const goofFee = (u, gm = null) => { const robot = STAFF[u?.type]?.kind === 'robot', n = robot ? partTier(u, 'frame') + 1 : statOf(u, 'stamina'); return Math.max(1, Math.round(((robot ? 3 : 2) + (11 - n)) * gmHaggleMul(gm))); };
export const goofHold = (u, kind) => (kind === 'play' ? GOOF.hold.play[statOf(u, 'stamina') - 1] : GOOF.hold[kind]);
// What a unit has not learned yet: a worker's smart, a robot's parts.
export const SKILL_GATE = { hardCrop: { smart: 2, frame: 1 }, oldTree: { smart: 3, motor: 2 }, wetMill: { smart: 2 } };
export const isHardCrop = crop => !!(CROPS[crop]?.drop || CROPS[crop]?.waves);
export function knows(u, what) {
  const g = SKILL_GATE[what];
  if (!g) return true;
  if (STAFF[u?.type]?.kind !== 'robot') return g.smart == null || statOf(u, 'smart') >= g.smart;
  return Object.entries(g).every(([k, need]) => k === 'smart' || partTier(u, k) >= need);
}
export const doesJob = (u, job) => (STAFF[u?.type]?.kind === 'robot' ? !!ROBOT_TASKS[u.type]?.includes(job) : workerJobs(u).includes(job));
export const ROBOT_AUTO = { autoSeconds: 30 };
export const ROBOT_PARTS = {
  battery: { icon: '🔋', minutes: [6, 9, 13, 18, 24, 30, 38, 46, 55, 65], feeMul: [1, 0.8, 0.6, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1] }, // work minutes per charge, recharge fee (management-rules §2.3)
  motor: { icon: '⚙️', speed: [1, 1.1, 1.2, 1.35], heatMul: [1, 1.15, 1.3, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8] }, // faster, but hotter
  cooler: { icon: '❄️', heatMul: [1, 0.67, 0.5, 0] },                               // tier 3 never overheats
  frame: { icon: '🛡️', jamMul: [1, 0.67, 0.44, 0.3, 0.24, 0.18, 0.13, 0.09, 0.05, 0.02], wearMul: [1, 0.67, 0.44, 0.3, 0.24, 0.18, 0.13, 0.09, 0.05, 0.02] }, // fewer jams, slower wear
};
export const PART_ORDER = ['battery', 'motor', 'cooler', 'frame'];
// partMul: per-part price factor. cooler ×0.6 (changed 2026-11-08 after the sim: a café brewBot overheats rarely, so a
// full-price cooler t1 paid back in 106 min; at ×0.6 it is ≈ 63 min, inside its ≤ 90 reliability gate — §2.5).
export const PART_COST = { costRatio: [0.15, 0.3, 0.5, 0.7, 0.9, 1.2, 1.5, 1.9, 2.4], partMul: { cooler: 0.6 }, maxTier: 3, tier3Level: 1 }; // management-rules §2.5: battery / motor / cooler t1 pay back ≤ 40 min
// Robot heat / jam / wear (§4). heat 0..100 (100 = overheat for overheatSeconds); wear 100 = new → 0. Jam chance per job.
export const ROBOT_WEAR = { heatPerMin: 25, coolPerMin: 40, overheatSeconds: 30, jamChance: 0.02, wearPerJob: 0.2, lowWear: 30, lowWearJamMul: 2,
  heatWarnAt: 50, heatBadAt: 80 }; // heatWarnAt / heatBadAt: the HUD heat bar turns amber / red
// Realm job loop of the staff (was hard-coded in realm/staff.js / staff-brain.js, management-rules §7.1): walk speed
// (m/s) per kind (brewBot × brewBotWalkMul), seconds per job by unit type (deliverSeconds: the hand-over of a cup),
// café chaining / urgency / lane numbers of the pure brain.
export const STAFF_SIM = {
  speed: { worker: 2.6, robot: 3.2 }, brewBotWalkMul: 1.15,
  work: { surveyor: 2.5, builder: 2.5, herder: 2.5, picker: 1.2, planter: 1.2, waterer: 1, processor: 1.4, hauler: 1.4, pruner: 1.6, harvestBot: .8, plantBot: .8, waterBot: .7, haulBot: 1, pruneBot: 1, droneBot: .6, barista: .7, brewBot: .4 }, deliverSeconds: .25,
  chainWaitMs: 2500, twoCupM: 4, urgentRatio: .7, urgentSpeed: 1.25, laneM: 1.4,
};
export const partTier = (u, part) => Math.min(maxTierOf(u), Math.max(0, (u?.parts?.[part] | 0)));
export const partCost = (type, tier, part) => Math.round((STAFF[type]?.cost || 0) * (PART_COST.costRatio[tier] ?? 0) * (PART_COST.partMul[part] ?? 1) / 5) * 5;
export const robotTask = u => (ROBOT_TASKS[u?.type]?.includes(u.task) ? u.task : 'auto');
/** Work / walk speed factor of a unit: worker speed stat or robot motor. */
export const unitSpeed = u => (STAFF[u?.type]?.kind === 'robot' ? (STAFF[u.type].zone === 'farm' ? CREW.robotSpeed : ROBOT_PARTS.motor.speed)[partTier(u, 'motor')] : levelSpeed(u));
export const batteryMinutes = u => ROBOT_PARTS.battery.minutes[partTier(u, 'battery')];
/** Heat a working robot gains per minute (motor makes it hotter, the cooler cancels it). */
export const heatPerMin = u => ROBOT_WEAR.heatPerMin * ROBOT_PARTS.motor.heatMul[partTier(u, 'motor')] * (STAFF[u?.type]?.zone === 'farm' ? CREW.robotCooler : ROBOT_PARTS.cooler.heatMul)[partTier(u, 'cooler')];
/** Chance one finished job jams the robot (the realm rolls it and sends staff/jam). */
export const jamChance = u => (STAFF[u?.type]?.kind === 'robot'
  ? ROBOT_WEAR.jamChance * (STAFF[u.type].zone === 'farm' ? CREW.robotJamMul : 1) * ROBOT_PARTS.frame.jamMul[partTier(u, 'frame')] * ((u.wear ?? 100) < ROBOT_WEAR.lowWear ? ROBOT_WEAR.lowWearJamMul : 1) : 0);
/** Slack chance multiplier of a worker: trait × stamina. */
export const slackMul = u => (TRAITS[u?.trait]?.slackMul ?? 1) * Math.max(0.2, 1 - LEVEL_STEP.slack * (statOf(u, 'stamina') - 1));

// Rivals (§7): every everyMinutes a rival owner may try to poach a low-morale (or rare) worker; the player has
// TASKS.life.poach played minutes (the inbox; keepSeconds is the old real-time figure) to pay keepFeePerLevel × unit level (+keepMorale morale) or let them go (letGoRefund × hire price back).
export const RIVAL = { everyMinutes: 8, chance: 0.5, keepSeconds: 60, keepFeePerLevel: 50, keepMorale: 20, refuseMorale: 70, targetMorale: 50,
  letGoRefund: 0.3, names: { farm: 'Bà Tư', shop: 'Anh Ba' } };
// Fire / sell (§8): refund ratio of what was paid at hire (robots also get back part of their hardware).
export const FIRE = { worker: 0.3, robot: 0.5, robotParts: 0.5 };
// Level-10 restart (founder 2026-11-07): one of your staff asks to follow you into the new life — the most attached
// worker (highest morale), or, robotChance of the time when you own robots, a robot that "evolved a mind" from living
// with people. You confirm or decline. A follower costs wage coins per UPKEEP.perMinutes for as long as it stays
// (workers: wageRatio × hire price, min minWage; the evolved robot asks robotWage); with no coins it goes on your debt.
export const FOLLOW = { robotChance: 0.25, wageRatio: 0.1, minWage: 10, robotWage: 20 };
// Books (§8): team ledger per game minute (last ledgerKeep kept), journal (newest first, journalKeep), MVP every
// mvpMinutes (+mvpMorale to every worker).
export const BOOKS = { ledgerKeep: 30, journalKeep: 30, mvpMinutes: 10, mvpMorale: 10 };

/** Extra effect a unit's trait adds in its zone (e.g. funny barista: +5% drink price). */
export const traitEffect = (unit, key) => TRAITS[unit?.trait]?.bonus?.[STAFF[unit.type]?.zone]?.[key] || 0;
// Auto nông trại ("lượt auto", founder 2026-11-09): a run is AUTO.runSeconds (10 min) of PLAYED time during which the farm
// works itself in the background — pick ripe trees (most urgent first), plant empty fields with the best affordable variety,
// cut back worn-out trees, water, and sell everything when the storehouse is `sellAt` full. The player keeps full control
// and can act at the same time. A round every `everySec` does up to `perRound` jobs (≈ a quick hand: 60 jobs/min).
// Stop keeps the time left (resume later, no new run spent). It never buys land, buildings, staff or upgrades.
// One free run for every save; more cost in-game coins (never real money): price grows with each purchase.
export const AUTO = { freeRuns: 1, runSeconds: 600, everySec: 2, perRound: 2, sellAt: 0.8, maxTickMs: 10000, price: 300, priceStep: 100, maxPrice: 1500 };
export const autoPrice = bought => Math.min(AUTO.maxPrice, AUTO.price + AUTO.priceStep * (bought | 0));

// Breaks: workers sometimes slack off (stand still on their phone); robots run out of battery after a while of work.
// A stopped unit does no work and gives no bonus until the player taps the coin bubble over its head and pays `fee`.
// slackChancePerMinute: chance per minute of work that a worker slacks; batteryMinutes: work time per full charge.
export const STAFF_BREAKS = {
  worker: { kind: 'phone', slackChancePerMinute: 0.3, feeRatio: 0.1, minFee: 10 },
  robot: { kind: 'battery', batteryMinutes: 6, feeRatio: 0.03, minFee: 15 }, // recharge 36 / 45 at tier 0 (management-rules §2.3)
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
// The Level-10 incident (sự cố Lv10) is ON again (founder 2026-11-09, after testing): reaching level 10 ends the region —
// full restart in a new one, one follower comes along. false = play on past level 10 (QA only).
export const EXPIRY_ENABLED = true;

export const XP = { build: 10, upgrade: 8, buyLand: 6, openRoad: 4, hire: 5 };

// Level gifts: every level-up gives one gift, claimed from a gift box (HUD). Levels in CHEST_LEVELS give a surprise
// chest instead (one random prize from CHEST_PRIZES, drawn with a roll from the action payload so it stays
// deterministic). Gifts are earned again after the Level-10 incident (level goes back to 1).
export const CHEST_LEVELS = [5, 10, 15];
export function levelGift(level) {
  const items = [{ kind: 'coins', amount: 40 * level }];
  if (level === 2 || level === 8) items.push({ kind: 'hireTicket', amount: 1 }); // a free hire
  if (level === 4 || level === 7) items.push({ kind: 'coins', amount: 60 * level }); // (was an auto-play run: auto is gone)
  return items;
}
// Surprise prizes (weight = how often). New crops / animals (potato, carrot, chicken, pig) join this list once the
// produce system exists (see docs/design/level-progression.md).
export const CHEST_PRIZES = [
  { id: 'jackpot', weight: 3, items: level => [{ kind: 'coins', amount: 150 * level }] },
  { id: 'helpers', weight: 2, items: level => [{ kind: 'hireTicket', amount: 2 }, { kind: 'coins', amount: 40 * level }] },
  { id: 'beans', weight: 2, items: level => [{ kind: 'beans', amount: 30 }, { kind: 'coins', amount: 60 * level }] },
  { id: 'auto', weight: 1, items: level => [{ kind: 'coins', amount: 120 * level }] },
];
export function chestPrize(roll) {
  const total = CHEST_PRIZES.reduce((n, p) => n + p.weight, 0);
  let x = Math.min(0.999999, Math.max(0, Number(roll) || 0)) * total;
  for (const p of CHEST_PRIZES) { if (x < p.weight) return p; x -= p.weight; }
  return CHEST_PRIZES[0];
}

// Loans (HUD 💰 under the gear, management-rules §2.7 / §4.5): borrow a pack of coins now, owe it back plus a fee.
// At most maxOpen loans at once (s.loans[]); a pack opens at packLevel[pack]; the total owed may not pass the credit
// limit creditMul × I10ref × (1 + creditLevelStep × level), I10ref = 10 × I(L) (the reference 10-minute income).
// Each loan's term (played minutes) is fixed when taken: clamp(ceil to term.round of term.mul × owed / (autoRepay ×
// I(L))), term.minMin, term.maxMin). Late → owed × (1 + lateFee) once and no new loan until every late loan is paid.
// While a loan is open, autoRepay of every coin income goes to the oldest debt first; the rest can be paid any time.
// The Level-10 incident does NOT wipe the debt (a debt is a debt).
export const LOAN = { packs: [1000, 2000, 5000], fee: 0.1, autoRepay: 0.2, maxOpen: 2,
  packLevel: { 1000: 4, 2000: 6, 5000: 8 },
  creditMul: 1.5, creditLevelStep: 0.1,
  term: { mul: 2, minMin: 30, maxMin: 150, round: 10 }, // mul 1.5 → 2 (2026-11-08, sim: the delegate earns ≈ 50 % of I(L); 1.5 only covered ≥ 67 %)
  lateFee: 0.05 };
// Wage arrears (management-rules §2.7): unpaid salary / follower wage is owed in s.debt.wages { gm, follower } (never on
// a loan). Arrears are paid first out of the next income; a follower whose arrears reach wageCapMul × its wage leaves.
export const DEBT = { wageCapMul: 10 };
export const loanOwed = amount => Math.round(amount * (1 + LOAN.fee));
/** Term of a loan in played minutes (management-rules §2.7): LOAN.term.mul × the time autoRepay alone needs to clear
 *  `owed` at the reference income `perMin` (I(L)), rounded up to LOAN.term.round, clamped to [minMin, maxMin]. */
export function loanTermMin(owed, perMin) {
  const T = LOAN.term, rate = LOAN.autoRepay * Math.max(1, Number(perMin) || 0);
  const raw = Math.ceil(T.mul * Math.max(0, Number(owed) || 0) / rate / T.round - 1e-9) * T.round;
  return Math.min(T.maxMin, Math.max(T.minMin, raw));
}

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
  roasted: { id: 'roasted', icon: '🫘', price: 9 }, // (no cup: the cup belongs to the café)
  bag: { id: 'bag', icon: '🛍️', price: 33 },
};
export const GOOD_ORDER = ['beans', 'dried', 'roasted', 'bag'];
export const ITEM_GOODS = ['dried', 'roasted', 'bag']; // stored in inventory.items
// Recipes: one batch = `in` → `out` in `seconds` (÷ effect.speed of the building level, × effect.batch for in/out/fee),
// `fee` coins of fuel per batch, `xp` per batch collected. The job's duration is fixed when it starts.
export const RECIPES = {
  // premium: coins per bean × (its variety's raw price − the base bean price), paid when the batch is collected, so a
  // dearer variety (Arabica) keeps its value through the chain (coffee-varieties.md §4: "specialty batch").
  dry: { id: 'dry', building: 'dryer', in: { beans: 12 }, out: { dried: 12 }, seconds: 30, fee: 0, xp: 1, premium: 1 },
  // washed process (wet mill): same parchment out, faster, water + fuel fee, a bigger specialty premium.
  wash: { id: 'wash', building: 'wetMill', in: { beans: 12 }, out: { dried: 12 }, seconds: 20, fee: 2, xp: 2, premium: 1.5 },
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

// ---------- Planner v2 data (management-rules §3.3–§3.7, §7.1) ----------
// Land sale (land/sell, only through an approved inbox task): sellRefund × the lot's price back; the planner proposes a
// sale only when the refund beats sellPaybackMin played minutes of what the lot earns. Never the last lot of a zone,
// never a starter lot, never a lot with a building on it.
export const LAND = { sellRefund: 0.6, sellPaybackMin: 40 };
// Upgrade gate (§2.5): a throughput upgrade the manager does / proposes must pay back ≤ paybackMin played minutes
// (≤ latePaybackMin for a robot part tier ≥ 2 or a stat step ≥ 3); quality upgrades are outside the gate and only
// come up when the unit made ≥ GM.value.qualityMistakes mistakes today.
export const UPGRADE_GATE = { paybackMin: 40, latePaybackMin: 90, quality: ['accuracy', 'smart', 'shears', 'hat', 'tray', 'frame'] };
// The fixed metric vocabulary of the manager's snapshot (D.gmSnapshot). GM_RULES rows may only name these; another
// game supplies its own rows and a snapshot with the same names.
export const GM_SNAPSHOT_METRICS = {
  zone: ['units', 'workers', 'robots', 'blockedUnits', 'idleUnits', 'moraleMin', 'storagePct', 'storageValue', 'saleBlocked', 'ripeWaiting', 'emptyPlots',
    'busyPct', 'waitingOrders', 'takenOrders', 'readyCups', 'beans', 'beanNeed', 'beansLow', 'coins', 'owed', 'I10', 'I30', 'careNeed', 'careShort',
    'tiredOn', 'restedOff', 'freeSlots', 'hireRoom', 'robotRoom', 'piling', 'robotWorth', 'poachHere', 'landBuyOk', 'landSellOk', 'buildUpOk',
    'repayRoom', 'topUpDue', 'trainDue', 'buildNeed', 'crewGap', 'fieldNeed', 'herdNeed', 'offscreen'],
  unit: ['kind', 'state', 'onShift', 'hungry', 'tired', 'sulking', 'morale', 'phoneSoft', 'wear', 'recharges', 'jams', 'overheats', 'mistakes',
    'gradeD2', 'funnyWorth', 'weak', 'richUp', 'upgradeBest', 'qualityBest', 'canCharge', 'canUnjam', 'contrib'],
  building: ['prodReady', 'prodIdle'],
};
// The manager's rules as DATA rows (one generic evaluator: D.gmCandidates). A row fires for a zone (or for each unit /
// building of it, `each`) when `metric op value` and every `and` triple hold.
//  group: care | ops (paid from the care wallet) | trade | capital (growth) — also picks styleMul; licence: the licence
//  group it needs (hr / assign free; beans / land / credit bought; topUp always); urgency: a GM.urgency band; act: the
//  action it runs (an `args` builder may name the action, e.g. the best upgrade); args / cost / valueOf / sale: names
//  of the planner's fixed builder vocabulary (derive.js RULE_ARGS / RULE_COST / RULE_VALUE); ticks: the condition
//  must hold that many thinks in a row; offscreen: also runs for the zone not on screen (care + trade only); style:
//  only for these manager styles; kind: the inbox task kind when it is filed; noFile: never filed (the inbox already
//  has a task for it); reason: hud.gm.r.<reason>.
export const GM_RULES = [
  // trade (Hạt)
  { key: 'sellFull', group: 'trade', licence: 'beans', zone: 'farm', metric: 'storagePct', op: '>=', value: GM.planRules.storageFull, and: [['saleBlocked', '==', false]], urgency: 'storage',
    act: 'farm/sellAll', args: 'storage', cost: 'none', valueOf: 'sale', sale: 'storageValue', offscreen: true, reason: 'storageFull' },
  { key: 'sellSome', group: 'trade', licence: 'beans', zone: 'farm', metric: 'storagePct', op: '>=', value: GM.planRules.storageFull, and: [['saleBlocked', '==', true]], urgency: 'storage',
    act: 'farm/sell', args: 'sellUnderHigh', cost: 'none', valueOf: 'sale', sale: 'arg', offscreen: true, reason: 'sellSome' },
  { key: 'sellCare', group: 'trade', licence: 'beans', zone: 'farm', metric: 'careShort', op: '==', value: true, and: [['storageValue', '>', 0], ['saleBlocked', '==', false]], urgency: 'blocking',
    act: 'farm/sellAll', args: 'storage', cost: 'none', valueOf: 'sale', sale: 'storageValue', offscreen: true, reason: 'sellForCare' },
  { key: 'beans', group: 'trade', licence: 'beans', zone: 'shop', metric: 'beansLow', op: '==', value: true, urgency: 'orders',
    act: 'shop/buyBeans', args: 'beanPack', cost: 'arg', valueOf: 'orders', offscreen: true, reason: 'beansLow' },
  // robots (Nhân sự, care wallet)
  { key: 'recharge', group: 'care', licence: 'hr', zone: 'any', each: 'robot', metric: 'state', op: '==', value: 'battery', urgency: 'blocking',
    act: 'staff/care', care: 'recharge', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'robotBattery' },
  { key: 'knock', group: 'ops', licence: 'hr', zone: 'any', each: 'robot', metric: 'state', op: '==', value: 'jam', urgency: 'blocking',
    act: 'staff/care', care: 'knock', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'robotJam' },
  { key: 'cool', group: 'care', licence: 'hr', zone: 'any', each: 'robot', metric: 'state', op: '==', value: 'overheat', urgency: 'blocking',
    act: 'staff/care', care: 'cool', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'robotHot' },
  { key: 'service', group: 'care', licence: 'hr', zone: 'any', each: 'robot', metric: 'wear', op: '<', value: ROBOT_WEAR.lowWear, urgency: 'morale',
    act: 'staff/care', care: 'service', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'robotWorn' },
  // workers (Nhân sự, care wallet)
  { key: 'nag', group: 'ops', licence: 'hr', zone: 'any', each: 'worker', metric: 'state', op: '==', value: 'phone', and: [['phoneSoft', '==', false]], urgency: 'blocking',
    act: 'staff/care', care: 'nag', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'phone' },
  { key: 'bonusSmall', group: 'care', licence: 'hr', zone: 'any', each: 'worker', metric: 'state', op: '==', value: 'phone', and: [['phoneSoft', '==', true]], urgency: 'blocking',
    act: 'staff/care', care: 'bonusSmall', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'phoneLowMorale' },
  { key: 'lunch', group: 'ops', licence: 'hr', zone: 'any', each: 'worker', metric: 'hungry', op: '==', value: true, and: [['onShift', '==', true]], style: ['careful'], urgency: 'morale',
    act: 'staff/care', care: 'lunch', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'hungryLunch' },
  // café (balance pass 2026-11-08): a demand-bound café loses almost nothing while a barista eats for 60 s, so every
  // style sends a hungry café worker to the free lunch; paid food stays the farm's choice (a missed harvest costs)
  { key: 'lunchShop', group: 'ops', licence: 'hr', zone: 'shop', each: 'worker', metric: 'hungry', op: '==', value: true, and: [['onShift', '==', true]], style: ['balanced', 'bold'], urgency: 'morale',
    act: 'staff/care', care: 'lunch', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'hungryLunch' },
  { key: 'food', group: 'care', licence: 'hr', zone: 'farm', each: 'worker', metric: 'hungry', op: '==', value: true, and: [['onShift', '==', true]], style: ['balanced', 'bold'], urgency: 'morale',
    act: 'staff/care', care: 'food', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'hungry' },
  { key: 'coffee', group: 'care', licence: 'hr', zone: 'any', each: 'worker', metric: 'tired', op: '==', value: true, and: [['onShift', '==', true]], urgency: 'morale',
    act: 'staff/care', care: 'coffee', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'tired' },
  { key: 'bonus', group: 'care', licence: 'hr', zone: 'any', each: 'worker', metric: 'sulking', op: '==', value: true, and: [['onShift', '==', true]], urgency: 'blocking',
    act: 'staff/care', care: 'bonus', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'sulking' },
  // shifts and production (Giao việc)
  { key: 'shift', group: 'ops', licence: 'assign', zone: 'any', metric: 'tiredOn', op: '==', value: true, and: [['restedOff', '==', true]], urgency: 'morale',
    act: 'staff/swapShift', args: 'zone', cost: 'none', valueOf: 'none', reason: 'swapShift' },
  { key: 'active', group: 'ops', licence: 'assign', zone: 'any', metric: 'restedOff', op: '==', value: true, and: [['freeSlots', '>', 0], ['tiredOn', '==', false]], urgency: 'idlePlots',
    act: 'staff/setActive', args: 'restedBench', cost: 'none', valueOf: 'arg', reason: 'toShift' },
  { key: 'collect', group: 'ops', licence: 'assign', zone: 'farm', each: 'building', metric: 'prodReady', op: '==', value: true, urgency: 'orders',
    act: 'prod/collect', args: 'building', cost: 'none', valueOf: 'prod', reason: 'prodReady' },
  { key: 'produce', group: 'ops', licence: 'assign', zone: 'farm', each: 'building', metric: 'prodIdle', op: '==', value: true, urgency: 'idlePlots',
    act: 'prod/start', args: 'building', cost: 'prodFee', valueOf: 'prod', reason: 'prodIdle' },
  // people (Nhân sự, growth budget)
  { key: 'keep', group: 'capital', licence: 'hr', zone: 'any', metric: 'poachHere', op: '==', value: true, urgency: 'blocking', noFile: true, kind: 'care',
    act: 'staff/keep', args: 'poached', cost: 'arg', valueOf: 'arg', reason: 'keepWorker' },
  { key: 'hire', group: 'capital', licence: 'hr', zone: 'any', metric: 'piling', op: '>=', value: GM.planRules.hirePiling, and: [['hireRoom', '>', 0]], ticks: 2, urgency: 'growth',
    act: 'staff/recruit', args: 'bestApplicant', cost: 'arg', valueOf: 'arg', reason: 'hire' },
  { key: 'hireRobot', group: 'capital', licence: 'hr', zone: 'any', metric: 'piling', op: '>=', value: GM.planRules.hirePiling, and: [['hireRoom', '>', 0], ['robotRoom', '>', 0], ['robotWorth', '>=', 0]], ticks: 2, urgency: 'growth',
    act: 'staff/hire', args: 'robotType', cost: 'arg', valueOf: 'arg', reason: 'hireRobot' },
  { key: 'upgrade', group: 'capital', licence: 'hr', zone: 'any', each: 'unit', metric: 'upgradeBest', op: '>', value: 0, urgency: 'growth',
    act: 'staff/upgradeStat', args: 'bestUpgrade', cost: 'arg', valueOf: 'arg', reason: 'upgrade' },
  { key: 'quality', group: 'capital', licence: 'hr', zone: 'any', each: 'unit', metric: 'mistakes', op: '>=', value: GM.value.qualityMistakes, and: [['qualityBest', '>', 0]], urgency: 'cosmetic',
    act: 'staff/upgradeStat', args: 'bestQuality', cost: 'arg', valueOf: 'arg', reason: 'quality' },
  { key: 'autoCharge', group: 'capital', licence: 'hr', zone: 'any', each: 'robot', metric: 'recharges', op: '>=', value: GM.planRules.softRepeats, and: [['canCharge', '==', true]], urgency: 'growth',
    act: 'staff/buySoftware', pack: 'autoCharge', args: 'software', cost: 'arg', valueOf: 'arg', reason: 'robotSoftCharge' },
  { key: 'autoUnjam', group: 'capital', licence: 'hr', zone: 'any', each: 'robot', metric: 'jams', op: '>=', value: GM.planRules.softRepeats, and: [['canUnjam', '==', true]], urgency: 'growth',
    act: 'staff/buySoftware', pack: 'autoUnjam', args: 'software', cost: 'arg', valueOf: 'arg', reason: 'robotSoftJam' },
  { key: 'funnyPayW', group: 'care', licence: 'hr', zone: 'farm', each: 'worker', metric: 'state', op: '==', value: 'funny', and: [['funnyWorth', '==', true]], urgency: 'blocking',
    act: 'staff/care', care: 'settle', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'funnyPay' },
  { key: 'funnyPayR', group: 'care', licence: 'hr', zone: 'farm', each: 'robot', metric: 'state', op: '==', value: 'funny', and: [['funnyWorth', '==', true]], urgency: 'blocking',
    act: 'staff/care', care: 'settle', args: 'care', cost: 'care', valueOf: 'contrib', offscreen: true, reason: 'funnyPay' },
  { key: 'funnyFireW', group: 'capital', licence: 'hr', zone: 'farm', each: 'worker', metric: 'state', op: '==', value: 'funny', and: [['funnyWorth', '==', false]], urgency: 'blocking', kind: 'staffGrowth',
    act: 'staff/fire', args: 'unit', cost: 'none', valueOf: 'none', reason: 'funnyFire' },
  { key: 'funnyFireR', group: 'capital', licence: 'hr', zone: 'farm', each: 'robot', metric: 'state', op: '==', value: 'funny', and: [['funnyWorth', '==', false]], urgency: 'blocking', kind: 'staffGrowth',
    act: 'staff/fire', args: 'unit', cost: 'none', valueOf: 'none', reason: 'funnyFire' },
  // Growth (farm-crew.md §11): a trade the farm has work for but nobody covers → hire it; every field planted or more hands
  // than the land can feed → add a field (or, when none fits, the next lot).
  { key: 'crewHire', group: 'capital', licence: 'hr', zone: 'farm', metric: 'crewGap', op: '==', value: true, urgency: 'growth',
    act: 'staff/recruit', args: 'crewHire', cost: 'arg', valueOf: 'arg', reason: 'crewHire' },
  { key: 'fieldBuy', group: 'capital', licence: 'land', zone: 'farm', each: 'fieldSpot', metric: 'ok', op: '==', value: true, urgency: 'growth', kind: 'land',
    act: 'build/place', args: 'fieldNeed', cost: 'arg', valueOf: 'arg', reason: 'fieldBuy' },
  { key: 'herdBuy', group: 'capital', licence: 'hr', zone: 'farm', metric: 'herdNeed', op: '==', value: true, urgency: 'cosmetic', kind: 'land',
    act: 'build/place', args: 'herdNeed', cost: 'arg', valueOf: 'arg', reason: 'herdBuy' },
  { key: 'richUp', group: 'capital', licence: 'hr', zone: 'farm', each: 'unit', metric: 'richUp', op: '>', value: 0, urgency: 'growth',
    act: 'staff/upgradeStat', args: 'richUp', cost: 'arg', valueOf: 'arg', reason: 'richUp' },
  { key: 'replaceWeak', group: 'capital', licence: 'hr', zone: 'farm', each: 'worker', metric: 'weak', op: '==', value: true, urgency: 'morale', kind: 'staffGrowth',
    act: 'staff/fire', args: 'weakUnit', cost: 'none', valueOf: 'none', reason: 'replaceWeak' },
  { key: 'crewBuild', group: 'capital', licence: 'hr', zone: 'farm', each: 'buildItem', metric: 'ok', op: '==', value: true, urgency: 'orders',
    act: 'build/place', args: 'buildNeed', cost: 'arg', valueOf: 'arg', reason: 'crewBuild' },
  { key: 'fire', group: 'capital', licence: 'hr', zone: 'any', each: 'worker', metric: 'gradeD2', op: '==', value: true, urgency: 'cosmetic', kind: 'staffGrowth',
    act: 'staff/fire', args: 'unit', cost: 'none', valueOf: 'none', reason: 'fireD' },
  { key: 'train', group: 'capital', licence: 'hr', zone: 'any', metric: 'trainDue', op: '==', value: true, urgency: 'growth', kind: 'staffGrowth',
    act: 'gm/train', args: 'train', cost: 'arg', valueOf: 'arg', reason: 'train' },
  // land and buildings (Đất & xây)
  { key: 'landBuy', group: 'capital', licence: 'land', zone: 'farm', metric: 'landBuyOk', op: '==', value: true, urgency: 'growth', kind: 'land',
    act: 'land/buyParcel', args: 'landBuy', cost: 'arg', valueOf: 'arg', reason: 'landBuy' },
  { key: 'landSell', group: 'capital', licence: 'land', zone: 'farm', metric: 'landSellOk', op: '==', value: true, urgency: 'cosmetic', kind: 'land',
    act: 'land/sell', args: 'landSell', cost: 'none', valueOf: 'arg', reason: 'landSell' },
  { key: 'buildUp', group: 'capital', licence: 'land', zone: 'farm', metric: 'buildUpOk', op: '==', value: true, urgency: 'growth', kind: 'land',
    act: 'build/upgrade', args: 'buildUp', cost: 'arg', valueOf: 'arg', reason: 'buildUp' },
  // credit (Tín dụng) and the real-money proposal (always a task, the player pays)
  { key: 'repay', group: 'capital', licence: 'credit', zone: 'any', metric: 'repayRoom', op: '>', value: 0, urgency: 'cosmetic', kind: 'loan',
    act: 'loan/repay', args: 'repay', cost: 'arg', valueOf: 'none', reason: 'repay' },
  { key: 'topUp', group: 'capital', licence: 'topUp', zone: 'any', metric: 'topUpDue', op: '==', value: true, urgency: 'cosmetic', kind: 'topUp',
    act: 'gm/topUpSeen', args: 'none', cost: 'none', valueOf: 'none', reason: 'topUp' },
];
