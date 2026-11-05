// Hội đồng so le (05/11/2026, F-45, docs/shared/mobile-first-proposal.md Q1 R5–R15 + vá): mốc có mặt, lượt gặp, save cũ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { WORK_DAY_MS } from '../src/features/farm/rules.js';
import { answeredQuestionIds } from '../src/features/heaven/journey.js';

const AT = 100000;
const fresh = (region) => createFarm(null, 'capital', () => {}, AT, [], region);
// Save đã xong farm-intro và đã hái 1 lần (mốc Thần Nông).
const harvested = () => { const s = fresh().progress; s.tutorial.seen.push('farm-intro'); s.stats.harvested = 1; return createFarm(s, null, () => {}, AT); };
const record = farm => { const log = []; farm.onEvent((type, props) => log.push([type, props])); return log; };

test('save mới: chưa gặp câu nào, không hỏi lại câu chưa gặp, Hội đồng trống', () => {
  const farm = fresh();
  assert.deepEqual(farm.progress.lessons.met, []); assert.deepEqual(farm.progress.lessons.arrived, []);
  assert.equal(farm.pendingLesson(), null); assert.equal(farm.pendingLesson(['ripe', 'water', 'recipe', 'costs', 'customer']), null);
  assert.equal(farm.council, null);
  assert.equal(farm.act('lessons', 'answer', { questionId: 'ripe', optionId: 'ripe' }, AT).ok, false);
  assert.equal(farm.act('lessons', 'council', { questionId: 'ripe', optionId: 'ripe' }, AT).ok, false); // Thần Nông chưa có mặt
});

test('Thần Nông có mặt sau farm-intro + lần hái đầu; chưa xong farm-intro thì chưa', () => {
  const s = fresh().progress; s.stats.harvested = 3;
  assert.equal(createFarm(s, null, () => {}, AT).council, null);
  const farm = harvested(), c = farm.council;
  assert.equal(c.expert.id, 'growing'); assert.deepEqual(c.questions.map(q => q.id), ['ripe', 'water']);
});

test('lượt Hội đồng không đụng askedDay/askedCount; đúng cấp mẹo, sai vào hỏi lại hiện hành', () => {
  const farm = harvested(), log = record(farm), L0 = farm.progress.lessons;
  const right = farm.act('lessons', 'council', { questionId: 'ripe', optionId: 'ripe' }, AT);
  assert.equal(right.ok, true); assert.equal(right.correct, true);
  const wrong = farm.act('lessons', 'council', { questionId: 'water', optionId: 'more' }, AT);
  assert.equal(wrong.ok, true); assert.equal(wrong.correct, false);
  const L = farm.progress.lessons;
  assert.deepEqual(L.met, ['ripe', 'water']); assert.ok(L.learned.includes('ripe')); assert.ok(L.granted.includes('ripe'));
  assert.equal(L.askedDay, L0.askedDay); assert.equal(L.askedCount, L0.askedCount);
  assert.equal(typeof L.asked.water, 'number');
  assert.equal(farm.council, null); // gặp xong: không chuyên gia nào chờ
  assert.equal(farm.act('lessons', 'council', { questionId: 'water', optionId: 'drain' }, AT).ok, false); // không gặp lại lần hai
  assert.deepEqual(log.filter(e => e[0] === 'council_answered').map(e => e[1]), [
    { expert: 'growing', questionId: 'ripe', correct: true }, { expert: 'growing', questionId: 'water', correct: false },
  ]);
  assert.equal(farm.pendingLesson(['water']), null); // sai hôm nay: chưa hỏi lại
  farm.tick(AT + WORK_DAY_MS + 1000);
  assert.equal(farm.pendingLesson(['water'])?.question.id, 'water'); // ngày công sau: hỏi lại như cũ
});

test('nơi chỉ quán: ly đầu → Nông rồi Pha Chế xếp hàng, mỗi lượt 1 chuyên gia', () => {
  const farm = fresh('it');
  assert.ok(farm.act('cafe', 'sell', { recipeId: 'phin-den', quality: 100, stars: 3, wait: 0 }, AT).ok);
  assert.deepEqual(farm.progress.lessons.arrived, ['growing', 'brewing']);
  assert.equal(farm.council.expert.id, 'growing');
  for (const [questionId, optionId] of [['ripe', 'ripe'], ['water', 'drain']]) farm.act('lessons', 'council', { questionId, optionId }, AT);
  assert.equal(farm.council.expert.id, 'brewing');
});

test('Thương Hội: ca tập không tính, ca thường đầu tiên mới có mặt', () => {
  const farm = harvested();
  farm.act('cafe', 'sell', { recipeId: 'phin-den', quality: 100, stars: 3, wait: 0 }, AT);
  farm.act('cafe', 'shift', { learning: true, served: 1, goal: 1, avg: 3 }, AT);
  assert.equal(farm.progress.lessons.arrived.includes('business'), false);
  farm.act('cafe', 'shift', { served: 2, goal: 5, avg: 3 }, AT);
  assert.deepEqual(farm.progress.lessons.arrived, ['growing', 'brewing', 'business']);
});

test('nơi chỉ trồng: lần bán đầu → Pha Chế, ngày công kết thúc sau đó → Thương Hội', () => {
  const s = fresh('ke').progress; s.stats.sold = 100;
  const farm = createFarm(s, null, () => {}, AT);
  assert.ok(farm.progress.lessons.arrived.includes('brewing')); assert.equal(farm.progress.lessons.arrived.includes('business'), false);
  farm.tick(AT + WORK_DAY_MS + 1000);
  assert.ok(farm.progress.lessons.arrived.includes('business'));
});

test('save cũ thiếu met/arrived: suy ra từ câu đã trả lời ở thiên đàng và sổ ca', () => {
  const heaven = { version: 2, answers: { growing: [{ questionId: 'ripe', optionId: 'green' }], brewing: [], business: [] } };
  assert.deepEqual(answeredQuestionIds(heaven), ['ripe']);
  const s = fresh().progress; delete s.lessons.met; delete s.lessons.arrived;
  s.cafe.shiftLog = [{ id: 'shift-a', at: AT, cups: 1 }, { id: 'shift-b', at: AT, cups: 2 }];
  const farm = createFarm(s, null, () => {}, AT, [], undefined, answeredQuestionIds(heaven));
  assert.deepEqual(farm.progress.lessons.met, ['ripe']); // sai ở thiên đàng vẫn là đã gặp → vào hỏi lại hiện hành
  assert.ok(farm.progress.lessons.arrived.includes('business'));
  assert.equal(farm.pendingLesson(['ripe', 'water'])?.question.id, 'ripe');
});
