import type { Footprint, WorldPos } from '../../utils/tile';
import type { Rect } from '../../systems/camera/framing';
import { vanBody, type RescueRoute } from './rescueRouting';
import { facingFrom, type Actor, type Facing } from '../../entities/Actor';
import type { HazardKind, RunPhase } from './RunService';

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
  ambulanceAccess?: Rect[];
}

export interface RescueLines {
  /** The crowd gathering round, in order. */
  crowd: string[];
  siren: string;
  xeom: string;
  driver: string;
  /** The sound word when the hero's head meets the ambulance door. */
  bonk: string;
  oops: string;
  /** The medics clearing the crowd, scolding the one filming, and the reply. */
  shoo: string;
  scold: string;
  filmer: string;
  /** No stretcher ("left it at home"), so the two medics carry the hero by hand. */
  noStretcher: string;
  handCarry: string;
  /** Onlookers snapping photos (with a flash) while the hero is carried off. */
  photo: string[];
  /** How often (0–1) the ambulance loses a wheel on its way into the circle and blows up instead; the driver's cry and the bang. */
  wheelOffChance?: number;
  wheelOff: string;
  boom: string;
}

/**
 * Everything said at a street end. Everyone walks past the boom without a
 * thought; only the hero trying it gets flattened: by a motorbike coming
 * through, or by the boom itself coming down on their head.
 */
export interface GateLines {
  /** The hero deciding to go through, and the guard waving them on. */
  hero: string; guard: string;
  /** Motorbike: the rider (on the road, or up on the sidewalk), the guard afterwards, the hero's last words. */
  rider: string; kerb: string; scold: string; faint: string;
  /** Boom: the guard raising it for the hero, letting it slip, the guard afterwards, the hero's last words. */
  lift: string; slam: string; slamScold: string; slamFaint: string;
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
  /** Leaning over (radians): the ambulance on three wheels. */
  tilt: number;
  axis?: 'x' | 'y';
  facing?: Facing;
  doorOpen?: boolean;
  damaged?: boolean;
}

export interface StreetView {
  npcs: NpcView[];
  /** Simulation time freezes with settings, so rescue animation freezes too. */
  elapsedMs: number;
  /** Shared lift progress for the hero and both medics. */
  carryLift: number;
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
  /** Rescue mishap: the ambulance's wheel rolling off on its own (`spin` turns it), or null. */
  wheel: { x: number; y: number; spin: number } | null;
  /** Rescue mishap: the ambulance blowing up (0–1) and the bang's word, or null. */
  boom: { x: number; y: number; t: number; word: string } | null;
  /** Rescue: onlookers whose phone flash goes off right now (their position). */
  flashes: Array<{ x: number; y: number }>;
  /** Rescue: a sound word over the hero ("CỐP!"), or null. */
  bonk: string | null;
  /** The hero is knocked out and lying on the street. */
  heroDown: boolean;
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
  /** Knocked out at the barrier (by a motorbike, or the boom with `kind` 'barrier'), lying `downMs` while the ambulance comes. */
  crash(line: string, downMs: number, kind?: HazardKind): void;
  /** The hero lies knocked out: the rescue plays. */
  isDown(): boolean;
  /** The hero is being knocked out (the fall is playing) or lies down: nothing may move them about any more. */
  knockedOut(): boolean;
  /** Small round props walked round like people (street-tree trunks, stacks of stools): centre and radius. */
  props(): Array<{ x: number; y: number; r: number }>;
  /** Free ground (no wall, stall, car…) at this point (the round props are not in it, see `props`). */
  walkable(x: number, y: number): boolean;
  canWalk(from: WorldPos, to: WorldPos): boolean;
  path(from: WorldPos, to: WorldPos, avoid?: Footprint): WorldPos[] | null;
  rescueRoute(hero: WorldPos): RescueRoute | null;
  /** Rush hour: an ordinary passing motorbike ran the hero over. */
  bikeHit(): void;
  /** The rescue is over (the ambulance went through the magic circle): the story moves on. */
  rescued(): void;
}

type GateStage = 'walk' | 'crash';

interface Npc {
  id: string;
  look: string;
  x: number;
  y: number;
  dir: number;
  speed: number;
  bike: boolean;
  /** Scripted or based at a stall; does not follow the pedestrian traffic loop. */
  still: boolean;
  /** Stopped by the hero in the way (ms left). */
  waitMs: number;
  say: { text: string; ms: number } | null;
  /** No more "watch where you're going" from this one until then (street time, ms). */
  quietUntil: number;
  /** Rescue: where this one walks to (a gathering onlooker, a medic). */
  goal?: { x: number; y: number };
  scale?: number;
  /** Rescue: snapping photos (ms left of the flash). */
  photoMs?: number;
  /** Leaning over (radians). */
  tilt?: number;
  axis?: 'x' | 'y';
  moving?: boolean;
  facing?: Facing;
  /** Braking hard (ms left of smoke), and no second near miss with the hero until `skidSafeUntil`. */
  skidMs?: number;
  skidSafeUntil?: number;
  /** A walker's own row: stepping aside for someone, they come back to it afterwards. */
  lane?: number;
  /** The side (1 / -1 in y) a walker is stepping aside to, kept until they have passed. */
  dodge?: number;
  /** Time spent wedged with no side to step to (ms). */
  stuckMs?: number;
  /** No forward progress, even while sidestepping: turn back at a genuinely closed passage. */
  blockedMs?: number;
  /** People at a stall or a barrier: where they belong, whether they shuffle about (customers) or only look round
   * (sellers, guards), the next little move (ms) and the spot they are shuffling to. */
  home?: { x: number; y: number; reach: number };
  idleMs?: number;
  shuffleTo?: { x: number; y: number };
  /** A passer-by stopping at a stall on the way: walking over, standing there a while, walking back to their row. */
  visit?: { stall: StallConfig; spot: WorldPos; back: WorldPos; dir: number; phase: 'go' | 'stay' | 'back'; ms: number; stay: number };
  /** No new stall visit before then (street time, ms). */
  visitAt?: number;
  /** A bike going round the loop road at the end of the street: the corners of its path, the leg it is on and how far along that leg it is (tiles). */
  turn?: { path: Array<[number, number]>; i: number; at: number };
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
/** The loop road at each end of the street goes round a block of houses; the drawing in incidentArt.ts matches. x: where a bike leaves the street (west, and east past the map width) and the far side of the loop; y: the loop's two lanes, above and below the street's own lanes. */
const LOOP = { inW: -13, inE: 15, farW: -17.35, farE: 19.35, margin: 2.2 };
/** Where people standing about look when they look round (front-facing, so their faces show). */
const IDLE_LOOKS: Facing[] = ['E', 'S', 'W', 'SE', 'SW'];
/** The hero this close to a street end's boom line (tiles) is trying to get past it. */
const GATE_REACH = 0.9;
/** The two medics never stand closer than this (tiles): one figure on top of the other looks like one. */
const MEDIC_GAP = 0.45;
/** The magic circle takes this long to open before the ambulance drives into it (ms). */
const PORTAL_OPEN_MS = 700;
/** Onlookers never stand closer than this to the hero lying on the street (tiles). */
const MIN_CROWD_GAP = 1.9;
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
  private nextGateBike = 0;
  /** A person the player tapped while too far: the hero walks there and the talk starts on arrival. */
  private pendingTalk: { id: string; until: number } | null = null;
  /** The guard keeps a barrier up while a motorbike goes through (street time, ms). */
  private readonly gateHold: Record<string, number> = {};
  /** No passer-by greets the hero more often than this (street time, ms). */
  private greetQuietUntil = 0;
  /** The scene at a street end (see `tickGate`). */
  private gateRun: { gate: GateConfig; stage: GateStage; ms: number; how: 'bike' | 'slam'; arrived: number | null; bike: Npc | null; landing: { from: WorldPos; to: WorldPos } | null } | null = null;
  /** The boom met the hero's head: the sound word shows this long (ms). */
  private gateBonkMs = 0;
  private readonly gateOpen: Record<string, number> = {};
  private readonly gateQuietUntil: Record<string, number> = {};
  private readonly gateNeedsExit = new Set<string>();
  /** The rescue after a knock-out (see `tickRescue`). */
  private rescue: { route: RescueRoute; ms: number; dir: number; crowd: Npc[]; van: Npc | null; medics: Npc[]; carried: boolean; hidden: boolean; bonkMs: number; portal: { x: number; y: number; ms: number } | null; bonked: boolean; done: boolean;
    /** The wheel-off mishap on the way to the circle: decided as the van leaves, then the wheel and the bang. */
    mishap: { wheel: { x: number; y: number; vx: number; ms: number; spin: number } | null; boom: { x: number; y: number; ms: number } | null } | null } | null = null;

  constructor(
    private readonly config: StreetConfig,
    private readonly stalls: StallConfig[],
    private readonly player: Actor,
    private readonly random: () => number,
    private readonly size: { w: number; h: number },
    private readonly hooks: StreetHooks,
  ) {
    for (const s of stalls) s.people.forEach((p, index) => {
      // A seller must stand on free ground, never inside a counter or a house facade.
      let at = { x: p.x, y: p.y };
      let placed = false;
      for (let r = 0; r <= 3 && !placed; r += 0.25) for (let i = 0; i < 16; i++) {
        const q = { x: p.x + Math.cos(i * Math.PI / 8) * r, y: p.y + Math.sin(i * Math.PI / 8) * r };
        if (this.hooks.walkable(q.x, q.y) && this.npcs.every(n => Math.hypot(n.x - q.x, n.y - q.y) >= 0.9)) { at = q; placed = true; break; }
      }
      // The first person is the seller, busy behind the counter; the others are customers who wander round the stall.
      this.npcs.push({ id: `${s.id}:${p.id}`, look: p.look, x: at.x, y: at.y, dir: 0, speed: 0, bike: false, still: true, waitMs: 0, say: null, quietUntil: 0, home: { ...at, reach: index > 0 ? 1.1 : 0.45 }, idleMs: 800 + this.random() * 4000 });
    });
    for (let i = 0; i < config.walkers; i++) {
      const span = Math.max(1, this.hooks.limitX() - 3), rows = config.lanes.length;
      const x = 1.5 + (Math.floor(i / rows) + (i % rows) * 0.45 + 0.15 + this.random() * 0.35) * span / Math.ceil(config.walkers / rows);
      const n = this.walker(i, x);
      // Spread each sidewalk along the street; search within it rather than pushing a blocked spawn off-map.
      for (let k = 0; k < Math.ceil(span / 0.5); k++) {
        const q = { x: 1.5 + ((x - 1.5 + k * 0.5) % span), y: n.y };
        if (!this.hooks.walkable(q.x, q.y) || Math.hypot(q.x - player.pos.x, q.y - player.pos.y) < 0.9) continue;
        if (this.npcs.some(m => !m.bike && Math.hypot(m.x - q.x, m.y - q.y) < 0.75)) continue;
        if ((config.gates ?? []).some(g => Math.hypot(g.guard.x - q.x, g.guard.y - q.y) < 0.75)) continue;
        if (this.hooks.props().some(o => Math.hypot(o.x - q.x, o.y - q.y) < o.r + 0.3)) continue;
        n.x = q.x;
        this.npcs.push(n);
        break;
      }
    }
    // Bikes start on the part of the road the fence leaves open.
    for (let i = 0; i < config.bikes; i++) this.npcs.push(this.bike(i, this.random() * (this.hooks.limitX() - 2)));
    for (const g of config.gates ?? []) {
      this.gateOpen[g.id] = 0;
      this.npcs.push({ id: `gate:${g.id}`, look: 'guard', x: g.guard.x, y: g.guard.y, dir: g.inward, speed: 0, bike: false, still: true, waitMs: 0, say: null, quietUntil: 0, home: { ...g.guard, reach: 0 }, idleMs: 1500 + this.random() * 3000 });
    }
  }

  private walker(i: number, x: number): Npc {
    const c = this.config, r = this.random;
    // Not all in single file: each walker keeps a row a little off the lane's centre.
    const y = c.lanes[i % c.lanes.length]! + (r() - 0.5) * 0.24;
    // Each look in turn, so a few passers-by are all different people.
    return { id: `walker${i}`, look: c.looks[i % c.looks.length]!, x, y, lane: y, visitAt: 4000 + r() * 12000, dir: Math.floor(i / c.lanes.length) % 2 ? 1 : -1, speed: c.walkSpeed[0] + r() * (c.walkSpeed[1] - c.walkSpeed[0]), bike: false, still: false, waitMs: 0, say: null, quietUntil: 0 };
  }

  private bike(i: number, x: number): Npc {
    const lane = i % this.config.bikeLanes.length;
    // Keep to the right: the north lane drives west, the south lane east.
    return { id: `bike${i}`, look: 'bike', x, y: this.config.bikeLanes[lane]!, dir: lane === 0 ? -1 : 1, speed: this.config.bikeSpeed * (0.85 + this.random() * 0.3), bike: true, still: false, waitMs: 0, say: null, quietUntil: 0 };
  }

  tick(dt: number): void {
    this.ms += dt;
    for (const n of this.npcs) n.moving = false;
    if (this.hooks.phase() === 'chaos') this.chaosMs += dt;
    for (const n of this.npcs) if (n.say && (n.say.ms -= dt) <= 0) n.say = null;
    if (this.heroSay && (this.heroSay.ms -= dt) <= 0) this.heroSay = null;
    for (const n of this.npcs) if (!n.still) {
      const x = n.x, y = n.y;
      this.move(n, dt);
      // By speed, not by distance per tick: a slow walker must not flick between walking and standing frames.
      n.moving = (Math.hypot(n.x - x, n.y - y) * 1000) / Math.max(dt, 1) > 0.2;
      // Facing the way they really go: round someone they turn that way (no walking sideways like a crab);
      // along their row, plainly along it (small wobbles must not flip the pose).
      const mx = n.x - x, my = n.y - y, along = !n.bike && !n.visit && Math.abs(my) < Math.abs(mx) * 0.6;
      if (n.moving) n.facing = (along ? facingFrom(n.dir, 0) : facingFrom(mx, my)) ?? n.facing;
    }
    for (const n of this.npcs) if (n.home && n.still) this.idle(n, dt);
    this.chatter(dt);
    this.greet();
    if (this.pendingTalk) {
      const n = this.npcs.find((m) => m.id === this.pendingTalk!.id);
      if (!n || this.ms > this.pendingTalk.until) this.pendingTalk = null;
      else if (Math.hypot(n.x - this.player.pos.x, n.y - this.player.pos.y) < TALK_REACH) { this.pendingTalk = null; this.talkTo(n.id); }
    }
    this.tickGate(dt);
    this.tickTalk(dt);
    this.tickRescue(dt);
  }


  /**
   * People at the stalls and the barriers are not statues: sellers and guards look round now and then,
   * customers shuffle a step or two about their spot. Talking (or talked to), they face the hero.
   */
  private idle(n: Npc, dt: number): void {
    const p = this.player.pos, h = n.home!;
    if (this.rescue || this.hooks.isDown()) return;
    if (n.say || (this.talk && n.id.startsWith(`${this.talk.stall.id}:`))) {
      n.shuffleTo = undefined;
      if (Math.hypot(p.x - n.x, p.y - n.y) < 4) n.facing = facingFrom(p.x - n.x, p.y - n.y) ?? n.facing;
      return;
    }
    const to = n.shuffleTo;
    if (to) {
      const dx = to.x - n.x, dy = to.y - n.y, d = Math.hypot(dx, dy), step = (0.7 * dt) / 1000;
      const next = d <= step ? to : { x: n.x + (dx / d) * step, y: n.y + (dy / d) * step };
      // Never into the hero or someone else.
      if (!this.canPass(n, next) || !this.hooks.canWalk(n, next)) { n.shuffleTo = undefined; return; }
      n.x = next.x; n.y = next.y;
      n.moving = d > step;
      n.facing = facingFrom(dx, dy) ?? n.facing;
      if (d <= step) n.shuffleTo = undefined;
      return;
    }
    if ((n.idleMs = (n.idleMs ?? 0) - dt) > 0) return;
    n.idleMs = 2200 + this.random() * 4500;
    if (h.reach > 0 && this.random() < 0.7) {
      // Somewhere about their spot (customers wander round the stall, the seller along the counter), never onto the road.
      const a = this.random() * Math.PI * 2, r = h.reach * (0.3 + this.random() * 0.7);
      const to = { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * 0.7 };
      if (!this.onRoad(to.y)) n.shuffleTo = to;
    } else n.facing = IDLE_LOOKS[Math.floor(this.random() * IDLE_LOOKS.length)]!;
  }

  /** Everyone on foot the hero should walk round (not the bikes, not anyone hidden). */
  people(): Array<{ x: number; y: number }> {
    return this.npcs.filter((n) => !n.bike && (n.scale ?? 1) > 0.01);
  }

  /** The hero is up and about (not knocked out): stalls talk, doors are open. */
  private walking(): boolean {
    const ph = this.hooks.phase();
    return ph === 'stroll' || ph === 'chaos';
  }

  /**
   * What the camera looks at during the rescue: once the hero is inside, the ambulance itself; before that
   * the hero, nudged towards the ambulance so both fit on a narrow phone screen (never so far that the hero leaves it).
   */
  private rescueFocus(): { x: number; y: number } | null {
    const r = this.rescue, v = r?.van;
    if (!r || !v) return null;
    if (r.hidden) return { x: v.x, y: v.y };
    const p = this.player.pos, dx = v.x - p.x, dy = v.y - p.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(d / 2, 1.6) / d;
    return { x: p.x + dx * k, y: p.y + dy * k };
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
      const route = this.hooks.rescueRoute(p0);
      if (!route) return;
      this.rescue = { route, ms: 0, dir: route.dir, crowd: [], van: null, medics: [], carried: false, hidden: false, bonkMs: 0, portal: null, bonked: false, done: false, mishap: null };
    }
    const r = this.rescue, prev = r.ms, p = this.player.pos;
    r.ms += dt;
    const medicsReady = r.medics.length === 2 && r.medics.every((m, i) => {
      const spot = m.goal ?? this.carrySpot(p, i);
      return (m.scale ?? 1) > 0.01 && Math.hypot(m.x - spot.x, m.y - spot.y) <= 0.16;
    });
    // Dialogue timing waits for the actual pickup and arrival at the van.
    if (prev < 7200 && r.ms >= 7200 && r.route.approach.length) r.ms = 7199;
    if (prev < 11300 && r.ms >= 11300 && !medicsReady) r.ms = 11299;
    if (prev < 14900 && r.ms >= 14900 && (!r.bonked || !medicsReady)) r.ms = 14899;
    r.bonkMs = Math.max(0, r.bonkMs - dt);
    const at = (ms: number) => prev < ms && r.ms >= ms;
    // Traffic keeps to the right, the ambulance too: heading west it takes the north lane, heading east the south one.
    // A little in from the bike lane: the ambulance is wider than a bike and must not hang over the kerb.
    const lane = r.route.lane;
    // The side of the hero away from the ambulance's lane: the crowd stands there, out of its way.
    const away = p.y >= lane ? 1 : -1;
    // Off the van's lane: whoever stands there steps to the nearer side of the road.
    const offLane = (g: { x: number; y: number }) => (Math.abs(g.y - lane) < 1.3 ? this.freeNear(g.x, lane + (g.y >= lane ? 1.6 : -1.6), true) : g);
    // Onlookers: the nearest passers-by stop what they are doing and stand round the hero.
    if (at(600)) {
      // The lying hero is about a tile long on screen: onlookers stand well clear of them, on the side away from the road's traffic.
      const spots = [[-1.6, 1.6 * away], [-0.3, 1.8 * away], [1.0, 1.7 * away], [2.2, 1.5 * away]] as const;
      const near = this.npcs.filter((n) => !n.still && !n.bike && n.x > 1.5 && n.x < this.size.w - 1.5).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, spots.length);
      // Each onlooker stands on free ground near their spot (never inside a stall, a tree or a car).
      near.forEach((n, i) => { n.visit = undefined; n.still = true; n.goal = offLane(this.spotAround(p, spots[i]![0], spots[i]![1])); });
      r.crowd = near;
    }
    const say = (n: Npc | undefined, text: string, ms = 2200) => { if (n) n.say = { text, ms }; };
    if (at(1500)) say(r.crowd[0], L.crowd[0] ?? '');
    if (at(2700)) say(r.crowd[1], L.crowd[1] ?? '');
    if (at(3900)) say(r.crowd[2], L.crowd[2] ?? '');
    if (at(2200)) {
      const entry = r.route.approach.shift()!;
      r.van = this.vehicle('ambulance', 'ambulance', entry.x, entry.y, r.dir, 11, L.siren);
      r.route.approach.unshift(entry);
      // The siren parts the crowd: people in the van's way step aside to both sides of the road.
      for (const n of r.crowd) if (n.goal) n.goal = offLane(n.goal);
    }
    if (at(4800)) say(r.crowd[3] ?? r.crowd[0], L.xeom);
    if (at(5800)) say(r.van ?? undefined, L.driver, 1600);
    if (at(6600)) say(r.crowd[0], L.crowd[3] ?? '');
    // The van pulls up short of the hero (never over them), then (later) drives off.
    const v = r.van;
    // Its side door, on the hero's side: the hero is carried up beside the van, never on top of it.
    const door = v ? r.route.door : null;
    if (v && !r.hidden) {
      // Flat out down the street, braking into each turn and to a stop by the hero.
      const next = r.route.approach[0];
      if (next) v.speed = Math.min(11, 2.2 + Math.hypot(next.x - v.x, next.y - v.y) * 2.4);
      this.drive(v, r.route.approach, dt);
    }
    // The medics jump out, take the hero by both ends, and carry them to the back door.
    // One after the other out of the side door (never two figures on the same spot, looking like one).
    if (at(7200) && door) {
      r.medics = [0, 1].map((i) => { const n = this.vehicle(`medic${i}`, 'medic', door.x, door.y, -r.dir, 0, ''); n.bike = false; n.say = null; if (i === 0) n.goal = this.carrySpot(p, 0); else n.scale = 0; return n; });
    }
    if (r.ms >= 7800 && r.medics[1]?.scale === 0 && door) {
      // Out of the door a little along the van if the first medic is still standing by it.
      const m = r.medics[1], first = r.medics[0]!;
      const out = [0, -0.6, 0.6].map((offset) => r.route.park.y === lane
        ? { x: door.x + offset * r.dir, y: door.y }
        : { x: door.x, y: door.y + offset }).find((q) => this.clearOfVan(q, r)
          && this.hooks.canWalk(door, q) && Math.hypot(q.x - first.x, q.y - first.y) >= MEDIC_GAP);
      // Keep waiting inside the van if the first medic has not cleared the door yet.
      if (out) { m.x = out.x; m.y = out.y; m.scale = 1; m.goal = this.carrySpot(p, 1); }
    }
    // "Make way!": the crowd is pushed back a step or two; the one filming gets told off (and answers back).
    if (at(7500)) {
      say(r.medics[0], L.shoo, 1300);
      for (const n of r.crowd) {
        const ax = n.x - p.x, ay = n.y - p.y, d = Math.hypot(ax, ay) || 1;
        n.goal = offLane(this.spotAround(p, (ax / d) * 2.4, (ay / d) * 2.4));
      }
    }
    // One line at a time from here, so the bubbles never pile up over the hero.
    if (at(8900)) say(r.medics[1], L.scold, 1300);
    if (at(9700)) say(r.crowd[1], L.filmer, 1400);
    // …and the stretcher? Left at home. Two pairs of hands will do.
    if (at(10500)) say(r.medics[0], L.noStretcher, 1300);
    if (at(11300)) { say(r.medics[1], L.handCarry, 1600); r.carried = true; }
    // Everyone gets their phone out: flashes, and where it is going to be posted.
    const snap = (i: number, t: number) => { const n = r.crowd[i % Math.max(1, r.crowd.length)]; if (at(t) && n) { n.photoMs = 700; if (i < L.photo.length) say(n, L.photo[i]!, 1100); } };
    // All while the hero is carried (before the "CỐP!" skips ahead to the doors shutting).
    snap(2, 12000); snap(0, 12500); snap(3, 13000); snap(1, 13500);
    for (const n of r.crowd) if (n.photoMs) n.photoMs = Math.max(0, n.photoMs - dt);
    if (r.carried && !r.hidden && door && r.ms > 11500) {
      // Carried round anything in the way, not through it.
      // At the door; the "CỐP!" waits for the last photo to be taken.
      // Lifted off a spot hard against a wall (a courtyard corner): carried from the free ground beside it.
      if (!this.hooks.walkable(p.x, p.y)) { const q = this.freeNear(p.x, p.y); p.x = q.x; p.y = q.y; }
      const together = r.medics.every((m, i) => {
        const spot = this.carrySpot(p, i);
        return (m.scale ?? 1) > 0.01 && Math.hypot(m.x - spot.x, m.y - spot.y) <= 0.5;
      });
      if (together && this.stepToward(p, door, 2.2, dt, this.vanBody(r)) && !r.bonked && r.ms >= 13900) {
        // Head, meet door.
        r.bonked = true;
        r.bonkMs = 900;
        // In the van as soon as the "CỐP!" has sounded.
        r.ms = Math.max(r.ms, 14000);
      }
      r.medics.forEach((m, i) => { if ((m.scale ?? 1) > 0) m.goal = this.carrySpot(p, i); });
    }
    // Everyone in, doors shut, off it goes… and a magic circle opens on the road ahead.
    if (at(14900) && v) {
      r.hidden = true;
      r.carried = false;
      for (const m of r.medics) this.npcs.splice(this.npcs.indexOf(m), 1);
      r.medics = [];
      // The driver sums it up as they pull away.
      v.say = { text: L.oops, ms: 2200 };
      // The circle opens on the road ahead, inside the street where there is room for it, never on a barrier.
      const road = r.route.exit[r.route.exit.length - 1] ?? v;
      let px = Math.max(3, Math.min(this.size.w - 3, road.x + r.dir * 6));
      if ((px - road.x) * r.dir < 4.5) px = road.x + r.dir * 4.5;
      for (const g of this.config.gates ?? []) if (Math.abs(px - g.x) < 2) px = g.x - r.dir * 2;
      r.portal = { x: px, y: road.y, ms: 0 };
      v.speed = 0;
      // Sometimes it never gets there in one piece.
      if (this.random() < (L.wheelOffChance ?? 0)) r.mishap = { wheel: null, boom: null };
    }
    if (r.portal && v) {
      r.portal.ms += dt;
      const into = (v.x - r.portal.x) * r.dir;
      const m = r.mishap;
      // The circle opens first (the driver stares at it), then the van floors it.
      const rev = r.portal.ms - PORTAL_OPEN_MS;
      v.speed = rev < 0 ? 0 : Math.min(9, 1.5 + rev / 1000 * 9);
      if (rev < 0) v.moving = false;
      else if (r.route.exit.length) this.drive(v, r.route.exit, dt);
      else if (m) { v.axis = 'x'; v.dir = r.dir; this.tickMishap(r, v, m, into, dt); }
      else {
        v.axis = 'x'; v.dir = r.dir;
        if (into < -0.6) v.x += (r.dir * v.speed * dt) / 1000;
        else {
          // Caught by the whirl: slowed, spun round and shrunk into the middle.
          v.x += (r.portal.x - v.x) * Math.min(1, dt / 180);
          v.scale = Math.max(0, (v.scale ?? 1) - dt / 900);
          const k = 1 - (v.scale ?? 0);
          v.tilt = r.dir * k * k * Math.PI * 4;
        }
        if ((v.scale ?? 1) <= 0 && !r.done) {
          r.done = true;
          this.hooks.rescued();
        }
      }
    }
    // The guard raises the boom for the ambulance too.
    if (v) for (const g of this.gates()) if (Math.abs(g.x - v.x) < 3.5) this.gateHold[g.id] = this.ms + 500;
    // Onlookers and medics walk to their spots.
    for (const n of [...r.crowd, ...r.medics]) {
      if (!n.goal) continue;
      const x0 = n.x, y0 = n.y;
      const park = r.route.park, vertical = park.y !== lane;
      const rx = vertical ? 0.9 : 1.6, ry = vertical ? 1.6 : 0.9;
      const x = Math.floor(park.x - rx), y = Math.floor(park.y - ry);
      // The crowd keeps well clear of the van; the medics walk round its body (never through it) to and from the door.
      const avoid = r.crowd.includes(n) ? { x, y, w: Math.ceil(park.x + rx) - x, h: Math.ceil(park.y + ry) - y } : this.vanBody(r);
      const speed = r.carried && r.medics.includes(n) ? 2.6 : 2.2;
      if (this.stepToward(n, n.goal, speed, dt, avoid)) n.goal = undefined;
      n.moving = Math.hypot(n.x - x0, n.y - y0) > 0.005;
      if (n.moving) n.facing = facingFrom(n.x - x0, n.y - y0) ?? n.facing;
      if (Math.abs(n.x - x0) > 0.005) n.dir = n.x > x0 ? 1 : -1;
    }
    // Two medics crossing paths: the second steps out of the first one's way (never one figure on the other).
    const [m0, m1] = r.medics;
    if (m0 && m1 && (m1.scale ?? 1) > 0) {
      const dx = m1.x - m0.x, dy = m1.y - m0.y, d = Math.hypot(dx, dy);
      if (d < MEDIC_GAP) {
        const ux = d > 1e-3 ? dx / d : -r.dir, uy = d > 1e-3 ? dy / d : 0, push = MEDIC_GAP - d;
        const to = { x: m1.x + ux * push, y: m1.y + uy * push };
        if (this.clearOfVan(to, r) && this.hooks.canWalk(m1, to)) { m1.x = to.x; m1.y = to.y; this.paths.delete(m1); }
      }
    }
  }

  /** The tiles under the parked ambulance's body (not its door side): what the medics walk round. */
  private vanBody(r: NonNullable<StreetService['rescue']>): Footprint | undefined {
    if (!r.van || r.hidden) return undefined;
    return vanBody(r.route.park, r.route.park.y !== r.route.lane);
  }

  private clearOfVan(q: WorldPos, r: NonNullable<StreetService['rescue']>): boolean {
    const body = this.vanBody(r);
    return this.hooks.walkable(q.x, q.y)
      && (!body || q.x + .25 <= body.x || q.x - .25 >= body.x + body.w || q.y + .25 <= body.y || q.y - .25 >= body.y + body.h);
  }

  /** The fixed lying pose points left on screen: support its head and feet, with room for each medic. */
  private carrySpot(p: WorldPos, index: number): WorldPos {
    // Free ground the medic can stand on: never touching the parked van's body (they could not get there).
    const r = this.rescue, body = r ? this.vanBody(r) : undefined;
    const clear = (q: WorldPos, i: number) => {
      if (!(r ? this.clearOfVan(q, r) : this.hooks.walkable(q.x, q.y)) || this.hooks.props().some(o => Math.hypot(q.x - o.x, q.y - o.y) < o.r + .26)) return false;
      const from = r?.medics[i] ?? r?.route.door;
      // A free tile across a wall is not a reachable place to hold the patient.
      return !from || !!this.hooks.path(from, q, body);
    };
    const near = (x: number, y: number, ok: (q: WorldPos) => boolean) => {
      for (let r = 0; r <= 1.75; r += 0.25) for (let a = 0; a < 12; a++) {
        const q = { x: x + Math.cos((a * Math.PI) / 6) * r, y: y + Math.sin((a * Math.PI) / 6) * r };
        if (ok(q)) return q;
        if (r === 0) break;
      }
      return { x, y };
    };
    // Within arm's reach of the hero if at all possible, further out only when there is no room.
    const reach = (q: WorldPos) => Math.hypot(q.x - p.x, q.y - p.y) <= 1;
    const pick = (x: number, y: number, ok: (q: WorldPos) => boolean) => { const q = near(x, y, (q) => ok(q) && reach(q)); return ok(q) ? q : near(x, y, ok); };
    const first = pick(p.x - .3, p.y + .8, q => clear(q, 0));
    if (!index) return first;
    // The second medic never stands on the first one's spot (two figures as one): the nearest spot a body's width away.
    return pick(p.x + .55, p.y, (q) => clear(q, 1) && Math.hypot(q.x - first.x, q.y - first.y) >= MEDIC_GAP);
  }

  /**
   * The ambulance on its way to the circle loses a wheel: the wheel rolls on
   * ahead by itself, the van lurches on three wheels, grinds to a halt… BÙM.
   * The circle takes what is left, and the story moves on all the same.
   */
  private tickMishap(r: NonNullable<StreetService['rescue']>, v: Npc, m: NonNullable<NonNullable<StreetService['rescue']>['mishap']>, into: number, dt: number): void {
    const L = this.config.rescue!, s = dt / 1000;
    if (m.boom) {
      m.boom.ms += dt;
      if (m.boom.ms > 1500 && !r.done) {
        r.done = true;
        this.hooks.rescued();
      }
      return;
    }
    if (!m.wheel) {
      v.x += r.dir * 6 * s;
      // Halfway there, off it comes.
      if (into > -3.4) {
        m.wheel = { x: v.x - r.dir * 0.6, y: v.y + 0.35, vx: r.dir * 6.5, ms: 0, spin: 0 };
        v.say = { text: L.wheelOff, ms: 1500 };
      }
      return;
    }
    const w = m.wheel;
    w.ms += dt;
    w.x += w.vx * s;
    w.vx *= 0.985;
    w.spin += w.vx * s * 3;
    // Three wheels: leaning over, crawling, scraping along.
    v.tilt = r.dir * 0.22 + Math.sin(w.ms / 60) * 0.04;
    v.x += r.dir * Math.max(0, 2.4 - w.ms / 500) * s;
    if (w.ms > 1200) {
      m.boom = { x: v.x, y: v.y, ms: 0 };
      m.wheel = null;
      v.scale = 0;
      v.say = null;
    }
  }

  /** Cached routes carry walkers around walls and props, including narrow alley corners. */
  private readonly paths = new WeakMap<WorldPos, { goal: WorldPos; points: WorldPos[] }>();

  private stepToward(n: WorldPos, goal: WorldPos, speed: number, dt: number, avoid?: Footprint, yieldFor?: (to: WorldPos) => boolean): boolean {
    if (Math.hypot(n.x - goal.x, n.y - goal.y) < 0.01) return true;
    let path = this.paths.get(n);
    if (!path || Math.hypot(path.goal.x - goal.x, path.goal.y - goal.y) > 0.05) {
      const points = this.hooks.path(n, goal, avoid);
      if (!points) return false;
      path = { goal: { ...goal }, points };
      this.paths.set(n, path);
    }
    const before = { x: n.x, y: n.y };
    this.walkPath(n, path.points, speed * dt / 1000, undefined, (from, to) => this.hooks.canWalk(from, to), yieldFor ?? (this.npcs.includes(n as Npc) ? to => this.canPass(n as Npc, to) : undefined));
    if (Math.hypot(n.x - before.x, n.y - before.y) < .001 && this.npcs.includes(n as Npc)) {
      const npc = n as Npc, target = path.points[0] ?? goal;
      const dx = target.x - n.x, dy = target.y - n.y, len = Math.hypot(dx, dy) || 1;
      const step = Math.min(.08, speed * dt / 1000);
      for (const side of [npc.dodge ?? 1, -(npc.dodge ?? 1)]) {
        const to = { x: n.x - dy / len * step * side, y: n.y + dx / len * step * side };
        if (!this.canPass(npc, to) || !this.hooks.canWalk(n, to)) continue;
        npc.dodge = side; n.x = to.x; n.y = to.y; this.paths.delete(n); break;
      }
    }
    if (path.points.length === 0 && Math.hypot(n.x - goal.x, n.y - goal.y) > 0.05) this.paths.delete(n);
    return Math.hypot(n.x - goal.x, n.y - goal.y) <= 0.05;
  }

  private walkPath(n: WorldPos, points: WorldPos[], distance: number, turn?: (dx: number, dy: number) => void, allowed?: (from: WorldPos, to: WorldPos) => boolean, yieldFor?: (to: WorldPos) => boolean): void {
    while (distance > 0 && points.length) {
      const to = points[0]!, dx = to.x - n.x, dy = to.y - n.y, d = Math.hypot(dx, dy);
      if (d < 0.001) { points.shift(); continue; }
      turn?.(dx, dy);
      const step = Math.min(d, distance);
      const toStep = { x: n.x + dx / d * step, y: n.y + dy / d * step };
      if (allowed && !allowed(n, toStep)) { points.length = 0; return; }
      // A person can move away: keep the route while waiting instead of planning it again every frame.
      if (yieldFor && !yieldFor(toStep)) return;
      n.x = toStep.x; n.y = toStep.y;
      distance -= step;
      if (step === d) points.shift();
    }
  }

  private drive(v: Npc, points: WorldPos[], dt: number): void {
    const x = v.x, y = v.y;
    this.walkPath(v, points, v.speed * dt / 1000, (dx, dy) => {
      v.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
      v.dir = Math.sign(v.axis === 'y' ? dy : dx);
    });
    v.moving = Math.hypot(v.x - x, v.y - y) > 0.001;
  }

  // ── street ends ─────────────────────────────────────────────────────────

  /**
   * The street ends: a boom across the road for vehicles, nothing for people on
   * foot. Passers-by stroll past it without a thought. The hero tries the same
   * and gets flattened: either a motorbike comes through just then, or the
   * guard kindly raises the boom for them… and lets it slip.
   */
  private tickGate(dt: number): void {
    const r0 = this.gateRun;
    this.gateBonkMs = Math.max(0, this.gateBonkMs - dt);
    for (const id in this.gateOpen) {
      const mine = r0?.gate.id === id;
      const held = mine && r0.arrived !== null ? r0.ms - r0.arrived : 0;
      const slamming = mine && r0.how === 'slam' && r0.arrived !== null && r0.stage === 'walk';
      // Raised for the hero, held a moment… and down it comes, whatever is waiting behind it.
      const want = slamming ? held < 1100
        : (mine && r0.how === 'bike' && !!r0.bike && (r0.stage === 'walk' || r0.ms < 1500)) || this.ms < (this.gateHold[id] ?? 0);
      const speed = slamming && held >= 1100 ? 140 : 400;
      this.gateOpen[id] = Math.max(0, Math.min(1, this.gateOpen[id]! + (want ? dt : -dt) / speed));
    }
    const p = this.player.pos, L = this.config.gateLines;
    // Rush hour took the checkpoint down: its guard goes too.
    for (const g of this.config.gates ?? []) {
      const up = this.gates().includes(g), guard = this.npcs.find((n) => n.id === `gate:${g.id}`);
      if (guard) guard.scale = up ? 1 : 0;
    }
    if (r0 && !this.gates().includes(r0.gate) && r0.stage === 'walk') return this.endGate();
    const lanes = this.config.bikeLanes;
    const roadY = (lanes[0]! + lanes[lanes.length - 1]!) / 2;
    if (!r0) {
      for (const g of this.config.gates ?? []) {
        if (Math.hypot(p.x - g.x, p.y - roadY) > 4 && Math.hypot(p.x - g.guard.x, p.y - g.guard.y) > 4) this.gateNeedsExit.delete(g.id);
      }
      if (this.talk || !L || !this.walking() || this.hooks.knockedOut()) return;
      // Only when the hero really tries to get past the street end (the road or either sidewalk).
      // A stall talk close by comes first (the iced tea stall stands next to the west guard).
      const stallNear = this.stalls.some((st) => !this.hooks.isVisited(st.id) && Math.hypot(p.x - this.centre(st).x, p.y - this.centre(st).y) <= this.config.talkRadius);
      const g = stallNear ? undefined : this.gates().find((g) => !this.gateNeedsExit.has(g.id) && this.ms >= (this.gateQuietUntil[g.id] ?? 0) && Math.abs(p.x - g.x) < GATE_REACH && p.y > lanes[0]! - 4 && p.y < this.size.h - 1);
      if (g) this.startGate(g);
      return;
    }
    const r = r0, g = r.gate, prev = r.ms;
    r.ms += dt;
    const at = (ms: number) => prev < ms && r.ms >= ms;
    const guard = this.npcs.find((n) => n.id === `gate:${g.id}`)!;
    const ride = (n: Npc) => { n.x += (n.dir * n.speed * dt) / 1000; n.moving = true; n.facing = n.dir < 0 ? 'W' : 'E'; };
    // Knocked out by something else on the way (a gag): the scene stops leading the hero about (the rescue takes over).
    if (this.hooks.knockedOut() && r.stage !== 'crash') return this.endGate();
    if (r.stage === 'walk') {
      // Right where the hero tried to get through: they stop (no walking them anywhere), the street does the rest.
      if (prev === 0) {
        this.heroSay = { text: L!.hero, ms: 2000 };
        this.hooks.hold(true);
        r.arrived = 0;
        this.player.faceTowards({ x: g.x - g.inward, y: p.y });
        if (r.how === 'slam') guard.say = { text: L!.lift, ms: 1600 };
        // …just as a motorbike comes through from outside (up on the sidewalk too, as they do).
        else r.bike = this.vehicle(`crashbike:${g.id}:${++this.nextGateBike}`, 'bike', g.x - g.inward * 9, p.y, g.inward, 9, this.config.honk[0] ?? 'Bíp bíp!');
      }
      if (at(700) && r.how === 'bike') guard.say = { text: L!.guard, ms: 1600 };
      const ko = (line: string, push: number, kind?: HazardKind) => {
        // Lands on free ground: never inside a street tree, a stall or a parked car (the rescue could not reach them there).
        r.landing = { from: { ...p }, to: this.freeNear(Math.max(2, Math.min(this.size.w - 2, g.x + g.inward * push)), p.y) };
        this.hooks.crash(line, 8000, kind);
        r.stage = 'crash';
        r.ms = 0;
      };
      if (r.how === 'slam') {
        if (r.ms > 1100 && this.gateOpen[g.id]! < 0.25) {
          guard.say = { text: L!.slam, ms: 2000 };
          this.gateBonkMs = 900;
          ko(L!.slamFaint, 3.8, 'barrier');
        }
        return;
      }
      const b = r.bike;
      const onRoad = Math.abs(p.y - roadY) < 1.6;
      if (b && (!onRoad || this.gateOpen[g.id]! >= 0.6 || (g.x - b.x) * g.inward > 1.2)) ride(b);
      if (b && Math.abs(b.x - p.x) < 0.7) {
        b.say = { text: onRoad ? L!.rider : L!.kerb, ms: 2200 };
        ko(L!.faint, 4);
      }
      return;
    }
    // Crash: the hero flies (or staggers) a few steps into the street and lies there.
    if (r.landing) {
      const k = 1 - (1 - Math.min(1, r.ms / 900)) ** 2;
      p.x = r.landing.from.x + (r.landing.to.x - r.landing.from.x) * k;
      p.y = r.landing.from.y + (r.landing.to.y - r.landing.from.y) * k;
      if (k === 1) r.landing = null;
    }
    // The bike rides off; the guard has the last word (the rescue does the rest).
    if (r.bike) { ride(r.bike); if (r.ms > 1800) { r.bike.still = false; r.bike = null; } }
    if (at(3300)) guard.say = { text: r.how === 'slam' ? L!.slamScold : L!.scold, ms: 2400 };
  }

  /** The barriers standing now: both street ends, plus the mid-street checkpoint while the stroll lasts. */
  private gates(): GateConfig[] {
    const fenced = this.hooks.limitX() < this.size.w - 1;
    return (this.config.gates ?? []).filter((g) => !g.stroll || fenced);
  }

  private startGate(g: GateConfig): void {
    this.gateNeedsExit.add(g.id);
    const lanes = this.config.bikeLanes, roadY = (lanes[0]! + lanes[lanes.length - 1]!) / 2;
    const underBoom = Math.abs(this.player.pos.y - roadY) < 1.6;
    this.gateRun = { gate: g, stage: 'walk', ms: 0, how: underBoom && this.random() < 0.5 ? 'slam' : 'bike', arrived: null, bike: null, landing: null };
  }

  /**
   * The player tapped someone. A stall person starts their stall's talk (or a
   * short line if it was heard), the guard starts the barrier scene, a passer-by
   * says something. Too far away: false (the hero walks over first, see `walkTo`).
   */
  talkTo(id: string): boolean {
    const n = this.npcs.find((m) => m.id === id);
    if (!n || this.hooks.isDown()) return false;
    const p = this.player.pos;
    if (Math.hypot(n.x - p.x, n.y - p.y) > TALK_REACH) return false;
    if (id.startsWith('gate:')) {
      if (!this.gateRun && this.config.gateLines) n.say = { text: this.config.gateLines.guard, ms: 2200 };
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
    if (this.rescue) return;
    if (this.ms < this.greetQuietUntil || this.talk || this.gateRun || this.hooks.isDown()) return;
    const p = this.player.pos;
    const n = this.npcs.find((m) => !m.still && !m.bike && !m.say && this.ms >= m.quietUntil && Math.hypot(m.x - p.x, m.y - p.y) < 1.3);
    const lines = n && this.config.chatter[n.look];
    if (!n || !lines?.length) return;
    n.say = { text: this.pick(lines), ms: 2600 };
    n.quietUntil = this.ms + 12000;
    this.greetQuietUntil = this.ms + 2500;
  }

  /** Free ground at the offset from `c`, but never closer than MIN_CROWD_GAP to it (pushed further out if need be). */
  private spotAround(c: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
    let best = this.freeNear(c.x + dx, c.y + dy, true);
    for (const k of [1.25, 1.5, 1.8]) {
      if (Math.hypot(best.x - c.x, best.y - c.y) >= MIN_CROWD_GAP) break;
      best = this.freeNear(c.x + dx * k, c.y + dy * k, true);
    }
    return best;
  }

  /** The nearest free ground to a point (searching outwards a little), or the point itself. */
  private freeNear(x: number, y: number, personalSpace = false): { x: number; y: number } {
    for (let r = 0; r <= (personalSpace ? 3 : 1.5); r += 0.5) for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a * Math.PI) / 4) * r, py = y + Math.sin((a * Math.PI) / 4) * r;
      if (this.hooks.walkable(px, py) && this.hooks.props().every(o => Math.hypot(px - o.x, py - o.y) >= o.r + .26) && (!personalSpace || this.npcs.every(n => n.bike || (Math.hypot(px - n.x, py - n.y) >= .75 && (!n.goal || Math.hypot(px - n.goal.x, py - n.goal.y) >= .85))))) return { x: px, y: py };
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
    if (r.bike) r.bike.still = false;
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
    // Nobody walks through the hero lying on the street: passers-by turn back a little before.
    if (!n.bike && this.hooks.isDown() && Math.abs(p.y - n.y) < 1.2 && (p.x - n.x) * n.dir > 0 && (p.x - n.x) * n.dir < 1.7) n.dir = -n.dir;
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
      // The hero (standing or lying) in the way: bikes stop and honk (walkers step round, see `giveWay`).
      if (n.bike && ahead > 0 && ahead < 1.8 && across < 0.7) this.blocked(n, this.config.honk);
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
    if (n.turn) return this.goRound(n, pace * dt);
    if (!n.bike) {
      if (this.visitStall(n, dt)) return;
      pace *= this.giveWay(n, dt);
      const x = n.x + (n.dir * n.speed * pace * dt) / 1000;
      // Never through a stall, a car or a tree (giveWay steps round them; this is the last guard).
      if (!this.footing(x, n.y)) { n.dir = -n.dir; n.dodge = undefined; return; }
      if (Math.abs(x - n.x) < 1e-5 || !this.canPass(n, { x, y: n.y })) {
        n.blockedMs = (n.blockedMs ?? 0) + dt;
        if (n.blockedMs > 1800) { n.dir = -n.dir; n.dodge = undefined; n.blockedMs = 0; }
        return;
      }
      n.blockedMs = 0;
      n.x = x;
    } else n.x += (n.dir * n.speed * pace * dt) / 1000;
    if (n.bike) {
      // At the end of the street the bike rides round the block of houses and comes back in the other lane.
      const xin = n.dir < 0 ? LOOP.inW : this.size.w + LOOP.inE;
      if ((n.dir < 0 && n.x <= xin) || (n.dir > 0 && n.x >= xin)) {
        // While the hero is being taken away, bikes leaving the street do not come back (the road is jammed).
        if (this.hooks.isDown()) {
          if (n.x < LOOP.farW - 2 || n.x > this.size.w + LOOP.farE + 2) { n.speed = 0; n.scale = 0; }
          return;
        }
        n.x = xin;
        const lanes = this.config.bikeLanes, mid = (lanes[0]! + lanes[lanes.length - 1]!) / 2;
        const near = n.y < mid ? mid - LOOP.margin : mid + LOOP.margin, far = 2 * mid - near, back = 2 * mid - n.y;
        const xfar = n.dir < 0 ? LOOP.farW : this.size.w + LOOP.farE;
        n.turn = { path: [[xin, n.y], [xin, near], [xfar, near], [xfar, far], [xin, far], [xin, back]], i: 0, at: 0 };
      }
      return;
    }
    // Walkers stroll right past the barriers (they are for vehicles) and turn round a little beyond; the fence, while it stands, turns them back.
    const fenced = this.hooks.limitX() < this.size.w - 1;
    const lo = -2.5, hi = fenced ? this.hooks.limitX() - 0.6 : this.size.w + 2.5;
    if (n.x < lo) { n.x = lo; n.dir = 1; }
    else if (n.x > hi) { n.x = hi; n.dir = -1; }
  }

  /** Inside the road (where only vehicles go), with a little margin for a body. */
  private onRoad(y: number): boolean {
    const lanes = this.config.bikeLanes;
    return y > lanes[0]! - 0.75 && y < lanes[lanes.length - 1]! + 0.75;
  }

  /**
   * Passers-by drop in at a stall on their way: they walk over to a free spot
   * by it, look at it a few seconds (and sometimes say something), then walk
   * back to their row and on. True while a visit leads the walker.
   */
  private visitStall(n: Npc, dt: number): boolean {
    if (!n.visit) {
      if (this.ms < (n.visitAt ?? 0) || this.rescue || this.hooks.isDown() || n.x < 2 || n.x > this.size.w - 2) return false;
      n.visitAt = this.ms + 1200;
      if (this.npcs.filter(m => !!m.visit).length >= Math.max(1, Math.floor(this.config.walkers / 4))) return false;
      const st = this.stalls.find((s) => { const c = this.centre(s), ahead = (c.x - n.x) * n.dir; return ahead > 0.8 && ahead < 3.5 && Math.abs(c.y - n.y) < 3.2 && !this.npcs.some(m => m.visit?.stall === s); });
      if (!st || this.random() > 0.5) return false;
      const spot = this.stallSpot(st);
      if (!spot) return false;
      const path = this.hooks.path(n, spot);
      if (!path || path.some(q => this.onRoad(q.y))) return false;
      this.paths.set(n, { goal: { ...spot }, points: path });
      n.visit = { stall: st, spot, back: { x: n.x, y: n.y }, dir: n.dir, phase: 'go', ms: 0, stay: 2500 + this.random() * 3000 };
      n.visitAt = this.ms + 18000 + this.random() * 22000;
      n.dodge = undefined;
    }
    const v = n.visit;
    if ((this.rescue || this.hooks.isDown()) && v.phase !== 'back') { v.phase = 'back'; v.ms = 0; }
    v.ms += dt;
    if (v.phase === 'stay') {
      const c = this.centre(v.stall);
      n.facing = facingFrom(c.x - n.x, c.y - n.y) ?? n.facing;
      if (v.ms > 900 && v.ms - dt <= 900 && this.random() < 0.4 && !n.say) n.say = { text: this.pick(this.config.chatter[n.look] ?? this.config.bumped), ms: 2400 };
      if (v.ms >= v.stay) { v.phase = 'back'; v.ms = 0; }
      return true;
    }
    const goal = v.phase === 'go' ? v.spot : v.back;
    const avoid = this.rescue ? this.vanBody(this.rescue) : undefined;
    const arrived = this.stepToward(n, goal, n.speed, dt, avoid, to => this.canPass(n, to));
    if (Math.abs(goal.x - n.x) > 0.01) n.dir = goal.x > n.x ? 1 : -1;
    if (arrived) {
      if (v.phase === 'go') { v.phase = 'stay'; v.ms = 0; }
      else { n.visit = undefined; n.dir = v.dir; }
    } else if (v.ms > 9000) {
      // Keep the original sidewalk lane; a blocked visit must not turn the shop doorway into a new lane.
      if (v.phase === 'go') { v.phase = 'back'; v.ms = 0; }
      else { n.visit = undefined; n.dir = v.dir; }
    }
    return true;
  }

  /** A free spot by a stall for a passer-by to stand at: on its front side, off the road, nobody there or headed there. */
  private stallSpot(st: StallConfig): WorldPos | null {
    const c = this.centre(st), spots: WorldPos[] = [];
    for (let i = 0; i < 12; i++) for (const r of [1.3, 1.8]) {
      const a = (i / 12) * Math.PI * 2, q = { x: c.x + Math.cos(a) * r * 1.2, y: c.y + Math.sin(a) * r * 0.8 };
      if (this.onRoad(q.y) || !this.hooks.walkable(q.x, q.y)) continue;
      if (Math.hypot(q.x - this.player.pos.x, q.y - this.player.pos.y) < 0.8) continue;
      if (this.npcs.some((m) => !m.bike && (Math.hypot(m.x - q.x, m.y - q.y) < 0.7 || (m.visit && Math.hypot(m.visit.spot.x - q.x, m.visit.spot.y - q.y) < 0.7)))) continue;
      spots.push(q);
    }
    return spots.length ? spots[Math.floor(this.random() * spots.length)]! : null;
  }

  /**
   * A walker meeting someone (the hero, another walker, a seller, the guard):
   * they step aside and pass, keeping off the road, instead of walking through
   * them or freezing face to face. Then back to their own row. The pace to keep.
   */
  private giveWay(n: Npc, dt: number): number {
    const p = this.player.pos, s = dt / 1000, lane = n.lane ?? n.y;
    let block: { x: number; y: number; hero: boolean } | null = null, best = Infinity;
    const consider = (x: number, y: number, hero: boolean) => {
      const ahead = (x - n.x) * n.dir;
      if (ahead > 0.05 && ahead < 1.3 && Math.abs(y - n.y) < 0.6 && ahead < best) { best = ahead; block = { x, y, hero }; }
    };
    if (!this.rescue?.hidden) consider(p.x, p.y, true);
    for (const m of this.npcs) if (m !== n && !m.bike && (m.scale ?? 1) > 0.01) consider(m.x, m.y, false);
    for (const o of this.hooks.props()) consider(o.x, o.y, false);
    // Something solid ahead (a stall, a parked car, a tree) is stepped round like a person.
    let wall = false;
    for (const d of [0.4, 0.8]) if (d < best && !this.footing(n.x + n.dir * d, n.y)) { best = d; block = { x: n.x + n.dir * d, y: n.y, hero: false }; wall = true; break; }
    const b = block as { x: number; y: number; hero: boolean } | null;
    if (!b) {
      // Back to their own row only once nobody is close: stepping back beside the one just passed would
      // block them again, and the walker would dodge out and in every frame.
      const close = (x: number, y: number) => Math.abs(x - n.x) < 1.3 && Math.abs(y - n.y) < 1;
      const crowded = (!this.rescue?.hidden && close(p.x, p.y)) || this.npcs.some((m) => m !== n && !m.bike && (m.scale ?? 1) > 0.01 && close(m.x, m.y));
      const back = lane - n.y, y = n.y + Math.sign(back) * Math.min(Math.abs(back), 0.8 * s);
      n.stuckMs = 0;
      if (!crowded && !this.onRoad(y) && this.canPass(n, { x: n.x, y })) { n.dodge = undefined; n.y = y; }
      return 1;
    }
    // Away from them; head to head, each keeps to their own right. Once chosen, the side holds until they
    // have passed (picking afresh every frame flips it as soon as they draw level, and the walker jitters).
    const lanes = this.config.bikeLanes, roadTop = lanes[0]! - 0.5, roadBottom = lanes[lanes.length - 1]! + 0.5;
    const free = (y: number) => Math.abs(y - lane) < 1.1 && (y < roadTop - 0.25 || y > roadBottom + 0.25 || (n.y > roadTop && n.y < roadBottom)) && this.canPass(n, { x: n.x, y });
    // Round something solid: towards the side with room past it (a stool by the shop row is passed on the street side).
    if (n.dodge === undefined && wall) {
      const room = (k: number) => [0.3, 0.6, 0.9].some((dy) => free(n.y + k * dy) && this.footing(n.x + n.dir * 0.9, n.y + k * dy));
      n.dodge = room(n.dir) ? n.dir : room(-n.dir) ? -n.dir : n.dir;
    }
    n.dodge ??= Math.abs(b.y - n.y) > 0.05 ? Math.sign(n.y - b.y) : n.dir;
    const step = n.dodge * 1.1 * s;
    let stepped = true;
    if (free(n.y + step)) n.y += step;
    // That side is a wall or the road: the other side, for good.
    else if (free(n.y - step)) { n.dodge = -n.dodge; n.y -= step; }
    else stepped = false;
    if (!stepped) {
      // No way round: turn back instead of eventually walking through whoever blocks the lane.
      if (wall) { n.dir = -n.dir; n.dodge = undefined; return 0; }
      if ((n.stuckMs = (n.stuckMs ?? 0) + dt) > 1500) { n.dir = -n.dir; n.dodge = undefined; n.stuckMs = 0; return 0; }
    }
    if (b.hero && best < BUMP_AT && !this.hooks.isDown() && this.ms >= n.quietUntil && !n.say) {
      n.say = { text: this.pick(this.config.bumped), ms: 2200 };
      n.quietUntil = this.ms + 6000;
    }
    // Slow down smoothly the closer they get (stop-and-go every frame flicks between walking and standing poses);
    // stepping aside they keep walking on, so they go round on a slant.
    const slow = Math.min(1, Math.max(0, (best - 0.45) / 0.85));
    // Round a person they keep walking on a slant; round a stall or a stool they wait to be clear before going on.
    return stepped && !wall ? Math.max(0.5, slow) : slow;
  }

  /**
   * Ground a walker can stand on: free ground on the map, anywhere on the street beyond its ends. The map's
   * edge column at each street end is open to walkers (only the hero is stopped there, by the barrier scene).
   */
  private footing(x: number, y: number): boolean {
    const edge = 1 + 0.26;
    return x < 1 || x > this.size.w - 1 || this.hooks.walkable(Math.max(edge, Math.min(this.size.w - edge, x)), y);
  }

  /** Personal space for ambient pedestrians; stepping out of an existing overlap is always allowed. */
  private canPass(n: Npc, to: WorldPos): boolean {
    if (!this.footing(to.x, to.y)) return false;
    if (n.x >= 1.26 && n.x <= this.size.w - 1.26 && to.x >= 1.26 && to.x <= this.size.w - 1.26 && !this.hooks.canWalk(n, to)) return false;
    const closer = (p: WorldPos, gap: number) => {
      const d = Math.hypot(to.x - p.x, to.y - p.y);
      return d < gap && d < Math.hypot(n.x - p.x, n.y - p.y) - 1e-6;
    };
    if (!this.rescue?.hidden && n.look !== 'medic' && closer(this.player.pos, this.hooks.isDown() ? 1 : 0.7)) return false;
    if (this.npcs.some(m => m !== n && !m.bike && (m.scale ?? 1) > 0.01 && closer(m, n.look === 'medic' && m.look === 'medic' ? 0.55 : 0.85))) return false;
    if (this.hooks.props().some(p => closer(p, p.r + 0.26))) return false;
    const r = this.rescue, v = r?.van;
    if (r && v && !r.hidden && !r.route.approach.length) {
      const rx = v.axis === 'y' ? 0.7 : 1.35, ry = v.axis === 'y' ? 1.35 : 0.7;
      const distance = (p: WorldPos) => Math.hypot(Math.max(0, Math.abs(p.x - v.x) - rx), Math.max(0, Math.abs(p.y - v.y) - ry));
      if (distance(to) < 0.26 && distance(to) < distance(n) - 1e-6) return false;
    }
    return true;
  }

  /** One step round the loop: along the legs of the path, the bike facing the way it is going. */
  private goRound(n: Npc, dt: number): void {
    const t = n.turn!;
    let left = (n.speed * dt) / 1000;
    while (left > 0 && t.i < t.path.length - 1) {
      const [x0, y0] = t.path[t.i]!, [x1, y1] = t.path[t.i + 1]!, len = Math.hypot(x1 - x0, y1 - y0);
      const step = Math.min(left, len - t.at);
      t.at += step;
      left -= step;
      if (x1 !== x0) n.dir = Math.sign(x1 - x0);
      if (t.at >= len - 1e-9) { t.i++; t.at = 0; }
    }
    const last = t.path[t.path.length - 1]!;
    if (t.i >= t.path.length - 1) {
      n.x = last[0];
      n.y = last[1];
      n.turn = undefined;
      return;
    }
    const [x0, y0] = t.path[t.i]!, [x1, y1] = t.path[t.i + 1]!, len = Math.hypot(x1 - x0, y1 - y0), k = len ? t.at / len : 0;
    n.x = x0 + (x1 - x0) * k;
    n.y = y0 + (y1 - y0) * k;
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
    // Nobody chats about lottery tickets while the ambulance is here.
    if (this.rescue) return;
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
      // Walked off (away from the stall and from its people, who may be standing a little off it), or rush hour
      // began: the talk stops (and plays again from the top next time).
      const near = (q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
      const people = this.npcs.filter((n) => n.id.startsWith(`${t.stall.id}:`));
      const gone = near(c) > this.config.talkRadius + LEAVE_MARGIN && people.every((n) => near(n) > TALK_REACH + LEAVE_MARGIN / 2);
      if (gone || !this.walking()) return this.endTalk(false);
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
    const rescue = this.rescue;
    return {
      npcs: this.npcs.map((n) => ({ id: n.id, look: n.look, x: n.x, y: n.y, dir: n.dir, moving: !!n.moving, bike: n.bike, say: n.say?.text ?? null, scale: n.scale ?? 1, skid: !!n.skidMs, tilt: n.tilt ?? 0, axis: n.axis ?? 'x', facing: n.facing,
        doorOpen: !!rescue && n === rescue.van && !rescue.hidden && !rescue.route.approach.length && rescue.ms >= 6900,
        damaged: !!rescue && n === rescue.van && !!rescue.mishap?.wheel,
      })),
      elapsedMs: this.ms,
      carryLift: rescue?.carried ? Math.min(1, Math.max(0, (rescue.ms - 11300) / 200)) : 0,
      heroSay: this.heroSay?.text ?? null,
      choices: t?.choosing ? t.stall.choices.map((c) => c.text) : null,
      talking: t?.stall.id ?? null,
      gates: this.gates().map((g) => ({ id: g.id, x: g.x, open: this.gateOpen[g.id] ?? 0, sign: g.sign ?? null })),
      carried: !!this.rescue?.carried,
      focus: this.rescueFocus(),
      wheel: this.rescue?.mishap?.wheel ? { x: this.rescue.mishap.wheel.x, y: this.rescue.mishap.wheel.y, spin: this.rescue.mishap.wheel.spin } : null,
      boom: this.rescue?.mishap?.boom ? { x: this.rescue.mishap.boom.x, y: this.rescue.mishap.boom.y, t: Math.min(1, this.rescue.mishap.boom.ms / 1500), word: this.config.rescue?.boom ?? '' } : null,
      heroHidden: !!this.rescue?.hidden,
      heroDown: this.hooks.isDown(),
      bonk: this.rescue?.bonkMs || this.gateBonkMs ? this.config.rescue?.bonk ?? null : null,
      flashes: (this.rescue?.crowd ?? []).filter((n) => (n.photoMs ?? 0) > 0).map((n) => ({ x: n.x, y: n.y })),
      portal: this.rescue?.portal ? { x: this.rescue.portal.x, y: this.rescue.portal.y, t: Math.min(1, this.rescue.portal.ms / 500), k: 1 - (this.rescue.van?.scale ?? 1) } : null,
    };
  }
}

/** Time a line stays up: long enough to read it. */
function lineMs(text: string): number {
  return Math.max(1600, 900 + text.length * 45);
}
