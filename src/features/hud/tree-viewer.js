// Tree viewer: tap a plant's 👁 → a small 3D view of THAT tree (its real model, its growth stage, ripe / green fruit),
// drag to turn it, with how it is doing (alive %, beans per harvest, age). "Manage" opens the old action card.
import * as THREE from 'three';
import { loadModel } from '../../shared/three/models.js';
import { FRUIT_K, bigBerries } from '../realm/plots.js';
import { CROPS, PERENNIAL } from '../../core/config/economy.js';
import { plotState, treeHealth, plotOf, region, treeAge, treeOld, plotNeeds, plotAlert, pruneCost, climateFit, beanPrice } from '../../core/derive.js';
import { tierZoneAt, ESTATES, ESTATE_ORDER } from '../../core/config/layout.js';
import { actionButton, needMore } from './widgets.js';
import { h } from './dom.js';
import { T, clock } from './text.js';

const FILE = { arabica: 'gedeo', robusta: 'robusta', liberica: 'liberica' };

export function openTreeViewer(ctx, plotId) {
  const s = ctx.store.state, pl = region(s)?.plots?.[plotId], crop = pl && CROPS[pl.crop];
  if (!crop || !plotOf(s, plotId)) return null;
  const st = plotState(s, plotId, Date.now()), hl = treeHealth(s, plotId), age = treeAge(pl);
  const need = plotNeeds(s, plotId, Date.now()), al = plotAlert(s, plotId, Date.now());
  const canvas = h('canvas', { class: 'hud-treeview-canvas' });
  const close = () => { if (ctx.closeTop === close) ctx.closeTop = null; cancelAnimationFrame(raf); renderer.dispose(); renderer.forceContextLoss?.(); overlay.remove(); };
  // Every action closes the viewer first (the world should be visible again), then does its job.
  const act = (type, extra = {}) => { if (ctx.blockedByAuto?.()) return null; return ctx.act(type, { plotId, ...extra }); };
  const go = fn => () => { close(); fn(); };
  const tools = [];
  if (st.stage === 'ready') tools.push(actionButton({ id: 'tvHarvest', label: T('hud.plot.harvestNow'), icon: '🧺', tone: 'gold', onClick: go(() => act('farm/harvest')) }));
  else if (!pl.watered) tools.push(actionButton({ id: 'tvWater', label: T('hud.tree.water'), icon: '💧', tone: need === 'thirst' ? 'gold' : 'plain', onClick: go(() => act('farm/water')) }));
  if (treeOld(pl)) { const cost = pruneCost(pl.crop), poor = s.player.coins < cost;
    tools.push(actionButton({ id: 'tvPrune', label: T('hud.tree.prune'), icon: '🪚', cost, tone: 'gold', disabled: poor || st.stage === 'ready', note: poor ? needMore(cost - Math.floor(s.player.coins)) : null, onClick: go(() => act('farm/prune')) })); }
  tools.push(actionButton({ id: 'tvMove', label: T('fw.field.move'), icon: '✥', tone: 'plain', onClick: go(() => { ctx.clearSelection?.(); ctx.realm?.startPlacement?.('field', { uid: plotId }); }) }));
  tools.push(actionButton({ id: 'tvUproot', label: T('hud.tree.uproot'), icon: '🪓', tone: 'plain', onClick: async () => {
    close();
    const yes = await ctx.confirm({ title: T('hud.tree.uprootTitle', { crop: T(`crop.${crop.id}`) }), body: T('hud.tree.uprootBody', { n: age }), confirmLabel: T('hud.tree.uproot') });
    if (yes) act('farm/uproot'); } }));
  // What the tree really is right now (growth stage as the game draws it), where it stands and how it is doing.
  const stageKey = st.stage === 'ready' ? 'ripe' : age === 0 ? (st.ratio < .3 ? 'seedling' : st.ratio < .62 ? 'young' : 'green') : st.ratio < .35 ? 'flower' : 'green';
  const zone = tierZoneAt(plotOf(s, plotId).x, plotOf(s, plotId).z), tierId = ESTATE_ORDER.find(e => ESTATES[e].zone === zone), fit = climateFit(pl.crop, zone);
  const tile = (ico, label, value, cls = '') => h('div', { class: `hud-tv-tile ${cls}` }, h('span', { class: 'hud-tv-ico', attrs: { 'aria-hidden': 'true' } }, ico), h('div', null, h('small', null, label), h('strong', null, value)));
  const overlay = h('div', { class: 'hud-treeview', on: { click: e => { if (e.target === overlay) close(); } } },
    h('div', { class: 'hud-treeview-card' },
      h('div', { class: 'hud-treeview-head' }, h('div', null, h('strong', null, T(`crop.${crop.id}`)), h('small', null, T(`crop.${crop.id}.alt`))),
        h('button', { type: 'button', class: 'hud-treeview-x', attrs: { 'aria-label': T('hud.place.cancel') }, on: { click: close } }, '✕')),
      need ? h('p', { class: `hud-treeview-status is-${need}` }, T(`hud.tree.need.${need}`)) : null, // a healthy tree needs no note
      al && al.left != null ? h('div', { class: `hud-treeview-timer is-${need}` }, h('div', { class: 'hud-xpbar hud-treeview-bar' }, h('span', { style: { width: `${Math.round(al.left * 100)}%` } })),
        h('small', null, al.warn ? T(`hud.tree.warn.${need}`) : T(`hud.tree.timer.${need}`, { t: clock(al.msLeft) }))) : null,
      need === 'prune' && hl ? h('small', { class: 'hud-treeview-warn' }, T('hud.tree.timer.prune', { pct: Math.round(PERENNIAL.oldYield * 100) })) : null,
      h('div', { class: 'hud-treeview-stage' }, canvas, h('span', { class: 'hud-treeview-chip' }, T(`tv.stage.${stageKey}`))),
      h('div', { class: 'hud-tv-grid' },
        tile('⏱', T('tv.lbl.ripe'), st.stage === 'ready' ? T('hud.plot.ready') : clock(st.remainingMs)),
        tile('🌳', T('tv.lbl.age'), T('tv.age', { n: age + 1, left: Math.max(0, (crop.life || 0) - age) })),
        hl ? tile('🌿', T('tv.lbl.alive'), `${hl.survival}%`, hl.survival < 70 ? 'is-bad' : '') : null,
        hl ? tile('🫘', T('tv.lbl.yield'), T('tv.yield', { n: hl.beans, coins: Math.round(hl.beans * beanPrice(pl.crop)) })) : null,
        tile('⛰️', T('tv.lbl.tier'), `${T(`estate.${tierId}`)} · ${T(`tv.fit.${fit}`)}`, fit === 'bad' ? 'is-bad' : ''),
        tile('🌡️', T('tv.lbl.likes'), `${T(`crop.${crop.id}.temp`)} · ${T(`crop.${crop.id}.height`)}`)),
      h('div', { class: 'hud-treeview-tools' }, ...tools)));
  ctx.root.append(overlay);
  ctx.closeTop = close; // Escape closes it

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const size = Math.min(320, Math.floor(innerWidth * .78));
  renderer.setSize(size, size, false); canvas.style.width = canvas.style.height = `${size}px`;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); scene.add(sun);
  const pivot = new THREE.Group(); scene.add(pivot);
  let yaw = .6, drag = null, raf = 0;
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag != null) { yaw += (e.clientX - drag) * .012; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });

  const sp = FILE[pl.crop] ? pl.crop : 'arabica', file = `farm/coffee-tree-${FILE[sp]}.glb`;
  const young = st.stage !== 'ready' && age === 0 && st.ratio < .62;
  const wanted = young ? [[`farm/coffee-stages-gedeo.glb#${st.ratio < .3 ? 'seedling' : 'young'}`, 0]]
    : [[`${file}#tree`, 0], ...(st.stage === 'ready' ? [[`${file}#fruit_ripe`, FRUIT_K[2]]] : st.ratio > .45 || age > 0 ? [[`${file}#fruit_green`, FRUIT_K[1]]] : [])];
  Promise.all(wanted.map(([path, k]) => loadModel(path).then(m => { if (m && k) m.traverse(o => { if (o.isMesh) o.geometry = bigBerries(o.geometry, k); }); return m; }))).then(models => {
    for (const m of models) if (m) pivot.add(m);
    const box = new THREE.Box3().setFromObject(pivot), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    pivot.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    const r = Math.max(sz.y, sz.x, sz.z) || 1;
    camera.position.set(0, r * .5, r * 1.75); camera.lookAt(0, r * .46, 0);
  });
  const tick = () => { raf = requestAnimationFrame(tick); if (drag == null) yaw += .006; pivot.rotation.y = yaw; renderer.render(scene, camera); };
  tick();
  return { close };
}
