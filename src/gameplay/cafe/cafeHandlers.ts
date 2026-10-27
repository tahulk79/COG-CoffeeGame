import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { ActionRegistry } from '../actions/ActionRegistry';
import { mustSucceed } from '../farm/farmHandlers';
import { stationOf } from '../world/types';
import type { BrewingService } from './BrewingService';
import type { CafeService } from './CafeService';

/** Café counter, brewing stations, serving spots and travel signs. `cafe` is null on maps without a café floor. */
export function registerCafeHandlers(
  registry: ActionRegistry,
  cafe: CafeService | null,
  brewing: BrewingService,
  bus: EventBus<GameEvents>,
  mapIds: readonly string[],
  /** Upgrades shorten these actions (1 = base duration). */
  factors: { brew: () => number; clean: () => number } = { brew: () => 1, clean: () => 1 },
  canTravel: (map: string) => boolean = () => true,
): void {
  registry
    .register('cafe.takeOrder', {
      canStart: () => (cafe ? cafe.canTakeOrder() : { ok: false, reason: 'noCafe' }),
      complete: () => mustSucceed(cafe!.takeOrder(), 'takeOrder'),
    })
    .register('brew.station', {
      // The station type identifies the step (grinder, espresso machine, milk station).
      canStart: ({ object, actor }) => brewing.canUseStation(stationOf(object), actor),
      complete: ({ object, actor }) => mustSucceed(brewing.useStation(stationOf(object), actor), 'useStation'),
      durationFactor: () => factors.brew(),
    })
    .register('cafe.serve', {
      canStart: ({ object, actor }) => (cafe ? cafe.canServe(object.id, brewing.heldDrink(actor)) : { ok: false, reason: 'noCafe' }),
      complete: ({ object, actor }) => {
        const drink = brewing.heldDrink(actor)!;
        mustSucceed(cafe!.receive(object.id, drink), 'serve');
        brewing.handOver(drink.id, actor);
      },
    })
    .register('cafe.collectPayment', {
      canStart: ({ object }) => (cafe ? cafe.canCollect(object.id) : { ok: false, reason: 'noCafe' }),
      complete: ({ object }) => mustSucceed(cafe!.collectPayment(object.id), 'collectPayment'),
    })
    .register('cafe.clean', {
      canStart: ({ object, actor }) => (cafe ? cafe.canClean(object.id, actor.id) : { ok: false, reason: 'noCafe' }),
      complete: ({ object, actor }) => mustSucceed(cafe!.finishCleaning(object.id, actor.id), 'clean'),
      durationFactor: () => factors.clean(),
    })
    .register('cafe.pickup', {
      // Servers collect a finished drink from the counter's pickup pool.
      canStart: ({ actor }) => (actor.heldItem ? { ok: false, reason: 'handsFull' } : brewing.pooledDrink() ? { ok: true } : { ok: false, reason: 'nothingToPickUp', applicable: false }),
      complete: ({ actor }) => mustSucceed(brewing.pickUp(actor), 'pickUp'),
    })
    .register('travel.go', {
      canStart: ({ object }) => (mapIds.includes(String(object.props.map)) && canTravel(String(object.props.map)) ? { ok: true } : { ok: false, reason: 'unknownMap' }),
      complete: ({ object }) => bus.emit('world:travelRequested', { map: String(object.props.map) }),
    });
}
