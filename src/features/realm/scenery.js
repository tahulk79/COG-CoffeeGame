// Farm scenery around the playable land (reference shots): sheds, a greenhouse, thatched huts and coffee drying beds
// (giàn phơi). Procedural Three.js placeholders; each piece is a small named group, so a GLB can replace it later
// (public/models/farm/<name>.glb: shed, greenhouse, hut-thatched, drying-bed — docs/design/farm-ui-bigupdate.md §3.D).
// Theme by country: Africa → thatched huts + red-earth yards; everywhere else → wooden shed + greenhouse.
import * as THREE from 'three';
import { farmGroundY } from '../../core/config/layout.js';
import { BOUNDS } from '../../core/config/layout.js';
import { gardenStyleOf } from '../../core/config/economy.js';
import { createPlant, createPlantInstances } from '../../shared/three/gedeo-vegetation.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true, ...extra });

export function createScenery({ parent }) {
  const group = new THREE.Group();
  group.name = 'realm-scenery';
  parent.add(group);
  const geos = [], mats = [];
  const track = (o, g, m) => { geos.push(g); mats.push(m); return o; };
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return track(o, g, m); };

  // Wooden shed: plank box + gable roof + door.
  function shed() {
    const g = new THREE.Group(); g.name = 'shed';
    const wall = mat(0xb98a55), roof = mat(0x7a4a32), door = mat(0x5a3a22);
    g.add(mesh(new THREE.BoxGeometry(5, 2.6, 4), wall, 0, 1.3, 0));
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4).rotateY(Math.PI / 4), roof);
    const rg = new THREE.CylinderGeometry(.01, 3.9, 1.7, 4, 1).rotateY(Math.PI / 4).scale(1.15, 1, .95);
    g.add(mesh(rg, roof, 0, 3.45, 0)); r.geometry.dispose();
    g.add(mesh(new THREE.BoxGeometry(1.2, 1.9, .12), door, 0, .95, 2.04));
    return g;
  }
  // Greenhouse: timber frame + translucent glass box with a ridge.
  function greenhouse() {
    const g = new THREE.Group(); g.name = 'greenhouse';
    const glass = mat(0xd8f0f4, { transparent: true, opacity: .45, roughness: .1, flatShading: false }), frame = mat(0xa8774a);
    g.add(mesh(new THREE.BoxGeometry(6.5, 2.4, 4.4), glass, 0, 1.2, 0));
    const ridge = new THREE.CylinderGeometry(.01, 3.1, 1.3, 4, 1).rotateY(Math.PI / 4).scale(1.1, 1, .78);
    g.add(mesh(ridge, glass, 0, 3.0, 0));
    for (const x of [-3.25, -1.08, 1.08, 3.25]) for (const z of [-2.2, 2.2]) g.add(mesh(new THREE.BoxGeometry(.16, 2.4, .16), frame, x, 1.2, z));
    g.add(mesh(new THREE.BoxGeometry(6.6, .14, .14), frame, 0, 2.45, 2.2), mesh(new THREE.BoxGeometry(6.6, .14, .14), frame, 0, 2.45, -2.2));
    return g;
  }
  // Round thatched hut: mud walls + straw cone.
  function hut() {
    const g = new THREE.Group(); g.name = 'hut-thatched';
    g.add(mesh(new THREE.CylinderGeometry(1.7, 1.8, 1.9, 10), mat(0xc58a5a), 0, .95, 0));
    g.add(mesh(new THREE.ConeGeometry(2.5, 2.2, 10), mat(0xd9b86a), 0, 3, 0));
    g.add(mesh(new THREE.BoxGeometry(.8, 1.3, .12), mat(0x4a2e1c), 0, .65, 1.74));
    return g;
  }
  // Drying bed: raised mesh table with spread cherries / beans, two stripes of colour.
  function dryingBed(cherry = true) {
    const g = new THREE.Group(); g.name = 'drying-bed';
    const wood = mat(0x8a5e3a);
    for (const x of [-1.7, 1.7]) for (const z of [-.6, .6]) g.add(mesh(new THREE.BoxGeometry(.14, .9, .14), wood, x, .45, z));
    g.add(mesh(new THREE.BoxGeometry(4, .1, 1.7), wood, 0, .93, 0));
    g.add(mesh(new THREE.BoxGeometry(3.7, .08, .75), mat(cherry ? 0xb8322f : 0xd9b86a), 0, 1.0, -.38));
    g.add(mesh(new THREE.BoxGeometry(3.7, .08, .75), mat(0xd9b86a), 0, 1.0, .4));
    return g;
  }
  const put = (obj, x, z, rot = 0) => { obj.position.set(x, farmGroundY(x, z), z); obj.rotation.y = rot; group.add(obj); return obj; };

  // Built once; the theme only toggles which set shows.
  const east = BOUNDS.maxX + 8, west = BOUNDS.minX - 8;
  const wood = new THREE.Group(), africa = new THREE.Group();
  group.add(wood, africa);
  const into = (set, obj, x, z, rot) => { obj.position.set(x, farmGroundY(x, z), z); obj.rotation.y = rot || 0; set.add(obj); };
  into(wood, shed(), east + 2, 10, -Math.PI / 2); into(wood, greenhouse(), east + 2, -18, -Math.PI / 2);
  into(wood, shed(), west - 2, -30, Math.PI / 2); into(wood, greenhouse(), west - 2, 4, Math.PI / 2);
  into(africa, hut(), east + 2, 8); into(africa, hut(), east + 3, -4); into(africa, hut(), east + 1, -26);
  into(africa, hut(), west - 2, -12); into(africa, hut(), west - 3, 6);
  for (const z of [-6, -12, -18]) { into(wood, dryingBed(), east + 1, z - 28, Math.PI / 2); into(africa, dryingBed(), east + 1, z - 22, Math.PI / 2); }
  for (const z of [-4, -10]) { into(wood, dryingBed(false), west - 1, z - 46, Math.PI / 2); into(africa, dryingBed(), west - 1, z - 30, Math.PI / 2); }
  africa.visible = false;

  // ---------- coffee agroforestry belt (Ethiopia: Sidama / Yirgacheffe / Jimma) ----------
  // Layers round the land, as in a real garden-forest: tall flat-topped shade trees (Albizia / Cordia, 10–14 m), mid fruit
  // trees (avocado / mango, 5–7 m), enset & banana clumps (2–4 m) and ground herbs. Instanced: a few draw calls in all.
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const spots = [];
  const band = (x0, x1, z0, z1, n) => { for (let i = 0; i < n; i++) spots.push([x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), rnd()]); };
  band(BOUNDS.maxX + 4, BOUNDS.maxX + 22, BOUNDS.minZ, BOUNDS.maxZ + 10, 34);
  band(BOUNDS.minX - 22, BOUNDS.minX - 4, BOUNDS.minZ, BOUNDS.maxZ + 10, 34);
  band(BOUNDS.minX - 10, BOUNDS.maxX + 10, BOUNDS.minZ - 20, BOUNDS.minZ - 3, 30);
  band(BOUNDS.minX - 10, BOUNDS.maxX + 10, BOUNDS.maxZ + 4, BOUNDS.maxZ + 18, 16);
  // keep the buildings' yards clear
  const free = ([x, z]) => !group.children.some(set => set.children.some(o => Math.hypot(o.position.x - x, o.position.z - z) < 5));
  const pts = spots.filter(free);
  const belt = new THREE.Group(); group.add(belt); // procedural belt (every country but the garden-forest ones)
  const inst = (geo, material, list, fn) => {
    const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
    const o = new THREE.Object3D();
    list.forEach((s, i) => { fn(o, s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.count = list.length; m.castShadow = true; m.receiveShadow = true; m.raycast = () => {};
    belt.add(m); geos.push(geo); mats.push(material);
    return m;
  };
  // The camera looks from the south-west: tall / mid trees only on the far sides (east, north) so they never hide the
  // farm; the near sides (west, south) get the low enset clumps only.
  const far = ([x, z]) => x > BOUNDS.maxX || z < BOUNDS.minZ;
  // kept clear for the mountain dressing (mountain-dressing.js): the west village, the south entrance road / market and
  // the stream with its banks
  const clear = ([x, z]) => (x < -36 && z > 0 && z < 50) || (Math.abs(x) < 14 && z > 24) || (z > 36 && z < 46) || (x > 30 && x < 42 && z < 0 && z > -20);
  const tall = pts.filter(s => far(s) && s[2] < .3 && !clear(s)), mid = pts.filter(s => far(s) && s[2] >= .3 && s[2] < .55 && !clear(s)), low = pts.filter(s => (!far(s) || s[2] >= .55) && !clear(s));
  // Tall shade tree: slim trunk, wide flat umbrella crown (two flattened layers).
  const trunkG = new THREE.CylinderGeometry(.22, .38, 1, 6).translate(0, .5, 0);
  inst(trunkG, mat(0x6b4a33), tall, (o, [x, z, r]) => { o.position.set(x, 0, z); o.rotation.set(0, r * 9, 0); o.scale.set(1, 9 + r * 14, 1); });
  const umbrellaG = new THREE.IcosahedronGeometry(1, 1).scale(1, .26, 1);
  inst(umbrellaG, mat(0x4e7f34), tall, (o, [x, z, r]) => { const h = 9 + r * 14; o.position.set(x, h, z); o.rotation.set(0, r * 7, 0); o.scale.setScalar(5 + r * 6); });
  inst(umbrellaG.clone(), mat(0x5f9440), tall, (o, [x, z, r]) => { const h = 9 + r * 14; o.position.set(x + 1.2, h - 1.6, z - .8); o.rotation.set(0, r * 5, 0); o.scale.setScalar(3.6 + r * 4); });
  // Mid fruit tree (avocado / mango): short trunk, round dense crown.
  inst(trunkG.clone(), mat(0x5e4130), mid, (o, [x, z, r]) => { o.position.set(x, 0, z); o.scale.set(.8, 3 + r * 2, .8); });
  inst(new THREE.IcosahedronGeometry(1, 1), mat(0x2f6b2c), mid, (o, [x, z, r]) => { o.position.set(x, 4 + r * 2.4, z); o.rotation.set(r, r * 4, 0); o.scale.set(2.6 + r, 2.2 + r, 2.6 + r); });
  // Enset / banana clump: a fan of long paddle leaves on a short pseudo-stem.
  const leafG = new THREE.PlaneGeometry(.7, 3.2, 1, 3).translate(0, 1.6, 0);
  { const ps = leafG.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setZ(i, -.08 * y * y); } leafG.computeVertexNormals(); }
  const leafM = mat(0x5b9a38, { side: THREE.DoubleSide, flatShading: false });
  const leaves = [];
  for (const s of low) for (let k = 0; k < 7; k++) leaves.push([...s, k]);
  inst(leafG, leafM, leaves, (o, [x, z, r, k]) => { const a = k / 7 * Math.PI * 2 + r * 3; o.position.set(x, .5 + r * .3, z); o.rotation.set(-.35 - (k % 2) * .25, a, 0, 'YXZ'); o.scale.setScalar(.55 + r * .35); }); // human-height clumps, leaves up
  inst(new THREE.CylinderGeometry(.28, .36, 1, 7).translate(0, .5, 0), mat(0x7b8a3a), low, (o, [x, z, r]) => { o.position.set(x, 0, z); o.scale.set(.6, .6 + r * .4, .6); });
  // ---------- Gedeo garden-forest (Ethiopia): the real models (scripts/blender/gedeo_*.py), loaded on demand ----------
  // Homesteads, processing and a layered shade canopy: Albizia (tall, flat-topped) on the far sides, Cordia (mid, round,
  // flowering) and enset clumps near the land. Instanced LOD1: one draw call per material per species.
  const gedeo = new THREE.Group(); gedeo.name = 'gedeo-scenery'; gedeo.visible = false; group.add(gedeo);
  const homestead = new THREE.Group(); gedeo.add(homestead);        // garden-forest countries: tukuls, wet mill, compost
  const outbuildings = new THREE.Group(); gedeo.add(outbuildings);  // elsewhere: corrugated stores in the sheds' places
  let gedeoLoading = null;
  function loadGedeo() {
    if (gedeoLoading) return gedeoLoading;
    const put = async (into, key, x, z, rot = 0, state) => { const o = await createPlant(key, { state }); o.position.set(x, farmGroundY(x, z), z); o.rotation.y = rot; into.add(o); };
    const row = (list, rotY) => list.map(([x, z, r]) => ({ position: new THREE.Vector3(x, farmGroundY(x, z), z), rotationY: r * 9 + rotY, scale: .8 + r * .45 }));
    gedeoLoading = Promise.all([
      // shared: water, shelter, sacks, drying beds and the layered shade canopy
      put(homestead, 'shelter', west - 3, 6, Math.PI / 2), put(homestead, 'waterTank', east + 1.5, 1, 0), put(homestead, 'sacks', east + 1, -2, .4),
      ...[-28, -34, -40].map(z => put(homestead, 'dryingBed', east + 1, z, Math.PI / 2, 'fresh')), ...[-34, -40].map(z => put(homestead, 'dryingBed', west - 1, z, Math.PI / 2, 'drying')),
      // outside the land: far LODs, no shadow casting (mobile)
      createPlantInstances('albizia', row(tall, 0), { lod: 2, shadows: false }).then(g => gedeo.add(g)),
      createPlantInstances('cordia', row(mid, 1), { lod: 2, shadows: false }).then(g => gedeo.add(g)),
      createPlantInstances('enset', row(low, 2), { lod: 1, shadows: false }).then(g => gedeo.add(g)),
      // garden-forest homestead
      put(homestead, 'tukul', east + 5, 8, -Math.PI / 2), put(homestead, 'tukul', east + 6, -7, -1.2), put(homestead, 'tukul', west - 5, -12, 1.3),
      put(homestead, 'wetMill', east + 6, -24, -Math.PI / 2), put(homestead, 'compost', west - 5, -30, Math.PI / 2),
      // other countries: stores, a roastery and a packing shed where the sheds / greenhouses stood
      put(outbuildings, 'warehouse', east + 5, 10, -Math.PI / 2), put(outbuildings, 'roasteryShed', east + 5, -18, -Math.PI / 2),
      put(outbuildings, 'warehouse', west - 5, -30, Math.PI / 2), put(outbuildings, 'packingShed', west - 4, 4, Math.PI / 2),
    ]).then(() => gedeo.traverse(c => { if (c.isMesh) c.raycast = () => {}; }), e => console.warn('Gedeo scenery failed, keeping the procedural set.', e));
    return gedeoLoading;
  }
  return {
    group,
    loading: () => gedeoLoading,
    /** Every country gets the realistic Gedeo set (procedural set until loaded); garden-forest countries add the homestead. */
    sync(countryId) {
      const a = gardenStyleOf(countryId) === 'forest';
      // founder 2026-11-08: the map starts wild — no ready-made homestead / sheds round the farm (forest + hills only)
      homestead.visible = false; outbuildings.visible = false;
      const fallback = !gedeoLoading;
      wood.visible = fallback && !a; africa.visible = fallback && a; belt.visible = fallback;
      loadGedeo().then(() => { wood.visible = africa.visible = belt.visible = false; gedeo.visible = true; });
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); group.removeFromParent(); },
  };
}
