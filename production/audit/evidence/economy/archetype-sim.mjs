// Audit-only archetype simulation (does not modify game code). Drives the REAL farm model with a fake clock.
// Usage: node production/audit/evidence/economy/archetype-sim.mjs [archetype|all] [days=30]
// Café arrivals/goal copy cafe/service.js formulas (service.js:441, :501). Player action costs and brew time are
// assumptions (AI heuristic), listed in CFG. Crew AI (crew.js) and café staff agents are NOT simulated.
import { createFarm } from '../../../../src/features/farm/model.js';
import { plotCare, CROPS, FIELDS, MACHINES, PLOTS } from '../../../../src/features/farm/content.js';
import { RECIPES, lockReason, GEAR, TABLE_LEVELS, MAX_TABLES, cafeRank, stars as starsOf } from '../../../../src/features/cafe/recipes.js';
import { assetValue, ASSETS, upgradePrice, assetMaxLevel, upgradeRequirement } from '../../../../src/features/farm/rules.js';

const H = 3600000, MIN = 60000;
// sessions: list of [startHourOfDay, minutes]; days: which days (1-based) the player shows up.
const ALL_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const CFG = {
  casual:    { sessions: [[20, 10]], days: ALL_DAYS, brew: 35, score: 75, sell: 'market', upgrades: 'cheap', prune: false },
  regular:   { sessions: [[20, 30]], days: ALL_DAYS, brew: 30, score: 80, sell: 'market', upgrades: 'cheap', prune: false },
  engaged:   { sessions: [[8, 30], [13, 30], [20, 30]], days: ALL_DAYS, brew: 25, score: 85, sell: 'market', upgrades: 'cheap', prune: true },
  minmax:    { sessions: [[8, 30], [13, 30], [20, 30]], days: ALL_DAYS, brew: 20, score: 92, sell: 'shopOrder', upgrades: 'roi', prune: true, liberica: true },
  rich:      { sessions: [[20, 30]], days: ALL_DAYS, brew: 30, score: 80, sell: 'market', upgrades: 'all', prune: false, startCoins: 1_000_000 },
  irregular: { sessions: [[20, 30]], days: [1, 2, 5, 6, 10, 14, 15, 21, 28, 30], brew: 30, score: 80, sell: 'market', upgrades: 'cheap', prune: false },
};
// Player action time = work duration (model.workDuration bases) + walk; walk ≈ 2 s per action (AI heuristic).
const WALK = 2, ACT = { harvest: 2.5, water: 1.8, weed: 2.2, fertilize: 1.8, plant: 2.2, prune: 2.5, refill: 1.5 + 4, collect: 1.5, start: 1.5, shop: 6, expand: 4 };
const PATIENCE_TOTAL = 90; // s a solo guest waits from arrival to cup (queue 55 + part of seated 80; AI heuristic)
const FARM_PHASE = 360, CAFE_PHASE = 240;
let rng = 12345; const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;

function run(name, DAYS) {
  const cfg = { ...CFG[name], ...(process.env.BREW ? { brew: Number(process.env.BREW) } : {}) }; rng = 12345;
  const start = Date.UTC(2026, 0, 1, 0, 0, 0); let t = start;
  const farm = createFarm(null, 'capital', () => {}, t);
  const P = () => farm.peek();
  if (cfg.startCoins) P().coins = cfg.startCoins; // audit hack for the "rich" archetype only
  const income = { market: 0, shopOrder: 0, cafe: 0, shift: 0, quest: 0 }, spend = { seeds: 0, fert: 0, land: 0, upgrades: 0, gear: 0, tables: 0, supplies: 0, ship: 0, supplier: 0 };
  let invested = 0, playedMin = 0; const events = [], snaps = [];
  const stat = { cupsServed: 0, cupsLost: 0, shifts: 0, tiers: [0, 0, 0, 0], harvests: 0, shopOrders: 0 };
  const note = txt => events.push({ min: Math.round(playedMin * 10) / 10, day: Math.floor((t - start) / (24 * H)) + 1, txt });
  const act = (id, action, choice, bucket, side) => {
    const before = P().coins, xpBefore = P().xp, r = farm.act(id, action, choice, t), d = Math.round((P().coins - before) * 100) / 100;
    if (r.ok) {
      const q = r.quests?.length ? r.quests.length : 0;
      if (bucket && side === 'in') income[bucket] += d; else if (bucket) { spend[bucket] -= d; if (['land', 'upgrades', 'gear', 'tables'].includes(bucket)) invested -= d; }
      if (q) { /* quest coins are folded into the action's delta above; tracked separately below */ }
    }
    return r;
  };
  // quest coins: read once from claimed list growth
  let claimedCount = 0;
  const questSync = () => { const c = P().claimed.length; if (c > claimedCount) claimedCount = c; };
  let lastLevel = 1, unlockedRecipes = new Set(RECIPES.filter(r => !lockReason(r, P().cafe)).map(r => r.id));
  const checkUnlocks = () => {
    if (farm.level !== lastLevel) { note(`cấp ${farm.level}`); lastLevel = farm.level; }
    for (const r of RECIPES) if (!unlockedRecipes.has(r.id) && !lockReason(r, P().cafe)) { unlockedRecipes.add(r.id); note(`mở món ${r.id}`); }
  };
  let busy = 0;
  const wantCrop = plot => {
    const lv = farm.level;
    if (cfg.liberica && lv >= 3) return 'liberica';
    const map = { 'field-0': 'robusta', 'field-1': 'arabica', 'field-2': 'liberica', 'field-3': 'robusta' };
    const c = map[PLOTS.find(x => x.id === plot.id).fieldId]; return CROPS.find(x => x.id === c).level <= lv ? c : 'robusta';
  };
  function farmSecond() {
    t += 1000; playedMin += 1 / 60;
    if (busy > 0) { busy--; farm.tick(t); return; }
    const p = P();
    for (const f of FIELDS) if (!p.fields.includes(f.id) && farm.canExpand(f.id) && p.coins >= f.price + (cfg.startCoins ? 0 : 60)) {
      if (act(f.id, 'expand', null, 'land').ok) { note(`mua ${f.id} ${f.price}`); busy += ACT.expand; return; }
    }
    for (const m of MACHINES) {
      const s = p.machines[m.id], jobs = [s.batch, ...s.extraBatches].filter(Boolean);
      if (jobs.some(j => j.readyAt <= t)) { act(m.id, 'collect'); busy += ACT.collect + WALK; return; }
      const crop = CROPS.find(c => p.stock[m.input][c.id] >= m.inputCount);
      if (crop && jobs.length < 48) { act(m.id, 'start', crop.id); busy += ACT.start + WALK; return; }
    }
    const plots = p.plots.filter(x => x.unlocked);
    const pick = (fn) => plots.find(x => fn(plotCare(x), x));
    let x;
    if ((x = pick(c => c.ready))) { if (act(x.id, 'harvest').ok) { stat.harvests++; busy += ACT.harvest + WALK; return; } }
    if ((x = pick(c => c.empty))) {
      const crop = wantCrop(x);
      if (!p.seeds[crop]) { const n = plots.filter(y => plotCare(y).empty).length; const q = Math.max(1, Math.min(n, Math.floor(p.coins / CROPS.find(c => c.id === crop).seedPrice))); if (!act('seed-shop', 'buySeed', { cropId: crop, quantity: q }, 'seeds').ok) return; busy += ACT.shop; return; }
      act(x.id, 'plant', crop); busy += ACT.plant + WALK; return;
    }
    if ((x = pick(c => c.needsWater))) { if (!p.water) { act('well', 'refill'); busy += ACT.refill; return; } if (act(x.id, 'water').ok) { busy += ACT.water + WALK; return; } }
    if ((x = pick(c => c.needsWeeding))) { act(x.id, 'weed'); busy += ACT.weed + WALK; return; }
    if ((x = pick(c => c.canFeed))) { if (!p.fertilizer) { if (act('seed-shop', 'fertilizer', { quantity: 10 }, 'fert').ok) busy += ACT.shop; return; } act(x.id, 'fertilize'); busy += ACT.fertilize + WALK; return; }
    if (cfg.prune && (x = plots.find(y => y.mature && y.stage !== 'ready' && !y.pruned && y.growthMs / CROPS.find(c => c.id === y.cropId).regrowMs <= .17))) { act(x.id, 'prune'); busy += ACT.prune + WALK; return; }
    farm.tick(t);
  }
  function sell() {
    const p = P(), keep = { robusta: 600, arabica: 600, liberica: 300 };
    if (cfg.sell === 'shopOrder') {
      for (let i = 0; i < 500; i++) { const o = P().order; if (P().stock.roasted[o.cropId] - (keep[o.cropId] || 0) < o.quantity) break; if (!act('market', 'order', o.id, 'shopOrder', 'in').ok) break; stat.shopOrders++; }
    }
    for (const c of CROPS) { const g = P().stock.roasted[c.id] - keep[c.id]; if (g > 0) act('market', 'sell', { item: `roasted:${c.id}`, grams: g }, 'market', 'in'); }
  }
  function buy() {
    const p = P(), lv = farm.level, reserve = cfg.startCoins ? 0 : 150;
    if (p.fields.length < 4 && !cfg.startCoins) return;
    const opts = [];
    for (const a of ASSETS) { const l = p.upgrades[a.id]; if (l < assetMaxLevel(a) && lv >= upgradeRequirement(l + 1)) opts.push({ kind: 'up', id: a.id, price: upgradePrice(a.id, l) }); }
    for (const g of GEAR) { const l = p.cafe.gear[g.id] || 0; if (l < g.prices.length) opts.push({ kind: 'gear', id: g.id, price: g.prices[l], group: g.group }); }
    const indoor = assetValue(ASSETS.find(a => a.id === 'cafe'), p.upgrades.cafe);
    for (let i = 0; i < MAX_TABLES; i++) { const open = i < 10 ? i < indoor : p.cafe.gear.terrace > 0; const l = p.cafe.tables[i]; if (open && l < TABLE_LEVELS.length) opts.push({ kind: 'table', id: i, price: TABLE_LEVELS[l].price }); }
    let pool = opts;
    if (cfg.upgrades === 'cheap') pool = opts.filter(o => (o.kind === 'up' && ['storage', 'dryer', 'roaster', 'cafe'].includes(o.id)) || (o.kind === 'gear' && !o.group));
    if (cfg.upgrades === 'roi') pool = opts.filter(o => (o.kind === 'gear' && (!o.group || o.id === 'roastery')) || (o.kind === 'up' && (o.id === 'cafe' || (o.id === 'roaster' && p.upgrades.roaster < 2))));
    if (process.env.NOCAFEUP) pool = pool.filter(o => !(o.kind === 'up' && o.id === 'cafe') && o.kind !== 'table');
    pool.sort((a, b) => a.price - b.price);
    for (const o of pool) {
      if (P().coins < o.price + reserve) break;
      const r = o.kind === 'gear' ? act('cafe', 'gear', o.id, 'gear') : o.kind === 'table' ? act('cafe', 'table', o.id, 'tables') : act(o.id, 'upgrade', null, 'upgrades');
      if (r.ok) note(`${o.kind} ${o.id} ${o.price}`);
      if (cfg.upgrades !== 'all') break;
    }
  }
  function cafeShift() {
    const p = P();
    for (const c of CROPS) if (p.cafe.stock.roasted[c.id] < 400 && P().stock.roasted[c.id] > 0) act('cafe', 'ship', c.id, 'ship');
    farm.setCafeActive(true); if (!P().cafe.open) act('cafe', 'toggle');
    const menu0 = RECIPES.filter(r => !lockReason(r, P().cafe)), special = menu0[Math.floor(rand() * menu0.length)].id;
    const rep0 = P().cafe.reputation, goal = 4 + cafeRank(rep0); // helpers = 0 (no staff simulated)
    let spawnIn = 3, brewing = 0, combo = 0, served = 0, starsSum = 0; const queue = [];
    for (let s = 0; s < CAFE_PHASE; s++) {
      t += 1000; playedMin += 1 / 60; farm.tick(t);
      const q = P(), rep = q.cafe.reputation, tables = assetValue(ASSETS.find(a => a.id === 'cafe'), q.upgrades.cafe) + (q.cafe.gear.terrace ? 2 : 0);
      if ((spawnIn -= 1) <= 0) {
        spawnIn = Math.max(3, Math.min(24, 9 + 13 - (rep - 50) * .06 - tables * .6 - (q.cafe.gear.kiosk || 0))) * (.75 + rand() * .5);
        if (queue.length >= 7) { act('cafe', 'lost', 'busy'); stat.cupsLost++; }
        else { const menu = RECIPES.filter(r => !lockReason(r, q.cafe)), w = menu.flatMap(r => r.id === special ? [r, r, r] : [r]); queue.push({ at: s, recipe: w[Math.floor(rand() * w.length)] }); }
      }
      while (queue.length && s - queue[0].at > PATIENCE_TOTAL) { queue.shift(); act('cafe', 'lost', 'angry'); stat.cupsLost++; combo = 0; brewing = 0; }
      if (queue.length && ++brewing >= cfg.brew) {
        brewing = 0; const c = queue.shift(), recipe = c.recipe;
        for (const [id, n] of Object.entries(recipe.uses)) if ((P().cafe.supplies[id] || 0) < n * 2) act('cafe', 'buy', id, 'supplies');
        const crop = [recipe.bean, 'robusta', 'arabica', 'liberica'].find(x => (P().cafe.stock.roasted[x] || 0) >= recipe.beans);
        if (!crop) { act('cafe', 'lost', 'angry'); stat.cupsLost++; combo = 0; continue; }
        const b = act('cafe', 'brew', { recipeId: recipe.id, cropId: crop, score: cfg.score });
        if (!b.ok) { act('cafe', 'lost', 'angry'); stat.cupsLost++; combo = 0; continue; }
        const st = starsOf(cfg.score);
        act('cafe', 'sell', { recipeId: recipe.id, quality: b.quality, stars: st, wait: Math.min(1, (s - c.at) / PATIENCE_TOTAL), combo, special: recipe.id === special }, 'cafe', 'in');
        combo = st >= 2 ? Math.min(5, combo + 1) : 0; served++; starsSum += st; stat.cupsServed++;
      }
    }
    const r = act('cafe', 'shift', { served, goal, avg: served ? starsSum / served : 0 }, 'shift', 'in');
    stat.shifts++; stat.tiers[r.tier || 0]++;
    if (P().cafe.open) act('cafe', 'toggle'); farm.setCafeActive(false);
  }
  const snapshot = day => {
    const p = P(), cafeUp = p.upgrades;
    snaps.push({ day, playedMin: Math.round(playedMin), coins: Math.round(p.coins), invested: Math.round(invested), net_value: Math.round(p.coins + invested), level: farm.level, rep: Math.round(p.cafe.reputation), fields: p.fields.length,
      recipes: RECIPES.filter(r => !lockReason(r, p.cafe)).length, roastedFarmG: Object.values(p.stock.roasted).reduce((a, b) => a + b, 0), served: stat.cupsServed, lost: stat.cupsLost,
      tiers: stat.tiers.join('/'), up: `d${cafeUp.dryer} r${cafeUp.roaster} s${cafeUp.storage} c${cafeUp.cafe}` });
  };
  for (let day = 1; day <= DAYS; day++) {
    const dayStart = start + (day - 1) * 24 * H;
    if (cfg.days.includes(day)) for (const [hour, minutes] of cfg.sessions) {
      const sessionStart = dayStart + hour * H; if (sessionStart > t) { t = sessionStart; farm.tick(t); }
      const end = t + minutes * MIN; let phase = 0;
      while (t < end) {
        if (phase < FARM_PHASE) { farmSecond(); phase++; if (phase === FARM_PHASE || t >= end) { sell(); buy(); } }
        else { if (end - t >= CAFE_PHASE * 1000 * .5) cafeShift(); else { while (t < end) farmSecond(); sell(); buy(); } phase = 0; }
        checkUnlocks();
      }
    }
    if ([1, 3, 7, 14, 30].includes(day) || day === DAYS) snapshot(day);
  }
  questSync();
  return { name, cfg: { ...cfg, days: cfg.days.length === 30 ? 'mỗi ngày' : cfg.days.join(',') }, snaps, income: Object.fromEntries(Object.entries(income).map(([k, v]) => [k, Math.round(v)])), spend: Object.fromEntries(Object.entries(spend).map(([k, v]) => [k, Math.round(v)])), stat, events };
}

const arg = process.argv[2] || 'all', days = Number(process.argv[3] || 30);
for (const name of arg === 'all' ? Object.keys(CFG) : [arg]) {
  const r = run(name, days);
  console.log(`\n### ${name}  ${JSON.stringify(r.cfg)}`);
  console.table(r.snaps);
  console.log('income', JSON.stringify(r.income), 'spend', JSON.stringify(r.spend));
  console.log('stat', JSON.stringify(r.stat));
  if (process.env.EVENTS) console.log(r.events.map(e => `d${e.day} ${e.min}m: ${e.txt}`).join('\n'));
}
