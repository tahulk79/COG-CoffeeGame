// Café street (docs/design/cafe-street.md): venue unlocks, venue sales, ratings, leave reasons, layout helpers,
// normalization and i18n coverage of the new ids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playing, T0 } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import { normalizeSave, createSave } from '../../src/core/state.js';
import { VENUES, VENUE_ORDER, VENUE_ITEMS, RATING, XP, SAY_VARIANTS, xpForLevel } from '../../src/core/config/economy.js';
import {
  CAFE_QUEUE, cafeQueueSlot, venueQueueSlot, VENUE_LOTS, SHOP_FRAMES, SHOP_ORDER, STREET_FRAME, shopAt, PARCELS,
  CAFE_BOUNDS, CAFE_ROADS, areaAt, parcelAt,
} from '../../src/core/config/layout.js';
import hud from '../../src/i18n/locales/v3-hud.js';
import realm from '../../src/i18n/locales/v3-realm.js';

const at = (h, lvl, coins) => { h.state.player.xp = xpForLevel(lvl); h.state.player.coins = coins; return h; };

test('street: a fresh region has the café open only and neutral 4★ ratings', () => {
  const h = playing();
  const r = h.region();
  assert.deepEqual(r.street.open, []);
  for (const id of Object.keys(VENUES)) assert.deepEqual(r.street.rating[id], { avg: RATING.start, n: 0 });
  assert.deepEqual(D.openVenues(h.state), ['cafe']);
  assert.equal(D.venueOpen(h.state, 'cafe'), true);
  assert.equal(D.venueOpen(h.state, 'lemon'), false);
  assert.equal(D.ratingFactor(h.state), 1);
  for (const k of ['venueSold', 'reviews', 'fights']) assert.equal(h.state.stats[k], 0);
});

test('street: openVenue — unknown ids, level gate, coins, success (+xp, event), noop when already open', () => {
  const h = at(playing(), 1, 1e5);
  assert.equal(h.act('shop/openVenue', { venue: 'cafe' }).error, 'unknown');
  assert.equal(h.act('shop/openVenue', { venue: '__proto__' }).error, 'unknown');
  assert.equal(h.act('shop/openVenue', { venue: 'castle' }).error, 'unknown');
  assert.equal(h.act('shop/openVenue', {}).error, 'unknown');
  const lv = h.act('shop/openVenue', { venue: 'lemon' });
  assert.equal(lv.error, 'level');
  assert.deepEqual(lv.data, { level: VENUES.lemon.level });

  at(h, VENUES.lemon.level, VENUES.lemon.cost - 1);
  const c = h.act('shop/openVenue', { venue: 'lemon' });
  assert.equal(c.error, 'coins');
  assert.deepEqual(c.data, { missing: 1 });

  h.state.player.coins = VENUES.lemon.cost + 5;
  const xp0 = h.state.player.xp;
  const ok = h.must('shop/openVenue', { venue: 'lemon' });
  assert.equal(h.state.player.coins, 5);
  assert.equal(h.state.player.xp - xp0, XP.build);
  assert.deepEqual(h.region().street.open, ['lemon']);
  assert.deepEqual(ok.events.find(e => e.type === 'venueOpened'), { type: 'venueOpened', venue: 'lemon', cost: VENUES.lemon.cost });
  assert.equal(D.venueOpen(h.state, 'lemon'), true);
  assert.equal(D.venueError(h.state, 'lemon'), 'owned');
  const again = h.act('shop/openVenue', { venue: 'lemon' });
  assert.equal(again.ok, true);
  assert.equal(again.noop, true);
  assert.equal(h.state.player.coins, 5);
  assert.deepEqual(D.openVenues(h.state), ['cafe', 'lemon']);
});

test('street: every venue level gate is below the Level-10 incident; unlock order is cheapest first', () => {
  for (const id of VENUE_ORDER) assert.ok(VENUES[id].level < 10, id);
  const costs = VENUE_ORDER.map(id => VENUES[id].cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b));
  for (const id of VENUE_ORDER) for (const item of VENUES[id].items) assert.equal(VENUE_ITEMS[item].venue, id);
});

test('street: venueSale — locked, wrong item, success earns coins + xp; café is not a venue', () => {
  const h = at(playing(), 9, 1e5);
  assert.equal(h.act('shop/venueSale', { venue: 'bar', item: 'beer' }).error, 'locked');
  assert.equal(h.act('shop/venueSale', { venue: 'cafe', item: 'espresso' }).error, 'unknown');
  h.must('shop/openVenue', { venue: 'bar' });
  assert.equal(h.act('shop/venueSale', { venue: 'bar', item: 'matcha' }).error, 'unknown');
  assert.equal(h.act('shop/venueSale', { venue: 'bar', item: 'toString' }).error, 'unknown');
  assert.equal(h.act('shop/venueSale', { venue: 'bar' }).error, 'unknown');
  const coins = h.state.player.coins, xp = h.state.player.xp, beans = h.state.inventory.beans;
  const r = h.must('shop/venueSale', { venue: 'bar', item: 'cocktail' });
  assert.equal(h.state.player.coins, coins + VENUE_ITEMS.cocktail.price);
  assert.equal(h.state.player.xp, xp + VENUE_ITEMS.cocktail.xp);
  assert.equal(h.state.inventory.beans, beans);
  assert.equal(h.state.stats.venueSold, 1);
  assert.deepEqual(r.events.find(e => e.type === 'venueSale'),
    { type: 'venueSale', venue: 'bar', item: 'cocktail', coins: VENUE_ITEMS.cocktail.price, xp: VENUE_ITEMS.cocktail.xp });
});

test('street: venue sales and reviews are refused while the café is paused; openVenue still works', () => {
  const h = at(playing(), 9, 1e5);
  h.must('shop/openVenue', { venue: 'lemon' });
  h.must('shop/pause');
  assert.equal(h.act('shop/venueSale', { venue: 'lemon', item: 'lemonTea' }).error, 'cafeClosed');
  assert.equal(h.act('shop/review', { venue: 'lemon', stars: 5 }).error, 'cafeClosed');
  h.must('shop/openVenue', { venue: 'tea' });
  h.must('shop/resume');
  h.must('shop/venueSale', { venue: 'tea', item: 'mooncake' });
});

test('street: review — moving average math, clamping, rounding, reasons; locked venue refused', () => {
  const h = playing();
  assert.equal(h.act('shop/review', { venue: 'lemon', stars: 5 }).error, 'locked');
  assert.equal(h.act('shop/review', { venue: 'castle', stars: 5 }).error, 'unknown');
  assert.equal(h.act('shop/review', { venue: 'cafe', stars: NaN }).error, 'unknown');
  assert.equal(h.act('shop/review', { venue: 'cafe', stars: 'x' }).error, 'unknown');
  assert.equal(h.act('shop/review', { venue: 'cafe' }).error, 'unknown');

  // first review counts fully (w = 1/(0+1))
  let r = h.must('shop/review', { venue: 'cafe', stars: 2, reason: 'slow' });
  assert.deepEqual(r.events[0], { type: 'reviewed', venue: 'cafe', stars: 2, avg: 2, reason: 'slow' });
  // second: w = 1/2 → 2 + (5-2)/2 = 3.5; stars 9 clamps to 5
  r = h.must('shop/review', { venue: 'cafe', stars: 9, reason: 'nonsense' });
  assert.equal(r.events[0].stars, 5);
  assert.equal(r.events[0].reason, 'venue');
  assert.equal(h.region().street.rating.cafe.avg, 3.5);
  // third: w = 1/3, stars -4 → 1 → 3.5 + (1-3.5)/3 = 2.6666… → 2.67; 4.6 rounds to 5
  h.must('shop/review', { venue: 'cafe', stars: -4 });
  assert.equal(h.region().street.rating.cafe.avg, 2.67);
  assert.equal(h.region().street.rating.cafe.n, 3);
  assert.equal(h.state.stats.reviews, 3);
  // many reviews: weight never drops below RATING.minWeight
  h.region().street.rating.cafe = { avg: 4, n: 1000 };
  h.must('shop/review', { venue: 'cafe', stars: 4.6 });
  assert.equal(h.region().street.rating.cafe.avg, Math.round((4 + (5 - 4) * RATING.minWeight) * 100) / 100);
  for (let i = 0; i < 200; i++) h.must('shop/review', { venue: 'cafe', stars: 1 });
  assert.ok(h.region().street.rating.cafe.avg >= 1 && h.region().street.rating.cafe.avg < 1.1);
  const avg = h.region().street.rating.cafe.avg;
  assert.equal(D.ratingFactor(h.state), Math.max(RATING.minFactor, 1 + (avg - RATING.start) * RATING.arrivalPerStar));
  assert.ok(D.ratingFactor(h.state) < 1);
});

test('street: café arrivalMs unchanged at the default rating; better rating → more walk-ins (clamped)', () => {
  const h = playing();
  const base = D.arrivalMs(h.state);
  h.region().street.rating.cafe = { avg: RATING.start, n: 50 }; // reviewed but neutral → same pace
  assert.equal(D.arrivalMs(h.state), base);
  h.region().street.rating.cafe.avg = 5;
  assert.ok(D.arrivalMs(h.state) < base);
  assert.equal(D.ratingFactor(h.state), Math.min(RATING.maxFactor, 1 + RATING.arrivalPerStar));
  h.region().street.rating.cafe.avg = 1;
  const f = Math.max(RATING.minFactor, 1 - 3 * RATING.arrivalPerStar);
  assert.ok(Math.abs(D.arrivalMs(h.state) - base / f) <= 1);
  // a region from before the street (no street field) still works with the defaults
  delete h.region().street;
  assert.equal(D.arrivalMs(h.state), base);
  assert.equal(D.venueRating(h.state, 'lemon'), RATING.start);
  assert.equal(D.venueArrivalMs(h.state, 'lemon'), VENUES.lemon.arrivalSeconds * 1000);
  assert.equal(D.venueArrivalMs(h.state, 'cafe'), 0);
  assert.equal(D.venueArrivalMs(h.state, '__proto__'), 0);
  assert.deepEqual(D.venueItems('tea'), ['matcha', 'mooncake']);
  assert.deepEqual(D.venueItems('cafe'), []);
  h.state.player.xp = xpForLevel(9); h.state.player.coins = 1e5;
  h.must('shop/openVenue', { venue: 'tea' }); // repairs the missing street on write
  assert.deepEqual(h.region().street.open, ['tea']);
});

test('street: customerLeft passes the reason through (whitelisted, default patience); fight counts once', () => {
  const h = playing();
  const spawn = () => { h.must('shop/spawnCustomer', { roll: 0 }); return h.region().shop.orders.at(-1).id; };
  const a = spawn(), b = spawn();
  let r = h.must('shop/customerLeft', { orderId: a, reason: 'fight' });
  assert.equal(r.events[0].reason, 'fight');
  assert.equal(r.events[0].angry, false);
  assert.equal(h.state.stats.fights, 1);
  assert.equal(h.act('shop/customerLeft', { orderId: a, reason: 'fight' }).error, 'unknown');
  assert.equal(h.state.stats.fights, 1);
  r = h.must('shop/customerLeft', { orderId: b, reason: 'switch' });
  assert.equal(r.events[0].reason, 'switch');
  const c = spawn(), d = spawn();
  r = h.must('shop/customerLeft', { orderId: c, reason: 'teleport' });
  assert.equal(r.events[0].reason, 'patience');
  r = h.must('shop/customerLeft', { orderId: d });
  assert.equal(r.events[0].reason, 'patience');
});

test('street: normalizeSave keeps valid street state and filters junk', () => {
  const h = at(playing(), 9, 1e5);
  h.must('shop/openVenue', { venue: 'bar' });
  h.must('shop/review', { venue: 'bar', stars: 5 });
  const raw = JSON.parse(JSON.stringify(h.state));
  const n = normalizeSave(raw, T0);
  assert.deepEqual(n.world.regions['vn-1'].street, h.region().street);

  const id = raw.world.currentRegion;
  raw.world.regions[id].street = {
    open: ['bar', 'bar', 'cafe', 'castle', '__proto__', 'toString', 7, null, 'lemon'],
    rating: { cafe: { avg: 99, n: -3 }, lemon: { avg: 'x' }, bar: null, castle: { avg: 1, n: 1 } },
  };
  const st = normalizeSave(raw, T0).world.regions[id].street;
  assert.deepEqual(st.open, ['bar', 'lemon']);
  assert.deepEqual(st.rating.cafe, { avg: 5, n: 0 });
  assert.deepEqual(st.rating.lemon, { avg: RATING.start, n: 0 });
  assert.deepEqual(st.rating.bar, { avg: RATING.start, n: 0 });
  assert.equal('castle' in st.rating, false);
  assert.deepEqual(Object.keys(st.rating).sort(), Object.keys(VENUES).sort());

  raw.world.regions[id].street = 'junk';
  assert.deepEqual(normalizeSave(raw, T0).world.regions[id].street.open, []);
  delete raw.world.regions[id].street;
  assert.deepEqual(normalizeSave(raw, T0).world.regions[id].street.open, []);
  // old saves without the new stats get them at 0
  const old = createSave(T0); delete old.stats.fights;
  assert.equal(normalizeSave(old, T0).stats.fights, 0);
});

test('layout: café queue — head at the counter, then 2 lines behind it', () => {
  assert.deepEqual(cafeQueueSlot(0), CAFE_QUEUE.head);
  assert.notEqual(cafeQueueSlot(0), CAFE_QUEUE.head); // a copy
  assert.deepEqual(cafeQueueSlot(-1), CAFE_QUEUE.head);
  assert.deepEqual(cafeQueueSlot(NaN), CAFE_QUEUE.head);
  assert.deepEqual(cafeQueueSlot(1), { x: -3.75, z: 108.45 });
  assert.deepEqual(cafeQueueSlot(2), { x: -2.25, z: 108.45 });
  assert.deepEqual(cafeQueueSlot(3), { x: -3.75, z: 108.45 + 1.05 });
  assert.deepEqual(cafeQueueSlot(6), { x: -2.25, z: 108.45 + 2 * 1.05 });
  // the queue stays inside the café parcel S, on walkable street-side ground
  for (let i = 0; i < 9; i++) { const p = cafeQueueSlot(i); assert.equal(parcelAt(p.x, p.z)?.id, 'S', `slot ${i}`); }
});

test('layout: venue lots — queue slots, seats and frames sit on the street, never on café parcels', () => {
  assert.equal(venueQueueSlot('cafe', 0), null);
  assert.equal(venueQueueSlot('__proto__', 0), null);
  assert.equal(venueQueueSlot(undefined, 0), null);
  for (const id of ['tea', 'lemon', 'bar']) {
    const lot = VENUE_LOTS[id];
    assert.deepEqual(venueQueueSlot(id, 0), lot.queue.head);
    assert.deepEqual(venueQueueSlot(id, 1), { x: lot.cx - .75, z: 108.5 });
    assert.deepEqual(venueQueueSlot(id, 2), { x: lot.cx + .75, z: 108.5 });
    assert.deepEqual(venueQueueSlot(id, 4), { x: lot.cx + .75, z: 108.5 + 1.05 });
    for (let i = 0; i < lot.queue.max; i++) {
      const p = venueQueueSlot(id, i);
      assert.equal(parcelAt(p.x, p.z), null, `${id} slot ${i} on a parcel`);
      assert.equal(shopAt(p.x, p.z), id);
      assert.equal(areaAt(p.x, p.z), 'cafe');
    }
    assert.equal(lot.seats.length, 8);
    for (const s of lot.seats) { assert.equal(parcelAt(s.x, s.z), null); assert.equal(shopAt(s.x, s.z), id); }
    for (const p of Object.values(PARCELS)) {
      const [a0, b0, a1, b1] = lot.rect, [c0, d0, c1, d1] = p.rect;
      assert.ok(!(a0 < c1 && a1 > c0 && b0 < d1 && b1 > d0), `${id} overlaps parcel ${p.id}`);
    }
    const [x0, , x1] = SHOP_FRAMES[id];
    assert.ok(x0 >= CAFE_BOUNDS.minX && x1 <= CAFE_BOUNDS.maxX);
  }
  assert.deepEqual(SHOP_ORDER, ['tea', 'cafe', 'lemon', 'bar']);
  assert.equal(shopAt(-3, 107.3), 'cafe');
  assert.equal(shopAt(0, 125), null);
  assert.ok(STREET_FRAME[0] >= CAFE_BOUNDS.minX && STREET_FRAME[2] <= CAFE_BOUNDS.maxX);
  assert.deepEqual(CAFE_ROADS.cafeFront.rect, [CAFE_BOUNDS.minX, 118.5, CAFE_BOUNDS.maxX, 121.5]);
});

test('i18n: venue, item, sign and speech keys exist in en and vi (speech variants match SAY_VARIANTS)', () => {
  const need = [
    ...Object.keys(VENUES).map(id => `venue.${id}`),
    ...Object.keys(VENUE_ITEMS).map(id => `item.${id}`),
    ...VENUE_ORDER.map(id => `hud.venue.desc.${id}`),
    'hud.street.overview', 'hud.street.focus', 'hud.venue.locked', 'hud.venue.open', 'hud.venue.needLevel', 'hud.venue.cost',
    'hud.venue.opened', 'hud.rating.title', 'hud.rating.aria', 'hud.toast.review', 'hud.toast.fight', 'hud.toast.crowd',
    'hud.toast.switch', 'hud.toast.closed', 'hud.toast.venueSale',
  ];
  for (const lang of ['en', 'vi']) for (const k of need) assert.ok(k in hud[lang], `${lang} ${k}`);
  for (const lang of ['en', 'vi']) {
    for (const id of VENUE_ORDER) assert.ok(`realm.venueSign.${id}` in realm[lang], `${lang} sign ${id}`);
    assert.ok('realm.venue.closedBoard' in realm[lang]);
    for (const [sit, n] of Object.entries(SAY_VARIANTS)) {
      for (let i = 1; i <= n; i++) assert.ok(typeof realm[lang][`realm.say.${sit}.${i}`] === 'string', `${lang} realm.say.${sit}.${i}`);
      assert.equal(realm[lang][`realm.say.${sit}.${n + 1}`], undefined, `${lang} realm.say.${sit} has more than ${n}`);
    }
  }
  assert.equal(hud.vi['hud.toast.review']({ name: 'Trà chanh', stars: 2, quote: 'Chờ mãi!' }), 'Trà chanh: ⭐⭐ “Chờ mãi!”');
});
