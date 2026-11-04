import { EXPERTS, GIFTS } from './content.js';

// Same wording as the heaven result box; the farm re-ask reuses it.
export function answerText(question, correct) {
  const rightAnswer = question.options.find(option => option.id === question.correct).text;
  return correct ? question.explanation : `${question.wrong} Đáp án đúng: ${rightAnswer} ${question.explanation}`;
}

// Question ids answered correctly in a saved heaven record (any format); missing/corrupt → [].
export function correctQuestionIds(heaven) {
  return Object.values(normalizeAnswers(heaven)).flat().filter(record => record.correct).map(record => record.questionId);
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

export function createJourney(saved, onSave) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const answers = normalizeAnswers(source);
  const allAnswered = EXPERTS.every(expert => answers[expert.id].length === expert.questions.length);
  const revealed = allAnswered && source.revealed === true;
  const gift = revealed && GIFTS.some(item => item.id === source.gift) ? source.gift : null;
  let progress = {
    version: 2, metReaper: source.metReaper === true || Object.values(answers).some(records => records.length > 0),
    answers, revealed, gift, completed: Boolean(gift && source.completed === true),
  };
  const counts = correctOnly => Object.fromEntries(EXPERTS.map(expert => [expert.id, progress.answers[expert.id].filter(record => !correctOnly || record.correct).length]));
  const snapshot = () => ({
    ...progress,
    answers: Object.fromEntries(EXPERTS.map(expert => [expert.id, progress.answers[expert.id].map(record => ({ ...record }))])),
    answered: counts(false), passed: counts(true),
  });
  function commit() { onSave(snapshot()); }
  const seals = () => EXPERTS.filter(expert => progress.answers[expert.id].length === expert.questions.length);
  function phase() {
    if (!progress.metReaper) return 'welcome';
    if (seals().length < EXPERTS.length) return 'learning';
    if (!progress.revealed) return 'review';
    if (!progress.gift) return 'gift';
    return progress.completed ? 'completed' : 'return';
  }
  return {
    get progress() { return snapshot(); },
    get seals() { return seals(); },
    get phase() { return phase(); },
    get score() {
      const records = Object.values(progress.answers).flat();
      const correct = records.filter(record => record.correct).length;
      return { correct, wrong: records.length - correct, answered: records.length, total: EXPERTS.reduce((sum, expert) => sum + expert.questions.length, 0) };
    },
    meetReaper() {
      if (progress.metReaper) return;
      progress.metReaper = true; commit();
    },
    question(id) {
      const expert = EXPERTS.find(item => item.id === id);
      return expert?.questions[progress.answers[id]?.length ?? 0] ?? null;
    },
    answer(id, questionId, optionId) {
      if (phase() !== 'learning') return null;
      const question = this.question(id);
      if (!question || question.id !== questionId || !question.options.some(option => option.id === optionId)) return null;
      const correct = optionId === question.correct;
      progress.answers[id].push({ questionId, optionId, correct });
      commit();
      return { correct, text: answerText(question, correct) };
    },
    reveal() {
      if (phase() !== 'review') return;
      progress.revealed = true; commit();
    },
    chooseGift(id) {
      if (phase() !== 'gift' || !GIFTS.some(item => item.id === id)) return false;
      progress.gift = id; commit(); return true;
    },
    returnHome() {
      if (phase() !== 'return') return false;
      progress.completed = true; commit(); return true;
    },
    reset() {
      progress = { version: 2, metReaper: false, answers: Object.fromEntries(EXPERTS.map(expert => [expert.id, []])), revealed: false, gift: null, completed: false };
      commit();
    },
  };
}
