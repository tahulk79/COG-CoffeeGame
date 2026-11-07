// Sheet contents: Build (café), Seeds (farm), Menu (café drinks) and Progress (Round + Rebirth). Staff: staff-modal.js.
// Pure render functions of the store state. Each screen has its own toolbar (toolbar.js), so sheets filter by view.
import { BUILD_MENU, BUILD_MENU_FARM, BUILD_MENU_CAFE, BUILDINGS, CATEGORY_ORDER, AUTO, autoPrice, CROPS, CROP_ORDER, STAFF, STAFF_ORDER, LOAN, loanOwed, DRINKS, DRINK_ORDER, BEANS } from '../../core/config/economy.js';
import { buildError, buildingLevel, defOf, useOf, countOf, maxCount, nextLimitLevel, buildCost, fieldAllowance, frontierParcels, parcelError, stored, cropUnlocked, drinkUnlocked, drinkPrice, brewMs, seedCost, growMs, level, region, capacity, beanBuyQuote, upgradeError, upgradeCost } from '../../core/derive.js';
import { PARCELS, terrainOfLot } from '../../core/config/layout.js';
import { newTxId } from '../../core/store.js';
import { h } from './dom.js';
import { localItemsOf } from '../../ui/local-menu.js';
import { T, fmt, duration, has } from './text.js';
import { buildingEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';

// ---------- Build (construction catalog) ----------
// Category tabs (CATEGORY_ORDER[view]; the farm adds a Land tab) over a grid of compact cards: big icon, name, cost and
// one line of benefit, with a small n/max chip. States: available · can't afford (cost in red, a tap says how many coins
// are missing) · locked by level ("Lv N") · maxed ("More at Lv N" / "Max built"). An available card closes the sheet
// and starts placing (data-hud-id="build-<type>" is the tutorial's target). The last tab per screen is remembered
// (memory only). Never BUILDINGS[type] for a menu entry: 'field' lives in FIELD (D.defOf).
export const CAT_ICON = { farming: '🌱', processing: '🏭', storage: '📦', infrastructure: '💧', decoration: '🌼', cafe: '☕', land: '🏷️' };
export const TERRAIN_ICON = { meadow: '🌾', garden: '🌷', pasture: '🐄', orchard: '🍎', pond: '🦆', hill: '⛰️', shop: '☕', road: '🛤️', plaza: '⛩️', wild: '🌿' };
const LAND_ROWS = 12;
export const buildView = ctx => (ctx.realm?.view === 'cafe' ? 'cafe' : 'farm');
export const buildTabs = view => [...(CATEGORY_ORDER[view] || []), ...(view === 'farm' ? ['land'] : [])];
const buildMenu = view => (view === 'cafe' ? BUILD_MENU_CAFE : BUILD_MENU_FARM);
/** The catalog tab shown for the current screen (last one picked, else the first). */
export function buildTab(ctx) {
  const view = buildView(ctx), tabs = buildTabs(view), t = ctx.buildTab?.[view];
  return tabs.includes(t) ? t : tabs[0];
}
export function setBuildTab(ctx, tab) {
  const view = buildView(ctx);
  if (buildTabs(view).includes(tab)) ctx.buildTab = { ...(ctx.buildTab || {}), [view]: tab };
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

function catalogCard(ctx, m) {
  const def = defOf(m.type), name = T(`building.${m.type}`);
  const desc = useOf(m.type) === 'decor' ? T('fw.desc.decor') : has(`fw.desc.${m.type}`) ? T(`fw.desc.${m.type}`) : buildingEffect(m.type, 1, false);
  let state = '', foot;
  if (m.err === 'round') { state = 'locked'; foot = lockTag(T('hud.roundN', { round: def.round })); }
  else if (m.err === 'level') { state = 'locked'; foot = lockTag(T('fw.catalog.unlockAt', { level: def.level })); }
  else if (m.err === 'limit') { state = 'maxed'; foot = h('span', { class: 'hud-tag hud-tag--max' }, m.next ? T('fw.catalog.nextAt', { level: m.next }) : T('fw.catalog.maxed')); }
  else if (m.freeLeft != null) foot = h('span', { class: 'hud-cost hud-cost--free' }, T('fw.field.free', { n: m.freeLeft }));
  else foot = coinAmount(m.cost, m.err === 'coins' ? 'is-short' : '');
  const price = m.freeLeft != null ? T('hud.free') : fmt(m.cost);
  return h('button', { type: 'button', class: `hud-card hud-cat-card${state ? ` is-${state}` : ''}${m.err === 'coins' ? ' is-short' : ''}`,
    dataset: { hudId: `build-${m.type}` }, attrs: { 'aria-disabled': state ? 'true' : null, 'aria-label': `${name} · ${state ? foot.textContent : price}` },
    on: { click: () => pickCard(ctx, m.type) } },
  m.max > 0 && state !== 'locked' ? h('span', { class: `hud-cat-count${m.count >= m.max ? ' is-full' : ''}` }, T('fw.catalog.count', { n: m.count, max: m.max })) : null,
  h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
  h('span', { class: 'hud-card-name' }, name),
  h('span', { class: 'hud-cat-foot' }, foot),
  h('span', { class: 'hud-card-fx' }, desc));
}

// Land tab: lots for sale, cheapest first (terrain icon, name, price, Buy) + "Show land for sale" on the map.
function landTab(ctx, s) {
  const lots = landLots(s);
  const out = h('div', { class: 'hud-land' },
    h('div', { class: 'hud-row hud-land-top' }, actionButton({ id: 'landExpand', label: T('fw.catalog.expand'), icon: '🗺️', tone: 'plain',
      onClick: () => { ctx.sheet.close(); ctx.setLandMode?.('expand'); } })));
  if (!lots.length) { out.append(h('p', { class: 'hud-line hud-line--good' }, T('fw.catalog.allOwned'))); return out; }
  out.append(h('p', { class: 'hud-hint' }, T('fw.catalog.landHint')));
  const list = h('ul', { class: 'hud-land-list' });
  for (const p of lots.slice(0, LAND_ROWS)) {
    const terrain = terrainOfLot(p.id), short = parcelError(s, p.id) === 'coins';
    // Never disabled when short: the tap goes through ctx.act, whose toast says how many coins are missing.
    const buy = actionButton({ id: `buyLot-${p.id}`, label: T('hud.buy'), cost: p.cost, tone: 'gold', onClick: () => ctx.act('land/buyParcel', { parcelId: p.id }) });
    if (short) buy.classList.add('is-short');
    list.append(h('li', { class: 'hud-land-row' },
      h('span', { class: 'hud-land-ico', attrs: { 'aria-hidden': 'true' } }, TERRAIN_ICON[terrain] || '🌾'),
      h('span', { class: 'hud-land-text' }, h('strong', null, T(`hud.parcel.${p.kind}`, { id: p.id })), h('small', null, T(`fw.land.terrain.${terrain}`))),
      buy));
  }
  out.append(list);
  return out;
}
const landLots = s => frontierParcels(s).map(id => PARCELS[id]).filter(Boolean).sort((a, b) => a.cost - b.cost);

export function buildSheet(ctx) {
  const models = s => buildMenu(buildView(ctx)).map(type => cardModel(s, type)).filter(Boolean);
  const render = s => {
    const view = buildView(ctx), tab = buildTab(ctx), all = models(s);
    const tabs = h('div', { class: 'hud-cat-tabs', attrs: { role: 'tablist', 'aria-label': T('fw.catalog.title') } },
      ...buildTabs(view).map(id => h('button', { type: 'button', class: 'hud-cat-tab', dataset: { hudId: `buildTab-${id}` },
        attrs: { role: 'tab', 'aria-selected': String(id === tab) }, on: { click: () => { if (buildTab(ctx) === id) return; setBuildTab(ctx, id); ctx.sheet.rerender(); } } },
      h('span', { class: 'hud-cat-tab-ico', attrs: { 'aria-hidden': 'true' } }, CAT_ICON[id] || '🔨'),
      h('span', { class: 'hud-cat-tab-label' }, T(`fw.cat.${id}`)),
      all.some(m => m.cat === id && isNew(m)) ? h('span', { class: 'hud-dot', attrs: { 'aria-hidden': 'true' } }) : null)));
    if (tab === 'land') return h('div', { class: 'hud-catalog' }, tabs, landTab(ctx, s));
    const grid = h('div', { class: 'hud-cards hud-cat-grid' }, all.filter(m => m.cat === tab).map(m => catalogCard(ctx, m)));
    return h('div', { class: 'hud-catalog' }, tabs, grid);
  };
  // Signature: the tab + every card's state (+ the land list): a sale or a staff harvest does not rebuild the grid.
  render.sig = s => {
    const view = buildView(ctx), tab = buildTab(ctx);
    const land = tab === 'land' ? landLots(s).slice(0, LAND_ROWS).map(p => `${p.id}:${parcelError(s, p.id) || ''}`).join(',') : '';
    return `${view}|${tab}|${JSON.stringify(models(s))}|${land}`;
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
      const chip = h('button', { type: 'button', class: `hud-seed${id === active ? ' is-active' : ''}${open ? '' : ' is-locked'}`, disabled: !open,
        attrs: { 'aria-pressed': String(id === active) },
        on: { click: () => { ctx.realm?.setActiveCrop?.(id); ctx.sheet.close(); ctx.toast(T('hud.seedPicked', { crop: T(`crop.${id}`) }), 'info'); } } },
      h('span', { class: 'hud-seed-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
      h('span', { class: 'hud-seed-name' }, T(`crop.${id}`)),
      open ? h('span', { class: 'hud-seed-meta' }, coinAmount(cost), h('span', null, `⏱ ${duration(region(s) ? growMs(s, id) : def.growSeconds * 1000)}`), h('span', null, `🫘 ${def.beans}`))
        : lockTag(s.player.round < def.round ? T('hud.roundN', { round: def.round }) : T('hud.levelN', { level: def.level })));
      list.append(chip);
    }
    return h('div', null, h('p', { class: 'hud-hint' }, T('hud.seeds.hint')), list);
  };
}

// ---------- Menu (café drinks) ----------
export const drinkSeenKey = drinkId => `hudDrink:${drinkId}`;
export function menuSheet() {
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
        local.length ? h('span', { class: 'hud-drink-local' }, local.map(item => `${item.icon} ${item.name}`).join(' · ')) : null,
        open ? h('span', { class: 'hud-seed-meta' }, coinAmount(price), h('span', null, T('hud.menu.beans', { n: def.beans })),
          h('span', null, `⏱ ${duration(hasRegion ? brewMs(s, id) : def.brewSeconds * 1000)}`))
          : h('span', { class: 'hud-seed-meta' }, needs.map(text => lockTag(text)))));
    }
    return h('div', null, h('p', { class: 'hud-hint' }, T('hud.menu.hint')), list);
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
      h('p', { class: 'hud-hint' }, T('hud.beans.hint', { price: BEANS.buyPrice })),
      h('div', { class: 'hud-row' }, actionButton({ id: 'buyBeans', label, icon: '🫘', cost: q.error ? null : q.cost, disabled: !!q.error, note,
        onClick: () => ctx.act('shop/buyBeans') })),
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

// ---------- Staff ----------
// The staff manager is a full modal now (staff-modal.js, docs/design/staff-manager.md §10).

/** Buys one auto run after a small confirm card; one txId per confirm, so a double tap can never charge twice. */
export async function buyAuto(ctx) {
  if (ctx.buyingAuto) return;
  ctx.buyingAuto = true;
  try {
    const price = autoPrice(ctx.store.state.autoplay?.bought || 0);
    const txId = newTxId('auto');
    const yes = await ctx.confirm({ title: T('hud.auto.buyTitle'), body: T('hud.auto.buyBody', { min: Math.round(AUTO.runSeconds / 60) }), cost: price, confirmLabel: T('hud.auto.buyGo') });
    if (yes) { const r = ctx.act('auto/buy', {}, { txId }); if (r.ok && !r.duplicate) ctx.toast(T('hud.toast.autoBought'), 'good'); }
  } finally { ctx.buyingAuto = false; ctx.sheet.rerender(); }
}

export function progressSheet(ctx) {
  return s => {
    // World map (moved here from the toolbar; the World Gate on the farm opens it too).
    const world = actionButton({ id: 'worldMap', label: T('hud.worldMapBtn'), tone: 'plain', onClick: () => ctx.onTool('world') });
    // Auto play: runs left, start, buy one more with coins.
    const ap = s.autoplay || { runs: 0 };
    const price = autoPrice(ap.bought || 0);
    const auto = h('section', { class: 'hud-panel' }, h('h3', { class: 'hud-h3' }, `🤖 ${T('hud.auto.panel')}`),
      h('p', { class: 'hud-line' }, T('hud.auto.explain', { min: Math.round(AUTO.runSeconds / 60) })),
      h('p', { class: 'hud-sub' }, T('hud.auto.runs', { n: ap.runs || 0 })),
      h('div', { class: 'hud-row' },
        ap.runs > 0 && !ap.active ? actionButton({ label: T('hud.auto.startBtn'), icon: '▶', onClick: () => { ctx.sheet.close(); const r = ctx.act('auto/start'); if (r.ok && !r.noop) ctx.toast(T('hud.toast.autoStart'), 'good'); } }) : null,
        actionButton({ id: 'buyAuto', label: T('hud.auto.buyGo'), icon: '🛒', tone: 'gold', cost: price, disabled: s.player.coins < price || ctx.buyingAuto,
          note: s.player.coins < price ? needMore(price - s.player.coins) : null, onClick: () => buyAuto(ctx) })));
    return h('div', { class: 'hud-progress' }, world, auto);
  };
}

/** Things that unlock exactly at `lvl` (level-up banner). */
export function levelUnlocks(s, lvl) {
  const out = [];
  for (const id of CROP_ORDER) if (CROPS[id].level === lvl && CROPS[id].round <= s.player.round) out.push(`${CROPS[id].icon} ${T(`crop.${id}`)}`);
  for (const id of DRINK_ORDER) if (DRINKS[id].level === lvl) out.push(`${DRINKS[id].icon} ${T(`drink.${id}`)}`);
  for (const id of BUILD_MENU) { const def = defOf(id); if (def && def.level === lvl && def.round <= s.player.round) out.push(`${def.icon} ${T(`building.${id}`)}`); }
  for (const id of STAFF_ORDER) if (STAFF[id].level === lvl && STAFF[id].round <= s.player.round) out.push(`${STAFF[id].icon} ${T(has(`hud.unlock.${id}`) ? `hud.unlock.${id}` : `staff.${id}`)}`);
  return out;
}

// ---------- Loan (💰 under the gear) ----------
/** Loan packs (borrow now, owe it back + fee; part of every income repays it) and the open loan with its progress. */
export function loanSheet(ctx) {
  let pending = false;
  async function take(amount) {
    if (pending) return;
    pending = true;
    const txId = newTxId('loan');
    ctx.sheet.rerender();
    try {
      const owed = loanOwed(amount);
      const yes = await ctx.confirm({ title: T('hud.loan.confirmTitle', { n: fmt(amount) }), body: T('hud.loan.confirmBody', { owed: fmt(owed), pct: Math.round(LOAN.autoRepay * 100) }),
        costLabel: T('hud.loan.owedLine', { n: fmt(owed) }), confirmLabel: T('hud.loan.take') });
      if (yes) { const r = ctx.act('loan/take', { amount }, { txId }); if (r.ok && !r.duplicate) ctx.toast(T('hud.toast.loanTaken', { n: fmt(amount) }), 'good'); }
    } finally { pending = false; ctx.sheet.rerender(); }
  }
  return s => {
    const loan = s.loan && s.loan.owed > 0 ? s.loan : null;
    const out = h('div', { class: 'hud-loan' });
    if (loan) {
      const total = loanOwed(loan.amount);
      const paid = Math.max(0, Math.min(1, 1 - loan.owed / total));
      const pay = Math.min(loan.owed, Math.floor(s.player.coins));
      out.append(h('section', { class: 'hud-panel hud-loan-open' },
        h('h3', { class: 'hud-h3' }, T('hud.loan.open')),
        h('p', { class: 'hud-loan-owed' }, T('hud.loan.owed'), ' ', coinAmount(Math.ceil(loan.owed))),
        h('div', { class: 'hud-loan-bar', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(paid * 100)) } },
          h('span', { attrs: { style: `width:${Math.round(paid * 100)}%` } })),
        h('p', { class: 'hud-hint' }, T('hud.loan.auto', { pct: Math.round(LOAN.autoRepay * 100) })),
        actionButton({ id: 'loanRepay', label: pay >= loan.owed ? T('hud.loan.repayAll') : T('hud.loan.repaySome'), cost: Math.ceil(pay), tone: 'go', disabled: pay <= 0,
          note: pay <= 0 ? T('hud.loan.noCoins') : null, onClick: () => { const r = ctx.act('loan/repay'); if (r.ok && !r.noop && !r.events?.some(e => e.type === 'loanRepaid')) ctx.toast(T('hud.toast.loanPaid'), 'good'); } }))); // paid off → the feedback toast
    }
    out.append(h('p', { class: 'hud-sub' }, T('hud.loan.intro', { pct: Math.round(LOAN.fee * 100) })));
    const packs = h('div', { class: 'hud-loan-packs' });
    LOAN.packs.forEach((amount, i) => {
      const owed = loanOwed(amount);
      packs.append(h('div', { class: `hud-loan-pack tier-${i + 1}` },
        h('span', { class: 'hud-loan-pack-ico', attrs: { 'aria-hidden': 'true' } }, ['💰', '💰💰', '💰💰💰'][i] || '💰'),
        h('strong', { class: 'hud-loan-pack-amount' }, coinAmount(amount)),
        h('span', { class: 'hud-loan-pack-owed' }, T('hud.loan.payBack', { n: fmt(owed) })),
        actionButton({ id: `loan-${amount}`, label: T('hud.loan.take'), tone: 'gold', disabled: pending, onClick: () => take(amount) })));
    });
    out.append(packs);
    return out;
  };
}
