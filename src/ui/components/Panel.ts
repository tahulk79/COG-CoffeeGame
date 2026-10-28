import type Phaser from 'phaser';
import { bakeTexture } from '../theme/bake';
import { COLORS, RADIUS } from '../theme/tokens';

export interface PanelStyle {
  fill?: number;
  alpha?: number;
  border?: number;
  radius?: number;
  borderWidth?: number;
}

const DEFAULT_TEX = 64;
const DEFAULT_SLICE = 22;

/** Texture key for a panel style (baked on first use, shared by every panel with that style). */
function panelTexture(scene: Phaser.Scene, s: PanelStyle, TEX: number, SLICE: number): string {
  const r = Math.min(s.radius ?? RADIUS.lg, SLICE);
  const fill = s.fill ?? COLORS.espresso;
  const alpha = s.alpha ?? 0.92;
  const border = s.border ?? COLORS.caramel;
  const bw = s.borderWidth ?? 3;
  const key = `ui-panel:${TEX}:${fill}:${Math.round(alpha * 100)}:${border}:${r}:${bw}`;
  return bakeTexture(scene, key, TEX, TEX, (g) => {
    g.fillStyle(fill, alpha).fillRoundedRect(0, 0, TEX, TEX, r);
    if (bw > 0) g.lineStyle(bw, border, 0.9).strokeRoundedRect(bw / 2, bw / 2, TEX - bw, TEX - bw, r);
  });
}

/**
 * A resizable panel background: one nine-slice quad instead of a Graphics that
 * is re-tessellated every frame. `object` is what you add to containers; it can
 * also swallow clicks (`swallowClicks`).
 */
export class Panel {
  readonly object: Phaser.GameObjects.NineSlice;
  private w = 0;
  private h = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    style: PanelStyle = {},
    w = 64,
    h = 64,
    /** Texture size and corner size; small values for thin bars. */
    private readonly tex = DEFAULT_TEX,
    private readonly slice = DEFAULT_SLICE,
  ) {
    const fit = Math.max(1, Math.min(slice, Math.floor(w / 2), Math.floor(h / 2)));
    this.object = scene.add.nineslice(0, 0, panelTexture(scene, style, tex, slice), undefined, w, h, fit, fit, fit, fit).setOrigin(0, 0);
    this.w = w;
    this.h = h;
  }

  /** Change size and/or style. Cheap when nothing changed. */
  set(w: number, h: number, style?: PanelStyle): this {
    if (style) {
      const key = panelTexture(this.scene, style, this.tex, this.slice);
      if (this.object.texture.key !== key) this.object.setTexture(key);
    }
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      const fit = Math.max(1, Math.min(this.slice, Math.floor(w / 2), Math.floor(h / 2)));
      this.object.setSlices(w, h, fit, fit, fit, fit);
      const hit = this.object.input?.hitArea as Phaser.Geom.Rectangle | undefined;
      hit?.setSize(w, h);
    }
    return this;
  }

  /** The panel stops clicks from reaching the world behind it. */
  swallowClicks(): this {
    this.object.setInteractive();
    return this;
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }
}
