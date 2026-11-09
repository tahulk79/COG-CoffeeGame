// Side list of staff problems: who is stuck and why, with the coin button that gets them going again. Replaces the fee
// bubbles over people's heads. Paid fixes come first (the ones that stop work on top); problems coins cannot fix (no water
// tank, no storehouse, not learned yet) open the unit instead. Repaints only when what it shows changed.
import { h } from './dom.js';
import { T } from './text.js';
import { actionButton } from './widgets.js';
import { sfx } from '../../shared/audio/index.js';
import { STAFF } from '../../core/config/economy.js';
import { assignedUnits, careError, gmOf, quickFix, region, unitBlocked, unitState } from '../../core/derive.js';

const SHOW = 4, EVERY = .5;
const INFO_ONLY = ['cantDo'];
// What the whole farm lacks: one line each, however many people are waiting for it; the button opens that build tab.
const FARM_NEED = { noPlots: 'plant', noStore: 'processing', noWell: 'garden' };

export function createStaffAlerts(ctx) {
  const store = ctx.store;
  const el = h('section', { class: 'hud-al', hidden: true, attrs: { 'aria-label': T('hud.al.aria') } });
  const KEY = 'godbean.alertsClosed';
  const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  // folded by default on a phone (the list covers the farm), open on a big screen; the player's choice is remembered
  let sig = null, clock = 0, closed = saved() != null ? saved() === '1' : matchMedia('(max-width: 759px)').matches;

  const zoneNow = () => (ctx.realm?.view === 'cafe' ? 'shop' : 'farm');
  const nameOf = u => u.name || T(`staff.${u.type}`);
  function rowsOf(s, now) {
    if (!region(s)) return [];
    const out = [], waiting = {}, crew = assignedUnits(s, s.world.currentRegion, zoneNow());
    for (const u of crew) {
      if (u.active === false) continue;
      const fix = quickFix(u, now);
      if (fix && [null, 'coins'].includes(careError(s, u, fix.kind, now))) { out.push({ u, key: unitState(u, now), fix, pri: unitBlocked(u, now) ? 0 : 1 }); continue; }
      const why = ctx.realm?.staffInfo?.(u.uid)?.reason;
      if (FARM_NEED[why]) waiting[why] = (waiting[why] || 0) + 1;
      else if (INFO_ONLY.includes(why)) out.push({ u, key: why, fix: null, pri: 2 });
    }
    for (const [why, n] of Object.entries(waiting)) out.push({ need: why, n, key: `${why}${n}`, pri: -1 });
    if (crew.length && !gmOf(s) && zoneNow() === 'farm' && ((s.autoplay?.runs || 0) > 0 || s.autoplay?.saved > 0)) out.push({ noGm: true, key: 'noGm', pri: -2 }); // a run waiting to be used; a nudge only while it is free to take
    return out.sort((a, b) => a.pri - b.pri);
  }
  function payAll(rows) {
    let n = 0;
    for (const { u, fix } of rows) if (fix && u && store.dispatch('staff/care', { uid: u.uid, kind: fix.kind, roll: Math.random() }).ok) n++;
    if (n) sfx('coin.spend');
  }
  async function fire(u) {
    if (!await ctx.confirm({ title: T('hud.al.fireTitle', { name: nameOf(u) }), body: T('hud.al.fireBody'), confirmLabel: T('hud.al.fire') })) return;
    ctx.act('staff/fire', { uid: u.uid });
    paint(true);
  }
  function row(s, r) {
    if (r.noGm) return h('li', { class: 'hud-al-row is-p0' }, h('div', { class: 'hud-al-who' }, h('strong', null, T('hud.al.noGm')), h('small', null, T('hud.al.noGmSub'))),
      h('button', { type: 'button', class: 'hud-al-see', on: { click: () => ctx.onTool('auto') } }, T('hud.auto.open')));
    if (r.need) return h('li', { class: 'hud-al-row is-p0' }, h('div', { class: 'hud-al-who' }, h('strong', null, T(`hud.al.need.${r.need}`)), h('small', null, T('hud.al.waitingN', { n: r.n }))),
      h('button', { type: 'button', class: 'hud-al-see', on: { click: () => ctx.openBuild(FARM_NEED[r.need]) } }, T('hud.al.build')));
    const issue = r.key === 'funny' ? `${T(`funny.${r.u.stopped.id}.${r.u.stopped.level}`)} · ${T('hud.uc.level', { n: r.u.stopped.level })}` : T(`hud.al.${r.key}`);
    const open = () => ctx.staffModal.open({ uid: r.u.uid });
    return h('li', { class: `hud-al-row is-p${r.pri}` },
      h('button', { type: 'button', class: 'hud-al-who', on: { click: open } },
        h('strong', null, nameOf(r.u)), h('small', null, issue)),
      r.fix ? actionButton({ label: T('hud.al.fix'), cost: r.fix.cost, tone: 'gold', disabled: s.player.coins < r.fix.cost,
        onClick: () => { if (ctx.act('staff/care', { uid: r.u.uid, kind: r.fix.kind, roll: Math.random() }).ok) sfx('coin.spend'); paint(true); } })
        : h('button', { type: 'button', class: 'hud-al-see', on: { click: open } }, T('hud.al.see')),
      r.key === 'funny' ? h('button', { type: 'button', class: 'hud-al-see', on: { click: () => fire(r.u) } }, T('hud.al.fire')) : null);
  }
  function paint(force = false) {
    const s = store.state, now = Date.now();
    const rows = ctx.isPlaying() ? rowsOf(s, now) : [];
    const paid = rows.filter(r => r.fix), total = paid.reduce((n, r) => n + r.fix.cost, 0);
    const next = `${closed}|${s.player.coins >= total}|${rows.map(r => `${r.u?.uid ?? ''}:${r.key}:${r.fix?.cost ?? ''}:${r.fix ? s.player.coins >= r.fix.cost : ''}`).join(',')}`;
    if (next === sig && !force) return;
    sig = next;
    el.hidden = !rows.length;
    el.replaceChildren();
    if (!rows.length) return;
    el.append(h('button', { type: 'button', class: 'hud-al-head', attrs: { 'aria-expanded': String(!closed) }, on: { click: () => { closed = !closed; try { localStorage.setItem(KEY, closed ? '1' : '0'); } catch { /* private mode */ } paint(true); } } },
      closed ? `⚠️ ${rows.length}` : T('hud.al.title', { n: rows.length }), h('span', { attrs: { 'aria-hidden': 'true' } }, closed ? '' : '▾')));
    el.classList.toggle('is-closed', closed);
    if (closed) return;
    el.append(h('ul', { class: 'hud-al-list' }, ...rows.slice(0, SHOW).map(r => row(s, r))));
    if (rows.length > SHOW) el.append(h('button', { type: 'button', class: 'hud-al-more', on: { click: () => ctx.staffModal.open({ tab: 'team' }) } }, T('hud.al.more', { n: rows.length - SHOW })));
    if (paid.length > 1) el.append(actionButton({ label: T('hud.al.fixAll'), cost: total, tone: 'gold', disabled: s.player.coins < Math.min(...paid.map(r => r.fix.cost)), onClick: () => { payAll(paid); paint(true); } }));
  }
  return {
    el,
    update(dt) { clock += dt; if (clock >= EVERY) { clock = 0; paint(); } },
  };
}
