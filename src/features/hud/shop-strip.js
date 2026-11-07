// Café street shop strip (docs/design/cafe-street.md §3.8): [🏙 Cả phố] [🍵] [☕] [🍋] [🍺] in founder order
// (SHOP_ORDER, left → right on the street). Café view only, under the top-left player badge: a slim vertical rail on
// portrait phones, a row in landscape / desktop (v3.css .hud-shops). Each shop chip shows the shop's ⭐ average (one
// decimal); locked shops are dimmed with a 🔒 corner. The chip of the shop the camera frames (realm.focusedShop, also
// pushed through hud.setShopFocus ← hooks.onShopFocus) is highlighted; 🏙 is highlighted for the street overview.
// Tap → realm.focusShop(id | null). A locked shop also opens its venue card (unlock) so the strip doubles as the
// "where do I buy the next shop" entry. Shown from the first venue level (or once any venue is open) so the café
// tutorial never fights it for the top-left corner. Per-frame work = one small signature compare.
import { VENUES } from '../../core/config/economy.js';
import { SHOP_ORDER } from '../../core/config/layout.js';
import { venueOpen, venueRating, level } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { getLang } from '../../i18n/index.js';
import { sfx } from '../../shared/audio/index.js';
import { h, setText } from './dom.js';
import { T } from './text.js';

// Lowest level any street venue unlocks at (lemon, Lv 3 today): before that the strip would only show locks.
const FIRST_VENUE_LEVEL = Math.min(...Object.values(VENUES).filter(v => v.id !== 'cafe').map(v => v.level));

/** 4.236 → "4.2" (vi: "4,2"). */
export function stars1(avg) {
  const s = (Math.round((Number(avg) || 0) * 10) / 10).toFixed(1);
  return getLang() === 'vi' ? s.replace('.', ',') : s;
}

export function createShopStrip(ctx) {
  const chips = new Map(); // id ('street' | shop id) → { btn, star }
  let hookFocus = null;    // last id pushed by hooks.onShopFocus (fallback when the realm has no focusedShop getter)

  function chip(id) {
    const street = id === 'street';
    const star = street ? null : h('span', { class: 'hud-shop-star' });
    const btn = h('button', { type: 'button', id: `hud-shop-${id}`, class: `hud-shop${street ? ' hud-shop--street' : ''}`, dataset: { hudId: `shop-${id}`, shop: id },
      on: { click: () => tap(street ? null : id) } },
    h('span', { class: 'hud-shop-ico', attrs: { 'aria-hidden': 'true' } }, street ? '🏙' : VENUES[id]?.icon || '🏠'),
    street ? h('span', { class: 'hud-shop-label' }, T('hud.street.overview')) : star,
    street ? null : h('span', { class: 'hud-shop-lock', attrs: { 'aria-hidden': 'true' } }, '🔒'));
    if (street) btn.setAttribute('aria-label', T('hud.street.overview'));
    chips.set(id, { btn, star });
    return btn;
  }
  const el = h('nav', { class: 'hud-shops', hidden: true, attrs: { 'aria-label': T('hud.street.overview') } }, chip('street'), SHOP_ORDER.map(chip));

  function tap(id) {
    const realm = ctx.realm;
    if (!realm || realm.switching || currentStep(ctx.store.state, 'cafe')) return; // the café tutorial owns the camera
    sfx('ui.open');
    hookFocus = id;
    realm.focusShop?.(id);
    const s = ctx.store.state;
    const sel = ctx.selection;
    if (id && id !== 'cafe' && !venueOpen(s, id)) {
      // Locked shop: zoom there and show its unlock card (price / level gate).
      ctx.showVenue?.(id);
    } else if (sel?.kind === 'venue' && sel.venue !== id) ctx.clearSelection?.();
    sig = ''; // repaint the highlight right away
  }

  // ---- data (store changes): ratings + locks ----
  let dataSig = '', eligible = false;
  function render(s) {
    eligible = level(s) >= FIRST_VENUE_LEVEL || SHOP_ORDER.some(id => id !== 'cafe' && venueOpen(s, id));
    const parts = [];
    for (const id of SHOP_ORDER) parts.push(`${id}:${venueOpen(s, id) ? 1 : 0}:${stars1(venueRating(s, id))}`);
    const next = parts.join('|');
    if (next === dataSig) return;
    dataSig = next;
    for (const id of SHOP_ORDER) {
      const c = chips.get(id);
      const open = venueOpen(s, id), avg = stars1(venueRating(s, id));
      const name = T(`venue.${id}`);
      c.btn.classList.toggle('is-locked', !open);
      setText(c.star, open ? `⭐${avg}` : T('hud.venue.locked'));
      c.btn.setAttribute('aria-label', open ? T('hud.rating.aria', { name, avg }) : `${name}: ${T('hud.venue.locked')}`);
    }
  }

  // ---- per frame: visibility + focused highlight ----
  let sig = '';
  function update() {
    const realm = ctx.realm;
    const show = eligible && !!realm && ctx.isPlaying() && realm.view === 'cafe' && !realm.switching && !currentStep(ctx.store.state, 'cafe');
    const focus = !show ? '' : (realm.focusedShop !== undefined ? realm.focusedShop : hookFocus) || 'street';
    const next = show ? focus : '-';
    if (next === sig) return;
    sig = next;
    el.hidden = !show;
    if (!show) return;
    for (const [id, c] of chips) {
      const on = id === focus;
      c.btn.classList.toggle('is-focus', on);
      if (on) c.btn.setAttribute('aria-current', 'true'); else c.btn.removeAttribute('aria-current');
    }
  }

  return {
    el, render, update,
    /** hooks.onShopFocus(id | null) from the realm (camera framed a shop / the street overview). */
    setFocus(id) { hookFocus = SHOP_ORDER.includes(id) ? id : null; sig = ''; },
    dispose() { chips.clear(); el.remove(); },
  };
}
