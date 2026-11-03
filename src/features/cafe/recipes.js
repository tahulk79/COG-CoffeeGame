import { CROPS } from '../farm/content.js';

// Real-world reference ratios; game time compresses drip/extraction waits only.
export const SUPPLIES = [
  { id: 'cup', name: 'Ly & ống hút', icon: '🥤', unit: 'cái', pack: 50, packLabel: '50 ly', price: 5, start: 30 },
  { id: 'condensed', name: 'Sữa đặc', icon: '🥫', unit: 'ml', pack: 300, packLabel: 'lon 380 g (~300 ml)', price: 6, start: 300 },
  { id: 'milk', name: 'Sữa tươi', icon: '🥛', unit: 'ml', pack: 1000, packLabel: 'hộp 1 lít', price: 5, start: 1000 },
  { id: 'ice', name: 'Đá viên', icon: '🧊', unit: 'g', pack: 2000, packLabel: 'túi 2 kg', price: 2, start: 2000 },
  { id: 'egg', name: 'Trứng gà', icon: '🥚', unit: 'quả', pack: 10, packLabel: 'vỉ 10 quả', price: 4, start: 0 },
  { id: 'cream', name: 'Kem whipping', icon: '🍶', unit: 'ml', pack: 250, packLabel: 'hộp 250 ml', price: 6, start: 0 },
  { id: 'salt', name: 'Muối biển', icon: '🧂', unit: 'g', pack: 100, packLabel: 'gói 100 g', price: 1, start: 0 },
  { id: 'filter', name: 'Giấy lọc V60', icon: '📄', unit: 'tờ', pack: 40, packLabel: 'hộp 40 tờ', price: 4, start: 0 },
];

// prices[level] is the cost to go from that level to the next; max level = prices.length.
export const GEAR = [
  { id: 'phin', name: 'Bộ phin', icon: '🫖', start: 1, prices: [0, 40, 90], detail: 'Phin inox dày giữ nhiệt đều, giọt chảy ổn định.' },
  { id: 'grinder', name: 'Máy xay', icon: '⚙️', start: 1, prices: [0, 80, 160], detail: 'Lưỡi xay côn cho hạt đều: chiết đều, ít đắng chát.' },
  { id: 'espresso', name: 'Máy espresso', icon: '☕', start: 0, prices: [120, 200, 320], detail: 'Mở Espresso, Americano. Cấp cao giữ áp 9 bar, nhiệt ổn định.' },
  { id: 'steamer', name: 'Ca & vòi đánh sữa', icon: '🥛', start: 0, prices: [60, 120], detail: 'Mở Cappuccino, Latte. Bọt sữa mịn hơn ở cấp cao.' },
  { id: 'mixer', name: 'Máy đánh trứng/kem', icon: '🥚', start: 0, prices: [70], detail: 'Mở Cà phê trứng, Cà phê muối.' },
  { id: 'v60', name: 'Bộ V60 + ấm cổ ngỗng', icon: '🫗', start: 0, prices: [90], detail: 'Mở Pour-over V60: rót tay kiểm soát dòng nước.' },
  // Automation fills fixed counter slots, so layout and walking lanes never change when they are bought.
  { id: 'station', name: 'Trạm pha thêm', icon: '🧰', group: 'auto', start: 0, prices: [150, 260], detail: 'Mỗi trạm thêm 1 barista pha cùng lúc (tối đa 3 trạm).' },
  { id: 'register2', name: 'Quầy thu ngân 2', icon: '🧾', group: 'auto', start: 0, prices: [180], detail: 'Hai thu ngân nhận order cùng lúc, hàng chờ đi nhanh gấp đôi.' },
  { id: 'kiosk', name: 'Kiosk tự order', icon: '🖥️', group: 'auto', start: 0, prices: [200, 300], detail: 'Khách tự gọi món trên màn hình, không cần thu ngân. Mỗi cấp thêm 1 máy.' },
  { id: 'pickup', name: 'Quầy nhận đồ + màn hình gọi số', icon: '📺', group: 'auto', start: 0, prices: [160], detail: 'Khách mang đi tự tới lấy ly khi màn hình gọi số.' },
  { id: 'autoEspresso', name: 'Máy espresso tự động', icon: '🤖', group: 'auto', start: 0, prices: [350], detail: 'Tự pha Espresso, Americano (70 điểm) khi có order, không cần barista.' },
];

// Staff train from level 1 to STAFF_MAX; each level adds +6 to every stat and work effects come from the stats.
export const STAFF_MAX = 5;
export const MAX_CREW = 10;
export const STAFF_STATS = [['speed', 'Tốc độ'], ['skill', 'Khéo tay'], ['charm', 'Giao tiếp'], ['memory', 'Trí nhớ']];
// max per role keeps a 10-person crew balanced (2 + 3 + 3 + 1 + 1).
export const STAFF_ROLES = [
  { id: 'cashier', name: 'Thu ngân', icon: '🧾', wage: 6, max: 2, color: '#9a6a8a', detail: 'Đứng quầy thu ngân nhận order khách đầu hàng.' },
  { id: 'barista', name: 'Barista', icon: '☕', wage: 12, max: 3, color: '#5b4a3a', detail: 'Mỗi người một trạm pha; tự pha món bạn đã luyện đủ điểm.' },
  { id: 'waiter', name: 'Phục vụ', icon: '🛎️', wage: 6, max: 3, color: '#3f6f62', detail: 'Lấy ly ở quầy giao, bưng ra đúng bàn; rảnh thì dọn bàn.' },
  { id: 'cleaner', name: 'Tạp vụ', icon: '🧽', wage: 5, max: 1, color: '#6f8fb0', detail: 'Ưu tiên dọn bàn có ly bẩn để khách mới ngồi được.' },
  { id: 'manager', name: 'Quản lý ca', icon: '📋', wage: 15, max: 1, color: '#8a5a33', detail: 'Cả đội làm nhanh hơn; tự nhập nguyên liệu khi kho sắp hết.' },
];
export const CANDIDATES = [
  { id: 'mai', role: 'cashier', person: 'Mai', avatar: '👩‍💼', stats: { speed: 55, skill: 40, charm: 65, memory: 60 }, bio: 'Nhanh nhẹn, nhớ mặt khách quen, luôn cười chào.' },
  { id: 'lan', role: 'cashier', person: 'Lan', avatar: '👩', stats: { speed: 65, skill: 35, charm: 55, memory: 50 }, bio: 'Bấm máy tính tiền nhanh nhất phố.' },
  { id: 'khoa', role: 'barista', person: 'Khoa', avatar: '🧑‍🍳', stats: { speed: 45, skill: 60, charm: 40, memory: 55 }, bio: 'Mê cà phê từ nhỏ, tỉ mỉ từng gram bột.' },
  { id: 'vy', role: 'barista', person: 'Vy', avatar: '👩‍🍳', stats: { speed: 50, skill: 70, charm: 45, memory: 50 }, bio: 'Từng thi latte art, tay rót sữa rất đều.' },
  { id: 'phat', role: 'barista', person: 'Phát', avatar: '👨‍🍳', stats: { speed: 62, skill: 52, charm: 38, memory: 45 }, bio: 'Pha nhanh như chớp giờ cao điểm.' },
  { id: 'ngan', role: 'barista', person: 'Ngân', avatar: '🧕', stats: { speed: 42, skill: 64, charm: 55, memory: 68 }, bio: 'Thuộc lòng mọi công thức, ít khi sai bước.' },
  { id: 'tuan', role: 'waiter', person: 'Tuấn', avatar: '🙋‍♂️', stats: { speed: 60, skill: 45, charm: 55, memory: 45 }, bio: 'Chân chạy không mỏi, bưng khay vững.' },
  { id: 'hung', role: 'waiter', person: 'Hùng', avatar: '🧑', stats: { speed: 70, skill: 40, charm: 45, memory: 40 }, bio: 'Nhanh nhất đội nhưng hơi ít nói.' },
  { id: 'thao', role: 'waiter', person: 'Thảo', avatar: '👧', stats: { speed: 55, skill: 50, charm: 66, memory: 45 }, bio: 'Khách quý vì nụ cười, tip luôn cao.' },
  { id: 'duy', role: 'waiter', person: 'Duy', avatar: '👦', stats: { speed: 64, skill: 46, charm: 42, memory: 52 }, bio: 'Nhớ đúng bàn nào gọi món gì.' },
  { id: 'bay', role: 'cleaner', person: 'Chú Bảy', avatar: '👴', stats: { speed: 60, skill: 52, charm: 40, memory: 40 }, bio: 'Bàn nào qua tay chú cũng sạch bóng.' },
  { id: 'tu', role: 'cleaner', person: 'Cô Tư', avatar: '👵', stats: { speed: 50, skill: 60, charm: 50, memory: 48 }, bio: 'Dọn kỹ, xếp ghế ngay ngắn.' },
  { id: 'quang', role: 'manager', person: 'Quang', avatar: '🧔', stats: { speed: 50, skill: 55, charm: 70, memory: 68 }, bio: 'Từng quản lý chuỗi quán, giữ nhịp cả đội.' },
  { id: 'hanh', role: 'manager', person: 'Hạnh', avatar: '👩‍🦰', stats: { speed: 45, skill: 60, charm: 75, memory: 64 }, bio: 'Lo xa: kho chưa hết đã đặt hàng.' },
];
export const roleOf = id => STAFF_ROLES.find(r => r.id === CANDIDATES.find(c => c.id === id)?.role);
export const candidateById = id => CANDIDATES.find(c => c.id === id);
export const staffStat = (person, level, key) => Math.min(100, person.stats[key] + 6 * (level - 1));
export function staffEffects(person, level) {
  const s = key => staffStat(person, level, key);
  if (person.role === 'cashier') return { delay: 3.2 - s('speed') * .022, patience: 1 + s('charm') / 400 };
  if (person.role === 'waiter') return { speed: 1.6 + s('speed') * .022, tip: s('charm') / 1000 };
  if (person.role === 'cleaner') return { speed: 1.6 + s('speed') * .022, cleanMs: 4200 - s('skill') * 28 };
  if (person.role === 'manager') return { boost: 1 + (s('charm') + s('memory')) / 1400, restock: true };
  return { ms: 16000 - s('speed') * 100, score: Math.round(50 + s('skill') * .4), mastery: Math.round(90 - s('memory') * .4), speed: 2.2 };
}
export function effectLines(person, level) {
  const e = staffEffects(person, level), n = person.person;
  if (person.role === 'cashier') return [['Tốc độ', `Nhận 1 order mỗi ${e.delay.toFixed(1)} giây`], ['Giao tiếp', `Khách do ${n} xếp chỗ chờ lâu hơn ${Math.round((e.patience - 1) * 100)}%`]];
  if (person.role === 'waiter') return [['Tốc độ', `Đi ${e.speed.toFixed(1)} m/s`], ['Giao tiếp', `Ly do ${n} bưng thêm tip ${(e.tip * 100).toFixed(1)}%`]];
  if (person.role === 'cleaner') return [['Tốc độ', `Đi ${e.speed.toFixed(1)} m/s`], ['Khéo tay', `Dọn 1 bàn trong ${(e.cleanMs / 1000).toFixed(1)} giây`]];
  if (person.role === 'manager') return [['Giao tiếp + Trí nhớ', `Cả đội nhanh hơn ${Math.round((e.boost - 1) * 100)}%`], ['Kho', 'Tự nhập nguyên liệu khi sắp hết']];
  return [['Tốc độ', `${(e.ms / 1000).toFixed(1)} giây/ly`], ['Khéo tay', `Tay nghề ${e.score} điểm`], ['Trí nhớ', `Pha được món bạn luyện từ ${e.mastery} điểm`]];
}
export const staffWage = (role, level = 1) => Math.round(role.wage * (1 + .25 * (level - 1)));
export const trainCost = level => 40 * level;

// Per-table upgrades: seats, comfort (seated patience multiplier) and tip bonus.
export const TABLE_LEVELS = [
  { name: 'Bàn gỗ 2 ghế', seats: 2, patience: 1, tip: 0, price: 0, detail: 'Bàn tròn nhỏ, ghế gỗ.' },
  { name: 'Bàn 4 ghế', seats: 4, patience: 1, tip: 0, price: 60, detail: 'Thêm 2 ghế cho nhóm bạn.' },
  { name: 'Ghế đệm + đèn bàn', seats: 4, patience: 1.25, tip: .1, price: 120, detail: 'Khách chờ lâu hơn 25%, tip +10%.' },
  { name: 'Sofa + hoa tươi', seats: 4, patience: 1.4, tip: .2, price: 220, detail: 'Khách chờ lâu hơn 40%, tip +20%.' },
];
export const MAX_TABLES = 10;

// Grind options carry no emoji; the bench draws a particle-size sample instead.
const GRINDS = [['Mịn như bột mì', ''], ['Vừa mịn như đường cát', ''], ['Vừa thô như muối hạt', ''], ['Thô như muối hột to', '']];
function grind(correct, learn) {
  return { type: 'pick', text: 'Chọn độ xay', learn, options: GRINDS.map(([label, icon], i) => ({
    label, icon, ok: i === correct ? 1 : 0,
    why: i < correct ? 'Quá mịn: nước chảy chậm, chiết quá lâu → đắng gắt, dễ tắc.' : 'Quá thô: nước chảy nhanh, chiết thiếu → nhạt, chua.',
  })) };
}
// wait: a real-world waiting phase played as a fast-forward animation after the step ([label, real duration]).
const pour = (text, icon, unit, target, max, learn, layer = null, wait = null) => ({ type: 'pour', text, icon, unit, target, max, learn, layer, wait });
const bean = learn => ({ type: 'bean', learn });
const phinSteps = (grams, water) => [
  bean('Phin truyền thống hợp Robusta: đậm, đắng, nhiều caffeine.'),
  grind(2, 'Phin cần xay vừa thô để nước thấm chậm 4–5 phút.'),
  pour('Cân bột vào phin', '🫘', 'g', [grams - 1, grams + 1], grams + 10, `Khoảng ${grams} g bột cho một phin.`),
  { type: 'pick', text: 'Đặt nắp gài', learn: 'Lắc phẳng mặt bột rồi gài nhẹ để nước thấm đều.', options: [
    { label: 'Lắc phẳng, gài nhẹ', icon: '✋', ok: 1, why: 'Nước thấm đều toàn bộ bột.' },
    { label: 'Nén thật chặt', icon: '✊', ok: 0, why: 'Nén chặt làm phin tắc, chảy quá lâu và đắng.' },
    { label: 'Bỏ nắp gài', icon: '🚫', ok: .5, why: 'Bột trồi lên, nước chảy không đều.' },
  ] },
  pour('Rót nước 92–96 °C để ủ', '💧', 'ml', [15, 25], 50, 'Ủ 30–40 giây cho bột nở và thoát khí CO₂ rồi mới rót tiếp.', null, ['Ủ cho bột nở', '30–40 giây']),
  pour('Rót đầy phin', '💧', 'ml', [water - 10, water + 10], water + 40, 'Đậy nắp, chờ cà phê nhỏ giọt 4–5 phút.', '#3b2416', ['Phin nhỏ giọt', '4–5 phút']),
];
const espressoSteps = () => [
  bean('Espresso thường dùng Arabica hoặc blend: thơm, chua thanh, crema đẹp.'),
  grind(0, 'Espresso cần xay mịn vì nước chỉ tiếp xúc bột 25–30 giây dưới áp 9 bar.'),
  pour('Định lượng bột vào tay cầm', '🫘', 'g', [17, 19], 26, 'Shot đôi chuẩn dùng khoảng 18 g bột.'),
  { type: 'pick', text: 'Nén bột (tamp)', learn: 'Nén phẳng, lực đều khoảng 15 kg để nước đi đều.', options: [
    { label: 'Nén phẳng, lực đều', icon: '⬇️', ok: 1, why: 'Bánh cà phê chặt đều, chiết đều.' },
    { label: 'Nén lệch một bên', icon: '↘️', ok: 0, why: 'Nước tạo kênh qua chỗ lỏng → chiết không đều.' },
    { label: 'Không nén', icon: '🚫', ok: 0, why: 'Nước xuyên quá nhanh → shot loãng, chua.' },
  ] },
  pour('Chiết shot 25–30 giây', '☕', 'g', [33, 39], 60, 'Tỉ lệ 1:2 — 18 g bột cho khoảng 36 g espresso, nước 92–94 °C.', '#4a2a17'),
];

export const RECIPES = [
  { id: 'phin-den', name: 'Phin đen nóng', icon: '☕', price: 2.5, beans: 20, bean: 'robusta', uses: { cup: 1 }, gear: { phin: 1 }, reputation: 0,
    card: { ratio: '1 : 4 (20 g bột : ~90 ml nước)', tool: 'Phin nhôm/inox', grind: 'Vừa thô', temp: '92–96 °C', time: '4–5 phút nhỏ giọt' },
    story: 'Cách pha quen thuộc của người Việt từ thời Pháp thuộc; phin giúp cà phê Robusta ra vị đậm.',
    steps: phinSteps(20, 70) },
  { id: 'nau-da', name: 'Cà phê sữa đá', icon: '🧋', price: 3, beans: 20, bean: 'robusta', uses: { cup: 1, condensed: 25, ice: 150 }, gear: { phin: 1 }, reputation: 0,
    card: { ratio: '20 g bột · 25 ml sữa đặc · ~70 ml nước · đá', tool: 'Phin + ly đá', grind: 'Vừa thô', temp: '92–96 °C', time: '4–5 phút' },
    story: 'Sữa đặc ra đời vì thời xưa khó giữ sữa tươi; nay thành ly cà phê biểu tượng của Việt Nam.',
    steps: [pour('Cho sữa đặc vào ly trước', '🥫', 'ml', [20, 30], 50, 'Đặt phin lên ly có sẵn sữa đặc.', '#f3e2b8'), ...phinSteps(20, 70).slice(0, 3), ...phinSteps(20, 70).slice(4),
      { type: 'pick', text: 'Hoàn thiện ly', learn: 'Khuấy tan sữa khi cà phê còn nóng rồi mới đổ ra ly đá.', options: [
        { label: 'Khuấy đều rồi đổ ra ly đá', icon: '🥄', ok: 1, why: 'Sữa đặc tan đều khi còn nóng.' },
        { label: 'Bỏ đá vào rồi mới khuấy', icon: '🧊', ok: .5, why: 'Sữa đặc gặp lạnh quánh lại, khó tan.' },
      ] }] },
  { id: 'bac-xiu', name: 'Bạc xỉu', icon: '🥛', price: 3, beans: 10, bean: 'robusta', uses: { cup: 1, condensed: 20, milk: 60, ice: 150 }, gear: { phin: 1 }, reputation: 55,
    card: { ratio: '20 ml sữa đặc · 60 ml sữa tươi · ~30 ml cà phê', tool: 'Phin nhỏ + ly đá', grind: 'Vừa thô', temp: '92–96 °C', time: '4 phút' },
    story: 'Gốc từ "bạc tẩy xỉu" của người Hoa ở Sài Gòn: ly sữa trắng pha chút cà phê.',
    steps: [pour('Cho sữa đặc', '🥫', 'ml', [15, 25], 40, 'Bạc xỉu ngọt nhẹ, sữa nhiều hơn cà phê.', '#f3e2b8'), pour('Rót sữa tươi', '🥛', 'ml', [50, 70], 100, 'Sữa tươi làm vị béo nhẹ, màu trắng ngà.', '#fbf6ea'),
      { type: 'pick', text: 'Thêm đá', learn: 'Đá trước, cà phê rót sau cùng để tạo tầng màu.', options: [
        { label: 'Đá đầy ly', icon: '🧊', ok: 1, why: 'Đá giữ tầng sữa lạnh, cà phê nổi phía trên.' },
        { label: 'Không đá', icon: '🚫', ok: 0, why: 'Bạc xỉu là món đá; không đá sẽ ngấy.' },
      ] },
      pour('Rót cà phê phin lên trên', '☕', 'ml', [25, 35], 60, 'Khoảng 30 ml cà phê phin là đủ, không lấn vị sữa.', '#6b4325')] },
  { id: 'espresso', name: 'Espresso', icon: '☕', price: 3, beans: 18, bean: 'arabica', uses: { cup: 1 }, gear: { espresso: 1 }, reputation: 0,
    card: { ratio: '1 : 2 (18 g bột → 36 g)', tool: 'Máy espresso 9 bar', grind: 'Mịn', temp: '92–94 °C', time: '25–30 giây' },
    story: 'Ra đời ở Ý đầu thế kỷ 20: nước nóng nén qua bột mịn cho ly nhỏ, đậm và có lớp crema.',
    steps: espressoSteps() },
  { id: 'americano', name: 'Americano', icon: '🫖', price: 3.2, beans: 18, bean: 'arabica', uses: { cup: 1 }, gear: { espresso: 1 }, reputation: 0,
    card: { ratio: 'Espresso 36 g + 100–140 ml nước nóng', tool: 'Máy espresso', grind: 'Mịn', temp: '92–94 °C', time: '30 giây' },
    story: 'Tương truyền lính Mỹ ở Ý pha loãng espresso cho giống cà phê quê nhà. Rót espresso lên nước (Long Black) giữ crema hơn.',
    steps: [...espressoSteps(), pour('Thêm nước nóng', '💧', 'ml', [100, 140], 180, 'Tỉ lệ espresso : nước khoảng 1 : 3–4.', '#7a5232')] },
  { id: 'cappuccino', name: 'Cappuccino', icon: '☕', price: 4, beans: 18, bean: 'arabica', uses: { cup: 1, milk: 120 }, gear: { espresso: 1, steamer: 1 }, reputation: 0,
    card: { ratio: '1/3 espresso · 1/3 sữa nóng · 1/3 bọt', tool: 'Máy espresso + ca đánh sữa', grind: 'Mịn', temp: 'Sữa 60–65 °C', time: '30 giây + đánh sữa' },
    story: 'Tên gọi gợi màu áo nâu của các tu sĩ dòng Capuchin.',
    steps: [...espressoSteps(), pour('Đánh nóng sữa tới', '🌡️', '°C', [60, 65], 80, 'Quá 70 °C sữa mất vị ngọt, có mùi chín.'),
      { type: 'pick', text: 'Độ dày bọt sữa', learn: 'Cappuccino có lớp bọt dày khoảng 1–1,5 cm.', options: [
        { label: 'Bọt dày ~1–1,5 cm', icon: '☁️', ok: 1, why: 'Đúng chất cappuccino.' },
        { label: 'Bọt mỏng ~0,5 cm', icon: '〰️', ok: 0, why: 'Bọt mỏng là đặc trưng của latte.' },
      ] },
      pour('Rót sữa và bọt', '🥛', 'ml', [100, 140], 180, 'Rót từ giữa ly để bọt nổi thành lớp.', '#efe0c4')] },
  { id: 'latte', name: 'Latte', icon: '🥛', price: 4, beans: 18, bean: 'arabica', uses: { cup: 1, milk: 200 }, gear: { espresso: 1, steamer: 1 }, reputation: 0,
    card: { ratio: 'Espresso 36 g + ~200 ml sữa nóng', tool: 'Máy espresso + ca đánh sữa', grind: 'Mịn', temp: 'Sữa 60–65 °C', time: '30 giây + đánh sữa' },
    story: '"Caffè latte" nghĩa là cà phê sữa trong tiếng Ý; lớp bọt mỏng giúp vẽ latte art.',
    steps: [...espressoSteps(), pour('Đánh nóng sữa tới', '🌡️', '°C', [60, 65], 80, 'Giữ dưới 70 °C để sữa ngọt tự nhiên.'),
      { type: 'pick', text: 'Độ dày bọt sữa', learn: 'Latte chỉ cần lớp bọt mịn mỏng khoảng 0,5 cm.', options: [
        { label: 'Bọt mỏng ~0,5 cm', icon: '〰️', ok: 1, why: 'Đúng chất latte, dễ vẽ hình.' },
        { label: 'Bọt dày ~1,5 cm', icon: '☁️', ok: 0, why: 'Bọt dày là cappuccino.' },
      ] },
      pour('Rót sữa', '🥛', 'ml', [180, 220], 260, 'Latte nhiều sữa, vị êm.', '#f1e6cf')] },
  { id: 'trung', name: 'Cà phê trứng', icon: '🥚', price: 5, beans: 15, bean: 'robusta', uses: { cup: 1, egg: 1, condensed: 20 }, gear: { phin: 1, mixer: 1 }, reputation: 60,
    card: { ratio: '1 lòng đỏ · 20 ml sữa đặc · 40 ml cà phê phin', tool: 'Phin + máy đánh trứng', grind: 'Vừa thô', temp: 'Uống nóng', time: 'Đánh 3–5 phút' },
    story: 'Ra đời ở Hà Nội thập niên 1940 khi sữa tươi khan hiếm, lòng đỏ trứng được đánh bông thay thế.',
    steps: [{ type: 'pick', text: 'Tách trứng', learn: 'Chỉ dùng lòng đỏ để kem sánh, không tanh.', options: [
        { label: 'Chỉ lấy lòng đỏ', icon: '🟡', ok: 1, why: 'Lòng đỏ tạo kem béo, mịn.' },
        { label: 'Lấy cả quả', icon: '🥚', ok: 0, why: 'Lòng trắng làm kem tanh, loãng.' },
      ] },
      pour('Thêm sữa đặc', '🥫', 'ml', [15, 25], 40, 'Sữa đặc tạo vị ngọt và giúp kem đứng.'),
      pour('Đánh bông kem trứng', '🌀', 'phút', [3, 5], 8, 'Đánh tới khi kem bông, màu ngà và sánh.'),
      pour('Rót cà phê phin đen', '☕', 'ml', [35, 45], 70, 'Khoảng 40 ml cà phê phin đậm.', '#3b2416'),
      { type: 'pick', text: 'Phủ kem và giữ nóng', learn: 'Phủ kem trứng lên cà phê, đặt ly trong bát nước nóng.', options: [
        { label: 'Đặt ly vào bát nước nóng', icon: '♨️', ok: 1, why: 'Kem giữ ấm, không tách lớp.' },
        { label: 'Thêm đá', icon: '🧊', ok: .5, why: 'Có bản đá nhưng bản truyền thống uống nóng.' },
      ], layer: '#f1d98a' }] },
  { id: 'muoi', name: 'Cà phê muối', icon: '🧂', price: 4.5, beans: 18, bean: 'robusta', uses: { cup: 1, cream: 40, salt: 1, condensed: 15, ice: 120 }, gear: { phin: 1, mixer: 1 }, reputation: 65,
    card: { ratio: '40 ml cà phê · 15 ml sữa đặc · kem 40 ml + ~0,5 g muối', tool: 'Phin + máy đánh kem', grind: 'Vừa thô', temp: 'Uống đá', time: 'Đánh kem 1–2 phút' },
    story: 'Đặc sản Huế: chút muối làm dịu vị đắng và nổi vị ngọt béo của kem.',
    steps: [pour('Rót cà phê phin đen', '☕', 'ml', [35, 45], 70, 'Cà phê phin Robusta đậm làm nền.', '#3b2416'),
      pour('Thêm sữa đặc', '🥫', 'ml', [12, 18], 30, 'Ít sữa hơn cà phê sữa đá vì kem đã béo.', '#a07a52'),
      pour('Rót kem whipping', '🍶', 'ml', [35, 45], 70, 'Kem lạnh đánh dễ bông hơn.'),
      pour('Thêm muối', '🧂', 'g', [.4, .8], 2, 'Chỉ một nhúm nhỏ khoảng 0,5 g.'),
      { type: 'pick', text: 'Hoàn thiện ly', learn: 'Đá trước, phủ lớp kem muối lên trên cùng.', options: [
        { label: 'Thêm đá, phủ kem muối lên trên', icon: '🧊', ok: 1, why: 'Ngụm đầu mặn béo rồi tới cà phê đậm.' },
        { label: 'Khuấy tan kem vào cà phê', icon: '🥄', ok: .5, why: 'Mất lớp kem mặn – ngọt đặc trưng.' },
      ], layer: '#f4ead7' }] },
  { id: 'v60', name: 'Pour-over V60', icon: '🫗', price: 5, beans: 15, bean: 'arabica', uses: { cup: 1, filter: 1 }, gear: { v60: 1 }, reputation: 0,
    card: { ratio: '1 : 16 (15 g bột : 250 g nước)', tool: 'Phễu V60 + giấy lọc + ấm cổ ngỗng', grind: 'Vừa mịn', temp: '92–94 °C', time: '2:30–3:00' },
    story: 'Phễu V60 của Nhật có rãnh xoắn và lỗ lớn, cho vị trong và thơm hương trái cây của Arabica.',
    steps: [bean('Pour-over làm nổi hương Arabica: chua thanh, thơm hoa quả.'),
      grind(1, 'Xay vừa mịn để nước chảy hết trong khoảng 3 phút.'),
      { type: 'pick', text: 'Chuẩn bị giấy lọc', learn: 'Tráng giấy lọc bằng nước nóng rồi đổ nước tráng đi.', options: [
        { label: 'Tráng giấy bằng nước nóng', icon: '💧', ok: 1, why: 'Khử mùi giấy và làm nóng phễu.' },
        { label: 'Dùng giấy khô', icon: '📄', ok: .5, why: 'Cà phê dễ có vị giấy.' },
      ] },
      pour('Cân bột', '🫘', 'g', [14, 16], 25, 'Khoảng 15 g bột cho một ly 250 ml.'),
      pour('Rót ủ (bloom) 30–45 giây', '💧', 'g', [25, 40], 60, 'Lượng nước ủ gấp khoảng 2 lần bột.', null, ['Bloom: bột phồng, thoát CO₂', '30–45 giây']),
      pour('Rót xoắn ốc tới tổng', '🫗', 'g', [235, 265], 320, 'Rót chậm từ tâm ra ngoài, tránh rót vào thành giấy.', '#8a5a33', ['Nước chảy qua giấy lọc', '2:30–3:00'])] },
];

export const recipeById = id => RECIPES.find(recipe => recipe.id === id);
export const stars = score => score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0;
export const cafeRank = reputation => Math.max(1, Math.min(5, 1 + Math.floor((reputation - 10) / 20)));

export function lockReason(recipe, cafe) {
  const gear = Object.entries(recipe.gear).find(([id, level]) => (cafe.gear[id] || 0) < level);
  if (gear) return `Cần ${GEAR.find(item => item.id === gear[0]).name}`;
  return cafe.reputation < recipe.reputation ? `Cần uy tín ${recipe.reputation}` : '';
}

export function missingFor(recipe, cafe, cropId) {
  const missing = [];
  const reason = lockReason(recipe, cafe);
  if (reason) missing.push(reason.replace('Cần ', ''));
  if ((cafe.stock.roasted[cropId] || 0) < recipe.beans) missing.push(`${recipe.beans} g hạt ${CROPS.find(crop => crop.id === cropId)?.short || ''}`.trim());
  for (const [id, amount] of Object.entries(recipe.uses)) {
    const supply = SUPPLIES.find(item => item.id === id);
    if ((cafe.supplies[id] || 0) < amount) missing.push(`${supply.name} ${amount} ${supply.unit}`);
  }
  return missing;
}

export function gearBonus(recipe, gear) {
  return Object.keys(recipe.gear).reduce((sum, id) => sum + Math.max(0, (gear[id] || 0) - 1) * 4, Math.max(0, (gear.grinder || 1) - 1) * 3);
}
