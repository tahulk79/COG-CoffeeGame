// Analytics ẩn danh theo sự kiện (F-38). Đặc tả: docs/shared/analytics.md. Chưa nối vào màn nào.
export const STORAGE_KEY = 'godbean-analytics';
export const MAX_QUEUE = 500;
export const FLUSH_MS = 30000;
export const RETURN_GAP_MS = 30 * 60 * 1000;

export const EVENTS = new Set([
  'landing_viewed', 'play_clicked', 'game_started', 'tutorial_completed', 'brew_started', 'brew_completed',
  'taste_submitted', 'memory_saved', 'memory_compared', 'discovery_saved', 'challenge_completed',
  'result_shared', 'referral_opened', 'return_visit', 'feedback_submitted', 'purchase_verified',
  'heaven_completed', 'region_selected', 'field_bought', 'shift_ended', 'workday_ended',
  'victory_reached', 'auto_started',
]);

const CODE = /^[a-z0-9_\-.]+$/i;
const MAX_STR = 40;
const val = (v) => (typeof v === 'function' ? v() : v);

// Chỉ số, cờ, chuỗi mã ngắn; mọi thứ khác bị bỏ => không lọt chữ tự do.
export function sanitizeProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  for (const [k, v] of Object.entries(props)) {
    if (!CODE.test(k) || k.length > MAX_STR) continue;
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) out[k] = v;
    else if (typeof v === 'string' && v.length <= MAX_STR && CODE.test(v)) out[k] = v;
  }
  return out;
}

const uuid = () => globalThis.crypto?.randomUUID?.()
  ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (globalThis.crypto?.getRandomValues?.(new Uint8Array(1))[0] ?? Math.random() * 256) & 15;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

function defaultSend(url, body) {
  if (globalThis.navigator?.sendBeacon) return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  return fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true })
    .then((r) => r.ok);
}

export function createAnalytics({
  storage = globalThis.localStorage, now = Date.now, random = uuid,
  env = import.meta.env ?? {}, send = defaultSend, isEnabled = () => true,
  appVersion = '', platform = '', locale = '', region = '', source = 'web',
} = {}) {
  let store = null;
  const sessionId = random();
  let enabled = true;
  let inflight = false;

  try { store = JSON.parse(storage?.getItem(STORAGE_KEY)); } catch { store = null; }
  if (!store || typeof store !== 'object' || typeof store.id !== 'string') {
    let campaign = '';
    try {
      const c = new URLSearchParams(globalThis.location?.search ?? '').get('utm_campaign') ?? '';
      if (c.length <= MAX_STR && CODE.test(c)) campaign = c;
    } catch { /* bỏ qua */ }
    store = { id: random(), first: now(), last: 0, campaign };
  }
  if (!Array.isArray(store.queue)) store.queue = [];

  const persist = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* private mode */ } };
  persist();
  const on = () => enabled && !!val(isEnabled);

  function track(event, props) {
    if (!on()) return;
    if (!EVENTS.has(event)) {
      if (import.meta.env?.DEV) console.warn(`[analytics] sự kiện không có trong whitelist: ${event}`);
      return;
    }
    const clean = sanitizeProps(props);
    const model_version = clean.model_version ?? null;
    delete clean.model_version;
    const t = now();
    store.queue.push({
      event_id: random(), event, anonymous_player_id: store.id, session_id: sessionId,
      timestamp: new Date(t).toISOString(), app_version: String(val(appVersion)),
      locale: String(val(locale)), platform: String(val(platform)), source: String(val(source)),
      campaign_id: store.campaign || null, region: val(region) || null, model_version, props: clean,
    });
    if (store.queue.length > MAX_QUEUE) store.queue.splice(0, store.queue.length - MAX_QUEUE);
    store.last = t;
    persist();
  }

  // Gọi một lần khi mở trang: phát return_visit nếu cách lần hoạt động trước >= 30 phút.
  function startSession() {
    const t = now();
    if (store.last && t - store.last >= RETURN_GAP_MS) {
      track('return_visit', { days_since_first: Math.floor((t - store.first) / 86400000) });
    }
    store.last = t;
    persist();
  }

  async function flush() {
    const url = env.VITE_ANALYTICS_URL;
    if (!url || !on() || inflight || !store.queue.length) return false;
    inflight = true;
    const batch = store.queue.slice();
    try {
      const ok = await send(url, JSON.stringify({ events: batch }));
      if (!ok) return false;
      const sent = new Set(batch.map((e) => e.event_id));
      store.queue = store.queue.filter((e) => !sent.has(e.event_id));
      persist();
      return true;
    } catch { return false; } finally { inflight = false; }
  }

  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) { store.queue = []; persist(); }
  }

  return {
    track, flush, setEnabled, startSession,
    queue: () => store.queue.slice(),
    get anonymousId() { return store.id; },
    sessionId,
  };
}

let shared = null;
export const getAnalytics = (opts) => (shared ??= createAnalytics(opts));
export const debugDump = () => (shared ? shared.queue() : []); // dùng cho ?debug=analytics

const attached = new WeakMap();
// Gắn flush 30 s + khi trang ẩn. Gọi lại với cùng target trả về detach cũ, không đăng ký trùng.
export function attachAutoFlush(target = globalThis.document, analytics = getAnalytics()) {
  if (!target) return () => {};
  if (attached.has(target)) return attached.get(target);
  const onVis = () => { if (target.visibilityState === 'hidden') analytics.flush(); };
  target.addEventListener('visibilitychange', onVis);
  const timer = setInterval(() => analytics.flush(), FLUSH_MS);
  const detach = () => {
    target.removeEventListener('visibilitychange', onVis);
    clearInterval(timer);
    attached.delete(target);
  };
  attached.set(target, detach);
  return detach;
}
