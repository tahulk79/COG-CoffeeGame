// Generic bottom sheet (max ~55% of a portrait screen). One sheet at a time; its body re-renders on store changes.
import { h, setText } from './dom.js';
import { T } from './text.js';

export function createSheetHost(ctx) {
  const title = h('h2', { class: 'hud-sheet-title' });
  const body = h('div', { class: 'hud-sheet-body' });
  const close = h('button', { type: 'button', class: 'hud-x', attrs: { 'aria-label': T('hud.close') }, on: { click: () => api.close() } }, '×');
  const panel = h('section', { class: 'hud-sheet', attrs: { role: 'dialog', 'aria-modal': 'false' } }, h('header', { class: 'hud-sheet-head' }, title, close), body);
  const scrim = h('div', { class: 'hud-sheet-scrim', on: { click: () => api.close() } });
  const el = h('div', { class: 'hud-sheet-host', hidden: true }, scrim, panel);
  let current = null; // { id, render(state) → Node }

  const api = {
    el,
    get openId() { return current?.id || null; },
    open(id, heading, render) {
      current = { id, render };
      setText(title, heading);
      panel.setAttribute('aria-label', heading);
      el.hidden = false;
      el.dataset.sheet = id;
      api.rerender();
      body.scrollTop = 0;
      close.focus({ preventScroll: true });
    },
    close() {
      if (!current) return;
      current = null;
      el.hidden = true;
      body.replaceChildren();
      ctx.onSheetClosed?.();
    },
    rerender() {
      if (!current) return;
      const top = body.scrollTop;
      body.replaceChildren(current.render(ctx.store.state));
      body.scrollTop = top;
    },
    /** Finds an element inside the open sheet (tutorial pointer). */
    query: sel => (current ? body.querySelector(sel) : null),
    dispose() { el.remove(); },
  };
  return api;
}
