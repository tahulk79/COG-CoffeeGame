// Sheet contents: Build (café), Seeds (farm), Menu (café drinks) and Progress (Round + Rebirth). Staff: staff-modal.js.
// Pure render functions of the store state. Each screen has its own toolbar (toolbar.js), so sheets filter by view.
import { BUILD_MENU, BUILD_MENU_FARM, BUILD_MENU_CAFE, BUILDINGS, CATEGORY_ORDER, AUTO, autoPrice, CROPS, CROP_ORDER, STAFF, STAFF_ORDER, LOAN, loanOwed, loanRate, DRINKS, DRINK_ORDER, BEANS } from '../../core/config/economy.js';
import { goodCount, sellQuote, sellAllQuote, beanMix, buildError, buildingLevel, defOf, useOf, countOf, maxCount, nextLimitLevel, buildCost, fieldAllowance, parcelError, estateOwned, nextEstate, stored, cropUnlocked, drinkUnlocked, drinkPrice, brewMs, seedCost, level, region, capacity, beanBuyQuote, upgradeError, upgradeCost, loanOf, loanError, loanTerm, loanMinLeft, creditLimit, loanTotal, loansOf } from '../../core/derive.js';
import { PARCELS, terrainOfLot, ESTATES, ESTATE_ORDER, ESTATE_FIELDS } from '../../core/config/layout.js';
import { newTxId } from '../../core/store.js';
import { questList, questCount } from '../../core/quests.js';
import { h } from './dom.js';
import { localItemsOf } from '../../ui/local-menu.js';
import { INGREDIENTS, INGREDIENT_ORDER, RESEARCH } from '../../core/config/research.js';
import { autoBook } from '../../core/derive.js';
import { countryNow, recipeKnown, recipeFound, ingredientUnlocked, testCost, testError, benchBusyIn, suppliersFound, scoutOf, contractOf, supplyOf, contractFee, buyerNow, regionGame, dayKey, methodOf, trialsHere, trialSlots, trialResults, trialError, trialField, plotState } from '../../core/derive.js';
import { SUPPLY, supplierOf, buyerOf, FARMLAB, methodEffect, methodKey } from '../../core/config/research.js';
import { GOODS, GOOD_ORDER } from '../../core/config/economy.js';
import { T, fmt, duration, has, clock } from './text.js';
import { modelIcon } from './model-icons.js';
import { buildingEffect } from './effects.js';
import { plantNote, focusArea } from './plant-note.js';
import { buildTip, buildTipNote } from './build-tip.js';
import { usdOf, centsForGold, goldForCents } from '../../core/wallet.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';

// ---------- Build (construction catalog) ----------
// Category tabs (CATEGORY_ORDER[view]; the farm adds a Land tab) over a grid of compact cards: big icon, name, cost and
// one line of benefit, with a small n/max chip. States: available · can't afford (cost in red, a tap says how many coins
// are missing) · locked by level ("Lv N") · maxed ("More at Lv N" / "Max built"). An available card closes the sheet
// and starts placing (data-hud-id="build-<type>" is the tutorial's target). The last tab per screen is remembered
// (memory only). Never BUILDINGS[type] for a menu entry: 'field' lives in FIELD (D.defOf).
export const CAT_ICON = { plant: '🌱', garden: '🌿', farming: '🌱', processing: '🏭', storage: '📦', infrastructure: '💧', decoration: '🌼', cafe: '☕', land: '🏷️' };
export const TERRAIN_ICON = { meadow: '🌾', garden: '🌷', pasture: '🐄', orchard: '🍎', pond: '🦆', hill: '⛰️', shop: '☕', road: '🛤️', plaza: '⛩️', wild: '🌿' };
export const buildView = ctx => (ctx.realm?.view === 'cafe' ? 'cafe' : 'farm');
// Farm menu = what a real coffee farm needs, in 4 tabs: sow · process & store · garden & infrastructure · land.
export const buildTabs = view => (view === 'farm' ? ['plant', 'processing', 'garden', 'land'] : [...(CATEGORY_ORDER[view] || [])]);
const catOf = (view, cat) => (view !== 'farm' ? cat : cat === 'storage' ? 'processing' : cat === 'infrastructure' || cat === 'decoration' ? 'garden' : cat);
const buildMenu = view => (view === 'cafe' ? BUILD_MENU_CAFE : BUILD_MENU_FARM);
/** The catalog tab shown for the current screen (last one picked, else the first). */
export function buildTab(ctx) {
  const view = buildView(ctx), tabs = buildTabs(view), t = ctx.buildTab?.[view];
  return tabs.includes(t) ? t : tabs[0];
}
export function setBuildTab(ctx, tab) {
  const view = buildView(ctx);
  const t = catOf(view, tab);
  if (buildTabs(view).includes(t)) ctx.buildTab = { ...(ctx.buildTab || {}), [view]: t };
}

// What one card shows (also its signature part). null = not offered here (other game / starter / retired).
function cardModel(s, type) {
  const def = defOf(type);
  if (!def || !region(s)) return null;
  const err = buildError(s, type);
  if (err === 'gameLocked' || err === 'unknown') return null;
  const count = countOf(s, type), max = maxCount(s, type), cost = buildCost(s, type);
  const m = { type, cat: def.category, err, count, max, cost };
  if (err === 'limit') m.next = nextLimitLevel(s, type);
  if (type === 'field' && cost === 0) m.freeLeft = Math.max(0, fieldAllowance(s) - count);
  return m;
}
// A tab gets a dot when it holds something new to build: affordable, unlocked, none built yet (not decor).
const isNew = m => !m.err && m.count === 0 && m.max >= 1 && useOf(m.type) !== 'decor';

/** Tapping a catalog card: place it, or say why not (fresh state: the sheet may not have rebuilt since). */
function pickCard(ctx, type) {
  const s = ctx.store.state, def = defOf(type);
  const err = buildError(s, type);
  if (!err) {
    if (ctx.blockedByAuto?.()) return;
    const near = ctx.buildNear || null; // opened from the land card: start the ghost at the tapped spot
    ctx.sheet.close();
    ctx.realm?.startPlacement?.(type, near ? { near } : undefined);
    return;
  }
  const text = err === 'coins' ? needMore(buildCost(s, type) - Math.floor(s.player.coins))
    : err === 'level' ? T('err.level', { minLevel: def.level })
    : err === 'limit' ? T('err.limit', { level: nextLimitLevel(s, type) })
    : T(`err.${err}`);
  ctx.toast(text, 'bad');
}

// The card's picture: the building's own model (rendered once), the emoji while it loads / when it has no model
function cardIcon(def) {
  const el = h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, def.icon);
  modelIcon(def).then(url => { if (!url) return; const img = Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false }); img.className = 'hud-card-model'; el.classList.add('has-model'); el.replaceChildren(img); });
  return el;
}
function catalogCard(ctx, m, tipType = null) {
  const def = defOf(m.type), name = T(`building.${m.type}`);
  const desc = has(`fw.desc.${m.type}`) ? T(`fw.desc.${m.type}`) : useOf(m.type) === 'decor' ? T('fw.desc.decor') : buildingEffect(m.type, 1, false); // its own description first, the generic decor line only as a fallback
  let state = '', foot;
  if (m.err === 'round') { state = 'locked'; foot = lockTag(T('hud.roundN', { round: def.round })); }
  else if (m.err === 'level') { state = 'locked'; foot = lockTag(T('fw.catalog.unlockAt', { level: def.level })); }
  else if (m.err === 'limit') { state = 'maxed'; foot = h('span', { class: 'hud-tag hud-tag--max' }, m.next ? T('fw.catalog.nextAt', { level: m.next }) : T('fw.catalog.maxed')); }
  else if (m.freeLeft != null) foot = h('span', { class: 'hud-cost hud-cost--free' }, T('fw.field.free', { n: m.freeLeft }));
  else foot = coinAmount(m.cost, m.err === 'coins' ? 'is-short' : '');
  const price = m.freeLeft != null ? T('hud.free') : fmt(m.cost);
  return h('button', { type: 'button', class: `hud-card hud-cat-card${state ? ` is-${state}` : ''}${m.err === 'coins' ? ' is-short' : ''}${m.type === tipType ? ' is-tip' : ''}`,
    dataset: { hudId: `build-${m.type}` }, attrs: { 'aria-disabled': state ? 'true' : null, 'aria-label': `${name} · ${state ? foot.textContent : price}` },
    on: { click: () => pickCard(ctx, m.type) } },
  m.type === tipType ? h('span', { class: 'hud-card-tip' }, T('hud.buildTip.badge')) : null,
  cardIcon(def),
  h('span', { class: 'hud-card-name' }, name),
  h('span', { class: 'hud-cat-foot' }, foot),
  h('span', { class: 'hud-card-fx' }, desc));
}

// Land tab: lots for sale, cheapest first (terrain icon, name, price, Buy) + "Show land for sale" on the map.
// Estates (land-ui-simplify §2A): the 4 climate estates in order — owned ✓, the next one with its price, later ones locked.
function landTab(ctx, s) {
  const out = h('div', { class: 'hud-land' }, h('p', { class: 'hud-hint' }, T('estate.hint', { fields: ESTATE_FIELDS })));
  const list = h('ul', { class: 'hud-land-list' });
  for (const id of ESTATE_ORDER) {
    const e = ESTATES[id], owned = estateOwned(s, id), err = owned ? 'owned' : parcelError(s, e.seed);
    let right;
    if (owned) right = h('span', { class: 'hud-land-state is-owned' }, '✓ ', T('estate.ownedShort'));
    // locked behind the tier just below it (it read "Sau Tầng 2" on Tầng 4 too) — short, so the tier's name keeps its width
    else if (err === 'order') right = h('span', { class: 'hud-land-state' }, '🔒 ', T('estate.afterTier', { n: ESTATE_ORDER.indexOf(id) }));
    else if (err === 'level') right = h('span', { class: 'hud-land-state' }, '🔒 ', T('estate.level', { level: e.level }));
    else {
      right = actionButton({ id: `buyEstate-${id}`, label: T('estate.buy'), cost: e.cost, tone: 'gold', onClick: () => buyLand(ctx, e.seed, e.cost, T(`estate.${id}`)) });
      if (err === 'coins') right.classList.add('is-short');
    }
    list.append(h('li', { class: 'hud-land-row' },
      h('span', { class: 'hud-land-ico', attrs: { 'aria-hidden': 'true' } }, e.icon),
      h('span', { class: 'hud-land-text' }, h('strong', null, T(`estate.${id}`)), h('small', null, `${T(`zone.${e.zone}`)}`)),
      right));
  }
  out.append(list);
  return out;
}

// ⬆ Upgrades (land-ui-simplify §4): every building the player can afford to upgrade now, with its next-level effect.
// row picture = the building's own model (rendered once), the emoji until it is ready
function rowIcon(def) {
  const el = h('span', { class: 'hud-land-ico', attrs: { 'aria-hidden': 'true' } }, def.icon);
  modelIcon(def).then(url => { if (!url) return; const img = Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false }); img.className = 'hud-card-model'; el.classList.add('has-model'); el.replaceChildren(img); });
  return el;
}
export function upgradesSheet(ctx) {
  const list = s => (region(s)?.buildings || []).filter(b => !BUILDINGS[b.type]?.decor && (ctx.realm?.view === 'cafe' ? BUILDINGS[b.type]?.zone !== 'farm' : BUILDINGS[b.type]?.zone !== 'shop') && ['coins', null].includes(upgradeError(s, b))); // this game's buildings, everything still upgradable (the ones you cannot pay yet are greyed)
  // farm: the workshops / storage you have not built yet, so a bare farm still gets a useful list (tap Build → drag the ghost)
  const fresh = s => (ctx.realm?.view === 'cafe' ? [] : BUILD_MENU_FARM.filter(type => !BUILDINGS[type]?.decor && countOf(s, type) === 0 && ['coins', null].includes(buildError(s, type))));
  const render = s => {
    const items = list(s), news = fresh(s);
    if (!items.length && !news.length) return h('p', { class: 'hud-line hud-line--muted' }, T('hud.upgrades.none'));
    const rows = items.map(b => h('li', { class: 'hud-land-row', attrs: { title: buildingEffect(b.type, b.level, true) } },
      rowIcon(BUILDINGS[b.type]),
      h('span', { class: 'hud-land-text' }, h('strong', null, T(`building.${b.type}`)), h('small', null, `Lv ${b.level} → ${b.level + 1}`)),
      actionButton({ id: `up-${b.uid}`, label: T('hud.upgrade'), icon: '⬆️', cost: upgradeCost(b.type, b.level), tone: 'gold', disabled: upgradeError(s, b) === 'coins', note: upgradeError(s, b) === 'coins' ? needMore(upgradeCost(b.type, b.level) - Math.floor(s.player.coins)) : null, onClick: () => ctx.act('build/upgrade', { uid: b.uid }) })));
    const newRows = news.map(type => { const err = buildError(s, type), cost = buildCost(s, type); return h('li', { class: 'hud-land-row', attrs: { title: has(`fw.desc.${type}`) ? T(`fw.desc.${type}`) : '' } },
      rowIcon(BUILDINGS[type]),
      h('span', { class: 'hud-land-text' }, h('strong', null, T(`building.${type}`)), h('small', null, T('hud.upgrades.new'))),
      actionButton({ id: `new-${type}`, label: T('hud.upgrades.buildBtn'), icon: '🔨', cost, tone: 'gold', disabled: err === 'coins', note: err === 'coins' ? needMore(cost - Math.floor(s.player.coins)) : null,
        onClick: () => { ctx.sheet.close(); ctx.clearSelection?.(); ctx.realm?.startPlacement?.(type); } })); });
    return h('div', { class: 'hud-land' }, h('p', { class: 'hud-hint' }, T('hud.upgrades.hint')), h('ul', { class: 'hud-land-list' }, ...rows, ...newRows));
  };
  render.sig = s => `${list(s).map(b => `${b.uid}:${b.level}:${upgradeError(s, b)}`).join(',')}|${fresh(s).join(',')}|${Math.floor(s.player.coins / 50)}`;
  return render;
}

// Plant tab: the seeds as compact tiles — the variety's own tree (rendered from its model), name, price, one line on where it thrives.
const TREE_FILE = { arabica: 'gedeo', robusta: 'gedeo', liberica: 'liberica' };
function plantTab(ctx, s) {
  const active = ctx.realm?.activeCrop;
  return h('div', null, plantNote(ctx, s), h('div', { class: 'hud-seedgrid' }, ...CROP_ORDER.filter(id => cropUnlocked(s, id)).map(id => {
    const def = CROPS[id], cost = seedCost(s, id);
    const ico = h('span', { class: 'hud-seedtile-ico', attrs: { 'aria-hidden': 'true' } }, def.icon);
    modelIcon({ model: `farm/coffee-tree-${TREE_FILE[id] || 'gedeo'}.glb#tree`, trueScale: 1 }).then(url => { if (!url) return; const img = Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false }); img.className = 'hud-card-model'; ico.classList.add('has-model'); ico.replaceChildren(img); });
    return h('button', { type: 'button', class: `hud-seedtile${id === active ? ' is-active' : ''}`, dataset: { hudId: `seed-${id}` },
      on: { click: () => { ctx.realm?.setActiveCrop?.(id); ctx.sheet.close(); ctx.realm?.startPlanting?.(id); } } },
    ico,
    h('strong', null, T(`crop.${id}`)),
    coinAmount(cost),
    h('small', null, T(`crop.${id}.where`)));
  })));
}

export function buildSheet(ctx) {
  const models = s => buildMenu(buildView(ctx)).map(type => cardModel(s, type)).filter(Boolean);
  const render = s => {
    const view = buildView(ctx), tab = buildTab(ctx), all = models(s);
    const tabs = h('div', { class: 'hud-cat-tabs', attrs: { role: 'tablist', 'aria-label': T('fw.catalog.title') } },
      ...buildTabs(view).map(id => h('button', { type: 'button', class: 'hud-cat-tab', dataset: { hudId: `buildTab-${id}` },
        attrs: { role: 'tab', 'aria-selected': String(id === tab) }, on: { click: () => { if (buildTab(ctx) === id) return; setBuildTab(ctx, id); ctx.sheet.rerender(); } } },
      h('span', { class: 'hud-cat-tab-ico', attrs: { 'aria-hidden': 'true' } }, CAT_ICON[id] || '🔨'),
      h('span', { class: 'hud-cat-tab-label' }, T(`fw.cat.${id}`)),
      all.some(m => catOf(view, m.cat) === id && isNew(m)) ? h('span', { class: 'hud-dot', attrs: { 'aria-hidden': 'true' } }) : null)));
    const tip = view === 'farm' ? buildTip(s, tab) : null, note = buildTipNote(tip);
    if (tab === 'land') return h('div', { class: 'hud-catalog' }, tabs, note, landTab(ctx, s));
    if (tab === 'plant') return h('div', { class: 'hud-catalog' }, tabs, plantTab(ctx, s));
    const grid = h('div', { class: 'hud-cards hud-cat-grid' }, all.filter(m => catOf(view, m.cat) === tab).map(m => catalogCard(ctx, m, tip?.type)));
    return h('div', { class: 'hud-catalog' }, tabs, note, grid);
  };
  // Signature: the tab + every card's state (+ the land list): a sale or a staff harvest does not rebuild the grid.
  render.sig = s => {
    const view = buildView(ctx), tab = buildTab(ctx);
    const plant = tab === 'plant' ? `${ctx.realm?.activeCrop}|${ctx.store.state.player.coins | 0}|${focusArea(ctx).id}` : '';
    const land = tab === 'land' ? ESTATE_ORDER.map(id => `${id}:${estateOwned(s, id) ? 'o' : parcelError(s, ESTATES[id].seed) || ''}`).join(',') : '';
    return `${view}|${tab}|${JSON.stringify(models(s))}|${land}|${plant}|${view === 'farm' ? JSON.stringify(buildTip(s, tab)) : ''}`;
  };
  return render;
}

// ---------- Seeds (active crop picker) ----------
export function seedsSheet(ctx) {
  return s => {
    const active = ctx.realm?.activeCrop;
    const list = h('div', { class: 'hud-chips-list' });
    for (const id of CROP_ORDER) {
      const def = CROPS[id];
      const open = cropUnlocked(s, id);
      const cost = seedCost(s, id);
      const chip = h('button', { type: 'button', class: `hud-seed hud-seed--short${id === active ? ' is-active' : ''}${open ? '' : ' is-locked'}`, disabled: !open,
        attrs: { 'aria-pressed': String(id === active) },
        on: { click: () => { ctx.realm?.setActiveCrop?.(id); ctx.sheet.close(); if (ctx.realm?.startPlanting) ctx.realm.startPlanting(id); else ctx.toast(T('hud.seedPicked', { crop: T(`crop.${id}`) }), 'info'); } } },
      h('span', { class: 'hud-seed-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
      h('span', { class: 'hud-seed-name' }, T(`crop.${id}`)),
      open ? h('span', { class: 'hud-seed-cost' }, coinAmount(cost)) : lockTag(s.player.round < def.round ? T('hud.roundN', { round: def.round }) : T('hud.levelN', { level: def.level })),
      h('span', { class: 'hud-seed-where' }, T(`crop.${id}.where`)));
      list.append(chip);
    }
    return h('div', null, plantNote(ctx, s), list);
  };
}

// ---------- Research step 3: 🌱 trial fields (docs/design/research.md) ----------
const lab = { crop: null, method: [0, 2, 1] };
const wayText = m => FARMLAB.factors.map((f, i) => T(`hud.trial.${f}.${m[i]}`)).join(' · ');
const effText = e => T('hud.trial.eff', { y: Math.round(e.yieldMul * 100), t: Math.round(e.timeMul * 100), q: Math.round(e.quality * 100) });
// Not shown anywhere since 2026-11-10: the founder took the fold it lived in off the seed sheet. The game rules behind it are unchanged.
function trialLab(ctx, s) {
  const crops = CROP_ORDER.filter(c => cropUnlocked(s, c));
  if (!crops.length) return null;
  if (!crops.includes(lab.crop)) lab.crop = crops[0];
  const rid = s.world.currentRegion, now = Date.now(), crop = lab.crop;
  const rerender = () => ctx.rerenderSheet?.();
  const cur = methodOf(s, crop), curKey = methodKey(cur), defKey = methodKey(FARMLAB.defaultMethod);
  const cropChips = h('div', { class: 'hud-sm-chips' }, ...crops.map(c => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(lab.crop === c) }, on: { click: () => { lab.crop = c; rerender(); } } }, `${CROPS[c].icon} ${T(`crop.${c}`)}`)));
  const pickers = FARMLAB.factors.map((f, i) => h('div', { class: 'hud-trial-row' }, h('small', null, T(`hud.trial.${f}`)),
    h('div', { class: 'hud-sm-chips' }, ...[0, 1, 2].map(v => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(lab.method[i] === v) },
      on: { click: () => { lab.method = lab.method.map((x, k) => (k === i ? v : x)); rerender(); } } }, T(`hud.trial.${f}.${v}`))))));
  const err = trialError(s, crop, lab.method), field = trialField(s);
  const cost = FARMLAB.trialFee + seedCost(s, crop);
  const note = err === 'method' ? T('hud.trial.isDefault') : err === 'slots' ? T('hud.trial.slots', { n: trialSlots(s) }) : err === 'noField' ? T('hud.trial.noField') : err === 'coins' ? needMore(cost - s.player.coins)
    : field ? T('hud.trial.field', { id: field.id }) : null;
  const go = actionButton({ id: 'trialGo', label: T('hud.trial.go'), icon: '🌱', cost, tone: 'go', disabled: !!err, note, onClick: () => { const r = ctx.act('farmlab/trial', { crop, method: lab.method }); if (r?.ok) rerender(); } });
  const running = trialsHere(s).map(t => { const st = plotState(s, t.plotId, now); return h('li', null, `🧪 ${CROPS[t.crop].icon} ${T(`crop.${t.crop}`)} · ${wayText(t.method)} · `, st.stage === 'ready' ? T('hud.trial.ready') : T('hud.trial.left', { s: Math.ceil((st.remainingMs || 0) / 1000) })); });
  const results = trialResults(s, crop);
  const rows = [{ key: defKey, method: FARMLAB.defaultMethod, eff: { yieldMul: 1, timeMul: 1, quality: 0 }, beans: null }, ...Object.entries(results).map(([key, x]) => ({ key, method: x.method, eff: methodEffect(rid, crop, x.method), beans: x.beans }))];
  const table = h('div', { class: 'hud-trial-results' }, ...rows.map(r => h('div', { class: `hud-sup-row${r.key === curKey ? ' is-mine' : ''}` },
    h('strong', null, r.key === defKey ? T('hud.trial.default') : wayText(r.method), r.key === curKey ? h('span', { class: 'hud-tag' }, T('hud.trial.using')) : null),
    h('small', null, effText(r.eff), r.beans != null ? ` · ${T('hud.trial.got', { n: r.beans })}` : ''),
    r.key === curKey ? null : h('div', { class: 'hud-row' }, actionButton({ label: T('hud.trial.adopt'), tone: 'plain', onClick: () => { ctx.act('farmlab/adopt', { crop, method: r.method }); rerender(); } })))));
  return h('section', { class: 'hud-lab' }, h('h3', { class: 'hud-sm-h' }, `🌱 ${T('hud.trial.title')}`),
    h('p', { class: 'hud-hint' }, T('hud.trial.hint', { fee: FARMLAB.trialFee })),
    cropChips, ...pickers, h('div', { class: 'hud-row' }, go),
    running.length ? h('ul', { class: 'hud-lab-tests' }, ...running) : null,
    h('p', { class: 'hud-sm-h' }, T('hud.trial.compare', { crop: T(`crop.${crop}`) })), table);
}

// ---------- Menu (café drinks) ----------
export const drinkSeenKey = drinkId => `hudDrink:${drinkId}`;
export function menuSheet(ctx = {}) {
  return s => {
    const list = h('div', { class: 'hud-chips-list' });
    const hasRegion = !!region(s);
    for (const id of DRINK_ORDER) {
      const def = DRINKS[id];
      const open = drinkUnlocked(s, id);
      const needs = [];
      if (!open && level(s) < def.level) needs.push(T('hud.levelN', { level: def.level }));
      if (!open && buildingLevel(s, 'roaster') < def.roaster) needs.push(T('hud.menu.needRoaster', { level: def.roaster }));
      const price = hasRegion ? drinkPrice(s, id) : def.price;
      // The country's local drinks served as this base drink (config/menus.js), e.g. Vietnam latte → cà phê trứng, cà phê muối…
      const local = hasRegion ? localItemsOf(s.world.currentRegion, id) : [];
      list.append(h('div', { class: `hud-seed hud-drink${open ? '' : ' is-locked'}`, dataset: { hudId: `drink-${id}` } },
        h('span', { class: 'hud-seed-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
        h('span', { class: 'hud-seed-name' }, T(`drink.${id}`)),
        // Recipe book: ✨ found (own price), ❔ not found yet (sold as the base drink), plain items known from the start.
        local.length ? h('span', { class: 'hud-drink-local' }, local.map(item => {
          const cc = countryNow(s), known = recipeKnown(s, cc, item.index), found = recipeFound(s, cc, item.index);
          return `${known ? item.icon : '❔'} ${item.name}${found ? ` ✨${fmt(Math.round(price * RESEARCH.priceMul))}` : ''}`;
        }).join(' · ')) : null,
        open ? h('span', { class: 'hud-seed-meta' }, coinAmount(price), h('span', null, T('hud.menu.beans', { n: def.beans })),
          h('span', null, `⏱ ${duration(hasRegion ? brewMs(s, id) : def.brewSeconds * 1000)}`))
          : h('span', { class: 'hud-seed-meta' }, needs.map(text => lockTag(text)))));
    }
    return h('div', null, h('p', { class: 'hud-hint' }, T('hud.menu.hint')), list, hasRegion ? testBench(ctx, s) : null);
  };
}

// ---------- Research lab, step 1: the drink test bench (docs/design/research.md) ----------
// Base drink + up to RESEARCH.maxIngredients ingredients; each test shows hints against the closest unknown recipe.
const bench = { base: null, ings: [] };
function testBench(ctx, s) {
  const cc = countryNow(s), now = Date.now();
  const bases = DRINK_ORDER.filter(id => drinkUnlocked(s, id));
  if (!cc || !bases.length) return null;
  if (!bases.includes(bench.base)) bench.base = bases[0];
  bench.ings = bench.ings.filter(id => ingredientUnlocked(s, id));
  const err = testError(s, bench.base, bench.ings, now), busy = benchBusyIn(s, now);
  const rerender = () => ctx.rerenderSheet?.();
  const baseChips = h('div', { class: 'hud-sm-chips', attrs: { role: 'group', 'aria-label': T('hud.lab.base') } }, ...bases.map(id => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(bench.base === id) },
    on: { click: () => { bench.base = id; rerender(); } } }, `${DRINKS[id].icon} ${T(`drink.${id}`)}`)));
  const ingChips = h('div', { class: 'hud-lab-ings', attrs: { role: 'group', 'aria-label': T('hud.lab.ings', { n: RESEARCH.maxIngredients }) } }, ...INGREDIENT_ORDER.map(id => {
    const open = ingredientUnlocked(s, id), on = bench.ings.includes(id);
    return h('button', { type: 'button', class: 'hud-lab-ing', disabled: !open, attrs: { 'aria-pressed': String(on) },
      on: { click: () => { bench.ings = on ? bench.ings.filter(x => x !== id) : [...bench.ings, id].slice(-RESEARCH.maxIngredients); rerender(); } } },
      h('b', { attrs: { 'aria-hidden': 'true' } }, INGREDIENTS[id].icon), T(`hud.lab.ing.${id}`), open ? h('small', null, `🪙${INGREDIENTS[id].cost}`) : h('small', null, T('hud.levelN', { level: INGREDIENTS[id].level })));
  }));
  const note = err === 'busy' ? T('hud.lab.busy', { s: Math.ceil(busy / 1000) }) : err === 'empty' ? T('hud.lab.pick') : err === 'beans' ? T('hud.lab.beans', { n: DRINKS[bench.base].beans }) : err === 'coins' ? needMore(testCost(bench.ings, s) - s.player.coins) : null;
  const go = actionButton({ id: 'labTest', label: T('hud.lab.test'), icon: '🧪', cost: bench.ings.length ? testCost(bench.ings, s) : undefined, tone: 'go', disabled: !!err, note,
    onClick: () => { const r = ctx.act('research/test', { base: bench.base, ings: bench.ings }); if (r?.ok) { bench.ings = []; rerender(); setTimeout(rerender, RESEARCH.testSeconds * 1000 + 100); } } }); // clear the picks, then wake the button when the bench is free
  const tests = (s.research?.tests?.[cc] || []).slice(0, 5).map(t => h('li', { class: 'hud-lab-test' },
    h('span', { class: 'hud-lab-dots', attrs: { 'aria-hidden': 'true' } }, ...labDots(t)),
    h('span', null, `${DRINKS[t.base]?.icon || ''} + ${t.ings.map(id => INGREDIENTS[id]?.icon || '').join(' ')}: `, h('b', null, labVerdict(t, cc)))));
  const local = localItemsOf(s.world.currentRegion, bench.base);
  const left = local.filter(it => !recipeKnown(s, cc, it.index)).length;
  return h('section', { class: 'hud-lab' },
    h('h3', { class: 'hud-sm-h' }, `🧪 ${T('hud.lab.title')}`),
    h('p', { class: 'hud-hint' }, T('hud.lab.hint', { pct: Math.round((RESEARCH.priceMul - 1) * 100), n: left, s: RESEARCH.testSeconds })),
    baseChips, ingChips, h('div', { class: 'hud-row' }, go),
    tests.length ? h('ul', { class: 'hud-lab-tests' }, ...tests) : null);
}
// Hint dots of one test: 🟢 right ingredient, 🟡 belongs to another unknown recipe, ⚪ not used anywhere.
function labDots(t) {
  if (t.result === 'found' || t.result === 'known') return [h('i', { class: 'is-g' }), h('i', { class: 'is-g' }), h('i', { class: 'is-g' })];
  return [...Array(t.right || 0).fill('is-g'), ...Array(t.other || 0).fill('is-y'), ...Array(t.wrong || 0).fill('')].map(c => h('i', { class: c }));
}
function labVerdict(t, cc) {
  if (t.result === 'found') return T('hud.lab.found', { name: localName(cc, t.index) });
  if (t.result === 'known') return T('hud.lab.known', { name: localName(cc, t.index) });
  if (t.result === 'allKnown') return T('hud.lab.allKnown');
  const parts = [];
  if (t.missing) parts.push(T('hud.lab.missing', { n: t.missing, tag: T(`hud.lab.tag.${t.tag}`) }));
  if (t.extra) parts.push(T('hud.lab.extra'));
  if (!parts.length) parts.push(T('hud.lab.swap'));
  return `${T('hud.lab.close', { n: t.right })} ${parts.join(' ')}`;
}
const localName = (cc, index) => { for (const base of DRINK_ORDER) { const it = localItemsOf(`${cc}-1`, base).find(x => x.index === index); if (it) return it.name; } return '?'; };

// ---------- Research step 2: 🚚 Nguồn hàng — café suppliers, farm buyers (docs/design/research.md) ----------
const pct = v => `${Math.round(v * 100)}%`;
const leftText = ms => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 2880 ? T('hud.sup.daysLeft', { n: Math.round(m / 1440) }) : m >= 120 ? T('hud.sup.hoursLeft', { n: Math.round(m / 60) }) : T('hud.sup.minLeft', { n: m }); };
function scoutRow(ctx, s, group, now) {
  const sc = scoutOf(s), max = group === 'buyers' ? SUPPLY.buyers.count : SUPPLY.perGroup, found = suppliersFound(s, group, now);
  if (found >= max) return h('p', { class: 'hud-sub' }, T('hud.sup.allFound'));
  if (sc && sc.group === group && sc.regionId === s.world.currentRegion && now < sc.until) return h('p', { class: 'hud-sub' }, T('hud.sup.scouting', { t: leftText(sc.until - now) }));
  return h('div', { class: 'hud-row' }, actionButton({ label: T(group === 'buyers' ? 'hud.sup.scoutBuyer' : 'hud.sup.scout'), icon: '🔎', cost: SUPPLY.scout.cost, tone: 'plain', disabled: !!sc || s.player.coins < SUPPLY.scout.cost,
    note: sc ? T('hud.sup.oneScout') : null, onClick: () => ctx.act('supply/scout', { group }) }));
}
function supplierLine(sup) {
  return `${'★'.repeat(sup.quality)}${'☆'.repeat(3 - sup.quality)} · ${T('hud.sup.price', { pct: pct(sup.priceMul) })} · ${T('hud.sup.late', { pct: pct(sup.late) })}`;
}
export function supplySheet(ctx) {
  return s => {
    const now = Date.now(), rid = s.world.currentRegion;
    if (!region(s)) return h('p', { class: 'hud-line' }, T('hud.sup.noRegion'));
    const out = [];
    if (regionGame(s) === 'farm') {
      // Buyers: today's price per good, the chosen one, lock today's prices.
      const cur = buyerNow(s, now), found = suppliersFound(s, 'buyers', now);
      const rows = [0, ...Array.from({ length: found }, (_, k) => k + 1)].map(i => {
        const b = buyerOf(rid, i, dayKey(now)), mine = cur.i === i, mul = mine && cur.locked ? cur.mul : b.mul;
        return h('div', { class: `hud-sup-row${mine ? ' is-mine' : ''}` },
          h('strong', null, i ? b.name : T('hud.sup.store'), mine ? h('span', { class: 'hud-tag' }, cur.locked ? T('hud.sup.lockedTag', { t: leftText(cur.locked - now) }) : T('hud.sup.chosen')) : null),
          h('span', { class: 'hud-sup-prices' }, ...GOOD_ORDER.map(g => h('span', { class: mul[g] > 1.001 ? 'is-up' : mul[g] < .999 ? 'is-down' : '' }, `${GOODS[g].icon} ${fmt(Math.round(GOODS[g].price * mul[g] * 10) / 10)}`))),
          mine ? null : h('div', { class: 'hud-row' },
            actionButton({ label: T('hud.sup.sellHere'), tone: 'plain', disabled: !!cur.locked, onClick: () => ctx.act('supply/setBuyer', { i }) }),
            i ? actionButton({ label: T('hud.sup.lock', { n: 3 }), icon: '📝', cost: SUPPLY.buyers.lockFee * 3, tone: 'gold', disabled: !!cur.locked || s.player.coins < SUPPLY.buyers.lockFee * 3, onClick: () => ctx.act('supply/lockBuyer', { i, days: 3 }) }) : null));
      });
      out.push(h('section', { class: 'hud-panel' }, h('h3', { class: 'hud-h3' }, `🤝 ${T('hud.sup.buyers')}`), h('p', { class: 'hud-hint' }, T('hud.sup.buyersHint')), ...rows, scoutRow(ctx, s, 'buyers', now)));
    } else {
      for (const group of SUPPLY.groupOrder) {
        const cur = supplyOf(s, group, now), c = contractOf(s, group, now), found = suppliersFound(s, group, now);
        const list = Array.from({ length: found }, (_, i) => {
          const sup = supplierOf(rid, group, i), mine = c?.i === i;
          return h('div', { class: `hud-sup-row${mine ? ' is-mine' : ''}` }, h('strong', null, sup.name, mine ? h('span', { class: 'hud-tag' }, T('hud.sup.until', { t: leftText(c.until - now) })) : null),
            h('small', null, supplierLine(sup)),
            h('div', { class: 'hud-row' }, ...[1, 7].map(days => actionButton({ label: T('hud.sup.sign', { n: days }), cost: contractFee(days), tone: days === 7 ? 'gold' : 'plain', disabled: s.player.coins < contractFee(days),
              onClick: () => ctx.act('supply/sign', { group, i, days }) }))));
        });
        out.push(h('section', { class: 'hud-panel' }, h('h3', { class: 'hud-h3' }, `${SUPPLY.groups[group].icon} ${T(`hud.sup.g.${group}`)}`),
          h('p', { class: 'hud-line' }, c ? T('hud.sup.using', { name: cur.name }) : T('hud.sup.market'), ' · ', supplierLine(cur)),
          ...list, scoutRow(ctx, s, group, now)));
      }
      out.unshift(h('p', { class: 'hud-hint' }, T('hud.sup.cafeHint', { pct: pct(SUPPLY.qualityBonus[3]) })));
    }
    out.push(h('p', { class: 'hud-sub' }, T('hud.sup.gmNote')));
    return h('div', null, ...out);
  };
}

// ---------- Beans (café: buy from the supplier) ----------
export function beansSheet(ctx) {
  return s => {
    const cap = region(s) ? capacity(s) : 0;
    const q = beanBuyQuote(s);
    const label = q.free ? T('hud.beans.free', { n: q.amount }) : T('hud.beans.buy', { n: q.amount || BEANS.buyPack });
    const note = q.error === 'storageFull' ? T('hud.beans.full') : q.error === 'coins' ? needMore(q.missing) : null;
    return h('div', null,
      h('p', { class: `hud-line${cap && stored(s) >= cap ? ' hud-line--bad' : ''}` }, T('hud.storage.fill', { n: Math.floor(s.inventory.beans), max: cap })),
      h('p', { class: 'hud-hint' }, T('hud.beans.hint', { price: fmt(q.unit || BEANS.buyPrice) })),
      h('div', { class: 'hud-row' }, actionButton({ id: 'buyBeans', label, icon: '🫘', cost: q.error ? null : q.cost, disabled: !!q.error, note,
        onClick: () => ctx.act('shop/buyBeans', { roll: Math.random() }) }),
        actionButton({ id: 'openSupply', label: T('hud.sup.open'), icon: '🚚', tone: 'plain', onClick: () => ctx.onTool('supply') })),
      storageRow(ctx, s));
  };
}
// The café has no storehouse on screen: its bean storage is upgraded from here (same building, same prices).
function storageRow(ctx, s) {
  const silo = region(s)?.buildings.find(b => b.type === 'silo');
  if (!silo) return null;
  const err = upgradeError(s, silo), cost = upgradeCost('silo', silo.level);
  const head = h('p', { class: 'hud-sub' }, `📦 ${T('building.silo')} · ${T('hud.levelOf', { level: silo.level, cap: BUILDINGS.silo.upgrade.length + 1 })}`);
  if (err === 'maxLevel' || err === 'roundCap') return h('div', null, head, h('span', { class: 'hud-tag' }, T('hud.maxLevel')));
  return h('div', null, head, h('div', { class: 'hud-row' }, actionButton({ id: 'upgradeStorage', label: T('hud.beans.moreRoom'), icon: '⬆️', cost, tone: 'plain',
    disabled: err === 'coins', note: err === 'coins' ? needMore(cost - s.player.coins) : null, onClick: () => ctx.act('build/upgrade', { uid: silo.uid }) })));
}

// ---------- Sell (farm): what you can sell right now, good by good, with what each would pay ----------
export function sellSheet(ctx) {
  return s => {
    const cap = region(s) ? capacity(s) : 0, used = region(s) ? stored(s) : 0;
    const rows = GOOD_ORDER.map(g => ({ g, n: Math.floor(goodCount(s, g)), q: sellQuote(s, g) })).filter(r => r.n > 0);
    const all = sellAllQuote(s);
    const pct = cap ? Math.min(100, Math.round(used / cap * 100)) : 0;
    const head = h('div', { class: `ui-bar is-gold is-large${cap && used >= cap ? ' is-full' : ''}`, attrs: { style: `--v:${pct}%` } }, h('u'), h('span', null, T('hud.sell.fill', { n: used, max: cap })));
    if (!rows.length) return h('div', { class: 'hud-sell' }, head, h('p', { class: 'hud-line hud-line--muted' }, T('hud.sell.empty')));
    const list = h('div', { class: 'hud-sell-flows' }, ...rows.map(({ g, n, q }) => h('button', { type: 'button', class: 'hud-sell-flow', dataset: { hudId: `sell-${g}`, good: g }, attrs: { 'aria-label': `${T(`good.${g}`)} × ${n} · ${fmt(q.coins)}` }, on: { click: () => ctx.act('farm/sell', { good: g }) } },
      h('span', { class: 'ui-sq', attrs: { 'aria-hidden': 'true' } }, GOODS[g]?.icon || '📦'),
      h('b', null, `×${fmt(n)}`), h('span', { class: 'ui-arrow', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), h('strong', null, fmt(q.coins)))));
    return h('div', { class: 'hud-sell' }, head, list,
      actionButton({ id: 'sellAll', label: T('hud.sell.allGo'), tone: 'go', onClick: () => { ctx.act('farm/sellAll'); ctx.sheet.close(); } }));
  };
}

// ---------- Staff ----------
// The staff manager is a full modal now (staff-modal.js, docs/design/staff-manager.md §10).

/** Buys land after a small confirm card (QA 2026-11-09: 1 500+ coins went on one stray tap). One txId per confirm. */
export async function buyLand(ctx, parcelId, cost, name) {
  if (ctx.buyingLand) return false;
  ctx.buyingLand = true;
  try {
    const txId = newTxId('land');
    const yes = await ctx.confirm({ title: T('hud.land.confirmTitle', { name }), body: T('hud.land.confirmBody'), cost, confirmLabel: T('hud.land.confirmGo') });
    if (!yes) return false;
    return ctx.act('land/buyParcel', { parcelId }, { txId }).ok;
  } finally { ctx.buyingLand = false; }
}
/** Buys one auto run after a small confirm card; one txId per confirm, so a double tap can never charge twice. */
export async function buyAuto(ctx) {
  if (ctx.buyingAuto) return false;
  ctx.buyingAuto = true;
  try {
    const price = autoPrice(ctx.store.state.autoplay?.bought || 0), txId = newTxId('auto');
    const yes = await ctx.confirm({ title: T('hud.auto.buyTitle'), body: T('hud.auto.buyBody', { min: Math.round(AUTO.runSeconds / 60) }), cost: price, confirmLabel: T('hud.auto.buyGo') });
    if (!yes) return false;
    const r = ctx.act('auto/buy', {}, { txId });
    if (r.ok && !r.duplicate) ctx.toast(T('hud.toast.autoBought'), 'good');
    return r.ok;
  } finally { ctx.buyingAuto = false; ctx.sheet?.rerender?.(); }
}
/** Starts the run (the kept time first, else one run). */
export function startAuto(ctx) {
  const r = ctx.act('auto/start');
  if (r.ok && !r.noop) ctx.toast(T('hud.toast.autoStart'), 'good');
  return r;
}
/** Pauses the run: its time stays for the next start. */
export function pauseAuto(ctx) {
  const r = ctx.act('auto/stop', { reason: 'user' });
  if (r.ok && !r.noop) ctx.toast(T('hud.toast.autoStopped', { time: clock(ctx.store.state.autoplay.saved) }), 'info');
}
let autoSeen = { left: null, at: 0 };
/** Time left of the run on screen: the save only moves every AUTO.everySec, so the HUD counts down in between. */
export function autoLeftMs(a) {
  const left = a?.active?.leftMs ?? 0, t = performance.now();
  if (left !== autoSeen.left) autoSeen = { left, at: t };
  return Math.max(0, left - Math.min(AUTO.everySec * 1000, t - autoSeen.at));
}
/** Which of the four faces the Auto controls show. */
const autoFace = a => (a.active ? 'on' : a.saved > 0 ? 'paused' : (a.runs || 0) > 0 ? 'ready' : 'empty');
/** The numbers of the run on screen: the one going, the paused one, or the last finished one. */
function autoRunBook(s) {
  const a = s.autoplay || {};
  return a.active ? autoBook(s) : a.saved > 0 ? a.tally : a.last;
}
/** The manager you hired, if any (Auto's stand-in is not one): with him, Auto only helps on the fields. */
const hiredBoss = s => (s.gm?.unit && !s.gm.unit.isAuto ? s.gm.unit : null);
/** Changes only when the Auto controls need new buttons (the clock and numbers repaint in place). */
export function autoSig(s) { const a = s.autoplay || {}, price = autoPrice(a.bought || 0); return `${autoFace(a)}|${a.runs || 0}|${price}|${s.player.coins < price}|${hiredBoss(s)?.name || ''}`; }
/** The one button that fits Auto right now. */
function autoMain(ctx, s, face, short) {
  const a = s.autoplay || {}, min = Math.round(AUTO.runSeconds / 60), price = autoPrice(a.bought || 0), broke = s.player.coins < price;
  const buy = async () => { if (await buyAuto(ctx)) startAuto(ctx); };
  return {
    on: { id: 'autoPause', label: T('hud.auto.stopBtn'), icon: '⏸', tone: 'plain', onClick: () => pauseAuto(ctx) },
    paused: { id: 'autoResume', label: T('hud.auto.resumeBtn'), icon: '▶', tone: 'go', onClick: () => startAuto(ctx) },
    ready: { id: 'autoStart', label: short ? T('hud.auto.open') : T('hud.auto.startBtn', { min }), icon: '▶', tone: 'go', onClick: () => startAuto(ctx) },
    empty: { id: 'autoBuyStart', label: short ? T('hud.auto.open') : T('hud.auto.buyStart'), cost: price, tone: 'gold', disabled: broke, note: broke && !short ? needMore(price - s.player.coins) : null, onClick: buy },
  }[face];
}
/** Auto as the Staff screen's manager card: one line, always above the tabs. A tap on the words opens its report. */
export function autoStrip(ctx, s, onReport) {
  const a = s.autoplay || {}, face = autoFace(a), runs = a.runs || 0, min = Math.round(AUTO.runSeconds / 60), total = AUTO.runSeconds * 1000;
  const timed = face === 'on' || face === 'paused', left = face === 'on' ? autoLeftMs(a) : a.saved || 0, book = autoRunBook(s);
  const num = (key, v) => h('b', { dataset: { autoStat: key } }, fmt(Math.round(v || 0)));
  const main = autoMain(ctx, s, face, true), mainBtn = actionButton(face === 'on' ? { ...main, label: '' } : main); // running: the pause icon alone, the clock needs the room
  mainBtn.setAttribute('aria-label', main.label);
  return h('section', { class: `hud-auto-strip is-${face}` },
    h('button', { type: 'button', class: 'hud-auto-strip-main', dataset: { hudId: 'autoStripReport' }, on: { click: onReport } },
      h('span', { class: 'hud-auto-state-ico', attrs: { 'aria-hidden': 'true' } }, '🤖'),
      h('span', { class: 'hud-auto-strip-text' },
        h('strong', null, hiredBoss(s) && face !== 'paused' ? T(face === 'on' ? 'hud.auto.strip.helpOn' : 'hud.auto.strip.help') : T(`hud.auto.strip.${face}`)),
        face === 'on' ? h('small', null, T('hud.auto.strip.jobs'), ' ', num('jobs', book?.jobs), ' · ', T('hud.auto.strip.spent'), ' ', num('spent', book?.spent)) : h('small', null, T(`hud.auto.stripSub.${face}`, { n: runs, min })))),
    timed ? h('span', { class: 'hud-auto-state-time', dataset: { autoClock: '' } }, clock(left)) : null,
    mainBtn,
    timed ? h('div', { class: 'hud-auto-meter', attrs: { 'aria-hidden': 'true' } }, h('i', { dataset: { autoMeter: '' }, style: { width: `${Math.min(100, left / total * 100)}%` } })) : null);
}
/** Auto: state and time left, what the run did, what it may do, and the one action that fits. The sheet shows all of it; `detail` (the Staff screen's report, under the strip) leaves out the state and the main button. */
export function autoPanel(ctx, s, { link = false, detail = false } = {}) {
  const a = s.autoplay || {}, face = autoFace(a), runs = a.runs || 0, min = Math.round(AUTO.runSeconds / 60), total = AUTO.runSeconds * 1000;
  const price = autoPrice(a.bought || 0), broke = s.player.coins < price, timed = face === 'on' || face === 'paused';
  const left = face === 'on' ? autoLeftMs(a) : a.saved || 0, book = autoRunBook(s), boss = hiredBoss(s);
  const buy = async () => { await buyAuto(ctx); };
  const main = autoMain(ctx, s, face, false);
  const stat = (key, label, value) => h('div', { class: 'hud-auto-stat' }, h('strong', { dataset: { autoStat: key } }, value), h('small', null, label));
  return h('div', { class: 'hud-auto-panel' },
    detail ? null : h('section', { class: `hud-auto-state is-${face}` },
      h('span', { class: 'hud-auto-state-ico', attrs: { 'aria-hidden': 'true' } }, '🤖'),
      h('div', { class: 'hud-auto-state-text' }, h('strong', null, face === 'on' && boss ? T('hud.auto.state.help', { name: boss.name }) : T(`hud.auto.state.${face}`)), h('small', null, T(`hud.auto.sub.${face}`, { min, n: runs }))),
      h('span', { class: 'hud-auto-state-time', dataset: timed ? { autoClock: '' } : undefined }, timed ? clock(left) : `×${runs}`),
      timed ? h('div', { class: 'hud-auto-meter', attrs: { 'aria-hidden': 'true' } }, h('i', { dataset: { autoMeter: '' }, style: { width: `${Math.min(100, left / total * 100)}%` } })) : null),
    detail ? null : h('div', { class: 'hud-auto-jobs', attrs: { 'aria-hidden': 'true' } }, ...[['sprout', 'plant'], ['basket', 'harvest'], ['scroll', 'quests']].map(([job, key]) => h('i', { dataset: { job } }, h('small', null, T(`hud.auto.job.${key}`))))),
    h('div', { class: 'hud-auto-actions' },
      detail ? null : actionButton(main),
      face === 'empty' && !detail ? null : actionButton({ id: 'autoBuy', label: T('hud.auto.buyMore'), cost: price, tone: 'plain', disabled: broke, onClick: buy })),
    book ? h('section', { class: 'hud-auto-report' },
      h('h3', null, T(face === 'ready' || face === 'empty' ? 'hud.auto.lastRun' : 'hud.auto.thisRun')),
      h('div', { class: 'hud-auto-stats' },
        stat('jobs', T('hud.auto.stat.jobs'), fmt(book.jobs || 0)), stat('earned', T('hud.auto.stat.earned'), fmt(Math.round(book.earned || 0))), stat('spent', T('hud.auto.stat.spent'), fmt(Math.round(book.spent || 0))))) : null,
    link && face === 'on' ? actionButton({ id: 'autoReport', label: T('hud.auto.report'), tone: 'plain', onClick: () => { ctx.sheet.close(); ctx.staffModal.open({ tab: 'team', autoReport: true }); } }) : null,
    h('details', { class: 'hud-auto-does' },
      h('summary', null, T('hud.auto.doesTitle')),
      h('ul', null, ...(boss ? ['field', 'sell', 'quests'] : ['field', 'sell', 'crew', 'grow', 'quests']).map(k => h('li', null, T(`hud.auto.does.${k}`))), boss ? h('li', null, T('hud.auto.does.hired', { name: boss.name })) : null, h('li', { class: 'is-no' }, T('hud.auto.does.noLoan'))),
      h('p', { class: 'hud-auto-note' }, T('hud.auto.note'))));
}
/** The bottom sheet behind the rail's AUTO button. The clock and the numbers repaint in place (HUD updateAuto), so a button is never swapped under a finger. */
export function autoSheet(ctx) {
  const render = s => autoPanel(ctx, s, { link: true });
  render.sig = s => { const a = s.autoplay || {}, book = autoRunBook(s); return `${autoFace(a)}|${a.runs || 0}|${autoPrice(a.bought || 0)}|${s.player.coins < autoPrice(a.bought || 0)}|${book ? 1 : 0}|${a.last?.at || 0}|${hiredBoss(s)?.name || ''}`; };
  return render;
}

/** The text of a quest: 'Harvest 10 trees'. */
export const questText = q => T(q.kind === 'stat' || q.kind === 'building' ? `hud.quest.${q.key}` : `hud.quest.${q.kind}`, { n: fmt(q.n) });
/** Nhiệm vụ: the Auto status on top, then the next quests with their progress; a finished one has its Claim button. */
export function questsSheet(ctx) {
  return s => {
    const a = s.autoplay || {}, list = questList(s), c = questCount(s);
    const head = h('div', { class: 'hud-quest-head' }, h('span', { class: 'ui-ico ui-ico--trophy', attrs: { 'aria-hidden': 'true' } }),
      h('div', { class: 'ui-bar is-gold is-large', attrs: { style: `--v:${c.total ? Math.round(c.claimed / c.total * 100) : 0}%` } }, h('u'), h('span', null, T('hud.quests.claimed', { n: fmt(c.claimed), max: fmt(c.total) }))));
    const rows = list.slice(0, 10).map(q => {
      const now = Math.min(q.n, Math.floor(q.value));
      return h('div', { class: `hud-quest${q.done ? ' is-done' : ''}`, dataset: { art: q.kind === 'stat' ? q.key : q.kind } },
        h('span', { class: 'hud-quest-ico', attrs: { 'aria-hidden': 'true' } }),
        h('div', { class: 'hud-quest-main' },
          h('span', { class: 'hud-quest-text' }, questText(q)),
          q.done ? h('span', { class: 'hud-quest-prize' }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), `${fmt(q.coins)} · ${q.xp} XP`)
            : h('div', { class: 'ui-bar', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(q.n), 'aria-valuenow': String(now), style: `--v:${Math.floor(now / q.n * 100)}%` } }, h('u'), h('span', null, `${fmt(now)}/${fmt(q.n)}`))),
        q.done ? actionButton({ id: `questClaim-${q.id}`, label: T('hud.quest.claim'), tone: 'gold', onClick: () => ctx.act('quest/claim', { id: q.id }) })
          : h('span', { class: 'ui-pill' }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), fmt(q.coins)));
    });
    return h('div', { class: 'hud-quests' }, head, ...rows, a.active ? null : actionButton({ id: 'questAuto', label: T('hud.quest.start'), icon: '▶', tone: 'go', onClick: () => ctx.onTool('auto') }));
  };
}

export function progressSheet(ctx) {
  return s => {
    // World map (moved here from the toolbar; the World Gate on the farm opens it too).
    const world = actionButton({ id: 'worldMap', label: T('hud.worldMapBtn'), tone: 'plain', onClick: () => ctx.onTool('world') });
    const supply = region(s) ? actionButton({ id: 'openSupplyP', label: T('hud.sup.open'), icon: '🚚', tone: 'plain', onClick: () => ctx.onTool('supply') }) : null;
    return h('div', { class: 'hud-progress' }, h('div', { class: 'hud-row' }, world, supply));
  };
}

/** What unlocks exactly at `lvl` in the game being played here (level-up screen): { name, icon, model }. */
export function levelUnlockCards(s, lvl) {
  const game = regionGame(s), farm = game !== 'cafe', cafe = game !== 'farm', out = [];
  const inGame = zone => (zone === 'farm' ? farm : zone === 'shop' ? cafe : true);
  if (farm) for (const id of CROP_ORDER) if (CROPS[id].level === lvl && CROPS[id].round <= s.player.round) out.push({ name: T(`crop.${id}`), icon: CROPS[id].icon, model: { model: `farm/coffee-tree-${TREE_FILE[id] || 'gedeo'}.glb#tree`, trueScale: 1 } });
  if (cafe) for (const id of DRINK_ORDER) if (DRINKS[id].level === lvl) out.push({ name: T(`drink.${id}`), icon: DRINKS[id].icon });
  for (const id of BUILD_MENU) { const def = defOf(id); if (def && def.level === lvl && def.round <= s.player.round && inGame(def.zone)) out.push({ name: T(`building.${id}`), icon: def.icon, model: def.model ? def : null }); }
  for (const id of STAFF_ORDER) if (STAFF[id].level === lvl && STAFF[id].round <= s.player.round && inGame(STAFF[id].zone)) out.push({ name: T(has(`hud.unlock.${id}`) ? `hud.unlock.${id}` : `staff.${id}`), icon: STAFF[id].icon });
  return out;
}

// ---------- Loan (💰 under the gear) ----------
/** Loan packs (cash now, interest when exchanged for Gold; part of every income repays it) and the open loan with its progress. */
export function loanSheet(ctx) {
  // Two clear places (founder 2026-11-07: "Trả số xu đang có" was too easy to hit by mistake):
  //  · Borrow tab — the 3 packs; each new loan is its own entry (≤ LOAN.maxOpen), with its own term in played minutes,
  //    a pack level and the credit limit (management-rules §2.7); a lock says why a pack cannot be taken now.
  //  · Repay tab (only while in debt) — the debt, its progress, then "how much?" chips, a preview of what is left
  //    after paying, and one Pay button that asks to confirm.
  let pending = false, tab = null, pick = null, paySrc = 'gold';
  async function take(amount) {
    if (pending) return;
    pending = true;
    const txId = newTxId('loan');
    ctx.sheet.rerender();
    try {
      const owed = loanOwed(amount);
      const yes = await ctx.confirm({ title: T('hud.loan.confirmTitle', { n: fmt(amount) }), body: T('hud.loan.confirmBody', { owed: fmt(owed), interest: Math.round(loanRate() * 100), pct: Math.round(LOAN.autoRepay * 100) }),
        costLabel: T('hud.loan.owedLine', { n: fmt(owed) }), confirmLabel: T('hud.loan.take') });
      if (yes) { const r = ctx.act('loan/take', { amount }, { txId }); if (r.ok && !r.duplicate) ctx.toast(T('hud.toast.loanTaken', { n: fmt(amount) }), 'good'); }
    } finally { pending = false; ctx.sheet.rerender(); }
  }
  // Why a pack is locked now (null = it can be borrowed): its level, the loan count, the credit limit, a late loan.
  function loanLock(s, amount) {
    const err = loanError(s, amount);
    if (err === 'level') return lockTag(T('hud.levelN', { level: LOAN.packLevel[amount] }));
    if (err === 'loanMax') return lockTag(T('hud.loan.lockMax', { max: LOAN.maxOpen }));
    if (err === 'credit') return lockTag(T('hud.loan.lockCredit'));
    if (err === 'loanBlocked') return lockTag(T('hud.loan.lockBlocked'));
    return null;
  }
  async function repay(amount, owed, from) {
    if (pending) return;
    pending = true;
    ctx.sheet.rerender();
    try {
      const left = Math.max(0, Math.ceil(owed - amount));
      const label = from === 'usd' ? T('hud.loan.payBtnUsd', { n: fmt(amount) }) : T('hud.loan.payBtn', { n: fmt(amount) });
      const yes = await ctx.confirm({ title: `${label}?`,
        body: left > 0 ? T('hud.loan.payConfirmLeft', { n: fmt(left) }) : T('hud.loan.payConfirmDone'), confirmLabel: label });
      if (yes) {
        const r = ctx.act('loan/repay', { amount, from });
        if (r.ok && !r.noop && !r.events?.some(e => e.type === 'loanRepaid')) ctx.toast(T('hud.toast.loanPaid'), 'good'); // paid off → the feedback toast
        pick = null;
      }
    } finally { pending = false; ctx.sheet.rerender(); }
  }
  return s => {
    const loan = loanOf(s); // every open loan added up (the oldest first in loan.loans)
    if (!loan) tab = 'borrow'; else if (!tab) tab = 'repay';
    const out = h('div', { class: 'hud-loan' });
    if (loan) {
      const tabBtn = (id, label) => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `loanTab-${id}` }, attrs: { 'aria-pressed': String(tab === id) },
        on: { click: () => { if (tab !== id) { tab = id; ctx.sheet.rerender(); } } } }, label);
      out.append(h('div', { class: 'hud-tabs hud-loan-tabs', attrs: { role: 'group', 'aria-label': T('hud.loan.tabs') } },
        tabBtn('repay', `💸 ${T('hud.loan.tabRepay')} ${fmt(loan.owed)}`),
        tabBtn('borrow', `💰 ${T('hud.loan.tabBorrow')}`)));
    }
    if (tab === 'repay' && loan) {
      const total = loanOwed(loan.amount);
      const paid = Math.max(0, Math.min(1, 1 - loan.owed / total));
      const usdValue = goldForCents(usdOf(s)), coinsHave = Math.floor(s.player.coins);
      if (paySrc === 'usd' && usdValue <= 0) paySrc = 'gold'; else if (paySrc === 'gold' && coinsHave <= 0 && usdValue > 0) paySrc = 'usd';
      const byUsd = paySrc === 'usd', owed = Math.ceil(loan.owed), max = Math.min(owed, byUsd ? Math.floor(usdValue) : coinsHave);
      out.append(h('section', { class: 'hud-panel hud-loan-open' },
        h('p', { class: 'hud-loan-owed' }, T('hud.loan.owed'), ' ', fmt(owed)),
        h('div', { class: 'hud-loan-bar', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(paid * 100)) } },
          h('span', { attrs: { style: `width:${Math.round(paid * 100)}%` } })),
        ...loan.loans.map((ln, i) => h('p', { class: 'hud-hint hud-loan-row' },
          T('hud.loan.row', { i: i + 1, amount: fmt(ln.amount), owed: fmt(ln.owed) }))),
        loan.late ? h('p', { class: 'hud-report hud-report--bad' }, T('hud.loan.blocked')) : null,
        h('p', { class: 'hud-hint' }, T('hud.loan.auto', { pct: Math.round(LOAN.autoRepay * 100) }))));
      if (max <= 0) { out.append(h('p', { class: 'hud-hint hud-loan-empty' }, T('hud.loan.noCoins'))); return out; }
      // Amounts: a few round steps under what you can pay, then "everything you can" (all of the debt when you have it).
      const steps = [100, 500, 1000, 2000, 5000, 10000].filter(n => n < max).slice(-3);
      const options = [...steps.map(n => ({ n, label: fmt(n) })), { n: max, label: max >= owed ? T('hud.loan.pickAll') : T('hud.loan.pickMax'), all: true }];
      if (!options.some(o => o.n === pick)) pick = options[0].n;
      const chips = h('div', { class: 'hud-tabs hud-loan-amounts', attrs: { role: 'group', 'aria-label': T('hud.loan.howMuch') } },
        ...options.map(o => h('button', { type: 'button', class: `hud-tab${o.all ? ' is-all' : ''}`, dataset: { hudId: `loanPay-${o.all ? 'all' : o.n}` }, attrs: { 'aria-pressed': String(pick === o.n) },
          on: { click: () => { pick = o.n; ctx.sheet.rerender(); } } }, o.all ? h('span', null, o.label, h('small', null, fmt(o.n))) : o.label)));
      const left = Math.max(0, owed - pick), after = byUsd ? fmt(Math.max(0, usdOf(s) - centsForGold(pick)) / 100) : fmt(coinsHave - pick);
      const srcBtn = (id, label) => h('button', { type: 'button', class: 'hud-tab', dataset: { hudId: `loanFrom-${id}` }, attrs: { 'aria-pressed': String(paySrc === id) }, on: { click: () => { if (paySrc !== id) { paySrc = id; pick = null; ctx.sheet.rerender(); } } } }, label);
      out.append(h('section', { class: 'hud-panel hud-loan-pay' },
        usdValue > 0 && coinsHave > 0 ? h('div', { class: 'hud-tabs hud-loan-tabs', attrs: { role: 'group', 'aria-label': T('hud.loan.tabs') } }, srcBtn('gold', T('hud.loan.fromGold')), srcBtn('usd', T('hud.loan.fromUsd'))) : null,
        h('h3', { class: 'hud-h3' }, T('hud.loan.howMuch')),
        chips,
        h('p', { class: 'hud-loan-after' }, T(byUsd ? (left > 0 ? 'hud.loan.afterLeftUsd' : 'hud.loan.afterDoneUsd') : (left > 0 ? 'hud.loan.afterLeft' : 'hud.loan.afterDone'), { owe: fmt(left), coins: after, usd: after })),
        actionButton({ id: 'loanRepay', label: byUsd ? T('hud.loan.payBtnUsd', { n: fmt(pick) }) : T('hud.loan.payBtn', { n: fmt(pick) }), tone: 'go', disabled: pending, onClick: () => repay(pick, loan.owed, paySrc) })));
      return out;
    }
    if (loan?.late) out.append(h('p', { class: 'hud-report hud-report--bad' }, T('hud.loan.blocked')));
    const packs = h('div', { class: 'hud-loan-packs' });
    LOAN.packs.forEach((amount, i) => {
      packs.append(h('div', { class: `hud-loan-pack tier-${i + 1}` },
        h('span', { class: 'hud-loan-pack-ico', attrs: { 'aria-hidden': 'true' } }, ['💰', '💰💰', '💰💰💰'][i] || '💰'),
        h('strong', { class: 'hud-loan-pack-amount' }, fmt(amount)),
        h('span', { class: 'hud-loan-pack-owed' }, T('hud.loan.interestShort', { pct: Math.round(loanRate() * 100) })),
        loanLock(s, amount) || actionButton({ id: `loan-${amount}`, label: T('hud.loan.take'), tone: 'gold', disabled: pending, onClick: () => take(amount) })));
    });
    out.append(packs, h('p', { class: 'hud-loan-note' }, h('span', { class: 'hud-coin-ico', attrs: { 'aria-hidden': 'true' } }), T('hud.loan.autoShort', { pct: Math.round(LOAN.autoRepay * 100) })));
    return out;
  };
}

// Manage: everything used less often, one tap away. Tiles only; each opens its own sheet.
export function manageSheet(ctx) {
  const tiles = [['upgrades', '⭐'], ['quests', '📜'], ['journal', '📓']]; // Loan and World map sit in the top rail; the capital book opens from the money pills
  return () => h('div', { class: 'gu-tiles' }, tiles.map(([id, icon]) => h('button', { type: 'button', class: 'gu-tile', dataset: { hudId: `manage-${id}` },
    on: { click: () => ctx.onTool(id) } }, h('span', { class: 'gu-tile-ico', attrs: { 'aria-hidden': 'true' } }, icon), h('span', { class: 'gu-tile-label' }, T(`hud.manage.${id}`)))));
}
