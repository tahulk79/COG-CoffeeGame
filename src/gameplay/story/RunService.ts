import type { Actor } from '../../entities/Actor';
import type { NavGrid } from '../../systems/navigation/NavGrid';
import type { WorldPos } from '../../utils/tile';
import { worldToTile } from '../../utils/tile';

/**
 * Chapter 1 survival run on a Hanoi street: the player moves with direct
 * control (keys / joystick / click-to-move) while absurd street hazards keep
 * coming, each telegraphed before it can hurt. Touching one is death: the
 * hazard plays its death (falling into the hole, the dog pounce…) and only
 * then the story shows the ending card. Pure simulation (no Phaser):
 * positions are in tile units, time in ms.
 */
export type HazardKind = 'cat' | 'dog' | 'sinkhole' | 'durian' | 'motorbike' | 'pigeons' | 'banana';

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
}

export interface RunView {
  running: boolean;
  /** Waiting for "tap to start". */
  paused: boolean;
  aliveMs: number;
  dashReadyIn: number;
  /** Dashing right now (a short burst of speed). */
  dashing: boolean;
  hazards: HazardView[];
  /** The death being played (0–1), before the ending card. */
  death: { kind: HazardKind; t: number; x: number; y: number } | null;
}

export interface RunConfig {
  /** Running speed in the run (tiles/s): quicker than everyday walking, so hazards can be outrun. */
  runSpeed: number;
  dashSpeed: number;
  dashMs: number;
  dashCooldownMs: number;
  /** How long the death plays before the ending card. */
  deathMs: number;
  /** Seconds of survival after which each hazard starts to appear. */
  unlockSec: Record<HazardKind, number>;
  /** Spawn interval: from `spawnStartMs` down to `spawnMinMs` over `rampSec`. */
  spawnStartMs: number;
  spawnMinMs: number;
  rampSec: number;
  maxHazards: number;
  /** After this many seconds the street goes mad: two hazards at a time. */
  rushSec: number;
  /** Telegraphs shrink to this share of their length as the run ramps up. */
  minWarnScale: number;
  /** First and last row of the main road, and first and last column of the side street (motorbike lanes). */
  roadRows: [number, number];
  roadCols: [number, number];
}

interface Hazard extends HazardView {
  /** Time spent in the current phase. */
  ms: number;
  warnMs: number;
  activeMs: number;
}

const R = 0.25;
/** Chasers give up when the player gets this far away (tiles), once they have chased a little… */
const LOSE_AT = 12;
const LOSE_AFTER_MS = 2500;
/** …and the same animal waits this long before coming back (ms), so other hazards get their turn. */
const CHASER_REST = 9000;
/** Hit distances (tile units) for the hazards that touch by distance. */
const REACH: Partial<Record<HazardKind, number>> = { cat: 0.4, dog: 0.45, durian: 0.5, banana: 0.3, sinkhole: 0.85 };

export class RunService {
  private hazards: Hazard[] = [];
  private nextId = 1;
  private spawnIn = 2500;
  private aliveMs = 0;
  private dashMs = 0;
  private dashDir = { x: 0, y: 0 };
  private dashCd = 0;
  private steer = { x: 0, y: 0 };
  private death: { kind: HazardKind; ms: number; x: number; y: number } | null = null;
  /** When each chaser may come back (run time, ms). */
  private restUntil: Partial<Record<HazardKind, number>> = {};
  /**
   * Hazards are dealt like cards: every kind comes up once per round before any repeats,
   * so each run meets them all. The run's `fate` is in the deck twice: it is the likeliest
   * death, and a different one each time you play.
   */
  private deck: HazardKind[] = [];
  fate: HazardKind = 'dog';
  running = false;
  /** Waiting for the player's first tap / key ("tap to start"): nothing moves yet. */
  paused = false;

  constructor(
    private readonly config: RunConfig,
    private readonly grid: NavGrid,
    private readonly player: Actor,
    private readonly random: () => number,
    /** Map size, for spawning bikes and pigeons from the edges. */
    private readonly size: { w: number; h: number },
    /** Called once the death has played: the story shows the ending card. */
    private readonly onDeath: (kind: HazardKind, aliveMs: number) => void,
  ) {}

  start(): void {
    this.hazards = [];
    this.aliveMs = 0;
    this.dashMs = 0;
    this.dashCd = 0;
    this.spawnIn = 2500;
    this.death = null;
    this.restUntil = {};
    this.deck = [];
    const kinds = Object.keys(this.config.unlockSec) as HazardKind[];
    this.fate = kinds[Math.floor(this.random() * kinds.length)] ?? 'dog';
    this.running = true;
    this.paused = true;
  }

  /** Ends the run without a death (the story moved on by other means). */
  stop(): void {
    this.running = false;
    this.death = null;
    this.steer = { x: 0, y: 0 };
  }

  /** Direct control, in world (tile) directions; (0,0) lets click-to-move drive. */
  setSteer(x: number, y: number): void {
    const len = Math.hypot(x, y);
    this.steer = len > 1e-3 && this.running ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  get steering(): boolean {
    return this.steer.x !== 0 || this.steer.y !== 0;
  }

  /** A death is playing: no movement at all until the ending card. */
  get dying(): boolean {
    return this.death !== null;
  }

  /** True while the run moves the player itself: path movement must wait. */
  get controlsPlayer(): boolean {
    return this.steering || this.dashMs > 0 || this.death !== null;
  }

  dash(): boolean {
    if (!this.running || this.paused || this.dashCd > 0) return false;
    this.dashDir = this.steering ? { ...this.steer } : facingVector(this.player);
    this.dashMs = this.config.dashMs;
    this.dashCd = this.config.dashCooldownMs;
    return true;
  }

  /** `_walkSpeed` is the everyday speed; the run uses its own `runSpeed`. */
  tick(dt: number, _walkSpeed: number): void {
    const speed = this.config.runSpeed;
    const d = this.death;
    if (d) {
      d.ms += dt;
      if (d.ms >= this.config.deathMs) {
        this.death = null;
        this.onDeath(d.kind, this.aliveMs);
      }
      return;
    }
    if (!this.running || this.paused) return;
    this.aliveMs += dt;
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.movePlayer(dt, speed);
    this.spawn(dt);
    for (const h of this.hazards) {
      this.step(h, dt);
      if (this.death) return;
    }
    this.hazards = this.hazards.filter((h) => h.phase !== 'gone' || h.ms < 400);
  }

  // ── player motion ───────────────────────────────────────────────────────

  private movePlayer(dt: number, speed: number): void {
    if (this.dashMs > 0) {
      this.dashMs -= dt;
      this.moveBy((this.dashDir.x * this.config.dashSpeed * dt) / 1000, (this.dashDir.y * this.config.dashSpeed * dt) / 1000);
      return;
    }
    if (!this.steering) return;
    this.player.clearWaypoints();
    this.player.faceTowards({ x: this.player.pos.x + this.steer.x, y: this.player.pos.y + this.steer.y });
    this.moveBy((this.steer.x * speed * dt) / 1000, (this.steer.y * speed * dt) / 1000);
  }

  /** Moves with wall sliding (each axis separately). */
  private moveBy(dx: number, dy: number): void {
    const p = this.player.pos;
    if (this.free({ x: p.x + dx, y: p.y })) p.x += dx;
    if (this.free({ x: p.x, y: p.y + dy })) p.y += dy;
  }

  private free(p: WorldPos): boolean {
    for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]] as const) if (!this.grid.isWalkable(worldToTile({ x: p.x + ox, y: p.y + oy }))) return false;
    return true;
  }

  // ── hazards ─────────────────────────────────────────────────────────────

  private spawn(dt: number): void {
    this.spawnIn -= dt;
    if (this.spawnIn > 0 || this.hazards.filter((h) => h.phase !== 'gone').length >= this.config.maxHazards) return;
    const c = this.config;
    this.spawnIn = c.spawnStartMs + (c.spawnMinMs - c.spawnStartMs) * this.ramp;
    const n = this.aliveMs / 1000 >= c.rushSec ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const kind = this.deal();
      if (kind) this.add(kind);
    }
  }

  /** 0 → 1 over `rampSec`: everything gets faster and shorter-warned. */
  private get ramp(): number {
    return Math.min(1, this.aliveMs / 1000 / this.config.rampSec);
  }

  /** Next card from the deck that can come now (unlocked, not already out, not resting). */
  private deal(): HazardKind | null {
    const c = this.config, sec = this.aliveMs / 1000;
    const unlocked = (k: HazardKind) => sec >= c.unlockSec[k];
    // One dog, one cat, one hole at a time (counting one still fading out): a pack is not funny, it is unfair.
    const canCome = (k: HazardKind) => unlocked(k) && !((k === 'cat' || k === 'dog' || k === 'sinkhole') && this.hazards.some((h) => h.kind === k)) && (this.restUntil[k] ?? 0) <= this.aliveMs;
    if (!this.deck.some(canCome)) {
      const round = (Object.keys(c.unlockSec) as HazardKind[]).filter(unlocked);
      if (unlocked(this.fate)) round.push(this.fate);
      for (let i = round.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [round[i], round[j]] = [round[j]!, round[i]!]; }
      this.deck.push(...round);
    }
    const i = this.deck.findIndex(canCome);
    return i < 0 ? null : this.deck.splice(i, 1)[0]!;
  }

  private add(kind: HazardKind): void {
    const p = this.player.pos;
    const ahead = this.steering ? this.steer : facingVector(this.player);
    const base = { id: this.nextId++, kind, phase: 'warn' as const, ms: 0, t: 0, dx: 0, dy: 0 };
    const before = this.hazards.length;
    const rnd = (a: number, b: number) => a + this.random() * (b - a);
    switch (kind) {
      case 'cat':
      case 'dog': {
        const a = this.random() * Math.PI * 2;
        const at = this.walkableNear({ x: p.x + Math.cos(a) * 6.5, y: p.y + Math.sin(a) * 6.5 });
        // A short chase each: outrun it or dodge for a few seconds and it gives up.
        if (at && Math.hypot(at.x - p.x, at.y - p.y) > 4) this.hazards.push({ ...base, ...at, warnMs: kind === 'dog' ? 1200 : 1000, activeMs: kind === 'dog' ? 4500 : 6000 });
        break;
      }
      case 'sinkhole': {
        // The road caves in further along where the player is heading: time to swerve.
        const at = this.walkableNear({ x: p.x + ahead.x * 3.5, y: p.y + ahead.y * 3.5 });
        if (at && Math.hypot(at.x - p.x, at.y - p.y) > 2) this.hazards.push({ ...base, ...at, warnMs: 1500, activeMs: 4000 });
        break;
      }
      case 'durian': {
        // Aimed at where you are (a little ahead when running): one step aside is enough.
        const lead = this.steering ? 0.8 : 0;
        this.hazards.push({ ...base, x: p.x + ahead.x * lead + rnd(-0.3, 0.3), y: p.y + ahead.y * lead + rnd(-0.3, 0.3), warnMs: 1400, activeMs: 250 });
        break;
      }
      case 'motorbike': {
        // Along the main road or down the side street, whichever the player is nearer.
        const dir = this.random() < 0.5 ? 1 : -1;
        const [r0, r1] = this.config.roadRows, [c0, c1] = this.config.roadCols;
        const side = Math.abs(p.x - (c0 + c1 + 1) / 2) < Math.abs(p.y - (r0 + r1 + 1) / 2);
        if (side) {
          const col = c0 + Math.floor(this.random() * (c1 - c0 + 1)) + 0.5;
          this.hazards.push({ ...base, x: col, y: dir > 0 ? -3 : this.size.h + 3, dx: 0, dy: dir, warnMs: 1600, activeMs: 8000 });
        } else {
          const row = r0 + Math.floor(this.random() * (r1 - r0 + 1)) + 0.5;
          this.hazards.push({ ...base, x: dir > 0 ? -3 : this.size.w + 3, y: row, dx: dir, dy: 0, warnMs: 1600, activeMs: 8000 });
        }
        break;
      }
      case 'pigeons': {
        const horizontal = this.random() < 0.5;
        const dir = this.random() < 0.5 ? 1 : -1;
        const x = horizontal ? (dir > 0 ? -2 : this.size.w + 2) : p.x;
        const y = horizontal ? p.y : dir > 0 ? -2 : this.size.h + 2;
        this.hazards.push({ ...base, x, y, dx: horizontal ? dir : 0, dy: horizontal ? 0 : dir, warnMs: 1500, activeMs: 6000 });
        break;
      }
      case 'banana': {
        const at = this.walkableNear({ x: p.x + ahead.x * rnd(3, 5) + rnd(-1, 1), y: p.y + ahead.y * rnd(3, 5) + rnd(-1, 1) });
        if (at && Math.hypot(at.x - p.x, at.y - p.y) > 2) this.hazards.push({ ...base, ...at, warnMs: 300, activeMs: 14000 });
        break;
      }
    }
    // Later in the run the telegraphs get shorter.
    const scale = 1 - (1 - this.config.minWarnScale) * this.ramp;
    for (const h of this.hazards.slice(before)) h.warnMs *= scale;
  }

  private walkableNear(p: WorldPos): WorldPos | null {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const t = worldToTile({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
      if (this.grid.inBounds(t) && this.grid.isWalkable(t)) return { x: t.x + 0.5, y: t.y + 0.5 };
    }
    return null;
  }

  private step(h: Hazard, dt: number): void {
    h.ms += dt;
    if (h.phase === 'gone') {
      h.t = Math.min(1, h.ms / 400);
      return;
    }
    if (h.phase === 'warn') {
      h.t = Math.min(1, h.ms / h.warnMs);
      if (h.ms >= h.warnMs) Object.assign(h, { phase: 'active', ms: 0, t: 0 });
      return;
    }
    h.t = Math.min(1, h.ms / h.activeMs);
    const p = this.player.pos;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    const s = dt / 1000;
    switch (h.kind) {
      case 'cat':
        // Clingy but slower than you: you can outrun it, not forget it.
        if (d > 1e-3) {
          h.dx = (p.x - h.x) / d;
          h.dy = (p.y - h.y) / d;
          this.moveHazard(h, h.dx * 2.6 * s, h.dy * 2.6 * s);
        }
        break;
      case 'dog': {
        // Faster than you but turns wide: sidestep or dash at the last moment.
        const want = Math.atan2(p.y - h.y, p.x - h.x);
        let cur = h.dx || h.dy ? Math.atan2(h.dy, h.dx) : want;
        const diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const turn = 2 * s;
        cur += Math.max(-turn, Math.min(turn, diff));
        h.dx = Math.cos(cur);
        h.dy = Math.sin(cur);
        this.moveHazard(h, h.dx * 4.3 * s, h.dy * 4.3 * s);
        break;
      }
      case 'durian':
        if (d < REACH.durian!) return this.hurt('durian', h);
        this.gone(h);
        break;
      case 'motorbike':
        // A little pack of bikes (the lead and two behind it) sweeps the lane.
        h.x += h.dx * 8 * s;
        h.y += h.dy * 8 * s;
        // Lane-relative: across the lane (`side`) and along it (`along`), for each of the three bikes.
        for (const off of [0, -1.3, -2.6]) {
          const side = h.dx ? p.y - h.y : p.x - h.x, along = h.dx ? p.x - (h.x + off * h.dx) : p.y - (h.y + off * h.dy);
          if (Math.abs(side) < 0.5 && Math.abs(along) < 0.6) return this.hurt('motorbike', h);
        }
        if (h.x < -6 || h.x > this.size.w + 6 || h.y < -6 || h.y > this.size.h + 6) this.gone(h);
        break;
      case 'pigeons':
        h.x += h.dx * 9 * s;
        h.y += h.dy * 9 * s;
        if (Math.abs(h.dx ? p.y - h.y : p.x - h.x) < 0.55 && Math.abs(h.dx ? p.x - h.x : p.y - h.y) < 0.8) return this.hurt('pigeons', h);
        if (h.x < -4 || h.y < -4 || h.x > this.size.w + 4 || h.y > this.size.h + 4) this.gone(h);
        break;
    }
    // Left far behind: the animal gives up the chase.
    if ((h.kind === 'cat' || h.kind === 'dog') && h.ms > LOSE_AFTER_MS && d > LOSE_AT) return this.gone(h);
    const reach = REACH[h.kind];
    if (reach !== undefined && h.kind !== 'durian' && d < reach) return this.hurt(h.kind, h);
    if (h.phase === 'active' && h.ms >= h.activeMs) this.gone(h);
  }

  /** Chasers go around walls instead of through them. */
  private moveHazard(h: Hazard, dx: number, dy: number): void {
    if (this.grid.isWalkable(worldToTile({ x: h.x + dx, y: h.y }))) h.x += dx;
    if (this.grid.isWalkable(worldToTile({ x: h.x, y: h.y + dy }))) h.y += dy;
  }

  private gone(h: Hazard): void {
    Object.assign(h, { phase: 'gone', ms: 0, t: 0 });
    if (h.kind === 'cat' || h.kind === 'dog') this.restUntil[h.kind] = this.aliveMs + CHASER_REST;
  }

  /** A touch, unless the player is mid-dash: dashing goes straight through anything. */
  private hurt(kind: HazardKind, h: Hazard): void {
    if (this.dashMs > 0) return;
    this.die(kind, h);
  }

  /** Touch = death: the run stops and the death plays where it happened. */
  private die(kind: HazardKind, h: Hazard): void {
    this.running = false;
    this.steer = { x: 0, y: 0 };
    this.dashMs = 0;
    this.player.clearWaypoints();
    // The cat or dog that caught you jumps on you: it is the one in the scuffle, not a second animal.
    if (kind === 'cat' || kind === 'dog') {
      h.x = this.player.pos.x + 0.05;
      h.y = this.player.pos.y + 0.05;
    }
    // The hole swallows you at its centre; the others where you stood.
    this.death = kind === 'sinkhole' ? { kind, ms: 0, x: h.x, y: h.y } : { kind, ms: 0, x: this.player.pos.x, y: this.player.pos.y };
  }

  view(): RunView {
    const d = this.death;
    return {
      running: this.running,
      paused: this.paused,
      aliveMs: this.aliveMs,
      dashReadyIn: this.dashCd,
      dashing: this.dashMs > 0,
      hazards: this.hazards.map(({ id, kind, phase, x, y, dx, dy, t }) => ({ id, kind, phase, x, y, dx, dy, t })),
      death: d ? { kind: d.kind, t: Math.min(1, d.ms / this.config.deathMs), x: d.x, y: d.y } : null,
    };
  }
}

const FACING_VEC: Record<string, [number, number]> = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
function facingVector(a: Actor): { x: number; y: number } {
  const [x, y] = FACING_VEC[a.facing] ?? [0, 1];
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}
