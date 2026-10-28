import type { Actor } from '../../entities/Actor';
import type { NavGrid } from '../../systems/navigation/NavGrid';
import type { WorldPos } from '../../utils/tile';
import { worldToTile } from '../../utils/tile';
import type { RunConfig } from './RunService';

/**
 * Chapter 2, the cloud garden of the other world: a calm breather after the
 * street. The player moves with direct control (keys / joystick / click-to-move,
 * dash) and wakes the three sense stones by catching the light sparks around
 * each one; then the heaven door opens and walking into it ends the chapter.
 * A little coffee spirit follows the hero and says what to do in a bubble (no
 * dialogue to click through). Pure simulation: tile units, ms.
 */
export interface GardenSpark {
  id: number;
  stone: string;
  x: number;
  y: number;
  caught: boolean;
}

export interface GardenView {
  sparks: GardenSpark[];
  /** Stones woken so far, in order. */
  lit: string[];
  spirit: { x: number; y: number };
  /** What the spirit is saying, or null. */
  say: string | null;
  dashReadyIn: number;
  dashing: boolean;
  /** Bumped on every caught spark / woken stone (sound and flashes key off it). */
  events: Array<{ kind: 'spark' | 'stone' | 'open'; stone?: string; at: number }>;
}

/** What the garden needs from the story. */
export interface GardenHooks {
  stones: string[];
  isLit(stone: string): boolean;
  light(stone: string): void;
  portalOpen(): boolean;
  enterPortal(): void;
  cherryTaken(): boolean;
  pickCherry(): void;
  /** World position of a map object's footprint centre, or null. */
  centreOf(id: string): WorldPos | null;
}

const R = 0.25;
const CATCH = 0.6;
const SPARKS_PER_STONE = 3;

export class GardenService {
  private sparks: GardenSpark[] = [];
  private steer = { x: 0, y: 0 };
  private dashMs = 0;
  private dashCd = 0;
  private dashDir = { x: 0, y: 0 };
  private timeMs = 0;
  private spirit: WorldPos;
  private sayQueue: Array<{ text: string; ms: number }> = [];
  private say: { text: string; ms: number } | null = null;
  private events: GardenView['events'] = [];
  private announcedOpen = false;
  private entered = false;

  constructor(
    private readonly grid: NavGrid,
    private readonly player: Actor,
    /** Speed and dash are chapter 1's, so moving feels the same in both chapters. */
    private readonly move: Pick<RunConfig, 'runSpeed' | 'dashSpeed' | 'dashMs' | 'dashCooldownMs'>,
    private readonly hooks: GardenHooks,
  ) {
    this.spirit = { x: player.pos.x - 0.8, y: player.pos.y - 0.8 };
    let id = 1;
    for (const stone of hooks.stones) {
      if (hooks.isLit(stone)) continue;
      for (let i = 0; i < SPARKS_PER_STONE; i++) this.sparks.push({ id: id++, stone, x: 0, y: 0, caught: false });
    }
    this.placeSparks();
    const left = hooks.stones.filter((s) => !hooks.isLit(s)).length;
    this.queue(left === 0 ? 'Cổng mở rồi! Chạy vào cổng thôi!' : 'Chào mừng tới thế giới bên kia!', 2600);
    if (left > 0) this.queue('Bắt các đốm sáng quanh 3 viên đá để mở cổng nhé!', 3600);
  }

  private queue(text: string, ms: number): void {
    this.sayQueue.push({ text, ms });
  }

  setSteer(x: number, y: number): void {
    const len = Math.hypot(x, y);
    this.steer = len > 1e-3 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  get steering(): boolean {
    return this.steer.x !== 0 || this.steer.y !== 0;
  }

  get controlsPlayer(): boolean {
    return this.steering || this.dashMs > 0;
  }

  dash(): boolean {
    if (this.dashCd > 0) return false;
    const f = FACING_VEC[this.player.facing] ?? [0, 1];
    const l = Math.hypot(f[0], f[1]);
    this.dashDir = this.steering ? { ...this.steer } : { x: f[0] / l, y: f[1] / l };
    this.dashMs = this.move.dashMs;
    this.dashCd = this.move.dashCooldownMs;
    return true;
  }

  tick(dt: number): void {
    this.timeMs += dt;
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.walk(dt);
    this.placeSparks();
    this.catchSparks();
    this.followSpirit(dt);
    this.talk(dt);
    this.events = this.events.filter((e) => this.timeMs - e.at < 1500);
    const p = this.player.pos;
    // The memory cherry: just run into it.
    const cherry = this.hooks.centreOf('hidden_cherry');
    if (cherry && !this.hooks.cherryTaken() && Math.hypot(p.x - cherry.x, p.y - cherry.y) < 1.1) {
      this.hooks.pickCherry();
      this.queue('Một quả cà phê ký ức! Hạt giống này sẽ có ích đấy.', 2800);
    }
    if (this.hooks.portalOpen()) {
      if (!this.announcedOpen) {
        this.announcedOpen = true;
        this.events.push({ kind: 'open', at: this.timeMs });
        this.sayQueue = [];
        this.say = null;
        this.queue('Cổng mở rồi! Chạy vào cổng thôi!', 4000);
      }
      const door = this.hooks.centreOf('portal');
      if (door && !this.entered && Math.hypot(p.x - door.x, p.y - door.y) < 1.8) {
        this.entered = true;
        this.hooks.enterPortal();
      }
    }
  }

  // ── movement ────────────────────────────────────────────────────────────

  private walk(dt: number): void {
    if (this.dashMs > 0) {
      this.dashMs -= dt;
      this.moveBy((this.dashDir.x * this.move.dashSpeed * dt) / 1000, (this.dashDir.y * this.move.dashSpeed * dt) / 1000);
      return;
    }
    if (!this.steering) return;
    this.player.clearWaypoints();
    this.player.faceTowards({ x: this.player.pos.x + this.steer.x, y: this.player.pos.y + this.steer.y });
    this.moveBy((this.steer.x * this.move.runSpeed * dt) / 1000, (this.steer.y * this.move.runSpeed * dt) / 1000);
  }

  private moveBy(dx: number, dy: number): void {
    const p = this.player.pos;
    if (this.free({ x: p.x + dx, y: p.y })) p.x += dx;
    if (this.free({ x: p.x, y: p.y + dy })) p.y += dy;
  }

  private free(p: WorldPos): boolean {
    for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]] as const) if (!this.grid.isWalkable(worldToTile({ x: p.x + ox, y: p.y + oy }))) return false;
    return true;
  }

  // ── sparks ──────────────────────────────────────────────────────────────

  /**
   * Each stone's sparks move their own way: Hương thơm (aroma) drifts slowly
   * like a scent, Vị giác (taste) hops between spots, Cảm xúc (feeling) circles
   * the stone quickly. All stay on walkable ground near their stone.
   */
  private placeSparks(): void {
    const t = this.timeMs / 1000;
    for (const s of this.sparks) {
      if (s.caught) continue;
      const c = this.hooks.centreOf(s.stone);
      if (!c) continue;
      const k = (s.id % SPARKS_PER_STONE) / SPARKS_PER_STONE;
      let x = c.x, y = c.y;
      if (s.stone === 'stone_sight') {
        x += Math.sin(t * 0.5 + k * 6.28) * 2 + Math.sin(t * 0.23 + k * 3) * 0.6;
        y += Math.cos(t * 0.4 + k * 6.28) * 1.6;
      } else if (s.stone === 'stone_hearing') {
        const hop = Math.floor(t / 1.1 + k * 3);
        const a = ((hop * 7 + s.id * 3) % 8) / 8 * Math.PI * 2;
        x += Math.cos(a) * 2;
        y += Math.sin(a) * 2;
      } else {
        const a = t * 1.6 + k * Math.PI * 2;
        x += Math.cos(a) * 1.8;
        y += Math.sin(a) * 1.8;
      }
      // Stay on the ground (not in the stream or off the map).
      if (this.grid.inBounds(worldToTile({ x, y })) && this.grid.isWalkable(worldToTile({ x, y }))) {
        s.x = x;
        s.y = y;
      } else if (s.x === 0 && s.y === 0) {
        s.x = c.x + 1;
        s.y = c.y + 1;
      }
    }
  }

  private catchSparks(): void {
    const p = this.player.pos;
    for (const s of this.sparks) {
      if (s.caught || Math.hypot(p.x - s.x, p.y - s.y) > CATCH) continue;
      s.caught = true;
      this.events.push({ kind: 'spark', stone: s.stone, at: this.timeMs });
      const left = this.sparks.filter((o) => o.stone === s.stone && !o.caught).length;
      if (left === 0 && !this.hooks.isLit(s.stone)) {
        this.hooks.light(s.stone);
        this.events.push({ kind: 'stone', stone: s.stone, at: this.timeMs });
        const remaining = this.hooks.stones.filter((x) => !this.hooks.isLit(x)).length;
        this.sayQueue = [];
        this.say = null;
        if (remaining > 0) this.queue(`Tuyệt! Còn ${remaining} viên đá nữa.`, 2400);
      }
    }
  }

  // ── the coffee spirit ───────────────────────────────────────────────────

  private followSpirit(dt: number): void {
    const p = this.player.pos;
    const want = { x: p.x - 0.9, y: p.y - 0.9 };
    const k = 1 - Math.exp(-dt / 220);
    this.spirit = { x: this.spirit.x + (want.x - this.spirit.x) * k, y: this.spirit.y + (want.y - this.spirit.y) * k };
  }

  private talk(dt: number): void {
    if (this.say && (this.say.ms -= dt) <= 0) this.say = null;
    if (!this.say && this.sayQueue.length) this.say = { ...this.sayQueue.shift()! };
  }

  view(): GardenView {
    return {
      sparks: this.sparks.map((s) => ({ ...s })),
      lit: this.hooks.stones.filter((s) => this.hooks.isLit(s)),
      spirit: { ...this.spirit },
      say: this.say?.text ?? null,
      dashReadyIn: this.dashCd,
      dashing: this.dashMs > 0,
      events: this.events.map((e) => ({ ...e })),
    };
  }
}

const FACING_VEC: Record<string, [number, number]> = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
