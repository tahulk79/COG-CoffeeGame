// V3 HUD (DOM only): minimal top HUD, bottom toolbar, contextual action bar, sheets, placement controls,
// confirm modal, Teacher dialogue, toasts and the tutorial overlay. API per docs/design/v3-architecture.md §HUD API.
import '../../ui/styles/v3.css';
import { CROP_ORDER } from '../../core/config/economy.js';
import { cropUnlocked } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, errorText } from './text.js';
import { createTopBar } from './top-bar.js';
import { createToolbar, seenKey } from './toolbar.js';
import { createActionBar } from './action-bar.js';
import { createSheetHost } from './sheet.js';
import { buildSheet, seedsSheet, staffSheet, progressSheet } from './sheets.js';
import { createPlacementBar } from './placement.js';
import { createModals } from './modal.js';
import { createFeedback } from './feedback.js';
import { createTutorial } from './tutorial.js';
import { createDevPanel } from './dev-panel.js';

export { errorText };

// Purchases started from the HUD get a small "buy" chime on success.
const PURCHASE = /^(build\/upgrade|land\/|staff\/hire|round\/unlock|rebirth\/perform)/;

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

  const progressRender = progressSheet(ctx); // keeps its "pending" flags across re-renders
  ctx.onTool = id => {
    if (id === 'world') { sheet.close(); ctx.onOpenAtlas?.(); return; }
    if (sheet.openId === id) { sheet.close(); return; }
    sfx('ui.open');
    const s = store.state;
    if (id === 'seeds') { // opening the picker clears the "new crop" dot
      for (const crop of CROP_ORDER) if (cropUnlocked(s, crop) && !s.story.seen?.[seenKey(crop)]) store.dispatch('story/seen', { key: seenKey(crop) });
    }
    const render = { build: () => buildSheet(ctx), seeds: () => seedsSheet(ctx), staff: () => staffSheet(ctx), progress: () => progressRender }[id];
    if (!render) return;
    if (ctx.selection) ctx.clearSelection();
    root.dataset.sheet = id;
    sheet.open(id, T(`hud.sheet.${id}`), render());
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

  root.append(top.el, actionBar.el, toolbar.el, placement.el, sheet.el, tutorial.el, feedback.el, modals.el, devPanel?.el);
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
