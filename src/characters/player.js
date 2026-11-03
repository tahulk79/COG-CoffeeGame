import * as THREE from 'three';

export function createPerson(color, { medical = false, gender = 'male' } = {}) {
  const group = new THREE.Group();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
  const materials = new Map();
  function part(shape, tint, x, y, z, w, h, d) {
    if (!materials.has(tint)) materials.set(tint, new THREE.MeshStandardMaterial({ color: tint, roughness: .9 }));
    const mesh = new THREE.Mesh(shape === 'ball' ? sphereGeometry : boxGeometry, materials.get(tint));
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  const box = (...args) => part('box', ...args);
  const ball = (...args) => part('ball', ...args);
  const female = gender === 'female' && !medical;
  box(color, 0, 1.04, 0, female ? .5 : .57, .75, .36);
  if (female) ball('#3c302b', 0, 1.55, -.13, .3, .47, .22);
  ball('#e7ba8b', 0, 1.7, 0, .26, .3, .25);
  ball(medical ? '#f3eee0' : '#3c302b', 0, 1.87, -.03, .27, .15, .26);
  if (female) ball('#3c302b', .24, 1.61, -.15, .15, .32, .17);
  for (const x of [-.09, .09]) ball('#34352b', x, 1.72, .23, .025, .03, .018);
  const legs = [-.16, .16].map(x => {
    if (!medical) return box('#3e514a', x, .43, 0, .21, .75, .25);
    const leg = new THREE.Group(); leg.position.set(x, .75, 0); group.add(leg);
    const upper = box('#e3e6d8', 0, -.175, 0, .21, .35, .25);
    const lower = box('#e3e6d8', 0, -.5, 0, .19, .3, .23);
    const foot = box('#43564a', 0, -.68, .04, .23, .14, .35);
    leg.add(upper, lower, foot); leg.userData = { upper, lower, foot };
    return leg;
  });
  const arms = [-.4, .4].map(x => {
    if (!medical) return box(color, x, 1.03, 0, .18, .7, .22);
    const arm = new THREE.Group(); arm.position.set(x, 1.38, 0); group.add(arm);
    const upper = box(color, 0, -.2, 0, .18, .4, .2);
    const forearm = box(color, 0, -.6, 0, .16, .4, .18);
    const hand = box('#e7ba8b', 0, -.8, 0, .16, .14, .16);
    arm.add(upper, forearm, hand);
    arm.userData = { upper, forearm, hand };
    return arm;
  });
  if (!medical) for (const x of [-.4, .4]) box('#e7ba8b', x, .65, 0, .17, .17, .19);
  if (medical) box('#c96755', 0, 1.1, .19, .18, .18, .02);
  let torso;
  if (medical) {
    torso = new THREE.Group(); torso.position.y = .75;
    for (const child of [...group.children]) {
      if (legs.includes(child)) continue;
      child.position.y -= .75; torso.add(child);
    }
    group.add(torso);
  }
  group.userData = { legs, arms, torso };
  return group;
}

