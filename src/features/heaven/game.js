import { createMovementInput } from '../../ui/movement.js';
import { loadPlayer, playerModel } from '../../characters/load-player.js';
import { readProgress, saveHeaven } from '../../state/progress.js';
import { createHeavenScene } from './scene.js';
import { createJourney } from './journey.js';
import { createHeavenUI } from './ui.js';
import { GIFTS, STARTING_GIFT, CLERK, MINI, NPCS } from './content.js';
import { t } from '../../i18n/index.js';
import { attachModels, dressSlot, loadModel } from '../../shared/three/models.js';

// 02-mini: ba chuyên gia không còn ở thiên đàng nên không nạp GLB của họ.
const HEAVEN_MODELS = {
  'heaven/reaper': 'heaven/reaper.glb',
  'heaven/surroundings': 'heaven/surroundings.glb',
  'heaven/clerk': 'heaven/clerk.glb',
  'heaven/portal/frame': 'heaven/portal.glb#portal_frame',
  'heaven/portal/left-leaf': 'heaven/portal.glb#portal_left_leaf',
  'heaven/portal/right-leaf': 'heaven/portal.glb#portal_right_leaf',
};
const PORTAL = NPCS.find(npc => npc.id === 'portal').position;
const STILL = { x: 0, z: 0 }; // hoạt cảnh tự đi: bỏ joystick/phím

// Thiên đàng mini (05/11/2026, F-44): ≤ 5 hộp thoại, hộp 5 là lời tiễn kèm nút Nhận Túi hạt giống, rồi tự đi vào cổng (chạm để tua).
// onPortal: có thì cổng mở bản đồ thế giới trước (app gọi lại depart/cancelPortal); không có thì đi qua cổng ngay.
export async function createHeavenGame(profile, onReborn, onPortal) {
  const character = await loadPlayer(playerModel(profile.gender));
  const world = createHeavenScene(character);
  await attachModels(world, HEAVEN_MODELS);
  // Sân nhiều vùng cản (tường cổng, cột): chỉ đổi hình, giữ khối tạm làm va chạm.
  dressSlot(world.scene.getObjectByName('asset:heaven/plaza'), await loadModel('heaven/plaza.glb'));
  world.scene.getObjectByName('asset:heaven/surroundings')?.traverse(object => { object.castShadow = object.receiveShadow = false; }); // nền lớn không đổ/nhận bóng
  let ui, journey, mode = null, nearest = null;
  let conversation = [], lineIndex = 0, afterConversation = null;
  let departureTime = 0;
  let ready = false; // khung update đầu tiên mới nhận chạm tua: lúc còn màn tải, app chưa ở 'heaven' nên mở bản đồ sẽ hụt
  let touch = { x: 0, z: 0 };
  const keyboard = createMovementInput();
  function clearInput() { keyboard.clear(); touch = { x: 0, z: 0 }; world.stopMovement(); ui?.clearTouch(); }
  let questTarget = null;
  function refresh() {
    ui.skipVisible(['welcome', 'gift'].includes(journey.phase) && !['walk', 'map', 'departure', 'completed'].includes(mode));
    questTarget = ui.hud(journey, mode === 'walk');
    world.setTarget(questTarget);
    world.setUnlocked(journey.phase === 'return' || journey.phase === 'completed');
  }
  function close() {
    mode = null;
    world.setFocus(null); clearInput(); ui.closeDialogue(); refresh();
  }
  function showLine() {
    const [speaker, text, stamp] = conversation[lineIndex];
    world.setFocus(speaker === CLERK ? 'clerk' : speaker === 'THẦN CHẾT' ? 'reaper' : null); // camera nghiêng về người đang nói
    ui.dialogue(speaker, text, {
      stamp: stamp === 'notDead' ? t('heaven.stamp.notDead') : null,
    });
  }
  function talk(lines, onDone = close) {
    clearInput(); mode = 'talk'; conversation = lines; lineIndex = 0; afterConversation = onDone;
    showLine();
  }
  // Hộp 5: lời tiễn + quà cố định, 1 chạm. Save cũ dở ở pha chọn quà cũng chỉ thấy hộp này (không còn 3 thẻ).
  function giftBox() {
    clearInput(); mode = 'gift'; world.setFocus('clerk'); refresh();
    ui.dialogue(CLERK, t('heaven.mini.farewell'), {
      icon: '▤', tag: t('heaven.mini.tag'), tip: t('heaven.mini.gift'), tipGood: true, hint: t('heaven.mini.claimHint'),
      choices: [{ id: STARTING_GIFT, text: t('heaven.mini.claim'), default: true }], onSelect: claim,
    });
  }
  function claim() {
    if (mode !== 'gift' || !journey.chooseGift(STARTING_GIFT)) return;
    ui.toast(t('heaven.toast.gift', { gift: GIFTS.find(gift => gift.id === STARTING_GIFT).name }));
    walkToPortal();
  }
  // Hoạt cảnh tự đi vào cổng; chạm/phím để tua. Tới cổng thì mở bản đồ như luồng thường.
  function walkToPortal() {
    clearInput(); ui.closeDialogue(); ui.controls(false);
    mode = 'walk'; world.setFocus(null); world.resetCamera(); refresh();
    world.moveToNpc('portal');
  }
  function fastForward() {
    if (mode !== 'walk' || !ready) return;
    character.position.set(PORTAL[0], character.position.y, PORTAL[1] - 2.4); character.rotation.y = 0;
    go();
  }
  function end() {
    if (!journey.returnHome()) return;
    mode = 'completed'; clearInput(); world.setFocus(null); refresh();
    if (onReborn) { ui.departure(1); onReborn(journey.progress.gift, journey.progress); }
    else ui.complete(GIFTS.find(gift => gift.id === journey.progress.gift), journey.score);
  }
  function depart() {
    mode = 'departure'; departureTime = 0; clearInput(); ui.skipVisible(false);
    world.setFocus('portal'); world.setTarget(null); world.setReturning(true); ui.departure(0);
  }
  function openMap() { mode = 'map'; clearInput(); ui.closeDialogue(); world.setTarget(null); ui.skipVisible(false); onPortal(); }
  function go() { if (onPortal) openMap(); else depart(); }
  // Bỏ qua ↗ (1 lần bấm, 05/11/2026): đóng thoại, nhận Túi hạt giống rồi tự đi vào cổng.
  function skip() {
    if (!['welcome', 'gift'].includes(journey.phase) || ['walk', 'map', 'departure', 'completed'].includes(mode)) return;
    journey.skip();
    if (!journey.chooseGift(STARTING_GIFT)) return;
    afterConversation = null;
    ui.toast(t('heaven.toast.gift', { gift: GIFTS.find(gift => gift.id === STARTING_GIFT).name }));
    walkToPortal();
  }
  // Vào chương theo pha đã lưu: thoại tự chạy, không cần đi tới ai.
  function begin() {
    world.reset('welcome'); refresh();
    if (journey.phase === 'welcome') talk(MINI, () => { journey.reveal(); giftBox(); });
    else if (journey.phase === 'gift') giftBox();
    else if (journey.phase === 'return') walkToPortal();
  }
  // Chỉ còn dùng khi đóng bản đồ mà chưa chọn nơi: đi lại tự do trước cổng.
  function interact() {
    if (mode || !nearest) return;
    const npc = nearest; world.setFocus(npc.id);
    if (npc.id === 'portal') { if (journey.phase === 'return') go(); else world.setFocus(null); return; }
    if (npc.id === 'reaper') talk([['THẦN CHẾT', t('heaven.reaper.return')]]);
    else if (npc.id === 'clerk') talk([[CLERK, t('heaven.clerk.done')]]);
    else world.setFocus(null);
  }
  ui = createHeavenUI(profile, {
    interact, skip,
    touch: value => { touch = value; if (value.x || value.z) world.stopMovement(); },
    anyClick(event) {
      if (event.target.closest('#game-settings-toggle, #game-settings, #heaven-skip')) return;
      if (mode === 'talk') { event.preventDefault(); event.stopPropagation(); nextDialogue(); return; }
      if (mode === 'walk') { event.preventDefault(); event.stopPropagation(); fastForward(); return; }
      if (mode === 'gift') {
        if (event.target.closest('#dialogue-choices button')) return;
        event.preventDefault(); event.stopPropagation();
        ui.pulseChoices();
        return;
      }
      if (!mode && event.target.closest('#game canvas')) {
        if (performance.now() < suppressClickUntil) return;
        const canvas = event.target.closest('canvas');
        world.moveToScreen(event.clientX, event.clientY, canvas.getBoundingClientRect());
      }
    },
    questGo() {
      if (mode || !questTarget) return;
      world.resetCamera(); world.moveToNpc(questTarget);
    },
    replay: () => {
      journey.reset(); mode = null; nearest = null; clearInput(); ui.hideEnding(); ui.closeDialogue(); begin();
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
  if (journey.phase === 'completed') {
    world.reset('welcome'); refresh();
    mode = 'completed'; ui.complete(GIFTS.find(gift => gift.id === journey.progress.gift), journey.score);
  } else begin();
  function nextDialogue() {
    if (mode !== 'talk') return;
    lineIndex++;
    if (lineIndex < conversation.length) showLine();
    else { const callback = afterConversation; afterConversation = null; callback?.(); }
  }
  return {
    scene: world.scene, camera: world.camera,
    resize: world.resize, clearInput, nextDialogue, replaceAsset: world.replaceAsset, getAssetSlots: world.getAssetSlots,
    update(dt, time) {
      ready = true;
      const walking = mode === 'walk';
      const result = world.update(dt, time, walking ? STILL : keyboard.combine(touch), mode !== null && mode !== 'departure' && !walking);
      nearest = result.nearest;
      // Kẹt giữa đường (scene thử lại 2 lần rồi bỏ lộ trình) cũng tự tua tới cổng, không đứng chờ chạm.
      if (walking && (result.arrivedNpc === 'portal' || result.enteredPortal)) go();
      else if (walking && (result.navigationFailed || !result.routing)) fastForward();
      else if (!mode && result.arrivedNpc && nearest?.id === result.arrivedNpc) interact();
      else if (!mode && result.enteredPortal && nearest?.id === 'portal') interact();
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
      if (mode === 'gift') {
        if (!event.repeat && event.key === '1') { event.preventDefault(); claim(); }
        return;
      }
      if (mode === 'talk' || mode === 'walk') {
        // The focused Next button already handles Enter/Space natively; E must still advance.
        if (!event.repeat && (event.code === 'KeyE' || ['Enter', 'Space'].includes(event.code) && !event.target.closest('button'))) {
          event.preventDefault(); if (mode === 'walk') fastForward(); else nextDialogue();
        }
        return;
      }
      if (mode) return;
      if (keyboard.down(event)) { world.stopMovement(); return; }
      if (['KeyE', 'Enter', 'Space'].includes(event.code) && !event.repeat && !event.target.closest('button')) { event.preventDefault(); interact(); }
    },
    handleKeyUp(event) { keyboard.up(event); },
    // Bản đồ thế giới đóng: đứng lại trước cổng, đi lại tự do. Đã chọn nơi: chạy hoạt cảnh qua cổng như cũ.
    cancelPortal() { if (mode === 'map') { world.setFocus(null); close(); } },
    depart() { if (mode === 'map') depart(); },
    dispose() { events.abort(); clearInput(); ui.dispose(); world.dispose(); },
  };
}
