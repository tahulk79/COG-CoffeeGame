// F-36 (docs/design/godbean-gdd.md §9.1): Mastery XP rules and the two victories. Pure data + functions, no DOM.
import { FIELDS } from './content.js';
import { DECORATIONS } from './decorations.js';
import { ASSETS, upgradePrice } from './rules.js';
import { GEAR } from '../cafe/recipes.js';
import { regionType } from '../world-map/content.js';
import { t } from '../../i18n/index.js';

export const MARKET_XP_CAP = 40, MEMORY_XP_CAP = 30, DECODE_XP = 20;
export const MEMORY_XP = { game: 3, real: 5, insight: 5 };
export const MASTERY_XP = { 2: 15, 3: 30 };
export const VICTORY_ASSETS = 300000, DISCOVERY_KEYS = 6;
const TIER_SCORE = { 2: 70, 3: 90 }; // same cut-offs as cafe/recipes.js stars()
export const tiersFor = best => [2, 3].filter(star => best >= TIER_SCORE[star]);

// `assetValue` in rules.js is a per-building capacity, not money, so net worth is rebuilt from what the player paid:
// coins + fields + building upgrades + café gear + decorations. Stock and lots are not counted.
export function totalAssets(p) {
  let sum = p.coins;
  for (const f of FIELDS) if (p.fields.includes(f.id)) sum += f.price;
  for (const a of ASSETS) for (let l = 1; l < (p.upgrades[a.id] || 1); l++) sum += upgradePrice(a.id, l);
  for (const g of GEAR) for (let l = g.start; l < (p.cafe.gear[g.id] ?? g.start); l++) sum += g.prices[l] || 0;
  for (const d of p.decorations) sum += DECORATIONS.find(s => s.id === d.type)?.price || 0;
  return Math.round(sum * 100) / 100;
}

const FARM_BUILDINGS = ASSETS.filter(a => a.category !== 'cafe');
const AUTOMATION = GEAR.filter(g => g.group === 'auto');
// Conditions per region type as [id, ok, text params]; the money condition is always first and never enough alone.
export function economicStatus(p) {
  const type = regionType(p.region), up = p.upgrades, rep = p.cafe.reputation, assets = totalAssets(p);
  const rows = [['assets', assets >= VICTORY_ASSETS, { n: VICTORY_ASSETS }]];
  if (type !== 'cafe') rows.push(['fields', p.fields.length >= FIELDS.length, { n: FIELDS.length }]);
  if (type === 'farm') rows.push(['buildings', FARM_BUILDINGS.every(a => up[a.id] >= 15), { n: 15 }]);
  if (type === 'both') rows.push(['rep', rep >= 85, { n: 85 }]);
  if (type === 'cafe') rows.push(['cafeLevel', up.cafe >= 10, { n: 10 }], ['rep', rep >= 90, { n: 90 }], ['auto', AUTOMATION.every(g => p.cafe.gear[g.id] >= g.prices.length), {}]);
  return { assets, target: VICTORY_ASSETS, rows, met: rows.every(r => r[1]) };
}

export const titleOf = v => v?.economic && v?.discovery ? t('farm.title.both') : v?.economic ? t('farm.title.economic') : v?.discovery ? t('farm.title.discovery') : '';
export const emptyVictories = () => ({ economic: null, discovery: null });
