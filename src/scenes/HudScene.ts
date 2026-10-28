import Phaser from 'phaser';
import { CONTENT } from '../data/content';
import { t } from '../core/i18n';
import type { GameSession } from '../core/session';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import { DebugOverlay } from '../ui/hud/DebugOverlay';
import { PlayerProfileHUD } from '../ui/hud/PlayerProfileHUD';
import { CurrencyHUD } from '../ui/hud/CurrencyHUD';
import { GuideHud } from '../ui/hud/GuideHud';
import { QuestTracker } from '../ui/hud/QuestTracker';
import { OrderQueuePanel } from '../ui/hud/OrderQueuePanel';
import { BottomToolbar, type ToolbarItem } from '../ui/hud/BottomToolbar';
import { SettingsModal } from '../ui/hud/SettingsModal';
import { ToastHub } from '../ui/hud/ToastHub';
import { RatingPopup } from '../ui/hud/RatingPopup';
import { GameButton } from '../ui/components/GameButton';
import { HudLayout, hudViewport } from '../ui/layout/HudLayout';
import { ModalManager } from '../ui/layout/ModalManager';
import { InventoryModal } from '../ui/panels/InventoryModal';
import { RecipesModal } from '../ui/panels/RecipesModal';
import { EmployeeModal } from '../ui/panels/EmployeeModal';
import { COLORS, css, FONT } from '../ui/theme/tokens';
import { FarmHud } from '../ui/FarmHud';
import { StationHud, type StationUiCommands } from '../ui/StationHud';
import { CafeHud, type CafeUiCommands } from '../ui/CafeHud';
import { DecorHud, type DecorUiCommands } from '../ui/DecorHud';
import { WorldMapHud } from '../ui/WorldMapHud';
import { MetaHud } from '../ui/MetaHud';
import { TableUpgradeModal } from '../ui/panels/TableUpgradeModal';
import { StoryHud } from '../ui/StoryHud';
import { toggleMute } from '../core/audioPrefs';
import type { Button } from '../ui/widgets/Button';

/** UI overlay with its own un-zoomed camera, running on top of a world scene. */
export class HudScene extends Phaser.Scene {
  private debug: DebugOverlay | null = null;
  private layout!: HudLayout;
  private modals!: ModalManager;
  private profile!: PlayerProfileHUD;
  private currency!: CurrencyHUD;
  private quests!: QuestTracker;
  private orders: OrderQueuePanel | null = null;
  private toolbar!: BottomToolbar;
  private settings!: SettingsModal;
  private toasts!: ToastHub;
  private rating: RatingPopup | null = null;
  private inventory!: InventoryModal;
  private recipes!: RecipesModal;
  private staff!: EmployeeModal;
  private tables!: TableUpgradeModal;
  private guide!: GuideHud;
  private farmToggle: GameButton | null = null;
  private unsubscribeLayout: (() => void) | null = null;
  private readonly offs: Array<() => void> = [];
  private readyQuests = new Set<string>();
  private lastSnap: SimulationSnapshot | null = null;
  farmHud: FarmHud | null = null;
  stationHud: StationHud | null = null;
  cafeHud: CafeHud | null = null;
  decorHud: DecorHud | null = null;
  storyHud: StoryHud | null = null;
  metaHud: MetaHud | null = null;
  worldMapHud: WorldMapHud | null = null;
  private session!: GameSession;

  constructor() {
    super('HudScene');
  }

  init(data: { session: GameSession }): void {
    this.session = data.session;
  }

  /** True while a big panel (inventory, staff, map…) is open; the world should not react to the wheel then. */
  get modalOpen(): boolean {
    return !!this.modals?.openId;
  }

  /** Any named HUD button (test bridge lookup). */
  button(name: string): Button | undefined {
    return (
      this.farmHud?.buttons.get(name) ??
      this.stationHud?.buttons.get(name) ??
      this.cafeHud?.buttons.get(name) ??
      this.decorHud?.buttons.get(name) ??
      this.storyHud?.buttons.get(name) ??
      this.metaHud?.buttons.get(name) ??
      this.worldMapHud?.buttons.get(name) ??
      this.toolbar?.buttons.get(name) ??
      this.settings?.buttons.get(name) ??
      this.inventory?.buttons.get(name) ??
      this.recipes?.buttons.get(name) ??
      this.tables?.buttons.get(name) ??
      this.staff?.buttons.get(name) ??
      (name === 'settings.open' ? this.currency?.settings : undefined) ??
      (name === 'farm.panel' ? this.farmToggle ?? undefined : undefined)
    );
  }

  create(): void {
    // Phaser reuses the scene instance on restart: never keep panels from a previous map.
    this.farmHud = this.stationHud = this.cafeHud = null;
    this.decorHud = this.storyHud = this.metaHud = this.worldMapHud = null;
    this.farmToggle = null;
    this.rating = null;
    this.readyQuests.clear();
    const sim = this.session.sim;
    this.debug = import.meta.env.PROD ? null : new DebugOverlay(this, sim.bus);
    this.layout = new HudLayout(this);
    this.modals = new ModalManager(this);
    this.profile = new PlayerProfileHUD(this);
    this.toasts = new ToastHub(this);
    this.settings = new SettingsModal(this, { replayStory: () => sim.replayStory(), newGame: () => this.newGame(), testMode: () => { sim.enableTestMode(); if (!['cafe', 'farm'].includes(sim.map.businessKind ?? sim.map.id)) sim.bus.emit('world:travelRequested', { map: 'cafe' }); this.session.saves?.save(sim.captureState(), sim.clock.now()); }, fullscreen: { supported: () => !!document.fullscreenEnabled, isOn: () => this.scale.isFullscreen, toggle: () => this.toggleFullscreen() } });
    this.currency = new CurrencyHUD(this, () => this.modals.toggle('settings'));
    this.guide = new GuideHud(this);
    this.quests = new QuestTracker(this, (id) => sim.meta.claimQuest(id));
    this.orders = sim.cafe ? new OrderQueuePanel(this, CONTENT.recipes, (id) => CONTENT.customers.archetypes[id]?.label ?? id, CONTENT.customers.spawn.maxConcurrent) : null;
    if (sim.cafe) {
      const cafe: CafeUiCommands = {
        chooseBean: (id) => sim.brewing.chooseBean(id),
        chooseAddition: (id) => sim.brewing.chooseAddition(id),
        press: () => sim.brewing.press(),
        cancelBrew: () => sim.brewing.cancel(),
        buySupply: (id, qty) => sim.supplies.buy(id, qty),
      };
      this.cafeHud = new CafeHud(this, cafe, CONTENT.recipes, CONTENT.items, CONTENT.brewing);
      // The brewing panel is hidden while decorating, so its needle can't be pressed blind.
      this.input.keyboard?.on('keydown-SPACE', () => !sim.decor.isActive && this.cafeHud?.pressShortcut());
      this.rating = new RatingPopup(
        this,
        sim.bus,
        (id) => {
          const c = this.lastSnap?.cafe?.customers.find((x) => x.id === id);
          return c ? `${CONTENT.customers.archetypes[c.archetype]?.label ?? c.archetype} #${c.id.replace(/\D/g, '')}` : t('rating.customer');
        },
        (rid) => CONTENT.recipes[rid]?.label ?? rid,
        (orderId) => {
          const cafe = this.lastSnap?.cafe;
          return [...(cafe?.orders ?? []), ...(cafe?.recentOrders ?? [])].find((o) => o.id === orderId)?.recipeId;
        },
      );
    } else if (sim.farm.allPlotViews().length > 0) {
      this.farmHud = new FarmHud(this, sim.bus, sim.farm, CONTENT.seeds);
      const station: StationUiCommands = {
        selectRecipe: (type, rid) => sim.processing.selectRecipe(type, rid),
        upgradeEquipment: (id) => sim.processing.upgrade(id),
        sell: (item, qty) => sim.market.sell(item, qty),
        quote: (item, qty) => sim.market.quote(item, qty),
        isSellable: (item) => sim.market.isSellable(item),
        isEquipment: (id) => sim.processing.isEquipment(id),
      };
      this.stationHud = new StationHud(this, sim.bus, station, CONTENT.items, CONTENT.processing);
      this.farmToggle = new GameButton(this, 0, 0, t('farm.panel'), () => this.toggleFarmPanel(), 'farm.panel', { icon: 'farm', iconOnly: true, variant: 'ghost', w: 34, h: 34 });
      this.farmToggle.text.setDepth(1001);
    }

    if (sim.decor.available) {
      const decor: DecorUiCommands = {
        enter: () => sim.decor.enter(),
        exit: () => sim.decor.exit(),
        buy: (type) => sim.decor.buy(type),
        select: (type) => sim.decor.selectToPlace(type),
        rotate: () => sim.decor.rotate(),
        storeSelected: () => sim.decor.storeSelected(),
        clearSelection: () => sim.decor.clearSelection(),
        confirm: () => sim.decor.confirmAtHover(),
      };
      this.decorHud = new DecorHud(this, decor, CONTENT.furniture, CONTENT.items);
    }

    if (sim.story.active) this.storyHud = new StoryHud(this, () => sim.story.advanceDialog(), () => sim.dash(), () => sim.story.retryRun(), () => toggleMute(this.sound));

    this.metaHud = new MetaHud(this, {
      replayStory: () => sim.replayStory(),
      newGame: () => this.newGame(),
      claimQuest: (id) => sim.meta.claimQuest(id),
      buySkill: (id) => sim.meta.buySkill(id),
      buyBranch: (id) => sim.meta.buyBranch(id),
      collectBranch: (id) => sim.meta.collectBranch(id),
      buyUpgrade: (id) => sim.upgrades.buy(id),
    });
    this.worldMapHud = new WorldMapHud(this, { travel: (id) => sim.travelToRegion(id), buyLand: (id) => sim.regions.buyLand(id), build: (id, kind) => sim.regions.build(id, kind), visit: (id) => sim.neighbors.visit(id), like: (id) => sim.neighbors.like(id) });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { const w = this.cameras.main.getWorldPoint(p.x, p.y); this.worldMapHud?.handlePointer(w.x, w.y); });

    this.inventory = new InventoryModal(this, { sell: (item, qty) => sim.market.sell(item, qty), isSellable: (item) => sim.market.isSellable(item) }, CONTENT.items);
    this.recipes = new RecipesModal(this, CONTENT.recipes, CONTENT.items, CONTENT.progression.recipeUnlockLevel);
    this.staff = new EmployeeModal(this, { hire: (r) => sim.employees.hire(r), fire: (id) => sim.employees.fire(id) }, CONTENT.employees, CONTENT.maps);
    for (const p of [this.settings.modal, this.inventory.modal, this.recipes.modal, this.staff.modal, this.metaHud, this.worldMapHud]) this.modals.register(p);

    this.tables = new TableUpgradeModal(this, (id) => sim.upgrades.buyTable(sim.world, id));
    this.modals.register(this.tables.modal);
    this.toolbar = new BottomToolbar(this, this.toolbarItems());
    if (document.fullscreenEnabled) this.input.keyboard?.on('keydown-F', () => this.toggleFullscreen());
    this.offs.push(
      sim.bus.on('save:writeFailed', () => this.banner(t('save.writeFailed'))),
      sim.bus.on('progression:levelUp', (e) => this.toasts.push({ icon: 'star', title: t('toast.levelUp', { level: e.to }), text: this.unlocksAt(e.to), tone: 'gold' })),
      sim.bus.on('meta:achievement', (e) => this.toasts.push({ icon: 'star', title: t('toast.achievement'), text: e.label, tone: 'gold' })),
      sim.bus.on('meta:questClaimed', (e) => this.toasts.push({ icon: 'check', title: t('toast.questClaimed'), text: e.label, tone: 'leaf' })),
      sim.bus.on('meta:branchBought', (e) => this.toasts.push({ icon: 'map', title: t('toast.branch'), text: e.label, tone: 'caramel' })),
      sim.bus.on('employee:hired', () => this.toasts.push({ icon: 'people', title: t('staff.hired'), tone: 'leaf' })),
      sim.bus.on('economy:transaction', (r) => {
        if (!r.reason.startsWith('upgradeEquipment:')) return;
        const [, id, level] = r.reason.split(':');
        const label = this.lastSnap?.processing.equipment.find((e) => e.id === id)?.label ?? id ?? '';
        this.toasts.push({ icon: 'gear', title: t('toast.upgraded'), text: `${label} · Lv${level}`, tone: 'caramel' });
      }),
    );

    this.unsubscribeLayout = this.layout.subscribe((f) => {
      this.profile.layout(f);
      this.currency.layout(f);
      this.guide.layout(f);
      this.quests.layout(f, (f.mode === 'wide' ? 62 : 48) + 8);
      this.orders?.layout(f, 34 + 8);
      this.toolbar.layout(f);
      for (const m of [this.settings.modal, this.inventory.modal, this.recipes.modal, this.staff.modal, this.tables.modal]) m.layout(f);
      const toolbarSpace = (f.mode === 'wide' ? 56 : 62) + f.margin + f.safe.bottom;
      this.toasts.layout(f, f.h - toolbarSpace - 8 - (f.mode === 'compact' && f.portrait ? 62 : 0));
      this.rating?.layout(f);
      this.cafeHud?.place(f.w, f.h, f.margin + f.safe.right, toolbarSpace + 6 + (f.mode === 'compact' && f.portrait ? 62 : 0));
      this.decorHud?.place(f, 52);
      // The farm drawer: open on wide screens, collapsed on phones.
      if (this.farmHud && this.farmToggle) {
        const first = !this.farmToggle.text.getData('init');
        if (first) {
          this.farmToggle.text.setData('init', true);
          this.farmHud.setOpen(f.mode === 'wide');
          this.stationHud?.setOpen(f.mode === 'wide');
        }
      }
    });

    if (this.session.recoveredFromBackup) this.banner(t('save.recovered'));
    const problem = this.session.loadProblem;
    if (problem) this.banner(problem.status === 'unsupported' ? t('save.unsupported') : t('save.problem', { status: problem.status }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.offs.splice(0)) off();
      this.debug?.destroy();
      this.unsubscribeLayout?.();
      this.layout.destroy();
      this.modals.destroy();
      this.profile.destroy();
      this.currency.destroy();
      this.guide.destroy();
      this.quests.destroy();
      this.orders?.destroy();
      this.orders = null;
      this.rating?.destroy();
      this.rating = null;
      this.toasts.destroy();
      this.toolbar.destroy();
      this.settings.destroy();
      this.inventory.destroy();
      this.recipes.destroy();
      this.staff.destroy();
      this.tables.destroy();
      this.farmToggle?.text.destroy();
      this.farmToggle = null;
      this.farmHud?.destroy();
      this.stationHud?.destroy();
      this.cafeHud?.destroy();
      this.decorHud?.destroy();
      this.storyHud?.destroy();
      this.metaHud?.destroy();
      this.worldMapHud?.destroy();
      this.farmHud = this.stationHud = this.cafeHud = null;
      this.decorHud = this.storyHud = this.metaHud = this.worldMapHud = null;
      this.input.off('pointerdown');
      this.input.off('wheel');
      this.input.keyboard?.off('keydown-SPACE');
      this.input.keyboard?.off('keydown-F');
    });
  }

  private toggleFarmPanel(): void {
    const on = !this.farmHud?.isOpen;
    this.farmHud?.setOpen(on);
    this.stationHud?.setOpen(on);
  }

  private relayoutFarmToggle(): void {
    const f = this.layout.frame;
    if (!this.farmToggle) return;
    const open = !!this.farmHud?.isOpen;
    const rightEdge = f.w - f.safe.right - f.margin - 34;
    const x = open && f.mode === 'wide' ? rightEdge - 330 - 8 : rightEdge;
    this.farmToggle.text.setPosition(x, f.safe.top + (open ? 56 : 52));
  }

  /** Recipes / furniture / seeds that unlock at this level, for the level-up toast. */
  private unlocksAt(level: number): string {
    const names: string[] = [];
    for (const [id, l] of Object.entries(CONTENT.progression.recipeUnlockLevel)) if (l === level) names.push(CONTENT.recipes[id]?.label ?? id);
    for (const f of Object.values(CONTENT.furniture.catalog)) if (f.unlockLevel === level) names.push(CONTENT.items[f.itemId]?.label ?? f.itemId);
    for (const sd of Object.values(CONTENT.seeds)) if (sd.unlockLevel === level) names.push(sd.label);
    return names.length ? t('toast.unlocked', { list: names.join(', ') }) : '';
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  /** Browser storage lives here, not in the simulation. */
  private newGame(): void {
    try {
      for (const k of Object.keys(window.localStorage)) if (k.startsWith('tcss.save.slot1')) window.localStorage.removeItem(k);
    } catch {
      /* storage blocked: reload still starts from whatever is stored */
    }
    window.location.reload();
  }

  private toolbarItems(): ToolbarItem[] {
    const sim = this.session.sim;
    const kind = sim.map.businessKind ?? sim.map.id;
    const dest = kind === 'farm' ? 'cafe' : kind === 'cafe' ? 'farm' : null;
    const lock = (reason: string, hide = false) => ({ ok: false as const, reason: t(reason), hide });
    const ok = { ok: true as const };
    return [
      {
        name: 'toolbar.travel',
        icon: dest === 'farm' ? 'farm' : 'cup',
        label: () => t(dest === 'farm' ? 'toolbar.toFarm' : 'toolbar.toCafe'),
        available: (s) => (!dest ? lock('toolbar.lock.noTravel', true) : s.story.chapter !== 'done' ? lock('toolbar.lock.story', true) : ok),
        onClick: () => {
          this.modals.closeAll();
          dest && sim.travelToRegion(sim.map.regionId ? `${sim.map.regionId}__${dest}` : dest);
        },
      },
      { name: 'inv.open', icon: 'box', label: () => t('toolbar.inventory'), available: () => ok, onClick: () => this.modals.toggle('inventory'), isOn: () => this.modals.isOpen('inventory') },
      { name: 'recipes.open', icon: 'scroll', label: () => t('toolbar.recipes'), available: () => ok, onClick: () => this.modals.toggle('recipes'), isOn: () => this.modals.isOpen('recipes') },
      {
        name: 'toolbar.staff',
        icon: 'people',
        label: () => t('toolbar.staff'),
        available: (s) => (s.employees.roles.length > 0 ? ok : lock('toolbar.lock.noStaff', true)),
        onClick: () => this.modals.toggle('staff'),
        isOn: () => this.modals.isOpen('staff'),
      },
      {
        name: 'decor.enter',
        icon: 'brush',
        label: () => t('toolbar.decor'),
        available: (s) => (!s.decor ? lock('toolbar.lock.noDecor', true) : s.decor.active ? lock('toolbar.lock.decorOn') : ok),
        onClick: () => {
          this.modals.closeAll();
          this.decorHud?.requestEnter();
        },
      },
      ...(sim.cafe && ['cafe', 'farm'].includes(sim.map.businessKind ?? sim.map.id) ? [{ name: 'tables.open', icon: 'chair', label: () => t('toolbar.tables'), available: () => ok, onClick: () => this.modals.toggle('tables'), isOn: () => this.modals.isOpen('tables') }] : []),
      { name: 'world.open', icon: 'map', label: () => t('toolbar.map'), available: (s) => (s.story.active ? lock('toolbar.lock.story', true) : ok), onClick: () => this.modals.toggle('map'), isOn: () => this.modals.isOpen('map') },
      { name: 'meta.open', icon: 'book', label: () => t('toolbar.book'), available: (s) => (s.story.active ? lock('toolbar.lock.story', true) : ok), onClick: () => this.modals.toggle('meta'), isOn: () => this.modals.isOpen('meta') },
    ];
  }

  /** A short-lived warning near the bottom of the screen. */
  private banner(msg: string): void {
    const b = this.add
      .text(hudViewport.w / 2, hudViewport.h - 90, msg, { fontFamily: FONT.family, fontSize: '14px', color: css(COLORS.cream), backgroundColor: css(COLORS.error), padding: { x: 10, y: 6 } })
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(3000);
    this.time.delayedCall(8000, () => b.destroy());
  }

  override update(_time: number, delta: number): void {
    const s = this.session.frame ?? this.session.sim.snapshot();
    this.lastSnap = s;
    this.debug?.update(s, this.game.loop.actualFps);
    this.profile.update(s, delta);
    this.currency.update(s);
    this.quests.update(s, delta);
    this.guide.update(s);
    this.orders?.update(s, delta);
    this.rating?.observe(s.reputation.value);
    this.toolbar.update(s);
    this.farmHud?.update(s);
    this.stationHud?.update(s);
    this.cafeHud?.update(s);
    this.cafeHud?.setVisible(!s.decor?.active);
    this.decorHud?.update(s);
    this.storyHud?.update(s);
    this.metaHud?.update(s);
    this.worldMapHud?.update(s, delta);
    this.inventory.update(s);
    this.recipes.update(s);
    this.staff.update(s);
    this.tables.update(s);
    this.watchQuests(s);
    this.relayoutFarmToggle();
  }

  /** Quest completion notice: fires once when a quest becomes claimable. */
  private watchQuests(s: SimulationSnapshot): void {
    for (const q of s.meta.quests) {
      const ready = q.done && !q.claimed && !q.locked;
      if (ready && !this.readyQuests.has(q.id)) {
        this.readyQuests.add(q.id);
        if (!s.story.active) this.toasts.push({ icon: 'check', title: t('toast.questReady'), text: q.label, tone: 'leaf' });
      } else if (!ready) this.readyQuests.delete(q.id);
    }
  }
}
