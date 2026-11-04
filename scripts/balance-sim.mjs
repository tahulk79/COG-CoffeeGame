// Balance simulation: drives the real farm model (src/features/farm/model.js) with a scripted "typical player".
// Usage: node scripts/balance-sim.mjs [minutes]   (NOFERT=1 to skip fertilizer, EVENTS=1 to print the unlock timeline)
import { createFarm } from '../src/features/farm/model.js';
import { plotCare, CROPS, FIELDS } from '../src/features/farm/content.js';
import { RECIPES, lockReason, SUPPLIES, GEAR } from '../src/features/cafe/recipes.js';
import { assetValue, ASSETS, upgradePrice } from '../src/features/farm/rules.js';

const MINUTES = Number(process.argv[2] || 60);
const BREW_SECONDS = 12;            // assumed manual brew + serve time per cup (bench minigame)
const FARM_PHASE = 360, CAFE_PHASE = 240; // player alternates: 6 min farm, then one 4 min café shift
let t = 1_700_000_000_000;
const farm = createFarm(null, 'capital', () => {}, t);
const act = (...a) => farm.act(a[0], a[1], a[2], t);
const P = () => farm.peek();
const income = { market: 0, cafe: 0, shift: 0, other: 0 }, spend = { seeds: 0, land: 0, supplies: 0, fertilizer: 0, upgrades: 0, gear: 0 };
const events = [];
const note = text => events.push(`${(t - start) / 60000 | 0}m: ${text}`);
const start = t;
const fieldCrop = { 'field-0': 'robusta', 'field-1': 'arabica', 'field-2': 'liberica', 'field-3': 'robusta' };
let blocked = 0;
let cafeStats = { arrived: 0, served: 0, lost: 0, beansUsed: 0 }, produced = 0, lastLevel = 1;
const counted = (bucket, key, fn) => { const before = P().coins; const r = fn(); const d = P().coins - before; if (r.ok) (d >= 0 ? income : spend)[key] += Math.abs(d); return r; };

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
  let nextArrival = 0, brewing = 0, served = 0, queue = 0, starsSum = 0;
  for (let s = 0; s < CAFE_PHASE; s++) {
    t += 1000; farmStep();
    const p = P(), rep = p.cafe.reputation, tables = assetValue(ASSETS.find(a => a.id === 'cafe'), p.upgrades.cafe);
    if ((nextArrival -= 1) <= 0) { nextArrival = Math.max(3, Math.min(18, 13 - (rep - 50) * .06 - tables * .6)) * (.75 + Math.random() * .5); queue++; cafeStats.arrived++; }
    if (queue > 6) { queue--; act('cafe', 'lost', 'busy'); cafeStats.lost++; }
    if (queue && (brewing += 1) >= BREW_SECONDS) {
      brewing = 0;
      const menu = RECIPES.filter(r => !lockReason(r, p.cafe)), recipe = menu[Math.floor(Math.random() * menu.length)];
      for (const [id, amount] of Object.entries(recipe.uses)) if ((p.cafe.supplies[id] || 0) < amount * 3) counted(spend, 'supplies', () => act('cafe', 'buy', id));
      const crop = [recipe.bean, 'robusta', 'arabica', 'liberica'].find(c => (P().cafe.stock.roasted[c] || 0) >= recipe.beans);
      if (!crop) { queue--; act('cafe', 'lost', 'angry'); cafeStats.lost++; continue; }
      const b = act('cafe', 'brew', { recipeId: recipe.id, cropId: crop, score: 82 });
      if (!b.ok) { queue--; act('cafe', 'lost', 'angry'); cafeStats.lost++; continue; }
      cafeStats.beansUsed += recipe.beans;
      counted(income, 'cafe', () => act('cafe', 'sell', { recipeId: recipe.id, quality: b.quality, stars: 2, wait: .4, combo: 1 }));
      queue--; served++; starsSum += 2; cafeStats.served++;
    }
  }
  const goal = 6 + 2 * Math.max(1, Math.min(5, 1 + Math.floor((P().cafe.reputation - 10) / 20)));
  counted(income, 'shift', () => act('cafe', 'shift', { served, goal, avg: served ? starsSum / served : 0 }));
  if (P().cafe.open) act('cafe', 'toggle');
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
console.log('cafe', cafeStats, 'beans used by café (g)', cafeStats.beansUsed, 'farm roasted delivered (g)', P().stats.delivered);
const st=P().stock,sum=o=>Object.values(o).reduce((a,b)=>a+b,0);console.log('blockedHarvestTries',blocked,'storage',farm.storageCapacity,'cherries',sum(st.cherries),'dried',sum(st.dried),'roasted',sum(st.roasted),'up',JSON.stringify(P().upgrades));
if(process.env.EVENTS)console.log(events.join('\n'));
