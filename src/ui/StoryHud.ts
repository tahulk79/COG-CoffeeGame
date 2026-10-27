import Phaser from 'phaser';
import { H5_ASSETS } from '../components/render/h5Assets';
import { t } from '../core/i18n';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import { Button } from './widgets/Button';
import { CSS, TEXT } from './theme/textStyles';
import { setShown } from './components/panelVisibility';
import { Panel } from './components/Panel';
import { masterStep } from '../gameplay/guide/guide';
import { hudViewport } from './layout/HudLayout';


/** Placeholder story UI: chapter title + objective at the top, dialogue box at the bottom. */
export class StoryHud {
  readonly buttons = new Map<string, Button>();
  private readonly top: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly box: Phaser.GameObjects.Container;
  private readonly line: Phaser.GameObjects.Text;
  private heroPortrait?: Phaser.GameObjects.Image;
  private masterPortrait?: Phaser.GameObjects.Image;
  private topPanel!: Panel;
  private boxPanel!: Panel;
  private topW = 520;
  private boxW = 640;
  private boxH = 120;
  private readonly next: Button;
  private readonly rescue: Button;
  private readonly action: Phaser.GameObjects.Container;
  private readonly actionHint: Phaser.GameObjects.Text;
  private lastSnapshot: SimulationSnapshot | null = null;
  private readonly keyHandler = () => this.onNext();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly advance: () => void,
    private readonly interact: (id: string) => void,
  ) {
    this.top = scene.add.container(0, 8).setDepth(1500);
    this.topPanel = new Panel(scene, {}, 520, 52);
    this.top.add(this.topPanel.object);
    this.title = scene.add.text(0, 4, '', { ...TEXT, color: CSS.gold, fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.objective = scene.add.text(0, 26, '', TEXT).setOrigin(0.5, 0);
    this.top.add([this.title, this.objective]);

    this.box = scene.add.container(0, 0).setDepth(1600);
    this.boxPanel = new Panel(scene, { alpha: 0.95 }, 640, 120).swallowClicks();
    this.line = scene.add.text(0, 14, '', { ...TEXT, wordWrap: { width: 600 } });
    this.next = new Button(scene, 0, 0, t('story.next'), () => this.onNext(), 'story.next');
    const portrait = scene.add.graphics();
    portrait.fillStyle(0xd49a44).fillRoundedRect(18,49,54,54,12).fillStyle(0xf1c6a2).fillCircle(45,34,24).fillStyle(0x433037).fillEllipse(44,18,52,31).fillRoundedRect(20,17,9,30,4).fillRoundedRect(61,17,8,24,4).fillStyle(0x2c2b35).fillCircle(36,35,3).fillCircle(54,35,3).lineStyle(2,0xb87564).lineBetween(40,47,49,47);
    this.box.add([this.boxPanel.object, portrait, this.line, this.next.text]);
    if (scene.textures.exists(H5_ASSETS.portrait.key)) {
      portrait.setVisible(false);
      this.heroPortrait = scene.add.image(46, 62, H5_ASSETS.portrait.key).setDisplaySize(80, 80);
      this.box.add(this.heroPortrait);
    }
    if (scene.textures.exists(H5_ASSETS.extra.key)) {
      this.masterPortrait = scene.add.image(46, 66, H5_ASSETS.extra.key, '11').setDisplaySize(86, 86).setVisible(false);
      this.box.add(this.masterPortrait);
    }
    this.buttons.set('story.next', this.next);
    this.action = scene.add.container(0, 0).setDepth(1500);
    const actionPanel = new Panel(scene, { fill: 0x182c3b, border: 0xd7b87a }, 300, 94).swallowClicks();
    this.actionHint = scene.add.text(14, 12, 'Mèo con đang chờ bạn!\nBấm để chạy tới và ôm mèo.', { ...TEXT, fontSize: '12px' });
    this.rescue = new Button(scene, 14, 53, 'Cứu mèo con', () => {
      if (this.lastSnapshot?.story.locked) return;
      this.interact('kitten');
    }, 'story.rescue', { icon: 'heart', h: 32 });
    this.action.add([actionPanel.object, this.actionHint, this.rescue.text]);
    this.buttons.set('story.rescue', this.rescue);
    scene.input.keyboard?.on('keydown-ENTER', this.keyHandler);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();
    setShown(this.top, false);
    setShown(this.box, false);
    setShown(this.action, false);
  }

  private onNext(): void {
    if (this.box.visible) this.advance();
  }

  private layout(): void {
    const vw = hudViewport.w;
    // Narrow screens: the objective sits under the profile row instead of over it, and everything fits the width.
    const narrow = vw < 900;
    this.topW = Math.min(520, vw - 12);
    this.top.setPosition(vw / 2 - this.topW / 2, hudViewport.safe.top + (narrow ? 62 : 8));
    this.title.setPosition(this.topW / 2, 6).setWordWrapWidth(this.topW - 20);
    this.objective.setPosition(this.topW / 2, 28).setWordWrapWidth(this.topW - 20).setAlign('center');
    this.boxW = Math.min(640, vw - 12);
    this.line.setPosition(90, 16).setWordWrapWidth(this.boxW - 108);
    this.box.setPosition(vw / 2 - this.boxW / 2, hudViewport.h - this.boxH - 8 - hudViewport.safe.bottom);
    this.boxPanel.set(this.boxW, this.boxH);
    this.next.text.setPosition(this.boxW - this.next.width - 18, this.boxH - this.next.height - 12);
    this.action.setPosition(vw / 2 - 150, hudViewport.h - 106 - hudViewport.safe.bottom);
    this.fit();
  }

  /** Grow the objective box to the (possibly wrapped) text. */
  private fit(): void {
    this.topPanel.set(this.topW, Math.ceil(34 + this.objective.height));
  }

  update(s: SimulationSnapshot): void {
    this.lastSnapshot = s;
    const st = s.story;
    const rescuing = s.interaction.current?.objectId === 'kitten';
    setShown(this.action, st.active && st.chapter === 'S03' && !st.locked);
    this.rescue.setEnabled(!rescuing).setLabel(rescuing ? 'Đang tới cứu mèo…' : 'Cứu mèo con');
    setShown(this.top, st.active);
    this.title.setText(st.title);
    const objective = (st.chapter === 'S05' && !st.dialog && masterStep(s)) || st.objective;
    if (this.objective.text !== objective) {
      this.objective.setText(objective);
      this.fit();
    }
    setShown(this.box, st.dialog !== null);
    if (st.dialog) {
      if (this.line.text !== st.dialog.text) {
        this.line.setText(st.dialog.text);
        const h = Math.max(120, Math.ceil(this.line.height) + 68);
        if (h !== this.boxH) {
          this.boxH = h;
          this.layout();
        }
      }
      const master = st.dialog.speaker === 'master' && !!this.masterPortrait;
      this.masterPortrait?.setVisible(master);
      this.heroPortrait?.setVisible(!master);
      this.next.setLabel(st.dialog.index + 1 >= st.dialog.total ? 'Tiếp tục' : t('story.next'));
      this.next.text.setPosition(this.boxW - this.next.width - 18, this.boxH - this.next.height - 12);
    }
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-ENTER', this.keyHandler);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.top.destroy();
    this.box.destroy();
    this.action.destroy();
  }
}
