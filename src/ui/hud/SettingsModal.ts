import type Phaser from 'phaser';
import { t } from '../../core/i18n';
import { GameButton } from '../components/GameButton';
import { setShown } from '../components/panelVisibility';
import { GameModal } from '../components/GameModal';
import { setReducedMotion, prefersReducedMotion, COLORS, css, FONT } from '../theme/tokens';

export interface SettingsCommands {
  replayStory(): void;
  newGame(): void;
  /** Development builds only: unlock everything and grant a large purse for testing. */
  testMode?(): void;
  /** Browser full screen (hidden where unsupported, e.g. iPhone Safari). */
  fullscreen?: { supported(): boolean; isOn(): boolean; toggle(): void };
}

/** Settings: reduced motion, replay the story, start a new game (asks twice before deleting the save). */
export class SettingsModal {
  readonly modal: GameModal;
  readonly buttons = new Map<string, GameButton>();
  private confirmNew = false;
  private readonly motion: GameButton;
  private readonly fresh: GameButton;
  private fullBtn: GameButton | null = null;

  constructor(scene: Phaser.Scene, private readonly commands: SettingsCommands) {
    this.modal = new GameModal(scene, t('settings.title'), 380, 400, 'settings');
    const add = (b: GameButton) => {
      this.modal.body.add(b.text);
      this.buttons.set(b.name, b);
      return b;
    };
    const note = (y: number, s: string) =>
      this.modal.body.add(scene.add.text(0, y, s, { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim), wordWrap: { width: 340 } }).setResolution(2));
    this.motion = add(new GameButton(scene, 0, 0, '', () => this.toggleMotion(), 'settings.motion', { variant: 'secondary', w: 340 }));
    note(40, t('settings.motionHelp'));
    add(new GameButton(scene, 0, 74, t('meta.replay'), () => {
      this.modal.close();
      commands.replayStory();
    }, 'settings.replay', { variant: 'secondary', w: 340 }));
    note(112, t('meta.replayDesc'));
    this.fresh = add(new GameButton(scene, 0, 150, t('meta.newGame'), () => {
      if (this.confirmNew) commands.newGame();
      else {
        this.confirmNew = true;
        this.refresh();
      }
    }, 'settings.newGame', { variant: 'danger', w: 340 }));
    note(188, t('meta.newGameDesc'));
    if (commands.fullscreen?.supported()) {
      const fs = commands.fullscreen;
      const b = add(new GameButton(scene, 0, 252, '', () => {
        fs.toggle();
        this.refresh();
      }, 'settings.fullscreen', { variant: 'secondary', w: 340 }));
      this.fullBtn = b;
    }
    if (commands.testMode && !import.meta.env.PROD) {
      add(new GameButton(scene, 0, 290, t('settings.testMode'), () => {
        commands.testMode?.();
        this.modal.close();
      }, 'settings.testMode', { variant: 'primary', w: 340 }));
      note(322, t('settings.testModeHelp'));
    }
    for (const b of this.modal.buttons) this.buttons.set(b.name, b);
    this.refresh();
    setShown(this.modal.root, false, true); // children were added after the modal was built
  }

  private toggleMotion(): void {
    setReducedMotion(!prefersReducedMotion());
    this.refresh();
  }

  private refresh(): void {
    this.motion.setLabel(prefersReducedMotion() ? t('settings.motionOn') : t('settings.motionOff'));
    this.fresh.setLabel(this.confirmNew ? t('meta.newGameConfirm') : t('meta.newGame'));
    this.fullBtn?.setLabel(this.commands.fullscreen?.isOn() ? t('settings.fullscreenOff') : t('settings.fullscreenOn'));
  }

  toggle(): void {
    this.confirmNew = false;
    this.refresh();
    this.modal.toggle();
  }

  destroy(): void {
    this.modal.destroy();
  }
}
