import { NavigationDebugView } from '../ui/dev/NavigationDebugView';
import { STREET_SCENE, streetCamera } from '../data/streetSceneLayout';
import Phaser from 'phaser';
import { islandCamera } from '../data/islandLayout';
import { MemoryStorage } from '../gameplay/state/SaveService';
import { installIncidentReview, readIncidentReview } from '../ui/dev/IncidentReview';
import { registerH5Frames } from '../components/render/h5Assets';
import { registerSliceFrames } from '../components/render/sliceAssets';
import { queueWorldAssets } from '../components/render/worldAssets';
import { cssSize, PIXEL_RATIO } from '../ui/layout/pixelRatio';
import { dur, MOTION } from '../ui/theme/tokens';
import { TrialEffects } from '../components/render/trialArt';
import { TrialAudio } from '../components/audio/TrialAudio';
import { IncidentRunView, runPose } from '../components/render/incidentArt';
import { RunAudio } from '../components/audio/RunAudio';
import { StreetAmbience } from '../components/render/streetAmbience';
import { StreetLifeView } from '../components/render/streetArt';
import { TRANSITION_SCENE, type TransitionScene } from './TransitionScene';
import { toggleMute } from '../core/audioPrefs';
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
  /** TEMP (dev test, `?chap=`): the chapter the boot restarts at instead of chapter 1. */
  startChapter?: string;
}

/**
 * World scene: thin adapter between Phaser (input, frame loop, drawing) and
 * the headless GameSimulation. Contains no gameplay rules.
 */
export class WorldScene extends Phaser.Scene {
  session!: GameSession;
  autosave!: Autosave;
  private worldRenderer!: PlaceholderRenderer;
  private trialFx: TrialEffects | null = null;
  private trialAudio: TrialAudio | null = null;
  /** Chapter-1 run: hazards on screen, extra movement keys and the touch joystick. */
  private runView: IncidentRunView | null = null;
  private runAudio: RunAudio | null = null;
  private streetView: StreetLifeView | null = null;
  private ambience: StreetAmbience | null = null;
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
  private navigationDebug: NavigationDebugView | null = null;
  private discardResumeDelta = false;

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
    const map = this.launchData.mapId ?? CONTENT.story.chapters[this.launchData.startChapter ?? this.launchData.state?.story.chapter ?? CONTENT.story.start]?.map;
    queueWorldAssets(this.load, this.textures, map);
  }

  create(): void {
    this.discardResumeDelta = false;
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
    this.session = createSession({ ...(readIncidentReview() ? { storage: new MemoryStorage() } : {}), ...(this.launchData.mapId ? { mapId: this.launchData.mapId } : {}), content: CONTENT, persistent: this.launchData.persistent, clock, initialState: this.launchData.state, restartStory: this.launchData.restartStory, ...(this.launchData.startChapter ? { startChapter: this.launchData.startChapter } : {}) });
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
    this.storyView = new StoryPresenter(this.worldRenderer);
    // Chapters 1 and 2 share one control scheme: WASD / arrows, drag joystick, tap to walk.
    if (this.sim.run) {
      this.runView = new IncidentRunView(this);
      this.runAudio = new RunAudio(this);
    }
    if (this.sim.street) {
      this.streetView = new StreetLifeView(this);
      // Cloud shadows, breathing light and falling leaves belong to the painted street (the tree positions are in its picture).
      if (this.textures.exists(STREET_SCENE.key)) this.ambience = new StreetAmbience(this);
      // Stall talks: 1 / 2 pick a reply (the HUD has the same two buttons).
      this.input.keyboard?.on('keydown-ONE', () => !this.isUiBlocked() && this.sim.story.chooseReply(0));
      this.input.keyboard?.on('keydown-TWO', () => !this.isUiBlocked() && this.sim.story.chooseReply(1));
    }
    if (this.sim.trial) {
      // The island painting supplies the sky and terrain in a single aligned plate.
      const door = world.getObject('portal')?.footprint;
      this.trialFx = new TrialEffects(this, { top: 1, bottom: world.height - 2 }, door ? { x: door.x + door.w / 2, y: door.y + door.h / 2 } : undefined);
      this.trialAudio = new TrialAudio(this);
      // Station questions: 1 / 2 / 3 pick a reply (the HUD has the same buttons).
      for (const [key, i] of [['ONE', 0], ['TWO', 1], ['THREE', 2]] as const) this.input.keyboard?.on(`keydown-${key}`, (event: KeyboardEvent) => !event.repeat && !this.isUiBlocked() && this.sim.story.chooseReply(i));
    }
    this.input.keyboard?.on('keydown-M', () => toggleMute(this.sound));
    this.stickGfx = this.add.graphics().setDepth(1e6 + 5);
    this.moveKeys = (this.input.keyboard?.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>) ?? null;
    // Touch steers with a floating joystick under the finger. Chapter 1 ignores map drags; taps act on release.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isUiBlocked() || this.sim.trial?.busy) return;
      if (p.rightButtonDown()) return this.sim.cancel();
      if (p.middleButtonDown()) return;
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.gestureConsumed = true;
        this.stick = this.look = null;
        this.worldRenderer.setLooking(!this.freeWalk);
        return;
      }
      this.gestureConsumed = false;
      // Touch: a floating joystick wherever the finger goes down (it shows only once the finger drags; a plain tap still taps).
      if (p.wasTouch && this.freeWalk) { if (!this.stick) this.stick = { x: p.x, y: p.y, cx: p.x, cy: p.y, on: false, id: p.id }; }
      else if (!this.look) this.look = { x: p.x, y: p.y, px: p.x, py: p.y, on: false, id: p.id };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.gestureConsumed) return;
      const st = this.stick;
      if (st && st.id === p.id) {
        st.cx = p.x; st.cy = p.y;
        if (Math.hypot(p.x - st.x, p.y - st.y) > 14 * PIXEL_RATIO) st.on = true;
      }
      const lk = this.look;
      if (lk && lk.id === p.id) {
        if (!lk.on && Math.hypot(p.x - lk.x, p.y - lk.y) > 12 * PIXEL_RATIO) { lk.on = true; this.worldRenderer.setLooking(!this.freeWalk); }
        if (lk.on && !this.freeWalk) this.worldRenderer.panBy(-(p.x - lk.px), -(p.y - lk.py));
        lk.px = p.x; lk.py = p.y;
      }
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (this.stick?.id === p.id) {
        const tapped = !this.stick.on;
        this.stick = null;
        if (tapped && !this.gestureConsumed) this.clickAt(p);
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
    // A chapter ends: the loading screen covers the screen while the next map loads (it fades out in create()).
    this.sim.bus.on('story:chapterChanged', ({ chapter }) => {
      const label = CONTENT.story.chapters[chapter]?.title ?? '';
      if (this.scene.isActive(TRANSITION_SCENE)) (this.scene.get(TRANSITION_SCENE) as TransitionScene).close(label);
      else this.scene.launch(TRANSITION_SCENE, { close: { label } });
    });
    this.sim.bus.on('world:travelRequested', ({ map }) => {
      if (!this.travelling && this.session.saves) this.pendingTravel = map;
    });

    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown() && !this.freeWalk && !this.isUiBlocked()) this.worldRenderer.panBy(-(p.x - p.prevPosition.x), -(p.y - p.prevPosition.y));
      if (!p.wasTouch && !this.look?.on) this.updateHover(this.pointerTarget(p));
    });
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.keyboard?.on('keydown-ESC', () => this.sim.cancel());

    // Persist when the tab is hidden or closed (best effort; autosave covers the rest).
    const flush = () => this.autosave.saveNow();
    const stopInput = () => this.resetMovementInput();
    const onVisibility = () => {
      this.discardResumeDelta = true;
      if (document.hidden) { stopInput(); flush(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', stopInput);
    window.addEventListener('pointercancel', stopInput);
    this.scale.on(Phaser.Scale.Events.RESIZE, stopInput);
    window.addEventListener('pagehide', flush);

    this.scene.launch('HudScene', { session: this.session, loadFailures: this.loadFailures });
    // Arriving from another chapter: the loading screen fades out on this map.
    if (this.scene.isActive(TRANSITION_SCENE)) (this.scene.get(TRANSITION_SCENE) as TransitionScene).open();
    // Chapter 3 is not part of this build yet: once it has loaded, a "coming soon" card replaces it.
    if (this.sim.story.chapterId === 'S05') this.showComingSoon();
    if (import.meta.env.DEV) this.navigationDebug = new NavigationDebugView(this, this.sim);
    installTestBridge(this);
    if (import.meta.env.DEV) installIncidentReview(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.frameCamera, this);
      if (!this.travelling) flush(); // travel already saved with the destination map
      this.navigationDebug?.destroy();
      this.navigationDebug = null;
      this.storyView = null;
      this.trialFx?.destroy();
      this.trialFx = null;
      this.trialAudio?.destroy();
      this.trialAudio = null;
      this.runView?.destroy();
      this.runView = null;
      this.runAudio?.destroy();
      this.runAudio = null;
      this.streetView?.destroy();
      this.streetView = null;
      this.ambience?.destroy();
      this.ambience = null;
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
    const blocked = this.isUiBlocked() || !!this.sim.trial?.busy;
    if (blocked !== this.uiBlocked) { this.resetMovementInput(); this.uiBlocked = blocked; }
    this.runControls();
    // Reading settings must not leave the street's hazards running behind the menu.
    const elapsed = this.discardResumeDelta ? 0 : delta;
    this.discardResumeDelta = false;
    if (!document.hidden && !(this.freeWalk && (this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen)) this.sim.tick(elapsed);
    this.cameraGestures(delta);
    const s = this.sim.snapshot();
    this.session.frame = s;
    this.navigationDebug?.update(s);
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
    this.ambience?.update(delta);
    // Chapter 1: the ambulance vanishes into the magic circle in a flash of light (then the doors close on chapter 2).
    const portal = s.story.street?.portal;
    if (portal && portal.k > 0.85 && !this.portalFlashed) {
      this.portalFlashed = true;
      if (dur(MOTION.base) > 0) this.cameras.main.flash(650, 210, 245, 255);
    }
    this.runAudio?.sync(s.story.run, s.story.street, s.player.state === 'MOVING', !!(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen, s.player.pos);
    this.drawStick();
    this.worldRenderer.setPathPreview(s.player.waypoints.length ? [s.player.pos, ...s.player.waypoints] : null);
    this.storyView?.sync(s);
    this.trialFx?.sync(s.story.trial, s.player.pos);
    this.trialAudio?.sync(s.story.trial, !!(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen);
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
    // Layout in CSS pixels; the renderer turns the zoom into device pixels.
    const { w, h } = cssSize(this);
    const world = this.sim.world;
    const bottom = 90 * hudScale(w, h);
    const none = { top: 0, right: 0, bottom, left: 0 };
    if (this.sim.trial && CONTENT.trials.layout === 'island') {
      const { zoom } = islandCamera(w, h);
      this.worldRenderer.frame(world.width, world.height, none, zoom);
      return;
    }
    if (this.sim.street && this.textures.exists(STREET_SCENE.key)) {
      this.worldRenderer.frame(world.width, world.height, none, streetCamera(w, h).zoom);
      return;
    }
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

  /** Chapter 3 is off for now: the world and the HUD stop, sound goes quiet, a card says it is coming (with the karma carried from chapter 2) and offers chapter 1 again. */
  private showComingSoon(): void {
    if (document.getElementById('soon')) return;
    this.time.delayedCall(50, () => {
      this.scene.pause();
      if (this.scene.isActive('HudScene')) this.scene.pause('HudScene');
      this.sound.mute = true;
    });
    const card = document.createElement('div');
    card.id = 'soon';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'Sắp ra mắt');
    const karma = this.sim.state.counters['trial:karma'] ?? 0;
    const lessons = new Map(this.sim.content.trials.stations.flatMap((s) => s.questions.map((q) => [q.id, q.lesson] as const)));
    const carried = Object.entries(this.sim.state.counters)
      .filter(([key]) => key.startsWith('trial:lesson:') && lessons.has(key.slice(13)))
      .sort(([, a], [, b]) => a - b).map(([key]) => lessons.get(key.slice(13))!);
    card.innerHTML = '<div class="card"><div class="kicker">CHƯƠNG 3 · QUÁN CÀ PHÊ TRÙNG SINH</div><div class="title">Sắp ra mắt</div><p></p><details><summary></summary><ol></ol></details><button type="button">Chơi lại chương 1</button></div>';
    card.querySelector('p')!.textContent = `Bạn đã trùng sinh thành chủ một quán cà phê nhỏ, mang theo ${karma} điểm Phúc Đức và ${carried.length} lời nhắn. Chương này đang được xây dựng, hẹn bạn sớm nhé!`;
    card.querySelector('summary')!.textContent = `Xem lại ${carried.length} lời nhắn`;
    card.querySelector('details')!.hidden = carried.length === 0;
    const list = card.querySelector('ol')!;
    for (const lesson of carried) {
      const item = document.createElement('li');
      item.textContent = lesson;
      list.appendChild(item);
    }
    // Clear chapter overrides too: reload would restart chapter 2 when entered via ?chap=2.
    card.querySelector('button')!.addEventListener('click', () => window.location.assign(window.location.pathname));
    document.body.appendChild(card);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => card.remove());
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
    if (this.freeWalk) this.sim.playerInteraction.cancelAll('superseded', false);
    this.worldRenderer.setLooking(false);
  }

  /**
   * Chapter-1 run: WASD / arrows or the drag joystick steer the hero directly.
   * Directions are on screen (up = up the screen), turned into map directions
   * through the isometric projection.
   */
  private runControls(): void {
    if (!this.freeWalk) return;
    const k = this.moveKeys, c = this.cursors;
    const down = (a?: Phaser.Input.Keyboard.Key, b?: Phaser.Input.Keyboard.Key) => (a?.isDown || b?.isDown ? 1 : 0);
    let sx = down(k?.D, c?.right) - down(k?.A, c?.left);
    let sy = down(k?.S, c?.down) - down(k?.W, c?.up);
    const st = this.stick;
    if (sx === 0 && sy === 0 && st?.on && !(this.input.pointer1.isDown && this.input.pointer2.isDown)) {
      sx = st.cx - st.x;
      sy = st.cy - st.y;
    }
    const modal = this.isUiBlocked() || this.sim.trial?.busy;
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
    if (this.isUiBlocked() || this.sim.trial?.busy) return;
    if (!this.freeWalk || navigator.maxTouchPoints === 0) return;
    // Nothing on screen until the finger actually steers.
    if (!st?.on) return;
    const origin = st;
    // Sized in CSS pixels (the finger's drag is in device pixels).
    const cam = this.cameras.main, z = cam.zoom / PIXEL_RATIO;
    const o = cam.getWorldPoint(origin.x, origin.y);
    const len = Math.min(48, st?.on ? Math.hypot(st.cx - st.x, st.cy - st.y) / PIXEL_RATIO : 0);
    const ang = st ? Math.atan2(st.cy - st.y, st.cx - st.x) : 0;
    const kx = o.x + (Math.cos(ang) * len) / z, ky = o.y + (Math.sin(ang) * len) / z;
    g.fillStyle(0xfff6e5, .35).fillCircle(o.x, o.y, 56 / z).lineStyle(3 / z, 0x5a3825, .6).strokeCircle(o.x, o.y, 56 / z);
    g.fillStyle(0xff7f6b, .9).fillCircle(kx, ky, 22 / z).lineStyle(3 / z, 0x5a3825).strokeCircle(kx, ky, 22 / z);
  }

  /** A click or tap on the world: talk to whoever is there, otherwise go there / use what is there. */
  private clickAt(p: Phaser.Input.Pointer): void {
      if (this.isUiBlocked() || this.sim.trial?.busy || this.gestureConsumed) return;
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

  /** Chapters 1 and 2 are walked freely: the camera stays on the hero, the map is never dragged. */
  private get freeWalk(): boolean {
    return !!this.sim.walker;
  }

  /** Arrow keys pan (except in chapters 1 and 2, where they move the hero); two-finger drag pans. */
  private cameraGestures(delta: number): void {
    if (this.freeWalk) {
      this.dragMid = null;
      this.worldRenderer.resetPan();
      this.worldRenderer.setLooking(false);
      return;
    }
    const c = this.cursors;
    if (c && !this.freeWalk && (c.left.isDown || c.right.isDown || c.up.isDown || c.down.isDown) && !(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen) {
      const v = 0.6 * delta * PIXEL_RATIO;
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
    const walkedFree = this.freeWalk;
    this.worldRenderer.setHoverTile(!obj && !walkedFree && this.sim.world.grid.inBounds(target.tile) ? target.tile : null);
  }
}

/**
 * Framing per map. Maps not listed keep `worldZoom`: the whole map on PC. The chapter-1
 * street and the chapter-2 road are too long for that and follow the hero.
 */
/** Tiles of street past the west and east edges of the map that the camera may look at (the chapter-1 street goes on beyond the barriers). */
const CAMERA_REACH: Partial<Record<string, { west: number; east: number }>> = { incident: { west: 18, east: 21 } };
const CAMERA_MODE: Partial<Record<string, CameraMode>> = { incident: 'story', afterlife: 'story' };

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
