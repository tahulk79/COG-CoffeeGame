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
import { STAFF, SAY_VARIANTS, GOODS, RIVAL, BOOKS, EXPIRY_LEVEL, EXPIRY_ENABLED, GM, LOAN, TASKS } from '../../core/config/economy.js';
import { venueOpen, defOf, nextLimitLevel } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { localItemsOf } from '../../ui/local-menu.js';
import { h } from './dom.js';
import { T, has, fmt, errorText, gmReasonText } from './text.js';
import { levelUnlockCards, questText } from './sheets.js';
import { modelIcon } from './model-icons.js';

const TOAST_MS = 2400, MAX_TOASTS = 3;
// Notices live in the left corner: under the top bar and the left-hand buttons, so the middle of the farm stays clear.
const LEFT_STACK = '#hud-root .hud-top, #hud-root #hud-btn-loan, #hud-root #hud-btn-gifts, #hud-root .hud-shops';
const COL_GAP = 8;
// Staff stop kind → toast; staffLeft reason → tone; care kinds with their own toast (the unstopping ones get "Back to work").
const STOP_TOAST = { phone: 'hud.toast.staffPhone', battery: 'hud.toast.staffBattery', overheat: 'hud.toast.staffOverheat', jam: 'hud.toast.staffJam' };
const LEFT = { stress: 'bad', unpaid: 'bad', poached: 'bad', letGo: 'info', fired: 'info', sold: 'info' };
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
  const col = h('div', { class: 'hud-feedback-col' }, toasts);
  const el = h('div', { class: 'hud-feedback' }, col, banner); // the level-up covers the whole screen, so it sits outside the toast column
  const timers = new Set();
  ctx.venueSold = ctx.venueSold || Object.create(null); // per-shop sales this session (venue card)
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  let colSig = '';
  const rectsOf = sel => [...document.querySelectorAll(sel)]
    .filter(n => n.offsetParent !== null || getComputedStyle(n).position === 'fixed')
    .map(n => n.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  function layout() {
    if (!el.isConnected || !toasts.childElementCount) return;
    const vw = window.innerWidth || 0, vh = window.innerHeight || 0, need = Math.max(36, col.offsetHeight);
    const below = Math.max(0, ...rectsOf(LEFT_STACK).filter(r => r.left < vw / 2).map(r => r.bottom)) + COL_GAP;
    const y = Math.round(Math.max(COL_GAP, Math.min(below, vh - COL_GAP - need))), sig = String(y); // a low screen: stays on it
    if (sig === colSig) return;
    colSig = sig;
    col.style.setProperty('--fb-top', `${y}px`);
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
  // The celebration waits while the player is planting or placing something: it must never interrupt a row. Auto only gets a toast.
  let heldLevels = null;
  function levelBanner(s, from, to) {
    if (ctx.isAuto?.()) { ctx.toast(T('hud.levelUp', { level: to }), 'good'); sfx('reward.levelup'); return; }
    if (ctx.realm?.planting || ctx.realm?.placement) {
      if (!heldLevels) later(flushLevels, 400);
      heldLevels = { from: Math.min(heldLevels?.from ?? from, from), to: Math.max(heldLevels?.to ?? to, to) };
      return;
    }
    showLevel(s, from, to);
  }
  function flushLevels() {
    if (!heldLevels) return;
    if (ctx.realm?.planting || ctx.realm?.placement) { later(flushLevels, 400); return; }
    const { from, to } = heldLevels;
    heldLevels = null;
    showLevel(ctx.store.state, from, to);
  }
  function showLevel(s, from, to) {
    const unlocks = [];
    for (let l = from + 1; l <= to; l++) unlocks.push(...levelUnlockCards(s, l));
    const tile = (u, i) => {
      const ico = h('span', { class: 'hud-lvup-tile-ico', attrs: { 'aria-hidden': 'true' } }, u.icon);
      if (u.model) modelIcon(u.model).then(url => { if (url) ico.replaceChildren(Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false })); });
      return h('div', { class: `hud-lvup-tile is-${i}` }, ico, h('strong', null, u.name));
    };
    const close = () => { clearTimeout(bannerTimer); timers.delete(bannerTimer); banner.hidden = true; };
    banner.replaceChildren(...[h('span', { class: 'hud-lvup-rays', attrs: { 'aria-hidden': 'true' } }), h('span', { class: 'hud-lvup-conf', attrs: { 'aria-hidden': 'true' } }),
      h('strong', { class: 'hud-banner-title' }, T('hud.levelUpShort')),
      h('div', { class: 'hud-lvup-star' }, h('b', null, String(to))),
      unlocks.length ? h('div', { class: 'hud-lvup-tiles' }, ...unlocks.slice(0, 2).map(tile)) : null,
      EXPIRY_ENABLED && !s.story.level10Done && to < EXPIRY_LEVEL && EXPIRY_LEVEL - to <= 3 ? h('div', { class: 'hud-banner-warn' }, T('hud.lv10.banner', { n: EXPIRY_LEVEL - to, level: EXPIRY_LEVEL })) : null,
      h('button', { type: 'button', class: 'hud-btn hud-btn--go hud-lvup-go', on: { click: close } }, h('span', { class: 'hud-btn-main' }, T('hud.gift.collect')))].filter(Boolean));
    banner.hidden = false;
    layout();
    clearTimeout(bannerTimer);
    timers.delete(bannerTimer);
    bannerTimer = later(() => { banner.hidden = true; }, 7000);
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
      if (ev.byGm || ev.byAuto) continue; // Auto nông trại works quietly too: the green rail button shows it is on
      switch (ev.type) {
        case 'autoStopped': if (ev.reason === 'timeout') { toast(T('hud.toast.autoEnd', { n: fmt(ev.jobs || 0), earned: fmt(ev.earned || 0), spent: fmt(ev.spent || 0) }), 'warn'); sfx('reward.quest'); } break;
        case 'autoSold': toast(T('hud.toast.autoSold', { coins: fmt(ev.coins) }), 'good'); break;
        case 'autoQuest': case 'questClaimed': toast(T(ev.type === 'autoQuest' ? 'hud.toast.autoQuest' : 'hud.toast.questClaimed', { text: questText(ev), coins: fmt(ev.coins) }), 'good'); sfx('reward.quest'); break;
        case 'levelUp': levelBanner(s, ev.from, ev.to); break;
        case 'gmHired': toast(T(ev.calmed ? 'hud.gm.toast.hiredCalm' : 'hud.gm.toast.hired', { name: ev.name }), 'good'); sfx('reward.quest'); break;
        case 'gmRequest': toast(T('hud.gm.toast.request', { name: ev.name, what: gmReasonText(ev.reason), coins: fmt(ev.cost) }), 'warn'); sfx('ui.deny'); break;
        case 'gmPoach': toast(T('hud.gm.toast.poach', { name: ev.name, rival: ev.rival, s: ev.seconds ?? TASKS.life.gmPoach * 60 }), 'bad'); sfx('ui.deny'); break;
        // The inbox (management-rules §4): reminders, expiries with their penalty, the return summary, the manager's states.
        case 'taskRemind': if (ev.by === 'g1') toast(T(ev.last ? 'hud.inbox.toast.remindLast' : 'hud.inbox.toast.remind', { what: gmReasonText(ev.reason), min: Math.max(1, Math.ceil(ev.leftMs / 60000)) }), ev.last ? 'bad' : 'warn'); break;
        case 'taskExpired': if (!TASKS.noPenaltyKinds.includes(ev.kind)) toast(ev.fine > 0 ? T('hud.inbox.toast.expiredFine', { what: gmReasonText(ev.reason), coins: fmt(ev.fine) }) : T('hud.inbox.toast.expired', { what: gmReasonText(ev.reason) }), 'bad'); break;
        case 'tasksWaiting': toast(ev.name ? T('hud.inbox.toast.waiting', { name: ev.name, n: ev.n }) : T('hud.inbox.toast.waitingTeam', { n: ev.n }), 'warn'); break;
        case 'gmWaiting': toast(T('hud.inbox.toast.gmWaiting', { name: ev.name || '' }), 'warn'); break;
        case 'gmStrike': toast(T('hud.inbox.toast.strike', { name: ev.name || '' }), 'bad'); sfx('ui.deny'); break;
        case 'gmStrikeOver': toast(T('hud.inbox.toast.strikeOver', { name: ev.name || '' }), 'good'); break;
        case 'gmLater': if (now - (lastAt.gmLater || 0) > 60000) { lastAt.gmLater = now; toast(T('hud.inbox.toast.later', { name: ev.name || '' }), 'info'); } break;
        // planner v2 (management-rules §3.4–§3.7)
        // coffee varieties: what the player's own pick lost or left on the plant (staff picks stay quiet)
        case 'harvested':
          if (ev.by != null) break;
          if (ev.dropped) { if (now - (lastAt.dropped || 0) > 3000) { lastAt.dropped = now; toast(T('hud.toast.dropped', { crop: T(`crop.${ev.crop}`), n: ev.dropped }), 'warn'); } }
          else if (ev.lonely && now - (lastAt.lonely || 0) > 60000) { lastAt.lonely = now; toast(T('hud.toast.lonely'), 'info'); }
          else if (ev.wave === 1 && now - (lastAt.wave1 || 0) > 3000) { lastAt.wave1 = now; toast(T('hud.toast.wave1', { crop: T(`crop.${ev.crop}`) }), 'info'); }
          break;
        case 'harvestedAll': toast(T(ev.full ? 'hud.harvestAll.full' : 'hud.harvestAll.done', { n: fmt(ev.n) }), ev.full ? 'warn' : 'good'); break;
        case 'pruned': toast(T('hud.toast.pruned'), 'good'); break;
        case 'uprooted': toast(T('hud.toast.uprooted'), 'info'); break;
        case 'specialtyBonus': if (now - (lastAt.specialty || 0) > 30000) { lastAt.specialty = now; toast(T('hud.toast.specialty', { coins: fmt(ev.coins) }), 'good'); } break;
        case 'licenceBought': toast(T('hud.gm.toast.licence', { lic: T(`hud.gm.lic.${ev.group}`) }), 'good'); break;
        case 'gmTraining': toast(T('hud.gm.toast.training', { name: ev.name || '', skill: ev.to, min: ev.minutes }), 'info'); break;
        case 'gmTrained': toast(T('hud.gm.toast.trained', { name: ev.name || '', skill: ev.skill }), 'good'); sfx('reward.quest'); break;
        case 'parcelSold': toast(T('hud.gm.toast.landSold', { lot: ev.parcelId, coins: fmt(ev.refund) }), 'info'); break;
        case 'topUpSeen': toast(T('hud.gm.toast.topUpSeen'), 'info'); break;
        case 'gmApologised': toast(T('hud.inbox.toast.apologised', { name: ev.name || '' }), 'good'); break;
        case 'gmRefused': toast(T('hud.gm.toast.refused', { name: ev.name, rival: ev.rival }), 'good'); break;
        case 'gmKept': toast(T('hud.gm.toast.kept', { name: ev.name }), 'good'); break;
        case 'gmLeft': toast(T(ev.chaos ? 'hud.gm.toast.leftChaos' : ev.why === 'quit' ? 'hud.gm.toast.quit' : 'hud.gm.toast.left', { name: ev.name || '', n: GM.quitArrearsSalaries }), ev.chaos || ev.why === 'quit' ? 'bad' : 'info'); break;
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
        case 'gmUnpaid': toast(T('hud.gm.toast.unpaid', { name: ev.name, coins: fmt(ev.coins), owed: fmt(Math.ceil(ev.owed || ev.coins)) }), 'warn'); break;
        case 'loanLate': toast(T('hud.toast.loanLate', { owed: fmt(Math.ceil(ev.owed)), pct: Math.round(LOAN.lateFee * 100) }), 'bad'); break;
        case 'gmFailed': toast(T('hud.gm.toast.failed', { what: gmReasonText(ev.reason) }), 'warn'); break;
        // served / harvested: the realm flies the coins/beans from the world spot to #hud-coins / #hud-beans.
        case 'built': toast(T('hud.toast.built', { name: T(`building.${ev.building}`), icon: defOf(ev.building)?.icon || '' }), 'good'); break;
        case 'rowPlanted': toast(T('hud.plantRow.done', { n: ev.n, coins: ev.cost }), 'good'); break;
        case 'fieldPlaced': break; // (planting places a bed and sows it in one go: no "new field ready" notice)
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
        case 'staffStopped': if (ev.kind === 'funny') break; toast(T(STOP_TOAST[ev.kind] || 'hud.toast.staffPhone', { name: unitName(s, ev.uid), fee: ev.fee }), 'warn'); break;
        case 'loanRepaid': toast(T('hud.toast.loanDone'), 'good'); break;
        case 'staffReady': toast(T('hud.toast.staffReady', { name: ev.name || T(`staff.${ev.staff}`) }), 'info'); break;
        case 'statUpgraded': toast(T('hud.toast.statUp', { name: ev.name || T(`staff.${ev.staff}`), stat: T(`hud.stat.${ev.stat}`), to: ev.to }), 'good'); break;
        // Staff manager (docs/design/staff-manager.md §7–8): rivals, leaving, MVP, care, shifts, unpaid bench upkeep.
        case 'staffCheckup': if (!ev.byGm) toast(T('hud.toast.checkup', { name: ev.name || '', grade: ev.grade }), 'good'); break;
        case 'staffDisciplined': if (ev.worst) toast(T('hud.toast.discipline', { best: ev.best || '', worst: ev.worst, coins: fmt(ev.coins) }), 'info'); break;
        case 'staffLeft': toast(T(`hud.toast.left.${LEFT[ev.reason] ? ev.reason : 'fired'}`, { name: ev.name || T(`staff.${ev.staff}`), coins: fmt(ev.refund || 0) }), LEFT[ev.reason] || 'info'); if (ev.refund > 0) sfx('coin.gain'); break;
        case 'poachStarted': toast(T('hud.toast.poach', { rival: ev.rival || '', name: ev.name || unitName(s, ev.uid), s: ev.seconds ?? TASKS.life.poach * 60 }), 'warn'); sfx('ui.deny'); break;
        case 'poachRefused': toast(T('hud.toast.poachRefused', { rival: ev.rival || '', name: ev.name || unitName(s, ev.uid) }), 'good'); break;
        case 'poachKept': toast(T('hud.toast.kept', { name: unitName(s, ev.uid) }), 'good'); break;
        case 'mvp': toast(T('hud.toast.mvp', { name: ev.name || unitName(s, ev.uid), coins: fmt(ev.earned), min: BOOKS.mvpMinutes }), 'good'); sfx('reward.quest'); break;
        case 'staffCared': if (ev.kind === 'nag') toast(T(ev.ok ? 'hud.toast.nagOk' : 'hud.toast.nagNo', { name: unitName(s, ev.uid) }), ev.ok ? 'good' : 'warn');
          else if (CARE_TOAST.has(ev.kind)) toast(T(`hud.toast.care.${ev.kind}`, { name: unitName(s, ev.uid) }), 'good');
          break;
        case 'shiftSwapped': toast(T('hud.toast.shift', { out: ev.out?.length || 0, in: ev.in?.length || 0 }), 'info'); break;
        case 'upkeepPaid': if (ev.unpaid?.length) toast(T('hud.toast.unpaid', { n: ev.unpaid.length }), 'warn'); break;
        case 'partUpgraded': toast(T('hud.toast.partUpgraded', { part: T(`hud.staff.part.${ev.part}`), tier: ev.tier }), 'good'); break;
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
