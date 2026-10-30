import Phaser from 'phaser';
import type { TrialNpc, TrialPortrait, TrialView } from '../../gameplay/story/TrialService';
import { COLORS, dur, MOTION } from '../../ui/theme/tokens';
import type { WorldPos } from '../../utils/tile';
import { actorDepth, worldToScreen } from '../../utils/iso';
import { cloud } from './gardenArt';
import { dot, INK, point, rr, shadow } from './incidentArt';
import { PIXEL_RATIO, TEXT_RES } from '../../ui/layout/pixelRatio';
import { CHAPTER2_SLICE_ASSETS } from './sliceAssets';

/**
 * Chapter 2: full-cell character sprites with a procedural fallback when art is unavailable:
 * the station keepers, the cloud wall barring the road at each station (it
 * melts once the question is answered), the door keeper, the coffee spirit
 * following the hero, a "…" mark over whoever is talking (the words themselves
 * are in the HUD's footer, with their portrait) and the gags of a reply: a bell
 * ring for a good one, a "SAI" board falling on the hero's head for a wrong one.
 */
const ROBE: Record<TrialNpc | 'keeper' | 'reaper', number> = { scholar: 0x6f8fc9, librarian: 0xb48ad6, scale: 0xe9b04f, spirit: 0xfff6e5, keeper: 0xe2513f, reaper: 0x3b3346 };
/** Name plates match the footer's tab: cream letters on a dark wood pill (the pill is drawn in `plates`). */
const LABEL = { fontFamily: "'Baloo 2', sans-serif", fontSize: '26px', fontStyle: '800', color: '#fff4df', resolution: TEXT_RES };

/** Full-cell anchors measured after sheet normalisation; pose changes never resize the figure. */
const CHARACTER_ART: Record<TrialNpc | 'keeper' | 'reaper', { key: string; row: number; size: number; x: number; y: number; flip: boolean }> = {
  scholar: { key: CHAPTER2_SLICE_ASSETS.scholar.key, row: 0, size: 88, x: .45, y: .96, flip: true },
  librarian: { key: CHAPTER2_SLICE_ASSETS.keepers.key, row: 0, size: 92, x: .45, y: .967, flip: true },
  scale: { key: CHAPTER2_SLICE_ASSETS.keepers.key, row: 1, size: 100, x: .43, y: .934, flip: true },
  keeper: { key: CHAPTER2_SLICE_ASSETS.keepers.key, row: 2, size: 96, x: .45, y: .86, flip: true },
  reaper: { key: CHAPTER2_SLICE_ASSETS.gods.key, row: 0, size: 104, x: .44, y: .932, flip: true },
  spirit: { key: CHAPTER2_SLICE_ASSETS.gods.key, row: 1, size: 96, x: .52, y: .55, flip: false },
};

/** A keeper standing on a little cloud: robe, head, and what they hold (also the footer's portrait). */
export function drawKeeper(g: Phaser.GameObjects.Graphics, x: number, y: number, kind: TrialNpc | 'keeper' | 'reaper', now: number, tilt: number, bust = false): void {
  const bob = Math.sin(now / 420 + x) * 3;
  if (!bust) {
    cloud(g, x, y + 4, 26, .95);
    shadow(g, x, y, 54, 18);
  }
  const robe = ROBE[kind];
  g.fillStyle(robe).fillTriangle(x - 24, y - 4 + bob, x + 24, y - 4 + bob, x, y - 70 + bob).lineStyle(3, INK).strokeTriangle(x - 24, y - 4 + bob, x + 24, y - 4 + bob, x, y - 70 + bob);
  const hy = y - 80 + bob;
  if (kind === 'reaper') {
    // Hooded, pale and sleepy-eyed, holding a phở ladle instead of a scythe.
    dot(g, x, hy - 2, 22, 0x3b3346);
    dot(g, x, hy + 2, 14, 0xe9e6f0);
    g.lineStyle(2, INK).lineBetween(x - 9, hy, x - 3, hy).lineBetween(x + 3, hy, x + 9, hy);
    g.lineStyle(4, 0xb0b6c0).lineBetween(x + 26, y - 6 + bob, x + 26, y - 96 + bob);
    g.fillStyle(0xd7dce4).fillEllipse(x + 26, y - 100 + bob, 26, 16).lineStyle(2, INK).strokeEllipse(x + 26, y - 100 + bob, 26, 16);
    return;
  }
  dot(g, x, hy, 17, 0xf6d2b0);
  g.fillStyle(INK).fillCircle(x - 6, hy - 1, 2.4).fillCircle(x + 6, hy - 1, 2.4);
  if (kind === 'scholar') {
    // Long white beard, a scholar's hat and a little blackboard.
    g.fillStyle(0xffffff).fillTriangle(x - 10, hy + 6, x + 10, hy + 6, x, hy + 34).lineStyle(2, INK).strokeTriangle(x - 10, hy + 6, x + 10, hy + 6, x, hy + 34);
    rr(g, x - 18, hy - 22, 36, 8, 3, 0x2b2b3a);
    rr(g, x + 22, y - 62 + bob, 40, 30, 4, 0x2f4f3f);
    g.lineStyle(2, 0xffffff, .9).lineBetween(x + 28, y - 52 + bob, x + 52, y - 52 + bob).lineBetween(x + 28, y - 44 + bob, x + 46, y - 44 + bob);
  } else if (kind === 'librarian') {
    // Glasses, a hair bun and a stack of books.
    g.lineStyle(2, INK).strokeCircle(x - 6, hy - 1, 5).strokeCircle(x + 6, hy - 1, 5);
    dot(g, x, hy - 18, 9, 0x5a3825);
    [0x6fd3c0, 0xff8a73, 0xffd25e].forEach((c, i) => rr(g, x + 20, y - 26 - i * 10 + bob, 34 - i * 4, 9, 2, c));
  } else if (kind === 'scale') {
    // A bald head and a balance held overhead; it tilts with the last reply.
    const by = hy - 34, a = tilt * 0.35;
    g.lineStyle(3, INK).lineBetween(x, hy - 16, x, by);
    const lx = x - Math.cos(a) * 34, ly = by - Math.sin(a) * 34, rx = x + Math.cos(a) * 34, ry = by + Math.sin(a) * 34;
    g.lineStyle(4, 0xf2c45a).lineBetween(lx, ly, rx, ry);
    for (const [px, py, c] of [[lx, ly, 0xfff1a8], [rx, ry, 0x9aa7b5]] as const) {
      g.lineStyle(2, INK).lineBetween(px, py, px - 10, py + 14).lineBetween(px, py, px + 10, py + 14);
      g.fillStyle(c).fillEllipse(px, py + 16, 26, 8).lineStyle(2, INK).strokeEllipse(px, py + 16, 26, 8);
    }
  } else if (kind === 'keeper') {
    // An old lady with a headscarf and a paper lantern.
    g.fillStyle(0x6b4a8a).fillEllipse(x, hy - 10, 40, 22);
    g.lineStyle(2, INK).lineBetween(x + 24, y - 50 + bob, x + 30, y - 76 + bob);
    dot(g, x + 32, y - 46 + bob, 11, 0xff8a73);
    g.fillStyle(0xffd25e, .35 + Math.sin(now / 200) * .1).fillCircle(x + 32, y - 46 + bob, 20);
  }
}

/** The cloud wall across the road at a station; `melt` 0 → 1 lifts and fades it. */
function wall(g: Phaser.GameObjects.Graphics, x: number, melt: number, top: number, bottom: number): void {
  const a = 1 - melt;
  if (a <= 0) return;
  for (let y = top; y <= bottom; y += .55) {
    const p = point(x, y, 10 + melt * 80 + ((y * 7) % 3) * 6);
    cloud(g, p.x, p.y, 26 + ((y * 13) % 4) * 3, a);
  }
}

/** The "SAI" board dropping on the hero's head (`k` 0 → 1 over the gag). */
function board(g: Phaser.GameObjects.Graphics, x: number, y: number, k: number, draw = true): Phaser.Math.Vector2 {
  const drop = Math.min(1, k * 4);
  const by = y - 170 + drop * 70 + (drop >= 1 ? Math.sin(k * 30) * 3 * (1 - k) : 0);
  if (draw) {
    rr(g, x - 34, by - 22, 68, 40, 6, 0xffffff);
    g.lineStyle(4, 0xe2513f).strokeRoundedRect(x - 34, by - 22, 68, 40, 6);
  }
  return new Phaser.Math.Vector2(x, by - 2);
}

export class TrialEffects {
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly plates: Phaser.GameObjects.Graphics;
  private heroAt = { x: 0, y: 0 };
  private talker: string | null = null;
  private readonly people = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly sai: Phaser.GameObjects.Text;
  private readonly saiBoard: Phaser.GameObjects.Image | null;
  private readonly bell: Phaser.GameObjects.Image | null;
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly walls = new Map<string, [Phaser.GameObjects.Image, Phaser.GameObjects.Image]>();
  private tilt = 0;
  /** Where the Death God stood, and when he started to vanish (scene clock, ms; -1 = not vanishing). */
  private lastReaper: WorldPos | null = null;
  private vanishAt = -1;
  /** Keepers that left because their double is coming: where they stood and when (scene clock). */
  private readonly poofs = new Map<string, { at: WorldPos; start: number }>();

  constructor(private readonly scene: Phaser.Scene, private readonly road: { top: number; bottom: number }, private readonly door?: WorldPos) {
    this.fx = scene.add.graphics().setDepth(1e6 - 4);
    this.plates = scene.add.graphics().setDepth(1e6 - 5.5);
    this.sai = scene.add.text(0, 0, 'SAI', { fontFamily: "'Baloo 2', sans-serif", fontSize: '22px', fontStyle: '800', color: '#c8463d', resolution: TEXT_RES }).setOrigin(.5).setDepth(1e6 - 3).setVisible(false);
    const ui = CHAPTER2_SLICE_ASSETS.ui.key, ready = scene.textures.exists(ui) && scene.textures.get(ui).has('5');
    this.saiBoard = ready ? scene.add.image(0, 0, ui, '4').setDisplaySize(100, 100).setDepth(1e6 - 3.5).setVisible(false) : null;
    this.bell = ready ? scene.add.image(0, 0, ui, '5').setDisplaySize(64, 64).setDepth(1e6 - 3).setVisible(false) : null;
  }

  sync(v: TrialView | null, hero: WorldPos): void {
    const g = this.fx.clear();
    this.plates.clear();
    this.saiBoard?.setVisible(false);
    this.bell?.setVisible(false);
    if (!v) {
      this.sai.setVisible(false);
      for (const sprite of this.sprites.values()) sprite.setVisible(false);
      for (const person of this.people.values()) person.setVisible(false);
      for (const label of this.labels.values()) label.setVisible(false);
      for (const pair of this.walls.values()) for (const image of pair) image.setVisible(false);
      return;
    }
    const motion = dur(MOTION.base) > 0;
    const now = motion ? v.timeMs : 0, z = this.scene.cameras.main.zoom / PIXEL_RATIO;
    // The scale tilts towards the last reply's mood, then settles.
    const scaleId = v.stations.find((s) => s.npc === 'scale')?.id;
    const mood = [...v.events].reverse().find((e) => e.station === scaleId && (e.kind === 'right' || e.kind === 'wrong'));
    const want = motion && mood ? (mood.kind === 'right' ? -1 : 1) * Math.cos((v.timeMs - mood.at) / 90) * Math.max(0, 1 - (v.timeMs - mood.at) / 1500) : 0;
    this.tilt = motion ? this.tilt + (want - this.tilt) * .2 : 0;

    // The opening belongs to the Death God alone: the keepers only appear once he has gone.
    const intro = !!v.reaper;
    this.heroAt = point(hero.x, hero.y, 0);
    this.talker = v.say?.who ?? null;
    const nextId = v.stations.find((st) => !st.done)?.id;
    for (const s of v.stations) {
      const melt = motion ? s.melt : s.done ? 1 : 0;
      if (!v.island && !this.drawCloudWall(s, melt)) wall(g, s.wallX, melt, this.road.top, this.road.bottom);
      // A keeper of the same kind as an earlier station (the second Ông Đồ) only turns up once it is his turn: no twins on the island.
      const at = v.stations.indexOf(s);
      const repeat = v.stations.findIndex((o) => o.npc === s.npc) < at;
      // ...and the earlier one steps out (in a puff) just as his double is about to appear.
      const replaced = v.stations.some((o, i) => i > at && o.npc === s.npc && (o.done || nextId === o.id));
      if (replaced && !this.poofs.has(s.id) && !intro && this.people.get(s.id)?.visible) this.poofs.set(s.id, { at: { x: s.x, y: s.y }, start: v.timeMs });
      if (intro || replaced || (repeat && !s.done && nextId !== s.id)) { this.hide(s.id); continue; }
      // The spirit flies to its own station; the cloud beneath marks that station.
      this.person(s.id, { x: s.x, y: s.y }, s.npc === 'spirit' ? null : s.npc, s.name, now, this.pose(v, s.id), s.npc !== 'spirit' || nextId === s.id, s.done ? 'done' : nextId === s.id ? 'quest' : null);
    }
    if (motion) for (const p of this.poofs.values()) {
      const k = (v.timeMs - p.start) / 900;
      if (k >= 0 && k < 1) this.burst(g, point(p.at.x, p.at.y), k);
    }
    if (intro) this.hide('gate');
    else this.person('gate', v.gate, 'keeper', v.gate.name, now, this.pose(v, 'gate'), true, null);
    if (v.reaper) { this.lastReaper = { x: v.reaper.x, y: v.reaper.y }; this.vanishAt = -1; this.person('reaper', v.reaper, 'reaper', v.reaper.name, now, this.pose(v, 'reaper'), true, null); }
    else this.vanish(g, motion, v.timeMs);

    // A good reply rings a bell over the hero; a wrong one drops the "SAI" board on their head.
    const h = point(hero.x, hero.y, 0);
    let showSai = false;
    for (const e of v.events) {
      const k = (v.timeMs - e.at) / 1500;
      if (k < 0 || k > 1) continue;
      if (e.kind === 'right') {
        g.lineStyle(5, 0xffd25e, 1 - k).strokeCircle(h.x, h.y - 70, 30 + (motion ? k * 70 : 0));
        this.bell?.setVisible(true).setPosition(h.x, h.y - 120 - (motion ? k * 20 : 0)).setAlpha(1 - k).setRotation(motion ? Math.sin(k * 24) * .12 : 0);
      } else if (e.kind === 'wrong') {
        const at = board(g, h.x, h.y, motion ? k : 1, !this.saiBoard);
        this.saiBoard?.setVisible(true).setPosition(at.x, at.y);
        this.sai.setPosition(at.x, at.y);
        showSai = true;
      } else if (e.kind === 'clear') {
        const st = v.stations.find((s) => s.id === e.station);
        if (st && motion) { const p = v.island ? point(st.x, st.y, 20) : point(st.wallX, (this.road.top + this.road.bottom) / 2, 60); g.lineStyle(4, 0xffffff, 1 - k).strokeCircle(p.x, p.y, 40 + k * 120); }
      } else if (e.kind === 'open' && this.door) {
        const p = point(this.door.x, this.door.y, 80);
        g.fillStyle(0xffedb0, .18 * (1 - k)).fillEllipse(p.x, p.y, 130 + (motion ? k * 60 : 0), 190 + (motion ? k * 60 : 0));
      }
    }
    this.sai.setVisible(showSai);

    const sp = point(v.spirit.x, v.spirit.y, 70 + (motion ? Math.sin(now / 260) * 8 : 0));
    const spiritSpeaker = v.say?.who === 'spirit' ? 'spirit' : v.stations.find((s) => s.npc === 'spirit')?.id ?? 'spirit';
    if (!this.character('spirit', 'spirit', sp.x, sp.y, actorDepth(v.spirit), this.pose(v, spiritSpeaker))) drawSpirit(g, sp.x, sp.y, now);
    this.talking(g, v, hero, z, now);
  }

  /** The Death God leaves in a puff: he rises and fades while a ring of cloud and sparkles bursts out. */
  private vanish(g: Phaser.GameObjects.Graphics, motion: boolean, clock: number): void {
    const at = this.lastReaper;
    if (!at) { this.hide('reaper'); return; }
    if (this.vanishAt < 0) this.vanishAt = clock;
    const k = motion ? (clock - this.vanishAt) / 900 : 1;
    if (k >= 1) { this.lastReaper = null; this.sprites.get('reaper')?.setAlpha(1); this.hide('reaper'); return; }
    const c = point(at.x, at.y), sprite = this.sprites.get('reaper');
    this.labels.get('reaper')?.setVisible(false);
    this.people.get('reaper')?.setVisible(false);
    sprite?.setVisible(true).setAlpha((1 - k) ** 1.5).setPosition(c.x, c.y - k * 46).setScale(1 + k * .12);
    this.burst(g, c, k);
  }

  /** A ring of cloud puffs and gold sparkles around `c`, `k` going 0 to 1. */
  private burst(g: Phaser.GameObjects.Graphics, c: { x: number; y: number }, k: number): void {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + .4, d = 14 + k * 78, r = 22 * (1 - k * .5);
      g.fillStyle(i % 2 ? 0xe9e0f5 : 0xffffff, .85 * (1 - k)).fillCircle(c.x + Math.cos(a) * d, c.y - 52 + Math.sin(a) * d * .55, r);
    }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, d = 20 + k * 96, sx = c.x + Math.cos(a) * d, sy = c.y - 64 - k * 40 + Math.sin(a) * d * .5, w = 7 * (1 - k);
      g.fillStyle(0xffd25e, 1 - k).fillTriangle(sx, sy - w * 1.6, sx + w, sy, sx - w, sy).fillTriangle(sx, sy + w * 1.6, sx + w, sy, sx - w, sy);
    }
  }

  private hide(id: string): void {
    this.people.get(id)?.setVisible(false);
    this.sprites.get(id)?.setVisible(false);
    this.labels.get(id)?.setVisible(false);
  }

  private person(id: string, at: WorldPos, kind: TrialNpc | 'keeper' | 'reaper' | null, name: string, now: number, pose = 0, labelOn = true, mark: 'quest' | 'done' | null = null): void {
    let p = this.people.get(id);
    if (!p) {
      p = this.scene.add.graphics().setDepth(actorDepth(at));
      this.people.set(id, p);
    }
    const c = point(at.x, at.y);
    p.setVisible(true).clear();
    if (kind && this.character(id, kind, c.x, c.y, actorDepth(at), pose)) {
      cloud(p, c.x, c.y + 4, 26, .95);
      shadow(p, c.x, c.y, 42, 14);
    } else if (kind) drawKeeper(p, c.x, c.y, kind, now, this.tilt);
    else cloud(p, c.x, c.y + 4, 26, .95);
    let label = this.labels.get(id);
    if (!label) {
      label = this.scene.add.text(c.x, c.y + 16, name, LABEL).setOrigin(.5, 0).setDepth(1e6 - 5);
      this.labels.set(id, label);
    }
    label.setText(name).setPosition(c.x, c.y + 18).setVisible(labelOn);
    if (labelOn) {
      // Fade the plate when the hero stands over it, so it never hides them.
      const near = Math.hypot(this.heroAt.x - c.x, this.heroAt.y - (c.y + 30)) < 90;
      const w = label.width + 28, h = label.height + 4;
      label.setAlpha(near ? .35 : 1);
      this.plates.fillStyle(0x4b2e1e, near ? .3 : .94).fillRoundedRect(c.x - w / 2, label.y - 2, w, h, h / 2);
      this.plates.lineStyle(2, 0xe9b04f, near ? .3 : 1).strokeRoundedRect(c.x - w / 2, label.y - 2, w, h, h / 2);
    }
    if (mark && this.talker !== id) this.badge(c.x, c.y - (kind ? CHARACTER_ART[kind].size * 1.55 + 34 : 130) + (dur(MOTION.base) > 0 ? Math.sin(now / 240 + c.x) * 4 : 0), mark);
  }

  /** "!" over the next keeper to visit, a green tick over the ones already done. */
  private badge(x: number, y: number, kind: 'quest' | 'done'): void {
    const g = this.fx;
    g.fillStyle(kind === 'quest' ? 0xffc94d : 0x6fbf73).fillCircle(x, y, 15).lineStyle(3, INK).strokeCircle(x, y, 15);
    if (kind === 'quest') {
      g.fillStyle(INK).fillRoundedRect(x - 2.5, y - 9, 5, 11, 2).fillCircle(x, y + 7, 2.8);
    } else {
      g.lineStyle(4, 0xffffff).beginPath().moveTo(x - 7, y).lineTo(x - 2, y + 6).lineTo(x + 8, y - 6).strokePath();
    }
  }

  private pose(v: TrialView, speaker: string): number {
    const line = v.say?.who === speaker ? v.say : null;
    if (line) {
      if (line.expression === 'surprised' || line.expression === 'apology' || line.mood === 'wrong') return 3;
      if (line.expression === 'happy' || line.mood === 'right' || line.mood === 'funny') return 2;
      return 1;
    }
    const reaction = [...v.events].reverse().find((e) => e.station === speaker && (e.kind === 'right' || e.kind === 'wrong' || e.kind === 'funny'));
    return reaction ? reaction.kind === 'wrong' ? 3 : 2 : 0;
  }

  private character(id: string, kind: TrialNpc | 'keeper' | 'reaper', x: number, y: number, depth: number, pose: number): boolean {
    const art = CHARACTER_ART[kind], frame = String(art.row * 4 + pose);
    if (!this.scene.textures.exists(art.key) || !this.scene.textures.get(art.key).has(frame)) {
      this.sprites.get(id)?.setVisible(false);
      return false;
    }
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = this.scene.add.image(x, y, art.key, frame).setFlipX(art.flip).setOrigin(art.x, art.y).setDisplaySize(art.size * 1.9, art.size * 1.9);
      this.sprites.set(id, sprite);
    }
    sprite.setFrame(frame).setPosition(x + (kind === 'scale' ? this.tilt * 2 : 0), y).setDepth(depth).setVisible(true);
    return true;
  }

  /** Keep this low barrier behind people so the cloud banks cannot hide the hero. */
  private drawCloudWall(s: TrialView['stations'][number], melt: number): boolean {
    const asset = CHAPTER2_SLICE_ASSETS.cloudWall;
    if (!this.scene.textures.exists(asset.key) || !this.scene.textures.get(asset.key).has('1')) return false;
    let pair = this.walls.get(s.id);
    if (!pair) {
      pair = [0, 1].map((frame) => this.scene.add.image(0, 0, asset.key, String(frame)).setOrigin(.5, .72)) as [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
      this.walls.set(s.id, pair);
    }
    const at = point(s.wallX, (this.road.top + this.road.bottom) / 2);
    const width = (this.road.bottom - this.road.top) * 64 + 96;
    const depth = actorDepth({ x: s.wallX, y: this.road.top }) - 2;
    pair.forEach((image, frame) => image.setVisible(melt < 1)
      .setPosition(at.x, at.y - melt * 42).setDisplaySize(width, width).setDepth(depth + frame * .01)
      .setAlpha(frame === 0 ? (1 - melt) ** 2 : 2 * melt * (1 - melt)));
    return true;
  }

  /** A little "…" card bobbing over whoever is talking, so the footer's words point back into the world. */
  private talking(g: Phaser.GameObjects.Graphics, v: TrialView, hero: WorldPos, zoom: number, now: number): void {
    const s = v.say;
    if (!s || s.who === 'book') return;
    const station = v.stations.find((st) => st.id === s.who);
    const spirit = s.who === 'spirit' || station?.npc === 'spirit';
    const at = s.who === 'hero' ? hero : spirit ? v.spirit : s.who === 'gate' ? v.gate : s.who === 'reaper' && v.reaper ? v.reaper : station ? { x: station.x, y: station.y } : hero;
    const kind = s.who === 'reaper' ? 'reaper' : s.who === 'gate' ? 'keeper' : station && station.npc !== 'spirit' ? station.npc : null;
    // Above the head: the taller the figure, the higher the bubble.
    const lift = s.who === 'hero' ? 176 : spirit ? 152 : kind ? CHARACTER_ART[kind].size * 1.55 + 40 : 166;
    const p = worldToScreen(at), k = 1 / Math.max(.4, zoom), y = p.y - lift + Math.sin(now / 180) * 3;
    g.fillStyle(INK).fillRoundedRect(p.x - 24 * k, y - 15 * k, 48 * k, 30 * k, 12 * k);
    g.fillStyle(0xfffaf0).fillRoundedRect(p.x - 21 * k, y - 12 * k, 42 * k, 24 * k, 10 * k);
    for (let i = 0; i < 3; i++) g.fillStyle(INK, (Math.floor(now / 250) % 3) === i ? 1 : .35).fillCircle(p.x + (i - 1) * 11 * k, y, 3.5 * k);
  }

  destroy(): void {
    this.fx.destroy();
    this.plates.destroy();
    this.sai.destroy();
    this.saiBoard?.destroy();
    this.bell?.destroy();
    for (const p of this.people.values()) p.destroy();
    for (const l of this.labels.values()) l.destroy();
    for (const sprite of this.sprites.values()) sprite.destroy();
    for (const pair of this.walls.values()) for (const image of pair) image.destroy();
  }
}

/** The little winged cup of a coffee spirit (in the world, and the footer's portrait). */
export function drawSpirit(s: Phaser.GameObjects.Graphics, x: number, y: number, now: number): void {
  const wing = Math.sin(now / 90) * 6;
  s.fillStyle(0xffffff).lineStyle(2, INK);
  s.fillEllipse(x - 18, y - 6 - wing, 18, 12).strokeEllipse(x - 18, y - 6 - wing, 18, 12);
  s.fillEllipse(x + 18, y - 6 - wing, 18, 12).strokeEllipse(x + 18, y - 6 - wing, 18, 12);
  s.fillStyle(0xfff6e5).fillRoundedRect(x - 13, y - 14, 26, 24, 6).strokeRoundedRect(x - 13, y - 14, 26, 24, 6);
  s.fillStyle(0x8a5a3a).fillEllipse(x, y - 13, 22, 6);
  s.lineStyle(3, INK).beginPath().arc(x + 15, y - 3, 6, -Math.PI / 2, Math.PI / 2).strokePath();
  s.fillStyle(INK).fillCircle(x - 5, y - 3, 2).fillCircle(x + 5, y - 3, 2);
  s.fillStyle(0xff9e8a, .7).fillCircle(x - 8, y + 2, 2.5).fillCircle(x + 8, y + 2, 2.5);
  for (let i = 0; i < 2; i++) s.lineStyle(2, 0xffffff, .8).beginPath().arc(x - 4 + i * 8, y - 24 - ((now / 30 + i * 10) % 10), 3, Math.PI, 0).strokePath();
}

/** The talk footer's face for a chapter-2 speaker (not the hero, whose portrait the footer has): a keeper's bust, the spirit or the karma book. */
export function drawTrialFace(g: Phaser.GameObjects.Graphics, face: string, now: number): void {
  const who = face as Exclude<TrialPortrait, 'hero'>;
  const bg = who === 'book' ? COLORS.sun : who === 'spirit' ? 0xd8ecff : who === 'reaper' ? 0xcfc6dc : 0xfff1d6;
  g.fillStyle(bg).fillCircle(0, 0, 40).lineStyle(3, COLORS.ink).strokeCircle(0, 0, 40);
  if (who === 'spirit') drawSpirit(g, 0, 6, now);
  else if (who === 'book') {
    g.fillStyle(COLORS.coral).fillRoundedRect(-22, -18, 44, 36, 4).lineStyle(3, COLORS.ink).strokeRoundedRect(-22, -18, 44, 36, 4);
    g.fillStyle(COLORS.paper).fillRect(-16, -14, 32, 28).lineStyle(2, COLORS.ink).lineBetween(0, -14, 0, 14);
    for (const yy of [-6, 0, 6]) g.lineStyle(2, COLORS.woodLight).lineBetween(-12, yy, -4, yy).lineBetween(4, yy, 12, yy);
  } else drawKeeper(g, 0, 50, who, now, 0, true);
}

/** Portrait frames follow the six-cell sheet; the approved scholar and hero remain reused. */
export function trialFaceTexture(face: string): { key: string; frame?: string } | null {
  // The hero's own head (cut from chapter 1's art master).
  if (face === 'hero') return { key: CHAPTER2_SLICE_ASSETS.heroAvatar.key };
  if (face === 'scholar') return { key: CHAPTER2_SLICE_ASSETS.scholarPortrait.key };
  const frame = ({ librarian: '0', scale: '1', keeper: '2', reaper: '3', spirit: '4', book: '5' } as Record<string, string>)[face];
  return frame === undefined ? null : { key: CHAPTER2_SLICE_ASSETS.portraits.key, frame };
}
