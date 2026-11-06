// Grid navigator (src/features/realm/nav.js, pure — no DOM/three): customers must reach the order-counter queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playing } from './helpers.mjs';
import { createNav, navObstacles, rectArea } from '../../src/features/realm/nav.js';
import { CAFE_BOUNDS, CUSTOMER, PARCELS, TUTORIAL_BUILD, CAFE_SEATS } from '../../src/core/config/layout.js';

// Static café decor like city.js: the café house behind S and the north / south house rows beside the alley.
const S = PARCELS.S.rect;
const DECOR = [[S[0] - .2, 92.4, S[2] + .2, 99.6], [-36, 92.4, -9.8, 99.6], [10.2, 92.4, 38, 99.6], [-36, 124.1, -10.5, 131.3], [-5.5, 124.1, 38, 131.3]];

function cafeNav(buildings) {
  const nav = createNav(CAFE_BOUNDS, { radius: .45 });
  nav.rebuild(navObstacles(DECOR, buildings).filter(r => rectArea(r) === 'cafe'));
  return nav;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function check(nav, from, to, label) {
  const path = nav.path(from.x, from.z, to.x, to.z, { exact: true });
  assert.ok(path.length > 0 && path.length < 40, `${label}: ${path.length} waypoints`);
  const end = path[path.length - 1];
  assert.ok(dist(end, to) < .3, `${label}: ends ${dist(end, to).toFixed(2)} m from the target`);
  let len = 0, prev = from;
  for (const p of path) { len += dist(prev, p); prev = p; }
  assert.ok(len < dist(from, to) * 2.5 + 4, `${label}: path ${len.toFixed(1)} m vs straight ${dist(from, to).toFixed(1)} m`);
  for (let i = 1; i < path.length; i++) if (!(i === path.length - 1)) assert.ok(nav.lineFree(path[i - 1].x, path[i - 1].z, path[i].x, path[i].z), `${label}: segment ${i} crosses an obstacle`);
  return path;
}

test('nav: a new customer walks from the street spawn to every queue slot in front of the order counter', () => {
  const h = playing();
  const nav = cafeNav(h.region().buildings);
  for (let i = 0; i < 4; i++) {
    const slot = { x: CUSTOMER.queue.x + i * CUSTOMER.queue.dx, z: CUSTOMER.queue.z + i * CUSTOMER.queue.dz };
    assert.equal(nav.blockedAt(slot.x, slot.z), false, `queue slot ${i} must be walkable`);
    check(nav, CUSTOMER.spawn, slot, `spawn → queue ${i}`);
  }
});

test('nav: queue → terrace seat → exit, also with a roaster built at the tutorial spot', () => {
  const h = playing();
  h.must('build/place', { type: 'roaster', ...TUTORIAL_BUILD.roaster, rot: 0 });
  const nav = cafeNav(h.region().buildings);
  const head = { x: CUSTOMER.queue.x, z: CUSTOMER.queue.z };
  for (const seat of CAFE_SEATS.slice(0, 4)) check(nav, head, seat, `queue → seat ${seat.x},${seat.z}`);
  check(nav, CAFE_SEATS[0], CUSTOMER.exit, 'seat → exit');
});
