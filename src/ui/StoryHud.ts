import Phaser from 'phaser';
import { t } from '../core/i18n';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import { Button } from './widgets/Button';
import { setShown } from './components/panelVisibility';
import { Card, INK, Pill, popIn, text, wrapText } from './components/storyWidgets';
import { hudViewport, TOP_ROW } from './layout/HudLayout';
import { COLORS, css, RADIUS, dur, MOTION } from './theme/tokens';
import { drawTrialFace, trialFaceTexture } from '../components/render/trialArt';
import { DialogueFooter } from './DialogueFooter';
import { GameModal } from './components/GameModal';
import { CHAPTER2_SLICE_ASSETS } from '../components/render/sliceAssets';

/** The chapter-2 tracker: the lotus, then five station dots. */
const TRACKER_W = 278;
const stars = (n: number): string => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n)));

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
  private readonly quest: Phaser.GameObjects.Container;
  private readonly questText: Phaser.GameObjects.Text;
  private readonly questTitle: Phaser.GameObjects.Text;
  private readonly questCard: Card;
  private readonly questHit: Phaser.GameObjects.Zone;
  private reaperFinished = false;
  private readonly tracker: Phaser.GameObjects.Container;
  private readonly trackerCard: Card;
  private readonly gems: Phaser.GameObjects.Graphics;
  private readonly karmaLabel: Phaser.GameObjects.Text;
  private readonly lotus: Phaser.GameObjects.Image | null;
  private readonly lessonFlight: Phaser.GameObjects.Container;
  private seenLessonAt = -1;
  /** Starts as a key no real state has, so the tracker is drawn on the first frame. */
  private gemsKey = '-';
  // Chapter-2 karma book: a button, and the lessons collected so far
  private readonly bookBtn: Button;
  readonly bookModal: GameModal;
  private readonly bookScore: Phaser.GameObjects.Text;
  private readonly bookText: Phaser.GameObjects.Text;
  private readonly bookPageLabel: Phaser.GameObjects.Text;
  private readonly bookPrev: Button;
  private readonly bookNext: Button;
  private bookPage = 0;
  private bookLessons: string[] = [];
  private bookLabel = '';
  private bookKey = '';
  // Chapter-2 talk footer (shared component)
  private readonly footer: DialogueFooter;
  // Chapter-2 rebirth wheel
  private readonly wheel: Phaser.GameObjects.Container;
  private readonly wheelCard: Card;
  private readonly wheelTitle: Phaser.GameObjects.Text;
  private readonly wheelItem: Phaser.GameObjects.Text;
  private readonly wheelPointer: Phaser.GameObjects.Image | null;
  private readonly wheelLessons: Phaser.GameObjects.Text;
  private readonly wheelPlate: Phaser.GameObjects.Image | null;
  private wheelKey = '';
  private wheelW = 420;
  private wheelH = 220;
  private readonly retry: Button;
  // Chapter-1 speech bubble (hits, harmless props)
  private readonly aside: Phaser.GameObjects.Container;
  private readonly asidePill: Pill;
  private lastSnapshot: SimulationSnapshot | null = null;
  private lastAside: string | null = null;
  private readonly keyHandler = (event: KeyboardEvent) => { if (!event.repeat) this.onNext(); };
  private advancedAt = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly advance: () => void,
    private readonly retryRun: () => void = () => undefined,
    private readonly toggleMute: () => void = () => undefined,
    private readonly choose: (i: number) => void = () => undefined,
    private readonly toggleBook: () => void = () => undefined,
    private readonly walkNext: () => void = () => undefined,
  ) {
    this.veil = scene.add.container(0, 0).setDepth(1490);
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

    this.card = scene.add.container(0, 0).setDepth(1600);
    this.cardBg = new Card(scene, this.card);
    this.cardBg.setArt(CHAPTER2_SLICE_ASSETS.karmaPanel.key);
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
    this.accept.setSkin(CHAPTER2_SLICE_ASSETS.actionButton.key);
    this.retry.setSkin(CHAPTER2_SLICE_ASSETS.actionButton.key);

    this.runBar = scene.add.container(0, 0).setDepth(1500);
    this.runTime = new Pill(scene, COLORS.paper, INK, 24);
    this.runBar.add(this.runTime.root);
    this.tracker = scene.add.container(0, 0).setDepth(1500);
    this.trackerCard = new Card(scene, this.tracker, COLORS.paper, RADIUS.pill);
    this.trackerCard.setArt(CHAPTER2_SLICE_ASSETS.progressPanel.key);
    this.trackerCard.set(TRACKER_W, 56);
    this.gems = scene.add.graphics();
    this.karmaLabel = scene.add.text(70, 28, '0', text(14, '800')).setOrigin(0, 0.5);
    this.tracker.add([this.gems, this.karmaLabel]);
    const ui = CHAPTER2_SLICE_ASSETS.ui.key;
    this.lotus = scene.textures.exists(ui) && scene.textures.get(ui).has('7') ? scene.add.image(36, 28, ui, '0').setDisplaySize(60, 60) : null;
    if (this.lotus) this.tracker.add(this.lotus);
    this.muteBtn = new Button(scene, 0, 0, t('story.soundOn'), () => this.toggleMute(), 'story.mute', { fontSize: 16, h: TOP_ROW.size, w: 92, variant: 'secondary' });
    this.buttons.set('story.mute', this.muteBtn);
    this.bookBtn = new Button(scene, 0, 0, 'Sổ Phúc Đức', () => {
      const trial = this.lastSnapshot?.story.trial;
      if (!trial || trial.phase === 'spin' || trial.phase === 'done') return;
      this.showBookPage();
      this.toggleBook();
    }, 'story.book', { fontSize: 16, h: TOP_ROW.size, variant: 'secondary' });
    if (scene.textures.exists(ui) && scene.textures.get(ui).has('3')) this.bookBtn.setIconTexture(ui, '3');
    this.buttons.set('story.book', this.bookBtn);
    this.bookModal = new GameModal(scene, 'Sổ Phúc Đức', 520, 360, 'story.book', undefined, 'light');
    this.bookScore = scene.add.text(0, 0, '', { ...text(15, '800'), wordWrap: { width: 460 } });
    this.bookText = scene.add.text(0, 52, '', { ...text(17, '600'), wordWrap: { width: 460 }, lineSpacing: 4 });
    this.bookPageLabel = scene.add.text(0, 0, '', text(14, '700')).setOrigin(0.5);
    this.bookPrev = new Button(scene, 0, 0, '◂ Trước', () => { this.bookPage--; this.showBookPage(); }, 'story.book.prev', { h: 44, w: 100, fontSize: 15, variant: 'secondary' });
    this.bookNext = new Button(scene, 0, 0, 'Sau ▸', () => { this.bookPage++; this.showBookPage(); }, 'story.book.next', { h: 44, w: 100, fontSize: 15, variant: 'secondary' });
    this.bookModal.body.add([this.bookScore, this.bookText, this.bookPageLabel, this.bookPrev.text, this.bookNext.text]);
    for (const b of [...this.bookModal.buttons, this.bookPrev, this.bookNext]) this.buttons.set(b.name, b);
    this.bookModal.onLayout((w, h) => {
      this.bookScore.setWordWrapWidth(w);
      this.bookText.setWordWrapWidth(w);
      this.bookPrev.text.setPosition(0, h - 44);
      this.bookNext.text.setPosition(w - this.bookNext.width, h - 44);
      this.bookPageLabel.setPosition(w / 2, h - 22);
    });

    this.quest = scene.add.container(0, 0).setDepth(1501);
    this.questCard = new Card(scene, this.quest);
    this.questCard.setArt(CHAPTER2_SLICE_ASSETS.questPanel.key, [26, 26, 65, 22]);
    this.questTitle = scene.add.text(0, 0, 'Nhiệm vụ chính', { ...text(15, '800', '#fff4d8'), align: 'center' }).setOrigin(.5);
    this.questText = scene.add.text(0, 0, '', { ...text(16, '700'), align: 'center', lineSpacing: 3 });
    this.quest.add([this.questTitle, this.questText]);
    this.questHit = scene.add.zone(0, 0, 280, 160).setOrigin(0).setInteractive();
    this.quest.add(this.questHit);
    const questHit = this.questHit;
    questHit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.lastSnapshot?.story.trial?.phase === 'walk' && !(this.scene as Phaser.Scene & { modalOpen?: boolean }).modalOpen) this.walkNext();
    });
    questHit.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.footer = new DialogueFooter(scene, { next: () => this.onNext(), tapAround: () => this.onNext(), choose: (i) => this.choose(i), drawFace: drawTrialFace, faceTexture: trialFaceTexture, buttons: this.buttons });

    this.wheel = scene.add.container(0, 0).setDepth(1600);
    this.wheelCard = new Card(scene, this.wheel);
    this.wheelCard.setArt(CHAPTER2_SLICE_ASSETS.karmaPanel.key);
    this.wheelCard.bg.swallowClicks();
    // Same frame and nameplate as the talk footer, so the rebirth result reads as part of the same UI.
    const plate = CHAPTER2_SLICE_ASSETS.speakerNameplate.key;
    this.wheelPlate = scene.textures.exists(plate) ? scene.add.image(0, 0, plate).setOrigin(0) : null;
    if (this.wheelPlate) this.wheel.add(this.wheelPlate);
    this.wheelTitle = scene.add.text(0, 18, '', text(14, '800', '#fff4df')).setOrigin(0.5);
    this.wheelPointer = scene.textures.exists(ui) && scene.textures.get(ui).has('7') ? scene.add.image(0, 54, ui, '7').setDisplaySize(32, 32) : null;
    this.wheelItem = scene.add.text(0, 0, '', { ...text(30, '800'), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5, 0);
    this.wheelLessons = scene.add.text(0, 0, '', { ...text(14, '600', css(COLORS.woodLight)), align: 'center', wordWrap: { width: 380 }, lineSpacing: 3 }).setOrigin(0.5, 0);
    this.wheel.add([this.wheelTitle, this.wheelItem, this.wheelLessons]);
    if (this.wheelPointer) this.wheel.add(this.wheelPointer);

    this.lessonFlight = scene.add.container(0, 0).setDepth(1620).setVisible(false);
    const lessonCard = new Card(scene, this.lessonFlight);
    lessonCard.set(168, 48);
    if (scene.textures.exists(ui) && scene.textures.get(ui).has('3')) this.lessonFlight.add(scene.add.image(23, 24, ui, '3').setDisplaySize(34, 34));
    this.lessonFlight.add(scene.add.text(44, 24, 'Lời nhắn +1', text(16, '800')).setOrigin(0, .5));

    this.aside = scene.add.container(0, 0).setDepth(1500);
    this.asidePill = new Pill(scene, COLORS.paper, INK, 16);
    this.aside.add(this.asidePill.root);

    scene.input.keyboard?.on('keydown-ENTER', this.keyHandler);
    scene.input.keyboard?.on('keydown-SPACE', this.keyHandler);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();
    for (const c of [this.veil, this.chipBox, this.top, this.banner, this.card, this.aside, this.runBar, this.muteBtn.text, this.tracker, this.bookBtn.text, this.wheel]) setShown(c, false);
  }

  private onNext(): void {
    if ((this.scene as Phaser.Scene & { modalOpen?: boolean }).modalOpen) return;
    // A key and a tap in the same frame must not consume two dialogue lines.
    if (this.advancedAt === this.scene.time.now) return;
    const st = this.lastSnapshot?.story;
    if (!st?.dialog && st?.trial?.phase === 'walk') return this.walkNext();
    // Chapter 2: a tap goes on to the next line, except while a reply is waiting to be picked.
    if (st?.dialog || (st?.trial?.say && !st.trial.choices)) {
      this.advancedAt = this.scene.time.now;
      this.advance();
    } else if (st?.trial?.say && st.trial.choices) {
      // A reply has to be picked: anything else (a tap outside, Enter) only blinks the replies.
      this.footer.flash();
    }
  }

  private layout(): void {
    this.stopLessonFlight();
    const vw = hudViewport.w, vh = hudViewport.h;
    const { top: safeTop, left: safeLeft, right: safeRight, bottom: safeBottom } = hudViewport.safe;
    const usableW = vw - safeLeft - safeRight;
    this.bookBtn.setLabel(usableW < 440 ? `Sổ (${this.lastSnapshot?.story.trial?.lessons.length ?? this.bookLessons.length})` : this.bookLabel || 'Sổ Phúc Đức');
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
    this.top.setPosition(vw / 2 - this.topW / 2, safeTop + (narrow ? TOP_ROW.inset + TOP_ROW.size + 10 : 12));
    this.timerPill.root.setVisible(this.timeLeft !== null).setPosition(this.topW - this.timerPill.width - 14, 12);
    this.drawTimerBar();
    this.banner.setPosition(vw / 2 - this.bannerPill.width / 2, this.top.y + this.topH + 14);

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
    this.runBar.setPosition(vw / 2 - this.runTime.width / 2, safeTop + (narrow ? TOP_ROW.inset + TOP_ROW.size + 10 : 12));
    this.tracker.setPosition(vw / 2 - TRACKER_W / 2, safeTop + (usableW < 960 ? TOP_ROW.inset + TOP_ROW.size + 10 : 12));
    this.muteBtn.text.setPosition(safeLeft + TOP_ROW.inset, safeTop + TOP_ROW.inset);
    this.bookBtn.text.setPosition(safeLeft + TOP_ROW.inset + this.muteBtn.width + 10, safeTop + TOP_ROW.inset);
    this.wheelW = Math.min(1050, usableW - 24);
    const wideWheel = this.wheelW >= 520, textW = this.wheelW - 2 * (wideWheel ? 70 : 44);
    for (const label of [this.wheelItem, this.wheelLessons]) label.setWordWrapWidth(textW);
    // The nameplate straddles the frame's top line, like the footer's.
    const ratio = this.wheelPlate ? this.wheelPlate.height / this.wheelPlate.width : 58 / 310;
    const tagW = Math.min(wideWheel ? 330 : 270, this.wheelW - 40), tagH = tagW * ratio, tagTop = 18 - tagH / 2;
    this.wheelPlate?.setPosition(this.wheelW / 2 - tagW * 0.548, tagTop).setDisplaySize(tagW, tagH);
    this.wheelTitle.setPosition(this.wheelW / 2, tagTop + tagH * 0.555).setFontSize(13).setWordWrapWidth(0);
    while (this.wheelTitle.width > tagW * 0.6 && Number.parseInt(this.wheelTitle.style.fontSize as string) > 9) this.wheelTitle.setFontSize(Number.parseInt(this.wheelTitle.style.fontSize as string) - 1);
    this.wheelPointer?.setPosition(this.wheelW / 2, tagTop + tagH + 6).setVisible(false);
    this.wheelItem.setPosition(this.wheelW / 2, tagTop + tagH + 16);
    this.wheelLessons.setPosition(this.wheelW / 2, this.wheelItem.y + Math.ceil(this.wheelItem.height) + 10);
    this.wheelH = Math.max(134, this.wheelLessons.y + Math.ceil(this.wheelLessons.height) + 44);
    this.wheelCard.set(this.wheelW, this.wheelH);
    this.wheel.setPosition(vw / 2 - this.wheelW / 2, vh - this.wheelH - 12 - safeBottom);
    this.card.setPosition(vw / 2 - this.cardW / 2, Math.max(safeTop + 40, vh / 2 - this.cardH / 2));
    this.layoutQuest();
    this.footer.layout();
  }

  private layoutQuest(): void {
    const { w, h, safe } = hudViewport;
    const short = h < 460;
    const compact = w < 600 || short;
    const width = Math.min(short ? 300 : compact ? 232 : 280, w - safe.left - safe.right - 84);
    const bodyWidth = width - 52;
    this.questTitle.setPosition(width / 2, 38).setFontSize(compact ? 14 : 16);
    const bodyY = short ? 60 : 72;
    wrapText(this.questText, bodyWidth, short ? 13 : compact ? 14 : 16);
    this.questText.setPosition(26, bodyY);
    const height = Math.max(short ? 120 : 144, bodyY + this.questText.height + (short ? 18 : 26));
    this.questCard.set(width, height);
    this.questHit.setSize(width, height);
    (this.questHit.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(width, height);
    this.quest.setPosition(safe.left + 12, safe.top + 12).setScale(1);
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
    this.veilRect.setAlpha(.08);
    setShown(this.chipBox, st.active && !between && st.chapter !== 'S03' && !trial);
    const run = st.run;
    const running = !!run?.running && d === null;
    // Keep the play area clear of the objective card.
    setShown(this.top, false);
    setShown(this.runBar, false);
    setShown(this.muteBtn.text, false);
    setShown(this.tracker, false);
    setShown(this.bookBtn.text, false);
    setShown(this.quest, !between && d === null && (trial ? trial.phase !== 'spin' && trial.phase !== 'done' : !!run?.running && !st.street?.talking));
    if (trial) this.syncTrial(trial, between);
    else {
      const choices = d === null && !between ? st.street?.choices ?? null : null;
      const speaker = choices ? st.street?.npcs.find(n => n.say && n.id.startsWith(`${st.street?.talking}:`)) : null;
      this.footer.show(d?.kind === 'line' ? {
        name: 'Bạn', face: 'hero', text: d.text, mood: null,
        more: d.index + 1 < d.total, choices: null, timeLeftMs: null,
      } : choices ? {
        name: 'Bạn trả lời', face: 'hero', text: speaker?.say ?? 'Bạn sẽ trả lời thế nào?',
        mood: null, more: false, choices, timeLeftMs: null,
      } : null);
      if (this.questText.text !== 'Dạo phố') {
        this.questText.setText('Dạo phố');
        this.layoutQuest();
      }
    }
    if (run && running) {
      const w = this.runTime.width;
      this.runTime.setText(`${Math.floor(run.aliveMs / 1000)} giây`, 44);
      if (w !== this.runTime.width) relayout = true;
    }
    // Says the state in words: an icon alone got muted by players trying to turn sound on.
    if (s.freeWalk) this.muteBtn.setLabel(this.scene.sound.mute ? t('story.soundOff') : t('story.soundOn'));
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
    setShown(this.aside, aside !== null && !between && st.street?.choices == null);

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

    setShown(this.card, d?.kind === 'death');
    const key = d?.kind === 'death' ? `${d.kind}|${d.text}` : '';
    if (d?.kind === 'death' && key !== this.cardKey) {
      this.showCard(d.text, st.fate);
      relayout = false;
      popIn(this.scene, this.card, this.cardW, this.cardH);
    }
    this.cardKey = key;
    if (relayout) this.layout();
  }

  /** Chapter 2: the tracker (stations passed, karma), the karma book and the rebirth wheel. */
  private syncTrial(v: NonNullable<SimulationSnapshot['story']['trial']>, between: boolean): void {
    // The footer: one line at a time, "Tiếp" (or a tap anywhere) goes on; a question shows its replies in it.
    const say = !between && !v.spin ? v.say : null;
    const destination = v.stations.find(s => !s.done) ?? v.gate;
    if (v.phase === 'walk') this.reaperFinished = true;
    const intro = !this.reaperFinished && v.stations.every(s => !s.done);
    const objective = intro ? 'Gặp Thần Chết\nHoàn tất hồ sơ để bắt đầu.' : v.phase === 'walk' ? `Gặp ${destination.name}\nChạm nhiệm vụ để đi tới NPC.` : v.choices ? `Gặp ${destination.name}\nĐọc câu hỏi và chọn đáp án bên dưới.` : v.say?.who === 'book' ? 'Lời nhắn đã ghi\nBấm Đi tiếp để đến trạm sau.' : `Gặp ${destination.name}\nBấm Tiếp để nghe câu chuyện.`;
    if (this.questText.text !== objective) { this.questText.setText(objective); this.layoutQuest(); }
    this.footer.show(say ? { name: say.name, face: say.portrait, text: say.text, mood: say.mood, more: say.more, choices: v.choices, timeLeftMs: v.timeLeftMs } : null);
    const done = v.stations.filter((s) => s.done).length;
    const key = `${done}|${v.karma}`;
    if (key !== this.gemsKey) {
      const first = this.gemsKey === '-';
      this.gemsKey = key;
      this.drawTracker(v.stations.map((s) => s.done), v.karma, v.karmaRange, v.karmaLevels);
      this.karmaLabel.setText(`${done}/5`);
      if (!first) popIn(this.scene, this.tracker, TRACKER_W, 56);
    }
    const label = `Sổ Phúc Đức (${v.lessons.length})`;
    if (this.bookLabel !== label) { this.bookLabel = label; this.bookBtn.setLabel(label); this.layout(); }
    if ((between || v.phase === 'spin' || v.phase === 'done') && this.bookModal.isOpen) this.bookModal.close();
    const bookKey = `${v.karma}|${v.lessons.join('|')}`;
    if (bookKey !== this.bookKey) {
      this.bookKey = bookKey;
      this.bookLessons = [...v.lessons];
      const level = v.karma >= v.karmaLevels.high ? 'Cao' : v.karma >= v.karmaLevels.mid ? 'Trung bình' : 'Thấp';
      const score = v.karma > 0 ? `+${v.karma}` : String(v.karma);
      this.bookScore.setText(`Phúc Đức: ${score} · ${level}\nGiới hạn ${v.karmaRange.min} đến +${v.karmaRange.max} · ${v.lessons.length}/5 lời nhắn`);
      this.showBookPage();
    }
    // The wheel: the item flicks by, lands, then the card lists what the hero takes along.
    setShown(this.wheel, !!v.spin && !between);
    if (v.spin) {
      const item = dur(MOTION.base) === 0 && !v.spin.landed ? 'Đang chọn nơi trùng sinh…' : v.spin.items[v.spin.index] ?? '';
      const wheelKey = `${item}|${v.spin.landed}`;
      if (wheelKey !== this.wheelKey) {
        const first = this.wheelKey === '';
        this.wheelKey = wheelKey;
        this.wheelTitle.setText(v.spin.title.toUpperCase());
        this.wheelItem.setText(v.spin.landed ? `${item}!` : item).setColor(v.spin.landed ? css(COLORS.coral) : INK);
        this.wheelLessons.setText(v.spin.landed ? `Mang theo ${v.karma} điểm Phúc Đức và ${v.lessons.length} lời nhắn.\nBước sang cuộc đời mới…` : '');
        this.layout();
        if (first || v.spin.landed) popIn(this.scene, this.wheel, this.wheelW, this.wheelH);
      }
    } else this.wheelKey = '';
    const modal = !!(this.scene as Phaser.Scene & { modalOpen?: boolean }).modalOpen;
    if (modal || between || v.spin || dur(MOTION.base) === 0) this.stopLessonFlight();
    const freshLesson = v.events.find((e) => e.kind === 'lesson' && e.at > this.seenLessonAt);
    if (freshLesson) {
      this.seenLessonAt = freshLesson.at;
      if (!modal && !between && !v.spin) this.flyLesson();
    }
  }

  /** Five station dots (filled once passed) and the karma lotus, brighter the more karma. */
  private drawTracker(done: boolean[], karma: number, range: { min: number; max: number }, levels: { high: number; mid: number }): void {
    const g = this.gems.clear();
    if (this.lotus) {
      const frame = karma >= levels.high ? '2' : karma >= levels.mid ? '1' : '0';
      this.lotus.setFrame(frame).setTint(frame === '0' ? 0xa6a6a6 : 0xffffff);
    } else {
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
    }
    done.forEach((on, i) => {
      const x = 110 + i * 32, y = 28;
      if (on) g.fillStyle(COLORS.coral).fillCircle(x, y, 7);
      if (on) g.fillStyle(0xffffff, 0.8).fillCircle(x - 3, y - 3, 2.5);
    });
  }

  private stopLessonFlight(): void {
    this.scene.tweens.killTweensOf(this.lessonFlight);
    this.lessonFlight.setVisible(false);
  }

  private flyLesson(): void {
    if (!this.bookBtn.text.visible) return;
    if (dur(MOTION.base) === 0) return;
    this.stopLessonFlight();
    const target = this.bookBtn.center();
    this.lessonFlight.setPosition(hudViewport.w / 2 - 84, hudViewport.h - 196 - hudViewport.safe.bottom).setScale(1).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: this.lessonFlight, x: target.x - 21, y: target.y - 6, scale: .25, alpha: .2,
      duration: 650, ease: 'Sine.easeIn', onComplete: () => this.lessonFlight.setVisible(false),
    });
  }

  private showBookPage(): void {
    const count = this.bookLessons.length;
    this.bookPage = Math.max(0, Math.min(this.bookPage, count - 1));
    this.bookText.setText(count ? `Lời nhắn ${this.bookPage + 1}\n\n${this.bookLessons[this.bookPage]}` : 'Chưa có lời nhắn nào. Qua các trạm để ghi thêm vào sổ.');
    this.bookPageLabel.setText(count ? `${this.bookPage + 1}/${count}` : '0/5');
    this.bookPrev.setEnabled(this.bookPage > 0);
    this.bookNext.setEnabled(this.bookPage < count - 1);
  }

  private showCard(death: string, fate: SimulationSnapshot['story']['fate']): void {
    this.cardHeader.setText(`Cái chết lãng xẹt #${fate?.number ?? 1}`, 36);
    this.cardKicker.setText(fate ? `Sống sót ${fate.aliveSec} giây` : '');
    this.cardTitle.setText(death);
    this.cardStars.setText(`Độ lãng xẹt  ${stars(fate?.absurdity ?? 3)}`);
    this.layout();
  }

  destroy(): void {
    this.quest.destroy();
    this.stopLessonFlight();
    this.lessonFlight.destroy();
    this.scene.input.keyboard?.off('keydown-ENTER', this.keyHandler);
    this.scene.input.keyboard?.off('keydown-SPACE', this.keyHandler);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    for (const c of [this.veil, this.chipBox, this.top, this.banner, this.card, this.aside, this.runBar, this.muteBtn.text, this.tracker, this.bookBtn.text, this.wheel]) c.destroy();
    this.footer.destroy();
    this.bookModal.destroy();
  }
}
