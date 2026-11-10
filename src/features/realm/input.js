// Pointer gesture recognizer on the canvas only (DOM UI above it never reaches here): tap vs drag (8 px threshold),
// two-finger pinch and wheel zoom. Semantics (plant, pan, place…) are decided by the realm through the handlers.
// Tap vs drag: a click / tap that wobbles a little must stay a tap (walk there), not become a tiny map drag — a drag
// switches the camera off its follow and swallows the tap, which felt like a stutter when tapping fast. Fingers wobble
// more than a mouse. A quick press (< QUICK ms) gets an even wider slop: fast repeated taps are taps.
const TAP_SLOP = { mouse: 10, pen: 12, touch: 18 };
const QUICK = 180, QUICK_SLOP = 28, HOLD_MS = 320; // a press that stays put this long picks up what is under it

/**
 * handlers: { down(p), up(), tap(p), dragStart(start, p), dragMove(p, dx, dy), dragEnd(p), zoom(factor, at), cancel() }
 * zoom `at` = client point the zoom is anchored to (pinch midpoint / wheel cursor).
 * p = { x, y } client pixels (reused object; copy if kept).
 */
export function createInput(canvas, handlers, isLocked) {
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  const pointers = new Map();
  const start = { x: 0, y: 0 }, last = { x: 0, y: 0 }, p = { x: 0, y: 0 }, mid = { x: 0, y: 0 };
  let dragging = false, pinching = false, spoiled = false, pinchDist = 0, slop = 10, downAt = 0;
  let holdTimer = 0;
  const stopHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
  let midSet = false, altPan = null; // two-finger / other-mouse-button map pan (only when handlers.altPan() says so: while planting)
  const prevTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  function cancel() {
    stopHold();
    if (dragging) handlers.cancel?.();
    dragging = false; pinching = false; spoiled = pointers.size > 0;
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.target !== canvas || isLocked()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) {
      if (handlers.altPan?.()) { altPan = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ } }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    if (pointers.size === 1) {
      start.x = last.x = e.clientX; start.y = last.y = e.clientY;
      slop = TAP_SLOP[e.pointerType] ?? 12; downAt = performance.now();
      dragging = false; pinching = false; spoiled = false;
      p.x = e.clientX; p.y = e.clientY;
      handlers.down?.(p);
      stopHold();
      holdTimer = setTimeout(() => {
        holdTimer = 0;
        if (pointers.size !== 1 || dragging || spoiled || isLocked()) return;
        p.x = last.x; p.y = last.y;
        if (handlers.hold?.(p)) dragging = true; // from here the same finger carries it (dragMove / dragEnd)
      }, HOLD_MS);
    } else if (pointers.size === 2) {
      stopHold();
      if (dragging) handlers.cancel?.();
      dragging = false; pinching = true; spoiled = true;
      pinchDist = spread(); midSet = false;
    }
  }, opts);

  canvas.addEventListener('pointermove', e => {
    if (altPan?.id === e.pointerId) {
      if (e.buttons === 0 || isLocked()) { altPan = null; return; }
      handlers.pan2?.(e.clientX - altPan.x, e.clientY - altPan.y);
      altPan.x = e.clientX; altPan.y = e.clientY;
      return;
    }
    const pt = pointers.get(e.pointerId);
    if (!pt) return;
    // A mouse that moves with no button held has let go without us hearing (a context menu, a window switch swallowed the
    // pointerup): end the gesture now, or whatever was being dragged (the placement ghost, the map) keeps following the cursor.
    if (e.pointerType === 'mouse' && e.buttons === 0) { up({ pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, type: 'pointercancel' }); return; }
    if (isLocked()) { cancel(); return; }
    pt.x = e.clientX; pt.y = e.clientY;
    if (pinching) {
      if (pointers.size >= 2) {
        const d = spread();
        if (d > 0 && pinchDist > 0) {
          const [a, b] = [...pointers.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (midSet) handlers.pan2?.(mx - mid.x, my - mid.y);
          mid.x = mx; mid.y = my; midSet = true;
          handlers.zoom?.(pinchDist / d, mid);
        }
        pinchDist = d;
      }
      return;
    }
    if (spoiled) return;
    p.x = e.clientX; p.y = e.clientY;
    const moved = Math.hypot(p.x - start.x, p.y - start.y);
    if (!dragging && moved > slop && (moved > QUICK_SLOP || performance.now() - downAt > QUICK)) {
      dragging = true;
      stopHold();
      handlers.dragStart?.(start, p);
      last.x = start.x; last.y = start.y; // the first drag step catches up the slop (the map stays under the finger)
    }
    if (dragging) handlers.dragMove?.(p, p.x - last.x, p.y - last.y);
    last.x = p.x; last.y = p.y;
  }, opts);

  const up = e => {
    if (altPan?.id === e.pointerId) { altPan = null; return; }
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    stopHold();
    p.x = e.clientX; p.y = e.clientY;
    if (!pointers.size) handlers.up?.();
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
    mid.x = e.clientX; mid.y = e.clientY;
    handlers.zoom?.(Math.exp(Math.max(-1, Math.min(1, e.deltaY * .0015))), mid);
  }, { signal: ac.signal, passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault(), opts);

  return {
    cancel() { cancel(); pointers.clear(); spoiled = false; },
    dispose() { stopHold(); ac.abort(); pointers.clear(); canvas.style.touchAction = prevTouchAction; },
  };
}
