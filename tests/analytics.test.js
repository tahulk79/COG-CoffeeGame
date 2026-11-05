import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics, attachAutoFlush, MAX_QUEUE, STORAGE_KEY } from '../src/shared/analytics/index.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
let n = 0;
const mk = (o = {}) => createAnalytics({ storage: mem(), random: () => `id-${++n}`, env: {}, appVersion: '1.0.0', platform: 'mobile', locale: 'vi', ...o });

test('envelope đủ trường, id lưu bền', () => {
  const storage = mem();
  const a = mk({ storage, region: 'vn' });
  a.track('brew_completed', { recipe: 'espresso', score: 80, model_version: 'v1' });
  const e = a.queue()[0];
  for (const k of ['event_id', 'event', 'anonymous_player_id', 'session_id', 'timestamp', 'app_version', 'locale', 'platform', 'source', 'campaign_id', 'region', 'model_version', 'props']) assert.ok(k in e, k);
  assert.equal(e.props.score, 80);
  assert.equal(mk({ storage }).anonymousId, a.anonymousId);
  assert.ok(storage.m.has(STORAGE_KEY));
});

test('sự kiện lạ bị bỏ; chữ tự do bị bỏ', () => {
  const a = mk();
  a.track('nope', {});
  a.track('memory_saved', { kind: 'game', note: 'xin chào bạn', big: 'a'.repeat(41), o: {}, nan: NaN, has_insight: true });
  assert.equal(a.queue().length, 1);
  assert.deepEqual(a.queue()[0].props, { kind: 'game', has_insight: true });
});

test('hàng chờ tối đa 500, bỏ cũ nhất', () => {
  const a = mk();
  for (let i = 0; i < MAX_QUEUE + 5; i++) a.track('field_bought', { index: i });
  const q = a.queue();
  assert.equal(q.length, MAX_QUEUE);
  assert.equal(q[0].props.index, 5);
});

test('tắt thì xóa hàng chờ và track no-op', () => {
  const a = mk();
  a.track('play_clicked');
  a.setEnabled(false);
  a.track('play_clicked');
  assert.equal(a.queue().length, 0);
});

test('không có URL thì không gửi; có URL gửi xong xóa; lỗi giữ lại', async () => {
  let calls = 0;
  const a = mk({ send: () => { calls++; return true; } });
  a.track('play_clicked');
  await a.flush();
  assert.equal(calls, 0);
  assert.equal(a.queue().length, 1);

  const ok = mk({ env: { VITE_ANALYTICS_URL: 'http://x' }, send: () => true });
  ok.track('play_clicked');
  await ok.flush();
  assert.equal(ok.queue().length, 0);

  const bad = mk({ env: { VITE_ANALYTICS_URL: 'http://x' }, send: () => { throw new Error('net'); } });
  bad.track('play_clicked');
  await bad.flush();
  const rej = mk({ env: { VITE_ANALYTICS_URL: 'http://x' }, send: () => false });
  rej.track('play_clicked');
  await rej.flush();
  assert.equal(bad.queue().length, 1);
  assert.equal(rej.queue().length, 1);
});

test('return_visit sau >= 30 phút', () => {
  let t = 1_000_000;
  const storage = mem();
  const a = mk({ storage, now: () => t });
  a.startSession();
  a.track('play_clicked');
  t += 31 * 60 * 1000;
  const b = mk({ storage, now: () => t });
  b.startSession();
  assert.ok(b.queue().some((e) => e.event === 'return_visit'));
  t += 5 * 60 * 1000;
  const c = mk({ storage, now: () => t });
  c.startSession();
  assert.equal(c.queue().filter((e) => e.event === 'return_visit').length, 1);
});

test('attachAutoFlush idempotent', () => {
  const target = new EventTarget();
  let adds = 0;
  const orig = target.addEventListener.bind(target);
  target.addEventListener = (...x) => { adds++; return orig(...x); };
  const a = mk();
  const d1 = attachAutoFlush(target, a);
  const d2 = attachAutoFlush(target, a);
  assert.equal(adds, 1);
  assert.equal(d1, d2);
  d1();
  attachAutoFlush(target, a)();
  assert.equal(adds, 2);
});

test('storage ném lỗi không crash', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const a = mk({ storage: bad });
  a.track('play_clicked');
  a.startSession();
  assert.equal(a.queue().length, 1);
});
