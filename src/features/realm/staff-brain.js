// Café staff decisions, pure (no three.js, no store): staff.js feeds plain data in and turns the answers into walking,
// claims and dispatches. Kept apart so node:test can check the rules (tests/core/staff-ai.test.mjs).
//  · Posts (assignPosts): from the WORKING shop units, stable order by uid — 1 → allRounder; 2 → cashier + barista;
//    3+ → cashier, barista, the rest runners. A brewBot prefers the barista post; robots are kept off the cashier post
//    when a worker can take it. A stopped unit (break) gets no post, so the others re-spread over the posts.
//  · Jobs (pickShopJob): a unit does its post's jobs first (POST_JOBS, in that order), then any other job — but leaves a
//    non-post job to an idle unit whose post owns it (ctx.ownerIdle), so roles do not race; nobody idles while work waits.
//      deliver: a READY cup (not in the player's hand, unclaimed, its customer seated) — most urgent first;
//      brew:    a taken order, a free brew slot, enough beans for the most urgent taken order, brew station free;
//      order:   someone at the queue head, order station free, a free seat, and beans (orderBlock).
//  · orderBlock: why the head of the queue is not served — 'noQueue' | 'noSeat' | 'noBeans' | null. Beans count as
//    "there" when the beans left after the taken orders' needs are ≥ 1, or something is brewing, or the player can buy
//    a paid pack (ctx.canBuyBeans).
//  · Chaining: after starting a brew of ≤ CHAIN_WAIT_MS, a unit whose post delivers waits at the pad and carries it.
//  · Two cups (secondCup): a worker holding one ready cup takes a second one whose seat is ≤ TWO_CUP_M from the first;
//    nearestFirst orders the stops.
//  · Urgency: seat patience ratio ≥ URGENT_RATIO (≤ 30 % patience left) → walk URGENT_SPEED × faster.
//  · Lanes (facing / yieldsTo): two walking units meeting head-on within LANE_M → the lower uid steps aside.
//  · Worker tasks (docs/design/staff-manager.md §6): ctx.onlyAny = the worker's tasks (empty / null = any job). Only
//    those types are tried; when none of them is its post's job they count as its own jobs (no hand-off). Posts put a
//    unit whose tasks allow 'order' on the cashier post and one allowing 'brew' on the barista post when they can.
//  · Staff manager realm rules (§3, §4, §9): poseOf (what a unit looks like for its state), knockStep (3 taps on a
//    jammed robot), vitalsInterval / vitalsNoop / timerDue (when a vitals batch is sent at all).
// ctx for pickShopJob / orderBlock (all optional except orders):
//   { post, orders, now, carrying, claimed(key), ownerIdle(type), hasSeat(orderId), queued, seatsFree, brewSlots,
//     beans, canBuyBeans, need(drink) → beans per cup, patience(order) → seat patience ratio 0..1 (higher = angrier),
//     only (a robot's one task), onlyAny (a worker's tasks) }

import { STAFF_SIM } from '../../core/config/economy.js';

export const POSTS = ['allRounder', 'cashier', 'barista', 'runner'];
export const POST_JOBS = { allRounder: ['deliver', 'brew', 'order'], cashier: ['order'], barista: ['brew', 'deliver'], runner: ['deliver'] };
export const JOB_TYPES = ['deliver', 'brew', 'order'];
// Numbers live in core config (STAFF_SIM); kept here under their old names for the brain and its callers.
export const CHAIN_WAIT_MS = STAFF_SIM.chainWaitMs;
export const TWO_CUP_M = STAFF_SIM.twoCupM;
export const URGENT_RATIO = STAFF_SIM.urgentRatio;
export const URGENT_SPEED = STAFF_SIM.urgentSpeed;
export const LANE_M = STAFF_SIM.laneM;

// Natural uid order: 's2' < 's10' (uids are prefix + counter); numbers and odd values still compare stably.
export function uidCompare(a, b) {
  const sa = String(a), sb = String(b);
  const na = /(\d+)$/.exec(sa), nb = /(\d+)$/.exec(sb);
  if (na && nb) {
    const pa = sa.slice(0, na.index), pb = sb.slice(0, nb.index);
    if (pa === pb) return Number(na[1]) - Number(nb[1]);
  }
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Robot auto mode: the task with the most work waiting (counts: { [task]: n }); ties keep `current`. */
export function autoTask(tasks, counts, current) {
  let best = tasks.includes(current) ? current : tasks[0], bn = counts[best] || 0;
  for (const t of tasks) if ((counts[t] || 0) > bn) { best = t; bn = counts[t]; }
  return best;
}
/** Post a robot idles at for its task (robots get no shared post: they do one task). */
export const ROBOT_POST = { order: 'cashier', brew: 'barista', deliver: 'runner' };

/** A unit's tasks allow job `type` (no tasks = every job). */
export const allows = (tasks, type) => !tasks || !tasks.length || tasks.includes(type);

/** units: [{ uid, type, stopped?, active?, tasks? }] (shop zone) → Map uid → post. Stopped / benched units are left out. */
export function assignPosts(units) {
  const posts = new Map();
  const list = (units || []).filter(u => u && u.uid != null && !u.stopped && u.active !== false).sort((a, b) => uidCompare(a.uid, b.uid));
  if (!list.length) return posts;
  if (list.length === 1) { posts.set(list[0].uid, 'allRounder'); return posts; }
  const bot = list.find(u => u.type === 'brewBot');
  const rest = list.filter(u => u !== bot);
  let barista = bot || null;
  let cashier;
  if (barista) cashier = rest.find(u => u.type !== 'brewBot' && allows(u.tasks, 'order')) || rest.find(u => u.type !== 'brewBot') || rest[0];
  else {
    cashier = list.find(u => allows(u.tasks, 'order')) || list[0];
    barista = list.find(u => u !== cashier && allows(u.tasks, 'brew')) || list.find(u => u !== cashier);
  }
  posts.set(cashier.uid, 'cashier');
  posts.set(barista.uid, 'barista');
  for (const u of list) if (!posts.has(u.uid)) posts.set(u.uid, 'runner');
  return posts;
}

/** Job types in the order a post tries them: its own jobs first, then the others. */
export function jobsFor(post) {
  const own = POST_JOBS[post] || JOB_TYPES;
  return [...own, ...JOB_TYPES.filter(t => !own.includes(t))];
}

export const isReady = (o, now) => !!o && o.stage === 'brewing' && now - o.brewStart >= o.brewMs;
const patienceOf = (ctx, o) => (ctx.patience ? ctx.patience(o) : 0) || 0;
const needOf = (ctx, o) => (ctx.need ? ctx.need(o.drink) : 1) || 1;
const isClaimed = (ctx, key) => !!ctx.claimed?.(key);

// The order that most needs it (highest seat patience ratio = closest to leaving angry). A worker below the 'urgent'
// level (ctx.urgent === false) just takes the first one in line.
export function mostUrgent(ctx, test) {
  if (ctx.urgent === false) { for (const o of ctx.orders || []) if (o && test(o)) return o; return null; }
  let best = null, bp = -1;
  for (const o of ctx.orders || []) if (o && test(o)) { const p = patienceOf(ctx, o); if (p > bp) { bp = p; best = o; } }
  return best;
}
const deliverable = (ctx, o) => isReady(o, ctx.now) && o.id !== ctx.carrying && !isClaimed(ctx, `order:${o.id}`) && !!ctx.hasSeat?.(o.id);

/** Why the queue head is not served now: 'noQueue' | 'noSeat' | 'noBeans' | null (= can take it). */
export function orderBlock(ctx) {
  if (ctx.queued == null) return 'noQueue';
  if (!(ctx.seatsFree > 0)) return 'noSeat';
  // A brewing cup already paid its beans: it frees nothing for the next order, so it does not count.
  let left = Number(ctx.beans) || 0;
  for (const o of ctx.orders || []) if (o && o.stage === 'taken') left -= needOf(ctx, o);
  if (left >= 1 || ctx.canBuyBeans) return null;
  return 'noBeans';
}

/** One candidate of a job type, or null. */
export function candidate(ctx, type) {
  const orders = ctx.orders || [];
  if (type === 'deliver') {
    const o = mostUrgent(ctx, x => deliverable(ctx, x));
    return o ? { type, orderId: o.id } : null;
  }
  if (type === 'brew') {
    if (isClaimed(ctx, 'station:brew')) return null;
    let brewing = 0;
    for (const o of orders) if (o?.stage === 'brewing') brewing++;
    if (brewing >= (ctx.brewSlots || 1)) return null;
    // ctx.canHard === false: a robot / a worker below the hard-drink level skips hard drinks (ctx.isHard), the player makes them.
    const taken = mostUrgent(ctx, o => o.stage === 'taken' && (ctx.canHard !== false || !ctx.isHard?.(o.drink)));
    if (!taken || (Number(ctx.beans) || 0) < needOf(ctx, taken)) return null;
    return { type, orderId: taken.id };
  }
  if (type === 'order') {
    if (isClaimed(ctx, 'station:order') || orderBlock(ctx)) return null;
    return { type, orderId: ctx.queued };
  }
  return null;
}

/** The job this unit should start now ({ type: 'deliver'|'brew'|'order', orderId }) or null (idle at post). */
// ctx.only = a robot's one task: it tries that job type and nothing else.
// ctx.onlyAny = a worker's tasks: only those types; if none is its post's job, they are its own (no hand-off).
export function pickShopJob(ctx) {
  if (ctx.only) return JOB_TYPES.includes(ctx.only) ? candidate(ctx, ctx.only) : null;
  const any = ctx.onlyAny?.length ? ctx.onlyAny : null;
  const post = POST_JOBS[ctx.post] || JOB_TYPES;
  let own = any ? post.filter(t => any.includes(t)) : post;
  if (any && !own.length) own = any;
  for (const type of jobsFor(ctx.post)) {
    if (any && !any.includes(type)) continue;
    if (!own.includes(type) && ctx.ownerIdle?.(type)) continue; // its owner is free and will take it
    const job = candidate(ctx, type);
    if (job) return job;
  }
  return null;
}

/** Chain: after starting a brew, wait at the pad and carry it when it is that quick and the post delivers. */
export const waitsForBrew = (post, brewMs) => Number.isFinite(brewMs) && brewMs <= CHAIN_WAIT_MS && (POST_JOBS[post] || JOB_TYPES).includes('deliver');

/** Second cup for a worker already holding firstId (seat firstSeat): ready, deliverable, seat within TWO_CUP_M. */
export function secondCup(ctx, firstId, firstSeat) {
  if (!firstSeat) return null;
  return mostUrgent(ctx, o => {
    if (o.id === firstId || !deliverable(ctx, o)) return false;
    const s = ctx.seatOf?.(o.id);
    return !!s && Math.hypot(s.x - firstSeat.x, s.z - firstSeat.z) <= TWO_CUP_M;
  });
}

/** Sorts stops [{ x, z, … }] in place: nearest to `from` first, then nearest to the previous stop. */
export function nearestFirst(from, stops) {
  let px = from.x, pz = from.z;
  for (let i = 0; i < stops.length - 1; i++) {
    let bi = i, bd = Infinity;
    for (let k = i; k < stops.length; k++) { const d = Math.hypot(stops[k].x - px, stops[k].z - pz); if (d < bd) { bd = d; bi = k; } }
    if (bi !== i) { const tmp = stops[i]; stops[i] = stops[bi]; stops[bi] = tmp; }
    px = stops[i].x; pz = stops[i].z;
  }
  return stops;
}

/** Walk speed factor for a job whose customer has this seat patience ratio. */
export const urgencyK = ratio => (ratio >= URGENT_RATIO ? URGENT_SPEED : 1);

/** Two walkers heading at each other (yaw: atan2(dx, dz) of travel) within LANE_M. */
export function facing(ax, az, ayaw, bx, bz, byaw, range = LANE_M) {
  const dx = bx - ax, dz = bz - az, d = Math.sqrt(dx * dx + dz * dz); // every pair walking, every frame
  if (!(d > 0) || d > range) return false;
  const a = (Math.sin(ayaw) * dx + Math.cos(ayaw) * dz) / d;
  const b = -(Math.sin(byaw) * dx + Math.cos(byaw) * dz) / d;
  return a > .7 && b > .7;
}
/** Which of two units steps aside in a lane: the lower uid. */
export const yieldsTo = (uidA, uidB) => (uidCompare(uidA, uidB) <= 0 ? uidA : uidB);

/** Would this unit take job `type` at all (robot task, worker tasks, else its post's jobs)? */
export function ctxTakes(ctx, type) {
  if (ctx.only) return ctx.only === type;
  if (ctx.onlyAny?.length) return ctx.onlyAny.includes(type);
  return (POST_JOBS[ctx.post] || JOB_TYPES).includes(type);
}

// ---------- staff manager (docs/design/staff-manager.md §3, §4, §9) ----------
/**
 * Realm timers (seconds). Vitals are batched per unit; a big team stretches the batch so the store (which saves and
 * re-syncs the whole realm on every change) sees at most maxDispatchPerSecond vitals dispatches. stateSeconds = how
 * often a unit's time-based state (lunch / overheat end) is re-read. Rival visits / MVP use RIVAL / BOOKS (economy.js).
 */
export const TICKS = { vitalsSeconds: 5, maxDispatchPerSecond: 2, upkeepSeconds: 60, stateSeconds: .5 };
/** Seconds between two vitals batches of one unit, for a team of n units on screen logic. */
export const vitalsInterval = n => Math.max(TICKS.vitalsSeconds, (n | 0) / TICKS.maxDispatchPerSecond);

/**
 * A vitals batch that would change nothing is not sent: a worker only resting at full energy (a funny one also at full
 * morale), a cold robot that only rested and finished no job. v: { robot, energy, max, morale, funny, heat }.
 */
export function vitalsNoop(v, work, jobs = 0) {
  if (work > 0 || jobs > 0) return false;
  if (v.robot) return !((v.heat || 0) > 0);
  return (v.energy ?? 100) >= v.max && (!v.funny || (v.morale ?? 0) >= 100);
}
/** A lunch break or an overheat cool-down is over: one vitals batch clears it in the save. */
export const timerDue = (u, now) => (Number.isFinite(u?.breakUntil) && now >= u.breakUntil)
  || (u?.stopped?.kind === 'overheat' && Number.isFinite(u.stopped.until) && now >= u.stopped.until);

/**
 * How a unit looks for its state (D.unitState): 'stop' (phone / battery / overheat / jam), 'bench' (walks to the rest
 * spot, idles), 'sit' (lunch, or exhausted at 0 energy), 'sulk' (stands still, turned away), 'stand' (another blocking
 * need, e.g. starving), 'work' (ok / hungry / tired: works, slower).
 */
export const STOP_STATES = ['funny', 'phone', 'battery', 'overheat', 'jam'];
export function poseOf(state, bench, blocked, energy = 100) {
  if (STOP_STATES.includes(state)) return 'stop';
  if (bench) return 'bench';
  if (state === 'lunch') return 'sit';
  if (state === 'sulking') return 'sulk';
  if (blocked) return energy <= 0 ? 'sit' : 'stand';
  return 'work';
}
/** Icon key over the head: the state (bench → 'bench'); '' when all is fine. */
export const stateIconKey = (state, bench) => (STOP_STATES.includes(state) ? state : bench ? 'bench' : state === 'ok' ? '' : state);
/** The 🪙 fix bubble shows over poses that block work (not while working slower, not on the bench, not at lunch). */
export const showsFix = (pose, hasFix) => !!hasFix && pose !== 'work' && pose !== 'bench';

/** Knocking a jammed robot: taps closer than gapMs in a row count up; the `taps`-th sends staff/care knock. */
export const KNOCK = { taps: 3, gapMs: 1500 };
export const knockStep = (n, lastAt, now) => (now - lastAt <= KNOCK.gapMs ? (n | 0) + 1 : 1);
