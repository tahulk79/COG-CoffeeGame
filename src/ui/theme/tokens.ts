/**
 * Design tokens: the single source of truth for the HUD's look.
 * Components import from here; no colour, size or duration is hardcoded elsewhere.
 */
export const COLORS = {
  coffeeBrown: 0x5b3523,
  espresso: 0x291b17,
  caramel: 0xc88d47,
  cream: 0xfff1d8,
  leaf: 0x6fa86c,
  gold: 0xf5c451,
  error: 0xd96b5f,
  // Derived tones
  espressoSoft: 0x3a2820,
  woodLight: 0x8a5a3a,
  creamDim: 0xe8d4b0,
  shadow: 0x000000,
  disabled: 0x8a7a68,
  white: 0xffffff,
  /** Watering / water-related indicators. */
  water: 0x6ec6ff,
} as const;

export type ColorToken = keyof typeof COLORS;

/** `0xRRGGBB` → `#rrggbb` for Phaser text styles. */
export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

export const FONT = {
  family: "'Trebuchet MS', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  size: { xs: 12, sm: 14, md: 16, lg: 19, xl: 24 },
} as const;

export const RADIUS = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16 } as const;

/** Scene depths of HUD layers (the HUD scene is drawn above the world scene). */
export const DEPTH = { hud: 1000, contextual: 1100, panel: 1300, modal: 1500, toast: 1700, debug: 2000 } as const;

export const MOTION = { fast: 110, base: 190, slow: 320 } as const;

/** Honours the OS "reduce motion" setting plus the player's own switch (stored locally). */
let reducedOverride: boolean | null = null;
export function prefersReducedMotion(): boolean {
  if (reducedOverride !== null) return reducedOverride;
  try {
    const stored = window.localStorage.getItem('tcss.ui.reducedMotion');
    if (stored !== null) return stored === '1';
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function setReducedMotion(on: boolean): void {
  reducedOverride = on;
  try {
    window.localStorage.setItem('tcss.ui.reducedMotion', on ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts for this session only */
  }
}

/** Duration helper: 0 when motion is reduced so tweens snap. */
export const dur = (ms: number): number => (prefersReducedMotion() ? 0 : ms);
