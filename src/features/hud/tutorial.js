// Tutorial overlay: ONE short tip bubble at the top + a white tap-hand pointer. The step always comes from the save
// (currentStep(store.state)), so a reload resumes where the player was. Never blocks input: when a target cannot be
// found only the tip is shown. The farm and the café are separate games with their own tutorial track: only the track of
// the area on screen runs (a target in the other area still falls back to pointing at the Café / Farm button).
import { BUILDINGS, DRINKS } from '../../core/config/economy.js';
import { region, plotState, plotOf, ownedPlots, upgradeError, upgradeCost, seedCost, buildCost } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { h } from './dom.js';
import { drinkName } from '../../ui/local-menu.js';
import { T, fmt, clock } from './text.js';

const HAND_SVG = '<svg viewBox="0 0 64 72" width="56" height="63" aria-hidden="true"><path d="M24 6c3.6 0 6.5 2.9 6.5 6.5V31l2.2-.9c3.2-1.3 6.6.6 7.3 3.9l.2.9 1.6-.6c3.3-1.1 6.8 1 7.3 4.4l.1.7 1.5-.4c3.4-.8 6.7 1.6 6.9 5.1l.4 9.4c.4 9.4-6.4 17.5-15.7 18.6l-7 .8c-6.6.8-13-2.6-16-8.6L10.5 50c-1.6-3.2-.4-7 2.7-8.6 2.7-1.4 6-.7 7.9 1.6l-3.2-8V12.5C17.5 8.9 20.4 6 24 6z" fill="#fff" stroke="#3d2a1a" stroke-width="3.2" stroke-linejoin="round"/><path d="M30.5 31v9M41 34v8M51 39v6" stroke="#3d2a1a" stroke-width="2.6" stroke-linecap="round" opacity=".55"/></svg>';

/** "Tap the **soil**" → text nodes with <mark> keywords (no innerHTML from strings). */
function rich(text) {
  return String(text).split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? h('mark', null, part) : part));
}

export function createTutorial(ctx) {
  const tipText = h('span', { class: 'hud-tip-text' });
  const skip = h('button', { type: 'button', class: 'hud-tip-skip', on: { click: () => ctx.act('tutorial/set', { done: true, track: track() }) } }, T('hud.tut.skip'));
  // Tapping the tip never reaches the ground (the character would walk there): it glides the camera to the guided target.
  const tip = h('div', { class: 'hud-tip', hidden: true, attrs: { role: 'status', 'aria-live': 'polite' },
    on: { click: e => { if (!e.target.closest('.hud-tip-skip') && world) ctx.realm?.focus?.(world, { force: true }); } } },
    h('span', { class: 'hud-tip-ico', attrs: { 'aria-hidden': 'true' } }, '💡'), tipText, skip);
  const hand = h('div', { class: 'hud-hand', hidden: true });
  hand.innerHTML = `<div class="hud-hand-inner">${HAND_SVG}</div>`; // static, trusted markup
  // Target off-screen: a round arrow at the screen edge points to it; tapping it glides the camera there (Hay Day: the
  // game never yanks the camera away from the player's fingers).
  const edgeIco = h('span', { class: 'hud-edge-ico', attrs: { 'aria-hidden': 'true' } }, '➜');
  const edge = h('button', { type: 'button', class: 'hud-edge', hidden: true, attrs: { 'aria-label': T('hud.tut.goTarget') },
    on: { click: () => { if (world) ctx.realm?.focus?.(world, { force: true }); } } }, edgeIco);
  const el = h('div', { class: 'hud-tut' }, tip, hand, edge);

  // Farm and café are separate games, each with its own tutorial track: the one on screen.
  const track = () => (ctx.store.state.mode === 'cafe' ? 'cafe' : 'farm'); // the region's game
  let tipKey = '';
  let worldKey = '';        // last target sent to realm.setTutorialTarget
  let world = null;         // world target the hand follows
  let ui = null;            // DOM element the hand points at
  let pulsed = null;
  let acc = 1;              // seconds since the last re-resolve
  let handVisible = false;
  let edgeVisible = false;
  let lastFocus = '';       // step+area the camera was last pointed at
  let lastView = '';        // realm view at the last resolve (a view change re-focuses the target)

  // Keep the tip 6 px below whatever top HUD it would overlap (pills row, Auto chip/banner), on any screen size.
  // Toasts (feedback.js layout()) treat the tip as HUD above them, so they always sit under it, never on top of it.
  const placeTip = () => {
    if (tip.hidden) return;
    const tr = tip.getBoundingClientRect();
    let bottom = 0;
    for (const node of document.querySelectorAll('#hud-root :is(.hud-player, .hud-pills > *, .hud-roundmap, .hud-gear, .hud-loan-btn, .hud-auto-btn, .hud-autobar)')) {
      if (node.hidden || !node.offsetParent && getComputedStyle(node).position !== 'fixed') continue;
      for (const r of [node.getBoundingClientRect()]) {
        if (!r.width || r.right < tr.left || r.left > tr.right) continue; // only what sits above the tip horizontally
        bottom = Math.max(bottom, r.bottom);
      }
    }
    const want = bottom ? Math.round(bottom + 6) : null;
    tip.style.top = want ? `${want}px` : '';
  };
  const setTip = text => {
    if (text === tipKey) { placeTip(); return; }
    tipKey = text;
    tipText.replaceChildren(...(text ? rich(text) : []));
    tip.hidden = !text;
    placeTip();
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
    // Auto play: the tutorial pauses; the same tip bubble + tap hand narrate what the autopilot does.
    const auto = ctx.isAuto?.() && ctx.isPlaying() ? ctx.realm?.autoStatus : null;
    skip.hidden = !!auto;
    if (auto) {
      if (ctx.modals.open) { hide(); return; }
      // Caption = what the autopilot does now ({ key, params }; drink / crop ids translated here).
      const c = auto.caption, p = c?.params ? { ...c.params } : {};
      if (p.drink) p.drink = drinkName(s.world.currentRegion, p.drink, p.item); // the country's local drink name
      delete p.item;
      if (p.crop) p.crop = T(`crop.${p.crop}`);
      setTip(c ? T(c.key, p) : '');
      setUi(null);
      setWorld(ctx.sheet.openId ? null : auto.target || null);
      return;
    }
    const cur = ctx.isPlaying() && !ctx.realm?.switching ? currentStep(s, track()) : null;
    if (!cur || ctx.modals.open || ctx.staffModal?.covering) { hide(); return; } // the staff manager covers the world
    const r = region(s);
    const now = Date.now();
    const sheetId = ctx.sheet.openId;
    let text = '', target = null, node = null;
    let area = null;          // area the step happens in when it is not the target's (build: the café for shop buildings)
    // Duplicates exist now: point at the starter copy (the first one placed) — the selected copy when it is that type.
    const building = type => {
      const b = (ctx.selection?.uid && r?.buildings.find(x => x.uid === ctx.selection.uid && x.type === type)) || r?.buildings.find(x => x.type === type);
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
        const ids = Object.keys(r?.plots || {}).filter(id => plotOf(s, id)); // crops only on fields that still exist
        const ready = ids.find(id => plotState(s, id, now).stage === 'ready');
        const id = ready || ids[0];
        // While the first seed grows: keep the hands busy, plant the next empty soil (if the seeds are affordable).
        const empty = !ready && id && s.player.coins >= seedCost(s, 'robusta') ? ownedPlots(s).find(p => !r.plots[p.id]) : null;
        if (ready) text = T('tut.harvest');
        else if (empty) text = T('tut.plantMore', { time: clock(plotState(s, id, now).remainingMs) });
        else if (id) text = T('tut.growing', { time: clock(plotState(s, id, now).remainingMs) });
        else text = T('tut.plant');
        target = empty ? { kind: 'plot', id: empty.id } : id ? { kind: 'plot', id } : null;
        break;
      }
      case 'sell': {
        // Farm game: sell the harvest (middle 🫘 Sell button → storehouse card → Sell beans).
        if (selected?.kind === 'building' && selected.type === 'silo') { text = T('tut.sellBtn'); node = ctx.actionBar.el.querySelector('[data-hud-id="sellBeans"]'); }
        else { text = T('tut.sell'); node = ctx.toolbar.tradeButton; }
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
          // Café game: out of beans → import them (middle 🫘 button → Buy beans).
          text = T('tut.buyBeans');
          node = sheetId === 'beans' ? ctx.sheet.query('[data-hud-id="buyBeans"]') : ctx.toolbar.tradeButton;
        } else { text = T('tut.brew'); target = building('brewCounter'); }
        break;
      }
      case 'serve': {
        // Pick up the cup at the coffee bar, then carry it to the seated customer (hand points at them).
        const carrying = ctx.realm?.carrying;
        const o = r?.shop.orders.find(x => x.stage === 'brewing');
        if (carrying != null) { text = T('tut.deliver'); target = { kind: 'customer', orderId: carrying }; }
        else {
          text = o && o.brewStart + o.brewMs > now ? T('tut.brewing') : T('tut.serve');
          target = building('brewCounter');
        }
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
          // The card sits on its catalog tab: point at the tab first when another one is shown.
          node = ctx.sheet.query(`[data-hud-id="build-${type}"]`) || ctx.sheet.query(`[data-hud-id="buildTab-${BUILDINGS[type]?.category}"]`);
        } else if (s.player.coins < buildCost(s, type)) {
          text = T('tut.buildCoins', { name, cost: fmt(buildCost(s, type)) });
        } else {
          text = T('tut.build', { name }); node = ctx.toolbar.button('build');
          area = BUILDINGS[type].zone === 'shop' ? 'cafe' : BUILDINGS[type].zone === 'farm' ? 'farm' : null;
        }
        break;
      }
      case 'upgrade': {
        const silo = building('silo');
        // Upgrades open from the ▲ badge above the storehouse (or the Storage button): point at the badge.
        // Not enough coins (grey ▲): say how many are missing and send the player to sell coffee at the Café.
        const siloB = r?.buildings.find(b => b.type === 'silo');
        const cost = siloB ? upgradeCost('silo', siloB.level) : null;
        if (siloB && upgradeError(s, siloB) === 'coins' && cost != null) {
          // Not enough coins: grow and sell more beans (the farm earns its own coins).
          text = T('tut.upgradeCoinsFarm', { n: fmt(cost - s.player.coins), name: T('building.silo') });
          target = building('silo');
        } else if (selected?.kind === 'building' && selected.type === 'silo') { text = T('tut.upgradeBtn'); node = ctx.actionBar.el.querySelector('[data-hud-id="upgrade"]'); }
        else { text = T('tut.upgrade'); target = silo && { ...silo, upgrade: true }; }
        break;
      }
      default: text = '';
    }
    // Each region is one game: a target of the other area cannot be reached here, so it is not pointed at.
    const view = ctx.realm?.view;
    if (view !== lastView) { lastView = view; lastFocus = ''; }
    const need = area || (target && ctx.realm?.areaOf?.(target)) || null;
    if (view && need && need !== view) { target = null; if (node === ctx.toolbar.button('build')) node = null; }
    // A sheet covers the world: only point inside it (or nowhere) while one is open.
    if (sheetId) { target = null; if (node && !ctx.sheet.el.contains(node)) node = null; }
    setTip(text);
    // Camera focus: once per step (and again if the focused area changes), so the target is never off-screen.
    const focusKey = target && !node ? `${cur.step.id}:${target.kind}:${target.kind === 'plot' ? 'farm' : target.id || target.type}` : '';
    // New step: slide the camera to the target ONCE, only if it is off-screen, and only when the player is not touching
    // the screen (waits for a calm moment). The player's zoom is kept.
    if (focusKey && focusKey !== lastFocus && !ctx.realm?.placement && !ctx.realm?.switching && !ctx.realm?.busy?.(1200)) { lastFocus = focusKey; ctx.realm?.focus?.(target); }
    setWorld(node ? null : target);
    setUi(node && node.isConnected && !node.disabled ? node : null);
  }

  function placeHand(x, y) {
    if (!handVisible) { hand.hidden = false; handVisible = true; }
    hand.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  function hideHand() { if (handVisible) { hand.hidden = true; handVisible = false; } }
  // Edge arrow: on the line from the screen centre to the target, inset from the edges (clear of the top HUD and toolbar).
  function placeEdge(tx, ty) {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) { hideEdge(); return; }
    const left = 34, right = innerWidth - 34, top = 150, bottom = innerHeight - 130;
    const k = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity);
    const x = cx + dx * k, y = cy + dy * k;
    if (!edgeVisible) { edge.hidden = false; edgeVisible = true; }
    edge.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    edgeIco.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  }
  function hideEdge() { if (edgeVisible) { edge.hidden = true; edgeVisible = false; } }

  function update(dt) {
    acc += dt;
    if (acc >= .2) { acc = 0; resolve(); }
    // Hand position: the only per-frame layout read in the HUD.
    if (ui) {
      const rect = ui.getBoundingClientRect();
      if (rect.width) placeHand(rect.left + rect.width / 2, rect.top + rect.height / 2); else hideHand();
    } else if (world) {
      const p = ctx.realm?.screenPoint?.(world);
      // Near an edge counts as off-screen too (a target half cut at the border must be framed by the camera).
      let visible = p && p.visible !== false && Number.isFinite(p.x) && p.y > 110 && p.y < innerHeight - 150 && p.x > 36 && p.x < innerWidth - 36;
      // Under the open action card counts as hidden: a tap there hits the card, not the target.
      const card = ctx.actionBar?.el;
      if (visible && card && !card.hidden) {
        const r = card.getBoundingClientRect();
        if (r.height && p.y > r.top - 20 && p.x > r.left - 10 && p.x < r.right + 10) {
          visible = false;
          // Another field's card covers the next field to plant / harvest: close it (the card is not needed here).
          if (world.kind === 'plot' && ctx.selection?.kind === 'plot' && ctx.selection.id !== world.id) ctx.clearSelection?.();
          else if (!ctx.realm?.busy?.(600)) ctx.realm?.focus?.(world); // the camera's safe band (HUD insets) slides it clear
        }
      }
      if (visible) { placeHand(p.x, p.y); hideEdge(); }
      else {
        hideHand();
        // Off-screen: arrow at the screen edge towards the target (the camera stays where the player put it).
        if (p?.valid && !ctx.sheet.openId && !ctx.realm?.placement && !ctx.realm?.switching) placeEdge(p.x, p.y); else hideEdge();
      }
    } else { hideHand(); hideEdge(); }
  }

  return {
    el, update,
    refresh() { acc = 1; },
    dispose() { hide(); hideHand(); hideEdge(); el.remove(); },
  };
}
