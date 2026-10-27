import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/Clock';
import { CONTENT } from '../../src/data/content';
import type { Customer } from '../../src/gameplay/cafe/CafeService';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';
import type { ServiceType } from '../../src/gameplay/cafe/OrderService';
import { cafeSim, runUntil } from './helpers';

const idle = (sim: GameSimulation) =>
  runUntil(sim, () => {
    const i = sim.playerInteraction.snapshot();
    return !i.current && !i.queue.length && !i.moveTarget;
  }, 60_000);

function stock(sim: GameSimulation, beans = 20, milk = 20): void {
  sim.tx.execute({ reason: 'test:stock', items: [{ itemId: 'roasted_arabica', qty: beans, quality: 80 }, { itemId: 'milk', qty: milk, quality: 50 }, { itemId: 'condensed_milk', qty: 10, quality: 50 }] });
}

/** Customer standing at the counter, ready to order. */
function arrive(sim: GameSimulation, recipe = 'espresso', service: ServiceType = 'dineIn', archetype = 'tourist'): Customer {
  const c = sim.cafe!.spawn(archetype, recipe, service);
  expect(runUntil(sim, () => sim.cafe!.customerAtCounter()?.id === c.id, 90_000)).toBe(true);
  return c;
}

function takeOrder(sim: GameSimulation): void {
  sim.clickObject('order_counter');
  expect(idle(sim)).toBe(true);
}

/** The player makes the drink for the oldest accepted order (stations are used for real; steps use the barista scoring). */
function brew(sim: GameSimulation): void {
  for (let guard = 0; guard < 14 && !sim.player.heldItem; guard++) {
    const type = sim.brewing.nextStationFor(sim.player);
    if (!type) throw new Error('nothing to brew');
    sim.clickObject(sim.world.allObjects().find((o) => o.type === type)!.id);
    idle(sim);
    for (let k = 0; k < 6 && sim.brewing.isArmed(sim.player); k++) sim.brewing.autoStep(sim.player, 0.9);
  }
  expect(sim.player.heldItem).not.toBeNull();
}

function serve(sim: GameSimulation, c: Customer): void {
  expect(runUntil(sim, () => !!c.spot && !c.target && c.fsm.is('WAITING'), 60_000)).toBe(true);
  sim.clickObject(c.spot!.objectId);
  idle(sim);
}

function fullService(sim: GameSimulation, recipe: string, service: ServiceType): Customer {
  const c = arrive(sim, recipe, service);
  takeOrder(sim);
  brew(sim);
  serve(sim, c);
  return c;
}

describe('customer lifecycle (spawn → exit)', () => {
  it('a dine-in customer walks the whole path and leaves; no teleporting', () => {
    const { sim } = cafeSim();
    stock(sim);
    const states: string[] = [];
    const c = sim.cafe!.spawn('student', 'espresso', 'dineIn');
    sim.bus.on('customer:stateChanged', (e) => e.customerId === c.id && states.push(e.to));
    let last = { ...c.actor.pos };
    let maxStep = 0;
    let frame = 0;
    // Watchdog on every simulation frame: a customer never moves faster than their walking speed.
    const tick = sim.tick.bind(sim);
    sim.tick = (dt: number) => {
      tick(dt);
      frame = dt;
      maxStep = Math.max(maxStep, (Math.hypot(c.actor.pos.x - last.x, c.actor.pos.y - last.y) / dt) * 1000);
      last = { ...c.actor.pos };
    };
    expect(runUntil(sim, () => sim.cafe!.customerAtCounter()?.id === c.id, 90_000)).toBe(true);
    takeOrder(sim);
    brew(sim);
    serve(sim, c);
    expect(runUntil(sim, () => c.gone, 60_000)).toBe(true);
    void frame;
    expect(states).toEqual(['ENTERING', 'WALKING_TO_COUNTER', 'ORDERING', 'WAITING', 'RECEIVING_DRINK', 'CONSUMING', 'PAYING', 'LEAVING']);
    expect(maxStep).toBeLessThan(CONTENT.customers.archetypes.student!.speedTilesPerSec + 0.05); // tiles per second
  });

  it('a takeaway customer is served at the pickup point, never uses a seat and leaves no dirty table', () => {
    const { sim } = cafeSim();
    stock(sim);
    const states: string[] = [];
    const c = arrive(sim, 'espresso', 'takeaway');
    sim.bus.on('customer:stateChanged', (e) => e.customerId === c.id && states.push(e.to));
    takeOrder(sim);
    expect(c.spot!.kind).toBe('pickup');
    brew(sim);
    serve(sim, c);
    runUntil(sim, () => c.gone, 60_000);
    expect(states).toEqual(['WAITING', 'RECEIVING_DRINK', 'PAYING', 'LEAVING']); // no CONSUMING
    expect(sim.cafe!.dirtySeatIds()).toEqual([]);
    expect(sim.cafe!.seatStates().filter((s) => s.kind === 'seat' && s.state !== 'AVAILABLE')).toEqual([]);
    expect(sim.cafe!.pendingPayments()[0]!.objectId).toMatch(/^pickup_/);
  });

  it('natural arrivals follow the data-driven takeaway share', () => {
    const { sim, clock } = cafeSim({ seed: 3, autoSpawn: true });
    const kinds: string[] = [];
    sim.bus.on('customer:spawned', (e) => kinds.push(e.service));
    for (let i = 0; i < 60 * 60 * 10; i++) {
      sim.tick(100);
      clock.advance(100);
    }
    expect(kinds.length).toBeGreaterThan(40);
    const share = kinds.filter((k) => k === 'takeaway').length / kinds.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.7); // mix of archetype shares (0.15–0.6)
  });
});

describe('orders carry everything they need', () => {
  it('order has id, customer, service, recipe, ingredients, patience, status, worker, quality and payment status', () => {
    const { sim } = cafeSim();
    stock(sim);
    const c = arrive(sim, 'latte', 'takeaway');
    const order = sim.orders.get(c.orderId!)!;
    expect(order).toMatchObject({ customerId: c.id, service: 'takeaway', recipeId: 'latte', status: 'CREATED', worker: null, quality: null, paymentStatus: 'NONE' });
    expect(order.ingredients.length).toBeGreaterThan(0);
    expect(order.timeLimitMs).toBeGreaterThan(0);
    takeOrder(sim);
    brew(sim);
    expect(sim.orders.get(c.orderId!)).toMatchObject({ worker: 'player', status: 'READY' });
    expect(sim.orders.get(c.orderId!)!.quality).toBeGreaterThan(0);
  });

  it('several customers ordering the same drink each get their own order and drink', () => {
    const { sim } = cafeSim();
    stock(sim);
    const a = arrive(sim, 'espresso');
    takeOrder(sim);
    const b = arrive(sim, 'espresso');
    takeOrder(sim);
    expect(a.orderId).not.toBe(b.orderId);
    brew(sim);
    const first = sim.brewing.heldDrink()!;
    expect(first.orderId).toBe(a.orderId);
    serve(sim, a);
    brew(sim);
    expect(sim.brewing.heldDrink()!.orderId).toBe(b.orderId);
    expect(sim.brewing.heldDrink()!.id).not.toBe(first.id);
  });

  it('no free ingredients: without beans nothing can be brewed and nothing is created from thin air', () => {
    const { sim } = cafeSim();
    sim.tx.execute({ reason: 'test:clear', items: sim.snapshot().economy.inventory.roasted_arabica ? [{ itemId: 'roasted_arabica', qty: -sim.tx.count('roasted_arabica') }] : [] });
    const c = arrive(sim, 'espresso');
    takeOrder(sim);
    expect(sim.brewing.canUseStation('grinder')).toMatchObject({ ok: false, reason: 'noBeans' });
    expect(sim.brewing.canAutoBrew(c.orderId!)).toBe(false);
    expect(sim.brewing.heldDrink()).toBeUndefined();
  });
});

describe('payment: created, collected once', () => {
  it('payment is created when the customer pays, shown on the seat, credited only on collection', () => {
    const { sim } = cafeSim();
    stock(sim);
    const c = fullService(sim, 'espresso', 'dineIn');
    const seat = c.spot!.objectId;
    runUntil(sim, () => c.gone, 60_000);
    const pend = sim.cafe!.pendingPayments();
    expect(pend).toHaveLength(1);
    expect(pend[0]).toMatchObject({ status: 'PENDING', objectId: seat, orderId: c.orderId });
    expect(sim.orders.get(c.orderId!)!.paymentStatus).toBe('PENDING');
    const before = sim.tx.coins;
    const exp = sim.tx.exp;
    sim.clickObject(seat); // collect the coins (the seat is also dirty: collecting comes first)
    idle(sim);
    expect(sim.tx.coins).toBe(before + pend[0]!.coins);
    expect(sim.tx.exp).toBe(exp + pend[0]!.exp);
    expect(sim.orders.get(c.orderId!)!.paymentStatus).toBe('COLLECTED');
    expect(sim.cafe!.pendingPayments()).toHaveLength(0);
  });

  it('collecting twice (double click, repeated command) credits exactly once', () => {
    const { sim } = cafeSim();
    stock(sim);
    const c = fullService(sim, 'espresso', 'takeaway');
    runUntil(sim, () => c.gone, 60_000);
    const obj = sim.cafe!.pendingPayments()[0]!.objectId;
    const before = sim.tx.coins;
    expect(sim.cafe!.collectPayment(obj)).toEqual({ ok: true });
    expect(sim.cafe!.collectPayment(obj)).toMatchObject({ ok: false });
    expect(sim.tx.coins - before).toBeGreaterThan(0);
    const once = sim.tx.coins;
    sim.cafe!.collectPayment(obj);
    expect(sim.tx.coins).toBe(once);
    expect(sim.state.economy.history.filter((h) => h.key?.startsWith('payment:'))).toHaveLength(1);
  });

  it('a pending payment survives a reload (save → load) and is still credited exactly once', () => {
    const { sim, clock } = cafeSim();
    stock(sim);
    const c = fullService(sim, 'espresso', 'dineIn');
    runUntil(sim, () => c.gone, 60_000);
    const pay = sim.cafe!.pendingPayments()[0]!;
    const storage = new MemoryStorage();
    const saves = new SaveService(storage);
    saves.save(sim.captureState(), clock.now());
    const loaded = saves.load(clock.now());
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    const again = new GameSimulation(structuredClone(CONTENT.maps.cafe!), CONTENT, { clock, state: loaded.state });
    expect(again.cafe!.pendingPayments().map((p) => p.id)).toEqual([pay.id]);
    expect(again.cafe!.dirtySeatIds()).toEqual([pay.objectId]); // the seat is still dirty after the reload
    const before = again.tx.coins;
    expect(again.cafe!.collectPayment(pay.objectId)).toEqual({ ok: true });
    expect(again.tx.coins).toBe(before + pay.coins);
    // Reload once more with the collected state: nothing left to collect, no second credit.
    saves.save(again.captureState(), clock.now());
    const third = saves.load(clock.now());
    if (third.status !== 'ok') throw new Error('load');
    const sim3 = new GameSimulation(structuredClone(CONTENT.maps.cafe!), CONTENT, { clock, state: third.state });
    expect(sim3.cafe!.pendingPayments()).toHaveLength(0);
    expect(sim3.cafe!.collectPayment(pay.objectId)).toMatchObject({ ok: false });
  });

  it('payment ids are unique and never reused', () => {
    const { sim } = cafeSim();
    stock(sim);
    const ids = new Set<number>();
    sim.bus.on('cafe:paymentCreated', (e) => ids.add(e.paymentId));
    for (let i = 0; i < 3; i++) {
      const c = fullService(sim, 'espresso', 'takeaway');
      runUntil(sim, () => c.gone, 60_000);
    }
    expect(ids.size).toBe(3);
  });
});

describe('seat states and cleaning', () => {
  it('seat: AVAILABLE → RESERVED → OCCUPIED → DIRTY → CLEANING → AVAILABLE, and dirty seats are not given out', () => {
    const { sim } = cafeSim();
    stock(sim);
    const c = arrive(sim, 'espresso', 'dineIn');
    takeOrder(sim);
    const seat = c.spot!.objectId;
    expect(sim.cafe!.seatStatus(seat)).toBe('RESERVED');
    runUntil(sim, () => !c.target, 60_000);
    expect(sim.cafe!.seatStatus(seat)).toBe('OCCUPIED');
    brew(sim);
    serve(sim, c);
    runUntil(sim, () => c.gone, 60_000);
    expect(sim.cafe!.seatStatus(seat)).toBe('DIRTY');
    expect(sim.cafe!.freeSpots()).toBe(11); // 12 seats/standing spots, one of them dirty
    // Collect the money first, then clean: the broom action takes real time.
    sim.clickObject(seat);
    idle(sim);
    const log: string[] = [];
    sim.bus.on('cafe:seatCleaning', () => log.push('cleaning'));
    sim.bus.on('cafe:seatCleaned', () => log.push('cleaned'));
    sim.clickObject(seat);
    expect(runUntil(sim, () => sim.cafe!.seatStatus(seat) === 'CLEANING', 30_000)).toBe(true);
    expect(sim.cafe!.freeSpots()).toBe(11); // still not usable while being cleaned
    idle(sim);
    expect(sim.cafe!.seatStatus(seat)).toBe('AVAILABLE');
    expect(log).toEqual(['cleaning', 'cleaned']);
    expect(sim.cafe!.freeSpots()).toBe(12);
  });

  it('cleaning takes real work time, can be interrupted, and resumes safely', () => {
    const { sim } = cafeSim();
    stock(sim);
    const c = fullService(sim, 'espresso', 'dineIn');
    runUntil(sim, () => c.gone, 60_000);
    const seat = sim.cafe!.dirtySeatIds()[0]!;
    sim.cafe!.collectPayment(seat);
    const start = sim.now;
    sim.clickObject(seat);
    runUntil(sim, () => sim.cafe!.seatStatus(seat) === 'CLEANING', 30_000);
    sim.tick(1000);
    sim.cancel(); // interrupted
    sim.tick(50);
    expect(sim.cafe!.seatStatus(seat)).toBe('DIRTY'); // not clean, not stuck in CLEANING
    expect(sim.cafe!.freeSpots()).toBe(11);
    sim.clickObject(seat); // resume
    idle(sim);
    expect(sim.cafe!.seatStatus(seat)).toBe('AVAILABLE');
    expect(sim.now - start).toBeGreaterThanOrEqual(CONTENT.customers.cleaning.durationMs);
  });

  it('a patient dine-in customer who gives up leaves no dirty seat and frees the reservation', () => {
    const { sim } = cafeSim();
    arrive(sim, 'espresso', 'dineIn');
    takeOrder(sim); // nobody brews
    const left: string[] = [];
    sim.bus.on('customer:left', (e) => left.push(e.reason));
    runUntil(sim, () => left.length > 0, 400_000);
    expect(left).toEqual(['timeout']);
    expect(sim.cafe!.dirtySeatIds()).toEqual([]);
    expect(sim.cafe!.freeSpots()).toBe(12);
    expect(sim.orders.activeOrders()).toHaveLength(0);
  });

  it('café full / all seats dirty: dine-in customers fall back to standing, then pickup; then they must wait (noSeat)', () => {
    const { sim } = cafeSim();
    for (const s of sim.cafe!.seatStates()) if (s.kind === 'seat') sim.state.cafe.dirtySeats.push(s.objectId);
    expect(sim.cafe!.freeSpots()).toBe(4); // only the 4 standing spots
    const switched: string[] = [];
    sim.bus.on('customer:serviceChanged', (e) => switched.push(e.reason));
    for (let i = 0; i < 4; i++) {
      const c = arrive(sim, 'espresso', 'dineIn');
      takeOrder(sim);
      expect(c.spot!.kind).toBe('stand');
    }
    for (let i = 0; i < 2; i++) {
      const c = arrive(sim, 'espresso', 'dineIn');
      takeOrder(sim);
      expect(c.service).toBe('takeaway');
      expect(c.spot!.kind).toBe('pickup');
    }
    expect(switched).toEqual(['fullCafe', 'fullCafe']);
    arrive(sim, 'espresso', 'dineIn');
    expect(sim.cafe!.canTakeOrder()).toMatchObject({ ok: false, reason: 'noSeat' });
  });
});

describe('employee automation (cashier, barista, server, cleaner)', () => {
  function staffed(roles: string[]) {
    const { sim, clock } = cafeSim({ seed: 5 });
    sim.enableTestMode();
    for (const r of roles) expect(sim.employees.hire(r)).toEqual({ ok: true });
    return { sim, clock };
  }
  const run = (sim: GameSimulation, clock: FakeClock, ms: number, until?: () => boolean) => {
    for (let t = 0; t < ms; t += 100) {
      if (until?.()) return true;
      sim.tick(100);
      clock.advance(100);
    }
    return until ? until() : true;
  };

  it('a cleaner finds the dirty seat, cleans it (real duration) and releases it', () => {
    const { sim, clock } = staffed(['cleaner']);
    const seat = sim.cafe!.seatStates().find((s) => s.kind === 'seat')!.objectId;
    sim.state.cafe.dirtySeats.push(seat);
    const t0 = sim.now;
    expect(run(sim, clock, 60_000, () => sim.cafe!.seatStatus(seat) === 'AVAILABLE')).toBe(true);
    expect(sim.now - t0).toBeGreaterThanOrEqual(CONTENT.customers.cleaning.durationMs);
  });

  it('two cleaners never clean the same seat; each takes a different one', () => {
    const { sim, clock } = staffed(['cleaner', 'cleaner']);
    const seats = sim.cafe!.seatStates().filter((s) => s.kind === 'seat').slice(0, 2).map((s) => s.objectId);
    sim.state.cafe.dirtySeats.push(...seats);
    const cleaners = new Map<string, Set<string>>();
    sim.bus.on('cafe:seatCleaning', (e) => cleaners.set(e.objectId, (cleaners.get(e.objectId) ?? new Set()).add(e.actorId)));
    expect(run(sim, clock, 90_000, () => seats.every((s) => sim.cafe!.seatStatus(s) === 'AVAILABLE'))).toBe(true);
    for (const s of seats) expect(cleaners.get(s)!.size).toBe(1);
    expect(new Set([...cleaners.values()].map((v) => [...v][0])).size).toBe(2);
  });

  it('cashier takes orders and collects pending payments; money is credited once', () => {
    const { sim, clock } = staffed(['cashier']);
    sim.state.cafe.payments.push({ id: 900, orderId: 1, customerId: 'cx', recipeId: 'espresso', objectId: 'pickup_1', coins: 77, tip: 7, exp: 5, createdAt: 0, status: 'PENDING' });
    sim.state.cafe.nextPaymentId = 901;
    const before = sim.tx.coins;
    expect(run(sim, clock, 60_000, () => sim.cafe!.pendingPayments().length === 0)).toBe(true);
    expect(sim.tx.coins).toBe(before + 77);
    run(sim, clock, 10_000);
    expect(sim.tx.coins).toBe(before + 77);
  });

  it('two baristas reserve different orders; the full chain barista + server + cashier + cleaner serves customers', () => {
    const { sim, clock } = staffed(['cashier', 'barista', 'barista', 'server', 'cleaner']);
    sim.cafe!.spawn('student', 'espresso', 'dineIn');
    sim.cafe!.spawn('office', 'americano', 'takeaway');
    const workers = new Set<string>();
    sim.bus.on('brew:started', (e) => workers.add(String(sim.orders.get(e.orderId)?.worker)));
    expect(run(sim, clock, 300_000, () => sim.state.cafe.stats.served >= 2)).toBe(true);
    expect(workers.size).toBe(2); // two orders, two different baristas
    // Everything settled: payments are collected by the cashier and the dine-in seat was cleaned.
    expect(run(sim, clock, 120_000, () => sim.cafe!.pendingPayments().length === 0 && sim.cafe!.dirtySeatIds().length === 0)).toBe(true);
  });

  it('all machines busy: a second barista waits instead of using the machine in use', () => {
    const { sim } = cafeSim();
    stock(sim);
    // Only one grinder exists: one claim blocks the other.
    const grinders = sim.world.allObjects().filter((o) => o.type === 'grinder');
    expect(grinders).toHaveLength(1);
    expect(sim.brewing.reserveNext('emp_a')).toBeNull(); // no order yet
    const c = arrive(sim, 'espresso');
    takeOrder(sim);
    expect(sim.brewing.reserveNext('emp_a')).toBe(c.orderId);
    expect(sim.brewing.reserveNext('emp_b')).toBeNull(); // already reserved by emp_a
    expect(sim.brewing.nextOrderToBrew('emp_b')).toBeNull();
    expect(sim.brewing.nextOrderToBrew('emp_a')).toBe(c.orderId);
  });
});
