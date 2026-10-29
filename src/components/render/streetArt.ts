import Phaser from 'phaser';
import { actorDepth, floorDepth, worldToScreen } from '../../utils/iso';
import type { WorldPos } from '../../utils/tile';
import type { StreetView } from '../../gameplay/story/StreetService';
import { facingFrom } from '../../entities/Actor';
import { SLICE_ASSETS, SLICE_PEOPLE, streetPerson, sliceAmbulanceFrame, sliceMedicCarryFrame, sliceMedicFrame, sliceMotorbikeFrame, slicePersonFrame } from './sliceAssets';
import { SpeechBubble } from './speechBubble';
import { block, dot, face, INK, motorbike, oval, point, rr, shadow, STREET_ENDS, tri } from './incidentArt';

/** Baked sprites are drawn at this multiple of their size so they stay sharp when the camera zooms in. */
export const SPRITE_SS = 2;

/** Box (relative to the feet) every baked person covers. */
const PERSON_BOX = { x: -50, y: -96, w: 100, h: 112 };

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

/**
 * A small white ambulance in the street's own isometric axes: two tiles long
 * along the road (x), 0.8 wide, its cab at the front (`dir` 1: towards +x, -1:
 * towards -x). Drawn relative to its centre on the road, like the map objects.
 */
function ambulance(g: Phaser.GameObjects.Graphics, dir: number): void {
  const d = dir < 0 ? -1 : 1;
  // A run along the road from `a` to `b` (in the van's own forward direction) as a footprint.
  const run = (a: number, b: number, y0: number, y1: number) => ({ x: Math.min(a * d, b * d), y: y0, w: Math.abs(b - a), h: y1 - y0 });
  const X = (v: number) => v * d;
  // Contact shadow on the road.
  face(g, [[-1.15, -0.5], [1.15, -0.5], [1.15, 0.5], [-1.15, 0.5]], 0x3a3340, 0.18, 0);
  // Patient box (rear) and the lower cab (front): the camera sees the south and east faces, so the part further west is drawn first.
  const box = run(-1, 0.3, -0.4, 0.4), cab = run(0.3, 1, -0.4, 0.4);
  const parts: Array<[typeof box, number, number]> = [[box, 40, 0xffffff], [cab, 26, 0xfff6e5]];
  for (const [f, h, col] of parts.sort((p, q) => p[0].x - q[0].x)) block(g, f, 10, h, col, 2.5);
  // Red stripe along the side, and the red cross on the box side (the south face is the one the camera sees).
  face(g, [[X(-1), 0.4, 22], [X(0.3), 0.4, 22], [X(0.3), 0.4, 27], [X(-1), 0.4, 27]], 0xe2513f, 1, 0);
  face(g, [[X(-0.55), 0.4, 33], [X(-0.35), 0.4, 33], [X(-0.35), 0.4, 45], [X(-0.55), 0.4, 45]], 0xe2513f, 1, 0);
  face(g, [[X(-0.7), 0.4, 37], [X(-0.2), 0.4, 37], [X(-0.2), 0.4, 41], [X(-0.7), 0.4, 41]], 0xe2513f, 1, 0);
  // Cab: side window, and the windscreen on the end that faces forward (visible when driving towards +x).
  face(g, [[X(0.42), 0.4, 26], [X(0.9), 0.4, 26], [X(0.9), 0.4, 33], [X(0.42), 0.4, 33]], 0xa8dcf0, 1, 1.5);
  if (d > 0) face(g, [[1, -0.3, 22], [1, 0.3, 22], [1, 0.3, 32], [1, -0.3, 32]], 0xa8dcf0, 1, 1.5);
  // The light bar on the roof: one half red, one half blue.
  block(g, { x: -0.1, y: -0.25, w: 0.2, h: 0.25 }, 50, 7, 0xe2513f, 1.5);
  block(g, { x: -0.1, y: 0, w: 0.2, h: 0.25 }, 50, 7, 0x5ec8f2, 1.5);
  // Heading west we see the back: two doors with a small window each.
  if (d < 0) for (const y0 of [-0.36, 0.02]) face(g, [[1, y0, 20], [1, y0 + .34, 20], [1, y0 + .34, 44], [1, y0, 44]], 0xf3f3f6, 1, 1.5);
  // Wheels on the south side, at both ends.
  for (const x of [X(-0.62), X(0.62)]) {
    const p = point(x, 0.4, 11);
    g.fillStyle(0x4a4a55).fillEllipse(p.x, p.y, 22, 26).lineStyle(2, INK).strokeEllipse(p.x, p.y, 22, 26);
    g.fillStyle(0xe8e8ee).fillCircle(p.x, p.y, 5);
  }
}

/**
 * Chapter-1 street life: passers-by, motorbikes and the people at the stalls,
 * with their speech bubbles (and the hero's). Bodies are drawn once and moved
 * every frame; bubbles change only when their text does.
 */
export class StreetLifeView {
  /** People, bikes and the ambulance are baked into images once per look: a Graphics redraws all its shapes every frame (about 1000 commands a person). */
  private readonly bodies = new Map<string, Phaser.GameObjects.Image>();
  private readonly contactShadows = new Map<string, Phaser.GameObjects.Ellipse>();
  private readonly carryArtReady: boolean;
  private readonly bubbles = new Map<string, SpeechBubble>();
  /** Street-end barriers: the fixed fences (drawn once) and each boom (redrawn as it moves). */
  private readonly fences = new Map<string, Phaser.GameObjects.GameObject[]>();
  private readonly booms = new Map<string, { g: Phaser.GameObjects.Graphics; open: number }>();

  constructor(private readonly scene: Phaser.Scene) {
    this.carryArtReady = this.sliceReady('medicCarry');
    this.prewarm();
  }

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
        // The boom closes the road to vehicles only: the sidewalks stay open, people walk past it.
        const parts: Phaser.GameObjects.GameObject[] = [];
        const post = this.scene.add.graphics().setDepth(actorDepth({ x, y: BARRIER_ROWS.roadTop }));
        block(post, { x: x - .12, y: BARRIER_ROWS.roadTop - .12, w: .24, h: .24 }, 0, 44, 0x717871, 1.5);
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
      g.lineStyle(12, 0x514b40, .2).lineBetween(pivot.x + 1, pivot.y + 2, pivot.x + Math.cos(a) * len + 1, pivot.y + Math.sin(a) * len + 2);
      for (let i = 0; i < 6; i++) {
        const u0 = i / 6, u1 = (i + 1) / 6;
        g.lineStyle(9, i % 2 ? 0xf9f3e5 : 0xc96751).lineBetween(pivot.x + Math.cos(a) * len * u0, pivot.y + Math.sin(a) * len * u0, pivot.x + Math.cos(a) * len * u1, pivot.y + Math.sin(a) * len * u1);
      }
    }
  }

  /** `heroSay`: what the run has the hero say (near misses, last words), when no stall talk is using the bubble. */
  sync(street: StreetView | null, hero: WorldPos, heroSay: string | null = null): void {
    const seen = new Set<string>(), said = new Set<string>();
    const z = this.scene.cameras.main.zoom, now = street?.elapsedMs ?? this.scene.time.now;
    const skids: StreetView['npcs'] = [];
    const view = this.scene.cameras.main.worldView;
    const speakers = (street?.npcs ?? []).filter(n => n.say && view.contains(worldToScreen(n).x, worldToScreen(n).y))
      .sort((a, b) => {
        const priority = (n: StreetView['npcs'][number]) => (n.look === 'medic' || n.look === 'ambulance' || (street?.talking && n.id.startsWith(street.talking + ':')) ? -100 : 0) + (this.bubbles.has(n.id) ? -2 : 0) + Math.hypot(n.x - hero.x, n.y - hero.y);
        return priority(a) - priority(b);
      });
    // Read one speaker at a time; distant chatter must not flood the phone or obscure rescue dialogue.
    const speaking = speakers[0]?.id;
    // The hero lying on the street (about a tile long, head to the left): bubbles keep off it.
    const hp = worldToScreen(hero);
    const lying = street?.heroHidden ? null : street?.heroDown ? { x0: hp.x - 90, x1: hp.x + 28, y0: hp.y - 48, y1: hp.y + 12 } : { x0: hp.x - 30, x1: hp.x + 30, y0: hp.y - 75, y1: hp.y + 10 };
    for (const n of street?.npcs ?? []) {
      seen.add(n.id);
      let g = this.bodies.get(n.id);
      if (!g) {
        g = this.bodyImage(n);
        g.setData('sortBias', (this.bodies.size + 1) * 0.00001);
        this.bodies.set(n.id, g);
      }
      const p = worldToScreen(n);
      const kind = g.getData('sliceKind');
      const carrying = kind === 'medic' && !!street?.carried;
      const carryAtlas = carrying && this.carryArtReady;
      if (kind === 'medic') {
        // Both medics look towards the lying body's centre while supporting opposite ends.
        const facing = carrying ? facingFrom(hero.x - .27 - n.x, hero.y + .27 - n.y) : n.facing;
        const direction = facing ?? (n.dir < 0 ? 'W' : 'E');
        const key = carryAtlas ? SLICE_ASSETS.medicCarry.key : SLICE_ASSETS.medic.key;
        const frame = carryAtlas ? sliceMedicCarryFrame(direction, n.moving, street?.carryLift ?? 1, now) : sliceMedicFrame(direction, n.moving, carrying, now);
        g.setTexture(key, frame).setFlipX(false);
      } else if (kind === 'ambulance') {
        g.setTexture(SLICE_ASSETS.ambulance.key, sliceAmbulanceFrame(n.axis ?? 'x', n.dir, !!n.doorOpen, !!n.damaged)).setFlipX(false);
      } else if (kind === 'person') {
        const person = g.getData('personArt') as NonNullable<ReturnType<typeof streetPerson>>;
        const pose = slicePersonFrame(person.row, n.facing ?? (n.dir < 0 ? 'W' : 'E'), n.moving, now);
        g.setTexture(SLICE_ASSETS[person.asset].key, pose.frame).setFlipX(pose.flipX);
      } else if (kind === 'motorbike') {
        g.setTexture(SLICE_ASSETS.motorbikes.key, sliceMotorbikeFrame(n.facing ?? (n.dir < 0 ? 'W' : 'E'), g.getData('bikeColor'))).setFlipX(false);
      } else if (n.look === 'ambulance') g.setTexture(`npc:ambulance:${n.dir < 0 ? -1 : 1}`).setFlipX(n.axis === 'y');
      const bob = carrying ? carryAtlas ? 0 : (1 - (street?.carryLift ?? 1)) * 4 : n.moving && !n.bike ? -Math.abs(Math.sin(now / 110 + n.x)) * (kind === 'person' ? 1.5 : 3) : 0;
      const scale = n.scale * (kind ? g.getData('nativeScale') : 1 / SPRITE_SS);
      const flip = !kind && n.dir < 0 && n.look !== 'ambulance' ? -1 : 1;
      const visible = n.scale > 0.01 && n.x >= STREET_ENDS.w && n.x <= STREET_ENDS.e;
      g.setPosition(p.x, p.y + bob).setScale(flip * scale, scale).setRotation(n.tilt).setDepth(Math.round(actorDepth(n) * 100) / 100 + g.getData('sortBias')).setVisible(visible).setData('worldScale', n.scale);
      this.contactShadows.get(n.id)?.setPosition(p.x, p.y).setScale(n.scale).setVisible(visible);
      if (n.say && n.id === speaking && !street?.heroSay && !heroSay) {
        said.add(n.id);
        this.bubble(n.id, n.say, n, kind ? g.displayHeight * g.originY + 12 : n.bike ? 84 : 78, z, false, lying);
      }
      if (n.skid) skids.push(n);
    }
    this.drawSkids(skids);
    this.drawFlashes(street?.flashes ?? []);
    this.drawMishap(street?.wheel ?? null, street?.boom ?? null, z);
    this.syncPortal(street?.portal ?? null);
    this.syncBonk(street?.bonk ?? null, hero, z);
    // Once the hero is in the ambulance, nothing of them shows (not even what they were saying).
    const say = street?.heroHidden ? null : street?.heroSay ?? heroSay;
    if (say) { said.add('hero'); this.bubble('hero', say, hero, 84, z, true); }
    this.syncGates(street?.gates ?? []);
    for (const [id, g] of this.bodies) if (!seen.has(id)) {
      g.destroy(); this.bodies.delete(id);
      this.contactShadows.get(id)?.destroy(); this.contactShadows.delete(id);
    }
    for (const [id, b] of this.bubbles) if (!said.has(id)) { b.destroy(); this.bubbles.delete(id); }
  }

  /** The ambulance's runaway wheel, then the explosion: fireball, smoke, flying bits and the bang's word. */
  private mishapG: Phaser.GameObjects.Graphics | null = null;
  private boomT: Phaser.GameObjects.Text | null = null;
  private wheelImage: Phaser.GameObjects.Image | null = null;
  private drawMishap(wheel: StreetView['wheel'], boom: StreetView['boom'], zoom: number): void {
    const g = (this.mishapG ??= this.scene.add.graphics().setDepth(1e6 - 3)).clear();
    this.wheelImage?.setVisible(false);
    if (wheel) {
      const q = worldToScreen(wheel);
      shadow(g, q.x, q.y + 2, 26, 8);
      if (this.sliceReady('wheel')) {
        const image = (this.wheelImage ??= this.scene.add.image(0, 0, SLICE_ASSETS.wheel.key, '0').setDisplaySize(26, 26));
        image.setVisible(true).setPosition(q.x, q.y - 11).setRotation(wheel.spin).setDepth(actorDepth(wheel));
      } else {
        dot(g, q.x, q.y - 11, 11, 0x4a4a55);
        dot(g, q.x, q.y - 11, 4, 0xe8e8ee);
        g.lineStyle(2, 0xe8e8ee).lineBetween(q.x, q.y - 11, q.x + Math.cos(wheel.spin) * 9, q.y - 11 + Math.sin(wheel.spin) * 9);
      }
    }
    if (!boom) return void this.boomT?.setVisible(false);
    const q = worldToScreen(boom), t = boom.t, e = 1 - (1 - Math.min(1, t * 2.5)) ** 2, now = this.scene.time.now;
    // A cartoon scuffle cloud, like the dog's: outlined white puffs whirling round, stars, a few sparks.
    const fade = t > .7 ? (1 - t) / .3 : 1, R = 40 + e * 36, cy = q.y - 46;
    for (let i = 0; i < 11; i++) {
      const a = now / 110 + i * 0.9, r = R * (.55 + (i % 3) * .2);
      const x = q.x + Math.cos(a) * r, y = cy + Math.sin(a * 1.3) * r * .55;
      g.fillStyle(0xffffff, fade).fillCircle(x, y, 18 + (i % 3) * 7).lineStyle(3, INK, fade).strokeCircle(x, y, 18 + (i % 3) * 7);
    }
    for (let i = 0; i < 6; i++) {
      const a = now / 160 + (i * Math.PI) / 3;
      dot(g, q.x + Math.cos(a) * (R + 22), cy - 30 + Math.sin(a) * 14, 6, 0xffd25e);
    }
    if (t < .35) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.lineStyle(4, 0xffa24c, 1 - t / .35).lineBetween(q.x + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6) * .6, q.x + Math.cos(a) * (R + 34), cy + Math.sin(a) * (R + 34) * .6); }
    // Bits of ambulance flying off (a red cross among them).
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * .45, d = e * 120, fall = t * t * 160;
      rr(g, q.x + Math.cos(a) * d - 6, q.y - 40 + Math.sin(a) * d + fall - 4, 12, 8, 2, i === 2 ? 0xe2513f : 0xffffff);
    }
    const b = (this.boomT ??= this.scene.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '52px', fontStyle: '800', color: '#e2513f', stroke: '#ffffff', strokeThickness: 10, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 1));
    b.setText(boom.word).setVisible(t < .8).setPosition(q.x, q.y - 120).setScale((0.6 + e * 0.6) * Math.max(1, 1 / zoom)).setAlpha(t > .6 ? (.8 - t) / .2 : 1);
  }

  /** Onlookers snapping photos: a phone held up and its flash going off. */
  private flashG: Phaser.GameObjects.Graphics | null = null;
  private drawFlashes(at: Array<{ x: number; y: number }>): void {
    const g = (this.flashG ??= this.scene.add.graphics().setDepth(1e6 - 3)).clear();
    const on = Math.floor(this.scene.time.now / 90) % 2 === 0;
    for (const p of at) {
      const q = worldToScreen(p), x = q.x + 14, y = q.y - 60;
      rr(g, x - 5, y - 4, 10, 16, 2, 0x3a3340);
      if (!on) continue;
      g.fillStyle(0xffffff, .95).fillCircle(x, y, 9);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.lineStyle(2.5, 0xfff3b0).lineBetween(x + Math.cos(a) * 11, y + Math.sin(a) * 11, x + Math.cos(a) * 20, y + Math.sin(a) * 20); }
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
    for (let i = 0; i < 12; i++) { const a = now / 900 + (i / 12) * Math.PI * 2; g.fillStyle(0xffd25e).fillCircle(p.x + Math.cos(a) * R * .89, p.y + Math.sin(a) * R * .445, 2.5); }
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 6; i++) { const a = -now / 1300 + (i * Math.PI * 2) / 6; pts.push(new Phaser.Math.Vector2(p.x + Math.cos(a) * R * .5, p.y + Math.sin(a) * R * .25)); }
    g.lineStyle(2, 0xffffff, .9).strokePoints(pts, true);
    g.fillStyle(0xbff4ff, .18 + flare * .5).fillEllipse(p.x, p.y, R * 1.4, R * .7);
  }

  /** The texture key, size and drawing of a body (a person look, a bike colour, or the ambulance going one way). */
  private static bodySpec(look: string, bike: boolean, bikeColor: number, dir: number): { key: string; b: { x: number; y: number; w: number; h: number }; draw: (g: Phaser.GameObjects.Graphics) => void } {
    if (look === 'ambulance') return { key: `npc:ambulance:${dir < 0 ? -1 : 1}`, b: { x: -125, y: -120, w: 250, h: 190 }, draw: (g) => ambulance(g, dir) };
    if (bike) return { key: `npc:bike:${bikeColor}`, b: { x: -60, y: -95, w: 120, h: 110 }, draw: (g) => motorbike(g, 0, 0, 1, bikeColor, 0xffffff) };
    return { key: `npc:${look}`, b: PERSON_BOX, draw: (g) => person(g, look) };
  }

  private static readonly BIKE_COLORS = [0xff8a73, 0x5ec8f2, 0xf6a6d0, 0xffd25e];

  /** Bakes a body's texture if it does not exist yet. */
  private bake(spec: ReturnType<typeof StreetLifeView.bodySpec>): void {
    if (this.scene.textures.exists(spec.key)) return;
    const { b } = spec, g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(SPRITE_SS, SPRITE_SS);
    g.translateCanvas(-b.x, -b.y);
    spec.draw(g);
    g.generateTexture(spec.key, b.w * SPRITE_SS, b.h * SPRITE_SS);
    g.destroy();
  }

  /** Every look the street can show, baked up front so no frame in the middle of play stops to draw one. */
  private prewarm(): void {
    for (const look of [...Object.keys(LOOKS), 'cat']) {
      if (look === 'medic' && this.sliceReady('medic')) continue;
      const person = SLICE_PEOPLE[look];
      if (person && this.sliceReady(person.asset)) continue;
      this.bake(StreetLifeView.bodySpec(look, false, 0, 1));
    }
    if (!this.sliceReady('motorbikes')) for (const c of StreetLifeView.BIKE_COLORS) this.bake(StreetLifeView.bodySpec('bike', true, c, 1));
    if (!this.sliceReady('ambulance')) for (const dir of [-1, 1]) this.bake(StreetLifeView.bodySpec('ambulance', false, 0, dir));
  }

  private sliceReady(kind: keyof typeof SLICE_ASSETS): boolean {
    const asset = SLICE_ASSETS[kind], key = asset.key, count = asset.columns * asset.rows;
    return this.scene.textures.exists(key) && Array.from({ length: count }, (_, i) => String(i)).every(frame => this.scene.textures.get(key).has(frame));
  }

  /** The image for a person, bike or the ambulance: origin at the feet. */
  private bodyImage(n: StreetView['npcs'][number]): Phaser.GameObjects.Image {
    const person = streetPerson(n.look, n.id);
    if (!n.bike && person && this.sliceReady(person.asset)) {
      const texture = this.scene.textures.get(SLICE_ASSETS[person.asset].key);
      const extent = Math.max(...Array.from({ length: 4 }, (_, i) => texture.get(String(person.row * 4 + i)).height));
      this.contactShadows.set(n.id, this.scene.add.ellipse(0, 0, n.look === 'kid' ? 22 : 29, 10, INK, .16).setDepth(floorDepth + .75));
      return this.scene.add.image(0, 0, texture.key, String(person.row * 4)).setOrigin(.5, 1)
        .setData('sliceKind', 'person').setData('personArt', person).setData('nativeScale', person.height / extent);
    }
    if (n.look === 'traffic_car' && this.sliceReady('parkedCars')) {
      const frame = n.id.endsWith('1') ? '1' : '0';
      const image = this.scene.add.image(0, 0, SLICE_ASSETS.parkedCars.key, frame).setOrigin(.5, .84);
      return image.setData('sliceKind', 'traffic_car').setData('nativeScale', 190 / image.width);
    }
    if (n.bike && n.look !== 'ambulance' && this.sliceReady('motorbikes')) {
      const texture = this.scene.textures.get(SLICE_ASSETS.motorbikes.key);
      const extent = Math.max(...Array.from({ length: 16 }, (_, i) => texture.get(String(i)).height));
      const color = [...n.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
      this.contactShadows.set(n.id, this.scene.add.ellipse(0, 0, 62, 20, INK, .16).setDepth(floorDepth + .75));
      return this.scene.add.image(0, 0, texture.key, '0').setOrigin(.5, .88)
        .setData('sliceKind', 'motorbike').setData('nativeScale', 84 / extent).setData('bikeColor', color);
    }
    if ((n.look === 'medic' || n.look === 'ambulance') && this.sliceReady(n.look)) {
      const medic = n.look === 'medic', count = medic ? 16 : 12;
      const texture = this.scene.textures.get(SLICE_ASSETS[n.look].key);
      // A single scale per atlas avoids size changes when the door opens or a foot moves.
      let extent = Math.max(...Array.from({ length: count }, (_, i) => medic ? texture.get(String(i)).height : texture.get(String(i)).width));
      if (medic && this.carryArtReady) extent = Math.max(extent, ...Array.from({ length: 16 }, (_, i) => this.scene.textures.get(SLICE_ASSETS.medicCarry.key).get(String(i)).height));
      this.contactShadows.set(n.id, this.scene.add.ellipse(0, 0, medic ? 30 : 140, medic ? 11 : 46, INK, .16).setDepth(floorDepth + .75));
      return this.scene.add.image(0, 0, texture.key, '0').setOrigin(.5, medic ? 1 : .82)
        .setData('sliceKind', n.look).setData('nativeScale', (medic ? 70 : 205) / extent);
    }
    const spec = StreetLifeView.bodySpec(n.look, n.bike, StreetLifeView.BIKE_COLORS[n.id.length % 4]!, n.dir);
    this.bake(spec);
    return this.scene.add.image(0, 0, spec.key).setOrigin(-spec.b.x / spec.b.w, -spec.b.y / spec.b.h);
  }

  /** The person drawn at a world-space point (the front-most), for tap-to-talk; vehicles are not people. */
  npcAt(x: number, y: number): string | null {
    let best: { id: string; depth: number } | null = null;
    for (const [id, g] of this.bodies) {
      if (!g.visible || id.startsWith('bike') || id.startsWith('gatebike') || id.startsWith('crashbike') || id === 'ambulance') continue;
      const s: number = g.getData('worldScale') ?? Math.abs(g.scaleY) * SPRITE_SS;
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
  /** Bubbles raised off the lying hero so far this frame. */

  /** `avoid`: screen box (the hero lying on the street) a bubble must not cover: it is raised above it instead. */
  private bubble(id: string, text: string, at: WorldPos, lift: number, zoom: number, hero: boolean, avoid: { x0: number; x1: number; y0: number; y1: number } | null = null): void {
    let b = this.bubbles.get(id);
    if (!b) {
      b = new SpeechBubble(this.scene).setDepth(1e6 - 2);
      this.bubbles.set(id, b);
    }
    const anchor = worldToScreen(at), cameraView = this.scene.cameras.main.worldView;
    if (!cameraView.contains(anchor.x, anchor.y)) { b.setVisible(false); return; }
    b.setVisible(true);
    b.set(text, hero ? 'hero' : 'npc');
    const p = worldToScreen(at);
    b.setScale(1 / zoom);
    const y = p.y - lift, view = this.scene.cameras.main.worldView;
    const w = b.width * b.scale, h = b.height * b.scale, pad = 8 / zoom;
    const x = Math.max(view.x + w / 2 + pad, Math.min(view.right - w / 2 - pad, p.x));
    const offset = (x - p.x) * zoom;
    const overlapsHero = avoid && x + w / 2 > avoid.x0 && x - w / 2 < avoid.x1 && y > avoid.y0 && y - h < avoid.y1;
    // Never detach a bubble from its speaker to squeeze it into a crowded corner.
    if (Math.abs(offset) > b.width / 2 - 24 || y - h < view.y + 64 / zoom || overlapsHero) { b.setVisible(false); return; }
    b.setCardOffsetX(offset).setPosition(p.x, y);

  }

  destroy(): void {
    for (const g of this.bodies.values()) g.destroy();
    for (const shadow of this.contactShadows.values()) shadow.destroy();
    for (const b of this.bubbles.values()) b.destroy();
    for (const parts of this.fences.values()) for (const g of parts) g.destroy();
    for (const b of this.booms.values()) b.g.destroy();
    this.portalG?.destroy();
    this.skidG?.destroy();
    this.flashG?.destroy();
    this.mishapG?.destroy();
    this.boomT?.destroy();
    this.bonkT?.destroy();
    this.wheelImage?.destroy();
    this.bodies.clear();
    this.contactShadows.clear();
    this.bubbles.clear();
  }
}
