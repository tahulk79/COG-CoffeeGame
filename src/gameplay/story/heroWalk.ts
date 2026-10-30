import type { Actor } from '../../entities/Actor';

/**
 * Direct control of the hero, shared by every free-walk chapter (chapter 1's street, chapter 2's road…):
 * the steering direction, facing it, moving at the chapter's speed through the chapter's own collision
 * (`move`), and the walking pose kept while moving (standing again only after 120 ms of pushing without
 * getting anywhere, so it never flickers). Pure simulation: tile units, ms.
 */
export class HeroWalk {
  /** Unit direction in world (tile) axes, or (0, 0). */
  dir = { x: 0, y: 0 };
  /** How long the stick has pushed without the hero getting anywhere (ms). */
  stillMs = 0;

  /** `allowed` false (the run not started, someone talking…) releases the stick. */
  set(x: number, y: number, allowed = true): void {
    const len = Math.hypot(x, y);
    this.dir = len > 1e-3 && allowed ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  stop(): void {
    this.dir = { x: 0, y: 0 };
  }

  get steering(): boolean {
    return this.dir.x !== 0 || this.dir.y !== 0;
  }

  /** One step of `dt` ms at `speed` tiles/s; `flip` -1 swaps the directions (chapter 1's shorts over the eyes). True if the hero moved. */
  step(player: Actor, dt: number, speed: number, move: (dx: number, dy: number) => void, flip = 1): boolean {
    if (!this.steering) return false;
    const sx = this.dir.x * flip, sy = this.dir.y * flip;
    player.clearWaypoints();
    player.faceTowards({ x: player.pos.x + sx, y: player.pos.y + sy });
    const before = { ...player.pos };
    move((sx * speed * dt) / 1000, (sy * speed * dt) / 1000);
    const moved = Math.hypot(player.pos.x - before.x, player.pos.y - before.y) > 0.001;
    this.stillMs = moved ? 0 : this.stillMs + dt;
    if (moved && player.fsm.can('MOVING')) player.fsm.transition('MOVING');
    else if (!moved && this.stillMs > 120 && player.fsm.is('MOVING')) player.fsm.transition(player.restState());
    return moved;
  }
}
