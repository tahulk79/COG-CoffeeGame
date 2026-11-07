// Farm World 2.0 core: unified land (tiles, terrain uses, placement codes), fields as placeables, data-driven limits and
// growing prices, removal + refunds, storage sum, well coverage, production batches, one game per region, layout v5.
// docs/farm-world-2.0/FARM-WORLD-2.0-ARCHITECTURE.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { playing, T0 } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import { apply } from '../../src/core/game.js';
import { BUILDINGS, RECIPES, GOODS, FIELD, fieldExtraCost, xpForLevel, BUILD_MENU_FARM, CATEGORY_ORDER } from '../../src/core/config/economy.js';
import { PARCELS, ROADS, TERRAIN_USES, LOT_TERRAIN, terrainOfLot, plotsOf, rectsOverlap } from '../../src/core/config/layout.js';
import { createSave, normalizeSave, normalizeRegion, LAYOUT_VERSION } from '../../src/core/state.js';

// A playing farmer at `level` with `coins`, owning extra lots. veteran: past the Level-10 incident (it fires once).
function farmer({ level = 1, coins = 100000, lots = [], veteran = false } = {}) {
  const h = playing();
  if (veteran) h.state = { ...h.state, story: { ...h.state.story, level10Done: true } };
  h.must('play/chooseGame', { game: 'farm' });
  h.must('dev/set', { coins: 1e9, level });
  for (const id of lots) h.must('land/buyParcel', { parcelId: id });
  h.must('dev/set', { coins });
  return h;
}
const spot = (h, type, lotId) => {
  const [x0, z0, x1, z1] = PARCELS[lotId].rect;
  for (let z = z0; z <= z1; z += .5) for (let x = x0; x <= x1; x += .5) {
    const q = D.snapPosition(type, x, z, 0);
    if (D.placementError(h.state, type, q.x, q.z, 0) === null) return q;
  }
  return null;
};
const place = (h, type, lotId) => { const q = spot(h, type, lotId); assert.ok(q, `room for ${type} in ${lotId}`); return h.must('build/place', { type, ...q }); };
const lastUid = (h, type) => D.buildingsOf(h.state, type).at(-1).uid;

test('data: every placeable has a category, a use and a limit; menus only list known types', () => {
  for (const [id, def] of Object.entries(BUILDINGS)) {
    assert.ok(def.category, `${id} category`);
    assert.ok(['building', 'decor'].includes(def.use), `${id} use`);
    assert.ok(typeof def.limit === 'number' || Array.isArray(def.limit), `${id} limit`);
    if (def.recipe) { assert.ok(RECIPES[def.recipe], `${id} recipe`); assert.equal(def.effect.speed.length, def.upgrade.length + 1); }
  }
  for (const id of BUILD_MENU_FARM) assert.ok(D.defOf(id), id);
  for (const cats of Object.values(CATEGORY_ORDER)) for (const c of cats) assert.ok(Object.values(BUILDINGS).some(b => b.category === c) || c === 'farming', c);
  for (const t of Object.values(LOT_TERRAIN)) assert.ok(TERRAIN_USES[t], t);
  // Every recipe output is a known good; every Round-1 unlock is before the Level-10 incident.
  for (const r of Object.values(RECIPES)) for (const g of [...Object.keys(r.in), ...Object.keys(r.out)]) assert.ok(GOODS[g], g);
  for (const def of Object.values(BUILDINGS)) assert.ok(def.level <= 9, `${def.id} unlocks at Lv${def.level}`);
});

test('tiles: terrain, ownership, occupancy and allowed uses are derived from layout + save', () => {
  const h = farmer();
  const road = D.tileAt(h.state, 0, 0);
  assert.equal(road.terrain, 'road');
  assert.equal(road.restriction, 'onRoad');
  assert.deepEqual(road.uses, []);
  const f = D.plotOf(h.state, 'F1-1');
  const onField = D.tileAt(h.state, f.x, f.z);
  assert.equal(onField.occupant.kind, 'field');
  assert.equal(onField.occupant.id, 'F1-1');
  assert.equal(onField.restriction, 'onField');
  const yard = D.tileAt(h.state, 18, 18);
  assert.equal(yard.lot, 'Y0');
  assert.equal(yard.owned, true);
  assert.equal(yard.terrain, 'meadow');
  assert.deepEqual(yard.uses, ['field', 'building', 'decor']);
  const forSale = D.tileAt(h.state, 24, 15);
  assert.equal(forSale.unlock, 'forSale');
  assert.equal(forSale.restriction, 'notOwned');
  assert.equal(D.tileAt(h.state, 0, -68).terrain, 'hill');
  assert.equal(D.tileAt(h.state, 999, 999), null);
  // The silo footprint is solid (not walkable); fields are walkable.
  assert.equal(D.tileAt(h.state, 9, 14).walkable, false);
  assert.equal(onField.walkable, true);
});

test('unified land: buildings, fields and decor share owned meadow; terrain rules stay readable', () => {
  const h = farmer({ level: 4, lots: ['F2', 'W1', 'P1', 'O1', 'PD1', 'D1'] });
  // A field lot's free strip takes a building once a field is cleared (explicit conversion).
  assert.equal(D.placementError(h.state, 'dryer', -11, 5.5, 0), 'onField');
  for (const id of ['F1-1', 'F1-4', 'F1-2', 'F1-5']) h.must('build/remove', { uid: id }); // clear F1's two west columns
  assert.equal(D.placementError(h.state, 'dryer', -11, 5.5, 0), null, 'the cleared strip holds a drying yard');
  // A yard lot takes a field now.
  assert.ok(spot(h, 'field', 'W1'));
  // Garden (D1) takes anything; pasture no fields; orchard no buildings; pond decor only.
  assert.ok(spot(h, 'well', 'D1'));
  assert.equal(D.placementError(h.state, 'field', 8, -25.5, 0), 'terrain_pasture');
  assert.equal(D.placementError(h.state, 'dryer', -8, -43.5, 0), 'terrain_orchard');
  assert.equal(D.placementError(h.state, 'dryer', -22, -43.5, 0), 'terrain_pond');
  assert.equal(D.placementError(h.state, 'flowers', -22, -43.5, 0), null);
  assert.equal(D.terrainOfLot?.('H1') ?? terrainOfLot('H1'), 'hill');
  // Roads, edges between two lots, the café.
  assert.equal(D.placementError(h.state, 'dryer', 0, 0, 0), 'onRoad');
  assert.equal(D.placementError(h.state, 'dryer', -4, 5.5, 0), 'edge');     // half in F1, half on the verge
  assert.equal(D.placementError(h.state, 'roaster', -9, 5.5, 0), 'wrongZone');
  assert.equal(D.placementError(h.state, 'dryer', 2, 111, 0), 'wrongZone');
});

test('snapping: footprints land on the 0.5 m lattice so a yard lot holds 4 drying yards', () => {
  assert.deepEqual(D.snapPosition('dryer', 14.2, 13.8, 0), { x: 14, z: 14 });
  assert.deepEqual(D.snapPosition('dryer', 14.2, 13.6, 0), { x: 14, z: 13.5 });
  assert.deepEqual(D.snapPosition('field', 3.1, 4.4, 0), { x: 3, z: 4.5 });
  const h = farmer({ level: 9, veteran: true });
  let n = 0;
  while (n < 4 && spot(h, 'dryer', 'Y0')) { const q = spot(h, 'dryer', 'Y0'); if (!h.act('build/place', { type: 'dryer', ...q }).ok) break; n++; h.must('dev/set', { coins: 1e6 }); }
  // dryer limit at Lv9 is 3, so 3 fit (the 4th is refused by the limit, not by space).
  assert.equal(n, 3);
  assert.ok(spot(h, 'warehouse', 'Y0'), 'and there is still room for a 4th 4 × 4 m building');
});

test('no access: a building may not wall a field off from the road', () => {
  const h = farmer({ level: 9, veteran: true, lots: ['W1'] });
  h.must('dev/set', { coins: 1e7 });
  // A field in the middle of W1 [20,11.5,28,19.5], then wall it in with 4 m buildings.
  h.must('build/place', { type: 'field', x: 24, z: 15.5 });
  let err = null, built = 0;
  for (const [x, z] of [[22, 13.5], [26, 13.5], [22, 17.5], [26, 17.5]]) {
    for (const t of ['dryer', 'warehouse', 'roastery', 'well', 'packer']) { if (D.buildError(h.state, t)) continue; err = D.placementError(h.state, t, x, z, 0); if (!err && h.act('build/place', { type: t, x, z }).ok) { built++; break; } }
  }
  assert.ok(built < 4 || err === 'noAccess', 'never fully enclosed');
  assert.ok(D.ownedPlots(h.state).some(p => p.id.startsWith('fd')));
});

test('fields: free inside the allowance, extras cost more each, capped by level; move keeps the crop', () => {
  const h = farmer({ level: 1, coins: 100000 });
  assert.equal(D.fieldAllowance(h.state), 6);
  assert.equal(D.fieldCost(h.state), fieldExtraCost(0));
  const q1 = spot(h, 'field', 'Y0');
  h.must('build/place', { type: 'field', ...q1 });
  assert.equal(D.fieldCost(h.state), fieldExtraCost(1));
  assert.ok(fieldExtraCost(1) > fieldExtraCost(0));
  h.must('build/place', { type: 'field', ...spot(h, 'field', 'Y0') });
  const r = h.act('build/place', { type: 'field', ...spot(h, 'field', 'Y0') });
  assert.equal(r.error, 'limit', 'Lv1: 2 extra fields');
  assert.equal(r.data.level, 2);
  // Clear a classic field: placing one again is free (back inside the allowance) — never a money loop.
  const coins = h.state.player.coins;
  h.must('build/remove', { uid: 'F1-6' });
  assert.ok(h.state.player.coins > coins, 'an extra field refunds half its price');
  assert.ok(h.state.player.coins - coins <= fieldExtraCost(1) / 2);
  // Move a growing field: its crop goes along.
  h.must('farm/plant', { plotId: 'F1-1', crop: 'robusta' });
  const before = h.region().plots['F1-1'];
  h.must('build/remove', { uid: 'F1-4' });
  const to = D.plotOf(h.state, 'F1-4') ? null : { x: -12.5, z: 7 };
  h.must('build/move', { uid: 'F1-1', ...to });
  assert.deepEqual(h.region().plots['F1-1'], before);
  assert.equal(D.plotOf(h.state, 'F1-1').z, 7);
  assert.equal(h.act('build/remove', { uid: 'F1-1' }).error, 'fieldBusy');
});

test('limits: data-driven per type and level, each duplicate costs more; café buildings stay single', () => {
  const h = farmer({ level: 2, lots: ['W1'] });
  assert.equal(D.maxCount(h.state, 'dryer'), 1);
  assert.equal(D.nextLimitLevel(h.state, 'dryer'), 4);
  const c1 = D.buildCost(h.state, 'dryer');
  place(h, 'dryer', 'Y0');
  assert.equal(h.act('build/place', { type: 'dryer', ...spot(h, 'dryer', 'W1') }).error, 'limit');
  h.must('dev/set', { level: 4 });
  const c2 = D.buildCost(h.state, 'dryer');
  assert.equal(c2, Math.round(BUILDINGS.dryer.cost * BUILDINGS.dryer.costGrowth / 5) * 5);
  assert.ok(c2 > c1);
  place(h, 'dryer', 'W1');
  assert.equal(D.buildingsOf(h.state, 'dryer').length, 2);
  assert.equal(D.maxCount(h.state, 'roaster'), 1);
  assert.equal(D.maxCount(h.state, 'tables'), 4);
  assert.equal(D.maxCount(h.state, 'silo'), 1);
});

test('one game per region: a farm region refuses café builds and bean imports; a café region refuses farm work', () => {
  const h = farmer({ level: 3 });
  assert.equal(D.buildError(h.state, 'roaster'), 'gameLocked');
  assert.equal(h.act('shop/buyBeans').error, 'gameLocked');
  const c = playing();
  c.must('play/chooseGame', { game: 'cafe' });
  assert.equal(D.buildError(c.state, 'dryer'), 'gameLocked');
  assert.equal(c.act('farm/plant', { plotId: 'F1-1', crop: 'robusta' }).error, 'gameLocked');
  assert.equal(c.act('farm/sellAll').error, 'gameLocked');
});

test('storage: the storehouse and every barn add up; harvest and collect share it', () => {
  const h = farmer({ level: 5, lots: ['W1'] });
  const silo = D.capacity(h.state);
  place(h, 'warehouse', 'Y0');
  const one = D.capacity(h.state);
  assert.equal(one, silo + BUILDINGS.warehouse.effect.capacity[0]);
  place(h, 'warehouse', 'W1');
  assert.equal(D.capacity(h.state), one + BUILDINGS.warehouse.effect.capacity[0]);
  // Removing a barn whose room is in use is refused (no goods over capacity).
  h.must('dev/set', { beans: D.capacity(h.state) });
  assert.equal(D.removeError(h.state, lastUid(h, 'warehouse')), 'storageFull');
  h.must('farm/sellAll');
  assert.equal(D.removeError(h.state, lastUid(h, 'warehouse')), null);
  // stored counts every good; harvest refuses when everything together fills the storehouse.
  h.state.inventory.items.dried = D.capacity(h.state);
  h.must('farm/plant', { plotId: 'F1-1', crop: 'robusta' });
  h.tick(600000);
  assert.equal(h.act('farm/harvest', { plotId: 'F1-1' }).error, 'storageFull');
});

test('wells: fields in reach grow faster, the best well counts (no stacking), others unchanged', () => {
  const h = farmer({ level: 5, lots: ['F2'] });
  const base = D.plotGrowMs(h.state, { crop: 'robusta', plantedAt: 0 }, 'F1-1');
  h.must('build/remove', { uid: 'F1-3' });
  h.must('build/place', { type: 'well', x: -6, z: 4 });   // in F1's east column
  assert.ok(D.wellBonus(h.state, 'F1-2') > 0);
  assert.equal(D.wellBonus(h.state, 'F2-1'), 0, 'out of reach');
  const one = D.plotGrowMs(h.state, { crop: 'robusta', plantedAt: 0 }, 'F1-2');
  assert.ok(one < base);
  h.must('build/remove', { uid: 'F1-6' });
  h.must('build/place', { type: 'well', x: -6, z: 7 });
  assert.equal(D.plotGrowMs(h.state, { crop: 'robusta', plantedAt: 0 }, 'F1-2'), one, 'two wells over one field do not stack');
  // plotState and harvest use the same (faster) time.
  h.must('farm/plant', { plotId: 'F1-2', crop: 'robusta' });
  const st = D.plotState(h.state, 'F1-2', h.now);
  assert.ok(Math.abs(st.remainingMs - D.plotGrowMs(h.state, h.region().plots['F1-2'], 'F1-2')) < 2);
});

test('production: start takes inputs + fee, the batch runs on a fixed timer, collect adds goods + XP', () => {
  const h = farmer({ level: 4, lots: ['W1'] });
  place(h, 'dryer', 'Y0');
  const b = D.buildingsOf(h.state, 'dryer')[0];
  assert.equal(h.act('prod/start', { uid: b.uid }).error, 'noInput');
  assert.equal(h.act('prod/start', { uid: b.uid }).data.need, 'beans');
  h.must('dev/set', { beans: RECIPES.dry.in.beans + 4 });
  h.must('prod/start', { uid: b.uid });
  assert.equal(h.state.inventory.beans, 4);
  assert.equal(h.act('prod/start', { uid: b.uid }).error, 'jobBusy');
  assert.equal(h.act('prod/collect', { uid: b.uid }).error, 'notDone');
  assert.equal(D.removeError(h.state, b.uid), 'jobBusy');
  const job = D.buildingsOf(h.state, 'dryer')[0].job;
  // An upgrade during the batch does not retime it.
  h.must('build/upgrade', { uid: b.uid });
  assert.equal(D.buildingsOf(h.state, 'dryer')[0].job.ms, job.ms);
  h.tick(job.ms);
  const xp = h.state.player.xp;
  h.must('prod/collect', { uid: b.uid });
  assert.equal(h.state.inventory.items.dried, RECIPES.dry.out.dried);
  assert.ok(h.state.player.xp > xp);
  // Roasting has a fuel fee; the dried beans sell for more than raw ones.
  place(h, 'roastery', 'W1');
  const r = lastUid(h, 'roastery');
  h.state.inventory.items.dried = 20;
  const coins = h.state.player.coins;
  h.must('prod/start', { uid: r });
  assert.equal(h.state.player.coins, coins - RECIPES.roast.fee);
  assert.ok(GOODS.dried.price > GOODS.beans.price && GOODS.roasted.price > GOODS.dried.price);
});

test('production: a duplicate adds throughput only with inputs; batch size grows with the level', () => {
  const h = farmer({ level: 4, lots: ['W1'] });
  place(h, 'dryer', 'Y0'); place(h, 'dryer', 'W1');
  const [a, b] = D.buildingsOf(h.state, 'dryer');
  h.must('dev/set', { beans: RECIPES.dry.in.beans });
  h.must('prod/start', { uid: a.uid });
  assert.equal(h.act('prod/start', { uid: b.uid }).error, 'noInput');
  h.must('dev/set', { beans: 100 });
  h.must('prod/start', { uid: b.uid });
  assert.equal(D.buildingsOf(h.state, 'dryer').filter(x => x.job).length, 2);
  // Level 3 doubles the batch (odd levels: batch, even levels: speed).
  const up = D.buildingsOf(h.state, 'dryer')[0];
  assert.equal(D.batchOf(up), 1);
  assert.equal(D.batchOf({ ...up, level: 3 }), 2);
  assert.equal(D.recipeIO({ ...up, level: 3 }).in.beans, RECIPES.dry.in.beans * 2);
  assert.ok(D.recipeIO({ ...up, level: 2 }).ms < D.recipeIO(up).ms);
});

test('remove: refund = share of coins spent, never starters, no XP loop from build → remove → build', () => {
  const h = farmer({ level: 3 });
  assert.equal(D.removeError(h.state, D.buildingsOf(h.state, 'silo')[0].uid), 'fixed');
  const c0 = h.state.player.coins, x0 = h.state.player.xp;
  place(h, 'dryer', 'Y0');
  const xpAfterFirst = h.state.player.xp;
  assert.ok(xpAfterFirst > x0);
  h.must('build/upgrade', { uid: lastUid(h, 'dryer') });
  const spent = BUILDINGS.dryer.cost + BUILDINGS.dryer.upgrade[0];
  const before = h.state.player.coins;
  h.must('build/remove', { uid: lastUid(h, 'dryer') });
  assert.equal(h.state.player.coins - before, Math.floor(BUILDINGS.dryer.refund * spent));
  place(h, 'dryer', 'Y0');
  assert.equal(h.state.player.xp, xpAfterFirst + 8, 'only the upgrade XP was added, no second build XP');
  assert.ok(h.state.player.coins < c0);
});

test('selling: each good at its price, sell all in one tap; farm/sellBeans still works', () => {
  const h = farmer();
  h.must('dev/set', { beans: 10 });
  h.state.inventory.items.dried = 4; h.state.inventory.items.bag = 1;
  const q = D.sellAllQuote(h.state);
  assert.equal(q.coins, 10 * GOODS.beans.price + 4 * GOODS.dried.price + GOODS.bag.price);
  const coins = h.state.player.coins;
  h.must('farm/sell', { good: 'dried', amount: 1 });
  assert.equal(h.state.player.coins, coins + GOODS.dried.price);
  h.must('farm/sellBeans', { amount: 2 });
  assert.equal(h.state.inventory.beans, 8);
  h.must('farm/sellAll');
  assert.equal(D.stored(h.state), 0);
  assert.equal(h.act('farm/sellAll').error, 'noBeans');
  assert.equal(h.act('farm/sell', { good: 'toString' }).error, 'unknown');
});

test('buying land: a field lot arrives with its 6 classic fields; other lots arrive empty', () => {
  const h = farmer({ coins: 1e6 });
  h.must('land/buyParcel', { parcelId: 'F3' });
  assert.deepEqual(D.ownedPlots(h.state).filter(p => p.parcel === 'F3').map(p => p.id), plotsOf('F3').map(p => p.id));
  h.must('land/buyParcel', { parcelId: 'W1' });
  assert.equal(D.ownedPlots(h.state).filter(p => p.parcel === 'W1').length, 0);
  assert.equal(h.events.find(e => e.type === 'parcelBought' && e.parcelId === 'F3').fields, 6);
});

test('layout v5 migration: a v4 region keeps every crop on the same field ids; idempotent; junk-safe', () => {
  const plots = { 'F1-1': { crop: 'robusta', plantedAt: T0 - 5000, fast: true }, 'F2-4': { crop: 'arabica', plantedAt: T0, slow: true }, 'F9-1': { crop: 'robusta', plantedAt: T0 } };
  const r = normalizeRegion({ layout: 4, status: 'active', parcels: ['F1', 'Y0', 'S', 'F2'], plots,
    buildings: [{ uid: 'b2', type: 'dryer', x: 14, z: 13.5, rot: 0, level: 3 }, { uid: 'b3', type: 'flowers', x: 18, z: 17.5, rot: 1.6, level: 'x' }] });
  assert.equal(r.layout, LAYOUT_VERSION);
  assert.equal(r.fields.length, 12);
  assert.deepEqual(r.fields.map(f => f.id), [...plotsOf('F1'), ...plotsOf('F2')].map(p => p.id));
  assert.deepEqual(r.plots['F1-1'], plots['F1-1']);
  assert.deepEqual(r.plots['F2-4'], plots['F2-4']);
  assert.equal(r.plots['F9-1'], undefined, 'a crop on land you never owned is dropped');
  assert.equal(r.buildings.find(b => b.uid === 'b2').level, 3);
  assert.equal(r.buildings.find(b => b.uid === 'b3').rot, 2, 'rotation sanitised to 0..3');
  assert.equal(r.buildings.find(b => b.uid === 'b3').level, 1);
  const again = normalizeRegion(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(again.fields, r.fields);
  assert.deepEqual(again.plots, r.plots);
  assert.equal(normalizeRegion({}).fields.length, 0);
  assert.deepEqual(normalizeRegion({}).parcels, [], 'an empty region gets no stray Y0');
  for (const junk of [null, 'x', 42, { fields: 'no' }, { fields: [null, { id: 3 }, { id: 'a', x: 'b' }] }, { layout: 5, fields: [{ id: 'fd1', x: 1, z: 2 }, { id: 'fd1', x: 3, z: 4 }] }]) {
    const n = normalizeRegion(junk);
    assert.ok(Array.isArray(n.fields));
    assert.ok(new Set(n.fields.map(f => f.id)).size === n.fields.length);
  }
  // A bad production job is dropped, a good one is kept.
  const j = normalizeRegion({ layout: 5, parcels: ['Y0'], buildings: [{ uid: 'p', type: 'dryer', x: 14, z: 13.5, level: 1, job: { recipe: 'dry', at: 1, ms: 30000, out: { dried: 6, toString: 1 } } },
    { uid: 'q', type: 'dryer', x: 18, z: 13.5, level: 1, job: { recipe: 'nope', at: 1, ms: 1 } }] });
  assert.deepEqual(j.buildings.find(b => b.uid === 'p').job.out, { dried: 6 });
  assert.equal(j.buildings.find(b => b.uid === 'q').job, undefined);
});

test('save: goods normalised; an expired region never counts as owned on reload (free next region)', () => {
  const s = createSave(T0, { gender: 'female', name: 'A' });
  s.inventory = { beans: 3, items: { dried: -4, roasted: 'x', bag: 2.7, junk: 9 } };
  s.world.regions = { 'vn-1': { layout: 5, status: 'expired', parcels: [] } };
  s.world.ownedRegions = [];
  s.story.phase = 'chooseRegion';
  const n = normalizeSave(JSON.parse(JSON.stringify(s)), T0);
  assert.deepEqual(n.inventory.items, { dried: 0, roasted: 0, bag: 2 });
  assert.deepEqual(n.world.ownedRegions, []);
  assert.equal(D.regionUnlockCost(n, 'br-1'), 0, 'the first region after the incident stays free across a reload');
});

test('incident: goods and running batches are wiped with the region (full restart)', () => {
  const h = farmer({ level: 9, lots: ['W1'] });
  place(h, 'dryer', 'Y0');
  h.must('dev/set', { beans: 30 });
  h.must('prod/start', { uid: lastUid(h, 'dryer') });
  h.state.inventory.items.bag = 3;
  h.must('dev/grant', { xp: xpForLevel(10) });
  assert.equal(h.state.story.phase, 'expiry');
  h.must('expiry/execute');
  assert.deepEqual(h.state.inventory.items, { dried: 0, roasted: 0, bag: 0 });
  assert.equal(h.state.story.expiry.snapshot.items.bag, 3);
  h.must('world/unlockRegion', { regionId: 'br-1' });
  h.must('world/enterRegion', { regionId: 'br-1' });
  assert.deepEqual(D.ownedPlots(h.state).map(p => p.id), plotsOf('F1').map(p => p.id));
  assert.ok(D.region(h.state).buildings.every(b => BUILDINGS[b.type].starter));
});

test('junk payloads on the new actions never throw and never change coins', () => {
  const h = farmer({ level: 5 });
  const coins = h.state.player.coins;
  for (const type of ['build/place', 'build/move', 'build/remove', 'prod/start', 'prod/collect', 'farm/sell', 'farm/sellAll']) {
    for (const p of [{}, { uid: 'toString' }, { uid: '__proto__' }, { type: 'field', x: NaN, z: 1 }, { type: 'field', x: 'a', z: [] }, { good: '__proto__' }, { uid: 'F1-1', x: 1e9, z: -1e9 }]) {
      const r = apply(h.state, { type, payload: p }, { now: h.now });
      // Only a real target may succeed (removing the empty classic field F1-1 is legit and refunds nothing).
      if (r.ok && !(type === 'build/remove' && p.uid === 'F1-1')) assert.fail(`${type} accepted ${JSON.stringify(p)}`);
      if (r.ok) assert.ok(r.state.player.coins <= coins);
    }
  }
  assert.equal(h.state.player.coins, coins);
  assert.ok(Object.values(ROADS).every(rd => !D.ownedPlots(h.state).some(p => rectsOverlap(D.footprint('field', p.x, p.z), rd.rect))), 'no field on a road');
  assert.equal(FIELD.use, 'field');
});

test('store: the raw save is kept once under -pre-layout5 before a layout migration', async () => {
  const { createStore, createMemoryStorage } = await import('../../src/core/store.js');
  const storage = createMemoryStorage();
  const s = createSave(T0, { gender: 'female', name: 'B' });
  s.world.regions = { 'vn-1': { layout: 4, status: 'idle', parcels: ['F1', 'Y0', 'S'], plots: { 'F1-2': { crop: 'robusta', plantedAt: T0 } }, buildings: [] } };
  const raw = JSON.stringify(s);
  storage.setItem('k', raw);
  const store = createStore({ storage, key: 'k', now: () => T0 });
  assert.equal(storage.getItem(`k-pre-layout${LAYOUT_VERSION}`), raw);
  assert.equal(store.state.world.regions['vn-1'].fields.length, 6);
  assert.ok(store.state.world.regions['vn-1'].plots['F1-2']);
  storage.setItem('k', JSON.stringify(store.state));
  createStore({ storage, key: 'k', now: () => T0 });
  assert.equal(storage.getItem(`k-pre-layout${LAYOUT_VERSION}`), raw, 'kept once, never overwritten');
});

test('conversion: clearing ONE field frees exactly one building slot (workshops are 3 × 3 m like a field)', () => {
  const h = farmer({ level: 4 });
  const f = D.plotOf(h.state, 'F1-5');
  assert.equal(D.placementError(h.state, 'dryer', f.x, f.z, 0), 'onField');
  h.must('build/remove', { uid: 'F1-5' });
  const q = D.snapPosition('dryer', f.x, f.z, 0);
  assert.equal(D.placementError(h.state, 'dryer', q.x, q.z, 0), null);
  h.must('build/place', { type: 'dryer', ...q });
  // ...and the field goes back elsewhere for free (inside the allowance).
  assert.equal(D.fieldCost(h.state), 0);
  assert.ok(spot(h, 'field', 'Y0'));
  for (const t of ['dryer', 'roastery', 'packer', 'warehouse']) assert.deepEqual(BUILDINGS[t].size, FIELD.size, `${t} is one slot`);
});
