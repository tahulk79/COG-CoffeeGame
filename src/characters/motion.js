import * as THREE from 'three';

// shortcut: procedural fall poses; replace with an authored fall clip when available.
const reactions = {
  Head: [[0,0,0],[-.45,0,.12],[.25,0,-.1],[.08,0,0],[0,0,0]],
  Spine: [[0,0,0],[-.15,0,0],[.3,0,0],[.08,0,0],[0,0,0]],
  LeftArm: [[0,0,0],[-.45,0,-.3],[-.7,0,-.5],[-.2,0,-.1],[0,0,0]],
  RightArm: [[0,0,0],[-.4,0,.3],[-.6,0,.45],[-.15,0,.1],[0,0,0]],
  LeftForeArm: [[0,0,0],[0,0,-.4],[0,0,-.8],[0,0,-.2],[0,0,-.12]],
  RightForeArm: [[0,0,0],[0,0,.5],[0,0,.7],[0,0,.2],[0,0,.12]],
  LeftUpLeg: [[0,0,0],[-.25,0,0],[-.5,0,0],[-.12,0,0],[0,0,0]],
  RightUpLeg: [[0,0,0],[.2,0,0],[-.35,0,0],[-.1,0,0],[0,0,0]],
  LeftLeg: [[0,0,0],[.3,0,0],[.8,0,0],[.18,0,0],[.06,0,0]],
  RightLeg: [[0,0,0],[.3,0,0],[.7,0,0],[.2,0,0],[.06,0,0]],
};

export function createPlayerMotion(character, referencePose) {
  const bones = [];
  character.traverse(object => { if (object.isBone) bones.push(object); });
  const restPose = referencePose ?? bones.map(bone => ({ name: bone.name, quaternion: bone.quaternion.toArray(), position: bone.position.toArray() }));
  const restTracks = restPose.flatMap(bone => [
    new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, [0, 1], [...bone.quaternion, ...bone.quaternion]),
    new THREE.VectorKeyframeTrack(`${bone.name}.position`, [0, 1], [...bone.position, ...bone.position]),
  ]);
  const mixer = new THREE.AnimationMixer(character);
  const rest = mixer.clipAction(new THREE.AnimationClip('Rest', 1, restTracks)).play();
  rest.setEffectiveWeight(0);
  const walkingClip = character.animations.find(clip => /walk/i.test(clip.name))?.clone();
  if (walkingClip) {
    for (const track of walkingClip.tracks) {
      if (!/hips.*\.position$/i.test(track.name)) continue;
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = track.values[0]; track.values[i + 2] = track.values[2];
      }
    }
  }
  const walking = walkingClip ? mixer.clipAction(walkingClip).play() : null;
  if (walking) walking.time = 3.4 * 1.5 % walkingClip.duration;
  mixer.update(0);
  const fallTracks = restPose.map(pose => {
    const bone = bones.find(bone => bone.name === pose.name);
    const base = new THREE.Quaternion().fromArray(pose.quaternion);
    const name = pose.name.replace(/^mixamorig:?/i, '');
    const offsets = reactions[name];
    const values = [];
    for (let i = 0; i < 5; i++) {
      const rotation = i === 0 ? bone.quaternion.clone() : base.clone();
      if (i > 0 && offsets) rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...offsets[i])));
      values.push(...rotation.toArray());
    }
    return new THREE.QuaternionKeyframeTrack(`${pose.name}.quaternion`, [0, .15, .35, .7, 1.05], values);
  });
  const fall = mixer.clipAction(new THREE.AnimationClip('StumbleAndFall', 1.05, fallTracks)).play();
  fall.setLoop(THREE.LoopOnce, 1);
  fall.clampWhenFinished = true;
  fall.setEffectiveWeight(0);
  function update(mode, time, walkingWeight = 1) {
    const weight = walking ? walkingWeight : 0;
    walking?.setEffectiveWeight(mode === 'walk' ? weight : 0);
    rest.setEffectiveWeight(mode === 'rest' ? 1 : mode === 'walk' ? 1 - weight : 0);
    fall.setEffectiveWeight(mode === 'fall' ? 1 : 0);
    if (walking) walking.time = time % walkingClip.duration;
    fall.time = THREE.MathUtils.clamp(time, 0, 1.05);
    mixer.update(0);
  }
  update('rest', 0);
  return { mixer, restPose, update, dispose() { mixer.stopAllAction(); mixer.uncacheRoot(character); } };
}
