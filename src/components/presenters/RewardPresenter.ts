import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { t } from '../../core/i18n';
import type { WorldModel } from '../../gameplay/world/WorldModel';
import type { WorldPos } from '../../utils/tile';
import type { WorldRenderer } from '../render/WorldRenderer';

/**
 * Floating reward numbers, driven only by real transactions and events (the
 * numbers shown are exactly what the TransactionService applied).
 * Café payments are shown at the customer by the rating popup, so they are skipped here.
 */
export class RewardPresenter {
  private readonly offs: Array<() => void> = [];

  constructor(
    bus: EventBus<GameEvents>,
    world: WorldModel,
    private readonly sink: Pick<WorldRenderer, 'showFeedback' | 'showRatingBubble'>,
    playerPos: () => WorldPos,
    customerPos: (id: string) => WorldPos | undefined,
    equipmentLabel: (id: string) => string,
    scheduleMs: (ms: number, fn: () => void) => void,
  ) {
    const objectPos = (id: string): WorldPos => {
      const o = world.getObject(id);
      return o ? { x: o.footprint.x + o.footprint.w / 2, y: o.footprint.y + o.footprint.h / 2 } : playerPos();
    };
    this.offs.push(
      bus.on('economy:transaction', (r) => {
        if (r.reason.startsWith('order:') || r.reason.startsWith('debug:')) return;
        const at = playerPos();
        if (r.reason.startsWith('upgradeEquipment:')) {
          const id = r.reason.split(':')[1]!;
          this.sink.showFeedback(objectPos(id), t('reward.upgraded', { name: equipmentLabel(id) }), 'unlock');
          return;
        }
        if (r.coins > 0) this.sink.showFeedback(at, t('reward.coins', { n: r.coins }), 'coin');
        if (r.exp > 0) scheduleMs(r.coins > 0 ? 260 : 0, () => this.sink.showFeedback(at, t('reward.exp', { n: r.exp }), 'exp'));
      }),
      bus.on('cafe:rated', (e) => {
        const at = customerPos(e.customerId);
        if (!at) return;
        this.sink.showRatingBubble(at, t(`rate.${e.stars}`), e.stars);
        this.sink.showFeedback(at, t('reward.coins', { n: e.coins + e.tip }), 'coin');
      }),
      bus.on('meta:questClaimed', () => this.sink.showFeedback(playerPos(), t('reward.questDone'), 'unlock')),
      bus.on('meta:achievement', (e) => this.sink.showFeedback(playerPos(), t('meta.achievement', { name: e.label }), 'unlock')),
      bus.on('employee:hired', () => this.sink.showFeedback(playerPos(), t('reward.hired'), 'unlock')),
    );
  }

  destroy(): void {
    for (const off of this.offs) off();
  }
}
