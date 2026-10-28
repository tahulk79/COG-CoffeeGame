import type { Actor } from '../../entities/Actor';
import type { RunPhase } from './RunService';
import { ShopService, type ShopConfig, type ShopView } from './ShopService';

/**
 * Chapter 1 street life: passers-by and motorbikes going about their day,
 * and the stalls whose sellers banter in speech bubbles when the hero walks up.
 * Talks play on their own; the player only picks one of two replies. Nothing
 * here can hurt (that is the run's job). Pure simulation: tile units, ms.
 */

/** [speaker id, text]; `hero` is the player. */
export type Line = [string, string];

export interface StallPerson {
  id: string;
  name: string;
  look: string;
  x: number;
  y: number;
}

export interface StallConfig {
  id: string;
  name: string;
  /** Footprint corner (the stall is 2×1 on the map). */
  x: number;
  y: number;
  people: StallPerson[];
  lines: Line[];
  choices: Array<{ text: string; reply: Line[] }>;
  /** Said after the reply: often a hint of what will go wrong later. */
  after: Line[];
}

export interface StreetConfig {
  walkers: number;
  bikes: number;
  /** Rows (tile y) passers-by walk along, and the motorbike lanes. */
  lanes: number[];
  bikeLanes: number[];
  walkSpeed: [number, number];
  bikeSpeed: number;
  /** The hero this close to a stall's centre starts its talk. */
  talkRadius: number;
  /** A passer-by in view says something every so often. */
  chatEveryMs: [number, number];
  looks: string[];
  chatter: Record<string, string[]>;
  bumped: string[];
  honk: string[];
  /** A stall person tapped again after their talk: a short line instead. */
  again: string[];
  /** A bike meeting the hero brakes in time this often (0–1), its rider saying one of `skid`. */
  skidChance: number;
  skid: string[];
  /** Barriers closing each end of the street, each with its guard. */
  gates?: GateConfig[];
  gateLines?: GateLines;
  /** What is said while the hero lies knocked out and gets taken away. */
  rescue?: RescueLines;
  /** Shops with a door on the street: walking in opens their room (see ShopService). */
  shops?: ShopConfig[];
}

export interface RescueLines {
  /** The crowd gathering round, in order. */
  crowd: string[];
  siren: string;
  xeom: string;
  driver: string;
  lift: string;
  /** The sound word when the hero's head meets the ambulance door. */
  bonk: string;
  oops: string;
}

/** Everything said at a barrier, in order. */
export interface GateLines {
  hero: string; guard: string; open: string; ask: string; no: string;
  /** The two replies: argue (and get through…) or give up. */
  argue: string; back: string; good: string; relent: string;
  /** After the crash: the rider, the guard, the hero's last words. */
  rider: string; scold: string; faint: string;
}

/** A barrier across the street end at column `x`; `inward` is the direction into the street (1 / -1). */
export interface GateConfig {
  id: string;
  x: number;
  inward: number;
  guard: { x: number; y: number };
  /** Only while the stroll's fence stands (the checkpoint mid-street, taken down at rush hour). */
  stroll?: boolean;
  /** Words on the sign over the barrier, if any. */
  sign?: string;
}

export interface NpcView {
  id: string;
  look: string;
  x: number;
  y: number;
  /** -1 / 1: walking towards smaller / larger x (0 for people at stalls). */
  dir: number;
  moving: boolean;
  bike: boolean;
  say: string | null;
  /** Shrinks into the magic circle (1 normal, 0 gone). */
  scale: number;
  /** A bike braking hard right now ("Kíííít!"): smoke and skid marks. */
  skid: boolean;
}

export interface StreetView {
  npcs: NpcView[];
  /** What the hero is saying right now (a stall talk), or null. */
  heroSay: string | null;
  /** The stall talk waiting for the player's reply: the two replies. */
  choices: string[] | null;
  /** Stall whose talk is playing, or null. */
  talking: string | null;
  /** The barriers standing now: how far each boom is raised (0 shut, 1 up), and the words on its sign. */
  gates: Array<{ id: string; x: number; open: number; sign: string | null }>;
  /** Rescue: the medics are carrying the hero (lift the figure), the hero is inside the ambulance (hide it). */
  carried: boolean;
  heroHidden: boolean;
  /** Rescue: a sound word over the hero ("CỐP!"), or null. */
  bonk: string | null;
  /** Inside a shop: its room, or null on the street. */
  shop: ShopView | null;
  /** The shop doors on the street (open during the stroll only). */
  doors: Array<{ id: string; name: string; x: number; y: number; open: boolean }>;
  /** Rescue: what the camera should follow instead of the hero (the ambulance, once the hero is inside), or null. */
  focus: { x: number; y: number } | null;
  /** Rescue: the magic circle the ambulance drives into (`t` 0–1 as it opens, `k` 0–1 as it swallows the van), or null. */
  portal: { x: number; y: number; t: number; k: number } | null;
}

export interface StreetHooks {
  phase(): RunPhase | null;
  isVisited(stallId: string): boolean;
  visited(stallId: string): void;
  /** East end of the street the walkers may use (the fence during the stroll). */
  limitX(): number;
  /** The barrier scene walks the hero itself: keys and joystick do nothing meanwhile. */
  hold(on: boolean): void;
  /** Knocked out by the motorbike past the barrier, lying `downMs` while the ambulance comes. */
  crash(line: string, downMs: number): void;
  /** The hero lies knocked out: the rescue plays. */
  isDown(): boolean;
  /** Free ground (no wall, stall, tree, car…) at this point. */
  walkable(x: number, y: number): boolean;
  /** Rush hour: an ordinary passing motorbike ran the hero over. */
  bikeHit(): void;
  /** The rescue is over (the ambulance went through the magic circle): the story moves on. */
  rescued(): void;
}

type GateStage = 'refuse' | 'choose' | 'argue' | 'back' | 'crash';

interface Npc {
  id: string;
  look: string;
  x: number;
  y: number;
  dir: number;
  speed: number;
  bike: boolean;
  /** At a stall: never moves. */
  still: boolean;
  /** Stopped by the hero in the way (ms left). */
  waitMs: number;
  say: { text: string; ms: number } | null;
  /** No more "watch where you're going" from this one until then (street time, ms). */
  quietUntil: number;
  /** Rescue: where this one walks to (a gathering onlooker, a medic). */
  goal?: { x: number; y: number };
  scale?: number;
  /** Braking hard (ms left of smoke), and no second near miss with the hero until `skidSafeUntil`. */
  skidMs?: number;
  skidSafeUntil?: number;
}

interface Talk {
  stall: StallConfig;
  script: Line[];
  index: number;
  ms: number;
  /** Waiting for the reply (the script ran out before the choice). */
  choosing: boolean;
  chosen: boolean;
}

/** Hero further than this beyond the talk radius walks out of the talk (it starts over next time). */
const LEAVE_MARGIN = 1.6;
const BUMP_AT = 0.75;
/** Tapping someone this close talks to them at once; further away, the hero walks over first. */
const TALK_REACH = 2.6;

export class StreetService {
  private readonly npcs: Npc[] = [];
  private talk: Talk | null = null;
  private heroSay: { text: string; ms: number } | null = null;
  private chatIn = 2000;
  private ms = 0;
  /** Time into rush hour: the first seconds give the player a chance to get off the road. */
  private chaosMs = 0;
  /** A person the player tapped while too far: the hero walks there and the talk starts on arrival. */
  private pendingTalk: { id: string; until: number } | null = null;
  /** The guard keeps a barrier up while a motorbike goes through (street time, ms). */
  private readonly gateHold: Record<string, number> = {};
  /** No passer-by greets the hero more often than this (street time, ms). */
  private greetQuietUntil = 0;
  /** The shop the hero is in, or null; doors do not take the hero straight back in after leaving. */
  private shop: ShopService | null = null;
  private doorQuietUntil = 0;
  /** The scene at a street end (see `tickGate`). */
  private gateRun: { gate: GateConfig; stage: GateStage; ms: number; bike: Npc | null; van: Npc | null } | null = null;
  private readonly gateOpen: Record<string, number> = {};
  private readonly gateQuietUntil: Record<string, number> = {};
  /** The rescue after a knock-out (see `tickRescue`). */
  private rescue: { ms: number; dir: number; crowd: Npc[]; van: Npc | null; medics: Npc[]; carried: boolean; hidden: boolean; bonkMs: number; portal: { x: number; y: number; ms: number } | null; bonked: boolean; done: boolean } | null = null;

  constructor(
    private readonly config: StreetConfig,
    private readonly stalls: StallConfig[],
    private readonly player: Actor,
    private readonly random: () => number,
    private readonly size: { w: number; h: number },
    private readonly hooks: StreetHooks,
  ) {
    for (const s of stalls) for (const p of s.people) this.npcs.push({ id: `${s.id}:${p.id}`, look: p.look, x: p.x, y: p.y, dir: 0, speed: 0, bike: false, still: true, waitMs: 0, say: null, quietUntil: 0 });
    for (let i = 0; i < config.walkers; i++) this.npcs.push(this.walker(i, 1.5 + this.random() * (this.hooks.limitX() - 3)));
    // Bikes start on the part of the road the fence leaves open.
    for (let i = 0; i < config.bikes; i++) this.npcs.push(this.bike(i, this.random() * (this.hooks.limitX() - 2)));
    for (const g of config.gates ?? []) {
      this.gateOpen[g.id] = 0;
      this.npcs.push({ id: `gate:${g.id}`, look: 'guard', x: g.guard.x, y: g.guard.y, dir: g.inward, speed: 0, bike: false, still: true, waitMs: 0, say: null, quietUntil: 0 });
    }
  }

  private walker(i: number, x: number): Npc {
    const c = this.config, r = this.random;
    return { id: `walker${i}`, look: c.looks[Math.floor(r() * c.looks.length)]!, x, y: c.lanes[Math.floor(r() * c.lanes.length)]!, dir: r() < 0.5 ? -1 : 1, speed: c.walkSpeed[0] + r() * (c.walkSpeed[1] - c.walkSpeed[0]), bike: false, still: false, waitMs: 0, say: null, quietUntil: 0 };
  }

  private bike(i: number, x: number): Npc {
    const lane = i % this.config.bikeLanes.length;
    // Keep to the right: the north lane drives west, the south lane east.
    return { id: `bike${i}`, look: 'bike', x, y: this.config.bikeLanes[lane]!, dir: lane === 0 ? -1 : 1, speed: this.config.bikeSpeed * (0.85 + this.random() * 0.3), bike: true, still: false, waitMs: 0, say: null, quietUntil: 0 };
  }

  tick(dt: number): void {
    this.ms += dt;
    // Inside a shop the street waits (nobody moves, the stroll clock is stopped by the run).
    if (this.shop) {
      if (this.shop.tick(dt)) this.leaveShop();
      return;
    }
    if (this.hooks.phase() === 'chaos') this.chaosMs += dt;
    for (const n of this.npcs) if (n.say && (n.say.ms -= dt) <= 0) n.say = null;
    if (this.heroSay && (this.heroSay.ms -= dt) <= 0) this.heroSay = null;
    for (const n of this.npcs) if (!n.still) this.move(n, dt);
    this.chatter(dt);
    this.greet();
    if (this.pendingTalk) {
      const n = this.npcs.find((m) => m.id === this.pendingTalk!.id);
      if (!n || this.ms > this.pendingTalk.until) this.pendingTalk = null;
      else if (Math.hypot(n.x - this.player.pos.x, n.y - this.player.pos.y) < TALK_REACH) { this.pendingTalk = null; this.talkTo(n.id); }
    }
    this.tickGate(dt);
    this.tickTalk(dt);
    this.tickDoors();
    this.tickRescue(dt);
  }

  // ── shops ───────────────────────────────────────────────────────────────

  /** Everyone on foot the hero should walk round (not the bikes, not anyone hidden). */
  people(): Array<{ x: number; y: number }> {
    return this.npcs.filter((n) => !n.bike && (n.scale ?? 1) > 0.01);
  }

  /** The hero is up and about (not knocked out): stalls talk, doors are open. */
  private walking(): boolean {
    const ph = this.hooks.phase();
    return ph === 'stroll' || ph === 'chaos';
  }

  /** True while the hero is inside a shop. */
  get inside(): boolean {
    return this.shop !== null;
  }

  /** Walking onto an open door goes in (only during the stroll, and not in the middle of something else). */
  private tickDoors(): void {
    if (!this.walking() || this.gateRun || this.rescue || this.ms < this.doorQuietUntil) return;
    const p = this.player.pos;
    const s = (this.config.shops ?? []).find((s) => Math.hypot(p.x - s.door.x, p.y - s.door.y) < 0.6);
    if (!s) return;
    // Stepping into a doorway always goes in, even mid-talk at the stall next door (it plays again later).
    if (this.talk) this.endTalk(false);
    this.shop = new ShopService(s, this.hooks.isVisited(s.id), (id) => this.hooks.visited(id), this.random, this.config.again);
    this.pendingTalk = null;
    this.hooks.hold(true);
  }

  private leaveShop(): void {
    const s = this.shop!.config;
    this.shop = null;
    // Back on the sidewalk just in front of the door, facing the street.
    this.player.pos = { x: s.door.x, y: s.door.y + 0.9 };
    this.doorQuietUntil = this.ms + 1500;
    this.hooks.hold(false);
  }

  /** Keys / joystick while inside a shop. */
  shopSteer(x: number, y: number): void {
    this.shop?.setSteer(x, y);
  }

  /** Tap on the shop floor (room coordinates). */
  shopMoveTo(x: number, y: number): void {
    this.shop?.moveTo(x, y);
  }

  // ── rescue ──────────────────────────────────────────────────────────────

  /**
   * The hero is down: onlookers gather and comment, the ambulance pulls up
   * (a xe ôm offers to do it cheaper), the medics carry the hero in (head,
   * meet door), and the ambulance speeds off… straight into a magic circle
   * that opens on the road. Then the story moves on.
   */
  private tickRescue(dt: number): void {
    const L = this.config.rescue;
    if (!L) return;
    if (!this.rescue) {
      if (!this.hooks.isDown()) return;
      const p0 = this.player.pos;
      this.rescue = { ms: 0, dir: p0.x > this.size.w / 2 ? -1 : 1, crowd: [], van: null, medics: [], carried: false, hidden: false, bonkMs: 0, portal: null, bonked: false, done: false };
    }
    const r = this.rescue, prev = r.ms, p = this.player.pos;
    r.ms += dt;
    r.bonkMs = Math.max(0, r.bonkMs - dt);
    const at = (ms: number) => prev < ms && r.ms >= ms;
    const lanes = this.config.bikeLanes;
    const lane = lanes.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a), lanes[0]!);
    // The side of the hero away from the ambulance's lane: the crowd stands there, out of its way.
    const away = p.y >= lane ? 1 : -1;
    // Onlookers: the nearest passers-by stop what they are doing and stand round the hero.
    if (at(600)) {
      const spots = [[-1.1, 0.7 * away], [0.1, 1.0 * away], [1.2, 0.7 * away], [2.0, 0.3 * away]] as const;
      const near = this.npcs.filter((n) => !n.still && !n.bike).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, spots.length);
      // Each onlooker stands on free ground near their spot (never inside a stall, a tree or a car).
      near.forEach((n, i) => { n.still = true; n.goal = this.freeNear(p.x + spots[i]![0], p.y + spots[i]![1]); });
      r.crowd = near;
    }
    const say = (n: Npc | undefined, text: string, ms = 2200) => { if (n) n.say = { text, ms }; };
    if (at(1500)) say(r.crowd[0], L.crowd[0] ?? '');
    if (at(2700)) say(r.crowd[1], L.crowd[1] ?? '');
    if (at(3900)) say(r.crowd[2], L.crowd[2] ?? '');
    if (at(2200)) r.van = this.vehicle('ambulance', 'ambulance', p.x - r.dir * 12, lane, r.dir, 8, L.siren);
    if (at(4800)) say(r.crowd[3] ?? r.crowd[0], L.xeom);
    if (at(5800)) say(r.van ?? undefined, L.driver, 1600);
    if (at(6600)) say(r.crowd[0], L.crowd[3] ?? '');
    // The van pulls up short of the hero (never over them), then (later) drives off.
    const v = r.van;
    // Its front door, on the hero's side.
    const door = v ? { x: v.x + r.dir * 1.2, y: v.y + away * 0.45 } : null;
    if (v && !r.hidden) {
      const left = (p.x - r.dir * 2.8 - v.x) * r.dir;
      // Slows down as it arrives instead of stopping dead.
      if (left > 0) v.x += r.dir * Math.min(left, (Math.max(1.5, Math.min(v.speed, left * 2.5)) * dt) / 1000);
    }
    // The medics jump out, take the hero by both ends, and carry them to the back door.
    if (at(7200) && door) {
      r.medics = [0, 1].map((i) => { const n = this.vehicle(`medic${i}`, 'medic', door.x, door.y, -r.dir, 0, ''); n.bike = false; n.say = null; n.goal = this.freeNear(p.x + (i ? 0.6 : -0.6), p.y + 0.15); return n; });
    }
    if (at(8100)) { say(r.medics[0], L.lift, 1500); r.carried = true; }
    if (r.carried && !r.hidden && door && r.ms > 8300) {
      const dx = door.x - p.x, dy = door.y - p.y, d = Math.hypot(dx, dy), step = (2.2 * dt) / 1000;
      if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; }
      else if (!r.bonked) {
        // Head, meet door.
        r.bonked = true;
        r.bonkMs = 900;
        say(r.medics[1], L.oops, 1800);
        r.ms = Math.max(r.ms, 9600);
      }
      r.medics.forEach((m, i) => { m.goal = this.freeNear(p.x + (i ? 0.6 : -0.6), p.y + 0.15); });
    }
    // Everyone in, doors shut, off it goes… and a magic circle opens on the road ahead.
    if (at(10600) && v) {
      r.hidden = true;
      r.carried = false;
      for (const m of r.medics) this.npcs.splice(this.npcs.indexOf(m), 1);
      r.medics = [];
      v.say = { text: L.siren, ms: 2000 };
      r.portal = { x: v.x + r.dir * 6, y: v.y, ms: 0 };
    }
    if (r.portal && v) {
      r.portal.ms += dt;
      // Into the circle: the van shrinks away in a flash.
      const into = (v.x - r.portal.x) * r.dir;
      if (into < 0) v.x += (r.dir * 6 * dt) / 1000;
      else v.scale = Math.max(0, (v.scale ?? 1) - dt / 600);
      if ((v.scale ?? 1) <= 0 && !r.done) {
        r.done = true;
        this.hooks.rescued();
      }
    }
    // The guard raises the boom for the ambulance too.
    if (v) for (const g of this.gates()) if (Math.abs(g.x - v.x) < 3.5) this.gateHold[g.id] = this.ms + 500;
    // Onlookers and medics walk to their spots.
    for (const n of [...r.crowd, ...r.medics]) {
      if (!n.goal) continue;
      const dx = n.goal.x - n.x, dy = n.goal.y - n.y, d = Math.hypot(dx, dy), step = (2.2 * dt) / 1000;
      if (d > step) { n.x += (dx / d) * step; n.y += (dy / d) * step; n.dir = dx >= 0 ? 1 : -1; }
      else n.dir = p.x >= n.x ? 1 : -1;
    }
  }

  // ── street ends ─────────────────────────────────────────────────────────

  /**
   * Walk up to a barrier: the guard turns the hero away, then a motorbike
   * honks and the boom goes up for it ("bikes are family"). The player picks:
   * give up, or argue until the guard lets the hero through… where a
   * motorbike knocks them flat, the ambulance pulls up, and the guard says
   * he told them so.
   */
  private tickGate(dt: number): void {
    const r0 = this.gateRun;
    for (const id in this.gateOpen) {
      const mine = r0?.gate.id === id;
      const want = (mine && ((r0.stage === 'refuse' && r0.ms >= 3400 && r0.ms < 5400) || (r0.stage === 'argue' && r0.ms >= 2400) || (r0.stage === 'crash' && r0.ms < 1500))) || this.ms < (this.gateHold[id] ?? 0);
      this.gateOpen[id] = Math.max(0, Math.min(1, this.gateOpen[id]! + (want ? dt : -dt) / 400));
    }
    const p = this.player.pos, L = this.config.gateLines;
    // Rush hour took the checkpoint down: its guard goes too, and a scene there that had not got going ends.
    for (const g of this.config.gates ?? []) {
      const up = this.gates().includes(g), guard = this.npcs.find((n) => n.id === `gate:${g.id}`);
      if (guard) guard.scale = up ? 1 : 0;
    }
    if (r0 && !this.gates().includes(r0.gate) && (r0.stage === 'refuse' || r0.stage === 'choose' || r0.stage === 'back')) return this.endGate();
    if (!r0) {
      if (this.talk || !L || !this.hooks.phase()) return;
      // Only by the guard, or right at the boom on the road (not anywhere along the street end).
      const lanes = this.config.bikeLanes;
      // A stall talk close by comes first (the iced tea stall stands next to the west guard).
      const stallNear = this.stalls.some((st) => !this.hooks.isVisited(st.id) && Math.hypot(p.x - this.centre(st).x, p.y - this.centre(st).y) <= this.config.talkRadius);
      const g = stallNear ? undefined : this.gates().find((g) => this.ms >= (this.gateQuietUntil[g.id] ?? 0) && (Math.hypot(p.x - g.guard.x, p.y - g.guard.y) < 1.4 || (Math.abs(p.x - g.x) < 1.7 && p.y > lanes[0]! - 1 && p.y < lanes[lanes.length - 1]! + 1)));
      if (g) this.startGate(g);
      return;
    }
    const r = r0, g = r.gate, prev = r.ms;
    r.ms += dt;
    const at = (ms: number) => prev < ms && r.ms >= ms;
    const guard = this.npcs.find((n) => n.id === `gate:${g.id}`)!;
    const lane = this.config.bikeLanes[g.inward > 0 ? this.config.bikeLanes.length - 1 : 0]!;
    const ride = (n: Npc) => { n.x += (n.dir * n.speed * dt) / 1000; };
    // Walked off before it was settled: the scene ends (and plays again later).
    if ((r.stage === 'refuse' || r.stage === 'choose') && Math.abs(p.x - g.x) > 4) return this.endGate();
    switch (r.stage) {
      case 'refuse': {
        if (prev === 0) this.heroSay = { text: L!.hero, ms: 1800 };
        if (at(1500)) guard.say = { text: L!.guard, ms: 1800 };
        if (at(2400)) {
          r.bike = this.vehicle(`gatebike:${g.id}`, 'bike', g.x - g.inward * 6, lane, g.inward, this.config.bikeSpeed, this.config.honk[0] ?? 'Bíp bíp!');
        }
        if (at(3800)) guard.say = { text: L!.open, ms: 2000 };
        if (at(6000)) this.heroSay = { text: L!.ask, ms: 1800 };
        if (at(7400)) guard.say = { text: L!.no, ms: 2000 };
        // The bike waits at the boom until it is up, then rides on into the street and away.
        const b = r.bike;
        if (b) {
          const before = (g.x - b.x) * g.inward;
          if (before > 0.9 || this.gateOpen[g.id]! >= 0.9 || before < 0) ride(b);
        }
        if (r.ms >= 8800) {
          if (b) this.npcs.splice(this.npcs.indexOf(b), 1);
          r.bike = null;
          r.stage = 'choose';
          r.ms = 0;
        }
        return;
      }
      case 'choose':
        return;
      case 'back':
        if (prev === 0) this.heroSay = { text: L!.back, ms: 1600 };
        if (at(1400)) guard.say = { text: L!.good, ms: 1400 };
        if (r.ms >= 2400) this.endGate();
        return;
      case 'argue': {
        if (prev === 0) { this.heroSay = { text: L!.argue, ms: 1800 }; this.hooks.hold(true); }
        if (at(1700)) guard.say = { text: L!.relent, ms: 1800 };
        if (r.ms < 2600) return;
        // Through the open barrier and out along the road…
        const lanes = this.config.bikeLanes, tx = g.x - g.inward * 3, ty = (lanes[0]! + lanes[lanes.length - 1]!) / 2;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), step = (2.6 * dt) / 1000;
        if (d > step) { this.player.faceTowards({ x: tx, y: ty }); p.x += (dx / d) * step; p.y += (dy / d) * step; }
        // …where a motorbike comes the other way.
        if (!r.bike && (g.x - p.x) * g.inward > 1) r.bike = this.vehicle(`crashbike:${g.id}`, 'bike', g.x - g.inward * 9, p.y, g.inward, 9, this.config.honk[0] ?? 'Bíp bíp!');
        const b = r.bike;
        if (b) {
          ride(b);
          if (Math.abs(b.x - p.x) < 0.7) {
            b.say = { text: L!.rider, ms: 2200 };
            this.hooks.crash(L!.faint, 8000);
            r.stage = 'crash';
            r.ms = 0;
          }
        }
        return;
      }
      case 'crash':
        // The bike rides off; the guard has the last word (the rescue does the rest).
        if (r.bike) { ride(r.bike); if (r.ms > 1800) { this.npcs.splice(this.npcs.indexOf(r.bike), 1); r.bike = null; } }
        if (at(3300)) guard.say = { text: L!.scold, ms: 2400 };
        return;
    }
  }

  /** The barriers standing now: both street ends, plus the mid-street checkpoint while the stroll lasts. */
  private gates(): GateConfig[] {
    const fenced = this.hooks.limitX() < this.size.w - 1;
    return (this.config.gates ?? []).filter((g) => !g.stroll || fenced);
  }

  private startGate(g: GateConfig): void {
    this.gateRun = { gate: g, stage: 'refuse', ms: 0, bike: null, van: null };
  }

  /**
   * The player tapped someone. A stall person starts their stall's talk (or a
   * short line if it was heard), the guard starts the barrier scene, a passer-by
   * says something. Too far away: false (the hero walks over first, see `walkTo`).
   */
  talkTo(id: string): boolean {
    if (this.shop) return this.shop.talkTo(id) || true;
    const n = this.npcs.find((m) => m.id === id);
    if (!n || this.hooks.isDown()) return false;
    const p = this.player.pos;
    if (Math.hypot(n.x - p.x, n.y - p.y) > TALK_REACH) return false;
    if (id.startsWith('gate:')) {
      const g = this.gates().find((g) => `gate:${g.id}` === id);
      if (g && !this.gateRun && !this.talk && this.hooks.phase()) this.startGate(g);
      return true;
    }
    const stall = this.stalls.find((s) => id.startsWith(`${s.id}:`));
    if (stall) {
      if (this.talk?.stall === stall || this.gateRun) return true;
      if (!this.hooks.isVisited(stall.id) && this.walking()) {
        this.talk = { stall, script: [...stall.lines], index: 0, ms: 0, choosing: false, chosen: false };
        this.say(stall.lines[0]!);
      } else n.say = { text: this.pick(this.config.again), ms: 2200 };
      return true;
    }
    if (!n.bike) n.say = { text: this.pick(this.config.chatter[n.look] ?? this.config.bumped), ms: 2600 };
    return true;
  }

  /** Tapped someone too far away: the talk starts once the hero gets there. */
  walkTo(id: string): void {
    this.pendingTalk = { id, until: this.ms + 8000 };
  }

  /** Where a tapped person stands (for walking over), or null. */
  npcPos(id: string): { x: number; y: number } | null {
    const n = this.npcs.find((m) => m.id === id);
    return n ? { x: n.x, y: n.y } : null;
  }

  /** A passer-by brushing past the hero says something to them. */
  private greet(): void {
    if (this.ms < this.greetQuietUntil || this.talk || this.gateRun || this.hooks.isDown()) return;
    const p = this.player.pos;
    const n = this.npcs.find((m) => !m.still && !m.bike && !m.say && this.ms >= m.quietUntil && Math.hypot(m.x - p.x, m.y - p.y) < 1.3);
    const lines = n && this.config.chatter[n.look];
    if (!n || !lines?.length) return;
    n.say = { text: this.pick(lines), ms: 2600 };
    n.quietUntil = this.ms + 12000;
    this.greetQuietUntil = this.ms + 2500;
  }

  /** The nearest free ground to a point (searching outwards a little), or the point itself. */
  private freeNear(x: number, y: number): { x: number; y: number } {
    for (let r = 0; r <= 1.5; r += 0.5) for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a * Math.PI) / 4) * r, py = y + Math.sin((a * Math.PI) / 4) * r;
      if (this.hooks.walkable(px, py)) return { x: px, y: py };
      if (r === 0) break;
    }
    return { x, y };
  }

  /** A scripted vehicle (bike, ambulance) that only the barrier scene moves. */
  private vehicle(id: string, look: string, x: number, y: number, dir: number, speed: number, say: string): Npc {
    const n: Npc = { id, look, x, y, dir, speed, bike: true, still: true, waitMs: 0, say: { text: say, ms: 1600 }, quietUntil: 0 };
    this.npcs.push(n);
    return n;
  }

  private endGate(): void {
    const r = this.gateRun!;
    for (const n of [r.bike, r.van]) if (n) this.npcs.splice(this.npcs.indexOf(n), 1);
    this.gateRun = null;
    this.hooks.hold(false);
    // Once is funny; walking straight back plays it again only after a while.
    this.gateQuietUntil[r.gate.id] = this.ms + 15000;
  }

  // ── passers-by ──────────────────────────────────────────────────────────

  private move(n: Npc, dt: number): void {
    const p = this.player.pos;
    const ahead = (p.x - n.x) * n.dir, across = Math.abs(p.y - n.y);
    const lanes = this.config.bikeLanes;
    const chaos = this.hooks.phase() === 'chaos';
    let pace = 1;
    if (n.bike && chaos) {
      // Rush hour: bikes do not stop for anyone. A honk from afar and a little braking; still in the way, you are flat.
      if (ahead > 0 && ahead < 4.5 && across < 0.7) {
        if (this.ms >= n.quietUntil) {
          n.say = { text: this.pick(this.config.honk), ms: 1400 };
          n.quietUntil = this.ms + 4000;
        }
        pace = 0.45;
      }
      if (ahead > -0.3 && ahead < 0.55 && across < 0.45 && this.chaosMs > 5000) this.nearMiss(n);
      n.waitMs = 0;
    } else {
      // Walking into a bike (stepping in front of a moving one, or bumping into it) is a crash, stroll or not.
      if (n.bike && !this.hooks.isDown() && ahead > -0.3 && ahead < 0.55 && across < 0.45) this.nearMiss(n);
      // The hero (standing or lying) in the way: walkers stop and grumble, bikes stop and honk.
      if (ahead > 0 && ahead < (n.bike ? 1.8 : BUMP_AT) && across < (n.bike ? 0.7 : 0.5)) this.blocked(n, n.bike ? this.config.honk : this.config.bumped);
      // Bikes also queue behind the ambulance (no driving through it).
      const van = this.rescue?.van;
      if (n.bike && van && van !== n && !this.rescue?.hidden) {
        const gap = (van.x - n.x) * n.dir;
        if (gap > 0 && gap < 2.8 && Math.abs(van.y - n.y) < 0.6) this.blocked(n, this.config.honk);
      }
    }
    // The street ends are barriers: a bike coming up has the guard raise the boom, and waits until it is up.
    if (n.bike) for (const g of this.gates()) {
      const before = (g.x - n.x) * n.dir;
      if (before > -1.5 && before < 3.5) this.gateHold[g.id] = this.ms + 500;
      if (before > 0 && before < 1.1 && (this.gateOpen[g.id] ?? 0) < 0.9) return;
    }
    if (n.skidMs) n.skidMs = Math.max(0, n.skidMs - dt);
    if (n.waitMs > 0) {
      n.waitMs -= dt;
      return;
    }
    n.x += (n.dir * n.speed * pace * dt) / 1000;
    if (n.bike) {
      // While the hero is being taken away, bikes leaving the street do not come back (the road is jammed).
      if (n.x < -3 || n.x > this.size.w + 3) {
        if (this.hooks.isDown()) { n.speed = 0; n.x = n.x < 0 ? -6 : this.size.w + 6; return; }
        n.x = n.x < -3 ? this.size.w + 3 : -3;
      }
      return;
    }
    // Walkers turn round at the ends of the street (and at the fence while it stands).
    const hi = this.hooks.limitX() - 0.6;
    if (n.x < 1.4) { n.x = 1.4; n.dir = 1; }
    else if (n.x > hi) { n.x = hi; n.dir = -1; }
  }

  /**
   * A bike and the hero meet: luck decides. Either the rider slams the brakes
   * ("Kíííít!", tyre smoke, a mouthful for the hero) and the hero walks away,
   * or there is no stopping in time.
   */
  private nearMiss(n: Npc): void {
    if (this.ms < (n.skidSafeUntil ?? 0)) return;
    if (this.random() < this.config.skidChance) {
      n.waitMs = 1400;
      n.skidMs = 900;
      n.skidSafeUntil = this.ms + 2500;
      n.say = { text: this.pick(this.config.skid), ms: 2200 };
      return;
    }
    this.hooks.bikeHit();
  }

  /** Stopped by something in the way: wait a moment, and say so (not every time). */
  private blocked(n: Npc, lines: string[]): void {
    if (n.waitMs <= 0 && this.ms >= n.quietUntil) {
      n.say = { text: this.pick(lines), ms: 2200 };
      n.quietUntil = this.ms + 6000;
    }
    n.waitMs = 600;
  }

  /** Someone in view says something now and then. */
  private chatter(dt: number): void {
    this.chatIn -= dt;
    if (this.chatIn > 0) return;
    const [a, b] = this.config.chatEveryMs;
    this.chatIn = a + this.random() * (b - a);
    const p = this.player.pos;
    const near = this.npcs.filter((n) => !n.still && !n.bike && !n.say && Math.hypot(n.x - p.x, n.y - p.y) < 7);
    const n = near[Math.floor(this.random() * near.length)];
    const lines = n && this.config.chatter[n.look];
    if (n && lines?.length) n.say = { text: this.pick(lines), ms: 3000 };
  }

  private pick(lines: string[]): string {
    return lines[Math.floor(this.random() * lines.length)] ?? '';
  }

  // ── stall talks ─────────────────────────────────────────────────────────

  private centre(s: StallConfig): { x: number; y: number } {
    return { x: s.x + 1, y: s.y + 0.5 };
  }

  private tickTalk(dt: number): void {
    const p = this.player.pos;
    const t = this.talk;
    if (t) {
      const c = this.centre(t.stall);
      // Walked off, or rush hour began: the talk stops (and plays again from the top next time).
      if (Math.hypot(p.x - c.x, p.y - c.y) > this.config.talkRadius + LEAVE_MARGIN || !this.walking()) return this.endTalk(false);
      if (t.choosing) return;
      t.ms += dt;
      if (t.ms < lineMs(t.script[t.index]![1])) return;
      t.ms = 0;
      t.index += 1;
      if (t.index < t.script.length) return this.say(t.script[t.index]!);
      if (!t.chosen && t.stall.choices.length) {
        t.choosing = true;
        return;
      }
      return this.endTalk(true);
    }
    if (!this.walking() || this.gateRun) return;
    for (const s of this.stalls) {
      if (this.hooks.isVisited(s.id)) continue;
      const c = this.centre(s);
      if (Math.hypot(p.x - c.x, p.y - c.y) > this.config.talkRadius) continue;
      this.talk = { stall: s, script: [...s.lines], index: 0, ms: 0, choosing: false, chosen: false };
      this.say(s.lines[0]!);
      return;
    }
  }

  /** The player picks reply `i`: the hero says it, the stall answers, then its last words. */
  choose(i: number): boolean {
    if (this.shop) return this.shop.choose(i);
    const r = this.gateRun;
    if (r?.stage === 'choose' && (i === 0 || i === 1)) {
      r.stage = i === 0 ? 'argue' : 'back';
      r.ms = 0;
      return true;
    }
    const t = this.talk;
    const c = t?.choosing ? t.stall.choices[i] : undefined;
    if (!t || !c) return false;
    t.choosing = false;
    t.chosen = true;
    t.script = [['hero', c.text], ...c.reply, ...t.stall.after];
    t.index = 0;
    t.ms = 0;
    this.say(t.script[0]!);
    return true;
  }

  private say([who, text]: Line): void {
    const t = this.talk!;
    const ms = lineMs(text) + 400;
    if (who === 'hero') this.heroSay = { text, ms };
    else {
      const n = this.npcs.find((n) => n.id === `${t.stall.id}:${who}`);
      if (n) n.say = { text, ms };
    }
  }

  private endTalk(done: boolean): void {
    const t = this.talk!;
    this.talk = null;
    if (done) this.hooks.visited(t.stall.id);
  }

  view(): StreetView {
    const t = this.talk;
    return {
      npcs: this.npcs.map((n) => ({ id: n.id, look: n.look, x: n.x, y: n.y, dir: n.dir, moving: (!n.still && n.waitMs <= 0) || !!n.goal, bike: n.bike, say: n.say?.text ?? null, scale: n.scale ?? 1, skid: !!n.skidMs })),
      heroSay: this.heroSay?.text ?? null,
      choices: this.shop ? this.shop.view().choices : this.gateRun?.stage === 'choose' && this.config.gateLines ? [this.config.gateLines.argue, this.config.gateLines.back] : t?.choosing ? t.stall.choices.map((c) => c.text) : null,
      talking: t?.stall.id ?? null,
      gates: this.gates().map((g) => ({ id: g.id, x: g.x, open: this.gateOpen[g.id] ?? 0, sign: g.sign ?? null })),
      shop: this.shop?.view() ?? null,
      doors: (this.config.shops ?? []).map((s) => ({ id: s.id, name: s.name, x: s.door.x, y: s.door.y, open: this.walking() })),
      carried: !!this.rescue?.carried,
      focus: this.rescue?.hidden && this.rescue.van ? { x: this.rescue.van.x, y: this.rescue.van.y } : null,
      heroHidden: !!this.rescue?.hidden,
      bonk: this.rescue?.bonkMs ? this.config.rescue?.bonk ?? null : null,
      portal: this.rescue?.portal ? { x: this.rescue.portal.x, y: this.rescue.portal.y, t: Math.min(1, this.rescue.portal.ms / 500), k: 1 - (this.rescue.van?.scale ?? 1) } : null,
    };
  }
}

/** Time a line stays up: long enough to read it. */
function lineMs(text: string): number {
  return Math.max(1600, 900 + text.length * 45);
}
