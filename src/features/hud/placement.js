// Placement controls (✓ confirm / ↻ rotate / ✕ cancel) shown while realm.placement != null. Polled in update().
import { BUILDINGS } from '../../core/config/economy.js';
import { sfx } from '../../shared/audio/index.js';
import { h, setText } from './dom.js';
import { T, errorText } from './text.js';

export function createPlacementBar(ctx) {
  const name = h('strong', { class: 'hud-place-name' });
  const reason = h('span', { class: 'hud-place-reason' });
  const round = (cls, icon, label, onClick, id) => h('button', { type: 'button', id, class: `hud-round-btn ${cls}`, dataset: id ? { hudId: id } : undefined,
    attrs: { 'aria-label': label }, on: { click: onClick } }, h('span', { attrs: { 'aria-hidden': 'true' } }, icon));
  const cancel = round('is-cancel', '✕', T('hud.place.cancel'), () => ctx.realm?.cancelPlacement?.());
  const rotate = round('is-rotate', '↻', T('hud.place.rotate'), () => ctx.realm?.rotatePlacement?.());
  const ok = round('is-ok', '✓', T('hud.place.confirm'), confirm, 'hud-place-ok');
  const el = h('div', { class: 'hud-place', hidden: true }, h('div', { class: 'hud-place-info' }, name, reason), h('div', { class: 'hud-place-btns' }, cancel, rotate, ok));
  let sig = null;

  function confirm() {
    const p = ctx.realm?.placement;
    if (!p) return;
    if (!p.valid) { ctx.toast(errorText(p.error || 'blocked'), 'bad'); sfx('ui.deny'); return; }
    // A failed confirm is reported by the realm's onResult hook (app toast), so no second toast here.
    ctx.realm.confirmPlacement?.();
  }

  function update() {
    const p = ctx.realm?.placement || null;
    const next = p ? `${p.type}|${p.valid ? 1 : 0}|${p.error || ''}` : '';
    if (next === sig) return;
    sig = next;
    el.hidden = !p;
    if (p) ctx.root.dataset.placing = '1'; else delete ctx.root.dataset.placing;
    if (!p) return;
    const def = BUILDINGS[p.type];
    setText(name, `${def?.icon || ''} ${T(`building.${p.type}`)}`);
    setText(reason, p.valid ? T('hud.place.hint') : errorText(p.error || 'blocked'));
    reason.classList.toggle('is-bad', !p.valid);
    ok.disabled = !p.valid;
    ok.setAttribute('aria-disabled', String(!p.valid));
  }
  return { el, update, okButton: ok, get active() { return !!ctx.realm?.placement; }, dispose() {} };
}
