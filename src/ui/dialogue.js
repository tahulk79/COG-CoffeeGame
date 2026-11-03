export function showDialogue(beat, player) {
  const [, speaker, line] = beat;
  const box = document.getElementById('caption-box');
  box.hidden = !line;
  document.getElementById('speaker').textContent = speaker === 'BẠN' ? player.name : speaker;
  document.getElementById('caption').textContent = line;
  const role = speaker === 'THẦN CHẾT' ? 'reaper' : speaker === 'BẠN' ? 'player' : speaker === 'NHÂN VIÊN Y TẾ' ? 'medic' : 'narrator';
  box.dataset.speaker = role;
  document.getElementById('dialogue-avatar').textContent = { reaper: '☠', player: player.name.slice(0, 1).toUpperCase(), medic: '✚', narrator: '✦' }[role];
}
