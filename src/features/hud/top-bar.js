// Top HUD: level badge with XP ring + name (top-left), coin pill, bean pill (= the storehouse: tap it), gear (top-right).
// 🚂 next to the gear opens the Rounds roadmap (Round 1 now, 2–3 locked); 💰 under the gear opens the loan packs.
import { BUILD_MENU_FARM } from '../../core/config/economy.js';
import { countOf, buildError, levelProgress, capacity, stored, region, loanOf, tasksOpen, pendingGifts, upgradeError } from '../../core/derive.js';
import { EXPIRY_LEVEL, EXPIRY_ENABLED, GM, BUILDINGS } from '../../core/config/economy.js';

/** Buildings of the current region the player can upgrade right now (land-ui-simplify §4: the HUD ⬆ counter). */
// Only the game being played: the farm lists farm buildings, the café lists café ones (never both)
export const inThisGame = (b, view) => { const z = BUILDINGS[b.type]?.zone; return view === 'cafe' ? z !== 'farm' : z !== 'shop'; };
// Farm buildings you have not built yet (the sheet offers them with a Build button): workshops / storage only, no decor
export const buildableNew = (s, view = 'farm') => (view === 'cafe' ? [] : BUILD_MENU_FARM.filter(type => !BUILDINGS[type]?.decor && countOf(s, type) === 0 && ['coins', null].includes(buildError(s, type))));
// Everything that can still be upgraded (affordable or not): what the ⬆ sheet lists
export const upgradableBuildings = (s, view = 'farm') => (region(s)?.buildings || []).filter(b => !BUILDINGS[b.type]?.decor && inThisGame(b, view) && ['coins', null].includes(upgradeError(s, b)));
export const affordableUpgrades = (s, view = 'farm') => (region(s)?.buildings || []).filter(b => !BUILDINGS[b.type]?.decor && inThisGame(b, view) && upgradeError(s, b) === null);
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
  // tapping the coins opens the loan sheet, like the loan action (founder 2026-11-08)
  const coins = h('button', { id: 'hud-coins', class: 'hud-pill hud-pill--coin', type: 'button', attrs: { 'aria-label': T('hud.loan.openBtn') }, on: { click: () => ctx.onTool?.('loan') } }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), coinsVal);
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
  // Heads-up for the Level-10 incident (until it has happened): a small chip under the badge, louder from 3 levels
  // before. Tap → the Rounds sheet, which says what happens at Level 10.
  const lv10 = h('button', { id: 'hud-lv10', class: 'hud-lv10', type: 'button', attrs: { 'aria-label': T('hud.lv10.aria', { level: EXPIRY_LEVEL }) },
    on: { click: () => ctx.onTool?.('rounds') } });
  // Inbox «Duyệt (n)» in the manager's colour (management-rules §4.1 / §6): shown while any task waits for you.
  const giftNum = h('span', { class: 'hud-roundmap-num' });
  const giftBtn = h('button', { id: 'hud-btn-gifts', class: 'hud-roundmap', type: 'button', hidden: true, attrs: { 'aria-label': T('hud.sheet.gifts') },
    on: { click: () => ctx.onTool?.('gifts') } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '🎁'), giftNum);
  const inboxNum = h('span', { class: 'hud-roundmap-num' });
  const inboxBtn = h('button', { id: 'hud-btn-inbox', class: 'hud-roundmap', type: 'button', hidden: true, attrs: { 'aria-label': T('hud.inbox.openAria') },
    on: { click: () => ctx.onTool?.('inbox') } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '📋'), inboxNum);
  // 📒 Nhật ký: the unified history (§5).
  const journalBtn = h('button', { id: 'hud-btn-journal', class: 'hud-roundmap hud-journal-btn', type: 'button', attrs: { 'aria-label': T('hud.hist.openBtn') },
    on: { click: () => ctx.onTool?.('journal') } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '📒'));
  const gear = h('button', { class: 'hud-gear', type: 'button', attrs: { 'aria-label': T('hud.settings') }, on: { click: () => ctx.onOpenSettings?.() } }, '⚙️');
  // land-ui-simplify §4: ⬆ Upgrades (count of what is affordable now) and ⋯ More (journal, rounds, loan) replace three
  // separate round buttons on the right rail. The old buttons live on inside the ⋯ menu (same ids, same handlers).
  const upNum = h('span', { class: 'hud-roundmap-num' });
  const upgradesBtn = h('button', { id: 'hud-btn-upgrades', class: 'hud-roundmap hud-upgrades-btn', type: 'button', attrs: { 'aria-label': T('hud.upgrades') },
    on: { click: () => { // nothing to upgrade → just a notice, no empty sheet
      if (!upgradableBuildings(ctx.store.state, ctx.realm?.view).length && !buildableNew(ctx.store.state, ctx.realm?.view).length) { ctx.toast?.(T('hud.upgrades.none'), 'info'); return; }
      ctx.onTool?.('upgrades'); } } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '⬆️'), upNum);
  // 🌍 World map (founder 2026-11-08): replaces the World Gate on the map — one tap opens the atlas.
  const worldBtn = h('button', { id: 'hud-btn-worldmap', class: 'hud-roundmap hud-world-btn', type: 'button', attrs: { 'aria-label': T('hud.worldMap') },
    on: { click: () => { morePop.hidden = true; ctx.onTool?.('world'); } } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '🌍'));
  // 🧭 Rotate the view: a quarter turn per tap, so every side of the farm can be looked at (four directions)
  const rotateBtn = h('button', { id: 'hud-btn-rotate', class: 'hud-roundmap hud-rotate-btn', type: 'button', attrs: { 'aria-label': T('hud.rotate') },
    on: { click: () => ctx.realm?.rotateView?.(1) } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '🧭'));
  const moreDot = h('span', { class: 'hud-dot', hidden: true, attrs: { 'aria-hidden': 'true' } });
  const morePop = h('div', { class: 'hud-more-pop', hidden: true, attrs: { role: 'menu' } }, journalBtn, roundBtn, loanBtn);
  const moreBtn = h('button', { id: 'hud-btn-more', class: 'hud-roundmap hud-more-btn', type: 'button', attrs: { 'aria-label': T('hud.more'), 'aria-haspopup': 'menu' },
    on: { click: () => { morePop.hidden = !morePop.hidden; } } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '⋯'), moreDot);
  morePop.addEventListener('click', e => { if (e.target.closest('button')) morePop.hidden = true; });

  // Layout (founder 2026-11-08, standard mobile-game HUD): top-left = player + coins + storehouse (+ the Lv-10 chip);
  // top-right = ⚙ in the corner, then ONE rail of same-size round buttons: 🌍 world · ⬆ upgrades · 📋 inbox · ▶ auto · ⋯ more.
  const el = h('div', { class: 'hud-top' },
    h('div', { class: 'hud-top-left' },
      h('div', { class: 'hud-player', attrs: { role: 'button' }, on: { click: () => ctx.realm?.focusAvatar?.() } }, badge, h('div', { class: 'hud-player-text' }, name, xpBar)),
      h('div', { class: 'hud-pills' }, coins, beans), lv10),
    h('div', { class: 'hud-top-right' }, h('div', { class: 'hud-gear-col' }, gear), loanBtn, worldBtn, upgradesBtn, rotateBtn, giftBtn, inboxBtn)); // right rail, top to bottom: settings · loan · map · upgrades · compass // the ⋯ menu is gone: journal and rounds removed, the loan button sits straight in the rail

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
    const left = EXPIRY_LEVEL - lp.level, warn = EXPIRY_ENABLED && !s.story.level10Done && s.story.phase === 'play' && left > 0;
    lv10.hidden = !warn;
    if (warn) { lv10.classList.toggle('is-soon', left <= 3); setText(lv10, left <= 3 ? T('hud.lv10.soon', { n: left, level: EXPIRY_LEVEL }) : T('hud.lv10.chip', { level: EXPIRY_LEVEL })); }
    setText(roundNum, T('hud.rounds.badge', { round: next.round }));
    loanBtn.hidden = s.story.phase !== 'play';
    journalBtn.hidden = s.story.phase !== 'play';
    const waiting = s.story.phase === 'play' ? tasksOpen(s).length : 0;
    inboxBtn.hidden = !waiting;
    const gifts = s.story.phase === 'play' && region(s) ? pendingGifts(s).length : 0;
    giftBtn.hidden = !gifts;
    if (gifts) setText(giftNum, T('hud.gifts.btn', { n: gifts }));
    if (waiting) setText(inboxNum, T('hud.inbox.btn', { n: waiting }));
    // red while a task has < GM.look.ringLifeShare of its life left (the red ring under the manager in the world)
    const P = s.clock?.played || 0;
    inboxBtn.classList.toggle('is-urgent', waiting > 0 && tasksOpen(s).some(t => t.untilPlayed - P < (t.untilPlayed - t.atPlayed) * GM.look.ringLifeShare));
    const debt = loanOf(s);
    loanBtn.classList.toggle('is-debt', !!debt);
    loanBtn.classList.toggle('is-late', !!debt?.late);
    moreDot.hidden = !debt?.late;
    // The badge counts what the sheet lists as doable now: affordable upgrades + (farm) workshops not built yet that you can pay —
    // it said 0 while the sheet offered 5 workshops "đủ tiền nâng ngay".
    const newBuilds = ctx.realm?.view === 'cafe' ? 0 : BUILD_MENU_FARM.filter(type => !BUILDINGS[type]?.decor && countOf(s, type) === 0 && buildError(s, type) === null).length;
    const ups = s.story.phase === 'play' ? affordableUpgrades(s, ctx.realm?.view).length + newBuilds : 0;
    upgradesBtn.hidden = s.story.phase !== 'play';
    worldBtn.hidden = s.story.phase !== 'play';
    upgradesBtn.classList.toggle('is-ready', ups > 0);
    setText(upNum, String(ups));
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
