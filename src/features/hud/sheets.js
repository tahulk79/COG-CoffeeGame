// Sheet contents: Build, Seeds, Staff and Progress (Round + Rebirth). Pure render functions of the store state.
import { BUILD_MENU, BUILDINGS, CROPS, CROP_ORDER, STAFF, STAFF_ORDER, STAFF_SLOTS, ROUNDS, ROUND_LEVEL_CAP, REBIRTH, DRINKS, DRINK_ORDER } from '../../core/config/economy.js';
import { PARCELS, PARCEL_ORDER, ROADS, ROAD_ORDER } from '../../core/config/layout.js';
import { COUNTRIES, COUNTRY_ORDER, REGION_ROUND } from '../../core/config/world.js';
import { buildError, buildingsOf, MAX_INSTANCES, cropUnlocked, seedCost, growMs, staffError, freeSlots, roundStatus, rebirthError, level, region } from '../../core/derive.js';
import { newTxId } from '../../core/store.js';
import { h } from './dom.js';
import { T, fmt, duration } from './text.js';
import { buildingEffect, staffEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';

// ---------- Build ----------
export function buildSheet(ctx) {
  return s => {
    const grid = h('div', { class: 'hud-cards' });
    for (const type of BUILD_MENU) {
      const def = BUILDINGS[type];
      const err = buildError(s, type);
      const count = buildingsOf(s, type).length, limit = MAX_INSTANCES[type] || 1;
      let lock = null;
      if (err === 'round') lock = lockTag(T('hud.roundN', { round: def.round }));
      else if (err === 'level') lock = lockTag(T('hud.levelN', { level: def.level }));
      else if (err === 'limit') lock = h('span', { class: 'hud-tag' }, T('hud.built', { n: count, max: limit }));
      else if (err === 'coins') lock = h('span', { class: 'hud-need' }, needMore(def.cost - s.player.coins));
      const card = h('button', { type: 'button', class: `hud-card${err ? ' is-locked' : ''}`, disabled: !!err,
        dataset: { hudId: `build-${type}` }, attrs: { 'aria-label': `${T(`building.${type}`)} · ${fmt(def.cost)}` },
        on: { click: () => { ctx.sheet.close(); ctx.realm?.startPlacement?.(type); } } },
      h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
      h('span', { class: 'hud-card-name' }, T(`building.${type}`)),
      h('span', { class: 'hud-card-meta' }, coinAmount(def.cost), h('span', { class: 'hud-size' }, `${def.size[0]}×${def.size[1]}`)),
      h('span', { class: 'hud-card-fx' }, buildingEffect(type, 1, false)),
      lock);
      grid.append(card);
    }
    return grid;
  };
}

// ---------- Seeds (active crop picker) ----------
export function seedsSheet(ctx) {
  return s => {
    const active = ctx.realm?.activeCrop;
    const list = h('div', { class: 'hud-chips-list' });
    for (const id of CROP_ORDER) {
      const def = CROPS[id];
      const open = cropUnlocked(s, id);
      const cost = seedCost(s, id);
      const chip = h('button', { type: 'button', class: `hud-seed${id === active ? ' is-active' : ''}${open ? '' : ' is-locked'}`, disabled: !open,
        attrs: { 'aria-pressed': String(id === active) },
        on: { click: () => { ctx.realm?.setActiveCrop?.(id); ctx.sheet.close(); ctx.toast(T('hud.seedPicked', { crop: T(`crop.${id}`) }), 'info'); } } },
      h('span', { class: 'hud-seed-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
      h('span', { class: 'hud-seed-name' }, T(`crop.${id}`)),
      open ? h('span', { class: 'hud-seed-meta' }, coinAmount(cost), h('span', null, `⏱ ${duration(region(s) ? growMs(s, id) : def.growSeconds * 1000)}`), h('span', null, `🫘 ${def.beans}`))
        : lockTag(s.player.round < def.round ? T('hud.roundN', { round: def.round }) : T('hud.levelN', { level: def.level })));
      list.append(chip);
    }
    return h('div', null, h('p', { class: 'hud-hint' }, T('hud.seeds.hint')), list);
  };
}

// ---------- Staff ----------
export function staffSheet(ctx) {
  return s => {
    const r = region(s);
    const used = zone => (r ? STAFF_SLOTS[zone] - freeSlots(s, zone) : 0);
    const out = h('div', { class: 'hud-staff' },
      h('p', { class: 'hud-slots' }, T('hud.staff.slots', { farm: used('farm'), farmMax: STAFF_SLOTS.farm, shop: used('shop'), shopMax: STAFF_SLOTS.shop })));
    const cards = h('div', { class: 'hud-cards hud-cards--wide' });
    for (const type of STAFF_ORDER) {
      const def = STAFF[type];
      const err = staffError(s, type);
      let foot;
      if (err === 'round') foot = lockTag(T('hud.roundN', { round: def.round }));
      else if (err === 'level') foot = lockTag(T('hud.levelN', { level: def.level }));
      else foot = actionButton({ label: T('hud.hire'), cost: def.cost, disabled: err === 'coins' || !r, note: err === 'coins' ? needMore(def.cost - s.player.coins) : null,
        onClick: () => ctx.act('staff/hire', { type }) });
      cards.append(h('div', { class: 'hud-card hud-card--static' },
        h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
        h('span', { class: 'hud-card-name' }, T(`staff.${type}`)),
        h('span', { class: 'hud-card-meta' }, T(`hud.zone.${def.zone}`), ' · ', T(`hud.kind.${def.kind}`)),
        h('span', { class: 'hud-card-fx' }, staffEffect(type)), foot));
    }
    out.append(cards);
    if (s.staff.units.length) {
      const list = h('ul', { class: 'hud-units' });
      for (const u of s.staff.units) {
        const def = STAFF[u.type];
        if (!def) continue;
        const here = r && u.assigned?.regionId === s.world.currentRegion;
        const status = here ? T('hud.staff.working', { zone: T(`hud.zone.${def.zone}`) }) : u.assigned ? T('hud.staff.elsewhere') : T('hud.staff.idle');
        const btn = here
          ? actionButton({ label: T('hud.staff.unassign'), tone: 'plain', onClick: () => ctx.act('staff/unassign', { uid: u.uid }) })
          : actionButton({ label: T('hud.staff.assign'), disabled: !r || freeSlots(s, def.zone) <= 0, note: r && freeSlots(s, def.zone) <= 0 ? T('err.slotsFull') : null,
            onClick: () => ctx.act('staff/assign', { uid: u.uid }) });
        list.append(h('li', { class: 'hud-unit' }, h('span', { class: 'hud-unit-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
          h('span', { class: 'hud-unit-text' }, h('strong', null, T(`staff.${u.type}`)), h('small', null, status)), btn));
      }
      out.append(h('h3', { class: 'hud-h3' }, T('hud.staff.team')), list);
    }
    return out;
  };
}

// ---------- Progress: Round + Rebirth ----------
/** What Round `n` adds, derived from config. */
export function roundUnlocks(n) {
  const items = [];
  const name = (prefix, ids) => ids.map(id => T(`${prefix}.${id}`)).join(', ');
  const crops = CROP_ORDER.filter(id => CROPS[id].round === n);
  if (crops.length) items.push(['🌱', T('hud.unlock.crops', { list: name('crop', crops) })]);
  const builds = BUILD_MENU.filter(id => BUILDINGS[id].round === n);
  if (builds.length) items.push(['🔨', T('hud.unlock.buildings', { list: name('building', builds) })]);
  const staff = STAFF_ORDER.filter(id => STAFF[id].round === n);
  if (staff.length) items.push(['👥', T('hud.unlock.staff', { list: name('staff', staff) })]);
  const parcels = PARCEL_ORDER.filter(id => PARCELS[id].round === n);
  const roads = ROAD_ORDER.filter(id => ROADS[id].round === n);
  if (parcels.length) items.push(['🌾', T('hud.unlock.parcels', { n: parcels.length, roads: roads.length })]);
  const regions = Object.entries(REGION_ROUND).filter(([, r]) => r === n).map(([k]) => k);
  if (regions.length) items.push(['🗺️', T('hud.unlock.regions', { list: regions.map(k => `#${k}`).join(', ') })]);
  if (n === 2) items.push(['🌿', T('hud.unlock.reopen')]);
  const countries = COUNTRY_ORDER.filter(id => !COUNTRIES[id].starter && COUNTRIES[id].round === n);
  if (countries.length) items.push(['🌍', T('hud.unlock.countries', { n: countries.length })]);
  if (ROUND_LEVEL_CAP[n]) items.push(['⬆️', T('hud.unlock.levelCap', { cap: ROUND_LEVEL_CAP[n] })]);
  return items;
}

export function progressSheet(ctx) {
  let roundPending = false;
  const rebirthPending = new Set();

  async function unlockRound(st) {
    if (roundPending) return;
    roundPending = true;
    const txId = newTxId('round'); // one id per confirm → a repeated tap/dispatch can never charge twice
    ctx.sheet.rerender();
    try {
      const yes = await ctx.confirm({ title: T('hud.round.confirmTitle', { round: st.next }), body: T('hud.round.confirmBody', { round: st.next }), cost: st.cost, confirmLabel: T('hud.round.unlock', { round: st.next }) });
      if (yes) ctx.act('round/unlock', { round: st.next }, { txId });
    } finally { roundPending = false; ctx.sheet.rerender(); }
  }
  async function bless(key) {
    if (rebirthPending.size) return;
    rebirthPending.add(key);
    const txId = newTxId('rebirth');
    ctx.sheet.rerender();
    try {
      const yes = await ctx.confirm({ title: T('hud.rebirth.confirmTitle', { blessing: T(`blessing.${key}`) }), body: T('hud.rebirth.confirmBody', { pct: Math.round(REBIRTH.blessings[key] * 100), blessing: T(`blessing.${key}`) }),
        costLabel: T('hud.rebirth.costLine'), confirmLabel: T('hud.rebirth.go') });
      if (yes) ctx.act('rebirth/perform', { blessing: key }, { txId });
    } finally { rebirthPending.delete(key); ctx.sheet.rerender(); }
  }

  return s => {
    const st = roundStatus(s);
    const lvl = level(s);
    // Round panel
    const round = h('section', { class: 'hud-panel' }, h('h3', { class: 'hud-h3' }, T('hud.round.current', { round: s.player.round })));
    if (!st.next) round.append(h('p', { class: 'hud-line hud-line--good' }, T('hud.round.max')));
    else {
      round.append(h('p', { class: 'hud-sub' }, T('hud.round.next', { round: st.next })),
        h('ul', { class: 'hud-unlocks' }, roundUnlocks(st.next).map(([icon, text]) => h('li', null, h('span', { attrs: { 'aria-hidden': 'true' } }, icon), text))));
      const req = h('p', { class: `hud-req${st.levelOk ? ' is-ok' : ''}` }, st.levelOk ? '✓ ' : '🔒 ', T('hud.round.needLevel', { level: st.minLevel, now: lvl }));
      const note = !st.levelOk ? T('hud.round.reachLevel', { level: st.minLevel }) : st.missing > 0 ? T('hud.needCoins', { n: fmt(st.missing) }) : null;
      round.append(req, actionButton({ id: 'unlockRound', label: T('hud.round.unlock', { round: st.next }), tone: 'gold', cost: st.cost,
        disabled: !st.canUnlock || roundPending, note, onClick: () => unlockRound(st) }));
    }
    // Rebirth panel
    const credits = s.rebirth.credits;
    const reb = h('section', { class: 'hud-panel' }, h('h3', { class: 'hud-h3' }, T('hud.rebirth.title')),
      h('p', { class: 'hud-line' }, T('hud.rebirth.line1')), h('p', { class: 'hud-line' }, T('hud.rebirth.line2')),
      h('p', { class: 'hud-sub' }, T('hud.rebirth.credits', { n: credits }), ' · ', lvl >= REBIRTH.minLevel ? T('hud.rebirth.ready') : T('hud.rebirth.needLevel', { level: REBIRTH.minLevel })));
    const cards = h('div', { class: 'hud-cards' });
    for (const key of Object.keys(REBIRTH.blessings)) {
      const stacks = s.rebirth.blessings[key] || 0;
      const err = rebirthError(s, key);
      cards.append(h('div', { class: 'hud-card hud-card--static hud-bless' },
        h('span', { class: 'hud-card-ico', attrs: { 'aria-hidden': 'true' } }, { grow: '🌿', price: '💰', xp: '⭐' }[key] || '✨'),
        h('span', { class: 'hud-card-name' }, T(`blessing.${key}`)),
        h('span', { class: 'hud-card-fx' }, T(`blessing.${key}.desc`, { pct: Math.round(REBIRTH.blessings[key] * 100) })),
        h('span', { class: 'hud-stacks', attrs: { 'aria-label': T('hud.rebirth.stacks', { n: stacks, max: REBIRTH.maxStacks }) } },
          Array.from({ length: REBIRTH.maxStacks }, (_, i) => h('i', { class: i < stacks ? 'on' : '' })), ` ${stacks}/${REBIRTH.maxStacks}`),
        actionButton({ label: err === 'maxStacks' ? T('hud.rebirth.maxed') : T('hud.rebirth.bless'), icon: '✨', tone: 'gold', disabled: !!err || rebirthPending.size > 0,
          note: err && err !== 'maxStacks' ? (err === 'level' ? T('hud.levelN', { level: REBIRTH.minLevel }) : T(`err.${err}`)) : null, onClick: () => bless(key) })));
    }
    reb.append(cards, h('p', { class: 'hud-hint' }, T('hud.rebirth.more')));
    return h('div', { class: 'hud-progress' }, round, reb);
  };
}

/** Things that unlock exactly at `lvl` (level-up banner). */
export function levelUnlocks(s, lvl) {
  const out = [];
  for (const id of CROP_ORDER) if (CROPS[id].level === lvl && CROPS[id].round <= s.player.round) out.push(`${CROPS[id].icon} ${T(`crop.${id}`)}`);
  for (const id of DRINK_ORDER) if (DRINKS[id].level === lvl) out.push(`${DRINKS[id].icon} ${T(`drink.${id}`)}`);
  for (const id of BUILD_MENU) if (BUILDINGS[id].level === lvl && BUILDINGS[id].round <= s.player.round) out.push(`${BUILDINGS[id].icon} ${T(`building.${id}`)}`);
  for (const id of STAFF_ORDER) if (STAFF[id].level === lvl && STAFF[id].round <= s.player.round) out.push(`${STAFF[id].icon} ${T(`staff.${id}`)}`);
  if (REBIRTH.minLevel === lvl) out.push(`✨ ${T('hud.rebirth.title')}`);
  for (const r of Object.values(ROUNDS)) if (r.minLevel === lvl && r.id > s.player.round) out.push(`⭐ ${T('hud.roundN', { round: r.id })}`);
  return out;
}
