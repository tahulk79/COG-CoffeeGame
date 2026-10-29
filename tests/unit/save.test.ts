import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/Clock';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';
import { SAVE_SCHEMA_VERSION } from '../../src/gameplay/state/GameState';

const street = (state?: GameSimulation['state'], clock = new FakeClock()) => new GameSimulation(structuredClone(CONTENT.maps.incident!), CONTENT, { clock, ...(state ? { state } : {}) });

describe('save / load', () => {
  it('round-trips the story, the seen gags and the player position exactly', () => {
    const clock = new FakeClock();
    const sim = street(undefined, clock);
    sim.state.story.flags['visited:tea'] = true;
    sim.state.counters['incident:seen:dog'] = 2;
    sim.player.pos = { x: sim.player.pos.x + 1, y: sim.player.pos.y };
    const saves = new SaveService(new MemoryStorage());
    saves.save(sim.captureState(), clock.now());
    const loaded = saves.load(clock.now());
    if (loaded.status !== 'ok') throw new Error(`load failed: ${loaded.status}`);
    expect(loaded.state).toEqual(sim.state);
    expect(loaded.state.player).toEqual({ map: 'incident', tile: sim.player.tile });
  });

  it('structurally invalid saves (no story, bad counters) are rejected', () => {
    const clock = new FakeClock();
    const storage = new MemoryStorage();
    const saves = new SaveService(storage);
    const state = structuredClone(street(undefined, clock).captureState()) as unknown as Record<string, unknown>;
    delete state.story;
    storage.set(saves.key, JSON.stringify(state));
    expect(saves.load(clock.now())).toMatchObject({ status: 'invalid', detail: expect.stringContaining('story') });
    storage.set(saves.key, JSON.stringify({ ...state, story: { chapter: 'S03', flags: {} }, counters: 'many' }));
    expect(saves.load(clock.now())).toMatchObject({ status: 'invalid', detail: expect.stringContaining('counters') });
  });

  it('a save from a newer version is refused and left untouched', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 99 });
    storage.set('tcss.save.slot1', raw);
    expect(new SaveService(storage).load(1)).toMatchObject({ status: 'unsupported' });
    expect(storage.get('tcss.save.slot1')).toBe(raw);
  });

  it('migrates an older save (café, farm and economy included) keeping only the story and the seen gags', () => {
    const storage = new MemoryStorage();
    storage.set('tcss.save.slot1', JSON.stringify({
      schemaVersion: 10, createdAt: 1, savedAt: 2,
      economy: { coins: 500 }, farm: { plots: {} }, cafe: {},
      player: { map: 'portal', tile: { x: 3, y: 4 } },
      story: { chapter: 'S04', flags: { stone_sight: true } },
      meta: { counters: { 'incident:seen:dog': 3, served: 9 } },
    }));
    const r = new SaveService(storage).load(5);
    expect(r).toMatchObject({ status: 'ok', migratedFrom: 10 });
    if (r.status !== 'ok') return;
    expect(r.state).toEqual({
      schemaVersion: SAVE_SCHEMA_VERSION, createdAt: 1, savedAt: 2,
      player: { map: 'portal', tile: { x: 3, y: 4 } },
      story: { chapter: 'S04', flags: { stone_sight: true } },
      counters: { 'incident:seen:dog': 3 },
    });
  });

  it('a save past chapter 2 (the removed chapter 3, or finished) starts chapter 1 again', () => {
    for (const chapter of ['S05', 'done']) {
      const storage = new MemoryStorage();
      storage.set('tcss.save.slot1', JSON.stringify({ schemaVersion: 10, createdAt: 1, savedAt: 2, player: { map: 'farm', tile: null }, story: { chapter, flags: { rated: true } }, meta: { counters: {} } }));
      const r = new SaveService(storage).load(5);
      if (r.status !== 'ok') throw new Error(r.status);
      expect(r.state.story).toEqual({ chapter: 'S03', flags: {} });
      expect(r.state.player).toEqual({ map: 'incident', tile: null });
    }
  });

  it('runs a chain of migrations in order up to the current version', () => {
    const clock = new FakeClock();
    const storage = new MemoryStorage();
    const v2 = structuredClone(street(undefined, clock).captureState()) as unknown as Record<string, unknown>;
    v2.schemaVersion = 2; // an older save, migrated through a custom 2 → 3 → 4 chain
    storage.set('tcss.save.slot1', JSON.stringify(v2));
    const order: number[] = [];
    const saves = new SaveService(storage, 'tcss.save.slot1', { 2: (raw) => (order.push(2), { ...raw, note: 'v3' }), 3: (raw) => (order.push(3), { ...raw, note: `${String(raw.note)}→v4` }) }, 4);
    const r = saves.load(clock.now());
    expect(r).toMatchObject({ status: 'ok', migratedFrom: 2 });
    expect(order).toEqual([2, 3]);
    if (r.status === 'ok') expect((r.state as unknown as Record<string, unknown>).note).toBe('v3→v4');
  });
});
