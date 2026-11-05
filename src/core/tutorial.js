// Interactive tutorial: one action at a time, derived from the save (never stuck after reload: the current step is
// simply the first step whose goal is not met yet). The scene shows an arrow + tap hand on `target`, the HUD a short tip.
// target kinds: plot (any owned plot matching `plot`), building (by type), parcel (by id), ui (HUD button id).
import { region } from './derive.js';

export const STEPS = [
  { id: 'plant', target: { kind: 'plot', want: 'empty' }, done: s => s.stats.planted > 0 },
  { id: 'harvest', target: { kind: 'plot', want: 'planted' }, done: s => s.stats.harvested > 0 },
  { id: 'takeOrder', target: { kind: 'building', type: 'orderCounter' }, done: s => s.stats.served > 0 || orders(s).some(o => o.stage !== 'waiting') },
  { id: 'brew', target: { kind: 'building', type: 'brewCounter' }, done: s => s.stats.served > 0 || orders(s).some(o => o.stage === 'brewing') },
  { id: 'serve', target: { kind: 'building', type: 'brewCounter' }, done: s => s.stats.served > 0 },
  { id: 'build', target: { kind: 'ui', id: 'build' }, buildType: 'roaster', done: s => s.stats.built > 0 },
  { id: 'upgrade', target: { kind: 'building', type: 'silo' }, done: s => s.stats.upgraded > 0 },
  { id: 'buyLand', target: { kind: 'parcel', id: 'F2' }, done: s => s.stats.parcels > 0 },
];
function orders(s) { return region(s)?.shop.orders || []; }

/** @returns {null | {index:number, step:object}} null when the tutorial is over or not applicable */
export function currentStep(s) {
  if (s.tutorial.done || s.story.phase !== 'play' || !s.world.currentRegion) return null;
  const index = STEPS.findIndex(step => !step.done(s));
  if (index < 0) return null;
  return { index, step: STEPS[index] };
}
export const tutorialFinished = s => s.tutorial.done || STEPS.every(step => step.done(s));
