// Audit-only checks against the REAL model (no game code changed). node production/audit/evidence/economy/edge-tests.mjs
import { createFarm } from '../../../../src/features/farm/model.js';
import { CROPS, FIELDS, PLOTS, MACHINES, PRODUCTS, QUESTS, LEVEL_XP, xpForLevel } from '../../../../src/features/farm/content.js';
import { RECIPES, SUPPLIES, GEAR, TABLE_LEVELS, MAX_TABLES, STAFF_ROLES, OWN_CUP, trainCost } from '../../../../src/features/cafe/recipes.js';
import { ASSETS, upgradePrice, assetMaxLevel, assetValue, capacityScale, efficiency, marketValue, MARKET_DAILY, SUPPLIER_PRICE, FERTILIZER_PRICE, SEASON_MS, WORKER_CANDIDATES } from '../../../../src/features/farm/rules.js';
import { DECORATIONS } from '../../../../src/features/farm/decorations.js';
const T0 = Date.UTC(2026, 0, 1);
const out = (title, v) => { console.log(`\n## ${title}`); typeof v === 'string' ? console.log(v) : console.table(v); };
const r2 = n => Math.round(n * 100) / 100;
const lot = (product, cropId, grams, quality = 80) => ({ id: `lot-x-${product}-${cropId}`, product, cropId, grams, quality, createdAt: T0, origin: 'farm' });
const save = extra => ({ version: 3, timingVersion: 3, staffRoutineVersion: 1, contractVersion: 1, deploymentVersion: 1, coins: 0, fields: ['field-0'], giftApplied: true, claimed: QUESTS.map(q => q.id), tutorial: { seen: ['cafe-intro'] }, robotGift: { state: 'done' }, lots: [], seeds: {}, fertilizer: 0, ...extra });

// 1. Crop value per tree per season (no fert/prune penalties applied: yield × .9 × .95 baseline, fert ×1.1, prune ×1)
const crops = CROPS.map(c => {
  const fed = c.yield * 1.1, base = c.yield * .9 * .95, roastedFed = fed / 6 * .84, roastedBase = base / 6 * .84;
  const v = g => g * .07 * c.priceScale * (.7 + .3 * .8); // roasted price at quality 80
  return { crop: c.id, unlockLv: c.level, seed: c.seedPrice, firstHarvestMin: r2((c.growMs + c.regrowMs) / 60000), seasonMin: r2(c.regrowMs / 60000),
    roastedG_fed: Math.round(roastedFed), xu_fed: r2(v(roastedFed)), xu_per_min_fed: r2(v(roastedFed) / (c.regrowMs / 60000)), xu_base_unfed_unpruned: r2(v(roastedBase)), fertROI_x: r2((v(roastedFed) - v(roastedBase * 1 / .95)) / FERTILIZER_PRICE) };
});
out('1. Giá trị mỗi cây/vụ (hạt rang, chất lượng 80, bán chợ giá đầy đủ)', crops);

// 2. Market saturation: coins for selling X base value in one work day
out('2. Bão hòa chợ (marketValue, MARKET_DAILY=1200)', [100, 500, 840, 1200, 2000, 4000].map(b => ({ baseValueSold: b, coins: r2(marketValue(0, b)), avgRate: r2(marketValue(0, b) / b) })));

// 3. Shop order ("Đơn cố định") repeat test: 10 kg robusta roasted; fulfil until stock runs out vs one market sale.
{
  const f1 = createFarm(save({ lots: [lot('roasted', 'robusta', 10000)] }), null, () => {}, T0);
  let n = 0, xp0 = f1.peek().xp; const crops = new Set();
  for (let i = 0; i < 100; i++) { const o = f1.peek().order; crops.add(o.cropId); const r = f1.act('market', 'order', o.id, T0 + i); if (!r.ok) break; n++; }
  const f2 = createFarm(save({ lots: [lot('roasted', 'robusta', 10000)] }), null, () => {}, T0);
  const r = f2.act('market', 'sell', { item: 'roasted:robusta', grams: 10000 }, T0);
  out('3. Đơn cố định lặp lại (level 1, chỉ vối mở)', [{ path: 'shop order lặp', fulfilled: n, coins: f1.peek().coins, xp: f1.peek().xp - xp0, gramsLeft: f1.peek().stock.roasted.robusta, crops: [...crops].join(',') },
    { path: 'bán chợ 1 lần 10 kg', fulfilled: 1, coins: f2.peek().coins, xp: f2.peek().xp, gramsLeft: f2.peek().stock.roasted.robusta, crops: 'robusta' }]);
  // All three crops stocked, level 4: is the fixed order unlimited?
  const f4 = createFarm(save({ xp: 200, lots: CROPS.map(c => lot('roasted', c.id, 4000)) }), null, () => {}, T0);
  let k = 0; const c4 = f4.peek().coins; for (let i = 0; i < 100; i++) { const o = f4.peek().order; if (!f4.act('market', 'order', o.id, T0 + i).ok) break; k++; }
  const f5 = createFarm(save({ xp: 200, lots: CROPS.map(c => lot('roasted', c.id, 4000)) }), null, () => {}, T0);
  for (const c of CROPS) f5.act('market', 'sell', { item: `roasted:${c.id}`, grams: 4000 }, T0);
  console.log(`  3 giống × 4 kg, cấp 4: đơn cố định lặp ${k} lần liên tiếp, +${f4.peek().coins - c4} xu, còn ${JSON.stringify(f4.peek().stock.roasted)} · bán chợ cùng 12 kg cùng ngày: +${r2(f5.peek().coins)} xu`);
  // Same at level 3 (3 crops): does the rotation block when one crop is missing?
  const f3 = createFarm(save({ xp: 200, lots: [lot('roasted', 'robusta', 10000)] }), null, () => {}, T0);
  let m = 0; for (let i = 0; i < 100; i++) { const o = f3.peek().order; const r = f3.act('market', 'order', o.id, T0 + i); if (!r.ok) { console.log(`  level ${f3.level}: kẹt ở đơn ${o.cropId} sau ${m} lần (${r.message})`); break; } m++; }
}

// 4. Supplier-only café loop: buy 500 g at SUPPLIER_PRICE, brew + sell each recipe with score 80, compute profit/cup.
{
  const rows = [];
  for (const rec of RECIPES.filter(r => ['phin-den', 'nau-da', 'bac-xiu'].includes(r.id))) {
    const f = createFarm(save({ coins: 1000, cafe: { stock: {}, lots: [], shipments: [], open: true, reputation: 60, served: 10, lost: 0, revenue: 0, costs: 0, autoSupply: true, reserve: false } }), null, () => {}, T0);
    const c0 = f.peek().coins; f.act('cafe', 'supply', null, T0); const cups = Math.floor(500 / rec.beans);
    let sold = 0; for (let i = 0; i < cups; i++) { for (const [id, n] of Object.entries(rec.uses)) if (f.peek().cafe.supplies[id] < n) f.act('cafe', 'buy', id, T0); const b = f.act('cafe', 'brew', { recipeId: rec.id, cropId: 'robusta', score: 80 }, T0); if (!b.ok) break; const s = f.act('cafe', 'sell', { recipeId: rec.id, quality: b.quality, stars: 2, wait: .4, combo: 0 }, T0); if (s.ok) sold++; }
    rows.push({ recipe: rec.id, cupsFrom500g: sold, netCoins: r2(f.peek().coins - c0), perCup: r2((f.peek().coins - c0) / sold), suppliesLeftCups: f.peek().cafe.supplies.cup });
  }
  out(`4. Vòng nhập hạt ngoài (${SUPPLIER_PRICE} xu/500 g) → bán ly tự pha (OWN_CUP=${OWN_CUP}), không cần farm`, rows);
}

// 5. Soft-lock: 0 coins, 0 seeds, no trees, no stock, café empty → any coin source?
{
  const f = createFarm(save({ coins: 0, cafe: { stock: {}, lots: [], shipments: [], open: false, reputation: 50, served: 5, lost: 0, revenue: 0, costs: 0, supplies: { cup: 0 } } }), null, () => {}, T0);
  const tries = [['seed-shop', 'buySeed', { cropId: 'robusta', quantity: 1 }], ['cafe', 'supply'], ['market', 'sell', { item: 'roasted:robusta', grams: 1 }], ['cafe', 'brew', { recipeId: 'phin-den', cropId: 'robusta', score: 80 }]];
  out('5. Kẹt khi 0 xu + không cây + không hạt + quán trống', tries.map(([id, a, c]) => ({ action: `${id}.${a}`, result: f.act(id, a, c, T0 + 1000).message })));
  // advance 8h: does anything regenerate coins?
  f.tick(T0 + 8 * 3600000); console.log('  coins sau 8h offline:', f.peek().coins, '· plots trồng:', f.peek().plots.filter(p => p.stage !== 'empty').length);
}

// 6. Offline 8h with a full mature field: what happens to trees?
{
  const plots = PLOTS.filter(p => p.fieldId === 'field-0').map(p => ({ id: p.id, stage: 'growing', mature: true, cropId: 'robusta', growthMs: 0, water: 70, weeds: 0, health: 100 }));
  const rows = [];
  for (const [label, back] of [['về lúc phút mưa (ngày%7=4)', T0 + 8 * 3600000], ['về lúc phút khô (ngày%7=6)', T0 + 8 * 3600000 + 2 * 60000]]) {
  const f = createFarm(save({ plots }), null, () => {}, T0);
  f.tick(back); const ps = f.peek().plots.filter(p => p.unlocked);
  rows.push({ label, ready: ps.filter(p => p.stage === 'ready').length, avgHealth: r2(ps.reduce((s, p) => s + p.health, 0) / ps.length), avgYieldG: Math.round(ps.reduce((s, p) => s + p.readyYield, 0) / ps.length), water: r2(ps[0].water), weeds: r2(ps[0].weeds) }); }
  out('6. Vắng 8h, ruộng 12 cây trưởng thành vừa hái (thời tiết lấy 1 điểm lúc quay lại)', rows);
}

// 7. Throughput: farm max output vs machine capacity per level
{
  const fullCherriesPerMin = 48 * 3000 * 1.1 / (SEASON_MS / 60000); // all robusta, fed
  const rows = [1, 2, 3, 5, 10, 20].map(l => ({ level: l, dryer_g_cherry_per_min: Math.round(18000 * capacityScale(l) / (30 / efficiency(l)) * 60), roaster_g_dried_per_min: Math.round(1000 * capacityScale(l) / (18 / efficiency(l)) * 60) }));
  out(`7. Công suất trạm vs farm tối đa (48 cây vối bón phân ≈ ${Math.round(fullCherriesPerMin)} g quả/phút → ${Math.round(fullCherriesPerMin / 6)} g nhân/phút)`, rows);
}

// 8. Sink totals
{
  const assetRows = ASSETS.map(a => { let s = 0; for (let l = 1; l < assetMaxLevel(a); l++) s += upgradePrice(a.id, l); return { asset: a.id, max: assetMaxLevel(a), lv2: upgradePrice(a.id, 1), lv10: upgradePrice(a.id, 9), lvMax: upgradePrice(a.id, assetMaxLevel(a) - 1), total: s, valueLv1: assetValue(a, 1), valueMax: assetValue(a, assetMaxLevel(a)) }; });
  out('8a. Nâng cấp công trình (rules.js upgradePrice)', assetRows);
  const gear = GEAR.reduce((s, g) => s + g.prices.slice(g.start).reduce((a, b) => a + b, 0), 0);
  const tables = MAX_TABLES * TABLE_LEVELS.reduce((s, t) => s + t.price, 0);
  const land = FIELDS.reduce((s, f) => s + f.price, 0);
  const cafeTrain = 10 * [1, 2, 3, 4].reduce((s, l) => s + trainCost(l), 0);
  const farmTrain = 2 * [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((s, l) => s + 40 * l, 0);
  const deco = 100 * Math.max(...DECORATIONS.map(d => d.price));
  out('8b. Tổng nơi tiêu một lần', [{ assetsTotal: assetRows.reduce((s, r) => s + r.total, 0), gear, tables, land, cafeTrain, farmTrain, decorationsMax100: deco, seeds48Trees: 'tối đa 12×30×4=1440' }]);
  out('8c. XP theo cấp', [2, 3, 5, 10, 15, 20, 25, 30].map(l => ({ level: l, xp: xpForLevel(l) })));
}
