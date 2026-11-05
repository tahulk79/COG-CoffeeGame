// F-35 Decode & Awaken UI (docs/shared/decode-awaken.md §8). One controller per play session, created by the farm scene and shared
// with the café (same `farm` model). It only calls farm.act('awakening', ...): no Fragment/Key can come from this file.
import { questionById, viewQuestions, VARIABLES, KEY_OF } from './rules.js';
import { uiState, sortQuestions, attentionIds, evidenceLines, fragmentRows, pips, firstKeyView, isFirstPair } from './view.js';
import { hasKey } from './unlocks.js';
import * as Memory from '../../state/memory.js';
import { flyTo } from '../../shared/vfx/index.js';
import { t, formatNumber } from '../../i18n/index.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const STATE_ICON = { open: '○', trying: '🧪', ready: '🔎', solved: '✓', locked: '🔒' };
const TYPE_ICON = { origin: '🌱', transformation: '🔥', extraction: '⚗️', connection: '🤝', exchange: '⚖️', reflection: '🪞' };
const fmt = params => Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, typeof v === 'number' ? formatNumber(v, { maximumFractionDigits: 2 }) : v]));
const tn = type => t(`awakening.type.${type}`);
const center = node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

export function createAwakening({ farm, notice = () => {}, helpButton = () => document.getElementById('farm-help-toggle') }) {
  const seen = new Set(), timers = new Set();
  let dot = null, dialog = null, point = null, last = { rev: -1, at: 0 }, council = null;
  const A = () => farm.peek().awakening;
  const list = () => viewQuestions(A());

  function paintDot() {
    const need = attentionIds(list(), A()).some(id => !seen.has(id)), btn = helpButton();
    if (need && btn && !dot) { dot = el('span', 'ui-badge ui-badge--dot awk-dot'); dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', t('awakening.dot')); btn.append(dot); }
    if (dot) dot.hidden = !need;
  }
  /** Re-evaluates the questions from the player's data. Cheap guard: only when the farm changed (or `force`), at most every 3 s. */
  function check(force = false) {
    const now = Date.now();
    if (!force && (farm.peek().workRevision === last.rev || now - last.at < 3000)) return;
    farm.act('awakening', 'check'); last = { rev: farm.peek().workRevision, at: now }; paintDot();
  }
  function fx(what) {
    const target = helpButton(), visible = target && target.getClientRects().length > 0;
    flyTo(point, visible ? target : null, { icon: { fragment: '✨', message: '📜', key: '🗝️' }[what], text: '' }); point = null;
  }
  const off = farm.onEvent((type, props) => {
    if (type === 'question_ready') {
      const adjust = props.id === 'adjust' && A().firstKey.step < 3;
      notice(adjust ? t('awakening.toast.adjust') : t('awakening.toast.ready', { title: t(`awakening.q.${props.id}.title`) }), true); paintDot();
    } else if (type === 'discovery_saved') {
      const what0 = props.type, what = props.what;
      fx(what);
      if (what === 'fragment') notice(t('awakening.toast.fragment', { type: tn(what0) }), true);
      else if (what === 'message') notice(t('awakening.toast.message', { type: tn(what0) }), true);
      else notice(t('awakening.toast.key', { key: t(`awakening.key.${what0}`) }), true);
    } else if (type === 'shift_ended') { // after the shift is stored (the event fires inside act), never re-enter act
      const id = setTimeout(() => { timers.delete(id); check(true); }, 0); timers.add(id);
    }
  });

  // ---------- panels ----------
  function questionRow(q) {
    const st = uiState(q), art = el('article', 'awk-q'); art.dataset.state = st;
    const head = el('div', 'awk-q__head');
    head.append(el('span', 'awk-chip', `${STATE_ICON[st]} ${t(`awakening.state.${st}`)}`), el('span', 'awk-chip awk-chip--type', `${TYPE_ICON[q.type]} ${tn(q.type)}`));
    art.append(head, el('strong', 'awk-q__title', t(`awakening.q.${q.id}.title`)));
    if (st === 'locked') art.append(el('p', 'awk-note', t('awakening.locked', { reason: t(`awakening.q.${q.id}.reason`) })));
    else if (st !== 'solved') art.append(el('p', 'awk-note', `${t('awakening.howto')} ${t(`awakening.q.${q.id}.hint`)}`));
    if (q.id === 'adjust' && ['trying', 'ready'].includes(st)) art.append(el('p', 'awk-note', t('awakening.step', { n: A().firstKey.step })));
    if (st === 'trying' && A().questions[q.id]?.wrong) art.append(el('p', 'awk-note awk-note--warn', `⚠ ${t('awakening.decode.wrong')}`));
    if (st === 'ready') { const b = button(`🔎 ${t('awakening.decode.open')}`, () => { point = center(b); openDecode(q.id).then(() => { if (host) mountQuestions(host, afterDecode); afterDecode?.(); }); }, 'ui-btn ui-btn--go awk-btn'); art.append(b); }
    return art;
  }
  let host = null, afterDecode = null; // last questions host, so a decode started from it can redraw it (and whatever shows the Fragments)
  // F-45: lối tắt 'Gặp Hội đồng' khi có chuyên gia đang chờ (đóng hộp Sổ tay rồi lia camera/mở). Không dính Decode:
  // 6 câu mở vẫn `open` từ đầu, trả lời đúng ở Hội đồng không trao Fragment.
  function councilRow() {
    const waiting = council?.waiting();
    if (!waiting) return [];
    const art = el('article', 'awk-q'); art.dataset.state = 'ready';
    const go = button(`🏛 ${t('awakening.council.meet')}`, () => { go.closest('dialog')?.close(); council.open(); }, 'ui-btn ui-btn--go awk-btn');
    art.append(el('strong', 'awk-q__title', t('awakening.council.waiting', { name: waiting.expert.name, n: waiting.questions.length })), go);
    return [art];
  }
  function mountQuestions(node, onDecoded = null) {
    host = node; afterDecode = onDecoded; check(true);
    const qs = list(); for (const id of attentionIds(qs, A())) seen.add(id); paintDot();
    node.replaceChildren(...councilRow(), el('p', 'awk-note', t('awakening.intro')), ...sortQuestions(qs).map(questionRow));
  }
  function mountKeys(node) {
    const A_ = A(), rows = fragmentRows(A_);
    node.replaceChildren(...councilRow(), el('p', 'awk-note', t('awakening.keys.intro', { n: rows.filter(r => r.hasKey).length })), el('p', 'awk-lore-flag', `ℹ️ ${t('awakening.lore.flag')}`));
    for (const r of rows) {
      const art = el('article', 'awk-q'), key = t(`awakening.key.${r.key}`);
      art.dataset.state = r.hasKey ? 'solved' : r.count ? 'trying' : 'open';
      art.append(el('strong', 'awk-q__title', `${TYPE_ICON[r.type]} ${t('awakening.keys.fragment', { type: tn(r.type) })} → 🗝️ ${key}`), el('p', 'awk-note', t('awakening.keys.opens', { key, dim: t(`awakening.dim.${r.dimension}`) })), el('p', 'awk-note', `🔓 ${t(`awakening.unlock.${r.key}`)}`));
      const pipLine = el('p', 'awk-pips', `${pips(r.count)} ${t('awakening.keys.pips', { n: r.count })}`); pipLine.setAttribute('aria-label', t('awakening.keys.pips', { n: r.count })); art.append(pipLine);
      if (r.message) art.append(el('p', 'awk-lore', `📜 ${t('awakening.lore.label')}: ${t(`awakening.lore.${r.type}`)}`));
      if (r.hasKey) art.append(el('p', 'awk-lore', `📜 ${t('awakening.lore.label')}: ${t(`awakening.lore.key.${r.key}`)}`));
      if (r.message && !r.hasKey) art.append(el('p', 'awk-note', t('awakening.keys.apply', { text: t(`awakening.apply.${r.type}`) })));
      if (r.hasKey) art.append(el('p', 'awk-done', t('awakening.keys.done', { key })));
      node.append(art);
    }
  }

  // ---------- decode dialog ----------
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el('dialog', 'ui-modal ui-modal__window'); dialog.id = 'decode-dialog'; dialog.setAttribute('aria-labelledby', 'decode-title');
    document.body.append(dialog); return dialog;
  }
  const varName = key => t(`memory.var.${key}`);
  /** Lines of evidence for the First Sixth Key: hypothesis, the changed variable B -> C, taste and model score. */
  function firstKeyEvidence() {
    const fk = A().firstKey, [, b, c] = fk.entries.map(id => Memory.get(id)), out = [];
    if (!b || !c) return out;
    const attr = t(`memory.attr.${fk.attribute}`), tb = b.taste?.[fk.attribute], tc = c.taste?.[fk.attribute];
    out.push(t('awakening.fk.hypShown', { variable: varName(fk.variable), attr, dir: t(`awakening.dir.${fk.direction}`) }));
    out.push(t('awakening.fk.evVar', { variable: varName(fk.variable), b: b.actual?.[fk.variable] ?? '—', c: c.actual?.[fk.variable] ?? '—' }));
    out.push(t('awakening.fk.evTaste', { attr, b: tb || '—', c: tc || '—' }));
    if (b.simulated && c.simulated) out.push(t('awakening.fk.evModel', { b: b.simulated.score, c: c.simulated.score }));
    if (b.insight?.hypothesis || Memory.get(fk.entries[0])?.insight?.hypothesis) out.push(t('awakening.fk.evHyp', { text: b.insight?.hypothesis || Memory.get(fk.entries[0]).insight.hypothesis }));
    return out;
  }
  /** Opens the decode modal for a ready question. Resolves when it is closed. */
  function openDecode(id) {
    const v = list().find(x => x.id === id), q = questionById(id);
    if (!v || !q || v.state !== 'ready') { check(true); return Promise.resolve(); }
    const dlg = ensureDialog(), completion = q.completion === true, special = Boolean(q.special);
    return new Promise(resolve => {
      const header = el('header'), title = el('h2'), body = el('div', 'awk-decode');
      title.id = 'decode-title'; title.append(el('span', '', '🔎'), `${t('awakening.decode.title')}`);
      const close = button('×', () => dlg.close(), 'cafe-close'); close.setAttribute('aria-label', t('awakening.decode.close'));
      header.append(title, close); dlg.replaceChildren(header, body);
      dlg.addEventListener('close', resolve, { once: true });
      const lines = special ? firstKeyEvidence() : evidenceLines(t(`awakening.q.${id}.evidence`, fmt(v.facts)));
      const list_ = el('ul', 'awk-evidence'); for (const l of lines) list_.append(el('li', '', l));
      const ask = el('p', 'awk-ask', completion ? t('awakening.decode.askDone') : t('awakening.decode.ask')), status = el('p', 'awk-note', ''), choices = el('div', 'awk-choices');
      body.append(el('strong', 'awk-q__title', t(`awakening.q.${id}.title`)), el('h3', 'awk-sub', `📋 ${t('awakening.decode.data')}`), list_, ask, choices, status);
      let picked = completion ? null : undefined;
      const submit = completion ? button(t('awakening.decode.submit'), () => send(picked), 'ui-btn ui-btn--go awk-btn') : null;
      if (submit) submit.disabled = true;
      for (const o of v.options) {
        const b = button(t(o.key, fmt(o.params)), () => {
          if (!completion) return send(o.id);
          picked = o.id; submit.disabled = false; choices.querySelectorAll('button').forEach(c => c.setAttribute('aria-checked', String(c === b)));
        }, 'ui-btn awk-choice');
        if (completion) { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); }
        choices.append(b);
      }
      if (completion) { choices.setAttribute('role', 'radiogroup'); body.append(submit); }
      function send(choice) {
        const before = A().fragments.length;
        if (!point) point = center(submit || choices);
        const r = farm.act('awakening', 'decode', { questionId: id, choice });
        if (!r.ok && r.reason === 'inconsistent' && r.reminder) { // First Sixth Key: show the numbers again and let the player choose again
          const m = r.reminder;
          status.textContent = `⚠ ${t('awakening.fk.inconsistent', { attr: t(`memory.attr.${m.attribute}`), b: m.b, c: m.c, delta: (m.delta > 0 ? '+' : '') + m.delta, dir: t(`awakening.dir.${m.direction}`) })}`; status.className = 'awk-note awk-note--warn'; return;
        }
        choices.hidden = ask.hidden = true; if (submit) submit.hidden = true;
        if (!r.ok) status.textContent = `⚠ ${t(`awakening.err.${r.reason}`) === `awakening.err.${r.reason}` ? t('awakening.err.generic') : t(`awakening.err.${r.reason}`)}`;
        else if (!r.correct) status.textContent = `🧪 ${t('awakening.decode.wrong')}`;
        else {
          const gained = A().fragments.length - before, type = A().fragments.at(-1)?.type;
          status.textContent = `✨ ${t(completion ? 'awakening.decode.done' : 'awakening.decode.right', { n: gained, type: type ? tn(type) : '', xp: r.xp ? t('awakening.decode.xp', { xp: r.xp }) : '' })}`;
        }
        status.className = 'awk-note awk-result'; paintDot();
        body.append(button(t('awakening.decode.close'), () => dlg.close(), 'ui-btn awk-btn'));
      }
      dlg.showModal();
    });
  }

  // ---------- First Sixth Key in the notebook compare view ----------
  function setHypothesis({ entryId, text, variable, direction, attribute }) {
    const w = Memory.updateEntry(entryId, { insight: { hypothesis: text } });
    if (!w.ok) return { ok: false, reason: 'noMemory' };
    return farm.act('awakening', 'hypothesis', { variable, direction, attribute });
  }
  /** Progress 1-7, the hypothesis form (step 2, only for the first A/B pair), rejected cups, and the decode button (step 4). */
  function mountFirstKey(node, pair, rerender) {
    const A_ = A(), q = A_.questions.adjust, v = firstKeyView(A_);
    if (q.state === 'open' || pair.some(e => !e || e.kind !== 'game' || e.recipeId !== 'v60')) { node.hidden = true; return; }
    node.hidden = false; node.replaceChildren(el('h3', 'awk-sub', t('awakening.fk.title')));
    const steps = el('ol', 'awk-steps');
    v.done.forEach((ok, i) => { const li = el('li', ok ? 'is-done' : i + 1 === v.current ? 'is-now' : '', `${ok ? '✓' : i + 1 === v.current ? '▶' : '○'} ${i + 1}. ${t(`awakening.fk.s${i + 1}`)}`); steps.append(li); });
    node.append(steps);
    const name = k => varName(k), dirName = d => t(`awakening.dir.${d}`);
    if (v.canHypothesis) {
      if (!isFirstPair(A_, pair)) { node.append(el('p', 'awk-note', t('awakening.fk.pickAB'))); return; }
      const sel = (label, opts) => { const l = el('label', 'mem-field'), s = el('select', 'awk-select'); for (const [val, text] of opts) { const o = el('option', '', text); o.value = val; s.append(o); } l.append(el('span', '', label), s); return [l, s]; };
      const [l1, sv] = sel(t('awakening.fk.hypIf'), VARIABLES.map(k => [k, name(k)])), [l2, sa] = sel(t('awakening.fk.hypDir'), [['up', dirName('up')], ['down', dirName('down')]]), [l3, st] = sel(t('awakening.fk.hypAttr'), Memory.TASTE_KEYS.map(k => [k, t(`memory.attr.${k}`)]));
      const box = el('textarea', 'mem-text'); box.rows = 2; box.maxLength = Memory.MAX_TEXT; box.setAttribute('aria-label', t('awakening.fk.hypText'));
      let edited = false; const sentence = () => t('awakening.fk.hypSentence', { variable: name(sv.value), attr: st.options[st.selectedIndex].text, dir: dirName(sa.value) });
      for (const s of [sv, sa, st]) s.addEventListener('change', () => { if (!edited) box.value = sentence(); });
      box.addEventListener('input', () => { edited = true; }); box.value = sentence();
      const msg = el('p', 'awk-note awk-note--warn', ''); msg.hidden = true;
      const go = button(t('awakening.fk.hypSet'), () => {
        if (!box.value.trim()) { msg.hidden = false; msg.textContent = `⚠ ${t('awakening.fk.needText')}`; return; }
        const r = setHypothesis({ entryId: A_.firstKey.entries[1], text: box.value, variable: sv.value, direction: sa.value, attribute: st.value });
        if (!r.ok) { msg.hidden = false; msg.textContent = `⚠ ${t(`awakening.err.${r.reason}`)}`; return; }
        notice(t('awakening.fk.hypSaved', { variable: name(sv.value) }), true); rerender();
      }, 'ui-btn ui-btn--go awk-btn');
      node.append(el('h4', 'awk-sub', t('awakening.fk.hypTitle')), l1, l3, l2, el('span', 'awk-note', t('awakening.fk.hypText')), box, msg, go);
      return;
    }
    if (v.step >= 3 && v.variable) node.append(el('p', 'awk-note', `💭 ${t('awakening.fk.hypShown', { variable: name(v.variable), attr: t(`memory.attr.${v.attribute}`), dir: dirName(v.direction) })}`));
    if (v.step === 3) {
      for (const r of v.rejected) node.append(el('p', 'awk-note awk-note--warn', `⚠ ${t('awakening.fk.rejected', { n: r.vars.length, vars: r.vars.map(name).join(', ') || '—', variable: name(v.variable) })}`));
      node.append(el('p', 'awk-note', t('awakening.fk.waitC', { variable: name(v.variable) })));
    }
    if (v.canDecode) { const b = button(`🔎 ${t('awakening.fk.decode')}`, () => { point = center(b); openDecode('adjust').then(rerender); }, 'ui-btn ui-btn--go awk-btn'); node.append(b); }
    if (v.applyPending) node.append(el('p', 'awk-note', t('awakening.keys.apply', { text: t('awakening.apply.extraction') })));
    if (v.finished) node.append(el('p', 'awk-done', t('awakening.keys.done', { key: t(`awakening.key.${KEY_OF.extraction}`) })));
  }

  paintDot();
  return {
    // provider { waiting(): {expert, questions} | null, open() } do farm game đặt (F-45).
    setCouncil(provider) { council = provider; },
    check, hasKey: id => hasKey(farm.peek(), id), mountQuestions, mountKeys, mountFirstKey, openDecode, hasNew: () => attentionIds(list(), A()).some(id => !seen.has(id)),
    dispose() { council = null; off(); for (const id of timers) clearTimeout(id); timers.clear(); dot?.remove(); dot = null; dialog?.close?.(); dialog?.remove(); dialog = null; host = null; },
  };
}
