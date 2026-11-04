import { CROPS, MACHINES, plotCare, cropById } from './content.js';
import { acceptsTool, toolCapacity } from './tools.js';

// Auto mode brain for the owner on the farm (docs/shared/crew-autoplay.md 5).
// Same urgency idea as the crew planner: score = priority × 10 − 1.2 × distance; a job someone already claimed is skipped,
// so the owner never doubles up with a worker. Returns { id, action, choice, hint } or null.
const PRIORITY = { harvest: 6, collect: 5, water: 4.5, turn: 4, start: 3.5, weed: 3, plant: 2.5, fertilize: 2, prune: 1, refill: 4.5 };
export function pickAutoTask(p, { level, claimed, position, positionOf, at = Date.now() }) {
  const options = [];
  const add = (id, action, choice = null) => { if (!claimed(id, action)) options.push({ id, action, choice }); };
  let thirsty = false;
  for (const plot of p.plots.filter(t => t.unlocked)) {
    const care = plotCare(plot);
    if (care.ready) add(plot.id, 'harvest');
    if (care.needsWater) { if (p.water > 0) add(plot.id, 'water'); else thirsty = true; }
    if (care.needsWeeding) add(plot.id, 'weed');
    if (care.empty) {
      const wanted = p.directives?.plantCrop, crop = [wanted, ...CROPS.map(c => c.id)].find(id => cropById(id) && acceptsTool(plot, 'plant', id, level) && toolCapacity(p, 'plant', id) > 0);
      if (crop) add(plot.id, 'plant', crop);
    }
    if (care.canFeed && p.fertilizer > 0) add(plot.id, 'fertilize');
    if (acceptsTool(plot, 'prune', null, level)) add(plot.id, 'prune');
  }
  if (thirsty && p.reservoir >= 1) add('well', 'refill');
  for (const m of MACHINES) {
    const state = p.machines[m.id], jobs = [...(state.batch ? [state.batch] : []), ...state.extraBatches];
    if (jobs.some(j => j.readyAt <= at)) add(m.id, 'collect');
    if (m.id === 'dryer' && jobs.some(j => !j.turned && at >= (j.startedAt + j.readyAt) / 2 && at < j.readyAt)) add(m.id, 'turn');
    if (m.id === 'grinder' || jobs.filter(j => j.readyAt > at).length >= 3) continue;
    for (const c of CROPS) {
      const n = Math.floor((p.stock[m.input]?.[c.id] || 0) / m.inputCount);
      if (n) { add(m.id, 'start', { cropId: c.id, quantity: Math.min(n, Math.floor(m.capacity / m.inputCount)) }); break; }
    }
  }
  let best = null, bestScore = -Infinity;
  for (const o of options) {
    const pos = positionOf(o.id); if (!pos) continue;
    const score = PRIORITY[o.action] * 10 - 1.2 * Math.hypot(pos[0] - position.x, pos[1] - position.z);
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

// When no field job is left: the owner's errands, in this order (crew-autoplay.md 5). Returns { id, action, choice, key, button } or null.
// key = caption key (crew.auto.errand.<key>), button = HUD control the hand points at before Auto does it.
// skip(key): errands that just failed (cooldown kept by the caller), so Auto moves on instead of retrying every tick.
export function pickAutoErrand(p, { regionKind, level, skip = () => false }) {
  const roasted = id => p.stock.roasted?.[id] || 0;
  const order = p.orders.find(o => o.source !== 'shop' && o.status === 'open' && roasted(o.cropId) >= o.grams);
  if (order && p.coins >= 2 && !skip('shipOrder')) return { id: 'orders', action: 'shipOrder', choice: order.id, key: 'shipOrder', button: 'order-board' };
  const shop = p.order;
  if (shop && !skip('marketOrder') && (p.stock[shop.product]?.[shop.cropId] || 0) >= shop.quantity) return { id: 'market', action: 'order', choice: shop.id, key: 'marketOrder', button: 'seed-shop' };
  const crop = CROPS.find(c => roasted(c.id) >= 100);
  // Beans already on the way count, or Auto would send a trip every tick until the first one arrives.
  const cafeBeans = Object.values(p.cafe?.stock?.roasted || {}).reduce((sum, n) => sum + n, 0) + (p.cafe?.shipments || []).reduce((sum, trip) => sum + trip.lots.reduce((n, l) => n + l.grams, 0), 0);
  if (crop && regionKind === 'both' && cafeBeans < 400 && p.coins >= 2 && !skip('shipCafe')) return { id: 'cafe', action: 'ship', choice: crop.id, key: 'shipCafe', button: 'order-board' };
  if (crop && regionKind === 'farm' && !skip('sell')) return { id: 'market', action: 'sell', choice: `roasted:${crop.id}`, key: 'sell', button: 'seed-shop' };
  // Out of seedlings with empty plots: buy the planting crop (or the cheapest unlocked), keeping 20 coins in hand.
  const empty = p.plots.filter(t => t.unlocked && t.stage === 'empty').length;
  if (empty && !skip('buySeed') && !CROPS.some(c => c.level <= level && p.seeds[c.id] > 0)) {
    const seed = [cropById(p.directives?.plantCrop), ...CROPS].find(c => c && c.level <= level && p.coins - 20 >= c.seedPrice);
    const quantity = seed ? Math.min(empty, 12, Math.floor((p.coins - 20) / seed.seedPrice)) : 0;
    if (quantity >= 1) return { id: 'seed-shop', action: 'buySeed', choice: { cropId: seed.id, quantity }, key: 'buySeed', button: 'seed-shop' };
  }
  return null;
}
