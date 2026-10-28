/**
 * Camera framing rules (CAMERA_SPEC.md). Pure math, no Phaser: the
 * CameraDirector applies these.
 *
 * Coordinate spaces:
 * - viewport: canvas CSS pixels (what `scale.width/height` reports)
 * - render: world projected to pixels by `worldToScreen` (128×64 tiles)
 * - the camera shows `viewport / zoom` render pixels around its centre
 */
export type ViewportClass = 'desktop' | 'tablet' | 'mobileLandscape' | 'mobilePortrait';
export type CameraMode = 'exploration' | 'cafe' | 'farm' | 'story' | 'brewingFocus' | 'cinematic';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

export const TILE_W = 128;
export const MIN_USER_ZOOM = 0.6;
export const MAX_USER_ZOOM = 2.4;
/** Hard ceiling: beyond this the 128px placeholder art turns to mush. */
export const MAX_ZOOM = 3;

export function classifyViewport(w: number, h: number): ViewportClass {
  if (h > w && w < 760) return 'mobilePortrait';
  if (h < 520 || w < 760) return 'mobileLandscape';
  if (Math.min(w, h) < 900 && Math.max(w, h) < 1280) return 'tablet';
  return 'desktop';
}

/**
 * How many tile widths fit across the screen, per mode and device. This is
 * the framing intent: the café shows the counter-to-tables working area, the
 * farm a few plot rows, brewing a single station. Fewer tiles = closer.
 */
const TILES_ACROSS: Record<CameraMode, Record<ViewportClass, number>> = {
  exploration: { desktop: 11, tablet: 9, mobileLandscape: 7, mobilePortrait: 5.5 },
  cafe: { desktop: 10, tablet: 8.5, mobileLandscape: 7, mobilePortrait: 5.5 },
  farm: { desktop: 11, tablet: 9, mobileLandscape: 7.5, mobilePortrait: 5.5 },
  story: { desktop: 10, tablet: 8.5, mobileLandscape: 6.5, mobilePortrait: 5 },
  brewingFocus: { desktop: 6, tablet: 5, mobileLandscape: 4.5, mobilePortrait: 3.5 },
  cinematic: { desktop: 8, tablet: 7, mobileLandscape: 5.5, mobilePortrait: 4.5 },
};

export function tilesAcross(mode: CameraMode, vp: ViewportClass): number {
  return TILES_ACROSS[mode][vp];
}

/** Smallest zoom at which the view stays inside the authored environment (no blank edges). */
export function minZoomFor(viewW: number, viewH: number, env: Rect): number {
  return Math.max(viewW / env.w, viewH / env.h);
}

/**
 * Zoom for a mode: the framing intent times the player's preference, never
 * so far out that the view leaves the environment, never past MAX_ZOOM.
 */
export function framingZoom(mode: CameraMode, viewW: number, viewH: number, env: Rect, userZoom = 1): number {
  const vp = classifyViewport(viewW, viewH);
  // Very tall phones: also keep enough height so the counter and the queue fit together.
  const base = Math.max(viewW / (tilesAcross(mode, vp) * TILE_W), vp === 'mobilePortrait' ? 0 : viewH / (tilesAcross(mode, vp) * TILE_W * 0.75));
  const want = base * clamp(userZoom, MIN_USER_ZOOM, MAX_USER_ZOOM);
  return clamp(want, minZoomFor(viewW, viewH, env), Math.max(MAX_ZOOM, minZoomFor(viewW, viewH, env)));
}

/** Camera centre kept so the visible rectangle stays inside `bounds` (centred when it cannot fit). */
export function clampCenter(target: Point, viewW: number, viewH: number, bounds: Rect): Point {
  const axis = (v: number, lo: number, size: number, view: number): number => (view >= size ? lo + size / 2 : clamp(v, lo + view / 2, lo + size - view / 2));
  return { x: axis(target.x, bounds.x, bounds.w, viewW), y: axis(target.y, bounds.y, bounds.h, viewH) };
}

/**
 * Pointer-centred zoom: the render point under `anchor` (screen offset from
 * the viewport centre, CSS px) stays under it when zoom goes z0 → z1.
 * Returns how far the camera centre must move, in render pixels.
 */
export function zoomAnchorShift(anchor: Point, z0: number, z1: number): Point {
  return { x: anchor.x * (1 / z0 - 1 / z1), y: anchor.y * (1 / z0 - 1 / z1) };
}

/** Offset (render px) that puts the follow target in the middle of the area the HUD leaves free. */
export function insetOffset(viewW: number, viewH: number, insets: Insets, zoom: number): Point {
  const freeW = viewW - insets.left - insets.right;
  const freeH = viewH - insets.top - insets.bottom;
  return { x: (viewW / 2 - (insets.left + freeW / 2)) / zoom, y: (viewH / 2 - (insets.top + freeH / 2)) / zoom };
}

/** Frame-rate independent exponential easing factor for a time constant `tauMs`. */
export function easeFactor(dtMs: number, tauMs: number): number {
  return tauMs <= 0 ? 1 : 1 - Math.exp(-dtMs / tauMs);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
