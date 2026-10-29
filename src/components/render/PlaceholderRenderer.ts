import Phaser from 'phaser';
import { H5_ASSETS, HERO_FACINGS, worldSprite, terrainFrame, addTerrainTile, terrainRepeat } from './h5Assets';
import { treeAppearance, SLICE_TREE_NAMES } from './sliceAssets';
import { STORY_ASSETS } from './storyAssets';
import { bakeGardenObject, drawGardenEnvironment, GARDEN_BACKGROUND, STONE_COLOR } from './gardenArt';
import { bakeIncidentObject, drawIncidentEnvironment, drawIncidentObject, IncidentActorView, STREET_BACKGROUND } from './incidentArt';
import { actorDepth, floorDepth, footprintDepth, worldToScreen, type ScreenPos } from '../../utils/iso';
import type { Footprint, TilePos, WorldPos } from '../../utils/tile';
import { DEFAULT_STYLE, FEEDBACK_COLORS, PLACEHOLDER_STYLES, PLACEHOLDER_VARIANTS, PLAYER_COLOR, TERRAIN_COLORS } from './placeholderStyles';
import type { ActorView, ActorViewState, FeedbackKind, FloorTileView, ObjectViewData, ObjectVisual, WorldRenderer } from './WorldRenderer';
import { debugFlags } from '../../ui/theme/debugFlags';
import { createIcon } from '../../ui/theme/assetRegistry';
import { COLORS, css, dur, FONT, MOTION } from '../../ui/theme/tokens';
import { clampCenter, easeFactor, insetOffset, mapRect } from '../../systems/camera/framing';

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
  /** Chapter-1 street objects: drawn once into an image (a Graphics would be re-drawn every frame). */
  baked?: Phaser.GameObjects.Image | null;
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
  private bounds = { w: 1, h: 1 };

  constructor(private readonly scene: Phaser.Scene) {
    this.path = scene.add.graphics().setDepth(floorDepth + 2);
    this.hover = scene.add.graphics().setDepth(floorDepth + 1);
    this.highlight = scene.add.graphics().setDepth(1e6);
  }

  /**
   * Extends the map's own floor to the edge of the screen (an endless checkered ground in the
   * map's dominant terrain colour), so the view never shows black around the map: you are
   * "inside" the farm or café, not looking at a model of it.
   */
  private buildBackdrop(floor: FloorTileView[]): void {
    if (this.streetScene || this.forestScene) {
      this.indoor = false;
      this.scene.cameras.main.setBackgroundColor(this.streetScene ? STREET_BACKGROUND : GARDEN_BACKGROUND);
      if (this.streetScene) return; // Chapter 1 builds its own continuous city/lake backdrop.
      const background=terrainRepeat(this.scene,this.forestScene?14:4);
      if(background&&this.forestScene)this.scene.add.tileSprite(-6400,-3200,12800,6400,background).setOrigin(0).setTilePosition(64,0).setDepth(floorDepth-1).setTint(this.forestScene?0x8da189:0x9caeba);
      else this.scene.add.graphics().setDepth(floorDepth - 1).fillStyle(this.streetScene ? STREET_BACKGROUND : GARDEN_BACKGROUND).fillRect(-6400, -3200, 12800, 6400);
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
        // The street's and the garden's floors are part of their baked ground layers.
        if (this.streetScene || this.forestScene) continue;
        const checker = (t.tile.x + t.tile.y) % 2 === 0 ? 1 : 0.94;
        drawBox(ground, f, shade(style.top, checker), 0);
      }
    }
    if (this.streetScene) drawIncidentEnvironment(this.scene, floor);
    if (this.forestScene) drawGardenEnvironment(this.scene, floor);
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
    };
    this.objectGfx.set(o.id, entry);
    this.drawObject(entry, { variant: 'default' });
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
    const style = base;
    const f = o.footprint;
    const h = this.forestScene && o.type === 'portal' ? 230 : this.forestScene && o.type === 'sense_stone' ? 110 : style.height;
    e.box.clear();
    const asset = (this.forestScene ? o.type === 'portal' ? STORY_ASSETS.portal : o.type === 'sense_stone' ? STORY_ASSETS.stone : o.type === 'tree' ? STORY_ASSETS.trees : null : null) ?? worldSprite(o.type, visual.variant);
    if (asset && this.scene.textures.exists(asset.key)) {
      const p = worldToScreen({x:f.x+f.w/2,y:f.y+f.h/2});
      const frame = 'frame' in asset ? asset.frame : undefined;
      e.sprite ??= this.scene.add.image(p.x,p.y,asset.key,frame).setOrigin(.5,.88).setDepth(e.depth-.01);
      e.sprite.setTexture(asset.key,frame);
      const size = this.forestScene ? o.type === 'portal' ? 300 : o.type === 'tree' ? 220 : 145 : o.type === 'tree' ? 180 : (f.w+f.h)*64;
      e.sprite.setAlpha(visual.variant === 'rescued' || visual.variant === 'away' ? 0 : visual.variant === 'taken' ? .25 : 1);
      e.sprite.setOrigin(.5, this.forestScene ? .94 : .88).setDisplaySize(size, this.forestScene && o.type === 'tree' ? 126 : size).setFlipX(o.rotation%2===1).setTint(!this.forestScene || visual.variant === 'open' || visual.variant === 'ACTIVATED' ? 0xffffff : o.type === 'portal' ? 0x889ba6 : 0xb6c4ba);
      if(o.type === 'sense_stone') {
        const color=STONE_COLOR[o.id] ?? 0xb8ddc4;
        const bright=visual.variant === 'ACTIVATED' || visual.variant === 'ACTIVATING' || visual.variant === 'PLAYER_NEARBY';
        e.box.lineStyle(3,color,bright?1:.4);
        if(o.id==='stone_sight') {e.box.strokeEllipse(p.x-3,p.y-72,17,26).lineBetween(p.x-3,p.y-58,p.x-3,p.y-87).lineBetween(p.x-3,p.y-70,p.x+8,p.y-79);}
        else {e.box.beginPath();for(let i=0;i<=40;i++){const a=i/40*Math.PI*4,r=i/40*16;const x=p.x+Math.cos(a)*r,y=p.y-74+Math.sin(a)*r;if(i===0)e.box.moveTo(x,y);else e.box.lineTo(x,y);}e.box.strokePath();}
      }
    } else if (this.forestScene && (e.baked?.destroy(), (e.baked = bakeGardenObject(this.scene, o.id, o.type, f, visual.variant, e.depth)))) {
      // Baked garden object.
    } else if (o.type === 'ancient_pillar') {
      drawBox(e.box, {x:f.x+.18,y:f.y+.18,w:.64,h:.64},0x7c8774,16);
      drawBox(e.box, {x:f.x+.32,y:f.y+.32,w:.36,h:.36},0x919980,h);
      const p=worldToScreen({x:f.x+.5,y:f.y+.5});
      e.box.fillStyle(0x57744a).fillEllipse(p.x,p.y-h,40,17);
    } else if (this.streetScene && (e.baked?.destroy(), (e.baked = bakeIncidentObject(this.scene, o.id, o.type, f, visual.variant === 'default' ? o.id : visual.variant, e.depth)))) {
      // Baked: nothing to redraw per frame.
    } else if (!drawIncidentObject(e.box, o.type, f, visual.variant === 'default' ? o.id : visual.variant)) drawBox(e.box, f, style.color, h);
    const c = worldToScreen({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
    // Only states that call for action (progress, ready, thirsty, done) stay on screen; names show when near/hovered.
    e.captioned = visual.progress != null;
    const labelY = e.baked?.getData('sliceProp') ? e.baked.y - e.baked.displayHeight * e.baked.originY - 6 : e.sprite ? c.y - e.sprite.displayHeight * .82 - 4 : c.y - h - 4;
    e.label.setText(this.streetScene && o.type === 'sau_tree' ? SLICE_TREE_NAMES[treeAppearance(o.id)]! : visual.caption ?? o.label).setPosition(c.x, labelY).setVisible((e.focused || e.captioned) && visual.variant !== 'away');
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
    // Centre of the top face: always inside the object's own silhouette.
    const f = e.data.footprint;
    const c = worldToScreen({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
    return { x: c.x, y: c.y - (this.forestScene && e.data.type === 'portal' ? 120 : this.forestScene && e.data.type === 'sense_stone' ? 65 : e.height ?? 0) };
  }

  removeObject(id: string): void {
    const g = this.objectGfx.get(id);
    if (!g) return;
    g.sprite?.destroy();
    g.baked?.destroy();
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
    if ((this.streetScene || this.forestScene) && kind === 'player') return new IncidentActorView(this.scene, this.streetScene);
    return new PlaceholderActorView(this.scene, kind === 'player' ? PLAYER_COLOR : 0xd07a3a);
  }

  /** The walking destination: where a click sent the hero (set while the hero follows a path), and when it was clicked. */
  private dest: { x: number; y: number; t0: number } | null = null;
  /** When the hero arrived (the marker fades out from then). */
  private destArrived: number | null = null;

  /**
   * Shows where the hero is walking to: a ripple spreads out where you clicked,
   * then a small ring pulses on the spot until the hero gets there and it fades.
   * No line is drawn along the route.
   */
  setPathPreview(points: WorldPos[] | null): void {
    const g = this.path.clear(), now = this.scene.time.now;
    if (points && points.length >= 2) {
      const end = points[points.length - 1]!;
      // A new click: the ripple starts again.
      if (!this.dest || Math.hypot(this.dest.x - end.x, this.dest.y - end.y) > 0.25) this.dest = { x: end.x, y: end.y, t0: now };
      this.destArrived = null;
      this.drawDestination(g, this.dest, now, 1);
    } else if (this.dest) {
      this.destArrived ??= now;
      const k = 1 - (now - this.destArrived) / 280;
      if (k <= 0) { this.dest = null; this.destArrived = null; } else this.drawDestination(g, this.dest, now, k);
    }
  }

  /** The destination marker flat on the ground (the isometric ground makes circles 2:1 ellipses). */
  private drawDestination(g: Phaser.GameObjects.Graphics, d: { x: number; y: number; t0: number }, now: number, alpha: number): void {
    const p = worldToScreen(d), age = now - d.t0;
    // The click ripple: a ring spreading out and fading.
    if (age < 520) {
      const t = age / 520, e = 1 - (1 - t) * (1 - t), r = 14 + 40 * e;
      g.lineStyle(4, 0xff7f6b, 0.85 * (1 - t) * alpha).strokeEllipse(p.x, p.y, r * 2, r);
    }
    // The spot itself: a soft cream disc, a ring that breathes, and a coral dot.
    const pulse = 1 + Math.sin(now / 200) * 0.08, r = 20 * pulse;
    g.fillStyle(0xfff6e5, 0.35 * alpha).fillEllipse(p.x, p.y, r * 2, r);
    g.lineStyle(3, 0xffffff, 0.95 * alpha).strokeEllipse(p.x, p.y, r * 2, r);
    g.lineStyle(2, 0x5a3825, 0.55 * alpha).strokeEllipse(p.x, p.y, r * 2 + 5, r + 2.5);
    g.fillStyle(0xff7f6b, alpha).fillEllipse(p.x, p.y, 11, 5.5);
  }

  setHoverTile(tile: TilePos | null): void {
    this.hover.clear();
    if (!tile) return;
    const f = { x: tile.x, y: tile.y, w: 1, h: 1 };
    const pts = [worldToScreen({ x: f.x, y: f.y }), worldToScreen({ x: f.x + 1, y: f.y }), worldToScreen({ x: f.x + 1, y: f.y + 1 }), worldToScreen({ x: f.x, y: f.y + 1 })];
    // A soft highlight on the tile, not a hard outline.
    this.hover.fillStyle(0xffffff, 0.16).fillPoints(pts.map((p) => v(p)), true);
    this.hover.lineStyle(2, 0xffffff, 0.5).strokePoints(pts.map((p) => v(p)), true);
  }

  private labelKey = '';

  focusLabels(playerPos: WorldPos, hoveredId: string | null): void {
    const key = `${Math.floor(playerPos.x * 2)},${Math.floor(playerPos.y * 2)},${hoveredId ?? ''}`;
    if (key === this.labelKey) return;
    this.labelKey = key;
    const playerScreen = worldToScreen(playerPos);
    for (const [id, e] of this.objectGfx) {
      const f = e.data.footprint;
      if (this.streetScene && e.data.type === 'sau_tree' && e.baked) {
        const image = e.baked, bounds = image.getBounds();
        const coversHero = playerPos.x + playerPos.y + .1 < e.depth && playerScreen.x > bounds.left && playerScreen.x < bounds.right && playerScreen.y - 40 > bounds.top && playerScreen.y - 40 < bounds.bottom;
        image.setAlpha(coversHero ? .42 : 1);
      }
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

  /**
   * Full-bleed world: the camera uses `zoom` (picked by WorldScene) and follows the player, so the map
   * fills the whole screen; the HUD floats on top and `insets` only keeps the player clear of it.
   */
  frame(widthTiles: number, heightTiles: number, insets: { top: number; right: number; bottom: number; left: number }, zoom: number): void {
    this.bounds = { w: widthTiles, h: heightTiles };
    this.insets = insets;
    const cam = this.scene.cameras.main;
    cam.setZoom(zoom);
    this.centerOffset = insetOffset(cam.width, cam.height, insets, zoom);
    this.snapNext = true;
  }

  private snapNext = false;
  private pan = { x: 0, y: 0 };

  panBy(dxPx: number, dyPx: number): void {
    const z = this.scene.cameras.main.zoom, max = 1500;
    this.pan.x = Math.max(-max, Math.min(max, this.pan.x + dxPx / z));
    this.pan.y = Math.max(-max, Math.min(max, this.pan.y + dyPx / z));
  }

  resetPan(): void {
    this.pan = { x: 0, y: 0 };
  }

  /** Apply panning directly while dragging; keep the offset until the next move command. */
  setLooking(on: boolean): void {
    this.looking = on;
  }

  /** Extra tiles of land past the west and east edges of the map that the camera may show. */
  setReach(west: number, east: number): void {
    this.reach = { west, east };
  }

  private looking = false;
  private reach = { west: 0, east: 0 };

  private centerOffset = { x: 0, y: 0 };

  follow(pos: WorldPos, dtMs: number): void {
    const cam = this.scene.cameras.main;
    const zoom = cam.zoom;
    const p = worldToScreen(pos);
    const target = { x: p.x + this.centerOffset.x + this.pan.x, y: p.y - 24 + this.centerOffset.y + this.pan.y };
    const t = clampCenter(target, cam.width / zoom, cam.height / zoom, mapRect(this.bounds.w, this.bounds.h, this.reach));
    const mid = cam.midPoint;
    // Snaps when reduced motion is on or right after a (re)frame.
    const k = this.looking || this.snapNext || dur(MOTION.base) === 0 ? 1 : easeFactor(dtMs, 120);
    this.snapNext = false;
    cam.centerOn(mid.x + (t.x - mid.x) * k, mid.y + (t.y - mid.y) * k);
  }

  private insets = { top: 0, right: 0, bottom: 0, left: 0 };

  reframe(): void {
    this.frame(this.bounds.w, this.bounds.h, this.insets, this.scene.cameras.main.zoom);
  }
}
