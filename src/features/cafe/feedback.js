// Cầu nối hình + âm của quán (round-1-foundation §4.2, §4.3). Chỉnh độ mạnh hay đổi âm chỉ sửa ở đây.
import { loop, sfx } from '../../shared/audio/index.js';
import { popNumber } from '../../shared/vfx/index.js';
import { t, formatNumber } from '../../i18n/index.js';

// game.js gắn vfx, object(id) → nhóm 3D của điểm tương tác, screenAt(pos) và player khi vào quán; gỡ (null) khi rời.
let ctx = null;
export function bindCafeFeedback(next) { ctx = next; }

const at3 = pos => pos && { x: pos.x, y: 1.2, z: pos.z };
const burst = (kind, pos, count) => { if (pos) ctx?.vfx.burst(kind, at3(pos), { count }); };
const pulse = id => ctx?.vfx.pulse(ctx.object(id));
const coinsAt = () => {
  const rect = document.getElementById('farm-coins')?.getBoundingClientRect();
  return rect && { x: rect.left + rect.width / 2, y: rect.bottom + 14 };
};
// Theo dụng cụ (bench toolFor), không theo đơn vị hiển thị: đơn vị có thể được dịch.
const HOLD_LOOP = { steamer: 'bench.steam', whisk: 'bench.whisk' };

const TABLE = {
  // ---- Quán (§4.2) ----
  door: ({ open }) => sfx('cafe.door', { rate: open ? 1 : .8 }),
  enter: ({ pos }) => sfx('cafe.door', { at: at3(pos) }),
  turned: ({ pos }) => { burst('puff', pos, 6); sfx('ui.deny', { at: at3(pos) }); },
  order: ({ pos, kiosk }) => { pulse(kiosk ? 'kiosk' : 'register'); sfx('cafe.order', { at: at3(pos) }); },
  cup: ({ pos }) => { burst('steam', pos, 6); sfx('cafe.cup', { at: at3(pos) }); },
  pickup: () => sfx('cafe.cup'),
  serve: ({ pos, stars }) => {
    burst('sparkle', pos, 8); burst('coin', pos, 6);
    if (stars >= 3) burst('heart', pos, 6);
    sfx('cafe.serve'); sfx('coin.gain');
  },
  angry: ({ pos }) => { burst('puff', pos, 8); popNumber(t('cafe.fx.repLoss'), ctx?.screenAt(pos), 'bad'); sfx('cafe.angry', { at: at3(pos) }); },
  clean: ({ pos }) => { burst('sparkle', pos, 6); sfx('cafe.clean', { at: at3(pos) }); },
  call: () => { pulse('pickup'); sfx('cafe.call'); },
  shift: ({ met }) => { if (met) burst('sparkle', ctx?.player.position, 30); sfx(met ? 'cafe.shift-good' : 'cafe.shift-bad'); },
  buy: ({ ok, spent }) => {
    if (!ok) { sfx('ui.deny'); return; }
    if (spent > 0) { sfx('ui.buy'); popNumber(t('cafe.fx.spent', { n: formatNumber(spent, { maximumFractionDigits: 2 }) }), coinsAt(), 'bad'); }
  },
  open: () => sfx('ui.open'),
  close: () => sfx('ui.close'),

  // ---- Quầy pha (§4.3). hold/wait trả về handle có set()/stop() ----
  good: () => sfx('bench.good'),
  partial: () => sfx('ui.tab'),
  bad: () => sfx('bench.bad'),
  grind: () => sfx('bench.grind'),
  band: () => sfx('bench.band'),
  over: () => sfx('bench.over'),
  unlock: () => sfx('reward.quest'),
  stars: ({ count }) => {
    if (!count) { sfx('bench.bad'); return; }
    for (let i = 0; i < count; i++) setTimeout(() => sfx('bench.star', { rate: 2 ** (2 * i / 12) }), i * 250);
  },
  hold: ({ tool, unit }) => {
    if (tool === 'scoop') {
      sfx('bench.scoop');
      const id = setInterval(() => sfx('bench.scoop'), 300);
      return { set() {}, stop() { clearInterval(id); } };
    }
    return loop(HOLD_LOOP[tool] || (tool === 'espresso' ? 'bench.extract' : 'bench.pour'));
  },
  wait: () => loop('bench.wait'),
};

export function feedback(event, data = {}) {
  return TABLE[event]?.(data);
}
