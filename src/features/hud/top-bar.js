// Top HUD: level badge with XP ring + name (top-left), coin pill, bean pill (= the storehouse: tap it), gear (top-right).
// 🚂 next to the gear opens the Rounds roadmap (Round 1 now, 2–3 locked); 💰 under the gear opens the loan packs.
import { levelProgress, capacity, stored, region } from '../../core/derive.js';
import { farmHasGoods } from './toolbar.js';
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
  const beansIco = h('span', { class: 'hud-pill-ico', attrs: { 'aria-hidden': 'true' } }, '🫘');
  const beans = h('button', { id: 'hud-beans', class: 'hud-pill hud-pill--bean', type: 'button', attrs: { 'aria-label': T('hud.storage.open') },
    on: { click: () => ctx.onTool?.('storage') } }, beansIco, beansVal, beansCap, beansTag);
  // Rounds roadmap (🚂): Round 1 now, Rounds 2–3 locked.
  const roundNum = h('span', { class: 'hud-roundmap-num' });
  const roundBtn = h('button', { id: 'hud-btn-rounds', class: 'hud-roundmap', type: 'button', attrs: { 'aria-label': T('hud.rounds.open') },
    on: { click: () => ctx.onTool?.('rounds') } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '🚂'), roundNum);
  // Loan (💰): a glowing money bag under the gear → loan packs sheet.
  const loanBtn = h('button', { id: 'hud-btn-loan', class: 'hud-loan-btn', type: 'button', attrs: { 'aria-label': T('hud.loan.openBtn') },
    on: { click: () => ctx.onTool?.('loan') } }, h('span', { class: 'hud-loan-bag', attrs: { 'aria-hidden': 'true' } }, '💰'), h('span', { class: 'hud-loan-label' }, T('hud.loan.btn')));
  const gear = h('button', { class: 'hud-gear', type: 'button', attrs: { 'aria-label': T('hud.settings') }, on: { click: () => ctx.onOpenSettings?.() } }, '⚙️');

  const el = h('div', { class: 'hud-top' },
    h('div', { class: 'hud-top-left' },
      h('div', { class: 'hud-player' }, badge, h('div', { class: 'hud-player-text' }, name, xpBar)),
      h('div', { class: 'hud-pills' }, coins, beans)),
    h('div', { class: 'hud-top-right' }, roundBtn, h('div', { class: 'hud-gear-col' }, gear, loanBtn)));

  const coinCounter = counter(coinsVal), beanCounter = counter(beansVal);
  let last = {};

  function render(s) {
    const lp = levelProgress(s);
    const cap = capacity(s);
    // Farm: every good shares the storehouse (D.stored / D.capacity); café: the beans it brews with.
    const farm = ctx.realm?.view !== 'cafe';
    const used = farm && region(s) ? stored(s) : Math.floor(s.inventory.beans);
    const goods = farm && farmHasGoods(s);
    const next = { level: lp.level, ratio: Math.round(lp.ratio * 100), name: s.character?.name || '', cap, full: cap > 0 && used >= cap, round: s.player.round, credits: s.rebirth.credits, goods };
    if (next.level !== last.level) { setText(levelNum, String(lp.level)); if (last.level) bump(badge, 1.25); }
    if (next.level !== last.level || next.ratio !== last.ratio) {
      xpFill.style.setProperty('--p', String(lp.ratio));
      badge.setAttribute('aria-label', T('hud.levelAria', { level: lp.level, xp: fmt(lp.xp - lp.from), need: fmt(lp.to - lp.from) }));
    }
    setText(name, next.name || T('hud.farmer'));
    setText(roundNum, T('hud.rounds.badge', { round: next.round }));
    loanBtn.hidden = s.story.phase !== 'play';
    loanBtn.classList.toggle('is-debt', !!(s.loan && s.loan.owed > 0));
    setText(beansCap, cap ? `/${fmt(cap)}` : '');
    if (next.full !== last.full) {
      beans.classList.toggle('is-full', next.full);
      // Full: long CTA "Đầy · Nâng cấp" + short "Đầy" — CSS shows the short one on narrow phones so the pill stays compact.
      if (next.full) beansTag.replaceChildren(h('span', { class: 'hud-pill-tag-long' }, T('hud.storage.tagFull')), h('span', { class: 'hud-pill-tag-short' }, T('hud.storage.tagFullShort')));
      else setText(beansTag, T('hud.storage.tag'));
    }
    coinCounter.set(s.player.coins);
    if (next.goods !== last.goods) setText(beansIco, next.goods ? '📦' : '🫘');
    beanCounter.set(used);
    last = next;
  }
  function update(dt) { coinCounter.update(dt); beanCounter.update(dt); }
  return { el, render, update, coinsEl: coins, beansEl: beans, dispose() {} };
}
