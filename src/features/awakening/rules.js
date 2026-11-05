// F-35 Decode & Awaken core. Spec: docs/design/godbean-gdd.md §9.5. Pure logic: no DOM, no storage, no economy.
// Everything is derived from player-made data handed in through `ctx`; nothing here can grant a Fragment/Key on its own.
//   ctx = { workDayMs, harvests[], batches[], floorDays[], shifts[], plots[], mastery{}, entries: () => oldest-first memory entries | null }
import { STEP_TOLERANCE, TASTE_KEYS } from '../../state/memory.js';

export const FRAGMENT_TYPES = ['origin', 'transformation', 'extraction', 'connection', 'exchange', 'reflection'];
// §3 table: Fragment type -> Key it opens -> Sixth Key dimension.
export const KEY_OF = { origin: 'nature', transformation: 'transformation', extraction: 'curiosity', connection: 'empathy', exchange: 'balance', reflection: 'connection' };
export const KEY_DIMENSION = { nature: 'universe', transformation: 'universe', curiosity: 'universe', empathy: 'people', balance: 'people', connection: 'self' };
export const FRAGMENTS_PER_MESSAGE = 3;
export const VARIABLES = ['grind', 'tempC', 'doseG', 'waterG']; // §5: the one variable a hypothesis names
export const FIRST_KEY_RECIPE = 'v60';
const STAR2_SCORE = 70; // same cut-off as farm/progression.js TIER_SCORE[2]
const HEAVEN = ['ripe', 'water', 'recipe', 'adjust', 'costs', 'customer'];

// ---------- small helpers ----------
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const fin = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const r1 = n => Math.round(n * 10) / 10;
const r2 = n => Math.round(n * 100) / 100;
const byId = (list, id) => (list || []).find(x => x.id === id);
const cmp = (a, b, eps = 0) => Math.abs(a - b) <= eps ? 'same' : a > b ? 'a' : 'b';
const profit = s => s.revenue - s.costs - s.wages - s.beans;
// Latest pair [earlier, later] (by list order) satisfying ok(earlier, later).
const pairWhere = (list, ok) => { for (let i = list.length - 1; i > 0; i--) for (let j = i - 1; j >= 0; j--) if (ok(list[j], list[i])) return [list[j], list[i]]; return null; };
const hasText = v => typeof v === 'string' && v.trim().length > 0;

/** Row cleaner for logged lists: schema { field: 'n'|'s'|'b' }. */
export const cleanList = (list, schema, cap) => (Array.isArray(list) ? list : []).filter(isObj).slice(-cap).map(o => Object.fromEntries(Object.entries(schema).map(([k, t]) => [k, t === 'n' ? fin(o[k]) : t === 'b' ? o[k] === true : String(o[k] ?? '').slice(0, 40)])));
export const SHIFT_SCHEMA = { id: 's', at: 'n', cups: 'n', revenue: 'n', costs: 'n', wages: 'n', beans: 'n', left: 'n', avgWait: 'n', tier: 'n', meanPrice: 'n', crew: 'n', menu: 'n', milk: 's', water: 's', staffN: 'n', tiredN: 'n', staffStars: 'n', staffSecs: 'n' };
const HARVEST_SCHEMA = { id: 's', at: 'n', day: 'n', cropId: 's', by: 's', grams: 'n', quality: 'n', fertilized: 'b', pruned: 'b', value: 'n' };
const BATCH_SCHEMA = { id: 's', machine: 's', at: 'n', day: 'n', cropId: 's', quality: 'n', delayMs: 'n' };
const FLOOR_SCHEMA = { id: 's', at: 'n', first: 'n', last: 'n' };

// ---------- questions ----------
// check(ctx) -> { refs: [ids], facts: {numbers, tag} } | null. facts are frozen into the question when it turns ready, so the decode
// dialog keeps showing the numbers the player saw even if the farm changes meanwhile.
const Q = (id, type, source, def) => ({ id, type, source, available: true, optionIds: ['a', 'b', 'same'], ...def });
const NA = (id, type, source, reason) => ({ id, type, source, available: false, reason, check: () => null, optionIds: [] });
const wetDry = c => { const wet = c.plots.filter(p => p.water >= 90).at(-1), dry = c.plots.filter(p => p.water <= 15).at(-1); return wet && dry ? [wet, dry] : null; };
const ordered = list => list.filter(s => s.cups >= 1);
const COSTS = ['wages', 'supplies', 'beans'], CHANGES = ['crew', 'menu', 'milk', 'water'];

export const QUESTIONS = [
  // --- Origin ---
  Q('ripe', 'origin', 'heaven', { // a = your hand-picked lot, b = staff-picked lot (same crop, same work day)
    check: c => { const p = pairWhere(c.harvests, (x, y) => x.day === y.day && x.cropId === y.cropId && x.by !== y.by && x.by !== 'auto' && y.by !== 'auto'); if (!p) return null; const [a, b] = p[0].by === 'player' ? p : [p[1], p[0]]; if (a.by !== 'player') return null; return { refs: p.map(h => h.id), facts: { a: r1(a.quality), b: r1(b.quality), tag: a.cropId } }; },
    answer: f => cmp(f.a, f.b, 1) }),
  Q('water', 'origin', 'heaven', { // a = progress % of a plot soaked by rain (never watered by you: watering sets 70), b = plot at water <= 15
    check: c => { const w = wetDry(c); return w && { refs: w.map(p => p.id), facts: { a: Math.round(w[0].ratio * 100), b: Math.round(w[1].ratio * 100), tag: w[0].cropId } }; },
    answer: f => cmp(f.a, f.b, 2) }),
  Q('yield', 'origin', 'play', { // a = coins of a fertilized-only harvest, b = coins of a pruned-only harvest (same crop)
    check: c => { const fo = h => h.fertilized && !h.pruned, po = h => h.pruned && !h.fertilized, p = pairWhere(c.harvests, (x, y) => x.cropId === y.cropId && (fo(x) && po(y) || po(x) && fo(y))); if (!p) return null; const [a, b] = fo(p[0]) ? p : [p[1], p[0]]; return { refs: p.map(h => h.id), facts: { a: r2(a.value), b: r2(b.value), qa: r1(a.quality), qb: r1(b.quality), tag: a.cropId } }; },
    answer: f => cmp(f.a, f.b, .05 * Math.max(f.a, f.b)) }),
  NA('region', 'origin', 'play', 'Nhật ký thu hoạch không lưu vùng, mỗi đời chỉ một vùng (chưa có)'),
  // --- Extraction ---
  Q('recipe', 'extraction', 'heaven', { // two hand-brewed cups of one recipe, same settings, both tasted; a/b = model score of the earlier / later cup
    check: c => { const es = c.entries(); if (!es) return null; const g = es.filter(e => e.kind === 'game' && e.taste && e.simulated), p = pairWhere(g, (x, y) => x.recipeId === y.recipeId && !changedVars(x, y).length); return p && { refs: p.map(e => e.id), facts: { a: r1(p[0].simulated.score), b: r1(p[1].simulated.score), tag: p[0].recipeId } }; },
    answer: f => cmp(f.a, f.b, 3) }),
  Q('adjust', 'extraction', 'heaven', { special: 'firstKey', check: () => null, optionIds: ['true', 'false', 'insufficient'] }), // §5, state machine below
  // --- Exchange ---
  Q('costs', 'exchange', 'heaven', { // A = shift with more revenue but less profit than B; pick the cost that grew most (A - B)
    optionIds: COSTS,
    check: c => { const p = pairWhere(c.shifts, (x, y) => x.revenue !== y.revenue && (x.revenue > y.revenue ? profit(x) < profit(y) : profit(y) < profit(x))); if (!p) return null; const [A, B] = p[0].revenue > p[1].revenue ? p : [p[1], p[0]]; return { refs: p.map(s => s.id), facts: { ra: A.revenue, rb: B.revenue, pa: r2(profit(A)), pb: r2(profit(B)), wages: r2(A.wages - B.wages), supplies: r2(A.costs - B.costs), beans: r2(A.beans - B.beans) } }; },
    answer: f => COSTS.reduce((best, k) => f[k] > f[best] ? k : best, COSTS[0]) }),
  Q('floor', 'exchange', 'play', { // a/b = price % of the first / the latest sale on a market day that hit the 30 % floor
    check: c => { const d = c.floorDays.at(-1); return d && { refs: [d.id], facts: { a: Math.round(d.first * 100), b: Math.round(d.last * 100) } }; },
    answer: f => cmp(f.a, f.b, 1) }),
  Q('price', 'exchange', 'play', { // a/b = revenue of the higher / lower mean-price shift
    check: c => { const p = pairWhere(c.shifts, (x, y) => Math.abs(x.meanPrice - y.meanPrice) >= .1); if (!p) return null; const [h, l] = p[0].meanPrice > p[1].meanPrice ? p : [p[1], p[0]]; return { refs: p.map(s => s.id), facts: { a: h.revenue, b: l.revenue, pa: r2(h.meanPrice), pb: r2(l.meanPrice), ca: h.cups, cb: l.cups } }; },
    answer: f => cmp(f.a, f.b, .05 * Math.max(f.a, f.b)) }),
  // --- Connection ---
  Q('customer', 'connection', 'heaven', { // two consecutive shifts: first lost >= 2, second lost fewer, exactly one of crew/menu/milk/water changed
    optionIds: CHANGES,
    check: c => { const s = c.shifts; for (let i = s.length - 1; i > 0; i--) { const x = s[i - 1], y = s[i], ch = CHANGES.filter(k => x[k] !== y[k]); if (x.left >= 2 && y.left < x.left && ch.length === 1) { const opts = [ch[0], ...CHANGES.filter(k => k !== ch[0]).slice(0, 2)].sort(); return { refs: [x.id, y.id], facts: { a: x.left, b: y.left, changed: ch[0], opts } }; } } return null; },
    answer: f => f.changed }),
  Q('wait', 'connection', 'play', { // a/b = guests lost in the longer / shorter average-wait shift (gap >= 15 s)
    check: c => { const p = pairWhere(ordered(c.shifts), (x, y) => Math.abs(x.avgWait - y.avgWait) >= 15); if (!p) return null; const [l, s] = p[0].avgWait > p[1].avgWait ? p : [p[1], p[0]]; return { refs: p.map(x => x.id), facts: { a: l.left, b: s.left, wa: r1(l.avgWait), wb: r1(s.avgWait) } }; },
    answer: f => cmp(f.a, f.b, 0) }),
  Q('tired', 'connection', 'play', { // a = rested shift, b = tired shift (>= 2 staff cups made below the F-29 energy threshold vs none); stars = staff cups only
    check: c => { const rested = x => x.staffN >= 3 && x.tiredN === 0, tired = x => x.staffN >= 3 && x.tiredN >= 2, p = pairWhere(c.shifts, (x, y) => rested(x) && tired(y) || tired(x) && rested(y)); if (!p) return null; const [a, b] = rested(p[0]) ? p : [p[1], p[0]]; return { refs: p.map(x => x.id), facts: { a: a.staffStars, b: b.staffStars, sa: r1(a.staffSecs), sb: r1(b.staffSecs), tn: b.tiredN } }; },
    answer: f => cmp(f.a, f.b, .1) }),
  // --- Transformation ---
  Q('roast-quality', 'transformation', 'play', { // a/b = roasted quality from the better / worse green beans (input gap >= 10)
    check: c => { const r = c.batches.filter(b => b.machine === 'roaster'), p = pairWhere(r, (x, y) => Math.abs(x.quality - y.quality) >= 10); if (!p) return null; const [a, b] = p[0].quality > p[1].quality ? p : [p[1], p[0]]; return { refs: p.map(x => x.id), facts: { a: r1(a.quality), b: r1(b.quality), tag: a.cropId } }; },
    answer: f => cmp(f.a, f.b, 1) }),
  Q('dry-wait', 'transformation', 'play', { // a/b = quality of a dryer batch collected at once / left >= 1 work day
    check: c => { const d = c.batches.filter(b => b.machine === 'dryer'), now = x => x.delayMs <= 10000, late = x => x.delayMs >= c.workDayMs, p = pairWhere(d, (x, y) => now(x) && late(y) || late(x) && now(y)); if (!p) return null; const [a, b] = now(p[0]) ? p : [p[1], p[0]]; return { refs: p.map(x => x.id), facts: { a: r1(a.quality), b: r1(b.quality), tag: a.cropId } }; },
    answer: f => cmp(f.a, f.b, 1) }),
  NA('roast-age', 'transformation', 'play', 'Cần luật hạn hạt rang (chưa có)'),
  Q('variety', 'transformation', 'play', { // spec §4.2 stand-in for roast-age: two roast batches of different crops; a/b = earlier / later roasted quality
    check: c => { const p = pairWhere(c.batches.filter(b => b.machine === 'roaster'), (x, y) => x.cropId !== y.cropId); return p && { refs: p.map(x => x.id), facts: { a: r1(p[0].quality), b: r1(p[1].quality), tag: p[1].cropId } }; },
    answer: f => cmp(f.a, f.b, 1) }),
  // --- Reflection (completion only: every valid option is accepted) ---
  Q('fav', 'reflection', 'play', { // >= 5 rated entries; options = the three taste traits where your two favourite cups score highest together
    completion: true,
    check: c => { const es = c.entries(); if (!es) return null; const rated = es.filter(e => e.taste?.liking); if (rated.length < 5) return null; const top = rated.map((e, i) => [e, i]).sort((x, y) => y[0].taste.liking - x[0].taste.liking || y[1] - x[1]).slice(0, 2).map(x => x[0]); const opts = TASTE_KEYS.map((k, i) => [k, i, top.reduce((s, e) => s + (e.taste[k] || 0), 0)]).sort((x, y) => y[2] - x[2] || x[1] - y[1]).slice(0, 3).map(x => x[0]); return { refs: top.map(e => e.id), facts: { a: top[0].taste.liking, b: top[1].taste.liking, opts } }; } }),
  Q('real-vs-game', 'reflection', 'play', { // latest real cup and latest game cup of the same method, both rated
    completion: true,
    check: c => { const es = c.entries(); if (!es) return null; const rated = es.filter(e => e.taste?.liking); for (let i = rated.length - 1; i >= 0; i--) { const r = rated[i]; if (r.kind !== 'real') continue; const g = rated.filter(e => e.kind === 'game' && e.method === r.method).at(-1); if (g) return { refs: [r.id, g.id], facts: { a: r.taste.liking, b: g.taste.liking } }; } return null; } }),
  Q('memory-text', 'reflection', 'play', { // >= 3 entries that have a memory note (the text itself is never read into facts)
    completion: true, optionIds: ['better', 'same', 'unsure'],
    check: c => { const es = c.entries(); if (!es) return null; const m = es.filter(e => hasText(e.memory)); return m.length >= 3 ? { refs: m.slice(-3).map(e => e.id), facts: { n: m.length } } : null; } }),
].map(q => ({ ...q, detect: c => { const r = q.available === false ? null : q.check(c); return r ? { ready: true, evidence: r.refs, facts: r.facts } : { ready: false, evidence: [], facts: null }; } }));
export const questionById = id => QUESTIONS.find(q => q.id === id);

/** Three choices for the decode dialog, params = the real numbers (UI formats text from key + params). */
export const optionsOf = (q, facts) => (facts?.opts || q.optionIds).map(id => ({ id, key: `awakening.q.${q.id}.${id}`, params: facts }));
export const isCorrect = (q, facts, choice) => optionsOf(q, facts).some(o => o.id === choice) && (q.completion === true || choice === q.answer(facts));

// ---------- hypothesis variables (shared by First Sixth Key + apply) ----------
/** Variables (VARIABLES) that differ between two game cups; present on both sides only; numbers within STEP_TOLERANCE count as equal. */
export function changedVars(x, y) {
  return VARIABLES.filter(k => {
    const p = x.actual?.[k], q = y.actual?.[k];
    if (p == null || q == null || p === '' || q === '') return false;
    const a = Number(p), b = Number(q);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) / (Math.max(Math.abs(a), Math.abs(b)) || 1) > STEP_TOLERANCE : String(p).trim().toLowerCase() !== String(q).trim().toLowerCase();
  });
}

// ---------- state ----------
export function emptyAwakening() {
  return {
    version: 1,
    questions: Object.fromEntries(HEAVEN.map(id => [id, { state: 'open', since: 0, evidence: [] }])),
    fragments: [], messages: [], applied: [], keys: [], messageAt: {},
    firstKey: { step: 0, entries: [], variable: null, direction: null, attribute: null, after: null, rejected: [] },
    samples: { harvests: [], batches: [], floorDays: [], market: null },
  };
}
const STATES = ['open', 'trying', 'ready', 'solved'];
const keyIds = Object.values(KEY_OF);
const uniq = (list, ok) => Array.isArray(list) ? list.filter((x, i) => ok(x) && list.indexOf(x) === i) : [];
const strs = (l, n) => Array.isArray(l) ? l.filter(s => typeof s === 'string').slice(0, n).map(s => s.slice(0, 48)) : [];
/** Save -> current shape. Old/missing/corrupt data falls back to defaults; known fields are kept (spec §7). */
export function normalizeAwakening(raw) {
  const base = emptyAwakening();
  if (!isObj(raw)) return base;
  for (const [id, q] of Object.entries(isObj(raw.questions) ? raw.questions : {})) {
    const def = questionById(id);
    if (!def || !isObj(q) || !STATES.includes(q.state)) continue;
    const facts = isObj(q.facts) ? JSON.parse(JSON.stringify(q.facts)) : null;
    base.questions[id] = { state: q.state === 'ready' && !facts && !def.special ? 'open' : q.state, since: fin(q.since), evidence: strs(q.evidence, 8), ...(facts ? { facts } : {}), ...(typeof q.wrong === 'string' ? { wrong: q.wrong.slice(0, 200) } : {}) };
  }
  base.fragments = (Array.isArray(raw.fragments) ? raw.fragments : []).filter(f => isObj(f) && FRAGMENT_TYPES.includes(f.type) && typeof f.questionId === 'string').slice(0, 200).map((f, i) => ({ id: String(f.id || `f${i + 1}`).slice(0, 24), type: f.type, questionId: f.questionId.slice(0, 24), at: fin(f.at), tag: f.tag == null ? '' : String(f.tag).slice(0, 40) }));
  base.messages = uniq(raw.messages, t => FRAGMENT_TYPES.includes(t));
  base.applied = uniq(raw.applied, t => FRAGMENT_TYPES.includes(t));
  base.keys = (Array.isArray(raw.keys) ? raw.keys : []).filter((k, i, l) => isObj(k) && keyIds.includes(k.id) && l.findIndex(o => o?.id === k.id) === i).map(k => ({ id: k.id, at: fin(k.at) }));
  base.messageAt = Object.fromEntries(Object.entries(isObj(raw.messageAt) ? raw.messageAt : {}).filter(([t]) => FRAGMENT_TYPES.includes(t)).map(([t, v]) => [t, fin(v)]));
  const fk = isObj(raw.firstKey) ? raw.firstKey : {};
  base.firstKey = { step: Math.min(7, Math.max(0, Math.floor(fin(fk.step)))), entries: strs(fk.entries, 3), variable: VARIABLES.includes(fk.variable) ? fk.variable : null, direction: ['up', 'down'].includes(fk.direction) ? fk.direction : null, attribute: TASTE_KEYS.includes(fk.attribute) ? fk.attribute : null, after: typeof fk.after === 'string' ? fk.after.slice(0, 48) : null, rejected: (Array.isArray(fk.rejected) ? fk.rejected : []).filter(isObj).slice(0, 3).map(r => ({ id: String(r.id || '').slice(0, 48), vars: strs(r.vars, 4) })) };
  const s = isObj(raw.samples) ? raw.samples : {};
  base.samples = { harvests: cleanList(s.harvests, HARVEST_SCHEMA, 20), batches: cleanList(s.batches, BATCH_SCHEMA, 20), floorDays: cleanList(s.floorDays, FLOOR_SCHEMA, 6), market: isObj(s.market) ? { day: fin(s.market.day), first: fin(s.market.first), last: fin(s.market.last), floor: s.market.floor === true } : null };
  return base;
}

// ---------- awarding ----------
const readyEvent = id => ({ name: 'question_ready', props: { id } });
const found = (type, what) => ({ name: 'discovery_saved', props: { type, what } });
const no = reason => ({ ok: false, reason, events: [] });

function award(A, specs, at, ev) {
  for (const s of specs) { A.fragments.push({ id: `f${A.fragments.length + 1}`, type: s.type, questionId: s.questionId, at, tag: s.tag == null ? '' : String(s.tag) }); ev.push(found(s.type, 'fragment')); }
  for (const type of new Set(specs.map(s => s.type))) {
    if (A.messages.includes(type) || A.fragments.filter(f => f.type === type).length < FRAGMENTS_PER_MESSAGE) continue;
    A.messages.push(type); A.messageAt[type] = at; ev.push(found(type, 'message'));
  }
}
const lastTag = (A, type) => A.fragments.filter(f => f.type === type).at(-1)?.tag;

// §4/§5 apply step per type: a new situation after the Message, built only from data created after it. Returns true when satisfied.
const APPLY = {
  origin: (A, c, m) => c.harvests.some(h => h.at > m && (h.fertilized || h.pruned) && h.cropId !== lastTag(A, 'origin')), // another crop, cared for on purpose
  transformation: (A, c, m) => c.batches.some(b => b.machine === 'roaster' && b.at > m && b.cropId !== lastTag(A, 'transformation')), // roast another crop
  connection: (A, c, m) => c.shifts.some(s => s.at > m && s.cups >= 3 && s.left <= 1), // a real shift losing at most one guest
  exchange: (A, c, m) => c.shifts.some(s => s.at > m && s.cups >= 3 && profit(s) > 0), // a shift that actually earns
  reflection: (A, c, m) => (c.entries() || []).some(e => e.createdAt > m && e.taste && hasText(e.insight?.nextChange)), // a new cup with a "next change" written
  extraction: (A, c, m) => { // a cup of ANOTHER recipe that changed the same variable (and only it) versus the previous cup of that recipe
    const es = c.entries(), fk = A.firstKey; if (!es || fk.step !== 6) return false;
    return es.some((x, i) => x.kind === 'game' && x.taste && x.recipeId !== FIRST_KEY_RECIPE && x.createdAt > m && (() => { const prev = es.slice(0, i).filter(e => e.kind === 'game' && e.recipeId === x.recipeId).at(-1); const ch = prev ? changedVars(prev, x) : []; return ch.length === 1 && ch[0] === fk.variable; })());
  },
};
function applyAll(A, c, at, ev) {
  for (const type of A.messages) {
    if (A.applied.includes(type) || !APPLY[type](A, c, A.messageAt[type] ?? 0)) continue;
    A.applied.push(type); A.keys.push({ id: KEY_OF[type], at }); ev.push(found(KEY_OF[type], 'key'));
    if (type === 'extraction') A.firstKey.step = 7;
  }
}

// ---------- First Sixth Key (§5) ----------
// step: 0 locked/none, 1 cup A tasted, 2 cup B tasted, 3 hypothesis (one variable), 4 cup C tasted (decode ready),
//       5 decoded (3 Extraction Fragments; transient), 6 Message formed (apply pending), 7 Key of Curiosity.
const cupsOf = es => es.filter(e => e.kind === 'game' && e.recipeId === FIRST_KEY_RECIPE && e.taste && e.simulated);
function firstKey(A, c, at, ev) {
  const q = A.questions.adjust, fk = A.firstKey;
  if (q.state === 'open') {
    if (A.questions.recipe?.state === 'solved' || (c.mastery?.[FIRST_KEY_RECIPE]?.best || 0) >= STAR2_SCORE) { q.state = 'trying'; q.since = at; ev.push(readyEvent('adjust')); } else return;
  }
  const es = c.entries(); if (!es || fk.step >= 4) return;
  const cups = cupsOf(es);
  if (fk.step === 0 && cups.length) { fk.entries = [cups[0].id]; fk.step = 1; }
  if (fk.step === 1) { const i = cups.findIndex(e => e.id === fk.entries[0]); if (i >= 0 && cups[i + 1]) { fk.entries[1] = cups[i + 1].id; fk.step = 2; } }
  if (fk.step === 3) {
    const b = byId(cups, fk.entries[1]); if (!b) return;
    const from = Math.max(cups.indexOf(b), cups.findIndex(e => e.id === fk.after)), rejected = [];
    for (const x of cups.slice(from + 1)) {
      const ch = changedVars(b, x);
      if (ch.length === 1 && ch[0] === fk.variable) { fk.entries[2] = x.id; fk.step = 4; q.state = 'ready'; fk.rejected = []; ev.push(readyEvent('adjust')); return; }
      rejected.push({ id: x.id, vars: ch });
    }
    fk.rejected = rejected.slice(-3);
  }
}
function hypothesis(A, c, ch) {
  const fk = A.firstKey;
  if (fk.step !== 2) return no('step');
  if (!VARIABLES.includes(ch?.variable) || !['up', 'down'].includes(ch?.direction) || !TASTE_KEYS.includes(ch?.attribute)) return no('badHypothesis');
  const es = c.entries(); if (!es) return no('noMemory');
  const pair = fk.entries.map(id => byId(es, id));
  if (pair.some(e => !e)) return no('missing');
  if (!pair.some(e => hasText(e.insight?.hypothesis))) return no('noHypothesisText'); // the player must have written/chosen it in the A/B comparison
  Object.assign(fk, { variable: ch.variable, direction: ch.direction, attribute: ch.attribute, step: 3, after: cupsOf(es).at(-1)?.id ?? null, rejected: [] });
  return { ok: true, events: [] };
}
function decodeFirstKey(A, c, choice, at) {
  const fk = A.firstKey;
  if (fk.step !== 4) return no('notReady');
  if (!['true', 'false', 'insufficient'].includes(choice)) return no('badChoice');
  const es = c.entries(); if (!es) return no('noMemory');
  const [, b, x] = fk.entries.map(id => byId(es, id)); if (!b || !x) return no('missing');
  const vb = b.taste?.[fk.attribute] || 0, vc = x.taste?.[fk.attribute] || 0, delta = vc - vb, dir = fk.direction === 'up' ? 1 : -1;
  const consistent = !vb || !vc || delta === 0 ? choice === 'insufficient' : choice === 'true' ? delta * dir > 0 : choice === 'false' ? delta * dir < 0 : false;
  if (!consistent) return { ok: false, reason: 'inconsistent', reminder: { attribute: fk.attribute, direction: fk.direction, variable: fk.variable, b: vb, c: vc, delta }, events: [] };
  const ev = [];
  A.questions.adjust.state = 'solved';
  fk.step = 5;
  award(A, [1, 2, 3].map(() => ({ type: 'extraction', questionId: 'adjust', tag: fk.variable })), at, ev);
  fk.step = 6; // the Message forms in the same call (3 Fragments at once)
  return { ok: true, correct: true, xp: true, events: ev };
}

// ---------- public actions ----------
/** Re-evaluate everything from ctx. Safe to call any time; with an empty ctx it changes nothing. */
function refresh(A, c, at) {
  const ev = [];
  for (const q of QUESTIONS) {
    if (!q.available || q.special) continue;
    const st = A.questions[q.id];
    if (st?.state === 'solved' || st?.state === 'ready') continue;
    const d = q.detect(c);
    if (!d.ready || st?.wrong === d.evidence.join('|')) continue; // a wrong answer waits for new evidence (different refs)
    A.questions[q.id] = { state: 'ready', since: at, evidence: d.evidence, facts: d.facts, ...(st?.wrong ? { wrong: st.wrong } : {}) };
    ev.push(readyEvent(q.id));
  }
  firstKey(A, c, at, ev);
  applyAll(A, c, at, ev);
  return ev;
}
function decode(A, c, id, choice, at) {
  const q = questionById(id), st = A.questions[id];
  if (!q || !q.available || !st || st.state !== 'ready') return no('notReady');
  if (q.special) return decodeFirstKey(A, c, choice, at);
  if (!st.facts) return no('notReady');
  if (!optionsOf(q, st.facts).some(o => o.id === choice)) return no('badChoice');
  if (!isCorrect(q, st.facts, choice)) { st.state = 'trying'; st.wrong = st.evidence.join('|'); delete st.facts; return { ok: true, correct: false, events: [] }; }
  const ev = [];
  st.state = 'solved';
  award(A, [{ type: q.type, questionId: id, tag: st.facts.tag }], at, ev);
  return { ok: true, correct: true, xp: true, events: ev };
}

/** Entry point used by farm/model.js: action = 'check' | 'decode' {questionId, choice} | 'hypothesis' {variable, direction, attribute}. */
export function awaken(A, ctx, action, choice, at) {
  if (action === 'check') return { ok: true, events: refresh(A, ctx, at) };
  if (action === 'hypothesis') { const r = hypothesis(A, ctx, choice); return r.ok ? { ...r, events: refresh(A, ctx, at) } : r; }
  if (action === 'decode') { const r = decode(A, ctx, choice?.questionId, choice?.choice, at); return r.ok ? { ...r, events: [...r.events, ...refresh(A, ctx, at)] } : r; }
  return no('action');
}

/** Read model for the UI: public question list with state, evidence refs and the three options (frozen numbers). */
export function viewQuestions(A) {
  return QUESTIONS.map(q => { const st = A.questions[q.id]; return { id: q.id, type: q.type, source: q.source, available: q.available, reason: q.reason || '', state: st?.state || 'open', evidence: st?.evidence || [], options: st?.state === 'ready' && st.facts ? optionsOf(q, st.facts) : q.special && st?.state === 'ready' ? optionsOf(q, null) : [], facts: st?.facts || null }; });
}
