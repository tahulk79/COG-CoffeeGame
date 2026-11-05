import { icon } from './icons.js';
import { t } from '../i18n/index.js';

// Shared "Quản lý" drawer for the farm and café HUD (docs/design/godbean-gdd.md §11): the bar keeps a few
// actions plus this button; secondary buttons/panels are moved into `grid`/`panel` (same nodes, ids and listeners).
export function mountHudDrawer(bar, { signal, id, label = t('ui.hud.manage') }) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'ui-hud-btn hud-manage'; button.dataset.sfx = 'ui.open';
  button.setAttribute('aria-controls', id); button.setAttribute('aria-expanded', 'false');
  const art = document.createElement('span'); art.append(icon('menu'));
  const text = document.createElement('small'); text.textContent = label;
  const badge = document.createElement('b'); badge.className = 'ui-badge hud-manage__badge'; badge.hidden = true;
  button.append(art, text, badge); bar.append(button);
  const drawer = document.createElement('section');
  drawer.id = id; drawer.className = 'hud-drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', label);
  const panel = document.createElement('div'); panel.className = 'hud-drawer__panel';
  const grid = document.createElement('div'); grid.className = 'hud-drawer__grid';
  drawer.append(panel, grid); document.body.append(drawer);
  const setOpen = open => { drawer.hidden = !open; button.setAttribute('aria-expanded', String(open)); };
  button.addEventListener('click', () => setOpen(drawer.hidden), { signal });
  // A grid button opens its own modal, so the drawer steps aside; panels (details) stay open for reading.
  grid.addEventListener('click', event => { if (event.target.closest('button')) setOpen(false); }, { signal });
  document.addEventListener('pointerdown', event => {
    if (!drawer.hidden && !drawer.contains(event.target) && !button.contains(event.target)) setOpen(false);
  }, { signal, capture: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !drawer.hidden) { setOpen(false); button.focus(); }
  }, { signal });
  let count = 0;
  return {
    panel, grid, close: () => setOpen(false),
    // Badge: `n` items waiting (e.g. "Cần xử lý"), else "Mới" while a newly unlocked button inside is unused.
    refresh(n = count) {
      count = n;
      const fresh = grid.querySelector('.ui-new:not([hidden])');
      badge.hidden = !count && !fresh; badge.textContent = count ? String(count) : t('ui.hud.new');
    },
    remove() { drawer.remove(); button.remove(); },
  };
}
