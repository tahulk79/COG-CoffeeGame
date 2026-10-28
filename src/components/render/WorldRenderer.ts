import type { Facing } from '../../entities/Actor';
import type { Footprint, TilePos, WorldPos } from '../../utils/tile';

/**
 * Contract between the gameplay simulation and whatever draws it.
 * Placeholder shapes implement it today; production atlases will implement
 * it later. Gameplay code never imports an implementation, only this file.
 * All positions are in WORLD units (tiles); projection is the renderer's job.
 */
export interface FloorTileView {
  tile: TilePos;
  kind: string;
  walkable: boolean;
}

export interface ObjectViewData {
  id: string;
  type: string;
  label: string;
  footprint: Footprint;
  rotation: number;
  interactive: boolean;
}

export interface ActorViewState {
  pos: WorldPos;
  /** State label (player or customer FSM state). */
  state: string;
  facing: Facing;
  heldItem: string | null;
  /** 0–1 while WORKING (player) or remaining patience (customer); null hides the bar. */
  progress: number | null;
  /** Speech bubble text (e.g. a customer's order); null hides it. */
  bubble?: string | null;
  /** Pulsing ring at the feet: this character can be acted on right now. */
  highlight?: boolean;
  /** Bubble accent: a short status colour (patience / urgency). */
  bubbleTone?: 'neutral' | 'ready' | 'urgent';
}

/**
 * Visual state of an object (e.g. a plot: "thirsty", "ready"). `variant` is
 * a semantic key; each renderer decides how it looks (colour now, sprite later).
 */
export interface ObjectVisual {
  variant: string;
  /** Short status text under/over the object (placeholder UI). */
  caption?: string;
  /** 0–1 progress indicator, or null to hide. */
  progress?: number | null;
}

export interface ActorView {
  update(s: ActorViewState): void;
  /** True when a render-space point lies on the drawn character. */
  hitTest(px: number, py: number): boolean;
  /** Painter depth, so the front-most character wins a click. */
  readonly depth: number;
  /** Optional: fade the character. */
  setAlpha?(a: number): void;
  /** Optional: scale, lift (screen px) and spin the figure (death animations). */
  setPose?(sx: number, sy: number, dy: number, angle: number): void;
  destroy(): void;
}

export type FeedbackKind = 'ok' | 'info' | 'error' | 'coin' | 'exp' | 'unlock';

/** Decorate mode: the piece being placed, drawn where it would go. */
export interface PlacementPreview {
  footprint: Footprint;
  valid: boolean;
  label: string;
}

export interface WorldRenderer {
  buildWorld(floor: FloorTileView[], objects: ObjectViewData[]): void;
  addObject(o: ObjectViewData): void;
  removeObject(id: string): void;
  setObjectHighlight(id: string, highlighted: boolean): void;
  setObjectVisual(id: string, visual: ObjectVisual): void;
  /** Small icons floating above world objects (coins to collect, dirty seats…). Keyed by `id`; pooled; redrawn only when the set changes. */
  setIndicators(items: Array<{ id: string; objectId: string; icon: string }>): void;
  /** Persistent pulsing outlines (next station, plot ready…): id → colour. Cheap to call every frame; redraws only on change. */
  setGlows(glows: Record<string, number>): void;
  /**
   * Front-most object (interactive or not) whose *drawn* shape covers this
   * point (render-space pixels, i.e. camera world point). Players click what
   * they see — a tall object's top face lies over the tiles behind it.
   */
  objectAtPoint(px: number, py: number): string | null;
  /** Render-space point a player would naturally click on an object (its top/label). */
  objectClickPoint(id: string): { x: number; y: number } | null;
  createActor(id: string, kind: 'player' | 'customer' | 'employee', archetype?: string): ActorView;
  /** Debug/feedback: remaining path of the selected actor. */
  /** A customer's reaction above their head: short words and 1–5 stars (from the real rating). */
  showRatingBubble(at: WorldPos, text: string, stars: number): void;
  setPathPreview(points: WorldPos[] | null): void;
  setHoverTile(tile: TilePos | null): void;
  /** Short-lived world-space feedback (e.g. "Unreachable" over a tile). */
  showFeedback(at: WorldPos, text: string, kind: FeedbackKind): void;
  /** Decorate mode: highlight where furniture may go (null hides it). */
  setDecorArea(area: Footprint[] | null): void;
  /** Decorate mode: ghost of the selected piece, green when valid, red when not (null hides it). */
  setPlacementPreview(preview: PlacementPreview | null): void;
  /** World point at the centre of the map, for camera framing. */
  /** `insetRight`: screen px covered by a UI panel on the right, kept clear of the map. */
  frame(widthTiles: number, heightTiles: number, insets: { top: number; right: number; bottom: number; left: number }, zoom: number): void;
  /** Object name labels are drawn only near the player, under the pointer, or on glowing objects (each label is a separate texture; drawing all of them cost ~40% of a frame). */
  focusLabels(playerPos: WorldPos, hoveredId: string | null): void;
  /** Free camera: shift the view by screen pixels (middle-mouse drag, arrow keys, two-finger drag). `resetPan` recentres on the player. */
  panBy(dxPx: number, dyPx: number): void;
  resetPan(): void;
  /** Ease the camera towards a world position (the player), kept inside the map. */
  follow(pos: WorldPos, dtMs: number): void;
}
