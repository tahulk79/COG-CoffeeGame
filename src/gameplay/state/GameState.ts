import type { TilePos } from '../../utils/tile';

/**
 * The complete persistent game state: plain JSON, no class instances, no
 * Phaser. Saving = serialising this object; loading = validating + migrating it.
 * Services mutate it only through their own methods.
 */
export const SAVE_SCHEMA_VERSION = 11;

export interface GameState {
  schemaVersion: number;
  createdAt: number;
  savedAt: number;
  player: { map: string; tile: TilePos | null };
  /**
   * Story progress. `chapter` is S03 | S04 | S05; `flags` are that chapter's progress markers.
   * Chapter 1: `scenario` is the hazard that knocked the hero out (a reload shows that ending again).
   */
  story: { chapter: string; flags: Record<string, boolean>; scenario?: string };
  /** Gameplay facts that outlive a chapter, e.g. how often each chapter-1 gag was seen (`incident:seen:<kind>`), so the street keeps varying. */
  counters: Record<string, number>;
}

export interface NewGameOptions {
  now: number;
  map: string;
}

export function createNewGameState(o: NewGameOptions): GameState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    createdAt: o.now,
    savedAt: o.now,
    player: { map: o.map, tile: null },
    story: { chapter: 'S03', flags: {} },
    counters: {},
  };
}

const CHAPTERS = ['S03', 'S04', 'S05'];
const MAPS: Record<string, string> = { S03: 'incident', S04: 'afterlife', S05: 'cafe' };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Every older save (v1–v10 also held the café, farm and economy) keeps only what is still played: the
 * story chapter and flags. A save past chapter 2 (the removed chapter 3 or "done") starts chapter 1 again.
 */
function toV11(raw: Record<string, unknown>): Record<string, unknown> {
  const story = isObj(raw.story) ? raw.story : {};
  const known = typeof story.chapter === 'string' && CHAPTERS.includes(story.chapter);
  const chapter = known ? (story.chapter as string) : 'S03';
  const player = isObj(raw.player) ? raw.player : {};
  const mapOk = typeof player.map === 'string' && player.map === MAPS[chapter];
  const meta = isObj(raw.meta) ? raw.meta : {};
  const counters = Object.fromEntries(Object.entries(isObj(meta.counters) ? meta.counters : {}).filter(([k, v]) => k.startsWith('incident:seen:') && typeof v === 'number'));
  return {
    schemaVersion: raw.schemaVersion,
    createdAt: raw.createdAt,
    savedAt: raw.savedAt,
    player: { map: MAPS[chapter]!, tile: mapOk ? player.tile ?? null : null },
    story: known ? { chapter, flags: isObj(story.flags) ? story.flags : {}, ...(typeof story.scenario === 'string' ? { scenario: story.scenario } : {}) } : { chapter, flags: {} },
    counters: isObj(raw.counters) ? raw.counters : counters,
  };
}

/** Save migrations: key = version migrated FROM. */
export const SAVE_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [i + 1, toV11]),
);
