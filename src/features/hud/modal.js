// Small centered confirm card (Round/Country unlock, Rebirth only) and the Teacher dialogue overlay.
import { h } from './dom.js';
import { T } from './text.js';
import { coinAmount } from './widgets.js';

export function createModals(ctx) {
  const layer = h('div', { class: 'hud-modal-layer', hidden: true });
  let active = null; // { close(value) }

  function open(node, onKey) {
    active?.close(false);
    const restore = document.activeElement;
    layer.replaceChildren(node);
    layer.hidden = false;
    ctx.root.dataset.modal = '1';
    return new Promise(resolve => {
      const keydown = e => onKey(e, value => finish(value));
      document.addEventListener('keydown', keydown, true);
      function finish(value) {
        if (active?.finish !== finish) return;
        active = null;
        document.removeEventListener('keydown', keydown, true);
        layer.hidden = true;
        layer.replaceChildren();
        delete ctx.root.dataset.modal;
        if (restore && restore.isConnected && typeof restore.focus === 'function') restore.focus({ preventScroll: true });
        resolve(value);
      }
      active = { finish, close: finish };
    });
  }

  /** @returns {Promise<boolean>} */
  function confirm({ title = '', body = '', cost, costLabel, confirmLabel } = {}) {
    const cancel = h('button', { type: 'button', class: 'hud-btn hud-btn--plain', on: { click: () => active?.close(false) } }, h('span', { class: 'hud-btn-main' }, T('hud.cancel')));
    const ok = h('button', { type: 'button', class: 'hud-btn hud-btn--go', on: { click: () => active?.close(true) } }, h('span', { class: 'hud-btn-main' }, confirmLabel || T('hud.confirm')));
    const costLine = cost != null ? h('p', { class: 'hud-confirm-cost' }, T('hud.costLine'), ' ', coinAmount(cost)) : costLabel ? h('p', { class: 'hud-confirm-cost' }, costLabel) : null;
    const card = h('div', { class: 'hud-confirm', attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'hud-confirm-title', 'aria-describedby': 'hud-confirm-body' } },
      h('h2', { id: 'hud-confirm-title' }, title), h('p', { id: 'hud-confirm-body' }, body), costLine, h('div', { class: 'hud-confirm-actions' }, cancel, ok));
    const scrim = h('div', { class: 'hud-scrim', on: { click: () => active?.close(false) } });
    const promise = open(h('div', { class: 'hud-modal' }, scrim, card), (e, done) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Tab') { // keep focus inside the two buttons
        e.preventDefault();
        (document.activeElement === ok ? cancel : ok).focus();
      }
    });
    cancel.focus({ preventScroll: true }); // spending actions: the safe button gets focus first
    return promise;
  }

  /** Teacher speech overlay. lines: string | {text, speaker}. Tap / Enter / Space advances. */
  function dialogue(lines = []) {
    const list = (Array.isArray(lines) ? lines : [lines]).map(l => (typeof l === 'string' ? { text: l } : l)).filter(l => l && l.text);
    if (!list.length) return Promise.resolve();
    let i = 0;
    const speaker = h('strong', { class: 'hud-talk-name' });
    const text = h('p', { class: 'hud-talk-text', attrs: { 'aria-live': 'polite' } });
    const more = h('span', { class: 'hud-talk-more', attrs: { 'aria-hidden': 'true' } }, '▼');
    const bubble = h('button', { type: 'button', class: 'hud-talk-bubble', on: { click: () => next() } }, speaker, text, more);
    const node = h('div', { class: 'hud-talk', on: { click: e => { if (e.target === node) next(); } } },
      h('div', { class: 'hud-talk-avatar', attrs: { 'aria-hidden': 'true' } }, '🧙‍♂️'), bubble);
    let done;
    const show = () => {
      speaker.textContent = list[i].speaker || T('hud.teacher');
      text.textContent = list[i].text;
      bubble.setAttribute('aria-label', `${speaker.textContent}: ${list[i].text}. ${T('hud.tapContinue')}`);
    };
    const next = () => { if (++i >= list.length) done?.(undefined); else show(); };
    show();
    const promise = open(node, (e, finish) => {
      done = finish;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(undefined); }
    });
    done = active.finish;
    bubble.focus({ preventScroll: true });
    return promise;
  }

  return { el: layer, confirm, dialogue, get open() { return !!active; }, dispose() { active?.close(false); layer.remove(); } };
}
