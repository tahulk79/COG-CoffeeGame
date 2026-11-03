import * as THREE from 'three';

const up = new THREE.Vector3(0, 1, 0);

function segmentBetween(part, start, end) {
  part.position.copy(start).add(end).multiplyScalar(.5);
  const segment = end.clone().sub(start);
  part.scale.y = segment.length();
  part.quaternion.setFromUnitVectors(up, segment.normalize());
}

export function crouchMedic(medic, amount) {
  medic.userData.torso.position.y = .75 - .4 * amount;
  medic.userData.torso.rotation.x = .9 * amount;
  for (const leg of medic.userData.legs) {
    leg.position.y = .75 - .4 * amount;
    const knee = new THREE.Vector3(0, .4 - .16 * amount - leg.position.y, -.25 * amount);
    const ankle = new THREE.Vector3(0, .1 - leg.position.y, 0);
    segmentBetween(leg.userData.upper, new THREE.Vector3(), knee);
    segmentBetween(leg.userData.lower, knee, ankle);
    leg.userData.foot.position.copy(ankle).add(new THREE.Vector3(0, -.03, .04));
  }
}

export function gripStretcher(medic, stretcher, side, bodyBounds, supportWeight = 0) {
  medic.updateMatrixWorld(true);
  stretcher.updateMatrixWorld(true);
  for (const arm of medic.userData.arms) {
    arm.rotation.set(0, 0, 0);
    arm.updateMatrixWorld(true);
    const shoulder = arm.getWorldPosition(new THREE.Vector3());
    // Match each shoulder to the handle on its side of the bed.
    const depth = shoulder.z < stretcher.position.z ? -.31 : .31;
    const grip = stretcher.localToWorld(new THREE.Vector3(side * 1.2, .9, depth));
    if (supportWeight > 0) {
      const center = bodyBounds.getCenter(new THREE.Vector3());
      const supportDepth = shoulder.z < center.z ? -.2 : .2;
      const support = new THREE.Vector3(center.x + side * .65, bodyBounds.min.y + .15, center.z + supportDepth);
      grip.lerp(support, supportWeight);
    }
    const wrist = arm.worldToLocal(grip.clone());
    const distance = wrist.length();
    const direction = wrist.clone().normalize();
    const bend = new THREE.Vector3(0, 0, -1).addScaledVector(direction, direction.z);
    if (bend.lengthSq() < .001) bend.set(1, 0, 0);
    bend.normalize();
    const elbow = wrist.clone().multiplyScalar(.5).addScaledVector(bend, Math.sqrt(Math.max(0, .4 ** 2 - (distance / 2) ** 2)));
    const { upper, forearm, hand } = arm.userData;
    for (const [part, start, end] of [[upper, new THREE.Vector3(), elbow], [forearm, elbow, wrist]]) {
      segmentBetween(part, start, end);
    }
    hand.position.copy(wrist);
    arm.userData.gripDistance = distance;
    arm.userData.gripTargetWorld = grip;
  }
}
