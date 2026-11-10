// Staff manager: a full modal (docs/design/staff-manager.md §10, mobile-first redesign 2026-11-08), one per game (the
// zone of the screen shown: farm staff on the farm, café staff in the café).
//  · sticky header: title, × close, on the farm the Auto card (the farm's manager, by the hour), tabs Đội · Phân công · Tuyển
//    (café: Quản lý as a tab); the other tabs also show 3 numbers (on shift n/max · team earned / 10 min · problems);
//  · Đội: «Cần bạn» — ONE list of what needs the player, ranked by the same rules the manager uses (open tasks and
//    the rival's lure first, then blocking problems with their paid fix, slow problems, a free slot for a bench worker,
//    promotions, then the team's fastest-payback upgrades from D.upgradeOptions), one button per row; then the roster
//    (filter chips; one line per unit: photo, state, a condition meter and its paid fix right on the line) and the report folded at the bottom;
//  · Detail (← back): ID card, then 3 tabs: Hôm nay (state, care, shift, today's grade, tasks) · Phát triển (upgrade
//    suggestions by payback, career, stats / parts, gear / software, craft) · Nhật ký;
//  · 📍 Xem ở đâu collapses the modal to a bottom strip (name, state, fix, «Mở lại») while the camera shows the unit.
//  · staff board (docs/design/staff-manager.md §10.1): every roster row has a checkbox, filters and «chọn cả» pick a group, a dock
//    at the bottom gives one order to all of them; or the whole team goes to the manager and the card shows his report.
// The realm changes vitals and jobs without store events, so the open modal refreshes every second; a refresh only
// swaps the DOM when what it shows changed (never while a finger is down) and keeps each screen's scroll position.
import { maxStatOf, maxTierOf, gmStatOf } from '../../core/config/economy.js';
import { GOOF, SKILL_GATE } from '../../core/config/economy.js';
import { CREW } from '../../core/config/economy.js';
import { CROP_ORDER, EXPIRY_LEVEL, EXPIRY_ENABLED } from '../../core/config/economy.js';
import { countryRecipes, SUPPLY, FARMLAB, methodKey } from '../../core/config/research.js';
import { TASKS, PENALTY, HISTORY, GM, gmCandidatesFor, gmSalary, GEAR, gearTier, SOFTWARE, softwarePrice, hasSoftware, WARRANTY, PROFILE, CRAFT, craftLevel, STAFF, STAFF_ORDER, TRAITS, RECRUIT, ROBOT_TASKS, ROBOT_PARTS, PART_ORDER, PART_COST, WORKER_TASKS, TASK_LIMIT, SMART_RULES, QUALITY, TEND, MISTAKES, STAFF_BREAKS, SKILL, RARE, STAT_ORDER, LEVEL_STEP, VITALS, UPKEEP, RIVAL, BOOKS, ROBOT_WEAR, CARE, statOf, statCap, taskLimit, energyMax, unitLevel, mistakeChance, hasRule, batteryMinutes, slackMul, partTier, robotTask, heatPerMin, jamChance, isHardDrink, UPGRADE_GATE } from '../../core/config/economy.js';
import { employeeCode, checkupOf, nextHireLevel, gmHanded, gmStaffReport, openTiers, autoManaged } from '../../core/derive.js';
import { region, regionGame, level, hireCap, hireCapReached, slots, activeCount, freeSlots, zoneUnits, staffError, freeHire, applicants, recruitError, poolRefreshIn, unitStars, unitOf, statError, statPrice, partError, partPrice, unitState, careCost, careError, quickFix, upkeepOf, upkeepPer, fireRefund, ledgerWindow, unitProfit, poachOf, canBrew, dayKey, lastDays, dayRow, dayKpis, daysSince, unitGrade, teamKpi, robotPayback, REPORT_PERIODS, SPEND_CATS, periodKeys, teamMoney, teamRanking, tenureDays, tenureShiftDays, tenureMinLeft, robotRoom, wageArrears, gmQuitArrears, warrantyLeft, gearPrice, gearError, softwareError, gearStockOf, gmUnlocked, gmOf, gmBoard, gmBoardRefreshIn, gmPay, gmBudgetLeft, gmPlan, gmPermission, gmAdvisorOf, chaosOf, calmCost, chaosSlackMul, gmMood, followerWage, countryNow, recipeFound, contractOf, cropUnlocked, methodOf, trialsHere, buyerNow, gmPoachOf, gmRequests, gmLog, unitLog, teamJournal, gmCareWallet, gmCareWalletLeft, gmBacklog, gmWaiting, gmStrike, apologiseCost, gmBudgetCap, gmLicensed, licenceError, licencePrice, gmTrainCost, gmTrainError, gmHighValue, histRows, upgradeOptions, throughputShare, tasksOpen } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, fmt, gmReasonText } from './text.js';
import { formatNumber } from '../../i18n/index.js';
import { staffEffect } from './effects.js';
import { actionButton, coinAmount, coinValue, lockTag, needMore } from './widgets.js';
import { dashboardOf } from '../../core/farm-manager.js';
import { autoPanel, autoStrip, autoSig } from './sheets.js';
import { rowText, taskCard } from './inbox.js';
import { doesJob, FARM_MANAGER, stanceEffects, stanceMode, CHECKUP } from '../../core/config/economy.js';

const REFRESH_MS = 1000;
const isRobot = u => STAFF[u?.type]?.kind === 'robot';
const nameOf = u => (u?.name ? u.name : T(`staff.${u?.type || 'picker'}`));
const ZONE_RULES = { shop: ['urgent', 'twoCups', 'chain', 'restock'], farm: ['ripeFirst', 'playerCrop', 'quick', 'twoPlots'] };
const ZONE_MISTAKES = { shop: ['spill', 'wrongTable'], farm: ['unripe', 'crooked'] };
const STAT_ICON = { speed: '⚡', smart: '🧠', accuracy: '🎯', stamina: '💪' };
const PERK_ICON = { goldHands: '🖐️', swift: '💨', tireless: '🔋', charming: '😍' };
const PERK_FX = { speed: RARE.swiftSpeed, pct: Math.round(RARE.charmingBonus * 100), drain: Math.round((1 - RARE.tirelessDrain) * 100) };
// Shown state of a unit (the core's unitState plus where it is and the zero-energy / zero-food stops).
const STATE_ICON = { funny: '❗', phone: '📱', battery: '🪫', overheat: '🔥', jam: '⚙️', lunch: '🍽️', sulking: '😤', hungry: '🍔', tired: '😮‍💨',
  exhausted: '😵', starving: '🍔', worn: '🔧', bench: '🪑', ok: '🙂', unassigned: '💤', elsewhere: '🗺️' };
// Old profile tab ids (links from the manager's plan, saved navigation) → the 3 tabs of the redesign.
const PTAB_OF = { overview: 'today', stats: 'grow', gear: 'grow', parts: 'grow', service: 'history' };
const BLOCKING = new Set(['funny', 'phone', 'battery', 'overheat', 'jam', 'sulking', 'exhausted', 'starving']);
const SLOW = new Set(['tired', 'hungry', 'worn']);
const CARE_ICON = { settle: '💸', nag: '🗣️', bonusSmall: '💵', coffee: '☕', food: '🍔', lunch: '🍽️', bonus: '🎁', rest: '🪑', recharge: '⚡', cool: '❄️', repair: '🔧', service: '🛠️', tend: '💧' };
const WORKER_CARE = ['nag', 'bonusSmall', 'coffee', 'food', 'lunch', 'bonus', 'rest'];
const ROBOT_CARE = ['recharge', 'cool', 'repair', 'service'];
const JOB_ICON = { goof: '🤷', prune: '✂️', spray: '🛸', process: '🫘', haul: '📦', harvest: '🌾', plant: '🌱', water: '💧', order: '🧾', brew: '☕', deliver: '🚶' };
const REASON_ICON = { cantDo: '❓', noPile: '🧺', noStore: '🏚️', noWell: '🚱', noBatch: '🫘', growing: '⏳', storageFull: '📦', noSeeds: '💸', noPlots: '🏞️', fieldsFull: '🌱', noCustomers: '🚪', noSeat: '🪑', noBeans: '🫘', hard: '🍮', paused: '⏸️', noWork: '⏳' };
const JOURNAL_ICON = { autoCare: '🤖', promoted: '🎖️', steppedDown: '🔽', nudged: '👉', managerCare: '👑', slacked: '📱', nagged: '🗣️', cared: '💝', upgraded: '⬆️', hired: '🤝', benched: '🪑', activated: '▶️', poachStarted: '💼', poachRefused: '🙅', kept: '🤝', left: '👋', jam: '⚙️', overheat: '🔥' };

export function createStaffModal(ctx) {
  const store = ctx.store;
  const st = { open: false, tab: 'team', filter: 'all', uid: null, ptab: 'today', period: 'today', collapsed: false, more: false, folds: Object.create(null), sel: new Set(), bulk: null, picking: false, drill: null, page: 20, place: new Set() };
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
  const foot = h('div', { class: 'hud-sb-foot' }); // the staff board's dock: outside the scrolling body, always in reach
  const panel = h('section', { class: 'hud-sm', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hud-sm-title' } }, head, body, foot);
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
  const screenKey = () => (st.uid ? `unit:${st.uid}:${st.ptab}` : `tab:${st.tab}`);
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
    for (const id of st.sel) if (!unitOf(s, id)) st.sel.delete(id);
    for (const id of st.place) if (!unitOf(s, id)) st.place.delete(id);
    el.dataset.collapsed = st.collapsed ? '1' : '';
    panel.hidden = st.collapsed;
    scrim.hidden = st.collapsed;
    strip.hidden = !st.collapsed;
    if (st.collapsed) { swap(strip, stripView(s, now)); return; }
    const t = T('hud.sm.title', { zone: T(zone === 'shop' ? 'hud.sm.zoneShop' : 'hud.sm.zoneFarm') });
    if (title.textContent !== t) title.textContent = t;
    if (gmHanded(s, zone) && (st.tab === 'hire' || st.tab === 'assign')) st.tab = 'team'; // handed over: nothing left to do there
    if (st.tab === 'assign' && !canAssign(s, zone)) st.tab = 'team';
    back.hidden = !st.uid;
    swap(summary, st.uid ? null : summaryView(s, now, zone));
    paintAutoStrip(s, zone); // (the rival's lure is the first row of «Cần bạn» now)
    swap(tabs, st.uid ? null : tabsView(s, now, zone));
    const key = screenKey();
    const node = st.uid ? detailView(s, now, zone, unitOf(s, st.uid)) : st.tab === 'hire' ? hireView(s, now, zone) : st.tab === 'assign' ? assignView(s, zone) : st.tab === 'gm' ? gmView(s, now, zone) : teamView(s, now, zone);
    if (body.dataset.screen !== key) {
      body.dataset.screen = key;
      body.replaceChildren(node);
      body.scrollTop = scrollMem[key] || 0;
    } else {
      const top = body.scrollTop;
      if (swap(body, node)) body.scrollTop = top;
    }
    swap(foot, st.uid ? null : st.tab === 'team' ? dockView(s, now, zone) : st.tab === 'assign' ? assignDock(s, zone) : null);
  }
  body.addEventListener('scroll', () => { if (body.dataset.screen) scrollMem[body.dataset.screen] = body.scrollTop; }, { passive: true });

  function goTo(next) {
    if (body.dataset.screen) scrollMem[body.dataset.screen] = body.scrollTop;
    if (next.uid !== undefined && next.uid !== st.uid && next.ptab === undefined) next = { ...next, ptab: 'today' }; // another profile opens on Hôm nay
    if (next.ptab) next = { ...next, ptab: PTAB_OF[next.ptab] || next.ptab };
    if (next.tab === 'report') next = { ...next, tab: 'team', folds: { ...st.folds, report: true } };
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
  // A working unit stuck on something the player must fix (no well for the waterer, no coins for seeds, a full storehouse…)
  // reads amber, not the same green as "đang làm" (QA 2026-11-09: "Chưa có bể nước" was shown in green).
  const STUCK = new Set(['noWell', 'noSeeds', 'storageFull', 'cantDo', 'noStore', 'noPlots', 'noBatch', 'noPile']);
  const lineTone = (key, info) => (key === 'ok' && !info?.job && STUCK.has(info?.reason) ? 'warn' : toneOf(key));
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
    if (key === 'funny') return `${T(`funny.${u.stopped.id}.${u.stopped.level}`)} · ${T('hud.uc.level', { n: u.stopped.level })}`;
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
      h('span', { class: 'hud-sm-bar-name' }, icon, ' ', h('span', { class: 'hud-sm-bar-label' }, label)),
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
  function careButton(s, u, kind, now, { compact = false, bare = false } = {}) {
    const cost = careCost(u, kind), err = careError(s, u, kind, now);
    const short = s.player.coins < cost;
    const btn = actionButton({ id: bare ? `staffFix-${u.uid}` : undefined, label: bare ? T('hud.sb.fix') : T(`hud.sm.care.${kind}`), icon: bare ? null : CARE_ICON[kind], cost: cost > 0 ? cost : undefined, tone: cost > 0 && !bare ? 'gold' : 'plain',
      disabled: !!err, note: short && !compact ? needMore(cost - s.player.coins) : null,
      onClick: () => { const r = act('staff/care', { uid: u.uid, kind, roll: Math.random() }); if (r.ok) sfx(cost > 0 ? 'coin.spend' : 'ui.click'); } });
    if (bare) btn.setAttribute('aria-label', `${T(`hud.sm.care.${kind}`)}: ${nameOf(u)}`);
    return btn;
  }
  function headLine(u) {
    const tr = TRAITS[u.trait];
    return [tr ? `${tr.icon} ${T(`staff.trait.${u.trait}`)}` : `${T(`hud.kind.${STAFF[u.type].kind}`)} · ${T(`hud.zone.${STAFF[u.type].zone}`)}`,
      isRobot(u) ? T(`hud.staff.task.${robotTask(u)}`) : T('hud.staff.lv', { level: unitLevel(u) })].join(' · ');
  }
  const perkBadge = perk => (perk ? h('span', { class: 'hud-sm-perk', attrs: { title: T(`hud.sm.perkFx.${perk}`, PERK_FX) } }, `${PERK_ICON[perk] || '⭐'} ${T('hud.sm.rare')} · ${T(`hud.sm.perk.${perk}`)}`) : null);

  // ---------- header ----------
  function summaryView(s, now, zone) {
    const here = region(s) ? zoneUnits(s, zone).filter(u => hereOf(s, u)) : [];
    const problems = here.filter(u => isProblem(stateKey(s, u, now))).length;
    const win = teamMoney(s, now, '10m', zone); // this game's team only
    const tickets = s.rewards?.tickets || 0;
    const cell = (icon, text, tone = '') => h('span', { class: `hud-sm-kpi${tone ? ` is-${tone}` : ''}` }, h('span', { attrs: { 'aria-hidden': 'true' } }, icon), text);
    return h('div', { class: 'hud-sm-kpis' },
      cell('👥', T('hud.sm.sum2.active', { n: activeCount(s, zone) })),
      cell('🪑', `${zoneUnits(s, zone).length}/${hireCap(s, zone)}`), // seats: everybody hired / most you may hire now
      cell('🪙', T('hud.sm.sum2.earned', { coins: fmt(win.earned), min: BOOKS.mvpMinutes })),
      problems ? cell('⚠️', T('hud.sm.sum2.problems', { n: problems }), 'warn') : null, // all fine = nothing to say
      tickets > 0 ? cell('🎟️', T('hud.sm.sum2.tickets', { n: tickets })) : null);
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
  // The farm's manager is Auto: its card stays above the tabs. Built only when its buttons change; the clock and numbers repaint in place.
  let stripKey = null;
  function paintAutoStrip(s, zone) {
    const key = zone === 'farm' && !st.uid && st.tab === 'team' ? autoSig(s) : '';
    if (key === stripKey) return;
    stripKey = key;
    swap(banner, key ? autoStrip(ctx, s, () => { st.folds.autoReport = !st.folds.autoReport; sfx('ui.tab'); rerender(); body.scrollTop = 0; }) : null);
  }
  // «Phân công» has nothing to do with one terrace open.
  const canAssign = (s, zone) => zone !== 'farm' || openTiers(s).length > 1;
  function tabsView(s, now, zone) {
    const tab = (id, label, badge) => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `staffTab-${id}` }, attrs: { 'aria-pressed': String(st.tab === id) },
      on: { click: () => goTo({ tab: id, drill: null, picking: false }) } }, label, badge ? h('span', { class: 'hud-sm-badge' }, String(badge)) : null);
    // Words only, so they fit a phone with their badges (Báo cáo lives at the bottom of Đội, the farm's Auto above the tabs).
    return h('div', { class: 'hud-tabs hud-sm-tabs', attrs: { role: 'group', 'aria-label': T('hud.sm.tabs') } },
      tab('team', T('hud.sb.tab.home'), needsOf(s, now, zone).filter(x => x.pri <= 2).length), gmHanded(s, zone) || !canAssign(s, zone) ? null : tab('assign', T('hud.sb.tab.assign')), gmHanded(s, zone) ? null : tab('hire', T('hud.sm.tab.hire')),
      tab('gm', T('hud.gm.tab'), gmRequests(s).length + (gmPoachOf(s) ? 1 : 0)));
  }
  // A section the player opens / closes (remembered while the modal lives); its body is built only when open.
  function fold(key, titleText, build) {
    const open = !!st.folds[key];
    return h('section', { class: `hud-sm-sec hud-fold${open ? ' is-open' : ''}` },
      h('button', { type: 'button', class: 'hud-fold-head', dataset: { hudId: `staffFold-${key}` }, attrs: { 'aria-expanded': String(open) },
        on: { click: () => { st.folds[key] = !open; sfx('ui.tab'); rerender(); } } },
        h('span', { class: 'hud-fold-title' }, titleText), h('span', { class: 'hud-fold-chev', attrs: { 'aria-hidden': 'true' } }, open ? '▾' : '▸')),
      open ? h('div', { class: 'hud-fold-body' }, ...[].concat(build()).filter(Boolean)) : null);
  }

  // ---------- Cần bạn: what needs the player, ranked like the manager ranks it ----------
  // pri 0 = now (a lure, a blocked unit), 1 = an answer the manager waits for, 2 = a slow unit, 3 = an idle seat,
  // 5 = upgrades that pay back within UPGRADE_GATE.paybackMin. People with the same need are one row with one button.
  const NY_SHOW = 4;
  const PAY_ICON = { 'staff/upgradeStat': '⬆️', 'staff/buyGear': '🧤', 'staff/upgradePart': '🔩', 'staff/buySoftware': '💾' };
  const upgradeWhat = o => (o.what.stat ? T(`hud.stat.${o.what.stat}`) : o.what.part ? T(`hud.staff.part.${o.what.part}`) : o.what.item ? T(`hud.g4.item.${o.what.item}`) : o.what.pack ? T(`hud.g4.pack.${o.what.pack}`) : '');
  let nyMemo = { s: null, at: 0, zone: null, v: [] };
  const stuckUnits = (s, now, zone) => (region(s) ? zoneUnits(s, zone).filter(u => hereOf(s, u) && fixOf(u, stateKey(s, u, now), now)) : []);
  const idleUnits = (s, now, zone) => (region(s) ? zoneUnits(s, zone).filter(u => { const k = stateKey(s, u, now); return k === 'unassigned' || (k === 'bench' && freeSlots(s, zone) > 0); }) : []);
  const worthUnits = (s, zone) => (region(s) ? zoneUnits(s, zone).filter(u => hereOf(s, u) && u.active && upWorth(s)(u)) : []);
  function needsYou(s, now, zone) {
    if (nyMemo.s === s && nyMemo.zone === zone && now - nyMemo.at < 900) return nyMemo.v;
    const out = [];
    const group = (pri, icon, text, btn) => out.push({ pri, node: h('li', { class: `hud-ny is-p${pri}` },
      h('span', { class: 'hud-ny-main' }, h('span', { class: 'hud-ny-ico', attrs: { 'aria-hidden': 'true' } }, icon), h('span', { class: 'hud-ny-text' }, h('strong', null, text))),
      h('div', { class: 'hud-ny-act' }, btn)) });
    // open tasks: the rival's lure and the manager's questions (answered right here, the inbox shows the same cards)
    for (const t of tasksOpen(s)) {
      if (t.kind === 'poach' && t.zone && t.zone !== zone) continue;
      out.push({ pri: t.kind === 'poach' || t.kind === 'gmPoach' ? 0 : 1, task: true, node: h('li', { class: 'hud-ny hud-ny--task' }, taskCard(ctx, s, t)) });
    }
    if (gmHanded(s, zone)) { out.sort((a, b) => a.pri - b.pri); nyMemo = { s, at: now, zone, v: out }; return out; } // the rest is the manager's
    const costOf = p => (p.take.length ? p.total : undefined);
    const stuck = stuckUnits(s, now, zone);
    if (stuck.length) {
      const p = orderPlan(s, stuck, careOf(s, now));
      group(stuck.some(u => BLOCKING.has(stateKey(s, u, now))) ? 0 : 2, '⚠️', T('hud.sb.groupStuck', { n: stuck.length }),
        actionButton({ id: 'staffFixAll', label: T('hud.sb.fixBtn'), cost: costOf(p), tone: 'gold', disabled: !p.take.length, onClick: () => orderCare(x => stuckUnits(x, Date.now(), zoneNow())) }));
    }
    const idle = idleUnits(s, now, zone);
    if (idle.length) group(3, '🪑', T('hud.sb.groupIdle', { n: idle.length }),
      actionButton({ id: 'staffIdleIn', label: T('hud.sb.idleBtn'), tone: 'go', onClick: () => putToWork() }));
    const unchecked = zoneUnits(s, zone).filter(u => !isRobot(u) && checkupOf(u)?.expired);
    if (unchecked.length) group(4, '🩺', T('hud.pf.dueGroup', { n: unchecked.length }), actionButton({ id: 'staffCheckup', label: T('hud.pf.recheck'), cost: CHECKUP.cost, tone: 'gold', disabled: s.player.coins < CHECKUP.cost, onClick: () => { if (act('staff/checkup', { uid: unchecked[0].uid }).ok) rerender(); } }));
    const worth = worthUnits(s, zone);
    if (worth.length) {
      const p = orderPlan(s, worth, upWorth(s));
      group(5, '⬆️', T('hud.sb.groupUp', { n: worth.length }),
        actionButton({ id: 'staffUpAll', label: T('hud.sb.upBtn'), cost: costOf(p), tone: 'gold', disabled: !p.take.length, onClick: () => orderUpgrade(T('hud.sb.best'), upWorth, x => worthUnits(x, zoneNow())) }));
    }
    out.sort((a, b) => a.pri - b.pri);
    nyMemo = { s, at: now, zone, v: out };
    return out;
  }
  // With the team handed over (or Auto running the farm), only questions the manager cannot settle himself still need the player.
  const managed = (s, zone) => gmHanded(s, zone) || (zone === 'farm' && autoManaged(s));
  const needsOf = (s, now, zone) => (managed(s, zone) ? needsYou(s, now, zone).filter(x => x.task) : needsYou(s, now, zone));
  /** Condition 0..100 of a unit here: its weakest vital (worker energy / morale / fullness, robot charge / heat / wear). */
  function conditionOf(u, info) {
    if (isRobot(u)) return Math.round(Math.min(u.stopped?.kind === 'battery' ? 0 : info?.battery ?? 100, 100 - (u.heat || 0), u.wear ?? 100));
    return Math.round(Math.min((u.energy ?? 100) / Math.max(1, energyMax(u)) * 100, u.morale ?? VITALS.start.morale, u.fullness ?? 100));
  }

  // ---------- Đội ----------
  // The first screen: what needs the player, then the people, filtered by a row of chips (trades join the chips past BIG_TEAM people).
  const BIG_TEAM = 12, PAGE = 20;
  function teamView(s, now, zone) {
    const units = zoneUnits(s, zone);
    if (!units.length) return h('div', { class: 'hud-sm-empty' }, h('div', { class: 'ui-hero hud-empty-hero' }, h('span', { class: 'ui-ico ui-ico--people', attrs: { 'aria-hidden': 'true' } }), h('strong', null, T('hud.sm.noTeam'))),
      actionButton({ label: T('hud.sm.goHire'), icon: '🧑', onClick: () => goTo({ tab: 'hire' }) }));
    const handed = gmHanded(s, zone);
    if (handed) st.picking = false;
    // problems first, then on shift, bench, elsewhere (hire order inside each group)
    const rows = units.map(u => ({ u, key: stateKey(s, u, now) }));
    const rank = r => (BLOCKING.has(r.key) ? 0 : SLOW.has(r.key) ? 1 : hereOf(s, r.u) && r.u.active ? 2 : hereOf(s, r.u) ? 3 : 4);
    rows.sort((a, b) => rank(a) - rank(b));
    if (st.drill && !filterKnown(st.drill, rows)) st.drill = null; // the last of that trade left
    const visible = st.drill ? rows.filter(r => inFilter(s, r.u, r.key, st.drill)) : rows;
    const ny = needsOf(s, now, zone), shown = st.more ? ny : ny.slice(0, NY_SHOW);
    const needs = !ny.length ? null : h('section', { class: 'hud-ny-sec', attrs: { 'aria-label': T('hud.ny.title', { n: ny.length }) } },
      h('ul', { class: 'hud-ny-list' }, ...shown.map(x => x.node)),
      ny.length > NY_SHOW ? h('button', { type: 'button', class: 'hud-ny-more', on: { click: () => { st.more = !st.more; rerender(); } } },
        st.more ? T('hud.ny.less') : T('hud.ny.more', { n: ny.length - NY_SHOW })) : null);
    const people = listBlock(s, now, visible, handed, filterChips(s, rows));
    const canHand = zone !== 'farm' || (gmOf(s) && !autoManaged(s)); // without a hired manager the farm's card is Auto
    return h('div', null, canHand ? handCard(s, now, zone, rows) : null, zone === 'farm' && st.folds.autoReport ? fold('autoReport', `🤖 ${T('hud.auto.detailFold')}`, () => autoView(s, now)) : null, needs, people, // (a tap on the Auto card opens its report here)
      fold('report', `📊 ${T('hud.sm.tab.report')}`, () => [dashboard(s, now, zone, rows), reportView(s, now, zone)]));
  }
  // One tap narrows the list in place: nobody leaves the screen to find a person.
  function filterChips(s, rows) {
    const n = f => rows.filter(r => inFilter(s, r.u, r.key, f)).length;
    const chip = (f, label, count) => h('button', { type: 'button', class: 'hud-rs-chip', dataset: { hudId: `staffFilter-${f}` }, attrs: { 'aria-pressed': String((st.drill || 'all') === f) }, on: { click: () => setDrill(f === 'all' ? null : f) } }, label, h('small', null, String(count)));
    const group = (kids, cls = '') => h('div', { class: `hud-rs-filters${cls}`, attrs: { role: 'group', 'aria-label': T('hud.sb.filters') } }, ...kids);
    const onTrade = !!st.drill && !STATUS_FILTERS.includes(st.drill), big = rows.length > BIG_TEAM, showTrades = big && (st.trades || onTrade);
    const types = [...new Set(rows.map(r => r.u.type))].sort((a, b) => T(`staff.${a}`).localeCompare(T(`staff.${b}`)));
    return [group([chip('all', T('hud.sb.all'), rows.length),
      ...['problem', 'people', 'robots'].filter(f => n(f) > 0 && (f === 'problem' || n(f) < rows.length)).map(f => chip(f, drillLabel(f), n(f))),
      big ? h('button', { type: 'button', class: 'hud-rs-chip', dataset: { hudId: 'staffFilterTrades' }, attrs: { 'aria-expanded': String(!!showTrades), 'aria-pressed': String(onTrade) }, on: { click: () => { st.trades = !showTrades; if (!st.trades && onTrade) st.drill = null; sfx('ui.tab'); rerender(); } } }, T('hud.sb.f.trade'), showTrades ? ' ▴' : ' ▾') : null].filter(Boolean)),
    showTrades ? group(types.map(t => chip(t, T(`staff.${t}`), n(t))), ' is-sub') : null];
  }
  function dashboard(s, now, zone, rows) {
    const m = teamMoney(s, now, 'today', zone), bad = rows.filter(r => isProblem(r.key)).length;
    const signed = v => `${v < 0 ? '−' : ''}${fmt(Math.abs(Math.round(v)))}`;
    const tile = (label, value, cls = '', onClick = null) => h(onClick ? 'button' : 'div', { class: `hud-sm-cell hud-pf-kpi hud-db-tile ${cls}`, ...(onClick ? { type: 'button', on: { click: onClick } } : {}) }, h('small', null, label), h('strong', null, value));
    const days = lastDays(now, 7).map(d => ({ d, v: Math.round((s.staff.daily || []).find(e => e.d === d)?.[zone]?.earned || 0) }));
    const peak = Math.max(0, ...days.map(x => x.v)), today = days[days.length - 1].d;
    const chart = h('div', { class: 'hud-db-bars', attrs: { role: 'img', 'aria-label': days.map(x => `${x.d % 100}: ${x.v}`).join(', ') } },
      ...days.map(x => h('div', { class: `hud-db-col${x.d === today ? ' is-today' : ''}`, attrs: { title: `${String(x.d % 100).padStart(2, '0')}: ${fmt(x.v)}` } },
        h('span', { class: 'hud-db-val' }, x.v > 0 && (x.d === today || x.v === peak) ? fmt(x.v) : ''),
        h('i', { style: { height: `${peak > 0 ? Math.max(2, Math.round(x.v / peak * 100)) : 2}%` } }),
        h('small', null, String(x.d % 100)))));
    return h('section', { class: 'hud-sm-sec' },
      h('h3', { class: 'hud-sm-h' }, T('hud.sb.today')),
      h('div', { class: 'hud-sm-grid hud-sm-grid--2 hud-pf-kpis' },
        tile(T('hud.sb.onShift'), `${activeCount(s, zone)}/${rows.length}`),
        tile(T('hud.sb.problem'), bad ? `⚠️ ${bad}` : '0', bad ? 'is-bad' : '', bad ? () => setDrill('problem') : null),
        tile(T('hud.rp.earned'), coinValue(Math.round(m.earned))),
        tile(T('hud.rp.profit'), signed(m.profit), m.profit < 0 ? 'is-bad' : 'is-good')),
      h('h3', { class: 'hud-sm-h hud-db-title' }, T('hud.sb.week')), chart);
  }
  const drillLabel = f => (f === 'all' ? T('hud.sb.all') : f === 'problem' ? T('hud.sb.problem') : f === 'off' ? T('hud.sb.off') : f === 'people' ? T('hud.sb.f.people') : f === 'robots' ? T('hud.sb.f.robots') : T(`staff.${f}`));
  function setDrill(f) { st.drill = f; st.picking = false; st.sel.clear(); st.bulk = null; st.page = PAGE; sfx('ui.tab'); rerender(); }
  function listBlock(s, now, visible, handed, [filters, trades]) {
    const allOn = visible.length > 0 && visible.every(r => st.sel.has(r.u.uid)), shown = visible.slice(0, st.page);
    return h('section', { class: 'hud-rs-sec' },
      h('div', { class: 'hud-rs-bar' }, filters,
        handed ? null : h('button', { type: 'button', class: 'hud-rs-pick', dataset: { hudId: 'staffPick' }, on: { click: () => togglePicking() } }, T(st.picking ? 'hud.sb.pickDone' : 'hud.sb.pickMode'))),
      trades,
      st.picking && visible.length ? h('button', { type: 'button', class: 'hud-sb-all', dataset: { hudId: 'staffSelectAll' }, attrs: { role: 'checkbox', 'aria-checked': String(allOn) }, on: { click: () => toggleAll(visible, allOn) } },
        h('span', { class: `hud-sb-box${allOn ? ' is-on' : ''}`, attrs: { 'aria-hidden': 'true' } }, allOn ? '✓' : ''), T(allOn ? 'hud.sb.selectNone' : 'hud.sb.selectAll', { n: visible.length })) : null,
      visible.length ? h('ul', { class: 'hud-rs' }, ...shown.map(r => rosterRow(s, r.u, r.key, now))) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sb.noneMatch')),
      visible.length > shown.length ? h('button', { type: 'button', class: 'hud-ny-more', dataset: { hudId: 'staffMore' }, on: { click: () => { st.page += PAGE; rerender(); } } }, T('hud.sb.morePeople', { n: visible.length - shown.length })) : null);
  }

  // ---------- Staff board: pick a group, give one order; or hand the team to the manager ----------
  const STATUS_FILTERS = ['all', 'problem', 'off', 'people', 'robots'];
  const filterKnown = (f, rows) => STATUS_FILTERS.includes(f) || rows.some(r => r.u.type === f);
  const inFilter = (s, u, key, f) => (f === 'all' ? true : f === 'problem' ? isProblem(key) : f === 'on' ? hereOf(s, u) && !!u.active : f === 'off' ? !(hereOf(s, u) && u.active) : f === 'people' ? !isRobot(u) : f === 'robots' ? isRobot(u) : u.type === f);
  function togglePicking() { st.picking = !st.picking; st.sel.clear(); st.bulk = null; sfx('ui.tab'); rerender(); }
  function putToWork() {
    const s = store.state, now = Date.now(), zone = zoneNow(), list = idleUnits(s, now, zone);
    runOrder(list.map(u => (stateKey(s, u, now) === 'unassigned' ? { type: 'staff/assign', payload: { uid: u.uid } } : { type: 'staff/setActive', payload: { uid: u.uid, active: true } })));
  }
  function toggleUnit(id) { if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id); sfx('ui.tab'); rerender(); }
  function toggleAll(visible, allOn) { for (const r of visible) { if (allOn) st.sel.delete(r.u.uid); else st.sel.add(r.u.uid); } if (allOn) st.bulk = null; sfx('ui.tab'); rerender(); }
  const pickedUnits = s => [...st.sel].map(id => unitOf(s, id)).filter(Boolean);
  const okCoins = e => e === null || e === 'coins';
  const nameList = list => {
    const first = list.slice(0, 3).map(x => nameOf(x.u || x)).join(', ');
    return list.length > 3 ? T('hud.sb.namesMore', { names: first, n: list.length - 3 }) : first;
  };
  /** Who can take an order and who the coins reach, cheapest first. of(u) → { op, cost } | null. */
  function orderPlan(s, picked, of) {
    const able = picked.map(u => { const x = of(u); return x && { ...x, u }; }).filter(Boolean).sort((a, b) => a.cost - b.cost);
    const take = [];
    let total = 0;
    for (const x of able) { if (total + x.cost > s.player.coins) break; total += x.cost; take.push(x); }
    return { able: able.length, take, total };
  }
  const upStat = (s, stat) => u => (!isRobot(u) && okCoins(statError(s, u, stat)) ? { op: { type: 'staff/upgradeStat', payload: { uid: u.uid, stat } }, cost: statPrice(u, stat).coins } : null);
  const upPart = (s, part) => u => (isRobot(u) && okCoins(partError(s, u, part)) ? { op: { type: 'staff/upgradePart', payload: { uid: u.uid, part } }, cost: partPrice(u, part) } : null);
  const upWorth = s => u => { const o = upgradeOptions(s, u).filter(x => x.payback <= UPGRADE_GATE.paybackMin).sort((a, b) => a.payback - b.payback)[0]; return o ? { op: o.act, cost: o.cost } : null; };
  const upBest = s => u => { const o = upgradeOptions(s, u).filter(x => !x.quality).sort((a, b) => a.payback - b.payback)[0]; return o ? { op: o.act, cost: o.cost } : null; };
  const careOf = (s, now) => u => {
    const fix = hereOf(s, u) ? fixOf(u, stateKey(s, u, now), now) : null;
    return fix && okCoins(careError(s, u, fix.kind, now)) ? { op: { type: 'staff/care', payload: { uid: u.uid, kind: fix.kind, roll: Math.random() } }, cost: fix.cost } : null;
  };
  function runOrder(ops) {
    if (ctx.blockedByAuto?.()) return;
    const before = store.state.player.coins, r = act('staff/bulk', { ops });
    st.bulk = null;
    if (r.ok && !r.noop) {
      const e = (r.events || []).find(x => x.type === 'staffBulk'), done = e?.done ?? ops.length, skipped = e?.skipped ?? 0, delta = Math.round(store.state.player.coins - before);
      const text = delta < 0 ? T('hud.sb.doneSpent', { n: done, coins: fmt(-delta) }) : delta > 0 ? T('hud.sb.doneRefund', { n: done, coins: fmt(delta) }) : T('hud.sb.done', { n: done });
      sfx(delta < 0 ? 'coin.spend' : 'ui.click');
      ctx.toast(text + (skipped ? T('hud.sb.doneSkipped', { n: skipped }) : ''), 'good');
    }
    rerender();
  }
  async function orderUpgrade(what, of, unitsOf = pickedUnits) {
    if (ctx.blockedByAuto?.()) return;
    const s = store.state, picked = unitsOf(s), p = orderPlan(s, picked, of(s)), n = p.take.length;
    if (!n) return;
    const skip = picked.length - n;
    const yes = await ctx.confirm({ title: T('hud.sb.upTitle', { n }), body: T('hud.sb.upBody', { what, names: nameList(p.take) }) + (skip ? T('hud.sb.skipNote', { n: skip }) : ''), cost: p.total, confirmLabel: T('hud.sb.upGo', { n }) });
    if (yes) runOrder(p.take.map(x => x.op)); else rerender();
  }
  async function orderCare(unitsOf = pickedUnits) {
    if (ctx.blockedByAuto?.()) return;
    const s = store.state, picked = unitsOf(s), p = orderPlan(s, picked, careOf(s, Date.now())), n = p.take.length;
    if (!n) return;
    const skip = picked.length - n;
    const yes = await ctx.confirm({ title: T('hud.sb.careTitle', { n }), body: T('hud.sb.careBody', { names: nameList(p.take) }) + (skip ? T('hud.sb.skipNote', { n: skip }) : ''), cost: p.total, confirmLabel: T('hud.sb.careGo', { n }) });
    if (yes) runOrder(p.take.map(x => x.op)); else rerender();
  }
  async function orderFire() {
    if (ctx.blockedByAuto?.()) return;
    const s = store.state, picked = pickedUnits(s), n = picked.length;
    if (!n) return;
    const refund = picked.reduce((a, u) => a + fireRefund(u), 0), whole = n === zoneUnits(s, zoneNow()).length;
    const yes = await ctx.confirm({ title: T('hud.sb.fireTitle', { n }), body: T('hud.sb.fireBody', { names: nameList(picked) }) + (picked.some(isRobot) ? T('hud.sb.fireRobots') : '') + (whole ? T('hud.sb.fireAll') : ''), costLabel: T('hud.sb.fireRefund', { coins: fmt(refund) }), confirmLabel: T('hud.sb.fireGo', { n }) });
    if (yes) runOrder(picked.map(u => ({ type: 'staff/fire', payload: { uid: u.uid } }))); else rerender();
  }
  const panelHead = titleKey => h('div', { class: 'hud-sb-phead' }, h('strong', null, T(titleKey)),
    h('button', { type: 'button', class: 'hud-sb-pclose', attrs: { 'aria-label': T('hud.sb.closePanel') }, on: { click: () => { st.bulk = null; rerender(); } } }, '×'));
  function upgradePanel(s, picked) {
    const opt = (id, icon, label, of) => {
      const p = orderPlan(s, picked, of(s)), n = p.take.length;
      return h('button', { type: 'button', class: 'hud-sb-opt', dataset: { hudId: `staffBulkUp-${id}` }, disabled: !n, on: { click: () => orderUpgrade(label, of) } },
        h('span', { class: 'hud-sb-opt-name' }, `${icon} ${label}`),
        h('small', null, !p.able ? T('hud.sb.optNone') : !n ? T('hud.sb.optShort', { n, m: p.able }) : [n < p.able ? `${T('hud.sb.optShort', { n, m: p.able })} · ` : T('hud.sb.optLine', { n }), coinAmount(p.total)]));
    };
    const workers = picked.some(u => !isRobot(u)), robots = picked.some(isRobot);
    return h('div', { class: 'hud-sb-panel' }, panelHead('hud.sb.p.up'),
      h('div', { class: 'hud-sb-opts' },
        opt('best', '✨', T('hud.sb.best'), upBest),
        ...(workers ? STAT_ORDER.map(k => opt(k, STAT_ICON[k], T(`hud.stat.${k}`), x => upStat(x, k))) : []),
        ...(robots ? PART_ORDER.map(k => opt(k, '🔩', T(`hud.staff.part.${k}`), x => upPart(x, k))) : [])));
  }
  function shiftPanel(s, zone, picked) {
    const bench = picked.filter(u => hereOf(s, u) && !u.active), on = picked.filter(u => hereOf(s, u) && u.active), away = picked.filter(u => !hereOf(s, u));
    const canIn = Math.min(bench.length, freeSlots(s, zone));
    const opt = (id, label, n, onClick) => h('button', { type: 'button', class: 'hud-sb-opt', dataset: { hudId: `staffBulkShift-${id}` }, disabled: !n, on: { click: onClick } }, h('span', { class: 'hud-sb-opt-name' }, label), n == null ? null : h('small', null, T('hud.sb.people', { n })));
    return h('div', { class: 'hud-sb-panel' }, panelHead('hud.sb.p.shift'),
      h('div', { class: 'hud-sb-opts' },
        opt('in', `▶️ ${T('hud.sb.toShift')}`, canIn, () => runOrder(bench.slice(0, canIn).map(u => ({ type: 'staff/setActive', payload: { uid: u.uid, active: true } })))),
        opt('out', `🪑 ${T('hud.sb.toBench')}`, on.length, () => runOrder(on.map(u => ({ type: 'staff/setActive', payload: { uid: u.uid, active: false } })))),
        opt('swap', `🔄 ${T('hud.sm.swap')}`, null, () => { st.bulk = null; swapShift(); }),
        away.length ? opt('here', `📍 ${T('hud.sb.toHere')}`, away.length, () => runOrder(away.map(u => ({ type: 'staff/assign', payload: { uid: u.uid } })))) : null),
      h('p', { class: 'hud-sub' }, T('hud.sb.benchNote')));
  }
  function dockView(s, now, zone) {
    const picked = pickedUnits(s);
    if (!st.picking || !picked.length || gmHanded(s, zone)) { st.bulk = null; return null; }
    const canCare = orderPlan(s, picked, careOf(s, now)).take.length > 0;
    const open = id => { st.bulk = st.bulk === id ? null : id; sfx('ui.tab'); rerender(); };
    const btn = (id, icon, onClick, disabled = false) => h('button', { type: 'button', class: 'hud-sb-act', dataset: { hudId: `staffBulk-${id}` }, attrs: { 'aria-pressed': String(st.bulk === id) }, disabled, on: { click: onClick } },
      h('span', { attrs: { 'aria-hidden': 'true' } }, icon), h('small', null, T(`hud.sb.a.${id}`)));
    return h('div', { class: 'hud-sb-dock' },
      st.bulk === 'up' ? upgradePanel(s, picked) : st.bulk === 'shift' ? shiftPanel(s, zone, picked) : null,
      h('div', { class: 'hud-sb-count' }, h('strong', null, T('hud.sb.selected', { n: picked.length })),
        h('button', { type: 'button', class: 'hud-sb-clear', dataset: { hudId: 'staffBulkClear' }, on: { click: () => { st.sel.clear(); st.bulk = null; sfx('ui.tab'); rerender(); } } }, T('hud.sb.clear'))),
      h('div', { class: 'hud-sb-acts' },
        btn('up', '⬆️', () => open('up')), btn('shift', '🪑', () => open('shift')),
        btn('care', '🧰', () => orderCare(pickedUnits), !canCare), btn('fire', '👋', () => orderFire())));
  }
  // The manager's card, on top of Đội: an offer to take the team, or (handed over) what he did today.
  function gmReportBody(s, now, zone, keep) {
    const rep = gmStaffReport(s, now, zone);
    const cell = (label, value) => h('div', { class: 'hud-sm-cell hud-pf-kpi' }, h('small', null, label), h('strong', null, value));
    return [h('div', { class: 'hud-sm-grid hud-sm-grid--2 hud-pf-kpis' },
      cell(T('hud.sb.n.upgrade'), fmt(rep.n.upgrade)), cell(T('hud.sb.n.fire'), fmt(rep.n.fire)),
      cell(T('hud.sb.n.shift'), fmt(rep.n.shift)), cell(T('hud.sb.n.spent'), rep.spent > 0 ? coinAmount(rep.spent) : '0')),
    rep.rows.length ? h('ul', { class: 'hud-sm-journal' }, ...rep.rows.slice(0, keep).map(r => h('li', { class: 'hud-sm-jrow hud-hist-row is-manager' },
      h('span', { class: 'hud-sm-jtext' }, r.cost > 0 ? T('hud.gm.log.didCost', { what: gmReasonText(r.reason), coins: fmt(r.cost) }) : T('hud.gm.log.did', { what: gmReasonText(r.reason) })),
      h('small', { class: 'hud-sm-jago' }, whenText(r.at, now))))) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sb.noJobs'))];
  }
  function handCard(s, now, zone, rows) {
    const gm = gmOf(s);
    if (!gmHanded(s, zone)) return h('section', { class: 'hud-sb-hand' },
      actionButton({ id: 'staffHandOff', label: T('hud.sb.handBtn'), icon: '👨‍💼', tone: 'go', note: gm ? null : T('hud.sb.handNoGm'), onClick: () => handOff(rows.length) }));
    const n = gmStaffReport(s, now, zone).n;
    return h('section', { class: 'hud-sb-hand is-on' },
      h('p', { class: 'hud-sb-hand-text' }, h('strong', null, `👨‍💼 ${T('hud.sb.handedTitle', { name: gm.name })}`), h('small', null, T('hud.sb.handedLine', { up: fmt(n.upgrade), fire: fmt(n.fire), shift: fmt(n.shift) }))),
      h('div', { class: 'hud-sb-hand-btns' },
        actionButton({ id: 'staffFullReport', label: T('hud.sb.fullReport'), tone: 'plain', onClick: () => openReport() }),
        actionButton({ id: 'staffTakeBack', label: T('hud.sb.takeBack'), tone: 'plain', onClick: () => takeBack() })));
  }
  function openReport() {
    st.folds.report = true;
    sfx('ui.tab');
    rerender();
    body.querySelector('[data-hud-id="staffFold-report"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function handOff(n) {
    const gm = gmOf(store.state), zone = zoneNow();
    if (!gm) { ctx.toast(T('err.noGm'), 'info'); goTo({ tab: 'gm' }); return; }
    if (ctx.blockedByAuto?.()) return;
    const yes = await ctx.confirm({ title: T('hud.sb.handConfirmTitle', { name: gm.name }), body: T('hud.sb.handConfirmBody', { name: gm.name, n }), confirmLabel: T('hud.sb.handGo') });
    if (yes && act('gm/handStaff', { zone, on: true }).ok) { st.sel.clear(); st.bulk = null; sfx('reward.levelup'); ctx.toast(T('hud.sb.handDone', { name: gm.name }), 'good'); }
    rerender();
  }
  function takeBack() {
    if (act('gm/handStaff', { zone: zoneNow(), on: false }).ok) { sfx('ui.tab'); ctx.toast(T('hud.sb.tookBack'), 'info'); }
    rerender();
  }
  // ---------- Phân công: the one place for who works where. Touch people, then touch where they go ----------
  const TIER_JOBS = ['harvest', 'water', 'prune'];
  /** The board of this game: farm = open terraces, café = jobs. Each group lists who is in it now. */
  function assignGroups(s, zone) {
    const here = zoneUnits(s, zone).filter(u => hereOf(s, u));
    const byTrade = (a, b) => a.type.localeCompare(b.type) || nameOf(a).localeCompare(nameOf(b));
    if (zone === 'farm') {
      const open = openTiers(s), tierOf = u => { const t = s.gm?.tiers?.[u.uid]; return open.includes(t) ? t : null; };
      const groups = open.map(t => {
        const units = here.filter(u => tierOf(u) === t).sort(byTrade);
        return { id: t, label: T('hud.fm.tier', { n: t + 1 }), units, missing: TIER_JOBS.filter(j => !units.some(u => doesJob(u, j))) };
      });
      const none = here.filter(u => tierOf(u) === null).sort(byTrade);
      return none.length ? [...groups, { id: 'none', label: T('hud.sb.anyTier'), units: none, missing: [], noTarget: true }] : groups;
    }
    const canChange = u => (isRobot(u) ? (ROBOT_TASKS[u.type] || []).length > 1 : !STAFF[u.type].jobs);
    const jobOf = u => (isRobot(u) ? robotTask(u) : u.tasks?.[0] || 'auto');
    return ['auto', ...(WORKER_TASKS[zone] || [])].map(j => ({ id: j, label: T(`hud.staff.task.${j}`), units: here.filter(u => canChange(u) && jobOf(u) === j).sort(byTrade), missing: [] }));
  }
  function moveOp(zone, u, target) {
    if (zone === 'farm') return { type: 'gm/fmPin', payload: { uid: u.uid, tier: target } };
    return isRobot(u) ? { type: 'staff/setTask', payload: { uid: u.uid, task: target } } : { type: 'staff/setTasks', payload: { uid: u.uid, tasks: target === 'auto' ? [] : [target] } };
  }
  function splitEven(zone) {
    if (zone === 'farm') { if (act('gm/splitTiers', {}).ok) { st.place.clear(); sfx('ui.click'); ctx.toast(T('hud.sb.splitDone'), 'good'); } rerender(); return; }
    st.place.clear();
    const s = store.state;
    runOrder(assignGroups(s, zone).flatMap(g => g.units).map(u => moveOp(zone, u, 'auto')));
  }
  function assignView(s, zone) {
    const groups = assignGroups(s, zone), big = zoneUnits(s, zone).length > BIG_TEAM;
    if (!groups.some(g => g.units.length)) return h('div', { class: 'hud-sm-empty' }, h('p', { class: 'hud-line' }, T('hud.sb.nobodyToPlace')));
    if (zone === 'farm' && groups.filter(g => !g.noTarget).length <= 1) return h('p', { class: 'hud-sm-note' }, T('hud.sb.oneTier'));
    const toggle = ids => { const all = ids.every(id => st.place.has(id)); for (const id of ids) { if (all) st.place.delete(id); else st.place.add(id); } sfx('ui.tab'); rerender(); };
    const chip = u => h('button', { type: 'button', class: 'hud-as-chip', dataset: { hudId: `assign-${u.uid}` }, attrs: { 'aria-pressed': String(st.place.has(u.uid)) }, on: { click: () => toggle([u.uid]) } },
      h('span', { attrs: { 'aria-hidden': 'true' } }, STAFF[u.type].icon), h('span', { class: 'hud-as-name' }, u.name || T(`staff.${u.type}`)));
    const tradeChip = (g, type) => {
      const ids = g.units.filter(u => u.type === type).map(u => u.uid);
      return h('button', { type: 'button', class: 'hud-as-chip', dataset: { hudId: `assignT-${g.id}-${type}` }, attrs: { 'aria-pressed': String(ids.every(id => st.place.has(id))) }, on: { click: () => toggle(ids) } },
        h('span', { attrs: { 'aria-hidden': 'true' } }, STAFF[type].icon), h('span', { class: 'hud-as-name' }, `${T(`staff.${type}`)} ${ids.length}`));
    };
    return h('div', null,
      h('div', { class: 'hud-as-top' },
        h('small', null, T(big ? 'hud.sb.assignHintBig' : zone === 'farm' ? 'hud.sb.assignHint' : 'hud.sb.assignHintJob')),
        actionButton({ id: 'assignSplit', label: T(zone === 'farm' ? 'hud.sb.split' : 'hud.sb.allAuto'), tone: 'go', onClick: () => splitEven(zone) })),
      ...groups.map(g => h('section', { class: 'hud-as-group' },
        h('div', { class: 'hud-as-head' }, h('strong', null, g.label), h('small', null, T('hud.sb.people', { n: g.units.length })),
          g.missing.length ? h('small', { class: 'hud-as-miss' }, T('hud.sb.missing', { list: g.missing.map(j => T(`hud.staff.task.${j}`)).join(', ') })) : null,
          g.units.length ? h('button', { type: 'button', class: 'hud-as-all', dataset: { hudId: `assignAll-${g.id}` }, on: { click: () => toggle(g.units.map(u => u.uid)) } }, T('hud.sb.selectGroup')) : null),
        g.units.length ? h('div', { class: 'hud-as-chips' }, ...(big ? [...new Set(g.units.map(u => u.type))].map(type => tradeChip(g, type)) : g.units.map(chip))) : null)));
  }
  function assignDock(s, zone) {
    if (!st.place.size || gmHanded(s, zone)) return null;
    const picked = [...st.place].map(id => unitOf(s, id)).filter(Boolean);
    const go = id => { const ops = picked.map(u => moveOp(zone, u, id)); st.place.clear(); runOrder(ops); };
    return h('div', { class: 'hud-sb-dock' },
      h('div', { class: 'hud-sb-count' }, h('strong', null, T('hud.sb.moveTo', { n: picked.length })),
        h('button', { type: 'button', class: 'hud-sb-clear', dataset: { hudId: 'assignClear' }, on: { click: () => { st.place.clear(); sfx('ui.tab'); rerender(); } } }, T('hud.sb.clear'))),
      h('div', { class: 'hud-as-targets' }, ...assignGroups(s, zone).filter(g => !g.noTarget).map(g => h('button', { type: 'button', class: 'hud-as-target', dataset: { hudId: `assignTo-${g.id}` }, on: { click: () => go(g.id) } }, g.label))));
  }
  function rosterRow(s, u, key, now) {
    const info = infoOf(s, u), here = hereOf(s, u), cond = here ? conditionOf(u, info) : null;
    const poached = poachOf(s)?.uid === u.uid, on = st.sel.has(u.uid), picking = st.picking;
    const fix = !picking && here && !managed(s, zoneNow()) ? fixOf(u, key, now) : null; // the paid fix, right on the line
    return h('li', { class: `hud-rs-row is-${toneOf(key)}${on ? ' is-picked' : ''}`, dataset: { art: u.type } },
      h('button', { type: 'button', class: 'hud-rs-main', dataset: { hudId: picking ? `staffSelect-${u.uid}` : `staffUnit-${u.uid}` },
        attrs: picking ? { role: 'checkbox', 'aria-checked': String(on), 'aria-label': T('hud.sb.select', { name: nameOf(u) }) } : { 'aria-label': T('hud.sm.openUnit', { name: nameOf(u) }) },
        on: { click: () => (picking ? toggleUnit(u.uid) : goTo({ uid: u.uid })) } },
        picking ? h('span', { class: `hud-sb-box${on ? ' is-on' : ''}`, attrs: { 'aria-hidden': 'true' } }, on ? '✓' : '') : null,
        avatarOf(s, u, key),
        h('span', { class: 'hud-rs-text' },
          h('strong', { class: 'hud-rs-name' }, nameOf(u), u.perk ? ' ⭐' : '', poached ? ' 💼' : '', u.name && STAFF[u.type].jobs ? h('span', { class: 'hud-rs-trade' }, T(`staff.${u.type}`)) : null),
          h('small', { class: 'hud-rs-sub' }, `${u.name ? `${T(`staff.${u.type}`)} · ` : ''}${isRobot(u) ? T(`hud.staff.task.${robotTask(u)}`) : T('hud.staff.lv', { level: unitLevel(u) })}`), // no own name: the title already is the trade
          h('small', { class: `hud-report hud-report--${lineTone(key, info)}` }, nowLine(s, u, key, now, info))),
        vitalBars(u, false, info),
        cond != null && cond < 50 ? h('span', { class: `hud-rs-meter is-${cond < 25 ? 'bad' : cond < 50 ? 'warn' : 'ok'}`, attrs: { role: 'img', 'aria-label': T('hud.sm.condition', { n: cond }) } },
          h('i', { style: { height: `${Math.max(4, cond)}%` } })) : null,
      ),
      fix ? h('div', { class: 'hud-rs-fix' }, careButton(s, u, fix.kind, now, { compact: true, bare: true })) : null);
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
  const stars = n => h('span', { class: 'ui-stars', attrs: { 'aria-label': `${n}/5` } }, ...Array.from({ length: n }, () => h('i', { class: 'ui-star' })));
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  // The plan is cheap per call but the tab repaints every second: reuse it for the same save for up to 3 s.
  let planMemo = { s: null, at: 0, v: [] };
  function planOf(s, now) {
    if (planMemo.s !== s || now - planMemo.at > 3000) planMemo = { s, at: now, v: gmPlan(s, now) };
    return planMemo.v;
  }
  function gmView(s, now, zone) {
    const gm = gmOf(s), out = [];
    if (!gm || gm.isAuto) { out.push(gm ? h('p', { class: 'hud-sm-note' }, T('hud.gm.autoNote')) : null, gmBoardBlock(s, now)); return h('div', null, ...out); }
    if (gmPoachOf(s)) out.push(gmPoachBlock(s, now, gm));
    out.push(gmCard(s, now, gm), gmRequests(s).length ? gmRequestsBlock(s, now) : null, ...(zone === 'farm' ? fmBlocks(s, now) : []),
      fold('gmMore', `👨‍💼 ${T('hud.sb.gmProfile')}`, () => [gmStatsBlock(s, gm), gmWorth(s, now, gm),
        h('div', { class: 'hud-sm-fire' }, actionButton({ id: 'gmFire', label: T('hud.gm.fire'), tone: 'plain', onClick: () => gmFire() }))]),
      fold('gmLog', `📒 ${T('hud.gm.sec.log')}`, () => [gmLogBlock(s, now), zone === 'farm' && fmData(s, now).log.length ? section('hud.fm.sec.log', h('ul', { class: 'hud-sm-journal' }, ...fmData(s, now).log.map(e => fmLogRow(e, now)))) : null]));
    return h('div', null, ...out);
  }
  // The Auto card's report: what the run did and, while it goes, the manager's own numbers on it.
  function autoView(s, now) {
    return h('div', null, autoPanel(ctx, s, { detail: true }), ...(autoManaged(s) ? [...fmBlocks(s, now), fold('gmLog', `📒 ${T('hud.gm.sec.log')}`, () => [gmLogBlock(s, now), fmData(s, now).log.length ? section('hud.fm.sec.log', h('ul', { class: 'hud-sm-journal' }, ...fmData(s, now).log.map(e => fmLogRow(e, now)))) : null])] : []));
  }
  // ---------- Farm Manager V2 panel (docs/design/farm-manager-v2.md) ----------
  // Rebuilt at most every 3 s (or at once when a setting changes): the modal repaints every second.
  let fmMemo = { at: 0, sig: '', v: null };
  function fmData(s, now) {
    const f = s.gm?.fm, sig = f ? `${f.auto}${f.stance}${f.ask}${f.mode}${f.minReserve}${f.spendLimit}${f.build}${f.land}${f.hire}${JSON.stringify(f.pins)}` : '';
    if (!fmMemo.v || now - fmMemo.at > 3000 || sig !== fmMemo.sig) fmMemo = { at: now, sig, v: dashboardOf(s, now, planOf(s, now)) };
    return fmMemo.v;
  }
  const fmSet = (key, value) => { if (act('gm/fmSet', { key, value }).ok) { sfx('ui.tab'); rerender(); } };
  const fmObjective = (plan, off) => {
    if (off) return T('hud.fm.obj.off');
    if (!plan) return T('hud.fm.obj.run');
    const p = plan.params || {};
    return T(`hud.fm.obj.${plan.objective}`, { ...p, cat: p.cat ? T(`hud.fm.cat.${p.cat}`) : '' });
  };
  function fmTierRow(t, why = null) {
    const name = `${T('hud.fm.tier', { n: t.t + 1 })} · ${T(`hud.fm.zone.${t.zone}`)}`;
    if (!t.owned) return h('li', { class: 'hud-fm-tier is-locked' }, h('strong', null, name), h('small', null, T('hud.fm.locked', { coins: fmt(t.unlockCost) }), why ? ` · ${T(`hud.fm.code.${why}`)}` : ''), h('small', null, T('hud.fm.tierWorth', { crop: t.best ? T(`crop.${t.best}`) : '—', coins: fmt(Math.round(t.flow)) })));
    return h('li', { class: 'hud-fm-tier' }, h('strong', null, name),
      h('small', null, `${T('hud.fm.tierRow', { planted: t.planted, plots: t.plots })} · 🌾${t.ripe} · 💧${t.dry} · 👷${t.crew} · 🏗️${t.buildings} · 🪙${fmt(Math.round(t.earnPerMin))}/${T('hud.minuteShort')}`),
      t.best ? h('small', null, T('hud.fm.tierPick', { crop: T(`crop.${t.best}`), coins: fmt(Math.round(t.bestRate)) })) : null);
  }
  function fmLogRow(e, now) {
    const what = e.reason ? gmReasonText(e.reason) : T(`hud.fm.cat.${e.cat || 'other'}`);
    const pay = e.known && e.payback != null ? T('hud.fm.logPay', { min: Math.round(e.payback) }) : '';
    return h('li', { class: 'hud-sm-jrow hud-hist-row is-manager' }, h('span', { class: 'hud-sm-jtext' }, `${T('hud.fm.logLine', { what, code: T(`hud.fm.code.${e.code}`) })}${pay}`), h('small', { class: 'hud-sm-jago' }, whenText(e.at, now)));
  }
  // Heart–Reason slider: the position sets discipline, its nearest mark the investment goal. Drag previews, release saves.
  function stanceBlock(f) {
    const S = FARM_MANAGER.stance, snap = v => { const m = [0, 100, ...S.marks.map(x => x[0])].find(x => Math.abs(x - v) <= S.snap); return m ?? v; };
    const goal = h('p', { class: 'hud-fm-obj' }), fx = h('p', { class: 'hud-sub' });
    const show = v => {
      const e = stanceEffects(v), pct = Math.round((e.speed - 1) * 100), parts = [];
      if (pct) parts.push(T('hud.fm.fx.speed', { v: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%` }));
      if (e.moralePerMin) parts.push(T(e.moralePerMin < 0 ? 'hud.fm.fx.moraleDown' : 'hud.fm.fx.moraleUp', { v: Math.abs(e.moralePerMin).toFixed(1) }));
      if (e.bonus) parts.push(T('hud.fm.fx.reward', { coins: fmt(e.bonus) }));
      if (e.quits) parts.push(T('hud.fm.fx.quit'));
      goal.textContent = T(`hud.fm.goal.${stanceMode(v)}`);
      fx.textContent = parts.length ? parts.join(' · ') : T('hud.fm.fx.none');
    };
    const input = h('input', { class: 'hud-fm-range', type: 'range', attrs: { min: '0', max: '100', step: '1', 'aria-label': T('hud.fm.stance.aria') },
      on: { input: e => { const v = snap(+e.target.value); e.target.value = v; show(v); }, change: e => fmSet('stance', snap(+e.target.value)), pointerdown: e => e.stopPropagation() } });
    input.value = f.stance; show(f.stance);
    const marks = h('div', { class: 'hud-fm-marks', attrs: { 'aria-hidden': 'true' } }, ...S.marks.filter(m => m[0] > 0).map(([at, mode]) => h('span', { style: { left: `${at}%` } }, T(`hud.fm.mark.${mode}`))));
    return h('section', { class: 'hud-sm-sec hud-fm-stance' }, h('h3', { class: 'hud-h3' }, T('hud.fm.stance.title')),
      h('div', { class: 'hud-fm-ends' }, h('b', null, T('hud.fm.stance.heart')), h('b', null, T('hud.fm.stance.reason'))), input, marks, goal, fx,
      h('label', { class: 'hud-fm-ask' }, h('input', { type: 'checkbox', checked: !!f.ask, on: { change: e => fmSet('ask', e.target.checked) } }), h('span', null, T('hud.fm.ask'))));
  }
  function fmBlocks(s, now) {
    const d = fmData(s, now), f = d.settings, top = d.plan?.top;
    const M = d.money, sign = v => `${v < 0 ? '−' : ''}${fmt(Math.abs(Math.round(v)))}`;
    const durationText = min => (min >= 120 ? T('hud.fm.hours', { h: Math.round(min / 60) }) : T('hud.fm.mins', { m: min }));
    const cell = (label, value, cls = '') => h('div', { class: `hud-sm-cell hud-pf-kpi ${cls}` }, h('small', null, label), h('strong', null, value));
    const blocks = (d.plan?.blocks || []).filter(b => b.code !== d.plan?.objective?.replace('fix.', ''));
    const next = top ? h('p', { class: 'hud-sub' }, T('hud.fm.next', { what: T(`hud.fm.cat.${top.cat}`), coins: fmt(top.cost) }), ' · ', top.known && top.payback != null ? T('hud.fm.nextPay', { min: Math.round(top.payback), net: fmt(Math.round(top.net)) }) : T('hud.fm.nextEst')) : h('p', { class: 'hud-sub' }, T('hud.fm.noNext'));
    return [
      autoManaged(s) ? null : stanceBlock(f),
      h('section', { class: 'hud-sm-sec' },
        h('p', { class: `hud-fm-obj${d.recovery ? ' is-bad' : ''}` }, fmObjective(d.plan, !f.auto)),
        h('div', { class: 'hud-sm-grid hud-pf-kpis hud-sb-kpi3' },
          cell(T('hud.fm.coins'), fmt(d.coins)), cell(T('hud.fm.netMin'), sign(M.net), M.net < 0 ? 'is-bad' : 'is-good'), cell(T('hud.fm.owed'), fmt(M.owed), M.owed > 0 ? 'is-bad' : '')),
        M.whyLoss === 'ok' ? null : h('p', { class: 'hud-fm-obj is-bad' }, T(`hud.fm.why.${M.whyLoss}`, { stock: fmt(M.stock), potential: fmt(M.potential), opex: fmt(M.opex), labour: M.labour })),
        M.whyLoss === 'unsold' && !f.autoSell ? h('div', { class: 'hud-row' }, actionButton({ id: 'fmSellOn', label: T('hud.fm.letSell'), tone: 'go', onClick: () => fmSet('autoSell', true) })) : null,
        next),
      fold('fmData', `📊 ${T('hud.sb.gmDetail')}`, () => [
        h('div', { class: 'hud-sm-grid hud-sm-grid--2 hud-pf-kpis' },
          cell(T('hud.fm.stock'), fmt(M.stock)), cell(T('hud.fm.worth'), sign(M.worth), M.worth < 0 ? 'is-bad' : 'is-good'),
          cell(T('hud.fm.earned'), fmt(M.earned)), cell(T('hud.fm.opex'), fmt(M.opex)),
          cell(T('hud.fm.invest'), fmt(M.invest)), cell(T('hud.fm.reserve'), fmt(d.reserve)), cell(T('hud.fm.free'), fmt(d.budget))),
        d.handsPerMin ? h('p', { class: 'hud-sub' }, T('hud.fm.hands', { n: d.handsPerMin })) : null,
        h('p', { class: 'hud-sub' }, M.owed <= 0 ? T('hud.fm.noDebt') : M.payoffMin == null ? T('hud.fm.payoffNone') : T(M.payoffMeasured ? 'hud.fm.payoff' : 'hud.fm.payoffModel', { t: durationText(M.payoffMin) })),
        h('p', { class: 'hud-sub' }, T('hud.fm.water', { wells: d.wells, dry: d.dry, orders: d.orders })),
        Object.keys(d.queue).length ? h('p', { class: 'hud-sub' }, T('hud.fm.queue', { list: Object.entries(d.queue).map(([k, n]) => `${T(`hud.fm.job.${k}`)} ${n}`).join(' · ') })) : null,
        d.away ? h('p', { class: 'hud-sub' }, T('hud.fm.away', { min: d.away.minutes, earned: fmt(Math.round(d.away.earned)), salary: fmt(Math.round(d.away.salary)), ripe: d.away.ripe, empty: d.away.empty, orders: d.away.orders })) : null,
        section('hud.fm.sec.need', h('ul', { class: 'hud-fm-tiers' },
          ...d.need.rows.map(r => h('li', { class: 'hud-fm-tier' }, h('strong', null, T(`hud.fm.need.${r.job}`, { n: fmt(r.backlog) })), h('small', { class: r.have < r.want ? 'is-short' : '' }, T('hud.fm.needLine', { want: r.want, have: r.have })))),
          h('li', { class: 'hud-fm-tier' }, h('strong', null, T('hud.fm.need.storage', { stored: fmt(d.need.storage.stored), capacity: fmt(d.need.storage.capacity) })), h('small', { class: d.need.storage.silos < d.need.storage.want ? 'is-short' : '' }, T('hud.fm.needSilo', { want: d.need.storage.want, have: d.need.storage.silos }))))),
        section('hud.fm.sec.tiers', h('ul', { class: 'hud-fm-tiers' }, ...d.tiers.map(t => fmTierRow(t, t.t === d.nextTier ? d.landWhy : null)))),
        blocks.length ? section('hud.fm.sec.blocks', h('ul', { class: 'hud-fm-tiers' }, ...blocks.map(b => h('li', { class: 'hud-fm-tier' }, h('small', null, T(`hud.fm.obj.fix.${b.code}`, b)))))) : null,
      ]),
    ].filter(Boolean);
  }
  // His four numbers: what each does, one tap to raise it.
  const GM_ICON = { speed: '⚡', smart: '🧠', accuracy: '🎯', stamina: '💪' };
  function gmStatsBlock(s, gm) {
    return h('ul', { class: 'hud-hire hud-gm-stats' }, ...GM.stats.map(k => {
      const n = gmStatOf(gm, k), cost = GM.statCost * n, top = n >= GM.maxStat;
      return h('li', { class: 'hud-hire-row' }, h('span', { class: 'hud-hire-ico', attrs: { 'aria-hidden': 'true' } }, GM_ICON[k]),
        h('div', { class: 'hud-hire-text' }, h('p', { class: 'hud-hire-top' }, h('strong', null, T(`hud.stat.${k}`)), h('span', null, `${n}/${GM.maxStat}`)), h('small', null, T(`hud.gm.statFx.${k}`))),
        h('div', { class: 'hud-hire-act' }, top ? h('span', { class: 'hud-tag' }, T('hud.maxLevel')) : actionButton({ label: '⬆️', cost, tone: 'gold', disabled: s.player.coins < cost, onClick: () => { if (act('gm/upgradeStat', { stat: k }).ok) sfx('reward.levelup'); } })));
    }));
  }
  // A rival wants him: keep him for a bonus, or pick who comes next and let him go.
  function gmPoachBlock(s, now, gm) {
    const p = gmPoachOf(s), reserve = s.gm.reserve;
    if (!p) return null;
    const total = Math.max(0, Math.ceil(p.leftMs / 60000)), left = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    const short = s.player.coins < p.fee;
    return h('section', { class: 'hud-gm-poach' },
      h('p', { class: 'hud-gm-poach-top' }, h('strong', null, T('hud.gm.poachNow', { name: gm.name, rival: GM.poach.rival })), h('small', null, T('hud.gm.poachLeft', { t: left }))),
      h('div', { class: 'hud-gm-poach-btns' },
        actionButton({ label: T('hud.gm.keepHim'), cost: p.fee, tone: 'gold', disabled: short, onClick: () => { if (act('gm/keep', {}).ok) sfx('coin.spend'); } }),
        actionButton({ label: T('hud.gm.letHim'), tone: 'plain', onClick: () => act('gm/letGo', {}) })),
      h('h3', { class: 'hud-sm-h' }, T('hud.gm.reserveTitle')),
      h('ul', { class: 'hud-hire' }, ...gmBoard(s).map((c, i) => h('li', { class: `hud-hire-row${reserve === i ? ' is-rare' : ''}` },
        h('span', { class: 'hud-hire-ico', attrs: { 'aria-hidden': 'true' } }, c.gender === 'male' ? '👨‍💼' : '👩‍💼'),
        h('div', { class: 'hud-hire-text' }, h('p', { class: 'hud-hire-top' }, h('strong', null, c.name), h('span', null, stars(c.skill))), h('small', null, T('hud.gm.reserveFee', { coins: fmt(c.fee) }))),
        h('div', { class: 'hud-hire-act' }, actionButton({ label: T(reserve === i ? 'hud.gm.reserved' : 'hud.gm.reserve'), tone: reserve === i ? 'go' : 'plain', onClick: () => act('gm/pickReserve', { index: i }) }))))));
  }
  function gmCard(s, now, gm) {
    return h('div', { class: 'hud-gm-card' },
      h('span', { class: 'hud-gm-face', attrs: { 'aria-hidden': 'true' } }, gm.gender === 'male' ? '👨‍💼' : '👩‍💼'),
      h('div', { class: 'hud-gm-who' },
        h('strong', null, gm.name, ' ', h('span', { class: 'hud-gm-stars' }, stars(gm.skill))),
        h('small', null, T(s.gm?.fm?.autoSell === false ? 'hud.gm.rule' : 'hud.gm.ruleSell'))));
  }
  // Ignored requests pile up (management-rules §4.3): Chờ lệnh / dễ bị dụ / Đình công, and the apology that clears it.
  // Why the manager's spirits are sinking now (idle: you did everything; absent: nobody touched the game).
  // Giấy phép (§2.5): the player's licences — what the manager may do; Đào tạo: his next skill step.
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
    if (!list.length) return h('p', { class: 'hud-gm-none' }, T('hud.gm.noSign'));
    return section('hud.gm.sec.requests', h('ul', { class: 'hud-hire' }, ...list.map(q => h('li', { class: 'hud-hire-row' },
      h('span', { class: 'hud-hire-ico', attrs: { 'aria-hidden': 'true' } }, '✍️'),
      h('div', { class: 'hud-hire-text' }, h('p', { class: 'hud-hire-top' }, h('strong', { class: 'hud-gm-wrap' }, gmReasonText(q.reason))), h('small', null, mmss(q.untilPlayed - (s.clock?.played || 0)))),
      h('div', { class: 'hud-gm-sign' },
        actionButton({ label: T('hud.gm.sign'), tone: 'go', disabled: s.player.coins < q.cost, onClick: () => { const r = act('gm/approve', { id: q.id }); if (r.ok) sfx('ui.click'); } }),
        actionButton({ label: T('hud.gm.deny'), tone: 'plain', onClick: () => act('gm/deny', { id: q.id }) }))))));
  }
  // Suggestions: the plan, best first, with what the GM will do about each one; hand one over with a tap.
  function gmBoardBlock(s, now) {
    const wait = gmBoardRefreshIn(s, now);
    const rows = gmBoard(s).map((c, i) => h('li', { class: 'hud-hire-row' },
      h('span', { class: 'hud-hire-ico', attrs: { 'aria-hidden': 'true' } }, c.gender === 'male' ? '👨‍💼' : '👩‍💼'),
      h('div', { class: 'hud-hire-text' }, h('p', { class: 'hud-hire-top' }, h('strong', null, c.name), h('span', null, stars(c.skill))),
        h('small', null, T('hud.gm.salary', { coins: fmt(gmSalary(c, 'full')), min: GM.payMinutes }))),
      h('div', { class: 'hud-hire-act' }, actionButton({ id: `gmHire-${i}`, label: T('hud.hire'), cost: c.fee, tone: 'gold', disabled: s.player.coins < c.fee,
        onClick: () => { const r = act('gm/hire', { index: i }); if (r.ok) sfx('reward.levelup'); } }))));
    // Close to the Level-10 incident the region (and the manager with it) is wiped: say so before 500+ coins go on a hire.
    const lvLeft = EXPIRY_ENABLED && !s.story.level10Done ? EXPIRY_LEVEL - level(s) : 99;
    const soon = lvLeft > 0 && lvLeft <= 2 ? h('p', { class: 'hud-sm-note is-warn' }, T('hud.gm.lv10Soon', { n: lvLeft, level: EXPIRY_LEVEL })) : null;
    return h('div', null, h('p', { class: 'hud-sub' }, T('hud.gm.what')), soon, h('ul', { class: 'hud-hire' }, ...rows),
      h('div', { class: 'hud-hire-refresh' }, h('span', { class: 'hud-sub' }, wait > 0 ? T('hud.gm.refreshIn', { t: mmss(wait) }) : ''),
        actionButton({ label: T('hud.gm.refresh'), icon: '🔄', cost: wait > 0 ? GM.board.refreshCost : undefined, tone: 'plain', onClick: () => act('gm/refreshBoard', { roll: Math.random(), paid: wait > 0 }) })));
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
    return T('hud.g4.fx.can', { n: TEND.bucketPlots + I.plots[t] });
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
  // Craft skills: one row per job type of the zone (step, progress to the next, what the next step gives).
  function craftBlock(u) {
    const tasks = (CRAFT.tasks[STAFF[u.type].zone] || []).filter(t => !STAFF[u.type].jobs || STAFF[u.type].jobs.includes(t)); // a trade practises its own job
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
  const PROFILE_TABS = { worker: ['today', 'grow', 'history'], robot: ['today', 'grow', 'history'] };
  function detailView(s, now, zone, u) {
    if (!u) return h('p', { class: 'hud-line' }, T('hud.sm.gone'));
    const robot = isRobot(u), tabsOf = PROFILE_TABS[robot ? 'robot' : 'worker'];
    const ptab = tabsOf.includes(st.ptab) ? st.ptab : 'today';
    const out = h('div', { class: 'hud-sm-detail' }, idCard(s, now, u),
      h('div', { class: 'hud-tabs hud-sm-ptabs', attrs: { role: 'group', 'aria-label': T('hud.pf.tabs') } },
        ...tabsOf.map(id => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `staffPTab-${id}` }, attrs: { 'aria-pressed': String(ptab === id) },
          on: { click: () => { if (st.ptab !== id) goTo({ ptab: id }); } } }, T(`hud.pf.tab.${id}`)))));
    if (ptab === 'today') out.append(...overviewView(s, now, zone, u));
    else if (ptab === 'grow') out.append(...growView(s, now, zone, u));
    else out.append(...historyView(s, now, u));
    return out;
  }
  // Phát triển: the upgrades worth buying now (payback, like «Cần bạn»), then every ladder of this unit.
  function growView(s, now, zone, u) {
    const robot = isRobot(u), how = () => howItWorks(u, STAFF[u.type].zone, infoOf(s, u));
    const opts = upgradeOptions(s, u).sort((a, b) => a.payback - b.payback).slice(0, 3);
    const tips = opts.length ? h('ul', { class: 'hud-ny-list' }, ...opts.map(o => {
      const short = s.player.coins < o.cost, slow = o.payback > UPGRADE_GATE.paybackMin;
      return h('li', { class: `hud-ny is-p${slow ? 6 : 5}` },
        h('span', { class: 'hud-ny-main' }, h('span', { class: 'hud-ny-ico', attrs: { 'aria-hidden': 'true' } }, (o.act.type === 'staff/buyGear' && GEAR.items[o.act.payload?.item]?.icon) || PAY_ICON[o.act.type] || '⬆️'), // gear shows its own item (boots, hat…), not one glove for all
          h('span', { class: 'hud-ny-text' }, h('strong', null, upgradeWhat(o)), h('small', null, T(slow ? 'hud.ny.paybackSlow' : 'hud.ny.payback', { min: Math.max(1, Math.round(o.payback)) })))),
        h('div', { class: 'hud-ny-act' }, actionButton({ label: T('hud.ny.upgradeBtn'), cost: o.cost, tone: slow ? 'plain' : 'gold', disabled: short, note: short ? needMore(o.cost - s.player.coins) : null,
          onClick: () => { const r = act(o.act.type, o.act.payload); if (r.ok) sfx('coin.spend'); } })));
    })) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.pf.suggestNone'));
    const out = [section('hud.pf.sec.suggest', tips, h('p', { class: 'hud-sub' }, T('hud.pf.suggestNote')))];
    if (robot) out.push(partsBlock(s, u), softwareBlock(s, u));
    else {
      out.push(statsBlock(s, u, zone));
      if ((GEAR.zone[STAFF[u.type].zone] || []).length) out.push(gearBlock(s, u));
      out.push(fold('craft', T('hud.cr.craftSec'), () => craftBlock(u)));
    }
    out.push(fold(`how:${u.uid}`, T('hud.staff.howTitle'), () => how()));
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
      : `${T('hud.pf.who', { age: u.age ?? '—', home: u.home || '—', date, days })}${u.hobbies?.length ? ` · ${T('hud.pf.hobbies', { list: u.hobbies.map(k => T(`hobby.${k}`)).join(', ') })}` : ''}`;
    const tags = robot
      ? [tag(T(`hud.staff.task.${robotTask(u)}`)) /* the task label carries its own icon */, tag(T('hud.pf.fixedStar')), warrantyLeft(u) > 0 ? tag(T('hud.g4.warrantyTag', { n: warrantyLeft(u) }), 'good') : null]
      : [tag(T('hud.staff.lv', { level: unitLevel(u) }), 'gold'), TRAITS[u.trait] ? tag(`${TRAITS[u.trait].icon} ${T(`staff.trait.${u.trait}`)}`) : null,
        unitStars(u) > 0 ? tag('⭐'.repeat(unitStars(u))) : null]; // no stars yet: no empty pill
    return h('div', { class: 'hud-sm-dhead hud-pf-id' },
      h('span', { class: `hud-sm-avatar hud-sm-avatar--big hud-pf-photo${photo ? ' has-photo' : ''}`, style: { '--hue': String(hueOf(u.uid)) }, dataset: { art: u.type }, attrs: { 'aria-hidden': 'true' } }, // data-art: the trade's picture while no photo exists (skin/staff.css)
        photo ? h('img', { src: photo, alt: '', attrs: { width: '72', height: '72', draggable: 'false' } }) : def.icon,
        h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂')),
      h('div', { class: 'hud-sm-dhead-text' },
        h('strong', { class: 'hud-sm-dname' }, nameOf(u)),
        robot ? h('small', { class: 'hud-pf-who' }, who) : h('dl', { class: 'hud-pf-facts' },
          h('dt', null, T('hud.pf.code')), h('dd', null, employeeCode(u)),
          h('dt', null, T('hud.pf.age')), h('dd', null, u.age ?? '—'),
          h('dt', null, T('hud.pf.home')), h('dd', null, u.home || '—'),
          u.hobbies?.length ? h('dt', null, T('hud.pf.like')) : null, u.hobbies?.length ? h('dd', null, u.hobbies.map(k => T(`hobby.${k}`)).join(', ')) : null,
          h('dt', null, T('hud.pf.joined')), h('dd', null, `${date} (${T('hud.pf.days', { n: days })})`)),
        h('span', { class: 'hud-pf-tags' }, ...tags, perkBadge(u.perk), u.follower ? tag(T('hud.follow.tag', { coins: followerWage(u), min: UPKEEP.perMinutes }), 'gold') : null),
        h('small', { class: `hud-report hud-report--${lineTone(key, infoOf(s, u))}` }, nowLine(s, u, key, now, infoOf(s, u)))),
      robot ? null : h('div', { class: 'hud-pf-health' }, vitalBars(u, true, infoOf(s, u)), certRow(s, u)));
  }
  // Health certificate on the staff card: class, exam date, how long it lasts, and a new exam once it has run out.
  function certRow(s, u) {
    const c = checkupOf(u); if (!c) return null;
    return h('div', { class: `hud-pf-cert${c.expired ? ' is-expired' : ''}` },
      h('div', null, h('strong', null, `🩺 ${T('hud.pf.cert')}: ${T('hud.pf.grade', { g: c.grade })}`), h('small', null, `${T('hud.pf.examined', { date: dateText(c.at) })} · ${c.expired ? T('hud.pf.expired') : T('hud.pf.valid', { n: c.left })}`)),
      c.expired ? actionButton({ id: 'checkupOne', label: T('hud.pf.recheck'), cost: CHECKUP.cost, tone: 'gold', disabled: s.player.coins < CHECKUP.cost, onClick: () => { if (act('staff/checkup', { uid: u.uid }).ok) rerender(); } }) : null);
  }
  /** List avatar: the unit's photo when it is drawn here (cached by the realm), else its icon on a per-unit tint. */
  function avatarOf(s, u, key) {
    const photo = hereOf(s, u) ? ctx.realm?.portrait?.(u.uid) : null;
    return h('span', { class: `hud-sm-avatar hud-pf-photo${photo ? ' has-photo' : ''}`, style: { '--hue': String(hueOf(u.uid)) }, attrs: { 'aria-hidden': 'true' } },
      photo ? h('img', { src: photo, alt: '', attrs: { width: '48', height: '48', draggable: 'false' } }) : STAFF[u.type].icon,
      h('span', { class: 'hud-sm-avatar-state' }, STATE_ICON[key] || '🙂'));
  }
  const tag = (text, tone = '') => h('span', { class: `hud-pf-tag${tone ? ` is-${tone}` : ''}` }, text);
  const hueOf = uid => ((parseInt(String(uid).replace(/\D+/g, ''), 10) || 0) * 67) % 360;
  const dateText = ms => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

  function overviewView(s, now, zone, u) {
    const def = STAFF[u.type], key = stateKey(s, u, now), info = infoOf(s, u), robot = isRobot(u), here = hereOf(s, u);
    const parts = [];
    // now: state, what to do, care, vitals, shift
    const cares = (robot ? ROBOT_CARE : WORKER_CARE).filter(k => careError(s, u, k, now) !== 'notNeeded');
    const care = cares.map(k => careButton(s, u, k, now));
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
      h('p', { class: `hud-sm-state hud-sm-state--${toneOf(key)}` }, h('span', { class: 'hud-sm-state-ico', attrs: { 'aria-hidden': 'true' } }, STATE_ICON[key] || '🙂'), key === 'funny' && u.stopped?.id ? T(`funny.${u.stopped.id}.${u.stopped.level}`) : T(`hud.sm.state.${key}`)), // what they are actually up to (Napping), as the head says
      isRobot(u) ? vitalBars(u, true, info) : null,
      h('p', { class: 'hud-sm-todo' }, h('strong', null, T('hud.sm.todoTitle')), ' ', todoText(s, u, key, info)),
      care.length ? h('div', { class: 'hud-sm-care' }, care) : null,
      ...shift));
    parts.push(todayBlock(s, now, u));
    if (robot) parts.push(paybackBlock(now, u));
    parts.push(fold(`week:${u.uid}`, T('hud.pf.sec.week'), () => weekBlock(now, u)));
    if (robot) parts.push(robotTaskBlock(s, u, info));
    else parts.push(taskBlock(s, u, zone)); // career → Phát triển
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
      kpi(T('hud.pf.kpi.profit'), k ? coinValue(Math.round(k.profit)) : '—', k && hasY ? delta(k.profit, y.profit) : null),
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
    if ((ROBOT_TASKS[u.type] || []).length <= 1) return h('p', { class: 'hud-sm-job' }, T(`hud.staffJob.${u.type}`)); // one function: nothing to set
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
      cell(T('hud.sm.book.earned'), coinValue(b.earned || 0)),
      cell(T('hud.sm.book.spent'), coinValue(b.spent || 0)),
      robot ? cell(T('hud.pf.partsSpent'), coinValue(u.partsSpent || 0)) : cell(T('hud.sm.book.mistakes'), fmt(b.mistakes || 0)),
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
    if (STAFF[u.type].jobs) return h('p', { class: 'hud-sm-job' }, T(`hud.staffJob.${u.type}`)); // a trade has its one job
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
    const n = statOf(u, stat), cap = Math.min(maxStatOf(u), statCap(u, stat)), err = statError(s, u, stat), price = statPrice(u, stat);
    const pips = h('span', { class: 'hud-sm-pips', attrs: { 'aria-label': T('hud.sm.statOf', { n, max: maxStatOf(u) }) } },
      ...Array.from({ length: maxStatOf(u) }, (_, i) => h('span', { class: i < n ? 'is-on' : i >= cap ? 'is-cap' : '' })));
    let foot;
    if (err === 'maxLevel') foot = h('span', { class: 'hud-tag' }, T('hud.maxLevel'));
    else if (err === 'cap') foot = lockTag(T('hud.sm.capped', { trait: T(`staff.trait.${u.trait}`), max: cap }));
    else foot = actionButton({ label: price.points ? T('hud.sm.raise', { n: price.points }) : T('hud.upgrade'), icon: '⬆️', cost: price.coins, tone: 'gold', disabled: !!err,
      note: err === 'points' ? T('hud.sm.needPoints', { n: price.points - (u.points || 0) }) : err === 'coins' ? needMore(price.coins - s.player.coins) : null,
      onClick: () => { const r = act('staff/upgradeStat', { uid: u.uid, stat }); if (r.ok) sfx('reward.levelup'); } });
    return h('div', { class: 'hud-sm-stat' },
      h('div', { class: 'hud-sm-stat-top' }, h('strong', null, `${STAT_ICON[stat]} ${T(`hud.stat.${stat}`)}`), pips, h('span', { class: 'hud-sm-stat-n' }, `${n}/${maxStatOf(u)}`)),
      h('small', { class: 'hud-sm-stat-next' }, n >= maxStatOf(u) ? T(`hud.sm.statTop.${stat}`) : T('hud.sm.next', { text: statGain(u, stat, n + 1, zone) })),
      n < maxStatOf(u) ? paybackHint(s, u, { stat }, err) : null,
      foot);
  }
  /** What raising `stat` to `to` gives (from config). */
  function statGain(u, stat, to, zone) {
    const parts = [];
    if (stat === 'speed') parts.push(T('hud.sm.gain.speed', { pct: Math.round((STAFF[u.type].jobs ? CREW.speedCurve[to - 1] / CREW.speedCurve[0] - 1 : LEVEL_STEP.speed * (to - 1)) * 100) }));
    else if (stat === 'smart') {
      const known = CREW.rules[u.type] || ZONE_RULES[zone]; // a trade only learns its own habits
      for (const [id, at] of Object.entries(SMART_RULES)) if (at === to && known?.includes(id)) parts.push(T(`hud.staff.rule.${id}`));
      const jobOf = STAFF[u.type].jobs?.[0], trait = GOOF.traitMul[u.trait] ?? 1, rate = list => `${Math.round(list * trait * 100)}%`;
      if (jobOf) {
        parts.push(T('hud.sm.gain.lost', { from: rate(GOOF.lost[to - 2]), to: rate(GOOF.lost[to - 1]) }));
        const gate = { harvest: 'hardCrop', plant: 'hardCrop', prune: 'oldTree', process: 'wetMill' }[jobOf];
        if (gate && SKILL_GATE[gate].smart === to) parts.push(T(`hud.sm.gain.learn.${gate}`));
      } else if (to === TASK_LIMIT.moreFromSmart) parts.push(T('hud.sm.gain.tasks', { n: TASK_LIMIT.more }));
    } else if (stat === 'accuracy') {
      if (zone === 'farm') parts.push(T('hud.sm.gain.funny'));
      const job = STAFF[u.type].jobs?.[0], k = { harvest: 'unripe', plant: 'crooked', haul: 'drop' }[job] || (job ? null : ZONE_MISTAKES[zone]?.[0] || 'spill'), mul = MISTAKES.traitMul[u.trait] ?? 1;
      const pct = i => `${Math.round((MISTAKES.rates[k][i] || 0) * mul * 1000) / 10}%`;
      if (k) parts.push(T(`hud.sm.gain.accuracy.${k}`, { from: pct(to - 2), to: pct(to - 1) }));
      if (job === 'water') parts.push(T('hud.sm.gain.waterFx', { pct: Math.round((TEND.speedup + CREW.accuracy.waterStep * (to - 1)) * 100) }));
      if (job === 'process') parts.push(T('hud.sm.gain.premiumFx', { pct: Math.round(CREW.accuracy.premiumStep * (to - 1) * 100) }));
      if (job === 'prune' && to === CREW.accuracy.trimTwoFrom) parts.push(T('hud.sm.gain.trimFx'));
      if (to === QUALITY.workerTwoStar) parts.push(T('hud.staff.rule.twoStar'));
      if (to === QUALITY.hardLevel && zone === 'shop') parts.push(T('hud.staff.rule.hard'));
    } else if (stat === 'stamina') {
      parts.push(T('hud.sm.gain.stamina', { energy: 100 + VITALS.staminaEnergyStep * (to - 1), slack: Math.round(LEVEL_STEP.slack * 100) }));
      if (to === VITALS.staminaHungerFrom) parts.push(T('hud.sm.gain.hunger'));
      const job = STAFF[u.type].jobs?.[0];
      if (job) parts.push(T('hud.sm.gain.play', { from: `${Math.round(GOOF.play[to - 2] * (GOOF.traitMul[u.trait] ?? 1) * 100)}%`, to: `${Math.round(GOOF.play[to - 1] * (GOOF.traitMul[u.trait] ?? 1) * 100)}%` }));
      if (CREW.perStamina[job]) parts.push(T(`hud.sm.gain.carry.${job}`, { n: CREW.perStamina[job] }));
    }
    return parts.length ? parts.join(' · ') : T('hud.staff.rule.faster');
  }

  // Robot: four hardware parts (a robot never learns: only its hardware is upgraded).
  function partsBlock(s, u) {
    const parts = PART_ORDER.map(part => {
      const tier = partTier(u, part), err = partError(s, u, part), cost = partPrice(u, part), max = tier >= maxTierOf(u);
      const fx = max ? partLine(part, tier, u) : `${partLine(part, tier, u)} → ${partLine(part, tier + 1, u)}`;
      const btn = err === 'maxLevel' ? h('span', { class: 'hud-tag' }, T('hud.maxLevel'))
        : err === 'level' ? lockTag(T('hud.levelN', { level: PART_COST.tier3Level }))
        : actionButton({ label: T('hud.staff.upgrade'), icon: '⬆️', cost, tone: 'plain', disabled: err === 'coins', note: err === 'coins' ? needMore(cost - s.player.coins) : null,
          onClick: () => { const r = act('staff/upgradePart', { uid: u.uid, part }); if (r.ok) sfx('reward.levelup'); } });
      return h('div', { class: 'hud-sm-part' },
        h('span', { class: 'hud-sm-part-text' }, h('strong', null, `${ROBOT_PARTS[part].icon} ${T(`hud.staff.part.${part}`)} · ${STAFF[u.type].zone === 'farm' ? tier + 1 : tier}/${STAFF[u.type].zone === 'farm' ? 10 : maxTierOf(u)}`), h('small', null, fx), max ? null : paybackHint(s, u, { part }, err)), btn);
    });
    return section('hud.staff.parts', h('p', { class: 'hud-sub' }, T('hud.pf.partsNote')), h('p', { class: 'hud-sub' }, T('hud.staff.quality', { stars: '⭐' }), ' · ', T('hud.staff.noHard')), ...parts);
  }
  function partLine(part, tier, u) {
    const P = ROBOT_PARTS[part];
    if (part === 'battery') return T('hud.sm.part.battery', { v: P.minutes[tier] });
    if (part === 'motor') return T('hud.sm.part.motor', { v: Math.round(((STAFF[u.type].zone === 'farm' ? CREW.robotSpeed : P.speed)[tier] - 1) * 100) });
    if (part === 'cooler') return T('hud.sm.part.cooler', { v: Math.round((1 - (STAFF[u.type].zone === 'farm' ? CREW.robotCooler : P.heatMul)[tier]) * 100) });
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
        steps.push(T(`hud.staffJob.${u.type}`), T('hud.how.lowWorker')); // a trade: its one job, and only that job's habits
        if (u.type === 'picker') { steps.push(T('hud.how.farm1', { how: on('ripeFirst', 'hud.how.ripeFirst', 'hud.how.nearest') })); if (hasRule(u, 'twoPlots')) steps.push(T('hud.how.twoPlots')); }
        if (u.type === 'planter') steps.push(T('hud.how.farm2', { crop: on('playerCrop', 'hud.how.playerCrop', 'hud.how.bestCrop') }));
        steps.push(T('hud.how.farm5', { pause: on('quick', 'hud.how.quick', 'hud.how.slow') }));
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
  function hireFoot(s, err, def, cost, hire) {
    if (err === 'round') return lockTag(T('hud.roundN', { round: def.round }));
    if (err === 'level') return lockTag(T('hud.levelN', { level: def.level }));
    if (err === 'teamFull') return lockTag(T('hud.sm.teamFull', { max: zoneUnits(s, def.zone).length }));
    // Past STAFF_CAP.base the team grows one per level: the lock names the level that allows one more.
    if (err === 'hireLimit') return lockTag(T('hud.levelN', { level: nextHireLevel(s, def.zone) }));
    // Robot share (management-rules §2.1): robots ≤ half the slots, a robot never takes the last worker's place.
    if (err === 'robotShare') return lockTag(T('hud.sm.robotShare', { max: robotRoom(s, def.zone) + zoneUnits(s, def.zone).filter(x => STAFF[x.type].kind === 'robot').length }));
    if (freeHire(s)) return actionButton({ label: T('hud.hire'), icon: '🎟️', tone: 'gold', disabled: !region(s), onClick: hire });
    return actionButton({ label: T('hud.hire'), cost, disabled: err === 'coins' || !region(s), onClick: hire });
  }
  function hireView(s, now, zone) {
    const wait = poolRefreshIn(s, zone, now);
    // A free refresh is due: draw a new board (not a player action, so no toast when it cannot run).
    if (wait <= 0 && !refreshingPool && !ctx.isAuto?.()) {
      refreshingPool = true;
      queueMicrotask(() => { refreshingPool = false; store.dispatch('staff/refreshPool', { zone, roll: Math.random() }); });
    }
    // Every hire normally gets a working slot; the bench note only shows
    // when old saves (or a level drop) left more units than slots.
    const capped = hireCapReached(s, zone), full = freeSlots(s, zone) <= 0;
    // Only a limit is worth a banner; free slots need no sentence.
    const note = capped || full ? h('p', { class: 'hud-sm-note is-warn' }, capped
      ? (nextHireLevel(s, zone) ? T('hud.sm.hireCap', { n: zoneUnits(s, zone).length, max: hireCap(s, zone), level: nextHireLevel(s, zone) }) : T('hud.sm.hireMax', { n: zoneUnits(s, zone).length, max: hireCap(s, zone) }))
      : T('hud.sm.hireBench', { n: activeCount(s, zone), max: slots(s, zone), pct: Math.round(UPKEEP.benchRatio * 100), rpct: Math.round(UPKEEP.robotStandbyRatio * 100), min: UPKEEP.perMinutes })) : null;
    // One slim row per candidate: icon, who + what, one detail line, the hire button.
    const row = (icon, rare, title, sub, detail, foot, tip, type, extra = null) => h('li', { class: `hud-hire-row${rare ? ' is-rare' : ''}${type && needsWell(type) ? ' needs-well' : ''}`, dataset: type ? { art: type } : undefined, attrs: tip ? { title: tip } : undefined },
      h('span', { class: 'hud-hire-ico', attrs: { 'aria-hidden': 'true' } }, icon),
      h('div', { class: 'hud-hire-text' },
        h('p', { class: 'hud-hire-top' }, h('strong', null, title), sub ? h('span', null, sub) : null),
        extra,
        h('small', null, detail)),
      h('div', { class: 'hud-hire-act' }, foot));
    // A waterer / water robot fetches water at a well: with none built it would only stand there (QA 2026-11-09).
    const needsWell = type => /^water/.test(type) && !(region(s)?.buildings || []).some(b => b.type === 'well');
    const cards = h('ul', { class: 'hud-hire' });
    applicants(s, zone).forEach((a, index) => {
      const def = STAFF[a.type], tr = TRAITS[a.trait];
      // What you are buying, on the card: skills, temperament, a rare perk; then the job in one line.
      const extra = h('div', { class: 'hud-hire-facts' },
        h('div', { class: 'hud-hire-stats' }, ...STAT_ORDER.map(k => h('span', { attrs: { title: T(`hud.stat.${k}`) } }, STAT_ICON[k], String(a.stats?.[k] ?? 1)))),
        h('span', { class: 'hud-hire-trait' }, `${tr.icon} ${T(`staff.trait.${a.trait}`)}`),
        a.perk ? h('span', { class: 'hud-hire-perk' }, `${PERK_ICON[a.perk] || '⭐'} ${T(`hud.sm.perk.${a.perk}`)}`) : null);
      cards.append(row(def.icon, !!a.perk, a.name, T(`staff.${a.type}`), needsWell(a.type) ? T('hud.sm.needWell') : T(`hud.staffJob.${a.type}`),
        hireFoot(s, recruitError(s, zone, index), def, a.cost, () => act('staff/recruit', { zone, index })),
        `${T(`staff.trait.${a.trait}`)}. ${T(`hud.staffJob.${a.type}`)}. ${T(`staff.traitFx.${a.trait}.${zone}`)}`, a.type, extra));
    });
    const refresh = h('div', { class: 'hud-hire-refresh' },
      h('span', { class: 'hud-sub' }, T('hud.staff.newIn', { min: Math.max(1, Math.ceil(wait / 60000)) })),
      actionButton({ id: 'refreshApplicants', label: T('hud.staff.refresh'), icon: '🔄', tone: 'plain', cost: RECRUIT.refreshCost,
        disabled: s.player.coins < RECRUIT.refreshCost, onClick: () => act('staff/refreshPool', { zone, roll: Math.random(), paid: true }) }));
    const robots = h('ul', { class: 'hud-hire' });
    for (const type of STAFF_ORDER.filter(id => STAFF[id].zone === zone && STAFF[id].kind === 'robot')) {
      const def = STAFF[type], owned = zoneUnits(s, zone).filter(u => u.type === type).length;
      robots.append(row(def.icon, false, T(`staff.short.${type}`), owned ? T('hud.sm.owned', { n: owned }) : T('staff.tag.robot'), needsWell(type) ? T('hud.sm.needWell') : T(`hud.staffJob.${type}`),
        hireFoot(s, staffError(s, type), def, def.cost, () => act('staff/hire', { type })), undefined, type));
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
      tile(T('hud.rp.earned'), coinValue(Math.round(money.earned)), delta(money.earned, money.prev?.earned || 0)),
      tile(T('hud.rp.spent'), coinValue(Math.round(money.spent)), delta(money.spent, money.prev?.spent || 0)),
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
        h('span', { class: 'hud-sm-rank-name' }, nameOf(u), h('small', null, [r.k ? T('hud.rp.rowSub', { jobs: fmt(r.k.jobs), att: Math.round(r.k.att * 100) }) : T('hud.rp.noData')].filter(Boolean).join(' · '))),
        gradePill(r.grade) || h('span', { class: 'hud-pf-gpill' }, '—'),
        h('strong', { class: `hud-sm-rank-nums ${p < 0 ? 'is-bad' : 'is-good'}` }, signed(p))));
    }));
    const mvp = s.staff.mvp && unitOf(s, s.staff.mvp.uid) ? s.staff.mvp : null;
    const tips = tipsOf(s, now, zone, keys);
    const journal = teamJournal(s).filter(e => !e.uid || !unitOf(s, e.uid) || STAFF[unitOf(s, e.uid).type].zone === zone).map(e => h('li', { class: 'hud-sm-jrow' },
      h('span', { class: 'hud-sm-jico', attrs: { 'aria-hidden': 'true' } }, JOURNAL_ICON[e.type] || '•'),
      h('span', { class: 'hud-sm-jtext' }, journalText(s, e)),
      h('small', { class: 'hud-sm-jago' }, ago(now - (e.at || now)))));
    // Money stays open; the long lists are one tap away so the report fits a screen.
    return h('div', null, seg,
      section('hud.rp.sec.money', tiles, moneyNote, upkeepPer(s, zone) > 0 ? h('p', { class: 'hud-sub' }, T('hud.sm.upkeepLine', { coins: fmt(upkeepPer(s, zone)), min: UPKEEP.perMinutes })) : null),
      section('hud.rp.sec.spend', spendBody),
      gmOf(s) ? fold('rpManager', T('hud.sb.reportSec'), () => gmReportBody(s, now, zone, 30)) : null,
      fold('rpRank', T('hud.rp.sec.rank'), () => [ranked.length ? rank : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.noTeamShort')),
        h('p', { class: 'hud-sub' }, T(period === '10m' ? 'hud.rp.rankToday' : 'hud.rp.rankNote', { a: PROFILE.grade.cuts[0][1], b: PROFILE.grade.cuts[2][1], c: PROFILE.grade.cuts[3][1] }))]),
      fold('rpMore', T('hud.rp.more'), () => [researchSummary(s, now, zone),
        section('hud.sm.sec.mvp', h('p', { class: 'hud-line' }, mvp ? T('hud.sm.mvp', { name: mvp.name || nameOf(unitOf(s, mvp.uid)), coins: fmt(mvp.earned) }) : T('hud.sm.mvpNone', { min: BOOKS.mvpMinutes }))),
        section('hud.sm.sec.tips', h('ul', { class: 'hud-sm-tips' }, ...tips.map(t => h('li', null, t)))),
        section('hud.sm.sec.journal', journal.length ? h('ul', { class: 'hud-sm-journal' }, ...journal) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.sm.journalEmpty')))]));
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
      if (hot >= 1 && partTier(u, 'cooler') < maxTierOf(u)) { out.push(T('hud.sm.tip.cooler', { name: nameOf(u), n: hot })); break; }
      if (jam >= 2 && partTier(u, 'frame') < maxTierOf(u)) { out.push(T('hud.sm.tip.frame', { name: nameOf(u), n: jam })); break; }
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
  const fillsWidth = matchMedia('(max-width: 460px)'); // the modal's own max width (.hud-sm in v3.css): nothing of the world shows beside it
  const api = {
    el,
    get isOpen() { return st.open; },
    /** The full modal covers the world (open and not collapsed to the strip). */
    get covering() { return st.open && !st.collapsed; },
    /** Covering AND wide enough that the world cannot be seen at its sides (wider screens keep drawing the world around it). */
    get coversWorld() { return st.open && !st.collapsed && fillsWidth.matches; },
    get collapsed() { return st.open && st.collapsed; },
    /** Opens the modal (on a unit's Detail with `uid`, or a tab). */
    open({ uid = null, tab = null, autoReport = false } = {}) {
      const was = st.open;
      if (autoReport) st.folds.autoReport = true;
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
      st.sel.clear(); st.bulk = null; st.picking = false; st.drill = null; st.place.clear();
      clearInterval(timer); timer = null;
      pending = false;
      el.hidden = true;
      foot.replaceChildren();
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
