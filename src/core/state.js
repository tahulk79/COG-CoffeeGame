// Save schema v3 (Farm & Café V3). Stored under its own localStorage key, so the old v1 save is never overwritten.
import { START, BUILDINGS, STAFF } from './config/economy.js';
import { COUNTRIES } from './config/world.js';

export const SCHEMA = 3;
export const PHASES = ['select', 'intro', 'teacher', 'gate', 'play', 'expiry', 'chooseRegion'];

export function createSave(now = Date.now(), character = null) {
  return {
    schema: SCHEMA,
    createdAt: now,
    updatedAt: now,
    rev: 0,
    character: character ? { gender: character.gender === 'male' ? 'male' : 'female', name: String(character.name || '').slice(0, 20) } : null,
    story: { phase: character ? 'intro' : 'select', teacherMet: false, level10Done: false, expiry: null, seen: {} },
    player: { coins: START.coins, xp: 0, round: 1 },
    rebirth: { credits: 0, granted: false, used: 0, purchased: 0, blessings: { grow: 0, price: 0, xp: 0 }, history: [] },
    inventory: { beans: 0 },
    world: {
      startCountry: null,
      currentRegion: null,
      countries: Object.fromEntries(Object.values(COUNTRIES).filter(c => c.starter).map(c => [c.id, { unlocked: true }])),
      regions: {},
    },
    staff: { units: [] },
    tutorial: { step: 0, done: false },
    stats: { harvested: 0, planted: 0, served: 0, built: 0, upgraded: 0, parcels: 0, earned: 0 },
    tx: [],
    nextUid: 1,
  };
}

const num = (v, d = 0, min = -Infinity, max = Infinity) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;

// Defensive normalization: fills missing fields from a fresh save, clamps numbers. Never throws.
export function normalizeSave(raw, now = Date.now()) {
  const base = createSave(now);
  const s = obj(raw);
  if (!s || s.schema !== SCHEMA) return null;
  const out = { ...base, ...s };
  out.character = obj(s.character) && (s.character.gender === 'male' || s.character.gender === 'female')
    ? { gender: s.character.gender, name: String(s.character.name || '').slice(0, 20) } : null;
  out.story = { ...base.story, ...obj(s.story) };
  if (!PHASES.includes(out.story.phase)) out.story.phase = out.character ? 'intro' : 'select';
  out.story.seen = obj(out.story.seen) || {};
  out.player = { ...base.player, ...obj(s.player) };
  out.player.coins = num(out.player.coins, base.player.coins, 0, 1e15);
  out.player.xp = num(out.player.xp, 0, 0, 1e12);
  out.player.round = num(out.player.round, 1, 1, 3) | 0;
  out.rebirth = { ...base.rebirth, ...obj(s.rebirth) };
  out.rebirth.credits = num(out.rebirth.credits, 0, 0, 999) | 0;
  out.rebirth.blessings = { ...base.rebirth.blessings, ...obj(out.rebirth.blessings) };
  if (!Array.isArray(out.rebirth.history)) out.rebirth.history = [];
  out.inventory = { ...base.inventory, ...obj(s.inventory) };
  out.inventory.beans = num(out.inventory.beans, 0, 0, 1e9) | 0;
  out.world = { ...base.world, ...obj(s.world) };
  out.world.countries = { ...base.world.countries, ...obj(out.world.countries) };
  out.world.regions = obj(out.world.regions) || {};
  for (const [id, r] of Object.entries(out.world.regions)) out.world.regions[id] = normalizeRegion(r);
  out.staff = { units: Array.isArray(s.staff?.units) ? s.staff.units.filter(u => obj(u) && typeof u.type === 'string' && Object.hasOwn(STAFF, u.type)) : [] };
  out.tutorial = { ...base.tutorial, ...obj(s.tutorial) };
  out.stats = { ...base.stats, ...obj(s.stats) };
  out.tx = Array.isArray(s.tx) ? s.tx.slice(-64) : [];
  out.nextUid = num(s.nextUid, 1, 1) | 0;
  return out;
}

// Layout 2 (café split out of the farm into its own area): saves made with layout 1 had the café block on the farm at
// S [4,2,16,14] and a Round-2 café lot B3 [18,2,28,12]. Shift those buildings into the café area and rename B3 → C2.
export const LAYOUT_VERSION = 2;
const OLD_CAFE_RECTS = [[4, 2, 16, 14], [18, 2, 28, 12]];
const CAFE_SHIFT = { x: -10, z: 100 };
function migrateLayout(v) {
  if (v.layout === LAYOUT_VERSION) return v;
  const inOld = b => OLD_CAFE_RECTS.some(([x0, z0, x1, z1]) => b.x >= x0 && b.x <= x1 && b.z >= z0 && b.z <= z1);
  const buildings = Array.isArray(v.buildings) ? v.buildings.map(b => (obj(b) && Number.isFinite(b.x) && Number.isFinite(b.z) && (BUILDINGS[b.type]?.zone === 'shop' || inOld(b)) && b.z < 50
    ? { ...b, x: b.x + CAFE_SHIFT.x, z: b.z + CAFE_SHIFT.z } : b)) : v.buildings;
  const parcels = Array.isArray(v.parcels) ? v.parcels.map(id => (id === 'B3' ? 'C2' : id)) : v.parcels;
  return { ...v, buildings, parcels };
}

export function normalizeRegion(r) {
  const v = migrateLayout(obj(r) || {});
  return {
    layout: LAYOUT_VERSION,
    status: ['active', 'idle', 'expired'].includes(v.status) ? v.status : 'idle',
    enteredAt: num(v.enteredAt, 0), expiredAt: num(v.expiredAt, 0),
    parcels: Array.isArray(v.parcels) ? [...new Set(v.parcels)] : [],
    roads: Array.isArray(v.roads) ? [...new Set(v.roads)] : [],
    buildings: Array.isArray(v.buildings) ? v.buildings.filter(b => obj(b) && typeof b.type === 'string' && Object.hasOwn(BUILDINGS, b.type)) : [],
    plots: obj(v.plots) || {},
    shop: { orders: Array.isArray(v.shop?.orders) ? v.shop.orders : [], nextOrder: num(v.shop?.nextOrder, 1) },
  };
}

export const clone = value => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
