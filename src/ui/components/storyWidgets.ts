import type Phaser from 'phaser';
import { Panel } from './Panel';
import { COLORS, css, dur, FONT, MOTION, RADIUS } from '../theme/tokens';
import { TEXT_RES } from '../layout/pixelRatio';

/** Pieces shared by the story HUD and the dialogue footer: text style, cozy card, pill label, hero portrait, pop-in. */
export const INK = css(COLORS.ink);
export const text = (size: number, weight = '600', color = INK): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT.family, fontSize: `${size}px`, fontStyle: weight, color, resolution: TEXT_RES });

/** Measure every wrapped line before fixing the centred text box, including font descenders. */
export function wrapText(label: Phaser.GameObjects.Text, width: number, fontSize: number): void {
  label.setFixedSize(0, 0).setFontSize(fontSize).setPadding(0, 3).setWordWrapWidth(width, true).setAlign('center');
  const lines = Math.max(1, label.getWrappedText().length);
  const height = lines * label.getTextMetrics().fontSize + (lines - 1) * label.lineSpacing + 6;
  label.setFixedSize(width, Math.ceil(height));
}

/** Cozy card: cream paper, chocolate outline, soft offset shadow. */
export class Card {
  private readonly shadow: Panel;
  readonly bg: Panel;
  private art: Phaser.GameObjects.NineSlice | null = null;
  private artEdges = [64, 64, 64, 64];
  private readonly parent: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private readonly fill: number = COLORS.paper, private readonly radius: number = RADIUS.lg) {
    this.parent = parent; this.scene = scene;
    this.shadow = new Panel(scene, { fill: COLORS.ink, alpha: 0.18, radius, borderWidth: 0 });
    this.bg = new Panel(scene, { fill, alpha: 1, border: COLORS.ink, radius, borderWidth: 3 });
    this.shadow.object.setPosition(0, 5);
    parent.add([this.shadow.object, this.bg.object]);
  }
  setArt(key: string, edges = [64, 64, 64, 64]): void {
    if (!this.scene.textures.exists(key)) return;
    this.artEdges = edges;
    this.art ??= this.scene.add.nineslice(0, 0, key, undefined, 128, 128, edges[0]!, edges[1]!, edges[2]!, edges[3]!).setOrigin(0);
    this.art.setTexture(key);
    this.parent.addAt(this.art, 0);
  }
  set(w: number, h: number): void {
    const [left, right, top, bottom] = this.artEdges;
    this.art?.setSlices(w, h, Math.min(left!, w / 2), Math.min(right!, w / 2), Math.min(top!, h / 2), Math.min(bottom!, h / 2));
    this.shadow.object.setVisible(!this.art);
    this.bg.object.setAlpha(this.art ? 0 : 1);
    this.shadow.set(w, h);
    this.bg.set(w, h, { fill: this.fill, alpha: 1, border: COLORS.ink, radius: this.radius, borderWidth: 3 });
  }
}

/** Pill label (chapter chip, name tag, card headers). */
export class Pill {
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
export function portrait(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
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
export function popIn(scene: Phaser.Scene, c: Phaser.GameObjects.Container, w: number, h: number): void {
  if (dur(MOTION.base) === 0) return;
  const x = c.x, y = c.y;
  scene.tweens.killTweensOf(c);
  c.setScale(0.85).setPosition(x + (w * 0.15) / 2, y + (h * 0.15) / 2);
  scene.tweens.add({ targets: c, scale: 1, x, y, duration: MOTION.slow, ease: 'Back.easeOut' });
}
