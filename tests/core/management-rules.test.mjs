// Management Rules v1.1 (docs/design/management-rules.md, all §8 answers "as proposed"): reference income I(L), the
// income series, loans s.loans[], the played clock + shift-day tenure, the one task inbox s.tasks with its 4 penalty
// layers, GM pay / arrears / quit, the permission order, the planner v2 limits, the unified history and the robot
// numbers. Exact numbers come from economy.js and the spec's worked examples (§2.7, §4.4, §4.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { playing, harness } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import * as E from '../../src/core/config/economy.js';
import { apply } from '../../src/core/game.js';
import { normalizeSave, clone } from '../../src/core/state.js';

const { INCOME_REF, INCOME_FLOOR, incomeRef, LOAN, loanOwed, loanTermMin, TASKS, PENALTY, GM, HISTORY, CAREER, ROBOT_PARTS, PART_COST, UPKEEP,
  STAFF, SOFTWARE, xpForLevel, gmSalary, gmCandidatesFor, GM_RULES, robotCap, LAND } = E;

const MIN = 60000;

// ---------- harness helpers ----------
// A farm region at `level` (the Level-10 incident off) with `coins`.
function farm(level = 6, coins = 1e5) {
  const h = playing();
  h.must('play/chooseGame', { game: 'farm' });
  h.state.story.level10Done = true;
  h.state.tutorial.farmDone = true;
  h.must('dev/set', { coins, level });
  return h;
}
// …with the board's first manager: seed 7 → Hằng, skill 2, balanced, loyalty 63 (salary 40 in operator).
function withGm(level = 6, coins = 1e5, mode = null) {
  const h = farm(level, coins);
  h.must('gm/hire', { index: 0 });
  if (mode) h.must('gm/setMode', { mode });
  return h;
}
const gm = h => h.state.gm.unit;
const hire = (h, type) => h.must('staff/hire', { type }).events.find(e => e.type === 'hired').uid;
// Played time: clock/tick in steps of at most CLOCK.maxTickMs, real time moving with it (no "return").
function play(h, ms) {
  while (ms > 0) {
    const d = Math.min(E.CLOCK.maxTickMs, ms);
    h.tick(d);
    h.must('clock/tick', { ms: d });
    ms -= d;
  }
}
const playTo = (h, playedMs) => play(h, playedMs - D.playedMs(h.state));
// An inbox task straight into the state (the shape fileTask writes). act gm/topUpSeen = a harmless job when approved.
let tn = 0;
function inject(h, { kind = 'staffGrowth', by = 'g1', life = null, key = null, act = { type: 'gm/topUpSeen', payload: {} }, cost = 0, zone = 'farm' } = {}) {
  const P = D.playedMs(h.state), id = `tt${++tn}`;
  const t = { id, kind, key: key || `test:${id}`, group: TASKS.groupOf[kind] || 'hr', by, act, cost, value: 0, reason: ['test', {}], zone,
    atPlayed: P, untilPlayed: P + (life ?? TASKS.life[kind]) * MIN, remindedAt: [P], status: 'open', regionId: h.state.world.currentRegion };
  h.state.tasks.open.push(t);
  return id;
}
const task = (h, id) => D.taskById(h.state, id);
// Income series: `perMin` earned by the player in each of the last `minutes` played minutes (I10 / I30 = sums).
function seedIncome(h, perMin, minutes = 30, atMs = D.playedMs(h.state)) {
  const m = Math.floor(atMs / MIN);
  h.state.income.rows = Array.from({ length: minutes }, (_, i) => ({ m: m - minutes + 1 + i, earned: perMin, spent: 0, by: { player: perMin } }));
}
// A GM_RULES row that always fires on the farm (metric coins ≥ 0), for driving gm/think deterministically.
const rule = (key, act = 'staff/fire', licence = 'hr') => ({ key, group: 'capital', licence, zone: 'farm', metric: 'coins', op: '>=', value: 0, urgency: 'growth',
  act, args: 'none', cost: 'none', valueOf: 'none', reason: 'test' });
function withRules(rows, fn) {
  GM_RULES.push(...rows);
  try { return fn(); } finally { for (const r of rows) GM_RULES.splice(GM_RULES.indexOf(r), 1); }
}
const histOf = (h, type) => h.state.history.rows.filter(r => r.type === type);

// ---------- §2.0 reference income ----------
test('I(L): per-game INCOME_REF, interpolated, flat past the last key; unknown game → farm', () => {
  assert.deepEqual(INCOME_REF.farm, { 1: 80, 3: 150, 6: 250, 10: 310, 15: 440, 20: 550, 30: 750 });
  assert.deepEqual(INCOME_REF.cafe, { 1: 80, 3: 200, 6: 440, 10: 620, 15: 1050, 20: 1300, 30: 1800 });
  assert.equal(incomeRef('farm', 6), 250);
  assert.equal(incomeRef('cafe', 6), 440);
  assert.ok(Math.abs(incomeRef('farm', 4) - 550 / 3) < 1e-9, 'farm Lv4 = 150 + 100 / 3');
  assert.equal(incomeRef('farm', 8), 280);
  assert.equal(incomeRef('cafe', 8), 530);
  assert.equal(incomeRef('farm', 99), 750);
  assert.equal(incomeRef('moon', 6), 250);
  assert.equal(INCOME_FLOOR, 0.3);
});

test('I10 / I30: sums over played minutes, never below 0.3 × I(L) × minutes', () => {
  const h = farm(6);
  assert.equal(D.incomePerMin(h.state), 250);
  assert.equal(D.I10(h.state), 750, 'a new save starts at the floor: 0.3 × 250 × 10');
  assert.equal(D.I30(h.state), 2250);
  seedIncome(h, 250);
  assert.equal(D.I10(h.state), 2500, '§4.4: I10 ≈ 2 500');
  assert.equal(D.I30(h.state), 7500, '§4.4: I30 ≈ 7 500');
  seedIncome(h, 10);
  assert.equal(D.I10(h.state), 750, 'below the floor → the floor');
  const c = farm(6); c.state.world.regions[c.state.world.currentRegion].mode = 'cafe';
  assert.equal(D.I10(c.state), 0.3 * 440 * 10, 'café has its own curve');
});

test('s.income rows: earn / spend write one row per played minute with by player | g1 | staff', () => {
  const h = withGm(6); // hire GM.hireFeePerSkill × skill 2 = 500 (player)
  h.must('gm/buyLicence', { group: 'beans' }); // 300 (player)
  let row = h.state.income.rows.at(-1);
  const spent = 2 * GM.hireFeePerSkill + 300;
  assert.equal(row.m, 0);
  assert.equal(row.spent, spent);
  assert.equal(row.by.player, -spent);
  h.must('dev/grant', { coins: 1000 });
  row = h.state.income.rows.at(-1);
  assert.equal(row.earned, 1000);
  assert.equal(row.by.player, 1000 - spent);
  // a unit's own job (payload uid) → staff
  h.state.inventory.beans = 5;
  h.must('farm/sell', { good: 'beans', amount: 5, uid: 'u99' });
  assert.ok(h.state.income.rows.at(-1).by.staff > 0, 'staff sale booked by staff');
  // the manager's own job → g1 (storage full → he sells alone, under highValue)
  h.state.inventory.beans = D.capacity(h.state);
  h.must('gm/think', { roll: 0.3 });
  assert.ok(h.state.income.rows.at(-1).by.g1 > 0, 'GM sale booked by g1');
  // next played minute → a new row
  play(h, MIN);
  h.must('dev/grant', { coins: 10 });
  assert.equal(h.state.income.rows.at(-1).m, 1);
  assert.ok(h.state.income.rows.length <= E.INCOME.keepMinutes);
});

// ---------- §2.7 / §4.5 loans ----------
test('loans: pack level gates 1000 Lv4 / 2000 Lv6 / 5000 Lv8, max 2 open, unknown pack', () => {
  assert.deepEqual(LOAN.packLevel, { 1000: 4, 2000: 6, 5000: 8 });
  const h3 = farm(3);
  assert.equal(h3.act('loan/take', { amount: 1000 }).error, 'level');
  const h4 = farm(4);
  assert.equal(h4.act('loan/take', { amount: 2000 }).error, 'level');
  assert.deepEqual(h4.act('loan/take', { amount: 2000 }).data, { minLevel: 6 });
  h4.must('loan/take', { amount: 1000 });
  const h6 = farm(6);
  assert.equal(h6.act('loan/take', { amount: 5000 }).error, 'level');
  h6.must('loan/take', { amount: 2000 });
  const h8 = farm(8);
  h8.must('loan/take', { amount: 1000 });
  h8.must('loan/take', { amount: 1000 });
  assert.equal(h8.state.loans.length, 2);
  assert.equal(h8.act('loan/take', { amount: 1000 }).error, 'loanMax');
  assert.equal(h8.act('loan/take', { amount: 1234 }).error, 'unknown');
});

// §2.7 reads creditLimit on the REFERENCE 10-minute income 10 × I(L), not the measured I10 (§2.0): the spec's worked
// numbers 3 850 / 6 000 / 7 560 only fit the reference reading (a fresh save's measured I10 is the 0.3 floor, which
// would give 1.5 × 750 × 1.6 = 1 800 at Lv6). Pending the founder's confirmation (§8 Q13), pinned here as coded.
test('creditLimit = 1.5 × 10 × I(L) × (1 + 0.1 × L): farm Lv4 3 850, Lv6 6 000, Lv8 7 560; binds on the total owed', () => {
  assert.equal(D.creditLimit(farm(4).state), 3850);
  assert.equal(D.creditLimit(farm(6).state), 6000);
  // measured income does not move it: 2× and 0.3× the reference earned over the last 30 played minutes
  const hi = farm(6), lo = farm(6);
  seedIncome(hi, 2 * incomeRef('farm', 6)); seedIncome(lo, 0.3 * incomeRef('farm', 6));
  assert.equal(D.I10(hi.state), 2 * 10 * incomeRef('farm', 6), 'the seeded series is read');
  assert.deepEqual([D.creditLimit(hi.state), D.creditLimit(lo.state)], [6000, 6000]);
  const h = farm(8);
  assert.equal(D.creditLimit(h.state), 7560);
  h.must('loan/take', { amount: 5000 }); // owed 5 500
  assert.equal(h.act('loan/take', { amount: 2000 }).error, 'credit', '5 500 + 2 200 > 7 560');
  h.must('loan/take', { amount: 1000 }); // 6 600 ≤ 7 560
  assert.equal(D.loanTotal(h.state), 6600);
});

test('loan term = clamp(round10up(2 × owed / (0.2 × I(L))), 30, 150): farm Lv6 1000 → 50, 2000 → 90; Lv8 5000 → 150', () => {
  assert.equal(loanOwed(1000), 1100);
  assert.equal(loanTermMin(1100, 250), 50);
  assert.equal(loanTermMin(2200, 250), 90);
  assert.equal(loanTermMin(5500, 280), 150);
  assert.equal(loanTermMin(1, 1000), 30, 'floor 30');
  const h = farm(6);
  h.must('loan/take', { amount: 1000 });
  assert.deepEqual(h.state.loans[0], { id: h.state.loans[0].id, amount: 1000, owed: 1100, takenAtPlayed: 0, termMin: 50, late: false });
  assert.equal(h.state.player.coins, 1e5 + 1000, 'borrowed coins are not income');
  assert.equal(D.incomeEarned(h.state, 10), 0);
});

test('autoRepay: 20 % of every income to the oldest loan first, then the next', () => {
  const h = farm(6, 0);
  h.must('loan/take', { amount: 1000 }); // 1 100
  h.must('loan/take', { amount: 2000 }); // 2 200
  const [a, b] = h.state.loans.map(l => l.id);
  h.must('dev/grant', { coins: 1000 });
  assert.equal(h.state.loans.find(l => l.id === a).owed, 900, '200 to the oldest');
  assert.equal(h.state.loans.find(l => l.id === b).owed, 2200);
  assert.equal(h.state.player.coins, 3000 + 800);
  h.must('dev/grant', { coins: 5000 }); // cut 1000: 900 clears the first, 100 to the second
  assert.equal(h.state.loans.length, 1);
  assert.equal(h.state.loans[0].id, b);
  assert.equal(h.state.loans[0].owed, 2100);
});

test('late: +5 % once at the term, then blocked; cleared → unblocked (played time only)', () => {
  const h = farm(6, 0);
  h.must('loan/take', { amount: 1000 }); // term 50 (term mul 2)
  h.state.player.coins = 0;
  h.tick(3 * 3600000); // real time does not count
  assert.equal(h.act('loan/tick').noop, true);
  playTo(h, 50 * MIN - 1000);
  assert.equal(h.act('loan/tick').noop, true, 'not yet');
  play(h, 1000);
  h.must('loan/tick');
  assert.equal(h.state.loans[0].owed, Math.round(1100 * 1.05));
  assert.equal(h.state.loans[0].late, true);
  assert.equal(D.loanBlocked(h.state), true);
  assert.equal(h.act('loan/take', { amount: 1000 }).error, 'loanBlocked');
  assert.equal(h.act('loan/tick').noop, true, 'the fee is charged once');
  assert.equal(histOf(h, 'loanLate').length, 1);
  h.state.player.coins = 2000;
  h.must('loan/repay');
  assert.equal(h.state.loans.length, 0);
  assert.equal(D.loanBlocked(h.state), false);
  h.must('loan/take', { amount: 1000 });
});

test('old s.loan migrates to s.loans[] (idempotent normalizeSave)', () => {
  const h = farm(6);
  const raw = clone(h.state);
  delete raw.loans;
  raw.loan = { amount: 1000, owed: 1100, takenAt: 5 };
  const a = normalizeSave(raw, h.now);
  assert.equal(a.loan, undefined);
  assert.equal(a.loans.length, 1);
  assert.deepEqual(a.loans[0], { id: 'L0', amount: 1000, owed: 1100, takenAtPlayed: 0, termMin: 50, late: false });
  const b = normalizeSave(clone(a), h.now);
  assert.deepEqual(b.loans, a.loans);
  assert.deepEqual(b.debt, a.debt);
});

// ---------- §4.1 played clock / §2.5 tenure ----------
test('played clock: clock/tick only in play, ≤ maxTickMs per tick, real time ignored', () => {
  const pre = harness();
  assert.equal(pre.act('clock/tick', { ms: 5000 }).noop, true, 'not playing');
  const h = farm(6);
  h.must('clock/tick', { ms: 5000 });
  assert.equal(h.state.clock.played, 5000);
  h.must('clock/tick', { ms: 10 * MIN });
  assert.equal(h.state.clock.played, 5000 + E.CLOCK.maxTickMs, 'a stalled tab never jumps the clock');
  assert.equal(h.act('clock/tick', { ms: 0 }).noop, true);
  assert.equal(h.act('clock/tick', { ms: -5 }).noop, true);
  h.tick(3600000);
  h.must('dev/grant', { coins: 1 });
  assert.equal(h.state.clock.played, 35000);
});

test('tenure in shift-days of played time: skilled Lv7 / 2 sd, lead Lv9 / 4 sd, manager Lv13 / 12 sd', () => {
  assert.equal(CAREER.shiftDayMin, 5);
  assert.deepEqual(CAREER.need.skilled, { level: 7, sd: 2 });
  assert.deepEqual(CAREER.need.lead, { level: 9, sd: 4 });
  assert.deepEqual(CAREER.need.manager, { level: 13, sd: 12 });
  const h = farm(6);
  const id = hire(h, 'farmhand');
  const u = () => D.unitOf(h.state, id);
  u().stats = { speed: 3, smart: 3, accuracy: 2, stamina: 2 }; // level 7 → staff
  u().rank = 'staff';
  assert.equal(E.unitLevel(u()), 7);
  assert.equal(D.promoteError(h.state, u(), h.now), 'days');
  play(h, 9.5 * MIN);
  assert.equal(D.tenureShiftDays(u()), 1);
  assert.equal(D.promoteError(h.state, u(), h.now), 'days');
  h.tick(24 * 3600000); // a real day changes nothing
  assert.equal(D.promoteError(h.state, u(), h.now), 'days');
  play(h, 0.5 * MIN);
  assert.equal(D.tenureShiftDays(u()), 2);
  assert.equal(D.promoteError(h.state, u(), h.now), null);
});

// ---------- §4 the inbox ----------
test('task kinds: life and reminders (played minutes)', () => {
  assert.deepEqual(TASKS.life, { care: 5, trade: 10, staffGrowth: 30, land: 60, loan: 30, poach: 1, gmPoach: 3, topUp: 60 });
  assert.deepEqual(TASKS.remindLastMin, { care: 1, trade: 1, staffGrowth: 2, land: 5, loan: 2 });
  assert.equal(TASKS.cap, 8);
  const h = withGm(6);
  const id = inject(h, { kind: 'trade' });
  play(h, 4.5 * MIN);
  assert.equal(h.events.filter(e => e.type === 'taskRemind').length, 0);
  play(h, 0.5 * MIN);
  assert.equal(h.events.filter(e => e.type === 'taskRemind').length, 1, 'at 50 %');
  play(h, 4 * MIN);
  const r = h.events.filter(e => e.type === 'taskRemind');
  assert.equal(r.length, 2, 'and the last minute');
  assert.equal(r[1].last, true);
  assert.equal(task(h, id).status, 'open');
  play(h, MIN);
  assert.equal(task(h, id).status, 'expired');
  assert.equal(D.tasksOpen(h.state).length, 0);
  assert.equal(h.state.tasks.cool[`test:${id}`], D.playedMs(h.state) + PENALTY.cooldownMin.expired * MIN, 'cooldown 10 after expiry');
});

test('expiry penalties: loyalty −3, backlog +1, fine min(0.03 × I30, 0.25 × I10 − fines30, coins), zone morale −3', () => {
  const h = withGm(6);
  const w = hire(h, 'farmhand');
  const morale0 = D.unitOf(h.state, w).morale;
  seedIncome(h, 250);
  const coins0 = h.state.player.coins;
  const id = inject(h, { life: 1 });
  seedIncome(h, 250, 30, D.playedMs(h.state) + MIN); // the reference income at the moment it runs out
  play(h, MIN);
  const t = task(h, id);
  assert.equal(t.status, 'expired');
  assert.equal(t.fine, 225, '0.03 × 7 500');
  assert.equal(gm(h).loyalty, 63 - 3);
  assert.equal(gm(h).backlog, 1);
  assert.equal(D.unitOf(h.state, w).morale, morale0 - 3);
  assert.equal(h.state.player.coins, coins0 - 225);
  assert.equal(h.state.income.rows.at(-1).by.penalty, -225, 'booked as penalty');
});

test('fine is never more than the coins and never below 0', () => {
  const h = withGm(6);
  seedIncome(h, 250);
  h.state.player.coins = 30;
  const a = inject(h, { life: 1 }), b = inject(h, { life: 1 });
  play(h, MIN);
  assert.equal(task(h, a).fine, 30);
  assert.equal(task(h, b).fine ?? 0, 0);
  assert.equal(h.state.player.coins, 0);
});

test('caps: loyalty ≤ 15 a day, fines ≤ 25 % of I10 per 30 played minutes, morale ≤ 30 per zone a day', () => {
  const h = withGm(6);
  const w = hire(h, 'farmhand');
  const m0 = D.unitOf(h.state, w).morale;
  const ids = Array.from({ length: 11 }, () => inject(h, { life: 1 }));
  play(h, MIN);
  assert.ok(ids.every(id => task(h, id).status === 'expired'));
  assert.equal(gm(h).loyalty, 63 - 15);
  assert.equal(D.unitOf(h.state, w).morale, m0 - 30);
  const fines = ids.map(id => task(h, id).fine || 0);
  // floor income: I30 2 250 → 67 per task, I10 750 → cap 187.5
  assert.deepEqual(fines.slice(0, 3), [67, 67, 53]);
  assert.ok(fines.reduce((a, b) => a + b, 0) <= 0.25 * D.I10(h.state));
});

test('§4.4 worked session (farm Lv6, I10 2 500, I30 7 500): fines 225 / 225 / 225 / 175 = 850, loyalty −3 each', () => {
  const h = withGm(6);
  assert.deepEqual([gm(h).skill, gm(h).style, h.state.gm.mode, h.state.gm.budget, h.state.gm.bigLimit, D.gmHighValue(h.state)], [2, 'balanced', 'operator', 100, 300, 5000]);
  const P0 = D.playedMs(h.state);
  const at = min => P0 + min * MIN;
  // the four task deadlines of the table: hire 34:00, land 64:00, sale 70:00, hire again 74:00
  const ids = [34, 64, 70, 74].map(m => inject(h, { life: m }));
  const fineAt = (m, coins = 1e5) => { playTo(h, at(m) - 1000); seedIncome(h, 250, 30, at(m)); h.state.player.coins = coins; play(h, 1000); };
  const l0 = gm(h).loyalty;
  fineAt(34, 560);
  assert.equal(task(h, ids[0]).fine, 225, 'min(225, 625, 560)');
  fineAt(64);
  assert.equal(task(h, ids[1]).fine, 225, 'the 34:00 fine is outside (34, 64]');
  fineAt(70);
  assert.equal(task(h, ids[2]).fine, 225, 'min(225, 625 − 225)');
  fineAt(74);
  assert.equal(task(h, ids[3]).fine, 175, 'min(225, 625 − 450)');
  assert.equal(ids.reduce((n, id) => n + task(h, id).fine, 0), 850);
  assert.equal(gm(h).loyalty, l0 - 12);
});

test('§4.4 worked session: backlog 3 at 74:00 → Chờ lệnh; late approve at 78:00 (+1, backlog 2, waiting ends)', () => {
  const h = withGm(6);
  const P0 = D.playedMs(h.state);
  const ids = [34, 64, 70, 74].map(m => inject(h, { life: m }));
  playTo(h, P0 + 44 * MIN);
  assert.equal(gm(h).backlog, 0, '44:00 backlog decays to 0');
  playTo(h, P0 + 74 * MIN);
  assert.equal(gm(h).backlog, 3, 'spec table: 64 → 1, 70 → 2, 74 → 3');
  assert.equal(D.gmWaiting(h.state), true);
  playTo(h, P0 + 78 * MIN);
  const l = gm(h).loyalty;
  h.must('task/late', { id: ids[3] });
  assert.equal(gm(h).loyalty, l + 1 + GM.mood.jobLoyalty);
  assert.equal(gm(h).backlog, 2);
  assert.equal(D.gmWaiting(h.state), false);
});

test('throttle: backlog 3 → Chờ lệnh (10 min), 6 → poachable, 8 → strike; decay −1 / 10 min (−2 with no task of his open)', () => {
  const h = withGm(6);
  for (let i = 0; i < 3; i++) inject(h, { life: 1 });
  play(h, MIN);
  assert.equal(gm(h).backlog, 3);
  assert.equal(D.gmWaiting(h.state), true);
  assert.equal(gm(h).waiting.untilPlayed, D.playedMs(h.state) + PENALTY.backlog.waitMin * MIN);
  assert.equal(D.gmPoachable(h.state), false);
  for (let i = 0; i < 3; i++) inject(h, { life: 1 });
  play(h, MIN);
  assert.equal(gm(h).backlog, 6);
  assert.equal(D.gmPoachable(h.state), true);
  h.must('gm/rivalVisit', { roll: 0.99 }); // a loyal-or-not roll miss: poachable → the rival talks to him anyway
  assert.ok(D.gmPoachOf(h.state), 'next rival visit targets him');
  inject(h, { life: 30 }); // one of his tasks stays open (an empty inbox ends a strike)
  for (let i = 0; i < 2; i++) inject(h, { life: 1 });
  play(h, MIN);
  assert.equal(gm(h).backlog, 8);
  assert.ok(D.gmStrike(h.state));
  // decay
  const d = withGm(6);
  d.state.gm.unit.backlog = 2;
  play(d, 10 * MIN);
  assert.equal(gm(d).backlog, 0, 'inbox empty: −2');
  const e = withGm(6);
  e.state.gm.unit.backlog = 2;
  inject(e, { life: 30 });
  play(e, 10 * MIN);
  assert.equal(gm(e).backlog, 1, 'a task of his open: −1');
});

test('deny: no penalty, loyalty −1, cooldown 15 played min, backlog −1', () => {
  const h = withGm(6);
  h.state.gm.unit.backlog = 1;
  const coins = h.state.player.coins;
  const id = inject(h, { key: 'k:deny' });
  h.must('task/deny', { id });
  assert.equal(task(h, id).status, 'denied');
  assert.equal(task(h, id).fine, undefined);
  assert.equal(h.state.player.coins, coins);
  assert.equal(gm(h).loyalty, 62);
  assert.equal(gm(h).backlog, 0);
  assert.equal(D.taskCooling(h.state, 'k:deny'), true);
  play(h, 15 * MIN - 1000);
  assert.equal(D.taskCooling(h.state, 'k:deny'), true);
  play(h, 1000);
  assert.equal(D.taskCooling(h.state, 'k:deny'), false);
});

test('late approve: within 5 played min of expiry (+1, backlog −1, cooldown cleared, fine kept); after that refused', () => {
  const h = withGm(6);
  seedIncome(h, 250);
  const id = inject(h, { life: 1, key: 'k:late' });
  play(h, MIN);
  const fine = task(h, id).fine;
  assert.ok(fine > 0);
  const coins = h.state.player.coins;
  play(h, 4 * MIN);
  h.must('task/late', { id });
  assert.equal(task(h, id).status, 'late');
  assert.equal(gm(h).loyalty, 63 - 3 + PENALTY.lateLoyalty + GM.mood.jobLoyalty, '+1 (not +2) and the job itself +0.3');
  assert.equal(gm(h).backlog, 0);
  assert.equal(D.taskCooling(h.state, 'k:late'), false);
  assert.equal(h.state.player.coins, coins, 'fine not refunded');
  const o = withGm(6);
  const id2 = inject(o, { life: 1 });
  play(o, MIN);
  play(o, 5.5 * MIN);
  assert.equal(o.act('task/late', { id: id2 }).error, 'unknown');
});

test('approve in time: +2 loyalty, backlog −1; coins short → failed', () => {
  const h = withGm(6);
  h.state.gm.unit.backlog = 2;
  const id = inject(h, { key: 'k:ok' });
  const r = h.must('task/approve', { id });
  assert.equal(task(h, id).status, 'approved');
  assert.equal(r.events.some(e => e.type === 'gmFailed'), false, 'a job that ran is not reported as failed');
  assert.equal(histOf(h, 'failed').length, 0);
  assert.equal(h.state.tasks.cool['k:ok'], D.playedMs(h.state) + PENALTY.cooldownMin.done * MIN, 'done cooldown (1), not failed');
  assert.equal(gm(h).loyalty, 63 + GM.mood.approveLoyalty + GM.mood.jobLoyalty);
  assert.equal(gm(h).backlog, 1);
  h.state.player.coins = 10;
  const id2 = inject(h, { cost: 500 });
  h.must('task/approve', { id: id2 });
  assert.equal(task(h, id2).status, 'failed');
});

test('apologise: 2 × salary → backlog 0, loyalty +10, strike over', () => {
  const h = withGm(6);
  inject(h, { life: 30 }); // one of his tasks stays open (an empty inbox ends a strike)
  for (let i = 0; i < 8; i++) inject(h, { life: 1 });
  play(h, MIN);
  assert.ok(D.gmStrike(h.state));
  const l = gm(h).loyalty, coins = h.state.player.coins;
  assert.equal(D.apologiseCost(h.state), 80, '§2.8: 🪙80 at Lv6 s2');
  h.must('gm/apologise');
  assert.equal(h.state.player.coins, coins - 80);
  assert.equal(gm(h).backlog, 0);
  assert.equal(gm(h).loyalty, l + 10);
  assert.equal(D.gmStrike(h.state), null);
  assert.equal(D.gmWaiting(h.state), false);
});

test('top-up and system tasks are never penalised', () => {
  const h = withGm(6);
  seedIncome(h, 250);
  const coins = h.state.player.coins;
  const id = inject(h, { kind: 'topUp', life: 1 });
  play(h, MIN);
  assert.equal(task(h, id).status, 'expired');
  assert.equal(h.state.player.coins, coins);
  assert.equal(gm(h).loyalty, 63);
  assert.equal(gm(h).backlog || 0, 0);
});

test('return: +2 played min grace for every open task; the loyalty lost on one return ≤ 40', () => {
  const h = withGm(6);
  play(h, 5000);
  const id = inject(h, { life: 1 });
  const P = D.playedMs(h.state);
  h.tick(10 * MIN); // app closed: no ticks
  h.must('clock/tick', { ms: 5000 });
  assert.equal(task(h, id).untilPlayed, P + TASKS.graceMin * MIN);
  assert.ok(h.events.some(e => e.type === 'tasksWaiting' && e.n === 1));
  assert.equal(task(h, id).status, 'open');
  playTo(h, P + 2 * MIN);
  assert.equal(task(h, id).status, 'expired');
  // 5 h away: −30 (away) and the expiries of the grace minutes, together ≤ 40
  const g = withGm(6);
  for (let i = 0; i < 5; i++) inject(g, { life: 1 });
  const l0 = gm(g).loyalty;
  g.tick(5 * 3600000);
  g.must('gm/seen');
  assert.equal(gm(g).loyalty, l0 - 30);
  play(g, TASKS.graceMin * MIN);
  assert.equal(D.tasksOpen(g.state).filter(t => t.by === 'g1').length, 0);
  assert.equal(gm(g).loyalty, l0 - PENALTY.returnLoyaltyCap);
});

// ---------- §2.6 GM pay ----------
test('GM salary: 20 × skill × modeMul (advisor .5, operator 1, full 1.6) × (1 + .2 × raises); share 5 % in operator and full', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(GM.modes).map(([k, v]) => [k, [v.mul, v.share]])), { advisor: [0.5, 0], operator: [1, 0.05], full: [1.6, 0.05] });
  const g = { skill: 2 };
  assert.equal(gmSalary(g, 'advisor'), 20);
  assert.equal(gmSalary(g, 'operator'), 40);
  assert.equal(gmSalary(g, 'full'), 64);
  assert.equal(gmSalary({ skill: 2, raises: 1 }, 'operator'), 48);
  assert.equal(GM.keepBonusSalaries, 6);
});

test('payroll: base + 5 % of the profit of jobs the GM ran (by g1) only', () => {
  for (const [mode, base] of [['operator', 40], ['full', 64]]) {
    const h = withGm(6, 1e5, mode === 'full' ? 'full' : null);
    h.state.clock.played = 3 * MIN;
    h.state.income.rows = [0, 1, 2].map(m => ({ m, earned: 0, spent: 0, by: { g1: m < 2 ? 500 : 0, player: 5000 } }));
    const coins = h.state.player.coins;
    h.tick(4 * MIN);
    h.must('gm/payroll');
    assert.equal(Math.round((coins - h.state.player.coins) * 100) / 100, Math.round((base * 0.4 + 0.05 * 1000) * 100) / 100, `${mode}: base × 4/10 + 5 % of 1 000`);
  }
});

test('partial payroll → s.debt.wages.gm, paid first from the next income; 10 unpaid salaries → he quits (no chaos)', () => {
  const h = withGm(6);
  h.state.player.coins = 10;
  const l = gm(h).loyalty;
  h.tick(4 * MIN);
  h.state.gm.lastJobAt = h.state.gm.seenAt = h.now; // no idle / absent drain mixed in
  h.must('gm/payroll'); // 16 due
  assert.equal(h.state.player.coins, 0);
  assert.equal(h.state.debt.wages.gm, 6);
  assert.equal(gm(h).loyalty, l - 4, '−1 per unpaid minute');
  h.must('dev/grant', { coins: 100 });
  assert.equal(h.state.debt.wages.gm, 0);
  assert.equal(h.state.player.coins, 94);
  // quit
  h.state.player.coins = 0;
  h.state.debt.wages.gm = 395;
  assert.equal(D.gmQuitArrears(h.state), 400);
  h.tick(4 * MIN);
  h.must('gm/payroll');
  assert.equal(h.state.gm.unit, null);
  assert.equal(h.state.gm.chaos, null, 'a quit is no chaos');
  assert.ok(h.events.some(e => e.type === 'gmLeft' && e.why === 'quit'));
  assert.equal(h.state.debt.wages.gm, 0);
});

test('keep fee on a rival offer = 6 × salary; loyalty bands careful 75–95 / balanced 55–75 / bold 45–60', () => {
  const h = withGm(6);
  h.must('gm/rivalVisit', { roll: 0 }); // loyalty 63 < 70
  const t = D.tasksOpen(h.state).find(x => x.kind === 'gmPoach');
  assert.equal(t.cost, 240);
  assert.equal(t.untilPlayed - t.atPlayed, 3 * MIN);
  assert.deepEqual(GM.styles.bold.loyalty, [45, 60]);
  assert.deepEqual(GM.styles.balanced.loyalty, [55, 75]);
  assert.deepEqual(GM.styles.careful.loyalty, [75, 95]);
  for (let seed = 1; seed < 400; seed++) for (const c of gmCandidatesFor(seed)) {
    const [lo, hi] = GM.styles[c.style].loyalty;
    assert.ok(c.loyalty >= lo && c.loyalty <= hi, `${c.style} ${c.loyalty}`);
  }
});

// ---------- §3.1 permission order ----------
const cand = over => ({ key: 'c', group: 'capital', licence: 'hr', cost: 0, value: 0, sale: 0, always: false, act: { type: 'staff/upgradeStat', payload: {} }, ...over });

test('permission: full mode never bypasses alwaysApprove, bigLimit or highValue', () => {
  const h = withGm(6, 1e5, 'full');
  assert.equal(D.gmBudgetCap(h.state), 300, 'full = budget × 3');
  for (const type of ['loan/take', 'land/buyParcel', 'land/sell', 'staff/fire', 'gm/topUpSeen']) {
    assert.ok(GM.alwaysApprove.includes(type), type);
    assert.equal(D.gmPermission(h.state, cand({ act: { type }, always: true, licence: 'hr' }), h.now), 'file', type);
  }
  assert.equal(D.gmPermission(h.state, cand({ cost: 299 }), h.now), 'do');
  assert.equal(D.gmPermission(h.state, cand({ cost: 300 }), h.now), 'file', 'build / hire ≥ bigLimit');
  assert.equal(D.gmPermission(h.state, cand({ group: 'trade', licence: 'hr', sale: 4999 }), h.now), 'do');
  assert.equal(D.gmPermission(h.state, cand({ group: 'trade', licence: 'hr', sale: 5000 }), h.now), 'file', 'sell ≥ highValue');
  h.must('gm/setMode', { mode: 'operator' });
  assert.equal(D.gmPermission(h.state, cand({ cost: 250 }), h.now), 'file', 'operator budget 100');
  h.must('gm/setMode', { mode: 'advisor' });
  assert.equal(D.gmPermission(h.state, cand({ cost: 0 }), h.now), 'suggest');
});

test('permission: unlicensed → suggest; unpayable capital → loan proposal (credit licence, pays back in time) or suggest', () => {
  const h = withGm(6);
  h.state.player.coins = 100;
  const land = cand({ licence: 'land', cost: 600, value: 100, always: true, act: { type: 'land/buyParcel', payload: { parcelId: 'F5' } } });
  assert.equal(D.gmPermission(h.state, land, h.now), 'suggest', 'no Đất & xây licence');
  h.state.player.coins = 1e5;
  h.must('gm/buyLicence', { group: 'land' });
  h.state.player.coins = 100;
  assert.equal(D.gmPermission(h.state, land, h.now), 'suggest', 'cannot pay and no credit licence: never filed');
  h.state.player.coins = 1e5;
  h.must('gm/buyLicence', { group: 'credit' });
  h.state.player.coins = 100;
  assert.equal(D.gmPermission(h.state, land, h.now), 'loan');
  assert.deepEqual(D.gmLoanFor(h.state, land), { amount: 1000, termMin: 50, payback: 6 });
  assert.equal(D.gmPermission(h.state, { ...land, value: 1 }, h.now), 'suggest', 'payback 600 min ≥ term × 0.5');
});

test('licences: all from Lv6, prices 0 / 0 / 300 / 1000 / 1500, the player\'s, kept by the Level-10 wipe', () => {
  assert.deepEqual(GM.licences.prices, { hr: 0, assign: 0, beans: 300, land: 1000, credit: 1500 });
  assert.equal(farm(5).act('gm/buyLicence', { group: 'beans' }).error, 'level');
  const h = withGm(6);
  for (const [g, p] of [['beans', 300], ['land', 1000], ['credit', 1500]]) {
    const c = h.state.player.coins;
    h.must('gm/buyLicence', { group: g });
    assert.equal(c - h.state.player.coins, p, g);
  }
  assert.equal(h.act('gm/buyLicence', { group: 'beans' }).noop, true);
  h.state.story.level10Done = false;
  h.must('dev/grant', { xp: 1e6 });
  assert.equal(h.state.story.expiry.status, 'pending');
  h.must('expiry/execute');
  assert.equal(h.state.gm.unit, null);
  assert.deepEqual([...h.state.gm.licences].sort(), ['beans', 'credit', 'land']);
});

// ---------- §3.3–§3.7 planner ----------
test('planner: same state + roll → same result; ≤ 2 tasks filed per think', () => {
  const h = withGm(6);
  withRules(['t1', 't2', 't3', 't4', 't5'].map(k => rule(k)), () => {
    const s0 = clone(h.state), ctx = { now: h.now, dev: true };
    const a = apply(s0, { type: 'gm/think', payload: { roll: 0.42 } }, ctx), b = apply(clone(s0), { type: 'gm/think', payload: { roll: 0.42 } }, ctx);
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(a.events, b.events);
    h.must('gm/think', { roll: 0.42 });
    assert.equal(D.gmRequests(h.state).length, TASKS.maxFiledPerThink);
    h.must('gm/think', { roll: 0.42 });
    assert.equal(D.gmRequests(h.state).length, 4);
  });
});

test('planner: inbox cap 8 → «Để sau», logged at most once per 10 played min, never dropped into the inbox', () => {
  const h = withGm(6);
  for (let i = 0; i < 8; i++) inject(h, { life: 60, kind: 'land' });
  withRules(['u1', 'u2', 'u3'].map(k => rule(k)), () => {
    h.must('gm/think', { roll: 0.5 });
    assert.equal(D.tasksOpen(h.state).length, 8);
    assert.equal(histOf(h, 'later').length, 1);
    play(h, 2 * MIN);
    h.must('gm/think', { roll: 0.5 });
    assert.equal(histOf(h, 'later').length, 1, 'throttled');
    play(h, 9 * MIN);
    h.must('gm/think', { roll: 0.5 });
    assert.equal(histOf(h, 'later').length, 2);
    assert.equal(D.tasksOpen(h.state).length, 8);
  });
});

test('day plan: a crop per parcel; every job family keeps ≥ 1 unit; a team smaller than the families keeps everything', () => {
  const h = withGm(6);
  h.must('land/buyParcel', { parcelId: 'F2' });
  const one = hire(h, 'farmhand');
  assert.deepEqual(D.planTasks(h.state, 'farm', h.now).workers, { [one]: [] });
  hire(h, 'farmhand'); hire(h, 'farmhand');
  const plan = D.planTasks(h.state, 'farm', h.now);
  const all = Object.values(plan.workers).flat();
  for (const fam of ['harvest', 'plant']) assert.ok(all.includes(fam), fam);
  h.must('gm/planDay');
  const crops = h.state.gm.plan.crops;
  assert.deepEqual(Object.keys(crops).sort(), ['F1', 'F2']);
  for (const c of Object.values(crops)) assert.ok(D.cropUnlocked(h.state, c));
  assert.ok(histOf(h, 'dayPlan').length >= 1);
  assert.equal(h.state.gm.plan.target, Math.round(D.I10(h.state) * 2 * 1.1 / 10) * 10);
});

test('land: sell refund 0.6 × price; never a starter / the last lot; a freshly bought lot is never proposed', () => {
  assert.equal(LAND.sellRefund, 0.6);
  const h = withGm(6);
  assert.equal(D.landSellError(h.state, 'F1'), 'starter');
  h.must('land/buyParcel', { parcelId: 'F2' });
  assert.equal(D.landSellError(h.state, 'F2'), null);
  assert.equal(D.landSellRefund('F2'), 48);
  // 30 samples of the farm, none of the new lot → no proposal
  h.state.gm.util = { rows: Array.from({ length: 30 }, (_, i) => ({ m: i, z: { farm: 0.05 }, p: { F1: 0.05 }, q: {} })) };
  assert.equal(D.gmSnapshot(h.state, h.now, 'farm').landSell, null);
  h.state.gm.util = { rows: Array.from({ length: 30 }, (_, i) => ({ m: i, z: { farm: 0.05 }, p: { F1: 0.05, F2: 0 }, q: {} })) };
  assert.equal(D.gmSnapshot(h.state, h.now, 'farm').landSell?.parcelId, 'F2');
  const c = h.state.player.coins, earned = D.incomeEarned(h.state, 10), rows = clone(h.state.income.rows);
  h.must('land/sell', { parcelId: 'F2' });
  assert.equal(h.state.player.coins, c + 48);
  // §2.5 / §7.1: the refund is capital coming back, not income — the income series is untouched
  assert.equal(D.incomeEarned(h.state, 10), earned);
  assert.deepEqual(h.state.income.rows, rows);
  // the last lot of its kind (no other decor lot owned) is never sold, nor is a lot not owned
  h.must('land/buyParcel', { parcelId: 'D1' });
  assert.equal(D.landSellError(h.state, 'D1'), 'last');
  assert.equal(h.act('land/sell', { parcelId: 'D1' }).error, 'last');
  assert.equal(D.landSellError(h.state, 'F2'), 'notOwned');
});

test('planner: ≤ 1 land proposal per 30 played min', () => {
  const h = withGm(6);
  h.must('gm/buyLicence', { group: 'land' });
  withRules([rule('l1', 'land/sell', 'land'), rule('l2', 'land/buyParcel', 'land')], () => {
    h.must('gm/think', { roll: 0.5 });
    assert.equal(D.gmRequests(h.state).filter(t => t.kind === 'land').length, 1);
    assert.equal(h.state.tasks.cool.land, D.playedMs(h.state) + GM.land.everyMin * MIN);
    play(h, 10 * MIN);
    h.must('gm/think', { roll: 0.5 });
    assert.equal(D.gmRequests(h.state).filter(t => t.kind === 'land').length, 1);
  });
});

test('top-up: only after 2 denied loan tasks today, I10 < half the plan target, ≤ 1 a day', () => {
  const h = withGm(6);
  const d = D.dayKey(h.now);
  h.state.gm.plan = { atPlayed: 0, crops: {}, target: 10000 };
  h.state.gm.topUp = { d, denied: 1, filed: 0 };
  assert.equal(D.topUpDue(h.state, h.now), false);
  h.state.gm.topUp = { d, denied: 2, filed: 0 };
  assert.equal(D.topUpDue(h.state, h.now), true);
  h.state.gm.topUp = { d, denied: 2, filed: 1 };
  assert.equal(D.topUpDue(h.state, h.now), false);
  h.state.gm.topUp = { d, denied: 2, filed: 0 };
  h.state.gm.plan.target = 1000;
  assert.equal(D.topUpDue(h.state, h.now), false, 'I10 750 ≥ 0.5 × 1 000');
  // denying a loan task counts
  const g = withGm(6);
  const id = inject(g, { kind: 'loan', act: { type: 'loan/take', payload: { amount: 1000 } } });
  g.must('task/deny', { id });
  assert.equal(g.state.gm.topUp.denied, 1);
});

// ---------- §5 history ----------
test('history: shared ring 400; u.recent 30 incl. the GM (uid g1); tombstones for units that leave', () => {
  const h = withGm(6);
  for (let i = 0; i < 410; i++) h.must('gm/topUpSeen');
  assert.equal(h.state.history.rows.length, HISTORY.rows);
  assert.equal(h.state.history.rows.at(-1).id, `h${h.state.history.seq}`);
  assert.equal(gm(h).recent.length, HISTORY.perUnit);
  assert.ok(gm(h).recent.every(r => r.subject === 'g1' || r.actor === 'g1'));
  const u = hire(h, 'farmhand');
  assert.ok(D.unitOf(h.state, u).recent.some(r => r.type === 'hired'));
  h.must('staff/fire', { uid: u });
  assert.ok(h.state.history.tombstones.some(t => t.uid === u && t.kind === 'worker'));
  h.must('gm/fire');
  assert.ok(h.state.history.tombstones.some(t => t.uid === 'g1' && t.kind === 'manager'));
});

test('Level-10 wipe keeps days, plan / approval rows, the follower\'s recent + tenure; trims the rest to 50', () => {
  const h = withGm(6);
  const f = hire(h, 'farmhand');
  play(h, 3 * MIN);
  for (let i = 0; i < 80; i++) h.must('gm/topUpSeen'); // approval rows (always kept)
  // > 50 rows of the trimmed groups: hire / fire pairs (hr) and loan take / repay pairs (money)
  for (let i = 0; i < 30; i++) h.must('staff/fire', { uid: hire(h, 'farmhand') });
  for (let i = 0; i < 5; i++) { h.must('loan/take', { amount: 1000 }); h.state.player.coins = 1e6; h.must('loan/repay'); }
  const keepG = HISTORY.keepGroupsOnWipe, num = r => Number(r.id.slice(1));
  const before = h.state.history.rows.filter(r => !keepG.includes(r.group));
  assert.ok(before.length > HISTORY.keepOthersOnWipe + 10, `${before.length} trimmed-group rows before the wipe`);
  const approvals = histOf(h, 'topUpSeen').length + h.state.history.rows.filter(r => r.group === 'plan').length;
  const days = clone(h.state.history.days);
  const recent = clone(D.unitOf(h.state, f).recent);
  const tenure = D.unitOf(h.state, f).tenurePlayedMin;
  assert.ok(tenure >= 3);
  h.state.story.level10Done = false;
  h.must('dev/grant', { xp: 1e6 });
  h.must('expiry/execute', { follower: f });
  const H = h.state.history;
  assert.equal(histOf(h, 'topUpSeen').length + H.rows.filter(r => r.group === 'plan').length, approvals);
  const others = H.rows.filter(r => !keepG.includes(r.group) && r.type !== 'rebirth');
  assert.equal(others.length, HISTORY.keepOthersOnWipe, 'exactly the newest 50 other rows survive');
  const dropped = before.filter(r => !H.rows.some(x => x.id === r.id));
  assert.ok(dropped.length >= 10);
  assert.ok(Math.min(...others.map(num)) > Math.max(...dropped.map(num)), 'the survivors are the newest by id');
  assert.ok(H.rows.some(r => r.type === 'rebirth'));
  for (const d of days) assert.ok(H.days.some(x => x.d === d.d && x.actor === d.actor));
  const u = D.unitOf(h.state, f);
  assert.deepEqual(u.recent.slice(0, recent.length).map(r => r.id), recent.map(r => r.id).slice(-(HISTORY.perUnit - 1)).slice(0, recent.length));
  assert.ok(u.recent.some(r => r.type === 'followed'));
  assert.equal(u.tenurePlayedMin, tenure, 'the follower keeps its tenure');
  assert.ok(H.tombstones.some(t => t.uid === 'g1'));
});

// ---------- §2.1–§2.5 robots ----------
test('robots: battery [6, 9, 13, 18]; recharge max(15, 0.03 × price) × [1, .8, .6, .4]; parts × [.15, .3, .5]', () => {
  assert.deepEqual(ROBOT_PARTS.battery.minutes, [6, 9, 13, 18]);
  assert.deepEqual(ROBOT_PARTS.battery.feeMul, [1, 0.8, 0.6, 0.4]);
  assert.equal(E.staffFee('sproutBot'), 36);
  assert.equal(E.staffFee('brewBot'), 45);
  assert.deepEqual([0, 1, 2, 3].map(t => E.unitFee({ type: 'sproutBot', parts: { battery: t } })), [36, 29, 22, 14]);
  assert.deepEqual([0, 1, 2, 3].map(t => E.batteryMinutes({ type: 'sproutBot', parts: { battery: t } })), [6, 9, 13, 18]);
  assert.deepEqual(PART_COST.costRatio, [0.15, 0.3, 0.5]);
  assert.deepEqual([0, 1, 2].map(t => E.partCost('sproutBot', t)), [180, 360, 600]);
  assert.deepEqual([0, 1, 2].map(t => E.partCost('brewBot', t)), [225, 450, 750]);
  // recharge min 15 for a cheap robot type
  assert.equal(Math.max(E.STAFF_BREAKS.robot.minFee, Math.round(100 * E.STAFF_BREAKS.robot.feeRatio)), 15);
});

test('robots: standby 3 % of price per 10 min while off shift; share ≤ ceil(slots / 2); precision → 2★', () => {
  assert.equal(UPKEEP.robotStandbyRatio, 0.03);
  assert.equal(D.upkeepOf({ type: 'sproutBot', active: false }), 36);
  assert.equal(D.upkeepOf({ type: 'brewBot', active: false }), 45);
  assert.equal(D.upkeepOf({ type: 'sproutBot', active: true }), 0);
  assert.deepEqual([0, 1, 4, 5, 6].map(robotCap), [0, 1, 2, 3, 3]);
  const h = farm(4);
  hire(h, 'sproutBot'); hire(h, 'sproutBot');
  assert.equal(h.act('staff/hire', { type: 'sproutBot' }).error, 'robotShare');
  hire(h, 'farmhand');
  const h5 = farm(5);
  for (let i = 0; i < 3; i++) hire(h5, 'sproutBot');
  assert.equal(h5.act('staff/hire', { type: 'sproutBot' }).error, 'robotShare');
  assert.equal(SOFTWARE.packs.precision.level, 10);
  assert.equal(SOFTWARE.packs.precision.stars, 2);
  assert.equal(E.softwarePrice({ type: 'sproutBot' }, 'precision'), 400);
  assert.equal(D.unitStars({ type: 'sproutBot', software: [] }), 1);
  assert.equal(D.unitStars({ type: 'sproutBot', software: ['precision'] }), 2);
  // team per zone = level (no bench +2)
  const t = farm(3);
  for (let i = 0; i < 3; i++) hire(t, 'farmhand');
  assert.equal(t.act('staff/hire', { type: 'farmhand' }).error, 'hireLimit');
});

// §2.2: "standby only while unassigned" — a benched robot still assigned to its zone is free. staff/upkeep runs on
// the wall clock while the realm dispatches it (about every minute of play); a gap with the game closed is charged
// for at most UPKEEP.maxCatchUpMinutes (no offline bill, §4.1).
test('robot standby is charged by staff/upkeep (36 per 10 wall-clock min for an unassigned sproutBot; offline gap capped)', () => {
  const h = farm(4);
  const bot = hire(h, 'sproutBot');
  h.must('staff/unassign', { uid: bot });
  h.must('staff/upkeep');
  const c = h.state.player.coins;
  h.tick(10 * MIN);
  h.must('staff/upkeep');
  assert.equal(Math.round((c - h.state.player.coins) * 100) / 100, 36);
  // 3 hours with the game closed: one catch-up of UPKEEP.maxCatchUpMinutes, not 18 × 36
  const c2 = h.state.player.coins;
  h.tick(180 * MIN);
  h.must('staff/upkeep');
  assert.equal(Math.round((c2 - h.state.player.coins) * 100) / 100, 36 * UPKEEP.maxCatchUpMinutes / UPKEEP.perMinutes);
});
