import { cropById, plotCare } from './content.js';
// Q5 R10: giới hạn kéo 🧺 = số cây chín ở ô đã mở mà kho còn vừa, xét lần lượt theo thứ tự ô và readyYield (đơn vị gram như kho).
// `storageFree` = chỗ trống kho (gram); bỏ qua thì không xét kho. Không đổi sản lượng/kinh tế.
export function harvestCapacity(plots, storageFree = Infinity) {
  let free = storageFree, count = 0;
  for (const plot of plots) {
    if (!plot?.unlocked || plot.stage !== 'ready') continue; // cùng điều kiện plotCare(plot).ready
    const need = plot.readyYield || 0;
    if (need > free) continue;
    free -= need; count++;
  }
  return count;
}
export function toolCapacity(progress, action, cropId, storageFree = Infinity) {
  return action === 'plant' ? progress.seeds[cropId] || 0 : action === 'water' ? progress.water : action === 'fertilize' ? progress.fertilizer : action === 'harvest' ? harvestCapacity(progress.plots, storageFree) : progress.plots.length;
}
export function acceptsTool(plot, action, cropId, level) {
  if (!plot?.unlocked) return false;
  if (action === 'plant') return plot.stage === 'empty' && Boolean(cropById(cropId)) && cropById(cropId).level <= level;
  if (action === 'water') return plotCare(plot).needsWater;
  if (action === 'fertilize') return plotCare(plot).canFeed;
  if(action==='weed')return plotCare(plot).needsWeeding;
  if(action==='harvest')return plotCare(plot).ready;
  if(action==='prune')return plot.mature&&plot.stage!=='ready'&&!plot.pruned&&plotCare(plot).ratio<.17;
  return action === 'clear' && plot.stage !== 'empty';
}

// Returning to an earlier cell retracts the unfinished stroke instead of adding it twice.
export function editDragSelection(ids, id, limit) {
  const selected=ids.slice(0,Math.max(0,limit));
  if(!id)return selected;
  const index=selected.indexOf(id);
  if(index>=0)return selected.slice(0,index+1);
  return selected.length<limit ? [...selected,id] : selected;
}
