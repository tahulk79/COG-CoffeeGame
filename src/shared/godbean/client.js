// Client for the godbean server (godbean-server/docs/game-api.md): Google login, session keeping, logs to POST /v1/events.
// Based on godbean-server/docs/examples/godbean-client.js, with three changes for this game:
//   - remote calls only from origins the server's CORS lets through (REMOTE_OK); ?debug=log also prints each log,
//   - BUILD comes from the bundle (version + git commit, vite.config.js), so errors can be compared before/after a fix,
//   - 429 waits for Retry-After before the next batch, and the log can be switched off (settings → analytics).

// Every build (dev and production) calls the Railway server directly.
export const API_BASE = 'https://godbean-server-production.up.railway.app';
export const GOOGLE_CLIENT_ID = '924660759835-8vuqrdv03k4plksac111a08fkfmbqg60.apps.googleusercontent.com';
/* global __GB_BUILD__ */
export const BUILD = String(typeof __GB_BUILD__ === 'string' ? __GB_BUILD__ : 'dev').slice(0, 32);
// Origins in the server's CORS_ORIGINS and in the Google OAuth client's Authorized JavaScript origins. Any other origin
// (another port, www., a LAN IP) is blocked by the browser, so nothing is sent from it. Add a new one in all three places.
const ALLOWED_ORIGINS = ['https://godbean.com', 'http://localhost:5173'];
const ORIGIN_OK = ALLOWED_ORIGINS.includes(globalThis.location?.origin);
export const REMOTE_OK = ORIGIN_OK || import.meta.env?.VITE_GODBEAN_REMOTE === '1';
export const GOOGLE_OK = ORIGIN_OK;
/** Dev build: the login gate also offers a test skip. */
export const DEV_BUILD = import.meta.env?.DEV === true;
const DEBUG = new URLSearchParams(globalThis.location?.search ?? '').get('debug') === 'log';

// ---------------------------------------------------------------- session

const RT_KEY = 'gb_rt';
const rt = {
  get: () => { try { return globalThis.localStorage?.getItem(RT_KEY) || null; } catch { return null; } },
  set: v => { try { v ? globalThis.localStorage?.setItem(RT_KEY, v) : globalThis.localStorage?.removeItem(RT_KEY); } catch { /* private mode */ } },
};

let accessToken = null;        // memory only, lives 15 minutes
let refreshToken = rt.get();   // the gb_refresh cookie is blocked (game and API are different sites), so a copy is kept here
let refreshing = null;
let player = null;
const loginListeners = new Set();

async function api(path, { method = 'GET', body, token, keepalive } = {}) {
  if (!REMOTE_OK) throw Object.assign(new Error('remote disabled on this origin'), { status: 0, code: 'offline_origin' });
  const res = await fetch(API_BASE + path, {
    method, keepalive, credentials: 'include',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? 'request failed'), {
      status: res.status, code: json?.error?.code, retryAfter: Number(res.headers.get('Retry-After')) || 0,
    });
  }
  return json?.data;
}

function onLoggedIn(d) {
  accessToken = d.access_token;
  refreshToken = d.refresh_token;
  rt.set(refreshToken);
  return d;
}
function clearSession() {
  accessToken = null; refreshToken = null; player = null;
  rt.set(null);
}

// The refresh token rotates: only ONE refresh request at a time, across tabs too (reusing an old one revokes every session).
async function doRefresh() {
  refreshToken = rt.get() ?? refreshToken; // another tab may have rotated it
  try {
    return onLoggedIn(await api('/v1/auth/refresh', { method: 'POST', body: refreshToken ? { refresh_token: refreshToken } : undefined }));
  } catch (e) {
    if (e.status === 401) clearSession();
    throw e;
  }
}
export function refresh() {
  refreshing ??= (globalThis.navigator?.locks ? navigator.locks.request('gb-refresh', doRefresh) : doRefresh())
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** API call that needs a session; on 401 refreshes and retries exactly once. */
export async function authed(path, opts = {}, retry = true) {
  try {
    return await api(path, { ...opts, token: accessToken });
  } catch (e) {
    if (e.status === 401 && retry && (refreshToken || rt.get())) {
      await refresh();
      return authed(path, opts, false);
    }
    throw e;
  }
}

export async function loginWithGoogle(idToken, nonce) {
  const d = onLoggedIn(await api('/v1/auth/google', { method: 'POST', body: { id_token: idToken, nonce } }));
  try { await getMe(); } catch { /* the login stands even if /v1/me fails once */ }
  for (const fn of loginListeners) fn(d);
  return d;
}

export async function getMe() {
  player = await authed('/v1/me');
  return player;
}

/** On open: a previous session → the player; never logged in / token dead → null. Network errors throw. */
export async function restoreSession() {
  if (!refreshToken && !rt.get()) return null;
  try {
    await refresh();
    return await getMe();
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}

export async function logout() {
  try { await api('/v1/auth/logout', { method: 'POST', body: refreshToken ? { refresh_token: refreshToken } : undefined }); } finally { clearSession(); }
}

/**
 * "Play again from the start": this device forgets the account like a new player. The refresh token is revoked on the
 * server (keepalive: the page reloads right after) and removed here; Google's auto sign-in is turned off, so the next
 * login asks again. The account itself stays on the server (signing in with the same Google account finds it again).
 */
export function forgetAccount() {
  const token = refreshToken ?? rt.get();
  if (token && REMOTE_OK) api('/v1/auth/logout', { method: 'POST', body: { refresh_token: token }, keepalive: true }).catch(() => {});
  clearSession();
  try { globalThis.google?.accounts?.id?.disableAutoSelect(); } catch { /* not loaded */ }
}

export const isLoggedIn = () => Boolean(accessToken);
/** A refresh token is on this device: the player logged in here before (maybe offline right now). */
export const hasStoredSession = () => Boolean(rt.get());
export const currentPlayer = () => player;
export const onLogin = fn => { loginListeners.add(fn); return () => loginListeners.delete(fn); };

// ---------------------------------------------------------------- Google Identity Services

let gsiLoading = null;
/** Loads https://accounts.google.com/gsi/client once. */
export function loadGoogleScript() {
  if (globalThis.google?.accounts?.id) return Promise.resolve();
  gsiLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiLoading = null; s.remove(); reject(Object.assign(new Error('gsi load failed'), { code: 'gsi_load' })); };
    document.head.append(s);
  });
  return gsiLoading;
}

/** Renders the "Sign in with Google" button into buttonEl. The server needs the ID token (not an OAuth access token). */
export async function renderGoogleButton(buttonEl, { onDone, onError, locale, width } = {}) {
  await loadGoogleScript();
  const nonce = crypto.randomUUID(); // anti-replay: the server compares it with the token's nonce claim
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID, nonce,
    callback: async ({ credential }) => {
      try { onDone?.(await loginWithGoogle(credential, nonce)); } catch (e) { onError?.(e); }
    },
  });
  google.accounts.id.renderButton(buttonEl, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', locale, width });
}

// ---------------------------------------------------------------- logs (POST /v1/events)

// Anonymous logs are accepted too (before login); with a session they are tied to the player.
const MAX_QUEUE = 300;     // offline: keep at most this many waiting, drop the oldest
const MAX_BATCH = 20;      // anonymous: at most 20 per request (logged in: 50)
const MAX_BYTES = 30_000;  // anonymous: at most 32 KB per request (logged in: 64 KB)
const MAX_PROPS = 7_000;   // the server takes at most 8 KB of props per event
const NAME = /^[A-Za-z0-9_.:-]{1,64}$/;

export const playSessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
const queue = [];
const crumbs = [];
let timer = null, waitUntil = 0, logOn = true, flushing = false;
const bytes = s => new TextEncoder().encode(s).length;

export function setLogEnabled(on) {
  logOn = !!on;
  if (!logOn) queue.length = 0;
}

/** A player action, kept for the next error report (last 20). */
export function crumb(text) {
  crumbs.push(String(text).slice(0, 100));
  if (crumbs.length > 20) crumbs.shift();
}
export const breadcrumbs = () => [...crumbs];

/** log('tutorial_step', { step: 3 }); log('perf_load', { ms: 1840 }, 'warn'). level: info | warn | error. */
export function log(name, props = {}, level = 'info') {
  if (!logOn || !NAME.test(name)) return;
  let p = props && typeof props === 'object' && !Array.isArray(props) ? props : { value: props };
  try {
    const json = JSON.stringify(p);
    if (bytes(json) > MAX_PROPS) p = { truncated: true, preview: json.slice(0, 2000) };
  } catch { p = { unserializable: true }; }
  const ev = { name, level, at: new Date().toISOString(), props: p };
  if (DEBUG) console.debug('[gb-log]', name, level, p);
  if (!REMOTE_OK) return;
  queue.push(ev);
  if (queue.length > MAX_QUEUE) queue.shift();
  if (level === 'error') scheduleFlush(1000); // batch errors that come together into one request
  else if (queue.length >= MAX_BATCH) scheduleFlush(0);
}

function scheduleFlush(ms) {
  timer ??= setTimeout(() => { timer = null; flush(); }, Math.max(ms, waitUntil - Date.now()));
}

/** Sends at most one batch. Returns how many events the server took (0 when nothing was sent). */
export async function flush({ keepalive = false } = {}) {
  if (!queue.length || !REMOTE_OK || flushing || Date.now() < waitUntil) return 0;
  const events = [];
  let size = 300;
  while (queue.length && events.length < MAX_BATCH) {
    const n = bytes(JSON.stringify(queue[0]));
    if (events.length && size + n > MAX_BYTES) break;
    size += n;
    events.push(queue.shift());
  }
  const request = { method: 'POST', keepalive, body: { play_session_id: playSessionId, build: BUILD, events } };
  flushing = true;
  try {
    // With a session the token goes along (refreshed when stale); without one the batch is anonymous.
    const r = await (accessToken ? authed('/v1/events', request) : api('/v1/events', request));
    if (queue.length >= MAX_BATCH) scheduleFlush(1500); // backlog: drain it at a pace the anonymous limit (1 req/s) accepts
    return r?.accepted ?? events.length;
  } catch (e) {
    // Offline, 429, 401, 5xx: put back for later. 400/422: a bad batch, dropped so it is not resent forever.
    if (!e.status || e.status === 401 || e.status === 429 || e.status >= 500) queue.unshift(...events);
    if (e.status === 429) waitUntil = Date.now() + Math.max(2, e.retryAfter || 5) * 1000;
    if (queue.length > MAX_QUEUE) queue.length = MAX_QUEUE;
    return 0;
  } finally { flushing = false; }
}

let started = false;
/** Once at boot: catches JS errors, sends every 10 s, sends the last batch when the tab closes. screen() names the current screen. */
export function startLogging({ screen = () => '' } = {}) {
  if (started) return;
  started = true;
  const report = (msg, stack, kind) => log('js_error', {
    msg: String(msg ?? '').slice(0, 500), stack: String(stack ?? '').slice(0, 2000), kind, screen: screen(), breadcrumbs: [...crumbs],
  }, 'error');
  window.addEventListener('error', e => {
    if (e.error || e.message) report(e.message, e.error?.stack, 'error');
    else if (e.target && e.target !== window) log('asset_error', { tag: e.target.tagName, src: String(e.target.src || e.target.href || '').slice(0, 200), screen: screen() }, 'warn');
  }, true);
  window.addEventListener('unhandledrejection', e => report(e.reason?.message ?? e.reason, e.reason?.stack, 'rejection'));
  setTimeout(flush, 3000); // the boot logs (device, perf_boot) go out right away
  setInterval(flush, 10_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush({ keepalive: true }); });
  window.addEventListener('pagehide', () => flush({ keepalive: true }));
}
