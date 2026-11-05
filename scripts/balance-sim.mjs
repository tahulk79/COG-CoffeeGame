// Balance simulation: drives the real farm model (src/features/farm/model.js) with a scripted "typical player".
// Usage: node scripts/balance-sim.mjs [minutes]   (NOFERT=1 to skip fertilizer, EVENTS=1 to print the unlock timeline,
//   BARISTAS=0..3: hire that many baristas (Vy, Khoa, Phát) each café shift when coins allow (wage + 100 reserve),
//   BREW=mix|hand|quick: mix = first cup of each drink by hand, then ⚡ Pha nhanh (default); hand = always by hand; quick = Pha nhanh only)
// Café formulas mirror src/features/cafe/service.js (guest spacing, shift goal) for a player with no staff (synced 04/11/2026).
// D-25 (04/11/2026) env switches, all defaults = old behaviour (the sim only reads game files, never writes them):
//   MINUTES=120      sim length (overrides argv[2])        REGION=vn|br|co|ke|id|it|jp|us   start region (default vn)
//   CARE=fert|both|prune|none   care actions the player does (default fert = old; NOFERT=1 means none). Prune is free but takes 2.5 s work (not modelled)
//   PRICE=0.8..1.3   uniform café price factor p for every recipe (F-42), set each shift while the café is closed
//   FARMONLY=1       no café at all, player stays on the farm and sells at the market every work day (automatic for farm-only regions co/ke/id)
//   PLAN=region      each plot plants the unlocked crop with the best yield*price*quality/time for REGION (default: fixed field→crop map)
//   QUIET=1          print one `SUMMARY {json}` line instead of tables (level, XP by source, income, assets, care/order/café stats)
//   XPSCALE=0.8 XPFROM=8   what-if: XP thresholds of levels >= XPFROM times XPSCALE;  MKTCAP=60   what-if: market XP cap per work day.
//     Implemented by tracking raw XP in the sim and rewriting progress.xp to the alt level's base XP after every act, so
//     level gates (crops, upgrades) follow the alt level. Quest/order/harvest XP are taken as the model gives them.
// Shop orders: orderStats.high counts deliveries paid at the 1.6x (quality >= 85) rate.
import { createFarm } from '../src/features/farm/model.js';
import { plotCare, CROPS, FIELDS, xpForLevel, questsFor } from '../src/features/farm/content.js';
import { RECIPES, lockReason, SUPPLIES, GEAR, QUICK_MS, quickScore, stars, cafeRank, resolveUses, candidateById, roleOf, staffEffects, staffWage, STAR_CAP, arrivalFactor, meanPrice } from '../src/features/cafe/recipes.js';
import { assetValue, ASSETS, upgradePrice, ORDERS_PER_DAY, regionCrop, marketQualityFactor } from '../src/features/farm/rules.js';
import { TABLES, INDOOR_TABLES, shiftGoal, arrivalGap, brewForce } from '../src/features/cafe/service.js';
import { totalAssets } from '../src/features/farm/progression.js';
import { regionType } from '../src/features/world-map/content.js';

const MINUTES = Number(process.env.MINUTES || process.argv[2] || 60), REGION = process.env.REGION || 'vn';
const CAREMODE = process.env.CARE || (process.env.NOFERT ? 'none' : 'fert'), FERT = CAREMODE === 'both' || CAREMODE === 'fert', PRUNE = CAREMODE === 'both' || CAREMODE === 'prune';
const PRICE = Number(process.env.PRICE || 1), FARMONLY = !!process.env.FARMONLY || regionType(REGION) !== 'both', QUIET = !!process.env.QUIET;
const XPSCALE = Number(process.env.XPSCALE || 1), XPFROM = Number(process.env.XPFROM || 8), MKTCAP = Number(process.env.MKTCAP || 40), ALT = !!(process.env.XPSCALE || process.env.MKTCAP);
const BREW = process.env.BREW || 'mix', BARISTAS = ['vy', 'khoa', 'phat'].slice(0, Number(process.env.BARISTAS || 0));
const HAND_SECONDS = 30, HAND_SCORE = 82; // service.js: alone the player brews a cup by hand in ~25–35 s; assumed hand score
const QUICK_SECONDS = QUICK_MS / 1000 + 4; // Pha nhanh wait + carrying the cup (assumed 4 s)
const FARM_PHASE = 360, CAFE_PHASE = 240; // player alternates: 6 min farm, then one 4 min café shift
let t = 1_700_000_000_000;
const farm = createFarm(null, 'capital', () => {}, t, [], REGION);
// The model pays café wages itself when a paid shift runs out (model.js advance), inside whatever act runs next:
// read them from the ledger so they land in spend.wages, not in that act's bucket.
const seenLedger = new WeakSet();
let wagesInAct = 0;
// XP by source (market sale XP, harvest, ...). Quest XP is split out of whatever act claimed it. ALT what-ifs: see header.
const xpBy = {}, questXp = Object.fromEntries(questsFor(REGION).map(q => [q.id, q.xp])), mktUsed = {};
let rawXp = 0;
const thr = l => xpForLevel(l) * (l >= XPFROM ? XPSCALE : 1);
const altLevel = x => { let l = 1; while (l < 999 && x >= thr(l + 1)) l++; return l; };
const act = (...a) => {
  const x0 = farm.peek().xp, c0 = P().coins, cl0 = P().claimed.length;
  const r = farm.act(a[0], a[1], a[2], t);
  for (const e of farm.peek().ledger) if (!seenLedger.has(e)) { seenLedger.add(e); if (e.type === 'wage') cafeStats.baristaShifts++; if (e.type === 'wage' && a[1] !== 'hire') { spend.wages -= e.amount; wagesInAct -= e.amount; } }
  let gain = P().xp - x0;
  const quest = P().claimed.slice(cl0).reduce((s, id) => s + (questXp[id] || 0), 0), key = a[0] === 'market' ? `market-${a[1]}` : a[0] === 'cafe' ? `cafe-${a[1]}` : a[1];
  gain -= quest; xpBy.quest = (xpBy.quest || 0) + quest;
  if (ALT) { // market XP under the what-if cap (model already capped it at 40)
    if (key === 'market-sell') { const day = P().market.day, mine = Math.min(Math.floor((P().coins - c0) / 2), MKTCAP - (mktUsed[day] || 0)); mktUsed[day] = (mktUsed[day] || 0) + Math.max(0, mine); gain = Math.max(0, mine); }
    rawXp += gain + quest; P().xp = xpForLevel(altLevel(rawXp));
  }
  if (gain) xpBy[key] = (xpBy[key] || 0) + gain;
  return r;
};
const P = () => farm.peek();
const income = { market: 0, order: 0, cafe: 0, shift: 0, other: 0 }, spend = { wages: 0, seeds: 0, land: 0, supplies: 0, fertilizer: 0, upgrades: 0, gear: 0 };
const events = [];
const note = text => events.push(`${(t - start) / 60000 | 0}m: ${text}`);
const start = t;
const fieldCrop = { 'field-0': 'robusta', 'field-1': 'arabica', 'field-2': 'liberica', 'field-3': 'robusta' };
let blocked = 0, tiers = [0, 0, 0, 0], orderStats = { delivered: 0, tried: 0, high: 0 };
let cafeStats = { arrived: 0, served: 0, lost: 0, beansUsed: 0, hand: 0, quick: 0, stars: [0, 0, 0, 0], lostBusy: 0, leftAtClose: 0, baristaShifts: 0, staffCups: 0 }, produced = 0, lastLevel = 1;
const counted = (bucket, key, fn) => { const before = P().coins; wagesInAct = 0; const r = fn(); const d = P().coins - before + wagesInAct; if (r.ok) (d >= 0 ? income : spend)[key] += Math.abs(d); return r; };

const harvest = { g: 0, qg: 0, n: 0 }; // grams harvested, quality*grams (avg lot quality = qg/g), harvests
// PLAN=region: best unlocked crop for REGION by yield * price * market-quality factor / cycle time (rules.js regionCrop).
const bestCrop = () => CROPS.filter(c => c.level <= farm.level).map(c => { const r = regionCrop(REGION, c.id); return [c.id, c.yield * r.yield * c.priceScale * marketQualityFactor(80 + r.quality) / (c.regrowMs * r.growth)]; }).sort((a, b) => b[1] - a[1])[0][0];
function farmStep() {
  const p = P();
  // Expand when affordable with a seed reserve.
  for (const f of FIELDS) if (!p.fields.includes(f.id) && p.coins >= f.price + 140) { if (counted(spend, 'land', () => act(f.id, 'expand')).ok) note(`mua ${f.id} (${f.price} xu)`); }
  for (const plot of p.plots) {
    if (!plot.unlocked) continue;
    const care = plotCare(plot), want = process.env.PLAN === 'region' ? bestCrop() : fieldCrop[plot.fieldId] || 'robusta', crop = CROPS.find(c => c.id === want).level <= farm.level ? want : 'robusta';
    if (care.empty) { if (!p.seeds[crop]) counted(spend, 'seeds', () => act('seed-shop', 'buySeed', { cropId: crop, quantity: 1 })); act(plot.id, 'plant', crop); continue; }
    if (care.ready) { const q = plot.quality, g = plot.readyYield, r = act(plot.id, 'harvest'); if (!r.ok) blocked++; else { harvest.g += g; harvest.qg += q * g; harvest.n++; } continue; }
    if (care.needsWater) { if (!p.water) act('well', 'refill'); act(plot.id, 'water'); }
    if (care.needsWeeding) act(plot.id, 'weed');
    if (PRUNE && plot.mature && !plot.pruned && care.ratio <= .17) act(plot.id, 'prune'); // model only allows it in the first 17% of the regrow cycle
    if (care.canFeed && FERT) { if (!p.fertilizer) counted(spend, 'fertilizer', () => act('seed-shop', 'fertilizer', { quantity: 1 })); act(plot.id, 'fertilize'); }
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
    orderStats.tried++; const before = P().coins;
    if (counted(income, 'order', () => act('market', 'order', o.id)).ok) { orderStats.delivered++; if (P().coins - before > o.reward + .5) orderStats.high++; }
  }
  const p = P();
  // Keep 600 g of robusta/arabica for the café, sell the rest (all liberica) once per work day.
  for (const c of CROPS) {
    const keep = c.id === 'liberica' || FARMONLY ? 0 : 600, grams = p.stock.roasted[c.id] - keep;
    if (grams > 0) counted(income, 'market', () => act('market', 'sell', { item: `roasted:${c.id}`, grams }));
    if (p.stock.cherries[c.id] > 0 && false) {}
  }
}
function buyUpgrades() {
  const p = P();
  if (p.fields.length < 4) return; // land first
  const options = [...(FARMONLY ? ['storage', 'dryer', 'roaster'] : ['storage', 'dryer', 'roaster', 'cafe']).map(id => ({ id, price: upgradePrice(id, p.upgrades[id]), kind: 'upgrade' })),
    ...GEAR.filter(g => !FARMONLY && !g.group && (p.cafe.gear[g.id] || 0) < g.prices.length).map(g => ({ id: g.id, price: g.prices[p.cafe.gear[g.id] || 0], kind: 'gear' }))].sort((a, b) => a.price - b.price);
  const o = options[0];
  if (o && p.coins >= o.price + 150) {
    const r = o.kind === 'gear' ? counted(spend, 'gear', () => act('cafe', 'gear', o.id)) : counted(spend, 'upgrades', () => act(o.id, 'upgrade'));
    if (r.ok) note(`${o.kind} ${o.id} (${o.price} xu)`);
  }
}
function cafeShift() {
  for (const c of ['robusta', 'arabica', 'liberica']) if (P().cafe.stock.roasted[c] < 400 && P().stock.roasted[c] > 0) act('cafe', 'ship', c);
  if (PRICE !== 1) for (const r of RECIPES) act('cafe', 'prices', { recipeId: r.id, p: PRICE }); // F-42: only while closed
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
    if ((nextArrival -= 1) <= 0) { nextArrival = arrivalGap(H, C, rep, tableCount, p.cafe.gear.kiosk || 0) * arrivalFactor(meanPrice(p.cafe.prices, RECIPES.filter(r => !lockReason(r, p.cafe)).map(r => r.id))) * (.75 + Math.random() * .5); queue++; cafeStats.arrived++; }
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
  if (phaseClock < FARM_PHASE || FARMONLY) { t += 1000; phaseClock++; farmStep(); if (phaseClock % 360 === 0) sellAtMarket(); buyUpgrades(); } // FARMONLY: sells every work day, never leaves the farm
  else { cafeShift(); phaseClock = 0; }
  const minute = (t - start) / 60000;
  if (farm.level !== lastLevel) { note(`lên cấp ${farm.level}`); lastLevel = farm.level; }
  if (Number.isInteger(minute) && minute % 5 === 0 && rows.at(-1)?.min !== minute) {
    const p = P(); rows.push({ min: minute, coins: Math.round(p.coins), level: farm.level, fields: p.fields.length, rep: Math.round(p.cafe.reputation), roastedFarm: Object.values(p.stock.roasted).reduce((a, b) => a + b, 0), served: cafeStats.served, assets: Math.round(totalAssets(p)), xp: Math.round(p.xp) });
  }
}
if (!QUIET) console.table(rows);
const sumIn = Object.values(income).reduce((a, b) => a + b, 0);
console.log('SUMMARY', JSON.stringify({ region: REGION, min: MINUTES, care: CAREMODE, price: PRICE, level: farm.level, levelAt: Object.fromEntries(rows.filter(r => r.min % 30 === 0).map(r => [r.min, r.level])), assetsAt: Object.fromEntries(rows.filter(r => r.min % 30 === 0).map(r => [r.min, r.assets])), xp: Math.round(P().xp), xpBy: Object.fromEntries(Object.entries(xpBy).map(([k, v]) => [k, Math.round(v)])), income: Object.fromEntries(Object.entries(income).map(([k, v]) => [k, Math.round(v)])), incomeTotal: Math.round(sumIn), harvest: { g: Math.round(harvest.g), avgQ: +(harvest.qg / (harvest.g || 1)).toFixed(1), n: harvest.n }, orders: orderStats, cafe: { served: cafeStats.served, arrived: cafeStats.arrived, lost: cafeStats.lost, lostBusy: cafeStats.lostBusy, tiers: tiers.join('/') }, rep: Math.round(P().cafe.reputation), assets: Math.round(totalAssets(P())) }));
const log = QUIET ? () => {} : console.log; // QUIET keeps only the SUMMARY line
const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
const net=Object.values(income).reduce((a,b)=>a+b,0)-Object.values(spend).reduce((a,b)=>a+b,0);
log('income', JSON.stringify(round(income)), 'spend', JSON.stringify(round(spend)), 'net', Math.round(net), 'coinsEnd', Math.round(P().coins), 'level', farm.level, 'harvested', P().stats.harvested);
log('per hour', Math.round(Object.values(income).reduce((a, b) => a + b, 0) / MINUTES * 60), 'tiers none/bronze/silver/gold', tiers.join('/'), 'orders', JSON.stringify(orderStats), 'rep', Math.round(P().cafe.reputation));
log('cafe', cafeStats, 'beans used by café (g)', cafeStats.beansUsed, 'farm roasted delivered (g)', P().stats.delivered);
const st=P().stock,sum=o=>Object.values(o).reduce((a,b)=>a+b,0);log('blockedHarvestTries',blocked,'storage',farm.storageCapacity,'cherries',sum(st.cherries),'dried',sum(st.dried),'roasted',sum(st.roasted),'up',JSON.stringify(P().upgrades));
if(process.env.EVENTS)log(events.join('\n'));
