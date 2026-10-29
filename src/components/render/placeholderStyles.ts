/**
 * Placeholder look per object type. Visual-only: changing these values must
 * never change gameplay. Replaced by atlas frame keys in the art pass.
 */
export interface PlaceholderStyle {
  color: number;
  /** Extrusion height in screen px for the box. */
  height: number;
}

export const PLACEHOLDER_STYLES: Record<string, PlaceholderStyle> = {
  tree: { color: 0x2f6b34, height: 72 },
  barrier: { color: 0xe0762a, height: 40 },
  car: { color: 0x4b6a8a, height: 70 },
  kitten: { color: 0xf0c27a, height: 64 },
  /** Chapter-1 street props: tall enough for the stalls and carts some of them draw. */
  street_prop: { color: 0xf0c27a, height: 110 },
  /** Chapter-1 stalls (2×1, awning on top). */
  stall: { color: 0xf0c27a, height: 110 },
  /** Chapter-1 street furniture that blocks the way. */
  sau_tree: { color: 0x86c86b, height: 120 },
  stools: { color: 0xe2513f, height: 30 },
  parked_bike: { color: 0xff8a73, height: 60 },
  ancient_pillar: { color: 0x899481, height: 92 },
  sense_stone: { color: 0x5a6b7a, height: 100 },
  portal: { color: 0x2b3f55, height: 230 },
  hidden_cherry: { color: 0x9c2f2f, height: 10 },
};

/** Per-variant overrides (ObjectVisual.variant). */
export const PLACEHOLDER_VARIANTS: Record<string, Record<string, PlaceholderStyle>> = {};

PLACEHOLDER_VARIANTS.sense_stone = { idle: { color: 0x5a6b7a, height: 40 }, active: { color: 0x39d0ff, height: 46 } };
PLACEHOLDER_VARIANTS.portal = { closed: { color: 0x2b3f55, height: 60 }, open: { color: 0x7fe6ff, height: 66 } };
PLACEHOLDER_VARIANTS.hidden_cherry = { idle: { color: 0x9c2f2f, height: 10 }, taken: { color: 0x6b5a4a, height: 2 } };

export const DEFAULT_STYLE: PlaceholderStyle = { color: 0xff00ff, height: 24 };

export const TERRAIN_COLORS: Record<string, { top: number; height: number }> = {
  ancient_pillar: { top: 0x879886, height: 0 },
  forest_edge: { top: 0x253e39, height: 0 },
  forest_path: { top: 0x788867, height: 0 },
  stream: { top: 0x285e6a, height: 0 },
  bridge: { top: 0x967448, height: 0 },
  city_edge: { top: 0xb6dc96, height: 0 },
  sidewalk: { top: 0xf3e7d3, height: 0 },
  floor: { top: 0xd9c3a0, height: 0 },
  grass: { top: 0xa9c47f, height: 0 },
  street: { top: 0x9aa7b5, height: 0 },
  wall: { top: 0x8b6a47, height: 110 },
};

export const PLAYER_COLOR = 0x2f7fd8;
export const FEEDBACK_COLORS = { ok: '#6fa86c', info: '#5b3523', error: '#d96b5f', coin: '#f5c451', exp: '#6fa86c', unlock: '#c88d47' } as const;
