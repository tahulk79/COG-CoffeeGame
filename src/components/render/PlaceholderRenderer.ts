import Phaser from 'phaser';
import { H5_ASSETS, HERO_FACINGS, plotAnchorY, worldSprite, terrainFrame, addTerrainTile, terrainRepeat } from './h5Assets';
import { STORY_ASSETS } from './storyAssets';
import { drawForestEnvironment, STONE_COLORS } from './forestArt';
import { drawIncidentEnvironment, drawIncidentObject, IncidentActorView, addIncidentRain } from './incidentArt';
import { actorDepth, floorDepth, footprintDepth, worldToScreen, type ScreenPos } from '../../utils/iso';
import type { Footprint, TilePos, WorldPos } from '../../utils/tile';
import { DEFAULT_STYLE, FEEDBACK_COLORS, PLACEHOLDER_STYLES, PLACEHOLDER_VARIANTS, PLAYER_COLOR, TERRAIN_COLORS } from './placeholderStyles';
import type { ActorView, ActorViewState, FeedbackKind, FloorTileView, ObjectViewData, ObjectVisual, PlacementPreview, WorldRenderer } from './WorldRenderer';
import { debugFlags } from '../../ui/theme/debugFlags';
import { createIcon } from '../../ui/theme/assetRegistry';
import { COLORS, css, dur, FONT, MOTION } from '../../ui/theme/tokens';

const shade = (c: number, f: number): number => {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
};

const v = (p: ScreenPos, dy = 0) => new Phaser.Math.Vector2(p.x, p.y - dy);

/** Draws an extruded isometric box over a footprint. Light from upper-left (ART_BIBLE §4). */
function drawBox(g: Phaser.GameObjects.Graphics, f: Footprint, color: number, height: number): void {
  const top = worldToScreen({ x: f.x, y: f.y });
  const right = worldToScreen({ x: f.x + f.w, y: f.y });
  const bottom = worldToScreen({ x: f.x + f.w, y: f.y + f.h });
  const left = worldToScreen({ x: f.x, y: f.y + f.h });
  if (height > 0) {
    g.fillStyle(shade(color, 0.8), 1);
    g.fillPoints([v(left), v(bottom), v(bottom, height), v(left, height)], true);
    g.fillStyle(shade(color, 0.62), 1);
    g.fillPoints([v(bottom), v(right), v(right, height), v(bottom, height)], true);
  }
  g.fillStyle(color, 1);
  g.fillPoints([v(top, height), v(right, height), v(bottom, height), v(left, height)], true);
  g.lineStyle(1, shade(color, 0.45), 0.8);
  g.strokePoints([v(top, height), v(right, height), v(bottom, height), v(left, height)], true);
}

/** Redraw only when something visible changes (progress quantised to 2%). */
const visualKey = (v: ObjectVisual): string =>
  [v.variant, v.caption ?? '', v.progress == null ? '' : Math.round(v.progress * 50)].join('|');

interface ObjectEntry {
  sprite?: Phaser.GameObjects.Image;
  /** Padlock on a plot that is not bought yet. */
  lock?: Phaser.GameObjects.Image;
  data: ObjectViewData;
  depth: number;
  box: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  outline: Phaser.Geom.Polygon;
  height?: number;
  visualKey: string;
  /** Showing state (growth %, machine progress) rather than just a name: always visible. */
  captioned: boolean;
  focused: boolean;
  glowed: boolean;
}

const NPC_TINTS = [0xc9e2ff, 0xffd0da, 0xd3f3cd, 0xe2d2ff, 0xffe2b8];

class PlaceholderActorView implements ActorView {
  depth = 0;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly body: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
  private readonly nose: Phaser.GameObjects.Arc;
  private readonly held: Phaser.GameObjects.Container;
  private readonly heldLabel: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly barBg: Phaser.GameObjects.Graphics;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleBg: Phaser.GameObjects.Graphics;
  private readonly bubbleText: Phaser.GameObjects.Text;
  private readonly bubbleIcon: Phaser.GameObjects.Container;
  private heldKind = '';
  private bubbleKey = '';
  private bubbleW = 60;
  private ringTween: Phaser.Tweens.Tween | null = null;
  private barKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    color: number,
    private readonly spriteMode = false,
    npcTint?: number,
    private readonly master = false,
  ) {
    this.shadow = scene.add.ellipse(0, 0, 44, 20, 0x000000, 0.25);
    this.ring = scene.add.ellipse(0, 0, 58, 28).setStrokeStyle(3, COLORS.gold, 1).setVisible(false);
    this.body = spriteMode ? (master && scene.textures.exists(H5_ASSETS.extra.key) ? scene.add.sprite(0, 0, H5_ASSETS.extra.key, '11').setOrigin(.5,.9).setDisplaySize(96, 96) : scene.add.sprite(0, 0, H5_ASSETS.hero.key, '8').setOrigin(.5,.9).setDisplaySize(npcTint ? 76 : 88, npcTint ? 76 : 88).setTint(npcTint ?? 0xffffff)) : scene.add.circle(0, 0, 18, color).setStrokeStyle(2, shade(color, 0.5));
    this.nose = scene.add.circle(0, 0, 5, 0xffffff);
    this.held = createIcon(scene, 'cup', 32);
    this.heldLabel = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: '13px', fontStyle: 'bold', color: css(COLORS.cream), backgroundColor: '#234332ee', padding: { x: 6, y: 3 } }).setOrigin(0.5, 1).setResolution(2);
    this.label = scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5, 0);
    this.barBg = scene.add.graphics();
    this.bubbleBg = scene.add.graphics();
    this.bubbleText = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: '12px', color: css(COLORS.espresso), fontStyle: 'bold' }).setOrigin(0, 0.5).setResolution(2);
    this.bubbleIcon = createIcon(scene, 'cup', 16);
    this.bubble = scene.add.container(0, 0, [this.bubbleBg, this.bubbleIcon, this.bubbleText]).setVisible(false);
  }

  update(s: ActorViewState): void {
    const p = worldToScreen(s.pos);
    const d = actorDepth(s.pos);
    this.depth = d;
    this.shadow.setPosition(p.x, p.y).setDepth(d);
    const hl = !!s.highlight;
    this.ring.setVisible(hl).setPosition(p.x, p.y).setDepth(d + 0.005);
    if (hl && !this.ringTween && dur(MOTION.slow) > 0) {
      this.ringTween = this.scene.tweens.add({ targets: this.ring, alpha: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (!hl && this.ringTween) {
      this.ringTween.stop();
      this.ringTween = null;
      this.ring.setAlpha(1);
    }
    this.body.setPosition(p.x, p.y + (this.spriteMode ? 3 : -22)).setDepth(d + 0.01);
    if (this.body instanceof Phaser.GameObjects.Sprite && !this.master) {
      const direction = Math.max(0, HERO_FACINGS.indexOf(s.facing));
      const step = s.state === 'MOVING' && dur(MOTION.slow) > 0 ? Math.floor(this.scene.time.now / 160) % 2 : 0;
      this.body.setFrame(String(direction * 2 + step));
    }
    // Facing marker: project a short grid-space vector to screen.
    const dir: Record<string, [number, number]> = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
    const [fx, fy] = dir[s.facing]!;
    const len = Math.hypot(fx, fy);
    const tip = worldToScreen({ x: s.pos.x + (fx / len) * 0.18, y: s.pos.y + (fy / len) * 0.18 });
    this.nose.setVisible(!this.spriteMode).setPosition(tip.x, tip.y - 22).setDepth(d + 0.02);
    if (s.heldItem && this.heldKind !== (s.heldItem === 'Mèo con' ? 'cat' : 'cup')) {
      this.heldKind = s.heldItem === 'Mèo con' ? 'cat' : 'cup';
      this.held.removeAll(true);
      if (this.heldKind === 'cat' && this.scene.textures.exists(H5_ASSETS.extra.key)) this.held.add(this.scene.add.image(0,0,H5_ASSETS.extra.key,'4').setDisplaySize(40,40));
      else this.held.add(createIcon(this.scene,'cup',32));
    }
    this.held.setVisible(s.heldItem !== null).setPosition(p.x + 24, p.y - 32).setDepth(1e6 - 1);
    this.heldLabel.setVisible(s.heldItem !== null).setPosition(p.x, p.y - 74).setDepth(1e6 - .9);
    if (s.heldItem !== null && this.heldLabel.text !== `✓ ${s.heldItem}`) this.heldLabel.setText(`✓ ${s.heldItem}`);
    // Technical state names are developer information: shown only in the debug overlay.
    this.label.setVisible(debugFlags.enabled).setPosition(p.x, p.y + 8).setDepth(d + 0.03);
    if (debugFlags.enabled && this.label.text !== s.state) this.label.setText(s.state);
    this.drawProgress(s.progress, p.x, p.y - (this.spriteMode ? 98 : 74), d + 0.04);
    this.drawBubble(s.bubble ?? null, s.bubbleTone ?? 'neutral', p.x, p.y - (this.spriteMode ? 106 : 82), d + 0.06);
  }

  /** Progress / patience pill above the head. Redrawn only when it visibly changes. */
  private drawProgress(progress: number | null, x: number, y: number, depth: number): void {
    if (progress === null) {
      if (this.barKey !== '') this.barBg.clear();
      this.barKey = '';
      return;
    }
    const p = Math.max(0, Math.min(1, progress));
    const key = `${Math.round(x)}|${Math.round(y)}|${Math.round(p * 40)}`;
    if (key === this.barKey) return;
    this.barKey = key;
    const g = this.barBg.setDepth(depth).clear();
    const color = p > 0.5 ? COLORS.leaf : p > 0.25 ? COLORS.gold : COLORS.error;
    g.fillStyle(COLORS.espresso, 0.85).fillRoundedRect(x - 26, y - 4, 52, 8, 4);
    g.fillStyle(color, 1).fillRoundedRect(x - 25, y - 3, Math.max(6, 50 * p), 6, 3);
  }

  private drawBubble(text: string | null, tone: 'neutral' | 'ready' | 'urgent', x: number, y: number, depth: number): void {
    if (text === null) {
      this.bubble.setVisible(false);
      this.bubbleKey = '';
      return;
    }
    const key = `${text}|${tone}`;
    if (key !== this.bubbleKey) {
      const appearing = this.bubbleKey === '';
      this.bubbleKey = key;
      this.bubbleText.setText(text);
      const w = Math.ceil(this.bubbleText.width) + 34;
      this.bubbleW = w;
      const accent = tone === 'ready' ? COLORS.leaf : tone === 'urgent' ? COLORS.error : COLORS.caramel;
      const g = this.bubbleBg.clear();
      g.fillStyle(COLORS.shadow, 0.25).fillRoundedRect(-w / 2 + 1, -13, w, 28, 12);
      g.fillStyle(COLORS.cream, 1).fillRoundedRect(-w / 2, -15, w, 28, 12);
      g.lineStyle(2, accent, 1).strokeRoundedRect(-w / 2, -15, w, 28, 12);
      g.fillStyle(COLORS.cream, 1).fillTriangle(-6, 12, 6, 12, 0, 20);
      this.bubbleIcon.setPosition(-w / 2 + 14, -1);
      this.bubbleText.setPosition(-w / 2 + 26, -1);
      if (appearing && dur(MOTION.base) > 0) {
        this.scene.tweens.killTweensOf(this.bubble);
        this.bubble.setScale(0.6);
        this.scene.tweens.add({ targets: this.bubble, scale: 1, duration: MOTION.base, ease: 'Back.easeOut' });
      }
    }
    this.bubble.setVisible(true).setPosition(x, y).setDepth(depth);
  }

  hitTest(px: number, py: number): boolean {
    if (this.spriteMode ? Math.abs(px-this.body.x)<27 && py>this.body.y-76 && py<this.body.y+5 : Math.hypot(px - this.body.x, py - this.body.y) <= 22) return true;
    // The bubble is clickable too (it belongs to the customer), but only while shown.
    return this.bubble.visible && Math.abs(px - this.bubble.x) <= this.bubbleW / 2 && Math.abs(py - this.bubble.y) <= 16;
  }

  destroy(): void {
    this.ringTween?.stop();
    for (const o of [this.shadow, this.ring, this.body, this.nose, this.held, this.heldLabel, this.label, this.barBg, this.bubble]) o.destroy();
  }
}

/** Geometric placeholder implementation of WorldRenderer (M1–M12 gameplay phase). */
export class PlaceholderRenderer implements WorldRenderer {
  private readonly objectGfx = new Map<string, ObjectEntry>();
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly path: Phaser.GameObjects.Graphics;
  private readonly hover: Phaser.GameObjects.Graphics;
  private readonly decorArea: Phaser.GameObjects.Graphics;
  private readonly ghost: Phaser.GameObjects.Graphics;
  private readonly ghostLabel: Phaser.GameObjects.Text;
  private ghostKey = '';
  private bounds = { w: 1, h: 1 };

  constructor(private readonly scene: Phaser.Scene) {
    this.glowGfx = scene.add.graphics().setDepth(1e6 - 2);
    this.path = scene.add.graphics().setDepth(floorDepth + 2);
    this.hover = scene.add.graphics().setDepth(floorDepth + 1);
    this.highlight = scene.add.graphics().setDepth(1e6);
    this.decorArea = scene.add.graphics().setDepth(floorDepth + 0.5);
    // The ghost is drawn over everything so it is never hidden behind the object it collides with.
    this.ghost = scene.add.graphics().setDepth(1e6 - 1).setAlpha(0.6);
    this.ghostLabel = scene.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(1e6 - 1)
      .setVisible(false);
  }

  /**
   * Extends the map's own floor to the edge of the screen (an endless checkered ground in the
   * map's dominant terrain colour), so the view never shows black around the map: you are
   * "inside" the farm or café, not looking at a model of it.
   */
  private buildBackdrop(floor: FloorTileView[]): void {
    if (this.streetScene || this.forestScene) {
      this.indoor = false;
      this.scene.cameras.main.setBackgroundColor(0x142735);
      const background=terrainRepeat(this.scene,this.forestScene?14:4);
      if(background)this.scene.add.tileSprite(-6400,-3200,12800,6400,background).setOrigin(0).setTilePosition(64,0).setDepth(floorDepth-1).setTint(this.forestScene?0x8da189:0x9caeba);
      else this.scene.add.graphics().setDepth(floorDepth - 1).fillStyle(0x142735).fillRect(-6400, -3200, 12800, 6400);
      return;
    }
    const count = new Map<string, number>();
    for (const t of floor) if (t.walkable) count.set(t.kind, (count.get(t.kind) ?? 0) + 1);
    const kind = this.streetScene ? 'sidewalk' : [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'floor';
    const top = (TERRAIN_COLORS[kind] ?? TERRAIN_COLORS.floor!).top;
    const a = shade(top, 1);
    const b = shade(top, 0.94);
    // One 128×64 cell of the iso checkerboard: tile A diamond in the middle, quarters of B in the corners.
    const key = terrainRepeat(this.scene,kind==='grass'?14:0) ?? `ui-ground2:${a}:${b}`;
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      const diamond = (cx: number, cy: number, fill: number): void => {
        const pts = [new Phaser.Math.Vector2(cx, cy - 32), new Phaser.Math.Vector2(cx + 64, cy), new Phaser.Math.Vector2(cx, cy + 32), new Phaser.Math.Vector2(cx - 64, cy)];
        g.fillStyle(fill, 1).fillPoints(pts, true);
        // Same outline as the map's own floor tiles, so the join is invisible.
        g.lineStyle(1, shade(fill, 0.45), this.streetScene ? 0.1 : 0.8).strokePoints(pts, true);
      };
      g.fillStyle(b, 1).fillRect(0, 0, 128, 64);
      for (const [cx, cy] of [[0, 0], [128, 0], [0, 64], [128, 64]] as const) diamond(cx, cy, b);
      diamond(64, 32, a);
      g.generateTexture(key, 128, 64);
      g.destroy();
    }
    const W = 12800;
    const H = 6400;
    this.scene.add.tileSprite(-W / 2, -H / 2, W, H, key).setOrigin(0, 0).setTilePosition(64, 0).setDepth(floorDepth - 1);
    this.scene.cameras.main.setBackgroundColor(shade(top, 0.9));
    this.indoor = kind === 'floor';
    if (this.indoor) {
      // Indoor rooms are drawn as a cutaway: only the two back walls stand; beyond them the wall continues
      // (a panelled backdrop) instead of showing ground, and the front is open so the floor runs off-screen.
      const tx = worldToScreen({ x: 0, y: 0 });
      const far = 9000;
      const wall = this.scene.add.graphics().setDepth(floorDepth - 0.5);
      wall.fillStyle(0x6f5037, 1).fillPoints([new Phaser.Math.Vector2(tx.x - far, tx.y + far / 2), new Phaser.Math.Vector2(tx.x, tx.y), new Phaser.Math.Vector2(tx.x + far, tx.y + far / 2), new Phaser.Math.Vector2(tx.x + far, tx.y - far), new Phaser.Math.Vector2(tx.x - far, tx.y - far)], true);
    }
  }

  private indoor = false;
  private streetScene = false;
  private forestScene = false;

  buildWorld(floor: FloorTileView[], objects: ObjectViewData[]): void {
    this.streetScene = floor.some((t) => t.kind === 'sidewalk');
    this.forestScene = floor.some((t) => t.kind === 'forest_path');
    this.buildBackdrop(floor);
    const ground = this.scene.add.graphics().setDepth(floorDepth);
    const walkable = new Set(floor.filter((t) => t.walkable).map((t) => `${t.tile.x},${t.tile.y}`));
    for (const t of floor) {
      const style = TERRAIN_COLORS[t.kind] ?? TERRAIN_COLORS.floor!;
      const f = { x: t.tile.x, y: t.tile.y, w: 1, h: 1 };
      if (style.height > 0) {
        // Cutaway: a wall with walkable space north or west of it stands between that space and
        // the camera (isometric view looks from the south-east), so it stays low and never hides actors.
        const front = walkable.has(`${t.tile.x},${t.tile.y - 1}`) || walkable.has(`${t.tile.x - 1},${t.tile.y}`);
        // Indoor: the front walls are cut away completely; outdoors they stay as a low fence.
        if (front && this.indoor) continue;
        drawBox(this.scene.add.graphics().setDepth(footprintDepth(f)), f, this.indoor ? style.top : 0x6b4a2d, front ? 8 : this.indoor ? style.height : 30);
      } else {
        if (this.scene.textures.exists(H5_ASSETS.terrain.key)) {
          if(this.forestScene)continue;
          const frame=terrainFrame(t.kind,t.tile.x,t.tile.y);
          if(frame!==null){addTerrainTile(this.scene,t.tile.x,t.tile.y,frame,floorDepth+.01);continue;}
        }
        const checker = (t.tile.x + t.tile.y) % 2 === 0 ? 1 : 0.94;
        if (this.streetScene) {
          const pts = [{x:f.x,y:f.y},{x:f.x+1,y:f.y},{x:f.x+1,y:f.y+1},{x:f.x,y:f.y+1}].map((p) => v(worldToScreen(p)));
          ground.fillStyle(shade(style.top, checker === 1 ? 1 : .98)).fillPoints(pts, true);
          if (t.kind === 'sidewalk') ground.lineStyle(1, 0x344959, .2).strokePoints(pts, true);
        } else drawBox(ground, f, shade(style.top, checker), 0);
      }
    }
    if (this.streetScene) { drawIncidentEnvironment(this.scene, floor); if (dur(MOTION.slow) > 0) addIncidentRain(this.scene); }
    if (this.forestScene) drawForestEnvironment(this.scene);
    for (const o of objects) this.addObject(o);
  }

  addObject(o: ObjectViewData): void {
    const depth = footprintDepth(o.footprint);
    const entry: ObjectEntry = {
      data: o,
      depth,
      box: this.scene.add.graphics().setDepth(depth),
      label: this.scene.add
        .text(0, 0, '', { fontFamily: FONT.family, fontSize: '12px', color: '#fff0d8', backgroundColor: '#17303bda', padding: { x: 4, y: 2 }, resolution: 2 })
        .setOrigin(0.5, 1)
        .setDepth(depth + 0.05),
      bar: this.scene.add.graphics().setDepth(depth + 0.06),
      outline: new Phaser.Geom.Polygon([]),
      visualKey: '',
      captioned: false,
      focused: false,
      glowed: false,
    };
    this.objectGfx.set(o.id, entry);
    this.drawObject(entry, { variant: 'default' });
  }

  /** Bought plots get a clear edge; plots still for sale are dimmed with a padlock, so the two can't be confused. */
  private decoratePlot(e: ObjectEntry, c: ScreenPos, locked: boolean): void {
    const f = e.data.footprint;
    const pts = [worldToScreen({ x: f.x, y: f.y }), worldToScreen({ x: f.x + f.w, y: f.y }), worldToScreen({ x: f.x + f.w, y: f.y + f.h }), worldToScreen({ x: f.x, y: f.y + f.h })].map((p) => v(p));
    e.box.lineStyle(2, COLORS.cream, locked ? 0.22 : 0.6).strokePoints(pts, true);
    if (locked && this.scene.textures.exists(H5_ASSETS.icons.key)) {
      e.lock ??= this.scene.add.image(0, 0, H5_ASSETS.icons.key, '14').setDisplaySize(30, 30).setDepth(e.depth + 0.02);
      e.lock.setPosition(c.x, c.y - 24).setVisible(true);
    } else e.lock?.setVisible(false);
  }

  setObjectVisual(id: string, visual: ObjectVisual): void {
    const e = this.objectGfx.get(id);
    if (!e) return;
    if (visualKey(visual) === e.visualKey) return; // nothing visible changed
    this.drawObject(e, visual);
  }

  private drawObject(e: ObjectEntry, visual: ObjectVisual): void {
    const o = e.data;
    const base = PLACEHOLDER_VARIANTS[o.type]?.[visual.variant] ?? PLACEHOLDER_STYLES[o.type] ?? DEFAULT_STYLE;
    const tableLevel = visual.variant.startsWith('tableLevel') ? Number(visual.variant.slice(10)) : 1;
    const style = tableLevel > 1 ? { color: [0, 0, 0x9e7750, 0x72968a, 0xceb36a][tableLevel] ?? base.color, height: base.height + (tableLevel - 1) * 3 } : base;
    const f = o.footprint;
    const h = this.forestScene && o.type === 'portal' ? 230 : this.forestScene && o.type === 'sense_stone' ? 110 : style.height;
    e.box.clear();
    const asset = (this.forestScene ? o.type === 'portal' ? STORY_ASSETS.portal : o.type === 'sense_stone' ? STORY_ASSETS.stone : o.type === 'tree' ? STORY_ASSETS.trees : null : null) ?? worldSprite(o.type, visual.variant);
    if (asset && this.scene.textures.exists(asset.key)) {
      const p = worldToScreen({x:f.x+f.w/2,y:f.y+f.h/2});
      const frame = 'frame' in asset ? asset.frame : undefined;
      e.sprite ??= this.scene.add.image(p.x,p.y,asset.key,frame).setOrigin(.5,.88).setDepth(e.depth-.01);
      e.sprite.setTexture(asset.key,frame);
      const size = this.forestScene ? o.type === 'portal' ? 300 : o.type === 'tree' ? 220 : 145 : o.type === 'pickup_point' || o.type === 'standing_spot' ? 42 : o.type === 'farmhouse' ? 260 : o.type === 'tree' ? 180 : o.type === 'chair' ? 84 : o.type === 'armchair' ? 92 : o.type === 'plant' ? 84 : (f.w+f.h)*64;
      e.sprite.setAlpha(visual.variant === 'rescued' || visual.variant === 'away' ? 0 : visual.variant === 'taken' ? .25 : visual.variant === 'locked' ? .55 : 1);
      e.sprite.setOrigin(.5, this.forestScene ? .94 : o.type === 'farm_plot' ? plotAnchorY(this.scene) : .88).setDisplaySize(size, this.forestScene && o.type === 'tree' ? 126 : size).setFlipX(o.rotation%2===1).setTint(visual.variant === 'locked' ? 0x8c8c8c : !this.forestScene || visual.variant === 'open' || visual.variant === 'ACTIVATED' ? 0xffffff : o.type === 'portal' ? 0x889ba6 : 0xb6c4ba);
      if(o.type === 'sense_stone') {
        const color=STONE_COLORS[o.id] ?? 0xb8ddc4;
        const bright=visual.variant === 'ACTIVATED' || visual.variant === 'ACTIVATING' || visual.variant === 'PLAYER_NEARBY';
        e.box.lineStyle(3,color,bright?1:.4);
        if(o.id==='stone_sight') {e.box.strokeEllipse(p.x-3,p.y-72,17,26).lineBetween(p.x-3,p.y-58,p.x-3,p.y-87).lineBetween(p.x-3,p.y-70,p.x+8,p.y-79);}
        else {e.box.beginPath();for(let i=0;i<=40;i++){const a=i/40*Math.PI*4,r=i/40*16;const x=p.x+Math.cos(a)*r,y=p.y-74+Math.sin(a)*r;if(i===0)e.box.moveTo(x,y);else e.box.lineTo(x,y);}e.box.strokePath();}
      }
    } else if (o.type === 'ancient_pillar') {
      drawBox(e.box, {x:f.x+.18,y:f.y+.18,w:.64,h:.64},0x7c8774,16);
      drawBox(e.box, {x:f.x+.32,y:f.y+.32,w:.36,h:.36},0x919980,h);
      const p=worldToScreen({x:f.x+.5,y:f.y+.5});
      e.box.fillStyle(0x57744a).fillEllipse(p.x,p.y-h,40,17);
    } else if (!drawIncidentObject(e.box, o.type, f, visual.variant === 'rescued')) drawBox(e.box, f, style.color, h);
    const c = worldToScreen({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
    // Only states that call for action (progress, ready, thirsty, done) stay on screen; names show when near/hovered.
    const lockedPlot = o.type === 'farm_plot' && visual.variant === 'locked';
    e.captioned = visual.progress != null || lockedPlot || ['ready', 'thirsty', 'done'].includes(visual.variant);
    // A plot's label sits on the plot itself (its sprite is a tall, mostly empty image).
    const labelY = o.type === 'farm_plot' ? c.y + (lockedPlot ? 8 : -14) : e.sprite ? c.y - e.sprite.displayHeight * .82 - 4 : c.y - h - 4;
    e.label.setText(visual.caption ?? o.label).setPosition(c.x, labelY).setVisible((e.focused || e.captioned) && visual.variant !== 'away');
    if (o.type === 'farm_plot') this.decoratePlot(e, c, lockedPlot);
    e.bar.clear();
    if (visual.progress != null) {
      const w = 44;
      e.bar.fillStyle(0x1b1b1b, 0.85).fillRect(c.x - w / 2, c.y - h + 2, w, 5);
      e.bar.fillStyle(0x6db55a, 1).fillRect(c.x - w / 2 + 1, c.y - h + 3, (w - 2) * Math.max(0, Math.min(1, visual.progress)), 3);
    }
    // Silhouette of the extruded box: top face corners raised by height, plus the floor corners in front.
    const top = worldToScreen({ x: f.x, y: f.y });
    const right = worldToScreen({ x: f.x + f.w, y: f.y });
    const bottom = worldToScreen({ x: f.x + f.w, y: f.y + f.h });
    const left = worldToScreen({ x: f.x, y: f.y + f.h });
    e.outline = new Phaser.Geom.Polygon([v(top, h), v(right, h), v(right), v(bottom), v(left), v(left, h)]);
    e.height = h;
    e.visualKey = visualKey(visual);
  }

  objectAtPoint(px: number, py: number): string | null {
    // A coin / broom floating above an object is a click target for that object ("click what you see").
    for (const ind of this.indicators.values()) if (ind.c.visible && Math.hypot(px - ind.x, py - ind.y) <= 18) return ind.objectId;
    // Shapes first (front-most wins); labels only when no shape is under the pointer,
    // so a label floating over a neighbour never steals that neighbour's click.
    const pick = (test: (e: ObjectEntry) => boolean): string | null => {
      let best: { id: string; depth: number } | null = null;
      for (const [id, e] of this.objectGfx) if (test(e) && (!best || e.depth > best.depth)) best = { id, depth: e.depth };
      return best?.id ?? null;
    };
    return pick((e) => {
      if (e.sprite) {
        const b = e.sprite.getBounds();
        if (b.contains(px,py)) {
          const u = (px-b.x)/b.width, w = e.sprite.frame.width, h = e.sprite.frame.height;
          const alpha = this.scene.textures.getPixelAlpha(Math.floor((e.sprite.flipX ? 1-u : u)*w),Math.floor((py-b.y)/b.height*h),e.sprite.texture.key,e.sprite.frame.name);
          if ((alpha ?? 0) > 24) return true;
        }
      }
      return Phaser.Geom.Polygon.Contains(e.outline,px,py);
    }) ?? pick((e) => e.label.visible && e.label.getBounds().contains(px, py));
  }

  objectClickPoint(id: string): { x: number; y: number } | null {
    const e = this.objectGfx.get(id);
    if (!e) return null;
    for (const ind of this.indicators.values()) if (ind.objectId === id && ind.c.visible) return { x: ind.x, y: ind.y };
    // Centre of the top face: always inside the object's own silhouette.
    const f = e.data.footprint;
    const c = worldToScreen({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
    return { x: c.x, y: c.y - (this.forestScene && e.data.type === 'portal' ? 120 : this.forestScene && e.data.type === 'sense_stone' ? 65 : e.height ?? 0) };
  }

  removeObject(id: string): void {
    const g = this.objectGfx.get(id);
    if (!g) return;
    g.sprite?.destroy();
    g.lock?.destroy();
    g.box.destroy();
    g.label.destroy();
    g.bar.destroy();
    this.objectGfx.delete(id);
  }

  setObjectHighlight(id: string, on: boolean): void {
    this.highlight.clear();
    const g = this.objectGfx.get(id);
    if (!on || !g) return;
    const f = g.data.footprint;
    const pts = [worldToScreen({ x: f.x, y: f.y }), worldToScreen({ x: f.x + f.w, y: f.y }), worldToScreen({ x: f.x + f.w, y: f.y + f.h }), worldToScreen({ x: f.x, y: f.y + f.h })];
    this.highlight.lineStyle(3, 0xffe066, 1);
    this.highlight.strokePoints(pts.map((p) => v(p, g.height ?? 0)), true);
    this.highlight.strokePoints(pts.map((p) => v(p)), true);
  }

  createActor(id: string, kind: 'player' | 'customer' | 'employee', archetype?: string): ActorView {
    if (this.scene.textures.exists(H5_ASSETS.hero.key)) {
      // Placeholder: the hero atlas is shared, so NPCs get a tint + smaller size to stay distinguishable from the player.
      const npc = kind === 'player' ? undefined : NPC_TINTS[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % NPC_TINTS.length]!;
      return new PlaceholderActorView(this.scene, kind === 'player' ? PLAYER_COLOR : 0xd07a3a, true, npc, archetype === 'master');
    }
    if ((this.streetScene || this.forestScene) && kind === 'player') return new IncidentActorView(this.scene);
    return new PlaceholderActorView(this.scene, kind === 'player' ? PLAYER_COLOR : 0xd07a3a);
  }

  setPathPreview(points: WorldPos[] | null): void {
    this.path.clear();
    if (!points || points.length < 2) return;
    this.path.lineStyle(3, 0x2f7fd8, 0.6);
    this.path.strokePoints(points.map((p) => v(worldToScreen(p))), false);
    const end = worldToScreen(points[points.length - 1]!);
    this.path.fillStyle(0x2f7fd8, 0.8).fillCircle(end.x, end.y, 6);
  }

  setHoverTile(tile: TilePos | null): void {
    this.hover.clear();
    if (!tile) return;
    const f = { x: tile.x, y: tile.y, w: 1, h: 1 };
    const pts = [worldToScreen({ x: f.x, y: f.y }), worldToScreen({ x: f.x + 1, y: f.y }), worldToScreen({ x: f.x + 1, y: f.y + 1 }), worldToScreen({ x: f.x, y: f.y + 1 })];
    this.hover.lineStyle(2, 0xffffff, 0.9).strokePoints(pts.map((p) => v(p)), true);
  }

  private readonly indicators = new Map<string, { c: Phaser.GameObjects.Container; icon: string; tween: Phaser.Tweens.Tween | null; objectId: string; x: number; y: number }>();
  private readonly indicatorPool: Phaser.GameObjects.Container[] = [];
  private indicatorKey = '';

  setIndicators(items: Array<{ id: string; objectId: string; icon: string }>): void {
    const key = items.map((i) => `${i.id}|${i.icon}`).sort().join(',');
    if (key === this.indicatorKey) return;
    this.indicatorKey = key;
    const want = new Map(items.map((i) => [i.id, i]));
    // Remove indicators that are no longer relevant (returned to the pool, never left behind).
    for (const [id, ind] of this.indicators) {
      if (want.has(id) && want.get(id)!.icon === ind.icon) continue;
      ind.tween?.stop();
      ind.c.setVisible(false);
      this.indicatorPool.push(ind.c);
      this.indicators.delete(id);
    }
    const perObject = new Map<string, number>();
    for (const it of items) {
      const e = this.objectGfx.get(it.objectId);
      if (!e) continue;
      const slot = perObject.get(it.objectId) ?? 0; // two indicators on one object sit side by side
      perObject.set(it.objectId, slot + 1);
      let ind = this.indicators.get(it.id);
      if (!ind) {
        const c = this.indicatorPool.pop() ?? this.scene.add.container(0, 0);
        c.removeAll(true);
        c.add(createIcon(this.scene, it.icon, 26));
        ind = { c, icon: it.icon, tween: null, objectId: it.objectId, x: 0, y: 0 };
        this.indicators.set(it.id, ind);
      }
      const f = e.data.footprint;
      const p = worldToScreen({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
      const x = p.x + (slot % 2 === 0 ? 1 : -1) * Math.ceil(slot / 2) * 28;
      const y = p.y - (e.height ?? 0) - 34;
      ind.x = x;
      ind.y = y;
      ind.c.setPosition(x, y).setVisible(true).setDepth(1e6 - 3);
      if (!ind.tween && dur(MOTION.slow) > 0) ind.tween = this.scene.tweens.add({ targets: ind.c, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private labelKey = '';

  focusLabels(playerPos: WorldPos, hoveredId: string | null): void {
    const key = `${Math.floor(playerPos.x * 2)},${Math.floor(playerPos.y * 2)},${hoveredId ?? ''},${this.glowKey}`;
    if (key === this.labelKey) return;
    this.labelKey = key;
    for (const [id, e] of this.objectGfx) {
      const f = e.data.footprint;
      const near = Math.hypot(f.x + f.w / 2 - playerPos.x, f.y + f.h / 2 - playerPos.y) <= 2;
      const focused = near || id === hoveredId;
      e.focused = focused;
      e.label.setVisible((focused || e.captioned) && e.visualKey.indexOf('away') < 0);
    }
  }

  private readonly floatPool: Phaser.GameObjects.Text[] = [];

  /** Floating text (rewards, short messages). Pooled: no allocation per event after warm-up. */
  showFeedback(at: WorldPos, text: string, kind: FeedbackKind): void {
    const p = worldToScreen(at);
    const t = this.floatPool.pop() ?? this.scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5, 1).setResolution(2);
    const reward = kind === 'coin' || kind === 'exp' || kind === 'unlock';
    t.setText(text)
      .setColor(reward ? FEEDBACK_COLORS[kind] : css(COLORS.cream))
      .setBackgroundColor(reward ? '' : FEEDBACK_COLORS[kind])
      .setStroke(css(COLORS.espresso), reward ? 4 : 0)
      .setPadding(reward ? 0 : 6, reward ? 0 : 3, reward ? 0 : 6, reward ? 0 : 3)
      .setPosition(p.x, p.y - 40)
      .setAlpha(1)
      .setVisible(true)
      .setDepth(1e6 + 1);
    const rise = dur(MOTION.slow) === 0 ? 0 : reward ? 36 : 22;
    this.scene.tweens.add({
      targets: t,
      y: t.y - rise,
      alpha: 0,
      delay: reward ? 700 : 600,
      duration: dur(MOTION.slow) === 0 ? 1 : 500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        t.setVisible(false);
        if (this.floatPool.length < 24) this.floatPool.push(t);
        else t.destroy();
      },
    });
  }

  showRatingBubble(at: WorldPos, text: string, stars: number): void {
    const p = worldToScreen(at);
    const label = this.scene.add.text(0, -9, text, { fontFamily: FONT.family, fontSize: '15px', color: css(COLORS.espresso), fontStyle: 'bold' }).setOrigin(0.5, 0.5).setResolution(2);
    const w = Math.max(96, Math.ceil(label.width) + 24);
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.cream, 1).fillRoundedRect(-w / 2, -26, w, 44, 14).lineStyle(2, COLORS.caramel, 1).strokeRoundedRect(-w / 2, -26, w, 44, 14).fillTriangle(-7, 17, 7, 17, 0, 27);
    const row: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < 5; i++) row.push(createIcon(this.scene, i < stars ? 'star' : 'starEmpty', 11).setPosition((i - 2) * 15, 6));
    const c = this.scene.add.container(p.x, p.y - 96, [bg, label, ...row]).setDepth(1e6 + 2);
    if (dur(MOTION.base) > 0) {
      c.setScale(0.5);
      this.scene.tweens.add({ targets: c, scale: 1, duration: MOTION.base, ease: 'Back.easeOut' });
    }
    this.scene.tweens.add({ targets: c, alpha: 0, y: c.y - (dur(MOTION.slow) > 0 ? 22 : 0), delay: 2200, duration: dur(MOTION.slow) || 1, onComplete: () => c.destroy() });
  }

  private glowKey = '';
  private readonly glowGfx: Phaser.GameObjects.Graphics;
  private glowTween: Phaser.Tweens.Tween | null = null;

  setGlows(glows: Record<string, number>): void {
    const key = Object.entries(glows).sort().join(',');
    if (key === this.glowKey) return;
    this.glowKey = key;
    const g = this.glowGfx.clear();
    for (const e of this.objectGfx.values()) e.glowed = false;
    for (const [id, color] of Object.entries(glows)) {
      const e = this.objectGfx.get(id);
      if (!e) continue;
      e.glowed = true;
      const f = e.data.footprint;
      if (e.data.type === 'kitten') {
        const p = worldToScreen({ x: f.x + .5, y: f.y + .5 });
        g.fillStyle(color, .15).fillEllipse(p.x, p.y, 90, 42).lineStyle(3, color, .9).strokeEllipse(p.x, p.y, 90, 42);
        continue;
      }
      const pts = [worldToScreen({ x: f.x, y: f.y }), worldToScreen({ x: f.x + f.w, y: f.y }), worldToScreen({ x: f.x + f.w, y: f.y + f.h }), worldToScreen({ x: f.x, y: f.y + f.h })];
      g.fillStyle(color, 0.22).fillPoints(pts.map((p) => v(p)), true);
      g.lineStyle(3, color, 0.95).strokePoints(pts.map((p) => v(p, e.height ?? 0)), true);
      g.strokePoints(pts.map((p) => v(p)), true);
    }
    if (!this.glowTween && dur(MOTION.slow) > 0) {
      this.glowTween = this.scene.tweens.add({ targets: this.glowGfx, alpha: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  setDecorArea(area: Footprint[] | null): void {
    this.decorArea.clear();
    if (!area) return;
    this.decorArea.lineStyle(1, 0x3c9d4a, 0.9);
    for (const a of area) {
      for (let y = a.y; y < a.y + a.h; y++) {
        for (let x = a.x; x < a.x + a.w; x++) {
          const pts = [worldToScreen({ x, y }), worldToScreen({ x: x + 1, y }), worldToScreen({ x: x + 1, y: y + 1 }), worldToScreen({ x, y: y + 1 })];
          this.decorArea.fillStyle(0x6db55a, 0.16).fillPoints(pts.map((p) => v(p)), true);
          this.decorArea.strokePoints(pts.map((p) => v(p)), true);
        }
      }
    }
  }

  setPlacementPreview(preview: PlacementPreview | null): void {
    const key = preview ? `${preview.footprint.x},${preview.footprint.y},${preview.footprint.w},${preview.footprint.h},${preview.valid},${preview.label}` : '';
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghost.clear();
    this.ghostLabel.setVisible(preview !== null);
    if (!preview) return;
    const color = preview.valid ? 0x6db55a : 0xc8463d;
    drawBox(this.ghost, preview.footprint, color, 18);
    const f = preview.footprint;
    const c = worldToScreen({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
    this.ghostLabel.setText(preview.label).setBackgroundColor(preview.valid ? '#3c9d4a' : '#c8463d').setPosition(c.x, c.y - 24);
  }

  /**
   * Full-bleed world: the camera uses `zoom` (see `worldZoom`) and follows the player, so the map
   * fills the whole screen; the HUD floats on top and `insets` only keeps the player clear of it.
   */
  frame(widthTiles: number, heightTiles: number, insets: { top: number; right: number; bottom: number; left: number }, zoom: number): void {
    this.bounds = { w: widthTiles, h: heightTiles };
    this.insets = insets;
    const cam = this.scene.cameras.main;
    cam.setZoom(zoom);
    const availH = cam.height - insets.top - insets.bottom;
    const availW = cam.width - insets.left - insets.right;
    this.centerOffset = { x: (cam.width / 2 - (insets.left + availW / 2)) / zoom, y: (cam.height / 2 - (insets.top + availH / 2)) / zoom };
    this.snapNext = true;
  }

  private snapNext = false;
  private pan = { x: 0, y: 0 };

  panBy(dxPx: number, dyPx: number): void {
    const z = this.scene.cameras.main.zoom;
    this.pan.x += dxPx / z;
    this.pan.y += dyPx / z;
  }

  resetPan(): void {
    this.pan = { x: 0, y: 0 };
  }

  private centerOffset = { x: 0, y: 0 };

  follow(pos: WorldPos, dtMs: number): void {
    const cam = this.scene.cameras.main;
    const zoom = cam.zoom;
    const p = worldToScreen(pos);
    // Map extents in render space (walls and objects stand above their floor tile, hence the margins).
    // The ground continues past the map, so the camera may go a little beyond the edges (not far: nothing is there).
    const minX = worldToScreen({ x: 0, y: this.bounds.h }).x - 260;
    const maxX = worldToScreen({ x: this.bounds.w, y: 0 }).x + 260;
    const minY = worldToScreen({ x: 0, y: 0 }).y - 260;
    const maxY = worldToScreen({ x: this.bounds.w, y: this.bounds.h }).y + 200;
    const halfW = cam.width / 2 / zoom;
    const halfH = cam.height / 2 / zoom;
    const clampAxis = (v: number, lo: number, hi: number, half: number): number => (hi - lo <= half * 2 ? (lo + hi) / 2 : Math.max(lo + half, Math.min(hi - half, v)));
    const tx = clampAxis(p.x + this.centerOffset.x + this.pan.x, minX, maxX, halfW);
    const ty = clampAxis(p.y - 24 + this.centerOffset.y + this.pan.y, minY, maxY, halfH);
    const mid = cam.midPoint;
    // Frame-rate independent easing; snaps when reduced motion is on or right after a (re)frame.
    const k = this.snapNext || dur(MOTION.base) === 0 ? 1 : 1 - Math.exp(-dtMs / 120);
    this.snapNext = false;
    cam.centerOn(mid.x + (tx - mid.x) * k, mid.y + (ty - mid.y) * k);
  }

  private insets = { top: 0, right: 0, bottom: 0, left: 0 };

  reframe(): void {
    this.frame(this.bounds.w, this.bounds.h, this.insets, this.scene.cameras.main.zoom);
  }
}
