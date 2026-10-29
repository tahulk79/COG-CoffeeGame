import Phaser from 'phaser';
import type { TrialNpc, TrialView } from '../../gameplay/story/TrialService';
import type { WorldPos } from '../../utils/tile';
import { actorDepth, worldToScreen } from '../../utils/iso';
import { cloud } from './gardenArt';
import { dot, INK, point, rr, shadow } from './incidentArt';
import { PIXEL_RATIO, TEXT_RES } from '../../ui/layout/pixelRatio';

/**
 * Chapter 2, the road of rebirth, drawn every frame in code (prototype look):
 * the station keepers, the cloud wall barring the road at each station (it
 * melts once the question is answered), the door keeper, the coffee spirit
 * following the hero, a "…" mark over whoever is talking (the words themselves
 * are in the HUD's footer, with their portrait) and the gags of a reply: a bell
 * ring for a good one, a "SAI" board falling on the hero's head for a wrong one.
 */
const ROBE: Record<TrialNpc | 'keeper', number> = { scholar: 0x6f8fc9, librarian: 0xb48ad6, scale: 0xe9b04f, spirit: 0xfff6e5, keeper: 0xe2513f };
const LABEL = { fontFamily: "'Baloo 2', sans-serif", fontSize: '16px', fontStyle: '800', color: '#5a3825', backgroundColor: '#fffaf0', padding: { x: 8, y: 2 }, resolution: TEXT_RES };

/** A keeper standing on a little cloud: robe, head, and what they hold (also the footer's portrait). */
export function drawKeeper(g: Phaser.GameObjects.Graphics, x: number, y: number, kind: TrialNpc | 'keeper', now: number, tilt: number, bust = false): void {
  const bob = Math.sin(now / 420 + x) * 3;
  if (!bust) {
    cloud(g, x, y + 4, 26, .95);
    shadow(g, x, y, 54, 18);
  }
  const robe = ROBE[kind];
  g.fillStyle(robe).fillTriangle(x - 24, y - 4 + bob, x + 24, y - 4 + bob, x, y - 70 + bob).lineStyle(3, INK).strokeTriangle(x - 24, y - 4 + bob, x + 24, y - 4 + bob, x, y - 70 + bob);
  const hy = y - 80 + bob;
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
function board(g: Phaser.GameObjects.Graphics, x: number, y: number, k: number): Phaser.Math.Vector2 {
  const drop = Math.min(1, k * 4);
  const by = y - 170 + drop * 70 + (drop >= 1 ? Math.sin(k * 30) * 3 * (1 - k) : 0);
  rr(g, x - 34, by - 22, 68, 40, 6, 0xffffff);
  g.lineStyle(4, 0xe2513f).strokeRoundedRect(x - 34, by - 22, 68, 40, 6);
  return new Phaser.Math.Vector2(x, by - 2);
}

export class TrialEffects {
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly people = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly sai: Phaser.GameObjects.Text;
  private tilt = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly road: { top: number; bottom: number }) {
    this.fx = scene.add.graphics().setDepth(1e6 - 4);
    this.sai = scene.add.text(0, 0, 'SAI', { fontFamily: "'Baloo 2', sans-serif", fontSize: '26px', fontStyle: '800', color: '#e2513f', resolution: TEXT_RES }).setOrigin(.5).setDepth(1e6 - 3).setVisible(false);
  }

  sync(v: TrialView | null, hero: WorldPos): void {
    const g = this.fx.clear();
    if (!v) { this.sai.setVisible(false); return; }
    const now = this.scene.time.now, z = this.scene.cameras.main.zoom / PIXEL_RATIO;
    // The scale tilts towards the last reply's mood, then settles.
    const mood = [...v.events].reverse().find((e) => e.kind === 'right' || e.kind === 'wrong');
    const want = mood ? (mood.kind === 'right' ? -1 : 1) * Math.cos((now - mood.at) / 90) * Math.max(0, 1 - (now - mood.at) / 1500) : 0;
    this.tilt += (want - this.tilt) * .2;

    for (const s of v.stations) {
      wall(g, s.wallX, s.melt, this.road.top, this.road.bottom);
      // The coffee spirit keeps the last station itself: a sign marks the spot.
      if (s.npc === 'spirit') this.person(s.id, { x: s.x, y: s.y }, null, s.name, now);
      else this.person(s.id, { x: s.x, y: s.y }, s.npc, s.name, now);
    }
    this.person('gate', v.gate, 'keeper', v.gate.name, now);

    // A good reply rings a bell over the hero; a wrong one drops the "SAI" board on their head.
    const h = point(hero.x, hero.y, 0);
    let showSai = false;
    for (const e of v.events) {
      const k = (now - e.at) / 1500;
      if (k < 0 || k > 1) continue;
      if (e.kind === 'right') {
        g.lineStyle(5, 0xffd25e, 1 - k).strokeCircle(h.x, h.y - 70, 30 + k * 70);
        g.fillStyle(0xffd25e, 1 - k).fillCircle(h.x - 40 + k * 10, h.y - 150 - k * 30, 6).fillCircle(h.x + 44 - k * 8, h.y - 140 - k * 40, 5);
      } else if (e.kind === 'wrong') {
        const at = board(g, h.x, h.y, k);
        this.sai.setPosition(at.x, at.y);
        showSai = true;
      } else if (e.kind === 'clear') {
        const st = v.stations.find((s) => s.id === e.station);
        if (st) { const p = point(st.wallX, (this.road.top + this.road.bottom) / 2, 60); g.lineStyle(4, 0xffffff, 1 - k).strokeCircle(p.x, p.y, 40 + k * 120); }
      }
    }
    this.sai.setVisible(showSai);

    const sp = point(v.spirit.x, v.spirit.y, 70 + Math.sin(now / 260) * 8);
    drawSpirit(g, sp.x, sp.y, now);
    this.talking(g, v, hero, z, now);
  }

  private person(id: string, at: WorldPos, kind: TrialNpc | 'keeper' | null, name: string, now: number): void {
    let p = this.people.get(id);
    if (!p) {
      p = this.scene.add.graphics().setDepth(actorDepth(at));
      this.people.set(id, p);
    }
    const c = point(at.x, at.y);
    p.clear();
    if (kind) drawKeeper(p, c.x, c.y, kind, now, this.tilt);
    else cloud(p, c.x, c.y + 4, 26, .95);
    let label = this.labels.get(id);
    if (!label) {
      label = this.scene.add.text(c.x, c.y + 26, name, LABEL).setOrigin(.5, 0).setDepth(1e6 - 5);
      this.labels.set(id, label);
    }
  }

  /** A little "…" card bobbing over whoever is talking, so the footer's words point back into the world. */
  private talking(g: Phaser.GameObjects.Graphics, v: TrialView, hero: WorldPos, zoom: number, now: number): void {
    const s = v.say;
    if (!s || s.who === 'book') return;
    const station = v.stations.find((st) => st.id === s.who);
    const spirit = s.who === 'spirit' || station?.npc === 'spirit';
    const at = s.who === 'hero' ? hero : spirit ? v.spirit : s.who === 'gate' ? v.gate : station ? { x: station.x, y: station.y } : hero;
    const lift = s.who === 'hero' ? 140 : spirit ? 118 : 130;
    const p = worldToScreen(at), k = 1 / Math.max(.4, zoom), y = p.y - lift + Math.sin(now / 180) * 3;
    g.fillStyle(INK).fillRoundedRect(p.x - 24 * k, y - 15 * k, 48 * k, 30 * k, 12 * k);
    g.fillStyle(0xfffaf0).fillRoundedRect(p.x - 21 * k, y - 12 * k, 42 * k, 24 * k, 10 * k);
    for (let i = 0; i < 3; i++) g.fillStyle(INK, (Math.floor(now / 250) % 3) === i ? 1 : .35).fillCircle(p.x + (i - 1) * 11 * k, y, 3.5 * k);
  }

  destroy(): void {
    this.fx.destroy();
    this.sai.destroy();
    for (const p of this.people.values()) p.destroy();
    for (const l of this.labels.values()) l.destroy();
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
