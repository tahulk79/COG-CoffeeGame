import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { markCached, disposeScene } from './dispose-scene.js';
import { getQuality } from '../vfx/index.js';

// Every GLB is meshopt-compressed (scripts/optimize-models.mjs); load them all through this loader.
export const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loader = gltfLoader;

// Low tier: Blender's KHR_materials_specular is the only reason these GLBs parse as MeshPhysicalMaterial; Standard drops just that
// specular tweak. Swapped during the parse, before any cache or material tuning (wind, alpha cards) sees the file. The tier at
// load time decides, so a later tier change keeps the old look until the next page load.
function standardOnLow(gltf) {
  if (getQuality() !== 'low') return;
  const swapped = new Map();
  const toStandard = m => {
    if (!m.isMeshPhysicalMaterial) return m;
    if (!swapped.has(m)) swapped.set(m, new MeshStandardMaterial().copy(m));
    return swapped.get(m);
  };
  for (const scene of gltf.scenes) scene.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(toStandard) : toStandard(o.material); });
}
gltfLoader.register(() => ({ name: 'low-tier-standard-material', afterRoot: standardOnLow }));
const cache = new Map();

// Meshy bakes ship a metallic map with metallic=1 on cloth/skin. With no env map that reads as dark,
// speckled metal (03 §5: matte materials). Drop it once per parsed file; real metals here use plain factors ≤ .15.
export function matteBakedMetal(root) {
  root?.traverse(o => {
    for (const m of o.isMesh ? [o.material].flat() : []) if (m.metalnessMap && m.metalness === 1) { m.metalnessMap = null; m.metalness = 0; m.needsUpdate = true; }
  });
  return root;
}

// Cache theo URL: vào lại cảnh dùng lại GLB đã parse; lỗi tải trả null để cảnh giữ khối tạm.
// path 'file.glb#node' lấy riêng một node (vd. khung và hai cánh cổng chung một file).
export function loadModel(path) {
  if (typeof path !== 'string' || !path) return Promise.resolve(null); // no model: caller keeps its placeholder
  const [file, node] = path.split('#');
  const url = `${import.meta.env.BASE_URL}models/${file}`;
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then(gltf => markCached(matteBakedMetal(gltf.scene)), error => { console.warn(`Không tải được ${url}, giữ khối tạm.`, error); return null; }));
  return cache.get(url).then(scene => {
    const part = node ? scene?.getObjectByName(node) : scene;
    if (scene && !part) console.warn(`${url} thiếu node ${node}, giữ khối tạm.`);
    return part?.clone() ?? null;
  });
}

// Đổi hình nhưng giữ vùng cản của khối tạm: khối đặc thành va chạm vô hình (material.visible=false không tốn draw call),
// khối trang trí và nhóm con thường bị ẩn, biển chữ canvas (có map) và slot con được giữ. Hình mới không chặn đường.
const COLLIDER = new MeshBasicMaterial({ visible: false });
export function dressSlot(slot, model, cast = false) {
  if (!slot || !model) return false;
  for (const child of slot.children) {
    if (child.userData.assetSlot || child.material?.map) continue;
    if (child.isMesh && !child.userData.nonSolid && !slot.userData.nonSolid) { child.material = COLLIDER; child.castShadow = child.receiveShadow = false; }
    else child.visible = false;
  }
  model.userData.nonSolid = true;
  model.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = true; } });
  slot.add(model); return true;
}

// slots: { 'slot/id':'feature/file.glb' | 'file.glb#node' }; target có replaceAsset như các cảnh hiện có.
export function attachModels(target, slots) {
  return Promise.all(Object.entries(slots).map(([slot, path]) => loadModel(path).then(model => model && target.replaceAsset(slot, model))));
}

// Xả GLB đã cache theo tiền tố ('selection/'): chỉ gọi cho asset không cảnh nào khác dùng. Gọi sau khi cảnh dùng nó đã dispose.
export function releaseModels(prefix) {
  const base = `${import.meta.env.BASE_URL}models/${prefix}`;
  for (const [url, promise] of cache) {
    if (!url.startsWith(base)) continue;
    cache.delete(url);
    promise.then(root => {
      if (!root) return;
      const textures = new Set();
      root.traverse(o => { for (const m of o.material ? [o.material].flat() : []) for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); });
      disposeScene(root); textures.forEach(tex => tex.image?.close?.()); // texture markCached: disposeScene không close ImageBitmap
    });
  }
}
