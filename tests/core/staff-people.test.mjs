// Who works here: 100 to 200 people per country, real hometowns of that country, and old saves repaired.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterOf, drawPerson, HOMES, LEGACY_HOMES, lifeOfSeed } from '../../src/core/config/staff-people.js';
import { NAMES } from '../../src/core/config/staff-names.js';
import { applicantsFor, gmCandidatesFor } from '../../src/core/config/economy.js';
import pack from '../../src/i18n/locales/staff-people.js';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave } from '../../src/core/state.js';
import * as D from '../../src/core/derive.js';
import { CHECKUP, checkupGrade } from '../../src/core/config/economy.js';

const COUNTRIES = Object.keys(NAMES);

test('every country has a roster of 100 to 200 distinct people of both genders and many ages', () => {
  assert.equal(COUNTRIES.length, 26);
  for (const c of COUNTRIES) {
    const r = rosterOf(c), names = new Set(r.map(p => p.name)), ages = new Set(r.map(p => Math.floor(p.age / 10)));
    assert.ok(r.length >= 100 && r.length <= 200, `${c}: ${r.length}`);
    assert.equal(names.size, r.length, c);
    const f = r.filter(p => p.gender === 'female').length;
    assert.ok(Math.abs(f - (r.length - f)) <= 6, `${c} gender ${f}/${r.length}`);
    assert.ok(ages.size >= 4, `${c} ages`);
    assert.ok(r.every(p => p.age >= 18 && p.age <= 58 && p.name.length <= 20), c);
  }
});

test('everyone comes from their own country, has hobbies with text, and the roster never changes', () => {
  for (const c of COUNTRIES) {
    const towns = HOMES[c].split('|');
    assert.ok(new Set(rosterOf(c).map(p => p.home)).size >= 8, c);
    for (const p of rosterOf(c)) {
      assert.ok(towns.includes(p.home), `${c}: ${p.home}`);
      assert.equal(new Set(p.hobbies).size, 2, `${c} ${p.name}`);
      for (const k of p.hobbies) for (const l of ['en', 'vi']) assert.ok(pack[l][`hobby.${k}`], `${l} ${k}`);
    }
    if (c !== 'vn') assert.ok(towns.every(t => !LEGACY_HOMES.has(t)), c);
  }
  assert.deepEqual(rosterOf('br')[7], rosterOf('br')[7]);
  assert.deepEqual(lifeOfSeed('ke', 'u12'), lifeOfSeed('ke', 'u12'));
});

test('applicants and managers are people of the country played, never one already employed', () => {
  const board = applicantsFor('farm', 77, undefined, 'et', []);
  const towns = HOMES.et.split('|');
  for (const a of board) { assert.ok(towns.includes(a.home), a.home); assert.ok(a.hobbies.length && a.age >= 18); }
  assert.ok(new Set(board.map(a => a.name)).size === board.length);
  const taken = rosterOf('jp').filter(p => p.gender === 'male').slice(1).map(p => p.name), set = new Set(taken);
  assert.equal(drawPerson('jp', 'male', () => .3, set).name, rosterOf('jp').filter(p => p.gender === 'male')[0].name);
  const all = new Set(rosterOf('jp').map(p => p.name));
  const extra = drawPerson('jp', 'male', () => .3, all);
  assert.ok(extra.name && !all.has(extra.name) && HOMES.jp.split('|').includes(extra.home), 'a numbered name once everyone is hired');
  assert.ok(gmCandidatesFor(5, 'kr', []).every(g => rosterOf('kr').some(p => p.name === g.name)));
});

const T0 = 1_800_000_000_000;
function hired() {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: false, sandbox: true }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone'); g.act('world/unlockRegion', { regionId: 'br-1' }); g.act('world/enterRegion', { regionId: 'br-1' }); g.act('play/chooseGame', { game: 'farm' });
  g.s.player.coins = 1000; g.s.wallet.gold['br-1'] = 1000;
  assert.equal(g.act('staff/recruit', { zone: 'farm', index: 0 }).ok, true);
  return g;
}
const unit = g => g.s.staff.units[0];

test('a new hire has a staff number and a valid health certificate', () => {
  const g = hired(), u = unit(g);
  assert.match(D.employeeCode(u), /^NV-\d{4}$/);
  assert.equal(D.employeeCode(u), D.employeeCode(JSON.parse(JSON.stringify(u))));
  const c = D.checkupOf(u);
  assert.deepEqual([c.at, c.expired, c.left], [T0, false, CHECKUP.validMin]);
  assert.ok(['I', 'II', 'III'].includes(c.grade));
  assert.ok(HOMES.br.split('|').includes(u.home) && u.hobbies.length === 2);
});

test('a new exam is refused while valid, costs Gold once expired, and restarts the clock', () => {
  const g = hired(), id = unit(g).uid;
  assert.equal(g.act('staff/checkup', { uid: id }).noop, true);
  g.s.staff.units[0].tenurePlayedMin = CHECKUP.validMin;
  assert.equal(D.checkupOf(unit(g)).expired, true);
  g.s.player.coins = CHECKUP.cost - 1;
  assert.equal(g.act('staff/checkup', { uid: id }).error, 'coins');
  g.s.player.coins = 500; g.now += 1000;
  assert.equal(g.act('staff/checkup', { uid: id }).ok, true);
  assert.equal(g.s.player.coins, 500 - CHECKUP.cost);
  assert.deepEqual([D.checkupOf(unit(g)).expired, D.checkupOf(unit(g)).at, D.checkupOf(unit(g)).left], [false, g.now, CHECKUP.validMin]);
  assert.equal(g.act('staff/checkup', { uid: 'nobody' }).error, 'unknown');
});

test('health class falls with age and bad condition; saves keep or get a certificate', () => {
  assert.equal(checkupGrade({ age: 25, energy: 100, morale: 100, fullness: 100, stats: { stamina: 1 } }), 'I');
  assert.equal(checkupGrade({ age: 50, energy: 100, morale: 80, fullness: 100, stats: { stamina: 1 } }), 'II');
  assert.equal(checkupGrade({ age: 58, energy: 20, morale: 20, fullness: 30, stats: { stamina: 1 } }), 'III');
  const g = hired(), raw = JSON.parse(JSON.stringify(g.s));
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(raw)), T0 + 9).staff.units[0].checkup, raw.staff.units[0].checkup);
  delete raw.staff.units[0].checkup; raw.staff.units[0].tenurePlayedMin = 40;
  const m = normalizeSave(raw, T0 + 9).staff.units[0];
  assert.deepEqual([m.checkup.at, m.checkup.atTenure, D.checkupOf(m).expired], [T0 + 9, 40, false]);
});

