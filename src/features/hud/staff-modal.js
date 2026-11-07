// Staff manager: a full modal (docs/design/staff-manager.md §10), one per game (the zone of the screen shown: farm
// staff on the farm, café staff in the café). Replaces the old staff bottom sheet.
//  · sticky header: title, "Đang làm 3/3 · Dự bị 2 · Nuôi 🪙30 / 10 phút · Đội kiếm 🪙420 / 10 phút", × close,
//    the rival's poach banner (Giữ lại / Cho đi) and the tabs Đội · Tuyển dụng · Báo cáo;
//  · Đội: filter chips, bulk «Xử lý tất cả» + «Đổi ca», one card per unit (state, report, bars, quick fix) → Detail;
//  · Detail (← back): state + care buttons, 📍 Xem ở đâu, on shift / bench, tasks, 4 stats or robot parts, today's
//    book, how it works, fire / sell;
//  · 📍 Xem ở đâu collapses the modal to a bottom strip (name, state, fix, «Mở lại») while the camera shows the unit.
// The realm changes vitals and jobs without store events, so the open modal refreshes every second; a refresh only
// swaps the DOM when what it shows changed (never while a finger is down) and keeps each screen's scroll position.
import { STAFF, STAFF_ORDER, TRAITS, RECRUIT, ROBOT_TASKS, ROBOT_PARTS, PART_ORDER, PART_COST, WORKER_TASKS, TASK_LIMIT, SMART_RULES, QUALITY, TEND, MISTAKES, STAFF_BREAKS, SKILL, RARE, STAT_ORDER, LEVEL_STEP, VITALS, UPKEEP, RIVAL, BOOKS, ROBOT_WEAR, CARE, statOf, statCap, taskLimit, energyMax, unitLevel, mistakeChance, hasRule, batteryMinutes, slackMul, partTier, robotTask, heatPerMin, jamChance, isHardDrink } from '../../core/config/economy.js';
import { region, regionGame, level, hireCap, hireCapReached, slots, activeCount, freeSlots, zoneUnits, staffError, freeHire, applicants, recruitError, poolRefreshIn, unitStars, unitOf, statError, statPrice, partError, partPrice, unitState, careCost, careError, quickFix, upkeepOf, upkeepPer, fireRefund, ledgerWindow, unitProfit, poachOf, canBrew } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, fmt } from './text.js';
import { staffEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';

const REFRESH_MS = 1000;
const isRobot = u => STAFF[u?.type]?.kind === 'robot';
const nameOf = u => (u?.name ? u.name : T(`staff.${u?.type || 'farmhand'}`));
const ZONE_RULES = { shop: ['urgent', 'twoCups', 'chain', 'restock'], farm: ['ripeFirst', 'playerCrop', 'quick', 'twoPlots'] };
const ZONE_MISTAKES = { shop: ['spill', 'wrongTable'], farm: ['unripe', 'crooked'] };
const STAT_ICON = { speed: '⚡', smart: '🧠', accuracy: '🎯', stamina: '💪' };
const PERK_ICON = { goldHands: '🖐️', swift: '💨', tireless: '🔋', charming: '😍' };
const PERK_FX = { speed: RARE.swiftSpeed, pct: Math.round(RARE.charmingBonus * 100), drain: Math.round((1 - RARE.tirelessDrain) * 100) };
// Shown state of a unit (the core's unitState plus where it is and the zero-energy / zero-food stops).
const STATE_ICON = { phone: '📱', battery: '🪫', overheat: '🔥', jam: '⚙️', lunch: '🍽️', sulking: '😤', hungry: '🍔', tired: '😮‍💨',
  exhausted: '😵', starving: '🍔', worn: '🔧', bench: '🪑', ok: '🙂', unassigned: '💤', elsewhere: '🗺️' };
const BLOCKING = new Set(['phone', 'battery', 'overheat', 'jam', 'sulking', 'exhausted', 'starving']);
const SLOW = new Set(['tired', 'hungry', 'worn']);
const CARE_ICON = { nag: '🗣️', bonusSmall: '💵', coffee: '☕', food: '🍔', lunch: '🍽️', bonus: '🎁', rest: '🪑', recharge: '⚡', cool: '❄️', repair: '🔧', service: '🛠️', tend: '💧' };
const WORKER_CARE = ['nag', 'bonusSmall', 'coffee', 'food', 'lunch', 'bonus', 'rest'];
const ROBOT_CARE = ['recharge', 'cool', 'repair', 'service'];
const JOB_ICON = { harvest: '🌾', plant: '🌱', water: '💧', order: '🧾', brew: '☕', deliver: '🚶' };
const REASON_ICON = { growing: '⏳', storageFull: '📦', noSeeds: '💸', noPlots: '🏞️', fieldsFull: '🌱', noCustomers: '🚪', noSeat: '🪑', noBeans: '🫘', hard: '🍮', paused: '⏸️', noWork: '⏳' };
const JOURNAL_ICON = { slacked: '📱', nagged: '🗣️', cared: '💝', upgraded: '⬆️', hired: '🤝', benched: '🪑', activated: '▶️', poachStarted: '💼', poachRefused: '🙅', kept: '🤝', left: '👋', jam: '⚙️', overheat: '🔥' };

export function createStaffModal(ctx) {
  const store = ctx.store;
  const st = { open: false, tab: 'team', filter: 'all', uid: null, collapsed: false };
  const scrollMem = Object.create(null); // screen key → body scrollTop
  let timer = null, pressing = false, pending = false, refreshingPool = false;

  const title = h('h2', { id: 'hud-sm-title', class: 'hud-sm-title' });
  const back = h('button', { type: 'button', class: 'hud-sm-back', hidden: true, attrs: { 'aria-label': T('hud.sm.back') }, on: { click: () => goBack() } }, '←');
  const close = h('button', { type: 'button', class: 'hud-x', attrs: { 'aria-label': T('hud.close') }, on: { click: () => api.close() } }, '×');
  const summary = h('div', { class: 'hud-sm-summary' });
  const banner = h('div', { class: 'hud-sm-poach-slot' });
  const tabs = h('div', { class: 'hud-sm-tabs-slot' });
  const head = h('header', { class: 'hud-sm-head' }, h('div', { class: 'hud-sm-titlebar' }, back, title, close), summary, banner, tabs);
  const body = h('div', { class: 'hud-sm-body' });
  const panel = h('section', { class: 'hud-sm', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hud-sm-title' } }, head, body);
  const scrim = h('div', { class: 'hud-sm-scrim', on: { click: () => api.close() } });
  const strip = h('div', { class: 'hud-sm-strip', hidden: true, attrs: { role: 'status' } });
  const el = h('div', { class: 'hud-sm-host', hidden: true }, scrim, panel, strip);

  // A refresh never swaps a button under the finger: it waits for the pointer to lift.
  const down = () => { pressing = true; };
  const up = () => { if (!pressing) return; pressing = false; if (pending) { pending = false; paint(); } };
  el.addEventListener('pointerdown', down);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);

  const zoneNow = () => (ctx.realm?.view ? (ctx.realm.view === 'cafe' ? 'shop' : 'farm') : regionGame(store.state) === 'cafe' ? 'shop' : 'farm');
  const screenKey = () => (st.uid ? `unit:${st.uid}` : `tab:${st.tab}:${st.filter}`);
  const act = (type, payload) => ctx.act(type, payload);
  const rerender = () => paint(true);

  // Replaces a container's content only when the new tree differs (handlers read live state at click time).
  function swap(container, node) {
    const only = container.childNodes.length === 1 ? container.firstChild : null;
    if (node && only && typeof only.isEqualNode === 'function' && only.isEqualNode(node)) return false;
    if (node) container.replaceChildren(node); else container.replaceChildren();
    return true;
  }

  function paint(force = false) {
    if (!st.open) return;
    if (pressing && !force) { pending = true; return; }
    const s = store.state, now = Date.now(), zone = zoneNow();
    if (st.uid && !unitOf(s, st.uid)) { st.uid = null; st.collapsed = false; } // fired, poached, left
    el.dataset.collapsed = st.collapsed ? '1' : '';
    panel.hidden = st.collapsed;
    scrim.hidden = st.collapsed;
    strip.hidden = !st.collapsed;
    if (st.collapsed) { swap(strip, stripView(s, now)); return; }
    const t = T('hud.sm.title', { zone: T(zone === 'shop' ? 'hud.sm.zoneShop' : 'hud.sm.zoneFarm') });
    if (title.textContent !== t) title.textContent = t;
    back.hidden = !st.uid;
    swap(summary, summaryView(s, now, zone));
    swap(banner, poachView(s, now));
    swap(tabs, st.uid ? null : tabsView(s, now, zone));
    const key = screenKey();
    const node = st.uid ? detailView(s, now, zone, unitOf(s, st.uid)) : st.tab === 'hire' ? hireView(s, now, zone) : st.tab === 'report' ? reportView(s, now, zone) : teamView(s, now, zone);
    if (body.dataset.screen !== key) {
      body.dataset.screen = key;
      body.replaceChildren(node);
      body.scrollTop = scrollMem[key] || 0;
    } else {
      const top = body.scrollTop;
      if (swap(body, node)) body.scrollTop = top;
    }
  }
  body.addEventListener('scroll', () => { if (body.dataset.screen) scrollMem[body.dataset.screen] = body.scrollTop; }, { passive: true });

  function goTo(next) {
    if (body.dataset.screen) scrollMem[body.dataset.screen] = body.scrollTop;
    Object.assign(st, next);
    sfx('ui.tab');
    paint(true);
  }
  function goBack() {
    if (st.collapsed) { goTo({ collapsed: false }); return; }
    if (st.uid) goTo({ uid: null }); else api.close();
  }

  // ---------- shared bits ----------
  function hereOf(s, u) { return !!u.assigned && u.assigned.regionId === s.world.currentRegion; }
  /** Shown state key of a unit (see STATE_ICON). */
  function stateKey(s, u, now) {
    if (!u.assigned) return 'unassigned';
    if (!hereOf(s, u)) return 'elsewhere';
    const core = unitState(u, now);
    if (!isRobot(u) && !['phone', 'lunch', 'sulking'].includes(core)) {
      if ((u.energy ?? 100) <= 0 && u.active) return 'exhausted';
      if ((u.fullness ?? 100) <= 0 && u.active) return 'starving';
    }
    if (!u.active && ['ok', 'tired', 'hungry'].includes(core)) return 'bench'; // resting on the bench is no problem
    if (core !== 'ok') return core;
    if (isRobot(u) && (u.wear ?? 100) < ROBOT_WEAR.lowWear) return 'worn';
    return 'ok';
  }
  const toneOf = key => (BLOCKING.has(key) ? 'bad' : SLOW.has(key) ? 'warn' : 'ok');
  const isProblem = key => BLOCKING.has(key) || SLOW.has(key);
  /** The paid fix of a unit's problem: { kind, cost } or null. */
  function fixOf(u, key, now) {
    if (key === 'exhausted') return { kind: 'coffee', cost: careCost(u, 'coffee') };
    if (key === 'starving') return { kind: 'food', cost: careCost(u, 'food') };
    if (key === 'worn') return { kind: 'service', cost: careCost(u, 'service') };
    if (!isProblem(key)) return null;
    return quickFix(u, now);
  }
  const secsLeft = (until, now) => Math.max(0, Math.ceil(((until || 0) - now) / 1000));
  /** What the unit does now: one line (state first, then the realm's job / reason). */
  function nowLine(s, u, key, now, info) {
    const zone = STAFF[u.type].zone;
    if (key === 'lunch') return T('hud.sm.now.lunch', { s: secsLeft(u.breakUntil, now) });
    if (key === 'overheat') return T('hud.sm.now.overheat', { s: secsLeft(u.stopped?.until, now) });
    if (key === 'bench') return isRobot(u) ? T('hud.sm.now.benchRobot') : T('hud.sm.now.bench', { coins: fmt(upkeepOf(u)), min: UPKEEP.perMinutes });
    if (key !== 'ok' && key !== 'tired' && key !== 'hungry' && key !== 'worn') return T(`hud.sm.now.${key}`);
    let line;
    if (info?.job) line = `${JOB_ICON[info.job] || '🔧'} ${T(`hud.rep.job.${info.job}`)}`;
    else if (info) {
      const why = info.reason || 'noWork';
      const task = info.task ? T(`hud.staff.task.${info.task}`) : '';
      line = `${REASON_ICON[why] || '⏳'} ${T(`hud.rep.why.${why}`, { s: Math.max(1, Math.ceil((info.ms || 0) / 1000)), task })}`;
    } else line = T(zone === 'shop' ? 'hud.sm.now.okShop' : 'hud.sm.now.okFarm');
    return key === 'ok' ? line : `${T(`hud.sm.now.${key}`)} · ${line}`;
  }
  function infoOf(s, u) { return hereOf(s, u) ? ctx.realm?.staffInfo?.(u.uid) || null : null; }

  function bar(icon, label, value, max, tone) {
    const v = Math.max(0, Math.min(max, Number(value) || 0)), pct = max > 0 ? Math.round(v / max * 100) : 0;
    return h('div', { class: `hud-sm-bar hud-sm-bar--${tone}` },
      h('span', { class: 'hud-sm-bar-name' }, `${icon} ${label}`),
      h('span', { class: 'hud-sm-bar-track', attrs: { role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(max)), 'aria-valuenow': String(Math.round(v)) } },
        h('span', { style: { width: `${pct}%` } })),
      h('span', { class: 'hud-sm-bar-num' }, String(Math.round(v))));
  }
  function vitalBars(u, full = false, info = null) {
    if (isRobot(u)) {
      const heat = u.heat || 0, wear = u.wear ?? 100;
      const charge = u.stopped?.kind === 'battery' ? 0 : info?.battery;
      return h('div', { class: 'hud-sm-bars' },
        charge != null ? bar('🔋', T('hud.sm.bar.battery'), charge, 100, charge <= 15 ? 'bad' : charge <= 40 ? 'warn' : 'ok') : null,
        bar('🔥', T('hud.sm.bar.heat'), heat, 100, heat >= 80 ? 'bad' : heat >= 50 ? 'warn' : 'ok'),
        bar('🔧', T('hud.sm.bar.wear'), wear, 100, wear < ROBOT_WEAR.lowWear ? 'bad' : wear < 60 ? 'warn' : 'ok'),
        full ? h('p', { class: 'hud-sub' }, T(u.stopped?.kind === 'battery' ? 'hud.sm.batteryEmpty' : 'hud.sm.batteryOk', { min: batteryMinutes(u) })) : null);
    }
    const e = u.energy ?? 100, m = u.morale ?? VITALS.start.morale, f = u.fullness ?? 100;
    return h('div', { class: 'hud-sm-bars' },
      bar('⚡', T('hud.sm.bar.energy'), e, energyMax(u), e < VITALS.tiredBelow ? 'bad' : e < 50 ? 'warn' : 'ok'),
      bar('😊', T('hud.sm.bar.morale'), m, 100, m < VITALS.sulkBelow ? 'bad' : m < RIVAL.targetMorale ? 'warn' : 'ok'),
      full ? bar('🍔', T('hud.sm.bar.fullness'), f, 100, f < VITALS.hungryBelow ? 'bad' : f < 50 ? 'warn' : 'ok') : null);
  }
  function careButton(s, u, kind, now, { compact = false } = {}) {
    const cost = careCost(u, kind), err = careError(s, u, kind, now);
    const short = s.player.coins < cost;
    return actionButton({ label: T(`hud.sm.care.${kind}`), icon: CARE_ICON[kind], cost: cost > 0 ? cost : undefined, tone: cost > 0 ? 'gold' : 'plain',
      disabled: !!err, note: short && !compact ? needMore(cost - s.player.coins) : null,
      onClick: () => { const r = act('staff/care', { uid: u.uid, kind, roll: Math.random() }); if (r.ok) sfx(cost > 0 ? 'coin.spend' : 'ui.click'); } });
  }
  const tendButton = (s, u) => actionButton({ label: T('hud.staff.tend'), icon: CARE_ICON.tend, cost: TEND.fee, tone: 'gold', disabled: s.player.coins < TEND.fee,
    note: s.player.coins < TEND.fee ? needMore(TEND.fee - s.player.coins) : null, onClick: () => act('staff/tend', { uid: u.uid }) });
  const canTend = (u, info) => !isRobot(u) && STAFF[u.type].zone === 'farm' && info?.reason === 'growing' && !(u.water > 0) && !u.stopped;
  function headLine(u) {
    const tr = TRAITS[u.trait];
    return [tr ? `${tr.icon} ${T(`staff.trait.${u.trait}`)}` : `${T(`hud.kind.${STAFF[u.type].kind}`)} · ${T(`hud.zone.${STAFF[u.type].zone}`)}`,
      isRobot(u) ? T(`hud.staff.task.${robotTask(u)}`) : T('hud.staff.lv', { level: unitLevel(u) })].join(' · ');
  }
  const perkBadge = perk => (perk ? h('span', { class: 'hud-sm-perk', attrs: { title: T(`hud.sm.perkFx.${perk}`, PERK_FX) } }, `${PERK_ICON[perk] || '⭐'} ${T('hud.sm.rare')} · ${T(`hud.sm.perk.${perk}`)}`) : null);

  // ---------- header ----------
  function summaryView(s, now, zone) {
    const here = region(s) ? zoneUnits(s, zone).filter(u => hereOf(s, u)) : [];
    const bench = here.filter(u => !u.active).length;
    const win = ledgerWindow(s, now, BOOKS.mvpMinutes);
    const tickets = s.rewards?.tickets || 0;
    return h('p', { class: 'hud-sm-line' },
      h('span', null, T('hud.sm.sum.active', { n: activeCount(s, zone), max: slots(s, zone) })), ' · ',
      h('span', null, T('hud.sm.sum.bench', { n: bench })), ' · ',
      h('span', null, T('hud.sm.sum.upkeep', { coins: fmt(upkeepPer(s, zone)), min: UPKEEP.perMinutes })), ' · ',
      h('span', null, T('hud.sm.sum.earned', { coins: fmt(win.earned), min: BOOKS.mvpMinutes })),
      tickets > 0 ? h('span', { class: 'hud-sm-ticket' }, ' · ', T('hud.staff.tickets', { n: tickets })) : null);
  }
  function poachView(s, now) {
    const p = poachOf(s);
    const u = p && unitOf(s, p.uid);
    if (!u) return null;
    const left = secsLeft(p.until, now);
    const short = s.player.coins < p.fee;
    return h('div', { class: 'hud-sm-poach', attrs: { role: 'alert' } },
      h('p', { class: 'hud-sm-poach-text' }, T('hud.sm.poach', { rival: RIVAL.names[p.zone] || '', name: nameOf(u), s: left })),
      h('div', { class: 'hud-sm-poach-btns' },
        actionButton({ label: T('hud.sm.keep'), icon: '🤝', cost: p.fee, tone: 'gold', disabled: short, note: short ? needMore(p.fee - s.player.coins) : null,
          onClick: () => { const r = act('staff/keep', { uid: u.uid }); if (r.ok) sfx('coin.spend'); } }),
        actionButton({ label: T('hud.sm.letGo'), tone: 'plain', onClick: () => letGo(u.uid) })));
  }
  async function letGo(uid) {
    const u = unitOf(store.state, uid);
    if (!u) return;
    const refund = Math.round(RIVAL.letGoRefund * (u.paid || 0));
    const yes = await ctx.confirm({ title: T('hud.sm.letGoTitle', { name: nameOf(u) }), body: T('hud.sm.letGoBody', { name: nameOf(u), refund: fmt(refund) }), confirmLabel: T('hud.sm.letGo') });
    if (yes) act('staff/letGo', { uid });
    rerender();
  }
  function tabsView(s, now, zone) {
    const units = zoneUnits(s, zone);
    const problems = units.filter(u => isProblem(stateKey(s, u, now))).length;
    const tab = (id, label, badge) => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `staffTab-${id}` }, attrs: { 'aria-pressed': String(st.tab === id) },
      on: { click: () => goTo({ tab: id }) } }, label, badge ? h('span', { class: 'hud-sm-badge' }, String(badge)) : null);
    return h('div', { class: 'hud-tabs hud-sm-tabs', attrs: { role: 'group', 'aria-label': T('hud.sm.tabs') } },
      tab('team', `👥 ${T('hud.sm.tab.team')}`, problems), tab('hire', `🧑 ${T('hud.sm.tab.hire')}`), tab('report', `📊 ${T('hud.sm.tab.report')}`));
  }

  // ---------- Đội ----------
  function teamView(s, now, zone) {
    const units = zoneUnits(s, zone);
    if (!units.length) return h('div', { class: 'hud-sm-empty' }, h('p', { class: 'hud-line' }, T('hud.sm.noTeam')),
      actionButton({ label: T('hud.sm.goHire'), icon: '🧑', onClick: () => goTo({ tab: 'hire' }) }));
    const rows = units.map(u => ({ u, key: stateKey(s, u, now) }));
    const counts = {
      all: rows.length,
      active: rows.filter(r => hereOf(s, r.u) && r.u.active).length,
      bench: rows.filter(r => hereOf(s, r.u) && !r.u.active).length,
      problem: rows.filter(r => isProblem(r.key)).length,
    };
    const filter = counts[st.filter] != null ? st.filter : 'all';
    const chip = id => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(filter === id) }, on: { click: () => goTo({ filter: id }) } },
      T(`hud.sm.filter.${id}`, { n: counts[id] }));
    const chips = h('div', { class: 'hud-sm-chips', attrs: { role: 'group', 'aria-label': T('hud.sm.filters') } }, chip('all'), chip('active'), chip('bench'), chip('problem'));
    // Bulk: pay every paid fix (problems of units here), or swap the tired out for rested bench workers.
    const fixes = rows.filter(r => hereOf(s, r.u)).map(r => ({ u: r.u, fix: fixOf(r.u, r.key, now) }))
      .filter(x => x.fix && [null, 'coins'].includes(careError(s, x.u, x.fix.kind, now)));
    const total = fixes.reduce((n, x) => n + x.fix.cost, 0);
    const bulk = h('div', { class: 'hud-sm-bulk' },
      actionButton({ id: 'staffFixAll', label: T('hud.sm.fixAll'), icon: '🧰', cost: fixes.length ? total : undefined, tone: 'gold', disabled: !fixes.length || s.player.coins < Math.min(...fixes.map(x => x.fix.cost)),
        note: fixes.length && s.player.coins < total ? T('hud.sm.fixSome') : null, onClick: () => fixAll() }),
      actionButton({ id: 'staffSwap', label: T('hud.sm.swap'), icon: '🔄', tone: 'plain', disabled: !region(s), onClick: () => swapShift() }));
    const shown = rows.filter(r => filter === 'all' || (filter === 'active' ? hereOf(s, r.u) && r.u.active : filter === 'bench' ? hereOf(s, r.u) && !r.u.active : isProblem(r.key)));
    // Problems first, then on shift, bench, elsewhere (stable by hire order inside each group).
    const rank = r => (BLOCKING.has(r.key) ? 0 : SLOW.has(r.key) ? 1 : hereOf(s, r.u) && r.u.active ? 2 : hereOf(s, r.u) ? 3 : 4);
    shown.sort((a, b) => rank(a) - rank(b));
    const list = h('ul', { class: 'hud-sm-cards' }, ...shown.map(r => unitCard(s, r.u, r.key, now)));
    return h('div', null, chips, bulk, shown.length ? list : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.filterEmpty')));
  }
  function unitCard(s, u, key, now) {
    const def = STAFF[u.type], info = infoOf(s, u), fix = fixOf(u, key, now);
    const poached = poachOf(s)?.uid === u.uid;
    let btn = null;
    if (fix) btn = careButton(s, u, fix.kind, now, { compact: true });
    else if (key === 'bench') btn = actionButton({ label: T('hud.sm.toShift'), icon: '▶️', tone: 'go', disabled: freeSlots(s, def.zone) <= 0, onClick: () => act('staff/setActive', { uid: u.uid, active: true }) });
    else if (key === 'unassigned') btn = actionButton({ label: T('hud.staff.assign'), disabled: !region(s), onClick: () => act('staff/assign', { uid: u.uid }) });
    else if (canTend(u, info)) btn = tendButton(s, u);
    const ready = !isRobot(u) && STAT_ORDER.some(k => !statError(s, u, k));
    const main = h('button', { type: 'button', class: 'hud-sm-card-main', dataset: { hudId: `staffUnit-${u.uid}` }, attrs: { 'aria-label': T('hud.sm.openUnit', { name: nameOf(u) }) }, on: { click: () => goTo({ uid: u.uid }) } },
      h('span', { class: 'hud-sm-avatar', attrs: { 'aria-hidden': 'true' } }, def.icon, h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂')),
      h('span', { class: 'hud-sm-card-text' },
        h('strong', { class: 'hud-sm-card-name' }, nameOf(u), u.perk ? ' ⭐' : '', ready ? h('span', { class: 'hud-unit-tag is-ready' }, '⬆️') : null, poached ? h('span', { class: 'hud-sm-tag-bad' }, '💼') : null),
        h('small', { class: 'hud-sm-card-meta' }, headLine(u)),
        h('small', { class: `hud-report hud-report--${toneOf(key)}` }, nowLine(s, u, key, now, info))),
      h('span', { class: 'hud-sm-chev', attrs: { 'aria-hidden': 'true' } }, '›'));
    return h('li', { class: `hud-sm-card is-${toneOf(key)}` }, main, hereOf(s, u) ? vitalBars(u, false, info) : null, btn ? h('div', { class: 'hud-sm-card-fix' }, btn) : null);
  }
  function fixAll() {
    const s = store.state, now = Date.now(), zone = zoneNow();
    if (ctx.blockedByAuto?.()) return;
    let paid = 0, n = 0, missed = 0;
    for (const u of zoneUnits(s, zone).filter(x => hereOf(s, x))) {
      const cur = store.state, unit = unitOf(cur, u.uid);
      const fix = unit && fixOf(unit, stateKey(cur, unit, now), now);
      if (!fix) continue;
      const r = store.dispatch('staff/care', { uid: u.uid, kind: fix.kind, roll: Math.random() });
      if (r.ok && !r.noop) { paid += fix.cost; n++; } else missed++;
    }
    if (n) { sfx('coin.spend'); ctx.toast(T('hud.sm.fixedAll', { n, coins: fmt(paid) }), 'good'); }
    if (missed) ctx.toast(T('hud.sm.fixMissed', { n: missed }), 'warn');
    rerender();
  }
  function swapShift() {
    const r = act('staff/swapShift', { zone: zoneNow() });
    if (r.ok && r.noop) ctx.toast(T('hud.sm.swapNone'), 'info');
    rerender();
  }

  // ---------- Detail ----------
  function detailView(s, now, zone, u) {
    if (!u) return h('p', { class: 'hud-line' }, T('hud.sm.gone'));
    const def = STAFF[u.type], key = stateKey(s, u, now), info = infoOf(s, u), robot = isRobot(u), here = hereOf(s, u);
    const out = h('div', { class: 'hud-sm-detail' });
    // header
    out.append(h('div', { class: 'hud-sm-dhead' },
      h('span', { class: 'hud-sm-avatar hud-sm-avatar--big', attrs: { 'aria-hidden': 'true' } }, def.icon, h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂')),
      h('div', { class: 'hud-sm-dhead-text' },
        h('strong', { class: 'hud-sm-dname' }, nameOf(u)),
        h('small', { class: 'hud-sm-card-meta' }, headLine(u), robot ? '' : ` · ${T('hud.staff.quality', { stars: '⭐'.repeat(unitStars(u)) })}`),
        perkBadge(u.perk),
        h('small', { class: `hud-report hud-report--${toneOf(key)}` }, nowLine(s, u, key, now, info)))));
    // state + what to do + care
    const cares = (robot ? ROBOT_CARE : WORKER_CARE).filter(k => careError(s, u, k, now) !== 'notNeeded');
    const care = cares.map(k => careButton(s, u, k, now));
    if (canTend(u, info)) care.push(tendButton(s, u));
    if (u.stopped && !cares.length && !robot) care.push(actionButton({ label: T('hud.staff.backToWork'), cost: u.stopped.fee, tone: 'gold', disabled: s.player.coins < (u.stopped.fee || 0), onClick: () => act('staff/resume', { uid: u.uid }) }));
    out.append(section('hud.sm.sec.state',
      h('p', { class: `hud-sm-state hud-sm-state--${toneOf(key)}` }, h('span', { class: 'hud-sm-state-ico', attrs: { 'aria-hidden': 'true' } }, STATE_ICON[key] || '🙂'), T(`hud.sm.state.${key}`)),
      vitalBars(u, true, info),
      h('p', { class: 'hud-sm-todo' }, h('strong', null, T('hud.sm.todoTitle')), ' ', todoText(s, u, key, info)),
      care.length ? h('div', { class: 'hud-sm-care' }, care) : null));
    // where + shift
    const shift = [];
    if (here) {
      shift.push(actionButton({ id: 'staffFocus', label: T('hud.sm.where'), icon: '📍', tone: 'plain', disabled: STAFF[u.type].zone !== zone, onClick: () => focus(u.uid) }));
      const free = freeSlots(s, def.zone);
      const seg = (on, label) => h('button', { type: 'button', class: 'hud-tab', attrs: { 'aria-pressed': String(!!u.active === on) },
        disabled: on && !u.active && free <= 0, on: { click: () => { if (!!u.active !== on) act('staff/setActive', { uid: u.uid, active: on }); } } }, label);
      out.append(section('hud.sm.sec.shift',
        h('div', { class: 'hud-tabs hud-sm-seg', attrs: { role: 'group', 'aria-label': T('hud.sm.sec.shift') } }, seg(true, `▶️ ${T('hud.sm.active')}`), seg(false, `🪑 ${T('hud.sm.bench')}`)),
        h('p', { class: 'hud-sub' }, !u.active && free <= 0 ? T('hud.sm.noSlot', { n: activeCount(s, def.zone), max: slots(s, def.zone) })
          : robot ? T('hud.sm.benchRobot') : T('hud.sm.benchCost', { coins: fmt(UPKEEP.benchRatio * def.cost), min: UPKEEP.perMinutes })),
        h('div', { class: 'hud-row' }, shift)));
    } else {
      out.append(section('hud.sm.sec.shift', h('p', { class: 'hud-sub' }, T(u.assigned ? 'hud.staff.elsewhere' : 'hud.staff.idle')),
        h('div', { class: 'hud-row' }, actionButton({ label: T('hud.staff.assign'), disabled: !region(s), onClick: () => act('staff/assign', { uid: u.uid }) }))));
    }
    if (robot) out.append(robotBlocks(s, u, info));
    else out.append(taskBlock(s, u, zone), statsBlock(s, u, zone));
    out.append(bookBlock(u), section('hud.staff.howTitle', howItWorks(u, STAFF[u.type].zone, info)));
    // fire / sell
    const refund = fireRefund(u);
    out.append(h('div', { class: 'hud-sm-fire' }, actionButton({ id: 'staffFire', label: T(robot ? 'hud.sm.sell' : 'hud.sm.fire', { coins: fmt(refund) }), tone: 'plain', onClick: () => fire(u.uid) })));
    return out;
  }
  function section(titleKey, ...children) {
    return h('section', { class: 'hud-sm-sec' }, h('h3', { class: 'hud-sm-h' }, T(titleKey)), ...children);
  }
  function todoText(s, u, key, info) {
    if (key === 'ok' || key === 'tired' || key === 'hungry') {
      if (!info?.job && info?.reason) {
        if (canTend(u, info)) return T('hud.rep.todo.growingTend', { fee: TEND.fee, n: TEND.plots });
        return T(`hud.rep.todo.${info.reason}`, { task: info.task ? T(`hud.staff.task.${info.task}`) : '' });
      }
      if (key === 'ok') return T('hud.sm.todo.ok');
    }
    return T(`hud.sm.todo.${key}`, { fee: fmt(fixOf(u, key, Date.now())?.cost || 0) });
  }
  function focus(uid) {
    const ok = ctx.realm?.focusUnit?.(uid);
    if (!ok) { ctx.toast(T('hud.sm.notHere'), 'info'); return; }
    goTo({ collapsed: true });
  }
  async function fire(uid) {
    const u = unitOf(store.state, uid);
    if (!u) return;
    const robot = isRobot(u), refund = fireRefund(u);
    const yes = await ctx.confirm({ title: T(robot ? 'hud.sm.sellTitle' : 'hud.sm.fireTitle', { name: nameOf(u) }), body: T(robot ? 'hud.sm.sellBody' : 'hud.sm.fireBody', { name: nameOf(u), coins: fmt(refund) }),
      confirmLabel: T(robot ? 'hud.sm.sellGo' : 'hud.sm.fireGo') });
    if (!yes) { rerender(); return; }
    const r = act('staff/fire', { uid });
    if (r.ok) { if (refund > 0) sfx('coin.gain'); st.uid = null; st.collapsed = false; }
    rerender();
  }

  // Worker tasks: Auto + the zone's tasks, at most taskLimit (1; 2 from smart 3). A tap toggles; when full, the new
  // task replaces the oldest one (one-task workers just switch).
  function taskBlock(s, u, zone) {
    const all = WORKER_TASKS[STAFF[u.type].zone] || [], cur = Array.isArray(u.tasks) ? u.tasks : [], max = taskLimit(u);
    const set = tasks => act('staff/setTasks', { uid: u.uid, tasks });
    const toggle = t => {
      const now = (unitOf(store.state, u.uid)?.tasks || []).slice();
      if (now.includes(t)) set(now.filter(x => x !== t));
      else set([...now, t].slice(-max));
    };
    const chip = (id, on, onClick) => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(on) }, on: { click: onClick } }, T(`hud.staff.task.${id}`));
    return section('hud.sm.sec.tasks',
      h('div', { class: 'hud-sm-chips', attrs: { role: 'group', 'aria-label': T('hud.sm.sec.tasks') } },
        chip('auto', !cur.length, () => set([])), ...all.map(t => chip(t, cur.includes(t), () => toggle(t)))),
      h('p', { class: 'hud-sub' }, cur.length ? T('hud.sm.tasksOnly', { tasks: cur.map(t => T(`hud.staff.task.${t}`)).join(', ') }) : T('hud.sm.tasksAuto')),
      h('p', { class: 'hud-sub' }, max >= TASK_LIMIT.more ? T('hud.sm.tasksMax', { n: max }) : T('hud.sm.tasksMore', { n: TASK_LIMIT.more, smart: TASK_LIMIT.moreFromSmart })));
  }

  // Four stats: pips 1..5, what the next step gives, «Nâng · n điểm + 🪙»; skill points + XP toward the next point.
  function statsBlock(s, u, zone) {
    const xp = Math.min(SKILL.xpPerPoint, Math.floor(u.xp || 0)), points = u.points || 0;
    const rows = STAT_ORDER.map(stat => statRow(s, u, stat, zone));
    return section('hud.sm.sec.stats',
      h('p', { class: 'hud-sm-points' }, T('hud.sm.points', { n: points }), ' · ', T('hud.sm.xp', { n: xp, need: SKILL.xpPerPoint })),
      h('div', { class: 'hud-xpbar', attrs: { role: 'progressbar', 'aria-label': T('hud.sm.xpAria'), 'aria-valuemin': '0', 'aria-valuemax': String(SKILL.xpPerPoint), 'aria-valuenow': String(xp) } },
        h('span', { style: { width: `${Math.round(xp / SKILL.xpPerPoint * 100)}%` } })),
      h('div', { class: 'hud-sm-stats' }, rows));
  }
  function statRow(s, u, stat, zone) {
    const n = statOf(u, stat), cap = Math.min(SKILL.maxStat, statCap(u, stat)), err = statError(s, u, stat), price = statPrice(u, stat);
    const pips = h('span', { class: 'hud-sm-pips', attrs: { 'aria-label': T('hud.sm.statOf', { n, max: SKILL.maxStat }) } },
      ...Array.from({ length: SKILL.maxStat }, (_, i) => h('span', { class: i < n ? 'is-on' : i >= cap ? 'is-cap' : '' })));
    let foot;
    if (err === 'maxLevel') foot = h('span', { class: 'hud-tag' }, T('hud.maxLevel'));
    else if (err === 'cap') foot = lockTag(T('hud.sm.capped', { trait: T(`staff.trait.${u.trait}`), max: cap }));
    else foot = actionButton({ label: T('hud.sm.raise', { n: price.points }), icon: '⬆️', cost: price.coins, tone: 'gold', disabled: !!err,
      note: err === 'points' ? T('hud.sm.needPoints', { n: price.points - (u.points || 0) }) : err === 'coins' ? needMore(price.coins - s.player.coins) : null,
      onClick: () => { const r = act('staff/upgradeStat', { uid: u.uid, stat }); if (r.ok) sfx('reward.levelup'); } });
    return h('div', { class: 'hud-sm-stat' },
      h('div', { class: 'hud-sm-stat-top' }, h('strong', null, `${STAT_ICON[stat]} ${T(`hud.stat.${stat}`)}`), pips, h('span', { class: 'hud-sm-stat-n' }, `${n}/${SKILL.maxStat}`)),
      h('small', { class: 'hud-sm-stat-next' }, n >= SKILL.maxStat ? T(`hud.sm.statTop.${stat}`) : T('hud.sm.next', { text: statGain(u, stat, n + 1, zone) })),
      foot);
  }
  /** What raising `stat` to `to` gives (from config). */
  function statGain(u, stat, to, zone) {
    const parts = [];
    if (stat === 'speed') parts.push(T('hud.sm.gain.speed', { pct: Math.round(LEVEL_STEP.speed * (to - 1) * 100) }));
    else if (stat === 'smart') {
      for (const [id, at] of Object.entries(SMART_RULES)) if (at === to && ZONE_RULES[zone]?.includes(id)) parts.push(T(`hud.staff.rule.${id}`));
      if (to === TASK_LIMIT.moreFromSmart) parts.push(T('hud.sm.gain.tasks', { n: TASK_LIMIT.more }));
    } else if (stat === 'accuracy') {
      const k = ZONE_MISTAKES[zone]?.[0] || 'spill', mul = MISTAKES.traitMul[u.trait] ?? 1;
      const pct = i => `${Math.round((MISTAKES.rates[k][i] || 0) * mul * 1000) / 10}%`;
      parts.push(T(`hud.sm.gain.accuracy.${k}`, { from: pct(to - 2), to: pct(to - 1) }));
      if (to === QUALITY.workerTwoStar) parts.push(T('hud.staff.rule.twoStar'));
      if (to === QUALITY.hardLevel && zone === 'shop') parts.push(T('hud.staff.rule.hard'));
    } else if (stat === 'stamina') {
      parts.push(T('hud.sm.gain.stamina', { energy: 100 + VITALS.staminaEnergyStep * (to - 1), slack: Math.round(LEVEL_STEP.slack * 100) }));
      if (to === VITALS.staminaHungerFrom) parts.push(T('hud.sm.gain.hunger'));
    }
    return parts.length ? parts.join(' · ') : T('hud.staff.rule.faster');
  }

  // Robot: one task + four hardware parts.
  function robotBlocks(s, u, info) {
    const cur = robotTask(u);
    const tasks = h('div', { class: 'hud-sm-chips', attrs: { role: 'group', 'aria-label': T('hud.staff.taskTitle') } },
      ...['auto', ...(ROBOT_TASKS[u.type] || [])].map(task => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(cur === task) },
        on: { click: () => act('staff/setTask', { uid: u.uid, task }) } }, T(`hud.staff.task.${task}`))));
    const parts = PART_ORDER.map(part => {
      const tier = partTier(u, part), err = partError(s, u, part), cost = partPrice(u, part), max = tier >= PART_COST.maxTier;
      const fx = max ? partLine(part, tier) : `${partLine(part, tier)} → ${partLine(part, tier + 1)}`;
      const btn = err === 'maxLevel' ? h('span', { class: 'hud-tag' }, T('hud.maxLevel'))
        : err === 'level' ? lockTag(T('hud.levelN', { level: PART_COST.tier3Level }))
        : actionButton({ label: T('hud.staff.upgrade'), icon: '⬆️', cost, tone: 'plain', disabled: err === 'coins', note: err === 'coins' ? needMore(cost - s.player.coins) : null,
          onClick: () => act('staff/upgradePart', { uid: u.uid, part }) });
      return h('div', { class: 'hud-sm-part' },
        h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${ROBOT_PARTS[part].icon} ${T(`hud.staff.part.${part}`)} · ${tier}/${PART_COST.maxTier}`), h('small', null, fx)), btn);
    });
    return h('div', null,
      section('hud.staff.taskTitle', tasks, h('p', { class: 'hud-sub' }, T(cur === 'auto' ? 'hud.staff.taskAuto' : 'hud.staff.taskFixed')),
        info?.task && cur === 'auto' ? h('p', { class: 'hud-sub' }, T('hud.sm.autoNow', { task: T(`hud.staff.task.${info.task}`) })) : null),
      section('hud.staff.parts', h('p', { class: 'hud-sub' }, T('hud.staff.quality', { stars: '⭐' }), ' · ', T('hud.staff.noHard')), ...parts));
  }
  function partLine(part, tier) {
    const P = ROBOT_PARTS[part];
    if (part === 'battery') return T('hud.sm.part.battery', { v: P.minutes[tier] });
    if (part === 'motor') return T('hud.sm.part.motor', { v: Math.round((P.speed[tier] - 1) * 100) });
    if (part === 'cooler') return T('hud.sm.part.cooler', { v: Math.round((1 - P.heatMul[tier]) * 100) });
    return T('hud.sm.part.frame', { v: Math.round((1 - P.jamMul[tier]) * 100) });
  }

  // Today's book (since hire / the last reload of the book): jobs, earned, spent, profit, mistakes.
  function bookBlock(u) {
    const b = u.book || {}, profit = unitProfit(u);
    const cell = (label, value, cls = '') => h('div', { class: `hud-sm-cell ${cls}` }, h('small', null, label), h('strong', null, value));
    return section('hud.sm.sec.book', h('div', { class: 'hud-sm-grid' },
      cell(T('hud.sm.book.jobs'), fmt(b.jobs || 0)),
      cell(T('hud.sm.book.earned'), coinAmount(b.earned || 0)),
      cell(T('hud.sm.book.spent'), coinAmount(b.spent || 0)),
      cell(T('hud.sm.book.profit'), `${profit < 0 ? '−' : ''}${fmt(Math.abs(profit))}`, profit < 0 ? 'is-bad' : 'is-good'),
      isRobot(u) ? null : cell(T('hud.sm.book.mistakes'), fmt(b.mistakes || 0))));
  }

  // "How it works": the unit's decision steps in priority order, with its stats' rules filled in, plus its odds.
  function howItWorks(u, zone, info) {
    const robot = isRobot(u), steps = [];
    const on = (rule, yes, no) => (hasRule(u, rule) ? T(yes) : T(no));
    if (robot) {
      const task = robotTask(u);
      steps.push(task === 'auto' ? T('hud.how.robotAuto', { task: info?.task ? T(`hud.staff.task.${info.task}`) : '…' }) : T('hud.how.robotFixed', { task: T(`hud.staff.task.${task}`) }));
      steps.push(T('hud.how.robotOrder'), T('hud.how.robotNoHard'), T('hud.how.robotBattery', { min: batteryMinutes(u) }),
        T('hud.how.robotHeat', { heat: Math.round(heatPerMin(u)), s: ROBOT_WEAR.overheatSeconds }),
        T('hud.how.robotJam', { jam: Math.round(jamChance(u) * 1000) / 10 }), T('hud.how.robotNever'));
    } else {
      const tasks = Array.isArray(u.tasks) ? u.tasks : [];
      if (tasks.length) steps.push(T('hud.how.onlyTasks', { tasks: tasks.map(t => T(`hud.staff.task.${t}`)).join(', ') }));
      if (zone === 'farm') {
        steps.push(T('hud.how.farm1', { how: on('ripeFirst', 'hud.how.ripeFirst', 'hud.how.nearest') }),
          T('hud.how.farm2', { crop: on('playerCrop', 'hud.how.playerCrop', 'hud.how.bestCrop') }));
        if (hasRule(u, 'twoPlots')) steps.push(T('hud.how.twoPlots'));
        steps.push(T('hud.how.farm3'), T('hud.how.farm4', { n: TEND.plots }), T('hud.how.farm5', { pause: on('quick', 'hud.how.quick', 'hud.how.slow') }));
      } else {
        steps.push(T('hud.how.cafe1', { post: info?.post ? T(`hud.staff.post.${info.post}`) : '…' }),
          T('hud.how.cafe2', { how: on('urgent', 'hud.how.urgent', 'hud.how.fifo') }),
          T('hud.how.cafe3', { cups: on('twoCups', 'hud.how.twoCups', 'hud.how.oneCup') }),
          T(hasRule(u, 'chain') ? 'hud.how.chain' : 'hud.how.noChain'),
          T(hasRule(u, 'restock') ? 'hud.how.restock' : 'hud.how.noRestock'),
          T(canBrew(u, QUALITY.hardDrinks[0]) ? 'hud.how.hard' : 'hud.how.noHard'));
      }
      steps.push(T('hud.how.vitals', { tired: VITALS.tiredBelow, hungry: VITALS.hungryBelow, sulk: VITALS.sulkBelow }));
    }
    const ol = h('ol', { class: 'hud-how' }, ...steps.map(t => h('li', null, t)));
    const pct = k => `${Math.round(mistakeChance(u, k) * 1000) / 10}%`;
    const slack = Math.round(STAFF_BREAKS.worker.slackChancePerMinute * slackMul(u) * 100);
    const odds = robot ? null : h('p', { class: 'hud-sub' }, zone === 'farm'
      ? T('hud.how.oddsFarm', { unripe: pct('unripe'), crooked: pct('crooked'), slack })
      : T('hud.how.oddsCafe', { spill: pct('spill'), wrong: pct('wrongTable'), slack }));
    return h('div', null, ol, odds);
  }

  // ---------- collapsed strip (📍 Xem ở đâu) ----------
  function stripView(s, now) {
    const u = unitOf(s, st.uid);
    if (!u) return null;
    const key = stateKey(s, u, now), fix = fixOf(u, key, now);
    return h('div', { class: 'hud-sm-strip-in' },
      h('span', { class: 'hud-sm-avatar', attrs: { 'aria-hidden': 'true' } }, STAFF[u.type].icon, h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂')),
      h('span', { class: 'hud-sm-strip-text' }, h('strong', null, nameOf(u)), h('small', { class: `hud-report hud-report--${toneOf(key)}` }, T(`hud.sm.state.${key}`))),
      fix ? careButton(s, u, fix.kind, now, { compact: true }) : null,
      actionButton({ id: 'staffReopen', label: T('hud.sm.reopen'), tone: 'go', onClick: () => goTo({ collapsed: false }) }),
      h('button', { type: 'button', class: 'hud-x', attrs: { 'aria-label': T('hud.close') }, on: { click: () => api.close() } }, '×'));
  }

  // ---------- Tuyển dụng ----------
  // The level whose cap (= level) leaves room for one more unit (an old save may already be over the cap).
  const nextHireLevel = (s, zone) => Math.max(level(s), zoneUnits(s, zone).length) + 1;
  function hireFoot(s, err, def, cost, hire) {
    if (err === 'round') return lockTag(T('hud.roundN', { round: def.round }));
    if (err === 'level') return lockTag(T('hud.levelN', { level: def.level }));
    if (err === 'teamFull') return lockTag(T('hud.sm.teamFull', { max: zoneUnits(s, def.zone).length }));
    // Team = level (one hire per level, §1): the lock names the level that allows one more.
    if (err === 'hireLimit') return lockTag(T('hud.levelN', { level: nextHireLevel(s, def.zone) }));
    if (freeHire(s)) return actionButton({ label: T('hud.hireFree'), icon: '🎟️', tone: 'gold', disabled: !region(s), onClick: hire });
    return actionButton({ label: T('hud.hire'), cost, disabled: err === 'coins' || !region(s), note: err === 'coins' ? needMore(cost - s.player.coins) : null, onClick: hire });
  }
  function hireView(s, now, zone) {
    const wait = poolRefreshIn(s, zone, now);
    // A free refresh is due: draw a new board (not a player action, so no toast when it cannot run).
    if (wait <= 0 && !refreshingPool && !ctx.isAuto?.()) {
      refreshingPool = true;
      queueMicrotask(() => { refreshingPool = false; store.dispatch('staff/refreshPool', { zone, roll: Math.random() }); });
    }
    // The team is capped at the player level, so a new hire normally gets a working slot; the bench note only shows
    // when old saves (or a level drop) left more units than slots.
    const capped = hireCapReached(s, zone), full = freeSlots(s, zone) <= 0;
    const note = h('p', { class: `hud-sm-note${capped || full ? ' is-warn' : ''}` }, capped
      ? T('hud.sm.hireCap', { n: zoneUnits(s, zone).length, max: hireCap(s, zone), level: nextHireLevel(s, zone) })
      : full ? T('hud.sm.hireBench', { n: activeCount(s, zone), max: slots(s, zone), pct: Math.round(UPKEEP.benchRatio * 100), min: UPKEEP.perMinutes })
        : T('hud.sm.hireSlot', { n: freeSlots(s, zone) }));
    const cards = h('div', { class: 'hud-cards hud-cards--wide' });
    applicants(s, zone).forEach((a, index) => {
      const def = STAFF[a.type], tr = TRAITS[a.trait];
      const stats = h('span', { class: 'hud-sm-statchips' }, ...STAT_ORDER.map(k => h('span', { class: 'hud-sm-statchip', attrs: { title: T(`hud.stat.${k}`) } }, `${STAT_ICON[k]} ${a.stats?.[k] ?? 1}`)));
      cards.append(h('div', { class: `hud-card hud-card--static hud-card--applicant${a.perk ? ' is-rare' : ''}` },
        h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
        h('span', { class: 'hud-card-name' }, a.name),
        h('span', { class: 'hud-card-meta' }, `${tr.icon} ${T(`staff.trait.${a.trait}`)}`, ' · ', T(`staff.${a.type}`)),
        perkBadge(a.perk),
        a.perk ? h('span', { class: 'hud-card-fx' }, T(`hud.sm.perkFx.${a.perk}`, PERK_FX)) : null,
        a.perk ? h('span', { class: 'hud-sm-rival' }, T('hud.sm.rivalWants')) : null,
        stats,
        h('span', { class: 'hud-card-fx' }, T(`staff.traitFx.${a.trait}.${zone}`)),
        h('q', { class: 'hud-card-quote' }, T(`staff.intro.${a.trait}.${a.intro}`)),
        full ? h('span', { class: 'hud-sub' }, T('hud.sm.benchCost', { coins: fmt(UPKEEP.benchRatio * def.cost), min: UPKEEP.perMinutes })) : null,
        hireFoot(s, recruitError(s, zone, index), def, a.cost, () => act('staff/recruit', { zone, index }))));
    });
    const refresh = h('div', { class: 'hud-row' },
      h('span', { class: 'hud-sub' }, T('hud.staff.newIn', { min: Math.max(1, Math.ceil(wait / 60000)) })),
      actionButton({ id: 'refreshApplicants', label: T('hud.staff.refresh'), icon: '🔄', tone: 'plain', cost: RECRUIT.refreshCost,
        disabled: s.player.coins < RECRUIT.refreshCost, onClick: () => act('staff/refreshPool', { zone, roll: Math.random(), paid: true }) }));
    const robots = h('div', { class: 'hud-cards hud-cards--wide' });
    for (const type of STAFF_ORDER.filter(id => STAFF[id].zone === zone && STAFF[id].kind === 'robot')) {
      const def = STAFF[type], owned = zoneUnits(s, zone).filter(u => u.type === type).length;
      robots.append(h('div', { class: 'hud-card hud-card--static' },
        h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
        h('span', { class: 'hud-card-name' }, T(`staff.${type}`)),
        h('span', { class: 'hud-card-meta' }, T(`hud.zone.${def.zone}`), ' · ', T(`hud.kind.${def.kind}`), owned ? ` · ${T('hud.sm.owned', { n: owned })}` : ''),
        h('span', { class: 'hud-card-fx' }, staffEffect(type)),
        h('span', { class: 'hud-card-fx' }, T('hud.sm.robotNote')),
        hireFoot(s, staffError(s, type), def, def.cost, () => act('staff/hire', { type }))));
    }
    return h('div', null, note,
      h('h3', { class: 'hud-sm-h' }, `🧑 ${T('hud.sm.applicants')}`), cards, refresh,
      h('h3', { class: 'hud-sm-h' }, `🤖 ${T('hud.staff.tabRobots')}`), robots);
  }

  // ---------- Báo cáo ----------
  function reportView(s, now, zone) {
    const win = ledgerWindow(s, now, BOOKS.mvpMinutes), profit = win.earned - win.spent;
    const tile = (label, value, cls = '') => h('div', { class: `hud-sm-cell ${cls}` }, h('small', null, label), h('strong', null, value));
    const units = zoneUnits(s, zone);
    const ranked = [...units].sort((a, b) => unitProfit(b) - unitProfit(a));
    const mvp = s.staff.mvp && unitOf(s, s.staff.mvp.uid) ? s.staff.mvp : null;
    const rank = h('ol', { class: 'hud-sm-rank' }, ...ranked.map((u, i) => {
      const b = u.book || {}, p = unitProfit(u);
      return h('li', null, h('button', { type: 'button', class: 'hud-sm-rank-row', on: { click: () => goTo({ uid: u.uid }) } },
        h('span', { class: 'hud-sm-rank-n' }, i === 0 && p > 0 ? '🥇' : `${i + 1}.`),
        h('span', { class: 'hud-sm-rank-name' }, `${STAFF[u.type].icon} ${nameOf(u)}`),
        h('span', { class: 'hud-sm-rank-nums' }, `+${fmt(b.earned || 0)} −${fmt(b.spent || 0)} = `, h('strong', { class: p < 0 ? 'is-bad' : 'is-good' }, `${p < 0 ? '−' : ''}${fmt(Math.abs(p))}`))));
    }));
    const tips = tipsOf(s, now, zone);
    const journal = (s.staff.journal || []).map(e => h('li', { class: 'hud-sm-jrow' },
      h('span', { class: 'hud-sm-jico', attrs: { 'aria-hidden': 'true' } }, JOURNAL_ICON[e.type] || '•'),
      h('span', { class: 'hud-sm-jtext' }, journalText(s, e)),
      h('small', { class: 'hud-sm-jago' }, ago(now - (e.at || now)))));
    return h('div', null,
      section('hud.sm.sec.window', h('div', { class: 'hud-sm-grid hud-sm-grid--3' },
        tile(T('hud.sm.book.earned'), coinAmount(win.earned)), tile(T('hud.sm.book.spent'), coinAmount(win.spent)),
        tile(T('hud.sm.book.profit'), `${profit < 0 ? '−' : ''}${fmt(Math.abs(profit))}`, profit < 0 ? 'is-bad' : 'is-good')),
        h('p', { class: 'hud-sub' }, T('hud.sm.windowNote', { min: BOOKS.mvpMinutes }))),
      section('hud.sm.sec.mvp', h('p', { class: 'hud-line' }, mvp ? T('hud.sm.mvp', { name: mvp.name || nameOf(unitOf(s, mvp.uid)), coins: fmt(mvp.earned) }) : T('hud.sm.mvpNone', { min: BOOKS.mvpMinutes }))),
      section('hud.sm.sec.rank', units.length ? rank : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.noTeamShort'))),
      section('hud.sm.sec.tips', h('ul', { class: 'hud-sm-tips' }, ...tips.map(t => h('li', null, t)))),
      section('hud.sm.sec.journal', journal.length ? h('ul', { class: 'hud-sm-journal' }, ...journal) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.journalEmpty'))));
  }
  const ago = ms => (ms < 60000 ? T('hud.sm.ago.now') : T('hud.sm.ago.min', { n: Math.floor(ms / 60000) }));
  function journalText(s, e) {
    const u = e.uid ? unitOf(s, e.uid) : null;
    const name = e.name || (u ? nameOf(u) : T('hud.sm.someone'));
    const x = e.extra;
    switch (e.type) {
      case 'nagged': return T(x?.ok ? 'hud.sm.j.naggedOk' : 'hud.sm.j.naggedNo', { name });
      case 'cared': return T('hud.sm.j.cared', { name, care: typeof x === 'string' ? T(`hud.sm.care.${x}`) : '' });
      case 'upgraded': return T('hud.sm.j.upgraded', { name, stat: x?.stat ? T(`hud.stat.${x.stat}`) : '', to: x?.to ?? '' });
      case 'left': return T('hud.sm.j.left', { name, why: T(`hud.sm.why.${typeof x === 'string' ? x : 'fired'}`) });
      case 'poachStarted': case 'poachRefused': return T(`hud.sm.j.${e.type}`, { name, rival: typeof x === 'string' ? x : '' });
      default: return T(`hud.sm.j.${e.type}`, { name });
    }
  }
  // 2–3 tips from what the team shows now and what the journal says happened.
  function tipsOf(s, now, zone) {
    const out = [];
    const units = zoneUnits(s, zone).filter(u => hereOf(s, u));
    const times = (uid, type) => (s.staff.journal || []).filter(e => e.uid === uid && e.type === type).length;
    for (const u of units.filter(x => !isRobot(x))) {
      const n = times(u.uid, 'slacked');
      if (n >= 2) { out.push(T('hud.sm.tip.slack', { name: nameOf(u), n })); break; }
    }
    const tired = units.filter(u => !isRobot(u) && u.active && ['tired', 'exhausted'].includes(stateKey(s, u, now)));
    if (tired.length) out.push(T('hud.sm.tip.tired', { name: nameOf(tired[0]), n: tired.length }));
    const hungry = units.find(u => !isRobot(u) && u.active && ['hungry', 'starving'].includes(stateKey(s, u, now)));
    if (hungry) out.push(T('hud.sm.tip.hungry', { name: nameOf(hungry), fee: fmt(CARE.food) }));
    const sulky = units.find(u => !isRobot(u) && (u.morale ?? VITALS.start.morale) < RIVAL.targetMorale);
    if (sulky) out.push(T('hud.sm.tip.morale', { name: nameOf(sulky) }));
    for (const u of units.filter(isRobot)) {
      const hot = times(u.uid, 'overheat'), jam = times(u.uid, 'jam');
      if (hot >= 1 && partTier(u, 'cooler') < PART_COST.maxTier) { out.push(T('hud.sm.tip.cooler', { name: nameOf(u), n: hot })); break; }
      if (jam >= 2 && partTier(u, 'frame') < PART_COST.maxTier) { out.push(T('hud.sm.tip.frame', { name: nameOf(u), n: jam })); break; }
      if ((u.wear ?? 100) < ROBOT_WEAR.lowWear) { out.push(T('hud.sm.tip.service', { name: nameOf(u) })); break; }
    }
    if (zone === 'shop') {
      const hard = (region(s)?.shop.orders || []).filter(o => isHardDrink(o.drink) && o.stage !== 'served').length;
      if (hard && !units.some(u => u.active && canBrew(u, QUALITY.hardDrinks[0]) && !isRobot(u))) out.push(T('hud.sm.tip.hard', { n: hard, acc: QUALITY.hardLevel }));
    }
    const points = units.find(u => !isRobot(u) && STAT_ORDER.some(k => !statError(s, u, k)));
    if (points) out.push(T('hud.sm.tip.points', { name: nameOf(points) }));
    const bench = units.filter(u => !isRobot(u) && !u.active).length;
    if (bench && freeSlots(s, zone) > 0) out.push(T('hud.sm.tip.freeSlot', { n: freeSlots(s, zone) }));
    if (!out.length) out.push(T(units.length ? 'hud.sm.tip.fine' : 'hud.sm.tip.hire'));
    return out.slice(0, 3);
  }

  // ---------- API ----------
  const api = {
    el,
    get isOpen() { return st.open; },
    /** The full modal covers the world (open and not collapsed to the strip). */
    get covering() { return st.open && !st.collapsed; },
    get collapsed() { return st.open && st.collapsed; },
    /** Opens the modal (on a unit's Detail with `uid`, or a tab). */
    open({ uid = null, tab = null } = {}) {
      const was = st.open;
      if (body.dataset.screen) scrollMem[body.dataset.screen] = body.scrollTop;
      st.open = true;
      st.collapsed = false;
      st.uid = uid && unitOf(store.state, uid) ? uid : null;
      if (tab) st.tab = tab;
      else if (!was && !st.uid && !zoneUnits(store.state, zoneNow()).length) st.tab = 'hire'; // nobody yet: straight to hiring
      el.hidden = false;
      ctx.root.dataset.sheet = 'staff';
      ctx.root.dataset.staff = '1';
      paint(true);
      if (!timer) timer = setInterval(() => paint(), REFRESH_MS);
      if (!was) close.focus?.({ preventScroll: true });
    },
    close() {
      if (!st.open) return;
      if (body.dataset.screen) scrollMem[body.dataset.screen] = body.scrollTop;
      st.open = false;
      st.collapsed = false;
      st.uid = null;
      clearInterval(timer); timer = null;
      pending = false;
      el.hidden = true;
      body.replaceChildren(); delete body.dataset.screen;
      strip.replaceChildren();
      delete ctx.root.dataset.staff;
      ctx.onStaffClosed?.();
    },
    /** Escape / back: strip → Detail, Detail → list, list → closed. */
    back: () => goBack(),
    /** Store changed: repaints only what changed. */
    refresh() { paint(); },
    rerender,
    /** Finds an element inside the open modal (tutorial pointer). */
    query: sel => (st.open ? el.querySelector(sel) : null),
    dispose() {
      clearInterval(timer); timer = null;
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      el.remove();
    },
  };
  return api;
}
