// Contextual action card above the toolbar, driven by hud.setSelection(target). Every action goes through the store.
// Venue card ({ kind: 'venue', venue }, docs/design/cafe-street.md §3.8): a street shop — icon, name, pitch, menu with
// prices; locked → level gate or "Open X 🪙cost" (shop/openVenue; a 2nd tap after paying is a core noop); open →
// ⭐ rating (+ review count), sold this session (ctx.venueSold, counted in feedback.js) and "Go to X" (realm.focusShop).
import { BUILDINGS, CROPS, GOODS, GOOD_ORDER, VENUES, VENUE_ITEMS, PERENNIAL , GARDEN } from '../../core/config/economy.js';
import { PARCELS, lotAllows, terrainOfLot, climateOfLot, estateOfLot, ESTATE_FIELDS } from '../../core/config/layout.js';
import { beanPrice, buyerNow, treeHealth, unlockedCrops, nextEstate, parcelCost, climateOfPlot, climateFit, beanMix, sellQuote, plotGrowMs as plotGrowMsOf, treeAge, treeOld, pruneCost, region, plotOf, plotState, upgradeCost, upgradeError, levelCap, parcelError, seedCost, capacity, stored, goodCount, seatCount, seatsUsed, venueError, venueOpen, venueRating, venueReviews, venueItems,
  removeError, removeRefund, wellBonus, recipeIOFor, jobState, prodError, missingInput, collectError, countOf, maxCount, buildCost, buildError, nextLimitLevel, tileAt , gardenOf } from '../../core/derive.js';
import { newTxId } from '../../core/store.js';
import { h, setText } from './dom.js';
import { modelIcon } from './model-icons.js';
import { T, clock, fmt, has, duration, errorText } from './text.js';
import { buildingEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';
import { TERRAIN_ICON, buyLand } from './sheets.js';
import { stars1 } from './shop-strip.js';
import { openTreeViewer } from './tree-viewer.js';

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
        const zone = climateOfPlot(s, target.id), pl = region(s).plots[target.id];
        const drop = st.crop && CROPS[st.crop].drop, ripeFor = st.stage === 'ready' && pl ? Math.floor((now - pl.plantedAt) / 1000) - Math.round(plotGrowMsOf(s, pl, target.id) / 1000) : 0;
        return { kind: 'plot', id: target.id, stage: st.stage, crop: st.crop || null, active: crop, seed: seedCost(s, crop), zone, fit: climateFit(st.crop || crop, zone), garden: gardenOf(s).style,
          dropping: !!drop && ripeFor > drop.after, dropSoon: !!drop && ripeFor >= 0 && ripeFor <= drop.after, wave: pl?.wave ? 2 : st.crop && CROPS[st.crop].waves ? 1 : 0,
          health: pl ? treeHealth(s, target.id) : null, age: pl ? treeAge(pl) : 0, old: treeOld(pl), pruned: !!pl?.pruned, prune: pl ? pruneCost(pl.crop) : 0, coinsOk: pl ? coins >= pruneCost(pl.crop) : false,
          watered: !!pl?.watered, rmErr, refund: rmErr ? 0 : removeRefund(s, target.id), armed: isArmed(target.id), well: Math.round(wellBonus(s, target.id) * 100) };
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
          near: (region(s).fields || []).map(f => ({ id: f.id, d: Math.hypot(f.x - x, f.z - z) })).filter(f => f.d < 4.5).sort((p, q) => p.d - q.d).slice(0, 8)
            .map(f => ({ id: f.id, crop: region(s).plots[f.id]?.crop || null, stage: region(s).plots[f.id] ? plotState(s, f.id, now).stage : 'empty' })),
          estate: estateOfLot(lot)?.id || null, zone: climateOfLot(lot), crops: unlockedCrops(s).map(id => [id, climateFit(id, climateOfLot(lot))]),
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
        const io = recipeIOFor(s, b);
        if (io) {
          const js = jobState(b, now);
          const perr = js.stage === 'idle' ? prodError(s, b) : null;
          const miss = perr === 'noInput' ? missingInput(s, b) : null;
          m.prod = { in: io.in, out: js.stage === 'idle' ? io.out : js.out || io.out, fee: io.fee, ms: js.stage === 'idle' ? io.ms : b.job.ms, stage: js.stage, err: perr,
            miss: miss ? { good: miss.good, need: miss.need } : null, feeMissing: perr === 'coins' ? Math.ceil(io.fee - coins) : 0,
            cErr: js.stage === 'ready' ? collectError(s, b, now) : null };
        }
        // Storehouse / barn: every good stored, its price, the shared capacity.
        if (def.effect?.capacity) m.store = { goods: GOOD_ORDER.map(g => [g, Math.floor(goodCount(s, g))]), stored: stored(s), cap: capacity(s), mix: beanMix(s), beanCoins: sellQuote(s, 'beans').coins };
        if (b.type === 'orderCounter' || b.type === 'tables') m.seats = { used: seatsUsed(s), seats: seatCount(s) };
        return m;
      }
      case 'parcel': {
        const p = PARCELS[target.id];
        if (!p) return null;
        const err = parcelError(s, p.id);
        return { kind: 'parcel', id: p.id, err, next: err === 'order' ? nextEstate(s)?.id || null : null, missing: err === 'coins' ? parcelCost(p.id) - Math.floor(coins) : 0 }; // no raw coins: a rebuild per sale eats taps
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
    el.classList.remove('is-wide');
    const fill = { plot: plotCard, land: landCard, building: buildingCard, parcel: parcelCard, gate: gateCard, venue: venueCard }[m.kind];
    fill(m, s);
    { const t0 = title.firstChild; if (t0 && t0.nodeType === 3) t0.textContent = t0.textContent.replace(/^[^\p{L}\p{N}]+/u, ''); } // card titles carry no leading icon
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

  // The field card of the design: picture, name, one bar and three big buttons. Everything else lives in the tree details.
  const TREE_ART = { arabica: 'gedeo', robusta: 'gedeo', liberica: 'liberica' };
  function artSquare(icon, def) {
    const box = h('span', { class: 'ui-sq', attrs: { 'aria-hidden': 'true' } }, icon);
    modelIcon(def).then(url => { if (!url) return; const img = Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false }); box.replaceChildren(img); });
    return box;
  }
  const iconAction = (id, icon, label, onClick, extra = {}) => actionButton({ id, label, icon, tone: 'plain', onClick, ...extra });
  function plotCard(m, s) {
    const crop = CROPS[m.crop];
    title.replaceChildren();
    const art = crop ? artSquare(crop.icon, { model: `farm/coffee-tree-${TREE_ART[m.crop] || 'gedeo'}.glb#tree`, trueScale: 1 }) : h('span', { class: 'ui-sq', attrs: { 'aria-hidden': 'true' } }, '🟫');
    const name = h('strong', { class: 'hud-pan-name' }, crop ? T(`crop.${crop.id}`) : T('hud.plot.soil'));
    const details = () => { if (crop) openTreeViewer(ctx, m.id); };
    if (m.stage === 'ready') {
      body.append(h('div', { class: 'hud-pan-head' }, art, h('div', null, h('strong', { class: 'hud-pan-name' }, T('hud.plot.ripeShort')), h('span', { class: 'hud-pan-sub' }, m.dropping ? T('hud.plot.dropping') : crop ? T(`crop.${crop.id}`) : ''))),
        h('div', { class: 'hud-pan-go' }, actionButton({ id: 'plotHarvest', label: T('hud.plot.harvestNow'), icon: '🧺', tone: 'gold', onClick: () => { if (ctx.blockedByAuto?.()) return; ctx.act('farm/harvest', { plotId: m.id }); } })));
      return;
    }
    if (m.stage === 'empty') {
      const active = CROPS[m.active];
      body.append(h('div', { class: 'hud-pan-head' }, art, h('div', null, name, h('span', { class: 'hud-pan-sub' }, T('hud.plot.empty', { crop: T(`crop.${m.active}`), icon: active.icon })))),
        h('div', { class: 'hud-pan-tools' }, iconAction('plotSeeds', '🌱', T('hud.plot.changeSeed'), () => ctx.onTool('seeds')),
          iconAction('fieldMove', '✥', T('fw.field.move'), () => { if (ctx.blockedByAuto?.()) return; ctx.clearSelection(); ctx.realm?.startPlacement?.('field', { uid: m.id }); }),
          removeButton(m.id, m, { label: T('fw.field.clear'), icon: '🧹', confirm: true, confirmText: T('fw.field.clearConfirm'), busyNote: T('fw.field.busy') })));
      return;
    }
    const time = h('span'), fill = h('u');
    const bar = h('button', { type: 'button', class: 'hud-pan-info', attrs: { 'aria-label': T('hud.plot.detail') }, on: { click: details } }, art, h('div', null, name, h('div', { class: 'ui-bar is-large' }, fill, time)));
    body.append(bar, h('div', { class: 'hud-pan-tools' },
      iconAction('plotWater', '💧', T('hud.tree.water'), () => { if (ctx.blockedByAuto?.()) return; ctx.act('farm/water', { plotId: m.id }); }, { disabled: m.watered }),
      iconAction('plotInfo', '🌳', T('hud.plot.detail'), details),
      iconAction('treeUproot', '🪓', T('hud.tree.uproot'), async () => {
        if (ctx.blockedByAuto?.()) return;
        const yes = await ctx.confirm({ title: T('hud.tree.uproot'), body: T('hud.tree.uprootBody', { n: m.age }), confirmLabel: T('hud.tree.uproot'), danger: true, art: { model: `farm/coffee-tree-${TREE_ART[m.crop] || 'gedeo'}.glb#tree`, trueScale: 1 } });
        if (yes) ctx.act('farm/uproot', { plotId: m.id });
      })));
    countdown = { el: time, plotId: m.id, bar: fill };
    updateCountdown(s);
  }

  // Empty owned land: Field / Build / Decor (what the terrain does not allow is greyed out).
  const ESTATE_ICON = { home: '🌴', upland: '⛰️', slope: '🪜', highland: '🏔️' };
  function landCard(m) {
    setText(title, m.estate ? `${ESTATE_ICON[m.estate] || '🌾'} ${T(`estate.${m.estate}`)}` : `${TERRAIN_ICON[m.terrain] || '🌾'} ${T(`fw.land.terrain.${m.terrain}`)}`);
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
    const crop = ctx.realm?.activeCrop || 'robusta', def = CROPS[crop];
    const plantErr = !m.field ? 'terrain' : m.fErr || (def ? null : 'unknown');
    const plant = actionButton({ id: 'landPlant', label: T('fw.land.plant', { crop: def ? T(`crop.${def.id}`) : '' }), icon: def?.icon || '🌱', cost: !plantErr ? m.fieldCost + seedCost(ctx.store.state, crop) : null, disabled: !!plantErr, note: fieldNote,
      onClick: () => {
        if (ctx.blockedByAuto?.()) return;
        const r = ctx.act('farm/plantAt', { x: m.x, z: m.z, crop });
        if (r.ok) ctx.clearSelection();
      } });
    // Tier info board: what suits this tier (climate), so the player chooses freely but with the facts.
    const tag = f => (f === 'good' ? '✅' : f === 'bad' ? '⚠️' : '➖');
    body.append(h('p', { class: 'hud-line hud-tier-info' }, T('fw.tier.info', { zone: T(`fw.tier.zone.${m.zone}`) }), ' ',
      ...m.crops.map(([id, f]) => h('span', { class: `hud-tier-crop is-${f}` }, `${CROPS[id].icon}${T(`crop.${id}`)} ${tag(f)} `))),
      h('p', { class: 'hud-line' }, T('fw.tier.tip')));
    if (m.near.length) body.append(h('div', { class: 'hud-row hud-near' }, h('span', { class: 'hud-line' }, T('fw.near')), ...m.near.map(p => h('button', { type: 'button', class: `hud-near-tree is-${p.stage}`, attrs: { 'aria-label': p.crop ? T(`crop.${p.crop}`) : T('hud.plot.soil') },
      on: { click: () => ctx.realm?.select?.({ kind: 'plot', id: p.id }) } }, p.crop ? CROPS[p.crop].icon : '🟫', p.stage === 'ready' ? '🧺' : ''))));
    body.append(h('div', { class: 'hud-land-btns' }, plant, build, decor));
  }

  function prodBlock(m) {
    const p = m.prod;
    // What one batch does, in words: "12 Coffee beans → 12 Dried beans", how long, what it costs, and what it is worth
    const named = io => Object.entries(io || {}).map(([g, n]) => `${GOODS[g]?.icon || ''} ${fmt(n)} ${T(`good.${g}`)}`).join(' + ');
    const unit = io => { const [g] = Object.keys(io || {}); return g ? (GOODS[g]?.price ?? 0) : 0; };
    const wrap = h('div', { class: `hud-prod is-${p.stage}` },
      h('div', { class: 'hud-prod-flow' },
        h('span', { class: 'hud-prod-goods' }, named(p.in)), h('span', { class: 'hud-prod-arrow', attrs: { 'aria-hidden': 'true' } }, '➜'),
        h('span', { class: 'hud-prod-goods is-out' }, named(p.out))),
      h('p', { class: 'hud-line hud-line--muted' }, T('fw.prodx.facts', { time: duration(p.ms), fee: p.fee > 0 ? T('fw.prodx.fee', { n: fmt(p.fee) }) : T('fw.prodx.noFee') })),
      h('p', { class: 'hud-line hud-prod-value' }, T('fw.prodx.value', { from: fmt(unit(p.in)), to: fmt(unit(p.out)) })));
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

  function storeBlock(m, { bare = false } = {}) {
    const st = m.store, full = st.cap > 0 && st.stored >= st.cap, pct = st.cap > 0 ? Math.min(100, Math.round(st.stored / st.cap * 100)) : 0;
    const wrap = bare ? h('div', { class: 'hud-store' }) : h('div', { class: 'hud-store' },
      h('p', { class: `hud-line hud-store-fill${full ? ' hud-line--bad' : ''}` }, T('fw.goods.fill', { n: fmt(st.stored), max: fmt(st.cap) })),
      h('div', { class: `hud-xpbar hud-capbar${full ? ' is-full' : ''}`, attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.cap), 'aria-valuenow': String(st.stored) } },
        h('span', { style: { width: `${pct}%` } })));
    const list = h('ul', { class: 'hud-goods' });
    let kinds = 0, total = 0;
    const mul = buyerNow(ctx.store.state).mul?.beans ?? 1;
    // One row = one sellable thing, with a quantity box: pick how many to sell (✔ all by default), then the price updates
    const sellRow = ({ icon, name, have, unit, sell, id }) => {
      let qty = have;
      const input = h('input', { class: 'hud-qty', type: 'number', min: '1', max: String(have), value: String(have), inputMode: 'numeric', attrs: { 'aria-label': T('hud.sell.qty') } });
      const price = h('span', { class: 'hud-qty-price' });
      const refresh = () => { qty = Math.max(1, Math.min(have, Math.floor(Number(input.value) || 1))); price.textContent = `${fmt(Math.round(qty * unit * 100) / 100)} 🪙`; };
      input.addEventListener('input', refresh);
      const step = d => h('button', { type: 'button', class: 'hud-qty-step', on: { click: () => { input.value = String(Math.max(1, Math.min(have, (Number(input.value) || 1) + d))); refresh(); } } }, d > 0 ? '+' : '−');
      const all = h('button', { type: 'button', class: 'hud-qty-all', on: { click: () => { input.value = String(have); refresh(); } } }, T('hud.sell.allShort'));
      refresh();
      return h('li', { class: 'hud-good hud-good--sell' },
        h('span', { class: 'hud-good-ico', attrs: { 'aria-hidden': 'true' } }, icon),
        h('span', { class: 'hud-good-text' }, h('strong', null, `${name} ×${fmt(have)}`), h('small', null, T('fw.goods.each', { price: fmt(Math.round(unit * 100) / 100) }))),
        h('div', { class: 'hud-qty-box' }, step(-1), input, step(1), all),
        h('div', { class: 'hud-qty-act' }, price, actionButton({ id, label: T('hud.sell.do'), tone: 'gold', onClick: () => sell(qty) })));
    };
    for (const [g, n] of st.goods) {
      if (n <= 0) continue;
      if (g === 'beans') { // beans: one row per variety, each at its own price
        for (const [c, k] of Object.entries(st.mix).filter(([, v]) => v > 0)) {
          kinds++; total += k * beanPrice(c) * mul;
          list.append(sellRow({ icon: CROPS[c].icon, name: T(`crop.${c}`), have: k, unit: beanPrice(c) * mul, id: `sell-beans-${c}`, sell: q => ctx.act('farm/sellVariety', { crop: c, amount: q }) }));
        }
      } else {
        kinds++; total += n * GOODS[g].price;
        list.append(sellRow({ icon: GOODS[g].icon, name: T(`good.${g}`), have: n, unit: GOODS[g].price, id: `sell-${g}`, sell: q => ctx.act('farm/sell', { good: g, amount: q }) }));
      }
    }
    if (!kinds) list.append(h('li', { class: 'hud-good hud-line--muted' }, T('hud.beans.none')));
    wrap.append(list);
    if (kinds > 1) wrap.append(h('div', { class: 'hud-row' }, actionButton({ id: 'sellAll', label: T('fw.goods.sellAll'), icon: '💰', cost: total, tone: 'gold', onClick: () => ctx.act('farm/sellAll') })));
    if (kinds <= 1 && m.type === 'silo') wrap.append(h('p', { class: 'hud-line hud-line--muted' }, T(full ? 'hud.storage.explainFull' : 'hud.storage.explain')));
    return wrap;
  }

  function buildUpgradeRow(m, def) {
    const row = h('div', { class: 'hud-row' });
    // land-ui-simplify §4: the upgrade sits in the card itself (no ▲ badge to find): "Lv 2 → 3", price, the effect line above.
    if (!def.decor) {
      if (m.err === 'maxLevel') row.append(h('span', { class: 'hud-tag' }, T('hud.maxLevel')));
      else if (m.err === 'roundCap') row.append(h('span', { class: 'hud-tag' }, T('hud.maxForRound')));
      else row.append(actionButton({ id: 'upgrade', label: T('fw.building.upTo', { level: m.level + 1 }), icon: '⬆️', cost: m.cost, disabled: m.err === 'coins', note: m.err === 'coins' ? needMore(m.missing) : null,
        onClick: () => ctx.act('build/upgrade', { uid: m.uid }) }));
    }
    if (row.childNodes.length) body.append(row);
  }

  // ONE layout for every building (founder 2026-11-08), the barn screen: picture + what it does on the left, the upgrade box on the
  // right, then what it holds / makes (stock rows, production), then Move / Remove. Wide, no scrollbar.
  function buildingCard(m) {
    const def = BUILDINGS[m.type], st = m.store, max = def.decor ? 1 : def.upgrade.length + 1, level = m.level;
    el.classList.add('is-wide');
    title.replaceChildren();
    const tip = st ? T('hud.silo.items', { n: fmt(st.stored), max: fmt(st.cap) }) : def.decor ? (has(`fw.desc.${m.type}`) ? T(`fw.desc.${m.type}`) : T('fw.desc.decor')) : buildingEffect(m.type, level, false);
    body.append(h('div', { class: 'hud-pan-head', attrs: { title: tip } }, artSquare(def.icon, def), h('div', null, h('strong', { class: 'hud-pan-name' }, T(`building.${m.type}`)), def.decor ? null : h('span', { class: 'ui-pill' }, `Lv ${Math.min(level, max)}`))));
    if (!def.decor) {
      if (m.err === 'maxLevel' || m.err === 'roundCap') body.append(h('div', { class: 'hud-pan-go' }, h('span', { class: 'ui-pill' }, T(m.err === 'maxLevel' ? 'hud.maxLevel' : 'hud.maxForRound'))));
      else body.append(h('div', { class: 'hud-pan-go' }, actionButton({ id: 'upgrade', label: T('hud.upgrade'), cost: m.cost, tone: 'go', disabled: m.err === 'coins', note: m.err === 'coins' ? needMore(m.cost - Math.floor(ctx.store.state.player.coins)) : null, onClick: () => ctx.act('build/upgrade', { uid: m.uid }) })));
    }
    if (m.prod) body.append(prodBlock(m));
    if (st) body.append(h('div', { class: 'hud-pan-go' }, actionButton({ id: 'sellBeans', label: T('hud.sheet.sell'), tone: 'gold', onClick: () => { ctx.clearSelection(); ctx.onTool('sell'); } })));
    if (m.seats) body.append(h('p', { class: 'hud-line' }, T('hud.seats.line', { n: m.seats.used, max: m.seats.seats })));
    const tools = h('div', { class: 'hud-pan-pair' });
    if (!def.fixed) tools.append(actionButton({ id: 'move', label: T('hud.move'), tone: 'plain', onClick: () => { if (ctx.blockedByAuto?.()) return; ctx.clearSelection(); ctx.realm?.startPlacement?.(m.type, { uid: m.uid }); } }));
    const rm = removeButton(m.uid, m, { label: T('fw.building.remove'), confirm: true, busyNote: T('fw.building.busy') });
    if (rm) tools.append(rm);
    if (tools.childNodes.length) body.append(tools);
  }

  function parcelCard(m) {
    const p = PARCELS[m.id];
    // Lot kinds: farm (fields), build (workshops), decor, pasture, pond, orchard, shop (café lots).
    const ICONS = { farm: '🌾', build: '🏗️', decor: '🌼', pasture: '🐔', pond: '🦆', orchard: '🍎', shop: '☕' };
    const est = estateOfLot(p.id);
    if (est) return estateCard(m, est);
    setText(title, `${ICONS[p.kind] || '🌾'} ${T(`hud.parcel.${p.kind}`, { id: p.id })}`);
    if (m.err === 'owned') { body.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.parcel.owned'))); return; }
    body.append(h('p', { class: 'hud-line' }, T(`hud.parcel.${p.kind}Info`)));
    // Growing zone of the land and the varieties that suit it (coffee-varieties.md §3): what to plant before you buy.
    const farmArea = p.kind !== 'shop', zone = climateOfLot(p.id);
    if (farmArea && !lotAllows(p.id, 'field')) body.append(h('p', { class: 'hud-line hud-line--muted' }, `${T(`zone.${zone}.icon`)} ${T(`zone.${zone}`)} · `, T(`hud.zone.soil.${zone}`)));
    else if (farmArea) {
      const fits = ['robusta', 'arabica', 'liberica'].map(c => ({ c, f: climateFit(c, zone) }));
      body.append(h('p', { class: 'hud-line hud-line--muted' }, `${T(`zone.${zone}.icon`)} ${T(`zone.${zone}`)} · `, T(`hud.zone.soil.${zone}`)),
        h('p', { class: 'hud-line' }, ...fits.map(({ c, f }) => h('span', { class: `hud-fit is-${f}` }, `${CROPS[c].icon} ${T(`crop.${c}`)} ${f === 'good' ? '★' : f === 'bad' ? '−' : '✓'} `))));
    }
    // Far land: no open road reaches it yet → buy the land next to it first.
    if (m.err === 'road') { body.append(h('p', { class: 'hud-line hud-line--muted' }, '🔒 ', T('hud.parcel.noRoad'))); return; }
    body.append(h('div', { class: 'hud-row' }, actionButton({ id: 'buy', label: T(farmArea ? 'hud.parcel.clear' : 'hud.buy'), icon: farmArea ? '🪓' : '🏷️', cost: p.cost, disabled: m.err === 'coins',
      note: m.err === 'coins' ? needMore(m.missing) : null, onClick: () => buyLand(ctx, p.id, p.cost, title.textContent) })));
  }

  // Estates (land-ui-simplify §2A): a farm lot's card is its estate's card — one price, one level, one button.
  function estateCard(m, est) {
    setText(title, `${est.icon} ${T(`estate.${est.id}`)}`);
    const owned = m.err === 'owned';
    const zone = est.zone, fits = ['robusta', 'arabica', 'liberica'].map(c => ({ c, f: climateFit(c, zone) }));
    body.append(
      h('p', { class: 'hud-line hud-line--muted' }, `${T(`zone.${zone}.icon`)} ${T(`zone.${zone}`)} · `, T(`hud.zone.soil.${zone}`)),
      h('p', { class: 'hud-line' }, ...fits.map(({ c, f }) => h('span', { class: `hud-fit is-${f}` }, `${CROPS[c].icon} ${T(`crop.${c}`)} ${f === 'good' ? '★' : f === 'bad' ? '−' : '✓'} `))),
      h('p', { class: 'hud-line' }, T('estate.info', { fields: ESTATE_FIELDS })));
    if (owned) { body.append(h('p', { class: 'hud-line hud-line--good' }, T('estate.owned'))); return; }
    if (m.err === 'order') { body.append(h('p', { class: 'hud-line hud-line--muted' }, '🔒 ', T('estate.order', { name: T(`estate.${m.next}`) }))); return; }
    if (m.err === 'level') { body.append(h('p', { class: 'hud-line hud-line--muted' }, '🔒 ', T('estate.level', { level: est.level }))); return; }
    body.append(h('div', { class: 'hud-row' }, actionButton({ id: 'buy', label: T('estate.buy'), icon: '🪓', cost: est.cost, disabled: m.err === 'coins',
      note: m.err === 'coins' ? needMore(m.missing) : null, onClick: () => buyLand(ctx, est.seed, est.cost, T(`estate.${est.id}`)) })));
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
    if (countdown.bar) countdown.bar.style.width = `${Math.round((st.ratio || 0) * 100)}%`;
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
