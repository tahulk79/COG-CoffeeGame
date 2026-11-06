// Bottom toolbar (thumb zone). Each screen has its own menu (founder's rule "mỗi màn hình có menu phù hợp"):
//  · farm: Seeds, Build (farm menu: dryer + decor), [☕ Café], Staff (farm), Progress
//  · café: Build (café menu), Menu (drinks), [🌱 Farm], Staff (café), Progress
// The World map moved into the Progress sheet (and the World Gate on the farm).
// Exactly 4 menus per screen (founder). The storehouse opens from the 🫘 bean pill at the top.
// The big middle button switches the realm view; on the farm it shows a badge with the customers waiting at the café.
// Red dot when something is new or affordable. Buttons of the other screen are hidden (never removed: the tutorial and
// tests can still find them by id).
import { BUILD_MENU_FARM, BUILD_MENU_CAFE, BUILDINGS, CROPS, CROP_ORDER, DRINK_ORDER, STAFF, STAFF_ORDER, REBIRTH } from '../../core/config/economy.js';
import { buildError, buildingsOf, staffError, unlockedCrops, unlockedDrinks, roundStatus, rebirthError, freeSlots, region, upgradeError } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T } from './text.js';
import { drinkSeenKey } from './sheets.js';

export const TOOLS = [
  { id: 'seeds', icon: '🌱', views: ['farm'] },
  { id: 'storage', icon: '📦', views: [] },          // opened from the bean pill (kept for ids/tutorial)
  { id: 'build', icon: '🔨', views: ['farm', 'cafe'] },
  { id: 'menu', icon: '📋', views: ['cafe'] },
  { id: 'staff', icon: '👥', views: ['farm', 'cafe'] },
  { id: 'world', icon: '🌍', views: [] },             // World map: button in the Progress sheet
  { id: 'progress', icon: '⭐', views: ['farm', 'cafe'] },
];
const VIEW_SLOT = 2; // the view switch sits in the middle (after the first two tools of the screen)

export const seenKey = cropId => `hudCrop:${cropId}`;

/** Which tools deserve a red dot right now (cheap: only runs on store changes). */
export function toolDots(s, view = 'farm') {
  const r = region(s);
  const dots = {};
  dots.build = !!r && (view === 'cafe' ? BUILD_MENU_CAFE : BUILD_MENU_FARM).some(type => !BUILDINGS[type].decor && buildingsOf(s, type).length === 0 && !buildError(s, type));
  // New crop / drink unlocked and not looked at yet (the starter one never counts). Marked seen by its sheet.
  dots.seeds = unlockedCrops(s).some(id => id !== CROP_ORDER[0] && !s.story.seen?.[seenKey(id)]);
  dots.menu = unlockedDrinks(s).some(id => id !== DRINK_ORDER[0] && !s.story.seen?.[drinkSeenKey(id)]);
  const silo = r?.buildings.find(b => b.type === 'silo');
  dots.storage = !!silo && !upgradeError(s, silo);
  const zone = view === 'cafe' ? 'shop' : 'farm';
  const idle = s.staff.units.some(u => !u.assigned && STAFF[u.type]?.zone === zone && r && freeSlots(s, zone) > 0);
  dots.staff = s.staff.units.some(u => u.stopped) || !!r && (idle || STAFF_ORDER.some(type => STAFF[type].zone === zone && !s.staff.units.some(u => u.type === type) && !staffError(s, type)));
  dots.world = false;
  dots.progress = !!roundStatus(s).canUnlock || Object.keys(REBIRTH.blessings).some(k => !rebirthError(s, k));
  return dots;
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
  const viewIco = h('span', { class: 'hud-tool-ico', attrs: { 'aria-hidden': 'true' } }, '☕');
  const viewLabel = h('span', { class: 'hud-tool-label' }, T('hud.view.cafe'));
  const viewBadge = h('span', { class: 'hud-view-badge', hidden: true, attrs: { 'aria-hidden': 'true' } });
  const viewBtn = h('button', { id: 'hud-btn-view', class: 'hud-tool hud-view', type: 'button', dataset: { hudId: 'view', view: 'farm' },
    on: { click: () => ctx.switchView?.() } }, viewIco, viewLabel, viewBadge);
  for (const tool of TOOLS) {
    const icon = h('span', { class: 'hud-tool-ico', attrs: { 'aria-hidden': 'true' } }, tool.icon);
    const dot = h('span', { class: 'hud-dot', attrs: { 'aria-hidden': 'true' } });
    const btn = h('button', { id: `hud-btn-${tool.id}`, class: 'hud-tool', type: 'button', dataset: { hudId: tool.id },
      on: { click: () => ctx.onTool(tool.id) } },
    icon, h('span', { class: 'hud-tool-label' }, T(`hud.tool.${tool.id}`)), dot);
    buttons[tool.id] = { btn, icon, dot, tool };
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
    shown.splice(VIEW_SLOT, 0, viewBtn);
    const hidden = TOOLS.filter(t => !t.views.includes(view)).map(t => buttons[t.id].btn);
    el.replaceChildren(...shown, ...hidden);
    el.dataset.view = view;
  }
  layout(ctx.realm?.view || 'farm');

  function render(s) {
    lastState = s;
    const dots = toolDots(s, ctx.realm?.view || 'farm');
    for (const [id, b] of Object.entries(buttons)) b.btn.classList.toggle('has-dot', !!dots[id]);
  }
  // The Seeds button shows the active crop icon (realm owns the active crop).
  function update() {
    const crop = ctx.realm?.activeCrop;
    if (crop !== lastCrop) { lastCrop = crop; setText(buttons.seeds.icon, CROPS[crop]?.icon || '🌱'); }
    // View button: label = where it takes you. Badge (farm only) = customers waiting at the café.
    const view = ctx.realm?.view || 'farm';
    const waiting = view === 'farm' ? waitingCustomers(ctx.store.state) : 0;
    const sig = `${view}|${waiting}`;
    if (sig === viewSig) return;
    const viewChanged = !viewSig.startsWith(`${view}|`);
    viewSig = sig;
    const toCafe = view === 'farm';
    if (viewChanged) {
      ctx.root.dataset.view = view;
      viewBtn.dataset.view = view;
      setText(viewIco, toCafe ? '☕' : '🌱');
      setText(viewLabel, T(toCafe ? 'hud.view.cafe' : 'hud.view.farm'));
      layout(view);
      if (lastState) render(lastState); // staff dot depends on the screen
    }
    viewBadge.hidden = !waiting;
    setText(viewBadge, waiting > 9 ? '9+' : String(waiting));
    viewBtn.setAttribute('aria-label', waiting ? T('hud.view.toCafeWaiting', { n: waiting }) : T(toCafe ? 'hud.view.toCafe' : 'hud.view.toFarm'));
  }
  return { el, render, update, viewButton: viewBtn, button: id => (id === 'view' ? viewBtn : buttons[id]?.btn || null), dispose() {} };
}
