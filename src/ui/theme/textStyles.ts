import Phaser from 'phaser';
import { Panel } from '../components/Panel';
import { COLORS, css, FONT } from './tokens';

/** Shared text look for the management panels (token-based). */
export const TEXT = { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.cream), resolution: 2 };

/** Colour strings for text, derived from the tokens. */
export const CSS = {
  gold: css(COLORS.gold),
  cream: css(COLORS.cream),
  creamDim: css(COLORS.creamDim),
  leaf: css(COLORS.leaf),
  error: css(COLORS.error),
};

/** Panel background that also swallows clicks, so they never fall through to the world. */
export function panelBg(scene: Phaser.Scene, w: number, h: number, alpha = 0.92): Phaser.GameObjects.NineSlice {
  return new Panel(scene, { alpha }, w, h).swallowClicks().object;
}
