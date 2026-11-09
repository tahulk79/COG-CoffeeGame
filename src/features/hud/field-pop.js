// Field tool popup (Hay Day / FarmVille): after a tap on a field, round tool icons float next to it — the coffee seeds
// you can plant (while empty beds remain) and the basket (while ripe trees remain). Hold an icon and sweep it over the
// beds: every bed under the finger is planted / harvested (realm.toolDrag). A tap on an icon only picks that seed.
// Art: public/assets/farm/ui/seed-<crop>.png, ui/tool-basket.png (farm-assets.js); emoji until then.
import { CROPS } from '../../core/config/economy.js';
import { ownedPlots, plotState, unlockedCrops, seedCost } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T, fmt } from './text.js';
import { useFarmArt } from './farm-assets.js';

export function createFieldPop(ctx) {
  const el = h('div', { class: 'hud-fieldpop', hidden: true, attrs: { role: 'toolbar', 'aria-label': T('hud.fieldPop.aria') } });
  const ghost = h('div', { class: 'hud-fieldpop-ghost', hidden: true, attrs: { 'aria-hidden': 'true' } });
  const hint = h('div', { class: 'hud-fieldpop-hint', hidden: true });
  const wrap = h('div', null, el, ghost, hint);
  // Field status chip (timer / ripe) + ⓘ: the long field card (uproot, move, prune…) only opens on demand, so a tap on a
  // field shows a small bubble next to it instead of a web-style panel at the bottom.
  const chip = h('span', { class: 'hud-fieldpop-chip' });
  const more = h('button', { type: 'button', class: 'hud-fieldpop-more', dataset: { hudId: 'fieldpop-more' }, attrs: { 'aria-label': T('hud.fieldPop.more') },
    on: { click: () => { const r = ctx.root; if (r.dataset.plotcard) delete r.dataset.plotcard; else r.dataset.plotcard = '1'; ctx.refreshInsets?.(); } } }, '⋯');
  let lastId = null, sig = '', target = null, dragging = null, hintShown = false;
  const ac = new AbortController(); const opt = { signal: ac.signal };

  function tool(key, mode, crop, icon, art, label, price) {
    const ico = h('span', { class: 'hud-fieldpop-ico', attrs: { 'aria-hidden': 'true' } }, icon);
    useFarmArt(ico, art);
    const btn = h('button', { type: 'button', class: `hud-fieldpop-btn is-${mode}`, dataset: { hudId: `fieldpop-${key}` }, attrs: { 'aria-label': label } },
      ico, price != null ? h('span', { class: 'hud-fieldpop-price' }, price === 0 ? T('hud.fieldPop.free') : `🪙${fmt(price)}`) : null);
    btn.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault();
      if (!ctx.realm?.toolDrag?.start(mode, crop)) return;
      try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      dragging = { id: e.pointerId, btn, crop, moved: false, x: e.clientX, y: e.clientY };
      ghost.replaceChildren(ico.cloneNode(true));
      moveGhost(e.clientX, e.clientY);
      btn.classList.add('is-held');
      hint.hidden = true;
    });
    return { btn, ico };
  }
  // One pair of window listeners for every tool: moves / releases are caught even when the release lands outside the
  // button or the button was detached meanwhile.
  addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.id) return;
    if (!dragging.moved && Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 8) return;
    if (!dragging.moved) { dragging.moved = true; ghost.hidden = false; el.classList.add('is-dragging'); }
    moveGhost(e.clientX, e.clientY);
    ctx.realm.toolDrag.move(e.clientX, e.clientY - 34); // the bed under the icon, not under the fingertip
  }, opt);
  function up(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    const { moved, btn, crop } = dragging;
    dragging = null;
    ctx.realm?.toolDrag?.end();
    ghost.hidden = true; el.classList.remove('is-dragging'); btn.classList.remove('is-held');
    if (last) render(last); // the sweep may have filled / emptied the beds
    if (!moved) { // a plain tap: pick that seed and say how to use it once
      if (crop) ctx.realm?.setActiveCrop?.(crop);
      if (!hintShown) { hintShown = true; setText(hint, T('hud.fieldPop.hint')); hint.hidden = false; setTimeout(() => { hint.hidden = true; }, 2600); }
    }
  }
  addEventListener('pointerup', up, opt);
  addEventListener('pointercancel', up, opt);
  function setChip(s) {
    if (!target) return;
    const st = plotState(s, target.id, Date.now());
    const text = st.stage === 'empty' ? T('hud.fieldPop.empty') : st.stage === 'ready' ? T('hud.fieldPop.ready')
      : `⏱ ${Math.floor(st.remainingMs / 60000)}:${String(Math.ceil(st.remainingMs / 1000) % 60).padStart(2, '0')}`;
    setText(chip, text);
    chip.classList.toggle('is-ready', st.stage === 'ready');
  }
  function moveGhost(x, y) { ghost.style.transform = `translate(${x - 30}px, ${y - 64}px)`; }

  function render(s) {
    last = s;
    if (dragging) return; // never swap the icon under the finger (its pointer capture would be lost)
    const sel = ctx.selection;
    const farm = (ctx.realm?.view || 'farm') === 'farm';
    target = farm && sel?.kind === 'plot' ? sel : null;
    if (!target) { if (!dragging) { el.hidden = true; sig = ''; delete ctx.root.dataset.plotcard; } return; }
    const now = Date.now();
    let empty = 0, ready = 0;
    for (const p of ownedPlots(s)) {
      const st = plotState(s, p.id, now).stage;
      if (st === 'empty') empty++; else if (st === 'ready') ready++;
    }
    const crops = empty ? unlockedCrops(s).slice(-3) : [];
    if (target.id !== lastId) { // a new field: its card opens at once unless the bed is empty (tap = plant)
      lastId = target.id;
      if (plotState(s, target.id, now).stage === 'empty') delete ctx.root.dataset.plotcard; else ctx.root.dataset.plotcard = '1';
      ctx.refreshInsets?.();
    }
    const next = `${target.id}|${crops.join(',')}|${ready > 0}|${crops.map(c => seedCost(s, c)).join(',')}`;
    if (next === sig) { el.hidden = false; return; }
    sig = next;
    const kids = [];
    if (ready) kids.push(tool('basket', 'harvest', null, '🧺', 'ui/tool-basket.png', T('hud.fieldPop.harvest')).btn);
    for (const c of crops) kids.push(tool(c, 'plant', c, CROPS[c].icon, `ui/seed-${c}.png`, T('hud.fieldPop.plant', { crop: T(`crop.${c}`) }), seedCost(s, c)).btn);
    el.replaceChildren(chip, ...kids, more);
    el.hidden = false;
    setChip(s);
  }
  // Follows the field on screen every frame (the camera pans / zooms freely).
  let tick = 0, last = null;
  function update(dt = 0) {
    tick += dt;
    if (tick > 1 && last && !dragging) { tick = 0; render(last); setChip(last); } // beds ripen with time, not only on store changes
    if (el.hidden || !target || !ctx.realm?.screenPoint) return;
    const p = ctx.realm.screenPoint(target);
    if (!p.visible) { el.style.opacity = '0'; return; }
    el.style.opacity = '';
    const w = el.offsetWidth || 120;
    const x = Math.max(8, Math.min(innerWidth - w - 8, p.x - w / 2));
    const y = Math.max(70, p.y - 86);
    el.style.transform = `translate(${x}px, ${y}px)`;
    hint.style.transform = `translate(${Math.max(8, Math.min(innerWidth - 220, p.x - 110))}px, ${y - 40}px)`;
  }
  return { el: wrap, render, update, dispose() { ac.abort(); ctx.realm?.toolDrag?.end(); } };
}
