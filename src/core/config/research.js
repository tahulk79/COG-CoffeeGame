// Research lab, step 1: drink recipes (docs/design/research.md). Founder: growth is the player's own job — the general
// manager only brews what you already found. Every local menu item of a country (config/menus.js) hides a recipe:
// its base drink + a set of 0–3 ingredients. The first plain item of each base is known from the start (0 ingredients);
// the others are found at the test bench (research/test): base + up to 3 ingredients, hints like a colour-guessing game.
// A found recipe sells for priceMul × the base price and customers of that country order it foundWeight × as often.
import { COUNTRY_MENUS } from './menus.js';

export const INGREDIENTS = {
  condensed: { id: 'condensed', icon: '🥫', cost: 2, level: 1, tag: 'sweet' },
  milk: { id: 'milk', icon: '🥛', cost: 2, level: 1, tag: 'creamy' },
  sugar: { id: 'sugar', icon: '🍯', cost: 1, level: 1, tag: 'sweet' },
  ice: { id: 'ice', icon: '🧊', cost: 1, level: 1, tag: 'cold' },
  salt: { id: 'salt', icon: '🧂', cost: 1, level: 2, tag: 'salty' },
  egg: { id: 'egg', icon: '🥚', cost: 3, level: 2, tag: 'creamy' },
  coconut: { id: 'coconut', icon: '🥥', cost: 4, level: 4, tag: 'creamy' },
  cacao: { id: 'cacao', icon: '🍫', cost: 4, level: 6, tag: 'bitterSweet' },
};
export const INGREDIENT_ORDER = ['condensed', 'milk', 'sugar', 'ice', 'salt', 'egg', 'coconut', 'cacao'];
export const RESEARCH = { maxIngredients: 3, testSeconds: 20, priceMul: 1.35, foundWeight: 2, testsKeep: 8, xpFound: 10 };

// A menu icon that names an ingredient (🧊 iced, 🥚 egg, 🧂 salt…); drip / tea / nut icons name none.
const ICON_INGREDIENT = { '🧊': 'ice', '🥚': 'egg', '🧂': 'salt', '🥥': 'coconut', '🍫': 'cacao', '🍯': 'sugar', '🍬': 'sugar', '🌼': 'sugar', '🍓': 'sugar', '🍦': 'milk', '🍨': 'ice', '✨': 'milk', '🥫': 'sugar' };
const CONDENSED_COUNTRIES = new Set(['vn', 'id', 'my', 'tw']); // milk coffee is made with condensed milk there
const SIZE = { espresso: 1, milk: 2, latte: 2 };
// Hand-written where we know the real drink (Vietnam, the founder's home market); the rest is generated below.
const HAND = {
  vn: [['ice', 'sugar'], ['condensed', 'ice'], ['condensed', 'milk'], ['egg', 'condensed', 'sugar'], ['salt', 'condensed', 'milk'], [], [], ['ice']],
};
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = str => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const cache = new Map();
/** Every recipe of a country: [{ index, base, ings: sorted ingredient ids }] — pure, cached, unique per base. */
export function countryRecipes(cc) {
  if (cache.has(cc)) return cache.get(cc);
  const menu = COUNTRY_MENUS[cc] || [];
  const out = [], seen = new Set(), plainUsed = new Set();
  menu.forEach((item, index) => {
    let ings;
    if (HAND[cc]) ings = [...HAND[cc][index]];
    else {
      const r = rng(hash(`${cc}:${index}`));
      const want = new Set();
      if (ICON_INGREDIENT[item.icon]) want.add(ICON_INGREDIENT[item.icon]);
      if (item.base !== 'espresso' && !want.has('milk')) want.add(CONDENSED_COUNTRIES.has(cc) ? 'condensed' : 'milk');
      const plain = item.icon === { espresso: '☕', milk: '🥛', latte: '🍮' }[item.base] && !plainUsed.has(item.base);
      if (plain) { plainUsed.add(item.base); want.clear(); }
      else {
        const pool = ['sugar', 'ice', 'milk', 'condensed', 'salt', 'egg'].filter(x => !want.has(x));
        while (want.size < SIZE[item.base]) want.add(pool.splice(Math.floor(r() * pool.length), 1)[0]);
      }
      ings = [...want];
    }
    ings.sort();
    // Never two identical recipes of one base in a country: add the next ingredient until unique.
    let key = `${item.base}|${ings.join(',')}`;
    for (const extra of INGREDIENT_ORDER) {
      if (!seen.has(key) || ings.length >= RESEARCH.maxIngredients) break;
      if (!ings.includes(extra)) { ings = [...ings, extra].sort(); key = `${item.base}|${ings.join(',')}`; }
    }
    seen.add(key);
    out.push({ index, base: item.base, ings });
  });
  cache.set(cc, out);
  return out;
}

// ---------- Research step 2: suppliers and buyers (docs/design/research.md) ----------
// Café supply groups: beans (what shop/buyBeans costs), milk and pantry (the ingredients of found recipes). Each region
// has the market (always there, no contract) and SUPPLY.perGroup suppliers you find by scouting (coins + real time),
// then sign for 1 or 7 real days. A supplier: priceMul, quality ★1–3 (cup price bonus), late (chance a delivery is
// late — beans arrive later, a recipe cup runs out of its ingredient and sells as the base drink). Farm buyers: the
// storehouse (×1) and SUPPLY.buyers.count buyers you find, whose prices swing every real day; choose one for today or
// lock today's prices for a few days. The general manager never scouts, signs or locks (advice only).
export const SUPPLY = {
  groups: { beans: { icon: '🫘' }, milk: { icon: '🥛', ings: ['condensed', 'milk'] }, pantry: { icon: '🧺', ings: ['sugar', 'ice', 'salt', 'egg', 'coconut', 'cacao'] } },
  groupOrder: ['beans', 'milk', 'pantry'],
  perGroup: 3, scout: { cost: 40, minutes: 5 },
  contractFee: 30, contractDays: { 1: 1, 7: 5 }, // fee = contractFee × multiplier
  market: { priceMul: 1, quality: 1, late: 0.15 },
  qualityBonus: [0, 0, 0.05, 0.1], // cup price bonus by ★ (index = stars)
  cupIngredientShare: 0.5, // a served recipe cup uses half of the bench's ingredient cost
  lateSeconds: 45,
  buyers: { count: 3, swing: [0.85, 1.3], lockFee: 50, lockDays: [1, 3] },
  supplierNames: ['Chợ đầu mối', 'HTX Cầu Đất', 'Đại lý Hưng Phát', 'Trang trại Mộc Châu', 'Nhà phân phối Sao Mai', 'Tạp hoá Bà Sáu', 'Công ty Đại Việt', 'Vựa Tư Lùn'],
  buyerNames: ['Bà Năm lái buôn', 'Quán chuỗi Phố Cổ', 'Công ty XNK Đông Dương', 'Anh Tư thương lái', 'Lò rang Mười Hai'],
};
const shash = str => [...String(str)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 11);
/** Supplier `i` (0-based) of a group in a region (pure): { name, priceMul, quality, late }. Cheaper ones are worse. */
export function supplierOf(regionId, group, i) {
  const r = rng(shash(`${regionId}:${group}:${i}`));
  const quality = 1 + Math.floor(r() * 3);
  const priceMul = Math.round((0.65 + 0.2 * quality + r() * 0.2) * 100) / 100;
  const late = Math.round(Math.max(0.02, 0.3 - 0.08 * quality - r() * 0.08) * 100) / 100;
  return { name: SUPPLY.supplierNames[Math.abs(shash(`${regionId}${group}${i}`)) % SUPPLY.supplierNames.length], priceMul, quality, late };
}
/** Buyer `i` (1..count; 0 = the storehouse) of a region: name + price multipliers per good for a day key. */
export function buyerOf(regionId, i, day) {
  if (!i) return { name: null, mul: { beans: 1, dried: 1, roasted: 1, bag: 1 } };
  const [lo, hi] = SUPPLY.buyers.swing;
  const r = rng(shash(`${regionId}:buyer:${i}:${day}`));
  const pick = () => Math.round((lo + r() * (hi - lo)) * 100) / 100;
  return { name: SUPPLY.buyerNames[Math.abs(shash(`${regionId}buyer${i}`)) % SUPPLY.buyerNames.length], mul: { beans: pick(), dried: pick(), roasted: pick(), bag: pick() } };
}

// ---------- Research step 3: crop methods (docs/design/research.md) ----------
// A method = [shade, density, fertilizer], each 0..2 (shade: none / medium / thick · density: sparse / medium / dense ·
// fertilizer: none / organic / chemical) = 27 ways to grow a crop. Each factor trades yield, grow time and quality
// (the chance a harvest comes out one star better); each region also has a hidden best way per crop (its land and
// weather): every matching factor adds fitYield yield and fitQuality quality. You find it with trial fields: plant one
// field your way (fee + seeds), see its numbers at harvest, then adopt a tested way for that crop — every planting
// (yours, workers', robots') follows it. Default way: medium shade · medium density · no fertilizer.
export const FARMLAB = {
  factors: ['shade', 'density', 'fert'],
  defaultMethod: [1, 1, 0],
  yield: { density: [0.85, 1, 1.15], fert: [1, 1.05, 1.1] },
  time: { shade: [0.9, 1, 1.15], fert: [1, 1.1, 0.9] },
  quality: { shade: [0, 0.1, 0.2], density: [0.1, 0, -0.1], fert: [0, 0.1, -0.1] },
  fitYield: 0.05, fitQuality: 0.08, baseQuality: 0.1, maxQuality: 0.85,
  trialFee: 30, trialSlots: [[1, 1], [8, 2]], // [player level, trial fields at once]
};
/** The hidden best way to grow `crop` in a region (pure). */
export function bestMethod(regionId, crop) {
  const r = rng(shash(`${regionId}:method:${crop}`));
  return [Math.floor(r() * 3), Math.floor(r() * 3), Math.floor(r() * 3)];
}
/** What a way of growing gives here: { yieldMul, timeMul, quality (0..maxQuality), fit (matching factors) }. */
export function methodEffect(regionId, crop, m) {
  const [sh, de, fe] = m, best = bestMethod(regionId, crop), F = FARMLAB;
  const fit = m.filter((v, i) => v === best[i]).length;
  const yieldMul = Math.round(F.yield.density[de] * F.yield.fert[fe] * (1 + F.fitYield * fit) * 100) / 100;
  const timeMul = Math.round(F.time.shade[sh] * F.time.fert[fe] * 100) / 100;
  const quality = Math.max(0, Math.min(F.maxQuality, Math.round((F.baseQuality + F.quality.shade[sh] + F.quality.density[de] + F.quality.fert[fe] + F.fitQuality * fit) * 100) / 100));
  return { yieldMul, timeMul, quality, fit };
}
export const methodKey = m => (Array.isArray(m) ? m.join('') : '110');
