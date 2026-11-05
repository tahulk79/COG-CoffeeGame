// Economy simulation for V3: drives the real reducer (src/core/game.js) with a scripted "typical player".
// Usage: node scripts/economy-sim.mjs [minutes=60]   Prints the timeline (level ups, Level-10 reset, Round unlocks) and per-minute income.
// Also importable: `runSim(minutes)` returns the timeline and per-minute stats (used by tests/core/economy.test.mjs).
// Player model: taps every ~1.2 s, keeps all owned plots planted with the best unlocked crop, serves every customer,
// buys land/buildings/upgrades greedily keeping a reserve, unlocks Rounds as soon as affordable, never uses rebirth.
import { pathToFileURL } from 'node:url';
import { apply } from '../src/core/game.js';
import { createSave } from '../src/core/state.js';
import * as D from '../src/core/derive.js';
import { BUILDINGS, STAFF } from '../src/core/config/economy.js';
import { PARCEL_ORDER, PARCELS } from '../src/core/config/layout.js';

const TAP = 1200; // ms per player action (walk + tap)
const LOGGED = ['levelUp', 'expiryTriggered', 'roundUnlocked', 'parcelBought', 'built', 'regionExpired', 'regionEntered'];

/**
 * @param {number} minutes simulated minutes
 * @returns {{ start:number, end:number, state:object, log:Array<[number, object]>, perMinute:Array<object>, minCoins:number, failures:Object<string,number>, coinDelta:Object<string,number> }}
 *   log: [timestamp, event] for LOGGED events; perMinute[i]: snapshot at the end of minute i+1 (earnedThisMinute included);
 *   minCoins: lowest coin balance seen after any action; failures: "type:error" counts; coinDelta: net coins per action type.
 */
export function runSim(minutes = 60) {
  let now = 1_800_000_000_000;
  let s = createSave(now, { gender: 'female', name: 'Sim' });
  const log = [];
  const failures = {};
  const coinDelta = {}; // action type → net coin change from successful actions
  let minCoins = s.player.coins;
  const act = (type, payload = {}, txId) => {
    const r = apply(s, { type, payload, txId }, { now, dev: false });
    if (r.ok) {
      coinDelta[type] = Math.round(((coinDelta[type] || 0) + r.state.player.coins - s.player.coins) * 100) / 100;
      s = r.state;
      minCoins = Math.min(minCoins, s.player.coins);
      for (const e of r.events) if (LOGGED.includes(e.type)) log.push([now, e]);
    } else failures[`${type}:${r.error}`] = (failures[`${type}:${r.error}`] || 0) + 1;
    return r.ok && !r.noop && !r.duplicate;
  };
  act('story/introDone'); act('story/teacherDone'); act('world/enterRegion', { regionId: 'vn-1' });
  const start = now;
  let nextCustomer = now, lastMinute = 0, earnedAtLastMinute = s.stats.earned;
  const perMinute = [];
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function tryBuild() {
    for (const type of ['roaster', 'dryer', 'tables', 'kiosk', 'pastry']) {
      if (D.buildError(s, type)) continue;
      const def = BUILDINGS[type];
      const cands = def.zone === 'shop' ? [[2, 111], [4.5, 112.5], [1, 112], [5, 109.5], [10, 104], [12, 107], [15, 109]] : [[5, -4], [12, -4], [6, -6], [18, -5], [22, -5], [6, -14]];
      for (const [x, z] of cands) if (act('build/place', { type, x, z })) return true;
    }
    return false;
  }
  function tryUpgrade(reserve) {
    const list = [...D.region(s).buildings].sort((a, b) => (D.upgradeCost(a.type, a.level) ?? 1e12) - (D.upgradeCost(b.type, b.level) ?? 1e12));
    for (const b of list) { const c = D.upgradeCost(b.type, b.level); if (c != null && s.player.coins - c >= reserve && act('build/upgrade', { uid: b.uid })) return true; }
    return false;
  }
  while (now - start < minutes * 60000) {
    // Region expired → pick the next region of the start country.
    if (s.story.phase === 'expiry') act('expiry/execute');
    if (s.story.phase === 'chooseRegion') act('world/enterRegion', { regionId: 'vn-2' });
    // customers
    while (now >= nextCustomer) { act('shop/spawnCustomer', { roll: rnd() }); nextCustomer += D.region(s) ? D.arrivalMs(s) : 9000; }
    let did = false;
    // 1. serve ready cups, brew, take orders
    did = act('shop/serve') || act('shop/brew') || act('shop/takeOrder');
    // 2. harvest / plant
    if (!did) for (const p of D.ownedPlots(s)) {
      const st = D.plotState(s, p.id, now);
      if (st.stage === 'ready' && act('farm/harvest', { plotId: p.id })) { did = true; break; }
      if (st.stage === 'empty') {
        const crop = D.unlockedCrops(s).filter(c => D.seedCost(s, c) <= s.player.coins).pop();
        if (crop && act('farm/plant', { plotId: p.id, crop })) { did = true; break; }
      }
    }
    // 3. invest
    if (!did) {
      const rs = D.roundStatus(s);
      if (rs.next && rs.canUnlock) did = act('round/unlock', { round: rs.next }, `r${rs.next}`);
      // While saving for the next Round, only cheap investments (rebuilding a reset region) are made.
      const saving = rs.next && rs.levelOk;
      if (!did && (!saving || s.player.coins < rs.cost * 0.5)) {
        did = tryBuild();
        if (!did) for (const id of PARCEL_ORDER) { const road = PARCELS[id].road; if (road && !D.roadOpen(s, road)) act('land/openRoad', { roadId: road }); if (act('land/buyParcel', { parcelId: id })) { did = true; break; } }
        if (!did) did = tryUpgrade(30);
        if (!did) for (const t of ['farmhand', 'barista', 'sproutBot', 'brewBot']) if (D.freeSlots(s, STAFF[t].zone) > 0 && act('staff/hire', { type: t })) { did = true; break; }
      }
    }
    now += did ? TAP : 500;
    const minute = Math.floor((now - start) / 60000);
    if (minute > lastMinute) {
      perMinute.push({ minute, coins: Math.round(s.player.coins), earned: Math.round(s.stats.earned), earnedThisMinute: Math.round(s.stats.earned - earnedAtLastMinute),
        level: D.level(s), round: s.player.round, beans: s.inventory.beans, served: s.stats.served, region: s.world.currentRegion, phase: s.story.phase });
      earnedAtLastMinute = s.stats.earned;
      lastMinute = minute;
    }
  }
  return { start, end: now, state: s, log, perMinute, minCoins, failures, coinDelta };
}

function printReport({ start, state: s, log, perMinute }) {
  const fmt = ms => `${Math.floor((ms - start) / 60000)}m${String(Math.floor((ms - start) / 1000) % 60).padStart(2, '0')}s`;
  console.log('TIMELINE');
  for (const [t, e] of log) console.log(fmt(t), e.type, JSON.stringify({ ...e, type: undefined }));
  console.log('\nPER 5 MIN');
  let prev = 0;
  for (const row of perMinute.filter(r => r.minute % 5 === 0)) { console.log(`${String(row.minute).padStart(3)}m  L${row.level} R${row.round}  coins ${row.coins}  earned/min ${Math.round((row.earned - prev) / 5)}  beans ${row.beans}  served ${row.served}`); prev = row.earned; }
  console.log('\nSUMMARY', JSON.stringify({ level: D.level(s), round: s.player.round, coins: Math.round(s.player.coins), served: s.stats.served, harvested: s.stats.harvested, parcels: s.stats.parcels, region: s.world.currentRegion }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printReport(runSim(Number(process.argv[2] || 60)));
}
