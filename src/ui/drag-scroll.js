// Horizontal shelves scroll by finger natively; a mouse has to be able to drag them too. A drag never counts as a tap on a tile.
const SHELVES = '.hud-cat-grid,.hud-seedgrid,.hud-land-list,.atlas-regions';

export function installDragScroll() {
  let active = null;
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = e.target.closest?.(SHELVES);
    if (el && el.scrollWidth > el.clientWidth) active = { el, x: e.clientX, left: el.scrollLeft, moved: false };
  }, true);
  addEventListener('pointermove', e => {
    if (!active) return;
    const dx = e.clientX - active.x;
    if (Math.abs(dx) > 6) active.moved = true;
    if (active.moved) active.el.scrollLeft = active.left - dx;
  }, true);
  addEventListener('pointerup', () => {
    if (active?.moved) {
      const swallow = e => { e.stopPropagation(); e.preventDefault(); };
      addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => removeEventListener('click', swallow, true), 60); // released off the tile: no click comes, the next real tap must count
    }
    active = null;
  }, true);
}
