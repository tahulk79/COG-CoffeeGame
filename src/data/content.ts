import gameplay from './config/gameplay.json';
import objectTypes from './config/objectTypes.json';
import story from './config/story.json';
import incidentMap from './maps/incident.json';
import afterlifeMap from './maps/afterlife.json';
import cafeMap from './maps/cafe.json';
import trials from './config/trials.json';
import type { GameplayConfig } from '../gameplay/GameSimulation';
import type { MapData, ObjectTypeTable } from '../gameplay/world/types';
import type { StoryConfig } from '../gameplay/story/StoryService';
import type { TrialConfig } from '../gameplay/story/TrialService';

/** Everything data-driven the simulation needs, typed once here. */
export interface GameContent {
  gameplay: GameplayConfig;
  objectTypes: ObjectTypeTable;
  maps: Record<string, MapData>;
  story: StoryConfig;
  /** Chapter 2: the stations, their questions, the door and the rebirth wheel. */
  trials: TrialConfig;
}

export function validateContent(c: GameContent): string[] {
  const p: string[] = [];
  for (const [id, ch] of Object.entries(c.story.chapters)) {
    if (!c.maps[ch.map]) p.push(`story ${id}: unknown map ${ch.map}`);
    if (!c.story.chapters[ch.next]) p.push(`story ${id}: unknown next chapter ${ch.next}`);
  }
  if (!c.story.chapters[c.story.start]) p.push('story: unknown start chapter');
  return p;
}

export const CONTENT: GameContent = {
  gameplay: gameplay as GameplayConfig,
  objectTypes: objectTypes as ObjectTypeTable,
  maps: { incident: incidentMap as MapData, afterlife: afterlifeMap as MapData, cafe: cafeMap as MapData },
  story: story as unknown as StoryConfig,
  trials: trials as unknown as TrialConfig,
};

const problems = validateContent(CONTENT);
if (problems.length) throw new Error(`Invalid game content:\n- ${problems.join('\n- ')}`);
