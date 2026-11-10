// Pure reducer for Farm & Café V3. `apply(state, action, ctx)` → { ok, state, events, error }.
// The input state is never mutated: a successful action returns a new state object. All timing comes from ctx.now,
// randomness from action payloads, so every transition is deterministic and testable (tests/core/*.test.mjs).
import { statCostOf } from './config/economy.js';
import { goofFee } from './config/economy.js';
import { funnyLevel, funnyFee, gmActionsOf, gmMoneyMul, gmHaggleMul, gmStatOf } from './config/economy.js';
import { waterSpeedupOf, trimBeansOf, premiumMulOf } from './config/economy.js';
import { CREW, doesJob, FARM_MANAGER, gmHandsPerRound, STAFF_CAP, stanceMode, stanceEffects, stanceTiltOf, CHECKUP, checkupGrade } from './config/economy.js';
import { TASKS, PENALTY, HISTORY, GM, gmCandidatesFor, gmSalary, gearDrain, GEAR, softwarePrice, gearTier, craftLevel, PROFILE, CAREER, robotSerial, profileOfUid, AUTO, autoPrice, BEANS, startCoins, xpForLevel, STAFF_BREAKS, staffFee, unitFee, RECRUIT, TRAITS, PART_COST, QUALITY, TEND, UPKEEP, SHIFT, VITALS, CARE, RARE, ROBOT_WEAR, ROBOT_PARTS, SKILL, STAT_ORDER, statOf, statCost, startStats, unitLevel, energyMax, heatPerMin, partTier, taskLimit, MISTAKES, RIVAL, BOOKS, BUILDINGS, CROPS, DRINKS, STAFF, XP, REBIRTH, START, EXPIRY_LEVEL, EXPIRY_ENABLED, levelForXp, MAX_LEVEL, levelGift, chestPrize, LOAN, loanOwed, INCOME, CLOCK, VENUES, VENUE_ITEMS, RATING, REVIEW_REASONS, LEAVE_REASONS, FIELD, GOODS, ITEM_GOODS, RECIPES, PERENNIAL } from './config/economy.js';
import { PARCELS, ROADS, FIXED, PRE_TILLED, plotById, plotsOf, estateOfLot, ESTATES, ESTATE_ORDER, farmLotsOf, ESTATE_FIELDS } from './config/layout.js';
import { parseRegionId } from './config/world.js';
import { menuItemsOf } from './config/menus.js';
import { clone, normalizeRegion, normalizeStreet, newGmState, newFmState, withEstates } from './state.js';
import { RESEARCH, INGREDIENTS, countryRecipes, SUPPLY, supplierOf, buyerOf, FARMLAB, methodEffect, methodKey } from './config/research.js';
import * as D from './derive.js';
import * as FM from './farm-manager.js';
import * as Q from './quests.js';
import * as W from './wallet.js';
import { WALLET } from './config/economy.js';

const TX_KEEP = 64;
// While the Level-10 expiration is pending, nothing that changes the economy may run.
const PAUSABLE = /^(farm|shop|build|land|prod|staff|rival|round|country|rebirth|level|loan|wallet)\//;

function fail(error, data) { return { ok: false, error, data }; }
// One game per region (founder rule, now core-enforced): a region already played as the other game refuses this game's
// actions. A region whose game is not picked yet (null) accepts both (tests, the combined economy sim).
const otherGame = (r, game) => !!r?.mode && r.mode !== game;
function sellGood(s, good, amount, ev) {
  if (otherGame(D.region(s), 'farm')) return fail('gameLocked');
  if (!own(GOODS, good)) return fail('unknown');
  const q = D.sellQuote(s, good, amount ?? Infinity);
  if (q.amount <= 0) return fail('noBeans');
  addGood(s, good, -q.amount, { order: D.BEAN_SELL_ORDER });
  earn(s, q.coins, ev);
  s.stats.sold = (s.stats.sold || 0) + q.amount;
  if (good === 'beans') ev.push({ type: 'beansSold', amount: q.amount, coins: q.coins });
  ev.push({ type: 'goodsSold', parts: [q], amount: q.amount, coins: q.coins });
}

// Sell some (or all) of ONE variety of beans: the player picks which variety and how many (founder 2026-11-08).
function sellVariety(s, { crop, amount }, ev) {
  if (otherGame(D.region(s), 'farm')) return fail('gameLocked');
  if (!own(CROPS, crop)) return fail('unknown');
  const have = Math.floor(D.beanMix(s)[crop] || 0), n = Math.max(0, Math.min(have, Math.floor(Number.isFinite(Number(amount)) ? Number(amount) : have)));
  if (n <= 0) return fail('noBeans');
  const coins = Math.round(n * D.beanPrice(crop) * (D.buyerNow(s).mul.beans ?? 1) * 100) / 100;
  addGood(s, 'beans', -n, { order: [crop] });
  earn(s, coins, ev);
  s.stats.sold = (s.stats.sold || 0) + n;
  ev.push({ type: 'beansSold', amount: n, coins });
  ev.push({ type: 'goodsSold', parts: [{ good: 'beans', amount: n, kinds: { [crop]: n }, coins }], amount: n, coins });
}

function grantXp(s, amount, events) {
  const before = levelForXp(s.player.xp);
  s.player.xp += Math.round(amount * D.xpMultiplier(s));
  const after = levelForXp(s.player.xp);
  if (after > before) { events.push({ type: 'levelUp', from: before, to: after }); if (s.world?.currentRegion && D.region(s)) autoTill(s, events); }
  if (EXPIRY_ENABLED && after >= EXPIRY_LEVEL && !s.story.level10Done && !s.story.expiry && s.world.currentRegion && s.story.phase === 'play') {
    s.story.expiry = { status: 'pending', regionId: s.world.currentRegion, at: 0 };
    s.story.phase = 'expiry';
    events.push({ type: 'expiryTriggered', regionId: s.world.currentRegion });
  }
}
// Who moves the coins of the action being applied (income series, management-rules §2.0): 'player' (your taps and
// decisions), 'staff' (a unit's own job, the team's running costs) or 'g1' (a job the GM ran, set by gmRun). Set by
// apply() for each action (synchronous, so a module variable is safe); NOW = ctx.now of that action.
let ACTOR = 'player';
let NOW = 0;
let CUR = null; // the draft being changed (note() writes history rows without a state argument)
let TYPE = ''; // the action being applied (which part of the farm a cost is booked under)
let BOOK_TO = null; // a city other than the one on screen that is being charged (onWallet)
const costGroup = t => (/^(staff|gm|rival)\//.test(t) ? 'staff' : /^(build|land|prod)\//.test(t) ? 'build' : /^(farm|farmlab)\//.test(t) ? 'farm' : /^shop\//.test(t) ? 'cafe' : /^world\//.test(t) ? 'expand' : 'other');
// Runs `fn` with another city's Gold in the register, so a cost of that city is paid from that city and booked to it.
function onWallet(s, regionId, fn) {
  if (!regionId || regionId === s.world.currentRegion || !s.world.ownedRegions.includes(regionId)) return fn();
  const here = s.player.coins, was = BOOK_TO;
  s.player.coins = W.goldOf(s, regionId); BOOK_TO = regionId;
  try { return fn(); } finally { s.wallet.gold[regionId] = s.player.coins; s.player.coins = here; BOOK_TO = was; }
}
const setLoansHere = (s, list) => { s.loans = list; };
const SYSTEM_ACTIONS = new Set(['clock/tick', 'loan/tick', 'rival/visit', 'rival/resolve', 'task/expire', 'gm/rivalVisit']);
const actorOf = (type, p) => (SYSTEM_ACTIONS.has(type) ? 'system' : type === 'gm/payroll' || type === 'staff/upkeep' ? 'staff'
  : /^(farm|shop)\//.test(type) && p?.uid != null ? 'staff' : type === 'staff/care' && p?.by != null ? 'staff' : 'player');
// The played minute's row of the income series (INCOME.keepMinutes kept).
function incomeRow(s) {
  const m = D.playedMinute(s);
  s.income ||= { rows: [] };
  let rows = s.income.rows, row = rows[rows.length - 1];
  if (!row || row.m !== m) {
    row = { m, earned: 0, spent: 0, by: {} };
    rows.push(row);
    if (rows.length > INCOME.keepMinutes) s.income.rows = rows.slice(-INCOME.keepMinutes);
  }
  return row;
}
function bookIncome(s, earned, spent) {
  if (!(earned > 0) && !(spent > 0)) return;
  W.bookDay(s, BOOK_TO || s.world.currentRegion, NOW, earned, spent, costGroup(TYPE));
  const row = incomeRow(s);
  if (earned > 0) row.earned = r2(row.earned + earned);
  if (spent > 0) row.spent = r2(row.spent + spent);
  row.by[ACTOR] = r2((row.by[ACTOR] || 0) + (earned || 0) - (spent || 0));
  const day = histDay(s, ACTOR);
  if (earned > 0) day.earned = r2(day.earned + earned);
  if (spent > 0) day.spent = r2(day.spent + spent);
}
// A coin spend (a cost): booked in the income series. Loan repayments and refunds do not go through here.
function spend(s, amount) {
  const before = s.player.coins;
  s.player.coins = Math.max(0, Math.round((s.player.coins - amount) * 100) / 100);
  bookIncome(s, 0, r2(before - s.player.coins));
}
// Coin income (booked in full in the income series). While loans are open, LOAN.autoRepay of it goes to them, oldest
// first; then wage arrears (s.debt.wages: the GM first, then the follower) are paid out of what is left.
function earn(s, amount, ev) {
  let left = amount;
  if (amount > 0) {
    const open = D.loansOf(s);
    let cut = r2(amount * LOAN.autoRepay);
    for (const ln of open) {
      if (cut <= 0) break;
      const c = Math.min(ln.owed, cut);
      ln.owed = r2(ln.owed - c); cut = r2(cut - c); left = r2(left - c);
    }
    if (open.length) {
      setLoansHere(s, open.filter(ln => ln.owed > 0));
      if (!D.loansOf(s).length) ev?.push({ type: 'loanRepaid' });
    }
  }
  bookIncome(s, amount, 0);
  s.player.coins = Math.round((s.player.coins + left) * 100) / 100;
  s.stats.earned += amount;
  if (left > 0) payArrears(s, left, ev);
}
// Wage arrears are paid first out of new coins (management-rules §2.6): the GM's, then the follower's, at most
// `budget` (the income that just came in, after the loan cut).
function payArrears(s, budget, ev) {
  const w = s.debt?.wages;
  if (!w || !(w.gm > 0 || w.follower > 0)) return;
  const was = ACTOR;
  ACTOR = 'staff';
  for (const k of ['gm', 'follower']) {
    const pay = Math.min(w[k] || 0, budget, Math.floor(s.player.coins * 100) / 100);
    if (!(pay > 0)) continue;
    spend(s, pay);
    budget = r2(budget - pay);
    w[k] = r2(w[k] - pay);
    if (k === 'gm' && s.gm?.unit) {
      ledger(s, NOW, 'spent', pay, 'wage', D.gmZone(s));
      const row = s.staff.ledger[s.staff.ledger.length - 1]; if (row) row.gm = r2((row.gm || 0) + pay);
      const day = gmDay(s, NOW); day.salary = r2(day.salary + pay);
    } else ledger(s, NOW, 'spent', pay, 'wage', null);
    ev?.push({ type: 'arrearsPaid', who: k, coins: pay, owed: w[k] });
  }
  ACTOR = was;
}
// A gift's items into the save (coins / beans / free-hire tickets / auto runs).
function grantItems(s, items) {
  for (const it of items) {
    if (it.kind === 'coins') s.player.coins = Math.round((s.player.coins + it.amount) * 100) / 100;
    else if (it.kind === 'beans') addBeans(s, 'robusta', it.amount);
    else if (ITEM_GOODS.includes(it.kind)) addGood(s, it.kind, it.amount);
    else if (it.kind === 'hireTicket') s.rewards.tickets += it.amount;
  }
}
const uid = (s, prefix) => `${prefix}${s.nextUid++}`;
const own = D.own;
// Goods in storage: beans stay in inventory.beans (the café brews from them), the farm's processed goods in items.
// Beans are stored per variety (inventory.beanMix, docs/design/coffee-varieties.md); inventory.beans stays the total.
// addBeans: + n of one variety. takeBeans: − n, cheapest variety first (`skipRaw`: never Arabica, for processing);
// `order` overrides the order (a sale takes the dearest first). Returns the beans taken per variety.
function addBeans(s, crop, n) {
  const m = D.beanMix(s), c = Object.hasOwn(CROPS, crop) ? crop : 'robusta';
  m[c] = Math.max(0, m[c] + Math.floor(n));
  s.inventory.beanMix = m;
  s.inventory.beans = Object.values(m).reduce((a, b) => a + b, 0);
}
function takeBeans(s, n, { skipRaw = false, order = D.BEAN_TAKE_ORDER } = {}) {
  const m = D.beanMix(s), took = {};
  let left = Math.floor(n);
  for (const c of order) { if (left <= 0) break; if (skipRaw && CROPS[c].rawOnly) continue; const k = Math.min(left, m[c]); if (k > 0) { m[c] -= k; took[c] = k; left -= k; } }
  s.inventory.beanMix = m;
  s.inventory.beans = Object.values(m).reduce((a, b) => a + b, 0);
  return took;
}
function addGood(s, good, n, opt) {
  if (good === 'beans') { if (n >= 0) { addBeans(s, 'robusta', n); return null; } return takeBeans(s, -n, opt); }
  s.inventory.items ||= {};
  s.inventory.items[good] = Math.max(0, (s.inventory.items[good] || 0) + n);
}
// Pre-tilled fields of a lot (6 per field lot, the classic plot spots and ids) that are not on the land yet.
// Supply bookkeeping (research step 2): a finished scout becomes a found supplier; late beans arrive when due.
function settleSupply(s, now, ev) {
  s.supply ||= { found: {}, contracts: {}, buyer: {}, scout: null, pending: [] };
  const sc = s.supply.scout;
  if (sc && now >= sc.until) {
    const f = ((s.supply.found ||= {})[sc.regionId] ||= {});
    f[sc.group] = (f[sc.group] || 0) + 1;
    s.supply.scout = null;
    ev?.push({ type: 'scoutDone', group: sc.group });
  }
  const due = (s.supply.pending || []).filter(p => now >= p.at);
  if (due.length) {
    s.supply.pending = s.supply.pending.filter(p => now < p.at);
    const n = due.reduce((a, p) => a + p.amount, 0);
    addBeans(s, 'robusta', n);
    ev?.push({ type: 'beansArrived', amount: n });
  }
}
// ---------- general manager helpers (docs/design/general-manager.md) ----------
// The manager's log rows (were s.gm.log, now history rows flagged gm: 1; D.gmLog is the old view). Who did it: you
// (approved / denied / hired / kept / calmed / apologised — about the manager), the rival (poached / refused), else him.
const GM_BY_PLAYER = new Set(['approved', 'denied', 'hired', 'kept', 'calmed', 'apologised', 'handed', 'takenBack']);
const GM_BY_SYSTEM = new Set(['poached', 'refused', 'expired', 'loanLate']);
function gmLog(s, now, type, extra, more = {}) {
  const actor = GM_BY_PLAYER.has(type) ? 'player' : GM_BY_SYSTEM.has(type) ? 'system' : 'g1';
  hist(s, { at: now, type, actor, subject: actor === 'g1' ? undefined : 'g1', extra, gm: 1, zone: D.gmZone(s), ...more });
}
function gmDay(s, now) {
  const d = D.dayKey(now), rows = (s.gm.days ||= []);
  let row = rows[rows.length - 1];
  if (!row || row.d !== d) { row = { d, actions: 0, salary: 0, spent: 0 }; rows.push(row); if (rows.length > GM.daysKeep) s.gm.days = rows.slice(-GM.daysKeep); }
  return row;
}
// Runs one plan item through its own action handler. Counts the coins it really cost (budget window unless approved),
// logs it, tags its events (byGm: the HUD keeps quiet about them). False when the action failed or changed nothing.
const GM_LOUD = new Set(['levelUp', 'expiryTriggered', 'regionExpired', 'loanRepaid']);
const BULK_ACTS = new Set(['staff/upgradeStat', 'staff/upgradePart', 'staff/buyGear', 'staff/buySoftware', 'staff/care', 'staff/setActive', 'staff/setTasks', 'staff/setTask', 'staff/assign', 'staff/fire', 'gm/fmPin']); // what one order of the staff board may run
// budget: 'care' (the care wallet, played window), true / 'budget' (the growth budget window), false (approved / full).
function gmRun(s, item, ctx, ev, { roll = 0.5, budget = true, approved = false, taskId = null } = {}) {
  const handler = handlers[item.act.type];
  if (!handler) return false;
  const before = s.player.coins, from = ev.length;
  const payload = { ...item.act.payload };
  if (item.act.type === 'staff/care' || item.act.type === 'staff/refreshPool' || item.act.type === 'shop/buyBeans') payload.roll = roll;
  // A hire request names its applicant: find them on today's board (the board is redrawn after every hire).
  if (item.act.type === 'staff/recruit' && payload.name) {
    payload.index = D.applicants(s, payload.zone).findIndex(a => a.name === payload.name);
    if (payload.index < 0) return false;
  }
  const was = ACTOR;
  ACTOR = 'g1'; // the coins this job moves are the GM's (its profit share is paid on them)
  let res;
  try { res = handler(s, payload, ev, ctx) || {}; } finally { ACTOR = was; }
  if (res.ok === false || res.noop) { ev.length = from; return false; }
  // Beans he sells (once you signed) fetch more the smarter he is.
  if (/^farm\/sell/.test(item.act.type) && s.gm.unit) { const gain = s.player.coins - before; if (gain > 0) earn(s, r2(gain * (gmMoneyMul(s.gm.unit) - 1)), ev); }
  // The more he does, the smarter he gets (Auto stays as good as it is).
  if (s.gm.unit && !s.gm.unit.isAuto) {
    const gm = s.gm.unit; gm.worked = (gm.worked | 0) + 1;
    if (gm.worked % GM.smartEveryJobs === 0 && gmStatOf(gm, 'smart') < GM.maxStat) { gm.stats = { ...Object.fromEntries(GM.stats.map(k => [k, gmStatOf(gm, k)])), smart: gmStatOf(gm, 'smart') + 1 }; ev.push({ type: 'gmSmarter', name: gm.name, to: gm.stats.smart }); }
  }
  // The GM's own jobs stay quiet in the HUD; jobs you approved or handed over speak as usual. Level-ups (and the
  // Level-10 incident) always show, whoever earned the XP.
  if (!approved) for (let i = from; i < ev.length; i++) if (!GM_LOUD.has(ev[i].type)) ev[i].byGm = true;
  const delta = r2(s.player.coins - before), cost = Math.max(0, -delta);
  const g = s.gm;
  if (budget === 'care' && cost > 0) {
    const P = D.playedMs(s);
    if (!g.careWin || P - g.careWin.startPlayed >= GM.careWallet.windowMin * 60000) g.careWin = { startPlayed: P, spent: 0 };
    g.careWin.spent = r2(g.careWin.spent + cost);
  } else if (budget && cost > 0) {
    if (!g.window || ctx.now - g.window.start >= GM.windowMinutes * 60000) g.window = { start: ctx.now, spent: 0 };
    g.window.spent = r2(g.window.spent + cost);
  }
  // done: a matching request still waiting in the inbox is no longer needed
  for (const t of D.gmRequests(s)) if (t.key === item.key && t.id !== taskId) closeTask(s, t, 'approved');
  g.lastJobAt = ctx.now; // a used manager is a happy manager (GM.mood)
  if (g.unit) {
    g.unit.loyalty = r2(Math.min(100, g.unit.loyalty + GM.mood.jobLoyalty));
    const b = (g.unit.book ||= { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: ctx.now });
    const gain = item.act.type === 'loan/take' ? 0 : delta; // borrowed coins are not the manager's earnings
    b.jobs++; b.spent = r2(b.spent + cost); if (gain > 0) b.earned = r2(b.earned + gain);
    const d = gmUnitDay(g.unit, ctx.now); d.jobs++; d.spent = r2(d.spent + cost); if (gain > 0) d.earned = r2(d.earned + gain);
  }
  const day = gmDay(s, ctx.now);
  day.actions++;
  day.spent = r2(day.spent + cost);
  histDay(s, 'g1').jobs++;
  gmLog(s, ctx.now, approved ? 'approved' : 'did', { key: item.key, reason: item.reason, cost, act: item.act.type }, { cost, ...(taskId ? { taskId } : {}), ...(item.zone ? { zone: item.zone } : {}), subject: approved ? 'g1' : item.act.payload?.uid });
  const at = item.act.payload || {}; // where he walks to in the world (realm/manager.js): a unit, a field, a lot or a building
  ev.push({ type: 'gmActed', key: item.key, reason: item.reason, cost, approved, uid: at.uid ?? null, plotId: at.plotId ?? null, parcelId: at.parcelId ?? null, act: item.act.type, zone: item.zone || at.zone || null });
  return true;
}
// The manager's own day rows (Unit interface, management-rules §1.1): jobs / earned / spent, PROFILE.daysKeep kept.
function gmUnitDay(gm, now) {
  const d = D.dayKey(now), rows = (gm.days ||= []);
  let row = rows[rows.length - 1];
  if (!row || row.d !== d) { row = { d, jobs: 0, earned: 0, spent: 0, mistakes: 0 }; rows.push(row); if (rows.length > PROFILE.daysKeep) gm.days = rows.slice(-PROFILE.daysKeep); }
  return row;
}
// Back after the game was closed (s.gm.payAt = the last minute the game ran, set by gm/payroll every minute): the
// manager kept the team going at GM.away.share of its running profit rate, for at most GM.away.capMinutes, and is
// paid its base for that time. Nothing in advisor mode, nothing when the rate was not positive.
function gmAwayPay(s, now, ev, closedFrom) {
  const gm = D.gmOf(s), A = GM.away;
  if (!gm || !s.gm.payAt) return;
  const awayMin = (now - closedFrom) / 60000;
  if (awayMin < A.minMinutes) return;
  const mins = Math.min(A.capMinutes, awayMin);
  const lastMin = Math.floor(s.gm.payAt / 60000), from = lastMin - A.rateWindowMin + 1;
  const rows = (s.staff.ledger || []).filter(e => e.min >= from && e.min <= lastMin);
  const played = new Set(rows.map(e => e.min)).size;
  const net = rows.reduce((n, e) => n + (e.earned || 0) - ((e.spent || 0) - (e.hire || 0) - (e.upgrade || 0) - (e.gm || 0)), 0);
  const rate = played >= 5 ? net / played : 0; // coins per minute of play, team only
  const share = A.share[s.gm.mode] || 0;
  const salary = r2(gmSalary(gm, s.gm.mode) * mins / GM.payMinutes);
  const earned = r2(Math.max(0, rate) * share * mins);
  s.gm.payAt = now; // the away time is settled here, never again by gm/payroll
  if (earned <= 0 && share <= 0) return;
  // Settled like gm/payroll (management-rules §2.6, §8 Q12): the team's takings come in as income (loan cut, arrears
  // first), the salary is paid as far as the coins allow, the rest becomes wage arrears (loyalty −unpaidPerMin per
  // unpaid minute, inside this return's PENALTY.returnLoyaltyCap; GM.quitArrearsSalaries salaries owed → he quits).
  const was = ACTOR;
  let paid = 0;
  ACTOR = 'staff';
  try {
    if (earned > 0) earn(s, earned, ev);
    paid = Math.min(salary, Math.floor(s.player.coins * 100) / 100);
    if (paid > 0) {
      spend(s, paid);
      ledger(s, now, 'spent', paid, 'wage', D.gmZone(s));
      const row = s.staff.ledger[s.staff.ledger.length - 1]; if (row) row.gm = r2((row.gm || 0) + paid);
    }
  } finally { ACTOR = was; }
  const net2 = r2(earned - salary), short = r2(salary - paid);
  const day = gmDay(s, now); day.salary = r2(day.salary + paid);
  gmLog(s, now, 'away', { min: Math.round(mins), earned, salary });
  if (s.gm.fm) { const r = D.region(s), ps = D.ownedPlots(s); s.gm.fm.away = { at: now, minutes: Math.round(mins), awayMinutes: Math.round(awayMin), earned, salary, net: net2, ripe: r ? ps.filter(p => r.plots[p.id] && D.plotState(s, p.id, now).stage === 'ready').length : 0, empty: r ? ps.filter(p => !r.plots[p.id]).length : 0, orders: (s.gm.orders || []).length }; }
  ev.push({ type: 'gmAway', name: gm.name, minutes: Math.round(mins), awayMinutes: Math.round(awayMin), earned, salary, net: net2 });
  if (short <= 0) return;
  const w = ((s.debt ||= { wages: { gm: 0, follower: 0 } }).wages ||= { gm: 0, follower: 0 });
  w.gm = r2((w.gm || 0) + short);
  let loss = GM.loyalty.unpaidPerMin * mins * (salary > 0 ? short / salary : 0);
  const rc = s.gm.returnCap;
  if (rc) { loss = Math.max(0, Math.min(loss, PENALTY.returnLoyaltyCap - rc.lost)); rc.lost = r2(rc.lost + loss); }
  gm.loyalty = r2(Math.max(0, gm.loyalty - loss));
  gmLog(s, now, 'unpaid', { coins: short, owed: w.gm });
  ev.push({ type: 'gmUnpaid', coins: short, owed: w.gm, name: gm.name });
  if (w.gm >= D.gmQuitArrears(s)) gmLeave(s, now, 'quit', ev);
}
// Back after the game was not running for TASKS.returnAwayMin or more (management-rules §4.1, §8 Q10): every open task
// gets at least TASKS.graceMin more played minutes and one grouped "N việc chờ" event; with a manager, the loyalty he
// loses on this return (the away drop, an unpaid away salary and the expiries of those grace minutes) is capped at
// PENALTY.returnLoyaltyCap (s.gm.returnCap). Once per return: the first clock/tick after the gap (no manager needed),
// or gm/seen / gm/payroll when they come first — the played clock has not moved in between, so the grace is the same.
function returnGrace(s, ev) {
  const P = D.playedMs(s), grace = P + TASKS.graceMin * 60000, rc = s.gm?.returnCap;
  if (rc && P <= rc.untilPlayed) return false; // this return is already open
  for (const t of D.tasksOpen(s)) if (t.untilPlayed < grace) t.untilPlayed = grace;
  if (s.gm?.unit) s.gm.returnCap = { untilPlayed: grace, lost: 0 };
  const n = D.tasksOpen(s).length;
  if (n) ev.push({ type: 'tasksWaiting', n, name: s.gm?.unit?.name || null });
  return true;
}
// The manager's side of a return (gm/seen on your first touch, or gm/payroll when it runs first): the grace above,
// what he kept going meanwhile (gmAwayPay), and after GM.mood.awayGraceHours the loyalty drop per hour (inside the
// return cap); below the refuse line the rival is already at the door. False when it was no return.
function gmBack(s, ev, now) {
  if (!D.gmOf(s)) return false;
  const closedFrom = Math.max(s.gm.payAt || 0, s.gm.seenAt || 0) || now;
  if (now - closedFrom < TASKS.returnAwayMin * 60000) return false;
  returnGrace(s, ev);
  gmAwayPay(s, now, ev, closedFrom);
  if (s.gm.payAt) s.gm.payAt = now; // the away time is settled, never again by gm/payroll
  return true;
}
// Auto's stand-in manager (AUTO in economy.js): the brain of a hired one (gm/think) with no salary, no rival and no growth.
// He is in s.gm.unit only while a run is on, so every manager rule, order and report works unchanged. `tally` = a paused run's numbers.
function autoManagerOn(s, now, tally = null) {
  const g = s.gm, stars = AUTO.managerStars;
  g.unit = { uid: 'g1', kind: 'manager', isAuto: true, name: 'Auto', gender: 'female', skill: stars, stats: Object.fromEntries(GM.stats.map(k => [k, stars])), worked: 0, style: 'balanced', loyalty: 100, raises: 0, hiredAt: now, paid: 0,
    tenurePlayedMin: 0, backlog: 0, book: { jobs: tally?.jobs || 0, earned: tally?.earned || 0, spent: tally?.spent || 0, mistakes: 0, since: now }, days: [], recent: [] };
  Object.assign(g, D.gmDefaultLimits(s));
  g.mode = GM.defaults.mode;
  g.fm = { ...(g.fm || newFmState()), auto: true, stance: FARM_MANAGER.stance.start, mode: 'balanced', ask: false, minReserve: 0, spendLimit: 0, build: true, land: true, hire: true, autoSell: true, plan: null }; // no settings: left alone, it decides like a manager on default
  g.handed = { ...g.handed, farm: false }; // the player's own picks stay; they are not handing the team over for good
  Object.assign(g, { payAt: 0, seenAt: now, lastJobAt: now, window: { start: now, spent: 0 }, careWin: null, orders: [], plan: null });
}
/** The stand-in leaves with the run; what he bought stays, orders nobody started go. The run's numbers (or null). */
function autoManagerOff(s, now) {
  const g = s.gm, u = g.unit;
  if (!u?.isAuto) return null;
  tombstone(s, 'g1', u.name, 'manager', now); // the journal keeps saying "Auto" for what it did
  Object.assign(g, { unit: null, orders: [], plan: null, ticks: {}, busy: null });
  delete g.returnCap;
  return { jobs: u.book.jobs | 0, earned: Math.round(u.book.earned), spent: Math.round(u.book.spent) };
}
// The GM leaves (fired, or quits over unpaid salary): the team simply goes on without him.
function gmLeave(s, now, why, ev) {
  const name = s.gm.unit?.name || null;
  gmLog(s, now, 'left', { name, why });
  tombstone(s, 'g1', name, 'manager', now);
  s.gm.unit = null;
  // his requests and a rival's offer for him leave with him (cancelled, never penalised)
  for (const t of D.tasksOpen(s).filter(x => x.by === 'g1' || x.kind === 'gmPoach')) closeTask(s, t, 'cancelled');
  for (const t of D.tasksDone(s)) if (t.by === 'g1') t.lateOff = true; // nor approved late once he is gone
  delete s.gm.returnCap;
  if (s.debt?.wages) s.debt.wages.gm = 0; // unpaid salary leaves with the manager
  delete s.gm.orders;
  ev.push({ type: 'gmLeft', name, why });
  // The replacement you picked while he was being lured starts at once.
  if (why === 'poached' && Number.isInteger(s.gm.reserve)) { const index = s.gm.reserve; delete s.gm.reserve; handlers['gm/hire'](s, { index }, ev, { now }); }
}
// A rival's offer to the manager: an inbox task (kind gmPoach, TASKS.life.gmPoach played minutes). Keep him for a bonus,
// or let him go; meanwhile you can pick who replaces him.
function gmPoachStart(s, gm, ev) {
  const fee = gmSalary(gm, s.gm.mode) * GM.keepBonusSalaries;
  const t = fileTask(s, ev, { kind: 'gmPoach', key: 'keep:g1', by: 'system', act: { type: 'gm/keep', payload: {} }, cost: fee, reason: ['gmPoach', { name: gm.name, rival: GM.poach.rival }], zone: D.gmZone(s) });
  if (!t) return false;
  gmLog(s, NOW, 'poached', { rival: GM.poach.rival }, { taskId: t.id });
  ev.push({ type: 'gmPoach', name: gm.name, rival: GM.poach.rival, fee, id: t.id, seconds: TASKS.life.gmPoach * 60 });
  return true;
}


// ---------- planner v2 helpers (management-rules §3.4–§3.7) ----------
// Land use, sampled once per played minute into s.gm.util.rows (GM.land.windowMin kept): the zone's and every lot's
// busy share, and which production queues are full. True when a sample was added.
// The manager's view of how much work waits per zone (an EMA of taskQueue, GM.load): throughputShare reads it, so
// speed / gear / motor are only worth buying where jobs really pile up (balance pass 2026-11-08).
function sampleLoad(s, now) {
  const g = s.gm, L = GM.load, { on, off } = D.gmScope(s);
  const load = { ...(g.load || {}) };
  for (const zone of [on, ...off].filter(Boolean)) {
    const total = D.actionableJobs(s, zone, now);
    const prev = load[zone];
    load[zone] = Math.round((prev == null ? total : prev * (1 - L.ema) + total * L.ema) * 100) / 100;
  }
  if (JSON.stringify(load) === JSON.stringify(g.load || {})) return false;
  g.load = load;
  return true;
}
function sampleUtil(s) {
  const m = D.playedMinute(s), u = (s.gm.util ||= { rows: [] });
  u.rows ||= [];
  if (u.rows.length && u.rows[u.rows.length - 1].m === m) return false;
  u.rows = [...u.rows, { m, ...D.utilSample(s) }].slice(-GM.land.windowMin);
  return true;
}
// Today's real-money top-up bookkeeping (§3.7): { d, denied (loan tasks you denied today), filed }.
function topUpOf(s) {
  const d = D.dayKey(NOW);
  if (s.gm.topUp?.d !== d) s.gm.topUp = { d, denied: 0, filed: 0 };
  return s.gm.topUp;
}
// A licence the manager lacked for a candidate (§3.7 self-upgrade): counted at most once per played minute per group,
// today only. Returns true when a count moved.
function wishLicence(s, groups, now) {
  const d = D.dayKey(now), m = D.playedMinute(s);
  if (s.gm.wish?.d !== d) s.gm.wish = { d, n: {}, m: {} };
  const w = s.gm.wish;
  let moved = false;
  for (const grp of groups) {
    if (!GM.licences.groups.includes(grp) || w.m[grp] === m) continue;
    w.m[grp] = m; w.n[grp] = (w.n[grp] || 0) + 1; moved = true;
  }
  return moved;
}
// The day plan (Kế hoạch ngày, §3.4): per farm lot the crop to plant (hysteresis: a lot with something growing keeps
// its crop), every worker's jobs by need × fit, every robot's task by need, and the target for the next 20 minutes.
// Runs silently: the player sees the result, not a plan (the assignments' own setTasks / robotTask rows are written as the manager's).
function planDay(s, ev, ctx) {
  const g = s.gm, r = D.region(s), P = D.playedMs(s);
  if (!g?.unit || !r) return;
  const { on, off } = D.gmScope(s), zones = [on, ...off].filter(Boolean);
  const prev = g.plan?.crops || {}, crops = {};
  const crop = D.chooseCrop(s);
  if (zones.includes('farm') && crop) {
    const byLot = {};
    for (const p of D.ownedPlots(s)) if (p.parcel) (byLot[p.parcel] ||= []).push(p.id);
    // Each lot gets the best crop for its growing zone (coffee-varieties.md): a crop the zone penalises is never kept.
    for (const [lot, ids] of Object.entries(byLot)) {
      const best = D.bestCropFor(s, ids[0]) || crop, zone = D.climateOfPlot(s, ids[0]), fits = c => D.climateFit(c, zone) !== 'bad';
      const growing = ids.map(id => r.plots[id]?.crop).filter(Boolean);
      if (!growing.length) { crops[lot] = best; continue; }
      const most = Object.entries(growing.reduce((n, c) => ({ ...n, [c]: (n[c] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      crops[lot] = prev[lot] && D.cropUnlocked(s, prev[lot]) && fits(prev[lot]) ? prev[lot] : fits(most) ? most : best;
    }
  }
  const was = ACTOR;
  ACTOR = 'g1';
  const assignments = {};
  try {
    for (const zone of zones) {
      const plan = D.planTasks(s, zone, ctx.now);
      for (const [id, tasks] of Object.entries(plan.workers)) { const from = ev.length; handlers['staff/setTasks'](s, { uid: id, tasks }, ev, ctx); for (let i = from; i < ev.length; i++) ev[i].byGm = true; assignments[id] = tasks; }
      for (const [id, task] of Object.entries(plan.robots)) { const from = ev.length; handlers['staff/setTask'](s, { uid: id, task }, ev, ctx); for (let i = from; i < ev.length; i++) ev[i].byGm = true; assignments[id] = task; }
    }
  } finally { ACTOR = was; }
  const R = GM.plan.targetRound, target = Math.round(D.I10(s) * 2 * GM.plan.targetMul / R) * R;
  g.plan = { atPlayed: P, crops, target };
  // a real-money proposal lives until the next day plan at most (TASKS.life.topUp): withdrawn quietly, never counted
  // or shown as a task that ran out (§3.7, §8 Q2)
  for (const t of D.tasksOpen(s).filter(x => x.kind === 'topUp')) { closeTask(s, t, 'cancelled'); cool(s, t.key, 'expired'); }
  const fields = D.ownedPlots(s).length || 1, share = {};
  for (const p of D.ownedPlots(s)) if (crops[p.parcel]) share[crops[p.parcel]] = (share[crops[p.parcel]] || 0) + 1;
  const mix = Object.entries(share).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ crop: c, pct: Math.round(n / fields * 100) }));
  ev.push({ type: 'gmDayPlan', name: g.unit.name, mix, target });
}

// ---------- history — Nhật ký (management-rules §1.3 / §5) ----------
// One write path for every row: the shared ring (HISTORY.rows), and the own ring (HISTORY.perUnit) of each unit the
// row is by or about (the manager's is s.gm.unit.recent). row: { type, actor?, subject?, group?, zone?, at?, cost?,
// gain?, taskId?, extra?, name?, gm? }. at = real time (ctx.now), atPlayed = the played clock.
function histOf(s) {
  const h = (s.history ||= { rows: [], days: [], tombstones: [], seq: 0 });
  h.rows ||= []; h.days ||= []; h.tombstones ||= []; h.seq ||= 0;
  return h;
}
const unitByUid = (s, id) => (id === 'g1' ? s.gm?.unit || null : id ? D.unitOf(s, id) : null);
function hist(s, row) {
  const h = histOf(s);
  const r = { id: `h${++h.seq}`, atPlayed: D.playedMs(s), at: row.at ?? NOW, actor: row.actor || 'system', group: row.group || D.histGroupOf(row.type), type: row.type,
    zone: row.zone ?? null, regionId: s.world.currentRegion || null };
  for (const k of ['subject', 'cost', 'gain', 'taskId', 'extra', 'name', 'gm']) if (row[k] !== undefined && row[k] !== null) r[k] = row[k];
  h.rows.push(r);
  if (h.rows.length > HISTORY.rows) h.rows = h.rows.slice(-HISTORY.rows);
  // job rows («thu hoạch ×12») stay in the shared ring only: one a minute would push a unit's own events out of its 30
  if (r.type !== 'work') for (const id of new Set([r.actor, r.subject])) {
    const u = unitByUid(s, id);
    if (!u) continue;
    u.recent = [...(u.recent || []), ('extra' in r ? { ...r, extra: r.extra && typeof r.extra === 'object' ? { ...r.extra } : r.extra } : { ...r })].slice(-HISTORY.perUnit);
  }
  return r;
}
// Per-day numbers per actor ('player' | 'g1' | 'staff' | 'penalty' | 'system'), HISTORY.days distinct days kept.
function histDay(s, actor) {
  const h = histOf(s), d = D.dayKey(NOW);
  let row = null;
  for (let i = h.days.length - 1; i >= 0 && h.days[i].d === d; i--) if (h.days[i].actor === actor) { row = h.days[i]; break; }
  if (!row) {
    row = { d, actor, jobs: 0, earned: 0, spent: 0, mistakes: 0, tasksDone: 0, tasksExpired: 0 };
    h.days.push(row);
    const keep = [...new Set(h.days.map(x => x.d))].slice(-HISTORY.days);
    if (keep.length && h.days[0].d < keep[0]) h.days = h.days.filter(x => x.d >= keep[0]);
  }
  return row;
}
// A unit (or the manager, uid 'g1') left: its name stays readable in the history.
function tombstone(s, id, name, kind, now) {
  const h = histOf(s);
  h.tombstones = [...h.tombstones.filter(x => x.uid !== id), { uid: id, name: name || null, kind, leftAt: now }].slice(-HISTORY.tombstones);
}

// ---------- inbox — Việc cần duyệt (management-rules §1.2 / §4) ----------
// s.tasks { open ≤ TASKS.cap (oldest first), done ≤ TASKS.doneKeep (newest first), cool { key: until played ms },
// fines [{ p: played ms, c: coins }] of the last PENALTY.windowMin, pen { d, loyalty, morale { zone } } today's penalty
// totals for the day caps }.
function tasksOf(s) {
  const t = (s.tasks ||= { open: [], done: [], cool: {}, fines: [], pen: { d: 0, loyalty: 0, morale: {} } });
  t.open ||= []; t.done ||= []; t.cool ||= {}; t.fines ||= []; t.pen ||= { d: 0, loyalty: 0, morale: {} };
  return t;
}
function penDay(s) {
  const t = tasksOf(s), d = D.dayKey(NOW);
  if (t.pen.d !== d) t.pen = { d, loyalty: 0, morale: {} };
  return t.pen;
}
// A key the manager leaves alone for PENALTY.cooldownMin[why] played minutes (or `minutes` when given).
function cool(s, key, why, minutes = null) {
  if (!key) return;
  const t = tasksOf(s), P = D.playedMs(s);
  for (const [k, until] of Object.entries(t.cool)) if (until <= P) delete t.cool[k];
  t.cool[key] = Math.max(t.cool[key] || 0, P + (minutes ?? PENALTY.cooldownMin[why] ?? 0) * 60000);
}
// Files a task (null when the inbox is full). by: 'g1' (the manager's request) | 'system' (a rival's visit).
function fileTask(s, ev, { kind, key, by = 'g1', act, cost = 0, value = 0, reason, zone = null }) {
  const T = tasksOf(s);
  if (T.open.length >= TASKS.cap) return null;
  const P = D.playedMs(s), life = (TASKS.life[kind] || TASKS.life.staffGrowth) * 60000;
  const t = { id: `t${s.nextUid++}`, kind, key, group: TASKS.groupOf[kind] || 'hr', by, act, cost: Math.max(0, Math.round(cost || 0)), value, reason, zone,
    atPlayed: P, untilPlayed: P + life, remindedAt: [P], status: 'open', regionId: s.world.currentRegion || null };
  T.open.push(t);
  hist(s, { type: 'taskFiled', actor: by, subject: by === 'g1' ? act?.payload?.uid : act?.payload?.uid || (kind === 'gmPoach' ? 'g1' : undefined), taskId: t.id, cost: t.cost || undefined, zone,
    extra: { kind, key, reason } });
  ev.push({ type: 'taskFiled', id: t.id, kind, by, reason, cost: t.cost, minutes: life / 60000 });
  return t;
}
// Moves a task to done with its answer (status approved | denied | expired | failed | late | cancelled).
function closeTask(s, t, status) {
  const T = tasksOf(s);
  T.open = T.open.filter(x => x.id !== t.id);
  t.status = status;
  t.answeredAtPlayed = D.playedMs(s);
  T.done = [t, ...T.done.filter(x => x.id !== t.id)].slice(0, TASKS.doneKeep);
}
// After any answer / expiry: Chờ lệnh ends below the line, a strike ends once none of his tasks is left open.
function settleGm(s, ev) {
  const gm = s.gm?.unit;
  if (!gm) return;
  if (gm.waiting && (gm.backlog || 0) < PENALTY.backlog.waitAt) { delete gm.waiting; ev.push({ type: 'gmWaitingOver', name: gm.name }); }
  if (gm.strike && !D.gmRequests(s).length) { delete gm.strike; gmLog(s, NOW, 'strikeOver', {}); ev.push({ type: 'gmStrikeOver', name: gm.name }); }
}
// A task ran out (management-rules §4.3). A rival's visit: its outcome (the worker / the manager leaves). A manager
// task: loyalty → throttle (backlog: Chờ lệnh / poachable / strike) → a capped coin fine (never below 0) → the zone's
// morale. Top-ups and system tasks are never penalised.
function expireTask(s, t, ev) {
  if (!D.tasksOpen(s).some(x => x.id === t.id)) return;
  closeTask(s, t, 'expired');
  cool(s, t.key, 'expired');
  hist(s, { type: 'taskExpired', actor: 'system', subject: t.by === 'g1' ? 'g1' : t.act?.payload?.uid || (t.kind === 'gmPoach' ? 'g1' : undefined), taskId: t.id, zone: t.zone,
    extra: { kind: t.kind, key: t.key, reason: t.reason } });
  if (t.kind === 'poach') {
    const unit = D.unitOf(s, t.act.payload.uid);
    if (unit) removeUnit(s, unit, NOW, 'poached', ev);
    return;
  }
  if (t.kind === 'gmPoach') { if (s.gm?.unit) gmLeave(s, NOW, 'poached', ev); return; }
  const gm = s.gm?.unit, free = TASKS.noPenaltyKinds.includes(t.kind); // a top-up never counts as a failed duty
  if (t.by === 'g1' && !free) histDay(s, 'g1').tasksExpired++;
  if (free || t.by !== 'g1' || !gm) { ev.push({ type: 'taskExpired', id: t.id, kind: t.kind, reason: t.reason, fine: 0 }); return; }
  const pen = penDay(s), P = D.playedMs(s), B = PENALTY.backlog;
  // 1. loyalty (≤ loyaltyDay a day; on a return, together with the away drop ≤ returnLoyaltyCap)
  let loss = Math.max(0, Math.min(PENALTY.loyalty, PENALTY.loyaltyDay - pen.loyalty));
  const rc = s.gm.returnCap; // a task due inside the return's grace (it was moved to exactly rc.untilPlayed)
  if (rc && t.untilPlayed <= rc.untilPlayed) { loss = Math.max(0, Math.min(loss, PENALTY.returnLoyaltyCap - rc.lost)); rc.lost = r2(rc.lost + loss); }
  pen.loyalty = r2(pen.loyalty + loss);
  gm.loyalty = r2(Math.max(0, gm.loyalty - loss));
  // 2. throttle
  gm.backlog = (gm.backlog || 0) + 1;
  gm.decayMs = 0; // the −1 / 10 min decay counts from the last rise (management-rules §4.3 / §4.4: 64 → 1, 70 → 2, 74 → 3)
  if (gm.backlog >= B.waitAt && !D.gmWaiting(s)) {
    gm.waiting = { untilPlayed: P + B.waitMin * 60000 };
    gmLog(s, NOW, 'waiting', { backlog: gm.backlog });
    ev.push({ type: 'gmWaiting', name: gm.name, backlog: gm.backlog });
  }
  if (gm.backlog >= B.strikeAt && !gm.strike) {
    gm.strike = { sincePlayed: P, since: NOW };
    gmLog(s, NOW, 'strike', { backlog: gm.backlog });
    ev.push({ type: 'gmStrike', name: gm.name });
  }
  // 3. coins, last and capped
  const fine = D.taskFine(s);
  if (fine > 0) {
    const was = ACTOR; ACTOR = 'penalty';
    try { spend(s, fine); } finally { ACTOR = was; }
    const T = tasksOf(s);
    T.fines = [...T.fines.filter(f => f.p > P - PENALTY.windowMin * 60000), { p: P, c: fine }];
    t.fine = fine;
    hist(s, { type: 'fine', actor: 'system', subject: 'g1', taskId: t.id, cost: fine, zone: t.zone });
  }
  // 4. the imbalance you can see: the zone's spirits
  const moraleDrop = moraleHit(s, t.zone, PENALTY.morale);
  ev.push({ type: 'taskExpired', id: t.id, kind: t.kind, reason: t.reason, fine, loyalty: loss, backlog: gm.backlog, morale: moraleDrop, name: gm.name });
}
// Morale lost by every worker of a zone from the penalty layer, ≤ PENALTY.moraleZoneDay per zone a day. Returns the drop.
function moraleHit(s, zone, amount) {
  if (zone !== 'farm' && zone !== 'shop') return 0;
  const pen = penDay(s);
  const drop = r2(Math.max(0, Math.min(amount, PENALTY.moraleZoneDay - (pen.morale[zone] || 0))));
  if (drop <= 0) return 0;
  pen.morale[zone] = r2((pen.morale[zone] || 0) + drop);
  for (const u of D.assignedUnits(s, s.world.currentRegion, zone)) if (STAFF[u.type].kind === 'worker') u.morale = r2(clampN((u.morale ?? VITALS.start.morale) - drop, 0, 100));
  return drop;
}
// Every open task whose time is up, oldest deadline first. Returns how many ran out.
function expireDue(s, ev) {
  const P = D.playedMs(s);
  const due = D.tasksOpen(s).filter(t => t.untilPlayed <= P).sort((a, b) => a.untilPlayed - b.untilPlayed);
  for (const t of due) expireTask(s, t, ev);
  if (due.length) settleGm(s, ev);
  return due.length;
}
// Reminders (toast + badge) at TASKS.remindHalf of a task's life and TASKS.remindLastMin before its end.
function remindDue(s, ev) {
  const P = D.playedMs(s);
  for (const t of D.tasksOpen(s)) {
    const pts = [t.atPlayed + TASKS.remindHalf * (t.untilPlayed - t.atPlayed)];
    const last = TASKS.remindLastMin[t.kind];
    if (last) pts.push(t.untilPlayed - last * 60000);
    pts.sort((a, b) => a - b);
    const i = (t.remindedAt?.length || 1) - 1;
    if (i < pts.length && P >= pts[i]) {
      t.remindedAt = [...(t.remindedAt || [t.atPlayed]), P];
      ev.push({ type: 'taskRemind', id: t.id, kind: t.kind, by: t.by, reason: t.reason, leftMs: t.untilPlayed - P, last: i === pts.length - 1 && !!last });
    }
  }
}
// A "yes" to a task (task/approve, task/late). poach: keep the worker (its fee); gmPoach: keep the manager (how:
// 'bonus' fee | 'raise'); a manager request: its job runs now (not in his budget) — or 'failed' without the coins.
function answerYes(s, t, { how = 'bonus', roll = 0.5, late = false }, ev, ctx) {
  if (t.kind === 'poach') {
    const unit = D.unitOf(s, t.act.payload.uid);
    if (!unit) { closeTask(s, t, 'cancelled'); return; }
    if (s.player.coins < t.cost) return fail('coins', { missing: t.cost - s.player.coins });
    spend(s, t.cost);
    unitSpent(s, unit, t.cost, ctx.now);
    unit.morale = r2(Math.min(100, (unit.morale ?? VITALS.start.morale) + RIVAL.keepMorale));
    closeTask(s, t, 'approved');
    journal(s, ctx.now, 'kept', unit);
    ev.push({ type: 'poachKept', uid: unit.uid, fee: t.cost });
    return;
  }
  if (t.kind === 'gmPoach') {
    const gm = D.gmOf(s);
    if (!gm) { closeTask(s, t, 'cancelled'); return; }
    if (how === 'raise') { gm.raises = (gm.raises || 0) + 1; gm.loyalty = Math.min(100, gm.loyalty + GM.raiseLoyalty); }
    else {
      if (s.player.coins < t.cost) return fail('coins', { missing: t.cost - s.player.coins });
      spend(s, t.cost);
      ledger(s, ctx.now, 'spent', t.cost, 'wage', D.gmZone(s));
      gm.loyalty = Math.min(100, gm.loyalty + GM.keepLoyalty);
    }
    closeTask(s, t, 'approved');
    gmLog(s, ctx.now, 'kept', { how }, { taskId: t.id });
    ev.push({ type: 'gmKept', how, name: gm.name });
    return;
  }
  const gm = s.gm?.unit;
  const ok = s.player.coins >= t.cost && gmRun(s, { key: t.key, act: t.act, cost: t.cost, reason: t.reason }, ctx, ev, { roll, budget: false, approved: true, taskId: t.id });
  if (late) { t.status = ok ? 'late' : 'failed'; t.answeredAtPlayed = D.playedMs(s); } else closeTask(s, t, ok ? 'approved' : 'failed');
  if (ok) { if (late) delete tasksOf(s).cool[t.key]; else cool(s, t.key, 'done'); }
  if (ok) { if (GM.land.coolActs.includes(t.act?.type)) cool(s, 'land', null, D.landEveryMin(s)); } // ≤ 1 land proposal per everyMin, from the deal too
  else {
    cool(s, t.key, 'failed'); // re-filed after the cooldown
    gmLog(s, ctx.now, 'failed', { key: t.key, reason: t.reason }, { taskId: t.id });
    ev.push({ type: 'gmFailed', reason: t.reason });
  }
  if (gm) {
    gm.loyalty = r2(Math.min(100, gm.loyalty + (late ? PENALTY.lateLoyalty : GM.mood.approveLoyalty))); // the boss listened
    gm.backlog = Math.max(0, (gm.backlog || 0) - 1);
    delete gm.waiting; // any answer wakes him up
  }
  if (t.by === 'g1') histDay(s, 'g1').tasksDone++;
  if (late) hist(s, { type: 'taskLate', actor: 'player', subject: 'g1', taskId: t.id, zone: t.zone, extra: { kind: t.kind, key: t.key, reason: t.reason } });
  settleGm(s, ev);
  ev.push({ type: 'taskAnswered', id: t.id, kind: t.kind, answer: late ? 'late' : 'approved', ok });
}
// A "no": poach → the worker goes (RIVAL.letGoRefund of its price back); gmPoach → the manager goes (chaos); a manager
// request → loyalty denyLoyalty, the key waits PENALTY.cooldownMin.denied, backlog −1 (never a fine).
function answerNo(s, t, ev, ctx) {
  if (t.kind === 'poach') {
    closeTask(s, t, 'denied');
    const unit = D.unitOf(s, t.act.payload.uid);
    if (!unit) return;
    const refund = Math.round(RIVAL.letGoRefund * (unit.paid || 0));
    if (refund > 0) s.player.coins = r2(s.player.coins + refund);
    removeUnit(s, unit, ctx.now, 'letGo', ev, { refund });
    return;
  }
  if (t.kind === 'gmPoach') { closeTask(s, t, 'denied'); if (s.gm?.unit) gmLeave(s, ctx.now, 'poached', ev); return; }
  closeTask(s, t, 'denied');
  cool(s, t.key, 'denied');
  if (t.by === 'g1' && t.act?.type === 'loan/take') { const tu = topUpOf(s); tu.denied = (tu.denied || 0) + 1; } // §3.7: top-up only after denied loans
  const gm = s.gm?.unit;
  if (gm) {
    gm.loyalty = r2(Math.max(0, gm.loyalty + GM.mood.denyLoyalty));
    gm.backlog = Math.max(0, (gm.backlog || 0) - 1);
    delete gm.waiting;
  }
  if (t.by === 'g1') histDay(s, 'g1').tasksDone++;
  gmLog(s, ctx.now, 'denied', { key: t.key, reason: t.reason }, { taskId: t.id });
  settleGm(s, ev);
  ev.push({ type: 'taskAnswered', id: t.id, kind: t.kind, answer: 'denied' });
}

// ---------- staff helpers (docs/design/staff-manager.md §8 books / ledger / journal) ----------
const r2 = n => Math.round(n * 100) / 100;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uidNum = u => parseInt(String(u.uid).replace(/\D+/g, ''), 10) || 0;
// Journal / timeline rows (were s.staff.journal and u.log, now history rows; D.teamJournal / D.unitLog are the old
// views). By whom: the unit itself (its own trouble / craft), the rival, or whoever runs this action (you, the manager,
// a lead / software → the unit).
const SELF_TYPES = new Set(['overheat', 'jam', 'slacked', 'craft', 'mvp', 'autoCare', 'warranty', 'funny']); // funny: the unit's own incident, not something the player did
const RIVAL_TYPES = new Set(['poachStarted', 'poachRefused']);
function journal(s, now, type, u, extra) {
  const actor = !u ? ACTOR : SELF_TYPES.has(type) ? u.uid : RIVAL_TYPES.has(type) ? 'system' : ACTOR === 'staff' || ACTOR === 'penalty' ? u.uid : ACTOR;
  hist(s, { at: now, type, actor, subject: u?.uid, name: u?.name ?? undefined, extra, zone: u ? STAFF[u.type]?.zone ?? null : null });
}
const note = (u, now, type, extra, s = CUR) => journal(s, now, type, u, extra);
// Per-day numbers of a unit (profile KPIs, the 7-day chart, grades): one row per local calendar day, PROFILE.daysKeep kept.
function dayOf(u, now) {
  const d = D.dayKey(now);
  const rows = (u.days ||= []);
  let row = rows[rows.length - 1];
  if (!row || row.d !== d) {
    row = { d, jobs: 0, earned: 0, spent: 0, mistakes: 0, shift: 0, work: 0, down: 0 };
    rows.push(row);
    if (rows.length > PROFILE.daysKeep) u.days = rows.slice(-PROFILE.daysKeep);
  }
  return row;
}
// A unit's job row: added to its row of the same batch window and job type, else a new row.
function workRow(s, u, n, task, now) {
  const P = D.playedMs(s), win = HISTORY.workBatchSec * 1000, rows = histOf(s).rows, slot = Math.floor(P / win);
  for (let i = rows.length - 1; i >= 0 && Math.floor(rows[i].atPlayed / win) === slot; i--) {
    const r = rows[i];
    if (r.type === 'work' && r.actor === u.uid && (r.extra?.task ?? null) === task) { r.extra = { ...r.extra, n: (r.extra?.n || 0) + n }; return; }
  }
  hist(s, { at: now, type: 'work', actor: u.uid, extra: { n, task }, zone: STAFF[u.type]?.zone ?? null });
}
// Craft practice (CAREER step 3): one more job of a type for a worker; a new craft step goes to its timeline.
function practice(u, task, now) {
  if (!u || STAFF[u.type]?.kind !== 'worker') return;
  const before = craftLevel(u, task);
  u.craft = { ...(u.craft || {}), [task]: (u.craft?.[task] || 0) + 1 };
  const after = craftLevel(u, task);
  if (after > before) note(u, now, 'craft', { task, step: after });
}
// Counts into the lifetime book and today's row at once.
function tally(u, now, key, n) {
  const b = bookOf(u, now), d = dayOf(u, now);
  b[key] = r2((b[key] || 0) + n);
  d[key] = r2((d[key] || 0) + n);
}
// Team ledger: one row per game minute (floor(now / 60000)), the last BOOKS.ledgerKeep kept, plus one row per local
// calendar day (s.staff.daily, PROFILE.teamDaysKeep kept) so the report survives units that left. Spending carries a
// category (docs/design/staff-profile.md §report): care (workers' care, fees, tending, keeping), robot (robots' recharge,
// cooling, repairs, service), upgrade (stats, parts), upkeep (bench), hire (hire / recruit prices).
// Only the non-care categories are stored; care = spent − the others. Each row keeps the team total and, per game zone
// (row.farm / row.shop), the same numbers, so each game's report shows only its own team.
const LEDGER_CATS = ['robot', 'upgrade', 'upkeep', 'wage', 'hire', 'research'];
function ledger(s, now, key, amount, cat = null, zone = null) {
  if (!(amount > 0)) return;
  const put = o => { o[key] = r2((o[key] || 0) + amount); if (key === 'spent' && LEDGER_CATS.includes(cat)) o[cat] = r2((o[cat] || 0) + amount); };
  const add = row => { put(row); if (zone === 'farm' || zone === 'shop') put(row[zone] ||= {}); };
  const min = Math.floor(now / 60000);
  const rows = (s.staff.ledger ||= []);
  let row = rows[rows.length - 1];
  if (!row || row.min !== min) { row = { min, earned: 0, spent: 0 }; rows.push(row); }
  add(row);
  if (rows.length > BOOKS.ledgerKeep) s.staff.ledger = rows.slice(-BOOKS.ledgerKeep);
  const d = D.dayKey(now), days = (s.staff.daily ||= []);
  let day = days[days.length - 1];
  if (!day || day.d !== d) { day = { d, earned: 0, spent: 0 }; days.push(day); }
  add(day);
  if (days.length > PROFILE.teamDaysKeep) s.staff.daily = days.slice(-PROFILE.teamDaysKeep);
}
const bookOf = (u, now) => (u.book ||= { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: now });
// cat: 'care' (default; a robot's care counts as 'robot'), 'upgrade' (also the day row's capex), 'upkeep'.
function unitSpent(s, u, amount, now, cat = 'care') {
  if (!(amount > 0)) return;
  tally(u, now, 'spent', amount);
  const d = dayOf(u, now);
  if (cat === 'upgrade') d.capex = r2((d.capex || 0) + amount);
  if (cat === 'upkeep') d.upkeep = r2((d.upkeep || 0) + amount);
  ledger(s, now, 'spent', amount, cat === 'care' && STAFF[u.type]?.kind === 'robot' ? 'robot' : cat, STAFF[u.type]?.zone);
}
function unitEarned(s, u, amount, now) { if (!(amount > 0)) return; tally(u, now, 'earned', amount); ledger(s, now, 'earned', amount, null, STAFF[u.type]?.zone); }
// A new unit joins the current region's zone: on shift when a working slot is free, else benched.
function makeUnit(s, { type, trait, name, gender, perk, age, home, paid = 0, hobbies }, now) {
  const def = STAFF[type];
  const unit = { uid: uid(s, 'u'), type, assigned: null, active: false, paid, hiredAt: now, tenurePlayedMin: 0, book: { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: now }, days: [] };
  if (def.kind === 'robot') Object.assign(unit, { serial: robotSerial(type, unit.uid), task: 'auto', parts: { battery: 0, motor: 0, cooler: 0, frame: 0 }, partsSpent: 0, heat: 0, wear: 100, software: [], softwareSpent: 0, warrantyUsed: 0 });
  else {
    if (trait) Object.assign(unit, { trait, name, gender });
    if (perk) unit.perk = perk;
    Object.assign(unit, Number.isFinite(age) && home ? { age, home, hobbies: hobbies || profileOfUid(unit.uid, String(s.world.currentRegion || '').split('-')[0] || 'vn').hobbies } : profileOfUid(unit.uid, String(s.world.currentRegion || '').split('-')[0] || 'vn'));
    unit.craft = {};
    unit.gear = {};
    unit.gearSpent = 0;
    Object.assign(unit, { stats: startStats(trait, perk), points: 0, xp: 0, tasks: [], water: 0, ...VITALS.start });
    unit.checkup = { at: now, atTenure: 0, grade: checkupGrade(unit) };
  }
  s.staff.units.push(unit);
  if (D.region(s)) { unit.assigned = { regionId: s.world.currentRegion, zone: def.zone }; unit.active = D.freeSlots(s, def.zone) > 0; }
  return unit;
}
// A unit leaves the team (unpaid, poached, let go, fired / sold): poach cleared, journal + staffLeft event.
function removeUnit(s, u, now, reason, ev, extra = {}) {
  journal(s, now, 'left', u, reason);
  s.staff.units = s.staff.units.filter(x => x.uid !== u.uid);
  for (const t of D.tasksOpen(s).filter(x => x.kind === 'poach' && x.act?.payload?.uid === u.uid)) closeTask(s, t, 'cancelled');
  tombstone(s, u.uid, u.name || u.serial || null, STAFF[u.type]?.kind || 'worker', now);
  ev.push({ type: 'staffLeft', uid: u.uid, name: u.name || null, staff: u.type, reason, ...extra });
}
// Estates (founder 2026-11-08): bought land is planted freely — no rows are laid out for the player. Each estate bought
// and each level-up add one free-field credit of ESTATE_FIELDS (derive.fieldAllowance = credits × ESTATE_FIELDS); the
// player places those fields anywhere on land they own. r.tilled = { estateId: credits } (name kept for saves).
function tilledOf(r) {
  if (!r.tilled) {
    r.tilled = {};
    for (const e of Object.values(ESTATES)) r.tilled[e.id] = farmLotsOf(e).filter(id => plotsOf(id).some(p => (r.fields || []).some(f => f.id === p.id))).length;
  }
  return r.tilled;
}
function autoTill(s, ev) {
  return; // retired: no pre-tilled rows any more, fields are placed freely and cost nothing
  const r = D.region(s);
  if (!r) return;
  const t = tilledOf(r), owned = ESTATE_ORDER.filter(id => D.estateOwned(s, id));
  const want = D.level(s) + owned.length - 1, newest = owned[owned.length - 1];
  let have = Object.values(t).reduce((a, b) => a + b, 0);
  if (have >= want || !newest) return;
  t[newest] = (t[newest] || 0) + (want - have);
  ev?.push({ type: 'fieldsGranted', estate: newest, fields: (want - have) * ESTATE_FIELDS });
}

function addPreTilled(r, lotId) {
  if (!PRE_TILLED[PARCELS[lotId]?.kind]) return 0;
  r.fields ||= [];
  let n = 0;
  for (const p of plotsOf(lotId)) if (!r.fields.some(f => f.id === p.id)) { r.fields.push({ id: p.id, x: p.x, z: p.z }); n++; }
  return n;
}
// Build XP is earned once per copy slot (region.peak = most copies ever built of a type), so build → remove → build
// never farms XP.
function firstBuildXp(r, type) {
  r.peak ||= {};
  const n = type === 'field' ? r.fields.length : r.buildings.filter(b => b.type === type).length;
  if (n <= (r.peak[type] || 0)) return false;
  r.peak[type] = n;
  return true;
}
const rot4 = rot => ((Math.round(Number(rot) || 0) % 4) + 4) % 4;
// The region's street state; regions built before the café street (not yet re-normalized) get the default.
function streetOf(r) {
  if (!r.street || !Array.isArray(r.street.open) || !r.street.rating) r.street = normalizeStreet(r.street);
  return r.street;
}

export function freshRegion(s, now) {
  const r = normalizeRegion({ status: 'active', enteredAt: now });
  const starters = Object.values(PARCELS).filter(p => p.starter).map(p => p.id);
  r.parcels = withEstates(starters); // the home estate is owned from the start
  r.roads = Object.values(ROADS).filter(x => x.open).map(x => x.id);
  r.buildings = starterBuildings(s);
  r.fields = [];
  r.tilled = {}; // tier 1 starts empty: the player plants and builds anywhere (founder 2026-11-08)
  return r;
}
function starterBuildings(s) {
  return Object.values(BUILDINGS).filter(b => b.starter).map(b => ({ uid: uid(s, 'b'), type: b.id, x: FIXED[b.id].x, z: FIXED[b.id].z, rot: FIXED[b.id].rot, level: 1 }));
}
// Re-add any missing starter building (safety net after a reset or a damaged save).
function ensureStarters(s, r) {
  for (const def of Object.values(BUILDINGS)) {
    if (!def.starter || r.buildings.some(b => b.type === def.id)) continue;
    r.buildings.push({ uid: uid(s, 'b'), type: def.id, x: FIXED[def.id].x, z: FIXED[def.id].z, rot: FIXED[def.id].rot, level: 1 });
  }
  for (const p of Object.values(PARCELS)) if (p.starter && !r.parcels.includes(p.id)) r.parcels.push(p.id);
  for (const road of Object.values(ROADS)) if (road.open && !r.roads.includes(road.id)) r.roads.push(road.id);
  // A farm with no field at all gets its starter fields back where they are free (never softlocked).
  r.fields ||= [];
  if (!r.fields.length) for (const p of Object.values(PARCELS)) if (p.starter && PRE_TILLED[p.kind]) {
    for (const pl of plotsOf(p.id)) if (!r.buildings.some(b => !BUILDINGS[b.type]?.walkable && D.footprint(b.type, b.x, b.z, b.rot)[0] < pl.x + 1.5 && D.footprint(b.type, b.x, b.z, b.rot)[2] > pl.x - 1.5
      && D.footprint(b.type, b.x, b.z, b.rot)[1] < pl.z + 1.5 && D.footprint(b.type, b.x, b.z, b.rot)[3] > pl.z - 1.5)) r.fields.push({ id: pl.id, x: pl.x, z: pl.z });
  }
}

// Plants every spot of a plan through farm/plantAt, so the price, the XP and what staff see are those of planting one by one.
// Taken spots are skipped; out of coins, it stops at the last tree it could pay for.
function plantSpots(s, crop, plan, ev, ctx) {
  const r = D.region(s);
  if (!r) return fail('unknown');
  if (otherGame(r, 'farm')) return fail('gameLocked');
  if (!D.cropUnlocked(s, crop)) return fail('locked');
  const before = s.player.coins;
  let n = 0;
  for (const p of plan.spots) {
    if (p.error) continue;
    const q = handlers['farm/plantAt'](s, { x: p.x, z: p.z, crop }, ev, ctx);
    if (q?.ok === false) { if (q.error === 'coins') break; continue; }
    r.fields[r.fields.length - 1].row = plan.dir; // looks only: its soil bed lies along the row (plots.js)
    n++;
  }
  D.forgetRegionMemo(r); // the last tree's `row` was written after the memo was built
  if (!n) return fail(plan.error || 'blocked', plan.error === 'coins' ? { missing: Math.max(1, Math.ceil(D.seedCost(s, crop) - s.player.coins)) } : undefined);
  ev.push({ type: 'rowPlanted', crop, n, cost: Math.round((before - s.player.coins) * 100) / 100 });
}

const handlers = {
  // ---------- story ----------
  'character/set'(s, { gender, name }) {
    if (gender !== 'male' && gender !== 'female') return fail('invalid');
    s.character = { gender, name: String(name || '').slice(0, 20) };
    if (s.story.phase === 'select') s.story.phase = 'intro';
  },
  'story/introDone'(s) {
    if (s.story.phase !== 'intro') return;
    s.story.phase = 'teacher';
  },
  // Teacher talk done (or skipped): the World Gate opens. Grants the free auto runs once (no rebirth credits any more).
  'story/teacherDone'(s) {
    s.story.teacherMet = true;
    if (s.story.phase === 'teacher' || s.story.phase === 'intro' || s.story.phase === 'select') s.story.phase = 'gate';
  },
  'story/seen'(s, { key }) { if (typeof key === 'string') s.story.seen[key] = true; },

  // ---------- world ----------
  // Buy access to a region with coins (free for the first region, and once after the Level-10 expiration).
  'world/unlockRegion'(s, { regionId }, ev, ctx) {
    const cost = D.regionUnlockCost(s, regionId);
    if (cost === null) return fail('unknown');
    if (D.ownsRegion(s, regionId)) return { noop: true };
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    if (cost === 0 && s.world.ownedRegions.length > 0) s.world.freeUnlocks = Math.max(0, (s.world.freeUnlocks || 0) - 1);
    // The first city runs on the opening coins; later ones get working capital (always less than the cheapest city).
    if (s.world.ownedRegions.length > 0 && !own(s.wallet.gold, regionId)) { s.wallet.gold[regionId] = WALLET.newFarmStarterGold; W.addLedger(s, ctx.now, { kind: 'starter', gold: WALLET.newFarmStarterGold, regionId }); }
    s.world.ownedRegions.push(regionId);
    ev.push({ type: 'regionUnlocked', regionId, cost });
  },
  // game ('farm' | 'cafe', optional): picked on the map's city row — a region with no game yet starts as that game
  // (no "what do you want to play?" question once inside). Ignored when the city does not offer it or the region has one.
  'world/enterRegion'(s, { regionId, game = null }, ev, ctx) {
    if (!['gate', 'chooseRegion', 'play'].includes(s.story.phase)) return fail('phase');
    const access = D.regionAccess(s, regionId);
    if (!access.ok) return fail(access.reason, access);
    if (access.current) { s.story.phase = 'play'; return; }
    handlers['auto/stop'](s, { reason: 'region' }, ev, ctx); // a run belongs to the farm you left: its time is kept
    const prev = s.world.currentRegion && s.world.regions[s.world.currentRegion];
    if (prev && prev.status === 'active') prev.status = 'idle';
    let r = s.world.regions[regionId];
    if (!r) { r = freshRegion(s, ctx.now); s.world.regions[regionId] = r; ev.push({ type: 'regionFirstVisit', regionId }); }
    else { ensureStarters(s, r); r.status = 'active'; r.enteredAt = ctx.now; }
    // The register now holds the new city's Gold. Coins held before any city (the opening coins) go with the first one.
    const from = s.world.currentRegion;
    if (from) s.wallet.gold[from] = s.player.coins;
    s.player.coins = r2((s.wallet.gold[regionId] || 0) + (from ? 0 : s.player.coins));
    s.world.currentRegion = regionId;
    for (const ln of s.loans) if (ln.regionId == null) ln.regionId = regionId; // a debt carried over the Level-10 reset
    if (!r.mode && (game === 'farm' || game === 'cafe') && D.currentGames(s).includes(game)) r.mode = game;
    s.mode = r.mode || null; // the region's game; null → the HUD asks (only the games this country offers)
    // Anyone with no place yet (the Level-10 follower) comes along to the new region.
    for (const u of s.staff.units) if (!u.assigned) { u.assigned = { regionId, zone: STAFF[u.type].zone }; u.active = D.freeSlots(s, STAFF[u.type].zone) > 0; }
    if (!s.world.startCountry) s.world.startCountry = parseRegionId(regionId).countryId;
    s.story.phase = 'play';
    ev.push({ type: 'regionEntered', regionId });
  },

  // ---------- farm ----------
  // crooked: a staff mistake (realm roll, mistakeChance) — the plot grows MISTAKES.crookedSlow slower.
  'farm/plant'(s, { plotId, crop = 'robusta', crooked = false, uid: by = null }, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('unknown');
    if (otherGame(r, 'farm')) return fail('gameLocked');
    // Fields are placeables now: a plot id exists only as a field of this region (classic ids F1-1… stay valid).
    if (!D.plotOf(s, plotId)) return fail(plotById(plotId) ? 'notOwned' : 'unknown');
    if (r.plots[plotId]) return fail('occupied');
    if (!D.cropUnlocked(s, crop)) return fail('locked');
    const cost = D.seedCost(s, crop);
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    r.plots[plotId] = { crop, plantedAt: ctx.now, born: ctx.now, n: 0 }; // a sapling: the tree stays after each harvest
    // The way you adopted (research step 3). The default way is the old, neutral farming: no method on the plot.
    const way = D.methodOf(s, crop);
    if (methodKey(way) !== methodKey(FARMLAB.defaultMethod)) r.plots[plotId].method = [...way];
    if (by != null) practice(D.unitOf(s, by), 'plant', ctx.now);
    if (crooked === true) { r.plots[plotId].slow = true; const u = by != null && D.unitOf(s, by); if (u) tally(u, ctx.now, 'mistakes', 1); }
    // Farm tutorial: seeds planted before the first harvest ripen fast (no long idle wait for a new player).
    if (!s.stats.harvested && !s.tutorial.done && !s.tutorial.farmDone) r.plots[plotId].fast = true;
    s.stats.planted++;
    ev.push({ type: 'planted', plotId, crop, cost, free: cost === 0, crooked: crooked === true });
  },
  // Free planting: put a field exactly where the player tapped (no rows / no pre-made bed) and sow it in one step.
  'farm/plantAt'(s, { x, z, crop = 'robusta' }, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('unknown');
    if (!D.cropUnlocked(s, crop)) return fail('locked');
    const need = D.buildCost(s, 'field') + D.seedCost(s, crop);
    if (s.player.coins < need) return fail('coins', { missing: need - s.player.coins });
    const coins = s.player.coins, n = r.fields.length;
    const p = handlers['build/place'](s, { type: 'field', x, z }, ev, ctx);
    if (p?.ok === false) return p;
    D.forgetRegionMemo(r); // the new field must be visible to farm/plant (a row plants many inside one action)
    const f = r.fields[r.fields.length - 1];
    const q = handlers['farm/plant'](s, { plotId: f.id, crop }, ev, ctx);
    if (q?.ok === false) { r.fields.length = n; s.player.coins = coins; D.forgetRegionMemo(r); return q; }
  },
  // A long row in one stroke (founder 2026-11-09): every tree goes through farm/plantAt, so the price, the XP and what staff see are
  // those of planting one by one. Taken spots are skipped; out of coins, the row stops at the last tree it could pay for.
  'farm/plantRow'(s, { x0, z0, x1, z1, crop = 'robusta', rows = 1 }, ev, ctx) {
    return plantSpots(s, crop, D.rowPlan(s, crop, Number(x0), Number(z0), Number(x1), Number(z1), rows), ev, ctx);
  },
  // The Fill button: the same trees at the same price, on the nearest free spots around the point the player is looking at.
  'farm/plantFill'(s, { x, z, crop = 'robusta', max }, ev, ctx) {
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) return fail('blocked');
    return plantSpots(s, crop, D.fillPlan(s, crop, Number(x), Number(z), max), ev, ctx);
  },
  // The Harvest button: every ripe tree of this farm, each through farm/harvest, so stars, beans and XP are those of picking it by hand.
  // A storehouse that fills up stops the round; what was picked stays picked.
  'farm/harvestAll'(s, _, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('unknown');
    if (otherGame(r, 'farm')) return fail('gameLocked');
    const ready = D.ownedPlots(s).filter(p => D.plotState(s, p.id, ctx.now).stage === 'ready');
    if (!ready.length) return fail('empty');
    let n = 0, full = false;
    for (const p of ready) {
      const q = handlers['farm/harvest'](s, { plotId: p.id }, ev, ctx);
      if (q?.ok === false) { if (q.error === 'storageFull') { full = true; break; } continue; }
      n++;
    }
    if (!n) return fail(full ? 'storageFull' : 'empty', full ? { capacity: D.capacity(s) } : undefined);
    ev.push({ type: 'harvestedAll', n, full });
  },
  // unripe: a staff mistake (picked a bit early) — one bean less (never below 1).
  // uid: a staff unit harvested it (its stars, unitStars); none = the player: 3★ when fresh (QUALITY.freshSeconds).
  'farm/harvest'(s, { plotId, unripe = false, uid: by = null }, ev, ctx) {
    const r = D.region(s);
    if (!r || !D.own(r.plots, plotId)) return fail('empty');
    const st = D.plotState(s, plotId, ctx.now);
    if (st.stage !== 'ready') return fail('notReady', { remainingMs: st.remainingMs });
    const cap = D.capacity(s);
    if (D.stored(s) >= cap) return fail('storageFull', { capacity: cap }); // every good shares the storehouse
    const unit = by != null ? D.unitOf(s, by) : null;
    const pl = r.plots[plotId];
    const crop = CROPS[st.crop], overMs = ctx.now - pl.plantedAt - D.plotGrowMs(s, pl, plotId);
    const garden = D.gardenOf(s); // garden layers: shade keeps ripe cherries good longer, adds a chance of +1★, bears a little less
    const fresh = overMs <= (crop.freshSeconds ?? QUALITY.freshSeconds) * 1000 * garden.freshMul;
    const zoneStars = (D.climateEffect(st.crop, D.climateOfPlot(s, plotId))?.stars || 0) + D.shadeStars(s, plotId, st.crop); // growing zone (vùng trồng) + shade tree
    const way = Array.isArray(pl.method) ? methodEffect(s.world.currentRegion, st.crop, pl.method) : null;
    // The way it was grown: its quality is the chance this harvest comes out one star better (deterministic per plot).
    const luck = ((Math.sin((pl.plantedAt % 1e7) * 0.0137 + plotId.length * 7.31) * 43758.5453) % 1 + 1) % 1;
    const stars = Math.max(1, Math.min(3, (unit ? D.unitStars(unit) : fresh ? 3 : 1) + (luck < Math.min(1, (way?.quality || 0) + garden.quality) ? 1 : 0) + zoneStars));
    let beans = Math.max(1, Math.round(D.starYield(s, st.crop, stars) * (way?.yieldMul || 1) * garden.yieldMul) - (unripe === true ? 1 : 0));
    const dropped = crop.drop && overMs > crop.drop.after * 1000 ? 1 + Math.floor((overMs - crop.drop.after * 1000) / (crop.drop.every * 1000)) : 0;
    const lonely = crop.pollinate && !D.pollinated(s, plotId) ? crop.pollinate.loss : 0;
    beans = Math.max(1, beans - dropped - lonely) + (pl.trimmed === true ? CREW.trimBeans : pl.trimmed || 0) + (pl.sprayed ? CREW.sprayBeans : 0); // the crew's care of this season
    if (D.treeOld(pl)) beans = Math.max(1, Math.round(beans * PERENNIAL.oldYield)); // an old tree: cut it back or replant
    let wave = 0; // Liberica: the first pick takes `first` of the beans, the plant stays for the rest
    if (crop.waves && !pl.wave) { const all = beans; beans = Math.max(1, Math.round(all * crop.waves.first)); wave = Math.max(1, all - beans); }
    if (pl.trial) { // a trial field: its numbers go into the comparison table
      const rid = s.world.currentRegion, key = methodKey(pl.method);
      s.farmLab ||= { methods: {}, trials: {}, results: {} };
      (((s.farmLab.results ||= {})[rid] ||= {})[st.crop] ||= {})[key] = { method: [...pl.method], beans, ms: D.plotGrowMs(s, pl, plotId), up: way ? luck < way.quality : false, at: ctx.now };
      s.farmLab.trials[rid] = (s.farmLab.trials[rid] || []).filter(t => t.plotId !== plotId);
      if (!s.farmLab.trials[rid].length) delete s.farmLab.trials[rid];
      ev.push({ type: 'trialDone', crop: st.crop, method: pl.method, beans });
    }
    if (D.dripCovers(s, plotId) && s.player.coins >= BUILDINGS.dripLine.effect.fee) spend(s, BUILDINGS.dripLine.effect.fee); // the drip line's water bill
    // A hauler carries a staff harvest to the storehouse; the player's own pick (or no hauler) goes in at once. Soft cap as before.
    if (unit && D.haulActive(s)) pl.pile = { ...pl.pile, [st.crop]: (pl.pile?.[st.crop] || 0) + beans };
    else addBeans(s, st.crop, beans);
    if (unit) { unitEarned(s, unit, beans * D.beanPrice(st.crop), ctx.now); practice(unit, 'harvest', ctx.now); if (unripe === true) tally(unit, ctx.now, 'mistakes', 1); } // book: beans valued at the sell price
    // Perennial: the tree stays. Liberica's first pick leaves the rest of the season on it; otherwise the next season
    // starts now (one-off flags of the planting — tutorial speed, a crooked planting, a trial, watering — end here).
    pl.born ??= pl.plantedAt;
    pl.plantedAt = ctx.now;
    delete pl.fast; delete pl.watered;
    if (wave) pl.wave = wave;
    else { delete pl.wave; delete pl.slow; delete pl.trial; delete pl.pruned; delete pl.trimmed; delete pl.sprayed; pl.n = (pl.n | 0) + 1; }
    s.stats.harvested++;
    const xp = wave ? 0 : crop.xp; // a season's XP comes once, with its last pick
    grantXp(s, xp, ev);
    ev.push({ type: 'harvested', plotId, crop: st.crop, beans, stars, xp, by, age: pl.n | 0, old: D.treeOld(pl), unripe: unripe === true, dropped, lonely: lonely > 0, wave: wave ? 1 : pl.wave ? 2 : 0 });
  },

  // Cưa đốn phục hồi: an old tree is cut back to the stump; it re-grows (PERENNIAL.pruneGrow × its first crop) and is
  // young again. Only an old tree, not while its cherries are ripe.
  'farm/prune'(s, { plotId, uid: by = null } = {}, ev, ctx) {
    const r = D.region(s), pl = r && D.own(r.plots, plotId) ? r.plots[plotId] : null;
    if (!pl) return fail('empty');
    if (otherGame(r, 'farm')) return fail('gameLocked');
    if (!D.treeOld(pl)) return fail('notOld');
    if (D.plotState(s, plotId, ctx.now).stage === 'ready') return fail('ripe');
    const cost = D.pruneCost(pl.crop);
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    pl.born ??= pl.plantedAt;
    pl.n = 0; pl.pruned = true; pl.plantedAt = ctx.now;
    delete pl.wave; delete pl.watered;
    if (by != null) practice(D.unitOf(s, by), 'prune', ctx.now);
    ev.push({ type: 'pruned', plotId, crop: pl.crop, cost, by });
  },
  // Light pruning by a pruner / TrimBot: this season's harvest gives CREW.trimBeans more. Once per season.
  'farm/trim'(s, { plotId, uid: id } = {}, ev, ctx) {
    const r = D.region(s), pl = r && D.own(r.plots, plotId) ? r.plots[plotId] : null, unit = D.unitOf(s, id);
    if (!pl || !doesJob(unit, 'prune')) return fail('unknown');
    if (pl.trimmed || D.plotState(s, plotId, ctx.now).stage === 'ready') return { noop: true };
    pl.trimmed = trimBeansOf(unit); // beans it adds at harvest
    practice(unit, 'prune', ctx.now);
    ev.push({ type: 'trimmed', plotId, uid: id });
  },
  // Leaf spray by the drone: CREW.sprayFee coins, this season's harvest gives CREW.sprayBeans more. Once per season.
  'farm/spray'(s, { plotId, uid: id } = {}, ev, ctx) {
    const r = D.region(s), pl = r && D.own(r.plots, plotId) ? r.plots[plotId] : null, unit = D.unitOf(s, id);
    if (!pl || !doesJob(unit, 'spray')) return fail('unknown');
    if (pl.sprayed || D.plotState(s, plotId, ctx.now).stage === 'ready') return { noop: true };
    if (s.player.coins < CREW.sprayFee) return fail('coins', { missing: CREW.sprayFee - s.player.coins });
    spend(s, CREW.sprayFee);
    unitSpent(s, unit, CREW.sprayFee, ctx.now);
    pl.sprayed = true;
    ev.push({ type: 'sprayed', plotId, uid: id });
  },
  // A hauler picks up what waits on a field, up to what it can carry.
  'farm/pickUp'(s, { plotId, uid: id } = {}, ev) {
    const r = D.region(s), pl = r && D.own(r.plots, plotId) ? r.plots[plotId] : null, unit = D.unitOf(s, id);
    if (!pl || !doesJob(unit, 'haul')) return fail('unknown');
    let room = D.haulCapacity(unit) - D.cargoCount(unit);
    if (room <= 0 || !D.pileCount(pl)) return { noop: true };
    const cargo = { ...unit.cargo }, pile = { ...pl.pile };
    for (const c of Object.keys(pile)) { const n = Math.min(room, pile[c]); if (n <= 0) continue; cargo[c] = (cargo[c] || 0) + n; pile[c] -= n; room -= n; if (!pile[c]) delete pile[c]; }
    unit.cargo = cargo;
    if (Object.keys(pile).length) pl.pile = pile; else delete pl.pile;
    ev.push({ type: 'pickedUp', plotId, uid: id });
  },
  // The load goes into the storehouse (refused only when it is already full). drop: a mistake on the way, 1 unit lost.
  'farm/deposit'(s, { uid: id, drop = false } = {}, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!doesJob(unit, 'haul')) return fail('unknown');
    if (!D.cargoCount(unit)) return { noop: true };
    if (D.stored(s) >= D.capacity(s)) return fail('storageFull', { capacity: D.capacity(s) });
    const cargo = { ...unit.cargo };
    if (drop === true) { const c = Object.keys(cargo).sort((a, b) => cargo[b] - cargo[a])[0]; cargo[c]--; tally(unit, ctx.now, 'mistakes', 1); }
    for (const [c, n] of Object.entries(cargo)) if (n > 0) addBeans(s, c, n);
    delete unit.cargo;
    practice(unit, 'haul', ctx.now);
    ev.push({ type: 'deposited', uid: id });
  },
  // Chặt bỏ: the tree is removed (no refund) so the field can take another variety.
  'farm/uproot'(s, { plotId } = {}, ev) {
    const r = D.region(s), pl = r && D.own(r.plots, plotId) ? r.plots[plotId] : null;
    if (!pl) return fail('empty');
    if (otherGame(r, 'farm')) return fail('gameLocked');
    for (const [c, n] of Object.entries(pl.pile || {})) addBeans(s, c, n); // what was picked is not lost with the tree
    delete r.plots[plotId];
    ev.push({ type: 'uprooted', plotId, crop: pl.crop });
  },

  // Farm game: sell a good at the storehouse (all of it by default) → coins. farm/sellBeans = beans (older HUD).
  'farm/sell'(s, { good = 'beans', item, amount } = {}, ev) { return sellGood(s, item ?? good, amount, ev); },
  'farm/sellVariety'(s, p, ev) { return sellVariety(s, p || {}, ev); },
  'farm/sellBeans'(s, { amount } = {}, ev) { return sellGood(s, 'beans', amount, ev); },
  // One tap: sell everything stored (each good at its price).
  'farm/sellAll'(s, _p, ev) {
    if (otherGame(D.region(s), 'farm')) return fail('gameLocked');
    const q = D.sellAllQuote(s);
    if (q.amount <= 0) return fail('noBeans');
    for (const part of q.parts) { addGood(s, part.good, -part.amount, { order: D.BEAN_SELL_ORDER }); if (part.good === 'beans') ev.push({ type: 'beansSold', amount: part.amount, coins: part.coins }); }
    earn(s, q.coins, ev);
    s.stats.sold = (s.stats.sold || 0) + q.amount;
    ev.push({ type: 'goodsSold', parts: q.parts, amount: q.amount, coins: q.coins });
  },

  // ---------- café ----------
  // Café game: buy beans from the supplier (one pack by default; the grace beans are free when the café is stuck).
  // roll < the beans supplier's late chance → the delivery arrives SUPPLY.lateSeconds later (docs/design/research.md).
  'shop/buyBeans'(s, { amount = BEANS.buyPack, roll = 1 } = {}, ev, ctx) {
    if (otherGame(D.region(s), 'cafe')) return fail('gameLocked'); // a farm region cannot import beans (no buy → sell loop)
    settleSupply(s, ctx.now, ev);
    const q = D.beanBuyQuote(s, amount);
    if (q.error) return fail(q.error, q.error === 'coins' ? { missing: q.missing } : undefined);
    spend(s, q.cost);
    if (!q.free && (Number(roll) || 0) < D.supplyOf(s, 'beans', ctx.now).late) {
      (s.supply.pending ||= []).push({ amount: q.amount, at: ctx.now + SUPPLY.lateSeconds * 1000 });
      ev.push({ type: 'beansLate', amount: q.amount, seconds: SUPPLY.lateSeconds });
      return;
    }
    addBeans(s, 'robusta', q.amount);
    s.stats.bought = (s.stats.bought || 0) + q.amount;
    ev.push({ type: 'beansBought', amount: q.amount, cost: q.cost, free: q.free });
  },
  // The café stands still while the player is on the farm: pause stores the moment, resume shifts every order's
  // timestamps by the paused time (patience, seat patience and brewing continue where they were).
  'shop/pause'(s, _p, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    if (r.shop.pausedAt) return { noop: true };
    r.shop.pausedAt = ctx.now;
  },
  'shop/resume'(s, _p, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    if (!r.shop.pausedAt) return { noop: true };
    const d = Math.max(0, ctx.now - r.shop.pausedAt);
    for (const o of r.shop.orders) for (const k of ['at', 'takenAt', 'brewStart']) if (Number.isFinite(o[k])) o[k] += d;
    r.shop.pausedAt = 0;
  },
  'shop/spawnCustomer'(s, { roll = 0, look = 0 }, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    if (r.shop.orders.filter(o => o.stage === 'waiting').length >= D.queueCap(s)) return fail('queueFull');
    const drinks = D.unlockedDrinks(s);
    // Weighted towards the newest drink a little: [1, 2, 3] weights.
    const weights = drinks.map((_, i) => i + 1), total = weights.reduce((a, b) => a + b, 0);
    let x = Math.min(.999999, Math.max(0, roll)) * total, drink = drinks[0];
    for (let i = 0; i < drinks.length; i++) { if (x < weights[i]) { drink = drinks[i]; break; } x -= weights[i]; }
    const order = { id: r.shop.nextOrder++, drink, stage: 'waiting', at: ctx.now, look: look | 0 };
    // Local menu (config/menus.js): the customer asks for one of this country's drinks of that base.
    const cc = parseRegionId(s.world.currentRegion)?.countryId;
    const items = menuItemsOf(cc, drink);
    if (items.length) {
      // Recipes you found at the test bench are ordered RESEARCH.foundWeight × as often (docs/design/research.md).
      const w = items.map(i => (D.recipeFound(s, cc, i) ? RESEARCH.foundWeight : 1)), sum = w.reduce((a, b) => a + b, 0);
      let x = ((Math.min(.999999, Math.max(0, roll)) * 7919) % 1) * sum;
      order.item = items[items.length - 1];
      for (let k = 0; k < items.length; k++) { if (x < w[k]) { order.item = items[k]; break; } x -= w[k]; }
    }
    r.shop.orders.push(order);
    ev.push({ type: 'customerArrived', orderId: order.id, drink, item: order.item ?? null });
  },
  // A customer gives up: queue customers after SHOP.patienceSeconds, seated customers (order taken, no drink yet)
  // after SHOP.seatPatienceSeconds from takenAt — those leave ANGRY. A ready cup still counts as waiting (no refund).
  // reason (café street incidents, realm/incidents.js): patience (default) | crowd | fight | switch | closed | bar —
  // copied to the event for the HUD toasts; 'fight' counts in stats.fights (an order leaves only once).
  'shop/customerLeft'(s, { orderId, reason } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.id === orderId);
    if (!o) return fail('unknown');
    if (o.stage !== 'waiting' && !D.seatPatienceOver(o, ctx.now)) return fail('notYet');
    const why = LEAVE_REASONS.includes(reason) ? reason : 'patience';
    r.shop.orders.splice(r.shop.orders.indexOf(o), 1);
    if (why === 'fight') s.stats.fights = (s.stats.fights || 0) + 1;
    ev.push({ type: 'customerLeft', orderId, drink: o.drink, angry: o.stage !== 'waiting', reason: why });
  },
  // uid (optional): the staff unit taking it (craft practice 'order').
  'shop/takeOrder'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.stage === 'waiting' && (orderId == null || x.id === orderId));
    if (!o) return fail('noCustomer');
    if (D.seatsUsed(s) >= D.seatCount(s)) return fail('noSeat', { seats: D.seatCount(s) });
    o.stage = 'taken';
    o.takenAt = ctx.now;
    if (by != null) practice(D.unitOf(s, by), 'order', ctx.now);
    ev.push({ type: 'orderTaken', orderId: o.id, drink: o.drink });
  },
  // uid: the staff unit brewing (its stars; hard drinks need a level-QUALITY.hardLevel worker); none = the player, 3★.
  'shop/brew'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    settleSupply(s, ctx.now, ev);
    const r = D.region(s);
    if (!r) return fail('noRegion');
    const brewing = r.shop.orders.filter(x => x.stage === 'brewing').length;
    const o = r.shop.orders.find(x => x.stage === 'taken' && (orderId == null || x.id === orderId));
    if (!o) return fail('noOrder');
    if (brewing >= D.brewSlots(s)) return fail('busy');
    const unit = by != null ? D.unitOf(s, by) : null;
    if (by != null && !unit) return fail('unknown');
    if (!D.canBrew(unit, o.drink)) return fail('hard');
    const need = DRINKS[o.drink].beans;
    if (s.inventory.beans < need) return fail('beans', { need, have: s.inventory.beans });
    takeBeans(s, need);
    o.stage = 'brewing'; o.brewStart = ctx.now; o.brewMs = D.brewMs(s, o.drink); o.stars = unit ? D.unitStars(unit) : 3;
    if (unit) practice(unit, 'brew', ctx.now);
    ev.push({ type: 'brewStarted', orderId: o.id, drink: o.drink, ms: o.brewMs, stars: o.stars });
  },
  // A worker dropped a ready cup (staff mistake): the order goes back to "taken" and must be brewed again.
  'shop/spill'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    const o = D.region(s)?.shop.orders.find(x => x.id === orderId && x.stage === 'brewing');
    if (!o) return fail('notReady');
    const u = by != null && D.unitOf(s, by);
    if (u) tally(u, ctx.now, 'mistakes', 1);
    o.stage = 'taken'; delete o.brewStart; delete o.brewMs; delete o.stars;
    ev.push({ type: 'spilled', orderId, drink: o.drink });
  },
  // uid (optional): the staff unit serving the cup — its book earns the price (a charming one adds RARE.charmingBonus).
  'shop/serve'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.stage === 'brewing' && ctx.now - x.brewStart >= x.brewMs && (orderId == null || x.id === orderId));
    if (!o) return fail('notReady');
    const stars = o.stars || 1;
    const unit = by != null ? D.unitOf(s, by) : null;
    const cc = parseRegionId(s.world.currentRegion)?.countryId;
    let found = o.item != null && D.recipeFound(s, cc, o.item); // a found recipe: its own price
    // Suppliers (research step 2): the beans' quality lifts every cup; a recipe cup pays its ingredients, gets the
    // worst ingredient group's quality, and runs out (sold as the base drink) when a late supplier fails this order.
    let mul = 1 + SUPPLY.qualityBonus[D.supplyOf(s, 'beans', ctx.now).quality];
    let ingCost = 0;
    if (found) {
      const ings = countryRecipes(cc)[o.item].ings, groups = [...new Set(ings.map(D.ingGroup))].map(g => D.supplyOf(s, g, ctx.now));
      const luck = ((Math.sin(o.id * 12.9898 + Math.floor(ctx.now / 60000) * 78.233) * 43758.5453) % 1 + 1) % 1;
      if (groups.some(g => luck < g.late)) { found = false; ev.push({ type: 'ingredientOut', orderId: o.id }); }
      else {
        mul += SUPPLY.qualityBonus[Math.min(...groups.map(g => g.quality))];
        ingCost = r2(D.testCost(ings, s) * SUPPLY.cupIngredientShare);
      }
    }
    const price = Math.max(1, Math.round(D.starPrice(s, o.drink, stars) * (found ? RESEARCH.priceMul : 1) * mul * (unit?.perk === 'charming' ? 1 + RARE.charmingBonus : 1) - ingCost));
    earn(s, price, ev);
    if (unit) { unitEarned(s, unit, price, ctx.now); practice(unit, 'deliver', ctx.now); }
    r.shop.orders.splice(r.shop.orders.indexOf(o), 1);
    s.stats.served++;
    grantXp(s, DRINKS[o.drink].xp, ev);
    ev.push({ type: 'served', orderId: o.id, drink: o.drink, coins: price, stars, xp: DRINKS[o.drink].xp });
  },

  // ---------- café street: 4 shops (docs/design/cafe-street.md) ----------
  // Unlock a street shop (lemon / tea / bar) with coins; level gates stay below the Level-10 incident.
  'shop/openVenue'(s, { venue } = {}, ev) {
    const err = D.venueError(s, venue);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: VENUES[venue].cost - s.player.coins } : err === 'level' ? { level: VENUES[venue].level } : undefined);
    const st = streetOf(D.region(s));
    spend(s, VENUES[venue].cost);
    st.open.push(venue);
    grantXp(s, XP.build, ev);
    ev.push({ type: 'venueOpened', venue, cost: VENUES[venue].cost });
  },
  // A venue vendor served one walk-in (customers are simulated by the realm; `item` is rolled there). No beans.
  'shop/venueSale'(s, { venue, item } = {}, ev) {
    if (venue === 'cafe' || !own(VENUES, venue)) return fail('unknown');
    if (!D.venueOpen(s, venue)) return fail('locked');
    if (typeof item !== 'string' || !VENUES[venue].items.includes(item)) return fail('unknown');
    const it = VENUE_ITEMS[item];
    earn(s, it.price, ev);
    s.stats.venueSold = (s.stats.venueSold || 0) + 1;
    grantXp(s, it.xp, ev);
    ev.push({ type: 'venueSale', venue, item, coins: it.price, xp: it.xp });
  },
  // A customer's 1–5★ review of an open shop: moving average, weight max(RATING.minWeight, 1/(n+1)).
  'shop/review'(s, { venue, stars, reason } = {}, ev) {
    if (!own(VENUES, venue)) return fail('unknown');
    if (!D.venueOpen(s, venue)) return fail('locked');
    const n0 = Number(stars);
    if (typeof stars !== 'number' || !Number.isFinite(n0)) return fail('unknown');
    const st = Math.min(5, Math.max(1, Math.round(n0)));
    const rt = streetOf(D.region(s)).rating[venue];
    const w = Math.max(RATING.minWeight, 1 / (rt.n + 1));
    rt.avg = Math.round(Math.min(5, Math.max(1, rt.avg + (st - rt.avg) * w)) * 100) / 100;
    rt.n++;
    s.stats.reviews = (s.stats.reviews || 0) + 1;
    const why = REVIEW_REASONS.includes(reason) ? reason : 'venue';
    ev.push({ type: 'reviewed', venue, stars: st, avg: rt.avg, reason: why });
  },

  // ---------- building ----------
  // Places a building, a decoration or a crop field (type 'field', Farm World 2.0). The k-th copy costs more
  // (D.buildCost); fields are free inside the allowance of the field lots you own.
  'build/place'(s, { type, x, z, rot = 0 }, ev) {
    const err = D.buildError(s, type);
    if (err) return fail(err, err === 'coins' ? { missing: D.buildCost(s, type) - s.player.coins } : err === 'limit' ? { level: D.nextLimitLevel(s, type) } : undefined);
    const r4 = type === 'field' ? 0 : rot4(rot);
    const pos = D.snapPosition(type, Number(x), Number(z), r4);
    const perr = D.placementError(s, type, pos.x, pos.z, r4);
    if (perr) return fail(perr);
    const def = D.defOf(type), cost = D.buildCost(s, type), r = D.region(s);
    spend(s, cost);
    if (type === 'field') {
      const f = { id: uid(s, 'fd'), x: pos.x, z: pos.z };
      if (cost > 0) f.spent = cost; // a cleared extra bed: what it cost (net worth, refund basis)
      r.fields.push(f);
      if (firstBuildXp(r, 'field')) grantXp(s, FIELD.xp, ev);
      ev.push({ type: 'fieldPlaced', plotId: f.id, cost });
      return;
    }
    const b = { uid: uid(s, 'b'), type, x: pos.x, z: pos.z, rot: r4, level: 1, spent: cost };
    r.buildings.push(b);
    s.stats.built++;
    if (firstBuildXp(r, type)) grantXp(s, def.xp ?? XP.build, ev);
    ev.push({ type: 'built', uid: b.uid, building: type, cost });
  },
  // Moves a building or a field (a growing field keeps its crop: the crop is keyed by the field id).
  'build/move'(s, { uid: id, x, z, rot = 0 }, ev) {
    const r = D.region(s);
    const f = r?.fields?.find(v => v.id === id);
    if (f) {
      const pos = D.snapPosition('field', Number(x), Number(z), 0);
      const perr = D.placementError(s, 'field', pos.x, pos.z, 0, f.id);
      if (perr) return fail(perr);
      if (pos.x === f.x && pos.z === f.z) return { noop: true };
      Object.assign(f, { x: pos.x, z: pos.z });
      ev.push({ type: 'moved', uid: f.id, field: true });
      return;
    }
    const b = r?.buildings.find(v => v.uid === id);
    if (!b) return fail('unknown');
    if (BUILDINGS[b.type].fixed) return fail('fixed');
    const r4 = rot4(rot);
    const pos = D.snapPosition(b.type, Number(x), Number(z), r4);
    const perr = D.placementError(s, b.type, pos.x, pos.z, r4, b.uid);
    if (perr) return fail(perr);
    Object.assign(b, { x: pos.x, z: pos.z, rot: r4 });
    ev.push({ type: 'moved', uid: b.uid });
  },
  // Removes a building (refund = def.refund × coins spent on it) or an empty field (refund = D.fieldRefund).
  // Never starters / fixed, never while a batch runs or waits, never a barn whose room is in use.
  'build/remove'(s, { uid: id } = {}, ev) {
    const err = D.removeError(s, id);
    if (err) return fail(err);
    const r = D.region(s), refund = D.removeRefund(s, id);
    const fi = r.fields.findIndex(f => f.id === id);
    if (fi >= 0) { r.fields.splice(fi, 1); delete r.plots[id]; }
    else { const bi = r.buildings.findIndex(b => b.uid === id); ev.push({ type: 'removedBuilding', building: r.buildings[bi].type }); r.buildings.splice(bi, 1); }
    if (refund > 0) s.player.coins = Math.round((s.player.coins + refund) * 100) / 100; // a refund is not income (no XP, no loan cut)
    ev.push({ type: 'removed', uid: id, field: fi >= 0, refund });
  },
  'build/upgrade'(s, { uid: id }, ev) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.upgradeError(s, b);
    if (err) return fail(err, err === 'coins' ? { missing: D.upgradeCost(b.type, b.level) - s.player.coins } : undefined);
    const cost = D.upgradeCost(b.type, b.level);
    b.spent = D.spentOn(b) + cost;
    spend(s, cost);
    b.level++;
    s.stats.upgraded++;
    grantXp(s, XP.upgrade, ev);
    ev.push({ type: 'upgraded', uid: b.uid, building: b.type, level: b.level, cost });
  },

  // ---------- production (Farm World 2.0, docs/farm-world-2.0/FARM-ECONOMY-BALANCE.md) ----------
  // Starts one batch: takes the inputs and the fuel fee now; the duration, outputs and XP are fixed at the start
  // (an upgrade later never changes a running batch). One batch per building; duplicates run in parallel.
  'prod/start'(s, { uid: id, by = null } = {}, ev, ctx) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.prodError(s, b);
    if (err) {
      const miss = err === 'noInput' ? D.missingInput(s, b) : null;
      return fail(err, miss ? { need: miss.good, amount: miss.need, have: miss.have } : err === 'coins' ? { missing: D.recipeIO(b).fee - s.player.coins } : undefined);
    }
    const io = D.recipeIOFor(s, b); // with the pulper's speed and fee
    let premium = 0; // specialty batch: dearer varieties in it pay their premium on collect (RECIPES[].premium)
    for (const [good, n] of Object.entries(io.in)) {
      const took = addGood(s, good, -n, { skipRaw: true });
      if (took && RECIPES[io.recipe]?.premium) for (const [c, k] of Object.entries(took)) premium += k * Math.max(0, D.beanPrice(c) - GOODS.beans.price) * RECIPES[io.recipe].premium;
    }
    if (io.fee > 0) spend(s, io.fee);
    b.job = { recipe: io.recipe, at: ctx.now, ms: io.ms, out: io.out, xp: io.xp };
    if (by != null) practice(D.unitOf(s, by), 'process', ctx.now);
    premium *= by != null ? premiumMulOf(D.unitOf(s, by)) : 1; // a careful processor keeps more of the specialty value
    if (premium > 0) b.job.premium = Math.round(premium * 100) / 100;
    s.stats.batches = (s.stats.batches || 0) + 1;
    ev.push({ type: 'prodStarted', uid: b.uid, building: b.type, recipe: io.recipe, in: io.in, fee: io.fee, ms: io.ms });
  },
  // Collects a finished batch into the storehouse (soft cap like harvest: refused only when storage is already full).
  'prod/collect'(s, { uid: id } = {}, ev, ctx) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.collectError(s, b, ctx.now);
    if (err) return fail(err, err === 'notDone' ? { remainingMs: b.job.at + b.job.ms - ctx.now } : err === 'storageFull' ? { capacity: D.capacity(s) } : undefined);
    const { out, xp, recipe, premium } = b.job;
    for (const [good, n] of Object.entries(out || {})) if (own(GOODS, good)) addGood(s, good, n);
    if (premium > 0) { earn(s, premium, ev); ev.push({ type: 'specialtyBonus', uid: b.uid, coins: premium }); }
    delete b.job;
    s.stats.produced = (s.stats.produced || 0) + 1;
    grantXp(s, xp || 0, ev);
    ev.push({ type: 'prodCollected', uid: b.uid, building: b.type, recipe, out, xp: xp || 0 });
  },

  // ---------- land ----------
  // Estates (land-ui-simplify §2A): any lot id buys its whole estate (UI, manager and sim keep sending a lot id).
  'land/buyParcel'(s, { parcelId }, ev) {
    const err = D.parcelError(s, parcelId);
    if (err === 'owned') return { noop: true };
    const est = estateOfLot(parcelId), cost = D.parcelCost(parcelId);
    if (err) return fail(err, err === 'coins' ? { missing: cost - s.player.coins } : err === 'level' ? { level: est?.level } : undefined);
    const before = new Set(D.openRoads(s)), r = D.region(s);
    spend(s, cost);
    for (const id of est ? est.lots : [parcelId]) if (!r.parcels.includes(id)) r.parcels.push(id);
    const seed = est?.seed || parcelId;
    const before0 = (r.fields || []).length;
    if (est) autoTill(s, ev); else addPreTilled(r, seed); // estate: free-field credits, placed anywhere by the player
    const fields = (r.fields || []).length - before0;
    s.stats.parcels++;
    grantXp(s, XP.buyLand, ev);
    ev.push({ type: 'parcelBought', parcelId: seed, estate: est?.id || null, cost, fields });
    const opened = D.openRoads(s).filter(id => !before.has(id));
    if (opened.length) ev.push({ type: 'roadsOpened', parcelId, roads: opened }); // the farm paths grow with the land
  },
  // Sells a lot (management-rules §2.5 / §3.6; the manager only proposes it as an inbox task): LAND.sellRefund × its
  // price back (a refund, not income). Never a starter lot, the last lot of its kind or a lot with a building; its
  // fields and what grows on them go with it.
  'land/sell'(s, { parcelId } = {}, ev) {
    const err = D.landSellError(s, parcelId);
    if (err) return fail(err);
    const r = D.region(s), refund = D.landSellRefund(parcelId), lot = PARCELS[parcelId];
    const gone = D.ownedPlots(s).filter(p => p.parcel === parcelId).map(p => p.id);
    r.parcels = r.parcels.filter(x => x !== parcelId);
    r.fields = (r.fields || []).filter(f => !gone.includes(f.id));
    for (const id of gone) delete r.plots[id];
    if (s.gm?.plan?.crops) delete s.gm.plan.crops[parcelId];
    if (refund > 0) s.player.coins = r2(s.player.coins + refund);
    hist(s, { type: 'landSold', actor: ACTOR, subject: parcelId, gain: refund || undefined, extra: { lot: parcelId, fields: gone.length, price: lot.cost } });
    ev.push({ type: 'parcelSold', parcelId, refund, fields: gone.length });
  },
  'land/openRoad'(s, { roadId }, ev) {
    const err = D.roadError(s, roadId);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: ROADS[roadId].cost - s.player.coins } : undefined);
    spend(s, ROADS[roadId].cost);
    D.region(s).roads.push(roadId);
    grantXp(s, XP.openRoad, ev);
    ev.push({ type: 'roadOpened', roadId, cost: ROADS[roadId].cost });
  },

  // ---------- staff (docs/design/staff-manager.md) ----------
  // Hiring cap: D.hireCap (hireLimit in economy.js); err hireLimit { level: the level that allows one more }.
  // A new unit joins the current region's zone, on shift when a working slot is free, else on the bench (bench workers cost upkeep).
  'staff/hire'(s, { type }, ev, ctx) {
    const err = D.staffError(s, type);
    if (err) return fail(err, err === 'coins' ? { missing: STAFF[type].cost - s.player.coins } : err === 'hireLimit' ? { level: D.nextHireLevel(s, STAFF[type].zone) } : undefined);
    const ticket = D.freeHire(s);
    if (ticket) s.rewards.tickets--; else spend(s, STAFF[type].cost);
    const unit = makeUnit(s, { type, paid: ticket ? 0 : STAFF[type].cost }, ctx.now);
    ledger(s, ctx.now, 'spent', unit.paid, 'hire', STAFF[unit.type].zone);
    grantXp(s, XP.hire, ev);
    journal(s, ctx.now, 'hired', unit, { paid: unit.paid });
    ev.push({ type: 'hired', uid: unit.uid, staff: type, assigned: !!unit.assigned, active: unit.active, free: ticket });
  },
  // Hires applicant `index` from the zone's board (trait + name + rare perk kept on the unit), then draws a new board.
  'staff/recruit'(s, { zone, index }, ev, ctx) {
    const err = D.recruitError(s, zone, index);
    const a = D.applicants(s, zone)[index];
    if (err) return fail(err, err === 'coins' ? { missing: a.cost - s.player.coins } : err === 'hireLimit' ? { level: D.nextHireLevel(s, zone) } : undefined);
    const ticket = D.freeHire(s);
    if (ticket) s.rewards.tickets--; else spend(s, a.cost);
    const unit = makeUnit(s, { type: a.type, trait: a.trait, name: a.name, gender: a.gender, perk: a.perk, age: a.age, home: a.home, hobbies: a.hobbies, paid: ticket ? 0 : a.cost }, ctx.now);
    ledger(s, ctx.now, 'spent', unit.paid, 'hire', STAFF[unit.type].zone);
    const pool = D.poolOf(s, zone);
    s.staff.pool ||= {};
    s.staff.pool[zone] = { seed: (Math.imul(pool.seed ^ s.nextUid, 0x9e3779b1) >>> 1) | 0, at: ctx.now };
    grantXp(s, XP.hire, ev);
    journal(s, ctx.now, 'hired', unit, { paid: unit.paid });
    ev.push({ type: 'hired', uid: unit.uid, staff: a.type, name: a.name, trait: a.trait, perk: a.perk || null, assigned: !!unit.assigned, active: unit.active, free: ticket });
  },
  // New applicants: free once RECRUIT.refreshMinutes have passed, otherwise for RECRUIT.refreshCost coins (`paid`).
  'staff/refreshPool'(s, { zone, roll = 0, paid = false }, ev, ctx) {
    if (!RECRUIT.worker[zone]) return fail('unknown');
    const due = D.poolRefreshIn(s, zone, ctx.now) <= 0;
    if (!due && !paid) return fail('tooSoon');
    if (!due) { if (s.player.coins < RECRUIT.refreshCost) return fail('coins', { missing: RECRUIT.refreshCost - s.player.coins }); spend(s, RECRUIT.refreshCost); }
    s.staff.pool ||= {};
    s.staff.pool[zone] = { seed: Math.floor(Math.min(.999999, Math.max(0, Number(roll) || 0)) * 2147483647), at: ctx.now };
    ev.push({ type: 'poolRefreshed', zone, paid: !due });
  },
  // On shift / bench (§1). Going on shift needs a free working slot in the unit's zone here.
  'staff/setActive'(s, { uid: id, active }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit || unit.assigned?.regionId !== s.world.currentRegion) return fail('unknown');
    const on = active === true;
    if (!!unit.active === on) return { noop: true };
    if (on && D.freeSlots(s, unit.assigned.zone) <= 0) return fail('slotsFull', { slots: D.slots(s, unit.assigned.zone) });
    unit.active = on;
    journal(s, ctx.now, on ? 'activated' : 'benched', unit);
    ev.push({ type: 'staffActive', uid: id, active: on });
  },
  // "Đổi ca": tired / hungry / sulking (or low-energy) workers go to the bench, the best rested bench workers (highest
  // level first) take the free slots. Robots are never touched.
  'staff/swapShift'(s, { zone }, ev, ctx) {
    if (!RECRUIT.worker[zone]) return fail('unknown');
    const here = D.assignedUnits(s, s.world.currentRegion, zone).filter(u => STAFF[u.type].kind === 'worker');
    const worn = u => (u.energy ?? 100) < SHIFT.tiredBelow || D.unitBlocked(u, ctx.now) || ['tired', 'hungry', 'sulking'].includes(D.unitState(u, ctx.now));
    const out = here.filter(u => u.active && worn(u));
    for (const u of out) { u.active = false; journal(s, ctx.now, 'benched', u); }
    const rested = here.filter(u => !u.active && !out.includes(u) && (u.energy ?? 100) >= SHIFT.restedFrom && !worn(u))
      .sort((a, b) => unitLevel(b) - unitLevel(a) || uidNum(a) - uidNum(b));
    const inn = rested.slice(0, D.freeSlots(s, zone));
    for (const u of inn) { u.active = true; journal(s, ctx.now, 'activated', u); }
    if (!out.length && !inn.length) return { noop: true };
    ev.push({ type: 'shiftSwapped', zone, out: out.map(u => u.uid), in: inn.map(u => u.uid) });
  },
  // Bench upkeep (§2), dispatched by the realm about every minute while playing. The first call only starts the clock;
  // a long gap (offline) is charged for at most UPKEEP.maxCatchUpMinutes. A worker the player cannot pay loses morale
  // instead (no debt) and leaves when it reaches 0.
  'staff/upkeep'(s, _p, ev, ctx) {
    if (!s.staff.upkeepAt) { s.staff.upkeepAt = ctx.now; return; }
    const mins = Math.min(UPKEEP.maxCatchUpMinutes, Math.max(0, (ctx.now - s.staff.upkeepAt) / 60000));
    if (mins <= 0) return { noop: true };
    s.staff.upkeepAt = ctx.now;
    const k = mins / UPKEEP.perMinutes;
    let paid = 0;
    const unpaid = [], robots = [];
    // Each unit is paid by the city it works in; a city that cannot pay never draws on another's Gold.
    const payUnit = u => {
      const share = r2(D.upkeepOf(u) * k);
      if (!(share > 0)) return;
      if (s.player.coins >= share) { spend(s, share); unitSpent(s, u, share, ctx.now, u.follower || u.active ? 'wage' : 'upkeep'); paid += share; return; }
      if (u.follower) { // it followed you: what you cannot pay is owed as wage arrears (founder: "cho nợ"), never a loan
        const part = Math.floor(s.player.coins * 100) / 100;
        if (part > 0) { spend(s, part); unitSpent(s, u, part, ctx.now, 'wage'); paid += part; }
        const w = ((s.debt ||= { wages: { gm: 0, follower: 0 } }).wages ||= { gm: 0, follower: 0 });
        w.follower = r2((w.follower || 0) + share - part);
        ev.push({ type: 'followerDebt', uid: u.uid, coins: r2(share - part), owed: w.follower });
        if (w.follower >= D.followerQuitArrears(u)) { w.follower = 0; removeUnit(s, u, ctx.now, 'unpaid', ev); } // DEBT.wageCapMul wages unpaid: it leaves
        return;
      }
      if (STAFF[u.type].kind === 'robot') { robots.push(u.uid); return; } // standby unpaid: a robot has no morale to lose
      u.morale = r2(clampN((u.morale ?? VITALS.start.morale) - UPKEEP.unpaidMorale * k, 0, 100));
      unpaid.push(u.uid);
      if (u.morale <= 0) removeUnit(s, u, ctx.now, 'unpaid', ev);
    };
    for (const u of [...s.staff.units].sort((a, b) => uidNum(a) - uidNum(b))) onWallet(s, u.assigned?.regionId, () => payUnit(u));
    ev.push({ type: 'upkeepPaid', coins: r2(paid), unpaid, ...(robots.length ? { unpaidRobots: robots } : {}), minutes: r2(mins) });
  },
  // Vitals (§3 workers, §4 robots), batched by the realm every few seconds per unit: `work` / `rest` seconds (each
  // clamped to VITALS.maxBatchSeconds), robots also `jobs` finished. A stopped / benched / lunching unit cannot work,
  // so its work time counts as rest. Expired timers (lunch, overheat cool-down) are cleared here.
  'staff/vitals'(s, { uid: id, work = 0, rest = 0, jobs = 0 }, ev, ctx) {
    const u = D.unitOf(s, id);
    if (!u) return fail('unknown');
    const sec = v => clampN(Number(v) || 0, 0, VITALS.maxBatchSeconds);
    let w = sec(work), r = sec(rest);
    const n = clampN(Math.floor(Number(jobs) || 0), 0, 20);
    const before = D.unitState(u, ctx.now);
    let cleared = false;
    if (Number.isFinite(u.breakUntil) && ctx.now >= u.breakUntil) { delete u.breakUntil; cleared = true; }
    if (u.stopped?.kind === 'overheat' && Number.isFinite(u.stopped.until) && ctx.now >= u.stopped.until) {
      delete u.stopped; cleared = true;
      ev.push({ type: 'staffResumed', uid: id, kind: 'overheat', fee: 0 });
    }
    if (!w && !r && !n && !cleared) return { noop: true };
    // Profile: time on shift (here, active), time actually on a job, time lost to a blocking state (lunch excluded).
    const onShift = u.active && u.assigned?.regionId === s.world.currentRegion;
    const shiftS = onShift ? w + r : 0, downS = shiftS && before !== 'lunch' && D.unitBlocked(u, ctx.now) ? shiftS : 0;
    if (u.stopped || Number.isFinite(u.breakUntil) || !u.active) { r += w; w = 0; }
    if (shiftS) { const d = dayOf(u, ctx.now); d.shift = r2(d.shift + shiftS); d.work = r2(d.work + w); d.down = r2(d.down + downS); }
    if (STAFF[u.type].kind === 'worker') {
      const drain = (u.perk === 'tireless' ? RARE.tirelessDrain : 1) * gearDrain(u); // hat / apron: slower drain
      const restMul = u.active ? 1 : VITALS.benchRestMul;
      u.energy = r2(clampN((u.energy ?? 100) - w / 60 * VITALS.energyDrainPerMin * drain + r / 60 * VITALS.energyRestPerMin * restMul, 0, energyMax(u)));
      const hunger = statOf(u, 'stamina') >= VITALS.staminaHungerFrom ? VITALS.staminaHungerMul : 1;
      u.fullness = r2(clampN((u.fullness ?? 100) - w / 60 * VITALS.hungerPerMin * hunger, 0, 100));
      let morale = u.morale ?? VITALS.start.morale;
      if (u.energy <= 0) morale -= w / 60 * VITALS.moraleOverworkPerMin; // working while exhausted sours the mood
      if (u.trait === 'funny') morale += (w + r) / 60 * VITALS.funnyMoraleRegenPerMin;
      // Chaos after a poached GM: spirits sink (half as fast with a Manager-rank worker in the zone).
      if (onShift && s.gm?.chaos) morale -= (w + r) / 60 * GM.chaos.moralePerMin;
      const stance = onShift && STAFF[u.type].zone === 'farm' ? stanceEffects(D.stanceOf(s)) : null; // Heart–Reason slider
      if (stance) morale += (w + r) / 60 * stance.moralePerMin;
      u.morale = r2(clampN(morale, 0, 100));
      if (stance?.quits && u.morale < VITALS.sulkBelow) { removeUnit(s, u, ctx.now, 'stress', ev); return; }
    } else {
      u.heat = r2(clampN((u.heat || 0) + w / 60 * heatPerMin(u) - r / 60 * ROBOT_WEAR.coolPerMin, 0, 100));
      u.wear = r2(clampN((u.wear ?? 100) - n * ROBOT_WEAR.wearPerJob * ROBOT_PARTS.frame.wearMul[partTier(u, 'frame')], 0, 100));
      if (u.heat >= 100 && !u.stopped) {
        u.stopped = { kind: 'overheat', at: ctx.now, until: ctx.now + ROBOT_WEAR.overheatSeconds * 1000, fee: CARE.cool };
        journal(s, ctx.now, 'overheat', u);
        ev.push({ type: 'staffStopped', uid: id, kind: 'overheat', fee: CARE.cool });
      }
    }
    const after = D.unitState(u, ctx.now);
    if (after !== before) ev.push({ type: 'staffState', uid: id, from: before, to: after });
  },
  // A robot jammed on a finished job (the realm rolls D.jamChance per job): stopped until knocked (free) or repaired.
  'staff/jam'(s, { uid: id }, ev, ctx) {
    const u = D.unitOf(s, id);
    if (!u || STAFF[u.type].kind !== 'robot') return fail('unknown');
    if (u.stopped) return { noop: true };
    u.stopped = { kind: 'jam', at: ctx.now, fee: CARE.repair };
    journal(s, ctx.now, 'jam', u);
    ev.push({ type: 'staffStopped', uid: id, kind: 'jam', fee: CARE.repair });
  },
  // A new health exam, once the certificate has run out (CHECKUP).
  'staff/checkup'(s, { uid: id }, ev, ctx) {
    const u = D.unitOf(s, id);
    if (!u || STAFF[u.type].kind !== 'worker') return fail('unknown');
    if (!D.checkupOf(u)?.expired) return { noop: true };
    if (s.player.coins < CHECKUP.cost) return fail('coins', { missing: Math.ceil(CHECKUP.cost - s.player.coins) });
    spend(s, CHECKUP.cost);
    u.checkup = { at: ctx.now, atTenure: u.tenurePlayedMin || 0, grade: checkupGrade(u) };
    ev.push({ type: 'staffCheckup', uid: id, name: u.name || null, grade: u.checkup.grade, coins: CHECKUP.cost });
  },
  // Care (§3): one fix per problem, free or paid (CARE). `roll` decides whether nagging works.
  // by: the zone's manager bought it (realm, CAREER.manager) — journaled as the manager's doing.
  'staff/care'(s, { uid: id, kind, roll = 0, by = null }, ev, ctx) {
    const u = D.unitOf(s, id);
    const err = D.careError(s, u, kind, ctx.now);
    if (err) return fail(err, err === 'coins' ? { missing: D.careCost(u, kind) - s.player.coins } : undefined);
    const cost = D.careCost(u, kind);
    if (cost > 0) { spend(s, cost); unitSpent(s, u, cost, ctx.now); }
    if (kind === 'repair' && D.warrantyLeft(u) > 0) { u.warrantyUsed = (u.warrantyUsed | 0) + 1; note(u, ctx.now, 'warranty', { left: D.warrantyLeft(u) }); }
    const stopKind = u.stopped?.kind || null;
    const unstop = () => { delete u.stopped; ev.push({ type: 'staffResumed', uid: id, kind: stopKind, fee: cost }); };
    let ok = true;
    switch (kind) {
      case 'nag':
        ok = (Number(roll) || 0) < CARE.nagChance;
        if (ok) unstop();
        u.morale = r2(clampN((u.morale ?? VITALS.start.morale) - CARE.nagMorale, 0, 100)); // nagging always stings
        break;
      case 'settle': case 'bonusSmall': case 'recharge': case 'knock': case 'repair': unstop(); break;
      case 'coffee': u.energy = r2(Math.min(energyMax(u), (u.energy ?? 0) + CARE.coffeeEnergy)); break;
      case 'food': u.fullness = 100; break;
      case 'lunch': u.breakUntil = ctx.now + CARE.lunchSeconds * 1000; u.fullness = 100; break;
      case 'bonus': u.morale = r2(Math.min(100, (u.morale ?? VITALS.start.morale) + CARE.bonusMorale)); break;
      case 'rest': u.active = false; journal(s, ctx.now, 'benched', u); break;
      case 'cool': u.heat = 0; unstop(); break;
      case 'service': u.wear = 100; break;
    }
    const boss = by != null ? D.unitOf(s, by) : null;
    if (boss && boss.uid === u.uid && STAFF[u.type].kind === 'robot') journal(s, ctx.now, 'autoCare', u, kind); // a software pack did it
    else journal(s, ctx.now, kind === 'nag' ? 'nagged' : 'cared', u, kind === 'nag' ? { ok } : kind);
    ev.push({ type: 'staffCared', uid: id, kind, cost, ok });
  },
  // Finished jobs (batched by the realm): the unit's book counts them; a worker also gets XP (× trait) and every
  // SKILL.xpPerPoint XP turns into a skill point (banked without a cap). Robots never learn.
  // task: the job type (harvest / plant / … ) for the history row; jobs fold into one row per unit per
  // HISTORY.workBatchSec played seconds («thu hoạch ×12», management-rules §5).
  'staff/workDone'(s, { uid: id, n = 1, task = null }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit) return fail('unknown');
    const k = Math.max(1, Math.min(20, n | 0));
    tally(unit, ctx.now, 'jobs', k);
    histDay(s, 'staff').jobs += k;
    workRow(s, unit, k, typeof task === 'string' && task.length <= 16 ? task : null, ctx.now);
    if (STAFF[unit.type].kind !== 'worker') return;
    let xp = r2((unit.xp || 0) + k * (TRAITS[unit.trait]?.xpMul ?? 1)), gained = 0;
    while (xp >= SKILL.xpPerPoint) { xp = r2(xp - SKILL.xpPerPoint); gained++; }
    unit.xp = xp;
    unit.points = (unit.points || 0) + gained;
    if (gained) ev.push({ type: 'staffReady', uid: id, name: unit.name || null, staff: unit.type, points: unit.points });
  },
  // Per-stat upgrade (§5): stat n → n+1 costs n points + SKILL.coinPerLevel × n coins.
  'staff/upgradeStat'(s, { uid: id, stat }, ev, ctx) {
    const unit = D.unitOf(s, id);
    const err = D.statError(s, unit, stat);
    if (err) {
      const c = unit && STAT_ORDER.includes(stat) ? statCostOf(unit, statOf(unit, stat), stat) : null;
      return fail(err, err === 'coins' ? { missing: c.coins - s.player.coins } : err === 'points' ? { need: c.points, have: unit.points || 0 } : undefined);
    }
    const n = statOf(unit, stat), c = statCostOf(unit, n, stat);
    spend(s, c.coins);
    unit.points -= c.points;
    unit.stats = { ...Object.fromEntries(STAT_ORDER.map(k => [k, statOf(unit, k)])), [stat]: n + 1 };
    delete unit.level;
    unitSpent(s, unit, c.coins, ctx.now, 'upgrade');
    journal(s, ctx.now, 'upgraded', unit, { stat, to: n + 1 });
    ev.push({ type: 'statUpgraded', uid: id, stat, to: n + 1, coins: c.coins, points: c.points, name: unit.name || null, staff: unit.type });
  },
  // Old single-level training, kept for older callers: raises `stat` (default: the lowest stat that can go up now).
  'staff/train'(s, { uid: id, stat }, ev, ctx) {
    const unit = D.unitOf(s, id);
    const err = D.trainError(s, unit);
    if (err === 'maxLevel') return { noop: true };
    if (stat == null && err) return fail(err);
    const pick = stat ?? [...STAT_ORDER].sort((a, b) => statOf(unit, a) - statOf(unit, b)).find(k => !D.statError(s, unit, k));
    return handlers['staff/upgradeStat'](s, { uid: id, stat: pick }, ev, ctx);
  },
  // One watered plot (by a waterer / RainBot): it ripens TEND.speedup × its grow time sooner; once per planting.
  'farm/water'(s, { plotId, uid: id }, ev, ctx) {
    const unit = id != null ? D.unitOf(s, id) : null, r = D.region(s); // no uid = the player waters it by hand
    const pl = r && D.own(r.plots, plotId);
    if (!pl || (id != null && !doesJob(unit, 'water'))) return fail('unknown');
    if (pl.watered || D.dripCovers(s, plotId) || D.plotState(s, plotId, ctx.now).stage === 'ready') return { noop: true };
    pl.plantedAt -= Math.round(D.plotGrowMs(s, pl) * waterSpeedupOf(unit));
    pl.watered = true;
    if (unit) practice(unit, 'water', ctx.now);
    ev.push({ type: 'watered', plotId, uid: id });
  },
  // A robot's one task: 'auto' or one of ROBOT_TASKS[type]. Free, any time. A worker given one task here = setTasks.
  'staff/setTask'(s, { uid: id, task }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (unit && STAFF[unit.type]?.kind === 'worker') return handlers['staff/setTasks'](s, { uid: id, tasks: task === 'auto' ? [] : [task] }, ev, ctx);
    if (D.taskError(unit, task)) return fail('unknown');
    if ((unit.task || 'auto') === task) return { noop: true };
    unit.task = task;
    hist(s, { type: 'robotTask', actor: ACTOR === 'staff' ? id : ACTOR, subject: id, extra: { task }, zone: STAFF[unit.type].zone });
    ev.push({ type: 'taskSet', uid: id, task });
  },
  // A worker's job types (§6): [] = auto; at most taskLimit (1, 2 from smart 3).
  'staff/setTasks'(s, { uid: id, tasks }, ev) {
    const unit = D.unitOf(s, id);
    const list = Array.isArray(tasks) ? [...new Set(tasks)] : null;
    const err = D.tasksError(unit, list);
    if (err) return fail(err, err === 'tooMany' ? { max: taskLimit(unit) } : undefined);
    const now = unit.tasks || [];
    if (now.length === list.length && now.every((t, i) => t === list[i])) return { noop: true };
    unit.tasks = list;
    hist(s, { type: 'setTasks', actor: ACTOR === 'staff' ? id : ACTOR, subject: id, extra: { tasks: list }, zone: STAFF[unit.type].zone });
    ev.push({ type: 'tasksSet', uid: id, tasks: list });
  },
  // Robot hardware: battery (longer work, cheaper recharge), motor (faster, hotter), cooler (less heat), frame (fewer
  // jams, slower wear). What was spent is remembered for the sell refund.
  'staff/upgradePart'(s, { uid: id, part }, ev, ctx) {
    const unit = D.unitOf(s, id);
    const err = D.partError(s, unit, part);
    if (err === 'maxLevel') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: D.partPrice(unit, part) - s.player.coins } : err === 'level' ? { level: PART_COST.tier3Level } : undefined);
    const price = D.partPrice(unit, part);
    spend(s, price);
    unit.parts = { battery: 0, motor: 0, cooler: 0, frame: 0, ...unit.parts, [part]: (unit.parts?.[part] | 0) + 1 };
    unit.partsSpent = (unit.partsSpent || 0) + price;
    unitSpent(s, unit, price, ctx.now, 'upgrade'); // an investment, not a running cost
    note(unit, ctx.now, 'part', { part, tier: unit.parts[part], coins: price });
    ev.push({ type: 'partUpgraded', uid: id, part, tier: unit.parts[part] });
  },
  // Moves a unit to the current region (on shift when a slot is free, else benched).
  'staff/assign'(s, { uid: id }, ev) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit || !D.region(s)) return fail('unknown');
    const zone = STAFF[unit.type].zone;
    if (unit.assigned?.regionId === s.world.currentRegion) return { noop: true };
    unit.assigned = { regionId: s.world.currentRegion, zone };
    unit.active = false;
    unit.active = D.freeSlots(s, zone) > 0;
    ev.push({ type: 'assigned', uid: id, zone, active: unit.active });
  },
  // A unit stops working: worker slacks on the phone (kind 'phone'), robot runs out of battery (kind 'battery').
  // Triggered by the realm's staff simulation; persisted so a reload keeps it stopped.
  'staff/stop'(s, { uid: id }, ev, ctx) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit || !STAFF[unit.type]) return fail('unknown');
    if (unit.stopped) return { noop: true };
    const kind = STAFF_BREAKS[STAFF[unit.type].kind].kind;
    unit.stopped = { kind, at: ctx.now, fee: unitFee(unit) };
    if (kind === 'phone') journal(s, ctx.now, 'slacked', unit);
    ev.push({ type: 'staffStopped', uid: id, kind, fee: unit.stopped.fee });
  },
  // Player taps the coin bubble: pay the fee, the unit works again (robot recharged / worker back to work).
  // A funny incident (FUNNY): work stops until someone pays staff/care settle or fires the unit.
  'staff/funny'(s, { uid: id, incident } = {}, ev, ctx) {
    const unit = D.unitOf(s, id), level = unit ? funnyLevel(unit, incident) : null;
    if (level == null) return fail('unknown');
    if (unit.stopped) return { noop: true };
    const fee = Math.max(1, Math.round(funnyFee(unit, level) * gmHaggleMul(D.gmOf(s))));
    unit.stopped = { kind: 'funny', id: incident, level, at: ctx.now, fee };
    journal(s, ctx.now, 'funny', unit, { id: incident, level });
    ev.push({ type: 'staffStopped', uid: id, kind: 'funny', fee });
  },
  // Call a unit that wandered off straight back to work (the realm ends its walk).
  'staff/recall'(s, { uid: id } = {}, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit) return fail('unknown');
    const fee = goofFee(unit, D.gmOf(s));
    if (s.player.coins < fee) return fail('coins', { missing: fee - s.player.coins });
    spend(s, fee);
    unitSpent(s, unit, fee, ctx.now);
    ev.push({ type: 'staffRecalled', uid: id, fee });
  },
  'staff/resume'(s, { uid: id }, ev, ctx) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit) return fail('unknown');
    if (!unit.stopped) return { noop: true };
    const fee = unit.stopped.fee ?? unitFee(unit);
    if (s.player.coins < fee) return fail('coins', { missing: fee - s.player.coins });
    spend(s, fee);
    unitSpent(s, unit, fee, ctx.now);
    const kind = unit.stopped.kind;
    if (kind === 'overheat') unit.heat = 0;
    delete unit.stopped;
    note(unit, ctx.now, 'cared', kind === 'battery' ? 'recharge' : kind === 'overheat' ? 'cool' : kind === 'jam' ? 'repair' : 'bonusSmall');
    ev.push({ type: 'staffResumed', uid: id, kind, fee });
  },
  'staff/unassign'(s, { uid: id }, ev) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit) return fail('unknown');
    if (!unit.assigned) return { noop: true };
    unit.assigned = null;
    unit.active = false;
    ev.push({ type: 'unassigned', uid: id });
  },
  // A realm-only mistake (wrong table) counted in the unit's book. Spill / unripe / crooked count in their own actions.
  'staff/mistake'(s, { uid: id, kind }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit || !Object.hasOwn(MISTAKES.rates, kind)) return fail('unknown');
    tally(unit, ctx.now, 'mistakes', 1);
    histDay(s, 'staff').mistakes++;
    ev.push({ type: 'staffMistake', uid: id, kind });
  },
  // Fire a worker (FIRE.worker × hire price back) or sell a robot (FIRE.robot × price + FIRE.robotParts × hardware).
  // Staff board: one order for many units. Each op runs through its own handler (so its own rules and prices hold); a
  // unit that cannot take it is skipped, not fatal. One summary event: the board's toast speaks for all of them.
  'staff/bulk'(s, { ops } = {}, ev, ctx) {
    if (!Array.isArray(ops) || !ops.length || ops.length > STAFF_CAP.perZone * 2) return fail('unknown');
    const before = s.player.coins;
    let done = 0, skipped = 0;
    for (const op of ops) {
      const handler = BULK_ACTS.has(op?.type) ? handlers[op.type] : null, from = ev.length;
      const r = handler ? handler(s, op.payload || {}, ev, ctx) || {} : { ok: false };
      if (r.ok === false) { skipped++; ev.length = from; continue; }
      if (r.noop) continue;
      done++;
      for (let i = from; i < ev.length; i++) if (!GM_LOUD.has(ev[i].type)) ev[i].byGm = true; // quiet: no toast per person
    }
    if (!done) return skipped ? fail('bulkNone') : { noop: true };
    ev.push({ type: 'staffBulk', done, skipped, delta: r2(s.player.coins - before) });
  },
  'staff/fire'(s, { uid: id }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit) return fail('unknown');
    const refund = D.fireRefund(unit);
    if (refund > 0) s.player.coins = r2(s.player.coins + refund); // a refund is not income (no XP, no loan cut)
    // A worker you let go hands its gear in: it waits in the store for the next hire (poached / unpaid leavers take theirs).
    const zone = STAFF[unit.type].zone, kept = [];
    for (const [item, tier] of Object.entries(unit.gear || {})) if (tier > 0) kept.push({ zone, item, tier });
    if (kept.length) s.staff.gearStock = [...(s.staff.gearStock || []), ...kept].slice(-GEAR.stockKeep);
    removeUnit(s, unit, ctx.now, STAFF[unit.type].kind === 'robot' ? 'sold' : 'fired', ev, { refund, gear: kept.length });
  },
  // Worker gear (step 4): the next tier of one item (GEAR). An investment (category upgrade); half back on leaving.
  'staff/buyGear'(s, { uid: id, item }, ev, ctx) {
    const u = D.unitOf(s, id);
    const err = D.gearError(s, u, item);
    if (err === 'maxLevel') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: D.gearPrice(u, item) - s.player.coins } : undefined);
    const price = D.gearPrice(u, item);
    spend(s, price);
    u.gear = { ...(u.gear || {}), [item]: gearTier(u, item) + 1 };
    u.gearSpent = r2((u.gearSpent || 0) + price);
    unitSpent(s, u, price, ctx.now, 'upgrade');
    note(u, ctx.now, 'gear', { item, tier: u.gear[item], coins: price });
    ev.push({ type: 'gearBought', uid: id, item, tier: u.gear[item], coins: price });
  },
  // Give a worker gear from the store (free). Only an upgrade over what it wears; its old piece goes back to the store.
  'staff/equipGear'(s, { uid: id, index }, ev, ctx) {
    const u = D.unitOf(s, id), g = (s.staff.gearStock || [])[index];
    if (!u || !g || STAFF[u.type]?.kind !== 'worker' || STAFF[u.type].zone !== g.zone) return fail('unknown');
    const had = gearTier(u, g.item);
    if (g.tier <= had) return fail('notBetter');
    const stock = s.staff.gearStock.filter((_, i) => i !== index);
    if (had > 0) stock.push({ zone: g.zone, item: g.item, tier: had });
    s.staff.gearStock = stock;
    u.gear = { ...(u.gear || {}), [g.item]: g.tier };
    note(u, ctx.now, 'gear', { item: g.item, tier: g.tier, coins: 0, stock: true });
    ev.push({ type: 'gearEquipped', uid: id, item: g.item, tier: g.tier });
  },
  // Robot software pack (step 4): bought once; the robot still does one task and never learns.
  'staff/buySoftware'(s, { uid: id, pack }, ev, ctx) {
    const u = D.unitOf(s, id);
    const err = D.softwareError(s, u, pack);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: softwarePrice(u, pack) - s.player.coins } : undefined);
    const price = softwarePrice(u, pack);
    spend(s, price);
    u.software = [...(u.software || []), pack];
    u.softwareSpent = r2((u.softwareSpent || 0) + price);
    unitSpent(s, u, price, ctx.now, 'upgrade');
    note(u, ctx.now, 'software', { pack, coins: price });
    ev.push({ type: 'softwareBought', uid: id, pack, coins: price });
  },
  // MVP (§8, realm timer every BOOKS.mvpMinutes): the worker who earned the most since the last call; everyone cheers.
  'staff/mvp'(s, _p, ev, ctx) {
    let best = null, gain = 0;
    for (const u of s.staff.units) {
      const g = (u.book?.earned || 0) - (u.book?.mvpBase || 0);
      if (STAFF[u.type].kind === 'worker' && g > gain) { best = u; gain = g; }
    }
    if (!best) return { noop: true };
    // Reason side of the slider: a real reward for the best, a real punishment for whoever earned least.
    const stance = stanceEffects(D.stanceOf(s));
    if (stance.bonus > 0 && STAFF[best.type].zone === 'farm' && s.player.coins >= stance.bonus) {
      const tilt = stanceTiltOf(D.stanceOf(s)), S = FARM_MANAGER.stance, gainOf = u => (u.book?.earned || 0) - (u.book?.mvpBase || 0);
      const worst = D.assignedUnits(s, s.world.currentRegion, 'farm').filter(u => STAFF[u.type].kind === 'worker' && u.uid !== best.uid).sort((a, b) => gainOf(a) - gainOf(b))[0];
      spend(s, stance.bonus);
      best.morale = r2(Math.min(100, (best.morale ?? VITALS.start.morale) + S.mvpMorale * tilt));
      if (worst) worst.morale = r2(Math.max(0, (worst.morale ?? VITALS.start.morale) - S.worstMorale * tilt));
      ev.push({ type: 'staffDisciplined', best: best.name || null, worst: worst?.name || null, coins: stance.bonus });
    }
    for (const u of s.staff.units) if (u.book) u.book.mvpBase = u.book.earned;
    for (const u of s.staff.units) if (STAFF[u.type].kind === 'worker') u.morale = r2(Math.min(100, (u.morale ?? VITALS.start.morale) + BOOKS.mvpMorale));
    s.staff.mvp = { uid: best.uid, name: best.name || null, earned: r2(gain), at: ctx.now };
    note(best, ctx.now, 'mvp', { earned: r2(gain) });
    ev.push({ type: 'mvp', uid: best.uid, name: best.name || null, earned: r2(gain) });
  },

  // ---------- rivals (§7) ----------
  // A rival owner visits (realm timer every RIVAL.everyMinutes): with roll < chance they try to poach the
  // highest-level low-morale worker of the zone (else the best rare one). A happy worker (morale ≥ refuseMorale)
  // refuses; otherwise an inbox task (kind poach) gives the player TASKS.life.poach played minutes to keep them or let
  // them go (task/approve | task/deny, old staff/keep | staff/letGo).
  'rival/visit'(s, { zone, roll = 1 }, ev, ctx) {
    if (!RECRUIT.worker[zone]) return fail('unknown');
    if (D.workerPoach(s) || !((Number(roll) || 0) < RIVAL.chance) || D.tasksOpen(s).length >= TASKS.cap) return { noop: true };
    const pool = D.assignedUnits(s, s.world.currentRegion, zone).filter(u => STAFF[u.type].kind === 'worker');
    const best = list => [...list].sort((a, b) => unitLevel(b) - unitLevel(a) || uidNum(a) - uidNum(b))[0];
    // Low morale first, then a rare one.
    const target = best(pool.filter(u => (u.morale ?? VITALS.start.morale) < RIVAL.targetMorale)) || best(pool.filter(u => u.perk));
    if (!target) return { noop: true };
    const rival = RIVAL.names[zone];
    if ((target.morale ?? VITALS.start.morale) >= RIVAL.refuseMorale) {
      journal(s, ctx.now, 'poachRefused', target, rival);
      ev.push({ type: 'poachRefused', uid: target.uid, name: target.name || null, rival });
      return;
    }
    // The offer is an inbox task (kind poach, TASKS.life.poach played minutes): keep (its fee) or let go.
    const fee = RIVAL.keepFeePerLevel * unitLevel(target);
    const t = fileTask(s, ev, { kind: 'poach', key: `keep:${target.uid}`, by: 'system', act: { type: 'staff/keep', payload: { uid: target.uid } }, cost: fee,
      reason: ['keepWorker', { name: target.name || null }], zone });
    journal(s, ctx.now, 'poachStarted', target, rival);
    ev.push({ type: 'poachStarted', uid: target.uid, name: target.name || null, rival, fee, id: t.id, seconds: TASKS.life.poach * 60 });
  },
  // Old answers to a rival's offer, now aliases over the inbox (task/approve / task/deny of its poach task).
  'staff/keep'(s, { uid: id }, ev, ctx) {
    const t = D.tasksOpen(s).find(x => x.kind === 'poach' && x.act?.payload?.uid === id);
    if (!t || !D.unitOf(s, id)) return fail('unknown');
    return answerYes(s, t, {}, ev, ctx);
  },
  'staff/letGo'(s, { uid: id }, ev, ctx) {
    const t = D.tasksOpen(s).find(x => x.kind === 'poach' && x.act?.payload?.uid === id);
    if (!t || !D.unitOf(s, id)) return fail('unknown');
    return answerNo(s, t, ev, ctx);
  },
  // Time is up: the inbox's expiry (clock/tick) already sends the worker to the rival; kept as an alias that expires
  // whatever is due now.
  'rival/resolve'(s, _p, ev) {
    if (!expireDue(s, ev)) return { noop: true };
  },

  // ---------- research lab: the drink test bench (docs/design/research.md) ----------
  // One test: the base drink's beans + the ingredients' coins, then the bench is busy RESEARCH.testSeconds. Found →
  // the recipe goes into this country's book (XP, journal); otherwise the hints are kept (last RESEARCH.testsKeep).
  // Only you can run it: the general manager never does (docs/design/general-manager.md).
  'research/test'(s, { base, ings = [] }, ev, ctx) {
    const list = Array.isArray(ings) ? ings : [];
    const err = D.testError(s, base, list, ctx.now);
    if (err) return fail(err, err === 'busy' ? { seconds: Math.ceil(D.benchBusyIn(s, ctx.now) / 1000) } : err === 'coins' ? { missing: D.testCost(list) - s.player.coins } : undefined);
    const cc = D.countryNow(s);
    const cost = D.testCost(list, s);
    spend(s, cost);
    ledger(s, ctx.now, 'spent', cost, 'research', 'shop');
    takeBeans(s, DRINKS[base].beans);
    s.research ||= { known: {}, tests: {}, busyUntil: 0 };
    s.research.busyUntil = ctx.now + RESEARCH.testSeconds * 1000;
    const v = D.judgeTest(s, cc, base, list);
    if (v.result === 'found') {
      s.research.known[cc] = [...new Set([...(s.research.known[cc] || []), v.index])].sort((a, b) => a - b);
      grantXp(s, RESEARCH.xpFound, ev);
      ev.push({ type: 'recipeFound', cc, index: v.index, base });
    }
    const t = { at: ctx.now, base, ings: [...list].sort(), ...v };
    s.research.tests[cc] = [t, ...(s.research.tests[cc] || [])].slice(0, RESEARCH.testsKeep);
    ev.push({ type: 'recipeTested', cc, base, result: v.result, cost });
  },

  // ---------- research step 3: crop trial fields (docs/design/research.md) ----------
  // Plant one empty field your way (FARMLAB.trialFee + seeds); its harvest records yield, time and the star chance.
  'farmlab/trial'(s, { crop, method }, ev, ctx) {
    const err = D.trialError(s, crop, method);
    if (err) return fail(err, err === 'coins' ? { missing: FARMLAB.trialFee + D.seedCost(s, crop) - s.player.coins } : undefined);
    const field = D.trialField(s), rid = s.world.currentRegion;
    spend(s, FARMLAB.trialFee);
    ledger(s, ctx.now, 'spent', FARMLAB.trialFee, 'research', 'farm');
    const r = handlers['farm/plant'](s, { plotId: field.id, crop }, ev, ctx);
    if (r?.ok === false) { s.player.coins = r2(s.player.coins + FARMLAB.trialFee); return r; }
    const pl = D.region(s).plots[field.id];
    pl.method = [...method]; pl.trial = true;
    s.farmLab ||= { methods: {}, trials: {}, results: {} };
    (s.farmLab.trials[rid] ||= []).push({ plotId: field.id, crop, method: [...method], at: ctx.now });
    ev.push({ type: 'trialStarted', crop, plotId: field.id });
  },
  // Adopt a tested way (or the default) for a crop here: every planting from now on follows it.
  'farmlab/adopt'(s, { crop, method }, ev) {
    if (!CROPS[crop] || !Array.isArray(method)) return fail('unknown');
    const key = methodKey(method);
    if (key !== methodKey(FARMLAB.defaultMethod) && !D.trialResults(s, crop)[key]) return fail('untested');
    s.farmLab ||= { methods: {}, trials: {}, results: {} };
    ((s.farmLab.methods ||= {})[s.world.currentRegion] ||= {})[crop] = [...method];
    ev.push({ type: 'methodAdopted', crop, method });
  },

  // ---------- research step 2: suppliers and buyers (docs/design/research.md) ----------
  // Scout a group here (beans / milk / pantry / buyers): SUPPLY.scout coins, done after SUPPLY.scout.minutes real time;
  // one scout at a time. The finished one is counted at once (D.suppliersFound) and saved on the next supply action.
  'supply/scout'(s, { group }, ev, ctx) {
    settleSupply(s, ctx.now, ev);
    const rid = s.world.currentRegion, max = group === 'buyers' ? SUPPLY.buyers.count : SUPPLY.perGroup;
    if (!SUPPLY.groups[group] && group !== 'buyers') return fail('unknown');
    if (s.supply.scout) return fail('busy');
    if (D.suppliersFound(s, group, ctx.now) >= max) return fail('maxLevel');
    if (s.player.coins < SUPPLY.scout.cost) return fail('coins', { missing: SUPPLY.scout.cost - s.player.coins });
    spend(s, SUPPLY.scout.cost);
    ledger(s, ctx.now, 'spent', SUPPLY.scout.cost, 'research', D.gmZone(s));
    s.supply.scout = { regionId: rid, group, until: ctx.now + SUPPLY.scout.minutes * 60000 };
    ev.push({ type: 'scoutStarted', group });
  },
  // Sign supplier i of a group here for 1 or 7 real days (replaces the current contract).
  'supply/sign'(s, { group, i, days }, ev, ctx) {
    settleSupply(s, ctx.now, ev);
    if (!SUPPLY.groups[group] || !SUPPLY.contractDays[days]) return fail('unknown');
    if (!(Number.isInteger(i) && i >= 0 && i < D.suppliersFound(s, group, ctx.now))) return fail('unknown');
    const fee = D.contractFee(days);
    if (s.player.coins < fee) return fail('coins', { missing: fee - s.player.coins });
    spend(s, fee);
    ledger(s, ctx.now, 'spent', fee, 'research', 'shop');
    const rid = s.world.currentRegion;
    ((s.supply.contracts ||= {})[rid] ||= {})[group] = { i, until: ctx.now + days * 86400000, days };
    ev.push({ type: 'contractSigned', group, name: supplierOf(rid, group, i).name, days, fee });
  },
  // Farm: sell to buyer i (0 = the storehouse) at today's prices. Free; a lock in force stays until it ends.
  'supply/setBuyer'(s, { i }, ev, ctx) {
    settleSupply(s, ctx.now, ev);
    if (!(Number.isInteger(i) && i >= 0 && i <= D.suppliersFound(s, 'buyers', ctx.now))) return fail('unknown');
    const rid = s.world.currentRegion, b = (s.supply.buyer ||= {})[rid];
    if (b?.lockedUntil > ctx.now) return fail('locked');
    s.supply.buyer[rid] = { i };
    ev.push({ type: 'buyerSet', i });
  },
  // Lock buyer i's prices of today for 1–3 real days (fee per day).
  'supply/lockBuyer'(s, { i, days }, ev, ctx) {
    settleSupply(s, ctx.now, ev);
    const [lo, hi] = SUPPLY.buyers.lockDays;
    if (!(Number.isInteger(i) && i >= 1 && i <= D.suppliersFound(s, 'buyers', ctx.now)) || !(days >= lo && days <= hi)) return fail('unknown');
    const fee = SUPPLY.buyers.lockFee * days;
    if (s.player.coins < fee) return fail('coins', { missing: fee - s.player.coins });
    spend(s, fee);
    ledger(s, ctx.now, 'spent', fee, 'research', 'farm');
    const rid = s.world.currentRegion;
    (s.supply.buyer ||= {})[rid] = { i, lockedUntil: ctx.now + days * 86400000, mul: buyerOf(rid, i, D.dayKey(ctx.now)).mul };
    ev.push({ type: 'buyerLocked', i, days, fee });
  },

  // ---------- general manager (docs/design/general-manager.md) ----------
  // Hire candidate `index` from the headhunter board (fee = GM.hireFeePerSkill × skill). A new GM ends any chaos.
  'gm/hire'(s, { index }, ev, ctx) {
    if (!D.gmUnlocked(s)) return fail('level', { level: GM.unlockLevel });
    if (D.gmOf(s) && !D.autoManaged(s)) return fail('hasGm');
    const c = D.gmBoard(s)[index];
    if (!c) return fail('unknown');
    if (s.player.coins < c.fee) return fail('coins', { missing: c.fee - s.player.coins });
    if (D.autoManaged(s)) s.autoplay.active.book = autoManagerOff(s, ctx.now); // he takes the team from Auto; the run's time goes on, on the fields
    spend(s, c.fee);
    ledger(s, ctx.now, 'spent', c.fee, 'hire', D.gmZone(s));
    // The shared Unit interface (management-rules §1.1): uid 'g1', kind 'manager', book / days / recent, backlog.
    s.gm.unit = { uid: 'g1', kind: 'manager', name: c.name, gender: c.gender, skill: c.skill, stats: Object.fromEntries(GM.stats.map(k => [k, c.skill])), worked: 0, style: c.style, loyalty: c.loyalty, raises: 0, hiredAt: ctx.now, paid: c.fee,
      tenurePlayedMin: 0, backlog: 0, book: { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: ctx.now }, days: [], recent: [] };
    Object.assign(s.gm, D.gmDefaultLimits(s)); // limits from the reference income I(L), snapped to the options
    s.gm.shareFrom = D.playedMinute(s);       // its profit share counts its own jobs from now on
    if (s.debt?.wages) s.debt.wages.gm = 0;
    s.gm.board = { seed: (Math.imul((s.gm.board?.seed || 1) ^ s.nextUid++, 0x9e3779b1) >>> 1) | 0, at: ctx.now };
    s.gm.payAt = ctx.now;
    s.gm.lastJobAt = ctx.now;
    s.gm.seenAt = ctx.now;
    s.gm.window = { start: ctx.now, spent: 0 };
    s.gm.careWin = null;
    const calmed = !!s.gm.chaos;
    s.gm.chaos = null;
    delete s.gm.reserve;
    gmLog(s, ctx.now, 'hired', { name: c.name, fee: c.fee });
    ev.push({ type: 'gmHired', name: c.name, fee: c.fee, calmed });
    if (s.gm.mode !== 'advisor') planDay(s, ev, ctx); // the first day plan comes with him (§3.4)
  },
  'gm/refreshBoard'(s, { roll = 0, paid = false }, ev, ctx) {
    delete s.gm.reserve; // that board place is gone
    const due = D.gmBoardRefreshIn(s, ctx.now) <= 0;
    if (!due && !paid) return fail('tooSoon');
    if (!due) { if (s.player.coins < GM.board.refreshCost) return fail('coins', { missing: GM.board.refreshCost - s.player.coins }); spend(s, GM.board.refreshCost); }
    s.gm.board = { seed: Math.floor(Math.min(.999999, Math.max(0, Number(roll) || 0)) * 2147483647), at: ctx.now };
    ev.push({ type: 'gmBoardRefreshed', paid: !due });
  },
  // Powers, budget per 10 minutes, the big-job limit (GM.modes / budgets / bigLimits).
  'gm/setMode'(s, { mode }, ev) {
    if (!D.gmOf(s) || !GM.modes[mode]) return fail('unknown');
    if (s.gm.mode === mode) return { noop: true };
    s.gm.mode = mode;
    if (mode === 'advisor') for (const t of D.gmRequests(s)) closeTask(s, t, 'cancelled'); // an advisor only suggests
    ev.push({ type: 'gmMode', mode });
  },
  'gm/setBudget'(s, { budget }, ev) {
    if (!GM.budgets.includes(budget)) return fail('unknown');
    if (s.gm.budget === budget) return { noop: true };
    s.gm.budget = budget;
  },
  // Farm Manager V2 settings (docs/design/farm-manager-v2.md). Stopping him, or a kind of work, drops the orders nobody has started.
  'gm/fmSet'(s, { key, value } = {}) {
    const f = (s.gm.fm ||= newFmState()), C = FARM_MANAGER;
    if (key === 'mode') { const mark = C.stance.marks.find(m => m[1] === value); if (!mark) return fail('unknown'); key = 'stance'; value = mark[0]; }
    const ok = key === 'stance' ? Number.isInteger(value) && value >= 0 && value <= 100 : key === 'minReserve' ? C.reservePicks.includes(value) : key === 'spendLimit' ? C.limitPicks.includes(value) : ['auto', 'build', 'land', 'hire', 'autoSell', 'ask'].includes(key) && typeof value === 'boolean';
    if (!ok) return fail('unknown');
    if (f[key] === value) return { noop: true };
    f[key] = value;
    if (key === 'stance') f.mode = stanceMode(value);
    if (key === 'autoSell') f.sellChosen = true;
    f.plan = null; // the objective is re-read at once
    if (value === false && s.gm.orders?.length) s.gm.orders = s.gm.orders.filter(o => key !== 'auto' && (key !== 'build' || !o.act.type.startsWith('build/')) && (key !== 'land' || o.act.type !== 'land/buyParcel'));
    if (key === 'ask' && value) s.gm.orders = [];
  },
  // Staff board «Giao cho Quản lý»: he runs this game's team (upgrades, letting go, shifts, who works where) and the
  // player reads the report. Handing over drops the player's own pins and job picks, so he places everyone himself.
  'gm/handStaff'(s, { zone, on } = {}, ev, ctx) {
    if (!D.gmOf(s) || D.autoManaged(s)) return fail('noGm');
    if (!RECRUIT.worker[zone]) return fail('unknown');
    const g = s.gm, want = on === true;
    if (D.gmHanded(s, zone) === want) return { noop: true };
    g.handed = { ...g.handed, [zone]: want };
    gmLog(s, ctx.now, want ? 'handed' : 'takenBack', { zone }, { zone });
    if (!want) return undefined;
    if (g.mode === 'advisor') g.mode = GM.defaults.mode;
    g.fm ||= newFmState();
    if (zone === 'farm') g.fm.auto = true;
    for (const u of D.zoneUnits(s, zone)) {
      delete g.fm.pins[u.uid];
      if (Array.isArray(u.tasks) && u.tasks.length) handlers['staff/setTasks'](s, { uid: u.uid, tasks: [] }, ev, ctx);
      if (STAFF[u.type].kind === 'robot' && (u.task || 'auto') !== 'auto') handlers['staff/setTask'](s, { uid: u.uid, task: 'auto' }, ev, ctx);
      if (!u.assigned) handlers['staff/assign'](s, { uid: u.uid }, ev, ctx);
    }
    handlers['gm/think'](s, { roll: 0.5 }, ev, ctx); // his first round starts now, so the report is not empty for a minute
    return undefined;
  },
  // Phân công «Tự chia đều»: drop every pin and share the crew over the open terraces (works with no manager too).
  'gm/splitTiers'(s) {
    const f = (s.gm.fm ||= newFmState());
    f.pins = {};
    const next = D.planTiers(s);
    if (JSON.stringify(next) === JSON.stringify(s.gm.tiers || {})) return { noop: true };
    s.gm.tiers = next;
    return undefined;
  },
  // The player fixes (tier 0..3) or frees (null) where a farm unit works. The manager never overrides a pin.
  'gm/fmPin'(s, { uid: id, tier } = {}) {
    const f = (s.gm.fm ||= newFmState());
    if (!D.unitOf(s, id) || (tier !== null && !(Number.isInteger(tier) && tier >= 0 && tier <= 3))) return fail('unknown');
    if ((f.pins[id] ?? null) === tier) return { noop: true };
    if (tier === null) delete f.pins[id]; else f.pins[id] = tier;
    const tiers = (s.gm.tiers ||= {}); // also with no manager yet: the crew walks by this map either way
    if (tier === null) delete tiers[id]; else tiers[id] = tier;
  },
  // His own hands (realm timer): a round of picking, sowing, cutting back and watering, like you tapping. `skip` = plots the crew is on.
  'gm/hands'(s, { skip = [] } = {}, ev, ctx) {
    const gm = D.gmOf(s), f = D.fmOf(s), g = s.gm;
    if (!gm || gm.isAuto || !f.auto || D.gmZone(s) !== 'farm' || D.gmStrike(s)) return { noop: true }; // Auto's hands are auto/tick
    const busy = new Set(skip), from = ev.length, plots = D.ownedPlots(s).filter(p => !busy.has(p.id));
    let did = 0, at = null;
    const was = ACTOR;
    ACTOR = 'g1';
    try {
      for (const j of FM.handsJobs(s, ctx.now, plots, gmHandsPerRound(gm))) {
        const res = handlers[j.act](s, j.payload, ev, ctx) || {};
        if (res.ok === false || res.noop) continue;
        did++; at ||= j.plotId;
      }
    } finally { ACTOR = was; }
    for (let i = from; i < ev.length; i++) ev[i].byGm = true;
    const cap = D.capacity(s);
    let sold = false;
    if (f.autoSell && cap > 0 && D.stored(s) / cap >= FARM_MANAGER.hands.sellAt) {
      const q = D.sellAllQuote(s);
      sold = gmRun(s, { key: 'handsSell', act: { type: 'farm/sellAll', payload: {} }, cost: 0, group: 'trade', zone: 'farm', reason: ['storageFull', { pct: Math.round(D.stored(s) / cap * 100), coins: Math.round(q.coins || 0) }] }, ctx, ev, { budget: false });
    }
    if (!did && !sold) return { noop: true };
    if (did) {
      g.lastJobAt = ctx.now;
      const b = (g.unit.book ||= { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: ctx.now });
      b.jobs += did;
      ev.push({ type: 'gmHands', plotId: at, n: did });
    }
  },
  // ---------- Auto: the farm's manager by the hour (AUTO in economy.js) ----------
  // Start a run: the time Pause kept first (no run spent), else one run. The player keeps playing meanwhile.
  'auto/start'(s, _p, ev, ctx) {
    const a = s.autoplay;
    if (a.active) return { noop: true };
    if (!D.region(s)) return fail('unknown');
    if (otherGame(D.region(s), 'farm')) return fail('gameLocked');
    if (!D.ownedPlots(s).length) return fail('noFields'); // nothing to work yet: the run (the free one too) is kept
    let leftMs = a.saved > 0 ? a.saved : 0;
    if (!leftMs) { if (a.runs <= 0) return fail('noRuns'); a.runs--; leftMs = AUTO.runSeconds * 1000; a.tally = null; }
    a.saved = 0;
    a.active = { leftMs };
    if (D.gmOf(s)) a.active.book = { jobs: a.tally?.jobs || 0, earned: a.tally?.earned || 0, spent: a.tally?.spent || 0 }; // a hired manager keeps the team: Auto only works the fields
    else autoManagerOn(s, ctx.now, a.tally);
    a.tally = null;
    if (D.autoManaged(s)) handlers['gm/think'](s, { roll: 0.5 }, ev, ctx); // the first round of decisions starts now
    ev.push({ type: 'autoStarted', runs: a.runs, leftMs });
  },
  // A notice left in an old save, from when a manager on the farm was let go with his fee back.
  'auto/retiredSeen'(s) {
    if (!s.autoplay.retired) return { noop: true };
    s.autoplay.retired = null;
  },
  // A finished quest pays its reward (core/quests.js). Auto claims through this too.
  'quest/claim'(s, { id } = {}, ev) {
    const q = Q.questById(s, id);
    if (!q) return fail('unknown');
    if (!q.done) return fail('questNotDone');
    if (q.loop) s.quests.loop++; else s.quests.claimed.push(q.id);
    grantItems(s, [{ kind: 'coins', amount: q.coins }]);
    grantXp(s, q.xp, ev);
    ev.push({ type: 'questClaimed', id: q.id, kind: q.kind, key: q.key, n: q.n, coins: q.coins });
  },
  // Stop: control was never taken away, this only ends the run. Paused (reason 'user' / 'region'): the time left and the run's
  // numbers are kept for the next Start. Over ('timeout'): its numbers stay as the last run's report; nothing is charged by itself.
  'auto/stop'(s, { reason = 'user' } = {}, ev, ctx) {
    const a = s.autoplay;
    if (!a.active) return { noop: true };
    const { leftMs, book } = a.active, run = autoManagerOff(s, ctx.now) || { jobs: book?.jobs | 0, earned: Math.round(book?.earned || 0), spent: Math.round(book?.spent || 0) };
    a.active = null;
    if (reason === 'timeout') { a.saved = 0; a.tally = null; a.last = { ...run, at: ctx.now }; }
    else { a.saved = Math.max(0, Math.round(leftMs)); a.tally = run; }
    ev.push({ type: 'autoStopped', reason, ...run, savedMs: a.saved });
  },
  // Buy one run with coins (in-game currency only); one txId per confirm card.
  'auto/buy'(s, _p, ev) {
    const a = s.autoplay, price = autoPrice(a.bought);
    if (s.player.coins < price) return fail('coins', { missing: price - s.player.coins });
    spend(s, price);
    a.runs++;
    a.bought++;
    ev.push({ type: 'autoBought', price, runs: a.runs });
  },
  // A round of the run (realm timer, AUTO.everySec): `ms` = played time since the last round (a hidden tab / pause does
  // not burn the run). Up to AUTO.perRound field jobs like a quick hand — the manager's own job list (FM.handsJobs), minus
  // uprooting (the player's trees are never pulled out) — then a sale when the storehouse is AUTO.sellAt full.
  // `skip` = plots the crew is already on. The player's taps go on in between; a plot they just took simply fails here.
  'auto/tick'(s, { ms = 0, skip = [], roll = 0.5 } = {}, ev, ctx) {
    const a = s.autoplay;
    if (!a.active) return { noop: true };
    a.active.leftMs -= Math.max(0, Math.min(AUTO.maxTickMs, Number(ms) || 0));
    if (a.active.leftMs <= 0) return handlers['auto/stop'](s, { reason: 'timeout' }, ev, ctx);
    const r = D.region(s);
    if (!r || otherGame(r, 'farm')) return;
    if (!s.gm.unit) { autoManagerOn(s, ctx.now, a.tally || a.active.book); delete a.active.book; } // nobody holds the team (the hired manager left, or a run saved before Auto was a manager): Auto does
    const book = D.autoManaged(s) ? s.gm.unit.book : (a.active.book ||= { jobs: 0, earned: 0, spent: 0 }); // with a hired manager the run keeps its own numbers, not his
    const paidOut = fn => { const was = s.player.coins; fn(); book.spent = r2(book.spent + Math.max(0, was - s.player.coins)); };
    const busy = new Set(skip), from = ev.length, plots = D.ownedPlots(s).filter(p => !busy.has(p.id));
    let did = 0, at = null;
    paidOut(() => {
      for (const j of FM.handsJobs(s, ctx.now, plots, AUTO.perRound)) {
        if (j.act === 'farm/uproot') continue;
        const res = handlers[j.act](s, j.payload, ev, ctx) || {};
        if (res.ok === false || res.noop) continue;
        did++; at ||= j.plotId;
      }
    });
    book.jobs += did;
    const cap = D.capacity(s);
    let sold = 0;
    if (cap > 0 && D.stored(s) / cap >= AUTO.sellAt) {
      const before = s.player.coins, res = handlers['farm/sellAll'](s, {}, ev, ctx) || {};
      if (res.ok !== false) sold = Math.round(s.player.coins - before);
      book.earned = r2(book.earned + Math.max(0, sold));
    }
    // The quest list, on the timer's rounds only (the farmer's own stops pass ms 0): claim one finished quest, open one level
    // gift, take one step for the next quest it can afford. Each goes through the normal action, with its normal price and rules.
    let finished = null;
    if (ms > 0) {
      finished = Q.questList(s).find(q => q.done) || null;
      if (finished) handlers['quest/claim'](s, { id: finished.id }, ev, ctx);
      if (D.pendingGifts(s).length) handlers['level/claim'](s, { roll }, ev, ctx);
      const step = Q.nextQuestAct(s);
      if (step) paidOut(() => handlers[step.act](s, step.payload, ev, ctx));
    }
    for (let i = from; i < ev.length; i++) if (!GM_LOUD.has(ev[i].type)) ev[i].byAuto = true;
    if (did) { if (D.autoManaged(s)) s.gm.lastJobAt = ctx.now; ev.push({ type: 'autoWork', plotId: at, n: did, byAuto: true }); }
    if (sold) ev.push({ type: 'autoSold', coins: sold });
    if (finished) ev.push({ type: 'autoQuest', kind: finished.kind, key: finished.key, n: finished.n, coins: finished.coins });
  },
  'gm/setBigLimit'(s, { limit }, ev) {
    if (!GM.bigLimits.includes(limit)) return fail('unknown');
    if (s.gm.bigLimit === limit) return { noop: true };
    s.gm.bigLimit = limit;
  },
  // The GM's turn (realm timer, D.gmThinkSeconds; management-rules §3.3, planner v2): due tasks expire first (a rival's
  // offer that ran out takes him away); then — unless he strikes or only advises — he samples the land's use (once a
  // played minute), makes the day plan when it is due (GM.plan.everyMin), and runs the GM_RULES candidates
  // (D.gmCandidates, best score first) through D.gmPermission: do (≤ GM.actionsPerThink; care / ops from the care
  // wallet), file a task (≤ TASKS.maxFiledPerThink; a full inbox → "Để sau", logged), or a loan task for a capital job
  // the coins cannot pay. Keys cooling down or already waiting are skipped. Chờ lệnh: care / ops only, one action, no
  // filing. The zone not on screen is thought about every GM.plan.offscreenEvery-th think.
  'gm/think'(s, { roll = 0.5 }, ev, ctx) {
    if (!D.gmOf(s)) return { noop: true };
    let changed = expireDue(s, ev) > 0;
    const g = s.gm;
    if (!g.unit || D.gmStrike(s) || g.mode === 'advisor') return changed ? undefined : { noop: true };
    changed = sampleUtil(s) || changed;
    changed = sampleLoad(s, ctx.now) || changed;
    g.fm ||= newFmState();
    if (!g.fm.auto && D.gmZone(s) === 'farm') { if (g.orders?.length) { g.orders = []; changed = true; } return changed ? undefined : { noop: true }; } // auto-management off: he only watches
    if (!g.plan || D.playedMs(s) - g.plan.atPlayed >= GM.plan.everyMin * 60000) { planDay(s, ev, ctx); changed = true; }
    const turn = Math.floor(D.playedMs(s) / 1000 / D.gmThinkSeconds(g.unit)); // played-time turn number (half cadence off screen)
    const { list, hits } = D.gmCandidates(s, ctx.now, { offscreen: turn % GM.plan.offscreenEvery === 0 });
    const ticks = Object.fromEntries(Object.entries(hits).filter(([, v]) => v).map(([key]) => [key, (g.ticks?.[key] || 0) + 1]));
    if (JSON.stringify(ticks) !== JSON.stringify(g.ticks || {})) { g.ticks = ticks; changed = true; }
    const waiting = D.gmWaiting(s), M = TASKS.maxFiledPerThink, slow = (g.unit.backlog || 0) >= PENALTY.backlog.waitAt;
    const max = waiting || slow ? 1 : gmActionsOf(g.unit);
    const rich = Math.min(5, Math.floor(D.gmSpendable(s) / 2000)); // money waiting to be invested: more growth moves per round
    if (g.orders?.length) { const open = g.orders.filter(o => D.crewFor(s, o.job)); if (open.length !== g.orders.length) { g.orders = open; changed = true; } } // nobody left for it: he decides again
    const isSale = t => /^farm\/sell/.test(t.act?.type || ''); // one bean sale waits for your signature at a time
    for (const t of D.gmRequests(s).filter(isSale).slice(g.fm.autoSell ? 0 : 1)) { closeTask(s, t, 'cancelled'); changed = true; }
    const tiers = D.planTiers(s); // each unit's tier, split evenly (the player's pins stay)
    if (JSON.stringify(tiers) !== JSON.stringify(g.tiers || {})) { g.tiers = tiers; changed = true; }
    const fmx = FM.thinkContext(s, ctx.now, list); // Farm Manager V2: budget, ranking, modes
    if (D.gmZone(s) === 'farm') changed = FM.refreshPlan(s, ctx.now, fmx) || changed;
    // One expired health certificate per round, out of what is above his reserve.
    if (!fmx.ask) {
      const due = D.assignedUnits(s, s.world.currentRegion).find(u => STAFF[u.type].kind === 'worker' && D.checkupOf(u)?.expired);
      if (due && s.player.coins - fmx.reserve - fmx.committed >= CHECKUP.cost) changed = gmRun(s, { key: `checkup:${due.uid}`, rule: 'checkup', group: 'care', zone: STAFF[due.type].zone, act: { type: 'staff/checkup', payload: { uid: due.uid } }, cost: CHECKUP.cost, value: 0, reason: ['checkup', { name: due.name || '' }] }, ctx, ev, { budget: 'care' }) || changed;
    }
    // Goal "repay debt": whatever is above his reserve goes to the loan first. The player chose this, so no credit licence is asked.
    if (D.gmZone(s) === 'farm' && fmx.m.repayFirst && fmx.f.auto && !fmx.ask) {
      const room = Math.floor(Math.min(D.loanTotal(s), s.player.coins - fmx.reserve - fmx.committed));
      if (room >= FARM_MANAGER.stance.minRepay) changed = gmRun(s, { key: 'fmRepay', rule: 'repay', group: 'capital', zone: 'farm', kind: 'loan', act: { type: 'loan/repay', payload: { amount: room } }, cost: room, value: 0, reason: ['repay', { coins: room }] }, ctx, ev) || changed;
    }
    const careOps = c => c.group === 'care' || c.group === 'ops';
    const incident = c => careOps(c) || c.rule === 'funnyFireW' || c.rule === 'funnyFireR'; // trouble comes first and never waits for a free slot
    const handed = c => D.gmHanded(s, c.zone) && /^staff\//.test(c.act?.type || ''); // you gave him the team: its jobs are his first duty
    let handedDone = 0;
    const free = c => incident(c) || c.rule === 'fieldBuy' || (handed(c) && handedDone < GM.handedPerThink); // opening a field costs no attention: he does as many as the round found
    const wished = new Set();
    let done = 0, filed = 0, k = 0;
    for (const c of list) {
      if (c.group === 'advice') continue;
      if (g.fm.autoSell && isSale(c)) continue; // you let him sell: gm/hands does it, nothing to sign
      if (!D.gmLicensed(s, c.licence)) { wished.add(c.licence); continue; } // self-upgrade: counted below
      if (done >= max + rich && (filed >= M || waiting) && !free(c)) continue;
      // already asked (his own request) or cooling down; a rival's offer (system task) he may still settle himself
      // below the big-job limit, but never files a second task for it (noFile)
      if (D.taskCooling(s, c.key) || D.gmRequests(s).some(t => t.key === c.key)) continue;
      let perm = D.gmPermission(s, c, ctx.now);
      if (c.zone === 'farm' && c.group === 'capital' && c.cost > 0 && perm === 'suggest') { changed = FM.note(s, ctx.now, c, 'cash', fmx) || changed; continue; }
      const blocked = FM.gate(s, c, fmx, perm);
      if (blocked === 'sellAsk') perm = 'file'; // land is sold only with your signature
      else if (blocked) { changed = FM.note(s, ctx.now, c, blocked, fmx) || changed; continue; }
      else if (fmx.ask && c.group === 'capital' && c.cost > 0 && perm === 'do' && !handed(c)) perm = 'file'; // Manual Approval
      if (g.unit.isAuto && perm !== 'do') continue; // Auto asks for no signature and borrows nothing
      const r = ((Number(roll) || 0) + 0.6180339887 * k++) % 1; // one independent-looking roll per job of this think
      if (perm === 'do') {
        if ((done >= max + rich && !free(c)) || (waiting && !careOps(c) && !handed(c))) continue;
        // Growth is paid out of what the farm earns, except what the farm cannot run without; land has its own payback test.
        if (c.group === 'capital' && c.cost > 0 && !c.essential && c.rule !== 'landBuy' && c.cost > D.gmBudgetLeft(s, ctx.now)) continue;
        // A specialist on the crew carries it out on foot; with nobody for it he does it himself.
        const job = c.rule === 'fieldBuy' ? null : D.orderJob(c.act); // fields he opens himself, at once, like you tapping
        if (job && D.crewFor(s, job)) {
          if (!(g.orders ||= []).some(o => o.key === c.key)) { g.orders.push({ id: uid(s, 'o'), key: c.key, job, act: c.act, cost: c.cost, reason: c.reason }); done++; changed = true; FM.reserveBudget(fmx, c); FM.note(s, ctx.now, c, 'queued', fmx, 'queued'); }
          continue;
        }
        const wallet = careOps(c) && c.cost <= D.gmCareWalletLeft(s) ? 'care' : true;
        if (gmRun(s, c, ctx, ev, { roll: r, budget: wallet })) { if (handed(c)) handedDone++; if (c.rule !== 'fieldBuy') done++; changed = true; cool(s, c.key, 'done'); FM.reserveBudget(fmx, c); if (c.group === 'capital' && c.cost > 0) FM.note(s, ctx.now, c, 'done', fmx, 'done'); if (c.rule === 'replaceWeak') cool(s, 'replace', null, GM.growth.replaceEveryMin); }
        else if (c.group === 'capital' && c.cost > 0) changed = FM.note(s, ctx.now, c, 'failed', fmx, 'failed') || changed;
      } else if (perm === 'loan') { // the coins are short and a loan pays it back: he borrows by himself
        const need = D.gmLoanFor(s, c);
        if (!need || done >= max || D.taskCooling(s, 'loan')) continue;
        if (gmRun(s, { ...c, key: `loan:${c.key}`, act: { type: 'loan/take', payload: { amount: need.amount, gold: true } }, cost: 0 }, ctx, ev, { roll: r })) { done++; changed = true; cool(s, 'loan', null, GM.loanRule.everyMin); }
      } else if (perm === 'file' || perm === 'loan') {
        if (isSale(c) && D.gmRequests(s).some(isSale)) continue;
        if (c.noFile || waiting || filed >= M || done + filed >= max + M || D.taskPending(s, c.key)) continue;
        const loan = perm === 'loan' ? D.gmLoanFor(s, c) : null;
        if (perm === 'loan' && (!loan || D.taskCooling(s, 'loan') || D.tasksOpen(s).some(t => t.kind === 'loan'))) continue;
        const landDeal = GM.land.coolActs.includes(c.act?.type); // buying / selling a lot (not a building upgrade)
        if (landDeal && D.taskCooling(s, 'land')) continue; // ≤ 1 land proposal per GM.land.everyMin
        if (D.tasksOpen(s).length >= TASKS.cap) { // never dropped silently: "Để sau" (≤ once per TASKS.laterEveryMin), the key waits a moment
          cool(s, c.key, 'done');
          const P = D.playedMs(s);
          if (g.laterAt == null || P - g.laterAt >= TASKS.laterEveryMin * 60000 || P < g.laterAt) {
            g.laterAt = P;
            gmLog(s, ctx.now, 'later', { key: c.key, reason: c.reason });
            ev.push({ type: 'gmLater', reason: c.reason, name: g.unit.name });
          }
          changed = true;
          continue;
        }
        const item = loan ? { key: `loan:${c.key}`, kind: 'loan', act: { type: 'loan/take', payload: { amount: loan.amount, gold: true } }, cost: 0, value: c.value, reason: ['loanFor', { coins: loan.amount, min: loan.termMin, for: c.reason }], zone: c.zone }
          : { key: c.key, kind: c.kind || D.taskKindOf(c.act.type), act: c.act, cost: c.cost, value: c.value, reason: c.reason, zone: c.zone };
        const t = fileTask(s, ev, { kind: item.kind, key: item.key, by: 'g1', act: item.act, cost: item.cost, value: item.value, reason: item.reason, zone: item.zone || D.gmZone(s) });
        if (!t) continue;
        filed++;
        if (loan) cool(s, 'loan', null, GM.loanRule.everyMin);
        if (landDeal && !loan) cool(s, 'land', null, D.landEveryMin(s));
        if (item.kind === 'topUp') { const tu = topUpOf(s); tu.filed = (tu.filed || 0) + 1; }
        gmLog(s, ctx.now, 'asked', { key: item.key, reason: item.reason, cost: item.cost }, { taskId: t.id });
        g.lastJobAt = ctx.now;
        ev.push({ type: 'gmRequest', reason: item.reason, cost: item.cost, name: g.unit.name, id: t.id, kind: t.kind });
        changed = true;
      }
    }
    // self-upgrade (§3.7): a rule group he holds no licence for fired → counted (≤ once per played minute per group);
    // busy: more candidates than actions → after GM.selfUpgrade.trainThinks thinks in a row, training may pay
    if (wished.size) changed = wishLicence(s, wished, ctx.now) || changed;
    const acts = list.filter(c => c.group !== 'advice' && D.gmLicensed(s, c.licence) && !D.taskCooling(s, c.key) && !D.taskPending(s, c.key));
    const excess = Math.max(0, acts.length - max);
    const busy = excess > 0 ? { n: (g.busy?.n || 0) + 1, excess, avg: Math.round(acts.reduce((n, c) => n + c.value, 0) / acts.length * 100) / 100 } : null;
    if (JSON.stringify(busy) !== JSON.stringify(g.busy || null)) { g.busy = busy; changed = true; }
    if (!changed) return { noop: true };
  },
  'gm/tick'(s, p, ev, ctx) { return handlers['gm/think'](s, p, ev, ctx); }, // old name
  // The day plan now (also every GM.plan.everyMin played minutes inside gm/think, and on hire).
  'gm/planDay'(s, _p, ev, ctx) {
    if (!D.gmOf(s) || s.gm.mode === 'advisor' || D.gmStrike(s)) return fail('unknown');
    planDay(s, ev, ctx);
  },
  // A licence (Giấy phép, §2.5) for the manager: the player's, bought once, kept by the Level-10 incident.
  'gm/buyLicence'(s, { group } = {}, ev) {
    const err = D.licenceError(s, group);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: D.licencePrice(group) - s.player.coins } : err === 'level' ? { level: GM.licences.unlockLevel } : undefined);
    const price = D.licencePrice(group);
    if (price > 0) spend(s, price);
    s.gm.licences = [...new Set([...(s.gm.licences || []), group])];
    if (s.gm.wish?.n) delete s.gm.wish.n[group];
    hist(s, { type: 'licence', actor: 'player', subject: s.gm.unit ? 'g1' : undefined, cost: price || undefined, extra: { group, coins: price }, gm: s.gm.unit ? 1 : undefined });
    ev.push({ type: 'licenceBought', group, cost: price });
  },
  // Training (Đào tạo, §2.5): GM.training.basePerSkill × (skill + 1); skill + 1 after GM.training.shiftDays shift-days of
  // play (clock/tick finishes it). He keeps working meanwhile.
  'gm/train'(s, _p, ev) {
    const err = D.gmTrainError(s);
    if (err) return fail(err, err === 'coins' ? { missing: D.gmTrainCost(D.gmOf(s)) - s.player.coins } : undefined);
    const gm = D.gmOf(s), cost = D.gmTrainCost(gm);
    spend(s, cost);
    ledger(s, NOW, 'spent', cost, 'upgrade', D.gmZone(s));
    gm.training = { untilPlayed: D.playedMs(s) + GM.training.shiftDays * CAREER.shiftDayMin * 60000, to: (gm.skill || 1) + 1 };
    gmLog(s, NOW, 'trainStart', { to: gm.training.to, coins: cost }, { cost });
    ev.push({ type: 'gmTraining', name: gm.name, to: gm.training.to, cost, minutes: GM.training.shiftDays * CAREER.shiftDayMin });
  },
  // The answer to the manager's real-money top-up proposal (§3.7, §8 Q2). The player executes real money himself; no
  // real-money store exists in the game yet, so this only logs that you saw it (no coins move).
  'gm/topUpSeen'(s, _p, ev) {
    hist(s, { type: 'topUpSeen', actor: 'player', subject: 'g1', gm: 1 });
    ev.push({ type: 'topUpSeen' });
  },
  // ---------- the inbox's answers (management-rules §4.2) ----------
  // approve: how 'bonus' | 'raise' for a rival's offer on the manager; roll for a care job that needs one.
  'task/approve'(s, { id, how = 'bonus', roll = 0.5 } = {}, ev, ctx) {
    const t = D.tasksOpen(s).find(x => x.id === id);
    if (!t) return fail('unknown');
    return answerYes(s, t, { how, roll }, ev, ctx);
  },
  'task/deny'(s, { id } = {}, ev, ctx) {
    const t = D.tasksOpen(s).find(x => x.id === id);
    if (!t) return fail('unknown');
    return answerNo(s, t, ev, ctx);
  },
  // A manager task that ran out less than TASKS.lateMin ago: approved late (+lateLoyalty, its cooldown cleared; the
  // fine stays paid). Only while the manager who filed it is still here, in its region (D.taskLateOk).
  'task/late'(s, { id, roll = 0.5 } = {}, ev, ctx) {
    const t = D.tasksDone(s).find(x => x.id === id);
    if (!D.taskLateOk(s, t)) return fail('unknown');
    return answerYes(s, t, { roll, late: true }, ev, ctx);
  },
  // Runs out the task `id` when its time is up (or, without id, every task that is due). The played clock calls it.
  'task/expire'(s, { id = null } = {}, ev) {
    if (id == null) { if (!expireDue(s, ev)) return { noop: true }; return; }
    const t = D.tasksOpen(s).find(x => x.id === id);
    if (!t || t.untilPlayed > D.playedMs(s)) return { noop: true };
    expireTask(s, t, ev);
    settleGm(s, ev);
  },
  // At least TASKS.graceMin more played minutes on task `id` (or on every open task): the return grace (§4.1).
  'task/extend'(s, { id = null } = {}, ev) {
    const P = D.playedMs(s) + TASKS.graceMin * 60000;
    let n = 0;
    for (const t of D.tasksOpen(s)) if ((id == null || t.id === id) && t.untilPlayed < P) { t.untilPlayed = P; n++; }
    if (!n) return { noop: true };
    ev.push({ type: 'tasksExtended', n });
  },
  // Old answers, now aliases over the inbox.
  'gm/approve'(s, { id } = {}, ev, ctx) { return handlers['task/approve'](s, { id }, ev, ctx); },
  'gm/deny'(s, { id } = {}, ev, ctx) { return handlers['task/deny'](s, { id }, ev, ctx); },
  // Sorry, boss (management-rules §4.2): PENALTY.apologiseSalaries × salary → backlog 0, +apologiseLoyalty, strike over.
  'gm/apologise'(s, _p, ev, ctx) {
    const gm = D.gmOf(s);
    if (!gm) return fail('unknown');
    if (!(gm.backlog > 0) && !gm.strike && !gm.waiting) return { noop: true };
    const cost = D.apologiseCost(s);
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    ledger(s, ctx.now, 'spent', cost, 'wage', D.gmZone(s));
    gm.backlog = 0;
    gm.loyalty = r2(Math.min(100, gm.loyalty + PENALTY.apologiseLoyalty));
    delete gm.strike; delete gm.waiting;
    gmLog(s, ctx.now, 'apologised', { coins: cost }, { cost });
    ev.push({ type: 'gmApologised', coins: cost, name: gm.name });
  },
  // You hand one suggestion to the manager (or the stand-in Manager-rank worker): done now, your call.
  'gm/delegate'(s, { key, roll = 0.5 }, ev, ctx) {
    if (!D.gmAdvisorOf(s)) return fail('noGm');
    const item = D.gmPlan(s, ctx.now).find(x => x.key === key);
    if (!item || item.tier === 'advice') return fail('unknown');
    if (s.player.coins < item.cost) return fail('coins', { missing: item.cost - s.player.coins });
    if (!gmRun(s, item, ctx, ev, { roll, budget: false, approved: true })) return fail('failed');
  },
  // Salary (realm, about every minute): base for the time since the last pay (≤ GM.payMinutes) + the mode's share of
  // the team's positive profit in that time (ledger, both games). Paid → loyalty slowly up; unpaid → down fast.
  'gm/payroll'(s, _p, ev, ctx) {
    if (D.autoManaged(s)) return { noop: true }; // Auto is paid for up front
    // the game was not running (tab hidden / closed): settle the return first, so this payroll never hides it from gm/seen
    const back = s.gm?.payAt ? gmBack(s, ev, ctx.now) : false;
    const gm = D.gmOf(s);
    if (!gm) return back ? undefined : { noop: true };
    const mins = Math.min(GM.payMinutes, Math.max(0, (ctx.now - (s.gm.payAt || ctx.now)) / 60000));
    if (!s.gm.payAt) { s.gm.payAt = ctx.now; s.gm.shareFrom ??= D.playedMinute(s); return; } // first call starts the clock
    if (mins <= 0) return back ? undefined : { noop: true };
    // Profit share (management-rules §2.6): only on the GM's OWN jobs (income rows by 'g1'), whole played minutes since
    // the last share — a passive manager costs its salary alone.
    const curM = D.playedMinute(s), fromM = Math.min(curM, s.gm.shareFrom || 0);
    const profit = D.gmProfitBetween(s, fromM, curM);
    s.gm.shareFrom = curM;
    const pay = r2(gmSalary(gm, s.gm.mode) * mins / GM.payMinutes + Math.max(0, profit) * (GM.modes[s.gm.mode]?.share || 0));
    s.gm.payAt = ctx.now;
    if (pay <= 0) return;
    const day = gmDay(s, ctx.now);
    // Partial pay (management-rules §2.6): pay what the coins allow, the rest becomes wage arrears (s.debt.wages.gm),
    // paid first out of the next income. Loyalty −unpaidPerMin per minute left unpaid; arrears of
    // GM.quitArrearsSalaries salaries → the GM quits (no chaos).
    const paidNow = Math.min(pay, Math.floor(s.player.coins * 100) / 100);
    if (paidNow > 0) {
      spend(s, paidNow);
      ledger(s, ctx.now, 'spent', paidNow, 'wage', D.gmZone(s));
      const row = s.staff.ledger[s.staff.ledger.length - 1]; if (row) row.gm = r2((row.gm || 0) + paidNow);
      day.salary = r2(day.salary + paidNow);
      ev.push({ type: 'gmPaid', coins: paidNow });
    }
    const short = r2(pay - paidNow);
    if (short <= 0) gm.loyalty = r2(Math.min(100, gm.loyalty + GM.loyalty.paidPer10 * mins / 10));
    else {
      const w = ((s.debt ||= { wages: { gm: 0, follower: 0 } }).wages ||= { gm: 0, follower: 0 });
      w.gm = r2((w.gm || 0) + short);
      gm.loyalty = r2(Math.max(0, gm.loyalty - GM.loyalty.unpaidPerMin * mins));
      gmLog(s, ctx.now, 'unpaid', { coins: short, owed: w.gm });
      ev.push({ type: 'gmUnpaid', coins: short, owed: w.gm, name: gm.name });
      if (w.gm >= D.gmQuitArrears(s)) gmLeave(s, ctx.now, 'quit', ev);
    }
  },
  // A rival tries to lure the GM (realm timer GM.poach.everyMinutes): loyal ones (≥ GM.loyalty.refuse) say no.
  // A crew member reached the spot of one of the manager's orders: it happens now, on his account.
  'gm/execute'(s, { id, uid: by } = {}, ev, ctx) {
    const g = s.gm, o = g?.orders?.find(x => x.id === id), unit = D.unitOf(s, by);
    if (!o || !doesJob(unit, o.job) || !g.unit) return fail('unknown');
    g.orders = g.orders.filter(x => x !== o);
    if (!FM.orderAllowed(s, o)) { FM.note(s, ctx.now, { key: o.key, act: o.act, cost: o.cost, reason: o.reason }, 'orderOff', null, 'cancelled'); return; } // settings changed while it walked over
    if (!gmRun(s, { key: o.key, act: o.act, cost: o.cost, reason: o.reason, group: 'capital' }, ctx, ev, {})) { cool(s, o.key, 'failed'); return { noop: true }; }
    practice(unit, o.job, ctx.now);
  },
  // A rival tries to lure him. The smarter he has become, the more they want him.
  'gm/rivalVisit'(s, { roll = 1 } = {}, ev) {
    const gm = D.gmOf(s);
    if (!gm || gm.isAuto || D.gmPoachOf(s) || (Number(roll) || 0) >= Math.min(0.9, GM.poach.chance * gmStatOf(gm, 'smart') / 3)) return { noop: true };
    if (!gmPoachStart(s, gm, ev)) return { noop: true };
  },
  // The replacement to start if he goes (a place on the board; paid when he starts). Same pick again clears it.
  'gm/pickReserve'(s, { index } = {}, ev) {
    if (!D.gmBoard(s)[index]) return fail('unknown');
    if (s.gm.reserve === index) delete s.gm.reserve; else s.gm.reserve = index;
    ev.push({ type: 'gmReserve', index: s.gm.reserve ?? null });
  },
  // His four numbers: coins, one step at a time.
  'gm/upgradeStat'(s, { stat } = {}, ev) {
    const gm = D.gmOf(s);
    if (!gm || !GM.stats.includes(stat)) return fail('unknown');
    const n = gmStatOf(gm, stat);
    if (n >= GM.maxStat) return { noop: true };
    const cost = GM.statCost * n;
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    gm.stats = { ...Object.fromEntries(GM.stats.map(k => [k, gmStatOf(gm, k)])), [stat]: n + 1 };
    ev.push({ type: 'gmUpgraded', stat, to: n + 1 });
  },
  // Keep the GM: a one-off bonus (loyalty +GM.keepLoyalty) or a lasting raise (+GM.raiseStep salary, loyalty
  // +GM.raiseLoyalty). Aliases over the inbox's gmPoach task.
  'gm/keep'(s, { how = 'bonus' } = {}, ev, ctx) {
    const t = D.tasksOpen(s).find(x => x.kind === 'gmPoach');
    if (!D.gmOf(s) || !t) return fail('unknown');
    return answerYes(s, t, { how }, ev, ctx);
  },
  'gm/letGo'(s, _p, ev, ctx) {
    const t = D.tasksOpen(s).find(x => x.kind === 'gmPoach');
    if (!D.gmOf(s) || !t) return fail('unknown');
    return answerNo(s, t, ev, ctx);
  },
  // You touched the game (HUD, throttled to GM.mood.seenEverySeconds). After a long time away (game closed) the
  // manager's loyalty drops per hour; if that leaves it below the refuse line, the rival is already at the door.
  'gm/seen'(s, _p, ev, ctx) {
    if (!D.gmOf(s) || D.autoManaged(s)) return { noop: true };
    // "Away" = the game was not running (gm/payroll stamps payAt every minute while it runs). Time with the game open
    // but untouched is already the per-minute "absent" drain, so it is not punished twice here.
    gmBack(s, ev, ctx.now);
    if (!s.gm.unit) return; // quit over unpaid salary while you were away
    s.gm.seenAt = ctx.now;
    if (s.gm.moodNote === 'absent') delete s.gm.moodNote;
  },
  // You let the GM go yourself: a planned handover, no chaos.
  'gm/fire'(s, _p, ev, ctx) {
    if (!D.gmOf(s)) return fail('unknown');
    gmLeave(s, ctx.now, 'fired', ev);
  },
  // A team meeting ends the chaos: GM.chaos.calmBase + calmPerUnit per unit.
  'gm/calm'(s, _p, ev, ctx) {
    if (!s.gm.chaos) return { noop: true };
    const cost = D.calmCost(s);
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    ledger(s, ctx.now, 'spent', cost, 'care', D.gmZone(s));
    s.gm.chaos = null;
    for (const u of s.staff.units) if (STAFF[u.type].kind === 'worker') u.morale = r2(Math.min(100, (u.morale ?? VITALS.start.morale) + GM.chaos.calmMorale));
    gmLog(s, ctx.now, 'calmed', { coins: cost });
    ev.push({ type: 'gmCalmed', coins: cost });
  },
  // ---------- level gifts ----------
  // Opens the gift box of a level reached (lowest pending first). Chest levels draw one surprise prize with `roll`.
  'level/claim'(s, { level, roll = 0 }, ev) {
    const pending = D.pendingGifts(s);
    if (!pending.length) return { noop: true };
    const lvl = level ?? pending[0];
    if (!pending.includes(lvl)) return pending.length && (s.rewards.claimed || []).includes(lvl) ? { noop: true } : fail('level');
    const chest = D.isChestLevel(lvl);
    const prize = chest ? chestPrize(roll) : null;
    const items = chest ? prize.items(lvl) : levelGift(lvl);
    grantItems(s, items);
    s.rewards.claimed.push(lvl);
    ev.push({ type: 'giftOpened', level: lvl, chest, prize: prize?.id || null, items });
  },

  // ---------- wallets (docs/design/wallet-economy.md) ----------
  // A replayed requestId changes nothing: a double tap or a retry after a reload cannot move money twice.
  // The demo top-up gate: no real payment exists. WALLET.demoDeposit off → ctx.sandbox is off and this is refused.
  'wallet/sandboxDeposit'(s, { cents, requestId }, ev, ctx) {
    if (!ctx.sandbox) return fail('forbidden');
    if (!W.validRequest(requestId)) return fail('request');
    if (W.seenRequest(s, requestId)) return { noop: true };
    if (!WALLET.sandboxPackCents.includes(cents)) return fail('amount');
    if (s.wallet.usd + cents > WALLET.maxUsdCents) return fail('usdCap');
    s.wallet.usd += cents;
    W.rememberRequest(s, requestId);
    W.addLedger(s, ctx.now, { kind: 'deposit', usd: cents, sandbox: true, request: requestId });
    ev.push({ type: 'usdDeposited', cents });
  },
  // rate: the rate the player saw on the preview; if it has changed since, nothing moves and the preview is shown again.
  'wallet/convert'(s, { regionId, cents, rate, interestRate, requestId }, ev, ctx) {
    if (!W.validRequest(requestId)) return fail('request');
    if (W.seenRequest(s, requestId)) return { noop: true };
    const q = W.convertQuote(s, regionId, cents);
    if (!q.ok) return fail(q.error, q);
    if (rate !== q.rate || (interestRate !== undefined && interestRate !== q.interestRate)) return fail('rateChanged', q);
    s.wallet.usd -= cents;
    s.wallet.borrowed = Math.max(0, q.borrowed - cents); // borrowed money is exchanged first
    if (regionId === s.world.currentRegion) s.player.coins = q.goldAfter; else s.wallet.gold[regionId] = q.goldAfter;
    W.rememberRequest(s, requestId);
    W.addLedger(s, ctx.now, { kind: 'convert', usd: -cents, gold: q.gold, interest: q.interest, rate: q.rate, regionId, request: requestId });
    ev.push({ type: 'goldFunded', regionId, cents, gold: q.gold });
  },

  // ---------- loans ----------
  // A new loan (management-rules §2.7): its own entry in s.loans (≤ LOAN.maxOpen), its term in played minutes fixed now.
  // Founder 2026-11-10: a loan is cash and lands in the cash wallet; Gold can only be had by exchanging cash, and the interest
  // is paid out of that exchange, so the debt is the principal. `gold`: the manager borrows for a purchase he is about to
  // make, so his pack is exchanged at once for this farm, interest included.
  'loan/take'(s, { amount, gold = false }, ev, ctx) {
    const err = D.loanError(s, amount);
    if (err) return fail(err, D.loanErrorData(s, amount, err));
    const cents = W.centsForGold(amount), now = ctx?.now ?? NOW, regionId = s.world.currentRegion;
    if (!gold && s.wallet.usd + cents > WALLET.maxUsdCents) return fail('usdCap');
    const ln = { id: `L${s.nextUid++}`, amount, owed: loanOwed(amount), takenAtPlayed: D.playedMs(s), termMin: D.loanTerm(s, amount), late: false, regionId: s.world.currentRegion };
    const borrowedBefore = W.borrowedOf(s), interest = gold ? W.interestOn(cents) : 0, got = gold ? W.goldForCents(cents - interest) : 0;
    s.loans = [...D.allLoans(s), ln];
    W.addLedger(s, now, { kind: 'loan', usd: cents, regionId });
    s.wallet.borrowed = borrowedBefore; // drops what a repaid debt left behind, so a new debt cannot brand deposited cash as borrowed
    if (gold) {
      s.player.coins = r2(s.player.coins + got); // borrowed coins are not income
      W.addLedger(s, now, { kind: 'convert', usd: -cents, gold: got, interest, rate: WALLET.goldPerUsd, regionId });
    } else { s.wallet.usd += cents; s.wallet.borrowed += cents; }
    hist(s, { type: 'loanTaken', actor: ACTOR, gain: gold ? got : amount, extra: { id: ln.id, owed: ln.owed, termMin: ln.termMin, ...(gold ? {} : { usd: cents }) } });
    ev.push({ type: 'loanTaken', amount, owed: D.loanTotal(s), termMin: ln.termMin });
  },
  // Pays the debt with the coins at hand: `amount` coins when given (the Repay tab's chosen amount), else as much as
  // possible. Never more than the debt or the coins you have. Late loans first (to lift the block), then the oldest.
  // A repayment is not a running cost (not booked as spent in the income series). from 'usd': the cash wallet pays it,
  // borrowed money first, so money returned without being exchanged carries no interest.
  'loan/repay'(s, { amount = null, from = 'gold' } = {}, ev, ctx) {
    const owed = D.loanTotal(s);
    if (!(owed > 0)) return { noop: true };
    if (amount != null && !(Number.isFinite(Number(amount)) && Number(amount) > 0)) return fail('invalid');
    const usd = from === 'usd', have = usd ? W.goldForCents(s.wallet.usd) : Math.floor(s.player.coins);
    const pay = Math.min(owed, have, amount == null ? Infinity : Math.floor(Number(amount)));
    if (pay <= 0) return fail(usd ? 'usdShort' : 'coins', usd ? {} : { missing: Math.ceil(owed) });
    const cents = usd ? Math.min(s.wallet.usd, W.centsForGold(pay)) : 0;
    if (usd) { s.wallet.borrowed = Math.max(0, W.borrowedOf(s) - cents); s.wallet.usd -= cents; W.addLedger(s, ctx?.now ?? NOW, { kind: 'loanRepay', usd: -cents, regionId: s.world.currentRegion }); }
    else s.player.coins = r2(s.player.coins - pay);
    let left = pay;
    for (const ln of [...D.loansOf(s)].sort((a, b) => (b.late ? 1 : 0) - (a.late ? 1 : 0))) {
      const c = Math.min(ln.owed, left);
      ln.owed = r2(ln.owed - c); left = r2(left - c);
      if (left <= 0) break;
    }
    s.loans = D.allLoans(s);
    const stillOwed = D.loansOf(s).length;
    hist(s, { type: stillOwed ? 'loanPaid' : 'loanRepaid', actor: ACTOR, cost: pay, extra: { owed: D.loanTotal(s), ...(usd ? { usd: cents } : {}) } });
    if (!stillOwed) ev.push({ type: 'loanRepaid' }); else ev.push({ type: 'loanPaid', amount: pay, owed: D.loanTotal(s) });
  },

  // A loan past its term (management-rules §4.5; the realm sends it every CLOCK.loanTickSeconds of play): owed ×
  // (1 + LOAN.lateFee) once and no new loan until every late loan is paid ("không thể vay").
  'loan/tick'(s, _p, ev) {
    return { noop: true }; // founder 2026-11-08: loans have no term — nothing goes overdue, no late fee
    let n = 0;
    for (const ln of D.loansOf(s)) {
      if (ln.late || D.playedMs(s) < ln.takenAtPlayed + ln.termMin * 60000) continue;
      ln.owed = Math.round(ln.owed * (1 + LOAN.lateFee));
      ln.late = true;
      n++;
      hist(s, { type: 'loanLate', actor: 'system', subject: s.gm?.unit ? 'g1' : undefined, cost: ln.owed, extra: { id: ln.id, owed: ln.owed }, gm: s.gm?.unit ? 1 : undefined });
      ev.push({ type: 'loanLate', id: ln.id, owed: ln.owed, name: s.gm?.unit?.name || null });
    }
    if (!n) return { noop: true };
  },

  // ---------- played clock (management-rules §4.1) ----------
  // The realm sends the seconds actually played (CLOCK.tickSeconds, ≤ CLOCK.maxTickMs per tick): s.clock.played moves,
  // every unit (and the GM) gains tenure in played minutes, and the inbox runs on it: reminders, expiries (with their
  // penalties), the manager's backlog decay, the end of Chờ lệnh, a strike's morale drain. Nothing moves while the game
  // is closed or paused.
  'clock/tick'(s, { ms = 0 } = {}, ev, ctx) {
    if (s.story.phase !== 'play' || !s.world.currentRegion) return { noop: true };
    const d = clampN(Math.floor(Number(ms) || 0), 0, CLOCK.maxTickMs);
    if (!d) return { noop: true };
    // The last hauler left: nobody will come for the piles, so they go in by themselves.
    if (!D.haulActive(s)) for (const pl of Object.values(D.region(s)?.plots || {})) if (pl.pile) { for (const [c, n] of Object.entries(pl.pile)) addBeans(s, c, n); delete pl.pile; }
    const now = ctx?.now ?? NOW;
    // the first tick after the game was not running (tab hidden / closed / paused) for TASKS.returnAwayMin or more:
    // the return grace before this tick can run anything out (with or without a manager, §4.1 / §8 Q10)
    if (s.clock?.at && now - s.clock.at >= TASKS.returnAwayMin * 60000) returnGrace(s, ev);
    s.clock = { played: (s.clock?.played || 0) + d, at: now };
    const min = d / 60000, r6 = n => Math.round(n * 1e6) / 1e6;
    for (const u of s.staff.units) u.tenurePlayedMin = r6((u.tenurePlayedMin || 0) + min);
    const gm = s.gm?.unit;
    if (gm) {
      gm.tenurePlayedMin = r6((gm.tenurePlayedMin || 0) + min);
      // backlog decay: −decay per decayEveryMin played minutes (−emptyDecay while none of his tasks is open)
      const B = PENALTY.backlog;
      gm.decayMs = (gm.decayMs || 0) + d;
      while (gm.decayMs >= B.decayEveryMin * 60000) {
        gm.decayMs -= B.decayEveryMin * 60000;
        if (gm.backlog > 0) gm.backlog = Math.max(0, gm.backlog - (D.gmRequests(s).length ? B.decay : B.emptyDecay));
      }
      if (!(gm.backlog > 0)) gm.decayMs = 0;
      if (gm.waiting && s.clock.played >= gm.waiting.untilPlayed) { delete gm.waiting; ev.push({ type: 'gmWaitingOver', name: gm.name }); }
      if (gm.training && s.clock.played >= gm.training.untilPlayed) {
        gm.skill = Math.min(GM.thinkSeconds.length, gm.training.to || (gm.skill || 1) + 1);
        delete gm.training;
        gmLog(s, NOW, 'trained', { skill: gm.skill });
        ev.push({ type: 'gmTrained', name: gm.name, skill: gm.skill });
      }
      // a strike = chaos rules for the zone: −strikeMoralePerMin per minute (inside the day's morale cap)
      if (gm.strike) moraleHit(s, D.gmZone(s), PENALTY.strikeMoralePerMin * min);
    }
    remindDue(s, ev);
    expireDue(s, ev); // the tasks moved to the grace point expire under the return cap…
    settleGm(s, ev);
    if (s.gm?.returnCap && s.clock.played > s.gm.returnCap.untilPlayed) delete s.gm.returnCap; // …which closes after them
  },

  // ---------- Level 10 region expiration ----------
  // Two-phase and idempotent: 'pending' (cinematic playing, gameplay paused) → execute → 'reset' (choose a new region).
  // follower: uid of the unit you agreed to take along (D.followerCandidate; the HUD asks first), or null.
  'expiry/execute'(s, { follower = null } = {}, ev, ctx) {
    const ex = s.story.expiry;
    if (!ex) return fail('none');
    if (ex.status === 'reset') { s.story.phase = s.world.currentRegion ? 'play' : 'chooseRegion'; return { noop: true }; }
    // Founder rule: the incident is a FULL restart. Nothing is kept except who you are (character, story, rebirth
    // credits/blessings, auto runs, tutorial done). The new region starts with exactly 1 empty field and an empty café.
    // A full copy of the save is written to `<key>-pre-expiry` by the store just before this runs.
    ex.snapshot = { coins: s.player.coins, xp: s.player.xp, round: s.player.round, beans: s.inventory.beans, beanMix: { ...s.inventory.beanMix }, items: { ...s.inventory.items },
      regions: Object.keys(s.world.regions), units: s.staff.units.length };
    // A running Auto run pauses with its time kept (autoplay.saved): the new region starts with no field to work.
    handlers['auto/stop'](s, { reason: 'region' }, ev, ctx);
    // USD stays (it is the account's, whatever happens to a farm); every farm's Gold goes with the full restart.
    W.addLedger(s, ctx.now, { kind: 'expiry', gold: -W.totalGold(s), regionId: ex.regionId });
    s.wallet.gold = {}; s.wallet.books = {};
    s.player.coins = startCoins();
    s.player.xp = 0;
    s.player.round = 1;
    s.inventory.beans = 0;
    s.inventory.beanMix = {};
    s.inventory.items = Object.fromEntries(ITEM_GOODS.map(g => [g, 0])); // processed goods go too (full restart)
    // The one who follows you keeps who it is (stats, rank, gear, craft) and starts unassigned, wage-paid (FOLLOW).
    const keep = follower != null ? s.staff.units.find(u => u.uid === follower) : null;
    // Every unit that does not come along (and the manager) keeps a tombstone, so its rows stay readable.
    for (const u of s.staff.units) if (u !== keep) tombstone(s, u.uid, u.name || u.serial || null, STAFF[u.type].kind, ctx.now);
    if (s.gm?.unit) tombstone(s, 'g1', s.gm.unit.name, 'manager', ctx.now);
    s.staff.units = [];
    if (keep) {
      const robot = STAFF[keep.type].kind === 'robot';
      const u = { ...keep, assigned: null, active: false, follower: true, followedAt: ctx.now, book: { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: ctx.now }, days: [] };
      delete u.stopped; delete u.breakUntil; delete u.eligibleAt;
      if (robot) u.evolved = true;
      s.staff.units.push(u);
      note(u, ctx.now, 'followed', { robot });
      ev.push({ type: 'followerKept', uid: u.uid, name: u.name || u.serial || null, robot });
    }
    Object.assign(s.staff, { ledger: [], daily: [], upkeepAt: 0, mvp: null, gearStock: [] });
    // The manager goes too (full restart); his board and the player's licences stay (management-rules §5 / §8 Q6).
    s.gm = { ...newGmState(), board: s.gm?.board || newGmState().board, licences: [...(s.gm?.licences || [])] };
    // Inbox: what was open is cancelled (its people are gone), the answered list stays.
    const T = tasksOf(s);
    for (const t of [...T.open]) closeTask(s, t, 'cancelled');
    for (const t of T.done) if (t.by === 'g1') t.lateOff = true; // the old manager's requests are never approved late
    T.cool = {}; T.fines = [];
    // History: days and tombstones stay; every plan / approval row (the manager's trail) stays, the other rows are
    // trimmed to the newest HISTORY.keepOthersOnWipe; a 'rebirth' row marks the new start.
    const H = histOf(s), keepG = new Set(HISTORY.keepGroupsOnWipe);
    const others = new Set(H.rows.filter(r => !keepG.has(r.group)).slice(-HISTORY.keepOthersOnWipe).map(r => r.id));
    H.rows = H.rows.filter(r => keepG.has(r.group) || others.has(r.id));
    // Wage arrears: the GM's go with it; the follower's stay only if that same follower comes along again.
    // The played clock (s.clock) and the loans (s.loans) are kept; the income series starts over with the new region.
    s.debt = { wages: { gm: 0, follower: keep?.follower ? (s.debt?.wages?.follower || 0) : 0 } };
    s.income = { rows: [] };
    s.rewards = { claimed: [], tickets: 0 }; // gifts are earned again from level 1
    // The loan is NOT wiped: a debt is a debt, it carries over to the new region (and is never announced in advance).
    for (const ln of s.loans) ln.regionId = null;
    s.world.regions = { [ex.regionId]: { ...normalizeRegion({ status: 'expired' }), expiredAt: ctx.now } };
    s.world.ownedRegions = [];   // the next region is free again (first-region rule)
    s.world.freeUnlocks = 0;
    ex.status = 'reset';
    ex.at = ctx.now;
    s.story.level10Done = true;
    s.world.currentRegion = null;
    s.mode = null; // the next region picks its game again
    s.story.phase = 'chooseRegion';
    hist(s, { type: 'rebirth', actor: 'system', group: 'event', extra: { regionId: ex.regionId, follower: keep?.uid || null } });
    ev.push({ type: 'regionExpired', regionId: ex.regionId });
  },

  // ---------- rebirth (credits independent from Rounds) ----------
  'rebirth/perform'(s, { blessing }, ev) {
    const err = D.rebirthError(s, blessing);
    if (err) return fail(err);
    s.rebirth.credits--;
    s.rebirth.used++;
    s.rebirth.blessings[blessing] = (s.rebirth.blessings[blessing] || 0) + 1;
    s.rebirth.history.push({ blessing, level: D.level(s), round: s.player.round });
    ev.push({ type: 'reborn', blessing, credits: s.rebirth.credits });
  },
  // Credits from a verified purchase. No real store is wired: only the dev/test profile may call this (ctx.dev).
  'rebirth/addCredits'(s, { amount, source }, ev, ctx) {
    if (!ctx.dev && source !== 'receipt') return fail('forbidden');
    if (source === 'receipt' && !ctx.verifiedReceipt) return fail('unverified');
    const n = Math.max(0, Math.min(99, amount | 0));
    s.rebirth.credits += n; s.rebirth.purchased += n;
    ev.push({ type: 'creditsAdded', amount: n, source });
  },

  // ---------- tutorial ----------
  // done + track ('farm' | 'cafe'): skip that game's tutorial; done alone: skip both.
  'tutorial/set'(s, { step, done, track }) {
    if (Number.isFinite(step)) s.tutorial.step = Math.max(s.tutorial.step, step | 0);
    if (done === true) {
      if (track === 'farm' || track === 'cafe') s.tutorial[`${track}Done`] = true;
      else { s.tutorial.farmDone = true; s.tutorial.cafeDone = true; }
      if (s.tutorial.farmDone && s.tutorial.cafeDone) s.tutorial.done = true;
    }
  },

  // ---------- game choice (farm | café) ----------
  // The game the current region is played as, picked on its first entry: one of the games its country offers
  // (some countries offer only one). Once per region.
  'play/chooseGame'(s, { game }) {
    if (game !== 'farm' && game !== 'cafe') return fail('invalid');
    const r = D.region(s);
    if (!r) return fail('phase');
    if (r.mode) return { noop: true };
    if (!D.currentGames(s).includes(game)) return fail('gameLocked');
    r.mode = game;
    s.mode = game;
  },
  // The game on screen (follows the view): only the current region's game.
  'play/setMode'(s, { mode }) {
    if (mode !== 'farm' && mode !== 'cafe') return fail('invalid');
    if (!D.canPlay(s, mode)) return fail('gameLocked');
    if (s.mode === mode) return { noop: true };
    s.mode = mode;
  },

  // ---------- dev / QA (test profile only) ----------
  'dev/grant'(s, { coins = 0, xp = 0, beans = 0 }, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const fin = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
    coins = fin(coins); xp = fin(xp);
    if (coins > 0) earn(s, coins, ev);
    if (beans) addBeans(s, 'robusta', beans | 0);
    if (xp > 0) grantXp(s, xp / D.xpMultiplier(s), ev);
  },
  // QA URL params (?profile=test&coins=…&beans=…&level=…): set exact values (test profile only).
  'dev/set'(s, { coins, beans, level }, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    if (n(coins) != null) s.player.coins = Math.max(0, Math.min(1e15, n(coins)));
    if (n(beans) != null) s.inventory.beans = Math.max(0, Math.min(1e9, Math.floor(n(beans))));
    if (n(level) != null) {
      // Below the Level-10 incident unless it already happened (setting XP never triggers it here).
      const cap = s.story.level10Done || !EXPIRY_ENABLED ? MAX_LEVEL : EXPIRY_LEVEL - 1;
      s.player.xp = xpForLevel(Math.max(1, Math.min(cap, Math.floor(n(level)))));
    }
  },
  'dev/ripen'(s, _p, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const r = D.region(s);
    if (!r) return;
    for (const p of Object.values(r.plots)) p.plantedAt = ctx.now - 1e9;
  },
};

export const ACTIONS = Object.keys(handlers);
// The café loop is frozen while the café is paused (player on the farm): no customers, no orders moving.
// The whole street pauses with it (venue sales and reviews); unlocking a venue (shop/openVenue) still works.
const CAFE_LOOP = new Set(['shop/spawnCustomer', 'shop/customerLeft', 'shop/takeOrder', 'shop/brew', 'shop/serve', 'shop/spill', 'shop/venueSale', 'shop/review']);

/**
 * @param {object} state  current save (not mutated)
 * @param {{type:string, payload?:object, txId?:string}} action
 * @param {{now:number, dev?:boolean}} ctx
 */
export function apply(state, action, ctx = { now: Date.now() }) {
  const handler = handlers[action?.type];
  if (!handler) return { ok: false, state, events: [], error: 'unknownAction' };
  if (action.txId && state.tx.includes(action.txId)) return { ok: true, state, events: [], duplicate: true };
  if (PAUSABLE.test(action.type) && state.story.phase === 'expiry') return { ok: false, state, events: [], error: 'paused' };
  if (/^(farm|shop|build|land|prod|staff|rival|gm|task|research|supply|farmlab)\//.test(action.type) && (state.story.phase !== 'play' || !state.world.currentRegion)) {
    return { ok: false, state, events: [], error: 'notPlaying' };
  }
  if (CAFE_LOOP.has(action.type) && D.shopPaused(state)) return { ok: false, state, events: [], error: 'cafeClosed' };
  const draft = clone(state);
  const events = [];
  ACTOR = actorOf(action.type, action.payload);
  NOW = ctx.now;
  CUR = draft;
  TYPE = action.type;
  let result;
  try { result = handler(draft, action.payload || {}, events, ctx) || {}; } finally { ACTOR = 'player'; CUR = null; TYPE = ''; }
  if (result.ok === false) return { ok: false, state, events: [], error: result.error, data: result.data };
  if (result.noop) return { ok: true, state, events: [], noop: true };
  W.mirrorRegister(draft);
  if (action.txId) draft.tx = [...draft.tx, action.txId].slice(-TX_KEEP);
  draft.rev = (state.rev || 0) + 1;
  draft.updatedAt = ctx.now;
  return { ok: true, state: draft, events };
}
