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
  let current = null; // { id, render(state) → Node, sig: string | null }

  // A store dispatch (background staff, customers…) must not rebuild the open sheet when nothing it shows changed:
  // a rebuild replaces the buttons under the player's finger. A render may carry `render.sig(state) → string` (cheap
  // signature of what it shows); without one the fresh tree is compared to the shown one (isEqualNode) and only
  // swapped in when it differs.
  function paint(force) {
    const s = ctx.store.state;
    const sigFn = typeof current.render.sig === 'function' ? current.render.sig : null;
    if (sigFn && !force) {
      const next = sigFn(s);
      if (next === current.sig) return;
      current.sig = next;
    } else if (sigFn) current.sig = sigFn(s);
    const node = current.render(s);
    if (!force && !sigFn && body.childNodes.length === 1 && node && body.firstChild.isEqualNode(node)) return;
    const top = body.scrollTop;
    body.replaceChildren(node);
    body.scrollTop = top;
  }

  const api = {
    el,
    get openId() { return current?.id || null; },
    open(id, heading, render) {
      current = { id, render, sig: null };
      setText(title, heading);
      panel.setAttribute('aria-label', heading);
      el.hidden = false;
      el.dataset.sheet = id;
      paint(true);
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
    /** Rebuilds now (a tab tap, a local flag changed): always repaints. */
    rerender() { if (current) paint(true); },
    /** Store changed: repaints only when what the sheet shows changed (signature / DOM compare). */
    refresh() { if (current) paint(false); },
    /** Sets the title of the open sheet (e.g. the catalog tab). */
    setTitle(heading) { if (current) { setText(title, heading); panel.setAttribute('aria-label', heading); } },
    /** Finds an element inside the open sheet (tutorial pointer). */
    query: sel => (current ? body.querySelector(sel) : null),
    dispose() { el.remove(); },
  };
  return api;
}
