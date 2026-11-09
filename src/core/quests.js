// Danh sách nhiệm vụ nông trại (founder 2026-11-09): a list of goals with coin + XP rewards. The player can finish them by
// hand and claim them in the Quests sheet; a running Auto run works through the whole list (RPG-style auto: game.js auto/tick).
// Pure: progress is read from the save (s.stats and what stands on the farm), only the claims are stored (s.quests).
// Farm only, like Auto. When the fixed chain is claimed, an endless series of "loop" quests follows, one at a time.
import { level, stored, countOf, zoneUnits, ownedPlots, region, buildError, buildCost, snapPosition, placementError, staffError, freeHire, nextEstate, parcelError, parcelCost } from './derive.js';
import { AUTO, STAFF } from './config/economy.js';
import { PARCELS, areaOfParcel } from './config/layout.js';

const stat = (id, key, n, coins, xp) => ({ id, kind: 'stat', key, n, coins, xp });
const fields = (id, n, coins, xp) => ({ id, kind: 'fields', key: 'fields', n, coins, xp });
const building = (id, key, n, coins, xp) => ({ id, kind: 'building', key, n, coins, xp });
const staff = (id, n, coins, xp) => ({ id, kind: 'staff', key: 'staff', n, coins, xp });
const lvl = (id, n, coins, xp) => ({ id, kind: 'level', key: 'level', n, coins, xp });

// Rewards are a first pass: small next to what the same steps earn. Ids are stored in saves: never rename one.
export const QUESTS = [
  stat('plant3', 'planted', 3, 20, 2), stat('harvest3', 'harvested', 3, 20, 2), stat('sell1', 'sold', 1, 30, 2),
  fields('fields4', 4, 40, 3), stat('plant10', 'planted', 10, 40, 3), stat('harvest10', 'harvested', 10, 40, 3),
  building('silo1', 'silo', 1, 50, 3), staff('staff1', 1, 60, 4), fields('fields8', 8, 60, 4), lvl('level3', 3, 60, 3),
  stat('earn500', 'earned', 500, 80, 5), stat('harvest30', 'harvested', 30, 80, 5), building('well1', 'well', 1, 80, 5),
  staff('staff2', 2, 100, 5), lvl('level5', 5, 100, 4), stat('earn2000', 'earned', 2000, 120, 6), stat('parcel1', 'parcels', 1, 150, 8),
  fields('fields12', 12, 120, 6), staff('staff3', 3, 120, 6), stat('harvest60', 'harvested', 60, 120, 6), building('silo2', 'silo', 2, 120, 6),
  lvl('level8', 8, 150, 5), stat('harvest90', 'harvested', 90, 150, 6), stat('earn5000', 'earned', 5000, 200, 8), stat('harvest120', 'harvested', 120, 200, 8),
  staff('staff5', 5, 200, 8), fields('fields16', 16, 200, 8), stat('parcel2', 'parcels', 2, 300, 10), stat('harvest200', 'harvested', 200, 300, 10), stat('earn10000', 'earned', 10000, 400, 13),
];
// No planting goals past the early game: a coffee tree regrows for years, so plantings stop once the fields are full.
const LOOP = [{ key: 'harvested', base: 200, step: 100 }, { key: 'earned', base: 10000, step: 5000 }];
const loopQuest = k => { const c = LOOP[k % LOOP.length], round = Math.floor(k / LOOP.length) + 1; return { ...stat(`loop${k}`, c.key, c.base + c.step * round, Math.min(600, 200 + 50 * round), 8), loop: true }; };

function valueOf(s, q) {
  if (q.kind === 'stat') return s.stats[q.key] || 0;
  if (q.kind === 'fields') return ownedPlots(s).length;
  if (q.kind === 'building') return countOf(s, q.key);
  if (q.kind === 'staff') return zoneUnits(s, 'farm').length;
  return level(s);
}
const withProgress = (s, q) => { const value = valueOf(s, q); return { ...q, value, done: value >= q.n }; };

/** Every quest not claimed yet, in order, with { value, done }. */
export function questList(s) {
  const claimed = new Set(s.quests?.claimed || []), open = QUESTS.filter(q => !claimed.has(q.id));
  return (open.length ? open : [loopQuest(s.quests?.loop || 0)]).map(q => withProgress(s, q));
}
export const questCount = s => ({ claimed: (s.quests?.claimed || []).length + (s.quests?.loop || 0), total: QUESTS.length });
export const questsReady = s => questList(s).filter(q => q.done).length;
export const questById = (s, id) => questList(s).find(q => q.id === id) || null;

// A free spot for `type` on the owned farm land, scanning each lot in tidy rows. Null when the land is full.
function spotFor(s, type, step) {
  for (const id of region(s)?.parcels || []) {
    if (areaOfParcel(id) !== 'farm') continue;
    const [x0, z0, x1, z1] = PARCELS[id].rect;
    for (let z = z0; z <= z1; z += step) for (let x = x0; x <= x1; x += step) {
      const p = snapPosition(type, x, z, 0);
      if (placementError(s, type, p.x, p.z, 0) === null) return p;
    }
  }
  return null;
}
const HIRES = ['picker', 'planter', 'waterer', 'pruner', 'hauler'];

/**
 * The next step Auto can buy or do for a quest now: { act, payload } or null. Goals the farm work reaches by itself
 * (harvest, plant, earn, level) need no step. A quest it cannot pay for yet is passed over, so one never blocks the list;
 * it keeps AUTO.questReserve coins for seeds.
 */
export function nextQuestAct(s) {
  const spare = s.player.coins - AUTO.questReserve;
  const place = (type, step) => {
    if (buildError(s, type) || buildCost(s, type) > spare) return null;
    const p = spotFor(s, type, step);
    return p ? { act: 'build/place', payload: { type, x: p.x, z: p.z } } : null;
  };
  for (const q of questList(s)) {
    if (q.done) continue;
    let step = null;
    if (q.key === 'sold') { if (stored(s) > 0) step = { act: 'farm/sellAll', payload: {} }; }
    else if (q.key === 'parcels') { const e = nextEstate(s); if (e && !parcelError(s, e.seed) && parcelCost(e.seed) <= spare) step = { act: 'land/buyParcel', payload: { parcelId: e.seed } }; }
    else if (q.kind === 'fields') step = place('field', 3.2);
    else if (q.kind === 'building') step = place(q.key, 2.5);
    else if (q.kind === 'staff') {
      const team = zoneUnits(s, 'farm'), have = t => team.filter(u => u.type === t).length;
      const type = HIRES.filter(t => !staffError(s, t) && (freeHire(s) || STAFF[t].cost <= spare)).sort((a, b) => have(a) - have(b))[0];
      if (type) step = { act: 'staff/hire', payload: { type } };
    }
    if (step) return step;
  }
  return null;
}
