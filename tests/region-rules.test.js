// Luật theo loại nơi (audit 04/11, QA-4): both = vn/br, farm = co/ke/id, cafe = it/jp/us.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { questsFor, HUD_UNLOCKS } from '../src/features/farm/content.js';
import { regionType } from '../src/features/world-map/content.js';
const AT = 100000, hud = id => HUD_UNLOCKS.find(u => u.id === id);
const KINDS = { both: 'vn', farm: 'ke', cafe: 'it' };

test('regionType maps vn/ke/it to both/farm/cafe', () => {
  for (const [type, id] of Object.entries(KINDS)) assert.equal(regionType(id), type);
});
test('cafe-play and order-board unlock only in "both" regions', () => {
  for (const [type, id] of Object.entries(KINDS)) {
    const p = createFarm(null, 'capital', () => {}, AT, [], id).progress;
    p.claimed = ['harvest', 'serve', 'sell', 'ship']; p.stats.served = 5; p.orders = [{ id: 'o' }];
    for (const u of ['cafe-play', 'order-board']) assert.equal(hud(u).when(p, 1), type === 'both', `${u} in ${type}`);
  }
});
test('questsFor: farm has no serve/ship, cafe keeps only serve, both has all', () => {
  const ids = id => questsFor(id).map(q => q.id);
  assert.ok(!ids('ke').includes('serve') && !ids('ke').includes('ship'));
  assert.ok(ids('ke').includes('ke-roast'), 'region-specific quests are appended');
  const cafe = ids('it');
  assert.ok(cafe.includes('serve') && !cafe.includes('ship') && !cafe.includes('harvest') && cafe.includes('it-espresso'));
  assert.ok(ids('vn').includes('serve') && ids('vn').includes('ship') && ids('vn').includes('vn-phin'));
});
test('gift seeds/tools become capital where unusable, kept where usable', () => {
  const p = (gift, id) => createFarm(null, gift, () => {}, AT, [], id).progress;
  assert.ok(p('seeds', 'vn').seeds.robusta > p('capital', 'vn').seeds.robusta, 'seeds kept in both');
  assert.equal(p('seeds', 'ke').fertilizer > p('capital', 'ke').fertilizer, true, 'seeds kept in farm');
  assert.equal(p('seeds', 'it').coins, p('capital', 'it').coins);
  assert.equal(p('tools', 'ke').coins, p('capital', 'ke').coins);
  assert.ok(p('tools', 'it').upgrades.cafe >= 2, 'tools kept in cafe');
});
