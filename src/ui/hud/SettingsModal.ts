import Phaser from 'phaser';
import { getLocale, LANGUAGES, t } from '../../core/i18n';
import { GameButton } from '../components/GameButton';
import { setShown } from '../components/panelVisibility';
import { GameModal } from '../components/GameModal';
import { setReducedMotion, prefersReducedMotion, css, FONT, LIGHT } from '../theme/tokens';

export interface SettingsCommands {
  replayStory(): void;
  newGame(): void;
  /** Sound on/off (the same switch as the M key and the HUD sound button). */
  sound: { isOn(): boolean; toggle(): void };
  /** Switches language: remembered, then the game reloads so every screen is rebuilt in it. */
  setLanguage(code: string): void;
  /** Development builds only: unlock everything and grant a large purse for testing. */
  testMode?(): void;
  /** Browser full screen (hidden where unsupported, e.g. iPhone Safari). */
  fullscreen?: { supported(): boolean; isOn(): boolean; toggle(): void };
}

/** A settings row: a label on a rounded plate and an ON/OFF switch on the right; the whole row is the button. */
class SwitchRow {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly sw: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly state: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Zone;
  private w = 300;
  private h = 44;
  private on = false;
  private hover = false;

  constructor(scene: Phaser.Scene, text: string, onToggle: () => void) {
    this.bg = scene.add.graphics();
    this.sw = scene.add.graphics();
    this.label = scene.add.text(14, 0, text, { fontFamily: FONT.family, fontSize: `${FONT.size.md}px`, color: css(LIGHT.text), fontStyle: 'bold' }).setOrigin(0, 0.5).setResolution(2);
    this.state = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, fontStyle: 'bold' }).setOrigin(1, 0.5).setResolution(2);
    this.hit = scene.add.zone(0, 0, this.w, this.h).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });
    this.hit.on('pointerdown', onToggle);
    this.hit.on('pointerover', () => { this.hover = true; this.redraw(); });
    this.hit.on('pointerout', () => { this.hover = false; this.redraw(); });
    this.root = scene.add.container(0, 0, [this.bg, this.sw, this.label, this.state, this.hit]);
    this.redraw();
  }

  setOn(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.redraw();
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.hit.setSize(w, h);
    (this.hit.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(w, h);
    this.redraw();
  }

  private redraw(): void {
    const { w, h } = this, sx = w - 56 - 12, sy = (h - 28) / 2;
    this.bg.clear().fillStyle(this.hover ? LIGHT.plateHover : LIGHT.plate, 1).fillRoundedRect(0, 0, w, h, 14).lineStyle(2.5, LIGHT.border, 1).strokeRoundedRect(0, 0, w, h, 14);
    this.sw.clear().fillStyle(this.on ? LIGHT.on : LIGHT.off, 1).fillRoundedRect(sx, sy, 56, 28, 14).lineStyle(2.5, LIGHT.border, 1).strokeRoundedRect(sx, sy, 56, 28, 14);
    this.sw.fillStyle(LIGHT.knob, 1).fillCircle(this.on ? sx + 56 - 15 : sx + 15, sy + 14, 10).lineStyle(2.5, LIGHT.border, 1).strokeCircle(this.on ? sx + 56 - 15 : sx + 15, sy + 14, 10);
    this.label.setPosition(14, h / 2).setWordWrapWidth(Math.max(60, sx - 60));
    this.state.setText(this.on ? t('settings.on') : t('settings.off')).setColor(css(this.on ? LIGHT.text : LIGHT.textDim)).setPosition(sx - 10, h / 2);
  }
}

/**
 * Settings, laid out like a game menu: sections with a header, switch rows for
 * sound / reduced motion / full screen, language chips, then the story and
 * save-data buttons (starting a new game asks twice before deleting the save).
 * Shrinks its spacing, then its size, to fit short screens.
 */
export class SettingsModal {
  readonly modal: GameModal;
  readonly buttons = new Map<string, GameButton>();
  private confirmNew = false;
  private readonly sound: SwitchRow;
  private readonly motion: SwitchRow;
  private readonly full: SwitchRow | null = null;
  private readonly headers: Phaser.GameObjects.Text[] = [];
  private readonly chips: GameButton[] = [];
  private readonly langNote: Phaser.GameObjects.Text;
  private readonly replay: GameButton;
  private readonly fresh: GameButton;
  private readonly test: GameButton | null = null;
  private readonly footer: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly commands: SettingsCommands) {
    this.modal = new GameModal(scene, t('settings.title'), 640, 580, 'settings', undefined, 'light');
    const body = this.modal.body;
    const add = (b: GameButton) => {
      body.add(b.text);
      this.buttons.set(b.name, b);
      return b;
    };
    const header = (key: string) => {
      const h = scene.add.text(2, 0, t(key), { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(LIGHT.label), fontStyle: 'bold' }).setResolution(2);
      body.add(h);
      this.headers.push(h);
    };

    header('settings.sectionAudio');
    this.sound = new SwitchRow(scene, t('settings.sound'), () => { commands.sound.toggle(); this.refresh(); });
    this.motion = new SwitchRow(scene, t('settings.motion'), () => { setReducedMotion(!prefersReducedMotion()); this.refresh(); });
    body.add([this.sound.root, this.motion.root]);
    if (commands.fullscreen?.supported()) {
      const fs = commands.fullscreen;
      this.full = new SwitchRow(scene, t('settings.fullscreen'), () => { fs.toggle(); this.refresh(); });
      body.add(this.full.root);
    }

    header('settings.sectionLanguage');
    for (const lang of LANGUAGES) {
      this.chips.push(add(new GameButton(scene, 0, 0, lang.label, () => {
        if (lang.code !== getLocale()) commands.setLanguage(lang.code);
      }, `settings.lang.${lang.code}`, { variant: 'secondary', h: 48, fontSize: FONT.size.md })));
    }
    this.langNote = scene.add.text(2, 0, t('settings.languageNote'), { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(LIGHT.textDim), wordWrap: { width: 340 } }).setResolution(2);
    body.add(this.langNote);

    header('settings.sectionStory');
    this.replay = add(new GameButton(scene, 0, 0, t('meta.replay'), () => {
      this.modal.close();
      commands.replayStory();
    }, 'settings.replay', { variant: 'secondary', h: 48, wrap: true }));
    this.fresh = add(new GameButton(scene, 0, 0, t('meta.newGame'), () => {
      if (this.confirmNew) commands.newGame();
      else {
        this.confirmNew = true;
        this.refresh();
      }
    }, 'settings.newGame', { variant: 'danger', h: 48, wrap: true }));
    if (commands.testMode && !import.meta.env.PROD) {
      this.test = add(new GameButton(scene, 0, 0, t('settings.testMode'), () => {
        commands.testMode?.();
        this.modal.close();
      }, 'settings.testMode', { variant: 'primary', h: 48, wrap: true }));
    }
    this.footer = scene.add.text(0, 0, t('settings.version'), { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(LIGHT.textDim) }).setOrigin(0.5, 0).setResolution(2).setAlpha(0.8);
    body.add(this.footer);

    for (const b of this.modal.buttons) this.buttons.set(b.name, b);
    this.modal.onLayout((w, h) => this.layout(w, h));
    this.refresh();
    setShown(this.modal.root, false, true); // children were added after the modal was built
  }

  /** Two columns on landscape phones keep the controls readable without shrinking the whole menu. */
  private layout(bodyW: number, bodyH: number): void {
    const columns = bodyW >= 500;
    const gap = 8, rowH = 48, headH = 22;
    const colW = columns ? (bodyW - 18) / 2 : bodyW;
    let y = 0;
    this.headers[0]!.setPosition(2, y);
    y += headH;
    for (const row of [this.sound, this.motion, this.full]) {
      if (!row) continue;
      row.layout(colW - 2, rowH);
      row.root.setPosition(0, y);
      y += rowH + gap;
    }
    this.headers[1]!.setPosition(2, y + 2);
    y += headH + 2;
    const chipW = (colW - gap * (this.chips.length - 1)) / this.chips.length;
    this.chips.forEach((chip, i) => chip.setWidth(chipW).text.setPosition(i * (chipW + gap), y));
    y += rowH + gap;
    this.langNote.setVisible(!columns).setWordWrapWidth(colW - 4).setPosition(2, y);
    if (!columns) y += this.langNote.height + gap;
    const leftH = y;
    const storyX = columns ? colW + 18 : 0;
    if (columns) y = 0;
    this.headers[2]!.setPosition(storyX + 2, y);
    y += headH;
    for (const button of [this.replay, this.fresh, this.test]) {
      if (!button) continue;
      button.setWidth(colW - 2).text.setPosition(storyX, y);
      y += button.height + gap;
    }
    const total = Math.max(leftH, y);
    const footerH = 22;
    this.footer.setPosition(bodyW / 2, total);
    const showFooter = total + footerH <= bodyH;
    this.footer.setVisible(showFooter);
    // Only exceptionally small browser viewports need this fallback.
    this.modal.body.setScale(Math.min(1, bodyH / (total + (showFooter ? footerH : 0))));
  }

  private refresh(): void {
    this.sound.setOn(this.commands.sound.isOn());
    this.motion.setOn(prefersReducedMotion());
    this.full?.setOn(!!this.commands.fullscreen?.isOn());
    this.fresh.setLabel(this.confirmNew ? t('meta.newGameConfirm') : t('meta.newGame'));
    for (const [i, lang] of LANGUAGES.entries()) this.chips[i]?.setSelected(lang.code === getLocale());
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
