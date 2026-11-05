// Pointer gesture recognizer on the canvas only (DOM UI above it never reaches here): tap vs drag (8 px threshold),
// two-finger pinch and wheel zoom. Semantics (plant, pan, place…) are decided by the realm through the handlers.
const TAP_SLOP = 8;

/**
 * handlers: { down(p), tap(p), dragStart(start, p), dragMove(p, dx, dy), dragEnd(p), zoom(factor), cancel() }
 * p = { x, y } client pixels (reused object; copy if kept).
 */
export function createInput(canvas, handlers, isLocked) {
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  const pointers = new Map();
  const start = { x: 0, y: 0 }, last = { x: 0, y: 0 }, p = { x: 0, y: 0 };
  let dragging = false, pinching = false, spoiled = false, pinchDist = 0;
  const prevTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  function cancel() {
    if (dragging) handlers.cancel?.();
    dragging = false; pinching = false; spoiled = pointers.size > 0;
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.target !== canvas || isLocked() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    if (pointers.size === 1) {
      start.x = last.x = e.clientX; start.y = last.y = e.clientY;
      dragging = false; pinching = false; spoiled = false;
      p.x = e.clientX; p.y = e.clientY;
      handlers.down?.(p);
    } else if (pointers.size === 2) {
      if (dragging) handlers.cancel?.();
      dragging = false; pinching = true; spoiled = true;
      pinchDist = spread();
    }
  }, opts);

  canvas.addEventListener('pointermove', e => {
    const pt = pointers.get(e.pointerId);
    if (!pt) return;
    if (isLocked()) { cancel(); return; }
    pt.x = e.clientX; pt.y = e.clientY;
    if (pinching) {
      if (pointers.size >= 2) { const d = spread(); if (d > 0 && pinchDist > 0) handlers.zoom?.(pinchDist / d); pinchDist = d; }
      return;
    }
    if (spoiled) return;
    p.x = e.clientX; p.y = e.clientY;
    if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) > TAP_SLOP) {
      dragging = true;
      handlers.dragStart?.(start, p);
    }
    if (dragging) handlers.dragMove?.(p, p.x - last.x, p.y - last.y);
    last.x = p.x; last.y = p.y;
  }, opts);

  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    p.x = e.clientX; p.y = e.clientY;
    if (pinching) { if (pointers.size < 2) pinching = false; spoiled = true; return; }
    if (spoiled || isLocked()) { if (dragging) handlers.cancel?.(); dragging = false; return; }
    if (e.type !== 'pointerup') { if (dragging) handlers.cancel?.(); dragging = false; return; }
    if (dragging) handlers.dragEnd?.(p); else handlers.tap?.(p);
    dragging = false;
  };
  canvas.addEventListener('pointerup', up, opts);
  canvas.addEventListener('pointercancel', up, opts);
  canvas.addEventListener('lostpointercapture', up, opts);
  canvas.addEventListener('wheel', e => {
    if (e.target !== canvas || isLocked()) return;
    e.preventDefault();
    handlers.zoom?.(Math.exp(Math.max(-1, Math.min(1, e.deltaY * .0015))));
  }, { signal: ac.signal, passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault(), opts);

  return {
    cancel() { cancel(); pointers.clear(); spoiled = false; },
    dispose() { ac.abort(); pointers.clear(); canvas.style.touchAction = prevTouchAction; },
  };
}
