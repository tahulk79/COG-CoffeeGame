import type { Actor } from '../../entities/Actor';
import type { NavGrid } from '../../systems/navigation/NavGrid';
import type { WorldPos } from '../../utils/tile';
import { hasClearance } from '../../systems/navigation/smoothing';
import { RUN_BODY_RADIUS, type RunConfig } from './RunService';
import { HeroWalk } from './heroWalk';

/**
 * Chapter 2, the road of rebirth. It opens with the Death God's paperwork: he asks
 * how the hero died, the true answer being the gag that knocked them out in
 * chapter 1 (right or wrong, it is only for laughs), then finds out the hero only
 * fainted and hands over to the coffee spirit. Then a cloud road with five stations. At each one a
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
  /** This question (id) is always asked when the hero arrives from fainting in chapter 1; otherwise one is drawn. */
  afterFaint?: string;
  questions: TrialQuestion[];
}

/** How the Death God tells a chapter-1 knock-out: the reply to pick, his record of it, and his parting quip. */
export interface TrialCause {
  cause: string;
  record: string;
  quip: string;
}

export interface TrialReaperConfig {
  name: string;
  x: number;
  y: number;
  greet: string[];
  ask: string;
  /** `{record}` is replaced by the record of how the hero died. */
  right: string;
  wrong: string;
  twist: string[];
  /** The coffee spirit owning up to the mix-up. */
  spirit: string;
  farewell: string;
  /** Wrong replies (two are drawn). */
  decoys: string[];
  /** Keyed by chapter-1 gag (`HazardKind`). */
  causes: Record<string, TrialCause>;
}

export interface TrialConfig {
  layout?: 'island';
  /** The coffee spirit, after the Death God's talk. */
  intro: string[];
  reaper?: TrialReaperConfig;
  timeoutLine: string;
  karma: { min: number; max: number; high: number; mid: number };
  stations: TrialStationConfig[];
  gate: { name: string; x: number; y: number; advice: { high: string; mid: string; low: string }; ask: string; ready: string; wait: string; readyReply: string; countdown: string[] };
  spin: { title: string; items: string[]; result: number; openMs: number; ms: number; holdMs: number };
}

export type TrialPhase = 'walk' | 'talk' | 'spin' | 'done';
/** Who says a line: the hero, the coffee spirit, the Death God, a station id, the door keeper or the karma book. */
export type TrialSpeaker = 'hero' | 'spirit' | 'reaper' | 'gate' | 'book' | string;
/** Whose face the footer shows. */
export type TrialPortrait = TrialNpc | 'keeper' | 'reaper' | 'hero' | 'book';
export type TrialExpression = 'happy' | 'surprised' | 'apology';

export interface TrialEvent {
  kind: TrialMood | 'clear' | 'lesson' | 'open' | 'tick' | 'land';
  station?: string;
  at: number;
}

export interface TrialView {
  /** Simulation clock shared by the countdown and event effects (not the scene clock). */
  timeMs: number;
  island: boolean;
  phase: TrialPhase;
  stations: Array<{ id: string; name: string; npc: TrialNpc; x: number; y: number; done: boolean; /** Wall x (tiles); `melt` 0 → 1 as it goes. */ wallX: number; melt: number }>;
  gate: { name: string; x: number; y: number };
  /** The Death God at the start of the road, or null. */
  reaper: { name: string; x: number; y: number } | null;
  spirit: WorldPos;
  /** The footer line: who says it (name, portrait), the words, and the replies when it is a question. */
  say: { who: TrialSpeaker; name: string; portrait: TrialPortrait; text: string; mood: TrialMood | null; expression: TrialExpression | null; /** More lines follow before the footer closes. */ more: boolean } | null;
  /** Replies to pick from (the footer's buttons), or null. */
  choices: string[] | null;
  /** Countdown of a silly question, or null. */
  timeLeftMs: number | null;
  timeTotalMs: number;
  karma: number;
  karmaRange: { min: number; max: number };
  karmaLevels: { high: number; mid: number };
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
  /** The chapter-1 gag that knocked the hero out, if known. */
  cause(): string | null;
  /** Stop a tap-to-walk path (someone starts talking). */
  halt(): void;
  enterDoor(): void;
}

interface Line {
  who: TrialSpeaker;
  text: string;
  mood?: TrialMood;
  /** Story beat for the actor's expression, independent of scoring and sound. */
  expression?: TrialExpression;
  /** Shown with the line: the replies to pick from (the line stays until one is picked). */
  choices?: string[];
  /** Runs when the line comes up (an empty text only runs it). */
  run?: () => void;
}

const R = RUN_BODY_RADIUS;
const WALL = 1.6;
const TRIGGER = 1.4;
const MELT_MS = 700;

export class TrialService {
  /** Direct control, shared with chapter 1. */
  private readonly hero = new HeroWalk();
  private timeMs = 0;
  private phase: TrialPhase = 'walk';
  private spirit: WorldPos;
  private queue: Line[] = [];
  private line: Line | null = null;
  /** What the reply on screen answers: a station's question or the door keeper. */
  private asking: 'station' | 'gate' | 'reaper' | null = null;
  /** The Death God's question: which reply is the truth, and the record he reads out. */
  private reaperAnswer: { index: number; cause: TrialCause } | null = null;
  /** The Death God walks off after his farewell (and never shows when the road is resumed), leaving the road to the stations. */
  private reaperLeft = false;
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
    private readonly random: () => number,
  ) {
    this.spirit = { x: player.pos.x - 1.1, y: player.pos.y + 0.5 };
    for (const s of config.stations) {
      // Fresh from fainting on the street: the station asks about it (a passer-by fainting), not a random question.
      const faint = hooks.cause() && s.afterFaint ? s.questions.find((q) => q.id === s.afterFaint) : undefined;
      this.drawn[s.id] = faint ?? s.questions[Math.floor(random() * s.questions.length)]!;
      if (hooks.isDone(s.id)) this.melted[s.id] = MELT_MS;
    }
    if (!config.stations.some((s) => hooks.isDone(s.id))) {
      if (config.reaper) this.reaperTalk(config.reaper);
      else this.show(config.intro.map((text) => ({ who: 'spirit', text })));
    }
    this.reaperLeft = !config.reaper || config.stations.some((s) => hooks.isDone(s.id));
  }

  // ── the Death God's paperwork ───────────────────────────────────────────

  /** "How did you die?": the chapter-1 gag (any one, when started here directly) among two silly decoys. */
  private reaperTalk(r: TrialReaperConfig): void {
    const kinds = Object.keys(r.causes);
    const known = this.hooks.cause();
    const kind = known && r.causes[known] ? known : kinds[Math.floor(this.random() * kinds.length)]!;
    const cause = r.causes[kind]!;
    const pool = [...new Set(r.decoys)].filter((text) => text !== cause.cause);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const decoys = pool.slice(0, 2);
    const index = Math.floor(this.random() * 3);
    const choices = [...decoys];
    choices.splice(index, 0, cause.cause);
    this.reaperAnswer = { index, cause };
    this.show([
      ...r.greet.map((text) => ({ who: 'reaper', text })),
      { who: 'reaper', text: r.ask, choices, run: () => { this.asking = 'reaper'; } },
    ]);
  }

  /** Right or wrong, he reads the record, then finds out the hero only fainted; the coffee spirit takes over. */
  private chooseReaper(i: number): boolean {
    const r = this.config.reaper!, a = this.reaperAnswer!;
    const right = i === a.index;
    this.asking = null;
    this.reaperAnswer = null;
    this.show([
      {
        who: 'reaper', text: (right ? r.right : r.wrong).replace('{record}', a.cause.record), mood: right ? 'right' : 'wrong',
        run: () => { this.events.push({ kind: right ? 'right' : 'wrong', at: this.timeMs }); },
      },
      ...r.twist.map((text) => ({ who: 'reaper', text, mood: 'funny' as const, expression: 'surprised' as const })),
      { who: 'spirit', text: r.spirit, expression: 'apology' },
      ...this.config.intro.map((text) => ({ who: 'spirit', text })),
      { who: 'reaper', text: a.cause.quip },
      { who: 'reaper', text: r.farewell },
      { who: 'reaper', text: '', run: () => { this.reaperLeft = true; } },
    ]);
    return true;
  }

  setSteer(x: number, y: number): void {
    // The hero stands still while someone talks.
    this.hero.set(x, y, !this.busy);
  }

  get steering(): boolean {
    return this.hero.steering;
  }

  get controlsPlayer(): boolean {
    return this.steering;
  }

  get isDoorOpen(): boolean {
    return this.doorOpen;
  }

  /** The portal action may only finish the chapter after the wheel's result has been held. */
  get canEnterDoor(): boolean {
    return this.phase === 'done' && this.doorOpen && this.config.stations.every((s) => this.hooks.isDone(s.id));
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
    // Keep restored positions on the unfinished side too; movement checks prevent crossing during play.
    const p = this.player.pos;
    if (this.config.layout !== 'island' && p.x > this.wallX - R) p.x = this.wallX - R;
    for (const s of this.config.stations) if (this.hooks.isDone(s.id)) this.melted[s.id] = Math.min(MELT_MS, (this.melted[s.id] ?? 0) + dt);
    if (this.timer && this.line?.choices) {
      this.timer.left = Math.max(0, this.timer.left - dt);
      // The island is a story scene: a reading timer must never dismiss its question.
      if (this.timer.left === 0 && this.config.layout !== 'island') this.timeout();
    }
    // A question opened by arrive() gets its full countdown starting next tick.
    if (this.phase === 'walk') this.arrive();
    this.spin();
    this.followSpirit(dt);
    this.events = this.events.filter((e) => this.timeMs - e.at < 1500);
  }

  // ── movement ────────────────────────────────────────────────────────────

  /** Chapter 1's direct control (`HeroWalk`), through this road's collision. */
  private walk(dt: number): void {
    this.hero.step(this.player, dt, this.move.runSpeed, (dx, dy) => this.moveBy(dx, dy));
  }

  /** Straight on, else along the edge of the road (each axis on its own), with chapter 1's body clearance. */
  private moveBy(dx: number, dy: number): void {
    const p = this.player.pos;
    const to = { x: p.x + dx, y: p.y + dy };
    if (this.canMove(p, to)) { p.x = to.x; p.y = to.y; return; }
    if (dx && this.canMove(p, { x: p.x + dx, y: p.y })) p.x += dx;
    if (dy && this.canMove(p, { x: p.x, y: p.y + dy })) p.y += dy;
  }

  /** Keys, joystick and tap-to-walk use the same body clearance and cloud wall. */
  canMove(from: WorldPos, to: WorldPos): boolean {
    return !this.busy && (this.config.layout === 'island' || to.x <= this.wallX - R) && hasClearance(this.grid, from, to, R);
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
    const near = (at: WorldPos) => Math.hypot(this.player.pos.x - at.x, this.player.pos.y - at.y) < 1.8;
    if (s && (this.config.layout === 'island' ? near(s) : x >= s.x + WALL - TRIGGER)) return this.ask(s);
    if (!s && (this.config.layout === 'island' ? near(this.config.gate) : x >= this.config.gate.x - 2.5)) this.gate();
  }

  private ask(station: TrialStationConfig): void {
    if (this.busy || this.current || this.hooks.isDone(station.id)) return;
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
    if (!this.asking || !Number.isInteger(i) || !this.line?.choices?.[i]) return false;
    if (this.asking === 'gate') return this.chooseGate(i);
    if (this.asking === 'reaper') return this.chooseReaper(i);
    const c = this.current, opt = c?.question.options[i];
    if (!c || !opt || this.hooks.isDone(c.station.id)) return false;
    const mood: TrialMood = opt.mood ?? (opt.karma > 0 ? 'right' : opt.karma < 0 ? 'wrong' : 'funny');
    this.answer([
      {
        who: c.station.id, text: opt.reply, mood,
        run: () => { this.events.push({ kind: mood, station: c.station.id, at: this.timeMs }); },
      },
    ], opt.karma);
    return true;
  }

  /** A silly question's countdown ran out: still passes, no karma. */
  private timeout(): void {
    const c = this.current;
    if (this.asking !== 'station' || !c) return;
    this.answer([{
      who: c.station.id, text: this.config.timeoutLine, mood: 'funny',
      run: () => { this.events.push({ kind: 'funny', station: c.station.id, at: this.timeMs }); },
    }]);
  }

  /** The reply and the keeper's answer, then the lesson from the book (the wall melts as it comes up). */
  private answer(lines: Line[], karma = 0): void {
    const c = this.current!;
    this.asking = null;
    this.timer = null;
    this.show([...lines, { who: 'book', text: `Lời nhắn: ${c.question.lesson}`, run: () => this.pass(c.station, c.question, karma) }]);
  }

  private pass(station: TrialStationConfig, question: TrialQuestion, karma: number): void {
    if (this.hooks.isDone(station.id)) return;
    this.hooks.addKarma(karma);
    this.hooks.addLesson(question.id);
    this.hooks.markDone(station.id);
    this.events.push({ kind: 'clear', station: station.id, at: this.timeMs }, { kind: 'lesson', station: station.id, at: this.timeMs });
    this.current = null;
  }

  // ── the door ────────────────────────────────────────────────────────────

  private gate(): void {
    if (this.busy || this.doorOpen || this.current || this.config.stations.some((s) => !this.hooks.isDone(s.id))) return;
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
    const after: Line[] = i === 0 ? [{ who: 'gate', text: g.readyReply, expression: 'happy' }] : g.countdown.map((text) => ({ who: 'gate', text, mood: 'funny' as const }));
    this.show([...after, open]);
    return true;
  }

  private open(): void {
    if (this.doorOpen || this.config.stations.some((s) => !this.hooks.isDone(s.id))) return;
    this.halt();
    this.doorOpen = true;
    this.phase = 'spin';
    this.spinTicks = 0;
    this.spinAt = this.timeMs + this.config.spin.openMs;
    this.events.push({ kind: 'open', at: this.timeMs });
  }

  /** Total ticks of the wheel: three full turns, then on to the result. */
  private get spinTotal(): number {
    const s = this.config.spin;
    return s.items.length * 3 + s.result;
  }

  /** The wheel slows down as it goes (ease-out), lands on the result, holds, then the hero walks through. */
  private spin(): void {
    if (this.spinAt === null || this.phase !== 'spin' || this.timeMs < this.spinAt) return;
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
    this.hero.stop();
    this.player.clearWaypoints();
    this.hooks.halt();
  }

  // ── the coffee spirit ───────────────────────────────────────────────────

  /** Follows the hero; flies over to its own station (the last one) when the hero gets close. */
  private followSpirit(dt: number): void {
    const p = this.player.pos;
    const own = this.config.stations.find((s) => s.npc === 'spirit' && !this.hooks.isDone(s.id) && (this.config.layout === 'island' ? Math.hypot(p.x - s.x, p.y - s.y) < 4 : p.x >= s.x - 4));
    const want = own ? { x: own.x, y: own.y } : { x: p.x - 1.1, y: p.y + 0.5 };
    const k = 1 - Math.exp(-dt / 220);
    this.spirit = { x: this.spirit.x + (want.x - this.spirit.x) * k, y: this.spirit.y + (want.y - this.spirit.y) * k };
  }

  /** The name and the face the footer shows for a speaker. */
  private speaker(who: TrialSpeaker): { name: string; portrait: TrialPortrait } {
    if (who === 'hero') return { name: 'Bạn', portrait: 'hero' };
    if (who === 'spirit') return { name: 'Thần Cà Phê', portrait: 'spirit' };
    if (who === 'reaper') return { name: this.config.reaper?.name ?? '', portrait: 'reaper' };
    if (who === 'gate') return { name: this.config.gate.name, portrait: 'keeper' };
    if (who === 'book') return { name: 'Sổ Phúc Đức', portrait: 'book' };
    const s = this.config.stations.find((st) => st.id === who);
    return s ? { name: s.name, portrait: s.npc } : { name: '', portrait: 'hero' };
  }

  view(): TrialView {
    const c = this.config, s = c.spin, l = this.line;
    return {
      timeMs: this.timeMs,
      island: this.config.layout === 'island',
      phase: this.phase,
      stations: c.stations.map((st) => ({ id: st.id, name: st.name, npc: st.npc, x: st.x, y: st.y, done: this.hooks.isDone(st.id), wallX: st.x + WALL, melt: (this.melted[st.id] ?? 0) / MELT_MS })),
      gate: { name: c.gate.name, x: c.gate.x, y: c.gate.y },
      reaper: c.reaper && !this.reaperLeft ? { name: c.reaper.name, x: c.reaper.x, y: c.reaper.y } : null,
      spirit: { ...this.spirit },
      say: l ? { who: l.who, ...this.speaker(l.who), text: l.text, mood: l.mood ?? null, expression: l.expression ?? null, more: this.queue.some((q) => !!q.text) } : null,
      choices: l?.choices ? [...l.choices] : null,
      timeLeftMs: this.timer && l?.choices ? Math.max(0, this.timer.left) : null,
      timeTotalMs: this.timer?.total ?? 0,
      karma: this.hooks.karma(),
      karmaRange: { min: c.karma.min, max: c.karma.max },
      karmaLevels: { high: c.karma.high, mid: c.karma.mid },
      lessons: this.hooks.lessons(),
      doorOpen: this.doorOpen,
      spin: this.spinAt === null || this.timeMs < this.spinAt ? null : { title: s.title, items: s.items, index: this.spinTicks % s.items.length, landed: this.spinTicks >= this.spinTotal },
      events: this.events.map((e) => ({ ...e })),
    };
  }
}
