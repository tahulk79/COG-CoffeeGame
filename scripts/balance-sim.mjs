// Balance simulation: drives the real farm model (src/features/farm/model.js) with a scripted "typical player".
// Usage: node scripts/balance-sim.mjs [minutes]   (NOFERT=1 to skip fertilizer, EVENTS=1 to print the unlock timeline,
//   BARISTAS=0..3: hire that many baristas (Vy, Khoa, Phát) each café shift when coins allow (wage + 100 reserve),
//   BREW=mix|hand|quick: mix = first cup of each drink by hand, then ⚡ Pha nhanh (default); hand = always by hand; quick = Pha nhanh only)
// Café formulas mirror src/features/cafe/service.js (guest spacing, shift goal) for a player with no staff (synced 04/11/2026).
import { createFarm } from '../src/features/farm/model.js';
import { plotCare, CROPS, FIELDS } from '../src/features/farm/content.js';
import { RECIPES, lockReason, SUPPLIES, GEAR, QUICK_MS, quickScore, stars, cafeRank, resolveUses, candidateById, roleOf, staffEffects, staffWage, STAR_CAP } from '../src/features/cafe/recipes.js';
import { assetValue, ASSETS, upgradePrice, ORDERS_PER_DAY } from '../src/features/farm/rules.js';
import { TABLES, INDOOR_TABLES, shiftGoal, arrivalGap, brewForce } from '../src/features/cafe/service.js';

const MINUTES = Number(process.argv[2] || 60);
const BREW = process.env.BREW || 'mix', BARISTAS = ['vy', 'khoa', 'phat'].slice(0, Number(process.env.BARISTAS || 0));
const HAND_SECONDS = 30, HAND_SCORE = 82; // service.js: alone the player brews a cup by hand in ~25–35 s; assumed hand score
const QUICK_SECONDS = QUICK_MS / 1000 + 4; // Pha nhanh wait + carrying the cup (assumed 4 s)
const FARM_PHASE = 360, CAFE_PHASE = 240; // player alternates: 6 min farm, then one 4 min café shift
let t = 1_700_000_000_000;
const farm = createFarm(null, 'capital', () => {}, t);
// The model pays café wages itself when a paid shift runs out (model.js advance), inside whatever act runs next:
// read them from the ledger so they land in spend.wages, not in that act's bucket.
const seenLedger = new WeakSet();
let wagesInAct = 0;
const act = (...a) => {
  const r = farm.act(a[0], a[1], a[2], t);
  for (const e of farm.peek().ledger) if (!seenLedger.has(e)) { seenLedger.add(e); if (e.type === 'wage') cafeStats.baristaShifts++; if (e.type === 'wage' && a[1] !== 'hire') { spend.wages -= e.amount; wagesInAct -= e.amount; } }
  return r;
};
const P = () => farm.peek();
const income = { market: 0, order: 0, cafe: 0, shift: 0, other: 0 }, spend = { wages: 0, seeds: 0, land: 0, supplies: 0, fertilizer: 0, upgrades: 0, gear: 0 };
const events = [];
const note = text => events.push(`${(t - start) / 60000 | 0}m: ${text}`);
const start = t;
const fieldCrop = { 'field-0': 'robusta', 'field-1': 'arabica', 'field-2': 'liberica', 'field-3': 'robusta' };
let blocked = 0, tiers = [0, 0, 0, 0], orderStats = { delivered: 0, tried: 0 };
let cafeStats = { arrived: 0, served: 0, lost: 0, beansUsed: 0, hand: 0, quick: 0, stars: [0, 0, 0, 0], lostBusy: 0, leftAtClose: 0, baristaShifts: 0, staffCups: 0 }, produced = 0, lastLevel = 1;
const counted = (bucket, key, fn) => { const before = P().coins; wagesInAct = 0; const r = fn(); const d = P().coins - before + wagesInAct; if (r.ok) (d >= 0 ? income : spend)[key] += Math.abs(d); return r; };

function farmStep() {
  const p = P();
  // Expand when affordable with a seed reserve.
  for (const f of FIELDS) if (!p.fields.includes(f.id) && p.coins >= f.price + 140) { if (counted(spend, 'land', () => act(f.id, 'expand')).ok) note(`mua ${f.id} (${f.price} xu)`); }
  for (const plot of p.plots) {
    if (!plot.unlocked) continue;
    const care = plotCare(plot), want = fieldCrop[plot.fieldId] || 'robusta', crop = CROPS.find(c => c.id === want).level <= farm.level ? want : 'robusta';
    if (care.empty) { if (!p.seeds[crop]) counted(spend, 'seeds', () => act('seed-shop', 'buySeed', { cropId: crop, quantity: 1 })); act(plot.id, 'plant', crop); continue; }
    if (care.ready) { const r = act(plot.id, 'harvest'); if (!r.ok) blocked++; continue; }
    if (care.needsWater) { if (!p.water) act('well', 'refill'); act(plot.id, 'water'); }
    if (care.needsWeeding) act(plot.id, 'weed');
    if (care.canFeed && !process.env.NOFERT) { if (!p.fertilizer) counted(spend, 'fertilizer', () => act('seed-shop', 'fertilizer', { quantity: 1 })); act(plot.id, 'fertilize'); }
  }
  for (const id of ['dryer', 'roaster']) {
    act(id, 'collect');
    const input = id === 'dryer' ? 'cherries' : 'dried';
    for (const c of CROPS) if (P().stock[input][c.id] >= (id === 'dryer' ? 600 : 100)) act(id, 'start', c.id);
  }
}
function sellAtMarket() {
  // Shop orders first: at most ORDERS_PER_DAY per work day (model.js 'order').
  for (let i = 0; i < ORDERS_PER_DAY; i++) {
    const o = P().order; // a player fills orders whenever the stock covers them (café restocks from what is left)
    if (o.product !== 'roasted' || P().stock.roasted[o.cropId] < o.quantity) break;
    orderStats.tried++; if (counted(income, 'order', () => act('market', 'order', o.id)).ok) orderStats.delivered++;
  }
  const p = P();
  // Keep 600 g of robusta/arabica for the café, sell the rest (all liberica) once per work day.
  for (const c of CROPS) {
    const keep = c.id === 'liberica' ? 0 : 600, grams = p.stock.roasted[c.id] - keep;
    if (grams > 0) counted(income, 'market', () => act('market', 'sell', { item: `roasted:${c.id}`, grams }));
    if (p.stock.cherries[c.id] > 0 && false) {}
  }
}
function buyUpgrades() {
  const p = P();
  if (p.fields.length < 4) return; // land first
  const options = [...['storage', 'dryer', 'roaster', 'cafe'].map(id => ({ id, price: upgradePrice(id, p.upgrades[id]), kind: 'upgrade' })),
    ...GEAR.filter(g => !g.group && (p.cafe.gear[g.id] || 0) < g.prices.length).map(g => ({ id: g.id, price: g.prices[p.cafe.gear[g.id] || 0], kind: 'gear' }))].sort((a, b) => a.price - b.price);
  const o = options[0];
  if (o && p.coins >= o.price + 150) {
    const r = o.kind === 'gear' ? counted(spend, 'gear', () => act('cafe', 'gear', o.id)) : counted(spend, 'upgrades', () => act(o.id, 'upgrade'));
    if (r.ok) note(`${o.kind} ${o.id} (${o.price} xu)`);
  }
}
function cafeShift() {
  for (const c of ['robusta', 'arabica', 'liberica']) if (P().cafe.stock.roasted[c] < 400 && P().stock.roasted[c] > 0) act('cafe', 'ship', c);
  if (!P().cafe.open) act('cafe', 'toggle');
  farm.setCafeActive(true); // paid staff time only runs while the café scene is active and open (model.js advance)
  // Baristas (service.js nextJob/finishJob): each brews a queued order whose drink the player has mastered to its `mastery` score.
  const onShift = id => (P().cafe.crew.find(c => c.id === id)?.paidUntil || 0) > t;
  // A paid shift is 4 min of open café time, so it can end mid-phase: re-hire then (wage + 100 reserve) or the barista stops.
  // The model renews a paid shift by itself while coins allow; the sim only hires someone not on the crew yet.
  const keepPaid = id => onShift(id) || !P().cafe.crew.some(c => c.id === id) && P().coins >= staffWage(roleOf(id), 1) + 100 && counted(spend, 'wages', () => act('cafe', 'hire', id)).ok;
  const all = BARISTAS.map(id => ({ id, e: staffEffects(candidateById(id), 1), job: null }));
  let crew = [];
  let nextArrival = 0, current = null, served = 0, queue = 0, starsSum = 0, goal = 0, playerCups = 0;
  const pick = (p, ok) => { const menu = RECIPES.filter(r => !lockReason(r, p.cafe) && ok(r)); return menu[Math.floor(Math.random() * menu.length)]; };
  // A cup needs its supplies and beans; false = the guest leaves angry.
  function make(recipe, score, staff) {
    const p = P();
    for (const [id, amount] of Object.entries(resolveUses(recipe.uses, p.cafe))) if ((p.cafe.supplies[id] || 0) < amount * 3) counted(spend, 'supplies', () => act('cafe', 'buy', id)); // milk/water brand the cup really uses
    const crop = [recipe.bean, 'robusta', 'arabica', 'liberica'].find(c => c && (P().cafe.stock.roasted[c] || 0) >= (recipe.beans || 0)); // matcha uses no beans
    const b = crop && act('cafe', 'brew', { recipeId: recipe.id, cropId: crop, score, staff, demo: false });
    if (!b?.ok) { queue--; act('cafe', 'lost', 'angry'); cafeStats.lost++; return false; }
    const cupStars = Math.min(staff ? STAR_CAP.staff : 3, stars(score));
    cafeStats.beansUsed += recipe.beans || 0;
    counted(income, 'cafe', () => act('cafe', 'sell', { recipeId: recipe.id, quality: b.quality, stars: cupStars, wait: .4, combo: staff ? 0 : 1, staff }));
    queue--; served++; if (!staff) { starsSum += cupStars; playerCups++; } cafeStats.served++; cafeStats.stars[cupStars]++; if (staff) cafeStats.staffCups++;
    return true;
  }
  for (let s = 0; s < CAFE_PHASE; s++) {
    t += 1000; farmStep();
    crew = all.filter(b => keepPaid(b.id) || (b.job = null));
    const p = P(), rep = p.cafe.reputation, tables = assetValue(ASSETS.find(a => a.id === 'cafe'), p.upgrades.cafe);
    // service.js helpers(): effective hands H and menu coverage C (the sim has no station gear check beyond gear.station).
    const { H, C } = brewForce(crew.map(b => b.e), p.cafe.mastery, RECIPES.filter(r => !lockReason(r, p.cafe)).map(r => r.id), 1 + (p.cafe.gear.station || 0), p.cafe.gear.autoEspresso);
    if (s === 0) goal = shiftGoal(cafeRank(p.cafe.reputation), H);
    const tableCount = tables + (p.cafe.gear.terrace ? TABLES.length - INDOOR_TABLES : 0); // service.js tableCount
    if ((nextArrival -= 1) <= 0) { nextArrival = arrivalGap(H, C, rep, tableCount, p.cafe.gear.kiosk || 0) * (.75 + Math.random() * .5); queue++; cafeStats.arrived++; }
    if (queue > 6) { queue--; act('cafe', 'lost', 'busy'); cafeStats.lost++; cafeStats.lostBusy++; }
    for (const b of crew) {
      if (!b.job && queue - (current ? 1 : 0) - crew.filter(o => o.job).length > 0) { const recipe = pick(p, r => (p.cafe.mastery[r.id]?.best || 0) >= b.e.mastery); if (recipe) b.job = { recipe, left: b.e.ms / 1000 }; }
      if (b.job && (b.job.left -= 1) <= 0) { make(b.job.recipe, b.job.score ?? b.e.score, true); b.job = null; }
    }
    if (queue - crew.filter(o => o.job).length > 0 && !current) {
      const recipe = pick(p, () => true);
      const best = p.cafe.mastery[recipe.id]?.best || 0, hand = BREW === 'hand' || BREW === 'mix' && best < HAND_SCORE;
      current = { recipe, hand, left: hand ? HAND_SECONDS : QUICK_SECONDS, score: hand ? HAND_SCORE : quickScore(best) };
      if (hand) cafeStats.hand++; else cafeStats.quick++;
    }
    if (current && (current.left -= 1) <= 0) {
      const { recipe, score } = current; current = null;
      make(recipe, score, false);
    }
  }
  cafeStats.leftAtClose += queue; // guests still queued when the shift ends (not charged to reputation in the sim)
  tiers[counted(income, 'shift', () => act('cafe', 'shift', { served, goal, avg: playerCups ? starsSum / playerCups : 2 })).tier || 0]++; // D2 (service.js shiftAvg): average over the player's own cups; none brewed → judged on count only
  if (P().cafe.open) act('cafe', 'toggle');
  farm.setCafeActive(false);
}

const rows = [];
let phaseClock = 0;
while (t - start < MINUTES * 60000) {
  if (phaseClock < FARM_PHASE) { t += 1000; phaseClock++; farmStep(); if (phaseClock % 360 === 0) sellAtMarket(); buyUpgrades(); }
  else { cafeShift(); phaseClock = 0; }
  const minute = (t - start) / 60000;
  if (farm.level !== lastLevel) { note(`lên cấp ${farm.level}`); lastLevel = farm.level; }
  if (Number.isInteger(minute) && minute % 5 === 0 && rows.at(-1)?.min !== minute) {
    const p = P(); rows.push({ min: minute, coins: Math.round(p.coins), level: farm.level, fields: p.fields.length, rep: Math.round(p.cafe.reputation), roastedFarm: Object.values(p.stock.roasted).reduce((a, b) => a + b, 0), served: cafeStats.served });
  }
}
console.table(rows);
const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
const net=Object.values(income).reduce((a,b)=>a+b,0)-Object.values(spend).reduce((a,b)=>a+b,0);
console.log('income', JSON.stringify(round(income)), 'spend', JSON.stringify(round(spend)), 'net', Math.round(net), 'coinsEnd', Math.round(P().coins), 'level', farm.level, 'harvested', P().stats.harvested);
console.log('per hour', Math.round(Object.values(income).reduce((a, b) => a + b, 0) / MINUTES * 60), 'tiers none/bronze/silver/gold', tiers.join('/'), 'orders', JSON.stringify(orderStats), 'rep', Math.round(P().cafe.reputation));
console.log('cafe', cafeStats, 'beans used by café (g)', cafeStats.beansUsed, 'farm roasted delivered (g)', P().stats.delivered);
const st=P().stock,sum=o=>Object.values(o).reduce((a,b)=>a+b,0);console.log('blockedHarvestTries',blocked,'storage',farm.storageCapacity,'cherries',sum(st.cherries),'dried',sum(st.dried),'roasted',sum(st.roasted),'up',JSON.stringify(P().upgrades));
if(process.env.EVENTS)console.log(events.join('\n'));
