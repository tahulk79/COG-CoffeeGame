import type { EmployeeView } from '../../gameplay/employees/EmployeeService';
import type { ActorView, WorldRenderer } from '../render/WorldRenderer';

/** One ActorView per hired employee; the bubble shows the current task or why they are idle. */
export class EmployeePresenter {
  private readonly views = new Map<string, ActorView>();

  constructor(
    private readonly renderer: Pick<WorldRenderer, 'createActor'>,
    private readonly taskLabel: (actionId: string) => string,
    private readonly recipeLabel: (id: string) => string = (id) => id,
  ) {}

  sync(employees: readonly EmployeeView[]): void {
    const seen = new Set<string>();
    for (const e of employees) {
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = this.renderer.createActor(e.id, 'employee');
        this.views.set(e.id, v);
      }
      v.update({
        pos: e.pos,
        state: e.state,
        facing: e.facing,
        heldItem: e.heldDrink ? this.recipeLabel(e.heldDrink) : null,
        progress: e.progress,
        bubble: e.heldDrink ? null : e.status === 'unpaid' ? '!' : e.task ? `${e.name}: ${this.taskLabel(e.task)}` : e.name,
      });
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.destroy();
        this.views.delete(id);
      }
    }
  }

  destroy(): void {
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
  }
}
