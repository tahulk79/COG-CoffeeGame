import type { GameContent } from '../../data/content';
import type { GameState } from '../state/GameState';
import { createNewGameState } from '../state/GameState';
import type { TransactionService } from '../../systems/economy/TransactionService';

export type BusinessKind = 'cafe' | 'farm';
export type RegionResult = { ok: true } | { ok: false; reason: string };
export interface EstateView {
  id: string; label: string; locked: boolean; owned: boolean;
  landCost: number; cafeCost: number; farmCost: number;
  cafeBuilt: boolean; farmBuilt: boolean; current: boolean;
}

/** Purchases change persistent ownership only after the economy accepts the full cost. */
export class RegionService {
  constructor(private readonly state: GameState, private readonly content: GameContent,
    private readonly tx: TransactionService, private readonly level: () => number,
    private readonly now: () => number, private readonly mapId: string) {}

  buyLand(id: string): RegionResult {
    const r = this.content.meta.regions[id];
    if (!r || r.landCost === undefined) return { ok: false, reason: 'unknownRegion' };
    if (this.state.story.chapter !== 'done') return { ok: false, reason: 'storyNotDone' };
    if (this.level() < r.unlockLevel) return { ok: false, reason: 'regionLocked' };
    if (this.state.regions[id]) return { ok: false, reason: 'alreadyOwned' };
    const paid = this.tx.execute({ reason: `land:${id}`, coins: -r.landCost, key: `land:${id}` });
    if (!paid.ok) return { ok: false, reason: paid.error };
    const fresh = createNewGameState({ now: this.now(), startingCoins: 0, startingItems: {}, wateringCanCapacity: this.content.economy.farm.wateringCan.capacity, map: '' });
    this.state.regions[id] = { ownerId: 'local-player', boughtAt: this.now(), cafeBuilt: false, farmBuilt: false,
      cafe: fresh.cafe, farm: fresh.farm, processing: fresh.processing, employees: fresh.employees };
    return { ok: true };
  }

  build(id: string, kind: BusinessKind): RegionResult {
    const r = this.content.meta.regions[id];
    if (!r || r.landCost === undefined || !['cafe', 'farm'].includes(kind)) return { ok: false, reason: 'unknownRegion' };
    if (this.state.story.chapter !== 'done') return { ok: false, reason: 'storyNotDone' };
    if (this.level() < r.unlockLevel) return { ok: false, reason: 'regionLocked' };
    const own = this.state.regions[id];
    if (!own) return { ok: false, reason: 'landRequired' };
    const flag = kind === 'cafe' ? 'cafeBuilt' : 'farmBuilt';
    if (own[flag]) return { ok: false, reason: 'alreadyOwned' };
    const paid = this.tx.execute({ reason: `build:${id}:${kind}`, coins: -(kind === 'cafe' ? r.cafeCost! : r.farmCost!), key: `build:${id}:${kind}` });
    if (!paid.ok) return { ok: false, reason: paid.error };
    own[flag] = true;
    return { ok: true };
  }

  canEnter(mapId: string): boolean {
    const map = this.content.maps[mapId];
    if (!map) return false;
    if (!map.regionId) return true;
    const own = this.state.regions[map.regionId];
    const r = this.content.meta.regions[map.regionId];
    return this.state.story.chapter === 'done' && !!r && this.level() >= r.unlockLevel && !!own && (map.businessKind === 'cafe' ? own.cafeBuilt : own.farmBuilt);
  }

  view(): EstateView[] {
    return Object.entries(this.content.meta.regions).filter(([, r]) => r.landCost !== undefined).map(([id, r]) => {
      const own = this.state.regions[id];
      return { id, label: r.label, locked: this.level() < r.unlockLevel, owned: !!own,
        landCost: r.landCost!, cafeCost: r.cafeCost!, farmCost: r.farmCost!,
        cafeBuilt: own?.cafeBuilt ?? false, farmBuilt: own?.farmBuilt ?? false, current: this.mapId.startsWith(`${id}__`) };
    });
  }
}
