// V3 HUD (DOM only): minimal top HUD, bottom toolbar, contextual action bar, sheets, placement controls,
// confirm modal, Teacher dialogue, toasts and the tutorial overlay. API per docs/design/v3-architecture.md §HUD API.
import '../../ui/styles/v3.css';
import { CROP_ORDER, DRINK_ORDER } from '../../core/config/economy.js';
import { cropUnlocked, drinkUnlocked, region } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, errorText } from './text.js';
import { createTopBar } from './top-bar.js';
import { createToolbar, seenKey } from './toolbar.js';
import { createActionBar } from './action-bar.js';
import { createSheetHost } from './sheet.js';
import { buildSheet, seedsSheet, menuSheet, staffSheet, progressSheet, drinkSeenKey } from './sheets.js';
import { createPlacementBar } from './placement.js';
import { createModals } from './modal.js';
import { createFeedback } from './feedback.js';
import { createTutorial } from './tutorial.js';
import { createDevPanel } from './dev-panel.js';

export { errorText };

// Purchases started from the HUD get a small "buy" chime on success.
const PURCHASE = /^(build\/upgrade|land\/|staff\/hire|round\/unlock|rebirth\/perform|world\/unlockRegion)/;

/**
 * @param {{ store: object, realm?: object, dev?: boolean, onOpenAtlas?: () => void, onOpenSettings?: () => void }} opts
 */
export function createHud({ store, realm = null, dev = false, onOpenAtlas, onOpenSettings } = {}) {
  document.getElementById('hud-root')?.remove(); // a stale root from a previous run (HMR / restart)
  const root = h('div', { id: 'hud-root' });
  const ctx = { store, realm, dev, root, onOpenAtlas, onOpenSettings, selection: null };

  ctx.isPlaying = () => store.state.story.phase === 'play' && !!store.state.world.currentRegion;
  ctx.act = (type, payload = {}, opts = {}) => {
    const result = store.dispatch(type, payload, opts);
    if (!result.ok) { feedback.toast(errorText(result), 'bad'); sfx('ui.deny'); }
    else if (!result.noop && !result.duplicate && PURCHASE.test(type)) sfx('ui.buy');
    return result;
  };
  ctx.toast = (text, tone) => feedback.toast(text, tone);
  ctx.confirm = opts => modals.confirm(opts);
  ctx.clearSelection = () => { ctx.realm?.select?.(null); setSelection(null); };
  ctx.onSheetClosed = () => { delete root.dataset.sheet; tutorial.refresh(); };
  // Café ⇄ Farm: the realm shows one area of the region at a time (the HUD button is the way into the café).
  ctx.switchView = () => {
    const realm = ctx.realm;
    if (!realm?.setView || realm.switching) return;
    sheet.close();
    if (ctx.selection) ctx.clearSelection();
    sfx('ui.open');
    const next = realm.view === 'cafe' ? 'farm' : 'cafe';
    Promise.resolve(realm.setView(next)).then(() => tutorial.refresh(), () => {});
    tutorial.refresh();
  };

  const progressRender = progressSheet(ctx); // keeps its "pending" flags across re-renders
  ctx.onTool = id => {
    if (id === 'world') { sheet.close(); ctx.onOpenAtlas?.(); return; }
    // Storage: the storehouse's own card (capacity + upgrade), with the camera on the building.
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
    const render = { build: () => buildSheet(ctx), seeds: () => seedsSheet(ctx), menu: () => menuSheet(ctx), staff: () => staffSheet(ctx), progress: () => progressRender }[id];
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

  root.append(top.el, actionBar.el, toolbar.el, placement.el, sheet.el, tutorial.el, feedback.el, modals.el, notices, devPanel?.el);
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
