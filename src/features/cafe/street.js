import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The street around the café, code-built: Vietnamese tube houses (limewash walls, balconies with railings, green
// shutters, shop fronts with signs, AC units, water tanks), a brick-paved sidewalk with trees, motorbikes and power
// poles strung with cables, an asphalt road and a trà đá stall across it. Nothing here blocks walking.
// Draw calls: one vertex-coloured mesh (walls/props, a grime texture multiplies the colours), one for shop signs,
// one each for road and sidewalks, one for curbs/markings, one for cables. Seeded, so the street is the same every visit.
const WALLS = ['#f1e4c6', '#e9d3ae', '#f3dca4', '#dfe8dc', '#f1d2c2', '#ece3d2', '#d9e4ec', '#f0c99a'];
const ROOFS = ['#a65a40', '#98503a', '#b0664a', '#8f5a42'];
const SHUTTERS = ['#4f7a62', '#5a8a6e', '#3e6a7a', '#7a5a3a'];
const AWNINGS = ['#c0473b', '#3f7a5a', '#d9a53b', '#3e6a91', '#b5583a'];
const SIGNS = [['PHỞ BÒ', '#c0392b'], ['BÁNH MÌ', '#d9a53b'], ['TẠP HÓA', '#2e6b8a'], ['SỬA XE', '#3f6f4a'], ['HỚT TÓC', '#7a3e8a'], ['TRÀ SỮA', '#c2577a'], ['CƠM TẤM', '#a8492f'], ['NHÀ THUỐC', '#2f7a5a']];

function canvasTexture(size, draw, repeat = true) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4; return texture;
}
// Soft limewash grime: light, so vertex colours stay true; streaks run down the walls.
const grime = rand => canvasTexture(256, (ctx, n) => {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, n, n);
  for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(120,100,80,${(.012 + rand() * .025).toFixed(3)})`; ctx.beginPath(); ctx.arc(rand() * n, rand() * n, 8 + rand() * 30, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 14; i++) { const x = rand() * n, g = ctx.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(90,80,70,.12)'); g.addColorStop(1, 'rgba(90,80,70,0)'); ctx.fillStyle = g; ctx.fillRect(x, rand() * n * .5, 3 + rand() * 5, n * .6); }
});
// Staggered pavers in red and grey, like a Vietnamese sidewalk.
const pavers = () => canvasTexture(256, (ctx, n) => {
  ctx.fillStyle = '#9a8f80'; ctx.fillRect(0, 0, n, n);
  const s = 32;
  for (let r = 0; r < n / s; r++) for (let c = -1; c <= n / s; c++) {
    ctx.fillStyle = (r + c) % 3 === 0 ? '#b8705a' : (r + c) % 3 === 1 ? '#c9bfae' : '#a99f8f';
    ctx.beginPath(); ctx.roundRect(c * s + 2 + (r % 2) * s / 2, r * s + 2, s - 4, s - 4, 6); ctx.fill();
  }
});
const asphalt = rand => canvasTexture(256, (ctx, n) => {
  ctx.fillStyle = '#5c5f61'; ctx.fillRect(0, 0, n, n);
  for (let i = 0; i < 1600; i++) { const v = Math.round(70 + rand() * 40); ctx.fillStyle = `rgb(${v},${v},${v + 3})`; ctx.fillRect(rand() * n, rand() * n, 1.5, 1.5); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(40,40,42,.08)'; ctx.beginPath(); ctx.ellipse(rand() * n, rand() * n, 20 + rand() * 30, 8 + rand() * 12, rand() * 3, 0, Math.PI * 2); ctx.fill(); }
});
const signAtlas = () => canvasTexture(512, (ctx, n) => {
  const h = n / SIGNS.length;
  SIGNS.forEach(([text, bg], i) => {
    ctx.fillStyle = bg; ctx.fillRect(0, i * h, n, h);
    ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 4; ctx.strokeRect(6, i * h + 6, n - 12, h - 12);
    ctx.fillStyle = '#fff6dc'; ctx.font = `800 ${Math.round(h * .55)}px "Baloo 2", system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, n / 2, i * h + h / 2 + 2);
  });
}, false);

export function buildStreet() {
  let seed = 23; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const pick = list => list[Math.floor(rand() * list.length)];
  const parts = [], signs = [], color = new THREE.Color();
  function add(geometry, hex) {
    color.set(hex);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry); // mergeGeometries needs one kind; icosahedra are non-indexed
  }
  // Boxes get world-scaled UVs (one texture tile per 4 m) so the grime keeps its size on big and small faces.
  function box(hex, x, y, z, w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / 4, uv.getY(i) * dims[f][1] / 4); }
    add(g.translate(x, y, z), hex);
  }
  const cyl = (hex, x, y, z, rTop, rBottom, h, seg = 8) => add(new THREE.CylinderGeometry(rTop, rBottom, h, seg).translate(x, y, z), hex);
  const blob = (hex, x, y, z, r) => add(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), hex);
  // Triangular prism, ridge along X (alongZ: along Z), base on y = 0, apex at height h.
  const gable = (hex, x, y, z, length, width, h, alongZ = false) => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, .5, 0).scale(length, h / 1.5, width / 1.732);
    if (alongZ) g.rotateY(Math.PI / 2);
    add(g.translate(x, y, z), hex);
  };
  function sign(x, y, z, w, h, rotY) {
    const i = Math.floor(rand() * SIGNS.length), g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / SIGNS.length);
    signs.push(g.rotateY(rotY).translate(x, y, z));
  }

  // A tube house. front: the street side ('z+','z-','x+','x-'). Facade: a shop on the ground floor (sign, half-open
  // roller shutter, awning), then per floor a shuttered window pair, sometimes a balcony with railing and plant, an AC unit.
  function house(x, z, w, d, h, front, { tiles = .55, shop = true } = {}) {
    const wall = pick(WALLS);
    box(wall, x, h / 2, z, w, h, d);
    const alongZ = front === 'x+' || front === 'x-';
    const [nx, nz] = { 'z+': [0, 1], 'z-': [0, -1], 'x+': [1, 0], 'x-': [-1, 0] }[front];
    const face = alongZ ? d : w, out = (alongZ ? w : d) / 2, rotY = Math.atan2(nx, nz);
    // A point on the facade: u along it, o out from the wall.
    const at = (u, o) => [x + nx * (out + o) + (alongZ ? 0 : u), z + nz * (out + o) + (alongZ ? u : 0)];
    const slab = (hex, u, y, o, len, hh, depth) => { const [px, pz] = at(u, o); box(hex, px, y, pz, alongZ ? depth : len, hh, alongZ ? len : depth); };
    if (rand() < tiles) gable(pick(ROOFS), x, h, z, (alongZ ? d : w) + .3, (alongZ ? w : d) + .5, 1.3 + rand() * .6, alongZ);
    else {
      // Roof terrace: parapet, a steel water tank on legs, sometimes a solar heater.
      box('#d8d0c0', x, h + .45, z, w + .1, .9, d + .1); box(wall, x, h + .03, z, w - .3, .12, d - .3);
      const tx = x + (rand() - .5) * w * .4, tz = z + (rand() - .5) * d * .4;
      cyl('#8a8f92', tx, h + .35, tz, .05, .05, .7, 5);
      add(new THREE.CylinderGeometry(.45, .45, 1.1, 12).rotateZ(Math.PI / 2).translate(tx, h + 1.1, tz), '#d4d8db');
      if (rand() < .5) box('#3a4a5c', x - (rand() - .5) * w * .3, h + .6, z + (rand() - .5) * d * .3, 1.2, .08, .9);
    }
    slab('#bdb2a0', 0, .15, .02, face, .3, .06); // plinth
    if (shop && h > 3.4) {
      slab('#2c2622', 0, 1.25, .01, face * .78, 2.3, .04);  // dark shop interior
      slab('#9aa0a3', 0, 2.15, .04, face * .78, .5, .05);   // half-raised roller shutter
      slab(pick(AWNINGS), 0, 2.62, .5, face * .9, .08, 1);
      const [sx, sz] = at(0, .08); sign(sx, 3.05, sz, Math.min(face * .8, 3.6), .6, rotY);
    }
    const shutter = pick(SHUTTERS), floors = Math.min(3, Math.floor((h - 1.2) / 2.6));
    for (let f = 1; f <= floors; f++) {
      const y = f * 2.6 + .9;
      for (const k of [-.24, .24]) { slab('#e8e0cc', k * face, y, .02, 1.05, 1.35, .06); slab(shutter, k * face, y, .05, .9, 1.2, .05); }
      if (rand() < .6) {
        slab('#d6cdbb', 0, y - .75, .45, face * .85, .1, .9);
        slab('#3a3a38', 0, y - .2, .88, face * .85, .05, .05);
        for (let u = -face * .42; u <= face * .42; u += .3) slab('#3a3a38', u, y - .45, .88, .03, .55, .03);
        const [px, pz] = at(face * .3, .6); cyl('#a8714c', px, y - .55, pz, .16, .12, .3, 8); blob('#5f8a4f', px, y - .25, pz, .28);
      }
      if (rand() < .45) slab('#e6e7e3', face * .38, y - .3, .25, .7, .45, .45); // AC unit
    }
  }
  // Rows of houses: [axis start, axis end, fixed coordinate, depth, height range, front, along X, options].
  function row(from, to, fixed, depth, [hMin, hMax], front, alongX = true, options = {}) {
    for (let u = from; u < to;) {
      const w = Math.min(to - u, 4.2 + rand() * 2.4), h = hMin + rand() * (hMax - hMin);
      if (alongX) house(u + w / 2, fixed, w - .08, depth, h, front, options); else house(fixed, u + w / 2, depth, w - .08, h, front, options);
      u += w;
    }
  }
  row(-34, 34, -17.6, 7.6, [3.9, 4.6], 'z-', true, { tiles: .85, shop: false }); // right behind the back wall: low tile roofs
  row(-40, 40, -26, 8, [6.5, 10], 'z+', true, { shop: false });                   // taller second row fades into the fog
  row(-13.4, 9.6, -20, 7.6, [4.4, 6.4], 'x+', false);                             // west neighbours
  row(-13.4, 9.6, 23, 7.6, [4.4, 6.4], 'x-', false);                              // east, across the side alley
  row(-40, 40, 25.4, 7.6, [5.2, 8.8], 'z-');                                      // shop row across the road

  // Sidewalk: street trees in brick rings, parked motorbikes, power poles; a trà đá stall across the road.
  for (const x of [-30, -22, -14, -7, 7, 14, 22, 30]) {
    box('#8f5a42', x, .1, 12.15, .9, .16, .9);
    cyl('#6e5240', x, 1.2, 12.15, .12, .17, 2.4, 7);
    const leaf = pick(['#5f8a4f', '#6f9a58', '#557f47']);
    for (const [ox, oy, oz, r] of [[0, 3.1, 0, 1.05], [.6, 2.8, .3, .75], [-.55, 2.75, -.25, .8], [.1, 3.6, -.2, .7]]) blob(leaf, x + ox, oy, 12.15 + oz, r);
  }
  for (const x of [-11, -10.2, -9.4, 9.5, 10.3, 11.1, 18, 18.8]) {
    const hex = pick(['#c0473b', '#2f3d36', '#3e6a91', '#e8e2d4', '#d9a53b']);
    box(hex, x, .62, 10.3, .3, .3, 1.15); box('#2f2f2d', x, .86, 10.05, .28, .12, .6); box(hex, x, .95, 10.85, .28, .45, .12);
    box('#3a3a38', x, 1.22, 10.82, .62, .04, .04); // handlebar
    for (const dz of [-.5, .5]) add(new THREE.CylinderGeometry(.27, .27, .09, 12).rotateZ(Math.PI / 2).translate(x, .28, 10.3 + dz), '#2f2f2d');
  }
  const poles = [-27, -18, -9, 5, 16, 27];
  // Poles stand on the far sidewalk so their cables never cross the view into the café.
  for (const x of poles) { cyl('#8d8f8a', x, 3.3, 19.9, .1, .14, 6.6, 6); box('#6d6f6a', x, 6.1, 19.9, 1.4, .1, .1); box('#55595c', x + .3, 4.6, 20.05, .3, .45, .25); }
  for (let i = 0; i < 4; i++) { const x = -16 + i * 1.2; box('#d9483b', x, .28, 20.3, .3, .05, .3); cyl('#d9483b', x, .13, 20.3, .1, .13, .26, 6); } // plastic stools
  box('#3a6fa8', -14.2, .4, 20.6, .6, .05, .6); cyl('#e8c35a', -14.2, .62, 20.6, .14, .14, .4, 10); // tea jug on a low table

  const group = new THREE.Group(); group.name = 'cafe:street';
  const body = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true, map: grime(rand) }));
  body.receiveShadow = true; group.add(body);
  for (const geometry of parts) geometry.dispose();
  group.add(new THREE.Mesh(mergeGeometries(signs), new THREE.MeshStandardMaterial({ map: signAtlas(), roughness: .6, emissive: '#ffffff', emissiveIntensity: .08, side: THREE.DoubleSide })));
  for (const geometry of signs) geometry.dispose();
  // Road and sidewalks, textured in world metres.
  const ground = (texture, z, depth, y, tile) => {
    texture.repeat.set(80 / tile, depth / tile);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(80, depth).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texture, roughness: .95 }));
    mesh.position.set(0, y, z); mesh.receiveShadow = true; group.add(mesh);
  };
  // Heights clear the land model (its top reaches y = 0.1).
  ground(pavers(), 11.2, 2.4, .13, 2); ground(pavers(), 20.5, 2.2, .13, 2); ground(asphalt(rand), 16, 6.8, .11, 4);
  const edges = [];
  for (let x = -38; x <= 38; x += 4) edges.push(new THREE.PlaneGeometry(2, .14).rotateX(-Math.PI / 2).translate(x, .12, 16).toNonIndexed());
  for (const z of [12.45, 19.45]) edges.push(new THREE.BoxGeometry(80, .2, .22).translate(0, .1, z).toNonIndexed());
  group.add(new THREE.Mesh(mergeGeometries(edges), new THREE.MeshStandardMaterial({ color: '#e9e2cf', roughness: .8 })));
  for (const geometry of edges) geometry.dispose();
  // Cables sag between the poles and drop across to the houses: the tangle every Vietnamese street has.
  const points = [];
  const sag = (a, b, drop) => { for (let i = 0; i < 8; i++) for (const t of [i / 8, (i + 1) / 8]) points.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * drop, a.z + (b.z - a.z) * t)); };
  for (let i = 0; i < poles.length - 1; i++) for (const [dy, dz] of [[0, -.6], [-.25, .6], [-.45, 0]]) sag({ x: poles[i], y: 6.1 + dy, z: 19.9 + dz }, { x: poles[i + 1], y: 6.1 + dy, z: 19.9 + dz }, .45);
  for (const x of poles) { sag({ x, y: 5.9, z: 19.9 }, { x: x + 1.5, y: 4.5, z: 21.6 }, .15); sag({ x: x - .3, y: 5.8, z: 19.9 }, { x: x - 1, y: 4.6, z: 21.6 }, .15); }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#2b2b2b' })));
  group.traverse(o => { o.userData.nonSolid = true; o.userData.noPick = true; });
  return group;
}
