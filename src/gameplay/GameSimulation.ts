import { StreetPath } from './story/streetPath';
import { hasClearance } from '../systems/navigation/smoothing';
import { planRescue } from './story/rescueRouting';
import { SystemClock, type Clock } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GameContent } from '../data/content';
import { Actor, type ActorState, type Facing } from '../entities/Actor';
import { InteractionService, type InteractionSnapshot } from '../systems/interaction/InteractionService';
import { NavigationService } from '../systems/navigation/NavigationService';
import { tileCenter, worldToTile, type TilePos, type WorldPos } from '../utils/tile';
import { ActionRegistry } from './actions/ActionRegistry';
import { registerBasicHandlers } from './actions/basicHandlers';
import { Rng } from '../core/Rng';
import { StoryService, type StoryView } from './story/StoryService';
import { registerStoryHandlers } from './story/storyHandlers';
import { RunService, RUN_BODY_RADIUS } from './story/RunService';
import { StreetService } from './story/StreetService';
import { TrialService } from './story/TrialService';
import { createNewGameState, type GameState } from './state/GameState';
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
  story: StoryView;
  /** A free-walk chapter (see `walker`): the HUD shows its sound button. */
  freeWalk: boolean;
}

/** What a free-walk chapter offers the controls. */
export interface FreeWalker {
  setSteer(x: number, y: number): void;
  readonly steering: boolean;
}

export interface SimulationOptions {
  /** Restored save; a new game is created when omitted. */
  state?: GameState;
  clock?: Clock;
  /** Seed for customer spawning/orders (tests pass a fixed one). */
  rngSeed?: number;
}

/**
 * Root of the headless gameplay simulation. Owns world, services, actors and
 * the persistent GameState; advanced only through tick(). Rendering reads
 * snapshots and never writes.
 */
export class GameSimulation {
  readonly bus = new EventBus<GameEvents>();
  readonly collisionProps: Array<WorldPos & { r: number }> = [];
  readonly world: WorldModel;
  readonly nav: NavigationService;
  readonly actions = new ActionRegistry();
  readonly state: GameState;
  readonly clock: Clock;
  readonly story: StoryService;
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
    this.state = opts.state ?? createNewGameState({ now: this.clock.now(), map: map.id });
    this.world = new WorldModel(map, content.objectTypes);
    this.nav = new NavigationService(this.world.grid, [content.story.chapters.S03?.map, content.story.chapters.S04?.map].includes(map.id) ? RUN_BODY_RADIUS : this.config.player.bodyRadius);
    registerBasicHandlers(this.actions, this.bus);
    // Story chapters 1–2 move faster than everyday walking, and the same whether steered or tapped to walk.
    const storyRun = content.story.chapters.S03?.run;
    const storyMap = [content.story.chapters.S03?.map, content.story.chapters.S04?.map].includes(map.id);
    const playerCfg = storyRun && storyMap ? { ...this.config.player, speedTilesPerSec: storyRun.runSpeed } : this.config.player;
    this.player = new Actor('player', tileCenter(this.startTile()), playerCfg, () => this.timeMs);
    this.player.fsm.onTransition((from, to) => this.bus.emit('actor:stateChanged', { actorId: this.player.id, from, to }));
    this.playerInteraction = new InteractionService(this.player, this.world, this.nav, this.actions, this.bus, this.config.player);
    this.story = new StoryService(this.state, map.id, content.story, this.bus, {
      resetPlayer: () => {
        this.playerInteraction.cancelAll('superseded');
        this.player.pos = tileCenter(this.map.playerStart);
      },
    });
    registerStoryHandlers(this.actions, this.story);
    // Chapter 1 is a survival run on its own map: direct control and street hazards.
    const runCfg = content.story.chapters.S03?.run;
    if (runCfg && content.story.chapters.S03!.map === map.id) {
      const rng = new Rng(opts.rngSeed ?? Date.now());
      // Stacks of stools and parked motorbikes collide as their round shape, not a whole tile: nothing to snag on.
      const ROUND: Record<string, number> = { stools: 0.32, parked_bike: 0.36 };
      const props = this.collisionProps = this.world.allObjects().filter((o) => ROUND[o.type] !== undefined)
        .map((o) => ({ x: o.footprint.x + o.footprint.w / 2, y: o.footprint.y + o.footprint.h / 2, r: ROUND[o.type]! }));
      if (this.story.active && this.story.chapterId === 'S03') this.player.pos = tileCenter(map.playerStart);
      this.run = new RunService(runCfg, this.world.grid, this.player, () => rng.next(), { w: this.world.width, h: this.world.height },
        (kind, ms) => { this.playerInteraction.cancelAll('superseded'); this.story.onDeath(kind, ms); },
        { hazards: content.story.chapters.S03!.hazards ?? {}, visited: (id) => !!this.state.story.flags[`visited:${id}`], rescue: !!(content.story.chapters.S03!.street && content.story.chapters.S03!.stalls), seen: (kind) => this.state.counters[`incident:seen:${kind}`] ?? 0, markSeen: (kind) => { const key = `incident:seen:${kind}`; this.state.counters[key] = (this.state.counters[key] ?? 0) + 1; }, people: () => this.street?.people() ?? [], props: () => props });
      this.player.canMove = (from, to) => this.run!.canMove(from, to);
      this.player.slide = (from, to) => this.run!.resolveMove(from, to);
      this.story.attachRun(this.run);
      // The street around the run: passers-by, motorbikes, stalls whose sellers banter.
      const ch = content.story.chapters.S03!;
      if (ch.street && ch.stalls) {
        const run = this.run, streetPath = new StreetPath(this.world.grid, props);
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
          path: (from, to, avoid, people) => streetPath.plan(from, to, avoid, people),
          rescueRoute: (hero, people = []) => planRescue(this.world.grid, hero, ch.street!.bikeLanes, ch.street!.ambulanceAccess,
            (door, body) => props.every(o => Math.hypot(door.x - o.x, door.y - o.y) >= o.r + .26
              // The parked body itself keeps clear of trunks and parked bikes.
              && Math.hypot(Math.max(body.x - o.x, 0, o.x - body.x - body.w), Math.max(body.y - o.y, 0, o.y - body.y - body.h)) >= o.r + .3) && !!streetPath.plan(door, hero, body, people) && !!streetPath.plan(hero, door, body, people),
            props),
          bikeHit: () => run.crash('motorbike', ch.hazards?.motorbike?.faint ?? '…', 2000),
          rescued: () => run.finishDown(),
        });
        this.story.attachStreet(this.street);
      }
    }
    // Chapter 2 is the road of rebirth: direct control, five stations with a question each, the door.
    if (content.story.chapters.S04?.map === map.id && this.story.active && this.story.chapterId === 'S04') {
      const flags = this.state.story.flags, counters = this.state.counters;
      const stations = content.trials.stations;
      // A fresh road: the karma and the lessons of an earlier visit are dropped.
      if (!stations.some((st) => flags[`station:${st.id}`])) for (const k of Object.keys(counters)) if (k.startsWith('trial:')) delete counters[k];
      const lessons = new Map(stations.flatMap((st) => st.questions.map((q) => [q.id, q.lesson] as const)));
      const k = content.trials.karma, rng = new Rng(opts.rngSeed ?? Date.now());
      counters['trial:karma'] = Math.max(k.min, Math.min(k.max, counters['trial:karma'] ?? 0));
      this.trial = new TrialService(this.world.grid, this.player, content.story.chapters.S03!.run!, content.trials, {
        isDone: (id) => !!flags[`station:${id}`],
        markDone: (id) => { flags[`station:${id}`] = true; this.bus.emit('story:changed', { chapter: 'S04' }); },
        karma: () => counters['trial:karma'] ?? 0,
        addKarma: (n) => { counters['trial:karma'] = Math.max(k.min, Math.min(k.max, (counters['trial:karma'] ?? 0) + n)); },
        lessons: () => Object.keys(counters).filter((key) => key.startsWith('trial:lesson:') && lessons.has(key.slice(13))).sort((a, b) => counters[a]! - counters[b]!).map((key) => lessons.get(key.slice(13))!),
        addLesson: (id) => {
          const key = `trial:lesson:${id}`;
          if (!lessons.has(id) || counters[key] !== undefined) return;
          counters[key] = 1 + Math.max(0, ...Object.entries(counters).filter(([name]) => name.startsWith('trial:lesson:')).map(([, order]) => order));
        },
        cause: () => this.state.story.scenario ?? null,
        halt: () => this.playerInteraction.cancelAll('superseded'),
        enterDoor: () => { this.playerInteraction.cancelAll('superseded'); void this.story.enterPortal(); },
      }, () => rng.next());
      this.story.attachTrial(this.trial);
      this.player.canMove = (from, to) => this.trial!.canMove(from, to);
    }
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
      if (this.trial && !this.story.locked) this.trial.tick(dt);
      if (this.street && !this.story.locked) this.street.tick(dt);
      this.story.tick(dt);
      remaining -= dt;
    }
  }

  /** Chapter-1 run, or null on other maps. */
  run: RunService | null = null;
  /** Chapter-1 street life (passers-by, stall talks), or null on other maps. */
  street: StreetService | null = null;
  /** Chapter-2 road of rebirth, or null on other maps. */
  trial: TrialService | null = null;

  /**
   * The chapter played with direct control (keys, joystick, taps; the camera stays on the hero and the map is
   * never dragged), or null. A new chapter of this kind only has to be returned here.
   */
  get walker(): FreeWalker | null {
    return this.run ?? this.trial;
  }

  /** Direct control (keys / joystick) in world directions; (0, 0) releases it. */
  steer(x: number, y: number): void {
    const r = this.walker;
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
    if (this.story.locked || this.run?.dying || this.run?.held || this.trial?.busy) return;
    this.startRun();
    const obj = this.world.objectAt(tile);
    if (obj) this.clickObject(obj.id);
    else this.playerInteraction.moveTo(tile);
  }

  /** Player clicked an object's visible shape. Non-interactive objects behave like a click on their tile. */
  clickObject(id: string): void {
    if (this.story.locked || this.run?.dying || this.run?.held || this.trial?.busy) return;
    this.startRun();
    const obj = this.world.getObject(id);
    if (!obj) return;
    this.bus.emit('world:objectSelected', { objectId: id });
    if (!obj.def.interaction) {
      this.playerInteraction.moveTo({ x: obj.footprint.x, y: obj.footprint.y });
      return;
    }
    this.playerInteraction.request(obj.id);
  }

  /** Replay the rebirth story from the start. */
  replayStory(): void {
    const start = this.content.story.start;
    this.state.story = { chapter: start, flags: {} };
    this.bus.emit('world:travelRequested', { map: this.content.story.chapters[start]!.map });
  }

  cancel(): void {
    this.playerInteraction.cancelAll('playerCancelled');
  }

  /** Copy transient runtime data into the persistent state, ready to save. */
  captureState(): GameState {
    this.state.player = { map: this.map.id, tile: this.player.tile };
    return this.state;
  }

  /** Prepare persistent state for leaving this map: commit everything and set the destination so a reload resumes there. */
  prepareTravel(targetMap: string): GameState {
    this.cancel();
    this.captureState();
    this.state.player = { map: targetMap, tile: null };
    return this.state;
  }

  snapshot(): SimulationSnapshot {
    const p = this.player;
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
      freeWalk: !!this.walker,
      story: this.story.view(),
    };
  }
}
