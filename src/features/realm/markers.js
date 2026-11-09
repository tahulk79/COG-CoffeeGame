// Overlay markers: bouncing yellow tutorial arrow, selection frame, drag tool cursor (sickle / seed bag), plot timer.
import * as THREE from 'three';
import { makeLabel, makeCanvasSprite } from './util.js';
import { farmGroundY } from '../../core/config/layout.js';

export function drawSickle(g, size) {
  const c = size / 2;
  g.lineCap = 'round';
  g.strokeStyle = '#8a5a30'; g.lineWidth = size * .1;
  g.beginPath(); g.moveTo(c - size * .05, c + size * .05); g.lineTo(c - size * .3, c + size * .38); g.stroke();
  g.strokeStyle = '#5a3a1e'; g.lineWidth = size * .02; g.stroke();
  g.fillStyle = '#e9eef2'; g.strokeStyle = '#6c7a86'; g.lineWidth = size * .025;
  g.beginPath();
  g.arc(c + size * .05, c - size * .02, size * .3, Math.PI * .95, Math.PI * 2.05);
  g.arc(c + size * .1, c + size * .02, size * .22, Math.PI * 2.05, Math.PI * .95, true);
  g.closePath(); g.fill(); g.stroke();
}
function drawSeedBag(g, size) {
  const c = size / 2;
  g.fillStyle = '#d9b57a'; g.strokeStyle = '#7a5530'; g.lineWidth = size * .03;
  g.beginPath();
  g.moveTo(c - size * .18, c - size * .2);
  g.quadraticCurveTo(c - size * .36, c + size * .1, c - size * .26, c + size * .34);
  g.lineTo(c + size * .26, c + size * .34);
  g.quadraticCurveTo(c + size * .36, c + size * .1, c + size * .18, c - size * .2);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#c99d5f'; g.fillRect(c - size * .2, c - size * .27, size * .4, size * .08);
  g.fillStyle = '#6aa84f';
  for (const [x, y] of [[-.08, .06], [.06, .12], [-.02, .2], [.1, -.01]]) { g.beginPath(); g.ellipse(c + x * size, c + y * size, size * .035, size * .05, .5, 0, Math.PI * 2); g.fill(); }
}

const FRAME_COLOR = 0xffe066, LAND_COLOR = 0x9be36a; // selection frame / land card frame
export const FRAME_LAND = LAND_COLOR;
const ARROW_PX = 56, ARROW_H = 1.6; // arrow on-screen height (CSS px) / model height (m)

export function createMarkers({ scene, camera }) {
  const group = new THREE.Group();
  group.name = 'realm-markers';
  scene.add(group);

  // ---------- tutorial arrow (unlit, always on top) ----------
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, depthTest: false, depthWrite: false, transparent: true });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xc77b12, depthTest: false, depthWrite: false, side: THREE.BackSide, transparent: true });
  const headGeo = new THREE.ConeGeometry(.55, .8, 4).rotateX(Math.PI).translate(0, .4, 0);
  const shaftGeo = new THREE.BoxGeometry(.38, .8, .38).translate(0, 1.2, 0);
  const arrow = new THREE.Group();
  for (const g of [headGeo, shaftGeo]) {
    const m = new THREE.Mesh(g, arrowMat); m.renderOrder = 31; m.raycast = () => {};
    const e = new THREE.Mesh(g, edgeMat); e.scale.setScalar(1.12); e.position.y = -.04; e.renderOrder = 30; e.raycast = () => {};
    arrow.add(e, m);
  }
  arrow.visible = false;
  group.add(arrow);
  const arrowBase = new THREE.Vector3();

  // ---------- selection frame ----------
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide });
  const frame = new THREE.Mesh(new THREE.BufferGeometry(), frameMat);
  frame.visible = false; frame.renderOrder = 4; frame.raycast = () => {};
  group.add(frame);
  // color: the selection yellow by default; the land card frame uses a soft green (empty owned land).
  // Selection frame: a thin ROUNDED RECTANGLE with the same padding on all four sides, the thing sitting in the middle (a
  // plant gets a small square-ish box, a building a box hugging its footprint, a signboard a wider one).
  function roundedFrame(cx, cz, hx, hz, w, r) {
    const path = (t, x, z, rr) => { t.moveTo(-x + rr, -z); t.lineTo(x - rr, -z); t.quadraticCurveTo(x, -z, x, -z + rr); t.lineTo(x, z - rr); t.quadraticCurveTo(x, z, x - rr, z); t.lineTo(-x + rr, z); t.quadraticCurveTo(-x, z, -x, z - rr); t.lineTo(-x, -z + rr); t.quadraticCurveTo(-x, -z, -x + rr, -z); };
    const shape = new THREE.Shape(); path(shape, hx, hz, r);
    const hole = new THREE.Path(); path(hole, hx - w, hz - w, Math.max(.05, r - w)); shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  }
  function setFrame(rect, { color = FRAME_COLOR, round = false, radius = 1 } = {}) {
    if (!rect) { frame.visible = false; return; }
    frameMat.color.set(color);
    const cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2;
    // round → a plant / a sign foot: a fixed-size box (0.62 m half-side × radius) around the point; else the rect's own size + a little air
    const pad = .14, hx = round ? .62 * radius : (rect[2] - rect[0]) / 2 + pad, hz = round ? .62 * radius : (rect[3] - rect[1]) / 2 + pad;
    frame.geometry.dispose();
    frame.geometry = roundedFrame(cx, cz, hx, hz, .09, Math.min(.38, Math.min(hx, hz) * .55));
    frame.position.y = .06 + farmGroundY(cx, cz);
    frame.visible = true;
  }

  // ---------- plants that need you: one ring on the ground round the plant's foot ----------
  // Its border is the patience bar: the arc empties as time runs out (gold = ripe, sea blue = thirsty, grass green = prune)
  // and it turns solid red when the time is up. Arcs come from a small cache (5 % steps), meshes from a pool.
  const mk = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false, depthTest: false, side: THREE.DoubleSide }); // drawn over big canopies
  const alertMats = { ready: mk(0xffc21a), thirst: mk(0x2f8cff), prune: mk(0x4fc23a), warn: mk(0xe5533f) };
  const trackMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const arcCache = new Map();
  const arcGeo = q => { if (!arcCache.has(q)) arcCache.set(q, new THREE.RingGeometry(.58, .66, 48, 1, Math.PI / 2, q / 20 * Math.PI * 2).rotateX(-Math.PI / 2)); return arcCache.get(q); };
  const alertPool = [];
  function setAlerts(list) {
    for (let i = 0; i < Math.max(list.length, alertPool.length); i++) {
      let e = alertPool[i];
      if (!e) { e = alertPool[i] = { track: new THREE.Mesh(arcGeo(20), trackMat), arc: new THREE.Mesh(arcGeo(20), alertMats.ready) }; for (const m of [e.track, e.arc]) { m.renderOrder = 30; m.raycast = () => {}; m.visible = false; group.add(m); } }
      const a = list[i];
      if (!a || i >= 60) { e.track.visible = e.arc.visible = false; continue; }
      const y = .09 + farmGroundY(a.x, a.z), q = 20; // a plain full ring: no progress arc at the foot any more (the timer lives in the tree viewer)
      const sc = 1; // the same size and thickness as the ring you get when you tap a plant
      e.track.scale.set(sc, 1, sc); e.arc.scale.set(sc, 1, sc);
      e.track.position.set(a.x, y, a.z); e.arc.position.set(a.x, y + .005, a.z);
      e.arc.geometry = arcGeo(q); e.arc.material = alertMats[a.warn ? 'warn' : a.kind] || alertMats.ready;
      e.track.visible = false; e.arc.visible = true;
    }
  }

  // Far-away alerts are summed up: ONE small badge per cluster ("🧺 12") instead of a ring on every plant
  const CL_STYLE = { ready: { bg: '#fff0bd', border: '#ffc21a', ico: '🧺' }, thirst: { bg: '#d9ecff', border: '#2f8cff', ico: '💧' }, prune: { bg: '#e0f6d6', border: '#4fc23a', ico: '🪚' } };
  const clusterPool = [];
  function setClusters(list) {
    for (let i = 0; i < Math.max(list.length, clusterPool.length); i++) {
      let e = clusterPool[i];
      if (!e) { e = clusterPool[i] = { label: null, text: '', kind: '' }; }
      const c = list[i];
      if (!c || i >= 24) { if (e.label) e.label.sprite.visible = false; continue; }
      const st = CL_STYLE[c.kind] || CL_STYLE.ready, text = `${st.ico} ${c.n}`, key = `${c.kind}${c.warn ? '!' : ''}`;
      if (!e.label || e.kind !== key) {
        if (e.label) { e.label.sprite.removeFromParent(); e.label.dispose?.(); }
        e.label = makeLabel(text, { bg: st.bg, border: c.warn ? '#e5533f' : st.border, height: .8, onTop: true }); e.kind = key; e.text = ''; group.add(e.label.sprite);
      }
      if (e.text !== text) { e.label.set(text); e.text = text; }
      e.label.sprite.position.set(c.x, farmGroundY(c.x, c.z) + 2.3, c.z); e.label.sprite.visible = true;
    }
  }

  // ---------- drag tool cursor ----------
  const sickle = makeCanvasSprite(128, drawSickle, { scale: 1.5, onTop: true });
  const seeds = makeCanvasSprite(128, drawSeedBag, { scale: 1.4, onTop: true });
  sickle.sprite.visible = seeds.sprite.visible = false;
  group.add(sickle.sprite, seeds.sprite);

  // ---------- plot timer ----------
  const timer = makeLabel('', { bg: '#ffffff', border: '#6aa84f', height: .62, onTop: true });
  timer.sprite.visible = false;
  group.add(timer.sprite);

  return {
    arrow,
    setArrow(pos) {
      if (!pos) { arrow.visible = false; return; }
      arrowBase.copy(pos);
      arrow.visible = true;
    },
    setFrame,
    setAlerts,
    setClusters,
    setCursor(mode, pos) {
      sickle.sprite.visible = mode === 'harvest';
      seeds.sprite.visible = mode === 'plant';
      const s = mode === 'harvest' ? sickle.sprite : mode === 'plant' ? seeds.sprite : null;
      if (s && pos) s.position.set(pos.x, 1.6 + farmGroundY(pos.x, pos.z), pos.z);
    },
    setTimer(text, pos) {
      timer.sprite.visible = false; return; // the seconds label over a plant is gone (founder 2026-11-08)
      if (!text) { timer.sprite.visible = false; return; }
      timer.set(text);
      timer.sprite.position.set(pos.x, 2.1 + farmGroundY(pos.x, pos.z), pos.z);
      timer.sprite.visible = true;
    },
    update(time) {
      const blink = .45 + .55 * (.5 + .5 * Math.sin(time * 1.8)); // the rings blink so they catch the eye
      for (const k in alertMats) alertMats[k].opacity = blink;
      if (arrow.visible) {
        // Constant on-screen size (~ARROW_PX tall) whatever the zoom: a fixed 1.6 m arrow filled the screen up close.
        let k = 1;
        if (camera) {
          const d = camera.position.distanceTo(arrowBase), h = Math.max(1, window.innerHeight || 1);
          k = Math.min(1, ARROW_PX * 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / h / ARROW_H);
        }
        arrow.scale.setScalar(k);
        arrow.position.set(arrowBase.x, arrowBase.y + (.25 + Math.abs(Math.sin(time * 4)) * .55) * k, arrowBase.z);
        arrow.rotation.y = time * 1.5;
      }
      if (frame.visible) frameMat.opacity = .6 + .3 * Math.sin(time * 4);
      if (sickle.sprite.visible) sickle.sprite.material.rotation = Math.sin(time * 14) * .35;
    },
    dispose() {
      sickle.dispose(); seeds.dispose(); timer.dispose();
      headGeo.dispose(); shaftGeo.dispose(); arrowMat.dispose(); edgeMat.dispose();
      frame.geometry.dispose(); frameMat.dispose();
      group.removeFromParent();
    },
  };
}
