import { describe, expect, it } from 'vitest';
import { masterStep, nextGuide } from '../../src/gameplay/guide/guide';
import type { SimulationSnapshot } from '../../src/gameplay/GameSimulation';

const quest = (id: string, counter: string, over: Record<string, unknown> = {}) => ({ id, counter, label: id, progress: 0, target: 5, done: false, claimed: false, locked: false, ...over });
const snap = (over: Record<string, unknown>): SimulationSnapshot =>
  ({
    story: { chapter: 'done' },
    cafe: null,
    farm: { plots: [{ locked: false, phase: 'EMPTY', needsWater: false }], can: { water: 4 }, seedToPlant: null },
    economy: { inventory: {} },
    meta: { quests: [quest('q_harvest', 'harvest'), quest('q_serve5', 'served'), quest('q_sell', 'sold')] },
    ...over,
  }) as unknown as SimulationSnapshot;

describe('story master step', () => {
  const cafe = (over: Record<string, unknown>) => snap({ story: { chapter: 'S05' }, cafe: { customers: [{ archetype: 'master', orderStatus: 'CREATED' }], brew: null, heldDrink: null, orders: [], ...over } });
  it('walks through take order → brew → serve', () => {
    expect(masterStep(cafe({}))).toContain('nhận order');
    expect(masterStep(cafe({ customers: [{ archetype: 'master', orderStatus: 'ACCEPTED' }] }))).toContain('máy xay');
    expect(masterStep(cafe({ brew: { current: { kind: 'timing', station: 'cafe_espresso' }, stepIndex: 1, steps: [1, 2, 3, 4] } }))).toContain('Bước 2/4');
    expect(masterStep(cafe({ heldDrink: { id: 'd' } }))).toContain('Mang ra');
    expect(masterStep(cafe({ customers: [] }))).toContain('bước ra quầy');
  });
});

describe('after-story guide', () => {
  it('always points the farm at the next action', () => {
    expect(nextGuide(snap({}))?.text).toContain('Cuốc đất');
    const plot = (phase: string, needsWater = false) => ({ farm: { plots: [{ locked: false, phase, needsWater }], can: { water: 4 }, seedToPlant: 'x' } });
    expect(nextGuide(snap(plot('PREPARED')))?.text).toContain('Gieo hạt');
    expect(nextGuide(snap(plot('GROWING', true)))?.text).toContain('Tưới');
    expect(nextGuide(snap(plot('READY')))?.text).toContain('Thu hoạch');
  });
  it('sends the café player to the farm when there are no roasted beans, and tells them to claim a finished quest', () => {
    const cafe = { customers: [], brew: null, heldDrink: null, orders: [] };
    expect(nextGuide(snap({ cafe, farm: { plots: [] } }))?.text).toContain('ra nông trại');
    const done = snap({ meta: { quests: [quest('q_harvest', 'harvest', { done: true, progress: 10, target: 10 })] } });
    expect(nextGuide(done)?.text).toContain('Nhận');
  });
  it('is silent during the story and once the tutorial quests are claimed', () => {
    expect(nextGuide(snap({ story: { chapter: 'S03' } }))).toBeNull();
    expect(nextGuide(snap({ meta: { quests: [quest('q_harvest', 'harvest', { claimed: true }), quest('q_sell', 'sold', { claimed: true })] } }))).toBeNull();
  });
});
