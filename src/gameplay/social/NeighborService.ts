import type { Clock } from '../../core/Clock';
import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { TransactionService } from '../../systems/economy/TransactionService';
import type { FurnitureConfig } from '../decor/FurnitureService';
import type { GameState } from '../state/GameState';
import type { MapData } from '../world/types';

export interface NeighborCafeDef {
  id: string;
  name: string;
  owner: string;
  region: string;
  rating: number;
  /** 0–1 baseline crowd; the hour of day swings it around `peakHour`. */
  busyBase: number;
  peakHour: number;
  signature: string;
  likes: number;
  layout: Array<{ type: string; x: number; y: number; rotation: number }>;
}

export interface NeighborConfig {
  cafes: NeighborCafeDef[];
}

export type CrowdLabel = 'quiet' | 'normal' | 'busy' | 'packed';

export interface CafeProfile {
  id: string;
  name: string;
  owner: string;
  region: string;
  mine: boolean;
  ownerId: string;
  controller: 'bot' | 'player';
  businessKind: 'cafe' | 'farm';
  activity: string;
  simulation: { coins: number; stock: number; sold: number; phase: number } | null;
  /** 1–5 */
  rating: number;
  /** 0–100 from furniture: decor and comfort, each capped like the real bonuses. */
  decorScore: number;
  seats: number;
  /** 0–1 how crowded it is right now. */
  busy: number;
  crowd: CrowdLabel;
  customersNow: number;
  signature: string;
  likes: number;
  liked: boolean;
  /** 1 = best, among all cafés the player can see. */
  rankDecor: number;
  rankBusy: number;
}

export interface CafeVisit extends CafeProfile {
  layout: Array<{ type: string; x: number; y: number; rotation: number }>;
  /** Fixed parts of the room (counter, stations…), identical for everyone. */
  fixed: Array<{ type: string; x: number; y: number; rotation: number }>;
}

export type SocialResult = { ok: true } | { ok: false; reason: string };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const LIKE_REWARD = 5;

/**
 * Other cafés (M-social): without a server, a fixed set of "neighbour" cafés
 * stands in for other players. Each has a furniture layout, a rating and a
 * crowd level that follows the real hour of day, so the player can compare
 * decor and traffic with their own café and visit any of them. Their numbers
 * use the same decor/comfort rules and caps as the player's café.
 */
export class NeighborService {
  private definitionsCache: NeighborCafeDef[] | null = null;
  constructor(
    private readonly state: GameState,
    private readonly config: NeighborConfig,
    private readonly furniture: FurnitureConfig,
    private readonly cafeMap: MapData,
    private readonly clock: Clock,
    private readonly tx: TransactionService,
    private readonly bus: EventBus<GameEvents>,
    private readonly reputation: () => number,
    private readonly trafficFactor: () => number,
    private readonly regionLocked: (region: string) => boolean,
  ) {}

  private definitions(): NeighborCafeDef[] {
    if (this.definitionsCache) return this.definitionsCache;
    const farms: NeighborCafeDef[] = Object.entries(this.config.cafes.reduce<Record<string, NeighborCafeDef>>((acc, c) => { acc[c.region] ??= c; return acc; }, {})).flatMap(([region, template]) =>
      Array.from({ length: 6 }, (_, i) => ({ ...template, id: `farm_${region}_${i}`, name: `Vườn ${['Sương Mai', 'Đồi Xanh', 'Nắng Sớm', 'Mộc', 'An Nhiên', 'Bình Minh'][i]}`, owner: ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Minh'][i]!, region,
        signature: 'Trồng → Tưới → Thu hoạch → Chế biến → Bán', layout: Array.from({ length: 16 }, (_, j) => ({ type: 'farm_plot', x: 3 + j % 4 * 2, y: 3 + Math.floor(j / 4) * 2, rotation: 0 })) })));
    const extra = Object.entries(this.config.cafes.reduce<Record<string, NeighborCafeDef[]>>((acc, c) => { (acc[c.region] ??= []).push(c); return acc; }, {})).flatMap(([region, cafes]) =>
      Array.from({ length: Math.max(0, 6 - cafes.length) }, (_, i) => ({ ...cafes[i % cafes.length]!, id: `cafe_${region}_${i}`, name: `Cà phê ${['Mây', 'Gió', 'Mộc', 'Nắng', 'Lá', 'Sương'][i]}`, region })));
    return this.definitionsCache = [...this.config.cafes, ...extra, ...farms];
  }

  /** Small local bot economy: supplies are bought, consumed, then sold. No player rewards. */
  tick(): void {
    const now = this.clock.now();
    for (const def of this.definitions()) {
      const farm = def.id.startsWith('farm_');
      const b = this.state.social.bots[def.id] ??= { at: now, phase: 0, coins: 250, stock: 0, raw: 0, sold: 0 };
      // shortcut: cap offline catch-up to 100 actions per frame; use server ticks for online owners.
      const steps = Math.min(100, Math.floor(Math.max(0, now - b.at) / 15_000));
      for (let i = 0; i < steps; i++) {
        if (b.phase === 0 && b.stock === 0) {
          if (b.coins < 12) break;
          b.coins -= 12;
          b.stock = farm ? 16 : 6;
        }
        if (b.phase === 2) {
          b.stock -= farm ? 16 : 1;
          b.raw += farm ? 32 : 1;
        }
        if (b.phase === 4) {
          b.coins += b.raw * (farm ? 3 : 18);
          b.sold += b.raw;
          b.raw = 0;
        }
        b.phase = (b.phase + 1) % 5;
        b.at += 15_000;
      }
    }
  }

  private ownLayout(): Array<{ type: string; x: number; y: number; rotation: number }> {
    const saved = this.state.decor.layouts[this.cafeMap.id];
    if (saved) return saved.map((f) => ({ type: f.type, x: f.x, y: f.y, rotation: f.rotation }));
    return this.cafeMap.objects.filter((o) => this.furniture.catalog[o.type]).map((o) => ({ type: o.type, x: o.x, y: o.y, rotation: o.rotation ?? 0 }));
  }

  private score(layout: Array<{ type: string }>): { score: number; seats: number } {
    const b = this.furniture.bonuses;
    let comfort = 0;
    let decor = 0;
    let seats = 0;
    for (const f of layout) {
      const def = this.furniture.catalog[f.type];
      if (!def) continue;
      comfort += def.comfort;
      decor += def.decor;
      if (f.type === 'chair' || f.type === 'armchair') seats++;
    }
    const score = 0.6 * (Math.min(decor, b.decorCap) / b.decorCap) + 0.4 * (Math.min(comfort, b.comfortCap) / b.comfortCap);
    return { score: Math.round(score * 100), seats };
  }

  private crowd(busy: number): CrowdLabel {
    return busy < 0.3 ? 'quiet' : busy < 0.55 ? 'normal' : busy < 0.8 ? 'busy' : 'packed';
  }

  private busyAt(base: number, peak: number): number {
    const d = new Date(this.clock.now());
    const hour = d.getHours() + d.getMinutes() / 60;
    return clamp(base + 0.3 * Math.cos((2 * Math.PI * (hour - peak)) / 24), 0.05, 1);
  }

  private build(): Array<{ p: CafeProfile; layout: CafeVisit['layout'] }> {
    const liked = this.state.social.liked;
    const rows = this.definitions()
      .filter((c) => !this.regionLocked(c.region))
      .map((c) => {
        const { score, seats } = this.score(c.layout);
        const busy = this.busyAt(c.busyBase, c.peakHour);
        const p: CafeProfile = { id: c.id, name: c.name, owner: c.owner, region: c.region, mine: false, ownerId: `bot:${c.id}`, controller: 'bot', businessKind: c.id.startsWith('farm_') ? 'farm' : 'cafe', activity: this.activity(c.id), simulation: this.state.social.bots[c.id] ? { ...this.state.social.bots[c.id]! } : null, rating: c.rating, decorScore: score, seats, busy, crowd: this.crowd(busy), customersNow: Math.round(busy * seats), signature: c.signature, likes: c.likes + (liked[c.id] !== undefined ? 1 : 0), liked: liked[c.id] !== undefined, rankDecor: 0, rankBusy: 0 };
        return { p, layout: c.layout };
      });
    const own = this.ownLayout();
    const { score, seats } = this.score(own);
    // Reputation drives traffic (0.6–1.45): map it onto the same 0–1 crowd scale.
    const busy = clamp(0.1 + 0.8 * ((this.trafficFactor() - 0.6) / 0.85), 0.05, 1);
    rows.push({ p: { id: 'mine', name: 'Quán của bạn', owner: 'Bạn', region: 'cafe', mine: true, ownerId: 'local-player', controller: 'player', businessKind: 'cafe', activity: 'Đang vận hành', simulation: null, rating: Math.round(this.reputation() * 10) / 10, decorScore: score, seats, busy, crowd: this.crowd(busy), customersNow: Math.round(busy * seats), signature: '-', likes: 0, liked: false, rankDecor: 0, rankBusy: 0 }, layout: own });
    for (const [region, estate] of Object.entries(this.state.regions)) {
      if (this.regionLocked(region)) continue;
      for (const kind of ['cafe', 'farm'] as const) {
        if (!(kind === 'cafe' ? estate.cafeBuilt : estate.farmBuilt)) continue;
        const id = `${region}__${kind}`;
        const layout = kind === 'cafe' ? this.state.decor.layouts[id] ?? own : Object.values(estate.farm.plots).map((plot, i) => ({ type: 'farm_plot', x: 3 + i % 6 * 2, y: 3 + Math.floor(i / 6) * 2, rotation: 0 }));
        const stats = this.score(layout);
        const ratings = estate.cafe.ratings;
        const rating = ratings.length ? ratings.reduce((sum, x) => sum + x, 0) / ratings.length : 3;
        rows.push({ p: { id, name: `${kind === 'cafe' ? 'Quán' : 'Nông trại'} của bạn · ${region}`, owner: 'Bạn', ownerId: estate.ownerId,
          region, mine: true, controller: 'player', businessKind: kind, activity: 'Cơ sở của bạn', simulation: null, rating,
          decorScore: stats.score, seats: stats.seats, busy: 0, crowd: 'quiet', customersNow: 0, signature: '-', likes: 0, liked: false, rankDecor: 0, rankBusy: 0 }, layout });
      }
    }
    const byDecor = [...rows].sort((a, b) => b.p.decorScore - a.p.decorScore);
    const byBusy = [...rows].sort((a, b) => b.p.busy - a.p.busy);
    for (const r of rows) {
      r.p.rankDecor = byDecor.indexOf(r) + 1;
      r.p.rankBusy = byBusy.indexOf(r) + 1;
    }
    return rows;
  }

  private activity(id: string): string {
    const phase = this.state.social.bots[id]?.phase ?? 0;
    return (id.startsWith('farm_') ? ['Gieo hạt', 'Tưới cây', 'Thu hoạch', 'Chế biến', 'Bán nông sản'] : ['Đón khách', 'Nhận đơn', 'Pha cà phê', 'Phục vụ', 'Thu tiền & dọn bàn'])[phase]!;
  }

  list(): CafeProfile[] {
    return this.build().map((r) => r.p);
  }

  visit(id: string): CafeVisit | null {
    const row = this.build().find((r) => r.p.id === id);
    if (!row) return null;
    const fixed = row.p.businessKind === 'farm' ? [] : this.cafeMap.objects.filter((o) => !this.furniture.catalog[o.type] && o.type !== 'travel_sign').map((o) => ({ type: o.type, x: o.x, y: o.y, rotation: o.rotation ?? 0 }));
    return { ...row.p, layout: row.layout, fixed };
  }

  like(id: string): SocialResult {
    const c = this.build().find((x) => x.p.id === id && !x.p.mine)?.p;
    if (!c) return { ok: false, reason: 'unknownCafe' };
    if (this.regionLocked(c.region)) return { ok: false, reason: 'regionLocked' };
    if (this.state.social.liked[id] !== undefined) return { ok: false, reason: 'alreadyLiked' };
    this.state.social.liked[id] = this.clock.now();
    this.tx.execute({ reason: `like:${id}`, coins: LIKE_REWARD, key: `like:${id}` });
    this.bus.emit('social:liked', { cafeId: id });
    return { ok: true };
  }
}
