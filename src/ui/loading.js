// The one loading screen (#loading in index.html): progress bar, status line and a tip. Every scene change uses it.
const $ = id => document.getElementById(id);
// Real advice from the game's own rules, shown while a scene loads.
const TIPS = [
  'Mẹo: bấm cây có biểu tượng quả chín, nhân vật sẽ tự tới hái.',
  'Mẹo: đất còn ướt sau mưa thì kiểm tra thoát nước, đừng tưới thêm.',
  'Mẹo: bật "Giữ hạt cho quán" để chợ không bán mất phần dự trữ.',
  'Mẹo: pha một món đạt 3★ là có thể pha theo trí nhớ.',
  'Mẹo: cà phê vối hợp phin đậm; cà phê chè thơm hơn nhưng cần chăm kỹ.',
  'Mẹo: đứng sau quầy thu ngân là tự nhận order, không cần bấm.',
  'Mẹo: ly bạn tự pha bán gấp đôi ly của nhân viên.',
];
export function loading(value, label) {
  $('load-fill').style.width = `${value}%`;
  $('load-track').setAttribute('aria-valuenow', value);
  $('load-status').textContent = `${label} · ${value}%`;
  if (value <= 45) $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; // new tip when a scene starts loading
}
export const showLoading = (value, label) => { $('loading').hidden = false; loading(value, label); };
export const hideLoading = () => { $('loading').hidden = true; };
