// Placement controls (✓ confirm / ↻ rotate / ✕ cancel) shown while realm.placement != null. Polled in update().
// They follow the building being placed (founder: "nút xây đi theo lò rang"): every frame the bar sits just under the
// ghost's footprint on screen (realm.placementPoint), flipped above it near the bottom edge, clamped to the screen.
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
  const el = h('div', { class: 'hud-place', hidden: true }, h('div', { class: 'hud-place-btns' }, cancel, rotate, ok), h('div', { class: 'hud-place-info' }, name, reason));
  let sig = null;

  function confirm() {
    const p = ctx.realm?.placement;
    if (!p) return;
    if (!p.valid) { ctx.toast(errorText(p.error || 'blocked'), 'bad'); sfx('ui.deny'); return; }
    // A failed confirm is reported by the realm's onResult hook (app toast), so no second toast here.
    ctx.realm.confirmPlacement?.();
  }

  // Follow the ghost on screen. Falls back to the bottom-centre bar (CSS) when the realm cannot give a point.
  const MARGIN = 8, TOP_SAFE = 64;
  function follow(p) {
    const pt = p && ctx.realm?.placementPoint?.();
    if (!pt || !pt.visible || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) { el.classList.remove('is-anchored'); el.style.left = el.style.top = ''; return; }
    el.classList.add('is-anchored');
    const w = el.offsetWidth, hgt = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    const x = Math.min(vw - w / 2 - MARGIN, Math.max(w / 2 + MARGIN, pt.x));
    let y = pt.y + 10;                                                   // under the footprint
    if (y + hgt > vh - MARGIN - 16) y = pt.top - hgt - 10;              // no room below: above the building
    y = Math.min(vh - hgt - MARGIN, Math.max(TOP_SAFE, y));
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }

  function update() {
    const p = ctx.realm?.placement || null;
    if (p && !el.hidden) follow(p);
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
    follow(p);
  }
  return { el, update, okButton: ok, get active() { return !!ctx.realm?.placement; }, dispose() {} };
}
