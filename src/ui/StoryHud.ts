import Phaser from 'phaser';
import { t } from '../core/i18n';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import { Button } from './widgets/Button';
import { setShown } from './components/panelVisibility';
import { Panel } from './components/Panel';
import { hudViewport, TOP_ROW } from './layout/HudLayout';
import { COLORS, css, dur, FONT, MOTION, RADIUS } from './theme/tokens';
import { drawKeeper, drawSpirit } from '../components/render/trialArt';
import type { TrialPortrait } from '../gameplay/story/TrialService';
import { TEXT_RES } from './layout/pixelRatio';

const INK = css(COLORS.ink);
const text = (size: number, weight = '600', color = INK): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT.family, fontSize: `${size}px`, fontStyle: weight, color, resolution: TEXT_RES });
/** The chapter-2 tracker: the lotus, then five station dots. */
const TRACKER_W = 230;
const stars = (n: number): string => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n)));

/** Cozy card: cream paper, chocolate outline, soft offset shadow. */
class Card {
  private readonly shadow: Panel;
  readonly bg: Panel;
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private readonly fill: number = COLORS.paper, private readonly radius: number = RADIUS.lg) {
    this.shadow = new Panel(scene, { fill: COLORS.ink, alpha: 0.18, radius, borderWidth: 0 });
    this.bg = new Panel(scene, { fill, alpha: 1, border: COLORS.ink, radius, borderWidth: 3 });
    this.shadow.object.setPosition(0, 5);
    parent.add([this.shadow.object, this.bg.object]);
  }
  set(w: number, h: number): void {
    this.shadow.set(w, h);
    this.bg.set(w, h, { fill: this.fill, alpha: 1, border: COLORS.ink, radius: this.radius, borderWidth: 3 });
  }
}

/** Pill label (chapter chip, name tag, card headers). */
class Pill {
  readonly root: Phaser.GameObjects.Container;
  private readonly card: Card;
  private readonly label: Phaser.GameObjects.Text;
  private key = '';
  constructor(scene: Phaser.Scene, fill: number, color: string, size = 15) {
    this.root = scene.add.container(0, 0);
    this.card = new Card(scene, this.root, fill, RADIUS.pill);
    this.label = scene.add.text(16, 0, '', text(size, '800', color)).setOrigin(0, 0.5);
    this.root.add(this.label);
  }
  get width(): number {
    return Math.ceil(this.label.width) + 32;
  }
  /** `maxW` wraps long text onto more lines; the pill grows taller to fit. */
  setText(s: string, h = 34, maxW = 0): this {
    if (this.key === `${s}|${h}|${maxW}`) return this;
    this.key = `${s}|${h}|${maxW}`;
    this.label.setWordWrapWidth(maxW > 0 ? maxW - 32 : null).setText(s);
    this.h = Math.max(h, Math.ceil(this.label.height) + 18);
    this.card.set(this.width, this.h);
    this.label.setY(this.h / 2);
    return this;
  }
  h = 34;
}

/** Round portrait of the hero, drawn in code until character art lands. */
function portrait(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.sun).fillCircle(0, 0, 40).lineStyle(3, COLORS.ink).strokeCircle(0, 0, 40);
  g.fillStyle(COLORS.coral).fillRoundedRect(-24, 14, 48, 22, 10);
  g.fillStyle(0xf6d2b0).fillCircle(0, -4, 20);
  g.fillStyle(0x5a3825).fillEllipse(0, -20, 44, 22).fillRoundedRect(-22, -20, 8, 22, 4).fillRoundedRect(14, -20, 8, 18, 4);
  g.fillStyle(COLORS.ink).fillCircle(-7, -2, 2.6).fillCircle(7, -2, 2.6);
  g.lineStyle(2, COLORS.ink).beginPath().arc(0, 5, 5, 0.2, Math.PI - 0.2).strokePath();
  g.fillStyle(0xff9e8a, 0.6).fillCircle(-13, 6, 4).fillCircle(13, 6, 4);
  return g;
}

/** Pops a card in (scaled from its centre): the eye goes to what just appeared. */
function popIn(scene: Phaser.Scene, c: Phaser.GameObjects.Container, w: number, h: number): void {
  if (dur(MOTION.base) === 0) return;
  const x = c.x, y = c.y;
  scene.tweens.killTweensOf(c);
  c.setScale(0.85).setPosition(x + (w * 0.15) / 2, y + (h * 0.15) / 2);
  scene.tweens.add({ targets: c, scale: 1, x, y, duration: MOTION.slow, ease: 'Back.easeOut' });
}

/**
 * Story UI (chapter screens). Top: chapter chip and the objective / hint card
 * (with a countdown in timed chapters). While a dialogue is open the world dims
 * and a tap ANYWHERE moves on (Enter / Space too). Chapter 1 is free roam: a
 * speech bubble says what happened at a harmless prop without stopping play,
 * and the absurd-death card ends the chapter once the fate strikes.
 */
export class StoryHud {
  readonly buttons = new Map<string, Button>();
  // Dim layer behind any dialogue: tapping it is "next".
  private readonly veil: Phaser.GameObjects.Container;
  private readonly veilRect: Phaser.GameObjects.Rectangle;
  // Chapter chip
  private readonly chip: Pill;
  private readonly chipBox: Phaser.GameObjects.Container;
  // Objective card
  private readonly top: Phaser.GameObjects.Container;
  private readonly topCard: Card;
  private readonly topLabel: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly timerPill: Pill;
  private readonly timerBar: Phaser.GameObjects.Graphics;
  private topW = 520;
  private topH = 64;
  private timeLeft: number | null = null;
  /** Longest countdown seen this chapter: the bar's full length. */
  private timeTotal = 0;
  // "Time's up" banner
  private readonly banner: Phaser.GameObjects.Container;
  private readonly bannerPill: Pill;
  private retriesSeen = -1;
  private bannerUntil = 0;
  // Dialogue box
  private readonly box: Phaser.GameObjects.Container;
  private readonly boxCard: Card;
  private readonly line: Phaser.GameObjects.Text;
  private readonly nameTag: Pill;
  private readonly heroPortrait: Phaser.GameObjects.Graphics;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly tapHint: Phaser.GameObjects.Text;
  private boxW = 680;
  private boxH = 132;
  private readonly next: Button;
  // Death card (ends chapter 1)
  private readonly card: Phaser.GameObjects.Container;
  private readonly cardBg: Card;
  private readonly cardHeader: Pill;
  private readonly cardKicker: Phaser.GameObjects.Text;
  private readonly cardTitle: Phaser.GameObjects.Text;
  private readonly cardStars: Phaser.GameObjects.Text;
  private readonly accept: Button;
  private cardW = 420;
  private cardH = 300;
  private cardKey = '';
  // Chapter-1 run: survival time, controls hint, sound button, retry on the death card
  private readonly runBar: Phaser.GameObjects.Container;
  private readonly runTime: Pill;
  private readonly muteBtn: Button;
  // Chapter-2 road: five station dots and the karma lotus (no objective text)
  private readonly tracker: Phaser.GameObjects.Container;
  private readonly trackerCard: Card;
  private readonly gems: Phaser.GameObjects.Graphics;
  /** Starts as a key no real state has, so the tracker is drawn on the first frame. */
  private gemsKey = '-';
  // Chapter-2 karma book: a button, and the lessons collected so far
  private readonly bookBtn: Button;
  private readonly book: Phaser.GameObjects.Container;
  private readonly bookCard: Card;
  private readonly bookTitle: Phaser.GameObjects.Text;
  private readonly bookText: Phaser.GameObjects.Text;
  private bookOpen = false;
  private bookLabel = '';
  private bookKey = '';
  // Chapter-2 footer: who is talking (portrait, name), the line, and "Tiếp" or the replies
  private readonly talk: Phaser.GameObjects.Container;
  private readonly talkCard: Card;
  private readonly talkFace: Phaser.GameObjects.Graphics;
  private readonly talkHero: Phaser.GameObjects.Graphics;
  private readonly talkName: Pill;
  private readonly talkLine: Phaser.GameObjects.Text;
  private readonly talkTimer: Phaser.GameObjects.Text;
  private readonly talkHint: Phaser.GameObjects.Text;
  private readonly talkNext: Button;
  private readonly talkAnswers: Button[];
  private talkKey = '';
  private talkW = 680;
  private talkH = 132;
  // Chapter-2 rebirth wheel
  private readonly wheel: Phaser.GameObjects.Container;
  private readonly wheelCard: Card;
  private readonly wheelTitle: Phaser.GameObjects.Text;
  private readonly wheelItem: Phaser.GameObjects.Text;
  private readonly wheelLessons: Phaser.GameObjects.Text;
  private wheelKey = '';
  private wheelW = 420;
  private wheelH = 220;
  private readonly retry: Button;
  // Stall talks (chapter 1) and station questions (chapter 2): the replies to pick from
  private readonly choiceBtns: Button[];
  private readonly choicePanel: Phaser.GameObjects.Container;
  private readonly choiceCard: Card;
  private readonly choiceTitle: Phaser.GameObjects.Text;
  private choiceKey = '';
  // Chapter-1 speech bubble (hits, harmless props)
  private readonly aside: Phaser.GameObjects.Container;
  private readonly asidePill: Pill;
  private lastSnapshot: SimulationSnapshot | null = null;
  private dialogKey = '';
  private lastAside: string | null = null;
  private readonly keyHandler = () => this.onNext();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly advance: () => void,
    private readonly retryRun: () => void = () => undefined,
    private readonly toggleMute: () => void = () => undefined,
    private readonly choose: (i: number) => void = () => undefined,
  ) {
    this.veil = scene.add.container(0, 0).setDepth(1590);
    this.veilRect = scene.add.rectangle(0, 0, 10, 10, COLORS.ink, 0.28).setOrigin(0, 0).setInteractive();
    this.veilRect.on('pointerdown', () => this.onNext());
    this.veil.add(this.veilRect);

    this.chipBox = scene.add.container(0, 0).setDepth(1500);
    this.chip = new Pill(scene, COLORS.sun, INK);
    this.chipBox.add(this.chip.root);

    this.top = scene.add.container(0, 0).setDepth(1500);
    this.topCard = new Card(scene, this.top);
    this.topLabel = scene.add.text(18, 12, 'MỤC TIÊU', text(12, '800', css(COLORS.coral)));
    this.objective = scene.add.text(18, 28, '', text(17, '700'));
    this.timerBar = scene.add.graphics();
    this.timerPill = new Pill(scene, COLORS.coral, css(COLORS.white), 17);
    this.top.add([this.topLabel, this.objective, this.timerBar, this.timerPill.root]);

    this.banner = scene.add.container(0, 0).setDepth(1550);
    this.bannerPill = new Pill(scene, COLORS.coral, css(COLORS.white), 18);
    this.banner.add(this.bannerPill.root);

    this.box = scene.add.container(0, 0).setDepth(1600);
    this.boxCard = new Card(scene, this.box);
    this.boxCard.bg.swallowClicks().object.on('pointerdown', () => this.onNext());
    this.heroPortrait = portrait(scene);
    this.line = scene.add.text(124, 26, '', { ...text(18, '600'), wordWrap: { width: 520 }, lineSpacing: 2 });
    this.dots = scene.add.graphics();
    this.tapHint = scene.add.text(0, 0, 'Chạm bất kỳ đâu để tiếp', text(12, '600', css(COLORS.woodLight))).setOrigin(1, 0.5);
    this.next = new Button(scene, 0, 0, t('story.next'), () => this.onNext(), 'story.next', { fontSize: 16, h: 40 });
    this.nameTag = new Pill(scene, COLORS.coral, css(COLORS.white));
    this.box.add([this.heroPortrait, this.line, this.dots, this.tapHint, this.next.text, this.nameTag.root]);
    this.buttons.set('story.next', this.next);

    this.card = scene.add.container(0, 0).setDepth(1600);
    this.cardBg = new Card(scene, this.card);
    this.cardBg.bg.swallowClicks().object.on('pointerdown', () => this.onNext());
    this.cardHeader = new Pill(scene, COLORS.sun, INK, 16);
    this.cardKicker = scene.add.text(0, 0, '', text(14, '700', css(COLORS.woodLight))).setOrigin(0.5, 0);
    this.cardTitle = scene.add.text(0, 0, '', { ...text(28, '800'), align: 'center', wordWrap: { width: 360 }, lineSpacing: -4 }).setOrigin(0.5, 0);
    this.cardStars = scene.add.text(0, 0, '', text(16, '700', css(COLORS.coral))).setOrigin(0.5, 0).setVisible(false);
    this.accept = new Button(scene, 0, 0, 'Bước vào thiên đàng ▸', () => this.onNext(), 'story.death.next', { fontSize: 17, h: 46 });
    this.retry = new Button(scene, 0, 0, 'Chơi lại', () => this.retryRun(), 'story.death.retry', { fontSize: 17, h: 46, variant: 'secondary' });
    this.card.add([this.cardHeader.root, this.cardKicker, this.cardTitle, this.cardStars, this.accept.text, this.retry.text]);
    this.buttons.set('story.death.next', this.accept);
    this.buttons.set('story.death.retry', this.retry);

    this.runBar = scene.add.container(0, 0).setDepth(1500);
    this.runTime = new Pill(scene, COLORS.paper, INK, 24);
    this.runBar.add(this.runTime.root);
    this.tracker = scene.add.container(0, 0).setDepth(1500);
    this.trackerCard = new Card(scene, this.tracker, COLORS.paper, RADIUS.pill);
    this.trackerCard.set(TRACKER_W, 56);
    this.gems = scene.add.graphics();
    this.tracker.add(this.gems);
    this.muteBtn = new Button(scene, 0, 0, t('story.soundOn'), () => this.toggleMute(), 'story.mute', { fontSize: 16, h: TOP_ROW.size, w: 92, variant: 'secondary' });
    this.buttons.set('story.mute', this.muteBtn);
    this.choicePanel = scene.add.container(0, 0).setDepth(1550);
    this.choiceCard = new Card(scene, this.choicePanel);
    this.choiceCard.bg.swallowClicks();
    this.choiceTitle = scene.add.text(16, 12, 'BẠN TRẢ LỜI', text(13, '800', css(COLORS.ink)));
    this.choicePanel.add(this.choiceTitle);
    this.choiceBtns = [0, 1, 2].map((i) => {
      const b = new Button(scene, 0, 0, '', () => this.choose(i), `story.choice.${i}`, { fontSize: 17, h: 48, variant: 'secondary', wrap: true });
      this.choicePanel.add(b.text);
      this.buttons.set(`story.choice.${i}`, b);
      return b;
    });


    this.bookBtn = new Button(scene, 0, 0, 'Sổ Phúc Đức', () => { this.bookOpen = !this.bookOpen; this.bookKey = ''; }, 'story.book', { fontSize: 16, h: TOP_ROW.size, variant: 'secondary' });
    this.buttons.set('story.book', this.bookBtn);
    this.book = scene.add.container(0, 0).setDepth(1560);
    this.bookCard = new Card(scene, this.book);
    this.bookCard.bg.swallowClicks().object.on('pointerdown', () => { this.bookOpen = false; this.bookKey = ''; });
    this.bookTitle = scene.add.text(18, 14, 'SỔ PHÚC ĐỨC', text(14, '800', css(COLORS.coral)));
    this.bookText = scene.add.text(18, 40, '', { ...text(16, '600'), wordWrap: { width: 380 }, lineSpacing: 4 });
    this.book.add([this.bookTitle, this.bookText]);

    this.talk = scene.add.container(0, 0).setDepth(1600);
    this.talkCard = new Card(scene, this.talk);
    this.talkCard.bg.swallowClicks().object.on('pointerdown', () => this.onNext());
    this.talkFace = scene.add.graphics();
    this.talkHero = portrait(scene);
    this.talkLine = scene.add.text(124, 30, '', { ...text(18, '600'), wordWrap: { width: 520 }, lineSpacing: 2 });
    this.talkTimer = scene.add.text(0, 12, '', text(14, '800', css(COLORS.coral))).setOrigin(1, 0);
    this.talkHint = scene.add.text(0, 0, 'Chạm bất kỳ đâu để tiếp', text(12, '600', css(COLORS.woodLight))).setOrigin(1, 0.5);
    this.talkNext = new Button(scene, 0, 0, t('story.next'), () => this.onNext(), 'story.talk.next', { fontSize: 16, h: 40 });
    this.buttons.set('story.talk.next', this.talkNext);
    this.talkName = new Pill(scene, COLORS.coral, css(COLORS.white));
    this.talk.add([this.talkFace, this.talkHero, this.talkLine, this.talkTimer, this.talkHint, this.talkNext.text, this.talkName.root]);
    this.talkAnswers = [0, 1, 2].map((i) => {
      const b = new Button(scene, 0, 0, '', () => this.choose(i), `story.answer.${i}`, { fontSize: 17, h: 46, variant: 'secondary', wrap: true });
      this.talk.add(b.text);
      this.buttons.set(`story.answer.${i}`, b);
      return b;
    });

    this.wheel = scene.add.container(0, 0).setDepth(1600);
    this.wheelCard = new Card(scene, this.wheel);
    this.wheelCard.bg.swallowClicks();
    this.wheelTitle = scene.add.text(0, 18, '', text(16, '800', css(COLORS.coral))).setOrigin(0.5, 0);
    this.wheelItem = scene.add.text(0, 48, '', { ...text(32, '800'), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5, 0);
    this.wheelLessons = scene.add.text(0, 0, '', { ...text(14, '600', css(COLORS.woodLight)), align: 'center', wordWrap: { width: 380 }, lineSpacing: 3 }).setOrigin(0.5, 0);
    this.wheel.add([this.wheelTitle, this.wheelItem, this.wheelLessons]);

    this.aside = scene.add.container(0, 0).setDepth(1500);
    this.asidePill = new Pill(scene, COLORS.paper, INK, 16);
    this.aside.add(this.asidePill.root);

    scene.input.keyboard?.on('keydown-ENTER', this.keyHandler);
    scene.input.keyboard?.on('keydown-SPACE', this.keyHandler);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();
    for (const c of [this.veil, this.chipBox, this.top, this.banner, this.box, this.card, this.aside, this.runBar, this.muteBtn.text, this.tracker, this.choicePanel, this.bookBtn.text, this.book, this.wheel, this.talk]) setShown(c, false);
  }

  private onNext(): void {
    if ((this.scene as Phaser.Scene & { modalOpen?: boolean }).modalOpen) return;
    const st = this.lastSnapshot?.story;
    // Chapter 2: a tap goes on to the next line, except while a reply is waiting to be picked.
    if (st?.dialog || (st?.trial?.say && !st.trial.choices)) this.advance();
  }

  private layout(): void {
    const vw = hudViewport.w, vh = hudViewport.h;
    const { top: safeTop, left: safeLeft, right: safeRight, bottom: safeBottom } = hudViewport.safe;
    const usableW = vw - safeLeft - safeRight;
    this.veilRect.setSize(vw, vh);
    if (this.veilRect.input) (this.veilRect.input.hitArea as Phaser.Geom.Rectangle).setSize(vw, vh);
    // Narrow screens: the objective card goes under the chip instead of beside it.
    const narrow = vw < 900;
    this.chipBox.setPosition(safeLeft + 12, safeTop + 12);

    this.topW = Math.min(560, vw - 24);
    const timerW = this.timeLeft === null ? 0 : this.timerPill.width + 12;
    this.objective.setWordWrapWidth(this.topW - 36 - timerW);
    this.topH = Math.ceil(this.objective.height) + 42 + (this.timeLeft === null ? 0 : 18);
    this.topCard.set(this.topW, this.topH);
    this.top.setPosition(vw / 2 - this.topW / 2, safeTop + (narrow ? 58 : 12));
    this.timerPill.root.setVisible(this.timeLeft !== null).setPosition(this.topW - this.timerPill.width - 14, 12);
    this.drawTimerBar();
    this.banner.setPosition(vw / 2 - this.bannerPill.width / 2, this.top.y + this.topH + 14);

    this.boxW = Math.min(680, usableW - 24);
    const compact = this.boxW < 480;
    this.heroPortrait.setScale(compact ? 0.7 : 1).setPosition(compact ? 44 : 62, compact ? 50 : 66);
    const textX = compact ? 88 : 124;
    this.line.setPosition(textX, 28).setWordWrapWidth(this.boxW - textX - 24);
    this.nameTag.root.setPosition(textX - 6, -17);
    this.boxH = Math.max(132, Math.ceil(this.line.height) + 92);
    this.boxCard.set(this.boxW, this.boxH);
    this.box.setPosition(safeLeft + (usableW - this.boxW) / 2, vh - this.boxH - 16 - safeBottom);
    this.placeNext();
    this.aside.setPosition(vw / 2 - this.asidePill.width / 2, vh - this.asidePill.h - 24 - safeBottom);

    this.cardW = Math.min(460, vw - 32);
    this.cardTitle.setWordWrapWidth(this.cardW - 48);
    const titleH = Math.ceil(this.cardTitle.height);
    // Simple ending card: what killed you, how long you lasted, then two buttons side by side (stacked when narrow).
    const row = this.cardW >= this.retry.width + this.accept.width + 60;
    const by = 40 + titleH + 12 + 22 + 24;
    this.cardH = by + (row ? 46 : 46 + 12 + 46) + 24;
    this.cardBg.set(this.cardW, this.cardH);
    this.cardHeader.root.setPosition(this.cardW / 2 - this.cardHeader.width / 2, -18);
    this.cardTitle.setPosition(this.cardW / 2, 40);
    this.cardKicker.setPosition(this.cardW / 2, 40 + titleH + 12);
    if (row) {
      const x0 = this.cardW / 2 - (this.retry.width + 12 + this.accept.width) / 2;
      this.retry.text.setPosition(x0, by);
      this.accept.text.setPosition(x0 + this.retry.width + 12, by);
    } else {
      this.accept.text.setPosition(this.cardW / 2 - this.accept.width / 2, by);
      this.retry.text.setPosition(this.cardW / 2 - this.retry.width / 2, by + 46 + 12);
    }
    this.runBar.setPosition(vw / 2 - this.runTime.width / 2, safeTop + (narrow ? 58 : 12));
    this.tracker.setPosition(vw / 2 - TRACKER_W / 2, safeTop + (narrow ? 58 : 12));
    this.muteBtn.text.setPosition(safeLeft + TOP_ROW.inset, safeTop + TOP_ROW.inset);
    this.bookBtn.text.setPosition(safeLeft + TOP_ROW.inset + this.muteBtn.width + 10, safeTop + TOP_ROW.inset);
    const bookW = Math.min(440, usableW - 24);
    this.bookText.setWordWrapWidth(bookW - 36);
    this.bookCard.set(bookW, Math.ceil(this.bookText.height) + 58);
    this.book.setPosition(safeLeft + (usableW - bookW) / 2, safeTop + TOP_ROW.inset + TOP_ROW.size + 14);
    this.wheelW = Math.min(460, usableW - 24);
    for (const label of [this.wheelItem, this.wheelLessons]) label.setWordWrapWidth(this.wheelW - 40);
    this.wheelTitle.setX(this.wheelW / 2);
    this.wheelItem.setX(this.wheelW / 2);
    this.wheelLessons.setPosition(this.wheelW / 2, 48 + Math.ceil(this.wheelItem.height) + 18);
    this.wheelH = this.wheelLessons.y + Math.ceil(this.wheelLessons.height) + 22;
    this.wheelCard.set(this.wheelW, this.wheelH);
    this.wheel.setPosition(vw / 2 - this.wheelW / 2, Math.max(safeTop + 40, vh / 2 - this.wheelH / 2));
    this.card.setPosition(vw / 2 - this.cardW / 2, Math.max(safeTop + 40, vh / 2 - this.cardH / 2));
    this.layoutTalk(usableW, vh, safeLeft, safeBottom);
    // Portrait: above the joystick; landscape: beside it, leaving its left corner free.
    const landscape = vw > vh && usableW >= 600;
    const panelW = Math.min(landscape ? 380 : 520, usableW - (landscape ? 180 : 24));
    let choiceY = 38;
    for (const button of this.choiceBtns) {
      button.setWidth(panelW - 24);
      button.text.setPosition(12, choiceY);
      if (button.text.visible) choiceY += button.height + 10;
    }
    const panelH = choiceY + 4;
    this.choiceCard.set(panelW, panelH);
    this.choicePanel.setPosition(
      landscape ? vw - safeRight - panelW - 12 : safeLeft + (usableW - panelW) / 2,
      vh - safeBottom - panelH - (landscape ? 16 : 148),
    );
  }

  /** The chapter-2 footer: portrait on the left, the line, then the replies stacked under it (or "Tiếp" at the bottom right). */
  private layoutTalk(usableW: number, vh: number, safeLeft: number, safeBottom: number): void {
    this.talkW = Math.min(760, usableW - 24);
    const compact = this.talkW < 480;
    const faceX = compact ? 44 : 62, faceY = compact ? 50 : 66, textX = compact ? 88 : 124;
    this.talkFace.setScale(compact ? 0.7 : 1).setPosition(faceX, faceY);
    this.talkHero.setScale(compact ? 0.7 : 1).setPosition(faceX, faceY);
    this.talkLine.setPosition(textX, 30).setWordWrapWidth(this.talkW - textX - 24);
    this.talkName.root.setPosition(textX - 6, -17);
    this.talkTimer.setX(this.talkW - 18);
    let y = 30 + Math.ceil(this.talkLine.height) + 16;
    const asking = this.talkAnswers.some((b) => b.text.visible);
    // Narrow screens: the replies take the whole width, under the portrait too.
    const ansX = compact ? 16 : textX, ansW = this.talkW - ansX - 18;
    for (const b of this.talkAnswers) {
      if (!b.text.visible) continue;
      b.setWidth(ansW);
      b.text.setPosition(ansX, Math.max(y, compact ? 104 : 0));
      y = b.text.y + b.height + 10;
    }
    this.talkH = asking ? Math.max(132, y + 6) : Math.max(132, y + 54);
    this.talkCard.set(this.talkW, this.talkH);
    this.talkNext.text.setPosition(this.talkW - this.talkNext.width - 18, this.talkH - this.talkNext.height - 14);
    this.talkHint.setPosition(this.talkNext.text.x - 14, this.talkH - 14 - this.talkNext.height / 2).setVisible(!asking && this.talkW >= 520);
    this.talk.setPosition(safeLeft + (usableW - this.talkW) / 2, vh - this.talkH - 16 - safeBottom);
  }

  /** The footer's face for whoever talks: the hero's portrait, a keeper's bust, the coffee spirit or the karma book. */
  private drawFace(who: TrialPortrait, now: number): void {
    const g = this.talkFace.clear();
    this.talkHero.setVisible(who === 'hero');
    if (who === 'hero') return;
    const bg = who === 'book' ? COLORS.sun : who === 'spirit' ? 0xd8ecff : 0xfff1d6;
    g.fillStyle(bg).fillCircle(0, 0, 40).lineStyle(3, COLORS.ink).strokeCircle(0, 0, 40);
    if (who === 'spirit') drawSpirit(g, 0, 6, now);
    else if (who === 'book') {
      g.fillStyle(COLORS.coral).fillRoundedRect(-22, -18, 44, 36, 4).lineStyle(3, COLORS.ink).strokeRoundedRect(-22, -18, 44, 36, 4);
      g.fillStyle(COLORS.paper).fillRect(-16, -14, 32, 28).lineStyle(2, COLORS.ink).lineBetween(0, -14, 0, 14);
      for (const yy of [-6, 0, 6]) g.lineStyle(2, COLORS.woodLight).lineBetween(-12, yy, -4, yy).lineBetween(4, yy, 12, yy);
    } else drawKeeper(g, 0, 50, who, now, 0, true);
  }

  private placeNext(): void {
    this.next.text.setPosition(this.boxW - this.next.width - 18, this.boxH - this.next.height - 14);
    this.tapHint.setPosition(this.next.text.x - 14, this.boxH - 14 - this.next.height / 2).setVisible(this.boxW >= 520);
  }

  /** Countdown bar under the objective: mint while there is time, coral in the last 10 seconds. */
  private drawTimerBar(): void {
    const g = this.timerBar.clear();
    if (this.timeLeft === null || this.timeTotal <= 0) return;
    const x = 18, y = this.topH - 22, w = this.topW - 36, h = 10;
    const p = Math.max(0, Math.min(1, this.timeLeft / this.timeTotal));
    g.fillStyle(COLORS.creamDim).fillRoundedRect(x, y, w, h, h / 2);
    if (p > 0) g.fillStyle(this.timeLeft <= 10 ? COLORS.coral : COLORS.mint).fillRoundedRect(x, y, Math.max(h, w * p), h, h / 2);
    g.lineStyle(2, COLORS.ink).strokeRoundedRect(x, y, w, h, h / 2);
  }

  /** "1 of 3" as dots at the bottom-left of the dialogue box. */
  private drawDots(index: number, total: number): void {
    const g = this.dots.clear();
    if (total < 2) return;
    const x0 = this.line.x + 4, y = this.boxH - 32;
    for (let i = 0; i < total; i++) {
      g.fillStyle(i === index ? COLORS.coral : COLORS.creamDim).fillCircle(x0 + i * 18, y, 5);
      g.lineStyle(2, COLORS.ink).strokeCircle(x0 + i * 18, y, 5);
    }
  }

  update(s: SimulationSnapshot): void {
    this.lastSnapshot = s;
    const st = s.story;
    const d = st.dialog;
    let relayout = false;

    setShown(this.veil, d !== null || (!!st.trial?.say && !st.trial.spin));
    // The chapter-1 run has no chapter chip: just play.
    // Between chapters (doors closing, next map loading) the story already points at the next chapter:
    // show nothing of it yet, the doors carry its title.
    const between = st.locked && d === null;
    const trial = st.trial;
    setShown(this.chipBox, st.active && !between && st.chapter !== 'S03' && !trial);
    const run = st.run;
    const running = !!run?.running && d === null;
    // Keep the play area clear of the objective card.
    setShown(this.top, false);
    setShown(this.runBar, false);
    setShown(this.muteBtn.text, (!!run || !!trial) && !between);
    setShown(this.tracker, !!trial && !between && !trial.spin);
    setShown(this.bookBtn.text, !!trial && !between && !trial.spin);
    if (trial) this.syncTrial(trial, between);
    else setShown(this.talk, false);
    if (run && running) {
      const w = this.runTime.width;
      this.runTime.setText(`${Math.floor(run.aliveMs / 1000)} giây`, 44);
      if (w !== this.runTime.width) relayout = true;
    }
    // Stall talk or station question waiting for a reply: two or three buttons (also keys 1, 2, 3).
    const choices = d === null && !between ? st.street?.choices ?? null : null;
    const choicesKey = choices?.join('|') ?? '';
    setShown(this.choicePanel, choices !== null);
    if (choicesKey !== this.choiceKey) {
      this.choiceKey = choicesKey;
      this.choiceBtns.forEach((b, i) => {
        setShown(b.text, !!choices?.[i]);
        if (choices?.[i]) b.setLabel(`${i + 1} · ${choices[i]}`);
      });
      relayout = true;
    }
    // Says the state in words: an icon alone got muted by players trying to turn sound on.
    if (run || trial) this.muteBtn.setLabel(this.scene.sound.mute ? t('story.soundOff') : t('story.soundOn'));
    if (st.active) this.chip.setText(st.title, 38);

    // What just happened at a harmless prop: a bubble at the bottom, play goes on.
    const aside = d === null ? st.aside : null;
    if (aside && aside !== this.lastAside) {
      this.asidePill.setText(aside, 48, Math.min(560, hudViewport.w - 32));
      // Place it for its new width first, so it pops in centred (not from where the last one was).
      this.layout();
      popIn(this.scene, this.aside, this.asidePill.width, this.asidePill.h);
    }
    this.lastAside = aside;
    setShown(this.aside, aside !== null && !between && choices === null);

    const objective = st.objective;
    if (this.objective.text !== objective) {
      this.objective.setText(objective);
      relayout = true;
    }
    // Chapter 1 names the act ("HỒI 2/3 · GIỜ TAN TẦM"); other chapters show their objective.
    const label = st.act ?? 'MỤC TIÊU';
    if (this.topLabel.text !== label) this.topLabel.setText(label);
    if (st.timeLeftSec !== this.timeLeft) {
      if ((this.timeLeft === null) !== (st.timeLeftSec === null)) relayout = true;
      this.timeLeft = st.timeLeftSec;
      this.timeTotal = this.timeLeft === null ? 0 : Math.max(this.timeTotal, this.timeLeft);
      if (this.timeLeft !== null) this.timerPill.setText(`${this.timeLeft}s`);
      this.drawTimerBar();
    }

    // Time ran out: say so before the player is put back at the start.
    if (this.retriesSeen >= 0 && st.retries > this.retriesSeen) {
      this.bannerPill.setText('Hết giờ! Thử lại nhé', 40);
      this.bannerUntil = this.scene.time.now + 2200;
      this.layout();
      popIn(this.scene, this.banner, this.bannerPill.width, 40);
    }
    this.retriesSeen = st.retries;
    setShown(this.banner, this.scene.time.now < this.bannerUntil);

    // Dialogue line or death card.
    setShown(this.box, d?.kind === 'line');
    setShown(this.card, d?.kind === 'death');
    const key = d ? `${d.kind}|${d.index}|${d.text}` : '';
    if (d && key !== this.dialogKey) {
      const first = !this.dialogKey.startsWith(`${d.kind}|`);
      this.dialogKey = key;
      if (d.kind === 'line') {
        this.line.setText(d.text);
        const h = Math.max(132, Math.ceil(this.line.height) + 92);
        if (h !== this.boxH) {
          this.boxH = h;
          relayout = true;
        }
        this.nameTag.setText('Bạn', 34);
        this.next.setLabel(d.index + 1 >= d.total ? 'Bắt đầu ▸' : t('story.next'));
        this.drawDots(d.index, d.total);
        if (first) {
          this.layout();
          popIn(this.scene, this.box, this.boxW, this.boxH);
        }
      } else {
        this.showCard(d.text, st.fate);
        relayout = false;
        if (this.cardKey !== key) popIn(this.scene, this.card, this.cardW, this.cardH);
        this.cardKey = key;
      }
    }
    if (!d) this.dialogKey = '';
    if (relayout) this.layout();
    if (d?.kind === 'line') this.placeNext();
  }

  /** Chapter 2: the tracker (stations passed, karma), the karma book and the rebirth wheel. */
  private syncTrial(v: NonNullable<SimulationSnapshot['story']['trial']>, between: boolean): void {
    // The footer: one line at a time, "Tiếp" (or a tap anywhere) goes on; a question shows its replies in it.
    const say = !between && !v.spin ? v.say : null;
    setShown(this.talk, !!say);
    if (say) {
      const key = `${say.who}|${say.text}|${v.choices?.join('|') ?? ''}`;
      if (key !== this.talkKey) {
        const first = this.talkKey === '';
        this.talkKey = key;
        this.talkName.setText(say.name, 34);
        this.talkLine.setText(say.text).setColor(say.mood === 'wrong' ? css(0xc8463d) : INK);
        this.talkAnswers.forEach((b, i) => {
          setShown(b.text, !!v.choices?.[i]);
          if (v.choices?.[i]) b.setLabel(`${i + 1} · ${v.choices[i]}`);
        });
        setShown(this.talkNext.text, !v.choices);
        this.talkNext.setLabel(say.more ? t('story.next') : 'Đi tiếp ▸');
        this.layout();
        if (first) popIn(this.scene, this.talk, this.talkW, this.talkH);
      }
      // Faces move a little (bobbing, flapping wings), so they are redrawn every frame.
      this.drawFace(say.portrait, this.scene.time.now);
      const timer = v.timeLeftMs !== null ? `⏱ ${Math.ceil(v.timeLeftMs / 1000)} giây` : '';
      if (this.talkTimer.text !== timer) this.talkTimer.setText(timer);
    } else {
      this.talkKey = '';
    }
    const done = v.stations.filter((s) => s.done).length;
    const key = `${done}|${v.karma}`;
    if (key !== this.gemsKey) {
      const first = this.gemsKey === '-';
      this.gemsKey = key;
      this.drawTracker(v.stations.map((s) => s.done), v.karma, v.karmaRange);
      if (!first) popIn(this.scene, this.tracker, TRACKER_W, 56);
    }
    const label = `Sổ Phúc Đức (${v.lessons.length})`;
    if (this.bookLabel !== label) { this.bookLabel = label; this.bookBtn.setLabel(label); this.layout(); }
    const showBook = this.bookOpen && !between && !v.spin;
    setShown(this.book, showBook);
    const bookKey = `${showBook}|${v.lessons.join('|')}`;
    if (showBook && bookKey !== this.bookKey) {
      this.bookKey = bookKey;
      this.bookText.setText(v.lessons.length ? v.lessons.map((l, i) => `${i + 1}. ${l}`).join('\n') : 'Chưa có lời nhắn nào. Trả lời câu hỏi ở các trạm để ghi vào sổ.');
      this.layout();
      popIn(this.scene, this.book, Math.min(440, hudViewport.w - 24), 120);
    }
    // The wheel: the item flicks by, lands, then the card lists what the hero takes along.
    setShown(this.wheel, !!v.spin && !between);
    if (v.spin) {
      const item = v.spin.items[v.spin.index] ?? '';
      const wheelKey = `${item}|${v.spin.landed}`;
      if (wheelKey !== this.wheelKey) {
        const first = this.wheelKey === '';
        this.wheelKey = wheelKey;
        this.wheelTitle.setText(v.spin.title.toUpperCase());
        this.wheelItem.setText(v.spin.landed ? `${item}!` : item).setColor(v.spin.landed ? css(COLORS.coral) : INK);
        this.wheelLessons.setText(v.spin.landed ? `Mang theo ${v.karma} điểm Phúc Đức và ${v.lessons.length} lời nhắn:\n${v.lessons.map((l) => `• ${l}`).join('\n')}` : '');
        this.layout();
        if (first || v.spin.landed) popIn(this.scene, this.wheel, this.wheelW, this.wheelH);
      }
    } else this.wheelKey = '';
  }

  /** Five station dots (filled once passed) and the karma lotus, brighter the more karma. */
  private drawTracker(done: boolean[], karma: number, range: { min: number; max: number }): void {
    const g = this.gems.clear();
    const k = Math.max(0, Math.min(1, (karma - range.min) / (range.max - range.min)));
    const lx = 36, ly = 28;
    const petal = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xb9b0a8), Phaser.Display.Color.ValueToColor(0xf6a6d0), 100, Math.round(k * 100));
    const pc = Phaser.Display.Color.GetColor(petal.r, petal.g, petal.b);
    if (k > 0.5) g.fillStyle(COLORS.sun, (k - 0.5) * 0.9).fillCircle(lx, ly, 24);
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const x = lx + Math.sin(a) * 9, y = ly - Math.cos(a) * 7;
      g.fillStyle(pc).fillEllipse(x, y, 11, 24).lineStyle(2, COLORS.ink).strokeEllipse(x, y, 11, 24);
    }
    g.fillStyle(COLORS.mint).fillEllipse(lx, ly + 12, 34, 8).lineStyle(2, COLORS.ink).strokeEllipse(lx, ly + 12, 34, 8);
    done.forEach((on, i) => {
      const x = 82 + i * 30, y = 28;
      g.fillStyle(on ? COLORS.coral : COLORS.creamDim).fillCircle(x, y, 9).lineStyle(3, COLORS.ink).strokeCircle(x, y, 9);
      if (on) g.fillStyle(0xffffff, 0.8).fillCircle(x - 3, y - 3, 2.5);
    });
  }

  private showCard(death: string, fate: SimulationSnapshot['story']['fate']): void {
    this.cardHeader.setText(`Cái chết lãng xẹt #${fate?.number ?? 1}`, 36);
    this.cardKicker.setText(fate ? `Sống sót ${fate.aliveSec} giây` : '');
    this.cardTitle.setText(death);
    this.cardStars.setText(`Độ lãng xẹt  ${stars(fate?.absurdity ?? 3)}`);
    this.layout();
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-ENTER', this.keyHandler);
    this.scene.input.keyboard?.off('keydown-SPACE', this.keyHandler);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    for (const c of [this.veil, this.chipBox, this.top, this.banner, this.box, this.card, this.aside, this.runBar, this.muteBtn.text, this.tracker, this.choicePanel, this.bookBtn.text, this.book, this.wheel, this.talk]) c.destroy();
  }
}
