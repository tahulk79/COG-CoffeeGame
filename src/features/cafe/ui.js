import { CROPS, HUD_UNLOCKS } from '../farm/content.js';
import { regionType } from '../world-map/content.js';
import { createIncidentLayer, clock } from '../../ui/incidents.js';
import { ASSETS, supplierPrice, assetValue, formatCoins, formatMass, upgradePrice } from '../farm/rules.js';
import { BRAND_QUALITY, MILKS, WATERS, recipeShort, SHIFT_TIERS, CANDIDATES, GEAR, MAX_CREW, RECIPES, STAFF_MAX, STAFF_ROLES, STAFF_STATS, SUPPLIES, TABLE_LEVELS, cafeRank, effectLines, lockReason, recipeById, roleOf, staffStat, staffWage, stars, trainCost } from './recipes.js';
import { mountBench } from './bench.js';
import { isSettingsOpen, openSettings } from '../../ui/settings.js';
import { askLesson } from '../../ui/lesson-prompt.js';
import { usesTouch } from '../../ui/dialogue.js';
import { mountHudDrawer } from '../../ui/hud-drawer.js';
import { INDOOR_TABLES, TABLES, shiftAvg } from './service.js';
import { t, formatNumber } from '../../i18n/index.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCoins(Math.abs(n))}`;
const INCIDENT_ICON = { phone: '📱', sick: '🤒', rude: '😤' };
// First-visit guide on the quest card (onboarding-flow.md 3.7); the step is derived from state, nothing saved but the done flag.
const INTRO_STEPS = t('cafe.intro.steps');
const coins = n => t('cafe.coins', { n: formatCoins(n) });
const stepLine = (step, recipe) => step.type === 'bean' ? t('cafe.book.stepBean', { bean: CROPS.find(c => c.id === recipe.bean).name }) : step.type === 'pour' ? `${step.text}: ${step.target[0]}–${step.target[1]} ${step.unit}` : `${step.text}: ${step.options.find(o => o.ok === 1).label}`;

export function createCafeUI({ farm, service, profile, notice, onExit, onOrders, onWalkTable, onWalk = () => {}, onGuide = () => {}, fx = () => {} }) {
  const farmless = regionType(farm.peek().region) === 'cafe'; // chỉ có quán: hạt chỉ nhập ngoài, không đặt farm
  const events = new AbortController(), signal = events.signal;
  let cleanup = null, view = null;
  // Heaven re-ask (onboarding-flow.md 3.1): queued by the cup result / shift report, shown once that screen closes,
  // because the dialogue box cannot sit above a showModal() dialog. The model enforces 1 per work day.
  let lessonIds = null, closeLesson = null;
  function askQueued() {
    const ids = lessonIds; lessonIds = null;
    const lesson = ids && !isSettingsOpen() && document.getElementById('farm-modal').hidden && farm.pendingLesson(ids);
    if (!lesson) return;
    closeLesson = askLesson({ ...lesson, onClose: () => { closeLesson = null; }, onAnswer: optionId => {
      const result = farm.act('lessons', 'answer', { questionId: lesson.question.id, optionId });
      if (!result.ok) { notice(result.message, false); return null; }
      if (result.correct && result.perk) notice(t('cafe.lesson.perk', { name: result.perk.name, effect: result.perk.effect }));
      return result;
    } });
  }

  // Native <dialog> gives focus trapping and Esc-to-close; the scene treats it as a movement lock.
  // Markup mirrors the farm modal: green ribbon title, round close button, folder tabs, cream panel.
  const dialog = el('dialog', 'ui-modal ui-modal__window'); dialog.id = 'cafe-dialog'; dialog.setAttribute('aria-labelledby', 'cafe-dialog-title');
  const header = el('header'), title = el('h2'), subtitle = el('p', 'cafe-subtitle'), tabs = el('div', 'cafe-tabs'), body = el('div', 'cafe-dialog-body');
  title.id = 'cafe-dialog-title'; tabs.setAttribute('role', 'tablist');
  const closeButton = button('×', () => dialog.close(), 'cafe-close'); closeButton.setAttribute('aria-label', t('cafe.close'));
  header.append(title, subtitle, closeButton);
  dialog.append(header, tabs, body); document.body.append(dialog);
  // close fires async; skip it if another panel was opened right after closing.
  dialog.addEventListener('close', () => { if (dialog.open) return; fx('close'); cleanup?.(); cleanup = null; view = null; live = null; body.replaceChildren(); askQueued(); }, { signal });

  let live = null;
  // liveKey lets a card (e.g. a table) re-render when what it shows changes, without rebuilding every frame.
  function open(name, { heading, icon, note = '' }, render, liveKey = null) {
    closeLesson?.(); lessonIds = null; // another screen = busy again: drop the queued question (asked next time)
    cleanup?.(); cleanup = null; view = name; body.replaceChildren(); tabs.replaceChildren(); tabs.hidden = true;
    title.replaceChildren(el('span', '', icon), heading); subtitle.textContent = note; subtitle.hidden = !note;
    live = liveKey && { render, liveKey, key: liveKey() };
    cleanup = render(body) || null;
    if (!dialog.open) { fx('open'); dialog.showModal(); renderIncidents(); }
  }
  // Folder tabs above the panel, same as the farm's filters.
  function setTabs(items, current, pick) {
    tabs.hidden = false; tabs.replaceChildren();
    for (const [id, label] of items) {
      const tab = button(label, () => pick(id)); tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(id === current)); tabs.append(tab);
    }
  }
  const act = (action, choice, rerender) => {
    const before = service.refresh().coins, result = farm.act('cafe', action, choice);
    notice(result.message, result.ok); fx('buy', { ok: result.ok, spent: before - service.refresh().coins }); rerender?.(); return result;
  };
  // One list row: icon chip, title + detail, optional action button (farm settings-row look).
  const row = (icon, heading, detail, action, state = null) => {
    const node = el('div', 'cafe-row'), text = el('div');
    text.append(el('strong', '', heading), el('small', '', detail)); node.append(el('span', 'cafe-icon', icon), text);
    if (action) node.append(action);
    if (state) node.dataset.state = state;
    return node;
  };
  const levelDots = (level, max) => '●'.repeat(level) + '○'.repeat(max - level);
  // Robot quán thuê được khi nút Nhân viên ở farm đã mở (contracts mục 6, cafe/hire).
  const workersOpen = () => HUD_UNLOCKS.find(u => u.id === 'workers').when(farm.peek(), farm.level);
  // Đếm theo vai không tính thành viên gói thử (gift không chiếm chỗ).
  const roleCount = (crew, roleId) => crew.filter(m => !m.gift && roleOf(m.id)?.id === roleId).length;
  // «Thuê robot thay»: người ốm là phục vụ/tạp vụ và vai đó còn chỗ (người ốm vẫn chiếm chỗ) — robot-staff mục 4.
  const canCover = id => { const role = roleOf(id), crew = service.snap.cafe.crew; return ['waiter', 'cleaner'].includes(role?.id) && roleCount(crew, role.id) < role.max && crew.filter(m => !m.gift).length < MAX_CREW && workersOpen(); };
  // Bong bóng 📱🤒😤 trên HUD; khi modal (vd quầy pha) mở thì gắn vào dialog để vẫn chạm được.
  const incidentLayer = createIncidentLayer('cafe-incidents');
  function renderIncidents() {
    const now = Date.now(), crew = service.snap.cafe.crew;
    incidentLayer.render(service.incidents.map(i => {
      const left = i.type === 'sick' ? crew.find(m => m.id === i.id)?.rest || 0 : i.until - now;
      const text = t(`cafe.incident.${i.type === 'rude' ? 'rude' : i.type === 'phone' ? 'phone' : 'sick'}`, { name: i.name, time: clock(left) });
      const actions = i.type === 'sick' ? (canCover(i.id) ? [{ label: t('cafe.incident.cover'), onClick: () => openStaff(null, 'robot') }] : [])
        : [{ label: i.type === 'rude' ? t('cafe.incident.stop') : t('cafe.incident.remind'), tone: i.type === 'rude' ? 'gold' : 'go', onClick: () => { service.remind(i.id); refreshHud(); } }];
      return { id: i.id, type: i.type, icon: INCIDENT_ICON[i.type], text, ms: i.type === 'rude' ? Math.max(0, left) : 0, actions };
    }), dialog.open ? dialog : document.body);
  }

  // Same layout as the farm: quest-style card + "today" card under the profile, quick column under coins, wooden bar bottom-right.
  // modal = the tile opens a centred modal, so it gets ui.open instead of the default click.
  const tile = (icon, text, onClick, modal = false) => { const node = button('', modal ? () => { closeLesson?.(); onClick(); } : onClick, 'ui-hud-btn'); node.append(el('span', '', icon), el('small', '', text)); if (modal) node.dataset.sfx = 'ui.open'; return node; };
  const quest = el('div', 'quest-tracker cafe-quest'), questText = el('div'), name = el('h2'), hint = el('p'), goal = el('p', 'cafe-goal'); // own class: mobile CSS hides .quest-tracker p
  questText.append(name, goal, hint); quest.append(el('span', 'quest-marker', '☕'), questText);
  // Intro steps 2–4: tapping the card walks the player to that step's spot (the 3D arrow can be off-screen on phones).
  const guideHint = el('p', 'ui-guide-hint');
  let walkTarget = null;
  const walkQuest = () => { if (walkTarget) onWalk(walkTarget); };
  quest.addEventListener('click', walkQuest, { signal });
  quest.addEventListener('keydown', e => { if (walkTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); walkQuest(); } }, { signal });
  const ops = el('div', 'cafe-ops'); ops.setAttribute('aria-live', 'off');
  const opLine = icon => { const line = el('span'); line.append(el('i', '', icon), el('b')); ops.append(line); return line.lastChild; };
  const shiftLine = opLine('⏱'), openLine = opLine('🚪'), seatLine = opLine('🪑'), repLine = opLine('⭐'), handLine = opLine('🖐');
  // One-row strip: short values on screen, full meaning in the tooltip/accessible name.
  for (const [line, meaning] of [[shiftLine, t('cafe.ops.shift')], [openLine, t('cafe.ops.door')], [seatLine, t('cafe.ops.seats')], [repLine, t('cafe.ops.rep')]]) line.parentElement.title = meaning;
  // Shift timer bar under the shift line: how much of the 4-minute shift is left.
  const shiftBar = el('i', 'cafe-shift-bar'); shiftLine.parentElement.after(shiftBar);
  const leftHud = document.querySelector('.farm-left-hud') || document.body;
  leftHud.append(quest, ops);
  const rail = el('div'); rail.id = 'cafe-rail'; rail.setAttribute('aria-label', t('cafe.rail')); document.body.append(rail);
  const toggle = tile('🚪', t('cafe.nav.open'), () => { const r = service.toggleOpen(); notice(r.message, r.ok); refreshHud(); });
  // HUD v2 (docs/shared/design-system.md §6): bar = Mở cửa, Kho, Nông trại, Quản lý; the rest sits in the drawer.
  const nav = el('nav'); nav.id = 'cafe-main-nav'; nav.setAttribute('aria-label', t('cafe.nav.label'));
  nav.append(toggle, tile('🧺', t('cafe.nav.pantry'), () => openPantry(), true), ...(onExit ? [tile('🌱', t('cafe.nav.farm'), onExit)] : [])); // chỉ có quán: không có nút về nông trại
  document.body.append(nav);
  const drawer = mountHudDrawer(nav, { signal, id: 'cafe-drawer' });
  drawer.grid.append(tile('🛠️', t('cafe.nav.upgrades'), () => openUpgrades(), true), tile('👥', t('cafe.nav.staff'), () => openStaff(), true), ...(farmless ? [] : [tile('📦', t('cafe.nav.orders'), onOrders, true)]), tile('📖', t('cafe.nav.book'), () => openBook(), true), tile('⚙️', t('cafe.nav.settings'), () => openSettings(), true));

  function refreshHud() {
    renderIncidents();
    const cafe = service.snap.cafe, tickets = service.tickets(), seated = service.customers.filter(c => c.seat).length;
    const seats = TABLES.reduce((sum, _, i) => sum + (service.isOpen(i) ? service.tableLevel(i).seats : 0), 0);
    name.textContent = t('cafe.hud.title', { name: profile.name, stars: '★'.repeat(cafeRank(cafe.reputation)) }).trim();
    openLine.textContent = t(cafe.open ? 'cafe.hud.doorOpen' : 'cafe.hud.doorClosed', { n: service.queueLength() });
    seatLine.textContent = `${seated}/${seats}${service.dirty.size ? t('cafe.hud.dirty', { n: service.dirty.size }) : ''}`;
    repLine.textContent = `${Math.round(cafe.reputation)}${service.combo > 1 ? ` · x${service.combo}` : ''}`;
    const shift = service.shift, left = shift ? Math.max(0, shift.endsAt - Date.now()) : 0;
    shiftLine.textContent = shift ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} · ${shiftTarget(shift)}${shiftLine.parentElement.dataset.state ? '' : ` · ⭐ ${recipeById(shift.special).name}`}` : t('cafe.hud.noShift');
    shiftBar.hidden = !shift; if (shift) shiftBar.style.setProperty('--ratio', left / (shift.endsAt - shift.startedAt));
    toggle.lastChild.textContent = cafe.open ? t('cafe.nav.close') : t('cafe.nav.open'); toggle.dataset.notification = String(!cafe.open);
    const key = tickets.map(tk => `${tk.id}:${tk.covered}:${tk.seconds}`).join('|') + `|${service.benchTarget}`;
    rail.hidden = !tickets.length;
    if (rail.dataset.key !== key) {
      rail.dataset.key = key; rail.replaceChildren();
      for (const tk of tickets.slice(0, 8)) {
        const chip = el('span', 'cafe-chip'); chip.dataset.covered = String(tk.covered); chip.dataset.urgent = String(tk.ratio < .3);
        // Order ticket: who (table / take-away), what (drink name), how long; ✓ once a cup is on its way.
        chip.title = t('cafe.hud.chip', { who: tk.label, drink: tk.recipe.name, s: tk.seconds });
        chip.append(el('small', 'cafe-chip-who', tk.label), el('b', '', tk.recipe.icon), el('strong', '', recipeShort(tk.recipe.id)), el('small', '', tk.id === service.benchTarget ? t('cafe.hud.brewing') : `${tk.seconds}s`));
        const bar = el('i', 'cafe-patience'); bar.style.setProperty('--ratio', tk.ratio); chip.append(bar); rail.append(chip);
      }
    }
    const held = service.hand && RECIPES.find(r => r.id === service.hand.recipeId);
    handLine.textContent = held ? t('cafe.hud.holding', { drink: held.name, stars: starText(service.hand.stars) }) : service.shelf.length ? t('cafe.hud.shelf', { n: service.shelf.length }) : '';
    handLine.parentElement.hidden = !handLine.textContent;
    // One clear next step, in the order a real shift flows.
    const stuck = service.agents.find(a => a.active && a.blocked);
    // No roasted beans in the café: every order would fail, so say where beans come from before inviting customers.
    const noBeans = !Object.values(cafe.stock.roasted).some(g => g >= 10), beanHint = noBeans && !held && !service.shelf.length;
    const model = farm.peek();
    let intro = !model.tutorial.seen.includes('cafe-intro');
    if (intro && model.stats.served > 0) { farm.act('tutorial', 'seen', 'cafe-intro'); intro = false; }
    // The bean hint still wins and hides the step until beans are back (spec 5).
    const step = !intro || beanHint ? 0 : held ? 4 : service.shelf.length ? 0 : tickets.length ? 3 : !cafe.open ? 1 : 2;
    const guest = step === 4 && service.customers.find(c => c.recipeId === held.id && ['seated', 'toSeat', 'pickup', 'toPickup'].includes(c.phase));
    // Current farm quest (D1b): shown once the intro steps are over; only 'served' progresses inside the café.
    const q = !step && farm.quest;
    goal.hidden = !q; if (q) goal.textContent = q.stat === 'served' ? t('cafe.hud.questProgress', { title: q.title, n: Math.min(model.stats.served, q.count), count: q.count }) : t('cafe.hud.quest', { title: q.title });
    toggle.classList.toggle('ui-attention', step === 1);
    const target = [null, null, 'register', 'bar', guest ? (guest.seat ? `table-${guest.seat.table}` : 'register') : null][step];
    onGuide(target);
    if (walkTarget !== target) {
      walkTarget = target;
      if (target) { quest.setAttribute('role', 'button'); quest.tabIndex = 0; questText.append(guideHint); }
      else { quest.removeAttribute('role'); quest.removeAttribute('tabindex'); guideHint.remove(); }
    }
    if (target) guideHint.textContent = usesTouch() ? t('cafe.guide.tap') : t('cafe.guide.click');
    hint.textContent = step ? t('cafe.intro.step', { step, text: INTRO_STEPS[step - 1] })
      : beanHint ? t(farmless ? 'cafe.hint.noBeansCafe' : 'cafe.hint.noBeans')
      : !cafe.open && !service.customers.length ? t('cafe.hint.open')
      : held ? t('cafe.hint.serve')
      : service.shelf.length ? t('cafe.hint.shelf')
      : stuck ? (stuck.blocked.missing ? t('cafe.hint.missing', { person: stuck.person.person, drink: stuck.blocked.recipe.name, missing: stuck.blocked.missing }) : t('cafe.hint.untrained', { person: stuck.person.person, drink: stuck.blocked.recipe.name, score: stuck.blocked.score }))
      : tickets.some(tk => !tk.covered) ? t('cafe.hint.brew')
      : service.queueLength() ? t('cafe.hint.register')
      : service.dirty.size ? t('cafe.hint.clean') : t('cafe.hint.wait');
  }

  function openBench() {
    open('bench', { heading: t('cafe.bench.heading'), icon: '☕' }, root => mountBench(root, { farm, service, notice, fx, close: () => dialog.close(), openPantry, askLater: ids => { lessonIds = ids; } }));
  }

  // Recipe book: list of recipes; picking one shows its full card in the same modal.
  function openBook(selected = null) {
    open('book', { heading: t('cafe.book.heading'), icon: '📖', note: selected ? '' : t('cafe.book.note') }, root => {
      const cafe = service.refresh().cafe, recipe = selected && recipeById(selected);
      if (recipe) {
        const m = cafe.mastery[recipe.id];
        root.append(button(t('cafe.book.all'), () => openBook(), 'cafe-link'));
        root.append(row(recipe.icon, recipe.name, t('cafe.book.detail', { stars: starText(stars(m?.best || 0)), price: formatCoins(recipe.price), made: m?.made || 0 })));
        const facts = el('dl', 'cafe-facts');
        for (const [key, text] of [[t('cafe.card.ratio'), recipe.card.ratio], [t('cafe.card.tool'), recipe.card.tool], [t('cafe.card.grind'), recipe.card.grind], [t('cafe.card.temp'), recipe.card.temp], [t('cafe.card.time'), recipe.card.time]]) facts.append(el('dt', '', key), el('dd', '', text));
        const steps = el('ol', 'cafe-steps');
        for (const step of recipe.steps) { const li = el('li', '', stepLine(step, recipe)); if (step.learn) li.append(el('small', '', step.learn)); steps.append(li); }
        root.append(facts, steps, el('p', 'cafe-story', recipe.story));
        return;
      }
      const grid = el('div', 'cafe-grid');
      for (const r of RECIPES) {
        const reason = lockReason(r, cafe), m = cafe.mastery[r.id];
        const card = button('', () => openBook(r.id), 'cafe-card'); card.dataset.locked = String(Boolean(reason));
        card.append(el('span', 'cafe-icon', reason ? '🔒' : r.icon), el('strong', '', r.name), el('small', '', reason || `${starText(stars(m?.best || 0))} · ${coins(r.price)}`));
        grid.append(card);
      }
      root.append(grid);
    });
  }

  let pantryTab = 'beans';
  function openPantry() {
    open('pantry', { heading: t('cafe.pantry.heading'), icon: '🧺' }, function render(root) {
      root.replaceChildren();
      setTabs([['beans', t('cafe.pantry.tabBeans')], ['supplies', t('cafe.pantry.tabSupplies')]], pantryTab, id => { pantryTab = id; render(root); });
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      if (pantryTab === 'beans') {
        const pending = p.orders.filter(o => o.source !== 'shop' && ['open', 'transit'].includes(o.status)).length;
        const coming = cafe.shipments.reduce((s, ship) => s + ship.lots.reduce((n, l) => n + l.grams, 0), 0);
        root.append(el('p', 'cafe-note', `${t(farmless ? 'cafe.pantry.beansNoteCafe' : 'cafe.pantry.beansNote', { pending })}${coming ? t('cafe.pantry.coming', { mass: formatMass(coming) }) : ''}`));
        for (const crop of CROPS) {
          const grams = cafe.stock.roasted[crop.id] || 0, unlocked = crop.level <= farm.level;
          const order = farmless ? null : button(t('cafe.pantry.order'), () => act('order', crop.id, rerender)); if (order) order.disabled = !unlocked;
          root.append(row('🫘', `${crop.name} · ${formatMass(grams)}`, unlocked ? t('cafe.pantry.enough', { n: Math.floor(grams / 18) }) : t(farmless ? 'cafe.pantry.lockedCafe' : 'cafe.pantry.locked', { level: crop.level }), order, grams < 60 && unlocked ? 'low' : null));
        }
        const supplier = button(coins(supplierPrice(p.region)), () => act('supply', null, rerender)); supplier.disabled = p.coins < supplierPrice(p.region);
        root.append(row('📦', t('cafe.pantry.supplier'), t('cafe.pantry.supplierDetail'), supplier));
        // E2: broke with no beans = free daily relief, so the café can never dead-lock.
        if (farm.reliefReady(Date.now())) root.append(row('🆘', t('cafe.pantry.relief'), t('cafe.pantry.reliefDetail'), button(t('cafe.pantry.reliefBtn'), () => act('relief', null, rerender))));
        return;
      }
      root.append(prefsCard(cafe, rerender));
      for (const s of SUPPLIES) {
        const buy = button(coins(s.price), () => act('buy', s.id, rerender)); buy.disabled = p.coins < s.price;
        root.append(row(s.icon, `${s.name} · ${formatNumber(cafe.supplies[s.id])} ${s.unit}`, t('cafe.pantry.buyPack', { pack: s.packLabel }), buy, cafe.supplies[s.id] < s.pack / 5 ? 'low' : null));
      }
    });
  }

  // "Nguyên liệu đang dùng": one milk and one water for every drink (04-cafe/gameplay.md "Sữa và nước"). Big tap targets.
  function prefsCard(cafe, rerender) {
    const card = el('section', 'cafe-prefs');
    card.append(el('h3', 'cafe-subhead', t('crew.prefs.title')), el('p', 'cafe-note', t('crew.prefs.note')));
    const group = (key, label, ids) => {
      const box = el('div', 'cafe-choice'); box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', label);
      box.append(el('span', 'cafe-choice-label', label));
      for (const id of ids) {
        const supply = SUPPLIES.find(s => s.id === id), q = BRAND_QUALITY[id], on = cafe.prefs[key] === id;
        const opt = button('', () => act('prefs', { [key]: id }, rerender), 'cafe-choice-opt');
        opt.setAttribute('role', 'radio'); opt.setAttribute('aria-checked', String(on)); opt.dataset.on = String(on);
        opt.append(el('span', 'cafe-choice-icon', supply?.icon || '🚰'), el('strong', '', supply?.name || t('crew.prefs.tap')),
          el('b', q >= 0 ? 'cafe-q cafe-q--up' : 'cafe-q cafe-q--down', t('crew.prefs.quality', { q: q > 0 ? `+${q}` : `${q}` })),
          el('small', '', supply ? t('crew.prefs.stock', { price: formatCoins(supply.price), pack: supply.packLabel, n: formatNumber(cafe.supplies[id] || 0), unit: supply.unit }) : t('crew.prefs.free')));
        box.append(opt);
      }
      return box;
    };
    card.append(group('milk', t('crew.prefs.milk'), MILKS), group('water', t('crew.prefs.water'), WATERS));
    // The chosen brand ran out: say what is used instead, so a lower score is never a mystery.
    const other = MILKS.find(m => m !== cafe.prefs.milk);
    if (!(cafe.supplies[cafe.prefs.milk] > 0)) card.append(el('p', 'ui-alert ui-alert--warn', t('crew.prefs.milkOut', { brand: SUPPLIES.find(s => s.id === cafe.prefs.milk).name, other: SUPPLIES.find(s => s.id === other).name })));
    if (cafe.prefs.water === 'lavie' && !(cafe.supplies.lavie > 0)) card.append(el('p', 'ui-alert ui-alert--warn', t('crew.prefs.lavieOut')));
    return card;
  }

  let upgradeTab = 'tables';
  function openUpgrades(tab = null) {
    if (tab) upgradeTab = tab;
    open('upgrades', { heading: t('cafe.upgrades.heading'), icon: '🛠️' }, function render(root) {
      root.replaceChildren();
      setTabs([['tables', t('cafe.upgrades.tabTables')], ['gear', t('cafe.upgrades.tabGear')], ['auto', t('cafe.upgrades.tabAuto')], ['expand', t('cafe.upgrades.tabExpand')]], upgradeTab, id => { upgradeTab = id; render(root); });
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      if (upgradeTab === 'tables') {
        const asset = ASSETS.find(a => a.id === 'cafe'), lv = p.upgrades.cafe, price = upgradePrice('cafe', lv), maxed = lv >= 10;
        const buyTables = button(maxed ? t('cafe.max') : coins(price), () => act('upgrade', null, rerender));
        buyTables.disabled = maxed || p.coins < price || farm.level < lv + 1;
        root.append(row('🪑', t('cafe.upgrades.moreTables', { n: assetValue(asset, lv) }), maxed ? t('cafe.upgrades.allTables') : `${t('cafe.upgrades.nextLevel', { level: lv + 1, n: assetValue(asset, lv + 1) })}${farm.level < lv + 1 ? t('cafe.upgrades.needFarm', { level: lv + 1 }) : ''}`, buyTables));
        root.append(el('p', 'cafe-note', t('cafe.upgrades.pickTable')));
        for (let i = 0; i < TABLES.length; i++) if (service.isOpen(i)) {
          const level = cafe.tables[i], info = TABLE_LEVELS[level - 1];
          root.append(row(['🪵', '🪑', '🛋️', '🛋️'][level - 1], t('cafe.upgrades.tableRow', { n: i + 1, name: info.name }), t('cafe.upgrades.seats', { dots: levelDots(level, TABLE_LEVELS.length), n: info.seats }), button(t('cafe.upgrades.upgrade'), () => openTable(i, 'upgrade'))));
        }
        return;
      }
      if (upgradeTab === 'auto') root.append(el('p', 'cafe-note', t('cafe.upgrades.autoNote')));
      if (upgradeTab === 'expand') root.append(el('p', 'cafe-note', t('cafe.upgrades.expandNote')));
      for (const gear of GEAR.filter(g => (g.group || 'gear') === upgradeTab)) {
        const level = cafe.gear[gear.id], max = gear.prices.length, cost = gear.prices[level];
        const buy = button(level >= max ? t('cafe.max') : coins(cost), () => act('gear', gear.id, rerender));
        buy.disabled = level >= max || p.coins < cost;
        root.append(row(gear.icon, `${gear.name} · ${level ? levelDots(level, max) : t('cafe.upgrades.none')}`, gear.detail, buy));
      }
    });
  }

  // Table card: who sits there and what they wait for, used cups, and the table's own upgrade path.
  function openTable(table, tab = 'seats') {
    tableTab = tab;
    open('table', { heading: t('cafe.table.name', { n: table + 1 }), icon: '🪑' }, function render(root) {
      root.replaceChildren();
      const p = service.refresh(), cafe = p.cafe, unlocked = service.isOpen(table), rerender = () => render(root);
      if (!unlocked && table >= INDOOR_TABLES) {
        // Garden tables come with Sân vườn, not with the table upgrade.
        const terrace = GEAR.find(g => g.id === 'terrace');
        root.append(row('🔒', t('cafe.table.garden'), terrace.detail));
        const buy = button(t('cafe.table.openGarden', { price: coins(terrace.prices[0]) }), () => act('gear', 'terrace', rerender), 'cafe-primary');
        buy.disabled = p.coins < terrace.prices[0];
        const actions = el('div', 'cafe-actions'); actions.append(buy); root.append(actions);
        return;
      }
      if (!unlocked) {
        const asset = ASSETS.find(a => a.id === 'cafe'), lv = p.upgrades.cafe, price = upgradePrice('cafe', lv), next = table === service.indoorCount();
        root.append(row('🔒', t('cafe.table.locked'), next ? `${t('cafe.table.unlockAt', { level: lv + 1, n: assetValue(asset, lv + 1) })}${farm.level < lv + 1 ? t('cafe.upgrades.needFarm', { level: lv + 1 }) : ''}` : t('cafe.table.nearFirst')));
        if (next) {
          const buy = button(t('cafe.table.open', { price: coins(price) }), () => act('upgrade', null, rerender), 'cafe-primary');
          buy.disabled = lv >= 10 || p.coins < price || farm.level < lv + 1;
          const actions = el('div', 'cafe-actions'); actions.append(buy); root.append(actions);
        }
        return;
      }
      setTabs([['seats', t('cafe.table.tabGuests')], ['upgrade', t('cafe.table.tabUpgrade')]], tableTab, id => { tableTab = id; render(root); });
      const level = cafe.tables[table], info = TABLE_LEVELS[level - 1], guests = service.guestsAt(table);
      if (tableTab === 'seats') {
        const dirty = [0, 1, 2, 3].filter(slot => service.dirty.has(`${table}:${slot}`)).length;
        const servable = service.hand && guests.some(c => c.recipeId === service.hand.recipeId && ['seated', 'toSeat'].includes(c.phase));
        if (servable || dirty) { const actions = el('div', 'cafe-actions'); actions.append(button(servable ? t('cafe.table.carry') : t('cafe.table.goClean', { n: dirty }), () => { dialog.close(); onWalkTable(table); }, 'cafe-primary')); root.append(actions); }
        for (let slot = 0; slot < info.seats; slot++) {
          const guest = guests.find(c => c.seat.slot === slot), recipe = guest?.recipeId && recipeById(guest.recipeId);
          const state = !guest ? (service.dirty.has(`${table}:${slot}`) ? ['🧽', t('cafe.table.dirty'), t('cafe.table.dirtyDetail'), 'low'] : ['💺', t('cafe.table.empty'), t('cafe.table.emptyDetail')])
            : guest.phase === 'drinking' ? [guest.mood || '😊', t('cafe.table.drinking', { drink: recipe.name }), t('cafe.table.drinkingDetail')]
            : [recipe.icon, t('cafe.table.waiting', { drink: recipe.name }), `${t('cafe.table.patience', { s: Math.max(0, Math.ceil(guest.patience)) })}${service.hand?.recipeId === recipe.id ? t('cafe.table.rightCup') : ''}`];
          root.append(row(state[0], t('cafe.table.seat', { n: slot + 1, state: state[1] }), state[2], null, state[3]));
        }
        return;
      }
      TABLE_LEVELS.forEach((item, i) => {
        const owned = i < level, nextOne = i === level;
        const buy = nextOne ? button(coins(item.price), () => act('table', table, rerender)) : null;
        if (buy) buy.disabled = p.coins < item.price;
        root.append(row(['🪵', '🪑', '🛋️', '💐'][i], `${item.name}${owned ? ' ✓' : ''}`, item.detail, buy, owned ? 'owned' : null));
      });
    }, () => JSON.stringify([tableTab, service.guestsAt(table).map(c => [c.seat?.slot, c.phase, c.recipeId, Math.ceil(c.patience / 10)]), [...service.dirty].filter(k => k.startsWith(`${table}:`)), service.hand?.recipeId, service.tableCount()]));
  }
  let tableTab = 'seats';

  // Same shape as the farm staff screen: team / recruit tabs, a roster of people, the selected person's sheet with stat bars.
  let staffTab = 'team', staffFocus = null;
  // tab: 'team' | 'hire' (người) | 'robot' — robot-staff mục 2, 9.
  function openStaff(focus = null, tab = null) {
    if (focus) { staffFocus = focus; staffTab = service.snap.cafe.crew.some(m => m.id === focus) ? 'team' : CANDIDATES.find(c => c.id === focus)?.kind === 'robot' ? 'robot' : 'hire'; }
    if (tab) { staffTab = tab; staffFocus = null; }
    open('staff', { heading: t('cafe.staff.heading'), icon: '👥' }, function render(root) {
      root.replaceChildren();
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root), now = Date.now(), unlocked = workersOpen();
      const counts = Object.fromEntries(STAFF_ROLES.map(r => [r.id, roleCount(cafe.crew, r.id)])), hired = cafe.crew.filter(m => !m.gift).length;
      setTabs([['team', t('cafe.staff.tabTeam', { n: hired, max: MAX_CREW })], ['hire', t('cafe.staff.tabPeople')], ['robot', t('cafe.staff.tabRobot', { icon: unlocked ? '🤖' : '🔒' })]], staffTab, id => { staffTab = id; staffFocus = null; rerender(); });
      const free = c => !c.giftOnly && !cafe.crew.some(m => m.id === c.id);
      const people = staffTab === 'team' ? cafe.crew.map(m => CANDIDATES.find(c => c.id === m.id)).filter(Boolean)
        : staffTab === 'robot' ? CANDIDATES.filter(c => c.kind === 'robot' && free(c)) : CANDIDATES.filter(c => c.kind !== 'robot' && free(c));
      if (staffTab === 'team') root.append(el('p', 'cafe-note', t('cafe.staff.teamNote', { roles: STAFF_ROLES.map(r => `${r.icon} ${counts[r.id]}/${r.max}`).join(' · ') })));
      if (staffTab === 'robot') root.append(el('p', unlocked ? 'cafe-note' : 'cafe-warning', unlocked ? t('cafe.staff.robotNote') : t('cafe.staff.robotLocked')));
      if (!people.length) { root.append(el('p', 'cafe-note', staffTab === 'team' ? t('cafe.staff.noTeam') : t('cafe.staff.noCandidates'))); return; }
      if (!people.some(c => c.id === staffFocus)) staffFocus = people[0].id;
      const incidents = new Map(service.incidents.map(i => [i.id, i.type]));
      const roster = el('div', 'cafe-roster');
      for (const c of people) {
        const member = cafe.crew.find(m => m.id === c.id), role = roleOf(c.id), robot = c.kind === 'robot';
        const tile = button('', () => { staffFocus = c.id; rerender(); }, 'cafe-roster-tab');
        tile.setAttribute('aria-pressed', String(c.id === staffFocus));
        tile.dataset.state = !member ? 'candidate' : member.paidUntil > now ? 'working' : 'idle';
        if (robot) tile.dataset.kind = 'robot';
        const badge = INCIDENT_ICON[incidents.get(c.id)] || '';
        tile.append(el('span', 'cafe-roster-avatar', c.avatar), el('strong', '', c.person), el('small', '', `${badge ? `${badge} ` : ''}${role.icon} ${role.name}${member?.gift ? t('cafe.staff.trial') : member && !robot ? t('cafe.staff.levelTag', { level: member.level }) : ''}`));
        roster.append(tile);
      }
      root.append(roster);

      const person = CANDIDATES.find(c => c.id === staffFocus), role = roleOf(person.id), member = cafe.crew.find(m => m.id === person.id);
      const robot = person.kind === 'robot', gift = Boolean(member?.gift), sick = member?.rest > 0;
      const level = member?.level || 1, paid = member?.paidUntil > now, active = paid && cafe.open, maxed = robot || level >= STAFF_MAX;
      const wage = staffWage(role, level, person), left = member ? Math.ceil((member.paidUntil - now) / 1000) : 0;
      const sheet = el('section', 'cafe-staff-sheet');
      const head = el('div', 'cafe-staff-head'), title = el('div');
      title.append(el('strong', '', `${person.person} · ${role.name}`), el('small', '', member ? (sick ? t('cafe.staff.sick', { time: clock(member.rest) }) : gift ? t('cafe.staff.gift', { s: left }) : active ? t('cafe.staff.active', { s: left }) : paid ? t('cafe.staff.paid', { s: left }) : t('cafe.staff.out')) : t('cafe.staff.candidate', { role: role.name, n: counts[role.id], max: role.max })));
      head.append(el('span', 'cafe-staff-avatar', person.avatar), title, el('b', 'cafe-staff-level', robot ? t('cafe.staff.robot') : t('cafe.staff.level', { level, max: STAFF_MAX })));
      sheet.append(head);
      if (!member) sheet.append(el('p', 'cafe-staff-bio', `“${person.bio}”`));
      sheet.append(el('p', 'cafe-staff-summary', gift ? t('cafe.staff.giftSummary', { detail: role.detail }) : robot ? t('cafe.staff.robotSummary', { detail: role.detail, wage }) : `${t('cafe.staff.summary', { detail: role.detail, label: member ? t('cafe.staff.wage') : t('cafe.staff.hireFee'), wage })}${maxed ? '' : t('cafe.staff.nextWage', { level: level + 1, wage: staffWage(role, level + 1, person) })}`));
      // Training adds +6 to every stat; the green number previews the next level.
      for (const [key, label] of STAFF_STATS) {
        const value = staffStat(person, level, key), next = staffStat(person, level + 1, key);
        const line = el('div', 'cafe-stat'), meter = el('meter'); meter.min = 0; meter.max = 100; meter.value = value; meter.setAttribute('aria-label', label);
        line.append(el('span', '', label), meter, el('b', '', String(value)), el('i', '', !maxed && next > value ? `→ ${next}` : ''));
        sheet.append(line);
      }
      const effects = el('div', 'cafe-effects');
      effects.append(el('strong', '', t('cafe.staff.effects')));
      const lines = effectLines(person, level), later = maxed ? null : effectLines(person, level + 1);
      lines.forEach(([stat, text], i) => { const item = el('p'); item.append(el('span', '', stat), el('b', '', text)); if (later) item.append(el('i', '', `→ ${later[i][1]}`)); effects.append(item); });
      sheet.append(effects);
      const actions = el('div', 'cafe-actions');
      if (!member) {
        const full = hired >= MAX_CREW || counts[role.id] >= role.max, locked = robot && !unlocked;
        const hire = button(locked ? t('cafe.staff.unlockFirst') : full ? (hired >= MAX_CREW ? t('cafe.staff.fullCrew', { max: MAX_CREW }) : t('cafe.staff.fullRole', { max: role.max, role: role.name.toLowerCase() })) : robot ? t('cafe.staff.hireRobot', { wage }) : t('cafe.staff.hire', { person: person.person, price: coins(wage) }), () => act('hire', person.id, () => { staffTab = 'team'; rerender(); }), 'cafe-primary');
        hire.disabled = locked || full || p.coins < wage; actions.append(hire);
      } else if (gift) {
        sheet.append(el('p', 'cafe-note', t('cafe.staff.giftNote')));
      } else {
        if (!active) { const pay = button(t('cafe.staff.pay', { price: coins(wage) }), () => act('hire', person.id, rerender), 'cafe-primary'); pay.disabled = p.coins < wage; actions.append(pay); }
        if (robot) { const lock = button(t('cafe.staff.noTrain'), () => {}, 'cafe-primary'); lock.disabled = true; actions.append(lock); }
        else if (!maxed) { const train = button(t('cafe.staff.train', { level: level + 1, price: coins(trainCost(level)) }), () => act('train', person.id, rerender), 'cafe-primary'); train.disabled = p.coins < trainCost(level); actions.append(train); }
        if (sick && canCover(person.id)) actions.append(button(t('cafe.staff.cover'), () => { staffTab = 'robot'; staffFocus = null; rerender(); }, 'cafe-primary'));
        actions.append(button(t('cafe.staff.fire'), () => act('fire', person.id, rerender)));
      }
      sheet.append(actions);
      root.append(sheet);
    });
  }

  // "Ly bạn pha vs ly robot" (robot-staff mục 5, Hết gói): rp = service giftReport { you, robot, hint }; tổng cộng dồn cả gói.
  function robotCompare(rp) {
    const box = el('section', 'cafe-compare'), table = el('table'), head = el('tr');
    box.append(el('strong', '', t('cafe.compare.title')));
    for (const text of ['', t('cafe.compare.you'), t('cafe.compare.robot')]) head.append(el('th', '', text));
    table.append(head);
    const line = (label, you, robot, tone = null) => {
      const tr = el('tr'); tr.append(el('th', '', label));
      for (const [value, side] of [[you, 'you'], [robot, 'robot']]) { const td = el('td', '', value); if (tone) td.dataset.tone = tone(side); tr.append(td); }
      table.append(tr);
    };
    const side = s => t('cafe.compare.side', { n: s.cups, avg: s.avg.toFixed(1) });
    line(t('cafe.compare.cups'), side(rp.you), side(rp.robot));
    line(t('cafe.compare.walked'), '0', String(rp.robot.walked));
    line(t('cafe.compare.paid'), coins(rp.you.paid), coins(rp.robot.paid));
    line(t('cafe.compare.profit'), t('cafe.coins', { n: signed(rp.you.profit) }), t('cafe.coins', { n: signed(rp.robot.profit) }), s => rp[s].profit >= 0 ? 'good' : 'bad');
    line(t('cafe.compare.fault'), rp.you.fault || '—', rp.robot.faults.map(f => `${f.recipe}: ${f.why}`).join(' · ') || '—');
    box.append(table, el('p', 'cafe-note', rp.hint));
    return box;
  }

  // Bronze/silver/gold cup counts for a shift goal, and the HUD's "x/next medal" line (cafe-fun-review P1).
  function tierGoals(goal) { return SHIFT_TIERS.map(k => Math.ceil(goal * k)); }
  function shiftTarget(shift) {
    const marks = tierGoals(shift.goal), next = marks.findIndex(m => shift.served < m), avg = shiftAvg(shift);
    const low = shift.served >= marks[0] && avg !== null && avg < 2; // ★ gate unmet: no ✓ (PT-11)
    shiftLine.parentElement.dataset.state = low ? 'warn' : '';
    return low ? t('cafe.shift.lowAvg', { n: shift.served, avg: avg.toFixed(1) }) : next < 0 ? t('cafe.shift.gold', { n: shift.served }) : t('cafe.shift.next', { n: shift.served, goal: marks[next], medal: t('cafe.medals')[next] });
  }
  // End-of-shift report: what went well, the reward, and a one-tap next shift.
  function showShiftReport(r) {
    const medal = ['', ...t('cafe.medals')][r.tier || 0], marks = tierGoals(r.goal);
    open('shift', { heading: r.tier ? t('cafe.shift.reached', { medal }) : t('cafe.shift.over'), icon: r.tier ? '🏆' : '⏱' }, root => {
      root.append(row('☕', t('cafe.shift.served', { n: r.served }), t('cafe.shift.marks', { a: marks[0], b: marks[1], c: marks[2], avg: r.avg == null ? '—' : r.avg.toFixed(1), lost: r.lost, home: r.unserved || 0 }), null, r.tier ? 'owned' : null));
      root.append(row('🪙', t('cafe.shift.revenue', { coins: coins(r.revenue) }), r.tier ? t('cafe.shift.bonus', { medal, bonus: r.bonus, rep: r.rep }) : r.message || t('cafe.shift.noBronze')));
      root.append(row(recipeById(r.special).icon, t('cafe.shift.special', { drink: recipeById(r.special).name }), t('cafe.shift.specialDetail')));
      if (r.wasted) root.append(row('🗑️', t('cafe.shift.wasted', { n: r.wasted }), t('cafe.shift.wastedDetail')));
      if (r.robot) root.append(robotCompare(r.robot));
      const actions = el('div', 'cafe-actions');
      actions.append(button(t('cafe.shift.again'), () => { lessonIds = null; dialog.close(); const res = service.toggleOpen(); notice(res.message, res.ok); refreshHud(); }, 'cafe-primary'), button(t('cafe.shift.rest'), () => dialog.close()));
      root.append(actions);
    });
    lessonIds = [...(r.angry ? ['customer'] : []), 'recipe', 'costs'];
  }

  refreshHud();
  return {
    get open() { return dialog.open || Boolean(closeLesson); }, get view() { return view; },
    tick() { if (!dialog.open || !live) return; const next = live.liveKey(); if (next !== live.key) { live.key = next; live.render(body); } },
    refreshHud, openBench, openBook, openPantry, openUpgrades, openStaff, openTable, showShiftReport,
    // service onIncident: bong bóng đọc từ service.incidents, nên chỉ cần vẽ ngay (chửi khách chỉ có 3 s).
    showIncident() { refreshHud(); },
    dispose() { lessonIds = null; closeLesson?.(); events.abort(); if (dialog.open) dialog.close(); incidentLayer.remove(); for (const node of [dialog, quest, ops, rail, nav]) node.remove(); drawer.remove(); },
  };
}
