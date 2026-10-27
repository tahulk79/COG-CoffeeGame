import Phaser from 'phaser';
import { H5_ASSETS, registerH5Frames } from '../components/render/h5Assets';
import { ForestEffects } from '../components/render/forestArt';
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
  private forestEffects: ForestEffects | null = null;
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
    for (const a of Object.values(H5_ASSETS)) if (!this.textures.exists(a.key)) this.load.image(a.key, a.url);
    for (const a of Object.values(STORY_ASSETS)) if (!this.textures.exists(a.key)) this.load.image(a.key, a.url);
  }

  create(): void {
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

    this.forestEffects = this.sim.map.id === 'portal' ? new ForestEffects(this, world) : null;
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
    this.sim.bus.on('meta:achievement', ({ label }) => this.worldRenderer.showFeedback(this.sim.player.pos, t('meta.achievement', { name: label }), 'ok'));

    this.decor = this.sim.decor.available
      ? new DecorPresenter(this.sim.bus, world, this.worldRenderer, (type) => CONTENT.items[CONTENT.furniture.catalog[type]?.itemId ?? '']?.label ?? type, (id) => {
          if (this.hoveredObject !== id) return;
          this.worldRenderer.setObjectHighlight('', false);
          this.hoveredObject = null;
        })
      : null;

    // Travel: commit state with the destination, then rebuild the world from the save.
    this.sim.bus.on('world:travelRequested', ({ map }) => {
      if (!this.travelling && this.session.saves) this.pendingTravel = map;
    });

    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) return; // middle button drags the camera
      if (p.rightButtonDown()) return this.sim.cancel();
      // A second finger is a camera gesture (pinch / two-finger pan), not a click.
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) return;
      this.worldRenderer.resetPan(); // a click on the world brings the camera back to the player
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
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) this.worldRenderer.panBy(-(p.x - p.prevPosition.x), -(p.y - p.prevPosition.y));
      this.updateHover(this.pointerTarget(p));
    });
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.keyboard?.on('keydown-ESC', () => this.sim.cancel());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen) this.setUserZoom(this.userZoom * (dy > 0 ? 0.9 : 1.1));
    });
    this.input.keyboard?.on('keydown-PLUS', () => this.setUserZoom(this.userZoom * 1.15));
    this.input.keyboard?.on('keydown-MINUS', () => this.setUserZoom(this.userZoom / 1.15));
    this.input.keyboard?.on('keydown-R', () => this.sim.decor.isActive && this.sim.decor.rotate());

    // Persist when the tab is hidden or closed (best effort; autosave covers the rest).
    const flush = () => this.autosave.saveNow();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    this.scene.launch('HudScene', { session: this.session });
    installTestBridge(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.travelling) flush(); // travel already saved with the destination map
      this.customers?.destroy();
      this.customers = null;
      this.decor?.destroy();
      this.decor = null;
      this.employees?.destroy();
      this.employees = null;
      this.storyView = null;
      this.forestEffects = null;
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
    this.worldRenderer.follow(s.player.pos, delta);
    this.worldRenderer.focusLabels(s.player.pos, this.hoveredObject);
    const cur = s.interaction.current;
    this.playerView.update({
      pos: s.player.pos,
      state: s.player.state,
      facing: s.player.facing,
      // A drink shows as its recipe name rather than its internal id.
      heldItem: s.story.rescued && s.story.chapter === 'S03' ? 'Mèo con' : s.cafe?.heldDrink ? (CONTENT.recipes[s.cafe.heldDrink.recipeId]?.label ?? s.player.heldItem) : s.player.heldItem,
      progress: cur?.phase === 'work' ? cur.progress : null,
    });
    this.worldRenderer.setPathPreview(s.player.waypoints.length ? [s.player.pos, ...s.player.waypoints] : null);
    this.plots.sync(s.farm.plots);
    this.equipment.sync(s.processing.equipment);
    if (s.cafe) this.customers?.sync(s.cafe.customers, s.cafe.heldDrink?.orderId ?? null);
    this.glows?.sync(s);
    this.decor?.sync(s.decor);
    this.employees?.sync(s.employees.hired);
    this.storyView?.sync(s);
    this.forestEffects?.sync(s);
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
  /** Player zoom preference (mouse wheel, + / -), remembered between sessions. */
  private userZoom = readUserZoom();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };

  private setUserZoom(z: number): void {
    this.userZoom = Math.max(0.6, Math.min(2.4, z));
    try {
      window.localStorage.setItem('tcss.ui.zoom', String(this.userZoom));
    } catch {
      /* storage blocked: the preference lasts for this session only */
    }
    this.frameCamera();
  }

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
      this.worldRenderer.frame(world.width, world.height, none, zoom * this.userZoom);
      return;
    }
    const base = worldViewInsets(w, h);
    const zoom = worldZoom(w - inset, h, world.width, world.height);
    this.worldRenderer.frame(world.width, world.height, { ...base, right: base.right + inset + (this.sim.map.id === 'incident' && h > w ? w * .45 : 0) }, zoom * this.userZoom);
  }

  /** Arrow keys pan; two fingers pinch to zoom and drag to pan. Zoom stays within the preference limits. */
  private cameraGestures(delta: number): void {
    const c = this.cursors;
    if (c && (c.left.isDown || c.right.isDown || c.up.isDown || c.down.isDown) && !(this.scene.get('HudScene') as { modalOpen?: boolean }).modalOpen) {
      const v = 0.6 * delta;
      this.worldRenderer.panBy((c.right.isDown ? v : 0) - (c.left.isDown ? v : 0), (c.down.isDown ? v : 0) - (c.up.isDown ? v : 0));
    }
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (a.isDown && b.isDown) {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinchDist > 0) {
        this.setUserZoom(this.userZoom * (dist / this.pinchDist));
        this.worldRenderer.panBy(-(mid.x - this.pinchMid.x), -(mid.y - this.pinchMid.y));
      }
      this.pinchDist = dist;
      this.pinchMid = mid;
    } else this.pinchDist = 0;
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
    this.worldRenderer.setHoverTile(!obj && !ghost && this.sim.world.grid.inBounds(target.tile) ? target.tile : null);
  }
}

/** Automated browsers (Playwright) skip the story unless the URL has ?story=1. Never in production builds. */
/** `?fit=1` (or any automated browser unless `?close=1`) shows the whole map instead of following the player. Never in production. */
function fitWholeMap(): boolean {
  if (import.meta.env.PROD) return false;
  const q = new URLSearchParams(window.location.search);
  return q.has('fit') || (navigator.webdriver === true && !q.has('close'));
}

function readUserZoom(): number {
  try {
    const v = Number(window.localStorage.getItem('tcss.ui.zoom') ?? 1);
    return Number.isFinite(v) && v >= 0.6 && v <= 2.4 ? v : 1;
  } catch {
    return 1;
  }
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
