// Shared small widgets: coin amount, action buttons with "need X more" notes, lock tags.
import { h } from './dom.js';
import { T, fmt } from './text.js';

/** A sum of coins in a report (earned, spent…): 0 reads 0. coinAmount is for prices, where 0 reads Free. */
export const coinValue = (n, cls = '') => h('span', { class: `hud-cost ${cls}` }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), fmt(n));
export const coinAmount = (n, cls = '') => h('span', { class: `hud-cost ${cls}` }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), n === 0 ? T('hud.free') : fmt(n));

/**
 * Big friendly action button. `cost` adds a coin amount, `note` a small line under it (e.g. "Need 40 more"),
 * `tone`: 'go' (green) | 'gold' | 'plain'.
 */
export function actionButton({ label, icon, cost, note, disabled, tone = 'go', onClick, id }) {
  const btn = h('button', { type: 'button', class: `hud-btn hud-btn--${tone}`, disabled: !!disabled, id, dataset: id ? { hudId: id } : undefined,
    on: { click: e => { if (!btn.disabled) onClick?.(e); } } },
  h('span', { class: 'hud-btn-main' }, icon ? h('span', { class: 'hud-btn-ico', attrs: { 'aria-hidden': 'true' } }, icon) : null, h('span', null, label), cost != null ? coinAmount(cost) : null),
  note ? h('span', { class: 'hud-btn-note' }, note) : null);
  return btn;
}

export const lockTag = text => h('span', { class: 'hud-lock' }, h('span', { attrs: { 'aria-hidden': 'true' } }, '🔒'), text);
export const needMore = missing => T('hud.needMore', { n: fmt(missing) });
