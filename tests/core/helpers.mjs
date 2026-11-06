import { apply } from '../../src/core/game.js';
import { createSave } from '../../src/core/state.js';

export const T0 = 1_800_000_000_000;

// A small harness that keeps state and a clock.
export function harness({ dev = true, now = T0 } = {}) {
  const h = {
    now, state: createSave(now, { gender: 'female', name: 'Test' }), events: [],
    act(type, payload = {}, txId) {
      const r = apply(h.state, { type, payload, txId }, { now: h.now, dev });
      if (r.ok) { h.state = r.state; h.events.push(...r.events); }
      return r;
    },
    must(type, payload, txId) {
      const r = h.act(type, payload, txId);
      if (!r.ok) throw new Error(`${type} failed: ${r.error} ${JSON.stringify(r.data ?? '')}`);
      return r;
    },
    tick(ms) { h.now += ms; },
    // Buy (if needed) and enter a region.
    go(regionId) {
      if (!(h.state.world.ownedRegions || []).includes(regionId)) h.must('world/unlockRegion', { regionId });
      return h.must('world/enterRegion', { regionId });
    },
    region() { return h.state.world.regions[h.state.world.currentRegion]; },
  };
  return h;
}

// Fast path to a playing state in region vn-1.
export function playing(opts) {
  const h = harness(opts);
  h.must('story/introDone');
  h.must('story/teacherDone');
  h.go('vn-1');
  return h;
}
