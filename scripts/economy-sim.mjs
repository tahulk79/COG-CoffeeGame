// Economy simulation: drives the REAL reducer (src/core/game.js) with a scripted "typical player".
// Usage: node scripts/economy-sim.mjs [minutes=60] [game=both|farm|cafe] [process=1|0]
//   prints the timeline (level ups, Level-10 reset, land, builds), per-5-minute income and a summary.
// Importable: runSim(minutes, { game, process, tap }) → timeline + per-minute stats (tests/core/economy.test.mjs).
//
// Player model (FARM-ECONOMY-BALANCE.md §5): one action every `tap` ms (walk + tap, 1.2 s default).
//  · game 'both' (default, the historical guard): the region's game is never picked, farm and café run together.
//  · game 'farm' / 'cafe': the approved one-game-per-region play (play/chooseGame), the other game's actions are refused.
// Every 15 s of play it first tries one investment (players shop between taps). Then each beat: café (serve > brew >
// take order) · collect a finished batch · harvest · plant · start the most
// downstream batch whose inputs are in stock · sell (finished goods; raw beans only when nothing can process them or the
// storehouse is ≥ 85 % full) · invest (land in order, then buildings, upgrades, hires) keeping a small reserve.
// Buildings are placed with the same placementError the ghost uses, scanning owned lots (never hard-coded spots).
// process: false = the same player but never builds processing (to measure what production adds).
import { pathToFileURL } from 'node:url';
import { apply } from '../src/core/game.js';
import { createSave } from '../src/core/state.js';
import * as D from '../src/core/derive.js';
import { BUILDINGS, STAFF, PLAYTEST, RECIPES } from '../src/core/config/economy.js';
import { PARCEL_ORDER, PARCELS, areaOfParcel } from '../src/core/config/layout.js';

PLAYTEST.coins = 0; // the sim measures the balanced economy, not the founder's playtest coins

const LOGGED = ['levelUp', 'expiryTriggered', 'parcelBought', 'built', 'regionExpired', 'regionEntered', 'fieldPlaced'];
const CAFE_BUILD = ['roaster', 'tables', 'kiosk', 'pastry'];
const STAGES = ['pack', 'roast', 'dry']; // most downstream first: finish goods before starting new ones

/**
 * @param {number} minutes simulated minutes
 * @param {{game?: 'both'|'farm'|'cafe', process?: boolean, tap?: number}} [opts]
 */
export function runSim(minutes = 60, { game = 'both', process = true, tap = 1200 } = {}) {
  let now = 1_800_000_000_000;
  let s = createSave(now, { gender: 'female', name: 'Sim' });
  const log = [];
  const failures = {};
  const coinDelta = {};   // action type → net coin change from successful actions
  const income = {};      // income source → coins (served, beansSold, goodsSold by good)
  const counts = {};      // action type → successful count
  let minCoins = s.player.coins;
  const act = (type, payload = {}) => {
    const r = apply(s, { type, payload }, { now, dev: false });
    if (r.ok && !r.noop) {
      coinDelta[type] = Math.round(((coinDelta[type] || 0) + r.state.player.coins - s.player.coins) * 100) / 100;
      counts[type] = (counts[type] || 0) + 1;
      s = r.state;
      minCoins = Math.min(minCoins, s.player.coins);
      for (const e of r.events) {
        if (LOGGED.includes(e.type)) log.push([now, e]);
        if (e.type === 'served') income.served = (income.served || 0) + e.coins;
        if (e.type === 'goodsSold') for (const p of e.parts) income[p.good] = (income[p.good] || 0) + p.coins;
      }
    } else if (!r.ok) failures[`${type}:${r.error}`] = (failures[`${type}:${r.error}`] || 0) + 1;
    return r.ok && !r.noop && !r.duplicate;
  };
  const enter = regionId => {
    act('world/unlockRegion', { regionId });
    act('world/enterRegion', { regionId });
    if (game !== 'both') act('play/chooseGame', { game });
  };
  act('story/introDone'); act('story/teacherDone');
  enter(game === 'cafe' ? 'fr-1' : 'vn-1');
  const start = now;
  const playsFarm = game !== 'cafe', playsCafe = game !== 'farm';
  let nextCustomer = now, nextInvest = now + 15000, lastMinute = 0, earnedAtLastMinute = s.stats.earned;
  const perMinute = [];
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // First free spot for `type` in the owned lots of its area (same validity as the placement ghost).
  function spot(type) {
    const def = D.defOf(type);
    const area = def.zone === 'shop' ? 'cafe' : 'farm';
    for (const id of D.region(s).parcels) {
      if (areaOfParcel(id) !== area && def.zone !== 'any') continue;
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      for (let z = z0; z <= z1; z += .5) for (let x = x0; x <= x1; x += .5) {
        const q = D.snapPosition(type, x, z, 0);
        if (D.placementError(s, type, q.x, q.z, 0) === null) return q;
      }
    }
    return null;
  }
  const build = type => { if (D.buildError(s, type)) return false; const q = spot(type); return !!q && act('build/place', { type, ...q }); };
  const reserve = () => 10 + 3 * D.ownedPlots(s).length; // enough to replant every field
  // The next workshop of the chain the player saves for (unlocked, not built yet), or null.
  // Land first while it is the cheaper way to grow; once the next field lot costs more than the workshop, save for it.
  const nextLand = () => PARCEL_ORDER.map(id => PARCELS[id]).find(p => areaOfParcel(p.id) === 'farm' && p.kind === 'farm' && !D.region(s).parcels.includes(p.id)) || null;
  const goal = () => {
    if (!playsFarm || !process) return null;
    const t = ['dryer', 'roastery', 'packer'].find(x => D.countOf(s, x) === 0 && !['level', 'round', 'unknown', 'gameLocked'].includes(D.buildError(s, x)));
    return t && (!nextLand() || nextLand().cost >= D.buildCost(s, t)) ? t : null;
  };
  const canSpend = cost => s.player.coins - cost >= reserve() + (goal() ? D.buildCost(s, goal()) : 0);
  function invest() {
    const r = D.region(s);
    // Processing first once unlocked (one of each, then a 2nd drying yard when beans pile up), storage when it is tight.
    if (playsFarm && process) {
      const g = goal();
      if (g && s.player.coins - D.buildCost(s, g) >= reserve() && build(g)) return true;
      if (D.countOf(s, 'well') === 0 && s.player.coins - D.buildCost(s, 'well') >= 2 * reserve() && build('well')) return true;
      if (D.stored(s) >= D.capacity(s) * .8 && canSpend(D.buildCost(s, 'warehouse')) && build('warehouse')) return true;
      const idleBeans = s.inventory.beans >= RECIPES.dry.in.beans && D.buildingsOf(s, 'dryer').every(b => b.job);
      if (idleBeans && canSpend(D.buildCost(s, 'dryer')) && build('dryer')) return true;
      const idleDried = D.goodCount(s, 'dried') >= 2 * RECIPES.roast.in.dried && D.buildingsOf(s, 'roastery').every(b => b.job);
      if (idleDried && canSpend(D.buildCost(s, 'roastery')) && build('roastery')) return true;
    }
    if (playsCafe) for (const type of CAFE_BUILD) if (D.countOf(s, type) === 0 && s.player.coins - D.buildCost(s, type) >= 30 && build(type)) return true;
    if (playsFarm) for (const id of PARCEL_ORDER) {
      const p = PARCELS[id];
      if (areaOfParcel(id) !== 'farm' || r.parcels.includes(id) || p.kind !== 'farm') continue;
      if (canSpend(p.cost) && act('land/buyParcel', { parcelId: id })) return true;
      break; // land in order: wait for the next one
    }
    if (playsCafe) for (const id of ['C2', 'C3']) if (!r.parcels.includes(id) && s.player.coins - PARCELS[id].cost >= 30 && act('land/buyParcel', { parcelId: id })) return true;
    // Upgrades: workshops first (a bigger batch halves the taps per bean), then the cheapest.
    const list = [...r.buildings].filter(b => (playsFarm || BUILDINGS[b.type].zone !== 'farm') && (playsCafe || BUILDINGS[b.type].zone !== 'shop'))
      .sort((a, b) => (!!BUILDINGS[b.type].recipe - !!BUILDINGS[a.type].recipe) || (D.upgradeCost(a.type, a.level) ?? 1e12) - (D.upgradeCost(b.type, b.level) ?? 1e12));
    for (const b of list) { const c = D.upgradeCost(b.type, b.level); if (c != null && canSpend(c) && act('build/upgrade', { uid: b.uid })) return true; }
    for (const t of ['farmhand', 'barista', 'sproutBot', 'brewBot']) {
      const zone = STAFF[t].zone;
      if ((zone === 'farm' && !playsFarm) || (zone === 'shop' && !playsCafe)) continue;
      if (D.freeSlots(s, zone) > 0 && canSpend(STAFF[t].cost) && act('staff/hire', { type: t })) return true;
    }
    return false;
  }
  function sell() {
    if (!playsFarm) return false;
    const has = type => D.countOf(s, type) > 0;
    const goods = { bag: true, roasted: !has('packer'), dried: !has('roastery') };
    for (const [good, ok] of Object.entries(goods)) if (ok && D.goodCount(s, good) > 0 && act('farm/sell', { good })) return true;
    const full = D.stored(s) >= D.capacity(s) * .85;
    // Raw beans: sold when nothing processes them, when storage is tight, or what the yards cannot take soon.
    const keep = has('dryer') && process ? RECIPES.dry.in.beans * Math.max(1, D.countOf(s, 'dryer')) : 0;
    if (s.inventory.beans > keep && (full || !has('dryer') || !process) && act('farm/sell', { good: 'beans', amount: s.inventory.beans - keep })) return true;
    if (full && act('farm/sellAll')) return true;
    return false;
  }

  while (now - start < minutes * 60000) {
    if (s.story.phase === 'expiry') act('expiry/execute');
    if (s.story.phase === 'chooseRegion') enter(game === 'cafe' ? 'jp-1' : 'br-1');
    // customers
    if (playsCafe) while (now >= nextCustomer) { act('shop/spawnCustomer', { roll: rnd() }); nextCustomer += D.region(s) ? D.arrivalMs(s) : 9000; }
    let did = false;
    // 0. a real player opens the build / land menus now and then even while busy (every 15 s of play)
    if (now >= nextInvest) { nextInvest = now + 15000; did = invest(); }
    // 1. café: serve ready cups, brew, take orders
    // A café-only region has no farm: it imports beans from the supplier before a cup runs short (latte = 3 beans).
    if (!did && game === 'cafe' && s.inventory.beans < 3) did = act('shop/buyBeans');
    if (!did && playsCafe) did = act('shop/serve') || act('shop/brew') || act('shop/takeOrder');
    // 2. production: collect finished batches
    if (!did && playsFarm) for (const b of D.region(s).buildings) if (b.job && D.jobState(b, now).stage === 'ready' && act('prod/collect', { uid: b.uid })) { did = true; break; }
    // 3. harvest / plant
    if (!did && playsFarm) for (const p of D.ownedPlots(s)) {
      const st = D.plotState(s, p.id, now);
      if (st.stage === 'ready' && act('farm/harvest', { plotId: p.id })) { did = true; break; }
      if (st.stage === 'empty') {
        const crop = D.unlockedCrops(s).filter(c => D.seedCost(s, c) <= s.player.coins).pop();
        if (crop && act('farm/plant', { plotId: p.id, crop })) { did = true; break; }
      }
    }
    // 4. start batches (downstream first)
    if (!did && playsFarm && process) {
      outer: for (const stage of STAGES) for (const b of D.region(s).buildings) {
        if (BUILDINGS[b.type]?.recipe !== stage || b.job) continue;
        if (!D.prodError(s, b) && act('prod/start', { uid: b.uid })) { did = true; break outer; }
      }
    }
    // 5. sell, 6. invest
    if (!did) did = sell();
    if (!did) did = invest();
    now += did ? tap : 500;
    const minute = Math.floor((now - start) / 60000);
    if (minute > lastMinute) {
      perMinute.push({ minute, coins: Math.round(s.player.coins), earned: Math.round(s.stats.earned), earnedThisMinute: Math.round(s.stats.earned - earnedAtLastMinute),
        level: D.level(s), round: s.player.round, beans: s.inventory.beans, stored: D.stored(s), capacity: D.capacity(s), served: s.stats.served,
        batches: s.stats.produced || 0, region: s.world.currentRegion, phase: s.story.phase });
      earnedAtLastMinute = s.stats.earned;
      lastMinute = minute;
    }
  }
  return { start, end: now, state: s, log, perMinute, minCoins, failures, coinDelta, income, counts, game, process };
}

function printReport({ start, state: s, log, perMinute, income, counts, game, process }) {
  const fmt = ms => `${Math.floor((ms - start) / 60000)}m${String(Math.floor((ms - start) / 1000) % 60).padStart(2, '0')}s`;
  console.log(`GAME ${game}  process=${process}\nTIMELINE`);
  for (const [t, e] of log) console.log(fmt(t), e.type, JSON.stringify({ ...e, type: undefined }));
  console.log('\nPER 5 MIN');
  let prev = 0;
  for (const row of perMinute.filter(r => r.minute % 5 === 0)) { console.log(`${String(row.minute).padStart(3)}m  L${row.level}  coins ${row.coins}  earned/min ${Math.round((row.earned - prev) / 5)}  stored ${row.stored}/${row.capacity}  batches ${row.batches}  served ${row.served}`); prev = row.earned; }
  console.log('\nINCOME', JSON.stringify(income), '\nACTIONS', JSON.stringify(counts));
  console.log('SUMMARY', JSON.stringify({ level: D.level(s), coins: Math.round(s.player.coins), served: s.stats.served, harvested: s.stats.harvested, batches: s.stats.produced || 0, parcels: s.stats.parcels, region: s.world.currentRegion }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [m = 60, g = 'both', p = '1'] = process.argv.slice(2);
  printReport(runSim(Number(m), { game: g, process: p !== '0' }));
}
