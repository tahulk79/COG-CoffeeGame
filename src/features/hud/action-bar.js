// Contextual action card above the toolbar, driven by hud.setSelection(target). Every action goes through the store.
// Venue card ({ kind: 'venue', venue }, docs/design/cafe-street.md §3.8): a street shop — icon, name, pitch, menu with
// prices; locked → level gate or "Open X 🪙cost" (shop/openVenue; a 2nd tap after paying is a core noop); open →
// ⭐ rating (+ review count), sold this session (ctx.venueSold, counted in feedback.js) and "Go to X" (realm.focusShop).
import { BUILDINGS, CROPS, GOODS, GOOD_ORDER, VENUES, VENUE_ITEMS } from '../../core/config/economy.js';
import { PARCELS, lotAllows, terrainOfLot } from '../../core/config/layout.js';
import { region, plotOf, plotState, upgradeCost, upgradeError, levelCap, parcelError, seedCost, capacity, stored, goodCount, seatCount, seatsUsed, venueError, venueOpen, venueRating, venueReviews, venueItems,
  removeError, removeRefund, wellBonus, recipeIO, jobState, prodError, missingInput, collectError, countOf, maxCount, buildCost, buildError, nextLimitLevel, tileAt } from '../../core/derive.js';
import { newTxId } from '../../core/store.js';
import { h, setText } from './dom.js';
import { T, clock, fmt, has, duration, errorText } from './text.js';
import { buildingEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';
import { TERRAIN_ICON } from './sheets.js';
import { stars1 } from './shop-strip.js';

// Optional key (not in the locale packs yet): "Sold {n} today" — falls back to "🧾 ×n" until it exists.
const SOLD_KEY = 'hud.venue.sold';
const own = (o, k) => (typeof k === 'string' && Object.hasOwn(o, k) ? o[k] : undefined);

/** Open a street venue (lemon / tea / bar). The core answers 'owned' with {noop:true}, so a double tap never pays twice;
 *  coins / level failures toast through ctx.act (err.coins "need N more"). Success → the camera zooms to the new shop. */
export function openVenue(ctx, id) {
  if (ctx.openingVenue || !own(VENUES, id) || id === 'cafe') return null;
  if (venueError(ctx.store.state, id) === 'level') { // err.level wants {minLevel}; say it with the venue wording instead
    ctx.toast?.(T('hud.venue.needLevel', { level: VENUES[id].level }), 'bad');
    return null;
  }
  ctx.openingVenue = true;
  try {
    const r = ctx.act('shop/openVenue', { venue: id }, { txId: newTxId('venue') }); // failures toast inside ctx.act
    if (r.ok && !r.noop && !r.duplicate) ctx.realm?.focusShop?.(id);
    return r;
  } finally { ctx.openingVenue = false; }
}

// Two taps to remove: the first turns the button into "Remove for X?", the second acts (ARMED_MS to confirm).
const ARMED_MS = 3500;
// Land card ({ kind: 'land' }): a ground tap also walks the avatar, so the card goes away by itself.
const LAND_IDLE_MS = 6000, LAND_WALK_AWAY = 4;
const goodsText = io => Object.entries(io || {}).map(([g, n]) => `${fmt(n)} ${GOODS[g]?.icon || ''}`.trim()).join(' + ');

export function createActionBar(ctx) {
  const title = h('div', { class: 'hud-card-title' });
  const body = h('div', { class: 'hud-card-body' });
  const close = h('button', { type: 'button', class: 'hud-x', attrs: { 'aria-label': T('hud.close') }, on: { click: () => ctx.clearSelection() } }, '×');
  const el = h('section', { class: 'hud-action', hidden: true, attrs: { 'aria-live': 'polite' } }, h('header', { class: 'hud-card-head' }, title, close), body);
  let sig = '';
  let countdown = null; // { el, plotId } updated in update()
  let prodLive = null;  // { uid, bar, time } of a working batch, updated in place (no rebuild while it runs)
  let venueLive = null; // { id, name, line, avg, n, sold } spans of an open venue card, updated in place
  let armed = null;     // { id, until } a Remove / Clear button waiting for its confirming 2nd tap
  let land = null;      // { key, touched, best } auto-hide bookkeeping of the land card
  let tick = 0;
  const isArmed = id => !!armed && armed.id === id && Date.now() < armed.until;
  el.addEventListener('pointerdown', () => { if (land) land.touched = Date.now(); });

  // Never by type when a uid is known (duplicates exist): only an old type-only target falls back to the first one.
  function building(s, target) {
    const r = region(s);
    if (!r) return null;
    if (target.uid) return r.buildings.find(b => b.uid === target.uid) || null;
    return r.buildings.find(b => b.type === target.type) || null;
  }

  // Model → signature, so the card only rebuilds when something visible changed.
  function model(s, target) {
    if (!target || !region(s)) return null;
    const coins = s.player.coins, now = Date.now();
    switch (target.kind) {
      case 'plot': {
        if (!plotOf(s, target.id)) return null;
        const st = plotState(s, target.id, now);
        const crop = ctx.realm?.activeCrop || 'robusta';
        const rmErr = removeError(s, target.id);
        return { kind: 'plot', id: target.id, stage: st.stage, crop: st.crop || null, active: crop, seed: seedCost(s, crop),
          rmErr, refund: rmErr ? 0 : removeRefund(s, target.id), armed: isArmed(target.id), well: Math.round(wellBonus(s, target.id) * 100) };
      }
      case 'land': {
        const x = Number(target.x), z = Number(target.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
        const tile = tileAt(s, x, z);
        const lot = target.lot || tile?.lot;
        if (!lot || !PARCELS[lot] || !region(s).parcels.includes(lot)) return null;
        const terrain = tile?.lot === lot && !['road', 'plaza', 'wild'].includes(tile.terrain) ? tile.terrain : terrainOfLot(lot);
        const fErr = buildError(s, 'field');
        return { kind: 'land', x, z, lot, terrain, field: lotAllows(lot, 'field'), building: lotAllows(lot, 'building'), decor: lotAllows(lot, 'decor'),
          fieldCost: buildCost(s, 'field'), fErr: fErr === 'coins' ? null : fErr, next: fErr === 'limit' ? nextLimitLevel(s, 'field') : null };
      }
      case 'building': {
        const b = building(s, target);
        const def = b && BUILDINGS[b.type];
        if (!def) return null;
        const err = upgradeError(s, b);
        const rmErr = removeError(s, b.uid);
        const m = { kind: 'building', uid: b.uid, type: b.type, level: b.level, cap: levelCap(s), err, upgrade: !!target.upgrade, cost: upgradeCost(b.type, b.level),
          missing: err === 'coins' ? upgradeCost(b.type, b.level) - coins : 0, count: countOf(s, b.type), max: maxCount(s, b.type),
          rmErr, refund: rmErr ? 0 : removeRefund(s, b.uid), armed: isArmed(b.uid) };
        // Production: the stage is in the signature; the progress / countdown of a running batch update in place.
        const io = recipeIO(b);
        if (io) {
          const js = jobState(b, now);
          const perr = js.stage === 'idle' ? prodError(s, b) : null;
          const miss = perr === 'noInput' ? missingInput(s, b) : null;
          m.prod = { in: io.in, out: js.stage === 'idle' ? io.out : js.out || io.out, fee: io.fee, ms: js.stage === 'idle' ? io.ms : b.job.ms, stage: js.stage, err: perr,
            miss: miss ? { good: miss.good, need: miss.need } : null, feeMissing: perr === 'coins' ? Math.ceil(io.fee - coins) : 0,
            cErr: js.stage === 'ready' ? collectError(s, b, now) : null };
        }
        // Storehouse / barn: every good stored, its price, the shared capacity.
        if (def.effect?.capacity) m.store = { goods: GOOD_ORDER.map(g => [g, Math.floor(goodCount(s, g))]), stored: stored(s), cap: capacity(s) };
        if (b.type === 'orderCounter' || b.type === 'tables') m.seats = { used: seatsUsed(s), seats: seatCount(s) };
        return m;
      }
      case 'parcel': {
        const p = PARCELS[target.id];
        if (!p) return null;
        const err = parcelError(s, p.id);
        return { kind: 'parcel', id: p.id, err, missing: err === 'coins' ? p.cost - Math.floor(coins) : 0 }; // no raw coins: a rebuild per sale eats taps
      }
      case 'gate': return { kind: 'gate' };
      case 'venue': {
        const id = target.venue;
        if (!own(VENUES, id)) return null;
        const open = venueOpen(s, id), err = open ? null : venueError(s, id);
        // Rating / count / sold change on every sale: kept out of the signature, updated in place (updateVenueLive).
        return { kind: 'venue', id, open, err, missing: err === 'coins' ? VENUES[id].cost - Math.floor(coins) : 0,
          focused: ctx.realm?.focusedShop === id };
      }
      default: return null;
    }
  }

  function render(s, target) {
    const m = model(s, target);
    const nextSig = m ? JSON.stringify(m) : '';
    if (nextSig === sig) { updateVenueLive(s); return; }
    sig = nextSig;
    countdown = null;
    prodLive = null;
    venueLive = null;
    el.hidden = !m;
    el.dataset.kind = m?.kind || '';
    body.replaceChildren();
    // A new land spot restarts the auto-hide clock (same spot re-rendered: keep it).
    const landKey = m?.kind === 'land' ? `${m.x},${m.z}` : null;
    if (!landKey) land = null; else if (land?.key !== landKey) land = { key: landKey, touched: Date.now(), best: Infinity };
    if (!m) return;
    const fill = { plot: plotCard, land: landCard, building: buildingCard, parcel: parcelCard, gate: gateCard, venue: venueCard }[m.kind];
    fill(m, s);
    updateVenueLive(s);
    updateProd(s);
  }
  const rerender = () => { sig = ''; render(ctx.store.state, ctx.selection); };
  function updateVenueLive(s) {
    if (!venueLive) return;
    const { id, name, line, avg, n, sold } = venueLive;
    const a = stars1(venueRating(s, id)), k = venueReviews(s, id), q = ctx.venueSold?.[id] || 0;
    setText(avg, `⭐ ${a}`);
    setText(n, k ? ` (${fmt(k)})` : '');
    setText(sold, q ? (has(SOLD_KEY) ? T(SOLD_KEY, { n: fmt(q) }) : `🧾 ×${fmt(q)}`) : '');
    sold.hidden = !q;
    const label = T('hud.rating.aria', { name, avg: a });
    if (line.getAttribute('aria-label') !== label) line.setAttribute('aria-label', label);
  }

  // Remove / Clear: disabled with the reason, or two taps ("Remove for X?" first). `confirm` false → acts at once.
  function removeButton(id, m, { label, icon, confirm, busyNote, confirmText = null }) {
    if (m.rmErr === 'fixed' || m.rmErr === 'unknown') return null;
    const note = m.rmErr === 'fieldBusy' || m.rmErr === 'jobBusy' ? busyNote : m.rmErr ? errorText(m.rmErr) : null;
    const ask = confirm && m.armed;
    const btn = actionButton({ id: 'remove', label: ask ? (m.refund > 0 || !confirmText ? T('fw.building.removeConfirm', { refund: fmt(m.refund) }) : confirmText) : label, icon, tone: ask ? 'gold' : 'plain',
      cost: !ask && m.refund > 0 ? m.refund : null, disabled: !!m.rmErr, note,
      onClick: () => {
        if (ctx.blockedByAuto?.()) return;
        if (confirm && !isArmed(id)) { armed = { id, until: Date.now() + ARMED_MS }; rerender(); return; }
        armed = null;
        const r = ctx.act('build/remove', { uid: id });
        if (r.ok) ctx.clearSelection(); else rerender();
      } });
    if (ask) btn.classList.add('is-armed');
    return btn;
  }

  function plotCard(m, s) {
    const crop = CROPS[m.crop];
    setText(title, crop ? `${crop.icon} ${T(`crop.${crop.id}`)}` : `🟫 ${T('hud.plot.soil')}`);
    if (m.stage === 'empty') {
      const active = CROPS[m.active];
      body.append(h('p', { class: 'hud-line' }, T('hud.plot.empty', { crop: T(`crop.${m.active}`), icon: active.icon })),
        h('div', { class: 'hud-row' }, actionButton({ label: T('hud.plot.changeSeed'), icon: '🌱', tone: 'plain', onClick: () => ctx.onTool('seeds') })));
    } else if (m.stage === 'ready') {
      body.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.plot.ready')), h('p', { class: 'hud-hint' }, T('hud.plot.harvestHint')));
    } else {
      const time = h('strong', { class: 'hud-countdown' });
      body.append(h('p', { class: 'hud-line' }, T('hud.plot.growing'), ' ', time));
      countdown = { el: time, plotId: m.id };
      updateCountdown(s);
    }
    if (m.well) body.append(h('p', { class: 'hud-line hud-line--muted' }, T('fw.field.wellOn', { v: m.well })));
    // Field tools: Move (keeps a growing crop) · Clear (only empty fields; always two taps, "Clear field?" first).
    body.append(h('div', { class: 'hud-row hud-row--tools' },
      actionButton({ id: 'fieldMove', label: T('fw.field.move'), icon: '✥', tone: 'plain',
        onClick: () => { if (ctx.blockedByAuto?.()) return; ctx.clearSelection(); ctx.realm?.startPlacement?.('field', { uid: m.id }); } }),
      removeButton(m.id, m, { label: T('fw.field.clear'), icon: '🧹', confirm: true, confirmText: T('fw.field.clearConfirm'), busyNote: T('fw.field.busy') })));
  }

  // Empty owned land: Field / Build / Decor (what the terrain does not allow is greyed out).
  function landCard(m) {
    setText(title, `${TERRAIN_ICON[m.terrain] || '🌾'} ${T(`fw.land.terrain.${m.terrain}`)}`);
    const fieldNote = m.field && m.fErr ? (m.fErr === 'limit' ? T('err.limit', { level: m.next }) : errorText(m.fErr)) : null;
    const field = actionButton({ id: 'landField', label: T('fw.land.field'), icon: '🟫', cost: m.field && !m.fErr ? m.fieldCost : null, disabled: !m.field || !!m.fErr, note: fieldNote,
      onClick: () => {
        if (ctx.blockedByAuto?.()) return;
        const s = ctx.store.state, err = buildError(s, 'field');
        if (err === 'coins') { ctx.toast(needMore(buildCost(s, 'field') - Math.floor(s.player.coins)), 'bad'); return; }
        ctx.clearSelection();
        ctx.realm?.startPlacement?.('field', { near: { x: m.x, z: m.z } });
      } });
    const build = actionButton({ id: 'landBuild', label: T('fw.land.build'), icon: '🏠', tone: 'plain', disabled: !m.building, onClick: () => { ctx.buildNear = { x: m.x, z: m.z }; ctx.openBuild?.('processing'); } }); // the ghost starts at the tapped spot
    const decor = actionButton({ id: 'landDecor', label: T('fw.land.decor'), icon: '🌼', tone: 'plain', disabled: !m.decor, onClick: () => { ctx.buildNear = { x: m.x, z: m.z }; ctx.openBuild?.('decoration'); } });
    body.append(h('div', { class: 'hud-land-btns' }, field, build, decor));
  }

  function prodBlock(m) {
    const p = m.prod;
    const wrap = h('div', { class: `hud-prod is-${p.stage}` },
      h('p', { class: 'hud-prod-io' }, h('span', { class: 'hud-prod-goods' }, goodsText(p.in)), h('span', { class: 'hud-prod-arrow', attrs: { 'aria-hidden': 'true' } }, '➜'),
        h('span', { class: 'hud-prod-goods is-out' }, goodsText(p.out)),
        h('span', { class: 'hud-prod-meta' }, `⏱ ${duration(p.ms)}`, p.fee > 0 ? h('span', { class: 'hud-prod-fee' }, ' · ⛽', coinAmount(p.fee)) : null)));
    if (p.stage === 'working') {
      const time = h('strong', { class: 'hud-countdown' });
      const fill = h('span');
      wrap.append(h('p', { class: 'hud-line' }, T('fw.prod.working'), ' ', time),
        h('div', { class: 'hud-xpbar hud-prod-bar', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' } }, fill));
      prodLive = { uid: m.uid, bar: fill, time };
    } else if (p.stage === 'ready') {
      const full = p.cErr === 'storageFull';
      wrap.append(h('div', { class: 'hud-row' }, actionButton({ id: 'prodCollect', label: T('fw.prod.collect'), icon: '📥', tone: 'gold', disabled: full,
        note: full ? T('fw.prod.full') : null, onClick: () => ctx.act('prod/collect', { uid: m.uid }) })));
    } else {
      const note = p.err === 'noInput' && p.miss ? T('fw.prod.needs', { need: `${fmt(p.miss.need)} ${GOODS[p.miss.good]?.icon || ''}` })
        : p.err === 'coins' ? needMore(p.feeMissing) : p.err ? errorText(p.err) : null;
      wrap.append(h('div', { class: 'hud-row' }, actionButton({ id: 'prodStart', label: T('fw.prod.start'), icon: '▶', disabled: !!p.err, note,
        onClick: () => ctx.act('prod/start', { uid: m.uid }) })));
    }
    return wrap;
  }

  function storeBlock(m) {
    const st = m.store, full = st.cap > 0 && st.stored >= st.cap, pct = st.cap > 0 ? Math.min(100, Math.round(st.stored / st.cap * 100)) : 0;
    const wrap = h('div', { class: 'hud-store' },
      h('p', { class: `hud-line hud-store-fill${full ? ' hud-line--bad' : ''}` }, T('fw.goods.fill', { n: fmt(st.stored), max: fmt(st.cap) })),
      h('div', { class: `hud-xpbar hud-capbar${full ? ' is-full' : ''}`, attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.cap), 'aria-valuenow': String(st.stored) } },
        h('span', { style: { width: `${pct}%` } })));
    const list = h('ul', { class: 'hud-goods' });
    let kinds = 0, total = 0;
    for (const [g, n] of st.goods) {
      if (g !== 'beans' && n <= 0) continue; // beans always listed: the tutorial's Sell button lives on that row
      if (n > 0) { kinds++; total += n * GOODS[g].price; }
      const beans = g === 'beans';
      list.append(h('li', { class: 'hud-good' },
        h('span', { class: 'hud-good-ico', attrs: { 'aria-hidden': 'true' } }, GOODS[g].icon),
        h('span', { class: 'hud-good-text' }, h('strong', null, `${T(`good.${g}`)} ×${fmt(n)}`), h('small', null, T('fw.goods.each', { price: fmt(GOODS[g].price) }))),
        actionButton({ id: beans ? 'sellBeans' : `sell-${g}`, label: T('fw.goods.sell', { n: fmt(n) }), cost: n > 0 ? n * GOODS[g].price : null, tone: 'gold', disabled: n < 1,
          note: beans && n < 1 ? T('hud.beans.none') : null, onClick: () => (beans ? ctx.act('farm/sellBeans') : ctx.act('farm/sell', { good: g })) })));
    }
    wrap.append(list);
    if (kinds > 1) wrap.append(h('div', { class: 'hud-row' }, actionButton({ id: 'sellAll', label: T('fw.goods.sellAll'), icon: '💰', cost: total, tone: 'gold', onClick: () => ctx.act('farm/sellAll') })));
    if (kinds <= 1 && m.type === 'silo') wrap.append(h('p', { class: 'hud-line hud-line--muted' }, T(full ? 'hud.storage.explainFull' : 'hud.storage.explain')));
    return wrap;
  }

  function buildingCard(m) {
    const def = BUILDINGS[m.type];
    const max = def.decor ? 1 : def.upgrade.length + 1;
    title.replaceChildren(`${def.icon} ${T(`building.${m.type}`)}`,
      def.decor ? '' : h('span', { class: 'hud-title-lv' }, T('fw.building.lv', { level: m.level, max: Math.min(m.cap, max) })));
    if (m.prod) body.append(prodBlock(m));
    if (m.store) body.append(storeBlock(m));
    if (m.seats) body.append(h('p', { class: 'hud-line' }, T('hud.seats.line', { n: m.seats.used, max: m.seats.seats })));
    body.append(h('p', { class: 'hud-line hud-line--fx' }, buildingEffect(m.type, m.level, m.err !== 'maxLevel' && m.err !== 'roundCap')));
    if (m.max > 1) body.append(h('p', { class: 'hud-sub' }, T('fw.building.countLine', { n: m.count, max: m.max })));
    const row = h('div', { class: 'hud-row' });
    // Upgrades are reached only through the ▲ badge above the building (target.upgrade); a body tap shows the info card.
    if (!def.decor && !m.upgrade) {
      if (m.err === null || m.err === 'coins') body.append(h('p', { class: 'hud-hint' }, T('hud.upgradeHint')));
    } else if (!def.decor) {
      if (m.err === 'maxLevel') row.append(h('span', { class: 'hud-tag' }, T('hud.maxLevel')));
      else if (m.err === 'roundCap') row.append(h('span', { class: 'hud-tag' }, T('hud.maxForRound')));
      else row.append(actionButton({ id: 'upgrade', label: T('hud.upgrade'), icon: '⬆️', cost: m.cost, disabled: m.err === 'coins', note: m.err === 'coins' ? needMore(m.missing) : null,
        onClick: () => ctx.act('build/upgrade', { uid: m.uid }) }));
    }
    if (row.childNodes.length) body.append(row);
    const tools = h('div', { class: 'hud-row hud-row--tools' });
    if (!def.fixed) tools.append(actionButton({ id: 'move', label: T('hud.move'), icon: '✥', tone: 'plain', onClick: () => { if (ctx.blockedByAuto?.()) return; ctx.clearSelection(); ctx.realm?.startPlacement?.(m.type, { uid: m.uid }); } }));
    const rm = removeButton(m.uid, m, { label: T('fw.building.remove'), icon: '🗑️', confirm: true, busyNote: T('fw.building.busy') });
    if (rm) tools.append(rm);
    if (tools.childNodes.length) body.append(tools);
  }

  function parcelCard(m) {
    const p = PARCELS[m.id];
    // Lot kinds: farm (fields), build (workshops), decor, pasture, pond, orchard, shop (café lots).
    const ICONS = { farm: '🌾', build: '🏗️', decor: '🌼', pasture: '🐔', pond: '🦆', orchard: '🍎', shop: '☕' };
    setText(title, `${ICONS[p.kind] || '🌾'} ${T(`hud.parcel.${p.kind}`, { id: p.id })}`);
    if (m.err === 'owned') { body.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.parcel.owned'))); return; }
    body.append(h('p', { class: 'hud-line' }, T(`hud.parcel.${p.kind}Info`)));
    // Far land: no open road reaches it yet → buy the land next to it first.
    if (m.err === 'road') { body.append(h('p', { class: 'hud-line hud-line--muted' }, '🔒 ', T('hud.parcel.noRoad'))); return; }
    body.append(h('div', { class: 'hud-row' }, actionButton({ id: 'buy', label: T('hud.buy'), icon: '🏷️', cost: p.cost, disabled: m.err === 'coins',
      note: m.err === 'coins' ? needMore(m.missing) : null, onClick: () => ctx.act('land/buyParcel', { parcelId: p.id }) })));
  }

  function venueCard(m) {
    const def = VENUES[m.id], name = T(`venue.${m.id}`);
    setText(title, `${def.icon} ${name}`);
    if (has(`hud.venue.desc.${m.id}`)) body.append(h('p', { class: 'hud-line hud-line--muted' }, T(`hud.venue.desc.${m.id}`)));
    const items = venueItems(m.id).map(i => own(VENUE_ITEMS, i)).filter(Boolean);
    if (items.length) body.append(h('ul', { class: 'hud-venue-menu' }, items.map(it => h('li', null,
      h('span', { attrs: { 'aria-hidden': 'true' } }, it.icon), h('span', { class: 'hud-venue-item' }, T(`item.${it.id}`)), coinAmount(it.price)))));
    const row = h('div', { class: 'hud-row' });
    if (m.open) {
      const avg = h('strong'), n = h('span', { class: 'hud-sub' }), sold = h('span', { class: 'hud-venue-sold' });
      const line = h('p', { class: 'hud-line hud-venue-rating' }, h('span', { class: 'hud-sub' }, T('hud.rating.title')), ' ', avg, n, sold);
      body.append(line);
      venueLive = { id: m.id, name, line, avg, n, sold };
      if (!m.focused) row.append(actionButton({ id: 'venueGo', label: T('hud.street.focus', { name }), icon: '👉', tone: 'plain', onClick: () => ctx.realm?.focusShop?.(m.id) }));
    } else if (m.err === 'level') {
      row.append(lockTag(T('hud.venue.needLevel', { level: def.level })), h('span', { class: 'hud-sub' }, T('hud.venue.cost', { cost: fmt(def.cost) })));
    } else {
      row.append(actionButton({ id: 'openVenue', label: T('hud.venue.open', { name }), icon: '🔑', cost: def.cost, disabled: m.err === 'coins',
        note: m.err === 'coins' ? needMore(m.missing) : null, onClick: () => openVenue(ctx, m.id) }));
    }
    if (row.childNodes.length) body.append(row);
  }

  function gateCard() {
    setText(title, `⛩️ ${T('hud.gate')}`);
    body.append(h('p', { class: 'hud-line' }, T('hud.gate.info')),
      h('div', { class: 'hud-row' }, actionButton({ label: T('hud.worldMap'), icon: '🌍', onClick: () => ctx.onOpenAtlas?.() })));
  }

  function updateCountdown(s) {
    if (!countdown) return;
    const st = plotState(s, countdown.plotId, Date.now());
    setText(countdown.el, clock(st.remainingMs));
  }
  function updateProd(s) {
    if (!prodLive) return;
    const b = region(s)?.buildings.find(x => x.uid === prodLive.uid);
    const js = jobState(b, Date.now());
    prodLive.bar.style.width = `${Math.round(js.ratio * 100)}%`;
    prodLive.bar.parentElement?.setAttribute('aria-valuenow', String(Math.round(js.ratio * 100)));
    setText(prodLive.time, clock(js.remainingMs));
  }
  // Land card: gone after LAND_IDLE_MS without a touch, or once the avatar walks away from the spot (cheap: one hypot).
  function updateLand() {
    const sel = ctx.selection;
    if (!land || sel?.kind !== 'land') return;
    const now = Date.now();
    if (now - land.touched > LAND_IDLE_MS) { land = null; ctx.clearSelection(); return; }
    const raw = ctx.realm?.avatarPosition;
    const a = typeof raw === 'function' ? raw.call(ctx.realm) : raw;
    if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.z)) return;
    const d = Math.hypot(a.x - Number(sel.x), a.z - Number(sel.z));
    land.best = Math.min(land.best, d);
    if (d > land.best + LAND_WALK_AWAY) { land = null; ctx.clearSelection(); }
  }

  function update(dt) {
    tick += dt;
    if (tick < .25) return;
    tick = 0;
    const s = ctx.store.state;
    render(s, ctx.selection); // cheap: rebuilds only when the model signature changed (e.g. crop became ready)
    updateCountdown(s);
    updateProd(s);
    updateLand();
  }
  return { el, render, update, dispose() {} };
}
