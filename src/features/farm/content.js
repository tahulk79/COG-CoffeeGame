import { SEASON_MS } from './rules.js';
import { t } from '../../i18n/index.js';
export const CROPS = [
  { id: 'robusta', name: t('farmRules.crop.robusta.name'), short: t('farmRules.crop.robusta.short'), color: '#62854b', seedPrice: 10, level: 1, growMs: 90000, regrowMs: SEASON_MS, yield: 3000, priceScale: 1, description: t('farmRules.crop.robusta.desc') },
  { id: 'arabica', name: t('farmRules.crop.arabica.name'), short: t('farmRules.crop.arabica.short'), color: '#4f806d', seedPrice: 20, level: 2, growMs: 120000, regrowMs: SEASON_MS, yield: 2600, priceScale: 1.3, description: t('farmRules.crop.arabica.desc') },
  { id: 'liberica', name: t('farmRules.crop.liberica.name'), short: t('farmRules.crop.liberica.short'), color: '#7d9547', seedPrice: 30, level: 3, growMs: 150000, regrowMs: SEASON_MS*1.1, yield: 3400, priceScale: 1.5, description: t('farmRules.crop.liberica.desc') },
];
export const LEVEL_XP = [0,30,90,190,350,600,950,1400,2000,2800];
export const CARE = {
  waterNeeded: 35, waterStopsGrowth: 15, waterPerSecond: .085,
  weedsNeeded: 30, weedsStopGrowth: 75, weedsPerSecond: .035,
  feedFrom: .15, feedUntil: .65, fedSpeed: 1,
};
export function plotCare(plot) {
  const crop = cropById(plot.cropId), total = plot.mature ? crop.regrowMs : crop.growMs;
  const ratio = Math.min(1, plot.growthMs / total);
  const ready = plot.stage === 'ready', empty = plot.stage === 'empty';
  const controlledDry = plot.mature && ratio >= .17 && ratio < .23;
  const needsWater = !empty && !controlledDry && plot.water < CARE.waterNeeded;
  const needsWeeding = !empty && !ready && plot.weeds >= CARE.weedsNeeded;
  const canFeed = !empty && !ready && !plot.fertilized && plot.water >= 30 && ((plot.mature && ratio < .17) || (ratio >= .3 && ratio < .65));
  const paused = !empty && !ready && ((!controlledDry && plot.water <= CARE.waterStopsGrowth) || plot.weeds >= CARE.weedsStopGrowth);
  const remainingSeconds = Math.ceil(Math.max(0, total - plot.growthMs) / (1000 * (plot.fertilized ? CARE.fedSpeed : 1)));
  return { ratio, ready, empty, needsWater, needsWeeding, canFeed, paused, remainingSeconds,
    waterInSeconds: Math.ceil(Math.max(0, plot.water - CARE.waterNeeded) / CARE.waterPerSecond) };
}
export const FARM_BOUNDS = { minX: -20, maxX: 11, minZ: -19, maxZ: 4 };
export const FIELDS = Array.from({ length: 4 }, (_, index) => ({
  id: `field-${index}`, name: t('farmRules.field.name', { n: index + 1 }), kind: 'field', color: '#b09861',
  row: Math.floor(index / 2), col: index % 2,
  footprint: { halfWidth: 2.915, halfDepth: 2.165 },
  center: [-7.4 - index % 2 * 8, -3.1 - Math.floor(index / 2) * 11.1],
  position: [-7.4 - index % 2 * 8, -3.1 - Math.floor(index / 2) * 11.1 + 2.6],
  price: [0,120,180,300][index],
  approachOffsets: [[0,1.4]],
  interactDistance: 2.3, approachDistance: 1.9, initialVisible: false,
}));
export const PLOTS = FIELDS.flatMap((field, fieldIndex) => Array.from({ length: 12 }, (_, index) => ({
  id: index < 6 ? `plot-${fieldIndex * 6 + index}` : `plot-extra-${fieldIndex}-${index}`, fieldId: field.id, name: t('farmRules.plot.name', { n: index + 1, field: field.name }), kind: 'plot', icon: '❧', color: '#70946c',
  position: [field.center[0] - 2.25 + index % 4 * 1.5, field.center[1] - 1.5 + Math.floor(index / 4) * 1.5],
  interactDistance: 1.65, approachDistance: 1.3, initialVisible: true,
})));
export const MACHINES = [
  { id: 'dryer', name: t('farmRules.machine.dryer'), kind: 'dryer', icon: '☀', color: '#c5ab74', position: [0, -2.5], approachOffsets: [[0,2],[-2.1,0],[2.1,0]], input: 'cherries', output: 'dried', inputCount: 600, outputCount:100, capacity:18000, duration: 30000, upgradePrice: 100 },
  { id: 'roaster', name: t('farmRules.machine.roaster'), kind: 'roaster', icon: '♨', color: '#a87b54', position: [6, -10.5], approachOffsets: [[0,2.5],[-1,2.5],[1,2.5]], input: 'dried', output: 'roasted', inputCount: 100, outputCount:84, capacity:1000, duration: 18000, upgradePrice: 160 },
];
export const STATIONS = [
  { id: 'seed-shop', name: t('farmRules.station.seedShop'), kind: 'shop', initialVisible: false, color: '#9b9b62', position: [12, 12], interactDistance: 2.6, approachDistance: 2.2 },
  { id: 'market', name: t('farmRules.station.market'), kind: 'market', initialVisible: false, color: '#c39e65', position: [4, 14], interactDistance: 2.6, approachDistance: 2.2 },
  { id: 'well', name: t('farmRules.station.well'), kind: 'well', facing: Math.PI/2, color: '#7b9fa4', position: [-16.8, -8.4], approachOffsets: [[1.8,0],[1.8,-.4],[1.8,.4]], interactDistance: 2.3, approachDistance: 1.9 },
  {id:'pond',name:t('farmRules.station.pond'),kind:'pond',color:'#64989a',position:[0,-15.5],approachOffsets:[[0,2.2]],interactDistance:2.8,approachDistance:2.2},
  ...MACHINES.map(machine => ({ ...machine, interactDistance: 3.2, approachDistance: 2.8 })),
];
export const INTERACTIONS = [...FIELDS, ...PLOTS, ...STATIONS];
export const PRODUCTS = [
  { id: 'cherries', name: t('farmRules.product.cherries'), icon: '🍒', price: .004 },
  { id: 'dried', name: t('farmRules.product.dried'), icon: '🫘', price: .04 },
  { id: 'roasted', name: t('farmRules.product.roasted'), icon: '♨', price: .07 },
  { id: 'ground', name: t('farmRules.product.ground'), icon: '☕', price: .072 },
];
export const TOOLS = [
  { id: 'auto', icon: '✦', name: t('farmRules.tool.auto.name'), help: t('farmRules.tool.auto.help') },
  { id: 'seed', icon: '❧', name: t('farmRules.tool.seed.name'), help: t('farmRules.tool.seed.help') },
  { id: 'water', icon: '◒', name: t('farmRules.tool.water.name'), help: t('farmRules.tool.water.help') },
  { id: 'weed', icon: '⌁', name: t('farmRules.tool.weed.name'), help: t('farmRules.tool.weed.help') },
  { id: 'feed', icon: '✚', name: t('farmRules.tool.feed.name'), help: t('farmRules.tool.feed.help') },
  { id: 'harvest', icon: '♧', name: t('farmRules.tool.harvest.name'), help: t('farmRules.tool.harvest.help') },
];
// First-time hint flags stored in farm.tutorial.seen (plus `unlock-<id>` for HUD unlock toasts).
export const TUTORIAL_IDS = ['controls', 'quest-guide', 'cafe-intro', 'bench-intro', 'tools'];
// Order (onboarding-flow 3.5): the first cup comes second because the café starts with 600 g of beans, so the
// "pour, coins jump" moment lands before minute 2; dry/roast waits then overlap café time. Watering/weeding last:
// a freshly harvested tree only needs water after ~6 minutes. Text quotes the real button labels in « ».
export const QUESTS = [
  { id: 'harvest', title: t('farmRules.quest.harvest.title'), detail: t('farmRules.quest.harvest.detail'), stat: 'harvested', count: 1, coins: 10, xp: 4 },
  { id: 'serve', title: t('farmRules.quest.serve.title'), detail: t('farmRules.quest.serve.detail'), stat: 'served', count: 1, coins: 15, xp: 6 },
  { id: 'dry', title: t('farmRules.quest.dry.title'), detail: t('farmRules.quest.dry.detail'), stat: 'dried', count: 1, coins: 10, xp: 4 },
  { id: 'roast', title: t('farmRules.quest.roast.title'), detail: t('farmRules.quest.roast.detail'), stat: 'roasted', count: 1, coins: 10, xp: 4 },
  { id: 'sell', title: t('farmRules.quest.sell.title'), detail: t('farmRules.quest.sell.detail'), stat: 'sold', count: 1, coins: 15, xp: 6 },
  { id: 'ship', title: t('farmRules.quest.ship.title'), detail: t('farmRules.quest.ship.detail'), stat: 'delivered', count: 1, coins: 10, xp: 5 },
  { id: 'expand', title: t('farmRules.quest.expand.title'), detail: t('farmRules.quest.expand.detail'), stat: 'expanded', count: 1, coins: 10, xp: 5 },
  { id: 'water', title: t('farmRules.quest.water.title'), detail: t('farmRules.quest.water.detail'), stat: 'watered', count: 1, coins: 5, xp: 3 },
  { id: 'weed', title: t('farmRules.quest.weed.title'), detail: t('farmRules.quest.weed.detail'), stat: 'weeded', count: 1, coins: 5, xp: 3 },
];
// HUD parts that appear as the player reaches them (onboarding-flow 3.3). Derived from saved state only, and any
// condition being true unlocks, so an old save that already used a feature sees it at once. `id` = shortcut id.
const reached = (p, id) => { const next = QUESTS.findIndex(q => !p.claimed.includes(q.id)); return next < 0 || next >= QUESTS.findIndex(q => q.id === id); };
export const HUD_UNLOCKS = [
  { id: 'cafe-play', name: t('farmRules.hud.cafePlay.name'), help: t('farmRules.hud.cafePlay.help'), when: p => p.claimed.includes('harvest') || p.stats.served > 0 || p.cafe.revenue > 0 },
  { id: 'seed-shop', name: t('farmRules.hud.seedShop.name'), help: t('farmRules.hud.seedShop.help'), when: (p, level) => reached(p, 'sell') || p.stats.sold > 0 || (p.plots.some(t => t.unlocked && t.stage === 'empty') && !CROPS.some(c => c.level <= level && p.seeds[c.id] > 0)) },
  { id: 'order-board', name: t('farmRules.hud.orderBoard.name'), help: t('farmRules.hud.orderBoard.help'), when: p => reached(p, 'ship') || p.orders.length > 0 },
  { id: 'upgrades', name: t('farmRules.hud.upgrades.name'), help: t('farmRules.hud.upgrades.help'), when: (p, level) => level >= 2 || Object.values(p.upgrades).some(lv => lv > 1) },
  { id: 'workers', name: t('farmRules.hud.workers.name'), help: t('farmRules.hud.workers.help'), when: (p, level) => p.claimed.includes('expand') || p.workers.length > 0 || level >= 3 },
  { id: 'build', name: t('farmRules.hud.build.name'), help: t('farmRules.hud.build.help'), when: (p, level) => p.claimed.includes('weed') || p.decorations.length > 0 || level >= 4 },
  { id: 'tools', name: t('farmRules.hud.tools.name'), help: t('farmRules.hud.tools.help'), when: (p, level) => p.claimed.includes('expand') || p.fields.length >= 2 || level >= 3 },
];
// Farm level 1–10 from the table, then a quadratic curve up to 999.
export const xpForLevel = level => level <= 10 ? LEVEL_XP[level - 1] : 2800 + 850 * (level - 10) + 50 * (level - 10) ** 2;
export const levelFor = xp => { let level = 1; while (level < 999 && xp >= xpForLevel(level + 1)) level++; return level; };
export const cropById = id => CROPS.find(crop => crop.id === id);
export const productById = id => PRODUCTS.find(product => product.id === id);
