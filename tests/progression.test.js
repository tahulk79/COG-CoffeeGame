import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { WORK_DAY_MS } from '../src/features/farm/rules.js';
import { GEAR } from '../src/features/cafe/recipes.js';
import { FIELDS } from '../src/features/farm/content.js';
import { totalAssets, economicStatus } from '../src/features/farm/progression.js';
const AT = 100000;
const fresh = (region = 'vn') => createFarm(null, 'capital', () => {}, AT, [], region);
// Farm with `edit` applied to a fresh save, reloaded so load-time normalisation runs.
const make = (region, edit) => { const s = fresh(region).progress; edit(s); return createFarm(s, null, () => {}, AT, [], region); };

test('market XP is capped at 40 per work day and resets the next day', () => {
  const farm = make('vn', s => { s.stock.dried.robusta = 60000; s.lots = [{ id: 'l1', product: 'dried', cropId: 'robusta', grams: 60000, quality: 80, createdAt: AT, origin: 'farm' }]; s.coins = 0; });
  const xp0 = farm.progress.xp;
  let r = farm.act('market', 'sell', { item: 'dried:robusta', grams: 30000 }, AT); assert.ok(r.ok, r.message);
  assert.ok(farm.progress.coins > 200, 'big sale pays more than 80 XP worth');
  assert.equal(farm.progress.market.xp, 40); const xp1 = farm.progress.xp; // first-sale quest XP may add on top
  farm.act('market', 'sell', { item: 'dried:robusta', grams: 5000 }, AT + 1000);
  assert.equal(farm.progress.xp, xp1, 'no more XP the same day');
  farm.act('market', 'sell', { item: 'dried:robusta', grams: 5000 }, AT + WORK_DAY_MS + 1000);
  assert.ok(farm.progress.xp > xp1 && farm.progress.market.xp > 0 && farm.progress.market.xp <= 40, 'new work day pays again');
});

test('buying a field gives no XP', () => {
  const farm = make('vn', s => { s.coins = 1000; s.claimed = ['expand']; }); // quest XP excluded
  const xp = farm.progress.xp; assert.ok(farm.act('field-1', 'expand', null, AT).ok);
  assert.equal(farm.progress.xp, xp);
});

test('mastery XP: +15 at ★★, +30 at ★★★, once each; old saves are not paid retroactively', () => {
  const brew = (farm, score, at) => { const p = farm.progress; p.cafe.supplies && 0; return farm.act('cafe', 'brew', { recipeId: 'phin-den', score, cropId: 'robusta' }, at); };
  const farm = make('vn', s => {
    s.cafe.mastery['phin-den'] = { best: 80, made: 3 }; // old save: ★★ already reached, no tiers field
    for (const k of Object.keys(s.cafe.supplies)) s.cafe.supplies[k] = 999;
    s.cafe.lots = [{ id: 'l1', product: 'roasted', cropId: 'robusta', grams: 5000, quality: 80, createdAt: AT, origin: 'farm' }];
  });
  assert.deepEqual(farm.progress.cafe.mastery['phin-den'].tiers, [2]);
  let xp = farm.progress.xp, r = brew(farm, 85, AT); assert.ok(r.ok, r.message);
  assert.equal(farm.progress.xp, xp, 'no retro ★★ XP, 85 is still ★★');
  r = brew(farm, 95, AT + 10); assert.ok(r.ok, r.message);
  assert.equal(farm.progress.xp - xp, 30);
  brew(farm, 99, AT + 20); assert.equal(farm.progress.xp - xp, 30, 'only once');
  assert.deepEqual(farm.progress.cafe.mastery['phin-den'].tiers, [2, 3]);
});

test('memory XP: 3/5/+5 insight, 30 per work day; decode +20', () => {
  const farm = fresh(); let xp = farm.progress.xp;
  farm.act('memory', 'xp', { kind: 'game' }, AT); assert.equal(farm.progress.xp - xp, 3);
  farm.act('memory', 'xp', { kind: 'real', insight: true }, AT); assert.equal(farm.progress.xp - xp, 13);
  for (let i = 0; i < 5; i++) farm.act('memory', 'xp', { kind: 'real', insight: true }, AT);
  assert.equal(farm.progress.xp - xp, 30, 'capped');
  farm.act('memory', 'xp', { kind: 'real' }, AT + WORK_DAY_MS + 1); assert.equal(farm.progress.xp - xp, 35);
  xp = farm.progress.xp; farm.act('decode', 'xp', null, AT); assert.equal(farm.progress.xp - xp, 20);
});

test('economic victory per region type; huge coins alone never trigger it', () => {
  const dev = make('vn', s => { s.coins = 9999999999999; });
  assert.equal(dev.progress.victories.economic, null); assert.equal(economicStatus(dev.progress).rows[0][1], true);
  assert.equal(dev.progress.fields.length, 1, 'nothing auto-grants fields');
  // both
  let farm = make('vn', s => { s.coins = 400000; s.fields = FIELDS.map(f => f.id); s.cafe.reputation = 84; });
  assert.equal(farm.progress.victories.economic, null);
  farm = make('vn', s => { s.coins = 400000; s.fields = FIELDS.map(f => f.id); s.cafe.reputation = 85; });
  assert.ok(farm.progress.victories.economic);
  // farm-only
  // farm-only: 4 fields + every farm building at 15
  const allFarm = lvl => s => { s.coins = 400000; s.fields = FIELDS.map(f => f.id); for (const k of Object.keys(s.upgrades)) if (k !== 'cafe') s.upgrades[k] = lvl; };
  assert.equal(make('co', allFarm(14)).progress.victories.economic, null);
  assert.ok(make('co', allFarm(15)).progress.victories.economic);
  // café-only: café level 10 + reputation 90 + all automation maxed
  const cafeOnly = (rep, auto) => s => { s.coins = 400000; s.upgrades.cafe = 10; s.cafe.reputation = rep; for (const g of GEAR.filter(g => g.group === 'auto')) s.cafe.gear[g.id] = auto ? g.prices.length : 0; };
  assert.equal(make('it', cafeOnly(89, true)).progress.victories.economic, null);
  assert.equal(make('it', cafeOnly(90, false)).progress.victories.economic, null);
  assert.ok(make('it', cafeOnly(90, true)).progress.victories.economic);
});

test('victory is recorded once and discovery needs 6 keys', () => {
  const stamps = [];
  const farm = createFarm(Object.assign(fresh().progress, { coins: 400000, fields: FIELDS.map(f => f.id), cafe: { ...fresh().progress.cafe, reputation: 90 } }), null, v => stamps.push(v.victories.economic), AT, [], 'vn');
  const at = farm.progress.victories.economic; assert.ok(at);
  farm.act('tutorial', 'seen', 'x', AT + 5000);
  assert.equal(farm.progress.victories.economic, at);
  farm.act('victory', 'discovery', 5, AT + 9000); assert.equal(farm.progress.victories.discovery, null);
  farm.act('victory', 'discovery', 6, AT + 9000); assert.equal(farm.progress.victories.discovery, AT + 9000);
  farm.act('victory', 'discovery', 6, AT + 99000); assert.equal(farm.progress.victories.discovery, AT + 9000);
});

test('total assets add coins, fields, upgrades and café gear', () => {
  const base = totalAssets(fresh().progress);
  const farm = make('vn', s => { s.fields = ['field-0', 'field-1']; s.upgrades.soil = 3; s.cafe.gear.espresso = 2; });
  const spent = 120 + Math.ceil(90) + Math.ceil(90 * 1.42) + GEAR.find(g => g.id === 'espresso').prices[0] + GEAR.find(g => g.id === 'espresso').prices[1];
  assert.equal(totalAssets(farm.progress) - base, spent);
});
