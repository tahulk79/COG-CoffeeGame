import { createMovementInput } from '../../ui/movement.js';
import { loadPlayer, playerModel } from '../../characters/load-player.js';
import { readProgress, saveHeaven } from '../../state/progress.js';
import { createHeavenScene } from './scene.js';
import { createJourney } from './journey.js';
import { createHeavenUI } from './ui.js';
import { EXPERTS, GIFTS, WELCOME, REVEAL, FAREWELL } from './content.js';
import { attachModels } from '../../shared/three/models.js';

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
  world.scene.getObjectByName('asset:heaven/surroundings')?.traverse(object => { object.castShadow = false; }); // nền lớn không cần đổ bóng
  let ui, journey, mode = null, nearest = null, activeExpert = null;
  let conversation = [], lineIndex = 0, afterConversation = null, selectedQuestion = null;
  let feedbackAction = null;
  let departureTime = 0;
  const briefingOptions = [
    { id: 'lead', text: 'Nhận hồ sơ · Dẫn tôi tới chuyên gia tiếp theo' },
    { id: 'explore', text: 'Nhận hồ sơ · Tôi tự khám phá' },
  ];
  let touch = { x: 0, z: 0 };
  const keyboard = createMovementInput();
  function clearInput() { keyboard.clear(); touch = { x: 0, z: 0 }; world.stopMovement(); ui?.clearTouch(); }
  function refresh() {
    world.setTarget(ui.hud(journey));
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
      tag: 'NHẬN NHIỆM VỤ', choiceHint: 'Chọn cách bắt đầu hành trình.',
      choices: briefingOptions.map(option => ({ ...option, text: option.id === 'lead' ? `Nhận hồ sơ · Đưa tôi tới ${expert.name}` : option.text })),
      onSelect: acceptBriefing,
    });
  }
  function acceptBriefing(id) {
    if (mode !== 'briefing' || !briefingOptions.some(option => option.id === id)) return;
    const expert = EXPERTS.find(item => journey.question(item.id));
    journey.meetReaper(); close();
    ui.toast(`Đã nhận hồ sơ · Gặp ${expert.name} để bắt đầu.`);
    if (id === 'lead') world.moveToNpc(expert.id);
  }
  function question(expert) {
    const current = journey.question(expert.id);
    if (!current) {
      talk([[expert.name, `Hoàn thành phần ${expert.seal.toLowerCase()}: ${journey.progress.passed[expert.id]}/${expert.questions.length} câu đúng. Điểm đúng sai đã lưu, không thi lại nhé!`]], () => {
        ui.toast(`Nhận dấu · ${expert.seal}`); close();
      }); return;
    }
    mode = 'question'; selectedQuestion = current; activeExpert = expert;
    const number = journey.progress.answered[expert.id] + 1;
    ui.dialogue(expert.name, current.text, {
      icon: expert.icon, tag: `CÂU ${number} / ${expert.questions.length}`,
      choices: current.options, onSelect: id => answer(id),
    });
  }
  function answer(optionId) {
    if (mode !== 'question' || !selectedQuestion || !activeExpert) return;
    const expert = activeExpert;
    const result = journey.answer(expert.id, selectedQuestion.id, optionId);
    if (!result) return;
    mode = 'feedback'; refresh();
    feedbackAction = () => question(expert);
    ui.dialogue(expert.name, result.text, {
      icon: expert.icon, tag: result.correct ? 'CHÍNH XÁC' : 'ĐÃ GHI NHẬN CÂU SAI',
      nextLabel: 'Tiếp tục ▸',
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
    talk([['THẦN TIẾP NHẬN', `Đã gửi ${gift.name.toLowerCase()} vào hành trang. Cổng trở về đã mở. Đi cho cẩn thận nhé!`]], close);
  }
  function end() {
    if (!journey.returnHome()) return;
    mode = 'completed'; clearInput(); world.setFocus(null); refresh();
    if (onReborn) { ui.departure(1); onReborn(journey.progress.gift); }
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
      if (journey.phase === 'return') talk(FAREWELL, depart);
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
    else {
      activeExpert = expert;
      talk([[expert.name, expert.greeting]], () => question(expert));
    }
  }
  ui = createHeavenUI(profile, {
    interact,
    touch: value => { touch = value; if (value.x || value.z) world.stopMovement(); },
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
        const canvas = event.target.closest('canvas');
        world.moveToScreen(event.clientX, event.clientY, canvas.getBoundingClientRect());
      }
    },
    replay: () => {
      journey.reset(); mode = null; nearest = null; clearInput(); ui.hideEnding(); ui.closeDialogue(); world.reset('welcome'); refresh();
    },
  });
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
      if (keyboard.down(event)) { world.stopMovement(); return; }
      if (['KeyE', 'Enter', 'Space'].includes(event.code) && !event.repeat && !event.target.closest('button')) { event.preventDefault(); interact(); }
    },
    handleKeyUp(event) { keyboard.up(event); },
    dispose() { clearInput(); ui.dispose(); world.dispose(); },
  };
}
