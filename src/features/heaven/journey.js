import { EXPERTS, GIFTS } from './content.js';
import { t } from '../../i18n/index.js';

// Same wording as the heaven result box; the farm re-ask reuses it.
export function answerText(question, correct) {
  const rightAnswer = question.options.find(option => option.id === question.correct).text;
  return correct ? question.explanation : t('heaven.answer.wrong', { wrong: question.wrong, right: rightAnswer, explanation: question.explanation });
}

// Question ids answered correctly in a saved heaven record (any format); missing/corrupt → [].
export function correctQuestionIds(heaven) {
  return Object.values(normalizeAnswers(heaven)).flat().filter(record => record.correct).map(record => record.questionId);
}

// Question ids answered at all (right or wrong) in a saved heaven record: the farm treats them as met (F-45 `farm.lessons.met`).
export function answeredQuestionIds(heaven) {
  return Object.values(normalizeAnswers(heaven)).flat().map(record => record.questionId);
}

function normalizeAnswers(saved) {
  const source = saved && typeof saved === 'object' ? saved : {};
  return Object.fromEntries(EXPERTS.map(expert => {
    const records = [];
    if (source.version === 2) {
      for (const question of expert.questions) {
        const record = source.answers?.[expert.id]?.[records.length];
        if (!record || record.questionId !== question.id || !question.options.some(option => option.id === record.optionId)) break;
        records.push({ questionId: question.id, optionId: record.optionId, correct: record.optionId === question.correct });
      }
    } else {
      // The previous format only persisted correct answers. Preserve those results.
      const count = Number.isInteger(source.passed?.[expert.id]) ? Math.max(0, Math.min(source.passed[expert.id], expert.questions.length)) : 0;
      for (const question of expert.questions.slice(0, count)) records.push({ questionId: question.id, optionId: question.correct, correct: true });
    }
    return [expert.id, records];
  }));
}

// 02-mini (05/11/2026, F-44): không còn hỏi 6 câu ở thiên đàng. Pha: welcome (hộp 1–4) → gift (hộp 5, nút Nhận) → return (đi vào cổng) → completed.
// `answers` của save cũ giữ nguyên (mẹo đã nhận; câu chưa trả lời để Hội đồng ở trần gian hỏi). Save dở ở mọi pha cũ chạy lại mini.
export function createJourney(saved, onSave) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const answers = normalizeAnswers(source);
  const revealed = source.revealed === true;
  const gift = revealed && GIFTS.some(item => item.id === source.gift) ? source.gift : null;
  const completed = Boolean(gift && source.completed === true);
  let progress = {
    // Save đã xong mà thiếu `mode` là bản thiên đàng đầy đủ cũ.
    version: 2, mode: completed && source.mode !== 'mini' ? 'full' : 'mini',
    metReaper: source.metReaper === true || revealed || Object.values(answers).some(records => records.length > 0),
    answers, skipped: source.skipped === true, revealed, gift, completed,
  };
  const counts = correctOnly => Object.fromEntries(EXPERTS.map(expert => [expert.id, progress.answers[expert.id].filter(record => !correctOnly || record.correct).length]));
  const snapshot = () => ({
    ...progress,
    answers: Object.fromEntries(EXPERTS.map(expert => [expert.id, progress.answers[expert.id].map(record => ({ ...record }))])),
    answered: counts(false), passed: counts(true),
  });
  function commit() { onSave(snapshot()); }
  function phase() {
    if (!progress.revealed) return 'welcome';
    if (!progress.gift) return 'gift';
    return progress.completed ? 'completed' : 'return';
  }
  return {
    get progress() { return snapshot(); },
    get phase() { return phase(); },
    get score() {
      const records = Object.values(progress.answers).flat();
      const correct = records.filter(record => record.correct).length;
      return { correct, wrong: records.length - correct, answered: records.length, total: EXPERTS.reduce((sum, expert) => sum + expert.questions.length, 0) };
    },
    // Nghe xong hộp tiết lộ: tải lại thì chỉ còn hộp quà.
    reveal() {
      if (phase() !== 'welcome') return false;
      progress.metReaper = true; progress.revealed = true; commit(); return true;
    },
    // Bỏ qua ↗ (1 lần bấm) trước khi nghe hết thoại; game.js lấy quà rồi cho đi vào cổng.
    skip() {
      if (phase() !== 'welcome') return false;
      progress.skipped = true; progress.metReaper = true; progress.revealed = true; commit(); return true;
    },
    chooseGift(id) {
      if (phase() !== 'gift' || !GIFTS.some(item => item.id === id)) return false;
      progress.gift = id; commit(); return true;
    },
    returnHome() {
      if (phase() !== 'return') return false;
      progress.completed = true; progress.mode = 'mini'; commit(); return true;
    },
    // Chơi lại chương: đặt lại phần thiên đàng, giữ câu đã trả lời (farm đã lưu mẹo; quà không áp lại nhờ giftApplied).
    reset() {
      progress = { version: 2, mode: 'mini', metReaper: false, answers: progress.answers, skipped: false, revealed: false, gift: null, completed: false };
      commit();
    },
  };
}
