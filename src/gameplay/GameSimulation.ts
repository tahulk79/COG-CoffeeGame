import { hasClearance } from '../systems/navigation/smoothing';
import { planRescue } from './story/rescueRouting';
import { RegionService, type EstateView } from './regions/RegionService';
import { SystemClock, type Clock } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GameContent } from '../data/content';
import { Actor, type ActorState, type Facing } from '../entities/Actor';
import { TransactionService } from '../systems/economy/TransactionService';
import { InteractionService, type InteractionSnapshot } from '../systems/interaction/InteractionService';
import { NavigationService } from '../systems/navigation/NavigationService';
import { tileCenter, worldToTile, type TilePos, type WorldPos } from '../utils/tile';
import { ActionRegistry } from './actions/ActionRegistry';
import { registerBasicHandlers } from './actions/basicHandlers';
import { FarmService, type PlotView } from './farm/FarmService';
import { registerFarmHandlers } from './farm/farmHandlers';
import { MarketService } from './market/MarketService';
import { ProcessingService, type EquipmentView } from './processing/ProcessingService';
import { registerProcessingHandlers } from './processing/processingHandlers';
import { ShopSessionService, registerShopHandlers } from '../systems/shop/ShopSessionService';
import { Rng } from '../core/Rng';
import { CafeService, type CustomerView } from './cafe/CafeService';
import { OrderService, type Order } from './cafe/OrderService';
import { registerCafeHandlers } from './cafe/cafeHandlers';
import { BrewingService, type BrewView } from './cafe/BrewingService';
import { SupplyService } from './cafe/SupplyService';
import { RatingService } from './cafe/RatingService';
import { ProgressionService } from './progression/ProgressionService';
import type { FeedbackEntry, PaymentRecord } from './state/GameState';
import { CafeUpgradeService, sectionAreas, type UpgradeView, type TableUpgradeView } from './cafe/CafeUpgradeService';
import { NeighborService, type CafeProfile } from './social/NeighborService';
import { MetaService, type MetaView } from './meta/MetaService';
import { StoryService, type StoryView } from './story/StoryService';
import { registerStoryHandlers } from './story/storyHandlers';
import { RunService, RUN_BODY_RADIUS } from './story/RunService';
import { StreetService } from './story/StreetService';
import { GardenService } from './story/GardenService';
import { EmployeeService, type EmployeeView, type EmployeeView2 } from './employees/EmployeeService';
import { FurnitureService, type DecorView } from './decor/FurnitureService';
import { createNewGameState, type GameState, type ItemStack, type TxRecord } from './state/GameState';
import { WorldModel } from './world/WorldModel';
import type { MapData } from './world/types';

export interface GameplayConfig {
  player: {
    speedTilesPerSec: number;
    bodyRadius: number;
    engageMs: number;
    maxQueuedInteractions: number;
    blockedClickSearchRadius: number;
  };
  simulation: { maxStepMs: number };
}

export interface PlayerSnapshot {
  id: string;
  pos: WorldPos;
  tile: TilePos;
  state: ActorState;
  facing: Facing;
  heldItem: string | null;
  waypoints: WorldPos[];
}

export interface SimulationSnapshot {
  timeMs: number;
  clockMs: number;
  map: string;
  player: PlayerSnapshot;
  interaction: InteractionSnapshot;
  objects: Array<{ id: string; counters: Record<string, number> }>;
  economy: { coins: number; exp: number; inventory: Record<string, ItemStack>; itemCount: number; capacity: number; lastTx: TxRecord | null };
  farm: { plots: PlotView[]; can: { water: number; capacity: number }; selectedSeed: string | null; seedToPlant: string | null };
  /** Open shop session ('seeds' | 'market') or null. */
  shop: string | null;
  processing: { equipment: EquipmentView[]; selectedRecipe: Record<string, string | null> };
  market: { recentSales: TxRecord[] };
  progression: { level: number; exp: number; levelStartExp: number; nextLevelExp: number };
  reputation: { value: number; traffic: number; recent: FeedbackEntry[]; served: number; failed: number };
  /** null on maps without a café floor. */
  cafe: { customers: CustomerView[]; orders: Order[]; recentOrders: Order[]; queue: string[]; freeSpots: number; brew: BrewView | null; nextToBrew: number | null; heldDrink: { id: string; recipeId: string; orderId: number; quality: number } | null; seats: Array<{ objectId: string; kind: string; state: string }>; payments: PaymentRecord[]; brewSessions: Array<{ actorId: string; orderId: number; stationObjectId: string | null; progress: number }> } | null;
  /** null on maps that can't be decorated. */
  decor: DecorView | null;
  /** M8: hired employees on this map and the roles that can be hired here. */
  employees: { hired: EmployeeView[]; roles: EmployeeView2['roles'] };
  /** M9: story chapter, objective and dialog. */
  story: StoryView;
  /** M10: regions, quests, achievements, skills, branches. */
  meta: MetaView;
  /** Café upgrades (capacity, speed, attractiveness, back room). */
  upgrades: UpgradeView[];
  tables: TableUpgradeView[];
  /** Café profiles for the world map: neighbours' and the player's own. */
  cafes: CafeProfile[];
  estates: EstateView[];
}

type MetaResultLike = { ok: true } | { ok: false; reason: string };

export interface SimulationOptions {
  /** Restored save; a new game is created when omitted. */
  state?: GameState;
  clock?: Clock;
  /** Seed for customer spawning/orders (tests pass a fixed one). */
  rngSeed?: number;
  /** Dev/test only: a new game starts with the story already finished (E2E suites start on the farm). */
  skipStory?: boolean;
}

/**
 * Root of the headless gameplay simulation. Owns world, services, actors and
 * the persistent GameState; advanced only through tick(). Rendering reads
 * snapshots and never writes.
 */
export class GameSimulation {
  readonly bus = new EventBus<GameEvents>();
  readonly world: WorldModel;
  readonly nav: NavigationService;
  readonly actions = new ActionRegistry();
  readonly state: GameState;
  readonly clock: Clock;
  readonly tx: TransactionService;
  readonly farm: FarmService;
  readonly shops: ShopSessionService;
  readonly processing: ProcessingService;
  readonly market: MarketService;
  readonly orders: OrderService;
  /** Present only on maps with a café floor (orderPoint marker). */
  readonly cafe: CafeService | null;
  readonly brewing: BrewingService;
  readonly supplies: SupplyService;
  readonly progression: ProgressionService;
  readonly rating: RatingService;
  readonly decor: FurnitureService;
  readonly employees: EmployeeService;
  readonly story: StoryService;
  readonly meta: MetaService;
  readonly upgrades: CafeUpgradeService;
  readonly neighbors: NeighborService;
  readonly regions: RegionService;
  private readonly localState: GameState;
  readonly player: Actor;
  readonly playerInteraction: InteractionService;
  readonly config: GameplayConfig;
  private timeMs = 0;
  timeScale = 1;

  constructor(
    readonly map: MapData,
    readonly content: GameContent,
    opts: SimulationOptions = {},
  ) {
    this.config = content.gameplay;
    this.clock = opts.clock ?? new SystemClock();
    const eco = content.economy;
    this.state =
      opts.state ??
      createNewGameState({
        now: this.clock.now(),
        startingCoins: eco.startingCoins,
        startingItems: eco.startingItems,
        wateringCanCapacity: eco.farm.wateringCan.capacity,
        map: map.id,
      });
    if (!opts.state && opts.skipStory) this.state.story.chapter = 'done';
    const estate = map.regionId ? this.state.regions[map.regionId] : undefined;
    if (map.regionId && (!estate || !(map.businessKind === 'cafe' ? estate.cafeBuilt : estate.farmBuilt))) {
      throw new Error(`Business not built: ${map.id}`);
    }
    const local = this.localState = estate ? { ...this.state, cafe: estate.cafe, farm: estate.farm, processing: estate.processing, employees: estate.employees } : this.state;
    this.world = new WorldModel(map, content.objectTypes);
    this.nav = new NavigationService(this.world.grid, map.id === content.story.chapters.S03?.map ? RUN_BODY_RADIUS : this.config.player.bodyRadius);
    this.tx = new TransactionService(this.state, content.items, eco, this.bus, this.clock, map.regionId);
    // Before the player is placed: a saved furniture layout changes which tiles are walkable.
    this.decor = new FurnitureService(local, this.world, content.furniture, this.tx, this.bus, this.config.player.bodyRadius, {
      actorTiles: () => [this.player.tile, ...(this.cafe?.views().map((c) => c.tile) ?? []), ...this.employees.actorTiles()],
      isSeatReserved: (id) => this.cafe?.isSpotReserved(id) ?? false,
      playerBusy: () => {
        const i = this.playerInteraction.snapshot();
        return i.current !== null || i.queue.length > 0;
      },
      playerLevel: () => this.progression.level,
    }, () => sectionAreas(local.cafe, content.cafeUpgrades));
    this.shops = new ShopSessionService(this.world, this.bus, eco.farm.shopLeaveDistance);
    this.progression = new ProgressionService(this.state, content.progression, content.seeds, this.bus);
    this.rating = new RatingService(local, content.progression, content.recipes, this.bus);
    this.meta = new MetaService(this.state, content.meta, this.bus, this.tx, this.clock, () => this.progression.level, map.id, () => this.rating.trafficFactor);
    this.regions = new RegionService(this.state, content, this.tx, () => this.progression.level, () => this.clock.now(), map.id);
    const homeReputation = () => {
      const ratings = this.state.cafe.ratings;
      return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : content.progression.reputation.start;
    };
    const homeTraffic = () => {
      const c = content.progression.reputation;
      return Math.max(c.trafficMin, Math.min(c.trafficMax, 1 + (homeReputation() - 3) * c.trafficPerStar));
    };
    this.neighbors = new NeighborService(this.state, content.neighbors, content.furniture, content.maps.cafe!, this.clock, this.tx, this.bus, homeReputation, homeTraffic, (r) => this.meta.regionLocked(r));
    this.upgrades = new CafeUpgradeService(local, content.cafeUpgrades, this.tx, this.bus, () => this.progression.level);
    this.rating.tipFactor = () => 1 + this.meta.effect('tip');
    this.farm = new FarmService(local, this.world, content.seeds, eco.farm, this.tx, this.bus, this.clock, this.shops, (id) => this.progression.isSeedUnlocked(id));
    this.processing = new ProcessingService(local, this.world, content.processing, this.tx, this.bus, this.clock);
    this.market = new MarketService(this.state, content.market, content.seeds, this.tx, this.shops, this.bus, this.clock);
    this.market.priceFactor = () => 1 + this.meta.effect('market');
    registerBasicHandlers(this.actions, this.bus);
    registerShopHandlers(this.actions, this.shops);
    registerFarmHandlers(this.actions, this.farm);
    registerProcessingHandlers(this.actions, this.processing);
    // Story chapters 1–2 move faster than everyday walking, and the same whether steered or tapped to walk.
    const storyRun = content.story.chapters.S03?.run;
    const storyMap = [content.story.chapters.S03?.map, content.story.chapters.S04?.map].includes(map.id);
    const playerCfg = storyRun && storyMap ? { ...this.config.player, speedTilesPerSec: storyRun.runSpeed } : this.config.player;
    this.player = new Actor('player', tileCenter(this.startTile()), playerCfg, () => this.timeMs);
    this.player.fsm.onTransition((from, to) => this.bus.emit('actor:stateChanged', { actorId: this.player.id, from, to }));
    this.playerInteraction = new InteractionService(this.player, this.world, this.nav, this.actions, this.bus, this.config.player);
    this.orders = new OrderService(content.recipes, this.bus, () => this.timeMs);
    this.cafe = this.world.markers('orderPoint').length
      ? new CafeService(this.world, this.nav, this.orders, content.customers, this.bus, new Rng(opts.rngSeed ?? Date.now()), () => this.timeMs, this.config.player.bodyRadius, this.tx, this.rating.policy, {
          trafficFactor: () => this.rating.trafficFactor * (1 + this.meta.effect('traffic')) * this.upgrades.trafficFactor(),
          isRecipeUnlocked: (id) => this.progression.isRecipeUnlocked(id),
          onCustomerFailed: (reason) => this.rating.recordFailure(reason),
        }, local.cafe, () => this.clock.now())
      : null;
    this.brewing = new BrewingService(this.world, this.nav, this.player, this.orders, content.recipes, content.brewing, content.items, this.tx, this.bus, () => this.timeMs);
    this.supplies = new SupplyService(content.brewing.supplies, this.tx, this.shops);
    registerCafeHandlers(this.actions, this.cafe, this.brewing, this.bus, Object.keys(content.maps), { brew: () => this.upgrades.factor('brewSpeed'), clean: () => this.upgrades.factor('cleaning') }, (id) => this.regions.canEnter(id));
    this.employees = new EmployeeService(local, this.world, this.nav, this.actions, this.bus, this.tx, this.clock, this.farm, this.cafe, this.brewing, content.employees, map.businessKind ?? map.id, this.config.player.bodyRadius, this.config.player, () => this.timeMs, () => this.progression.level, map.playerStart, () => 1 - Math.min(0.9, this.meta.effect('wage')), () => this.upgrades.factor('brewSpeed'));

    this.story = new StoryService(this.state, map.id, content.story, this.bus, this.tx, {
      resetPlayer: () => {
        this.playerInteraction.cancelAll('superseded');
        this.player.pos = tileCenter(this.map.playerStart);
      },
      spawnMaster: () => {
        // The teacher steps away from where he stood, so he is already in view (the street door can be off-screen).
        const o = this.world.getObject('master');
        const near = o && [{ x: o.footprint.x, y: o.footprint.y + 1 }, { x: o.footprint.x - 1, y: o.footprint.y }, { x: o.footprint.x + 1, y: o.footprint.y }, { x: o.footprint.x, y: o.footprint.y - 1 }].find((t) => this.world.grid.isWalkable(t));
        const c = this.cafe?.spawn('master', 'espresso', undefined, near);
        if (c) this.story.registerMaster(c.id);
      },
      hasCustomer: (id) => !!this.cafe?.hasCustomer(id),
      setCafeOpen: (open) => {
        if (this.cafe) this.cafe.open = open;
      },
      setScoreFloor: (floor) => {
        this.rating.scoreFloor = floor;
      },
    });
    registerStoryHandlers(this.actions, this.story);
    // Chapter 1 is a survival run on its own map: direct control and street hazards.
    const runCfg = content.story.chapters.S03?.run;
    if (runCfg && content.story.chapters.S03!.map === map.id) {
      const rng = new Rng(opts.rngSeed ?? Date.now());
      // Street trees, stacks of stools and parked motorbikes collide as their round shape, not a whole tile: nothing to snag on.
      const ROUND: Record<string, number> = { sau_tree: 0.28, stools: 0.32, parked_bike: 0.36 };
      const props = this.world.allObjects().filter((o) => ROUND[o.type] !== undefined)
        .map((o) => ({ x: o.footprint.x + o.footprint.w / 2, y: o.footprint.y + o.footprint.h / 2, r: ROUND[o.type]! }));
      if (this.story.active && this.story.chapterId === 'S03') this.player.pos = tileCenter(map.playerStart);
      this.run = new RunService(runCfg, this.world.grid, this.player, () => rng.next(), { w: this.world.width, h: this.world.height },
        (kind, ms) => { this.playerInteraction.cancelAll('superseded'); this.story.onDeath(kind, ms); },
        { hazards: content.story.chapters.S03!.hazards ?? {}, visited: (id) => !!this.state.story.flags[`visited:${id}`], rescue: !!(content.story.chapters.S03!.street && content.story.chapters.S03!.stalls), seen: (kind) => this.state.meta.counters[`incident:seen:${kind}`] ?? 0, markSeen: (kind) => { const key = `incident:seen:${kind}`; this.state.meta.counters[key] = (this.state.meta.counters[key] ?? 0) + 1; }, people: () => this.street?.people() ?? [], props: () => props });
      this.player.canMove = (from, to) => this.run!.canMove(from, to);
      this.player.slide = (from, to) => this.run!.resolveMove(from, to);
      this.story.attachRun(this.run);
      // The street around the run: passers-by, motorbikes, stalls whose sellers banter.
      const ch = content.story.chapters.S03!;
      if (ch.street && ch.stalls) {
        const run = this.run;
        this.street = new StreetService(ch.street, ch.stalls, this.player, () => rng.next(), { w: this.world.width, h: this.world.height }, {
          phase: () => (run.running ? run.phase : null),
          isVisited: (id) => !!this.state.story.flags[`visited:${id}`],
          visited: (id) => void this.story.visit(id),
          limitX: () => run.fenceX ?? this.world.width - 1,
          hold: (on) => { run.held = on; if (on) this.playerInteraction.cancelAll('superseded'); },
          crash: (line, downMs, kind) => run.crash(kind ?? 'motorbike', line, downMs),
          isDown: () => run.isDown,
          knockedOut: () => run.dying,
          props: () => props,
          walkable: (x, y) => hasClearance(this.world.grid, { x, y }, { x, y }, RUN_BODY_RADIUS),
          canWalk: (from, to) => hasClearance(this.world.grid, from, to, RUN_BODY_RADIUS),
          path: (from, to, avoid) => {
            const grid = this.world.grid.clone();
            if (avoid) grid.addBlocker(avoid);
            for (const prop of props) {
              const x = Math.floor(prop.x - prop.r), y = Math.floor(prop.y - prop.r);
              const w = Math.ceil(prop.x + prop.r) - x, h = Math.ceil(prop.y + prop.r) - y;
              const contains = (p: WorldPos) => p.x >= x - RUN_BODY_RADIUS && p.x <= x + w + RUN_BODY_RADIUS && p.y >= y - RUN_BODY_RADIUS && p.y <= y + h + RUN_BODY_RADIUS;
              if (!contains(from) && !contains(to)) grid.addBlocker({ x, y, w, h });
            }
            if (hasClearance(grid, from, to, RUN_BODY_RADIUS)) return [{ ...to }];
            const plan = new NavigationService(grid, RUN_BODY_RADIUS).planTo(from, [worldToTile(to)]);
            if (!plan) return null;
            const end = plan.waypoints[plan.waypoints.length - 1] ?? from;
            if (!hasClearance(grid, end, to, RUN_BODY_RADIUS)) return null;
            return [...plan.waypoints, { ...to }];
          },
          rescueRoute: (hero) => planRescue(this.world.grid, hero, ch.street!.bikeLanes, ch.street!.ambulanceAccess),
          bikeHit: () => run.crash('motorbike', ch.hazards?.motorbike?.faint ?? '…', 2000),
          rescued: () => run.finishDown(),
        });
        this.story.attachStreet(this.street);
      }
    }
    // Chapter 2 is the cloud garden: direct control, sparks to catch, the heaven door.
    if (content.story.chapters.S04?.map === map.id && this.story.active && this.story.chapterId === 'S04') {
      const centreOf = (id: string) => { const o = this.world.getObject(id); return o ? { x: o.footprint.x + o.footprint.w / 2, y: o.footprint.y + o.footprint.h / 2 } : null; };
      this.garden = new GardenService(this.world.grid, this.player, content.story.chapters.S03!.run!, {
        stones: content.story.stones,
        isLit: (id) => !!this.state.story.flags[id],
        light: (id) => void this.story.activate(id),
        portalOpen: () => this.story.portalOpen,
        enterPortal: () => { this.playerInteraction.cancelAll('superseded'); void this.story.enterPortal(); },
        cherryTaken: () => !!this.state.story.flags.cherry,
        pickCherry: () => void this.story.pickCherry(),
        centreOf,
      });
      this.story.attachGarden(this.garden);
    }

    // M7: furniture feeds the café's bonuses; any change rebuilds seats and paths.
    this.cafe?.setDecorBonuses(() => this.decor.bonuses());
    if (this.cafe) this.cafe.maxConcurrentBonus = () => this.upgrades.capacityBonus();
    this.bus.on('decor:modeChanged', ({ active }) => active && this.playerInteraction.cancelAll('superseded'));
    this.bus.on('decor:changed', ({ action, objectId }) => {
      if (action !== 'placed') {
        this.playerInteraction.onObjectRemoved(objectId);
        this.employees.onObjectRemoved(objectId);
      }
      this.playerInteraction.onNavChanged();
      this.employees.onNavChanged();
      this.cafe?.refreshSpots();
      this.cafe?.onNavChanged();
    });
  }

  /** Resume where the save left the player, if that spot is still walkable on this map. */
  private startTile(): TilePos {
    const saved = this.state.player;
    if (saved.map === this.map.id && saved.tile && this.world.grid.isWalkable(saved.tile)) return saved.tile;
    return this.map.playerStart;
  }

  get now(): number {
    return this.timeMs;
  }

  /** Advance by real elapsed ms. Large gaps (tab switch) are split into bounded steps. */
  tick(realDtMs: number): void {
    let remaining = Math.max(0, realDtMs) * this.timeScale;
    const step = this.config.simulation.maxStepMs;
    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      this.timeMs += dt;
      // The run pauses with the story (dialogue, transitions).
      if (this.run && !this.story.locked) this.run.tick(dt, this.config.player.speedTilesPerSec);
      // Caught (bitten, scratched, falling…): the hero is held in place until the ending card.
      if (this.run?.dying) this.playerInteraction.cancelAll('superseded', false);
      else this.playerInteraction.tick(dt);
      if (this.player.movementBlocked) {
        this.playerInteraction.cancelAll('superseded');
        this.player.movementBlocked = false;
      }
      if (this.garden && !this.story.locked) this.garden.tick(dt);
      if (this.street && !this.story.locked) this.street.tick(dt);
      this.cafe?.tick(dt);
      this.employees.tick(dt);
      this.story.tick(dt);
      remaining -= dt;
    }
    this.farm.update();
    this.neighbors.tick();
    this.shops.checkDistance(this.player.tile);
  }

  /** Chapter-1 run, or null on other maps. */
  run: RunService | null = null;
  /** Chapter-1 street life (passers-by, stall talks), or null on other maps. */
  street: StreetService | null = null;
  /** Chapter-2 cloud garden, or null on other maps. */
  garden: GardenService | null = null;

  /** Direct control (keys / joystick) in world directions; (0, 0) releases it. Chapter-1 run and chapter-2 garden. */
  steer(x: number, y: number): void {
    const r = this.run ?? this.garden;
    if (!r) return;
    const was = r.steering;
    if (x !== 0 || y !== 0) this.startRun();
    r.setSteer(this.story.locked ? 0 : x, this.story.locked ? 0 : y);
    if (r.steering && !was) {
      this.playerInteraction.cancelAll('superseded');
      if (this.player.fsm.can('MOVING')) this.player.fsm.transition('MOVING');
    } else if (!r.steering && was && this.player.fsm.is('MOVING')) this.player.fsm.transition(this.player.restState());
  }

  /**
   * The chapter-1 run waits, without any start screen, for the player's first move (key, joystick,
   * click): hazards only come once they are playing, and that first input is also the
   * gesture that lets the browser play sound.
   */
  startRun(): void {
    if (this.run && !this.story.locked) this.run.paused = false;
  }

  /** Chapter 1: the player tapped a person on the street. Close enough, they talk; otherwise the hero walks over first. */
  talkTo(npcId: string): void {
    if (this.story.locked || this.run?.dying || this.run?.held || !this.street) return;
    this.startRun();
    if (this.street.talkTo(npcId)) return;
    const at = this.street.npcPos(npcId);
    if (!at) return;
    this.street.walkTo(npcId);
    const t = worldToTile(at);
    // Stall people stand behind their counter: walk to the free tile nearest them.
    for (let r = 0; r < 3; r++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const tile = { x: t.x + dx * r, y: t.y + dy * r };
      if (this.world.grid.isWalkable(tile)) return void this.playerInteraction.moveTo(tile);
    }
  }

  /** Player input → command. A click on an object interacts; a click on floor moves. */
  clickTile(tile: TilePos): void {
    if (this.story.locked || this.run?.dying || this.run?.held) return;
    this.startRun();
    if (this.decor.isActive) return void this.decor.click(tile, null);
    const obj = this.world.objectAt(tile);
    if (obj) this.clickObject(obj.id);
    else this.playerInteraction.moveTo(tile);
  }

  /** Player clicked an object's visible shape. Non-interactive objects behave like a click on their tile. */
  clickObject(id: string): void {
    if (this.story.locked || this.run?.dying || this.run?.held) return;
    this.startRun();
    const obj = this.world.getObject(id);
    if (!obj) return;
    if (this.decor.isActive) return void this.decor.click({ x: obj.footprint.x, y: obj.footprint.y }, id);
    this.bus.emit('world:objectSelected', { objectId: id });
    if (!obj.def.interaction) {
      this.playerInteraction.moveTo({ x: obj.footprint.x, y: obj.footprint.y });
      return;
    }
    // Don't walk the player somewhere just to be told "no" (e.g. land not bought yet).
    const gate = this.farm.interactionGate(id);
    if (gate) this.playerInteraction.rejectWithoutMoving(id, gate);
    else this.playerInteraction.request(obj.id);
  }

  /** Clicking a customer: serve them at their seat, or take their order at the counter. */
  clickCustomer(id: string): void {
    if (this.story.locked || this.run?.dying || this.run?.held) return;
    this.startRun();
    if (this.decor.isActive) return;
    const c = this.cafe?.customer(id);
    if (!c) return;
    if (c.spot) return this.clickObject(c.spot.objectId);
    const counter = this.world.allObjects().find((o) => o.type === 'order_counter');
    if (counter && this.cafe!.customerAtCounter()?.id === id) this.clickObject(counter.id);
  }

  /** Open the world map's region (a travelable map the player has unlocked, once the story is done). */
  travelToRegion(regionId: string): MetaResultLike {
    if (this.story.chapterId !== 'done') return { ok: false, reason: 'storyNotDone' };
    const map = this.content.maps[regionId]?.regionId ? (this.regions.canEnter(regionId) ? regionId : null) : this.meta.travelMap(regionId);
    if (!map) return { ok: false, reason: 'regionLocked' };
    if (map === this.map.id) return { ok: false, reason: 'alreadyHere' };
    this.bus.emit('world:travelRequested', { map });
    return { ok: true };
  }

  /**
   * Development / testing aid: finish the story, unlock every region (level 99), give a large purse,
   * stock supplies (within the bag capacity), and buy all land on this map. Idempotent (coins and EXP are granted once; items
   * only topped up). Never wired into production builds (see the Settings panel and `?cheat=1`).
   */
  enableTestMode(finishStory = true): void {
    if (finishStory) this.state.story = { chapter: 'done', flags: {} };
    const base = this.content.progression.levels.base;
    const target = base * 99 * 98;
    const missingExp = Math.max(0, target - this.progression.exp);
    const missingCoins = Math.max(0, 1_000_000_000 - this.tx.coins);
    if (missingCoins || missingExp) this.tx.execute({ reason: 'debug:testmode', coins: missingCoins, exp: missingExp });
    const topUp: Array<[string, number, number]> = [];
    for (const sd of Object.values(this.content.seeds)) topUp.push([sd.seedItem, 10, 80]);
    for (const [id, it] of Object.entries(this.content.items)) if (it.category === 'roasted') topUp.push([id, 50, 85]);
    topUp.push(['milk', 40, 60], ['condensed_milk', 40, 60]);
    for (const [itemId, qty, quality] of topUp) {
      const have = this.tx.count(itemId);
      if (have < qty) this.tx.execute({ reason: 'debug:testmode', items: [{ itemId, qty: qty - have, quality }] });
    }
    for (const p of this.farm.allPlotViews()) if (p.locked) this.farm.buyPlot(p.id);
  }

  /** Replay the rebirth story from the start. Progress, rewards already paid (idempotent) and saves are kept. */
  replayStory(): void {
    const start = this.content.story.start;
    this.state.story = { chapter: start, flags: {} };
    this.bus.emit('world:travelRequested', { map: this.content.story.chapters[start]!.map });
  }

  cancel(): void {
    if (this.decor.isActive) return this.decor.escape();
    this.playerInteraction.cancelAll('playerCancelled');
  }

  /** Copy transient runtime data into the persistent state, ready to save. */
  captureState(): GameState {
    this.farm.update();
    this.state.player = { map: this.map.id, tile: this.player.tile };
    if (this.map.regionId) {
      const own = this.state.regions[this.map.regionId]!;
      own.cafe = this.localState.cafe;
      own.farm = this.localState.farm;
      own.processing = this.localState.processing;
      own.employees = this.localState.employees;
    }
    return this.state;
  }

  /**
   * Prepare persistent state for leaving this map: commit everything and set
   * the destination so a reload resumes there. Café customers/orders are
   * transient and simply end.
   */
  prepareTravel(targetMap: string): GameState {
    this.decor.exit();
    this.cancel();
    this.captureState();
    this.state.player = { map: targetMap, tile: null };
    return this.state;
  }

  snapshot(): SimulationSnapshot {
    const p = this.player;
    const eco = this.state.economy;
    return {
      timeMs: this.timeMs,
      clockMs: this.clock.now(),
      map: this.map.id,
      player: {
        id: p.id,
        pos: { ...p.pos },
        tile: p.tile,
        state: p.state,
        facing: p.facing,
        heldItem: p.heldItem,
        waypoints: p.remainingWaypoints.map((w) => ({ ...w })),
      },
      interaction: this.playerInteraction.snapshot(),
      objects: this.world.allObjects().map((o) => ({ id: o.id, counters: { ...o.counters } })),
      economy: {
        coins: eco.coins,
        exp: this.state.progression.exp,
        inventory: structuredClone(eco.inventory),
        itemCount: this.tx.totalItems(),
        capacity: this.content.economy.inventoryCapacity,
        lastTx: eco.history.at(-1) ?? null,
      },
      farm: {
        plots: this.farm.allPlotViews(),
        can: { water: this.farm.canWater, capacity: this.content.economy.farm.wateringCan.capacity },
        selectedSeed: this.farm.selectedSeed,
        seedToPlant: this.farm.seedToPlant(),
      },
      shop: this.shops.current,
      progression: {
        level: this.progression.level,
        exp: this.progression.exp,
        levelStartExp: this.progression.levelStartExp,
        nextLevelExp: this.progression.nextLevelExp,
      },
      reputation: {
        value: this.rating.reputation,
        traffic: this.rating.trafficFactor,
        recent: this.rating.history().slice(0, 8),
        served: this.localState.cafe.stats.served,
        failed: this.localState.cafe.stats.failed,
      },
      processing: { equipment: this.processing.allViews(), selectedRecipe: { ...this.localState.processing.selectedRecipe } },
      market: { recentSales: this.market.recentSales() },
      cafe: this.cafe
        ? { customers: this.cafe.views(), orders: this.orders.activeOrders().map((o) => structuredClone(o)), recentOrders: this.orders.recent().slice(0, 8).map((o) => structuredClone(o)), queue: [...this.cafe.queueOrder()], freeSpots: this.cafe.freeSpots(), seats: this.cafe.seatStates(), payments: this.cafe.pendingPayments().map((p) => ({ ...p })), brewSessions: this.brewing.sessionViews(), brew: this.brewing.view(), nextToBrew: this.brewing.nextOrderToBrew(), heldDrink: (() => { const d = this.brewing.heldDrink(); return d ? { id: d.id, recipeId: d.recipeId, orderId: d.orderId, quality: d.quality } : null; })() }
        : null,
      decor: this.decor.available ? this.decor.view() : null,
      employees: { hired: this.employees.views(), roles: this.employees.rolesView() },
      story: this.story.view(),
      meta: this.meta.view(),
      upgrades: this.upgrades.view(),
      tables: this.cafe ? this.upgrades.tables(this.world) : [],
      cafes: this.neighbors.list(),
      estates: this.regions.view(),
    };
  }
}
