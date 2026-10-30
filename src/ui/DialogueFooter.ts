import Phaser from 'phaser';
import { t } from '../core/i18n';
import { Button } from './widgets/Button';
import { setShown } from './components/panelVisibility';
import { Card, INK, portrait, text, wrapText } from './components/storyWidgets';
import { hudViewport } from './layout/HudLayout';
import { COLORS, css, dur, MOTION } from './theme/tokens';
import { CHAPTER2_SLICE_ASSETS } from '../components/render/sliceAssets';

/** One line of a talk, as any chapter hands it to the footer. */
export interface FooterLine {
  name: string;
  /** Whose face to show: `hero` is the hero's portrait, anything else goes to the chapter's `drawFace`. */
  face: string;
  text: string;
  mood: 'right' | 'wrong' | 'funny' | null;
  /** More lines follow ("Tiếp"), or this is the last one ("Đi tiếp ▸"). */
  more: boolean;
  /** Replies to pick from (the footer's buttons, keys 1–3), or null. */
  choices: string[] | null;
  /** A countdown shown in the corner, or null. */
  timeLeftMs: number | null;
}

/** Draws a face (centred on 0, 0, about 40 px round) for the chapter's speakers. */
export type FacePainter = (g: Phaser.GameObjects.Graphics, face: string, now: number) => void;

export interface DialogueFooterOptions {
  /** "Tiếp", a tap on the footer (the HUD's veil handles taps anywhere else). */
  next: () => void;
  /** A tap on the footer's own background (anywhere else on the footer that is not a button). */
  tapAround?: () => void;
  choose: (i: number) => void;
  drawFace?: FacePainter;
  /** Optional raster portrait; the painter remains the fallback if it is unavailable. */
  faceTexture?: (face: string) => { key: string; frame?: string } | null;
  /** Where the buttons are registered for tests and the HUD (`story.talk.next`, `story.answer.<i>`). */
  buttons: Map<string, Button>;
}

/**
 * The talk footer shared by chapters: the speaker's portrait on the left, the name and the line beside it,
 * then the replies (or "Tiếp" at the bottom right), on a sheet across the whole bottom of the screen that
 * slides up from the bottom edge when a talk opens (see `layout` for phones vs wide screens). Call `show` every frame with the current line
 * (null hides it) and `layout` when the viewport changes.
 */
export class DialogueFooter {
  readonly root: Phaser.GameObjects.Container;
  private readonly card: Card;
  private readonly face: Phaser.GameObjects.Graphics;
  /** The framed avatar: a cream disc under the portrait and a gold ring over its edge. */
  private readonly cloudDecoration: Phaser.GameObjects.Image | null;
  private readonly ringBack: Phaser.GameObjects.Graphics;
  private readonly ringFront: Phaser.GameObjects.Graphics;
  private faceR = 44;
  private faceImage: Phaser.GameObjects.Image | null = null;
  private readonly hero: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text;
  private readonly line: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly timerIcon: Phaser.GameObjects.Image | null;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly nextBtn: Button;
  private readonly answers: Button[];
  private readonly decos: Phaser.GameObjects.Container[] = [];
  private readonly speakerTag: Phaser.GameObjects.Image | null;
  private timed = false;
  private timerColor = '';
  /** Which raster portrait (and ring size) is already set on `faceImage`, so a still portrait costs nothing per frame. */
  private faceKey = '';
  private key = '';
  private h = 132;
  /** How far below its place the footer still is while sliding in. */
  private slide = 0;
  private readonly slideTween = { v: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly opts: DialogueFooterOptions) {
    this.root = scene.add.container(0, 0).setDepth(1600);
    this.card = new Card(scene, this.root);
    this.card.setArt(CHAPTER2_SLICE_ASSETS.karmaPanel.key);
    this.card.bg.swallowClicks().object.on('pointerdown', () => opts.tapAround?.());
    this.ringBack = scene.add.graphics();
    this.ringFront = scene.add.graphics();
    this.face = scene.add.graphics();
    this.hero = portrait(scene);
    this.line = scene.add.text(124, 30, '', { ...text(18, '600'), wordWrap: { width: 520 }, lineSpacing: 2 });
    this.timer = scene.add.text(0, 12, '', text(14, '800', css(COLORS.coral))).setOrigin(1, 0).setBackgroundColor('#fff4df').setPadding(6, 2);
    const ui = CHAPTER2_SLICE_ASSETS.ui.key;
    this.timerIcon = scene.textures.exists(ui) && scene.textures.get(ui).has('6') ? scene.add.image(0, 0, ui, '6').setDisplaySize(30, 30).setVisible(false) : null;
    this.hint = scene.add.text(0, 0, 'Chọn Tiếp hoặc nhấn Enter', text(12, '600', css(COLORS.woodLight))).setOrigin(1, 0.5);
    this.nextBtn = new Button(scene, 0, 0, t('story.next'), () => opts.next(), 'story.talk.next', { fontSize: 16, h: 44 });
    this.nextBtn.setSkin(CHAPTER2_SLICE_ASSETS.actionButton.key);
    opts.buttons.set('story.talk.next', this.nextBtn);
    this.name = scene.add.text(0, 0, '', text(16, '800', '#fff4df'));
    this.root.add([this.ringBack, this.face, this.hero, this.line, this.timer, this.hint, this.nextBtn.text, this.name]);
    if (this.timerIcon) this.root.add(this.timerIcon);
    this.answers = [0, 1, 2].map((i) => {
      const b = new Button(scene, 0, 0, '', () => opts.choose(i), `story.answer.${i}`, { fontSize: 15, h: 44, variant: 'secondary', wrap: true, inset: [46, 32] });
      // The reply's number in an orange disc at the left, an arrow at the right.
      const disc = scene.add.graphics().fillStyle(0xe8833a).fillCircle(0, 0, 13).lineStyle(2, 0xfff4df).strokeCircle(0, 0, 13);
      const num = scene.add.text(0, 0, String(i + 1), text(15, '800', '#ffffff')).setOrigin(.5);
      const arrow = scene.add.text(0, 0, '›', text(24, '800', css(COLORS.coral))).setOrigin(.5, .55);
      const deco = scene.add.container(0, 0, [disc, num, arrow]);
      b.text.add(deco);
      this.decos.push(deco);
      this.root.add(b.text);
      opts.buttons.set(`story.answer.${i}`, b);
      return b;
    });
    const cloudKey = CHAPTER2_SLICE_ASSETS.cloudOrnament.key;
    this.cloudDecoration = scene.textures.exists(cloudKey) ? scene.add.image(0, 0, cloudKey).setOrigin(0) : null;
    if (this.cloudDecoration) this.root.addAt(this.cloudDecoration, 3);
    const frameKey = CHAPTER2_SLICE_ASSETS.speakerNameplate.key;
    this.speakerTag = null;
    if (scene.textures.exists(frameKey)) {
      this.speakerTag = scene.add.image(0, 0, frameKey).setOrigin(0);
      this.root.addAt(this.speakerTag, 3);
    }
    this.root.add(this.ringFront);
    setShown(this.root, false);
  }

  get open(): boolean {
    return this.key !== '';
  }

  show(l: FooterLine | null): void {
    setShown(this.root, !!l);
    if (!l) {
      this.key = '';
      this.slide = 0;
      this.scene.tweens.killTweensOf(this.slideTween);
      return;
    }
    if (dur(MOTION.slow) === 0 && this.slide > 0) {
      this.scene.tweens.killTweensOf(this.slideTween);
      this.slide = 0;
      this.layout();
    }
    const key = `${l.name}|${l.text}|${l.choices?.join('|') ?? ''}`;
    if (key !== this.key) {
      const first = this.key === '';
      this.key = key;
      this.timed = l.timeLeftMs !== null;
      this.name.setText(l.name);
      this.line.setText(l.text).setColor(l.mood === 'wrong' ? css(0xc8463d) : INK);
      this.answers.forEach((b, i) => {
        setShown(b.text, !!l.choices?.[i]);
        if (l.choices?.[i]) b.setLabel(l.choices[i]!);
      });
      setShown(this.nextBtn.text, !l.choices);
      this.nextBtn.setLabel(l.more ? t('story.next') : 'Đi tiếp ▸');
      this.layout();
      if (first) this.slideIn();
    }
    // Faces move a little (bobbing, flapping wings), so they are redrawn every frame.
    this.drawFace(l.face, dur(MOTION.base) === 0 ? 0 : this.scene.time.now);
    const timer = l.timeLeftMs !== null ? l.timeLeftMs > 0 ? `${Math.ceil(l.timeLeftMs / 1000)} giây` : 'Cứ từ từ' : '';
    if (this.timer.text !== timer) this.timer.setText(timer);
    this.timer.setVisible(l.timeLeftMs !== null);
    // Changing a Text's colour re-draws its canvas and re-uploads the texture, so only do it when the colour really changes.
    const timerColor = l.timeLeftMs !== null && l.timeLeftMs > 0 && l.timeLeftMs <= 2000 ? css(COLORS.coral) : INK;
    if (timerColor !== this.timerColor) { this.timerColor = timerColor; this.timer.setColor(timerColor); }
    this.timerIcon?.setVisible(l.timeLeftMs !== null).setPosition(this.timer.x - this.timer.width - 14, this.timer.y + 9);
  }

  /**
   * Always a sheet across the whole bottom edge, sliding up, one vertical rhythm on every screen: the avatar
   * (in its ring) overlaps the top-left corner, the nameplate sits on the top edge, the question is centred
   * on the card, then the replies: stacked on phones, one row of equal cards on wide screens. Side and
   * bottom margins are the same all round and clear of the art's rounded corners (~64 px).
   */
  layout(): void {
    const vw = hudViewport.w, vh = hudViewport.h, { left: safeLeft, right: safeRight, bottom: safeBottom } = hudViewport.safe;
    const usableW = Math.min(1050, vw - safeLeft - safeRight - 24);
    const wide = usableW >= 700, short = vh < 460;
    const compact = usableW < 520 || short;
    const D = short ? 64 : compact ? 68 : 80, R = D / 2;
    const cx = R + 8, cy = 20;
    // Text never runs under the avatar: the same margin on both sides keeps it centred on the card.
    const phone = compact && !short;
    // Phones: the text runs the full inner width, below the avatar; wider screens keep it clear of the avatar's side.
    const clear = phone ? 40 : cx + R + 10, textW = usableW - clear * 2;
    const padS = short ? 40 : compact ? 44 : 56, padB = short ? 50 : 44, innerW = usableW - padS * 2;

    // Nameplate on the top edge: the brown box of the art is centred on the card, the name centred in the box.
    const axis = usableW / 2;
    const ratio = this.speakerTag ? this.speakerTag.height / this.speakerTag.width : 58 / 310;
    const tagW = Math.min(short ? 170 : compact ? 230 : 300, usableW - (cx + R + 10) * 2), tagH = tagW * ratio;
    // The plate straddles the frame's top line: its middle sits on the line, not above it.
    const tagTop = (short ? 11 : 18) - tagH / 2;
    this.speakerTag?.setPosition(axis - tagW * 0.548, tagTop).setDisplaySize(tagW, tagH);
    this.name.setColor(this.speakerTag ? '#fff4df' : INK);
    this.name.setOrigin(.5).setAlign('center').setPosition(axis, tagTop + tagH * .555).setFontSize(short ? 14 : compact ? 15 : 17).setWordWrapWidth(null);
    while (this.name.width > tagW * .6 && Number.parseInt(this.name.style.fontSize as string) > 11) this.name.setFontSize(Number.parseInt(this.name.style.fontSize as string) - 1);

    // The line, centred on the card, just under the nameplate (the side margins already keep it clear of the avatar).
    wrapText(this.line, textW, short ? 13 : compact ? 15 : 17);
    const lineY = Math.max(tagTop + tagH + (short ? 4 : 8), phone ? cy + R + 8 : 0);
    this.line.setPosition(clear, lineY);
    const lineBottom = lineY + Math.ceil(this.line.height);
    this.timer.setPosition(usableW - padS, short ? 26 : compact ? 38 : 40);

    const shown = this.answers.filter((b) => b.text.visible);
    const asking = shown.length > 0;
    const btnH = short ? 34 : compact ? 42 : 48, gap = wide ? 14 : 8;
    let bottom: number;
    if (asking) {
      const y0 = lineBottom + (short ? 8 : 14);
      if (wide) {
        // One row of equal cards filling the inner width.
        const bw = Math.min(300, (innerW - gap * (shown.length - 1)) / shown.length);
        const x0 = padS + (innerW - (bw * shown.length + gap * (shown.length - 1))) / 2;
        shown.forEach((b) => b.setWidth(bw).setHeight(btnH));
        const rowH = Math.max(btnH, ...shown.map((b) => b.height));
        shown.forEach((b, i) => b.setHeight(rowH).text.setPosition(x0 + i * (bw + gap), y0));
        bottom = y0 + rowH;
      } else {
        const bw = Math.min(innerW, 300);
        shown.forEach((b) => b.setWidth(bw).setHeight(btnH));
        const h = Math.max(btnH, ...shown.map((b) => b.height));
        let y = y0;
        for (const b of shown) { b.setHeight(h).text.setPosition((usableW - bw) / 2, y); y += h + gap; }
        bottom = y - gap;
      }
    } else {
      bottom = lineBottom + 10 + this.nextBtn.height;
    }
    // Numbers and arrows follow each card's final size.
    shown.forEach((b) => {
      const d = this.decos[this.answers.indexOf(b)]!;
      (d.getAt(0) as Phaser.GameObjects.Graphics).setPosition(24, b.height / 2);
      (d.getAt(1) as Phaser.GameObjects.Text).setPosition(24, b.height / 2);
      (d.getAt(2) as Phaser.GameObjects.Text).setPosition(b.width - 20, b.height / 2);
    });

    // The art's rounded ends are 64 px tall: a frame shorter than 2 x 64 squashes them into points.
    this.h = Math.max(bottom + padB, 134) + safeBottom;
    this.card.set(usableW, this.h);
    const inner = this.h - safeBottom;

    const sc = (R - 3) / 40;
    this.faceR = R;
    this.face.setScale(sc).setPosition(cx, cy);
    this.hero.setScale(sc).setPosition(cx, cy);
    this.ringBack.clear().fillStyle(0xfff4df).fillCircle(cx, cy, R);
    this.ringFront.clear().lineStyle(6, 0xe9b04f).strokeCircle(cx, cy, R - 3).lineStyle(3, 0x5a3825).strokeCircle(cx, cy, R).lineStyle(2, 0x5a3825, .6).strokeCircle(cx, cy, R - 6);

    if (this.cloudDecoration) {
      const width = short ? 56 : compact ? 76 : 96;
      const height = width * this.cloudDecoration.height / this.cloudDecoration.width;
      this.cloudDecoration.setPosition(wide ? usableW - width + 24 : 2, inner - height + 4).setDisplaySize(width, height).setFlipX(wide);
    }
    this.nextBtn.text.setPosition(usableW - padS - this.nextBtn.width, inner - padB - this.nextBtn.height);
    this.hint.setPosition(this.nextBtn.text.x - 14, inner - padB - this.nextBtn.height / 2).setVisible(!asking && usableW >= 520);
    this.root.setPosition(safeLeft + (vw - safeLeft - safeRight - usableW) / 2, vh - this.h - 12 + this.slide);
  }

  /** Blinks the replies: a tap elsewhere while one of them has to be picked. */
  flash(): void {
    const shown = this.answers.filter((b) => b.text.visible).map((b) => b.text);
    if (!shown.length) return;
    this.scene.tweens.killTweensOf(shown);
    shown.forEach((o) => o.setAlpha(1));
    this.scene.tweens.add({ targets: shown, alpha: 0.25, duration: 110, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => shown.forEach((o) => o.setAlpha(1)) });
  }

  /** Slides the footer up from below the screen. */
  private slideIn(): void {
    if (dur(MOTION.slow) === 0) return;
    this.scene.tweens.killTweensOf(this.slideTween);
    this.slideTween.v = this.slide = this.h;
    // Move it below the screen now: `layout` just put it in its final place, and without this the first frame flashes there.
    this.root.setY(hudViewport.h - this.h - 12 + this.slide);
    this.scene.tweens.add({
      targets: this.slideTween, v: 0, duration: MOTION.slow, ease: 'Cubic.easeOut',
      onUpdate: () => { this.slide = this.slideTween.v; this.root.setY(hudViewport.h - this.h - 12 + this.slide); },
    });
  }

  private drawFace(face: string, now: number): void {
    this.hero.setVisible(face === 'hero');
    this.face.clear();
    const texture = this.opts.faceTexture?.(face);
    if (texture && this.scene.textures.exists(texture.key) && (!texture.frame || this.scene.textures.get(texture.key).has(texture.frame))) {
      if (!this.faceImage) {
        this.faceImage = this.scene.add.image(0, 0, texture.key, texture.frame);
        this.root.add(this.faceImage);
        this.root.bringToTop(this.ringFront);
      }
      this.hero.setVisible(false);
      const key = `${texture.key}|${texture.frame ?? ''}|${this.faceR}|${this.face.x}|${this.face.y}`;
      if (key === this.faceKey) return;
      this.faceKey = key;
      this.faceImage.setTexture(texture.key, texture.frame).setVisible(true).setPosition(this.face.x, this.face.y).setDisplaySize(2 * this.faceR - 4, 2 * this.faceR - 4);
      return;
    }
    this.faceKey = '';
    this.faceImage?.setVisible(false);
    if (face !== 'hero') this.opts.drawFace?.(this.face, face, now);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.slideTween);
    this.root.destroy();
  }
}
