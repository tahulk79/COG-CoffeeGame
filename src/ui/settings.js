// Hộp Cài đặt dùng chung cho mọi màn (intro, heaven, farm, café…).
// API công khai: mountSettings, openSettings, closeSettings, isSettingsOpen, lowerQuality.
// Nội dung gọn: Ngôn ngữ (danh sách thả xuống, thêm ngôn ngữ chỉ cần thêm vào LANGS), Tắt tiếng, Đồ họa, Chơi lại từ đầu.
import { readProgress, readSettings, resetProgress, saveSettings } from '../state/progress.js';
import { setVolume, setMuted } from '../shared/audio/index.js';
import { getQuality, setQuality } from '../shared/vfx/index.js';
import { getLang, LANGS, t } from '../i18n/index.js';

const BUSES = ['master', 'music', 'ambience', 'sfx', 'ui'];
const QUALITY = ['low', 'medium', 'high'];

let dialog = null;
let settings = null;
let openHandler = () => {};
let qualityChosen = false;

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
  $('[role=switch]').setAttribute('aria-checked', String(settings.muted));
  $('[data-lang-select]').value = getLang();
  for (const tab of dialog.querySelectorAll('[data-quality]')) tab.setAttribute('aria-pressed', String(tab.dataset.quality === getQuality()));
  $('[data-quality-desc]').textContent = t(`settings.quality.${getQuality()}.desc`);
  const saved = readProgress();
  $('[data-reset]').hidden = !(saved.introCompleted || saved.farm);
  $('[data-reset-confirm]').hidden = true;
  $('[data-reset-ask]').hidden = false;
}

function template() {
  return `
    <div class="ui-modal__window">
      <header class="ui-modal__head"><h2 class="ui-modal__title" id="game-settings-title">${t('settings.title')}</h2></header>
      <button type="button" class="ui-close" aria-label="${t('common.close')}">×</button>
      <div class="ui-modal__body">
        <p class="ui-alert ui-alert--warn" data-warn hidden></p>
        <h3>🌐 ${t('settings.language')}</h3>
        <label class="ui-row ui-row--select">
          <select class="ui-select" data-lang-select aria-label="${t('settings.language')}">
            ${LANGS.map(id => `<option value="${id}" lang="${id}">${t(`settings.lang.${id}`)}</option>`).join('')}
          </select>
        </label>
        <p class="ui-modal__subtitle">${t('settings.language.note')}</p>
        <h3>🔊 ${t('settings.audio')}</h3>
        <div class="ui-row"><span id="game-settings-muted">${t('settings.mute')}</span><button type="button" class="ui-switch" role="switch" aria-labelledby="game-settings-muted"></button></div>
        <h3>🖼️ ${t('settings.graphics')}</h3>
        <div class="ui-tabs ui-tabs--segmented" role="group" aria-label="${t('settings.graphicsQuality')}">
          ${QUALITY.map(id => `<button type="button" class="ui-tab" data-quality="${id}">${t(`settings.quality.${id}`)}</button>`).join('')}
        </div>
        <p class="ui-modal__subtitle" data-quality-desc></p>
        <section data-reset hidden>
          <h3>🔄 ${t('settings.progress')}</h3>
          <button type="button" class="ui-btn ui-btn--plain" data-reset-ask>${t('settings.reset')}</button>
          <div class="ui-alert ui-alert--bad" data-reset-confirm hidden>
            <p>${t('settings.reset.confirm')}</p>
            <label><input type="checkbox" data-reset-memory> ${t('settings.reset.memory')}</label>
            <div class="ui-modal__foot">
              <button type="button" class="ui-btn ui-btn--plain" data-reset-cancel>${t('common.cancel')}</button>
              <button type="button" class="ui-btn ui-btn--gold" data-reset-go>${t('settings.reset.go')}</button>
            </div>
          </div>
        </section>
      </div>
    </div>`;
}

function bind() {
  // Chặn phím lan ra màn chơi; Esc vẫn đóng dialog theo mặc định.
  for (const type of ['keydown', 'keyup']) dialog.addEventListener(type, event => event.stopPropagation());
  $('.ui-close').addEventListener('click', closeSettings);

  $('[role=switch]').addEventListener('click', () => {
    settings.muted = !settings.muted;
    setMuted(settings.muted);
    render();
    persist();
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

  // Ngôn ngữ cố định trong một lần tải trang (docs/design/godbean-gdd.md §13.6): lưu rồi tải lại. Tiến trình đã được lưu sau mỗi thao tác.
  $('[data-lang-select]').addEventListener('change', event => {
    const lang = event.target.value;
    if (lang === getLang()) return;
    // Chỉ đổi bản trong bộ nhớ khi ghi được, để persist() sau này không lén lưu ngôn ngữ chưa áp dụng.
    if (!saveSettings({ ...settings, lang })) { event.target.value = getLang(); warn('settings.saveFailed'); return; }
    settings.lang = lang;
    location.reload();
  });

  const ask = $('[data-reset-ask]'), confirmBox = $('[data-reset-confirm]');
  ask.addEventListener('click', () => { ask.hidden = true; confirmBox.hidden = false; $('[data-reset-cancel]').focus(); });
  $('[data-reset-cancel]').addEventListener('click', () => { confirmBox.hidden = true; ask.hidden = false; ask.focus(); });
  $('[data-reset-go]').addEventListener('click', () => {
    if (!resetProgress($('[data-reset-memory]').checked)) { warn('settings.reset.failed'); return; }
    location.reload();
  });
}

export function mountSettings({ onOpen } = {}) {
  if (onOpen) openHandler = onOpen;
  if (dialog) return;
  settings = readSettings();
  // Thanh âm lượng đã bỏ khỏi giao diện; mức đã lưu (hoặc mặc định) vẫn được áp.
  for (const bus of BUSES) setVolume(bus, settings[bus]);
  setMuted(settings.muted);
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
