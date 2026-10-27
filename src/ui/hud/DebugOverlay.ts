import type Phaser from 'phaser';
import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { t } from '../../core/i18n';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { debugFlags } from '../theme/debugFlags';
import { DEPTH } from '../theme/tokens';

/**
 * Developer overlay: coordinates, state machines, interaction log. Off by
 * default; F3 or ` toggles it. It is never created in production builds and
 * has no input handlers, so it cannot intercept gameplay clicks.
 */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private readonly recent: string[] = [];
  private readonly offs: Array<() => void> = [];
  private on = false;
  private perf = '';
  private perfAt = 0;
  private readonly keyHandler = () => this.toggle();

  constructor(
    private readonly scene: Phaser.Scene,
    bus: EventBus<GameEvents>,
  ) {
    this.text = scene.add
      .text(8, 56, '', { fontFamily: 'monospace', fontSize: '12px', color: '#f6e8cc', backgroundColor: '#000000aa', padding: { x: 6, y: 4 } })
      .setScrollFactor(0)
      .setDepth(DEPTH.debug)
      .setVisible(false);
    const log = (s: string) => {
      this.recent.unshift(s);
      this.recent.length = Math.min(this.recent.length, 6);
    };
    this.offs.push(
      bus.on('actor:stateChanged', (e) => log(`${e.actorId}: ${t(`state.${e.from}`)} → ${t(`state.${e.to}`)}`)),
      bus.on('interaction:started', (e) => log(`${t('debug.start')} ${e.objectId}.${e.actionId}`)),
      bus.on('interaction:completed', (e) => log(`${t('debug.done')} ${e.objectId}.${e.actionId}`)),
      bus.on('interaction:failed', (e) => log(`${t('debug.fail')} ${e.objectId} ${t(`feedback.fail.${e.detail ?? e.reason}`)}`)),
      bus.on('interaction:cancelled', (e) => log(`${t('debug.cancel')} ${e.objectId}`)),
      bus.on('move:unreachable', (e) => log(`${t('debug.unreachable')} ${e.target.x},${e.target.y}`)),
    );
    scene.input.keyboard?.on('keydown-F3', this.keyHandler);
    scene.input.keyboard?.on('keydown-BACKTICK', this.keyHandler);
  }

  toggle(): void {
    this.on = !this.on;
    debugFlags.enabled = this.on;
    this.text.setVisible(this.on);
  }

  /** Active GameObjects per scene (containers counted recursively), refreshed twice a second. */
  private measure(fps: number): string {
    const now = performance.now();
    if (now - this.perfAt < 500) return this.perf;
    this.perfAt = now;
    const count = (list: Phaser.GameObjects.GameObject[]): number => list.reduce((n, o) => n + 1 + ((o as Phaser.GameObjects.Container).list ? count((o as Phaser.GameObjects.Container).list) : 0), 0);
    const scenes = this.scene.game.scene.getScenes(true).map((sc) => `${sc.scene.key}:${count(sc.children.list)}`).join(' ');
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    this.perf = `${fps.toFixed(0)} fps · ${(1000 / Math.max(1, fps)).toFixed(1)} ms · objects ${scenes} · textures ${this.scene.textures.getTextureKeys().length}${heap ? ` · heap ${(heap.usedJSHeapSize / 1048576).toFixed(0)} MB` : ''}`;
    return this.perf;
  }

  update(s: SimulationSnapshot, fps: number): void {
    if (!this.on) return;
    const p = s.player;
    const cur = s.interaction.current;
    this.text.setText(
      [
        `TheCoffeeSixSense · ${t('debug.map')}: ${s.map}`,
        this.measure(fps),
        t('debug.help'),
        `${t('debug.player')}  ${t(`state.${p.state}`)}  ${t('debug.tile')} ${p.tile.x},${p.tile.y}  pos ${p.pos.x.toFixed(2)},${p.pos.y.toFixed(2)}  ${t('debug.facing')} ${p.facing}`,
        `${t('debug.held')}  ${p.heldItem ?? '-'}`,
        `${t('debug.action')}  ${cur ? `${cur.objectId}.${cur.actionId ?? '?'} [${cur.phase}] ${(cur.progress * 100).toFixed(0)}%` : '-'}`,
        `${t('debug.queue')}  ${s.interaction.queue.map((q) => q.objectId).join(' → ') || '-'}`,
        t('debug.events'),
        ...this.recent,
      ].join('\n'),
    );
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.scene.input.keyboard?.off('keydown-F3', this.keyHandler);
    this.scene.input.keyboard?.off('keydown-BACKTICK', this.keyHandler);
    debugFlags.enabled = false;
    this.text.destroy();
  }
}
