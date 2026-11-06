// Overlay markers: bouncing yellow tutorial arrow, selection frame, drag tool cursor (sickle / seed bag), plot timer.
import * as THREE from 'three';
import { makeLabel, makeCanvasSprite } from './util.js';

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

export function createMarkers({ scene }) {
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
  function setFrame(rect) {
    if (!rect) { frame.visible = false; return; }
    const pad = .25, w = .22;
    const [x0, z0, x1, z1] = [rect[0] - pad, rect[1] - pad, rect[2] + pad, rect[3] + pad];
    const shape = new THREE.Shape([new THREE.Vector2(x0, z0), new THREE.Vector2(x1, z0), new THREE.Vector2(x1, z1), new THREE.Vector2(x0, z1)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(x0 + w, z0 + w), new THREE.Vector2(x0 + w, z1 - w), new THREE.Vector2(x1 - w, z1 - w), new THREE.Vector2(x1 - w, z0 + w)]));
    frame.geometry.dispose();
    // Shape lives in XY; rotate so Y → Z on the ground.
    frame.geometry = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    frame.position.y = .06;
    frame.visible = true;
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
    setCursor(mode, pos) {
      sickle.sprite.visible = mode === 'harvest';
      seeds.sprite.visible = mode === 'plant';
      const s = mode === 'harvest' ? sickle.sprite : mode === 'plant' ? seeds.sprite : null;
      if (s && pos) s.position.set(pos.x, 1.6, pos.z);
    },
    setTimer(text, pos) {
      if (!text) { timer.sprite.visible = false; return; }
      timer.set(text);
      timer.sprite.position.set(pos.x, 2.1, pos.z);
      timer.sprite.visible = true;
    },
    update(time) {
      if (arrow.visible) {
        arrow.position.set(arrowBase.x, arrowBase.y + .25 + Math.abs(Math.sin(time * 4)) * .55, arrowBase.z);
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
