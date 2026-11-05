import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { detectPlatform, wireMemory, initAnalytics, _resetForTest } = await import('../src/shared/analytics/wire.js');
const { normalizeSettings } = await import('../src/state/progress.js');
const { addRealEntry, env } = await import('../src/state/memory.js');
env.readOnly = () => false;

test('detectPlatform', () => {
  assert.equal(detectPlatform(1200, false), 'desktop');
  assert.equal(detectPlatform(400, true), 'mobile+touch');
  assert.equal(detectPlatform(800, true), 'tablet+touch');
});

test('công tắc analytics lưu qua normalizeSettings, mặc định bật', () => {
  assert.equal(normalizeSettings({}).analytics, true);
  assert.equal(normalizeSettings({ analytics: false }).analytics, false);
  assert.equal(normalizeSettings({ analytics: 'no' }).analytics, true);
});

test('wireMemory gọi track đúng tên, chỉ gửi kind, không đăng ký trùng', () => {
  const calls = [];
  wireMemory((e, p) => calls.push([e, p]));
  wireMemory((e, p) => calls.push([e, p])); // gọi lại: bản cũ phải bị hủy
  const r = addRealEntry({ recipeId: 'v60', notes: 'ghi chú riêng tư', taste: { acidity: 3 } });
  assert.ok(r.ok);
  const names = calls.map(c => c[0]);
  assert.deepEqual(names, ['taste_submitted', 'memory_saved']);
  for (const [, p] of calls) assert.ok(Object.keys(p).includes('kind'));
});

test('initAnalytics chỉ chạy một lần', () => {
  _resetForTest();
  const doc = { visibilityState: 'visible', n: 0, addEventListener() { this.n++; }, removeEventListener() {} };
  const a = initAnalytics({ appVersion: '1', platform: 'desktop', locale: 'vi', region: 'vn', doc, dev: false });
  assert.equal(initAnalytics({ doc, dev: false }), a);
  assert.equal(doc.n, 1);
  _resetForTest();
});
