import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { TransactionService } from '../../systems/economy/TransactionService';
import type { GameState } from '../state/GameState';

export interface StoryChapter {
  map: string;
  next: string;
  title: string;
  objective: string;
  objectiveReady?: string;
  objectiveBrew?: string;
  timeLimitMs?: number;
  intro: string[];
  outro: string[];
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
  objective: string;
  /** Seconds left in a timed chapter, or null. */
  timeLeftSec: number | null;
  dialog: { text: string; index: number; total: number; speaker: 'hero' | 'master' } | null;
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

interface Dialog {
  lines: string[];
  index: number;
  onClose: () => void;
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

  constructor(
    private readonly state: GameState,
    private readonly mapId: string,
    private readonly config: StoryConfig,
    private readonly bus: EventBus<GameEvents>,
    private readonly tx: TransactionService,
    private readonly hooks: StoryHooks,
  ) {
    if (!this.active) return;
    const flags = this.state.story.flags;
    if (this.chapterId === 'S05') {
      hooks.setCafeOpen(false);
      hooks.setScoreFloor(config.tutorialScoreFloor);
    }
    if (this.chapterId === 'S03' && flags.rescued) this.open(this.chapter.outro, () => this.finishChapter());
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

  // ── dialog ──────────────────────────────────────────────────────────────

  private open(lines: string[], onClose: () => void): void {
    this.dialog = { lines, index: 0, onClose };
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
    if (this.chapterId !== 'S05') return;
    for (const it of this.config.tutorialItems) this.tx.execute({ reason: 'story:tutorialBeans', items: [{ itemId: it.itemId, qty: it.qty, quality: it.quality }], key: `story:tutorial:${it.itemId}` });
    this.respawnIn = 500;
  }

  // ── actions (called by handlers) ────────────────────────────────────────

  canRescue(): StoryResult {
    return this.active && this.chapterId === 'S03' && !this.state.story.flags.rescued ? OK : no('notNow', false);
  }

  rescue(): StoryResult {
    const c = this.canRescue();
    if (!c.ok) return c;
    this.state.story.flags.rescued = true;
    this.bus.emit('story:whiteout', { ms: this.config.whiteoutMs });
    this.open(this.chapter.outro, () => this.finishChapter());
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
    this.open(this.chapter.outro, () => this.finishChapter());
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
    if (!this.active || this.dialog) return;
    const limit = this.chapter.timeLimitMs;
    if (limit && !this.state.story.flags.rescued) {
      this.timerMs += dtMs;
      if (this.timerMs >= limit) {
        // No death is shown: back to the checkpoint and try again.
        this.timerMs = 0;
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
      else objective = ch.objective.replace('{t}', String(left));
    }
    return {
      active: this.active || this.travelIn !== null,
      chapter: this.chapterId,
      title: ch?.title ?? '',
      objective,
      timeLeftSec: this.active && ch?.timeLimitMs && !f.rescued ? Math.max(0, Math.ceil((ch.timeLimitMs - this.timerMs) / 1000)) : null,
      dialog: d ? { text: d.lines[d.index]!, index: d.index, total: d.lines.length, speaker: this.chapterId === 'S05' ? 'master' : 'hero' } : null,
      stones: Object.fromEntries(this.config.stones.map((s) => [s, !!f[s]])),
      portalOpen: this.portalOpen,
      cherryTaken: !!f.cherry,
      rescued: !!f.rescued,
      introDone: !!f.introDone,
      locked: this.locked,
    };
  }
}
