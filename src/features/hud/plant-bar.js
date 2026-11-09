// The bar shown while a seed is in hand (realm.planting): the three varieties, what the row being drawn will cost, ✕ to stop.
// Polled in update(); rebuilt only when what it shows changes.
import { CROPS, CROP_ORDER } from '../../core/config/economy.js';
import { cropUnlocked } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T, errorText } from './text.js';
import { coinAmount } from './widgets.js';

export function createPlantBar(ctx) {
  const chips = CROP_ORDER.map(id => h('button', { type: 'button', class: 'hud-plantbar-crop', dataset: { crop: id }, on: { click: () => ctx.realm?.startPlanting?.(id) } },
    h('span', { attrs: { 'aria-hidden': 'true' } }, CROPS[id].icon), h('b', null, T(`crop.${id}`))));
  const line = h('span', { class: 'hud-plantbar-line' });
  const price = h('span', { class: 'hud-plantbar-price' });
  const stop = h('button', { type: 'button', class: 'hud-round-btn is-cancel', attrs: { 'aria-label': T('hud.place.cancel') }, on: { click: () => ctx.realm?.cancelPlacement?.() } }, h('span', { attrs: { 'aria-hidden': 'true' } }, '✕'));
  const el = h('div', { class: 'hud-plantbar', hidden: true },
    h('div', { class: 'hud-plantbar-info' }, line, price),
    h('div', { class: 'hud-plantbar-crops' }, ...chips, stop));
  let sig = null, on = false;

  function update() {
    const p = ctx.realm?.planting || null;
    if (p) { ctx.root.dataset.placing = '1'; on = true; }
    else if (on) { on = false; if (!ctx.realm?.placement) delete ctx.root.dataset.placing; }
    const s = ctx.store.state, plan = p?.plan || null;
    const next = p ? `${p.crop}|${plan ? `${plan.n}|${plan.cost}|${plan.error || ''}|${plan.broke ? 1 : 0}` : ''}|${CROP_ORDER.map(id => (cropUnlocked(s, id) ? 1 : 0)).join('')}` : '';
    if (next === sig) return;
    sig = next;
    el.hidden = !p;
    if (!p) return;
    for (const c of chips) {
      const open = cropUnlocked(s, c.dataset.crop);
      c.disabled = !open;
      c.classList.toggle('is-active', c.dataset.crop === p.crop);
      c.setAttribute('aria-pressed', String(c.dataset.crop === p.crop));
    }
    const none = plan && plan.n === 0;
    setText(line, !plan ? T('hud.plantRow.hint') : none ? errorText(plan.error || 'blocked') : plan.broke ? T('hud.plantRow.short', { n: plan.n }) : T('hud.plantRow.count', { n: plan.n }));
    line.classList.toggle('is-bad', !!none || !!plan?.broke);
    price.replaceChildren(...(plan && !none ? [coinAmount(plan.cost)] : []));
  }
  return { el, update };
}
