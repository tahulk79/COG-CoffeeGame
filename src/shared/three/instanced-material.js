// A material shared by a plain mesh and an InstancedMesh makes three switch shader programs between the two draws and
// re-derive the program parameters (getParameters + cache key) every time: measured ~2% of the main thread on a phone
// profile. Instanced copies get their own twin instead (one per source material, textures shared).
const twins = new WeakMap();
export function instancedMaterial(material) {
  if (Array.isArray(material)) return material.map(instancedMaterial);
  if (!material) return material;
  let twin = twins.get(material);
  if (!twin) {
    twin = material.clone(); // copy() does not carry these own-property hooks
    if (Object.hasOwn(material, 'onBeforeCompile')) twin.onBeforeCompile = material.onBeforeCompile;
    if (Object.hasOwn(material, 'customProgramCacheKey')) twin.customProgramCacheKey = material.customProgramCacheKey;
    twins.set(material, twin);
    material.addEventListener('dispose', () => { twins.delete(material); twin.dispose(); }); // freed with its source
  }
  return twin;
}
