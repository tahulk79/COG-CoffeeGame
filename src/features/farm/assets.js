import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Model tier-1 đã chuẩn hóa (pivot tâm đáy, +Z mặt chính); tier 2–5 giữ khối tạm.
// shortcut: quầy chợ đang ẩn (content.js initialVisible:false) nên chưa tải market-tier-1.glb; thêm lại khi quầy hiện.
const FILES = { tree: 'coffee-tree', roaster: 'roaster-tier-1', dryer: 'dryer-tier-1', well: 'well-tier-1', grinder: 'grinder-tier-1' };
const STATIONS = { roaster: 'farm/roaster/tier-1', dryer: 'farm/dryer/tier-1', well: 'farm/well/tier-1', grinder: 'farm/grinder/tier-1' };
let cache = null;

// Cache theo module: vào lại farm dùng lại GLB đã parse; disposeScene chỉ giải phóng GPU, three tự tải lại khi vẽ.
export function loadFarmModels() {
  const loader = new GLTFLoader();
  cache ??= Promise.all(Object.entries(FILES).map(([key, file]) => {
    const url = `${import.meta.env.BASE_URL}models/farm/${file}.glb`;
    return loader.loadAsync(url).then(gltf => [key, gltf.scene], error => { console.warn(`Không tải được ${url}, giữ khối tạm.`, error); return [key, null]; });
  })).then(Object.fromEntries);
  return cache;
}

export function attachFarmModels(world, models) {
  if (models.tree && !models.tree.getObjectByName('fruit_green')) {
    // GLB chỉ có quả chín; bản sao tô xanh để game bật lúc cây đang lớn.
    const ripe = models.tree.getObjectByName('fruit_ripe');
    if (ripe) { const green = ripe.clone(); green.name = 'fruit_green'; green.material = ripe.material.clone(); green.material.color.set('#9cbf5f'); ripe.parent.add(green); }
  }
  if (models.tree) {
    // Cây thật chỉ là hình; vùng cản giữ đúng thân 0,1 của khối tạm để đường đi qua luống không đổi.
    const trunkGeometry = new THREE.BoxGeometry(.1, 1.2, .1), trunkMaterial = new THREE.MeshBasicMaterial({ visible: false });
    for (const id of world.getAssetSlots().filter(slot => /^farm\/.+\/crop$/.test(slot))) {
      const tree = models.tree.clone(); tree.userData.nonSolid = true;
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial); trunk.position.y = .65;
      const art = new THREE.Group(); art.add(tree, trunk);
      world.replaceAsset(id, art);
    }
  }
  for (const [key, slot] of Object.entries(STATIONS)) {
    if (!models[key]) continue;
    const model = models[key].clone();
    const beans = model.getObjectByName('beans'); if (beans) beans.userData.nonSolid = true; // bật/tắt theo mẻ phơi, không đổi vùng cản
    world.replaceAsset(slot, model);
  }
}
