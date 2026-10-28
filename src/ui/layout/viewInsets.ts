export interface ViewInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const isCompact = (w: number, h: number): boolean => w < 760 || h < 520;

/**
 * HUD scale: large screens draw the HUD bigger so it stays readable (the HUD
 * scene's camera is zoomed by this and HudLayout works in the resulting virtual
 * pixels). Phones keep 1:1 and use the compact layout instead.
 */
export function hudScale(w: number, h: number): number {
  if (isCompact(w, h)) return h > w ? Math.max(1, Math.min(1.35, w / 390)) : Math.max(1, Math.min(1.4, h / 360));
  return Math.max(1, Math.min(1.9, Math.min(w / 1100, h / 650)));
}

/**
 * Camera zoom for the story maps (café and farm use `framingZoom`). The world
 * always fills the whole screen (the HUD floats on top) and the camera follows
 * the player, clamped to the map: phones get a close-up, PC and tablet the zoom
 * at which the whole map fits on screen.
 */
export function worldZoom(w: number, h: number, mapW = 14, mapH = 14): number {
  // Phones: a close-up that follows the player (a whole map would be unreadably small).
  if (isCompact(w, h)) return w / ((h > w ? 7 : 8) * 128);
  // PC / tablet: the whole map is visible; the ground continues to the screen edges so nothing is black.
  const pxW = (mapW + mapH) * 64;
  const pxH = (mapW + mapH) * 32 + 160;
  return Math.min(w / pxW, h / pxH) * 0.8;
}

/**
 * Screen area the HUD covers at the top and bottom, so the camera keeps the
 * player out from under it. Left and right stay free: the world is full-bleed.
 */
export function worldViewInsets(w: number, h: number): ViewInsets {
  const ui = hudScale(w, h);
  if (isCompact(w, h)) return h > w ? { top: 70, right: 0, bottom: 130, left: 0 } : { top: 20, right: 0, bottom: 70, left: 0 };
  return { top: 0, right: 0, bottom: 0, left: 0 };
}
