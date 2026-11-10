// Small centered confirm card, the farm/café choice, the level gift box / surprise chest and the Teacher dialogue overlay.
import { h } from './dom.js';
import { T } from './text.js';
import { coinAmount } from './widgets.js';
import { mascot } from './mascot.js';
import { modelIcon } from './model-icons.js';

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
  function confirm({ title = '', body = '', cost, costLabel, confirmLabel, cancelLabel, danger = false, art = null } = {}) {
    const cancel = h('button', { type: 'button', class: 'hud-btn hud-btn--plain', on: { click: () => active?.close(false) } }, h('span', { class: 'hud-btn-main' }, cancelLabel || T('hud.cancel')));
    const ok = h('button', { type: 'button', class: `hud-btn ${danger ? 'hud-btn--danger' : 'hud-btn--go'}`, on: { click: () => active?.close(true) } }, h('span', { class: 'hud-btn-main' }, confirmLabel || T('hud.confirm')));
    const hero = art ? h('div', { class: 'ui-hero', attrs: { 'aria-hidden': 'true' } }) : null;
    if (art) modelIcon(art).then(url => { if (!url) return; hero.append(Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false })); });
    const costLine = cost != null ? h('p', { class: 'hud-confirm-cost' }, T('hud.costLine'), ' ', coinAmount(cost)) : costLabel ? h('p', { class: 'hud-confirm-cost' }, costLabel) : null;
    const card = h('div', { class: `hud-confirm${art ? ' has-art' : ''}`, attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'hud-confirm-title', 'aria-describedby': 'hud-confirm-body' } },
      h('h2', { id: 'hud-confirm-title' }, title), hero, body ? h('p', { id: 'hud-confirm-body' }, body) : null, costLine, h('div', { class: 'hud-confirm-actions' }, cancel, ok));
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

  /**
   * Pick one of a few big options (the farm / café game choice). No cancel: Escape does nothing.
   * options: [{ id, icon, title, body }] → Promise<id>
   */
  function choose({ title = '', note = '', options = [] } = {}) {
    const buttons = options.map(o => h('button', { type: 'button', class: 'hud-choice', dataset: { hudId: `choice-${o.id}` }, on: { click: () => active?.close(o.id) } },
      h('span', { class: 'hud-choice-ico', attrs: { 'aria-hidden': 'true' } }, o.icon),
      h('span', { class: 'hud-choice-text' }, h('strong', null, o.title), h('span', null, o.body))));
    const card = h('div', { class: 'hud-confirm hud-confirm--choice', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hud-choice-title' } },
      h('h2', { id: 'hud-choice-title' }, title), h('div', { class: 'hud-choices' }, buttons), note ? h('p', { class: 'hud-hint' }, note) : null);
    const promise = open(h('div', { class: 'hud-modal' }, h('div', { class: 'hud-scrim' }), card), e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const i = buttons.indexOf(document.activeElement);
        buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    });
    buttons[0]?.focus({ preventScroll: true });
    return promise;
  }

  /** Teacher speech overlay. lines: string | {text, speaker}. Tap / Enter / Space advances. */
  function dialogue(lines = []) {
    const list = (Array.isArray(lines) ? lines : [lines]).map(l => (typeof l === 'string' ? { text: l } : l)).filter(l => l && l.text);
    if (!list.length) return Promise.resolve();
    let i = 0;
    const speaker = h('strong', { class: 'hud-talk-name' });
    const text = h('p', { class: 'hud-talk-text', attrs: { 'aria-live': 'polite' } });
    const more = h('span', { class: 'hud-talk-more', attrs: { 'aria-hidden': 'true' } }, '﹀');
    const bubble = h('button', { type: 'button', class: 'hud-talk-bubble', on: { click: () => next() } }, speaker, text, more);
    const avatar = h('div', { class: 'hud-talk-avatar', attrs: { 'aria-hidden': 'true' } });
    const node = h('div', { class: 'hud-talk', on: { click: e => { if (e.target === node) next(); } } }, avatar, bubble);
    let done;
    const show = () => {
      speaker.textContent = list[i].speaker || T('hud.teacher');
      avatar.replaceChildren(list[i].avatar || mascot()); // a line may come from someone else (e.g. the evolved robot)
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

  /**
   * Level gift: a closed gift box (or a surprise chest on chest levels). Tap "Open" → onOpen() claims it and returns
   * { items, prize } → the box opens and shows what was inside → "Collect" closes. Resolves true once collected.
   */
  const ITEM_ICON = { coins: '🪙', beans: '🫘', hireTicket: '🎟️', autoRun: '🤖' };
  function gift({ level, chest = false, onOpen, autoOpen = false } = {}) {
    const box = h('div', { class: `hud-gift-box${chest ? ' is-chest' : ''}`, attrs: { 'aria-hidden': 'true' } },
      h('span', { class: 'hud-gift-glow' }), h('span', { class: 'hud-gift-lid' }), h('span', { class: 'hud-gift-base' }), h('span', { class: 'hud-gift-ribbon' }));
    const title = h('h2', { id: 'hud-gift-title' }, T(chest ? 'hud.gift.chestTitle' : 'hud.gift.title', { level }));
    const sub = h('p', { class: 'hud-gift-sub' }, T(chest ? 'hud.gift.chestSub' : 'hud.gift.sub'));
    const list = h('ul', { class: 'hud-gift-items', hidden: true });
    const btn = h('button', { type: 'button', class: 'hud-btn hud-btn--gold hud-gift-btn' }, h('span', { class: 'hud-btn-main' }, T(chest ? 'hud.gift.openChest' : 'hud.gift.open')));
    const card = h('div', { class: `hud-confirm hud-gift${chest ? ' hud-gift--chest' : ''}`, attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hud-gift-title' } },
      title, sub, box, list, btn);
    let opened = false;
    btn.addEventListener('click', () => {
      if (opened) { active?.close(true); return; }
      const got = onOpen?.();
      if (!got) { active?.close(false); return; }
      opened = true;
      card.classList.add('is-open');
      if (got.prize) sub.textContent = T(`hud.gift.prize.${got.prize}`);
      else sub.textContent = T('hud.gift.inside');
      list.replaceChildren(...got.items.map((it, i) => h('li', { class: 'hud-gift-item', attrs: { style: `--i:${i}` } },
        it.kind === 'coins' ? null : h('span', { class: 'hud-gift-item-ico', attrs: { 'aria-hidden': 'true' } }, ITEM_ICON[it.kind] || '🎁'), // coins: the money formatter already draws the coin beside the number
        h('strong', null, T(`hud.gift.item.${it.kind}`, { n: it.amount })))));
      list.hidden = false;
      btn.firstChild.textContent = T('hud.gift.collect');
    });
    const promise = open(h('div', { class: 'hud-modal' }, h('div', { class: 'hud-scrim' }), card), e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    });
    btn.focus({ preventScroll: true });
    if (autoOpen) btn.click(); // the box was already tapped in the gift list
    return promise;
  }

  return { el: layer, confirm, choose, gift, dialogue, get open() { return !!active; }, dispose() { active?.close(false); layer.remove(); } };
}
