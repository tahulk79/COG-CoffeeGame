import { createAdventureScene } from '../../shared/world/scene.js';
import { NPCS } from './content.js';

export function createHeavenScene(character) {
  const interactions = NPCS.map(npc => npc.id === 'portal' ? npc : {
    ...npc, facing: Math.atan2(-npc.position[0], -3 - npc.position[1]),
  });
  return createAdventureScene(character, { interactions, theme: 'heaven' });
}
