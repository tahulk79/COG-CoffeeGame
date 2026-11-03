import { EXPERTS } from './content.js';
import { showDialogue } from '../../ui/dialogue.js';
import { mountJoystick } from '../../ui/joystick.js';

const $ = id => document.getElementById(id);

export function createHeavenUI(profile, callbacks) {
  const abort = new AbortController();
  const { signal } = abort;
  let restoreFocus = null;
  let toastUntil = 0;
  let promptId = null;
  let choicePulse = null;
  $('heaven-hud').hidden = false;
  $('heaven-controls').hidden = false;
  $('heaven-interact').addEventListener('click', callbacks.interact, { signal });
  $('heaven-passport-toggle').addEventListener('click', () => {
    const open = $('heaven-passport').hidden;
    $('heaven-passport').hidden = !open;
    $('heaven-passport-toggle').setAttribute('aria-expanded', String(open));
  }, { signal });
  document.addEventListener('pointerdown', event => {
    if (event.target.closest('.seal-hud')) return;
    $('heaven-passport').hidden = true;
    $('heaven-passport-toggle').setAttribute('aria-expanded', 'false');
  }, { signal });
  $('heaven-replay').addEventListener('click', callbacks.replay, { signal });
  const resetJoystick = mountJoystick($('heaven-joystick'), $('heaven-joystick-knob'), callbacks.touch, signal);
  document.addEventListener('click', callbacks.anyClick, { capture: true, signal });
  function clearChoices() { $('dialogue-choices').replaceChildren(); $('dialogue-choices').hidden = true; }
  function choices(options, onSelect) {
    clearChoices(); $('dialogue-choices').hidden = false;
    options.forEach((option, index) => {
      const button = document.createElement('button'); button.type = 'button';
      const number = document.createElement('span'); number.className = 'choice-key'; number.textContent = String(index + 1);
      const text = document.createElement('span'); text.textContent = option.text;
      button.append(number, text); button.addEventListener('click', () => onSelect(option.id));
      $('dialogue-choices').append(button);
    });
  }
  function dialogue(speaker, line, options = {}) {
    choicePulse?.cancel();
    if ($('caption-box').hidden) restoreFocus = document.activeElement;
    showDialogue([0, speaker, line], profile);
    $('caption-box').dataset.mode = 'manual';
    $('caption-box').classList.toggle('quiz-dialogue', Boolean(options.choices));
    document.querySelector('.dialogue-auto').textContent = options.tag || 'HỘI THOẠI';
    document.querySelector('.dialogue-hint').textContent = options.choiceHint || (options.choices ? 'Chọn câu trả lời' : 'Bấm bất kỳ đâu để tiếp');
    if (options.icon) $('dialogue-avatar').textContent = options.icon;
    $('dialogue-next').hidden = Boolean(options.choices);
    $('dialogue-next').textContent = '▾';
    $('dialogue-next').title = options.nextLabel || 'Tiếp hội thoại';
    $('dialogue-next').setAttribute('aria-label', options.nextLabel || 'Tiếp hội thoại');
    $('dialogue-next').disabled = false;
    $('heaven-stamp').hidden = !options.stamp;
    $('heaven-stamp').textContent = options.stamp || '';
    $('heaven-controls').hidden = true;
    promptId = null;
    if (options.choices) choices(options.choices, options.onSelect);
    else clearChoices();
    $('caption-box').scrollTop = 0;
    const focus = $('dialogue-choices').querySelector('button') || $('dialogue-next');
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
  function hud(journey) {
    const { phase, progress, seals } = journey;
    let title, detail, target;
    if (phase === 'welcome') {
      title = 'Mình đang ở đâu?'; detail = 'Tới gần Thần Chết và hỏi chuyện.'; target = 'reaper';
    } else if (phase === 'learning') {
      const expert = EXPERTS.find(item => !seals.some(seal => seal.id === item.id));
      title = 'Ba dấu để trở về'; detail = `Gặp ${expert.name} · ${progress.answered[expert.id]}/${expert.questions.length} câu đã trả lời.`; target = expert.id;
    } else if (phase === 'review') {
      title = 'Kiểm tra hồ sơ'; detail = 'Đưa ba dấu cho Thần Tiếp Nhận ở khu bên phải quảng trường.'; target = 'clerk';
    } else if (phase === 'gift') {
      title = 'Một chuyến học thử'; detail = 'Gặp Thần Tiếp Nhận để chọn hành trang mang về.'; target = 'clerk';
    } else if (phase === 'return') {
      title = 'Lên đường trùng sinh'; detail = 'Đi tới Cổng trùng sinh để bắt đầu nông trại.'; target = 'portal';
    } else { title = 'Một khởi đầu mới'; detail = 'Bạn đã trở về trần gian.'; target = null; }
    $('heaven-objective').textContent = title; $('heaven-objective-detail').textContent = detail;
    $('heaven-seal-count').textContent = `${seals.length} / ${EXPERTS.length}`;
    $('heaven-passport-toggle').setAttribute('aria-label', `Hồ sơ: ${seals.length} trên ${EXPERTS.length} dấu chứng nhận. Bấm để xem chi tiết.`);
    $('heaven-seals').replaceChildren();
    for (const expert of EXPERTS) {
      const seal = document.createElement('span');
      seal.className = 'seal-icon'; seal.textContent = expert.icon;
      seal.dataset.earned = String(seals.some(item => item.id === expert.id));
      $('heaven-seals').append(seal);
    }
    const score = journey.score;
    $('heaven-score').textContent = `${score.correct} đúng · ${score.wrong} sai · ${score.answered}/${score.total} câu`;
    $('heaven-passport-list').replaceChildren();
    for (const expert of EXPERTS) {
      const row = document.createElement('li');
      const passed = seals.some(seal => seal.id === expert.id);
      row.dataset.earned = String(passed);
      const icon = document.createElement('span'); icon.textContent = passed ? '✓' : expert.icon;
      const text = document.createElement('span'); text.textContent = `${expert.seal} · ${progress.answered[expert.id]}/${expert.questions.length} đã trả lời · ${progress.passed[expert.id]} đúng`;
      row.append(icon, text); $('heaven-passport-list').append(row);
    }
    return target;
  }
  function prompt(npc, blocked) {
    const id = blocked ? null : npc?.id ?? null;
    $('heaven-interact').hidden = !id;
    if (id === promptId) return;
    promptId = id;
    if (id) {
      $('heaven-interact-name').textContent = npc.id === 'portal' ? 'Cổng trùng sinh' : npc.name;
      $('heaven-interact').setAttribute('aria-label', `${npc.id === 'portal' ? 'Tương tác' : 'Nói chuyện với'} ${npc.name}`);
    }
  }
  return {
    dialogue, closeDialogue, hud, prompt,
    toast(text) { $('heaven-toast').textContent = text; $('heaven-toast').hidden = false; toastUntil = performance.now() + 4500; },
    update() { if (toastUntil && performance.now() > toastUntil) { $('heaven-toast').hidden = true; toastUntil = 0; } },
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
      $('heaven-final-score').textContent = `${score.correct}/${score.total} câu đúng · ${score.wrong} câu sai`;
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
      resetJoystick(); abort.abort(); clearChoices(); $('caption-box').hidden = true;
      $('heaven-hud').hidden = true; $('heaven-controls').hidden = true; $('heaven-ending').hidden = true; $('heaven-toast').hidden = true;
      $('dialogue-next').hidden = false; $('caption-box').classList.remove('quiz-dialogue'); delete $('caption-box').dataset.mode;
      $('heaven-return-fade').hidden = true;
    },
  };
}
