/**
 * Chapter-1 road traffic: motorbikes and cars on two lanes each way (keep to the right).
 *
 * Car following is the Intelligent Driver Model (Treiber, Hennecke & Helbing 2000):
 *   a = aMax · [1 − (v / v0)⁴ − (s* / s)²],   s* = s0 + v·T + v·Δv / (2·√(aMax·b))
 * Lane changes follow MOBIL (Kesting, Treiber & Helbing 2007):
 *   a'(me) − a(me) + p · [a'(new follower) − a(new follower) + a'(old follower) − a(old follower)] > Δa
 *   and the new follower never has to brake harder than B_SAFE.
 * Arrivals at each end are a Poisson stream: the next one comes after Δt = −ln(U) / λ, λ = flow / 3600.
 * Units: tiles and seconds.
 */
export type VehicleKind = 'bike' | 'car';

export interface VehicleSpec {
  /** Desired speed, drawn per driver from this range. */
  v0: [number, number];
  /** Time headway, standstill gap, max acceleration, comfortable braking, body length. */
  T: number; s0: number; a: number; b: number; len: number;
  /** MOBIL politeness and switching threshold. */
  politeness: number; threshold: number;
  /** The lane this kind keeps to when nothing else matters. */
  prefer: 'outer' | 'inner';
}

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  // Hanoi motorbikes: quick off the mark, short headway, slip from lane to lane.
  bike: { v0: [4.2, 5.6], T: 0.9, s0: 0.6, a: 3.0, b: 4.0, len: 0.9, politeness: 0.1, threshold: 0.2, prefer: 'outer' },
  car: { v0: [3.0, 3.8], T: 1.4, s0: 1.0, a: 1.8, b: 3.0, len: 1.9, politeness: 0.4, threshold: 0.3, prefer: 'inner' },
};

/** The ambulance drives by the same model (on its own scripted route): faster, with a siren, longer. */
export const AMBULANCE_SPEC: VehicleSpec = { v0: [11, 11], T: 1.0, s0: 1.0, a: 3.5, b: 4.0, len: 2.2, politeness: 0, threshold: 0, prefer: 'outer' };

export interface TrafficConfig {
  /** Share of each kind among arrivals (normalised). */
  mix: Record<VehicleKind, number>;
  /** Arrivals per hour, per direction. */
  flow: number;
  /** Rush hour multiplies the flow by this. */
  rushFlow?: number;
  /** Vehicles per tile per lane on the road when the street opens. */
  density?: number;
}

/** What a vehicle on the road carries (the street's Npc has these fields). */
export interface Driving { kind: VehicleKind; v0: number; lane: number; checkMs: number; stoppedFor?: string;
  /** A ceiling on the desired speed for now (a rush-hour rider easing off near the hero). */
  cap?: number;
  /** Blocked by something standing in its lane and waiting to slot into this lane: the cars there let it in. */
  wants?: number }
export interface Car { x: number; y: number; dir: number; speed: number; waitMs: number; moving?: boolean; traffic?: Driving }

/** Something on the road that is not a traffic vehicle: the hero, a person, the ambulance, a closed boom. */
export interface Obstacle {
  x: number; y: number;
  /** Half its length along the road, and how far across it blocks (from its centre). */
  half: number; reach: number;
  /** Moving along the road (the ambulance): its speed and direction; otherwise standing. */
  v?: number; dir?: number;
  /** This kind drives on as if it were not there (rush-hour bikes and the hero). */
  ignoredBy?: VehicleKind;
  tag?: string;
}

const B_SAFE = 4;
/** Lateral speed when changing lane (tiles/s): about 1.2 s across a lane. */
const LANE_SPEED = 1.1;
/** A vehicle counts as in a lane while within this of its centre (lane changers count in both). */
const IN_LANE = 0.7;
const MIN_GAP = 0.05;

export class Traffic {
  private ms = 0;
  private readonly nextIn = new Map<number, number>();

  constructor(private readonly lanes: number[], private readonly config: TrafficConfig, private readonly random: () => number,
    /** Where vehicles enter and leave the land (out of sight at both ends). */
    private readonly ends: { from: number; to: number }) {
    for (const dir of [-1, 1]) this.nextIn.set(dir, this.arrival(1));
  }

  /** The two lanes of a direction, kerb side first (traffic keeps right: westbound in the north lanes). */
  lanesOf(dir: number): [number, number] {
    const n = this.lanes.length;
    return dir < 0 ? [0, 1] : [n - 1, n - 2];
  }

  spec(c: Car): VehicleSpec {
    return VEHICLE_SPECS[c.traffic!.kind];
  }

  /** A new driver: kind by the mix, desired speed by the kind. */
  driver(kind?: VehicleKind): { kind: VehicleKind; v0: number } {
    const mix = this.config.mix, total = mix.bike + mix.car;
    const k = kind ?? (this.random() * total < mix.bike ? 'bike' : 'car');
    const [lo, hi] = VEHICLE_SPECS[k].v0;
    return { kind: k, v0: lo + this.random() * (hi - lo) };
  }

  /** The lane a new vehicle takes: its kind's favourite most of the time. */
  laneFor(kind: VehicleKind, dir: number): number {
    const [outer, inner] = this.lanesOf(dir);
    const fav = VEHICLE_SPECS[kind].prefer === 'outer' ? outer : inner;
    return this.random() < 0.7 ? fav : fav === outer ? inner : outer;
  }

  /** The road at opening time: vehicles spread along every lane at the configured density. */
  fill(add: (kind: VehicleKind, v0: number, dir: number, lane: number, x: number) => void): void {
    const length = this.ends.to - this.ends.from, k = this.config.density ?? 0.06;
    for (const dir of [-1, 1]) for (const lane of this.lanesOf(dir)) {
      const count = Math.round(k * length);
      for (let i = 0; i < count; i++) {
        const d = this.driver();
        add(d.kind, d.v0, dir, lane, this.ends.from + (i + 0.2 + this.random() * 0.6) * length / count);
      }
    }
  }

  private arrival(scale: number): number {
    const lambda = (this.config.flow * scale) / 3600;
    return (-Math.log(1 - this.random()) / Math.max(lambda, 1e-6)) * 1000;
  }

  private half(c: Car): number {
    return this.spec(c).len / 2;
  }

  private inLane(c: Car, lane: number): boolean {
    return Math.abs(c.y - this.lanes[lane]!) < IN_LANE || c.traffic!.lane === lane || c.traffic!.wants === lane;
  }

  /** The nearest thing ahead of `c` in `lane`: the free gap to it and its speed along the road. */
  private leader(c: Car, lane: number, cars: Car[], obstacles: Obstacle[]): { gap: number; v: number; tag?: string } {
    let best: { gap: number; v: number; tag?: string } = { gap: Infinity, v: 0 };
    const kind = c.traffic!.kind, y = this.lanes[lane]!;
    for (const m of cars) {
      if (m === c || m.dir !== c.dir || !this.inLane(m, lane)) continue;
      const d = (m.x - c.x) * c.dir;
      if (d <= 0) continue;
      const gap = d - this.half(c) - this.half(m);
      if (gap < best.gap) best = { gap, v: m.speed };
    }
    for (const o of obstacles) {
      if (o.ignoredBy === kind || Math.abs(o.y - y) > o.reach) continue;
      const d = (o.x - c.x) * c.dir;
      if (d <= -0.2) continue;
      const gap = d - this.half(c) - o.half;
      if (gap < best.gap) best = { gap, v: o.dir === c.dir ? o.v ?? 0 : 0, tag: o.tag };
    }
    return best;
  }

  /** The nearest vehicle behind `c` in `lane`, and the free gap between them. */
  private follower(c: Car, lane: number, cars: Car[]): { car: Car; gap: number } | null {
    let best: { car: Car; gap: number } | null = null;
    for (const m of cars) {
      if (m === c || m.dir !== c.dir || !this.inLane(m, lane)) continue;
      const d = (c.x - m.x) * c.dir;
      if (d <= 0) continue;
      const gap = d - this.half(c) - this.half(m);
      if (!best || gap < best.gap) best = { car: m, gap };
    }
    return best;
  }

  /** IDM acceleration for a driver of `spec` going `v` (wanting `v0`), `gap` behind something going `lead`. */
  static idm(spec: VehicleSpec, v: number, v0: number, gap: number, lead: number): number {
    const free = 1 - (v / v0) ** 4;
    if (gap === Infinity) return spec.a * free;
    const sStar = spec.s0 + Math.max(0, v * spec.T + (v * (v - lead)) / (2 * Math.sqrt(spec.a * spec.b)));
    return spec.a * (free - (sStar / Math.max(gap, MIN_GAP)) ** 2);
  }

  private accel(c: Car, lead: { gap: number; v: number }): number {
    return Traffic.idm(this.spec(c), c.speed, Math.min(c.traffic!.v0, c.traffic!.cap ?? Infinity), lead.gap, lead.v);
  }

  /** MOBIL: whether `c` should move to its direction's other lane now. */
  private wantsChange(c: Car, cars: Car[], obstacles: Obstacle[], siren: Obstacle | null): number | null {
    const t = c.traffic!, spec = this.spec(c), [outer, inner] = this.lanesOf(c.dir);
    const target = t.lane === outer ? inner : outer;
    const lead = this.leader(c, t.lane, cars, obstacles), leadT = this.leader(c, target, cars, obstacles);
    // Something standing in the lane ahead (the parked ambulance, someone in the road): get out of its way early,
    // and accept a tighter gap to do it (traffic in the other lane lets the vehicle in, see `wants`).
    const stuck = !!lead.tag && lead.v === 0 && lead.gap < 15 && leadT.gap > lead.gap + 1;
    const back = this.follower(c, target, cars);
    const room = stuck ? 0.35 : 0.6, safe = stuck ? B_SAFE * 1.5 : B_SAFE;
    // Room to slot in, in front and behind.
    if (leadT.gap < spec.s0 * room || (back && back.gap < this.spec(back.car).s0 * room)) { t.wants = stuck ? target : undefined; return null; }
    const gain = this.accel(c, leadT) - this.accel(c, lead);
    let others = 0;
    if (back) {
      const fs = this.spec(back.car), fv0 = back.car.traffic!.v0;
      const before = Traffic.idm(fs, back.car.speed, fv0, leadT.gap === Infinity ? Infinity : back.gap + spec.len + leadT.gap, leadT.v);
      const after = Traffic.idm(fs, back.car.speed, fv0, back.gap, c.speed);
      if (after < -safe) { t.wants = stuck ? target : undefined; return null; }
      others += after - before;
    }
    const behind = this.follower(c, t.lane, cars);
    if (behind) {
      const fs = this.spec(behind.car), fv0 = behind.car.traffic!.v0;
      const before = Traffic.idm(fs, behind.car.speed, fv0, behind.gap, c.speed);
      const after = Traffic.idm(fs, behind.car.speed, fv0, lead.gap === Infinity ? Infinity : behind.gap + spec.len + lead.gap, lead.v);
      others += after - before;
    }
    // Keep to your own lane unless it pays (bikes to the kerb, cars to the middle); a siren behind clears the lane.
    const fav = spec.prefer === 'outer' ? outer : inner;
    let bias = (target === fav ? 0.25 : -0.25) + (stuck ? 2.5 : 0);
    if (siren && siren.dir === c.dir) {
      const behindBy = (c.x - siren.x) * c.dir;
      if (behindBy > 0 && behindBy < 15) bias += Math.abs(siren.y - this.lanes[t.lane]!) < IN_LANE ? 3 : Math.abs(siren.y - this.lanes[target]!) < IN_LANE ? -3 : 0;
    }
    const go = gain + spec.politeness * others + bias > spec.threshold;
    t.wants = !go && stuck ? target : undefined;
    return go ? target : null;
  }

  /**
   * One step: lane decisions, IDM acceleration, movement (never into the vehicle ahead), sideways glide into the lane,
   * arrivals at both ends and departures past them. `flowScale` is 1, or the rush-hour multiplier.
   */
  step(cars: Car[], obstacles: Obstacle[], dt: number, flowScale: number, siren: Obstacle | null,
    add: (kind: VehicleKind, v0: number, dir: number, lane: number, x: number, v: number) => void, remove: (c: Car) => void): void {
    this.ms += dt;
    const s = dt / 1000;
    for (const c of cars) {
      const t = c.traffic!;
      if (this.ms >= t.checkMs && Math.abs(c.y - this.lanes[t.lane]!) < 0.05 && c.waitMs <= 0) {
        // Stopped in a queue: look for a way round every 150 ms; rolling along, every half second or so.
        t.checkMs = this.ms + (c.speed < 0.5 ? 150 : 400 + this.random() * 400);
        const to = this.wantsChange(c, cars, obstacles, siren);
        if (to !== null) { t.lane = to; t.wants = undefined; }
      }
    }
    for (const c of cars) {
      const t = c.traffic!, before = { x: c.x, y: c.y };
      // Mid-change a vehicle answers to whatever is ahead in either lane.
      let lead = this.leader(c, t.lane, cars, obstacles);
      const from = this.lanes.findIndex(y => Math.abs(y - c.y) < IN_LANE);
      if (from >= 0 && from !== t.lane) { const other = this.leader(c, from, cars, obstacles); if (other.gap < lead.gap) lead = other; }
      t.stoppedFor = lead.gap < 2 && c.speed < 0.3 ? lead.tag : undefined;
      if (c.waitMs > 0) { c.waitMs -= dt; c.speed = 0; c.moving = false; continue; }
      const spec = this.spec(c);
      const a = Math.max(-3 * spec.b, Math.min(spec.a, this.accel(c, lead)));
      c.speed = Math.max(0, Math.min(t.v0 * 1.05, c.speed + a * s));
      // Ballistic step, capped so the gap never closes below MIN_GAP (no vehicle ever rides into another).
      let dx = c.speed * s;
      const room = Math.max(0, lead.gap - MIN_GAP + lead.v * s);
      if (dx > room) { dx = room; c.speed = dx / Math.max(s, 1e-6); }
      c.x += c.dir * dx;
      const ty = this.lanes[t.lane]!;
      if (Math.abs(c.y - ty) > 1e-3) c.y += Math.sign(ty - c.y) * Math.min(Math.abs(ty - c.y), LANE_SPEED * s);
      c.moving = Math.hypot(c.x - before.x, c.y - before.y) > 1e-4;
    }
    for (const c of [...cars]) if ((c.dir > 0 && c.x > this.ends.to + 1) || (c.dir < 0 && c.x < this.ends.from - 1)) remove(c);
    // Arrivals: Poisson at each end, only when the mouth of the lane has room for one more.
    for (const dir of [-1, 1]) {
      const left = this.nextIn.get(dir)! - dt;
      if (left > 0) { this.nextIn.set(dir, left); continue; }
      const d = this.driver(), spec = VEHICLE_SPECS[d.kind], x = dir > 0 ? this.ends.from : this.ends.to;
      const fav = this.laneFor(d.kind, dir), [outer, inner] = this.lanesOf(dir);
      let placed = false;
      for (const lane of [fav, fav === outer ? inner : outer]) {
        const near = cars.filter(c => c.dir === dir && this.inLane(c, lane)).map(c => ({ c, d: (c.x - x) * dir })).filter(q => q.d > -1).sort((p, q) => p.d - q.d)[0];
        if (near && near.d - spec.len / 2 - this.half(near.c) < spec.s0 + spec.len + 1) continue;
        add(d.kind, d.v0, dir, lane, x, near ? Math.min(d.v0, near.c.speed) : d.v0 * 0.9);
        placed = true;
        break;
      }
      this.nextIn.set(dir, placed ? this.arrival(flowScale) : 300);
    }
  }
}
