// Store: holds the V3 save, applies actions through the pure reducer, persists safely and notifies listeners.
// Persistence: the previous good copy is kept under `<key>-prev` before every write; a damaged save is copied to
// `<key>-corrupt` once and the `-prev` copy is used instead. Before a Level-10 reset a snapshot goes to `<key>-pre-expiry`;
// before a region layout migration the raw save goes to `<key>-pre-layout<N>` (once).
import { apply } from './game.js';
import { createSave, normalizeSave, LAYOUT_VERSION } from './state.js';
import { migrateLegacy } from './migrate.js';
import { WALLET } from './config/economy.js';

/** Frequent background actions with nothing to show unless they raise an event: the world and the HUD re-read them a few times a second, not on each one. */
export const BACKGROUND_ACTIONS = new Set(['staff/vitals', 'clock/tick', 'gm/payroll', 'gm/think', 'staff/workDone']);

export function createMemoryStorage() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), _map: map };
}

function readJson(storage, key) {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/**
 * @param {{storage?: Storage, key: string, legacyKeys?: {progress:string, player:string}, dev?: boolean, now?: () => number}} opts
 */
// Money must survive a closed tab: these actions are written at once, never grouped with the background saves.
const SAVE_NOW = /^(wallet\/|world\/(unlockRegion|enterRegion)$)/;

export function createStore({ storage = globalThis.localStorage, key, legacyKeys = null, dev = false, sandbox = false, now = () => Date.now(), saveEveryMs = 0 } = {}) {
  const listeners = new Set();
  let readOnly = false;
  let saveFailed = false;
  let state = load();

  function load() {
    let raw = null;
    try { raw = storage.getItem(key); } catch { /* storage blocked: run in memory */ }
    if (raw) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch { /* corrupt */ }
      // Before a layout migration changes any region, keep the untouched save once (`<key>-pre-layout<N>`), so a
      // rollback or a support request can always restore what the player had (docs/farm-world-2.0/SAVE-MIGRATION-PLAN.md).
      try {
        const old = parsed && typeof parsed.world?.regions === 'object' && Object.values(parsed.world.regions || {}).some(r => r && (r.layout | 0) < LAYOUT_VERSION);
        const bk = `${key}-pre-layout${LAYOUT_VERSION}`;
        if (old && storage.getItem(bk) === null) storage.setItem(bk, raw);
      } catch { /* storage full or blocked: migrate anyway */ }
      // Before the wallets exist the raw one-pot save is kept once, so the split can be undone (`<key>-pre-wallet<N>`).
      try {
        const bk = `${key}-pre-wallet${WALLET.version}`;
        if (parsed && parsed.wallet === undefined && storage.getItem(bk) === null) storage.setItem(bk, raw);
      } catch { /* storage full or blocked: migrate anyway */ }
      const norm = normalizeSave(parsed, now());
      if (norm) return norm;
      try { if (storage.getItem(`${key}-corrupt`) === null) storage.setItem(`${key}-corrupt`, raw); } catch { /* full */ }
      const prev = normalizeSave(readJson(storage, `${key}-prev`), now());
      if (prev) return prev;
    }
    if (legacyKeys) {
      const migrated = migrateLegacy(readJson(storage, legacyKeys.progress), readJson(storage, legacyKeys.player), now());
      if (migrated) { persist(migrated); return migrated; }
    }
    return createSave(now());
  }

  function persist(s) {
    if (readOnly) return true;
    try {
      const prev = storage.getItem(key);
      if (prev) storage.setItem(`${key}-prev`, prev);
      storage.setItem(key, JSON.stringify(s));
      saveFailed = false;
      return true;
    } catch { saveFailed = true; return false; }
  }

  // saveEveryMs > 0: writes are grouped. Stringifying the whole save on every small action is what stutters with a big team.
  let saveTimer = null, dirty = false;
  function flush() {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    if (dirty) { dirty = false; persist(state); }
  }
  function requestSave() {
    if (!saveEveryMs) { persist(state); return; }
    dirty = true;
    if (saveTimer === null) saveTimer = setTimeout(flush, saveEveryMs);
  }

  function dispatch(type, payload = {}, opts = {}) {
    const ctx = { now: opts.now ?? now(), dev, sandbox };
    if (type === 'expiry/execute' && state.story.expiry?.status === 'pending') {
      try { storage.setItem(`${key}-pre-expiry`, JSON.stringify(state)); } catch { /* best effort */ }
    }
    const result = apply(state, { type, payload, txId: opts.txId }, ctx);
    if (result.ok && result.state !== state) {
      state = result.state;
      if (SAVE_NOW.test(type)) { dirty = true; flush(); } else requestSave();
      for (const fn of listeners) fn(state, result.events, type);
    }
    return result;
  }

  return {
    get state() { return state; },
    dispatch,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get saveFailed() { return saveFailed; },
    setReadOnly(v) { readOnly = !!v; },
    get readOnly() { return readOnly; },
    // Wipe the V3 save only (keeps the old v1 keys and a backup copy of this one).
    /** Writes a pending save now (page closing or hidden). */
    flush,
    reset() {
      dirty = false;
      try { const raw = storage.getItem(key); if (raw) storage.setItem(`${key}-backup`, raw); storage.removeItem(key); storage.removeItem(`${key}-prev`); } catch { /* ignore */ }
      state = createSave(now());
      for (const fn of listeners) fn(state, [{ type: 'reset' }], 'reset');
    },
    reload() { flush(); state = load(); for (const fn of listeners) fn(state, [{ type: 'reload' }], 'reload'); },
  };
}

export const newTxId = (prefix = 'tx') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
