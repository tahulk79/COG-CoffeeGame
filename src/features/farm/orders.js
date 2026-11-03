import { cropById } from './content.js';
import { formatMass } from './rules.js';
export function orderSteps(order,p) {
  const c=order.cropId,stock=p.stock,trees=p.plots.filter(t=>t.unlocked&&t.stage!=='empty'&&t.cropId===c);
  const jobs=id=>[p.machines[id].batch,...p.machines[id].extraBatches].filter(j=>j&&j.cropId===c);
  const roasted=stock.roasted[c],roastPending=jobs('roaster').reduce((s,j)=>s+j.outputGrams,0);
  const greenNeeded=Math.ceil(Math.max(0,order.grams-roasted-roastPending)/84)*100;
  const greenPending=jobs('dryer').reduce((s,j)=>s+j.outputGrams,0);
  const cherryNeeded=Math.ceil(Math.max(0,greenNeeded-stock.dried[c]-greenPending)/100)*600;
  const packed=order.status==='transit'||order.status==='delivered';
  return [
    {label:`Trồng/chăm ${cropById(c).short}`,done:packed||trees.length>0,detail:trees.length?`${trees.length} cây hiện có`:'Cần cây giống và ô trống'},
    {label:'Hái quả chín',done:packed||cherryNeeded<=stock.cherries[c],detail:`Có ${formatMass(stock.cherries[c])} · Còn cần ${formatMass(Math.max(0,cherryNeeded-stock.cherries[c]))}`},
    {label:'Phơi và tách vỏ',done:packed||greenNeeded<=stock.dried[c],detail:`Nhân sạch ${formatMass(stock.dried[c])} · ${jobs('dryer').length} mẻ đang xếp`},
    {label:'Rang hạt',done:packed||roasted>=order.grams,detail:`${formatMass(roasted)}/${formatMass(order.grams)} · ${jobs('roaster').length} mẻ đang xếp`},
    {label:'Giao sang quán',done:order.status==='delivered',detail:order.status==='transit'?'Đang vận chuyển':order.status==='delivered'?'Quán đã nhận':'Bạn bấm Giao khi đủ hàng'},
  ];
}

export function productionNeed(p,cropId,targetGrams) {
  const queued=id=>[p.machines[id].batch,...p.machines[id].extraBatches].filter(j=>j&&j.cropId===cropId).reduce((sum,j)=>sum+j.outputGrams,0);
  const roasted=Math.max(0,targetGrams-p.stock.roasted[cropId]-queued('roaster'));
  const green=Math.max(0,Math.ceil(roasted/84)*100-p.stock.dried[cropId]-queued('dryer'));
  const cherries=Math.max(0,Math.ceil(green/100)*600-p.stock.cherries[cropId]);
  return {roasted,green,cherries};
}
