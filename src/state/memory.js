// Coffee Memory storage (F-33/F-34), spec: docs/screens/04-cafe/rules.md. Key `godbean-memory`, separate from the progress save.
// Pure data + limits; no DOM. Private text (notes, memory, insight) never goes into events (spec §9).
import { MEMORY_KEY } from './storage-keys.js';
import { isReadOnly } from './progress.js';

export const MEMORY_VERSION = 1;
export const MAX_ENTRIES = 500; // entries that are not drafts
export const MAX_DRAFTS = 30;
export const MAX_TEXT = 500;
export const TASTE_KEYS = ['aroma', 'acidity', 'sweetness', 'bitterness', 'body', 'aftertaste'];
// Hand-poured game steps are never exactly equal; within 5 % counts as the same step (design call, see report).
export const STEP_TOLERANCE = .05;
export const env = { readOnly: isReadOnly }; // tests swap this to simulate the two-tab read-only mode

const GROUPS = ['intended', 'actual', 'bean', 'equipment', 'preparation', 'ingredients', 'environment', 'personal'];
const TEXTS = ['notes', 'memory'];
// Fields compared A/B (spec §7); game cups also compare per-step values when both are the same recipe.
const COMPARE = { actual: ['doseG', 'waterG', 'grind', 'tempC', 'bloomG', 'bloomS', 'timeS'], bean: ['name', 'origin', 'variety', 'process', 'roast', 'roastDate'], ingredients: ['milk', 'water'], equipment: ['grinder', 'kettle', 'dripper', 'filter', 'server', 'cup'] };

const store = () => globalThis.localStorage;
const blank = () => ({ version: MEMORY_VERSION, entries: [], setup: {} });
const isObject = v => v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = MAX_TEXT) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const level = v => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
const empty = v => v === undefined || v === null || v === '';
const plain = v => isObject(v) ? JSON.parse(JSON.stringify(v)) : {};

// Migration hook: returns the data in the current shape, or null when the version is unknown (caller keeps a raw copy).
function migrate(data) {
  if (!isObject(data) || data.version !== MEMORY_VERSION || !Array.isArray(data.entries)) return null;
  return { version: MEMORY_VERSION, entries: data.entries.filter(isObject), setup: isObject(data.setup) ? data.setup : {} };
}

function read() {
  let raw = null;
  try {
    raw = store().getItem(MEMORY_KEY);
    if (raw === null) return blank();
    const data = migrate(JSON.parse(raw));
    if (data) return data;
  } catch { /* unreadable */ }
  // Same rule as progress.js: keep the unreadable/newer data once so the next write cannot destroy it.
  if (raw) try { if (store().getItem(`${MEMORY_KEY}-corrupt`) === null) store().setItem(`${MEMORY_KEY}-corrupt`, raw); } catch { /* storage full */ }
  return blank();
}
function write(data) {
  if (env.readOnly()) return false;
  try { store().setItem(MEMORY_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

const listeners = new Set();
// fn({type: 'taste_submitted'|'memory_saved'|'memory_compared', kind, id?, level? ('quick'|'journal'), has_insight? (all 3 insight boxes filled)}); returns an unsubscribe function.
export function onMemoryEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = event => { for (const fn of listeners) try { fn(event); } catch { /* a bad subscriber must not break saving */ } };

const fullInsight = i => isObject(i) && ['observation', 'hypothesis', 'nextChange'].every(k => text(i[k]).trim()); // all 3 boxes (XP rule)
const hasInsight = i => isObject(i) && ['observation', 'hypothesis', 'nextChange'].some(k => text(i[k]).trim());
export const isDraft = e => e.kind === 'game' && !e.taste && !hasInsight(e.insight) && !text(e.notes).trim() && !text(e.memory).trim();

function cleanTaste(raw) {
  if (!isObject(raw)) return null;
  const taste = Object.fromEntries([...TASTE_KEYS, 'liking'].map(k => [k, level(raw[k])]));
  return Object.values(taste).some(Boolean) ? taste : null;
}
const cleanInsight = raw => isObject(raw) ? Object.fromEntries(['observation', 'hypothesis', 'nextChange'].map(k => [k, text(raw[k])])) : { observation: '', hypothesis: '', nextChange: '' };

let seq = 0;
const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function build(kind, data) {
  const now = Date.now();
  const entry = { id: newId(), kind, schemaVersion: 1, createdAt: now, editedAt: now, method: text(data.method || data.recipeId || 'custom', 40), recipeId: text(data.recipeId || 'custom', 40) };
  for (const g of GROUPS) entry[g] = plain(data[g]);
  for (const k of TEXTS) entry[k] = text(data[k]);
  entry.taste = cleanTaste(data.taste); entry.insight = cleanInsight(data.insight);
  entry.simulated = kind === 'game' && isObject(data.simulated) ? { score: Number(data.simulated.score) || 0, quality: Number(data.simulated.quality) || 0, stars: Number(data.simulated.stars) || 0, modelVersion: Number(data.simulated.modelVersion) || 0 } : null;
  return entry;
}

const drafts = data => data.entries.filter(isDraft);
const full = data => data.entries.filter(e => !isDraft(e)).length >= MAX_ENTRIES;

/** Draft of a hand-brewed game cup. Oldest drafts go first past 30; entries with taste/insight are never touched. */
export function addGameDraft(cup) {
  const data = read(), entry = build('game', cup || {});
  data.entries.push(entry);
  for (const old of drafts(data).slice(0, Math.max(0, drafts(data).length - MAX_DRAFTS))) data.entries.splice(data.entries.indexOf(old), 1);
  return write(data) ? entry : null;
}

/** Real-world cup. Returns {ok, entry} or {ok:false, reason:'full'|'readonly'|'failed'}. */
export function addRealEntry(input) {
  if (env.readOnly()) return { ok: false, reason: 'readonly' };
  const data = read();
  if (full(data)) return { ok: false, reason: 'full' };
  const entry = build('real', input || {});
  data.entries.push(entry);
  if (!write(data)) return { ok: false, reason: 'failed' };
  if (entry.taste) emit({ type: 'taste_submitted', kind: 'real', id: entry.id, level: getMode() });
  emit({ type: 'memory_saved', kind: 'real', id: entry.id, has_insight: fullInsight(entry.insight) });
  return { ok: true, entry };
}

const PATCHABLE = [...GROUPS, ...TEXTS, 'taste', 'insight', 'method', 'recipeId'];
/** Edit an entry. Never touches simulated, id, kind or createdAt. Object groups merge shallowly. */
export function updateEntry(id, patch) {
  if (env.readOnly()) return { ok: false, reason: 'readonly' };
  const data = read(), entry = data.entries.find(e => e.id === id);
  if (!entry || !isObject(patch)) return { ok: false, reason: 'missing' };
  const wasDraft = isDraft(entry), hadTaste = Boolean(entry.taste), next = { ...entry };
  for (const k of PATCHABLE) {
    if (!(k in patch)) continue;
    if (k === 'taste') next.taste = cleanTaste(patch.taste);
    else if (k === 'insight') next.insight = cleanInsight({ ...entry.insight, ...patch.insight });
    else if (TEXTS.includes(k)) next[k] = text(patch[k]);
    else if (k === 'method' || k === 'recipeId') next[k] = text(patch[k], 40);
    else next[k] = { ...entry[k], ...plain(patch[k]) };
  }
  if (wasDraft && !isDraft(next) && full(data)) return { ok: false, reason: 'full' };
  next.editedAt = Date.now();
  data.entries[data.entries.indexOf(entry)] = next;
  if (!write(data)) return { ok: false, reason: 'failed' };
  if (!hadTaste && next.taste) emit({ type: 'taste_submitted', kind: next.kind, id, level: getMode() });
  if (wasDraft && !isDraft(next)) emit({ type: 'memory_saved', kind: next.kind, id, has_insight: fullInsight(next.insight) });
  // Insight is usually filled after the taste lock-in (entry already saved): reward it once, when it first becomes complete.
  else if (!wasDraft && !fullInsight(entry.insight) && fullInsight(next.insight)) emit({ type: 'insight_saved', kind: next.kind, id });
  return { ok: true, entry: next };
}

export const get = id => read().entries.find(e => e.id === id) || null;

/** filter: {kind, recipeId, drafts: true (only drafts) | false (no drafts)}; newest first. */
export function list(filter = {}) {
  return read().entries.filter(e => (!filter.kind || e.kind === filter.kind) && (!filter.recipeId || e.recipeId === filter.recipeId) && (filter.drafts === undefined || isDraft(e) === filter.drafts)).reverse();
}
export const draftCount = () => drafts(read()).length;

/** Latest other saved entry of the same recipe/method, for "so với ly trước" (spec §4 step 2). */
export function suggestCompare(entry) {
  return list({ drafts: false }).find(e => e.id !== entry.id && (e.recipeId === entry.recipeId || e.method === entry.method) && e.taste) || null;
}
/** Latest saved "Lần sau đổi" line for a recipe (shown when the bench opens, spec §4 step 5). */
export function nextChangeFor(recipeId) {
  return list({ recipeId }).find(e => text(e.insight?.nextChange).trim())?.insight.nextChange || '';
}
export const lastReal = () => list({ kind: 'real' })[0] || null;

const num = v => empty(v) || typeof v === 'boolean' ? NaN : Number(v);
function varsOf(e, withSteps) {
  const out = { method: e.method };
  for (const [group, keys] of Object.entries(COMPARE)) for (const k of keys) out[`${group}.${k}`] = e[group]?.[k];
  if (withSteps) (e.actual?.steps || []).forEach((s, i) => { out[`step.${i}`] = s.pick ?? s.value; });
  return out;
}
/** A/B comparison (spec §7). A variable counts as changed only when both sides have it and they differ. */
export function compare(a, b) {
  const steps = a.kind === 'game' && b.kind === 'game' && a.recipeId === b.recipeId;
  const va = varsOf(a, steps), vb = varsOf(b, steps), changedVars = [];
  let candidate = null, best = 0;
  for (const key of Object.keys(va)) {
    const x = va[key], y = vb[key];
    if (empty(x) || empty(y)) continue;
    const nx = num(x), ny = num(y), numeric = !Number.isNaN(nx) && !Number.isNaN(ny);
    const gap = numeric ? Math.abs(nx - ny) / (Math.max(Math.abs(nx), Math.abs(ny)) || 1) : 1;
    const same = numeric ? (key.startsWith('step.') ? gap <= STEP_TOLERANCE : nx === ny) : String(x).trim().toLowerCase() === String(y).trim().toLowerCase();
    if (same) continue;
    changedVars.push({ key, a: x, b: y });
    if (gap > best) { best = gap; candidate = key; }
  }
  const sameModel = Boolean(a.simulated && b.simulated && a.simulated.modelVersion === b.simulated.modelVersion);
  const taste = Object.fromEntries([...TASTE_KEYS, 'liking'].map(k => [k, [a.taste?.[k] || 0, b.taste?.[k] || 0]]));
  emit({ type: 'memory_compared', kind: a.kind === b.kind ? a.kind : 'mixed' });
  return { changedVars, warnMulti: changedVars.length >= 2, sameModel, candidate, taste, simulated: sameModel ? [a.simulated.score, b.simulated.score] : null };
}

// Remembered Quick/Journal choice (spec §5). Lives in `setup` so progress.js settings stay untouched; Scientist is opened by the Key of Curiosity.
export const getMode = () => ['journal', 'scientist'].includes(read().setup.mode) ? read().setup.mode : 'quick'; // scientist needs the Key of Curiosity (checked by the UI)
export function setMode(mode) {
  if (!['quick', 'journal', 'scientist'].includes(mode)) return false;
  const data = read(); data.setup.mode = mode; return write(data);
}
/** True exactly once: the first time a non-draft entry is saved (toast "data lives only in this browser"). */
export function takeFirstSaveNotice() {
  const data = read();
  if (data.setup.savedOnce || data.entries.every(isDraft)) return false;
  data.setup.savedOnce = true; return write(data);
}

// "Bộ dụng cụ của tôi" (spec §2/§6): the player's own gear (+ water/milk/brand) kept in `setup.kit`; sanitized on every read, never sent in events.
export const KIT_FIELDS = { equipment: ['grinder', 'kettle', 'dripper', 'filter', 'server', 'cup'], ingredients: ['water', 'milk', 'brand'] };
export const MAX_KIT_TEXT = 80; // same cap as the form inputs
function cleanKit(raw) {
  if (!isObject(raw)) return null;
  const kit = {};
  for (const [g, keys] of Object.entries(KIT_FIELDS)) {
    const src = isObject(raw[g]) ? raw[g] : {}, out = {};
    for (const k of keys) { const v = typeof src[k] === 'string' || typeof src[k] === 'number' ? text(src[k], MAX_KIT_TEXT).trim() : ''; if (v) out[k] = v; }
    if (Object.keys(out).length) kit[g] = out;
  }
  return Object.keys(kit).length ? kit : null;
}
export const getKit = () => cleanKit(read().setup.kit);
/** Save (or clear with an empty kit) the player's gear. Returns false when read-only or storage fails. */
export function setKit(input) {
  const data = read(), kit = cleanKit(input);
  if (kit) data.setup.kit = kit; else delete data.setup.kit;
  return write(data);
}
