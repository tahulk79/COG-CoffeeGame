import { Vector3 } from 'three';
import { sfx } from '../../shared/audio/index.js';
import { popNumber, shake } from '../../shared/vfx/index.js';
import { formatCoins } from './rules.js';

// Bảng §4.1 của docs/shared/ui-audio-vfx.md: chỉnh độ mạnh/âm của farm ở đúng một chỗ này.
// sound: id âm · burst: [[loại hạt, số hạt]] · emit: [loại, giây] · pulse: nảy vật 3D · shake: độ rung · spend: có tiếng coin.spend khi mất xu
const BUILD = { sound: 'farm.build', burst: [['dust', 16], ['sparkle', 10]], pulse: true, shake: .6, spend: true };
const SHIP = { sound: 'farm.ship', emit: ['dust', 1], spend: true };
const BUY = { sound: 'ui.buy', spend: true };
const POND = { sound: 'farm.water', burst: [['water', 10]] };
const ACTIONS = {
  plant: { sound: 'farm.plant', burst: [['soil', 8]], pulse: true },
  water: { sound: 'farm.water', burst: [['water', 12]] },
  fertilize: { sound: 'farm.fertilize', burst: [['granule', 10]] },
  weed: { sound: 'farm.weed', burst: [['leaf', 8]] },
  prune: { sound: 'farm.prune', burst: [['leaf', 6]] },
  clear: { sound: 'farm.clear', burst: [['soil', 14]], shake: .5 },
  harvest: { sound: 'farm.harvest', burst: [['cherry', 10]] },
  refill: { sound: 'farm.refill', burst: [['water', 8]] },
  start: { sound: 'farm.process', emit: ['dust', 1.5] }, // lò rang đổi sang steam bên dưới
  turn: { sound: 'farm.turn', burst: [['dust', 10]] },
  collect: { sound: 'farm.collect', pulse: true },
  buySeed: BUY, fertilizer: BUY,
  sell: { burst: [['coin', 8]] }, order: { burst: [['coin', 8]] },
  acceptOrder: { sound: 'ui.tab', pulse: true },
  shipOrder: SHIP, ship: SHIP,
  expand: BUILD, upgrade: BUILD,
  hire: { sound: 'ui.buy' }, shift: { sound: 'ui.buy' }, train: { sound: 'ui.buy' },
  stockFish: POND, feedFish: POND, harvestFish: { burst: [['water', 10]] },
  repair: { sound: 'farm.build', burst: [['sparkle', 6]] },
  claim: { sound: 'reward.quest' },
};
// Nhân viên: chỉ hái, nhận mẻ, giao mới có tiếng (3D, nhỏ), hạt ×0,5.
const CREW = { harvest: ['farm.harvest', 'cherry', 5], collect: ['farm.collect', null, 0], ship: ['farm.ship', 'dust', 4], shipOrder: ['farm.ship', 'dust', 4] };
const DECOR = { place: ['farm.plant', 'dust'], built: ['farm.build', 'sparkle'], demolish: ['farm.clear', 'soil'] };
const ROASTER_SMOKE = { offset: [.95, 3.9, -.5], rate: 6 }; // đỉnh ống khói lò rang (environment.js)

export function createFarmFeedback({ vfx, world, character }) {
  const objects = new Map();
  let smoke = null;
  const point = (id, y = .6) => {
    const target = id && world.getInteraction(id);
    return target ? { x: target.position[0], y, z: target.position[1] } : { x: character.position.x, y, z: character.position.z };
  };
  // Nhóm 3D của trạm/ô theo interactId, nhớ lại để không duyệt scene mỗi lần.
  const objectOf = id => {
    let object = objects.get(id);
    if (object?.parent) return object;
    object = null;
    world.scene.traverse(node => { if (!object && node.userData.interactId === id) object = node; });
    if (object) objects.set(id, object);
    return object;
  };
  const coinPoint = () => {
    const rect = document.getElementById('farm-coins')?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.bottom + 14 } : null;
  };

  function action({ id, action, result, before, after, levelUp }) {
    if (!result.ok) { sfx('ui.deny'); return; }
    const spec = ACTIONS[action] || {}, at = point(id), sounds = [];
    if (spec.sound) sounds.push(spec.sound);
    for (const [kind, count] of spec.burst || []) vfx.burst(kind, at, { count });
    if (spec.emit) vfx.emitter(action === 'start' && id === 'roaster' ? 'steam' : spec.emit[0], at, { rate: 10, duration: spec.emit[1] }); // tự dừng theo duration
    if (spec.pulse) vfx.pulse(objectOf(id));
    if (spec.shake) shake(spec.shake);
    const delta = after.coins - before.coins;
    if (delta > 0) sounds.push('coin.gain');
    if (delta < 0) {
      if (spec.spend) sounds.push('coin.spend');
      popNumber(`−${formatCoins(-delta)} xu`, coinPoint(), 'bad');
    }
    const self = { x: character.position.x, y: 1.2, z: character.position.z };
    if (levelUp) {
      vfx.burst('sparkle', self, { count: 30 });
      document.getElementById('farm-level')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450 });
      sounds.push('reward.levelup');
    } else if (result.quests?.length) {
      vfx.burst('sparkle', self, { count: 20 });
      sounds.push('reward.quest');
    }
    for (const id of new Set(levelUp ? sounds.filter(item => item !== 'reward.quest') : sounds)) sfx(id);
  }

  return function feedback(event, data = {}) {
    if (event === 'action') { action(data); return; }
    if (event === 'ready') { const at = point(data.id, 2); sfx('farm.ready', { at }); vfx.burst('sparkle', at, { count: 12 }); return; }
    if (event === 'arrive') { sfx('farm.arrive'); return; }
    if (event === 'crew') {
      const spent = (data.before?.coins ?? 0) - (data.after?.coins ?? 0);
      if (spent > 0) popNumber(`−${formatCoins(spent)} xu`, coinPoint(), 'bad'); // nhân viên trả cước giao đơn
      const spec = CREW[data.task?.action]; if (!spec) return;
      const at = point(data.task.id);
      sfx(spec[0], { at, volume: .5 });
      if (spec[1]) vfx.burst(spec[1], at, { count: spec[2] });
      return;
    }
    if (event === 'decor') {
      if (!data.ok) { sfx('ui.deny'); return; }
      const [sound, kind] = DECOR[data.mode] || []; if (!sound) return;
      sfx(sound); vfx.burst(kind, data.at, { count: data.mode === 'demolish' ? 10 : 12 });
      return;
    }
    if (event === 'roasting') {
      if (data.on && !smoke) {
        const base = world.getInteraction('roaster')?.position; if (!base) return;
        const [dx, y, dz] = ROASTER_SMOKE.offset;
        // GLB tier-1 có Empty `chimney_top`; bậc khác (khối tạm) dùng offset cứng.
        const top = objectOf('roaster')?.getObjectByName('chimney_top');
        let shown = Boolean(top); top?.traverseAncestors(node => { if (!node.visible) shown = false; });
        const at = shown ? top.getWorldPosition(new Vector3()) : { x: base[0] + dx, y, z: base[1] + dz };
        smoke = vfx.emitter('steam', { x: at.x, y: at.y, z: at.z }, { rate: ROASTER_SMOKE.rate });
      } else if (!data.on && smoke) { smoke.stop(); smoke = null; }
    }
  };
}
