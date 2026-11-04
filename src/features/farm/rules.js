// All durations are compressed game time, not instructions for real cultivation.
export const DAY_MS = 60000;
export const SEASON_MS = DAY_MS * 6;
export const MAX_LEVEL = 999;
export const OFFLINE_MS = 8 * 3600000;
// One café opening; café staff are paid per shift so a closed café wastes no paid time.
export const CAFE_SHIFT_MS = 240000;
// Fertilizer must repay itself (+11% yield, +5 quality); outside beans cost more than farm beans so the café still needs the farm.
export const FERTILIZER_PRICE = 1;
export const SUPPLIER_PRICE = 75;
// Market price per work day (6 minutes) falls linearly from 100% to a 30% floor once 70% of MARKET_DAILY base coins are sold, so surplus beans pay more at the café.
// Integrated over the work day's sold base value: one big sale and many small ones earn the same.
export const MARKET_DAILY = 1200;
const marketCurve = x => x <= .7 * MARKET_DAILY ? x - x * x / (2 * MARKET_DAILY) : .455 * MARKET_DAILY + .3 * (x - .7 * MARKET_DAILY);
export const marketValue = (soldToday, base) => marketCurve(soldToday + base) - marketCurve(soldToday);
export const ASSETS = [
  {id:'soil',name:'Đất và thoát nước',icon:'🌱',category:'farm',base:90,benefit:'Giữ ẩm tốt hơn, giảm nhu cầu tưới',baseValue:100,unit:'% giữ ẩm'},
  {id:'fence',name:'Hàng rào',icon:'🪵',category:'farm',base:80,benefit:'Bền hơn, giảm chi phí bảo trì',baseValue:100,unit:'độ bền'},
  {id:'pond',name:'Ao dự trữ',icon:'🌊',category:'water',base:100,benefit:'Tăng nước dự trữ cho giếng',baseValue:60,unit:'nước'},
  {id:'well',name:'Giếng và bồn nước',icon:'💧',category:'water',base:60,benefit:'Tăng bình mang theo và tốc độ hồi nước',baseValue:6,unit:'lượt tưới'},
  {id:'tools',name:'Dụng cụ',icon:'⛏️',category:'farm',base:75,benefit:'Giảm thời gian chăm sóc của người chơi',baseValue:4,unit:'giây/thao tác',decreases:true},
  {id:'dryer',name:'Sân sơ chế',icon:'☀️',category:'processing',base:100,benefit:'Phơi và tách vỏ khô; tăng công suất',baseValue:18000,unit:'g quả/mẻ'},
  {id:'roaster',name:'Lò rang',icon:'🔥',category:'processing',base:160,benefit:'Tăng khối lượng mẻ, ổn định chất lượng',baseValue:1000,unit:'g nhân/mẻ'},
  {id:'storage',name:'Kho bảo quản',icon:'🎒',category:'logistics',base:90,benefit:'Tăng chỗ chứa farm và bảo quản',baseValue:60000,unit:'g'},
  {id:'delivery',name:'Vận chuyển',icon:'🛒',category:'logistics',base:100,benefit:'Giao được nhiều hạt hơn mỗi chuyến',baseValue:1000,unit:'g/chuyến'},
  {id:'cafe',name:'Thiết bị quán',icon:'🏪',category:'cafe',maxLevel:10,base:140,benefit:'Mở thêm bàn ghế cho khách ngồi chờ',baseValue:3,unit:'bàn'},
];
export const assetById = id => ASSETS.find(asset=>asset.id===id);
// Assets stop at level 20 (café equipment at 10): every level stays reachable in normal play (cut from 999 on 03/11/2026).
export const ASSET_MAX_LEVEL = 20;
export const assetMaxLevel = asset => asset?.maxLevel || ASSET_MAX_LEVEL;
export const efficiency = level => 1 + .07 * (Math.min(level, ASSET_MAX_LEVEL) - 1); // ×2.33 speed at 20
export const capacityScale = level => 1 + .18 * (Math.min(level, ASSET_MAX_LEVEL) - 1); // ×4.42 capacity at 20
export const upgradePrice = (id,level) => { const base = assetById(id)?.base || 100; return Math.ceil(level < 10 ? base * 1.42 ** (level - 1) : base * 1.42 ** 9 * (1 + .15 * (level - 10)) ** 2); };
// Farm level needed to reach an asset level: 1:1.
export const upgradeRequirement = next => next;
// Visual tiers: each has its own asset slot `farm/<id>/tier-<n>` so art can be swapped per tier.
export const ASSET_TIERS = [{min:1,name:'Cơ bản'},{min:10,name:'Cải tiến'},{min:20,name:'Chuyên nghiệp'}];
export const assetTier = level => ASSET_TIERS.reduce((tier,t,i) => level >= t.min ? i + 1 : tier, 1);
export function assetValue(asset,level) {
  if(asset.id==='well')return level<=10?6+4*(level-1):42+(level-10);
  if(asset.id==='cafe')return Math.min(10,3+Math.round((level-1)*7/9)); // café room has 10 table spots
  return Math.round(asset.baseValue*(asset.decreases ? 1/efficiency(level) : capacityScale(level)));
}
export const phaseOf = plot => plot.stage==='empty' ? 'Đất trống' : plot.stage==='ready' ? 'Hái chọn quả chín' : !plot.mature ? 'Cây giống · kiến thiết' : plot.growthMs/SEASON_MS<.17 ? 'Phục hồi' : plot.growthMs/SEASON_MS<.25 ? 'Ra hoa' : plot.growthMs/SEASON_MS<.75 ? 'Nuôi quả' : 'Quả đang chín';
export const formatCoins = coins => coins.toLocaleString('vi-VN',{maximumFractionDigits:2});
export const formatMass = grams => grams>=1000 ? `${(grams/1000).toLocaleString('vi-VN',{maximumFractionDigits:2})} kg` : `${Math.round(grams)} g`;
export const WORKER_CANDIDATES = [
  {id:'an',name:'An',color:'#759561',stats:{speed:65,intelligence:65,strength:55,dexterity:65,constitution:50},fee:150},
  {id:'binh',name:'Bình',color:'#bf8c58',stats:{speed:55,intelligence:55,strength:75,dexterity:50,constitution:65},fee:150},
  {id:'chi',name:'Chi',color:'#789ba5',stats:{speed:55,intelligence:80,strength:40,dexterity:75,constitution:50},fee:180},
];
WORKER_CANDIDATES.push(
  {id:'dung',name:'Dũng',color:'#6e8c96',stats:{speed:70,intelligence:45,strength:75,dexterity:45,constitution:65},fee:160},
  {id:'ha',name:'Hà',color:'#ad8768',stats:{speed:60,intelligence:75,strength:40,dexterity:80,constitution:45},fee:180},
  {id:'linh',name:'Linh',color:'#a5859a',stats:{speed:75,intelligence:65,strength:45,dexterity:60,constitution:55},fee:170},
  {id:'minh',name:'Minh',color:'#8b9c65',stats:{speed:50,intelligence:65,strength:65,dexterity:50,constitution:70},fee:160},
  {id:'nam',name:'Nam',color:'#b29357',stats:{speed:60,intelligence:60,strength:60,dexterity:60,constitution:60},fee:150},
  // Robot shares the two farm slots (max 1), never levels, and only does chores (robot-staff.md 2).
  {id:'robo-n1',name:'Robot vườn',kind:'robot',color:'#8d9aa3',stats:{speed:70,intelligence:60,strength:60,dexterity:70,constitution:60},fee:0,wage:15,jobs:['water','weed','processing','delivery']},
);
const candidateBios={
  an:'Việc gì cũng biết một chút. Riêng nghe tiếng trả lương thì phản xạ rất nhanh.',
  binh:'Bao cà phê nặng cứ để Bình. Chỉ xin đừng nhờ đếm tiền lẻ sau giờ làm.',
  chi:'Nhìn màu hạt đoán được mẻ rang. Nhìn mặt chủ đoán được hôm nay có tăng ca.',
  dung:'Chạy nhanh, vác khỏe. Có thể bê cả bao cà phê, nhưng không bê hộ deadline của chủ.',
  ha:'Tay khéo, mắt tinh. Nhặt hạt lỗi rất giỏi, nhặt được tiền rơi sẽ báo… sau khi đếm.',
  linh:'Đi lấy nước nhanh như gió. Chủ chưa gọi xong tên đã hỏi: việc tiếp theo là gì?',
  minh:'Không chạy đua với ai, chỉ bền bỉ làm tới cuối ca. Trừ khi nghe tiếng cơm chín.',
  nam:'Chỉ số nào cũng vừa vặn. Hồ sơ không có điểm yếu, chỉ có giờ nghỉ trưa bất khả xâm phạm.',
  'robo-n1':'Tưới, làm cỏ, chế biến, giao hàng không biết mệt. Không trồng, không bón, không tỉa, không hái.'
};
for(const candidate of WORKER_CANDIDATES)candidate.bio=candidateBios[candidate.id];
// Staff sign prepaid contracts. One work day equals one crop season (6 minutes of play).
export const WORK_DAY_MS = SEASON_MS;
export const CONTRACT_PLANS = [{id:'day',name:'Ngày',days:1,price:1},{id:'week',name:'Tuần',days:7,price:6},{id:'month',name:'Tháng',days:28,price:21}];
// Robot wage is fixed by the candidate list (not the save) and never scales with level.
export const workerWage = worker => { const robot = WORKER_CANDIDATES.find(c=>c.id===worker.id&&c.kind==='robot'); return robot ? robot.wage : 30+10*(workerLevel(worker.xp)-1); };
// Prepaid robot packs (farm robot only): discount per pack size n.
export const ROBOT_PACKS = {1:0,5:.1,10:.25};
export const packPrice = (wage,n) => Math.ceil(wage*n*(1-ROBOT_PACKS[n]));
// Staff incidents for both scenes (robot-staff.md 4). grace = first shifts with no incident; minRep = café reputation floor.
export const INCIDENTS = {phone:.12,sick:.04,rude:.05,kCafe:.12,kFarm:.07,floor:.4,manager:.5,grace:2,minRep:30,phoneMs:40000};
// p(type) = p0 × max(F, 1 − k(L − 1)) × M; rude only for cashier/waiter, M only for phone/rude with an on-shift manager.
export function incidentOdds(level,k,manager=false,rude=false) {
  const f=Math.max(INCIDENTS.floor,1-k*(level-1)),m=manager?INCIDENTS.manager:1;
  return {phone:INCIDENTS.phone*f*m,sick:INCIDENTS.sick*f,rude:rude?INCIDENTS.rude*f*m:0};
}
// Shift hiring (03/11/2026): one plan, one work day (6 min) per payment, auto-renewed while the worker is at the farm.
export const contractPlan = () => CONTRACT_PLANS[0];
export const contractPrice = worker => workerWage(worker)*contractPlan(worker).price;
export const contractLeft = ms => ms<=0?'Hết hạn':ms>=WORK_DAY_MS?`Còn ${Math.floor(ms/WORK_DAY_MS)} ngày ${Math.floor(ms%WORK_DAY_MS/60000)} phút`:`Còn ${Math.ceil(ms/60000)} phút`;
export const workerLevel = xp => Math.min(10,1+Math.floor(Math.sqrt(xp/100)));
export const workerStat = (worker,key) => Math.min(100,worker.stats[key]+2*(workerLevel(worker.xp)-1));
export const WORKER_JOBS=[['plant','🌱','Trồng cây'],['water','💧','Tưới'],['fertilize','🪴','Bón phân'],['weed','🌿','Làm cỏ'],['prune','✂️','Tỉa cành'],['harvest','🧺','Hái'],['processing','⚙️','Chế biến'],['delivery','🛒','Giao hàng']];
export const ACTION_LABELS = {construct:'Đang xây',dismantle:'Đang phá dỡ',plant:'Trồng',water:'Tưới',weed:'Làm cỏ',fertilize:'Bón phân',harvest:'Hái',refill:'Lấy nước',collect:'Nhận hàng',start:'Chế biến',turn:'Đảo phơi',prune:'Tỉa cành',deposit:'Cất hàng',ship:'Giao quán',shipOrder:'Giao đơn',feedFish:'Cho cá ăn'};

export function workerIdleReason(worker,progress,at) {
  if(worker.farmId!=='farm-0')return 'Đội dự bị · Chưa bố trí';
  if(!worker.enabled)return 'Đã tạm dừng';
  if(worker.restUntil>at)return `${worker.incident?.type==='sick'?'🤒 Nghỉ ốm':'Đang nghỉ'} · ${Math.ceil((worker.restUntil-at)/1000)}s`;
  if(worker.shiftUntil<=at)return worker.kind==='robot'?`Hết gói · Gia hạn ${contractPrice(worker)} xu`:`Hết hợp đồng · Gia hạn ${contractPlan(worker).name.toLowerCase()} ${contractPrice(worker)} xu`;
  const assigned=progress.orders.some(o=>o.status==='open'&&o.workers.includes(worker.id));
  const d=progress.directives||{};
  if(!assigned&&!d.care&&!d.plant&&!d.process)return 'Chờ giao đơn hoặc bật chỉ thị trong Quản lý farm';
  if(!Object.values(worker.jobs||{}).some(Boolean))return 'Đã tắt tất cả nhóm việc';
  if(worker.waitUntil>at&&worker.waitReason)return worker.waitReason;
  const trees=progress.plots.filter(t=>t.unlocked&&t.stage!=='empty');
  const orders=progress.orders.filter(o=>o.status==='open'&&o.workers.includes(worker.id));
  if(orders.length&&orders.every(o=>progress.stock.roasted[o.cropId]>=o.grams))return 'Đủ hàng cho đơn → Mở Công việc để giao';
  const missing=orders.find(o=>!trees.some(t=>t.cropId===o.cropId)&&!progress.seeds[o.cropId]);
  if(missing)return 'Thiếu cây giống cho đơn → Mở Cửa hàng';
  if(trees.some(t=>t.water<35)&&!worker.water&&progress.reservoir<1)return 'Thiếu nước dự trữ → Chờ giếng hồi nước';
  const batches=Object.values(progress.machines).flatMap(m=>[m.batch,...m.extraBatches].filter(Boolean));
  if(batches.length){const next=Math.min(...batches.map(b=>b.readyAt));if(next<=at){
      const used=progress.lots.reduce((sum,l)=>sum+l.grams,0),free=assetValue(assetById('storage'),progress.upgrades.storage)-used,smallest=Math.min(...batches.filter(b=>b.readyAt<=at).map(b=>b.outputGrams));
      if(smallest>free)return `Kho đầy · Còn ${formatMass(Math.max(0,free))}, mẻ cần ${formatMass(smallest)} → Bán bớt, chuyển quán hoặc nâng Kho`;
      if(worker.jobs?.processing===false)return 'Có mẻ xong · Nhóm Chế biến của thợ này đang tắt (Hồ sơ → Thiết lập)';
      if(progress.directives?.process===false)return 'Có mẻ xong · Chỉ thị Tự chế biến đang tắt (Nhân viên → Chỉ thị)';
      return 'Có mẻ xong · Đang chờ tới lượt nhận';
    }
    return `Chờ mẻ xong ${Math.ceil((next-at)/1000)}s · Tự nhận khi hoàn tất`;}
  if(worker.kind==='robot'&&orders.some(o=>progress.stock.roasted[o.cropId]<o.grams&&!progress.stock.cherries[o.cropId]&&!progress.stock.dried[o.cropId]))return 'Robot không hái được · Hái tay hoặc thuê người';
  if(d.plant&&progress.plots.some(t=>t.unlocked&&t.stage==='empty')&&!progress.seeds[d.plantCrop])return 'Hết hạt giống chỉ thị để lấp ô trống → Mua thêm hoặc đổi giống';
  if(progress.plots.some(t=>t.unlocked&&t.stage==='empty')&&!Object.values(progress.seeds).some(n=>n>0))return 'Hết cây giống → Mở Cửa hàng để trồng thêm';
  if(trees.length)return trees.some(t=>t.stage==='ready')?'Còn quả chín · Kho đầy hoặc nhóm Hái đang tắt':'Vườn đang ổn · Tự quay lại khi cây cần chăm hoặc có mẻ mới';
  return 'Chưa có cây → Mua cây giống và bật Trồng cây';
}
