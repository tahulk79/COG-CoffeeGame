// V3 HUD (DOM only): minimal top HUD, bottom toolbar, contextual action bar, sheets, placement controls,
// confirm modal, Teacher dialogue, toasts and the tutorial overlay. API per docs/design/v3-architecture.md §HUD API.
import '../../ui/styles/v3.css';
import { CROP_ORDER, DRINK_ORDER, autoPrice } from '../../core/config/economy.js';
import { cropUnlocked, drinkUnlocked, region, bothGames } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, errorText, clock } from './text.js';
import { createTopBar } from './top-bar.js';
import { createToolbar, seenKey } from './toolbar.js';
import { createActionBar } from './action-bar.js';
import { createSheetHost } from './sheet.js';
import { buildSheet, seedsSheet, menuSheet, staffSheet, progressSheet, drinkSeenKey, buyAuto, beansSheet } from './sheets.js';
import { createPlacementBar } from './placement.js';
import { createModals } from './modal.js';
import { createFeedback } from './feedback.js';
import { createTutorial } from './tutorial.js';
import { createDevPanel } from './dev-panel.js';

export { errorText };

// Purchases started from the HUD get a small "buy" chime on success.
const PURCHASE = /^(shop\/buyBeans|build\/upgrade|land\/|staff\/hire|round\/unlock|rebirth\/perform|world\/unlockRegion|staff\/resume)/;

/**
 * @param {{ store: object, realm?: object, dev?: boolean, onOpenAtlas?: () => void, onOpenSettings?: () => void }} opts
 */
export function createHud({ store, realm = null, dev = false, onOpenAtlas, onOpenSettings } = {}) {
  document.getElementById('hud-root')?.remove(); // a stale root from a previous run (HMR / restart)
  const root = h('div', { id: 'hud-root' });
  const ctx = { store, realm, dev, root, onOpenAtlas, onOpenSettings, selection: null };

  ctx.isPlaying = () => store.state.story.phase === 'play' && !!store.state.world.currentRegion;
  // Auto play: the game plays itself; the player may look around (camera, info sheets) but every action is blocked.
  ctx.isAuto = () => { const a = store.state.autoplay?.active; return !!a && Date.now() < a.endsAt; };
  const AUTO_OK = new Set(['auto/stop', 'auto/start', 'auto/buy', 'story/seen']);
  ctx.blockedByAuto = () => { if (!ctx.isAuto()) return false; feedback.toast(T('hud.auto.blocked'), 'info'); sfx('ui.deny'); return true; };
  ctx.act = (type, payload = {}, opts = {}) => {
    if (!AUTO_OK.has(type) && ctx.blockedByAuto()) return { ok: false, error: 'auto' };
    const result = store.dispatch(type, payload, opts);
    if (!result.ok) { feedback.toast(errorText(result), 'bad'); sfx('ui.deny'); }
    else if (!result.noop && !result.duplicate && PURCHASE.test(type)) sfx('ui.buy');
    return result;
  };
  ctx.toast = (text, tone) => feedback.toast(text, tone);
  ctx.confirm = opts => modals.confirm(opts);
  ctx.clearSelection = () => { ctx.realm?.select?.(null); setSelection(null); };
  ctx.onSheetClosed = () => { delete root.dataset.sheet; tutorial.refresh(); };
  // Farm ⇄ Café: only once both games are open (Round 2). The realm shows one area at a time.
  ctx.switchView = () => {
    const realm = ctx.realm;
    if (!realm?.setView || realm.switching || !bothGames(store.state)) return;
    sheet.close();
    if (ctx.selection) ctx.clearSelection();
    sfx('ui.open');
    Promise.resolve(realm.setView(realm.view === 'cafe' ? 'farm' : 'cafe')).then(() => tutorial.refresh(), () => {});
  };

  const progressRender = progressSheet(ctx); // keeps its "pending" flags across re-renders
  ctx.onTool = id => {
    if (id === 'world') { if (ctx.blockedByAuto()) return; sheet.close(); ctx.onOpenAtlas?.(); return; }
    // Storage: the storehouse's own card (capacity + upgrade), with the camera on the building.
    if (id === 'storage' && ctx.realm?.view === 'cafe') id = 'beans'; // café: the bean pill opens the supplier
    if (id === 'storage') {
      sheet.close();
      const silo = region(store.state)?.buildings.find(b => b.type === 'silo');
      if (!silo) return;
      sfx('ui.open');
      const target = { kind: 'building', uid: silo.uid, type: 'silo', upgrade: true };
      if (ctx.realm?.select) Promise.resolve(ctx.realm.select(target)).catch(() => {}); // the realm reports it back via onSelect
      else setSelection(target);
      return;
    }
    if (sheet.openId === id) { sheet.close(); return; }
    sfx('ui.open');
    const s = store.state;
    if (id === 'seeds') { // opening the picker clears the "new crop" dot
      for (const crop of CROP_ORDER) if (cropUnlocked(s, crop) && !s.story.seen?.[seenKey(crop)]) store.dispatch('story/seen', { key: seenKey(crop) });
    }
    if (id === 'menu') { // same for new drinks
      for (const drink of DRINK_ORDER) if (drinkUnlocked(s, drink) && !s.story.seen?.[drinkSeenKey(drink)]) store.dispatch('story/seen', { key: drinkSeenKey(drink) });
    }
    const render = { beans: () => beansSheet(ctx), build: () => buildSheet(ctx), seeds: () => seedsSheet(ctx), menu: () => menuSheet(ctx), staff: () => staffSheet(ctx), progress: () => progressRender }[id];
    if (!render) return;
    if (ctx.selection) ctx.clearSelection();
    root.dataset.sheet = id;
    sheet.open(id, T(id === 'staff' && ctx.realm?.view === 'cafe' ? 'hud.sheet.staffCafe' : `hud.sheet.${id}`), render());
    tutorial.refresh();
  };

  const top = createTopBar(ctx);
  const toolbar = createToolbar(ctx);
  const actionBar = createActionBar(ctx);
  const sheet = createSheetHost(ctx);
  const placement = createPlacementBar(ctx);
  const modals = createModals(ctx);
  const feedback = createFeedback(ctx);
  Object.assign(ctx, { top, toolbar, actionBar, sheet, placement, modals });
  const tutorial = createTutorial(ctx);
  const devPanel = dev ? createDevPanel(ctx) : null;

  // ---------- auto play: "▶ Auto ×N" button (top-right, under the gear) + banner with time left and Stop ----------
  const autoBtn = h('button', { type: 'button', class: 'hud-auto-btn', hidden: true, attrs: { 'aria-label': T('hud.auto.aria') },
    on: { click: () => {
      sfx('ui.open');
      if ((store.state.autoplay?.runs || 0) <= 0) { buyAuto(ctx); return; } // no runs: buy one with coins (confirm card)
      const r = ctx.act('auto/start'); if (r.ok && !r.noop) ctx.toast(T('hud.toast.autoStart'), 'good');
    } } });
  // Compact one-row bar while auto plays: "🤖 AUTO · 2:31" chip (time left) + "⏹ Stop".
  const autoChip = h('strong', { class: 'hud-autobar-chip' });
  const autoStop = h('button', { type: 'button', class: 'hud-autobar-stop', on: { click: () => stopAuto('user') } }, T('hud.auto.stop'));
  const autoBar = h('section', { class: 'hud-autobar', hidden: true, attrs: { role: 'status', 'aria-label': T('hud.auto.aria') } }, autoChip, autoStop);
  let autoSecs = -1;
  let autoSig = '';
  function stopAuto(reason) {
    if (!store.state.autoplay?.active) return;
    const r = store.dispatch('auto/stop', { reason });
    if (r.ok && !r.noop) ctx.toast(T(reason === 'timeout' ? 'hud.toast.autoEnd' : 'hud.toast.autoStopped'), reason === 'timeout' ? 'good' : 'info');
  }
  function updateAuto() {
    const s = store.state, a = s.autoplay?.active, now = Date.now();
    if (a && now >= a.endsAt) stopAuto('timeout'); // time out (also right after a reload with an expired run)
    const on = !!s.autoplay?.active && ctx.isPlaying();
    const runs = s.autoplay?.runs || 0, price = autoPrice(s.autoplay?.bought || 0);
    const sig = `${on}|${runs}|${price}|${ctx.isPlaying()}`;
    if (sig !== autoSig) {
      autoSig = sig;
      autoBar.hidden = !on;
      autoBtn.hidden = on || !ctx.isPlaying();
      autoBtn.textContent = runs > 0 ? T('hud.auto.button', { n: runs }) : T('hud.auto.buy', { price });
      autoBtn.classList.toggle('is-buy', runs <= 0);
      if (on) { root.dataset.auto = '1'; sheet.close(); } else delete root.dataset.auto;
    }
    if (on) {
      const secs = Math.max(0, Math.ceil((a.endsAt - now) / 1000));
      if (secs !== autoSecs) { autoSecs = secs; autoChip.textContent = T('hud.auto.chip', { time: clock(secs * 1000) }); }
    }
  }

  // ---------- first game: farm or café (asked once, both can be picked; Round 2 opens the other one) ----------
  let choosing = false;
  function updateFirstGame() {
    const s = store.state;
    if (choosing || s.firstGame || !ctx.isPlaying() || modals.open || ctx.isAuto()) return;
    choosing = true;
    sheet.close();
    modals.choose({
      title: T('hud.mode.title'), note: T('hud.mode.note'),
      options: [
        { id: 'farm', icon: '🌱', title: T('hud.mode.farm'), body: T('hud.mode.farmInfo') },
        { id: 'cafe', icon: '☕', title: T('hud.mode.cafe'), body: T('hud.mode.cafeInfo') },
      ],
    }).then(game => {
      choosing = false;
      if (game !== 'farm' && game !== 'cafe') return; // closed by something else: asked again next frame
      sfx('ui.open');
      store.dispatch('play/chooseGame', { game });
      Promise.resolve(ctx.realm?.setView?.(game)).then(() => tutorial.refresh(), () => {});
    });
  }

  // Farm ⇄ Café switch (floating, above the toolbar's left side): shown once both games are open.
  const switchIco = h('span', { class: 'hud-switch-ico', attrs: { 'aria-hidden': 'true' } });
  const switchLabel = h('span', { class: 'hud-switch-label' });
  const switchBtn = h('button', { type: 'button', id: 'hud-btn-switch', class: 'hud-switch', hidden: true, dataset: { hudId: 'switch' },
    on: { click: () => ctx.switchView() } }, switchIco, switchLabel);
  let switchSig = '';
  function updateSwitch() {
    const both = bothGames(store.state) && ctx.isPlaying();
    const toCafe = ctx.realm?.view !== 'cafe';
    const sig = `${both}|${toCafe}`;
    if (sig === switchSig) return;
    switchSig = sig;
    switchBtn.hidden = !both;
    switchIco.textContent = toCafe ? '☕' : '🌱';
    switchLabel.textContent = T(toCafe ? 'hud.view.cafe' : 'hud.view.farm');
    switchBtn.setAttribute('aria-label', T(toCafe ? 'hud.view.toCafe' : 'hud.view.toFarm'));
  }

  // Screen-reader summary of the object notices the realm shows at objects (▲ upgrade, ! order, + brew…).
  const notices = h('p', { class: 'hud-sr', attrs: { 'aria-live': 'polite', 'aria-label': T('hud.notices') } });
  let noticeSig = '', noticeClock = 0;
  function updateNotices(dt) {
    noticeClock += dt;
    if (noticeClock < .5) return;
    noticeClock = 0;
    const list = ctx.realm?.notices || [];
    const sig = list.map(n => `${n.key}:${n.kind}:${n.up || 0}`).join('|');
    if (sig === noticeSig) return;
    noticeSig = sig;
    const name = n => (n.target?.type ? T(`building.${n.target.type}`) : '');
    const lines = list.flatMap(n => [T(`hud.notice.${n.kind}`, { name: name(n), id: n.target?.id || '' }), ...(n.up && n.kind !== 'up' && n.kind !== 'upMuted' ? [T(n.up === 'ok' ? 'hud.notice.up' : 'hud.notice.upMuted', { name: name(n) })] : [])]);
    notices.textContent = lines.join('. ');
  }

  root.append(...[top.el, autoBtn, autoBar, actionBar.el, switchBtn, toolbar.el, placement.el, sheet.el, tutorial.el, feedback.el, modals.el, notices, devPanel?.el].filter(Boolean)); // no dev panel → nothing (not the text "undefined")
  document.body.append(root);

  function renderAll(s) {
    root.dataset.phase = s.story.phase;
    top.render(s);
    toolbar.render(s);
    actionBar.render(s, ctx.selection);
    sheet.rerender();
  }
  const unsubscribe = store.subscribe((s, events) => {
    renderAll(s);
    feedback.onEvents(s, events);
    tutorial.refresh();
  });
  renderAll(store.state);

  function setSelection(target) {
    ctx.selection = target || null;
    if (target) root.dataset.selection = target.type || target.kind; else delete root.dataset.selection;
    actionBar.render(store.state, ctx.selection);
    tutorial.refresh();
  }

  const onKeyDown = e => {
    if (e.key === 'Escape' && sheet.openId && !modals.open) { e.preventDefault(); sheet.close(); }
  };
  document.addEventListener('keydown', onKeyDown);

  return {
    el: root,
    setSelection,
    toast: (text, tone = 'info') => feedback.toast(text, tone),
    confirm: opts => modals.confirm(opts),
    dialogue: lines => modals.dialogue(lines),
    update(dt = 0) {
      top.update(dt);
      toolbar.update(dt);
      actionBar.update(dt);
      placement.update(dt);
      updateAuto();
      updateFirstGame();
      updateSwitch();
      tutorial.update(dt);
      updateNotices(dt);
    },
    dispose() {
      unsubscribe();
      document.removeEventListener('keydown', onKeyDown);
      ctx.realm?.setTutorialTarget?.(null);
      for (const part of [tutorial, modals, feedback, sheet, placement, actionBar, toolbar, top, devPanel]) part?.dispose();
      root.remove();
    },
  };
}
