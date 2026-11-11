// App shell (Farm & Café V3): one renderer, one store, and a phase state machine driven by store.state.story.phase
// (docs/design/v3-architecture.md "Story phases"): select → intro → teacher → gate (atlas) → play → expiry → chooseRegion (atlas) → play.
// Every phase resumes after a reload. The old farm/café/heaven modules are no longer imported here.
import * as THREE from 'three';
import { beatAt, START_TIME, DURATION, PLAYBACK_RATE, nextDialogueTime } from '../features/intro/timeline.js';
import { showDialogue, usesTouch } from '../ui/dialogue.js';
import { readPlayer, readSettings, resetProgress, savePlayer, saveSettings } from '../state/progress.js';
import { DEFAULT_NAME, randomName } from '../state/names.js';
import { applyRendererQuality, getQuality, onQuality, setQuality, stepResolution } from '../shared/vfx/index.js';
import { autoQualityAllowed, lowerQuality, mountSettings, openSettings, closeSettings } from '../ui/settings.js';
import { attachModels, releaseModels } from '../shared/three/models.js';
import { loading, showLoading, hideLoading, setLoadingRunner } from '../ui/loading.js';
import { getLang, hasKey, t } from '../i18n/index.js';
import { sfx } from '../shared/audio/index.js';
import { detectPlatform, initAnalytics, track } from '../shared/analytics/wire.js';
import { createStore } from '../core/store.js';
import { WALLET, levelForXp } from '../core/config/economy.js';
import { captureThumb } from '../features/finance/thumbs.js';
import '../ui/styles/game-ui.css';
import '../ui/styles/skin/base.css';
import { installDragScroll } from '../ui/drag-scroll.js';
import { CAFE_ENABLED } from '../core/config/world.js';
import { START, STAFF } from '../core/config/economy.js';
import { followerCandidate, followerWage } from '../core/derive.js';
import { loadPlayer, playerModel } from '../characters/load-player.js';
import { V3_KEY, PROGRESS_KEY, PLAYER_KEY, DEV_PROFILE } from '../state/storage-keys.js';
import pkg from '../../package.json';
import { startTelemetry, noteFrame, beginLoad, endLoad, log } from '../shared/godbean/telemetry.js';
import { hasStoredSession, restoreSession, forgetAccount, flush } from '../shared/godbean/client.js';
import { requireGoogleLogin } from '../ui/login-gate.js';
import '../ui/styles/skin/system.css';

installDragScroll();

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
const store = createStore({ key: V3_KEY, legacyKeys: { progress: PROGRESS_KEY, player: PLAYER_KEY }, dev: DEV_PROFILE, sandbox: WALLET.demoDeposit, saveEveryMs: 1500 });
window.addEventListener('pagehide', () => store.flush());
const legacyPlayer = readPlayer();
// The character in the V3 save wins; the v1 player key is only a default for the selection screen.
const profile = { gender: store.state.character?.gender ?? legacyPlayer.gender, name: store.state.character?.name || legacyPlayer.name || DEFAULT_NAME };
setLoadingRunner(profile.gender); // the loading runner looks like the player's character
document.body.dataset.gender = profile.gender || 'female'; // speaker portraits
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

// Frame monitor: every 4 s of judged frames, compares the mean frame time with the interval the frame gate aims for, so Low's deliberate
// 30 fps is on budget. Over budget: one resolution rung down. Tier drops stay the last resort: ladder spent or useless and still crawling.
// Back up one rung only after 60 s on budget, and every step down holds that off for minutes (longer each time a raise fails), so it cannot oscillate.
const JUDGE_S = 4, SLOW_RATIO = 1.15, FAST_RATIO = 1.05, CRAWL_RATIO = 2.4, RAISE_AFTER_S = 60, PROVE_S = 60, MAX_HOLD_S = 3600;
let slowTime = 0, judgedTime = 0, judgedFrames = 0, graceUntil = 0;
let steadyTime = 0, provingTime = 0, raiseBlockedUntil = 0, stepBlockedUntil = 0, holdS = 180;
let unproved = 0, proofBase = 0; // rungs taken with no gain seen yet, and the mean frame time before the first of them
// `?fps` in the URL shows fps, draw calls and quality so performance can be checked on a real phone.
const fpsMeter = new URLSearchParams(location.search).has('fps') ? Object.assign(document.body.appendChild(document.createElement('output')), { style: 'position:fixed;left:50%;transform:translateX(-50%);top:max(4px,env(safe-area-inset-top));z-index:99;padding:3px 8px;border-radius:8px;background:#000a;color:#fff;font:11px/1.3 monospace;white-space:nowrap;pointer-events:none' }) : null;
let meterFrames = 0, meterTime = 0;
function meter(raw) {
  meterFrames++; meterTime += raw;
  if (meterTime < .5) return;
  fpsMeter.textContent = `${Math.round(meterFrames / meterTime)} fps · ${renderer.info.render.calls} draw · ${getQuality()} · ${renderer.getPixelRatio()}x`;
  meterFrames = meterTime = 0;
}
function watchFrame(dt, budget) {
  // A frame over 250 ms is the browser throttling or pausing the page, not a slow device: restart the window.
  if (dt > .25) { slowTime = judgedTime = judgedFrames = 0; graceUntil = visualTime + 3; return; }
  if (dt <= 0 || visualTime < graceUntil || !autoQualityAllowed()) return;
  judgedTime += dt; judgedFrames++; if (dt > budget * CRAWL_RATIO) slowTime += dt;
  if (judgedTime < JUDGE_S) return;
  const mean = judgedTime / judgedFrames, ratio = mean / budget, crawling = slowTime / judgedTime > .6;
  slowTime = judgedTime = judgedFrames = 0;
  if (unproved && (ratio <= SLOW_RATIO || mean < proofBase * .96)) unproved = 0;
  if (ratio > SLOW_RATIO) {
    steadyTime = 0;
    if (provingTime > 0) { provingTime = 0; holdS = Math.min(holdS * 2, MAX_HOLD_S); }
    if (unproved < 2 && visualTime >= stepBlockedUntil && stepResolution(renderer, -1)) {
      if (!unproved++) proofBase = mean;
      raiseBlockedUntil = visualTime + holdS; graceUntil = visualTime + 3;
      return;
    }
    // Coarser made no difference: the limit is the CPU or a capped display (iOS Low Power Mode draws 30), so give the sharpness back.
    if (unproved) {
      stepResolution(renderer, unproved); unproved = 0;
      stepBlockedUntil = visualTime + holdS; holdS = Math.min(holdS * 2, MAX_HOLD_S);
      graceUntil = visualTime + 3;
    }
    if (crawling && lowerQuality()) graceUntil = visualTime + 5;
    return;
  }
  provingTime = Math.max(0, provingTime - JUDGE_S);
  steadyTime = ratio <= FAST_RATIO ? steadyTime + JUDGE_S : 0;
  if (steadyTime < RAISE_AFTER_S || visualTime < raiseBlockedUntil) return;
  steadyTime = 0;
  if (stepResolution(renderer, 1)) { provingTime = PROVE_S; graceUntil = visualTime + 3; }
}

// ---------- small helpers ----------
const startLoop = () => { previous = null; refreshes = Infinity; lastActiveAt = performance.now(); renderer.setAnimationLoop(document.hidden ? null : frame); };
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
// Timer-driven realm actions (customers, café street vendors / reviews): failures are not the player's doing.
const QUIET_ACTIONS = new Set(['shop/spawnCustomer', 'shop/customerLeft', 'shop/venueSale', 'shop/review']);
const expiryLines = () => [1, 2, 3, 4, 5].map(n => t(`story.expiry.line${n}`).replace(/\*\*/g, ''));
// Fire-and-forget realm cinematic; input stays usable afterwards.
function cinematic(name) {
  if (!realm || mode !== 'play') return;
  try { Promise.resolve(realm.cinematic(name)).catch(error => console.warn(`cinematic ${name}`, error)); } catch (error) { console.warn(`cinematic ${name}`, error); }
}

// ---------- phase router ----------
async function route() {
  // Closed the tab on the login screen that follows the incident: sign in first. Only a save that reached that screen
  // (LOGIN_DUE); a save that passed Level 10 before the gate existed is not stopped.
  // body.booting hides everything but the loading screen: lift it, or the gate is invisible and the load hangs.
  if (loginDue()) { await requireGoogleLogin({ reason: 'resume', onShow: () => { hideLoading(); bootDone(); } }); clearLoginDue(); }
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
  mode = 'transition'; beginLoad('selection');
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
  mode = 'selection'; endLoad('selection');
  startLoop();
}
const previewName = {}; // the random name on the hero plate, kept when the hero is chosen
// Male stands left, female right: only show the arrow pointing at the other one.
function showGender(gender) {
  profile.gender = gender;
  document.body.dataset.gender = gender;
  setLoadingRunner(gender);
  document.querySelector('.selection-arrow--prev').hidden = false;
  document.querySelector('.selection-arrow--next').hidden = false;
  previewName[gender] ??= randomName(gender) || DEFAULT_NAME;
  $('sel-plate').textContent = previewName[gender];
}
async function enterGame(event) {
  event.preventDefault();
  if (mode !== 'selection') return;
  mode = 'transition';
  track('play_clicked');
  track('game_started', { resumed: false, screen: 'intro' });
  profile.name = previewName[profile.gender] || randomName(profile.gender) || DEFAULT_NAME; // no name field: the name shown on the plate
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
  mode = 'transition'; beginLoad('intro');
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
  elapsed = START_TIME; currentBeat = null; mode = 'intro'; endLoad('intro');
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
  mode = 'transition'; beginLoad('teacher');
  showLoading(40, t('story.loading.teacher'));
  const [{ createTeacher }, character] = await Promise.all([import('../features/teacher/index.js'), loadPlayer(playerModel(profile.gender))]);
  const teacher = await createTeacher({
    character, name: profile.name,
    onTalked: () => store.dispatch('story/teacherDone'),
    onDone: ({ skipped }) => { godBeanSplash(skipped).catch(fail); },
  });
  disposeActive(); releaseModels('intro/'); // intro GLBs are only used by the intro
  active = teacher;
  renderer.toneMappingExposure = 1;
  resize();
  loading(85, t('story.loading.teacher'));
  await renderer.compileAsync(active.scene, active.camera);
  hideLoading(); bootDone(); showGear(true); vignette.style.opacity = '0';
  present('story.title.teacher', 'story.label.teacher');
  mode = 'teacher'; endLoad('teacher');
  startLoop();
  teacher.start().catch(fail);
}

// The bean has dissolved into the hero's mind: the God Bean splash covers the screen while the world map loads under it.
// Shown once (scene 2 runs once); a skip keeps it short.
async function godBeanSplash(skipped) {
  const { showSplash } = await import('../ui/splash.js');
  const splash = showSplash(), started = performance.now();
  try {
    await splash.shown;
    await openAtlas('gate');
    const rest = (skipped ? 1500 : 2800) - (performance.now() - started);
    if (rest > 0) await new Promise(resolve => setTimeout(resolve, rest));
  } finally { await splash.close(); }
}

// ---------- capital (USD wallet, Gold per farm) ----------
let finance = null;
async function openFinance(view = 'home', param) {
  if (!finance) {
    const { createFinance } = await import('../features/finance/index.js');
    finance ||= createFinance({ store, sandbox: WALLET.demoDeposit, onEnterFarm: enterFarm });
  }
  finance.open(view, param);
}
function enterFarm(regionId) {
  if (store.state.autoplay?.active && regionId !== store.state.world.currentRegion) return { ok: false, error: 'autoRunning' };
  if (realm && mode === 'play') snapFarm();
  const result = store.dispatch('world/enterRegion', { regionId });
  if (result.ok) enteredRegion(regionId, result);
  return result;
}
// The farm's thumbnail on the capital screens: taken from the real view, once, as the player leaves it.
function snapFarm() {
  try { renderer.render(realm.scene, realm.camera); captureThumb(store.state.world.currentRegion, renderer.domElement); } catch { /* decoration only */ }
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
  if (overRealm) snapFarm();
  mode = 'transition'; beginLoad('atlas');
  if (overRealm) {
    // The realm stays loaded underneath (not rendered); the HUD is rebuilt when the atlas closes.
    realm.setInputLocked(true); realm.clearInput?.(); realm.select(null); hud?.dispose(); hud = null;
  } else { disposeActive(); disposePlay(); }
  showLoading(50, t('story.loading.atlas'));
  await paint();
  const { createAtlas } = await import('../features/atlas/index.js');
  atlas = createAtlas({ store, mode: atlasMode, onEntered: enteredRegion, onClose: closeAtlas, onFinance: openFinance });
  renderer.toneMappingExposure = .95;
  resize();
  await renderer.compileAsync(atlas.scene, atlas.camera);
  hideLoading(); bootDone(); showGear(true);
  present('story.title.atlas', 'story.label.atlas');
  mode = 'atlas'; endLoad('atlas', { mode: atlasMode, over_realm: !!overRealm });
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
  leaveCafe();
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
  hud = hudModule.createHud({ store, realm, dev: DEV_PROFILE, onOpenAtlas: () => { openAtlas('play').catch(fail); }, onOpenSettings: openSettings, onOpenFinance: (view, param) => { openFinance(view, param).catch(fail); } });
}
// The realm plays its own 'arrive' swoop on load / region change (and skips it while the expiry cinematic runs).
async function enterPlay() {
  mode = 'transition'; beginLoad('play');
  disposeActive(); disposeAtlas(); disposePlay();
  showLoading(40, t('story.loading.realm'));
  const [{ createRealm }, hudMod] = await Promise.all([import('../features/realm/index.js'), import('../features/hud/index.js')]);
  hudModule = hudMod;
  renderer.toneMappingExposure = .95;
  const hooks = {
    onSelect: target => hud?.setSelection(target),
    onTierTap: id => hud?.openTier?.(id), // a tier signboard → its info modal
    onPlantFx: (kind, id) => hud?.plantFx?.(kind, id), // water / prune animation over a plant
    onStaffTap: uid => hud?.openStaff?.(uid),
    onManagerTap: () => hud?.openManager?.(), // the manager in the world → his inbox (or his tab)
    // Customer spawn / patience run on a timer: their failures are not the player's doing, so stay silent.
    onResult: (actionType, result) => {
      if (!result || result.ok || QUIET_ACTIONS.has(actionType)) return;
      hud?.toast(errorText(result), 'bad'); sfx('ui.deny');
    },
    onWalkToGate: () => { if (mode === 'play') openAtlas('play').catch(fail); },
    // Café street: the camera framed a shop (id) or the street overview (null) → the HUD shop strip highlights it.
    onShopFocus: id => hud?.setShopFocus?.(id),
    requestFrame: () => { refreshes = Infinity; repaint = true; }, // something drew into the canvas outside the loop: the next frame must repaint it
  };
  realm = await createRealm({ renderer, store, gender: profile.gender, hooks });
  realm.resize(window.innerWidth, window.innerHeight);
  loading(80, t('story.loading.realm'));
  // wait until every model of the farm is loaded (hills, forest, scenery, village), THEN compile the shaders: the farm appears
  // complete and smooth instead of loading in pieces while you play
  await Promise.race([realm.whenLoaded?.(), new Promise(r => setTimeout(r, 30000))]);
  loading(92, t('story.loading.realm'));
  await renderer.compileAsync(realm.scene, realm.camera);
  warmUpGPU(realm.scene, realm.camera, realm); // upload every texture / buffer now: panning to another tier must not hitch
  createPlayHud();
  hideLoading(); bootDone(); showGear(false); vignette.style.opacity = '0';
  present('story.title.play', 'story.label.play');
  mode = 'play'; endLoad('play', { region: store.state.world.currentRegion, ...realmCounts() });
  $('game').focus({ preventScroll: true });
  startLoop();
  leaveCafe();
  if (store.state.story.phase === 'expiry') runExpiry().catch(fail);
}
// The café game is off for now (world.js CAFE_ENABLED): a save that stands in a café city says so and goes back to the map.
function leaveCafe() {
  if (CAFE_ENABLED || mode !== 'play') return;
  const r = store.state.world.regions[store.state.world.currentRegion];
  if (r?.mode !== 'cafe') return;
  hud?.toast?.(`☕ ${t('atlas.cafeUpdating')}`, 'info');
  openAtlas('play').catch(fail);
}

// Size of the loaded farm for perf_load: what the scene holds when play starts.
function realmCounts() {
  let meshes = 0, instances = 0;
  try { realm?.scene.traverse(o => { if (o.isMesh) { meshes++; if (o.isInstancedMesh) instances += o.count; } }); } catch { /* stats only */ }
  return { meshes, instances, programs: renderer.info.programs?.length ?? null };
}

/** One hidden draw with culling off + every texture initialised: the GPU already holds the far tiers' data (no first-sight upload hitch). */
function warmUpGPU(scene, camera, realmApi) {
  try {
    realmApi?.warmShadows?.(true);
    const culled = [];
    scene.traverse(o => {
      if (o.isMesh || o.isPoints || o.isLine) { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } }
      for (const m of o.material ? [o.material].flat() : []) for (const v of Object.values(m)) if (v?.isTexture && v.image) renderer.initTexture(v);
    });
    renderer.render(scene, camera); // colour pass + the shadow pass over the whole map
    for (const o of culled) o.frustumCulled = true;
    realmApi?.warmShadows?.(false);
  } catch (err) { console.warn('GPU warm-up skipped', err); }
}

// Login after the Level-10 incident: a flag per save profile, set when the incident ends, cleared once signed in.
const LOGIN_DUE = `${V3_KEY}-login-due`;
const loginDue = () => { try { return localStorage.getItem(LOGIN_DUE) === '1'; } catch { return false; } };
const markLoginDue = () => { try { localStorage.setItem(LOGIN_DUE, '1'); } catch { /* private mode: asked once only */ } };
const clearLoginDue = () => { try { localStorage.removeItem(LOGIN_DUE); } catch { /* ignore */ } };

// ---------- Level 10 expiry (safe at any reload point: pending → cinematic + execute; reset → atlas) ----------
async function runExpiry() {
  if (expiryRunning || !realm || store.state.story.phase !== 'expiry') return;
  expiryRunning = true;
  const regionId = store.state.story.expiry?.regionId;
  try {
    realm.setInputLocked(true); realm.cancelPlacement(); realm.select(null); // select(null) also clears the HUD via onSelect
    try { await realm.cinematic('expiry'); } catch (error) { console.warn('expiry cinematic', error); }
    try { await hud?.dialogue(expiryLines()); } catch (error) { console.warn('expiry dialogue', error); }
    // One of your staff asks to follow you (founder 2026-11-07): the most attached worker, or now and then a robot that
    // "evolved a mind" living with people. You confirm; a follower costs a wage, unpaid wages go on your debt.
    let follower = null;
    const c = followerCandidate(store.state, Math.random());
    if (c && hud?.confirm) {
      const robot = STAFF[c.type]?.kind === 'robot', name = c.name || c.serial || t(`staff.${c.type}`);
      try {
        if (robot) await hud.dialogue([1, 2].map(n => ({ text: t(`story.follow.robot${n}`, { name }).replace(/\*\*/g, '').replace(/^🤖\s*[^:]*:\s*/, ''), speaker: name, avatar: '🤖' })));
        const yes = await hud.confirm({ title: t(robot ? 'story.follow.titleRobot' : 'story.follow.title', { name }),
          body: t('story.follow.body', { name, coins: followerWage(c), min: 10 }), confirmLabel: t('story.follow.yes'), cancelLabel: t('story.follow.no') });
        if (yes) follower = c.uid;
      } catch (error) { console.warn('follower ask', error); }
    }
    const result = store.dispatch('expiry/execute', { follower });
    if (result.ok && !result.noop) { track('region_expired', { region: regionId || 'none' }); log('expiry_done', { region: regionId || null, follower: !!follower }); }
    // Founder 2026-11-11: after the Level-10 incident the real game needs a Google account (blocking until signed in).
    if (result.ok && !result.noop) { markLoginDue(); await requireGoogleLogin({ reason: 'level10' }); clearLoginDue(); }
  } finally { expiryRunning = false; }
  if (store.state.story.phase === 'chooseRegion') await openAtlas('chooseRegion');
  else realm?.setInputLocked(false);
}

const unsubscribeStory = store.subscribe((state, evts) => {
  for (const e of evts || []) {
    if (e.type === 'expiryTriggered' && mode === 'play') setTimeout(() => runExpiry().catch(fail)); // after the current dispatch returns
    else if (e.type === 'regionUnlocked') track('region_selected', { region: e.regionId, cost: e.cost });
    else if (e.type === 'reborn') { track('rebirth_used', { blessing: e.blessing }); cinematic('rebirth'); }
  }
});

// ---------- render loop ----------
// Frame gate: draws every Nth display refresh, the smallest N that stays near 60 fps (30 once the farm has been still for a few
// seconds). Whole refreshes keep the pacing even: 60 Hz → 60, 75 Hz → 75, 120 Hz → 60, 144 Hz → 72. A time-based 60 cap on 75 Hz
// alternates 13 and 27 ms frames, which reads as stutter. `vsyncMs` is learned from the loop, so a device that cannot keep up
// simply measures as a slower display and is never throttled further.
// A skipped frame leaves `previous` alone: the next real frame gets the whole elapsed time, so the game clock never loses any.
const ACTIVE_FRAME_MS = 1000 / 60, IDLE_FRAME_MS = 1000 / 30, IDLE_AFTER_MS = 4000;
const activeFrameMs = () => (getQuality() === 'low' ? IDLE_FRAME_MS : ACTIVE_FRAME_MS); // Low is the cool-running mode: 30 fps at all times
let vsyncMs = ACTIVE_FRAME_MS, lastRefreshAt = 0, refreshes = Infinity, lastActiveAt = 0;
let repaint = false; // the canvas was cleared or drawn over: a covered world still has to be drawn once
function frameDue(now, target) {
  const gap = now - lastRefreshAt; lastRefreshAt = now;
  if (gap > 2 && gap < 40) vsyncMs += (gap - vsyncMs) * .05;
  if (++refreshes < Math.max(1, Math.floor(target / vsyncMs + .2))) return false;
  refreshes = 0;
  return true;
}
// Input leaves the idle rate on the very next frame instead of waiting out the 30 fps interval.
function noteActivity() {
  const now = performance.now();
  if (now - lastActiveAt >= IDLE_AFTER_MS) refreshes = Infinity;
  lastActiveAt = now;
}
function resize() {
  repaint = true;
  applyRendererQuality(renderer, active?.scene, atlas?.scene, realm?.scene);
  renderer.setSize(window.innerWidth, window.innerHeight);
  active?.resize(window.innerWidth, window.innerHeight);
  atlas?.resize(window.innerWidth, window.innerHeight);
  realm?.resize(window.innerWidth, window.innerHeight);
}
function frame(now) {
  // The world map idles the same way: open and untouched it kept drawing at the full rate (60, more on a 120 Hz phone) for as long as it stayed open.
  const idle = (mode === 'play' || mode === 'atlas') && (now - lastActiveAt >= IDLE_AFTER_MS || (mode === 'play' && !!hud?.worldCovered)); // covered: only the simulation runs, 30 steps a second are plenty
  const target = idle ? IDLE_FRAME_MS : activeFrameMs();
  if (!frameDue(now, target)) return;
  renderer.shadowMap.autoUpdate = mode !== 'play'; // the realm asks for its shadow map only when something in it changed
  const raw = previous === null ? 0 : (now - previous) / 1000, dt = Math.min(raw, .1);
  const resumed = previous === null; // first frame back from a hidden tab or another screen
  if (resumed) graceUntil = visualTime + 3; // skip shader warm-up and tab returns
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
    if (realm.moving) lastActiveAt = now;
    hud?.update(dt);
    if (target === activeFrameMs() && !hud?.worldCovered) watchFrame(raw, target / 1000); // a capped idle frame is slow on purpose, it says nothing about the device; before the draw, so a new scale is painted at once
    // Covered by a full-screen panel: the last frame stays on the canvas and the GPU rests.
    if (!hud?.worldCovered || repaint || resumed) { repaint = false; renderer.render(realm.scene, realm.camera); }
  }
  if (fpsMeter) meter(raw);
  if (!idle && !resumed && !(mode === 'play' && hud?.worldCovered)) noteFrame(raw * 1000); // tester perf log: only frames that aim for the full rate
}

// ---------- errors ----------
// Wipes the V3 save and persists a fresh one, so the next load does not re-migrate the old v1 keys.
function resetV3() {
  mode = 'transition';
  store.reset();
  store.dispatch('story/seen', { key: 'restart' });
  // Like a new player: signed out (the Level-10 login asks again), no login still due, a new anonymous analytics id.
  log('progress_reset', {}); flush({ keepalive: true });
  forgetAccount(); clearLoginDue();
  try { localStorage.removeItem('godbean-analytics'); } catch { /* private mode */ }
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
  actions.append(action(t('app.error.reload'), 'ui-btn--go', () => location.reload()), action(t('app.error.lowGraphics'), 'ui-btn--plain', () => { saveSettings({ ...readSettings(), quality: 'low', qualityChosen: true }); location.reload(); }),
    // A damaged save can fail on every load; both resets keep a backup copy of the old run.
    action(t('app.error.restart'), 'ui-btn--plain', event => {
      const button = event.currentTarget; // two taps: the first only asks
      if (!button.dataset.armed) { button.dataset.armed = '1'; button.textContent = t('app.error.restartConfirm'); return; }
      if (!resetProgress()) { button.textContent = t('app.error.restartFailed'); return; }
      resetV3(); location.reload();
    }));
  // Copy: the message and stack, ready to paste into a bug report (clipboard API needs https or localhost, else a hidden text box).
  const report = [String(error?.message ?? error), error?.stack].filter(Boolean).join('\n');
  const copyReport = async event => {
    const button = event.currentTarget;
    let ok = false;
    try { await navigator.clipboard.writeText(report); ok = true; } catch {
      const box = document.createElement('textarea'); box.value = report; box.style.position = 'fixed'; box.style.opacity = '0';
      document.body.append(box); box.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      box.remove();
    }
    button.textContent = t(ok ? 'app.error.copied' : 'app.error.copyFailed');
  };
  actions.append(action(t('app.error.copy'), 'ui-btn--plain', copyReport));
  const details = document.createElement('details'), summary = document.createElement('summary'), code = document.createElement('code');
  summary.textContent = t('app.error.details'); code.textContent = String(error?.message ?? error); details.append(summary, code);
  $('error').replaceChildren(title, text, actions, details);
}

// ---------- boot ----------
async function initialize() {
  try {
    // Edge smoothing (art-upgrade-plan §1): walls and roofs were visibly jagged on phones. Low goes without; MSAA is fixed when the context is made, so it follows the saved level and a change takes effect on the next load.
    renderer = new THREE.WebGLRenderer({ antialias: readSettings().quality !== 'low', powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    events.signal.addEventListener('abort', onQuality(() => { repaint = true; applyRendererQuality(renderer, active?.scene, atlas?.scene, realm?.scene); }), { once: true });
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
    // Tester logs → godbean server (perf, errors, friction). Same switch as analytics (settings); ?profile=test runs are tagged.
    startTelemetry({
      renderer, store, enabled: readSettings().analytics,
      screen: () => mode, level: () => levelForXp(store.state.player?.xp ?? 0),
      quality: () => ({ quality: getQuality(), pixel_ratio: Math.round(renderer.getPixelRatio() * 100) / 100 }),
      extra: { app_version: pkg.version, profile: DEV_PROFILE ? 'test' : 'main', phase: store.state.story.phase, level: levelForXp(store.state.player?.xp ?? 0), lang: getLang() },
    });
    events.signal.addEventListener('abort', onQuality(q => log('perf_quality', { quality: q ?? getQuality(), pixel_ratio: Math.round(renderer.getPixelRatio() * 100) / 100, screen: mode })), { once: true });
    if (hasStoredSession()) restoreSession().catch(() => {}); // a session from before: logs from now on are tied to the player
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
for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) window.addEventListener(type, noteActivity, { capture: true, passive: true, signal: events.signal });
document.addEventListener('visibilitychange', () => {
  previous = null; noteActivity();
  if (document.hidden) { store.flush(); realm?.clearInput?.(); atlas?.clearInput(); }
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
// QA URL params on the test profile, applied on every load (only the test save is touched):
//   ?profile=test&coins=9999999&beans=40&level=9
// coins / beans / level are set to exactly that value (level stays below 10
// unless the Level-10 incident already happened).
if (DEV_PROFILE) {
  const q = new URLSearchParams(location.search);
  const params = Object.fromEntries(['coins', 'beans', 'level'].filter(k => q.has(k)).map(k => [k, q.get(k)]));
  if (Object.keys(params).length) {
    const r = store.dispatch('dev/set', params);
    console.info('[QA] URL params', params, r.ok ? 'applied' : r.error);
  }
}
export function startGame() {
  initialize();
}
