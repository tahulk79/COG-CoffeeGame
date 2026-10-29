import type Phaser from 'phaser';
import { GameButton } from '../components/GameButton';
import { TOP_ROW, type HudFrame } from '../layout/HudLayout';
import { drawGear } from '../theme/glyphs';
import { COLORS } from '../theme/tokens';

/** Top-right: the round gear button that opens the settings panel. */
export class SettingsButton {
  readonly button: GameButton;

  constructor(scene: Phaser.Scene, openSettings: () => void) {
    // A round gear button, the same height as the sound button on the other side.
    this.button = new GameButton(scene, 0, 0, '', openSettings, 'settings.open', { variant: 'secondary', w: TOP_ROW.size, h: TOP_ROW.size }).setGlyph((g) => drawGear(g, COLORS.coffeeBrown, COLORS.cream, 12));
    this.button.text.setDepth(1000);
  }

  layout(f: HudFrame): void {
    this.button.text.setPosition(f.w - f.safe.right - TOP_ROW.inset - TOP_ROW.size, f.safe.top + TOP_ROW.inset);
  }

  destroy(): void {
    this.button.text.destroy();
  }
}
