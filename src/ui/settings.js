// Hộp Cài đặt dùng chung cho mọi màn (intro, heaven, farm, café…).
// API công khai: mountSettings, openSettings, closeSettings, isSettingsOpen, lowerQuality.
// Nội dung gọn: Ngôn ngữ (danh sách thả xuống, thêm ngôn ngữ chỉ cần thêm vào LANGS), Tắt tiếng, Đồ họa, Chơi lại từ đầu.
import { readProgress, readSettings, resetProgress, saveSettings } from '../state/progress.js';
import { setVolume, setMuted } from '../shared/audio/index.js';
import { getQuality, resetResolution, setQuality } from '../shared/vfx/index.js';
import { getLang, LANGS, t } from '../i18n/index.js';

const BUSES = ['master', 'music', 'ambience', 'sfx', 'ui'];
const QUALITY = ['low', 'medium', 'high'];
const VOLUMES = [['master', 'settings.vol.master'], ['music', 'settings.vol.music'], ['sfx', 'settings.vol.sfx']];
const volOf = id => { const v = settings[id]; return Number.isFinite(v) ? v : 1; };
function applyVolumes() { for (const [id] of VOLUMES) setVolume(id, volOf(id)); setVolume('ambience', volOf('music')); setVolume('ui', volOf('sfx')); } // one slider drives music + ambience, one drives effects + UI

let dialog = null;
let settings = null;
let openHandler = () => {};
// V3: the app can wipe its own save on restart (settings stay in the v1 key) and say when the reset row is useful.
let resetHandler = null;
let canResetHandler = null;

const $ = sel => dialog.querySelector(sel);

function warn(key) {
  const box = $('[data-warn]');
  box.textContent = t(key);
  box.hidden = false;
}

function persist() {
  if (!saveSettings(settings)) warn('settings.saveFailed');
}

function render() {
  const focusOn = settings.autoFocus !== false;
  $('[data-autofocus]').setAttribute('aria-checked', String(focusOn));
  $('[data-autofocus]').textContent = t(focusOn ? 'settings.on' : 'settings.off');
  for (const b of dialog.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  for (const input of dialog.querySelectorAll('[data-vol]')) { const v = Math.round((settings.muted ? 0 : volOf(input.dataset.vol)) * 100); input.value = String(v); input.parentElement.style.setProperty('--v', `${v}%`); }
  for (const tab of dialog.querySelectorAll('[data-quality]')) tab.setAttribute('aria-pressed', String(tab.dataset.quality === getQuality()));
  $('[data-quality-desc]').textContent = t(`settings.quality.${getQuality()}.desc`); // what the chosen level means (Low runs coolest)
  const saved = readProgress();
  $('[data-reset]').hidden = !(canResetHandler ? canResetHandler() : (saved.introCompleted || saved.farm));
}

function template() {
  return `
    <div class="ui-modal__window">
      <header class="ui-modal__head"><h2 class="ui-modal__title" id="game-settings-title">${t('settings.title')}</h2></header>
      <button type="button" class="ui-close" aria-label="${t('common.close')}">×</button>
      <div class="ui-modal__body">
        <p class="ui-alert ui-alert--warn" data-warn hidden></p>
        <div class="set-panel">
          <div class="set-langs" role="group" aria-label="${t('settings.language')}">
            ${LANGS.map(id => `<button type="button" class="set-lang" lang="${id}" data-lang="${id}">${t(`settings.lang.${id}`)}</button>`).join('')}
          </div>
          ${VOLUMES.map(([id, label]) => `<label class="set-row"><i class="set-ico set-ico--sound" aria-hidden="true"></i><span class="set-vol"><input type="range" min="0" max="100" step="5" data-vol="${id}" aria-label="${t(label)}"><u></u><b>${t(label)}</b></span></label>`).join('')}
          <div class="set-row"><i class="set-ico set-ico--camera" aria-hidden="true"></i><span class="set-name" id="game-settings-autofocus">${t('settings.autoFocus')}</span><button type="button" class="set-toggle" role="switch" data-autofocus aria-labelledby="game-settings-autofocus"></button></div>
          <div class="set-row" role="group" aria-label="${t('settings.graphicsQuality')}"><i class="set-ico set-ico--screen" aria-hidden="true"></i>
            ${QUALITY.map(id => `<button type="button" class="set-q" data-quality="${id}">${t(`settings.quality.${id}`)}</button>`).join('')}
          </div>
          <p class="set-hint" data-quality-desc></p>
        </div>
        <section class="settings-reset" data-reset hidden>
          <h3>🔄 ${t('settings.progress')}</h3>
          <!-- Founder: one tap restarts straight from the first screen (character select), no confirm step. -->
          <button type="button" class="ui-btn ui-btn--plain" data-reset-go>${t('settings.reset')}</button>
        </section>
      </div>
    </div>`;
}

function bind() {
  // Chặn phím lan ra màn chơi; Esc vẫn đóng dialog theo mặc định.
  for (const type of ['keydown', 'keyup']) dialog.addEventListener(type, event => event.stopPropagation());
  $('.ui-close').addEventListener('click', closeSettings);

  $('[data-autofocus]').addEventListener('click', () => {
    settings.autoFocus = settings.autoFocus === false;
    render();
    persist();
    window.dispatchEvent(new CustomEvent('godbean:autofocus', { detail: settings.autoFocus })); // the realm listens
  });
  for (const input of dialog.querySelectorAll('[data-vol]')) {
    input.addEventListener('input', () => {
      if (settings.muted) { settings.muted = false; setMuted(false); }
      settings[input.dataset.vol] = Number(input.value) / 100;
      if (input.dataset.vol === 'music') settings.ambience = settings.music;
      if (input.dataset.vol === 'sfx') settings.ui = settings.sfx;
      applyVolumes();
      render();
    });
    input.addEventListener('change', persist);
  }

  for (const tab of dialog.querySelectorAll('[data-quality]')) {
    tab.addEventListener('click', () => {
      if (getQuality() === tab.dataset.quality) return;
      settings.quality = tab.dataset.quality;
      settings.qualityChosen = true;
      resetResolution(); // before setQuality: its listeners resize the buffer
      setQuality(settings.quality);
      render();
      persist();
    });
  }

  // Ngôn ngữ cố định trong một lần tải trang (docs/design/godbean-gdd.md §13.6): lưu rồi tải lại. Tiến trình đã được lưu sau mỗi thao tác.
  for (const button of dialog.querySelectorAll('[data-lang]')) button.addEventListener('click', () => {
    const lang = button.dataset.lang;
    if (lang === getLang()) return;
    // Chỉ đổi bản trong bộ nhớ khi ghi được, để persist() sau này không lén lưu ngôn ngữ chưa áp dụng.
    if (!saveSettings({ ...settings, lang })) { warn('settings.saveFailed'); return; }
    settings.lang = lang;
    location.reload();
  });

  $('[data-reset-go]').addEventListener('click', () => {
    if (!resetProgress(false)) { warn('settings.reset.failed'); return; } // the coffee notebook is kept
    // V3 save: reset through the app's store (keeps settings, which live in the v1 key).
    try { resetHandler?.(); } catch { warn('settings.reset.failed'); return; }
    location.reload();
  });
}

/** onReset: extra reset step on "restart" (V3 store.reset()); canReset: () => boolean, shows the restart row. */
export function mountSettings({ onOpen, onReset, canReset } = {}) {
  if (onOpen) openHandler = onOpen;
  if (onReset) resetHandler = onReset;
  if (canReset) canResetHandler = canReset;
  if (dialog) return;
  settings = readSettings();
  // Thanh âm lượng đã bỏ khỏi giao diện; mức đã lưu (hoặc mặc định) vẫn được áp.
  for (const bus of BUSES) setVolume(bus, settings[bus]);
  setMuted(settings.muted);
  applyVolumes();
  setQuality(settings.quality);

  dialog = document.createElement('dialog');
  dialog.id = 'game-settings';
  dialog.className = 'ui-modal ui-modal--sm';
  dialog.setAttribute('aria-labelledby', 'game-settings-title');
  dialog.innerHTML = template();
  document.body.append(dialog);
  bind();
  document.getElementById('game-settings-toggle')?.addEventListener('click', openSettings);
}

/** False once the player has picked a level: the frame monitor then changes neither the tier nor the resolution. */
export const autoQualityAllowed = () => !!settings && !settings.qualityChosen;

// Called by the frame monitor when the game stays slow.
export function lowerQuality() {
  if (!autoQualityAllowed()) return false;
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
  $('[data-warn]').hidden = true;
  render();
  dialog.showModal();
  openHandler();
}

export function closeSettings() {
  if (dialog?.open) dialog.close();
}

export function isSettingsOpen() {
  return Boolean(dialog?.open);
}
