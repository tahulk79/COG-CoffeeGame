import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

// Cache theo URL: vào lại cảnh dùng lại GLB đã parse; lỗi tải trả null để cảnh giữ khối tạm.
// path 'file.glb#node' lấy riêng một node (vd. khung và hai cánh cổng chung một file).
export function loadModel(path) {
  const [file, node] = path.split('#');
  const url = `${import.meta.env.BASE_URL}models/${file}`;
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then(gltf => gltf.scene, error => { console.warn(`Không tải được ${url}, giữ khối tạm.`, error); return null; }));
  return cache.get(url).then(scene => {
    const part = node ? scene?.getObjectByName(node) : scene;
    if (scene && !part) console.warn(`${url} thiếu node ${node}, giữ khối tạm.`);
    return part?.clone() ?? null;
  });
}

// slots: { 'slot/id': 'feature/file.glb' | 'file.glb#node' }; target có replaceAsset như các cảnh hiện có.
export function attachModels(target, slots) {
  return Promise.all(Object.entries(slots).map(([slot, path]) => loadModel(path).then(model => model && target.replaceAsset(slot, model))));
}
