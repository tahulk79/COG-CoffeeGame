import * as THREE from 'three';
import { COASTS, DESERTS, MOUNTAINS, project } from './geo.js';

// Địa hình bản đồ thế giới: một tấm lưới liền, độ cao tính từ mặt nạ đất liền (đường bờ biển) đã làm mờ → bờ thoải, nội địa
// cao dần, núi nhô lên theo dãy thật. Màu đỉnh theo độ cao + dải khí hậu + sa mạc. Tính một lần trên CPU (~50 nghìn đỉnh).
const MASK_W = 720, MASK_H = 288; // 2 điểm ảnh / độ, vĩ độ 85,5 → −58,5
const latTop = 85.5, latSpan = 144;
const SIZE = { w: 30, h: 16, cx: 0, cz: (-latTop + latSpan / 2) / 9 }; // phủ kinh −180…180, vĩ 85,5…−58,5
export const DEEP = '#2c79a8';
const BANDS = [[85, '#eef3ef'], [66, '#dfe9dd'], [58, '#6f9a62'], [46, '#6aa158'], [34, '#8fbb5f'], [22, '#b2c56a'], [10, '#58a24f'], [0, '#4b994a'], [-10, '#58a24f'], [-22, '#b2c56a'], [-36, '#8fbb5f'], [-58, '#7ea562']];
const color = (hex, target = new THREE.Color()) => target.set(hex);
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(xi, yi), hash(xi + 1, yi), u), THREE.MathUtils.lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}

// Mặt nạ đất liền (1 = đất) vẽ bằng canvas rồi làm mờ hộp 3 lượt → trường mượt 0…1, 0,5 ≈ bờ biển.
function landField() {
  const canvas = Object.assign(document.createElement('canvas'), { width: MASK_W, height: MASK_H });
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  for (const coast of COASTS) {
    g.beginPath();
    coast.forEach(([lon, lat], i) => g[i ? 'lineTo' : 'moveTo']((lon + 180) / 360 * MASK_W, (latTop - lat) / latSpan * MASK_H));
    g.closePath(); g.fill();
  }
  const pixels = g.getImageData(0, 0, MASK_W, MASK_H).data;
  let field = new Float32Array(MASK_W * MASK_H), next = new Float32Array(MASK_W * MASK_H);
  for (let i = 0; i < field.length; i++) field[i] = pixels[i * 4] / 255;
  const r = 4;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < MASK_H; y++) for (let x = 0; x < MASK_W; x++) { let sum = 0; for (let k = -r; k <= r; k++) sum += field[y * MASK_W + THREE.MathUtils.clamp(x + k, 0, MASK_W - 1)]; next[y * MASK_W + x] = sum / (2 * r + 1); }
    [field, next] = [next, field];
    for (let y = 0; y < MASK_H; y++) for (let x = 0; x < MASK_W; x++) { let sum = 0; for (let k = -r; k <= r; k++) sum += field[THREE.MathUtils.clamp(y + k, 0, MASK_H - 1) * MASK_W + x]; next[y * MASK_W + x] = sum / (2 * r + 1); }
    [field, next] = [next, field];
  }
  return (lon, lat) => {
    const fx = THREE.MathUtils.clamp((lon + 180) / 360 * (MASK_W - 1), 0, MASK_W - 1), fy = THREE.MathUtils.clamp((latTop - lat) / latSpan * (MASK_H - 1), 0, MASK_H - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, MASK_W - 1), y1 = Math.min(y0 + 1, MASK_H - 1), tx = fx - x0, ty = fy - y0;
    const a = field[y0 * MASK_W + x0], b = field[y0 * MASK_W + x1], c = field[y1 * MASK_W + x0], d = field[y1 * MASK_W + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

export function buildTerrain() {
  const land = landField();
  const heightAt = (lon, lat) => {
    const s = land(lon, lat), onLand = smooth(.42, .62, s);
    let h = -.4 + .45 * smooth(.1, .6, s) + onLand * (.08 + .12 * smooth(.6, 1, s));
    for (const [w, e, south, north, k] of MOUNTAINS) {
      // Dãy núi: bướu dẹt phủ cả vùng (mũ 4 cho đỉnh rộng, sườn thoải), gợn theo nhiễu để không thành một cục tròn.
      const dx = (lon - (w + e) / 2) / ((e - w) / 2 + 3), dy = (lat - (south + north) / 2) / ((north - south) / 2 + 3);
      const ridge = Math.exp(-((dx * dx + dy * dy) ** 2) * 1.6);
      h += onLand * k * .42 * ridge * (.45 + .9 * valueNoise(lon * .6, lat * .6));
    }
    return h + onLand * ((valueNoise(lon * .12, lat * .12) - .5) * .1 + (valueNoise(lon * .45, lat * .45) - .5) * .04);
  };
  const desertAt = (lon, lat) => DESERTS.reduce((most, [w, e, s, n]) => {
    const dx = (lon - (w + e) / 2) / ((e - w) / 2), dy = (lat - (s + n) / 2) / ((n - s) / 2);
    return Math.max(most, 1 - smooth(.6, 1.1, Math.hypot(dx, dy)));
  }, 0);
  const bandAt = (lat, target) => {
    for (let i = 1; i < BANDS.length; i++) if (lat >= BANDS[i][0]) return color(BANDS[i - 1][1], target).lerp(color(BANDS[i][1]), (BANDS[i - 1][0] - lat) / (BANDS[i - 1][0] - BANDS[i][0]));
    return color(BANDS.at(-1)[1], target);
  };

  const geometry = new THREE.PlaneGeometry(SIZE.w, SIZE.h, 330, 176); geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position, colors = new Float32Array(position.count * 3);
  const c = new THREE.Color(), sand = color('#e8d6a0'), rock = color('#8f7c63'), snow = color('#f4f7f6'), shallow = color('#8fe0dc'), deep = color(DEEP), desert = color('#e6cc8d');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i) + SIZE.cz, lon = x * 12, lat = -z * 9, h = heightAt(lon, lat);
    position.setZ(i, z); position.setY(i, h);
    if (h < .02) c.copy(deep).lerp(shallow, smooth(-.35, .02, h)); // đáy biển: sâu → nông màu ngọc
    else {
      bandAt(lat, c).lerp(desert, desertAt(lon, lat) * .9);
      c.lerp(sand, 1 - smooth(.03, .08, h)); // bãi cát sát mép nước
      c.lerp(rock, smooth(.3, .5, h) * .8); c.lerp(snow, Math.min(1, smooth(.52, .66, h) + smooth(64, 72, Math.abs(lat)) * .8));
    }
    c.offsetHSL(0, 0, (hash(x * 3.1, z * 2.7) - .5) * .025);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 }));
  mesh.receiveShadow = mesh.castShadow = true;
  return { mesh, heightAt, size: SIZE, project };
}
