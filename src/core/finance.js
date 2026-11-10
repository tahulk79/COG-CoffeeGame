// What the finance screens read: one city's money, health and warnings, and the account overview. Everything comes from
// the wallets and the day books (core/wallet.js); USD and Gold are never added together.
import * as D from './derive.js';
import * as W from './wallet.js';
import { WALLET, UPKEEP, CROPS, BUILD_MENU_FARM, BUILDINGS } from './config/economy.js';
import { ESTATE_ORDER } from './config/layout.js';
import { parseRegionId } from './config/world.js';

/** The save as if the player stood in `regionId`, so the per-city rules can be asked about any owned city. */
const viewOf = (s, regionId) => (regionId === s.world.currentRegion ? s
  : { ...s, world: { ...s.world, currentRegion: regionId }, player: { ...s.player, coins: W.goldOf(s, regionId) } });

const upkeepPerMin = (s, regionId) => D.assignedUnits(s, regionId).reduce((n, u) => n + D.upkeepOf(u), 0) / UPKEEP.perMinutes;

function cantBuy(view) {
  const r = D.region(view), gold = view.player.coins;
  if (r?.mode === 'cafe') return null;
  const seeds = D.unlockedCrops(view).map(c => CROPS[c].seedCost);
  if (seeds.length && gold < Math.min(...seeds)) return 'seed';
  const builds = BUILD_MENU_FARM.filter(t => !BUILDINGS[t]?.decor).map(t => D.buildError(view, t)).filter(e => e === 'coins' || e === null);
  return builds.length && builds.every(e => e === 'coins') ? 'build' : null;
}

/** Warnings for one farm, worst first. `go` says where a tap leads: 'fund' (the capital sheet) or 'farm' (the farm's money details). */
export function farmAlerts(s, regionId, now) {
  const out = [], view = viewOf(s, regionId), r = D.region(view);
  if (!r || r.status === 'expired') return out;
  const gold = view.player.coins, burn = upkeepPerMin(s, regionId);
  if (burn > 0 && gold / burn < WALLET.runwayMinutes) out.push({ kind: 'lowGold', severity: 'high', go: 'fund', minutes: Math.floor(gold / burn) });
  const what = cantBuy(view);
  if (what) out.push({ kind: 'cantBuy', severity: 'high', go: 'fund', what });
  const week = W.periodOf(s, regionId, WALLET.defaultPeriod, now);
  if (week.spent >= WALLET.lossMinSpent && week.spent > week.earned) out.push({ kind: 'loss', severity: 'medium', go: 'farm', loss: Math.round(week.spent - week.earned) });
  const next = r.mode === 'cafe' ? null : D.nextEstate(view);
  if (next && D.level(view) >= next.level && gold < next.cost) out.push({ kind: 'needCapital', severity: 'low', go: 'fund', missing: Math.ceil(next.cost - gold), estate: next.id });
  return out;
}

export function farmCard(s, regionId, now, days = WALLET.defaultPeriod) {
  const view = viewOf(s, regionId), r = D.region(view), alerts = farmAlerts(s, regionId, now);
  const units = r ? D.assignedUnits(s, regionId) : [], plots = r ? Object.keys(r.plots).length : 0;
  const status = !r ? 'unopened' : alerts.some(a => a.severity === 'high') ? 'trouble' : units.length || plots ? 'running' : 'idle';
  const tier = r && r.mode !== 'cafe' ? ESTATE_ORDER.filter(e => D.estateOwned(view, e)).length : null;
  return { id: regionId, countryId: parseRegionId(regionId)?.countryId || null, gold: view.player.coins, mode: r?.mode || null, status, tier, tierMax: ESTATE_ORDER.length,
    units: units.length, plots, period: W.periodOf(s, regionId, days, now), alerts, current: regionId === s.world.currentRegion };
}

export function overview(s, now, days = WALLET.defaultPeriod) {
  const cards = W.farmIds(s).map(id => farmCard(s, id, now, days));
  const add = k => Math.round(cards.reduce((n, c) => n + c.period[k], 0) * 100) / 100;
  return { usdCents: W.usdOf(s), gold: W.totalGold(s), farms: cards.length, running: cards.filter(c => c.status === 'running' || c.status === 'trouble').length,
    earned: add('earned'), spent: add('spent'), profit: add('profit'), attention: cards.filter(c => c.alerts.length).length, cards };
}
