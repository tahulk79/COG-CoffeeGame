import { readProgress, readSettings, resetProgress, saveSettings } from '../state/progress.js';
import { setVolume, setMuted, hasContent, sfx } from '../shared/audio/index.js';
import { getQuality, setQuality } from '../shared/vfx/index.js';

const SLIDERS = [['master', 'Tổng'], ['music', 'Nhạc'], ['ambience', 'Môi trường'], ['sfx', 'Hiệu ứng'], ['ui', 'Giao diện']];
const QUALITY = [
  ['low', 'Thấp', 'Tắt bóng, ít hạt. Mượt hơn trên máy yếu.'],
  ['medium', 'Vừa', 'Có bóng, hạt vừa phải.'],
  ['high', 'Cao', 'Đầy đủ bóng và hiệu ứng.'],
];
const PREVIEW = { sfx: 'coin.gain', ui: 'ui.click' };

let dialog = null;
let settings = null;
let openHandler = () => {};
let qualityChosen = false;

function persist() {
  if (!saveSettings(settings)) dialog.querySelector('.ui-alert--warn').hidden = false;
}

function render() {
  const muted = dialog.querySelector('[role=switch]');
  muted.setAttribute('aria-checked', String(settings.muted));
  for (const [bus] of SLIDERS) {
    const input = dialog.querySelector(`input[data-bus="${bus}"]`);
    input.value = Math.round(settings[bus] * 100);
    input.nextElementSibling.value = `${input.value}%`;
    if (bus === 'music' || bus === 'ambience') input.closest('.ui-row').hidden = !hasContent(bus);
  }
  for (const tab of dialog.querySelectorAll('[data-quality]')) tab.setAttribute('aria-pressed', String(tab.dataset.quality === getQuality()));
  dialog.querySelector('#game-settings-quality').textContent = QUALITY.find(([id]) => id === getQuality())[2];
  const saved = readProgress();
  dialog.querySelector('[data-reset]').hidden = !(saved.introCompleted || saved.farm);
  dialog.querySelector('[data-reset-confirm]').hidden = true;
  dialog.querySelector('[data-reset-ask]').hidden = false;
}

export function mountSettings({ onOpen } = {}) {
  if (onOpen) openHandler = onOpen;
  if (dialog) return;
  settings = readSettings();
  for (const [bus] of SLIDERS) setVolume(bus, settings[bus]);
  setMuted(settings.muted);
  setQuality(settings.quality);

  dialog = document.createElement('dialog');
  dialog.id = 'game-settings';
  dialog.className = 'ui-modal ui-modal--sm';
  dialog.setAttribute('aria-labelledby', 'game-settings-title');
  dialog.innerHTML = `
    <div class="ui-modal__window">
      <header class="ui-modal__head"><h2 class="ui-modal__title" id="game-settings-title">Cài đặt</h2></header>
      <button type="button" class="ui-close" aria-label="Đóng">×</button>
      <div class="ui-modal__body">
        <p class="ui-alert ui-alert--warn" hidden>Chưa lưu được cài đặt</p>
        <h3>🔊 Âm thanh</h3>
        <div class="ui-row"><span id="game-settings-muted">Tắt tiếng</span><button type="button" class="ui-switch" role="switch" aria-labelledby="game-settings-muted"></button></div>
        ${SLIDERS.map(([bus, label]) => `<label class="ui-row"><span>${label}</span><input type="range" class="ui-slider" min="0" max="100" step="1" data-bus="${bus}"><output></output></label>`).join('')}
        <h3>🖼️ Đồ họa</h3>
        <div class="ui-tabs ui-tabs--segmented" role="group" aria-label="Chất lượng đồ họa">
          ${QUALITY.map(([id, label]) => `<button type="button" class="ui-tab" data-quality="${id}">${label}</button>`).join('')}
        </div>
        <p class="ui-modal__subtitle" id="game-settings-quality"></p>
        <section data-reset hidden>
          <h3>🔄 Tiến trình</h3>
          <button type="button" class="ui-btn ui-btn--plain" data-reset-ask>Chơi lại từ màn chọn nhân vật</button>
          <div class="ui-alert ui-alert--bad" data-reset-confirm hidden>
            <p>Xoá toàn bộ tiến trình (xu, nông trại, quán) và bắt đầu lại từ màn chọn nhân vật? Không hoàn tác được. Cài đặt âm thanh và đồ họa được giữ.</p>
            <div class="ui-modal__foot">
              <button type="button" class="ui-btn ui-btn--plain" data-reset-cancel>Huỷ</button>
              <button type="button" class="ui-btn ui-btn--gold" data-reset-go>Xoá và chơi lại</button>
            </div>
          </div>
        </section>
      </div>
    </div>`;
  document.body.append(dialog);

  // Chặn phím lan ra màn chơi; Esc vẫn đóng dialog theo mặc định.
  for (const type of ['keydown', 'keyup']) dialog.addEventListener(type, (event) => event.stopPropagation());
  dialog.querySelector('.ui-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('[role=switch]').addEventListener('click', () => {
    settings.muted = !settings.muted;
    setMuted(settings.muted);
    render();
    persist();
  });
  dialog.addEventListener('input', (event) => {
    const bus = event.target.dataset?.bus;
    if (!bus) return;
    settings[bus] = Number(event.target.value) / 100;
    setVolume(bus, settings[bus]);
    event.target.nextElementSibling.value = `${event.target.value}%`;
  });
  // `change` chỉ bắn khi thả thanh trượt: lúc này mới ghi save.
  dialog.addEventListener('change', (event) => {
    const bus = event.target.dataset?.bus;
    if (!bus) return;
    persist();
    if (PREVIEW[bus]) sfx(PREVIEW[bus]);
  });
  for (const tab of dialog.querySelectorAll('[data-quality]')) {
    tab.addEventListener('click', () => {
      if (getQuality() === tab.dataset.quality) return;
      settings.quality = tab.dataset.quality;
      qualityChosen = true;
      setQuality(settings.quality);
      render();
      persist();
    });
  }
  const confirmBox = dialog.querySelector('[data-reset-confirm]'), askButton = dialog.querySelector('[data-reset-ask]');
  askButton.addEventListener('click', () => { askButton.hidden = true; confirmBox.hidden = false; dialog.querySelector('[data-reset-cancel]').focus(); });
  dialog.querySelector('[data-reset-cancel]').addEventListener('click', () => { confirmBox.hidden = true; askButton.hidden = false; askButton.focus(); });
  dialog.querySelector('[data-reset-go]').addEventListener('click', () => {
    if (!resetProgress()) { const warn = dialog.querySelector('.ui-alert--warn'); warn.textContent = 'Chưa xoá được tiến trình'; warn.hidden = false; return; }
    location.reload();
  });
  document.getElementById('game-settings-toggle')?.addEventListener('click', openSettings);
}

// Called by the frame monitor when the game stays slow; never overrides a level the player picked this session.
export function lowerQuality() {
  if (!settings || qualityChosen) return false;
  const next = { high: 'medium', medium: 'low' }[getQuality()];
  if (!next) return false;
  setQuality(next);
  if (dialog?.open) render();
  // Session only: settings.quality keeps the saved level and persist() never writes this one, so a slow moment cannot permanently lower the player's graphics.
  return true;
}

export function openSettings() {
  if (!dialog) mountSettings();
  if (dialog.open) return;
  render();
  dialog.showModal();
  openHandler();
}

export function isSettingsOpen() {
  return Boolean(dialog?.open);
}
