import economy from './config/economy.json';
import gameplay from './config/gameplay.json';
import items from './config/items.json';
import market from './config/market.json';
import processing from './config/processing.json';
import objectTypes from './config/objectTypes.json';
import seeds from './config/seeds.json';
import recipes from './config/recipes.json';
import customers from './config/customers.json';
import cafeMap from './maps/cafe.json';
import brewing from './config/brewing.json';
import progression from './config/progression.json';
import employees from './config/employees.json';
import furniture from './config/furniture.json';
import cafeUpgrades from './config/cafeUpgrades.json';
import neighbors from './config/neighbors.json';
import meta from './config/meta.json';
import story from './config/story.json';
import masterMap from './maps/master.json';
import incidentMap from './maps/incident.json';
import portalMap from './maps/portal.json';
import farmMap from './maps/farm.json';
import sandboxMap from './maps/sandbox.json';
import type { GameplayConfig } from '../gameplay/GameSimulation';
import type { FarmConfig } from '../gameplay/farm/FarmService';
import type { SeedTable } from '../gameplay/farm/plotModel';
import type { MapData, ObjectTypeTable } from '../gameplay/world/types';
import type { ItemTable } from '../systems/economy/TransactionService';
import type { ProcessingConfig } from '../gameplay/processing/ProcessingService';
import type { MarketConfig } from '../gameplay/market/MarketService';
import type { RecipeTable } from '../gameplay/cafe/OrderService';
import type { CustomerConfig } from '../gameplay/cafe/CafeService';
import type { BrewingConfig, BrewStep } from '../gameplay/cafe/BrewingService';
import type { RatingConfig } from '../gameplay/cafe/RatingService';
import type { ProgressionConfig } from '../gameplay/progression/ProgressionService';
import type { CafeUpgradeConfig } from '../gameplay/cafe/CafeUpgradeService';
import type { NeighborConfig } from '../gameplay/social/NeighborService';
import type { MetaConfig } from '../gameplay/meta/MetaService';
import type { StoryConfig } from '../gameplay/story/StoryService';
import type { EmployeeConfig } from '../gameplay/employees/EmployeeService';
import type { FurnitureConfig } from '../gameplay/decor/FurnitureService';

export interface EconomyConfig {
  startingCoins: number;
  startingItems: Record<string, number>;
  inventoryCapacity: number;
  historyLimit: number;
  processedKeyLimit: number;
  farm: FarmConfig;
}

/** Everything data-driven the simulation needs, typed once here. */
export interface GameContent {
  gameplay: GameplayConfig;
  economy: EconomyConfig;
  items: ItemTable;
  seeds: SeedTable;
  objectTypes: ObjectTypeTable;
  processing: ProcessingConfig;
  market: MarketConfig;
  recipes: RecipeTable;
  customers: CustomerConfig;
  brewing: BrewingConfig;
  progression: RatingConfig & ProgressionConfig;
  maps: Record<string, MapData>;
  furniture: FurnitureConfig;
  employees: EmployeeConfig;
  story: StoryConfig;
  meta: MetaConfig;
  neighbors: NeighborConfig;
  cafeUpgrades: CafeUpgradeConfig;
}

export function validateContent(c: GameContent): string[] {
  const p: string[] = [];
  for (const [id, s] of Object.entries(c.seeds)) {
    if (!c.items[s.seedItem]) p.push(`seed ${id}: unknown seedItem ${s.seedItem}`);
    if (!c.items[s.productItem]) p.push(`seed ${id}: unknown productItem ${s.productItem}`);
    if (!(s.waterings >= 1) || !Number.isInteger(s.waterings)) p.push(`seed ${id}: waterings must be an integer ≥ 1`);
    if (!(s.growthMs > 0)) p.push(`seed ${id}: growthMs must be > 0`);
    if (!(s.purchaseCost >= 0) || !(s.yield >= 1)) p.push(`seed ${id}: cost/yield out of range`);
  }
  for (const id of Object.keys(c.economy.startingItems)) if (!c.items[id]) p.push(`startingItems: unknown item ${id}`);
  for (const [id, r] of Object.entries(c.processing.recipes)) {
    if (!c.processing.equipment[r.equipment]) p.push(`recipe ${id}: unknown equipment ${r.equipment}`);
    if (!c.items[r.input.itemId]) p.push(`recipe ${id}: unknown input ${r.input.itemId}`);
    if (!c.items[r.output.itemId]) p.push(`recipe ${id}: unknown output ${r.output.itemId}`);
    if (!(r.input.qty >= 1 && r.output.qty >= 1 && r.durationMs > 0)) p.push(`recipe ${id}: quantities/duration out of range`);
    if (!(r.output.itemId in c.market.basePrices)) p.push(`recipe ${id}: output ${r.output.itemId} has no market price`);
  }
  for (const [type, e] of Object.entries(c.processing.equipment)) {
    if (e.levels.some((l, i) => l.level !== i + 1)) p.push(`equipment ${type}: levels must be 1..n`);
    if (!c.objectTypes[type]) p.push(`equipment ${type}: no object type`);
  }
  for (const id of Object.keys(c.market.basePrices)) if (!c.items[id]) p.push(`market: unknown item ${id}`);
  for (const [id, r] of Object.entries(c.recipes)) {
    for (const ing of r.ingredients) {
      const kinds = [ing.itemId, ing.category, ing.utility].filter((k) => k !== undefined).length;
      if (kinds !== 1) p.push(`recipe ${id}: each ingredient needs exactly one of itemId/category/utility`);
      if (ing.itemId && !c.items[ing.itemId]) p.push(`recipe ${id}: unknown item ${ing.itemId}`);
      if (ing.category && !Object.values(c.items).some((it) => it.category === ing.category)) p.push(`recipe ${id}: no items in category ${ing.category}`);
    }
    if (!c.items[r.preferredBean]) p.push(`recipe ${id}: unknown preferredBean`);
    const steps = (r as unknown as { steps?: BrewStep[] }).steps ?? [];
    if (steps.length === 0) p.push(`recipe ${id}: no brewing steps`);
    if (steps[0]?.kind !== 'choose_bean') p.push(`recipe ${id}: first step must choose the bean`);
    for (const s of steps) {
      if (!Object.values(c.objectTypes).length || !c.objectTypes[s.station]) p.push(`recipe ${id}: step ${s.id} uses unknown station ${s.station}`);
      if (s.kind === 'choose_addition' && !c.brewing.additions[s.correct]) p.push(`recipe ${id}: unknown addition ${s.correct}`);
      if (s.kind === 'timing' && !(s.target >= 0 && s.target <= 1 && s.tolerance > 0 && s.periodMs > 0)) p.push(`recipe ${id}: bad timing step ${s.id}`);
    }
  }
  for (const [k, a] of Object.entries(c.customers.archetypes)) {
    for (const rid of Object.keys(a.preferences)) if (!c.recipes[rid]) p.push(`customer ${k}: unknown recipe ${rid}`);
    if (!(a.orderPatienceMs > 0 && a.drinkPatienceMs > 0 && a.speedTilesPerSec > 0)) p.push(`customer ${k}: patience/speed must be > 0`);
  }
  const pr = c.progression;
  const wsum = Object.values(pr.rating.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(wsum - 1) > 1e-9) p.push(`rating weights must sum to 1 (got ${wsum})`);
  for (const key of ['starThresholds', 'priceMultiplier', 'tipShare', 'expMultiplier'] as const) {
    if (pr.rating[key].length !== 5) p.push(`rating.${key} needs 5 entries (1–5 stars)`);
  }
  if (pr.rating.starThresholds.some((v, i, a) => i > 0 && v <= a[i - 1]!)) p.push('rating.starThresholds must increase');
  for (const rid of Object.keys(c.recipes)) if (!(rid in pr.recipeUnlockLevel)) p.push(`recipe ${rid}: no unlock level`);
  if (!Object.values(pr.recipeUnlockLevel).some((l) => l <= 1)) p.push('at least one recipe must be available at level 1');
  const levels = c.economy.farm.soilLevels.map((l) => l.level);
  if (levels[0] !== 1 || levels.some((l, i) => l !== i + 1)) p.push('soilLevels must be 1..n in order');
  for (const [type, f] of Object.entries(c.furniture.catalog)) {
    const def = c.objectTypes[type];
    if (!def) p.push(`furniture ${type}: no object type`);
    if (c.items[f.itemId]?.category !== 'furniture') p.push(`furniture ${type}: item ${f.itemId} must exist with category "furniture"`);
    if (!(f.price > 0 && f.comfort >= 0 && f.decor >= 0)) p.push(`furniture ${type}: price must be > 0, comfort/decor ≥ 0`);
    if (!(Number.isInteger(f.unlockLevel) && f.unlockLevel >= 1)) p.push(`furniture ${type}: unlockLevel must be an integer ≥ 1`);
    // A non-blocking piece people use must be a seat (customers sit on it, the player serves there).
    if (def && !def.blocking && !def.interaction?.actions.some((a) => a.handler === 'cafe.serve')) p.push(`furniture ${type}: non-blocking furniture must be a seat`);
  }
  for (const [id, r] of Object.entries(c.employees.roles)) {
    if (!c.maps[r.map]) p.push(`employee role ${id}: unknown map ${r.map}`);
    if (!(r.hireCost >= 0 && r.wage >= 0 && r.payrollMs > 0 && r.speedTilesPerSec > 0 && r.retryMs > 0)) p.push(`employee role ${id}: cost/wage/payroll/speed out of range`);
  }
  for (const [id, ch] of Object.entries(c.story.chapters)) {
    if (!c.maps[ch.map]) p.push(`story ${id}: unknown map ${ch.map}`);
    if (ch.next !== 'done' && !c.story.chapters[ch.next]) p.push(`story ${id}: unknown next chapter ${ch.next}`);
  }
  if (!c.story.chapters[c.story.start]) p.push('story: unknown start chapter');
  const m = c.meta;
  for (const [id, r] of Object.entries(m.regions)) {
    if (r.map && !c.maps[r.map]) p.push(`region ${id}: unknown map ${r.map}`);
    if (r.landCost !== undefined && [r.landCost, r.cafeCost, r.farmCost].some((cost) => !Number.isInteger(cost) || cost! < 0)) p.push(`region ${id}: invalid land/building prices`);
  }
  for (const [id, b] of Object.entries(m.branches)) if (!m.regions[b.region]) p.push(`branch ${id}: unknown region ${b.region}`);
  const ids = new Set<string>();
  for (const g of [...m.quests, ...m.achievements]) {
    if (ids.has(g.id)) p.push(`goal ${g.id}: duplicate id`);
    ids.add(g.id);
    if (!(g.target > 0)) p.push(`goal ${g.id}: target must be > 0`);
    if (g.requires && !m.quests.some((q) => q.id === g.requires)) p.push(`quest ${g.id}: unknown requires ${g.requires}`);
    for (const it of g.reward.items ?? []) if (!c.items[it.itemId]) p.push(`goal ${g.id}: unknown reward item ${it.itemId}`);
  }
  for (const n of c.neighbors.cafes) {
    if (!m.regions[n.region]) p.push(`neighbour café ${n.id}: unknown region ${n.region}`);
    for (const f of n.layout) if (!c.furniture.catalog[f.type]) p.push(`neighbour café ${n.id}: ${f.type} is not furniture`);
  }
  if (!c.maps[c.story.afterStoryMap]) p.push('story: unknown afterStoryMap');
  return p;
}

export const CONTENT: GameContent = {
  gameplay: gameplay as GameplayConfig,
  economy: economy as EconomyConfig,
  items: items as ItemTable,
  seeds: seeds as SeedTable,
  objectTypes: objectTypes as ObjectTypeTable,
  processing: processing as ProcessingConfig,
  market: market as MarketConfig,
  recipes: recipes as RecipeTable,
  customers: customers as CustomerConfig,
  brewing: brewing as BrewingConfig,
  progression: progression as RatingConfig & ProgressionConfig,
  maps: { farm: farmMap as MapData, cafe: cafeMap as MapData, sandbox: sandboxMap as MapData, incident: incidentMap as MapData, portal: portalMap as MapData, master: masterMap as MapData },
  furniture: furniture as FurnitureConfig,
  employees: employees as EmployeeConfig,
  story: story as unknown as StoryConfig,
  meta: meta as unknown as MetaConfig,
  neighbors: neighbors as unknown as NeighborConfig,
  cafeUpgrades: cafeUpgrades as unknown as CafeUpgradeConfig,
};

// Reuse the proven playable layouts; object IDs and travel signs belong to each region.
for (const [regionId, region] of Object.entries(CONTENT.meta.regions)) {
  if (region.landCost === undefined) continue;
  for (const kind of ['cafe', 'farm'] as const) {
    const map = structuredClone(CONTENT.maps[kind]!);
    map.id = `${regionId}__${kind}`;
    map.name = `${region.label} · ${kind === 'cafe' ? 'Quán cà phê' : 'Nông trại'}`;
    map.regionId = regionId;
    map.businessKind = kind;
    for (const o of map.objects) {
      o.id = `${map.id}:${o.id}`;
      if (o.type === 'travel_sign' && o.props?.map) o.props.map = `${regionId}__${o.props.map}`;
    }
    CONTENT.maps[map.id] = map;
  }
}

const problems = validateContent(CONTENT);
if (problems.length) throw new Error(`Invalid game content:\n- ${problems.join('\n- ')}`);
