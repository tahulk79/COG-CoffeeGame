// Tier info modal: tapping a tier's signboard opens THIS right where you tapped (centre of the screen), not the bottom card.
// Climate, what suits it, owned / price + buy.
import { CROPS } from '../../core/config/economy.js';
import { ESTATES } from '../../core/config/layout.js';
import { parcelError, climateFit, climateEffect, estateOwned, nextEstate, beanPrice } from '../../core/derive.js';
import { h } from './dom.js';
import { T, fmt } from './text.js';
import { actionButton, needMore } from './widgets.js';

export function openTierModal(ctx, parcelId) {
  const est = Object.values(ESTATES).find(e => e.seed === parcelId);
  if (!est) return null;
  const s = ctx.store.state, owned = estateOwned(s, est.id), err = owned ? null : parcelError(s, est.seed), zone = est.zone;
  const close = () => { if (ctx.closeTop === close) ctx.closeTop = null; overlay.remove(); };
  // What to plant here, best first: the climate effect of each variety on this tier, in plain words.
  const RANK = { good: 0, ok: 1, bad: 2 };
  const rows = ['robusta', 'arabica', 'liberica'].map(c => ({ c, f: climateFit(c, zone), e: climateEffect(c, zone) }))
    .sort((p, q) => RANK[p.f] - RANK[q.f] || beanPrice(q.c) - beanPrice(p.c));
  const why = ({ c, e }) => {
    const out = [];
    if (e?.timeMul && e.timeMul < 1) out.push(T('tm.faster', { pct: Math.round((1 - e.timeMul) * 100) }));
    if (e?.timeMul && e.timeMul > 1) out.push(T('tm.slower', { pct: Math.round((e.timeMul - 1) * 100) }));
    if (e?.stars > 0) out.push(T('tm.starsUp')); if (e?.stars < 0) out.push(T('tm.starsDown'));
    if (!out.length) out.push(T('tm.neutral'));
    return out.join(' · ');
  };
  const best = rows[0], bestHint = best.f === 'bad' ? null : T('tm.best', { crop: `${CROPS[best.c].icon} ${T(`crop.${best.c}`)}` });
  let action = null;
  if (!owned) {
    if (err === 'order') action = h('p', { class: 'hud-line hud-line--muted' }, '🔒 ', T('estate.order', { name: T(`estate.${nextEstate(s)?.id || est.id}`) }));
    else action = actionButton({ id: 'tierBuy', label: T('estate.buy'), icon: '🪓', cost: est.cost, disabled: err === 'coins', note: err === 'coins' ? needMore(est.cost - Math.floor(s.player.coins)) : null,
      onClick: () => { const r = ctx.act('land/buyParcel', { parcelId: est.seed }); if (r.ok) close(); } });
  }
  const overlay = h('div', { class: 'hud-treeview', on: { click: e => { if (e.target === overlay) close(); } } },
    h('div', { class: 'hud-treeview-card hud-tiercard', dataset: { tier: est.id } },
      h('div', { class: 'hud-treeview-head' }, h('div', null, h('strong', null, T(`estate.${est.id}`)), h('small', null, owned ? T('estate.owned') : `🪙 ${fmt(est.cost)}`)),
        h('button', { type: 'button', class: 'hud-treeview-x', attrs: { 'aria-label': T('hud.place.cancel') }, on: { click: close } }, '✕')),
      h('p', { class: 'hud-line hud-line--muted' }, `${T(`zone.${zone}.icon`)} ${T(`zone.${zone}`)} · `, T(`hud.zone.soil.${zone}`)),
      bestHint ? h('p', { class: 'hud-tm-best' }, bestHint) : null,
      h('div', { class: 'hud-tm-rows' }, ...rows.map(r => h('div', { class: `hud-tm-row is-${r.f}` },
        h('span', { class: 'hud-tm-ico', attrs: { 'aria-hidden': 'true' } }, CROPS[r.c].icon),
        h('div', { class: 'hud-tm-text' },
          h('strong', null, T(`crop.${r.c}`), ' ', h('em', null, T(`tm.fit.${r.f}`))),
          h('small', null, why(r)),
          h('small', { class: 'hud-tm-likes' }, `${T('tm.likes')} ${T(`crop.${r.c}.temp`)} · ${T(`crop.${r.c}.height`)}`),
          h('small', { class: 'hud-tm-likes' }, `${T(`crop.${r.c}.where`)}`))))),
      h('div', { class: 'hud-treeview-tools' }, ...[action, actionButton({ id: 'tierMoveSign', label: T('tier.moveSign'), icon: '✥', tone: 'plain', onClick: () => { close(); ctx.realm?.beginSignMove?.(est.seed); } })].filter(Boolean))));
  ctx.root.append(overlay);
  ctx.closeTop = close; // Escape closes it
  return { close };
}
