// Top HUD: level badge with XP ring + name (top-left), coin pill, bean pill (= the storehouse: tap it), gear (top-right).
// Round and rebirth-credit chips were removed (founder: confusing); credits live in the Progress sheet.
import { levelProgress, capacity } from '../../core/derive.js';
import { h, setText, bump } from './dom.js';
import { T, fmt } from './text.js';

// Animated number: eases the shown value towards the target; writes the DOM only when the rounded value changes.
function counter(el, format = fmt) {
  return { el, shown: null, target: 0, text: '', format,
    set(value) {
      if (this.shown === null) this.shown = value;
      else if (value > this.target) bump(this.el.parentElement, 1.1);
      this.target = value;
    },
    update(dt) {
      if (this.shown === null) return;
      const diff = this.target - this.shown;
      this.shown = Math.abs(diff) < .5 ? this.target : this.shown + diff * Math.min(1, dt * 9);
      const text = this.format(this.shown);
      if (text !== this.text) { this.text = text; this.el.textContent = text; }
    } };
}

export function createTopBar(ctx) {
  const levelNum = h('span', { class: 'hud-level-num' });
  const badge = h('div', { class: 'hud-level', attrs: { role: 'img' } }, h('span', { class: 'hud-level-hex' }, levelNum));
  const name = h('span', { class: 'hud-name' });
  const xpFill = h('span', { class: 'hud-xp-fill' });
  const xpBar = h('span', { class: 'hud-xp' }, xpFill);
  const coinsVal = h('span', { class: 'hud-pill-val' });
  const coins = h('div', { id: 'hud-coins', class: 'hud-pill hud-pill--coin' }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), coinsVal);
  const beansVal = h('span', { class: 'hud-pill-val' });
  const beansCap = h('span', { class: 'hud-pill-cap' });
  const beansTag = h('span', { class: 'hud-pill-tag' }, T('hud.storage.tag'));
  const beans = h('button', { id: 'hud-beans', class: 'hud-pill hud-pill--bean', type: 'button', attrs: { 'aria-label': T('hud.storage.open') },
    on: { click: () => ctx.onTool?.('storage') } }, h('span', { class: 'hud-pill-ico', attrs: { 'aria-hidden': 'true' } }, '🫘'), beansVal, beansCap, beansTag);
  const gear = h('button', { class: 'hud-gear', type: 'button', attrs: { 'aria-label': T('hud.settings') }, on: { click: () => ctx.onOpenSettings?.() } }, '⚙️');

  const el = h('div', { class: 'hud-top' },
    h('div', { class: 'hud-top-left' },
      h('div', { class: 'hud-player' }, badge, h('div', { class: 'hud-player-text' }, name, xpBar)),
      h('div', { class: 'hud-pills' }, coins, beans)),
    gear);

  const coinCounter = counter(coinsVal), beanCounter = counter(beansVal);
  let last = {};

  function render(s) {
    const lp = levelProgress(s);
    const cap = capacity(s);
    const next = { level: lp.level, ratio: Math.round(lp.ratio * 100), name: s.character?.name || '', cap, full: cap > 0 && s.inventory.beans >= cap, round: s.player.round, credits: s.rebirth.credits };
    if (next.level !== last.level) { setText(levelNum, String(lp.level)); if (last.level) bump(badge, 1.25); }
    if (next.level !== last.level || next.ratio !== last.ratio) {
      xpFill.style.setProperty('--p', String(lp.ratio));
      badge.setAttribute('aria-label', T('hud.levelAria', { level: lp.level, xp: fmt(lp.xp - lp.from), need: fmt(lp.to - lp.from) }));
    }
    setText(name, next.name || T('hud.farmer'));
    setText(beansCap, cap ? `/${fmt(cap)}` : '');
    if (next.full !== last.full) { beans.classList.toggle('is-full', next.full); setText(beansTag, T(next.full ? 'hud.storage.tagFull' : 'hud.storage.tag')); }
    coinCounter.set(s.player.coins);
    beanCounter.set(s.inventory.beans);
    last = next;
  }
  function update(dt) { coinCounter.update(dt); beanCounter.update(dt); }
  return { el, render, update, coinsEl: coins, beansEl: beans, dispose() {} };
}
