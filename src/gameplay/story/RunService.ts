import { hasClearance } from '../../systems/navigation/smoothing';
import type { Actor } from '../../entities/Actor';
import type { NavGrid } from '../../systems/navigation/NavGrid';
import type { WorldPos } from '../../utils/tile';
import { worldToTile } from '../../utils/tile';

/**
 * Chapter 1 on a Hanoi street: a calm stroll, then rush hour. The player moves
 * with direct control (keys / joystick / click-to-move) while absurd street
 * gags keep coming, each telegraphed and most with a twist when dodged (the
 * second banana peel, the manhole next to the hole…). One touch knocks the
 * hero out. The hero lies down, says one last line, and the story
 * moves on. Pure simulation (no Phaser): positions in tile units, time in ms.
 */
export type HazardKind = 'cat' | 'dog' | 'sinkhole' | 'durian' | 'motorbike' | 'pigeons' | 'banana' | 'water' | 'laundry' | 'shuttlecock' | 'slipper' | 'chickens'
  /** Not a gag: the street-end boom coming down on the hero's head (played by the street, never dealt). */
  | 'barrier';

export interface HazardView {
  id: number;
  kind: HazardKind;
  /** `warn`: telegraph only, harmless; `active`: can hit; `gone`: fading out. */
  phase: 'warn' | 'active' | 'gone';
  x: number;
  y: number;
  /** Movement direction (chasers, bikes, pigeons), unit vector or 0. */
  dx: number;
  dy: number;
  /** 0–1 progress through the current phase (telegraph growth, fade). */
  t: number;
  /** The twist of a dodged gag (second peel, manhole, big dog…): drawn a little differently. */
  twist: boolean;
  /** Short bubble over the hazard ("Gâu gâu!", "Nắp cống!"), or null. */
  label: string | null;
  /** Delivery bike: the existing dodge branch has released its chickens. Visual state only. */
  cargoOpen?: boolean;
  /** Chasers really changed position this tick; a blocked animal keeps its idle pose. */
  moving?: boolean;
}

/**
 * The three acts: `stroll` (a calm walk, no hazards, the far end fenced off),
 * `chaos` (rush hour: the gags), `faint` (knocked out).
 */
export type RunPhase = 'stroll' | 'chaos' | 'faint';

export interface RunView {
  running: boolean;
  phase: RunPhase;
  /** Column of the construction fence closing the street during the stroll, or null. */
  fenceX: number | null;
  /** Waiting for "tap to start". */
  paused: boolean;
  aliveMs: number;
  /** Stroll time left before rush hour starts on its own (s), or null outside the stroll. */
  strollLeftSec: number | null;
  hazards: HazardView[];
  /** The gag that got the hero, playing (0–1); then `down`. */
  hit: { kind: HazardKind; t: number; x: number; y: number } | null;
  /** Knocked out, lying on the street (0–1) before the story moves on. */
  down: { t: number; x: number; y: number } | null;
  /** What the hero says (a near miss, the last words), or null. */
  say: string | null;
  /** A harmless gag messing with the hero: `smell` slows, `shorts` swaps the controls. */
  dazed: 'smell' | 'shorts' | null;
}

/** Words for a gag: its bubble, its twist's bubble, and the hero's last line when it knocks them out. */
export interface HazardText {
  /** Ending card / collection text. */
  death: string;
  absurdity: number;
  label?: string;
  twist?: string;
  faint: string;
  /** Durian: said when it lands close but misses. */
  smell?: string;
  /** Pigeons: their bubble when the hero carries bread. */
  bread?: string;
}

export interface RunScript {
  hazards: Partial<Record<HazardKind, HazardText>>;
  visited(stallId: string): boolean;
  /** The street plays a rescue while the hero is down and calls `finishDown` when it is over. */
  rescue?: boolean;
  seen?(kind: HazardKind): number;
  markSeen?(kind: HazardKind): void;
  /** People standing or walking about: the hero walks round them, never through. */
  people?: () => Array<{ x: number; y: number }>;
  /** Small round things standing about (a street tree's trunk, a stack of stools): radius `r`, walked round like people. */
  props?: () => Array<{ x: number; y: number; r: number }>;
}

export interface RunConfig {
  /** Running speed in the run (tiles/s): quicker than everyday walking, so hazards can be outrun. */
  runSpeed: number;
  /** The stroll turns into rush hour after this many seconds, or sooner once `strollVisits` stalls were visited; 0: one act, gags from the start. */
  strollSec: number;
  /** The first gag comes this long after the gags start (ms). */
  firstGagMs?: number;
  strollVisits: number;
  /** The stroll keeps the player west of this column (the fence comes down with the chaos). */
  fenceX: number;
  /** The gag that got the hero plays this long, then the hero lies down for `downMs`. */
  hitMs: number;
  downMs: number;
  /** How long a harmless gag (durian smell, shorts on the head) lasts. */
  dazeMs: number;
  /** Seconds into rush hour after which each gag starts to appear (absent: never dealt, e.g. the chickens). */
  unlockSec: Partial<Record<HazardKind, number>>;
  /** Spawn interval: from `spawnStartMs` down to `spawnMinMs` over `rampSec`. */
  spawnStartMs: number;
  spawnMinMs: number;
  rampSec: number;
  maxHazards: number;
  /** After this many seconds the street goes mad: two hazards at a time. */
  rushSec: number;
  /** Telegraphs shrink to this share of their length as the run ramps up. */
  minWarnScale: number;
  /** First and last row of the main road, and first and last column of a side street, if any (motorbike lanes). */
  roadRows: [number, number];
  roadCols?: [number, number];
}

interface Hazard extends HazardView {
  /** Time spent in the current phase. */
  ms: number;
  warnMs: number;
  activeMs: number;
  /** The hero came close: moving away again counts as a dodge (and brings the twist). */
  near: boolean;
  /** Its twist already came (or it is one). */
  twisted: boolean;
  /** Slipper: where it was thrown from, how far it flies out, and whether it is on its way back. */
  ox: number;
  oy: number;
  reach: number;
  back: boolean;
  /** Pigeons after the hero's bread: they home in. */
  bread: boolean;
}

export const RUN_BODY_RADIUS = 0.25;
const R = RUN_BODY_RADIUS;
/** How close the hero gets to another person (tile units). */
const PERSON_GAP = 0.7;
/** Blocked by the corner of something: a sidestep this long (tiles) round it is taken on its own. */
const CORNER_SLIP = 1;
/** Going round someone or something, the hero keeps to the chosen side this long (ms). */
const SLIDE_HOLD_MS = 400;
/** Chasers give up when the player gets this far away (tiles), once they have chased a little… */
const LOSE_AT = 12;
const LOSE_AFTER_MS = 2500;
/** …and the same animal waits this long before coming back (ms), so other hazards get their turn. */
const CHASER_REST = 9000;
/** Hit distances (tile units) for the hazards that touch by distance. */
const REACH: Partial<Record<HazardKind, number>> = { cat: 0.4, dog: 0.45, chickens: 0.45, durian: 0.5, water: 0.6, laundry: 0.6, banana: 0.3, sinkhole: 0.85, shuttlecock: 0.45, slipper: 0.4 };
const CHASERS: HazardKind[] = ['cat', 'dog', 'chickens'];
/** Water and laundry come from the houses: only near the north sidewalk and the alley. */
const NEAR_HOUSES_Y = 8.4;

export class RunService {
  private hazards: Hazard[] = [];
  private nextId = 1;
  /** Only enabled by the developer review screen; ordinary spawning is suspended. */
  reviewing = false;
  private spawnIn = 2500;
  private aliveMs = 0;
  private steer = { x: 0, y: 0 };
  private hit: { kind: HazardKind; ms: number; x: number; y: number } | null = null;
  private down: { ms: number; x: number; y: number; kind: HazardKind } | null = null;
  private sayText: { text: string; ms: number } | null = null;
  private daze: { kind: 'smell' | 'shorts'; ms: number } | null = null;
  /** The story was told the hero is down (once per run). */
  private reported = false;
  /** When each chaser may come back (run time, ms). */
  private restUntil: Partial<Record<HazardKind, number>> = {};
  /** Hazards are dealt like cards: every kind comes up once per round before any repeats, so each run meets them all. */
  private deck: HazardKind[] = [];
  running = false;
  phase: RunPhase = 'stroll';
  private strollMs = 0;
  private fenced = false;
  /** Which way the hero last stepped round someone (1 / -1), kept while they stay face to face. */
  private slideSide = 1;
  /** Time since the hero last stepped round someone or something (ms). */
  private slideMs = SLIDE_HOLD_MS;
  /** How long the stick has pushed without the hero getting anywhere (ms). */
  private stillMs = 0;
  /** Waiting for the player's first tap / key ("tap to start"): nothing moves yet. */
  paused = false;
  /** A street scene moves the hero itself (the barrier): keys and joystick do nothing meanwhile. */
  held = false;
  /** A knock-out from outside the run (the barrier crash): its last line and how long the hero lies there. */
  private koOverride: { line: string; downMs: number } | null = null;

  constructor(
    private readonly config: RunConfig,
    private readonly grid: NavGrid,
    private readonly player: Actor,
    private readonly random: () => number,
    /** Map size, for spawning bikes and pigeons from the edges. */
    private readonly size: { w: number; h: number },
    /** Called once the hero has lain down: the story moves on. */
    private readonly onDeath: (kind: HazardKind, aliveMs: number) => void,
    private readonly script: RunScript = { hazards: {}, visited: () => false },
  ) {}

  start(): void {
    this.hazards = [];
    this.reviewing = false;
    this.aliveMs = 0;
    this.spawnIn = 2500;
    this.hit = null;
    this.down = null;
    this.sayText = null;
    this.daze = null;
    this.reported = false;
    this.held = false;
    this.koOverride = null;
    this.restUntil = {};
    this.deck = [];
    this.running = true;
    this.paused = true;
    this.phase = 'stroll';
    this.strollMs = 0;
    // One act: the street is open and the gags come from the start (gently at first).
    if (this.config.strollSec <= 0) {
      this.phase = 'chaos';
      this.spawnIn = this.config.firstGagMs ?? 700;
    } else this.setFence(true);
  }

  /** Developer-only caller: a fresh isolated encounter, paused until the player starts. */
  reviewHazard(kind: HazardKind, branch = 'base'): void {
    this.start();
    this.startChaos();
    this.reviewing = true;
    this.player.clearWaypoints();
    this.player.pos = { x: 22.5, y: 7.5 };
    this.player.faceTowards({ x: 23.5, y: 7.5 });
    if (kind === 'chickens' || ((kind === 'banana' || kind === 'sinkhole') && branch === 'twist')) {
      this.add(kind, { x: 25.5, y: 7.5, warnMs: 1200, twist: true });
    } else this.add(kind);
    const h = this.hazards[0];
    if (!h) return;
    h.warnMs = Math.max(1200, h.warnMs);
    if (kind === 'motorbike') Object.assign(h, { x: 17, y: 9.5, dx: 1, dy: 0 });
    if (kind === 'pigeons' || kind === 'shuttlecock') Object.assign(h, { x: 17, y: 7.5, dx: 1, dy: 0 });
    if (kind === 'pigeons' && branch === 'bread') { h.bread = true; h.label = this.script.hazards.pigeons?.bread ?? h.label; }
    if (kind === 'durian' && branch === 'smell') Object.assign(h, { x: 23.5, y: 7.5 });
    if (kind === 'slipper' && branch === 'return') Object.assign(h, { x: 27, y: 7.5, ox: 17, oy: 7.5, dx: -1, dy: 0, back: true, twist: true, label: this.script.hazards.slipper?.twist ?? h.label });
  }

  /** Rush hour: the fence comes down and the hazards start. */
  startChaos(): void {
    if (!this.running || this.phase !== 'stroll') return;
    this.phase = 'chaos';
    // The first gag comes at once: rush hour has to feel like it.
    this.spawnIn = this.config.firstGagMs ?? 700;
    this.setFence(false);
  }

  /** Ends the run without a knock-out (the story moved on by other means). */
  stop(): void {
    this.running = false;
    this.hit = null;
    this.down = null;
    this.steer = { x: 0, y: 0 };
    this.setFence(false);
  }

  /** Column of the construction fence while it stands, or null. */
  get fenceX(): number | null {
    return this.fenced ? this.config.fenceX : null;
  }

  /** The fence is a blocker on the nav grid, so both steering and click-to-move stop at it. */
  private setFence(on: boolean): void {
    if (on === this.fenced) return;
    const f = { x: this.config.fenceX, y: 0, w: 1, h: this.size.h };
    if (on) this.grid.addBlocker(f);
    else this.grid.removeBlocker(f);
    this.fenced = on;
  }

  /** Direct control, in world (tile) directions; (0,0) lets click-to-move drive. */
  setSteer(x: number, y: number): void {
    const len = Math.hypot(x, y);
    this.steer = len > 1e-3 && this.running ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  get steering(): boolean {
    return this.steer.x !== 0 || this.steer.y !== 0;
  }

  /** Knocked out (the gag, lying down): no movement at all until the story moves on. */
  get dying(): boolean {
    return this.hit !== null || this.down !== null;
  }

  /** True while the run moves the player itself: path movement must wait. */
  get controlsPlayer(): boolean {
    return this.steering || this.dying;
  }

  /** `_walkSpeed` is the everyday speed; the run uses its own `runSpeed`. */
  tick(dt: number, _walkSpeed: number): void {
    if (this.sayText && (this.sayText.ms -= dt) <= 0) this.sayText = null;
    if (this.knockOut(dt)) return;
    if (!this.running || this.paused) return;
    if (this.daze && (this.daze.ms -= dt) <= 0) this.daze = null;
    this.movePlayer(dt);
    if (this.phase === 'stroll') {
      this.strollMs += dt;
      if (this.strollMs >= this.config.strollSec * 1000) this.startChaos();
      return;
    }
    // Time alive (the HUD timer, unlocks and the ramp) counts from rush hour.
    this.aliveMs += dt;
    this.spawn(dt);
    for (const h of [...this.hazards]) {
      this.step(h, dt);
      if (this.hit) return;
    }
    this.hazards = this.hazards.filter((h) => h.phase !== 'gone' || h.ms < 400);
  }

  /** Plays the knock-out (gag), then the hero lying down; true while it does. */
  private knockOut(dt: number): boolean {
    const h = this.hit, d = this.down;
    if (h || d) this.drift(dt);
    if (h && (h.ms += dt) >= this.config.hitMs) {
      this.hit = null;
      this.lieDown(h.kind, this.koOverride?.line ?? this.script.hazards[h.kind]?.faint ?? '…');
    }
    // Stays down (the view keeps lying) while the story takes over.
    const downMs = this.koOverride?.downMs ?? this.config.downMs;
    if (d) d.ms = Math.min(downMs, d.ms + dt);
    // With a street rescue, the story moves on when the ambulance is gone (`finishDown`), not after `downMs`.
    if (d && !this.reported && !this.script.rescue) {
      if (d.ms >= downMs) {
        this.reported = true;
        this.onDeath(d.kind, this.aliveMs);
      }
    }
    return this.hit !== null || this.down !== null;
  }

  private lieDown(kind: HazardKind, line: string): void {
    this.down = { ms: 0, x: this.player.pos.x, y: this.player.pos.y, kind };
    this.say(line, Math.min(3000, (this.koOverride?.downMs ?? this.config.downMs) + 1500));
  }

  /**
   * While the hero is knocked out the street does not freeze: the bikes that
   * hit them ride on out of sight, the animal in the scuffle runs off once the
   * hit has played, everything else fades.
   */
  private drift(dt: number): void {
    const s = dt / 1000;
    for (const h of this.hazards) {
      if (h.phase === 'gone') { h.ms += dt; h.t = Math.min(1, h.ms / 400); continue; }
      if (h.kind === 'motorbike' && h.phase === 'active') {
        h.x += h.dx * 8 * s;
        h.y += h.dy * 8 * s;
        if (h.x < -6 || h.x > this.size.w + 6 || h.y < -6 || h.y > this.size.h + 6) this.gone(h);
        continue;
      }
      if (!this.hit) this.gone(h);
    }
    this.hazards = this.hazards.filter((h) => h.phase !== 'gone' || h.ms < 400);
  }

  /** The hero is lying knocked out (the street's rescue can start). */
  get isDown(): boolean {
    return this.down !== null;
  }

  /** The rescue is over (the ambulance is gone): the story moves on. */
  finishDown(): void {
    const d = this.down;
    if (!d || this.reported) return;
    this.reported = true;
    this.onDeath(d.kind, this.aliveMs);
  }

  /** Knocked out by something the street plays (the motorbike past the barrier): like a gag hit, lying longer. */
  crash(kind: HazardKind, line: string, downMs: number): void {
    if (this.dying || this.reviewing) return;
    this.koOverride = { line, downMs };
    const p = this.player.pos;
    this.knock(kind, { ...p } as Hazard);
  }

  private say(text: string, ms: number): void {
    this.sayText = { text, ms };
  }

  // ── player motion ───────────────────────────────────────────────────────

  private movePlayer(dt: number): void {
    if (!this.steering || this.held) return;
    // Shorts over the eyes: left is right. Durian smell: legs like jelly.
    const s = this.daze?.kind === 'shorts' ? -1 : 1;
    const speed = this.config.runSpeed * (this.daze?.kind === 'smell' ? 0.55 : 1);
    const sx = this.steer.x * s, sy = this.steer.y * s;
    this.player.clearWaypoints();
    this.player.faceTowards({ x: this.player.pos.x + sx, y: this.player.pos.y + sy });
    const before = { ...this.player.pos };
    this.moveBy((sx * speed * dt) / 1000, (sy * speed * dt) / 1000);
    const moved = Math.hypot(this.player.pos.x - before.x, this.player.pos.y - before.y) > 0.001;
    // Held against someone for a frame or two while sliding round them: keep walking, no flicking to the standing pose.
    this.stillMs = moved ? 0 : this.stillMs + dt;
    this.slideMs += dt;
    if (moved && this.player.fsm.can('MOVING')) this.player.fsm.transition('MOVING');
    else if (!moved && this.stillMs > 120 && this.player.fsm.is('MOVING')) this.player.fsm.transition(this.player.restState());
  }

  /** Moves the hero, sliding along walls, round people and round the corners of things. */
  private moveBy(dx: number, dy: number): void {
    if (!dx && !dy) return;
    const p = this.player.pos;
    // Pushed into a wall or a stall by a scene (a landing, a crowd): back onto free ground first, or every move would fail.
    if (!hasClearance(this.grid, p, p, R)) {
      const out = this.freeSpot(p);
      if (out) { p.x = out.x; p.y = out.y; }
    }
    const q = this.resolveMove(p, { x: p.x + dx, y: p.y + dy });
    if (q) { p.x = q.x; p.y = q.y; }
  }

  /**
   * Where the hero gets to trying to go from `from` to `to`: straight there, else
   * along a wall (each axis on its own), round a person in the way, or round the
   * corner of a stall or a car a small sidestep clears. Null when truly stuck.
   */
  resolveMove(from: WorldPos, to: WorldPos): WorldPos | null {
    if (this.canMove(from, to)) return { ...to };
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const q = { ...from };
    if (dx && this.canMove(q, { x: q.x + dx, y: q.y })) q.x += dx;
    if (dy && this.canMove(q, { x: q.x, y: q.y + dy })) q.y += dy;
    const slid = Math.hypot(q.x - from.x, q.y - from.y);
    if (slid >= len * 0.5) return q;
    // Face to face with someone: step round their side (the side the stick leans to), a little outwards.
    const o = this.personBlocking(from, to);
    if (o) {
      const ox = from.x - o.x, oy = from.y - o.y, d = Math.hypot(ox, oy) || 1, nx = ox / d, ny = oy / d;
      const tx = -ny, ty = nx;
      // The side the stick leans to first, the other if that one is walled off (a stool against the shop row).
      // Once going round one way it keeps to it for a moment, so nothing flips side to side every frame.
      const lean = tx * dx + ty * dy, first = this.slideMs < SLIDE_HOLD_MS || Math.abs(lean) <= len * 0.2 ? this.slideSide : Math.sign(lean);
      for (const k of [first, -first]) {
        const r = { x: from.x + (tx * k * 0.9 + nx * 0.25) * len, y: from.y + (ty * k * 0.9 + ny * 0.25) * len };
        if (!this.canMove(from, r)) continue;
        this.slideSide = k;
        this.slideMs = 0;
        return r;
      }
      // No way round (a wall on each side, say): after pushing a moment the hero squeezes past a person, never stuck for good.
      if (!o.prop && this.stillMs > 350) {
        for (const t of [to, { x: to.x, y: from.y }, { x: from.x, y: to.y }]) if (hasClearance(this.grid, from, t, R)) return { ...t };
      }
      // Until then stand still rather than shuffle about (the corner step below is for walls).
      return slid > 1e-4 ? q : null;
    }
    // The corner of something: if a sidestep of up to CORNER_SLIP clears the way, slide towards it.
    const alongX = Math.abs(dx) >= Math.abs(dy), minor = alongX ? dy : dx;
    const signs = minor < 0 ? [-1, 1] : [1, -1];
    for (let k = 0.05; k <= CORNER_SLIP + 1e-9; k += 0.05) for (const s of signs) {
      const side = alongX ? { x: from.x, y: from.y + s * k } : { x: from.x + s * k, y: from.y };
      const ahead = alongX ? { x: side.x + Math.sign(dx) * len, y: side.y } : { x: side.x, y: side.y + Math.sign(dy) * len };
      if (!this.canMove(from, side) || !this.canMove(side, ahead)) continue;
      const m = Math.min(len, k);
      return alongX ? { x: from.x, y: from.y + s * m } : { x: from.x + s * m, y: from.y };
    }
    return slid > 1e-4 ? q : null;
  }

  /** Everything round the hero walks round: people, and the small round props (trunks, stools). */
  private obstacles(): Array<{ x: number; y: number; gap: number; prop: boolean }> {
    const people = (this.script.people?.() ?? []).map((o) => ({ x: o.x, y: o.y, gap: PERSON_GAP, prop: false }));
    return [...people, ...(this.script.props?.() ?? []).map((o) => ({ x: o.x, y: o.y, gap: o.r + R, prop: true }))];
  }

  /** The person or prop the move from `from` to `to` walks into, if any. */
  private personBlocking(from: WorldPos, to: WorldPos): { x: number; y: number; prop: boolean } | null {
    let best: { x: number; y: number; prop: boolean } | null = null, bd = Infinity;
    for (const o of this.obstacles()) {
      const d = Math.hypot(to.x - o.x, to.y - o.y);
      if (d < o.gap && d < Math.hypot(from.x - o.x, from.y - o.y) && d - o.gap < bd) { best = o; bd = d - o.gap; }
    }
    return best;
  }

  /** The nearest spot the hero's body fits (no wall, no person), searching outwards. */
  private freeSpot(p: WorldPos): WorldPos | null {
    for (let r = 0.1; r <= 2; r += 0.1) for (let i = 0; i < 16; i++) {
      const q = { x: p.x + Math.cos((i * Math.PI) / 8) * r, y: p.y + Math.sin((i * Math.PI) / 8) * r };
      if (hasClearance(this.grid, q, q, R)) return q;
    }
    return null;
  }

  /** Moving into someone or a prop (closer than touching, and getting closer): blocked. Moving away is always fine. */
  private bumps(from: WorldPos, to: WorldPos): boolean {
    for (const o of this.obstacles()) {
      const d = Math.hypot(to.x - o.x, to.y - o.y);
      if (d < o.gap && d < Math.hypot(from.x - o.x, from.y - o.y)) return true;
    }
    return false;
  }

  canMove(from: WorldPos, to: WorldPos): boolean {
    return hasClearance(this.grid, from, to, R) && !this.bumps(from, to);
  }

  // ── hazards ─────────────────────────────────────────────────────────────

  private spawn(dt: number): void {
    if (this.reviewing) return;
    this.spawnIn -= dt;
    if (this.spawnIn > 0 || this.hazards.filter((h) => h.phase !== 'gone').length >= this.config.maxHazards) return;
    const c = this.config;
    this.spawnIn = c.spawnStartMs + (c.spawnMinMs - c.spawnStartMs) * this.ramp;
    const n = this.aliveMs / 1000 >= c.rushSec ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (this.hazards.filter(h => h.phase !== 'gone').length >= c.maxHazards) break;
      const kind = this.deal();
      if (kind) this.add(kind);
    }
  }

  /** 0 → 1 over `rampSec`: everything gets faster and shorter-warned. */
  private get ramp(): number {
    return Math.min(1, this.aliveMs / 1000 / this.config.rampSec);
  }

  /** Next card from the deck that can come now (unlocked, not already out, not resting, in the right place). */
  private deal(): HazardKind | null {
    const c = this.config, sec = this.aliveMs / 1000;
    const unlocked = (k: HazardKind) => c.unlockSec[k] !== undefined && sec >= c.unlockSec[k]!;
    // One of each animal and one hole at a time (counting one still fading out): a pack is not funny, it is unfair.
    const canCome = (k: HazardKind) =>
      unlocked(k) &&
      !((CHASERS.includes(k) || k === 'sinkhole') && this.hazards.some((h) => h.kind === k)) &&
      (this.restUntil[k] ?? 0) <= this.aliveMs &&
      ((k !== 'water' && k !== 'laundry') || this.player.pos.y < NEAR_HOUSES_Y);
    if (!this.deck.some(canCome)) {
      const round = (Object.keys(c.unlockSec) as HazardKind[]).filter(unlocked);
      for (let i = round.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [round[i], round[j]] = [round[j]!, round[i]!]; }
      this.deck.push(...round.filter(k => !this.deck.includes(k)));
    }
    const eligible = this.deck.filter(canCome);
    const least = Math.min(...eligible.map(k => this.script.seen?.(k) ?? 0));
    const i = this.deck.findIndex(k => canCome(k) && (this.script.seen?.(k) ?? 0) === least);
    return i < 0 ? null : this.deck.splice(i, 1)[0]!;
  }

  private add(kind: HazardKind, at?: WorldPos & { warnMs?: number; twist?: boolean }): boolean {
    if (this.hazards.filter(h => h.phase !== 'gone').length >= this.config.maxHazards) return false;
    const p = this.player.pos;
    const ahead = this.steering ? this.steer : facingVector(this.player);
    const text = this.script.hazards[kind];
    const base = { id: this.nextId++, kind, phase: 'warn' as const, ms: 0, t: 0, dx: 0, dy: 0, twist: !!at?.twist, twisted: !!at?.twist, near: false, label: (at?.twist ? text?.twist : text?.label) ?? null, ox: 0, oy: 0, reach: 0, back: false, bread: false };
    const before = this.hazards.length;
    const rnd = (a: number, b: number) => a + this.random() * (b - a);
    if (at) {
      // A twist: right where the dodge took the hero, with a short warning.
      this.hazards.push({ ...base, x: at.x, y: at.y, warnMs: at.warnMs ?? 400, activeMs: kind === 'chickens' ? 4500 : kind === 'banana' ? 14000 : 4000 });
      this.script.markSeen?.(kind);
      return true;
    }
    switch (kind) {
      case 'cat':
      case 'dog': {
        // Somewhere on the street a fair way off (the street is narrow: try a few directions).
        const a0 = this.random() * Math.PI * 2;
        for (let i = 0; i < 8; i++) {
          const a = a0 + (i * Math.PI) / 4;
          const pos = this.walkableNear({ x: p.x + Math.cos(a) * 6.5, y: p.y + Math.sin(a) * 6.5 });
          if (!pos || Math.hypot(pos.x - p.x, pos.y - p.y) <= 4) continue;
          // A short chase each: outrun it or dodge for a few seconds and it gives up.
          this.hazards.push({ ...base, ...pos, warnMs: kind === 'dog' ? 1700 : 1100, activeMs: kind === 'dog' ? 3600 : 6000 });
          break;
        }
        break;
      }
      case 'sinkhole': {
        // The road caves in further along where the player is heading: time to swerve.
        const pos = this.walkableNear({ x: p.x + ahead.x * 3.5, y: p.y + ahead.y * 3.5 });
        if (pos && Math.hypot(pos.x - p.x, pos.y - p.y) > 2) this.hazards.push({ ...base, ...pos, warnMs: 1500, activeMs: 4000 });
        break;
      }
      case 'durian':
      case 'water':
      case 'laundry': {
        // Aimed at where you are (a little ahead when running): one step aside is enough.
        const lead = this.steering ? 0.8 : 0;
        // Water and laundry fall from the houses: on the north sidewalk.
        const y = kind === 'durian' ? p.y + ahead.y * lead : Math.min(p.y + ahead.y * lead, 7.6);
        const target = { x: p.x + ahead.x * lead + rnd(-0.3, 0.3), y: y + rnd(-0.3, 0.3) };
        const pos = hasClearance(this.grid, target, target, R) ? target : this.walkableNear(target);
        if (pos) this.hazards.push({ ...base, ...pos, warnMs: kind === 'durian' ? 1400 : 1200, activeMs: 250 });
        break;
      }
      case 'motorbike': {
        // Along the main road or down the side street, whichever the player is nearer.
        const dir = this.random() < 0.5 ? 1 : -1;
        const [r0, r1] = this.config.roadRows, [c0, c1] = this.config.roadCols ?? [0, 0];
        const side = !!this.config.roadCols && Math.abs(p.x - (c0 + c1 + 1) / 2) < Math.abs(p.y - (r0 + r1 + 1) / 2);
        if (side) {
          const col = c0 + Math.floor(this.random() * (c1 - c0 + 1)) + 0.5;
          this.hazards.push({ ...base, x: col, y: dir > 0 ? -3 : this.size.h + 3, dx: 0, dy: dir, warnMs: 1600, activeMs: 8000 });
        } else {
          const row = r0 + Math.floor(this.random() * (r1 - r0 + 1)) + 0.5;
          this.hazards.push({ ...base, x: dir > 0 ? -3 : this.size.w + 3, y: row, dx: dir, dy: 0, warnMs: 1600, activeMs: 8000 });
        }
        break;
      }
      case 'pigeons':
      case 'shuttlecock': {
        // Across the hero's row or column, from off screen (pigeons) or a few tiles away (a kid's kick).
        const horizontal = this.random() < 0.5;
        const dir = this.random() < 0.5 ? 1 : -1;
        const far = kind === 'pigeons' ? null : 6;
        const x = horizontal ? (far ? p.x - dir * far : dir > 0 ? -2 : this.size.w + 2) : p.x;
        const y = horizontal ? p.y : far ? p.y - dir * far : dir > 0 ? -2 : this.size.h + 2;
        // Bread in hand (from the bánh mì stall): the pigeons come for it.
        const bread = kind === 'pigeons' && this.script.visited('banh_mi');
        this.hazards.push({ ...base, x, y, dx: horizontal ? dir : 0, dy: horizontal ? 0 : dir, warnMs: kind === 'pigeons' ? 1500 : 800, activeMs: 6000, bread, label: bread ? text?.bread ?? base.label : base.label });
        break;
      }
      case 'slipper': {
        // Thrown in a quarrel nearby: past the hero… and back like a boomerang.
        const a = this.random() * Math.PI * 2;
        const ox = p.x + Math.cos(a) * 5, oy = p.y + Math.sin(a) * 5;
        const d = Math.hypot(p.x - ox, p.y - oy);
        this.hazards.push({ ...base, x: ox, y: oy, ox, oy, dx: (p.x - ox) / d, dy: (p.y - oy) / d, reach: d + 2.5, warnMs: 900, activeMs: 8000 });
        break;
      }
      case 'banana': {
        const pos = this.walkableNear({ x: p.x + ahead.x * rnd(3, 5) + rnd(-1, 1), y: p.y + ahead.y * rnd(3, 5) + rnd(-1, 1) });
        if (pos && Math.hypot(pos.x - p.x, pos.y - p.y) > 2) this.hazards.push({ ...base, ...pos, warnMs: 800, activeMs: 14000 });
        break;
      }
      case 'chickens':
        break;
    }
    if (this.hazards.length > before) this.script.markSeen?.(kind);
    // Later in the run the telegraphs get shorter.
    const scale = 1 - (1 - this.config.minWarnScale) * this.ramp;
    for (const h of this.hazards.slice(before)) h.warnMs = Math.max(600, h.warnMs * scale);
    return this.hazards.length > before;
  }

  private walkableNear(p: WorldPos): WorldPos | null {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const t = worldToTile({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
      if (this.grid.inBounds(t) && hasClearance(this.grid, { x: t.x + .5, y: t.y + .5 }, { x: t.x + .5, y: t.y + .5 }, R)) return { x: t.x + 0.5, y: t.y + 0.5 };
    }
    return null;
  }

  /** Where the hero is heading, `d` tiles on (a walkable tile), for twists. */
  private aheadOfHero(d: number): WorldPos | null {
    const a = this.steering ? this.steer : facingVector(this.player);
    return this.walkableNear({ x: this.player.pos.x + a.x * d, y: this.player.pos.y + a.y * d });
  }

  private step(h: Hazard, dt: number): void {
    h.moving = false;
    h.ms += dt;
    if (h.phase === 'gone') {
      h.t = Math.min(1, h.ms / 400);
      return;
    }
    if (h.phase === 'warn') {
      h.t = Math.min(1, h.ms / h.warnMs);
      if (h.ms >= h.warnMs) {
        Object.assign(h, { phase: 'active', ms: 0, t: 0 });
        // The little yapping dog was only the warning: the big one comes out.
        if (h.kind === 'dog') h.label = this.script.hazards.dog?.twist ?? h.label;
      }
      return;
    }
    h.t = Math.min(1, h.ms / h.activeMs);
    const p = this.player.pos;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    const s = dt / 1000, before = { x: h.x, y: h.y };
    switch (h.kind) {
      case 'cat':
      case 'chickens':
        // Clingy but slower than you: you can outrun them, not forget them.
        if (d > 1e-3) {
          h.dx = (p.x - h.x) / d;
          h.dy = (p.y - h.y) / d;
          const v = h.kind === 'cat' ? 2.6 : 3.2;
          this.moveHazard(h, h.dx * v * s, h.dy * v * s);
        }
        break;
      case 'dog': {
        // Faster than you but turns wide: sidestep at the last moment.
        const want = Math.atan2(p.y - h.y, p.x - h.x);
        let cur = h.dx || h.dy ? Math.atan2(h.dy, h.dx) : want;
        const diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const turn = 2 * s;
        cur += Math.max(-turn, Math.min(turn, diff));
        h.dx = Math.cos(cur);
        h.dy = Math.sin(cur);
        this.moveHazard(h, h.dx * 3.8 * s, h.dy * 3.8 * s);
        break;
      }
      case 'durian':
      case 'water':
      case 'laundry':
        if (d < REACH[h.kind]!) return this.hurt(h.kind, h);
        // A durian landing just next to you: not a hit, but that smell…
        if (h.kind === 'durian' && d < 1.4) this.dazed('smell', this.script.hazards.durian?.smell);
        this.gone(h);
        return;
      case 'motorbike':
        // A little pack of bikes (the lead and two behind it) sweeps the lane.
        h.x += h.dx * 8 * s;
        h.y += h.dy * 8 * s;
        // Lane-relative: across the lane (`side`) and along it (`along`), for each of the three bikes.
        for (const off of [0, -1.3, -2.6]) {
          const from = { x: before.x + off * h.dx, y: before.y + off * h.dy };
          const to = { x: h.x + off * h.dx, y: h.y + off * h.dy };
          if (sweptTouch(p, from, to, .5)) return this.hurt('motorbike', h);
        }
        // Dodged the bikes… but the last one's crate of chickens bursts open right by you.
        if (!h.twisted && (h.dx ? (p.x - h.x) * h.dx < -3.2 : (p.y - h.y) * h.dy < -3.2) && Math.abs(h.dx ? p.y - h.y : p.x - h.x) < 3.5) {
          const at = this.walkableNear({ x: h.x - h.dx * 2.6, y: h.y - h.dy * 2.6 });
          if (at && !this.hazards.some((o) => o.kind === 'chickens') && this.add('chickens', { ...at, warnMs: 500, twist: true })) h.twisted = true;
        }
        if (h.x < -6 || h.x > this.size.w + 6 || h.y < -6 || h.y > this.size.h + 6) this.gone(h);
        break;
      case 'pigeons':
      case 'shuttlecock': {
        const v = h.kind === 'pigeons' ? 9 : 10;
        // After your bread: they bend towards you as they fly.
        if (h.bread && d > 0.5) {
          const k = Math.min(1, 1.6 * s);
          const nx = h.dx + ((p.x - h.x) / d - h.dx) * k, ny = h.dy + ((p.y - h.y) / d - h.dy) * k, l = Math.hypot(nx, ny);
          h.dx = nx / l;
          h.dy = ny / l;
        }
        h.x += h.dx * v * s;
        h.y += h.dy * v * s;
        if (sweptTouch(p, before, h, h.kind === 'shuttlecock' ? REACH.shuttlecock! : .55)) return this.hurt(h.kind, h);
        if (h.x < -4 || h.y < -4 || h.x > this.size.w + 4 || h.y > this.size.h + 4 || (h.kind === 'shuttlecock' && h.ms > 2500)) this.gone(h);
        break;
      }
      case 'slipper': {
        h.x += h.dx * 7 * s;
        h.y += h.dy * 7 * s;
        if (sweptTouch(p, before, h, REACH.slipper!)) return this.hurt('slipper', h);
        const out = Math.hypot(h.x - h.ox, h.y - h.oy);
        if (!h.back && out >= h.reach) {
          // Turns round mid-air and comes back the same way.
          h.back = true;
          h.twist = true;
          h.dx = -h.dx;
          h.dy = -h.dy;
          h.label = this.script.hazards.slipper?.twist ?? h.label;
        } else if (h.back && out < 0.5) this.gone(h);
        break;
      }
    }
    // Banana peels and holes: walking close then away counts as a dodge… and the twist is right there.
    if ((h.kind === 'banana' || h.kind === 'sinkhole') && !h.twisted) {
      if (d < 1.8) h.near = true;
      else if (h.near && d > 2.4) {
        const at = this.aheadOfHero(h.kind === 'banana' ? 1.4 : 1.8);
        if (at && this.add(h.kind, { ...at, warnMs: 600, twist: true })) h.twisted = true;
      }
    }
    // Left far behind: the animals give up the chase.
    if (CHASERS.includes(h.kind) && h.ms > LOSE_AFTER_MS && d > LOSE_AT) return this.gone(h);
    const reach = REACH[h.kind];
    if (reach !== undefined && ['cat', 'dog', 'chickens', 'banana', 'sinkhole'].includes(h.kind) && d < reach) return this.hurt(h.kind, h);
    if (h.phase === 'active' && h.ms >= h.activeMs) this.gone(h);
  }

  /** Chasers go around walls instead of through them. */
  private moveHazard(h: Hazard, dx: number, dy: number): void {
    const x = h.x, y = h.y;
    if (this.grid.isWalkable(worldToTile({ x: h.x + dx, y: h.y }))) h.x += dx;
    if (this.grid.isWalkable(worldToTile({ x: h.x, y: h.y + dy }))) h.y += dy;
    h.moving = Math.hypot(h.x - x, h.y - y) > .001;
  }

  private gone(h: Hazard): void {
    Object.assign(h, { phase: 'gone', ms: 0, t: 0 });
    if (CHASERS.includes(h.kind)) this.restUntil[h.kind] = this.aliveMs + CHASER_REST;
  }

  private dazed(kind: 'smell' | 'shorts', line?: string): void {
    this.daze = { kind, ms: this.config.dazeMs };
    if (line) this.say(line, this.config.dazeMs);
  }

  /** A touch knocks the hero out; laundry only blinds them for a moment. */
  private hurt(kind: HazardKind, h: Hazard): void {
    if (kind === 'laundry') {
      this.gone(h);
      return this.dazed('shorts', this.script.hazards.laundry?.faint);
    }
    this.knock(kind, h);
  }

  /** One touch is enough: the gag plays where it happened, then the hero lies down. */
  private knock(kind: HazardKind, h: Hazard): void {
    this.running = false;
    this.phase = 'faint';
    this.steer = { x: 0, y: 0 };
    this.daze = null;
    this.player.clearWaypoints();
    // The animal that caught you jumps on you: it is the one in the scuffle, not a second one.
    if (CHASERS.includes(kind)) {
      h.x = this.player.pos.x + 0.05;
      h.y = this.player.pos.y + 0.05;
    }
    for (const o of this.hazards) if (o !== h && o.phase !== 'gone') this.gone(o);
    // What hit stays only while it plays a part: the bikes ride on, the animal stays in the scuffle, the hole swallows; the rest is drawn by the hit itself.
    if (this.hazards.includes(h) && !['motorbike', 'sinkhole', ...CHASERS].includes(h.kind)) this.gone(h);
    // The hole swallows you at its centre; the others where you stood.
    this.hit = kind === 'sinkhole' ? { kind, ms: 0, x: h.x, y: h.y } : { kind, ms: 0, x: this.player.pos.x, y: this.player.pos.y };
  }

  view(): RunView {
    const c = this.config, h = this.hit, d = this.down;
    return {
      running: this.running,
      phase: this.phase,
      fenceX: this.fenceX,
      paused: this.paused,
      aliveMs: this.aliveMs,
      strollLeftSec: this.phase === 'stroll' ? Math.max(0, Math.ceil(c.strollSec - this.strollMs / 1000)) : null,
      hazards: this.hazards.map(({ id, kind, phase, x, y, dx, dy, t, twist, label, twisted, moving }) => ({ id, kind, phase, x, y, dx, dy, t, twist, label, ...(kind === 'motorbike' ? { cargoOpen: twisted } : {}), ...(CHASERS.includes(kind) ? { moving: this.running && !!moving } : {}) })),
      hit: h ? { kind: h.kind, t: Math.min(1, h.ms / c.hitMs), x: h.x, y: h.y } : null,
      // Follows the hero: the medics carry them off.
      down: d ? { t: Math.min(1, d.ms / (this.koOverride?.downMs ?? c.downMs)), x: this.player.pos.x, y: this.player.pos.y } : null,
      say: this.sayText?.text ?? null,
      dazed: this.daze?.kind ?? null,
    };
  }
}

const FACING_VEC: Record<string, [number, number]> = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
function facingVector(a: Actor): { x: number; y: number } {
  const [x, y] = FACING_VEC[a.facing] ?? [0, 1];
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}

/** Distance to the whole movement segment, so fast projectiles cannot skip over the hero. */
function sweptTouch(p: WorldPos, from: WorldPos, to: WorldPos, radius: number): boolean {
  const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.y - from.y) * dy) / length2)) : 0;
  return Math.hypot(p.x - from.x - t * dx, p.y - from.y - t * dy) < radius;
}
