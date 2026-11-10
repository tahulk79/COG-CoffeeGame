// The manager's Heart–Reason slider (founder 2026-11-10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave, newFmState } from '../../src/core/state.js';
import * as D from '../../src/core/derive.js';
import { FARM_MANAGER as FM, stanceEffects, stanceMode, STAFF, VITALS, xpForLevel } from '../../src/core/config/economy.js';

const T0 = 1_800_000_000_000, A = 'vn-1';
function game({ manager = true } = {}) {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: false, sandbox: true }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone');
  g.act('world/unlockRegion', { regionId: A }); g.act('world/enterRegion', { regionId: A }); g.act('play/chooseGame', { game: 'farm' });
  g.s.player.coins = 50000; g.s.wallet.gold[A] = 50000;
  const type = Object.keys(STAFF).find(t => STAFF[t].zone === 'farm' && STAFF[t].kind === 'worker');
  for (let i = 0; i < 2; i++) { const r = g.act('staff/hire', { type }); assert.equal(r.ok, true, r.error); }
  if (manager) { g.s.gm.unit = { name: 'M', skill: 3, stats: {}, loyalty: 80 }; g.s.gm.fm = newFmState(); }
  return g;
}
const set = (g, v) => assert.equal(g.act('gm/fmSet', { key: 'stance', value: v }).ok, true);
const workers = g => g.s.staff.units.filter(u => STAFF[u.type].kind === 'worker');
const tick = (g, uid, sec = 60) => { g.now += sec * 1000; return g.act('staff/vitals', { uid, work: sec }); };

test('marks sit where the founder chose and the nearest one sets the goal', () => {
  assert.deepEqual([0, 12, 13, 25, 37, 38, 50, 57, 58, 65, 72, 73, 80, 100].map(stanceMode),
    ['conservative', 'conservative', 'expansion', 'expansion', 'expansion', 'balanced', 'balanced', 'balanced', 'debt', 'debt', 'debt', 'profit', 'profit', 'profit']);
});

test('the middle changes nothing; reason pays more and costs people; heart the reverse', () => {
  assert.deepEqual(stanceEffects(50), { speed: 1, moralePerMin: 0, care: 1, bonus: 0, quits: false });
  const pts = [0, 25, 50, 65, 80, 100].map(stanceEffects);
  for (let i = 1; i < pts.length; i++) { assert.ok(pts[i].speed > pts[i - 1].speed); assert.ok(pts[i].moralePerMin < pts[i - 1].moralePerMin); }
  assert.ok(pts[0].moralePerMin > 0 && !pts[0].quits && pts[5].quits);
});

test('settings: only whole positions from 0 to 100, the goal follows, ask is a switch', () => {
  const g = game();
  for (const bad of [-1, 101, 50.5, '60', null]) assert.equal(g.act('gm/fmSet', { key: 'stance', value: bad }).ok, false, String(bad));
  set(g, 66);
  assert.deepEqual([g.s.gm.fm.stance, g.s.gm.fm.mode, g.s.gm.fm.ask], [66, 'debt', false]);
  assert.equal(g.act('gm/fmSet', { key: 'ask', value: true }).ok, true);
  assert.equal(g.s.gm.fm.ask, true);
  assert.equal(g.act('gm/fmSet', { key: 'mode', value: 'profit' }).ok, true);
  assert.equal(g.s.gm.fm.stance, 80);
});

test('old saves land on their mark and keep "ask me" as the switch', () => {
  const g = game();
  for (const [mode, stance, ask] of [['profit', 80, false], ['expansion', 25, false], ['conservative', 0, false], ['balanced', 50, false], ['manual', 50, true]]) {
    const raw = JSON.parse(JSON.stringify(g.s)); raw.gm.fm = { mode, auto: true }; if (!raw.gm.unit) assert.fail();
    const m = normalizeSave(raw, T0);
    assert.deepEqual([m.gm.fm.stance, m.gm.fm.ask], [stance, ask], mode);
  }
});

test('reason wears a worker out until they quit; balance and heart do not', () => {
  const g = game(); set(g, 100);
  const [u, v] = workers(g);
  g.s.staff.units.find(x => x.uid === u.uid).morale = 15;
  let left = false;
  for (let i = 0; i < 3 && !left; i++) { const r = tick(g, u.uid); left = r.events?.some(e => e.type === 'staffLeft' && e.reason === 'stress'); }
  assert.ok(left, 'quit');
  assert.ok(!D.unitOf(g.s, u.uid));
  assert.ok(D.unitOf(g.s, v.uid));
  for (const stance of [50, 0]) {
    const h = game(); set(h, stance); h.s.staff.units[0].morale = 0.5;
    const id = workers(h)[0].uid; tick(h, id);
    assert.ok(D.unitOf(h.s, id), `${stance}`);
  }
  const h = game(); set(h, 0); const id = workers(h)[0].uid; h.s.staff.units.find(x => x.uid === id).morale = 50; tick(h, id);
  assert.ok(D.unitOf(h.s, id).morale > 50, 'heart lifts spirits');
});

test('without a hired manager the slider does nothing', () => {
  const g = game({ manager: false });
  assert.equal(D.stanceOf(g.s), 50);
  const u = workers(g)[0]; g.s.staff.units[0].morale = 0.5;
  tick(g, u.uid);
  assert.ok(D.unitOf(g.s, u.uid));
  assert.equal(D.stateSpeedMul(D.unitOf(g.s, u.uid), g.now, g.s), D.stateSpeedMul(D.unitOf(g.s, u.uid), g.now));
});

test('speed follows the slider for farm workers only', () => {
  const g = game(); set(g, 100);
  const u = workers(g)[0];
  assert.ok(Math.abs(D.stateSpeedMul(u, g.now, g.s) / D.stateSpeedMul(u, g.now) - 1.3) < 1e-9);
});

test('the MVP round rewards the best and punishes the worst on the reason side, and only then', () => {
  for (const [stance, paid] of [[100, 120], [50, 0], [0, 0]]) {
    const g = game(); set(g, stance);
    const [a, b] = g.s.staff.units; a.book.earned = 500; b.book.earned = 10; a.morale = 50; b.morale = 50; g.s.player.coins = 1000;
    const r = g.act('staff/mvp');
    assert.equal(r.ok, true);
    assert.equal(g.s.player.coins, 1000 - paid, `${stance}`);
    if (paid) { assert.ok(g.s.staff.units[0].morale > 80); assert.ok(g.s.staff.units[1].morale < 50); assert.ok(r.events.some(e => e.type === 'staffDisciplined')); }
    else assert.equal(g.s.staff.units[0].morale, g.s.staff.units[1].morale);
  }
});

test('old hires abroad get a hometown of their country; a Vietnamese farm keeps theirs', () => {
  const g = game();
  const raw = JSON.parse(JSON.stringify(g.s)); const [a, b] = raw.staff.units;
  a.home = 'Đà Lạt'; a.assigned.regionId = 'br-1'; delete a.hobbies; b.home = 'Đà Lạt'; b.assigned.regionId = A;
  const m = normalizeSave(raw, T0);
  assert.notEqual(m.staff.units[0].home, 'Đà Lạt');
  assert.equal(m.staff.units[1].home, 'Đà Lạt');
  assert.equal(m.staff.units[0].hobbies.length, 2);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(m)), T0).staff.units[0].home, m.staff.units[0].home);
});

function hiredManager() {
  const g = game({ manager: false });
  g.s.player.xp = xpForLevel(8);
  assert.equal(g.act('gm/hire', { index: 0 }).ok, true);
  g.s.player.coins = 5000; g.s.wallet.gold[A] = 5000;
  return g;
}
const think = g => { g.now += 60_000; return g.act('gm/think', { roll: .5 }); };

test('goal "repay debt": his thinking sends spare Gold to the loan and leaves his reserve alone', () => {
  const g = hiredManager();
  assert.equal(g.act('loan/take', { amount: 1000, gold: true }).ok, true);
  set(g, 65);
  think(g);
  assert.equal(D.loanTotal(g.s), 0, 'paid off from the surplus');
  assert.ok(g.s.player.coins >= D.fmReserve(g.s), 'the reserve is kept');
});

test('goal "repay debt" with nothing spare pays nothing; other goals do not rush the loan; ask me stops him', () => {
  const g = hiredManager();
  g.act('loan/take', { amount: 1000, gold: true }); set(g, 65); g.s.player.coins = 0;
  think(g);
  assert.equal(D.loanTotal(g.s), 1000);
  const h = hiredManager();
  h.act('loan/take', { amount: 1000, gold: true }); set(h, 80);
  think(h);
  assert.ok(D.loanTotal(h.s) > 0, 'only his usual small repayment');
  const a = hiredManager();
  a.act('loan/take', { amount: 1000, gold: true }); set(a, 65); a.act('gm/fmSet', { key: 'ask', value: true });
  think(a);
  assert.ok(D.loanTotal(a.s) > 0);
});
