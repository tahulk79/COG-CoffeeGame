import { createAdventureScene } from '../../shared/world/scene.js';
import { NPCS, SPAWN } from './content.js';

// Warm gold key over a cream plaza; less fill than before so floor, paths and the gods' daises separate (03 §4).
const HEAVEN_LIGHT = { sky: '#fff3dc', ground: '#c9b48a', ambient: 1.7, sun: '#ffe9c2', sunIntensity: 3.4, background: '#f3ead6' };

export function createHeavenScene(character) {
  // Bệ thần quay về tâm sân (0, -3); Thần Chết / Thần Tiếp Nhận của 02-mini quay về chỗ người chơi xuất hiện.
  const interactions = NPCS.map(npc => npc.id === 'portal' ? npc : {
    ...npc, facing: npc.noDais ? Math.atan2(SPAWN[0] - npc.position[0], SPAWN[1] - npc.position[1]) : Math.atan2(-npc.position[0], -3 - npc.position[1]),
  });
  return createAdventureScene(character, { interactions, theme: 'heaven', lighting: HEAVEN_LIGHT });
}
