// Đánh dấu tài nguyên GPU của model đã cache mà các bản clone dùng chung (vd. khách quán đến rồi đi):
// disposeScene bỏ qua, nên clone sau không phải tải lại texture/geometry và biên dịch lại shader (gây khựng).
export function keepOnGPU(root) {
  root?.traverse(object => {
    if (object.geometry) object.geometry.userData.keep = true;
    for (const material of object.material ? [object.material].flat() : []) {
      material.userData.keep = true;
      for (const value of Object.values(material)) if (value?.isTexture) value.userData.keep = true;
    }
  });
  return root;
}

// Đánh dấu texture của model nằm trong cache (clone sau dùng lại): disposeScene vẫn giải phóng GPU nhưng không close ImageBitmap.
export function markCached(root) {
  root?.traverse(object => {
    for (const material of object.material ? [object.material].flat() : []) for (const value of Object.values(material)) if (value?.isTexture) value.userData.cached = true;
  });
  return root;
}

export function disposeScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  scene.traverse(object => {
    if (object.isLight && object.shadow?.map) object.shadow.dispose(); // shadow map là render target, không tự giải phóng
    if (object.skeleton) skeletons.add(object.skeleton); // mỗi bản clone có skeleton riêng
    if (object.geometry?.userData.keep) return;
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => {
    if (material.userData.keep) return;
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  });
  textures.forEach(texture => {
    if (texture.userData.keep) return;
    texture.dispose();
    // GLTFLoader nạp ảnh bằng ImageBitmap, GC không tự thu; chỉ close bản không cache vì clone sau còn phải upload lại.
    if (!texture.userData.cached) texture.image?.close?.();
  });
  skeletons.forEach(skeleton => skeleton.dispose());
}
