export function disposeScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  });
  textures.forEach(texture => texture.dispose());
  skeletons.forEach(skeleton => skeleton.dispose());
}
