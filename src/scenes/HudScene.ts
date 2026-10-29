import Phaser from 'phaser';
import { GameModal } from '../ui/components/GameModal';
import { setLocale, t } from '../core/i18n';
import type { GameSession } from '../core/session';
import { DebugOverlay } from '../ui/hud/DebugOverlay';
import { SettingsModal } from '../ui/hud/SettingsModal';
import { SettingsButton } from '../ui/hud/SettingsButton';
import { GameButton } from '../ui/components/GameButton';
import { HudLayout, hudViewport } from '../ui/layout/HudLayout';
import { ModalManager } from '../ui/layout/ModalManager';
import { COLORS, css, FONT } from '../ui/theme/tokens';
import { StoryHud } from '../ui/StoryHud';
import { readMuted, toggleMute } from '../core/audioPrefs';
import type { Button } from '../ui/widgets/Button';

/** UI overlay with its own un-zoomed camera, running on top of a world scene. */
export class HudScene extends Phaser.Scene {
  private assetNotice: GameModal | null = null;
  private loadFailures = 0;
  private debug: DebugOverlay | null = null;
  private layout!: HudLayout;
  private modals!: ModalManager;
  private settings!: SettingsModal;
  private settingsButton!: SettingsButton;
  private unsubscribeLayout: (() => void) | null = null;
  private readonly offs: Array<() => void> = [];
  storyHud: StoryHud | null = null;
  private session!: GameSession;

  constructor() {
    super('HudScene');
  }

  init(data: { session: GameSession; loadFailures?: number }): void {
    this.session = data.session;
    this.loadFailures = data.loadFailures ?? 0;
  }

  /** True while the settings panel (or the asset notice) is open; the world should not react then. */
  get modalOpen(): boolean {
    return !!this.modals?.openId;
  }

  /** Any named HUD button (test bridge lookup). */
  button(name: string): Button | undefined {
    return this.storyHud?.buttons.get(name) ?? this.settings?.buttons.get(name) ?? (name === 'settings.open' ? this.settingsButton?.button : undefined);
  }

  create(): void {
    // Phaser reuses the scene instance on restart: never keep panels from a previous map.
    this.storyHud = null;
    const sim = this.session.sim;
    this.debug = import.meta.env.PROD ? null : new DebugOverlay(this, sim.bus);
    this.layout = new HudLayout(this);
    this.modals = new ModalManager(this);
    this.settings = new SettingsModal(this, { replayStory: () => sim.replayStory(), newGame: () => this.newGame(), sound: { isOn: () => !readMuted(), toggle: () => void toggleMute(this.sound) }, setLanguage: (code) => this.changeLanguage(code), fullscreen: { supported: () => !!document.fullscreenEnabled, isOn: () => this.scale.isFullscreen, toggle: () => this.toggleFullscreen() } });
    this.settingsButton = new SettingsButton(this, () => this.modals.toggle('settings'));
    if (sim.story.active) this.storyHud = new StoryHud(this, () => sim.story.advanceDialog(), () => sim.story.retryRun(), () => toggleMute(this.sound), (i) => sim.story.chooseReply(i));
    this.modals.register(this.settings.modal);
    if (document.fullscreenEnabled) this.input.keyboard?.on('keydown-F', () => this.toggleFullscreen());
    this.offs.push(sim.bus.on('save:writeFailed', () => this.banner(t('save.writeFailed'))));

    this.assetNotice = null;
    if (this.loadFailures) {
      const notice = this.assetNotice = new GameModal(this, 'Chưa tải đủ hình ảnh', 460, 230, 'assetLoad', undefined, 'light');
      const label = this.add.text(0, 0, `Có ${this.loadFailures} hình chưa tải được. Đóng bảng để chơi bằng hình tạm, hoặc thử tải lại.`, { fontFamily: FONT.family, fontSize: '16px', color: css(COLORS.ink) });
      const retry = new GameButton(this, 0, 0, 'Thử tải lại', () => { const url = new URL(window.location.href); url.searchParams.delete('fresh'); window.location.assign(url); }, 'assetLoad.retry', { h: 44 });
      notice.body.add([label, retry.text]);
      notice.onLayout((w, h) => { label.setWordWrapWidth(w); retry.text.setPosition(0, h - 46); });
      this.modals.register(notice);
      this.modals.open('assetLoad');
    }

    this.unsubscribeLayout = this.layout.subscribe((f) => {
      this.assetNotice?.layout(f);
      this.settingsButton.layout(f);
      this.settings.modal.layout(f);
    });

    if (this.session.recoveredFromBackup) this.banner(t('save.recovered'));
    const problem = this.session.loadProblem;
    if (problem) this.banner(problem.status === 'unsupported' ? t('save.unsupported') : t('save.problem', { status: problem.status }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.offs.splice(0)) off();
      this.assetNotice?.destroy();
      this.assetNotice = null;
      this.debug?.destroy();
      this.unsubscribeLayout?.();
      this.layout.destroy();
      this.modals.destroy();
      this.settingsButton.destroy();
      this.settings.destroy();
      this.storyHud?.destroy();
      this.storyHud = null;
      this.input.off('pointerdown');
      this.input.off('wheel');
      this.input.keyboard?.off('keydown-F');
    });
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  /** Language is remembered, the game is saved, and the page reloads (without `?fresh`, which would wipe the save) so every screen is rebuilt in the new language. */
  private changeLanguage(code: string): void {
    setLocale(code);
    const sim = this.session.sim;
    this.session.saves?.save(sim.captureState(), sim.clock.now());
    const url = new URL(window.location.href);
    url.searchParams.delete('fresh');
    window.location.replace(url.toString());
  }

  /** Browser storage lives here, not in the simulation. */
  private newGame(): void {
    // The old page's pagehide/shutdown handlers must not save over the reset slot.
    this.session.saveBlocked = true;
    try {
      for (const k of Object.keys(window.localStorage)) if (k.startsWith('tcss.save.slot1')) window.localStorage.removeItem(k);
    } catch {
      /* storage blocked: reload still starts from whatever is stored */
    }
    // A new game starts at the story entrance, even if this page was opened with a dev map override.
    window.location.assign(window.location.pathname);
  }

  /** A short-lived warning near the bottom of the screen. */
  private banner(msg: string): void {
    const b = this.add
      .text(hudViewport.w / 2, hudViewport.h - 90, msg, { fontFamily: FONT.family, fontSize: '14px', color: css(COLORS.cream), backgroundColor: css(COLORS.error), padding: { x: 10, y: 6 } })
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(3000);
    this.time.delayedCall(8000, () => b.destroy());
  }

  override update(_time: number, _delta: number): void {
    const s = this.session.frame ?? this.session.sim.snapshot();
    this.debug?.update(s, this.game.loop.actualFps);
    this.storyHud?.update(s);
  }
}
