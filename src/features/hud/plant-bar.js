// The bar shown while a seed is in hand (realm.planting): the three varieties, what the row being drawn will cost, ✕ to stop.
// Polled in update(); rebuilt only when what it shows changes.
import { CROPS, CROP_ORDER } from '../../core/config/economy.js';
import { cropUnlocked, seedCost } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T, errorText } from './text.js';
import { coinAmount } from './widgets.js';
import { modelIcon } from './model-icons.js';
import { areaAt, fitOf, focusArea, pickTip } from './plant-note.js';

// The variety's own tree, rendered from its model (the same picture as the Build shelf).
function treeArt(id) {
  const ico = h('span', { class: 'hud-plantbar-art', attrs: { 'aria-hidden': 'true' } }, CROPS[id].icon);
  modelIcon({ model: `farm/coffee-tree-${id === 'liberica' ? 'liberica' : 'gedeo'}.glb#tree`, trueScale: 1 }).then(url => { if (!url) return; const img = Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false }); ico.replaceChildren(img); });
  return ico;
}

export function createPlantBar(ctx) {
  const chips = CROP_ORDER.map(id => h('button', { type: 'button', class: 'hud-plantbar-crop', dataset: { crop: id }, on: { click: () => ctx.realm?.startPlanting?.(id) } },
    treeArt(id), h('b', null, T(`crop.${id}`)), h('span', { class: 'hud-plantbar-cost' })));
  const line = h('span', { class: 'hud-plantbar-line' });
  const price = h('span', { class: 'hud-plantbar-price' });
  const stop = h('button', { type: 'button', class: 'hud-round-btn is-cancel', attrs: { 'aria-label': T('hud.place.cancel') }, on: { click: () => ctx.realm?.cancelPlacement?.() } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '×'));
  // What suits the land under the row (or in front of the camera) and how the seed in hand does there.
  const area = h('strong', { class: 'hud-plantbar-area' }), fit = h('span', { class: 'hud-plantbar-fit' }), care = h('span', { class: 'hud-plantbar-care' });
  // How wide one stroke is, and one button that plants everything around the middle of the screen.
  const rowBtns = [1, 3, 5].map(n => h('button', { type: 'button', class: 'hud-plantbar-row', dataset: { rows: String(n), hudId: `plantRows-${n}` }, attrs: { 'aria-label': T('hud.plantRow.rowsAria', { n }) }, on: { click: () => { ctx.realm?.setPlantRows?.(n); } } }, h('i', { attrs: { style: `--n:${n}`, 'aria-hidden': 'true' } }), String(n)));
  const rowSeg = h('div', { class: 'hud-plantbar-rows', attrs: { role: 'group', 'aria-label': T('hud.plantRow.rowsLabel') } }, ...rowBtns);
  const fill = h('button', { type: 'button', class: 'hud-plantbar-fill', dataset: { hudId: 'plantFill' }, on: { click: () => ctx.realm?.plantFill?.() } }, T('hud.plantRow.fill'));
  const el = h('div', { class: 'hud-plantbar', hidden: true },
    h('div', { class: 'hud-plantbar-note' }, area, fit, care),
    h('div', { class: 'hud-plantbar-info' }, line, price),
    h('div', { class: 'hud-plantbar-main' }, h('div', { class: 'hud-plantbar-crops' }, ...chips, stop),
      h('div', { class: 'hud-plantbar-tools' }, rowSeg, fill)));
  let sig = null, on = false;

  function update() {
    const p = ctx.realm?.planting || null;
    if (p) { ctx.root.dataset.placing = '1'; on = true; }
    else if (on) { on = false; if (!ctx.realm?.placement) delete ctx.root.dataset.placing; }
    const s = ctx.store.state, plan = p?.plan || null;
    const spot = plan?.spots?.[0], where = spot ? areaAt(spot.x, spot.z) : focusArea(ctx);
    const next = p ? `${p.rows}|${where.id}|${p.crop}|${plan ? `${plan.n}|${plan.cost}|${plan.error || ''}|${plan.broke ? 1 : 0}` : ''}|${CROP_ORDER.map(id => (cropUnlocked(s, id) ? 1 : 0)).join('')}` : '';
    if (next === sig) return;
    sig = next;
    el.hidden = !p;
    if (!p) return;
    for (const c of chips) {
      const open = cropUnlocked(s, c.dataset.crop);
      c.disabled = !open;
      c.classList.toggle('is-active', c.dataset.crop === p.crop);
      c.setAttribute('aria-pressed', String(c.dataset.crop === p.crop));
      c.querySelector('.hud-plantbar-cost').replaceChildren(coinAmount(seedCost(s, c.dataset.crop)));
    }
    for (const b of rowBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.rows) === p.rows));
    const f = fitOf(p.crop, where.zone);
    setText(area, T(`estate.short.${where.id}`));
    setText(fit, f.text);
    fit.className = `hud-plantbar-fit is-${f.tone}`;
    setText(care, pickTip(s, p.crop, where.zone));
    care.hidden = !!plan; // while drawing, the row's own numbers matter more
    const none = plan && plan.n === 0;
    setText(line, !plan ? T('hud.plantRow.hint', { n: p.rows }) : none ? errorText(plan.error || 'blocked') : plan.broke ? T('hud.plantRow.short', { n: plan.n }) : T('hud.plantRow.count', { n: plan.n }));
    line.classList.toggle('is-bad', !!none || !!plan?.broke);
    price.replaceChildren(...(plan && !none ? [coinAmount(plan.cost)] : []));
  }
  return { el, update };
}
