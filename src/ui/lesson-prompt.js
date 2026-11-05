import { EXPERTS } from '../features/heaven/content.js';
import { setAvatar, showDialogue, usesTouch } from './dialogue.js';
import { sfx } from '../shared/audio/index.js';
import { t } from '../i18n/index.js';

const $ = id => document.getElementById(id);

/** Chuyên gia + câu gốc theo questionId (nguồn duy nhất: heaven/content.js); null nếu không có. */
export function findLesson(questionId) {
  for (const expert of EXPERTS) {
    const question = expert.questions.find(item => item.id === questionId);
    if (question) return { expert, question };
  }
  return null;
}

/**
 * Hỏi lại một câu thiên đàng trong khung hội thoại đáy màn hình (#caption-box). Khóa/mở nhập liệu là việc của nơi gọi.
 * Cách gọi: lockInput(); askLesson({ ...findLesson('ripe'), onAnswer: optionId => farm.act('lessons', 'answer', { questionId: 'ripe', optionId }), onClose: unlockInput });
 * onAnswer(optionId) trả { correct, explanation, perk? } (perk: chuỗi hoặc { name, effect }; thiếu thì lấy question.perk); trả null/undefined thì đóng ngay.
 * onClose(answered) gọi đúng một lần khi khung đóng: sau khi xem kết quả (answered = true), hoặc "Để sau"/Esc (không gọi onAnswer, không ghi gì).
 * council: chuỗi '1/2' khi hỏi ở Hội đồng (F-45): nhãn HỘI ĐỒNG, nút "Đóng" thay "Để sau", lớp council-dialogue (Auto không bấm hộ).
 * Trả về hàm đóng ngay (gọi khi rời màn).
 */
export function askLesson({ expert, question, onAnswer, onClose, council = null }) {
  const box = $('caption-box'), list = $('dialogue-choices'), next = $('dialogue-next'), tip = $('dialogue-tip');
  const hint = box.querySelector('.dialogue-hint');
  const abort = new AbortController();
  const restoreFocus = document.activeElement;
  let phase = 'question', answered = false;

  showDialogue([0, expert.name, question.text], { name: expert.name });
  setAvatar(expert.icon);
  box.dataset.mode = 'manual';
  box.classList.add('quiz-dialogue', 'lesson-dialogue');
  box.classList.toggle('council-dialogue', Boolean(council));
  box.querySelector('.dialogue-auto').textContent = council ? t('ui.council.label', { n: council }) : t('ui.lesson.review');
  hint.textContent = usesTouch() ? t('ui.lesson.pick') : council ? t('ui.council.pickKeys') : t('ui.lesson.pickKeys');
  next.hidden = true;
  list.replaceChildren(); list.hidden = false;
  question.options.forEach((option, index) => {
    const button = document.createElement('button'); button.type = 'button';
    const key = document.createElement('span'); key.className = 'choice-key'; key.textContent = String(index + 1);
    const text = document.createElement('span'); text.textContent = option.text;
    button.append(key, text); button.addEventListener('click', () => answer(option.id));
    list.append(button);
  });
  const later = document.createElement('button'); later.type = 'button'; later.className = 'dialogue-later'; later.textContent = council ? t('ui.council.close') : t('ui.lesson.later');
  later.addEventListener('click', close);
  list.append(later);
  box.scrollTop = 0;
  // Không focus đáp án: Enter vừa dùng để qua hội thoại trước không được chọn luôn đáp án 1.
  box.tabIndex = -1; box.focus({ preventScroll: true });

  addEventListener('keydown', event => {
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const enter = ['Enter', 'Space', 'KeyE'].includes(event.code) && !event.target.closest?.('button');
    if (phase === 'question' && enter || event.repeat) { if (enter) { event.preventDefault(); event.stopPropagation(); } return; }
    const option = phase === 'question' && question.options[Number(event.key) - 1];
    const done = event.code === 'Escape' || phase === 'result' && enter;
    if (!option && !done) return;
    event.preventDefault(); event.stopPropagation();
    if (option) answer(option.id); else close();
  }, { capture: true, signal: abort.signal });

  function answer(optionId) {
    if (phase !== 'question') return;
    const result = onAnswer(optionId);
    if (!result) { close(); return; }
    answered = true;
    sfx(result.correct ? 'bench.good' : 'bench.bad');
    phase = 'result';
    list.replaceChildren(); list.hidden = true;
    box.classList.remove('quiz-dialogue');
    box.querySelector('.dialogue-auto').textContent = result.correct ? t('ui.lesson.correct') : t('ui.lesson.wrong');
    $('caption').textContent = result.explanation;
    const perk = result.perk ?? question.perk;
    const label = typeof perk === 'string' ? perk : perk ? `${perk.name} · ${perk.effect}` : '';
    tip.textContent = result.correct ? t('ui.lesson.newTip', { label }) : t('ui.lesson.noTip');
    tip.hidden = result.correct && !label;
    tip.dataset.tone = result.correct ? 'good' : '';
    hint.textContent = usesTouch() ? t('ui.lesson.tapClose') : t('ui.lesson.pressClose');
    next.hidden = false; next.setAttribute('aria-label', t('common.close')); next.title = t('common.close');
    box.scrollTop = 0;
    next.focus({ preventScroll: true });
    // Thêm sau lượt click hiện tại nên chính cú chọn đáp án không đóng khung.
    document.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); close(); }, { capture: true, signal: abort.signal });
  }

  function close() {
    if (phase === 'closed') return;
    phase = 'closed'; abort.abort();
    list.replaceChildren(); list.hidden = true; tip.hidden = true;
    box.hidden = true; box.classList.remove('quiz-dialogue', 'lesson-dialogue', 'council-dialogue'); delete box.dataset.mode;
    next.hidden = false; next.setAttribute('aria-label', t('ui.dialogue.next')); next.title = t('ui.dialogue.next');
    if (restoreFocus?.isConnected && !restoreFocus.closest('[hidden]')) restoreFocus.focus({ preventScroll: true });
    else $('game')?.focus({ preventScroll: true });
    onClose?.(answered);
  }
  return close;
}

/**
 * Một lượt gặp Hội đồng (F-45, đề xuất Q1 R8–R9): 1 chuyên gia, hỏi lần lượt các câu chưa gặp trong cùng khung đáy màn.
 * answer(questionId, optionId) → kết quả như onAnswer của askLesson (thường là farm.act('lessons','council',…)).
 * Đóng giữa chừng giữ các câu đã trả lời, không gọi defer. onDone() gọi đúng một lần. Trả về hàm đóng ngay.
 */
export function askCouncil({ expert, questions, answer, onDone }) {
  let index = 0, close = null, finished = false, aborted = false;
  const finish = () => { if (finished) return; finished = true; close = null; onDone?.(); };
  const next = () => {
    if (index >= questions.length) { finish(); return; }
    const question = questions[index];
    close = askLesson({ expert, question, council: `${index + 1}/${questions.length}`, onAnswer: optionId => answer(question.id, optionId),
      onClose: answered => { close = null; if (answered && !aborted) { index++; next(); } else finish(); } });
  };
  next();
  return () => { aborted = true; close?.(); finish(); };
}
