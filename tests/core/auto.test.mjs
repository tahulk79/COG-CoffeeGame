// Auto nông trại (lượt auto, AUTO in economy.js): 10-minute runs of played time, the farm works itself while the player plays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave } from '../../src/core/state.js';
import * as D from '../../src/core/derive.js';
import { AUTO, autoPrice } from '../../src/core/config/economy.js';
import { PARCELS, areaOfParcel } from '../../src/core/config/layout.js';

const T0 = 1_800_000_000_000;
function farm(fields = 4) {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: false }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone');
  g.act('world/unlockRegion', { regionId: 'vn-1' }); g.act('world/enterRegion', { regionId: 'vn-1' }); g.act('play/chooseGame', { game: 'farm' });
  g.s.player.coins = 400;
  for (let i = 0; i < fields; i++) {
    let q = null;
    for (const id of D.region(g.s).parcels) {
      if (q || areaOfParcel(id) !== 'farm') continue;
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      for (let z = z0; z <= z1 && !q; z += .5) for (let x = x0; x <= x1 && !q; x += .5) { const p = D.snapPosition('field', x, z, 0); if (D.placementError(g.s, 'field', p.x, p.z, 0) === null) q = p; }
    }
    assert.ok(q, 'a free field spot');
    assert.equal(g.act('build/place', { type: 'field', ...q }).ok, true);
  }
  return g;
}
// `each` = the player's own taps, before the Auto round of the same beat.
const runFor = (g, sec, each) => { const ev = {}; for (let t = 0; t < sec && g.s.autoplay.active; t += AUTO.everySec) { g.now += AUTO.everySec * 1000; each?.(t); for (const e of g.act('auto/tick', { ms: AUTO.everySec * 1000 }).events || []) ev[e.type] = (ev[e.type] || 0) + 1; } return ev; };

test('auto: a new save has one free run; old saves get it once; old wall-clock runs are dropped', () => {
  const s = createSave(T0);
  assert.equal(s.autoplay.runs, AUTO.freeRuns);
  assert.equal(normalizeSave({ ...s, autoplay: { runs: 0, granted: false } }, T0).autoplay.runs, AUTO.freeRuns);
  assert.equal(normalizeSave({ ...s, autoplay: { runs: 0, granted: true } }, T0).autoplay.runs, 0);
  assert.equal(normalizeSave({ ...s, autoplay: { runs: 0, granted: true, active: { startedAt: 1, endsAt: 2 } } }, T0).autoplay.active, null);
});

test('auto: with no field yet it refuses and keeps the run', () => {
  const g = farm(0);
  assert.equal(g.act('auto/start').error, 'noFields');
  assert.equal(g.s.autoplay.runs, AUTO.freeRuns);
});

test('auto: a run lasts 10 played minutes, works the farm, then ends by itself', () => {
  const g = farm();
  assert.equal(AUTO.runSeconds, 600);
  assert.equal(g.act('auto/start').ok, true);
  assert.equal(g.s.autoplay.runs, 0);
  assert.equal(g.s.autoplay.active.leftMs, 600_000);
  const ev = runFor(g, 700);
  assert.equal(g.s.autoplay.active, null, 'the run is over');
  assert.equal(ev.autoStopped, 1);
  assert.ok(ev.planted >= 4, 'empty fields planted');
  assert.ok(ev.harvested > 10, 'ripe trees picked');
  assert.ok(D.level(g.s) > 1, 'XP from the work');
  assert.equal(g.s.autoplay.saved, 0, 'a timed-out run keeps nothing');
});

test('auto: the player keeps acting during a run (nothing is blocked)', () => {
  const g = farm();
  g.act('auto/start');
  let mine = 0;
  runFor(g, 300, () => { for (const p of D.ownedPlots(g.s)) { const st = D.plotState(g.s, p.id, g.now).stage; if (st === 'ready' && g.act('farm/harvest', { plotId: p.id }).ok) mine++; } });
  assert.ok(mine > 0, 'the player harvested too');
  assert.ok(g.s.autoplay.active, 'still running');
});

test('auto: never uproots, never buys land / buildings / staff', () => {
  const g = farm();
  g.s.player.coins = 50_000;
  const parcels = D.region(g.s).parcels.length, units = g.s.staff.units.length;
  g.act('auto/start');
  const ev = runFor(g, 600);
  assert.equal(ev.uprooted || 0, 0);
  assert.equal(D.region(g.s).parcels.length, parcels);
  assert.equal(g.s.staff.units.length, units);
  assert.ok(!ev.built && !ev.parcelBought && !ev.hired);
});

test('auto: sells when the storehouse is nearly full', () => {
  const g = farm();
  g.act('auto/start');
  const cap = D.capacity(g.s);
  g.s.inventory.beans = Math.ceil(cap * AUTO.sellAt); g.s.inventory.beanMix = { robusta: g.s.inventory.beans };
  const earned = g.s.stats.earned;
  const ev = runFor(g, AUTO.everySec);
  assert.equal(ev.autoSold, 1);
  assert.ok(g.s.stats.earned > earned, 'the sale paid');
  assert.ok(D.stored(g.s) < cap * AUTO.sellAt);
});

test('auto: time is played time — one tick never burns more than maxTickMs', () => {
  const g = farm();
  g.act('auto/start');
  g.act('auto/tick', { ms: 3_600_000 });
  assert.equal(g.s.autoplay.active.leftMs, 600_000 - AUTO.maxTickMs);
});

test('auto: pause keeps the time left; resume spends no run', () => {
  const g = farm();
  g.act('auto/start');
  runFor(g, 60);
  const left = g.s.autoplay.active.leftMs;
  assert.equal(g.act('auto/stop', { reason: 'user' }).ok, true);
  assert.equal(g.s.autoplay.saved, left);
  assert.equal(g.act('auto/start').ok, true);
  assert.equal(g.s.autoplay.runs, 0);
  assert.equal(g.s.autoplay.active.leftMs, left);
  assert.equal(g.s.autoplay.saved, 0);
  assert.equal(normalizeSave(JSON.parse(JSON.stringify(g.s)), g.now).autoplay.active.leftMs, left, 'a reload resumes the run');
});

test('auto: no runs left → noRuns; buying costs coins and the price climbs to a cap', () => {
  const g = farm();
  g.act('auto/start'); runFor(g, 700);
  assert.equal(g.act('auto/start').error, 'noRuns');
  g.s.player.coins = 0;
  assert.equal(g.act('auto/buy').error, 'coins');
  g.s.player.coins = 100_000;
  const c0 = g.s.player.coins;
  assert.equal(g.act('auto/buy').ok, true);
  assert.equal(c0 - g.s.player.coins, AUTO.price);
  assert.equal(g.s.autoplay.runs, 1);
  assert.equal(autoPrice(1), AUTO.price + AUTO.priceStep);
  assert.equal(autoPrice(999), AUTO.maxPrice);
  assert.equal(g.act('auto/start').ok, true);
  assert.equal(g.act('auto/start').noop, true, 'a second start while on does nothing');
});

test('auto: the Level-10 restart pauses a running run and keeps its time', () => {
  const g = farm();
  g.act('auto/start'); runFor(g, 30);
  const left = g.s.autoplay.active.leftMs;
  g.s.story.expiry = { status: 'pending', regionId: 'vn-1', at: 0 }; g.s.story.phase = 'expiry';
  assert.equal(g.act('expiry/execute').ok, true);
  assert.equal(g.s.autoplay.active, null);
  assert.equal(g.s.autoplay.saved, left);
});

test('auto: does not run in a café region', () => {
  const g = { now: T0, s: createSave(T0) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: false }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone'); g.act('world/unlockRegion', { regionId: 'fr-1' }); g.act('world/enterRegion', { regionId: 'fr-1' });
  D.region(g.s).mode = 'cafe'; // (the café game is locked on main for now: set the region's game directly)
  assert.equal(g.act('auto/start').error, 'gameLocked');
});
