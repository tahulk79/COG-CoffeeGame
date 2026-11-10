// End-to-end money flows: borrow, share out to farms, exchange, repay, travel and reload, with every cent accounted for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave } from '../../src/core/state.js';
import { createStore, createMemoryStorage } from '../../src/core/store.js';
import * as D from '../../src/core/derive.js';
import * as W from '../../src/core/wallet.js';
import { WALLET, LOAN, xpForLevel } from '../../src/core/config/economy.js';

const T0 = 1_800_000_000_000, A = 'vn-1', B = 'br-1', C = 'et-1';
let req = 0; const rid = () => `flow-${String(++req).padStart(6, '0')}`;
function farms(n = 3) {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: false, sandbox: true }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone');
  assert.equal(g.act('world/unlockRegion', { regionId: A }).ok, true);
  assert.equal(g.act('world/enterRegion', { regionId: A }).ok, true);
  g.act('play/chooseGame', { game: 'farm' });
  for (const id of [B, C].slice(0, n - 1)) { g.s.player.coins = 20000; assert.equal(g.act('world/unlockRegion', { regionId: id }).ok, true, id); }
  g.s.player.coins = 1000; g.s.wallet.gold[A] = 1000; g.s.player.xp = xpForLevel(30); // a credit limit that fits these flows
  return g;
}
const go = (g, id) => assert.equal(g.act('world/enterRegion', { regionId: id }).ok, true);
const deposit = (g, cents) => assert.equal(g.act('wallet/sandboxDeposit', { cents, requestId: rid() }).ok, true);
const borrow = (g, amount = 1000, p = {}) => assert.equal(g.act('loan/take', { amount, ...p }).ok, true);
const swap = (g, regionId, cents, id = rid()) => g.act('wallet/convert', { regionId, cents, rate: WALLET.goldPerUsd, interestRate: W.convertQuote(g.s, regionId, cents).interestRate, requestId: id });
const reload = g => { g.s = normalizeSave(JSON.parse(JSON.stringify(g.s)), g.now); };
const cents = n => Math.round(n * 100);
const sumOwed = s => cents(D.allLoans(s).reduce((n, l) => n + l.owed, 0));
const account = s => s.wallet.usd + cents(W.totalGold(s)) - sumOwed(s);
function invariants(g, msg = '') {
  const w = g.s.wallet;
  assert.ok(Number.isInteger(w.usd) && w.usd >= 0, `cash ${w.usd} ${msg}`);
  assert.ok(g.s.player.coins >= 0, `gold ${msg}`);
  for (const [id, v] of Object.entries(w.gold)) assert.ok(v >= 0, `${id} ${msg}`);
  const b = W.borrowedOf(g.s);
  assert.ok(b >= 0 && b <= w.usd && b <= sumOwed(g.s), `borrowed ${b} ${msg}`);
  for (const l of D.allLoans(g.s)) assert.ok(l.owed > 0 && l.regionId !== undefined, `loan ${msg}`);
  assert.equal(w.gold[g.s.world.currentRegion], g.s.player.coins, `register ${msg}`);
}

test('vay → chia cho 3 farm → trả nợ: đúng từng đồng', () => {
  const g = farms();
  const before = [A, B, C].map(id => W.goldOf(g.s, id));
  borrow(g, 5000);
  assert.equal(g.s.wallet.usd, 500000);
  assert.equal(swap(g, A, 100000).ok, true);
  assert.equal(swap(g, B, 200000).ok, true);
  assert.equal(swap(g, C, 200000).ok, true);
  assert.deepEqual([A, B, C].map((id, i) => W.goldOf(g.s, id) - before[i]), [900, 1800, 1800]);
  assert.deepEqual([g.s.wallet.usd, W.borrowedOf(g.s), D.loanTotal(g.s)], [0, 0, 5000]);
  assert.equal(g.s.wallet.ledger.filter(r => r.kind === 'convert').reduce((n, r) => n + r.interest, 0), 50000);
  g.s.player.coins = 6000;
  assert.equal(g.act('loan/repay', { amount: 2000 }).ok, true);
  assert.equal(D.loanTotal(g.s), 3000);
  assert.equal(g.act('loan/repay', {}).ok, true);
  assert.deepEqual([D.loanTotal(g.s), g.s.player.coins], [0, 1000]);
  invariants(g);
});

test('chia tiền tự nạp cho các farm không mất lãi; chia lẫn tiền vay chỉ mất lãi phần vay', () => {
  const g = farms(); const b0 = W.goldOf(g.s, B), c0 = W.goldOf(g.s, C);
  deposit(g, 200000);
  assert.equal(swap(g, B, 100000).ok, true);
  assert.equal(W.goldOf(g.s, B), b0 + 1000);
  borrow(g); // 1,000 tự nạp + 1,000 vay
  assert.equal(swap(g, C, 150000).ok, true);
  assert.equal(W.goldOf(g.s, C), c0 + 1400, 'lãi 100 trên 1.000 vay, 500 tự nạp đổi đủ');
  assert.equal(swap(g, B, 50000).ok, true);
  assert.equal(W.goldOf(g.s, B), b0 + 1500);
  invariants(g);
});

test('đổi bấm đúp, sai số tiền, vượt ví, farm lạ: không mất tiền', () => {
  const g = farms(); borrow(g);
  const id = rid(), a0 = g.s.player.coins;
  assert.equal(swap(g, A, 60000, id).ok, true);
  for (let i = 0; i < 5; i++) assert.equal(swap(g, A, 60000, id).noop, true);
  assert.equal(g.s.player.coins, a0 + 540);
  assert.equal(swap(g, A, 40001).error, 'usdShort');
  for (const bad of [0, -10000, 9999, 10000.5, NaN, '10000', null]) assert.equal(g.act('wallet/convert', { regionId: A, cents: bad, rate: 1, requestId: rid() }).error, 'amount', String(bad));
  assert.equal(swap(g, 'jp-1', 10000).error, 'notOwned');
  assert.equal(g.s.wallet.usd, 40000);
  invariants(g);
});

test('trả nợ: một phần, quá số nợ, số lạ, thiếu tiền, từ ví', () => {
  const g = farms(); borrow(g, 1000);
  for (const bad of [0, -5, 'x', NaN]) assert.equal(g.act('loan/repay', { amount: bad }).ok, false, String(bad));
  assert.equal(D.loanTotal(g.s), 1000);
  g.s.player.coins = 0;
  assert.equal(g.act('loan/repay', {}).error, 'coins');
  assert.equal(g.act('loan/repay', { amount: 99999, from: 'usd' }).ok, true);
  assert.deepEqual([g.s.wallet.usd, D.loanTotal(g.s)], [0, 0]);
  assert.equal(g.act('loan/repay', { from: 'usd' }).noop, true);
  borrow(g, 1000); assert.equal(swap(g, A, 100000).ok, true);
  assert.equal(g.act('loan/repay', { from: 'usd' }).error, 'usdShort');
  invariants(g);
});

test('trả bớt bằng vàng: chỉ phần còn nợ của tiền vay chịu lãi', () => {
  const g = farms(); borrow(g, 1000); g.s.player.coins = 400;
  assert.equal(g.act('loan/repay', {}).ok, true);
  assert.deepEqual([D.loanTotal(g.s), W.borrowedOf(g.s), W.convertQuote(g.s, A, 100000).interest], [600, 60000, 6000]);
});

test('tiền tự nạp không bị coi là tiền vay sau khi nợ cũ đã trả và Quản lý vay mới', () => {
  const g = farms(); borrow(g, 1000); g.s.player.coins = 1000;
  assert.equal(g.act('loan/repay', {}).ok, true);
  assert.equal(W.borrowedOf(g.s), 0);
  g.s.wallet.usd = 0;
  deposit(g, 200000);
  borrow(g, 1000, { gold: true });
  assert.equal(W.borrowedOf(g.s), 0);
  assert.equal(W.convertQuote(g.s, A, 200000).interest, 0);
});

test('tải lại game: nợ vẫn thuộc farm đã vay, tiền vay vẫn chịu lãi', () => {
  const g = farms(); borrow(g, 1000); go(g, B);
  reload(g);
  assert.equal(D.allLoans(g.s)[0].regionId, A, 'vẫn nhớ nơi đã vay');
  assert.equal(D.loanTotal(g.s), 1000, 'nợ theo tài khoản');
  assert.equal(W.borrowedOf(g.s), 100000);
  assert.equal(W.convertQuote(g.s, B, 100000).interest, 10000);
});

test('vay và trả nợ được lưu ngay, tải lại không mất và không vay trùng', () => {
  const storage = createMemoryStorage(), seed = farms().s;
  storage.setItem('k', JSON.stringify(seed));
  const opts = { storage, key: 'k', sandbox: true, now: () => T0, saveEveryMs: 60_000 };
  const a = createStore(opts);
  assert.equal(a.dispatch('loan/take', { amount: 1000 }).ok, true);
  assert.equal(createStore(opts).state.wallet.usd, 100000, 'vay');
  assert.equal(a.dispatch('loan/repay', { amount: 300, from: 'usd' }).ok, true);
  const b = createStore(opts).state;
  assert.deepEqual([b.wallet.usd, D.allLoans(b)[0].owed], [70000, 700], 'trả');
});

test('thu nhập trả nợ tự động đúng tỷ lệ', () => {
  const g = farms(); borrow(g, 1000);
  g.s.inventory.beans = 40; g.s.inventory.beanMix = { ...g.s.inventory.beanMix, robusta: 40 };
  const c0 = g.s.player.coins;
  assert.equal(g.act('farm/sellAll').ok, true);
  const got = g.s.player.coins - c0, paid = 1000 - D.loanTotal(g.s);
  assert.ok(paid > 0);
  assert.ok(Math.abs(paid / (got + paid) - LOAN.autoRepay) < 0.01, `${paid} / ${got}`);
});

test('Lv10: nợ và tiền vay còn nguyên, lãi vẫn tính khi đổi ở farm mới', () => {
  const g = farms(2); borrow(g, 1000);
  g.s.story.expiry = { status: 'pending', regionId: A, at: 0 }; g.s.story.phase = 'expiry';
  assert.equal(g.act('expiry/execute').ok, true);
  assert.equal(g.s.wallet.usd, 100000);
  assert.equal(g.act('world/unlockRegion', { regionId: C }).ok, true);
  go(g, C);
  assert.equal(D.loanTotal(g.s), 1000);
  assert.equal(W.borrowedOf(g.s), 100000);
  assert.equal(swap(g, C, 100000).ok, true);
  assert.equal(g.s.wallet.ledger.at(-1).interest, 10000);
});

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
test('300 chuỗi thao tác ngẫu nhiên: không lệch một xu, không âm, tải lại không đổi gì', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = rng(seed), g = farms(), pick = a => a[Math.floor(r() * a.length)];
    let expected = account(g.s), interest = 0, log = [];
    const homes = () => D.allLoans(g.s).map(l => `${l.id}:${l.regionId}:${l.owed}`).join();
    for (let i = 0; i < 80; i++) {
      const roll = r(), ids = [A, B, C]; let rec;
      if (roll < .15) { const c = pick(WALLET.sandboxPackCents); deposit(g, c); expected += c; rec = `dep ${c}`; }
      else if (roll < .3) { const a = pick(LOAN.packs), res = g.act('loan/take', { amount: a }); if (!res.ok) assert.equal(res.error, 'credit'); rec = `loan ${a} ${res.ok}`; }
      else if (roll < .36) { const a = pick(LOAN.packs), res = g.act('loan/take', { amount: a, gold: true }); if (res.ok) interest += g.s.wallet.ledger.at(-1).interest; else assert.equal(res.error, 'credit'); rec = `gm ${a} ${res.ok}`; }
      else if (roll < .62) {
        const id = pick(ids), c = Math.min(g.s.wallet.usd, 10000 + Math.floor(r() * 300000));
        const q = W.convertQuote(g.s, id, c), res = swap(g, id, c);
        assert.equal(res.ok, q.ok, `seed ${seed}`);
        if (res.ok) { assert.ok(q.interest <= Math.ceil(c * .1)); interest += q.interest; }
        rec = `swap ${id} ${c} i${q.interest}`;
      } else if (roll < .82) {
        const from = pick(['gold', 'usd']), res = g.act('loan/repay', { amount: pick([null, 1, 37, 250, 999, 100000]), from }); rec = `repay ${from} ${res.ok}`;
      } else if (roll < .94) { const id = pick(ids); go(g, id); rec = `go ${id}`; }
      else { const was = homes(), usd = g.s.wallet.usd, b = W.borrowedOf(g.s); reload(g); assert.deepEqual([homes(), g.s.wallet.usd, W.borrowedOf(g.s)], [was, usd, b], `reload seed ${seed}`); rec = 'reload'; }
      log.push(rec);
      invariants(g, `seed ${seed}: ${log.slice(-6).join(' | ')}`);
      assert.ok(D.loanTotal(g.s) <= D.creditLimit(g.s), `credit seed ${seed}`);
      assert.equal(account(g.s) + interest, expected, `seed ${seed} step ${i}: ${log.slice(-6).join(' | ')}`);
    }
  }
});

test('hạn mức vay: Lv1 không vay ồ ạt được, trả bớt thì vay lại được, hạn mức tính trên tổng nợ', () => {
  const g = farms(); g.s.player.xp = 0;
  const limit = D.creditLimit(g.s);
  assert.ok(limit >= 1000 && limit < 2000, String(limit));
  assert.equal(g.act('loan/take', { amount: 5000 }).error, 'credit');
  borrow(g, 1000);
  assert.equal(g.act('loan/take', { amount: 1000 }).error, 'credit', 'tổng nợ vượt hạn mức');
  assert.equal(g.act('loan/take', { amount: 1000, gold: true }).error, 'credit', 'Quản lý cũng vậy');
  assert.equal(g.s.wallet.usd, 100000);
  assert.equal(g.act('loan/repay', { amount: 1000, from: 'usd' }).ok, true);
  borrow(g, 1000);
  go(g, B);
  assert.equal(g.act('loan/take', { amount: 1000 }).error, 'credit', 'đổi farm không có thêm hạn mức');
});

test('đổi farm không bỏ được nợ: vay ở A, đổi tiền cho B, thu nhập ở B vẫn trả nợ', () => {
  const g = farms(); borrow(g, 5000);
  assert.equal(swap(g, B, 500000).ok, true);
  go(g, B);
  g.s.inventory.beans = 40; g.s.inventory.beanMix = { ...g.s.inventory.beanMix, robusta: 40 };
  assert.equal(g.act('farm/sellAll').ok, true);
  assert.ok(D.loanTotal(g.s) < 5000);
  g.s.player.coins = 9000;
  assert.equal(g.act('loan/repay', {}).ok, true);
  assert.equal(D.loanTotal(g.s), 0, 'trả được bằng Vàng của farm đang đứng');
});

