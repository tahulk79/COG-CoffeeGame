// Street director (docs/design/cafe-street.md §3.6): turns crowd moments into little street scenes, all tied to real
// state and all numbers from INCIDENTS (core config). cafe.js / street.js / speech.js only offer primitives; this module
// decides. Hooks never act inside the caller's loop: they are queued and handled on the director's next update (one
// frame later), and every step re-checks that its order / walker still exists (null-safe when things vanish).
//  1. Crowd balk — the café spawn timer fired with a full queue (cafe onSpawnBlocked): balkChance → a transient walker
//     (no order) walks to the end of the line, stares, says `crowd`; then goes to an open lemon / tea shop with room
//     (`toLemon` / `toTea`, street.adopt), else the bar (barChance, `toBar`), else walks to a LOCKED lemon / tea
//     shutter (closedCurseChance, only once the player could open it level-wise) and swears `closed`, else just
//     leaves. balkReviewChance → a 1–2★ café review, reason 'crowd' (the HUD's crowd toast is rate-limited there).
//  2. Switch — a waiting café customer at ≤ switchAt queue patience (checked once per order, switchChance) goes to the
//     same kind of goal: customerLeft reason 'switch' (lemon / tea), 'bar' or 'closed' (+ 1★ review 'closed'; the
//     HUD toasts the unlock hint). The walker is claimed (cafe.claimLeave) BEFORE the dispatch so it walks there
//     instead of the exit. Venue queues: a waiting venue customer at switchAt may go to the bar (barChance) or to the
//     other open tea shop (street.divert → street.adopt).
//  3. Line cutting — a new arrival with ≥ 3 others in line (cutChance, one cut at a time) steps beside the head
//     (cafe.cut); the one behind the head says `cut`; 1.6 s later: cutFightChance (and the fight cooldown) → fight,
//     else the cutter says `cutSorry` and goes back to the end of the line (cafe.uncut).
//  4. Fight — two arrivals within FIGHT_WINDOW s while the line is ≥ 70 % of the cap (fightChance, fightCooldown):
//     cafe.fight (both shout `fight`, dust cloud) → both leave with reason 'fight', one 2★ review 'fight'.
//  5. Slow seat / patience — the café's own timeouts: a seated customer who gave up → 1★ 'slow' (+ quote); a queue
//     timeout → 50 % 2★ 'patience' (else just the grumble line).
//  6. Happy — every café serve reviews quietly: 5★ waited < 40 % of the seat patience, 4★ < 75 %, else 3★; a `happy`
//     line with happyLineChance (the speech gate keeps the chatter down).
// Review popups (speech.review) are rate-limited (POP_GAP); review dispatches are QUIET actions (no error toasts).
// Nothing happens while the café is paused (the street is frozen too) or while the café tutorial runs.
import { INCIDENTS, VENUES } from '../../core/config/economy.js';
import { VENUE_LOTS, venueQueueSlot } from '../../core/config/layout.js';
import { region as regionOf, venueOpen, venueError } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { sayKey, toneFor } from './speech.js';

const SCAN = .5;          // s between switch scans of the café line
const BALK_STARE = 1.4;   // s a balker stares at the line before deciding
const CUT_WAIT = 1.6;     // s between the cut and its outcome
const CURSE_STAY = 1.8;   // s a curser rants at the shutter before leaving
const FIGHT_WINDOW = 1.5; // s: two arrivals this close may fight
const POP_GAP = 4;        // s between review popups
const ROOM = .7;          // a venue "has room" while its line is below 70 % of its cap
const TEAS = ['lemon', 'tea'];
const SAY_TO = { lemon: 'toLemon', tea: 'toTea', bar: 'toBar' };
const QUOTE = { crowd: 'crowd', closed: 'closed', fight: 'fight', slow: 'slow', patience: 'patience' };

export function createIncidents({ cafe, street, speech = null, dispatch, getState, rng = Math.random }) {
  const I = INCIDENTS || {};
  const roll = () => { const r = +rng(); return Number.isFinite(r) ? r : Math.random(); };
  let clk = 0;                 // own clock (s): advances only while the café runs
  let scanT = 0;
  let lastFight = -Infinity, lastPop = -Infinity;
  const timers = [];           // { at, fn }
  const queue = [];            // hook events waiting for the next update: { type, ... }
  const checked = new Set();   // café order ids already rolled for a switch
  const cuts = new Map();      // cutter order id → victim order id
  const recent = [];           // last café arrivals: { id, at }

  // ---------- helpers ----------
  const state = () => (typeof getState === 'function' ? getState() : null);
  function active(s) {
    const r = s ? regionOf(s) : null;
    return !!r && s.story?.phase === 'play' && r.status === 'active' && !r.shop?.pausedAt && !currentStep(s, 'cafe');
  }
  function after(seconds, fn) { timers.push({ at: clk + seconds, fn }); }
  function line(obj, situation, priority = 1) {
    if (!obj || !speech) return false;
    return speech.say(obj, sayKey(situation, roll()), { tone: toneFor(situation), priority });
  }
  // Dispatch a review; a popup over `obj` (rate-limited) with a quote matching the reason. true = the popup showed.
  function review(venue, stars, reason, obj, popup = true) {
    const r = dispatch('shop/review', { venue, stars, reason });
    if (!r?.ok || !popup || !obj || !speech || clk - lastPop < POP_GAP) return false;
    const q = QUOTE[reason] || (stars >= 4 ? 'happy' : null);
    if (!q || !speech.review(obj, stars, sayKey(q, roll()))) return false;
    lastPop = clk;
    return true;
  }
  const waitingOrder = id => { const w = cafe.walker(id); return w && w.stage === 'waiting' ? w : null; };
  const aliveFree = w => !!w && !w.dropped && cafe.walkerById(w.id) === w;
  function venueRoom(s, id) {
    if (!venueOpen(s, id)) return false;
    const inf = street.info(id);
    return !!inf.open && inf.waiting.length < Math.max(1, Math.floor(inf.cap * ROOM));
  }
  // Where a fed-up customer walks to: the end of the venue's line (street.adopt re-slots them from there).
  function venueTail(id) {
    const inf = street.info(id);
    const at = venueQueueSlot(id, Math.min(inf.waiting.length, Math.max(0, inf.cap - 1))) || VENUE_LOTS[id].queue.head;
    return { x: at.x + (roll() - .5) * .4, z: at.z + .4 };
  }
  // In front of a locked shop's shutter (the counter blocker ends ~107 m; the queue head stands at 107.4).
  function shutterPoint(id) {
    const lot = VENUE_LOTS[id];
    return { x: lot.cx + (roll() - .5) * 1.6, z: lot.queue.head.z + .5 };
  }
  // Goal of an unhappy café customer: { kind: 'venue' | 'closed', id, say, reason, mood } or null (keeps waiting).
  function pickGoal(s) {
    for (const id of TEAS) if (venueRoom(s, id)) return { kind: 'venue', id, say: SAY_TO[id], reason: 'switch', mood: '🙄' };
    if (venueRoom(s, 'bar') && roll() < (I.barChance ?? .35)) return { kind: 'venue', id: 'bar', say: 'toBar', reason: 'bar', mood: '🍺' };
    // A locked shop is only cursed at once the player could open it (no level gate left): a hint, not noise.
    const locked = TEAS.find(id => !venueOpen(s, id) && venueError(s, id) !== 'level');
    if (locked && roll() < (I.closedCurseChance ?? .5)) return { kind: 'closed', id: locked, say: SAY_TO[locked], reason: 'closed', mood: '🙄' };
    return null;
  }

  // ---------- free walkers (balkers / leavers) ----------
  // Arrived at a venue line: the street makes its own copy (true = the café drops ours); full → grumble and leave.
  function adoptOrLeave(w, goal) {
    if (street.adopt(w, goal.id, { mood: goal.mood })) return true;
    cafe.mood(w, '😩');
    cafe.exitTo(w);
    return false;
  }
  // Arrived at a locked shutter: swear, then walk off.
  function curse(w) {
    line(w.person, 'closed', 2);
    cafe.mood(w, '💢', true);
    after(CURSE_STAY, () => { if (aliveFree(w)) cafe.exitTo(w); });
    return false;
  }
  function planFor(goal) {
    return goal.kind === 'venue'
      ? { target: venueTail(goal.id), mood: goal.mood, speed: 1.1, onArrive: w => adoptOrLeave(w, goal) }
      : { target: shutterPoint(goal.id), mood: goal.mood, onArrive: w => curse(w) };
  }

  // 1. crowd balk
  function balkDecide(w) {
    if (!aliveFree(w)) return;
    const s = state();
    if (!active(s)) { cafe.exitTo(w); return; }
    if (roll() < (I.balkReviewChance ?? .35)) review('cafe', roll() < .5 ? 1 : 2, 'crowd', w.person);
    const goal = pickGoal(s);
    if (!goal) { cafe.mood(w, '😩'); cafe.exitTo(w); return; }
    line(w.person, goal.say, 2);
    const p = planFor(goal);
    cafe.sendAway(w, p.target, p.onArrive, { mood: p.mood, speed: p.speed });
  }
  function onBalk(look) {
    if (roll() >= (I.balkChance ?? .7)) return;
    cafe.balk(look, w => {
      line(w.person, 'crowd', 1);
      cafe.mood(w, '😩');
      after(BALK_STARE, () => balkDecide(w));
      return false; // keep standing: balkDecide sends it on
    });
  }

  // 2. switch (café line)
  function scanSwitch(s) {
    const info = cafe.info();
    const sw = I.switchAt ?? .3;
    for (const e of info.waiting) {
      if (e.patience > sw || e.cut || e.fighting || !e.arrivedAt || !e.walker || checked.has(e.id) || cuts.has(e.id)) continue;
      checked.add(e.id);
      if (roll() >= (I.switchChance ?? .45)) continue;
      const goal = pickGoal(s);
      if (goal && doSwitch(e, goal)) break; // one walk-out per scan
    }
    if (checked.size > 64) { // forget orders that are gone
      const ids = new Set(info.waiting.map(e => e.id));
      for (const id of checked) if (!ids.has(id)) checked.delete(id);
    }
  }
  function doSwitch(e, goal) {
    const w = waitingOrder(e.id);
    if (!w || !cafe.claimLeave(e.id, planFor(goal))) return false;
    const r = dispatch('shop/customerLeft', { orderId: e.id, reason: goal.reason });
    if (!r?.ok) { cafe.unclaim(e.id); return false; }
    line(w.person, goal.say, 2);
    if (goal.kind === 'closed') review('cafe', 1, 'closed', w.person);
    return true;
  }
  // 2b. switch (venue line): lemon/tea → the bar, or the other tea shop (never to the café: it has no hand-off path).
  function venueLow(venue, cid) {
    const s = state();
    const c = street.walker(venue, cid);
    // Bar customers stay put (they came for a drink, not tea); lemon/tea guests try the bar or the other tea shop.
    if (venue === 'bar' || !c || c.stage !== 'queue' || roll() >= (I.switchChance ?? .45)) return;
    let to = null;
    if (venue !== 'bar' && venueRoom(s, 'bar') && roll() < (I.barChance ?? .35)) to = 'bar';
    else to = TEAS.find(id => id !== venue && venueRoom(s, id)) || null;
    if (!to) return;
    const mood = to === 'bar' ? '🍺' : '🙄';
    if (street.divert(venue, cid, venueTail(to), { mood, onArrive: cc => street.adopt(cc, to, { mood }) })) line(c.person, SAY_TO[to], 2);
  }

  // 3–4. arrivals: line cutting, fights
  function fightDone(a, b, { aborted } = {}) {
    cuts.delete(a); cuts.delete(b);
    if (aborted) { cafe.uncut(a); cafe.uncut(b); return; }
    const wa = cafe.walker(a) || cafe.walker(b);
    review('cafe', 2, 'fight', wa?.person);
    for (const id of [a, b]) if (waitingOrder(id)) dispatch('shop/customerLeft', { orderId: id, reason: 'fight' });
  }
  function canFight() { return clk - lastFight >= (I.fightCooldown ?? 40); }
  function startFight(a, b) {
    if (!canFight() || !cafe.fight(a, b, fightDone)) return false;
    lastFight = clk;
    return true;
  }
  function resolveCut(cutter) {
    const victim = cuts.get(cutter);
    if (victim === undefined) return;
    const w = waitingOrder(cutter);
    if (!w) { cuts.delete(cutter); return; }
    if (waitingOrder(victim) && roll() < (I.cutFightChance ?? .4) && startFight(cutter, victim)) return; // cuts cleared in fightDone
    cuts.delete(cutter);
    line(w.person, 'cutSorry', 2);
    cafe.uncut(cutter);
  }
  function arrived(id, at) {
    const me = waitingOrder(id);
    if (!me) return;
    const info = cafe.info();
    let n = 0, victim = null, head = null;
    for (const e of info.waiting) {
      if (e.id === id || e.cut || e.fighting || !e.walker) continue;
      n++;
      if (e.slot === 0) head = e; else if (e.slot === 1) victim = e;
    }
    victim ||= head;
    if (n >= 2 && victim && !cuts.size && roll() < (I.cutChance ?? .12) && cafe.cut(id)) {
      cuts.set(id, victim.id);
      line(victim.walker.person, 'cut', 2);
      after(CUT_WAIT, () => resolveCut(id));
    } else if (info.cap > 0 && info.waiting.length >= info.cap * .7 && canFight()) {
      const prev = recent.find(r => r.id !== id && at - r.at <= FIGHT_WINDOW && waitingOrder(r.id) && !cuts.has(r.id));
      if (prev && roll() < (I.fightChance ?? .1)) startFight(prev.id, id);
    }
    recent.push({ id, at });
    if (recent.length > 4) recent.shift();
  }

  // 5. the café's own timeouts
  function left(orderId, angry, reason) {
    if (reason && reason !== 'patience') return; // the director's own walk-outs are reviewed where they start
    const w = cafe.walkerById(orderId);
    const obj = w?.person || null;
    if (angry) { if (!review('cafe', 1, 'slow', obj)) line(obj, 'slow', 1); return; }
    if (!(roll() < .5 && review('cafe', 2, 'patience', obj))) line(obj, 'patience', 1);
  }
  // 6. happy serves
  function served(orderId, ratio) {
    const k = Number.isFinite(ratio) ? ratio : .5;
    const stars = k < .4 ? 5 : k < .75 ? 4 : 3;
    review('cafe', stars, 'served', null, false);
    if (stars >= 4 && roll() < (I.happyLineChance ?? .3)) line(cafe.walkerById(orderId)?.person, 'happy', 0);
  }

  function handle(ev, s) {
    switch (ev.type) {
      case 'balk': return onBalk(ev.look);
      case 'arrived': return arrived(ev.id, ev.at);
      case 'left': return left(ev.id, ev.angry, ev.reason);
      case 'served': return served(ev.id, ev.ratio);
      case 'venueLow': return venueLow(ev.venue, ev.cid);
      default: return undefined;
    }
  }
  const safe = (fn, ...a) => { try { fn(...a); } catch (e) { console.error('[incidents]', e); } };

  return {
    // ---------- per frame ----------
    update(dt, time, s = state(), now, playing = true) {
      const r = s ? regionOf(s) : null;
      if (!r || r.shop?.pausedAt) return; // frozen with the street
      clk += Math.min(dt || 0, .1);
      // Timers (cut outcomes, balk decisions, curses) are null-safe: they run whatever the state.
      if (timers.length) {
        for (let i = 0; i < timers.length; i++) {
          const tm = timers[i];
          if (tm.at > clk) continue;
          timers.splice(i--, 1);
          safe(tm.fn);
        }
      }
      const on = !!playing && active(s);
      if (queue.length) {
        const n = queue.length; // handlers may queue more: those wait for the next frame
        if (on) for (let i = 0; i < n; i++) safe(handle, queue[i], s);
        queue.splice(0, n);
      }
      if (!on) return;
      if ((scanT += dt) >= SCAN) { scanT = 0; safe(scanSwitch, s); }
    },
    // ---------- hooks (queued) ----------
    /** cafe hook: the spawn timer fired with a full queue (`look` = the would-be customer's look). */
    onCafeSpawnBlocked(look) { queue.push({ type: 'balk', look }); },
    /** cafe hook: a new walker reached its line slot. */
    onCustomerArrived(orderId) { queue.push({ type: 'arrived', id: orderId, at: clk }); },
    /** realm: a café order was served; waitedRatio = seat patience used (0..1). */
    onServed(orderId, waitedRatio) { queue.push({ type: 'served', id: orderId, ratio: waitedRatio }); },
    /** realm: shop/customerLeft event (angry = was seated; reason from the core). */
    onLeft(orderId, angry, reason) { queue.push({ type: 'left', id: orderId, angry: !!angry, reason: reason || 'patience' }); },
    /** street hook: a venue customer reached INCIDENTS.switchAt patience. */
    onVenueWaitingLow(venue, cid) { if (Object.hasOwn(VENUES, venue)) queue.push({ type: 'venueLow', venue, cid }); },
    /** street hooks: a venue customer left / was served (the street reviews those itself). */
    onVenueLeft() {},
    onVenueServed() {},
    clear() {
      timers.length = 0; queue.length = 0; recent.length = 0;
      checked.clear(); cuts.clear();
      lastFight = -Infinity; lastPop = -Infinity; scanT = 0;
    },
  };
}
