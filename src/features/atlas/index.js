// World atlas (V3): a tilted 3D world map, chosen by CITY (docs/design/world-cities.md: 18 countries, 3–5 cities each).
// No Rounds: every city can be opened with coins (more coins → more places). Countries are raised slabs coloured by
// status (owned city inside = bright + flag, current = pulsing ring, nothing owned = grey + 🔒 with the cheapest price).
// Tap a country → it lifts and a bottom sheet lists its cities (vibe line, price / Go). Cities are picked in the sheet
// only (no city pins on the map). The coffee-culture texts (culture.*) are kept as data, not shown here; the menus feed
// the café's local drinks (core/config/menus.js).
// Owned city → Go, not owned → price + Open (small confirm card for paid ones, then unlockRegion + enterRegion).
// Reuses the terrain/outlines of the old world map (world-map/terrain.js, geo.js, content.js); logic is new.
//
// createAtlas({ store, mode, onEntered, onClose }) → { scene, camera, update(dt), resize(w, h), setMode(mode),
//   handleKeyDown(e), handleKeyUp(e), clearInput(), dispose() }
//  mode: 'gate' (first pick, no close) | 'chooseRegion' (land expired, no close) | 'play' (opened from the HUD, closable)
//  onEntered(regionId, result): world/enterRegion succeeded (result.events tell whether the region changed).
import * as THREE from 'three';
import { REGIONS as OUTLINES } from '../world-map/content.js';
import { project } from '../world-map/geo.js';
import { buildTerrain, DEEP } from '../world-map/terrain.js';
import { COUNTRIES, COUNTRY_ORDER, DEFAULT_COUNTRY, parseRegionId, countryGames, cityOf, CAFE_ENABLED } from '../../core/config/world.js';
import { regionAccess, regionsOfCountry, ownsRegion } from '../../core/derive.js';
import { EXPIRY_LEVEL } from '../../core/config/economy.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { sfx } from '../../shared/audio/index.js';
import { hasKey, t } from '../../i18n/index.js';
import { iconSvg } from '../../ui/icons.js';
import { levelProgress } from '../../core/derive.js';
import { farmCard, overview } from '../../core/finance.js';
import { usdOf, totalGold, goldOf } from '../../core/wallet.js';
import { WALLET } from '../../core/config/economy.js';
import { formatNumber } from '../../i18n/index.js';
import './atlas.css';
import './atlas-account.css';
import '../../ui/styles/skin/atlas.css';

const BOUNDS = { minX: -13, maxX: 14, minZ: -8, maxZ: 5 };
const ZOOM = { min: 5, max: 22 };
const WATER = .02, DEPTH = .2, LIFT = .07;
const LOCKED = '#a3a39b', HIGHLIGHT = '#ffd25e';

const inside = ([lon, lat], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const countryOfRegion = id => parseRegionId(id)?.countryId ?? null;
const GAME_ICON = { farm: '🌱', cafe: '☕' };

/** Readable text for a failed store result (HUD err.* pack first, then this pack's fallbacks). */
export function atlasErrorText(result) {
  const code = result?.error || 'unknown';
  if (code === 'locked') return t('atlas.err.locked');
  if (hasKey(`err.${code}`)) return t(`err.${code}`, result.data || {});
  if (code === 'coins') return t('story.err.coins', result.data || {});
  return t('story.err.generic');
}

export function createAtlas({ store, mode: initialMode = 'gate', onEntered, onClose, onFinance }) {
  let mode = initialMode;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cdebf5');
  scene.fog = new THREE.Fog('#cdebf5', 24, 46);
  const camera = new THREE.PerspectiveCamera(40, 1, .3, 120);
  scene.add(new THREE.HemisphereLight('#f4fbff', '#5f7a6a', 1.4));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.5); sun.position.set(-6, 10, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 }); sun.shadow.bias = -.0008; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);

  const terrain = buildTerrain(); scene.add(terrain.mesh);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 70), new THREE.MeshStandardMaterial({ color: DEEP, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.41; scene.add(floor);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ color: '#3d9fd3', roughness: .18, metalness: .05, transparent: true, opacity: .72, depthWrite: false }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = WATER; ocean.receiveShadow = true; ocean.renderOrder = 1; scene.add(ocean);

  // Shared materials/geometries for flags, rings and islets.
  const pole = new THREE.MeshStandardMaterial({ color: '#6b4a2c' });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: '#9a7650', roughness: .95 });
  const sand = new THREE.MeshStandardMaterial({ color: '#e8d9a8', roughness: 1, flatShading: true });
  const isletGeometry = new THREE.CylinderGeometry(.055, .065, DEPTH, 7);
  const stickGeometry = new THREE.CylinderGeometry(.025, .025, .8, 6), bannerGeometry = new THREE.BoxGeometry(.4, .25, .02);
  const ringGeometry = new THREE.RingGeometry(.55, .7, 40); ringGeometry.rotateX(-Math.PI / 2);

  // One raised slab per country of the V3 world (ids shared with world-map/content.js outlines).
  const countries = COUNTRY_ORDER.map(id => OUTLINES.find(o => o.id === id)).filter(Boolean).map(outline => {
    const id = outline.id, def = COUNTRIES[id];
    const [x, z] = project(outline.lon, outline.lat);
    const anchor = new THREE.Group(); anchor.position.set(x, 0, z);
    const tile = new THREE.Group();
    // Main outline + extra parts (islands of Japan, Indonesia, Malaysia …): one slab each, all lifted together.
    const polygons = [outline.outline, ...(outline.parts || [])];
    const all = polygons.flat(), lons = all.map(p => p[0]), lats = all.map(p => p[1]);
    // Highest terrain point inside the outline, so the slab never gets pierced by mountains.
    let top = Math.max(WATER, terrain.heightAt(outline.lon, outline.lat));
    for (let lo = Math.min(...lons); lo <= Math.max(...lons); lo += .5) for (let la = Math.min(...lats); la <= Math.max(...lats); la += .5) if (polygons.some(ring => inside([lo, la], ring))) top = Math.max(top, terrain.heightAt(lo, la));
    // Camera distance that fits the country when selected (small Taiwan/Korea close, Russia/Canada far).
    const size = Math.max((Math.max(...lons) - Math.min(...lons)) / 12, (Math.max(...lats) - Math.min(...lats)) / 9);
    const topMaterial = new THREE.MeshStandardMaterial({ color: LOCKED, roughness: .9, emissive: HIGHLIGHT, emissiveIntensity: 0 });
    for (const ring of polygons) {
      const shape = new THREE.Shape(ring.map(([lon, lat]) => { const [px, pz] = project(lon, lat); return new THREE.Vector2(px - x, -(pz - z)); }));
      const slab = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: .03, bevelSize: .025, bevelSegments: 2 });
      slab.rotateX(-Math.PI / 2);
      const block = new THREE.Mesh(slab, [topMaterial, sideMaterial]); block.castShadow = block.receiveShadow = true;
      tile.add(block);
    }
    for (const group of outline.islands || []) for (const [lon, lat] of group.islets) {
      const [px, pz] = project(lon, lat), islet = new THREE.Mesh(isletGeometry, [sand, topMaterial, sand]);
      islet.position.set(px - x, DEPTH / 2, pz - z); islet.castShadow = true; tile.add(islet);
    }
    const flagMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.palette.accent), flatShading: true });
    const flag = new THREE.Group();
    const stick = new THREE.Mesh(stickGeometry, pole); stick.position.y = .4;
    const banner = new THREE.Mesh(bannerGeometry, flagMaterial); banner.position.set(.21, .68, 0);
    stick.castShadow = banner.castShadow = true; flag.add(stick, banner); flag.position.y = DEPTH + .02; tile.add(flag);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial); ring.position.y = DEPTH + .05; ring.visible = false; tile.add(ring);
    const rest = top - DEPTH + LIFT;
    tile.position.y = rest;
    anchor.add(tile); scene.add(anchor);
    anchor.traverse(o => { o.userData.country = id; });
    return { id, def, outline, polygons, size, x, z, top, rest, anchor, tile, topMaterial, flag, flagMaterial, ring, ringMaterial, banner, rise: 0, speed: 0, status: null };
  });

  // ---------- DOM overlay ----------
  const events = new AbortController(), signal = events.signal;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const button = (label, className, run) => { const b = el('button', `ui-btn ${className}`, label); b.type = 'button'; b.addEventListener('click', event => { event.stopPropagation(); run(); }, { signal }); return b; };
  const root = el('section', 'atlas'); root.setAttribute('aria-label', t('atlas.label'));
  const header = el('header', 'atlas-header');
  const title = el('h2', 'atlas-title');
  const hint = el('p', 'atlas-hint', `👆 ${t('atlas.hint')}`);
  header.append(title, hint);
  const close = el('button', 'ui-close atlas-close', '×'); close.type = 'button'; close.setAttribute('aria-label', t('atlas.close')); close.title = t('atlas.close');
  close.addEventListener('click', () => onClose?.(), { signal });
  const pins = el('div', 'atlas-pins');
  const sheet = el('section', 'atlas-sheet'); sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'false');
  const toastEl = el('p', 'atlas-toast'); toastEl.hidden = true; toastEl.setAttribute('role', 'status');
  // Account bar: level, the USD wallet, warnings and the capital book. Shown once the player owns a farm.
  const svg = (name, tag = 'span') => { const n = el(tag, 'fin-ico'); n.innerHTML = iconSvg(name); return n; };
  const money = cents => (cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const accountBtn = (label, run, ...kids) => { const b = el('button', 'atlas-account-btn'); b.type = 'button'; b.setAttribute('aria-label', label); b.append(...kids); b.addEventListener('click', event => { event.stopPropagation(); run(); }, { signal }); return b; };
  const lvEl = el('span', 'atlas-account-lv'), usdText = el('b'), bellCount = el('i'); bellCount.hidden = true;
  const account = el('div', 'atlas-account');
  account.append(lvEl, accountBtn(t('fin.usdWallet'), () => onFinance?.('topup'), svg('usd'), usdText), el('span', 'atlas-account-gap'),
    accountBtn(t('fin.alerts'), () => onFinance?.('alerts'), svg('bell'), bellCount), accountBtn(t('fin.title'), () => onFinance?.('home'), svg('ledger')));
  root.append(pins, account, header, sheet, toastEl);
  account.append(close);
  document.body.append(root); document.body.classList.add('atlas-open');

  const pinFor = new Map(countries.map(entry => {
    const pin = el('button', 'atlas-pin'); pin.type = 'button';
    pin.addEventListener('click', event => { event.stopPropagation(); select(entry.id); }, { signal });
    pins.append(pin); return [entry, pin];
  }));

  let selected = null, confirming = null, confirmingGame = null, toastTimer = 0; // confirming: region id whose confirm card is open (opened as confirmingGame)
  let sizesDirty = true; // pin labels / screen changed: re-measure the full pin sizes (declutter)
  const state = () => store.state;
  function toast(text, tone = 'info') { toastEl.textContent = text; toastEl.dataset.tone = tone; toastEl.hidden = false; toastTimer = 2.6; }

  // Country status from its regions: 'current' (the player is there), 'owned' (≥ 1 region opened) or 'locked'
  // (nothing opened yet; `cost` = cheapest region, 0 when the next opening is free).
  function statusOf(id) {
    const s = state(), regions = regionsOfCountry(id);
    const owned = regions.filter(r => ownsRegion(s, r)).length;
    const closed = regions.filter(r => !ownsRegion(s, r)).map(r => regionAccess(s, r)).filter(a => a.reason === 'locked');
    const cost = closed.length ? Math.min(...closed.map(a => a.cost)) : null;
    const kind = countryOfRegion(s.world.currentRegion) === id ? 'current' : owned ? 'owned' : 'locked';
    const trouble = owned > 0 && regions.some(r => ownsRegion(s, r) && farmCard(s, r, Date.now()).status === 'trouble');
    const gold = regions.reduce((n, r) => n + (ownsRegion(s, r) ? goldOf(s, r) : 0), 0);
    return { kind, owned, total: regions.length, cost, trouble, gold };
  }
  const coinText = cost => (cost === 0 ? t('atlas.free') : t('atlas.country.cost', { cost }));
  // Colours, flags and pin labels follow the save.
  function refreshCountries() {
    for (const entry of countries) {
      const status = statusOf(entry.id); entry.status = status;
      const color = new THREE.Color(status.kind === 'locked' ? LOCKED : entry.def.palette.ground);
      if (status.kind !== 'locked') color.lerp(new THREE.Color('#ffffff'), .12);
      entry.topMaterial.color.copy(color);
      entry.flag.visible = status.kind !== 'locked';
      entry.ring.visible = status.kind === 'current';
      const pin = pinFor.get(entry);
      pin.dataset.status = status.kind;
      pin.classList.toggle('is-selected', selected === entry.id);
      const name = t(`country.${entry.id}`);
      const firstPick = !state().world.ownedRegions.length; // choosing where to start is free: nothing is locked yet
      const icon = status.kind === 'locked' ? (firstPick ? '🌱' : '🔒') : status.kind === 'current' ? '📍' : '🚩';
      // Owned: "2/4" cities opened. Locked: the cheapest city's price (or Free).
      const extra = status.kind === 'locked' ? (status.cost == null ? '' : coinText(status.cost)) : formatNumber(Math.round(status.gold));
      // Games offered here, visible on the map: 🌱 farm, ☕ café (both = 🌱☕). A country where only some cities farm shows both.
      const games = countryGames(entry.id), gameText = games.map(g => t(`hud.mode.${g}`)).join(' + ');
      pin.dataset.games = games.join(' ');
      pin.replaceChildren(el('span', 'atlas-pin-icon', icon), el('span', 'atlas-pin-name', name),
        ...(status.trouble ? [el('i', 'atlas-pin-alert')] : [])); // the label is only a name: prices and gold live in the tray
      pin.dataset.trouble = status.trouble ? '1' : '';
      pin.setAttribute('aria-label', [name, gameText, extra].filter(Boolean).join(' · '));
    }
    sizesDirty = true;
  }
  function renderHeader() {
    title.textContent = t(`atlas.title.${mode}`);
    root.dataset.mode = mode;
    close.hidden = mode !== 'play';
    const s = state(), o = s.world.ownedRegions.length ? overview(s, Date.now()) : null;
    hint.hidden = Boolean(selected) || Boolean(o);
    account.hidden = !o;
    if (o) {
      lvEl.textContent = String(levelProgress(s).level);
      usdText.textContent = money(usdOf(s));
      const n = o.cards.reduce((sum, c) => sum + c.alerts.length, 0);
      bellCount.hidden = !n; bellCount.textContent = String(n);
    }
  }

  function regionRow(regionId) {
    const s = state(), access = regionAccess(s, regionId), saved = s.world.regions[regionId];
    const row = el('li', 'atlas-region');
    row.dataset.region = regionId;
    const info = el('div', 'atlas-region-info');
    info.append(el('strong', 'atlas-region-name', t(`regionName.${regionId}`)));
    // The card answers one question: what do you play here? A city not started yet offers its games; a started one keeps its game.
    const games = saved?.mode ? [saved.mode] : cityOf(regionId).games;
    const isOff = g => g === 'cafe' && !CAFE_ENABLED; // switched off for now: shown locked, cannot be pressed
    const hint = !s.world.ownedRegions.length && regionId === regionsOfCountry(countryOfRegion(regionId))[0]; // first city pulses for a new player
    const gameButtons = (cls, onPick) => {
      const wrap = el('div', 'atlas-actions');
      for (const g of games) {
        const off = isOff(g);
        const b = button('', `${off ? 'ui-btn--plain' : cls} atlas-enter atlas-game is-${g}${hint && !off ? ' is-hint' : ''}`, () => onPick(g));
        b.append(el('span', 'atlas-game-ico', off ? '🔒' : GAME_ICON[g]), el('span', 'atlas-game-title', t(`atlas.play.${g}`)));
        b.disabled = off;
        b.setAttribute('aria-label', `${t(`atlas.play.${g}`)} · ${off ? t('atlas.updating') : t(`atlas.play.${g}Sub`)} · ${t(`regionName.${regionId}`)}`);
        wrap.append(b);
      }
      return wrap;
    };
    const stateTag = (kind, text) => { const wrap = el('div', 'atlas-actions'); wrap.append(el('span', `atlas-state is-${kind}`, text)); return wrap; };
    let chip, action;
    if (!access.ok && access.reason === 'locked') {
      chip = ['price', access.free ? `🎁 ${t('atlas.free')}` : coinText(access.cost)];
      action = gameButtons(access.free ? 'ui-btn--go' : 'ui-btn--gold', g => ask(regionId, g));
      if (!access.affordable) action.querySelectorAll('button').forEach(b => { b.disabled = true; });
      if (!games.every(isOff)) info.append(el('span', 'atlas-chip is-price', chip[1])); // no price on a city nothing can be played in yet
    } else if (!access.ok) {
      chip = ['expired', t('atlas.chip.expired')]; action = stateTag('expired', chip[1]);
    } else if (access.current) {
      chip = ['current', t('atlas.here')]; action = stateTag('current', chip[1]);
    } else {
      chip = [access.expired ? 'expired' : saved ? 'visited' : 'new'];
      action = gameButtons('ui-btn--go', g => enter(regionId, saved?.mode ? null : g));
    }
    // A paid opening asks on the card itself: the same two slots become Open / Cancel, nothing pops up over the map.
    if (confirming === regionId) {
      action = el('div', 'atlas-actions');
      action.append(button(t('atlas.unlock.go'), 'ui-btn--go atlas-game', () => unlock(regionId, confirmingGame)), button(t('atlas.unlock.cancel'), 'ui-btn--plain atlas-game', () => { confirming = null; renderSheet(); }));
      row.classList.add('is-confirming');
    }
    row.append(info, action);
    row.dataset.state = chip[0];
    return row;
  }
  function renderSheet() {
    renderHeader();
    if (!selected) { sheet.hidden = true; return; }
    const shelfLeft = sheet.querySelector('.atlas-regions')?.scrollLeft || 0; // a redraw keeps the shelf where it was
    sheet.hidden = false; sheet.replaceChildren();
    sheet.setAttribute('aria-label', t(`country.${selected}`));
    const head = el('div', 'atlas-sheet-head');
    head.append(el('span', 'atlas-sheet-flag', COUNTRIES[selected].flag), el('h3', 'atlas-sheet-title', t(`country.${selected}`)));
    const back = el('button', 'ui-close atlas-sheet-close', '×'); back.type = 'button'; back.setAttribute('aria-label', t('atlas.sheetClose'));
    back.addEventListener('click', event => { event.stopPropagation(); select(null); }, { signal });
    head.append(back);
    sheet.append(head);
    const cities = regionsOfCountry(selected);
    const list = el('ul', 'atlas-regions');
    for (const regionId of cities) list.append(regionRow(regionId));
    sheet.append(list);
    list.scrollLeft = shelfLeft;
    // Only a first-time player still needs the one warning; the rest of the tray is the choice itself.
    const st = state();
    if (!st.story.level10Done && !st.world.ownedRegions.length) {
      const how = el('div', 'atlas-howto'); how.append(el('p', 'atlas-howto-warn', t('atlas.howto.lv10', { level: EXPIRY_LEVEL }))); sheet.append(how);
    }
  }
  function enter(regionId, game = null) {
    const result = store.dispatch('world/enterRegion', { regionId, game });
    if (!result.ok) { sfx('ui.deny'); toast(atlasErrorText(result), 'bad'); return; }
    sfx('ui.buy');
    onEntered?.(regionId, result);
  }
  // Free openings go straight in; paid ones ask a small confirm card (title + price) first.
  function ask(regionId, game = null) {
    const access = regionAccess(state(), regionId);
    if (access.reason !== 'locked') { enter(regionId, game); return; }
    if (!access.affordable) { sfx('ui.deny'); toast(atlasErrorText({ error: 'coins', data: { missing: access.missing } }), 'bad'); return; }
    if (access.free) { unlock(regionId, game); return; }
    confirming = regionId; confirmingGame = game; sfx('ui.open'); renderSheet();
  }
  function unlock(regionId, game = null) {
    confirming = null;
    const result = store.dispatch('world/unlockRegion', { regionId });
    if (!result.ok) { sfx('ui.deny'); toast(atlasErrorText(result), 'bad'); renderSheet(); return; }
    const entry = countries.find(c => c.id === countryOfRegion(regionId)); if (entry) entry.speed += 8;
    enter(regionId, game);
  }
  function focusOn(entry, distance) { goal.x = entry.x; goal.z = entry.z + (portrait ? 2.4 : 1.4); goal.distance = Math.min(goal.distance, distance); clampView(goal); velocity.x = velocity.z = 0; }
  function select(id) {
    if (selected === id) return;
    selected = id; confirming = null;
    if (id) {
      const entry = countries.find(c => c.id === id); entry.speed += 4;
      // Fit the country on screen (small countries come closer).
      focusOn(entry, THREE.MathUtils.clamp(5 + entry.size * 2.2, ZOOM.min + 1, portrait ? 16 : 14)); sfx('ui.open');
    }
    refreshCountries(); renderSheet();
  }

  // ---------- camera + input: drag pans, pinch/wheel zooms, tap selects ----------
  const view = { x: 2, z: -1.5, distance: 20 }, goal = { ...view }, velocity = { x: 0, z: 0 };
  let portrait = false;
  const clampView = v => { v.x = THREE.MathUtils.clamp(v.x, BOUNDS.minX, BOUNDS.maxX); v.z = THREE.MathUtils.clamp(v.z, BOUNDS.minZ, BOUNDS.maxZ); };
  const pointers = new Map(), raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pinch = 0, moved = false, lastMove = 0;
  const unitsPerPixel = () => 2 * view.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
  const onCanvas = event => event.target.closest?.('#game canvas');
  document.addEventListener('pointerdown', event => {
    if (!onCanvas(event)) return;
    event.target.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    if (pointers.size === 1) moved = false;
    velocity.x = velocity.z = 0; goal.x = view.x; goal.z = view.z;
  }, { capture: true, signal });
  document.addEventListener('pointermove', event => {
    const point = pointers.get(event.pointerId); if (!point) return;
    event.preventDefault();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], before = Math.hypot(a.x - b.x, a.y - b.y);
      point.x = event.clientX; point.y = event.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && after) goal.distance = THREE.MathUtils.clamp(goal.distance * before / after, ZOOM.min, ZOOM.max);
      pinch = after; moved = true; return;
    }
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.x = event.clientX; point.y = event.clientY;
    if (!moved && Math.hypot(event.clientX - point.startX, event.clientY - point.startY) < 8) return;
    moved = true;
    const scale = unitsPerPixel(), now = performance.now(), dt = Math.max(16, now - lastMove) / 1000; lastMove = now;
    const mx = -dx * scale, mz = -dy * scale * 1.25;
    view.x = goal.x = THREE.MathUtils.clamp(view.x + mx, BOUNDS.minX, BOUNDS.maxX);
    view.z = goal.z = THREE.MathUtils.clamp(view.z + mz, BOUNDS.minZ, BOUNDS.maxZ);
    velocity.x = velocity.x * .6 + mx / dt * .4; velocity.z = velocity.z * .6 + mz / dt * .4;
  }, { capture: true, passive: false, signal });
  const release = event => {
    if (!pointers.has(event.pointerId)) return;
    const wasTap = !moved && pointers.size === 1;
    pointers.delete(event.pointerId); pinch = 0;
    if (pointers.size || performance.now() - lastMove > 80) velocity.x = velocity.z = 0;
    if (!wasTap || event.type !== 'pointerup') return;
    const rect = event.target.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([...countries.map(c => c.anchor), terrain.mesh], true)[0];
    if (!hit) { select(null); return; }
    if (hit.object.userData.country) { select(hit.object.userData.country); return; }
    const lonLat = [hit.point.x * 12, -hit.point.z * 9];
    const within = countries.find(c => c.polygons.some(ring => inside(lonLat, ring)));
    if (within) { select(within.id); return; }
    // Small countries (Taiwan, Korea): a tap close to the slab also counts.
    const near = countries.map(c => ({ c, d: Math.hypot(hit.point.x - c.x, hit.point.z - c.z) })).sort((a, b) => a.d - b.d)[0];
    select(near && near.d < .9 ? near.c.id : null);
  };
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, release, { capture: true, signal });
  document.addEventListener('wheel', event => {
    if (!onCanvas(event)) return;
    event.preventDefault(); goal.distance = THREE.MathUtils.clamp(goal.distance * (event.deltaY > 0 ? 1.1 : .9), ZOOM.min, ZOOM.max);
  }, { passive: false, signal });
  const held = new Set();
  const KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
  // Rebuilt only when what the map shows has changed: background actions would otherwise rebuild the pins and the open sheet.
  let shownSig = '';
  const unsubscribe = store.subscribe(s => {
    const next = `${s.world.ownedRegions.join()}|${s.world.currentRegion}|${s.story.phase}|${Math.round(totalGold(s))}|${usdOf(s)}|${s.wallet.seq}`;
    if (next === shownSig) return;
    shownSig = next; refreshCountries(); renderSheet();
  });

  // Start over the current (or starting) country.
  const s0 = state();
  const startId = countryOfRegion(s0.world.currentRegion) || s0.world.startCountry || DEFAULT_COUNTRY;
  const startEntry = countries.find(c => c.id === startId) || countries[0];
  view.x = goal.x = startEntry.x; view.z = goal.z = startEntry.z + 1.5; clampView(view); clampView(goal);
  view.distance = goal.distance = 16;
  refreshCountries(); renderHeader();

  const anchor = new THREE.Vector3();

  // Pin declutter: on a phone the South-East Asia labels pile up (Việt Nam, the player's own country, ended up under
  // Đài Loan / Malaysia / Indonesia). Pins are placed by priority — selected, current, owned, then locked — and one
  // that would overlap an already placed pin shrinks to a round icon-only dot (still a button: tapping it selects the
  // country, which then wins the full label). A dot that would still sit on a full label is tucked away (the country
  // tile itself stays tappable on the map). Full sizes are measured once per label change / resize, not per frame.
  const PRIORITY = { current: 1, owned: 2, locked: 3 };
  const DOT = 38, TAIL = 8, PAD = 8, EDGE = 10; // PAD: clear gap around every label, EDGE: gap to the screen side
  const fullSize = new Map();
  let reserved = []; // top bar and title: a label never slides under them
  function measure(list) {
    const todo = list.filter(p => sizesDirty || !fullSize.has(p.pin));
    if (!todo.length) return;
    if (sizesDirty) {
      fullSize.clear();
      reserved = [account, header].filter(e => !e.hidden && e.offsetWidth).map(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
    }
    for (const { pin } of todo) pin.classList.remove('is-dot');
    for (const { pin } of todo) if (pin.offsetWidth) fullSize.set(pin, { w: pin.offsetWidth, h: pin.offsetHeight });
    sizesDirty = false;
  }
  function declutter(list) {
    measure(list);
    const rank = p => (p.entry.id === selected ? 0 : PRIORITY[p.entry.status?.kind] ?? 3);
    list.sort((a, b) => rank(a) - rank(b));
    // The open city tray (its ribbon pokes out above it) covers the map: nothing is labelled behind it.
    const tray = selected && !sheet.hidden ? [{ l: (innerWidth - sheet.offsetWidth) / 2, r: (innerWidth + sheet.offsetWidth) / 2, t: innerHeight - sheet.offsetHeight - 26, b: innerHeight }] : [];
    const placed = [...reserved, ...tray], labels = [...reserved, ...tray];
    const hits = (r, set) => set.some(q => r.l < q.r + PAD && r.r > q.l - PAD && r.t < q.b + PAD && r.b > q.t - PAD);
    // Keep a label on screen (a country near the edge showed half a label): shift it in by dx; its tail still points at
    // the country (--tail moves the arrow back).
    const shiftFor = (x, w) => Math.min(Math.max(x, w / 2 + EDGE), innerWidth - w / 2 - EDGE) - x;
    const box = (x, w, h, y) => ({ l: x - w / 2, r: x + w / 2, t: y - h - TAIL, b: y });
    for (const p of list) {
      if (p.x < 0 || p.x > innerWidth) { p.pin.classList.add('is-tucked'); continue; } // its country is off screen: no half label at the side
      const size = fullSize.get(p.pin) || { w: DOT, h: DOT };
      if (rank(p) === 0 && reserved.length) p.y = Math.max(p.y, Math.max(...reserved.map(r => r.b)) + size.h + TAIL + PAD); // the chosen country always keeps a readable label
      const fx = p.x + shiftFor(p.x, size.w), sx = p.x + shiftFor(p.x, DOT);
      const full = box(fx, size.w, size.h, p.y), small = box(sx, DOT, DOT, p.y);
      const dot = rank(p) > 0 && hits(full, placed);
      const tucked = dot && hits(small, labels);
      if (!dot) labels.push(full);
      if (!tucked) placed.push(dot ? small : full);
      if (p.pin.classList.contains('is-dot') !== dot) p.pin.classList.toggle('is-dot', dot);
      if (p.pin.classList.contains('is-tucked') !== tucked) p.pin.classList.toggle('is-tucked', tucked);
      const x = dot ? sx : fx, half = (dot ? DOT : size.w) / 2;
      p.pin.style.transform = `translate3d(${x}px, ${p.y}px, 0) translate(-50%, -100%)`;
      p.pin.style.setProperty('--tail', `${Math.round(Math.max(12 - half, Math.min(half - 12, p.x - x)))}px`);
    }
  }

  return {
    scene, camera,
    get mode() { return mode; },
    setMode(next) { mode = next; refreshCountries(); renderSheet(); },
    resize(width, height) {
      portrait = width < height; sizesDirty = true;
      camera.aspect = width / height; camera.fov = portrait ? 56 : 40; camera.updateProjectionMatrix();
    },
    update(dt) {
      for (const code of held) { goal.x += KEYS[code][0] * dt * 9; goal.z += KEYS[code][1] * dt * 9; }
      if (!pointers.size && (velocity.x || velocity.z)) {
        goal.x += velocity.x * dt; goal.z += velocity.z * dt; clampView(goal); view.x = goal.x; view.z = goal.z;
        const decay = Math.exp(-dt * 4); velocity.x *= decay; velocity.z *= decay;
        if (Math.hypot(velocity.x, velocity.z) < .05) velocity.x = velocity.z = 0;
      }
      clampView(goal);
      const ease = 1 - Math.exp(-dt * 7);
      if (!pointers.size) { view.x += (goal.x - view.x) * ease; view.z += (goal.z - view.z) * ease; }
      view.distance += (goal.distance - view.distance) * ease;
      camera.position.set(view.x, view.distance * .82, view.z + view.distance * .58); camera.lookAt(view.x, 0, view.z - 1);
      sun.position.set(view.x - 6, 10, view.z + 5); sun.target.position.set(view.x, 0, view.z - 1);
      const time = performance.now() / 1000, step = Math.min(dt, 1 / 30);
      if (toastTimer > 0 && (toastTimer -= dt) <= 0) toastEl.hidden = true;
      for (const entry of countries) {
        // Damped spring: the selected country lifts and bounces; others rest just above the terrain.
        const target = entry.id === selected ? .45 : 0;
        entry.speed += ((target - entry.rise) * 90 - entry.speed * 11) * step;
        entry.rise = Math.max(0, entry.rise + entry.speed * step);
        entry.tile.position.y = entry.rest + entry.rise + (target ? Math.sin(time * 2.2) * .03 : 0);
        entry.topMaterial.emissiveIntensity = entry.id === selected ? .22 + Math.sin(time * 4) * .06 : 0;
        if (entry.ring.visible) { const k = 1 + (Math.sin(time * 3) * .5 + .5) * .5; entry.ring.scale.setScalar(k); entry.ringMaterial.opacity = 1.1 - k * .55; }
        entry.banner.rotation.y = Math.sin(time * 3 + entry.x) * .25;
      }
      const shown = [];
      for (const [entry, pin] of pinFor) {
        anchor.set(entry.x, entry.tile.position.y + DEPTH + .95, entry.z).project(camera);
        const visible = anchor.z < 1 && Math.abs(anchor.x) < 1.1 && Math.abs(anchor.y) < 1.1;
        if (pin.hidden === visible) pin.hidden = !visible;
        if (!visible) continue;
        shown.push({ entry, pin, x: Math.round((anchor.x + 1) / 2 * innerWidth), y: Math.round((1 - anchor.y) / 2 * innerHeight) });
      }
      declutter(shown);
    },
    handleKeyDown(event) {
      if (event.target.closest?.('input, textarea, select, dialog')) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        if (confirming) { confirming = null; renderSheet(); } else if (selected) select(null); else if (mode === 'play') onClose?.();
        return;
      }
      if (KEYS[event.code]) { event.preventDefault(); held.add(event.code); }
    },
    handleKeyUp(event) { held.delete(event.code); },
    clearInput() { held.clear(); pointers.clear(); velocity.x = velocity.z = 0; },
    dispose() {
      unsubscribe(); events.abort(); root.remove(); document.body.classList.remove('atlas-open');
      disposeScene(scene);
      ringGeometry.dispose(); isletGeometry.dispose(); stickGeometry.dispose(); bannerGeometry.dispose();
    },
  };
}
