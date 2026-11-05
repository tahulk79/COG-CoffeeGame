import { icon } from './icons.js';
import { t } from '../i18n/index.js';

const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let lastPointer = null;
// Loại pointer vừa dùng thắng media query (máy lai cảm ứng + chuột).
addEventListener('pointerdown', event => { lastPointer = event.pointerType; }, { capture: true, passive: true });

/** true khi người chơi đang dùng cảm ứng/bút: chọn chữ "Chạm…" thay vì "Bấm…/Enter". */
export const usesTouch = () => (lastPointer ? lastPointer !== 'mouse' : !finePointer.matches);
export const continueHint = () => t(usesTouch() ? 'dialogue.tapToContinue' : 'dialogue.pressToContinue');

// Mã người nói trong dữ liệu hội thoại (không dịch): 'BẠN' = người chơi, 'THẦN CHẾT', 'NHÂN VIÊN Y TẾ'. Tên khác hiển thị nguyên văn (nơi gọi đã dịch).
const ROLES = { 'BẠN': 'player', 'THẦN CHẾT': 'reaper', 'NHÂN VIÊN Y TẾ': 'medic' };

export function showDialogue(beat, player) {
  const [, speaker, line] = beat;
  const box = document.getElementById('caption-box');
  box.hidden = !line;
  const role = ROLES[speaker] || 'narrator';
  document.getElementById('speaker').textContent = role === 'player' ? player.name : role === 'narrator' ? speaker : t(`dialogue.speaker.${role}`);
  document.getElementById('caption').textContent = line;
  box.querySelector('.dialogue-hint').textContent = continueHint();
  document.getElementById('dialogue-tip').hidden = true;
  box.dataset.speaker = role;
  setAvatar({ reaper: '☠', player: 'player', medic: '✚', narrator: '✦' }[role]);
}

// Speaker badge from the game icon set (docs/design/godbean-gdd.md §11); portraits rendered from the 3D models can replace these later.
const AVATARS = { player: 'person', '☠': 'skull', '✚': 'medic', '✦': 'star', '❧': 'sprout', '☕': 'cup-hot', '₫': 'coin', '▤': 'ticket' };
export function setAvatar(glyph) {
  document.getElementById('dialogue-avatar').replaceChildren(AVATARS[glyph] ? icon(AVATARS[glyph]) : glyph);
}
