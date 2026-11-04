import { CROPS } from '../farm/content.js';
import { avoidanceStep } from '../../shared/game/collision.js';
import { ASSETS, CAFE_SHIFT_MS as SHIFT_MS, INCIDENTS, assetValue } from '../farm/rules.js';
import { rollSlack, traitOf, dislikeOf, tiredFactor, drain, regen, MORALE } from '../../shared/game/morale.js';
import { MAX_CREW, STAR_CAP, freshFor, resolveUses, RECIPES, SUPPLIES, TABLE_LEVELS, cafeRank, candidateById, lockReason, missingFor, recipeById, roleOf, staffEffects, stars } from './recipes.js';
import { formatNumber, t } from '../../i18n/index.js';

// Player-facing text: src/i18n/locales/cafe-recipes.js (svc.*). Layout point names below are dev-only (grid debugger) and stay Vietnamese.
const S = (key, params) => t(`cafeRecipes.svc.${key}`, params);
// Cup freshness (04-cafe/gameplay.md "Ly để lâu"): hot 60 s, iced 90 s of open-café time. Past that the cup is cold
// (−1★, −30% price); past twice that it is thrown away. A cup is stamped the first time anyone looks at its age.
const freshMs = d => freshFor(d.recipeId);
const cupAge = d => Date.now() - (d.madeAt ??= Date.now());
const isCold = d => cupAge(d) > freshMs(d);
const isSpoiled = d => cupAge(d) > 2 * freshMs(d);

// Floor plan shared with the 3D scene. The back counter runs along z=-10.6 with a staff lane behind it (z≈-12.15);
// every station is a fixed slot so upgrades fill slots instead of moving things, and walkers path-find around furniture.
export const COUNTER_Z = -10.6, LANE_Z = -12.15;
export const BAR_X = -7, STATIONS = [-9.5, -7, -4.5], REGISTERS = [-.2, 2.6], PICKUP_X = 6.6;
export const PASS = { x: -2.2, z: -9.6 };
export const KIOSKS = [4.6, 6.1];
// Tables unlock in this order (nearest the counter first).
// Spacing was set with the grid debugger: columns 3.8 m and rows 4.2 m apart leave a walkable gap even at sofa level.
// Tables 9–10 sit on the front porch; 11–12 are the garden tables that open with Sân vườn (gear 'terrace').
export const TABLES = [[-1.4, -7.4], [-5.2, -7.4], [-1.4, -3.2], [-5.2, -3.2], [-9, -7.4], [-9, -3.2], [-12.8, -7.4], [-12.8, -3.2], [6.5, 5.6], [10, 5.6], [-11.5, 6.3], [-6.5, 6.3]];
export const INDOOR_TABLES = 10;
export const DOOR = { x: 0, z: 8.6 };
// Guests stroll in along the sidewalk from either end of the street and leave the same way (no popping in).
const SIDEWALK_Z = 11, STREET_END = 18;
const streetEnd = side => ({ x: side * STREET_END, z: SIDEWALK_Z });
const GATE = { x: 0, z: 1.6 }, LOBBY = { x: 1.2, z: -2.4 }, STAFF_DOOR = { x: -12.2, z: -12.1 }, MAX_LINE = 6, SPEED = 2.4;
const registerFront = i => ({ x: REGISTERS[i], z: -9.3 });
const lineSpot = i => ({ x: 1.2, z: -8.3 + i * .9 });
const kioskFront = i => ({ x: KIOSKS[i], z: -5.7 });
const pickupSpot = i => ({ x: 5.6 + (i % 4) * .75, z: -9.3 + Math.floor(i / 4) * .8 });
// Seat slots: 0/1 left/right of the table, 2/3 behind/in front (only on 4-seat tables).
const SLOT = [[-.85, 0, Math.PI / 2], [.85, 0, -Math.PI / 2], [0, -.85, 0], [0, .85, Math.PI]];
export const seatPos = seat => ({ x: TABLES[seat.table][0] + SLOT[seat.slot][0], z: TABLES[seat.table][1] + SLOT[seat.slot][1] });
// Chairs are solid, so walkers path to a free spot just outside the chair and step in from there.
const seatStand = seat => ({ x: TABLES[seat.table][0] + SLOT[seat.slot][0] * 1.9, z: TABLES[seat.table][1] + SLOT[seat.slot][1] * 1.9 });
// Every spot a walker stands on, grouped for the grid debugger (?debug=grid) and its route audit.
export function layoutPoints() {
  const seats = TABLES.flatMap((_, table) => [0, 1, 2, 3].map(slot => ({ name: `ghế ${table + 1}.${slot + 1}`, kind: 'seat', ...seatStand({ table, slot }) })));
  return [
    { name: 'cửa', kind: 'customer', ...DOOR }, { name: 'cổng', kind: 'customer', ...GATE }, { name: 'sảnh', kind: 'customer', ...LOBBY },
    ...REGISTERS.map((_, i) => ({ name: `trước quầy thu ${i + 1}`, kind: 'customer', ...registerFront(i) })),
    ...[0, 1, 2, 3, 4, 5].map(i => ({ name: `hàng chờ ${i + 1}`, kind: 'customer', ...lineSpot(i) })),
    ...KIOSKS.map((_, i) => ({ name: `kiosk ${i + 1}`, kind: 'customer', ...kioskFront(i) })),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ name: `chờ mang đi ${i + 1}`, kind: 'customer', ...pickupSpot(i) })),
    ...seats,
    { name: 'cửa nhân viên', kind: 'staff', ...STAFF_DOOR }, { name: 'quầy giao ly', kind: 'staff', ...PASS },
    ...STATIONS.map((x, i) => ({ name: `trạm pha ${i + 1}`, kind: 'staff', x, z: LANE_Z })),
    ...REGISTERS.map((x, i) => ({ name: `sau quầy thu ${i + 1}`, kind: 'staff', x, z: LANE_Z })),
    { name: 'sau quầy nhận đồ', kind: 'staff', x: PICKUP_X, z: LANE_Z },
    ...[0, 1, 2].map(i => ({ name: `chỗ phục vụ ${i + 1}`, kind: 'staff', x: PASS.x + .6 - i * .7, z: PASS.z + .5 })),
    { name: 'chỗ tạp vụ', kind: 'staff', x: -11.6, z: -9 }, { name: 'chỗ quản lý', kind: 'staff', x: 3.4, z: -8.2 },
    ...TABLES.map(([x, z], i) => ({ name: `dọn bàn ${i + 1}`, kind: 'staff', x: x + 1.6, z })),
  ];
}
// Routes walkers actually take: [from name, to kind or name].
export const LAYOUT_ROUTES = [
  ['cửa', 'sảnh'], ['sảnh', 'hàng chờ 6'], ['sảnh', 'kiosk 1'], ['sảnh', 'kiosk 2'], ['hàng chờ 1', 'trước quầy thu 2'],
  ['trước quầy thu 1', 'seat'], ['trước quầy thu 1', 'chờ mang đi 8'], ['ghế 1.1', 'cổng'], ['ghế 10.4', 'cổng'],
  ['cửa nhân viên', 'trạm pha 3'], ['cửa nhân viên', 'sau quầy thu 2'], ['cửa nhân viên', 'sau quầy nhận đồ'], ['cửa nhân viên', 'chỗ quản lý'],
  ['quầy giao ly', 'seat'], ['quầy giao ly', 'chờ mang đi 1'], ['chỗ tạp vụ', 'dọn bàn 10'], ['chỗ phục vụ 3', 'dọn bàn 8'],
];
const PATIENCE = { queue: 55, seated: 80, pickup: 50 };
const COLORS = ['#aa785c', '#6f8fb0', '#b0667a', '#7e9a5c', '#c09a4f', '#8d74a8', '#5f9d95', '#c27a52'];
const key = seat => `${seat.table}:${seat.slot}`;
const AUTO_RECIPES = ['espresso', 'americano'];
// Rude warning bubble (robot-staff.md 4): tap the person within this time to stop it.
const RUDE_WARN_MS = 3000;
const round2 = n => Math.round(n * 100) / 100;

// onIncident({ id, name, type: 'phone'|'sick'|'rude', replace }): a person's incident just took effect (replace = «Thuê robot thay» can hire now).
// Shift rules (D2): goal grows 3 per effective brewing hand H (fractions of the menu a helper can make); the ★ average counts only the player's own cups (null = none, so only cups count).
export const shiftGoal = (rank, hands) => 4 + rank + Math.round(3 * hands);
// Guest pace (fun-review.md P3): the floor follows what the helpers can really brew, so a maxed café never out-arrives its own kitchen.
// 20 = seconds per cup when the player brews alone; 1.5 = one helper is worth about 1.5 players.
export const arrivalGap = (H, C, rep, tables, kiosk) => Math.max(3, 20 * (1 - C), 20 / (1 + 1.5 * H), Math.min(24, 9 + Math.max(0, 13 - 6.5 * H) - (rep - 50) * .06 - tables * .6 - kiosk));
export const canBrew = (e, mastery, id) => e.only ? id === e.only : e.recipes ? e.recipes.includes(id) : (mastery[id]?.best || 0) >= e.mastery;
// H = sum of each helper's share of the menu (only as many baristas as there are brew stations); C = share of the menu some helper covers.
export function brewForce(effects, mastery, menu, slots, autoEspresso) {
  const n = menu.length, cover = new Set();
  if (!n) return { H: 0, C: 0 };
  const list = effects.map(e => menu.filter(id => canBrew(e, mastery, id))).sort((a, b) => b.length - a.length).slice(0, slots);
  if (autoEspresso) list.push(menu.filter(id => AUTO_RECIPES.includes(id)));
  list.forEach(l => l.forEach(id => cover.add(id)));
  return { H: list.reduce((x, l) => x + l.length, 0) / n, C: cover.size / n };
}
export const shiftAvg = done => done.own ? done.ownStars / done.own : null;
export const shiftMissed = (done, avg) => !(done.served >= done.goal && (avg === null || avg >= 2));
export function createCafeService(farm, { notice, reward, route = (from, to) => [to], canStand = () => true, onShiftEnd = () => {}, fx = () => {}, onIncident = () => {} }) {
  const customers = [], shelf = [], dirty = new Set(), claims = new Set(), agents = new Map();
  let snap = farm.progress, hand = null, combo = 0, spawnIn = 3, seq = 0, drinkSeq = 0, autoJob = null, restockIn = 0, shift = null;
  const refresh = () => { snap = farm.progress; return snap; };
  const gear = id => snap.cafe.gear[id] || 0;
  // First three cups ever: customers wait 3× longer so a newcomer learning the bench (≈1–2 min a cup) is not punished.
  const learner = () => (snap.stats?.served || 0) < 3 ? 3 : 1;
  // Until the café intro is done: at most LEARN_GUESTS guests at once, walk-outs cost no reputation, a missed shift goal costs nothing.
  const LEARN_GUESTS = 2;
  const learning = () => { const p = farm.peek(); return !p.tutorial.seen.includes('cafe-intro') || !p.stats.served; };
  let orderedAt = 0;
  const indoorCount = () => assetValue(ASSETS.find(a => a.id === 'cafe'), snap.upgrades.cafe);
  const isOpen = table => table < INDOOR_TABLES ? table < indoorCount() : table < TABLES.length && gear('terrace') > 0;
  const tableCount = () => indoorCount() + (gear('terrace') ? TABLES.length - INDOOR_TABLES : 0);
  const tableLevel = table => TABLE_LEVELS[(snap.cafe.tables[table] || 1) - 1];
  const registers = () => 1 + gear('register2'), stations = () => 1 + gear('station');
  const line = () => customers.filter(c => c.phase === 'queue');
  const waiting = () => customers.filter(c => ['toSeat', 'seated', 'toPickup', 'pickup'].includes(c.phase));
  const label = c => c.seat ? S('table', { n: c.seat.table + 1 }) : S('takeaway');
  const act = (action, choice) => { const result = farm.act('cafe', action, choice); refresh(); return result; };
  const walk = (entity, to, finalStep = null) => { entity.path = [...route(entity.pos, to), ...(finalStep ? [finalStep] : [])]; };
  // Brewing hands besides the player: baristas able to make something on the menu, plus the robot espresso machine.
  // Sets the shift goal (P1) and how fast guests come (P3) in docs/screens/04-cafe/fun-review.md.
  function helpers() {
    const menu = RECIPES.filter(r => !lockReason(r, snap.cafe)).map(r => r.id);
    return brewForce([...agents.values()].filter(a => a.active && a.role === 'barista').map(a => a.effects), snap.cafe.mastery, menu, stations(), gear('autoEspresso'));
  }
  // The player's open bench: the most urgent guest still waiting for that drink loses patience at a quarter speed.
  let benching = null, benchTarget = null;
  const boost = () => { const m = [...agents.values()].find(a => a.role === 'manager' && a.active); return m ? staffEffects(m.person, m.level).boost : 1; };

  function move(entity, dt, speed = SPEED) {
    const target = entity.path[0];
    if (!target) return false;
    const dx = target.x - entity.pos.x, dz = target.z - entity.pos.z, distance = Math.hypot(dx, dz), step = speed * dt;
    if (distance <= step) { entity.pos.x = target.x; entity.pos.z = target.z; entity.path.shift(); }
    else { entity.pos.x += dx / distance * step; entity.pos.z += dz / distance * step; }
    if (distance > .01) entity.facing = Math.atan2(dx, dz);
    return true;
  }

  // Walkers (guests on their feet, staff, robots) step aside from each other and from the player instead of overlapping;
  // queue spots and staff homes pull them back once the way is clear.
  const SPACE = .66;
  function separate(dt, player) {
    const walkers = [...customers.filter(c => !['seated', 'drinking'].includes(c.phase) && !(c.phase === 'toSeat' && c.path.length <= 1)),
      ...[...agents.values()].filter(a => !a.left)];
    for (const w of walkers) {
      const others = walkers.filter(o => o !== w).map(o => o.pos);
      if (player) others.push(player);
      let near = null, best = SPACE;
      for (const o of others) { const d = Math.hypot(o.x - w.pos.x, o.z - w.pos.z); if (d < best) { best = d; near = o; } }
      if (!near) continue;
      const next = avoidanceStep(w.pos, near, others, Math.min(.06, dt * 1.6), canStand, w.side || 1);
      if (!next) continue;
      const cross = (w.pos.x - near.x) * (next.z - w.pos.z) - (w.pos.z - near.z) * (next.x - w.pos.x);
      if (Math.abs(cross) > 1e-6) w.side = Math.sign(cross); // keep dodging to one side instead of flip-flopping
      w.pos.x = next.x; w.pos.z = next.z;
    }
  }

  // ---- Customers ----
  function leave(c, mood, angry = false) {
    if (c.seat && c.phase === 'drinking') dirty.add(key(c.seat));
    const from = c.seat ? seatStand(c.seat) : null;
    c.phase = 'leaving'; c.mood = mood; c.seat = null; c.kiosk = null;
    const away = Math.random() < .5 ? -1 : 1;
    c.path = [...(from ? [from, ...route(from, GATE)] : route(c.pos, GATE)), DOOR, { x: 0, z: SIDEWALK_Z }, streetEnd(away)];
    if (angry) {
      const free = learning();
      if (!free) act('lost', 'angry');
      combo = 0; if (shift) { shift.lost++; shift.angry++; }
      notice(free ? S('angryFree') : S('angry'), false); fx('angry', { pos: { ...c.pos } });
    }
  }
  function spawn() {
    if (line().length >= MAX_LINE + registers()) { act('lost', 'busy'); if (shift) shift.lost++; notice(S('lineFull'), false); fx('turned', { pos: DOOR }); return; }
    fx('enter', { pos: DOOR });
    const side = Math.random() < .5 ? -1 : 1, start = streetEnd(side);
    const c = { id: ++seq, color: COLORS[seq % COLORS.length], phase: 'enter', inLine: false, pos: { x: start.x, z: start.z + (Math.random() - .5) * .6 }, path: [{ x: side * .4, z: SIDEWALK_Z }, DOOR, GATE],
      recipeId: null, seat: null, kiosk: null, patience: PATIENCE.queue * learner(), patienceMax: PATIENCE.queue * learner(), mood: null, timer: 0, facing: Math.PI };
    c.path.push(...route(GATE, LOBBY)); customers.push(c);
  }
  function freeSeat() {
    const taken = new Set(customers.filter(c => c.seat).map(c => key(c.seat)));
    const seats = [];
    for (let table = 0; table < TABLES.length; table++) if (isOpen(table)) for (let slot = 0; slot < tableLevel(table).seats; slot++) {
      const seat = { table, slot };
      if (!taken.has(key(seat)) && !dirty.has(key(seat))) seats.push(seat);
    }
    // Prefer an empty table so strangers do not share while space remains.
    return seats.find(s => !customers.some(c => c.seat?.table === s.table)) || seats[0] || null;
  }
  function pickRecipe() {
    const menu = RECIPES.filter(r => !lockReason(r, snap.cafe));
    // The shift's special is ordered three times as often.
    const weighted = menu.flatMap(r => r.id === shift?.special ? [r, r, r] : [r]);
    return weighted[Math.floor(Math.random() * weighted.length)];
  }
  // Places an order for a customer standing at a register or kiosk and sends them to a seat or the pickup area.
  function placeOrder(c, patienceBonus = 1) {
    const recipe = pickRecipe(), seat = freeSeat();
    fx('order', { pos: { ...c.pos }, kiosk: c.phase === 'kiosk' });
    c.recipeId = recipe.id; c.seat = seat; c.kiosk = null; c.inLine = false;
    if (seat) { c.phase = 'toSeat'; walk(c, seatStand(seat), seatPos(seat)); c.patience = c.patienceMax = PATIENCE.seated * tableLevel(seat.table).patience * patienceBonus * learner(); }
    else { c.phase = 'toPickup'; walk(c, pickupSpot(customers.filter(o => ['toPickup', 'pickup'].includes(o.phase)).length % 8)); c.patience = c.patienceMax = PATIENCE.pickup * learner(); }
    const why = seat ? '' : dirty.size ? S('whyDirty') : S('whyFull');
    return { ok: true, message: `${S('ordered', { who: label(c), drink: recipe.name })}${recipe.id === shift?.special ? ' ⭐' : ''}${why}` };
  }
  const atFront = c => c.phase === 'queue' && c.inLine && !c.path.length && line().indexOf(c) < registers();
  function takeOrder(c = line().find(o => atFront(o) && !claims.has(`order:${o.id}`)), patienceBonus = 1) {
    if (!c) return { ok: false, message: snap.cafe.open ? S('noGuest') : S('closed') };
    claims.delete(`order:${c.id}`);
    return placeOrder(c, patienceBonus);
  }
  function serve(c, drink, charm = 0) {
    // Robot cups (whoever carries them) never touch the player's combo or the shift goal (robot-staff.md 5).
    if (isCold(drink)) drink = { ...drink, stars: Math.max(0, drink.stars - 1), cold: true };
    const robot = Boolean(drink.robot), special = !robot && drink.recipeId === shift?.special;
    const result = act('sell', { recipeId: drink.recipeId, quality: drink.quality, stars: drink.stars, cold: Boolean(drink.cold), wait: 1 - c.patience / c.patienceMax, combo: robot ? 0 : combo, memory: drink.memory, table: c.seat ? c.seat.table : null, charm, special, robot, staff: Boolean(drink.staff) });
    if (!result.ok) { notice(result.message, false); return false; }
    if (result.walked) {
      const why = candidateById('gift-pha')?.fixedEffects.faults[drink.recipeId] || S('robotWrong');
      if (shift) shift.robotWalked++;
      leave(c, '😖'); fx('angry', { pos: { ...c.pos } });
      notice(S('robotRefused', { why }), false);
      return true;
    }
    if (!robot) combo = drink.stars >= 2 ? Math.min(5, combo + 1) : 0;
    const paid = Math.round((result.price + result.tip) * 100) / 100;
    if (shift) { if (!robot) { shift.served++; shift.stars += drink.stars; if (!drink.staff) { shift.own++; shift.ownStars += drink.stars; } } shift.revenue += paid; }
    reward(c.pos, paid); fx('serve', { pos: { ...c.pos }, stars: drink.stars, paid });
    const mood = ['😕', '🙂', '😊', '😍'][drink.stars];
    if (c.seat) { c.phase = 'drinking'; c.mood = mood; c.timer = 8; } else leave(c, mood);
    // Rebuilt here so numbers use the UI locale like the coin chip (model message uses raw "3.67").
    const num = n => formatNumber(n, { maximumFractionDigits: 2 });
    const sold = `${S('sale', { who: label(c), drink: recipeById(drink.recipeId).name, price: num(result.price) })}${drink.cold ? S('saleCold') : ''}${result.tip ? S('saleTip', { tip: num(result.tip) }) : ''}${special ? S('saleSpecial') : ''}${robot ? S('saleRobot') : combo > 1 ? S('saleCombo', { n: combo }) : ''}`;
    // Milestone leads the sale text, same as the farm (farm/game.js applyAction); only sell finishes quests here.
    notice(result.quests?.length ? t('farm.game.questDone', { quests: result.quests.join('”, “'), message: sold }) : sold);
    return true;
  }
  function clean(table) {
    const seats = [...dirty].filter(k => k.startsWith(`${table}:`));
    for (const k of seats) dirty.delete(k);
    claims.delete(`clean:${table}`);
    if (seats.length) fx('clean', { pos: { x: TABLES[table][0], z: TABLES[table][1] } });
    return seats.length;
  }
  // Drinks are matched by recipe, so a cup for a guest who left can go to the next guest ordering the same.
  const wants = drink => c => c.recipeId === drink.recipeId && ['seated', 'toSeat', 'pickup', 'toPickup'].includes(c.phase);
  const brewing = () => [...[...agents.values()].filter(a => a.job?.type === 'brew').map(a => a.job), ...(autoJob ? [autoJob] : [])];

  function tickets() {
    const supply = [...(hand ? [hand] : []), ...shelf, ...brewing(), ...[...agents.values()].flatMap(a => [a.carry, a.spare].filter(Boolean))].map(d => d.recipeId);
    return waiting().map(c => {
      const i = supply.indexOf(c.recipeId), covered = i >= 0;
      if (covered) supply.splice(i, 1);
      return { id: c.id, customer: c, recipe: recipeById(c.recipeId), label: label(c), ratio: c.patience / c.patienceMax, seconds: Math.max(0, Math.ceil(c.patience)), covered };
    });
  }

  // ---- Staff: one agent per hired, paid person; a shared job board hands out work by role and urgency ----
  function syncAgents() {
    const crew = snap.cafe.crew, now = Date.now();
    for (const id of [...agents.keys()]) if (!crew.some(m => m.id === id)) { releaseJob(agents.get(id)); agents.delete(id); }
    crew.forEach(m => {
      let a = agents.get(m.id);
      if (!a) { a = { id: m.id, person: candidateById(m.id), role: roleOf(m.id).id, pos: { ...STAFF_DOOR }, path: [], facing: 0, job: null, carry: null, spare: null, timer: 0, timerMax: 0, phoneUntil: 0, rude: null, energy: 100, slackUntil: 0, slack: null }; agents.set(m.id, a); }
      a.level = m.level; a.robot = a.person.kind === 'robot';
      a.effects = staffEffects(a.person, a.level);
      // The trial robot barista goes home once it has made its cups; sick staff (rest > 0) sit the shift out.
      a.left = Boolean(a.person.giftOnly && a.effects.cups && !a.job && (snap.robotGift?.cups || 0) >= a.effects.cups);
      a.sick = m.rest > 0;
      a.active = snap.cafe.open && m.paidUntil > now && !a.sick && !a.left;
    });
  }
  function home(a) {
    if (a.left) return { ...STAFF_DOOR };
    const same = [...agents.values()].filter(o => o.role === a.role), i = same.indexOf(a);
    if (a.role === 'cashier') return { x: REGISTERS[i % 2], z: LANE_Z };
    if (a.role === 'barista') return { x: STATIONS[i % 3], z: LANE_Z };
    if (a.role === 'waiter') return { x: PASS.x + .6 - i * .7, z: PASS.z + .5 };
    if (a.role === 'cleaner') return { x: -11.6, z: -9 };
    return { x: 3.4, z: -8.2 };
  }
  function releaseJob(a) {
    if (!a?.job) return;
    claims.delete(a.job.claim); if (a.job.second) claims.delete(a.job.second.claim);
    // job.cup: the trial robot's cup, already brewed (and paid for) when the job started.
    // After closing, a returned cup is waste, not shelf stock; otherwise it goes through addToShelf so a waiting take-away guest gets it.
    for (const cup of [a.carry, a.spare, a.job.cup]) if (cup) { if (shift) addToShelf(cup); else waste(cup, true); }
    a.carry = a.spare = null; a.job = null; a.timerMax = 0;
  }
  function assign(a, job) { a.job = job; claims.add(job.claim); if (job.second) claims.add(job.second.claim); walk(a, job.to); }
  // Đa nhiệm (crew-autoplay.md 2): from level 3 an idle person also serves cups and clears tables; robots keep their one job.
  const helps = a => !a.robot && a.level >= 3;
  function findJob(a) {
    const own = roleJob(a);
    return own || (helps(a) && !['waiter', 'cleaner'].includes(a.role) ? serveJob(a) : null);
  }
  function roleJob(a) {
    const e = a.effects;
    if (a.role === 'cashier') {
      const i = [...agents.values()].filter(o => o.role === 'cashier').indexOf(a);
      if (i >= registers()) return null;
      const c = line()[i];
      if (c && atFront(c) && !claims.has(`order:${c.id}`)) return { type: 'order', claim: `order:${c.id}`, customer: c.id, to: { x: REGISTERS[i], z: LANE_Z }, work: e.delay };
      return null;
    }
    if (a.role === 'barista') {
      const usedStations = brewing().filter(j => j.station !== undefined).map(j => j.station);
      const station = [...Array(stations()).keys()].find(s => !usedStations.includes(s));
      if (station === undefined) return null;
      if (e.recipes) return robotBrewJob(a, station);
      // The ticket the player is brewing at the bench is theirs: nobody brews the same order twice.
      const pending = tickets().filter(t => !t.covered && !claims.has(`brew:${t.id}`) && t.id !== benchTarget);
      const t = pending.find(t => e.only ? t.recipe.id === e.only : (snap.cafe.mastery[t.recipe.id]?.best || 0) >= e.mastery);
      // Tell the player which drink this barista still needs to be taught (a one-drink robot has nothing to learn).
      a.blocked = !t && pending.length && !e.only ? { recipe: pending[0].recipe, score: e.mastery } : null;
      const crop = t && [t.recipe.bean, ...CROPS.map(c => c.id)].find(id => !missingFor(t.recipe, snap.cafe, id).length);
      if (!crop) return null;
      return { type: 'brew', claim: `brew:${t.id}`, customer: t.id, recipeId: t.recipe.id, cropId: crop, station, to: { x: STATIONS[station], z: LANE_Z }, work: e.ms / 1000, score: e.score };
    }
    if (a.role === 'waiter' || a.role === 'cleaner') return serveJob(a);
    return null;
  }
  function serveJob(a) {
    const e = a.effects;
    {
      if (a.role !== 'cleaner') {
        // Most impatient guest first.
        const options = shelf.filter(d => !claims.has(`drink:${d.id}`)).map(d => [d, waiting().filter(c => wants(d)(c) && !c.path.length && (c.seat || !gear('pickup'))).sort((x, y) => x.patience / x.patienceMax - y.patience / y.patienceMax)[0]]).filter(([, c]) => c);
        if (options.length) {
          const [d, c] = options[0];
          // People carry a second cup if another guest waits for that drink and nobody holds it (robots carry 1).
          const pair = (e.carry || 1) > 1 && shelf.filter(d2 => d2 !== d && !claims.has(`drink:${d2.id}`))
            .map(d2 => [d2, waiting().find(c2 => c2 !== c && wants(d2)(c2) && !c2.path.length && (c2.seat || !gear('pickup')))]).find(([, c2]) => c2);
          return { type: 'deliver', claim: `drink:${d.id}`, drink: d.id, customer: c.id, stage: 'fetch', to: PASS, second: pair ? { claim: `drink:${pair[0].id}`, drink: pair[0].id, customer: pair[1].id } : null };
        }
      }
      const table = [...new Set([...dirty].map(k => Number(k.split(':')[0])))].find(t => !claims.has(`clean:${t}`));
      if (table !== undefined) return { type: 'clean', claim: `clean:${table}`, table, to: { x: TABLES[table][0] + 1.6, z: TABLES[table][1] }, work: (a.role === 'cleaner' ? e.cleanMs : 5000) / 1000 };
    }
    return null;
  }
  // Trial robot barista: only its recipes, no mastery gate, fixed score. The model checks gift beans and supplies before
  // taking anything, so the cup is brewed when the job starts; lacking anything → no job, ❓ with the model's reason.
  function robotBrewJob(a, station) {
    const e = a.effects, now = Date.now();
    const t = tickets().find(t => !t.covered && !claims.has(`brew:${t.id}`) && t.id !== benchTarget && e.recipes.includes(t.recipe.id));
    if (!t) { a.blocked = null; return null; }
    if (a.retryAt > now) return null;
    const result = act('brew', { recipeId: t.recipe.id, robot: 'gift' });
    if (!result.ok) { a.blocked = { recipe: t.recipe, missing: result.message }; a.retryAt = now + 2000; return null; }
    a.blocked = null;
    const cup = { id: ++drinkSeq, recipeId: t.recipe.id, quality: result.quality, stars: stars(e.score), memory: false, robot: true };
    return { type: 'brew', claim: `brew:${t.id}`, customer: t.id, recipeId: t.recipe.id, station, to: { x: STATIONS[station], z: LANE_Z }, work: e.ms / 1000, cup };
  }
  function finishJob(a) {
    const job = a.job;
    if (job.type === 'order') {
      const c = customers.find(c => c.id === job.customer && atFront(c));
      if (c) { const r = takeOrder(c, a.effects.patience); notice(`${a.person.person}: ${r.message}`); }
    } else if (job.cup) {
      addToShelf(job.cup);
    } else if (job.type === 'brew') {
      // Tired people lose 12 pts; staff cups stop at ★★, the robot barista's at ★.
      const score = Math.max(0, job.score - (!a.robot && a.energy < MORALE.tired ? 12 : 0));
      const result = act('brew', { recipeId: job.recipeId, cropId: job.cropId, score, staff: true });
      if (result.ok) addToShelf({ recipeId: job.recipeId, quality: result.quality, stars: Math.min(a.robot ? STAR_CAP.robot : STAR_CAP.staff, stars(score)), memory: false, staff: true });
    } else if (job.type === 'clean') {
      if (clean(job.table)) notice(S('cleanedBy', { name: a.person.person, n: job.table + 1 }));
    }
    claims.delete(job.claim); a.job = null; tire(a);
  }
  const tire = a => { if (!a.robot) a.energy = drain(a.energy, traitOf(a.id)); };
  const guestSpot = c => c.seat ? seatStand(c.seat) : { x: c.pos.x - .7, z: c.pos.z };
  function updateAgent(a, dt) {
    const now = Date.now();
    // Incidents freeze the person where they stand (robot-staff.md 4); the rude bubble resolves after RUDE_WARN_MS.
    if (a.rude) { if (now >= a.rude.until) fireRude(a); return; }
    if (a.phoneUntil > now && a.active) return;
    // A break (tired / lazy / disliked job): stand still with the excuse bubble; a tired break restores energy at the end.
    if (!a.job && a.slackUntil > now) { a.energy = regen(a.energy, dt); return; }
    if (a.slack) { if (a.slack === 'tired') a.energy = Math.min(100, a.energy + MORALE.breakEnergy); a.slack = null; }
    const speed = (a.effects.speed || SPEED) * boost();
    if (move(a, dt, speed)) return;
    if (!a.active) { releaseJob(a); const h = home(a); if (Math.hypot(h.x - a.pos.x, h.z - a.pos.z) > .2) walk(a, h); return; }
    const job = a.job;
    if (!job) {
      if (!a.robot) a.energy = regen(a.energy, dt);
      const next = findJob(a);
      const slack = next && !a.robot && a.active && rollSlack(a.energy, traitOf(a.id), dislikeOf(a.id, ['order', 'brew', 'deliver', 'clean']) === next.type);
      if (slack) { a.slackUntil = now + slack.ms; a.slack = slack.reason; return; }
      if (next) { assign(a, next); if (next.type === 'order') tryRude(a, next.customer); }
      else { const h = home(a); if (Math.hypot(h.x - a.pos.x, h.z - a.pos.z) > .3) walk(a, h); }
      return;
    }
    if (job.type === 'deliver') {
      if (job.stage === 'fetch') {
        const i = shelf.findIndex(d => d.id === job.drink), c = customers.find(c => c.id === job.customer && wants(shelf[i] || {})(c));
        if (i < 0 || !c) { releaseJob(a); return; }
        a.carry = shelf.splice(i, 1)[0]; job.stage = 'bring';
        const s = job.second, j = s ? shelf.findIndex(d => d.id === s.drink) : -1, c2 = j >= 0 && customers.find(o => o.id === s.customer && wants(shelf[j])(o));
        if (c2) {
          a.spare = shelf.splice(j, 1)[0];
          // Nearest guest first.
          if (Math.hypot(c2.pos.x - a.pos.x, c2.pos.z - a.pos.z) < Math.hypot(c.pos.x - a.pos.x, c.pos.z - a.pos.z)) {
            [a.carry, a.spare] = [a.spare, a.carry];
            [job.claim, job.drink, job.customer, s.claim, s.drink, s.customer] = [s.claim, s.drink, s.customer, job.claim, job.drink, job.customer];
          }
        } else if (s) { claims.delete(s.claim); job.second = null; }
        walk(a, guestSpot(customers.find(o => o.id === job.customer)));
        tryRude(a, job.customer); // a rude remark only happens with a cup in hand
        return;
      }
      const c = customers.find(c => c.id === job.customer && wants(a.carry)(c));
      if (!c || !serve(c, a.carry, a.effects.tip)) addToShelf(a.carry);
      a.carry = null; claims.delete(job.claim);
      const s = job.second, c2 = s && customers.find(o => o.id === s.customer && wants(a.spare)(o));
      if (c2) { Object.assign(job, { claim: s.claim, drink: s.drink, customer: s.customer, second: null }); a.carry = a.spare; a.spare = null; walk(a, guestSpot(c2)); return; }
      releaseJob(a); tire(a);
      return;
    }
    if (!a.timerMax) { a.timerMax = job.work / boost() * (a.robot ? 1 : tiredFactor(a.energy)); a.timer = 0; }
    a.timer += dt;
    if (a.timer >= a.timerMax) { a.timerMax = 0; finishJob(a); }
  }
  // ---- Incidents (robot-staff.md 4): the model rolls and checks exemptions; the scene fires them when due and plays them out ----
  const memberOf = id => snap.cafe.crew.find(m => m.id === id);
  const due = (m, now) => m?.incident && !m.incident.done && m.incident.type !== 'none' && m.paidUntil - now <= m.incident.due;
  function checkIncidents(now) {
    for (const a of agents.values()) {
      const m = memberOf(a.id);
      if (!due(m, now)) continue;
      // Shift over before it fired (rude never found a guest): cancelled. Only while closed: when open, the model's
      // auto-renew may roll the next shift's incident inside this same act, and a skip would cancel that one instead.
      if (m.paidUntil <= now) { if (!snap.cafe.open) act('incident', { id: a.id, skip: true }); continue; }
      if (!snap.cafe.open || m.incident.type === 'rude') continue; // rude waits for the next order/cup (tryRude)
      const result = act('incident', { id: a.id });
      if (!result.ok || !result.applied) continue;
      const name = a.person.person;
      if (result.type === 'phone') { releaseJob(a); a.phoneUntil = now + INCIDENTS.phoneMs; notice(S('phone', { name }), false); }
      else { releaseJob(a); notice(S('sick', { name }), false); }
      const role = roleOf(a.id), taken = snap.cafe.crew.filter(o => !o.gift && roleOf(o.id)?.id === role.id).length;
      onIncident({ id: a.id, name, type: result.type, replace: result.type === 'sick' && ['waiter', 'cleaner'].includes(role.id) && taken < role.max && snap.cafe.crew.filter(o => !o.gift).length < MAX_CREW });
    }
  }
  function tryRude(a, customer) {
    const m = memberOf(a.id), now = Date.now();
    if (!due(m, now) || m.incident.type !== 'rude') return;
    // One rude incident per open shift for the whole café: a second one is cancelled.
    const result = act('incident', { id: a.id, skip: Boolean(shift?.rude) });
    if (!result.ok || !result.applied) return;
    if (shift) shift.rude++;
    a.rude = { until: now + RUDE_WARN_MS, customer };
    onIncident({ id: a.id, name: a.person.person, type: 'rude', replace: false });
  }
  function fireRude(a) {
    const c = customers.find(c => c.id === a.rude.customer && !['drinking', 'leaving'].includes(c.phase));
    a.rude = null; releaseJob(a);
    if (!c) return;
    claims.delete(`order:${c.id}`);
    // Unlike a guest who waited too long, this keeps the player's combo and is counted in shift.rude, not shift.angry.
    leave(c, '😤'); act('lost', 'rude'); if (shift) shift.lost++;
    notice(S('rude', { name: a.person.person }), false); fx('angry', { pos: { ...c.pos } });
  }
  function addToShelf(drink) {
    drink.id ??= ++drinkSeq; // a returned cup keeps its id
    fx('cup', { pos: PASS });
    // With a pickup counter, take-away cups go straight to the screen and the guest collects them.
    const guest = gear('pickup') && customers.find(c => !c.seat && c.phase === 'pickup' && wants(drink)(c));
    if (guest) { notice(S('callDrink', { id: guest.id, drink: recipeById(drink.recipeId).name })); fx('call'); serve(guest, drink); return; }
    shelf.push(drink);
  }
  function updateMachines(now) {
    // The auto espresso machine brews espresso-family orders nobody has started.
    if (autoJob && now >= autoJob.readyAt) {
      const result = act('brew', { recipeId: autoJob.recipeId, cropId: autoJob.cropId, score: 70, staff: true });
      if (result.ok) addToShelf({ recipeId: autoJob.recipeId, quality: result.quality, stars: STAR_CAP.robot, memory: false, staff: true });
      claims.delete(autoJob.claim); autoJob = null;
    }
    if (!autoJob && gear('autoEspresso') && snap.cafe.open) {
      const t = tickets().find(t => !t.covered && AUTO_RECIPES.includes(t.recipe.id) && !claims.has(`brew:${t.id}`));
      const crop = t && [t.recipe.bean, ...CROPS.map(c => c.id)].find(id => !missingFor(t.recipe, snap.cafe, id).length);
      if (crop) { autoJob = { claim: `brew:${t.id}`, recipeId: t.recipe.id, cropId: crop, startedAt: now, readyAt: now + 10000 }; claims.add(autoJob.claim); }
    }
  }
  function restock(dt) {
    const manager = [...agents.values()].find(a => a.role === 'manager' && a.active);
    if (!manager || (restockIn -= dt) > 0) return;
    restockIn = 5;
    const needed = new Set(RECIPES.filter(r => !lockReason(r, snap.cafe)).flatMap(r => Object.keys(resolveUses(r.uses, snap.cafe))));
    const low = SUPPLIES.find(s => needed.has(s.id) && snap.cafe.supplies[s.id] < s.pack / 4 && snap.coins >= s.price * 3);
    if (low && act('buy', low.id).ok) notice(S('restocked', { name: manager.person.person, supply: low.name, pack: low.packLabel }));
  }

  // ---- Shifts: a timed goal with a special drink keeps every opening short and rewarding ----
  function startShift(now) {
    const menu = RECIPES.filter(r => !lockReason(r, snap.cafe));
    shift = { startedAt: now, endsAt: now + SHIFT_MS, goal: shiftGoal(cafeRank(snap.cafe.reputation), helpers().H), served: 0, stars: 0, own: 0, ownStars: 0, revenue: 0, lost: 0, angry: 0, rude: 0, robotWalked: 0, gift: false, misses: {}, special: menu[Math.floor(Math.random() * menu.length)].id, learning: learning() };
  }
  function waste(drink, quiet = false) {
    if (shift) shift.wasted = (shift.wasted || 0) + 1;
    if (!quiet) notice(S('wasted', { drink: recipeById(drink.recipeId).name }), false);
  }
  function endShift() {
    if (!shift) return;
    // Closing time: cups nobody took are thrown away and counted in the report (they also never survive a reload).
    for (const a of agents.values()) releaseJob(a); // carried cups join the shelf first so they are wasted too
    for (const d of shelf.splice(0)) waste(d, true);
    if (hand) { waste(hand, true); hand = null; }
    const done = shift, avg = shiftAvg(done);
    shift = null;
    // Guests still waiting go home calmly (👋): no lost count, no reputation loss, same for hand-closing and the clock.
    const unserved = customers.filter(c => !['drinking', 'leaving'].includes(c.phase));
    for (const c of unserved) leave(c, '👋');
    // Same met rule as the model's 'shift' action; a learning shift that misses skips the action so it gets no −1.
    const missed = shiftMissed(done, avg);
    const result = done.learning && missed ? { met: false, message: S('learnShiftMiss') } : act('shift', { served: done.served, goal: done.goal, avg: avg ?? 2 });
    fx('shift', { met: Boolean(result.met) });
    const robot = done.gift ? giftReport(done) : null;
    onShiftEnd({ ...done, avg, unserved: unserved.length, bonus: result.bonus || 0, met: Boolean(result.met), tier: result.tier || 0, rep: result.rep ?? 0, message: result.message, robot });
    if (robot) act('giftReport');
  }
  // "Your cups vs robot cups" block for a shift the robot trial ran in (robot-staff.md 5, "Hết gói"). Tally totals are the whole trial so far.
  function giftReport(done) {
    const t = farm.peek().robotGift?.tally;
    if (!t) return null;
    const side = (x, walked = 0) => ({ cups: x.cups, walked, avg: x.cups > walked ? x.stars / (x.cups - walked) : 0, paid: round2(x.paid), cost: round2(x.cost), profit: round2(x.paid - x.cost) });
    const fault = Object.entries(done.misses).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
    const faults = Object.entries(candidateById('gift-pha')?.fixedEffects.faults || {}).map(([id, why]) => ({ recipe: recipeById(id).name, why }));
    return { you: { ...side(t.you), fault }, robot: { ...side(t.robot, t.robot.walked), faults }, hint: S('giftHint') };
  }

  return {
    refresh, tableCount, indoorCount, isOpen, tableLevel, tickets, seatPos, registers, stations,
    get customers() { return customers; }, get shelf() { return shelf; }, get hand() { return hand; }, get combo() { return combo; },
    // Leaving the café with customers still waiting counts as turning them away (−1 reputation each), so it cannot dodge penalties.
    // Rời quán thì quán đứng yên; vào lại dời mọi mốc giờ thực đi đúng thời gian vắng để ca, máy pha và sự cố chạy tiếp như chưa rời.
    resume(awayMs) {
      if (shift) { shift.startedAt += awayMs; shift.endsAt += awayMs; }
      for (const d of [...shelf, ...(hand ? [hand] : []), ...[...agents.values()].flatMap(a => [a.carry, a.spare, a.job?.cup]).filter(Boolean)]) if (d.madeAt) d.madeAt += awayMs; // cups do not cool while the café is paused
      if (autoJob) { autoJob.startedAt += awayMs; autoJob.readyAt += awayMs; }
      for (const a of agents.values()) { if (a.retryAt) a.retryAt += awayMs; if (a.phoneUntil) a.phoneUntil += awayMs; if (a.rude) a.rude.until += awayMs; }
      refresh();
    },
    abandon() { if (learning()) return 0; const left = customers.filter(c => !['drinking', 'leaving'].includes(c.phase)).length; for (let i = 0; i < left; i++) act('lost', 'busy'); return left; },
    get agents() { return [...agents.values()]; }, get autoJob() { return autoJob; }, get snap() { return snap; }, get dirty() { return dirty; }, get shift() { return shift; },
    queueLength: () => line().length,
    hasCleanSeat: () => Boolean(freeSeat()),
    isClaimed: key => claims.has(key),
    guestsAt: table => customers.filter(c => c.seat?.table === table),
    staffOn: role => [...agents.values()].some(a => a.role === role && a.active),
    toggleOpen() {
      const result = act('toggle');
      // syncAgents first so the new shift's goal counts the baristas who start working now.
      if (result.ok) { fx('door', { open: snap.cafe.open }); if (snap.cafe.open) { syncAgents(); startShift(Date.now()); } else endShift(); }
      return result;
    },
    update(dt, now, player = null) {
      syncAgents();
      if (snap.cafe.open && !shift) startShift(now);
      if (shift && now >= shift.endsAt) {
        if (snap.cafe.open) act('toggle');
        endShift();
      }
      const learnFull = () => learning() && customers.filter(c => !['drinking', 'leaving'].includes(c.phase)).length >= LEARN_GUESTS;
      if (snap.cafe.open && (spawnIn -= dt) <= 0 && learnFull()) spawnIn = 2; // retry in 2 s; nobody is turned away while learning
      else if (snap.cafe.open && spawnIn <= 0) {
        const rep = snap.cafe.reputation;
        // Alone the player brews a cup in ~25–35 s, so guests come slower; each brewing hand closes the gap step by step (no jump at the first hire).
        { const { H, C } = helpers(); spawnIn = arrivalGap(H, C, rep, tableCount(), gear('kiosk')) * (.75 + Math.random() * .5); }
        spawn();
      }
      benchTarget = benching ? tickets().filter(t => t.recipe.id === benching && !t.covered).sort((x, y) => x.ratio - y.ratio)[0]?.id ?? null : null;
      const queue = line(), kiosksOwned = gear('kiosk');
      for (const c of customers) {
        if (c.phase === 'enter' && !c.path.length) {
          // At the lobby a guest uses a free kiosk if the cafe has one, otherwise joins the counter line.
          const used = customers.filter(o => o.kiosk !== null).map(o => o.kiosk);
          const k = [...Array(kiosksOwned).keys()].find(i => !used.includes(i));
          if (k !== undefined) { c.phase = 'kiosk'; c.kiosk = k; c.timer = 4; walk(c, kioskFront(k)); }
          else { c.phase = 'queue'; c.inLine = true; queue.push(c); }
        }
        if (c.phase === 'queue') {
          const i = queue.indexOf(c), spot = i < registers() ? registerFront(i) : lineSpot(i - registers());
          const goal = c.path.at(-1) || c.pos;
          if (Math.hypot(spot.x - goal.x, spot.z - goal.z) > .05) c.path = [spot];
        }
        move(c, dt);
        if (c.phase === 'kiosk' && !c.path.length && (c.timer -= dt) <= 0) { const r = placeOrder(c); notice(S('kioskOrder', { message: r.message })); }
        else if (['queue', 'seated', 'pickup'].includes(c.phase) && (c.phase !== 'queue' || !c.path.length) && (c.patience -= c.id === benchTarget ? dt * .25 : dt) <= 0) leave(c, '😠', true);
        else if (c.phase === 'toSeat' && !c.path.length) { c.phase = 'seated'; c.facing = SLOT[c.seat.slot][2]; }
        else if (c.phase === 'toPickup' && !c.path.length) {
          c.phase = 'pickup'; c.facing = Math.PI;
          // A cup may already be waiting on the pass for this take-away order.
          const i = gear('pickup') ? shelf.findIndex(d => wants(d)(c) && !claims.has(`drink:${d.id}`)) : -1;
          if (i >= 0) { notice(S('callCup', { id: c.id })); fx('call'); serve(c, shelf.splice(i, 1)[0]); }
        }
        else if (c.phase === 'drinking' && (c.timer -= dt) <= 0) leave(c, '👋');
      }
      for (let i = customers.length - 1; i >= 0; i--) if (customers[i].phase === 'leaving' && !customers[i].path.length) customers.splice(i, 1);
      if (shift && !shift.gift) shift.gift = snap.cafe.crew.some(m => m.gift && agents.get(m.id)?.active);
      // Cups left too long are thrown away (the one a person is carrying is on its way and stays).
      for (let i = shelf.length - 1; i >= 0; i--) if (isSpoiled(shelf[i]) && !claims.has(`drink:${shelf[i].id}`)) waste(shelf.splice(i, 1)[0]);
      if (hand && isSpoiled(hand)) { waste(hand); hand = null; }
      checkIncidents(now);
      for (const a of agents.values()) updateAgent(a, dt);
      separate(dt, player);
      updateMachines(now); restock(dt);
    },
    arriveRegister() {
      const c = hand && customers.find(c => !c.seat && wants(hand)(c));
      if (c) { if (serve(c, hand)) hand = null; return; }
      const r = takeOrder();
      // The 0.5 s auto-register may have just taken this order (or will once the walking guest arrives): skip the contradicting toast.
      if (r.ok || !snap.cafe.open || (Date.now() - orderedAt > 2000 && !line().length && !customers.some(c => c.phase === 'enter'))) notice(r.message, r.ok);
      if (r.ok) orderedAt = Date.now();
    },
    // Standing at the register: take the next order / hand over a take-away cup as soon as a customer reaches the front, no re-tap.
    autoRegister() {
      const c = hand && customers.find(c => !c.seat && wants(hand)(c));
      if (c) { if (serve(c, hand)) hand = null; return true; }
      if (!line().some(atFront)) return false;
      const r = takeOrder(); if (r.ok) { notice(r.message, true); orderedAt = Date.now(); } return r.ok;
    },
    arrivePickup() {
      if (!gear('pickup')) { notice(S('pickupLocked'), false); return; }
      const c = hand && customers.find(c => !c.seat && wants(hand)(c));
      if (c) { if (serve(c, hand)) hand = null; return; }
      notice(hand ? S('pickupNoGuest') : S('pickupInfo'));
    },
    // The player walked to a table: serve the held cup if someone there ordered it, otherwise clear used cups.
    arriveTable(table) {
      if (!isOpen(table)) { notice(table >= INDOOR_TABLES ? S('gardenLocked') : S('tableLocked'), false); return; }
      const here = customers.filter(c => c.seat?.table === table && ['seated', 'toSeat'].includes(c.phase));
      const c = hand && here.find(wants(hand));
      if (c) { if (serve(c, hand)) hand = null; return; }
      const cleaned = clean(table);
      if (cleaned) { notice(S('tableCleaned', { count: cleaned, n: table + 1 })); return; }
      const n = table + 1;
      notice(hand ? S('tableNotOrdered', { n, drink: recipeById(hand.recipeId).name }) : here.length ? S('tableWaiting', { n, drinks: here.map(g => recipeById(g.recipeId).name).join(', ') }) : S('tableEmpty', { n }), !hand);
    },
    // Returns true when the player only picked up a finished cup instead of opening the bench.
    arriveBar() {
      // Holding a cup nobody ordered: tapping the bar sets it down on the shelf instead of trapping the hand.
      if (hand && !waiting().some(wants(hand))) { addToShelf(hand); notice(S('shelved', { drink: recipeById(hand.recipeId).name })); hand = null; return true; }
      const free = shelf.filter(d => !claims.has(`drink:${d.id}`));
      if (hand || !free.length) return false;
      const order = waiting();
      const pick = free.find(d => order.some(wants(d))) || free[0];
      hand = shelf.splice(shelf.indexOf(pick), 1)[0];
      const c = order.find(wants(hand));
      notice(`${S('holding', { drink: recipeById(hand.recipeId).name })}${c ? S('bringTo', { who: label(c) }) : ''}`);
      fx('pickup');
      return true;
    },
    // Live incidents for HUD bubbles: phone/rude can be tapped (remind), sick is info only. until: ms timestamp (sick: null).
    get incidents() {
      const now = Date.now();
      return [...agents.values()].flatMap(a => {
        const type = a.rude ? 'rude' : a.phoneUntil > now && a.active ? 'phone' : a.sick ? 'sick' : null;
        return type ? [{ id: a.id, name: a.person.person, type, until: type === 'rude' ? a.rude.until : type === 'phone' ? a.phoneUntil : null, pos: a.pos }] : [];
      });
    },
    // «Nhắc» / tapping the person: back to work now (phone) or the rude remark is stopped in time. Returns true if it did something.
    remind(id) {
      const a = agents.get(id);
      if (a?.rude) { a.rude = null; notice(S('remindRude', { name: a.person.person })); return true; }
      if (a?.phoneUntil > Date.now()) { a.phoneUntil = 0; notice(S('remindPhone', { name: a.person.person })); return true; }
      return false;
    },
    // miss: the player's lowest-scoring step on this cup (bench), counted for the trial report's "your main mistake".
    addDrink(drink) {
      if (drink.miss && shift) shift.misses[drink.miss] = (shift.misses[drink.miss] || 0) + 1;
      drink.id = ++drinkSeq;
      // Only a cup somebody is waiting for goes into the hand; practice cups wait on the shelf (matches the bench message).
      const c = waiting().find(wants(drink));
      if (!hand && c) hand = drink; else addToShelf(drink);
      return c ? label(c) : null;
    },
    dropHand() { if (hand) { addToShelf(hand); hand = null; } },
    benchStart(recipeId) { benching = recipeId; },
    benchEnd() { benching = null; benchTarget = null; },
    get benchTarget() { return benchTarget; },
  };
}
