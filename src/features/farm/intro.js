import { PLOTS, CROPS, MACHINES } from './content.js';

// Tutorial ép `farm-intro` (F-46, docs/screens/03-farm/rules.md): 4 bước gieo → hái → phơi → rang.
// Bước suy ra từ state đã lưu (không lưu bước dở); chỉ id 'farm-intro' vào farm.tutorial.seen khi xong.
export const INTRO_SOW = 3; // bài gieo đầu: chạm 1 ô rồi kéo túi hạt qua 2 ô (Q5 R5)
const POSITION = Object.fromEntries(PLOTS.map(plot => [plot.id, plot.position]));
const open = p => p.plots.filter(plot => plot.unlocked);
const emptyPlots = p => open(p).filter(plot => plot.stage === 'empty');
// Cây con người chơi vừa gieo (chưa trưởng thành); 8 cây quà của save mới đều đã trưởng thành (model.js plots).
export const seedlings = p => open(p).filter(plot => plot.stage !== 'empty' && !plot.mature);
const hasSeeds = (p, level) => CROPS.some(crop => crop.level <= level && p.seeds[crop.id] > 0);
const idle = (p, id) => { const s = p.machines[id]; return !s || (!s.batch && !s.extraBatches.length); };
// Trạm chưa có mẻ và không đủ nguyên liệu cho 1 mẻ: bước đó không làm được, bỏ ép để khỏi kẹt.
const stuck = (p, id) => { const m = MACHINES.find(item => item.id === id); return idle(p, id) && !CROPS.some(crop => p.stock[m.input][crop.id] >= m.inputCount); };

// Save đã chơi quá bước rang (đã bán ly/hạt, mở ruộng, giao đơn) coi như xong farm-intro (contracts.md 5).
export const introPlayed = p => {
  const s = p.stats;
  return p.fields.length > 1 || s.served > 0 || s.sold > 0 || s.beansSold > 0 || s.expanded > 0 || s.orders > 0 || s.delivered > 0 || (s.dried > 0 && s.roasted > 0);
};

// 'plant' | 'harvest' | 'dry' | 'roast' | null (xong hoặc không còn gì để ép).
// Gieo xong khi đã có 3 cây con, hoặc ô trống còn ≤ 1 (save mới có 4 ô trống), hoặc hết hạt; hái trước cũng tính qua gieo.
export function introStep(p, level = 1) {
  if (introPlayed(p)) return null;
  if (p.stats.harvested < 1) {
    if (seedlings(p).length < INTRO_SOW && emptyPlots(p).length > 1 && hasSeeds(p, level)) return 'plant';
    return open(p).some(plot => plot.stage === 'ready') ? 'harvest' : null; // không còn cây chín: không ép (cây quà save mới luôn chín sẵn)
  }
  if (p.stats.dried < 1) return stuck(p, 'dryer') ? null : 'dry';
  if (p.stats.roasted < 1) return stuck(p, 'roaster') ? null : 'roast';
  return null;
}

// Ô gợi ý ở bước gieo: chưa gieo thì ô trống đầu tiên; đã gieo thì n ô trống gần cây con đầu tiên nhất (liền kề).
export function introPlots(p, n = 2) {
  const empty = emptyPlots(p), anchor = seedlings(p)[0];
  if (!anchor) return empty.slice(0, 1).map(plot => plot.id);
  const [ax, az] = POSITION[anchor.id];
  const dist = plot => Math.hypot(POSITION[plot.id][0] - ax, POSITION[plot.id][1] - az);
  return empty.map(plot => [plot.id, dist(plot)]).sort((a, b) => a[1] - b[1]).slice(0, n).map(item => item[0]);
}

// Mục tiêu bước hái: cây chín đầu tiên.
export const introHarvestPlot = p => open(p).find(plot => plot.stage === 'ready')?.id || null;

// Trạng thái máy phơi/rang: 'idle' chưa có mẻ, 'running' đang chạy, 'done' chờ nhận ở giỏ.
export function machineStage(p, id, now) {
  const state = p.machines[id], jobs = state ? [state.batch, ...state.extraBatches].filter(Boolean) : [];
  if (!jobs.length) return 'idle';
  return jobs.some(job => job.readyAt <= now) ? 'done' : 'running';
}
