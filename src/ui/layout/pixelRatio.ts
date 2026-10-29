import type Phaser from 'phaser';

/**
 * The canvas is drawn at this many device pixels per CSS pixel, so phones (2–3×) get a sharp picture instead of a
 * 1× canvas the browser blows up. Capped at 2: 3× would draw over twice the pixels for little visible gain.
 */
export const PIXEL_RATIO = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/** Text is drawn into a canvas: sharp enough for the HUD's zoom on a high-density screen. */
export const TEXT_RES = Math.max(2, Math.ceil(PIXEL_RATIO * 1.4));

/** The game's size in CSS pixels (all layout works in these; the canvas itself is `PIXEL_RATIO` times larger). */
export function cssSize(scene: Phaser.Scene): { w: number; h: number } {
  return { w: scene.scale.width / PIXEL_RATIO, h: scene.scale.height / PIXEL_RATIO };
}

/**
 * A screen-space camera (HUD, transitions): zoomed so the scene is laid out in CSS pixels times `ui`, with (0, 0) at
 * the top left. Returns the laid-out size.
 */
export function screenCamera(scene: Phaser.Scene, ui = 1): { w: number; h: number } {
  const rawW = scene.scale.width, rawH = scene.scale.height, z = ui * PIXEL_RATIO;
  const cam = scene.cameras.main;
  cam.setZoom(z);
  cam.setScroll(-rawW * (1 - 1 / z) / 2, -rawH * (1 - 1 / z) / 2);
  return { w: rawW / z, h: rawH / z };
}
