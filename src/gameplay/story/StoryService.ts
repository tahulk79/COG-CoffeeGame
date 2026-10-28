import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { TransactionService } from '../../systems/economy/TransactionService';
import type { GameState } from '../state/GameState';
import type { FinaleKind, FinaleText, HazardKind, HazardText, RunConfig, RunPhase, RunService, RunView } from './RunService';
import type { GardenService, GardenView } from './GardenService';
import type { StallConfig, StreetConfig, StreetService, StreetView } from './StreetService';

export interface StoryChapter {
  map: string;
  next: string;
  title: string;
  objective: string;
  objectiveReady?: string;
  objectiveBrew?: string;
  /** How the screen changes on the way into this chapter: heavenly doors (default) or a burst of light. */
  arrive?: { style: 'doors' | 'light' };
  /** Chapter 1: the objective in rush hour and once knocked out, the line announcing rush hour, and the three act names. */
  objectiveChaos?: string;
  objectiveFaint?: string;
  /** Chapter 1, inside a shop ({name}). */
  objectiveShop?: string;
  chaosAnnounce?: string;
  acts?: string[];
  timeLimitMs?: number;
  intro: string[];
  outro: string[];
  /** Chapter 1: tuning, what each gag and each fate says, the stalls and the street life. */
  run?: RunConfig;
  hazards?: Partial<Record<HazardKind, HazardText>>;
  finales?: Partial<Record<FinaleKind, FinaleText>>;
  stalls?: StallConfig[];
  street?: StreetConfig;
}

/** What killed the hero, for the ending card (null until it happens). */
export interface FateView {
  id: HazardKind | FinaleKind;
  /** 1-based number in the collection ("Cái chết lãng xẹt #3"). */
  number: number;
  death: string;
  absurdity: number;
  aliveSec: number;
}

export interface StoryConfig {
  start: string;
  afterStoryMap: string;
  tutorialScoreFloor: number;
  whiteoutMs: number;
  respawnMasterMs: number;
  cherryReward: { itemId: string; qty: number };
  tutorialItems: Array<{ itemId: string; qty: number; quality: number }>;
  stones: string[];
  stoneLabels: Record<string, string>;
  chapters: Record<string, StoryChapter>;
  masterHint: string[];
}

export type StoryResult = { ok: true } | { ok: false; reason: string; applicable?: boolean };

export interface StoryView {
  /** The current chapter plays on this map. */
  active: boolean;
  chapter: string;
  title: string;
  /** Chapter 1: which act is playing ("HỒI 2/3 · GIỜ TAN TẦM"), or null. */
  act: string | null;
  objective: string;
  /** Seconds left in a timed chapter, or null. */
  timeLeftSec: number | null;
  /** `death`: the ending card (advance = go on); `line`: a dialogue line. */
  dialog: { text: string; index: number; total: number; speaker: 'hero' | 'master'; kind: DialogKind } | null;
  /** Chapter 1: what killed the hero, once it happened. */
  fate: FateView | null;
  /** Chapter 1: the survival run (hearts, time, hazards), or null outside it. */
  run: RunView | null;
  /** Chapter 2: the cloud garden (sparks, the spirit and what it says), or null outside it. */
  garden: GardenView | null;
  /** Chapter 1: the stalls (name, whether their talk was heard). */
  stalls: Array<{ id: string; name: string; visited: boolean }>;
  /** Chapter 1: passers-by, stall talks and the reply to pick, or null outside it. */
  street: StreetView | null;
  /** A short line shown without stopping play (chapter 1: rush hour starting), or null. */
  aside: string | null;
  /** Counts timeouts this chapter (the UI shows "time's up" when it grows). */
  retries: number;
  stones: Record<string, boolean>;
  portalOpen: boolean;
  cherryTaken: boolean;
  rescued: boolean;
  /** The intro dialog of the chapter has been played. */
  introDone: boolean;
  /** A story transition is under way: the world ignores input. */
  locked: boolean;
}

export interface StoryHooks {
  resetPlayer(): void;
  spawnMaster(): void;
  /** The café still has this customer (they may vanish without a `left` event, e.g. after a reload). */
  hasCustomer(id: string): boolean;
  setCafeOpen(open: boolean): void;
  setScoreFloor(floor: number): void;
}

type DialogKind = 'line' | 'death';

interface Dialog {
  lines: string[];
  index: number;
  onClose: () => void;
  kind: DialogKind;
}

const OK: StoryResult = { ok: true };
const no = (reason: string, applicable = true): StoryResult => ({ ok: false, reason, applicable });

/**
 * Playable rebirth story (M9): chapters S03 → S04 → S05, each an interactive
 * level on its own map with click-to-move objectives. Progress is saved in
 * `state.story` (chapter + flags), so a reload resumes the chapter. The chapter
 * only runs while the player is on its map; other maps (e.g. dev farm) ignore it.
 * S05 reuses the café: a "master" customer orders an espresso and rates it.
 */
export class StoryService {
  private dialog: Dialog | null = null;
  private timerMs = 0;
  private respawnIn: number | null = null;
  private travelIn: number | null = null;
  private travelTo = '';
  private masterId: string | null = null;
  private retries = 0;
  private aside: { text: string; ms: number } | null = null;
  private run: RunService | null = null;
  /** The run's act last tick (rush hour is announced when it starts). */
  private runPhase: RunPhase | null = null;
  /** Enough stalls visited: rush hour starts once the last stall's line has been read. */
  private chaosIn: number | null = null;
  private garden: GardenService | null = null;
  private street: StreetService | null = null;
  private lastAlive = 0;

  constructor(
    private readonly state: GameState,
    private readonly mapId: string,
    private readonly config: StoryConfig,
    private readonly bus: EventBus<GameEvents>,
    private readonly tx: TransactionService,
    private readonly hooks: StoryHooks,
    private readonly random: () => number = Math.random,
  ) {
    if (!this.active) return;
    const flags = this.state.story.flags;
    if (this.chapterId === 'S05') {
      hooks.setCafeOpen(false);
      hooks.setScoreFloor(config.tutorialScoreFloor);
    }
    if (this.chapterId === 'S03' && flags.rescued) this.showDeath();
    // A chapter without intro lines (the chapter-1 run) starts at once, no dialogue to click through.
    else if (!flags.introDone && this.chapter.intro.length === 0) this.introDone();
    else if (!flags.introDone) this.open(this.chapter.intro, () => this.introDone());
    else if (this.chapterId === 'S05' && !flags.rated) this.respawnIn = 500;

    bus.on('cafe:rated', ({ customerId }) => {
      if (!this.active || this.chapterId !== 'S05' || this.masterId !== customerId) return;
      this.state.story.flags.rated = true;
      this.open(this.chapter.outro, () => this.finishChapter());
    });
    bus.on('customer:left', ({ customerId, reason }) => {
      if (!this.active || this.chapterId !== 'S05' || this.state.story.flags.rated || customerId !== this.masterId) return;
      // Retry is always allowed: the master comes back.
      this.masterId = null;
      this.respawnIn = config.respawnMasterMs;
    });
  }

  get chapterId(): string {
    return this.state.story.chapter;
  }

  private get chapter(): StoryChapter {
    return this.config.chapters[this.chapterId]!;
  }

  get active(): boolean {
    return this.config.chapters[this.chapterId]?.map === this.mapId;
  }

  /** True while a dialog is open or a transition is running: the player cannot act. */
  get locked(): boolean {
    return this.dialog !== null || this.travelIn !== null;
  }

  // ── chapter 1: survival run ─────────────────────────────────────────────

  /** The simulation hands over the run (it needs the grid and the player); it starts once the intro is read. */
  attachRun(run: RunService): void {
    this.run = run;
    const f = this.state.story.flags;
    if (this.active && f.introDone && !f.rescued && !this.dialog) run.start();
    // Reloaded after the stalls were visited: no need to stroll all over again.
    if (this.active && this.visits >= (this.chapter.run?.strollVisits ?? Infinity)) this.chaosIn = 3000;
  }

  /** Chapter 2's cloud garden, handed over by the simulation like the run. */
  attachGarden(garden: GardenService): void {
    this.garden = garden;
  }

  /** Chapter 1's street life, handed over by the simulation like the run. */
  attachStreet(street: StreetService): void {
    this.street = street;
  }

  /** Chapter 1: the reply picked in a stall talk. */
  chooseReply(i: number): StoryResult {
    return !this.locked && this.street?.choose(i) ? OK : no('notNow', false);
  }

  get runControls(): boolean {
    return !!this.run?.controlsPlayer;
  }

  /** The gag or fate that knocked the hero out. */
  private get hazard(): { death: string; absurdity: number } | null {
    const k = this.state.story.scenario;
    return (k && (this.chapter.hazards?.[k as HazardKind] ?? this.chapter.finales?.[k as FinaleKind])) || null;
  }

  /** The hero is down: the gag (or fate) that did it is their absurd knock-out, and the story moves on. */
  onDeath(kind: HazardKind | FinaleKind, aliveMs: number): void {
    const st = this.state.story;
    st.flags.rescued = true;
    st.scenario = kind;
    this.lastAlive = aliveMs;
    this.aside = null;
    this.showDeath();
  }

  /** From the ending card: play the run again for a better time. */
  retryRun(): StoryResult {
    if (this.dialog?.kind !== 'death' || !this.run) return no('notNow', false);
    this.dialog = null;
    this.state.story.flags.rescued = false;
    this.hooks.resetPlayer();
    this.run.start();
    return OK;
  }

  /** Chapter-1 stalls visited so far. */
  private get visits(): number {
    return [...(this.chapter.stalls ?? []), ...(this.chapter.street?.shops ?? [])].filter((s) => this.state.story.flags[`visited:${s.id}`]).length;
  }

  canVisit(stallId: string): StoryResult {
    const f = this.state.story.flags;
    const known = this.chapter.stalls?.some((s) => s.id === stallId) || this.chapter.street?.shops?.some((s) => s.id === stallId);
    if (!this.active || this.chapterId !== 'S03' || f.rescued || !known) return no('notNow', false);
    return f[`visited:${stallId}`] ? no('alreadyVisited', false) : OK;
  }

  /** A stall's talk has played to the end: it counts towards rush hour. */
  visit(stallId: string): StoryResult {
    const c = this.canVisit(stallId);
    if (!c.ok) return c;
    this.state.story.flags[`visited:${stallId}`] = true;
    if (this.visits >= (this.chapter.run?.strollVisits ?? Infinity)) this.chaosIn = 3000;
    this.bus.emit('story:changed', { chapter: this.chapterId });
    return OK;
  }

  /** Once the death has played, the hero goes straight on to the other world (no card to click through). */
  private showDeath(): void {
    this.bus.emit('story:whiteout', { ms: this.config.whiteoutMs });
    this.finishChapter();
  }

  // ── dialog ──────────────────────────────────────────────────────────────

  private open(lines: string[], onClose: () => void, kind: DialogKind = 'line'): void {
    this.dialog = { lines, index: 0, onClose, kind };
  }

  /** "Tiếp": next line, or close the dialog and run what follows it. */
  advanceDialog(): void {
    const d = this.dialog;
    if (!d) return;
    d.index += 1;
    if (d.index >= d.lines.length) {
      this.dialog = null;
      d.onClose();
    }
  }

  private introDone(): void {
    this.state.story.flags.introDone = true;
    if (this.chapterId === 'S03') this.run?.start();
    if (this.chapterId !== 'S05') return;
    for (const it of this.config.tutorialItems) this.tx.execute({ reason: 'story:tutorialBeans', items: [{ itemId: it.itemId, qty: it.qty, quality: it.quality }], key: `story:tutorial:${it.itemId}` });
    this.respawnIn = 500;
  }

  // ── actions (called by handlers) ────────────────────────────────────────

  canRescue(): StoryResult {
    return this.active && this.chapterId === 'S03' && !this.state.story.flags.rescued ? OK : no('notNow', false);
  }

  /** Ends the run now as if a hazard touched the hero (tests, debug). */
  rescue(): StoryResult {
    const c = this.canRescue();
    if (!c.ok) return c;
    const v = this.run?.view();
    this.run?.stop();
    this.onDeath(v?.hit?.kind ?? v?.finale?.kind ?? 'sau', v?.aliveMs ?? 0);
    return OK;
  }

  canActivate(stoneId: string): StoryResult {
    if (!this.active || this.chapterId !== 'S04' || !this.config.stones.includes(stoneId)) return no('notNow', false);
    return this.state.story.flags[stoneId] ? no('alreadyActive', false) : OK;
  }

  activate(stoneId: string): StoryResult {
    const c = this.canActivate(stoneId);
    if (!c.ok) return c;
    this.state.story.flags[stoneId] = true;
    this.bus.emit('story:changed', { chapter: this.chapterId });
    return OK;
  }

  get portalOpen(): boolean {
    return this.config.stones.every((s) => this.state.story.flags[s]);
  }

  canEnterPortal(): StoryResult {
    if (!this.active || this.chapterId !== 'S04') return no('notNow', false);
    return this.portalOpen ? OK : no('portalClosed');
  }

  enterPortal(): StoryResult {
    const c = this.canEnterPortal();
    if (!c.ok) return c;
    this.bus.emit('story:whiteout', { ms: this.config.whiteoutMs });
    // No outro lines: straight through the door (the doors transition plays).
    if (this.chapter.outro.length) this.open(this.chapter.outro, () => this.finishChapter());
    else this.finishChapter();
    return OK;
  }

  canPickCherry(): StoryResult {
    return this.active && this.chapterId === 'S04' && !this.state.story.flags.cherry ? OK : no('notNow', false);
  }

  pickCherry(): StoryResult {
    const c = this.canPickCherry();
    if (!c.ok) return c;
    const r = this.config.cherryReward;
    const paid = this.tx.execute({ reason: 'story:cherry', items: [{ itemId: r.itemId, qty: r.qty }], key: 'story:cherry' });
    if (!paid.ok) return no(paid.error);
    this.state.story.flags.cherry = true;
    this.bus.emit('story:changed', { chapter: this.chapterId });
    return OK;
  }

  canTalk(): StoryResult {
    return this.active && this.chapterId === 'S05' ? OK : no('notNow', false);
  }

  talk(): StoryResult {
    const c = this.canTalk();
    if (!c.ok) return c;
    this.open(this.config.masterHint, () => undefined);
    return OK;
  }

  // ── progression ─────────────────────────────────────────────────────────

  private finishChapter(): void {
    const next = this.chapter.next;
    // The drawn situation is kept, so replaying the story never deals the same one twice in a row.
    this.state.story = { chapter: next, flags: {} };
    this.bus.emit('story:chapterChanged', { chapter: next });
    this.travelTo = next === 'done' ? this.config.afterStoryMap : this.config.chapters[next]!.map;
    this.travelIn = this.config.whiteoutMs;
  }

  tick(dtMs: number): void {
    // The chapter already moved on, so `active` is false while the transition runs.
    if (this.travelIn !== null) {
      this.travelIn -= dtMs;
      if (this.travelIn <= 0) {
        this.travelIn = null;
        this.bus.emit('world:travelRequested', { map: this.travelTo });
      }
      return;
    }
    if (this.aside && (this.aside.ms -= dtMs) <= 0) this.aside = null;
    if (!this.active || this.dialog) return;
    if (this.chaosIn !== null && (this.chaosIn -= dtMs) <= 0) {
      this.chaosIn = null;
      this.run?.startChaos();
    }
    const phase = this.run?.phase ?? null;
    if (phase === 'chaos' && this.runPhase === 'stroll' && this.chapter.chaosAnnounce) this.aside = { text: this.chapter.chaosAnnounce, ms: 3000 };
    this.runPhase = phase;
    const limit = this.chapter.timeLimitMs;
    if (limit && !this.state.story.flags.rescued) {
      this.timerMs += dtMs;
      if (this.timerMs >= limit) {
        // No death is shown: back to the checkpoint and try again.
        this.timerMs = 0;
        this.retries += 1;
        this.hooks.resetPlayer();
        this.bus.emit('story:retry', { chapter: this.chapterId });
      }
    }
    // Safety net: the master must never stay missing, or the chapter would stall with no way forward.
    const f = this.state.story.flags;
    if (this.chapterId === 'S05' && f.introDone && !f.rated) {
      if (this.masterId !== null && !this.hooks.hasCustomer(this.masterId)) this.masterId = null;
      if (this.masterId === null && this.respawnIn === null) this.respawnIn = this.config.respawnMasterMs;
    }
    if (this.respawnIn !== null) {
      this.respawnIn -= dtMs;
      if (this.respawnIn <= 0) {
        this.respawnIn = null;
        this.hooks.spawnMaster();
      }
    }
  }

  /** Only the master's rating ends the chapter. */
  registerMaster(customerId: string): void {
    this.masterId = customerId;
  }

  // ── view ────────────────────────────────────────────────────────────────

  view(): StoryView {
    const f = this.state.story.flags;
    const ch = this.config.chapters[this.chapterId];
    const d = this.dialog;
    let objective = '';
    if (this.active && ch) {
      const left = ch.timeLimitMs ? Math.max(0, Math.ceil((ch.timeLimitMs - this.timerMs) / 1000)) : 0;
      if (this.chapterId === 'S04') objective = this.portalOpen ? ch.objectiveReady ?? '' : ch.objective.replace('{n}', String(this.config.stones.filter((s) => f[s]).length));
      else if (this.chapterId === 'S05') objective = f.introDone ? ch.objectiveBrew ?? '' : ch.objective;
      else if (this.chapterId === 'S03') {
        const v = this.run?.view();
        const shop = this.street?.view().shop;
        objective = shop ? (ch.objectiveShop ?? '').replace('{name}', shop.name) : v?.phase === 'stroll'
          ? ch.objective.replace('{n}', String(this.visits)).replace('{max}', String(ch.run?.strollVisits ?? 0)).replace('{s}', String(v.strollLeftSec ?? 0))
          : v?.phase === 'chaos' ? (ch.objectiveChaos ?? '').replace('{s}', String(v.leftSec ?? 0)) : ch.objectiveFaint ?? '';
      }
      else objective = ch.objective.replace('{t}', String(left));
    }
    return {
      active: this.active || this.travelIn !== null,
      chapter: this.chapterId,
      title: ch?.title ?? '',
      act: this.active && this.chapterId === 'S03' && this.run ? ch?.acts?.[{ stroll: 0, chaos: 1, faint: 2 }[this.run.phase]] ?? null : null,
      objective,
      timeLeftSec: this.active && ch?.timeLimitMs && !f.rescued ? Math.max(0, Math.ceil((ch.timeLimitMs - this.timerMs) / 1000)) : null,
      dialog: d ? { text: d.lines[d.index]!, index: d.index, total: d.lines.length, speaker: this.chapterId === 'S05' ? 'master' : 'hero', kind: d.kind } : null,
      fate: this.fateView(),
      run: this.active && this.chapterId === 'S03' && this.run ? this.run.view() : null,
      garden: this.active && this.chapterId === 'S04' && this.garden ? this.garden.view() : null,
      stalls: this.active ? (ch?.stalls ?? []).map((s) => ({ id: s.id, name: s.name, visited: !!f[`visited:${s.id}`] })) : [],
      street: this.active && this.chapterId === 'S03' && this.street ? this.street.view() : null,
      aside: this.aside?.text ?? null,
      retries: this.retries,
      stones: Object.fromEntries(this.config.stones.map((s) => [s, !!f[s]])),
      portalOpen: this.portalOpen,
      cherryTaken: !!f.cherry,
      rescued: !!f.rescued,
      introDone: !!f.introDone,
      locked: this.locked,
    };
  }

  private fateView(): FateView | null {
    const k = this.state.story.scenario as HazardKind | FinaleKind | undefined;
    const h = this.active && this.state.story.flags.rescued ? this.hazard : null;
    if (!h || !k) return null;
    const kinds = [...Object.keys(this.chapter.hazards ?? {}), ...Object.keys(this.chapter.finales ?? {})];
    return { id: k, number: kinds.indexOf(k) + 1, death: h.death, absurdity: h.absurdity, aliveSec: Math.floor(this.lastAlive / 1000) };
  }
}
