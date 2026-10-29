import type { GameContent } from '../data/content';
import { GameSimulation } from '../gameplay/GameSimulation';
import { LocalStorageAdapter, SaveService, type LoadResult, type StorageAdapter } from '../gameplay/state/SaveService';
import { SystemClock, type Clock } from './Clock';
import type { GameState } from '../gameplay/state/GameState';

export interface SessionOptions {
  /** Map to open; omitted = resume the story checkpoint or the saved map. */
  mapId?: string;
  content: GameContent;
  /** false = throwaway session (M1 sandbox, tests); nothing is loaded or saved. */
  persistent: boolean;
  storage?: StorageAdapter;
  clock?: Clock;
  /** Dev/test only: new games skip the story. */
  skipStory?: boolean;
  /** Live state passed between scenes; storage failure must not roll back a chapter transition. */
  initialState?: GameState;
}

export interface GameSession {
  sim: GameSimulation;
  saves: SaveService | null;
  /** Why the previous save could not be used (shown to the player), if any. */
  loadProblem: Exclude<LoadResult, { status: 'ok' } | { status: 'empty' }> | null;
  /** The main save was unreadable and the previous one was restored. */
  recoveredFromBackup: boolean;
  /** True when saving must not happen (e.g. the stored save came from a newer version). */
  saveBlocked: boolean;
  /** Snapshot of the current frame, computed once by the world scene and reused by the HUD. */
  frame: import('../gameplay/GameSimulation').SimulationSnapshot | null;
}

export function createSession(o: SessionOptions): GameSession {
  const clock = o.clock ?? new SystemClock();
  const mapOf = (id: string) => {
    const m = o.content.maps[id];
    if (!m) throw new Error(`unknown map "${id}"`);
    return structuredClone(m);
  };
  if (!o.persistent) {
    return { sim: new GameSimulation(mapOf(o.mapId ?? 'farm'), o.content, { clock }), saves: null, loadProblem: null, recoveredFromBackup: false, saveBlocked: true, frame: null };
  }
  const saves = new SaveService(o.storage ?? new LocalStorageAdapter());
  const loaded = saves.load(clock.now());
  const state = o.initialState ?? (loaded.status === 'ok' ? loaded.state : undefined);
  // A new game starts with the story; a save resumes where it was.
  const newGameMap = o.skipStory ? 'farm' : o.content.story.chapters[o.content.story.start]?.map ?? 'farm';
  const usable = (id: string) => { const m = o.content.maps[id]; return m && (!m.regionId || (m.businessKind === 'cafe' ? state?.regions[m.regionId]?.cafeBuilt : state?.regions[m.regionId]?.farmBuilt)); };
  // A save taken as the doors close can already name the next chapter while player.map still names the old map.
  const chapterMap = !o.skipStory && state ? o.content.story.chapters[state.story.chapter]?.map : undefined;
  const savedMap = chapterMap && usable(chapterMap) ? chapterMap
    : state && usable(state.player.map) && state.player.map !== 'sandbox' ? state.player.map : newGameMap;
  const sim = new GameSimulation(mapOf(o.mapId && usable(o.mapId) ? o.mapId : savedMap), o.content, { clock, ...(state ? { state } : {}), ...(o.skipStory ? { skipStory: true } : {}) });
  const loadProblem = loaded.status === 'ok' || loaded.status === 'empty' ? null : loaded;
  return { sim, saves, loadProblem, recoveredFromBackup: loaded.status === 'ok' && !!loaded.recoveredFromBackup, saveBlocked: loaded.status === 'unsupported', frame: null };
}

/**
 * Saves after gameplay changes (debounced), periodically, and when the page
 * is hidden or closed. Transient work in progress is never saved half-done:
 * only committed state lives in GameState.
 */
export class Autosave {
  private dirty = false;
  private lastSave = 0;
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly session: GameSession,
    private readonly minIntervalMs = 2000,
  ) {
    const bus = session.sim.bus;
    const mark = () => (this.dirty = true);
    this.offs.push(bus.on('economy:transaction', mark), bus.on('farm:plotChanged', mark), bus.on('farm:canChanged', mark), bus.on('farm:seedSelected', mark), bus.on('move:arrived', mark), bus.on('decor:changed', mark), bus.on('employee:hired', mark), bus.on('employee:fired', mark), bus.on('employee:paid', mark), bus.on('story:changed', mark), bus.on('story:chapterChanged', mark), bus.on('meta:questClaimed', mark), bus.on('meta:branchBought', mark), bus.on('meta:achievement', mark));
  }

  /** Call every frame with a monotonic time. */
  update(nowMs: number): void {
    if (this.dirty && nowMs - this.lastSave >= this.minIntervalMs) this.saveNow(nowMs);
  }

  saveNow(nowMs = performance.now()): boolean {
    const { saves, sim, saveBlocked } = this.session;
    if (!saves || saveBlocked) return false;
    const ok = saves.save(sim.captureState(), sim.clock.now());
    if (!ok) {
      // Storage refused the write: keep the data dirty and retry later instead of pretending it was saved.
      this.lastSave = nowMs;
      sim.bus.emit('save:writeFailed', { at: sim.clock.now() });
      return false;
    }
    this.dirty = false;
    this.lastSave = nowMs;
    sim.bus.emit('save:written', { at: sim.clock.now() });
    return true;
  }

  destroy(): void {
    for (const off of this.offs) off();
  }
}
