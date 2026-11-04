import { readProgress, readSettings, resetProgress, saveSettings } from '../state/progress.js';
import { setVolume, setMuted, hasContent, sfx } from '../shared/audio/index.js';
import { getQuality, setQuality } from '../shared/vfx/index.js';
import { getLang, LANGS, t } from '../i18n/index.js';

const SLIDERS = ['master', 'music', 'ambience', 'sfx', 'ui'].map(bus => [bus, t(`settings.bus.${bus}`)]);
const QUALITY = ['low', 'medium', 'high'].map(id => [id, t(`settings.quality.${id}`), t(`settings.quality.${id}.desc`)]);
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
  for (const tab of dialog.querySelectorAll('[data-lang]')) tab.setAttribute('aria-pressed', String(tab.dataset.lang === getLang()));
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
      <header class="ui-modal__head"><h2 class="ui-modal__title" id="game-settings-title">${t('settings.title')}</h2></header>
      <button type="button" class="ui-close" aria-label="${t('common.close')}">×</button>
      <div class="ui-modal__body">
        <p class="ui-alert ui-alert--warn" hidden>${t('settings.saveFailed')}</p>
        <h3>🌐 ${t('settings.language')}</h3>
        <div class="ui-tabs ui-tabs--segmented" role="group" aria-label="${t('settings.language')}">
          ${LANGS.map(id => `<button type="button" class="ui-tab" data-lang="${id}" lang="${id}">${t(`settings.lang.${id}`)}</button>`).join('')}
        </div>
        <p class="ui-modal__subtitle">${t('settings.language.note')}</p>
        <h3>🔊 ${t('settings.audio')}</h3>
        <div class="ui-row"><span id="game-settings-muted">${t('settings.mute')}</span><button type="button" class="ui-switch" role="switch" aria-labelledby="game-settings-muted"></button></div>
        ${SLIDERS.map(([bus, label]) => `<label class="ui-row"><span>${label}</span><input type="range" class="ui-slider" min="0" max="100" step="1" data-bus="${bus}"><output></output></label>`).join('')}
        <h3>🖼️ ${t('settings.graphics')}</h3>
        <div class="ui-tabs ui-tabs--segmented" role="group" aria-label="${t('settings.graphicsQuality')}">
          ${QUALITY.map(([id, label]) => `<button type="button" class="ui-tab" data-quality="${id}">${label}</button>`).join('')}
        </div>
        <p class="ui-modal__subtitle" id="game-settings-quality"></p>
        <section data-reset hidden>
          <h3>🔄 ${t('settings.progress')}</h3>
          <button type="button" class="ui-btn ui-btn--plain" data-reset-ask>${t('settings.reset')}</button>
          <div class="ui-alert ui-alert--bad" data-reset-confirm hidden>
            <p>${t('settings.reset.confirm')}</p>
            <div class="ui-modal__foot">
              <button type="button" class="ui-btn ui-btn--plain" data-reset-cancel>${t('common.cancel')}</button>
              <button type="button" class="ui-btn ui-btn--gold" data-reset-go>${t('settings.reset.go')}</button>
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
  // Ngôn ngữ cố định trong một lần tải trang (docs/shared/i18n.md): lưu rồi tải lại. Tiến trình đã được lưu sau mỗi thao tác.
  for (const tab of dialog.querySelectorAll('[data-lang]')) {
    tab.addEventListener('click', () => {
      if (tab.dataset.lang === getLang()) return;
      // Chỉ đổi bản trong bộ nhớ khi ghi được, để persist() sau này không lén lưu ngôn ngữ chưa áp dụng.
      if (!saveSettings({ ...settings, lang: tab.dataset.lang })) { const warn = dialog.querySelector('.ui-alert--warn'); warn.textContent = t('settings.saveFailed'); warn.hidden = false; return; }
      settings.lang = tab.dataset.lang;
      location.reload();
    });
  }
  const confirmBox = dialog.querySelector('[data-reset-confirm]'), askButton = dialog.querySelector('[data-reset-ask]');
  askButton.addEventListener('click', () => { askButton.hidden = true; confirmBox.hidden = false; dialog.querySelector('[data-reset-cancel]').focus(); });
  dialog.querySelector('[data-reset-cancel]').addEventListener('click', () => { confirmBox.hidden = true; askButton.hidden = false; askButton.focus(); });
  dialog.querySelector('[data-reset-go]').addEventListener('click', () => {
    if (!resetProgress()) { const warn = dialog.querySelector('.ui-alert--warn'); warn.textContent = t('settings.reset.failed'); warn.hidden = false; return; }
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
