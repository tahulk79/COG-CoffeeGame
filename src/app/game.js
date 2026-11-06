// App shell (Farm & Café V3): one renderer, one store, and a phase state machine driven by store.state.story.phase
// (docs/design/v3-architecture.md "Story phases"): select → intro → teacher → gate (atlas) → play → expiry → chooseRegion (atlas) → play.
// Every phase resumes after a reload. The old farm/café/heaven modules are no longer imported here.
import * as THREE from 'three';
import { beatAt, START_TIME, DURATION, PLAYBACK_RATE, nextDialogueTime } from '../features/intro/timeline.js';
import { showDialogue, usesTouch } from '../ui/dialogue.js';
import { readPlayer, readSettings, resetProgress, savePlayer, saveSettings } from '../state/progress.js';
import { DEFAULT_NAME, randomName } from '../state/names.js';
import { applyRendererQuality, getQuality, onQuality, setQuality } from '../shared/vfx/index.js';
import { lowerQuality, mountSettings, openSettings, closeSettings } from '../ui/settings.js';
import { attachModels, releaseModels } from '../shared/three/models.js';
import { loading, showLoading, hideLoading } from '../ui/loading.js';
import { getLang, hasKey, t } from '../i18n/index.js';
import { sfx } from '../shared/audio/index.js';
import { detectPlatform, initAnalytics, track } from '../shared/analytics/wire.js';
import { createStore } from '../core/store.js';
import { START, EXPIRY_LEVEL } from '../core/config/economy.js';
import { loadPlayer, playerModel } from '../characters/load-player.js';
import { V3_KEY, PROGRESS_KEY, PLAYER_KEY, DEV_PROFILE } from '../state/storage-keys.js';
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

// ---------- store (created once) + analytics ----------
const store = createStore({ key: V3_KEY, legacyKeys: { progress: PROGRESS_KEY, player: PLAYER_KEY }, dev: DEV_PROFILE });
const legacyPlayer = readPlayer();
// The character in the V3 save wins; the v1 player key is only a default for the selection screen.
const profile = { gender: store.state.character?.gender ?? legacyPlayer.gender, name: store.state.character?.name || legacyPlayer.name || DEFAULT_NAME };
const countryOf = regionId => (typeof regionId === 'string' ? regionId.slice(0, 2) : null);
initAnalytics({
  appVersion: pkg.version, platform: detectPlatform(Math.min(window.innerWidth, window.innerHeight), usesTouch()),
  locale: getLang(), region: () => countryOf(store.state.world.currentRegion) || store.state.world.startCountry, enabled: readSettings().analytics && !DEV_PROFILE,
});
track('landing_viewed', { first_visit: store.state.story.phase === 'select' });

const events = new AbortController();
const listenerOptions = { signal: events.signal };
let renderer;
// mode = what is on screen: loading | selection | intro | teacher | atlas | play | transition | error
let mode = 'loading';
let active = null;   // selection / intro / teacher scene object
let atlas = null;    // world atlas (gate, chooseRegion, or opened over the realm in play)
let realm = null, hud = null, hudModule = null;
let previous = null, visualTime = 0;
let elapsed = 0, currentBeat = null; // intro timeline
let expiryRunning = false;

// Frame monitor: if gameplay stays under ~25 fps for 2 s, step quality down once and wait before judging again.
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

// ---------- small helpers ----------
const startLoop = () => { previous = null; renderer.setAnimationLoop(document.hidden ? null : frame); };
const paint = () => new Promise(resolve => setTimeout(resolve, 30)); // let the loading screen paint before heavy sync work
function bootDone() { document.body.classList.remove('booting'); }
function present(titleKey, labelKey, labelParams) {
  document.title = t(titleKey);
  $('game').setAttribute('aria-label', t(labelKey, labelParams));
}
// The old floating gear is hidden while the HUD shows its own.
const showGear = visible => { $('game-settings-toggle').hidden = !visible; };
function showIntroControls(playing) {
  for (const id of ['intro-controls', 'caption-box', 'progress']) $(id).hidden = !playing;
}
function disposeActive() { active?.dispose(); active = null; }
function disposeAtlas() { atlas?.dispose(); atlas = null; }
function disposePlay() { hud?.dispose(); hud = null; realm?.dispose(); realm = null; }
// Fallback when the HUD module does not export errorText.
function fallbackErrorText(result) {
  const code = result?.error || 'unknown';
  if (hasKey(`err.${code}`)) return t(`err.${code}`, result.data || {});
  if (code === 'coins') return t('story.err.coins', result.data || {});
  if (code === 'round') return t('story.err.round');
  return t('story.err.generic');
}
const errorText = result => (typeof hudModule?.errorText === 'function' ? hudModule.errorText(result) : fallbackErrorText(result));
const QUIET_ACTIONS = new Set(['shop/spawnCustomer', 'shop/customerLeft']);
const expiryLines = () => [1, 2, 3, 4].map(n => t(`story.expiry.line${n}`).replace(/\*\*/g, ''));
// Fire-and-forget realm cinematic; input stays usable afterwards.
function cinematic(name) {
  if (!realm || mode !== 'play') return;
  try { Promise.resolve(realm.cinematic(name)).catch(error => console.warn(`cinematic ${name}`, error)); } catch (error) { console.warn(`cinematic ${name}`, error); }
}

// ---------- phase router ----------
async function route() {
  const { phase } = store.state.story;
  if (phase === 'select' || !store.state.character) return enterSelection();
  if (phase === 'intro') return startIntro(null);
  if (phase === 'teacher') return enterTeacher();
  if (phase === 'gate') return openAtlas('gate');
  if (phase === 'chooseRegion') return openAtlas('chooseRegion');
  // play / expiry need a current region; a save without one goes back to the atlas.
  if (!store.state.world.currentRegion) {
    // An 'expiry' save without a region would leave world/enterRegion refusing ('phase'): finish the expiry first.
    if (phase === 'expiry') store.dispatch('expiry/execute');
    return openAtlas(phase === 'expiry' ? 'chooseRegion' : 'gate');
  }
  return enterPlay();
}

// ---------- select ----------
async function enterSelection() {
  mode = 'transition';
  const { createSelection } = await import('../features/selection/scene.js');
  showLoading(45, t('story.loading.characters'));
  active = await createSelection(profile.gender, showGender, progress => {
    if (progress.total > 0) loading(45 + Math.round(progress.loaded / progress.total * 35), t('story.loading.characters'));
  });
  resize();
  loading(85, t('story.loading.prepareSelection'));
  await renderer.compileAsync(active.scene, active.camera);
  showGender(profile.gender);
  hideLoading(); $('selection').hidden = false; resize(); // the panel must be visible before the character can be framed
  bootDone(); showGear(true);
  present('story.title.select', 'selection.ariaLabel');
  mode = 'selection';
  startLoop();
}
// Male stands left, female right: only show the arrow pointing at the other one.
function showGender(gender) {
  profile.gender = gender;
  document.querySelector('.selection-arrow--prev').hidden = gender === 'male';
  document.querySelector('.selection-arrow--next').hidden = gender === 'female';
}
async function enterGame(event) {
  event.preventDefault();
  if (mode !== 'selection') return;
  mode = 'transition';
  track('play_clicked');
  track('game_started', { resumed: false, screen: 'intro' });
  profile.name = randomName(profile.gender) || DEFAULT_NAME; // no name field: a random name for the language + gender
  savePlayer({ gender: profile.gender, name: profile.name }); // v1 key kept for compatibility
  store.dispatch('character/set', { gender: profile.gender, name: profile.name });
  $('selection').hidden = true;
  try {
    const selection = active, character = selection.takePlayer();
    selection.dispose(); active = null; releaseModels('selection/'); // stage/backdrop are only used on this screen
    await startIntro(character);
  } catch (error) { fail(error); }
}

// ---------- intro (replayed from the start after a reload) ----------
async function startIntro(character) {
  mode = 'transition';
  showLoading(60, t('story.loading.intro'));
  const { createIntro } = await import('../features/intro/scene.js');
  character ??= await loadPlayer(playerModel(profile.gender));
  renderer.toneMappingExposure = 1.15;
  active = createIntro(profile, character); resize();
  await attachModels(active, INTRO_MODELS);
  loading(85, t('story.loading.intro'));
  await renderer.compileAsync(active.scene, active.camera);
  loading(100, t('story.loading.ready'));
  active.update(START_TIME);
  present('story.title.intro', 'intro.ariaLabel', { name: profile.name });
  hideLoading(); $('selection').hidden = true; bootDone(); showGear(true);
  elapsed = START_TIME; currentBeat = null; mode = 'intro';
  showIntroControls(true); $('caption-box').hidden = true; $('dialogue-next').disabled = false;
  $('game').focus({ preventScroll: true });
  startLoop();
}
function nextDialogue() {
  if (mode !== 'intro') return;
  elapsed = nextDialogueTime(elapsed);
  if (elapsed >= DURATION) finishIntro();
}
function finishIntro() {
  if (mode !== 'intro') return;
  elapsed = DURATION;
  showIntroControls(false); vignette.style.opacity = '0';
  store.dispatch('story/introDone');
  enterTeacher().catch(fail);
}

// ---------- teacher ----------
async function enterTeacher() {
  mode = 'transition';
  showLoading(40, t('story.loading.teacher'));
  const [{ createTeacher }, character] = await Promise.all([import('../features/teacher/index.js'), loadPlayer(playerModel(profile.gender))]);
  const teacher = await createTeacher({
    character, name: profile.name, credits: START.rebirthCredits, level: EXPIRY_LEVEL,
    onCredits: () => store.dispatch('story/teacherDone'),
    onDone: () => { openAtlas('gate').catch(fail); },
  });
  disposeActive(); releaseModels('intro/'); // intro GLBs are only used by the intro
  active = teacher;
  renderer.toneMappingExposure = 1;
  resize();
  loading(85, t('story.loading.teacher'));
  await renderer.compileAsync(active.scene, active.camera);
  hideLoading(); bootDone(); showGear(true); vignette.style.opacity = '0';
  present('story.title.teacher', 'story.label.teacher');
  mode = 'teacher';
  startLoop();
  teacher.start().catch(fail);
}

// ---------- atlas (gate / chooseRegion / play) ----------
let atlasOpening = false; // guards against a second atlas being created while the first one is still loading
async function openAtlas(atlasMode) {
  if (atlas) { atlas.setMode(atlasMode); return; }
  if (atlasOpening || (mode === 'transition' && atlasMode === 'play')) return;
  atlasOpening = true;
  try { await buildAtlas(atlasMode); } finally { atlasOpening = false; }
}
async function buildAtlas(atlasMode) {
  const overRealm = atlasMode === 'play' && realm;
  mode = 'transition';
  if (overRealm) {
    // The realm stays loaded underneath (not rendered); the HUD is rebuilt when the atlas closes.
    realm.setInputLocked(true); realm.clearInput?.(); realm.select(null); hud?.dispose(); hud = null;
  } else { disposeActive(); disposePlay(); }
  showLoading(50, t('story.loading.atlas'));
  await paint();
  const { createAtlas } = await import('../features/atlas/index.js');
  atlas = createAtlas({ store, mode: atlasMode, onEntered: enteredRegion, onClose: closeAtlas });
  renderer.toneMappingExposure = .95;
  resize();
  await renderer.compileAsync(atlas.scene, atlas.camera);
  hideLoading(); bootDone(); showGear(true);
  present('story.title.atlas', 'story.label.atlas');
  mode = 'atlas';
  startLoop();
}
// Closing is only offered in play mode (back to the same realm).
function closeAtlas() {
  if (mode !== 'atlas' || atlas?.mode !== 'play') return;
  disposeAtlas();
  if (!realm) { route().catch(fail); return; }
  createPlayHud();
  realm.setInputLocked(false);
  showGear(false); present('story.title.play', 'story.label.play');
  mode = 'play'; previous = null;
  if (store.state.story.phase === 'expiry') runExpiry().catch(fail); // triggered while the map was open
}
function enteredRegion(regionId, result) {
  const changed = result.events?.some(e => e.type === 'regionEntered');
  if (changed) track('region_entered', { region: regionId, first_visit: result.events.some(e => e.type === 'regionFirstVisit') });
  if (!changed && realm) { closeAtlas(); return; }
  disposeAtlas();
  enterPlay().catch(fail);
}

// ---------- play (realm + HUD) ----------
function createPlayHud() {
  hud = hudModule.createHud({ store, realm, dev: DEV_PROFILE, onOpenAtlas: () => { openAtlas('play').catch(fail); }, onOpenSettings: openSettings });
}
// The realm plays its own 'arrive' swoop on load / region change (and skips it while the expiry cinematic runs).
async function enterPlay() {
  mode = 'transition';
  disposeActive(); disposeAtlas(); disposePlay();
  showLoading(40, t('story.loading.realm'));
  const [{ createRealm }, hudMod] = await Promise.all([import('../features/realm/index.js'), import('../features/hud/index.js')]);
  hudModule = hudMod;
  renderer.toneMappingExposure = .95;
  const hooks = {
    onSelect: target => hud?.setSelection(target),
    // Customer spawn / patience run on a timer: their failures are not the player's doing, so stay silent.
    onResult: (actionType, result) => {
      if (!result || result.ok || QUIET_ACTIONS.has(actionType)) return;
      hud?.toast(errorText(result), 'bad'); sfx('ui.deny');
    },
    onWalkToGate: () => { if (mode === 'play') openAtlas('play').catch(fail); },
  };
  realm = await createRealm({ renderer, store, gender: profile.gender, hooks });
  realm.resize(window.innerWidth, window.innerHeight);
  loading(85, t('story.loading.realm'));
  await renderer.compileAsync(realm.scene, realm.camera);
  createPlayHud();
  hideLoading(); bootDone(); showGear(false); vignette.style.opacity = '0';
  present('story.title.play', 'story.label.play');
  mode = 'play';
  $('game').focus({ preventScroll: true });
  startLoop();
  if (store.state.story.phase === 'expiry') runExpiry().catch(fail);
}

// ---------- Level 10 expiry (safe at any reload point: pending → cinematic + execute; reset → atlas) ----------
async function runExpiry() {
  if (expiryRunning || !realm || store.state.story.phase !== 'expiry') return;
  expiryRunning = true;
  const regionId = store.state.story.expiry?.regionId;
  try {
    realm.setInputLocked(true); realm.cancelPlacement(); realm.select(null); // select(null) also clears the HUD via onSelect
    try { await realm.cinematic('expiry'); } catch (error) { console.warn('expiry cinematic', error); }
    try { await hud?.dialogue(expiryLines()); } catch (error) { console.warn('expiry dialogue', error); }
    const result = store.dispatch('expiry/execute');
    if (result.ok && !result.noop) track('region_expired', { region: regionId || 'none' });
  } finally { expiryRunning = false; }
  if (store.state.story.phase === 'chooseRegion') await openAtlas('chooseRegion');
  else realm?.setInputLocked(false);
}

const unsubscribeStory = store.subscribe((state, evts) => {
  for (const e of evts || []) {
    if (e.type === 'expiryTriggered' && mode === 'play') setTimeout(() => runExpiry().catch(fail)); // after the current dispatch returns
    else if (e.type === 'roundUnlocked') { track('round_unlocked', { round: e.round }); cinematic('round'); }
    else if (e.type === 'regionUnlocked') track('region_selected', { region: e.regionId, cost: e.cost });
    else if (e.type === 'reborn') { track('rebirth_used', { blessing: e.blessing }); cinematic('rebirth'); }
  }
});

// ---------- render loop ----------
function resize() {
  applyRendererQuality(renderer, active?.scene, atlas?.scene, realm?.scene);
  renderer.setSize(window.innerWidth, window.innerHeight);
  active?.resize(window.innerWidth, window.innerHeight);
  atlas?.resize(window.innerWidth, window.innerHeight);
  realm?.resize(window.innerWidth, window.innerHeight);
}
function frame(now) {
  const raw = previous === null ? 0 : (now - previous) / 1000, dt = Math.min(raw, .1);
  if (previous === null) graceUntil = visualTime + 3; // skip shader warm-up and tab returns
  previous = now; visualTime += dt;
  if (mode === 'selection' && active) {
    active.update(visualTime);
    const { fx, fy, fw, fb } = active.anchor(window.innerWidth, window.innerHeight), focus = $('selection').style;
    focus.setProperty('--fx', `${fx}px`); focus.setProperty('--fy', `${fy}px`); focus.setProperty('--fw', `${fw}px`); focus.setProperty('--fb', `${fb}px`);
    renderer.render(active.scene, active.camera);
  } else if (mode === 'intro' && active) {
    elapsed = Math.min(elapsed + dt * PLAYBACK_RATE, DURATION);
    active.update(elapsed, false, visualTime);
    vignette.style.opacity = String(1 - THREE.MathUtils.smoothstep(elapsed, 8, 15));
    const beat = beatAt(elapsed);
    if (beat !== currentBeat) { currentBeat = beat; showDialogue(beat, profile); }
    $('progress-fill').style.width = `${(elapsed - START_TIME) / (DURATION - START_TIME) * 100}%`;
    renderer.render(active.scene, active.camera);
    if (elapsed >= DURATION) finishIntro();
  } else if (mode === 'teacher' && active) {
    active.update(dt, visualTime);
    renderer.render(active.scene, active.camera);
  } else if (mode === 'atlas' && atlas) {
    atlas.update(dt);
    renderer.render(atlas.scene, atlas.camera);
  } else if (mode === 'play' && realm) {
    realm.update(dt, visualTime);
    hud?.update(dt);
    watchFrame(raw);
    renderer.render(realm.scene, realm.camera);
  }
  if (fpsMeter) meter(raw);
}

// ---------- errors ----------
// Wipes the V3 save and persists a fresh one, so the next load does not re-migrate the old v1 keys.
function resetV3() {
  mode = 'transition';
  store.reset();
  store.dispatch('story/seen', { key: 'restart' });
}
function fail(error) {
  console.error(error);
  mode = 'error'; renderer?.setAnimationLoop(null);
  showIntroControls(false);
  bootDone();
  $('loading').hidden = true; $('selection').hidden = true;
  $('scene-transition').hidden = true;
  $('error').hidden = false;
  // Friendly line + ways out; the raw message stays one tap away for bug reports.
  const title = document.createElement('strong'), text = document.createElement('p'), actions = document.createElement('div');
  title.textContent = t('app.error.title');
  text.textContent = t('app.error.text');
  const action = (label, style, run) => { const button = document.createElement('button'); button.type = 'button'; button.className = `ui-btn ${style}`; button.textContent = label; button.addEventListener('click', run); return button; };
  actions.className = 'error-actions';
  actions.append(action(t('app.error.reload'), 'ui-btn--go', () => location.reload()), action(t('app.error.lowGraphics'), 'ui-btn--plain', () => { saveSettings({ ...readSettings(), quality: 'low' }); location.reload(); }),
    // A damaged save can fail on every load; both resets keep a backup copy of the old run.
    action(t('app.error.restart'), 'ui-btn--plain', event => {
      const button = event.currentTarget; // two taps: the first only asks
      if (!button.dataset.armed) { button.dataset.armed = '1'; button.textContent = t('app.error.restartConfirm'); return; }
      if (!resetProgress()) { button.textContent = t('app.error.restartFailed'); return; }
      resetV3(); location.reload();
    }));
  const details = document.createElement('details'), summary = document.createElement('summary'), code = document.createElement('code');
  summary.textContent = t('app.error.details'); code.textContent = String(error?.message ?? error); details.append(summary, code);
  $('error').replaceChildren(title, text, actions, details);
}

// ---------- boot ----------
async function initialize() {
  try {
    // High-DPR phones already look sharp at pixel ratio 1.25–1.5, so skip MSAA there.
    const denseTouch = matchMedia('(pointer: coarse)').matches && (window.devicePixelRatio || 1) >= 2;
    renderer = new THREE.WebGLRenderer({ antialias: !denseTouch, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    events.signal.addEventListener('abort', onQuality(() => applyRendererQuality(renderer, active?.scene, atlas?.scene, realm?.scene)), { once: true });
    // After onQuality so the saved level is applied to the renderer.
    mountSettings({
      onOpen: () => { realm?.clearInput?.(); atlas?.clearInput(); },
      onReset: resetV3,
      canReset: () => store.state.story.phase !== 'select',
    });
    // GPU context lost (low memory / background tab on phones): preventDefault so the browser may restore it; lower quality for the rebuild.
    let contextLost = false;
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLost = true; setQuality('low');
      showLoading(0, ''); $('load-status').textContent = t('story.loading.gpuLost');
    }, listenerOptions);
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      if (!contextLost) return;
      contextLost = false; resize();
      if (!['transition', 'loading'].includes(mode)) hideLoading();
    }, listenerOptions);
    $('game').append(renderer.domElement); resize(); loading(20, t('story.loading.initGraphics'));
    const phase = store.state.story.phase;
    if (phase !== 'select') track('game_started', { resumed: true, screen: phase });
    await route();
  } catch (error) { fail(error); }
}

// ---------- input ----------
$('player-form').addEventListener('submit', enterGame, listenerOptions);
for (const button of document.querySelectorAll('.selection-arrow')) button.addEventListener('click', () => active?.select(profile.gender === 'female' ? 'male' : 'female'), listenerOptions);
// Selection gestures: tap picks a model, horizontal swipe switches, vertical drag turns the focused model.
let swipe = null;
$('game').addEventListener('pointerdown', event => {
  if (mode !== 'selection' || !event.target.matches('canvas')) return;
  swipe = { x: event.clientX, y: event.clientY, axis: null, id: event.pointerId };
  event.target.setPointerCapture(event.pointerId); active.beginDrag();
}, listenerOptions);
$('game').addEventListener('pointermove', event => {
  if (mode !== 'selection' || swipe?.id !== event.pointerId) return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  if (!swipe.axis && Math.hypot(dx, dy) > 8) swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  if (swipe.axis === 'x') active.drag(dx / (window.innerWidth * .4));
  else if (swipe.axis === 'y') active.rotate(dy);
}, listenerOptions);
for (const type of ['pointerup', 'pointercancel']) $('game').addEventListener(type, event => {
  if (mode !== 'selection' || swipe?.id !== event.pointerId) return;
  if (type === 'pointercancel') active.endDrag(true);
  else if (swipe.axis) active.endDrag();
  else active.pick(event.clientX, event.clientY, event.target.getBoundingClientRect());
  swipe = null;
}, listenerOptions);
$('skip').addEventListener('click', finishIntro, listenerOptions);
$('dialogue-next').addEventListener('click', nextDialogue, listenerOptions);
document.addEventListener('click', event => {
  if (mode !== 'intro' || event.target.closest('#skip, #game-settings-toggle, #game-settings')) return;
  event.preventDefault(); event.stopPropagation(); nextDialogue();
}, { capture: true, signal: events.signal });
window.addEventListener('resize', () => { if (renderer) resize(); }, listenerOptions);
document.addEventListener('visibilitychange', () => {
  previous = null;
  if (document.hidden) { realm?.clearInput?.(); atlas?.clearInput(); }
  renderer?.setAnimationLoop(document.hidden || ['error', 'loading'].includes(mode) ? null : frame);
}, listenerOptions);
window.addEventListener('keydown', event => {
  if (mode === 'atlas') { atlas.handleKeyDown(event); return; }
  if (mode === 'play') { realm.handleKeyDown(event); return; }
  if (mode === 'selection' && ['ArrowLeft', 'ArrowRight'].includes(event.code) && !event.target.closest('input')) {
    active.select(event.code === 'ArrowLeft' ? 'male' : 'female');
  }
  if (event.code === 'Enter' && !event.repeat && mode === 'intro' && !event.target.closest('button, input, select, textarea')) {
    event.preventDefault(); nextDialogue();
  }
}, listenerOptions);
window.addEventListener('keyup', event => {
  if (mode === 'atlas') atlas.handleKeyUp(event);
  else if (mode === 'play') realm.handleKeyUp(event);
}, listenerOptions);
window.addEventListener('blur', () => { previous = null; realm?.clearInput?.(); atlas?.clearInput(); }, listenerOptions);
if (import.meta.hot) import.meta.hot.dispose(() => {
  events.abort(); unsubscribeStory(); closeSettings();
  renderer?.setAnimationLoop(null); disposeAtlas(); disposePlay(); disposeActive(); renderer?.dispose();
});
// Dev QA hook (?profile=test): inspect the store from the console.
if (DEV_PROFILE) window.__godbeanStore = store;
export function startGame() {
  initialize();
}
