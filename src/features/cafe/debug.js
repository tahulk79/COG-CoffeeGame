import * as THREE from 'three';
import { findRoute } from '../../shared/game/navigation.js';
import { LAYOUT_ROUTES, layoutPoints } from './service.js';

const STEP = .35;
const finish = search => { let step; do step = search.next(); while (!step.done); return step.value; };

// Grid debugger (open the cafe with ?debug=grid): walkable cells green, blocked red, layout points as markers,
// audited routes as lines. Press G to redraw after an upgrade changes the furniture.
export function mountGridDebug(world, bounds, interactions) {
  const group = new THREE.Group(); group.name = 'debug-grid'; group.userData.nonSolid = true; world.scene.add(group);
  const cellGeometry = new THREE.PlaneGeometry(STEP * .86, STEP * .86).rotateX(-Math.PI / 2);
  const cellMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .38, depthWrite: false });
  let cells = null;

  function points() {
    const approach = interactions.flatMap(item => (item.approachOffsets || [[0, 0]]).map(([dx, dz], i) => ({ name: `${item.name}${item.approachOffsets?.length > 1 ? ` ${i + 1}` : ''}`, kind: 'player', x: item.position[0] + dx, z: item.position[1] + dz })));
    return [...layoutPoints(), ...approach];
  }
  function audit() {
    world.prepareNavigation();
    const list = points(), byName = new Map(list.map(p => [p.name, p]));
    const standIssues = list.filter(p => p.kind !== 'seat' && !world.canStand(p.x, p.z)).map(p => ({ problem: 'không đứng được', name: p.name, x: p.x, z: p.z }));
    // Seat stand points sit just outside the chair; only check the ones guests can actually use.
    standIssues.push(...list.filter(p => p.kind === 'seat' && !world.canStand(p.x, p.z)).map(p => ({ problem: 'điểm vào ghế bị chặn', name: p.name, x: p.x, z: p.z })));
    const routes = [], routeIssues = [];
    for (const [fromName, toName] of LAYOUT_ROUTES) {
      const from = byName.get(fromName), targets = toName === 'seat' ? list.filter(p => p.kind === 'seat') : [byName.get(toName)];
      for (const to of targets) {
        const path = finish(findRoute(from, to, world.canStand, bounds)), end = path.at(-1);
        const ok = Boolean(end) && Math.hypot(end.x - to.x, end.z - to.z) < .4;
        routes.push({ from, to, path, ok });
        if (!ok) routeIssues.push({ problem: 'không có đường', name: `${from.name} → ${to.name}` });
      }
    }
    const playerStart = { x: -1.5, z: -9 };
    for (const p of list.filter(p => p.kind === 'player')) {
      const path = finish(findRoute(playerStart, p, world.canStand, bounds)), end = path.at(-1);
      const ok = Boolean(end) && Math.hypot(end.x - p.x, end.z - p.z) < .4;
      routes.push({ from: playerStart, to: p, path, ok });
      if (!ok) routeIssues.push({ problem: 'người chơi không tới được', name: p.name });
    }
    return { points: list, routes, issues: [...standIssues, ...routeIssues] };
  }

  function draw() {
    group.clear();
    world.prepareNavigation();
    const xs = Math.floor((bounds.maxX - bounds.minX) / STEP) + 1, zs = Math.floor((bounds.maxZ - bounds.minZ) / STEP) + 1;
    cells = new THREE.InstancedMesh(cellGeometry, cellMaterial, xs * zs);
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    let n = 0;
    for (let i = 0; i < xs; i++) for (let j = 0; j < zs; j++) {
      const x = bounds.minX + i * STEP, z = bounds.minZ + j * STEP;
      matrix.makeTranslation(x, .09, z); cells.setMatrixAt(n, matrix);
      cells.setColorAt(n++, color.set(world.canStand(x, z) ? '#3fbf5f' : '#d8443a'));
    }
    cells.renderOrder = 7; group.add(cells);
    const result = audit();
    const marker = new THREE.CylinderGeometry(.13, .13, .5, 8);
    const kindColor = { customer: '#2f7fd6', seat: '#8a4fd6', staff: '#f08a1c', player: '#ffffff' };
    for (const p of result.points) {
      const bad = result.issues.some(issue => issue.name === p.name);
      const mesh = new THREE.Mesh(marker, new THREE.MeshBasicMaterial({ color: bad ? '#ff0000' : kindColor[p.kind] }));
      mesh.position.set(p.x, .3, p.z); mesh.renderOrder = 8; group.add(mesh);
    }
    for (const r of result.routes) {
      const line = new THREE.BufferGeometry().setFromPoints([r.from, ...r.path].map(p => new THREE.Vector3(p.x, .14, p.z)));
      group.add(new THREE.Line(line, new THREE.LineBasicMaterial({ color: r.ok ? '#ffe14a' : '#ff2020', transparent: true, opacity: r.ok ? .55 : 1 })));
    }
    group.traverse(o => { o.userData.nonSolid = true; });
    window.__cafeLayoutAudit = { issues: result.issues, checked: result.routes.length, points: result.points.length };
    console.table(result.issues.length ? result.issues : [{ problem: 'không có lỗi', name: `${result.routes.length} đường · ${result.points.length} điểm` }]);
    return result;
  }
  // Lists the solid meshes around a floor point, using the scene's own collider rules (console: __cafeBlockersAt(x, z)).
  window.__cafeBlockersAt = (x, z, pad = .5) => {
    const hits = [], box = new THREE.Box3();
    world.scene.updateMatrixWorld(true);
    world.scene.traverse(object => {
      if (!object.isMesh) return;
      const path = [];
      for (let o = object; o; o = o.parent) { if (o.userData.nonSolid || !o.visible || o.name === 'heaven-player') return; path.push(o.name || o.type); }
      box.setFromObject(object);
      if (box.max.y <= .15 || box.min.y >= 2.1) return;
      if (x > box.min.x - pad && x < box.max.x + pad && z > box.min.z - pad && z < box.max.z + pad) hits.push({ path: path.slice(0, 4).join(' < '), min: [box.min.x.toFixed(2), box.min.y.toFixed(2), box.min.z.toFixed(2)].join(','), max: [box.max.x.toFixed(2), box.max.y.toFixed(2), box.max.z.toFixed(2)].join(',') });
    });
    return hits;
  };
  // Worst case for future upgrades: every table open at sofa level and every counter slot filled (press H).
  function drawMax() {
    const gear = { station: 2, register2: 1, pickup: 1, kiosk: 2, autoEspresso: 1, espresso: 3, steamer: 2, mixer: 1, v60: 1 };
    for (const item of interactions) {
      if (item.kind === 'table') world.setActorState(item.id, { unlocked: true, level: 4, dirty: [] });
      else if (['bar', 'register', 'pickup', 'kiosk'].includes(item.kind)) world.setActorState(item.id, { gear, shelf: 0 });
    }
    world.invalidateNavigation();
    return draw();
  }
  window.__cafeAuditMax = () => drawMax().issues;
  const onKey = e => { if (e.code === 'KeyG') draw(); if (e.code === 'KeyH') drawMax(); };
  window.addEventListener('keydown', onKey);
  draw();
  return { draw, dispose() { window.removeEventListener('keydown', onKey); world.scene.remove(group); cellGeometry.dispose(); cellMaterial.dispose(); } };
}
