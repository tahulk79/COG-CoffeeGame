// Skinned vertices use boneMatrices, which must match the pose before measuring.
export function getCharacterBounds(character, target) {
  character.updateMatrixWorld(true);
  character.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
  return target.setFromObject(character, true);
}
