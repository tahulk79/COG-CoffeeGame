// Save keys. The game was renamed COG → Godbean on 04/11/2026 and starts fresh: old saves are not carried over,
// their keys are just deleted on load so they do not linger in the browser.
export const PROGRESS_KEY = 'godbean-progress';
export const PLAYER_KEY = 'godbean-player';
const OLD_KEYS = ['cog-coffee-progress', 'cog-coffee-player', 'cog-coffee-progress-backup'];

export function clearOldKeys(storage = globalThis.localStorage) {
  try { for (const key of OLD_KEYS) storage.removeItem(key); }
  catch { /* Storage may be unavailable (private mode, Node tests). */ }
}
clearOldKeys();
