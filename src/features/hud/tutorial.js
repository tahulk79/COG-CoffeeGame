// Tutorial overlay: ONE short tip bubble at the top + a white tap-hand pointer. The step always comes from the save
// (currentStep(store.state)), so a reload resumes where the player was. Never blocks input: when a target cannot be
// found only the tip is shown. The farm and the café are separate views: when the step's target is in the other area,
// the hand points at the toolbar's Café / Farm button instead ("Tap Café to open your café").
import { BUILDINGS, DRINKS } from '../../core/config/economy.js';
import { region, plotState, ownedPlots } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { h } from './dom.js';
import { T, fmt, clock } from './text.js';

const HAND_SVG = '<svg viewBox="0 0 64 72" width="56" height="63" aria-hidden="true"><path d="M24 6c3.6 0 6.5 2.9 6.5 6.5V31l2.2-.9c3.2-1.3 6.6.6 7.3 3.9l.2.9 1.6-.6c3.3-1.1 6.8 1 7.3 4.4l.1.7 1.5-.4c3.4-.8 6.7 1.6 6.9 5.1l.4 9.4c.4 9.4-6.4 17.5-15.7 18.6l-7 .8c-6.6.8-13-2.6-16-8.6L10.5 50c-1.6-3.2-.4-7 2.7-8.6 2.7-1.4 6-.7 7.9 1.6l-3.2-8V12.5C17.5 8.9 20.4 6 24 6z" fill="#fff" stroke="#3d2a1a" stroke-width="3.2" stroke-linejoin="round"/><path d="M30.5 31v9M41 34v8M51 39v6" stroke="#3d2a1a" stroke-width="2.6" stroke-linecap="round" opacity=".55"/></svg>';

/** "Tap the **soil**" → text nodes with <mark> keywords (no innerHTML from strings). */
function rich(text) {
  return String(text).split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? h('mark', null, part) : part));
}

export function createTutorial(ctx) {
  const tipText = h('span', { class: 'hud-tip-text' });
  const skip = h('button', { type: 'button', class: 'hud-tip-skip', on: { click: () => ctx.act('tutorial/set', { done: true }) } }, T('hud.tut.skip'));
  const tip = h('div', { class: 'hud-tip', hidden: true, attrs: { role: 'status', 'aria-live': 'polite' } },
    h('span', { class: 'hud-tip-ico', attrs: { 'aria-hidden': 'true' } }, '💡'), tipText, skip);
  const hand = h('div', { class: 'hud-hand', hidden: true });
  hand.innerHTML = `<div class="hud-hand-inner">${HAND_SVG}</div>`; // static, trusted markup
  const el = h('div', { class: 'hud-tut' }, tip, hand);

  let tipKey = '';
  let worldKey = '';        // last target sent to realm.setTutorialTarget
  let world = null;         // world target the hand follows
  let ui = null;            // DOM element the hand points at
  let pulsed = null;
  let acc = 1;              // seconds since the last re-resolve
  let handVisible = false;
  let offscreen = 0;        // seconds the world target has been off-screen
  let lastFocus = '';       // step+area the camera was last pointed at
  let lastView = '';        // realm view at the last resolve (a view change re-focuses the target)

  const setTip = text => {
    if (text === tipKey) return;
    tipKey = text;
    tipText.replaceChildren(...(text ? rich(text) : []));
    tip.hidden = !text;
  };
  const setWorld = target => {
    world = target;
    const key = target ? JSON.stringify(target) : '';
    if (key === worldKey) return;
    worldKey = key;
    ctx.realm?.setTutorialTarget?.(target);
  };
  const setUi = node => {
    ui = node;
    if (pulsed === node) return;
    pulsed?.classList.remove('hud-pulse');
    node?.classList.add('hud-pulse');
    pulsed = node;
  };
  const hide = () => { setTip(''); setWorld(null); setUi(null); };

  // Decides the tip + pointer target for the current step. Runs ~5×/s (and on store changes), not every frame.
  function resolve() {
    const s = ctx.store.state;
    const cur = ctx.isPlaying() ? currentStep(s) : null;
    if (!cur || ctx.modals.open) { hide(); return; }
    const r = region(s);
    const now = Date.now();
    const sheetId = ctx.sheet.openId;
    let text = '', target = null, node = null;
    let area = null;          // area the step happens in when it is not the target's (build: the café for shop buildings)
    let beansFirst = false;   // brew step without enough beans: back to the farm
    const building = type => {
      const b = r?.buildings.find(x => x.type === type);
      return b ? { kind: 'building', uid: b.uid, type } : null;
    };
    const selected = ctx.selection;
    switch (cur.step.id) {
      case 'plant': {
        const plot = ownedPlots(s).find(p => !r.plots[p.id]);
        text = T('tut.plant');
        target = plot ? { kind: 'plot', id: plot.id } : null;
        break;
      }
      case 'harvest': {
        const ids = Object.keys(r?.plots || {});
        const ready = ids.find(id => plotState(s, id, now).stage === 'ready');
        const id = ready || ids[0];
        if (ready) text = T('tut.harvest');
        else if (id) text = T('tut.growing', { time: clock(plotState(s, id, now).remainingMs) });
        else text = T('tut.plant');
        target = id ? { kind: 'plot', id } : null;
        break;
      }
      case 'takeOrder': {
        const waiting = r?.shop.orders.some(o => o.stage === 'waiting');
        text = T(waiting ? 'tut.takeOrder' : 'tut.waitCustomer');
        target = building('orderCounter');
        break;
      }
      case 'brew': {
        const order = r?.shop.orders.find(o => o.stage === 'taken');
        const need = order ? DRINKS[order.drink]?.beans || 1 : 1;
        if (s.inventory.beans < need) {
          text = T('tut.needBeans');
          beansFirst = true;
          const plot = ownedPlots(s).find(p => plotState(s, p.id, now).stage === 'ready') || ownedPlots(s).find(p => !r.plots[p.id]);
          target = plot ? { kind: 'plot', id: plot.id } : null;
        } else { text = T('tut.brew'); target = building('brewCounter'); }
        break;
      }
      case 'serve': {
        const o = r?.shop.orders.find(x => x.stage === 'brewing');
        const left = o ? o.brewStart + o.brewMs - now : 0;
        text = o && left > 0 ? T('tut.brewing', { time: clock(left) }) : T('tut.serve');
        target = building('brewCounter');
        break;
      }
      case 'build': {
        const type = cur.step.buildType || 'roaster';
        const name = T(`building.${type}`);
        const p = ctx.realm?.placement;
        if (p) {
          text = p.type === type ? T('tut.place') : T('tut.placeAny');
          if (p.valid) node = ctx.placement.okButton;
        } else if (sheetId === 'build') {
          text = T('tut.pick', { name });
          node = ctx.sheet.query(`[data-hud-id="build-${type}"]`);
        } else if (s.player.coins < BUILDINGS[type].cost) {
          text = T('tut.buildCoins', { name, cost: fmt(BUILDINGS[type].cost) });
        } else {
          text = T('tut.build', { name }); node = ctx.toolbar.button('build');
          area = BUILDINGS[type].zone === 'shop' ? 'cafe' : BUILDINGS[type].zone === 'farm' ? 'farm' : null;
        }
        break;
      }
      case 'upgrade': {
        const silo = building('silo');
        if (selected?.kind === 'building' && selected.type === 'silo') { text = T('tut.upgradeBtn'); node = ctx.actionBar.el.querySelector('[data-hud-id="upgrade"]'); }
        else { text = T('tut.upgrade'); target = silo; }
        break;
      }
      case 'buyLand': {
        const id = cur.step.target.id;
        if (selected?.kind === 'parcel' && selected.id === id) { text = T('tut.buyBtn'); node = ctx.actionBar.el.querySelector('[data-hud-id="buy"]'); }
        else { text = T('tut.buyLand'); target = { kind: 'parcel', id }; }
        break;
      }
      default: text = '';
    }
    // Target in the other area (farm ⇄ café): point at the view-switch button instead.
    const view = ctx.realm?.view;
    if (view !== lastView) { lastView = view; lastFocus = ''; }
    const need = area || (target && ctx.realm?.areaOf?.(target)) || null;
    if (view && need && need !== view && !sheetId && !ctx.realm?.placement) {
      text = T(need === 'cafe' ? 'tut.goCafe' : beansFirst ? 'tut.goFarmBeans' : 'tut.goFarm');
      target = null;
      node = ctx.toolbar.viewButton;
    }
    // A sheet covers the world: only point inside it (or nowhere) while one is open.
    if (sheetId) { target = null; if (node && !ctx.sheet.el.contains(node)) node = null; }
    setTip(text);
    // Camera focus: once per step (and again if the focused area changes), so the target is never off-screen.
    const focusKey = target && !node ? `${cur.step.id}:${target.kind}:${target.kind === 'plot' ? 'farm' : target.id || target.type}` : '';
    if (focusKey && focusKey !== lastFocus && !ctx.realm?.placement && !ctx.realm?.switching) { lastFocus = focusKey; ctx.realm?.focus?.(target, { zoom: 1 }); }
    setWorld(node ? null : target);
    setUi(node && node.isConnected && !node.disabled ? node : null);
  }

  function placeHand(x, y) {
    if (!handVisible) { hand.hidden = false; handVisible = true; }
    hand.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  function hideHand() { if (handVisible) { hand.hidden = true; handVisible = false; } }

  function update(dt) {
    acc += dt;
    if (acc >= .2) { acc = 0; resolve(); }
    // Hand position: the only per-frame layout read in the HUD.
    if (ui) {
      const rect = ui.getBoundingClientRect();
      if (rect.width) placeHand(rect.left + rect.width / 2, rect.top + rect.height / 2); else hideHand();
    } else if (world) {
      const p = ctx.realm?.screenPoint?.(world);
      const visible = p && p.visible !== false && Number.isFinite(p.x) && p.y > 90 && p.y < innerHeight - 90;
      if (visible) { placeHand(p.x, p.y); offscreen = 0; }
      else {
        hideHand();
        // Target hidden (player panned or tapped elsewhere) for 2 s → bring the camera back to it.
        offscreen += dt;
        if (offscreen > 2 && !ctx.realm?.placement && !ctx.sheet.openId && !ctx.realm?.switching) { offscreen = 0; ctx.realm?.focus?.(world, { zoom: 1 }); }
      }
    } else hideHand();
  }

  return {
    el, update,
    refresh() { acc = 1; },
    dispose() { hide(); hideHand(); el.remove(); },
  };
}
