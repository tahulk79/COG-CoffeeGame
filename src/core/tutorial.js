// Interactive tutorial: one action at a time, derived from the save (never stuck after reload: the current step is
// simply the first step whose goal is not met yet). The scene shows an arrow + tap hand on `target`, the HUD a short tip.
// target kinds: plot (any owned plot matching `plot`), building (by type), parcel (by id), ui (HUD button id).
//
// The farm and the café are two separate games (s.mode): each has its own short tutorial track, shown only while
// that game is on screen. A track ends when all its steps are met or when the player skips it (tutorial.<track>Done).
import { region } from './derive.js';

export const FARM_STEPS = [
  { id: 'plant', target: { kind: 'plot', want: 'empty' }, done: s => s.stats.planted > 0 },
  { id: 'harvest', target: { kind: 'plot', want: 'planted' }, done: s => s.stats.harvested > 0 },
  { id: 'sell', target: { kind: 'building', type: 'silo' }, done: s => (s.stats.sold || 0) > 0 || s.stats.served > 0 },
  { id: 'upgrade', target: { kind: 'building', type: 'silo' }, done: s => s.stats.upgraded > 0 },
  { id: 'buyLand', target: { kind: 'parcel', id: 'F2' }, done: s => s.stats.parcels > 0 },
];
export const CAFE_STEPS = [
  { id: 'takeOrder', target: { kind: 'building', type: 'orderCounter' }, done: s => s.stats.served > 0 || orders(s).some(o => o.stage !== 'waiting') },
  { id: 'brew', target: { kind: 'building', type: 'brewCounter' }, done: s => s.stats.served > 0 || orders(s).some(o => o.stage === 'brewing') },
  { id: 'serve', target: { kind: 'building', type: 'brewCounter' }, done: s => s.stats.served > 0 },
  { id: 'build', target: { kind: 'ui', id: 'build' }, buildType: 'roaster', done: s => s.stats.built > 0 },
];
export const TRACKS = { farm: FARM_STEPS, cafe: CAFE_STEPS };
/** @deprecated both tracks in one list (kept for tools / tests that list every step). */
export const STEPS = [...FARM_STEPS, ...CAFE_STEPS];
function orders(s) { return region(s)?.shop.orders || []; }

const trackDone = (s, track) => !!(s.tutorial.done || s.tutorial[`${track}Done`]);

/**
 * @param {object} s save
 * @param {'farm'|'cafe'} [track] the game on screen (default: s.mode, else the farm)
 * @returns {null | {index:number, step:object, track:string}} null when that track is over or not applicable
 */
export function currentStep(s, track = s.mode || 'farm') {
  const steps = TRACKS[track];
  if (!steps || trackDone(s, track) || s.story.phase !== 'play' || !s.world.currentRegion) return null;
  const index = steps.findIndex(step => !step.done(s));
  if (index < 0) return null;
  return { index, step: steps[index], track };
}
export const tutorialFinished = (s, track) => (track ? trackDone(s, track) || TRACKS[track].every(step => step.done(s))
  : Object.keys(TRACKS).every(t => tutorialFinished(s, t)));
