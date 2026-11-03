export function mountJoystick(base, knob, onChange, signal) {
  let pointer = null;
  function reset() {
    const previous = pointer; pointer = null;
    if (previous !== null && base.hasPointerCapture(previous)) base.releasePointerCapture(previous);
    knob.style.transform = 'translate(0px, 0px)'; onChange({ x: 0, z: 0 });
  }
  function steer(event) {
    const rect = base.getBoundingClientRect(), radius = rect.width * .31;
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy), scale = distance > radius ? radius / distance : 1;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    const magnitude = Math.min(1, distance / radius);
    if (magnitude < .12) onChange({ x: 0, z: 0 });
    else { const strength = (magnitude - .12) / .88; onChange({ x: dx / distance * strength, z: dy / distance * strength }); }
  }
  base.addEventListener('pointerdown', event => {
    if (pointer !== null || event.button !== 0) return;
    event.preventDefault(); pointer = event.pointerId; base.setPointerCapture(pointer); steer(event);
  }, { signal });
  base.addEventListener('pointermove', event => { if (event.pointerId === pointer) { event.preventDefault(); steer(event); } }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(type, event => { if (event.pointerId === pointer) reset(); }, { signal });
  return reset;
}
