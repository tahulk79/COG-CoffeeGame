import * as THREE from 'three';
import { beatAt, START_TIME, DURATION, PLAYBACK_RATE, nextDialogueTime } from '../features/intro/timeline.js';
import { showDialogue } from '../ui/dialogue.js';
import { completeIntro, readPlayer, readProgress, savePlayer } from '../state/progress.js';
import { DEFAULT_NAME, randomName } from '../state/names.js';
import { applyRendererQuality, onQuality } from '../shared/vfx/index.js';
import { mountSettings } from '../ui/settings.js';
import { attachModels } from '../shared/three/models.js';

const INTRO_MODELS = {
  'intro/reaper': 'heaven/reaper.glb',
  'intro/ambulance': 'intro/ambulance.glb',
  'intro/bicycle': 'intro/bicycle.glb',
  'intro/street/trees': 'intro/trees.glb',
  'intro/street/shops': 'intro/shops.glb',
  'intro/heaven/gate/frame': 'intro/sky-gate.glb#sky_frame',
  'intro/heaven/gate/left-leaf': 'intro/sky-gate.glb#sky_left_leaf',
  'intro/heaven/gate/right-leaf': 'intro/sky-gate.glb#sky_right_leaf',
};

const $ = id => document.getElementById(id);
const vignette = document.querySelector('.vignette');
const player = readPlayer();
const events = new AbortController();
const listenerOptions = { signal: events.signal };
let renderer;
let activeScene;
let elapsed = 0;
let previous = null;
let state = 'loading';
let currentBeat = null;
let visualTime = 0;
function showControls(playing) {
  for (const id of ['intro-controls', 'caption-box', 'progress']) $(id).hidden = !playing;
}
function nextDialogue() {
  if (state === 'heaven') { activeScene.nextDialogue(); return; }
  if (state !== 'playing') return;
  elapsed = nextDialogueTime(elapsed);
  if (elapsed >= DURATION) finish();
}
async function enterFarm(gift) {
  state = 'transition'; previous = null; showControls(false);
  $('loading').hidden = false; loading(40, 'Trùng sinh · trở về nông trại');
  let nextScene;
  try {
    const { createFarmGame } = await import('../features/farm/game.js');
    nextScene = await createFarmGame(player, gift);
    nextScene.resize(window.innerWidth, window.innerHeight);
    loading(85, 'Chuẩn bị nông trại');
    await renderer.compileAsync(nextScene.scene, nextScene.camera);
    activeScene?.dispose(); activeScene = nextScene;
    activeScene.activate(); state = 'farm'; previous = null;
    vignette.style.opacity = '0'; $('loading').hidden = true;
    $('game').setAttribute('aria-label', 'Nông trại cà phê — Gameplay chính');
    document.title = 'COG — Nông trại cà phê';
    $('game').focus({ preventScroll: true });
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { nextScene?.dispose(); fail(error); }
}
async function enterHeaven() {
  state = 'transition'; previous = null; showControls(false);
  $('loading').hidden = false; loading(40, 'Mở quảng trường thiên đàng');
  renderer.toneMappingExposure = 1.05;
  let nextScene;
  try {
    const { createHeavenGame } = await import('../features/heaven/game.js');
    nextScene = await createHeavenGame(player, gift => { void enterFarm(gift); });
    nextScene.resize(window.innerWidth, window.innerHeight);
    loading(85, 'Chuẩn bị màn chơi');
    await renderer.compileAsync(nextScene.scene, nextScene.camera);
    activeScene?.dispose(); activeScene = nextScene;
    state = 'heaven'; previous = null;
    vignette.style.opacity = '0'; $('loading').hidden = true;
    $('game').setAttribute('aria-label', 'Thiên đàng — Hội đồng trùng sinh');
    document.title = 'COG — Hội đồng trùng sinh';
    if ($('heaven-ending').hidden) $('game').focus({ preventScroll: true });
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { nextScene?.dispose(); fail(error); }
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
  applyRendererQuality(renderer, activeScene?.scene);
  renderer.setSize(window.innerWidth, window.innerHeight);
  activeScene?.resize(window.innerWidth, window.innerHeight);
}
function frame(now) {
  const dt = previous === null ? 0 : Math.min((now - previous) / 1000, .1);
  previous = now; visualTime += dt;
  if (!activeScene) return;
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
  if (state === 'heaven' || state === 'farm') activeScene.update(dt, visualTime);
  if (state === 'selection') activeScene.update(visualTime);
  renderer.render(activeScene.scene, activeScene.camera);
}
function fail(error) {
  state = 'error'; renderer?.setAnimationLoop(null);
  showControls(false);
  document.body.classList.remove('booting');
  $('loading').hidden = true; $('selection').hidden = true;
  $('scene-transition').hidden = true;
  $('error').hidden = false;
  $('error').textContent = 'Không thể chuẩn bị cảnh 3D. Hãy tải lại trang và kiểm tra tăng tốc đồ họa của trình duyệt. ' + error.message;
}
function loading(value, label) {
  $('load-fill').style.width = `${value}%`;
  $('load-track').setAttribute('aria-valuenow', value);
  $('load-status').textContent = `${label} · ${value}%`;
}
async function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    events.signal.addEventListener('abort', onQuality(() => applyRendererQuality(renderer, activeScene?.scene)), { once: true });
    mountSettings({ onOpen: () => activeScene?.clearInput?.() }); // sau onQuality để mức đã lưu áp vào renderer
    $('game').append(renderer.domElement); resize(); loading(20, 'Khởi tạo đồ họa');
    const saved = readProgress();
    if (saved.heaven?.completed || saved.farm) {
      document.body.classList.remove('booting');
      await enterFarm(saved.startingGift || saved.heaven?.gift); return;
    }
    if (saved.introCompleted) {
      document.body.classList.remove('booting');
      await enterHeaven(); return;
    }
    const { createSelection } = await import('../features/selection/scene.js');
    loading(45, 'Tải nhân vật');
    activeScene = await createSelection(player.gender, showGender, progress => {
      if (progress.total > 0) loading(45 + Math.round(progress.loaded / progress.total * 35), 'Tải nhân vật');
    });
    resize();
    loading(85, 'Chuẩn bị màn chọn');
    await renderer.compileAsync(activeScene.scene, activeScene.camera);
    $('player-name').value = player.name; showGender(player.gender);
    $('loading').hidden = true; $('selection').hidden = false;
    document.body.classList.remove('booting');
    $('game').setAttribute('aria-label', 'Chọn nhân vật');
    state = 'selection'; previous = null;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { fail(error); }
}
async function enterIntro(event) {
  event.preventDefault();
  if (state !== 'selection') return;
  state = 'transition';
  player.name = $('player-name').value.trim().slice(0, 20) || DEFAULT_NAME;
  savePlayer({ gender: player.gender, name: player.name });
  $('selection').hidden = true; $('loading').hidden = false; loading(60, 'Chuẩn bị màn chơi');
  try {
    const { createIntro } = await import('../features/intro/scene.js');
    const selection = activeScene, character = selection.takePlayer();
    selection.dispose();
    renderer.toneMappingExposure = 1.15;
    activeScene = createIntro(player, character); resize();
    await attachModels(activeScene, INTRO_MODELS);
    loading(85, 'Chuẩn bị màn chơi');
    await renderer.compileAsync(activeScene.scene, activeScene.camera);
    loading(100, 'Sẵn sàng');
    activeScene.update(START_TIME);
    $('game').setAttribute('aria-label', `Màn 1 — ${player.name}`);
    $('loading').hidden = true; $('selection').hidden = true;
    document.body.classList.remove('booting');
    start();
    renderer.setAnimationLoop(document.hidden ? null : frame);
  } catch (error) { fail(error); }
}
$('player-form').addEventListener('submit', enterIntro, listenerOptions);
function showGender(gender) {
  player.gender = gender;
  for (const button of document.querySelectorAll('.gender-switch button')) button.setAttribute('aria-pressed', button.dataset.gender === gender);
}
for (const button of document.querySelectorAll('.gender-switch button')) button.addEventListener('click', () => activeScene.select(button.dataset.gender), listenerOptions);
$('random-name').addEventListener('click', () => { $('player-name').value = randomName($('player-name').value); }, listenerOptions);
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
  if (state === 'heaven' || state === 'farm') { activeScene.handleKeyDown(event); return; }
  if (state === 'selection' && ['ArrowLeft', 'ArrowRight'].includes(event.code) && !event.target.closest('input')) {
    activeScene.select(event.code === 'ArrowLeft' ? 'male' : 'female');
  }
  if (event.code === 'Enter' && !event.repeat && state === 'playing' && !event.target.closest('button, input, select, textarea')) {
    event.preventDefault(); nextDialogue();
  }
}, listenerOptions);
window.addEventListener('keyup', event => { activeScene?.handleKeyUp?.(event); }, listenerOptions);
window.addEventListener('blur', () => { previous = null; activeScene?.clearInput?.(); }, listenerOptions);
if (import.meta.hot) import.meta.hot.dispose(() => {
  events.abort();
  renderer?.setAnimationLoop(null); activeScene?.dispose(); renderer?.dispose();
});
export function startGame() {
  initialize();
}
