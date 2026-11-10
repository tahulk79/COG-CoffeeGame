// Money: the USD wallet, one Gold wallet per city, conversion, replays, migration of one-pot saves, and that each
// city's income and costs stay in that city (docs/design/wallet-economy.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave } from '../../src/core/state.js';
import { createStore, createMemoryStorage } from '../../src/core/store.js';
import * as D from '../../src/core/derive.js';
import * as W from '../../src/core/wallet.js';
import { farmCard, farmAlerts, overview } from '../../src/core/finance.js';
import { WALLET, START, CROPS, STAFF } from '../../src/core/config/economy.js';
import { PARCELS, areaOfParcel } from '../../src/core/config/layout.js';

const T0 = 1_800_000_000_000, A = 'vn-1', B = 'br-1';
let req = 0; const rid = () => `req-${String(++req).padStart(6, '0')}`;
function game({ sandbox = true } = {}) {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: false, sandbox }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone');
  assert.equal(g.act('world/unlockRegion', { regionId: A }).ok, true);
  assert.equal(g.act('world/enterRegion', { regionId: A }).ok, true);
  g.act('play/chooseGame', { game: 'farm' });
  return g;
}
function twoFarms() {
  const g = game();
  g.s.player.coins = 5000;
  assert.equal(g.act('world/unlockRegion', { regionId: B }).ok, true);
  return g;
}
const go = (g, id) => assert.equal(g.act('world/enterRegion', { regionId: id }).ok, true);
const fund = (g, cents = 2000) => assert.equal(g.act('wallet/sandboxDeposit', { cents, requestId: rid() }).ok, true);
const convert = (g, regionId, cents, requestId = rid(), rate = WALLET.goldPerUsd) => g.act('wallet/convert', { regionId, cents, rate, requestId });
// The whole account: USD can only move into Gold at the rate; nothing else may change the sum.
const gold = g => W.totalGold(g.s);
function spot(g, type) {
  for (const id of D.region(g.s).parcels) {
    if (areaOfParcel(id) !== 'farm') continue;
    const [x0, z0, x1, z1] = PARCELS[id].rect;
    for (let z = z0; z <= z1; z += .5) for (let x = x0; x <= x1; x += .5) { const p = D.snapPosition(type, x, z, 0); if (D.placementError(g.s, type, p.x, p.z, 0) === null) return p; }
  }
  assert.fail('no free spot');
}

test('deposit: only the sandbox can add USD, and a replay adds nothing', () => {
  const live = game({ sandbox: false });
  assert.equal(live.act('wallet/sandboxDeposit', { cents: 500, requestId: rid() }).error, 'forbidden');
  assert.equal(live.s.wallet.usd, 0);
  const g = game(), id = rid();
  assert.equal(g.act('wallet/sandboxDeposit', { cents: 500, requestId: id }).ok, true);
  assert.equal(g.act('wallet/sandboxDeposit', { cents: 500, requestId: id }).noop, true);
  assert.equal(g.s.wallet.usd, 500);
  assert.equal(g.act('wallet/sandboxDeposit', { cents: 777, requestId: rid() }).error, 'amount');
  assert.equal(g.act('wallet/sandboxDeposit', { cents: 500 }).error, 'request');
  assert.equal(g.s.wallet.ledger.filter(r => r.kind === 'deposit').length, 1);
  assert.equal(g.s.player.coins, START.coins, 'a deposit is USD, never Gold');
});

test('convert: moves USD into the chosen farm at the configured rate and is recorded', () => {
  const g = twoFarms(); fund(g, 2000);
  const before = W.goldOf(g.s, B), here = g.s.player.coins;
  const q = W.convertQuote(g.s, B, 500);
  assert.deepEqual([q.ok, q.gold, q.usdAfter], [true, 500 * WALLET.goldPerUsd / 100, 1500]);
  assert.equal(convert(g, B, 500).ok, true);
  assert.equal(g.s.wallet.usd, 1500);
  assert.equal(W.goldOf(g.s, B), before + q.gold);
  assert.equal(g.s.player.coins, here, 'the farm on screen is untouched');
  assert.deepEqual((({ kind, usd, gold: g2, regionId }) => ({ kind, usd, g2, regionId }))(g.s.wallet.ledger.at(-1)), { kind: 'convert', usd: -500, g2: q.gold, regionId: B });
});

test('convert: into the farm on screen changes what that farm can spend', () => {
  const g = game(); fund(g, 500);
  const before = g.s.player.coins;
  assert.equal(convert(g, A, 500).ok, true);
  assert.equal(g.s.player.coins, before + 5 * WALLET.goldPerUsd);
  assert.equal(g.s.wallet.gold[A], g.s.player.coins);
});

test('convert: double taps, overdrafts, other people\'s farms and stale rates move nothing', () => {
  const g = twoFarms(); fund(g, 500);
  const id = rid(), g0 = W.goldOf(g.s, B);
  assert.equal(convert(g, B, 300, id).ok, true);
  for (let i = 0; i < 20; i++) assert.equal(convert(g, B, 300, id).noop, true);
  assert.equal(g.s.wallet.usd, 200);
  assert.equal(W.goldOf(g.s, B), g0 + 3 * WALLET.goldPerUsd);
  assert.equal(convert(g, B, 300).error, 'usdShort');
  assert.equal(convert(g, 'jp-1', 100).error, 'notOwned');
  assert.equal(convert(g, B, 50).error, 'amount');
  assert.equal(convert(g, B, 100.5).error, 'amount');
  assert.equal(convert(g, B, -100).error, 'amount');
  assert.equal(convert(g, B, 100, rid(), WALLET.goldPerUsd + 1).error, 'rateChanged');
  assert.equal(g.s.wallet.usd, 200);
});

test('convert: a request id that failed can be retried', () => {
  const g = twoFarms(), id = rid();
  assert.equal(convert(g, B, 500, id).error, 'usdShort');
  fund(g, 500);
  assert.equal(convert(g, B, 500, id).ok, true);
});

test('travel: each farm keeps its own Gold; going back and forth changes nothing', () => {
  const g = twoFarms();
  const a = g.s.player.coins, b = W.goldOf(g.s, B);
  assert.equal(b, WALLET.newFarmStarterGold);
  go(g, B);
  assert.equal(g.s.player.coins, b);
  assert.equal(W.goldOf(g.s, A), a);
  go(g, A);
  assert.equal(g.s.player.coins, a);
  for (let i = 0; i < 10; i++) { go(g, B); go(g, A); }
  assert.deepEqual([g.s.player.coins, W.goldOf(g.s, B)], [a, b]);
});

test('opening a farm costs the farm you are in, and can never make money', () => {
  const g = game(); g.s.player.coins = 5000;
  const cost = D.regionUnlockCost(g.s, B);
  assert.equal(g.act('world/unlockRegion', { regionId: B }).ok, true);
  assert.equal(g.s.player.coins, 5000 - cost);
  assert.ok(WALLET.newFarmStarterGold < cost);
  assert.equal(g.s.wallet.ledger.at(-1).kind, 'starter');
});

test('buying and planting spend only the farm on screen; a farm with no Gold cannot use another\'s', () => {
  const g = twoFarms();
  const b = W.goldOf(g.s, B);
  assert.equal(g.act('build/place', { type: 'field', ...spot(g, 'field') }).ok, true);
  assert.equal(W.goldOf(g.s, B), b);
  go(g, B);
  g.s.player.coins = 0;
  const a = W.goldOf(g.s, A);
  const r = g.act('staff/hire', { type: Object.keys(STAFF).find(t => STAFF[t].zone === 'farm') });
  assert.equal(r.ok, false);
  assert.equal(W.goldOf(g.s, A), a);
});

test('selling and harvesting pay the farm on screen and are booked as its income', () => {
  const g = twoFarms();
  go(g, B);
  g.s.inventory.beans = 40; g.s.inventory.beanMix = { ...g.s.inventory.beanMix, robusta: 40 };
  const b = g.s.player.coins, a = W.goldOf(g.s, A);
  const r = g.act('farm/sellAll');
  assert.equal(r.ok, true, r.error);
  assert.ok(g.s.player.coins > b);
  assert.equal(W.goldOf(g.s, A), a);
  const p = W.periodOf(g.s, B, 1, g.now);
  assert.equal(p.earned, Math.round((g.s.player.coins - b) * 100) / 100);
  assert.equal(W.periodOf(g.s, A, 1, g.now).earned, 0);
});

test('books: a period only counts its own days, and the profit is earned minus spent', () => {
  const g = game();
  g.s.inventory.beans = 10; g.s.inventory.beanMix = { ...g.s.inventory.beanMix, robusta: 10 };
  g.act('farm/sellAll');
  const earned = W.periodOf(g.s, A, 1, g.now).earned;
  assert.ok(earned > 0);
  g.now += 3 * 864e5;
  assert.equal(W.periodOf(g.s, A, 1, g.now).earned, 0);
  assert.equal(W.periodOf(g.s, A, 7, g.now).earned, earned);
  g.s.player.coins = 500;
  assert.equal(g.act('build/place', { type: 'field', ...spot(g, 'field') }).ok, true);
  const p = W.periodOf(g.s, A, 7, g.now);
  assert.equal(p.profit, Math.round((p.earned - p.spent) * 100) / 100);
});

test('a funding is not income: no loan cut, no profit', () => {
  const g = twoFarms(); fund(g, 500); go(g, B);
  convert(g, B, 500);
  assert.equal(W.periodOf(g.s, B, 7, g.now).earned, 0);
});

test('upkeep: staff are paid by the farm they work in, even from afar; an empty farm borrows from no one', () => {
  const g = twoFarms();
  g.s.player.coins = 5000;
  const type = Object.keys(STAFF).find(t => STAFF[t].zone === 'farm' && STAFF[t].kind === 'worker');
  assert.equal(g.act('staff/hire', { type }).ok, true, 'hired at A');
  g.s.staff.units[0].active = false; // only a benched worker costs upkeep
  go(g, B);
  g.act('staff/upkeep');
  g.now += 60_000 * 5;
  const a = W.goldOf(g.s, A), b = W.goldOf(g.s, B);
  g.act('staff/upkeep');
  assert.ok(W.goldOf(g.s, A) < a, 'A pays for its worker while the player is in B');
  assert.equal(W.goldOf(g.s, B), b);
  assert.equal(g.s.player.coins, b);
  assert.ok(W.periodOf(g.s, A, 1, g.now).spent > 0);
  g.s.wallet.gold[A] = 0;
  g.now += 60_000 * 5;
  const before = g.s.staff.units[0].morale;
  g.act('staff/upkeep');
  assert.equal(W.goldOf(g.s, B), b, 'B does not cover A');
  assert.ok(g.s.staff.units[0].morale < before, 'the unpaid worker loses morale, as before');
});

test('loans: repaid only out of the income of the farm that took them', () => {
  const g = twoFarms();
  assert.equal(g.act('loan/take', { amount: 1000 }).ok, true);
  const owed = D.allLoans(g.s)[0].owed;
  go(g, B);
  assert.equal(D.loanTotal(g.s), 0, 'not this farm\'s debt');
  g.s.inventory.beans = 40; g.s.inventory.beanMix = { ...g.s.inventory.beanMix, robusta: 40 };
  g.act('farm/sellAll');
  assert.equal(D.allLoans(g.s)[0].owed, owed, 'B\'s sale does not repay A\'s loan');
  go(g, A);
  g.s.inventory.beans = 40; g.s.inventory.beanMix = { ...g.s.inventory.beanMix, robusta: 40 };
  g.act('farm/sellAll');
  assert.ok(D.allLoans(g.s)[0].owed < owed);
});

test('migration: a one-pot save is shared out as Gold, nothing is created and USD stays at 0', () => {
  const g = twoFarms();
  const raw = JSON.parse(JSON.stringify(g.s)); delete raw.wallet; raw.player.coins = 1000.01;
  raw.loans = [{ id: 'L1', amount: 100, owed: 110, takenAtPlayed: 0, termMin: 30, late: false }];
  const m = normalizeSave(raw, T0);
  assert.equal(m.wallet.usd, 0);
  assert.equal(Math.round(W.totalGold(m) * 100), 100001);
  assert.equal(m.player.coins, m.wallet.gold[A]);
  assert.equal(m.loans[0].regionId, A);
  assert.equal(m.wallet.ledger[0].kind, 'migrate');
  const again = normalizeSave(JSON.parse(JSON.stringify(m)), T0 + 5);
  assert.deepEqual(again.wallet.gold, m.wallet.gold, 'running it twice changes nothing');
  assert.equal(again.wallet.ledger.length, 1);
});

test('migration: one farm keeps the whole amount; a player in no city keeps the coins until the first one', () => {
  const g = game(); g.s.player.coins = 777;
  const raw = JSON.parse(JSON.stringify(g.s)); delete raw.wallet;
  assert.equal(normalizeSave(raw, T0).player.coins, 777);
  const fresh = JSON.parse(JSON.stringify(createSave(T0, { gender: 'male', name: 'X' }))); delete fresh.wallet;
  const m = normalizeSave(fresh, T0);
  assert.equal(m.player.coins, START.coins);
  assert.deepEqual(m.wallet.gold, {});
});

test('tampered wallet fields are clamped on load', () => {
  const g = twoFarms();
  const raw = JSON.parse(JSON.stringify(g.s));
  raw.wallet.usd = -50; raw.wallet.gold.zz = 99; raw.wallet.gold[B] = 'lots';
  const m = normalizeSave(raw, T0);
  assert.equal(m.wallet.usd, 0);
  assert.equal(m.wallet.gold.zz, undefined);
  assert.equal(W.goldOf(m, B), 0);
});

test('store: a conversion survives a reload at once, even with grouped saves; a one-pot save is backed up first', () => {
  const storage = createMemoryStorage();
  const seed = createSave(T0, { gender: 'female', name: 'T' });
  storage.setItem('k', JSON.stringify(seed));
  const opts = { storage, key: 'k', sandbox: true, now: () => T0, saveEveryMs: 60_000 };
  const a = createStore(opts);
  assert.equal(a.dispatch('wallet/sandboxDeposit', { cents: 500, requestId: rid() }).ok, true);
  assert.equal(createStore(opts).state.wallet.usd, 500, 'no flush was called');
  const old = JSON.parse(JSON.stringify(seed)); delete old.wallet;
  const s2 = createMemoryStorage(); s2.setItem('k', JSON.stringify(old));
  createStore({ ...opts, storage: s2 });
  assert.equal(JSON.parse(s2.getItem(`k-pre-wallet${WALLET.version}`)).wallet, undefined);
});

test('Level-10 restart: USD stays, every farm\'s Gold goes, and the next city starts on the opening coins', () => {
  const g = twoFarms(); fund(g, 500);
  g.s.story.expiry = { status: 'pending', regionId: A, at: 0 };
  g.s.story.phase = 'expiry';
  assert.equal(g.act('expiry/execute').ok, true);
  assert.equal(g.s.wallet.usd, 500);
  assert.deepEqual(g.s.wallet.gold, {});
  assert.equal(g.s.player.coins, START.coins);
  assert.equal(g.act('wallet/convert', { regionId: A, cents: 100, rate: WALLET.goldPerUsd, requestId: rid() }).error, 'notOwned');
  assert.equal(g.act('world/unlockRegion', { regionId: B }).ok, true);
  go(g, B);
  assert.equal(g.s.player.coins, START.coins);
});

test('finance: alerts and the overview come from the wallets, and USD is never added to Gold', () => {
  const g = twoFarms(); fund(g, 10000);
  g.s.player.coins = 0;
  const alerts = farmAlerts(g.s, A, g.now).map(a => a.kind);
  assert.ok(alerts.includes('cantBuy'), alerts.join());
  const o = overview(g.s, g.now, 7);
  assert.equal(o.farms, 2);
  assert.equal(o.gold, W.totalGold(g.s));
  assert.equal(o.usdCents, 10000);
  const c = farmCard(g.s, B, g.now, 7);
  assert.equal(c.gold, W.goldOf(g.s, B));
  assert.equal(c.current, false);
});
