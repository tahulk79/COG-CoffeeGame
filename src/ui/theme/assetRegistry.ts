import { H5_ASSETS, H5_ICON_FRAMES, H5_EXTRA_ICONS } from '../../components/render/h5Assets';
import type Phaser from 'phaser';
import { bakeTexture } from './bake';
import { COLORS } from './tokens';

/**
 * Presentation asset registry. Gameplay code only knows logical keys; this
 * file says what each key looks like today (a vector placeholder) and where
 * the production art will live. To swap in real art: add a texture/atlas frame
 * named `ui/<key>` (see `textureKey`) — `createIcon` prefers it automatically.
 */
export interface UiAssetDef {
  /** Logical key used by components. */
  key: string;
  kind: 'icon' | 'avatar' | 'thumb' | 'panel';
  /** Future production file (relative to /assets). */
  futurePath: string;
  /** Default display size in px. */
  size: { w: number; h: number };
  anchor: { x: number; y: number };
  /** Panels only: nine-slice insets of the production texture. */
  nineSlice?: { left: number; right: number; top: number; bottom: number };
  /** Draws the placeholder into a Graphics centred on (0,0) for a square of side `s`. */
  draw?: (g: Phaser.GameObjects.Graphics, s: number) => void;
}

const poly = (g: Phaser.GameObjects.Graphics, pts: number[]): void => {
  g.beginPath();
  g.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
  g.closePath();
  g.fillPath();
};

const star = (g: Phaser.GameObjects.Graphics, s: number, color: number): void => {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 === 0 ? 0.5 : 0.22) * s;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fillStyle(color, 1);
  poly(g, pts);
};

const ring = (g: Phaser.GameObjects.Graphics, r: number, color: number, w: number): void => {
  g.lineStyle(w, color, 1).strokeCircle(0, 0, r);
};

const DRAW: Record<string, (g: Phaser.GameObjects.Graphics, s: number) => void> = {
  coin: (g, s) => {
    g.fillStyle(COLORS.gold, 1).fillCircle(0, 0, s * 0.46);
    ring(g, s * 0.46, COLORS.caramel, Math.max(1.5, s * 0.08));
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.05, -s * 0.22, s * 0.1, s * 0.44);
  },
  star: (g, s) => star(g, s * 1.7, COLORS.gold),
  starEmpty: (g, s) => star(g, s * 1.7, COLORS.creamDim),
  heart: (g, s) => {
    g.fillStyle(COLORS.error, 1).fillCircle(-s * 0.18, -s * 0.1, s * 0.22).fillCircle(s * 0.18, -s * 0.1, s * 0.22);
    poly(g, [-s * 0.39, -s * 0.02, s * 0.39, -s * 0.02, 0, s * 0.42]);
  },
  gear: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillCircle(0, 0, s * 0.32);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillRect(Math.cos(a) * s * 0.36 - s * 0.07, Math.sin(a) * s * 0.36 - s * 0.07, s * 0.14, s * 0.14);
    }
    g.fillStyle(COLORS.coffeeBrown, 1).fillCircle(0, 0, s * 0.13);
  },
  farm: (g, s) => {
    g.fillStyle(COLORS.leaf, 1);
    poly(g, [0, -s * 0.42, s * 0.3, -s * 0.05, -s * 0.3, -s * 0.05]);
    poly(g, [0, -s * 0.2, s * 0.38, s * 0.2, -s * 0.38, s * 0.2]);
    g.fillStyle(COLORS.woodLight, 1).fillRect(-s * 0.05, s * 0.2, s * 0.1, s * 0.22);
  },
  cup: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(-s * 0.34, -s * 0.2, s * 0.56, s * 0.5, s * 0.1);
    g.lineStyle(Math.max(2, s * 0.09), COLORS.cream, 1).strokeCircle(s * 0.26, s * 0.04, s * 0.15);
    g.fillStyle(COLORS.coffeeBrown, 1).fillRect(-s * 0.28, -s * 0.15, s * 0.44, s * 0.08);
    g.fillStyle(COLORS.creamDim, 1).fillRect(-s * 0.4, s * 0.34, s * 0.68, s * 0.07);
  },
  people: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillCircle(-s * 0.16, -s * 0.2, s * 0.15).fillCircle(s * 0.2, -s * 0.12, s * 0.12);
    g.fillRoundedRect(-s * 0.36, -s * 0.02, s * 0.4, s * 0.4, s * 0.12);
    g.fillRoundedRect(s * 0.06, s * 0.04, s * 0.32, s * 0.34, s * 0.1);
  },
  brush: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillRect(-s * 0.06, -s * 0.42, s * 0.12, s * 0.5);
    g.fillStyle(COLORS.caramel, 1);
    poly(g, [-s * 0.2, s * 0.06, s * 0.2, s * 0.06, s * 0.12, s * 0.42, -s * 0.12, s * 0.42]);
  },
  map: (g, s) => {
    g.fillStyle(COLORS.cream, 1);
    poly(g, [-s * 0.42, -s * 0.3, -s * 0.14, -s * 0.38, s * 0.14, -s * 0.3, s * 0.42, -s * 0.38, s * 0.42, s * 0.3, s * 0.14, s * 0.38, -s * 0.14, s * 0.3, -s * 0.42, s * 0.38]);
    g.fillStyle(COLORS.error, 1).fillCircle(s * 0.08, -s * 0.02, s * 0.1);
  },
  book: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(-s * 0.36, -s * 0.4, s * 0.72, s * 0.8, s * 0.08);
    g.fillStyle(COLORS.coffeeBrown, 1).fillRect(-s * 0.36, -s * 0.4, s * 0.12, s * 0.8);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.1, -s * 0.2, s * 0.34, s * 0.08).fillRect(-s * 0.1, -s * 0.02, s * 0.34, s * 0.08);
  },
  lock: (g, s) => {
    g.lineStyle(Math.max(2, s * 0.1), COLORS.disabled, 1).strokeCircle(0, -s * 0.12, s * 0.17);
    g.fillStyle(COLORS.disabled, 1).fillRoundedRect(-s * 0.25, -s * 0.05, s * 0.5, s * 0.4, s * 0.06);
  },
  check: (g, s) => {
    g.lineStyle(Math.max(2.5, s * 0.14), COLORS.leaf, 1).beginPath().moveTo(-s * 0.3, 0).lineTo(-s * 0.08, s * 0.24).lineTo(s * 0.32, -s * 0.24).strokePath();
  },
  exp: (g, s) => {
    g.fillStyle(COLORS.leaf, 1).fillCircle(0, 0, s * 0.44);
    g.fillStyle(COLORS.cream, 1);
    poly(g, [0, -s * 0.26, s * 0.18, 0, 0, s * 0.26, -s * 0.18, 0]);
  },
  bell: (g, s) => {
    g.fillStyle(COLORS.gold, 1).fillRoundedRect(-s * 0.28, -s * 0.28, s * 0.56, s * 0.5, s * 0.2);
    g.fillRect(-s * 0.36, s * 0.16, s * 0.72, s * 0.08).fillCircle(0, s * 0.34, s * 0.08);
  },
  scroll: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(-s * 0.34, -s * 0.4, s * 0.68, s * 0.8, s * 0.1);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.2, -s * 0.24, s * 0.4, s * 0.07).fillRect(-s * 0.2, -s * 0.06, s * 0.4, s * 0.07).fillRect(-s * 0.2, s * 0.12, s * 0.24, s * 0.07);
  },
  avatar: (g, s) => {
    g.fillStyle(COLORS.caramel, 1).fillCircle(0, 0, s * 0.5);
    g.fillStyle(COLORS.cream, 1).fillCircle(0, -s * 0.1, s * 0.18);
    g.fillRoundedRect(-s * 0.27, s * 0.1, s * 0.54, s * 0.3, s * 0.14);
  },
  bean: (g, s) => {
    g.fillStyle(COLORS.coffeeBrown, 1).fillEllipse(0, 0, s * 0.5, s * 0.72);
    g.lineStyle(Math.max(2, s * 0.08), COLORS.caramel, 1).beginPath().moveTo(0, -s * 0.34).lineTo(-s * 0.06, 0).lineTo(s * 0.06, s * 0.34).strokePath();
  },
  cherry: (g, s) => {
    g.fillStyle(COLORS.error, 1).fillCircle(-s * 0.12, s * 0.1, s * 0.26).fillCircle(s * 0.16, s * 0.04, s * 0.22);
    g.fillStyle(COLORS.leaf, 1);
    poly(g, [0, -s * 0.34, s * 0.3, -s * 0.2, 0, -s * 0.12]);
  },
  sprout: (g, s) => {
    g.fillStyle(COLORS.woodLight, 1).fillRect(-s * 0.04, -s * 0.05, s * 0.08, s * 0.42);
    g.fillStyle(COLORS.leaf, 1);
    poly(g, [0, -s * 0.06, -s * 0.4, -s * 0.3, -s * 0.28, 0.02 * s]);
    poly(g, [0, -s * 0.12, s * 0.4, -s * 0.38, s * 0.28, -s * 0.02]);
  },
  bottle: (g, s) => {
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(-s * 0.2, -s * 0.12, s * 0.4, s * 0.52, s * 0.08).fillRect(-s * 0.08, -s * 0.38, s * 0.16, s * 0.28);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.2, s * 0.06, s * 0.4, s * 0.12);
  },
  chair: (g, s) => {
    g.fillStyle(COLORS.caramel, 1).fillRoundedRect(-s * 0.26, -s * 0.4, s * 0.52, s * 0.4, s * 0.06).fillRect(-s * 0.26, s * 0.02, s * 0.52, s * 0.14);
    g.fillStyle(COLORS.woodLight, 1).fillRect(-s * 0.24, s * 0.16, s * 0.08, s * 0.24).fillRect(s * 0.16, s * 0.16, s * 0.08, s * 0.24);
  },
  box: (g, s) => {
    g.fillStyle(COLORS.woodLight, 1).fillRoundedRect(-s * 0.36, -s * 0.3, s * 0.72, s * 0.6, s * 0.06);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.36, -s * 0.06, s * 0.72, s * 0.1);
  },
  gift: (g, s) => {
    g.fillStyle(COLORS.error, 1).fillRoundedRect(-s * 0.38, -s * 0.12, s * 0.76, s * 0.5, s * 0.06);
    g.fillStyle(COLORS.gold, 1).fillRect(-s * 0.06, -s * 0.12, s * 0.12, s * 0.5).fillRoundedRect(-s * 0.42, -s * 0.3, s * 0.84, s * 0.2, s * 0.05);
    g.fillStyle(COLORS.gold, 1).fillCircle(-s * 0.16, -s * 0.36, s * 0.1).fillCircle(s * 0.16, -s * 0.36, s * 0.1);
  },
  timer: (g, s) => {
    g.lineStyle(Math.max(2, s * 0.1), COLORS.caramel, 1).strokeCircle(0, s * 0.06, s * 0.34);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.1, -s * 0.44, s * 0.2, s * 0.1).fillRect(-s * 0.03, -s * 0.34, s * 0.06, s * 0.1);
    g.lineStyle(Math.max(2, s * 0.08), COLORS.coffeeBrown, 1).beginPath().moveTo(0, s * 0.06).lineTo(0, -s * 0.14).moveTo(0, s * 0.06).lineTo(s * 0.14, s * 0.12).strokePath();
  },
  cupDark: (g, s) => {
    g.fillStyle(COLORS.coffeeBrown, 1).fillRoundedRect(-s * 0.34, -s * 0.2, s * 0.56, s * 0.5, s * 0.1);
    g.lineStyle(Math.max(2, s * 0.09), COLORS.coffeeBrown, 1).strokeCircle(s * 0.26, s * 0.04, s * 0.15);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.28, -s * 0.15, s * 0.44, s * 0.08);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.4, s * 0.34, s * 0.68, s * 0.07);
  },
  clipboard: (g, s) => {
    g.fillStyle(COLORS.caramel, 1).fillRoundedRect(-s * 0.32, -s * 0.38, s * 0.64, s * 0.8, s * 0.08);
    g.fillStyle(COLORS.cream, 1).fillRect(-s * 0.24, -s * 0.24, s * 0.48, s * 0.6).fillStyle(COLORS.coffeeBrown, 1).fillRect(-s * 0.14, -s * 0.44, s * 0.28, s * 0.12);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.16, -s * 0.1, s * 0.32, s * 0.06).fillRect(-s * 0.16, s * 0.08, s * 0.32, s * 0.06);
  },
  broom: (g, s) => {
    g.lineStyle(Math.max(2.5, s * 0.1), COLORS.woodLight, 1).beginPath().moveTo(s * 0.34, -s * 0.42).lineTo(-s * 0.1, s * 0.1).strokePath();
    g.fillStyle(COLORS.gold, 1);
    poly(g, [-s * 0.34, s * 0.42, -s * 0.2, s * 0.02, s * 0.04, s * 0.16, -s * 0.06, s * 0.42]);
    g.fillStyle(COLORS.caramel, 1).fillRect(-s * 0.3, s * 0.3, s * 0.3, s * 0.06);
  },
  bag: (g, s) => {
    g.fillStyle(COLORS.caramel, 1).fillRoundedRect(-s * 0.32, -s * 0.18, s * 0.64, s * 0.6, s * 0.06);
    g.lineStyle(Math.max(2, s * 0.08), COLORS.coffeeBrown, 1).beginPath().arc(0, -s * 0.18, s * 0.16, Math.PI, 0).strokePath();
  },
  customer: (g, s) => {
    g.fillStyle(COLORS.woodLight, 1).fillCircle(0, 0, s * 0.5);
    g.fillStyle(COLORS.cream, 1).fillCircle(0, -s * 0.1, s * 0.17);
    g.fillRoundedRect(-s * 0.25, s * 0.1, s * 0.5, s * 0.28, s * 0.13);
  },
};

const def = (key: string, kind: UiAssetDef['kind'], w: number, h = w): UiAssetDef => ({ key, kind, futurePath: `ui/${kind === 'avatar' ? 'avatars' : kind + 's'}/${key}.png`, size: { w, h }, anchor: { x: 0.5, y: 0.5 }, ...(DRAW[key] ? { draw: DRAW[key] } : {}) });

export const UI_ASSETS: Record<string, UiAssetDef> = Object.fromEntries(
  [
    ...['coin', 'star', 'starEmpty', 'heart', 'broom', 'bag', 'gift', 'timer', 'cupDark', 'clipboard', 'bean', 'cherry', 'sprout', 'bottle', 'chair', 'box', 'gear', 'farm', 'cup', 'people', 'brush', 'map', 'book', 'lock', 'check', 'exp', 'bell', 'scroll'].map((k) => def(k, 'icon', 24)),
    def('avatar', 'avatar', 44),
    def('customer', 'avatar', 32),
    {
      key: 'panel',
      kind: 'panel',
      futurePath: 'ui/panels/panel.png',
      size: { w: 64, h: 64 },
      anchor: { x: 0, y: 0 },
      nineSlice: { left: 16, right: 16, top: 16, bottom: 16 },
    } as UiAssetDef,
  ].map((d) => [d.key, d]),
);

/** Logical icon for an item category (production art can key by item id later: `item.<id>`). */
export const itemIconKey = (category: string): string =>
  ({ seed: 'sprout', cherry: 'cherry', green: 'bean', roasted: 'bean', ingredient: 'bottle', furniture: 'chair' } as Record<string, string>)[category] ?? 'box';

/** Texture a production build provides for a logical key. */
export const textureKey = (key: string): string => `ui/${key}`;

/**
 * Creates the visual for a logical key: the production texture if one has been
 * loaded under `ui/<key>`, otherwise the vector placeholder. The returned object
 * is centred on its origin.
 */
export function createIcon(scene: Phaser.Scene, key: string, size?: number): Phaser.GameObjects.Container {
  const d = UI_ASSETS[key];
  const s = Math.round(size ?? d?.size.w ?? 24);
  const c = scene.add.container(0, 0);
  if (key === 'avatar' && scene.textures.exists(H5_ASSETS.portrait.key)) {
    c.add(scene.add.image(0, 0, H5_ASSETS.portrait.key).setDisplaySize(s * 1.12, s * 1.12));
  } else if (H5_EXTRA_ICONS[key] !== undefined && scene.textures.exists(H5_ASSETS.extra.key)) {
    c.add(scene.add.image(0,0,H5_ASSETS.extra.key,String(H5_EXTRA_ICONS[key])).setDisplaySize(s*1.2,s*1.2));
  } else if (H5_ICON_FRAMES[key] !== undefined && scene.textures.exists(H5_ASSETS.icons.key)) {
    c.add(scene.add.image(0, 0, H5_ASSETS.icons.key, String(H5_ICON_FRAMES[key])).setDisplaySize(s * 1.2, s * 1.2).setAlpha(key === 'starEmpty' ? .25 : 1));
  } else if (scene.textures.exists(textureKey(key))) {
    c.add(scene.add.image(0, 0, textureKey(key)).setDisplaySize(s, (s * (d?.size.h ?? s)) / (d?.size.w ?? s)));
  } else if (d?.draw) {
    // Baked once per (icon, size): a Graphics would be re-tessellated every frame.
    const pad = Math.ceil(s * 0.95);
    const tex = bakeTexture(scene, `ui-icon:${key}:${s}`, pad * 2, pad * 2, (g) => d.draw!(g, s), pad, pad);
    c.add(scene.add.image(0, 0, tex));
  }
  return c;
}
