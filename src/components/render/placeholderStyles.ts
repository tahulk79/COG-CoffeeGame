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
  wall_post: { color: 0x5b4a3f, height: 40 },
  plant: { color: 0x4f8f45, height: 36 },
  counter: { color: 0x8a5a35, height: 28 },
  espresso_machine: { color: 0xb0b6bd, height: 46 },
  table_2: { color: 0xa8743f, height: 20 },
  crate: { color: 0xc49a55, height: 26 },
  shelf: { color: 0x704a2c, height: 54 },
  statue: { color: 0xd8d2c4, height: 60 },
  sign: { color: 0xe0b84a, height: 30 },
  farm_plot: { color: 0x8b6a45, height: 6 },
  well: { color: 0x7d8fa3, height: 34 },
  seed_stall: { color: 0xc9783a, height: 38 },
  farmhouse: { color: 0xa0522d, height: 70 },
  drying_rack: { color: 0xb59466, height: 14 },
  roaster: { color: 0x4a4a52, height: 44 },
  market_stall: { color: 0x3f7fb5, height: 36 },
  order_counter: { color: 0xd19a55, height: 30 },
  cafe_table: { color: 0x8b5a2b, height: 22 },
  chair: { color: 0xc49a6c, height: 8 },
  travel_sign: { color: 0x2f9e8f, height: 48 },
  grinder: { color: 0x6b6b75, height: 40 },
  grinder_pro: { color: 0x4f6f8a, height: 44 },
  espresso_pro: { color: 0x8fb3cf, height: 50 },
  milk_station_pro: { color: 0xcfe8e0, height: 38 },
  cafe_espresso: { color: 0xb0b6bd, height: 46 },
  milk_station: { color: 0xe8e2d0, height: 34 },
  supply_shelf: { color: 0x7a5c3e, height: 56 },
  standing_spot: { color: 0xd9c3a0, height: 1 },
  pickup_point: { color: 0xe8c48a, height: 3 },
  tree: { color: 0x2f6b34, height: 72 },
  armchair: { color: 0x9e4f5c, height: 14 },
  cafe_table_long: { color: 0x7a4e26, height: 22 },
  floor_lamp: { color: 0xf2d16b, height: 58 },
  bookshelf: { color: 0x5e3b22, height: 60 },
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
  master: { color: 0x7a5a8a, height: 52 },
};

/** Per-variant overrides (ObjectVisual.variant), e.g. plot states. */
export const PLACEHOLDER_VARIANTS: Record<string, Record<string, PlaceholderStyle>> = {
  drying_rack: {
    idle: { color: 0xb59466, height: 14 },
    working: { color: 0xa8483a, height: 16 },
    done: { color: 0x6d8f3a, height: 16 },
  },
  roaster: {
    idle: { color: 0x4a4a52, height: 44 },
    working: { color: 0x8a3b22, height: 44 },
    done: { color: 0x5d7f2f, height: 44 },
  },
  farm_plot: {
    locked: { color: 0x6f6a5f, height: 2 },
    empty: { color: 0x9b7b52, height: 4 },
    prepared: { color: 0x6b4423, height: 6 },
    thirsty: { color: 0xc2a36b, height: 10 },
    growing_0: { color: 0x7fae5a, height: 10 },
    growing_1: { color: 0x5f9e45, height: 18 },
    growing_2: { color: 0x3f8a35, height: 26 },
    growing_3: { color: 0x2e7a2a, height: 32 },
    ready: { color: 0xc8463d, height: 34 },
    harvested: { color: 0x7a6040, height: 8 },
  },
};

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
