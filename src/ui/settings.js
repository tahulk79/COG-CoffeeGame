import { applyImport, buildExport, deleteMemory, exportFileName, isReadOnly, parseExport, readProgress, readSettings, resetProgress, saveSettings } from '../state/progress.js';
import { setVolume, setMuted, hasContent, sfx } from '../shared/audio/index.js';
import { getQuality, setQuality } from '../shared/vfx/index.js';
import { getLang, LANGS, t } from '../i18n/index.js';
import { setAnalyticsEnabled } from '../shared/analytics/wire.js';

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
  for (const box of dialog.querySelectorAll('[data-confirm]')) box.hidden = true;
  dialog.querySelector('[data-analytics]').checked = settings.analytics !== false;
  const ro = isReadOnly();
  dialog.querySelector('[data-readonly]').hidden = !ro;
  for (const b of dialog.querySelectorAll('[data-write]')) b.disabled = ro;
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
          <button type="button" class="ui-btn ui-btn--plain" data-write data-reset-ask>${t('settings.reset')}</button>
          <div class="ui-alert ui-alert--bad" data-reset-confirm hidden>
            <p>${t('settings.reset.confirm')}</p>
            <label><input type="checkbox" data-reset-memory> ${t('settings.reset.memory')}</label>
            <div class="ui-modal__foot">
              <button type="button" class="ui-btn ui-btn--plain" data-reset-cancel>${t('common.cancel')}</button>
              <button type="button" class="ui-btn ui-btn--gold" data-reset-go>${t('settings.reset.go')}</button>
            </div>
          </div>
        </section>
        <section>
          <h3>💾 ${t('settings.data')}</h3>
          <p class="ui-modal__subtitle">${t('settings.data.note')}</p>
          <p class="ui-alert ui-alert--warn" data-readonly hidden>${t('settings.data.readonly')}</p>
          <p class="ui-alert ui-alert--warn" data-data-msg hidden></p>
          <label class="ui-row"><span>${t('settings.analytics')}</span><input type="checkbox" data-analytics></label>
          <p class="ui-modal__subtitle">${t('settings.analytics.note')}</p>
          <div class="ui-modal__foot">
            <button type="button" class="ui-btn ui-btn--plain" data-export>${t('settings.data.export')}</button>
            <button type="button" class="ui-btn ui-btn--plain" data-write data-import>${t('settings.data.import')}</button>
            <button type="button" class="ui-btn ui-btn--plain" data-write data-memory-ask>${t('settings.memory.delete')}</button>
          </div>
          <input type="file" accept="application/json,.json" data-import-file hidden>
          <div class="ui-alert ui-alert--bad" data-confirm data-import-confirm hidden>
            <p>${t('settings.data.import.confirm')}</p>
            <div class="ui-modal__foot">
              <button type="button" class="ui-btn ui-btn--plain" data-confirm-cancel>${t('common.cancel')}</button>
              <button type="button" class="ui-btn ui-btn--gold" data-import-go>${t('settings.data.import.go')}</button>
            </div>
          </div>
          <div class="ui-alert ui-alert--bad" data-confirm data-memory-confirm hidden>
            <p>${t('settings.memory.confirm')}</p>
            <div class="ui-modal__foot">
              <button type="button" class="ui-btn ui-btn--plain" data-confirm-cancel>${t('common.cancel')}</button>
              <button type="button" class="ui-btn ui-btn--gold" data-memory-go>${t('settings.memory.go')}</button>
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
  // Ngôn ngữ cố định trong một lần tải trang (docs/design/godbean-gdd.md §13.6): lưu rồi tải lại. Tiến trình đã được lưu sau mỗi thao tác.
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
    if (!resetProgress(dialog.querySelector('[data-reset-memory]').checked)) { const warn = dialog.querySelector('.ui-alert--warn'); warn.textContent = t('settings.reset.failed'); warn.hidden = false; return; }
    location.reload();
  });
  setupData();
  document.getElementById('game-settings-toggle')?.addEventListener('click', openSettings);
}

function dataMsg(key) {
  const msg = dialog.querySelector('[data-data-msg]');
  msg.textContent = key ? t(key) : ''; msg.hidden = !key;
}

function setupData() {
  const q = sel => dialog.querySelector(sel), file = q('[data-import-file]');
  let pending = null;
  q('[data-export]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: exportFileName() });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  q('[data-import]').addEventListener('click', () => { dataMsg(); file.value = ''; file.click(); });
  file.addEventListener('change', async () => {
    pending = file.files[0] ? parseExport(await file.files[0].text()) : null;
    if (!file.files[0]) return;
    if (!pending) return dataMsg('settings.data.invalid');
    dataMsg(); q('[data-import-confirm]').hidden = false; q('[data-import-go]').focus();
  });
  q('[data-import-go]').addEventListener('click', () => {
    if (!applyImport(pending)) { q('[data-import-confirm]').hidden = true; return dataMsg('settings.data.failed'); }
    location.reload();
  });
  q('[data-analytics]').addEventListener('change', e => {
    settings.analytics = e.target.checked;
    setAnalyticsEnabled(settings.analytics); // tắt thì xóa hàng chờ
    persist();
  });
  q('[data-memory-ask]').addEventListener('click', () => { dataMsg(); q('[data-memory-confirm]').hidden = false; q('[data-memory-go]').focus(); });
  q('[data-memory-go]').addEventListener('click', () => {
    q('[data-memory-confirm]').hidden = true;
    dataMsg(deleteMemory() ? 'settings.memory.done' : 'settings.data.failed');
  });
  for (const b of dialog.querySelectorAll('[data-confirm-cancel]')) b.addEventListener('click', () => { b.closest('[data-confirm]').hidden = true; });
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
