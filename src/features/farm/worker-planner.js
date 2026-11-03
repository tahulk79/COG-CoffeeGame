import { CROPS } from './content.js';

export function choosePlantCrop(worker,progress,level,orders=[]) {
  const allowed=CROPS.filter(c=>c.level<=level&&progress.seeds[c.id]>0);
  const trees=id=>progress.plots.filter(p=>p.unlocked&&p.stage!=='empty'&&p.cropId===id).length;
  const requested=orders.filter(o=>o.status==='open'&&o.workers.includes(worker.id)&&progress.stock.roasted[o.cropId]<o.grams);
  const missing=requested.find(o=>allowed.some(c=>c.id===o.cropId)&&trees(o.cropId)===0);
  if(missing)return missing.cropId;
  const preferred=allowed.find(c=>c.id===worker.preferredCrop);
  // An exhausted preferred seed must not prevent using another available seed.
  if(worker.preferredCropExplicit&&preferred)return preferred.id;
  return allowed.sort((a,b)=>trees(a.id)-trees(b.id))[0]?.id||null;
}

export function jobAgeBonus(firstSeen,now) {
  return Math.min(36,Math.max(0,(now-firstSeen)/1000));
}
