import Phaser from 'phaser';
import { hudScale } from './viewInsets';
import { cssSize, screenCamera } from './pixelRatio';

export type LayoutMode = 'wide' | 'compact';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** What every HUD component positions itself against. World coordinates never enter here. */
export interface HudFrame {
  w: number;
  h: number;
  /** Device safe-area insets (notches, home bar) in px. */
  safe: Insets;
  mode: LayoutMode;
  /** Taller than wide (phone portrait). */
  portrait: boolean;
  /** Outer margin that keeps HUD off the screen edge. */
  margin: number;
  /** HUD zoom (1 on phones, up to 1.6 on big screens). `w`/`h` above are in HUD (virtual) pixels. */
  ui: number;
}

/**
 * The top row of the HUD (sound button on the left, coins and settings on the right): every button in it is
 * `size` tall and starts `inset` below the safe area, so they sit on one line.
 */
export const TOP_ROW = { inset: 12, size: 44 } as const;

/** Size of the HUD's virtual screen (physical size divided by the HUD scale), shared by panels that position themselves. */
export const hudViewport = { w: 0, h: 0, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

/** Reads `env(safe-area-inset-*)` through CSS variables declared in index.html. */
export function readSafeInsets(): Insets {
  try {
    const cs = getComputedStyle(document.documentElement);
    const n = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
    return { top: n('--safe-top'), right: n('--safe-right'), bottom: n('--safe-bottom'), left: n('--safe-left') };
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/**
 * Responsive HUD layout manager. Components subscribe once and re-layout when
 * the viewport changes; a compact mode collapses secondary UI on small screens
 * instead of shrinking the desktop layout.
 */
export class HudLayout {
  private listeners: Array<(f: HudFrame) => void> = [];
  private current: HudFrame;

  constructor(private readonly scene: Phaser.Scene) {
    this.current = this.measure();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  private measure(): HudFrame {
    const { w: rawW, h: rawH } = cssSize(this.scene);
    // Portrait phones and short landscape phones both count as compact.
    const compact = rawW < 760 || rawH < 520;
    const ui = hudScale(rawW, rawH);
    const { w, h } = screenCamera(this.scene, ui);
    hudViewport.w = w;
    hudViewport.h = h;
    const rawSafe = readSafeInsets();
    const safe = { top: rawSafe.top / ui, right: rawSafe.right / ui, bottom: rawSafe.bottom / ui, left: rawSafe.left / ui };
    hudViewport.safe = safe;
    return { w, h, safe, mode: compact ? 'compact' : 'wide', portrait: h > w, margin: compact ? 6 : 10, ui };
  }

  get frame(): HudFrame {
    return this.current;
  }

  /** Calls `fn` now and after every layout change. Returns an unsubscribe function. */
  subscribe(fn: (f: HudFrame) => void): () => void {
    this.listeners.push(fn);
    fn(this.current);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private onResize(): void {
    this.current = this.measure();
    for (const l of this.listeners) l(this.current);
  }

  destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.listeners = [];
  }
}
