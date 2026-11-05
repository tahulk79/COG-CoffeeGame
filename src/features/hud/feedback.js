// Toasts, level-up banner and reactions to store events (served coins, harvested beans, built/bought…).
import { BUILDINGS, STAFF } from '../../core/config/economy.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T } from './text.js';
import { levelUnlocks } from './sheets.js';

const TOAST_MS = 2400, MAX_TOASTS = 3;

export function createFeedback(ctx) {
  const toasts = h('div', { class: 'hud-toasts', attrs: { role: 'status', 'aria-live': 'polite' } });
  const banner = h('div', { class: 'hud-banner', hidden: true, attrs: { role: 'status' } });
  const el = h('div', { class: 'hud-feedback' }, toasts, banner);
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  function toast(text, tone = 'info') {
    if (!text) return;
    // Same text already showing → just bump it instead of stacking duplicates (e.g. drag-harvest errors).
    for (const node of toasts.children) if (node.textContent === text && !node.classList.contains('is-out')) return;
    const node = h('div', { class: `hud-toast hud-toast--${tone}` }, text);
    toasts.append(node);
    while (toasts.children.length > MAX_TOASTS) toasts.firstElementChild.remove();
    later(() => { node.classList.add('is-out'); later(() => node.remove(), 300); }, TOAST_MS);
  }

  let bannerTimer = 0;
  function levelBanner(s, from, to) {
    const unlocks = [];
    for (let l = from + 1; l <= to; l++) unlocks.push(...levelUnlocks(s, l));
    banner.replaceChildren(h('strong', { class: 'hud-banner-title' }, T('hud.levelUp', { level: to })),
      unlocks.length ? h('div', { class: 'hud-banner-sub' }, T('hud.unlocked')) : null,
      unlocks.length ? h('ul', { class: 'hud-banner-list' }, unlocks.slice(0, 6).map(u => h('li', null, u))) : null);
    banner.hidden = false;
    clearTimeout(bannerTimer);
    timers.delete(bannerTimer);
    bannerTimer = later(() => { banner.hidden = true; }, unlocks.length ? 4200 : 2600);
    sfx('reward.levelup');
  }

  function onEvents(s, events = []) {
    for (const ev of events) {
      switch (ev.type) {
        case 'levelUp': levelBanner(s, ev.from, ev.to); break;
        // served / harvested: the realm flies the coins/beans from the world spot to #hud-coins / #hud-beans.
        case 'built': toast(T('hud.toast.built', { name: T(`building.${ev.building}`), icon: BUILDINGS[ev.building]?.icon || '' }), 'good'); break;
        case 'moved': toast(T('hud.toast.moved'), 'info'); break;
        case 'upgraded': toast(T('hud.toast.upgraded', { name: T(`building.${ev.building}`), level: ev.level }), 'good'); break;
        case 'parcelBought': toast(T('hud.toast.parcel'), 'good'); break;
        case 'roadOpened': toast(T('hud.toast.road'), 'good'); break;
        case 'hired': toast(T(ev.assigned ? 'hud.toast.hired' : 'hud.toast.hiredIdle', { name: T(`staff.${ev.staff}`), icon: STAFF[ev.staff]?.icon || '' }), 'good'); break;
        case 'roundUnlocked': toast(T('hud.toast.round', { round: ev.round }), 'good'); sfx('reward.levelup'); break;
        case 'countryUnlocked': toast(T('hud.toast.country'), 'good'); break;
        case 'reborn': toast(T('hud.toast.reborn', { blessing: T(`blessing.${ev.blessing}`) }), 'good'); break;
        case 'creditsGranted': case 'creditsAdded': toast(T('hud.toast.credits', { n: ev.amount }), 'good'); break;
        case 'customerLeft': toast(T('hud.toast.customerLeft'), 'info'); break;
        default: break;
      }
    }
  }

  return { el, toast, onEvents, dispose() { for (const id of timers) clearTimeout(id); timers.clear(); el.remove(); } };
}
