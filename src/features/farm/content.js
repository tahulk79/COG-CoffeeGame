import { SEASON_MS } from './rules.js';
export const CROPS = [
  { id: 'robusta', name: 'Cà phê vối', short: 'Vối', color: '#62854b', seedPrice: 10, level: 1, growMs: 90000, regrowMs: SEASON_MS, yield: 3000, priceScale: 1, description: 'Cây lâu năm, thích hợp vùng ấm. Trồng một lần, hái nhiều vụ.' },
  { id: 'arabica', name: 'Cà phê chè', short: 'Chè', color: '#4f806d', seedPrice: 20, level: 2, growMs: 120000, regrowMs: SEASON_MS, yield: 2600, priceScale: 1.3, description: 'Ưa khí hậu mát, cần chăm kỹ và chọn vùng phù hợp.' },
  { id: 'liberica', name: 'Cà phê mít', short: 'Mít', color: '#7d9547', seedPrice: 30, level: 3, growMs: 150000, regrowMs: SEASON_MS*1.1, yield: 3400, priceScale: 1.5, description: 'Tán lớn, chu kỳ dài; hương vị và đầu ra riêng.' },
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
  id: `field-${index}`, name: `Ruộng ${index + 1}`, kind: 'field', color: '#b09861',
  row: Math.floor(index / 2), col: index % 2,
  footprint: { halfWidth: 2.915, halfDepth: 2.165 },
  center: [-7.4 - index % 2 * 8, -3.1 - Math.floor(index / 2) * 11.1],
  position: [-7.4 - index % 2 * 8, -3.1 - Math.floor(index / 2) * 11.1 + 2.6],
  price: [0,120,180,300][index],
  approachOffsets: [[0,1.4]],
  interactDistance: 2.3, approachDistance: 1.9, initialVisible: false,
}));
export const PLOTS = FIELDS.flatMap((field, fieldIndex) => Array.from({ length: 12 }, (_, index) => ({
  id: index < 6 ? `plot-${fieldIndex * 6 + index}` : `plot-extra-${fieldIndex}-${index}`, fieldId: field.id, name: `Cây ${index + 1} · ${field.name}`, kind: 'plot', icon: '❧', color: '#70946c',
  position: [field.center[0] - 2.25 + index % 4 * 1.5, field.center[1] - 1.5 + Math.floor(index / 4) * 1.5],
  interactDistance: 1.65, approachDistance: 1.3, initialVisible: true,
})));
export const MACHINES = [
  { id: 'dryer', name: 'Sân phơi', kind: 'dryer', icon: '☀', color: '#c5ab74', position: [0, -2.5], approachOffsets: [[0,2],[-2.1,0],[2.1,0]], input: 'cherries', output: 'dried', inputCount: 600, outputCount:100, capacity:18000, duration: 30000, upgradePrice: 100 },
  { id: 'roaster', name: 'Lò rang', kind: 'roaster', icon: '♨', color: '#a87b54', position: [6, -10.5], approachOffsets: [[0,2.5],[-1,2.5],[1,2.5]], input: 'dried', output: 'roasted', inputCount: 100, outputCount:84, capacity:1000, duration: 18000, upgradePrice: 160 },
  { id: 'grinder', name: 'Máy xay bột', kind: 'grinder', icon: '☕', color: '#718e88', position: [6, -3.5], approachOffsets: [[0,2.5],[-1,2.5],[1,2.5]], input: 'roasted', output: 'ground', inputCount: 84, outputCount:84, capacity:1000, duration: 10000, upgradePrice: 180 },
];
export const STATIONS = [
  { id: 'seed-shop', name: 'Tiệm hạt giống', kind: 'shop', initialVisible: false, color: '#9b9b62', position: [12, 12], interactDistance: 2.6, approachDistance: 2.2 },
  { id: 'market', name: 'Quầy thu mua', kind: 'market', initialVisible: false, color: '#c39e65', position: [4, 14], interactDistance: 2.6, approachDistance: 2.2 },
  { id: 'well', name: 'Giếng nước', kind: 'well', facing: Math.PI/2, color: '#7b9fa4', position: [-16.8, -8.4], approachOffsets: [[1.8,0],[1.8,-.4],[1.8,.4]], interactDistance: 2.3, approachDistance: 1.9 },
  {id:'pond',name:'Ao dự trữ',kind:'pond',color:'#64989a',position:[0,-15.5],approachOffsets:[[0,2.2]],interactDistance:2.8,approachDistance:2.2},
  ...MACHINES.map(machine => ({ ...machine, interactDistance: 3.2, approachDistance: 2.8 })),
];
export const INTERACTIONS = [...FIELDS, ...PLOTS, ...STATIONS];
export const PRODUCTS = [
  { id: 'cherries', name: 'Quả chín', icon: '🍒', price: .004 },
  { id: 'dried', name: 'Nhân sạch · đã phơi, tách vỏ', icon: '🫘', price: .04 },
  { id: 'roasted', name: 'Hạt rang', icon: '♨', price: .07 },
  { id: 'ground', name: 'Cà phê bột', icon: '☕', price: .072 },
];
export const TOOLS = [
  { id: 'auto', icon: '✦', name: 'Tự chọn', help: 'Bấm cây để chăm việc đang cần nhất.' },
  { id: 'seed', icon: '❧', name: 'Gieo hạt', help: 'Bấm luống trống để chọn giống.' },
  { id: 'water', icon: '◒', name: 'Tưới', help: 'Bấm cây cần nước. Hết nước thì tới giếng.' },
  { id: 'weed', icon: '⌁', name: 'Làm cỏ', help: 'Bấm luống có cỏ để dọn.' },
  { id: 'feed', icon: '✚', name: 'Bón phân', help: 'Bón một lần mỗi lứa để thêm sản lượng.' },
  { id: 'harvest', icon: '♧', name: 'Hái quả', help: 'Bấm cây có quả chín để hái.' },
];
export const QUESTS = [
  { id: 'harvest', title: 'Hái lứa quả đầu tiên', detail: 'Bấm cây có biểu tượng quả chín để tới hái.', stat: 'harvested', count: 1, coins: 10, xp: 4 },
  { id: 'water', title: 'Chăm lại cây vừa hái', detail: 'Tưới cây; cây sẽ tiếp tục cho lứa mới.', stat: 'watered', count: 1, coins: 5, xp: 3 },
  { id: 'dry', title: 'Phơi mẻ cà phê đầu tiên', detail: 'Mang quả chín tới sân phơi và tách vỏ. Xong thì bấm giỏ trên đầu sân để nhận.', stat: 'dried', count: 1, coins: 10, xp: 4 },
  { id: 'roast', title: 'Rang một mẻ hạt', detail: 'Mang nhân sạch tới lò rang, rồi nhận hạt rang.', stat: 'roasted', count: 1, coins: 10, xp: 4 },
  { id: 'grind', title: 'Xay túi cà phê đầu tiên', detail: 'Đưa hạt rang vào máy xay. Túi thành phẩm sẽ hiện trên đầu máy.', stat: 'ground', count: 1, coins: 10, xp: 4 },
  { id: 'sell', title: 'Bán thành quả của mình', detail: 'Tới quầy thu mua để bán hoặc giao đơn đặt hàng.', stat: 'sold', count: 1, coins: 15, xp: 6 },
  { id: 'expand', title: 'Mua ruộng thứ hai', detail: 'Mua ruộng liền kề. Mỗi ruộng thêm 12 ô đất và nới rộng bản đồ.', stat: 'expanded', count: 1, coins: 10, xp: 5 },
  { id: 'weed', title: 'Giữ vườn sạch cỏ', detail: 'Dọn cỏ trước khi cỏ dày làm cây ngừng lớn.', stat: 'weeded', count: 1, coins: 5, xp: 3 },
];
// Farm level 1–10 from the table, then a quadratic curve up to 999.
export const xpForLevel = level => level <= 10 ? LEVEL_XP[level - 1] : 2800 + 850 * (level - 10) + 50 * (level - 10) ** 2;
export const levelFor = xp => { let level = 1; while (level < 999 && xp >= xpForLevel(level + 1)) level++; return level; };
export const cropById = id => CROPS.find(crop => crop.id === id);
export const productById = id => PRODUCTS.find(product => product.id === id);
