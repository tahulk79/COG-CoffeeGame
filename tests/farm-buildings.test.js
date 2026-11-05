// Công trình pha 1 (05/11/2026, F-48, đề xuất Q10 CT-1…CT-16 + vá): danh sách, mốc hiện, vùng cấm xây, cổng khung dọc CT-11.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, INTERACTIONS, HUD_UNLOCKS, FARM_BOUNDS, FIELDS } from '../src/features/farm/content.js';
import { decorationError, nearBuilding, relocateDecorations } from '../src/features/farm/decorations.js';

const at = id => INTERACTIONS.find(item => item.id === id);

test('4 công trình chạm được, ẩn lúc đầu, gắn đúng mốc HUD_UNLOCKS (CT-1, CT-12)', () => {
  assert.deepEqual(BUILDINGS.map(b => b.id), ['cafe-entrance', 'order-board', 'seed-shop', 'crew-house']);
  assert.deepEqual(BUILDINGS.map(b => b.unlock), ['cafe-play', 'order-board', 'seed-shop', 'workers']);
  for (const b of BUILDINGS) {
    assert.ok(HUD_UNLOCKS.some(u => u.id === b.unlock), b.unlock);
    assert.equal(at(b.id)?.initialVisible, false, b.id);
  }
  // CT-13: Cửa quán và Bảng đơn chỉ dựng ở nơi 'both'.
  assert.deepEqual(BUILDINGS.filter(b => b.both).map(b => b.id), ['cafe-entrance', 'order-board']);
});

test('bỏ trạm 3D market; công trình nằm trong FARM_BOUNDS, không đè ruộng (CT-6)', () => {
  assert.equal(at('market'), undefined);
  for (const b of BUILDINGS) {
    const [x, z] = at(b.id).position, f = FARM_BOUNDS;
    assert.ok(x > f.minX + 1 && x < f.maxX - 1 && z > f.minZ + 1 && z < f.maxZ - 1, `${b.id} trong rào`);
    for (const field of FIELDS) assert.ok(Math.abs(x - field.center[0]) > field.footprint.halfWidth + .4 || Math.abs(z - field.center[1]) > field.footprint.halfDepth + .4, `${b.id} ngoài ${field.id}`);
  }
});

// Cổng CT-11: chiếu chân công trình qua camera khung dọc mặc định của scene.js (portraitView focus [-6.4,-.5], zoom .9,
// fov 55 khi rộng < 700, offset camera (0,12.5,11.5), nhìn (x,.9,z-1)) lên màn 375×812, tránh HUD trên/dưới.
function project([x, z], y = 0) {
  const W = 375, H = 812, t = Math.tan(55 / 2 * Math.PI / 180) / .9, cam = [-6.4, 12.5, 11], look = [-6.4, .9, -1.5];
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const f = norm(sub(look, cam)), r = norm([f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = sub([x, y, z], cam), depth = dot(d, f);
  return [(dot(d, r) / depth / (t * W / H) + 1) * W / 2, (1 - dot(d, u) / depth / t) * H / 2];
}
test('cổng CT-11: cả 4 công trình nằm trong khung dọc 375×812 mặc định, ngoài vùng HUD', () => {
  for (const b of BUILDINGS) {
    const [sx, sy] = project(at(b.id).position), [, top] = project(at(b.id).position, 2.4);
    assert.ok(sx > 24 && sx < 351, `${b.id} x=${Math.round(sx)}`);
    assert.ok(top > 150 && sy < 600, `${b.id} y=${Math.round(top)}..${Math.round(sy)}`);
  }
});

test('vùng cấm xây 3,5 m quanh công trình mới (CT-14)', () => {
  const [x, z] = at('seed-shop').position;
  assert.equal(nearBuilding(x + 1, z), true);
  assert.ok(decorationError([], { type: 'flowers', x: x + 1, z, rotation: 0 }));
});

test('save cũ: đồ trang trí trong vùng cấm tự dời, không xoá (CT-14)', () => {
  const [x, z] = at('crew-house').position;
  const items = [{ id: 'decor-1', type: 'lamp', x, z: z + 1, rotation: 0, text: 'A', state: 'complete' }, { id: 'decor-2', type: 'flowers', x: 5, z: 2.5, rotation: 0, text: '', state: 'complete' }];
  const { items: moved, returned } = relocateDecorations(items);
  assert.equal(moved.length, 2); assert.equal(returned.length, 0);
  assert.equal(moved[0].id, 'decor-1'); assert.equal(moved[0].text, 'A');
  assert.equal(nearBuilding(moved[0].x, moved[0].z), false);
  assert.equal(decorationError([moved[1]], moved[0]), null);
  assert.deepEqual(moved[1], items[1]);
});

test('vùng cấm của Cửa quán/Bảng đơn chỉ áp ở nơi both (CT-13)', () => {
  const [x, z] = at('cafe-entrance').position;
  assert.equal(nearBuilding(x, z), true);
  assert.equal(nearBuilding(x, z, 'vn'), true);
  // Nơi chỉ farm ('co'): không giữ chỗ cho Cửa quán/Bảng đơn, chỉ còn các trạm khác.
  const others = INTERACTIONS.filter(i => !['plot', 'field'].includes(i.kind) && !BUILDINGS.some(b => b.both && b.id === i.id));
  assert.equal(nearBuilding(x, z, 'co'), others.some(i => Math.hypot(x - i.position[0], z - i.position[1]) < 3.5));
});
