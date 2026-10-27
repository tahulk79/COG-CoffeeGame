import type Phaser from 'phaser';
import { dur, MOTION } from './tokens';

/** Short fade-in for content that just changed (tab switch, page turn). No-op with reduced motion. */
export function fadeIn(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { setAlpha(a: number): unknown }): void {
  if (dur(MOTION.fast) === 0) return;
  scene.tweens.killTweensOf(target);
  target.setAlpha(0.35);
  scene.tweens.add({ targets: target, alpha: 1, duration: MOTION.fast, ease: 'Quad.easeOut' });
}

/** Brief scale pulse (reward received, quest ready). */
export function pulse(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { setScale(s: number): unknown }, amount = 1.08): void {
  if (dur(MOTION.base) === 0) return;
  scene.tweens.killTweensOf(target);
  target.setScale(1);
  scene.tweens.add({ targets: target, scale: amount, duration: MOTION.fast, yoyo: true, ease: 'Quad.easeOut' });
}
