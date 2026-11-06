// Farm plots: instanced soil beds for every owned plot + a coffee tree per planted plot (clones share the GLB
// geometry/materials). Growth is computed per frame from cached plantedAt/growMs (no allocation, no derive calls).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLOT_SIZE, ALL_PLOTS, plotsOf } from '../../core/config/layout.js';
import { region as regionOf, growMs } from '../../core/derive.js';
import { damp, easeOutBack } from './util.js';
import { ownedParcels } from './world.js';

const SCALE_MIN = .22, SCALE_MAX = .65;
const SOIL_DRY = new THREE.Color(0x9b6a43), SOIL_WET = new THREE.Color(0x6e4529);
const POP_TIME = .35;

export function createPlots({ scene, templates, vfx }) {
  const group = new THREE.Group();
  group.name = 'realm-plots';
  scene.add(group);

  const bedGeo = new RoundedBoxGeometry(PLOT_SIZE - .3, .26, PLOT_SIZE - .3, 2, .1);
  const bedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const beds = new THREE.InstancedMesh(bedGeo, bedMat, ALL_PLOTS.length);
  beds.count = 0;
  beds.receiveShadow = true;
  beds.castShadow = true;
  beds.raycast = () => {};
  group.add(beds);
  const m4 = new THREE.Matrix4();

  // Invisible pick boxes per owned plot (catch taps on the trees too).
  const pickGeo = new THREE.BoxGeometry(PLOT_SIZE, 1.6, PLOT_SIZE).translate(0, .8, 0);
  const pickMat = new THREE.MeshBasicMaterial();
  const pickers = new Map(); // plotId → mesh
  const plotList = []; // owned plots in layout order (for tutorial targets)

  const entities = new Map(); // plotId → entity
  const dying = [];
  let bedIndex = new Map();

  function makeTree() {
    const g = new THREE.Group();
    const tree = templates.tree ? templates.tree.clone() : new THREE.Mesh(new THREE.ConeGeometry(.6, 1.4, 7).translate(0, .7, 0), new THREE.MeshStandardMaterial({ color: 0x4f8a3a }));
    const green = templates.fruitGreen ? templates.fruitGreen.clone() : new THREE.Group();
    const ripe = templates.fruitRipe ? templates.fruitRipe.clone() : new THREE.Group();
    for (const o of [tree, green, ripe]) o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.add(tree, green, ripe);
    return { group: g, green, ripe };
  }

  function sync(state) {
    const r = regionOf(state);
    const owned = ownedParcels(state).filter(Boolean);
    // Beds + pickers for owned plots.
    plotList.length = 0;
    bedIndex = new Map();
    let i = 0;
    for (const pid of owned) for (const plot of plotsOf(pid)) {
      plotList.push(plot);
      bedIndex.set(plot.id, i);
      m4.makeTranslation(plot.x, .1, plot.z);
      beds.setMatrixAt(i, m4);
      beds.setColorAt(i, r?.plots[plot.id] ? SOIL_WET : SOIL_DRY);
      i++;
      if (!pickers.has(plot.id)) {
        const pick = new THREE.Mesh(pickGeo, pickMat);
        pick.visible = false;
        pick.position.set(plot.x, 0, plot.z);
        pick.userData.target = { kind: 'plot', id: plot.id };
        pick.updateMatrixWorld(true);
        group.add(pick);
        pickers.set(plot.id, pick);
      }
    }
    beds.count = i;
    beds.instanceMatrix.needsUpdate = true;
    if (beds.instanceColor) beds.instanceColor.needsUpdate = true;
    beds.computeBoundingSphere();
    for (const [id, pick] of pickers) if (!bedIndex.has(id)) { pick.removeFromParent(); pickers.delete(id); }

    // Trees.
    const plots = r?.plots || {};
    for (const [id, e] of entities) {
      const p = plots[id];
      if (!p || p.plantedAt !== e.plantedAt || p.crop !== e.crop) { e.group.removeFromParent(); entities.delete(id); }
    }
    for (const [id, p] of Object.entries(plots)) {
      const plot = ALL_PLOTS.find(x => x.id === id);
      if (!plot || !bedIndex.has(id)) continue;
      let e = entities.get(id);
      if (!e) {
        const tree = makeTree();
        e = { id, plot, crop: p.crop, plantedAt: p.plantedAt, total: 1, scale: 0, born: -1, ...tree, ready: false, nextSparkle: Math.random() * 2 };
        e.group.position.set(plot.x, .2, plot.z);
        e.group.rotation.y = (plot.x * 7 + plot.z * 13) % 6.28;
        e.group.scale.setScalar(.001);
        group.add(e.group);
        entities.set(id, e);
      }
      e.total = growMs(state, p.crop);
    }
  }

  /** 'empty' | 'planted' | 'growing' | 'ready' (same thresholds as derive.plotState). */
  function stage(id, now) {
    const e = entities.get(id);
    if (!e) return 'empty';
    const ratio = (now - e.plantedAt) / e.total;
    return ratio >= 1 ? 'ready' : ratio < .08 ? 'planted' : 'growing';
  }
  const remainingMs = (id, now) => { const e = entities.get(id); return e ? Math.max(0, e.total - (now - e.plantedAt)) : 0; };

  function onPlanted(id, time) {
    const e = entities.get(id);
    if (e) e.born = time;
    if (e) vfx.burst('soil', e.group.position);
  }
  // Harvest: the tree pops (grows a bit, then shrinks away) while cherries burst out.
  function onHarvested(id, time) {
    const e = entities.get(id);
    if (!e) return;
    entities.delete(id);
    e.dieAt = time;
    e.dieScale = e.group.scale.x;
    dying.push(e);
    vfx.burst('cherry', e.group.position);
    vfx.burst('leaf', e.group.position);
  }

  function update(dt, time, now) {
    for (const e of entities.values()) {
      const ratio = Math.min(1, (now - e.plantedAt) / e.total);
      const ready = ratio >= 1;
      const goal = ratio < .08 ? SCALE_MIN : SCALE_MIN + (SCALE_MAX - SCALE_MIN) * ratio;
      if (e.born >= 0 && time - e.born < .45) e.scale = SCALE_MIN * easeOutBack((time - e.born) / .45);
      else e.scale = e.scale < .01 ? goal : damp(e.scale, goal, 4, dt);
      const bob = ready ? 1 + .04 * Math.sin(time * 3 + e.plot.x) : 1;
      e.group.scale.set(e.scale, e.scale * bob, e.scale);
      e.green.visible = !ready && ratio > .45;
      e.ripe.visible = ready;
      if (ready !== e.ready) {
        e.ready = ready;
        const bi = bedIndex.get(e.id);
        if (ready && bi != null) vfx.burst('sparkle', e.group.position, { count: 6 });
      }
      if (ready && (e.nextSparkle -= dt) <= 0) {
        e.nextSparkle = 1.6 + Math.random() * 1.6;
        e.group.position.y += .9;
        vfx.burst('sparkle', e.group.position, { count: 2 });
        e.group.position.y -= .9;
      }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const e = dying[i];
      const k = (time - e.dieAt) / POP_TIME;
      if (k >= 1) { e.group.removeFromParent(); dying.splice(i, 1); continue; }
      const s = k < .35 ? e.dieScale * (1 + .5 * k / .35) : e.dieScale * 1.175 * (1 - (k - .35) / .65);
      e.group.scale.setScalar(Math.max(.001, s));
    }
  }

  function first(want, now) {
    for (const plot of plotList) {
      const st = stage(plot.id, now);
      if (want === 'empty' ? st === 'empty' : want === 'planted' ? st !== 'empty' : want === 'ready' ? st === 'ready' : true) return plot;
    }
    return null;
  }

  return {
    group, sync, update, stage, remainingMs, onPlanted, onHarvested, first,
    pickers: () => pickers.values(),
    isOwned: id => bedIndex.has(id),
    clear() { for (const e of entities.values()) e.group.removeFromParent(); entities.clear(); for (const e of dying) e.group.removeFromParent(); dying.length = 0; },
    dispose() {
      this.clear();
      bedGeo.dispose(); bedMat.dispose(); pickGeo.dispose(); pickMat.dispose(); beds.dispose();
      group.removeFromParent();
    },
  };
}
