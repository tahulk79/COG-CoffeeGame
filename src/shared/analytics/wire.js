// Nối analytics (F-38) vào game. Đặc tả: docs/shared/analytics.md. Chỉ truyền cờ/đếm/mã, không chữ tự do.
import { getAnalytics, attachAutoFlush, debugDump } from './index.js';
import { onMemoryEvent } from '../../state/memory.js';

export const track = (event, props) => getAnalytics().track(event, props);
export const setAnalyticsEnabled = (on) => getAnalytics().setEnabled(on);

// 'desktop' | 'mobile' | 'tablet' (+ '+touch'); theo cạnh ngắn của màn hình.
export function detectPlatform(width, touch) {
  const kind = !touch ? 'desktop' : width >= 768 ? 'tablet' : 'mobile';
  return touch ? `${kind}+touch` : kind;
}

// memory_* -> sự kiện; chỉ gửi mã/cờ (kind, level, has_insight), không gửi id/ghi chú.
const MEMORY_EVENTS = new Set(['taste_submitted', 'memory_saved', 'memory_compared']);
let unsubMemory = null;
export function wireMemory(tk = track) {
  unsubMemory?.(); // gọi lại không đăng ký trùng
  unsubMemory = onMemoryEvent(e => { if (MEMORY_EVENTS.has(e?.type)) tk(e.type, e.type === 'taste_submitted' ? { kind: e.kind, level: e.level } : e.type === 'memory_saved' ? { kind: e.kind, has_insight: e.has_insight === true } : { kind: e.kind }); });
  return unsubMemory;
}

let started = false, detachFlush = null;
// Gọi một lần khi mở trang. enabled = settings.analytics. Gọi lại là no-op.
export function initAnalytics({ appVersion, platform, locale, region, enabled = true, doc = globalThis.document, dev = import.meta.env?.DEV, win = globalThis.window, search = globalThis.location?.search ?? '' } = {}) {
  if (started) return getAnalytics();
  started = true;
  const a = getAnalytics({ appVersion, platform, locale, region });
  a.setEnabled(enabled);
  a.startSession();
  detachFlush = attachAutoFlush(doc, a);
  wireMemory();
  if (dev && win && new URLSearchParams(search).get('debug') === 'analytics') {
    win.__godbeanAnalytics = a;
    console.info('[analytics]', debugDump());
  }
  return a;
}
export const _resetForTest = () => { started = false; detachFlush?.(); detachFlush = null; unsubMemory?.(); unsubMemory = null; };

// Farm model events -> track (F-38) + Memory -> XP (coffee-memory.md §10). Idempotent per farm instance; returns detach.
const FARM_EVENTS = new Set(['field_bought', 'workday_ended', 'victory_reached', 'challenge_completed', 'auto_started', 'shift_ended', 'tutorial_completed', 'discovery_saved']);
const wired = new WeakMap();
export function wireFarm(farm, tk = track) {
  if (wired.has(farm)) return wired.get(farm);
  const offFarm = farm.onEvent((type, props) => { if (FARM_EVENTS.has(type)) tk(type, props); });
  const offMemory = onMemoryEvent(e => {
    if (e?.type === 'taste_submitted') farm.act('memory', 'xp', { kind: e.kind });
    else if ((e?.type === 'memory_saved' && e.has_insight) || e?.type === 'insight_saved') farm.act('memory', 'xp', { insight: true }); // kind-less: only the +5 insight part
    if (e?.type === 'taste_submitted' || e?.type === 'memory_saved' || e?.type === 'insight_saved') farm.act('awakening', 'check'); // F-35: new cup/entry may advance a Decode question or the First Sixth Key
  });
  const detach = () => { offFarm(); offMemory(); wired.delete(farm); };
  wired.set(farm, detach);
  return detach;
}
