/**
 * Design tokens: the single source of truth for the HUD's look.
 * Components import from here; no colour, size or duration is hardcoded elsewhere.
 * Bright cozy palette (pastel diorama look): warm chocolate ink and outlines,
 * cream paper cards, sunny / coral / mint accents.
 */
export const COLORS = {
  coffeeBrown: 0x6b4226,
  espresso: 0x4a2e1f,
  caramel: 0xf2a65a,
  cream: 0xfff6e5,
  leaf: 0x7cc47f,
  gold: 0xffc94a,
  error: 0xf26b5b,
  // Derived tones
  espressoSoft: 0x5c3a28,
  woodLight: 0xc08552,
  creamDim: 0xf3dfc1,
  shadow: 0x000000,
  disabled: 0xb8a796,
  white: 0xffffff,
  /** Watering / water-related indicators. */
  water: 0x5ec8f2,
  // Cozy card look (story / redesigned screens)
  /** Outlines and dark text on light cards. */
  ink: 0x5a3825,
  /** Light card background. */
  paper: 0xfffaf0,
  coral: 0xff7f6b,
  mint: 0x6fd3c0,
  sky: 0xbfe6f5,
  sun: 0xffd25e,
} as const;

export type ColorToken = keyof typeof COLORS;

/**
 * The light "cozy paper" look of chapter 1 (cream card, thick chocolate outline, soft shadow,
 * coral labels, sunny highlight, mint switches), for screens that should match it.
 * Re-skinning those screens later (new generated art) means changing this table only.
 */
export const LIGHT = {
  panel: COLORS.paper,
  border: COLORS.ink,
  shadow: COLORS.ink,
  /** Main text and titles. */
  text: COLORS.ink,
  /** Notes and footers. */
  textDim: 0x8a6a55,
  /** Small section labels. */
  label: COLORS.coral,
  /** Plates behind rows, and when hovered. */
  plate: 0xf6e7cf,
  plateHover: 0xffefd2,
  /** Switch: on, off, and the knob. */
  on: COLORS.mint,
  off: 0xd9c8b0,
  knob: COLORS.white,
  /** The dimmed backdrop behind the panel. */
  backdrop: COLORS.ink,
  backdropAlpha: 0.38,
} as const;

/** `0xRRGGBB` → `#rrggbb` for Phaser text styles. */
export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

export const FONT = {
  family: "'Baloo 2', 'Trebuchet MS', 'Segoe UI', Arial, sans-serif",
  size: { xs: 12, sm: 14, md: 16, lg: 19, xl: 24 },
} as const;

export const RADIUS = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16 } as const;

/** Scene depths of HUD layers (the HUD scene is drawn above the world scene). */
/** Modals sit above the story HUD (its cards and dialogue use 1500–1600) and below toasts. */
export const DEPTH = { hud: 1000, contextual: 1100, panel: 1300, modal: 1650, toast: 1700, debug: 2000 } as const;

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
