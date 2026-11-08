// V3 HUD (DOM only): minimal top HUD, bottom toolbar, contextual action bar, sheets, placement controls,
// confirm modal, Teacher dialogue, toasts and the tutorial overlay. API per docs/design/v3-architecture.md §HUD API.
import '../../ui/styles/v3.css';
import { GM, CROP_ORDER, DRINK_ORDER } from '../../core/config/economy.js';
import { sellAllQuote, cropUnlocked, drinkUnlocked, region, bothGames, regionGame, currentGames, pendingGifts, isChestLevel, tasksOpen } from '../../core/derive.js';
import { openTierModal } from './tier-modal.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, errorText, clock, fmt } from './text.js';
import { createTopBar } from './top-bar.js';
import { createToolbar, seenKey } from './toolbar.js';
import { createFieldPop } from './field-pop.js';
import { createActionBar } from './action-bar.js';
import { createShopStrip } from './shop-strip.js';
import { createSheetHost } from './sheet.js';
import { sellSheet, upgradesSheet, buildSheet, seedsSheet, menuSheet, progressSheet, drinkSeenKey, beansSheet, loanSheet, setBuildTab, supplySheet } from './sheets.js';
import { inboxSheet, journalSheet } from './inbox.js';
import { roundsSheet } from './rounds.js';
import { createStaffModal } from './staff-modal.js';
import { createStaffAlerts } from './staff-alerts.js';
import { giftsSheet } from './gifts.js';
import { createPlacementBar } from './placement.js';
import { createModals } from './modal.js';
import { createFeedback, readableError } from './feedback.js';
import { createTutorial } from './tutorial.js';
import { createDevPanel } from './dev-panel.js';

export { errorText };

// Purchases started from the HUD get a small "buy" chime on success.
const PURCHASE = /^(shop\/buyBeans|shop\/openVenue|build\/upgrade|land\/|staff\/hire|staff\/recruit|staff\/train|staff\/upgradeStat|staff\/upgradePart|staff\/tend|staff\/keep|world\/unlockRegion|staff\/resume)/;

/**
 * @param {{ store: object, realm?: object, dev?: boolean, onOpenAtlas?: () => void, onOpenSettings?: () => void }} opts
 */
let workTimer = 0;
export function createHud({ store, realm = null, dev = false, onOpenAtlas, onOpenSettings } = {}) {
  document.getElementById('hud-root')?.remove(); // a stale root from a previous run (HMR / restart)
  const root = h('div', { id: 'hud-root' });
  const ctx = { store, realm, dev, root, onOpenAtlas, onOpenSettings, selection: null };

  ctx.isPlaying = () => store.state.story.phase === 'play' && !!store.state.world.currentRegion;
  // (auto play is gone: nothing blocks the player's actions any more)
  ctx.isAuto = () => false;
  ctx.blockedByAuto = () => false;
  ctx.act = (type, payload = {}, opts = {}) => {
    const result = store.dispatch(type, payload, opts);
    if (!result.ok) { feedback.toast(readableError(type, payload, result, store.state), 'bad'); sfx('ui.deny'); }
    else if (!result.noop && !result.duplicate && PURCHASE.test(type)) sfx('ui.buy');
    return result;
  };
  ctx.toast = (text, tone) => feedback.toast(text, tone);
  ctx.confirm = opts => modals.confirm(opts);
  ctx.clearSelection = () => { ctx.realm?.select?.(null); setSelection(null); };
  ctx.onSheetClosed = () => { if (!staffModal.isOpen) delete root.dataset.sheet; ctx.buildNear = null; syncPlantHighlight(); tutorial.refresh(); };
  ctx.rerenderSheet = () => { if (sheet.openId) sheet.rerender(); }; // a sheet's own controls (e.g. the test bench) repaint it
  ctx.onStaffClosed = () => { if (!sheet.openId) delete root.dataset.sheet; tutorial.refresh(); };
  // Seeds sheet open → the realm highlights the empty fields (a planting hint); off again when it closes.
  let plantHighlight = false;
  function syncPlantHighlight() {
    const on = sheet.openId === 'seeds';
    if (on === plantHighlight) return;
    plantHighlight = on;
    ctx.realm?.setPlantHighlight?.(on);
  }
  // Construction catalog on a given tab (land card: Build → Processing, Decor → Decoration).
  ctx.openBuild = tab => {
    if (ctx.blockedByAuto()) { ctx.buildNear = null; return; }
    if (tab) setBuildTab(ctx, tab);
    if (sheet.openId === 'build') sheet.rerender(); else ctx.onTool('build');
  };
  // Land for sale overview (realm 'expand' mode) + the floating Done chip that leaves it.
  ctx.setLandMode = mode => {
    const next = mode === 'expand' ? 'expand' : null;
    if (next && ctx.blockedByAuto()) return;
    sheet.close();
    staffModal.close();
    if (next && ctx.selection) ctx.clearSelection();
    const got = ctx.realm?.setLandMode?.(next);
    landWanted = (got === undefined ? next : got) === 'expand';
    syncLandChip();
  };
  // Farm ⇄ Café: only when both games are open at once (not in Round 1). The realm shows one area at a time.
  ctx.switchView = () => {
    const realm = ctx.realm;
    if (!realm?.setView || realm.switching || !bothGames(store.state)) return;
    sheet.close();
    staffModal.close();
    if (ctx.selection) ctx.clearSelection();
    sfx('ui.open');
    Promise.resolve(realm.setView(realm.view === 'cafe' ? 'farm' : 'cafe')).then(() => tutorial.refresh(), () => {});
  };

  const progressRender = progressSheet(ctx);
  const roundsRender = roundsSheet(ctx);
  const loanRender = loanSheet(ctx); // keeps its "pending" flag across re-renders
  const inboxRender = inboxSheet(ctx), journalRender = journalSheet(ctx), giftsRender = giftsSheet(ctx); // Duyệt (n) / 📒 Nhật ký (journal keeps its filters)
  ctx.onTool = id => {
    // Staff: the full staff manager modal (staff-modal.js), not a bottom sheet. A second tap closes it.
    if (id === 'staff') {
      if (staffModal.covering) { staffModal.close(); return; }
      if (staffModal.collapsed) { staffModal.back(); return; } // the bottom strip → back to the Detail
      sfx('ui.open');
      sheet.close();
      if (ctx.selection) ctx.clearSelection();
      if (landWanted) ctx.setLandMode(null);
      staffModal.open();
      tutorial.refresh();
      return;
    }
    staffModal.close();
    if (id === 'world') { if (ctx.blockedByAuto()) return; sheet.close(); ctx.onOpenAtlas?.(); return; }
    // Storage: the storehouse's own card (capacity + upgrade), with the camera on the building.
    if (id === 'storage' && ctx.realm?.view === 'cafe') id = 'beans'; // café: the bean pill opens the supplier
    if (id === 'storage') id = 'sell'; // farm: the Sell button and the storage pill open the list of what you can sell
    if (sheet.openId === id) { sheet.close(); return; }
    sfx('ui.open');
    const s = store.state;
    if (id === 'seeds') { // opening the picker clears the "new crop" dot
      for (const crop of CROP_ORDER) if (cropUnlocked(s, crop) && !s.story.seen?.[seenKey(crop)]) store.dispatch('story/seen', { key: seenKey(crop) });
    }
    if (id === 'menu') { // same for new drinks
      for (const drink of DRINK_ORDER) if (drinkUnlocked(s, drink) && !s.story.seen?.[drinkSeenKey(drink)]) store.dispatch('story/seen', { key: drinkSeenKey(drink) });
    }
    const render = { sell: () => sellSheet(ctx), upgrades: () => upgradesSheet(ctx), beans: () => beansSheet(ctx), build: () => buildSheet(ctx), seeds: () => seedsSheet(ctx), menu: () => menuSheet(ctx), supply: () => supplySheet(ctx), progress: () => progressRender, rounds: () => roundsRender, loan: () => loanRender, gifts: () => giftsRender, inbox: () => inboxRender, journal: () => journalRender }[id];
    if (!render) return;
    if (ctx.selection) ctx.clearSelection();
    if (landWanted) ctx.setLandMode(null);
    root.dataset.sheet = id;
    sheet.open(id, T(`hud.sheet.${id}`).replace(/^[^\p{L}\p{N}]+/u, ''), render()); // titles carry no leading icon
    syncPlantHighlight();
    tutorial.refresh();
  };

  // To-do chips: one per kind of job, with how many plants wait for it (no ring on every plant any more)
  const TODO = { ready: '🧺', thirst: '💧', prune: '🪚' };
  const todoChips = Object.fromEntries(Object.entries(TODO).map(([k, ico]) => [k, h('button', { type: 'button', class: `hud-todo-chip is-${k}`, hidden: true, attrs: { 'aria-label': T(`hud.tree.need.${k}`) },
    on: { click: () => { if (!ctx.realm?.focusAlert?.(k)) return; sfx('ui.open'); } } }, h('span', { attrs: { 'aria-hidden': 'true' } }, ico), h('b', null, '0'))]));
  const todoBar = h('div', { class: 'hud-todo' }, ...Object.values(todoChips));
  let todoClock = 0;
  function syncTodo() {
    const c = { ready: 0, thirst: 0, prune: 0 };
    for (const a of ctx.realm?.alertPlots || []) if (c[a.kind] != null) c[a.kind]++;
    for (const k of Object.keys(todoChips)) { const n = c[k]; todoChips[k].hidden = !n; if (todoChips[k].dataset.n !== String(n)) { todoChips[k].dataset.n = String(n); todoChips[k].lastChild.textContent = String(n); } }
  }
  const top = createTopBar(ctx);
  const toolbar = createToolbar(ctx);
  const fieldPop = createFieldPop(ctx);
  const actionBar = createActionBar(ctx);
  const shops = createShopStrip(ctx); // café street: [🏙][🍵][☕][🍋][🍺] (docs/design/cafe-street.md §3.8)
  const sheet = createSheetHost(ctx);
  const staffModal = createStaffModal(ctx);
  const staffAlerts = createStaffAlerts(ctx);
  const placement = createPlacementBar(ctx);
  const modals = createModals(ctx);
  const feedback = createFeedback(ctx);
  Object.assign(ctx, { top, toolbar, actionBar, shops, sheet, staffModal, placement, modals });
  // Street shop unlock card without a world tap (shop strip on a locked shop): drop the realm's own selection first
  // (its onSelect(null) clears the card), then show { kind: 'venue' }.
  ctx.showVenue = id => {
    const target = { kind: 'venue', venue: id };
    if (!ctx.realm?.select) { setSelection(target); return; }
    Promise.resolve(ctx.realm.select(null)).catch(() => {}).then(() => { if (ctx.realm?.view === 'cafe') setSelection(target); });
  };
  const tutorial = createTutorial(ctx);
  const devPanel = dev ? createDevPanel(ctx) : null;

  // ---------- region game: farm or café (asked once per region; only the games its country offers) ----------
  let choosing = false;
  function updateFirstGame() {
    const s = store.state;
    if (choosing || !region(s) || regionGame(s) || !ctx.isPlaying() || modals.open || ctx.isAuto()) return;
    const games = currentGames(s);
    if (!games.length) return;
    choosing = true;
    sheet.close();
    staffModal.close();
    const all = {
      farm: { id: 'farm', icon: '🌱', title: T('hud.mode.farm'), body: T('hud.mode.farmInfo') },
      cafe: { id: 'cafe', icon: '☕', title: T('hud.mode.cafe'), body: T('hud.mode.cafeInfo') },
    };
    modals.choose({
      title: T('hud.mode.title'), note: games.length === 1 ? T('hud.mode.only', { game: all[games[0]].title }) : '',
      options: games.map(g => all[g]),
    }).then(game => {
      choosing = false;
      if (!games.includes(game)) return; // closed by something else: asked again next frame
      sfx('ui.open');
      store.dispatch('play/chooseGame', { game });
      Promise.resolve(ctx.realm?.setView?.(game)).then(() => tutorial.refresh(), () => {});
    });
  }

  // ---------- level gifts: one gift box per level reached (chest on chest levels), a moment after the banner ----------
  let gifting = false, giftWait = 0;
  // (no more pop-up: level gifts wait behind the round 🎁 button, see gifts.js)
  function updateGifts() {}

  // ---------- land for sale: floating "Done" chip while the realm shows the lots for sale ----------
  let landWanted = false;
  const landChip = h('div', { class: 'hud-land-chip', hidden: true, attrs: { role: 'status' } },
    h('span', { class: 'hud-land-chip-text' }, `🏷️ ${T('fw.mode.expandHint')}`),
    h('button', { type: 'button', class: 'hud-land-chip-done', dataset: { hudId: 'landDone' }, on: { click: () => { sfx('ui.open'); ctx.setLandMode(null); } } }, `✓ ${T('fw.mode.exit')}`));
  function syncLandChip() {
    // The realm may leave the mode by itself (view swap, atlas, auto play): follow its landMode when it has one.
    const mode = ctx.realm && 'landMode' in ctx.realm ? ctx.realm.landMode : landWanted ? 'expand' : null;
    if (mode !== 'expand') landWanted = false;
    const show = mode === 'expand' && ctx.isPlaying();
    if (landChip.hidden === !show) return;
    landChip.hidden = !show;
    if (show) root.dataset.land = 'expand'; else delete root.dataset.land;
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
    switchBtn.hidden = true; // (never shown: farm and café are separate games)
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
    const name = n => (n.target?.type ? T(`building.${n.target.type}`) : n.target?.kind === 'venue' ? T(`venue.${n.target.venue}`) : '');
    const lines = list.flatMap(n => [T(`hud.notice.${n.kind}`, { name: name(n), id: n.target?.id || '' }), ...(n.up && n.kind !== 'up' && n.kind !== 'upMuted' ? [T(n.up === 'ok' ? 'hud.notice.up' : 'hud.notice.upMuted', { name: name(n) })] : [])]);
    notices.textContent = lines.join('. ');
  }

  root.append(...[top.el, todoBar, staffAlerts.el, shops.el, actionBar.el, landChip, toolbar.el, placement.el, sheet.el, staffModal.el, tutorial.el, feedback.el, modals.el, notices, devPanel?.el].filter(Boolean)); // no dev panel → nothing (not the text "undefined")
  document.body.append(root);

  function renderAll(s) {
    root.dataset.phase = s.story.phase;
    top.render(s);
    shops.render(s);
    toolbar.render(s);
    fieldPop.render(s);
    actionBar.render(s, ctx.selection);
    sheet.refresh(); // repaints only when what the sheet shows changed (no button swapped under the finger)
    staffModal.refresh(); // same rule (it also repaints every second on its own while open)
  }
  const unsubscribe = store.subscribe((s, events) => {
    renderAll(s);
    feedback.onEvents(s, events);
    tutorial.refresh();
  });
  renderAll(store.state);

  // General manager mood (docs/design/general-manager.md): any touch tells the manager the boss is around — at most
  // once per GM.mood.seenEverySeconds, and once right away (a return after hours away is judged here).
  let seenClock = 0;
  const seen = (force = false) => {
    const now = Date.now();
    if (!store.state.gm?.unit || (force !== true && now - seenClock < GM.mood.seenEverySeconds * 1000)) return;
    seenClock = now;
    store.dispatch('gm/seen', {});
  };
  document.addEventListener('pointerdown', seen, { passive: true, capture: true });
  document.addEventListener('keydown', seen, { capture: true });
  const seenBoot = setTimeout(seen, 1500);
  // Back on the tab (phone app switch / hidden tab): the return is judged at once, before a tap — the reducer's own
  // clock/tick and gm/payroll also catch it if this comes late (management-rules §4.1).
  const onVisible = () => { if (document.visibilityState === 'visible') seen(true); };
  document.addEventListener('visibilitychange', onVisible);

  // Screen bands the HUD covers (top bar / toolbar + action card), told to the realm camera so selections and tutorial
  // focus slide a target out from under the card (Hay Day rule: slide only when covered or off-screen).
  const shown = el => !!el && !el.hidden && el.getClientRects().length > 0;
  let insetSig = '', insetClock = 0;
  // The café shop rail starts under the top-left stack (player badge + pills), whose height changes with the screen
  // (pills stack in portrait, wrap in short landscape) — a fixed offset made the rail cover the 🫘 storehouse pill.
  // --hud-top-band: lowest edge of the whole top HUD (both columns + ▶ Auto / AUTO bar) — the action card's ceiling.
  let tlBottom = -1, bandBottom = -1, trBottom = -1;
  function syncTopLeft() {
    const tl = top.el.querySelector('.hud-top-left');
    const b = shown(tl) ? Math.round(tl.getBoundingClientRect().bottom) : 0;
    let band = 0;
    for (const n of [...top.el.querySelectorAll('.hud-top-left, .hud-top-right')]) if (shown(n)) band = Math.max(band, n.getBoundingClientRect().bottom);
    band = Math.round(band);
    if (b !== tlBottom) { tlBottom = b; root.style.setProperty('--hud-tl-bottom', `${b}px`); }
    if (band !== bandBottom) { bandBottom = band; root.style.setProperty('--hud-top-band', `${band}px`); }
    const tr = top.el.querySelector('.hud-top-right'), trb = shown(tr) ? Math.round(tr.getBoundingClientRect().bottom) : 0;
    if (trb !== trBottom) { trBottom = trb; root.style.setProperty('--hud-tr-bottom', `${trb}px`); }
  }
  ctx.refreshInsets = () => syncInsets();
  function syncInsets() {
    syncTopLeft();
    feedback.layout();
    if (!ctx.realm?.setSafeInsets) return;
    const H = window.innerHeight || 0;
    let topBand = 0, bottomTop = H;
    if (shown(top.el)) topBand = Math.max(0, top.el.getBoundingClientRect().bottom);
    for (const el of [toolbar.el, actionBar.el]) if (shown(el)) bottomTop = Math.min(bottomTop, el.getBoundingClientRect().top);
    const insets = { top: Math.round(topBand), bottom: Math.round(Math.max(0, H - bottomTop)) };
    const sig = `${insets.top}:${insets.bottom}`;
    if (sig === insetSig) return;
    insetSig = sig;
    ctx.realm.setSafeInsets(insets);
  }
  function setSelection(target) {
    ctx.selection = target || null;
    if (target) root.dataset.selection = target.type || target.kind; else delete root.dataset.selection;
    actionBar.render(store.state, ctx.selection);
    fieldPop.render(store.state);
    syncInsets();
    // The card just opened: slide the target clear of it when it is covered (never while a finger is down).
    if (target && target.kind !== 'venue' && ctx.realm?.focus && !ctx.realm.busy?.(0)) Promise.resolve(ctx.realm.focus(target, { center: true })).catch(() => {});
    tutorial.refresh();
  }

  const onKeyDown = e => {
    if (e.key !== 'Escape' || modals.open) return;
    // Escape cancels whatever is open, topmost first: viewers / tier modal → staff manager → sheets → placing / planting → the card
    if (ctx.closeTop) { e.preventDefault(); ctx.closeTop(); return; }
    if (ctx.realm?.signMoving) { e.preventDefault(); ctx.realm.cancelSignMove(); return; }
    if (!staffModal.isOpen && !sheet.openId && ctx.realm?.placement) { e.preventDefault(); ctx.realm.cancelPlacement(); return; }
    if (!staffModal.isOpen && !sheet.openId && ctx.selection) { e.preventDefault(); ctx.clearSelection(); return; }
    if (staffModal.isOpen) { e.preventDefault(); staffModal.back(); }
    else if (sheet.openId) { e.preventDefault(); sheet.close(); }
  };
  document.addEventListener('keydown', onKeyDown);

  return {
    el: root,
    setSelection,
    /** hooks.onShopFocus(id | null) from the realm → highlight that shop in the strip (null = street overview). */
    setShopFocus: id => shops.setFocus(id),
    /** ⬆️ over a worker tapped in the world → the staff manager on that unit's Detail. */
    openStaff: uid => { sheet.close(); if (ctx.selection) ctx.clearSelection(); sfx('ui.open'); staffModal.open({ uid }); tutorial.refresh(); },
    /** The manager tapped in the world → «Duyệt (n)» when something waits, else his tab in the staff manager. */
    openManager: () => {
      if (tasksOpen(store.state).length) { if (sheet.openId !== 'inbox') ctx.onTool('inbox'); return; }
      sheet.close(); if (ctx.selection) ctx.clearSelection(); sfx('ui.open'); staffModal.open({ tab: 'gm' }); tutorial.refresh();
    },
    /** Water / prune animation over a plant (drops falling · scissors snipping) while the tap does the work. */
    plantFx: (kind, id) => { // (workTimer: module-level)
      const pt = ctx.realm?.screenPoint?.({ kind: 'plot', id });
      if (!pt || pt.visible === false) return;
      const fx = document.createElement('div');
      fx.className = `hud-plantfx is-${kind}`;
      fx.style.left = `${Math.round(pt.x)}px`; fx.style.top = `${Math.round(pt.y - 24)}px`;
      fx.innerHTML = kind === 'water' ? '<i>💧</i><i>💧</i><i>💧</i>' : '<b>✂️</b>';
      root.append(fx);
      root.dataset.working = kind; // the matching 💧 / ✂️ button on the plant bar lights up while the work runs
      clearTimeout(workTimer); workTimer = setTimeout(() => { delete root.dataset.working; }, 1100);
      setTimeout(() => fx.remove(), 1100);
    },
    /** A tier signboard tapped in the world → its info modal right there. */
    openTier: id => { if (ctx.selection) ctx.clearSelection(); sfx('ui.open'); openTierModal(ctx, id); },
    toast: (text, tone = 'info') => feedback.toast(text, tone),
    confirm: opts => modals.confirm(opts),
    dialogue: lines => modals.dialogue(lines),
    update(dt = 0) {
      top.update(dt);
      shops.update(dt);
      toolbar.update(dt);
      fieldPop.update(dt);
      actionBar.update(dt);
      placement.update(dt);
      if ((todoClock += dt) > .3) { todoClock = 0; syncTodo(); }
      updateFirstGame();
      updateGifts(dt);
      updateSwitch();
      syncLandChip();
      tutorial.update(dt);
      updateNotices(dt);
      staffAlerts.update(dt);
      if ((insetClock += dt) >= .25) { insetClock = 0; syncInsets(); } // card height / resize / placing changes
    },
    dispose() {
      unsubscribe();
      clearTimeout(seenBoot);
      document.removeEventListener('pointerdown', seen, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('keydown', seen, { capture: true });
      document.removeEventListener('keydown', onKeyDown);
      ctx.realm?.setTutorialTarget?.(null);
      if (plantHighlight) ctx.realm?.setPlantHighlight?.(false);
      for (const part of [tutorial, modals, feedback, staffModal, sheet, placement, actionBar, shops, toolbar, fieldPop, top, devPanel]) part?.dispose();
      root.remove();
    },
  };
}
