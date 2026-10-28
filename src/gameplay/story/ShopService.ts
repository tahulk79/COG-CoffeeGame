import type { Line, StallPerson } from './StreetService';

/**
 * Inside a chapter-1 shop: a small room the hero walks into through a door on
 * the street. The seller and the regulars banter in bubbles (the talk plays on
 * its own once the hero comes near the seller, or when the seller is tapped),
 * the player picks one of two replies, and each shop has its own harmless gag.
 * Walking back out of the door returns to the street. Pure simulation, room
 * tile units (0..w × 0..h), ms.
 */
export type ShopEffect = 'sneeze' | 'spotlight' | 'cat';

export interface ShopConfig {
  id: string;
  name: string;
  /** Where the door is on the street (on the north sidewalk, at the house front). */
  door: { x: number; y: number };
  /** Room size in tiles; the exit is on the front edge (y = h) at `exitX`. */
  w: number;
  h: number;
  exitX: number;
  /** Tables, counters, pots: the hero walks round them. `kind` picks the drawing. */
  furniture: Array<{ x: number; y: number; w: number; h: number; kind: string }>;
  /** Everyone inside, in room coordinates; `seller` is the one whose talk counts as the visit. */
  people: Array<StallPerson & { lines?: string[] }>;
  seller: string;
  lines: Line[];
  choices: Array<{ text: string; reply: Line[]; effect?: ShopEffect }>;
  after: Line[];
  /** The shop's gag, played once its talk is over (unless the reply already played one). */
  effect?: ShopEffect;
}

export interface ShopView {
  id: string;
  name: string;
  w: number;
  h: number;
  exitX: number;
  furniture: ShopConfig['furniture'];
  hero: { x: number; y: number; dir: number; moving: boolean };
  npcs: Array<{ id: string; look: string; x: number; y: number; dir: number; say: string | null }>;
  heroSay: string | null;
  choices: string[] | null;
  /** The gag playing (0–1), or null. */
  effect: { kind: ShopEffect; t: number } | null;
}

interface Person {
  id: string;
  look: string;
  x: number;
  y: number;
  dir: number;
  lines: string[];
  say: { text: string; ms: number } | null;
  goal: { x: number; y: number } | null;
}

const SPEED = 3;
const R = 0.25;
/** The hero this close to the seller starts the talk; tapping someone talks to them from this far. */
const TALK_AT = 1.8;
const EFFECT_MS = 2600;

export class ShopService {
  private readonly hero: { x: number; y: number; dir: number };
  private steer = { x: 0, y: 0 };
  private target: { x: number; y: number } | null = null;
  private readonly people: Person[];
  private heroSay: { text: string; ms: number } | null = null;
  private talk: { script: Line[]; index: number; ms: number; choosing: boolean; chosen: boolean; effect: ShopEffect | null } | null = null;
  private effect: { kind: ShopEffect; ms: number } | null = null;
  /** The hero has stepped in off the doormat (walking back onto it leaves). */
  private inside = false;

  constructor(
    readonly config: ShopConfig,
    private visited: boolean,
    private readonly onVisited: (shopId: string) => void,
    private readonly random: () => number,
    private readonly again: string[],
  ) {
    this.hero = { x: config.exitX, y: config.h - 0.6, dir: 1 };
    this.people = config.people.map((p) => ({ id: p.id, look: p.look, x: p.x, y: p.y, dir: p.x < config.w / 2 ? 1 : -1, lines: p.lines ?? [], say: null, goal: null }));
  }

  // ── moving ──────────────────────────────────────────────────────────────

  setSteer(x: number, y: number): void {
    const l = Math.hypot(x, y);
    this.steer = l > 1e-3 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
    if (l > 1e-3) this.target = null;
  }

  get steering(): boolean {
    return this.steer.x !== 0 || this.steer.y !== 0;
  }

  /** Tap on the floor: walk straight there (sliding round furniture). */
  moveTo(x: number, y: number): void {
    this.target = { x: Math.max(0.4, Math.min(this.config.w - 0.4, x)), y: Math.max(0.4, Math.min(this.config.h + 0.2, y)) };
  }

  private free(x: number, y: number): boolean {
    const c = this.config;
    // The front edge is open only at the doorway.
    const atDoor = Math.abs(x - c.exitX) < 0.7;
    if (x < R || x > c.w - R || y < R || y > (atDoor ? c.h + 0.3 : c.h - R)) return false;
    return !c.furniture.some((f) => x > f.x - R && x < f.x + f.w + R && y > f.y - R && y < f.y + f.h + R);
  }

  /** Walking into someone (not away from them) is blocked: the hero goes round people. */
  private bumps(x: number, y: number): boolean {
    const h = this.hero;
    return this.people.some((p) => { const d = Math.hypot(x - p.x, y - p.y); return d < 0.45 && d < Math.hypot(h.x - p.x, h.y - p.y); });
  }

  private walk(dt: number): void {
    let dx = this.steer.x, dy = this.steer.y;
    if (!this.steering && this.target) {
      const tx = this.target.x - this.hero.x, ty = this.target.y - this.hero.y, d = Math.hypot(tx, ty);
      if (d < 0.08) this.target = null;
      else { dx = tx / d; dy = ty / d; }
    }
    if (!dx && !dy) return;
    const s = (SPEED * dt) / 1000, h = this.hero;
    const before = { x: h.x, y: h.y };
    if (this.free(h.x + dx * s, h.y) && !this.bumps(h.x + dx * s, h.y)) h.x += dx * s;
    if (this.free(h.x, h.y + dy * s) && !this.bumps(h.x, h.y + dy * s)) h.y += dy * s;
    // Stuck against a table on the way to a tapped spot: give up rather than push forever.
    if (this.target && h.x === before.x && h.y === before.y) this.target = null;
    if (dx - dy !== 0) h.dir = dx - dy > 0 ? 1 : -1;
  }

  // ── talking ─────────────────────────────────────────────────────────────

  /** Tapped someone inside: the seller starts the talk (or a short line once heard), others say one of theirs. */
  talkTo(id: string): boolean {
    const p = this.people.find((q) => q.id === id);
    if (!p) return false;
    if (Math.hypot(p.x - this.hero.x, p.y - this.hero.y) > TALK_AT + 1.2) {
      // Too far: walk up to them first.
      this.moveTo(p.x + (this.hero.x < p.x ? -0.9 : 0.9), p.y + 0.6);
      return true;
    }
    if (id === this.config.seller) {
      if (!this.visited) this.startTalk();
      else if (!this.talk) p.say = { text: this.pick(this.again), ms: 2200 };
      return true;
    }
    if (p.lines.length) p.say = { text: this.pick(p.lines), ms: 2600 };
    return true;
  }

  private startTalk(): void {
    if (this.talk || this.visited) return;
    this.talk = { script: [...this.config.lines], index: 0, ms: 0, choosing: false, chosen: false, effect: null };
    this.say(this.talk.script[0]!);
  }

  choose(i: number): boolean {
    const t = this.talk, c = t?.choosing ? this.config.choices[i] : undefined;
    if (!t || !c) return false;
    t.choosing = false;
    t.chosen = true;
    t.script = [['hero', c.text], ...c.reply, ...this.config.after];
    t.index = 0;
    t.ms = 0;
    t.effect = c.effect ?? null;
    // A reply with a gag plays it right as the shop reacts.
    if (c.effect) this.effect = { kind: c.effect, ms: 0 };
    this.say(t.script[0]!);
    return true;
  }

  private say([who, text]: Line): void {
    const ms = lineMs(text) + 400;
    if (who === 'hero') this.heroSay = { text, ms };
    else {
      const p = this.people.find((q) => q.id === who);
      if (p) p.say = { text, ms };
    }
  }

  private pick(lines: string[]): string {
    return lines[Math.floor(this.random() * lines.length)] ?? '';
  }

  private tickTalk(dt: number): void {
    const seller = this.people.find((p) => p.id === this.config.seller);
    if (!this.talk && !this.visited && seller && Math.hypot(seller.x - this.hero.x, seller.y - this.hero.y) < TALK_AT) this.startTalk();
    const t = this.talk;
    if (!t || t.choosing) return;
    t.ms += dt;
    if (t.ms < lineMs(t.script[t.index]![1])) return;
    t.ms = 0;
    t.index += 1;
    if (t.index < t.script.length) return this.say(t.script[t.index]!);
    if (!t.chosen && this.config.choices.length) {
      t.choosing = true;
      return;
    }
    // Over: it counts as visiting the shop, and the shop's own gag plays if the reply did not bring one.
    this.talk = null;
    this.visited = true;
    this.onVisited(this.config.id);
    if (!t.effect && this.config.effect) this.effect = { kind: this.config.effect, ms: 0 };
  }

  // ── the gag ─────────────────────────────────────────────────────────────

  private tickEffect(dt: number): void {
    const e = this.effect;
    if (!e) return;
    const prev = e.ms;
    e.ms += dt;
    const at = (ms: number) => prev < ms && e.ms >= ms;
    if (e.kind === 'sneeze' && at(300)) this.heroSay = { text: 'Hắt… hắt… XÌ!!!', ms: 1600 };
    if (e.kind === 'cat') {
      // The shop cat takes the stool next to the hero and will not move.
      const cat = this.people.find((p) => p.look === 'cat');
      if (cat && at(0)) cat.goal = { x: this.hero.x + 0.7, y: this.hero.y };
      if (cat && at(1600)) cat.say = { text: 'Meo.', ms: 1200 };
    }
    if (e.ms >= EFFECT_MS) this.effect = null;
  }

  /** One step; returns true when the hero has walked back out of the door. */
  tick(dt: number): boolean {
    for (const p of this.people) if (p.say && (p.say.ms -= dt) <= 0) p.say = null;
    if (this.heroSay && (this.heroSay.ms -= dt) <= 0) this.heroSay = null;
    this.walk(dt);
    for (const p of this.people) {
      if (!p.goal) continue;
      const dx = p.goal.x - p.x, dy = p.goal.y - p.y, d = Math.hypot(dx, dy), s = (2 * dt) / 1000;
      if (d > s) { p.x += (dx / d) * s; p.y += (dy / d) * s; p.dir = dx - dy >= 0 ? 1 : -1; } else p.goal = null;
    }
    this.tickTalk(dt);
    this.tickEffect(dt);
    const h = this.hero, onMat = h.y > this.config.h - 0.2 && Math.abs(h.x - this.config.exitX) < 0.7;
    if (!onMat) this.inside = true;
    return this.inside && onMat;
  }

  view(): ShopView {
    const c = this.config, h = this.hero, e = this.effect;
    return {
      id: c.id,
      name: c.name,
      w: c.w,
      h: c.h,
      exitX: c.exitX,
      furniture: c.furniture,
      hero: { x: h.x, y: h.y, dir: h.dir, moving: this.steering || !!this.target },
      npcs: this.people.map((p) => ({ id: p.id, look: p.look, x: p.x, y: p.y, dir: p.dir, say: p.say?.text ?? null })),
      heroSay: this.heroSay?.text ?? null,
      choices: this.talk?.choosing ? c.choices.map((x) => x.text) : null,
      effect: e ? { kind: e.kind, t: Math.min(1, e.ms / EFFECT_MS) } : null,
    };
  }
}

/** Time a line stays up: long enough to read it. */
function lineMs(text: string): number {
  return Math.max(1600, 900 + text.length * 45);
}
