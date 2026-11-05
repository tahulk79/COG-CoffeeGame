// Coffee Notebook modal (F-33 Memory + F-34 Quick Taste), spec: docs/shared/coffee-memory.md.
// Own <dialog> (stacks above the bench dialog, so closing it returns to the cup result). Scientist mode is a later unlock: only Quick/Journal here.
import { CROPS } from '../farm/content.js';
import { recipeById } from './recipes.js';
import { VARIABLES } from '../awakening/rules.js';
import { experimentDiff, coffeeDna } from '../awakening/unlocks.js';
import * as Memory from '../../state/memory.js';
import { t, formatNumber, numberLocale } from '../../i18n/index.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const ICONS = { aroma: '🌸', acidity: '🍋', sweetness: '🍯', bitterness: '🌰', body: '💧', aftertaste: '🔔' };
const BEAN = ['name', 'origin', 'process', 'roast', 'roastDate'];
const REAL = ['doseG', 'waterG', 'grind', 'tempC', 'bloomG', 'timeS'];
// Coffee Scientist (Key of Curiosity): the other groups of coffee-memory.md 6.
const SCI = { equipment: ['grinder', 'kettle', 'dripper', 'filter', 'server', 'cup'], preparation: ['rdt', 'rinseFilter', 'preheat', 'clean'], ingredients: ['water', 'tds', 'hardness', 'milk', 'milkRatio', 'brand'], environment: ['weather', 'tempC', 'humidity', 'place', 'noise', 'light'], personal: ['mood', 'alertness', 'focus', 'wellbeing'] };
const SCI_GROUPS = ['intended', ...Object.keys(SCI)];
const TIPS = { 'ingredients.tds': 'memory.tip.tds', 'ingredients.hardness': 'memory.tip.tds', 'preparation.rdt': 'memory.tip.rdt', 'ingredients.brand': 'memory.tip.equipment', 'equipment.grinder': 'memory.tip.equipment', 'equipment.kettle': 'memory.tip.equipment' };
const NUMERIC = new Set(['doseG', 'waterG', 'tempC', 'bloomG', 'bloomS', 'timeS']);
const when = ms => new Date(ms).toLocaleString(numberLocale(), { dateStyle: 'short', timeStyle: 'short' });
const toNumber = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : ''; };
const drinkName = e => e.kind === 'real' ? (e.method || t('memory.realCup')) : recipeById(e.recipeId)?.name || e.recipeId;
const drinkIcon = e => e.kind === 'real' ? '🏠' : recipeById(e.recipeId)?.icon || '☕';

function varLabel(entry, key) {
  if (key.startsWith('step.')) {
    const i = Number(key.slice(5)), step = recipeById(entry.recipeId)?.steps[i];
    return t('memory.var.step', { n: i + 1, name: step ? (step.type === 'bean' ? t('cafe.bench.bean') : step.text) : '' });
  }
  return t(`memory.var.${key}`);
}
function varValue(entry, key) {
  if (key.startsWith('step.')) {
    const s = entry.actual?.steps?.[Number(key.slice(5))];
    if (!s) return '—';
    if (s.pick != null) return s.type === 'bean' ? CROPS.find(c => c.id === s.pick)?.name || s.pick : s.pick;
    return `${formatNumber(s.value, { maximumFractionDigits: 1 })} ${s.unit}`;
  }
  const [group, field] = key.split('.');
  const v = field ? entry[group]?.[field] : entry[group];
  return v === undefined || v === null || v === '' ? '—' : String(v);
}

// realOnly: the Guide's notebook in the farm (coffee-memory.md §3): only cups outside the game, no game-cup drafts, no Questions/Keys tab (the Guide has them).
export function createMemoryUI({ notice = () => {}, awakening = null, realOnly = false } = {}) {
  const home = realOnly ? 'history' : 'log';
  const dialog = el('dialog', 'ui-modal ui-modal__window'); dialog.id = realOnly ? 'memory-dialog-guide' : 'memory-dialog'; dialog.setAttribute('aria-labelledby', realOnly ? 'memory-title-guide' : 'memory-title');
  const header = el('header'), title = el('h2'), tabs = el('div', 'cafe-tabs'), body = el('div', 'cafe-dialog-body mem-body');
  title.id = realOnly ? 'memory-title-guide' : 'memory-title'; title.append(el('span', '', '📓'), t('memory.title')); tabs.setAttribute('role', 'tablist');
  const closeButton = button('×', () => dialog.close(), 'cafe-close'); closeButton.setAttribute('aria-label', t('cafe.close'));
  header.append(title, closeButton); dialog.append(header, tabs, body); document.body.append(dialog);
  dialog.addEventListener('close', () => { body.replaceChildren(); s = {}; });

  let s = {}; // view: log | history | real | taste | after | compare; entry; form; picks; pair; back
  const go = (view, extra = {}) => { s = { ...s, view, ...extra }; render(); body.scrollTop = 0; };

  function render() {
    body.replaceChildren(); tabs.replaceChildren();
    const main = ['log', 'history', 'quest'].includes(s.view), onTabs = main || (s.view === 'taste' && s.fresh);
    tabs.hidden = !onTabs;
    if (onTabs) for (const id of realOnly ? ['history', 'real'] : ['log', 'history', 'real', ...(awakening ? ['quest'] : [])]) {
      const tab = button(id === 'quest' ? t('awakening.tab.quest') + (awakening.hasNew() ? ' ●' : '') : t(`memory.tab.${id}`), () => { if (id === 'real') startReal(); else go(id, { picks: [], fresh: false }); });
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(main ? id === s.view : id === 'real')); tabs.append(tab);
    }
    ({ log: viewLog, history: viewHistory, taste: viewTaste, after: viewAfter, compare: viewCompare, quest: viewQuest })[s.view]();
  }
  const back = () => body.append(button(t('memory.back'), () => go(s.back || home), 'cafe-link'));
  const emptyForm = () => ({ taste: Object.fromEntries([...Memory.TASTE_KEYS, 'liking'].map(k => [k, 0])), notes: '', bean: {}, actual: {}, method: '', ...Object.fromEntries(SCI_GROUPS.map(g => [g, {}])) });
  const sci = () => Boolean(awakening?.hasKey?.('curiosity'));
  const curMode = () => { const m = Memory.getMode(); return m === 'scientist' && !sci() ? 'journal' : m; }; // a kept notebook without the Key falls back
  const formOf = entry => ({ ...emptyForm(), id: entry.id, kind: entry.kind, recipeId: entry.recipeId, method: entry.method, taste: { ...emptyForm().taste, ...entry.taste }, notes: entry.notes, bean: { ...entry.bean }, actual: { ...entry.actual }, ...Object.fromEntries(SCI_GROUPS.map(g => [g, { ...entry[g] }])) });

  // F-35: open questions and Fragment/Key rows (same panels as the Guide in the farm).
  function viewQuest() {
    const questions = el('div', 'awk-panel'), keys = el('div', 'awk-panel'); body.append(questions, keys);
    const redraw = () => awakening.mountKeys(keys); // a decode redraws the question list itself; the Fragment rows follow
    awakening.mountQuestions(questions, redraw); redraw();
  }
  function viewLog() {
    const drafts = Memory.list({ drafts: true });
    body.append(el('p', 'cafe-note', t('memory.log.note')));
    if (!drafts.length) body.append(el('p', 'cafe-lead', t('memory.log.empty')));
    for (const d of drafts) {
      const row = button('', () => startTaste(d), 'mem-row-btn');
      row.append(el('span', 'cafe-icon', drinkIcon(d)), el('strong', '', drinkName(d)), el('small', '', when(d.createdAt)));
      body.append(row);
    }
  }

  function startTaste(entry) { go('taste', { entry, form: formOf(entry), fresh: false, back: s.view === 'history' ? 'history' : home }); }
  // "Ly ngoài đời": blank form, or prefilled from the last real cup.
  function startReal(prefill = null) {
    const f = emptyForm(); f.kind = 'real'; f.recipeId = 'custom';
    if (prefill) { f.method = prefill.method; f.bean = { ...prefill.bean }; f.actual = { ...prefill.actual }; for (const g of SCI_GROUPS) f[g] = { ...prefill[g] }; }
    go('taste', { entry: null, form: f, fresh: true, back: 'history', expBase: null, expVar: null });
  }

  // ---- Quick Taste form (also Journal details). Past entries and scores are never shown here (independent tasting). ----
  let inputs = [], onChange = () => {};
  // Experiment lock: with a baseline and one chosen variable, every other recipe (actual) field is read-only at the baseline value.
  const locked = (group, key) => Boolean(curMode() === 'scientist' && s.expBase && s.expVar && s.fresh && group === 'actual' && key !== s.expVar);
  function field(group, key, type = 'text', labelKey = null) {
    const f = s.form, label = el('label', 'mem-field'), input = el('input');
    if (group === 'personal') { input.min = 1; input.max = 5; }
    if (TIPS[`${group}.${key}`]) label.title = t(TIPS[`${group}.${key}`]);
    inputs.push({ group, key, label });
    input.type = type; input.value = (group ? f[group][key] : f[key]) ?? ''; input.maxLength = 80;
    if (NUMERIC.has(key)) input.inputMode = 'decimal';
    if (locked(group, key)) { input.disabled = true; label.classList.add('mem-locked'); }
    input.addEventListener('input', () => { if (group) f[group][key] = input.value; else f[key] = input.value; onChange(); });
    label.append(el('span', '', t(labelKey || `memory.var.${group ? `${group}.${key}` : key}`)), input); return label;
  }
  function scale(label, icon, key) {
    const f = s.form, row = el('div', 'mem-row'), chips = el('div', 'mem-chips'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', label);
    const paint = () => chips.querySelectorAll('button').forEach((c, i) => { c.setAttribute('aria-checked', String(f.taste[key] === i + 1)); });
    for (let n = 1; n <= 5; n++) {
      const chip = button(String(n), () => { f.taste[key] = f.taste[key] === n ? 0 : n; paint(); ready(); }, 'mem-chip');
      chip.setAttribute('role', 'radio'); chip.setAttribute('aria-label', `${label} ${n}/5`); chips.append(chip);
    }
    row.append(el('span', 'mem-label', `${icon} ${label}`), chips); paint(); return row;
  }
  let ready = () => {};
  function viewTaste() {
    const f = s.form, entry = s.entry, real = f.kind === 'real';
    inputs = []; onChange = () => {};
    if (!s.fresh) back();
    body.append(el('h3', 'cafe-subhead', entry ? `${drinkIcon(entry)} ${drinkName(entry)}` : t('memory.realCup')));
    body.append(el('p', 'cafe-note', real ? t('memory.hint.real') : t('memory.hint.game')));
    if (real) {
      body.append(field(null, 'method'));
      const last = Memory.lastReal();
      if (last && s.fresh) body.append(button(t('memory.redo'), () => startReal(last), 'cafe-link'));
    }
    const grid = el('div', 'mem-scales');
    for (const k of Memory.TASTE_KEYS) grid.append(scale(t(`memory.attr.${k}`), ICONS[k], k));
    body.append(el('p', 'cafe-note', t('memory.attr.scale')), grid, scale(t('memory.liking'), '❤️', 'liking'));
    const notes = el('textarea', 'mem-text'); notes.maxLength = Memory.MAX_TEXT; notes.rows = 2; notes.placeholder = t('memory.notes'); notes.value = f.notes;
    notes.setAttribute('aria-label', t('memory.notes')); notes.addEventListener('input', () => { f.notes = notes.value; }); body.append(notes);
    // Mode switch: Quick | Journal | Scientist (Scientist only with the Key of Curiosity); the choice is remembered.
    const mode = curMode(), sw = el('div', 'mem-modes'); sw.setAttribute('role', 'radiogroup');
    for (const m of ['quick', 'journal', ...(sci() ? ['scientist'] : [])]) { const b = button(t(`memory.mode.${m}`), () => { Memory.setMode(m); render(); }, 'cafe-link'); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(m === mode)); sw.append(b); }
    body.append(sw);
    if (mode !== 'quick') {
      const details = el('div', 'mem-details');
      details.append(el('h4', 'cafe-subhead', t('memory.bean')), ...[...BEAN, ...(mode === 'scientist' ? ['variety', 'storage'] : [])].map(k => field('bean', k, k === 'roastDate' ? 'date' : 'text')));
      if (real) details.append(el('h4', 'cafe-subhead', t('memory.recipe')), ...REAL.map(k => field('actual', k)));
      if (mode === 'scientist') details.append(...sciBlock(real));
      body.append(details);
    }
    if (real && s.fresh && mode === 'scientist') experimentBar();
    const submit = button(t('memory.submit'), () => save(), 'cafe-primary'), need = el('small', 'cafe-note', t('memory.needOne'));
    ready = () => { const ok = Object.values(f.taste).some(Boolean); submit.disabled = !ok; need.hidden = ok; submit.title = ok ? '' : t('memory.needOne'); };
    ready(); const actions = el('div', 'cafe-actions'); actions.append(submit); body.append(actions, need);
  }
  function check(group, key) {
    const f = s.form, label = el('label', 'mem-field mem-check'), input = el('input'); input.type = 'checkbox'; input.checked = f[group][key] === true;
    if (TIPS[`${group}.${key}`]) label.title = t(TIPS[`${group}.${key}`]);
    input.addEventListener('change', () => { f[group][key] = input.checked; });
    label.append(input, el('span', '', t(`memory.var.${group}.${key}`))); return label;
  }
  // "Bộ dụng cụ của tôi": save the gear typed in the form / fill it back (equipment + water, milk, brand; other fields untouched).
  function kitBar() {
    const f = s.form, row = el('div', 'cafe-actions'), kit = Memory.getKit();
    row.append(button(t('memory.kit.save'), () => {
      if (!Memory.KIT_FIELDS.equipment.some(k => String(f.equipment?.[k] ?? '').trim()) && !Memory.KIT_FIELDS.ingredients.some(k => String(f.ingredients?.[k] ?? '').trim())) { notice(t('memory.kit.empty'), false); return; }
      const ok = Memory.setKit({ equipment: f.equipment, ingredients: Object.fromEntries(Memory.KIT_FIELDS.ingredients.map(k => [k, f.ingredients[k]])) });
      notice(t(ok ? 'memory.kit.saved' : 'memory.err.failed'), ok); render();
    }, 'cafe-link'));
    const fill = button(t('memory.kit.fill'), () => {
      const k = Memory.getKit(); if (!k) return;
      f.equipment = { ...f.equipment, ...k.equipment }; f.ingredients = { ...f.ingredients, ...k.ingredients }; render();
    }, 'cafe-link');
    fill.disabled = !kit; if (!kit) fill.title = t('memory.kit.none');
    row.append(fill); return row;
  }
  function sciBlock(real) {
    const out = [el('p', 'cafe-note', t('memory.sci.hint'))];
    const sect = (g, nodes, note) => { out.push(el('h4', 'cafe-subhead', t(`memory.sci.g.${g}`)), ...nodes); if (note) out.push(el('small', 'cafe-note', note)); };
    if (real) sect('intended', REAL.map(k => field('intended', k, 'text', `memory.var.actual.${k}`)));
    sect('equipment', SCI.equipment.map(k => field('equipment', k)), t('memory.tip.equipment'));
    if (real) out.push(kitBar());
    sect('preparation', SCI.preparation.map(k => check('preparation', k)), t('memory.tip.rdt'));
    sect('ingredients', SCI.ingredients.map(k => field('ingredients', k)), t('memory.tip.tds'));
    sect('environment', SCI.environment.map(k => field('environment', k)));
    sect('personal', SCI.personal.map(k => field('personal', k, 'number')), t('memory.sci.personal'));
    return out;
  }
  // "Thí nghiệm": pre-fill from the last real cup, highlight what changed, warn when more than one variable differs.
  function experimentBar() {
    const f = s.form, wrap = el('div', 'mem-exp'), label = el('label', 'mem-field mem-check'), box = el('input'), status = el('p', 'cafe-note');
    box.type = 'checkbox'; box.checked = Boolean(s.expBase); label.append(box, el('span', '', t('memory.exp.toggle'))); wrap.append(label, status); body.append(wrap);
    const name = k => { const [g, x] = k.split('.'); return t(`memory.var.${g === 'intended' ? 'actual' : g}.${x}`); };
    const refresh = () => {
      if (!s.expBase) { status.textContent = ''; status.className = 'cafe-note'; return; }
      const diff = experimentDiff(s.expBase, f);
      for (const i of inputs) i.label.style.outline = diff.includes(`${i.group}.${i.key}`) ? '2px solid #c98a2b' : '';
      status.textContent = diff.length ? `${diff.length > 1 ? '⚠ ' : ''}${t('memory.exp.state', { n: diff.length, vars: diff.map(name).join(', ') })}${diff.length > 1 ? ` — ${t('memory.exp.warn')}` : ''}` : `${t('memory.exp.on')} ${t('memory.exp.same')}`;
      status.className = diff.length > 1 ? 'ui-alert ui-alert--warn' : 'cafe-note';
    };
    onChange = refresh;
    if (s.expBase) { // lock: choose the ONE recipe variable to change; the other recipe fields stay at the baseline (disabled)
      const pick = el('div', 'mem-chips mem-chips--wrap'); pick.setAttribute('role', 'radiogroup'); pick.setAttribute('aria-label', t('memory.exp.pick'));
      const choose = v => {
        s.expVar = v;
        if (v) for (const k of REAL) if (k !== v) f.actual[k] = s.expBase.actual?.[k] ?? '';
        render();
      };
      for (const v of [...VARIABLES, null]) { const c = button(v ? t(`memory.var.actual.${v}`) : t('memory.exp.free'), () => choose(v), 'mem-chip'); c.setAttribute('role', 'radio'); c.setAttribute('aria-checked', String((s.expVar || null) === v)); pick.append(c); }
      wrap.append(el('small', 'cafe-note', s.expVar ? t('memory.exp.locked', { var: t(`memory.var.actual.${s.expVar}`) }) : t('memory.exp.pickHint')), pick);
    }
    box.addEventListener('change', () => {
      if (!box.checked) { s.expBase = null; s.expVar = null; render(); return; }
      const base = Memory.lastReal();
      if (!base) { box.checked = false; status.textContent = t('memory.exp.none'); return; }
      s.expBase = base; s.expVar = null; f.method = base.method; f.bean = { ...base.bean }; f.actual = { ...base.actual }; for (const g of SCI_GROUPS) f[g] = { ...base[g] };
      render();
    });
    refresh();
  }
  function save() {
    const f = s.form, real = f.kind === 'real', payload = { taste: f.taste, notes: f.notes, bean: f.bean };
    if (curMode() === 'scientist') for (const g of SCI_GROUPS) { // empty values are dropped; intended is real-cup only (a game cup keeps its snapshot)
      if (g === 'intended' && !real) continue;
      const out = {}; for (const [k, v] of Object.entries(f[g] || {})) { if (v === '' || v === undefined || v === false) continue; out[k] = g === 'personal' ? (Math.round(toNumber(v)) >= 1 && Math.round(toNumber(v)) <= 5 ? Math.round(toNumber(v)) : '') : g === 'intended' && NUMERIC.has(k) ? toNumber(v) : v; if (out[k] === '') delete out[k]; }
      payload[g] = out;
    }
    if (real) {
      const actual = {}; for (const k of REAL) if (f.actual[k] !== undefined && f.actual[k] !== '') actual[k] = NUMERIC.has(k) ? toNumber(f.actual[k]) : f.actual[k];
      if (actual.doseG && actual.waterG) actual.ratio = Math.round(actual.waterG / actual.doseG * 10) / 10;
      Object.assign(payload, { actual, method: f.method || t('memory.realCup') });
    }
    const res = f.id ? Memory.updateEntry(f.id, payload) : Memory.addRealEntry({ ...payload, recipeId: 'custom' });
    if (!res.ok) { notice(t(`memory.err.${res.reason}`), false); return; }
    awakening?.check(true);
    if (Memory.takeFirstSaveNotice()) notice(t('settings.data.note'));
    go('after', { entry: res.entry });
  }

  // ---- After the taste is locked: suggested comparison (history now visible) and the 3-field Insight. ----
  function viewAfter() {
    const entry = s.entry, other = realOnly ? Memory.list({ drafts: false, kind: 'real' }).find(e => e.id !== entry.id && (e.recipeId === entry.recipeId || e.method === entry.method) && e.taste) || null : Memory.suggestCompare(entry);
    body.append(el('p', 'ui-alert', t('memory.after.done')));
    if (other) {
      body.append(el('p', 'cafe-lead', t('memory.after.suggest', { drink: drinkName(other), time: when(other.createdAt) })));
      const row = el('div', 'cafe-actions');
      row.append(button(t('memory.compare'), () => go('compare', { pair: [entry, other], back: 'after' }), 'cafe-primary'), button(t('memory.pickOther'), () => go('history', { picks: [entry.id] })));
      body.append(row);
    } else body.append(el('p', 'cafe-note', t('memory.after.none')));
    body.append(el('h3', 'cafe-subhead', t('memory.insight.title')));
    const area = {};
    for (const k of ['observation', 'hypothesis', 'nextChange']) {
      const label = el('label', 'mem-field'), box = el('textarea', 'mem-text'); box.rows = 2; box.maxLength = Memory.MAX_TEXT; box.value = entry.insight?.[k] || '';
      area[k] = box; label.append(el('span', '', t(`memory.insight.${k}`)), box); body.append(label);
    }
    const done = button(t('memory.insight.save'), () => {
      const insight = Object.fromEntries(Object.entries(area).map(([k, box]) => [k, box.value]));
      if (Object.values(insight).some(v => v.trim())) { const res = Memory.updateEntry(entry.id, { insight }); if (!res.ok) { notice(t(`memory.err.${res.reason}`), false); return; } }
      awakening?.check(true); dialog.close();
    }, 'cafe-primary');
    const actions = el('div', 'cafe-actions'); actions.append(done); body.append(actions);
  }

  // Key of Connection: Coffee DNA, a self-understanding profile (never a scientific label).
  function dnaBlock(entries) {
    const d = coffeeDna(entries), box = el('section', 'mem-dna'), v = n => n == null ? '—' : String(n);
    box.append(el('h3', 'cafe-subhead', t('awakening.dna.title')), el('p', 'cafe-note', t('awakening.dna.note')), el('p', 'cafe-note', t('awakening.dna.counts', { n: d.n, m: d.nLiked })));
    if (!d.nLiked) { box.append(el('p', 'cafe-note', t('awakening.dna.none'))); return box; }
    for (const k of Memory.TASTE_KEYS) box.append(el('p', 'cafe-note', `${ICONS[k]} ${t('awakening.dna.row', { attr: t(`memory.attr.${k}`), liked: v(d.liked[k]), all: v(d.all[k]) })}`));
    box.append(el('p', 'cafe-note', t('awakening.dna.top', { method: d.topMethod ? recipeById(d.topMethod)?.name || d.topMethod : '—', bean: d.topBean || '—' })));
    return box;
  }
  // ---- History: pick 2 cups to compare, or edit one. ----
  function viewHistory() {
    const entries = Memory.list(realOnly ? { drafts: false, kind: 'real' } : { drafts: false }), picks = s.picks || [];
    body.append(el('p', 'cafe-note', t('memory.history.pick')));
    if (!entries.length) body.append(el('p', 'cafe-lead', t('memory.history.empty')));
    else if (awakening?.hasKey?.('connection')) body.append(dnaBlock(entries));
    const compareBtn = button(t('memory.history.compare'), () => go('compare', { pair: picks.map(id => Memory.get(id)), back: 'history' }), 'cafe-primary');
    compareBtn.disabled = picks.length !== 2;
    for (const e of entries) {
      const row = el('div', 'mem-history'), pick = button('', () => { const at = picks.indexOf(e.id); if (at >= 0) picks.splice(at, 1); else { picks.push(e.id); if (picks.length > 2) picks.shift(); } s.picks = picks; render(); }, 'mem-row-btn');
      pick.setAttribute('aria-pressed', String(picks.includes(e.id)));
      const like = e.taste?.liking ? ` · ❤️ ${e.taste.liking}/5` : '';
      pick.append(el('span', 'cafe-icon', drinkIcon(e)), el('strong', '', drinkName(e)), el('small', '', `${when(e.createdAt)}${like}${e.simulated ? ` · ${t('memory.model')} ${e.simulated.score}` : ''}`));
      row.append(pick, button(t('memory.edit'), () => { s.back = 'history'; startTaste(e); }, 'cafe-link'));
      body.append(row);
    }
    if (entries.length) { const actions = el('div', 'cafe-actions'); actions.append(compareBtn); body.append(actions); }
  }

  // ---- A/B compare (spec §7): ≠ markers with text, no automatic cause, model scores only for the same modelVersion. ----
  function viewCompare() {
    const [a, b] = s.pair;
    back();
    const result = Memory.compare(a, b), table = el('table', 'mem-table');
    const head = el('tr'); for (const c of ['', `A · ${drinkName(a)}`, `B · ${drinkName(b)}`, '']) head.append(el('th', '', c)); table.append(head);
    const line = (label, x, y, differs) => { const tr = el('tr'); tr.append(el('th', '', label), el('td', '', x), el('td', '', y), el('td', 'mem-diff', differs ? t('memory.cmp.differs') : '')); table.append(tr); };
    for (const k of [...Memory.TASTE_KEYS, 'liking']) { const [x, y] = result.taste[k]; if (x || y) line(`${ICONS[k] || '❤️'} ${t(k === 'liking' ? 'memory.liking' : `memory.attr.${k}`)}`, x || '—', y || '—', x !== y); }
    for (const v of result.changedVars) line(varLabel(a, v.key), varValue(a, v.key), varValue(b, v.key), true);
    body.append(table);
    if (!result.changedVars.length) body.append(el('p', 'cafe-note', t('memory.cmp.none')));
    if (result.warnMulti) body.append(el('p', 'ui-alert ui-alert--warn', t('memory.cmp.warn')));
    if (result.candidate) body.append(el('p', 'cafe-note', t('memory.cmp.candidate', { name: varLabel(a, result.candidate) })));
    if (result.simulated) body.append(el('p', 'cafe-note', t('memory.cmp.model', { a: result.simulated[0], b: result.simulated[1] })));
    else if (a.simulated && b.simulated) body.append(el('p', 'cafe-note', t('memory.cmp.modelDiff')));
    if (awakening) { const fk = el('div', 'awk-fk'); body.append(fk); awakening.mountFirstKey(fk, [a, b], render); } // First Sixth Key (decode-awaken.md 5)
  }

  return {
    get isOpen() { return dialog.open; },
    // entryId: jump straight into the taste form for that draft (from the cup result); otherwise the tab (default Ghi sổ).
    open({ entryId = null, tab = home } = {}) {
      s = {};
      const entry = entryId && Memory.get(entryId);
      if (realOnly && tab === 'log') tab = 'history';
      if (entry && !(realOnly && entry.kind !== 'real')) go('taste', { entry, form: formOf(entry), back: home, fresh: false });
      else if (tab === 'real') startReal(); else go(tab, { picks: [] });
      if (!dialog.open) dialog.showModal();
    },
    close() { if (dialog.open) dialog.close(); },
    dispose() { if (dialog.open) dialog.close(); dialog.remove(); },
  };
}
