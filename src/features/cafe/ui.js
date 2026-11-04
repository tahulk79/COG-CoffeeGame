import { CROPS, HUD_UNLOCKS } from '../farm/content.js';
import { createIncidentLayer, clock } from '../../ui/incidents.js';
import { ASSETS, SUPPLIER_PRICE, assetValue, formatCoins, formatMass, upgradePrice } from '../farm/rules.js';
import { recipeShort, SHIFT_TIERS, CANDIDATES, GEAR, MAX_CREW, RECIPES, STAFF_MAX, STAFF_ROLES, STAFF_STATS, SUPPLIES, TABLE_LEVELS, cafeRank, effectLines, lockReason, recipeById, roleOf, staffStat, staffWage, stars, trainCost } from './recipes.js';
import { mountBench } from './bench.js';
import { isSettingsOpen, openSettings } from '../../ui/settings.js';
import { askLesson } from '../../ui/lesson-prompt.js';
import { usesTouch } from '../../ui/dialogue.js';
import { mountHudDrawer } from '../../ui/hud-drawer.js';
import { INDOOR_TABLES, TABLES } from './service.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCoins(Math.abs(n))}`;
const INCIDENT_ICON = { phone: '📱', sick: '🤒', rude: '😤' };
// First-visit guide on the quest card (onboarding-flow.md 3.7); the step is derived from state, nothing saved but the done flag.
const INTRO_STEPS = ['Bấm «Mở cửa» để đón khách.', 'Đứng ở quầy thu ngân để tự nhận order.', 'Tới quầy pha để pha món khách gọi.', 'Cầm ly, bấm đúng bàn của khách (khách mang đi: bấm quầy thu ngân).'];
const stepLine = (step, recipe) => step.type === 'bean' ? `Chọn hạt ${CROPS.find(c => c.id === recipe.bean).name}` : step.type === 'pour' ? `${step.text}: ${step.target[0]}–${step.target[1]} ${step.unit}` : `${step.text}: ${step.options.find(o => o.ok === 1).label}`;

export function createCafeUI({ farm, service, profile, notice, onExit, onOrders, onWalkTable, onWalk = () => {}, onGuide = () => {}, fx = () => {} }) {
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
      if (result.correct && result.perk) notice(`🎓 Mẹo mới: ${result.perk.name} · ${result.perk.effect}`);
      return result;
    } });
  }

  // Native <dialog> gives focus trapping and Esc-to-close; the scene treats it as a movement lock.
  // Markup mirrors the farm modal: green ribbon title, round close button, folder tabs, cream panel.
  const dialog = el('dialog', 'ui-modal ui-modal__window'); dialog.id = 'cafe-dialog'; dialog.setAttribute('aria-labelledby', 'cafe-dialog-title');
  const header = el('header'), title = el('h2'), subtitle = el('p', 'cafe-subtitle'), tabs = el('div', 'cafe-tabs'), body = el('div', 'cafe-dialog-body');
  title.id = 'cafe-dialog-title'; tabs.setAttribute('role', 'tablist');
  const closeButton = button('×', () => dialog.close(), 'cafe-close'); closeButton.setAttribute('aria-label', 'Đóng');
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
  const canCover = id => { const role = roleOf(id); return ['waiter', 'cleaner'].includes(role?.id) && roleCount(service.snap.cafe.crew, role.id) < role.max && workersOpen(); };
  // Bong bóng 📱🤒😤 trên HUD; khi modal (vd quầy pha) mở thì gắn vào dialog để vẫn chạm được.
  const incidentLayer = createIncidentLayer('cafe-incidents');
  function renderIncidents() {
    const now = Date.now(), crew = service.snap.cafe.crew;
    incidentLayer.render(service.incidents.map(i => {
      const left = i.type === 'sick' ? crew.find(m => m.id === i.id)?.rest || 0 : i.until - now;
      const text = i.type === 'rude' ? `${i.name} sắp lỡ lời với khách! · ${clock(left)}` : i.type === 'phone' ? `${i.name} mải chơi điện thoại · ${clock(left)}` : `${i.name} nghỉ ốm · còn ${clock(left)} · không tính lương`;
      const actions = i.type === 'sick' ? (canCover(i.id) ? [{ label: 'Thuê robot thay', onClick: () => openStaff(null, 'robot') }] : [])
        : [{ label: i.type === 'rude' ? 'Can ngay' : 'Nhắc', tone: i.type === 'rude' ? 'gold' : 'go', onClick: () => { service.remind(i.id); refreshHud(); } }];
      return { id: i.id, type: i.type, icon: INCIDENT_ICON[i.type], text, ms: i.type === 'rude' ? Math.max(0, left) : 0, actions };
    }), dialog.open ? dialog : document.body);
  }

  // Same layout as the farm: quest-style card + "today" card under the profile, quick column under coins, wooden bar bottom-right.
  // modal = the tile opens a centred modal, so it gets ui.open instead of the default click.
  const tile = (icon, text, onClick, modal = false) => { const node = button('', modal ? () => { closeLesson?.(); onClick(); } : onClick, 'ui-hud-btn'); node.append(el('span', '', icon), el('small', '', text)); if (modal) node.dataset.sfx = 'ui.open'; return node; };
  const quest = el('div', 'quest-tracker cafe-quest'), questText = el('div'), name = el('h2'), hint = el('p');
  questText.append(name, hint); quest.append(el('span', 'quest-marker', '☕'), questText);
  // Intro steps 2–4: tapping the card walks the player to that step's spot (the 3D arrow can be off-screen on phones).
  const guideHint = el('p', 'ui-guide-hint');
  let walkTarget = null;
  const walkQuest = () => { if (walkTarget) onWalk(walkTarget); };
  quest.addEventListener('click', walkQuest, { signal });
  quest.addEventListener('keydown', e => { if (walkTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); walkQuest(); } }, { signal });
  const ops = el('div', 'cafe-ops'); ops.setAttribute('aria-live', 'off');
  const opLine = icon => { const line = el('span'); line.append(el('i', '', icon), el('b')); ops.append(line); return line.lastChild; };
  const shiftLine = opLine('⏱'), openLine = opLine('🚪'), seatLine = opLine('🪑'), repLine = opLine('⭐'), handLine = opLine('🖐');
  // One-row strip (docs/game-redesign/05 §6): short values on screen, full meaning in the tooltip/accessible name.
  for (const [line, meaning] of [[shiftLine, 'Ca làm: thời gian còn · số ly · món đặc biệt'], [openLine, 'Cửa quán · khách đang xếp hàng'], [seatLine, 'Ghế đang có khách'], [repLine, 'Uy tín quán']]) line.parentElement.title = meaning;
  // Shift timer bar under the shift line: how much of the 4-minute shift is left.
  const shiftBar = el('i', 'cafe-shift-bar'); shiftLine.parentElement.after(shiftBar);
  const leftHud = document.querySelector('.farm-left-hud') || document.body;
  leftHud.append(quest, ops);
  const rail = el('div'); rail.id = 'cafe-rail'; rail.setAttribute('aria-label', 'Order đang chờ'); document.body.append(rail);
  const toggle = tile('🚪', 'Mở cửa', () => { const r = service.toggleOpen(); notice(r.message, r.ok); refreshHud(); });
  // HUD v2 (docs/game-redesign/05 C4): bar = Mở cửa, Kho, Nông trại, Quản lý; the rest sits in the drawer.
  const nav = el('nav'); nav.id = 'cafe-main-nav'; nav.setAttribute('aria-label', 'Menu quán');
  nav.append(toggle, tile('🧺', 'Kho', () => openPantry(), true), tile('🌱', 'Nông trại', onExit));
  document.body.append(nav);
  const drawer = mountHudDrawer(nav, { signal, id: 'cafe-drawer' });
  drawer.grid.append(tile('🛠️', 'Nâng cấp', () => openUpgrades(), true), tile('👥', 'Nhân viên', () => openStaff(), true), tile('📦', 'Đơn farm', onOrders, true), tile('📖', 'Công thức', () => openBook(), true), tile('⚙️', 'Cài đặt', () => openSettings(), true));

  function refreshHud() {
    renderIncidents();
    const cafe = service.snap.cafe, tickets = service.tickets(), seated = service.customers.filter(c => c.seat).length;
    const seats = TABLES.reduce((sum, _, i) => sum + (service.isOpen(i) ? service.tableLevel(i).seats : 0), 0);
    name.textContent = `Quán của ${profile.name} ${'★'.repeat(cafeRank(cafe.reputation))}`;
    openLine.textContent = `${cafe.open ? 'Mở' : 'Đóng'} · ${service.queueLength()} chờ`;
    seatLine.textContent = `${seated}/${seats}${service.dirty.size ? ` · ${service.dirty.size} dọn` : ''}`;
    repLine.textContent = `${Math.round(cafe.reputation)}${service.combo > 1 ? ` · x${service.combo}` : ''}`;
    const shift = service.shift, left = shift ? Math.max(0, shift.endsAt - Date.now()) : 0;
    shiftLine.textContent = shift ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} · ${shiftTarget(shift)} · ⭐ ${recipeById(shift.special).name}` : 'Mở cửa để bắt đầu ca (4 phút)';
    shiftBar.hidden = !shift; if (shift) shiftBar.style.setProperty('--ratio', left / (shift.endsAt - shift.startedAt));
    toggle.lastChild.textContent = cafe.open ? 'Đóng cửa' : 'Mở cửa'; toggle.dataset.notification = String(!cafe.open);
    const key = tickets.map(t => `${t.id}:${t.covered}:${t.seconds}`).join('|') + `|${service.benchTarget}`;
    rail.hidden = !tickets.length;
    if (rail.dataset.key !== key) {
      rail.dataset.key = key; rail.replaceChildren();
      for (const t of tickets.slice(0, 8)) {
        const chip = el('span', 'cafe-chip'); chip.dataset.covered = String(t.covered); chip.dataset.urgent = String(t.ratio < .3);
        // Order ticket: who (table / take-away), what (drink name), how long; ✓ once a cup is on its way.
        chip.title = `${t.label} · ${t.recipe.name} · còn ${t.seconds} giây`;
        chip.append(el('small', 'cafe-chip-who', t.label), el('b', '', t.recipe.icon), el('strong', '', recipeShort(t.recipe.id)), el('small', '', t.id === service.benchTarget ? 'đang pha' : `${t.seconds}s`));
        const bar = el('i', 'cafe-patience'); bar.style.setProperty('--ratio', t.ratio); chip.append(bar); rail.append(chip);
      }
    }
    const held = service.hand && RECIPES.find(r => r.id === service.hand.recipeId);
    handLine.textContent = held ? `Đang cầm ${held.name} ${starText(service.hand.stars)}` : service.shelf.length ? `Kệ có ${service.shelf.length} ly chờ mang` : '';
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
    toggle.classList.toggle('ui-attention', step === 1);
    const target = [null, null, 'register', 'bar', guest ? (guest.seat ? `table-${guest.seat.table}` : 'register') : null][step];
    onGuide(target);
    if (walkTarget !== target) {
      walkTarget = target;
      if (target) { quest.setAttribute('role', 'button'); quest.tabIndex = 0; questText.append(guideHint); }
      else { quest.removeAttribute('role'); quest.removeAttribute('tabindex'); guideHint.remove(); }
    }
    if (target) guideHint.textContent = `👆 ${usesTouch() ? 'Chạm' : 'Bấm'} để tới đó`;
    hint.textContent = step ? `Bước ${step}/4 · ${INTRO_STEPS[step - 1]}`
      : beanHint ? 'Quán chưa có hạt rang · Về farm gửi hạt (Đơn farm) hoặc Kho → Nhập hạt ngoài.'
      : !cafe.open && !service.customers.length ? 'Bấm 🚪 Mở cửa để đón khách.'
      : held ? 'Bấm vào bàn của khách (khách mang đi: quầy thu ngân) để giao ly.'
      : service.shelf.length ? 'Ra quầy pha chế lấy ly trên kệ.'
      : stuck ? (stuck.blocked.missing ? `${stuck.person.person} dừng pha ${stuck.blocked.recipe.name}: ${stuck.blocked.missing} Kho → nhập thêm.` : `${stuck.person.person} chưa thạo ${stuck.blocked.recipe.name}: tự pha mẫu đạt ${stuck.blocked.score} điểm để dạy.`)
      : tickets.some(t => !t.covered) ? 'Ra quầy pha chế để pha order.'
      : service.queueLength() ? 'Ra quầy thu ngân nhận order.'
      : service.dirty.size ? 'Bấm bàn có ly bẩn để dọn.' : 'Chờ khách vào quán…';
  }

  function openBench() {
    open('bench', { heading: 'Quầy pha chế', icon: '☕' }, root => mountBench(root, { farm, service, notice, fx, close: () => dialog.close(), openPantry, askLater: ids => { lessonIds = ids; } }));
  }

  // Recipe book: list of recipes; picking one shows its full card in the same modal.
  function openBook(selected = null) {
    open('book', { heading: 'Sổ công thức', icon: '📖', note: selected ? '' : 'Tỉ lệ pha thật · luyện tới 3★ để pha theo trí nhớ' }, root => {
      const cafe = service.refresh().cafe, recipe = selected && recipeById(selected);
      if (recipe) {
        const m = cafe.mastery[recipe.id];
        root.append(button('◀ Tất cả công thức', () => openBook(), 'cafe-link'));
        root.append(row(recipe.icon, recipe.name, `${starText(stars(m?.best || 0))} · ${formatCoins(recipe.price)} xu · đã pha ${m?.made || 0} ly`));
        const facts = el('dl', 'cafe-facts');
        for (const [key, text] of [['Tỉ lệ', recipe.card.ratio], ['Dụng cụ', recipe.card.tool], ['Độ xay', recipe.card.grind], ['Nhiệt độ', recipe.card.temp], ['Thời gian', recipe.card.time]]) facts.append(el('dt', '', key), el('dd', '', text));
        const steps = el('ol', 'cafe-steps');
        for (const step of recipe.steps) { const li = el('li', '', stepLine(step, recipe)); if (step.learn) li.append(el('small', '', step.learn)); steps.append(li); }
        root.append(facts, steps, el('p', 'cafe-story', recipe.story));
        return;
      }
      const grid = el('div', 'cafe-grid');
      for (const r of RECIPES) {
        const reason = lockReason(r, cafe), m = cafe.mastery[r.id];
        const card = button('', () => openBook(r.id), 'cafe-card'); card.dataset.locked = String(Boolean(reason));
        card.append(el('span', 'cafe-icon', reason ? '🔒' : r.icon), el('strong', '', r.name), el('small', '', reason || `${starText(stars(m?.best || 0))} · ${formatCoins(r.price)} xu`));
        grid.append(card);
      }
      root.append(grid);
    });
  }

  let pantryTab = 'beans';
  function openPantry() {
    open('pantry', { heading: 'Kho nguyên liệu', icon: '🧺' }, function render(root) {
      root.replaceChildren();
      setTabs([['beans', '🫘 Hạt rang'], ['supplies', '🥛 Nguyên liệu']], pantryTab, id => { pantryTab = id; render(root); });
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      if (pantryTab === 'beans') {
        const pending = p.orders.filter(o => o.source !== 'shop' && ['open', 'transit'].includes(o.status)).length;
        const coming = cafe.shipments.reduce((s, t) => s + t.lots.reduce((n, l) => n + l.grams, 0), 0);
        root.append(el('p', 'cafe-note', `Đặt hạt từ nông trại (rẻ, chờ farm rang & giao) · ${pending} đơn đang làm${coming ? ` · ${formatMass(coming)} đang giao tới` : ''}`));
        for (const crop of CROPS) {
          const grams = cafe.stock.roasted[crop.id] || 0, unlocked = crop.level <= farm.level;
          const order = button('Đặt farm 252 g', () => act('order', crop.id, rerender)); order.disabled = !unlocked;
          root.append(row('🫘', `${crop.name} · ${formatMass(grams)}`, unlocked ? `Đủ khoảng ${Math.floor(grams / 18)} ly` : `Mở ở nông trại cấp ${crop.level}`, order, grams < 60 && unlocked ? 'low' : null));
        }
        const supplier = button(`${SUPPLIER_PRICE} xu`, () => act('supply', null, rerender)); supplier.disabled = p.coins < SUPPLIER_PRICE;
        root.append(row('📦', 'Nhập hạt ngoài 500 g', 'Có ngay nhưng đắt, chất lượng thường.', supplier));
        return;
      }
      for (const s of SUPPLIES) {
        const buy = button(`${formatCoins(s.price)} xu`, () => act('buy', s.id, rerender)); buy.disabled = p.coins < s.price;
        root.append(row(s.icon, `${s.name} · ${cafe.supplies[s.id].toLocaleString('vi-VN')} ${s.unit}`, `Nhập ${s.packLabel}`, buy, cafe.supplies[s.id] < s.pack / 5 ? 'low' : null));
      }
    });
  }

  let upgradeTab = 'tables';
  function openUpgrades(tab = null) {
    if (tab) upgradeTab = tab;
    open('upgrades', { heading: 'Nâng cấp quán', icon: '🛠️' }, function render(root) {
      root.replaceChildren();
      setTabs([['tables', '🪑 Bàn ghế'], ['gear', '⚙️ Pha chế'], ['auto', '🤖 Tự động'], ['expand', '🌿 Mở rộng']], upgradeTab, id => { upgradeTab = id; render(root); });
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      if (upgradeTab === 'tables') {
        const asset = ASSETS.find(a => a.id === 'cafe'), lv = p.upgrades.cafe, price = upgradePrice('cafe', lv), maxed = lv >= 10;
        const buyTables = button(maxed ? 'Tối đa' : `${price} xu`, () => act('upgrade', null, rerender));
        buyTables.disabled = maxed || p.coins < price || farm.level < lv + 1;
        root.append(row('🪑', `Mở thêm bàn · ${assetValue(asset, lv)}/10 bàn`, maxed ? 'Đã mở đủ bàn' : `Cấp ${lv + 1}: ${assetValue(asset, lv + 1)} bàn${farm.level < lv + 1 ? ` · cần nông trại cấp ${lv + 1}` : ''}`, buyTables));
        root.append(el('p', 'cafe-note', 'Bấm vào từng bàn để nâng cấp bàn đó:'));
        for (let i = 0; i < TABLES.length; i++) if (service.isOpen(i)) {
          const level = cafe.tables[i], info = TABLE_LEVELS[level - 1];
          root.append(row(['🪵', '🪑', '🛋️', '🛋️'][level - 1], `Bàn ${i + 1} · ${info.name}`, `${levelDots(level, TABLE_LEVELS.length)} · ${info.seats} ghế`, button('Nâng cấp', () => openTable(i, 'upgrade'))));
        }
        return;
      }
      if (upgradeTab === 'auto') root.append(el('p', 'cafe-note', 'Mỗi thiết bị lắp vào một ô cố định trên quầy (khung trống trong quán), lối đi không đổi.'));
      if (upgradeTab === 'expand') root.append(el('p', 'cafe-note', 'Mở các khu đang rào trong quán. Mua xong khu đó dùng được ngay.'));
      for (const gear of GEAR.filter(g => (g.group || 'gear') === upgradeTab)) {
        const level = cafe.gear[gear.id], max = gear.prices.length, cost = gear.prices[level];
        const buy = button(level >= max ? 'Tối đa' : `${cost} xu`, () => act('gear', gear.id, rerender));
        buy.disabled = level >= max || p.coins < cost;
        root.append(row(gear.icon, `${gear.name} · ${level ? levelDots(level, max) : 'chưa có'}`, gear.detail, buy));
      }
    });
  }

  // Table card: who sits there and what they wait for, used cups, and the table's own upgrade path.
  function openTable(table, tab = 'seats') {
    tableTab = tab;
    open('table', { heading: `Bàn ${table + 1}`, icon: '🪑' }, function render(root) {
      root.replaceChildren();
      const p = service.refresh(), cafe = p.cafe, unlocked = service.isOpen(table), rerender = () => render(root);
      if (!unlocked && table >= INDOOR_TABLES) {
        // Garden tables come with Sân vườn, not with the table upgrade.
        const terrace = GEAR.find(g => g.id === 'terrace');
        root.append(row('🔒', 'Bàn sân vườn', terrace.detail));
        const buy = button(`🌿 Mở Sân vườn · ${terrace.prices[0]} xu`, () => act('gear', 'terrace', rerender), 'cafe-primary');
        buy.disabled = p.coins < terrace.prices[0];
        const actions = el('div', 'cafe-actions'); actions.append(buy); root.append(actions);
        return;
      }
      if (!unlocked) {
        const asset = ASSETS.find(a => a.id === 'cafe'), lv = p.upgrades.cafe, price = upgradePrice('cafe', lv), next = table === service.indoorCount();
        root.append(row('🔒', 'Bàn chưa mở', next ? `Mở ở nâng cấp Bàn ghế cấp ${lv + 1} (${assetValue(asset, lv + 1)} bàn)${farm.level < lv + 1 ? ` · cần nông trại cấp ${lv + 1}` : ''}` : 'Mở các bàn gần quầy trước.'));
        if (next) {
          const buy = button(`🪑 Mở bàn · ${price} xu`, () => act('upgrade', null, rerender), 'cafe-primary');
          buy.disabled = lv >= 10 || p.coins < price || farm.level < lv + 1;
          const actions = el('div', 'cafe-actions'); actions.append(buy); root.append(actions);
        }
        return;
      }
      setTabs([['seats', '👥 Khách'], ['upgrade', '⬆️ Nâng cấp']], tableTab, id => { tableTab = id; render(root); });
      const level = cafe.tables[table], info = TABLE_LEVELS[level - 1], guests = service.guestsAt(table);
      if (tableTab === 'seats') {
        const dirty = [0, 1, 2, 3].filter(slot => service.dirty.has(`${table}:${slot}`)).length;
        const servable = service.hand && guests.some(c => c.recipeId === service.hand.recipeId && ['seated', 'toSeat'].includes(c.phase));
        if (servable || dirty) { const actions = el('div', 'cafe-actions'); actions.append(button(servable ? '🚶 Mang ly tới bàn' : `🧽 Tới dọn bàn (${dirty} chỗ)`, () => { dialog.close(); onWalkTable(table); }, 'cafe-primary')); root.append(actions); }
        for (let slot = 0; slot < info.seats; slot++) {
          const guest = guests.find(c => c.seat.slot === slot), recipe = guest?.recipeId && recipeById(guest.recipeId);
          const state = !guest ? (service.dirty.has(`${table}:${slot}`) ? ['🧽', 'Ly bẩn', 'Dọn để khách mới ngồi được.', 'low'] : ['💺', 'Ghế trống', 'Sẵn sàng đón khách.'])
            : guest.phase === 'drinking' ? [guest.mood || '😊', `Đang uống ${recipe.name}`, 'Uống xong khách về, để lại ly cần dọn.']
            : [recipe.icon, `Chờ ${recipe.name}`, `Kiên nhẫn còn ${Math.max(0, Math.ceil(guest.patience))} giây${service.hand?.recipeId === recipe.id ? ' · bạn đang cầm đúng ly' : ''}`];
          root.append(row(state[0], `Ghế ${slot + 1} · ${state[1]}`, state[2], null, state[3]));
        }
        return;
      }
      TABLE_LEVELS.forEach((item, i) => {
        const owned = i < level, nextOne = i === level;
        const buy = nextOne ? button(`${formatCoins(item.price)} xu`, () => act('table', table, rerender)) : null;
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
    open('staff', { heading: 'Nhân viên quán', icon: '👥' }, function render(root) {
      root.replaceChildren();
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root), now = Date.now(), unlocked = workersOpen();
      const counts = Object.fromEntries(STAFF_ROLES.map(r => [r.id, roleCount(cafe.crew, r.id)])), hired = cafe.crew.filter(m => !m.gift).length;
      setTabs([['team', `👥 Đội quán (${hired}/${MAX_CREW})`], ['hire', '🧑 Người'], ['robot', `${unlocked ? '🤖' : '🔒'} Robot`]], staffTab, id => { staffTab = id; staffFocus = null; rerender(); });
      const free = c => !c.giftOnly && !cafe.crew.some(m => m.id === c.id);
      const people = staffTab === 'team' ? cafe.crew.map(m => CANDIDATES.find(c => c.id === m.id)).filter(Boolean)
        : staffTab === 'robot' ? CANDIDATES.filter(c => c.kind === 'robot' && free(c)) : CANDIDATES.filter(c => c.kind !== 'robot' && free(c));
      if (staffTab === 'team') root.append(el('p', 'cafe-note', `Mỗi người một việc, tự nhận việc gần và gấp nhất. ${STAFF_ROLES.map(r => `${r.icon} ${counts[r.id]}/${r.max}`).join(' · ')}`));
      if (staffTab === 'robot') root.append(el('p', unlocked ? 'cafe-note' : 'cafe-warning', unlocked ? 'Robot bưng/dọn: 3 xu/ca, mang 1 ly/chuyến, chậm hơn người, không tip, không đào tạo, không bao giờ gặp sự cố.' : '🔒 Mở Nhân viên ở farm trước (mua ruộng thứ 2 hoặc lên cấp 3) để thuê robot.'));
      if (!people.length) { root.append(el('p', 'cafe-note', staffTab === 'team' ? 'Chưa có nhân viên. Mở tab Người hoặc Robot để thuê.' : 'Đã thuê hết ứng viên.')); return; }
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
        tile.append(el('span', 'cafe-roster-avatar', c.avatar), el('strong', '', c.person), el('small', '', `${badge ? `${badge} ` : ''}${role.icon} ${role.name}${member?.gift ? ' · 🎁 Gói thử' : member && !robot ? ` · Cấp ${member.level}` : ''}`));
        roster.append(tile);
      }
      root.append(roster);

      const person = CANDIDATES.find(c => c.id === staffFocus), role = roleOf(person.id), member = cafe.crew.find(m => m.id === person.id);
      const robot = person.kind === 'robot', gift = Boolean(member?.gift), sick = member?.rest > 0;
      const level = member?.level || 1, paid = member?.paidUntil > now, active = paid && cafe.open, maxed = robot || level >= STAFF_MAX;
      const wage = staffWage(role, level, person), left = member ? Math.ceil((member.paidUntil - now) / 1000) : 0;
      const sheet = el('section', 'cafe-staff-sheet');
      const head = el('div', 'cafe-staff-head'), title = el('div');
      title.append(el('strong', '', `${person.person} · ${role.name}`), el('small', '', member ? (sick ? `🤒 Nghỉ ốm · còn ${clock(member.rest)} khi quán mở · không tính lương` : gift ? `🎁 Gói thử · còn ${left}s khi quán mở · không gia hạn` : active ? `🟢 Đang trong ca · còn ${left}s` : paid ? `⏸ Đã trả ca · còn ${left}s, chạy khi quán mở` : '🟠 Hết ca · tự trả lương khi quán mở và đủ xu') : `⚪ Ứng viên · ${role.name} ${counts[role.id]}/${role.max}`));
      head.append(el('span', 'cafe-staff-avatar', person.avatar), title, el('b', 'cafe-staff-level', robot ? '🤖 Robot' : `Cấp ${level}/${STAFF_MAX}`));
      sheet.append(head);
      if (!member) sheet.append(el('p', 'cafe-staff-bio', `“${person.bio}”`));
      sheet.append(el('p', 'cafe-staff-summary', gift ? `${role.detail} · Robot của gói thử, miễn phí 1 ca` : robot ? `${role.detail} · Lương cố định ${wage} xu/ca (4 phút)` : `${role.detail} · ${member ? 'Lương' : 'Phí thuê = lương ca đầu'} ${wage} xu/ca (4 phút)${maxed ? '' : ` · cấp ${level + 1}: ${staffWage(role, level + 1, person)} xu/ca`}`));
      // Training adds +6 to every stat; the green number previews the next level.
      for (const [key, label] of STAFF_STATS) {
        const value = staffStat(person, level, key), next = staffStat(person, level + 1, key);
        const line = el('div', 'cafe-stat'), meter = el('meter'); meter.min = 0; meter.max = 100; meter.value = value; meter.setAttribute('aria-label', label);
        line.append(el('span', '', label), meter, el('b', '', String(value)), el('i', '', !maxed && next > value ? `→ ${next}` : ''));
        sheet.append(line);
      }
      const effects = el('div', 'cafe-effects');
      effects.append(el('strong', '', 'Hiệu quả công việc'));
      const lines = effectLines(person, level), later = maxed ? null : effectLines(person, level + 1);
      lines.forEach(([stat, text], i) => { const item = el('p'); item.append(el('span', '', stat), el('b', '', text)); if (later) item.append(el('i', '', `→ ${later[i][1]}`)); effects.append(item); });
      sheet.append(effects);
      const actions = el('div', 'cafe-actions');
      if (!member) {
        const full = hired >= MAX_CREW || counts[role.id] >= role.max, locked = robot && !unlocked;
        const hire = button(locked ? '🔒 Mở Nhân viên ở farm trước' : full ? (hired >= MAX_CREW ? `Đã đủ ${MAX_CREW} người` : `Đã đủ ${role.max} ${role.name.toLowerCase()}`) : robot ? `🤖 Thuê · ${wage} xu/ca` : `🤝 Thuê ${person.person} · ${wage} xu`, () => act('hire', person.id, () => { staffTab = 'team'; rerender(); }), 'cafe-primary');
        hire.disabled = locked || full || p.coins < wage; actions.append(hire);
      } else if (gift) {
        sheet.append(el('p', 'cafe-note', '🎁 Robot gói thử: tự rời quán khi hết ca, không thuê lại, không đào tạo hay cho nghỉ.'));
      } else {
        if (!active) { const pay = button(`💵 Trả lương ca mới · ${wage} xu`, () => act('hire', person.id, rerender), 'cafe-primary'); pay.disabled = p.coins < wage; actions.append(pay); }
        if (robot) { const lock = button('🔒 Robot không đào tạo', () => {}, 'cafe-primary'); lock.disabled = true; actions.append(lock); }
        else if (!maxed) { const train = button(`🎓 Đào tạo lên cấp ${level + 1} · ${trainCost(level)} xu`, () => act('train', person.id, rerender), 'cafe-primary'); train.disabled = p.coins < trainCost(level); actions.append(train); }
        if (sick && canCover(person.id)) actions.append(button('🤖 Thuê robot thay', () => { staffTab = 'robot'; staffFocus = null; rerender(); }, 'cafe-primary'));
        actions.append(button('Cho nghỉ', () => act('fire', person.id, rerender)));
      }
      sheet.append(actions);
      root.append(sheet);
    });
  }

  // "Ly bạn pha vs ly robot" (robot-staff mục 5, Hết gói): rp = service giftReport { you, robot, hint }; tổng cộng dồn cả gói.
  function robotCompare(rp) {
    const box = el('section', 'cafe-compare'), table = el('table'), head = el('tr');
    box.append(el('strong', '', '🤖 Ly bạn pha vs ly robot'));
    for (const text of ['', 'Bạn', 'Robot']) head.append(el('th', '', text));
    table.append(head);
    const line = (label, you, robot, tone = null) => {
      const tr = el('tr'); tr.append(el('th', '', label));
      for (const [value, side] of [[you, 'you'], [robot, 'robot']]) { const td = el('td', '', value); if (tone) td.dataset.tone = tone(side); tr.append(td); }
      table.append(tr);
    };
    const side = s => `${s.cups} ly · ${s.avg.toFixed(1)}★`;
    line('Số ly · ★ TB', side(rp.you), side(rp.robot));
    line('Khách chê bỏ về', '0', String(rp.robot.walked));
    line('Xu thu', `${formatCoins(rp.you.paid)} xu`, `${formatCoins(rp.robot.paid)} xu`);
    line('Lãi sau hạt + vật tư', `${signed(rp.you.profit)} xu`, `${signed(rp.robot.profit)} xu`, s => rp[s].profit >= 0 ? 'good' : 'bad');
    line('Lỗi chính', rp.you.fault || '—', rp.robot.faults.map(f => `${f.recipe}: ${f.why}`).join(' · ') || '—');
    box.append(table, el('p', 'cafe-note', rp.hint));
    return box;
  }

  // Bronze/silver/gold cup counts for a shift goal, and the HUD's "x/next medal" line (cafe-fun-review P1).
  function tierGoals(goal) { return SHIFT_TIERS.map(k => Math.ceil(goal * k)); }
  function shiftTarget(shift) {
    const marks = tierGoals(shift.goal), next = marks.findIndex(m => shift.served < m);
    return next < 0 ? `${shift.served} ly · Vàng ✓` : `${shift.served}/${marks[next]} ly → ${['Đồng', 'Bạc', 'Vàng'][next]}`;
  }
  // End-of-shift report: what went well, the reward, and a one-tap next shift.
  function showShiftReport(r) {
    const medal = ['', 'Đồng', 'Bạc', 'Vàng'][r.tier || 0], marks = tierGoals(r.goal);
    open('shift', { heading: r.tier ? `Đạt mốc ${medal}!` : 'Hết ca', icon: r.tier ? '🏆' : '⏱' }, root => {
      root.append(row('☕', `Phục vụ ${r.served} ly`, `Mốc Đồng ${marks[0]} · Bạc ${marks[1]} · Vàng ${marks[2]} · TB ${r.avg.toFixed(1)}★ (cần ≥ 2★) · khách bỏ về ${r.lost}`, null, r.tier ? 'owned' : null));
      root.append(row('🪙', `Doanh thu ca ${formatCoins(r.revenue)} xu`, r.tier ? `Thưởng mốc ${medal} +${r.bonus} xu · Uy tín +${r.rep}` : r.message || 'Chưa đạt mốc Đồng'));
      root.append(row(recipeById(r.special).icon, `Món của ca: ${recipeById(r.special).name}`, 'Món của ca được gọi nhiều hơn và bán đắt hơn 30%.'));
      if (r.robot) root.append(robotCompare(r.robot));
      const actions = el('div', 'cafe-actions');
      actions.append(button('🚪 Mở ca mới', () => { lessonIds = null; dialog.close(); const res = service.toggleOpen(); notice(res.message, res.ok); refreshHud(); }, 'cafe-primary'), button('Nghỉ một lát', () => dialog.close()));
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
