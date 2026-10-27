import type { ActionRegistry } from '../actions/ActionRegistry';
import { mustSucceed } from '../farm/farmHandlers';
import type { StoryService } from './StoryService';

/** Story objectives: kitten, sense stones, portal, hidden cherry, the master. */
export function registerStoryHandlers(registry: ActionRegistry, story: StoryService): void {
  registry
    .register('story.rescue', { canStart: () => story.canRescue(), complete: () => mustSucceed(story.rescue(), 'rescue') })
    .register('story.activate', { canStart: ({ object }) => story.canActivate(object.id), complete: ({ object }) => mustSucceed(story.activate(object.id), 'activate') })
    .register('story.enterPortal', { canStart: () => story.canEnterPortal(), complete: () => mustSucceed(story.enterPortal(), 'enterPortal') })
    .register('story.pickCherry', { canStart: () => story.canPickCherry(), complete: () => mustSucceed(story.pickCherry(), 'pickCherry') })
    .register('story.talk', { canStart: () => story.canTalk(), complete: () => mustSucceed(story.talk(), 'talk') });
}
