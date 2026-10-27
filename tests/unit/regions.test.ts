import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { createSession } from '../../src/core/session';
import { MemoryStorage, SaveService, validateState } from '../../src/gameplay/state/SaveService';
import { farmSim, runUntil } from './helpers';

function ready() {
  const { sim, clock } = farmSim();
  sim.enableTestMode();
  return { sim, clock };
}
function enter(sim: GameSimulation, id: string) {
  expect(sim.regions.canEnter(id)).toBe(true);
  return new GameSimulation(structuredClone(CONTENT.maps[id]!), CONTENT, { state: sim.prepareTravel(id), clock: sim.clock, rngSeed: 1 });
}

describe('regional land and business progression', () => {
  it('gates story, level, funds, ownership and construction without charging on failure', () => {
    const { sim } = farmSim();
    expect(sim.regions.buyLand('old_town')).toEqual({ ok: false, reason: 'storyNotDone' });
    sim.state.story.chapter = 'done';
    expect(sim.regions.buyLand('old_town')).toEqual({ ok: false, reason: 'regionLocked' });
    sim.state.progression.exp = 100000;
    expect(sim.regions.build('old_town', 'cafe')).toEqual({ ok: false, reason: 'landRequired' });
    const coins = sim.tx.coins;
    expect(sim.regions.buyLand('old_town')).toEqual({ ok: false, reason: 'insufficientCoins' });
    expect(sim.tx.coins).toBe(coins);
    expect(sim.regions.buyLand('unknown').ok).toBe(false);
    expect(sim.regions.canEnter('old_town__cafe')).toBe(false);
  });

  it('charges exactly once for land and each independent building', () => {
    const { sim } = ready();
    const before = sim.tx.coins;
    expect(sim.regions.buyLand('old_town').ok).toBe(true);
    expect(sim.regions.buyLand('old_town').ok).toBe(false);
    expect(sim.regions.canEnter('old_town__cafe')).toBe(false);
    expect(sim.regions.build('old_town', 'farm').ok).toBe(true);
    expect(sim.regions.canEnter('old_town__farm')).toBe(true);
    expect(sim.regions.canEnter('old_town__cafe')).toBe(false);
    expect(sim.regions.build('old_town', 'cafe').ok).toBe(true);
    expect(sim.regions.build('old_town', 'cafe').ok).toBe(false);
    expect(sim.tx.coins).toBe(before - 800 - 400 - 600);
  });

  it('runs the existing crop loop on regional plots and keeps origin progress separate', () => {
    const { sim } = ready();
    const origin = structuredClone(sim.state.farm);
    sim.regions.buyLand('old_town');
    sim.regions.build('old_town', 'farm');
    const regional = enter(sim, 'old_town__farm');
    const plot = regional.farm.allPlotViews().find((p) => !p.locked)!;
    expect(plot.id).toContain('old_town__farm:');
    expect(regional.farm.prepare(plot.id).ok).toBe(true);
    expect(regional.farm.plant(plot.id).ok).toBe(true);
    expect(regional.farm.water(plot.id).ok).toBe(true);
    expect(regional.farm.plot(plot.id)?.seedId).toBeTruthy();
    expect(regional.employees.hire('farmWorker').ok).toBe(true);
    expect(regional.state.farm).toEqual(origin);
    const restored = enter(regional, 'farm');
    expect(restored.state.farm).toEqual(origin);
    const back = enter(restored, 'old_town__farm');
    expect(back.farm.plot(plot.id)?.seedId).toBeTruthy();
    expect(back.employees.views()).toHaveLength(1);
  });

  it('keeps upgrades, payment identities and employees independent across cafes', () => {
    const { sim } = ready();
    sim.regions.buyLand('old_town'); sim.regions.build('old_town', 'cafe');
    const local = enter(sim, 'old_town__cafe');
    const upgrade = local.upgrades.view()[0]!.id;
    expect(local.upgrades.buy(upgrade).ok).toBe(true);
    expect(local.employees.hire('cashier').ok).toBe(true);
    expect(local.tx.execute({ reason: 'test', coins: 10, key: 'payment:1' }).ok).toBe(true);
    expect(local.tx.execute({ reason: 'test', coins: 10, key: 'payment:1' }).ok).toBe(false);
    const origin = enter(local, 'cafe');
    expect(origin.upgrades.level(upgrade)).toBe(0);
    expect(origin.employees.hire('cashier').ok).toBe(true);
    expect(origin.tx.execute({ reason: 'test', coins: 10, key: 'payment:1' }).ok).toBe(true);
    const back = enter(origin, 'old_town__cafe');
    expect(back.upgrades.level(upgrade)).toBe(1);
    expect(back.employees.views()).toHaveLength(1);
    expect(back.tx.execute({ reason: 'test', coins: 10, key: 'payment:1' }).ok).toBe(false);
  });

  it('saves pending regional payments, dirty tables, crops and construction and blocks URL bypass', () => {
    const { sim, clock } = ready();
    sim.regions.buyLand('old_town'); sim.regions.build('old_town', 'cafe');
    const local = enter(sim, 'old_town__cafe');
    const cafe = local.state.regions.old_town!.cafe;
    const pickup = local.world.allObjects().find((o) => o.type === 'pickup_point')!;
    cafe.payments.push({ id: 1, orderId: 1, customerId: 'customer-1', recipeId: 'espresso', objectId: pickup.id, coins: 25, tip: 2, exp: 3, createdAt: clock.now(), status: 'PENDING' });
    cafe.nextPaymentId = 2;
    cafe.dirtySeats.push('old_town__cafe:chair_1');
    const storage = new MemoryStorage(); const saves = new SaveService(storage);
    expect(saves.save(local.captureState(), clock.now())).toBe(true);
    const session = createSession({ content: CONTENT, persistent: true, storage, clock });
    expect(session.sim.map.id).toBe('old_town__cafe');
    expect(session.sim.state.regions.old_town!.cafe.dirtySeats).toEqual(cafe.dirtySeats);
    expect(validateState(session.sim.state)).toEqual([]);
    const coins = session.sim.tx.coins;
    expect(session.sim.cafe!.collectPayment(pickup.id).ok).toBe(true);
    expect(session.sim.cafe!.collectPayment(pickup.id).ok).toBe(false);
    expect(session.sim.tx.coins).toBe(coins + 25);
    const blocked = createSession({ content: CONTENT, persistent: true, storage, clock, mapId: 'riverside__cafe' });
    expect(blocked.sim.map.id).toBe('old_town__cafe');
    const broken = structuredClone(local.state); (broken.regions.old_town!.farm as unknown as {plots: null}).plots = null;
    expect(validateState(broken)).toContain('regions.old_town.farm.plots');
  });

  it('routes real regional customers and lets employees serve and create collectible revenue', () => {
    const { sim } = ready();
    sim.regions.buyLand('old_town'); sim.regions.build('old_town', 'cafe');
    const local = enter(sim, 'old_town__cafe');
    local.cafe!.open = false;
    for (const role of ['cashier', 'barista', 'server', 'cleaner']) expect(local.employees.hire(role).ok).toBe(true);
    local.cafe!.spawn('regular', 'espresso', 'takeaway');
    expect(runUntil(local, () => local.state.regions.old_town!.cafe.stats.served > 0, 120000)).toBe(true);
    expect(local.state.cafe.stats.served).toBe(0);
  });

  it('migrates v9 saves without changing the original farm, purse or cafe', () => {
    const { sim, clock } = ready();
    const raw = structuredClone(sim.state) as unknown as Record<string, unknown>;
    raw.schemaVersion = 9;
    delete raw.regions;
    const storage = new MemoryStorage();
    storage.set('tcss.save.slot1', JSON.stringify(raw));
    const loaded = new SaveService(storage).load(clock.now());
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('migration failed');
    expect(loaded.migratedFrom).toBe(9);
    expect(loaded.state.farm).toEqual(sim.state.farm);
    expect(loaded.state.economy).toEqual(sim.state.economy);
    expect(loaded.state.cafe).toEqual(sim.state.cafe);
    expect(loaded.state.regions).toEqual({});
  });

  it('harvests and sells real regional produce through the existing market', () => {
    const { sim, clock } = ready();
    sim.regions.buyLand('old_town'); sim.regions.build('old_town', 'farm');
    const local = enter(sim, 'old_town__farm');
    const plot = local.farm.allPlotViews().find((p) => !p.locked)!;
    local.farm.selectSeed('robusta');
    const seeds = local.tx.count('seed_robusta');
    expect(local.farm.prepare(plot.id).ok).toBe(true);
    expect(local.farm.plant(plot.id).ok).toBe(true);
    expect(local.tx.count('seed_robusta')).toBe(seeds - 1);
    expect(local.farm.water(plot.id).ok).toBe(true);
    clock.advance(60000); local.tick(1);
    expect(local.farm.water(plot.id).ok).toBe(true);
    clock.advance(60000); local.tick(1);
    expect(local.farm.harvest(plot.id).ok).toBe(true);
    expect(local.farm.harvest(plot.id).ok).toBe(false);
    const market = local.world.allObjects().find((o) => o.type === 'market_stall')!;
    local.clickObject(market.id);
    expect(runUntil(local, () => local.shops.isOpen('market'))).toBe(true);
    const before = local.tx.coins;
    const sale = local.market.sell('cherry_robusta', 10);
    expect(sale.ok).toBe(true);
    if (sale.ok) expect(local.tx.coins).toBe(before + sale.coins);
    expect(local.tx.count('cherry_robusta')).toBe(0);
  });

  it('bots buy supplies, produce and sell in their own saved economy', () => {
    const { sim, clock } = ready();
    sim.tick(1);
    const coins = sim.tx.coins;
    const farm = sim.neighbors.list().find((c) => c.businessKind === 'farm')!;
    expect(farm.controller).toBe('bot');
    clock.advance(75000); sim.tick(1);
    const later = sim.neighbors.visit(farm.id)!;
    expect(later.simulation!.sold).toBe(32);
    expect(later.simulation!.stock).toBe(0);
    expect(later.simulation!.coins).toBe(250 - 12 + 32 * 3);
    expect(sim.tx.coins).toBe(coins);
    expect(later.layout).toHaveLength(16);
  });
});
