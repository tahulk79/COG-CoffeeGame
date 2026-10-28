import Phaser from 'phaser';
import { actorDepth, floorDepth, worldToScreen } from '../../utils/iso';
import type { WorldPos } from '../../utils/tile';
import type { StreetView } from '../../gameplay/story/StreetService';
import { block, dot, face, INK, motorbike, oval, point, rr, shadow, tri } from './incidentArt';

/** Shirt and trousers per look; extras (hats, bags, phones) are drawn in `person`. */
const LOOKS: Record<string, { shirt: number; legs: number; skin?: number; scale?: number }> = {
  walker: { shirt: 0x7cc47f, legs: 0x4f6d8f },
  phone: { shirt: 0x5ec8f2, legs: 0x3a3340 },
  vendor: { shirt: 0xf6c7b4, legs: 0x6b4a3a },
  tourist: { shirt: 0xffd25e, legs: 0xc9b392, skin: 0xffd9c2 },
  shipper: { shirt: 0x2fa84f, legs: 0x3a3340 },
  granny: { shirt: 0xb39ddb, legs: 0x5a3825 },
  kid: { shirt: 0xf6a6d0, legs: 0x5ec8f2, scale: 0.75 },
  seller: { shirt: 0xe2513f, legs: 0x4f6d8f },
  old: { shirt: 0xffffff, legs: 0x6b6b75 },
  cook: { shirt: 0xfff6e5, legs: 0x6b4a3a },
  driver: { shirt: 0x6b8e3a, legs: 0x4f6d8f },
  guard: { shirt: 0x7c8f6a, legs: 0x4a5a3a },
  medic: { shirt: 0xf4f8ff, legs: 0x5ec8f2 },
  /** The hero inside a shop (on the street the hero is drawn by IncidentActorView). */
  hero: { shirt: 0xff8a73, legs: 0x4f6d8f },
};

/** Rows the street-end barriers span: from the houses (north sidewalk), across the road, down to the lake railing (see incident.json). */
const BARRIER_ROWS = { top: 5, roadTop: 8, roadBottom: 11, bottom: 17 };

/** A small outlined person at (0, 0) (feet), facing right; flipped by the caller to face left. `cat`: the shop cat. */
export function person(g: Phaser.GameObjects.Graphics, look: string): void {
  if (look === 'cat') {
    shadow(g, 0, 0, 26, 9);
    oval(g, -2, -10, 26, 16, 0xffa24c);
    dot(g, 10, -18, 8, 0xffa24c);
    tri(g, [6, -24, 8, -32, 12, -25], 0xffa24c);
    tri(g, [12, -25, 17, -31, 16, -22], 0xffa24c);
    g.lineStyle(3, INK).lineBetween(-14, -12, -20, -24);
    g.fillStyle(INK).fillCircle(13, -19, 1.6);
    return;
  }
  const l = LOOKS[look] ?? LOOKS.walker!;
  const skin = l.skin ?? 0xf6d2b0;
  shadow(g, 0, 0, 30, 12);
  g.lineStyle(2.5, INK);
  g.fillStyle(l.legs).fillRoundedRect(-9, -16, 7, 17, 3).strokeRoundedRect(-9, -16, 7, 17, 3).fillRoundedRect(2, -16, 7, 17, 3).strokeRoundedRect(2, -16, 7, 17, 3);
  g.fillStyle(l.shirt).fillRoundedRect(-14, -40, 28, 27, 9).strokeRoundedRect(-14, -40, 28, 27, 9);
  if (look === 'seller' || look === 'cook') g.fillStyle(0xfff6e5).fillRoundedRect(-9, -34, 18, 20, 4).lineStyle(1.5, INK).strokeRoundedRect(-9, -34, 18, 20, 4);
  dot(g, 0, -48, 12, skin);
  g.fillStyle(INK).fillCircle(5, -48, 1.8);
  // Hair or headwear.
  if (look === 'vendor' || look === 'granny') tri(g, [-22, -52, 22, -52, 0, -72], 0xf3e7d3);
  else if (look === 'shipper' || look === 'driver') oval(g, 0, -56, 28, 16, look === 'shipper' ? 0x2fa84f : 0xffd25e);
  else if (look === 'tourist') { oval(g, 0, -57, 36, 8, 0xfff6e5); oval(g, 0, -60, 20, 10, 0xfff6e5); }
  else if (look === 'cook') oval(g, 0, -58, 24, 10, 0xe2513f);
  else if (look === 'old') g.fillStyle(0xd9d9de).fillEllipse(-2, -57, 22, 9);
  else if (look === 'medic') { oval(g, 0, -58, 24, 11, 0xffffff); g.fillStyle(0xe2513f).fillRect(-2, -62, 4, 8).fillRect(-4, -60, 8, 4); }
  else if (look === 'guard') { oval(g, 0, -58, 26, 12, 0x4a5a3a); oval(g, 6, -54, 16, 5, 0x3a3340); }
  else g.fillStyle(INK).fillEllipse(-1, -57, 25, 11);
  // Props that tell who they are.
  if (look === 'phone') rr(g, 10, -56, 7, 12, 2, 0x3a3340);
  if (look === 'tourist') rr(g, -24, -42, 12, 26, 4, 0xe2513f);
  if (look === 'vendor') {
    g.lineStyle(3, INK).lineBetween(-30, -38, 30, -38);
    for (const x of [-28, 28]) { g.lineStyle(1.5, INK).lineBetween(x, -38, x - 6, -14).lineBetween(x, -38, x + 6, -14); oval(g, x, -12, 22, 9, 0xd9a35c); }
  }
  if (look === 'shipper') rr(g, -26, -44, 14, 16, 3, 0x2fa84f);
  // The guard's whistle and armband.
  if (look === 'guard') { dot(g, 10, -44, 3, 0xffd25e); rr(g, -14, -36, 6, 6, 1, 0xe2513f); }
  if (look === 'medic') { g.fillStyle(0xe2513f).fillRect(-3, -34, 6, 14).fillRect(-7, -30, 14, 6); }
}

/** A small white ambulance facing right: red cross, blue light, a big windscreen. */
function ambulance(g: Phaser.GameObjects.Graphics): void {
  shadow(g, 0, 2, 130, 30);
  rr(g, -58, -66, 104, 56, 10, 0xffffff);
  rr(g, 40, -48, 26, 38, 8, 0xffffff);
  rr(g, 44, -44, 18, 16, 4, 0xa8dcf0);
  g.fillStyle(0xe2513f).fillRect(-26, -50, 26, 8).fillRect(-17, -59, 8, 26);
  g.fillStyle(0xe2513f).fillRect(-58, -26, 124, 5);
  rr(g, -10, -76, 20, 10, 4, 0x5ec8f2);
  for (const x of [-36, 40]) { dot(g, x, -8, 11, 0x4a4a55); dot(g, x, -8, 4, 0xe8e8ee); }
}

/** Red-and-white fence across a sidewalk at column `x`, rows y0..y1 (pedestrians never get through). */
function fence(g: Phaser.GameObjects.Graphics, x: number, y0: number, y1: number): void {
  block(g, { x: x - .08, y: y0, w: .16, h: y1 - y0 }, 0, 30, 0xffffff, 2);
  for (let y = y0; y < y1 - .2; y += .5) face(g, [[x + .08, y + .05, 4], [x + .08, y + .25, 4], [x + .08, y + .35, 26], [x + .08, y + .15, 26]], 0xe2513f, 1, 0);
}

/**
 * Chapter-1 street life: passers-by, motorbikes and the people at the stalls,
 * with their speech bubbles (and the hero's). Bodies are drawn once and moved
 * every frame; bubbles change only when their text does.
 */
export class StreetLifeView {
  private readonly bodies = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly bubbles = new Map<string, Phaser.GameObjects.Text>();
  /** Street-end barriers: the fixed fences (drawn once) and each boom (redrawn as it moves). */
  private readonly fences = new Map<string, Phaser.GameObjects.GameObject[]>();
  private readonly booms = new Map<string, { g: Phaser.GameObjects.Graphics; open: number }>();

  constructor(private readonly scene: Phaser.Scene) {}

  private syncGates(gates: StreetView['gates']): void {
    // A barrier taken down (the mid-street checkpoint at rush hour) goes away with its fences and boom.
    for (const id of [...this.fences.keys()]) {
      if (gates.some((g) => g.id === id)) continue;
      for (const o of this.fences.get(id)!) o.destroy();
      this.fences.delete(id);
      this.booms.get(id)?.g.destroy();
      this.booms.delete(id);
    }
    for (const gate of gates) {
      const x = gate.x;
      if (!this.fences.has(gate.id)) {
        // Fences on both sidewalks and a sign: closed to people on foot, always.
        // One segment per row, so people on either side sort in front of or behind it correctly.
        const parts: Phaser.GameObjects.GameObject[] = [];
        for (const [y0, y1] of [[BARRIER_ROWS.top, BARRIER_ROWS.roadTop], [BARRIER_ROWS.roadBottom, BARRIER_ROWS.bottom]] as const) {
          for (let y = y0; y < y1; y++) {
            const g = this.scene.add.graphics().setDepth(actorDepth({ x, y: y + .5 }));
            fence(g, x, y, y + 1);
            parts.push(g);
          }
        }
        const post = this.scene.add.graphics().setDepth(actorDepth({ x, y: BARRIER_ROWS.roadTop }));
        block(post, { x: x - .12, y: BARRIER_ROWS.roadTop - .12, w: .24, h: .24 }, 0, 44, 0x6b6b75, 2);
        const sign = point(x, BARRIER_ROWS.top + 1, 96);
        if (gate.sign) parts.push(this.scene.add.text(sign.x, sign.y, gate.sign, { fontFamily: "'Baloo 2', sans-serif", fontSize: '18px', fontStyle: '800', color: '#ffffff', backgroundColor: '#e2513f', padding: { x: 10, y: 3 }, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 6));
        else {
          rr(post, sign.x - 34, sign.y - 30, 68, 30, 6, 0xe2513f);
          post.fillStyle(0xffffff).fillRect(sign.x - 22, sign.y - 18, 44, 6);
        }
        this.fences.set(gate.id, [...parts, post]);
      }
      let boom = this.booms.get(gate.id);
      if (!boom) {
        boom = { g: this.scene.add.graphics().setDepth(actorDepth({ x, y: BARRIER_ROWS.roadBottom })), open: -1 };
        this.booms.set(gate.id, boom);
      }
      if (boom.open === gate.open) continue;
      boom.open = gate.open;
      // The striped boom across the road swings up about its post on the north kerb.
      const pivot = point(x, BARRIER_ROWS.roadTop, 40), shut = point(x, BARRIER_ROWS.roadBottom, 40);
      const len = Math.hypot(shut.x - pivot.x, shut.y - pivot.y), a0 = Math.atan2(shut.y - pivot.y, shut.x - pivot.x), a = a0 + (Math.PI * 1.5 - a0) * gate.open;
      const g = boom.g.clear();
      for (let i = 0; i < 6; i++) {
        const u0 = i / 6, u1 = (i + 1) / 6;
        g.lineStyle(9, i % 2 ? 0xffffff : 0xe2513f).lineBetween(pivot.x + Math.cos(a) * len * u0, pivot.y + Math.sin(a) * len * u0, pivot.x + Math.cos(a) * len * u1, pivot.y + Math.sin(a) * len * u1);
      }
    }
  }

  /** `heroSay`: what the run has the hero say (near misses, last words), when no stall talk is using the bubble. */
  sync(street: StreetView | null, hero: WorldPos, heroSay: string | null = null): void {
    const seen = new Set<string>(), said = new Set<string>();
    const z = this.scene.cameras.main.zoom, now = this.scene.time.now;
    const skids: StreetView['npcs'] = [];
    for (const n of street?.npcs ?? []) {
      seen.add(n.id);
      let g = this.bodies.get(n.id);
      if (!g) {
        g = this.scene.add.graphics();
        if (n.look === 'ambulance') ambulance(g);
        else if (n.bike) motorbike(g, 0, 0, 1, [0xff8a73, 0x5ec8f2, 0xf6a6d0, 0xffd25e][n.id.length % 4]!, 0xffffff);
        else person(g, n.look);
        this.bodies.set(n.id, g);
      }
      const p = worldToScreen(n);
      const bob = n.moving && !n.bike ? -Math.abs(Math.sin(now / 110 + n.x)) * 3 : 0;
      g.setPosition(p.x, p.y + bob).setScale((n.dir < 0 ? -1 : 1) * n.scale, n.scale).setDepth(actorDepth(n)).setVisible(n.scale > 0.01);
      if (n.say) { said.add(n.id); this.bubble(n.id, n.say, n, n.bike ? 84 : 78, z, false); }
      if (n.skid) skids.push(n);
    }
    this.drawSkids(skids);
    this.syncPortal(street?.portal ?? null);
    this.syncBonk(street?.bonk ?? null, hero, z);
    const say = street?.heroSay ?? heroSay;
    if (say) { said.add('hero'); this.bubble('hero', say, hero, 84, z, true); }
    this.syncGates(street?.gates ?? []);
    this.syncDoors(street?.doors ?? []);
    for (const [id, g] of this.bodies) if (!seen.has(id)) { g.destroy(); this.bodies.delete(id); }
    for (const [id, b] of this.bubbles) if (!said.has(id)) { b.destroy(); this.bubbles.delete(id); }
  }

  /** Shop doors on the house fronts: an open wooden door with a sign, or the shutter down at rush hour. */
  private readonly doors = new Map<string, { open: boolean; parts: Phaser.GameObjects.GameObject[] }>();
  private syncDoors(doors: StreetView['doors']): void {
    for (const d of doors) {
      const had = this.doors.get(d.id);
      if (had && had.open === d.open) continue;
      for (const o of had?.parts ?? []) o.destroy();
      // The house fronts are baked behind everything (depth -2): doors sit just in front of them.
      const g = this.scene.add.graphics().setDepth(-1.5), y = 4.92;
      face(g, [[d.x - .4, y, 0], [d.x + .4, y, 0], [d.x + .4, y, 56], [d.x - .4, y, 56]], 0x6b4a3a, 1, 2.5);
      if (d.open) {
        face(g, [[d.x - .32, y, 0], [d.x + .32, y, 0], [d.x + .32, y, 48], [d.x - .32, y, 48]], 0x2e2219, 1, 2);
        const glow = point(d.x, y, 20);
        g.fillStyle(0xffd25e, .35).fillEllipse(glow.x, glow.y, 40, 30);
        face(g, [[d.x - .55, y + .25, 60], [d.x + .55, y + .25, 60], [d.x + .55, y, 70], [d.x - .55, y, 70]], 0xe2513f, 1, 2);
      } else {
        // Shutter down, stripes of corrugated metal.
        face(g, [[d.x - .32, y, 0], [d.x + .32, y, 0], [d.x + .32, y, 48], [d.x - .32, y, 48]], 0x9aa1ad, 1, 2);
        for (let z = 6; z < 48; z += 8) { const a = point(d.x - .32, y, z), b = point(d.x + .32, y, z); g.lineStyle(1.5, 0x6b6b75).lineBetween(a.x, a.y, b.x, b.y); }
      }
      const sign = point(d.x, y, 92);
      const label = this.scene.add.text(sign.x, sign.y, d.open ? d.name : `${d.name} · Nghỉ giờ tan tầm`, { fontFamily: "'Baloo 2', sans-serif", fontSize: '17px', fontStyle: '800', color: '#ffffff', backgroundColor: d.open ? '#5a3825' : '#6b6b75', padding: { x: 8, y: 2 }, resolution: 2 }).setOrigin(.5, 1).setDepth(-1.4);
      this.doors.set(d.id, { open: d.open, parts: [g, label] });
    }
  }

  /** A bike braking hard: black skid marks behind it and puffs of tyre smoke. */
  private skidG: Phaser.GameObjects.Graphics | null = null;
  private drawSkids(bikes: StreetView['npcs']): void {
    const g = (this.skidG ??= this.scene.add.graphics().setDepth(1e6 - 8)).clear();
    const now = this.scene.time.now;
    for (const n of bikes) {
      const a = worldToScreen({ x: n.x - n.dir * 1.6, y: n.y }), b = worldToScreen(n);
      g.lineStyle(4, 0x3a3340, .5).lineBetween(a.x, a.y + 2, b.x, b.y + 2);
      for (let i = 0; i < 5; i++) {
        const u = ((now / 300 + i / 5) % 1), q = worldToScreen({ x: n.x - n.dir * (0.3 + u * 1.2), y: n.y });
        g.fillStyle(0xe8e8ee, .75 * (1 - u)).fillCircle(q.x, q.y - 10 - u * 26, 8 + u * 14);
      }
    }
  }

  /** The magic circle on the road: rings and runes turning, a column of light; it flares as the ambulance goes in. */
  private portalG: Phaser.GameObjects.Graphics | null = null;
  private syncPortal(portal: StreetView['portal']): void {
    if (!portal) { this.portalG?.clear(); return; }
    const g = (this.portalG ??= this.scene.add.graphics().setDepth(floorDepth + .75)).clear();
    const p = worldToScreen(portal), now = this.scene.time.now, e = 1 - (1 - portal.t) ** 3, R = 120 * e, flare = Math.sin(portal.k * Math.PI);
    g.fillStyle(0x6fe3ff, .25 + flare * .4).fillEllipse(p.x, p.y, R * 2.1, R * 1.05);
    for (const [r, w, c] of [[1, 5, 0xffd25e], [.78, 3, 0x6fe3ff], [.5, 3, 0xffffff]] as const) g.lineStyle(w, c, .95).strokeEllipse(p.x, p.y, R * 2 * r, R * r);
    // Runes running round between the rings, the inner star turning the other way.
    for (let i = 0; i < 12; i++) { const a = now / 900 + (i / 12) * Math.PI * 2; g.fillStyle(0xffd25e).fillRect(p.x + Math.cos(a) * R * .89 - 3, p.y + Math.sin(a) * R * .445 - 3, 6, 6); }
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 6; i++) { const a = -now / 1300 + (i * Math.PI * 2) / 6; pts.push(new Phaser.Math.Vector2(p.x + Math.cos(a) * R * .5, p.y + Math.sin(a) * R * .25)); }
    g.lineStyle(2, 0xffffff, .9).strokePoints(pts, true);
    g.fillStyle(0xbff4ff, .18 + flare * .5).fillRect(p.x - R * .7, p.y - 260 * e, R * 1.4, 260 * e);
  }

  /** The person drawn at a world-space point (the front-most), for tap-to-talk; vehicles are not people. */
  npcAt(x: number, y: number): string | null {
    let best: { id: string; depth: number } | null = null;
    for (const [id, g] of this.bodies) {
      if (!g.visible || id.startsWith('bike') || id.startsWith('gatebike') || id.startsWith('crashbike') || id === 'ambulance') continue;
      const s = Math.abs(g.scaleY);
      if (x < g.x - 22 * s || x > g.x + 22 * s || y < g.y - 74 * s || y > g.y + 6) continue;
      if (!best || g.depth > best.depth) best = { id, depth: g.depth };
    }
    return best?.id ?? null;
  }

  /** "CỐP!" over the hero's head as it meets the ambulance door. */
  private bonkT: Phaser.GameObjects.Text | null = null;
  private syncBonk(text: string | null, hero: WorldPos, zoom: number): void {
    if (!text) { this.bonkT?.setVisible(false); return; }
    const b = (this.bonkT ??= this.scene.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '40px', fontStyle: '800', color: '#e2513f', stroke: '#ffffff', strokeThickness: 8, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 1));
    const p = worldToScreen(hero);
    b.setText(text).setVisible(true).setPosition(p.x, p.y - 110).setScale(Math.max(1, 1 / zoom));
  }

  /** Speech bubble over a head; kept a readable size whatever the zoom. */
  private bubble(id: string, text: string, at: WorldPos, lift: number, zoom: number, hero: boolean): void {
    let b = this.bubbles.get(id);
    if (!b) {
      b = this.scene.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '17px', fontStyle: '700', color: hero ? '#ffffff' : '#5a3825', backgroundColor: hero ? '#ff7f6b' : '#fffaf0', padding: { x: 10, y: 4 }, align: 'center', wordWrap: { width: 240 }, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 2);
      this.bubbles.set(id, b);
    }
    if (b.text !== text) b.setText(text);
    const p = worldToScreen(at);
    b.setScale(Math.max(1, Math.min(2.4, 1 / zoom))).setPosition(p.x, p.y - lift);
  }

  destroy(): void {
    for (const g of this.bodies.values()) g.destroy();
    for (const b of this.bubbles.values()) b.destroy();
    for (const parts of this.fences.values()) for (const g of parts) g.destroy();
    for (const b of this.booms.values()) b.g.destroy();
    this.portalG?.destroy();
    this.skidG?.destroy();
    for (const d of this.doors.values()) for (const o of d.parts) o.destroy();
    this.bonkT?.destroy();
    this.bodies.clear();
    this.bubbles.clear();
  }
}
