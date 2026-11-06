// Sheet contents: Build (café), Seeds (farm), Menu (café drinks), Staff (per area) and Progress (Round + Rebirth).
// Pure render functions of the store state. Each screen has its own toolbar (toolbar.js), so sheets filter by view.
import { BUILD_MENU, BUILD_MENU_FARM, BUILD_MENU_CAFE, BUILDINGS, AUTO, autoPrice, CROPS, CROP_ORDER, STAFF, STAFF_ORDER, STAFF_SLOTS, ROUNDS, ROUND_LEVEL_CAP, REBIRTH, DRINKS, DRINK_ORDER, BEANS } from '../../core/config/economy.js';
import { buildError, buildingsOf, buildingLevel, MAX_INSTANCES, cropUnlocked, drinkUnlocked, drinkPrice, brewMs, seedCost, growMs, staffError, freeSlots, roundStatus, rebirthError, level, region, capacity, beanBuyQuote } from '../../core/derive.js';
import { newTxId } from '../../core/store.js';
import { h } from './dom.js';
import { T, fmt, duration } from './text.js';
import { buildingEffect, staffEffect } from './effects.js';
import { actionButton, coinAmount, lockTag, needMore } from './widgets.js';

// ---------- Build ----------
export function buildSheet(ctx) {
  return s => {
    const grid = h('div', { class: 'hud-cards' });
    // Each screen builds its own things: farm = dryer + decorations on free grass, café = café buildings + decorations.
    for (const type of ctx.realm?.view === 'cafe' ? BUILD_MENU_CAFE : BUILD_MENU_FARM) {
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
        on: { click: () => { if (ctx.blockedByAuto?.()) return; ctx.sheet.close(); ctx.realm?.startPlacement?.(type); } } },
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

// ---------- Menu (café drinks) ----------
export const drinkSeenKey = drinkId => `hudDrink:${drinkId}`;
export function menuSheet() {
  return s => {
    const list = h('div', { class: 'hud-chips-list' });
    const hasRegion = !!region(s);
    for (const id of DRINK_ORDER) {
      const def = DRINKS[id];
      const open = drinkUnlocked(s, id);
      const needs = [];
      if (!open && level(s) < def.level) needs.push(T('hud.levelN', { level: def.level }));
      if (!open && buildingLevel(s, 'roaster') < def.roaster) needs.push(T('hud.menu.needRoaster', { level: def.roaster }));
      const price = hasRegion ? drinkPrice(s, id) : def.price;
      list.append(h('div', { class: `hud-seed hud-drink${open ? '' : ' is-locked'}`, dataset: { hudId: `drink-${id}` } },
        h('span', { class: 'hud-seed-ico', attrs: { 'aria-hidden': 'true' } }, def.icon),
        h('span', { class: 'hud-seed-name' }, T(`drink.${id}`)),
        open ? h('span', { class: 'hud-seed-meta' }, coinAmount(price), h('span', null, T('hud.menu.beans', { n: def.beans })),
          h('span', null, `⏱ ${duration(hasRegion ? brewMs(s, id) : def.brewSeconds * 1000)}`))
          : h('span', { class: 'hud-seed-meta' }, needs.map(text => lockTag(text)))));
    }
    return h('div', null, h('p', { class: 'hud-hint' }, T('hud.menu.hint')), list);
  };
}

// ---------- Beans (café: buy from the supplier) ----------
export function beansSheet(ctx) {
  return s => {
    const cap = region(s) ? capacity(s) : 0;
    const q = beanBuyQuote(s);
    const label = q.free ? T('hud.beans.free', { n: q.amount }) : T('hud.beans.buy', { n: q.amount || BEANS.buyPack });
    const note = q.error === 'storageFull' ? T('hud.beans.full') : q.error === 'coins' ? needMore(q.missing) : null;
    return h('div', null,
      h('p', { class: `hud-line${cap && s.inventory.beans >= cap ? ' hud-line--bad' : ''}` }, T('hud.storage.fill', { n: Math.floor(s.inventory.beans), max: cap })),
      h('p', { class: 'hud-hint' }, T('hud.beans.hint', { price: BEANS.buyPrice })),
      h('div', { class: 'hud-row' }, actionButton({ id: 'buyBeans', label, icon: '🫘', cost: q.error ? null : q.cost, disabled: !!q.error, note,
        onClick: () => ctx.act('shop/buyBeans') })));
  };
}

// ---------- Staff ----------
/** Staff zone shown on the current screen: farm staff on the farm, café staff in the café. */
export const staffZone = ctx => (ctx.realm?.view === 'cafe' ? 'shop' : 'farm');

export function staffSheet(ctx) {
  return s => {
    const r = region(s);
    const zone = staffZone(ctx);
    const used = r ? STAFF_SLOTS[zone] - freeSlots(s, zone) : 0;
    const out = h('div', { class: 'hud-staff' },
      h('p', { class: 'hud-slots' }, T(zone === 'farm' ? 'hud.staff.slotsFarm' : 'hud.staff.slotsCafe', { n: used, max: STAFF_SLOTS[zone] })));
    const cards = h('div', { class: 'hud-cards hud-cards--wide' });
    for (const type of STAFF_ORDER.filter(id => STAFF[id].zone === zone)) {
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
    const units = s.staff.units.filter(u => STAFF[u.type]?.zone === zone);
    if (units.length) {
      const list = h('ul', { class: 'hud-units' });
      for (const u of units) {
        const def = STAFF[u.type];
        const here = r && u.assigned?.regionId === s.world.currentRegion;
        const doing = here ? ctx.realm?.staffStatus?.(u.uid) : '';
        // On a break (phone / empty battery): say so and offer to pay the fee right here.
        const stop = u.stopped;
        const status = stop ? T(stop.kind === 'battery' ? 'hud.staff.stopBattery' : 'hud.staff.stopPhone', { fee: fmt(stop.fee) })
          : here ? (doing ? T(`hud.staff.doing.${doing}`) : T('hud.staff.working', { zone: T(`hud.zone.${def.zone}`) })) : u.assigned ? T('hud.staff.elsewhere') : T('hud.staff.idle');
        const btn = stop
          ? actionButton({ label: T(stop.kind === 'battery' ? 'hud.staff.recharge' : 'hud.staff.backToWork'), icon: stop.kind === 'battery' ? '⚡' : '📵', tone: 'gold', cost: stop.fee,
            disabled: s.player.coins < stop.fee, note: s.player.coins < stop.fee ? needMore(stop.fee - s.player.coins) : null, onClick: () => ctx.act('staff/resume', { uid: u.uid }) })
          : here
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
/** What Round `n` adds, derived from config. Rounds only gate crops, café buildings, robots and building level caps
 * (land and regions are bought with coins, never with Rounds). */
export function roundUnlocks(n) {
  const items = [];
  const name = (prefix, ids) => ids.map(id => T(`${prefix}.${id}`)).join(', ');
  const crops = CROP_ORDER.filter(id => CROPS[id].round === n);
  if (crops.length) items.push(['🌱', T('hud.unlock.crops', { list: name('crop', crops) })]);
  const builds = BUILD_MENU.filter(id => BUILDINGS[id].round === n);
  if (builds.length) items.push(['🔨', T('hud.unlock.buildings', { list: name('building', builds) })]);
  const staff = STAFF_ORDER.filter(id => STAFF[id].round === n);
  if (staff.length) items.push(['🤖', T('hud.unlock.staff', { list: name('staff', staff) })]);
  if (ROUND_LEVEL_CAP[n] > (ROUND_LEVEL_CAP[n - 1] || 0)) items.push(['⬆️', T('hud.unlock.levelCap', { cap: ROUND_LEVEL_CAP[n] })]);
  return items;
}

/** Buys one auto run after a small confirm card; one txId per confirm, so a double tap can never charge twice. */
export async function buyAuto(ctx) {
  if (ctx.buyingAuto) return;
  ctx.buyingAuto = true;
  try {
    const price = autoPrice(ctx.store.state.autoplay?.bought || 0);
    const txId = newTxId('auto');
    const yes = await ctx.confirm({ title: T('hud.auto.buyTitle'), body: T('hud.auto.buyBody', { min: Math.round(AUTO.runSeconds / 60) }), cost: price, confirmLabel: T('hud.auto.buyGo') });
    if (yes) { const r = ctx.act('auto/buy', {}, { txId }); if (r.ok && !r.duplicate) ctx.toast(T('hud.toast.autoBought'), 'good'); }
  } finally { ctx.buyingAuto = false; ctx.sheet.rerender(); }
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
    // World map (moved here from the toolbar; the World Gate on the farm opens it too).
    const world = actionButton({ id: 'worldMap', label: T('hud.worldMapBtn'), tone: 'plain', onClick: () => ctx.onTool('world') });
    // Auto play: runs left, start, buy one more with coins.
    const ap = s.autoplay || { runs: 0 };
    const price = autoPrice(ap.bought || 0);
    const auto = h('section', { class: 'hud-panel' }, h('h3', { class: 'hud-h3' }, `🤖 ${T('hud.auto.panel')}`),
      h('p', { class: 'hud-line' }, T('hud.auto.explain', { min: Math.round(AUTO.runSeconds / 60) })),
      h('p', { class: 'hud-sub' }, T('hud.auto.runs', { n: ap.runs || 0 })),
      h('div', { class: 'hud-row' },
        ap.runs > 0 && !ap.active ? actionButton({ label: T('hud.auto.startBtn'), icon: '▶', onClick: () => { ctx.sheet.close(); const r = ctx.act('auto/start'); if (r.ok && !r.noop) ctx.toast(T('hud.toast.autoStart'), 'good'); } }) : null,
        actionButton({ id: 'buyAuto', label: T('hud.auto.buyGo'), icon: '🛒', tone: 'gold', cost: price, disabled: s.player.coins < price || ctx.buyingAuto,
          note: s.player.coins < price ? needMore(price - s.player.coins) : null, onClick: () => buyAuto(ctx) })));
    return h('div', { class: 'hud-progress' }, world, auto, round, reb);
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
