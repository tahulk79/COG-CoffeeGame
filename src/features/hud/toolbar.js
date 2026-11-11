// Bottom toolbar (thumb zone). Each screen has its own menu (founder's rule "mỗi màn hình có menu phù hợp"):
//  · farm: Build (planting is its Sow tab), Staff, Storage, Manage
//  · café: Build (café menu), Menu (drinks), [🫘 Buy beans], Staff (café), Manage
// Each region is ONE game (farm or café, picked on the world map), so there is no farm ⇄ café switch any more: the big
// middle button is the beans link of that game — the farm sells its beans, the café imports beans.
// The World map and Loan are in the top rail. Five menus per screen; everything used less often is inside Manage.
// Red dot when something is new or affordable. Buttons of the other screen are hidden (never removed: the tutorial and
// tests can still find them by id).
import { BUILD_MENU_FARM, BUILD_MENU_CAFE, BUILDINGS, CROPS, CROP_ORDER, DRINK_ORDER, STAFF, STAFF_ORDER, BEANS, ITEM_GOODS } from '../../core/config/economy.js';
import { readOnlyPass, ownedPlots, plotState, buildError, countOf, maxCount, useOf, defOf, staffError, unitBlocked, upgradableStats, zoneUnits, unlockedCrops, unlockedDrinks, freeSlots, region, upgradeError, capacity, stored, goodCount, beanBuyQuote, tasksOpen } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T } from './text.js';
import { drinkSeenKey } from './sheets.js';
import { useFarmArt } from './farm-assets.js';
import { questsReady } from '../../core/quests.js';

export const TOOLS = [
  { id: 'seeds', icon: '🌱', views: [] }, // founder 2026-11-10: no Plant button; the picker still opens from a field's "change seed"
  { id: 'build', icon: '🔨', views: ['farm', 'cafe'] },
  { id: 'menu', icon: '📋', views: ['cafe'] },
  { id: 'staff', icon: '👥', views: ['farm', 'cafe'] },
  { id: 'storage', icon: '📦', views: ['farm'] },
  { id: 'manage', icon: '📒', views: ['farm', 'cafe'] }, // upgrades, quests, journal
  { id: 'world', icon: '🌍', views: [] },             // World map: button in the Progress sheet
  { id: 'progress', icon: '⭐', views: [] }, // the Progress menu is gone (founder 2026-11-08)
];
const VIEW_SLOT = 2; // the view switch sits in the middle (after the first two tools of the screen)

export const seenKey = cropId => `hudCrop:${cropId}`;

/** Which tools deserve a red dot right now (cheap: only runs on store changes). */
export function toolDots(s, view = 'farm') {
  const r = region(s);
  const dots = {};
  // Something new to build: a type not built yet (max ≥ 1), unlocked and affordable — never decor (D.defOf: 'field' is no BUILDINGS entry).
  dots.build = !!r && (view === 'cafe' ? BUILD_MENU_CAFE : BUILD_MENU_FARM).some(type => !!defOf(type) && useOf(type) !== 'decor' && countOf(s, type) === 0 && maxCount(s, type) >= 1 && !buildError(s, type));
  // New crop / drink unlocked and not looked at yet (the starter one never counts). Marked seen by its sheet.
  dots.seeds = unlockedCrops(s).some(id => id !== CROP_ORDER[0] && !s.story.seen?.[seenKey(id)]);
  if (view === 'farm' && dots.seeds) dots.build = true; // planting lives in Build now
  dots.menu = unlockedDrinks(s).some(id => id !== DRINK_ORDER[0] && !s.story.seen?.[drinkSeenKey(id)]);
  const silo = r?.buildings.find(b => b.type === 'silo');
  dots.storage = !!silo && !upgradeError(s, silo);
  const zone = view === 'cafe' ? 'shop' : 'farm';
  // Staff (docs/design/staff-manager.md §10): a unit of this game here is blocked, a rival is poaching, a stat upgrade is
  // affordable; also an unassigned unit with a free slot, or (team still empty) an affordable first hire.
  const now = Date.now();
  const here = s.staff.units.filter(u => STAFF[u.type]?.zone === zone && u.assigned?.regionId === s.world.currentRegion);
  const idle = !!r && freeSlots(s, zone) > 0 && s.staff.units.some(u => !u.assigned && STAFF[u.type]?.zone === zone);
  const firstHire = !!r && !zoneUnits(s, zone).length && STAFF_ORDER.some(type => STAFF[type].zone === zone && !staffError(s, type));
  dots.staff = tasksOpen(s).length > 0 || !!s.gm?.chaos || !!s.gm?.unit?.strike || here.some(u => unitBlocked(u, now) || upgradableStats(s, u).length > 0) || idle || firstHire;
  dots.world = false;
  // Only for what the Manage menu can act on: a finished quest to collect (money warnings have their own chip top-left).
  dots.manage = !!r && r.mode !== 'cafe' && questsReady(s) > 0;
  // Beans link: farm → storehouse full (sell!); café → almost out of beans and a pack can be bought.
  const cap = r ? capacity(s) : 0;
  dots.trade = !!r && (view === 'cafe' ? s.inventory.beans < 2 && !beanBuyQuote(s).error : cap > 0 && stored(s) >= cap);
  return dots;
}

/**
 * Farm middle button: plain "Sell beans" while the farm only has beans; once a processed good is stored or a
 * processing building stands, it becomes the Storehouse (same tap: the storehouse card with every good).
 */
export function farmHasGoods(s) {
  const r = region(s);
  return !!r && (ITEM_GOODS.some(g => goodCount(s, g) > 0) || r.buildings.some(b => !!BUILDINGS[b.type]?.recipe));
}

/** Customers waiting at the counter of the current region. */
export function waitingCustomers(s) {
  const orders = region(s)?.shop.orders || [];
  let n = 0;
  for (const o of orders) if (o.stage === 'waiting') n++;
  return n;
}

export function createToolbar(ctx) {
  const buttons = {};
  // Middle button: the beans link of this game (farm: sell at the storehouse; café: buy from the supplier).
  const viewIco = h('span', { class: 'hud-tool-ico', attrs: { 'aria-hidden': 'true' } }, '🫘');
  const viewLabel = h('span', { class: 'hud-tool-label' }, T('hud.trade.sell'));
  const viewBadge = h('span', { class: 'hud-view-badge', hidden: true, attrs: { 'aria-hidden': 'true' } });
  const viewBtn = h('button', { id: 'hud-btn-trade', class: 'hud-tool hud-view', type: 'button', dataset: { hudId: 'trade', view: 'farm' },
    on: { click: () => ctx.onTool(ctx.realm?.view === 'cafe' ? 'beans' : 'storage') } }, viewIco, viewLabel, viewBadge);
  useFarmArt(viewIco, 'ui/nav-sell.png');
  for (const tool of TOOLS) {
    const icon = h('span', { class: 'hud-tool-ico', attrs: { 'aria-hidden': 'true' } }, tool.icon);
    const dot = h('span', { class: 'hud-dot', attrs: { 'aria-hidden': 'true' } });
    const btn = h('button', { id: `hud-btn-${tool.id}`, class: 'hud-tool', type: 'button', dataset: { hudId: tool.id },
      on: { click: () => ctx.onTool(tool.id) } },
    icon, h('span', { class: 'hud-tool-label' }, T(`hud.tool.${tool.id}`)), dot);
    useFarmArt(icon, `ui/nav-${tool.id}.png`);
    buttons[tool.id] = { btn, icon, dot, tool };
  }
  // Harvest every ripe tree in one tap; only there while at least two are ripe and nothing else (Auto, another game) is in charge.
  const harvestCount = h('b');
  const harvestBtn = h('button', { type: 'button', class: 'hud-harvest-all', hidden: true, dataset: { hudId: 'harvestAll' }, on: { click: () => { harvestBtn.hidden = true; ctx.act('farm/harvestAll'); } } },
    h('span', { class: 'hud-harvest-ico', attrs: { 'aria-hidden': 'true' } }, '🧺'), h('span', null, T('hud.harvestAll.btn')), harvestCount);
  let harvestPoll = 0;
  function updateHarvest(view) {
    const t = performance.now();
    if (t - harvestPoll < 400) return;
    harvestPoll = t;
    const s = ctx.store.state, now = Date.now();
    const ripe = view === 'farm' && !ctx.isAuto?.() ? readOnlyPass(s, () => ownedPlots(s).reduce((n, p) => n + (plotState(s, p.id, now).stage === 'ready' ? 1 : 0), 0)) : 0; // one staff-bonus sum for all plots
    harvestBtn.hidden = ripe < 2;
    setText(harvestCount, String(ripe));
  }
  const el = h('nav', { class: 'hud-toolbar', attrs: { 'aria-label': T('hud.toolbar') } });
  let lastCrop = null;
  let viewSig = '';
  let layoutView = null;
  let lastState = null;

  // Rebuilds the button order for a screen (only when the view changes).
  function layout(view) {
    if (view === layoutView) return;
    layoutView = view;
    const shown = TOOLS.filter(t => t.views.includes(view)).map(t => buttons[t.id].btn);
    for (const t of TOOLS) buttons[t.id].btn.hidden = !t.views.includes(view);
    // the farm has no Sell button any more (the storage pill opens the sell list); the café keeps its bean-buying button
    if (view !== 'farm') shown.splice(VIEW_SLOT, 0, viewBtn);
    const hidden = TOOLS.filter(t => !t.views.includes(view)).map(t => buttons[t.id].btn);
    el.replaceChildren(...shown, ...hidden, harvestBtn);
    el.dataset.view = view;
  }
  layout(ctx.realm?.view || 'farm');

  let tradeMode = '';
  // The farm's middle button: 🫘 Sell beans (tutorial 'sell' step) → 📦 Storehouse once goods are processed.
  function tradeLabel(s) {
    const view = ctx.realm?.view || 'farm';
    const mode = view === 'cafe' ? 'buy' : farmHasGoods(s) ? 'store' : 'sell';
    if (mode === tradeMode) return;
    tradeMode = mode;
    if (!viewIco.classList.contains('has-art')) setText(viewIco, mode === 'store' ? '📦' : '🫘');
    setText(viewLabel, T(mode === 'buy' ? 'hud.trade.buy' : mode === 'store' ? 'fw.goods.title' : 'hud.trade.sell'));
    viewBtn.setAttribute('aria-label', mode === 'store' ? T('fw.goods.title') : T(mode === 'buy' ? 'hud.trade.buyAria' : 'hud.trade.sellAria', { price: mode === 'buy' ? BEANS.buyPrice : BEANS.sellPrice }));
  }
  function render(s) {
    lastState = s;
    const dots = toolDots(s, ctx.realm?.view || 'farm');
    for (const [id, b] of Object.entries(buttons)) b.btn.classList.toggle('has-dot', !!dots[id]);
    viewBadge.hidden = !dots.trade; setText(viewBadge, '!');
    tradeLabel(s);
  }
  // The Seeds button shows the active crop icon (realm owns the active crop).
  function update() {
    const crop = ctx.realm?.activeCrop;
    if (crop !== lastCrop) { lastCrop = crop; if (!buttons.seeds.icon.classList.contains('has-art')) setText(buttons.seeds.icon, CROPS[crop]?.icon || '🌱'); }
    const view = ctx.realm?.view || 'farm';
    updateHarvest(view);
    if (view === viewSig) return;
    viewSig = view;
    ctx.root.dataset.view = view;
    viewBtn.dataset.view = view;
    tradeMode = ''; // label follows the screen (and the farm's goods): set in render
    layout(view);
    if (lastState) render(lastState); // staff / trade dots depend on the screen
  }
  return { el, render, update, tradeButton: viewBtn, viewButton: viewBtn, button: id => (id === 'trade' || id === 'view' ? viewBtn : buttons[id]?.btn || null), dispose() {} };
}
