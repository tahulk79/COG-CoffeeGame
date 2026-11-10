// Placement controls (✓ confirm / ↻ rotate / ✕ cancel) shown while realm.placement != null. Polled in update().
// They follow the building being placed (founder: "nút xây đi theo lò rang"): every frame the info card (also the drag handle)
// and under it ✕ ✓ hang below the ghost's footprint on screen (realm.placementPoint), clamped to the screen.
import { openTreeViewer } from './tree-viewer.js';
import { defOf, buildCost, region, plotState, plotNeeds, treeOld } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h, setText } from './dom.js';
import { T, errorText } from './text.js';
import { coinAmount } from './widgets.js';

// Price of what is being placed: the realm's info.cost when it gives one, else the next copy's price (moves are free).
function placeCost(p, s) {
  if (p.uid) return 0;
  if (Number.isFinite(p.cost)) return p.cost;
  return s ? buildCost(s, p.type) : 0;
}

export function createPlacementBar(ctx) {
  const name = h('strong', { class: 'hud-place-name' });
  const reason = h('span', { class: 'hud-place-reason' });
  const price = h('span', { class: 'hud-place-cost' }); // coin amount · 'Free' · 'Move'
  const round = (cls, icon, label, onClick, id) => h('button', { type: 'button', id, class: `hud-round-btn ${cls}`, dataset: id ? { hudId: id } : undefined,
    attrs: { 'aria-label': label }, on: { click: onClick } }, h('span', { attrs: { 'aria-hidden': 'true' } }, icon));
  const cancel = round('is-cancel', '✕', T('hud.place.cancel'), () => ctx.realm?.cancelPlacement?.());
  const rotate = round('is-rotate', '↻', T('hud.place.rotate'), () => ctx.realm?.rotatePlacement?.());
  const ok = round('is-ok', '✓', T('hud.place.confirm'), confirm, 'hud-place-ok');
  const el = h('div', { class: 'hud-place', hidden: true }, h('div', { class: 'hud-place-info' }, h('span', { class: 'hud-place-head' }, name, price), reason), h('div', { class: 'hud-place-btns' }, cancel, rotate, ok));
  // The tapped plant's quick bar: 💧 water · 🪚 prune · 👁 details — one UI family (same round buttons, same line icons).
  // A button lights up in its colour when the plant needs it, and stays dim otherwise.
  const SVG = {
    eye: '<path d="M2.5 14C5.2 9.2 9.3 6.6 14 6.6S22.8 9.2 25.5 14C22.8 18.8 18.7 21.4 14 21.4S5.2 18.8 2.5 14z" fill="#fff"/><circle cx="14" cy="14" r="5.3" fill="currentColor"/><circle cx="14" cy="14" r="2.6" fill="#13301a"/><circle cx="15.5" cy="12.4" r="1.1" fill="#fff"/>',
    water: '<path d="M14 3.8C14 3.8 6.6 12 6.6 17.4a7.4 7.4 0 0 0 14.8 0C21.4 12 14 3.8 14 3.8z" fill="#fff"/><path d="M10.6 17.6a3.5 3.5 0 0 0 3 3.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    prune: '<circle cx="7.4" cy="8" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="7.4" cy="20" r="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 9.6L23 19M10 18.4L23 9" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  };
  const qbtn = (kind, label, onClick) => { const b = h('button', { type: 'button', class: `hud-qbtn is-${kind}`, attrs: { 'aria-label': label }, on: { click: onClick } });
    b.innerHTML = `<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">${SVG[kind]}</svg>`; return b; };
  const quickAct = (type) => { const t = ctx.realm?.selection; if (t?.kind !== 'plot') return; if (!ctx.blockedByAuto?.()) ctx.act(type, { plotId: t.id }); ctx.realm?.select?.(null); };
  const bWater = qbtn('water', T('hud.tree.water'), () => quickAct('farm/water'));
  const bPrune = qbtn('prune', T('hud.tree.prune'), () => quickAct('farm/prune'));
  const bEye = qbtn('eye', T('hud.plot.detail'), () => { const t = ctx.realm?.selection; if (t?.kind === 'plot') openTreeViewer(ctx, t.id); });
  const plotBar = h('div', { class: 'hud-plotbar', hidden: true }, bWater, bPrune, bEye);
  // The problem marker is ONE ring round the plant's foot: its border is the patience bar (it empties as time runs out,
  // gold = ripe, sea blue = thirsty, grass green = prune) and turns solid red when the time is up. Tap it for the cause.
  const chips = [];
  function syncWarn() {
    const list = ctx.realm?.alertPlots || [];
    for (let k = 0; k < Math.max(list.length, chips.length); k++) {
      let c = chips[k];
      if (!c) {
        c = chips[k] = h('button', { type: 'button', class: 'hud-alertchip', hidden: true, attrs: { 'aria-label': T('hud.plot.detail') }, on: { click: () => c.dataset.plot && openTreeViewer(ctx, c.dataset.plot) } });
        ctx.root?.append(c);
      }
      const a = k < list.length && k < 40 ? list[k] : null;
      const pt = a ? ctx.realm?.screenPoint?.({ kind: 'plot', id: a.id }) : null;
      if (a && pt && pt.visible !== false && Number.isFinite(pt.x)) {
        c.hidden = false; c.dataset.plot = a.id; c.className = `hud-alertchip is-${a.kind}${a.warn ? ' is-warn' : ''}`;
        c.style.left = `${Math.round(pt.x)}px`; c.style.top = `${Math.round(pt.y + 22)}px`;
        c.style.setProperty('--p', String(a.warn ? 100 : a.left == null ? 100 : Math.round(a.left * 100)));
      } else c.hidden = true;
    }
  }
  // The hint box is the handle of the ghost: DRAG it and the ghost follows the finger (the map pans near the screen edges);
  // a plain TAP on it brings the view back to the spot where the thing is about to be placed.
  const info = el.querySelector('.hud-place-info');
  let grip = null;
  if (info) {
    info.classList.add('is-handle');
    const end = e => { if (!grip || grip.id !== e.pointerId) return; const tap = !grip.moved && e.type === 'pointerup'; grip = null; ctx.realm?.endGhostDrag?.(); if (tap) ctx.realm?.centerOnGhost?.(); };
    // Only the main button grabs it (a right click opens a menu that swallows the release).
    // The ghost keeps its distance from the finger, so it does not jump when the drag starts. Docked (ghost off screen): it comes under the finger.
    info.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return;
      const pt = el.classList.contains('is-docked') ? null : ctx.realm?.placementPoint?.();
      grip = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, dx: pt ? pt.x - e.clientX : 0, dy: pt ? pt.cy - e.clientY : 0 }; info.setPointerCapture?.(e.pointerId); e.preventDefault(); });
    info.addEventListener('pointermove', e => {
      if (!grip || grip.id !== e.pointerId) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) { end(e); return; } // let go without a pointerup: stop following the cursor
      if (!grip.moved && Math.hypot(e.clientX - grip.x, e.clientY - grip.y) < 7) return;
      grip.moved = true; ctx.realm?.dragGhostTo?.(e.clientX, e.clientY, grip.dx, grip.dy);
    });
    info.addEventListener('pointerup', end); info.addEventListener('pointercancel', end); info.addEventListener('lostpointercapture', end);
  }
  let sig = null;

  function confirm() {
    const p = ctx.realm?.placement;
    if (!p) return;
    if (!p.valid) { ctx.toast(errorText(p.error || 'blocked'), 'bad'); sfx('ui.deny'); return; }
    // A failed confirm is reported by the realm's onResult hook (app toast), so no second toast here.
    ctx.realm.confirmPlacement?.();
  }

  // Follow the ghost on screen. Falls back to the bottom-centre bar (CSS) when the realm cannot give a point.
  const MARGIN = 6;
  function follow(p) {
    const pt = p && ctx.realm?.placementPoint?.();
    // The ghost is on screen → the set rides above it. The map was swiped so far that the ghost is off screen → the set docks in the
    // bottom-left corner; tapping its hint box brings the view back to the ghost.
    // (docked only when the ghost is really OFF the screen: close to an edge it still carries its own ✓ ✗)
    const onScreen = pt && pt.visible && Number.isFinite(pt.x) && Number.isFinite(pt.y) && pt.x > 0 && pt.x < innerWidth && pt.y > 0 && pt.y < innerHeight;
    el.classList.toggle('is-docked', !onScreen);
    if (!onScreen) { el.classList.remove('is-anchored'); el.style.left = el.style.top = ''; return; }
    el.classList.add('is-anchored');
    const w = el.offsetWidth, hgt = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    const x = Math.min(vw - w / 2 - MARGIN, Math.max(w / 2 + MARGIN, pt.x));
    // The whole set hangs under the footprint, moving with it; near the bottom edge it stays on screen and may cover the ghost.
    const y = Math.min(vh - hgt - MARGIN, Math.max(MARGIN, pt.y + 10));
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }

  function update() {
    const p = ctx.realm?.placement || null;
    if (p && !el.hidden) follow(p);
    if (!plotBar.isConnected) ctx.root?.append(plotBar);
    const sel = ctx.realm?.selection;
    const dp = sel?.kind === 'plot' && ctx.selection?.kind !== 'plot' && !p ? ctx.realm?.screenPoint?.(sel) : null;
    plotBar.hidden = !(dp && dp.visible !== false);
    if (!plotBar.hidden) {
      plotBar.style.left = `${Math.round(dp.x)}px`; plotBar.style.top = `${Math.round(dp.y - 34)}px`;
      const st = ctx.store.state, pl = region(st)?.plots?.[sel.id], ps = pl ? plotState(st, sel.id, Date.now()) : null;
      const canWater = !!pl && ps.stage !== 'ready' && !pl.watered, canPrune = !!pl && treeOld(pl) && ps.stage !== 'ready', need = plotNeeds(st, sel.id, Date.now());
      bWater.disabled = !canWater; bPrune.disabled = !canPrune;
      bWater.classList.toggle('is-need', need === 'thirst'); bPrune.classList.toggle('is-need', need === 'prune');
    }
    const cost = p ? placeCost(p, ctx.store.state) : null;
    const next = p ? `${el.classList.contains('is-docked') ? 'D' : ''}|${p.type}|${p.uid || ''}|${p.valid ? 1 : 0}|${p.error || ''}|${p.noRoom || ''}|${p.warn || ''}|${p.fieldsUnder || 0}|${cost}` : '';
    if (next === sig) return;
    sig = next;
    el.hidden = !p;
    if (p) ctx.root.dataset.placing = '1'; else if (!ctx.realm?.planting) delete ctx.root.dataset.placing;
    if (!p) return;
    const def = defOf(p.type);
    setText(name, `${def?.icon || ''} ${T(`building.${p.type}`)}`);
    rotate.hidden = false; // cancel, rotate, place: the three buttons of the game design
    price.replaceChildren(p.uid ? T('hud.move') : coinAmount(cost || 0)); // coinAmount(0) reads 'Free'
    price.classList.toggle('is-move', !!p.uid);
    const why = p.error === 'onField' && p.type === 'field' ? T('fw.place.plantHere') : p.error === 'onField' && p.fieldsUnder > 0 ? T('fw.place.clearFields', { n: p.fieldsUnder }) : errorText(p.error || 'blocked');
    setText(reason, el.classList.contains('is-docked') ? T('hud.place.back') : p.valid && p.warn ? errorText(p.warn) : p.valid ? T('hud.place.hint') : p.noRoom ? T(p.noRoom) : why);
    reason.classList.toggle('is-bad', !p.valid || !!p.warn);
    reason.classList.toggle('is-quiet', p.valid && !p.warn && !el.classList.contains('is-docked')); // nothing to say: the green grid says it
    ok.disabled = !p.valid;
    ok.setAttribute('aria-disabled', String(!p.valid));
    follow(p);
  }
  return { el, update, okButton: ok, get active() { return !!ctx.realm?.placement; }, dispose() { plotBar.remove(); for (const c of chips) c.remove(); } };
}
