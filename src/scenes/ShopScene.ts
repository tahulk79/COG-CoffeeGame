import Phaser from 'phaser';
import type { GameSimulation } from '../gameplay/GameSimulation';
import type { ShopView } from '../gameplay/story/ShopService';
import { actorDepth, footprintDepth, screenToWorld, worldToScreen } from '../utils/iso';
import { block, dot, face, INK, oval, point, rr, shadow } from '../components/render/incidentArt';
import { person } from '../components/render/streetArt';

export const SHOP_SCENE = 'ShopScene';

/** Floor, wall and trim colours per shop. */
const ROOM_STYLE: Record<string, { floor: [number, number]; wall: number; trim: number }> = {
  pho: { floor: [0xf3e7d3, 0xe9d8b6], wall: 0xf6d77a, trim: 0xe2513f },
  bun_dau: { floor: [0xe9dcc4, 0xdccba8], wall: 0xc9ecd9, trim: 0x7cc47f },
  cafe: { floor: [0xc98a55, 0xb97a48], wall: 0xf2e2a0, trim: 0x6b4a3a },
};

/**
 * Chapter 1, inside a shop: a small room drawn over the street (which waits
 * behind it). Everything comes from the simulation's shop view; taps go back
 * to it (a person: talk to them; the floor: walk there). The HUD scene stays
 * on top for the reply buttons.
 */
export class ShopScene extends Phaser.Scene {
  private sim!: () => GameSimulation;
  private roomId = '';
  private readonly room: Phaser.GameObjects.GameObject[] = [];
  private readonly bodies = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly bubbles = new Map<string, Phaser.GameObjects.Text>();
  private fx!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.Graphics;
  private word!: Phaser.GameObjects.Text;

  constructor() {
    super(SHOP_SCENE);
  }

  init(data: { sim: () => GameSimulation }): void {
    this.sim = data.sim;
  }

  create(): void {
    this.roomId = '';
    this.room.length = 0;
    this.bodies.clear();
    this.bubbles.clear();
    this.cameras.main.setBackgroundColor('#3a2e24');
    this.fx = this.add.graphics().setDepth(1e6 - 4);
    this.dark = this.add.graphics().setDepth(5e5);
    this.word = this.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '40px', fontStyle: '800', color: '#e2513f', stroke: '#ffffff', strokeThickness: 8, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 1).setVisible(false);
    // Coming in from the bright street.
    this.cameras.main.fadeIn(280, 20, 14, 10);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const shop = this.view();
      if (!shop) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const who = this.personAt(w.x, w.y);
      if (who) return this.sim().talkTo(who);
      const at = screenToWorld({ x: w.x, y: w.y });
      this.sim().shopMoveTo(at.x, at.y);
    });
  }

  private view(): ShopView | null {
    return this.sim().street?.view().shop ?? null;
  }

  override update(): void {
    const shop = this.view();
    if (!shop) return;
    if (shop.id !== this.roomId) this.build(shop);
    this.frame(shop);
    this.sync(shop);
  }

  /** The camera fits the whole room, whatever the screen. */
  private frame(shop: ShopView): void {
    const cam = this.cameras.main;
    const l = worldToScreen({ x: 0, y: shop.h }).x, r = worldToScreen({ x: shop.w, y: 0 }).x;
    const t = worldToScreen({ x: 0, y: 0 }).y - 200, b = worldToScreen({ x: shop.w, y: shop.h }).y + 90;
    const zoom = Math.min(1.6, Math.min(this.scale.width / (r - l), this.scale.height / (b - t)) * 0.9);
    cam.setZoom(zoom).centerOn((l + r) / 2, (t + b) / 2);
  }

  /** Floor, back walls with the shop's name, the doorway, and the furniture (each piece sorted on its own). */
  private build(shop: ShopView): void {
    for (const o of this.room.splice(0)) o.destroy();
    for (const g of this.bodies.values()) g.destroy();
    this.bodies.clear();
    this.roomId = shop.id;
    const st = ROOM_STYLE[shop.id] ?? ROOM_STYLE.pho!;
    const floor = this.add.graphics().setDepth(-10);
    for (let y = 0; y < shop.h; y++) for (let x = 0; x < shop.w; x++) face(floor, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], st.floor[(x + y) % 2]!, 1, 1);
    // Back walls (left and far side), a window and the menu board.
    block(floor, { x: 0, y: -0.15, w: shop.w, h: 0.15 }, 0, 150, st.wall, 2.5);
    block(floor, { x: -0.15, y: 0, w: 0.15, h: shop.h }, 0, 150, st.wall, 2.5);
    block(floor, { x: 0, y: -0.17, w: shop.w, h: 0.17 }, 0, 14, st.trim, 2);
    face(floor, [[-0.15, 1, 60], [-0.15, 2.4, 60], [-0.15, 2.4, 120], [-0.15, 1, 120]], 0xbfe6f5, 1, 2.5);
    face(floor, [[shop.w - 2.6, -0.15, 70], [shop.w - 0.6, -0.15, 70], [shop.w - 0.6, -0.15, 120], [shop.w - 2.6, -0.15, 120]], 0x3a3340, 1, 2.5);
    for (let i = 0; i < 3; i++) { const q = point(shop.w - 2.3 + i * .6, -0.15, 100 - i * 8); floor.fillStyle(0xffffff).fillRect(q.x - 10, q.y, 26, 3); }
    // The doorway in the front edge, with a mat.
    face(floor, [[shop.exitX - .6, shop.h - .15], [shop.exitX + .6, shop.h - .15], [shop.exitX + .6, shop.h + .35], [shop.exitX - .6, shop.h + .35]], 0x8a5a3a, 1, 2);
    this.room.push(floor);
    const sign = point(shop.w / 2, -0.15, 165);
    this.room.push(this.add.text(sign.x, sign.y, shop.name, { fontFamily: "'Baloo 2', sans-serif", fontSize: '26px', fontStyle: '800', color: '#ffffff', backgroundColor: '#' + st.trim.toString(16).padStart(6, '0'), padding: { x: 14, y: 4 }, resolution: 2 }).setOrigin(.5, 1).setDepth(-9));
    const exit = point(shop.exitX, shop.h + .35);
    this.room.push(this.add.text(exit.x, exit.y + 6, 'Lối ra ▼', { fontFamily: "'Baloo 2', sans-serif", fontSize: '18px', fontStyle: '800', color: '#ffffff', backgroundColor: '#5a3825', padding: { x: 10, y: 2 }, resolution: 2 }).setOrigin(.5, 0).setDepth(1e6 - 5));
    for (const f of shop.furniture) {
      const g = this.add.graphics().setDepth(footprintDepth(f));
      furniture(g, f);
      this.room.push(g);
    }
  }

  private body(id: string, look: string): Phaser.GameObjects.Graphics {
    let g = this.bodies.get(id);
    if (!g) {
      g = this.add.graphics();
      person(g, look);
      this.bodies.set(id, g);
    }
    return g;
  }

  /** People, the hero, bubbles, and the shop's gag. */
  private sync(shop: ShopView): void {
    const now = this.time.now, e = shop.effect;
    const spot = e?.kind === 'spotlight' && e.t < .85;
    const said = new Set<string>();
    for (const n of shop.npcs) {
      const g = this.body(n.id, n.look), p = worldToScreen(n);
      // In the spotlight, the whole shop turns to stare at the hero.
      const dir = spot ? (shop.hero.x - shop.hero.y >= n.x - n.y ? 1 : -1) : n.dir;
      g.setPosition(p.x, p.y).setScale(dir < 0 ? -1 : 1, 1).setDepth(actorDepth(n));
      if (n.say) { said.add(n.id); this.bubble(n.id, n.say, n, false); }
    }
    const hero = this.body('hero', 'hero'), hp = worldToScreen(shop.hero);
    const bob = shop.hero.moving ? -Math.abs(Math.sin(now / 90)) * 3 : 0;
    hero.setPosition(hp.x, hp.y + bob).setScale(shop.hero.dir < 0 ? -1 : 1, 1).setDepth(spot ? 5e5 + 1 : actorDepth(shop.hero));
    if (shop.heroSay) { said.add('hero'); this.bubble('hero', shop.heroSay, shop.hero, true); }
    for (const [id, b] of this.bubbles) if (!said.has(id)) { b.destroy(); this.bubbles.delete(id); }

    this.fx.clear();
    this.dark.clear();
    this.word.setVisible(false);
    if (!e) return;
    const v = this.cameras.main.worldView;
    if (e.kind === 'spotlight' && spot) {
      // Lights out but one: a pool of light on the hero, everyone else in the dark.
      this.dark.fillStyle(0x0b0812, .72).fillRect(v.x - 50, v.y - 50, v.width + 100, v.height + 100);
      this.dark.fillStyle(0xfff3b0, .35).fillEllipse(hp.x, hp.y, 110, 46).fillTriangle(hp.x - 20, v.y - 50, hp.x + 20, v.y - 50, hp.x + 60, hp.y).fillTriangle(hp.x - 20, v.y - 50, hp.x - 60, hp.y, hp.x + 60, hp.y);
      this.word.setText('…').setPosition(hp.x, hp.y - 120).setVisible(true);
    }
    if (e.kind === 'sneeze' && e.t > .12 && e.t < .7) {
      this.word.setText('HẮT XÌ!!!').setPosition(hp.x, hp.y - 120).setScale(1 + Math.sin(Math.min(1, (e.t - .12) * 6) * Math.PI) * .25).setVisible(true);
      // The regular's hat flies off, spinning.
      const mu = shop.npcs.find((n) => n.look === 'old');
      if (mu) { const q = worldToScreen(mu), k = Math.min(1, (e.t - .12) / .5); oval(this.fx, q.x + k * 40, q.y - 64 - Math.sin(k * Math.PI) * 140, 26 * Math.abs(Math.cos(now / 80)) + 4, 10, 0x8a5a3a); }
    }
  }

  private personAt(x: number, y: number): string | null {
    let best: { id: string; depth: number } | null = null;
    for (const [id, g] of this.bodies) {
      if (id === 'hero') continue;
      if (x < g.x - 22 || x > g.x + 22 || y < g.y - 74 || y > g.y + 6) continue;
      if (!best || g.depth > best.depth) best = { id, depth: g.depth };
    }
    return best?.id ?? null;
  }

  private bubble(id: string, text: string, at: { x: number; y: number }, hero: boolean): void {
    let b = this.bubbles.get(id);
    if (!b) {
      b = this.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '17px', fontStyle: '700', color: hero ? '#ffffff' : '#5a3825', backgroundColor: hero ? '#ff7f6b' : '#fffaf0', padding: { x: 10, y: 4 }, align: 'center', wordWrap: { width: 240 }, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 2);
      this.bubbles.set(id, b);
    }
    if (b.text !== text) b.setText(text);
    const p = worldToScreen(at);
    b.setScale(Math.max(1, 1 / this.cameras.main.zoom)).setPosition(p.x, p.y - 82);
  }
}

/** One piece of shop furniture, by kind. */
function furniture(g: Phaser.GameObjects.Graphics, f: ShopView['furniture'][number]): void {
  const c = point(f.x + f.w / 2, f.y + f.h / 2);
  switch (f.kind) {
    case 'pot':
      block(g, f, 0, 34, 0x8a5a3a, 2.5);
      dot(g, c.x - 18, c.y - 52, 22, 0x9aa1ad);
      g.fillStyle(0xf6d77a).fillEllipse(c.x - 18, c.y - 64, 34, 12);
      for (let i = 0; i < 3; i++) g.lineStyle(3, 0xffffff, .7).lineBetween(c.x - 28 + i * 10, c.y - 74, c.x - 24 + i * 10, c.y - 96);
      for (let i = 0; i < 4; i++) dot(g, c.x + 14 + (i % 2) * 14, c.y - 40 - Math.floor(i / 2) * 6, 7, 0xfff6e5);
      return;
    case 'counter':
      block(g, f, 0, 36, 0x8a5a3a, 2.5);
      for (let i = 0; i < 3; i++) rr(g, c.x - 30 + i * 22, c.y - 52, 14, 14, 3, [0xffd25e, 0xff8a73, 0x9ad67c][i]!);
      return;
    case 'mat':
      shadow(g, c.x, c.y, 120, 40);
      block(g, f, 0, 4, 0x9ad67c, 2);
      for (let i = 0; i < 3; i++) dot(g, c.x - 24 + i * 24, c.y - 8, 8, 0xfff6e5);
      return;
    default:
      // A low table with bowls, and red plastic stools either side.
      for (const [dx, dy] of [[-.35, f.h / 2], [f.w + .35, f.h / 2]] as const) block(g, { x: f.x + dx - .15, y: f.y + dy - .15, w: .3, h: .3 }, 0, 14, 0xe2513f, 1.5);
      block(g, f, 16, 8, 0xc98a55, 2);
      for (let i = 0; i < 2; i++) dot(g, c.x - 12 + i * 24, c.y - 30, 7, 0xffffff);
      g.lineStyle(2, INK).strokeCircle(c.x - 12, c.y - 30, 7);
  }
}
