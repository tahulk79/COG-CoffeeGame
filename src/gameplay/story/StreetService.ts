import type { Footprint, WorldPos } from '../../utils/tile';
import type { Rect } from '../../systems/camera/framing';
import { DOOR_OUT, vanBody, type RescueRoute } from './rescueRouting';
import { facingFrom, type Actor, type Facing } from '../../entities/Actor';
import type { HazardKind, RunPhase } from './RunService';
import { assignSlots, carrySlots, lineOfSight, plannedRow, separate, socialStep, steadyHeading, toSegment, viewingSlots, type Circle, type SocialEnv } from './crowd';
import { AMBULANCE_SPEC, Traffic, VEHICLE_SPECS, type Driving, type Obstacle, type TrafficConfig, type VehicleKind } from './traffic';

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
  /** Road traffic: the motorbike/car mix, arrivals per hour each way, the opening density (see traffic.ts). */
  traffic?: TrafficConfig;
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
  /** Chatter among the onlookers between the scripted lines (any of them, in any order). */
  gossip?: string[];
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
  /** Slipper: the guard throwing it, the hero's last words. */
  throw: string; slipperFaint: string;
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
  path(from: WorldPos, to: WorldPos, avoid?: Footprint, people?: Array<WorldPos & { r?: number }>): WorldPos[] | null;
  rescueRoute(hero: WorldPos, people?: WorldPos[]): RescueRoute | null;
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
  /** Traffic car: its own lane, and the lane it is swinging into to get round something stopped ahead. */
  homeY?: number; laneTarget?: number;
  /** On foot: velocity and steady heading (social force model, crowd.ts); an onlooker turned towards the hero. */
  vx?: number; vy?: number; heading?: number; watch?: boolean; r?: number; wasMoving?: boolean;
  /** A back-street bike's own cruising speed (its `speed` is the current one). */
  cruise?: number;
  /** On the main road: driven by the traffic model (IDM + MOBIL). */
  traffic?: Driving;
  /** Scenery on the back street (beyond the playable map): rides or walks round and round, never meets the story. */
  decor?: boolean;
  /** A walker's own row: stepping aside for someone, they come back to it afterwards. */
  lane?: number;
  /** The side (1 / -1 in y) a walker is stepping aside to, kept until they have passed. */
  dodge?: number;
  dodgeUntil?: number;
  /** Crossing the road at the zebra: the sidewalk row they are heading for, and how long it has taken (ms). `go` false: still waiting at the kerb for a gap. */
  cross?: { toY: number; ms: number; go: boolean };
  crossCool?: number;
  detour?: { goal: WorldPos; dir: number; ms: number; blockedMs: number };
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
const LOOP = { inW: -13, inE: 15, farW: -17.35, farE: 19.35, margin: 3.2 };
/** Where people standing about look when they look round (front-facing, so their faces show). */
const IDLE_LOOKS: Facing[] = ['E', 'S', 'W', 'SE', 'SW'];
/** The hero this close to a street end's boom line (tiles) is trying to get past it. */
const GATE_REACH = 0.9;
/** The two medics never stand closer than this (tiles): one figure on top of the other looks like one. */
const MEDIC_GAP = 0.45;
/** The magic circle takes this long to open before the ambulance drives into it (ms). */
/** Used when the chapter's street has no `traffic` block: about 85 % motorbikes, as on a Hanoi street. */
const DEFAULT_TRAFFIC: TrafficConfig = { mix: { bike: 0.88, car: 0.12 }, flow: 1000, rushFlow: 1.6, density: 0.035 };

/** The painted zebra crossing: passers-by cross the road only here. */
export const CROSSWALK = { x: 22.8, half: 2.2 };
/** When the ambulance turns into the street (rescue ms): it was called at once. */
const AMBULANCE_AT = 1000;

/** When onlookers gossip (rescue ms): in the gaps between the scripted lines. */
const GOSSIP_AT = [2100, 3300, 4300, 5300, 6200, 7000, 8300, 9300, 10100, 10900] as const;

/** Held up this long (ms) a medic or the carried hero stops looking for a way round and goes straight there. */
const RESCUE_STUCK_MS = 1500;

/** The ambulance's braking (tiles/s²) on its way in. */
const VAN_BRAKE = 4;
const PORTAL_OPEN_MS = 700;
const DEPART_BEFORE_PORTAL = 10;
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
  private nextVehicle = 0;
  /** The way the medics last carried the hero (kept when there is no way left, at the door). */
  private carryHeading: WorldPos | null = null;
  private lastGossip = '';
  /** How long the ambulance has been held up on its way in (ms). */
  private vanStuckMs = 0;
  /** How long the carried hero has not moved towards the door (ms). */
  private carryStuckMs = 0;
  private walkEnv: SocialEnv = { walkable: () => true, people: [], circles: [] };
  private traffic!: Traffic;
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
  private readonly routeRetry = new WeakMap<WorldPos, number>();
  private supportCache?: { x: number; y: number; spots: Array<WorldPos | undefined> };
  private rescue: { route: RescueRoute; ms: number; dir: number; crowd: Npc[]; yielding: Npc[]; van: Npc | null; medics: Npc[]; carried: boolean; hidden: boolean; bonkMs: number; portal: { x: number; y: number; ms: number } | null; bonked: boolean; done: boolean; departureDistance: number;
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
        if (q.x >= 2.5 && q.x <= size.w - 2.5 && [[0, 0], [.5, 0], [-.5, 0], [0, .5], [0, -.5]].every(([dx, dy]) => this.hooks.walkable(q.x + dx!, q.y + dy!)) && this.hooks.props().every(o => Math.hypot(q.x - o.x, q.y - o.y) >= o.r + .5) && this.npcs.every(n => Math.hypot(n.x - q.x, n.y - q.y) >= 0.9)) { at = q; placed = true; break; }
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
        if (this.npcs.some(m => !m.bike && Math.hypot(m.x - q.x, m.y - q.y) < 0.9)) continue;
        if ((config.gates ?? []).some(g => Math.hypot(g.guard.x - q.x, g.guard.y - q.y) < 0.9)) continue;
        if (this.hooks.props().some(o => Math.hypot(o.x - q.x, o.y - q.y) < o.r + 0.3)) continue;
        n.x = q.x;
        this.npcs.push(n);
        break;
      }
    }
    // The road opens with traffic already on it, then vehicles arrive at both ends (traffic.ts).
    this.traffic = new Traffic(config.bikeLanes, config.traffic ?? DEFAULT_TRAFFIC, this.random, { from: -19, to: this.size.w + 21 });
    this.traffic.fill((kind, v0, dir, lane, x) => this.addVehicle(kind, v0, dir, lane, x, v0 * 0.8));
    for (const g of config.gates ?? []) {
      this.gateOpen[g.id] = 0;
      this.npcs.push({ id: `gate:${g.id}`, look: 'guard', x: g.guard.x, y: g.guard.y, dir: g.inward, speed: 0, bike: false, still: true, waitMs: 0, say: null, quietUntil: 0, home: { ...g.guard, reach: 0 }, idleMs: 1500 + this.random() * 3000 });
    }
  }

  /** Right-hand rule on the sidewalks: of each pair of lanes on the north side one goes each way; the south lane alternates. */
  private walkerDir(i: number): number {
    const lanes = this.config.lanes, li = i % lanes.length;
    return lanes[li]! < this.config.bikeLanes[0]! ? (li % 2 ? 1 : -1) : Math.floor(i / lanes.length) % 2 ? 1 : -1;
  }

  private walker(i: number, x: number): Npc {
    const c = this.config, r = this.random;
    // Not all in single file: each walker keeps a row a little off the lane's centre.
    const y = c.lanes[i % c.lanes.length]! + (r() - 0.5) * 0.24;
    // Each look in turn, so a few passers-by are all different people.
    const look = c.looks[i % c.looks.length]!;
    // A shoulder pole with two baskets takes room either side; a child is small.
    return { id: `walker${i}`, look, r: look === 'vendor' ? 0.45 : look === 'kid' ? 0.2 : 0.25, x, y, lane: y, visitAt: Number.POSITIVE_INFINITY, dir: this.walkerDir(i), speed: c.walkSpeed[0] + r() * (c.walkSpeed[1] - c.walkSpeed[0]), bike: false, still: false, waitMs: 0, say: null, quietUntil: 0 };
  }

  private addVehicle(kind: VehicleKind, v0: number, dir: number, lane: number, x: number, v: number): void {
    this.npcs.push({ id: `veh${++this.nextVehicle}`, look: kind === 'bike' ? 'bike' : 'traffic_car', x, y: this.config.bikeLanes[lane]!, dir, speed: v, bike: true, still: false, waitMs: 0, say: null, quietUntil: 0, traffic: { kind, v0, lane, checkMs: this.random() * 600 } });
  }

  /** The road: obstacles for the traffic model, one step of it, then what the street makes of it (horns, the hero hit). */
  private tickTraffic(dt: number): void {
    const p = this.player.pos, chaos = this.hooks.phase() === 'chaos', down = this.hooks.isDown(), r = this.rescue;
    const cars = this.npcs.filter(n => n.traffic);
    const obstacles: Obstacle[] = [];
    // The hero in the road: everybody stops, except rush-hour riders, who only ease off (and may not stop in time).
    // Reach: the body (0.3) plus a vehicle's half-width, so someone between two lanes stops both.
    if (!r?.hidden) obstacles.push({ x: p.x, y: p.y, half: 0.3, reach: 0.85, tag: 'hero', ignoredBy: chaos && !down ? 'bike' : undefined });
    for (const n of this.npcs) if (!n.bike && !n.decor && (n.scale ?? 1) > .01 && this.onRoad(n.y)) obstacles.push({ x: n.x, y: n.y, half: 0.3, reach: 0.85, tag: 'person' });
    // The ambulance is in the way as long as it is on the road (pulling out too); only on its way in does it sound the siren.
    const van = r?.van && (r.van.scale ?? 1) > .01 ? r.van : null;
    // Pulled up at the scene (medics out, the hero carried to it) it closes its side of the road: nobody squeezes past
    // beside it; the other way keeps flowing. Driving, it takes only its own lane.
    const atScene = !!van && !r!.hidden && !van.moving && !r!.route.approach.length;
    const body: Obstacle | null = van ? { x: van.x, y: van.y, half: 1.1, reach: atScene ? 1.5 : 0.8, v: van.moving ? van.speed : 0, dir: van.dir, tag: 'van' } : null;
    if (body) obstacles.push(body);
    const siren = body && !r!.hidden ? body : null;
    // The other side of the road keeps flowing past the scene: it only stops for what is really in its lane
    // (a medic, the hero being carried, an onlooker on the road).
    // A boom still down is a stop line for both ways.
    const lanes = this.config.bikeLanes, mid = (lanes[0]! + lanes[lanes.length - 1]!) / 2;
    for (const g of this.gates()) if ((this.gateOpen[g.id] ?? 0) < 0.9) obstacles.push({ x: g.x, y: mid, half: 0, reach: 4, tag: 'boom' });
    for (const c of cars) {
      const t = c.traffic!, ahead = (p.x - c.x) * c.dir, across = Math.abs(p.y - c.y);
      t.cap = chaos && !down && t.kind === 'bike' && ahead > 0 && ahead < 4.5 && across < 0.7 ? t.v0 * 0.45 : undefined;
    }
    const before = new Map(cars.map(c => [c, { x: c.x, y: c.y }] as const));
    this.traffic.step(cars, obstacles, dt, chaos ? this.config.traffic?.rushFlow ?? 1.6 : 1, siren,
      (kind, v0, dir, lane, x, v) => this.addVehicle(kind, v0, dir, lane, x, v),
      (c) => { const i = this.npcs.indexOf(c as Npc); if (i >= 0) this.npcs.splice(i, 1); });
    for (const n of this.npcs) {
      const t = n.traffic;
      if (!t) continue;
      const b = before.get(n);
      if (b && n.moving) n.facing = facingFrom(n.x - b.x, n.y - b.y) ?? n.facing;
      if (n.skidMs) n.skidMs = Math.max(0, n.skidMs - dt);
      // The guard raises the boom for whoever is coming, early enough for them to roll through.
      const spec = VEHICLE_SPECS[t.kind];
      for (const g of this.gates()) {
        const toBoom = (g.x - n.x) * n.dir;
        if (toBoom > -1.5 && toBoom < (n.speed * n.speed) / (2 * spec.b) + 3) this.gateHold[g.id] = this.ms + 500;
      }
      // Held up by the hero or a person on the road: a horn (not every time).
      if ((t.stoppedFor === 'hero' || t.stoppedFor === 'person') && this.ms >= n.quietUntil && !n.say) {
        n.say = { text: this.pick(this.config.honk), ms: 1600 };
        n.quietUntil = this.ms + 6000;
      }
      // A bike and the hero meet (stepping in front of it, or a rush-hour rider who could not stop): luck decides.
      if (t.kind === 'bike' && !down && (!chaos || this.chaosMs > 5000)) {
        const ahead = (p.x - n.x) * n.dir, across = Math.abs(p.y - n.y);
        if (ahead > -0.3 && ahead < 0.55 && across < 0.45) this.nearMiss(n);
      }
      // Walking into a car (its nose, its side, standing or moving) knocks the hero down like a bike does: nobody walks
      // through a car. The car stops dead, just clear of them.
      if (t.kind === 'car' && !down && !this.hooks.knockedOut()) {
        const along = (p.x - n.x) * n.dir, across = Math.abs(p.y - n.y), half = VEHICLE_SPECS.car.len / 2;
        if (Math.abs(along) < half + 0.3 && across < 0.6) {
          if (along > 0) n.x = p.x - n.dir * (half + 0.45);
          n.speed = 0;
          n.waitMs = 1500;
          n.say = { text: 'RẦM!', ms: 900 };
          this.hooks.bikeHit();
        }
      }
    }
  }

  tick(dt: number): void {
    this.ms += dt;
    for (const n of this.npcs) n.moving = false;
    if (this.hooks.phase() === 'chaos') this.chaosMs += dt;
    this.tickTraffic(dt);
    this.walkEnv = this.socialEnv(true);
    for (const n of this.npcs) if (n.say && (n.say.ms -= dt) <= 0) n.say = null;
    if (this.heroSay && (this.heroSay.ms -= dt) <= 0) this.heroSay = null;
    for (const n of this.npcs) if (!n.still && !n.traffic) {
      const x = n.x, y = n.y;
      this.move(n, dt);
      // By speed, not by distance per tick: a slow walker must not flick between walking and standing frames.
      // Walking pose with hysteresis: starts above 0.25 tiles/s, stops below 0.1 (no stepping on the spot).
      const pace = (Math.hypot(n.x - x, n.y - y) * 1000) / Math.max(dt, 1);
      n.moving = n.bike ? pace > 0.2 : pace > (n.wasMoving ? 0.1 : 0.25);
      n.wasMoving = n.moving;
      // Facing the way they really go: round someone they turn that way (no walking sideways like a crab);
      // along their row, plainly along it (small wobbles must not flip the pose).
      const mx = n.x - x, my = n.y - y;
      if (!n.bike) { const h = steadyHeading(n); if (h !== null) n.facing = facingFrom(Math.cos(h), Math.sin(h)) ?? n.facing; }
      else if (n.moving) n.facing = facingFrom(mx, my) ?? n.facing;
    }
    // Nobody ends a step inside anybody: whoever stands at a post (or carries the hero) holds their ground.
    separate(this.walkEnv.people, (x, y) => this.hooks.walkable(x, y), (q) => { const n = q as Npc; return n.look === 'medic' || (n.still && !n.goal); });
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
  people(): Array<{ x: number; y: number; r?: number }> {
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
      if (!this.hooks.walkable(p0.x, p0.y) || this.hooks.props().some(o => Math.hypot(p0.x - o.x, p0.y - o.y) < o.r + .26)) Object.assign(p0, this.freeNear(p0.x, p0.y));
      const route = this.hooks.rescueRoute(p0, this.npcs.filter(n => n.look === 'guard' && (n.scale ?? 1) > .01));
      if (!route) return;
      this.carryHeading = null;
      this.vanStuckMs = 0;
      this.carryStuckMs = 0;
      this.rescue = { route, ms: 0, dir: route.dir, crowd: [], yielding: [], van: null, medics: [], carried: false, hidden: false, bonkMs: 0, portal: null, bonked: false, done: false, departureDistance: 0, mishap: null };
    }
    const r = this.rescue, prev = r.ms, p = this.player.pos;
    if (!this.hooks.walkable(p.x, p.y)) Object.assign(p, this.freeNear(p.x, p.y));
    r.ms += dt;
    const medicsReady = r.medics.length === 2 && r.medics.every((m) => (m.scale ?? 1) > 0.01 && !!m.goal && Math.hypot(m.x - m.goal.x, m.y - m.goal.y) <= 0.3);
    // Dialogue timing waits for the actual pickup and arrival at the van.
    if (prev < 7200 && r.ms >= 7200 && r.route.approach.length) r.ms = 7199;
    if (prev < 11300 && r.ms >= 11300 && !medicsReady) r.ms = 11299;
    if (prev < 14900 && r.ms >= 14900 && !r.bonked) r.ms = 14899;
    r.bonkMs = Math.max(0, r.bonkMs - dt);
    const at = (ms: number) => prev < ms && r.ms >= ms;
    // Traffic keeps to the right, the ambulance too: heading west it takes the north lane, heading east the south one.
    // A little in from the bike lane: the ambulance is wider than a bike and must not hang over the kerb.
    const lane = r.route.lane;
    // The side of the hero away from the ambulance's lane: the crowd stands there, out of its way.
    const away = p.y >= lane ? 1 : -1;
    // Off the van's lane: whoever stands there steps to the nearer side of the road.
    const offLane = (g: { x: number; y: number }) => (Math.abs(g.y - lane) < 1.3 ? this.freeNear(g.x, lane + away * 1.6, true) : g);
    // Onlookers: curious passers-by nearby (who can get there) come and stand round the hero, in rings, all able to see.
    if (at(600)) {
      const near = this.npcs.filter((n) => !n.still && !n.bike && !n.decor && n.x > 1.5 && n.x < this.size.w - 1.5 && Math.hypot(n.x - p.x, n.y - p.y) < 12 && this.random() < 0.9)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 12);
      this.gather(near, [1.8, 2.7, 3.6, 4.4]);
      r.crowd = near;
      // Guards and others standing close also make room: a stationary person must not seal the rescue route.
      r.yielding = this.npcs.filter(n => !n.bike && n.still && !near.includes(n) && !n.id.startsWith('gate:') && Math.hypot(n.x - p.x, n.y - p.y) < 3.5);
      this.gather(r.yielding, [4.4, 5.2]);
    }
    const say = (n: Npc | undefined, text: string, ms = 2200) => { if (n) n.say = { text, ms }; };
    if (at(1500)) say(r.crowd[0], L.crowd[0] ?? '');
    if (at(2700)) say(r.crowd[1], L.crowd[1] ?? '');
    if (at(3900)) say(r.crowd[2], L.crowd[2] ?? '');
    if (at(AMBULANCE_AT)) {
      const entry = r.route.approach.shift()!;
      r.van = this.vehicle('ambulance', 'ambulance', entry.x, entry.y, r.dir, 11, L.siren);
      r.route.approach.unshift(entry);
    }
    if (at(4800)) say(r.crowd[3] ?? r.crowd[0], L.xeom);
    // Between the scripted lines the onlookers talk among themselves: a random one, a random line, never twice running.
    for (const t of GOSSIP_AT) if (at(t) && L.gossip?.length) {
      const idle = r.crowd.filter(n => !n.say && !n.photoMs);
      const who = idle[Math.floor(this.random() * idle.length)];
      if (who) { const lines = L.gossip.filter(l => l !== this.lastGossip); this.lastGossip = lines[Math.floor(this.random() * lines.length)] ?? L.gossip[0]!; say(who, this.lastGossip, 1500); }
    }
    if (at(5800)) say(r.van ?? undefined, L.driver, 1600);
    if (at(6600)) say(r.crowd[0], L.crowd[3] ?? '');
    // The van pulls up short of the hero (never over them), then (later) drives off.
    const v = r.van;
    // Its side door, on the hero's side: the hero is carried up beside the van, never on top of it.
    const door = v ? r.route.door : null;
    if (v && !r.hidden) {
      // Flat out down the street, braking into each turn and to a stop by the hero.
      // Kinematic braking: never faster than it can stop in, v = √(2·b·d), to the parking spot and into each turn.
      const pts = r.route.approach;
      if (pts.length) {
        let left = Math.hypot(pts[0]!.x - v.x, pts[0]!.y - v.y);
        for (let i = 1; i < pts.length; i++) left += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
        const corner = pts.length > 1 ? Math.hypot(pts[0]!.x - v.x, pts[0]!.y - v.y) : Infinity;
        // The same car-following model as the traffic (IDM), its desired speed capped by what it can still stop in.
        const v0 = Math.min(AMBULANCE_SPEC.v0[1], Math.sqrt(2 * VAN_BRAKE * left) + 0.4, Math.sqrt(2 * VAN_BRAKE * corner) + 2.5);
        const lead = this.leaderOf(v, AMBULANCE_SPEC.len, false);
        this.idmStep(v, AMBULANCE_SPEC, v0, lead, dt);
        this.makeWay(r, v, lead);
        // Stuck in a jam on the way: it pulls up right there and the medics go the rest of the way on foot.
        this.vanStuckMs = v.speed < 0.3 ? this.vanStuckMs + dt : 0;
        if (this.vanStuckMs > 1200 && r.route.park.y === r.route.lane) this.stopVanHere(r, v);
      }
      if (r.route.approach.length) this.drive(v, r.route.approach, dt);
    }
    // The medics jump out, take the hero by both ends, and carry them to the back door.
    // One after the other out of the side door (never two figures on the same spot, looking like one).
    if (at(7200) && door) {
      const spots = this.formation(r, { x: door.x - p.x, y: door.y - p.y });
      const far = Math.hypot(spots[0]!.x - door.x, spots[0]!.y - door.y) >= Math.hypot(spots[1]!.x - door.x, spots[1]!.y - door.y) ? 0 : 1;
      r.medics = [0, 1].map((i) => { const n = this.vehicle(`medic${i}`, 'medic', door.x, door.y, -r.dir, 0, ''); n.bike = false; n.say = null; if (i === far) n.goal = spots[i]; else n.scale = 0; return n; });
    }
    if (r.ms >= 7800 && r.medics.some(m => m.scale === 0) && door) {
      // Out of the door a little along the van if the first medic is still standing by it.
      const m = r.medics.find(m => m.scale === 0)!, first = r.medics.find(m => m.scale !== 0)!;
      // Along the van, then a step further out from it (a tree or a bystander right by the door).
      const horizontal = r.route.park.y === lane, outward = horizontal ? Math.sign(door.y - r.route.park.y) || 1 : Math.sign(door.x - r.route.park.x) || 1;
      const spots = [0, -0.6, 0.6, -1.2, 1.2].flatMap(offset => [0, 0.5].map(off => horizontal
        ? { x: door.x + offset * r.dir, y: door.y + off * outward }
        : { x: door.x + off * outward, y: door.y + offset }));
      const props = this.hooks.props();
      const free = (q: WorldPos) => this.clearOfVan(q, r) && props.every(o => Math.hypot(q.x - o.x, q.y - o.y) >= o.r + .26);
      const strict = (q: WorldPos) => free(q) && this.hooks.canWalk(door, q) && Math.hypot(q.x - first.x, q.y - first.y) >= MEDIC_GAP
        && !this.npcs.some(o => o !== m && !o.bike && o.look !== 'medic' && (o.scale ?? 1) > .01 && Math.hypot(q.x - o.x, q.y - o.y) < .6);
      // Keep waiting inside the van if the first medic has not cleared the door yet; never for good, though:
      // after a moment any free ground by the door will do (bystanders step aside for them).
      const out = spots.find(strict) ?? (r.ms >= 9000 ? spots.find(free) ?? this.freeNear(door.x, door.y) : undefined);
      if (out) { m.x = out.x; m.y = out.y; m.scale = 1; m.goal = this.formation(r, { x: door.x - p.x, y: door.y - p.y })[r.medics.indexOf(m)]; }
    }
    // "Make way!": the crowd is pushed back a step or two; the one filming gets told off (and answers back).
    if (at(7500)) {
      say(r.medics.find(m => (m.scale ?? 1) > 0), L.shoo, 1300);
      // Back a step: everyone finds a spot on the outer rings (still with a view).
      this.gather(r.crowd, [3.2, 4.0, 4.8]);
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
      // The pair turns with the way the hero is being carried (one at each end), closing up where it is narrow.
      // At the door there is no way left to face: keep the last one (or else the pair would collapse onto one spot).
      const next = this.paths.get(p)?.points[0] ?? door, hx = next.x - p.x, hy = next.y - p.y;
      if (Math.hypot(hx, hy) > 0.05) this.carryHeading = { x: hx, y: hy };
      const spots = this.formation(r, this.carryHeading ?? { x: door.x - p.x || r.dir, y: door.y - p.y });
      const distance = (m: Npc, q: WorldPos) => Math.hypot(m.x - q.x, m.y - q.y);
      if (r.medics.length === 2 && distance(r.medics[0]!, spots[1]!) + distance(r.medics[1]!, spots[0]!) + .25 < distance(r.medics[0]!, spots[0]!) + distance(r.medics[1]!, spots[1]!)) r.medics.reverse();
      // The hero is only lifted while both medics hold them at arm's length; otherwise they wait for the pair to close up.
      // No stop-and-go: the hero moves on all the time, as fast as the slower medic keeps up (a pair carrying together).
      const lag = r.medics.length === 2 && r.medics.every(m => (m.scale ?? 1) > 0.01) ? Math.max(...r.medics.map((m, i) => distance(m, spots[i]!))) : Infinity;
      const pace = Math.max(0, Math.min(1, 1 - (lag - 0.12) / 0.35));
      const hx0 = p.x, hy0 = p.y, toDoor = Math.hypot(door.x - p.x, door.y - p.y);
      let arrived: boolean;
      if (pace > 0.1 && this.carryStuckMs > RESCUE_STUCK_MS) {
        // No way found round (a tree trunk, people at the door): carried straight to the door.
        const step = Math.min(toDoor, 1.6 * pace * dt / 1000);
        if (toDoor > 1e-6) { p.x += (door.x - p.x) / toDoor * step; p.y += (door.y - p.y) / toDoor * step; }
        arrived = Math.hypot(p.x - door.x, p.y - door.y) <= 0.05;
      } else arrived = pace > 0.1 ? this.stepToward(p, door, 1.6 * pace, dt, this.vanBody(r)) : toDoor <= 0.05;
      // Only counts while the pair holds the hero (waiting for a medic to close up is not being stuck).
      if (pace > 0.1 && !arrived && this.carryStuckMs <= RESCUE_STUCK_MS) this.carryStuckMs = Math.hypot(p.x - hx0, p.y - hy0) > 0.0002 * dt ? 0 : this.carryStuckMs + dt;
      if (arrived && lag <= 0.35 && !r.bonked && r.ms >= 13900) {
        // Head, meet door.
        r.bonked = true;
        r.bonkMs = 900;
        // In the van as soon as the "CỐP!" has sounded.
        r.ms = Math.max(r.ms, 14000);
      }
      r.medics.forEach((m, i) => { if ((m.scale ?? 1) > 0) m.goal = spots[i]; });
    }
    // Everyone in, doors shut, off it goes… and a magic circle opens on the road ahead.
    if (at(14900) && v) {
      r.hidden = true;
      r.carried = false;
      for (const m of r.medics) this.npcs.splice(this.npcs.indexOf(m), 1);
      r.medics = [];
      // The driver sums it up as they pull away.
      v.say = { text: L.oops, ms: 2200 };
      v.speed = 1.5;
      // Sometimes it never gets there in one piece.
      if (this.random() < (L.wheelOffChance ?? 0)) r.mishap = { wheel: null, boom: null };
    }
    // First leave the pickup spot and rejoin the road; only then reveal the portal ahead.
    // Pulling out: first wait for a gap in the traffic coming up behind in its lane (MOBIL-style safety check).
    // Cars halted behind the van (waiting for it) do not count: it would wait for them, and they for it, for ever.
    const merging = r.hidden && v && !r.portal && r.departureDistance < 0.5 && this.npcs.some(m => m.traffic && m.speed > 0.3 && m.dir === r.dir && Math.abs(m.y - v.y) < 0.9 && (v.x - m.x) * r.dir > 0 && (v.x - m.x) * r.dir < 2 + m.speed * 1.2);
    if (merging) v.speed = 0;
    if (r.hidden && v && !r.portal && !merging) {
      const before = { x: v.x, y: v.y };
      // Face the way out first: still facing into the side street, the onlookers behind it would count as "ahead" and hold it for good.
      const out = r.route.exit[0];
      if (out) {
        const dx = out.x - v.x, dy = out.y - v.y;
        v.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
        v.dir = Math.sign(v.axis === 'y' ? dy : dx) || v.dir;
      }
      const lead = this.leaderOf(v, AMBULANCE_SPEC.len, false);
      this.idmStep(v, AMBULANCE_SPEC, AMBULANCE_SPEC.v0[1], lead, dt);
      this.makeWay(r, v, lead);
      if (r.route.exit.length) this.drive(v, r.route.exit, dt);
      else { v.axis = 'x'; v.dir = r.dir; v.x += r.dir * v.speed * dt / 1000; }
      r.departureDistance += Math.hypot(v.x - before.x, v.y - before.y);
      if (!r.route.exit.length && r.departureDistance >= DEPART_BEFORE_PORTAL) {
        let px = v.x + r.dir * 10;
        for (const g of this.config.gates ?? []) if (Math.abs(px - g.x) < 2) px = g.x + r.dir * 2;
        r.portal = { x: px, y: v.y, ms: 0 };
      }
    }
    if (r.portal && v) {
      r.portal.ms += dt;
      const into = (v.x - r.portal.x) * r.dir;
      const m = r.mishap;
      // The circle opens first (the driver stares at it), then the van floors it.
      const rev = r.portal.ms - PORTAL_OPEN_MS;
      // No stop-and-go: the van keeps rolling towards the circle while it opens, only holding back right at its edge.
      v.speed = rev < 0 ? Math.max(v.speed, 3.5) : Math.min(9, Math.max(v.speed, 1.5 + rev / 1000 * 9));
      if (rev < 0 && !r.route.exit.length) {
        const rolling = into < -2.5;
        v.axis = 'x'; v.dir = r.dir; v.moving = rolling;
        if (rolling) v.x += (r.dir * Math.min(v.speed, (-2.5 - into) / Math.max(.2, (PORTAL_OPEN_MS - r.portal.ms) / 1000)) * dt) / 1000;
      } else if (r.route.exit.length) this.drive(v, r.route.exit, dt);
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
    // Whoever stands on a medic's spot or wanders onto the carry route is asked to step aside (the party never walks through anyone).
    if (!r.hidden && door && (r.carried || r.medics.length)) {
      const legs: Array<[WorldPos, WorldPos]> = r.carried ? [[p, door]] : r.medics.filter(m => m.goal).map(m => [m.goal!, m.goal!] as [WorldPos, WorldPos]);
      // A medic still waiting inside the van needs the door clear to step out.
      if (!r.carried && r.medics.some(m => m.scale === 0)) legs.push([door, door]);
      for (const n of this.npcs) {
        if (n.bike || n.look === 'medic' || n.look === 'ambulance' || (n.scale ?? 1) <= .01 || r.crowd.includes(n) || r.yielding.includes(n) || n.id.startsWith('gate:')) continue;
        for (const [a, b] of legs) {
          const sx = b.x - a.x, sy = b.y - a.y, len2 = sx * sx + sy * sy || 1;
          const t = Math.max(0, Math.min(1, ((n.x - a.x) * sx + (n.y - a.y) * sy) / len2)), qx = a.x + sx * t, qy = a.y + sy * t;
          if (Math.hypot(n.x - qx, n.y - qy) > 1.3 && !(r.carried && Math.hypot(n.x - door.x, n.y - door.y) <= 1.6)) continue;
          const dx = n.x - qx, dy = n.y - qy, d = Math.hypot(dx, dy) || 1;
          n.visit = undefined; n.still = true;
          n.goal = offLane(this.spotAround({ x: qx, y: qy }, dx / d * 2.6, dy / d * 2.6));
          r.yielding.push(n);
          break;
        }
      }
    }
    // Onlookers walk to their spots by the social force (round each other, the medics, the van), then turn to watch.
    const env = this.socialEnv(false);
    for (const n of [...r.crowd, ...r.yielding]) {
      const x0 = n.x, y0 = n.y;
      if (n.goal && this.steerTo(n, n.goal, 2.2, dt, env)) n.goal = undefined;
      n.moving = Math.hypot(n.x - x0, n.y - y0) > 0.005;
      if (n.moving) { const h = steadyHeading(n); if (h !== null) n.facing = facingFrom(Math.cos(h), Math.sin(h)) ?? n.facing; }
      else if (n.watch && !r.hidden) n.facing = facingFrom(p.x - n.x, p.y - n.y) ?? n.facing;
      if (Math.abs(n.x - x0) > 0.005) n.dir = n.x > x0 ? 1 : -1;
    }
    // The medics keep their formation slots (exact routes round people and the van's body).
    for (const n of r.medics) {
      if (!n.goal || (n.scale ?? 1) <= .01) continue;
      const x0 = n.x, y0 = n.y;
      const speed = r.carried ? 2.8 : 2.2, gx = n.goal.x - n.x, gy = n.goal.y - n.y, gd = Math.hypot(gx, gy);
      // Close behind a slot that keeps moving: straight to it when nothing is in between, smooth, no path search.
      // Held up too long (no route past a tree, the crowd, the other medic): straight to the slot, so the rescue never stalls.
      const sliding = (n.blockedMs ?? 0) > RESCUE_STUCK_MS;
      if ((gd < 1.5 && this.hooks.canWalk(n, n.goal) && this.clearOfVan(n.goal, r)) || sliding) {
        const step = Math.min(gd, speed * dt / 1000);
        if (gd > 1e-6) { n.x += gx / gd * step; n.y += gy / gd * step; }
      } else this.stepToward(n, n.goal, speed, dt, this.vanBody(r));
      // Once going straight it keeps on until it gets there (no back and forth with the route search).
      n.blockedMs = gd <= 0.3 ? 0 : sliding ? n.blockedMs : Math.hypot(n.x - x0, n.y - y0) > 0.0002 * dt ? 0 : (n.blockedMs ?? 0) + dt;
      n.moving = Math.hypot(n.x - x0, n.y - y0) > 0.005;
      if (n.moving) n.facing = facingFrom(n.x - x0, n.y - y0) ?? n.facing;
      if (Math.abs(n.x - x0) > 0.005) n.dir = n.x > x0 ? 1 : -1;
    }
  }

  /** The tiles under the parked ambulance's body (not its door side): what the medics walk round. */
  private vanBody(r: NonNullable<StreetService['rescue']>): Footprint | undefined {
    if (!r.van || r.hidden) return undefined;
    return vanBody(r.route.park, r.route.park.y !== r.route.lane);
  }

  /**
   * The ambulance cannot get through: it stops where it is (this is its parking spot now) and the side door is the
   * one the sprite opens (south, facing the camera). If that door has no way to the hero, the other side is used.
   */
  private stopVanHere(r: NonNullable<StreetService['rescue']>, v: Npc): void {
    this.vanStuckMs = 0;
    const p = this.player.pos;
    const body = vanBody({ x: v.x, y: v.y }, false);
    const door = [1, -1].map(k => ({ x: v.x - 0.4, y: v.y + k * DOOR_OUT })).find(q => this.hooks.walkable(q.x, q.y) && !!this.hooks.path(q, p, body));
    if (!door) return;
    r.route.approach.length = 0;
    r.route.park = { x: v.x, y: v.y };
    r.route.door = door;
    v.speed = 0; v.moving = false;
  }

  /** The medics' two places at the ends of the lying hero, facing the way they will carry them. */
  private formation(r: NonNullable<StreetService['rescue']>, heading: WorldPos): [WorldPos, WorldPos] {
    const props = this.hooks.props(), p = this.player.pos;
    const fits = (q: WorldPos) => this.clearOfVan(q, r) && props.every(o => Math.hypot(q.x - o.x, q.y - o.y) >= o.r + .26);
    // Lying against a tree or a wall one end may have no room: the pair turns a little until both ends do.
    const a0 = Math.atan2(heading.y, heading.x) || (r.dir > 0 ? 0 : Math.PI);
    for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI / 2]) {
      const slots = carrySlots(p, { x: Math.cos(a0 + da), y: Math.sin(a0 + da) }, fits);
      if (fits(slots[0]) && fits(slots[1])) return slots;
    }
    // Nowhere round the hero: each medic takes the nearest free ground, never a spot they could not stand on.
    const [a, b] = carrySlots(p, heading, fits);
    const fa = fits(a) ? a : this.freeNear(a.x, a.y);
    let fb = fits(b) ? b : this.freeNear(b.x, b.y);
    if (Math.hypot(fa.x - fb.x, fa.y - fb.y) < MEDIC_GAP) fb = this.freeNear(fb.x + (fb.x - p.x || 0.5), fb.y + (fb.y - p.y));
    return [fa, fb];
  }

  private clearOfVan(q: WorldPos, r: NonNullable<StreetService['rescue']>): boolean {
    const body = this.vanBody(r);
    return this.hooks.walkable(q.x, q.y)
      && (!body || q.x + .25 <= body.x || q.x - .25 >= body.x + body.w || q.y + .25 <= body.y || q.y - .25 >= body.y + body.h);
  }

  /** The fixed lying pose points left on screen: support its head and feet, with room for each medic. */
  private carrySpot(p: WorldPos, index: number): WorldPos {
    if (!this.supportCache || Math.hypot(this.supportCache.x - p.x, this.supportCache.y - p.y) > .05) this.supportCache = { x: p.x, y: p.y, spots: [] };
    const cached = this.supportCache.spots[index];
    if (cached) return cached;
    // Free ground the medic can stand on: never touching the parked van's body (they could not get there).
    const r = this.rescue;
    const firstSpot = index === 1 ? this.carrySpot(p, 0) : null;
    const clear = (q: WorldPos, i: number) => {
      if (!(r ? this.clearOfVan(q, r) : this.hooks.walkable(q.x, q.y)) || this.hooks.props().some(o => Math.hypot(q.x - o.x, q.y - o.y) < o.r + .26)) return false;
      if (firstSpot && Math.hypot(q.x - firstSpot.x, q.y - firstSpot.y) < MEDIC_GAP + .05) return false;
      if (this.npcs.some(n => !n.bike && n.look !== 'medic' && (n.scale ?? 1) > .01 && Math.hypot(q.x - n.x, q.y - n.y) < .85)) return false;
      // A support point must connect to the patient without a wall between their hands.
      return this.hooks.canWalk(p, q);
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
    if (!index) { this.supportCache.spots[0] = first; return first; }
    // The second medic never stands on the first one's spot (two figures as one): the nearest spot a body's width away.
    return this.supportCache.spots[1] = pick(p.x + .55, p.y, (q) => clear(q, 1) && Math.hypot(q.x - first.x, q.y - first.y) >= MEDIC_GAP);
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
    if (this.ms < (this.routeRetry.get(n) ?? 0)) return false;
    let path = this.paths.get(n);
    if (!path || Math.hypot(path.goal.x - goal.x, path.goal.y - goal.y) > 0.05) {
      const people = this.npcs.filter(m => m !== n && !m.bike && !(n === this.player.pos && m.look === 'medic') && (m.scale ?? 1) > .01).map(m => ({ x: m.x, y: m.y, r: (n as Npc).look === 'medic' && m.look === 'medic' ? MEDIC_GAP : .85 }));
      const points = this.hooks.path(n, goal, avoid, people);
      if (!points) { this.routeRetry.set(n, this.ms + 500); return false; }
      path = { goal: { ...goal }, points };
      this.paths.set(n, path);
    }
    const before = { x: n.x, y: n.y };
    this.walkPath(n, path.points, speed * dt / 1000, undefined, (from, to) => this.hooks.canWalk(from, to), yieldFor ?? (to => this.canPass(n as Npc, to)));
    if (Math.hypot(n.x - before.x, n.y - before.y) < .001) {
      // A moving blocker invalidates the route; wait briefly and plan around its new position.
      this.paths.delete(n);
      this.routeRetry.set(n, this.ms + 300);
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

  /** Someone standing in the van's way (the side street most of all): asked to step aside, never driven through. */
  private makeWay(r: NonNullable<StreetService['rescue']>, v: Npc, lead: { gap: number; who?: Npc }): void {
    const n = lead.who, across = (q: WorldPos) => Math.abs(v.axis === 'y' ? q.x - v.x : q.y - v.y);
    // Once given a spot off the van's line they keep it (no new route every frame).
    if (!n || n.id.startsWith('gate:') || lead.gap >= 2.5 || v.speed >= 1 || (n.goal && across(n.goal) >= 1.2)) return;
    const sx = v.axis === 'y' ? 1 : 0, sy = v.axis === 'y' ? 0 : 1;
    const k = (v.axis === 'y' ? n.x - v.x : n.y - v.y) >= 0 ? 1 : -1;
    n.visit = undefined; n.still = true;
    n.goal = this.offRoad(this.spotAround(n, sx * k * 1.6, sy * k * 1.6));
    if (!r.crowd.includes(n) && !r.yielding.includes(n)) r.yielding.push(n);
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
    // Passers-by on foot walk through freely: the guard lifts the boom as they come and lets it down behind them.
    {
      const lanesNow = this.config.bikeLanes, top = lanesNow[0]! - 1.2, bottom = lanesNow[lanesNow.length - 1]! + 1.2;
      for (const g of this.gates()) for (const n of this.npcs) {
        if (n.bike || n.look === 'medic' || n.id.startsWith('gate:') || (n.scale ?? 1) <= .01 || n.y < top || n.y > bottom) continue;
        const before = (g.x - n.x) * n.dir;
        if (before > -1.2 && before < 2.8) this.gateHold[g.id] = this.ms + 500;
      }
    }
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
        // …and the guard hurls a slipper that always finds them.
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
      if (at(1500)) {
        guard.say = { text: L!.throw, ms: 1400 };
        ko(L!.slipperFaint, 2, 'slipper');
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
    const lanes = this.config.bikeLanes;
    const underBoom = this.player.pos.y > lanes[0]! - 0.7 && this.player.pos.y < lanes[lanes.length - 1]! + 0.7;
    this.gateRun = { gate: g, stage: 'walk', ms: 0, how: underBoom ? 'slam' : 'bike', arrived: null, bike: null, landing: null };
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
    // Crowds keep off the walls (nobody stands with their nose to a house): first with room all round, then anywhere free.
    for (const wall of personalSpace ? [0.9, 0] : [0]) for (let r = 0; r <= (personalSpace ? 3 : 1.5); r += 0.5) for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a * Math.PI) / 4) * r, py = y + Math.sin((a * Math.PI) / 4) * r;
      if (wall && ![[wall, 0], [-wall, 0], [0, wall], [0, -wall]].every(([dx, dy]) => this.hooks.walkable(px + dx!, py + dy!))) { if (r === 0) break; continue; }
      if ((!personalSpace || !this.rescue || Math.hypot(px - this.rescue.route.door.x, py - this.rescue.route.door.y) >= 1.6) && this.hooks.walkable(px, py) && this.hooks.props().every(o => Math.hypot(px - o.x, py - o.y) >= o.r + .26) && (!personalSpace || this.npcs.every(n => n.bike || (Math.hypot(px - n.x, py - n.y) >= .75 && (!n.goal || Math.hypot(px - n.goal.x, py - n.goal.y) >= .85))))) return { x: px, y: py };
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
    if (n.decor) {
      // Back-street bikes follow the same model (never into the one ahead); round and round, out one end, in the other.
      if (n.bike) { n.cruise ??= n.speed; this.idmStep(n, VEHICLE_SPECS.bike, n.cruise, this.leaderOf(n, VEHICLE_SPECS.bike.len, true), dt); }
      n.x += n.dir * n.speed * dt / 1000;
      if (n.dir > 0 && n.x > this.size.w + 16) n.x = -16;
      if (n.dir < 0 && n.x < -16) n.x = this.size.w + 16;
      return;
    }
    // Pedestrians keep to the sidewalks: if one ever ends up in the car lanes it steps back to the kerb.
    if (!n.bike && n.look !== 'medic' && !n.cross && this.onRoad(n.y)) {
      const lanesNow = this.config.bikeLanes, top = lanesNow[0]! - 1.5, bottom = lanesNow[lanesNow.length - 1]! + 1.5;
      n.y = n.y - top < bottom - n.y ? top : bottom;
    }
    // The lying hero is handled by personal space and the held detour, never an instant reversal.
    let pace = 1;
    if (n.waitMs > 0) {
      n.waitMs -= dt;
      return;
    }
    if (!n.bike && n.look !== 'medic' && this.crossRoad(n, dt)) return;
    if (!n.bike) {
      // Along their own row of the sidewalk; what stands ahead is passed with room to spare (planned, not brushed past),
      // then back to the row.
      const lanes = this.config.bikeLanes, awayFromRoad = n.y < lanes[0]! ? -1 : 1;
      const standing: Circle[] = [...this.hooks.props().map(o => ({ x: o.x, y: o.y, r: o.r })), ...this.walkEnv.people.filter(o => o !== n && (o as Npc).still).map(o => ({ x: o.x, y: o.y, r: o.r ?? 0.25 }))];
      const row = plannedRow(n, n.dir, n.lane ?? n.y, standing, (x, y) => this.hooks.walkable(x, y) && !this.onRoad(y), awayFromRoad);
      const ex = n.dir, ey = Math.max(-0.7, Math.min(0.7, (row - n.y) * 1.2)), el = Math.hypot(ex, ey);
      const x0 = n.x;
      socialStep(n, { x: ex / el, y: ey / el }, n.speed, this.walkEnv, dt);
      // Walled in for a good while (a dead end): back the other way.
      n.blockedMs = (n.x - x0) * n.dir > 0.0002 * dt ? 0 : (n.blockedMs ?? 0) + dt;
      if (n.blockedMs > 1500) { n.dir = -n.dir; n.blockedMs = 0; }
    }
    // Walkers stroll right past the barriers (they are for vehicles) and turn round a little beyond; the fence, while it stands, turns them back.
    const fenced = this.hooks.limitX() < this.size.w - 1;
    const lo = -2.5, hi = fenced ? this.hooks.limitX() - 0.6 : this.size.w + 2.5;
    if (n.x < lo) { n.x = lo; n.dir = 1; }
    else if (n.x > hi) { n.x = hi; n.dir = -1; }
  }

  /** Now and then a passer-by at the zebra crosses: waits at the kerb for a gap in the traffic, then walks over (cars give way to anyone on the road). True while this walker's move is handled here. */
  private crossRoad(n: Npc, dt: number): boolean {
    const bl = this.config.bikeLanes;
    // The rescue owns the road: a walker mid-crossing gives up (and steps back to the kerb), or the van, traffic and walker wait on each other.
    if (this.rescue && n.cross) { n.cross = undefined; return false; }
    if (!n.cross) {
      n.crossCool = (n.crossCool ?? this.random() * 8000) - dt;
      if (n.crossCool > 0 || !this.walking() || this.rescue || n.visit || n.goal || n.detour || n.still || this.onRoad(n.y) || Math.abs(n.x - CROSSWALK.x) > CROSSWALK.half) return false;
      n.crossCool = 25000 + this.random() * 20000;
      if (this.random() < 0.5) return false;
      const rows = this.config.lanes.filter(y => (n.y > bl[0]! ? y < bl[0]! : y > bl[bl.length - 1]!));
      if (!rows.length) return false;
      n.cross = { toY: rows[Math.floor(this.random() * rows.length)]!, ms: 0, go: false };
    }
    const c = n.cross;
    c.ms += dt;
    // Never stuck on the road: after a long time they step back to the kerb (the rule in `move`).
    if (c.ms > 20000 || Math.abs(n.y - c.toY) < 0.3) { if (Math.abs(n.y - c.toY) < 0.3) n.lane = c.toY; n.cross = undefined; return false; }
    const dx = CROSSWALK.x - n.x;
    if (!c.go) {
      // Walk to the crossing, then wait until nothing fast is about to reach it.
      const clear = !this.npcs.some(v => v.traffic && v.speed > 0.4 && (CROSSWALK.x - v.x) * v.dir > -1.5 && (CROSSWALK.x - v.x) * v.dir < 4 + v.speed);
      if (Math.abs(dx) < 0.35 && clear) c.go = true;
      else if (c.ms > 8000 && !this.onRoad(n.y)) { n.cross = undefined; return false; }
      else { socialStep(n, Math.abs(dx) < 0.35 ? { x: 0, y: 0 } : { x: Math.sign(dx), y: 0 }, Math.abs(dx) < 0.35 ? 0 : n.speed, this.walkEnv, dt); return true; }
    }
    const ex = Math.max(-0.3, Math.min(0.3, dx * 0.8)), ey = Math.sign(c.toY - n.y), el = Math.hypot(ex, ey);
    socialStep(n, { x: ex / el, y: ey / el }, n.speed * 1.15, { ...this.walkEnv, kerb: undefined }, dt);
    return true;
  }

  /** Distance to the nearest walker just ahead of `n` in its lane, going the same way, or Infinity. */
  private walkerGap(n: Npc): number {
    let gap = Infinity;
    for (const m of this.npcs) {
      if (m === n || m.bike || m.look === 'medic' || m.still || (m.scale ?? 1) <= .01 || m.dir !== n.dir || Math.abs(m.y - n.y) > .6) continue;
      const d = (m.x - n.x) * n.dir;
      if (d > .1 && d < gap) gap = d;
    }
    return gap;
  }

  /**
   * What a pedestrian steers round: everybody else on foot, tree trunks and parked bikes, the vehicles, the hero.
   * `sidewalk`: the kerbs are walls too (ordinary passers-by; onlookers and medics may step into the road).
   */
  private socialEnv(sidewalk: boolean): SocialEnv {
    const circles: Circle[] = this.hooks.props().map(o => ({ x: o.x, y: o.y, r: o.r }));
    for (const n of this.npcs) {
      if (!n.bike || n.decor || (n.scale ?? 1) <= .01) continue;
      const len = n.look === 'ambulance' ? 1.1 : n.look === 'traffic_car' ? 0.5 : 0, r = n.look === 'ambulance' ? 0.65 : n.look === 'traffic_car' ? 0.55 : 0.4;
      for (const k of len ? [-1, 0, 1] : [0]) circles.push(n.axis === 'y' ? { x: n.x, y: n.y + k * len, r } : { x: n.x + k * len, y: n.y, r });
    }
    const p = this.player.pos;
    if (!this.rescue?.hidden) {
      circles.push({ x: p.x, y: p.y, r: 0.3 });
      // Lying, the hero is about a tile long (head to the left on screen).
      if (this.hooks.isDown()) circles.push({ x: p.x - 0.35, y: p.y + 0.35, r: 0.3 });
    }
    const lanes = this.config.bikeLanes;
    return {
      walkable: (x, y) => this.hooks.walkable(x, y),
      people: this.npcs.filter(n => !n.bike && !n.decor && (n.scale ?? 1) > .01),
      circles,
      kerb: sidewalk ? { top: lanes[0]! - 0.6, bottom: lanes[lanes.length - 1]! + 0.6 } : undefined,
    };
  }

  /** Walk to `goal`: the route round walls from the path finder, the steps among people by the social force. */
  private steerTo(n: Npc, goal: WorldPos, v0: number, dt: number, env: SocialEnv): boolean {
    let path = this.paths.get(n);
    if (!path || Math.hypot(path.goal.x - goal.x, path.goal.y - goal.y) > 0.05) {
      path = { goal: { ...goal }, points: this.hooks.path(n, goal) ?? [{ ...goal }] };
      this.paths.set(n, path);
    }
    while (path.points.length > 1 && Math.hypot(path.points[0]!.x - n.x, path.points[0]!.y - n.y) < 0.35) path.points.shift();
    const left = Math.hypot(goal.x - n.x, goal.y - n.y);
    if (left < 0.12) { n.vx = 0; n.vy = 0; return true; }
    const t = path.points[0] ?? goal, d = Math.hypot(t.x - n.x, t.y - n.y) || 1;
    const x0 = n.x, y0 = n.y;
    // Slowing down on arrival, never overshooting.
    socialStep(n, { x: (t.x - n.x) / d, y: (t.y - n.y) / d }, v0 * Math.min(1, left / 0.8 + 0.15), env, dt);
    n.blockedMs = Math.hypot(n.x - x0, n.y - y0) > 0.0002 * dt ? 0 : (n.blockedMs ?? 0) + dt;
    if (n.blockedMs > 1500) { this.paths.delete(n); n.blockedMs = 0; }
    return false;
  }

  /** Where the onlookers can watch from: rings round the hero with a clear view, off the ambulance's way, not nose to a wall. */
  private watchSlots(rows: number[]): ReturnType<typeof viewingSlots> {
    const r = this.rescue!, p = this.player.pos, lane = r.route.lane, door = r.route.door, park = r.route.park;
    const props = this.hooks.props(), walk = (x: number, y: number) => this.hooks.walkable(x, y);
    const away = p.y >= lane ? 1 : -1;
    const valid = (q: WorldPos) => walk(q.x, q.y) && !this.onRoad(q.y)
      && [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].every(([dx, dy]) => walk(q.x + dx!, q.y + dy!))
      && props.every(o => Math.hypot(q.x - o.x, q.y - o.y) >= o.r + 0.35)
      && !(Math.abs(q.y - lane) < 1.3 && Math.abs(q.x - park.x) < 4)
      && toSegment(q, p, door) > 0.9 && Math.hypot(q.x - door.x, q.y - door.y) > 1.6
      && lineOfSight(q, p, walk, props);
    // Rather on the side away from the traffic, and where the face can be seen (the head lies to the screen's left).
    const head = Math.atan2(1, -1);
    // A shoulder's width and a bit between neighbours: a crowd, not a heap.
    return viewingSlots(p, rows, 1.0, valid, (q, a) => ((q.y - lane) * away > 0 ? 0 : 1.5) + 0.3 * (1 - Math.cos(a - head)));
  }

  /** Send these people to watch from the given rings (each to their own spot). */
  private gather(people: Npc[], rows: number[]): void {
    const slots = assignSlots(people, this.watchSlots(rows));
    for (const n of people) {
      const s = slots.get(n);
      n.visit = undefined; n.still = true; n.watch = true;
      // Standing in a crowd people keep a little more room round them than when walking past each other.
      n.r = Math.max(n.r ?? 0.25, 0.32);
      const goal = s ? { x: s.x, y: s.y } : this.spotAround(this.player.pos, n.x - this.player.pos.x, n.y - this.player.pos.y);
      n.goal = this.onRoad(this.player.pos.y) ? goal : this.offRoad(goal);
    }
  }

  /**
   * The free gap and speed of whatever is nearest ahead of `v` on its lane (traffic vehicles, people, the hero):
   * the same leader the traffic model uses, for the ambulance and the back street's bikes.
   */
  private leaderOf(v: Npc, len: number, decor: boolean): { gap: number; v: number; who?: Npc } {
    let best: { gap: number; v: number; who?: Npc } = { gap: Infinity, v: 0 };
    const p = this.player.pos;
    // Along the way it is heading: up or down a side street that is y, not x.
    const alongY = v.axis === 'y';
    const consider = (x: number, y: number, half: number, speed: number, reach: number, who?: Npc) => {
      const d = (alongY ? y - v.y : x - v.x) * v.dir;
      if (d <= 0 || Math.abs(alongY ? x - v.x : y - v.y) > reach) return;
      const gap = d - len / 2 - half;
      if (gap < best.gap) best = { gap, v: speed, who };
    };
    for (const m of this.npcs) {
      if (m === v || (m.scale ?? 1) <= .01) continue;
      if (decor) { if (m.decor && m.bike && m.dir === v.dir) consider(m.x, m.y, 0.45, m.speed, 0.6); continue; }
      if (m.traffic) consider(m.x, m.y, VEHICLE_SPECS[m.traffic.kind].len / 2, m.dir === v.dir ? m.speed : 0, 0.8);
      // People: on the road, and anywhere in a side street the van drives into.
      else if (!m.bike && !m.decor && (alongY || this.onRoad(m.y))) consider(m.x, m.y, 0.3, 0, 0.85, m);
    }
    if (!decor && !this.rescue?.carried && !this.hooks.isDown()) consider(p.x, p.y, 0.3, 0, 0.85);
    return best;
  }

  /** One IDM step for a vehicle outside the traffic model: accelerate/brake to `leader`, never into it. */
  private idmStep(v: Npc, spec: typeof AMBULANCE_SPEC, v0: number, lead: { gap: number; v: number }, dt: number): void {
    const s = dt / 1000, a = Math.max(-3 * spec.b, Math.min(spec.a, Traffic.idm(spec, v.speed, Math.max(v0, 0.01), lead.gap, lead.v)));
    v.speed = Math.max(0, Math.min(v0 * 1.05 + 0.01, v.speed + a * s));
    const room = Math.max(0, lead.gap - 0.05 + lead.v * s);
    if (v.speed * s > room) v.speed = room / Math.max(s, 1e-6);
  }

  /** A spot moved to the nearest kerb if it is in the road: an onlooker left standing there stops the traffic, which then stops the van. */
  private offRoad(g: WorldPos): WorldPos {
    if (!this.onRoad(g.y)) return g;
    const lanes = this.config.bikeLanes, top = lanes[0]! - 1.5, bottom = lanes[lanes.length - 1]! + 1.5;
    return { x: g.x, y: g.y - top < bottom - g.y ? top : bottom };
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
    let wall = false;
    for (const o of this.hooks.props()) {
      const previous = best;
      consider(o.x, o.y, false);
      if (best < previous) wall = true;
    }
    // Something solid ahead (a stall, a parked car, a tree) is stepped round like a person.
    for (const d of [0.4, 0.8]) if (d < best && !this.footing(n.x + n.dir * d, n.y)) { best = d; block = { x: n.x + n.dir * d, y: n.y, hero: false }; wall = true; break; }
    const b = block as { x: number; y: number; hero: boolean } | null;
    if (wall && this.beginDetour(n)) return 0;
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
    const free = (y: number) => Math.abs(y - lane) < 1.1 && (y < roadTop - 1.0 || y > roadBottom + 1.0 || (n.y > roadTop && n.y < roadBottom)) && this.canPass(n, { x: n.x, y });
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
    else if (this.ms >= (n.dodgeUntil ?? 0) && free(n.y - step)) { n.dodge = -n.dodge; n.dodgeUntil = this.ms + 1000; n.y -= step; }
    else stepped = false;
    if (!stepped) {
      // No way round: turn back instead of eventually walking through whoever blocks the lane.
      if (wall) { n.dir = -n.dir; return 1; }
      if ((n.stuckMs = (n.stuckMs ?? 0) + dt) > 900) { n.dir = -n.dir; n.stuckMs = 0; return 1; }
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

  /** Commit to a sidewalk route past a static obstacle instead of reversing every tick. */
  private beginDetour(n: Npc): boolean {
    if (n.detour) return true;
    for (const dir of [n.dir, -n.dir]) for (const distance of [3, 5, 7]) {
      const goal = { x: n.x + dir * distance, y: n.lane ?? n.y };
      if (goal.x < 1.3 || goal.x > this.size.w - 1.3 || !this.footing(goal.x, goal.y)) continue;
      const points = this.hooks.path(n, goal);
      if (!points?.length || points.some(p => this.onRoad(p.y))) continue;
      n.detour = { goal, dir, ms: 0, blockedMs: 0 };
      n.dir = dir;
      this.paths.set(n, { goal, points });
      return true;
    }
    return false;
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
    if (this.npcs.some(m => m !== n && !m.bike && !(n === this.player.pos && m.look === 'medic') && (m.scale ?? 1) > 0.01 && closer(m, n.look === 'medic' && m.look === 'medic' ? MEDIC_GAP : 0.85))) return false;
    if (this.hooks.props().some(p => closer(p, p.r + 0.26))) return false;
    const r = this.rescue, v = r?.van;
    if (r && v && !r.hidden && !r.route.approach.length) {
      const body = this.vanBody(r)!;
      const distance = (p: WorldPos) => Math.hypot(Math.max(body.x - p.x, 0, p.x - body.x - body.w), Math.max(body.y - p.y, 0, p.y - body.y - body.h));
      if (distance(to) < 0.25 && distance(to) < distance(n) - 1e-6) return false;
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
    // BÙM: the bike rebounds and stops in front of the hero instead of riding through them.
    const p = this.player.pos;
    n.x = p.x - n.dir * 1.1;
    n.waitMs = 1200;
    n.skidMs = 0;
    n.say = { text: 'BÙM!', ms: 900 };
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

  get rescueRoute(): RescueRoute | null { return this.rescue?.route ?? null; }

  view(): StreetView {
    const t = this.talk;
    const rescue = this.rescue;
    return {
      npcs: this.npcs.map((n) => ({ id: n.id, look: n.look, x: n.x, y: n.y, dir: n.dir, moving: !!n.moving, bike: n.bike, say: n.say?.text ?? null, scale: n.scale ?? 1, skid: !!n.skidMs, tilt: n.tilt ?? 0, axis: n.axis ?? 'x', facing: n.facing,
        // The art has the sliding door on the side facing the camera: opened only when the real door is that side (south);
        // a westbound van's door (north, the kerb) is out of sight behind its body, so the visible side stays shut.
        doorOpen: !!rescue && n === rescue.van && !rescue.hidden && !rescue.route.approach.length && rescue.ms >= 6900 && (rescue.route.park.y !== rescue.route.lane ? rescue.route.door.x > rescue.route.park.x : rescue.route.door.y > rescue.route.park.y),
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
