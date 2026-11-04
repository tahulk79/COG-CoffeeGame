import { EXPERTS } from './content.js';
import { setAvatar, showDialogue, usesTouch } from '../../ui/dialogue.js';
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
  // Gợi ý điều khiển khi vào: tắt sau lần di chuyển đầu hoặc 10 s, không lưu.
  let hintUntil = performance.now() + 10000;
  $('heaven-hint').textContent = usesTouch() ? 'Kéo nút tròn để đi · Chạm nhân vật để nói chuyện' : 'Bấm mặt đất để đi · Bấm nhân vật để tới nói chuyện';
  $('heaven-hint').hidden = false;
  function hideHint() { $('heaven-hint').hidden = true; hintUntil = 0; }
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
    document.querySelector('.dialogue-auto').textContent = options.tag || 'HỘI THOẠI';
    if (options.choices) document.querySelector('.dialogue-hint').textContent = 'Chọn một đáp án'; // còn lại: showDialogue đặt theo thiết bị
    $('dialogue-tip').hidden = !options.tip;
    $('dialogue-tip').textContent = options.tip || '';
    $('dialogue-tip').dataset.tone = options.tipGood ? 'good' : '';
    if (options.icon) setAvatar(options.icon);
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
    $('caption-box').querySelector('.dialogue-body').scrollTop = 0;
    openedAt = performance.now();
    // Đáp án không nhận tiêu điểm sẵn (Enter không chọn nhầm); chọn bằng chạm/bấm hoặc phím 1–3. Lựa chọn điều hướng có `default` thì vẫn focus.
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
    dialogue, closeDialogue, hud, prompt, hideHint,
    toast(text) { $('heaven-toast').textContent = text; $('heaven-toast').hidden = false; toastUntil = performance.now() + 4500; },
    update() {
      if (toastUntil && performance.now() > toastUntil) { $('heaven-toast').hidden = true; toastUntil = 0; }
      if (hintUntil && performance.now() > hintUntil) hideHint();
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
      $('heaven-final-score').textContent = `${score.correct}/${score.total} câu đúng · ${score.wrong} câu sai\nMẹo đã nhận ${score.correct}/${score.total} · ${score.total - score.correct} câu sẽ được ôn lại ở nông trại/quán`;
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
      resetJoystick(); abort.abort(); clearChoices(); $('caption-box').hidden = true; hideHint(); $('dialogue-tip').hidden = true;
      $('heaven-hud').hidden = true; $('heaven-controls').hidden = true; $('heaven-ending').hidden = true; $('heaven-toast').hidden = true;
      $('dialogue-next').hidden = false; $('caption-box').classList.remove('quiz-dialogue'); delete $('caption-box').dataset.mode;
      $('heaven-return-fade').hidden = true;
    },
  };
}
