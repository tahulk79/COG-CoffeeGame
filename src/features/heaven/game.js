import { createMovementInput } from '../../ui/movement.js';
import { loadPlayer, playerModel } from '../../characters/load-player.js';
import { readProgress, saveHeaven } from '../../state/progress.js';
import { createHeavenScene } from './scene.js';
import { createJourney } from './journey.js';
import { createHeavenUI } from './ui.js';
import { EXPERTS, GIFTS, WELCOME, REVEAL, FAREWELL } from './content.js';
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

export async function createHeavenGame(profile, onReborn) {
  const character = await loadPlayer(playerModel(profile.gender));
  const world = createHeavenScene(character);
  await attachModels(world, HEAVEN_MODELS);
  // Sân nhiều vùng cản (tường cổng, cột): chỉ đổi hình, giữ khối tạm làm va chạm.
  dressSlot(world.scene.getObjectByName('asset:heaven/plaza'), await loadModel('heaven/plaza.glb'));
  world.scene.getObjectByName('asset:heaven/surroundings')?.traverse(object => { object.castShadow = object.receiveShadow = false; }); // nền lớn không đổ/nhận bóng
  let ui, journey, mode = null, nearest = null, activeExpert = null;
  let conversation = [], lineIndex = 0, afterConversation = null, selectedQuestion = null;
  let feedbackAction = null;
  let departureTime = 0;
  let leading = false; // chọn "Dẫn tôi": tự đi tới chuyên gia tiếp theo, rồi Thần Tiếp Nhận
  const briefingOptions = [
    { id: 'lead', text: 'Nhận hồ sơ · Dẫn tôi tới chuyên gia tiếp theo' },
    { id: 'explore', text: 'Nhận hồ sơ · Tôi tự khám phá' },
  ];
  let touch = { x: 0, z: 0 };
  const keyboard = createMovementInput();
  function clearInput() { keyboard.clear(); touch = { x: 0, z: 0 }; world.stopMovement(); ui?.clearTouch(); }
  let questTarget = null;
  function refresh() {
    questTarget = ui.hud(journey);
    world.setTarget(questTarget);
    world.setUnlocked(journey.phase === 'return' || journey.phase === 'completed');
  }
  function close() {
    mode = null; activeExpert = null; selectedQuestion = null;
    world.setFocus(null); clearInput(); ui.closeDialogue(); refresh();
  }
  function showLine() {
    const [speaker, text] = conversation[lineIndex];
    ui.dialogue(speaker, text, {
      stamp: speaker === 'THẦN TIẾP NHẬN' && text.includes('CHƯA CHẾT') ? 'CHƯA CHẾT · CHỈ NGẤT' : null,
    });
  }
  function talk(lines, onDone = close) {
    clearInput(); mode = 'talk'; conversation = lines; lineIndex = 0; afterConversation = onDone;
    showLine();
  }
  function briefing() {
    clearInput(); mode = 'briefing';
    const expert = EXPERTS.find(item => journey.question(item.id));
    ui.dialogue('THẦN CHẾT', `Đây là hồ sơ của em. Gặp ba chuyên gia, mỗi người hai câu; đúng sai đều được ghi lại. Bắt đầu với ${expert.name} nhé. Anh chỉ đường, không chỉ đáp án đâu!`, {
      tag: 'NHẬN NHIỆM VỤ',
      choices: briefingOptions.map(option => (option.id === 'lead' ? { ...option, default: true } : option)),
      onSelect: acceptBriefing,
    });
  }
  function acceptBriefing(id) {
    if (mode !== 'briefing' || !briefingOptions.some(option => option.id === id)) return;
    const expert = EXPERTS.find(item => journey.question(item.id));
    journey.meetReaper(); close();
    ui.toast(`Đã nhận hồ sơ · Gặp ${expert.name} để bắt đầu.`);
    leading = id === 'lead';
    if (leading) world.moveToNpc(expert.id);
  }
  function finishExpert(expert) {
    ui.toast(`Nhận dấu · ${expert.seal} · ${journey.progress.passed[expert.id]}/${expert.questions.length} đúng`); close();
    if (leading) world.moveToNpc(EXPERTS.find(item => journey.question(item.id))?.id ?? 'clerk');
  }
  function question(expert) {
    const current = journey.question(expert.id);
    if (!current) { finishExpert(expert); return; }
    mode = 'question'; selectedQuestion = current; activeExpert = expert;
    const number = journey.progress.answered[expert.id] + 1;
    // Lời chào gộp vào hộp câu đầu (không còn hộp riêng).
    ui.dialogue(expert.name, number === 1 ? `${expert.greeting}\n\n${current.text}` : current.text, {
      icon: expert.icon, tag: `CÂU ${number} / ${expert.questions.length}`,
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
      icon: expert.icon, tag: result.correct ? 'CHÍNH XÁC' : 'ĐÃ GHI NHẬN CÂU SAI',
      nextLabel: 'Tiếp tục ▸',
      tip: result.correct ? `🎓 Mẹo: ${name} · ${effect}` : `Chưa nhận mẹo ${name} (${effect}) · sẽ được hỏi lại ở nông trại/quán`,
      tipGood: result.correct,
      stamp: !journey.question(expert.id) ? `XONG PHẦN THI · ${journey.progress.passed[expert.id]}/${expert.questions.length} ĐÚNG` : null,
    });
  }
  function gifts() {
    clearInput(); mode = 'gift';
    ui.dialogue('THẦN TIẾP NHẬN', 'Chọn một món mang về. Miễn phí lần này thôi, đừng quay lên đổi trả nhé.', {
      icon: '▤', tag: 'HÀNH TRANG',
      choices: GIFTS.map(gift => ({ id: gift.id, text: `${gift.icon} ${gift.name} — ${gift.description}` })),
      onSelect: id => chooseGift(id),
    });
  }
  function chooseGift(id) {
    if (mode !== 'gift' || !journey.chooseGift(id)) return;
    const gift = GIFTS.find(item => item.id === id);
    close(); ui.toast(`Đã nhận ${gift.name} · Đi tới Cổng trùng sinh.`);
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
  function interact() {
    if (mode || !nearest) return;
    const npc = nearest; world.setFocus(npc.id);
    if (npc.id === 'reaper') {
      if (journey.phase === 'welcome') talk(WELCOME, briefing);
      else if (journey.phase === 'learning') briefing();
      else talk([['THẦN CHẾT', journey.phase === 'return' ? 'Đi thẳng tới cổng nhé. Anh vừa kiểm tra địa chỉ… hai lần.' : 'Cứ theo dấu vàng mà đi. Anh vận chuyển, không làm bài hộ được.']]);
      return;
    }
    if (journey.phase === 'welcome') { talk([['THẦN CHẾT', 'Khoan! Hỏi anh trước đã. Đừng tự nộp hồ sơ khi chưa biết mình bị giao tới đâu.']]); return; }
    if (npc.id === 'portal') {
      if (journey.phase === 'return') {
        const { correct, total } = journey.score; // luồng thường chuyển màn ngay, không qua ui.complete
        talk([...FAREWELL, ['THẦN TIẾP NHẬN', `Mẹo đã nhận ${correct}/${total} · ${total - correct} câu sẽ được ôn lại ở nông trại/quán.`]], depart);
      }
      else talk([['THẦN TIẾP NHẬN', 'Cổng chưa mở. Cần đủ ba dấu, kiểm tra hồ sơ và nhận hành trang trước đã.']]);
      return;
    }
    if (npc.id === 'clerk') {
      if (journey.phase === 'learning') talk([['THẦN TIẾP NHẬN', `Hồ sơ mới có ${journey.seals.length}/3 dấu. Gặp đủ ba chuyên gia rồi quay lại nhé.`]]);
      else if (journey.phase === 'review') talk(REVEAL, () => { journey.reveal(); refresh(); gifts(); });
      else if (journey.phase === 'gift') gifts();
      else talk([['THẦN TIẾP NHẬN', 'Hồ sơ đã đính chính: chỉ ngất. Hành trang đã nhận; mời con tới cổng trở về.']]);
      return;
    }
    const expert = EXPERTS.find(item => item.id === npc.id);
    if (!expert) return;
    if (!journey.question(expert.id)) talk([[expert.name, `Con đã có dấu ${expert.seal.toLowerCase()} rồi. Học để dùng, không phải để sưu tầm giấy nhé.`]]);
    else question(expert);
  }
  ui = createHeavenUI(profile, {
    interact,
    touch: value => { touch = value; if (value.x || value.z) { world.stopMovement(); ui.hideHint(); } },
    anyClick(event) {
      if (event.target.closest('#game-settings-toggle, #game-settings')) return;
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
      storageNoticeShown = true; ui.toast('Trình duyệt chưa lưu được tiến trình. Bạn vẫn chơi tiếp được trong lượt này.');
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
    dispose() { events.abort(); clearInput(); ui.dispose(); world.dispose(); },
  };
}
