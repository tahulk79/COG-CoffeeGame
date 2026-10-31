import { screenToWorld, worldToScreen } from '../utils/iso';
import { clamp } from '../systems/camera/framing';
import type { WorldPos } from '../utils/tile';

/** Authored against the same 128×64 projection as the live street. */
export const STREET_SCENE = {
  key: 'slice.chapter1.reference.street.v2',
  url: '/assets/slice/chapter1/street-scene-v2.webp',
  x: -2870, y: -1251, width: 8295, height: 4740,
};

/** Reconstructed detail tiles: 553×316 source cells with a 48px shared border, at 5 world pixels/source pixel. */
export const STREET_HD_TILES = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2]].map(([row, col]) => ({
  key: `slice.chapter1.detail.v1.${row}.${col}`,
  url: `/assets/slice/chapter1/hd/street-${row}-${col}-v1.webp`,
  x: STREET_SCENE.x + (col! * 553 - 48) * 5,
  y: STREET_SCENE.y + (row! * 316 - 48) * 5,
  width: 649 * 5, height: 412 * 5,
}));

/** Interior of the painted neighborhood, in tile axes, excluding its four unfinished ends. */
export const STREET_CAMERA_AREA = { left: -12, right: 61, top: -8, bottom: 28 };
const EDGE_PAD = 1;

export function streetCamera(w: number, h: number): { zoom: number } {
  const area = STREET_CAMERA_AREA;
  const span = Math.min(area.right - area.left, area.bottom - area.top) - EDGE_PAD * 2;
  // Inverse projection: the four viewport corners span (w/128 + h/64)/zoom tiles on either axis.
  // 12 % slack: at an exact fit the clamp has no room on the short axis, so the camera could not follow the hero across the street.
  const fit = (w / 128 + h / 64) / span * 1.12;
  return { zoom: Math.max(fit, .56, Math.min(.9, Math.max(h / 1350, w / 2100))) };
}

/** Clamp all four viewport corners inside the painted parallelogram, including during rescue follow. */
export function streetCameraCenter(target: WorldPos, viewW: number, viewH: number): WorldPos {
  const p = screenToWorld(target), area = STREET_CAMERA_AREA;
  const radius = viewW / 256 + viewH / 128 + EDGE_PAD;
  return worldToScreen({
    x: clamp(p.x, area.left + radius, area.right - radius),
    y: clamp(p.y, area.top + radius, area.bottom - radius),
  });
}
