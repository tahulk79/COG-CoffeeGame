// "What should this farm build next?": one line on top of each tab of the farm's Build sheet, read from the save. The order follows
// what the manager builds first (derive.js gmBuildNeeds: storage, water, processing for the harvest, machines), so the advice and
// the manager never disagree on what is basic. It only advises: nothing here spends or changes anything.
import { BUILDINGS, CROP_ORDER, CROPS, GOODS, RECIPES, doesJob } from '../../core/config/economy.js';
import { ESTATES } from '../../core/config/layout.js';
import { assignedUnits, beanPrice, buildCost, buildError, capacity, countOf, dripCovers, fieldAllowance, nextEstate, ownedPlots, parcelCost, parcelError, region, shadeStars, stored, wellBonus } from '../../core/derive.js';
import { h } from './dom.js';
import { T, fmt } from './text.js';
import { bestCrops } from './plant-note.js';

const STATION_PER_FIELDS = 15; // one drying or washing station for this many planted fields (as the manager counts them)
const MIN_FIELDS_MISSING = 3;  // a water or drip tip waits until this many fields would gain from it

/** Buildable now, or as soon as the coins are there. */
const can = (s, type) => { const e = buildError(s, type); return !e || e === 'coins'; };
const build = (s, type, why, params = {}) => ({ type, why, params: { ...params }, short: buildError(s, type) === 'coins' });

/** The variety most planted here (the first one on a bare farm). */
function mainCrop(s, plots) {
  const r = region(s), n = {};
  for (const p of plots) { const c = r.plots[p.id]?.crop; if (c) n[c] = (n[c] || 0) + 1; }
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || CROP_ORDER[0];
}

function processingTip(s, plots, planted) {
  const cap = capacity(s), full = cap > 0 ? stored(s) / cap : 0;
  if (!countOf(s, 'silo') && can(s, 'silo')) return build(s, 'silo', 'silo');
  if (full >= .8 && can(s, 'silo')) return build(s, 'silo', 'siloFull', { pct: Math.floor(full * 20) * 5 });
  if (!planted) return { why: 'plantFirst', params: {} };
  const stations = countOf(s, 'dryer') + countOf(s, 'wetMill');
  if (!stations && can(s, 'dryer')) {
    const crop = mainCrop(s, plots), raw = beanPrice(crop), dried = GOODS.dried.price + Math.max(0, raw - GOODS.beans.price) * (RECIPES.dry.premium || 0);
    return build(s, 'dryer', 'dry', { crop: T(`crop.${crop}`), a: fmt(raw), b: fmt(dried) });
  }
  if (stations < Math.ceil(planted / STATION_PER_FIELDS)) {
    if (planted >= 12 && !countOf(s, 'wetMill') && can(s, 'wetMill')) return build(s, 'wetMill', 'wash', { n: planted });
    if (can(s, 'dryer')) return build(s, 'dryer', 'dryMore', { n: planted });
  }
  const crew = assignedUnits(s, s.world.currentRegion, 'farm');
  if (!countOf(s, 'pulper') && stations && crew.some(u => doesJob(u, 'process')) && can(s, 'pulper')) return build(s, 'pulper', 'pulper');
  const dry = plots.filter(p => region(s).plots[p.id] && !dripCovers(s, p.id)).length;
  if (dry >= 6 && can(s, 'dripLine')) return build(s, 'dripLine', 'drip', { n: dry });
  return { why: 'enough', params: {} };
}

function gardenTip(s, plots, planted) {
  if (!planted) return { why: 'plantFirst', params: {} };
  const r = region(s), growing = plots.filter(p => r.plots[p.id]);
  const far = growing.filter(p => wellBonus(s, p.id) <= 0).length;
  if (far >= MIN_FIELDS_MISSING && can(s, 'well')) return build(s, 'well', 'well', { n: far, pct: Math.round(BUILDINGS.well.effect.grow[0] * 100) });
  const unshaded = growing.filter(p => { const c = r.plots[p.id].crop; return BUILDINGS.shadeTree.effect.crops.includes(c) && shadeStars(s, p.id, c) <= 0; });
  const tree = ['shadeTree', 'cordia'].find(t => can(s, t));
  if (unshaded.length && tree) return build(s, tree, 'shade', { n: unshaded.length, crop: T(`crop.${r.plots[unshaded[0].id].crop}`) });
  return { why: 'gardenEnough', params: {} };
}

function landTip(s, plots, planted) {
  const e = nextEstate(s);
  if (!e) return { why: 'landAll', params: {} };
  const free = Math.max(0, fieldAllowance(s) - countOf(s, 'field')) + (plots.length - planted);
  if (free > 0) return { why: 'landFill', params: { n: free } };
  const name = T(`estate.${e.id}`), err = parcelError(s, e.seed);
  if (err === 'level') return { why: 'landLevel', params: { name, level: ESTATES[e.id].level } };
  return { head: 'land', why: 'landBuy', land: name, short: err === 'coins', params: { coins: fmt(parcelCost(e.seed)), crops: bestCrops(s, e.zone).map(c => T(`crop.${c}`)).join(', ') } };
}

/** The tip of one Build tab, or null when the tab has its own (Sow) or the screen is not the farm's. A plain object: it is also part of the sheet's signature. */
export function buildTip(s, tab) {
  if (!region(s)) return null;
  const plots = ownedPlots(s), planted = plots.filter(p => region(s).plots[p.id]).length;
  return tab === 'processing' ? processingTip(s, plots, planted) : tab === 'garden' ? gardenTip(s, plots, planted) : tab === 'land' ? landTip(s, plots, planted) : null;
}

/** The note above the cards. */
export function buildTipNote(tip) {
  if (!tip) return null;
  const head = tip.type ? T('hud.buildTip.build', { name: T(`building.${tip.type}`), cost: '' }) : tip.land ? T('hud.buildTip.buy', { name: tip.land }) : T('hud.buildTip.head');
  return h('div', { class: 'hud-plantnote hud-buildtip' }, h('strong', null, `💡 ${head}`),
    h('p', null, T(`hud.buildTip.${tip.why}`, tip.params), tip.short ? ` ${T('hud.buildTip.save')}` : ''));
}
