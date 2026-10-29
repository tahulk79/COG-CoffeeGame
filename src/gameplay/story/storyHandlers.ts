import type { ActionRegistry } from '../actions/ActionRegistry';
import type { StoryService } from './StoryService';

const mustSucceed = (r: { ok: true } | { ok: false; reason: string }, what: string): void => {
  // canStart already passed moments ago; a failure here means a rule bug, not a player error.
  if (!r.ok) throw new Error(`${what} failed after canStart passed: ${r.reason}`);
};

/** Story objectives: chapter-1 street props, chapter-2 sense stones, portal and hidden cherry. */
export function registerStoryHandlers(registry: ActionRegistry, story: StoryService): void {
  registry
    .register('story.rescue', { canStart: () => story.canRescue(), complete: () => mustSucceed(story.rescue(), 'rescue') })
    .register('story.prop', { canStart: ({ object }) => story.canVisit(object.id), complete: ({ object }) => mustSucceed(story.visit(object.id), 'visit') })
    .register('story.activate', { canStart: ({ object }) => story.canActivate(object.id), complete: ({ object }) => mustSucceed(story.activate(object.id), 'activate') })
    .register('story.enterPortal', { canStart: () => story.canEnterPortal(), complete: () => mustSucceed(story.enterPortal(), 'enterPortal') })
    .register('story.pickCherry', { canStart: () => story.canPickCherry(), complete: () => mustSucceed(story.pickCherry(), 'pickCherry') });
}
