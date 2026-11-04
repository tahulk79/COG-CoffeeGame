import { icon } from './icons.js';

const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let lastPointer = null;
// Loại pointer vừa dùng thắng media query (máy lai cảm ứng + chuột).
addEventListener('pointerdown', event => { lastPointer = event.pointerType; }, { capture: true, passive: true });

/** true khi người chơi đang dùng cảm ứng/bút: chọn chữ "Chạm…" thay vì "Bấm…/Enter". */
export const usesTouch = () => (lastPointer ? lastPointer !== 'mouse' : !finePointer.matches);
export const continueHint = () => (usesTouch() ? 'Chạm để tiếp' : 'Enter hoặc bấm để tiếp');

export function showDialogue(beat, player) {
  const [, speaker, line] = beat;
  const box = document.getElementById('caption-box');
  box.hidden = !line;
  document.getElementById('speaker').textContent = speaker === 'BẠN' ? player.name : speaker;
  document.getElementById('caption').textContent = line;
  box.querySelector('.dialogue-hint').textContent = continueHint();
  document.getElementById('dialogue-tip').hidden = true;
  const role = speaker === 'THẦN CHẾT' ? 'reaper' : speaker === 'BẠN' ? 'player' : speaker === 'NHÂN VIÊN Y TẾ' ? 'medic' : 'narrator';
  box.dataset.speaker = role;
  setAvatar({ reaper: '☠', player: 'player', medic: '✚', narrator: '✦' }[role]);
}

// Speaker badge from the game icon set (docs/shared/design-system.md §4); portraits rendered from the 3D models can replace these later.
const AVATARS = { player: 'person', '☠': 'skull', '✚': 'medic', '✦': 'star', '❧': 'sprout', '☕': 'cup-hot', '₫': 'coin', '▤': 'ticket' };
export function setAvatar(glyph) {
  document.getElementById('dialogue-avatar').replaceChildren(AVATARS[glyph] ? icon(AVATARS[glyph]) : glyph);
}
