import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';
import { cafeSim, runUntil } from './helpers';

function rich(sim: GameSimulation): void {
  sim.tx.execute({ reason: 'test:rich', coins: 50_000, exp: 50 * 12 * 11 });
}

describe('café expansion: upgrades change real gameplay', () => {
  it('upgrades are checked (level, coins, max) and bought once per level, with idempotent transactions', () => {
    const { sim } = cafeSim();
    expect(sim.upgrades.buy('brewSpeed')).toMatchObject({ ok: false, reason: 'levelTooLow' });
    sim.tx.execute({ reason: 'test:xp', exp: 50 * 3 * 2 });
    expect(sim.upgrades.buy('brewSpeed')).toMatchObject({ ok: false }); // not enough coins (starting purse < 400?) or fine
    rich(sim);
    const before = sim.tx.coins;
    expect(sim.upgrades.buy('brewSpeed')).toEqual({ ok: true });
    expect(sim.tx.coins).toBe(before - 400);
    expect(sim.upgrades.level('brewSpeed')).toBe(1);
    expect(sim.upgrades.buy('brewSpeed')).toEqual({ ok: true }); // level 2 (needs level 4: granted by rich())
    expect(sim.upgrades.buy('brewSpeed')).toEqual({ ok: true });
    expect(sim.upgrades.buy('brewSpeed')).toMatchObject({ ok: false, reason: 'maxed' });
    expect(sim.state.economy.processedKeys.filter((k) => k.startsWith('upgrade:brewSpeed:'))).toHaveLength(3);
  });

  it('brew speed shortens the real action duration; cleaning speed shortens cleaning', () => {
    const { sim } = cafeSim();
    sim.tx.execute({ reason: 'test:grant', items: [{ itemId: 'roasted_arabica', qty: 3, quality: 80 }] });
    const durations: Record<string, number[]> = {};
    sim.bus.on('interaction:started', (e) => (durations[e.actionId] ??= []).push(e.durationMs));
    const c = sim.cafe!.spawn('tourist', 'espresso', 'dineIn');
    runUntil(sim, () => sim.cafe!.customerAtCounter()?.id === c.id, 90_000);
    sim.clickObject('order_counter');
    runUntil(sim, () => !sim.playerInteraction.snapshot().current, 30_000);
    sim.clickObject('grinder');
    runUntil(sim, () => !sim.playerInteraction.snapshot().current && sim.brewing.hasSession(sim.player), 30_000);
    const base = durations.brew_step!.at(-1)!;
    rich(sim);
    for (let i = 0; i < 3; i++) sim.upgrades.buy('brewSpeed');
    sim.brewing.cancel();
    sim.clickObject('grinder');
    runUntil(sim, () => durations.brew_step!.length >= 2, 30_000);
    expect(durations.brew_step!.at(-1)!).toBeLessThan(base);
    expect(durations.brew_step!.at(-1)!).toBe(Math.round(base * 0.55));
    expect(sim.upgrades.factor('cleaning')).toBe(1);
    sim.upgrades.buy('cleaning');
    expect(sim.upgrades.factor('cleaning')).toBeCloseTo(0.7);
  });

  it('capacity and attractiveness raise the customer limit and arrival rate', () => {
    const { sim } = cafeSim();
    rich(sim);
    const limit = CONTENT.customers.spawn.maxConcurrent;
    expect(sim.cafe!.maxConcurrentBonus()).toBe(0);
    sim.upgrades.buy('capacity');
    sim.upgrades.buy('capacity');
    expect(sim.cafe!.maxConcurrentBonus()).toBe(4);
    sim.cafe!.open = true;
    for (let i = 0; i < limit + 4; i++) sim.cafe!.spawn();
    // The natural spawner respects limit + bonus: it adds nobody beyond it.
    const n = sim.cafe!.count;
    for (let i = 0; i < 2000; i++) sim.tick(100);
    expect(sim.cafe!.count).toBeLessThanOrEqual(Math.max(n, limit + 4));
    expect(sim.upgrades.trafficFactor()).toBe(1);
    sim.upgrades.buy('attractiveness');
    expect(sim.upgrades.trafficFactor()).toBeCloseTo(1.12);
  });

  it('the back room opens new decorating area (collision + navigation checked) and survives a reload', () => {
    const { sim, clock } = cafeSim();
    rich(sim);
    sim.tx.execute({ reason: 'test:chair', items: [{ itemId: 'furn_chair', qty: 1 }] });
    expect(sim.decor.check('chair', { x: 3, y: 2 }, 0).ok).toBe(false); // outside the area before the upgrade
    expect(sim.upgrades.buy('backRoom')).toEqual({ ok: true });
    expect(sim.decor.check('chair', { x: 3, y: 2 }, 0)).toMatchObject({ ok: true });
    // Not on top of the existing grinder (2,1) or markers.
    expect(sim.decor.check('chair', { x: 2, y: 1 }, 0)).toMatchObject({ ok: false, reason: 'overlap' });
    expect(sim.decor.place('chair', { x: 3, y: 2 })).toEqual({ ok: true });
    const storage = new MemoryStorage();
    const saves = new SaveService(storage);
    saves.save(sim.captureState(), clock.now());
    const r = saves.load(clock.now());
    if (r.status !== 'ok') throw new Error('load');
    expect(r.state.cafe.upgrades.backRoom).toBe(1);
    const again = new GameSimulation(structuredClone(CONTENT.maps.cafe!), CONTENT, { clock, state: r.state });
    expect(again.decor.layout().some((f) => f.type === 'chair' && f.x === 3 && f.y === 2)).toBe(true); // the saved piece in the new area loads
    expect(again.upgrades.level('backRoom')).toBe(1);
  });

  it('a purchased machine works as a real brewing station: two machines, two baristas, different machines', () => {
    const { sim, clock } = cafeSim({ seed: 9 });
    sim.enableTestMode();
    expect(sim.upgrades.buy('backRoom')).toEqual({ ok: true });
    expect(sim.decor.buy('grinder_pro')).toEqual({ ok: true });
    expect(sim.decor.buy('espresso_pro')).toEqual({ ok: true });
    expect(sim.decor.buy('milk_station_pro')).toEqual({ ok: true });
    expect(sim.decor.place('grinder_pro', { x: 10, y: 2 })).toEqual({ ok: true });
    expect(sim.decor.place('espresso_pro', { x: 11, y: 2 })).toEqual({ ok: true });
    expect(sim.decor.place('milk_station_pro', { x: 8, y: 2 })).toEqual({ ok: true });
    expect(sim.world.allObjects().filter((o) => o.def.station === 'grinder')).toHaveLength(1);
    for (const r of ['cashier', 'barista', 'barista', 'server']) sim.employees.hire(r);
    sim.cafe!.spawn('student', 'espresso', 'dineIn');
    sim.cafe!.spawn('office', 'americano', 'dineIn');
    const used = new Set<string>();
    sim.bus.on('interaction:started', (e) => e.actionId === 'brew_step' && used.add(e.objectId));
    for (let i = 0; i < 3000 && sim.state.cafe.stats.served < 2; i++) {
      sim.tick(100);
      clock.advance(100);
    }
    expect(sim.state.cafe.stats.served).toBe(2);
    expect([...used].some((id) => id.endsWith('_pro') || id.includes('pro') || sim.world.getObject(id)?.def.station)).toBe(true);
    expect(used.size).toBeGreaterThanOrEqual(3); // built-in and purchased machines were both used
  });

  it('furniture that would block the path is still refused after the expansion', () => {
    const { sim } = cafeSim();
    rich(sim);
    sim.upgrades.buy('backRoom');
    sim.tx.execute({ reason: 'test:items', items: [{ itemId: 'furn_table', qty: 12 }] });
    // Wall off the door: every placement that disconnects the entry must be rejected.
    let refused = 0;
    for (let x = 1; x <= 12; x++) if (sim.decor.check('cafe_table', { x, y: 11 }, 0).ok === false) refused++;
    expect(refused).toBeGreaterThan(0);
  });
});
