import Phaser from 'phaser';
import { COLORS, css, FONT, prefersReducedMotion } from '../../ui/theme/tokens';

/**
 * The speech bubble of the street and the shops, drawn like a game's: a chunky rounded card with a thick chocolate
 * outline, a hard drop shadow, a glossy highlight, sitting right over whoever is talking (no tail, no leader line); it pops in when it starts to speak.
 * The card is baked into a texture once per size and tone, so a bubble costs one image and one piece of text.
 */
export type BubbleTone = 'npc' | 'hero' | 'alert' | 'twist';

const TONES: Record<BubbleTone, { fill: number; text: number }> = {
  /** Anyone talking: cream paper, dark text. */
  npc: { fill: COLORS.paper, text: COLORS.ink },
  /** The hero: coral, white text. */
  hero: { fill: COLORS.coral, text: COLORS.white },
  /** A warning over a gag ("Gâu gâu!"). */
  alert: { fill: COLORS.coral, text: COLORS.white },
  /** The twist of a gag: a darker red. */
  twist: { fill: 0xc8463d, text: COLORS.white },
};

/** Baked at double size so the edge stays sharp on dense screens and when the camera zooms in. */
const SS = 2;
/** The outline, the drop shadow, the room round the body, the tail and the corner radius. */
const OUTLINE = 3, SHADOW = 4, MARGIN = OUTLINE + SHADOW + 2, TAIL = 0, RADIUS = 14;
const PAD_X = 14, PAD_Y = 9;

export class SpeechBubble {
  readonly root: Phaser.GameObjects.Container;
  /** Holds the card and the text so that the pop-in scales about the tail's tip (the root's scale is the caller's). */
  private readonly inner: Phaser.GameObjects.Container;
  private cardOffset = 0;
  private readonly img: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private shown = '';
  private tone: BubbleTone | null = null;
  private w = 0;
  private h = 0;

  constructor(private readonly scene: Phaser.Scene, fontSize = 17) {
    this.img = scene.add.image(0, 0, '__WHITE').setOrigin(0.5, 1);
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${fontSize}px`, fontStyle: '700', color: css(COLORS.ink), align: 'center', wordWrap: { width: 230 }, resolution: 2 }).setOrigin(0.5, 0.5);
    this.inner = scene.add.container(0, 0, [this.img, this.label]);
    this.root = scene.add.container(0, 0, [this.inner]);
  }

  /** Says `text` in the given tone (does nothing if it is already showing). */
  set(text: string, tone: BubbleTone = 'npc'): this {
    if (text === this.shown && tone === this.tone) return this;
    this.shown = text;
    this.tone = tone;
    this.label.setText(text).setColor(css(TONES[tone].text));
    // The cloud's body, sized in steps so different bubbles share textures.
    const bw = Math.ceil((this.label.width + PAD_X * 2) / 8) * 8, bh = Math.ceil((this.label.height + PAD_Y * 2) / 4) * 4;
    const W = bw + MARGIN * 2, H = bh + MARGIN * 2 + TAIL;
    const key = `bubble:anchored:${tone}:${bw}x${bh}`;
    if (!this.scene.textures.exists(key)) this.bake(key, tone, bw, bh, W, H);
    this.img.setTexture(key).setScale(1 / SS);
    this.label.setPosition(this.cardOffset, -(H - MARGIN - bh / 2));
    this.w = W;
    this.h = H;
    if (!prefersReducedMotion()) {
      this.inner.setScale(0.7);
      this.scene.tweens.add({ targets: this.inner, scale: 1, duration: 170, ease: 'Back.Out' });
    }
    return this;
  }

  private bake(key: string, tone: BubbleTone, bw: number, bh: number, W: number, H: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(SS, SS);
    const x = MARGIN, y = MARGIN, fill = TONES[tone].fill;
    g.fillStyle(COLORS.ink, .28).fillRoundedRect(x, y + SHADOW, bw, bh, RADIUS);
    g.fillStyle(COLORS.ink).fillRoundedRect(x - OUTLINE, y - OUTLINE, bw + OUTLINE * 2, bh + OUTLINE * 2, RADIUS + OUTLINE);
    g.fillStyle(fill).fillRoundedRect(x, y, bw, bh, RADIUS);
    // Glossy highlight along the top edge, and a darker lip along the bottom.
    g.fillStyle(0xffffff, .38).fillRoundedRect(x + 8, y + 4, bw - 16, 4, 2);
    g.fillStyle(0x000000, .08).fillRoundedRect(x + 4, y + bh - 7, bw - 8, 4, 2);
    g.generateTexture(key, W * SS, H * SS);
    g.destroy();
  }

  /** Move only the card to fit the viewport; the short triangular tip remains on the speaker. */
  setCardOffsetX(x: number): this {
    x = Math.round(x);
    if (x === this.cardOffset) return this;
    this.cardOffset = x;
    this.img.setX(x); this.label.setX(x);
    return this;
  }

  /** Full size (cloud and tail) at scale 1, in pixels. */
  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  get scale(): number {
    return this.root.scaleX;
  }

  setScale(s: number): this {
    this.root.setScale(s);
    return this;
  }

  /** The tip of the trailing puffs is placed here. */
  setPosition(x: number, y: number): this {
    this.root.setPosition(x, y);
    return this;
  }

  setDepth(d: number): this {
    this.root.setDepth(d);
    return this;
  }

  setVisible(v: boolean): this {
    this.root.setVisible(v);
    return this;
  }

  destroy(): void {
    this.root.destroy();
  }
}
