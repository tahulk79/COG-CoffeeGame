// Farm thumbnails: one small picture of each farm, taken from the real 3D view when the player leaves it.
// Kept apart from the save (it is decoration, never worth losing money data for).
const KEY = 'godbean-farm-thumbs';
const SIZE = 112;
function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
export const thumbOf = regionId => read()[regionId] || null;
/** Call right after a render, in the same task: the canvas is cleared once the frame is presented. */
export function captureThumb(regionId, canvas) {
  if (!regionId || !canvas?.width) return;
  try {
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const side = Math.min(canvas.width, canvas.height), g = c.getContext('2d');
    g.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [regionId]: c.toDataURL('image/jpeg', .62) }));
  } catch { /* storage full or blocked: the placeholder is shown */ }
}
