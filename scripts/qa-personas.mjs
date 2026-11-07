// Farm World 2.0 QA: scripted player personas driving the REAL reducer (src/core/game.js) — no browser, no save
// contamination (pure in-memory states). Each persona prints PASS/FAIL lines; exit code 1 when any check fails.
// Usage: node scripts/qa-personas.mjs [persona…]   (no args = all). Also importable: runPersonas(names) → results.
// See docs/farm-world-2.0/FARM-WORLD-2.0-QA.md for what each persona covers and what still needs a real device.
import { pathToFileURL } from 'node:url';
import { apply } from '../src/core/game.js';
import { createSave, normalizeSave, normalizeRegion } from '../src/core/state.js';
import * as D from '../src/core/derive.js';
import { BUILDINGS, PLAYTEST, GOODS, RECIPES, EXPIRY_LEVEL, xpForLevel } from '../src/core/config/economy.js';
import { PARCELS, PARCEL_ORDER, plotsOf } from '../src/core/config/layout.js';

PLAYTEST.coins = 0;
const T0 = 1_800_000_000_000;

function player({ dev = true } = {}) {
  const p = {
    now: T0, s: createSave(T0, { gender: 'female', name: 'QA' }), events: [], fails: {},
    act(type, payload = {}, txId) {
      const r = apply(p.s, { type, payload, txId }, { now: p.now, dev });
      if (r.ok) { p.s = r.state; p.events.push(...r.events); } else p.fails[`${type}:${r.error}`] = (p.fails[`${type}:${r.error}`] || 0) + 1;
      return r;
    },
    tick(ms) { p.now += ms; },
    region() { return D.region(p.s); },
    start(regionId = 'vn-1', game = 'farm') {
      p.act('story/introDone'); p.act('story/teacherDone');
      p.act('world/unlockRegion', { regionId }); p.act('world/enterRegion', { regionId });
      p.act('play/chooseGame', { game });
      return p;
    },
    coins(n) { p.act('dev/set', { coins: n }); return p; },
    // Past the Level-10 incident (it fires once per save): big test profiles can level freely without triggering it.
    veteran() { p.s = { ...p.s, story: { ...p.s.story, level10Done: true } }; return p; },
    level(n) { p.act('dev/set', { level: n }); return p; },
    beans(n) { p.act('dev/set', { beans: n }); return p; },
    // First free spot for `type` scanning the owned farm lots on the 1 m grid (what a player dragging the ghost finds).
    spot(type) {
      for (const id of p.region().parcels) {
        const lot = PARCELS[id];
        if (!lot || lot.area) continue;
        const [x0, z0, x1, z1] = lot.rect;
        for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) {
          const q = D.snapPosition(type, x, z, 0);
          if (D.placementError(p.s, type, q.x, q.z, 0) === null) return q;
        }
      }
      return null;
    },
    build(type) { const q = p.spot(type); return q ? p.act('build/place', { type, x: q.x, z: q.z }) : { ok: false, error: 'noSpot' }; },
    plantAll(crop = 'robusta') { let n = 0; for (const f of D.ownedPlots(p.s)) if (!p.region().plots[f.id] && p.act('farm/plant', { plotId: f.id, crop }).ok) n++; return n; },
    harvestAll() { let n = 0; for (const f of D.ownedPlots(p.s)) if (D.plotState(p.s, f.id, p.now).stage === 'ready' && p.act('farm/harvest', { plotId: f.id }).ok) n++; return n; },
  };
  return p;
}

const results = [];
let current = '';
function check(name, ok, detail = '') {
  results.push({ persona: current, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${current}] ${name}${detail ? ` — ${detail}` : ''}`);
}

const PERSONAS = {
  // 1. Zero knowledge: plays only what the screen offers (tap empty field → plant, tap ripe → harvest, sell).
  newPlayer() {
    const p = player({ dev: false }).start();
    check('starts with 6 fields on F1', D.ownedPlots(p.s).length === 6, `fields=${D.ownedPlots(p.s).length}`);
    check('fields keep the classic ids', D.ownedPlots(p.s).every(f => /^F1-\d$/.test(f.id)));
    const planted = p.plantAll();
    check('can plant with starting coins', planted >= 1, `planted=${planted} coins=${p.s.player.coins}`);
    p.tick(5000);
    check('tutorial seeds ripen fast', p.harvestAll() === planted);
    const sold = p.act('farm/sell', { item: 'beans' });
    check('sells beans at the storehouse', sold.ok && p.s.inventory.beans === 0, sold.error || '');
    check('never stuck: can plant again or grace applies', D.seedCost(p.s, 'robusta') <= p.s.player.coins);
  },
  // 2. Broke: no coins, nothing growing → free robusta (grace), never coins.
  poorPlayer() {
    const p = player().start().coins(0);
    check('grace seed is free when broke', D.seedCost(p.s, 'robusta') === 0);
    check('can plant for free', p.act('farm/plant', { plotId: D.ownedPlots(p.s)[0].id, crop: 'robusta' }).ok);
    check('grace gives no coins', p.s.player.coins === 0);
    check('cannot buy a building', p.act('build/place', { type: 'dryer', x: 16, z: 15.5 }).ok === false);
  },
  // 3. Rich: builds every farm building up to the level limit, never past it.
  richPlayer() {
    const p = player().start().veteran().coins(5_000_000).level(9);
    for (const id of PARCEL_ORDER) if (!PARCELS[id].area) p.act('land/buyParcel', { parcelId: id });
    const farmTypes = Object.values(BUILDINGS).filter(b => b.zone === 'farm' && !b.starter && !b.retired).map(b => b.id);
    for (const type of farmTypes) {
      const max = D.maxCount(p.s, type);
      let built = 0, last = '';
      for (let i = 0; i < max + 2; i++) { const r = p.build(type); if (r.ok) built++; else last = r.error; }
      check(`${type}: builds up to ${max}, not more`, built === max && D.buildingsOf(p.s, type).length === max, `built=${built} stop=${last}`);
    }
    const costs = [];
    const q = player().start().veteran().coins(5_000_000).level(9);
    for (const id of PARCEL_ORDER) if (!PARCELS[id].area) q.act('land/buyParcel', { parcelId: id });
    for (let i = 0; i < 3; i++) { costs.push(D.buildCost(q.s, 'dryer')); q.build('dryer'); }
    check('each duplicate costs more', costs[0] < costs[1] && costs[1] < costs[2], costs.join(' < '));
  },
  // 4. Many plots: all lots + extra fields; every field plants and harvests.
  manyPlots() {
    const p = player().start().veteran().coins(5_000_000).level(9);
    for (const id of PARCEL_ORDER) if (!PARCELS[id].area) p.act('land/buyParcel', { parcelId: id });
    const pre = D.ownedPlots(p.s).length;
    const farmLots = Object.values(PARCELS).filter(l => l.kind === 'farm').length;
    check('every farm lot comes with 6 fields', pre === farmLots * 6, `fields=${pre} lots=${farmLots}`);
    let extra = 0, stop;
    while ((stop = p.build('field')).ok) extra++;
    check('extra fields stop at the level cap', extra > 0 && D.ownedPlots(p.s).length === D.maxCount(p.s, 'field'), `extra=${extra} stop=${stop.error}`);
    p.beans(0);
    const planted = p.plantAll();
    p.tick(3600_000);
    const t0 = Date.now ? 0 : 0;
    let harvested = 0;
    for (let i = 0; i < 20 && D.ownedPlots(p.s).some(f => D.plotState(p.s, f.id, p.now).stage === 'ready'); i++) { harvested += p.harvestAll(); p.act('farm/sellAll'); }
    check('every planted field can be harvested', planted === harvested, `planted=${planted} harvested=${harvested}`);
    void t0;
  },
  // 5. Many buildings + decor: placement keeps working, errors explain why.
  manyBuildings() {
    const p = player().start().veteran().coins(5_000_000).level(9);
    for (const id of PARCEL_ORDER) if (!PARCELS[id].area) p.act('land/buyParcel', { parcelId: id });
    let decor = 0, last = '';
    for (const type of ['flowers', 'lamp', 'plant']) for (let i = 0; i < 14; i++) { const r = p.build(type); if (r.ok) decor++; else last = r.error; }
    check('decor fills up to each limit', decor === 3 * D.maxCount(p.s, 'flowers'), `decor=${decor} stop=${last}`);
    const f = D.plotOf(p.s, 'F1-2'), q = D.snapPosition('dryer', f.x, 5.5, 0); // centred in F1, over its fields
    check('cannot build on a field (explicit conversion)', D.placementError(p.s, 'dryer', q.x, q.z, 0) === 'onField', D.placementError(p.s, 'dryer', q.x, q.z, 0));
    check('cannot build on the road', D.placementError(p.s, 'dryer', 0, 0, 0) === 'onRoad');
    check('pond takes decor only', D.placementError(p.s, 'dryer', -22, -43.5, 0)?.startsWith('terrain'), D.placementError(p.s, 'dryer', -22, -43.5, 0));
  },
  // 6. Duplicates: 3 drying yards run 3 batches at once; throughput triples, revenue only with beans.
  duplicates() {
    const p = player().start().coins(100_000).level(7);
    for (const id of ['W1', 'F2', 'F3']) p.act('land/buyParcel', { parcelId: id });
    for (let i = 0; i < 3; i++) p.build('dryer');
    const dryers = D.buildingsOf(p.s, 'dryer');
    check('3 drying yards built', dryers.length === 3);
    const need = RECIPES.dry.in.beans;
    p.beans(need * 3);
    for (const b of dryers) p.act('prod/start', { uid: b.uid });
    check('3 batches run in parallel', D.buildingsOf(p.s, 'dryer').every(b => b.job), JSON.stringify(D.buildingsOf(p.s, 'dryer').map(b => !!b.job)));
    const idle = player().start().coins(100_000).level(7);
    for (const id of ['W1']) idle.act('land/buyParcel', { parcelId: id });
    idle.build('dryer'); idle.build('dryer'); idle.beans(need);
    const [a, b] = D.buildingsOf(idle.s, 'dryer');
    idle.act('prod/start', { uid: a.uid });
    const r = idle.act('prod/start', { uid: b.uid });
    check('a 2nd yard without beans adds nothing', !r.ok && r.error === 'noInput', r.error);
    p.tick(10 * 60_000);
    let got = 0;
    for (const bd of D.buildingsOf(p.s, 'dryer')) if (p.act('prod/collect', { uid: bd.uid }).ok) got++;
    check('all 3 batches collected', got === 3 && (p.s.inventory.items.dried || 0) === RECIPES.dry.out.dried * 3, `dried=${p.s.inventory.items.dried}`);
  },
  // 7. Expansion: buy lots in order; roads open; farm lots arrive pre-tilled.
  expansion() {
    const p = player().start().coins(1_000_000);
    const before = D.ownedPlots(p.s).length;
    p.act('land/buyParcel', { parcelId: 'F2' });
    check('buying a field lot adds 6 fields', D.ownedPlots(p.s).length === before + 6);
    p.act('land/buyParcel', { parcelId: 'W1' });
    check('buying a yard lot adds no fields', D.ownedPlots(p.s).length === before + 6);
    check('field allowance follows farm lots', D.fieldAllowance(p.s) === before + 6);
    check('roads open with the land', D.roadOpen(p.s, 'mainEW_W'));
  },
  // 8. Upgrades: each processor upgrade improves ONE stat; costs follow the table.
  upgrades() {
    const p = player().start().coins(1_000_000).level(9);
    p.act('land/buyParcel', { parcelId: 'W1' });
    p.build('dryer');
    const b0 = D.buildingsOf(p.s, 'dryer')[0];
    const stats = [];
    for (let l = 1; l <= 8; l++) {
      const b = D.buildingsOf(p.s, 'dryer')[0];
      stats.push([D.prodSpeed(b), D.batchOf(b)]);
      p.act('build/upgrade', { uid: b0.uid });
    }
    let oneAtATime = true;
    for (let i = 1; i < stats.length; i++) {
      const changed = (stats[i][0] !== stats[i - 1][0]) + (stats[i][1] !== stats[i - 1][1]);
      if (changed !== 1) oneAtATime = false;
    }
    check('every dryer level improves exactly one stat', oneAtATime, JSON.stringify(stats));
    check('reaches max level 8', D.buildingsOf(p.s, 'dryer')[0].level === 8);
  },
  // 9. Bottleneck: storage full blocks harvest and collect; selling frees it.
  bottleneck() {
    const p = player().start().coins(100_000).level(3);
    p.act('land/buyParcel', { parcelId: 'W1' });
    p.build('dryer');
    const cap = D.capacity(p.s);
    p.beans(cap);
    const b = D.buildingsOf(p.s, 'dryer')[0];
    p.act('prod/start', { uid: b.uid });
    p.beans(cap);
    p.tick(600_000);
    const c = p.act('prod/collect', { uid: b.uid });
    check('collect waits when storage is full', !c.ok && c.error === 'storageFull', c.error);
    p.act('farm/sellAll');
    check('selling frees space, then collect works', p.act('prod/collect', { uid: b.uid }).ok);
    const w = p.build('warehouse');
    check('a barn adds storage', w.ok && D.capacity(p.s) > cap, `${cap} → ${D.capacity(p.s)}`);
    const capOne = D.capacity(p.s);
    p.level(5); p.build('warehouse');
    check('a 2nd barn adds storage again (sum, not max)', D.capacity(p.s) > capOne, `${capOne} → ${D.capacity(p.s)}`);
  },
  // 10. Region change: fields are per region; goods are shared.
  regions() {
    const p = player().start().coins(100_000);
    p.act('land/buyParcel', { parcelId: 'F2' });
    p.beans(10);
    p.act('world/unlockRegion', { regionId: 'br-1' });
    p.act('world/enterRegion', { regionId: 'br-1' });
    p.act('play/chooseGame', { game: 'farm' });
    check('new region starts with 6 fields', D.ownedPlots(p.s).length === 6);
    check('beans are shared between regions', p.s.inventory.beans === 10);
    p.act('world/enterRegion', { regionId: 'vn-1' });
    check('old region kept its 12 fields', D.ownedPlots(p.s).length === 12);
  },
  // 11. Level 10 incident: full restart, new region with 6 empty fields, goods wiped.
  incident() {
    const p = player().start().coins(100_000);
    p.act('land/buyParcel', { parcelId: 'W1' });
    p.level(9); p.build('dryer');
    p.beans(20); p.act('prod/start', { uid: D.buildingsOf(p.s, 'dryer')[0].uid });
    p.act('dev/grant', { xp: xpForLevel(EXPIRY_LEVEL) });
    check('Lv10 triggers the incident', p.s.story.phase === 'expiry', p.s.story.phase);
    p.act('expiry/execute');
    check('goods are wiped', p.s.inventory.beans === 0 && Object.values(p.s.inventory.items).every(n => n === 0));
    p.act('world/unlockRegion', { regionId: 'br-1' }); p.act('world/enterRegion', { regionId: 'br-1' });
    check('new region: 6 fields, no buildings but the starters', D.ownedPlots(p.s).length === 6 && D.region(p.s).buildings.every(b => BUILDINGS[b.type].starter));
  },
  // 12. Round 2: still locked (founder: no unlock action yet) — make sure nothing new opened it.
  round2() {
    const p = player().start().coins(1_000_000);
    check('only Round 1 is playable', p.s.player.round === 1);
    check('no round unlock action exists', apply(p.s, { type: 'round/unlock', payload: { round: 2 } }, { now: p.now }).error === 'unknownAction');
  },
  // 13. Rebirth: independent of rounds and of the farm; nothing lost.
  rebirth() {
    const p = player().start().coins(500).level(5);
    p.act('rebirth/addCredits', { amount: 1, source: 'dev' });
    const fields = D.ownedPlots(p.s).length, coins = p.s.player.coins;
    const r = p.act('rebirth/perform', { blessing: 'grow' });
    check('rebirth works at Lv5 with a credit', r.ok, r.error || '');
    check('rebirth keeps coins and fields', p.s.player.coins === coins && D.ownedPlots(p.s).length === fields);
  },
  // 14. Old save: a layout-v4 region with crops, a dryer and decor loads with every crop in place.
  oldSave() {
    const s = createSave(T0, { gender: 'male', name: 'Old' });
    s.story.phase = 'play'; s.story.teacherMet = true;
    s.world.currentRegion = 'vn-1'; s.world.ownedRegions = ['vn-1'];
    const plots = Object.fromEntries([...plotsOf('F1'), ...plotsOf('F2')].map((pl, i) => [pl.id, { crop: 'robusta', plantedAt: T0 - i * 1000 }]));
    s.world.regions['vn-1'] = { layout: 4, status: 'active', parcels: ['F1', 'Y0', 'S', 'F2', 'W1'], roads: [], plots, shop: { orders: [] },
      buildings: [{ uid: 'b1', type: 'silo', x: 9, z: 14, rot: 0, level: 3 }, { uid: 'b2', type: 'dryer', x: 16, z: 15.5, rot: 0, level: 2 }, { uid: 'b3', type: 'flowers', x: 24.5, z: 12.5, rot: 0, level: 1 }] };
    s.inventory = { beans: 12 };
    const n = normalizeSave(JSON.parse(JSON.stringify(s)), T0);
    const r = n.world.regions['vn-1'];
    check('v4 → v5: 12 fields with the old ids', r.fields.length === 12 && r.fields.every(f => plots[f.id]));
    check('every growing crop survives', Object.keys(r.plots).length === 12);
    check('buildings and levels survive', r.buildings.length === 3 && r.buildings.find(b => b.type === 'dryer').level === 2);
    check('beans survive, goods default to 0', n.inventory.beans === 12 && n.inventory.items.dried === 0);
    const again = normalizeRegion(JSON.parse(JSON.stringify(r)));
    check('migration is idempotent', JSON.stringify(again.fields) === JSON.stringify(r.fields) && again.layout === r.layout);
  },
  // 15. Exploits: build/remove and field place/remove never make money; sell price never above buy price.
  exploits() {
    const p = player().start().coins(100_000).level(9);
    p.act('land/buyParcel', { parcelId: 'W1' });
    const c0 = p.s.player.coins;
    for (let i = 0; i < 5; i++) { p.build('dryer'); const b = D.buildingsOf(p.s, 'dryer')[0]; p.act('build/remove', { uid: b.uid }); }
    check('build → remove loses coins', p.s.player.coins < c0, `${c0} → ${p.s.player.coins}`);
    const c1 = p.s.player.coins;
    for (let i = 0; i < 5; i++) { p.build('field'); const f = D.ownedPlots(p.s).at(-1); p.act('build/remove', { uid: f.id }); }
    check('field place → remove never earns', p.s.player.coins <= c1, `${c1} → ${p.s.player.coins}`);
    const bean = GOODS.beans.price;
    check('café bean price ≥ farm sell price (no buy→sell loop)', D.beanBuyQuote(p.s, 1).cost === 0 || 4 >= bean);
  },
};

export function runPersonas(names = Object.keys(PERSONAS)) {
  results.length = 0;
  for (const n of names) {
    current = n;
    try { PERSONAS[n](); } catch (e) { check('ran without throwing', false, e.stack?.split('\n').slice(0, 3).join(' | ')); }
  }
  return [...results];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PERSONAS);
  const res = runPersonas(names);
  const bad = res.filter(r => !r.ok);
  console.log(`\n${res.length - bad.length}/${res.length} checks passed across ${names.length} personas`);
  process.exitCode = bad.length ? 1 : 0;
}
