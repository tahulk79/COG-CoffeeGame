import type { Clock } from '../../core/Clock';
import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { TransactionService } from '../../systems/economy/TransactionService';
import type { GameState } from '../state/GameState';

export interface Reward {
  coins?: number;
  exp?: number;
  items?: Array<{ itemId: string; qty: number }>;
}

export interface RegionDef {
  label: string;
  /** Travelable map, or null for a district that only hosts a branch. */
  map: string | null;
  landCost?: number;
  cafeCost?: number;
  farmCost?: number;
  unlockLevel: number;
  /** Placeholder world-map position (px in the 620×420 map area). */
  pos: { x: number; y: number };
}

export interface GoalDef {
  id: string;
  label: string;
  counter: string;
  target: number;
  requires?: string;
  reward: Reward;
}

export interface SkillDef {
  label: string;
  desc: string;
  effect: 'tip' | 'traffic' | 'wage' | 'market';
  perLevel: number;
  max: number;
  cost: number;
}

export interface BranchDef {
  label: string;
  region: string;
  cost: number;
  revenuePerHour: number;
  maxStoredHours: number;
}

export interface MetaConfig {
  regions: Record<string, RegionDef>;
  quests: GoalDef[];
  achievements: GoalDef[];
  skills: Record<string, SkillDef>;
  branches: Record<string, BranchDef>;
}

export type MetaResult = { ok: true } | { ok: false; reason: string };
const OK: MetaResult = { ok: true };
const no = (reason: string): MetaResult => ({ ok: false, reason });

export interface GoalView {
  counter: string;
  id: string;
  label: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  /** Quests only: a required quest is not claimed yet. */
  locked: boolean;
  reward: Reward;
}

export interface MetaView {
  regions: Array<{ id: string; label: string; map: string | null; unlockLevel: number; locked: boolean; current: boolean; pos: { x: number; y: number } }>;
  quests: GoalView[];
  achievements: GoalView[];
  skills: { points: number; list: Array<{ id: string; label: string; desc: string; level: number; max: number; cost: number; canBuy: boolean }> };
  branches: Array<{ id: string; label: string; region: string; cost: number; revenuePerHour: number; owned: boolean; pending: number; canBuy: boolean; locked: boolean }>;
}

/**
 * World progression (M10): regions locked by level, quests, achievements,
 * skills and branches. Quests and achievements count facts from EventBus
 * events (never from UI), rewards go through the TransactionService with
 * idempotency keys, so each is paid once. Skills turn level-ups into small
 * permanent bonuses; branches earn coins over (real) time.
 */
export class MetaService {
  constructor(
    private readonly state: GameState,
    readonly config: MetaConfig,
    private readonly bus: EventBus<GameEvents>,
    private readonly tx: TransactionService,
    private readonly clock: Clock,
    private readonly level: () => number,
    private readonly mapId: string,
    private readonly revenueFactor: () => number,
  ) {
    const add = (name: string, n: number): void => {
      if (n <= 0) return;
      const c = this.state.meta.counters;
      c[name] = (c[name] ?? 0) + n;
      this.checkAchievements();
    };
    bus.on('economy:transaction', (r) => {
      if (r.reason.startsWith('harvest:')) add('harvest', r.items.filter((i) => i.qty > 0).reduce((s, i) => s + i.qty, 0));
    });
    bus.on('cafe:paid', () => add('served', 1));
    bus.on('cafe:rated', (e) => e.stars === 5 && add('fiveStar', 1));
    bus.on('market:sold', (e) => add('sold', e.coins));
    bus.on('brew:finished', () => add('brewed', 1));
    bus.on('employee:hired', () => add('hired', 1));
    bus.on('decor:changed', (e) => e.action === 'placed' && add('placed', 1));
    bus.on('story:chapterChanged', (e) => e.chapter === 'done' && add('storyDone', 1));
    bus.on('progression:levelUp', () => this.checkAchievements());
    this.checkAchievements();
  }

  counter(name: string): number {
    return name === 'level' ? this.level() : this.state.meta.counters[name] ?? 0;
  }

  // ── achievements ────────────────────────────────────────────────────────

  private checkAchievements(): void {
    for (const a of this.config.achievements) {
      if (this.state.meta.achievements[a.id] !== undefined || this.counter(a.counter) < a.target) continue;
      this.state.meta.achievements[a.id] = this.clock.now();
      this.pay(a.reward, `ach:${a.id}`, `achievement:${a.id}`);
      this.bus.emit('meta:achievement', { id: a.id, label: a.label });
    }
  }

  private pay(r: Reward, key: string, reason: string): void {
    const res = this.tx.execute({ reason, coins: r.coins ?? 0, exp: r.exp ?? 0, items: (r.items ?? []).map((i) => ({ itemId: i.itemId, qty: i.qty })), key });
    // A full bag must not eat the reward: the coins/EXP part is still paid.
    if (!res.ok && res.error === 'capacityExceeded') this.tx.execute({ reason, coins: r.coins ?? 0, exp: r.exp ?? 0, key });
  }

  // ── quests ──────────────────────────────────────────────────────────────

  private goalView(g: GoalDef, claimed: boolean, locked: boolean): GoalView {
    const progress = Math.min(g.target, this.counter(g.counter));
    return { counter: g.counter, id: g.id, label: g.label, progress, target: g.target, done: progress >= g.target, claimed, locked, reward: g.reward };
  }

  private questLocked(q: GoalDef): boolean {
    return !!q.requires && this.state.meta.quests[q.requires] === undefined;
  }

  claimQuest(id: string): MetaResult {
    const q = this.config.quests.find((x) => x.id === id);
    if (!q) return no('unknownQuest');
    if (this.state.meta.quests[id] !== undefined) return no('alreadyClaimed');
    if (this.questLocked(q)) return no('questLocked');
    if (this.counter(q.counter) < q.target) return no('questNotDone');
    this.state.meta.quests[id] = this.clock.now();
    this.pay(q.reward, `quest:${id}`, `quest:${id}`);
    this.bus.emit('meta:questClaimed', { id, label: q.label });
    return OK;
  }

  // ── skills ──────────────────────────────────────────────────────────────

  skillLevel(id: string): number {
    return this.state.meta.skills[id] ?? 0;
  }

  /** One point per level gained after level 1, minus what was spent. */
  skillPoints(): number {
    const spent = Object.entries(this.state.meta.skills).reduce((s, [id, lv]) => s + lv * (this.config.skills[id]?.cost ?? 0), 0);
    return Math.max(0, this.level() - 1 - spent);
  }

  buySkill(id: string): MetaResult {
    const s = this.config.skills[id];
    if (!s) return no('unknownSkill');
    if (this.skillLevel(id) >= s.max) return no('skillMaxed');
    if (this.skillPoints() < s.cost) return no('noSkillPoints');
    this.state.meta.skills[id] = this.skillLevel(id) + 1;
    return OK;
  }

  /** Sum of a skill effect (e.g. 0.2 = +20%). */
  effect(name: SkillDef['effect']): number {
    return Object.entries(this.config.skills).reduce((sum, [id, s]) => (s.effect === name ? sum + s.perLevel * this.skillLevel(id) : sum), 0);
  }

  // ── regions & branches ──────────────────────────────────────────────────

  regionLocked(id: string): boolean {
    const r = this.config.regions[id];
    return !r || this.level() < r.unlockLevel;
  }

  /** The map a region opens, if the player may travel there now. */
  travelMap(id: string): string | null {
    const r = this.config.regions[id];
    return r && r.map && !this.regionLocked(id) ? r.map : null;
  }

  private pending(id: string): number {
    const b = this.config.branches[id];
    const own = this.state.meta.branches[id];
    if (!b || !own) return 0;
    const hours = Math.min(b.maxStoredHours, Math.max(0, this.clock.now() - own.collectedAt) / 3_600_000);
    return Math.floor(hours * b.revenuePerHour * this.revenueFactor());
  }

  buyBranch(id: string): MetaResult {
    const b = this.config.branches[id];
    if (!b) return no('unknownBranch');
    if (this.state.meta.branches[id]) return no('alreadyOwned');
    if (this.regionLocked(b.region)) return no('regionLocked');
    if (!this.state.regions[b.region]?.cafeBuilt) return no('landRequired');
    const r = this.tx.execute({ reason: `branch:buy:${id}`, coins: -b.cost, key: `branch:buy:${id}` });
    if (!r.ok) return no(r.error);
    const now = this.clock.now();
    this.state.meta.branches[id] = { boughtAt: now, collectedAt: now };
    this.bus.emit('meta:branchBought', { id, label: b.label });
    return OK;
  }

  collectBranch(id: string): MetaResult {
    const own = this.state.meta.branches[id];
    if (!own) return no('notOwned');
    const coins = this.pending(id);
    if (coins <= 0) return no('nothingToCollect');
    const r = this.tx.execute({ reason: `branch:revenue:${id}`, coins, key: `branch:revenue:${id}:${own.collectedAt}` });
    if (!r.ok) return no(r.error);
    own.collectedAt = this.clock.now();
    return OK;
  }

  // ── view ────────────────────────────────────────────────────────────────

  view(): MetaView {
    const m = this.state.meta;
    return {
      regions: Object.entries(this.config.regions).map(([id, r]) => ({ id, label: r.label, map: r.map, unlockLevel: r.unlockLevel, locked: this.regionLocked(id), current: r.map === this.mapId || this.mapId.startsWith(`${id}__`), pos: r.pos })),
      quests: this.config.quests.map((q) => this.goalView(q, m.quests[q.id] !== undefined, this.questLocked(q))),
      achievements: this.config.achievements.map((a) => this.goalView(a, m.achievements[a.id] !== undefined, false)),
      skills: {
        points: this.skillPoints(),
        list: Object.entries(this.config.skills).map(([id, s]) => ({ id, label: s.label, desc: s.desc, level: this.skillLevel(id), max: s.max, cost: s.cost, canBuy: this.skillLevel(id) < s.max && this.skillPoints() >= s.cost })),
      },
      branches: Object.entries(this.config.branches).map(([id, b]) => ({
        id,
        label: b.label,
        region: b.region,
        cost: b.cost,
        revenuePerHour: b.revenuePerHour,
        owned: !!m.branches[id],
        pending: this.pending(id),
        canBuy: !m.branches[id] && !this.regionLocked(b.region),
        locked: this.regionLocked(b.region),
      })),
    };
  }
}
