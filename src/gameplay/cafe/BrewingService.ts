import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { Actor } from '../../entities/Actor';
import type { TransactionService, ItemTable } from '../../systems/economy/TransactionService';
import type { NavigationService } from '../../systems/navigation/NavigationService';
import { stationOf } from '../world/types';
import type { WorldModel } from '../world/WorldModel';
import type { OrderService, RecipeTable } from './OrderService';

export type BrewStep =
  | { id: string; kind: 'choose_bean'; station: string }
  | { id: string; kind: 'choose_addition'; station: string; correct: string }
  | { id: string; kind: 'timing'; station: string; target: number; tolerance: number; periodMs: number };

export interface BrewingConfig {
  additions: Record<string, { label: string; itemId: string | null }>;
  /** Timing accuracy falls from 1 (inside tolerance) to 0 at `zeroAt` beyond it. */
  scoring: { zeroAt: number; beanWeight: number; performanceWeight: number };
  supplies: Record<string, number>;
}

export interface Drink {
  id: string;
  orderId: number;
  recipeId: string;
  beanItem: string;
  beanQuality: number;
  /** 1 when every ingredient choice was right, else the share of right choices. */
  recipeAccuracy: number;
  /** Mean accuracy of the timing steps (0–1). */
  performance: number;
  /** 0–100: bean quality and brewing performance combined. */
  quality: number;
  /** Simulation time the drink was finished (serving-time / temperature in M6). */
  readyAt: number;
  /** Accuracy per timing step (0–1). */
  steps: Record<string, number>;
  /** Signed needle error per timing step (value − target): > 0 overshoot (e.g. over-extracted). */
  stepErrors: Record<string, number>;
  /** Ingredient choices made (e.g. which addition went in). */
  choices: Array<{ step: string; chosen: string; correct: boolean }>;
}

interface Session {
  orderId: number;
  recipeId: string;
  stepIndex: number;
  /** Simulation time the current step became active (its needle starts at 0). */
  armedAt: number | null;
  bean: { itemId: string; quality: number } | null;
  choices: Array<{ step: string; chosen: string; correct: boolean }>;
  scores: Record<string, number>;
  errors: Record<string, number>;
}

export type BrewResult = { ok: true } | { ok: false; reason: string; applicable?: boolean };

export interface BrewView {
  orderId: number;
  recipeId: string;
  stepIndex: number;
  steps: BrewStep[];
  current: BrewStep | null;
  armed: boolean;
  /** Current needle value 0–1 for timing steps. */
  needle: number | null;
  scores: Record<string, number>;
}

const OK: BrewResult = { ok: true };
const no = (reason: string, applicable = true): BrewResult => ({ ok: false, reason, applicable });

/** Triangle wave 0 → 1 → 0 over one period. */
export const needleAt = (elapsedMs: number, periodMs: number): number => {
  const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
};

export const timingAccuracy = (value: number, target: number, tolerance: number, zeroAt: number): number => {
  const miss = Math.max(0, Math.abs(value - target) - tolerance);
  return Math.max(0, 1 - miss / zeroAt);
};

/**
 * Brewing. A session belongs to one accepted order and one actor, and walks
 * through the recipe's steps; each step happens at a specific station that
 * actor must stand at. Ingredients are consumed when chosen (never twice).
 * The player brews by hand (UI commands); a barista employee runs the same
 * steps through `autoStep` with a skill level instead of a needle. A finished
 * drink goes into the brewer's hands, or onto the pickup pool for baristas
 * (a server carries it to the customer); the order becomes READY.
 */
export class BrewingService {
  private readonly sessions = new Map<string, Session>();
  private readonly actors = new Map<string, Actor>();
  /** Actors whose finished drinks go to the pickup pool instead of their hands. */
  private readonly stashers = new Set<string>();
  /** Finished drinks waiting for a server, oldest first. */
  private readonly pool: string[] = [];
  private readonly drinks = new Map<string, Drink>();
  private nextDrink = 1;
  /** Exclusive claims on the next order to brew (order id → actor id), so two baristas never pick the same drink. */
  private readonly reservations = new Map<number, string>();

  constructor(
    private readonly world: WorldModel,
    private readonly nav: NavigationService,
    private readonly player: Actor,
    private readonly orders: OrderService,
    private readonly recipes: RecipeTable,
    readonly config: BrewingConfig,
    private readonly items: ItemTable,
    private readonly tx: TransactionService,
    private readonly bus: EventBus<GameEvents>,
    private readonly now: () => number,
  ) {
    this.actors.set(player.id, player);
    // An order that ends while brewing (customer gave up) aborts its session;
    // a finished drink for it is discarded so nobody's hands (or the pool) get stuck.
    bus.on('order:changed', (e) => {
      if (e.to === 'FAILED' || e.to === 'CANCELLED' || e.to === 'COMPLETED') this.reservations.delete(e.orderId);
      if (e.to !== 'FAILED' && e.to !== 'CANCELLED') return;
      for (const [actorId, s] of this.sessions) {
        if (s.orderId !== e.orderId) continue;
        this.sessions.delete(actorId);
        bus.emit('brew:aborted', { orderId: e.orderId, reason: 'orderEnded' });
      }
      for (const d of this.drinks.values()) {
        if (d.orderId !== e.orderId) continue;
        this.drinks.delete(d.id);
        const pooled = this.pool.indexOf(d.id);
        if (pooled >= 0) this.pool.splice(pooled, 1);
        for (const a of this.actors.values()) {
          if (a.heldItem !== d.id) continue;
          a.heldItem = null;
          bus.emit('actor:heldChanged', { actorId: a.id, item: null });
          a.syncRestState();
        }
        bus.emit('brew:discarded', { drinkId: d.id, orderId: e.orderId });
      }
    });
  }

  /** Employees brew and carry through the same service. `stash`: finished drinks go to the pickup pool. */
  registerActor(actor: Actor, stash = false): void {
    this.actors.set(actor.id, actor);
    if (stash) this.stashers.add(actor.id);
  }

  unregisterActor(actorId: string): void {
    const s = this.sessions.get(actorId);
    if (s) this.cancel(this.actors.get(actorId));
    this.actors.delete(actorId);
    this.stashers.delete(actorId);
    this.releaseReservation(actorId);
  }

  // ── queries ─────────────────────────────────────────────────────────────

  drink(id: string | null): Drink | undefined {
    return id ? this.drinks.get(id) : undefined;
  }

  heldDrink(actor: Actor = this.player): Drink | undefined {
    return this.drink(actor.heldItem);
  }

  /** Oldest finished drink waiting for a server whose order is still READY. */
  pooledDrink(): Drink | undefined {
    return this.pool.map((id) => this.drinks.get(id)).find((d) => d && this.orders.get(d.orderId)?.status === 'READY');
  }

  pooledDrinks(): Drink[] {
    return this.pool.map((id) => this.drinks.get(id)).filter((d): d is Drink => !!d);
  }

  /** A server takes the oldest pooled drink (or the given one) into their hands. */
  pickUp(actor: Actor, drinkId?: string): BrewResult {
    if (actor.heldItem) return no('handsFull');
    const d = drinkId ? this.drinks.get(drinkId) : this.pooledDrink();
    const at = d ? this.pool.indexOf(d.id) : -1;
    if (!d || at < 0) return no('nothingToPickUp');
    this.pool.splice(at, 1);
    actor.heldItem = d.id;
    this.bus.emit('actor:heldChanged', { actorId: actor.id, item: d.id });
    actor.syncRestState();
    return OK;
  }

  /**
   * Oldest accepted order (FIFO) that is not being brewed yet. Orders another actor has reserved are
   * skipped; an order this actor reserved comes first.
   */
  nextOrderToBrew(forActorId?: string): number | null {
    const open = this.orders
      .activeOrders()
      .filter((x) => x.status === 'ACCEPTED')
      .sort((a, b) => a.id - b.id);
    const mine = forActorId ? open.find((o) => this.reservations.get(o.id) === forActorId) : undefined;
    if (mine) return mine.id;
    return open.find((o) => !this.reservations.has(o.id))?.id ?? null;
  }

  /** Claim the next order for an employee before walking to the station. Returns its id, or null when nothing is free. */
  reserveNext(actorId: string): number | null {
    const id = this.nextOrderToBrew(actorId);
    if (id !== null) this.reservations.set(id, actorId);
    return id;
  }

  releaseReservation(actorId: string): void {
    for (const [orderId, a] of this.reservations) if (a === actorId) this.reservations.delete(orderId);
  }

  reservedBy(orderId: number): string | undefined {
    return this.reservations.get(orderId);
  }

  private steps(recipeId: string): BrewStep[] {
    return ((this.recipes[recipeId] as unknown as { steps?: BrewStep[] }).steps ?? []) as BrewStep[];
  }

  private stepOf(s: Session | undefined): BrewStep | null {
    return s ? this.steps(s.recipeId)[s.stepIndex] ?? null : null;
  }

  view(): BrewView | null {
    const s = this.sessions.get(this.player.id);
    if (!s) return null;
    const step = this.stepOf(s);
    return {
      orderId: s.orderId,
      recipeId: s.recipeId,
      stepIndex: s.stepIndex,
      steps: this.steps(s.recipeId),
      current: step,
      armed: s.armedAt !== null,
      needle: step?.kind === 'timing' && s.armedAt !== null ? needleAt(this.now() - s.armedAt, step.periodMs) : null,
      scores: { ...s.scores },
    };
  }

  /** Station type the actor should use next (start of the oldest order, or the current step), or null. */
  nextStationFor(actor: Actor): string | null {
    const s = this.sessions.get(actor.id);
    if (s) return this.stepOf(s)?.station ?? null;
    const orderId = this.nextOrderToBrew(actor.id);
    return orderId === null ? null : this.steps(this.orders.get(orderId)!.recipeId)[0]?.station ?? null;
  }

  /** Every running session (player and employees): for the progress bar above the machine in use. */
  sessionViews(): Array<{ actorId: string; orderId: number; stationObjectId: string | null; progress: number }> {
    const out: Array<{ actorId: string; orderId: number; stationObjectId: string | null; progress: number }> = [];
    for (const [actorId, sess] of this.sessions) {
      const actor = this.actors.get(actorId);
      const step = this.stepOf(sess);
      const total = this.steps(sess.recipeId).length || 1;
      const station = actor && step && sess.armedAt !== null ? this.world.allObjects().find((o) => stationOf(o) === step.station && this.nav.isWithinReach(actor.tile, { footprint: o.footprint, radius: o.def.interaction?.radius ?? 1, sides: o.sides })) : undefined;
      out.push({ actorId, orderId: sess.orderId, stationObjectId: station?.id ?? null, progress: sess.stepIndex / total });
    }
    return out;
  }

  hasSession(actor: Actor): boolean {
    return this.sessions.has(actor.id);
  }

  /** The actor's session is at a step that has been armed (they stand at the station and may act). */
  isArmed(actor: Actor): boolean {
    return this.sessions.get(actor.id)?.armedAt != null;
  }

  ownedBeans(): Array<{ itemId: string; qty: number; quality: number }> {
    return Object.entries(this.items)
      .filter(([, d]) => d.category === 'roasted')
      .map(([itemId]) => ({ itemId, stack: this.tx.stack(itemId) }))
      .filter((b) => b.stack)
      .map((b) => ({ itemId: b.itemId, qty: b.stack!.qty, quality: b.stack!.quality }));
  }

  /** Can an unattended brewer finish this order? Needs a bean and every ingredient the recipe's correct choices use. */
  canAutoBrew(orderId: number): boolean {
    const order = this.orders.get(orderId);
    if (!order || this.ownedBeans().length === 0) return false;
    return this.steps(order.recipeId).every((st) => {
      if (st.kind !== 'choose_addition') return true;
      const item = this.config.additions[st.correct]?.itemId;
      return !item || this.tx.count(item) > 0;
    });
  }

  // ── stations ────────────────────────────────────────────────────────────

  canUseStation(stationType: string, actor: Actor = this.player): BrewResult {
    const s = this.sessions.get(actor.id);
    if (!s) {
      if (actor.heldItem) return no('handsFull');
      const orderId = this.nextOrderToBrew(actor.id);
      if (orderId === null) return no('noOrderToBrew');
      const first = this.steps(this.orders.get(orderId)!.recipeId)[0];
      if (!first) return no('noSteps');
      if (first.station !== stationType) return no('wrongStation');
      if (first.kind === 'choose_bean' && this.ownedBeans().length === 0) return no('noBeans');
      return OK;
    }
    const step = this.stepOf(s);
    if (!step) return no('noSteps');
    return step.station === stationType ? OK : no('wrongStation');
  }

  /** Called when an actor finishes the "use station" interaction: start a session or arm the next step. */
  useStation(stationType: string, actor: Actor = this.player): BrewResult {
    const c = this.canUseStation(stationType, actor);
    if (!c.ok) return c;
    let s = this.sessions.get(actor.id);
    if (!s) {
      const orderId = this.nextOrderToBrew(actor.id)!;
      const order = this.orders.get(orderId)!;
      const t = this.orders.transition(orderId, 'PREPARING');
      if (!t.ok) return no(t.reason);
      this.reservations.delete(orderId);
      this.orders.patch(orderId, { worker: actor.id });
      s = { orderId, recipeId: order.recipeId, stepIndex: 0, armedAt: null, bean: null, choices: [], scores: {}, errors: {} };
      this.sessions.set(actor.id, s);
      this.bus.emit('brew:started', { orderId, recipeId: order.recipeId });
    }
    s.armedAt = this.now();
    return OK;
  }

  private atStation(step: BrewStep, actor: Actor): boolean {
    // Several machines of one type may exist; the actor just has to stand at any of them.
    return this.world.allObjects().some((o) => stationOf(o) === step.station && this.nav.isWithinReach(actor.tile, { footprint: o.footprint, radius: o.def.interaction?.radius ?? 1, sides: o.sides }));
  }

  private activeStep(kind: BrewStep['kind'], actor: Actor): { step: BrewStep; session: Session } | { fail: BrewResult } {
    const s = this.sessions.get(actor.id);
    const step = this.stepOf(s);
    if (!s || !step) return { fail: no('noSession') };
    if (step.kind !== kind) return { fail: no('wrongStep') };
    if (s.armedAt === null) return { fail: no('notArmed') };
    if (!this.atStation(step, actor)) return { fail: no('notAtStation') };
    return { step, session: s };
  }

  // ── step commands (UI) ──────────────────────────────────────────────────

  chooseBean(itemId: string, actor: Actor = this.player): BrewResult {
    const a = this.activeStep('choose_bean', actor);
    if ('fail' in a) return a.fail;
    if (this.items[itemId]?.category !== 'roasted') return no('notABean');
    const quality = this.tx.stack(itemId)?.quality ?? 0;
    const res = this.tx.execute({ reason: `brew:bean:${a.session.orderId}`, items: [{ itemId, qty: -1 }] });
    if (!res.ok) return no(res.error);
    a.session.bean = { itemId, quality };
    return this.advance(actor);
  }

  chooseAddition(additionId: string, actor: Actor = this.player): BrewResult {
    const a = this.activeStep('choose_addition', actor);
    if ('fail' in a) return a.fail;
    const add = this.config.additions[additionId];
    if (!add) return no('unknownAddition');
    if (add.itemId) {
      const res = this.tx.execute({ reason: `brew:addition:${a.session.orderId}`, items: [{ itemId: add.itemId, qty: -1 }] });
      if (!res.ok) return no(res.error === 'insufficientItems' ? 'noIngredient' : res.error);
    }
    const step = a.step as Extract<BrewStep, { kind: 'choose_addition' }>;
    a.session.choices.push({ step: step.id, chosen: additionId, correct: additionId === step.correct });
    return this.advance(actor);
  }

  /** Stop the needle of the current timing step. */
  press(actor: Actor = this.player): BrewResult {
    const a = this.activeStep('timing', actor);
    if ('fail' in a) return a.fail;
    const step = a.step as Extract<BrewStep, { kind: 'timing' }>;
    const value = needleAt(this.now() - a.session.armedAt!, step.periodMs);
    a.session.scores[step.id] = timingAccuracy(value, step.target, step.tolerance, this.config.scoring.zeroAt);
    a.session.errors[step.id] = value - step.target;
    return this.advance(actor);
  }

  /**
   * Barista employee: perform the actor's current armed step. Picks the best
   * roasted bean and the recipe's correct addition; timing steps score the
   * barista's `skill` (0–1) with no overshoot instead of using the needle.
   */
  autoStep(actor: Actor, skill: number): BrewResult {
    const s = this.sessions.get(actor.id);
    const step = this.stepOf(s);
    if (!s || !step) return no('noSession');
    if (step.kind === 'choose_bean') {
      const best = this.ownedBeans().sort((a, b) => b.quality - a.quality)[0];
      return best ? this.chooseBean(best.itemId, actor) : no('noBeans');
    }
    if (step.kind === 'choose_addition') return this.chooseAddition(step.correct, actor);
    const a = this.activeStep('timing', actor);
    if ('fail' in a) return a.fail;
    s.scores[step.id] = Math.max(0, Math.min(1, skill));
    s.errors[step.id] = 0;
    return this.advance(actor);
  }

  /** Abandon the drink. Ingredients already used are lost; the order goes back to the queue of orders to brew. */
  cancel(actor: Actor = this.player): BrewResult {
    const s = this.sessions.get(actor.id);
    if (!s) return no('noSession');
    this.sessions.delete(actor.id);
    this.orders.transition(s.orderId, 'ACCEPTED', 'brewCancelled');
    this.bus.emit('brew:aborted', { orderId: s.orderId, reason: 'cancelled' });
    return OK;
  }

  private advance(actor: Actor): BrewResult {
    const s = this.sessions.get(actor.id)!;
    const prev = this.stepOf(s)!;
    s.stepIndex++;
    const next = this.stepOf(s);
    if (!next) return this.finish(actor);
    // Consecutive steps at the same station continue without walking away.
    s.armedAt = next.station === prev.station ? this.now() : null;
    this.bus.emit('brew:step', { orderId: s.orderId, stepIndex: s.stepIndex });
    return OK;
  }

  private finish(actor: Actor): BrewResult {
    const s = this.sessions.get(actor.id)!;
    const timings = Object.values(s.scores);
    const performance = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 1;
    const recipeAccuracy = s.choices.length ? s.choices.filter((c) => c.correct).length / s.choices.length : 1;
    const { beanWeight, performanceWeight } = this.config.scoring;
    const beanQuality = s.bean?.quality ?? 0;
    const drink: Drink = {
      id: `drink:${this.nextDrink++}`,
      orderId: s.orderId,
      recipeId: s.recipeId,
      beanItem: s.bean?.itemId ?? '',
      beanQuality,
      recipeAccuracy,
      performance,
      quality: Math.round(beanWeight * beanQuality + performanceWeight * performance * 100),
      readyAt: this.now(),
      steps: { ...s.scores },
      stepErrors: { ...s.errors },
      choices: s.choices.map((c) => ({ ...c })),
    };
    const t = this.orders.transition(s.orderId, 'READY');
    if (!t.ok) return no(t.reason);
    this.orders.patch(s.orderId, { quality: drink.quality });
    this.sessions.delete(actor.id);
    this.drinks.set(drink.id, drink);
    if (this.stashers.has(actor.id)) this.pool.push(drink.id);
    else {
      actor.heldItem = drink.id;
      this.bus.emit('actor:heldChanged', { actorId: actor.id, item: drink.id });
      actor.syncRestState();
    }
    this.bus.emit('brew:finished', { orderId: s.orderId, drinkId: drink.id, quality: drink.quality });
    return OK;
  }

  /** The drink leaves the actor's hands into a customer's (once). */
  handOver(drinkId: string, actor: Actor = this.player): Drink | undefined {
    const d = this.drinks.get(drinkId);
    if (!d || actor.heldItem !== drinkId) return undefined;
    this.drinks.delete(drinkId);
    actor.heldItem = null;
    this.bus.emit('actor:heldChanged', { actorId: actor.id, item: null });
    return d;
  }

  // ── supplies (milk etc.) ────────────────────────────────────────────────

  supplyPrice(itemId: string): number | undefined {
    return this.config.supplies[itemId];
  }
}
