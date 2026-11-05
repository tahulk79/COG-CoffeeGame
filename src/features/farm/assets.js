import * as THREE from 'three';
import { gltfLoader as loader, loadModel, dressSlot } from '../../shared/three/models.js';
import { FIELDS } from './content.js';
import { markCached } from '../../shared/three/dispose-scene.js';

// Model tier-1 đã chuẩn hóa (pivot tâm đáy, +Z mặt chính); tier 2–5 = tier-1 + cờ bậc (decor.glb#tier_<n>).
// shortcut: quầy chợ đang ẩn (content.js initialVisible:false) nên chưa tải market-tier-1.glb; thêm lại khi quầy hiện.
const FILES = { tree: 'coffee-tree', roaster: 'roaster-tier-1', dryer: 'dryer-tier-1', well: 'well-tier-1' };
const STATIONS = { roaster: 'farm/roaster/tier-1', dryer: 'farm/dryer/tier-1', well: 'farm/well/tier-1' };
// Asset thủ tục (Blender, màu đỉnh, 1 vật liệu): đường/rào/ao, đạo cụ nhỏ đổi geometry, cờ bậc + đồ trang trí.
const ART = { grounds: 'farm/grounds.glb', props: 'farm/props.glb', decor: 'farm/decor.glb' };
let cache = null;

// Cache theo module: vào lại farm dùng lại GLB đã parse; disposeScene chỉ giải phóng GPU, three tự tải lại khi vẽ.
export function loadFarmModels() {
  cache ??= Promise.all([
    ...Object.entries(FILES).map(([key, file]) => {
      const url = `${import.meta.env.BASE_URL}models/farm/${file}.glb`;
      return loader.loadAsync(url).then(gltf => [key, markCached(gltf.scene)], error => { console.warn(`Không tải được ${url}, giữ khối tạm.`, error); return [key, null]; });
    }),
    ...Object.entries(ART).map(([key, file]) => loadModel(file).then(model => [key, model])),
  ]).then(Object.fromEntries);
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
  const node = (root, name) => root?.getObjectByName(name)?.clone() ?? null;
  for (const [key, slot] of Object.entries(STATIONS)) {
    if (!models[key]) continue;
    const model = models[key].clone();
    const beans = model.getObjectByName('beans'); if (beans) beans.userData.nonSolid = true; // bật/tắt theo mẻ phơi, không đổi vùng cản
    world.replaceAsset(slot, model);
    for (let n = 2; n <= 5; n++) {
      const tier = models[key].clone(), flags = node(models.decor, `tier_${n}`);
      const tierBeans = tier.getObjectByName('beans'); if (tierBeans) tierBeans.userData.nonSolid = true;
      if (flags) { flags.userData.nonSolid = true; tier.add(flags); }
      world.replaceAsset(`farm/${key}/tier-${n}`, tier);
    }
  }
  // Rào, cổng, biển, đường, ao: chỉ đổi hình, vùng cản giữ khối tạm (dressSlot) nên đường đi không đổi.
  const slot = id => world.scene.getObjectByName(`asset:${id}`);
  const { grounds, props } = models;
  dressSlot(slot('farm/paths'), node(grounds, 'paths'));
  dressSlot(slot('farm/boundary'), node(grounds, 'boundary'), true);
  for (const { id } of FIELDS) {
    dressSlot(slot(`farm/${id}/fence`), node(grounds, 'field_fence'), true);
    dressSlot(slot(`farm/${id}/gates`), node(grounds, 'field_gates'), true);
    dressSlot(slot(`farm/${id}/sign`), node(grounds, 'field_sign'), true);
  }
  // Ao có 2 nhóm cùng tên slot: bờ/rào của môi trường (con trực tiếp của scene) và mặt nước + cá của actor.
  dressSlot(world.scene.children.find(o => o.name === 'asset:farm/pond'), node(grounds, 'pond'), true);
  const geometry = name => props?.getObjectByName(name)?.geometry;
  const pondActor = world.scene.getObjectByName('farm:pond')?.children[0];
  if (grounds && pondActor) for (const child of pondActor.children) if (child.isMesh) child.visible = false; // nước đã có trong pond
  // Đạo cụ nhỏ: chỉ thay geometry, giữ vật liệu/màu, vị trí và logic ẩn hiện của game.
  if (props) {
    for (const id of world.getAssetSlots().filter(id => id.endsWith('/upgrade-markers') || id.startsWith('farm/upgrades/')))
      for (const marker of slot(id)?.children || []) if (marker.isMesh) marker.geometry = geometry('marker');
    pondActor?.traverse(o => { if (o.isMesh && o.parent !== pondActor) o.geometry = geometry('fish'); });
    world.scene.traverse(o => {
      if ((o.name === 'weeds' || o.name === 'blossoms') && o.children[0]?.isMesh) { o.children[0].geometry.dispose(); o.children[0].geometry = geometry(o.name); }
    });
  }
}
