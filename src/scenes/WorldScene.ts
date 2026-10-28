import Phaser from 'phaser';
import { ART_READY, H5_ASSETS, registerH5Frames } from '../components/render/h5Assets';
import { dur, MOTION } from '../ui/theme/tokens';
import { GardenEffects } from '../components/render/gardenArt';
import { GardenAudio } from '../components/audio/GardenAudio';
import { IncidentRunView, runPose } from '../components/render/incidentArt';
import { RunAudio } from '../components/audio/RunAudio';
import { StreetLifeView } from '../components/render/streetArt';
import { TRANSITION_SCENE, type TransitionScene } from './TransitionScene';
import { SHOP_SCENE } from './ShopScene';
import { toggleMute } from '../core/audioPrefs';
import { STORY_ASSETS } from '../components/render/storyAssets';
import { t } from '../core/i18n';
import { CONTENT } from '../data/content';
import { Autosave, createSession, type GameSession } from '../core/session';
import { SystemClock } from '../core/Clock';
import type { GameSimulation } from '../gameplay/GameSimulation';
import { PlaceholderRenderer } from '../components/render/PlaceholderRenderer';
import type { ActorView } from '../components/render/WorldRenderer';
import { PlotPresenter } from '../components/presenters/PlotPresenter';
import { EquipmentPresenter } from '../components/presenters/EquipmentPresenter';
import { CustomerPresenter } from '../components/presenters/CustomerPresenter';
import { GlowPresenter } from '../components/presenters/GlowPresenter';
import { RewardPresenter } from '../components/presenters/RewardPresenter';
import { StoryPresenter } from '../components/presenters/StoryPresenter';
import { EmployeePresenter } from '../components/presenters/EmployeePresenter';
import { DecorPresenter } from '../components/presenters/DecorPresenter';
import { FeedbackPresenter } from '../ui/FeedbackPresenter';
import { installTestBridge } from '../core/testBridge';
import { hudScale, worldViewInsets, worldZoom } from '../ui/layout/viewInsets';
import { framingZoom, mapRect, type CameraMode } from '../systems/camera/framing';
import { screenToWorld, worldToScreen } from '../utils/iso';
import { worldToTile, type TilePos } from '../utils/tile';

export const WORLD_SCENE = 'WorldScene';

export interface WorldSceneData {
  /** Omitted = resume the map the save was on. */
  mapId?: string;
  persistent: boolean;
  /** Dev/test only: start from a fresh game, discarding the stored save. */
  fresh?: boolean;
}

/**
 * World scene: thin adapter between Phaser (input, frame loop, drawing) and
 * the headless GameSimulation. Contains no gameplay rules.
 */
export class WorldScene extends Phaser.Scene {
  session!: GameSession;
  autosave!: Autosave;
  private worldRenderer!: PlaceholderRenderer;
  private gardenFx: GardenEffects | null = null;
  private gardenAudio: GardenAudio | null = null;
  /** Chapter-1 run: hazards on screen, extra movement keys and the touch joystick. */
  private runView: IncidentRunView | null = null;
  private runAudio: RunAudio | null = null;
  private streetView: StreetLifeView | null = null;
  /** The magic circle's flash has played (once per visit of the street). */
  private portalFlashed = false;
  private moveKeys: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> | null = null;
  private stick: { x: number; y: number; cx: number; cy: number; on: boolean; id: number } | null = null;
  /** A drag that looks around (right half of a touch screen, or the mouse); `on` once it has moved enough not to be a tap. */
  private look: { x: number; y: number; px: number; py: number; on: boolean; id: number } | null = null;
  private stickGfx: Phaser.GameObjects.Graphics | null = null;
  private playerView!: ActorView;
  private feedback!: FeedbackPresenter;
  private plots!: PlotPresenter;
  private equipment!: EquipmentPresenter;
  private customers: CustomerPresenter | null = null;
  private decor: DecorPresenter | null = null;
  private employees: EmployeePresenter | null = null;
  private storyView: StoryPresenter | null = null;
  private glows: GlowPresenter | null = null;
  private rewards: RewardPresenter | null = null;
  private travelling = false;
  /** Set by the travel event; performed at the start of the next frame, never mid-tick. */
  private pendingTravel: string | null = null;
  private hoveredObject: string | null = null;
  private launchData!: WorldSceneData;

  constructor() {
    super(WORLD_SCENE);
  }

  get sim(): GameSimulation {
    return this.session.sim;
  }

  init(data: WorldSceneData): void {
    this.launchData = data;
  }

  preload(): void {
    for (const a of [...Object.values(H5_ASSETS), ...Object.values(STORY_ASSETS)]) if (ART_READY.has(a.key) && !this.textures.exists(a.key)) this.load.image(a.key, a.url);
  }

  create(): void {
    this.portalFlashed = false;
    const clock = new SystemClock(import.meta.env.PROD ? 0 : readDebugClockOffset());
    if (this.launchData.fresh && !import.meta.env.PROD) window.localStorage.removeItem('tcss.save.slot1');
    this.travelling = false;
    this.pendingTravel = null;
    this.hoveredObject = null; // scene instances are reused on restart
    this.session = createSession({ ...(this.launchData.mapId ? { mapId: this.launchData.mapId } : {}), content: CONTENT, persistent: this.launchData.persistent, clock, ...(skipStory() ? { skipStory: true } : {}) });
    this.autosave = new Autosave(this.session);
    const world = this.sim.world;
    // Dev builds: `?cheat=1` opens the game fully unlocked with a large purse, for testing.
    if (!import.meta.env.PROD && new URLSearchParams(window.location.search).has('cheat')) this.sim.enableTestMode(!this.sim.story.active);

    registerH5Frames(this);
    this.worldRenderer = new PlaceholderRenderer(this);
    const floor = [];
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = { x, y };
        floor.push({ tile, kind: world.terrainKind(tile) ?? 'floor', walkable: world.grid.isWalkable(tile) });
      }
    }
    this.worldRenderer.buildWorld(
      floor,
      world.allObjects().map((o) => ({ id: o.id, type: o.type, label: o.def.label, footprint: o.footprint, rotation: o.rotation, interactive: !!o.def.interaction })),
    );
    // Layout policy: the farm/café HUD panel occupies the right edge (PANEL_W + margin).
    this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.frameCamera());

    this.playerView = this.worldRenderer.createActor('player', 'player');
    this.feedback = new FeedbackPresenter(this.sim.bus, world, this.worldRenderer, () => this.sim.player.pos, (id) => this.sim.cafe?.customer(id)?.actor.pos);
    this.plots = new PlotPresenter(this.worldRenderer, CONTENT.seeds);
    this.equipment = new EquipmentPresenter(this.worldRenderer);
    if (this.sim.cafe) this.customers = new CustomerPresenter(this.worldRenderer, CONTENT.recipes);
    this.employees = new EmployeePresenter(this.worldRenderer, (id) => t(`action.${id}`), (id) => CONTENT.recipes[id]?.label ?? id);
    this.glows = new GlowPresenter(this.worldRenderer, world, CONTENT.recipes);
    this.rewards = new RewardPresenter(
      this.sim.bus,
      world,
      this.worldRenderer,
      () => this.sim.player.pos,
      (id) => this.sim.cafe?.customer(id)?.actor.pos,
      (id) => this.sim.processing.allViews().find((e) => e.id === id)?.label ?? id,
      (ms, fn) => void (ms > 0 ? this.time.delayedCall(ms, fn) : fn()),
    );
    this.storyView = new StoryPresenter(this.worldRenderer, world, CONTENT.story.stones);
    // Chapters 1 and 2 share one control scheme: WASD / arrows, drag joystick, tap to walk.
    if (this.sim.run) {
      this.runView = new IncidentRunView(this);
      this.runAudio = new RunAudio(this);
    }
    if (this.sim.street) {
      this.streetView = new StreetLifeView(this);
      // Stall talks: 1 / 2 pick a reply (the HUD has the same two buttons).
      this.input.keyboard?.on('keydown-ONE', () => this.sim.story.chooseReply(0));
      this.input.keyboard?.on('keydown-TWO', () => this.sim.story.chooseReply(1));
    }
    if (this.sim.garden) {
      this.gardenFx = new GardenEffects(this, (id) => { const o = world.getObject(id); return o ? { x: o.footprint.x + o.footprint.w / 2, y: o.footprint.y + o.footprint.h / 2 } : null; });
      this.gardenAudio = new GardenAudio(this);
    }
    if (this.sim.run || this.sim.garden) {
      this.input.keyboard?.on('keydown-M', () => toggleMute(this.sound));
      this.stickGfx = this.add.graphics().setDepth(1e6 + 5);
      this.moveKeys = (this.input.keyboard?.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>) ?? null;
      // Touch: press and drag on the left half = joystick; on the right half (or with the mouse) = look ahead, and the camera glides
      // back when you let go. A plain tap walks there / talks to whoever was tapped (on release, so a drag never walks).
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.rightButtonDown() || p.middleButtonDown()) return;
        if (p.wasTouch && p.x < this.scale.width / 2) { if (!this.stick) this.stick = { x: p.x, y: p.y, cx: p.x, cy: p.y, on: false, id: p.id }; }
        else if (!this.look) this.look = { x: p.x, y: p.y, px: p.x, py: p.y, on: false, id: p.id };
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        const st = this.stick;
        if (st && st.id === p.id) {
          st.cx = p.x; st.cy = p.y;
          if (Math.hypot(p.x - st.x, p.y - st.y) > 14) st.on = true;
        }
        const lk = this.look;
        if (lk && lk.id === p.id) {
          if (!lk.on && Math.hypot(p.x - lk.x, p.y - lk.y) > 12) { lk.on = true; this.worldRenderer.setLooking(true); }
          if (lk.on) this.worldRenderer.panBy(-(p.x - lk.px), -(p.y - lk.py));
          lk.px = p.x; lk.py = p.y;
        }
      });
      const release = (p: Phaser.Input.Pointer) => {
        if (this.stick?.id === p.id) {
          const dragged = this.stick.on;
          this.stick = null;
      this.look = null;
          if (!dragged) this.clickAt(p);
        }
        if (this.look?.id === p.id) {
          const dragged = this.look.on;
          this.look = null;
          this.worldRenderer.setLooking(false);
          if (!dragged) this.clickAt(p);
        }
      };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);
    }
    this.sim.bus.on('meta:achievement', ({ label }) => this.worldRenderer.showFeedback(this.sim.player.pos, t('meta.achievement', { name: label }), 'ok'));

    this.decor = this.sim.decor.available
      ? new DecorPresenter(this.sim.bus, world, this.worldRenderer, (type) => CONTENT.items[CONTENT.furniture.catalog[type]?.itemId ?? '']?.label ?? type, (id) => {
          if (this.hoveredObject !== id) return;
          this.worldRenderer.setObjectHighlight('', false);
          this.hoveredObject = null;
        })
      : null;

    // Travel: commit state with the destination, then rebuild the world from the save.
    // Chapter 1: the fate strikes out of the blue.
    this.sim.bus.on('story:shock', ({ ms }) => {
      if (dur(MOTION.base) === 0) return;
      this.cameras.main.shake(ms, 0.012);
      this.cameras.main.flash(ms * 0.6, 255, 246, 229);
    });
    // A chapter ends: heavenly doors close over the screen while the next map loads (they open in create()).
    this.sim.bus.on('story:chapterChanged', ({ chapter }) => {
      const label = CONTENT.story.chapters[chapter]?.title ?? '';
      const ms = Math.min(800, CONTENT.story.whiteoutMs - 150);
      // Chapter 2 is reached through the magic circle: a burst of light instead of the doors.
      const style = CONTENT.story.chapters[chapter]?.arrive?.style ?? 'doors';
      if (this.scene.isActive(TRANSITION_SCENE)) (this.scene.get(TRANSITION_SCENE) as TransitionScene).close(ms, label, style);
      else this.scene.launch(TRANSITION_SCENE, { close: { ms, label, style } });
    });
    this.sim.bus.on('world:travelRequested', ({ map }) => {
      if (!this.travelling && this.session.saves) this.pendingTravel = map;
    });

    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) return; // middle button drags the camera
      if (p.rightButtonDown()) return this.sim.cancel();
      // Chapters 1 and 2 act on release (see above), so that a drag can look around instead.
      if (this.sim.run || this.sim.garden) return;
      this.clickAt(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) this.worldRenderer.panBy(-(p.x - p.prevPosition.x), -(p.y - p.prevPosition.y));
      this.updateHover(this.pointerTarget(p));
    });
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.keyboard?.on('keydown-ESC', () => this.sim.cancel());
    this.input.keyboard?.on('keydown-R', () => this.sim.decor.isActive && this.sim.decor.rotate());

    // Persist when the tab is hidden or closed (best effort; autosave covers the rest).
    const flush = () => this.autosave.saveNow();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    this.scene.launch('HudScene', { session: this.session });
    // Arriving through the story doors: they swing open on this map.
    if (this.scene.isActive(TRANSITION_SCENE)) (this.scene.get(TRANSITION_SCENE) as TransitionScene).open();
    installTestBridge(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.travelling) flush(); // travel already saved with the destination map
      this.scene.stop(SHOP_SCENE);
      this.customers?.destroy();
      this.customers = null;
      this.decor?.destroy();
      this.decor = null;
      this.employees?.destroy();
      this.employees = null;
      this.storyView = null;
      this.gardenFx?.destroy();
      this.gardenFx = null;
      this.gardenAudio?.destroy();
      this.gardenAudio = null;
      this.runView?.destroy();
      this.runView = null;
      this.runAudio?.destroy();
      this.runAudio = null;
      this.streetView?.destroy();
      this.streetView = null;
      this.stickGfx = null;
      this.moveKeys = null;
      this.stick = null;
      this.glows = null;
      this.rewards?.destroy();
      this.rewards = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      this.autosave.destroy();
      this.feedback.destroy();
      this.playerView.destroy();
      this.sim.bus.clear();
    });
  }

  override update(time: number, delta: number): void {
    if (this.travelling) return;
    if (this.pendingTravel) return this.travel(this.pendingTravel);
    this.runControls();
    this.sim.tick(delta);
    this.cameraGestures(delta);
    // Decorating: follow the pointer every frame (Phaser can drop the first move after a HUD click).
    if (this.sim.decor.isActive) this.updateHover(this.pointerTarget(this.input.activePointer));
    const s = this.sim.snapshot();
    this.session.frame = s;
    // Side panels (decor shop, farm drawer) must not cover the plots: the map is framed beside them.
    const drawerOpen = !!(this.scene.get('HudScene') as unknown as { farmHud?: { isOpen: boolean } | null }).farmHud?.isOpen;
    const panelW = this.sim.decor.isActive ? 346 : drawerOpen ? 346 : 0;
    const wantInset = panelW && this.scale.width >= 760 ? panelW * hudScale(this.scale.width, this.scale.height) : 0;
    if (wantInset !== this.decorInset) {
      this.decorInset = wantInset;
      this.frameCamera();
    }
    // Chapter 1 rescue: once the hero is inside, the camera rides along with the ambulance into the magic circle.
    this.worldRenderer.follow(s.story.street?.focus ?? s.player.pos, delta);
    this.worldRenderer.focusLabels(s.player.pos, this.hoveredObject);
    const cur = s.interaction.current;
    this.playerView.update({
      pos: s.player.pos,
      state: s.player.state,
      facing: s.player.facing,
      // A drink shows as its recipe name rather than its internal id.
      heldItem: s.cafe?.heldDrink ? (CONTENT.recipes[s.cafe.heldDrink.recipeId]?.label ?? s.player.heldItem) : s.player.heldItem,
      progress: cur?.phase === 'work' ? cur.progress : null,
    });
    // Chapter-1 run: the knock-out plays on the hero's figure (sink, fly off, spin… then lying flat).
    if (this.runView) {
      const pose = runPose(s.story.run);
      // The rescue: lifted while the medics carry the hero, gone once inside the ambulance.
      const street = s.story.street;
      this.playerView.setPose?.(pose.sx, pose.sy, pose.dy - (street?.carried ? 18 : 0), pose.angle);
      this.playerView.setAlpha?.(street?.heroHidden ? 0 : pose.alpha);
    }
    this.runView?.sync(s.story.run, this.sim.player.pos, !!s.story.street?.heroHidden);
    this.streetView?.sync(s.story.street, this.sim.player.pos, s.story.run?.say ?? null);
    // Chapter 1: the ambulance vanishes into the magic circle in a flash of light (then the doors close on chapter 2).
    const portal = s.story.street?.portal;
    if (portal && portal.k > 0.85 && !this.portalFlashed) {
      this.portalFlashed = true;
      if (dur(MOTION.base) > 0) this.cameras.main.flash(650, 210, 245, 255);
    }
    // Chapter 1: walking into a shop opens its room over the street; walking out closes it.
    const inside = !!s.story.street?.shop;
    if (inside && !this.scene.isActive(SHOP_SCENE)) {
      this.scene.launch(SHOP_SCENE, { sim: () => this.sim });
      this.scene.bringToTop('HudScene');
    } else if (!inside && this.scene.isActive(SHOP_SCENE)) this.scene.stop(SHOP_SCENE);
    this.runAudio?.sync(s.story.run);
    this.drawStick();
    this.worldRenderer.setPathPreview(s.player.waypoints.length ? [s.player.pos, ...s.player.waypoints] : null);
    this.plots.sync(s.farm.plots);
    this.equipment.sync(s.processing.equipment);
    if (s.cafe) this.customers?.sync(s.cafe.customers, s.cafe.heldDrink?.orderId ?? null);
    this.glows?.sync(s);
    this.decor?.sync(s.decor);
    this.employees?.sync(s.employees.hired);
    this.storyView?.sync(s);
    this.gardenFx?.sync(s.story.garden);
    this.gardenAudio?.sync(s.story.garden);
    this.autosave.update(time);
  }

  /** Commit state with the destination map, then rebuild the world (and HUD) from the save. */
  private travel(map: string): void {
    this.travelling = true;
    this.pendingTravel = null;
    this.sim.prepareTravel(map);
    this.session.saves!.save(this.sim.state, this.sim.clock.now());
    this.scene.stop('HudScene');
    this.scene.restart({ mapId: map, persistent: true });
  }

  /** While decorating, the furniture panel covers the right edge: the map is re-fitted into the space left of it. */
  private decorInset = 0;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private dragMid: { x: number; y: number } | null = null;

  private frameCamera(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const world = this.sim.world;
    const inset = this.decorInset;
    const bottom = 90 * hudScale(w, h);
    const none = { top: 0, right: inset, bottom, left: 0 };
    if (fitWholeMap()) {
      // Dev / automated browsers: show the whole map (E2E suites click tiles anywhere on it).
      const zoom = Math.min((w - inset) / ((world.width + world.height) * 64), (h - bottom) / ((world.width + world.height) * 32 + 80)) * 0.94;
      this.worldRenderer.frame(world.width, world.height, none, zoom);
      return;
    }
    const base = worldViewInsets(w, h);
    const mode = CAMERA_MODE[this.sim.map.id];
    const zoom = mode ? framingZoom(mode, w - inset, h, mapRect(world.width, world.height)) : worldZoom(w - inset, h, world.width, world.height);
    const reach = CAMERA_REACH[this.sim.map.id];
    this.worldRenderer.setReach(reach?.west ?? 0, reach?.east ?? 0);
    this.worldRenderer.frame(world.width, world.height, { ...base, right: base.right + inset }, zoom);
  }

  /**
   * Chapter-1 run: WASD / arrows or the drag joystick steer the hero directly.
   * Directions are on screen (up = up the screen), turned into map directions
   * through the isometric projection.
   */
  private runControls(): void {
    if (!this.sim.run && !this.sim.garden) return;
    const k = this.moveKeys, c = this.cursors;
    const down = (a?: Phaser.Input.Keyboard.Key, b?: Phaser.Input.Keyboard.Key) => (a?.isDown || b?.isDown ? 1 : 0);
    let sx = down(k?.D, c?.right) - down(k?.A, c?.left);
    let sy = down(k?.S, c?.down) - down(k?.W, c?.up);
    const st = this.stick;
    if (sx === 0 && sy === 0 && st?.on && !(this.input.pointer1.isDown && this.input.pointer2.isDown)) {
      sx = st.cx - st.x;
      sy = st.cy - st.y;
    }
    const modal = (this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen;
    if (modal || (sx === 0 && sy === 0)) return this.sim.steer(0, 0);
    const a = sx / 64, b = sy / 32;
    this.sim.steer((a + b) / 2, (b - a) / 2);
  }

  /** Joystick ring and knob under the finger while dragging. */
  private drawStick(): void {
    const g = this.stickGfx, st = this.stick;
    if (!g) return;
    g.clear();
    if (!st?.on) return;
    const cam = this.cameras.main, z = cam.zoom;
    const o = cam.getWorldPoint(st.x, st.y);
    const len = Math.min(48, Math.hypot(st.cx - st.x, st.cy - st.y));
    const ang = Math.atan2(st.cy - st.y, st.cx - st.x);
    const kx = o.x + (Math.cos(ang) * len) / z, ky = o.y + (Math.sin(ang) * len) / z;
    g.fillStyle(0xfff6e5, .35).fillCircle(o.x, o.y, 56 / z).lineStyle(3 / z, 0x5a3825, .6).strokeCircle(o.x, o.y, 56 / z);
    g.fillStyle(0xff7f6b, .9).fillCircle(kx, ky, 22 / z).lineStyle(3 / z, 0x5a3825).strokeCircle(kx, ky, 22 / z);
  }

  /** A click or tap on the world: talk to whoever is there, otherwise go there / use what is there. */
  private clickAt(p: Phaser.Input.Pointer): void {
      // A second finger is a camera gesture (two-finger pan), not a click.
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) return;
      // Inside a shop, taps belong to the shop's room.
      if (this.sim.street?.inside) return;
      this.worldRenderer.resetPan(); // a click on the world brings the camera back to the player
      // Chapter 1: tapping a person talks to them.
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const npc = this.streetView?.npcAt(w.x, w.y);
      if (npc) return this.sim.talkTo(npc);
      const target = this.pointerTarget(p);
      if (this.sim.decor.isActive) {
        // Decorating: a selected piece goes onto the floor tile under the pointer; otherwise pick up what is clicked.
        if (!this.sim.decor.hasSelection && target.objectId) this.sim.clickObject(target.objectId);
        else this.sim.clickTile(target.tile);
        return;
      }
      if (target.customerId) this.sim.clickCustomer(target.customerId);
      else if (target.objectId) this.sim.clickObject(target.objectId);
      else this.sim.clickTile(target.tile);
  }

  /** Arrow keys pan (except in the chapter-1 run, where they move the hero); two-finger drag pans. */
  private cameraGestures(delta: number): void {
    const c = this.cursors;
    if (c && !this.sim.run && !this.sim.garden && (c.left.isDown || c.right.isDown || c.up.isDown || c.down.isDown) && !(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen) {
      const v = 0.6 * delta;
      this.worldRenderer.panBy((c.right.isDown ? v : 0) - (c.left.isDown ? v : 0), (c.down.isDown ? v : 0) - (c.up.isDown ? v : 0));
    }
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (a.isDown && b.isDown) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.dragMid) this.worldRenderer.panBy(-(mid.x - this.dragMid.x), -(mid.y - this.dragMid.y));
      this.dragMid = mid;
    } else this.dragMid = null;
  }

  /** Pointer → tile, using the camera's own inverse transform. */
  pointerTile(p: { x: number; y: number }): TilePos {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return worldToTile(screenToWorld({ x: w.x, y: w.y }));
  }

  /**
   * What the player is pointing at: the front-most object whose drawn shape
   * is under the pointer, otherwise the floor tile under it.
   */
  pointerTarget(p: { x: number; y: number }): { customerId: string | null; objectId: string | null; tile: TilePos } {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const candidate = this.customers?.customerAtPoint(w.x, w.y) ?? null;
    // Departing customers must not block coins or dirty tables underneath them.
    const customerId = candidate && this.sim.cafe?.customer(candidate)?.fsm.is('LEAVING') ? null : candidate;
    return {
      customerId,
      objectId: this.worldRenderer.objectAtPoint(w.x, w.y),
      tile: worldToTile(screenToWorld({ x: w.x, y: w.y })),
    };
  }

  /** Render-space point on a customer's body (test bridge). */
  customerClickPoint(id: string): { x: number; y: number } | null {
    const c = this.sim.cafe?.customer(id);
    if (!c) return null;
    const s = worldToScreen(c.actor.pos);
    return { x: s.x, y: s.y - 22 };
  }

  /** Render-space point → screen (canvas) pixels; inverse of the camera transform. */
  renderToCanvas(px: number, py: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (px - cam.worldView.x) * cam.zoom + cam.x, y: (py - cam.worldView.y) * cam.zoom + cam.y };
  }

  objectClickPoint(id: string): { x: number; y: number } | null {
    return this.worldRenderer.objectClickPoint(id);
  }

  private updateHover(target: { customerId: string | null; objectId: string | null; tile: TilePos }): void {
    const decor = this.sim.decor;
    if (decor.isActive) decor.hover(this.sim.world.grid.inBounds(target.tile) ? target.tile : null);
    const obj = target.objectId ? this.sim.world.getObject(target.objectId) : undefined;
    // Decorating highlights what can be picked up; otherwise what can be used.
    const pickable = decor.isActive ? !decor.hasSelection && !!obj && decor.isFurniture(obj.id) : !!obj?.def.interaction;
    const id = pickable ? obj!.id : null;
    if (id !== this.hoveredObject) {
      this.worldRenderer.setObjectHighlight(id ?? '', id !== null);
      this.hoveredObject = id;
    }
    const ghost = decor.isActive && decor.hasSelection; // the ghost already marks the tile
    // Chapters 1 and 2 are walked with keys, joystick and taps: no tile square following the mouse there.
    const walkedFree = !!this.sim.run || !!this.sim.garden;
    this.worldRenderer.setHoverTile(!obj && !ghost && !walkedFree && this.sim.world.grid.inBounds(target.tile) ? target.tile : null);
  }
}

/**
 * Framing per map. Maps not listed (the chapter-2 garden) keep `worldZoom`:
 * the whole map on PC. The chapter-1 street is too long for that and follows the hero.
 */
/** Tiles of street past the west and east edges of the map that the camera may look at (the chapter-1 street goes on beyond the barriers). */
const CAMERA_REACH: Partial<Record<string, { west: number; east: number }>> = { incident: { west: 18, east: 21 } };
const CAMERA_MODE: Partial<Record<string, CameraMode>> = { cafe: 'cafe', master: 'cafe', farm: 'farm', sandbox: 'exploration', incident: 'story' };

/** Automated browsers (Playwright) skip the story unless the URL has ?story=1. Never in production builds. */
/** `?fit=1` (or any automated browser unless `?close=1`) shows the whole map instead of following the player. Never in production. */
function fitWholeMap(): boolean {
  if (import.meta.env.PROD) return false;
  const q = new URLSearchParams(window.location.search);
  return q.has('fit') || (navigator.webdriver === true && !q.has('close'));
}

function skipStory(): boolean {
  if (import.meta.env.PROD) return false;
  return navigator.webdriver === true && !new URLSearchParams(window.location.search).has('story');
}

function readDebugClockOffset(): number {
  try {
    const v = Number(window.localStorage.getItem('tcss.debug.clockOffset') ?? 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
