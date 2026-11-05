const directions = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
export function createMovementInput() {
  const held = new Set();
  return {
    down(event) { const value = directions[event.code]; if (!value) return false; event.preventDefault(); held.add(value); return true; },
    up(event) { const value = directions[event.code]; if (value) held.delete(value); },
    clear() { held.clear(); },
    combine(touch) {
      return { x: touch.x + Number(held.has('right')) - Number(held.has('left')), z: touch.z + Number(held.has('down')) - Number(held.has('up')) };
    },
  };
}
