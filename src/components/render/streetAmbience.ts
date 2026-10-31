import Phaser from 'phaser';
import { dur, MOTION } from '../../ui/theme/tokens';

/** Canopy centres of the big street trees painted into the background (world pixels) and the rough half-size of each canopy. */
const TREES = [{ x: -53, y: 841 }, { x: 73, y: 1075 }, { x: -81, y: 1138 }, { x: 39, y: 1241 }, { x: 1159, y: 1361 }];
const CANOPY = { rx: 110, ry: 60 };
/** The part of the painted street that is played on. */
const AREA = { x: 1200, y: 1000, w: 7200, h: 2600 };
const LEAVES = 14;
const DEPTH = 8e5;
const LEAF_TINTS = [0x7fae3a, 0x9bc24a, 0xc2c64a, 0xd9b84a, 0x5f9a3a];

interface Leaf { img: Phaser.GameObjects.Image; t: number; life: number; vx: number; vy: number; phase: number; spin: number; sway: number }

/**
 * Cheap life for the painted street, with no art files (all drawn once to tiny canvases): cloud shadows drifting across it, light
 * that slowly breathes, and leaves falling from the big trees. A fixed handful of objects, so the cost is a few draw calls and
 * a loop over 14 leaves, and only while a tree is in view.
 */
export class StreetAmbience {
  private readonly leaves: Leaf[] = [];
  private readonly still = dur(MOTION.base) === 0;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.cloudTexture(); this.leafTexture();
    const clouds = scene.add.image(AREA.x, AREA.y, 'ambient.cloud').setDisplaySize(AREA.w, AREA.h).setDepth(DEPTH).setAlpha(.2);
    // Warm sun that swells and fades over half a minute; additive, so it only ever brightens.
    const light = scene.add.rectangle(AREA.x, AREA.y, AREA.w, AREA.h, 0xffe2a8).setDepth(DEPTH + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.035);
    this.objects.push(clouds, light);
    if (this.still) return;
    this.tweens.push(
      scene.tweens.add({ targets: clouds, x: AREA.x + 700, duration: 80000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      scene.tweens.add({ targets: light, alpha: .075, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    );
    for (let i = 0; i < LEAVES; i++) {
      const img = scene.add.image(0, 0, 'ambient.leaf').setDepth(DEPTH - 1).setVisible(false);
      this.objects.push(img);
      this.leaves.push({ img, t: 0, life: 0, vx: 0, vy: 0, phase: 0, spin: 0, sway: 0 });
    }
  }

  /** Soft dark blobs: stretched over the whole street they read as the shadows of passing clouds. */
  private cloudTexture(): void {
    if (this.scene.textures.exists('ambient.cloud')) return;
    const tex = this.scene.textures.createCanvas('ambient.cloud', 256, 128);
    if (!tex) return;
    const ctx = tex.context;
    for (const [x, y, r, a] of [[50, 40, 46, .9], [120, 78, 52, .8], [190, 36, 40, .85], [225, 96, 34, .6], [20, 100, 30, .55], [150, 20, 28, .5]] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(18,28,52,${a})`); g.addColorStop(1, 'rgba(18,28,52,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
    }
    tex.refresh();
  }

  private leafTexture(): void {
    if (this.scene.textures.exists('ambient.leaf')) return;
    const tex = this.scene.textures.createCanvas('ambient.leaf', 16, 10);
    if (!tex) return;
    const ctx = tex.context;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(8, 5, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(14, 5); ctx.stroke();
    tex.refresh();
  }

  private respawn(leaf: Leaf, trees: typeof TREES): void {
    const tree = trees[Math.floor(Math.random() * trees.length)]!;
    leaf.t = 0;
    leaf.life = 6000 + Math.random() * 4000;
    leaf.vx = 8 + Math.random() * 14;
    leaf.vy = 22 + Math.random() * 16;
    leaf.phase = Math.random() * 6.28;
    leaf.spin = (Math.random() - .5) * 3;
    leaf.sway = 10 + Math.random() * 14;
    const x = tree.x + (Math.random() * 2 - 1) * CANOPY.rx, y = tree.y + (Math.random() * 2 - 1) * CANOPY.ry;
    leaf.img.setPosition(x, y).setTint(LEAF_TINTS[Math.floor(Math.random() * LEAF_TINTS.length)]!).setScale(.8 + Math.random() * .7).setAlpha(0).setVisible(true);
    leaf.img.setData('x0', x).setData('y0', y);
  }

  /** Every frame; `dtMs` is the frame time. Leaves only fall while a tree is on screen. */
  update(dtMs: number): void {
    if (!this.leaves.length) return;
    const view = this.scene.cameras.main.worldView;
    const near = TREES.filter(t => t.x + 220 > view.x && t.x - 220 < view.right && t.y + 160 > view.y && t.y - 160 < view.bottom);
    for (const leaf of this.leaves) {
      if (leaf.life === 0 || leaf.t >= leaf.life) {
        // A finished leaf waits for a tree to come into view; the few that were mid-air simply fade out with it.
        if (!near.length) { leaf.img.setVisible(false); leaf.life = 0; continue; }
        this.respawn(leaf, near);
      }
      leaf.t += dtMs;
      const s = leaf.t / 1000, k = leaf.t / leaf.life;
      leaf.img.setPosition(
        (leaf.img.getData('x0') as number) + leaf.vx * s + Math.sin(leaf.phase + s * 2.2) * leaf.sway,
        (leaf.img.getData('y0') as number) + leaf.vy * s,
      ).setRotation(leaf.phase + leaf.spin * s).setAlpha(Math.min(1, k * 8, (1 - k) * 4) * .9);
    }
  }

  destroy(): void {
    for (const t of this.tweens) t.remove();
    for (const o of this.objects) o.destroy();
    this.leaves.length = 0;
    this.objects.length = 0;
  }
}
