// Nối analytics (F-38) vào game. Đặc tả: docs/design/godbean-gdd.md §13.5. Chỉ truyền cờ/đếm/mã, không chữ tự do.
import { getAnalytics, attachAutoFlush, debugDump } from './index.js';

export const track = (event, props) => getAnalytics().track(event, props);
export const setAnalyticsEnabled = (on) => getAnalytics().setEnabled(on);

// 'desktop' | 'mobile' | 'tablet' (+ '+touch'); theo cạnh ngắn của màn hình.
export function detectPlatform(width, touch) {
  const kind = !touch ? 'desktop' : width >= 768 ? 'tablet' : 'mobile';
  return touch ? `${kind}+touch` : kind;
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
  if (dev && win && new URLSearchParams(search).get('debug') === 'analytics') {
    win.__godbeanAnalytics = a;
    console.info('[analytics]', debugDump());
  }
  return a;
}
export const _resetForTest = () => { started = false; detachFlush?.(); detachFlush = null; };
