import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const playerModel = gender => gender === 'male' ? 'male.glb' : 'girl.glb';

export async function loadPlayer(filename, onProgress) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${filename}`, onProgress);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Model nhân vật không có kích thước hợp lệ.');
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2 / size.y;
  const placement = new THREE.Group();
  placement.scale.setScalar(scale);
  placement.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  placement.add(model);
  const character = new THREE.Group(); character.add(placement);
  character.animations = gltf.animations;
  model.traverse(object => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    // Animated skin bounds can become stale after a scene transfer or a pose change.
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  character.updateMatrixWorld(true);
  return character;
}
