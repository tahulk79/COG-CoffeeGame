// Bottom toolbar (thumb zone): Build, Seeds, Staff, World, Progress. Red dot when something new or affordable.
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

export function createToolbar(ctx) {
  const buttons = {};
  const el = h('nav', { class: 'hud-toolbar', attrs: { 'aria-label': T('hud.toolbar') } },
    TOOLS.map(tool => {
      const icon = h('span', { class: 'hud-tool-ico', attrs: { 'aria-hidden': 'true' } }, tool.icon);
      const dot = h('span', { class: 'hud-dot', attrs: { 'aria-hidden': 'true' } });
      const btn = h('button', { id: `hud-btn-${tool.id}`, class: 'hud-tool', type: 'button', dataset: { hudId: tool.id },
        on: { click: () => ctx.onTool(tool.id) } },
      icon, h('span', { class: 'hud-tool-label' }, T(`hud.tool.${tool.id}`)), dot);
      buttons[tool.id] = { btn, icon, dot };
      return btn;
    }));
  let lastCrop = null;

  function render(s) {
    const dots = toolDots(s);
    for (const [id, b] of Object.entries(buttons)) b.btn.classList.toggle('has-dot', !!dots[id]);
  }
  // The Seeds button shows the active crop icon (realm owns the active crop).
  function update() {
    const crop = ctx.realm?.activeCrop;
    if (crop !== lastCrop) { lastCrop = crop; setText(buttons.seeds.icon, CROPS[crop]?.icon || '🌱'); }
  }
  return { el, render, update, button: id => buttons[id]?.btn || null, dispose() {} };
}
