import { screenToWorld, worldToScreen } from '../utils/iso';
import type { WorldPos } from '../utils/tile';

export const ISLAND = { x: -1774, y: 320, width: 3548, height: 1774 };
export const islandToWorld = (x: number, y: number): WorldPos => screenToWorld({ x: ISLAND.x + x * 2, y: ISLAND.y + y * 2 });
export const worldToIsland = (p: WorldPos): WorldPos => { const s = worldToScreen(p); return { x: (s.x - ISLAND.x) / 2, y: (s.y - ISLAND.y) / 2 }; };

/** Keep the active island visible on wide screens; portrait views follow the hero. */
export function islandCamera(w: number, h: number): { overview: boolean; zoom: number } {
  const overview = w >= 900 && w / h >= 1.4;
  const fit = Math.min(w / ISLAND.width, h / ISLAND.height);
  return { overview, zoom: overview ? Math.min(Math.max(w / ISLAND.width, h / ISLAND.height), fit * 1.15) : Math.max(.42, Math.min(.65, h / 1500)) };
}
