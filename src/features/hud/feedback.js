// Toasts, level-up banner and reactions to store events (served coins, harvested beans, built/bought…).
// Café street (docs/design/cafe-street.md §3.8): crowd incidents fire often, so most of them live as world speech
// bubbles (realm/speech.js) and only a throttled few reach a toast here:
//   venueOpened → celebration toast + level-up chime (the realm adds confetti);
//   customerLeft by reason → patience: the old angry / tired toasts; fight → "fought and left"; crowd (≥ 20 s apart);
//     switch / bar → "went to X" (≥ 10 s); closed → "Customers want X! Open it" hint (≥ 60 s; X = first locked
//     lemon / tea, the shops the director sends them to);
//   reviewed → crowd / closed reasons reuse those throttled toasts; else only ≤ 2★ or 5★, ≥ 8 s apart (5★ ≥ 30 s,
//     they come with nearly every quick serve), skipped right after a leave toast for the same reason; text =
//     shop name + stars + a street quote (realm.say.<situation>.<n>);
//   venueSale → no toast (coins fly from the vendor); counted per shop in ctx.venueSold for the venue card.
import { STAFF, SAY_VARIANTS, GOODS, RIVAL, BOOKS } from '../../core/config/economy.js';
import { venueOpen, defOf, nextLimitLevel } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { localItemsOf } from '../../ui/local-menu.js';
import { h } from './dom.js';
import { T, has, fmt, errorText, gmReasonText } from './text.js';
import { levelUnlocks } from './sheets.js';

const TOAST_MS = 2400, MAX_TOASTS = 3;
// What the toast / banner column must stay clear of. TOP: HUD sitting above it (its bottoms are the candidate tops);
// SOFT: a top blocker the column may cover when nothing else fits on screen (the café shop rail is a long strip);
// FLOOR: bottom-anchored bars / cards it should end above.
const HARD_TOP = '#hud-root .hud-player, #hud-root .hud-pills > *, #hud-root .hud-roundmap, #hud-root .hud-gear, #hud-root .hud-loan-btn, #hud-root .hud-auto-btn, #hud-root .hud-autobar, #hud-root .hud-tip';
const SOFT_TOP = '#hud-root .hud-shops';
const FLOOR_BLOCKERS = '#hud-root .hud-action, #hud-root .hud-land-chip, #hud-root .hud-toolbar';
const COL_MAX = 400, COL_GAP = 8;
// Staff stop kind → toast; staffLeft reason → tone; care kinds with their own toast (the unstopping ones get "Back to work").
const STOP_TOAST = { phone: 'hud.toast.staffPhone', battery: 'hud.toast.staffBattery', overheat: 'hud.toast.staffOverheat', jam: 'hud.toast.staffJam' };
const LEFT = { unpaid: 'bad', poached: 'bad', letGo: 'info', fired: 'info', sold: 'info' };
const CARE_TOAST = new Set(['coffee', 'food', 'lunch', 'bonus', 'rest', 'service']);
const unitName = (s, uid) => { const u = s?.staff?.units.find(x => x.uid === uid); return u ? u.name || T(`staff.${u.type}`) : T('hud.sm.someone'); };
const goodName = g => `${GOODS[g]?.icon || ''} ${T(`good.${g}`)}`.trim();

/**
 * Readable message for a failed ctx.act (Farm World 2.0 codes): fills what err.<code> wants from the action itself
 * (level gate of the type being built, the good a batch lacks, the level that allows more) before errorText.
 */
export function readableError(type, payload, result, s) {
  const code = result?.error;
  const data = { ...(result?.data || {}) };
  if (code === 'level' && /^build\//.test(type) && payload?.type) data.minLevel ??= defOf(payload.type)?.level;
  if (code === 'limit' && payload?.type && data.level === undefined && s) data.level = nextLimitLevel(s, payload.type);
  if (code === 'noInput' && data.need && GOODS[data.need]) data.need = data.amount ? `${fmt(data.amount)} ${goodName(data.need)}` : goodName(data.need);
  return errorText({ ...result, data });
}
// Minimum ms between toasts of one street kind.
const GAP = { crowd: 20000, closed: 60000, switch: 10000, review: 8000, review5: 30000 };
// Review reason → speech situation used as the quote (realm.say.<situation>.<n>). served picks by stars.
const QUOTE = { slow: 'slow', patience: 'patience', crowd: 'crowd', fight: 'fight', cut: 'cut', closed: 'closed', switch: 'slow', bar: 'toBar' };

export function createFeedback(ctx) {
  const toasts = h('div', { class: 'hud-toasts', attrs: { role: 'status', 'aria-live': 'polite' } });
  const banner = h('div', { class: 'hud-banner', hidden: true, attrs: { role: 'status' } });
  // Banner first, toasts under it, in one column: a level-up banner can never hide the toasts (or the reverse).
  const col = h('div', { class: 'hud-feedback-col' }, banner, toasts);
  const el = h('div', { class: 'hud-feedback' }, col);
  const timers = new Set();
  ctx.venueSold = ctx.venueSold || Object.create(null); // per-shop sales this session (venue card)
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  // Place the column under whatever HUD sits above it horizontally (pills, 🚂/⚙️/💰 column, ▶ Auto, café shop rail,
  // tutorial tip) on any screen size. Narrow phones: the column first narrows (down to minW) to slip between the
  // left pills / shop rail and the right buttons, and only drops lower when it cannot. Passes, best first:
  //   1. clear of everything and above the toolbar / action card;  2. may cover the shop rail, still above them;
  //   3. clear of the top HUD, over the card;  4. may cover the rail, over the card.
  // The top HUD always wins: a toast briefly over the card or the rail beats one over the coins or ▶ Auto.
  let colSig = '';
  const rectsOf = sel => [...document.querySelectorAll(sel)]
    .filter(n => n.offsetParent !== null || getComputedStyle(n).position === 'fixed')
    .map(n => n.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  function layout() {
    if (!el.isConnected || (banner.hidden && !toasts.childElementCount)) return;
    const vw = window.innerWidth || 0, vh = window.innerHeight || 0, cx = vw / 2;
    // A level-up banner squeezed beside the shop rail turns into a tall, cramped column: it may rather cover the rail
    // (pass 2) for its few seconds. Toasts alone are short and narrow down further.
    const maxW = Math.min(COL_MAX, vw - 24), minW = banner.hidden ? Math.min(220, Math.round(vw * .55)) : Math.min(260, vw - 24);
    const need = Math.max(36, col.offsetHeight);
    const hard = rectsOf(HARD_TOP), soft = rectsOf(SOFT_TOP), floors = rectsOf(FLOOR_BLOCKERS);
    const widthAt = (y, rects) => {
      if (y + need > vh - COL_GAP) return 0;                           // would run off the bottom of the screen
      let w = maxW;
      for (const r of rects) {
        if (r.bottom <= y || r.top >= y + need) continue;           // not beside the column at this height
        if (r.left < cx && r.right > cx) return 0;                   // straddles the centre: no room here
        w = Math.min(w, 2 * ((r.right <= cx ? cx - r.right : r.left - cx) - 6));
      }
      return w;
    };
    const ysOf = rects => [0, ...rects.map(r => Math.round(r.bottom + COL_GAP))].sort((a, b) => a - b);
    const passes = [[ysOf([...hard, ...soft]), [...hard, ...soft, ...floors]], [ysOf(hard), [...hard, ...floors]],
      [ysOf([...hard, ...soft]), [...hard, ...soft]], [ysOf(hard), hard]];
    const firstYs = passes[1][0];
    let y = firstYs[firstYs.length - 1], w = maxW, found = false; // nothing fits on screen: just under the top HUD
    for (const [ys, rects] of passes) {
      for (const cand of ys) { const cw = widthAt(cand, rects); if (cw >= minW) { y = cand; w = cw; found = true; break; } }
      if (found) break;
    }
    const sig = `${y}:${Math.floor(w)}`;
    if (sig === colSig) return;
    colSig = sig;
    col.style.setProperty('--fb-top', `${y}px`);
    col.style.setProperty('--fb-w', `${Math.floor(w)}px`);
  }

  function toast(text, tone = 'info') {
    if (!text) return;
    // Same text already showing → just bump it instead of stacking duplicates (e.g. drag-harvest errors).
    for (const node of toasts.children) if (node.textContent === text && !node.classList.contains('is-out')) return;
    const node = h('div', { class: `hud-toast hud-toast--${tone}` }, text);
    toasts.append(node);
    while (toasts.children.length > MAX_TOASTS) toasts.firstElementChild.remove();
    layout();
    later(() => { node.classList.add('is-out'); later(() => node.remove(), 300); }, TOAST_MS);
  }

  let bannerTimer = 0;
  // Phones: 3 unlocks + "+N" keep the banner small (the full list is in Progress); larger screens: up to 6.
  function bannerItems(unlocks) {
    const max = (window.innerWidth || 0) < 760 || (window.innerHeight || 0) < 561 ? 3 : 6;
    const shown = unlocks.length > max ? unlocks.slice(0, max - 1) : unlocks;
    const items = shown.map(u => h('li', null, u));
    if (unlocks.length > shown.length) items.push(h('li', { class: 'is-more' }, `+${unlocks.length - shown.length}`));
    return items;
  }
  function levelBanner(s, from, to) {
    const unlocks = [];
    for (let l = from + 1; l <= to; l++) unlocks.push(...levelUnlocks(s, l));
    banner.replaceChildren(h('strong', { class: 'hud-banner-title' }, T('hud.levelUp', { level: to })),
      unlocks.length ? h('div', { class: 'hud-banner-sub' }, T('hud.unlocked')) : null,
      unlocks.length ? h('ul', { class: 'hud-banner-list' }, bannerItems(unlocks)) : null);
    banner.hidden = false;
    layout();
    clearTimeout(bannerTimer);
    timers.delete(bannerTimer);
    bannerTimer = later(() => { banner.hidden = true; }, unlocks.length ? 4200 : 2600);
    sfx('reward.levelup');
  }

  // ---------- café street ----------
  const lastAt = Object.create(null);         // GAP kind → last toast time
  let lastLeave = '', lastLeaveAt = 0;        // reason of the last street leave toast (a review right after it is noise)
  const ready = (kind, now) => { if (now - (lastAt[kind] || 0) < GAP[kind]) return false; lastAt[kind] = now; return true; };
  const venueName = id => T(`venue.${id}`);
  const firstLocked = s => ['lemon', 'tea'].find(id => !venueOpen(s, id)) || null;
  const switchTarget = s => ['lemon', 'tea'].find(id => venueOpen(s, id)) || (venueOpen(s, 'bar') ? 'bar' : null);
  function quote(reason, stars) {
    const sit = reason === 'served' ? (stars >= 4 ? 'happy' : 'slow') : QUOTE[reason];
    const n = sit && SAY_VARIANTS[sit];
    if (!n) return '';
    const key = `realm.say.${sit}.${1 + Math.floor(Math.random() * n)}`;
    return has(key) ? T(key) : '';
  }
  function crowdToast(now) { if (ready('crowd', now)) toast(T('hud.toast.crowd'), 'warn'); }
  function closedToast(s, now) {
    const id = firstLocked(s);
    if (id && ready('closed', now)) toast(T('hud.toast.closed', { name: venueName(id) }), 'warn');
  }
  function left(s, ev, now) {
    const reason = ev.reason || 'patience';
    lastLeave = reason; lastLeaveAt = now;
    switch (reason) {
      case 'fight': toast(T('hud.toast.fight'), 'warn'); break; // both fighters leave: identical text is de-duplicated
      case 'crowd': crowdToast(now); break;
      case 'closed': closedToast(s, now); break;
      case 'switch': case 'bar': {
        const to = reason === 'bar' ? 'bar' : switchTarget(s);
        if (to && ready('switch', now)) toast(T('hud.toast.switch', { name: venueName(to) }), 'info');
        break;
      }
      default: toast(T(ev.angry ? 'hud.toast.customerAngry' : 'hud.toast.customerLeft'), ev.angry ? 'warn' : 'info');
    }
  }
  function reviewed(s, ev, now) {
    const stars = Number(ev.stars) || 0;
    if (ev.reason === 'crowd') { crowdToast(now); return; }   // the balk review is the crowd moment itself
    if (ev.reason === 'closed') { closedToast(s, now); return; }
    if (stars > 2 && stars < 5) return;
    if (ev.reason === lastLeave && now - lastLeaveAt < 3000) return;
    if (now - (lastAt.review || 0) < GAP.review) return;
    if (stars >= 5 && now - (lastAt.review5 || 0) < GAP.review5) return;
    lastAt.review = now;
    if (stars >= 5) lastAt.review5 = now;
    toast(T('hud.toast.review', { name: venueName(ev.venue), stars, quote: quote(ev.reason, stars) }), stars >= 5 ? 'good' : 'bad');
  }

  function onEvents(s, events = []) {
    const now = Date.now();
    const mixedSale = events.some(e => e.type === 'goodsSold' && !(e.parts || []).every(q => q.good === 'beans'));
    for (const ev of events) {
      // The general manager's own jobs stay quiet (its log in the Quản lý tab tells them); it speaks for requests,
      // poaching, leaving and money trouble below.
      if (ev.byGm) continue;
      switch (ev.type) {
        case 'levelUp': levelBanner(s, ev.from, ev.to); break;
        case 'gmHired': toast(T(ev.calmed ? 'hud.gm.toast.hiredCalm' : 'hud.gm.toast.hired', { name: ev.name }), 'good'); sfx('reward.quest'); break;
        case 'gmRequest': toast(T('hud.gm.toast.request', { name: ev.name, what: gmReasonText(ev.reason), coins: fmt(ev.cost) }), 'warn'); sfx('ui.deny'); break;
        case 'gmPoach': toast(T('hud.gm.toast.poach', { name: ev.name, rival: ev.rival, s: Math.round((ev.until - Date.now()) / 1000) }), 'bad'); sfx('ui.deny'); break;
        case 'gmRefused': toast(T('hud.gm.toast.refused', { name: ev.name, rival: ev.rival }), 'good'); break;
        case 'gmKept': toast(T('hud.gm.toast.kept', { name: ev.name }), 'good'); break;
        case 'gmLeft': toast(T(ev.chaos ? 'hud.gm.toast.leftChaos' : 'hud.gm.toast.left', { name: ev.name || '' }), ev.chaos ? 'bad' : 'info'); break;
        case 'followerKept': toast(T(ev.robot ? 'hud.follow.toastRobot' : 'hud.follow.toast', { name: ev.name || '' }), 'good'); break;
        case 'followerDebt': if (now - (lastAt.fDebt || 0) > 120000) { lastAt.fDebt = now; toast(T('hud.follow.debt', { coins: fmt(ev.coins), owed: fmt(ev.owed) }), 'warn'); } break;
        case 'trialDone': toast(T('hud.toast.trialDone', { n: ev.beans }), 'good'); break;
        case 'methodAdopted': toast(T('hud.toast.methodAdopted', { crop: T(`crop.${ev.crop}`) }), 'good'); break;
        case 'scoutDone': toast(T('hud.sup.toast.scoutDone', { what: T(ev.group === 'buyers' ? 'hud.sup.buyers' : `hud.sup.g.${ev.group}`) }), 'good'); break;
        case 'beansLate': toast(T('hud.sup.toast.late', { n: ev.amount, s: ev.seconds }), 'warn'); break;
        case 'beansArrived': toast(T('hud.sup.toast.arrived', { n: ev.amount }), 'good'); break;
        case 'contractSigned': toast(T('hud.sup.toast.signed', { name: ev.name, n: ev.days }), 'good'); break;
        case 'buyerLocked': toast(T('hud.sup.toast.locked', { n: ev.days }), 'good'); break;
        case 'ingredientOut': if (now - (lastAt.ingOut || 0) > 30000) { lastAt.ingOut = now; toast(T('hud.sup.toast.out'), 'warn'); } break;
        case 'recipeFound': { const it = localItemsOf(`${ev.cc}-1`, ev.base).find(x => x.index === ev.index); toast(T('hud.toast.recipeFound', { name: it?.name || '' }), 'good'); sfx('reward.quest'); break; }
        case 'gmCalmed': toast(T('hud.gm.toast.calmed'), 'good'); break;
        case 'gmMood': toast(T(`hud.gm.toast.mood.${ev.why}`, { name: ev.name }), 'warn'); break;
        case 'gmAway': toast(T(ev.net >= 0 ? 'hud.gm.toast.away' : 'hud.gm.toast.awayLoss', { name: ev.name, min: ev.minutes, earned: fmt(ev.earned), salary: fmt(ev.salary), net: fmt(Math.abs(ev.net)) }), ev.net >= 0 ? 'good' : 'warn'); if (ev.net > 0) sfx('coin.gain'); break;
        case 'gmMissedYou': toast(T('hud.gm.toast.missedYou', { name: ev.name, hours: ev.hours, drop: ev.drop }), 'warn'); break;
        case 'gmUnpaid': toast(T('hud.gm.toast.unpaid', { name: ev.name, coins: fmt(ev.coins) }), 'warn'); break;
        case 'gmFailed': toast(T('hud.gm.toast.failed', { what: gmReasonText(ev.reason) }), 'warn'); break;
        // served / harvested: the realm flies the coins/beans from the world spot to #hud-coins / #hud-beans.
        case 'built': toast(T('hud.toast.built', { name: T(`building.${ev.building}`), icon: defOf(ev.building)?.icon || '' }), 'good'); break;
        case 'fieldPlaced': toast(`🟫 ${T('fw.toast.fieldPlaced')}`, 'good'); break;
        case 'moved': toast(T('hud.toast.moved'), 'info'); break;
        case 'removed': toast(T('fw.toast.removed', { refund: ev.refund > 0 ? fmt(ev.refund) : 0 }), 'info'); if (ev.refund > 0) sfx('coin.gain'); break;
        case 'prodCollected': {
          const parts = Object.entries(ev.out || {}).filter(([, n]) => n > 0).map(([g, n]) => T('fw.toast.collected', { n: fmt(n), good: goodName(g) }));
          if (parts.length) toast(parts.join(' · '), 'good');
          break;
        }
        // Beans only: the beansSold toast says it ("Sold 12 beans…"); any processed good → one "Sold for N" toast.
        case 'goodsSold': if (!(ev.parts || []).every(q => q.good === 'beans')) { toast(T('fw.toast.sold', { coins: fmt(ev.coins) }), 'good'); sfx('coin.gain'); } break;
        case 'upgraded': toast(T('hud.toast.upgraded', { name: T(`building.${ev.building}`), level: ev.level }), 'good'); break;
        case 'parcelBought': toast(T('hud.toast.parcel'), 'good'); break;
        case 'beansSold': if (mixedSale) break; toast(T('hud.toast.beansSold', { n: ev.amount, coins: ev.coins }), 'good'); sfx('coin.gain'); break;
        case 'beansBought': toast(T(ev.free ? 'hud.toast.beansFree' : 'hud.toast.beansBought', { n: ev.amount, coins: ev.cost }), 'good'); break;
        case 'hired': toast(T(!ev.assigned ? 'hud.toast.hiredIdle' : ev.active === false ? 'hud.toast.hiredBench' : 'hud.toast.hired', { name: ev.name ? `${ev.name} (${T(`staff.${ev.staff}`)})` : T(`staff.${ev.staff}`), icon: STAFF[ev.staff]?.icon || '' }), 'good'); break;
        case 'reborn': toast(T('hud.toast.reborn', { blessing: T(`blessing.${ev.blessing}`) }), 'good'); break;
        case 'creditsGranted': case 'creditsAdded': toast(T('hud.toast.credits', { n: ev.amount }), 'good'); break;
        case 'staffStopped': toast(T(STOP_TOAST[ev.kind] || 'hud.toast.staffPhone', { name: unitName(s, ev.uid), fee: ev.fee }), 'warn'); break;
        case 'loanRepaid': toast(T('hud.toast.loanDone'), 'good'); break;
        case 'staffReady': toast(T('hud.toast.staffReady', { name: ev.name || T(`staff.${ev.staff}`) }), 'info'); break;
        case 'statUpgraded': toast(T('hud.toast.statUp', { name: ev.name || T(`staff.${ev.staff}`), stat: T(`hud.stat.${ev.stat}`), to: ev.to }), 'good'); break;
        // Staff manager (docs/design/staff-manager.md §7–8): rivals, leaving, MVP, care, shifts, unpaid bench upkeep.
        case 'staffLeft': toast(T(`hud.toast.left.${LEFT[ev.reason] ? ev.reason : 'fired'}`, { name: ev.name || T(`staff.${ev.staff}`), coins: fmt(ev.refund || 0) }), LEFT[ev.reason] || 'info'); if (ev.refund > 0) sfx('coin.gain'); break;
        case 'poachStarted': toast(T('hud.toast.poach', { rival: ev.rival || '', name: ev.name || unitName(s, ev.uid), s: RIVAL.keepSeconds }), 'warn'); sfx('ui.deny'); break;
        case 'poachRefused': toast(T('hud.toast.poachRefused', { rival: ev.rival || '', name: ev.name || unitName(s, ev.uid) }), 'good'); break;
        case 'poachKept': toast(T('hud.toast.kept', { name: unitName(s, ev.uid) }), 'good'); break;
        case 'mvp': toast(T('hud.toast.mvp', { name: ev.name || unitName(s, ev.uid), coins: fmt(ev.earned), min: BOOKS.mvpMinutes }), 'good'); sfx('reward.quest'); break;
        case 'staffCared': if (ev.kind === 'nag') toast(T(ev.ok ? 'hud.toast.nagOk' : 'hud.toast.nagNo', { name: unitName(s, ev.uid) }), ev.ok ? 'good' : 'warn');
          else if (CARE_TOAST.has(ev.kind)) toast(T(`hud.toast.care.${ev.kind}`, { name: unitName(s, ev.uid) }), 'good');
          break;
        case 'shiftSwapped': toast(T('hud.toast.shift', { out: ev.out?.length || 0, in: ev.in?.length || 0 }), 'info'); break;
        case 'upkeepPaid': if (ev.unpaid?.length) toast(T('hud.toast.unpaid', { n: ev.unpaid.length }), 'warn'); break;
        case 'partUpgraded': toast(T('hud.toast.partUpgraded', { part: T(`hud.staff.part.${ev.part}`), tier: ev.tier }), 'good'); break;
        case 'tendStarted': toast(T('hud.toast.tend', { n: ev.plots }), 'good'); break;
        case 'staffResumed': if (!(ev.kind === 'overheat' && !ev.fee)) toast(T('hud.toast.staffBack'), 'good'); break; // a cool-down that ends by itself is no news
        case 'customerLeft': left(s, ev, now); break;
        case 'venueOpened': toast(`🎉 ${T('hud.venue.opened', { name: venueName(ev.venue) })}`, 'good'); sfx('reward.levelup'); break;
        case 'venueSale': if (ev.venue) ctx.venueSold[ev.venue] = (ctx.venueSold[ev.venue] || 0) + 1; break;
        case 'reviewed': reviewed(s, ev, now); break;
        default: break;
      }
    }
  }

  return { el, toast, onEvents, layout, bannerShowing: () => !banner.hidden, dispose() { for (const id of timers) clearTimeout(id); timers.clear(); el.remove(); } };
}
