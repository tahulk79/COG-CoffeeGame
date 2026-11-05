// Bottom toolbar (thumb zone): Build, Seeds, [Café ⇄ Farm], Staff, World, Progress. Red dot when something new or
// affordable. The big middle button switches the realm view (the only way into the café); on the farm it shows a badge
// with the number of customers waiting at the café.
import { BUILD_MENU, BUILDINGS, CROPS, CROP_ORDER, STAFF, STAFF_ORDER, REBIRTH } from '../../core/config/economy.js';
import { buildError, buildingsOf, staffError, unlockedCrops, roundStatus, rebirthError, freeSlots, region } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T } from './text.js';

export const TOOLS = [
  { id: 'build', icon: '🔨' },
  { id: 'seeds', icon: '🌱' },
  { id: 'staff', icon: '👥' },
  { id: 'world', icon: '🌍' },
  { id: 'progress', icon: '⭐' },
];

export const seenKey = cropId => `hudCrop:${cropId}`;

/** Which tools deserve a red dot right now (cheap: only runs on store changes). */
export function toolDots(s) {
  const r = region(s);
  const dots = {};
  dots.build = !!r && BUILD_MENU.some(type => !BUILDINGS[type].decor && buildingsOf(s, type).length === 0 && !buildError(s, type));
  // New crop unlocked and not looked at yet (the starter crop never counts). Marked seen by the Seeds sheet.
  dots.seeds = unlockedCrops(s).some(id => id !== CROP_ORDER[0] && !s.story.seen?.[seenKey(id)]);
  const idle = s.staff.units.some(u => !u.assigned && r && freeSlots(s, STAFF[u.type].zone) > 0);
  dots.staff = !!r && (idle || STAFF_ORDER.some(type => !s.staff.units.some(u => u.type === type) && !staffError(s, type)));
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
  const tools = TOOLS.map(tool => {
      const icon = h('span', { class: 'hud-tool-ico', attrs: { 'aria-hidden': 'true' } }, tool.icon);
      const dot = h('span', { class: 'hud-dot', attrs: { 'aria-hidden': 'true' } });
      const btn = h('button', { id: `hud-btn-${tool.id}`, class: 'hud-tool', type: 'button', dataset: { hudId: tool.id },
        on: { click: () => ctx.onTool(tool.id) } },
      icon, h('span', { class: 'hud-tool-label' }, T(`hud.tool.${tool.id}`)), dot);
      buttons[tool.id] = { btn, icon, dot };
      return btn;
    });
  tools.splice(2, 0, viewBtn);
  const el = h('nav', { class: 'hud-toolbar', attrs: { 'aria-label': T('hud.toolbar') } }, tools);
  let lastCrop = null;
  let viewSig = '';

  function render(s) {
    const dots = toolDots(s);
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
    }
    viewBadge.hidden = !waiting;
    setText(viewBadge, waiting > 9 ? '9+' : String(waiting));
    viewBtn.setAttribute('aria-label', waiting ? T('hud.view.toCafeWaiting', { n: waiting }) : T(toCafe ? 'hud.view.toCafe' : 'hud.view.toFarm'));
  }
  return { el, render, update, viewButton: viewBtn, button: id => (id === 'view' ? viewBtn : buttons[id]?.btn || null), dispose() {} };
}
