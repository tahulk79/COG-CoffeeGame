import { SAVE_MIGRATIONS, SAVE_SCHEMA_VERSION, type GameState } from './GameState';

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  readonly data = new Map<string, string>();
  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.data.set(key, value);
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable: nothing to remove */
    }
  }
}

export type LoadResult =
  | { status: 'ok'; state: GameState; migratedFrom?: number; /** The main save was unusable; this is the previous good one. */ recoveredFromBackup?: true }
  | { status: 'empty' }
  | { status: 'corrupt' | 'invalid' | 'unsupported'; detail: string; backupKey?: string };

/** Migration from version N to N+1. Register new ones when SAVE_SCHEMA_VERSION increases. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Structural validation: catches truncated or hand-edited saves before they reach gameplay. */
export function validateState(s: unknown): string[] {
  const p: string[] = [];
  if (!isObj(s)) return ['root is not an object'];
  if (!isNum(s.schemaVersion)) p.push('schemaVersion');
  if (!isObj(s.player) || typeof s.player.map !== 'string') p.push('player');
  const story = s.story;
  if (!isObj(story) || typeof story.chapter !== 'string' || !isObj(story.flags)) p.push('story');
  if (!isObj(s.counters)) p.push('counters');
  return p;
}

/**
 * Versioned single-slot save. Never silently destroys data: unreadable or
 * invalid saves are copied to a backup key before the caller starts fresh.
 */
export class SaveService {
  constructor(
    private readonly storage: StorageAdapter,
    readonly key = 'tcss.save.slot1',
    private readonly migrations: Record<number, Migration> = SAVE_MIGRATIONS,
    private readonly currentVersion = SAVE_SCHEMA_VERSION,
  ) {}

  /** Rolling backup key: the save before the latest one. */
  get previousKey(): string {
    return `${this.key}.prev`;
  }

  /**
   * Writes the save. The previous good save is kept under `previousKey` so a
   * write that is cut off (or later found corrupt) never loses everything.
   * Returns false when storage refused the write (e.g. quota); the game keeps running.
   */
  save(state: GameState, now: number): boolean {
    state.savedAt = now;
    try {
      const old = this.storage.get(this.key);
      if (old !== null && this.looksValid(old)) this.storage.set(this.previousKey, old);
      this.storage.set(this.key, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  private looksValid(raw: string): boolean {
    try {
      const p: unknown = JSON.parse(raw);
      return isObj(p) && isNum(p.schemaVersion);
    } catch {
      return false;
    }
  }

  load(now: number): LoadResult {
    const main = this.loadFrom(this.key, now);
    if (main.status !== 'corrupt' && main.status !== 'invalid') return main;
    // The main save is unusable (already copied to a backup key): fall back to the previous one.
    const prev = this.loadFrom(this.previousKey, now);
    return prev.status === 'ok' ? { ...prev, recoveredFromBackup: true } : main;
  }

  private loadFrom(key: string, now: number): LoadResult {
    const raw = this.storage.get(key);
    if (raw === null) return { status: 'empty' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { status: 'corrupt', detail: (e as Error).message, backupKey: this.backup(raw, now, key) };
    }
    if (!isObj(parsed) || !isNum(parsed.schemaVersion)) {
      return { status: 'invalid', detail: 'missing schemaVersion', backupKey: this.backup(raw, now, key) };
    }
    const from = parsed.schemaVersion;
    if (from > this.currentVersion) {
      // A newer game wrote this. Keep it untouched; the caller must not overwrite it.
      return { status: 'unsupported', detail: `save version ${from} > supported ${this.currentVersion}` };
    }
    let data: Record<string, unknown> = parsed;
    for (let v = from; v < this.currentVersion; v++) {
      const m = this.migrations[v];
      if (!m) return { status: 'invalid', detail: `no migration from v${v}`, backupKey: this.backup(raw, now, key) };
      data = { ...m(data), schemaVersion: v + 1 };
    }
    const problems = validateState(data);
    if (problems.length) return { status: 'invalid', detail: problems.join(', '), backupKey: this.backup(raw, now, key) };
    return from === this.currentVersion ? { status: 'ok', state: data as unknown as GameState } : { status: 'ok', state: data as unknown as GameState, migratedFrom: from };
  }

  private backup(raw: string, now: number, key = this.key): string {
    const k = `${key}.backup.${now}`;
    this.storage.set(k, raw);
    return k;
  }
}
