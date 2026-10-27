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
  const eco = s.economy;
  if (!isObj(eco)) p.push('economy');
  else {
    if (!isNum(eco.coins) || eco.coins < 0 || !Number.isInteger(eco.coins)) p.push('economy.coins');
    if (!isObj(eco.inventory)) p.push('economy.inventory');
    else
      for (const [k, v] of Object.entries(eco.inventory)) {
        if (!isObj(v) || !isNum(v.qty) || v.qty <= 0 || !Number.isInteger(v.qty) || !isNum(v.quality)) p.push(`economy.inventory.${k}`);
      }
    if (!Array.isArray(eco.history)) p.push('economy.history');
    if (!Array.isArray(eco.processedKeys)) p.push('economy.processedKeys');
    if (!isNum(eco.nextTxId)) p.push('economy.nextTxId');
  }
  if (!isObj(s.progression) || !isNum(s.progression.exp) || s.progression.exp < 0) p.push('progression.exp');
  const farm = s.farm;
  if (!isObj(farm)) p.push('farm');
  else {
    if (!isObj(farm.plots)) p.push('farm.plots');
    else
      for (const [k, v] of Object.entries(farm.plots)) {
        if (!isObj(v) || typeof v.phase !== 'string' || !isNum(v.growthMs) || !isNum(v.lastUpdateAt) || !isNum(v.waterings)) p.push(`farm.plots.${k}`);
      }
    if (!isObj(farm.wateringCan) || !isNum(farm.wateringCan.water)) p.push('farm.wateringCan');
  }
  if (!isObj(s.player)) p.push('player');
  const proc = s.processing;
  if (!isObj(proc) || !isObj(proc.equipment) || !isObj(proc.selectedRecipe)) p.push('processing');
  else
    for (const [k, v] of Object.entries(proc.equipment)) {
      if (!isObj(v) || typeof v.type !== 'string' || !isNum(v.level)) p.push(`processing.equipment.${k}`);
      else if (v.job !== null) {
        const j = v.job;
        if (!isObj(j) || !isNum(j.startedAt) || !isNum(j.durationMs) || !isNum(j.outputQty) || j.outputQty <= 0 || typeof j.outputItem !== 'string')
          p.push(`processing.equipment.${k}.job`);
      }
    }
  if (!isObj(s.market) || !isObj(s.market.saturation)) p.push('market');
  const cafe = s.cafe;
  if (!isObj(cafe) || !Array.isArray(cafe.ratings) || !Array.isArray(cafe.feedback) || !isObj(cafe.stats)) p.push('cafe');
  else if (cafe.ratings.some((r) => !isNum(r) || r < 1 || r > 5)) p.push('cafe.ratings');
  const decor = s.decor;
  if (!isObj(decor) || !isObj(decor.layouts) || !isNum(decor.nextId)) p.push('decor');
  else
    for (const [map, layout] of Object.entries(decor.layouts)) {
      const ok = (f: unknown) => isObj(f) && typeof f.id === 'string' && typeof f.type === 'string' && isNum(f.x) && isNum(f.y) && isNum(f.rotation);
      if (!Array.isArray(layout) || !layout.every(ok)) p.push(`decor.layouts.${map}`);
    }
  const emp = s.employees;
  if (!isObj(emp) || !isNum(emp.nextId) || !Array.isArray(emp.list)) p.push('employees');
  else if (!emp.list.every((e) => isObj(e) && typeof e.id === 'string' && typeof e.role === 'string' && isNum(e.nextPayAt))) p.push('employees.list');
  const story = s.story;
  if (!isObj(story) || typeof story.chapter !== 'string' || !isObj(story.flags)) p.push('story');
  const meta = s.meta;
  if (!isObj(meta) || !['counters', 'quests', 'achievements', 'skills', 'branches'].every((k) => isObj(meta[k]))) p.push('meta');
  if (isObj(s.cafe) && (!Array.isArray(s.cafe.payments) || !Array.isArray(s.cafe.dirtySeats) || !isObj(s.cafe.upgrades) || !isNum(s.cafe.nextPaymentId))) p.push('cafe.v9');
  if (!isObj(s.social) || !isObj(s.social.liked) || !isObj(s.social.bots)) p.push('social');
  if (isObj(s.social) && isObj(s.social.bots)) for (const [id, b] of Object.entries(s.social.bots)) {
    if (!isObj(b) || !['at', 'phase', 'coins', 'stock', 'raw', 'sold'].every((k) => isNum(b[k]) && (b[k] as number) >= 0) || !Number.isInteger(b.phase) || (b.phase as number) > 4) p.push(`social.bots.${id}`);
  }
  if (!isObj(s.regions)) p.push('regions');
  else for (const [id, estate] of Object.entries(s.regions)) {
    if (!isObj(estate) || typeof estate.ownerId !== 'string' || !isNum(estate.boughtAt) || typeof estate.cafeBuilt !== 'boolean' || typeof estate.farmBuilt !== 'boolean') {
      p.push(`regions.${id}`);
      continue;
    }
    const localProblems = validateState({ ...s, regions: {}, cafe: estate.cafe, farm: estate.farm, processing: estate.processing, employees: estate.employees });
    p.push(...localProblems.map((v) => `regions.${id}.${v}`));
  }
  return p;
}

/**
 * Repairs harmless inconsistencies in an otherwise valid save so they cannot
 * cause duplicates or crashes: repeated idempotency keys, repeated employee
 * ids, an employee id counter that would reuse an existing id.
 */
export function sanitizeState(s: GameState): void {
  s.economy.processedKeys = [...new Set(s.economy.processedKeys)];
  const seen = new Set<string>();
  s.employees.list = s.employees.list.filter((e) => !seen.has(e.id) && !!seen.add(e.id));
  const maxId = Math.max(0, ...s.employees.list.map((e) => Number(e.id.replace(/\D/g, '')) || 0));
  s.employees.nextId = Math.max(s.employees.nextId, maxId + 1);
  s.farm.wateringCan.water = Math.max(0, s.farm.wateringCan.water);
  // Payment ids are unique forever: the counter can never sit at or below an existing id, and a collected payment is never pending again.
  const maxPay = Math.max(0, ...s.cafe.payments.map((x) => x.id));
  s.cafe.nextPaymentId = Math.max(s.cafe.nextPaymentId, maxPay + 1);
  const seenPay = new Set<number>();
  s.cafe.payments = s.cafe.payments.filter((x) => !seenPay.has(x.id) && !!seenPay.add(x.id));
  s.cafe.dirtySeats = [...new Set(s.cafe.dirtySeats)];
  for (const estate of Object.values(s.regions)) {
    sanitizeState({ ...s, regions: {}, cafe: estate.cafe, farm: estate.farm, processing: estate.processing, employees: estate.employees });
  }
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
    sanitizeState(data as unknown as GameState);
    return from === this.currentVersion ? { status: 'ok', state: data as unknown as GameState } : { status: 'ok', state: data as unknown as GameState, migratedFrom: from };
  }

  private backup(raw: string, now: number, key = this.key): string {
    const k = `${key}.backup.${now}`;
    this.storage.set(k, raw);
    return k;
  }
}
