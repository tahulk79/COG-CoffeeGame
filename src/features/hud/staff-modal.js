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
import { CROP_ORDER } from '../../core/config/economy.js';
import { countryRecipes, SUPPLY, FARMLAB, methodKey } from '../../core/config/research.js';
import { TASKS, PENALTY, HISTORY, GM, gmCandidatesFor, gmSalary, GEAR, gearTier, SOFTWARE, softwarePrice, hasSoftware, WARRANTY, PROFILE, CAREER, CRAFT, rankOf, craftLevel, STAFF, STAFF_ORDER, TRAITS, RECRUIT, ROBOT_TASKS, ROBOT_PARTS, PART_ORDER, PART_COST, WORKER_TASKS, TASK_LIMIT, SMART_RULES, QUALITY, TEND, MISTAKES, STAFF_BREAKS, SKILL, RARE, STAT_ORDER, LEVEL_STEP, VITALS, UPKEEP, RIVAL, BOOKS, ROBOT_WEAR, CARE, statOf, statCap, taskLimit, energyMax, unitLevel, mistakeChance, hasRule, batteryMinutes, slackMul, partTier, robotTask, heatPerMin, jamChance, isHardDrink, UPGRADE_GATE } from '../../core/config/economy.js';
import { region, regionGame, level, hireCap, hireCapReached, slots, activeCount, freeSlots, zoneUnits, staffError, freeHire, applicants, recruitError, poolRefreshIn, unitStars, unitOf, statError, statPrice, partError, partPrice, unitState, careCost, careError, quickFix, upkeepOf, upkeepPer, fireRefund, ledgerWindow, unitProfit, poachOf, canBrew, dayKey, lastDays, dayRow, dayKpis, daysSince, unitGrade, teamKpi, robotPayback, REPORT_PERIODS, SPEND_CATS, periodKeys, teamMoney, teamRanking, nextRank, promoteError, canPromote, rankHolder, tenureDays, tenureShiftDays, tenureMinLeft, robotRoom, wageArrears, gmQuitArrears, zoneLeaders, warrantyLeft, gearPrice, gearError, softwareError, tendPlots, gearStockOf, gmUnlocked, gmOf, gmBoard, gmBoardRefreshIn, gmPay, gmBudgetLeft, gmPlan, gmPermission, gmAdvisorOf, chaosOf, calmCost, chaosSlackMul, gmMood, followerWage, countryNow, recipeFound, contractOf, cropUnlocked, methodOf, trialsHere, buyerNow, gmPoachOf, gmRequests, gmLog, unitLog, teamJournal, gmCareWallet, gmCareWalletLeft, gmBacklog, gmWaiting, gmStrike, apologiseCost, gmBudgetCap, gmLicensed, licenceError, licencePrice, gmTrainCost, gmTrainError, gmHighValue, histRows, upgradeOptions, throughputShare } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, fmt, gmReasonText } from './text.js';
import { formatNumber } from '../../i18n/index.js';
import { staffEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';
import { rowText } from './inbox.js';

const REFRESH_MS = 1000;
const isRobot = u => STAFF[u?.type]?.kind === 'robot';
const nameOf = u => (u?.name ? u.name : T(`staff.${u?.type || 'farmhand'}`));
const ZONE_RULES = { shop: ['urgent', 'twoCups', 'chain', 'restock'], farm: ['ripeFirst', 'playerCrop', 'quick', 'twoPlots'] };
const ZONE_MISTAKES = { shop: ['spill', 'wrongTable'], farm: ['unripe', 'crooked'] };
const RANK_ICON = { apprentice: '🌱', staff: '👕', skilled: '🛠️', lead: '🎖️', manager: '👑' };
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
const JOURNAL_ICON = { autoCare: '🤖', promoted: '🎖️', steppedDown: '🔽', nudged: '👉', managerCare: '👑', slacked: '📱', nagged: '🗣️', cared: '💝', upgraded: '⬆️', hired: '🤝', benched: '🪑', activated: '▶️', poachStarted: '💼', poachRefused: '🙅', kept: '🤝', left: '👋', jam: '⚙️', overheat: '🔥' };

export function createStaffModal(ctx) {
  const store = ctx.store;
  const st = { open: false, tab: 'team', filter: 'all', uid: null, ptab: 'overview', period: 'today', collapsed: false };
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
  const screenKey = () => (st.uid ? `unit:${st.uid}:${st.ptab}` : st.tab === 'report' ? `tab:report:${st.period}` : `tab:${st.tab}:${st.filter}`);
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
    const node = st.uid ? detailView(s, now, zone, unitOf(s, st.uid)) : st.tab === 'hire' ? hireView(s, now, zone) : st.tab === 'report' ? reportView(s, now, zone) : st.tab === 'gm' ? gmView(s, now, zone) : teamView(s, now, zone);
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
    if (next.uid !== undefined && next.uid !== st.uid && next.ptab === undefined) next = { ...next, ptab: 'overview' }; // another profile opens on its overview
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
    if (key === 'bench') return isRobot(u) ? T('hud.sm.now.benchRobot', { coins: fmt(upkeepOf(u)), min: UPKEEP.perMinutes }) : T('hud.sm.now.bench', { coins: fmt(upkeepOf(u)), min: UPKEEP.perMinutes });
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
        bar('🔥', T('hud.sm.bar.heat'), heat, 100, heat >= ROBOT_WEAR.heatBadAt ? 'bad' : heat >= ROBOT_WEAR.heatWarnAt ? 'warn' : 'ok'),
        bar('🔧', T('hud.sm.bar.wear'), wear, 100, wear < ROBOT_WEAR.lowWear ? 'bad' : wear < 60 ? 'warn' : 'ok'),
        full ? h('p', { class: 'hud-sub' }, T(u.stopped?.kind === 'battery' ? 'hud.sm.batteryEmpty' : 'hud.sm.batteryOk', { min: batteryMinutes(u) })) : null);
    }
    const e = u.energy ?? 100, m = u.morale ?? VITALS.start.morale, f = u.fullness ?? 100;
    return h('div', { class: 'hud-sm-bars' },
      bar('⚡', T('hud.sm.bar.energy'), e, energyMax(u), e < VITALS.tiredBelow ? 'bad' : e < VITALS.warnBelow ? 'warn' : 'ok'),
      bar('😊', T('hud.sm.bar.morale'), m, 100, m < VITALS.sulkBelow ? 'bad' : m < RIVAL.targetMorale ? 'warn' : 'ok'),
      full ? bar('🍔', T('hud.sm.bar.fullness'), f, 100, f < VITALS.hungryBelow ? 'bad' : f < VITALS.warnBelow ? 'warn' : 'ok') : null);
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
      isRobot(u) ? T(`hud.staff.task.${robotTask(u)}`) : `${RANK_ICON[rankOf(u)] || ''} ${T(`hud.cr.rank.${rankOf(u)}`)} · ${T('hud.staff.lv', { level: unitLevel(u) })}`].join(' · ');
  }
  const perkBadge = perk => (perk ? h('span', { class: 'hud-sm-perk', attrs: { title: T(`hud.sm.perkFx.${perk}`, PERK_FX) } }, `${PERK_ICON[perk] || '⭐'} ${T('hud.sm.rare')} · ${T(`hud.sm.perk.${perk}`)}`) : null);

  // ---------- header ----------
  function summaryView(s, now, zone) {
    const here = region(s) ? zoneUnits(s, zone).filter(u => hereOf(s, u)) : [];
    const bench = here.filter(u => !u.active).length;
    const win = teamMoney(s, now, '10m', zone); // this game's team only
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
    const left = Math.max(0, Math.ceil(p.leftMs / 1000)); // played time (the inbox clock)
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
      // Four tabs on a phone: words only (the icons pushed "Tuyển dụng" / "Quản lý" and their badges out of view).
      tab('team', T('hud.sm.tab.team'), problems), tab('hire', T('hud.sm.tab.hire')), tab('report', T('hud.sm.tab.report')),
      tab('gm', T('hud.gm.tab'), gmRequests(s).length + (gmPoachOf(s) ? 1 : 0) + (s.gm?.chaos || gmStrike(s) ? 1 : 0)));
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
      avatarOf(s, u, key),
      h('span', { class: 'hud-sm-card-text' },
        h('strong', { class: 'hud-sm-card-name' }, nameOf(u), u.perk ? ' ⭐' : '', ready ? h('span', { class: 'hud-unit-tag is-ready' }, '⬆️') : null, poached ? h('span', { class: 'hud-sm-tag-bad' }, '💼') : null),
        h('small', { class: 'hud-sm-card-meta' }, headLine(u), gradePill(unitGrade(s, u, dayKey(now)))),
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
  // ---------- 🏢 Quản lý: the general manager (docs/design/general-manager.md) ----------
  const STYLE_ICON = { careful: '🐢', balanced: '⚖️', bold: '🔥' };
  const MODE_ICON = { advisor: '💬', operator: '🧭', full: '🗝️' };
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  // The plan is cheap per call but the tab repaints every second: reuse it for the same save for up to 3 s.
  let planMemo = { s: null, at: 0, v: [] };
  function planOf(s, now) {
    if (planMemo.s !== s || now - planMemo.at > 3000) planMemo = { s, at: now, v: gmPlan(s, now) };
    return planMemo.v;
  }
  function gmView(s, now, zone) {
    const out = [];
    if (!gmUnlocked(s)) return h('div', null, section('hud.gm.sec.locked', h('p', { class: 'hud-line' }, T('hud.gm.locked', { level: GM.unlockLevel })), h('p', { class: 'hud-sub' }, T('hud.gm.what'))));
    const gm = gmOf(s);
    if (chaosOf(s)) out.push(chaosBlock(s, now));
    if (gm) {
      if (gmPoachOf(s)) out.push(gmPoachBlock(s, now, gm));
      out.push(gmCard(s, now, gm), gmPowers(s, now, gm), gmDayPlanBlock(s, now, gm), gmLicenceBlock(s, now, gm), gmWorth(s, now, gm), gmRequestsBlock(s, now));
    }
    if (gmAdvisorOf(s)) out.push(gmSuggestions(s, now, gm));
    if (!gm) out.push(gmBoardBlock(s, now));
    if (gm || gmLog(s, 1).length) out.push(gmLogBlock(s, now));
    if (gm) out.push(h('div', { class: 'hud-sm-fire' }, actionButton({ id: 'gmFire', label: T('hud.gm.fire'), tone: 'plain', onClick: () => gmFire() })));
    return h('div', null, ...out);
  }
  function gmCard(s, now, gm) {
    const days = daysSince(gm.hiredAt || now, now);
    return h('div', { class: 'hud-sm-dhead hud-pf-id' },
      h('span', { class: 'hud-sm-avatar hud-sm-avatar--big hud-gm-ava', attrs: { 'aria-hidden': 'true' } }, gm.gender === 'male' ? '👨‍💼' : '👩‍💼'),
      h('div', { class: 'hud-sm-dhead-text' },
        h('strong', { class: 'hud-sm-dname hud-gm-name' }, T('hud.gm.title', { name: gm.name })),
        h('small', { class: 'hud-pf-who' }, `${stars(gm.skill)} · ${STYLE_ICON[gm.style]} ${T(`hud.gm.style.${gm.style}`)} · ${T('hud.gm.days', { n: days })}`),
        h('span', { class: 'hud-pf-tags' }, tag(`${MODE_ICON[s.gm.mode]} ${T(`hud.gm.mode.${s.gm.mode}`)}`, 'gold'),
          tag(T('hud.gm.loyalty', { n: Math.round(gm.loyalty) }), gm.loyalty >= GM.loyalty.refuse ? 'good' : '')),
        h('small', { class: 'hud-sub' }, T(`hud.gm.styleFx.${gm.style}`)),
        moodLine(s, now), backlogLine(s)));
  }
  // Ignored requests pile up (management-rules §4.3): Chờ lệnh / dễ bị dụ / Đình công, and the apology that clears it.
  function backlogLine(s) {
    const n = gmBacklog(s), strike = gmStrike(s);
    if (!n && !strike) return null;
    const cost = apologiseCost(s), short = s.player.coins < cost;
    const key = strike ? 'hud.inbox.backlog.strike' : n >= PENALTY.backlog.poachAt ? 'hud.inbox.backlog.poachable' : gmWaiting(s) ? 'hud.inbox.backlog.waiting' : 'hud.inbox.backlog.some';
    return h('div', { class: `hud-report ${strike || n >= PENALTY.backlog.poachAt ? 'hud-report--bad' : 'hud-report--warn'}` },
      h('p', null, T(key, { n, wait: PENALTY.backlog.waitAt, poach: PENALTY.backlog.poachAt, strike: PENALTY.backlog.strikeAt })),
      actionButton({ label: T('hud.inbox.apologise'), icon: '🙏', cost, tone: 'gold', disabled: short, note: short ? needMore(cost - s.player.coins) : null,
        onClick: () => { const r = act('gm/apologise', {}); if (r.ok) sfx('coin.spend'); } }));
  }
  // Why the manager's spirits are sinking now (idle: you did everything; absent: nobody touched the game).
  function moodLine(s, now) {
    const m = gmMood(s, now);
    if (!m) return null;
    if (m.absent) return h('small', { class: 'hud-report hud-report--bad' }, T('hud.gm.moodAbsent', { min: Math.round(m.absentMin) }));
    if (m.idle) return h('small', { class: 'hud-report hud-report--warn' }, T('hud.gm.moodIdle', { min: Math.round(m.idleMin) }));
    return h('small', { class: 'hud-report hud-report--ok' }, T('hud.gm.moodOk'));
  }
  const segOf = (label, values, cur, fmtV, onPick, id) => h('div', { class: 'hud-tabs hud-sm-seg', attrs: { role: 'group', 'aria-label': label } },
    ...values.map(v => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `${id}-${v}` }, attrs: { 'aria-pressed': String(cur === v) }, on: { click: () => { if (cur !== v) onPick(v); } } }, fmtV(v))));
  function gmPowers(s, now, gm) {
    const g = s.gm, cap = gmBudgetCap(s), left = gmBudgetLeft(s, now);
    const share = Math.round((GM.modes[g.mode]?.share || 0) * 100);
    return section('hud.gm.sec.powers',
      segOf(T('hud.gm.sec.powers'), GM.modeOrder, g.mode, m => `${MODE_ICON[m]} ${T(`hud.gm.mode.${m}`)}`, m => act('gm/setMode', { mode: m }), 'gmMode'),
      h('p', { class: 'hud-sub' }, T(`hud.gm.modeFx.${g.mode}`)),
      h('p', { class: 'hud-sub' }, share ? T('hud.gm.salaryShare', { coins: fmt(gmPay(s)), min: GM.payMinutes, pct: share }) : T('hud.gm.salary', { coins: fmt(gmPay(s)), min: GM.payMinutes })),
      wageArrears(s).gm > 0 ? h('p', { class: 'hud-report hud-report--bad' }, T('hud.gm.arrears', { owed: fmt(Math.ceil(wageArrears(s).gm)), max: fmt(gmQuitArrears(s)) })) : null,
      g.mode !== 'advisor' ? h('div', null,
        h('p', { class: 'hud-sm-h' }, T('hud.gm.budget', { min: GM.windowMinutes })),
        segOf(T('hud.gm.budget', { min: GM.windowMinutes }), GM.budgets, g.budget, v => `🪙${v}`, v => act('gm/setBudget', { budget: v }), 'gmBudget'),
        h('div', { class: 'hud-sm-bar hud-sm-bar--ok hud-pf-payback' },
          h('span', { class: 'hud-sm-bar-track', attrs: { role: 'progressbar', 'aria-label': T('hud.gm.budgetUsed'), 'aria-valuemin': '0', 'aria-valuemax': String(cap), 'aria-valuenow': String(cap - left) } },
            h('span', { style: { width: `${cap ? Math.round((cap - left) / cap * 100) : 0}%` } })),
          h('span', { class: 'hud-sm-bar-num' }, `${fmt(cap - left)}/${fmt(cap)}`)),
        gm.style === 'careful' ? h('p', { class: 'hud-sub' }, T('hud.gm.carefulHalf')) : null,
        h('p', { class: 'hud-sm-h' }, T('hud.gm.bigLimit')),
        segOf(T('hud.gm.bigLimit'), GM.bigLimits, g.bigLimit, v => `🪙${fmt(v)}`, v => act('gm/setBigLimit', { limit: v }), 'gmBig'),
        h('p', { class: 'hud-sub' }, T('hud.gm.bigNote', { coins: fmt(g.bigLimit) })),
        g.mode === 'full' ? h('p', { class: 'hud-sub' }, T('hud.gm.fullBudget', { n: GM.modes.full.budgetMul })) : null,
        h('p', { class: 'hud-sub' }, T('hud.gm.highValue', { coins: fmt(gmHighValue(s)) })),
        h('p', { class: 'hud-sub' }, T('hud.gm.alwaysAsk'))) : null,
      h('p', { class: 'hud-sub' }, T('hud.gm.awayNote', { max: GM.away.capMinutes, op: Math.round(GM.away.share.operator * 100), full: Math.round(GM.away.share.full * 100) })),
      h('p', { class: 'hud-sub' }, T('hud.gm.neverReal')));
  }
  // Kế hoạch ngày (management-rules §3.4): crop mix per lot, the 20-minute target, when the next plan comes.
  function gmDayPlanBlock(s, now, gm) {
    const pl = s.gm.plan;
    if (s.gm.mode === 'advisor') return section('hud.gm.sec.dayPlan', h('p', { class: 'hud-line hud-line--muted' }, T('hud.gm.plan.advisor')));
    if (!pl) return section('hud.gm.sec.dayPlan', h('p', { class: 'hud-line hud-line--muted' }, T('hud.gm.plan.none')));
    const share = {};
    for (const c of Object.values(pl.crops || {})) share[c] = (share[c] || 0) + 1;
    const lots = Object.keys(pl.crops || {}).length || 1;
    const mix = Object.entries(share).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${T(`crop.${c}`)} ${Math.round(n / lots * 100)}%`).join(' · ');
    const next = pl.atPlayed + GM.plan.everyMin * 60000 - (s.clock?.played || 0);
    return section('hud.gm.sec.dayPlan',
      h('p', { class: 'hud-line' }, T('hud.gm.plan.line', { mix: mix || '—', coins: fmt(pl.target) })),
      h('p', { class: 'hud-sub' }, T('hud.gm.plan.next', { t: mmss(next), min: GM.plan.everyMin })),
      h('div', { class: 'hud-row' }, actionButton({ label: T('hud.gm.plan.now'), icon: '🗓️', tone: 'plain', disabled: !!gmStrike(s), onClick: () => act('gm/planDay', {}) })));
  }
  // Giấy phép (§2.5): the player's licences — what the manager may do; Đào tạo: his next skill step.
  function gmLicenceBlock(s, now, gm) {
    const rows = GM.licences.groups.map(grp => {
      const owned = gmLicensed(s, grp), err = licenceError(s, grp), price = licencePrice(grp);
      const btn = owned ? tag(T('hud.gm.lic.owned'), 'good')
        : actionButton({ label: T('hud.gm.lic.buy'), cost: price, tone: 'gold', disabled: !!err, note: err === 'coins' ? needMore(price - s.player.coins) : err === 'level' ? T('hud.levelN', { level: GM.licences.unlockLevel }) : null,
          onClick: () => { const r = act('gm/buyLicence', { group: grp }); if (r.ok) sfx('coin.spend'); } });
      return h('div', { class: 'hud-sm-part' }, h('span', { class: 'hud-sm-part-text' }, h('strong', null, T(`hud.gm.lic.${grp}`)), h('small', null, T(`hud.gm.licFx.${grp}`))), btn);
    });
    const tErr = gmTrainError(s), tCost = gmTrainCost(gm);
    const train = gm.training
      ? h('p', { class: 'hud-sub' }, T('hud.gm.train.busy', { skill: gm.training.to, t: mmss(gm.training.untilPlayed - (s.clock?.played || 0)) }))
      : tErr === 'maxLevel' ? h('p', { class: 'hud-sub' }, T('hud.gm.train.max'))
      : h('div', { class: 'hud-sm-part' }, h('span', { class: 'hud-sm-part-text' }, h('strong', null, T('hud.gm.train.title', { skill: (gm.skill || 1) + 1 })),
        h('small', null, T('hud.gm.train.fx', { min: GM.training.shiftDays * CAREER.shiftDayMin }))),
        actionButton({ label: T('hud.gm.train.go'), cost: tCost, tone: 'gold', disabled: !!tErr, note: tErr === 'coins' ? needMore(tCost - s.player.coins) : null,
          onClick: () => { const r = act('gm/train', {}); if (r.ok) sfx('coin.spend'); } }));
    return section('hud.gm.sec.licences', h('p', { class: 'hud-sub' }, T('hud.gm.lic.note')), ...rows, train);
  }
  // Is the GM worth it: today's team profit (this game) against the GM's pay today, jobs done.
  function gmWorth(s, now, gm) {
    const day = (s.gm.days || []).find(d => d.d === dayKey(now)) || { actions: 0, salary: 0, spent: 0 };
    const money = teamMoney(s, now, 'today', zoneNow());
    // Running profit before the GM's own pay: hiring and upgrades are investments, not running costs.
    const profit = money.earned - (money.spent - money.cats.hire - money.cats.upgrade) + day.salary;
    const ratio = day.salary > 0 ? Math.round(profit / day.salary * 10) / 10 : null;
    const cell = (label, value, cls = '') => h('div', { class: `hud-sm-cell hud-pf-kpi ${cls}` }, h('small', null, label), h('strong', null, value));
    return section('hud.gm.sec.worth', h('div', { class: 'hud-sm-grid hud-pf-kpis' },
      cell(T('hud.gm.w.profit'), Math.round(profit) > 0 ? coinAmount(Math.round(profit)) : `${profit < 0 ? '−' : ''}${fmt(Math.abs(Math.round(profit)))}`, profit < 0 ? 'is-bad' : 'is-good'),
      cell(T('hud.gm.w.salary'), day.salary > 0 ? coinAmount(Math.round(day.salary)) : '0'),
      cell(T('hud.gm.w.actions'), fmt(day.actions)),
      cell(T('hud.gm.w.ratio'), ratio == null ? '—' : `×${ratio}`, ratio != null && ratio < 1 ? 'is-bad' : '')),
      h('p', { class: 'hud-sub' }, T('hud.gm.w.note', { spent: fmt(Math.round(day.spent)) })));
  }
  function gmRequestsBlock(s, now) {
    const list = gmRequests(s);
    const rows = list.map(q => h('div', { class: 'hud-gm-req' },
      h('p', { class: 'hud-gm-req-top' }, h('strong', null, `⚠️ ${gmReasonText(q.reason)}`), h('small', null, mmss(q.untilPlayed - (s.clock?.played || 0)))),
      h('p', { class: 'hud-sub' }, q.cost > 0 ? T('hud.gm.reqCost', { coins: fmt(q.cost) }) : T('hud.gm.reqFree')),
      h('div', { class: 'hud-row' },
        actionButton({ label: T('hud.gm.approve'), icon: '✅', tone: 'go', disabled: s.player.coins < q.cost, note: s.player.coins < q.cost ? needMore(q.cost - s.player.coins) : null,
          onClick: () => { const r = act('gm/approve', { id: q.id }); if (r.ok) sfx(q.cost > 0 ? 'coin.spend' : 'ui.click'); } }),
        actionButton({ label: T('hud.gm.deny'), tone: 'plain', onClick: () => act('gm/deny', { id: q.id }) }))));
    return section('hud.gm.sec.requests', list.length ? h('div', { class: 'hud-gm-reqs' }, ...rows) : h('p', { class: 'hud-line hud-line--muted' }, T(s.gm.mode === 'operator' ? 'hud.gm.noRequests' : 'hud.gm.noRequestsMode')),
      h('p', { class: 'hud-sub' }, T('hud.gm.reqNote', { min: TASKS.life.care })),
      h('p', { class: 'hud-sub' }, T('hud.inbox.wallet', { left: fmt(gmCareWalletLeft(s)), max: fmt(gmCareWallet(s)), min: GM.careWallet.windowMin })));
  }
  // Suggestions: the plan, best first, with what the GM will do about each one; hand one over with a tap.
  function gmSuggestions(s, now, gm) {
    const pending = new Set(gmRequests(s).map(q => q.key));
    const plan = planOf(s, now).filter(item => !pending.has(item.key)).slice(0, 6); // waiting ones are in «Chờ bạn duyệt»
    const rows = plan.map(item => {
      const perm = gm ? gmPermission(s, item, now) : 'suggest';
      const uid = item.act.payload?.uid;
      // Growth (hire, promote, stats, machines) is yours: the button takes you there.
      const btn = item.tier === 'advice'
        ? (uid ? actionButton({ label: T('hud.gm.yourJob'), icon: '👉', tone: 'plain', onClick: () => goTo({ uid, tab: 'team', ptab: item.act.type === 'staff/upgradeStat' || item.act.type === 'staff/promote' ? (item.act.type === 'staff/promote' ? 'overview' : 'stats') : item.act.type === 'staff/fire' ? 'history' : 'parts' }) })
          : item.act.type === 'staff/recruit' ? actionButton({ label: T('hud.gm.yourJob'), icon: '👉', tone: 'plain', onClick: () => goTo({ tab: 'hire' }) })
          : item.act.type === 'farmlab/open' ? actionButton({ label: T('hud.gm.yourJob'), icon: '🌱', tone: 'plain', onClick: () => { api.close(); ctx.onTool?.('seeds'); } })
          : item.act.type === 'supply/open' ? actionButton({ label: T('hud.gm.yourJob'), icon: '🚚', tone: 'plain', onClick: () => { api.close(); ctx.onTool?.('supply'); } })
          : item.act.type === 'research/open' ? actionButton({ label: T('hud.gm.yourJob'), icon: '🧪', tone: 'plain', onClick: () => { api.close(); ctx.onTool?.('menu'); } })
          : item.act.type === 'gm/buyLicence' ? actionButton({ label: T('hud.gm.lic.buy'), cost: item.cost, tone: 'gold', disabled: s.player.coins < item.cost,
            onClick: () => { const r = act('gm/buyLicence', item.act.payload); if (r.ok) sfx('coin.spend'); } }) : null)
        : perm === 'do' ? h('span', { class: 'hud-tag' }, T('hud.gm.willDo'))
        : perm === 'file' && gm ? h('span', { class: 'hud-tag' }, T('hud.gm.willAsk'))
        : perm === 'loan' && gm ? h('span', { class: 'hud-tag' }, T('hud.gm.willLoan'))
        : actionButton({ label: T('hud.gm.delegate'), icon: '🤝', cost: item.cost > 0 ? item.cost : undefined, tone: 'gold', disabled: s.player.coins < item.cost,
          onClick: () => { const r = act('gm/delegate', { key: item.key, roll: Math.random() }); if (r.ok) sfx(item.cost > 0 ? 'coin.spend' : 'ui.click'); } });
      return h('div', { class: 'hud-sm-part' }, h('span', { class: 'hud-sm-part-text' }, h('strong', null, gmReasonText(item.reason)),
        h('small', null, T(`hud.gm.tier.${item.tier}`, { coins: fmt(item.cost) }))), btn);
    });
    const who = gm ? null : h('p', { class: 'hud-report hud-report--warn' }, T('hud.gm.standIn', { name: nameOf(gmAdvisorOf(s)) }));
    return section('hud.gm.sec.plan', who, rows.length ? h('div', null, ...rows) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.gm.planEmpty')));
  }
  function gmBoardBlock(s, now) {
    const board = gmBoard(s), wait = gmBoardRefreshIn(s, now);
    const rows = board.map((c, i) => h('div', { class: 'hud-sm-part' },
      h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${c.gender === 'male' ? '👨‍💼' : '👩‍💼'} ${c.name} · ${stars(c.skill)}`),
        h('small', null, `${STYLE_ICON[c.style]} ${T(`hud.gm.style.${c.style}`)} · ${T('hud.gm.loyalty', { n: c.loyalty })} · ${T('hud.gm.salary', { coins: fmt(gmSalary(c, 'operator')), min: GM.payMinutes })}`),
        h('small', null, T(`hud.gm.styleFx.${c.style}`))),
      actionButton({ id: `gmHire-${i}`, label: T('hud.gm.hire'), cost: c.fee, tone: 'gold', disabled: s.player.coins < c.fee, note: s.player.coins < c.fee ? needMore(c.fee - s.player.coins) : null,
        onClick: () => { const r = act('gm/hire', { index: i }); if (r.ok) sfx('reward.levelup'); } })));
    const refresh = actionButton({ label: wait > 0 ? T('hud.gm.refreshPaid') : T('hud.gm.refresh'), icon: '🔄', cost: wait > 0 ? GM.board.refreshCost : undefined, tone: 'plain',
      onClick: () => act('gm/refreshBoard', { roll: Math.random(), paid: wait > 0 }) });
    return section('hud.gm.sec.board', h('p', { class: 'hud-sub' }, T('hud.gm.what')), ...rows,
      h('div', { class: 'hud-row' }, refresh), wait > 0 ? h('p', { class: 'hud-sub' }, T('hud.gm.refreshIn', { t: mmss(wait) })) : null);
  }
  function gmPoachBlock(s, now, gm) {
    const p = gmPoachOf(s), short = s.player.coins < p.fee;
    return h('div', { class: 'hud-sm-poach', attrs: { role: 'alert' } },
      h('p', { class: 'hud-sm-poach-text' }, T('hud.gm.poach', { rival: GM.poach.rival, name: gm.name, t: mmss(p.leftMs), loyalty: Math.round(gm.loyalty), need: GM.loyalty.refuse })),
      h('div', { class: 'hud-sm-poach-btns' },
        actionButton({ label: T('hud.gm.keepBonus'), icon: '🎁', cost: p.fee, tone: 'gold', disabled: short, note: short ? needMore(p.fee - s.player.coins) : null, onClick: () => { const r = act('gm/keep', { how: 'bonus' }); if (r.ok) sfx('coin.spend'); } }),
        actionButton({ label: T('hud.gm.keepRaise', { pct: Math.round(GM.raiseStep * 100) }), icon: '📈', tone: 'plain', onClick: () => act('gm/keep', { how: 'raise' }) }),
        actionButton({ label: T('hud.gm.letGo'), tone: 'plain', onClick: () => act('gm/letGo', {}) })));
  }
  function chaosBlock(s, now) {
    const c = chaosOf(s), half = chaosSlackMul(s, zoneNow()) < GM.chaos.slackMul, cost = calmCost(s);
    return h('div', { class: 'hud-sm-poach hud-gm-chaos', attrs: { role: 'alert' } },
      h('p', { class: 'hud-sm-poach-text' }, T('hud.gm.chaos', { min: Math.max(1, Math.round((now - c.since) / 60000)) })),
      h('p', { class: 'hud-sub' }, T(half ? 'hud.gm.chaosHalf' : 'hud.gm.chaosFx')),
      h('div', { class: 'hud-sm-poach-btns' },
        actionButton({ id: 'gmCalm', label: T('hud.gm.calm'), icon: '🤝', cost, tone: 'gold', disabled: s.player.coins < cost, note: s.player.coins < cost ? needMore(cost - s.player.coins) : null, onClick: () => { const r = act('gm/calm', {}); if (r.ok) sfx('coin.spend'); } })),
      h('p', { class: 'hud-sub' }, T('hud.gm.chaosHire')));
  }
  function gmLogBlock(s, now) {
    const rows = gmLog(s, 15).map(e => h('li', { class: 'hud-sm-jrow hud-hist-row is-manager' },
      h('span', { class: 'hud-sm-jico', attrs: { 'aria-hidden': 'true' } }, GM_LOG_ICON[e.type] || '•'),
      h('span', { class: 'hud-sm-jtext' }, gmLogText(e)),
      h('small', { class: 'hud-sm-jago' }, whenText(e.at, now))));
    return section('hud.gm.sec.log', rows.length ? h('ul', { class: 'hud-sm-journal' }, ...rows) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.pf.logEmpty')));
  }
  const GM_LOG_ICON = { dayPlan: '🗓️', licence: '📜', trainStart: '🎓', trained: '🎓', topUpSeen: '💎', away: '🌙', idle: '😴', absent: '🚪', missedYou: '🕰️', did: '✅', approved: '👍', asked: '⚠️', expired: '⛔', denied: '✖️', failed: '❗', hired: '🤝', left: '👋', poached: '💼', refused: '🙅', kept: '🤝', calmed: '🕊️', unpaid: '💸' };
  function gmLogText(e) {
    const x = e.extra || {};
    const what = x.reason ? gmReasonText(x.reason) : '';
    switch (e.type) {
      case 'did': return x.cost > 0 ? T('hud.gm.log.didCost', { what, coins: fmt(x.cost) }) : T('hud.gm.log.did', { what });
      case 'approved': return T('hud.gm.log.approved', { what });
      case 'asked': return T('hud.gm.log.asked', { what });
      case 'expired': return T('hud.gm.log.expired', { what });
      case 'denied': return T('hud.gm.log.denied', { what });
      case 'failed': return T('hud.gm.log.failed', { what });
      case 'hired': return T('hud.gm.log.hired', { name: x.name || '', coins: fmt(x.fee || 0) });
      case 'left': return T(x.why === 'fired' ? 'hud.gm.log.fired' : x.why === 'quit' ? 'hud.gm.log.quit' : 'hud.gm.log.left', { name: x.name || '' });
      case 'poached': return T('hud.gm.log.poached', { rival: x.rival || '' });
      case 'refused': return T('hud.gm.log.refused', { rival: x.rival || '' });
      case 'kept': return T(x.how === 'raise' ? 'hud.gm.log.keptRaise' : 'hud.gm.log.keptBonus');
      case 'calmed': return T('hud.gm.log.calmed', { coins: fmt(x.coins || 0) });
      case 'unpaid': return x.owed ? T('hud.gm.log.unpaidOwed', { coins: fmt(x.coins || 0), owed: fmt(Math.ceil(x.owed)) }) : T('hud.gm.log.unpaid', { coins: fmt(x.coins || 0) });
      case 'loanLate': return T('hud.gm.log.loanLate', { owed: fmt(x.owed || 0) });
      case 'away': return T('hud.gm.log.away', { min: x.min ?? '', earned: fmt(x.earned || 0), salary: fmt(x.salary || 0) });
      case 'idle': return T('hud.gm.log.idle', { min: x.min ?? '' });
      case 'absent': return T('hud.gm.log.absent', { min: x.min ?? '' });
      case 'missedYou': return T('hud.gm.log.missedYou', { hours: x.hours ?? '', drop: x.drop ?? '' });
      case 'later': return T('hud.gm.log.later', { what });
      case 'waiting': return T('hud.gm.log.waiting', { n: x.backlog ?? '' });
      case 'strike': return T('hud.gm.log.strike');
      case 'strikeOver': return T('hud.gm.log.strikeOver');
      case 'apologised': return T('hud.gm.log.apologised', { coins: fmt(x.coins || 0) });
      case 'dayPlan': return T('hud.hist.dayPlan', { by: gmOf(store.state)?.name || '', mix: (x.mix || []).map(m => `${T(`crop.${m.crop}`)} ${m.pct}%`).join(' · ') || '—', coins: fmt(x.target || 0) });
      case 'licence': return T('hud.hist.licence', { lic: T(`hud.gm.lic.${x.group || 'beans'}`), coins: fmt(x.coins || 0) });
      case 'trainStart': return T('hud.hist.trainStart', { by: gmOf(store.state)?.name || '', skill: x.to ?? '', coins: fmt(x.coins || 0) });
      case 'trained': return T('hud.hist.trained', { by: gmOf(store.state)?.name || '', skill: x.skill ?? '' });
      case 'topUpSeen': return T('hud.hist.topUpSeen');
      default: return e.type;
    }
  }
  async function gmFire() {
    const gm = gmOf(store.state);
    if (!gm) return;
    const yes = await ctx.confirm({ title: T('hud.gm.fireTitle', { name: gm.name }), body: T('hud.gm.fireBody', { name: gm.name }), confirmLabel: T('hud.gm.fire') });
    if (yes) act('gm/fire', {});
    rerender();
  }
  // ---------- gear + software (docs/design/staff-profile.md, step 4) ----------
  const gearFx = (item, t) => {
    const I = GEAR.items[item];
    if (t === 0) return T('hud.g4.none');
    if (I.walk) return T('hud.g4.fx.boots', { pct: Math.round((I.walk[t] - 1) * 100) });
    if (I.drain) return T('hud.g4.fx.hat', { pct: Math.round((1 - I.drain[t]) * 100) });
    if (I.unripe) return T('hud.g4.fx.shears', { pct: Math.round((1 - I.unripe[t]) * 100) });
    if (I.spill) return T('hud.g4.fx.tray', { pct: Math.round((1 - I.spill[t]) * 100) });
    if (I.brew) return T('hud.g4.fx.kettle', { pct: Math.round((I.brew[t] - 1) * 100) });
    return T('hud.g4.fx.can', { n: TEND.plots + I.plots[t] });
  };
  // Payback hint under an upgrade button (balance pass 2026-11-08): the planner's own value model (upgradeOptions:
  // value per played minute, × the measured load share), so the player sees what the manager sees before paying.
  // what = { stat } | { item } | { part }; null = no hint (a quality step: its worth is fewer mistakes, not coins).
  function paybackHint(s, u, what, err = null) {
    if (err && err !== 'coins') return null; // locked for another reason (points, level, cap): no verdict on its worth
    const k = Object.keys(what)[0], o = upgradeOptions(s, u).find(x => x.what && x.what[k] === what[k]);
    if (o?.quality) return null;
    if (!o) return h('small', { class: 'hud-sm-payback is-low' }, T('hud.sm.notWorth'));
    const min = Math.round(o.payback);
    return h('small', { class: `hud-sm-payback${min > UPGRADE_GATE.latePaybackMin ? ' is-low' : ''}` }, T('hud.sm.payback', { min: fmt(min) }));
  }
  // Café with more hands than walk-ins: say so once, above the stat / gear rows.
  const notStaffBound = (s, u) => (STAFF[u.type]?.zone === 'shop' && throughputShare(s, u) === 0 ? h('p', { class: 'hud-sm-warn' }, T('hud.sm.notStaffBound')) : null);
  function gearBlock(s, u) {
    const rows = (GEAR.zone[STAFF[u.type].zone] || []).map(item => {
      const t = gearTier(u, item), err = gearError(s, u, item), price = gearPrice(u, item);
      const fx = t >= GEAR.maxTier ? gearFx(item, t) : `${gearFx(item, t)} → ${gearFx(item, t + 1)}`;
      const btn = err === 'maxLevel' ? h('span', { class: 'hud-tag' }, T('hud.maxLevel'))
        : actionButton({ label: T('hud.g4.buy'), icon: '🛒', cost: price, tone: 'plain', disabled: err === 'coins', note: err === 'coins' ? needMore(price - s.player.coins) : null,
          onClick: () => { const r = act('staff/buyGear', { uid: u.uid, item }); if (r.ok) sfx('coin.spend'); } });
      return h('div', { class: 'hud-sm-part' },
        h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${GEAR.items[item].icon} ${T(`hud.g4.item.${item}`)} · ${t}/${GEAR.maxTier}`), h('small', null, fx), t < GEAR.maxTier ? paybackHint(s, u, { item }, err) : null), btn);
    });
    // The store: gear left by workers you let go, free to hand to this one (only pieces better than what it wears).
    const stock = gearStockOf(s, STAFF[u.type].zone);
    const stockRows = stock.map(g => {
      const better = g.tier > gearTier(u, g.item);
      return h('div', { class: 'hud-sm-part' },
        h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${GEAR.items[g.item].icon} ${T(`hud.g4.item.${g.item}`)} · ${g.tier}/${GEAR.maxTier}`), h('small', null, gearFx(g.item, g.tier))),
        better ? actionButton({ label: T('hud.g4.give'), icon: '🎁', tone: 'go', onClick: () => { const r = act('staff/equipGear', { uid: u.uid, index: g.i }); if (r.ok) sfx('ui.click'); } })
          : h('span', { class: 'hud-tag' }, T('hud.g4.notBetter')));
    });
    return h('div', null,
      section('hud.g4.sec.gear', h('p', { class: 'hud-sub' }, T('hud.g4.gearNote2', { spent: fmt(u.gearSpent || 0) })), ...rows),
      section('hud.g4.sec.stock', stockRows.length ? h('div', null, ...stockRows) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.g4.stockEmpty'))));
  }
  function softwareBlock(s, u) {
    const rows = SOFTWARE.order.map(pack => {
      const err = softwareError(s, u, pack), price = softwarePrice(u, pack);
      const btn = err === 'owned' ? h('span', { class: 'hud-tag' }, `✅ ${T('hud.g4.installed')}`)
        : err === 'level' ? lockTag(T('hud.levelN', { level: SOFTWARE.packs[pack].level }))
        : actionButton({ label: T('hud.g4.install'), icon: '💾', cost: price, tone: 'plain', disabled: err === 'coins', note: err === 'coins' ? needMore(price - s.player.coins) : null,
          onClick: () => { const r = act('staff/buySoftware', { uid: u.uid, pack }); if (r.ok) sfx('reward.levelup'); } });
      return h('div', { class: 'hud-sm-part' },
        h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${SOFTWARE.packs[pack].icon} ${T(`hud.g4.pack.${pack}`)}`),
          h('small', null, T(`hud.g4.packFx.${pack}`, { s: SOFTWARE.packs.autoUnjam.seconds, stars: SOFTWARE.packs.precision.stars }))), btn);
    });
    return section('hud.g4.sec.software', h('p', { class: 'hud-sub' }, T('hud.g4.softwareNote')), ...rows,
      h('p', { class: 'hud-sub' }, warrantyLeft(u) > 0 ? T('hud.g4.warranty', { n: warrantyLeft(u), max: WARRANTY.repairs }) : T('hud.g4.warrantyOver', { max: WARRANTY.repairs })));
  }
  // ---------- career + craft (docs/design/staff-profile.md, step 3) ----------
  // Ladder, what the next rank needs (level, days, a free seat), the promote button, a lead / manager's effects,
  // allowance and "step down".
  function careerBlock(s, now, u) {
    const rank = rankOf(u), next = nextRank(u), zone = STAFF[u.type].zone, err = promoteError(s, u, now);
    const ladder = h('ol', { class: 'hud-cr-ladder', attrs: { 'aria-label': T('hud.cr.ladder') } }, ...CAREER.ranks.map((r, i) => {
      const at = CAREER.ranks.indexOf(rank);
      return h('li', { class: i < at ? 'is-done' : i === at ? 'is-now' : '' }, `${RANK_ICON[r]} ${T(`hud.cr.rank.${r}`)}`);
    }));
    const out = [ladder];
    if (CAREER.onePerZone.includes(rank)) {
      const working = zoneLeaders(s, zone, now).some(x => x.uid === u.uid);
      out.push(h('p', { class: `hud-report hud-report--${working ? 'ok' : 'warn'}` }, T(working ? 'hud.cr.leading' : 'hud.cr.notLeading')),
        h('p', { class: 'hud-sub' }, T(`hud.cr.fx.${rank}`, fxArgs()), ' ', T('hud.cr.allowance', { coins: CAREER.allowance[rank], min: UPKEEP.perMinutes })),
        h('div', { class: 'hud-row' }, actionButton({ label: T('hud.cr.stepDown'), tone: 'plain', onClick: () => stepDown(u.uid) })));
    }
    if (next) {
      const need = CAREER.need[next], sd = tenureShiftDays(u), lvl = unitLevel(u);
      const ok = (v, n) => (v >= n ? '✅' : '⬜');
      out.push(h('p', { class: 'hud-sub' }, T('hud.cr.needs', { rank: T(`hud.cr.rank.${next}`) })),
        h('ul', { class: 'hud-cr-needs' },
          h('li', null, `${ok(lvl, need.level)} ${T('hud.cr.needLevel', { n: need.level, now: lvl })}`),
          need.sd ? h('li', null, `${ok(sd, need.sd)} ${T('hud.cr.needSd', { n: need.sd, now: sd, min: CAREER.shiftDayMin })}`,
            sd < need.sd ? h('small', { class: 'hud-sub' }, ` · ${T('hud.cr.sdLeft', { min: tenureMinLeft(u, need.sd) })}`) : null) : null,
          CAREER.onePerZone.includes(next) ? (holder => h('li', null, holder ? `⬜ ${T('hud.cr.seatTaken', { name: nameOf(holder) })}` : `✅ ${T('hud.cr.seatFree')}`))(rankHolder(s, zone, next)) : null,
          CAREER.auto.includes(next) ? h('li', { class: 'hud-sub' }, T('hud.cr.auto')) : null));
      if (!CAREER.auto.includes(next)) {
        out.push(actionButton({ id: 'staffPromote', label: T('hud.cr.promote', { rank: T(`hud.cr.rank.${next}`) }), icon: '🎖️', tone: 'go', disabled: !!err,
          onClick: () => { const r = act('staff/promote', { uid: u.uid }); if (r.ok) { sfx('reward.levelup'); ctx.toast(T('hud.cr.promoted', { name: nameOf(u), rank: T(`hud.cr.rank.${next}`) }), 'good'); } } }));
        if (CAREER.allowance[next]) out.push(h('p', { class: 'hud-sub' }, T(`hud.cr.fx.${next}`, fxArgs()), ' ', T('hud.cr.allowance', { coins: CAREER.allowance[next], min: UPKEEP.perMinutes })));
        if (!err && Number.isFinite(u.eligibleAt)) out.push(h('p', { class: 'hud-report hud-report--warn' }, T('hud.cr.waiting', { min: CAREER.waitMinutes })));
      }
    } else out.push(h('p', { class: 'hud-sub' }, T('hud.cr.top')));
    return section('hud.cr.sec', ...out);
  }
  const fxArgs = () => ({ regen: CAREER.lead.moraleRegenPerMin, s: CAREER.lead.nudgeSeconds });
  async function stepDown(uid) {
    const u = unitOf(store.state, uid);
    if (!u) return;
    const yes = await ctx.confirm({ title: T('hud.cr.stepDownTitle', { name: nameOf(u) }), body: T('hud.cr.stepDownBody', { name: nameOf(u), morale: CAREER.stepDownMorale }), confirmLabel: T('hud.cr.stepDown') });
    if (yes) act('staff/stepDown', { uid });
    rerender();
  }
  // Craft skills: one row per job type of the zone (step, progress to the next, what the next step gives).
  function craftBlock(u) {
    const tasks = CRAFT.tasks[STAFF[u.type].zone] || [];
    const rows = tasks.map(t => {
      const n = u.craft?.[t] || 0, lv = craftLevel(u, t), nextAt = CRAFT.steps[lv], prevAt = lv ? CRAFT.steps[lv - 1] : 0;
      const pct = nextAt ? Math.round((n - prevAt) / (nextAt - prevAt) * 100) : 100;
      const mistake = Object.entries(CRAFT.mistakeTask).find(([, task]) => task === t)?.[0];
      return h('div', { class: 'hud-sm-stat hud-cr-craft' },
        h('div', { class: 'hud-sm-stat-top' }, h('strong', null, T(`hud.staff.task.${t}`)), h('span', { class: `hud-pf-tag${lv ? ' is-gold' : ''}` }, T(`hud.cr.step.${lv}`))),
        h('div', { class: 'hud-sm-bar hud-sm-bar--ok hud-pf-payback' },
          h('span', { class: 'hud-sm-bar-track', attrs: { role: 'progressbar', 'aria-label': T(`hud.staff.task.${t}`), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) } }, h('span', { style: { width: `${pct}%` } })),
          h('span', { class: 'hud-sm-bar-num' }, nextAt ? `${fmt(n)}/${fmt(nextAt)}` : fmt(n))),
        h('small', { class: 'hud-sm-stat-next' }, nextAt
          ? T(mistake ? 'hud.cr.nextFxMistake' : 'hud.cr.nextFx', { step: T(`hud.cr.step.${lv + 1}`), speed: Math.round(CRAFT.speedPerStep * (lv + 1) * 100), cut: Math.round(CRAFT.mistakeCutPerStep * (lv + 1) * 100) })
          : T('hud.cr.topFx', { speed: Math.round(CRAFT.speedPerStep * lv * 100), cut: Math.round(CRAFT.mistakeCutPerStep * lv * 100) })));
    });
    return section('hud.cr.craftSec', h('p', { class: 'hud-sub' }, T('hud.cr.craftNote')), ...rows);
  }
  // Personnel file (docs/design/staff-profile.md): an ID card (photo, who, since when), then tabs.
  //  worker: Tổng quan (now + care, today's grade + KPIs, 7-day profit, tasks) · Chỉ số (stats, how it works) · Lịch sử
  //  robot:  Tổng quan (now + care, today's run + grade, payback, 7-day profit, task) · Bộ phận (parts) · Bảo trì (log)
  const PROFILE_TABS = { worker: ['overview', 'stats', 'gear', 'history'], robot: ['overview', 'parts', 'service'] };
  function detailView(s, now, zone, u) {
    if (!u) return h('p', { class: 'hud-line' }, T('hud.sm.gone'));
    const robot = isRobot(u), tabsOf = PROFILE_TABS[robot ? 'robot' : 'worker'].filter(t => t !== 'gear' || (GEAR.zone[STAFF[u.type].zone] || []).length); // café gear later
    const ptab = tabsOf.includes(st.ptab) ? st.ptab : 'overview';
    const out = h('div', { class: 'hud-sm-detail' }, idCard(s, now, u),
      h('div', { class: 'hud-tabs hud-sm-ptabs', attrs: { role: 'group', 'aria-label': T('hud.pf.tabs') } },
        ...tabsOf.map(id => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `staffPTab-${id}` }, attrs: { 'aria-pressed': String(ptab === id) },
          on: { click: () => { if (st.ptab !== id) goTo({ ptab: id }); } } }, T(`hud.pf.tab.${id}`)))));
    if (ptab === 'overview') out.append(...overviewView(s, now, zone, u));
    else if (ptab === 'stats') out.append(statsBlock(s, u, zone), craftBlock(u), section('hud.staff.howTitle', howItWorks(u, STAFF[u.type].zone, infoOf(s, u))));
    else if (ptab === 'parts') out.append(partsBlock(s, u), softwareBlock(s, u), section('hud.staff.howTitle', howItWorks(u, STAFF[u.type].zone, infoOf(s, u))));
    else if (ptab === 'gear') out.append(gearBlock(s, u));
    else out.append(...historyView(s, now, u));
    return out;
  }
  // ID card: photo (the unit shot in the world, else its icon), name, who / since when, tags, what it does now.
  function idCard(s, now, u) {
    const def = STAFF[u.type], key = stateKey(s, u, now), robot = isRobot(u);
    const photo = hereOf(s, u) ? ctx.realm?.portrait?.(u.uid) : null;
    const since = Number.isFinite(u.hiredAt) ? u.hiredAt : u.book?.since;
    const days = Number.isFinite(since) ? daysSince(since, now) : 0;
    const date = Number.isFinite(since) ? dateText(since) : '—';
    const who = robot
      ? T('hud.pf.robotWho', { model: PROFILE.model[u.type] || T(`staff.${u.type}`), serial: u.serial || '—', date, days })
      : T('hud.pf.who', { age: u.age ?? '—', home: u.home || '—', date, days });
    const tags = robot
      ? [tag(`${JOB_ICON[robotTask(u)] || '🤖'} ${T(`hud.staff.task.${robotTask(u)}`)}`), tag(T('hud.pf.fixedStar')), warrantyLeft(u) > 0 ? tag(T('hud.g4.warrantyTag', { n: warrantyLeft(u) }), 'good') : null]
      : [tag(`${RANK_ICON[rankOf(u)]} ${T(`hud.cr.rank.${rankOf(u)}`)} · ${T('hud.staff.lv', { level: unitLevel(u) })}`, 'gold'), TRAITS[u.trait] ? tag(`${TRAITS[u.trait].icon} ${T(`staff.trait.${u.trait}`)}`) : null,
        tag('⭐'.repeat(unitStars(u)))];
    return h('div', { class: 'hud-sm-dhead hud-pf-id' },
      h('span', { class: `hud-sm-avatar hud-sm-avatar--big hud-pf-photo${photo ? ' has-photo' : ''}${armbandOf(u)}`, style: { '--hue': String(hueOf(u.uid)) }, attrs: { 'aria-hidden': 'true' } },
        photo ? h('img', { src: photo, alt: '', attrs: { width: '72', height: '72', draggable: 'false' } }) : def.icon,
        h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂')),
      h('div', { class: 'hud-sm-dhead-text' },
        h('strong', { class: 'hud-sm-dname' }, nameOf(u)),
        h('small', { class: 'hud-pf-who' }, who),
        h('span', { class: 'hud-pf-tags' }, ...tags, perkBadge(u.perk), u.follower ? tag(T('hud.follow.tag', { coins: followerWage(u), min: UPKEEP.perMinutes }), 'gold') : null),
        h('small', { class: `hud-report hud-report--${toneOf(key)}` }, nowLine(s, u, key, now, infoOf(s, u)))));
  }
  /** List avatar: the unit's photo when it is drawn here (cached by the realm), else its icon on a per-unit tint. */
  function avatarOf(s, u, key) {
    const photo = hereOf(s, u) ? ctx.realm?.portrait?.(u.uid) : null;
    return h('span', { class: `hud-sm-avatar hud-pf-photo${photo ? ' has-photo' : ''}${armbandOf(u)}`, style: { '--hue': String(hueOf(u.uid)) }, attrs: { 'aria-hidden': 'true' } },
      photo ? h('img', { src: photo, alt: '', attrs: { width: '48', height: '48', draggable: 'false' } }) : STAFF[u.type].icon,
      h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂'));
  }
  const tag = (text, tone = '') => h('span', { class: `hud-pf-tag${tone ? ` is-${tone}` : ''}` }, text);
  // Lead / manager-rank workers wear the gold armband (management-rules §6), in the world and on their avatar.
  const armbandOf = u => (GM.look.armbandRanks.includes(rankOf(u)) ? ' has-armband' : '');
  const hueOf = uid => ((parseInt(String(uid).replace(/\D+/g, ''), 10) || 0) * 67) % 360;
  const dateText = ms => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

  function overviewView(s, now, zone, u) {
    const def = STAFF[u.type], key = stateKey(s, u, now), info = infoOf(s, u), robot = isRobot(u), here = hereOf(s, u);
    const parts = [];
    // now: state, what to do, care, vitals, shift
    const cares = (robot ? ROBOT_CARE : WORKER_CARE).filter(k => careError(s, u, k, now) !== 'notNeeded');
    const care = cares.map(k => careButton(s, u, k, now));
    if (canTend(u, info)) care.push(tendButton(s, u));
    if (u.stopped && !cares.length && !robot) care.push(actionButton({ label: T('hud.staff.backToWork'), cost: u.stopped.fee, tone: 'gold', disabled: s.player.coins < (u.stopped.fee || 0), onClick: () => act('staff/resume', { uid: u.uid }) }));
    const shift = [];
    if (here) {
      const free = freeSlots(s, def.zone);
      const seg = (on, label) => h('button', { type: 'button', class: 'hud-tab', attrs: { 'aria-pressed': String(!!u.active === on) },
        disabled: on && !u.active && free <= 0, on: { click: () => { if (!!u.active !== on) act('staff/setActive', { uid: u.uid, active: on }); } } }, label);
      shift.push(h('div', { class: 'hud-tabs hud-sm-seg', attrs: { role: 'group', 'aria-label': T('hud.sm.sec.shift') } }, seg(true, `▶️ ${T('hud.sm.active')}`), seg(false, `🪑 ${T('hud.sm.bench')}`)),
        h('p', { class: 'hud-sub' }, !u.active && free <= 0 ? T('hud.sm.noSlot', { n: activeCount(s, def.zone), max: slots(s, def.zone) })
          : robot ? T('hud.sm.benchRobot') : T('hud.sm.benchCost', { coins: fmt(UPKEEP.benchRatio * def.cost), min: UPKEEP.perMinutes })),
        h('div', { class: 'hud-row' }, actionButton({ id: 'staffFocus', label: T('hud.sm.where'), icon: '📍', tone: 'plain', disabled: def.zone !== zone, onClick: () => focus(u.uid) })));
    } else shift.push(h('p', { class: 'hud-sub' }, T(u.assigned ? 'hud.staff.elsewhere' : 'hud.staff.idle')),
      h('div', { class: 'hud-row' }, actionButton({ label: T('hud.staff.assign'), disabled: !region(s), onClick: () => act('staff/assign', { uid: u.uid }) })));
    parts.push(section('hud.pf.sec.now',
      h('p', { class: `hud-sm-state hud-sm-state--${toneOf(key)}` }, h('span', { class: 'hud-sm-state-ico', attrs: { 'aria-hidden': 'true' } }, STATE_ICON[key] || '🙂'), T(`hud.sm.state.${key}`)),
      vitalBars(u, true, info),
      h('p', { class: 'hud-sm-todo' }, h('strong', null, T('hud.sm.todoTitle')), ' ', todoText(s, u, key, info)),
      care.length ? h('div', { class: 'hud-sm-care' }, care) : null,
      ...shift));
    parts.push(todayBlock(s, now, u));
    if (robot) parts.push(paybackBlock(now, u));
    parts.push(weekBlock(now, u));
    if (robot) parts.push(robotTaskBlock(s, u, info));
    else parts.push(careerBlock(s, now, u), taskBlock(s, u, zone));
    return parts;
  }

  // Today: grade against the zone's team + four KPIs with the change since yesterday.
  function todayBlock(s, now, u) {
    const robot = isRobot(u), today = dayKey(now), yday = lastDays(now, 2)[0];
    const k = dayKpis(dayRow(u, today)), y = dayKpis(dayRow(u, yday)), g = unitGrade(s, u, today);
    const delta = (a, b, fmtFn = v => `${Math.round(Math.abs(v) * 100)}%`) => {
      if (b == null || a == null || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) < 1e-9) return null;
      const up = a > b, rel = b !== 0 ? (a - b) / Math.abs(b) : null;
      return h('em', { class: up ? 'is-up' : 'is-down' }, `${up ? '▲' : '▼'}${rel == null ? '' : fmtFn(rel)}`);
    };
    const kpi = (label, value, d, note) => h('div', { class: 'hud-sm-cell hud-pf-kpi' }, h('small', null, label), h('strong', null, value, ' ', d), note ? h('small', null, note) : null);
    const pct = v => `${Math.round(v * 100)}%`;
    const hasY = y && y.shift >= 60;
    const tiles = robot ? [
      kpi(T('hud.pf.kpi.uptime'), k ? pct(k.att) : '—', k && hasY ? delta(k.att, y.att) : null),
      kpi(T('hud.pf.kpi.perHour'), k ? T('hud.pf.perHourV', { n: fmt(Math.round(k.perHour)) }) : '—', k && hasY ? delta(k.perHour, y.perHour) : null),
      kpi(T('hud.pf.kpi.runCost'), k ? T('hud.pf.coinsHour', { n: fmt(Math.round(k.costPerHour)) }) : '—', null),
      kpi(T('hud.pf.kpi.incidents'), T('hud.pf.incidentsV', incidentsToday(u, now)), null),
    ] : [
      kpi(T('hud.pf.kpi.perHour'), k ? T('hud.pf.perHourV', { n: fmt(Math.round(k.perHour)) }) : '—', k && hasY ? delta(k.perHour, y.perHour) : null),
      kpi(T('hud.pf.kpi.quality'), k ? pct(k.quality) : '—', null, k ? T('hud.pf.mistakesV', { n: k.mistakes }) : null),
      kpi(T('hud.pf.kpi.att'), k ? pct(k.att) : '—', k && hasY ? delta(k.att, y.att) : null),
      kpi(T('hud.pf.kpi.profit'), k ? coinAmount(Math.round(k.profit)) : '—', k && hasY ? delta(k.profit, y.profit) : null),
    ];
    const grade = g ? h('div', { class: 'hud-pf-grade' }, h('b', { class: `is-${g.letter[0].toLowerCase()}` }, g.letter), h('p', { class: 'hud-sub' }, gradeWhy(s, u, g, k, today)))
      : h('p', { class: 'hud-sub' }, T('hud.pf.noGrade'));
    return section(robot ? 'hud.pf.sec.run' : 'hud.pf.sec.today', grade, h('div', { class: 'hud-sm-grid hud-pf-kpis' }, ...tiles));
  }
  // One sentence on the grade: the best and the weakest part (vs the team), with numbers.
  function gradeWhy(s, u, g, k, key) {
    const names = Object.keys(g.parts);
    const best = names.reduce((a, b) => (g.parts[b] > g.parts[a] ? b : a));
    const worst = names.reduce((a, b) => (g.parts[b] < g.parts[a] ? b : a));
    const team = teamKpi(s, u, key, 'perHour');
    const vs = team > 0 ? Math.round((k.perHour / team - 1) * 100) : 0;
    const say = part => T(`hud.pf.why.${part}`, { vs: Math.abs(vs), faster: vs >= 0 ? T('hud.pf.faster') : T('hud.pf.slower'), att: Math.round(k.att * 100), n: k.mistakes, profit: fmt(Math.round(k.profit)) });
    // Only a part clearly above the team average is "strong", only one clearly below it is "weak".
    const par = PROFILE.grade.par, strong = g.parts[best] >= par + 5, weak = g.parts[worst] < par - 5 && worst !== best;
    if (!strong && !weak) return T('hud.pf.why.even', { score: g.score });
    return [strong ? `${T('hud.pf.good')} ${say(best)}` : null, weak ? `${T('hud.pf.weak')} ${say(worst)}` : null].filter(Boolean).join(' ');
  }
  function incidentsToday(u, now) {
    const key = dayKey(now), log = unitLog(u).filter(e => dayKey(e.at) === key);
    return { jam: log.filter(e => e.type === 'jam').length, hot: log.filter(e => e.type === 'overheat').length };
  }
  // The last 7 days of running profit as a small area chart (today emphasised).
  function weekBlock(now, u) {
    const keys = lastDays(now), vals = keys.map(k => { const kp = dayKpis(dayRow(u, k)); return kp ? Math.round(kp.profit) : 0; });
    const W = 280, H = 76, top = 16, base = 58, x = i => 12 + i * (W - 24) / (keys.length - 1);
    const max = Math.max(1, ...vals), min = Math.min(0, ...vals), y = v => base - (v - min) / (max - min || 1) * (base - top);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hud-pf-chart', role: 'img', 'aria-label': T('hud.pf.chartAria', { vals: vals.join(', ') }) },
      svgEl('line', { x1: 0, x2: W, y1: y(0), y2: y(0), class: 'hud-pf-axis' }),
      svgEl('polygon', { points: `${x(0)},${y(0)} ${pts} ${x(keys.length - 1)},${y(0)}`, class: 'hud-pf-area' }),
      svgEl('polyline', { points: pts, class: 'hud-pf-line' }),
      svgEl('circle', { cx: x(keys.length - 1), cy: y(vals[vals.length - 1]), r: 4, class: 'hud-pf-dot' }),
      svgText(x(keys.length - 1), Math.max(10, y(vals[vals.length - 1]) - 7), fmt(vals[vals.length - 1]), 'end', 'hud-pf-val'),
      svgText(x(0), H - 3, dayLabel(keys[0]), 'start'),
      svgText(x(keys.length - 1), H - 3, T('hud.pf.today'), 'end'));
    const total = vals.reduce((a, v) => a + v, 0);
    return section('hud.pf.sec.week', svg, h('p', { class: 'hud-sub' }, T('hud.pf.weekTotal', { coins: fmt(total) })));
  }
  const dayLabel = key => `${String(key % 100).padStart(2, '0')}/${String(Math.floor(key / 100) % 100).padStart(2, '0')}`;
  function svgEl(tagName, attrs, ...kids) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    for (const c of kids) if (c) n.append(c);
    return n;
  }
  const svgText = (x, y, text, anchor, cls = '') => { const t = svgEl('text', { x, y, 'text-anchor': anchor, class: `hud-pf-tick ${cls}` }); t.textContent = text; return t; };
  // Robot payback: what it earned back of its price + parts, and the resale price now.
  function paybackBlock(now, u) {
    const p = robotPayback(u, now), pct = p.pct == null ? 1 : Math.max(0, Math.min(1, p.pct));
    return section('hud.pf.sec.payback',
      h('div', { class: 'hud-sm-bar hud-sm-bar--ok hud-pf-payback' },
        h('span', { class: 'hud-sm-bar-track', attrs: { role: 'progressbar', 'aria-label': T('hud.pf.sec.payback'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct * 100)) } },
          h('span', { style: { width: `${Math.round(pct * 100)}%` } })),
        h('span', { class: 'hud-sm-bar-num' }, p.pct == null ? '—' : `${Math.max(0, Math.round(p.pct * 100))}%`)),
      h('p', { class: 'hud-sub' }, p.cost > 0
        ? T(p.net >= p.cost ? 'hud.pf.paidBack' : 'hud.pf.payback', { net: fmt(Math.max(0, Math.round(p.net))), cost: fmt(Math.round(p.cost)) })
        : T('hud.pf.paybackFree')),
      p.etaMinutes != null ? h('p', { class: 'hud-sub' }, T('hud.pf.eta', { min: fmt(p.etaMinutes) })) : null,
      h('p', { class: 'hud-sub' }, T('hud.pf.resale', { coins: fmt(fireRefund(u)) })));
  }
  function robotTaskBlock(s, u, info) {
    const cur = robotTask(u);
    const tasks = h('div', { class: 'hud-sm-chips', attrs: { role: 'group', 'aria-label': T('hud.staff.taskTitle') } },
      ...['auto', ...(ROBOT_TASKS[u.type] || [])].map(task => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(cur === task) },
        on: { click: () => act('staff/setTask', { uid: u.uid, task }) } }, T(`hud.staff.task.${task}`))));
    return section('hud.staff.taskTitle', tasks, h('p', { class: 'hud-sub' }, T(cur === 'auto' ? 'hud.staff.taskAuto' : 'hud.staff.taskFixed')),
      info?.task && cur === 'auto' ? h('p', { class: 'hud-sub' }, T('hud.sm.autoNow', { task: T(`hud.staff.task.${info.task}`) })) : null);
  }

  // History (workers) / Service log (robots): lifetime totals, the unit's own timeline, fire / sell.
  function historyView(s, now, u) {
    const robot = isRobot(u), b = u.book || {};
    const cell = (label, value, cls = '') => h('div', { class: `hud-sm-cell ${cls}` }, h('small', null, label), h('strong', null, value));
    const profit = unitProfit(u);
    const totals = section('hud.pf.sec.total', h('div', { class: 'hud-sm-grid hud-sm-grid--2' },
      cell(T('hud.sm.book.jobs'), fmt(b.jobs || 0)),
      cell(T('hud.sm.book.earned'), coinAmount(b.earned || 0)),
      cell(T('hud.sm.book.spent'), coinAmount(b.spent || 0)),
      robot ? cell(T('hud.pf.partsSpent'), coinAmount(u.partsSpent || 0)) : cell(T('hud.sm.book.mistakes'), fmt(b.mistakes || 0)),
      cell(T('hud.sm.book.profit'), `${profit < 0 ? '−' : ''}${fmt(Math.abs(profit))}`, profit < 0 ? 'is-bad' : 'is-good'),
      cell(T('hud.pf.daysOn'), T('hud.pf.daysV', { n: daysSince(u.hiredAt ?? b.since ?? now, now) }))));
    const all = unitLog(u);
    const log = robot ? all.filter(e => SERVICE_LOG.has(e.type) || (e.type === 'cared' && ROBOT_CARE.includes(e.extra))) : all;
    const rows = log.map(e => h('li', { class: 'hud-sm-jrow' },
      h('span', { class: 'hud-sm-jico', attrs: { 'aria-hidden': 'true' } }, logIcon(u, e)),
      h('span', { class: 'hud-sm-jtext' }, logText(u, e)),
      h('small', { class: 'hud-sm-jago' }, whenText(e.at, now))));
    const timeline = section(robot ? 'hud.pf.sec.service' : 'hud.pf.sec.timeline',
      rows.length ? h('ul', { class: 'hud-sm-journal hud-pf-timeline' }, ...rows) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.pf.logEmpty')));
    // The shared Nhật ký rows by or about this unit (management-rules §5): the manager's orders, tasks, jobs per minute.
    const shared = histRows(s, { uid: u.uid }).slice(0, HISTORY.profileRows);
    const sharedSec = shared.length ? section('hud.pf.sec.shared', h('ul', { class: 'hud-sm-journal hud-hist-list' }, ...shared.map(r => h('li', { class: `hud-sm-jrow hud-hist-row${r.actor === 'g1' || r.gm === 1 ? ' is-manager' : ''}` },
      h('span', { class: 'hud-sm-jtext' }, rowText(s, r)), h('small', { class: 'hud-sm-jago' }, whenText(r.at, now)))))) : null;
    const out = [totals, timeline, sharedSec].filter(Boolean);
    if (robot) {
      const svc = careError(s, u, 'service', now) !== 'notNeeded' ? careButton(s, u, 'service', now) : null;
      out.push(section('hud.pf.sec.care', h('p', { class: 'hud-sub' }, T('hud.pf.serviceTip', { low: ROBOT_WEAR.lowWear, wear: Math.round(u.wear ?? 100) })), svc ? h('div', { class: 'hud-sm-care' }, svc) : null));
    }
    const refund = fireRefund(u);
    out.push(h('div', { class: 'hud-sm-fire' }, actionButton({ id: 'staffFire', label: T(robot ? 'hud.sm.sell' : 'hud.sm.fire', { coins: fmt(refund) }), tone: 'plain', onClick: () => fire(u.uid) })));
    return out;
  }
  const SERVICE_LOG = new Set(['hired', 'jam', 'overheat', 'part', 'software', 'warranty', 'autoCare', 'benched', 'activated']);
  const LOG_ICON = { ...JOURNAL_ICON, followed: '🧳', part: '🔩', gear: '🎒', software: '💾', warranty: '🧾', autoCare: '🤖', mvp: '🏅', promoted: '🎖️', steppedDown: '🔽', nudged: '👉', managerCare: '👑', craft: '🧰' };
  const logIcon = (u, e) => (e.type === 'cared' && typeof e.extra === 'string' ? CARE_ICON[e.extra] || '💝' : e.type === 'hired' ? (isRobot(u) ? '📦' : '🤝') : LOG_ICON[e.type] || '•');
  function logText(u, e) {
    const x = e.extra, robot = isRobot(u);
    switch (e.type) {
      case 'hired': return T(robot ? 'hud.pf.log.bought' : 'hud.pf.log.hired', { coins: fmt(x?.paid ?? u.paid ?? 0) });
      case 'nagged': return T(x?.ok ? 'hud.pf.log.naggedOk' : 'hud.pf.log.naggedNo');
      case 'cared': return T('hud.pf.log.cared', { care: typeof x === 'string' ? T(`hud.sm.care.${x}`) : '' });
      case 'upgraded': return T('hud.pf.log.upgraded', { stat: x?.stat ? T(`hud.stat.${x.stat}`) : '', to: x?.to ?? '' });
      case 'part': return T('hud.pf.log.part', { part: x?.part ? T(`hud.staff.part.${x.part}`) : '', tier: x?.tier ?? '', coins: fmt(x?.coins || 0) });
      case 'mvp': return T('hud.pf.log.mvp', { coins: fmt(x?.earned || 0) });
      case 'promoted': return T('hud.pf.log.promoted', { rank: T(`hud.cr.rank.${x?.rank || 'staff'}`) });
      case 'steppedDown': return T('hud.pf.log.steppedDown', { rank: T(`hud.cr.rank.${x?.rank || 'skilled'}`) });
      case 'nudged': return T('hud.pf.log.nudged', { by: x?.by || T('hud.sm.someone') });
      case 'managerCare': return T('hud.pf.log.managerCare', { by: x?.by || T('hud.sm.someone'), care: T(`hud.sm.care.${x?.kind || 'coffee'}`) });
      case 'followed': return T(x?.robot ? 'hud.follow.logRobot' : 'hud.follow.log');
      case 'gear': if (x?.stock) return T('hud.pf.log.gearStock', { item: T(`hud.g4.item.${x.item || 'boots'}`), tier: x.tier ?? '' });
        return T('hud.pf.log.gear', { item: T(`hud.g4.item.${x?.item || 'boots'}`), tier: x?.tier ?? '', coins: fmt(x?.coins || 0) });
      case 'software': return T('hud.pf.log.software', { pack: T(`hud.g4.pack.${x?.pack || 'autoCharge'}`), coins: fmt(x?.coins || 0) });
      case 'warranty': return T('hud.pf.log.warranty', { n: x?.left ?? 0 });
      case 'autoCare': return T('hud.pf.log.autoCare', { care: T(`hud.sm.care.${typeof x === 'string' ? x : 'recharge'}`) });
      case 'craft': return T('hud.pf.log.craft', { task: T(`hud.staff.task.${x?.task || 'harvest'}`), step: T(`hud.cr.step.${x?.step || 1}`) });
      case 'poachStarted': return T('hud.pf.log.poachStarted', { rival: typeof x === 'string' ? x : '' });
      case 'poachRefused': return T('hud.pf.log.poachRefused', { rival: typeof x === 'string' ? x : '' });
      // rows from the unified history (management-rules §5): the manager's jobs and requests about this unit, job lists
      case 'did': case 'approved': return T(`hud.pf.log.gm.${e.type}`, { what: x?.reason ? gmReasonText(x.reason) : '' });
      case 'taskFiled': case 'taskExpired': case 'taskLate': return T(`hud.pf.log.gm.${e.type}`, { what: x?.reason ? gmReasonText(x.reason) : '' });
      case 'setTasks': return T('hud.pf.log.setTasks', { list: (x?.tasks || []).length ? x.tasks.map(k => T(`hud.staff.task.${k}`)).join(', ') : T('hud.staff.task.auto') });
      case 'robotTask': return T('hud.pf.log.setTasks', { list: T(`hud.staff.task.${x?.task || 'auto'}`) });
      default: return T(`hud.pf.log.${e.type}`);
    }
  }
  function whenText(at, now) {
    if (now - at < 60000) return T('hud.sm.ago.now');
    const d = daysSince(at, now), t = new Date(at), hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    return d === 0 ? hm : d === 1 ? T('hud.pf.yesterday', { hm }) : `${dateText(at)} ${hm}`;
  }
  function section(titleKey, ...children) {
    return h('section', { class: 'hud-sm-sec' }, h('h3', { class: 'hud-sm-h' }, T(titleKey)), ...children);
  }
  function todoText(s, u, key, info) {
    if (key === 'ok' || key === 'tired' || key === 'hungry') {
      if (!info?.job && info?.reason) {
        if (canTend(u, info)) return T('hud.rep.todo.growingTend', { fee: TEND.fee, n: tendPlots(u) });
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
      notStaffBound(s, u),
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
      n < SKILL.maxStat ? paybackHint(s, u, { stat }, err) : null,
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

  // Robot: four hardware parts (a robot never learns: only its hardware is upgraded).
  function partsBlock(s, u) {
    const parts = PART_ORDER.map(part => {
      const tier = partTier(u, part), err = partError(s, u, part), cost = partPrice(u, part), max = tier >= PART_COST.maxTier;
      const fx = max ? partLine(part, tier) : `${partLine(part, tier)} → ${partLine(part, tier + 1)}`;
      const btn = err === 'maxLevel' ? h('span', { class: 'hud-tag' }, T('hud.maxLevel'))
        : err === 'level' ? lockTag(T('hud.levelN', { level: PART_COST.tier3Level }))
        : actionButton({ label: T('hud.staff.upgrade'), icon: '⬆️', cost, tone: 'plain', disabled: err === 'coins', note: err === 'coins' ? needMore(cost - s.player.coins) : null,
          onClick: () => { const r = act('staff/upgradePart', { uid: u.uid, part }); if (r.ok) sfx('reward.levelup'); } });
      return h('div', { class: 'hud-sm-part' },
        h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${ROBOT_PARTS[part].icon} ${T(`hud.staff.part.${part}`)} · ${tier}/${PART_COST.maxTier}`), h('small', null, fx), max ? null : paybackHint(s, u, { part }, err)), btn);
    });
    return section('hud.staff.parts', h('p', { class: 'hud-sub' }, T('hud.pf.partsNote')), h('p', { class: 'hud-sub' }, T('hud.staff.quality', { stars: '⭐' }), ' · ', T('hud.staff.noHard')), ...parts);
  }
  function partLine(part, tier) {
    const P = ROBOT_PARTS[part];
    if (part === 'battery') return T('hud.sm.part.battery', { v: P.minutes[tier] });
    if (part === 'motor') return T('hud.sm.part.motor', { v: Math.round((P.speed[tier] - 1) * 100) });
    if (part === 'cooler') return T('hud.sm.part.cooler', { v: Math.round((1 - P.heatMul[tier]) * 100) });
    return T('hud.sm.part.frame', { v: Math.round((1 - P.jamMul[tier]) * 100) });
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
        steps.push(T('hud.how.farm3'), T('hud.how.farm4', { n: tendPlots(u) }), T('hud.how.farm5', { pause: on('quick', 'hud.how.quick', 'hud.how.slow') }));
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
    // Robot share (management-rules §2.1): robots ≤ half the slots, a robot never takes the last worker's place.
    if (err === 'robotShare') return lockTag(T('hud.sm.robotShare', { max: robotRoom(s, def.zone) + zoneUnits(s, def.zone).filter(x => STAFF[x.type].kind === 'robot').length }));
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
      : full ? T('hud.sm.hireBench', { n: activeCount(s, zone), max: slots(s, zone), pct: Math.round(UPKEEP.benchRatio * 100), rpct: Math.round(UPKEEP.robotStandbyRatio * 100), min: UPKEEP.perMinutes })
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
  // Report v2 (docs/design/staff-profile.md, step 2): period (10 phút · Hôm nay · 7 ngày), the zone team's money with the
  // change since the period before, where the money went, the A–D ranking (by day: the 10-minute view ranks today),
  // the MVP, the manager's tips and the journal.
  const gradePill = g => (g ? h('span', { class: `hud-pf-gpill is-${g.letter[0].toLowerCase()}`, attrs: { title: T('hud.rp.gradeTitle', { score: g.score }) } }, g.letter) : null);
  const CAT_COLOR = { care: '#e8b23e', upgrade: '#3f7c70', robot: '#5b8fb3', upkeep: '#b5523a', wage: '#c77d3a', hire: '#9a7bc0', research: '#6aa84f' };
  const CAT_ICON = { care: '💝', upgrade: '⬆️', robot: '🤖', upkeep: '🪑', wage: '🎖️', hire: '🤝', research: '🧪' };
  function reportView(s, now, zone) {
    const period = REPORT_PERIODS.includes(st.period) ? st.period : 'today';
    const money = teamMoney(s, now, period, zone);
    const seg = h('div', { class: 'hud-tabs hud-sm-seg hud-rp-period', attrs: { role: 'group', 'aria-label': T('hud.rp.period') } },
      ...REPORT_PERIODS.map(p => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `staffPeriod-${p}` }, attrs: { 'aria-pressed': String(period === p) },
        on: { click: () => { if (st.period !== p) goTo({ period: p }); } } }, T(`hud.rp.p.${p}`))));
    // money tiles
    const delta = (a, b) => {
      if (!money.prev || !money.prev.rows || !(b > 0) || Math.abs(a - b) < .005) return null; // nothing to compare with
      const up = a > b;
      return h('em', { class: up ? 'is-up' : 'is-down' }, `${up ? '▲' : '▼'}${Math.round(Math.abs(a - b) / b * 100)}%`);
    };
    const tile = (label, value, d, cls = '') => h('div', { class: `hud-sm-cell hud-pf-kpi ${cls}` }, h('small', null, label), h('strong', null, value, ' ', d));
    const signed = v => `${v < 0 ? '−' : ''}${fmt(Math.abs(Math.round(v)))}`;
    const perCoin = money.spent > 0 ? Math.round(money.earned / money.spent * 10) / 10 : null;
    const tiles = h('div', { class: 'hud-sm-grid hud-pf-kpis' },
      tile(T('hud.rp.earned'), coinAmount(Math.round(money.earned)), delta(money.earned, money.prev?.earned || 0)),
      tile(T('hud.rp.spent'), coinAmount(Math.round(money.spent)), delta(money.spent, money.prev?.spent || 0)),
      tile(T('hud.rp.profit'), signed(money.profit), null, money.profit < 0 ? 'is-bad' : 'is-good'),
      tile(T('hud.rp.perCoin'), perCoin == null ? '—' : T('hud.rp.perCoinV', { n: formatNumber(perCoin, { maximumFractionDigits: 1 }) }), null));
    const moneyNote = h('p', { class: 'hud-sub' }, T(`hud.rp.note.${period}`, { min: BOOKS.mvpMinutes }));
    // where the money went
    const cats = SPEND_CATS.filter(c => money.cats[c] > 0);
    let spendBody;
    if (!cats.length) spendBody = h('p', { class: 'hud-line hud-line--muted' }, T('hud.rp.noSpend'));
    else {
      const W = 280, total = cats.reduce((a, c) => a + money.cats[c], 0);
      let x = 0;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} 18`, class: 'hud-rp-bar', role: 'img', 'aria-label': cats.map(c => `${T(`hud.rp.cat.${c}`)} ${Math.round(money.cats[c])}`).join(', ') },
        ...cats.map((c, i) => {
          const w = Math.max(2, money.cats[c] / total * W - (i < cats.length - 1 ? 2 : 0));
          const r = svgEl('rect', { x: x.toFixed(1), y: 2, width: w.toFixed(1), height: 14, rx: 3, fill: CAT_COLOR[c] });
          x += money.cats[c] / total * W;
          return r;
        }));
      spendBody = h('div', null, svg, h('ul', { class: 'hud-rp-legend' }, ...cats.map(c => h('li', null,
        h('span', { class: 'hud-rp-swatch', style: { background: CAT_COLOR[c] }, attrs: { 'aria-hidden': 'true' } }),
        h('span', { class: 'hud-rp-cat' }, `${CAT_ICON[c]} ${T(`hud.rp.cat.${c}`)}`),
        h('strong', null, fmt(Math.round(money.cats[c]))),
        h('small', null, `${Math.round(money.cats[c] / total * 100)}%`)))));
    }
    // ranking
    const keys = periodKeys(now, period) || [dayKey(now)];
    const ranked = teamRanking(s, keys, zone);
    const rank = h('ol', { class: 'hud-sm-rank' }, ...ranked.map((r, i) => {
      const u = r.u, p = r.profit;
      return h('li', null, h('button', { type: 'button', class: 'hud-sm-rank-row', on: { click: () => goTo({ uid: u.uid }) } },
        h('span', { class: 'hud-sm-rank-n' }, i === 0 && p > 0 ? '🥇' : `${i + 1}.`),
        avatarOf(s, u, stateKey(s, u, now)),
        h('span', { class: 'hud-sm-rank-name' }, nameOf(u), h('small', null, [rankOf(u) ? T(`hud.cr.rank.${rankOf(u)}`) : null, r.k ? T('hud.rp.rowSub', { jobs: fmt(r.k.jobs), att: Math.round(r.k.att * 100) }) : T('hud.rp.noData')].filter(Boolean).join(' · '))),
        gradePill(r.grade) || h('span', { class: 'hud-pf-gpill' }, '—'),
        h('strong', { class: `hud-sm-rank-nums ${p < 0 ? 'is-bad' : 'is-good'}` }, signed(p))));
    }));
    const mvp = s.staff.mvp && unitOf(s, s.staff.mvp.uid) ? s.staff.mvp : null;
    const tips = tipsOf(s, now, zone, keys);
    const journal = teamJournal(s).filter(e => !e.uid || !unitOf(s, e.uid) || STAFF[unitOf(s, e.uid).type].zone === zone).map(e => h('li', { class: 'hud-sm-jrow' },
      h('span', { class: 'hud-sm-jico', attrs: { 'aria-hidden': 'true' } }, JOURNAL_ICON[e.type] || '•'),
      h('span', { class: 'hud-sm-jtext' }, journalText(s, e)),
      h('small', { class: 'hud-sm-jago' }, ago(now - (e.at || now)))));
    return h('div', null, seg,
      section('hud.rp.sec.money', tiles, moneyNote),
      section('hud.rp.sec.spend', spendBody),
      section('hud.rp.sec.rank', ranked.length ? rank : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.noTeamShort')),
        h('p', { class: 'hud-sub' }, T(period === '10m' ? 'hud.rp.rankToday' : 'hud.rp.rankNote', { a: PROFILE.grade.cuts[0][1], b: PROFILE.grade.cuts[2][1], c: PROFILE.grade.cuts[3][1] }))),
      researchSummary(s, now, zone),
      section('hud.sm.sec.mvp', h('p', { class: 'hud-line' }, mvp ? T('hud.sm.mvp', { name: mvp.name || nameOf(unitOf(s, mvp.uid)), coins: fmt(mvp.earned) }) : T('hud.sm.mvpNone', { min: BOOKS.mvpMinutes }))),
      section('hud.sm.sec.tips', h('ul', { class: 'hud-sm-tips' }, ...tips.map(t => h('li', null, t)))),
      section('hud.sm.sec.journal', journal.length ? h('ul', { class: 'hud-sm-journal' }, ...journal) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.journalEmpty'))));
  }
  // Research at a glance (docs/design/research.md step 4): what you found / set up — the growth only you can do.
  function researchSummary(s, now, zone) {
    const lines = [];
    if (zone === 'shop') {
      const cc = countryNow(s), all = countryRecipes(cc).filter(r => r.ings.length);
      lines.push(T('hud.rp.lab.recipes', { n: all.filter(r => recipeFound(s, cc, r.index)).length, max: all.length }));
      const signed = SUPPLY.groupOrder.filter(g => contractOf(s, g, now));
      lines.push(signed.length ? T('hud.rp.lab.contracts', { list: signed.map(g => T(`hud.sup.g.${g}`)).join(', ') }) : T('hud.rp.lab.noContracts'));
    } else {
      const crops = CROP_ORDER.filter(c => cropUnlocked(s, c));
      const adopted = crops.filter(c => methodKey(methodOf(s, c)) !== methodKey(FARMLAB.defaultMethod));
      lines.push(T('hud.rp.lab.methods', { n: adopted.length, max: crops.length, trials: trialsHere(s).length }));
      const b = buyerNow(s, now);
      lines.push(b.i ? T(b.locked ? 'hud.rp.lab.buyerLocked' : 'hud.rp.lab.buyer', { name: b.name }) : T('hud.rp.lab.store'));
    }
    return section('hud.rp.sec.lab', h('ul', { class: 'hud-sm-tips' }, ...lines.map(t => h('li', null, t))));
  }
  // A tip for the unit with the lowest grade (C or D) of the period: what pulls it down and what to do about it.
  function gradeTip(s, zone, keys) {
    const low = teamRanking(s, keys, zone).filter(r => r.grade && 'CD'.includes(r.grade.letter[0])).sort((a, b) => a.grade.score - b.grade.score)[0];
    if (!low) return null;
    const parts = low.grade.parts, worst = Object.keys(parts).reduce((a, b) => (parts[b] < parts[a] ? b : a));
    const robot = isRobot(low.u);
    return T(`hud.rp.tip.${robot ? 'robot' : 'worker'}.${worst}`, { name: nameOf(low.u), grade: low.grade.letter, att: Math.round((low.k?.att || 0) * 100), n: low.k?.mistakes || 0 });
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
      case 'promoted': return T('hud.sm.j.promoted', { name, rank: T(`hud.cr.rank.${x?.rank || 'staff'}`) });
      case 'steppedDown': return T('hud.sm.j.steppedDown', { name, rank: T(`hud.cr.rank.${x?.rank || 'skilled'}`) });
      case 'nudged': return T('hud.sm.j.nudged', { name, by: x?.by || T('hud.sm.someone') });
      case 'autoCare': return T('hud.sm.j.autoCare', { name, care: T(`hud.sm.care.${typeof x === 'string' ? x : 'recharge'}`) });
      case 'managerCare': return T('hud.sm.j.managerCare', { name, by: x?.by || T('hud.sm.someone'), care: T(`hud.sm.care.${x?.kind || 'coffee'}`) });
      case 'poachStarted': case 'poachRefused': return T(`hud.sm.j.${e.type}`, { name, rival: typeof x === 'string' ? x : '' });
      default: return T(`hud.sm.j.${e.type}`, { name });
    }
  }
  // 2–3 tips from what the team shows now and what the journal says happened.
  function tipsOf(s, now, zone, keys = [dayKey(now)]) {
    const out = [];
    const g = gradeTip(s, zone, keys);
    if (g) out.push(g);
    const ready = zoneUnits(s, zone).find(u => canPromote(s, u, now));
    if (ready) out.push(T('hud.cr.tip', { name: nameOf(ready), rank: T(`hud.cr.rank.${nextRank(ready)}`) }));
    const units = zoneUnits(s, zone).filter(u => hereOf(s, u));
    const times = (uid, type) => teamJournal(s).filter(e => e.uid === uid && e.type === type).length;
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
      const nextUid = uid && unitOf(store.state, uid) ? uid : null;
      if (nextUid !== st.uid) st.ptab = 'overview';
      st.uid = nextUid;
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
