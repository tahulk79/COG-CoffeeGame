import { CROPS } from '../farm/content.js';
import { ASSETS, assetValue } from '../farm/rules.js';
import { RECIPES, SUPPLIES, TABLE_LEVELS, cafeRank, candidateById, lockReason, missingFor, recipeById, roleOf, staffEffects } from './recipes.js';

// Floor plan shared with the 3D scene. The back counter runs along z=-10.6 with a staff lane behind it (z≈-12.15);
// every station is a fixed slot so upgrades fill slots instead of moving things, and walkers path-find around furniture.
export const COUNTER_Z = -10.6, LANE_Z = -12.15;
export const BAR_X = -7, STATIONS = [-9.5, -7, -4.5], REGISTERS = [-.2, 2.6], PICKUP_X = 6.6;
export const PASS = { x: -2.2, z: -9.6 };
export const KIOSKS = [4.6, 6.1];
// Tables unlock in this order (nearest the counter first).
// Spacing was set with the grid debugger: columns 3.8 m and rows 4.2 m apart leave a walkable gap even at sofa level.
// The last two tables sit on the front porch.
export const TABLES = [[-1.4, -7.4], [-5.2, -7.4], [-1.4, -3.2], [-5.2, -3.2], [-9, -7.4], [-9, -3.2], [-12.8, -7.4], [-12.8, -3.2], [6.5, 5.6], [10, 5.6]];
export const DOOR = { x: 0, z: 8.6 };
const GATE = { x: 0, z: 1.6 }, LOBBY = { x: 1.2, z: -2.4 }, STAFF_DOOR = { x: -12.2, z: -12.1 }, MAX_LINE = 6, SPEED = 2.4, SHIFT_MS = 240000;
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

export function createCafeService(farm, { notice, reward, route = (from, to) => [to], onShiftEnd = () => {}, fx = () => {} }) {
  const customers = [], shelf = [], dirty = new Set(), claims = new Set(), agents = new Map();
  let snap = farm.progress, hand = null, combo = 0, spawnIn = 3, seq = 0, drinkSeq = 0, autoJob = null, restockIn = 0, shift = null;
  const refresh = () => { snap = farm.progress; return snap; };
  const gear = id => snap.cafe.gear[id] || 0;
  const tableCount = () => assetValue(ASSETS.find(a => a.id === 'cafe'), snap.upgrades.cafe);
  const tableLevel = table => TABLE_LEVELS[(snap.cafe.tables[table] || 1) - 1];
  const registers = () => 1 + gear('register2'), stations = () => 1 + gear('station');
  const line = () => customers.filter(c => c.phase === 'queue');
  const waiting = () => customers.filter(c => ['toSeat', 'seated', 'toPickup', 'pickup'].includes(c.phase));
  const label = c => c.seat ? `Bàn ${c.seat.table + 1}` : 'Mang đi';
  const act = (action, choice) => { const result = farm.act('cafe', action, choice); refresh(); return result; };
  const walk = (entity, to, finalStep = null) => { entity.path = [...route(entity.pos, to), ...(finalStep ? [finalStep] : [])]; };
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

  // ---- Customers ----
  function leave(c, mood, angry = false) {
    if (c.seat && c.phase === 'drinking') dirty.add(key(c.seat));
    const from = c.seat ? seatStand(c.seat) : null;
    c.phase = 'leaving'; c.mood = mood; c.seat = null; c.kiosk = null;
    c.path = from ? [from, ...route(from, GATE), DOOR] : [...route(c.pos, GATE), DOOR];
    if (angry) { act('lost', 'angry'); combo = 0; if (shift) shift.lost++; notice('Một khách chờ lâu quá nên bỏ về · Uy tín −2', false); fx('angry', { pos: { ...c.pos } }); }
  }
  function spawn() {
    if (line().length >= MAX_LINE + registers()) { act('lost', 'busy'); if (shift) shift.lost++; notice('Hàng quá dài, khách mới quay đi · Uy tín −1', false); fx('turned', { pos: DOOR }); return; }
    fx('enter', { pos: DOOR });
    const c = { id: ++seq, color: COLORS[seq % COLORS.length], phase: 'enter', inLine: false, pos: { x: DOOR.x + .3, z: DOOR.z }, path: [GATE],
      recipeId: null, seat: null, kiosk: null, patience: PATIENCE.queue, patienceMax: PATIENCE.queue, mood: null, timer: 0, facing: Math.PI };
    c.path.push(...route(GATE, LOBBY)); customers.push(c);
  }
  function freeSeat() {
    const taken = new Set(customers.filter(c => c.seat).map(c => key(c.seat)));
    const seats = [];
    for (let table = 0; table < tableCount(); table++) for (let slot = 0; slot < tableLevel(table).seats; slot++) {
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
    if (seat) { c.phase = 'toSeat'; walk(c, seatStand(seat), seatPos(seat)); c.patience = c.patienceMax = PATIENCE.seated * tableLevel(seat.table).patience * patienceBonus; }
    else { c.phase = 'toPickup'; walk(c, pickupSpot(customers.filter(o => ['toPickup', 'pickup'].includes(o.phase)).length % 8)); c.patience = c.patienceMax = PATIENCE.pickup; }
    const why = seat ? '' : dirty.size ? ' · có bàn chưa dọn, khách chờ mang đi' : ' · hết ghế, khách chờ mang đi';
    return { ok: true, message: `${label(c)} gọi ${recipe.name}${recipe.id === shift?.special ? ' ⭐' : ''}${why}` };
  }
  const atFront = c => c.phase === 'queue' && c.inLine && !c.path.length && line().indexOf(c) < registers();
  function takeOrder(c = line().find(atFront), patienceBonus = 1) {
    if (!c) return { ok: false, message: snap.cafe.open ? 'Chưa có khách tới quầy.' : 'Quán đang đóng cửa. Bấm Mở cửa để đón khách.' };
    claims.delete(`order:${c.id}`);
    return placeOrder(c, patienceBonus);
  }
  function serve(c, drink, charm = 0) {
    const special = drink.recipeId === shift?.special;
    const result = act('sell', { recipeId: drink.recipeId, quality: drink.quality, stars: drink.stars, wait: 1 - c.patience / c.patienceMax, combo, memory: drink.memory, table: c.seat ? c.seat.table : null, charm, special });
    if (!result.ok) { notice(result.message, false); return false; }
    combo = drink.stars >= 2 ? Math.min(5, combo + 1) : 0;
    const paid = Math.round((result.price + result.tip) * 100) / 100;
    if (shift) { shift.served++; shift.stars += drink.stars; shift.revenue += paid; }
    reward(c.pos, paid); fx('serve', { pos: { ...c.pos }, stars: drink.stars, paid });
    const mood = ['😕', '🙂', '😊', '😍'][drink.stars];
    if (c.seat) { c.phase = 'drinking'; c.mood = mood; c.timer = 8; } else leave(c, mood);
    // Rebuilt here so numbers use vi-VN like the coin chip (model message uses raw "3.67").
    const vi = n => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    notice(`${label(c)}: ${recipeById(drink.recipeId).name} · ${vi(result.price)} xu${result.tip ? ` + tip ${vi(result.tip)}` : ''}${special ? ' · ⭐ món của ca' : ''}${combo > 1 ? ` · Combo x${combo}` : ''}`);
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
    const supply = [...(hand ? [hand] : []), ...shelf, ...brewing(), ...[...agents.values()].filter(a => a.carry).map(a => a.carry)].map(d => d.recipeId);
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
      if (!a) { a = { id: m.id, person: candidateById(m.id), role: roleOf(m.id).id, pos: { ...STAFF_DOOR }, path: [], facing: 0, job: null, carry: null, timer: 0, timerMax: 0 }; agents.set(m.id, a); }
      a.level = m.level;
      a.active = snap.cafe.open && m.paidUntil > now;
      a.effects = staffEffects(a.person, a.level);
    });
  }
  function home(a) {
    const same = [...agents.values()].filter(o => o.role === a.role), i = same.indexOf(a);
    if (a.role === 'cashier') return { x: REGISTERS[i % 2], z: LANE_Z };
    if (a.role === 'barista') return { x: STATIONS[i % 3], z: LANE_Z };
    if (a.role === 'waiter') return { x: PASS.x + .6 - i * .7, z: PASS.z + .5 };
    if (a.role === 'cleaner') return { x: -11.6, z: -9 };
    return { x: 3.4, z: -8.2 };
  }
  function releaseJob(a) {
    if (!a?.job) return;
    claims.delete(a.job.claim);
    if (a.carry) { shelf.push(a.carry); a.carry = null; }
    a.job = null;
  }
  function assign(a, job) { a.job = job; claims.add(job.claim); walk(a, job.to); }
  function findJob(a) {
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
      const pending = tickets().filter(t => !t.covered && !claims.has(`brew:${t.id}`));
      const t = pending.find(t => (snap.cafe.mastery[t.recipe.id]?.best || 0) >= e.mastery);
      // Tell the player which drink this barista still needs to be taught.
      a.blocked = !t && pending.length ? { recipe: pending[0].recipe, score: e.mastery } : null;
      const crop = t && [t.recipe.bean, ...CROPS.map(c => c.id)].find(id => !missingFor(t.recipe, snap.cafe, id).length);
      if (!crop) return null;
      return { type: 'brew', claim: `brew:${t.id}`, customer: t.id, recipeId: t.recipe.id, cropId: crop, station, to: { x: STATIONS[station], z: LANE_Z }, work: e.ms / 1000, score: e.score };
    }
    if (a.role === 'waiter' || a.role === 'cleaner') {
      if (a.role === 'waiter') {
        // Most impatient guest first.
        const options = shelf.filter(d => !claims.has(`drink:${d.id}`)).map(d => [d, waiting().filter(c => wants(d)(c) && !c.path.length && (c.seat || !gear('pickup'))).sort((x, y) => x.patience / x.patienceMax - y.patience / y.patienceMax)[0]]).filter(([, c]) => c);
        if (options.length) { const [d, c] = options[0]; return { type: 'deliver', claim: `drink:${d.id}`, drink: d.id, customer: c.id, stage: 'fetch', to: PASS }; }
      }
      const table = [...new Set([...dirty].map(k => Number(k.split(':')[0])))].find(t => !claims.has(`clean:${t}`));
      if (table !== undefined) return { type: 'clean', claim: `clean:${table}`, table, to: { x: TABLES[table][0] + 1.6, z: TABLES[table][1] }, work: (a.role === 'cleaner' ? e.cleanMs : 5000) / 1000 };
    }
    return null;
  }
  function finishJob(a) {
    const job = a.job;
    if (job.type === 'order') {
      const c = customers.find(c => c.id === job.customer && atFront(c));
      if (c) { const r = takeOrder(c, a.effects.patience); notice(`${a.person.person}: ${r.message}`); }
    } else if (job.type === 'brew') {
      const result = act('brew', { recipeId: job.recipeId, cropId: job.cropId, score: job.score, staff: true });
      if (result.ok) addToShelf({ recipeId: job.recipeId, quality: result.quality, stars: job.score >= 90 ? 3 : 2, memory: false });
    } else if (job.type === 'clean') {
      if (clean(job.table)) notice(`${a.person.person} đã dọn Bàn ${job.table + 1}.`);
    }
    claims.delete(job.claim); a.job = null;
  }
  function updateAgent(a, dt) {
    const speed = (a.effects.speed || SPEED) * boost();
    if (move(a, dt, speed)) return;
    if (!a.active) { releaseJob(a); const h = home(a); if (Math.hypot(h.x - a.pos.x, h.z - a.pos.z) > .2) walk(a, h); return; }
    const job = a.job;
    if (!job) {
      const next = findJob(a);
      if (next) assign(a, next);
      else { const h = home(a); if (Math.hypot(h.x - a.pos.x, h.z - a.pos.z) > .3) walk(a, h); }
      return;
    }
    if (job.type === 'deliver') {
      if (job.stage === 'fetch') {
        const i = shelf.findIndex(d => d.id === job.drink), c = customers.find(c => c.id === job.customer && wants(shelf[i] || {})(c));
        if (i < 0 || !c) { claims.delete(job.claim); a.job = null; return; }
        a.carry = shelf.splice(i, 1)[0]; job.stage = 'bring';
        walk(a, c.seat ? seatStand(c.seat) : { x: c.pos.x - .7, z: c.pos.z });
        return;
      }
      const c = customers.find(c => c.id === job.customer && wants(a.carry)(c));
      if (!c || !serve(c, a.carry, a.effects.tip)) shelf.push(a.carry);
      a.carry = null; claims.delete(job.claim); a.job = null;
      return;
    }
    if (!a.timerMax) { a.timerMax = job.work / boost(); a.timer = 0; }
    a.timer += dt;
    if (a.timer >= a.timerMax) { a.timerMax = 0; finishJob(a); }
  }
  function addToShelf(drink) {
    drink.id = ++drinkSeq;
    fx('cup', { pos: PASS });
    // With a pickup counter, take-away cups go straight to the screen and the guest collects them.
    const guest = gear('pickup') && customers.find(c => !c.seat && c.phase === 'pickup' && wants(drink)(c));
    if (guest) { notice(`📺 Mời khách số ${guest.id} nhận ${recipeById(drink.recipeId).name}`); fx('call'); serve(guest, drink); return; }
    shelf.push(drink);
  }
  function updateMachines(now) {
    // The auto espresso machine brews espresso-family orders nobody has started.
    if (autoJob && now >= autoJob.readyAt) {
      const result = act('brew', { recipeId: autoJob.recipeId, cropId: autoJob.cropId, score: 70, staff: true });
      if (result.ok) addToShelf({ recipeId: autoJob.recipeId, quality: result.quality, stars: 2, memory: false });
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
    const needed = new Set(RECIPES.filter(r => !lockReason(r, snap.cafe)).flatMap(r => Object.keys(r.uses)));
    const low = SUPPLIES.find(s => needed.has(s.id) && snap.cafe.supplies[s.id] < s.pack / 4 && snap.coins >= s.price * 3);
    if (low && act('buy', low.id).ok) notice(`${manager.person.person} đã nhập ${low.name} (${low.packLabel}).`);
  }

  // ---- Shifts: a timed goal with a special drink keeps every opening short and rewarding ----
  function startShift(now) {
    const menu = RECIPES.filter(r => !lockReason(r, snap.cafe));
    shift = { startedAt: now, endsAt: now + SHIFT_MS, goal: 6 + 2 * cafeRank(snap.cafe.reputation), served: 0, stars: 0, revenue: 0, lost: 0, special: menu[Math.floor(Math.random() * menu.length)].id };
  }
  function endShift() {
    if (!shift) return;
    const done = shift, avg = done.served ? done.stars / done.served : 0;
    shift = null;
    const result = act('shift', { served: done.served, goal: done.goal, avg });
    fx('shift', { met: Boolean(result.met) });
    onShiftEnd({ ...done, avg, bonus: result.bonus || 0, met: Boolean(result.met), message: result.message });
  }

  return {
    refresh, tableCount, tableLevel, tickets, seatPos, registers, stations,
    get customers() { return customers; }, get shelf() { return shelf; }, get hand() { return hand; }, get combo() { return combo; },
    get agents() { return [...agents.values()]; }, get autoJob() { return autoJob; }, get snap() { return snap; }, get dirty() { return dirty; }, get shift() { return shift; },
    queueLength: () => line().length,
    guestsAt: table => customers.filter(c => c.seat?.table === table),
    staffOn: role => [...agents.values()].some(a => a.role === role && a.active),
    toggleOpen() {
      const result = act('toggle');
      if (result.ok) { fx('door', { open: snap.cafe.open }); if (snap.cafe.open) startShift(Date.now()); else endShift(); }
      return result;
    },
    update(dt, now) {
      syncAgents();
      if (snap.cafe.open && !shift) startShift(now);
      if (shift && now >= shift.endsAt) { if (snap.cafe.open) act('toggle'); endShift(); }
      if (snap.cafe.open && (spawnIn -= dt) <= 0) {
        const rep = snap.cafe.reputation;
        spawnIn = Math.max(5, Math.min(20, 15 - (rep - 50) * .08 - tableCount() * .3 - gear('kiosk'))) * (.75 + Math.random() * .5);
        spawn();
      }
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
        if (c.phase === 'kiosk' && !c.path.length && (c.timer -= dt) <= 0) { const r = placeOrder(c); notice(`🖥️ Kiosk: ${r.message}`); }
        else if (['queue', 'seated', 'pickup'].includes(c.phase) && (c.phase !== 'queue' || !c.path.length) && (c.patience -= dt) <= 0) leave(c, '😠', true);
        else if (c.phase === 'toSeat' && !c.path.length) { c.phase = 'seated'; c.facing = SLOT[c.seat.slot][2]; }
        else if (c.phase === 'toPickup' && !c.path.length) {
          c.phase = 'pickup'; c.facing = Math.PI;
          // A cup may already be waiting on the pass for this take-away order.
          const i = gear('pickup') ? shelf.findIndex(d => wants(d)(c) && !claims.has(`drink:${d.id}`)) : -1;
          if (i >= 0) { notice(`📺 Mời khách số ${c.id} nhận ly`); fx('call'); serve(c, shelf.splice(i, 1)[0]); }
        }
        else if (c.phase === 'drinking' && (c.timer -= dt) <= 0) leave(c, '👋');
      }
      for (let i = customers.length - 1; i >= 0; i--) if (customers[i].phase === 'leaving' && !customers[i].path.length) customers.splice(i, 1);
      for (const a of agents.values()) updateAgent(a, dt);
      updateMachines(now); restock(dt);
    },
    arriveRegister() {
      const c = hand && customers.find(c => !c.seat && wants(hand)(c));
      if (c) { if (serve(c, hand)) hand = null; return; }
      const r = takeOrder(); notice(r.message, r.ok);
    },
    arrivePickup() {
      if (!gear('pickup')) { notice('Ô trống: mua Quầy nhận đồ trong Nâng cấp › Tự động.', false); return; }
      const c = hand && customers.find(c => !c.seat && wants(hand)(c));
      if (c) { if (serve(c, hand)) hand = null; return; }
      notice(hand ? 'Không có khách mang đi gọi món này.' : 'Quầy nhận đồ: ly mang đi tự lên màn hình gọi số.');
    },
    // The player walked to a table: serve the held cup if someone there ordered it, otherwise clear used cups.
    arriveTable(table) {
      if (table >= tableCount()) { notice('Bàn chưa mở · Nâng cấp Bàn ghế để mở thêm.', false); return; }
      const here = customers.filter(c => c.seat?.table === table && ['seated', 'toSeat'].includes(c.phase));
      const c = hand && here.find(wants(hand));
      if (c) { if (serve(c, hand)) hand = null; return; }
      const cleaned = clean(table);
      if (cleaned) { notice(`Đã dọn ${cleaned} chỗ ở Bàn ${table + 1}. Bàn sẵn sàng đón khách.`); return; }
      notice(hand ? `Bàn ${table + 1} không gọi ${recipeById(hand.recipeId).name}.` : here.length ? `Bàn ${table + 1} đang chờ ${here.map(g => recipeById(g.recipeId).name).join(', ')}` : `Bàn ${table + 1} đang trống.`, !hand);
    },
    // Returns true when the player only picked up a finished cup instead of opening the bench.
    arriveBar() {
      const free = shelf.filter(d => !claims.has(`drink:${d.id}`));
      if (hand || !free.length) return false;
      const order = waiting();
      const pick = free.find(d => order.some(wants(d))) || free[0];
      hand = shelf.splice(shelf.indexOf(pick), 1)[0];
      const c = order.find(wants(hand));
      notice(`Đã cầm ${recipeById(hand.recipeId).name}${c ? ` · mang tới ${label(c)}` : ''}`);
      fx('pickup');
      return true;
    },
    addDrink(drink) {
      drink.id = ++drinkSeq;
      if (!hand) hand = drink; else addToShelf(drink);
      const c = waiting().find(wants(drink));
      return c ? label(c) : null;
    },
    dropHand() { if (hand) { addToShelf(hand); hand = null; } },
  };
}
