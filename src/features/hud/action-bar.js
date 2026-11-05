// Contextual action card above the toolbar, driven by hud.setSelection(target). Every action goes through the store.
import { BUILDINGS, CROPS } from '../../core/config/economy.js';
import { PARCELS, ROADS, plotById } from '../../core/config/layout.js';
import { region, plotState, upgradeCost, upgradeError, levelCap, parcelError, roadError, seedCost } from '../../core/derive.js';
import { h, setText } from './dom.js';
import { T, clock } from './text.js';
import { buildingEffect } from './effects.js';
import { actionButton, lockTag, needMore } from './widgets.js';

export function createActionBar(ctx) {
  const title = h('div', { class: 'hud-card-title' });
  const body = h('div', { class: 'hud-card-body' });
  const close = h('button', { type: 'button', class: 'hud-x', attrs: { 'aria-label': T('hud.close') }, on: { click: () => ctx.clearSelection() } }, '×');
  const el = h('section', { class: 'hud-action', hidden: true, attrs: { 'aria-live': 'polite' } }, h('header', { class: 'hud-card-head' }, title, close), body);
  let sig = '';
  let countdown = null; // { el, plotId } updated in update()
  let tick = 0;

  function building(s, target) {
    const r = region(s);
    return r?.buildings.find(b => b.uid === target.uid) || r?.buildings.find(b => b.type === target.type) || null;
  }

  // Model → signature, so the card only rebuilds when something visible changed.
  function model(s, target) {
    if (!target || !region(s)) return null;
    const coins = s.player.coins;
    switch (target.kind) {
      case 'plot': {
        const plot = plotById(target.id);
        if (!plot) return null;
        const st = plotState(s, target.id, Date.now());
        const owned = region(s).parcels.includes(plot.parcel);
        const crop = ctx.realm?.activeCrop || 'robusta';
        return { kind: 'plot', id: target.id, owned, stage: st.stage, crop: st.crop || null, active: crop, seed: seedCost(s, crop) };
      }
      case 'building': {
        const b = building(s, target);
        if (!b) return null;
        const err = upgradeError(s, b);
        return { kind: 'building', uid: b.uid, type: b.type, level: b.level, cap: levelCap(s), err, cost: upgradeCost(b.type, b.level), missing: err === 'coins' ? upgradeCost(b.type, b.level) - coins : 0 };
      }
      case 'parcel': {
        const p = PARCELS[target.id];
        if (!p) return null;
        const err = parcelError(s, p.id);
        const roadErr = err === 'road' ? roadError(s, p.road) : null;
        return { kind: 'parcel', id: p.id, err, roadErr, coins: Math.floor(coins) };
      }
      case 'road': {
        const road = ROADS[target.id];
        return road ? { kind: 'road', id: road.id, err: roadError(s, road.id), coins: Math.floor(coins) } : null;
      }
      case 'gate': return { kind: 'gate' };
      default: return null;
    }
  }

  function render(s, target) {
    const m = model(s, target);
    const nextSig = m ? JSON.stringify(m) : '';
    if (nextSig === sig) return;
    sig = nextSig;
    countdown = null;
    el.hidden = !m;
    el.dataset.kind = m?.kind || '';
    body.replaceChildren();
    if (!m) return;
    const fill = { plot: plotCard, building: buildingCard, parcel: parcelCard, road: roadCard, gate: gateCard }[m.kind];
    fill(m, s);
  }

  function plotCard(m, s) {
    const crop = CROPS[m.crop];
    setText(title, crop ? `${crop.icon} ${T(`crop.${crop.id}`)}` : `🟫 ${T('hud.plot.soil')}`);
    if (!m.owned) { body.append(h('p', { class: 'hud-line' }, T('hud.plot.notOwned'))); return; }
    if (m.stage === 'empty') {
      const active = CROPS[m.active];
      body.append(h('p', { class: 'hud-line' }, T('hud.plot.empty', { crop: T(`crop.${m.active}`), icon: active.icon })),
        h('div', { class: 'hud-row' }, actionButton({ label: T('hud.plot.changeSeed'), icon: '🌱', tone: 'plain', onClick: () => ctx.onTool('seeds') })));
      return;
    }
    if (m.stage === 'ready') {
      body.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.plot.ready')), h('p', { class: 'hud-hint' }, T('hud.plot.harvestHint')));
      return;
    }
    const time = h('strong', { class: 'hud-countdown' });
    body.append(h('p', { class: 'hud-line' }, T('hud.plot.growing'), ' ', time));
    countdown = { el: time, plotId: m.id };
    updateCountdown(s);
  }

  function buildingCard(m) {
    const def = BUILDINGS[m.type];
    setText(title, `${def.icon} ${T(`building.${m.type}`)}`);
    const max = def.decor ? 1 : def.upgrade.length + 1;
    if (!def.decor) body.append(h('p', { class: 'hud-sub' }, T('hud.levelOf', { level: m.level, cap: Math.min(m.cap, max) })));
    body.append(h('p', { class: 'hud-line' }, buildingEffect(m.type, m.level, m.err !== 'maxLevel' && m.err !== 'roundCap')));
    const row = h('div', { class: 'hud-row' });
    if (!def.decor) {
      if (m.err === 'maxLevel') row.append(h('span', { class: 'hud-tag' }, T('hud.maxLevel')));
      else if (m.err === 'roundCap') row.append(h('span', { class: 'hud-tag' }, T('hud.maxForRound')));
      else row.append(actionButton({ id: 'upgrade', label: T('hud.upgrade'), icon: '⬆️', cost: m.cost, disabled: m.err === 'coins', note: m.err === 'coins' ? needMore(m.missing) : null,
        onClick: () => ctx.act('build/upgrade', { uid: m.uid }) }));
    }
    if (!def.fixed) row.append(actionButton({ label: T('hud.move'), icon: '✥', tone: 'plain', onClick: () => { ctx.clearSelection(); ctx.realm?.startPlacement?.(m.type, { uid: m.uid }); } }));
    body.append(row);
  }

  function parcelCard(m) {
    const p = PARCELS[m.id];
    setText(title, `${p.kind === 'farm' ? '🌾' : p.kind === 'shop' ? '☕' : '🧱'} ${T(`hud.parcel.${p.kind}`, { id: p.id })}`);
    const row = h('div', { class: 'hud-row' });
    if (m.err === 'owned') body.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.parcel.owned')));
    else if (m.err === 'round') {
      body.append(h('p', { class: 'hud-line' }, T(p.kind === 'farm' ? 'hud.parcel.farmInfo' : 'hud.parcel.buildInfo')));
      row.append(lockTag(T('hud.roundN', { round: p.round })));
    }
    else if (m.err === 'road') {
      const road = ROADS[p.road];
      body.append(h('p', { class: 'hud-line' }, T('hud.parcel.needRoad')));
      if (m.roadErr === 'round') row.append(lockTag(T('hud.roundN', { round: road.round })));
      else row.append(actionButton({ label: T('hud.openRoadFirst'), icon: '🛣️', tone: 'gold', cost: road.cost, disabled: m.roadErr === 'coins',
        note: m.roadErr === 'coins' ? needMore(road.cost - m.coins) : null, onClick: () => ctx.act('land/openRoad', { roadId: road.id }) }));
    } else {
      body.append(h('p', { class: 'hud-line' }, T(p.kind === 'farm' ? 'hud.parcel.farmInfo' : 'hud.parcel.buildInfo')));
      row.append(actionButton({ id: 'buy', label: T('hud.buy'), icon: '🏷️', cost: p.cost, disabled: m.err === 'coins', note: m.err === 'coins' ? needMore(p.cost - m.coins) : null,
        onClick: () => ctx.act('land/buyParcel', { parcelId: p.id }) }));
    }
    if (row.childElementCount) body.append(row);
  }

  function roadCard(m) {
    const road = ROADS[m.id];
    setText(title, `🛣️ ${T('hud.road')}`);
    if (m.err === 'owned') { body.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.road.open'))); return; }
    body.append(h('p', { class: 'hud-line' }, T('hud.road.info')));
    if (m.err === 'round') body.append(h('div', { class: 'hud-row' }, lockTag(T('hud.roundN', { round: road.round }))));
    else body.append(h('div', { class: 'hud-row' }, actionButton({ id: 'openRoad', label: T('hud.openRoad'), icon: '🛣️', tone: 'gold', cost: road.cost,
      disabled: m.err === 'coins', note: m.err === 'coins' ? needMore(road.cost - m.coins) : null, onClick: () => ctx.act('land/openRoad', { roadId: road.id }) })));
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

  function update(dt) {
    tick += dt;
    if (tick < .25) return;
    tick = 0;
    const s = ctx.store.state;
    render(s, ctx.selection); // cheap: rebuilds only when the model signature changed (e.g. crop became ready)
    updateCountdown(s);
  }
  return { el, render, update, dispose() {} };
}
