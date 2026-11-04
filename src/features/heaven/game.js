import { createMovementInput } from '../../ui/movement.js';
import { loadPlayer, playerModel } from '../../characters/load-player.js';
import { readProgress, saveHeaven } from '../../state/progress.js';
import { createHeavenScene } from './scene.js';
import { createJourney } from './journey.js';
import { createHeavenUI } from './ui.js';
import { EXPERTS, GIFTS, CLERK, WELCOME, REVEAL, FAREWELL } from './content.js';
import { t } from '../../i18n/index.js';
import { attachModels, dressSlot, loadModel } from '../../shared/three/models.js';
import { sfx } from '../../shared/audio/index.js';

const HEAVEN_MODELS = {
  'heaven/reaper': 'heaven/reaper.glb',
  'heaven/surroundings': 'heaven/surroundings.glb',
  'heaven/growing': 'heaven/growing.glb',
  'heaven/brewing': 'heaven/brewing.glb',
  'heaven/business': 'heaven/business.glb',
  'heaven/clerk': 'heaven/clerk.glb',
  'heaven/portal/frame': 'heaven/portal.glb#portal_frame',
  'heaven/portal/left-leaf': 'heaven/portal.glb#portal_left_leaf',
  'heaven/portal/right-leaf': 'heaven/portal.glb#portal_right_leaf',
};

// onPortal: có thì cổng mở bản đồ thế giới trước (app gọi lại depart/cancelPortal); không có thì đi qua cổng ngay.
export async function createHeavenGame(profile, onReborn, onPortal) {
  const character = await loadPlayer(playerModel(profile.gender));
  const world = createHeavenScene(character);
  await attachModels(world, HEAVEN_MODELS);
  // Sân nhiều vùng cản (tường cổng, cột): chỉ đổi hình, giữ khối tạm làm va chạm.
  dressSlot(world.scene.getObjectByName('asset:heaven/plaza'), await loadModel('heaven/plaza.glb'));
  world.scene.getObjectByName('asset:heaven/surroundings')?.traverse(object => { object.castShadow = object.receiveShadow = false; }); // nền lớn không đổ/nhận bóng
  let ui, journey, mode = null, nearest = null, activeExpert = null;
  let conversation = [], lineIndex = 0, afterConversation = null, selectedQuestion = null;
  let feedbackAction = null;
  let departureTime = 0, farewellDone = false;
  let leading = false; // chọn "Dẫn tôi": tự đi tới chuyên gia tiếp theo, rồi Thần Tiếp Nhận
  const briefingOptions = [
    { id: 'lead', text: t('heaven.briefing.lead') },
    { id: 'explore', text: t('heaven.briefing.explore') },
  ];
  let touch = { x: 0, z: 0 };
  const keyboard = createMovementInput();
  function clearInput() { keyboard.clear(); touch = { x: 0, z: 0 }; world.stopMovement(); ui?.clearTouch(); }
  let questTarget = null;
  function refresh() {
    ui.skipVisible(['welcome', 'learning', 'review'].includes(journey.phase));
    questTarget = ui.hud(journey);
    world.setTarget(questTarget);
    world.setUnlocked(journey.phase === 'return' || journey.phase === 'completed');
  }
  function close() {
    mode = null; activeExpert = null; selectedQuestion = null;
    world.setFocus(null); clearInput(); ui.closeDialogue(); refresh();
  }
  function showLine() {
    const [speaker, text, stamp] = conversation[lineIndex];
    ui.dialogue(speaker, text, {
      stamp: stamp === 'notDead' ? t('heaven.stamp.notDead') : null,
    });
  }
  function talk(lines, onDone = close) {
    clearInput(); mode = 'talk'; conversation = lines; lineIndex = 0; afterConversation = onDone;
    showLine();
  }
  function briefing() {
    clearInput(); mode = 'briefing';
    const expert = EXPERTS.find(item => journey.question(item.id));
    ui.dialogue('THẦN CHẾT', t('heaven.briefing.line', { expert: expert.name }), {
      tag: t('heaven.briefing.tag'),
      choices: briefingOptions.map(option => (option.id === 'lead' ? { ...option, default: true } : option)),
      onSelect: acceptBriefing,
    });
  }
  function acceptBriefing(id) {
    if (mode !== 'briefing' || !briefingOptions.some(option => option.id === id)) return;
    const expert = EXPERTS.find(item => journey.question(item.id));
    journey.meetReaper(); close();
    ui.toast(t('heaven.toast.briefing', { expert: expert.name }));
    leading = id === 'lead';
    if (leading) world.moveToNpc(expert.id);
  }
  function finishExpert(expert) {
    ui.toast(t('heaven.toast.seal', { seal: expert.seal, passed: journey.progress.passed[expert.id], total: expert.questions.length })); close();
    if (leading) world.moveToNpc(EXPERTS.find(item => journey.question(item.id))?.id ?? 'clerk');
  }
  function question(expert) {
    const current = journey.question(expert.id);
    if (!current) { finishExpert(expert); return; }
    mode = 'question'; selectedQuestion = current; activeExpert = expert;
    const number = journey.progress.answered[expert.id] + 1;
    // Lời chào gộp vào hộp câu đầu (không còn hộp riêng).
    ui.dialogue(expert.name, number === 1 ? `${expert.greeting}\n\n${current.text}` : current.text, {
      icon: expert.icon, tag: t('heaven.question.tag', { number, total: expert.questions.length }),
      choices: current.options, onSelect: id => answer(id),
    });
  }
  function answer(optionId) {
    if (mode !== 'question' || !selectedQuestion || !activeExpert) return;
    const expert = activeExpert;
    const result = journey.answer(expert.id, selectedQuestion.id, optionId);
    if (!result) return;
    sfx(result.correct ? 'bench.good' : 'bench.bad'); // right/wrong answer cue (04 §8), reusing the bar's sounds
    mode = 'feedback'; refresh();
    feedbackAction = () => question(expert);
    const { name, effect } = selectedQuestion.perk;
    ui.dialogue(expert.name, result.text, {
      icon: expert.icon, tag: t(result.correct ? 'heaven.feedback.correct' : 'heaven.feedback.wrong'),
      nextLabel: t('heaven.feedback.next'),
      tip: t(result.correct ? 'heaven.feedback.tipGood' : 'heaven.feedback.tipMissed', { name, effect }),
      tipGood: result.correct,
      stamp: !journey.question(expert.id) ? t('heaven.feedback.stamp', { passed: journey.progress.passed[expert.id], total: expert.questions.length }) : null,
    });
  }
  function gifts() {
    clearInput(); mode = 'gift';
    ui.dialogue(CLERK, t('heaven.gift.line'), {
      icon: '▤', tag: t('heaven.gift.tag'),
      choices: GIFTS.map(gift => ({ id: gift.id, text: `${gift.icon} ${gift.name} — ${gift.description}` })),
      onSelect: id => chooseGift(id),
    });
  }
  function chooseGift(id) {
    if (mode !== 'gift' || !journey.chooseGift(id)) return;
    const gift = GIFTS.find(item => item.id === id);
    close(); ui.toast(t('heaven.toast.gift', { gift: gift.name }));
    world.moveToNpc('portal'); // luôn tự đi: `leading` không lưu qua reload, bước cuối chỉ còn một đích
  }
  function end() {
    if (!journey.returnHome()) return;
    mode = 'completed'; clearInput(); world.setFocus(null); refresh();
    if (onReborn) { ui.departure(1); onReborn(journey.progress.gift, journey.progress); }
    else ui.complete(GIFTS.find(gift => gift.id === journey.progress.gift), journey.score);
  }
  function depart() {
    mode = 'departure'; departureTime = 0; clearInput();
    world.setFocus('portal'); world.setTarget(null); world.setReturning(true); ui.departure(0);
  }
  function skip() {
    if (!journey.skip()) return;
    leading = false; mode = null; activeExpert = null; selectedQuestion = null;
    // Bỏ qua: không hỏi hành trang, lấy món đầu; đi thẳng vào cổng, tới nơi mở bản đồ (không thoại).
    journey.chooseGift(GIFTS[0].id);
    world.setFocus(null); world.stopMovement(); ui.closeDialogue(); refresh(); world.moveToNpc('portal');
  }
  function openMap() { mode = 'map'; clearInput(); ui.closeDialogue(); world.setTarget(null); onPortal(); }
  function interact() {
    if (mode || !nearest) return;
    const npc = nearest; world.setFocus(npc.id);
    if (npc.id === 'reaper') {
      if (journey.phase === 'welcome') talk(WELCOME, briefing);
      else if (journey.phase === 'learning') briefing();
      else talk([['THẦN CHẾT', t(journey.phase === 'return' ? 'heaven.reaper.return' : 'heaven.reaper.learning')]]);
      return;
    }
    if (journey.phase === 'welcome') { talk([['THẦN CHẾT', t('heaven.reaper.welcomeFirst')]]); return; }
    if (npc.id === 'portal') {
      if (journey.phase === 'return') {
        const { correct, total } = journey.score; // luồng thường chuyển màn ngay, không qua ui.complete
        const go = onPortal ? openMap : depart;
        // Đã nghe lời tiễn (đóng bản đồ rồi vào lại) hoặc đã Bỏ qua: mở bản đồ luôn, không thoại.
        if (farewellDone || journey.progress.skipped) go();
        else {
          // Có bản đồ thì câu cuối mời chọn nơi bắt đầu.
          farewellDone = true;
          talk([
            ...FAREWELL, [CLERK, t('heaven.portal.farewell', { correct, total })],
            ...(onPortal ? [[CLERK, t('heaven.portal.chooseWorld')]] : []),
          ], go);
        }
      }
      else talk([[CLERK, t('heaven.portal.locked')]]);
      return;
    }
    if (npc.id === 'clerk') {
      if (journey.phase === 'learning') talk([[CLERK, t('heaven.clerk.learning', { count: journey.seals.length })]]);
      else if (journey.phase === 'review') talk(REVEAL, () => { journey.reveal(); refresh(); gifts(); });
      else if (journey.phase === 'gift') gifts();
      else talk([[CLERK, t('heaven.clerk.done')]]);
      return;
    }
    const expert = EXPERTS.find(item => item.id === npc.id);
    if (!expert) return;
    if (!journey.question(expert.id)) talk([[expert.name, t('heaven.expert.done', { seal: expert.seal.toLowerCase() })]]);
    else question(expert);
  }
  ui = createHeavenUI(profile, {
    interact, skip,
    touch: value => { touch = value; if (value.x || value.z) { world.stopMovement(); ui.hideHint(); } },
    anyClick(event) {
      if (event.target.closest('#game-settings-toggle, #game-settings, #heaven-skip')) return;
      if (mode === 'talk' || mode === 'feedback') {
        event.preventDefault(); event.stopPropagation(); nextDialogue(); return;
      }
      if (mode === 'question' || mode === 'gift' || mode === 'briefing') {
        if (event.target.closest('#dialogue-choices button')) return;
        event.preventDefault(); event.stopPropagation();
        ui.pulseChoices();
        return;
      }
      if (!mode && event.target.closest('#game canvas')) {
        if (performance.now() < suppressClickUntil) return;
        const canvas = event.target.closest('canvas');
        world.moveToScreen(event.clientX, event.clientY, canvas.getBoundingClientRect()); ui.hideHint();
      }
    },
    questGo() {
      if (mode || !questTarget) return;
      world.resetCamera(); ui.hideHint(); world.moveToNpc(questTarget);
    },
    replay: () => {
      journey.reset(); mode = null; nearest = null; clearInput(); ui.hideEnding(); ui.closeDialogue(); world.reset('welcome'); refresh();
    },
  });
  // Kéo để xem map, lăn chuột để zoom (như nông trại); cú click sau khi kéo không làm nhân vật đi.
  const events = new AbortController();
  let drag = null, suppressClickUntil = 0;
  document.addEventListener('pointerdown', event => {
    const canvas = event.target.closest('#game canvas');
    if (mode || !canvas || event.button !== 0 || !event.isPrimary) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, canvas };
    canvas.setPointerCapture(event.pointerId);
  }, { capture: true, signal: events.signal });
  document.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    drag.moved = true; event.preventDefault();
    world.panCamera(drag.lastX, drag.lastY, event.clientX, event.clientY, drag.canvas.getBoundingClientRect());
    drag.lastX = event.clientX; drag.lastY = event.clientY;
  }, { capture: true, passive: false, signal: events.signal });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) suppressClickUntil = performance.now() + 400;
    if (drag.canvas.hasPointerCapture(event.pointerId)) drag.canvas.releasePointerCapture(event.pointerId);
    drag = null;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, endDrag, { capture: true, signal: events.signal });
  document.addEventListener('wheel', event => {
    if (mode || !event.target.closest('#game canvas') || event.ctrlKey) return;
    event.preventDefault(); world.zoomView(event.deltaY < 0 ? .1 : -.1);
  }, { passive: false, signal: events.signal });
  let storageNoticeShown = false;
  journey = createJourney(readProgress().heaven, progress => {
    if (!saveHeaven(progress) && !storageNoticeShown) {
      storageNoticeShown = true; ui.toast(t('heaven.toast.saveFailed'));
    }
  });
  world.reset(journey.phase); refresh();
  if (journey.phase === 'completed') {
    mode = 'completed'; ui.complete(GIFTS.find(gift => gift.id === journey.progress.gift), journey.score);
  }
  function nextDialogue() {
    if (mode === 'talk') {
      lineIndex++;
      if (lineIndex < conversation.length) showLine();
      else { const callback = afterConversation; afterConversation = null; callback?.(); }
    } else if (mode === 'feedback') { const callback = feedbackAction; feedbackAction = null; callback?.(); }
  }
  return {
    scene: world.scene, camera: world.camera,
    resize: world.resize, clearInput, nextDialogue, replaceAsset: world.replaceAsset, getAssetSlots: world.getAssetSlots,
    update(dt, time) {
      const result = world.update(dt, time, keyboard.combine(touch), mode !== null && mode !== 'departure');
      nearest = result.nearest;
      if (!mode && result.arrivedNpc && nearest?.id === result.arrivedNpc) interact();
      if (!mode && result.enteredPortal && nearest?.id === 'portal') interact();
      if (mode === 'departure') {
        if (result.passedPortal) departureTime += dt;
        ui.departure(Math.min(1, departureTime));
        if (departureTime >= 1) { world.setReturning(false); end(); }
      }
      ui.prompt(nearest, mode !== null); ui.update();
    },
    handleKeyDown(event) {
      if (mode === 'completed' && event.code === 'Tab') {
        event.preventDefault(); document.getElementById('heaven-replay').focus(); return;
      }
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.repeat && ['Enter', 'Space'].includes(event.code)) { event.preventDefault(); return; }
      if (mode === 'question' || mode === 'gift' || mode === 'briefing') {
        const number = Number(event.key) - 1;
        const options = mode === 'question' ? selectedQuestion.options : mode === 'briefing' ? briefingOptions : GIFTS;
        if (!event.repeat && options[number]) {
          event.preventDefault();
          if (mode === 'question') answer(options[number].id);
          else if (mode === 'briefing') acceptBriefing(options[number].id);
          else chooseGift(options[number].id);
        }
        return;
      }
      if (mode === 'talk' || mode === 'feedback') {
        // The focused Next button already handles Enter/Space natively; E must still advance.
        if (!event.repeat && (event.code === 'KeyE' || ['Enter', 'Space'].includes(event.code) && !event.target.closest('button'))) { event.preventDefault(); nextDialogue(); }
        return;
      }
      if (mode) return;
      if (keyboard.down(event)) { world.stopMovement(); ui.hideHint(); return; }
      if (['KeyE', 'Enter', 'Space'].includes(event.code) && !event.repeat && !event.target.closest('button')) { event.preventDefault(); interact(); }
    },
    handleKeyUp(event) { keyboard.up(event); },
    // Bản đồ thế giới đóng: đứng lại trước cổng. Đã chọn nơi: chạy hoạt cảnh qua cổng như cũ.
    cancelPortal() { if (mode === 'map') { world.setFocus(null); close(); } },
    depart() { if (mode === 'map') depart(); },
    dispose() { events.abort(); clearInput(); ui.dispose(); world.dispose(); },
  };
}
