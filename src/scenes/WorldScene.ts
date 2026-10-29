import Phaser from 'phaser';
import { MemoryStorage } from '../gameplay/state/SaveService';
import { installIncidentReview, readIncidentReview } from '../ui/dev/IncidentReview';
import { ART_READY, H5_ASSETS, registerH5Frames } from '../components/render/h5Assets';
import { SLICE_ASSETS, registerSliceFrames } from '../components/render/sliceAssets';
import { dur, MOTION } from '../ui/theme/tokens';
import { GardenEffects } from '../components/render/gardenArt';
import { GardenAudio } from '../components/audio/GardenAudio';
import { IncidentRunView, runPose } from '../components/render/incidentArt';
import { RunAudio } from '../components/audio/RunAudio';
import { StreetLifeView } from '../components/render/streetArt';
import { TRANSITION_SCENE, type TransitionScene } from './TransitionScene';
import { toggleMute } from '../core/audioPrefs';
import { STORY_ASSETS } from '../components/render/storyAssets';
import { CONTENT } from '../data/content';
import { Autosave, createSession, type GameSession } from '../core/session';
import { SystemClock } from '../core/Clock';
import type { GameState } from '../gameplay/state/GameState';
import type { GameSimulation } from '../gameplay/GameSimulation';
import { PlaceholderRenderer } from '../components/render/PlaceholderRenderer';
import type { ActorView } from '../components/render/WorldRenderer';
import { StoryPresenter } from '../components/presenters/StoryPresenter';
import { FeedbackPresenter } from '../ui/FeedbackPresenter';
import { installTestBridge } from '../core/testBridge';
import { readSafeInsets } from '../ui/layout/HudLayout';
import { hudScale, worldViewInsets, worldZoom } from '../ui/layout/viewInsets';
import { framingZoom, mapRect, type CameraMode } from '../systems/camera/framing';
import { screenToWorld } from '../utils/iso';
import { worldToTile, type TilePos } from '../utils/tile';

export const WORLD_SCENE = 'WorldScene';

export interface WorldSceneData {
  /** Omitted = resume the map the save was on. */
  mapId?: string;
  persistent: boolean;
  /** Dev/test only: start from a fresh game, discarding the stored save. */
  fresh?: boolean;
  /** Carry progress across scenes without depending on a successful storage write. */
  state?: GameState;
  /** Only the page boot sets this; scene travel carries the live state instead. */
  restartStory?: boolean;
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
  /** A drag outside the joystick pans; `on` distinguishes it from a tap. */
  private look: { x: number; y: number; px: number; py: number; on: boolean; id: number } | null = null;
  private stickGfx: Phaser.GameObjects.Graphics | null = null;
  private playerView!: ActorView;
  private feedback!: FeedbackPresenter;
  private storyView: StoryPresenter | null = null;
  private gestureConsumed = false;
  private travelling = false;
  /** Set by the travel event; performed at the start of the next frame, never mid-tick. */
  private pendingTravel: string | null = null;
  private hoveredObject: string | null = null;
  private launchData!: WorldSceneData;
  private uiBlocked = false;
  private loadFailures = 0;

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
    this.loadFailures = 0;
    const failed = () => { this.loadFailures++; };
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed));
    for (const a of [...Object.values(H5_ASSETS), ...Object.values(STORY_ASSETS)]) if (ART_READY.has(a.key) && !this.textures.exists(a.key)) this.load.image(a.key, a.url);
    for (const a of Object.values(SLICE_ASSETS)) if (!this.textures.exists(a.key)) this.load.image(a.key, a.url);
  }

  create(): void {
    this.portalFlashed = false;
    this.uiBlocked = false;
    this.stick = this.look = null;
    this.dragMid = null;
    this.gestureConsumed = false;
    const clock = new SystemClock(import.meta.env.PROD ? 0 : readDebugClockOffset());
    if (this.launchData.fresh && !import.meta.env.PROD && !readIncidentReview()) window.localStorage.removeItem('tcss.save.slot1');
    this.travelling = false;
    this.pendingTravel = null;
    this.hoveredObject = null; // scene instances are reused on restart
    this.session = createSession({ ...(readIncidentReview() ? { storage: new MemoryStorage() } : {}), ...(this.launchData.mapId ? { mapId: this.launchData.mapId } : {}), content: CONTENT, persistent: this.launchData.persistent, clock, initialState: this.launchData.state, restartStory: this.launchData.restartStory });
    this.autosave = new Autosave(this.session);
    const world = this.sim.world;

    registerH5Frames(this);
    registerSliceFrames(this);
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
    this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.frameCamera, this);

    this.playerView = this.worldRenderer.createActor('player', 'player');
    this.feedback = new FeedbackPresenter(this.sim.bus, world, this.worldRenderer, () => this.sim.player.pos);
    this.storyView = new StoryPresenter(this.worldRenderer, world, CONTENT.story.stones);
    // Chapters 1 and 2 share one control scheme: WASD / arrows, drag joystick, tap to walk.
    if (this.sim.run) {
      this.runView = new IncidentRunView(this);
      this.runAudio = new RunAudio(this);
    }
    if (this.sim.street) {
      this.streetView = new StreetLifeView(this);
      // Stall talks: 1 / 2 pick a reply (the HUD has the same two buttons).
      this.input.keyboard?.on('keydown-ONE', () => !this.isUiBlocked() && this.sim.story.chooseReply(0));
      this.input.keyboard?.on('keydown-TWO', () => !this.isUiBlocked() && this.sim.story.chooseReply(1));
    }
    if (this.sim.garden) {
      this.gardenFx = new GardenEffects(this, (id) => { const o = world.getObject(id); return o ? { x: o.footprint.x + o.footprint.w / 2, y: o.footprint.y + o.footprint.h / 2 } : null; });
      this.gardenAudio = new GardenAudio(this);
    }
    this.input.keyboard?.on('keydown-M', () => toggleMute(this.sound));
    this.stickGfx = this.add.graphics().setDepth(1e6 + 5);
    this.moveKeys = (this.input.keyboard?.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>) ?? null;
    // The bottom-left ring steers. Chapter 1 ignores map drags; taps act on release.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isUiBlocked()) return;
      if (p.rightButtonDown()) return this.sim.cancel();
      if (p.middleButtonDown()) return;
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.gestureConsumed = true;
        this.stick = this.look = null;
        this.worldRenderer.setLooking(!this.sim.run);
        return;
      }
      this.gestureConsumed = false;
      const origin = this.stickOrigin();
      if (p.wasTouch && (this.sim.run || this.sim.garden) && Math.hypot(p.x - origin.x, p.y - origin.y) < 64) { if (!this.stick) this.stick = { x: origin.x, y: origin.y, cx: p.x, cy: p.y, on: false, id: p.id }; }
      else if (!this.look) this.look = { x: p.x, y: p.y, px: p.x, py: p.y, on: false, id: p.id };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.gestureConsumed) return;
      const st = this.stick;
      if (st && st.id === p.id) {
        st.cx = p.x; st.cy = p.y;
        if (Math.hypot(p.x - st.x, p.y - st.y) > 14) st.on = true;
      }
      const lk = this.look;
      if (lk && lk.id === p.id) {
        if (!lk.on && Math.hypot(p.x - lk.x, p.y - lk.y) > 12) { lk.on = true; this.worldRenderer.setLooking(!this.sim.run); }
        if (lk.on && !this.sim.run) this.worldRenderer.panBy(-(p.x - lk.px), -(p.y - lk.py));
        lk.px = p.x; lk.py = p.y;
      }
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (this.stick?.id === p.id) {
        this.stick = null;
      }
      if (this.look?.id === p.id) {
        const dragged = this.look.on;
        this.look = null;
        this.worldRenderer.setLooking(false);
        if (!dragged && !this.gestureConsumed) this.clickAt(p);
      }
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => this.resetMovementInput());

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
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown() && !this.sim.run && !this.isUiBlocked()) this.worldRenderer.panBy(-(p.x - p.prevPosition.x), -(p.y - p.prevPosition.y));
      if (!p.wasTouch && !this.look?.on) this.updateHover(this.pointerTarget(p));
    });
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.keyboard?.on('keydown-ESC', () => this.sim.cancel());

    // Persist when the tab is hidden or closed (best effort; autosave covers the rest).
    const flush = () => this.autosave.saveNow();
    const stopInput = () => this.resetMovementInput();
    const onVisibility = () => { if (document.visibilityState === 'hidden') { stopInput(); flush(); } };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', stopInput);
    window.addEventListener('pointercancel', stopInput);
    this.scale.on(Phaser.Scale.Events.RESIZE, stopInput);
    window.addEventListener('pagehide', flush);

    this.scene.launch('HudScene', { session: this.session, loadFailures: this.loadFailures });
    // Arriving through the story doors: they swing open on this map.
    if (this.scene.isActive(TRANSITION_SCENE)) (this.scene.get(TRANSITION_SCENE) as TransitionScene).open();
    installTestBridge(this);
    if (import.meta.env.DEV) installIncidentReview(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.frameCamera, this);
      if (!this.travelling) flush(); // travel already saved with the destination map
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
      this.stick = this.look = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', stopInput);
      window.removeEventListener('pointercancel', stopInput);
      this.scale.off(Phaser.Scale.Events.RESIZE, stopInput);
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
    const blocked = this.isUiBlocked();
    if (blocked !== this.uiBlocked) { this.resetMovementInput(); this.uiBlocked = blocked; }
    this.runControls();
    // Reading settings must not leave the street's hazards running behind the menu.
    if (!((this.sim.run || this.sim.garden) && (this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen)) this.sim.tick(delta);
    this.cameraGestures(delta);
    const s = this.sim.snapshot();
    this.session.frame = s;
    // Chapter 1 rescue: once the hero is inside, the camera rides along with the ambulance into the magic circle.
    this.worldRenderer.follow(s.story.street?.focus ?? s.player.pos, delta);
    this.worldRenderer.focusLabels(s.player.pos, this.hoveredObject);
    const cur = s.interaction.current;
    const pose = this.runView ? runPose(s.story.run) : null;
    if (pose) this.playerView.setPose?.(pose.sx, pose.sy, pose.dy - 8 * (s.story.street?.carryLift ?? 0), pose.angle);
    this.playerView.update({
      pos: s.player.pos,
      state: s.player.state,
      facing: s.player.facing,
      reaction: s.story.street?.carried ? 'carry' : s.story.run?.down ? 'down' : s.story.run?.hit ? s.story.run.hit.t < .3 ? 'stumble' : 'fall' : undefined,
      heldItem: s.player.heldItem,
      progress: cur?.phase === 'work' ? cur.progress : null,
    });
    if (pose) this.playerView.setAlpha?.(s.story.street?.heroHidden ? 0 : pose.alpha);
    this.runView?.sync(s.story.run, this.sim.player.pos, !!s.story.street?.heroHidden);
    this.streetView?.sync(s.story.street, this.sim.player.pos, s.story.run?.say ?? null);
    // Chapter 1: the ambulance vanishes into the magic circle in a flash of light (then the doors close on chapter 2).
    const portal = s.story.street?.portal;
    if (portal && portal.k > 0.85 && !this.portalFlashed) {
      this.portalFlashed = true;
      if (dur(MOTION.base) > 0) this.cameras.main.flash(650, 210, 245, 255);
    }
    this.runAudio?.sync(s.story.run, s.story.street, s.player.state === 'MOVING', !!(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen);
    this.drawStick();
    this.worldRenderer.setPathPreview(s.player.waypoints.length ? [s.player.pos, ...s.player.waypoints] : null);
    this.storyView?.sync(s);
    this.gardenFx?.sync(s.story.garden);
    this.gardenAudio?.sync(s.story.garden, !!(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen);
    this.autosave.update(time);
  }

  /** Commit state with the destination map, then rebuild the world (and HUD) from the save. */
  private travel(map: string): void {
    this.travelling = true;
    this.pendingTravel = null;
    this.sim.prepareTravel(map);
    if (!this.session.saveBlocked && !this.session.saves!.save(this.sim.state, this.sim.clock.now())) this.sim.bus.emit('save:writeFailed', { at: this.sim.clock.now() });
    this.scene.stop('HudScene');
    this.scene.restart({ mapId: map, persistent: true, state: this.sim.state });
  }

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private dragMid: { x: number; y: number } | null = null;

  private frameCamera(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const world = this.sim.world;
    const bottom = 90 * hudScale(w, h);
    const none = { top: 0, right: 0, bottom, left: 0 };
    if (fitWholeMap()) {
      // Dev / automated browsers: show the whole map (E2E suites click tiles anywhere on it).
      const zoom = Math.min(w / ((world.width + world.height) * 64), (h - bottom) / ((world.width + world.height) * 32 + 80)) * 0.94;
      this.worldRenderer.frame(world.width, world.height, none, zoom);
      return;
    }
    const base = worldViewInsets(w, h);
    const mode = CAMERA_MODE[this.sim.map.id];
    const reach = CAMERA_REACH[this.sim.map.id];
    const zoom = mode ? framingZoom(mode, w, h, mapRect(world.width, world.height, reach)) : worldZoom(w, h, world.width, world.height);
    this.worldRenderer.setReach(reach?.west ?? 0, reach?.east ?? 0);
    this.worldRenderer.frame(world.width, world.height, base, zoom);
  }

  private stickOrigin(): { x: number; y: number } {
    const safe = readSafeInsets();
    return { x: safe.left + 82, y: this.scale.height - safe.bottom - 90 };
  }

  private isUiBlocked(): boolean {
    return this.travelling || this.pendingTravel !== null || this.sim.story.locked || !!(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen;
  }

  private resetMovementInput(): void {
    this.stick = this.look = null;
    this.dragMid = null;
    this.gestureConsumed = true;
    this.input.keyboard?.resetKeys();
    this.sim.steer(0, 0);
    if (this.sim.run || this.sim.garden) this.sim.playerInteraction.cancelAll('superseded', false);
    this.worldRenderer.setLooking(false);
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
    const modal = this.isUiBlocked();
    if (modal || (sx === 0 && sy === 0)) return this.sim.steer(0, 0);
    this.worldRenderer.resetPan();
    const a = sx / 64, b = sy / 32;
    this.sim.steer((a + b) / 2, (b - a) / 2);
  }

  /** Joystick ring and knob under the finger while dragging. */
  private drawStick(): void {
    const g = this.stickGfx, st = this.stick;
    if (!g) return;
    g.clear();
    if (this.isUiBlocked()) return;
    if (!(this.sim.run || this.sim.garden) || navigator.maxTouchPoints === 0) return;
    const origin = st ?? this.stickOrigin();
    const cam = this.cameras.main, z = cam.zoom;
    const o = cam.getWorldPoint(origin.x, origin.y);
    const len = Math.min(48, st?.on ? Math.hypot(st.cx - st.x, st.cy - st.y) : 0);
    const ang = st ? Math.atan2(st.cy - st.y, st.cx - st.x) : 0;
    const kx = o.x + (Math.cos(ang) * len) / z, ky = o.y + (Math.sin(ang) * len) / z;
    g.fillStyle(0xfff6e5, .35).fillCircle(o.x, o.y, 56 / z).lineStyle(3 / z, 0x5a3825, .6).strokeCircle(o.x, o.y, 56 / z);
    g.fillStyle(0xff7f6b, .9).fillCircle(kx, ky, 22 / z).lineStyle(3 / z, 0x5a3825).strokeCircle(kx, ky, 22 / z);
  }

  /** A click or tap on the world: talk to whoever is there, otherwise go there / use what is there. */
  private clickAt(p: Phaser.Input.Pointer): void {
      if (this.isUiBlocked() || this.gestureConsumed) return;
      // A second finger is a camera gesture (two-finger pan), not a click.
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) return;
      this.worldRenderer.resetPan(); // a click on the world brings the camera back to the player
      // Chapter 1: tapping a person talks to them.
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const npc = this.streetView?.npcAt(w.x, w.y);
      if (npc) return this.sim.talkTo(npc);
      const target = this.pointerTarget(p);
      if (target.objectId) this.sim.clickObject(target.objectId);
      else this.sim.clickTile(target.tile);
  }

  /** Arrow keys pan (except in the chapter-1 run, where they move the hero); two-finger drag pans. */
  private cameraGestures(delta: number): void {
    if (this.sim.run) {
      this.dragMid = null;
      this.worldRenderer.resetPan();
      this.worldRenderer.setLooking(false);
      return;
    }
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
    } else {
      this.dragMid = null;
      if (this.gestureConsumed) this.worldRenderer.setLooking(false);
    }
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
  pointerTarget(p: { x: number; y: number }): { objectId: string | null; tile: TilePos } {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return {
      objectId: this.worldRenderer.objectAtPoint(w.x, w.y),
      tile: worldToTile(screenToWorld({ x: w.x, y: w.y })),
    };
  }

  /** Render-space point → screen (canvas) pixels; inverse of the camera transform. */
  renderToCanvas(px: number, py: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (px - cam.worldView.x) * cam.zoom + cam.x, y: (py - cam.worldView.y) * cam.zoom + cam.y };
  }

  objectClickPoint(id: string): { x: number; y: number } | null {
    return this.worldRenderer.objectClickPoint(id);
  }

  private updateHover(target: { objectId: string | null; tile: TilePos }): void {
    const obj = target.objectId ? this.sim.world.getObject(target.objectId) : undefined;
    const id = obj?.def.interaction ? obj.id : null;
    if (id !== this.hoveredObject) {
      this.worldRenderer.setObjectHighlight(id ?? '', id !== null);
      this.hoveredObject = id;
    }
    // Chapters 1 and 2 are walked with keys, joystick and taps: no tile square following the mouse there.
    const walkedFree = !!this.sim.run || !!this.sim.garden;
    this.worldRenderer.setHoverTile(!obj && !walkedFree && this.sim.world.grid.inBounds(target.tile) ? target.tile : null);
  }
}

/**
 * Framing per map. Maps not listed (the chapter-2 garden) keep `worldZoom`:
 * the whole map on PC. The chapter-1 street is too long for that and follows the hero.
 */
/** Tiles of street past the west and east edges of the map that the camera may look at (the chapter-1 street goes on beyond the barriers). */
const CAMERA_REACH: Partial<Record<string, { west: number; east: number }>> = { incident: { west: 18, east: 21 } };
const CAMERA_MODE: Partial<Record<string, CameraMode>> = { incident: 'story' };

/** `?fit=1` (or any automated browser unless `?close=1`) shows the whole map instead of following the player. Never in production. */
function fitWholeMap(): boolean {
  if (import.meta.env.PROD) return false;
  const q = new URLSearchParams(window.location.search);
  return q.has('fit') || (navigator.webdriver === true && !q.has('close'));
}

function readDebugClockOffset(): number {
  try {
    const v = Number(window.localStorage.getItem('tcss.debug.clockOffset') ?? 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
