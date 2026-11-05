import { NPCS } from './content.js';
import { t } from '../../i18n/index.js';
import { setAvatar, showDialogue } from '../../ui/dialogue.js';
import { mountJoystick } from '../../ui/joystick.js';

const $ = id => document.getElementById(id);

export function createHeavenUI(profile, callbacks) {
  const abort = new AbortController();
  const { signal } = abort;
  let restoreFocus = null;
  let toastUntil = 0;
  let promptId = null;
  let choicePulse = null;
  let openedAt = 0;
  $('heaven-hud').hidden = false;
  $('heaven-controls').hidden = false;
  // 02-mini (05/11/2026, F-44): không gợi ý joystick, không hồ sơ/huy hiệu; Bỏ qua ↗ chỉ 1 lần bấm.
  $('heaven-interact').addEventListener('click', callbacks.interact, { signal });
  $('heaven-replay').addEventListener('click', callbacks.replay, { signal });
  $('heaven-skip').addEventListener('click', callbacks.skip, { signal });
  $('heaven-quest').addEventListener('click', callbacks.questGo, { signal });
  $('heaven-quest').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callbacks.questGo(); } }, { signal });
  const resetJoystick = mountJoystick($('heaven-joystick'), $('heaven-joystick-knob'), callbacks.touch, signal);
  document.addEventListener('click', callbacks.anyClick, { capture: true, signal });
  function clearChoices() { $('dialogue-choices').replaceChildren(); $('dialogue-choices').hidden = true; }
  function choices(options, onSelect) {
    clearChoices(); $('dialogue-choices').hidden = false;
    options.forEach((option, index) => {
      const button = document.createElement('button'); button.type = 'button';
      const number = document.createElement('span'); number.className = 'choice-key'; number.textContent = String(index + 1);
      const text = document.createElement('span'); text.textContent = option.text;
      if (option.default) button.dataset.default = '';
      button.append(number, text); button.addEventListener('click', () => onSelect(option.id));
      // Enter giữ/vừa dùng để qua câu trước không được bấm luôn lựa chọn mặc định.
      button.addEventListener('keydown', event => {
        if (['Enter', 'Space'].includes(event.code) && (event.repeat || performance.now() - openedAt < 300)) event.preventDefault();
      });
      $('dialogue-choices').append(button);
    });
  }
  function dialogue(speaker, line, options = {}) {
    choicePulse?.cancel();
    if ($('caption-box').hidden) restoreFocus = document.activeElement;
    showDialogue([0, speaker, line], profile);
    $('caption-box').dataset.mode = 'manual';
    $('caption-box').classList.toggle('quiz-dialogue', Boolean(options.choices));
    document.querySelector('.dialogue-auto').textContent = options.tag || t('heaven.dialogue.tag');
    if (options.hint) document.querySelector('.dialogue-hint').textContent = options.hint; // còn lại: showDialogue đặt theo thiết bị
    $('dialogue-tip').hidden = !options.tip;
    $('dialogue-tip').textContent = options.tip || '';
    $('dialogue-tip').dataset.tone = options.tipGood ? 'good' : '';
    if (options.icon) setAvatar(options.icon);
    $('dialogue-next').hidden = Boolean(options.choices);
    $('dialogue-next').textContent = '▾';
    $('dialogue-next').title = options.nextLabel || t('heaven.dialogue.next');
    $('dialogue-next').setAttribute('aria-label', options.nextLabel || t('heaven.dialogue.next'));
    $('dialogue-next').disabled = false;
    $('heaven-stamp').hidden = !options.stamp;
    $('heaven-stamp').textContent = options.stamp || '';
    $('heaven-controls').hidden = true;
    promptId = null;
    if (options.choices) choices(options.choices, options.onSelect);
    else clearChoices();
    $('caption-box').querySelector('.dialogue-body').scrollTop = 0;
    openedAt = performance.now();
    // Lựa chọn có `default` (nút Nhận) nhận tiêu điểm; Enter vừa dùng để qua câu trước bị chặn 300 ms ở choices().
    const focus = options.choices ? $('dialogue-choices').querySelector('button[data-default]') || $('caption-box') : $('dialogue-next');
    if (focus.id === 'caption-box') focus.tabIndex = -1;
    focus.focus({ preventScroll: true });
  }
  function closeDialogue() {
    choicePulse?.cancel();
    $('caption-box').hidden = true; $('caption-box').classList.remove('quiz-dialogue');
    delete $('caption-box').dataset.mode;
    clearChoices(); $('heaven-stamp').hidden = true;
    $('dialogue-next').hidden = false;
    $('heaven-controls').hidden = false;
    if (restoreFocus?.isConnected && !restoreFocus.closest('[hidden]')) restoreFocus.focus({ preventScroll: true });
    else $('game').focus({ preventScroll: true });
    restoreFocus = null;
  }
  // Thẻ nhiệm vụ gọn; trả id NPC đích cho mũi chỉ.
  function hud(journey, walking) {
    const phase = journey.phase;
    const [key, target] = phase === 'welcome' ? ['welcome', null] : phase === 'gift' ? ['gift', 'clerk'] : phase === 'return' ? ['return', 'portal'] : ['completed', null];
    $('heaven-objective').textContent = t(`heaven.hud.${key}.title`);
    $('heaven-objective-detail').textContent = t(walking ? 'heaven.hud.walk.detail' : `heaven.hud.${key}.detail`);
    return target;
  }
  function prompt(npc, blocked) {
    const id = blocked ? null : npc?.id ?? null;
    $('heaven-interact').hidden = !id;
    if (id === promptId) return;
    promptId = id;
    if (id) {
      $('heaven-interact-name').textContent = npc.id === 'portal' ? NPCS.find(item => item.id === 'portal').name : npc.name;
      $('heaven-interact').setAttribute('aria-label', t(npc.id === 'portal' ? 'heaven.prompt.interact' : 'heaven.prompt.talk', { name: npc.name }));
    }
  }
  return {
    dialogue, closeDialogue, hud, prompt,
    controls(visible) { $('heaven-controls').hidden = !visible; },
    skipVisible(visible) { $('heaven-skip').hidden = !visible; },
    toast(text) { $('heaven-toast').textContent = text; $('heaven-toast').hidden = false; toastUntil = performance.now() + 4500; },
    update() {
      if (toastUntil && performance.now() > toastUntil) { $('heaven-toast').hidden = true; toastUntil = 0; }
    },
    clearTouch: resetJoystick,
    pulseChoices() {
      choicePulse?.cancel();
      choicePulse = $('caption-box').animate([
        { outline: '0px solid #c6a55d00', outlineOffset: '0px' },
        { outline: '3px solid #c6a55dbb', outlineOffset: '3px', offset: .4 },
        { outline: '0px solid #c6a55d00', outlineOffset: '5px' },
      ], { duration: 420 });
    },
    complete(gift, score) {
      closeDialogue(); $('heaven-controls').hidden = true;
      $('heaven-return-fade').hidden = true;
      $('heaven-ending').hidden = false;
      // 02-mini: không hỏi câu nào ở thiên đàng thì ẩn dòng điểm (save cũ đã trả lời vẫn thấy điểm).
      $('heaven-final-score').textContent = score.answered ? t('heaven.ending.score', score) : '';
      $('heaven-final-score').hidden = !score.answered;
      $('heaven-gift-summary').textContent = `${gift.icon} ${gift.name} — ${gift.description}`;
      $('heaven-replay').focus({ preventScroll: true });
    },
    hideEnding() { $('heaven-ending').hidden = true; },
    departure(opacity) {
      $('caption-box').hidden = true; $('heaven-controls').hidden = true;
      $('heaven-return-fade').hidden = false; $('heaven-return-fade').style.opacity = String(opacity);
    },
    dispose() {
      choicePulse?.cancel();
      resetJoystick(); abort.abort(); clearChoices(); $('caption-box').hidden = true; $('dialogue-tip').hidden = true;
      $('heaven-hud').hidden = true; $('heaven-controls').hidden = true; $('heaven-skip').hidden = true; $('heaven-ending').hidden = true; $('heaven-toast').hidden = true;
      $('dialogue-next').hidden = false; $('caption-box').classList.remove('quiz-dialogue'); delete $('caption-box').dataset.mode;
      $('heaven-return-fade').hidden = true;
    },
  };
}
