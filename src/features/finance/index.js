// Finance: the account's USD, every farm's Gold, moving capital and the money history (docs/design/wallet-economy.md).
// One sheet over the world map or the farm. It repaints at most once a second, and only when what it shows has changed.
import { h, setText } from '../hud/dom.js';
import { T, fmt, errorText } from '../hud/text.js';
import { iconSvg } from '../../ui/icons.js';
import { getLang } from '../../i18n/index.js';
import { sfx } from '../../shared/audio/index.js';
import { WALLET } from '../../core/config/economy.js';
import { COUNTRIES, CAFE_ENABLED } from '../../core/config/world.js';
import { levelProgress } from '../../core/derive.js';
import { convertQuote, usdOf } from '../../core/wallet.js';
import { overview, farmCard } from '../../core/finance.js';
import { newTxId } from '../../core/store.js';
import { thumbOf } from './thumbs.js';
import './finance.css';

const usd = cents => `$${(cents / 100).toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
const icon = (name, cls = '') => { const n = h('span', { class: `fin-ico ${cls}`, attrs: { 'aria-hidden': 'true' } }); n.innerHTML = iconSvg(name); return n; };
const goldAmount = (n, cls = '') => h('span', { class: `fin-gold ${cls}` }, icon('gold'), fmt(n));
const btn = (label, cls, run, props = {}) => h('button', { type: 'button', class: `gu-btn ${cls}`, on: { click: e => { e.stopPropagation(); run(); } }, ...props }, label);
const farmName = id => T(`regionName.${id}`);
const countryName = id => T(`country.${id}`);
const alertText = (a, name) => T(`fin.alert.${a.kind}${a.what ? `.${a.what}` : ''}`, { farm: name, n: a.minutes ?? fmt(a.missing ?? a.loss ?? 0) });

export function createFinance({ store, sandbox = false, onEnterFarm }) {
  const title = h('h2', { class: 'fin-title' });
  const body = h('div', { class: 'fin-body' });
  const backBtn = h('button', { type: 'button', class: 'fin-round', attrs: { 'aria-label': T('fin.back') }, on: { click: () => back() } }, '‹');
  const closeBtn = h('button', { type: 'button', class: 'fin-round', attrs: { 'aria-label': T('hud.close') }, on: { click: () => close() } }, '×');
  const panel = h('section', { class: 'fin-sheet', attrs: { role: 'dialog', 'aria-modal': 'true' } }, h('header', { class: 'fin-head' }, backBtn, title, closeBtn), body);
  const scrim = h('div', { class: 'fin-scrim', on: { click: () => close() } });
  const toastEl = h('p', { class: 'fin-toast', hidden: true, attrs: { role: 'status' } });
  const root = h('div', { class: 'fin-root', hidden: true }, scrim, panel, toastEl);
  document.body.append(root);
  const onKey = e => { if (e.key === 'Escape' && !root.hidden) { e.stopPropagation(); e.preventDefault(); back(); } };
  document.addEventListener('keydown', onKey, true);

  // Where the player is. fund: { regionId, cents, stage: 'pick' | 'confirm' | 'done', requestId, result }
  let view = 'home', stack = [], period = WALLET.defaultPeriod, tab = 'farms', fund = null, sig = '', timer = 0, toastTimer = 0;
  const now = () => Date.now();
  const toast = text => { setText(toastEl, text); toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600); };

  function go(next, param) {
    stack.push({ view, fund }); view = next;
    if (next === 'fund') startFund(param); else if (next === 'farm') fund = { regionId: param };
    sfx('ui.open'); paint(true);
  }
  function back() { const prev = stack.pop(); if (!prev) { close(); return; } view = prev.view; fund = prev.fund; paint(true); }
  function startFund(regionId) {
    const have = usdOf(store.state);
    fund = { regionId, cents: Math.max(WALLET.minConvertCents, Math.min(have, WALLET.quickConvertCents[1])), stage: 'pick', requestId: null, result: null };
  }
  const follow = (a, regionId) => go(a.go === 'fund' ? 'fund' : 'farm', regionId);

  // ---------- pieces ----------
  const statusChip = status => h('span', { class: `fin-status is-${status}` }, T(`fin.status.${status}`));
  function thumb(card) {
    const src = thumbOf(card.id), c = COUNTRIES[card.countryId]?.palette.ground ?? 0x7fae5a;
    if (src) return h('img', { class: 'fin-thumb', src, alt: '' });
    const t = icon('farm', 'fin-thumb'); t.style.background = `#${c.toString(16).padStart(6, '0')}`; return t;
  }
  function periodBar() {
    return h('div', { class: 'fin-seg', attrs: { role: 'tablist' } }, WALLET.periods.map(d => h('button', { type: 'button', class: d === period ? 'is-on' : '', attrs: { role: 'tab', 'aria-selected': String(d === period) },
      on: { click: () => { period = d; paint(true); } } }, T(`fin.period.${d}`))));
  }
  const profitOf = p => h('span', { class: `fin-profit ${p.profit < 0 ? 'is-bad' : p.profit > 0 ? 'is-good' : ''}` }, p.hasData ? signed(p.profit) : '—');
  const stat = (label, value, cls = '') => h('div', { class: `fin-stat ${cls}` }, h('span', { class: 'fin-stat-val' }, value), h('span', { class: 'fin-stat-label' }, label));

  function canEnter(card) { return !(card.mode === 'cafe' && !CAFE_ENABLED) && !card.current; }
  function farmRow(card) {
    const open = () => go('farm', card.id);
    return h('li', { class: `fin-farm is-${card.status}` },
      h('button', { type: 'button', class: 'fin-farm-main', attrs: { 'aria-label': farmName(card.id) }, on: { click: open } }, thumb(card),
        h('span', { class: 'fin-farm-text' },
          h('strong', null, farmName(card.id)),
          h('small', null, countryName(card.countryId), card.current ? ` · ${T('fin.here')}` : ''),
          h('span', { class: 'fin-farm-nums' }, goldAmount(card.gold), profitOf(card.period)))),
      h('div', { class: 'fin-farm-side' }, statusChip(card.status),
        h('div', { class: 'fin-farm-btns' }, btn(T('fin.fund'), 'gu-btn--brass gu-btn--sm', () => go('fund', card.id)), canEnter(card) ? btn(T('fin.enter'), 'gu-btn--go gu-btn--sm', () => enter(card.id)) : null)));
  }
  function enter(regionId) {
    const r = onEnterFarm?.(regionId);
    if (r && !r.ok) { sfx('ui.deny'); toast(errorText(r)); return; }
    close();
  }

  // ---------- home ----------
  function renderHome(s) {
    const o = overview(s, now(), period), lp = levelProgress(s), alerts = o.cards.reduce((n, c) => n + c.alerts.length, 0);
    title.textContent = T('fin.title');
    const head = h('div', { class: 'fin-account' },
      h('span', { class: 'fin-avatar' }, h('b', null, String(lp.level))),
      h('span', { class: 'fin-account-text' }, h('strong', null, s.character?.name || T('hud.farmer')), h('small', null, T('fin.usdWallet'))),
      h('button', { type: 'button', class: 'fin-usd', on: { click: () => go('topup') } }, icon('usd'), h('b', null, usd(o.usdCents)), h('span', { class: 'fin-plus' }, icon('plus'))),
      h('button', { type: 'button', class: 'fin-round fin-bell', attrs: { 'aria-label': T('fin.alerts') }, on: { click: () => go('alerts') } }, icon('bell'), alerts ? h('i', null, String(alerts)) : null));
    const stats = h('div', { class: 'fin-stats' },
      stat(T('fin.stat.farms'), `${o.running}/${o.farms}`), stat(T('fin.stat.gold'), goldAmount(o.gold)),
      stat(T('fin.stat.earned'), fmt(o.earned)), stat(T('fin.stat.profit'), signed(o.profit), o.profit < 0 ? 'is-bad' : ''),
      stat(T('fin.stat.attention'), String(o.attention), o.attention ? 'is-warn' : ''));
    const tabs = h('div', { class: 'fin-tabs', attrs: { role: 'tablist' } }, ['farms', 'history'].map(t => h('button', { type: 'button', class: t === tab ? 'is-on' : '', attrs: { role: 'tab', 'aria-selected': String(t === tab) }, on: { click: () => { tab = t; paint(true); } } }, T(`fin.tab.${t}`))));
    const list = tab === 'farms'
      ? (o.cards.length ? h('ul', { class: 'fin-farms' }, o.cards.map(farmRow)) : h('p', { class: 'fin-empty' }, T('fin.noFarms')))
      : renderHistory(s);
    return h('div', null, head, stats, h('div', { class: 'fin-bar' }, tabs, tab === 'farms' ? periodBar() : null), list);
  }
  function renderHistory(s) {
    const rows = [...s.wallet.ledger].reverse();
    if (!rows.length) return h('p', { class: 'fin-empty' }, T('fin.noHistory'));
    const when = at => new Date(at).toLocaleString(getLang(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return h('ul', { class: 'fin-history' }, rows.map(r => h('li', null,
      h('span', { class: 'fin-history-text' }, h('strong', null, T(`fin.ledger.${r.kind}`)), h('small', null, [r.regionId ? farmName(r.regionId) : null, when(r.at), r.sandbox ? T('fin.sandbox') : null].filter(Boolean).join(' · '))),
      h('span', { class: 'fin-history-nums' }, r.usd ? h('b', { class: r.usd < 0 ? 'is-bad' : 'is-good' }, `${r.usd < 0 ? '−' : '+'}${usd(Math.abs(r.usd))}`) : null, r.gold ? h('span', { class: 'fin-gold' }, icon('gold'), signed(r.gold)) : null))));
  }

  // ---------- one farm ----------
  function renderFarm(s) {
    const card = farmCard(s, fund.regionId, now(), period), name = farmName(card.id);
    title.textContent = name;
    const p = card.period, cats = Object.entries(p.by).sort((a, b) => b[1] - a[1]);
    return h('div', null,
      h('div', { class: 'fin-farm-hero' }, thumb(card), h('div', null,
        h('small', null, countryName(card.countryId)), statusChip(card.status),
        h('p', { class: 'fin-farm-meta' }, card.tier != null ? T('fin.tier', { n: card.tier, max: card.tierMax }) : T('fin.cafe'), ' · ', T('fin.crew', { n: card.units })))),
      h('div', { class: 'fin-stats fin-stats--3' }, stat(T('fin.stat.gold'), goldAmount(card.gold)), stat(T('fin.stat.earned'), p.hasData ? fmt(p.earned) : '—'), stat(T('fin.stat.profit'), p.hasData ? signed(p.profit) : '—', p.profit < 0 ? 'is-bad' : '')),
      periodBar(),
      card.alerts.length ? h('ul', { class: 'fin-alerts' }, card.alerts.map(a => alertRow(a, card.id, name))) : null,
      cats.length ? h('ul', { class: 'fin-costs' }, cats.map(([k, v]) => h('li', null, h('span', null, T(`fin.cost.${k}`)), h('span', { class: 'fin-cost-bar' }, h('i', { style: { '--w': String(v / p.spent) } })), h('b', null, fmt(v))))) : null,
      h('div', { class: 'fin-actions' }, btn(T('fin.fund'), 'gu-btn--brass', () => go('fund', card.id)), canEnter(card) ? btn(T('fin.enter'), 'gu-btn--go', () => enter(card.id)) : null));
  }
  function alertRow(a, regionId, name) {
    return h('li', null, h('button', { type: 'button', class: `fin-alert is-${a.severity}`, on: { click: () => follow(a, regionId) } }, icon('warn'), h('span', null, alertText(a, name)), h('b', { attrs: { 'aria-hidden': 'true' } }, '›')));
  }
  function renderAlerts(s) {
    title.textContent = T('fin.alerts');
    const items = overview(s, now(), period).cards.flatMap(c => c.alerts.map(a => [a, c.id]));
    if (!items.length) return h('p', { class: 'fin-empty' }, T('fin.noAlerts'));
    return h('ul', { class: 'fin-alerts' }, items.map(([a, id]) => alertRow(a, id, farmName(id))));
  }

  // ---------- deposit (the demo gate: a tap adds the USD) ----------
  function renderTopup(s) {
    title.textContent = T('fin.topup');
    if (!sandbox) return h('p', { class: 'fin-empty' }, T('fin.topupClosed'));
    return h('div', null, h('p', { class: 'fin-note is-sandbox' }, T('fin.sandboxNote')),
      h('div', { class: 'fin-packs' }, WALLET.sandboxPackCents.map(cents => btn(usd(cents), 'gu-btn--brass', () => {
        const r = store.dispatch('wallet/sandboxDeposit', { cents, requestId: newTxId('dep') });
        if (!r.ok) { sfx('ui.deny'); toast(errorText(r)); return; }
        sfx('ui.buy'); toast(T('fin.topupDone', { usd: usd(cents) })); paint(true);
      }))), h('p', { class: 'fin-balance' }, T('fin.usdWallet'), ': ', h('b', null, usd(usdOf(s)))));
  }

  // ---------- capital: amount → preview → confirm ----------
  function setCents(cents) { fund.cents = cents; paint(true); }
  function renderFund(s) {
    const name = farmName(fund.regionId);
    title.textContent = T('fin.fundTitle', { farm: name });
    if (fund.stage === 'done') {
      const q = fund.result;
      return h('div', { class: 'fin-done' }, icon('gold', 'fin-done-ico'), h('p', { class: 'fin-done-title' }, T('fin.done', { gold: fmt(q.gold), farm: name })), h('p', { class: 'fin-balance' }, T('fin.usdLeft'), ' ', h('b', null, usd(usdOf(s)))),
        h('div', { class: 'fin-actions' }, btn(T('fin.again'), 'gu-btn--plain', () => { startFund(fund.regionId); paint(true); }), btn(T('fin.ok'), 'gu-btn--go', () => back())));
    }
    const q = convertQuote(s, fund.regionId, fund.cents), have = usdOf(s);
    const preview = h('div', { class: 'fin-preview' },
      h('div', null, h('small', null, T('fin.pay')), h('b', { class: 'fin-usd-amt' }, usd(fund.cents))), h('b', { class: 'fin-arrow', attrs: { 'aria-hidden': 'true' } }, '→'),
      h('div', null, h('small', null, T('fin.receive')), goldAmount(q.ok ? q.gold : fund.cents * q.rate / 100, 'fin-gold--big')));
    const rate = h('p', { class: `fin-rate${q.approved ? '' : ' is-draft'}` }, T('fin.rate', { gold: fmt(q.rate) }), q.approved ? '' : ` · ${T('fin.rateDraft')}`);
    const reason = q.ok ? null : h('p', { class: 'fin-reason' }, T(`fin.err.${q.error}`, { min: usd(WALLET.minConvertCents), n: usd(q.missingCents || 0) }));
    if (fund.stage === 'confirm') {
      return h('div', null, preview, rate,
        h('dl', { class: 'fin-after' }, h('dt', null, T('fin.afterUsd')), h('dd', null, usd(q.usdAfter)), h('dt', null, T('fin.afterGold', { farm: name })), h('dd', null, goldAmount(q.goldAfter))), reason,
        h('div', { class: 'fin-actions' }, btn(T('hud.cancel'), 'gu-btn--plain', () => { fund.stage = 'pick'; paint(true); }), btn(T('fin.confirm'), 'gu-btn--go', () => confirmFund(q), { disabled: !q.ok })));
    }
    const step = WALLET.minConvertCents, clamp = c => Math.max(WALLET.minConvertCents, Math.min(have || WALLET.minConvertCents, c));
    return h('div', null,
      h('p', { class: 'fin-balance' }, T('fin.usdWallet'), ': ', h('b', null, usd(have)), ' ', have < WALLET.minConvertCents ? btn(T('fin.topup'), 'gu-btn--brass gu-btn--sm', () => go('topup')) : null),
      h('div', { class: 'fin-stepper' }, btn('−', 'gu-btn--plain fin-step', () => setCents(clamp(fund.cents - step)), { attrs: { 'aria-label': T('fin.less') } }), h('b', { class: 'fin-amount' }, usd(fund.cents)), btn('+', 'gu-btn--plain fin-step', () => setCents(clamp(fund.cents + step)), { attrs: { 'aria-label': T('fin.more') } })),
      h('div', { class: 'fin-quick' }, WALLET.quickConvertCents.map(c => btn(usd(c), `gu-btn--plain gu-btn--sm${c === fund.cents ? ' is-on' : ''}`, () => setCents(clamp(c)), { disabled: have < c })), btn(T('fin.all'), 'gu-btn--plain gu-btn--sm', () => setCents(clamp(have)), { disabled: have < WALLET.minConvertCents })),
      preview, rate, reason,
      h('div', { class: 'fin-actions' }, btn(T('fin.review'), 'gu-btn--go', () => { fund.stage = 'confirm'; fund.requestId = newTxId('fund'); paint(true); }, { disabled: !q.ok })));
  }
  function confirmFund(q) {
    // The id was made when this confirm card opened: a second tap repeats it and the reducer ignores the repeat.
    const r = store.dispatch('wallet/convert', { regionId: fund.regionId, cents: fund.cents, rate: q.rate, requestId: fund.requestId }, { now: now() });
    if (!r.ok) { sfx('ui.deny'); toast(T(`fin.err.${r.error}`, { min: usd(WALLET.minConvertCents), n: usd(r.data?.missingCents || 0) })); fund.stage = 'pick'; paint(true); return; }
    if (r.noop) return;
    sfx('ui.buy'); fund.stage = 'done'; fund.result = q; paint(true);
  }

  // ---------- paint ----------
  const RENDER = { home: renderHome, farm: renderFarm, fund: renderFund, topup: renderTopup, alerts: renderAlerts };
  function signature(s) {
    const o = overview(s, now(), period);
    return JSON.stringify([view, tab, period, fund?.regionId, fund?.cents, fund?.stage, o.usdCents, s.wallet.seq, o.cards.map(c => [Math.round(c.gold), c.status, c.alerts.length, Math.round(c.period.profit), c.units])]);
  }
  function paint(force) {
    if (root.hidden) return;
    const s = store.state;
    if (!s.wallet) return;
    const next = signature(s);
    if (!force && next === sig) return;
    sig = next;
    const top = body.scrollTop;
    root.dataset.view = view;
    backBtn.hidden = !stack.length;
    body.replaceChildren(RENDER[view](s));
    body.scrollTop = force ? 0 : top;
  }
  function open(next = 'home', param) {
    stack = []; view = next; tab = 'farms'; fund = null;
    if (next === 'fund') startFund(param); else if (next === 'farm') fund = { regionId: param };
    root.hidden = false; document.body.classList.add('finance-open');
    paint(true);
    clearInterval(timer); timer = setInterval(() => paint(false), 1000);
  }
  function close() { if (root.hidden) return; root.hidden = true; clearInterval(timer); document.body.classList.remove('finance-open'); body.replaceChildren(); sig = ''; }
  return { open, close, get isOpen() { return !root.hidden; }, dispose() { close(); clearTimeout(toastTimer); document.removeEventListener('keydown', onKey, true); root.remove(); } };
}
