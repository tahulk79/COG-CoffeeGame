import type { WorldPos } from '../../utils/tile';

/**
 * Chapter-1 pedestrians: the Social Force Model (Helbing & Molnár 1995).
 *   dv/dt = (v0·e − v)/τ + Σ_people A·exp((2r − d)/B)·n·w(φ) + Σ_obstacles Aw·exp((r − d)/Bw)·n
 *   w(φ) = λ + (1 − λ)·(1 + cos φ)/2    (whoever is ahead matters more than whoever is behind)
 * After each step nobody overlaps anybody and nobody stands in a wall: positions are corrected, not just pushed.
 * Also: where onlookers stand round an accident (rings, line of sight, room from walls) and the medics'
 * carrying formation. Units: tiles and seconds.
 */
export const SOCIAL = { tau: 0.5, A: 2.0, B: 0.3, lambda: 0.35, r: 0.25, Aw: 5, Bw: 0.2, contact: 8, maxScale: 1.3 } as const;

/** `r`: body radius (default SOCIAL.r; wider for someone carrying a shoulder pole). */
export interface Pedestrian extends WorldPos { vx?: number; vy?: number; heading?: number; r?: number }
export interface Circle extends WorldPos { r: number }

export interface SocialEnv {
  /** Free ground at a point (for a body of radius SOCIAL.r). */
  walkable(x: number, y: number): boolean;
  /** Everybody on foot (the walker itself is skipped). */
  people: Pedestrian[];
  /** Round things to keep clear of: tree trunks, parked bikes, vehicles, the hero. */
  circles: Circle[];
  /** The road's kerbs (tile y): a pedestrian keeps to its own sidewalk. */
  kerb?: { top: number; bottom: number };
}

const WALL_DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const);

/** One step of the social force model for `p` wanting to go along unit `e` at `v0` (0: stand where you are). */
export function socialStep(p: Pedestrian, e: WorldPos, v0: number, env: SocialEnv, dt: number): void {
  const s = Math.min(dt, 100) / 1000, S = SOCIAL, rp = p.r ?? S.r;
  let vx = p.vx ?? 0, vy = p.vy ?? 0;
  let fx = (v0 * e.x - vx) / S.tau, fy = (v0 * e.y - vy) / S.tau;
  const speed = Math.hypot(vx, vy), hx = speed > 0.05 ? vx / speed : e.x, hy = speed > 0.05 ? vy / speed : e.y;
  for (const o of env.people) {
    if (o === p) continue;
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d > 2.5 || d < 1e-6) continue;
    const nx = dx / d, ny = dy / d;
    // cos φ: 1 when the other is straight ahead.
    const cos = -(nx * hx + ny * hy), w = S.lambda + (1 - S.lambda) * (1 + cos) / 2;
    const reach = rp + (o.r ?? S.r);
    let f = S.A * Math.exp((reach - d) / S.B) * w;
    if (d < reach) f += S.contact * (reach - d);
    fx += f * nx; fy += f * ny;
  }
  for (const c of env.circles) {
    const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) - c.r;
    if (d > 1.5) continue;
    const len = Math.hypot(dx, dy) || 1, f = S.Aw * Math.exp((rp - d) / S.Bw);
    fx += f * dx / len; fy += f * dy / len;
  }
  // Walls and buildings: probe round the body, pushed away from the nearest blocked point each way.
  for (const [cx, cy] of WALL_DIRS) for (const dist of [0.35, 0.7]) {
    if (env.walkable(p.x + cx * dist, p.y + cy * dist)) continue;
    const f = S.Aw * Math.exp((rp - (dist - 0.25)) / S.Bw);
    fx -= f * cx; fy -= f * cy;
    break;
  }
  if (env.kerb) {
    const { top, bottom } = env.kerb;
    if (p.y < top) fy -= S.Aw * Math.exp((rp - (top - p.y)) / S.Bw);
    else if (p.y > bottom) fy += S.Aw * Math.exp((rp - (p.y - bottom)) / S.Bw);
  }
  vx += fx * s; vy += fy * s;
  const cap = Math.max(v0, 0.6) * S.maxScale, v = Math.hypot(vx, vy);
  if (v > cap) { vx *= cap / v; vy *= cap / v; }
  let x = p.x + vx * s, y = p.y + vy * s;
  // Hard guarantees: never into a wall, never off one's own sidewalk.
  if (!env.walkable(x, y)) {
    if (env.walkable(x, p.y)) { y = p.y; vy = 0; }
    else if (env.walkable(p.x, y)) { x = p.x; vx = 0; }
    else { x = p.x; y = p.y; vx = 0; vy = 0; }
  }
  if (env.kerb) {
    if (p.y < env.kerb.top && y > env.kerb.top - 0.3) { y = env.kerb.top - 0.3; vy = Math.min(0, vy); }
    if (p.y > env.kerb.bottom && y < env.kerb.bottom + 0.3) { y = env.kerb.bottom + 0.3; vy = Math.max(0, vy); }
  }
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
}

/** Bodies still overlapping after the step are moved apart (each half the way), never into a wall. */
export function separate(people: Pedestrian[], walkable: (x: number, y: number) => boolean, fixed: (p: Pedestrian) => boolean = () => false): void {
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    const a = people[i]!, b = people[j]!, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.r ?? SOCIAL.r) + (b.r ?? SOCIAL.r);
    if (d >= min) continue;
    const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0, push = min - d;
    const fa = fixed(a), fb = fixed(b);
    if (fa && fb) continue;
    const ka = fa ? 0 : fb ? 1 : 0.5, kb = fb ? 0 : fa ? 1 : 0.5;
    if (ka && walkable(a.x - nx * push * ka, a.y - ny * push * ka)) { a.x -= nx * push * ka; a.y -= ny * push * ka; }
    if (kb && walkable(b.x + nx * push * kb, b.y + ny * push * kb)) { b.x += nx * push * kb; b.y += ny * push * kb; }
  }
}

/** Heading changes only past this (radians): no flicking between poses on small wobbles. */
export const TURN_HYSTERESIS = Math.PI / 6;

/** The direction a pedestrian faces, kept steady: follows the velocity, ignores small wobbles. */
export function steadyHeading(p: Pedestrian): number | null {
  const v = Math.hypot(p.vx ?? 0, p.vy ?? 0);
  if (v < 0.15) return null;
  const a = Math.atan2(p.vy!, p.vx!);
  if (p.heading === undefined) return (p.heading = a);
  let diff = a - p.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > TURN_HYSTERESIS) p.heading = a;
  return p.heading;
}

/** A place to watch from: ring `row`, a cost (lower is better). */
export interface Slot extends WorldPos { row: number; cost: number }

/**
 * Where onlookers stand round `centre`: concentric rings (`rows` radii), neighbours at least `spacing` apart along
 * the ring, each further ring set in the gaps of the one inside (peeking between shoulders). `valid` rejects what
 * is not a good place (no view, a wall at one's nose, the ambulance's way); `cost` ranks the rest.
 */
export function viewingSlots(centre: WorldPos, rows: number[], spacing: number, valid: (q: WorldPos) => boolean, cost: (q: WorldPos, angle: number) => number): Slot[] {
  const slots: Slot[] = [];
  rows.forEach((radius, row) => {
    const n = Math.max(6, Math.floor((2 * Math.PI * radius) / spacing)), step = (2 * Math.PI) / n;
    for (let k = 0; k < n; k++) {
      const a = k * step + (row % 2 ? step / 2 : 0), q = { x: centre.x + Math.cos(a) * radius, y: centre.y + Math.sin(a) * radius };
      if (valid(q)) slots.push({ ...q, row, cost: row * 1.2 + cost(q, a) });
    }
  });
  return slots;
}

/** Greedy assignment: the cheapest (slot cost + walk) pair first; returns each person's slot (or none). */
export function assignSlots<T extends WorldPos>(people: T[], slots: Slot[], walkWeight = 0.35): Map<T, Slot> {
  const pairs: Array<{ p: T; s: Slot; c: number }> = [];
  for (const p of people) for (const s of slots) pairs.push({ p, s, c: s.cost + walkWeight * Math.hypot(p.x - s.x, p.y - s.y) });
  pairs.sort((a, b) => a.c - b.c);
  const out = new Map<T, Slot>(), used = new Set<Slot>();
  for (const { p, s } of pairs) {
    if (out.has(p) || used.has(s)) continue;
    // Two people never share a spot: slots too close to a taken one are skipped.
    if ([...used].some(u => Math.hypot(u.x - s.x, u.y - s.y) < 2 * SOCIAL.r + 0.2)) continue;
    out.set(p, s); used.add(s);
  }
  return out;
}

/** Nothing solid between two points (sampled every 0.2 tiles): an onlooker must actually see the hero. */
export function lineOfSight(a: WorldPos, b: WorldPos, walkable: (x: number, y: number) => boolean, circles: Circle[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.2));
  for (let i = 1; i < steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    if (!walkable(x, y) || circles.some(c => Math.hypot(x - c.x, y - c.y) < c.r)) return false;
  }
  return true;
}

/** Distance from a point to the segment a–b. */
export function toSegment(q: WorldPos, a: WorldPos, b: WorldPos): number {
  const sx = b.x - a.x, sy = b.y - a.y, len2 = sx * sx + sy * sy || 1;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * sx + (q.y - a.y) * sy) / len2));
  return Math.hypot(q.x - (a.x + sx * t), q.y - (a.y + sy * t));
}

/**
 * The carrying formation: one medic at each end of the lying body, along the way it is being carried (narrow, so the
 * group fits through a gate or an alley). Where there is no room the pair closes up.
 */
export function carrySlots(p: WorldPos, heading: WorldPos, fits: (q: WorldPos) => boolean): [WorldPos, WorldPos] {
  const h = Math.hypot(heading.x, heading.y), hx = h > 1e-3 ? heading.x / h : 1, hy = h > 1e-3 ? heading.y / h : 0;
  for (const reach of [0.55, 0.45, 0.35]) {
    const front = { x: p.x + hx * reach, y: p.y + hy * reach }, back = { x: p.x - hx * reach, y: p.y - hy * reach };
    if (fits(front) && fits(back)) return [front, back];
  }
  return [{ x: p.x + hx * 0.35, y: p.y + hy * 0.35 }, { x: p.x - hx * 0.35, y: p.y - hy * 0.35 }];
}

/**
 * Looking ahead along the sidewalk: the row to walk in so as to pass everything standing in the way (trunks, people
 * at a post) with room to spare, instead of brushing past it. Picks the side with room, rather the one away from
 * the road; `free(y)` says whether a row is open ground at that point.
 */
export function plannedRow(p: Pedestrian, dir: number, lane: number, standing: Circle[], free: (x: number, y: number) => boolean, awayFromRoad: number): number {
  const rp = p.r ?? SOCIAL.r;
  let best: { ahead: number; y: number } | null = null;
  for (const o of standing) {
    const ahead = (o.x - p.x) * dir, clear = o.r + rp + 0.35;
    if (ahead < -0.2 || ahead > 3 || Math.abs(o.y - lane) >= clear) continue;
    if (best && best.ahead <= ahead) continue;
    const sides = [awayFromRoad, -awayFromRoad].map(k => o.y + k * clear).filter(y => free(o.x, y));
    if (sides.length) best = { ahead, y: sides.sort((a, b) => Math.abs(a - p.y) - Math.abs(b - p.y) + (b === o.y + awayFromRoad * clear ? 0.3 : 0) - (a === o.y + awayFromRoad * clear ? 0.3 : 0))[0]! };
  }
  return best ? best.y : lane;
}
