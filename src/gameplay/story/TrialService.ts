import type { Actor } from '../../entities/Actor';
import type { NavGrid } from '../../systems/navigation/NavGrid';
import type { WorldPos } from '../../utils/tile';
import { worldToTile } from '../../utils/tile';
import type { RunConfig } from './RunService';

/**
 * Chapter 2, the road of rebirth: a cloud road with five stations. At each one a
 * cloud wall bars the way and its keeper greets the hero, then asks one question
 * (silly, real knowledge, a moral choice, a trap, life advice). Everything said
 * goes in the footer one line at a time: the player taps "Tiếp" (or anywhere)
 * to go on, and picks a reply in the footer when a question is up. The keeper
 * answers with a gag, the lesson goes into the karma book, then the wall melts.
 * Nothing is ever failed: wrong replies only cost karma. At the end the door
 * keeper gives advice by karma, asks "ready?", opens the door and a wheel lands
 * on what the hero is reborn as. Pure simulation: tile units, ms.
 */
export type TrialMood = 'right' | 'wrong' | 'funny';
export type TrialNpc = 'scholar' | 'librarian' | 'scale' | 'spirit';

export interface TrialOption {
  text: string;
  karma: number;
  reply: string;
  /** How the keeper takes it (bell, "SAI" sign, laugh); defaults to the karma's sign. */
  mood?: TrialMood;
}

export interface TrialQuestion {
  id: string;
  prompt: string;
  options: TrialOption[];
  lesson: string;
}

export interface TrialStationConfig {
  id: string;
  name: string;
  npc: TrialNpc;
  type: 'troll' | 'knowledge' | 'ethics' | 'trap' | 'advice';
  x: number;
  y: number;
  /** Said before the question (one tap to go on). */
  greet?: string;
  /** Silly questions run a countdown for fun: running out still passes. */
  timerMs?: number;
  questions: TrialQuestion[];
}

export interface TrialConfig {
  intro: string[];
  timeoutLine: string;
  karma: { min: number; max: number; high: number; mid: number };
  stations: TrialStationConfig[];
  gate: { name: string; x: number; y: number; advice: { high: string; mid: string; low: string }; ask: string; ready: string; wait: string; readyReply: string; countdown: string[] };
  spin: { title: string; items: string[]; result: number; ms: number; holdMs: number };
}

export type TrialPhase = 'walk' | 'talk' | 'spin' | 'done';
/** Who says a line: the hero, the coffee spirit, a station id, the door keeper or the karma book. */
export type TrialSpeaker = 'hero' | 'spirit' | 'gate' | 'book' | string;
/** Whose face the footer shows. */
export type TrialPortrait = TrialNpc | 'keeper' | 'hero' | 'book';

export interface TrialEvent {
  kind: TrialMood | 'clear' | 'lesson' | 'open' | 'tick' | 'land';
  station?: string;
  at: number;
}

export interface TrialView {
  phase: TrialPhase;
  stations: Array<{ id: string; name: string; npc: TrialNpc; x: number; y: number; done: boolean; /** Wall x (tiles); `melt` 0 → 1 as it goes. */ wallX: number; melt: number }>;
  gate: { name: string; x: number; y: number };
  spirit: WorldPos;
  /** The footer line: who says it (name, portrait), the words, and the replies when it is a question. */
  say: { who: TrialSpeaker; name: string; portrait: TrialPortrait; text: string; mood: TrialMood | null; /** More lines follow before the footer closes. */ more: boolean } | null;
  /** Replies to pick from (the footer's buttons), or null. */
  choices: string[] | null;
  /** Countdown of a silly question, or null. */
  timeLeftMs: number | null;
  timeTotalMs: number;
  karma: number;
  karmaRange: { min: number; max: number };
  /** Lessons collected, in order. */
  lessons: string[];
  doorOpen: boolean;
  spin: { title: string; items: string[]; index: number; landed: boolean } | null;
  events: TrialEvent[];
}

/** What the road needs from the story and the save. */
export interface TrialHooks {
  isDone(station: string): boolean;
  markDone(station: string): void;
  karma(): number;
  addKarma(n: number): void;
  lessons(): string[];
  addLesson(questionId: string): void;
  /** Stop a tap-to-walk path (someone starts talking). */
  halt(): void;
  enterDoor(): void;
}

interface Line {
  who: TrialSpeaker;
  text: string;
  mood?: TrialMood;
  /** Shown with the line: the replies to pick from (the line stays until one is picked). */
  choices?: string[];
  /** Runs when the line comes up (an empty text only runs it). */
  run?: () => void;
}

const R = 0.25;
const WALL = 1.6;
const TRIGGER = 1.4;
const MELT_MS = 700;

export class TrialService {
  private steer = { x: 0, y: 0 };
  private timeMs = 0;
  private phase: TrialPhase = 'walk';
  private spirit: WorldPos;
  private queue: Line[] = [];
  private line: Line | null = null;
  /** What the reply on screen answers: a station's question or the door keeper. */
  private asking: 'station' | 'gate' | null = null;
  private current: { station: TrialStationConfig; question: TrialQuestion } | null = null;
  private timer: { left: number; total: number } | null = null;
  private events: TrialEvent[] = [];
  private melted: Record<string, number> = {};
  private readonly drawn: Record<string, TrialQuestion> = {};
  private doorOpen = false;
  private spinAt: number | null = null;
  private spinTicks = 0;

  constructor(
    private readonly grid: NavGrid,
    private readonly player: Actor,
    /** Speed is chapter 1's, so moving feels the same in both chapters. */
    private readonly move: Pick<RunConfig, 'runSpeed'>,
    private readonly config: TrialConfig,
    private readonly hooks: TrialHooks,
    random: () => number,
  ) {
    this.spirit = { x: player.pos.x - 0.8, y: player.pos.y - 0.8 };
    for (const s of config.stations) {
      this.drawn[s.id] = s.questions[Math.floor(random() * s.questions.length)]!;
      if (hooks.isDone(s.id)) this.melted[s.id] = MELT_MS;
    }
    if (!config.stations.some((s) => hooks.isDone(s.id))) this.show(config.intro.map((text) => ({ who: 'spirit', text })));
  }

  setSteer(x: number, y: number): void {
    // The hero stands still while someone talks.
    if (this.busy) x = y = 0;
    const len = Math.hypot(x, y);
    this.steer = len > 1e-3 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  get steering(): boolean {
    return this.steer.x !== 0 || this.steer.y !== 0;
  }

  get controlsPlayer(): boolean {
    return this.steering;
  }

  get isDoorOpen(): boolean {
    return this.doorOpen;
  }

  /** Someone is talking, or the wheel is on: the hero stays put and taps on the world do nothing. */
  get busy(): boolean {
    return this.phase !== 'walk';
  }

  /** Walls of stations not passed yet: the first one bars the road. */
  private get wallX(): number {
    const s = this.config.stations.find((st) => !this.hooks.isDone(st.id));
    return s ? s.x + WALL : Infinity;
  }

  tick(dt: number): void {
    this.timeMs += dt;
    if (this.phase === 'walk') this.walk(dt);
    // Tap-to-walk follows the nav grid, which knows nothing of the walls: hold the hero at the wall.
    const p = this.player.pos;
    if (p.x > this.wallX - R) p.x = this.wallX - R;
    for (const s of this.config.stations) if (this.hooks.isDone(s.id)) this.melted[s.id] = Math.min(MELT_MS, (this.melted[s.id] ?? 0) + dt);
    if (this.phase === 'walk') this.arrive();
    if (this.timer && this.line?.choices && (this.timer.left -= dt) <= 0) this.timeout();
    this.spin();
    this.followSpirit(dt);
    this.events = this.events.filter((e) => this.timeMs - e.at < 1500);
  }

  // ── movement ────────────────────────────────────────────────────────────

  private walk(dt: number): void {
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
    if (p.x > this.wallX - R) return false;
    for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]] as const) if (!this.grid.isWalkable(worldToTile({ x: p.x + ox, y: p.y + oy }))) return false;
    return true;
  }

  // ── the footer: one line at a time ──────────────────────────────────────

  /** Opens the footer on these lines (replacing whatever was said). */
  private show(lines: Line[]): void {
    this.halt();
    this.queue = [...lines];
    this.line = null;
    this.phase = 'talk';
    this.advance();
  }

  /** Brings up the next line (running any steps on the way); none left closes the footer. */
  private advance(): void {
    this.line = null;
    while (!this.line && this.queue.length) {
      const next = this.queue.shift()!;
      next.run?.();
      if (next.text) this.line = next;
    }
    if (!this.line && this.phase === 'talk') this.phase = 'walk';
  }

  /** "Tiếp" (or a tap anywhere): the next line. Does nothing while a reply is waiting to be picked. */
  next(): boolean {
    if (!this.line || this.line.choices) return false;
    this.advance();
    return true;
  }

  // ── stations ────────────────────────────────────────────────────────────

  /** Walking up to a wall starts its keeper's talk; past the last one, the door keeper speaks. */
  private arrive(): void {
    const x = this.player.pos.x;
    const s = this.config.stations.find((st) => !this.hooks.isDone(st.id));
    if (s && x >= s.x + WALL - TRIGGER) return this.ask(s);
    if (!s && x >= this.config.gate.x - 2.5) this.gate();
  }

  private ask(station: TrialStationConfig): void {
    const question = this.drawn[station.id]!;
    this.current = { station, question };
    this.show([
      ...(station.greet ? [{ who: station.id, text: station.greet }] : []),
      {
        who: station.id, text: question.prompt, choices: question.options.map((o) => o.text),
        run: () => { this.asking = 'station'; this.timer = station.timerMs ? { left: station.timerMs, total: station.timerMs } : null; },
      },
    ]);
  }

  /** The player picks reply `i` (a station's question or the door keeper's). */
  choose(i: number): boolean {
    if (!this.line?.choices?.[i]) return false;
    if (this.asking === 'gate') return this.chooseGate(i);
    const c = this.current, opt = c?.question.options[i];
    if (!c || !opt) return false;
    this.hooks.addKarma(opt.karma);
    const mood: TrialMood = opt.mood ?? (opt.karma > 0 ? 'right' : opt.karma < 0 ? 'wrong' : 'funny');
    this.events.push({ kind: mood, station: c.station.id, at: this.timeMs });
    this.answer([{ who: 'hero', text: opt.text }, { who: c.station.id, text: opt.reply, mood }]);
    return true;
  }

  /** A silly question's countdown ran out: still passes, no karma. */
  private timeout(): void {
    const c = this.current!;
    this.events.push({ kind: 'funny', station: c.station.id, at: this.timeMs });
    this.answer([{ who: c.station.id, text: this.config.timeoutLine, mood: 'funny' }]);
  }

  /** The reply and the keeper's answer, then the lesson from the book (the wall melts as it comes up). */
  private answer(lines: Line[]): void {
    const c = this.current!;
    this.asking = null;
    this.timer = null;
    this.show([...lines, { who: 'book', text: `Lời nhắn: ${c.question.lesson}`, run: () => this.pass(c.station, c.question) }]);
  }

  private pass(station: TrialStationConfig, question: TrialQuestion): void {
    this.hooks.markDone(station.id);
    this.hooks.addLesson(question.id);
    this.events.push({ kind: 'clear', station: station.id, at: this.timeMs }, { kind: 'lesson', station: station.id, at: this.timeMs });
    this.current = null;
  }

  // ── the door ────────────────────────────────────────────────────────────

  private gate(): void {
    const g = this.config.gate, k = this.config.karma, karma = this.hooks.karma();
    const advice = karma >= k.high ? g.advice.high : karma >= k.mid ? g.advice.mid : g.advice.low;
    this.show([
      { who: 'gate', text: advice },
      { who: 'gate', text: g.ask, choices: [g.ready, g.wait], run: () => { this.asking = 'gate'; } },
    ]);
  }

  private chooseGate(i: number): boolean {
    const g = this.config.gate;
    this.asking = null;
    const open: Line = { who: 'gate', text: '', run: () => this.open() };
    // "Let me think": she counts down and pushes the hero in anyway.
    const after: Line[] = i === 0 ? [{ who: 'gate', text: g.readyReply }] : g.countdown.map((text) => ({ who: 'gate', text, mood: 'funny' as const }));
    this.show([{ who: 'hero', text: i === 0 ? g.ready : g.wait }, ...after, open]);
    return true;
  }

  private open(): void {
    this.doorOpen = true;
    this.phase = 'spin';
    this.spinAt = this.timeMs;
    this.events.push({ kind: 'open', at: this.timeMs });
  }

  /** Total ticks of the wheel: three full turns, then on to the result. */
  private get spinTotal(): number {
    const s = this.config.spin;
    return s.items.length * 3 + s.result;
  }

  /** The wheel slows down as it goes (ease-out), lands on the result, holds, then the hero walks through. */
  private spin(): void {
    if (this.spinAt === null) return;
    const s = this.config.spin, e = this.timeMs - this.spinAt;
    const k = Math.min(this.spinTotal, Math.floor(this.spinTotal * (1 - Math.sqrt(Math.max(0, 1 - e / s.ms)))));
    if (k > this.spinTicks) {
      this.spinTicks = k;
      this.events.push({ kind: k === this.spinTotal ? 'land' : 'tick', at: this.timeMs });
    }
    if (e >= s.ms + s.holdMs && this.phase === 'spin') {
      this.phase = 'done';
      this.hooks.enterDoor();
    }
  }

  private halt(): void {
    this.steer = { x: 0, y: 0 };
    this.player.clearWaypoints();
    this.hooks.halt();
  }

  // ── the coffee spirit ───────────────────────────────────────────────────

  /** Follows the hero; flies over to its own station (the last one) when the hero gets close. */
  private followSpirit(dt: number): void {
    const p = this.player.pos;
    const own = this.config.stations.find((s) => s.npc === 'spirit' && !this.hooks.isDone(s.id) && p.x >= s.x - 4);
    const want = own ? { x: own.x, y: own.y } : { x: p.x - 0.9, y: p.y - 0.9 };
    const k = 1 - Math.exp(-dt / 220);
    this.spirit = { x: this.spirit.x + (want.x - this.spirit.x) * k, y: this.spirit.y + (want.y - this.spirit.y) * k };
  }

  /** The name and the face the footer shows for a speaker. */
  private speaker(who: TrialSpeaker): { name: string; portrait: TrialPortrait } {
    if (who === 'hero') return { name: 'Bạn', portrait: 'hero' };
    if (who === 'spirit') return { name: 'Thần Cà Phê', portrait: 'spirit' };
    if (who === 'gate') return { name: this.config.gate.name, portrait: 'keeper' };
    if (who === 'book') return { name: 'Sổ Phúc Đức', portrait: 'book' };
    const s = this.config.stations.find((st) => st.id === who);
    return s ? { name: s.name, portrait: s.npc } : { name: '', portrait: 'hero' };
  }

  view(): TrialView {
    const c = this.config, s = c.spin, l = this.line;
    return {
      phase: this.phase,
      stations: c.stations.map((st) => ({ id: st.id, name: st.name, npc: st.npc, x: st.x, y: st.y, done: this.hooks.isDone(st.id), wallX: st.x + WALL, melt: (this.melted[st.id] ?? 0) / MELT_MS })),
      gate: { name: c.gate.name, x: c.gate.x, y: c.gate.y },
      spirit: { ...this.spirit },
      say: l ? { who: l.who, ...this.speaker(l.who), text: l.text, mood: l.mood ?? null, more: this.queue.some((q) => !!q.text) } : null,
      choices: l?.choices ? [...l.choices] : null,
      timeLeftMs: this.timer && l?.choices ? Math.max(0, this.timer.left) : null,
      timeTotalMs: this.timer?.total ?? 0,
      karma: this.hooks.karma(),
      karmaRange: { min: c.karma.min, max: c.karma.max },
      lessons: this.hooks.lessons(),
      doorOpen: this.doorOpen,
      spin: this.spinAt === null ? null : { title: s.title, items: s.items, index: this.spinTicks % s.items.length, landed: this.spinTicks >= this.spinTotal },
      events: this.events.map((e) => ({ ...e })),
    };
  }
}
