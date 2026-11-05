import * as THREE from 'three';
import { beatAt, START_TIME, DURATION, PLAYBACK_RATE, nextDialogueTime } from '../features/intro/timeline.js';
import { showDialogue } from '../ui/dialogue.js';
import { completeIntro, readPlayer, readProgress, readSettings, resetProgress, savePlayer, saveRegion, saveSettings } from '../state/progress.js';
import { DEFAULT_NAME, randomName } from '../state/names.js';
import { applyRendererQuality, getQuality, onQuality, setQuality } from '../shared/vfx/index.js';
import { lowerQuality, mountSettings } from '../ui/settings.js';
import { attachModels, releaseModels } from '../shared/three/models.js';
import { answeredQuestionIds, correctQuestionIds } from '../features/heaven/journey.js';
import { loading, showLoading, hideLoading } from '../ui/loading.js';
import { getLang, t } from '../i18n/index.js';
import { usesTouch } from '../ui/dialogue.js';
import { regionType, DEFAULT_REGION } from '../features/world-map/content.js';
import { hasKey } from '../features/awakening/unlocks.js';
import { detectPlatform, initAnalytics, track } from '../shared/analytics/wire.js';
import { DEV_START_COINS } from '../state/storage-keys.js'; // set only in the dev `?profile=max` QA profile
import pkg from '../../package.json';

const INTRO_MODELS = {
  'intro/reaper': 'heaven/reaper.glb',
  'intro/ambulance': 'intro/ambulance.glb',
  'intro/bicycle': 'intro/bicycle.glb',
  'intro/street/trees': 'intro/trees.glb',
  'intro/street/shops': 'intro/shops.glb',
  'intro/street/road': 'intro/street.glb#intro_road',
  'intro/warning-sign/post': 'intro/street.glb#warning_post',
  'intro/stretcher': 'intro/street.glb#stretcher',
  'intro/heaven/path': 'intro/street.glb#heaven_path',
  'intro/heaven/gate/frame': 'intro/sky-gate.glb#sky_frame',
  'intro/heaven/gate/left-leaf': 'intro/sky-gate.glb#sky_left_leaf',
  'intro/heaven/gate/right-leaf': 'intro/sky-gate.glb#sky_right_leaf',
};

const $ = id => document.getElementById(id);
const vignette = document.querySelector('.vignette');
const player = readPlayer();
// F-38: khởi tạo analytics đúng một lần khi nạp module (docs/design/godbean-gdd.md §13.5).
const boot = readProgress();
initAnalytics({
  appVersion: pkg.version, platform: detectPlatform(Math.min(window.innerWidth, window.innerHeight), usesTouch()),
  locale: getLang(), region: () => readProgress().startingRegion, enabled: readSettings().analytics && !DEV_START_COINS,
});
track('landing_viewed', { first_visit: !boot.introCompleted && !boot.farm });
const events = new AbortController();
const listenerOptions = { signal: events.signal };
let renderer;
let activeScene;
let elapsed = 0;
let previous = null;
let state = 'loading';
let currentBeat = null;
let visualTime = 0;
let worldMap = null, region = null; // bản đồ thế giới mở trên cảnh thiên đàng (state 'worldmap'); region = nơi vừa chọn
// Frame monitor: if gameplay stays under ~25 fps for 2 s, step quality down once and wait before judging again (30 fps-capped phones stay put).
let slowTime = 0, judgedTime = 0, graceUntil = 0;
// `?fps` in the URL shows fps, draw calls and quality so performance can be checked on a real phone.
const fpsMeter = new URLSearchParams(location.search).has('fps') ? Object.assign(document.body.appendChild(document.createElement('output')), { style: 'position:fixed;left:50%;transform:translateX(-50%);top:max(4px,env(safe-area-inset-top));z-index:99;padding:3px 8px;border-radius:8px;background:#000a;color:#fff;font:11px/1.3 monospace;white-space:nowrap;pointer-events:none' }) : null;
let meterFrames = 0, meterTime = 0;
function meter(raw) {
  meterFrames++; meterTime += raw;
  if (meterTime < .5) return;
  fpsMeter.textContent = `${Math.round(meterFrames / meterTime)} fps · ${renderer.info.render.calls} draw · ${getQuality()}`;
  meterFrames = meterTime = 0;
}
function watchFrame(dt) {
  // A frame over 250 ms is the browser throttling or pausing the page, not a slow device: restart the window.
  if (dt > .25) { slowTime = judgedTime = 0; graceUntil = visualTime + 3; return; }
  if (dt <= 0 || visualTime < graceUntil) return;
  judgedTime += dt; if (dt > 1 / 25) slowTime += dt;
  if (judgedTime < 2) return;
  if (slowTime / judgedTime > .6 && lowerQuality()) graceUntil = visualTime + 5;
  slowTime = judgedTime = 0;
}
function showControls(playing) {
  for (const id of ['intro-controls', 'caption-box', 'progress']) $(id).hidden = !playing;
}
function nextDialogue() {
  if (state === 'heaven') { activeScene.nextDialogue(); return; }
  if (state !== 'playing') return;
  elapsed = nextDialogueTime(elapsed);
  if (elapsed >= DURATION) finish();
}
async function enterFarm(gift, heavenLessons = [], startingRegion, heavenMet = []) {
  if (state === 'transition') return; // đang chuyển cảnh: không dựng thêm cảnh thứ hai
  state = 'transition'; previous = null; showControls(false);
  $('loading').hidden = false; loading(40, t('app.loading.rebirthFarm'));
  let nextScene;
  try {
    const { createFarmGame } = await import('../features/farm/game.js');
    nextScene = await createFarmGame(player, gift, undefined, heavenLessons, renderer, startingRegion, heavenMet);
    nextScene.resize(window.innerWidth, window.innerHeight);
    loading(85, t('app.loading.prepareFarm'));
    await renderer.compileAsync(nextScene.scene, nextScene.camera);
    activeScene?.dispose(); activeScene = nextScene;
    activeScene.activate(); state = 'farm'; previous = null;
    vignette.style.opacity = '0'; $('loading').hidden = true;
    $('game').setAttribute('aria-label', t('app.game.farmLabel'));
    document.title = t('app.title.farm');
    $('game').focus({ preventScroll: true });
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { if (nextScene !== activeScene) nextScene?.dispose(); fail(error); } // cảnh đã thành activeScene thì không dispose hai lần
}
async function enterHeaven() {
  if (state === 'transition') return;
  state = 'transition'; previous = null; showControls(false);
  $('loading').hidden = false; loading(40, t('app.loading.openHeaven'));
  renderer.toneMappingExposure = 1.05;
  let nextScene;
  try {
    const { createHeavenGame } = await import('../features/heaven/game.js');
    // Use heaven's in-memory progress so lessons survive when localStorage is blocked.
    // heaven_completed: thêm mode ('mini'|'full') và region_type (05/11/2026, F-44); gift luôn 'seeds' với save mới.
    nextScene = await createHeavenGame(player, (gift, heaven) => {
      track('heaven_completed', { skipped: heaven.skipped === true, correct: correctQuestionIds(heaven).length, gift: gift ?? 'none', mode: heaven.mode === 'full' ? 'full' : 'mini', region_type: regionType(region) });
      void enterFarm(gift, correctQuestionIds(heaven), region, answeredQuestionIds(heaven));
    }, () => { void openWorldMap(); });
    nextScene.resize(window.innerWidth, window.innerHeight);
    loading(85, t('app.loading.prepareLevel'));
    await renderer.compileAsync(nextScene.scene, nextScene.camera);
    activeScene?.dispose(); activeScene = nextScene;
    releaseModels('intro/'); // GLB intro chỉ dùng ở màn intro; cảnh intro vừa dispose
    state = 'heaven'; previous = null;
    vignette.style.opacity = '0'; $('loading').hidden = true;
    $('game').setAttribute('aria-label', t('app.game.heavenLabel'));
    document.title = t('app.title.heaven');
    if ($('heaven-ending').hidden) $('game').focus({ preventScroll: true });
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { if (nextScene !== activeScene) nextScene?.dispose(); fail(error); } // cảnh đã thành activeScene thì không dispose hai lần
}
// Cổng thiên đàng → bản đồ thế giới (docs/screens/02b-world-map). Cảnh thiên đàng giữ nguyên bên dưới, chỉ ngừng vẽ.
async function openWorldMap() {
  if (state !== 'heaven') return;
  state = 'transition';
  try {
    const { createWorldMap } = await import('../features/world-map/scene.js');
    // Chốt nơi là lưu ngay (onPick): tải lại giữa chừng thì bản đồ mở thẳng thẻ kết quả của nơi đó, không chọn lại được.
    const pick = (id, { preselected = false } = {}) => { region = id; saveRegion(id); track('region_selected', { region: id, type: regionType(id), preselected }); };
    // Lần chọn vùng đầu (chưa có startingRegion): chọn sẵn Việt Nam, vẫn đổi được tới khi xác nhận (F-44, Q3).
    const chosen = region || readProgress().startingRegion;
    worldMap = createWorldMap({ onPick: pick, onClose: () => leaveWorldMap(), onChoose: id => leaveWorldMap(id), chosen, preselect: chosen ? null : DEFAULT_REGION, hasNature: hasKey(readProgress(), 'nature') });
    worldMap.resize(window.innerWidth, window.innerHeight);
    $('game').setAttribute('aria-label', t('world.label'));
    state = 'worldmap'; previous = null;
  } catch (error) { console.error('Không mở được bản đồ thế giới.', error); state = 'heaven'; activeScene.cancelPortal(); }
}
function leaveWorldMap(chosen) {
  worldMap?.dispose(); worldMap = null; state = 'heaven'; previous = null;
  $('game').setAttribute('aria-label', t('app.game.heavenLabel'));
  if (!chosen) { activeScene.cancelPortal(); return; }
  region = chosen; activeScene.depart();
}
function finish() {
  if (state !== 'playing') return;
  elapsed = DURATION; completeIntro();
  void enterHeaven();
}
function start() {
  elapsed = START_TIME; previous = null; currentBeat = null; state = 'playing';
  showControls(true); $('caption-box').hidden = true;
  $('dialogue-next').disabled = false;
  $('game').focus({ preventScroll: true });
}
function resize() {
  applyRendererQuality(renderer, activeScene?.scene, worldMap?.scene);
  renderer.setSize(window.innerWidth, window.innerHeight);
  activeScene?.resize(window.innerWidth, window.innerHeight);
  worldMap?.resize(window.innerWidth, window.innerHeight);
}
function frame(now) {
  const raw = previous === null ? 0 : (now - previous) / 1000, dt = Math.min(raw, .1);
  if (previous === null) graceUntil = visualTime + 3; // skip shader warm-up and tab returns
  previous = now; visualTime += dt;
  if (!activeScene) return;
  if (state === 'worldmap') { worldMap.update(dt); renderer.render(worldMap.scene, worldMap.camera); if (fpsMeter) meter(raw); return; }
  if (state === 'playing') {
    elapsed = Math.min(elapsed + dt * PLAYBACK_RATE, DURATION);
    activeScene.update(elapsed, false, visualTime);
    vignette.style.opacity = String(1 - THREE.MathUtils.smoothstep(elapsed, 8, 15));
    const beat = beatAt(elapsed);
    if (beat !== currentBeat) {
      currentBeat = beat; showDialogue(beat, player);
    }
    $('progress-fill').style.width = `${(elapsed - START_TIME) / (DURATION - START_TIME) * 100}%`;
    if (elapsed >= DURATION) { finish(); return; }
  }
  if (state === 'heaven' || state === 'farm') { activeScene.update(dt, visualTime); watchFrame(raw); }
  if (state === 'selection') {
    activeScene.update(visualTime);
    const { fx, fy, fw, fb } = activeScene.anchor(window.innerWidth, window.innerHeight), focus = $('selection').style;
    focus.setProperty('--fx', `${fx}px`); focus.setProperty('--fy', `${fy}px`); focus.setProperty('--fw', `${fw}px`); focus.setProperty('--fb', `${fb}px`);
  }
  renderer.render(activeScene.scene, activeScene.camera);
  if (fpsMeter) meter(raw);
}
function fail(error) {
  state = 'error'; renderer?.setAnimationLoop(null);
  showControls(false);
  document.body.classList.remove('booting');
  $('loading').hidden = true; $('selection').hidden = true;
  $('scene-transition').hidden = true;
  $('error').hidden = false;
  // Friendly line + two ways out; the raw message stays one tap away for bug reports.
  const title = document.createElement('strong'), text = document.createElement('p'), actions = document.createElement('div');
  title.textContent = t('app.error.title');
  text.textContent = t('app.error.text');
  const action = (label, style, run) => { const button = document.createElement('button'); button.type = 'button'; button.className = `ui-btn ${style}`; button.textContent = label; button.addEventListener('click', run); return button; };
  actions.className = 'error-actions';
  actions.append(action(t('app.error.reload'), 'ui-btn--go', () => location.reload()), action(t('app.error.lowGraphics'), 'ui-btn--plain', () => { saveSettings({ ...readSettings(), quality: 'low' }); location.reload(); }),
    // A damaged save can fail on every load; resetProgress keeps a backup copy of the old run.
    action(t('app.error.restart'), 'ui-btn--plain', event => {
      // Two taps, like the settings reset: the first only asks.
      const button = event.currentTarget;
      if (!button.dataset.armed) { button.dataset.armed = '1'; button.textContent = t('app.error.restartConfirm'); return; }
      if (resetProgress()) location.reload(); else button.textContent = t('app.error.restartFailed');
    }));
  const details = document.createElement('details'), summary = document.createElement('summary'), code = document.createElement('code');
  summary.textContent = t('app.error.details'); code.textContent = error.message; details.append(summary, code);
  $('error').replaceChildren(title, text, actions, details);
}
async function initialize() {
  try {
    // High-DPR phones already look sharp at pixel ratio 1.25–1.5, so skip MSAA there.
    const denseTouch = matchMedia('(pointer: coarse)').matches && (window.devicePixelRatio || 1) >= 2;
    renderer = new THREE.WebGLRenderer({ antialias: !denseTouch, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    events.signal.addEventListener('abort', onQuality(() => applyRendererQuality(renderer, activeScene?.scene, worldMap?.scene)), { once: true });
    mountSettings({ onOpen: () => activeScene?.clearInput?.() }); // sau onQuality để mức đã lưu áp vào renderer
    // Mất ngữ cảnh GPU (thiếu RAM/tab nền trên điện thoại): preventDefault để trình duyệt được phép khôi phục, hạ đồ họa cho lần dựng lại.
    let contextLost = false;
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLost = true; setQuality('low');
      showLoading(0, ''); $('load-status').textContent = t('app.gpu.lost');
    }, listenerOptions);
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      if (!contextLost) return;
      contextLost = false; resize();
      if (!['transition', 'loading'].includes(state)) hideLoading();
    }, listenerOptions);
    $('game').append(renderer.domElement); resize(); loading(20, t('app.loading.initGraphics'));
    const saved = readProgress();
    if (saved.heaven?.completed || saved.farm) {
      document.body.classList.remove('booting');
      track('game_started', { resumed: true, screen: 'farm' });
      await enterFarm(saved.startingGift || saved.heaven?.gift, correctQuestionIds(saved.heaven), saved.startingRegion, answeredQuestionIds(saved.heaven)); return;
    }
    if (saved.introCompleted) {
      document.body.classList.remove('booting');
      track('game_started', { resumed: true, screen: 'heaven' });
      await enterHeaven(); return;
    }
    const { createSelection } = await import('../features/selection/scene.js');
    loading(45, t('app.loading.characters'));
    activeScene = await createSelection(player.gender, showGender, progress => {
      if (progress.total > 0) loading(45 + Math.round(progress.loaded / progress.total * 35), t('app.loading.characters'));
    });
    resize();
    loading(85, t('app.loading.prepareSelection'));
    await renderer.compileAsync(activeScene.scene, activeScene.camera);
    showGender(player.gender);
    $('loading').hidden = true; $('selection').hidden = false; resize(); // bảng đã hiện mới đo được để canh nhân vật
    document.body.classList.remove('booting');
    $('game').setAttribute('aria-label', t('selection.ariaLabel'));
    state = 'selection'; previous = null;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { fail(error); }
}
async function enterIntro(event) {
  event.preventDefault();
  if (state !== 'selection') return;
  state = 'transition';
  track('play_clicked');
  track('game_started', { resumed: false, screen: 'intro' });
  player.name = randomName(player.gender) || DEFAULT_NAME; // không còn ô nhập tên: lấy tên ngẫu nhiên theo ngôn ngữ + giới tính
  savePlayer({ gender: player.gender, name: player.name });
  $('selection').hidden = true; $('loading').hidden = false; loading(60, t('app.loading.prepareLevel'));
  try {
    const { createIntro } = await import('../features/intro/scene.js');
    const selection = activeScene, character = selection.takePlayer();
    selection.dispose(); releaseModels('selection/'); // stage/backdrop chỉ dùng ở màn chọn
    renderer.toneMappingExposure = 1.15;
    activeScene = createIntro(player, character); resize();
    await attachModels(activeScene, INTRO_MODELS);
    loading(85, t('app.loading.prepareLevel'));
    await renderer.compileAsync(activeScene.scene, activeScene.camera);
    loading(100, t('app.loading.ready'));
    activeScene.update(START_TIME);
    $('game').setAttribute('aria-label', t('intro.ariaLabel', { name: player.name }));
    $('loading').hidden = true; $('selection').hidden = true;
    document.body.classList.remove('booting');
    start();
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { fail(error); }
}
$('player-form').addEventListener('submit', enterIntro, listenerOptions);
// Nam đứng bên trái, nữ bên phải: chỉ hiện mũi tên hướng về người còn lại.
function showGender(gender) {
  player.gender = gender;
  document.querySelector('.selection-arrow--prev').hidden = gender === 'male';
  document.querySelector('.selection-arrow--next').hidden = gender === 'female';
}
for (const button of document.querySelectorAll('.selection-arrow')) button.addEventListener('click', () => activeScene.select(player.gender === 'female' ? 'male' : 'female'), listenerOptions);
// Selection gestures: tap picks a model, horizontal swipe switches, vertical drag turns the focused model.
let swipe = null;
$('game').addEventListener('pointerdown', event => {
  if (state !== 'selection' || !event.target.matches('canvas')) return;
  swipe = { x: event.clientX, y: event.clientY, axis: null, id: event.pointerId };
  event.target.setPointerCapture(event.pointerId); activeScene.beginDrag();
}, listenerOptions);
$('game').addEventListener('pointermove', event => {
  if (state !== 'selection' || swipe?.id !== event.pointerId) return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  if (!swipe.axis && Math.hypot(dx, dy) > 8) swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  if (swipe.axis === 'x') activeScene.drag(dx / (window.innerWidth * .4));
  else if (swipe.axis === 'y') activeScene.rotate(dy);
}, listenerOptions);
for (const type of ['pointerup', 'pointercancel']) $('game').addEventListener(type, event => {
  if (state !== 'selection' || swipe?.id !== event.pointerId) return;
  if (type === 'pointercancel') activeScene.endDrag(true);
  else if (swipe.axis) activeScene.endDrag();
  else activeScene.pick(event.clientX, event.clientY, event.target.getBoundingClientRect());
  swipe = null;
}, listenerOptions);
$('skip').addEventListener('click', finish, listenerOptions);
$('dialogue-next').addEventListener('click', nextDialogue, listenerOptions);
document.addEventListener('click', event => {
  if (state !== 'playing' || event.target.closest('#skip, #game-settings-toggle, #game-settings')) return;
  event.preventDefault(); event.stopPropagation(); nextDialogue();
}, { capture: true, signal: events.signal });
window.addEventListener('resize', () => { if (renderer) resize(); }, listenerOptions);
document.addEventListener('visibilitychange', () => {
  previous = null;
  if (document.hidden) activeScene?.clearInput?.();
  renderer?.setAnimationLoop(document.hidden || ['error', 'loading'].includes(state) ? null : frame);
}, listenerOptions);
window.addEventListener('keydown', event => {
  if (state === 'worldmap') { worldMap.handleKeyDown(event); return; }
  if (state === 'heaven' || state === 'farm') { activeScene.handleKeyDown(event); return; }
  if (state === 'selection' && ['ArrowLeft', 'ArrowRight'].includes(event.code) && !event.target.closest('input')) {
    activeScene.select(event.code === 'ArrowLeft' ? 'male' : 'female');
  }
  if (event.code === 'Enter' && !event.repeat && state === 'playing' && !event.target.closest('button, input, select, textarea')) {
    event.preventDefault(); nextDialogue();
  }
}, listenerOptions);
window.addEventListener('keyup', event => { if (state === 'worldmap') worldMap.handleKeyUp(event); else activeScene?.handleKeyUp?.(event); }, listenerOptions);
window.addEventListener('blur', () => { previous = null; activeScene?.clearInput?.(); worldMap?.clearInput(); }, listenerOptions);
if (import.meta.hot) import.meta.hot.dispose(() => {
  events.abort();
  renderer?.setAnimationLoop(null); worldMap?.dispose(); activeScene?.dispose(); renderer?.dispose();
});
export function startGame() {
  initialize();
}
