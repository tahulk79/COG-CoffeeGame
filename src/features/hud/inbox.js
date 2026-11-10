// The inbox — «Duyệt (n)» (management-rules §4) and the history — «📒 Nhật ký» (§5), two bottom sheets.
//  · Inbox: every open task (the manager's requests, a rival's offer on a worker or on the manager) with its time left
//    on the PLAYED clock and its answers; the manager's backlog state + the apology; «Đã xử lý» = s.tasks.done with
//    status, ask→answer time and fine, and «Duyệt muộn» while a late approval is still allowed.
//  · Nhật ký: the shared history rows, newest first, grouped by day; actor / group / zone / day chips, HISTORY.page
//    rows per page; a colour bar per actor (the manager violet), a day summary (history.days) on each day header, and
//    a tappable task id that opens the task inline with its ask → answer time, status and fine.
//  · P4 polish: a manager header (avatar + name in his colour, backlog meter with the Chờ lệnh / dễ bị dụ / đình công
//    marks), requests and rival offers in their own sections, a life bar per task (amber < 20 %, red under
//    GM.look.ringLifeShare = the red ring under his feet in the world).
import { HISTORY, GM, STAFF, gmMoneyMul } from '../../core/config/economy.js';
import { sellAllQuote, sellQuote, tasksOpen, taskLeftMs, taskById, gmOf, histRows, historyDays, histName, unitOf, dayKey } from '../../core/derive.js';
import { sfx } from '../../shared/audio/index.js';
import { h } from './dom.js';
import { T, fmt, clock, gmReasonText, has } from './text.js';
import { actionButton } from './widgets.js';

const KIND_ICON = { care: '💝', trade: '📦', staffGrowth: '📈', land: '🏞️', loan: '💰', poach: '💼', gmPoach: '💼', topUp: '💎' };
const STATUS_ICON = { approved: '✅', denied: '✖️', expired: '⛔', failed: '❗', late: '🕓', cancelled: '➖' };
const GROUP_ICON = { work: '🛠️', care: '💝', hr: '👥', money: '🪙', plan: '🗓️', approval: '📋', event: '⭐' };
const ACTORS = ['all', 'player', 'manager', 'worker', 'robot'];
const ZONES = ['all', 'farm', 'shop'];
const played = s => s.clock?.played || 0;
const hm = at => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dayText = d => `${String(d % 100).padStart(2, '0')}/${String(Math.floor(d / 100) % 100).padStart(2, '0')}`;
const section = (title, ...kids) => h('section', { class: 'hud-sm-sec' }, h('h3', { class: 'hud-sm-h' }, title), ...kids);
const chips = (label, values, cur, text, onPick) => h('div', { class: 'hud-sm-chips', attrs: { role: 'group', 'aria-label': label } },
  ...values.map(v => h('button', { type: 'button', class: 'hud-sm-chip', attrs: { 'aria-pressed': String(cur === v) }, on: { click: () => onPick(v) } }, text(v))));

/** What a task asks, in words. */
export function taskText(s, t) {
  if (t.kind === 'poach') return T('hud.inbox.poach', { name: t.reason?.[1]?.name || histName(s, t.act?.payload?.uid) || T('hud.sm.someone') });
  if (t.kind === 'gmPoach') return T('hud.inbox.gmPoach', { name: t.reason?.[1]?.name || gmOf(s)?.name || '', rival: t.reason?.[1]?.rival || GM.poach.rival });
  if (t.kind === 'topUp') return T('hud.ask.topUpBody', { name: gmOf(s)?.name || '' });
  if (/^farm\/sell/.test(t.act?.type || '')) { // what is being sold and for how much
    const p = t.act.payload || {}, q = t.act.type === 'farm/sellAll' ? sellAllQuote(s) : sellQuote(s, p.item ?? p.good ?? 'beans', p.amount);
    return T('hud.ask.saleBody', { name: gmOf(s)?.name || '', amount: fmt(q.amount || 0), coins: fmt(Math.round((q.coins || 0) * gmMoneyMul(gmOf(s)))) });
  }
  return gmReasonText(t.reason);
}

/** One open task as a card with its answer buttons (the inbox and the staff modal's «Cần bạn» list share it). */
export function taskCard(ctx, s, t) {
    const act = (type, payload) => ctx.act(type, payload);
    const left = taskLeftMs(s, t), life = Math.max(1, t.untilPlayed - t.atPlayed), share = Math.max(0, Math.min(1, left / life));
    const urgent = share < GM.look.urgentShare;
    const short = s.player.coins < t.cost;
    const title = T(t.kind === 'gmPoach' ? 'hud.ask.poachTitle' : t.kind === 'poach' ? 'hud.ask.workerPoachTitle' : t.kind === 'topUp' ? 'hud.ask.topUpTitle' : 'hud.ask.saleTitle');
    return h('article', { class: `hud-ask-card${urgent ? ' is-urgent' : ''}` },
      h('span', { class: 'hud-ask-ico', attrs: { 'aria-hidden': 'true' } }, KIND_ICON[t.kind] || '📋'),
      h('div', { class: 'hud-ask-main' },
        h('p', { class: 'hud-ask-head' }, h('strong', null, title), h('small', null, `⏳ ${clock(left)}`)),
        h('p', { class: 'hud-ask-text' }, taskText(s, t))),
      h('i', { class: 'hud-ask-life', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(share * 100)), 'aria-label': T('hud.inbox.lifeAria') } }, h('b', { style: { width: `${(share * 100).toFixed(1)}%` } })),
      h('div', { class: 'hud-ask-acts' },
        actionButton({ label: T('hud.ask.yes'), cost: t.cost > 0 ? t.cost : undefined, tone: 'go', disabled: short, onClick: () => { const r = act('task/approve', { id: t.id, roll: Math.random(), ...(t.kind === 'gmPoach' ? { how: 'bonus' } : {}) }); if (r.ok) sfx(t.cost > 0 ? 'coin.spend' : 'ui.click'); } }),
        actionButton({ label: T('hud.ask.no'), tone: 'plain', onClick: () => act('task/deny', { id: t.id }) })),
      t.kind === 'gmPoach' ? h('button', { type: 'button', class: 'hud-ask-link', on: { click: () => { ctx.sheet.close(); ctx.staffModal.open({ tab: 'gm' }); } } }, T('hud.ask.pickReplacement')) : null);
}

// «Duyệt (n)»: only what waits for your decision, each with what it is about and Duyệt / Từ chối.
export function inboxSheet(ctx) {
  const render = s => {
    const open = [...tasksOpen(s)].sort((a, b) => a.untilPlayed - b.untilPlayed);
    return h('div', { class: 'hud-inbox' }, open.length ? h('div', { class: 'hud-ask-list' }, ...open.map(t => taskCard(ctx, s, t))) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.inbox.empty')));
  };
  render.sig = s => `${Math.floor(played(s) / 1000)}|${s.player.coins}|${tasksOpen(s).map(t => t.id + t.untilPlayed).join(',')}`;
  return render;
}

// ---------- Nhật ký ----------
const who = (s, id) => (id === 'player' ? T('hud.hist.you') : id === 'system' ? T('hud.hist.system') : id === 'g1' ? (histName(s, 'g1') || T('hud.hist.manager'))
  : histName(s, id) || (unitOf(s, id) ? T(`staff.${unitOf(s, id).type}`) : T('hud.sm.someone')));
const careName = x => T(`hud.sm.care.${typeof x === 'string' ? x : x?.kind || 'coffee'}`);
/** One history row as a line of text. */
export function rowText(s, r) {
  const x = r.extra, what = x?.reason ? gmReasonText(x.reason) : '';
  const name = r.name || (r.subject ? who(s, r.subject) : who(s, r.actor));
  const by = who(s, r.actor);
  switch (r.type) {
    case 'work': return T('hud.hist.work', { name: by, task: x?.task ? T(`hud.staff.task.${x.task}`) : T('hud.hist.jobs'), n: x?.n || 1 });
    case 'setTasks': return T('hud.hist.setTasks', { by, name, list: (x?.tasks || []).length ? x.tasks.map(k => T(`hud.staff.task.${k}`)).join(', ') : T('hud.staff.task.auto') });
    case 'robotTask': return T('hud.hist.setTasks', { by, name, list: T(`hud.staff.task.${x?.task || 'auto'}`) });
    case 'taskFiled': return T(x?.kind === 'poach' || x?.kind === 'gmPoach' ? 'hud.hist.rival' : 'hud.hist.taskFiled', { by, what: x?.kind === 'poach' ? T('hud.inbox.poach', { name }) : x?.kind === 'gmPoach' ? T('hud.inbox.gmPoach', { name: who(s, 'g1'), rival: GM.poach.rival }) : what });
    case 'taskExpired': return T('hud.hist.taskExpired', { what: x?.kind === 'poach' ? T('hud.inbox.poach', { name }) : x?.kind === 'gmPoach' ? T('hud.inbox.gmPoach', { name: who(s, 'g1'), rival: GM.poach.rival }) : what });
    case 'taskLate': return T('hud.hist.taskLate', { what });
    case 'fine': return T('hud.hist.fine', { coins: fmt(r.cost || 0) });
    case 'loanTaken': return x?.usd ? T('hud.hist.loanTakenUsd', { usd: `$${(x.usd / 100).toFixed(2)}` }) : T('hud.hist.loanTaken', { coins: fmt(r.gain || 0), min: x?.termMin ?? '' });
    case 'loanPaid': return x?.usd ? T('hud.hist.loanPaidUsd', { usd: `$${(x.usd / 100).toFixed(2)}` }) : T('hud.hist.loanPaid', { coins: fmt(r.cost || 0), owed: fmt(Math.ceil(x?.owed || 0)) });
    case 'loanRepaid': return T('hud.hist.loanRepaid');
    case 'loanLate': return T('hud.gm.log.loanLate', { owed: fmt(x?.owed || r.cost || 0) });
    case 'rebirth': return T('hud.hist.rebirth');
    case 'dayPlan': return T('hud.hist.dayPlan', { by, mix: (x?.mix || []).map(m => `${T(`crop.${m.crop}`)} ${m.pct}%`).join(' · ') || '—', coins: fmt(x?.target || 0) });
    case 'licence': return T('hud.hist.licence', { lic: T(`hud.gm.lic.${x?.group || 'beans'}`), coins: fmt(r.cost || x?.coins || 0) });
    case 'landSold': return T('hud.hist.landSold', { lot: x?.lot || r.subject || '', coins: fmt(r.gain || 0) });
    case 'trainStart': return T('hud.hist.trainStart', { by, skill: x?.to ?? '', coins: fmt(x?.coins || 0) });
    case 'trained': return T('hud.hist.trained', { by, skill: x?.skill ?? '' });
    case 'topUpSeen': return T('hud.hist.topUpSeen');
    case 'craft': return T('hud.hist.craft', { name, task: T(`hud.staff.task.${x?.task || 'harvest'}`), step: T(`hud.cr.step.${x?.step || 1}`) });
    case 'part': return T('hud.hist.part', { name, part: x?.part ? T(`hud.staff.part.${x.part}`) : '', tier: x?.tier ?? '' });
    case 'gear': return T('hud.hist.gear', { name, item: T(`hud.g4.item.${x?.item || 'boots'}`), tier: x?.tier ?? '' });
    case 'software': return T('hud.hist.software', { name, pack: T(`hud.g4.pack.${x?.pack || 'autoCharge'}`) });
    case 'mvp': return T('hud.hist.mvp', { name, coins: fmt(x?.earned || 0) });
    case 'warranty': return T('hud.hist.warranty', { name, n: x?.left ?? 0 });
    case 'followed': return T('hud.hist.followed', { name });
    case 'nagged': return T(x?.ok ? 'hud.sm.j.naggedOk' : 'hud.sm.j.naggedNo', { name });
    case 'cared': return T('hud.sm.j.cared', { name, care: careName(x) });
    case 'upgraded': return T('hud.sm.j.upgraded', { name, stat: x?.stat ? T(`hud.stat.${x.stat}`) : '', to: x?.to ?? '' });
    case 'promoted': return T('hud.sm.j.promoted', { name, rank: T(`hud.cr.rank.${x?.rank || 'staff'}`) });
    case 'steppedDown': return T('hud.sm.j.steppedDown', { name, rank: T(`hud.cr.rank.${x?.rank || 'skilled'}`) });
    case 'nudged': return T('hud.sm.j.nudged', { name, by: x?.by || T('hud.sm.someone') });
    case 'autoCare': return T('hud.sm.j.autoCare', { name, care: careName(x) });
    case 'managerCare': return T('hud.sm.j.managerCare', { name, by: x?.by || T('hud.sm.someone'), care: careName(x) });
    case 'poachStarted': case 'poachRefused': return T(`hud.sm.j.${r.type}`, { name, rival: typeof x === 'string' ? x : '' });
    default: break;
  }
  if (r.gm === 1) { // the manager's own log rows
    switch (r.type) {
      case 'did': return x?.cost > 0 ? T('hud.gm.log.didCost', { what, coins: fmt(x.cost) }) : T('hud.gm.log.did', { what });
      case 'approved': case 'asked': case 'expired': case 'denied': case 'failed': case 'later': return T(`hud.gm.log.${r.type}`, { what });
      case 'handed': case 'takenBack': return T(`hud.gm.log.${r.type}`);
      case 'hired': return T('hud.gm.log.hired', { name: x?.name || '', coins: fmt(x?.fee || 0) });
      case 'left': return T(x?.why === 'fired' ? 'hud.gm.log.fired' : x?.why === 'quit' ? 'hud.gm.log.quit' : 'hud.gm.log.left', { name: x?.name || '' });
      case 'poached': case 'refused': return T(`hud.gm.log.${r.type}`, { rival: x?.rival || '' });
      case 'kept': return T(x?.how === 'raise' ? 'hud.gm.log.keptRaise' : 'hud.gm.log.keptBonus');
      case 'calmed': case 'apologised': return T(`hud.gm.log.${r.type}`, { coins: fmt(x?.coins || 0) });
      case 'unpaid': return T('hud.gm.log.unpaid', { coins: fmt(x?.coins || 0) });
      case 'away': return T('hud.gm.log.away', { min: x?.min ?? '', earned: fmt(x?.earned || 0), salary: fmt(x?.salary || 0) });
      case 'idle': case 'absent': return T(`hud.gm.log.${r.type}`, { min: x?.min ?? '' });
      case 'missedYou': return T('hud.gm.log.missedYou', { hours: x?.hours ?? '', drop: x?.drop ?? '' });
      case 'waiting': return T('hud.gm.log.waiting', { n: x?.backlog ?? '' });
      case 'strike': case 'strikeOver': return T(`hud.gm.log.${r.type}`);
      default: break;
    }
  }
  if (r.subject && r.subject !== 'g1' && has(`hud.sm.j.${r.type}`)) return T(`hud.sm.j.${r.type}`, { name });
  return T('hud.hist.other', { by, type: r.type });
}

// Colour bar of a row: who did it (the manager's rows violet, whoever they are about).
function actorClass(s, r) {
  if (r.actor === 'g1' || r.subject === 'g1' || r.gm === 1) return 'is-manager';
  if (r.actor === 'player') return 'is-player';
  if (r.actor === 'system') return 'is-system';
  const u = unitOf(s, r.actor);
  return u ? (STAFF[u.type]?.kind === 'robot' ? 'is-robot' : 'is-worker') : r.kind === 'robot' ? 'is-robot' : 'is-worker';
}
// One day's totals from s.history.days (every actor), for the day header.
function daySum(s, d) {
  let jobs = 0, earned = 0, spent = 0, done = 0, expired = 0;
  for (const x of s.history?.days || []) if (x.d === d) { jobs += x.jobs || 0; earned += x.earned || 0; spent += x.spent || 0; done += x.tasksDone || 0; expired += x.tasksExpired || 0; }
  return jobs || earned || spent || done || expired ? T('hud.hist.daySum', { jobs: fmt(jobs), earned: fmt(earned), spent: fmt(spent), done, expired }) : '';
}
// A task opened from its id in Nhật ký: what it asked, status, ask → answer time, fine.
function taskDetail(s, id) {
  const t = taskById(s, id);
  if (!t) return h('small', { class: 'hud-hist-task' }, T('hud.hist.taskGone', { id }));
  const wait = Number.isFinite(t.answeredAtPlayed) ? Math.max(0, t.answeredAtPlayed - t.atPlayed) : null;
  const bits = [T(`hud.inbox.status.${t.status}`), t.status === 'open' ? T('hud.hist.taskLeft', { t: clock(taskLeftMs(s, t)) }) : null,
    wait != null ? T('hud.hist.taskWait', { t: clock(wait) }) : null, t.cost > 0 ? T('hud.gm.reqCost', { coins: fmt(t.cost) }) : null, t.fine > 0 ? T('hud.inbox.fine', { coins: fmt(t.fine) }) : null].filter(Boolean);
  return h('span', { class: `hud-hist-task${t.by === 'g1' ? ' is-manager' : ''}` }, h('strong', null, `${KIND_ICON[t.kind] || '📋'} ${taskText(s, t)}`), h('small', null, bits.join(' · ')));
}

export function journalSheet(ctx) {
  const f = { actor: 'all', group: 'all', zone: 'all', day: null, pages: 1, task: null };
  const set = patch => { Object.assign(f, patch, patch.pages ? {} : { pages: 1 }); ctx.sheet?.rerender(); };
  const render = s => {
    const rows = histRows(s, f), shown = rows.slice(0, HISTORY.page * f.pages), days = historyDays(s);
    const list = [];
    let cur = null;
    for (const r of shown) {
      const d = dayKey(r.at);
      if (d !== cur) { cur = d; const sum = daySum(s, d); list.push(h('li', { class: 'hud-hist-day' }, h('span', null, d === dayKey(Date.now()) ? T('hud.pf.today') : dayText(d)), sum ? h('small', null, sum) : null)); }
      const open = r.taskId && f.task === `${r.id}`;
      list.push(h('li', { class: `hud-sm-jrow hud-hist-row ${actorClass(s, r)}` },
        h('span', { class: 'hud-sm-jico', attrs: { 'aria-hidden': 'true' } }, GROUP_ICON[r.group] || '•'),
        h('span', { class: 'hud-sm-jtext' }, rowText(s, r),
          r.taskId ? h('button', { type: 'button', class: 'hud-hist-tid', attrs: { 'aria-expanded': String(!!open), 'aria-label': T('hud.hist.taskOpen', { id: r.taskId }) }, on: { click: () => set({ task: open ? null : `${r.id}`, pages: f.pages }) } }, `📋 #${r.taskId}`) : null,
          open ? taskDetail(s, r.taskId) : null),
        h('small', { class: 'hud-sm-jago' }, hm(r.at))));
    }
    return h('div', { class: 'hud-hist' },
      chips(T('hud.hist.f.actor'), ACTORS, f.actor, v => T(`hud.hist.a.${v}`), v => set({ actor: v })),
      chips(T('hud.hist.f.group'), ['all', ...HISTORY.groupOrder], f.group, v => `${GROUP_ICON[v] || ''} ${T(`hud.hist.g.${v}`)}`.trim(), v => set({ group: v })),
      chips(T('hud.hist.f.zone'), ZONES, f.zone, v => T(`hud.hist.z.${v}`), v => set({ zone: v })),
      days.length > 1 ? chips(T('hud.hist.f.day'), [null, ...days.slice(0, 7)], f.day, v => (v == null ? T('hud.hist.allDays') : dayText(v)), v => set({ day: v })) : null,
      shown.length ? h('ul', { class: 'hud-sm-journal hud-hist-list' }, ...list) : h('p', { class: 'hud-line hud-line--muted' }, T('hud.hist.empty')),
      rows.length > shown.length ? h('div', { class: 'hud-row' }, actionButton({ label: T('hud.hist.more', { n: rows.length - shown.length }), tone: 'plain', onClick: () => set({ pages: f.pages + 1 }) })) : null);
  };
  render.sig = s => `${s.history?.seq || 0}|${s.history?.rows?.at(-1)?.extra?.n || 0}|${f.actor}|${f.group}|${f.zone}|${f.day}|${f.pages}|${f.task}|${f.task ? Math.floor((s.clock?.played || 0) / 1000) : 0}`;
  return render;
}
