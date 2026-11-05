// Save keys. The game was renamed COG → Godbean on 04/11/2026 and starts fresh: old saves are not carried over,
// their keys are just deleted on load so they do not linger in the browser.
// Dev-only QA profile `?profile=max`: every key gets a suffix so the normal save is never read or written.
// Production builds never honour it (import.meta.env is undefined in Node tests, hence the optional chaining).
export function profileSuffix(dev = import.meta.env?.DEV === true, search = globalThis.location?.search ?? '') {
  if (!dev) return '';
  const profile = new URLSearchParams(search).get('profile');
  return profile === 'max' ? '@max' : profile === 'test' ? '@test' : '';
}
const SUFFIX = profileSuffix();
export const PROGRESS_KEY = `godbean-progress${SUFFIX}`;
export const PLAYER_KEY = `godbean-player${SUFFIX}`;
export const MEMORY_KEY = `godbean-memory${SUFFIX}`;
// Farm & Café V3 save (own key: the v1 progress key is never overwritten by V3).
export const V3_KEY = `godbean-v3${SUFFIX}`;
// Dev QA profile active (`?profile=test` or `?profile=max` in dev): enables the QA panel and dev/* actions.
export const DEV_PROFILE = SUFFIX !== '';
// Starting coins for a brand-new save in the max profile (null otherwise); farm/model.js createFarm should use `?? 200`.
export const DEV_START_COINS = SUFFIX ? 9999999999999 : null;
const OLD_KEYS = ['cog-coffee-progress', 'cog-coffee-player', 'cog-coffee-progress-backup'];

export function clearOldKeys(storage = globalThis.localStorage) {
  try { for (const key of OLD_KEYS) storage.removeItem(key); }
  catch { /* Storage may be unavailable (private mode, Node tests). */ }
}
clearOldKeys();
